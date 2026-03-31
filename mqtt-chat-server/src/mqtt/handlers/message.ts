import { Client, PublishPacket } from 'aedes';
import { getDatabase } from '../../database/sqlite';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { getAedes } from '../broker';
import { handleMessageAction } from './action';
import { 
  MessagePayload, 
  JwtPayload, 
  User, 
  Group, 
  GroupMember,
  Message,
  FormattedReaction 
} from '../../types';

// 定义数据库查询返回的用户类型
interface DbUser {
  id: string;
  username: string;
  nickname?: string;
  password_hash: string;
  is_online: number;
  last_login?: string;
}

// 定义数据库查询返回的组成员类型
interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
}

// 定义数据库查询返回的消息类型
interface DbMessage {
  id: string;
  group_id?: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  content_type: string;
  is_highlighted: number;
  is_pinned: number;
  is_recalled: number;
  created_at: string;
}

// 定义群组类型
interface DbGroup {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  is_active: number;
  created_at: string;
}

// 定义订阅类型
interface DbSubscription {
  id: string;
  user_id: string;
  subscription_type: string;
  subscription_value: string;
  group_id?: string;
  is_active: number;
  username: string;
  is_online: number;
}

// 定义查询到的提及用户类型
interface DbMentionedUser {
  id: string;
}

export function handleMessage(client: Client, topic: string, payload: Buffer): void {
  try {
    const message: MessagePayload = JSON.parse(payload.toString());
    
    // 根据 topic 处理不同的消息
    if (topic.startsWith('chat/auth/')) {
      handleAuthMessage(client, topic, message);
    } else if (topic.startsWith('chat/group/')) {
      handleGroupMessage(client, topic, message);
    } else if (topic.startsWith('chat/user/')) {
      handlePrivateMessage(client, topic, message);
    } else if (topic.startsWith('chat/presence/')) {
      handlePresenceMessage(client, topic, message);
    } else if (topic.startsWith('chat/peer/')) {
      handlePeerMessage(client, topic, payload);
    }
  } catch (error) {
    console.error('❌ Error handling message:', error);
  }
}

function handleAuthMessage(client: Client, topic: string, message: MessagePayload): void {
  const db = getDatabase();
  const responseTopic = `${topic}/response`;
  
  if (topic === 'chat/auth/register') {
    const { username, password } = message.payload;
    
    try {
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      
      if (existingUser) {
        sendResponse(client, responseTopic, {
          type: 'ack',
          timestamp: new Date().toISOString(),
          payload: { success: false, error: 'Username already exists', code: 1001 },
          meta: message.meta
        });
        return;
      }
      
      const userId = uuidv4();
      const passwordHash = bcrypt.hashSync(password, 10);
      
      db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`)
        .run(userId, username, passwordHash);
      
      const token = jwt.sign(
        { userId, username },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
      );
      
      sendResponse(client, responseTopic, {
        type: 'ack',
        timestamp: new Date().toISOString(),
        payload: { success: true, userId, username, token },
        meta: message.meta
      });
      
      console.log(`✅ User registered: ${username}`);
      
    } catch (error) {
      console.error('❌ Registration error:', error);
      sendResponse(client, responseTopic, {
        type: 'error',
        timestamp: new Date().toISOString(),
        payload: { success: false, error: 'Registration failed' },
        meta: message.meta
      });
    }
    
  } else if (topic === 'chat/auth/login') {
    const { username, password } = message.payload;
    
    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined;
      
      if (!user) {
        sendResponse(client, responseTopic, {
          type: 'ack',
          timestamp: new Date().toISOString(),
          payload: { success: false, error: 'Username or password incorrect', code: 1002 },
          meta: message.meta
        });
        return;
      }
      
      if (!bcrypt.compareSync(password, user.password_hash)) {
        sendResponse(client, responseTopic, {
          type: 'ack',
          timestamp: new Date().toISOString(),
          payload: { success: false, error: 'Username or password incorrect', code: 1002 },
          meta: message.meta
        });
        return;
      }
      
      db.prepare('UPDATE users SET is_online = 1, last_login = ? WHERE id = ?')
        .run(new Date().toISOString(), user.id);
      
      const token = jwt.sign(
        { userId: user.id, username },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
      );
      
      sendResponse(client, responseTopic, {
        type: 'ack',
        timestamp: new Date().toISOString(),
        payload: { success: true, userId: user.id, username: user.username, nickname: user.nickname, token },
        meta: message.meta
      });
      
      console.log(`✅ User logged in: ${username}`);
      
    } catch (error) {
      console.error('❌ Login error:', error);
      sendResponse(client, responseTopic, {
        type: 'error',
        timestamp: new Date().toISOString(),
        payload: { success: false, error: 'Login failed' },
        meta: message.meta
      });
    }
  }
}

function handleGroupMessage(client: Client, topic: string, message: MessagePayload): void {
  const db = getDatabase();
  const parts = topic.split('/');
  const action = parts[3];
  const groupIdentifier = parts[2];  // 可能是名称或 ID
  
  if (action === 'message') {
    const { userId: payloadUserId, token, content } = message.payload;

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const userId = decoded.userId;

      // 先根据名称或 ID 查找群组 ID
      let groupId = groupIdentifier;
      const group = db.prepare(
        'SELECT id FROM groups WHERE (id = ? OR name = ?) AND is_active = 1'
      ).get(groupIdentifier, groupIdentifier) as { id: string } | undefined;
      
      if (!group) {
        console.log(`❌ Group not found: ${groupIdentifier}`);
        return;
      }
      groupId = group.id;

      const membership = db.prepare(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'
      ).get(groupId, userId) as DbGroupMember | undefined;
      
      if (!membership) {
        console.log(`❌ User ${userId} not in group ${groupId}`);
        return;
      }
      
      const messageId = uuidv4();
      db.prepare(`INSERT INTO messages (id, group_id, sender_id, content) VALUES (?, ?, ?, ?)`)
        .run(messageId, groupId, userId, content);
      
      const broadcastTopic = `chat/group/${groupId}/message`;
      const user = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(userId) as { username: string; nickname?: string } | undefined;
      
      sendBroadcast(broadcastTopic, {
        type: 'message',
        timestamp: new Date().toISOString(),
        payload: {
          messageId,
          content,
          contentType: 'text',
          sender: { userId, username: user?.username || 'Unknown', nickname: user?.nickname || null }
        },
        meta: { groupId }
      }, client.id);
      
      // 处理提及和订阅
      processMentions(messageId, userId, groupId, content);
      processSubscriptions(messageId, userId, groupId, content);
      
    } catch (error) {
      console.error('❌ Error sending group message:', error);
    }
    
  } else if (action === 'join') {
    const { userId, token } = message.payload;
    
    try {
      jwt.verify(token, config.jwt.secret);
      
      // 支持名称或 ID 查询
      const group = db.prepare(
        'SELECT id FROM groups WHERE (id = ? OR name = ?) AND is_active = 1'
      ).get(groupIdentifier, groupIdentifier) as { id: string } | undefined;
      
      if (!group) return;
      
      const memberId = uuidv4();
      db.prepare(`INSERT OR REPLACE INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'member')`)
        .run(memberId, group.id, userId);
      
      console.log(`✅ User ${userId} joined group ${group.id}`);
      
      sendBroadcast(`chat/group/${group.id}/message`, {
        type: 'system',
        timestamp: new Date().toISOString(),
        payload: { content: 'A new member joined the group', userId },
        meta: { groupId: group.id }
      }, client.id);
      
    } catch (error) {
      console.error('❌ Error joining group:', error);
    }
    
  } else if (action === 'leave') {
    const { userId, token } = message.payload;
    
    try {
      jwt.verify(token, config.jwt.secret);
      
      // 支持名称或 ID 查询
      const group = db.prepare(
        'SELECT id FROM groups WHERE (id = ? OR name = ?) AND is_active = 1'
      ).get(groupIdentifier, groupIdentifier) as { id: string } | undefined;
      
      if (!group) return;
      
      db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
        .run(group.id, userId);
      
      console.log(`👋 User ${userId} left group ${group.id}`);
      
      sendBroadcast(`chat/group/${group.id}/message`, {
        type: 'system',
        timestamp: new Date().toISOString(),
        payload: { content: 'A member left the group', userId },
        meta: { groupId: group.id }
      }, client.id);
      
    } catch (error) {
      console.error('❌ Error leaving group:', error);
    }
    
  } else if (action === 'action') {
    // 处理消息动作
    handleMessageAction(client, topic, Buffer.from(JSON.stringify(message)));
  }
}

function handlePrivateMessage(client: Client, topic: string, message: MessagePayload): void {
  const db = getDatabase();
  const parts = topic.split('/');
  const receiverId = parts[2];
  
  const { senderId, token, content } = message.payload;
  
  try {
    jwt.verify(token, config.jwt.secret);
    
    const messageId = uuidv4();
    db.prepare(`INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)`)
      .run(messageId, senderId, receiverId, content);
    
    const sender = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(senderId) as { username: string; nickname?: string } | undefined;
    
    sendToUser(receiverId, {
      type: 'message',
      timestamp: new Date().toISOString(),
      payload: {
        messageId,
        content,
        contentType: 'text',
        sender: { userId: senderId, username: sender?.username || 'unknown', nickname: sender?.nickname }
      },
      meta: { receiverId }
    });
    
  } catch (error) {
    console.error('❌ Error sending private message:', error);
  }
}

function handlePresenceMessage(client: Client, topic: string, message: MessagePayload): void {
  const db = getDatabase();
  const parts = topic.split('/');
  const userId = parts[2];
  const status = message.payload.status;
  
  try {
    if (status === 'online') {
      db.prepare('UPDATE users SET is_online = 1 WHERE id = ?').run(userId);
      console.log(`🟢 User ${userId} is online`);
    } else if (status === 'offline') {
      db.prepare('UPDATE users SET is_online = 0 WHERE id = ?').run(userId);
      console.log(`⚫ User ${userId} is offline`);
    }
  } catch (error) {
    console.error('❌ Error updating presence:', error);
  }
}

function handlePeerMessage(client: Client, topic: string, rawPayload: Buffer): void {
  const parts = topic.split('/');
  const subTopic = parts[3];
  
  if (subTopic === 'action') {
    handleMessageAction(client, topic, rawPayload);
  } else if (subTopic === 'typing') {
    try {
      const msg = JSON.parse(rawPayload.toString());
      console.log(`💬 ${msg.payload?.sourceUsername || 'Unknown'} is typing...`);
    } catch (e) {
      console.error('Failed to parse typing message:', e);
    }
  }
}

function sendResponse(client: Client, topic: string, message: any): void {
  const aedes = getAedes();
  aedes.publish({
    topic,
    payload: Buffer.from(JSON.stringify(message)),
    qos: 1,
    retain: false,
    cmd: 'publish',
    dup: false
  }, (err: any) => {
    if (err) console.error('❌ Error sending response:', err);
  });
}

function sendBroadcast(topic: string, message: any, excludeClientId?: string): void {
  const aedes = getAedes();
  aedes.publish({
    topic,
    payload: Buffer.from(JSON.stringify(message)),
    qos: 2,
    retain: false,
    cmd: 'publish',
    dup: false
  }, (err: any) => {
    if (err) console.error('❌ Error broadcasting:', err);
  });
}

function sendToUser(userId: string, message: any): void {
  const aedes = getAedes();
  aedes.publish({
    topic: `chat/user/${userId}/message`,
    payload: Buffer.from(JSON.stringify(message)),
    qos: 2,
    retain: false,
    cmd: 'publish',
    dup: false
  }, (err: any) => {
    if (err) console.error('❌ Error sending to user:', err);
  });
}

// ==================== 提及和订阅处理 ====================

function extractMentions(content: string): string[] {
  const regex = /@([\w\u4e00-\u9fa5]+)/g;
  const matches = content.match(regex);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1)))];
}

async function processMentions(messageId: string, senderId: string, groupId: string, content: string): Promise<void> {
  const db = getDatabase();
  const mentions = extractMentions(content);
  
  for (const username of mentions) {
    if (['全体成员', '所有人', 'all', 'channel'].includes(username)) {
      const members = db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId) as { user_id: string }[];
      for (const member of members) {
        if (member.user_id !== senderId) {
          await sendMentionNotification(member.user_id, messageId, senderId, groupId);
        }
      }
      continue;
    }
    
    const mentionedUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as DbMentionedUser | undefined;
    
    if (mentionedUser && mentionedUser.id !== senderId) {
      const mentionId = uuidv4();
      try {
        db.prepare(`INSERT INTO message_mentions (id, message_id, mentioned_user_id, sender_id, group_id) VALUES (?, ?, ?, ?, ?)`)
          .run(mentionId, messageId, mentionedUser.id, senderId, groupId);
        await sendMentionNotification(mentionedUser.id, messageId, senderId, groupId);
        console.log(`📢 User ${mentionedUser.id} mentioned by ${senderId}`);
      } catch (err) {
        console.error('❌ Error recording mention:', err);
      }
    }
  }
}

async function sendMentionNotification(userId: string, messageId: string, senderId: string, groupId: string): Promise<void> {
  const db = getDatabase();
  const aedes = getAedes();
  
  const sender = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(senderId) as { username: string; nickname?: string } | undefined;
  const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(groupId) as { name: string } | undefined;
  const message = db.prepare('SELECT content FROM messages WHERE id = ?').get(messageId) as { content: string } | undefined;
  
  if (!sender || !message) return;
  
  const notification = {
    type: 'mention',
    timestamp: new Date().toISOString(),
    payload: {
      messageId,
      sender: { userId: senderId, username: sender.username, nickname: sender.nickname },
      groupId,
      groupName: group?.name || 'Unknown Group',
      preview: message.content.substring(0, 100),
      mentionedContent: message.content
    }
  };
  
  aedes.publish({
    topic: `chat/user/${userId}/mention`,
    payload: Buffer.from(JSON.stringify(notification)),
    qos: 2,
    retain: false,
    cmd: 'publish',
    dup: false
  }, (err: Error | undefined) => {
    if (err) console.error('❌ Error sending mention notification:', err);
  });
}

async function processSubscriptions(messageId: string, senderId: string, groupId: string, content: string): Promise<void> {
  const db = getDatabase();
  const aedes = getAedes();
  
  const sender = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(senderId) as { username: string; nickname?: string } | undefined;
  const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(groupId) as { name: string } | undefined;
  const message = db.prepare('SELECT content FROM messages WHERE id = ?').get(messageId) as { content: string } | undefined;
  
  const subscriptions = db.prepare(`
    SELECT s.*, u.username, u.is_online
    FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    WHERE s.is_active = 1
    AND (s.group_id IS NULL OR s.group_id = ?)
  `).all(groupId) as DbSubscription[];
  
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
      const notification = {
        type: 'subscription_match',
        timestamp: new Date().toISOString(),
        payload: {
          matchType: sub.subscription_type,
          matchedValue: sub.subscription_value,
          message: {
            messageId,
            content: message?.content || '',
            sender: { userId: senderId, username: sender?.username || 'unknown' }
          },
          groupId,
          groupName: group?.name || 'Unknown Group'
        },
        meta: { subscriptionId: sub.id }
      };
      
      aedes.publish({
        topic: `chat/user/${sub.user_id}/subscription`,
        payload: Buffer.from(JSON.stringify(notification)),
        qos: 2,
        retain: false,
        cmd: 'publish',
        dup: false
      }, (err: Error | undefined) => {
        if (err) console.error('❌ Error sending subscription notification:', err);
      });
      
      console.log(`🔔 Subscription match for user ${sub.user_id}: ${sub.subscription_type}:${sub.subscription_value}`);
    }
  }
}
