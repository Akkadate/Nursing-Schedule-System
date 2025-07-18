// routes/activityTypes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireRole } = require('../middleware/auth');

// GET /api/activity-types - ดูประเภทกิจกรรมทั้งหมด
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        activity_type_id,
        type_name,
        type_code,
        description,
        default_duration_hours,
        color_code,
        status,
        created_at,
        updated_at
      FROM activity_types
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND (type_name ILIKE $${paramCount} OR type_code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    query += ` ORDER BY type_name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Count total
    let countQuery = 'SELECT COUNT(*) FROM activity_types WHERE 1=1';
    let countParams = [];
    let countParamCount = 0;
    
    if (search) {
      countParamCount++;
      countQuery += ` AND (type_name ILIKE $${countParamCount} OR type_code ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }
    
    if (status) {
      countParamCount++;
      countQuery += ` AND status = $${countParamCount}`;
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      message: 'ดึงข้อมูลประเภทกิจกรรมสำเร็จ',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getActivityTypes:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทกิจกรรม',
      error: error.message
    });
  }
});

// GET /api/activity-types/active - ดูประเภทกิจกรรมที่ active (สำหรับ dropdown)
router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        activity_type_id,
        type_name,
        type_code,
        description,
        default_duration_hours,
        color_code
      FROM activity_types
      WHERE status = 'active'
      ORDER BY type_name ASC
    `);
    
    res.json({
      success: true,
      message: 'ดึงข้อมูลประเภทกิจกรรมที่ใช้งานได้สำเร็จ',
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getActiveActivityTypes:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทกิจกรรม',
      error: error.message
    });
  }
});

// GET /api/activity-types/:id - ดูประเภทกิจกรรมรายการเดียว
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM activity_types WHERE activity_type_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบประเภทกิจกรรมที่ต้องการ'
      });
    }
    
    res.json({
      success: true,
      message: 'ดึงข้อมูลประเภทกิจกรรมสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getActivityTypeById:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทกิจกรรม',
      error: error.message
    });
  }
});

// POST /api/activity-types - สร้างประเภทกิจกรรมใหม่ (Admin only)
router.post('/', requireRole(['admin']), async (req, res) => {
  try {
    const {
      type_name,
      type_code,
      description,
      default_duration_hours = 0,
      color_code = '#4285F4'
    } = req.body;
    
    // Validation
    if (!type_name || !type_code) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อและรหัสประเภทกิจกรรม'
      });
    }
    
    // ตรวจสอบว่า type_code ซ้ำหรือไม่
    const existingCode = await pool.query(
      'SELECT activity_type_id FROM activity_types WHERE type_code = $1',
      [type_code]
    );
    
    if (existingCode.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'รหัสประเภทกิจกรรมนี้มีอยู่แล้ว'
      });
    }
    
    const result = await pool.query(`
      INSERT INTO activity_types (
        type_name, type_code, description, default_duration_hours,
        color_code, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
      RETURNING *
    `, [type_name, type_code, description, default_duration_hours, color_code]);
    
    res.status(201).json({
      success: true,
      message: 'สร้างประเภทกิจกรรมสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in createActivityType:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างประเภทกิจกรรม',
      error: error.message
    });
  }
});

// PUT /api/activity-types/:id - แก้ไขประเภทกิจกรรม (Admin only)
router.put('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type_name,
      type_code,
      description,
      default_duration_hours,
      color_code,
      status
    } = req.body;
    
    // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
    const checkResult = await pool.query(
      'SELECT * FROM activity_types WHERE activity_type_id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบประเภทกิจกรรมที่ต้องการแก้ไข'
      });
    }
    
    // ตรวจสอบว่า type_code ซ้ำหรือไม่ (ยกเว้นตัวเอง)
    if (type_code) {
      const existingCode = await pool.query(
        'SELECT activity_type_id FROM activity_types WHERE type_code = $1 AND activity_type_id != $2',
        [type_code, id]
      );
      
      if (existingCode.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'รหัสประเภทกิจกรรมนี้มีอยู่แล้ว'
        });
      }
    }
    
    const result = await pool.query(`
      UPDATE activity_types SET
        type_name = $2,
        type_code = $3,
        description = $4,
        default_duration_hours = $5,
        color_code = $6,
        status = $7,
        updated_at = NOW()
      WHERE activity_type_id = $1
      RETURNING *
    `, [id, type_name, type_code, description, default_duration_hours, color_code, status]);
    
    res.json({
      success: true,
      message: 'แก้ไขประเภทกิจกรรมสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in updateActivityType:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไขประเภทกิจกรรม',
      error: error.message
    });
  }
});

// DELETE /api/activity-types/:id - ลบประเภทกิจกรรม (Admin only)
router.delete('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // ตรวจสอบว่ามีการใช้งานใน schedules หรือไม่
    const usageCheck = await pool.query(
      'SELECT COUNT(*) FROM schedules WHERE activity_type_id = $1',
      [id]
    );
    
    const usageCount = parseInt(usageCheck.rows[0].count);
    
    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบประเภทกิจกรรมนี้ได้ เนื่องจากมีการใช้งานในตารางการฝึกปฏิบัติแล้ว'
      });
    }
    
    // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
    const checkResult = await pool.query(
      'SELECT * FROM activity_types WHERE activity_type_id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบประเภทกิจกรรมที่ต้องการลบ'
      });
    }
    
    await pool.query(
      'DELETE FROM activity_types WHERE activity_type_id = $1',
      [id]
    );
    
    res.json({
      success: true,
      message: 'ลบประเภทกิจกรรมสำเร็จ'
    });
  } catch (error) {
    console.error('Error in deleteActivityType:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบประเภทกิจกรรม',
      error: error.message
    });
  }
});

// PUT /api/activity-types/:id/status - เปลี่ยนสถานะประเภทกิจกรรม (Admin only)
router.put('/:id/status', requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'สถานะต้องเป็น active หรือ inactive เท่านั้น'
      });
    }
    
    const result = await pool.query(`
      UPDATE activity_types 
      SET status = $2, updated_at = NOW()
      WHERE activity_type_id = $1
      RETURNING *
    `, [id, status]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบประเภทกิจกรรมที่ต้องการ'
      });
    }
    
    res.json({
      success: true,
      message: 'เปลี่ยนสถานะประเภทกิจกรรมสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in updateActivityTypeStatus:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะประเภทกิจกรรม',
      error: error.message
    });
  }
});

module.exports = router;
