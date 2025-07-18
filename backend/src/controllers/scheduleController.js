const { query, getClient } = require('../config/database');
const { scheduleLogger } = require('../utils/logger');

const scheduleController = {
  // GET /api/schedules - ดูตารางทั้งหมด
  async getAll(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        startDate, 
        endDate, 
        instructorId, 
        courseId, 
        locationId,
        status = '',
        groupId 
      } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (startDate) {
        paramCount++;
        whereClause += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        whereClause += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (instructorId) {
        paramCount++;
        whereClause += ` AND s.instructor_id = $${paramCount}`;
        params.push(instructorId);
      }
      
      if (courseId) {
        paramCount++;
        whereClause += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      if (locationId) {
        paramCount++;
        whereClause += ` AND s.location_id = $${paramCount}`;
        params.push(locationId);
      }
      
      if (status) {
        paramCount++;
        whereClause += ` AND s.status = $${paramCount}`;
        params.push(status);
      }
      
      if (groupId) {
        paramCount++;
        whereClause += ` AND sg.group_id = $${paramCount}`;
        params.push(groupId);
      }
      
      const schedulesQuery = `
        SELECT s.schedule_id, s.schedule_date, s.start_time, s.end_time, s.max_students, s.notes, s.status,
               s.created_at, s.updated_at,
               c.course_name, c.course_code,
               at.type_name as activity_type,
               l.location_name, l.room_number, l.building,
               u.first_name || ' ' || u.last_name as instructor_name,
               string_agg(DISTINCT g.group_name, ', ') as groups,
               COUNT(DISTINCT a.student_id) as total_attendance
        FROM schedules s
        JOIN courses c ON s.course_id = c.course_id
        JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        JOIN locations l ON s.location_id = l.location_id
        JOIN instructors inst ON s.instructor_id = inst.instructor_id
        JOIN users u ON inst.user_id = u.user_id
        LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
        LEFT JOIN groups g ON sg.group_id = g.group_id
        LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
        ${whereClause}
        GROUP BY s.schedule_id, c.course_name, c.course_code, at.type_name, 
                 l.location_name, l.room_number, l.building, u.first_name, u.last_name
        ORDER BY s.schedule_date ASC, s.start_time ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(schedulesQuery, params);
      
      // Count total for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT s.schedule_id) 
        FROM schedules s
        LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลตารางสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllSchedules:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตาราง',
        error: error.message
      });
    }
  },

  // GET /api/schedules/:id - ดูข้อมูลตาราง
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT s.*, 
                c.course_name, c.course_code,
                at.type_name as activity_type,
                l.location_name, l.room_number, l.building,
                u.first_name || ' ' || u.last_name as instructor_name,
                inst.instructor_code
         FROM schedules s
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users u ON inst.user_id = u.user_id
         WHERE s.schedule_id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลตารางที่ต้องการ'
        });
      }
      
      // Get assigned groups
      const groupsResult = await query(
        `SELECT g.group_id, g.group_name, g.group_code, s.section_name, s.section_code
         FROM schedule_groups sg
         JOIN groups g ON sg.group_id = g.group_id
         JOIN sections s ON g.section_id = s.section_id
         WHERE sg.schedule_id = $1`,
        [id]
      );
      
      // Get attendance count
      const attendanceResult = await query(
        `SELECT 
           COUNT(*) as total_students,
           COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
           COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count
         FROM attendance 
         WHERE schedule_id = $1`,
        [id]
      );
      
      const schedule = result.rows[0];
      schedule.assigned_groups = groupsResult.rows;
      schedule.attendance_summary = attendanceResult.rows[0];
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลตารางสำเร็จ',
        data: schedule
      });
    } catch (error) {
      console.error('Error in getScheduleById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตาราง',
        error: error.message
      });
    }
  },

  // POST /api/schedules - สร้างตารางใหม่
  async create(req, res) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { 
        courseId, 
        activityTypeId, 
        instructorId, 
        locationId, 
        scheduleDate, 
        startTime, 
        endTime, 
        maxStudents, 
        notes,
        groupIds 
      } = req.body;
      
      // ตรวจสอบความขัดแย้งในการจองห้อง
      const locationConflict = await this.checkLocationConflict(
        client, locationId, scheduleDate, startTime, endTime
      );
      
      if (locationConflict) {
        throw new Error('สถานที่ถูกจองแล้วในช่วงเวลานี้');
      }
      
      // ตรวจสอบความขัดแย้งของอาจารย์
      const instructorConflict = await this.checkInstructorConflict(
        client, instructorId, scheduleDate, startTime, endTime
      );
      
      if (instructorConflict) {
        throw new Error('อาจารย์มีตารางสอนในช่วงเวลานี้แล้ว');
      }
      
      // สร้างตาราง
      const scheduleResult = await client.query(
        `INSERT INTO schedules (course_id, activity_type_id, instructor_id, location_id, 
                               schedule_date, start_time, end_time, max_students, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING schedule_id, course_id, activity_type_id, instructor_id, location_id, 
                   schedule_date, start_time, end_time, max_students, notes, status, created_at`,
        [courseId, activityTypeId, instructorId, locationId, scheduleDate, 
         startTime, endTime, maxStudents, notes]
      );
      
      const newSchedule = scheduleResult.rows[0];
      
      // กำหนดกลุ่มที่เข้าร่วม
      if (groupIds && groupIds.length > 0) {
        for (const groupId of groupIds) {
          await client.query(
            'INSERT INTO schedule_groups (schedule_id, group_id) VALUES ($1, $2)',
            [newSchedule.schedule_id, groupId]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Log การสร้างตาราง
      scheduleLogger.scheduleCreated(newSchedule.schedule_id, req.user.userId, {
        course_id: courseId,
        schedule_date: scheduleDate,
        start_time: startTime,
        end_time: endTime
      });
      
      res.status(201).json({
        success: true,
        message: 'สร้างตารางใหม่สำเร็จ',
        data: newSchedule
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in createSchedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างตารางใหม่',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // PUT /api/schedules/:id - แก้ไขตาราง
  async update(req, res) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { id } = req.params;
      const { 
        activityTypeId, 
        instructorId, 
        locationId, 
        scheduleDate, 
        startTime, 
        endTime, 
        maxStudents, 
        notes,
        status,
        groupIds 
      } = req.body;
      
      // ตรวจสอบว่าตารางมีอยู่หรือไม่
      const checkResult = await client.query(
        'SELECT schedule_id FROM schedules WHERE schedule_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('ไม่พบข้อมูลตารางที่ต้องการแก้ไข');
      }
      
      // ตรวจสอบความขัดแย้งหากมีการเปลี่ยนสถานที่หรือเวลา
      if (locationId || scheduleDate || startTime || endTime) {
        const locationConflict = await this.checkLocationConflict(
          client, locationId, scheduleDate, startTime, endTime, id
        );
        
        if (locationConflict) {
          throw new Error('สถานที่ถูกจองแล้วในช่วงเวลานี้');
        }
      }
      
      // ตรวจสอบความขัดแย้งของอาจารย์
      if (instructorId || scheduleDate || startTime || endTime) {
        const instructorConflict = await this.checkInstructorConflict(
          client, instructorId, scheduleDate, startTime, endTime, id
        );
        
        if (instructorConflict) {
          throw new Error('อาจารย์มีตารางสอนในช่วงเวลานี้แล้ว');
        }
      }
      
      // อัปเดตตาราง
      const result = await client.query(
        `UPDATE schedules 
         SET activity_type_id = COALESCE($1, activity_type_id),
             instructor_id = COALESCE($2, instructor_id),
             location_id = COALESCE($3, location_id),
             schedule_date = COALESCE($4, schedule_date),
             start_time = COALESCE($5, start_time),
             end_time = COALESCE($6, end_time),
             max_students = COALESCE($7, max_students),
             notes = COALESCE($8, notes),
             status = COALESCE($9, status),
             updated_at = NOW()
         WHERE schedule_id = $10
         RETURNING schedule_id, course_id, activity_type_id, instructor_id, location_id, 
                   schedule_date, start_time, end_time, max_students, notes, status, updated_at`,
        [activityTypeId, instructorId, locationId, scheduleDate, startTime, 
         endTime, maxStudents, notes, status, id]
      );
      
      // อัปเดตกลุ่มที่เข้าร่วม
      if (groupIds !== undefined) {
        // ลบกลุ่มเดิม
        await client.query('DELETE FROM schedule_groups WHERE schedule_id = $1', [id]);
        
        // เพิ่มกลุ่มใหม่
        if (groupIds.length > 0) {
          for (const groupId of groupIds) {
            await client.query(
              'INSERT INTO schedule_groups (schedule_id, group_id) VALUES ($1, $2)',
              [id, groupId]
            );
          }
        }
      }
      
      await client.query('COMMIT');
      
      // Log การแก้ไขตาราง
      scheduleLogger.scheduleUpdated(id, req.user.userId, req.body);
      
      res.json({
        success: true,
        message: 'แก้ไขตารางสำเร็จ',
        data: result.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in updateSchedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการแก้ไขตาราง',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // DELETE /api/schedules/:id - ลบตาราง
  async delete(req, res) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { id } = req.params;
      
      // ตรวจสอบว่าตารางมีอยู่หรือไม่
      const checkResult = await client.query(
        'SELECT schedule_id, schedule_date FROM schedules WHERE schedule_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('ไม่พบข้อมูลตารางที่ต้องการลบ');
      }
      
      // ตรวจสอบว่ามีการเข้าร่วมแล้วหรือไม่
      const attendanceCheck = await client.query(
        'SELECT attendance_id FROM attendance WHERE schedule_id = $1',
        [id]
      );
      
      if (attendanceCheck.rows.length > 0) {
        throw new Error('ไม่สามารถลบตารางได้ เนื่องจากมีข้อมูลการเข้าร่วมแล้ว');
      }
      
      // ลบกลุ่มที่เข้าร่วม
      await client.query('DELETE FROM schedule_groups WHERE schedule_id = $1', [id]);
      
      // ลบตาราง
      await client.query('DELETE FROM schedules WHERE schedule_id = $1', [id]);
      
      await client.query('COMMIT');
      
      // Log การลบตาราง
      scheduleLogger.scheduleDeleted(id, req.user.userId);
      
      res.json({
        success: true,
        message: 'ลบตารางสำเร็จ'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in deleteSchedule:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการลบตาราง',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // GET /api/schedules/conflicts - ตรวจสอบความขัดแย้งในตาราง
  async checkConflicts(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      let dateFilter = '';
      let params = [];
      
      if (startDate && endDate) {
        dateFilter = 'WHERE s1.schedule_date BETWEEN $1 AND $2';
        params = [startDate, endDate];
      }
      
      // ตรวจสอบความขัดแย้งของสถานที่
      const locationConflicts = await query(
        `SELECT s1.schedule_id as schedule1_id, s2.schedule_id as schedule2_id,
                s1.schedule_date, s1.start_time, s1.end_time,
                l.location_name, l.room_number, l.building,
                'location' as conflict_type
         FROM schedules s1
         JOIN schedules s2 ON s1.location_id = s2.location_id 
                           AND s1.schedule_date = s2.schedule_date
                           AND s1.schedule_id < s2.schedule_id
                           AND ((s1.start_time <= s2.start_time AND s1.end_time > s2.start_time)
                             OR (s1.start_time < s2.end_time AND s1.end_time >= s2.end_time)
                             OR (s1.start_time >= s2.start_time AND s1.end_time <= s2.end_time))
         JOIN locations l ON s1.location_id = l.location_id
         ${dateFilter}
         AND s1.status != 'cancelled' AND s2.status != 'cancelled'`,
        params
      );
      
      // ตรวจสอบความขัดแย้งของอาจารย์
      const instructorConflicts = await query(
        `SELECT s1.schedule_id as schedule1_id, s2.schedule_id as schedule2_id,
                s1.schedule_date, s1.start_time, s1.end_time,
                u.first_name || ' ' || u.last_name as instructor_name,
                'instructor' as conflict_type
         FROM schedules s1
         JOIN schedules s2 ON s1.instructor_id = s2.instructor_id 
                           AND s1.schedule_date = s2.schedule_date
                           AND s1.schedule_id < s2.schedule_id
                           AND ((s1.start_time <= s2.start_time AND s1.end_time > s2.start_time)
                             OR (s1.start_time < s2.end_time AND s1.end_time >= s2.end_time)
                             OR (s1.start_time >= s2.start_time AND s1.end_time <= s2.end_time))
         JOIN instructors inst ON s1.instructor_id = inst.instructor_id
         JOIN users u ON inst.user_id = u.user_id
         ${dateFilter}
         AND s1.status != 'cancelled' AND s2.status != 'cancelled'`,
        params
      );
      
      const allConflicts = [...locationConflicts.rows, ...instructorConflicts.rows];
      
      res.json({
        success: true,
        message: 'ตรวจสอบความขัดแย้งในตารางสำเร็จ',
        data: {
          total_conflicts: allConflicts.length,
          location_conflicts: locationConflicts.rows.length,
          instructor_conflicts: instructorConflicts.rows.length,
          conflicts: allConflicts
        }
      });
    } catch (error) {
      console.error('Error in checkConflicts:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการตรวจสอบความขัดแย้ง',
        error: error.message
      });
    }
  },

  // Helper methods
  async checkLocationConflict(client, locationId, scheduleDate, startTime, endTime, excludeScheduleId = null) {
    try {
      let whereClause = `WHERE location_id = $1 AND schedule_date = $2 
                        AND ((start_time <= $3 AND end_time > $3) 
                         OR (start_time < $4 AND end_time >= $4)
                         OR (start_time >= $3 AND end_time <= $4))
                        AND status != 'cancelled'`;
      let params = [locationId, scheduleDate, startTime, endTime];
      
      if (excludeScheduleId) {
        whereClause += ` AND schedule_id != $5`;
        params.push(excludeScheduleId);
      }
      
      const result = await client.query(
        `SELECT schedule_id FROM schedules ${whereClause}`,
        params
      );
      
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  },

  async checkInstructorConflict(client, instructorId, scheduleDate, startTime, endTime, excludeScheduleId = null) {
    try {
      let whereClause = `WHERE instructor_id = $1 AND schedule_date = $2 
                        AND ((start_time <= $3 AND end_time > $3) 
                         OR (start_time < $4 AND end_time >= $4)
                         OR (start_time >= $3 AND end_time <= $4))
                        AND status != 'cancelled'`;
      let params = [instructorId, scheduleDate, startTime, endTime];
      
      if (excludeScheduleId) {
        whereClause += ` AND schedule_id != $5`;
        params.push(excludeScheduleId);
      }
      
      const result = await client.query(
        `SELECT schedule_id FROM schedules ${whereClause}`,
        params
      );
      
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = scheduleController;
