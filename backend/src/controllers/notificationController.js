const { query } = require('../config/database');

const notificationController = {
  // GET /api/notifications - ดูการแจ้งเตือนทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, isRead, type = '' } = req.query;
      const { userId } = req.user;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE (recipient_user_id = $1 OR recipient_user_id IS NULL)';
      let params = [userId];
      let paramCount = 1;
      
      if (isRead !== undefined) {
        paramCount++;
        whereClause += ` AND is_read = $${paramCount}`;
        params.push(isRead === 'true');
      }
      
      if (type) {
        paramCount++;
        whereClause += ` AND type = $${paramCount}`;
        params.push(type);
      }
      
      const notificationsQuery = `
        SELECT notification_id, title, message, type, priority, is_read,
               schedule_id, recipient_user_id, created_at
        FROM notifications 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(notificationsQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM notifications ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลการแจ้งเตือนสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllNotifications:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน',
        error: error.message
      });
    }
  },

  // GET /api/notifications/unread-count - นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  async getUnreadCount(req, res) {
    try {
      const { userId } = req.user;
      
      const result = await query(
        `SELECT COUNT(*) as unread_count 
         FROM notifications 
         WHERE (recipient_user_id = $1 OR recipient_user_id IS NULL) 
         AND is_read = false`,
        [userId]
      );
      
      res.json({
        success: true,
        message: 'ดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่านสำเร็จ',
        data: {
          unread_count: parseInt(result.rows[0].unread_count)
        }
      });
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงจำนวนการแจ้งเตือน',
        error: error.message
      });
    }
  },

  // PUT /api/notifications/:id/read - ทำเครื่องหมายว่าอ่านแล้ว
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.user;
      
      // ตรวจสอบว่าการแจ้งเตือนมีอยู่และเป็นของผู้ใช้นี้
      const checkResult = await query(
        `SELECT notification_id FROM notifications 
         WHERE notification_id = $1 
         AND (recipient_user_id = $2 OR recipient_user_id IS NULL)`,
        [id, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบการแจ้งเตือนที่ต้องการ'
        });
      }
      
      await query(
        'UPDATE notifications SET is_read = true WHERE notification_id = $1',
        [id]
      );
      
      res.json({
        success: true,
        message: 'ทำเครื่องหมายอ่านแล้วสำเร็จ'
      });
    } catch (error) {
      console.error('Error in markAsRead:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการทำเครื่องหมายอ่านแล้ว',
        error: error.message
      });
    }
  },

  // PUT /api/notifications/mark-all-read - ทำเครื่องหมายอ่านทั้งหมด
  async markAllAsRead(req, res) {
    try {
      const { userId } = req.user;
      
      const result = await query(
        `UPDATE notifications 
         SET is_read = true 
         WHERE (recipient_user_id = $1 OR recipient_user_id IS NULL) 
         AND is_read = false`,
        [userId]
      );
      
      res.json({
        success: true,
        message: 'ทำเครื่องหมายอ่านทั้งหมดสำเร็จ',
        data: {
          updated_count: result.rowCount
        }
      });
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการทำเครื่องหมายอ่านทั้งหมด',
        error: error.message
      });
    }
  },

  // POST /api/notifications - สร้างการแจ้งเตือนใหม่ (Admin only)
  async create(req, res) {
    try {
      const { title, message, type, priority, recipientUserId, scheduleId } = req.body;
      
      const result = await query(
        `INSERT INTO notifications (title, message, type, priority, recipient_user_id, schedule_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING notification_id, title, message, type, priority, recipient_user_id, schedule_id, created_at`,
        [title, message, type, priority || 'normal', recipientUserId, scheduleId]
      );
      
      res.status(201).json({
        success: true,
        message: 'สร้างการแจ้งเตือนใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createNotification:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างการแจ้งเตือนใหม่',
        error: error.message
      });
    }
  },

  // POST /api/notifications/broadcast - ส่งการแจ้งเตือนแบบ broadcast (Admin only)
  async broadcast(req, res) {
    try {
      const { title, message, type, priority, targetRole, targetSectionId, targetGroupId } = req.body;
      
      // กำหนด recipient ตาม target
      let recipientQuery = '';
      let recipientParams = [];
      
      if (targetRole) {
        recipientQuery = 'SELECT user_id FROM users WHERE role = $1 AND status = $2';
        recipientParams = [targetRole, 'active'];
      } else if (targetSectionId) {
        recipientQuery = `
          SELECT DISTINCT u.user_id 
          FROM users u
          JOIN instructors i ON u.user_id = i.user_id
          JOIN schedules s ON i.instructor_id = s.instructor_id
          JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
          JOIN groups g ON sg.group_id = g.group_id
          WHERE g.section_id = $1 AND u.status = $2
        `;
        recipientParams = [targetSectionId, 'active'];
      } else if (targetGroupId) {
        recipientQuery = `
          SELECT DISTINCT u.user_id 
          FROM users u
          JOIN instructors i ON u.user_id = i.user_id
          JOIN schedules s ON i.instructor_id = s.instructor_id
          JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
          WHERE sg.group_id = $1 AND u.status = $2
        `;
        recipientParams = [targetGroupId, 'active'];
      }
      
      const recipients = recipientQuery ? 
        await query(recipientQuery, recipientParams) : { rows: [] };
      
      // สร้างการแจ้งเตือนสำหรับแต่ละ recipient
      const notifications = [];
      
      if (recipients.rows.length > 0) {
        for (const recipient of recipients.rows) {
          const result = await query(
            `INSERT INTO notifications (title, message, type, priority, recipient_user_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING notification_id`,
            [title, message, type, priority || 'normal', recipient.user_id]
          );
          notifications.push(result.rows[0]);
        }
      } else {
        // ส่งแบบ global (recipient_user_id = null)
        const result = await query(
          `INSERT INTO notifications (title, message, type, priority, recipient_user_id, created_at)
           VALUES ($1, $2, $3, $4, NULL, NOW())
           RETURNING notification_id`,
          [title, message, type, priority || 'normal']
        );
        notifications.push(result.rows[0]);
      }
      
      res.status(201).json({
        success: true,
        message: 'ส่งการแจ้งเตือนแบบ broadcast สำเร็จ',
        data: {
          total_notifications: notifications.length,
          notifications: notifications
        }
      });
    } catch (error) {
      console.error('Error in broadcastNotification:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการส่งการแจ้งเตือน',
        error: error.message
      });
    }
  },

  // DELETE /api/notifications/:id - ลบการแจ้งเตือน (Admin only)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const checkResult = await query(
        'SELECT notification_id FROM notifications WHERE notification_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบการแจ้งเตือนที่ต้องการลบ'
        });
      }
      
      await query('DELETE FROM notifications WHERE notification_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบการแจ้งเตือนสำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteNotification:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบการแจ้งเตือน',
        error: error.message
      });
    }
  },

  // POST /api/notifications/schedule-reminder - สร้างการแจ้งเตือนสำหรับตาราง
  async createScheduleReminder(req, res) {
    try {
      const { scheduleId, reminderType, customMessage } = req.body;
      
      // ดึงข้อมูลตาราง
      const scheduleResult = await query(
        `SELECT s.schedule_date, s.start_time, s.end_time,
                c.course_name, l.location_name,
                u.first_name || ' ' || u.last_name as instructor_name
         FROM schedules s
         JOIN courses c ON s.course_id = c.course_id
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
      
      const schedule = scheduleResult.rows[0];
      
      // สร้างข้อความแจ้งเตือน
      let title, message;
      
      switch (reminderType) {
        case 'upcoming':
          title = 'แจ้งเตือนกิจกรรมใกล้เข้า';
          message = `กิจกรรม ${schedule.course_name} จะเริ่มในวันที่ ${schedule.schedule_date} เวลา ${schedule.start_time} ณ ${schedule.location_name}`;
          break;
        case 'changed':
          title = 'แจ้งเตือนการเปลี่ยนแปลงตาราง';
          message = customMessage || `มีการเปลี่ยนแปลงในกิจกรรม ${schedule.course_name}`;
          break;
        case 'cancelled':
          title = 'แจ้งเตือนการยกเลิกกิจกรรม';
          message = customMessage || `กิจกรรม ${schedule.course_name} ในวันที่ ${schedule.schedule_date} ถูกยกเลิก`;
          break;
        default:
          title = 'แจ้งเตือนเกี่ยวกับกิจกรรม';
          message = customMessage || `มีข้อมูลเกี่ยวกับกิจกรรม ${schedule.course_name}`;
      }
      
      // ดึงรายชื่อนักศึกษาและอาจารย์ที่เกี่ยวข้อง
      const recipientsResult = await query(
        `SELECT DISTINCT u.user_id
         FROM users u
         LEFT JOIN instructors inst ON u.user_id = inst.user_id
         LEFT JOIN students st ON u.username = CONCAT('student', st.student_id)
         LEFT JOIN groups g ON st.group_id = g.group_id
         LEFT JOIN schedule_groups sg ON g.group_id = sg.group_id
         WHERE (sg.schedule_id = $1 OR inst.instructor_id = (
           SELECT instructor_id FROM schedules WHERE schedule_id = $1
         )) AND u.status = 'active'`,
        [scheduleId]
      );
      
      // สร้างการแจ้งเตือนสำหรับแต่ละคน
      const notifications = [];
      for (const recipient of recipientsResult.rows) {
        const result = await query(
          `INSERT INTO notifications (title, message, type, priority, recipient_user_id, schedule_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING notification_id`,
          [title, message, 'schedule', 'high', recipient.user_id, scheduleId]
        );
        notifications.push(result.rows[0]);
      }
      
      res.status(201).json({
        success: true,
        message: 'สร้างการแจ้งเตือนสำหรับตารางสำเร็จ',
        data: {
          total_notifications: notifications.length,
          schedule_info: schedule
        }
      });
    } catch (error) {
      console.error('Error in createScheduleReminder:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างการแจ้งเตือน',
        error: error.message
      });
    }
  },

  // GET /api/notifications/types - ดูประเภทการแจ้งเตือนทั้งหมด
  async getNotificationTypes(req, res) {
    try {
      const types = [
        { value: 'general', label: 'ทั่วไป', description: 'การแจ้งเตือนทั่วไป' },
        { value: 'schedule', label: 'ตาราง', description: 'เกี่ยวกับตารางเรียน/สอน' },
        { value: 'attendance', label: 'การเข้าร่วม', description: 'เกี่ยวกับการเข้าร่วมกิจกรรม' },
        { value: 'system', label: 'ระบบ', description: 'การแจ้งเตือนจากระบบ' },
        { value: 'urgent', label: 'ด่วน', description: 'การแจ้งเตือนเร่งด่วน' }
      ];
      
      res.json({
        success: true,
        message: 'ดึงประเภทการแจ้งเตือนสำเร็จ',
        data: types
      });
    } catch (error) {
      console.error('Error in getNotificationTypes:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงประเภทการแจ้งเตือน',
        error: error.message
      });
    }
  }
};

module.exports = notificationController;
