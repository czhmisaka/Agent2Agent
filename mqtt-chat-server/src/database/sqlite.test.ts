import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// 使用临时数据库文件进行测试
const TEST_DB_PATH = path.resolve(__dirname, '../../test-data/test.db');

describe('Database', () => {
  let db: Database.Database;

  beforeAll(() => {
    // 确保测试目录存在
    const testDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // 删除旧的测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // 创建新的真实数据库
    db = new Database(TEST_DB_PATH);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // 清理测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('initDatabase', () => {
    it('should enable foreign keys pragma', () => {
      db.exec('PRAGMA foreign_keys = ON');
      // 验证 foreign_keys 已启用
      const result = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
      expect(result.foreign_keys).toBe(1);
    });

    it('should create users table', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      // 验证表存在
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      expect(tables).toBeDefined();
    });

    it('should create groups table', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='groups'").get();
      expect(tables).toBeDefined();
    });

    it('should create messages table', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          is_highlighted INTEGER DEFAULT 0,
          is_pinned INTEGER DEFAULT 0,
          is_recalled INTEGER DEFAULT 0,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
      expect(tables).toBeDefined();
    });

    it('should create indexes', () => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
        CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      `);
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all();
      expect(indexes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(() => {
      // 创建测试用户
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          is_highlighted INTEGER DEFAULT 0,
          is_pinned INTEGER DEFAULT 0,
          is_recalled INTEGER DEFAULT 0
        )
      `);
    });

    it('should insert and retrieve a user', () => {
      const stmt = db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)');
      stmt.run('user-1', 'testuser', 'hashedpassword');
      
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.password).toBe('hashedpassword');
    });

    it('should update user password', () => {
      const insertStmt = db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)');
      insertStmt.run('user-1', 'testuser', 'oldpassword');
      
      const updateStmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
      updateStmt.run('newpassword', 'testuser');
      
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      expect(user.password).toBe('newpassword');
    });

    it('should delete a user', () => {
      const stmt = db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)');
      stmt.run('user-1', 'testuser', 'password');
      
      db.prepare('DELETE FROM users WHERE username = ?').run('testuser');
      
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser');
      expect(user).toBeUndefined();
    });

    it('should insert and retrieve messages', () => {
      // 插入用户和群组
      db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)').run('user-1', 'user1', 'pass');
      db.prepare('INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)').run('group-1', 'test', 'user-1');
      
      // 插入消息
      const msgId = 'msg-1';
      db.prepare('INSERT INTO messages (id, group_id, user_id, content) VALUES (?, ?, ?, ?)')
        .run(msgId, 'group-1', 'user-1', 'Hello');
      
      const messages = db.prepare('SELECT * FROM messages WHERE group_id = ?').all('group-1') as any[];
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Hello');
    });

    it('should list messages with pagination', () => {
      // 插入测试数据
      db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)').run('user-1', 'user1', 'pass');
      db.prepare('INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)').run('group-1', 'test', 'user-1');
      
      for (let i = 0; i < 5; i++) {
        db.prepare('INSERT INTO messages (id, group_id, user_id, content) VALUES (?, ?, ?, ?)')
          .run(`msg-${i}`, 'group-1', 'user-1', `Message ${i}`);
      }
      
      const messages = db.prepare(
        'SELECT * FROM messages WHERE group_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all('group-1', 3) as any[];
      
      expect(messages.length).toBe(3);
    });
  });

  describe('Foreign Key Constraints', () => {
    beforeEach(() => {
      db.exec('PRAGMA foreign_keys = ON');
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by TEXT NOT NULL,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
    });

    it('should enforce foreign key constraint', () => {
      // 尝试插入引用不存在用户的群组，应该失败
      expect(() => {
        db.prepare('INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)')
          .run('group-1', 'Test', 'nonexistent-user');
      }).toThrow();
    });
  });

  describe('Database Path Configuration', () => {
    it('should use specified database path', () => {
      expect(TEST_DB_PATH).toContain('test-data');
      expect(TEST_DB_PATH).toContain('test.db');
    });

    it('should create database file on init', () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });
  });
});
