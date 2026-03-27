# MQTT 协议设计

## 📡 主题层级结构

```
chat/
├── auth/
│   ├── login      # 用户登录
│   └── register   # 用户注册
├── group/
│   └── {groupId}/
│       ├── join       # 加入群组
│       ├── leave      # 离开群组
│       ├── members    # 获取成员列表
│       └── message    # 群组消息
├── user/
│   └── {userId}/
│       └── private    # 私聊消息
├── presence/
│   └── {userId}       # 在线状态
└── system/
    └── announce       # 系统公告
```

## 🔄 消息流程

### 1. 用户登录流程

**客户端发送：**
```
Topic: chat/auth/login
QoS: 1
Payload:
{
  "type": "request",
  "timestamp": "2026-03-26T20:20:00Z",
  "payload": {
    "username": "alice",
    "password": "password123"
  },
  "meta": {
    "requestId": "req-001"
  }
}
```

**服务端响应：**
```
Topic: chat/auth/login/response
QoS: 1
Payload:
{
  "type": "ack",
  "timestamp": "2026-03-26T20:20:01Z",
  "payload": {
    "success": true,
    "userId": "user-123",
    "username": "alice",
    "token": "jwt-token-here"
  },
  "meta": {
    "requestId": "req-001"
  }
}
```

### 2. 群组消息流程

**发送消息：**
```
Topic: chat/group/{groupId}/message
QoS: 2
Payload:
{
  "type": "message",
  "timestamp": "2026-03-26T20:20:00Z",
  "payload": {
    "content": "Hello, everyone!",
    "contentType": "text"
  },
  "meta": {
    "userId": "user-123",
    "groupId": "group-456",
    "messageId": "msg-789"
  }
}
```

**服务端广播：**
```
Topic: chat/group/{groupId}/message
QoS: 2
Payload:
{
  "type": "message",
  "timestamp": "2026-03-26T20:20:00Z",
  "payload": {
    "content": "Hello, everyone!",
    "contentType": "text",
    "sender": {
      "userId": "user-123",
      "username": "alice"
    }
  },
  "meta": {
    "messageId": "msg-789",
    "groupId": "group-456"
  }
}
```

### 3. 在线状态流程

**用户上线：**
```
Topic: chat/presence/{userId}
QoS: 0
Payload:
{
  "type": "presence",
  "timestamp": "2026-03-26T20:20:00Z",
  "payload": {
    "status": "online",
    "username": "alice"
  },
  "meta": {
    "userId": "user-123"
  }
}
```

**用户下线：**
```
Topic: chat/presence/{userId}
QoS: 0
Payload:
{
  "type": "presence",
  "timestamp": "2026-03-26T20:25:00Z",
  "payload": {
    "status": "offline",
    "username": "alice"
  },
  "meta": {
    "userId": "user-123"
  }
}
```

## 📊 QoS 级别使用

| 场景 | QoS 级别 | 说明 |
|------|---------|------|
| 登录/注册请求 | 1 | 确保到达，至少一次 |
| 群组消息 | 2 | 确保到达且不重复 |
| 私聊消息 | 2 | 确保到达且不重复 |
| 在线状态 | 0 | 最多一次，允许丢失 |
| 系统公告 | 0 | 最多一次，允许丢失 |

## 🔐 认证流程

1. 客户端连接到 MQTT Broker
2. 发送登录请求到 `chat/auth/login`
3. 服务端验证后返回 JWT Token
4. 客户端后续请求携带 Token
5. 服务端拦截并验证 Token

## 📝 错误码定义

| 错误码 | 说明 |
|--------|------|
| 1001 | 用户名已存在 |
| 1002 | 用户名或密码错误 |
| 1003 | Token 无效或过期 |
| 2001 | 群组不存在 |
| 2002 | 不是群组成员 |
| 2003 | 群组已满 |
| 3001 | 消息发送失败 |
| 3002 | 消息格式错误 |
