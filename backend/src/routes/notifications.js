const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/notifications - ดูการแจ้งเตือนทั้งหมด (ทุกคน)
router.get('/', 
  [
    require('express-validator').query('isRead')
      .optional()
      .isBoolean()
      .withMessage('isRead ต้องเป็น true หรือ false'),
    require('express-validator').query('type')
      .optional()
      .isIn(['general', 'schedule', 'attendance', 'system', 'urgent'])
      .withMessage('ประเภทการแจ้งเตือนไม่ถูกต้อง')
  ],
  validationRules.pagination,
  handleValidationErrors,
  notificationController.getAll
);

// GET /api/notifications/unread-count - นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน (ทุกคน)
router.get('/unread-count', 
  notificationController.getUnreadCount
);

// PUT /api/notifications/:id/read - ทำเครื่องหมายว่าอ่านแล้ว (ทุกคน)
router.put('/:id/read', 
  validationRules.idParam,
  handleValidationErrors,
  notificationController.markAsRead
);

// PUT /api/notifications/mark-all-read - ทำเครื่องหมายอ่านทั้งหมด (ทุกคน)
router.put('/mark-all-read', 
  notificationController.markAllAsRead
);

// POST /api/notifications - สร้างการแจ้งเตือนใหม่ (admin only)
router.post('/', 
  requireAdmin,
  [
    require('express-validator').body('title')
      .notEmpty()
      .withMessage('กรุณากรอกหัวข้อการแจ้งเตือน')
      .isLength({ max: 200 })
      .withMessage('หัวข้อไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('message')
      .notEmpty()
      .withMessage('กรุณากรอกข้อความการแจ้งเตือน')
      .isLength({ max: 1000 })
      .withMessage('ข้อความไม่เกิน 1000 ตัวอักษร'),
    require('express-validator').body('type')
      .isIn(['general', 'schedule', 'attendance', 'system', 'urgent'])
      .withMessage('ประเภทการแจ้งเตือนต้องเป็น general, schedule, attendance, system หรือ urgent'),
    require('express-validator').body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('ความสำคัญต้องเป็น low, normal, high หรือ urgent'),
    require('express-validator').body('recipientUserId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Recipient User ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').body('scheduleId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Schedule ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  notificationController.create
);

// POST /api/notifications/broadcast - ส่งการแจ้งเตือนแบบ broadcast (admin only)
router.post('/broadcast', 
  requireAdmin,
  [
    require('express-validator').body('title')
      .notEmpty()
      .withMessage('กรุณากรอกหัวข้อการแจ้งเตือน')
      .isLength({ max: 200 })
      .withMessage('หัวข้อไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('message')
      .notEmpty()
      .withMessage('กรุณากรอกข้อความการแจ้งเตือน')
      .isLength({ max: 1000 })
      .withMessage('ข้อความไม่เกิน 1000 ตัวอักษร'),
    require('express-validator').body('type')
      .isIn(['general', 'schedule', 'attendance', 'system', 'urgent'])
      .withMessage('ประเภทการแจ้งเตือนต้องเป็น general, schedule, attendance, system หรือ urgent'),
    require('express-validator').body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('ความสำคัญต้องเป็น low, normal, high หรือ urgent'),
    require('express-validator').body('targetRole')
      .optional()
      .isIn(['admin', 'instructor'])
      .withMessage('Target role ต้องเป็น admin หรือ instructor'),
    require('express-validator').body('targetSectionId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Target Section ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').body('targetGroupId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Target Group ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  notificationController.broadcast
);

// DELETE /api/notifications/:id - ลบการแจ้งเตือน (admin only)
router.delete('/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  notificationController.delete
);

// POST /api/notifications/schedule-reminder - สร้างการแจ้งเตือนสำหรับตาราง (admin และ instructor)
router.post('/schedule-reminder', 
  requireAdminOrInstructor,
  [
    require('express-validator').body('scheduleId')
      .isInt({ min: 1 })
      .withMessage('กรุณาระบุ Schedule ID'),
    require('express-validator').body('reminderType')
      .isIn(['upcoming', 'changed', 'cancelled'])
      .withMessage('ประเภทการแจ้งเตือนต้องเป็น upcoming, changed หรือ cancelled'),
    require('express-validator').body('customMessage')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('ข้อความกำหนดเองไม่เกิน 1000 ตัวอักษร')
  ],
  handleValidationErrors,
  notificationController.createScheduleReminder
);

// GET /api/notifications/types - ดูประเภทการแจ้งเตือนทั้งหมด (ทุกคน)
router.get('/types', 
  notificationController.getNotificationTypes
);

module.exports = router;
