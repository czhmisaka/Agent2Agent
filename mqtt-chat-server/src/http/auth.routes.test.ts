import request from 'supertest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// 使用临时测试数据库 - 在导入数据库模块之前设置
const TEST_DB_PATH = path.resolve(__dirname, '../../test-data/auth-routes-test.db');
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';

// 现在导入数据库模块
import { initDatabase, getDatabase, closeDatabase } from '../database/sqlite';

// 真实的 HTTP 服务器设置
let app: express.Express;
let server: http.Server;

describe('Auth Routes', () => {
  const testUser = {
    id: 'test-user-id-123',
    username: 'testuser',
    password: 'TestPassword123'
  };

  beforeAll(async () => {
    // 确保测试目录存在
    const testDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 设置环境变量使用测试数据库
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';

    // 初始化数据库
    initDatabase();
    const db = getDatabase();

    // 创建测试用户
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
      testUser.id, testUser.username, passwordHash
    );

    // 创建 Express 应用
    app = express();
    app.use(express.json());

    // 健康检查路由
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    });

    // 注册路由
    app.post('/api/users/register', async (req, res) => {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: 'Invalid username', details: 'Username must be at least 3 characters long' });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Invalid username', details: 'Username can only contain letters, numbers, and underscores' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Invalid password', details: 'Password must be at least 8 characters long' });
      }

      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ error: 'Invalid password', details: 'Password must contain at least one lowercase letter' });
      }

      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ error: 'Invalid password', details: 'Password must contain at least one uppercase letter' });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Invalid password', details: 'Password must contain at least one number' });
      }

      try {
        const db = getDatabase();
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
          return res.status(400).json({ error: 'Username already exists' });
        }

        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);
        db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId, username, passwordHash);

        res.json({ success: true, userId, username });
      } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
      }
    });

    // 登录路由
    app.post('/api/users/login', async (req, res) => {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      try {
        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

        if (!user) {
          return res.status(401).json({ error: 'Username or password incorrect' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return res.status(401).json({ error: 'Username or password incorrect' });
        }

        const token = jwt.sign(
          { userId: user.id, username: user.username },
          process.env.JWT_SECRET!,
          { expiresIn: '7d' }
        );

        res.json({ success: true, userId: user.id, username: user.username, token });
      } catch (error: any) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Login failed: ' + error.message });
      }
    });

    // 获取当前用户路由
    app.get('/api/users/me', (req, res) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : 
                    req.cookies?.auth_token;

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const db = getDatabase();
        const user = db.prepare('SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?').get(decoded.userId) as any;

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
      }
    });

    // 启动服务器
    server = app.listen(14075);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    closeDatabase();
    // 清理测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    delete process.env.DB_PATH;
    delete process.env.JWT_SECRET;
  });

  describe('POST /api/users/register', () => {
    it('should reject duplicate username', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: testUser.username, password: 'Test1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username already exists');
    });

    it('should reject invalid username (too short)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'ab', password: 'Test1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid username');
      expect(response.body.details).toContain('Username must be at least 3 characters long');
    });

    it('should reject invalid username (special characters)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'user@name', password: 'Test1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid username');
      expect(response.body.details).toContain('letters, numbers, and underscores');
    });

    it('should reject weak password (too short)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'short1A' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('at least 8 characters');
    });

    it('should reject weak password (no lowercase)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'UPPERCASE123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('lowercase');
    });

    it('should reject weak password (no uppercase)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'lowercase123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('uppercase');
    });

    it('should reject weak password (no number)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'NoNumbersA' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('number');
    });
  });

  describe('POST /api/users/login', () => {
    it('should login user successfully', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: testUser.username, password: testUser.password });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.username).toBe(testUser.username);
      expect(response.body.token).toBeDefined();
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'nonexistent', password: 'somepassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Username or password incorrect');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: testUser.username, password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Username or password incorrect');
    });

    it('should reject missing username', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ password: 'somepassword' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });
  });

  describe('GET /api/users/me', () => {
    let validToken: string;

    beforeAll(() => {
      validToken = jwt.sign(
        { userId: testUser.id, username: testUser.username },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
    });

    it('should return user info for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testUser.id);
      expect(response.body.username).toBe(testUser.username);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 404 if user not found', async () => {
      const ghostToken = jwt.sign(
        { userId: 'nonexistent-id', username: 'ghost' },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${ghostToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
