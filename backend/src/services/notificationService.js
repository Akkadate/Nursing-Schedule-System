// services/notificationService.js
const pool = require('../config/database');

class NotificationService {
  // สร้างการแจ้งเตือนใหม่
  static async createNotification(notificationData) {
    try {
      const {
        user_id,
        title,
        message,
        type = 'info',
        related_table = null,
        related_id = null
      } = notificationData;
      
      const result = await pool.query(`
        INSERT INTO notifications (
          user_id, title, message, type, related_table, related_id,
          is_read, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
        RETURNING *
      `, [user_id, title, message, type, related_table, related_id]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างการแจ้งเตือนหลายคน
  static async createBulkNotifications(userIds, notificationData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const {
        title,
        message,
        type = 'info',
        related_table = null,
        related_id = null
      } = notificationData;
      
      const notifications = [];
      
      for (const userId of userIds) {
        const result = await client.query(`
          INSERT INTO notifications (
            user_id, title, message, type, related_table, related_id,
            is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
          RETURNING *
        `, [userId, title, message, type, related_table, related_id]);
        
        notifications.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return notifications;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // ดึงการแจ้งเตือนของผู้ใช้
  static async getUserNotifications(userId, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        is_read = null, 
        type = null,
        days = 30 
      } = options;
      
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          notification_id,
          title,
          message,
          type,
          related_table,
          related_id,
          is_read,
          created_at
        FROM notifications
        WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      `;
      
      let params = [userId];
      let paramCount = 1;
      
      if (is_read !== null) {
        paramCount++;
        query += ` AND is_read = $${paramCount}`;
        params.push(is_read);
      }
      
      if (type) {
        paramCount++;
        query += ` AND type = $${paramCount}`;
        params.push(type);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      // Count total
      let countQuery = `
        SELECT COUNT(*)
        FROM notifications
        WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      `;
      
      let countParams = [userId];
      let countParamCount = 1;
      
      if (is_read !== null) {
        countParamCount++;
        countQuery += ` AND is_read = $${countParamCount}`;
        countParams.push(is_read);
      }
      
      if (type) {
        countParamCount++;
        countQuery += ` AND type = $${countParamCount}`;
        countParams.push(type);
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
  
  // ดึงจำนวนการแจ้งเตือนที่ยังไม่อ่าน
  static async getUnreadCount(userId) {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [userId]
      );
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw error;
    }
  }
  
  // ทำเครื่องหมายการแจ้งเตือนเป็นอ่านแล้ว
  static async markAsRead(notificationId, userId) {
    try {
      const result = await pool.query(`
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE notification_id = $1 AND user_id = $2
        RETURNING *
      `, [notificationId, userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ทำเครื่องหมายการแจ้งเตือนทั้งหมดเป็นอ่านแล้ว
  static async markAllAsRead(userId) {
    try {
      const result = await pool.query(`
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE user_id = $1 AND is_read = FALSE
        RETURNING COUNT(*)
      `, [userId]);
      
      return { updated: result.rowCount };
    } catch (error) {
      throw error;
    }
  }
  
  // ลบการแจ้งเตือน
  static async deleteNotification(notificationId, userId) {
    try {
      const result = await pool.query(
        'DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2 RETURNING *',
        [notificationId, userId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ลบการแจ้งเตือนที่เก่าเกินไป
  static async cleanupOldNotifications(days = 90) {
    try {
      const result = await pool.query(`
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '${days} days'
        RETURNING COUNT(*)
      `);
      
      return { deleted: result.rowCount };
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างการแจ้งเตือนตารางที่เปลี่ยนแปลง
  static async notifyScheduleChange(scheduleId, changeType, affectedUserIds, details = {}) {
    try {
      const scheduleInfo = await pool.query(`
        SELECT 
          s.schedule_date,
          s.start_time,
          s.end_time,
          c.course_name,
          l.location_name
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE s.schedule_id = $1
      `, [scheduleId]);
      
      if (scheduleInfo.rows.length === 0) {
        throw new Error('ไม่พบข้อมูลตาราง');
      }
      
      const schedule = scheduleInfo.rows[0];
      
      let title, message, type;
      
      switch (changeType) {
        case 'created':
          title = 'ตารางการฝึกปฏิบัติใหม่';
          message = `มีการสร้างตารางการฝึกปฏิบัติใหม่ ${schedule.course_name} วันที่ ${schedule.schedule_date} เวลา ${schedule.start_time}-${schedule.end_time}`;
          type = 'info';
          break;
          
        case 'updated':
          title = 'ตารางการฝึกปฏิบัติมีการเปลี่ยนแปลง';
          message = `ตารางการฝึกปฏิบัติ ${schedule.course_name} วันที่ ${schedule.schedule_date} มีการเปลี่ยนแปลง`;
          type = 'warning';
          break;
          
        case 'cancelled':
          title = 'ตารางการฝึกปฏิบัติถูกยกเลิก';
          message = `ตารางการฝึกปฏิบัติ ${schedule.course_name} วันที่ ${schedule.schedule_date} ถูกยกเลิก`;
          type = 'error';
          break;
          
        case 'reminder':
          title = 'แจ้งเตือนตารางการฝึกปฏิบัติ';
          message = `คุณมีตารางการฝึกปฏิบัติ ${schedule.course_name} วันที่ ${schedule.schedule_date} เวลา ${schedule.start_time}-${schedule.end_time} ณ ${schedule.location_name}`;
          type = 'info';
          break;
          
        default:
          title = 'ข้อมูลตารางการฝึกปฏิบัติ';
          message = `มีการอัพเดทข้อมูลตารางการฝึกปฏิบัติ ${schedule.course_name}`;
          type = 'info';
      }
      
      if (details.customMessage) {
        message = details.customMessage;
      }
      
      const notifications = await this.createBulkNotifications(affectedUserIds, {
        title,
        message,
        type,
        related_table: 'schedules',
        related_id: scheduleId
      });
      
      return notifications;
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างการแจ้งเตือนสำหรับการเข้าร่วม
  static async notifyAttendanceUpdate(scheduleId, studentIds, attendanceType, details = {}) {
    try {
      const scheduleInfo = await pool.query(`
        SELECT 
          s.schedule_date,
          s.start_time,
          s.end_time,
          c.course_name,
          inst.user_id as instructor_user_id
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
        WHERE s.schedule_id = $1
      `, [scheduleId]);
      
      if (scheduleInfo.rows.length === 0) {
        throw new Error('ไม่พบข้อมูลตาราง');
      }
      
      const schedule = scheduleInfo.rows[0];
      
      let title, message, type;
      
      switch (attendanceType) {
        case 'marked':
          title = 'บันทึกการเข้าร่วมแล้ว';
          message = `มีการบันทึกการเข้าร่วมสำหรับ ${schedule.course_name} วันที่ ${schedule.schedule_date}`;
          type = 'success';
          break;
          
        case 'absent_warning':
          title = 'นักศึกษาขาดเรียน';
          message = `มีนักศึกษาขาดเรียน ${schedule.course_name} วันที่ ${schedule.schedule_date} จำนวน ${studentIds.length} คน`;
          type = 'warning';
          break;
          
        case 'evaluation_completed':
          title = 'ประเมินผลการเรียนรู้แล้ว';
          message = `มีการประเมินผลการเรียนรู้สำหรับ ${schedule.course_name} วันที่ ${schedule.schedule_date}`;
          type = 'info';
          break;
          
        default:
          title = 'อัพเดทการเข้าร่วม';
          message = `มีการอัพเดทข้อมูลการเข้าร่วมสำหรับ ${schedule.course_name}`;
          type = 'info';
      }
      
      if (details.customMessage) {
        message = details.customMessage;
      }
      
      // แจ้งเตือนอาจารย์ที่เกี่ยวข้อง
      if (schedule.instructor_user_id) {
        await this.createNotification({
          user_id: schedule.instructor_user_id,
          title,
          message,
          type,
          related_table: 'schedules',
          related_id: scheduleId
        });
      }
      
      return { success: true, message: 'ส่งการแจ้งเตือนสำเร็จ' };
    } catch (error) {
      throw error;
    }
  }
  
  // ส่งการแจ้งเตือนอัตโนมัติ (สำหรับ scheduled job)
  static async sendAutomaticNotifications() {
    try {
      // แจ้งเตือนตารางที่ใกล้จะถึง (พรุ่งนี้)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const upcomingSchedules = await pool.query(`
        SELECT 
          s.schedule_id,
          s.schedule_date,
          s.start_time,
          s.end_time,
          c.course_name,
          l.location_name,
          inst.user_id as instructor_user_id,
          u.first_name,
          u.last_name
        FROM schedules s
        JOIN courses c ON s.course_id = c.course_id
        JOIN locations l ON s.location_id = l.location_id
        JOIN instructors inst ON s.instructor_id = inst.instructor_id
        JOIN users u ON inst.user_id = u.user_id
        WHERE s.schedule_date = $1
        AND s.status = 'scheduled'
      `, [tomorrowStr]);
      
      let notificationCount = 0;
      
      for (const schedule of upcomingSchedules.rows) {
        await this.createNotification({
          user_id: schedule.instructor_user_id,
          title: 'ตารางการฝึกปฏิบัติพรุ่งนี้',
          message: `คุณมีตารางการฝึกปฏิบัติ ${schedule.course_name} วันที่ ${schedule.schedule_date} เวลา ${schedule.start_time}-${schedule.end_time} ณ ${schedule.location_name}`,
          type: 'info',
          related_table: 'schedules',
          related_id: schedule.schedule_id
        });
        
        notificationCount++;
      }
      
      // ลบการแจ้งเตือนเก่า (มากกว่า 30 วัน)
      const cleanupResult = await this.cleanupOldNotifications(30);
      
      return {
        upcomingNotifications: notificationCount,
        cleanedUp: cleanupResult.deleted
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงสถิติการแจ้งเตือน
  static async getNotificationStats(userId, days = 30) {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_notifications,
          COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_count,
          COUNT(CASE WHEN type = 'info' THEN 1 END) as info_count,
          COUNT(CASE WHEN type = 'warning' THEN 1 END) as warning_count,
          COUNT(CASE WHEN type = 'error' THEN 1 END) as error_count,
          COUNT(CASE WHEN type = 'success' THEN 1 END) as success_count
        FROM notifications
        WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      `, [userId]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = NotificationService;
