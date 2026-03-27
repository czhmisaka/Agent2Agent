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
    async sendMessage(groupId, content, token, userId) {
        try {
            // 通过 MQTT 发送消息
            await this.mqttClient.publish(`chat/group/${groupId}/message`, {
                type: 'message',
                timestamp: new Date().toISOString(),
                payload: {
                    userId: userId,
                    token: token,
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
    async sendPrivateMessage(receiverId, content, token, senderId) {
        try {
            // 通过 MQTT 发送私聊消息
            await this.mqttClient.publish(`chat/user/${receiverId}/private`, {
                type: 'message',
                timestamp: new Date().toISOString(),
                payload: {
                    senderId: senderId,
                    token: token,
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
}
exports.MessageService = MessageService;
//# sourceMappingURL=message.js.map