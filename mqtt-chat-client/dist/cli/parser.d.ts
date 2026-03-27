/**
 * 指令系统解析器
 * 支持消息提及、清屏、表情反应、自定义指令等
 */
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
export declare class CommandParser {
    /**
     * 主解析方法
     * 解析用户输入，提取所有信息
     */
    parse(input: string): ParsedMessage;
    /**
     * 提取消息中的 @ 提及
     * 支持格式: @username @user123 @全体成员
     */
    extractMentions(text: string): string[];
    /**
     * 提取自定义表情
     * 支持格式: :emoji_name:
     */
    extractCustomEmojis(text: string): string[];
    /**
     * 替换自定义表情为实际表情符号
     */
    replaceCustomEmojis(text: string): string;
    /**
     * 检查本地指令
     */
    checkLocalCommand(input: string): string | null;
    /**
     * 解析指令
     */
    parseCommand(input: string): ParsedCommand;
    /**
     * 检查是否为系统指令
     */
    isSystemCommand(command: string): boolean;
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
    } | null;
    /**
     * 解析发送消息命令
     */
    parseSendCommand(input: string): {
        groupId: string;
        message: string;
    } | null;
    /**
     * 解析登录命令
     */
    parseLoginCommand(input: string): {
        username: string;
        password: string;
    } | null;
    /**
     * 解析注册命令
     */
    parseRegisterCommand(input: string): {
        username: string;
        password: string;
    } | null;
    /**
     * 生成 correlation ID
     */
    generateCorrelationId(): string;
    /**
     * 获取帮助文本
     */
    getHelpText(): string;
    /**
     * 验证表情是否有效
     */
    isValidEmoji(emoji: string): boolean;
    /**
     * 格式化提及
     */
    formatMention(username: string): string;
    /**
     * 检查消息是否包含提及
     */
    hasMention(text: string, username: string): boolean;
    /**
     * 提取消息内容（移除指令前缀）
     */
    extractContent(input: string): string;
}
export declare const parser: CommandParser;
//# sourceMappingURL=parser.d.ts.map