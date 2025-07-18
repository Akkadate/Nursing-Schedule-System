// models/ActivityType.js
const pool = require('../config/database');

class ActivityType {
  // ดึงข้อมูลประเภทกิจกรรมทั้งหมด
  static async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, search = '', status = '' } = options;
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
        query += ` AND (type_name ILIKE $${paramCount} OR type_code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
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
        countQuery += ` AND (type_name ILIKE $${countParamCount} OR type_code ILIKE $${countParamCount} OR description ILIKE $${countParamCount})`;
        countParams.push(`%${search}%`);
      }
      
      if (status) {
        countParamCount++;
        countQuery += ` AND status = $${countParamCount}`;
        countParams.push(status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);
      
      return {
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงข้อมูลประเภทกิจกรรมที่ active ทั้งหมด (สำหรับ dropdown)
  static async findAllActive() {
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
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงข้อมูลประเภทกิจกรรมตาม ID
  static async findById(activityTypeId) {
    try {
      const result = await pool.query(
        'SELECT * FROM activity_types WHERE activity_type_id = $1',
        [activityTypeId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงข้อมูลประเภทกิจกรรมตาม Code
  static async findByCode(typeCode) {
    try {
      const result = await pool.query(
        'SELECT * FROM activity_types WHERE type_code = $1',
        [typeCode]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างประเภทกิจกรรมใหม่
  static async create(activityTypeData) {
    try {
      const {
        type_name,
        type_code,
        description,
        default_duration_hours = 0,
        color_code = '#4285F4',
        status = 'active'
      } = activityTypeData;
      
      const result = await pool.query(`
        INSERT INTO activity_types (
          type_name, type_code, description, default_duration_hours,
          color_code, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `, [
        type_name, type_code, description, default_duration_hours,
        color_code, status
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // แก้ไขข้อมูลประเภทกิจกรรม
  static async update(activityTypeId, activityTypeData) {
    try {
      const {
        type_name,
        type_code,
        description,
        default_duration_hours,
        color_code,
        status
      } = activityTypeData;
      
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
      `, [
        activityTypeId, type_name, type_code, description,
        default_duration_hours, color_code, status
      ]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ลบประเภทกิจกรรม
  static async delete(activityTypeId) {
    try {
      // ตรวจสอบว่ามีการใช้งานใน schedules หรือไม่
      const usageCheck = await pool.query(
        'SELECT COUNT(*) FROM schedules WHERE activity_type_id = $1',
        [activityTypeId]
      );
      
      const usageCount = parseInt(usageCheck.rows[0].count);
      
      if (usageCount > 0) {
        throw new Error('ไม่สามารถลบประเภทกิจกรรมนี้ได้ เนื่องจากมีการใช้งานในตารางการฝึกปฏิบัติแล้ว');
      }
      
      const result = await pool.query(
        'DELETE FROM activity_types WHERE activity_type_id = $1 RETURNING *',
        [activityTypeId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // เปลี่ยนสถานะประเภทกิจกรรม
  static async updateStatus(activityTypeId, status) {
    try {
      const result = await pool.query(`
        UPDATE activity_types 
        SET status = $2, updated_at = NOW()
        WHERE activity_type_id = $1
        RETURNING *
      `, [activityTypeId, status]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงสถิติการใช้งานประเภทกิจกรรม
  static async getUsageStats(activityTypeId, startDate, endDate) {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_schedules,
          COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_schedules,
          COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_schedules,
          COALESCE(AVG(
            CASE WHEN s.status = 'completed' 
            THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600
            END
          ), 0) as avg_duration_hours,
          COALESCE(SUM(
            CASE WHEN s.status = 'completed' 
            THEN (SELECT COUNT(*) FROM schedule_groups sg WHERE sg.schedule_id = s.schedule_id)
            END
          ), 0) as total_groups_attended
        FROM schedules s
        WHERE s.activity_type_id = $1
        AND s.schedule_date BETWEEN $2 AND $3
      `, [activityTypeId, startDate, endDate]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงประเภทกิจกรรมที่มีตารางในช่วงเวลาที่กำหนด
  static async findWithSchedules(startDate, endDate) {
    try {
      const result = await pool.query(`
        SELECT DISTINCT
          at.*,
          COUNT(s.schedule_id) as schedule_count
        FROM activity_types at
        LEFT JOIN schedules s ON at.activity_type_id = s.activity_type_id
          AND s.schedule_date BETWEEN $1 AND $2
          AND s.status != 'cancelled'
        WHERE at.status = 'active'
        GROUP BY at.activity_type_id, at.type_name, at.type_code, at.description, 
                 at.default_duration_hours, at.color_code, at.status, 
                 at.created_at, at.updated_at
        ORDER BY at.type_name
      `, [startDate, endDate]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ตรวจสอบว่า type_code ซ้ำหรือไม่
  static async isCodeExists(typeCode, excludeId = null) {
    try {
      let query = 'SELECT COUNT(*) FROM activity_types WHERE type_code = $1';
      let params = [typeCode];
      
      if (excludeId) {
        query += ' AND activity_type_id != $2';
        params.push(excludeId);
      }
      
      const result = await pool.query(query, params);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างข้อมูลเริ่มต้น (สำหรับ seed data)
  static async createDefaults() {
    try {
      const defaults = [
        {
          type_name: 'ปฐมนิเทศ',
          type_code: 'ORIENTATION',
          description: 'การแนะนำและเตรียมความพร้อมก่อนฝึกปฏิบัติ',
          default_duration_hours: 2.00,
          color_code: '#4285F4'
        },
        {
          type_name: 'ฝึกปฏิบัติ',
          type_code: 'PRACTICE',
          description: 'การฝึกปฏิบัติจริงในสถานที่ฝึก',
          default_duration_hours: 8.00,
          color_code: '#34A853'
        },
        {
          type_name: 'สอบประมวลความรู้',
          type_code: 'EXAMINATION',
          description: 'การประเมินผลการเรียนรู้',
          default_duration_hours: 3.00,
          color_code: '#EA4335'
        }
      ];
      
      const results = [];
      
      for (const defaultData of defaults) {
        // ตรวจสอบว่ามีข้อมูลนี้อยู่แล้วหรือไม่
        const existing = await this.findByCode(defaultData.type_code);
        
        if (!existing) {
          const created = await this.create(defaultData);
          results.push(created);
        } else {
          results.push(existing);
        }
      }
      
      return results;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ActivityType;
