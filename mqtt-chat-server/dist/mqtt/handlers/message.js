"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
const sqlite_1 = require("../../database/sqlite");
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const broker_1 = require("../broker");
const action_1 = require("./action");
function handleMessage(client, topic, payload) {
    try {
        const message = JSON.parse(payload.toString());
        // 根据 topic 处理不同的消息
        if (topic.startsWith('chat/auth/')) {
            handleAuthMessage(client, topic, message);
        }
        else if (topic.startsWith('chat/group/')) {
            handleGroupMessage(client, topic, message);
        }
        else if (topic.startsWith('chat/user/')) {
            handlePrivateMessage(client, topic, message);
        }
        else if (topic.startsWith('chat/presence/')) {
            handlePresenceMessage(client, topic, message);
        }
        else if (topic.startsWith('chat/peer/')) {
            handlePeerMessage(client, topic, payload);
        }
    }
    catch (error) {
        console.error('❌ Error handling message:', error);
    }
}
function handleAuthMessage(client, topic, message) {
    const db = (0, sqlite_1.getDatabase)();
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
            const userId = (0, uuid_1.v4)();
            const passwordHash = bcrypt_1.default.hashSync(password, 10);
            db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`)
                .run(userId, username, passwordHash);
            const token = jsonwebtoken_1.default.sign({ userId, username }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
            sendResponse(client, responseTopic, {
                type: 'ack',
                timestamp: new Date().toISOString(),
                payload: { success: true, userId, username, token },
                meta: message.meta
            });
            console.log(`✅ User registered: ${username}`);
        }
        catch (error) {
            console.error('❌ Registration error:', error);
            sendResponse(client, responseTopic, {
                type: 'error',
                timestamp: new Date().toISOString(),
                payload: { success: false, error: 'Registration failed' },
                meta: message.meta
            });
        }
    }
    else if (topic === 'chat/auth/login') {
        const { username, password } = message.payload;
        try {
            const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
            if (!user) {
                sendResponse(client, responseTopic, {
                    type: 'ack',
                    timestamp: new Date().toISOString(),
                    payload: { success: false, error: 'Username or password incorrect', code: 1002 },
                    meta: message.meta
                });
                return;
            }
            if (!bcrypt_1.default.compareSync(password, user.password_hash)) {
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
            const token = jsonwebtoken_1.default.sign({ userId: user.id, username }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
            sendResponse(client, responseTopic, {
                type: 'ack',
                timestamp: new Date().toISOString(),
                payload: { success: true, userId: user.id, username: user.username, nickname: user.nickname, token },
                meta: message.meta
            });
            console.log(`✅ User logged in: ${username}`);
        }
        catch (error) {
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
function handleGroupMessage(client, topic, message) {
    const db = (0, sqlite_1.getDatabase)();
    const parts = topic.split('/');
    const action = parts[3];
    const groupId = parts[2];
    if (action === 'message') {
        const { userId, token, content } = message.payload;
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
            if (!membership) {
                console.log(`❌ User ${userId} not in group ${groupId}`);
                return;
            }
            const messageId = (0, uuid_1.v4)();
            db.prepare(`INSERT INTO messages (id, group_id, sender_id, content) VALUES (?, ?, ?, ?)`)
                .run(messageId, groupId, userId, content);
            const broadcastTopic = `chat/group/${groupId}/message`;
            const user = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(userId);
            sendBroadcast(broadcastTopic, {
                type: 'message',
                timestamp: new Date().toISOString(),
                payload: {
                    messageId,
                    content,
                    contentType: 'text',
                    sender: { userId, username: user.username, nickname: user.nickname }
                },
                meta: { groupId }
            }, client.id);
            // 处理提及和订阅
            processMentions(messageId, userId, groupId, content);
            processSubscriptions(messageId, userId, groupId, content);
        }
        catch (error) {
            console.error('❌ Error sending group message:', error);
        }
    }
    else if (action === 'join') {
        const { userId, token } = message.payload;
        try {
            jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            const group = db.prepare('SELECT * FROM groups WHERE id = ? AND is_active = 1').get(groupId);
            if (!group)
                return;
            const memberId = (0, uuid_1.v4)();
            db.prepare(`INSERT OR REPLACE INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'member')`)
                .run(memberId, groupId, userId);
            console.log(`✅ User ${userId} joined group ${groupId}`);
            sendBroadcast(`chat/group/${groupId}/message`, {
                type: 'system',
                timestamp: new Date().toISOString(),
                payload: { content: 'A new member joined the group', userId },
                meta: { groupId }
            }, client.id);
        }
        catch (error) {
            console.error('❌ Error joining group:', error);
        }
    }
    else if (action === 'leave') {
        const { userId, token } = message.payload;
        try {
            jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
                .run(groupId, userId);
            console.log(`👋 User ${userId} left group ${groupId}`);
            sendBroadcast(`chat/group/${groupId}/message`, {
                type: 'system',
                timestamp: new Date().toISOString(),
                payload: { content: 'A member left the group', userId },
                meta: { groupId }
            }, client.id);
        }
        catch (error) {
            console.error('❌ Error leaving group:', error);
        }
    }
    else if (action === 'action') {
        // 处理消息动作
        (0, action_1.handleMessageAction)(client, topic, Buffer.from(JSON.stringify(message)));
    }
}
function handlePrivateMessage(client, topic, message) {
    const db = (0, sqlite_1.getDatabase)();
    const parts = topic.split('/');
    const receiverId = parts[2];
    const { senderId, token, content } = message.payload;
    try {
        jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        const messageId = (0, uuid_1.v4)();
        db.prepare(`INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)`)
            .run(messageId, senderId, receiverId, content);
        const sender = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(senderId);
        sendToUser(receiverId, {
            type: 'message',
            timestamp: new Date().toISOString(),
            payload: {
                messageId,
                content,
                contentType: 'text',
                sender: { userId: senderId, username: sender.username, nickname: sender.nickname }
            },
            meta: { receiverId }
        });
    }
    catch (error) {
        console.error('❌ Error sending private message:', error);
    }
}
function handlePresenceMessage(client, topic, message) {
    const db = (0, sqlite_1.getDatabase)();
    const parts = topic.split('/');
    const userId = parts[2];
    const status = message.payload.status;
    try {
        if (status === 'online') {
            db.prepare('UPDATE users SET is_online = 1 WHERE id = ?').run(userId);
            console.log(`🟢 User ${userId} is online`);
        }
        else if (status === 'offline') {
            db.prepare('UPDATE users SET is_online = 0 WHERE id = ?').run(userId);
            console.log(`⚫ User ${userId} is offline`);
        }
    }
    catch (error) {
        console.error('❌ Error updating presence:', error);
    }
}
function handlePeerMessage(client, topic, rawPayload) {
    const parts = topic.split('/');
    const subTopic = parts[3];
    if (subTopic === 'action') {
        (0, action_1.handleMessageAction)(client, topic, rawPayload);
    }
    else if (subTopic === 'typing') {
        try {
            const msg = JSON.parse(rawPayload.toString());
            console.log(`💬 ${msg.payload?.sourceUsername || 'Unknown'} is typing...`);
        }
        catch (e) { }
    }
}
function sendResponse(client, topic, message) {
    const aedes = (0, broker_1.getAedes)();
    aedes.publish({
        topic,
        payload: Buffer.from(JSON.stringify(message)),
        qos: 1,
        retain: false,
        cmd: 'publish',
        dup: false
    }, (err) => {
        if (err)
            console.error('❌ Error sending response:', err);
    });
}
function sendBroadcast(topic, message, excludeClientId) {
    const aedes = (0, broker_1.getAedes)();
    aedes.publish({
        topic,
        payload: Buffer.from(JSON.stringify(message)),
        qos: 2,
        retain: false,
        cmd: 'publish',
        dup: false
    }, (err) => {
        if (err)
            console.error('❌ Error broadcasting:', err);
    });
}
function sendToUser(userId, message) {
    const aedes = (0, broker_1.getAedes)();
    aedes.publish({
        topic: `chat/user/${userId}/message`,
        payload: Buffer.from(JSON.stringify(message)),
        qos: 2,
        retain: false,
        cmd: 'publish',
        dup: false
    }, (err) => {
        if (err)
            console.error('❌ Error sending to user:', err);
    });
}
// ==================== 提及和订阅处理 ====================
function extractMentions(content) {
    const regex = /@([\w\u4e00-\u9fa5]+)/g;
    const matches = content.match(regex);
    if (!matches)
        return [];
    return [...new Set(matches.map(m => m.slice(1)))];
}
async function processMentions(messageId, senderId, groupId, content) {
    const db = (0, sqlite_1.getDatabase)();
    const mentions = extractMentions(content);
    for (const username of mentions) {
        if (['全体成员', '所有人', 'all', 'channel'].includes(username)) {
            const members = db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId);
            for (const member of members) {
                if (member.user_id !== senderId) {
                    await sendMentionNotification(member.user_id, messageId, senderId, groupId);
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
                await sendMentionNotification(mentionedUser.id, messageId, senderId, groupId);
                console.log(`📢 User ${mentionedUser.id} mentioned by ${senderId}`);
            }
            catch (err) {
                console.error('❌ Error recording mention:', err);
            }
        }
    }
}
async function sendMentionNotification(userId, messageId, senderId, groupId) {
    const db = (0, sqlite_1.getDatabase)();
    const aedes = (0, broker_1.getAedes)();
    const sender = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(senderId);
    const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(groupId);
    const message = db.prepare('SELECT content FROM messages WHERE id = ?').get(messageId);
    if (!sender || !message)
        return;
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
    }, (err) => {
        if (err)
            console.error('❌ Error sending mention notification:', err);
    });
}
async function processSubscriptions(messageId, senderId, groupId, content) {
    const db = (0, sqlite_1.getDatabase)();
    const aedes = (0, broker_1.getAedes)();
    const sender = db.prepare('SELECT username, nickname FROM users WHERE id = ?').get(senderId);
    const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(groupId);
    const message = db.prepare('SELECT content FROM messages WHERE id = ?').get(messageId);
    const subscriptions = db.prepare(`
    SELECT s.*, u.username, u.is_online
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
            }, (err) => {
                if (err)
                    console.error('❌ Error sending subscription notification:', err);
            });
            console.log(`🔔 Subscription match for user ${sub.user_id}: ${sub.subscription_type}:${sub.subscription_value}`);
        }
    }
}
//# sourceMappingURL=message.js.map