# 🚀 MQTT Chat Server

基于 MQTT 协议的实时群聊系统服务器，支持用户认证、群组管理、消息收发等功能。

## ✨ 功能特性

### 🔐 安全特性
- **JWT Token 认证**：安全的用户身份验证
- **MQTT Broker 认证**：连接时验证用户名密码
- **发布/订阅授权**：严格的权限控制
- **密码强度验证**：强制使用强密码
- **XSS 防护**：消息内容过滤
- **速率限制**：防止暴力破解
- **Helmet 安全头部**：HTTP 安全增强
- **CORS 配置**：跨域资源共享控制

### 📡 MQTT 协议
- 支持 TCP 和 WebSocket 连接
- 主题结构：
  - `chat/auth/register` - 用户注册
  - `chat/auth/login` - 用户登录
  - `chat/group/{groupId}/message` - 群组消息
  - `chat/user/{userId}/private` - 私聊消息
  - `chat/presence/{userId}` - 在线状态

### 🌐 HTTP API
- RESTful API 设计
- 完整的 CRUD 操作
- JWT Bearer Token 认证
- 统一的错误处理

## 🛠️ 技术栈

- **运行时**：Node.js
- **语言**：TypeScript
- **MQTT Broker**：Aedes
- **数据库**：SQLite (better-sqlite3)
- **HTTP 框架**：Express.js
- **日志**：Winston
- **安全**：Helmet, CORS, bcrypt

## 📦 安装

```bash
# 克隆项目
git clone <repository-url>
cd mqtt-chat-server

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env
```

## 🚀 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start

# 运行测试
npm test
```

## ⚙️ 配置

环境变量配置（详见 `.env.example`）：

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `HTTP_PORT` | HTTP 服务端口 | 3000 |
| `MQTT_PORT` | MQTT TCP 端口 | 14080 |
| `MQTT_WS_PORT` | MQTT WebSocket 端口 | 14083 |
| `JWT_SECRET` | JWT 密钥（生产环境必填） | 自动生成 |
| `JWT_EXPIRES_IN` | Token 过期时间 | 7d |
| `LOG_LEVEL` | 日志级别 | info |
| `CORS_ORIGIN` | CORS 允许的来源 | * |

## 📡 MQTT API

### 用户注册
```javascript
// 发布到
'chat/auth/register'

// 消息格式
{
  type: 'register',
  timestamp: '2024-01-01T00:00:00Z',
  payload: {
    username: 'user123',
    password: 'Password123'
  }
}

// 响应主题
'chat/auth/register/response'
```

### 用户登录
```javascript
// 发布到
'chat/auth/login'

// 消息格式
{
  type: 'login',
  timestamp: '2024-01-01T00:00:00Z',
  payload: {
    username: 'user123',
    password: 'Password123'
  }
}

// 响应主题
'chat/auth/login/response'
```

### 发送群组消息
```javascript
// 发布到
`chat/group/${groupId}/message`

// 消息格式
{
  type: 'message',
  timestamp: '2024-01-01T00:00:00Z',
  payload: {
    userId: 'user-uuid',
    token: 'jwt-token',
    content: 'Hello, world!'
  }
}
```

### 发送私聊消息
```javascript
// 发布到
`chat/user/${receiverId}/private`

// 消息格式
{
  type: 'private',
  timestamp: '2024-01-01T00:00:00Z',
  payload: {
    senderId: 'sender-uuid',
    token: 'jwt-token',
    content: 'Private message'
  }
}
```

## 🌐 HTTP API

### 用户接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/users/register` | 用户注册 |
| POST | `/api/users/login` | 用户登录 |
| GET | `/api/users/me` | 获取当前用户信息 |
| GET | `/api/users` | 获取所有用户列表 |

### 群组接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/groups` | 创建群组 |
| GET | `/api/groups` | 获取用户的群组列表 |
| GET | `/api/groups/:groupId` | 获取群组详情 |
| GET | `/api/groups/:groupId/members` | 获取群组成员 |
| POST | `/api/groups/:groupId/join` | 加入群组 |
| POST | `/api/groups/:groupId/leave` | 离开群组 |

### 消息接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/groups/:groupId/messages` | 获取群组消息历史 |
| GET | `/api/messages/private/:userId` | 获取私聊消息历史 |

## 🔒 安全说明

### 生产环境部署

1. **必须设置 JWT_SECRET**：至少 32 个字符的安全密钥
2. **配置 CORS_ORIGIN**：设置具体的域名而非 `*`
3. **启用 HTTPS**：使用 TLS/SSL 加密通信
4. **配置防火墙**：限制端口访问
5. **监控日志**：定期检查 error.log

### 密码策略

- 最少 8 个字符
- 必须包含小写字母
- 必须包含大写字母
- 必须包含数字

## 📊 日志

日志文件位置：`logs/`

| 文件 | 描述 |
|------|------|
| `error.log` | 错误日志 |
| `combined.log` | 所有日志 |
| `http.log` | HTTP 请求日志 |

## 🧪 测试

```bash
# 运行单元测试
npm test

# 运行测试并查看覆盖率
npm run test:coverage
```

## 📝 开发

### 项目结构

```
src/
├── config/          # 配置管理
├── database/       # 数据库操作
├── http/          # HTTP API
├── mqtt/          # MQTT Broker
│   └── handlers/  # 消息处理器
├── utils/         # 工具函数
│   ├── errors.ts  # 错误处理
│   └── logger.ts  # 日志系统
└── index.ts       # 入口文件
```

### 添加新的 API 端点

1. 在 `src/http/server.ts` 中添加路由
2. 使用 `authMiddleware` 进行身份验证
3. 使用统一的错误处理
4. 添加日志记录

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👨‍💻 作者

MQTT Chat Team

## 🙏 鸣谢

- [Aedes](https://github.com/mqttjs/aedes) - MQTT Broker
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite 驱动
- [Express.js](https://expressjs.com/) - HTTP 框架
- [Winston](https://github.com/winstonjs/winston) - 日志系统
