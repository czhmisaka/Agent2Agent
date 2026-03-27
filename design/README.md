# MQTT 群聊系统设计方案

## 📋 项目概述

基于 MQTT 协议的轻量级群聊系统，包含主服务器和 CLI 接入端两个项目。

## 🏗️ 技术栈

- **运行时**: Node.js 24
- **主服务器**: 
  - MQTT Broker: `aedes`
  - HTTP API: `express`
  - 数据库: `better-sqlite3`
  - 语言: TypeScript
- **接入端**: 
  - MQTT 客户端: `mqtt`
  - CLI 界面: Node.js 内置 `readline` + `inquirer`
  - 语言: TypeScript

## 📁 项目结构

```
Agent2Agent/
├── design/                    # 设计文档
│   ├── README.md             # 本文档
│   ├── mqtt-protocol.md      # MQTT 协议设计
│   └── database-schema.md    # 数据库结构设计
├── mqtt-chat-server/         # 主服务器
│   ├── src/
│   │   ├── index.ts          # 主入口
│   │   ├── config/           # 配置
│   │   ├── mqtt/             # MQTT 相关
│   │   ├── http/             # HTTP API
│   │   ├── database/         # 数据库
│   │   └── utils/            # 工具
│   ├── package.json
│   └── tsconfig.json
└── mqtt-chat-client/         # 接入端
    ├── src/
    │   ├── index.ts          # 主入口
    │   ├── config/           # 配置
    │   ├── mqtt/             # MQTT 客户端
    │   ├── cli/              # CLI 界面
    │   └── services/         # 业务服务
    ├── package.json
    └── tsconfig.json
```

## 🔌 MQTT 主题结构

### 主题命名规范
```
chat/{scope}/{resource}/{action}
```

### 核心主题

| 主题 | 用途 | QoS | 说明 |
|------|------|-----|------|
| `chat/auth/login` | 用户登录 | 1 | 登录请求 |
| `chat/auth/register` | 用户注册 | 1 | 注册请求 |
| `chat/group/{groupId}/join` | 加入群组 | 1 | 加入群组操作 |
| `chat/group/{groupId}/leave` | 离开群组 | 1 | 离开群组操作 |
| `chat/group/{groupId}/message` | 群组消息 | 2 | 群组消息发布 |
| `chat/user/{userId}/private` | 私聊消息 | 2 | 私聊消息 |
| `chat/presence/{userId}` | 在线状态 | 0 | 用户在线/离线 |
| `chat/system/announce` | 系统公告 | 0 | 系统广播 |

## 💬 消息格式

### 通用消息格式
```json
{
  "type": "message|ack|error",
  "timestamp": "2026-03-26T20:20:00Z",
  "payload": {},
  "meta": {
    "userId": "user123",
    "groupId": "group456",
    "messageId": "msg789"
  }
}
```

## 🗄️ 数据库结构

### 表结构
- **users**: 用户表
- **groups**: 群组表
- **group_members**: 群组成员关系表
- **messages**: 消息表

详见 `database-schema.md`

## ⚙️ 配置说明

### 主服务器配置 (mqtt-chat-server)
```json
{
  "mqtt": {
    "port": 1883,
    "websocketPort": 8883
  },
  "http": {
    "port": 3000
  },
  "database": {
    "path": "./data/chat.db"
  }
}
```

### 接入端配置 (mqtt-chat-client)
```json
{
  "mqtt": {
    "host": "localhost",
    "port": 1883
  },
  "http": {
    "host": "localhost",
    "port": 3000
  }
}
```

## 🚀 启动说明

### 主服务器
```bash
cd mqtt-chat-server
npm install
npm run build
npm start
```

### 接入端
```bash
cd mqtt-chat-client
npm install
npm run build
npm start
```

## 📝 CLI 命令

| 命令 | 说明 |
|------|------|
| `/login <username> <password>` | 登录系统 |
| `/register <username> <password>` | 注册用户 |
| `/create <groupname>` | 创建群组 |
| `/join <groupId>` | 加入群组 |
| `/leave <groupId>` | 离开群组 |
| `/groups` | 列出我的群组 |
| `/send <groupId> <message>` | 发送消息 |
| `/history <groupId> [limit]` | 查看历史 |
| `/quit` | 退出程序 |

## 🔐 安全考虑

1. 用户密码使用 bcrypt 加密存储
2. MQTT 连接需要认证
3. 敏感操作需要 token 验证

## 📦 依赖清单

详见各项目的 `package.json`
