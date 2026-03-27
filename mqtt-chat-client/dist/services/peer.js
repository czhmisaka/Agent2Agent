"use strict";
/**
 * 点对点通信服务
 * 实现客户端之间的实时指令交互
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerService = void 0;
exports.createPeerService = createPeerService;
exports.getPeerService = getPeerService;
const uuid_1 = require("uuid");
const chalk_1 = __importDefault(require("chalk"));
class PeerService {
    mqttClient; // MQTT client
    userId = '';
    username = '';
    token = '';
    // 待确认的动作
    pendingActions = new Map();
    // 动作超时时间（毫秒）
    ACK_TIMEOUT = 5000;
    // 最大重试次数
    MAX_RETRIES = 3;
    // 打字状态
    typingUsers = new Map();
    // 回调函数
    onActionReceived;
    onTypingReceived;
    onAckReceived;
    constructor(mqttClient) {
        this.mqttClient = mqttClient;
    }
    /**
     * 设置用户信息
     */
    setUserInfo(userId, username, token) {
        this.userId = userId;
        this.username = username;
        this.token = token;
    }
    /**
     * 设置回调函数
     */
    setCallbacks(callbacks) {
        this.onActionReceived = callbacks.onActionReceived;
        this.onTypingReceived = callbacks.onTypingReceived;
        this.onAckReceived = callbacks.onAckReceived;
    }
    /**
     * 订阅点对点主题
     */
    subscribeTopics() {
        if (!this.mqttClient)
            return;
        // 订阅动作主题
        this.mqttClient.subscribe(`chat/peer/${this.userId}/action`, (err) => {
            if (err) {
                console.error(chalk_1.default.red('❌ Subscribe action topic failed:'), err);
            }
            else {
                console.log(chalk_1.default.green('✅ Subscribed to peer action topic'));
            }
        });
        // 订阅确认主题
        this.mqttClient.subscribe(`chat/peer/${this.userId}/ack`, (err) => {
            if (err) {
                console.error(chalk_1.default.red('❌ Subscribe ack topic failed:'), err);
            }
            else {
                console.log(chalk_1.default.green('✅ Subscribed to peer ack topic'));
            }
        });
        // 订阅打字状态主题
        this.mqttClient.subscribe(`chat/peer/${this.userId}/typing`, (err) => {
            if (err) {
                console.error(chalk_1.default.red('❌ Subscribe typing topic failed:'), err);
            }
            else {
                console.log(chalk_1.default.green('✅ Subscribed to typing topic'));
            }
        });
    }
    /**
     * 发送点对点动作
     */
    async sendPeerAction(targetUserId, action, payload, options = {}) {
        if (!this.mqttClient) {
            throw new Error('MQTT client not initialized');
        }
        const correlationId = (0, uuid_1.v4)();
        const { needPersistence = false, groupId, messageId, emoji, isActive } = options;
        // 构建消息
        const message = {
            type: 'peer_action',
            action,
            timestamp: new Date().toISOString(),
            payload: {
                sourceUserId: this.userId,
                sourceUsername: this.username,
                groupId,
                messageId,
                emoji,
                isActive
            },
            meta: {
                needPersistence,
                correlationId
            }
        };
        // 立即发送到目标客户端
        try {
            await this.mqttClient.publish(`chat/peer/${targetUserId}/action`, JSON.stringify(message), { qos: 1 });
            console.log(chalk_1.default.gray(`📤 Sent peer action: ${action} to ${targetUserId}`));
        }
        catch (err) {
            console.error(chalk_1.default.red('❌ Send peer action failed:'), err);
            throw err;
        }
        // 如果需要持久化，同时发送到服务端
        if (needPersistence) {
            this.addPendingAction(correlationId, action, payload);
            try {
                await this.mqttClient.publish(`chat/group/${groupId}/action`, JSON.stringify({
                    type: 'action',
                    action,
                    timestamp: new Date().toISOString(),
                    payload: {
                        messageId,
                        emoji,
                        token: this.token,
                        userId: this.userId
                    },
                    meta: {
                        groupId,
                        correlationId
                    }
                }), { qos: 1 });
            }
            catch (err) {
                console.error(chalk_1.default.red('❌ Send to server failed:'), err);
            }
        }
        return correlationId;
    }
    /**
     * 发送打字状态（不需要持久化）
     */
    async sendTypingStatus(targetUserId, groupId, isTyping) {
        if (!this.mqttClient)
            return;
        const message = {
            type: 'typing',
            timestamp: new Date().toISOString(),
            payload: {
                sourceUserId: this.userId,
                sourceUsername: this.username,
                groupId,
                isTyping
            }
        };
        try {
            await this.mqttClient.publish(`chat/peer/${targetUserId}/typing`, JSON.stringify(message), { qos: 0 });
        }
        catch (err) {
            // 打字状态可以失败，不抛出错误
            console.debug(chalk_1.default.gray('📤 Typing status send failed (ignored):'), err);
        }
    }
    /**
     * 广播动作到群组所有成员（除了自己）
     */
    async broadcastToGroup(groupId, memberIds, action, payload) {
        const promises = memberIds
            .filter(id => id !== this.userId)
            .map(id => this.sendPeerAction(id, action, payload, {
            needPersistence: true,
            groupId,
            ...payload
        }));
        await Promise.allSettled(promises);
    }
    /**
     * 处理接收到的点对点动作
     */
    handlePeerAction(message) {
        const { action, payload, meta } = message;
        console.log(chalk_1.default.cyan(`📥 Received peer action: ${action}`));
        // 执行本地动作
        if (this.onActionReceived) {
            this.onActionReceived({
                action,
                sourceUserId: payload.sourceUserId,
                sourceUsername: payload.sourceUsername,
                messageId: payload.messageId,
                emoji: payload.emoji,
                isActive: payload.isActive,
                timestamp: message.timestamp
            });
        }
        // 如果需要持久化，等待服务端确认
        if (meta?.needPersistence) {
            this.waitForServerAck(meta.correlationId);
        }
    }
    /**
     * 处理接收到的确认
     */
    handlePeerAck(message) {
        const { correlationId, success, action, result, error } = message.payload;
        console.log(chalk_1.default.cyan(`📥 Received peer ack: ${action} (${success ? 'success' : 'failed'})`));
        // 清除待确认动作
        if (success) {
            this.clearPendingAction(correlationId);
        }
        else {
            // 确认失败，回滚本地动作
            this.rollbackLocalAction(action, message.payload);
        }
        // 调用回调
        if (this.onAckReceived) {
            this.onAckReceived({
                correlationId,
                success,
                action,
                result,
                error
            });
        }
    }
    /**
     * 处理接收到的打字状态
     */
    handleTypingStatus(message) {
        const { payload } = message;
        if (this.onTypingReceived) {
            this.onTypingReceived(payload.sourceUserId, payload.sourceUsername, payload.isTyping);
        }
        // 自动清除打字状态
        if (payload.isTyping) {
            this.setTypingTimeout(payload.sourceUserId);
        }
    }
    /**
     * 添加待确认动作
     */
    addPendingAction(correlationId, action, payload) {
        this.pendingActions.set(correlationId, {
            action,
            payload,
            timestamp: Date.now(),
            retryCount: 0
        });
        // 设置超时
        setTimeout(() => {
            this.handleAckTimeout(correlationId);
        }, this.ACK_TIMEOUT);
    }
    /**
     * 清除待确认动作
     */
    clearPendingAction(correlationId) {
        this.pendingActions.delete(correlationId);
    }
    /**
     * 处理确认超时
     */
    handleAckTimeout(correlationId) {
        const pending = this.pendingActions.get(correlationId);
        if (!pending)
            return;
        if (pending.retryCount < this.MAX_RETRIES) {
            // 重试
            pending.retryCount++;
            pending.timestamp = Date.now();
            console.log(chalk_1.default.yellow(`⏳ Retry pending action: ${pending.action} (${pending.retryCount}/${this.MAX_RETRIES})`));
            setTimeout(() => {
                this.handleAckTimeout(correlationId);
            }, this.ACK_TIMEOUT);
        }
        else {
            // 超过最大重试次数，放弃
            this.pendingActions.delete(correlationId);
            console.error(chalk_1.default.red(`❌ Action timeout: ${pending.action}`));
            // 通知用户
            this.notifyActionFailed(pending.action);
        }
    }
    /**
     * 等待服务端确认
     */
    waitForServerAck(correlationId) {
        // 超时处理已在 addPendingAction 中设置
        // 这里主要是确保动作在等待确认期间不会重复发送
    }
    /**
     * 回滚本地动作
     */
    rollbackLocalAction(action, payload) {
        console.warn(chalk_1.default.yellow(`↩️ Rollback local action: ${action}`));
        // 根据动作类型执行回滚
        switch (action) {
            case 'reaction':
                // 移除反应显示
                this.notifyReactionRemoved(payload.messageId, payload.emoji);
                break;
            case 'highlight':
                // 移除高亮显示
                this.notifyHighlightRemoved(payload.messageId);
                break;
            case 'pin':
                // 移除置顶显示
                this.notifyPinRemoved(payload.messageId);
                break;
            default:
                console.warn(chalk_1.default.yellow(`Unknown action to rollback: ${action}`));
        }
    }
    /**
     * 通知动作失败
     */
    notifyActionFailed(action) {
        switch (action) {
            case 'reaction':
                console.error(chalk_1.default.red('❌ Failed to add reaction. Please try again.'));
                break;
            case 'highlight':
                console.error(chalk_1.default.red('❌ Failed to highlight message. Please try again.'));
                break;
            case 'pin':
                console.error(chalk_1.default.red('❌ Failed to pin message. Please try again.'));
                break;
            default:
                console.error(chalk_1.default.red(`❌ Action failed: ${action}`));
        }
    }
    /**
     * 通知反应被移除
     */
    notifyReactionRemoved(messageId, emoji) {
        if (this.onActionReceived) {
            this.onActionReceived({
                action: 'reaction_removed',
                sourceUserId: this.userId,
                sourceUsername: this.username,
                messageId,
                emoji,
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * 通知高亮被移除
     */
    notifyHighlightRemoved(messageId) {
        if (this.onActionReceived) {
            this.onActionReceived({
                action: 'highlight_removed',
                sourceUserId: this.userId,
                sourceUsername: this.username,
                messageId,
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * 通知置顶被移除
     */
    notifyPinRemoved(messageId) {
        if (this.onActionReceived) {
            this.onActionReceived({
                action: 'pin_removed',
                sourceUserId: this.userId,
                sourceUsername: this.username,
                messageId,
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * 设置打字超时
     */
    setTypingTimeout(userId) {
        // 清除之前的超时
        const existing = this.typingUsers.get(userId);
        if (existing) {
            clearTimeout(existing);
        }
        // 设置新的超时（3秒后自动清除）
        const timeout = setTimeout(() => {
            this.typingUsers.delete(userId);
            if (this.onTypingReceived) {
                this.onTypingReceived(userId, '', false);
            }
        }, 3000);
        this.typingUsers.set(userId, timeout);
    }
    /**
     * 清理资源
     */
    cleanup() {
        // 清除所有打字超时
        this.typingUsers.forEach((timeout) => {
            clearTimeout(timeout);
        });
        this.typingUsers.clear();
        // 清除待确认动作
        this.pendingActions.clear();
    }
    /**
     * 获取待确认动作数量
     */
    getPendingCount() {
        return this.pendingActions.size;
    }
    /**
     * 检查是否有活跃的待确认动作
     */
    hasPendingActions() {
        return this.pendingActions.size > 0;
    }
}
exports.PeerService = PeerService;
// 导出单例工厂
let peerServiceInstance = null;
function createPeerService(mqttClient) {
    if (!peerServiceInstance) {
        peerServiceInstance = new PeerService(mqttClient);
    }
    return peerServiceInstance;
}
function getPeerService() {
    return peerServiceInstance;
}
//# sourceMappingURL=peer.js.map