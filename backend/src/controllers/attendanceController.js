const { query, getClient } = require('../config/database');

const attendanceController = {
  // GET /api/attendance/schedule/:scheduleId - ดูการเข้าร่วมของตาราง
  async getBySchedule(req, res) {
    try {
      const { scheduleId } = req.params;
      
      const result = await query(
        `SELECT a.attendance_id, a.student_id, a.status, a.check_in_time, a.check_out_time, 
                a.score, a.notes, a.created_at, a.updated_at,
                st.student_code, st.first_name, st.last_name, st.email,
                g.group_name, sec.section_name
         FROM attendance a
         JOIN students st ON a.student_id = st.student_id
         LEFT JOIN groups g ON st.group_id = g.group_id
         LEFT JOIN sections sec ON st.section_id = sec.section_id
         WHERE a.schedule_id = $1
         ORDER BY st.student_code ASC`,
        [scheduleId]
      );
      
      // Get schedule information
      const scheduleResult = await query(
        `SELECT s.schedule_date, s.start_time, s.end_time, s.max_students,
                c.course_name, c.course_code, at.type_name,
                l.location_name, u.first_name || ' ' || u.last_name as instructor_name
         FROM schedules s
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users u ON inst.user_id = u.user_id
         WHERE s.schedule_id = $1`,
        [scheduleId]
      );
      
      if (scheduleResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลตารางที่ระบุ'
        });
      }
      
      // Calculate statistics
      const stats = {
        total_students: result.rows.length,
        present_count: result.rows.filter(r => r.status === 'present').length,
        absent_count: result.rows.filter(r => r.status === 'absent').length,
        late_count: result.rows.filter(r => r.status === 'late').length,
        excused_count: result.rows.filter(r => r.status === 'excused').length
      };
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลการเข้าร่วมสำเร็จ',
        data: {
          schedule: scheduleResult.rows[0],
          attendance: result.rows,
          statistics: stats
        }
      });
    } catch (error) {
      console.error('Error in getAttendanceBySchedule:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้าร่วม',
        error: error.message
      });
    }
  },

  // GET /api/attendance/student/:studentId - ดูประวัติการเข้าร่วมของนักศึกษา
  async getByStudent(req, res) {
    try {
      const { studentId } = req.params;
      const { startDate, endDate, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE a.student_id = $1';
      let params = [studentId];
      let paramCount = 1;
      
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
      
      const result = await query(
        `SELECT a.attendance_id, a.status, a.check_in_time, a.check_out_time, 
                a.score, a.notes, a.created_at,
                s.schedule_date, s.start_time, s.end_time,
                c.course_name, c.course_code, at.type_name,
                l.location_name, u.first_name || ' ' || u.last_name as instructor_name
         FROM attendance a
         JOIN schedules s ON a.schedule_id = s.schedule_id
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users u ON inst.user_id = u.user_id
         ${whereClause}
         ORDER BY s.schedule_date DESC, s.start_time DESC
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, offset]
      );
      
      // Get student statistics
      const statsResult = await query(
        `SELECT 
           COUNT(*) as total_sessions,
           COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
           COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
           COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
           COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
           ROUND(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 2) as average_score
         FROM attendance a
         JOIN schedules s ON a.schedule_id = s.schedule_id
         ${whereClause.replace('$' + (paramCount + 1), '').replace('$' + (paramCount + 2), '')}`,
        params.slice(0, paramCount)
      );
      
      const stats = statsResult.rows[0];
      const attendanceRate = stats.total_sessions > 0 ? 
        (stats.present_count / stats.total_sessions * 100).toFixed(2) : 0;
      
      res.json({
        success: true,
        message: 'ดึงประวัติการเข้าร่วมของนักศึกษาสำเร็จ',
        data: {
          attendance_history: result.rows,
          statistics: {
            ...stats,
            attendance_rate: parseFloat(attendanceRate)
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(stats.total_sessions)
          }
        }
      });
    } catch (error) {
      console.error('Error in getAttendanceByStudent:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงประวัติการเข้าร่วม',
        error: error.message
      });
    }
  },

  // POST /api/attendance/schedule/:scheduleId/initialize - สร้างรายการเช็คชื่อเริ่มต้น
  async initializeAttendance(req, res) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { scheduleId } = req.params;
      
      // ตรวจสอบว่าตารางมีอยู่หรือไม่
      const scheduleCheck = await client.query(
        'SELECT schedule_id FROM schedules WHERE schedule_id = $1',
        [scheduleId]
      );
      
      if (scheduleCheck.rows.length === 0) {
        throw new Error('ไม่พบข้อมูลตารางที่ระบุ');
      }
      
      // ตรวจสอบว่ามีการเช็คชื่อแล้วหรือไม่
      const existingAttendance = await client.query(
        'SELECT attendance_id FROM attendance WHERE schedule_id = $1',
        [scheduleId]
      );
      
      if (existingAttendance.rows.length > 0) {
        throw new Error('มีการสร้างรายการเช็คชื่อแล้ว');
      }
      
      // ดึงรายชื่อนักศึกษาที่ต้องเข้าร่วม
      const studentsResult = await client.query(
        `SELECT DISTINCT st.student_id
         FROM students st
         JOIN groups g ON st.group_id = g.group_id
         JOIN schedule_groups sg ON g.group_id = sg.group_id
         WHERE sg.schedule_id = $1 AND st.status = 'active'`,
        [scheduleId]
      );
      
      if (studentsResult.rows.length === 0) {
        throw new Error('ไม่พบนักศึกษาที่ต้องเข้าร่วมกิจกรรมนี้');
      }
      
      // สร้างรายการเช็คชื่อสำหรับนักศึกษาทุกคน
      const attendanceRecords = [];
      for (const student of studentsResult.rows) {
        const result = await client.query(
          `INSERT INTO attendance (schedule_id, student_id, status, created_at, updated_at)
           VALUES ($1, $2, 'absent', NOW(), NOW())
           RETURNING attendance_id`,
          [scheduleId, student.student_id]
        );
        attendanceRecords.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        message: 'สร้างรายการเช็คชื่อเริ่มต้นสำเร็จ',
        data: {
          total_students: attendanceRecords.length,
          attendance_records: attendanceRecords.length
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in initializeAttendance:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างรายการเช็คชื่อ',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // PUT /api/attendance/:attendanceId - อัปเดตการเข้าร่วม
  async updateAttendance(req, res) {
    try {
      const { attendanceId } = req.params;
      const { status, checkInTime, checkOutTime, score, notes } = req.body;
      
      // ตรวจสอบว่าข้อมูลการเข้าร่วมมีอยู่หรือไม่
      const checkResult = await query(
        'SELECT attendance_id FROM attendance WHERE attendance_id = $1',
        [attendanceId]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลการเข้าร่วมที่ต้องการแก้ไข'
        });
      }
      
      const result = await query(
        `UPDATE attendance 
         SET status = COALESCE($1, status),
             check_in_time = COALESCE($2, check_in_time),
             check_out_time = COALESCE($3, check_out_time),
             score = COALESCE($4, score),
             notes = COALESCE($5, notes),
             updated_at = NOW()
         WHERE attendance_id = $6
         RETURNING attendance_id, schedule_id, student_id, status, 
                   check_in_time, check_out_time, score, notes, updated_at`,
        [status, checkInTime, checkOutTime, score, notes, attendanceId]
      );
      
      res.json({
        success: true,
        message: 'อัปเดตการเข้าร่วมสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateAttendance:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการอัปเดตการเข้าร่วม',
        error: error.message
      });
    }
  },

  // POST /api/attendance/bulk-update - อัปเดตการเข้าร่วมหลายคน
  async bulkUpdateAttendance(req, res) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { attendanceUpdates } = req.body;
      
      if (!Array.isArray(attendanceUpdates) || attendanceUpdates.length === 0) {
        throw new Error('กรุณาระบุข้อมูลการอัปเดต');
      }
      
      const updatedRecords = [];
      
      for (const update of attendanceUpdates) {
        const { attendanceId, status, checkInTime, checkOutTime, score, notes } = update;
        
        const result = await client.query(
          `UPDATE attendance 
           SET status = COALESCE($1, status),
               check_in_time = COALESCE($2, check_in_time),
               check_out_time = COALESCE($3, check_out_time),
               score = COALESCE($4, score),
               notes = COALESCE($5, notes),
               updated_at = NOW()
           WHERE attendance_id = $6
           RETURNING attendance_id, student_id, status`,
          [status, checkInTime, checkOutTime, score, notes, attendanceId]
        );
        
        if (result.rows.length > 0) {
          updatedRecords.push(result.rows[0]);
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'อัปเดตการเข้าร่วมหลายคนสำเร็จ',
        data: {
          total_updated: updatedRecords.length,
          updated_records: updatedRecords
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in bulkUpdateAttendance:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตการเข้าร่วมหลายคน',
        error: error.message
      });
    } finally {
      client.release();
    }
  },

  // GET /api/attendance/reports/summary - รายงานสรุปการเข้าร่วม
  async getAttendanceSummary(req, res) {
    try {
      const { startDate, endDate, groupId, courseId } = req.query;
      
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
      
      if (groupId) {
        paramCount++;
        whereClause += ` AND sg.group_id = $${paramCount}`;
        params.push(groupId);
      }
      
      if (courseId) {
        paramCount++;
        whereClause += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      const result = await query(
        `SELECT 
           COUNT(DISTINCT s.schedule_id) as total_sessions,
           COUNT(a.attendance_id) as total_attendance_records,
           COUNT(CASE WHEN a.status = 'present' THEN 1 END) as total_present,
           COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as total_absent,
           COUNT(CASE WHEN a.status = 'late' THEN 1 END) as total_late,
           COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as total_excused,
           ROUND(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 2) as average_score
         FROM schedules s
         LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
         ${whereClause}`,
        params
      );
      
      const summary = result.rows[0];
      const attendanceRate = summary.total_attendance_records > 0 ? 
        (summary.total_present / summary.total_attendance_records * 100).toFixed(2) : 0;
      
      res.json({
        success: true,
        message: 'ดึงรายงานสรุปการเข้าร่วมสำเร็จ',
        data: {
          ...summary,
          attendance_rate: parseFloat(attendanceRate)
        }
      });
    } catch (error) {
      console.error('Error in getAttendanceSummary:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงรายงานสรุป',
        error: error.message
      });
    }
  },

  // GET /api/attendance/reports/student-performance - รายงานผลการเรียนของนักศึกษา
  async getStudentPerformanceReport(req, res) {
    try {
      const { startDate, endDate, groupId, courseId, page = 1, limit = 20 } = req.query;
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
      
      if (groupId) {
        paramCount++;
        whereClause += ` AND st.group_id = $${paramCount}`;
        params.push(groupId);
      }
      
      if (courseId) {
        paramCount++;
        whereClause += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      const result = await query(
        `SELECT 
           st.student_id, st.student_code, st.first_name, st.last_name,
           g.group_name, sec.section_name,
           COUNT(a.attendance_id) as total_sessions,
           COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
           COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
           COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
           COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
           ROUND(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 2) as average_score,
           ROUND((COUNT(CASE WHEN a.status = 'present' THEN 1 END)::DECIMAL / 
                  NULLIF(COUNT(a.attendance_id), 0) * 100), 2) as attendance_rate
         FROM students st
         LEFT JOIN groups g ON st.group_id = g.group_id
         LEFT JOIN sections sec ON st.section_id = sec.section_id
         LEFT JOIN attendance a ON st.student_id = a.student_id
         LEFT JOIN schedules s ON a.schedule_id = s.schedule_id
         ${whereClause}
         GROUP BY st.student_id, st.student_code, st.first_name, st.last_name, 
                  g.group_name, sec.section_name
         HAVING COUNT(a.attendance_id) > 0
         ORDER BY st.student_code ASC
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, offset]
      );
      
      res.json({
        success: true,
        message: 'ดึงรายงานผลการเรียนของนักศึกษาสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error in getStudentPerformanceReport:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงรายงานผลการเรียน',
        error: error.message
      });
    }
  }
};

module.exports = attendanceController;
