# ระบบจัดตารางฝึกปฏิบัติ - นักศึกษาพยาบาล

## ข้อมูลโปรเจค
- **ชื่อระบบ**: ระบบจัดตารางเรียนตารางสอนวิชาภาคปฏิบัติ นักศึกษาพยาบาล
- **Backend**: Node.js + Express (Port: 7110)
- **Frontend**: Vanilla JavaScript (Port: 7210)
- **Database**: PostgreSQL (remote.devapp.cc)
- **Web Server**: NGINX
- **Authentication**: JWT Token

## User Roles และสิทธิ์

### 1. Admin
- เข้าถึงได้ทุกหน้า
- จัดการข้อมูลนักศึกษา Section และกลุ่มย่อย
- จัดการข้อมูลอาจารย์และสถานที่ฝึก
- สร้างและแก้ไขตารางการฝึกปฏิบัติ
- กำหนดการจับคู่ กลุ่มนักศึกษา-อาจารย์-สถานที่
- ดูตารางนักศึกษาแทนนักศึกษา (นักศึกษาไม่มีหน้าใช้งานเอง)
- ออกรายงานต่างๆ
- จัดการผู้ใช้งานระบบ

### 2. Instructor (อาจารย์)
- ดูตารางการดูแล/สอนของตนเอง
- ดูรายชื่อนักศึกษาที่อยู่ในความดูแล
- อัพเดทสถานะการเข้าร่วมกิจกรรม
- บันทึกผลการประเมิน
- ดูข้อมูลเฉพาะที่เกี่ยวข้องกับตนเอง

### 3. นักศึกษา (ไม่มีหน้าใช้งาน)
- Admin จะดูข้อมูลตารางของนักศึกษาแทน
- ไม่มีการ login สำหรับนักศึกษา

## หน้าจอหลัก

### Admin Dashboard
- **ภาพรวมระบบ**: จำนวนนักศึกษา, อาจารย์, ตารางการฝึก
- **ตารางใกล้จะถึง**: กิจกรรมในสัปดาห์นี้
- **การแจ้งเตือน**: ตารางที่มีความขัดแย้ง, การเปลี่ยนแปลง
- **สถิติการใช้งาน**: การใช้สถานที่, ภาระงานอาจารย์

### Instructor Dashboard  
- **ตารางสอนของตนเอง**: Calendar view และ List view
- **รายชื่อนักศึกษา**: นักศึกษาในกลุ่มที่ดูแล
- **กิจกรรมใกล้จะถึง**: ตารางใน 7 วันข้างหน้า
- **การแจ้งเตือน**: การเปลี่ยนแปลงตาราง

### หน้าจัดการข้อมูล (Admin)

#### Schedule Management
- **Calendar View**: ใช้ FullCalendar.js
- **List View**: ตารางรายการพร้อม filter
- **Create/Edit Schedule**: ฟอร์มสร้าง/แก้ไขตาราง
- **Conflict Detection**: ตรวจสอบความขัดแย้ง

#### Student Management
- **Student List**: รายชื่อนักศึกษาทั้งหมด
- **Section Management**: จัดการหมู่เรียน
- **Group Management**: จัดการกลุ่มย่อย
- **Student Profile**: ข้อมูลรายบุคคล

#### Instructor Management
- **Instructor List**: รายชื่ออาจารย์
- **Instructor Profile**: ข้อมูลอาจารย์
- **Schedule Assignment**: กำหนดตารางสอน
- **Workload Report**: รายงานภาระงาน

#### Course & Location Management
- **Course Management**: จัดการวิชา
- **Activity Types**: ประเภทกิจกรรม (ปฐมนิเทศ/ฝึก/สอบ)
- **Location Management**: จัดการสถานที่ฝึก

## Database Schema

### 1. ตารางผู้ใช้งาน
```sql
-- users - ผู้ใช้งานหลัก
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'instructor')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่ม indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- เพิ่ม comments
COMMENT ON TABLE users IS 'ตารางผู้ใช้งานระบบ (Admin และ Instructor)';
COMMENT ON COLUMN users.role IS 'บทบาทผู้ใช้: admin, instructor';
COMMENT ON COLUMN users.status IS 'สถานะผู้ใช้: active, inactive';
```

### 2. ตารางนักศึกษา
```sql
-- sections - หมู่เรียน
CREATE TABLE sections (
    section_id SERIAL PRIMARY KEY,
    section_name VARCHAR(100) NOT NULL,
    section_code VARCHAR(20) UNIQUE NOT NULL,
    year_level INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 4),
    academic_year VARCHAR(9) NOT NULL, -- เช่น 2568/2569
    semester INTEGER NOT NULL CHECK (semester IN (1, 2, 3)),
    capacity INTEGER DEFAULT 0,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- groups - กลุ่มย่อย
CREATE TABLE groups (
    group_id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES sections(section_id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL,
    group_code VARCHAR(20) NOT NULL,
    capacity INTEGER DEFAULT 0,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, group_code)
);

-- students - นักศึกษา
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    student_code VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    section_id INTEGER REFERENCES sections(section_id),
    group_id INTEGER REFERENCES groups(group_id),
    year_level INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 4),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'dropped')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่ม indexes
CREATE INDEX idx_sections_year_level ON sections(year_level);
CREATE INDEX idx_sections_academic_year ON sections(academic_year);
CREATE INDEX idx_groups_section_id ON groups(section_id);
CREATE INDEX idx_students_section_id ON students(section_id);
CREATE INDEX idx_students_group_id ON students(group_id);
CREATE INDEX idx_students_student_code ON students(student_code);

-- เพิ่ม comments
COMMENT ON TABLE sections IS 'หมู่เรียนนักศึกษา';
COMMENT ON TABLE groups IS 'กลุ่มย่อยในแต่ละหมู่เรียน';
COMMENT ON TABLE students IS 'ข้อมูลนักศึกษา';
```

### 3. ตารางอาจารย์
```sql
-- instructors - อาจารย์
CREATE TABLE instructors (
    instructor_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    instructor_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(50), -- อาจารย์, ผู้ช่วยศาสตราจารย์, ฯลฯ
    department VARCHAR(100),
    specialization TEXT,
    max_students_per_session INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่ม indexes
CREATE INDEX idx_instructors_user_id ON instructors(user_id);
CREATE INDEX idx_instructors_instructor_code ON instructors(instructor_code);
CREATE INDEX idx_instructors_department ON instructors(department);

-- เพิ่ม comments
COMMENT ON TABLE instructors IS 'ข้อมูลอาจารย์ผู้สอน';
COMMENT ON COLUMN instructors.max_students_per_session IS 'จำนวนนักศึกษาสูงสุดที่ดูแลได้ต่อครั้ง';
```

### 4. ตารางวิชาและกิจกรรม
```sql
-- courses - วิชา
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    course_name_en VARCHAR(255),
    credit_hours INTEGER NOT NULL,
    theory_hours INTEGER DEFAULT 0,
    practice_hours INTEGER DEFAULT 0,
    description TEXT,
    year_level INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 4),
    semester INTEGER NOT NULL CHECK (semester IN (1, 2, 3)),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- activity_types - ประเภทกิจกรรม
CREATE TABLE activity_types (
    activity_type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    type_code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    default_duration_hours DECIMAL(4,2) DEFAULT 0,
    color_code VARCHAR(7), -- สำหรับแสดงใน calendar เช่น #FF5733
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่มข้อมูลพื้นฐาน activity_types
INSERT INTO activity_types (type_name, type_code, description, default_duration_hours, color_code) VALUES
('ปฐมนิเทศ', 'ORIENTATION', 'การแนะนำและเตรียมความพร้อมก่อนฝึกปฏิบัติ', 2.00, '#4285F4'),
('ฝึกปฏิบัติ', 'PRACTICE', 'การฝึกปฏิบัติจริงในสถานที่ฝึก', 8.00, '#34A853'),
('สอบประมวลความรู้', 'EXAMINATION', 'การประเมินผลการเรียนรู้', 3.00, '#EA4335');

-- เพิ่ม indexes
CREATE INDEX idx_courses_course_code ON courses(course_code);
CREATE INDEX idx_courses_year_level ON courses(year_level);
CREATE INDEX idx_courses_semester ON courses(semester);
CREATE INDEX idx_activity_types_type_code ON activity_types(type_code);

-- เพิ่ม comments
COMMENT ON TABLE courses IS 'รายวิชาที่เปิดสอน';
COMMENT ON TABLE activity_types IS 'ประเภทกิจกรรมการเรียนการสอน';
```

### 5. ตารางสถานที่
```sql
-- locations - สถานที่ฝึก
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    location_name VARCHAR(255) NOT NULL,
    location_code VARCHAR(20) UNIQUE NOT NULL,
    location_type VARCHAR(50), -- hospital, clinic, community, laboratory
    address TEXT,
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    capacity INTEGER DEFAULT 0,
    facilities TEXT, -- JSON หรือ text อธิบายสิ่งอำนวยความสะดวก
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่ม indexes
CREATE INDEX idx_locations_location_code ON locations(location_code);
CREATE INDEX idx_locations_location_type ON locations(location_type);

-- เพิ่ม comments
COMMENT ON TABLE locations IS 'สถานที่ฝึกปฏิบัติ';
COMMENT ON COLUMN locations.location_type IS 'ประเภทสถานที่: hospital, clinic, community, laboratory';
```

### 6. ตารางหลัก
```sql
-- schedules - ตารางการฝึกปฏิบัติ
CREATE TABLE schedules (
    schedule_id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(course_id),
    activity_type_id INTEGER REFERENCES activity_types(activity_type_id),
    instructor_id INTEGER REFERENCES instructors(instructor_id),
    location_id INTEGER REFERENCES locations(location_id),
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_students INTEGER DEFAULT 0,
    current_students INTEGER DEFAULT 0,
    description TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- schedule_groups - การจับคู่กลุ่มกับตาราง
CREATE TABLE schedule_groups (
    schedule_group_id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(schedule_id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(group_id),
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    UNIQUE(schedule_id, group_id)
);

-- เพิ่ม indexes
CREATE INDEX idx_schedules_schedule_date ON schedules(schedule_date);
CREATE INDEX idx_schedules_course_id ON schedules(course_id);
CREATE INDEX idx_schedules_instructor_id ON schedules(instructor_id);
CREATE INDEX idx_schedules_location_id ON schedules(location_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedule_groups_schedule_id ON schedule_groups(schedule_id);
CREATE INDEX idx_schedule_groups_group_id ON schedule_groups(group_id);

-- เพิ่ม comments
COMMENT ON TABLE schedules IS 'ตารางการฝึกปฏิบัติหลัก';
COMMENT ON TABLE schedule_groups IS 'การจับคู่กลุ่มนักศึกษากับตาราง';
```

### 7. ตารางการเข้าร่วม
```sql
-- attendance - การเข้าร่วมกิจกรรม
CREATE TABLE attendance (
    attendance_id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(schedule_id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(student_id),
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    notes TEXT,
    score DECIMAL(5,2), -- คะแนนการประเมิน
    evaluation_notes TEXT,
    recorded_by INTEGER REFERENCES users(user_id),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, student_id)
);

-- เพิ่ม indexes
CREATE INDEX idx_attendance_schedule_id ON attendance(schedule_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_status ON attendance(status);

-- เพิ่ม comments
COMMENT ON TABLE attendance IS 'การเข้าร่วมและประเมินผลนักศึกษา';
COMMENT ON COLUMN attendance.score IS 'คะแนนการประเมิน (0-100)';
```

### 8. ตารางการแจ้งเตือน
```sql
-- notifications - การแจ้งเตือน
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    related_table VARCHAR(50), -- table ที่เกี่ยวข้อง เช่น schedules, students
    related_id INTEGER, -- id ของ record ที่เกี่ยวข้อง
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่ม indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- เพิ่ม comments
COMMENT ON TABLE notifications IS 'การแจ้งเตือนผู้ใช้งาน';
```

### 9. ตารางการตั้งค่า
```sql
-- system_settings - การตั้งค่าระบบ
CREATE TABLE system_settings (
    setting_id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_editable BOOLEAN DEFAULT TRUE,
    updated_by INTEGER REFERENCES users(user_id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่มการตั้งค่าพื้นฐาน
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_editable) VALUES
('max_students_per_instructor', '15', 'number', 'จำนวนนักศึกษาสูงสุดต่ออาจารย์หนึ่งคน', TRUE),
('default_session_duration', '8', 'number', 'ระยะเวลาการฝึกปฏิบัติปกติ (ชั่วโมง)', TRUE),
('notification_enabled', 'true', 'boolean', 'เปิดใช้งานการแจ้งเตือน', TRUE),
('academic_year', '2568/2569', 'string', 'ปีการศึกษาปัจจุบัน', TRUE);

-- เพิ่ม comments
COMMENT ON TABLE system_settings IS 'การตั้งค่าระบบ';
```

### 10. ตารางประวัติการเปลี่ยนแปลง
```sql
-- audit_logs - ประวัติการเปลี่ยนแปลง
CREATE TABLE audit_logs (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER REFERENCES users(user_id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- เพิ่ม indexes
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at);

-- เพิ่ม comments
COMMENT ON TABLE audit_logs IS 'ประวัติการเปลี่ยนแปลงข้อมูล';
```

## API Endpoints

### Authentication (/auth/*)
```
POST   /auth/login                    # เข้าสู่ระบบ
POST   /auth/logout                   # ออกจากระบบ
GET    /auth/profile                  # ดูข้อมูลโปรไฟล์
PUT    /auth/profile                  # แก้ไขโปรไฟล์
POST   /auth/change-password          # เปลี่ยนรหัสผ่าน
GET    /auth/verify-token             # ตรวจสอบ token
```

### User Management (/users/*) - Admin Only
```
GET    /users                         # ดูรายชื่อผู้ใช้ทั้งหมด
GET    /users/:id                     # ดูข้อมูลผู้ใช้รายคน
POST   /users                         # เพิ่มผู้ใช้ใหม่
PUT    /users/:id                     # แก้ไขข้อมูลผู้ใช้
DELETE /users/:id                     # ลบผู้ใช้
PUT    /users/:id/status              # เปลี่ยนสถานะผู้ใช้
```

### Student Management (/students/*)
```
GET    /students                      # ดูรายชื่อนักศึกษาทั้งหมด
GET    /students/:id                  # ดูข้อมูลนักศึกษารายคน
POST   /students                      # เพิ่มนักศึกษาใหม่
PUT    /students/:id                  # แก้ไขข้อมูลนักศึกษา
DELETE /students/:id                  # ลบนักศึกษา
GET    /students/section/:sectionId   # ดูนักศึกษาตาม Section
GET    /students/group/:groupId       # ดูนักศึกษาตาม Group
POST   /students/import               # นำเข้าข้อมูลนักศึกษาจาก CSV
```

### Section & Group Management (/sections/*, /groups/*)
```
GET    /sections                      # ดูหมู่เรียนทั้งหมด
GET    /sections/:id                  # ดูข้อมูลหมู่เรียน
POST   /sections                      # เพิ่มหมู่เรียนใหม่
PUT    /sections/:id                  # แก้ไขหมู่เรียน
DELETE /sections/:id                  # ลบหมู่เรียน

GET    /groups                        # ดูกลุ่มทั้งหมด
GET    /groups/:id                    # ดูข้อมูลกลุ่ม
POST   /groups                        # เพิ่มกลุ่มใหม่
PUT    /groups/:id                    # แก้ไขกลุ่ม
DELETE /groups/:id                    # ลบกลุ่ม
GET    /groups/section/:sectionId     # ดูกลุ่มตาม Section
```

### Instructor Management (/instructors/*)
```
GET    /instructors                   # ดูรายชื่ออาจารย์ทั้งหมด
GET    /instructors/:id               # ดูข้อมูลอาจารย์รายคน
POST   /instructors                   # เพิ่มอาจารย์ใหม่
PUT    /instructors/:id               # แก้ไขข้อมูลอาจารย์
DELETE /instructors/:id               # ลบอาจารย์
GET    /instructors/:id/schedules     # ดูตารางสอนของอาจารย์
GET    /instructors/:id/workload      # ดูภาระงานอาจารย์
```

### Course Management (/courses/*)
```
GET    /courses                       # ดูวิชาทั้งหมด
GET    /courses/:id                   # ดูข้อมูลวิชา
POST   /courses                       # เพิ่มวิชาใหม่
PUT    /courses/:id                   # แก้ไขวิชา
DELETE /courses/:id                   # ลบวิชา
GET    /courses/year/:year            # ดูวิชาตามชั้นปี
```

### Activity Types (/activity-types/*)
```
GET    /activity-types                # ดูประเภทกิจกรรมทั้งหมด
GET    /activity-types/:id            # ดูข้อมูลประเภทกิจกรรม
POST   /activity-types                # เพิ่มประเภทกิจกรรมใหม่
PUT    /activity-types/:id            # แก้ไขประเภทกิจกรรม
DELETE /activity-types/:id            # ลบประเภทกิจกรรม
```

### Location Management (/locations/*)
```
GET    /locations                     # ดูสถานที่ทั้งหมด
GET    /locations/:id                 # ดูข้อมูลสถานที่
POST   /locations                     # เพิ่มสถานที่ใหม่
PUT    /locations/:id                 # แก้ไขสถานที่
DELETE /locations/:id                 # ลบสถานที่
GET    /locations/available           # ดูสถานที่ที่ว่าง
```

### Schedule Management (/schedules/*)
```
GET    /schedules                     # ดูตารางทั้งหมด
GET    /schedules/:id                 # ดูตารางรายการ
POST   /schedules                     # สร้างตารางใหม่
PUT    /schedules/:id                 # แก้ไขตาราง
DELETE /schedules/:id                 # ลบตาราง
GET    /schedules/calendar            # ข้อมูลสำหรับ Calendar view
GET    /schedules/instructor/:instructorId  # ตารางของอาจารย์
GET    /schedules/group/:groupId      # ตารางของกลุ่ม
GET    /schedules/conflicts           # ตรวจสอบความขัดแย้ง
POST   /schedules/bulk                # สร้างตารางหลายรายการ
GET    /schedules/date-range          # ดูตารางตามช่วงวันที่
```

### Attendance Management (/attendance/*)
```
GET    /attendance/schedule/:scheduleId     # ดูการเข้าร่วมตามตาราง
GET    /attendance/student/:studentId      # ดูการเข้าร่วมตามนักศึกษา
POST   /attendance                         # บันทึกการเข้าร่วม
PUT    /attendance/:id                     # แก้ไขการเข้าร่วม
POST   /attendance/bulk                    # บันทึกการเข้าร่วมหลายคน
GET    /attendance/report                  # รายงานการเข้าร่วม
```

### Notification Management (/notifications/*)
```
GET    /notifications                 # ดูการแจ้งเตือนของตนเอง
PUT    /notifications/:id/read        # ทำเครื่องหมายอ่านแล้ว
DELETE /notifications/:id            # ลบการแจ้งเตือน
POST   /notifications/mark-all-read   # ทำเครื่องหมายอ่านทั้งหมด
```

### Report Management (/reports/*) - Admin Only
```
GET    /reports/attendance            # รายงานการเข้าร่วม
GET    /reports/instructor-workload   # รายงานภาระงานอาจารย์
GET    /reports/location-usage        # รายงานการใช้สถานที่
GET    /reports/student-progress      # รายงานความก้าวหน้านักศึกษา
POST   /reports/custom                # สร้างรายงานแบบกำหนดเอง
```

### System Settings (/settings/*) - Admin Only
```
GET    /settings                      # ดูการตั้งค่าระบบ
PUT    /settings/:key                 # แก้ไขการตั้งค่า
GET    /settings/backup               # สำรองข้อมูล
POST   /settings/restore              # คืนค่าข้อมูล
```

## Environment Configuration

### Backend (.env)
```bash
# Database Configuration
DB_HOST=remote.devapp.cc
DB_USER=postgres
DB_PASSWORD=Tct85329$
DB_NAME=nursing_schedule_db
DB_PORT=5432

# Server Configuration
PORT=7110
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_nursing_schedule_2568
JWT_EXPIRE=24h

# CORS Configuration
FRONTEND_URL=http://localhost:7210

# File Upload Configuration
UPLOAD_MAX_SIZE=5242880
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,application/pdf

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# Notification Configuration
NOTIFICATION_ENABLED=true
NOTIFICATION_RETENTION_DAYS=30
```

### Frontend (.env)
```bash
# API Configuration
REACT_APP_API_URL=http://localhost:7110
REACT_APP_APP_NAME=ระบบจัดตารางฝึกปฏิบัติ
REACT_APP_VERSION=1.0.0

# Feature Flags
REACT_APP_ENABLE_NOTIFICATIONS=true
REACT_APP_ENABLE_REPORTS=true
REACT_APP_ENABLE_BULK_OPERATIONS=true
```

## Coding Standards

### API Response Format
```javascript
// Success Response
{
  success: true,
  message: "การดำเนินการสำเร็จ",
  data: {
    // ข้อมูลผลลัพธ์
  },
  pagination: { // สำหรับ list data
    page: 1,
    limit: 10,
    total: 100,
    totalPages: 10
  }
}

// Error Response
{
  success: false,
  message: "คำอธิบายข้อผิดพลาดเป็นภาษาไทย",
  error: "Technical error details",
  code: "ERROR_CODE" // optional
}
```

### Database Conventions
- Table names: plural และ snake_case (users, students, schedules)
- Primary keys: `table_name_id`
- Foreign keys: `referenced_table_id`
- Timestamps: `created_at`, `updated_at`
- Boolean fields: `is_` prefix (is_active, is_deleted)
- Status fields: VARCHAR with CHECK constraints

### JavaScript Conventions
- Variables: camelCase (`studentData`, `scheduleList`)
- Functions: camelCase (`getStudents`, `createSchedule`)
- Classes: PascalCase (`StudentController`, `ScheduleService`)
- Constants: UPPER_SNAKE_CASE (`MAX_STUDENTS`, `DEFAULT_TIMEOUT`)

### File Naming
- Controllers: `[name]Controller.js`
- Services: `[name]Service.js`
- Routes: `[name].js`
- Models: `[Name].js`
- Components: `[Name]Component.js`
- Pages: `[Name]Page.js`

## Development Phases

### Phase 1: Backend Foundation (1-2 วัน)
1. Database schema creation
2. Basic Express server setup
3. Authentication middleware (JWT)
4. CORS configuration
5. Environment variables setup

### Phase 2: Core API Development (3-4 วัน)
1. Authentication endpoints
2. User management API
3. Student management API
4. Instructor management API
5. Basic CRUD operations

### Phase 3: Advanced API Features (2-3 วัน)
1. Schedule management API
2. Course and location management
3. Attendance tracking
4. Conflict detection
5. Notification system

### Phase 4: Frontend Development (4-5 วัน)
1. Basic HTML structure and routing
2. Authentication pages
3. Dashboard layouts
4. Data management interfaces
5. FullCalendar integration

### Phase 5: Integration & Advanced Features (3-4 วัน)
1. Frontend-Backend integration
2. Calendar functionality
3. Reports and analytics
4. Error handling and validation
5. Performance optimization

### Phase 6: Testing & Deployment (2-3 วัน)
1. Unit and integration testing
2. User acceptance testing
3. Performance testing
4. Security testing
5. Production deployment

## Special Requirements

### ประเภทกิจกรรม
ในหนึ่งวิชา ในแต่ละช่วง จะมีประเภทกิจกรรมเกิดขึ้น:
- **ปฐมนิเทศ**: การแนะนำและเตรียมความพร้อมก่อนฝึกปฏิบัติ
- **ฝึกปฏิบัติ**: การฝึกปฏิบัติจริงในสถานที่ฝึก
- **สอบประมวลความรู้**: การประเมินผลการเรียนรู้และทักษะ

### การจับคู่ตาราง
- แต่ละวันมีสถานที่การฝึกและอาจารย์ผู้ดูแลต่างกัน
- ระบบต้องตรวจสอบความขัดแย้งของตาราง:
  - อาจารย์คนเดียวไม่สามารถสอน 2 กลุ่มในเวลาเดียวกัน
  - สถานที่เดียวไม่สามารถใช้งาน 2 กลุ่มในเวลาเดียวกัน
  - กลุ่มนักศึกษาไม่สามารถมี 2 กิจกรรมในเวลาเดียวกัน
- รองรับการแก้ไขตารางและแจ้งเตือนผู้เกี่ยวข้อง

### การแจ้งเตือน
- แจ้งเตือนเมื่อมีการเปลี่ยนแปลงตาราง
- แจ้งเตือนเมื่อตรวจพบความขัดแย้ง
- แจ้งเตือนก่อนการฝึกปฏิบัติ 1 วัน
- แจ้งเตือนเมื่อมีการเพิ่ม/ลบนักศึกษาในกลุ่ม

### การจัดการสิทธิ์
- Admin เข้าถึงได้ทุกอย่าง
- Instructor เห็นเฉพาะข้อมูลที่เกี่ยวข้องกับตนเอง
- ระบบบันทึก audit log ทุกการเปลี่ยนแปลง

### Performance Requirements
- รองรับนักศึกษาไม่เกิน 1,000 คน
- รองรับอาจารย์ไม่เกิน 100 คน
- Response time ไม่เกิน 2 วินาที
- Calendar view โหลดได้ภายใน 3 วินาที

### Security Requirements
- JWT token มีอายุ 24 ชั่วโมง
- Password ต้องมีความยาวอย่างน้อย 8 ตัวอักษร
- Rate limiting 100 requests ต่อนาทีต่อ IP
- Input validation ทุก endpoint
- SQL injection protection
- XSS protection
