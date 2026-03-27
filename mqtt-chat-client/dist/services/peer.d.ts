/**
 * 点对点通信服务
 * 实现客户端之间的实时指令交互
 */
export interface PeerAction {
    action: string;
    sourceUserId: string;
    sourceUsername: string;
    messageId?: string;
    emoji?: string;
    isActive?: boolean;
    timestamp: string;
}
export interface PeerAck {
    correlationId: string;
    success: boolean;
    action: string;
    result?: any;
    error?: string;
}
export interface PendingAction {
    action: string;
    payload: any;
    timestamp: number;
    retryCount: number;
}
export declare class PeerService {
    private mqttClient;
    private userId;
    private username;
    private token;
    private pendingActions;
    private ACK_TIMEOUT;
    private MAX_RETRIES;
    private typingUsers;
    private onActionReceived?;
    private onTypingReceived?;
    private onAckReceived?;
    constructor(mqttClient: any);
    /**
     * 设置用户信息
     */
    setUserInfo(userId: string, username: string, token: string): void;
    /**
     * 设置回调函数
     */
    setCallbacks(callbacks: {
        onActionReceived?: (action: PeerAction) => void;
        onTypingReceived?: (userId: string, username: string, isTyping: boolean) => void;
        onAckReceived?: (ack: PeerAck) => void;
    }): void;
    /**
     * 订阅点对点主题
     */
    subscribeTopics(): void;
    /**
     * 发送点对点动作
     */
    sendPeerAction(targetUserId: string, action: string, payload: any, options?: {
        needPersistence?: boolean;
        groupId?: string;
        messageId?: string;
        emoji?: string;
        isActive?: boolean;
    }): Promise<string>;
    /**
     * 发送打字状态（不需要持久化）
     */
    sendTypingStatus(targetUserId: string, groupId: string, isTyping: boolean): Promise<void>;
    /**
     * 广播动作到群组所有成员（除了自己）
     */
    broadcastToGroup(groupId: string, memberIds: string[], action: string, payload: any): Promise<void>;
    /**
     * 处理接收到的点对点动作
     */
    handlePeerAction(message: any): void;
    /**
     * 处理接收到的确认
     */
    handlePeerAck(message: any): void;
    /**
     * 处理接收到的打字状态
     */
    handleTypingStatus(message: any): void;
    /**
     * 添加待确认动作
     */
    private addPendingAction;
    /**
     * 清除待确认动作
     */
    private clearPendingAction;
    /**
     * 处理确认超时
     */
    private handleAckTimeout;
    /**
     * 等待服务端确认
     */
    private waitForServerAck;
    /**
     * 回滚本地动作
     */
    private rollbackLocalAction;
    /**
     * 通知动作失败
     */
    private notifyActionFailed;
    /**
     * 通知反应被移除
     */
    private notifyReactionRemoved;
    /**
     * 通知高亮被移除
     */
    private notifyHighlightRemoved;
    /**
     * 通知置顶被移除
     */
    private notifyPinRemoved;
    /**
     * 设置打字超时
     */
    private setTypingTimeout;
    /**
     * 清理资源
     */
    cleanup(): void;
    /**
     * 获取待确认动作数量
     */
    getPendingCount(): number;
    /**
     * 检查是否有活跃的待确认动作
     */
    hasPendingActions(): boolean;
}
export declare function createPeerService(mqttClient: any): PeerService;
export declare function getPeerService(): PeerService | null;
//# sourceMappingURL=peer.d.ts.map