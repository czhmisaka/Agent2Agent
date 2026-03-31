"use strict";
/**
 * 指令系统解析器
 * 支持消息提及、清屏、表情反应、自定义指令等
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parser = exports.CommandParser = exports.ALL_COMMANDS = exports.COMMAND_DEFINITIONS = void 0;
const uuid_1 = require("uuid");
const inquirer_1 = __importDefault(require("inquirer"));
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
// 命令定义表（用于生成帮助和补全）
exports.COMMAND_DEFINITIONS = [
    {
        name: '认证',
        icon: '🔐',
        commands: [
            { command: '/login', aliases: [], args: '<用户名> <密码>', description: '登录账号' },
            { command: '/register', aliases: [], args: '<用户名> <密码>', description: '注册新账号' },
        ]
    },
    {
        name: '用户',
        icon: '👥',
        commands: [
            { command: '/who', aliases: ['/w'], description: '查看在线用户' },
            { command: '/users', aliases: [], description: '获取用户列表' },
            { command: '/stats', aliases: ['/s'], args: '[用户名]', description: '查看消息统计' },
        ]
    },
    {
        name: '群组',
        icon: '💬',
        commands: [
            { command: '/create', aliases: [], args: '<群组名>', description: '创建群组' },
            { command: '/join', aliases: ['/j'], args: '<群组ID>', description: '加入群组' },
            { command: '/leave', aliases: [], args: '<群组ID>', description: '离开群组' },
            { command: '/list', aliases: ['/l'], description: '列出所有群组' },
            { command: '/members', aliases: [], args: '<群组ID>', description: '查看群组成员' },
            { command: '/groups', aliases: [], description: '列出所有群组（同 /list）' },
        ]
    },
    {
        name: '消息',
        icon: '✉️',
        commands: [
            { command: '/send', aliases: [], args: '<群组ID> <消息>', description: '发送消息到指定群组' },
            { command: '/history', aliases: [], args: '<群组ID> [条数]', description: '查看历史消息' },
            { command: '/highlight', aliases: ['/hl'], args: '<消息ID>', description: '高亮消息' },
            { command: '/pin', aliases: [], args: '<消息ID>', description: '置顶消息' },
            { command: '/unpin', aliases: [], args: '<消息ID>', description: '取消置顶' },
            { command: '/react', aliases: ['/r'], args: '<消息ID> [表情]', description: '添加反应（默认👍）' },
            { command: '/recall', aliases: [], args: '<消息ID>', description: '撤回消息' },
        ]
    },
    {
        name: '提及',
        icon: '📣',
        commands: [
            { command: '/mention', aliases: ['/m'], args: '[数量]', description: '查看提及我的消息' },
            { command: '/mention', aliases: [], args: 'read <序号>', description: '标记单条已读（用序号）' },
            { command: '/mention', aliases: [], args: 'read --all', description: '全部标记已读' },
            { command: '/mention', aliases: [], args: 'clear [--all]', description: '清空已读提及' },
            { command: '/mention', aliases: [], args: 'delete <序号>', description: '删除单条提及（用序号）' },
        ]
    },
    {
        name: '订阅',
        icon: '🔔',
        commands: [
            { command: '/subscribe', aliases: ['/sub'], args: 'keyword <词>', description: '订阅关键词' },
            { command: '/subscribe', aliases: [], args: 'topic <话题>', description: '订阅话题' },
            { command: '/subscribe', aliases: [], args: 'user <用户名>', description: '订阅用户' },
            { command: '/unsubscribe', aliases: ['/unsub'], args: '<类型> <值>', description: '取消订阅' },
            { command: '/subscriptions', aliases: [], description: '查看我的订阅' },
        ]
    },
    {
        name: '表情',
        icon: '😊',
        commands: [
            { command: ':emoji:', aliases: [], args: '<表情名>', description: '使用表情（如 :thumbsup:）' },
            { command: '/emoji', aliases: ['/e'], args: 'add <名> <表情>', description: '添加自定义表情' },
        ]
    },
    {
        name: '本地',
        icon: '🖥️',
        commands: [
            { command: '/clear', aliases: ['/cls', '@clear', '@cls'], description: '清空屏幕' },
            { command: '/exit', aliases: ['/quit'], description: '退出程序' },
        ]
    },
    {
        name: '帮助',
        icon: '📖',
        commands: [
            { command: '/help', aliases: ['/h', '/?'], description: '显示帮助信息' },
        ]
    }
];
// 所有命令列表（用于补全）- 从 COMMAND_DEFINITIONS 动态生成
exports.ALL_COMMANDS = (() => {
    const commands = [];
    exports.COMMAND_DEFINITIONS.forEach(category => {
        category.commands.forEach(cmd => {
            commands.push(cmd.command);
            cmd.aliases.forEach(alias => {
                if (!commands.includes(alias)) {
                    commands.push(alias);
                }
            });
        });
    });
    return [...new Set(commands)];
})();
// 默认表情映射
const DEFAULT_EMOJI_MAP = {
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
let onlineUsers = [];
// 群组列表
let joinedGroups = [];
// ==================== 解析器类 ====================
class CommandParser {
    /**
     * 设置在线用户列表
     */
    setOnlineUsers(users) {
        onlineUsers = users;
    }
    /**
     * 获取在线用户列表
     */
    getOnlineUsers() {
        return onlineUsers;
    }
    /**
     * 设置已加入的群组列表
     */
    setJoinedGroups(groups) {
        joinedGroups = groups;
    }
    /**
     * 获取已加入的群组列表
     */
    getJoinedGroups() {
        return joinedGroups;
    }
    /**
     * Tab 补全触发检测
     * 返回需要触发的补全类型
     */
    detectCompletionTrigger(line) {
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
    getCommandCompletions(partial) {
        const cmd = partial.startsWith('/') ? partial.substring(1).toLowerCase() : partial.toLowerCase();
        // 如果没有输入前缀，只返回基础命令
        if (!partial) {
            return exports.ALL_COMMANDS.filter(c => !c.includes(' '));
        }
        // 匹配以输入开头的命令
        return exports.ALL_COMMANDS.filter(cmdName => {
            const name = cmdName.startsWith('/') ? cmdName.substring(1).toLowerCase() : cmdName.toLowerCase();
            return name.startsWith(cmd);
        });
    }
    /**
     * 获取表情补全列表
     */
    getEmojiCompletions(partial) {
        const emojiName = partial.startsWith(':') ? partial.substring(1).toLowerCase() : partial.toLowerCase();
        return EMOJI_NAMES
            .filter(name => name.startsWith(emojiName))
            .map(name => `:${name}:`);
    }
    /**
     * 获取群组补全列表
     */
    getGroupCompletions(partial) {
        return joinedGroups.filter(group => group.startsWith(partial));
    }
    /**
     * 获取订阅类型补全列表
     */
    getSubscribeCompletions() {
        return ['keyword', 'topic', 'user'];
    }
    /**
     * 交互式选择在线用户
     */
    async selectUser(searchTerm = '') {
        // 过滤匹配的用户
        const filteredUsers = searchTerm
            ? onlineUsers.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()))
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
        const answer = await inquirer_1.default.prompt([
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
    parse(input) {
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
    extractMentions(text) {
        // 支持中文、英文、数字、下划线的用户名
        const regex = /@([\w\u4e00-\u9fa5]+)/g;
        const matches = text.match(regex);
        if (!matches) {
            return [];
        }
        // 去重并移除 @
        const mentions = [...new Set(matches.map(m => m.slice(1)))];
        // 过滤特殊提及（如 @全体成员）
        return mentions.filter(m => m !== '全体成员' &&
            m !== '所有人' &&
            m !== 'all' &&
            m !== 'channel');
    }
    /**
     * 提取自定义表情
     * 支持格式: :emoji_name:
     */
    extractCustomEmojis(text) {
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
    replaceCustomEmojis(text) {
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
    checkLocalCommand(input) {
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
    parseCommand(input) {
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
    isSystemCommand(command) {
        const lower = command.toLowerCase();
        // 检查主命令
        if (SYSTEM_COMMANDS.includes(lower)) {
            return true;
        }
        // 检查别名映射
        const aliasMap = {
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
    parseActionCommand(command, args) {
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
                        value: args[2] // emoji value
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
    parseSendCommand(input) {
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
    parseLoginCommand(input) {
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
    parseRegisterCommand(input) {
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
    generateCorrelationId() {
        return (0, uuid_1.v4)();
    }
    /**
     * 获取帮助文本
     */
    getHelpText() {
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
    isValidEmoji(emoji) {
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
    formatMention(username) {
        return `@${username}`;
    }
    /**
     * 检查消息是否包含提及
     */
    hasMention(text, username) {
        const mentions = this.extractMentions(text);
        return mentions.some(m => m.toLowerCase() === username.toLowerCase());
    }
    /**
     * 提取消息内容（移除指令前缀）
     */
    extractContent(input) {
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
exports.CommandParser = CommandParser;
// 导出单例
exports.parser = new CommandParser();
//# sourceMappingURL=parser.js.map