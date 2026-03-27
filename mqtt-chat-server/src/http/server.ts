import express, { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { getDatabase } from '../database/sqlite';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import { logger, httpLogger, AppError, ErrorCodes } from '../utils';
import * as path from 'path';
import * as fs from 'fs';

// 确保日志目录存在
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();

// 安全中间件
app.use(helmet()); // 安全头部
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP 请求日志
app.use(httpLogger);

// ============ 静态文件服务 ============
app.use(express.static(path.join(__dirname, '../../public')));

// ============ 速率限制 ============

// API 通用速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 登录速率限制（更严格）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次登录尝试
  message: { error: 'Too many login attempts, please try again later', code: 'LOGIN_RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 注册速率限制
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 最多10次注册尝试
  message: { error: 'Too many registration attempts, please try again later', code: 'REGISTER_RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 应用速率限制
app.use('/api/', apiLimiter);

// ==================== 输入验证工具 ====================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证用户名
 * - 长度: 3-20个字符
 * - 格式: 字母、数字、下划线
 */
function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];
  
  if (!username) {
    errors.push('Username is required');
    return { valid: false, errors };
  }
  
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 20) {
    errors.push('Username must be at most 20 characters long');
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * 验证密码强度
 * - 长度: 至少8个字符
 * - 包含: 小写字母、大写字母、数字
 */
function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * 验证群组名称
 */
function validateGroupName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name) {
    errors.push('Group name is required');
    return { valid: false, errors };
  }
  
  if (name.length < 2) {
    errors.push('Group name must be at least 2 characters long');
  }
  
  if (name.length > 50) {
    errors.push('Group name must be at most 50 characters long');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * 清理消息内容（防止 XSS）
 */
function sanitizeMessage(content: string): string {
  if (!content) return '';
  
  return content
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, 5000); // 限制最大长度
}

// 中间件：验证 JWT token
function authMiddleware(req: Request, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    // 确保 userId 是字符串类型
    (req as any).user = {
      ...decoded,
      userId: String(decoded.userId)
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ 管理面板 API（无需认证）============

// 获取所有消息（用于管理界面）
app.get('/api/admin/messages', (req, res) => {
  const db = getDatabase();
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  
  try {
    const messages = db.prepare(`
      SELECT m.*, 
             u.username,
             u.nickname,
             g.name as group_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN groups g ON m.group_id = g.id
      WHERE m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json(messages);
  } catch (error) {
    console.error('Get all messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// 获取所有群组（无需认证）
app.get('/api/admin/groups', (req, res) => {
  const db = getDatabase();
  
  try {
    const groups = db.prepare(`
      SELECT g.*, 
             COUNT(gm.id) as member_count,
             u.username as owner_name
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN users u ON g.owner_id = u.id
      WHERE g.is_active = 1
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `).all();
    
    res.json(groups);
  } catch (error) {
    console.error('Get all groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

// 获取所有用户（无需认证 - 用于管理面板）
app.get('/api/admin/users', (req, res) => {
  const db = getDatabase();
  
  try {
    const users = db.prepare(`
      SELECT id, username, nickname, is_online, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// ============ 用户相关 API ============

// 注册用户
app.post('/api/users/register', async (req, res) => {
  const db = getDatabase();
  const { username, password } = req.body;
  
  // 输入验证
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ 
      error: 'Invalid username', 
      details: usernameValidation.errors,
      code: 1003
    });
  }
  
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ 
      error: 'Invalid password', 
      details: passwordValidation.errors,
      code: 1004
    });
  }
  
  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists', code: 1001 });
    }
    
    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash)
      VALUES (?, ?, ?)
    `).run(userId, username, passwordHash);
    
    const token = jwt.sign(
      { userId, username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
    );
    
    res.json({
      success: true,
      userId,
      username,
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 登录
app.post('/api/users/login', async (req, res) => {
  const db = getDatabase();
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (!user) {
      return res.status(401).json({ error: 'Username or password incorrect', code: 1002 });
    }
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Username or password incorrect', code: 1002 });
    }
    
    // 更新在线状态
    db.prepare('UPDATE users SET is_online = 1, last_login = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id);
    
    const token = jwt.sign(
      { userId: user.id, username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
    );
    
    res.json({
      success: true,
      userId: user.id,
      username: user.username,
      nickname: user.nickname,
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 获取当前用户信息
app.get('/api/users/me', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  
  try {
    const user = db.prepare('SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?')
      .get(userId) as any;
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// 获取所有用户
app.get('/api/users', authMiddleware, (req, res) => {
  const db = getDatabase();
  
  try {
    const users = db.prepare(`
      SELECT id, username, nickname, is_online, last_login 
      FROM users 
      ORDER BY is_online DESC, username ASC
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// ============ 群组相关 API ============

// 创建群组
app.post('/api/groups', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  
  try {
    const groupId = uuidv4();
    
    db.prepare(`
      INSERT INTO groups (id, name, description, owner_id)
      VALUES (?, ?, ?, ?)
    `).run(groupId, name, description || '', userId);
    
    // 创建者自动加入群组
    const memberId = uuidv4();
    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role)
      VALUES (?, ?, ?, 'owner')
    `).run(memberId, groupId, userId);
    
    res.json({
      success: true,
      groupId,
      name,
      description
    });
    
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// 获取用户的群组列表
app.get('/api/groups', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  
  try {
    const groups = db.prepare(`
      SELECT g.*, gm.role, gm.joined_at
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ? AND g.is_active = 1
      ORDER BY g.created_at DESC
    `).all(userId);
    
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

// 获取群组详情
app.get('/api/groups/:groupId', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  
  try {
    const group = db.prepare(`
      SELECT g.*, gm.role
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
      WHERE g.id = ? AND g.is_active = 1
    `).get(userId, groupId) as any;
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found or you are not a member' });
    }
    
    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

// 获取群组成员
app.get('/api/groups/:groupId/members', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { groupId } = req.params;
  
  try {
    const members = db.prepare(`
      SELECT u.id, u.username, u.nickname, u.is_online, gm.role, gm.joined_at
      FROM users u
      JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY 
        CASE gm.role 
          WHEN 'owner' THEN 1 
          WHEN 'admin' THEN 2 
          ELSE 3 
        END,
        gm.joined_at ASC
    `).all(groupId);
    
    res.json(members);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// 加入群组
app.post('/api/groups/:groupId/join', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  
  try {
    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND is_active = 1').get(groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found', code: 2001 });
    }
    
    const existingMember = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
    ).get(groupId, userId);
    
    if (existingMember) {
      return res.status(400).json({ error: 'Already a member' });
    }
    
    const memberId = uuidv4();
    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role)
      VALUES (?, ?, ?, 'member')
    `).run(memberId, groupId, userId);
    
    res.json({ success: true, message: 'Joined group successfully' });
    
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// 离开群组
app.post('/api/groups/:groupId/leave', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  
  try {
    const membership = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
    ).get(groupId, userId) as any;
    
    if (!membership) {
      return res.status(400).json({ error: 'Not a member of this group', code: 2002 });
    }
    
    if (membership.role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot leave the group' });
    }
    
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
      .run(groupId, userId);
    
    res.json({ success: true, message: 'Left group successfully' });
    
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// ============ 消息相关 API ============

// 发送消息
app.post('/api/groups/:groupId/messages', authMiddleware, async (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }
  
  try {
    // 检查用户是否是群组成员
    const membership = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
    ).get(groupId, userId);
    
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group', code: 2002 });
    }
    
    const messageId = uuidv4();
    const sanitizedContent = sanitizeMessage(content);
    
    // 插入消息
    db.prepare(`
      INSERT INTO messages (id, group_id, sender_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(messageId, groupId, userId, sanitizedContent, new Date().toISOString());
    
    // TODO: 提及和订阅功能需要进一步完善类型处理
    // const senderId = String(userId);
    // processHttpMentions(db, messageId, senderId, groupId, sanitizedContent);
    // processHttpSubscriptions(db, messageId, senderId, groupId, sanitizedContent);
    
    res.json({
      success: true,
      messageId,
      content: sanitizedContent
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 处理 HTTP API 消息中的提及
function processHttpMentions(db: any, messageId: string, senderId: string, groupId: string, content: string): void {
  const mentions = extractMentions(content);
  
  for (const username of mentions) {
    if (['全体成员', '所有人', 'all', 'channel'].includes(username)) {
      const members = db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId) as any[];
      for (const member of members) {
        if (member.user_id !== senderId) {
          const mentionId = uuidv4();
          try {
            db.prepare(`INSERT INTO message_mentions (id, message_id, mentioned_user_id, sender_id, group_id) VALUES (?, ?, ?, ?, ?)`)
              .run(mentionId, messageId, member.user_id, senderId, groupId);
            console.log(`📢 Mentioned user ${member.user_id} by ${senderId} (HTTP API)`);
          } catch (err) {
            console.error('❌ Error recording mention:', err);
          }
        }
      }
      continue;
    }
    
    const mentionedUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any;
    
    if (mentionedUser && mentionedUser.id !== senderId) {
      const mentionId = uuidv4();
      try {
        db.prepare(`INSERT INTO message_mentions (id, message_id, mentioned_user_id, sender_id, group_id) VALUES (?, ?, ?, ?, ?)`)
          .run(mentionId, messageId, mentionedUser.id, senderId, groupId);
        console.log(`📢 Mentioned user ${mentionedUser.id} by ${senderId} (HTTP API)`);
      } catch (err) {
        console.error('❌ Error recording mention:', err);
      }
    }
  }
}

// 处理 HTTP API 消息中的订阅匹配
function processHttpSubscriptions(db: any, messageId: string, senderId: string, groupId: string, content: string): void {
  const subscriptions = db.prepare(`
    SELECT s.*, u.username
    FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    WHERE s.is_active = 1
    AND (s.group_id IS NULL OR s.group_id = ?)
  `).all(groupId) as any[];
  
  for (const sub of subscriptions) {
    if (sub.user_id === senderId) continue;
    
    let isMatch = false;
    
    if (sub.subscription_type === 'keyword') {
      isMatch = content.toLowerCase().includes(sub.subscription_value.toLowerCase());
    } else if (sub.subscription_type === 'user') {
      const mentions = extractMentions(content);
      isMatch = mentions.some(m => m.toLowerCase() === sub.subscription_value.toLowerCase());
    } else if (sub.subscription_type === 'topic') {
      isMatch = content.includes(`#${sub.subscription_value}`);
    }
    
    if (isMatch) {
      console.log(`🔔 Subscription match for user ${sub.user_id}: ${sub.subscription_type}:${sub.subscription_value} (HTTP API)`);
    }
  }
}

// 提取提及的工具函数
function extractMentions(content: string): string[] {
  const regex = /@([\w\u4e00-\u9fa5]+)/g;
  const matches = content.match(regex);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1)))];
}

// 获取群组消息历史
app.get('/api/groups/:groupId/messages', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  try {
    // 检查用户是否是群组成员
    const membership = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
    ).get(groupId, userId);
    
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group', code: 2002 });
    }
    
    const messages = db.prepare(`
      SELECT m.*, u.username, u.nickname
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(groupId, limit, offset);
    
    // 更新最后阅读时间
    db.prepare('UPDATE group_members SET last_read_at = ? WHERE group_id = ? AND user_id = ?')
      .run(new Date().toISOString(), groupId, userId);
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// 获取私聊消息历史
app.get('/api/messages/private/:otherUserId', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { userId } = (req as any).user;
  const otherUserId = req.params.otherUserId as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  try {
    const messages = db.prepare(`
      SELECT m.*, 
             sender.username as sender_username,
             receiver.username as receiver_username
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?)
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, otherUserId, otherUserId, userId, limit, offset);
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get private messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

export function startHttpServer(): void {
  // ============ 全局错误处理 ============
  
  // 全局错误处理中间件
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // 记录错误日志
    if (err instanceof AppError) {
      logger.error(`Application Error: ${err.message}`, {
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code
      });
    }
    
    // 未知错误
    logger.error(`Unexpected Error: ${err.message}`, {
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    // 生产环境不暴露详细错误
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    } else {
      res.status(500).json({
        error: err.message,
        stack: err.stack,
        code: 'INTERNAL_ERROR'
      });
    }
  });
  
  // 404 处理（必须在所有路由之后）
  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found',
      code: 'NOT_FOUND'
    });
  });
  
  app.listen(config.http.port, () => {
    console.log(`🌐 HTTP API server running on port ${config.http.port}`);
  });
}
