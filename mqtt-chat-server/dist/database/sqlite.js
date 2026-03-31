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
exports.getDatabase = getDatabase;
exports.initDatabase = initDatabase;
exports.closeDatabase = closeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const config_1 = require("../config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let db = null;
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}
function initDatabase() {
    // 确保 data 目录存在
    const dbPath = path.resolve(config_1.config.database.path);
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    console.log(`📊 Database path: ${dbPath}`);
    db = new better_sqlite3_1.default(dbPath);
    // 启用外键约束
    db.pragma('foreign_keys = ON');
    // 创建表结构
    createTables();
    // 执行数据库迁移
    runMigrations();
    // 修改 messages 表添加新字段
    alterMessagesTable();
    console.log('✅ Database initialized');
}
function createTables() {
    if (!db)
        return;
    // users 表
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_online INTEGER DEFAULT 0
    )
  `);
    // groups 表
    db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      max_members INTEGER DEFAULT 100,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
    // group_members 表
    db.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_read_at DATETIME,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    )
  `);
    // messages 表
    db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      sender_id TEXT NOT NULL,
      receiver_id TEXT,
      content TEXT NOT NULL,
      content_type TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      is_recalled INTEGER DEFAULT 0,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    // user_sessions 表
    db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      device_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
    // 创建索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);
    CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
    CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
  `);
    console.log('📋 Database tables created');
}
function alterMessagesTable() {
    if (!db)
        return;
    try {
        // 添加提及字段 (JSON数组，存储提及的用户ID)
        db.exec(`ALTER TABLE messages ADD COLUMN mentions TEXT`);
        console.log('  + mentions column added to messages');
    }
    catch (err) {
        if (!err.message.includes('duplicate column')) {
            console.log('  ~ mentions column already exists or error:', err.message);
        }
    }
    try {
        // 添加高亮标记字段
        db.exec(`ALTER TABLE messages ADD COLUMN is_highlighted INTEGER DEFAULT 0`);
        console.log('  + is_highlighted column added to messages');
    }
    catch (err) {
        if (!err.message.includes('duplicate column')) {
            console.log('  ~ is_highlighted column already exists or error:', err.message);
        }
    }
    try {
        // 添加置顶标记字段
        db.exec(`ALTER TABLE messages ADD COLUMN is_pinned INTEGER DEFAULT 0`);
        console.log('  + is_pinned column added to messages');
    }
    catch (err) {
        if (!err.message.includes('duplicate column')) {
            console.log('  ~ is_pinned column already exists or error:', err.message);
        }
    }
    // 添加 is_admin 字段到 users 表
    try {
        db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`);
        console.log('  + is_admin column added to users');
    }
    catch (err) {
        if (!err.message.includes('duplicate column')) {
            console.log('  ~ is_admin column already exists or error:', err.message);
        }
    }
}
function runMigrations() {
    if (!db)
        return;
    console.log('🔄 Running database migrations...');
    try {
        // 1. 消息反应表 (message_reactions)
        db.exec(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(message_id, user_id, emoji)
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_reactions_emoji ON message_reactions(emoji)`);
        console.log('  ✅ message_reactions table created');
        // 2. 消息标记表 (message_flags)
        db.exec(`
      CREATE TABLE IF NOT EXISTS message_flags (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        flag_type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(message_id, flag_type)
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_flags_message ON message_flags(message_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_flags_type ON message_flags(flag_type)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_flags_user ON message_flags(user_id)`);
        console.log('  ✅ message_flags table created');
        // 3. 消息提及表 (message_mentions)
        db.exec(`
      CREATE TABLE IF NOT EXISTS message_mentions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        mentioned_user_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        group_id TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_mentions_user ON message_mentions(mentioned_user_id, is_read)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_mentions_group ON message_mentions(group_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_mentions_message ON message_mentions(message_id)`);
        console.log('  ✅ message_mentions table created');
        // 4. 订阅表 (subscriptions)
        db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subscription_type TEXT NOT NULL,
        subscription_value TEXT NOT NULL,
        group_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
        UNIQUE(user_id, subscription_type, subscription_value)
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id, is_active)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_subs_type ON subscriptions(subscription_type, subscription_value)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_subs_active ON subscriptions(is_active)`);
        console.log('  ✅ subscriptions table created');
        // 5. 自定义表情表 (custom_emojis)
        db.exec(`
      CREATE TABLE IF NOT EXISTS custom_emojis (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        emoji TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        is_public INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_emojis_name ON custom_emojis(name)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_emojis_public ON custom_emojis(is_public)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_emojis_creator ON custom_emojis(creator_id)`);
        console.log('  ✅ custom_emojis table created');
        // 6. 自定义指令表 (custom_commands)
        db.exec(`
      CREATE TABLE IF NOT EXISTS custom_commands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        response_template TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        permissions TEXT DEFAULT 'all',
        aliases TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_commands_name ON custom_commands(name)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_commands_permissions ON custom_commands(permissions)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_commands_creator ON custom_commands(creator_id)`);
        console.log('  ✅ custom_commands table created');
        // 7. 消息统计表 (message_stats)
        db.exec(`
      CREATE TABLE IF NOT EXISTS message_stats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        group_id TEXT,
        stat_date DATE NOT NULL,
        message_count INTEGER DEFAULT 0,
        word_count INTEGER DEFAULT 0,
        mention_count INTEGER DEFAULT 0,
        reaction_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
        UNIQUE(user_id, group_id, stat_date)
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_stats_date ON message_stats(stat_date)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_stats_user ON message_stats(user_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_stats_group ON message_stats(group_id)`);
        console.log('  ✅ message_stats table created');
        // 8. 离线操作队列表 (offline_actions)
        db.exec(`
      CREATE TABLE IF NOT EXISTS offline_actions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        correlation_id TEXT,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_offline_user ON offline_actions(user_id, status)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_offline_correlation ON offline_actions(correlation_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_offline_created ON offline_actions(created_at)`);
        console.log('  ✅ offline_actions table created');
        // 插入默认表情数据
        const defaultEmojis = [
            ['sys-emoji-001', 'thumbsup', '👍', 'system', 1],
            ['sys-emoji-002', 'heart', '❤️', 'system', 1],
            ['sys-emoji-003', 'laugh', '😂', 'system', 1],
            ['sys-emoji-004', 'wow', '😮', 'system', 1],
            ['sys-emoji-005', 'sad', '😢', 'system', 1],
            ['sys-emoji-006', 'angry', '😠', 'system', 1],
            ['sys-emoji-007', 'fire', '🔥', 'system', 1],
            ['sys-emoji-008', 'star', '⭐', 'system', 1],
            ['sys-emoji-009', 'rocket', '🚀', 'system', 1],
            ['sys-emoji-010', 'check', '✅', 'system', 1]
        ];
        const insertEmoji = db.prepare(`
      INSERT OR IGNORE INTO custom_emojis (id, name, emoji, creator_id, is_public)
      VALUES (?, ?, ?, ?, ?)
    `);
        for (const emoji of defaultEmojis) {
            try {
                insertEmoji.run(...emoji);
            }
            catch (err) {
                // 忽略重复插入错误
            }
        }
        console.log('  ✅ Default emojis inserted');
        // 插入默认指令数据
        const defaultCommands = [
            [
                'sys-cmd-001', 'help', '显示帮助信息',
                '可用指令:\\n/help - 显示帮助\\n/who - 查看在线用户\\n/list - 列出群组\\n/stats - 查看统计',
                'system', 'all', '/h,/?'
            ],
            [
                'sys-cmd-002', 'who', '查看当前群组的在线用户',
                '当前在线用户:\\n{{users}}',
                'system', 'all', '/w'
            ],
            [
                'sys-cmd-003', 'list', '列出所有群组',
                '可用群组:\\n{{groups}}',
                'system', 'all', '/l'
            ],
            [
                'sys-cmd-004', 'rules', '显示群组规则',
                '📜 群组规则:\\n1. 尊重他人\\n2. 不要发送垃圾信息\\n3. 提问前先搜索',
                'system', 'all', '/r,/rule'
            ]
        ];
        const insertCommand = db.prepare(`
      INSERT OR IGNORE INTO custom_commands (id, name, description, response_template, creator_id, permissions, aliases)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (const cmd of defaultCommands) {
            try {
                insertCommand.run(...cmd);
            }
            catch (err) {
                // 忽略重复插入错误
            }
        }
        console.log('  ✅ Default commands inserted');
        console.log('✅ All migrations completed successfully');
    }
    catch (err) {
        console.error('❌ Migration error:', err);
    }
}
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('🔒 Database closed');
    }
}
//# sourceMappingURL=sqlite.js.map