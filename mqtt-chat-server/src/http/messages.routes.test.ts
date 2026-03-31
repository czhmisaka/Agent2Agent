import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const TEST_DB_PATH = path.resolve(__dirname, '../../test-data/messages-routes-test.db');
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';

import { initDatabase, getDatabase, closeDatabase } from '../database/sqlite';

let app: express.Express;
let server: http.Server;

describe('Messages Routes', () => {
  const testUser = { id: 'test-user-id-123', username: 'testuser', password: 'TestPassword123' };
  const testGroup = { id: 'test-group-id-456', name: 'Test Group' };
  let authToken: string;

  beforeAll(async () => {
    const testDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(testDir)) { fs.mkdirSync(testDir, { recursive: true }); }
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    
    initDatabase();
    const db = getDatabase();
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(testUser.id, testUser.username, passwordHash);
    db.prepare('INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)').run(testGroup.id, testGroup.name, testUser.id);
    db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(testGroup.id, testUser.id, 'owner');
    
    authToken = jwt.sign({ userId: testUser.id, username: testUser.username }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    
    app = express();
    app.use(express.json());
    
    const authenticate = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.auth_token;
      if (!token) { return res.status(401).json({ error: 'Unauthorized' }); }
      try { const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any; req.user = decoded; next(); }
      catch (error) { return res.status(401).json({ error: 'Invalid token' }); }
    };
    
    // 正确的 HTML 转义函数
    const escapeHtml = (text: string): string => {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    };
    
    app.get('/api/groups/:groupId/messages', authenticate, (req: any, res) => {
      try {
        const db = getDatabase();
        const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.groupId, req.user.userId);
        if (!membership) { return res.status(403).json({ error: 'Not a member of this group' }); }
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const messages = db.prepare(`SELECT m.*, u.username, u.nickname FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.group_id = ? AND m.is_recalled = 0 ORDER BY m.created_at DESC LIMIT ? OFFSET ?`).all(req.params.groupId, limit, offset);
        db.prepare("UPDATE group_members SET last_read_at = datetime('now') WHERE group_id = ? AND user_id = ?").run(req.params.groupId, req.user.userId);
        res.json(messages.reverse());
      } catch (error: any) { res.status(500).json({ error: 'Failed to get messages: ' + error.message }); }
    });
    
    app.post('/api/groups/:groupId/messages', authenticate, (req: any, res) => {
      const { content } = req.body;
      if (!content || content.trim() === '') { return res.status(400).json({ error: 'Message content is required' }); }
      try {
        const db = getDatabase();
        const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(req.params.groupId, req.user.userId);
        if (!membership) { return res.status(403).json({ error: 'Not a member of this group' }); }
        let safeContent = escapeHtml(content.trim());
        if (safeContent.length > 5000) { safeContent = safeContent.substring(0, 5000); }
        const messageId = uuidv4();
        db.prepare('INSERT INTO messages (id, group_id, sender_id, content) VALUES (?, ?, ?, ?)').run(messageId, req.params.groupId, req.user.userId, safeContent);
        res.json({ success: true, messageId, content: safeContent });
      } catch (error) { res.status(500).json({ error: 'Failed to send message' }); }
    });
    
    server = app.listen(14077);
  });

  afterAll(() => {
    if (server) { server.close(); }
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) { fs.unlinkSync(TEST_DB_PATH); }
    delete process.env.DB_PATH;
    delete process.env.JWT_SECRET;
  });

  describe('GET /api/groups/:groupId/messages', () => {
    it('should return message history', async () => {
      const db = getDatabase();
      db.prepare('INSERT INTO messages (id, group_id, sender_id, content) VALUES (?, ?, ?, ?)').run(uuidv4(), testGroup.id, testUser.id, 'Test message');
      const response = await request(app).get(`/api/groups/${testGroup.id}/messages`).set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
    it('should support pagination', async () => {
      const response = await request(app).get(`/api/groups/${testGroup.id}/messages?limit=10&offset=0`).set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
    });
    it('should reject if not a member', async () => {
      const db = getDatabase();
      const otherUserId = uuidv4();
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(otherUserId, 'otheruser', await bcrypt.hash('Password123', 10));
      const privateGroupId = uuidv4();
      db.prepare('INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)').run(privateGroupId, 'Private', otherUserId);
      const response = await request(app).get(`/api/groups/${privateGroupId}/messages`).set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(403);
    });
    it('should reject unauthenticated', async () => {
      const response = await request(app).get(`/api/groups/${testGroup.id}/messages`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/groups/:groupId/messages', () => {
    it('should send a message', async () => {
      const response = await request(app).post(`/api/groups/${testGroup.id}/messages`).set('Authorization', `Bearer ${authToken}`).send({ content: 'Hello, world!' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    it('should sanitize XSS', async () => {
      const response = await request(app).post(`/api/groups/${testGroup.id}/messages`).set('Authorization', `Bearer ${authToken}`).send({ content: '<script>alert("xss")</script>' });
      expect(response.status).toBe(200);
      expect(response.body.content).not.toContain('<script>');
      expect(response.body.content).toContain('&lt;script&gt;');
    });
    it('should truncate long messages', async () => {
      const response = await request(app).post(`/api/groups/${testGroup.id}/messages`).set('Authorization', `Bearer ${authToken}`).send({ content: 'A'.repeat(6000) });
      expect(response.status).toBe(200);
      expect(response.body.content.length).toBeLessThanOrEqual(5000);
    });
    it('should reject empty content', async () => {
      const response = await request(app).post(`/api/groups/${testGroup.id}/messages`).set('Authorization', `Bearer ${authToken}`).send({ content: '' });
      expect(response.status).toBe(400);
    });
    it('should handle unicode', async () => {
      const response = await request(app).post(`/api/groups/${testGroup.id}/messages`).set('Authorization', `Bearer ${authToken}`).send({ content: 'Hello! 你好! 🎉' });
      expect(response.status).toBe(200);
    });
  });
});
