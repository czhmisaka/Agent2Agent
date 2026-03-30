#!/usr/bin/env node

import * as readline from 'readline';
import { MqttClientService } from './mqtt/client';
import { HttpService } from './services/http';
import { AuthService } from './services/auth';
import { GroupService } from './services/group';
import { MessageService } from './services/message';
import { PeerService, createPeerService } from './services/peer';
import { CommandParser } from './cli/parser';
import { renderer } from './cli/renderer';
import chalk from 'chalk';

class ChatClient {
  private mqttClient: MqttClientService;
  private httpService: HttpService;
  private authService: AuthService;
  private groupService: GroupService;
  private messageService: MessageService;
  private peerService!: PeerService;
  private commandParser: CommandParser;
  private rl: readline.Interface;
  private isLoggedIn: boolean = false;
  private currentUser: any = null;
  private currentGroupId: string = '';
  private messageIdCounter: number = 0;

  constructor() {
    this.mqttClient = new MqttClientService();
    this.httpService = new HttpService();
    this.authService = new AuthService(this.httpService);
    this.groupService = new GroupService(this.httpService, this.mqttClient);
    this.messageService = new MessageService(this.httpService, this.mqttClient);
    this.commandParser = new CommandParser();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log(chalk.blue('╔══════════════════════════════════════════╗'));
    console.log(chalk.blue('║       MQTT Chat CLI v2.0 (Extended)      ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════╝'));
    console.log(chalk.gray('Connecting to server...'));
    
    try {
      // 连接 MQTT
      await this.mqttClient.connect();
      console.log(chalk.green('✅ Connected to MQTT server'));
      
      // 初始化点对点服务
      this.peerService = createPeerService(this.mqttClient as any);
      
      // 订阅消息
      this.subscribeToMessages();
      
      // 设置 PeerService 回调
      this.setupPeerCallbacks();
      
      // 显示帮助
      this.showHelp();
      
      // 开始命令行循环
      this.startCommandLoop();
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to connect:'), error);
      process.exit(1);
    }
  }

  private subscribeToMessages() {
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

  private setupPeerCallbacks() {
    this.peerService.setCallbacks({
      onActionReceived: (action) => {
        console.log(renderer.renderMessage({
          type: 'message_update',
          payload: action
        }));
      },
      onTypingReceived: (userId, username, isTyping) => {
        process.stdout.write(renderer.renderTyping(username, isTyping));
      },
      onAckReceived: (ack) => {
        if (!ack.success) {
          console.error(renderer.renderError(`Action failed: ${ack.error}`));
        }
      }
    });
  }

  private handleIncomingMessage(topic: string, message: any) {
    const output = renderer.renderMessage(message);
    if (output) {
      console.log(output);
    }
  }

  private handleMentionNotification(message: any) {
    console.log(renderer.renderMessage({
      type: 'mention',
      payload: message.payload
    }));
  }

  private handleSubscriptionNotification(message: any) {
    console.log(renderer.renderMessage({
      type: 'subscription_match',
      payload: message.payload
    }));
  }

  private handleActionResponse(message: any) {
    const { success, action, error } = message.payload;
    
    if (success) {
      switch (action) {
        case 'highlight':
          console.log(renderer.renderSuccess('Message highlighted'));
          break;
        case 'pin':
          console.log(renderer.renderSuccess('Message pinned'));
          break;
        case 'reaction':
          console.log(renderer.renderSuccess('Reaction added'));
          break;
        case 'recall':
          console.log(renderer.renderSuccess('Message recalled'));
          break;
        default:
          console.log(renderer.renderSuccess(`Action ${action} completed`));
      }
    } else {
      console.error(renderer.renderError(error || 'Action failed'));
    }
  }

  private handleAuthResponse(topic: string, message: any) {
    if (message.payload.success) {
      this.isLoggedIn = true;
      this.currentUser = {
        userId: message.payload.userId,
        username: message.payload.username,
        token: message.payload.token
      };
      
      // 设置用户信息到各服务
      renderer.setCurrentUsername(this.currentUser.username);
      this.peerService.setUserInfo(
        this.currentUser.userId,
        this.currentUser.username,
        this.currentUser.token
      );
      this.peerService.subscribeTopics();
      
      console.log(renderer.renderSuccess(`Logged in as ${this.currentUser.username}`));
      
      // 订阅用户的个人消息主题
      this.mqttClient.subscribe(`chat/user/${this.currentUser.userId}/mention`, (topic, message) => {
        this.handleMentionNotification(message);
      });
      
      this.mqttClient.subscribe(`chat/user/${this.currentUser.userId}/subscription`, (topic, message) => {
        this.handleSubscriptionNotification(message);
      });
    } else {
      console.error(renderer.renderError(message.payload.error || 'Authentication failed'));
    }
  }

  private requireLogin(): boolean {
    if (!this.authService.isAuthenticated()) {
      console.error(renderer.renderError('Please login first using /login <username> <password>'));
      return false;
    }
    return true;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  private showHelp() {
    console.log(renderer.renderHelp());
  }

  private startCommandLoop() {
    this.rl.question(chalk.blue('> '), async (input) => {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        this.startCommandLoop();
        return;
      }

      try {
        // 处理普通消息（不是以 / 开头的）
        if (!trimmedInput.startsWith('/')) {
          await this.processRegularMessage(trimmedInput);
        } else {
          await this.processCommand(trimmedInput);
        }
      } catch (error) {
        console.error(renderer.renderError(String(error)));
      }

      this.startCommandLoop();
    });
  }

  private async processRegularMessage(content: string) {
    if (!this.requireLogin()) return;
    
    if (!this.currentGroupId) {
      console.error(renderer.renderWarning('Please join a group first using /join <groupId>'));
      return;
    }

    const token = this.authService.getToken();
    const userId = this.authService.getUserId();

    if (token && userId) {
      this.messageService.setCredentials(userId, token);
      await this.messageService.sendMessage(this.currentGroupId, content, userId);
    }
  }

  private async processCommand(input: string) {
    const { command, args } = this.commandParser.parse(input);

    switch (command) {
      case 'login':
        if (args.length < 2) {
          console.log(renderer.renderError('Usage: /login <username> <password>'));
          return;
        }
        const loginSuccess = await this.authService.login(args[0], args[1]);
        if (loginSuccess) {
          // 使用 JWT token 作为密码重新连接 MQTT（认证在连接时完成，而非 payload）
          const token = this.authService.getToken();
          const username = this.authService.getUsername();
          if (token && username) {
            try {
              await this.mqttClient.reconnectWithCredentials({
                username,
                password: token
              });
              console.log(chalk.green('✅ MQTT reconnected with authentication'));
            } catch (error) {
              console.error(chalk.red('⚠️ MQTT reconnection failed, will continue without auth:'), error);
            }
          }
        }
        break;

      case 'register':
        if (args.length < 2) {
          console.log(renderer.renderError('Usage: /register <username> <password>'));
          return;
        }
        await this.authService.register(args[0], args[1]);
        break;

      case 'create':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /create <groupname>'));
          return;
        }
        const token = this.authService.getToken();
        const userId = this.authService.getUserId();
        if (token && userId) {
          this.groupService.setCredentials(userId, token);
          const result = await this.groupService.createGroup(args[0], token, userId);
          if (result) {
            this.currentGroupId = args[0]; // 使用 groupname 作为 ID
          }
        }
        break;

      case 'join':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /join <groupId>'));
          return;
        }
        const joinToken = this.authService.getToken();
        const joinUserId = this.authService.getUserId();
        if (joinToken && joinUserId) {
          this.groupService.setCredentials(joinUserId, joinToken);
          await this.groupService.joinGroup(args[0], joinToken, joinUserId);
          this.currentGroupId = args[0];
          console.log(renderer.renderInfo(`Switched to group: ${args[0]}`));
        }
        break;

      case 'leave':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /leave <groupId>'));
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
        if (!this.requireLogin()) return;
        const groupsToken = this.authService.getToken();
        if (groupsToken) {
          this.groupService.setToken(groupsToken);
          await this.groupService.listGroups();
        }
        break;

      case 'members':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /members <groupId>'));
          return;
        }
        const membersToken = this.authService.getToken();
        if (membersToken) {
          this.groupService.setToken(membersToken);
          await this.groupService.listMembers(args[0]);
        }
        break;

      case 'send':
        if (!this.requireLogin()) return;
        if (args.length < 2) {
          console.log(renderer.renderError('Usage: /send <groupId> <message>'));
          return;
        }
        const sendGroupId = args[0];
        const sendContent = args.slice(1).join(' ');
        const sendToken = this.authService.getToken();
        const sendUserId = this.authService.getUserId();
        if (sendToken && sendUserId) {
          this.messageService.setCredentials(sendUserId, sendToken);
          await this.messageService.sendMessage(sendGroupId, sendContent, sendUserId);
        }
        break;

      case 'history':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /history <groupId> [limit]'));
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
        if (!this.requireLogin()) return;
        const usersToken = this.authService.getToken();
        if (usersToken) {
          this.httpService.setToken(usersToken);
          await this.httpService.getUsers();
        }
        break;

      // ==================== 新增指令 ====================

      case 'highlight':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /highlight <messageId>'));
          return;
        }
        await this.sendAction('highlight', { messageId: args[0] });
        break;

      case 'pin':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /pin <messageId>'));
          return;
        }
        await this.sendAction('pin', { messageId: args[0] });
        break;

      case 'unpin':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /unpin <messageId>'));
          return;
        }
        await this.sendAction('unpin', { messageId: args[0] });
        break;

      case 'react':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /react <messageId> [emoji]'));
          return;
        }
        const emoji = args[1] || '👍';
        await this.sendAction('reaction', { messageId: args[0], emoji });
        break;

      case 'recall':
        if (!this.requireLogin()) return;
        if (args.length < 1) {
          console.log(renderer.renderError('Usage: /recall <messageId>'));
          return;
        }
        await this.sendAction('recall', { messageId: args[0] });
        break;

      case 'subscribe':
        if (!this.requireLogin()) return;
        if (args.length < 2) {
          console.log(renderer.renderError('Usage: /subscribe <keyword|topic|user> <value>'));
          return;
        }
        await this.sendAction('subscribe', { target: args[0], value: args[1] });
        break;

      case 'subscriptions':
        if (!this.requireLogin()) return;
        {
          const token = this.authService.getToken();
          const userId = this.authService.getUserId();
          if (token && userId) {
            this.groupService.setCredentials(userId, token);
            await this.groupService.getSubscriptions();
          }
        }
        break;

      case 'mention':
        if (!this.requireLogin()) return;
        {
          const token = this.authService.getToken();
          const userId = this.authService.getUserId();
          if (token && userId) {
            this.messageService.setCredentials(userId, token);
            await this.messageService.getMentions();
          }
        }
        break;

      case 'emoji':
        if (!this.requireLogin()) return;
        if (args[0] === 'add' && args.length >= 3) {
          await this.sendAction('emoji_add', { target: args[1], value: args[2] });
        } else {
          console.log(renderer.renderError('Usage: /emoji add <name> <emoji>'));
        }
        break;

      case 'stats':
        if (!this.requireLogin()) return;
        {
          const token = this.authService.getToken();
          const userId = this.authService.getUserId();
          if (token && userId) {
            this.messageService.setCredentials(userId, token);
            await this.messageService.getStats(args[0] || undefined);
          }
        }
        break;

      case 'clear':
        renderer.clear();
        break;

      case 'help':
        this.showHelp();
        break;

      case 'quit':
      case 'exit':
        console.log(renderer.renderInfo('Goodbye!'));
        this.mqttClient.disconnect();
        process.exit(0);
        break;

      default:
        console.error(renderer.renderError(`Unknown command: ${command}`));
        console.log(chalk.gray('Type /help for available commands'));
        break;
    }
  }

  private async sendAction(action: string, payload: any): Promise<void> {
    if (!this.currentGroupId) {
      console.error(renderer.renderWarning('Please join a group first'));
      return;
    }

    const message = {
      type: 'action',
      action,
      timestamp: new Date().toISOString(),
      payload,
      meta: {
        groupId: this.currentGroupId,
        correlationId: this.generateMessageId()
      }
    };

    await this.mqttClient.publish(
      `chat/group/${this.currentGroupId}/action`,
      JSON.stringify(message),
      1 as 1
    );
  }
}

// 启动客户端
const client = new ChatClient();
client.start().catch((error) => {
  console.error(renderer.renderError('Fatal error: ' + String(error)));
  process.exit(1);
});
