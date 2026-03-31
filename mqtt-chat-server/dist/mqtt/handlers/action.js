"use strict";
/**
 * 消息动作处理器
 * 处理高亮、置顶、反应、撤回等消息操作
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessageAction = handleMessageAction;
const sqlite_1 = require("../../database/sqlite");
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const broker_1 = require("../broker");
function handleMessageAction(client, topic, payload) {
    try {
        const message = JSON.parse(payload.toString());
        const { action, payload: actionPayload, meta } = message;
        // 验证 token
        if (!actionPayload.token) {
            sendActionResponse(client, topic, {
                success: false,
                action,
                error: 'Token is required',
                code: 4008
            }, meta?.correlationId);
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(actionPayload.token, config_1.config.jwt.secret);
        }
        catch (err) {
            sendActionResponse(client, topic, {
                success: false,
                action,
                error: 'Invalid or expired token',
                code: 1003
            }, meta?.correlationId);
            return;
        }
        const userId = decoded.userId;
        const groupId = meta?.groupId;
        // 处理不同的动作
        switch (action) {
            case 'highlight':
                handleHighlight(client, userId, actionPayload.messageId, groupId, action, meta?.correlationId);
                break;
            case 'pin':
                handlePin(client, userId, actionPayload.messageId, groupId, action, meta?.correlationId);
                break;
            case 'unpin':
                handleUnpin(client, userId, actionPayload.messageId, groupId, action, meta?.correlationId);
                break;
            case 'reaction':
                handleReaction(client, userId, actionPayload.messageId, actionPayload.emoji, groupId, action, meta?.correlationId);
                break;
            case 'recall':
                handleRecall(client, userId, actionPayload.messageId, groupId, action, meta?.correlationId);
                break;
            case 'subscribe':
                handleSubscribe(client, userId, actionPayload.target, actionPayload.value, groupId, action, meta?.correlationId);
                break;
            case 'unsubscribe':
                handleUnsubscribe(client, userId, actionPayload.target, actionPayload.value, action, meta?.correlationId);
                break;
            case 'emoji_add':
                handleEmojiAdd(client, userId, actionPayload.target, actionPayload.value, action, meta?.correlationId);
                break;
            case 'cmd_add':
                handleCmdAdd(client, userId, actionPayload.target, actionPayload.value, action, meta?.correlationId);
                break;
            default:
                sendActionResponse(client, topic, {
                    success: false,
                    action,
                    error: 'Unknown action type',
                    code: 4001
                }, meta?.correlationId);
        }
    }
    catch (error) {
        console.error('❌ Error handling message action:', error);
    }
}
function handleHighlight(client, userId, messageId, groupId, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 验证消息存在
        const message = db.prepare('SELECT * FROM messages WHERE id = ? AND group_id = ?').get(messageId, groupId);
        if (!message) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message not found',
                code: 4001
            }, correlationId);
            return;
        }
        // 检查是否已经是高亮
        const existing = db.prepare('SELECT * FROM message_flags WHERE message_id = ? AND flag_type = ?').get(messageId, 'highlight');
        if (existing) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message already highlighted',
                code: 4002
            }, correlationId);
            return;
        }
        // 添加高亮标记
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO message_flags (id, message_id, flag_type, user_id)
      VALUES (?, ?, ?, ?)
    `).run(id, messageId, 'highlight', userId);
        // 更新消息表
        db.prepare('UPDATE messages SET is_highlighted = 1 WHERE id = ?').run(messageId);
        // 广播更新
        broadcastMessageUpdate(groupId, messageId, 'highlight', true);
        // 发送确认
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: true,
            action,
            messageId,
            result: { highlighted: true }
        }, correlationId);
        console.log(`✅ Message ${messageId} highlighted by user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error highlighting message:', error);
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: false,
            action,
            error: 'Failed to highlight message'
        }, correlationId);
    }
}
function handlePin(client, userId, messageId, groupId, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 验证消息存在
        const message = db.prepare('SELECT * FROM messages WHERE id = ? AND group_id = ?').get(messageId, groupId);
        if (!message) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message not found',
                code: 4001
            }, correlationId);
            return;
        }
        // 检查是否已经置顶
        const existing = db.prepare('SELECT * FROM message_flags WHERE message_id = ? AND flag_type = ?').get(messageId, 'pin');
        if (existing) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message already pinned',
                code: 4002
            }, correlationId);
            return;
        }
        // 添加置顶标记
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO message_flags (id, message_id, flag_type, user_id)
      VALUES (?, ?, ?, ?)
    `).run(id, messageId, 'pin', userId);
        // 更新消息表
        db.prepare('UPDATE messages SET is_pinned = 1 WHERE id = ?').run(messageId);
        // 广播更新
        broadcastMessageUpdate(groupId, messageId, 'pin', true);
        // 发送确认
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: true,
            action,
            messageId,
            result: { pinned: true }
        }, correlationId);
        console.log(`✅ Message ${messageId} pinned by user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error pinning message:', error);
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: false,
            action,
            error: 'Failed to pin message'
        }, correlationId);
    }
}
function handleUnpin(client, userId, messageId, groupId, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 删除置顶标记
        const result = db.prepare('DELETE FROM message_flags WHERE message_id = ? AND flag_type = ?').run(messageId, 'pin');
        if (result.changes === 0) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message is not pinned',
                code: 4001
            }, correlationId);
            return;
        }
        // 更新消息表
        db.prepare('UPDATE messages SET is_pinned = 0 WHERE id = ?').run(messageId);
        // 广播更新
        broadcastMessageUpdate(groupId, messageId, 'pin', false);
        // 发送确认
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: true,
            action,
            messageId,
            result: { pinned: false }
        }, correlationId);
        console.log(`✅ Message ${messageId} unpinned by user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error unpinning message:', error);
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: false,
            action,
            error: 'Failed to unpin message'
        }, correlationId);
    }
}
function handleReaction(client, userId, messageId, emoji, groupId, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 验证消息存在
        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
        if (!message) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message not found',
                code: 4001
            }, correlationId);
            return;
        }
        // 检查是否已经添加过这个表情
        const existing = db.prepare('SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
            .get(messageId, userId, emoji);
        if (existing) {
            // 移除反应
            db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
                .run(messageId, userId, emoji);
            // 获取新的反应数量
            const countResult = db.prepare('SELECT COUNT(*) as count FROM message_reactions WHERE message_id = ? AND emoji = ?')
                .get(messageId, emoji);
            // 广播更新
            broadcastReactionsUpdate(groupId, messageId);
            // 发送确认
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: true,
                action,
                messageId,
                emoji,
                result: {
                    added: false,
                    count: countResult?.count || 0
                }
            }, correlationId);
            console.log(`✅ Reaction ${emoji} removed from message ${messageId} by user ${userId}`);
        }
        else {
            // 添加反应
            const id = (0, uuid_1.v4)();
            db.prepare(`
        INSERT INTO message_reactions (id, message_id, user_id, emoji)
        VALUES (?, ?, ?, ?)
      `).run(id, messageId, userId, emoji);
            // 获取新的反应数量
            const countResult = db.prepare('SELECT COUNT(*) as count FROM message_reactions WHERE message_id = ? AND emoji = ?')
                .get(messageId, emoji);
            // 更新表情使用统计
            db.prepare('UPDATE custom_emojis SET usage_count = usage_count + 1 WHERE emoji = ?').run(emoji);
            // 广播更新
            broadcastReactionsUpdate(groupId, messageId);
            // 发送确认
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: true,
                action,
                messageId,
                emoji,
                result: {
                    added: true,
                    count: countResult?.count || 1
                }
            }, correlationId);
            console.log(`✅ Reaction ${emoji} added to message ${messageId} by user ${userId}`);
        }
    }
    catch (error) {
        console.error('❌ Error handling reaction:', error);
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: false,
            action,
            error: 'Failed to handle reaction'
        }, correlationId);
    }
}
function handleRecall(client, userId, messageId, groupId, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 验证消息存在且属于当前用户
        const message = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(messageId, userId);
        if (!message) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message not found or you do not have permission to recall it',
                code: 4002
            }, correlationId);
            return;
        }
        // 检查消息是否已经撤回
        if (message.is_recalled) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Message already recalled',
                code: 4002
            }, correlationId);
            return;
        }
        // 标记消息为已撤回
        db.prepare('UPDATE messages SET is_recalled = 1 WHERE id = ?').run(messageId);
        // 广播撤回通知
        broadcastRecall(groupId, messageId, userId);
        // 发送确认
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: true,
            action,
            messageId,
            result: { recalled: true }
        }, correlationId);
        console.log(`✅ Message ${messageId} recalled by user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error recalling message:', error);
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: false,
            action,
            error: 'Failed to recall message'
        }, correlationId);
    }
}
function handleSubscribe(client, userId, type, value, groupId, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 验证类型
        if (!['keyword', 'topic', 'user'].includes(type)) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Invalid subscription type. Must be keyword, topic, or user',
                code: 4004
            }, correlationId);
            return;
        }
        // 检查是否已存在
        const existing = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE user_id = ? AND subscription_type = ? AND subscription_value = ?
    `).get(userId, type, value);
        if (existing) {
            sendActionResponse(client, `chat/group/${groupId}/action`, {
                success: false,
                action,
                error: 'Subscription already exists',
                code: 4005
            }, correlationId);
            return;
        }
        // 创建订阅
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO subscriptions (id, user_id, subscription_type, subscription_value, group_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, type, value, groupId || null);
        // 发送确认
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: true,
            action,
            result: {
                subscriptionId: id,
                type,
                value
            }
        }, correlationId);
        console.log(`✅ Subscription created: ${type}:${value} for user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error creating subscription:', error);
        sendActionResponse(client, `chat/group/${groupId}/action`, {
            success: false,
            action,
            error: 'Failed to create subscription'
        }, correlationId);
    }
}
function handleUnsubscribe(client, userId, type, value, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 删除订阅
        const result = db.prepare(`
      DELETE FROM subscriptions 
      WHERE user_id = ? AND subscription_type = ? AND subscription_value = ?
    `).run(userId, type, value);
        if (result.changes === 0) {
            sendActionResponse(client, `chat/user/${userId}/action`, {
                success: false,
                action,
                error: 'Subscription not found',
                code: 4004
            }, correlationId);
            return;
        }
        // 发送确认
        sendActionResponse(client, `chat/user/${userId}/action`, {
            success: true,
            action,
            result: {
                type,
                value,
                deleted: true
            }
        }, correlationId);
        console.log(`✅ Subscription deleted: ${type}:${value} for user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error deleting subscription:', error);
        sendActionResponse(client, `chat/user/${userId}/action`, {
            success: false,
            action,
            error: 'Failed to delete subscription'
        }, correlationId);
    }
}
function handleEmojiAdd(client, userId, name, emoji, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 检查是否已存在
        const existing = db.prepare('SELECT * FROM custom_emojis WHERE name = ?').get(name);
        if (existing) {
            sendActionResponse(client, `chat/user/${userId}/action`, {
                success: false,
                action,
                error: 'Emoji name already exists',
                code: 4006
            }, correlationId);
            return;
        }
        // 创建表情
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO custom_emojis (id, name, emoji, creator_id, is_public)
      VALUES (?, ?, ?, ?, 0)
    `).run(id, name, emoji, userId);
        // 发送确认
        sendActionResponse(client, `chat/user/${userId}/action`, {
            success: true,
            action,
            result: {
                id,
                name,
                emoji
            }
        }, correlationId);
        console.log(`✅ Custom emoji created: :${name}: ${emoji} by user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error creating emoji:', error);
        sendActionResponse(client, `chat/user/${userId}/action`, {
            success: false,
            action,
            error: 'Failed to create emoji'
        }, correlationId);
    }
}
function handleCmdAdd(client, userId, name, response, action, correlationId) {
    const db = (0, sqlite_1.getDatabase)();
    try {
        // 检查是否已存在
        const existing = db.prepare('SELECT * FROM custom_commands WHERE name = ?').get(name);
        if (existing) {
            sendActionResponse(client, `chat/user/${userId}/action`, {
                success: false,
                action,
                error: 'Command name already exists',
                code: 4007
            }, correlationId);
            return;
        }
        // 创建指令
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO custom_commands (id, name, description, response_template, creator_id, permissions)
      VALUES (?, ?, ?, ?, ?, 'all')
    `).run(id, name, `Custom command: ${name}`, response, userId);
        // 发送确认
        sendActionResponse(client, `chat/user/${userId}/action`, {
            success: true,
            action,
            result: {
                id,
                name,
                response
            }
        }, correlationId);
        console.log(`✅ Custom command created: /${name} by user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error creating command:', error);
        sendActionResponse(client, `chat/user/${userId}/action`, {
            success: false,
            action,
            error: 'Failed to create command'
        }, correlationId);
    }
}
function sendActionResponse(client, topic, response, correlationId) {
    const aedes = (0, broker_1.getAedes)();
    const responseTopic = `${topic}/response`;
    const message = {
        type: 'action_ack',
        timestamp: new Date().toISOString(),
        payload: {
            ...response,
            correlationId
        }
    };
    aedes.publish({
        topic: responseTopic,
        payload: Buffer.from(JSON.stringify(message)),
        qos: 1,
        retain: false,
        cmd: 'publish',
        dup: false
    }, (err) => {
        if (err) {
            console.error('❌ Error sending action response:', err);
        }
    });
}
function broadcastMessageUpdate(groupId, messageId, flagType, value) {
    const aedes = (0, broker_1.getAedes)();
    const message = {
        type: 'message_update',
        timestamp: new Date().toISOString(),
        payload: {
            messageId,
            flagType,
            value
        }
    };
    aedes.publish({
        topic: `chat/group/${groupId}/message`,
        payload: Buffer.from(JSON.stringify(message)),
        qos: 1,
        retain: false,
        cmd: 'publish',
        dup: false
    }, (err) => {
        if (err)
            console.error('❌ Broadcast error:', err);
    });
}
function broadcastReactionsUpdate(groupId, messageId) {
    const db = (0, sqlite_1.getDatabase)();
    // 获取消息的所有反应
    const reactions = db.prepare(`
    SELECT r.emoji, r.user_id, u.username
    FROM message_reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.message_id = ?
  `).all(messageId);
    // 按表情分组
    const reactionsByEmoji = new Map();
    for (const reaction of reactions) {
        if (!reactionsByEmoji.has(reaction.emoji)) {
            reactionsByEmoji.set(reaction.emoji, { count: 0, users: [] });
        }
        const entry = reactionsByEmoji.get(reaction.emoji);
        entry.count++;
        entry.users.push(reaction.username);
    }
    const formattedReactions = Array.from(reactionsByEmoji.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        users: data.users
    }));
    const aedes = (0, broker_1.getAedes)();
    const message = {
        type: 'reactions_update',
        timestamp: new Date().toISOString(),
        payload: {
            messageId,
            reactions: formattedReactions
        }
    };
    aedes.publish({
        topic: `chat/group/${groupId}/message`,
        payload: Buffer.from(JSON.stringify(message)),
        qos: 1,
        retain: false,
        cmd: 'publish',
        dup: false
    }, (err) => {
        if (err)
            console.error('❌ Broadcast reactions error:', err);
    });
}
function broadcastRecall(groupId, messageId, userId) {
    const aedes = (0, broker_1.getAedes)();
    const message = {
        type: 'message_recalled',
        timestamp: new Date().toISOString(),
        payload: {
            messageId,
            recalledBy: userId
        }
    };
    aedes.publish({
        topic: `chat/group/${groupId}/message`,
        payload: Buffer.from(JSON.stringify(message)),
        qos: 1,
        retain: false,
        cmd: 'publish',
        dup: false
    }, (err) => {
        if (err)
            console.error('❌ Broadcast recall error:', err);
    });
}
//# sourceMappingURL=action.js.map