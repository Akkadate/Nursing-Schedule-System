# 🧪 Postman API Testing Guide - Nursing Schedule System

## 📋 ขั้นตอนที่ 3: ทดสอบ Authentication (ขั้นแรกสุด)

### 3.1 Health Check
**Method:** `GET`
**URL:** `{{base_url}}/health`

**Headers:** ไม่ต้องใส่

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-18T10:30:00.000Z",
  "version": "1.0.0"
}
```

### 3.2 Database Health Check
**Method:** `GET`
**URL:** `{{base_url}}/health/db`

**Expected Response:**
```json
{
  "success": true,
  "message": "Database connection is healthy",
  "timestamp": "2025-01-18T10:30:00.000Z"
}
```

---

## 🔐 ขั้นตอนที่ 4: ทดสอบ Authentication

### 4.1 สร้างผู้ใช้ Admin (ครั้งแรก)
**Method:** `POST`
**URL:** `{{base_url}}/api/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "username": "admin",
  "password": "admin123456",
  "email": "admin@nursing.com",
  "first_name": "Admin",
  "last_name": "System",
  "role": "admin"
}
```

### 4.2 Login
**Method:** `POST`
**URL:** `{{base_url}}/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "username": "admin",
  "password": "admin123456"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "เข้าสู่ระบบสำเร็จ",
  "data": {
    "user": {
      "user_id": 1,
      "username": "admin",
      "email": "admin@nursing.com",
      "first_name": "Admin",
      "last_name": "System",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**⚠️ สำคัญ:** Copy `token` ไปใส่ใน Environment Variable `auth_token`

### 4.3 ตั้งค่า Auto Token (สำหรับความสะดวก)
1. ไปที่ Request **Login**
2. คลิกแท็บ **"Tests"**
3. ใส่ Script:
```javascript
if (pm.response.json().success) {
    pm.environment.set("auth_token", pm.response.json().data.token);
}
```
4. Save

---

## 📚 ขั้นตอนที่ 5: ทดสอบ Activity Types (เริ่มต้นง่าย)

### 5.1 สร้าง Activity Type ใหม่
**Method:** `POST`
**URL:** `{{base_url}}/api/activity-types`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "type_name": "ปฐมนิเทศ",
  "type_code": "ORIENTATION",
  "description": "การแนะนำและเตรียมความพร้อมก่อนฝึกปฏิบัติ",
  "default_duration_hours": 2.0,
  "color_code": "#4285F4"
}
```

### 5.2 ดู Activity Types ทั้งหมด
**Method:** `GET`
**URL:** `{{base_url}}/api/activity-types`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

### 5.3 ดู Activity Types ที่ Active
**Method:** `GET`
**URL:** `{{base_url}}/api/activity-types/active`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

---

## 🏥 ขั้นตอนที่ 6: ทดสอบ Locations

### 6.1 สร้าง Location
**Method:** `POST`
**URL:** `{{base_url}}/api/locations`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "location_name": "โรงพยาบาลศิริราช",
  "location_code": "SIRIRAJ",
  "location_type": "hospital",
  "address": "2 ถนนวังหลัง แขวงศิริราช เขตบางกอกน้อย กรุงเทพมหานคร 10700",
  "contact_person": "พยาบาลหัวหน้า สมใจ",
  "contact_phone": "02-419-7000",
  "contact_email": "contact@si.mahidol.ac.th",
  "capacity": 30,
  "facilities": "ห้องผ่าตัด, ICU, ห้องฉุกเฉิน, หอผู้ป่วยทั่วไป"
}
```

### 6.2 ดู Locations ทั้งหมด
**Method:** `GET`
**URL:** `{{base_url}}/api/locations`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

**Query Parameters:**
- `page`: 1
- `limit`: 10
- `search`: (ปล่อยว่าง)

---

## 📖 ขั้นตอนที่ 7: ทดสอบ Courses

### 7.1 สร้าง Course
**Method:** `POST`
**URL:** `{{base_url}}/api/courses`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "course_code": "NUR301",
  "course_name": "การพยาบาลผู้ใหญ่ 1",
  "course_name_en": "Adult Nursing 1",
  "credit_hours": 6,
  "theory_hours": 3,
  "practice_hours": 3,
  "description": "การพยาบาลผู้ใหญ่ที่มีปัญหาสุขภาพเรื้อรัง",
  "year_level": 3,
  "semester": 1
}
```

### 7.2 ดู Courses ทั้งหมด
**Method:** `GET`
**URL:** `{{base_url}}/api/courses`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

---

## 👨‍🏫 ขั้นตอนที่ 8: ทดสอบ Instructors

### 8.1 สร้าง User สำหรับ Instructor ก่อน
**Method:** `POST`
**URL:** `{{base_url}}/api/users`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "username": "instructor01",
  "password": "instructor123",
  "email": "instructor01@nursing.com",
  "first_name": "ดร.สมชาย",
  "last_name": "ใจดี",
  "role": "instructor"
}
```

### 8.2 สร้าง Instructor Profile
**Method:** `POST`
**URL:** `{{base_url}}/api/instructors`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "user_id": 2,
  "instructor_code": "INST001",
  "title": "ผู้ช่วยศาสตราจารย์",
  "department": "ภาควิชาการพยาบาลผู้ใหญ่",
  "specialization": "การพยาบาลผู้ป่วยวิกฤต",
  "max_students_per_session": 15
}
```

### 8.3 ดู Instructors ทั้งหมด
**Method:** `GET`
**URL:** `{{base_url}}/api/instructors`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

---

## 📅 ขั้นตอนที่ 9: ทดสอบ Schedules (สำคัญที่สุด)

### 9.1 สร้าง Schedule
**Method:** `POST`
**URL:** `{{base_url}}/api/schedules`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "course_id": 1,
  "activity_type_id": 1,
  "instructor_id": 1,
  "location_id": 1,
  "schedule_date": "2025-01-25",
  "start_time": "08:00:00",
  "end_time": "16:00:00",
  "max_students": 20,
  "description": "การฝึกปฏิบัติการพยาบาลผู้ใหญ่ในหอผู้ป่วย"
}
```

### 9.2 ทดสอบ Conflict Detection
สร้าง Schedule ซ้ำแล้วดูว่าระบบจับได้หรือไม่:

**Method:** `POST`
**URL:** `{{base_url}}/api/schedules`

**Body (เหมือนเดิม):** จะต้องได้ Error

### 9.3 ดู Schedules ทั้งหมด
**Method:** `GET`
**URL:** `{{base_url}}/api/schedules`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

### 9.4 ดู Calendar Data
**Method:** `GET`
**URL:** `{{base_url}}/api/schedules/calendar`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

**Query Parameters:**
- `startDate`: 2025-01-01
- `endDate`: 2025-01-31

---

## 🎯 ขั้นตอนที่ 10: ทดสอบ Students & Groups

### 10.1 สร้าง Section
**Method:** `POST`
**URL:** `{{base_url}}/api/sections`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "section_name": "พยาบาลศาสตร์ ชั้นปีที่ 3 หมู่ 1",
  "section_code": "NUR3-01",
  "year_level": 3,
  "academic_year": "2568/2569",
  "semester": 1,
  "capacity": 40
}
```

### 10.2 สร้าง Group
**Method:** `POST`
**URL:** `{{base_url}}/api/groups`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "section_id": 1,
  "group_name": "กลุ่ม A",
  "group_code": "A",
  "capacity": 20
}
```

### 10.3 สร้าง Student
**Method:** `POST`
**URL:** `{{base_url}}/api/students`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "student_code": "6301234567",
  "first_name": "สมศรี",
  "last_name": "ใจดี",
  "email": "somsri@student.nursing.com",
  "phone": "081-234-5678",
  "section_id": 1,
  "group_id": 1,
  "year_level": 3
}
```

---

## 📊 ขั้นตอนที่ 11: ทดสอบ Attendance

### 11.1 สร้าง Schedule Groups (จับคู่กลุ่มกับตาราง)
**Method:** `POST`
**URL:** `{{base_url}}/api/schedules/1/groups`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "group_ids": [1]
}
```

### 11.2 สร้าง Attendance List
**Method:** `GET`
**URL:** `{{base_url}}/api/attendance/schedule/1/generate`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

### 11.3 บันทึกการเข้าร่วม
**Method:** `POST`
**URL:** `{{base_url}}/api/attendance`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "schedule_id": 1,
  "student_id": 1,
  "status": "present",
  "check_in_time": "2025-01-25T08:15:00",
  "check_out_time": "2025-01-25T16:00:00",
  "score": 85,
  "notes": "เข้าร่วมครบถ้วน มีส่วนร่วมดี"
}
```

---

## 🔔 ขั้นตอนที่ 12: ทดสอบ Notifications

### 12.1 ดู Notifications
**Method:** `GET`
**URL:** `{{base_url}}/api/notifications`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

### 12.2 ทำเครื่องหมายอ่านแล้ว
**Method:** `PUT`
**URL:** `{{base_url}}/api/notifications/1/read`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

---

## 📈 ขั้นตอนที่ 13: ทดสอบ Reports

### 13.1 รายงานการเข้าร่วม
**Method:** `GET`
**URL:** `{{base_url}}/api/reports/attendance`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

**Query Parameters:**
- `startDate`: 2025-01-01
- `endDate`: 2025-01-31

### 13.2 รายงานภาระงานอาจารย์
**Method:** `GET`
**URL:** `{{base_url}}/api/reports/instructor-workload`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

### 13.3 Dashboard Stats
**Method:** `GET`
**URL:** `{{base_url}}/api/reports/dashboard-stats`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

---

## ⚙️ ขั้นตอนที่ 14: ทดสอบ Settings

### 14.1 สร้างการตั้งค่าเริ่มต้น
**Method:** `GET`
**URL:** `{{base_url}}/api/settings/defaults`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

### 14.2 ดูการตั้งค่าทั้งหมด
**Method:** `GET`
**URL:** `{{base_url}}/api/settings`

**Headers:**
```
Authorization: Bearer {{auth_token}}
```

### 14.3 แก้ไขการตั้งค่า
**Method:** `PUT`
**URL:** `{{base_url}}/api/settings/max_students_per_instructor`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{auth_token}}
```

**Body (JSON):**
```json
{
  "setting_value": "20"
}
```

---

## 🎯 Tips สำหรับมือใหม่

### 1. การจัดระเบียบ Requests
- สร้าง Folder ใน Collection:
  - Authentication
  - Activity Types
  - Locations
  - Courses
  - Instructors
  - Schedules
  - Attendance
  - Reports
  - Settings

### 2. การใช้ Tests
เพิ่ม Script ใน Tests เพื่อตรวจสอบผลลัพธ์:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    pm.expect(pm.response.json()).to.have.property('success');
});

pm.test("Success is true", function () {
    pm.expect(pm.response.json().success).to.eql(true);
});
```

### 3. การใช้ Pre-request Scripts
เพิ่ม Script ใน Pre-request เพื่อสร้างข้อมูลแบบอัตโนมัติ:
```javascript
// สร้างวันที่แบบสุ่ม
const today = new Date();
const randomDays = Math.floor(Math.random() * 30);
const scheduleDate = new Date(today.getTime() + randomDays * 24 * 60 * 60 * 1000);
pm.environment.set("random_date", scheduleDate.toISOString().split('T')[0]);
```

### 4. การ Export/Import Collection
- Export Collection: คลิกขวาที่ Collection > Export
- Import Collection: File > Import

### 5. การ Run Collection
- คลิกขวาที่ Collection > Run Collection
- ตั้งค่า Environment และ Delay
- กด Run

---

## ⚠️ Common Issues และการแก้ไข

### 1. Token หมดอายุ
**Error:** 401 Unauthorized
**แก้ไข:** Login ใหม่และอัพเดท auth_token

### 2. Database Connection Failed
**Error:** 500 Internal Server Error
**แก้ไข:** ตรวจสอบ Database connection string

### 3. Missing Fields
**Error:** 400 Bad Request
**แก้ไข:** ตรวจสอบ Body JSON ให้ครบถ้วน

### 4. Duplicate Data
**Error:** 409 Conflict หรือ 400 Bad Request
**แก้ไข:** เปลี่ยน unique fields (เช่น student_code, location_code)

---

## 🎉 การทดสอบสมบูรณ์

เมื่อทดสอบทุกขั้นตอนแล้ว คุณควรมี:
- ✅ Activity Types: 1+ รายการ
- ✅ Locations: 1+ รายการ  
- ✅ Courses: 1+ รายการ
- ✅ Instructors: 1+ รายการ
- ✅ Sections & Groups: 1+ รายการ
- ✅ Students: 1+ รายการ
- ✅ Schedules: 1+ รายการ
- ✅ Attendance: 1+ รายการ
- ✅ Notifications: มีการแจ้งเตือน
- ✅ Reports: ข้อมูลสถิติ
- ✅ Settings: การตั้งค่าระบบ

**🎯 หาก Phase 3 ทำงานได้หมดแล้ว = พร้อม Phase 4 Frontend!**
