# MQTT 群聊系统 🚀

基于 MQTT 协议的轻量级群聊系统，包含主服务器和 CLI 接入端两个项目。

## 📁 项目结构

```
Agent2Agent/
├── design/                    # 设计文档
│   ├── README.md             # 设计总览
│   ├── mqtt-protocol.md      # MQTT 协议设计
│   └── database-schema.md    # 数据库结构设计
├── mqtt-chat-server/         # 主服务器
│   ├── src/
│   │   ├── index.ts          # 主入口
│   │   ├── config/           # 配置
│   │   ├── mqtt/             # MQTT Broker
│   │   └── http/             # HTTP API
│   └── data/                 # SQLite 数据库
└── mqtt-chat-client/         # 接入端（CLI）
    ├── src/
    │   ├── index.ts          # 主入口
    │   ├── config/           # 配置
    │   ├── mqtt/             # MQTT 客户端
    │   ├── cli/              # 命令解析
    │   └── services/         # 业务服务
    └── README.md             # 客户端使用说明
```

## 🛠️ 环境要求

- Node.js 24.x
- npm 或 pnpm 包管理器

## 🚀 快速开始

### 1. 启动主服务器

```bash
cd mqtt-chat-server

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 启动服务器
npm start
```

服务器将启动在以下端口：
- MQTT TCP: `1883`
- MQTT WebSocket: `8883`
- HTTP API: `3000`

### 2. 配置客户端一键启动（推荐）

```bash
cd mqtt-chat-client

# 安装依赖
npm install

# 全局链接（只需执行一次）
npm run link

# 之后可以在任意目录直接使用命令启动
mqtt-chat
```

或者直接在项目目录中启动：

```bash
cd mqtt-chat-client

# 启动客户端
npm start

# 或者开发模式（热更新）
npm run dev
```

## 📖 使用指南

### 注册和登录

```bash
# 注册新用户
> /register alice password123

# 登录
> /login alice password123
```

### 群组管理

```bash
# 创建群组
> /create 技术交流群

# 加入群组（需要群组 ID）
> /join <groupId>

# 离开群组
> /leave <groupId>

# 查看我的群组
> /groups

# 查看群组成员
> /members <groupId>
```

### 发送消息

```bash
# 发送群组消息
> /send <groupId> 你好，大家好！

# 查看消息历史
> /history <groupId>

# 查看消息历史（指定条数）
> /history <groupId> 100
```

### 其他命令

```bash
# 查看所有在线用户
> /users

# 显示帮助
> /help

# 退出程序
> /quit
```

## 🔌 HTTP API 接口

基础 URL: `http://localhost:3000`

### 用户接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/users/register` | 注册用户 |
| POST | `/api/users/login` | 用户登录 |
| GET | `/api/users/me` | 获取当前用户信息 |
| GET | `/api/users` | 获取所有用户列表 |

### 群组接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/groups` | 创建群组 |
| GET | `/api/groups` | 获取用户的群组列表 |
| GET | `/api/groups/:groupId` | 获取群组详情 |
| GET | `/api/groups/:groupId/members` | 获取群组成员 |
| POST | `/api/groups/:groupId/join` | 加入群组 |
| POST | `/api/groups/:groupId/leave` | 离开群组 |

### 消息接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/groups/:groupId/messages` | 获取群组消息历史 |
| GET | `/api/messages/private/:userId` | 获取私聊消息 |

## ⚙️ 配置说明

### 服务器配置

编辑 `mqtt-chat-server/src/config/index.ts`:

```typescript
export const config = {
  mqtt: {
    port: 1883,              // MQTT TCP 端口
    websocketPort: 8883      // MQTT WebSocket 端口
  },
  http: {
    port: 3000              // HTTP API 端口
  },
  database: {
    path: './data/chat.db'   // SQLite 数据库路径
  },
  jwt: {
    secret: 'your-secret-key',  // JWT 密钥
    expiresIn: '7d'              // Token 过期时间
  }
};
```

### 客户端配置

编辑 `mqtt-chat-client/src/config/index.ts`:

```typescript
export const config = {
  mqtt: {
    host: 'localhost',      // MQTT 服务器地址
    port: 1883,            // MQTT 端口
    protocol: 'mqtt'        // 协议类型
  },
  http: {
    host: 'localhost',      // HTTP API 地址
    port: 3000             // HTTP API 端口
  }
};
```

## 🗄️ 数据库

使用 SQLite 作为数据库，数据库文件位于 `mqtt-chat-server/data/chat.db`。

### 主要表结构

- **users**: 用户表
- **groups**: 群组表
- **group_members**: 群组成员关系表
- **messages**: 消息表
- **user_sessions**: 用户会话表

详细结构请查看 `design/database-schema.md`

## 📡 MQTT 主题结构

```
chat/
├── auth/
│   ├── login              # 用户登录
│   └── register           # 用户注册
├── group/
│   └── {groupId}/
│       ├── join           # 加入群组
│       ├── leave          # 离开群组
│       └── message        # 群组消息
├── user/
│   └── {userId}/
│       └── private        # 私聊消息
├── presence/
│   └── {userId}           # 在线状态
└── system/
    └── announce           # 系统公告
```

详细协议设计请查看 `design/mqtt-protocol.md`

## 🔐 安全特性

1. **密码加密**: 使用 bcrypt 对用户密码进行加密存储
2. **Token 认证**: 使用 JWT 进行身份验证
3. **消息加密**: 消息内容以 JSON 格式传输（生产环境建议添加端到端加密）

## 🐛 常见问题

### 连接失败

1. 检查服务器是否启动
2. 检查端口是否被占用
3. 检查防火墙设置

### 无法登录

1. 确认用户名和密码正确
2. 检查服务器日志

### 消息发送失败

1. 确认已加入群组
2. 检查网络连接

## 📝 开发说明

### 技术栈

**服务器端:**
- `aedes`: MQTT Broker
- `express`: HTTP API 框架
- `better-sqlite3`: SQLite 数据库
- `TypeScript`: 开发语言

**客户端:**
- `mqtt`: MQTT.js 客户端
- `chalk`: CLI 彩色输出
- `TypeScript`: 开发语言

### 编译和运行

```bash
# 服务器
cd mqtt-chat-server
npm run build  # 编译
npm start       # 运行

# 客户端
cd mqtt-chat-client
npm run build  # 编译
npm start       # 运行
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📚 相关文档

- [MQTT 协议设计](./design/mqtt-protocol.md)
- [数据库结构设计](./design/database-schema.md)

---

**祝你使用愉快！** 🎉
