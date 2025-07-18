// routes/settings.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireRole } = require('../middleware/auth');

// All settings routes require admin role
router.use(requireRole(['admin']));

// GET /api/settings - ดูการตั้งค่าระบบทั้งหมด
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        setting_id,
        setting_key,
        setting_value,
        setting_type,
        description,
        is_editable,
        updated_at,
        CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
      FROM system_settings s
      LEFT JOIN users u ON s.updated_by = u.user_id
      ORDER BY setting_key
    `);
    
    res.json({
      success: true,
      message: 'ดึงการตั้งค่าระบบสำเร็จ',
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getSettings:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่าระบบ',
      error: error.message
    });
  }
});

// GET /api/settings/:key - ดูการตั้งค่ารายการเดียว
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM system_settings WHERE setting_key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าที่ต้องการ'
      });
    }
    
    res.json({
      success: true,
      message: 'ดึงการตั้งค่าสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in getSettingByKey:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่า',
      error: error.message
    });
  }
});

// PUT /api/settings/:key - แก้ไขการตั้งค่า
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { setting_value } = req.body;
    const userId = req.user.user_id;
    
    // ตรวจสอบว่ามีการตั้งค่านี้และแก้ไขได้หรือไม่
    const checkResult = await pool.query(
      'SELECT * FROM system_settings WHERE setting_key = $1',
      [key]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าที่ต้องการแก้ไข'
      });
    }
    
    const setting = checkResult.rows[0];
    
    if (!setting.is_editable) {
      return res.status(400).json({
        success: false,
        message: 'การตั้งค่านี้ไม่สามารถแก้ไขได้'
      });
    }
    
    // Validate setting value based on type
    let validatedValue = setting_value;
    
    switch (setting.setting_type) {
      case 'number':
        if (isNaN(setting_value)) {
          return res.status(400).json({
            success: false,
            message: 'ค่าที่ตั้งต้องเป็นตัวเลข'
          });
        }
        validatedValue = setting_value.toString();
        break;
        
      case 'boolean':
        if (!['true', 'false'].includes(setting_value.toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: 'ค่าที่ตั้งต้องเป็น true หรือ false'
          });
        }
        validatedValue = setting_value.toLowerCase();
        break;
        
      case 'json':
        try {
          JSON.parse(setting_value);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'ค่าที่ตั้งต้องเป็น JSON ที่ถูกต้อง'
          });
        }
        break;
        
      default: // string
        validatedValue = setting_value.toString();
    }
    
    const result = await pool.query(`
      UPDATE system_settings 
      SET setting_value = $2, updated_by = $3, updated_at = NOW()
      WHERE setting_key = $1
      RETURNING *
    `, [key, validatedValue, userId]);
    
    res.json({
      success: true,
      message: 'แก้ไขการตั้งค่าสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in updateSetting:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไขการตั้งค่า',
      error: error.message
    });
  }
});

// POST /api/settings - สร้างการตั้งค่าใหม่
router.post('/', async (req, res) => {
  try {
    const {
      setting_key,
      setting_value,
      setting_type = 'string',
      description,
      is_editable = true
    } = req.body;
    
    const userId = req.user.user_id;
    
    // Validation
    if (!setting_key || !setting_value) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก key และ value'
      });
    }
    
    // ตรวจสอบว่ามี key นี้อยู่แล้วหรือไม่
    const existingKey = await pool.query(
      'SELECT setting_id FROM system_settings WHERE setting_key = $1',
      [setting_key]
    );
    
    if (existingKey.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'มี key นี้อยู่ในระบบแล้ว'
      });
    }
    
    const result = await pool.query(`
      INSERT INTO system_settings (
        setting_key, setting_value, setting_type, description,
        is_editable, updated_by, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [setting_key, setting_value, setting_type, description, is_editable, userId]);
    
    res.status(201).json({
      success: true,
      message: 'สร้างการตั้งค่าสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in createSetting:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างการตั้งค่า',
      error: error.message
    });
  }
});

// DELETE /api/settings/:key - ลบการตั้งค่า
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // ตรวจสอบว่ามีการตั้งค่านี้และลบได้หรือไม่
    const checkResult = await pool.query(
      'SELECT * FROM system_settings WHERE setting_key = $1',
      [key]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าที่ต้องการลบ'
      });
    }
    
    const setting = checkResult.rows[0];
    
    if (!setting.is_editable) {
      return res.status(400).json({
        success: false,
        message: 'การตั้งค่านี้ไม่สามารถลบได้'
      });
    }
    
    await pool.query(
      'DELETE FROM system_settings WHERE setting_key = $1',
      [key]
    );
    
    res.json({
      success: true,
      message: 'ลบการตั้งค่าสำเร็จ'
    });
  } catch (error) {
    console.error('Error in deleteSetting:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบการตั้งค่า',
      error: error.message
    });
  }
});

// GET /api/settings/backup - สำรองข้อมูลการตั้งค่า
router.get('/backup', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT setting_key, setting_value, setting_type, description FROM system_settings ORDER BY setting_key'
    );
    
    const backup = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings: result.rows
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="settings-backup-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json({
      success: true,
      message: 'สำรองข้อมูลการตั้งค่าสำเร็จ',
      data: backup
    });
  } catch (error) {
    console.error('Error in backup settings:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสำรองข้อมูลการตั้งค่า',
      error: error.message
    });
  }
});

// POST /api/settings/restore - คืนค่าข้อมูลการตั้งค่า
router.post('/restore', async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.user.user_id;
    
    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลการตั้งค่าไม่ถูกต้อง'
      });
    }
    
    const client = await pool.connect();
    let restoredCount = 0;
    
    try {
      await client.query('BEGIN');
      
      for (const setting of settings) {
        const { setting_key, setting_value, setting_type, description } = setting;
        
        // ตรวจสอบว่ามี key นี้อยู่แล้วหรือไม่
        const existing = await client.query(
          'SELECT setting_id, is_editable FROM system_settings WHERE setting_key = $1',
          [setting_key]
        );
        
        if (existing.rows.length > 0) {
          // อัพเดทถ้าแก้ไขได้
          if (existing.rows[0].is_editable) {
            await client.query(`
              UPDATE system_settings 
              SET setting_value = $2, setting_type = $3, description = $4, 
                  updated_by = $5, updated_at = NOW()
              WHERE setting_key = $1
            `, [setting_key, setting_value, setting_type, description, userId]);
            restoredCount++;
          }
        } else {
          // สร้างใหม่
          await client.query(`
            INSERT INTO system_settings (
              setting_key, setting_value, setting_type, description,
              is_editable, updated_by, updated_at
            ) VALUES ($1, $2, $3, $4, TRUE, $5, NOW())
          `, [setting_key, setting_value, setting_type, description, userId]);
          restoredCount++;
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `คืนค่าข้อมูลการตั้งค่าสำเร็จ ${restoredCount} รายการ`,
        data: { restoredCount }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in restore settings:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการคืนค่าข้อมูลการตั้งค่า',
      error: error.message
    });
  }
});

// GET /api/settings/defaults - สร้างการตั้งค่าเริ่มต้น
router.get('/defaults', async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const defaultSettings = [
      {
        setting_key: 'max_students_per_instructor',
        setting_value: '15',
        setting_type: 'number',
        description: 'จำนวนนักศึกษาสูงสุดต่ออาจารย์หนึ่งคน'
      },
      {
        setting_key: 'default_session_duration',
        setting_value: '8',
        setting_type: 'number',
        description: 'ระยะเวลาการฝึกปฏิบัติปกติ (ชั่วโมง)'
      },
      {
        setting_key: 'notification_enabled',
        setting_value: 'true',
        setting_type: 'boolean',
        description: 'เปิดใช้งานการแจ้งเตือน'
      },
      {
        setting_key: 'academic_year',
        setting_value: '2568/2569',
        setting_type: 'string',
        description: 'ปีการศึกษาปัจจุบัน'
      },
      {
        setting_key: 'system_maintenance_mode',
        setting_value: 'false',
        setting_type: 'boolean',
        description: 'โหมดปิดปรุงระบบ'
      }
    ];
    
    let createdCount = 0;
    
    for (const defaultSetting of defaultSettings) {
      // ตรวจสอบว่ามีการตั้งค่านี้อยู่แล้วหรือไม่
      const existing = await pool.query(
        'SELECT setting_id FROM system_settings WHERE setting_key = $1',
        [defaultSetting.setting_key]
      );
      
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO system_settings (
            setting_key, setting_value, setting_type, description,
            is_editable, updated_by, updated_at
          ) VALUES ($1, $2, $3, $4, TRUE, $5, NOW())
        `, [
          defaultSetting.setting_key,
          defaultSetting.setting_value,
          defaultSetting.setting_type,
          defaultSetting.description,
          userId
        ]);
        createdCount++;
      }
    }
    
    res.json({
      success: true,
      message: `สร้างการตั้งค่าเริ่มต้นสำเร็จ ${createdCount} รายการ`,
      data: { createdCount, totalDefaults: defaultSettings.length }
    });
  } catch (error) {
    console.error('Error in create default settings:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างการตั้งค่าเริ่มต้น',
      error: error.message
    });
  }
});

module.exports = router;
