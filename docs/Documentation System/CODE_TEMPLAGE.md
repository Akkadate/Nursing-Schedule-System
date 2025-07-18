# Code Templates และ Standards

## API Response Standards

### Success Response Template
```javascript
{
  success: true,
  message: "Operation successful", 
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
```

### Error Response Template  
```javascript
{
  success: false,
  message: "Error description in Thai",
  error: "Technical error details",
  code: "ERROR_CODE" // optional
}
```

---

## Backend Templates

### 1. Controller Template
```javascript
// controllers/[name]Controller.js
const pool = require('../config/database');

const [Name]Controller = {
  // GET /api/[name] - ดูข้อมูลทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let query = 'SELECT * FROM [table_name]';
      let params = [];
      
      if (search) {
        query += ' WHERE [search_field] ILIKE $1';
        params.push(`%${search}%`);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      // Count total for pagination
      let countQuery = 'SELECT COUNT(*) FROM [table_name]';
      let countParams = [];
      if (search) {
        countQuery += ' WHERE [search_field] ILIKE $1';
        countParams.push(`%${search}%`);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAll[Name]:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
        error: error.message
      });
    }
  },

  // GET /api/[name]/:id - ดูข้อมูลรายการเดียว
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'SELECT * FROM [table_name] WHERE [table_name]_id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลที่ต้องการ'
        });
      }
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in getById[Name]:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
        error: error.message
      });
    }
  },

  // POST /api/[name] - สร้างข้อมูลใหม่
  async create(req, res) {
    try {
      const { field1, field2, field3 } = req.body;
      
      // Validation
      if (!field1 || !field2) {
        return res.status(400).json({
          success: false,
          message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
        });
      }
      
      const result = await pool.query(
        `INSERT INTO [table_name] (field1, field2, field3, created_at, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW()) 
         RETURNING *`,
        [field1, field2, field3]
      );
      
      res.status(201).json({
        success: true,
        message: 'สร้างข้อมูลสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in create[Name]:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างข้อมูล',
        error: error.message
      });
    }
  },

  // PUT /api/[name]/:id - แก้ไขข้อมูล
  async update(req, res) {
    try {
      const { id } = req.params;
      const { field1, field2, field3 } = req.body;
      
      // Check if record exists
      const checkResult = await pool.query(
        'SELECT * FROM [table_name] WHERE [table_name]_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลที่ต้องการแก้ไข'
        });
      }
      
      const result = await pool.query(
        `UPDATE [table_name] 
         SET field1 = $1, field2 = $2, field3 = $3, updated_at = NOW()
         WHERE [table_name]_id = $4 
         RETURNING *`,
        [field1, field2, field3, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขข้อมูลสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in update[Name]:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล',
        error: error.message
      });
    }
  },

  // DELETE /api/[name]/:id - ลบข้อมูล  
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Check if record exists
      const checkResult = await pool.query(
        'SELECT * FROM [table_name] WHERE [table_name]_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลที่ต้องการลบ'
        });
      }
      
      await pool.query(
        'DELETE FROM [table_name] WHERE [table_name]_id = $1',
        [id]
      );
      
      res.json({
        success: true,
        message: 'ลบข้อมูลสำเร็จ'
      });
    } catch (error) {
      console.error('Error in delete[Name]:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบข้อมูล',
        error: error.message
      });
    }
  }
};

module.exports = [Name]Controller;
```

### 2. Route Template
```javascript
// routes/[name].js
const express = require('express');
const router = express.Router();
const [Name]Controller = require('../controllers/[name]Controller');
const authMiddleware = require('../middleware/auth');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// CRUD routes
router.get('/', [Name]Controller.getAll);           // GET /api/[name]
router.get('/:id', [Name]Controller.getById);       // GET /api/[name]/:id  
router.post('/', [Name]Controller.create);          // POST /api/[name]
router.put('/:id', [Name]Controller.update);        // PUT /api/[name]/:id
router.delete('/:id', [Name]Controller.delete);     // DELETE /api/[name]/:id

module.exports = router;
```

### 3. Middleware Template
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบ token การยืนยันตัวตน'
      });
    }
    
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token ไม่ถูกต้องหรือหมดอายุ'
    });
  }
};

// Middleware for role-based access
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้'
      });
    }
    next();
  };
};

module.exports = { authMiddleware, requireRole };
```

---

## Frontend Templates

### 1. API Service Template
```javascript
// js/services/api.js
class ApiService {
  constructor() {
    this.baseURL = 'http://localhost:7110';
    this.token = localStorage.getItem('token');
  }
  
  // Set authorization header
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }
  
  // Generic request method
  async request(url, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        headers: this.getHeaders(),
        ...options
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาด');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
  
  // CRUD methods
  async get(endpoint) {
    return this.request(endpoint);
  }
  
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT', 
      body: JSON.stringify(data)
    });
  }
  
  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
  
  // Update token
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }
  
  // Clear token
  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }
}

// Create singleton instance
const apiService = new ApiService();
```

### 2. Component Template
```javascript
// js/components/[name].js
class [Name]Component {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.data = [];
    this.init();
  }
  
  init() {
    this.render();
    this.bindEvents();
    this.loadData();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="[name]-component">
        <div class="header">
          <h2>Title</h2>
          <button class="btn btn-primary" id="add-btn">เพิ่มใหม่</button>
        </div>
        
        <div class="filters">
          <input type="text" id="search-input" placeholder="ค้นหา..." class="form-control">
        </div>
        
        <div class="content" id="data-container">
          <!-- Data will be rendered here -->
        </div>
        
        <div class="pagination" id="pagination-container">
          <!-- Pagination will be rendered here -->
        </div>
      </div>
    `;
  }
  
  bindEvents() {
    // Add button click
    this.container.querySelector('#add-btn').addEventListener('click', () => {
      this.showCreateModal();
    });
    
    // Search input
    this.container.querySelector('#search-input').addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });
  }
  
  async loadData(page = 1, search = '') {
    try {
      this.showLoading();
      
      const response = await apiService.get(`/[endpoint]?page=${page}&search=${search}`);
      
      this.data = response.data;
      this.renderData();
      this.renderPagination(response.pagination);
      
    } catch (error) {
      this.showError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Load data error:', error);
    }
  }
  
  renderData() {
    const container = this.container.querySelector('#data-container');
    
    if (this.data.length === 0) {
      container.innerHTML = '<div class="text-center">ไม่มีข้อมูล</div>';
      return;
    }
    
    const html = this.data.map(item => `
      <div class="data-item" data-id="${item.id}">
        <div class="item-content">
          <h5>${item.name}</h5>
          <p>${item.description}</p>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${item.id}">แก้ไข</button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${item.id}">ลบ</button>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
    
    // Bind item events
    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.showEditModal(e.target.dataset.id);
      });
    });
    
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.handleDelete(e.target.dataset.id);
      });
    });
  }
  
  renderPagination(pagination) {
    // Implement pagination rendering
  }
  
  showLoading() {
    this.container.querySelector('#data-container').innerHTML = 
      '<div class="text-center"><div class="spinner-border"></div></div>';
  }
  
  showError(message) {
    this.container.querySelector('#data-container').innerHTML = 
      `<div class="alert alert-danger">${message}</div>`;
  }
  
  showCreateModal() {
    // Implement create modal
  }
  
  showEditModal(id) {
    // Implement edit modal
  }
  
  async handleDelete(id) {
    if (!confirm('ต้องการลบข้อมูลนี้ใช่หรือไม่?')) return;
    
    try {
      await apiService.delete(`/[endpoint]/${id}`);
      this.loadData(); // Reload data
      alert('ลบข้อมูลสำเร็จ');
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      console.error('Delete error:', error);
    }
  }
  
  handleSearch(searchTerm) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadData(1, searchTerm);
    }, 500);
  }
}
```

### 3. Page Template
```javascript
// js/pages/[name]Page.js
class [Name]Page {
  constructor() {
    this.init();
  }
  
  init() {
    this.render();
    this.bindEvents();
    this.loadInitialData();
  }
  
  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="[name]-page">
        <div class="page-header">
          <h1>Page Title</h1>
          <nav aria-label="breadcrumb">
            <ol class="breadcrumb">
              <li class="breadcrumb-item"><a href="#dashboard">หน้าหลัก</a></li>
              <li class="breadcrumb-item active">[Name]</li>
            </ol>
          </nav>
        </div>
        
        <div class="page-content">
          <!-- Page content here -->
        </div>
      </div>
    `;
  }
  
  bindEvents() {
    // Event listeners
  }
  
  async loadInitialData() {
    // Load initial data
  }
  
  destroy() {
    // Cleanup when leaving page
  }
}
```

---

## Database Templates

### Table Creation Template
```sql
-- [table_name] table
CREATE TABLE [table_name] (
    [table_name]_id SERIAL PRIMARY KEY,
    
    -- Fields
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    
    -- Foreign keys
    -- [referenced_table]_id INTEGER REFERENCES [referenced_table]([referenced_table]_id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_[table_name]_status ON [table_name](status);
CREATE INDEX idx_[table_name]_created_at ON [table_name](created_at);

-- Comments
COMMENT ON TABLE [table_name] IS 'Table description in Thai';
COMMENT ON COLUMN [table_name].name IS 'Field description in Thai';
```

---

## Error Handling Standards

### Backend Error Types
```javascript
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// Error response helper
const sendError = (res, type, message, statusCode = 500) => {
  const errorMap = {
    [ErrorTypes.VALIDATION_ERROR]: 400,
    [ErrorTypes.NOT_FOUND]: 404,
    [ErrorTypes.UNAUTHORIZED]: 401,
    [ErrorTypes.FORBIDDEN]: 403,
    [ErrorTypes.DATABASE_ERROR]: 500,
    [ErrorTypes.INTERNAL_ERROR]: 500
  };
  
  res.status(statusCode || errorMap[type]).json({
    success: false,
    message: message,
    error: type
  });
};
```

### Frontend Error Handling
```javascript
// Error display helper
const showError = (message, duration = 5000) => {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-danger alert-dismissible';
  errorDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.querySelector('.alerts-container').appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, duration);
};

// Success message helper
const showSuccess = (message, duration = 3000) => {
  const successDiv = document.createElement('div');
  successDiv.className = 'alert alert-success alert-dismissible';
  successDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.querySelector('.alerts-container').appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
  }, duration);
};
```

---

## Naming Conventions

### Files
- Controllers: `[name]Controller.js` (camelCase)
- Services: `[name]Service.js` (camelCase)
- Routes: `[name].js` (lowercase)
- Pages: `[name]Page.js` (camelCase)
- Components: `[name]Component.js` (camelCase)

### Database
- Tables: `table_name` (snake_case, plural)
- Columns: `column_name` (snake_case)
- Primary keys: `table_name_id`
- Foreign keys: `referenced_table_id`

### JavaScript
- Variables: `variableName` (camelCase)
- Functions: `functionName` (camelCase)
- Classes: `ClassName` (PascalCase)
- Constants: `CONSTANT_NAME` (UPPER_SNAKE_CASE)

### API Endpoints
- `GET /api/resource` - List all
- `GET /api/resource/:id` - Get by ID
- `POST /api/resource` - Create new
- `PUT /api/resource/:id` - Update
- `DELETE /api/resource/:id` - Delete
