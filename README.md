# 🏥 ระบบจัดตารางฝึกปฏิบัติ - นักศึกษาพยาบาล

ระบบจัดการตารางการฝึกปฏิบัติสำหรับนักศึกษาพยาบาล รองรับการจัดตาราง การตรวจสอบความขัดแย้ง และการติดตามการเข้าร่วมกิจกรรม

## 🚀 ลักษณะเด่น

- **จัดการตารางฝึกปฏิบัติ**: สร้าง แก้ไข และลบตารางการฝึกปฏิบัติ
- **ตรวจสอบความขัดแย้ง**: ตรวจสอบความขัดแย้งของตาราง อาจารย์ และสถานที่
- **การจัดการผู้ใช้**: Admin และ Instructor roles
- **ติดตามการเข้าร่วม**: บันทึกและประเมินผลการเข้าร่วมกิจกรรม
- **รายงานและสถิติ**: รายงานการใช้งานและสถิติต่างๆ
- **การแจ้งเตือน**: แจ้งเตือนการเปลี่ยนแปลงตารางและความขัดแย้ง

## 🛠 เทคโนโลยีที่ใช้

### Backend
- **Node.js** + **Express.js** - Server framework
- **PostgreSQL** - ฐานข้อมูล
- **JWT** - Authentication
- **Winston** - Logging
- **Helmet** - Security

### Frontend
- **Vanilla JavaScript** - Frontend framework
- **Bootstrap** - UI framework
- **FullCalendar.js** - Calendar component

## 📋 ข้อกำหนดระบบ

- **Node.js** >= 16.0.0
- **PostgreSQL** >= 12
- **npm** หรือ **yarn**

## 🔧 การติดตั้ง

### 1. Clone โปรเจค

```bash
git clone <repository-url>
cd nursing-schedule-system
```

### 2. ติดตั้ง Dependencies

```bash
# Backend
npm install

# Frontend (ในอนาคต)
cd frontend
npm install
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` และกำหนดค่าตามตัวอย่าง:

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
```

### 4. สร้างฐานข้อมูล

ใช้ SQL scripts ในโฟลเดอร์ `database/` เพื่อสร้างตารางและข้อมูลเริ่มต้น

### 5. รันระบบ

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📁 โครงสร้างโปรเจค

```
nursing-schedule-system/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      # Database configuration
│   │   │   └── auth.js          # JWT configuration
│   │   ├── middleware/
│   │   │   ├── auth.js          # Authentication middleware
│   │   │   ├── validation.js    # Input validation
│   │   │   └── errorHandler.js  # Error handling
│   │   ├── controllers/         # Business logic
│   │   ├── routes/             # API routes
│   │   ├── services/           # Service layer
│   │   └── utils/
│   │       └── logger.js       # Logging utility
│   ├── logs/                   # Log files
│   ├── .env                    # Environment variables
│   ├── server.js               # Main server file
│   └── package.json
├── frontend/                   # Frontend files (ในอนาคต)
├── database/                   # Database scripts
├── docs/                      # Documentation
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - เข้าสู่ระบบ
- `POST /api/auth/logout` - ออกจากระบบ
- `GET /api/auth/profile` - ดูโปรไฟล์
- `PUT /api/auth/profile` - แก้ไขโปรไฟล์

### Users (Admin only)
- `GET /api/users` - ดูรายชื่อผู้ใช้
- `POST /api/users` - เพิ่มผู้ใช้ใหม่
- `PUT /api/users/:id` - แก้ไขผู้ใช้
- `DELETE /api/users/:id` - ลบผู้ใช้

### Students
- `GET /api/students` - ดูรายชื่อนักศึกษา
- `POST /api/students` - เพิ่มนักศึกษาใหม่
- `PUT /api/students/:id` - แก้ไขข้อมูลนักศึกษา
- `DELETE /api/students/:id` - ลบนักศึกษา

### Schedules
- `GET /api/schedules` - ดูตารางทั้งหมด
- `POST /api/schedules` - สร้างตารางใหม่
- `PUT /api/schedules/:id` - แก้ไขตาราง
- `DELETE /api/schedules/:id` - ลบตาราง
- `GET /api/schedules/conflicts` - ตรวจสอบความขัดแย้ง

[ดู API Documentation เพิ่มเติม](docs/API.md)

## 👥 User Roles

### Admin
- จัดการข้อมูลทั้งหมดในระบบ
- สร้างและแก้ไขตารางการฝึกปฏิบัติ
- จัดการผู้ใช้งาน นักศึกษา และอาจารย์
- ดูรายงานและสถิติ

### Instructor
- ดูตารางการสอนของตนเอง
- ดูรายชื่อนักศึกษาในกลุ่มที่ดูแล
- บันทึกการเข้าร่วมและประเมินผล
- อัปเดตสถานะกิจกรรม

## 🔒 ความปลอดภัย

- **JWT Authentication** - ระบบยืนยันตัวตนด้วย JSON Web Token
- **CORS Protection** - ป้องกันการเข้าถึงจาก origin ที่ไม่ได้รับอนุญาต
- **Rate Limiting** - จำกัดจำนวนคำขอต่อนาทีต่อ IP
- **Helmet.js** - ป้องกัน security vulnerabilities
- **Input Validation** - ตรวจสอบข้อมูลที่เข้ามาทุก endpoint
- **SQL Injection Protection** - ใช้ parameterized queries

## 📊 Logging และ Monitoring

- **Winston Logger** - บันทึก logs ทุกการดำเนินการ
- **Request Logging** - บันทึกทุก HTTP request
- **Error Tracking** - ติดตามและบันทึก errors
- **Performance Monitoring** - ตรวจสอบ slow queries และ requests

## 🧪 การทดสอบ

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

## 🚀 การ Deploy

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker (ในอนาคต)
```bash
docker-compose up -d
```

## 📖 เอกสารเพิ่มเติม

- [API Documentation](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)

## 🤝 การสนับสนุน

หากพบปัญหาหรือต้องการคำแนะนำ:

1. ตรวจสอบ [Issues](issues) ที่มีอยู่
2. สร้าง [Issue ใหม่](issues/new) พร้อมรายละเอียด
3. ติดต่อทีมพัฒนา

## 📝 License

โปรเจคนี้ใช้ใบอนุญาต [ISC License](LICENSE)

## 🏗 สถานะการพัฒนา

- ✅ **Phase 1**: Backend Foundation (เสร็จสิ้น)
- 🔄 **Phase 2**: Core API Development (กำลังดำเนินการ)
- ⏳ **Phase 3**: Advanced API Features
- ⏳ **Phase 4**: Frontend Development
- ⏳ **Phase 5**: Integration & Testing
- ⏳ **Phase 6**: Deployment & Documentation

---

<div align="center">
  <p>พัฒนาด้วย ❤️ สำหรับนักศึกษาพยาบาล</p>
</div>
