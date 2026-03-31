"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startHttpServer = startHttpServer;
const express_1 = __importDefault(require("express"));
const config_1 = require("../config");
const sqlite_1 = require("../database/sqlite");
const broker_1 = require("../mqtt/broker");
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const utils_1 = require("../utils");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// 确保日志目录存在
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
exports.app = (0, express_1.default)();
// 安全中间件 - 允许内联脚本和本地资源
exports.app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
})); // 安全头部
// CORS 配置：生产环境禁止使用 '*'
const corsOptions = {
    origin: config_1.config.cors.allowedOrigins.length > 0
        ? config_1.config.cors.allowedOrigins
        : (process.env.NODE_ENV === 'production'
            ? [] // 生产环境无配置时拒绝所有跨域请求
            : ['http://localhost:14070', 'http://localhost:8080']), // 开发环境默认允许本地
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
exports.app.use((0, cors_1.default)(corsOptions));
exports.app.use(express_1.default.json({ limit: '10kb' })); // 限制请求体大小
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10kb' }));
exports.app.use((0, cookie_parser_1.default)()); // 解析 cookies
// HTTP 请求日志
exports.app.use(utils_1.httpLogger);
// ============ 静态文件服务 ============
exports.app.use(express_1.default.static(path.join(__dirname, '../../public')));
/**
 * 验证用户名
 * - 长度: 3-20个字符
 * - 格式: 字母、数字、下划线
 */
function validateUsername(username) {
    const errors = [];
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
function validatePassword(password) {
    const errors = [];
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
function validateGroupName(name) {
    const errors = [];
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
function sanitizeMessage(content) {
    if (!content)
        return '';
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .substring(0, 5000); // 限制最大长度
}
// 中间件：验证 JWT token（支持 cookie 和 Authorization header）
function authMiddleware(req, res, next) {
    // 优先从 cookie 获取 token
    let token = req.cookies?.auth_token;
    // 备选：从 Authorization header 获取
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        // 确保 userId 是字符串类型
        req.user = {
            ...decoded,
            userId: String(decoded.userId)
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
// 中间件：验证管理员权限（支持 cookie 和 Authorization header）
function adminAuthMiddleware(req, res, next) {
    // 优先从 cookie 获取 token
    let token = req.cookies?.auth_token;
    // 备选：从 Authorization header 获取
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        const userId = String(decoded.userId);
        // 查询用户的管理员状态
        const db = (0, sqlite_1.getDatabase)();
        const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }
        if (!user.is_admin) {
            return res.status(403).json({ error: 'Admin access required', code: 'ADMIN_REQUIRED' });
        }
        req.user = {
            ...decoded,
            userId
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
}
// 健康检查
exports.app.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {}
    };
    let isHealthy = true;
    // 数据库连接检查
    try {
        const db = (0, sqlite_1.getDatabase)();
        const start = Date.now();
        db.prepare('SELECT 1').get();
        const latency = Date.now() - start;
        health.services.database = {
            status: 'healthy',
            latency_ms: latency
        };
    }
    catch (error) {
        isHealthy = false;
        health.services.database = {
            status: 'unhealthy',
            error: error.message
        };
    }
    // MQTT Broker 状态检查
    try {
        const aedes = (0, broker_1.getAedes)();
        const clientsCount = aedes.clients ? aedes.clients.size : 0;
        health.services.mqtt = {
            status: 'healthy',
            connected_clients: clientsCount,
            port: config_1.config.mqtt.port,
            ws_port: config_1.config.mqtt.websocketPort
        };
    }
    catch (error) {
        isHealthy = false;
        health.services.mqtt = {
            status: 'unhealthy',
            error: error.message
        };
    }
    // 系统信息
    health.uptime = process.uptime();
    health.memory = {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
    };
    health.status = isHealthy ? 'ok' : 'degraded';
    res.status(isHealthy ? 200 : 503).json(health);
});
// ============ 管理面板 API（需要管理员权限）============
// 获取所有消息（用于管理界面）
exports.app.get('/api/admin/messages', adminAuthMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
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
    }
    catch (error) {
        console.error('Get all messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});
// 获取所有群组（需要管理员权限）
exports.app.get('/api/admin/groups', adminAuthMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
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
    }
    catch (error) {
        console.error('Get all groups error:', error);
        res.status(500).json({ error: 'Failed to get groups' });
    }
});
// 获取所有用户（需要管理员权限）
exports.app.get('/api/admin/users', adminAuthMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    try {
        const users = db.prepare(`
      SELECT id, username, nickname, is_online, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();
        res.json(users);
    }
    catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});
// ============ 用户相关 API ============
// 注册用户
exports.app.post('/api/users/register', async (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
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
        const userId = (0, uuid_1.v4)();
        const passwordHash = bcrypt_1.default.hashSync(password, 10);
        db.prepare(`
      INSERT INTO users (id, username, password_hash)
      VALUES (?, ?, ?)
    `).run(userId, username, passwordHash);
        const token = jsonwebtoken_1.default.sign({ userId, username }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
        // 设置 httpOnly cookie 防止 XSS 攻击
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 天
        });
        res.json({
            success: true,
            userId,
            username
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
// 登录
exports.app.post('/api/users/login', async (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(401).json({ error: 'Username or password incorrect', code: 1002 });
        }
        if (!bcrypt_1.default.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Username or password incorrect', code: 1002 });
        }
        // 更新在线状态
        db.prepare('UPDATE users SET is_online = 1, last_login = ? WHERE id = ?')
            .run(new Date().toISOString(), user.id);
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
        // 设置 httpOnly cookie 防止 XSS 攻击
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 天
        });
        // 同时返回 token 给客户端存储（JWT 不涉及敏感信息）
        res.json({
            success: true,
            userId: user.id,
            username: user.username,
            nickname: user.nickname,
            token: token
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
// ============ 管理员相关 API ============
// 设置管理员（需要 ADMIN_SETUP_SECRET，用于初始设置）
exports.app.post('/api/admin/setup', async (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { username, setup_secret } = req.body;
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret || setup_secret !== expectedSecret) {
        return res.status(403).json({ error: 'Invalid setup secret', code: 'INVALID_SETUP_SECRET' });
    }
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }
    try {
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }
        db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
        res.json({ success: true, message: `${username} is now an admin` });
    }
    catch (error) {
        console.error('Admin setup error:', error);
        res.status(500).json({ error: 'Failed to set admin' });
    }
});
// 提升用户为管理员（需要管理员权限）
exports.app.post('/api/admin/users/:userId/promote', adminAuthMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.params;
    try {
        const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }
        if (user.is_admin) {
            return res.status(400).json({ error: 'User is already an admin', code: 'ALREADY_ADMIN' });
        }
        db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(userId);
        res.json({ success: true, message: 'User promoted to admin' });
    }
    catch (error) {
        console.error('Promote admin error:', error);
        res.status(500).json({ error: 'Failed to promote user' });
    }
});
// 获取当前用户信息
exports.app.get('/api/users/me', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    try {
        const user = db.prepare('SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?')
            .get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});
// 获取所有用户
exports.app.get('/api/users', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    try {
        const users = db.prepare(`
      SELECT id, username, nickname, is_online, last_login 
      FROM users 
      ORDER BY is_online DESC, username ASC
    `).all();
        res.json(users);
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});
// ============ 群组相关 API ============
// 创建群组
exports.app.post('/api/groups', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Group name is required' });
    }
    try {
        const groupId = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO groups (id, name, description, owner_id)
      VALUES (?, ?, ?, ?)
    `).run(groupId, name, description || '', userId);
        // 创建者自动加入群组
        const memberId = (0, uuid_1.v4)();
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
    }
    catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});
// 获取用户的群组列表
exports.app.get('/api/groups', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    try {
        const groups = db.prepare(`
      SELECT g.*, gm.role, gm.joined_at
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ? AND g.is_active = 1
      ORDER BY g.created_at DESC
    `).all(userId);
        res.json(groups);
    }
    catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Failed to get groups' });
    }
});
// 获取群组详情
exports.app.get('/api/groups/:groupId', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { groupId } = req.params;
    try {
        const group = db.prepare(`
      SELECT g.*, gm.role
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
      WHERE g.id = ? AND g.is_active = 1
    `).get(userId, groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found or you are not a member' });
        }
        res.json(group);
    }
    catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Failed to get group' });
    }
});
// 获取群组成员
exports.app.get('/api/groups/:groupId/members', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
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
    }
    catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Failed to get members' });
    }
});
// 加入群组
exports.app.post('/api/groups/:groupId/join', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { groupId } = req.params;
    try {
        const group = db.prepare('SELECT * FROM groups WHERE id = ? AND is_active = 1').get(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found', code: 2001 });
        }
        const existingMember = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
        if (existingMember) {
            return res.status(400).json({ error: 'Already a member' });
        }
        const memberId = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role)
      VALUES (?, ?, ?, 'member')
    `).run(memberId, groupId, userId);
        res.json({ success: true, message: 'Joined group successfully' });
    }
    catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({ error: 'Failed to join group' });
    }
});
// 离开群组
exports.app.post('/api/groups/:groupId/leave', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { groupId } = req.params;
    try {
        const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
        if (!membership) {
            return res.status(400).json({ error: 'Not a member of this group', code: 2002 });
        }
        if (membership.role === 'owner') {
            return res.status(400).json({ error: 'Owner cannot leave the group' });
        }
        db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
            .run(groupId, userId);
        res.json({ success: true, message: 'Left group successfully' });
    }
    catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({ error: 'Failed to leave group' });
    }
});
// ============ 消息相关 API ============
// 发送消息
exports.app.post('/api/groups/:groupId/messages', authMiddleware, async (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { groupId } = req.params;
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
    }
    try {
        // 检查用户是否是群组成员
        const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
        if (!membership) {
            return res.status(403).json({ error: 'Not a member of this group', code: 2002 });
        }
        const messageId = (0, uuid_1.v4)();
        const sanitizedContent = sanitizeMessage(content);
        // 插入消息
        db.prepare(`
      INSERT INTO messages (id, group_id, sender_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(messageId, groupId, userId, sanitizedContent, new Date().toISOString());
        // 处理提及和订阅功能
        const senderId = String(userId);
        const groupIdStr = String(groupId);
        processHttpMentions(db, messageId, senderId, groupIdStr, sanitizedContent);
        processHttpSubscriptions(db, messageId, senderId, groupIdStr, sanitizedContent);
        res.json({
            success: true,
            messageId,
            content: sanitizedContent
        });
    }
    catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
// 处理 HTTP API 消息中的提及
function processHttpMentions(db, messageId, senderId, groupId, content) {
    const mentions = extractMentions(content);
    for (const username of mentions) {
        if (['全体成员', '所有人', 'all', 'channel'].includes(username)) {
            const members = db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId);
            for (const member of members) {
                if (member.user_id !== senderId) {
                    const mentionId = (0, uuid_1.v4)();
                    try {
                        db.prepare(`INSERT INTO message_mentions (id, message_id, mentioned_user_id, sender_id, group_id) VALUES (?, ?, ?, ?, ?)`)
                            .run(mentionId, messageId, member.user_id, senderId, groupId);
                        console.log(`📢 Mentioned user ${member.user_id} by ${senderId} (HTTP API)`);
                    }
                    catch (err) {
                        console.error('❌ Error recording mention:', err);
                    }
                }
            }
            continue;
        }
        const mentionedUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (mentionedUser && mentionedUser.id !== senderId) {
            const mentionId = (0, uuid_1.v4)();
            try {
                db.prepare(`INSERT INTO message_mentions (id, message_id, mentioned_user_id, sender_id, group_id) VALUES (?, ?, ?, ?, ?)`)
                    .run(mentionId, messageId, mentionedUser.id, senderId, groupId);
                console.log(`📢 Mentioned user ${mentionedUser.id} by ${senderId} (HTTP API)`);
            }
            catch (err) {
                console.error('❌ Error recording mention:', err);
            }
        }
    }
}
// 处理 HTTP API 消息中的订阅匹配
function processHttpSubscriptions(db, messageId, senderId, groupId, content) {
    const subscriptions = db.prepare(`
    SELECT s.*, u.username
    FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    WHERE s.is_active = 1
    AND (s.group_id IS NULL OR s.group_id = ?)
  `).all(groupId);
    for (const sub of subscriptions) {
        if (sub.user_id === senderId)
            continue;
        let isMatch = false;
        if (sub.subscription_type === 'keyword') {
            isMatch = content.toLowerCase().includes(sub.subscription_value.toLowerCase());
        }
        else if (sub.subscription_type === 'user') {
            const mentions = extractMentions(content);
            isMatch = mentions.some(m => m.toLowerCase() === sub.subscription_value.toLowerCase());
        }
        else if (sub.subscription_type === 'topic') {
            isMatch = content.includes(`#${sub.subscription_value}`);
        }
        if (isMatch) {
            console.log(`🔔 Subscription match for user ${sub.user_id}: ${sub.subscription_type}:${sub.subscription_value} (HTTP API)`);
        }
    }
}
// 提取提及的工具函数
function extractMentions(content) {
    const regex = /@([\w\u4e00-\u9fa5]+)/g;
    const matches = content.match(regex);
    if (!matches)
        return [];
    return [...new Set(matches.map(m => m.slice(1)))];
}
// 获取群组消息历史
exports.app.get('/api/groups/:groupId/messages', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { groupId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    try {
        // 检查用户是否是群组成员
        const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
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
    }
    catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});
// ============ 提及相关 API ============
// 获取当前用户的提及列表
exports.app.get('/api/mentions', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const isReadFilter = req.query.is_read;
    try {
        let whereClause = 'WHERE m.mentioned_user_id = ?';
        const params = [userId];
        if (isReadFilter !== undefined) {
            whereClause += ' AND m.is_read = ?';
            params.push(isReadFilter === 'true' ? 1 : 0);
        }
        // 获取总数
        const countResult = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN m.is_read = 0 THEN 1 ELSE 0 END) as unread_count
      FROM message_mentions m
      ${whereClause}
    `).get(...params);
        // 获取列表
        const mentions = db.prepare(`
      SELECT 
        m.id, m.message_id, m.is_read, m.created_at,
        msg.content as content,
        sender.id as sender_id, sender.username as sender_username, sender.nickname as sender_nickname,
        g.id as group_id, g.name as group_name
      FROM message_mentions m
      JOIN messages msg ON m.message_id = msg.id
      JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN groups g ON m.group_id = g.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
        res.json({
            mentions: mentions.map((m) => ({
                id: m.id,
                messageId: m.message_id,
                content: m.content,
                senderId: m.sender_id,
                senderUsername: m.sender_username,
                senderNickname: m.sender_nickname,
                groupId: m.group_id,
                groupName: m.group_name,
                isRead: Boolean(m.is_read),
                createdAt: m.created_at
            })),
            total: countResult.total,
            unreadCount: countResult.unread_count || 0
        });
    }
    catch (error) {
        console.error('Get mentions error:', error);
        res.status(500).json({ error: 'Failed to get mentions' });
    }
});
// 删除指定提及
exports.app.delete('/api/mentions/:mentionId', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { mentionId } = req.params;
    try {
        const mention = db.prepare(`
      SELECT * FROM message_mentions WHERE id = ? AND mentioned_user_id = ?
    `).get(mentionId, userId);
        if (!mention) {
            return res.status(404).json({ error: 'Mention not found or access denied', code: 'MENTION_NOT_FOUND' });
        }
        db.prepare('DELETE FROM message_mentions WHERE id = ?').run(mentionId);
        res.json({ success: true, message: 'Mention deleted successfully' });
    }
    catch (error) {
        console.error('Delete mention error:', error);
        res.status(500).json({ error: 'Failed to delete mention' });
    }
});
// 批量删除提及
exports.app.delete('/api/mentions', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const filter = req.query.filter || 'read';
    try {
        let whereClause = 'WHERE mentioned_user_id = ?';
        const params = [userId];
        if (filter === 'read') {
            whereClause += ' AND is_read = 1';
        }
        else if (filter !== 'all') {
            return res.status(400).json({ error: 'Invalid filter. Use "read" or "all"' });
        }
        const result = db.prepare(`DELETE FROM message_mentions ${whereClause}`).run(...params);
        res.json({ success: true, deletedCount: result.changes });
    }
    catch (error) {
        console.error('Batch delete mentions error:', error);
        res.status(500).json({ error: 'Failed to delete mentions' });
    }
});
// 标记单条提及为已读
exports.app.put('/api/mentions/:mentionId/read', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { mentionId } = req.params;
    try {
        const mention = db.prepare(`
      SELECT * FROM message_mentions WHERE id = ? AND mentioned_user_id = ?
    `).get(mentionId, userId);
        if (!mention) {
            return res.status(404).json({ error: 'Mention not found', code: 'MENTION_NOT_FOUND' });
        }
        db.prepare('UPDATE message_mentions SET is_read = 1 WHERE id = ?').run(mentionId);
        res.json({ success: true, isRead: true });
    }
    catch (error) {
        console.error('Mark mention as read error:', error);
        res.status(500).json({ error: 'Failed to mark mention as read' });
    }
});
// 全部标记为已读
exports.app.put('/api/mentions/read-all', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    try {
        const result = db.prepare(`
      UPDATE message_mentions SET is_read = 1 WHERE mentioned_user_id = ? AND is_read = 0
    `).run(userId);
        res.json({ success: true, updatedCount: result.changes });
    }
    catch (error) {
        console.error('Mark all mentions as read error:', error);
        res.status(500).json({ error: 'Failed to mark all mentions as read' });
    }
});
// ============ 订阅相关 API ============
// 获取用户的订阅列表
exports.app.get('/api/subscriptions', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const groupId = req.query.groupId;
    try {
        let query = `
      SELECT s.*, g.name as group_name
      FROM subscriptions s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE s.user_id = ? AND s.is_active = 1
    `;
        const params = [userId];
        if (groupId) {
            query += ' AND (s.group_id IS NULL OR s.group_id = ?)';
            params.push(groupId);
        }
        query += ' ORDER BY s.created_at DESC';
        const subscriptions = db.prepare(query).all(...params);
        res.json(subscriptions.map((sub) => ({
            id: sub.id,
            userId: sub.user_id,
            type: sub.subscription_type,
            value: sub.subscription_value,
            groupId: sub.group_id,
            groupName: sub.group_name,
            isActive: Boolean(sub.is_active),
            createdAt: sub.created_at
        })));
    }
    catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ error: 'Failed to get subscriptions' });
    }
});
// ============ 统计相关 API ============
// 获取用户统计信息
exports.app.get('/api/stats', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const targetUserId = req.query.userId || userId;
    try {
        // 获取发送的消息总数
        const totalMessagesResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE sender_id = ? AND is_deleted = 0 AND is_recalled = 0
    `).get(targetUserId);
        // 获取发送的总词数
        const wordCountResult = db.prepare(`
      SELECT SUM(LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1) as count 
      FROM messages 
      WHERE sender_id = ? AND is_deleted = 0 AND is_recalled = 0
    `).get(targetUserId);
        // 获取被提及次数
        const mentionsResult = db.prepare(`
      SELECT COUNT(*) as count FROM message_mentions WHERE mentioned_user_id = ?
    `).get(targetUserId);
        // 获取收到的反应数
        const reactionsResult = db.prepare(`
      SELECT COUNT(*) as count FROM message_reactions mr
      JOIN messages m ON mr.message_id = m.id
      WHERE m.sender_id = ?
    `).get(targetUserId);
        // 获取加入的群组数
        const groupsJoinedResult = db.prepare(`
      SELECT COUNT(*) as count FROM group_members WHERE user_id = ?
    `).get(targetUserId);
        // 获取收到的消息数（不是自己发的）
        const messagesReceivedResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages 
      WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
      AND sender_id != ? AND is_deleted = 0 AND is_recalled = 0
    `).get(targetUserId, targetUserId);
        res.json({
            totalMessages: totalMessagesResult?.count || 0,
            totalWords: wordCountResult?.count || 0,
            mentions: mentionsResult?.count || 0,
            reactions: reactionsResult?.count || 0,
            groupsJoined: groupsJoinedResult?.count || 0,
            messagesReceived: messagesReceivedResult?.count || 0
        });
    }
    catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});
// 获取指定用户的统计信息
exports.app.get('/api/stats/:targetUserId', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const { targetUserId } = req.params;
    try {
        // 获取发送的消息总数
        const totalMessagesResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE sender_id = ? AND is_deleted = 0 AND is_recalled = 0
    `).get(targetUserId);
        // 获取发送的总词数
        const wordCountResult = db.prepare(`
      SELECT SUM(LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1) as count 
      FROM messages 
      WHERE sender_id = ? AND is_deleted = 0 AND is_recalled = 0
    `).get(targetUserId);
        // 获取被提及次数
        const mentionsResult = db.prepare(`
      SELECT COUNT(*) as count FROM message_mentions WHERE mentioned_user_id = ?
    `).get(targetUserId);
        // 获取收到的反应数
        const reactionsResult = db.prepare(`
      SELECT COUNT(*) as count FROM message_reactions mr
      JOIN messages m ON mr.message_id = m.id
      WHERE m.sender_id = ?
    `).get(targetUserId);
        // 获取加入的群组数
        const groupsJoinedResult = db.prepare(`
      SELECT COUNT(*) as count FROM group_members WHERE user_id = ?
    `).get(targetUserId);
        // 获取收到的消息数（不是自己发的）
        const messagesReceivedResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages 
      WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
      AND sender_id != ? AND is_deleted = 0 AND is_recalled = 0
    `).get(targetUserId, targetUserId);
        res.json({
            totalMessages: totalMessagesResult?.count || 0,
            totalWords: wordCountResult?.count || 0,
            mentions: mentionsResult?.count || 0,
            reactions: reactionsResult?.count || 0,
            groupsJoined: groupsJoinedResult?.count || 0,
            messagesReceived: messagesReceivedResult?.count || 0
        });
    }
    catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});
// ============ 消息相关 API ============
// 获取私聊消息历史
exports.app.get('/api/messages/private/:otherUserId', authMiddleware, (req, res) => {
    const db = (0, sqlite_1.getDatabase)();
    const { userId } = req.user;
    const otherUserId = req.params.otherUserId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
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
    }
    catch (error) {
        console.error('Get private messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});
function startHttpServer() {
    // ============ 全局错误处理 ============
    // 全局错误处理中间件
    exports.app.use((err, req, res, next) => {
        // 记录错误日志
        if (err instanceof utils_1.AppError) {
            utils_1.logger.error(`Application Error: ${err.message}`, {
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
        utils_1.logger.error(`Unexpected Error: ${err.message}`, {
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
        }
        else {
            res.status(500).json({
                error: err.message,
                stack: err.stack,
                code: 'INTERNAL_ERROR'
            });
        }
    });
    // 404 处理（必须在所有路由之后）
    exports.app.use((req, res) => {
        res.status(404).json({
            error: 'Route not found',
            code: 'NOT_FOUND'
        });
    });
    exports.app.listen(config_1.config.http.port, () => {
        console.log(`🌐 HTTP API server running on port ${config_1.config.http.port}`);
    });
}
//# sourceMappingURL=server.js.map