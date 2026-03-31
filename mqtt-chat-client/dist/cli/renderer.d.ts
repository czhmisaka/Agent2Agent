/**
 * 终端消息渲染器
 * 美化终端输出，支持彩色显示和高亮
 */
export interface MessageData {
    type: string;
    payload: {
        messageId?: string;
        content?: string;
        sender?: {
            userId: string;
            username: string;
            nickname?: string;
        };
        reactions?: ReactionData[];
        flags?: {
            highlight?: boolean;
            pin?: boolean;
            urgent?: boolean;
        };
        preview?: string;
        senderUsername?: string;
        groupName?: string;
        matchType?: string;
        matchedValue?: string;
        mentionedContent?: string;
        [key: string]: any;
    };
    meta?: any;
}
export interface ReactionData {
    emoji: string;
    count: number;
    users: string[];
}
export interface MentionNotification {
    type: 'mention';
    payload: {
        messageId: string;
        sender: {
            userId: string;
            username: string;
            nickname?: string;
        };
        groupId: string;
        groupName: string;
        preview: string;
        mentionedContent: string;
    };
}
export interface SubscriptionNotification {
    type: 'subscription_match';
    payload: {
        matchType: string;
        matchedValue: string;
        message: {
            messageId: string;
            content: string;
            sender: {
                userId: string;
                username: string;
            };
        };
        groupId: string;
        groupName: string;
    };
}
export interface TypingStatus {
    username: string;
    isTyping: boolean;
}
export declare class MessageRenderer {
    private currentUsername;
    private typingUsers;
    private maxLineWidth;
    private reactionsCache;
    private highlightsCache;
    private pinsCache;
    constructor();
    /**
     * 设置当前用户名
     */
    setCurrentUsername(username: string): void;
    /**
     * 更新终端宽度
     */
    private updateTerminalWidth;
    /**
     * 渲染普通消息
     */
    renderMessage(message: MessageData): string;
    /**
     * 渲染聊天消息
     */
    private renderChatMessage;
    /**
     * 渲染系统消息
     */
    private renderSystemMessage;
    /**
     * 渲染提及通知
     */
    private renderMentionNotification;
    /**
     * 渲染订阅匹配通知
     */
    private renderSubscriptionNotification;
    /**
     * 渲染撤回消息
     */
    private renderRecalledMessage;
    /**
     * 渲染反应更新
     */
    private renderReactionsUpdate;
    /**
     * 渲染消息更新
     */
    private renderMessageUpdate;
    /**
     * 渲染反应列表
     */
    private renderReactions;
    /**
     * 渲染打字状态
     */
    renderTyping(username: string, isTyping: boolean): string;
    /**
     * 格式化提及（高亮显示）
     */
    private formatMentions;
    /**
     * 渲染帮助信息 - 表格化版本
     */
    renderHelp(): string;
    /**
     * 渲染帮助信息 - 简洁版本（备用）
     */
    renderHelpSimple(): string;
    /**
     * 渲染统计信息
     */
    renderStats(stats: any): string;
    /**
     * 清空屏幕
     */
    clear(): void;
    /**
     * 渲染分隔线
     */
    renderDivider(): string;
    /**
     * 渲染标题
     */
    renderTitle(title: string): string;
    /**
     * 渲染成功消息
     */
    renderSuccess(message: string): string;
    /**
     * 渲染错误消息
     */
    renderError(message: string): string;
    /**
     * 渲染警告消息
     */
    renderWarning(message: string): string;
    /**
     * 渲染信息消息
     */
    renderInfo(message: string): string;
    /**
     * 清除缓存
     */
    clearCache(): void;
}
export declare const renderer: MessageRenderer;
//# sourceMappingURL=renderer.d.ts.map