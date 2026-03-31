# 数据库结构设计

## 🗄️ SQLite 数据库

使用 `better-sqlite3` 进行数据库操作，性能优秀且无需额外部署。

## 📊 表结构

### 1. users 用户表

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_online INTEGER DEFAULT 0
);

-- 创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_online ON users(is_online);
```

**字段说明：**
- `id`: 用户唯一标识符（UUID）
- `username`: 用户名（唯一）
- `password_hash`: bcrypt 加密的密码
- `nickname`: 昵称（可选）
- `avatar`: 头像 URL（可选）
- `created_at`: 注册时间
- `last_login`: 最后登录时间
- `is_online`: 在线状态（0=离线，1=在线）

### 2. groups 群组表

```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  max_members INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_groups_name ON groups(name);
CREATE INDEX idx_groups_owner ON groups(owner_id);
```

**字段说明：**
- `id`: 群组唯一标识符（UUID）
- `name`: 群组名称
- `description`: 群组描述
- `owner_id`: 群主用户ID
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `max_members`: 最大成员数
- `is_active`: 是否激活

### 3. group_members 群组成员表

```sql
CREATE TABLE group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_read_at DATETIME,
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(group_id, user_id)
);

-- 创建索引
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
```

**字段说明：**
- `id`: 记录ID
- `group_id`: 群组ID
- `user_id`: 用户ID
- `role`: 角色（owner/admin/member）
- `joined_at`: 加入时间
- `last_read_at`: 最后阅读时间

**角色权限：**
- `owner`: 群主，可管理群组、删除成员
- `admin`: 管理员，可禁言、踢人
- `member`: 普通成员

### 4. messages 消息表

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  sender_id TEXT NOT NULL,
  receiver_id TEXT,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted INTEGER DEFAULT 0,
  is_recalled INTEGER DEFAULT 0,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_messages_group ON messages(group_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

**字段说明：**
- `id`: 消息ID
- `group_id`: 群组ID（群聊消息）
- `sender_id`: 发送者ID
- `receiver_id`: 接收者ID（私聊消息）
- `content`: 消息内容
- `content_type`: 消息类型（text/image/file）
- `created_at`: 发送时间
- `is_deleted`: 是否删除
- `is_recalled`: 是否撤回

### 5. user_sessions 用户会话表

```sql
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  device_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_sessions_token ON user_sessions(token);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
```

**字段说明：**
- `id`: 会话ID
- `user_id`: 用户ID
- `token`: JWT Token
- `device_info`: 设备信息
- `created_at`: 创建时间
- `expires_at`: 过期时间

## 🔍 常用查询

### 查询用户的群组列表
```sql
SELECT g.*, gm.role, gm.joined_at
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = ?
ORDER BY gm.joined_at DESC;
```

### 查询群组成员
```sql
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
  gm.joined_at ASC;
```

### 查询群组消息历史
```sql
SELECT m.*, u.username, u.nickname
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.group_id = ?
AND m.is_deleted = 0
ORDER BY m.created_at DESC
LIMIT ? OFFSET ?;
```

### 查询私聊消息
```sql
SELECT m.*, 
       sender.username as sender_name,
       receiver.username as receiver_name
FROM messages m
JOIN users sender ON m.sender_id = sender.id
JOIN users receiver ON m.receiver_id = receiver.id
WHERE (m.sender_id = ? AND m.receiver_id = ?)
   OR (m.sender_id = ? AND m.receiver_id = ?)
ORDER BY m.created_at DESC
LIMIT ? OFFSET ?;
```

## 🔧 数据库迁移

建议使用版本化的迁移脚本：

```
database/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_add_indexes.sql
    └── 003_add_sessions.sql
```

## 📝 数据初始化

首次运行自动创建数据库和表结构。

---

## 📋 扩展表结构（v2.0+）

以下表结构在代码中已实现，文档待更新：

### 6. message_reactions 消息反应表

```sql
CREATE TABLE message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_reactions_user ON message_reactions(user_id);
```

### 7. message_flags 消息标记表

```sql
CREATE TABLE message_flags (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  flag_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(message_id, flag_type)
);

-- flag_type: 'highlight', 'pin'
CREATE INDEX idx_flags_message ON message_flags(message_id);
```

### 8. message_mentions 消息提及表

```sql
CREATE TABLE message_mentions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  mentioned_user_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  group_id TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (mentioned_user_id) REFERENCES users(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE INDEX idx_mentions_user ON message_mentions(mentioned_user_id);
CREATE INDEX idx_mentions_read ON message_mentions(is_read);
```

### 9. subscriptions 订阅表

```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_type TEXT NOT NULL,
  subscription_value TEXT NOT NULL,
  group_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

-- subscription_type: 'keyword', 'topic', 'user'
CREATE INDEX idx_subs_user ON subscriptions(user_id);
CREATE INDEX idx_subs_active ON subscriptions(is_active);
```

### 10. custom_emojis 自定义表情表

```sql
CREATE TABLE custom_emojis (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);
```

### 11. custom_commands 自定义指令表

```sql
CREATE TABLE custom_commands (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  command TEXT NOT NULL,
  response TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE INDEX idx_commands_group ON custom_commands(group_id);
```

### 12. message_stats 消息统计表

```sql
CREATE TABLE message_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  message_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  UNIQUE(user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_stats_user_date ON message_stats(user_id, date);
```

### 13. offline_actions 离线操作队列表

```sql
CREATE TABLE offline_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_processed INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_offline_user ON offline_actions(user_id);
CREATE INDEX idx_offline_unprocessed ON offline_actions(is_processed);
```
