// models/Location.js
const pool = require('../config/database');

class Location {
  // ดึงข้อมูลสถานที่ทั้งหมด
  static async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, search = '', location_type = '' } = options;
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          location_id,
          location_name,
          location_code,
          location_type,
          address,
          contact_person,
          contact_phone,
          contact_email,
          capacity,
          facilities,
          notes,
          status,
          created_at,
          updated_at
        FROM locations
        WHERE 1=1
      `;
      
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        query += ` AND (location_name ILIKE $${paramCount} OR location_code ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (location_type) {
        paramCount++;
        query += ` AND location_type = $${paramCount}`;
        params.push(location_type);
      }
      
      query += ` ORDER BY location_name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      // Count total
      let countQuery = 'SELECT COUNT(*) FROM locations WHERE 1=1';
      let countParams = [];
      let countParamCount = 0;
      
      if (search) {
        countParamCount++;
        countQuery += ` AND (location_name ILIKE $${countParamCount} OR location_code ILIKE $${countParamCount})`;
        countParams.push(`%${search}%`);
      }
      
      if (location_type) {
        countParamCount++;
        countQuery += ` AND location_type = $${countParamCount}`;
        countParams.push(location_type);
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
  
  // ดึงข้อมูลสถานที่ตาม ID
  static async findById(locationId) {
    try {
      const result = await pool.query(
        'SELECT * FROM locations WHERE location_id = $1',
        [locationId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงข้อมูลสถานที่ตาม Code
  static async findByCode(locationCode) {
    try {
      const result = await pool.query(
        'SELECT * FROM locations WHERE location_code = $1',
        [locationCode]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างสถานที่ใหม่
  static async create(locationData) {
    try {
      const {
        location_name,
        location_code,
        location_type,
        address,
        contact_person,
        contact_phone,
        contact_email,
        capacity,
        facilities,
        notes,
        status = 'active'
      } = locationData;
      
      const result = await pool.query(`
        INSERT INTO locations (
          location_name, location_code, location_type, address,
          contact_person, contact_phone, contact_email, capacity,
          facilities, notes, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *
      `, [
        location_name, location_code, location_type, address,
        contact_person, contact_phone, contact_email, capacity,
        facilities, notes, status
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // แก้ไขข้อมูลสถานที่
  static async update(locationId, locationData) {
    try {
      const {
        location_name,
        location_code,
        location_type,
        address,
        contact_person,
        contact_phone,
        contact_email,
        capacity,
        facilities,
        notes,
        status
      } = locationData;
      
      const result = await pool.query(`
        UPDATE locations SET
          location_name = $2,
          location_code = $3,
          location_type = $4,
          address = $5,
          contact_person = $6,
          contact_phone = $7,
          contact_email = $8,
          capacity = $9,
          facilities = $10,
          notes = $11,
          status = $12,
          updated_at = NOW()
        WHERE location_id = $1
        RETURNING *
      `, [
        locationId, location_name, location_code, location_type, address,
        contact_person, contact_phone, contact_email, capacity,
        facilities, notes, status
      ]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ลบสถานที่
  static async delete(locationId) {
    try {
      const result = await pool.query(
        'DELETE FROM locations WHERE location_id = $1 RETURNING *',
        [locationId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงสถานที่ที่ว่างในช่วงเวลาที่กำหนด
  static async findAvailable(date, startTime, endTime) {
    try {
      const result = await pool.query(`
        SELECT l.* FROM locations l
        WHERE l.status = 'active'
        AND l.location_id NOT IN (
          SELECT DISTINCT s.location_id 
          FROM schedules s 
          WHERE s.schedule_date = $1
          AND s.status != 'cancelled'
          AND (
            (s.start_time <= $2 AND s.end_time > $2) OR
            (s.start_time < $3 AND s.end_time >= $3) OR
            (s.start_time >= $2 AND s.end_time <= $3)
          )
        )
        ORDER BY l.location_name
      `, [date, startTime, endTime]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงสถิติการใช้งานสถานที่
  static async getUsageStats(locationId, startDate, endDate) {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_schedules,
          COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_schedules,
          COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_schedules,
          COALESCE(AVG(
            CASE WHEN s.status = 'completed' 
            THEN (SELECT COUNT(*) FROM schedule_groups sg WHERE sg.schedule_id = s.schedule_id)
            END
          ), 0) as avg_groups_per_session
        FROM schedules s
        WHERE s.location_id = $1
        AND s.schedule_date BETWEEN $2 AND $3
      `, [locationId, startDate, endDate]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงประเภทสถานที่ทั้งหมด
  static async getLocationTypes() {
    try {
      const result = await pool.query(`
        SELECT DISTINCT location_type 
        FROM locations 
        WHERE location_type IS NOT NULL 
        ORDER BY location_type
      `);
      
      return result.rows.map(row => row.location_type);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Location;
