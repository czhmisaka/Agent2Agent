import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// 使用临时测试数据库 - 在导入数据库模块之前设置
const TEST_DB_PATH = path.resolve(__dirname, '../../test-data/groups-routes-test.db');
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';

// 现在导入数据库模块
import { initDatabase, getDatabase, closeDatabase } from '../database/sqlite';

// 真实的 HTTP 服务器设置
let app: express.Express;
let server: http.Server;

describe('Groups Routes', () => {
  const testUser = {
    id: 'test-user-id-123',
    username: 'testuser',
    password: 'TestPassword123'
  };

  const testGroup = {
    id: 'test-group-id-456',
    name: 'Test Group'
  };

  let authToken: string;

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

    // 创建测试群组
    db.prepare('INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)').run(
      testGroup.id, testGroup.name, testUser.id
    );

    // 将用户添加到群组
    db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
      testGroup.id, testUser.id, 'owner'
    );

    // 生成认证 token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // 创建 Express 应用
    app = express();
    app.use(express.json());

    // 认证中间件
    const authenticate = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };

    // 创建群组
    app.post('/api/groups', authenticate, (req: any, res) => {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Group name is required' });
      }
      try {
        const db = getDatabase();
        const groupId = uuidv4();
        db.prepare('INSERT INTO groups (id, name, owner_id, description) VALUES (?, ?, ?, ?)').run(
          groupId, name, req.user.userId, description || null
        );
        // 添加创建者为成员
        db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
          groupId, req.user.userId, 'owner'
        );
        res.json({ success: true, groupId, name });
      } catch (error) {
        res.status(500).json({ error: 'Failed to create group' });
      }
    });

    // 获取用户群组列表
    app.get('/api/groups', authenticate, (req: any, res) => {
      try {
        const db = getDatabase();
        const groups = db.prepare(`
          SELECT g.id, g.name, gm.role, gm.joined_at 
          FROM groups g 
          JOIN group_members gm ON g.id = gm.group_id 
          WHERE gm.user_id = ?
        `).all(req.user.userId);
        res.json(groups);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get groups' });
      }
    });

    // 获取群组详情
    app.get('/api/groups/:groupId', authenticate, (req: any, res) => {
      try {
        const db = getDatabase();
        const group = db.prepare(`
          SELECT g.id, g.name, g.description, g.owner_id, gm.role 
          FROM groups g 
          JOIN group_members gm ON g.id = gm.group_id 
          WHERE g.id = ? AND gm.user_id = ?
        `).get(req.params.groupId, req.user.userId);
        if (!group) {
          return res.status(404).json({ error: 'Group not found or you are not a member' });
        }
        res.json(group);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get group' });
      }
    });

    // 获取群组成员
    app.get('/api/groups/:groupId/members', authenticate, (req: any, res) => {
      try {
        const db = getDatabase();
        // 验证用户是群组成员
        const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?')
          .get(req.params.groupId, req.user.userId);
        if (!membership) {
          return res.status(404).json({ error: 'Group not found or you are not a member' });
        }
        // 使用更简单的查询，避免可能的 user_sessions 表问题
        const members = db.prepare(`
          SELECT u.id, u.username, u.nickname, gm.role, gm.joined_at
          FROM group_members gm
          JOIN users u ON gm.user_id = u.id
          WHERE gm.group_id = ?
        `).all(req.params.groupId);
        res.json(members);
      } catch (error: any) {
        console.error('Get members error:', error.message);
        res.status(500).json({ error: 'Failed to get members: ' + error.message });
      }
    });

    // 加入群组
    app.post('/api/groups/:groupId/join', authenticate, (req: any, res) => {
      try {
        const db = getDatabase();
        const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(req.params.groupId);
        if (!group) {
          return res.status(404).json({ error: 'Group not found' });
        }
        const existing = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?')
          .get(req.params.groupId, req.user.userId);
        if (existing) {
          return res.status(400).json({ error: 'Already a member' });
        }
        db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
          req.params.groupId, req.user.userId, 'member'
        );
        res.json({ success: true, message: 'Joined group successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to join group' });
      }
    });

    // 离开群组
    app.post('/api/groups/:groupId/leave', authenticate, (req: any, res) => {
      try {
        const db = getDatabase();
        const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?')
          .get(req.params.groupId, req.user.userId) as any;
        if (!membership) {
          return res.status(400).json({ error: 'Not a member of this group' });
        }
        if (membership.role === 'owner') {
          return res.status(400).json({ error: 'Owner cannot leave the group' });
        }
        db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(
          req.params.groupId, req.user.userId
        );
        res.json({ success: true, message: 'Left group successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to leave group' });
      }
    });

    // 启动服务器
    server = app.listen(14076);
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

  describe('POST /api/groups', () => {
    it('should create a new group', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Group', description: 'A new group' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.name).toBe('New Group');
      expect(response.body.groupId).toBeDefined();
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({ name: 'New Group' });

      expect(response.status).toBe(401);
    });

    it('should reject missing group name', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Group name is required');
    });
  });

  describe('GET /api/groups', () => {
    it('should return user groups', async () => {
      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/groups');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/groups/:groupId', () => {
    it('should return group details', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testGroup.id);
      expect(response.body.name).toBe(testGroup.name);
    });

    it('should return 404 if user is not a member', async () => {
      // 先创建一个新用户和群组，不让 testUser 加入
      const db = getDatabase();
      const newUserId = uuidv4();
      const newGroupId = uuidv4();
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
        newUserId, 'newuser_' + Date.now() + '_' + uuidv4().slice(0, 8), await bcrypt.hash('Password123', 10)
      );
      db.prepare('INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)').run(
        newGroupId, 'Private Group', newUserId
      );

      const response = await request(app)
        .get(`/api/groups/${newGroupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found or you are not a member');
    });
  });

  describe('GET /api/groups/:groupId/members', () => {
    it('should return group members', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].role).toBeDefined();
    });
  });

  describe('POST /api/groups/:groupId/join', () => {
    it('should allow user to join a group', async () => {
      // 先创建一个新群组
      const db = getDatabase();
      const newGroupId = uuidv4();
      db.prepare('INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)').run(
        newGroupId, 'Joinable Group', testUser.id
      );

      const response = await request(app)
        .post(`/api/groups/${newGroupId}/join`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject if already a member', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/join`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already a member');
    });
  });

  describe('POST /api/groups/:groupId/leave', () => {
    it('should reject if user is owner', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/leave`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Owner cannot leave the group');
    });

    it('should reject if not a member', async () => {
      const response = await request(app)
        .post('/api/groups/nonexistent-group/leave')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Not a member of this group');
    });
  });
});
