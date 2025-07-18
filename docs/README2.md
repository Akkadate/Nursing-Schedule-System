# 🏥 ระบบจัดตารางฝึกปฏิบัติ - นักศึกษาพยาบาล

Backend สำหรับระบบจัดการตารางการฝึกปฏิบัติของนักศึกษาพยาบาล

## 🚀 การติดตั้งครั้งแรก

### 1. สร้างโครงสร้างโฟลเดอร์

```bash
mkdir nursing-schedule-backend
cd nursing-schedule-backend
mkdir -p src/config src/middleware src/utils logs
```

### 2. สร้างไฟล์ทั้งหมด

Copy โค้ดจาก artifacts ทั้งหมดไปสร้างไฟล์ตามโครงสร้าง:

```
nursing-schedule-backend/
├── package.json                 ← Copy จาก artifact "📦 package.json"
├── .env                        ← Copy จาก artifact "🔧 .env"
├── server.js                   ← Copy จาก artifact "🚀 server.js"
├── .gitignore                  ← Copy จาก artifact "🚫 .gitignore"
├── README.md                   ← Copy จาก artifact "📚 README.md"
└── src/
    ├── config/
    │   ├── database.js         ← Copy จาก artifact "🗄️ src/config/database.js"
    │   └── auth.js             ← Copy จาก artifact "🔐 src/config/auth.js"
    ├── middleware/
    │   ├── auth.js             ← Copy จาก artifact "🛡️ src/middleware/auth.js"
    │   ├── validation.js       ← Copy จาก artifact "✅ src/middleware/validation.js"
    │   └── errorHandler.js     ← Copy จาก artifact "⚠️ src/middleware/errorHandler.js"
    └── utils/
        └── logger.js           ← Copy จาก artifact "📝 src/utils/logger.js"
```

### 3. ติดตั้ง Dependencies

```bash
npm install
```

### 4. รันระบบ

```bash
# Development mode (รันครั้งแรก)
npm run dev
```

### 5. ทดสอบระบบ

เปิดเบราว์เซอร์ไปที่:
- `http://localhost:7110/health` - Health check
- `http://localhost:7110/api` - API info

## 📋 สถานะปัจจุบัน

- ✅ **Phase 1**: Backend Foundation (เสร็จสิ้น)
- 🔄 **Phase 2**: Core API Development (ถัดไป)

## 🛠 Technology Stack

- **Node.js** + **Express.js**
- **PostgreSQL** 
- **JWT Authentication**
- **Winston Logging**
- **Express Validator**

## 🔧 Environment Variables

แก้ไข `.env` ตามการตั้งค่าของคุณ:
- Database connection (อยู่ใน remote.devapp.cc แล้ว)
- JWT Secret (แนะนำเปลี่ยนเป็นอันใหม่)
- Port และ URL ต่างๆ

## 📞 ขั้นตอนถัดไป

หลังจากรันระบบได้แล้ว พร้อมเริ่ม **Phase 2: Core API Development**:
1. Authentication API
2. User Management API  
3. Student Management API
4. Section & Group Management API

---

พัฒนาด้วย ❤️ สำหรับนักศึกษาพยาบาล
