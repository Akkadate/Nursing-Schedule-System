const { query } = require('../config/database');

const locationController = {
  // GET /api/locations - ดูสถานที่ทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', building = '', status = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (location_name ILIKE $${paramCount} OR room_number ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (building) {
        paramCount++;
        whereClause += ` AND building ILIKE $${paramCount}`;
        params.push(`%${building}%`);
      }
      
      if (status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(status);
      }
      
      const locationsQuery = `
        SELECT location_id, location_name, room_number, building, floor, capacity, 
               equipment_available, description, status, created_at, updated_at
        FROM locations 
        ${whereClause}
        ORDER BY building ASC, floor ASC, room_number ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(locationsQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM locations ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลสถานที่สำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllLocations:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่',
        error: error.message
      });
    }
  },

  // GET /api/locations/:id - ดูข้อมูลสถานที่
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        'SELECT * FROM locations WHERE location_id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลสถานที่ที่ต้องการ'
        });
      }
      
      // Get usage statistics
      const statsResult = await query(
        `SELECT 
           COUNT(s.schedule_id) as total_bookings,
           COUNT(CASE WHEN s.schedule_date >= CURRENT_DATE THEN 1 END) as upcoming_bookings
         FROM schedules s
         WHERE s.location_id = $1`,
        [id]
      );
      
      const location = result.rows[0];
      location.usage_stats = statsResult.rows[0];
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลสถานที่สำเร็จ',
        data: location
      });
    } catch (error) {
      console.error('Error in getLocationById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่',
        error: error.message
      });
    }
  },

  // POST /api/locations - เพิ่มสถานที่ใหม่
  async create(req, res) {
    try {
      const { locationName, roomNumber, building, floor, capacity, equipmentAvailable, description } = req.body;
      
      // ตรวจสอบว่าห้องซ้ำในอาคารเดียวกันหรือไม่
      const existingLocation = await query(
        'SELECT location_id FROM locations WHERE room_number = $1 AND building = $2',
        [roomNumber, building]
      );
      
      if (existingLocation.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'หมายเลขห้องนี้มีการใช้งานแล้วในอาคารนี้'
        });
      }
      
      const result = await query(
        `INSERT INTO locations (location_name, room_number, building, floor, capacity, equipment_available, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING location_id, location_name, room_number, building, floor, capacity, equipment_available, description, status, created_at`,
        [locationName, roomNumber, building, floor, capacity, equipmentAvailable, description]
      );
      
      res.status(201).json({
        success: true,
        message: 'เพิ่มสถานที่ใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createLocation:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มสถานที่ใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/locations/:id - แก้ไขสถานที่
  async update(req, res) {
    try {
      const { id } = req.params;
      const { locationName, capacity, equipmentAvailable, description, status } = req.body;
      
      // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
      const checkResult = await query(
        'SELECT location_id FROM locations WHERE location_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลสถานที่ที่ต้องการแก้ไข'
        });
      }
      
      const result = await query(
        `UPDATE locations 
         SET location_name = COALESCE($1, location_name),
             capacity = COALESCE($2, capacity),
             equipment_available = COALESCE($3, equipment_available),
             description = COALESCE($4, description),
             status = COALESCE($5, status),
             updated_at = NOW()
         WHERE location_id = $6
         RETURNING location_id, location_name, room_number, building, floor, capacity, equipment_available, description, status, updated_at`,
        [locationName, capacity, equipmentAvailable, description, status, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขสถานที่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateLocation:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขสถานที่',
        error: error.message
      });
    }
  },

  // DELETE /api/locations/:id - ลบสถานที่
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
      const checkResult = await query(
        'SELECT location_id, location_name FROM locations WHERE location_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลสถานที่ที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่ามีตารางที่ใช้สถานที่นี้หรือไม่
      const scheduleCheck = await query(
        'SELECT schedule_id FROM schedules WHERE location_id = $1',
        [id]
      );
      
      if (scheduleCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบสถานที่ได้ เนื่องจากมีตารางที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM locations WHERE location_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบสถานที่สำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteLocation:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบสถานที่',
        error: error.message
      });
    }
  },

  // GET /api/locations/:id/schedule - ดูตารางการใช้งานสถานที่
  async getSchedule(req, res) {
    try {
      const { id } = req.params;
      const { startDate, endDate, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE s.location_id = $1';
      let params = [id];
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
        `SELECT s.schedule_id, s.schedule_date, s.start_time, s.end_time, s.status,
                c.course_name, c.course_code,
                at.type_name,
                i.first_name || ' ' || i.last_name as instructor_name,
                string_agg(g.group_name, ', ') as groups
         FROM schedules s
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users i ON inst.user_id = i.user_id
         LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         LEFT JOIN groups g ON sg.group_id = g.group_id
         ${whereClause}
         GROUP BY s.schedule_id, c.course_name, c.course_code, at.type_name, i.first_name, i.last_name
         ORDER BY s.schedule_date ASC, s.start_time ASC
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, offset]
      );
      
      res.json({
        success: true,
        message: 'ดึงตารางการใช้งานสถานที่สำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getLocationSchedule:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงตารางการใช้งานสถานที่',
        error: error.message
      });
    }
  },

  // GET /api/locations/availability - ตรวจสอบความพร้อมใช้งานของสถานที่
  async checkAvailability(req, res) {
    try {
      const { date, startTime, endTime, excludeScheduleId } = req.query;
      
      if (!date || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุวันที่ เวลาเริ่มต้น และเวลาสิ้นสุด'
        });
      }
      
      let whereClause = `WHERE s.schedule_date = $1 
                        AND ((s.start_time <= $2 AND s.end_time > $2) 
                         OR (s.start_time < $3 AND s.end_time >= $3)
                         OR (s.start_time >= $2 AND s.end_time <= $3))
                        AND s.status != 'cancelled'`;
      let params = [date, startTime, endTime];
      let paramCount = 3;
      
      if (excludeScheduleId) {
        paramCount++;
        whereClause += ` AND s.schedule_id != $${paramCount}`;
        params.push(excludeScheduleId);
      }
      
      const result = await query(
        `SELECT l.location_id, l.location_name, l.room_number, l.building,
                CASE WHEN s.schedule_id IS NOT NULL THEN false ELSE true END as available
         FROM locations l
         LEFT JOIN schedules s ON l.location_id = s.location_id AND (${whereClause.replace('WHERE ', '')})
         WHERE l.status = 'active'
         ORDER BY l.building ASC, l.room_number ASC`,
        params
      );
      
      res.json({
        success: true,
        message: 'ตรวจสอบความพร้อมใช้งานสถานที่สำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in checkLocationAvailability:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการตรวจสอบความพร้อมใช้งานสถานที่',
        error: error.message
      });
    }
  },

  // GET /api/locations/buildings - ดูรายชื่ออาคารทั้งหมด
  async getBuildings(req, res) {
    try {
      const result = await query(
        'SELECT DISTINCT building FROM locations WHERE status = $1 ORDER BY building ASC',
        ['active']
      );
      
      res.json({
        success: true,
        message: 'ดึงรายชื่ออาคารสำเร็จ',
        data: result.rows.map(row => row.building)
      });
    } catch (error) {
      console.error('Error in getBuildings:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงรายชื่ออาคาร',
        error: error.message
      });
    }
  }
};

module.exports = locationController;
