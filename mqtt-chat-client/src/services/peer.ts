/**
 * 点对点通信服务
 * 实现客户端之间的实时指令交互
 */

import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

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

export class PeerService {
  private mqttClient: any; // MQTT client
  private userId: string = '';
  private username: string = '';
  private token: string = '';
  
  // 待确认的动作
  private pendingActions: Map<string, PendingAction> = new Map();
  
  // 动作超时时间（毫秒）
  private ACK_TIMEOUT = 5000;
  
  // 最大重试次数
  private MAX_RETRIES = 3;
  
  // 打字状态
  private typingUsers: Map<string, NodeJS.Timeout> = new Map();
  
  // 回调函数
  private onActionReceived?: (action: PeerAction) => void;
  private onTypingReceived?: (userId: string, username: string, isTyping: boolean) => void;
  private onAckReceived?: (ack: PeerAck) => void;

  constructor(mqttClient: any) {
    this.mqttClient = mqttClient;
  }

  /**
   * 设置用户信息
   */
  setUserInfo(userId: string, username: string, token: string): void {
    this.userId = userId;
    this.username = username;
    this.token = token;
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: {
    onActionReceived?: (action: PeerAction) => void;
    onTypingReceived?: (userId: string, username: string, isTyping: boolean) => void;
    onAckReceived?: (ack: PeerAck) => void;
  }): void {
    this.onActionReceived = callbacks.onActionReceived;
    this.onTypingReceived = callbacks.onTypingReceived;
    this.onAckReceived = callbacks.onAckReceived;
  }

  /**
   * 订阅点对点主题
   */
  subscribeTopics(): void {
    if (!this.mqttClient) return;

    // 订阅动作主题
    this.mqttClient.subscribe(`chat/peer/${this.userId}/action`, (err: any) => {
      if (err) {
        console.error(chalk.red('❌ Subscribe action topic failed:'), err);
      } else {
        console.log(chalk.green('✅ Subscribed to peer action topic'));
      }
    });

    // 订阅确认主题
    this.mqttClient.subscribe(`chat/peer/${this.userId}/ack`, (err: any) => {
      if (err) {
        console.error(chalk.red('❌ Subscribe ack topic failed:'), err);
      } else {
        console.log(chalk.green('✅ Subscribed to peer ack topic'));
      }
    });

    // 订阅打字状态主题
    this.mqttClient.subscribe(`chat/peer/${this.userId}/typing`, (err: any) => {
      if (err) {
        console.error(chalk.red('❌ Subscribe typing topic failed:'), err);
      } else {
        console.log(chalk.green('✅ Subscribed to typing topic'));
      }
    });
  }

  /**
   * 发送点对点动作
   */
  async sendPeerAction(
    targetUserId: string,
    action: string,
    payload: any,
    options: {
      needPersistence?: boolean;
      groupId?: string;
      messageId?: string;
      emoji?: string;
      isActive?: boolean;
    } = {}
  ): Promise<string> {
    if (!this.mqttClient) {
      throw new Error('MQTT client not initialized');
    }

    const correlationId = uuidv4();
    const { needPersistence = false, groupId, messageId, emoji, isActive } = options;

    // 构建消息
    const message: any = {
      type: 'peer_action',
      action,
      timestamp: new Date().toISOString(),
      payload: {
        sourceUserId: this.userId,
        sourceUsername: this.username,
        groupId,
        messageId,
        emoji,
        isActive
      },
      meta: {
        needPersistence,
        correlationId
      }
    };

    // 立即发送到目标客户端
    try {
      await this.mqttClient.publish(
        `chat/peer/${targetUserId}/action`,
        JSON.stringify(message),
        { qos: 1 }
      );
      console.log(chalk.gray(`📤 Sent peer action: ${action} to ${targetUserId}`));
    } catch (err) {
      console.error(chalk.red('❌ Send peer action failed:'), err);
      throw err;
    }

    // 如果需要持久化，同时发送到服务端
    if (needPersistence) {
      this.addPendingAction(correlationId, action, payload);
      
      try {
        await this.mqttClient.publish(
          `chat/group/${groupId}/action`,
          JSON.stringify({
            type: 'action',
            action,
            timestamp: new Date().toISOString(),
            payload: {
              messageId,
              emoji,
              token: this.token,
              userId: this.userId
            },
            meta: {
              groupId,
              correlationId
            }
          }),
          { qos: 1 }
        );
      } catch (err) {
        console.error(chalk.red('❌ Send to server failed:'), err);
      }
    }

    return correlationId;
  }

  /**
   * 发送打字状态（不需要持久化）
   */
  async sendTypingStatus(
    targetUserId: string,
    groupId: string,
    isTyping: boolean
  ): Promise<void> {
    if (!this.mqttClient) return;

    const message = {
      type: 'typing',
      timestamp: new Date().toISOString(),
      payload: {
        sourceUserId: this.userId,
        sourceUsername: this.username,
        groupId,
        isTyping
      }
    };

    try {
      await this.mqttClient.publish(
        `chat/peer/${targetUserId}/typing`,
        JSON.stringify(message),
        { qos: 0 }
      );
    } catch (err) {
      // 打字状态可以失败，不抛出错误
      console.debug(chalk.gray('📤 Typing status send failed (ignored):'), err);
    }
  }

  /**
   * 广播动作到群组所有成员（除了自己）
   */
  async broadcastToGroup(
    groupId: string,
    memberIds: string[],
    action: string,
    payload: any
  ): Promise<void> {
    const promises = memberIds
      .filter(id => id !== this.userId)
      .map(id => this.sendPeerAction(id, action, payload, {
        needPersistence: true,
        groupId,
        ...payload
      }));

    await Promise.allSettled(promises);
  }

  /**
   * 处理接收到的点对点动作
   */
  handlePeerAction(message: any): void {
    const { action, payload, meta } = message;

    console.log(chalk.cyan(`📥 Received peer action: ${action}`));

    // 执行本地动作
    if (this.onActionReceived) {
      this.onActionReceived({
        action,
        sourceUserId: payload.sourceUserId,
        sourceUsername: payload.sourceUsername,
        messageId: payload.messageId,
        emoji: payload.emoji,
        isActive: payload.isActive,
        timestamp: message.timestamp
      });
    }

    // 如果需要持久化，等待服务端确认
    if (meta?.needPersistence) {
      this.waitForServerAck(meta.correlationId);
    }
  }

  /**
   * 处理接收到的确认
   */
  handlePeerAck(message: any): void {
    const { correlationId, success, action, result, error } = message.payload;

    console.log(chalk.cyan(`📥 Received peer ack: ${action} (${success ? 'success' : 'failed'})`));

    // 清除待确认动作
    if (success) {
      this.clearPendingAction(correlationId);
    } else {
      // 确认失败，回滚本地动作
      this.rollbackLocalAction(action, message.payload);
    }

    // 调用回调
    if (this.onAckReceived) {
      this.onAckReceived({
        correlationId,
        success,
        action,
        result,
        error
      });
    }
  }

  /**
   * 处理接收到的打字状态
   */
  handleTypingStatus(message: any): void {
    const { payload } = message;
    
    if (this.onTypingReceived) {
      this.onTypingReceived(
        payload.sourceUserId,
        payload.sourceUsername,
        payload.isTyping
      );
    }

    // 自动清除打字状态
    if (payload.isTyping) {
      this.setTypingTimeout(payload.sourceUserId);
    }
  }

  /**
   * 添加待确认动作
   */
  private addPendingAction(correlationId: string, action: string, payload: any): void {
    this.pendingActions.set(correlationId, {
      action,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    });

    // 设置超时
    setTimeout(() => {
      this.handleAckTimeout(correlationId);
    }, this.ACK_TIMEOUT);
  }

  /**
   * 清除待确认动作
   */
  private clearPendingAction(correlationId: string): void {
    this.pendingActions.delete(correlationId);
  }

  /**
   * 处理确认超时
   */
  private handleAckTimeout(correlationId: string): void {
    const pending = this.pendingActions.get(correlationId);
    
    if (!pending) return;

    if (pending.retryCount < this.MAX_RETRIES) {
      // 重试
      pending.retryCount++;
      pending.timestamp = Date.now();
      console.log(chalk.yellow(`⏳ Retry pending action: ${pending.action} (${pending.retryCount}/${this.MAX_RETRIES})`));
      
      setTimeout(() => {
        this.handleAckTimeout(correlationId);
      }, this.ACK_TIMEOUT);
    } else {
      // 超过最大重试次数，放弃
      this.pendingActions.delete(correlationId);
      console.error(chalk.red(`❌ Action timeout: ${pending.action}`));
      
      // 通知用户
      this.notifyActionFailed(pending.action);
    }
  }

  /**
   * 等待服务端确认
   */
  private waitForServerAck(correlationId: string): void {
    // 超时处理已在 addPendingAction 中设置
    // 这里主要是确保动作在等待确认期间不会重复发送
  }

  /**
   * 回滚本地动作
   */
  private rollbackLocalAction(action: string, payload: any): void {
    console.warn(chalk.yellow(`↩️ Rollback local action: ${action}`));
    
    // 根据动作类型执行回滚
    switch (action) {
      case 'reaction':
        // 移除反应显示
        this.notifyReactionRemoved(payload.messageId, payload.emoji);
        break;
      case 'highlight':
        // 移除高亮显示
        this.notifyHighlightRemoved(payload.messageId);
        break;
      case 'pin':
        // 移除置顶显示
        this.notifyPinRemoved(payload.messageId);
        break;
      default:
        console.warn(chalk.yellow(`Unknown action to rollback: ${action}`));
    }
  }

  /**
   * 通知动作失败
   */
  private notifyActionFailed(action: string): void {
    switch (action) {
      case 'reaction':
        console.error(chalk.red('❌ Failed to add reaction. Please try again.'));
        break;
      case 'highlight':
        console.error(chalk.red('❌ Failed to highlight message. Please try again.'));
        break;
      case 'pin':
        console.error(chalk.red('❌ Failed to pin message. Please try again.'));
        break;
      default:
        console.error(chalk.red(`❌ Action failed: ${action}`));
    }
  }

  /**
   * 通知反应被移除
   */
  private notifyReactionRemoved(messageId: string, emoji: string): void {
    if (this.onActionReceived) {
      this.onActionReceived({
        action: 'reaction_removed',
        sourceUserId: this.userId,
        sourceUsername: this.username,
        messageId,
        emoji,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 通知高亮被移除
   */
  private notifyHighlightRemoved(messageId: string): void {
    if (this.onActionReceived) {
      this.onActionReceived({
        action: 'highlight_removed',
        sourceUserId: this.userId,
        sourceUsername: this.username,
        messageId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 通知置顶被移除
   */
  private notifyPinRemoved(messageId: string): void {
    if (this.onActionReceived) {
      this.onActionReceived({
        action: 'pin_removed',
        sourceUserId: this.userId,
        sourceUsername: this.username,
        messageId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 设置打字超时
   */
  private setTypingTimeout(userId: string): void {
    // 清除之前的超时
    const existing = this.typingUsers.get(userId);
    if (existing) {
      clearTimeout(existing);
    }

    // 设置新的超时（3秒后自动清除）
    const timeout = setTimeout(() => {
      this.typingUsers.delete(userId);
      if (this.onTypingReceived) {
        this.onTypingReceived(userId, '', false);
      }
    }, 3000);

    this.typingUsers.set(userId, timeout);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清除所有打字超时
    this.typingUsers.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.typingUsers.clear();

    // 清除待确认动作
    this.pendingActions.clear();
  }

  /**
   * 获取待确认动作数量
   */
  getPendingCount(): number {
    return this.pendingActions.size;
  }

  /**
   * 检查是否有活跃的待确认动作
   */
  hasPendingActions(): boolean {
    return this.pendingActions.size > 0;
  }
}

// 导出单例工厂
let peerServiceInstance: PeerService | null = null;

export function createPeerService(mqttClient: any): PeerService {
  if (!peerServiceInstance) {
    peerServiceInstance = new PeerService(mqttClient);
  }
  return peerServiceInstance;
}

export function getPeerService(): PeerService | null {
  return peerServiceInstance;
}
