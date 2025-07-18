// services/attendanceService.js
const pool = require('../config/database');
const notificationService = require('./notificationService');

class AttendanceService {
  // บันทึกการเข้าร่วมของนักศึกษาคนเดียว
  static async recordAttendance(attendanceData, recordedBy) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const {
        schedule_id,
        student_id,
        status = 'present',
        check_in_time = null,
        check_out_time = null,
        notes = '',
        score = null,
        evaluation_notes = ''
      } = attendanceData;
      
      // ตรวจสอบว่ามีการบันทึกไว้แล้วหรือไม่
      const existingRecord = await client.query(
        'SELECT * FROM attendance WHERE schedule_id = $1 AND student_id = $2',
        [schedule_id, student_id]
      );
      
      let result;
      
      if (existingRecord.rows.length > 0) {
        // อัพเดทข้อมูลเดิม
        result = await client.query(`
          UPDATE attendance SET
            status = $3,
            check_in_time = $4,
            check_out_time = $5,
            notes = $6,
            score = $7,
            evaluation_notes = $8,
            recorded_by = $9,
            updated_at = NOW()
          WHERE schedule_id = $1 AND student_id = $2
          RETURNING *
        `, [
          schedule_id, student_id, status, check_in_time, check_out_time,
          notes, score, evaluation_notes, recordedBy
        ]);
      } else {
        // สร้างข้อมูลใหม่
        result = await client.query(`
          INSERT INTO attendance (
            schedule_id, student_id, status, check_in_time, check_out_time,
            notes, score, evaluation_notes, recorded_by, recorded_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING *
        `, [
          schedule_id, student_id, status, check_in_time, check_out_time,
          notes, score, evaluation_notes, recordedBy
        ]);
      }
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // บันทึกการเข้าร่วมหลายคน (Bulk)
  static async recordBulkAttendance(scheduleId, attendanceList, recordedBy) {
    const client = await pool.connect();
    const results = {
      success: [],
      errors: []
    };
    
    try {
      await client.query('BEGIN');
      
      for (let i = 0; i < attendanceList.length; i++) {
        try {
          const attendanceData = {
            schedule_id: scheduleId,
            ...attendanceList[i]
          };
          
          const attendance = await this.recordAttendance(attendanceData, recordedBy);
          results.success.push(attendance);
          
        } catch (error) {
          results.errors.push({
            index: i,
            data: attendanceList[i],
            error: error.message
          });
        }
      }
      
      await client.query('COMMIT');
      
      // ส่งการแจ้งเตือนถ้ามีการบันทึกสำเร็จ
      if (results.success.length > 0) {
        const studentIds = results.success.map(a => a.student_id);
        await notificationService.notifyAttendanceUpdate(
          scheduleId, 
          studentIds, 
          'marked',
          { customMessage: `บันทึกการเข้าร่วมสำเร็จ ${results.success.length} คน` }
        );
      }
      
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // ดึงรายการเข้าร่วมตามตาราง
  static async getAttendanceBySchedule(scheduleId, options = {}) {
    try {
      const { include_student_details = true } = options;
      
      let query = `
        SELECT 
          a.attendance_id,
          a.schedule_id,
          a.student_id,
          a.status,
          a.check_in_time,
          a.check_out_time,
          a.notes,
          a.score,
          a.evaluation_notes,
          a.recorded_at,
          a.updated_at
      `;
      
      if (include_student_details) {
        query += `,
          s.student_code,
          s.first_name,
          s.last_name,
          s.email,
          g.group_name,
          sec.section_name
        `;
      }
      
      query += `
        FROM attendance a
      `;
      
      if (include_student_details) {
        query += `
          LEFT JOIN students s ON a.student_id = s.student_id
          LEFT JOIN groups g ON s.group_id = g.group_id
          LEFT JOIN sections sec ON s.section_id = sec.section_id
        `;
      }
      
      query += `
        WHERE a.schedule_id = $1
        ORDER BY 
      `;
      
      if (include_student_details) {
        query += `s.first_name, s.last_name`;
      } else {
        query += `a.student_id`;
      }
      
      const result = await pool.query(query, [scheduleId]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงประวัติการเข้าร่วมของนักศึกษา
  static async getStudentAttendanceHistory(studentId, options = {}) {
    try {
      const { 
        startDate = null, 
        endDate = null, 
        courseId = null,
        status = null 
      } = options;
      
      let query = `
        SELECT 
          a.attendance_id,
          a.schedule_id,
          a.status,
          a.check_in_time,
          a.check_out_time,
          a.notes,
          a.score,
          a.evaluation_notes,
          a.recorded_at,
          s.schedule_date,
          s.start_time,
          s.end_time,
          c.course_name,
          c.course_code,
          at.type_name as activity_type,
          l.location_name,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name
        FROM attendance a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
        LEFT JOIN users u ON inst.user_id = u.user_id
        WHERE a.student_id = $1
      `;
      
      let params = [studentId];
      let paramCount = 1;
      
      if (startDate) {
        paramCount++;
        query += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        query += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (courseId) {
        paramCount++;
        query += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      if (status) {
        paramCount++;
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
      }
      
      query += ` ORDER BY s.schedule_date DESC, s.start_time DESC`;
      
      const result = await pool.query(query, params);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // คำนวณสถิติการเข้าร่วมของนักศึกษา
  static async getStudentAttendanceStats(studentId, options = {}) {
    try {
      const { 
        startDate = null, 
        endDate = null, 
        courseId = null 
      } = options;
      
      let query = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
          COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
          ROUND(
            COUNT(CASE WHEN a.status = 'present' THEN 1 END)::decimal / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as attendance_rate,
          COALESCE(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 0) as average_score,
          COUNT(CASE WHEN a.score IS NOT NULL THEN 1 END) as evaluated_sessions
        FROM attendance a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE a.student_id = $1
      `;
      
      let params = [studentId];
      let paramCount = 1;
      
      if (startDate) {
        paramCount++;
        query += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        query += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (courseId) {
        paramCount++;
        query += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      const result = await pool.query(query, params);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างรายชื่อการเข้าร่วมจากกลุ่มที่จับคู่กับตาราง
  static async generateAttendanceList(scheduleId) {
    try {
      // ดึงรายชื่อนักศึกษาจากกลุ่มที่จับคู่กับตาราง
      const students = await pool.query(`
        SELECT DISTINCT
          s.student_id,
          s.student_code,
          s.first_name,
          s.last_name,
          s.email,
          g.group_name,
          sec.section_name
        FROM students s
        JOIN groups g ON s.group_id = g.group_id
        JOIN schedule_groups sg ON g.group_id = sg.group_id
        JOIN sections sec ON s.section_id = sec.section_id
        WHERE sg.schedule_id = $1
        AND sg.status = 'active'
        AND s.status = 'active'
        ORDER BY s.first_name, s.last_name
      `, [scheduleId]);
      
      // ตรวจสอบว่ามีการบันทึกการเข้าร่วมไว้แล้วหรือไม่
      const existingAttendance = await pool.query(
        'SELECT student_id, status FROM attendance WHERE schedule_id = $1',
        [scheduleId]
      );
      
      const attendanceMap = {};
      existingAttendance.rows.forEach(row => {
        attendanceMap[row.student_id] = row.status;
      });
      
      // รวมข้อมูล
      const attendanceList = students.rows.map(student => ({
        student_id: student.student_id,
        student_code: student.student_code,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        group_name: student.group_name,
        section_name: student.section_name,
        status: attendanceMap[student.student_id] || null,
        has_attendance: !!attendanceMap[student.student_id]
      }));
      
      return attendanceList;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงรายงานการเข้าร่วมสำหรับอาจารย์
  static async getInstructorAttendanceReport(instructorId, options = {}) {
    try {
      const { 
        startDate = null, 
        endDate = null, 
        courseId = null,
        groupBy = 'schedule' // 'schedule', 'student', 'course'
      } = options;
      
      let query, params = [instructorId];
      let paramCount = 1;
      
      if (groupBy === 'schedule') {
        query = `
          SELECT 
            s.schedule_id,
            s.schedule_date,
            s.start_time,
            s.end_time,
            c.course_name,
            c.course_code,
            l.location_name,
            COUNT(a.attendance_id) as total_students,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
            ROUND(
              COUNT(CASE WHEN a.status = 'present' THEN 1 END)::decimal / 
              NULLIF(COUNT(a.attendance_id), 0) * 100, 2
            ) as attendance_rate
          FROM schedules s
          LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
          LEFT JOIN courses c ON s.course_id = c.course_id
          LEFT JOIN locations l ON s.location_id = l.location_id
          WHERE s.instructor_id = $1
        `;
      } else if (groupBy === 'student') {
        query = `
          SELECT 
            st.student_id,
            st.student_code,
            st.first_name,
            st.last_name,
            COUNT(a.attendance_id) as total_sessions,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
            ROUND(
              COUNT(CASE WHEN a.status = 'present' THEN 1 END)::decimal / 
              NULLIF(COUNT(a.attendance_id), 0) * 100, 2
            ) as attendance_rate,
            COALESCE(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 0) as average_score
          FROM schedules s
          JOIN attendance a ON s.schedule_id = a.schedule_id
          JOIN students st ON a.student_id = st.student_id
          WHERE s.instructor_id = $1
        `;
      } else { // course
        query = `
          SELECT 
            c.course_id,
            c.course_name,
            c.course_code,
            COUNT(DISTINCT s.schedule_id) as total_sessions,
            COUNT(a.attendance_id) as total_attendances,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
            ROUND(
              COUNT(CASE WHEN a.status = 'present' THEN 1 END)::decimal / 
              NULLIF(COUNT(a.attendance_id), 0) * 100, 2
            ) as attendance_rate
          FROM schedules s
          LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
          LEFT JOIN courses c ON s.course_id = c.course_id
          WHERE s.instructor_id = $1
        `;
      }
      
      if (startDate) {
        paramCount++;
        query += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        query += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (courseId) {
        paramCount++;
        query += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      if (groupBy === 'schedule') {
        query += ` GROUP BY s.schedule_id, s.schedule_date, s.start_time, s.end_time, c.course_name, c.course_code, l.location_name ORDER BY s.schedule_date DESC`;
      } else if (groupBy === 'student') {
        query += ` GROUP BY st.student_id, st.student_code, st.first_name, st.last_name ORDER BY st.first_name, st.last_name`;
      } else {
        query += ` GROUP BY c.course_id, c.course_name, c.course_code ORDER BY c.course_name`;
      }
      
      const result = await pool.query(query, params);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงสถิติการเข้าร่วมภาพรวม
  static async getOverallAttendanceStats(options = {}) {
    try {
      const { 
        startDate = null, 
        endDate = null, 
        courseId = null,
        instructorId = null,
        sectionId = null
      } = options;
      
      let query = `
        SELECT 
          COUNT(DISTINCT s.schedule_id) as total_sessions,
          COUNT(a.attendance_id) as total_attendances,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
          COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
          ROUND(
            COUNT(CASE WHEN a.status = 'present' THEN 1 END)::decimal / 
            NULLIF(COUNT(a.attendance_id), 0) * 100, 2
          ) as overall_attendance_rate,
          COUNT(DISTINCT a.student_id) as unique_students,
          COUNT(DISTINCT s.instructor_id) as unique_instructors,
          COALESCE(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 0) as average_score
        FROM schedules s
        LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
        LEFT JOIN students st ON a.student_id = st.student_id
        WHERE 1=1
      `;
      
      let params = [];
      let paramCount = 0;
      
      if (startDate) {
        paramCount++;
        query += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        query += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (courseId) {
        paramCount++;
        query += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      if (instructorId) {
        paramCount++;
        query += ` AND s.instructor_id = $${paramCount}`;
        params.push(instructorId);
      }
      
      if (sectionId) {
        paramCount++;
        query += ` AND st.section_id = $${paramCount}`;
        params.push(sectionId);
      }
      
      const result = await pool.query(query, params);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // ส่งการแจ้งเตือนนักศึกษาขาดเรียน
  static async notifyAbsentStudents(scheduleId) {
    try {
      const absentStudents = await pool.query(`
        SELECT 
          a.student_id,
          s.schedule_date,
          c.course_name,
          st.first_name,
          st.last_name,
          inst.user_id as instructor_user_id
        FROM attendance a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        JOIN courses c ON s.course_id = c.course_id
        JOIN students st ON a.student_id = st.student_id
        JOIN instructors inst ON s.instructor_id = inst.instructor_id
        WHERE a.schedule_id = $1
        AND a.status = 'absent'
      `, [scheduleId]);
      
      if (absentStudents.rows.length > 0) {
        const studentIds = absentStudents.rows.map(s => s.student_id);
        
        await notificationService.notifyAttendanceUpdate(
          scheduleId,
          studentIds,
          'absent_warning',
          { 
            customMessage: `มีนักศึกษาขาดเรียน ${absentStudents.rows[0].course_name} วันที่ ${absentStudents.rows[0].schedule_date} จำนวน ${absentStudents.rows.length} คน` 
          }
        );
      }
      
      return { 
        success: true, 
        absentCount: absentStudents.rows.length 
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AttendanceService;
