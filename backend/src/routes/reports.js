// routes/reports.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireRole } = require('../middleware/auth');

// All report routes require admin role
router.use(requireRole(['admin']));

// GET /api/reports/attendance - รายงานการเข้าร่วม
router.get('/attendance', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      courseId, 
      instructorId, 
      sectionId,
      format = 'json' 
    } = req.query;
    
    let query = `
      SELECT 
        s.schedule_date,
        c.course_name,
        c.course_code,
        CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
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
      LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
      LEFT JOIN users u ON inst.user_id = u.user_id
      LEFT JOIN locations l ON s.location_id = l.location_id
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
    
    query += `
      GROUP BY s.schedule_date, c.course_name, c.course_code, 
               instructor_name, l.location_name
      ORDER BY s.schedule_date DESC
    `;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      message: 'ดึงรายงานการเข้าร่วมสำเร็จ',
      data: result.rows,
      summary: {
        totalRecords: result.rows.length,
        generatedAt: new Date().toISOString(),
        filters: { startDate, endDate, courseId, instructorId, sectionId }
      }
    });
  } catch (error) {
    console.error('Error in attendance report:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรายงานการเข้าร่วม',
      error: error.message
    });
  }
});

// GET /api/reports/instructor-workload - รายงานภาระงานอาจารย์
router.get('/instructor-workload', async (req, res) => {
  try {
    const { startDate, endDate, instructorId } = req.query;
    
    let query = `
      SELECT 
        inst.instructor_id,
        inst.instructor_code,
        CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
        u.email,
        COUNT(s.schedule_id) as total_sessions,
        SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600) as total_hours,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_sessions,
        COALESCE(SUM(s.current_students), 0) as total_students_taught,
        ROUND(AVG(s.current_students), 2) as avg_students_per_session
      FROM instructors inst
      JOIN users u ON inst.user_id = u.user_id
      LEFT JOIN schedules s ON inst.instructor_id = s.instructor_id
    `;
    
    let params = [];
    let paramCount = 0;
    
    if (startDate && endDate) {
      paramCount += 2;
      query += ` AND s.schedule_date BETWEEN $${paramCount-1} AND $${paramCount}`;
      params.push(startDate, endDate);
    }
    
    if (instructorId) {
      paramCount++;
      query += ` AND inst.instructor_id = $${paramCount}`;
      params.push(instructorId);
    }
    
    query += `
      WHERE inst.status = 'active'
      GROUP BY inst.instructor_id, inst.instructor_code, 
               instructor_name, u.email
      ORDER BY total_hours DESC
    `;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      message: 'ดึงรายงานภาระงานอาจารย์สำเร็จ',
      data: result.rows,
      summary: {
        totalInstructors: result.rows.length,
        generatedAt: new Date().toISOString(),
        filters: { startDate, endDate, instructorId }
      }
    });
  } catch (error) {
    console.error('Error in instructor workload report:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรายงานภาระงานอาจารย์',
      error: error.message
    });
  }
});

// GET /api/reports/location-usage - รายงานการใช้สถานที่
router.get('/location-usage', async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    
    let query = `
      SELECT 
        l.location_id,
        l.location_name,
        l.location_code,
        l.location_type,
        l.capacity,
        COUNT(s.schedule_id) as total_sessions,
        SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600) as total_hours,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
        COALESCE(AVG(s.current_students), 0) as avg_students_per_session,
        ROUND(AVG(s.current_students::decimal / NULLIF(l.capacity, 0)) * 100, 2) as utilization_rate
      FROM locations l
      LEFT JOIN schedules s ON l.location_id = s.location_id
    `;
    
    let params = [];
    let paramCount = 0;
    
    if (startDate && endDate) {
      paramCount += 2;
      query += ` AND s.schedule_date BETWEEN $${paramCount-1} AND $${paramCount}`;
      params.push(startDate, endDate);
    }
    
    if (locationId) {
      paramCount++;
      query += ` AND l.location_id = $${paramCount}`;
      params.push(locationId);
    }
    
    query += `
      WHERE l.status = 'active'
      GROUP BY l.location_id, l.location_name, l.location_code, 
               l.location_type, l.capacity
      ORDER BY total_hours DESC
    `;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      message: 'ดึงรายงานการใช้สถานที่สำเร็จ',
      data: result.rows,
      summary: {
        totalLocations: result.rows.length,
        generatedAt: new Date().toISOString(),
        filters: { startDate, endDate, locationId }
      }
    });
  } catch (error) {
    console.error('Error in location usage report:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรายงานการใช้สถานที่',
      error: error.message
    });
  }
});

// GET /api/reports/student-progress - รายงานความก้าวหน้านักศึกษา
router.get('/student-progress', async (req, res) => {
  try {
    const { startDate, endDate, sectionId, groupId } = req.query;
    
    let query = `
      SELECT 
        st.student_id,
        st.student_code,
        st.first_name,
        st.last_name,
        sec.section_name,
        g.group_name,
        COUNT(a.attendance_id) as total_sessions,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        ROUND(
          COUNT(CASE WHEN a.status = 'present' THEN 1 END)::decimal / 
          NULLIF(COUNT(a.attendance_id), 0) * 100, 2
        ) as attendance_rate,
        COALESCE(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 0) as average_score,
        COUNT(CASE WHEN a.score IS NOT NULL THEN 1 END) as evaluated_sessions
      FROM students st
      LEFT JOIN sections sec ON st.section_id = sec.section_id
      LEFT JOIN groups g ON st.group_id = g.group_id
      LEFT JOIN attendance a ON st.student_id = a.student_id
      LEFT JOIN schedules s ON a.schedule_id = s.schedule_id
      WHERE st.status = 'active'
    `;
    
    let params = [];
    let paramCount = 0;
    
    if (startDate && endDate) {
      paramCount += 2;
      query += ` AND s.schedule_date BETWEEN $${paramCount-1} AND $${paramCount}`;
      params.push(startDate, endDate);
    }
    
    if (sectionId) {
      paramCount++;
      query += ` AND st.section_id = $${paramCount}`;
      params.push(sectionId);
    }
    
    if (groupId) {
      paramCount++;
      query += ` AND st.group_id = $${paramCount}`;
      params.push(groupId);
    }
    
    query += `
      GROUP BY st.student_id, st.student_code, st.first_name, 
               st.last_name, sec.section_name, g.group_name
      ORDER BY st.first_name, st.last_name
    `;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      message: 'ดึงรายงานความก้าวหน้านักศึกษาสำเร็จ',
      data: result.rows,
      summary: {
        totalStudents: result.rows.length,
        generatedAt: new Date().toISOString(),
        filters: { startDate, endDate, sectionId, groupId }
      }
    });
  } catch (error) {
    console.error('Error in student progress report:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรายงานความก้าวหน้านักศึกษา',
      error: error.message
    });
  }
});

// POST /api/reports/custom - สร้างรายงานแบบกำหนดเอง
router.post('/custom', async (req, res) => {
  try {
    const { 
      reportType, 
      filters, 
      groupBy, 
      sortBy, 
      columns 
    } = req.body;
    
    // This is a placeholder for future custom report functionality
    // In a real implementation, you would build dynamic queries based on the parameters
    
    res.json({
      success: true,
      message: 'ฟังก์ชันรายงานแบบกำหนดเองจะพัฒนาในอนาคต',
      data: {
        reportType,
        filters,
        groupBy,
        sortBy,
        columns,
        message: 'Custom report functionality coming soon'
      }
    });
  } catch (error) {
    console.error('Error in custom report:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรายงานแบบกำหนดเอง',
      error: error.message
    });
  }
});

// GET /api/reports/dashboard-stats - สถิติสำหรับ Dashboard
router.get('/dashboard-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // คำนวณสถิติพื้นฐาน
    const stats = await Promise.all([
      // จำนวนนักศึกษาทั้งหมด
      pool.query('SELECT COUNT(*) as total_students FROM students WHERE status = $1', ['active']),
      
      // จำนวนอาจารย์ทั้งหมด
      pool.query('SELECT COUNT(*) as total_instructors FROM instructors WHERE status = $1', ['active']),
      
      // จำนวนตารางในช่วงเวลาที่กำหนด
      pool.query(`
        SELECT COUNT(*) as total_schedules 
        FROM schedules 
        WHERE schedule_date BETWEEN $1 AND $2
      `, [startDate || '1900-01-01', endDate || '2100-01-01']),
      
      // อัตราการเข้าร่วมโดยรวม
      pool.query(`
        SELECT 
          COUNT(a.attendance_id) as total_attendances,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          ROUND(
            COUNT(CASE WHEN a.status = 'present' THEN 1 END)::decimal / 
            NULLIF(COUNT(a.attendance_id), 0) * 100, 2
          ) as attendance_rate
        FROM attendance a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE s.schedule_date BETWEEN $1 AND $2
      `, [startDate || '1900-01-01', endDate || '2100-01-01'])
    ]);
    
    const dashboardStats = {
      totalStudents: parseInt(stats[0].rows[0].total_students),
      totalInstructors: parseInt(stats[1].rows[0].total_instructors),
      totalSchedules: parseInt(stats[2].rows[0].total_schedules),
      attendanceRate: parseFloat(stats[3].rows[0].attendance_rate) || 0,
      totalAttendances: parseInt(stats[3].rows[0].total_attendances) || 0,
      presentCount: parseInt(stats[3].rows[0].present_count) || 0,
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'ดึงสถิติ Dashboard สำเร็จ',
      data: dashboardStats
    });
  } catch (error) {
    console.error('Error in dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงสถิติ Dashboard',
      error: error.message
    });
  }
});

module.exports = router;
