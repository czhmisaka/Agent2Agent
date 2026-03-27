#!/usr/bin/env node
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
const readline = __importStar(require("readline"));
const client_1 = require("./mqtt/client");
const http_1 = require("./services/http");
const auth_1 = require("./services/auth");
const group_1 = require("./services/group");
const message_1 = require("./services/message");
const peer_1 = require("./services/peer");
const parser_1 = require("./cli/parser");
const renderer_1 = require("./cli/renderer");
const chalk_1 = __importDefault(require("chalk"));
class ChatClient {
    mqttClient;
    httpService;
    authService;
    groupService;
    messageService;
    peerService;
    commandParser;
    rl;
    isLoggedIn = false;
    currentUser = null;
    currentGroupId = '';
    messageIdCounter = 0;
    constructor() {
        this.mqttClient = new client_1.MqttClientService();
        this.httpService = new http_1.HttpService();
        this.authService = new auth_1.AuthService(this.httpService);
        this.groupService = new group_1.GroupService(this.httpService, this.mqttClient);
        this.messageService = new message_1.MessageService(this.httpService, this.mqttClient);
        this.commandParser = new parser_1.CommandParser();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    async start() {
        console.log(chalk_1.default.blue('╔══════════════════════════════════════════╗'));
        console.log(chalk_1.default.blue('║       MQTT Chat CLI v2.0 (Extended)      ║'));
        console.log(chalk_1.default.blue('╚══════════════════════════════════════════╝'));
        console.log(chalk_1.default.gray('Connecting to server...'));
        try {
            // 连接 MQTT
            await this.mqttClient.connect();
            console.log(chalk_1.default.green('✅ Connected to MQTT server'));
            // 初始化点对点服务
            this.peerService = (0, peer_1.createPeerService)(this.mqttClient);
            // 订阅消息
            this.subscribeToMessages();
            // 设置 PeerService 回调
            this.setupPeerCallbacks();
            // 显示帮助
            this.showHelp();
            // 开始命令行循环
            this.startCommandLoop();
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to connect:'), error);
            process.exit(1);
        }
    }
    subscribeToMessages() {
        // 订阅所有群组消息（实际应该只订阅已加入的群组）
        this.mqttClient.subscribe('chat/group/+/message', (topic, message) => {
            this.handleIncomingMessage(topic, message);
        });
        // 订阅认证响应
        this.mqttClient.subscribe('chat/auth/+/response', (topic, message) => {
            this.handleAuthResponse(topic, message);
        });
        // 订阅提及通知
        this.mqttClient.subscribe('chat/user/+/mention', (topic, message) => {
            this.handleMentionNotification(message);
        });
        // 订阅订阅匹配通知
        this.mqttClient.subscribe('chat/user/+/subscription', (topic, message) => {
            this.handleSubscriptionNotification(message);
        });
        // 订阅动作响应
        this.mqttClient.subscribe('chat/group/+/action/response', (topic, message) => {
            this.handleActionResponse(message);
        });
    }
    setupPeerCallbacks() {
        this.peerService.setCallbacks({
            onActionReceived: (action) => {
                console.log(renderer_1.renderer.renderMessage({
                    type: 'message_update',
                    payload: action
                }));
            },
            onTypingReceived: (userId, username, isTyping) => {
                process.stdout.write(renderer_1.renderer.renderTyping(username, isTyping));
            },
            onAckReceived: (ack) => {
                if (!ack.success) {
                    console.error(renderer_1.renderer.renderError(`Action failed: ${ack.error}`));
                }
            }
        });
    }
    handleIncomingMessage(topic, message) {
        const output = renderer_1.renderer.renderMessage(message);
        if (output) {
            console.log(output);
        }
    }
    handleMentionNotification(message) {
        console.log(renderer_1.renderer.renderMessage({
            type: 'mention',
            payload: message.payload
        }));
    }
    handleSubscriptionNotification(message) {
        console.log(renderer_1.renderer.renderMessage({
            type: 'subscription_match',
            payload: message.payload
        }));
    }
    handleActionResponse(message) {
        const { success, action, error } = message.payload;
        if (success) {
            switch (action) {
                case 'highlight':
                    console.log(renderer_1.renderer.renderSuccess('Message highlighted'));
                    break;
                case 'pin':
                    console.log(renderer_1.renderer.renderSuccess('Message pinned'));
                    break;
                case 'reaction':
                    console.log(renderer_1.renderer.renderSuccess('Reaction added'));
                    break;
                case 'recall':
                    console.log(renderer_1.renderer.renderSuccess('Message recalled'));
                    break;
                default:
                    console.log(renderer_1.renderer.renderSuccess(`Action ${action} completed`));
            }
        }
        else {
            console.error(renderer_1.renderer.renderError(error || 'Action failed'));
        }
    }
    handleAuthResponse(topic, message) {
        if (message.payload.success) {
            this.isLoggedIn = true;
            this.currentUser = {
                userId: message.payload.userId,
                username: message.payload.username,
                token: message.payload.token
            };
            // 设置用户信息到各服务
            renderer_1.renderer.setCurrentUsername(this.currentUser.username);
            this.peerService.setUserInfo(this.currentUser.userId, this.currentUser.username, this.currentUser.token);
            this.peerService.subscribeTopics();
            console.log(renderer_1.renderer.renderSuccess(`Logged in as ${this.currentUser.username}`));
            // 订阅用户的个人消息主题
            this.mqttClient.subscribe(`chat/user/${this.currentUser.userId}/mention`, (topic, message) => {
                this.handleMentionNotification(message);
            });
            this.mqttClient.subscribe(`chat/user/${this.currentUser.userId}/subscription`, (topic, message) => {
                this.handleSubscriptionNotification(message);
            });
        }
        else {
            console.error(renderer_1.renderer.renderError(message.payload.error || 'Authentication failed'));
        }
    }
    requireLogin() {
        if (!this.authService.isAuthenticated()) {
            console.error(renderer_1.renderer.renderError('Please login first using /login <username> <password>'));
            return false;
        }
        return true;
    }
    generateMessageId() {
        return `msg_${Date.now()}_${++this.messageIdCounter}`;
    }
    showHelp() {
        console.log(renderer_1.renderer.renderHelp());
    }
    startCommandLoop() {
        this.rl.question(chalk_1.default.blue('> '), async (input) => {
            const trimmedInput = input.trim();
            if (!trimmedInput) {
                this.startCommandLoop();
                return;
            }
            try {
                // 处理普通消息（不是以 / 开头的）
                if (!trimmedInput.startsWith('/')) {
                    await this.processRegularMessage(trimmedInput);
                }
                else {
                    await this.processCommand(trimmedInput);
                }
            }
            catch (error) {
                console.error(renderer_1.renderer.renderError(String(error)));
            }
            this.startCommandLoop();
        });
    }
    async processRegularMessage(content) {
        if (!this.requireLogin())
            return;
        if (!this.currentGroupId) {
            console.error(renderer_1.renderer.renderWarning('Please join a group first using /join <groupId>'));
            return;
        }
        const token = this.authService.getToken();
        const userId = this.authService.getUserId();
        if (token && userId) {
            this.messageService.setCredentials(userId, token);
            await this.messageService.sendMessage(this.currentGroupId, content, token, userId);
        }
    }
    async processCommand(input) {
        const { command, args } = this.commandParser.parse(input);
        switch (command) {
            case 'login':
                if (args.length < 2) {
                    console.log(renderer_1.renderer.renderError('Usage: /login <username> <password>'));
                    return;
                }
                await this.authService.login(args[0], args[1]);
                break;
            case 'register':
                if (args.length < 2) {
                    console.log(renderer_1.renderer.renderError('Usage: /register <username> <password>'));
                    return;
                }
                await this.authService.register(args[0], args[1]);
                break;
            case 'create':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /create <groupname>'));
                    return;
                }
                const createResult = await this.authService.login(args[0], args[1]);
                if (createResult) {
                    const token = this.authService.getToken();
                    const userId = this.authService.getUserId();
                    this.groupService.setCredentials(userId, token);
                    const result = await this.groupService.createGroup(args[0], token, userId);
                    if (result) {
                        this.currentGroupId = args[0]; // 使用 groupname 作为 ID
                    }
                }
                break;
            case 'join':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /join <groupId>'));
                    return;
                }
                const joinToken = this.authService.getToken();
                const joinUserId = this.authService.getUserId();
                if (joinToken && joinUserId) {
                    this.groupService.setCredentials(joinUserId, joinToken);
                    await this.groupService.joinGroup(args[0], joinToken, joinUserId);
                    this.currentGroupId = args[0];
                    console.log(renderer_1.renderer.renderInfo(`Switched to group: ${args[0]}`));
                }
                break;
            case 'leave':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /leave <groupId>'));
                    return;
                }
                const leaveToken = this.authService.getToken();
                const leaveUserId = this.authService.getUserId();
                if (leaveToken && leaveUserId) {
                    this.groupService.setCredentials(leaveUserId, leaveToken);
                    await this.groupService.leaveGroup(args[0], leaveToken, leaveUserId);
                    if (this.currentGroupId === args[0]) {
                        this.currentGroupId = '';
                    }
                }
                break;
            case 'groups':
                if (!this.requireLogin())
                    return;
                const groupsToken = this.authService.getToken();
                if (groupsToken) {
                    this.groupService.setToken(groupsToken);
                    await this.groupService.listGroups();
                }
                break;
            case 'members':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /members <groupId>'));
                    return;
                }
                const membersToken = this.authService.getToken();
                if (membersToken) {
                    this.groupService.setToken(membersToken);
                    await this.groupService.listMembers(args[0]);
                }
                break;
            case 'send':
                if (!this.requireLogin())
                    return;
                if (args.length < 2) {
                    console.log(renderer_1.renderer.renderError('Usage: /send <groupId> <message>'));
                    return;
                }
                const sendGroupId = args[0];
                const sendContent = args.slice(1).join(' ');
                const sendToken = this.authService.getToken();
                const sendUserId = this.authService.getUserId();
                if (sendToken && sendUserId) {
                    this.messageService.setCredentials(sendUserId, sendToken);
                    await this.messageService.sendMessage(sendGroupId, sendContent, sendToken, sendUserId);
                }
                break;
            case 'history':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /history <groupId> [limit]'));
                    return;
                }
                const historyLimit = args[1] ? parseInt(args[1]) : 50;
                const historyToken = this.authService.getToken();
                if (historyToken) {
                    this.messageService.setToken(historyToken);
                    await this.messageService.getHistory(args[0], historyLimit);
                }
                break;
            case 'users':
                if (!this.requireLogin())
                    return;
                const usersToken = this.authService.getToken();
                if (usersToken) {
                    this.httpService.setToken(usersToken);
                    await this.httpService.getUsers();
                }
                break;
            // ==================== 新增指令 ====================
            case 'highlight':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /highlight <messageId>'));
                    return;
                }
                await this.sendAction('highlight', { messageId: args[0] });
                break;
            case 'pin':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /pin <messageId>'));
                    return;
                }
                await this.sendAction('pin', { messageId: args[0] });
                break;
            case 'unpin':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /unpin <messageId>'));
                    return;
                }
                await this.sendAction('unpin', { messageId: args[0] });
                break;
            case 'react':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /react <messageId> [emoji]'));
                    return;
                }
                const emoji = args[1] || '👍';
                await this.sendAction('reaction', { messageId: args[0], emoji });
                break;
            case 'recall':
                if (!this.requireLogin())
                    return;
                if (args.length < 1) {
                    console.log(renderer_1.renderer.renderError('Usage: /recall <messageId>'));
                    return;
                }
                await this.sendAction('recall', { messageId: args[0] });
                break;
            case 'subscribe':
                if (!this.requireLogin())
                    return;
                if (args.length < 2) {
                    console.log(renderer_1.renderer.renderError('Usage: /subscribe <keyword|topic|user> <value>'));
                    return;
                }
                await this.sendAction('subscribe', { target: args[0], value: args[1] });
                break;
            case 'subscriptions':
                if (!this.requireLogin())
                    return;
                console.log(renderer_1.renderer.renderInfo('Viewing your subscriptions...'));
                // TODO: 实现查看订阅列表
                break;
            case 'mention':
                if (!this.requireLogin())
                    return;
                console.log(renderer_1.renderer.renderInfo('Viewing mentions...'));
                // TODO: 实现查看提及列表
                break;
            case 'emoji':
                if (!this.requireLogin())
                    return;
                if (args[0] === 'add' && args.length >= 3) {
                    await this.sendAction('emoji_add', { target: args[1], value: args[2] });
                }
                else {
                    console.log(renderer_1.renderer.renderError('Usage: /emoji add <name> <emoji>'));
                }
                break;
            case 'stats':
                if (!this.requireLogin())
                    return;
                console.log(renderer_1.renderer.renderInfo('Fetching stats...'));
                // TODO: 实现统计功能
                break;
            case 'clear':
                renderer_1.renderer.clear();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'quit':
            case 'exit':
                console.log(renderer_1.renderer.renderInfo('Goodbye!'));
                this.mqttClient.disconnect();
                process.exit(0);
                break;
            default:
                console.error(renderer_1.renderer.renderError(`Unknown command: ${command}`));
                console.log(chalk_1.default.gray('Type /help for available commands'));
                break;
        }
    }
    async sendAction(action, payload) {
        if (!this.currentGroupId) {
            console.error(renderer_1.renderer.renderWarning('Please join a group first'));
            return;
        }
        const token = this.authService.getToken();
        if (!token)
            return;
        const message = {
            type: 'action',
            action,
            timestamp: new Date().toISOString(),
            payload: {
                ...payload,
                token
            },
            meta: {
                groupId: this.currentGroupId,
                correlationId: this.generateMessageId()
            }
        };
        await this.mqttClient.publish(`chat/group/${this.currentGroupId}/action`, JSON.stringify(message), 1);
    }
}
// 启动客户端
const client = new ChatClient();
client.start().catch((error) => {
    console.error(renderer_1.renderer.renderError('Fatal error: ' + String(error)));
    process.exit(1);
});
//# sourceMappingURL=index.js.map