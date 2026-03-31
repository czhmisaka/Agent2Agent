/**
 * 指令系统解析器
 * 支持消息提及、清屏、表情反应、自定义指令等
 */

import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';

export interface ParsedMessage {
  content: string;
  mentions: string[];
  isCommand: boolean;
  command?: string;
  commandType?: 'local' | 'system' | 'action';
  args: string[];
  localCommands: string[];
  customEmojis?: string[];
  highlightedText?: string[];
  rawInput: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  type?: 'local' | 'server';
}

export interface ParsedCommand {
  command: string;
  args: string[];
}

// ==================== 常量定义 ====================

// 本地指令（不发送服务器）
const LOCAL_COMMANDS = ['clear', 'cls', 'screen', 'exit', 'quit'];

// 系统指令（需要服务器处理）
const SYSTEM_COMMANDS = [
  'help', 'h', '?',
  'who', 'w',
  'list', 'l',
  'stats', 's',
  'subscribe', 'sub',
  'unsubscribe', 'unsub',
  'subscriptions',
  'emoji', 'e',
  'cmd',
  'highlight', 'hl',
  'pin',
  'unpin',
  'react', 'r',
  'recall',
  'mention', 'm',
  'rules', 'rule',
  'join', 'j',
  'leave', 'create', 'groups', 'members', 'history', 'users',
  'login', 'register', 'send', 'exit', 'quit', 'clear'
];

// 动作指令（发送到服务端）
const ACTION_COMMANDS = [
  'highlight', 'hl',
  'pin',
  'unpin',
  'react',
  'recall'
];

// 所有命令列表（用于补全）
export const ALL_COMMANDS = [
  // 基础指令
  '/help', '/login', '/register', '/who', '/list', '/exit', '/quit',
  // 群组指令
  '/join', '/leave', '/create', '/groups', '/members', '/send', '/history', '/users',
  // 消息操作
  '/highlight', '/pin', '/unpin', '/react', '/recall',
  // 提及功能
  '/mention',
  // 订阅功能
  '/subscribe', '/subscriptions', '/unsubscribe',
  // 表情功能
  '/emoji',
  // 统计功能
  '/stats',
  // 本地指令
  '/clear',
  // 别名
  '/h', '/?', '/w', '/l', '/s', '/sub', '/unsub', '/e', '/hl', '/r', '/m'
];

// 默认表情映射
const DEFAULT_EMOJI_MAP: Record<string, string> = {
  'thumbsup': '👍',
  'heart': '❤️',
  'laugh': '😂',
  'wow': '😮',
  'sad': '😢',
  'angry': '😠',
  'fire': '🔥',
  'star': '⭐',
  'rocket': '🚀',
  'check': '✅',
  '+1': '👍',
  '-1': '👎',
  '100': '💯',
  'cool': '😎',
  'smile': '😊',
  'cry': '😭',
  'ok': '👌'
};

// 表情名称列表（用于补全）
const EMOJI_NAMES = Object.keys(DEFAULT_EMOJI_MAP);

// 在线用户列表
let onlineUsers: Array<{ userId: string; username: string }> = [];

// 群组列表
let joinedGroups: string[] = [];

// ==================== 解析器类 ====================

export class CommandParser {
  
  /**
   * 设置在线用户列表
   */
  setOnlineUsers(users: Array<{ userId: string; username: string }>): void {
    onlineUsers = users;
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers(): Array<{ userId: string; username: string }> {
    return onlineUsers;
  }

  /**
   * 设置已加入的群组列表
   */
  setJoinedGroups(groups: string[]): void {
    joinedGroups = groups;
  }

  /**
   * 获取已加入的群组列表
   */
  getJoinedGroups(): string[] {
    return joinedGroups;
  }

  /**
   * Tab 补全触发检测
   * 返回需要触发的补全类型
   */
  detectCompletionTrigger(line: string): 'command' | 'mention' | 'emoji' | 'group' | 'subscribe' | 'none' {
    // 空输入，提示所有命令
    if (!line) {
      return 'command';
    }

    // 以 / 开头，补全命令
    if (line.startsWith('/')) {
      // 检查是否是 /subscribe 后的补全
      const parts = line.split(/\s+/);
      if (parts[0] === '/subscribe' || parts[0] === '/sub') {
        if (parts.length === 1) {
          return 'subscribe';
        }
      }
      return 'command';
    }

    // 以 @ 开头，补全用户名
    if (line.startsWith('@')) {
      return 'mention';
    }

    // 以 : 开头，补全表情
    if (line.startsWith(':')) {
      return 'emoji';
    }

    return 'none';
  }

  /**
   * 获取命令补全列表
   */
  getCommandCompletions(partial: string): string[] {
    const cmd = partial.startsWith('/') ? partial.substring(1).toLowerCase() : partial.toLowerCase();
    
    return ALL_COMMANDS.filter(cmdName => {
      const name = cmdName.startsWith('/') ? cmdName.substring(1) : cmdName;
      return name.startsWith(cmd) || partial.startsWith('/');
    });
  }

  /**
   * 获取表情补全列表
   */
  getEmojiCompletions(partial: string): string[] {
    const emojiName = partial.startsWith(':') ? partial.substring(1).toLowerCase() : partial.toLowerCase();
    
    return EMOJI_NAMES
      .filter(name => name.startsWith(emojiName))
      .map(name => `:${name}:`);
  }

  /**
   * 获取群组补全列表
   */
  getGroupCompletions(partial: string): string[] {
    return joinedGroups.filter(group => group.startsWith(partial));
  }

  /**
   * 获取订阅类型补全列表
   */
  getSubscribeCompletions(): string[] {
    return ['keyword', 'topic', 'user'];
  }

  /**
   * 交互式选择在线用户
   */
  async selectUser(searchTerm: string = ''): Promise<string | null> {
    // 过滤匹配的用户
    const filteredUsers = searchTerm 
      ? onlineUsers.filter(u => 
          u.username.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : onlineUsers;

    if (filteredUsers.length === 0) {
      console.log('没有找到匹配的用户');
      return null;
    }

    // 如果只有一个匹配，直接返回
    if (filteredUsers.length === 1) {
      return filteredUsers[0].username;
    }

    // 使用 inquirer 进行交互式选择
    const choices = filteredUsers.map(user => ({
      name: `${user.username} (${user.userId.substring(0, 8)}...)`,
      value: user.username,
      short: user.username
    }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: `选择用户${searchTerm ? ` (搜索: ${searchTerm})` : ''}:`,
        choices: choices,
        pageSize: Math.min(10, choices.length)
      }
    ]);

    return answer.user;
  }

  /**
   * 主解析方法
   * 解析用户输入，提取所有信息
   */
  parse(input: string): ParsedMessage {
    const trimmedInput = input.trim();
    
    // 空输入
    if (!trimmedInput) {
      return {
        content: '',
        mentions: [],
        isCommand: false,
        args: [],
        localCommands: [],
        rawInput: trimmedInput
      };
    }

    // 1. 提取提及
    const mentions = this.extractMentions(trimmedInput);
    
    // 2. 提取自定义表情
    const customEmojis = this.extractCustomEmojis(trimmedInput);
    
    // 3. 转换自定义表情
    let content = this.replaceCustomEmojis(trimmedInput);
    
    // 4. 检查本地指令
    const localCmd = this.checkLocalCommand(trimmedInput);
    if (localCmd) {
      return {
        content: '',
        mentions: [],
        isCommand: true,
        command: localCmd,
        commandType: 'local',
        args: [],
        localCommands: [localCmd],
        customEmojis,
        rawInput: trimmedInput
      };
    }
    
    // 5. 检查系统指令
    if (trimmedInput.startsWith('/')) {
      const { command, args } = this.parseCommand(trimmedInput);
      const commandName = command.toLowerCase();
      
      // 检查是否为动作指令
      const isActionCommand = ACTION_COMMANDS.includes(commandName);
      
      return {
        content: trimmedInput,
        mentions,
        isCommand: true,
        command: commandName,
        commandType: isActionCommand ? 'action' : 'system',
        args,
        localCommands: [],
        customEmojis,
        rawInput: trimmedInput
      };
    }
    
    // 6. 普通消息
    return {
      content,
      mentions,
      isCommand: false,
      args: [],
      localCommands: [],
      customEmojis,
      rawInput: trimmedInput
    };
  }

  /**
   * 提取消息中的 @ 提及
   * 支持格式: @username @user123 @全体成员
   */
  extractMentions(text: string): string[] {
    // 支持中文、英文、数字、下划线的用户名
    const regex = /@([\w\u4e00-\u9fa5]+)/g;
    const matches = text.match(regex);
    
    if (!matches) {
      return [];
    }
    
    // 去重并移除 @
    const mentions = [...new Set(matches.map(m => m.slice(1)))];
    
    // 过滤特殊提及（如 @全体成员）
    return mentions.filter(m => 
      m !== '全体成员' && 
      m !== '所有人' && 
      m !== 'all' &&
      m !== 'channel'
    );
  }

  /**
   * 提取自定义表情
   * 支持格式: :emoji_name:
   */
  extractCustomEmojis(text: string): string[] {
    const regex = /:([\w]+):/g;
    const matches = text.match(regex);
    
    if (!matches) {
      return [];
    }
    
    return [...new Set(matches)];
  }

  /**
   * 替换自定义表情为实际表情符号
   */
  replaceCustomEmojis(text: string): string {
    let result = text;
    
    // 替换所有 :emoji_name: 格式的表情
    for (const [name, emoji] of Object.entries(DEFAULT_EMOJI_MAP)) {
      const regex = new RegExp(`:${name}:`, 'gi');
      result = result.replace(regex, emoji);
    }
    
    return result;
  }

  /**
   * 检查本地指令
   */
  checkLocalCommand(input: string): string | null {
    const lower = input.toLowerCase();
    
    // @clear, /clear, @cls 等
    if (lower === '@clear' || lower === '/clear' || lower === '@cls' || lower === '/cls') {
      return 'clear';
    }
    
    // @screen, /screen
    if (lower === '@screen' || lower === '/screen') {
      return 'clear';
    }
    
    // @exit, /exit, @quit, /quit
    if (lower === '@exit' || lower === '/exit' || lower === '@quit' || lower === '/quit') {
      return 'exit';
    }
    
    return null;
  }

  /**
   * 解析指令
   */
  parseCommand(input: string): ParsedCommand {
    // 移除开头的斜杠
    const trimmedInput = input.startsWith('/') ? input.substring(1) : input;
    
    // 分割命令和参数
    const parts = trimmedInput.trim().split(/\s+/);
    
    if (parts.length === 0 || parts[0] === '') {
      return { command: '', args: [] };
    }

    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { command, args };
  }

  /**
   * 检查是否为系统指令
   */
  isSystemCommand(command: string): boolean {
    const lower = command.toLowerCase();
    
    // 检查主命令
    if (SYSTEM_COMMANDS.includes(lower)) {
      return true;
    }
    
    // 检查别名映射
    const aliasMap: Record<string, string> = {
      'h': 'help',
      '?': 'help',
      'w': 'who',
      'l': 'list',
      's': 'stats',
      'sub': 'subscribe',
      'unsub': 'unsubscribe',
      'e': 'emoji',
      'hl': 'highlight',
      'r': 'react',
      'm': 'mention',
      'j': 'join'
    };
    
    return aliasMap[lower] !== undefined;
  }

  /**
   * 解析动作指令
   * 返回标准化的动作对象
   */
  parseActionCommand(command: string, args: string[]): {
    action: string;
    messageId?: string;
    emoji?: string;
    target?: string;
    value?: string;
  } | null {
    const cmd = command.toLowerCase();
    
    switch (cmd) {
      case 'highlight':
      case 'hl':
        return {
          action: 'highlight',
          messageId: args[0]
        };
        
      case 'pin':
        return {
          action: 'pin',
          messageId: args[0]
        };
        
      case 'unpin':
        return {
          action: 'unpin',
          messageId: args[0]
        };
        
      case 'react':
      case 'r':
        return {
          action: 'reaction',
          messageId: args[0],
          emoji: args[1] || '👍'
        };
        
      case 'recall':
        return {
          action: 'recall',
          messageId: args[0]
        };
        
      case 'subscribe':
      case 'sub':
        const type = args[0]; // keyword, topic, user
        const value = args.slice(1).join(' ');
        return {
          action: 'subscribe',
          target: type,
          value
        };
        
      case 'unsubscribe':
      case 'unsub':
        return {
          action: 'unsubscribe',
          target: args[0],
          value: args.slice(1).join(' ')
        };
        
      case 'emoji':
      case 'e':
        if (args[0] === 'add') {
          return {
            action: 'emoji_add',
            target: args[1], // emoji name
            value: args[2]   // emoji value
          };
        }
        return {
          action: 'emoji_list'
        };
        
      case 'cmd':
        if (args[0] === 'add') {
          return {
            action: 'cmd_add',
            target: args[1], // command name
            value: args.slice(2).join(' ') // response template
          };
        }
        return {
          action: 'cmd_list'
        };
        
      case 'mention':
      case 'm':
        return {
          action: 'mention_list'
        };
        
      default:
        return null;
    }
  }

  /**
   * 解析发送消息命令
   */
  parseSendCommand(input: string): { groupId: string; message: string } | null {
    // /send <groupId> <message>
    const match = input.match(/^\/send\s+(\S+)\s+(.+)$/);
    
    if (match) {
      return {
        groupId: match[1],
        message: match[2]
      };
    }
    
    return null;
  }

  /**
   * 解析登录命令
   */
  parseLoginCommand(input: string): { username: string; password: string } | null {
    // /login <username> <password>
    const match = input.match(/^\/login\s+(\S+)\s+(.+)$/);
    
    if (match) {
      return {
        username: match[1],
        password: match[2]
      };
    }
    
    return null;
  }

  /**
   * 解析注册命令
   */
  parseRegisterCommand(input: string): { username: string; password: string } | null {
    // /register <username> <password>
    const match = input.match(/^\/register\s+(\S+)\s+(.+)$/);
    
    if (match) {
      return {
        username: match[1],
        password: match[2]
      };
    }
    
    return null;
  }

  /**
   * 生成 correlation ID
   */
  generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * 获取帮助文本
   */
  getHelpText(): string {
    return `
🤖 可用指令：

📍 基础指令：
  /help, /h, /?     - 显示帮助信息
  /login <user> <pwd> - 登录
  /register <user> <pwd> - 注册
  /send <group> <msg> - 发送消息
  /who, /w          - 查看在线用户
  /list, /l         - 列出所有群组
  /exit, /quit      - 退出

📍 消息操作：
  /highlight <msgId> - 高亮消息 ⭐
  /pin <msgId>      - 置顶消息 📌
  /unpin <msgId>    - 取消置顶
  /react <msgId> [emoji] - 添加表情 👍
  /recall <msgId>   - 撤回消息

📍 提及功能：
  @username         - 提及用户（消息中直接使用）
  /mention, /m      - 查看提及我的消息

📍 订阅功能：
  /subscribe <type> <value> - 订阅关键词/话题/用户 🔔
  /unsubscribe <type> <value> - 取消订阅
  /subscriptions    - 查看我的订阅

📍 自定义表情：
  /emoji add <name> <emoji> - 添加自定义表情
  :emoji_name:      - 在消息中使用表情

📍 自定义指令：
  /cmd add <name> <response> - 创建自定义指令

📍 统计功能：
  /stats, /s [user] - 查看消息统计 📊

📍 本地指令：
  @clear, /clear   - 清空屏幕
  @cls, /cls        - 清空屏幕

💡 提示：
  - 使用 Tab 键自动补全
  - 使用 ↑↓ 键查看历史
  - 使用 @ 触发用户选择器
  - 使用 : 自动补全表情
`;
  }

  /**
   * 验证表情是否有效
   */
  isValidEmoji(emoji: string): boolean {
    // 检查是否为 Unicode 表情
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u;
    
    // 检查是否为默认表情名称
    const isDefaultName = Object.values(DEFAULT_EMOJI_MAP).includes(emoji);
    
    // 检查是否为自定义表情格式
    const isCustomFormat = /^:[\w]+:$/.test(emoji);
    
    return emojiRegex.test(emoji) || isDefaultName || isCustomFormat;
  }

  /**
   * 格式化提及
   */
  formatMention(username: string): string {
    return `@${username}`;
  }

  /**
   * 检查消息是否包含提及
   */
  hasMention(text: string, username: string): boolean {
    const mentions = this.extractMentions(text);
    return mentions.some(m => m.toLowerCase() === username.toLowerCase());
  }

  /**
   * 提取消息内容（移除指令前缀）
   */
  extractContent(input: string): string {
    if (input.startsWith('/')) {
      // 移除指令和参数，只保留消息内容
      const parts = input.split(/\s+/);
      if (parts.length > 2) {
        return parts.slice(2).join(' ');
      }
    }
    return input;
  }
}

// 导出单例
export const parser = new CommandParser();
