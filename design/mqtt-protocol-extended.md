# MQTT 协议扩展设计

## 📡 主题层级结构（扩展版）

```
chat/
├── auth/
│   ├── login           # 用户登录
│   └── register        # 用户注册
├── group/
│   └── {groupId}/
│       ├── join        # 加入群组
│       ├── leave       # 离开群组
│       ├── members     # 获取成员列表
│       ├── message     # 群组消息
│       └── action      # 新增：消息操作（标记、反应等）
├── user/
│   └── {userId}/
│       ├── private     # 私聊消息
│       ├── mention      # 新增：提及通知
│       └── subscription # 新增：订阅通知
├── peer/               # 新增：点对点通信
│   └── {userId}/
│       ├── action      # 客户端动作指令
│       ├── ack         # 确认消息
│       └── typing      # 正在输入状态
├── presence/
│   └── {userId}        # 在线状态
└── system/
    └── announce        # 系统公告
```

---

## 📊 QoS 级别使用

| 场景 | QoS 级别 | 说明 |
|------|---------|------|
| 登录/注册请求 | 1 | 确保到达，至少一次 |
| 群组消息 | 2 | 确保到达且不重复 |
| 私聊消息 | 2 | 确保到达且不重复 |
| 在线状态 | 0 | 最多一次，允许丢失 |
| 系统公告 | 0 | 最多一次，允许丢失 |
| **点对点动作** | 1 | **新增：确保到达，至少一次** |
| **动作确认** | 1 | **新增：确保到达，至少一次** |
| **提及通知** | 2 | **新增：确保到达且不重复** |
| **订阅通知** | 2 | **新增：确保到达且不重复** |

---

## 📝 消息格式定义

### 1. 用户登录流程（现有）

**客户端发送：**
```
Topic: chat/auth/login
QoS: 1
Payload:
{
  "type": "request",
  "timestamp": "2026-03-27T09:40:00Z",
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
  "timestamp": "2026-03-27T09:40:01Z",
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

---

### 2. 群组消息流程（扩展）

**发送消息：**
```
Topic: chat/group/{groupId}/message
QoS: 2
Payload:
{
  "type": "message",
  "timestamp": "2026-03-27T09:40:00Z",
  "payload": {
    "content": "Hello, everyone! @bob",
    "contentType": "text",
    "mentions": ["user-bob-id"]
  },
  "meta": {
    "userId": "user-123",
    "groupId": "group-456",
    "messageId": "msg-789"
  }
}
```

**服务端广播（扩展）：**
```
Topic: chat/group/{groupId}/message
QoS: 2
Payload:
{
  "type": "message",
  "timestamp": "2026-03-27T09:40:00Z",
  "payload": {
    "messageId": "msg-789",
    "content": "Hello, everyone! @bob",
    "contentType": "text",
    "mentions": ["user-bob-id"],
    "flags": {
      "highlight": false,
      "pin": false,
      "urgent": false
    },
    "reactions": [],
    "sender": {
      "userId": "user-123",
      "username": "alice",
      "nickname": "Alice"
    }
  },
  "meta": {
    "groupId": "group-456"
  }
}
```

---

### 3. 消息操作请求（新增）

```
Topic: chat/group/{groupId}/action
QoS: 1
Payload:
{
  "type": "action",
  "action": "highlight|pin|unpin|reaction|recall",
  "timestamp": "2026-03-27T09:40:00Z",
  "payload": {
    "messageId": "msg-123",
    "token": "jwt-token",
    "emoji": "👍",
    "userId": "user-123"
  },
  "meta": {
    "groupId": "group-456",
    "correlationId": "uuid-123"
  }
}
```

**服务端响应：**
```
Topic: chat/group/{groupId}/action/response
QoS: 1
Payload:
{
  "type": "action_ack",
  "timestamp": "2026-03-27T09:40:01Z",
  "payload": {
    "success": true,
    "action": "reaction",
    "messageId": "msg-123",
    "emoji": "👍",
    "newCount": 5
  },
  "meta": {
    "correlationId": "uuid-123"
  }
}
```

---

### 4. 点对点动作指令（新增）

```
Topic: chat/peer/{targetUserId}/action
QoS: 1
Payload:
{
  "type": "peer_action",
  "action": "reaction|highlight|pin|typing",
  "timestamp": "2026-03-27T09:40:00Z",
  "payload": {
    "sourceUserId": "user-001",
    "sourceUsername": "alice",
    "messageId": "msg-123",
    "emoji": "👍",
    "isActive": true
  },
  "meta": {
    "needPersistence": true,
    "correlationId": "uuid-123",
    "groupId": "group-456"
  }
}
```

---

### 5. 点对点确认消息（新增）

```
Topic: chat/peer/{userId}/ack
QoS: 1
Payload:
{
  "type": "peer_ack",
  "timestamp": "2026-03-27T09:40:01Z",
  "payload": {
    "correlationId": "uuid-123",
    "success": true,
    "action": "reaction",
    "result": {
      "messageId": "msg-123",
      "emoji": "👍",
      "newCount": 5
    },
    "error": null
  }
}
```

---

### 6. 提及通知（新增）

```
Topic: chat/user/{userId}/mention
QoS: 2
Payload:
{
  "type": "mention",
  "timestamp": "2026-03-27T09:40:00Z",
  "payload": {
    "messageId": "msg-123",
    "sender": {
      "userId": "user-001",
      "username": "alice",
      "nickname": "Alice"
    },
    "groupId": "group-456",
    "groupName": "Dev Team",
    "preview": "Hey @bob, check this out!",
    "mentionedContent": "Hey @bob, check this out!"
  },
  "meta": {
    "correlationId": "uuid-mention-123"
  }
}
```

**已读确认：**
```
Topic: chat/user/{senderUserId}/mention/read
QoS: 0
Payload:
{
  "type": "mention_read",
  "timestamp": "2026-03-27T09:41:00Z",
  "payload": {
    "messageId": "msg-123",
    "mentionedUserId": "user-bob-id"
  }
}
```

---

### 7. 订阅通知（新增）

```
Topic: chat/user/{userId}/subscription
QoS: 2
Payload:
{
  "type": "subscription_match",
  "timestamp": "2026-03-27T09:40:00Z",
  "payload": {
    "matchType": "keyword|topic|user",
    "matchedValue": "typescript",
    "message": {
      "messageId": "msg-123",
      "content": "Check this typescript tutorial!",
      "sender": {
        "userId": "user-001",
        "username": "alice",
        "nickname": "Alice"
      }
    },
    "groupId": "group-456",
    "groupName": "Dev Team"
  },
  "meta": {
    "subscriptionId": "sub-001"
  }
}
```

---

### 8. 正在输入状态（新增）

```
Topic: chat/peer/{targetUserId}/typing
QoS: 0
Payload:
{
  "type": "typing",
  "timestamp": "2026-03-27T09:40:00Z",
  "payload": {
    "sourceUserId": "user-001",
    "sourceUsername": "alice",
    "groupId": "group-456",
    "isTyping": true
  }
}
```

---

### 9. 在线状态流程（现有）

**用户上线：**
```
Topic: chat/presence/{userId}
QoS: 0
Payload:
{
  "type": "presence",
  "timestamp": "2026-03-27T09:40:00Z",
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
  "timestamp": "2026-03-27T09:45:00Z",
  "payload": {
    "status": "offline",
    "username": "alice"
  },
  "meta": {
    "userId": "user-123"
  }
}
```

---

## 🔐 认证流程（扩展）

1. 客户端连接到 MQTT Broker
2. 发送登录请求到 `chat/auth/login`
3. 服务端验证后返回 JWT Token
4. 客户端后续请求携带 Token
5. 服务端拦截并验证 Token
6. **新增**：点对点通信也需要 Token 验证

---

## 📝 错误码定义（扩展）

### 基础错误码

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

### 指令系统错误码（新增）

| 错误码 | 说明 |
|--------|------|
| 4001 | 消息不存在 |
| 4002 | 无权操作此消息 |
| 4003 | 反应数量超限 |
| 4004 | 订阅不存在 |
| 4005 | 订阅已存在 |
| 4006 | 自定义表情已存在 |
| 4007 | 自定义指令已存在 |
| 4008 | 权限不足 |
| 4009 | 操作过于频繁 |
| 4010 | correlationId 不匹配 |

---

## 🔄 消息类型总结

| type | 说明 | 方向 | QoS |
|------|------|------|-----|
| `request` | 请求消息 | C→S | 1 |
| `ack` | 确认消息 | S→C | 1 |
| `message` | 聊天消息 | 双向 | 2 |
| `system` | 系统消息 | S→C | 0 |
| `action` | 消息操作 | C→S | 1 |
| `action_ack` | 操作确认 | S→C | 1 |
| `peer_action` | 点对点动作 | C→C | 1 |
| `peer_ack` | 点对点确认 | S→C | 1 |
| `mention` | 提及通知 | S→C | 2 |
| `mention_read` | 提及已读 | C→S | 0 |
| `subscription_match` | 订阅匹配 | S→C | 2 |
| `typing` | 正在输入 | C→C | 0 |
| `presence` | 在线状态 | 双向 | 0 |
| `error` | 错误消息 | S→C | 1 |

---

## ⚡ 性能优化建议

### 1. 消息合并
- 高频操作（如打字状态）使用 debounce
- 批量消息合并减少网络开销

### 2. 缓存策略
- 客户端缓存反应和标记状态
- 服务端缓存热门订阅匹配

### 3. 离线处理
- 离线用户的操作入队
- 上线后批量处理

### 4. 限流策略
- 点对点消息每分钟最多 100 条
- 服务端操作每分钟最多 60 条

---

*Last Updated: 2026-03-27 21:55:00*
