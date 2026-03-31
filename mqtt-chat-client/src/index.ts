#!/usr/bin/env node

import * as readline from 'readline';
import minimist from 'minimist';
import { MqttClientService } from './mqtt/client';
import { HttpService } from './services/http';
import { AuthService } from './services/auth';
import { GroupService } from './services/group';
import { MessageService } from './services/message';
import { PeerService, createPeerService } from './services/peer';
import { CommandParser } from './cli/parser';
import { renderer } from './cli/renderer';
import chalk from 'chalk';

interface OnlineUser {
  userId: string;
  username: string;
}

interface CliOptions {
  validate?: boolean;
  daemon?: boolean;
  username?: string;
  password?: string;
  groupId?: string;
  message?: string;
}

class ChatClient {
  private mqttClient: MqttClientService;
  private httpService: HttpService;
  private authService: AuthService;
  private groupService: GroupService;
  private messageService: MessageService;
  private peerService!: PeerService;
  private commandParser: CommandParser;
  private rl!: readline.Interface;
  private isLoggedIn: boolean = false;
  private currentUser: any = null;
  private currentGroupId: string = '';
  private messageIdCounter: number = 0;
  private onlineUsers: OnlineUser[] = [];
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private isDaemonMode: boolean = false;
  private mentionsCache: any[] = [];

  constructor() {
    this.mqttClient = new MqttClientService();
    this.httpService = new HttpService();
    this.authService = new AuthService(this.httpService);
    this.groupService = new GroupService(this.httpService, this.mqttClient);
    this.messageService = new MessageService(this.httpService, this.mqttClient);
    this.commandParser = new CommandParser();
  }

  /**
   * 解析命令行参数
   */
  private parseArgs(): CliOptions {
    const argv = minimist(process.argv.slice(2));
    const options: CliOptions = {};

    // 检查是否只是验证模式
    if (argv.validate || argv.v) {
      options.validate = true;
    }

    // 检查是否为守护模式
    if (argv.daemon || argv.d) {
      options.daemon = true;
    }

    // 位置参数：username, password, groupId, message
    const positional = argv._;

    if (positional.length >= 2) {
      options.username = positional[0];
      options.password = positional[1];
    }

    if (positional.length >= 3) {
      options.groupId = positional[2];
    }

    if (positional.length >= 4) {
      options.message = positional.slice(3).join(' ');
    }

    return options;
  }

  /**
   * Tab 补全函数
   */
  private completer(line: string): [string[], string] | null {
    const trigger = this.commandParser.detectCompletionTrigger(line);

    switch (trigger) {
      case 'command':
        return [this.commandParser.getCommandCompletions(line), line];

      case 'mention':
        // @ 触发交互式用户选择
        const searchTerm = line.substring(1);
        const matches = this.onlineUsers.filter(u => 
          u.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return [matches.map(u => `@${u.username}`), line];

      case 'emoji':
        return [this.commandParser.getEmojiCompletions(line), line];

      case 'subscribe':
        return [this.commandParser.getSubscribeCompletions(), line];

      default:
        return [[], line];
    }
  }

  /**
   * 初始化 readline 接口
   */
  private initReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (line: string) => this.completer(line),
      terminal: true
    });

    // 启用终端样式支持
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode!(true);
    }
  }

  async start() {
    // 解析命令行参数
    const options = this.parseArgs();

    // 显示欢迎信息
    console.log(chalk.blue('╔══════════════════════════════════════════╗'));
    console.log(chalk.blue('║       MQTT Chat CLI v2.0 (Extended)      ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════╝'));
    console.log();

    // 检查是否为命令行模式
    if (options.username && options.password) {
      // 命令行模式
      await this.startCommandLineMode(options);
    } else {
      // 交互模式
      await this.startInteractiveMode();
    }
  }

  /**
   * 命令行模式 - 单行指令执行
   */
  private async startCommandLineMode(options: CliOptions) {
    console.log(chalk.gray('📡 Connecting...'));
    console.log();

    const { username, password, groupId, message, validate } = options;

    // 验证模式
    if (validate) {
      const success = await this.authService.login(username!, password!);
      if (success) {
        console.log(chalk.green('✅ Credentials valid'));
      } else {
        console.log(chalk.red('❌ Invalid credentials'));
        process.exit(1);
      }
      return;
    }

    // 登录
    console.log(chalk.gray(`🔐 Logging in as ${username}...`));
    const loginSuccess = await this.authService.login(username!, password!);

    if (!loginSuccess) {
      console.log(chalk.red('❌ Login failed'));
      process.exit(1);
    }

    console.log(chalk.green('✅ Logged in successfully'));

    // 连接 MQTT
    const token = this.authService.getToken();
    const userId = this.authService.getUserId();

    if (token && userId) {
      try {
        await this.mqttClient.connect({ username: username!, password: token });
        console.log(chalk.green('✅ Connected to MQTT server'));

        // 初始化服务
        this.peerService = createPeerService(this.mqttClient as any);
        this.subscribeToMessages();
        this.setupPeerCallbacks();
        this.peerService.setUserInfo(userId, username!, token);
        this.peerService.subscribeTopics();

        console.log(chalk.green('✅ MQTT services initialized'));

        // 加入群组
        if (groupId) {
          this.groupService.setCredentials(userId, token);
          await this.groupService.joinGroup(groupId, token, userId);
          this.currentGroupId = groupId;
          console.log(chalk.green(`✅ Joined group: ${groupId}`));
        }

        // 发送消息
        if (message) {
          this.messageService.setCredentials(userId, token);
          await this.messageService.sendMessage(this.currentGroupId || groupId!, message, userId);
          console.log(chalk.green(`✅ Message sent: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`));
        }

        // 保持连接并进入交互模式
        this.isDaemonMode = true;
        this.isLoggedIn = true;
        this.currentUser = { userId, username, token };

        console.log();
        console.log(chalk.cyan('━'.repeat(42)));
        console.log(chalk.green('✅ Connected - entering interactive mode'));
        if (groupId) {
          console.log(chalk.green(`   Joined group: ${groupId}`));
        } else {
          console.log(chalk.gray('   Use /join <groupId> to join a group'));
        }
        console.log(chalk.cyan('━'.repeat(42)));
        console.log();

        // 进入交互模式
        await this.startInteractiveMode();

      } catch (error) {
        console.error(chalk.red('⚠️  MQTT connection failed:'), error);
        process.exit(1);
      }
    }
  }

  /**
   * 交互模式 - 交互式命令行
   */
  private async startInteractiveMode() {
    console.log(chalk.gray('📡 Connection will be established after login...'));
    console.log(chalk.gray('   Use /login <username> <password> to authenticate'));
    console.log(chalk.gray('   Or /register <username> <password> to create account'));
    console.log();

    // 显示帮助
    this.showHelp();

    // 初始化 readline
    this.initReadline();

    // 开始命令行循环
    await this.startCommandLoop();
  }

  private subscribeToMessages() {
    // 订阅所有群组消息
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

    // 订阅在线用户列表更新
    this.mqttClient.subscribe('chat/presence/online', (topic, message) => {
      this.handlePresenceUpdate(message);
    });
  }

  private handlePresenceUpdate(message: any) {
    if (message.type === 'presence' && message.payload) {
      const { users } = message.payload;
      if (Array.isArray(users)) {
        this.onlineUsers = users;
        this.commandParser.setOnlineUsers(users);
      }
    }
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

  private startCommandLoop(): Promise<void> {
    return new Promise((resolve) => {
      const prompt = () => {
        this.rl.question(chalk.blue('> '), async (input) => {
          const trimmedInput = input.trim();
          
          if (!trimmedInput) {
            prompt();
            return;
          }

          // 添加到历史记录
          if (this.commandHistory[this.commandHistory.length - 1] !== trimmedInput) {
            this.commandHistory.push(trimmedInput);
            this.historyIndex = this.commandHistory.length;
          }

          try {
            // 处理 @ 触发用户选择器
            if (trimmedInput.startsWith('@') && !trimmedInput.includes(' ')) {
              const searchTerm = trimmedInput.substring(1);
              const selectedUser = await this.commandParser.selectUser(searchTerm);
              if (selectedUser) {
                this.rl.write(`@${selectedUser} `);
              }
              prompt();
              return;
            }

            // 处理普通消息或命令
            if (!trimmedInput.startsWith('/')) {
              await this.processRegularMessage(trimmedInput);
            } else {
              await this.processCommand(trimmedInput);
            }
          } catch (error) {
            console.error(renderer.renderError(String(error)));
          }

          prompt();
        });
      };

      prompt();
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
          const token = this.authService.getToken();
          const username = this.authService.getUsername();
          const userId = this.authService.getUserId();
          if (token && username && userId) {
            try {
              await this.mqttClient.connect({
                username,
                password: token
              });
              console.log(chalk.green('✅ Connected to MQTT server'));
              
              this.peerService = createPeerService(this.mqttClient as any);
              this.subscribeToMessages();
              this.setupPeerCallbacks();
              this.peerService.setUserInfo(userId, username, token);
              this.peerService.subscribeTopics();
              
              console.log(chalk.green('✅ MQTT services initialized'));
            } catch (error) {
              console.error(chalk.red('⚠️ MQTT connection failed:'), error);
            }
          }
        }
        break;

      case 'register':
        if (args.length < 2) {
          console.log(renderer.renderError('Usage: /register <username> <password>'));
          return;
        }
        const registerSuccess = await this.authService.register(args[0], args[1]);
        if (registerSuccess) {
          const token = this.authService.getToken();
          const username = this.authService.getUsername();
          const userId = this.authService.getUserId();
          if (token && username && userId) {
            try {
              await this.mqttClient.connect({
                username,
                password: token
              });
              console.log(chalk.green('✅ Connected to MQTT server'));
              
              this.peerService = createPeerService(this.mqttClient as any);
              this.subscribeToMessages();
              this.setupPeerCallbacks();
              this.peerService.setUserInfo(userId, username, token);
              this.peerService.subscribeTopics();
              
              console.log(chalk.green('✅ MQTT services initialized'));
            } catch (error) {
              console.error(chalk.red('⚠️ MQTT connection failed:'), error);
            }
          }
        }
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
            this.currentGroupId = args[0];
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
          this.commandParser.setJoinedGroups([...this.commandParser.getJoinedGroups(), args[0]]);
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
      case 'list':
      case 'l':
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
      case 'who':
      case 'w':
        if (!this.requireLogin()) return;
        const usersToken = this.authService.getToken();
        if (usersToken) {
          this.httpService.setToken(usersToken);
          await this.httpService.getUsers();
        }
        break;

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
            
            // 辅助函数：根据序号或ID获取mention ID
            const getMentionId = (input: string): string | null => {
              const index = parseInt(input) - 1;
              if (!isNaN(index) && index >= 0 && index < this.mentionsCache.length) {
                return this.mentionsCache[index].id;
              }
              // 如果不是有效序号，当作UUID处理
              return input;
            };
            
            // /mention read <序号|id> - 标记单条已读
            if (args[0] === 'read' && args[1]) {
              const mentionId = getMentionId(args[1] as string);
              if (mentionId) {
                const success = await this.messageService.markMentionAsRead(mentionId);
                if (success) {
                  console.log(renderer.renderSuccess('Mention marked as read'));
                } else {
                  console.log(renderer.renderError('Failed to mark mention as read'));
                }
              } else {
                console.log(renderer.renderError('Invalid mention ID'));
              }
            }
            // /mention read --all - 全部标记已读
            else if (args[0] === 'read' && args[1] === '--all') {
              const count = await this.messageService.markAllMentionsAsRead();
              console.log(renderer.renderSuccess(`Marked ${count} mentions as read`));
            }
            // /mention delete <序号|id> - 删除单条
            else if (args[0] === 'delete' && args[1]) {
              const mentionId = getMentionId(args[1] as string);
              if (mentionId) {
                const success = await this.messageService.deleteMention(mentionId);
                if (success) {
                  console.log(renderer.renderSuccess('Mention deleted'));
                } else {
                  console.log(renderer.renderError('Failed to delete mention'));
                }
              }
            }
            // /mention clear - 清空已读的
            else if (args[0] === 'clear') {
              const filter = args[1] === '--all' ? 'all' : 'read';
              const count = await this.messageService.clearMentions(filter);
              if (filter === 'all') {
                console.log(renderer.renderSuccess(`Deleted ${count} mentions`));
              } else {
                console.log(renderer.renderSuccess(`Deleted ${count} read mentions`));
              }
            }
            // /mention - 查看列表
            else {
              const limit = args[0] ? parseInt(args[0]) : 50;
              this.mentionsCache = await this.messageService.getMentions(limit);
            }
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
      case 'h':
      case '?':
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
