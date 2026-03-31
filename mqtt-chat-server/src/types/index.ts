/**
 * MQTT Chat Server 类型定义
 */

// ==================== 客户端相关类型 ====================

/**
 * 连接的客户端信息
 */
export interface ClientInfo {
  clientId: string;
  userId?: string;
  username?: string;
  connectedAt?: Date;
}

/**
 * JWT Token 载荷
 */
export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

// ==================== 消息相关类型 ====================

/**
 * MQTT 消息包
 */
export interface Packet {
  topic: string;
  payload: Buffer;
  qos: 0 | 1 | 2;
  retain: boolean;
  cmd: 'publish' | 'subscribe' | 'unsubscribe';
  dup: boolean;
}

/**
 * 通用消息格式
 */
export interface MessagePayload {
  type: 'message' | 'ack' | 'error' | 'system' | 'action_ack' | 'message_update' | 'reactions_update' | 'message_recalled' | 'mention' | 'subscription_match';
  timestamp: string;
  payload: any;
  meta?: {
    userId?: string;
    groupId?: string;
    messageId?: string;
    correlationId?: string;
  };
}

/**
 * 消息元数据
 */
export interface MessageMeta {
  userId: string;
  groupId: string;
  messageId: string;
}

// ==================== 动作相关类型 ====================

/**
 * 动作类型枚举
 */
export type ActionType = 
  | 'highlight'
  | 'pin'
  | 'unpin'
  | 'reaction'
  | 'recall'
  | 'subscribe'
  | 'unsubscribe'
  | 'emoji_add'
  | 'cmd_add';

/**
 * 动作载荷
 */
export interface ActionPayload {
  type: string;
  action: ActionType;
  timestamp: string;
  payload: {
    messageId?: string;
    token?: string;
    emoji?: string;
    userId?: string;
    target?: string;
    value?: string;
  };
  meta?: {
    groupId?: string;
    correlationId?: string;
  };
}

/**
 * 动作响应
 */
export interface ActionResponse {
  success: boolean;
  action: ActionType;
  error?: string;
  code?: number;
  messageId?: string;
  emoji?: string;
  result?: any;
  correlationId?: string;
}

// ==================== 认证相关类型 ====================

/**
 * 认证消息载荷
 */
export interface AuthPayload {
  username: string;
  password: string;
}

/**
 * 认证响应载荷
 */
export interface AuthResponse {
  success: boolean;
  userId?: string;
  username?: string;
  nickname?: string;
  token?: string;
  error?: string;
  code?: number;
}

// ==================== 消息动作相关类型 ====================

/**
 * 消息标志类型
 */
export type MessageFlagType = 'highlight' | 'pin';

/**
 * 消息标志
 */
export interface MessageFlag {
  id: string;
  message_id: string;
  flag_type: MessageFlagType;
  user_id: string;
  created_at: string;
}

/**
 * 消息反应
 */
export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/**
 * 格式化反应数据
 */
export interface FormattedReaction {
  emoji: string;
  count: number;
  users: string[];
}

// ==================== 订阅相关类型 ====================

/**
 * 订阅类型
 */
export type SubscriptionType = 'keyword' | 'topic' | 'user';

/**
 * 订阅记录
 */
export interface Subscription {
  id: string;
  user_id: string;
  subscription_type: SubscriptionType;
  subscription_value: string;
  group_id?: string;
  is_active: number;
  created_at: string;
}

/**
 * 订阅通知载荷
 */
export interface SubscriptionNotification {
  type: 'subscription_match';
  timestamp: string;
  payload: {
    matchType: SubscriptionType;
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
  meta?: {
    subscriptionId: string;
  };
}

// ==================== 提及相关类型 ====================

/**
 * 提及记录
 */
export interface MessageMention {
  id: string;
  message_id: string;
  mentioned_user_id: string;
  sender_id: string;
  group_id: string;
  created_at: string;
}

/**
 * 提及通知载荷
 */
export interface MentionNotification {
  type: 'mention';
  timestamp: string;
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

// ==================== 自定义表情和命令相关类型 ====================

/**
 * 自定义表情
 */
export interface CustomEmoji {
  id: string;
  name: string;
  emoji: string;
  creator_id: string;
  is_public: number;
  usage_count: number;
  created_at: string;
}

/**
 * 自定义命令
 */
export interface CustomCommand {
  id: string;
  name: string;
  description: string;
  response_template: string;
  creator_id: string;
  permissions: string;
  created_at: string;
}

// ==================== 数据库相关类型 ====================

/**
 * 用户记录
 */
export interface User {
  id: string;
  username: string;
  password_hash: string;
  nickname?: string;
  is_online: number;
  last_login?: string;
  created_at: string;
}

/**
 * 群组记录
 */
export interface Group {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  is_active: number;
  created_at: string;
}

/**
 * 群组成员记录
 */
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

/**
 * 消息记录
 */
export interface Message {
  id: string;
  group_id?: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  content_type: 'text' | 'image' | 'file';
  is_highlighted: number;
  is_pinned: number;
  is_recalled: number;
  created_at: string;
}

// ==================== 错误码定义 ====================

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 认证错误 (1000-1999)
  USERNAME_EXISTS = 1001,
  INVALID_CREDENTIALS = 1002,
  INVALID_TOKEN = 1003,
  TOKEN_EXPIRED = 1004,
  
  // 动作错误 (4000-4999)
  UNKNOWN_ACTION = 4001,
  ACTION_FAILED = 4002,
  PERMISSION_DENIED = 4003,
  INVALID_SUBSCRIPTION_TYPE = 4004,
  SUBSCRIPTION_EXISTS = 4005,
  EMOJI_EXISTS = 4006,
  COMMAND_EXISTS = 4007,
  TOKEN_REQUIRED = 4008,
  
  // 通用错误 (5000-5999)
  INTERNAL_ERROR = 5000,
  DATABASE_ERROR = 5001,
  VALIDATION_ERROR = 5002,
}
