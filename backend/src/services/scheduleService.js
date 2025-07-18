// services/scheduleService.js
const Schedule = require('../models/Schedule');
const pool = require('../config/database');
const notificationService = require('./notificationService');

class ScheduleService {
  // สร้างตารางใหม่พร้อมตรวจสอบความขัดแย้ง
  static async createSchedule(scheduleData, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // ตรวจสอบความขัดแย้งก่อนสร้าง
      const conflicts = await Schedule.checkConflicts(scheduleData);
      
      if (conflicts.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`พบความขัดแย้งในตาราง: ${conflicts.map(c => 
          `${c.conflict_type} - ${c.conflict_with} เวลา ${c.start_time}-${c.end_time}`
        ).join(', ')}`);
      }
      
      // สร้างตาราง
      const schedule = await Schedule.create({
        ...scheduleData,
        created_by: userId
      });
      
      await client.query('COMMIT');
      
      // ส่งการแจ้งเตือนให้อาจารย์ที่เกี่ยวข้อง
      if (schedule.instructor_id) {
        await notificationService.createNotification({
          user_id: schedule.instructor_id,
          title: 'ตารางการฝึกปฏิบัติใหม่',
          message: `มีการสร้างตารางการฝึกปฏิบัติใหม่ วันที่ ${schedule.schedule_date} เวลา ${schedule.start_time}-${schedule.end_time}`,
          type: 'info',
          related_table: 'schedules',
          related_id: schedule.schedule_id
        });
      }
      
      return schedule;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // แก้ไขตารางพร้อมตรวจสอบความขัดแย้ง
  static async updateSchedule(scheduleId, scheduleData, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // ดึงข้อมูลเดิม
      const oldSchedule = await Schedule.findById(scheduleId);
      if (!oldSchedule) {
        throw new Error('ไม่พบตารางที่ต้องการแก้ไข');
      }
      
      // ตรวจสอบความขัดแย้ง (ยกเว้นตารางปัจจุบัน)
      const conflicts = await Schedule.checkConflicts(scheduleData, scheduleId);
      
      if (conflicts.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`พบความขัดแย้งในตาราง: ${conflicts.map(c => 
          `${c.conflict_type} - ${c.conflict_with} เวลา ${c.start_time}-${c.end_time}`
        ).join(', ')}`);
      }
      
      // แก้ไขตาราง
      const updatedSchedule = await Schedule.update(scheduleId, scheduleData);
      
      await client.query('COMMIT');
      
      // ตรวจสอบการเปลี่ยนแปลงสำคัญและส่งการแจ้งเตือน
      const hasImportantChanges = 
        oldSchedule.schedule_date !== updatedSchedule.schedule_date ||
        oldSchedule.start_time !== updatedSchedule.start_time ||
        oldSchedule.end_time !== updatedSchedule.end_time ||
        oldSchedule.location_id !== updatedSchedule.location_id ||
        oldSchedule.instructor_id !== updatedSchedule.instructor_id;
      
      if (hasImportantChanges) {
        // แจ้งเตือนอาจารย์เดิม (ถ้าเปลี่ยนอาจารย์)
        if (oldSchedule.instructor_id && oldSchedule.instructor_id !== updatedSchedule.instructor_id) {
          await notificationService.createNotification({
            user_id: oldSchedule.instructor_id,
            title: 'ตารางการฝึกปฏิบัติถูกยกเลิก',
            message: `ตารางการฝึกปฏิบัติวันที่ ${oldSchedule.schedule_date} ถูกยกเลิกการมอบหมาย`,
            type: 'warning',
            related_table: 'schedules',
            related_id: scheduleId
          });
        }
        
        // แจ้งเตือนอาจารย์ใหม่
        if (updatedSchedule.instructor_id) {
          await notificationService.createNotification({
            user_id: updatedSchedule.instructor_id,
            title: 'ตารางการฝึกปฏิบัติมีการเปลี่ยนแปลง',
            message: `ตารางการฝึกปฏิบัติวันที่ ${updatedSchedule.schedule_date} เวลา ${updatedSchedule.start_time}-${updatedSchedule.end_time} มีการเปลี่ยนแปลง`,
            type: 'info',
            related_table: 'schedules',
            related_id: scheduleId
          });
        }
      }
      
      return updatedSchedule;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // ลบตาราง
  static async deleteSchedule(scheduleId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // ดึงข้อมูลก่อนลบ
      const schedule = await Schedule.findById(scheduleId);
      if (!schedule) {
        throw new Error('ไม่พบตารางที่ต้องการลบ');
      }
      
      // ตรวจสอบว่ามีการเข้าร่วมแล้วหรือไม่
      const attendanceCheck = await client.query(
        'SELECT COUNT(*) FROM attendance WHERE schedule_id = $1',
        [scheduleId]
      );
      
      if (parseInt(attendanceCheck.rows[0].count) > 0) {
        throw new Error('ไม่สามารถลบตารางที่มีการบันทึกการเข้าร่วมแล้ว');
      }
      
      // ลบการจับคู่กลุ่ม
      await client.query('DELETE FROM schedule_groups WHERE schedule_id = $1', [scheduleId]);
      
      // ลบตาราง
      const deletedSchedule = await Schedule.delete(scheduleId);
      
      await client.query('COMMIT');
      
      // แจ้งเตือนอาจารย์ที่เกี่ยวข้อง
      if (schedule.instructor_id) {
        await notificationService.createNotification({
          user_id: schedule.instructor_id,
          title: 'ตารางการฝึกปฏิบัติถูกยกเลิก',
          message: `ตารางการฝึกปฏิบัติวันที่ ${schedule.schedule_date} เวลา ${schedule.start_time}-${schedule.end_time} ถูกยกเลิก`,
          type: 'warning',
          related_table: 'schedules',
          related_id: scheduleId
        });
      }
      
      return deletedSchedule;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // จับคู่กลุ่มกับตาราง
  static async assignGroupsToSchedule(scheduleId, groupIds, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // ดึงข้อมูลตาราง
      const schedule = await Schedule.findById(scheduleId);
      if (!schedule) {
        throw new Error('ไม่พบตารางที่ต้องการ');
      }
      
      // ลบการจับคู่เดิม
      await client.query('DELETE FROM schedule_groups WHERE schedule_id = $1', [scheduleId]);
      
      // เพิ่มการจับคู่ใหม่
      for (const groupId of groupIds) {
        await client.query(`
          INSERT INTO schedule_groups (schedule_id, group_id, assigned_date, status)
          VALUES ($1, $2, NOW(), 'active')
        `, [scheduleId, groupId]);
      }
      
      // อัพเดทจำนวนนักศึกษาปัจจุบัน
      await Schedule.updateCurrentStudents(scheduleId);
      
      await client.query('COMMIT');
      
      return { success: true, message: 'จับคู่กลุ่มกับตารางสำเร็จ' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // สร้างตารางหลายรายการ (Bulk Create)
  static async createBulkSchedules(schedulesData, userId) {
    const client = await pool.connect();
    const results = {
      success: [],
      errors: []
    };
    
    try {
      await client.query('BEGIN');
      
      for (let i = 0; i < schedulesData.length; i++) {
        try {
          const scheduleData = schedulesData[i];
          
          // ตรวจสอบความขัดแย้ง
          const conflicts = await Schedule.checkConflicts(scheduleData);
          
          if (conflicts.length > 0) {
            results.errors.push({
              index: i,
              data: scheduleData,
              error: `พบความขัดแย้งในตาราง: ${conflicts.map(c => 
                `${c.conflict_type} - ${c.conflict_with}`
              ).join(', ')}`
            });
            continue;
          }
          
          // สร้างตาราง
          const schedule = await Schedule.create({
            ...scheduleData,
            created_by: userId
          });
          
          results.success.push(schedule);
          
        } catch (error) {
          results.errors.push({
            index: i,
            data: schedulesData[i],
            error: error.message
          });
        }
      }
      
      await client.query('COMMIT');
      
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // ดึงตารางสำหรับ Calendar
  static async getCalendarEvents(startDate, endDate, filters = {}) {
    try {
      const { instructorId, courseId, locationId, status } = filters;
      
      let query = `
        SELECT 
          s.schedule_id as id,
          s.schedule_date,
          s.start_time,
          s.end_time,
          s.status,
          c.course_name as title,
          c.course_code,
          at.type_name as activity_type,
          at.color_code as backgroundColor,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          l.location_name,
          s.current_students,
          s.max_students,
          s.description
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
        LEFT JOIN users u ON inst.user_id = u.user_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE s.schedule_date BETWEEN $1 AND $2
      `;
      
      let params = [startDate, endDate];
      let paramCount = 2;
      
      if (instructorId) {
        paramCount++;
        query += ` AND s.instructor_id = $${paramCount}`;
        params.push(instructorId);
      }
      
      if (courseId) {
        paramCount++;
        query += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      if (locationId) {
        paramCount++;
        query += ` AND s.location_id = $${paramCount}`;
        params.push(locationId);
      }
      
      if (status) {
        paramCount++;
        query += ` AND s.status = $${paramCount}`;
        params.push(status);
      }
      
      query += ` ORDER BY s.schedule_date, s.start_time`;
      
      const result = await pool.query(query, params);
      
      // แปลงรูปแบบสำหรับ FullCalendar
      const events = result.rows.map(row => ({
        id: row.id,
        title: `${row.title} - ${row.activity_type}`,
        start: `${row.schedule_date}T${row.start_time}`,
        end: `${row.schedule_date}T${row.end_time}`,
        backgroundColor: row.backgroundcolor || '#4285F4',
        borderColor: row.backgroundcolor || '#4285F4',
        extendedProps: {
          course_code: row.course_code,
          activity_type: row.activity_type,
          instructor_name: row.instructor_name,
          location_name: row.location_name,
          current_students: row.current_students,
          max_students: row.max_students,
          description: row.description,
          status: row.status
        }
      }));
      
      return events;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงภาระงานของอาจารย์
  static async getInstructorWorkload(instructorId, startDate, endDate) {
    try {
      const result = await pool.query(`
        SELECT 
          DATE(s.schedule_date) as date,
          COUNT(*) as total_sessions,
          SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600) as total_hours,
          COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
          COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_sessions,
          COALESCE(SUM(s.current_students), 0) as total_students
        FROM schedules s
        WHERE s.instructor_id = $1
        AND s.schedule_date BETWEEN $2 AND $3
        GROUP BY DATE(s.schedule_date)
        ORDER BY date
      `, [instructorId, startDate, endDate]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงสถิติการใช้สถานที่
  static async getLocationUsageStats(locationId, startDate, endDate) {
    try {
      const result = await pool.query(`
        SELECT 
          DATE(s.schedule_date) as date,
          COUNT(*) as total_sessions,
          SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600) as total_hours,
          COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
          COALESCE(AVG(s.current_students), 0) as avg_students_per_session,
          l.capacity,
          ROUND(AVG(s.current_students::decimal / NULLIF(l.capacity, 0)) * 100, 2) as utilization_rate
        FROM schedules s
        JOIN locations l ON s.location_id = l.location_id
        WHERE s.location_id = $1
        AND s.schedule_date BETWEEN $2 AND $3
        GROUP BY DATE(s.schedule_date), l.capacity
        ORDER BY date
      `, [locationId, startDate, endDate]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ส่งการแจ้งเตือนตารางที่ใกล้จะถึง
  static async sendUpcomingScheduleNotifications() {
    try {
      // ดึงตารางที่จะเกิดขึ้นในวันถัดไป
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const result = await pool.query(`
        SELECT 
          s.schedule_id,
          s.schedule_date,
          s.start_time,
          s.end_time,
          c.course_name,
          l.location_name,
          inst.instructor_id,
          inst.user_id,
          u.first_name,
          u.last_name
        FROM schedules s
        JOIN courses c ON s.course_id = c.course_id
        JOIN locations l ON s.location_id = l.location_id
        JOIN instructors inst ON s.instructor_id = inst.instructor_id
        JOIN users u ON inst.user_id = u.user_id
        WHERE s.schedule_date = $1
        AND s.status = 'scheduled'
      `, [tomorrowStr]);
      
      // ส่งการแจ้งเตือนให้แต่ละอาจารย์
      for (const schedule of result.rows) {
        await notificationService.createNotification({
          user_id: schedule.user_id,
          title: 'ตารางการฝึกปฏิบัติพรุ่งนี้',
          message: `คุณมีตารางการฝึกปฏิบัติ ${schedule.course_name} วันที่ ${schedule.schedule_date} เวลา ${schedule.start_time}-${schedule.end_time} ณ ${schedule.location_name}`,
          type: 'info',
          related_table: 'schedules',
          related_id: schedule.schedule_id
        });
      }
      
      return { notificationsSent: result.rows.length };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ScheduleService;
