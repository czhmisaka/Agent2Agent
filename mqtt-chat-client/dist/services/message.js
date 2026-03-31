"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const chalk_1 = __importDefault(require("chalk"));
const uuid_1 = require("uuid");
class MessageService {
    httpService;
    mqttClient;
    userId = null;
    token = null;
    constructor(httpService, mqttClient) {
        this.httpService = httpService;
        this.mqttClient = mqttClient;
    }
    setCredentials(userId, token) {
        this.userId = userId;
        this.token = token;
        this.httpService.setToken(token);
    }
    setToken(token) {
        this.token = token;
        this.httpService.setToken(token);
    }
    async sendMessage(groupId, content, userId) {
        try {
            if (!this.token) {
                console.error(chalk_1.default.red('❌ Not authenticated. Please login first.'));
                return false;
            }
            // 通过 MQTT 发送消息（传递 token 用于服务器验证）
            await this.mqttClient.publish(`chat/group/${groupId}/message`, {
                type: 'message',
                timestamp: new Date().toISOString(),
                payload: {
                    userId: userId,
                    token: this.token, // 添加 token
                    content
                },
                meta: {
                    messageId: (0, uuid_1.v4)(),
                    groupId
                }
            }, 2);
            console.log(chalk_1.default.green('✅ Message sent'));
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to send message:'), error);
            return false;
        }
    }
    async sendPrivateMessage(receiverId, content, senderId) {
        try {
            // 通过 MQTT 发送私聊消息（认证已在连接时完成，不再传递 token）
            await this.mqttClient.publish(`chat/user/${receiverId}/private`, {
                type: 'message',
                timestamp: new Date().toISOString(),
                payload: {
                    senderId: senderId,
                    content
                },
                meta: {
                    messageId: (0, uuid_1.v4)(),
                    receiverId
                }
            }, 2);
            console.log(chalk_1.default.green('✅ Private message sent'));
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to send private message:'), error);
            return false;
        }
    }
    async getHistory(groupId, limit = 50) {
        try {
            const messages = await this.httpService.getGroupMessages(groupId, limit);
            if (messages.length === 0) {
                console.log(chalk_1.default.yellow('\n📜 No messages in this group yet'));
                console.log(chalk_1.default.gray('  Be the first to say something!\n'));
                return;
            }
            console.log(chalk_1.default.yellow(`\n📜 Message History (last ${messages.length}):`));
            console.log(chalk_1.default.gray('─'.repeat(60)));
            messages.forEach((msg) => {
                const time = new Date(msg.created_at).toLocaleString();
                const sender = msg.nickname || msg.username;
                console.log(`${chalk_1.default.gray(time)}`);
                console.log(`${chalk_1.default.cyan(sender)}: ${msg.content}`);
            });
            console.log(chalk_1.default.gray('─'.repeat(60)));
            console.log();
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get message history:'), error);
        }
    }
    async getPrivateHistory(userId, limit = 50) {
        try {
            const messages = await this.httpService.getPrivateMessages(userId, limit);
            if (messages.length === 0) {
                console.log(chalk_1.default.yellow('\n📜 No private messages yet'));
                return;
            }
            console.log(chalk_1.default.yellow(`\n📜 Private Message History (last ${messages.length}):`));
            console.log(chalk_1.default.gray('─'.repeat(60)));
            messages.forEach((msg) => {
                const time = new Date(msg.created_at).toLocaleString();
                const sender = msg.sender_username;
                console.log(`${chalk_1.default.gray(time)}`);
                console.log(`${chalk_1.default.cyan(sender)}: ${msg.content}`);
            });
            console.log(chalk_1.default.gray('─'.repeat(60)));
            console.log();
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get private messages:'), error);
        }
    }
    async getMentions(limit = 50) {
        try {
            const result = await this.httpService.getMentions({ limit });
            const mentions = result?.mentions || [];
            if (!mentions || mentions.length === 0) {
                console.log(chalk_1.default.yellow('\n💬 You have no mentions yet.'));
                console.log(chalk_1.default.gray('  Mention someone with @username to get noticed\n'));
                return [];
            }
            console.log(chalk_1.default.yellow(`\n💬 Your Mentions (${result.total || mentions.length}):`));
            if (result.unreadCount > 0) {
                console.log(chalk_1.default.yellow(`  📬 Unread: ${result.unreadCount}`));
            }
            console.log(chalk_1.default.gray('─'.repeat(60)));
            mentions.forEach((mention, index) => {
                const time = new Date(mention.createdAt || mention.timestamp).toLocaleString();
                const sender = mention.senderUsername || mention.sender?.username || 'Unknown';
                const groupName = mention.groupName || mention.groupId || '';
                const unreadMark = mention.isRead ? '' : ' 🔵';
                console.log(`\n${index + 1}. ${chalk_1.default.gray(time)} ${chalk_1.default.yellow(`in ${groupName}`)}${unreadMark}`);
                console.log(`   ${chalk_1.default.cyan(sender)}: "${mention.content || mention.preview || ''}"`);
                console.log(`   ${chalk_1.default.gray(`[ID: ${mention.id}]`)}`);
            });
            console.log(chalk_1.default.gray('─'.repeat(60)));
            console.log(chalk_1.default.gray('\n  Commands: /mention read <序号> | /mention delete <序号> | /mention clear\n'));
            return mentions;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get mentions:'), error);
            return [];
        }
    }
    async deleteMention(mentionId) {
        return await this.httpService.deleteMention(mentionId);
    }
    async markMentionAsRead(mentionId) {
        return await this.httpService.markMentionAsRead(mentionId);
    }
    async clearMentions(filter = 'read') {
        return await this.httpService.deleteMentions(filter);
    }
    async markAllMentionsAsRead() {
        return await this.httpService.markAllMentionsAsRead();
    }
    async getStats(userId) {
        try {
            const stats = await this.httpService.getStats(userId);
            if (!stats) {
                console.log(chalk_1.default.yellow('\n📊 No stats available\n'));
                return;
            }
            const { totalMessages = 0, totalWords = 0, mentions = 0, reactions = 0, groupsJoined = 0, messagesReceived = 0 } = stats;
            console.log(chalk_1.default.yellow(`
${chalk_1.default.bold('📊 Message Statistics')}
${chalk_1.default.gray('─'.repeat(40))}
  📝 Total Messages Sent:  ${chalk_1.default.cyan(totalMessages)}
  📖 Total Words:          ${chalk_1.default.cyan(totalWords)}
  💬 Times Mentioned:      ${chalk_1.default.cyan(mentions)}
  👍 Reactions Received:   ${chalk_1.default.cyan(reactions)}
  👥 Groups Joined:        ${chalk_1.default.cyan(groupsJoined)}
  📥 Messages Received:     ${chalk_1.default.cyan(messagesReceived)}
${chalk_1.default.gray('─'.repeat(40))}
`));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get stats:'), error);
        }
    }
}
exports.MessageService = MessageService;
//# sourceMappingURL=message.js.map