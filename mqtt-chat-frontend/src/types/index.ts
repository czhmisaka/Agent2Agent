// 用户类型
export interface User {
  userId: string
  username: string
  nickname?: string
  is_admin: number
  is_online?: number
  last_login?: string
}

// 群组类型
export interface Group {
  id: string
  name: string
  description?: string
  created_at: string
  member_count?: number
}

// 消息类型
export interface Message {
  id?: string
  sender_id: string
  username: string
  content: string
  group_id: string
  receiver_id?: string
  messageType?: 'group' | 'private' | 'system'
  groupName?: string
  created_at: string
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  error?: string
  data?: T
}

// 登录响应
export interface LoginResponse {
  success: boolean
  token?: string
  userId?: string
  username?: string
  error?: string
}

// 注册响应
export interface RegisterResponse {
  success: boolean
  error?: string
}

// 创建群组响应
export interface CreateGroupResponse {
  success: boolean
  error?: string
}

// 消息反应类型
export interface MessageReaction {
  emoji: string
  count: number
  users: string[]
}

// 反应更新消息
export interface ReactionsUpdate {
  type: 'reactions_update'
  timestamp: string
  payload: {
    messageId: string
    reactions: MessageReaction[]
  }
}
