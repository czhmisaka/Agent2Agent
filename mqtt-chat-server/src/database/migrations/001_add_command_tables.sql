-- ========================================
-- 指令系统数据库迁移脚本
-- 版本: 001
-- 描述: 添加消息反应、标记、提及、订阅、自定义表情/指令、统计表
-- 日期: 2026-03-27
-- ========================================

-- 1. 消息反应表 (message_reactions)
CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_emoji ON message_reactions(emoji);

-- 2. 消息标记表 (message_flags)
CREATE TABLE IF NOT EXISTS message_flags (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  flag_type TEXT NOT NULL CHECK(flag_type IN ('highlight', 'pin', 'urgent')),
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(message_id, flag_type)
);

CREATE INDEX IF NOT EXISTS idx_flags_message ON message_flags(message_id);
CREATE INDEX IF NOT EXISTS idx_flags_type ON message_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_flags_user ON message_flags(user_id);

-- 3. 消息提及表 (message_mentions)
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
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON message_mentions(mentioned_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_mentions_group ON message_mentions(group_id);
CREATE INDEX IF NOT EXISTS idx_mentions_message ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_mentions_sender ON message_mentions(sender_id);

-- 4. 订阅表 (subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_type TEXT NOT NULL CHECK(subscription_type IN ('keyword', 'topic', 'user')),
  subscription_value TEXT NOT NULL,
  group_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
  UNIQUE(user_id, subscription_type, subscription_value)
);

CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_subs_type ON subscriptions(subscription_type, subscription_value);
CREATE INDEX IF NOT EXISTS idx_subs_active ON subscriptions(is_active);

-- 5. 自定义表情表 (custom_emojis)
CREATE TABLE IF NOT EXISTS custom_emojis (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  is_public INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_emojis_name ON custom_emojis(name);
CREATE INDEX IF NOT EXISTS idx_emojis_public ON custom_emojis(is_public);
CREATE INDEX IF NOT EXISTS idx_emojis_creator ON custom_emojis(creator_id);
CREATE INDEX IF NOT EXISTS idx_emojis_usage ON custom_emojis(usage_count DESC);

-- 6. 自定义指令表 (custom_commands)
CREATE TABLE IF NOT EXISTS custom_commands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  response_template TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  permissions TEXT DEFAULT 'all' CHECK(permissions IN ('all', 'admin', 'owner')),
  aliases TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commands_name ON custom_commands(name);
CREATE INDEX IF NOT EXISTS idx_commands_permissions ON custom_commands(permissions);
CREATE INDEX IF NOT EXISTS idx_commands_creator ON custom_commands(creator_id);
CREATE INDEX IF NOT EXISTS idx_commands_usage ON custom_commands(usage_count DESC);

-- 7. 消息统计表 (message_stats)
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
);

CREATE INDEX IF NOT EXISTS idx_stats_date ON message_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_stats_user ON message_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_group ON message_stats(group_id);
CREATE INDEX IF NOT EXISTS idx_stats_user_date ON message_stats(user_id, stat_date DESC);

-- 8. 离线操作队列表 (offline_actions)
CREATE TABLE IF NOT EXISTS offline_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  correlation_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offline_user ON offline_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_offline_correlation ON offline_actions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_offline_created ON offline_actions(created_at);

-- ========================================
-- 修改现有表
-- ========================================

-- 9. 为 messages 表添加新字段
-- 注意：SQLite 使用 ALTER TABLE ADD COLUMN 语法
-- 如果这些字段已存在，下面的语句会失败，使用 IF NOT EXISTS 避免错误

-- 添加提及字段 (JSON 数组，存储提及的用户ID)
-- ALTER TABLE messages ADD COLUMN mentions TEXT;

-- 添加高亮标记字段
-- ALTER TABLE messages ADD COLUMN is_highlighted INTEGER DEFAULT 0;

-- 添加置顶标记字段
-- ALTER TABLE messages ADD COLUMN is_pinned INTEGER DEFAULT 0;

-- ========================================
-- 插入默认数据
-- ========================================

-- 插入系统默认表情
INSERT OR IGNORE INTO custom_emojis (id, name, emoji, creator_id, is_public, usage_count)
VALUES 
  ('sys-emoji-001', 'thumbsup', '👍', 'system', 1, 0),
  ('sys-emoji-002', 'heart', '❤️', 'system', 1, 0),
  ('sys-emoji-003', 'laugh', '😂', 'system', 1, 0),
  ('sys-emoji-004', 'wow', '😮', 'system', 1, 0),
  ('sys-emoji-005', 'sad', '😢', 'system', 1, 0),
  ('sys-emoji-006', 'angry', '😠', 'system', 1, 0),
  ('sys-emoji-007', 'fire', '🔥', 'system', 1, 0),
  ('sys-emoji-008', 'star', '⭐', 'system', 1, 0),
  ('sys-emoji-009', 'rocket', '🚀', 'system', 1, 0),
  ('sys-emoji-010', 'check', '✅', 'system', 1, 0);

-- 插入系统默认指令
INSERT OR IGNORE INTO custom_commands (id, name, description, response_template, creator_id, permissions, aliases)
VALUES 
  ('sys-cmd-001', 'help', '显示帮助信息', '可用指令:\n/help - 显示帮助\n/who - 查看在线用户\n/list - 列出群组\n/stats - 查看统计', 'system', 'all', '/h,/?'),
  ('sys-cmd-002', 'who', '查看当前群组的在线用户', '当前在线用户:\n{{users}}', 'system', 'all', '/w'),
  ('sys-cmd-003', 'list', '列出所有群组', '可用群组:\n{{groups}}', 'system', 'all', '/l'),
  ('sys-cmd-004', 'rules', '显示群组规则', '📜 群组规则:\n1. 尊重他人\n2. 不要发送垃圾信息\n3. 提问前先搜索', 'system', 'all', '/r,/rule');

-- ========================================
-- 创建触发器（自动更新统计）
-- ========================================

-- 自动更新消息统计的触发器
CREATE TRIGGER IF NOT EXISTS trg_update_message_stats
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
  INSERT INTO message_stats (id, user_id, group_id, stat_date, message_count, word_count)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.sender_id,
    NEW.group_id,
    date('now'),
    1,
    CASE 
      WHEN NEW.content IS NOT NULL 
      THEN length(NEW.content) - length(replace(NEW.content, ' ', '')) + 1 
      ELSE 0 
    END
  )
  ON CONFLICT(user_id, group_id, stat_date) 
  DO UPDATE SET 
    message_count = message_count + 1,
    word_count = word_count + excluded.word_count,
    updated_at = CURRENT_TIMESTAMP;
END;

-- 自动更新表情使用统计的触发器
CREATE TRIGGER IF NOT EXISTS trg_update_emoji_usage
AFTER INSERT ON custom_emojis
FOR EACH ROW
WHEN NEW.is_public = 1
BEGIN
  -- 可以在这里添加日志或其他操作
  NULL;
END;

-- ========================================
-- 迁移完成
-- ========================================

-- 注意: SQLite 不支持事务内的 ALTER TABLE
-- 如果需要修改 messages 表，请在应用启动时单独执行
