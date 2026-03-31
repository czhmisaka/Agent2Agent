# 🚀 MQTT Chat Server 部署指南

## 📋 目录

1. [环境要求](#环境要求)
2. [快速开始](#快速开始)
3. [Docker 部署](#docker-部署)
4. [本地开发部署](#本地开发部署)
5. [生产环境配置](#生产环境配置)
6. [测试验证](#测试验证)
7. [常见问题](#常见问题)

---

## 🖥️ 环境要求

### 必需环境

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.x | 20.x LTS |
| npm | 9.x | 10.x |
| Docker | 20.x | 24.x |
| Docker Compose | 2.x | 2.24+ |
| curl | 7.x | 最新版 |
| netcat (nc) | - | 用于端口检查 |

### 操作系统支持

- ✅ Linux (Ubuntu 20.04+, Debian 11+)
- ✅ macOS (Monterey 12+, Ventura 13+)
- ✅ Windows (WSL2 + Docker Desktop)

---

## ⚡ 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 1. 进入项目目录
cd mqtt-chat-server

# 2. 复制环境变量文件
cp .env.example .env

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f

# 5. 运行测试
chmod +x scripts/test.sh
./scripts/test.sh
```

### 方式二：本地部署

```bash
# 1. 进入项目目录
cd mqtt-chat-server

# 2. 安装依赖
npm install

# 3. 复制环境变量文件
cp .env.example .env

# 4. 编译 TypeScript
npm run build

# 5. 启动服务
npm start

# 6. 另一个终端运行测试
./scripts/test.sh
```

---

## 🐳 Docker 部署

### 1. 构建 Docker 镜像

```bash
# 构建镜像
docker build -t mqtt-chat-server:latest .

# 查看镜像
docker images | grep mqtt-chat-server
```

### 2. 启动服务

```bash
# 前台运行（查看日志）
docker-compose up

# 后台运行
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f mqtt-chat-server
```

### 3. 服务端口

| 端口 | 服务 | 协议 |
|------|------|------|
| 3000 | HTTP API | HTTP/REST |
| 14080 | MQTT Broker | TCP |
| 14083 | MQTT WebSocket | WebSocket |

### 4. 停止服务

```bash
# 停止服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 停止并删除镜像
docker-compose down --rmi local
```

### 5. 重启服务

```bash
# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build
```

---

## 💻 本地开发部署

### 1. 安装 Node.js

使用 nvm 安装（推荐）：

```bash
# 安装 nvm（如果还没有）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 使用 Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# 验证安装
node --version  # 应该显示 v20.x.x
npm --version   # 应该显示 10.x.x
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件（生产环境必须修改 JWT_SECRET）
nano .env
```

### 3. 开发模式

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化自动重启）
npm run dev

# 或者编译后运行
npm run build
npm start
```

### 4. 验证服务

```bash
# 检查健康状态
curl http://localhost:14070/health

# 应该返回
{"status":"ok","timestamp":"2026-03-26T..."}
```

---

## 🔒 生产环境配置

### 1. 环境变量配置

创建 `.env.production` 文件：

```bash
# 服务器配置
NODE_ENV=production
HTTP_PORT=3000
MQTT_PORT=14080
MQTT_WS_PORT=14083

# JWT 配置（必须修改！）
JWT_SECRET=your-very-long-and-secure-secret-key-at-least-32-chars
JWT_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=info

# CORS 配置（限制域名）
CORS_ORIGIN=https://your-domain.com

# 数据库
DB_PATH=/app/data/chat.db
```

### 2. 安全加固

#### 使用 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/mqtt-chat

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 配置
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # HTTP API
    location / {
        proxy_pass http://localhost:14070;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /mqtt {
        proxy_pass http://localhost:14083;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### 配置防火墙

```bash
# 只开放必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
```

### 3. 使用 PM2 进程管理

```bash
# 全局安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name mqtt-chat

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup

# 查看状态
pm2 status

# 查看日志
pm2 logs mqtt-chat

# 重启服务
pm2 restart mqtt-chat
```

---

## 🧪 测试验证

### 1. 运行完整测试套件

```bash
# 确保服务正在运行
docker-compose ps
# 或者
npm start

# 运行测试
chmod +x scripts/test.sh
./scripts/test.sh
```

### 2. 手动测试

#### 健康检查

```bash
curl http://localhost:14070/health
```

#### 用户注册

```bash
curl -X POST http://localhost:14070/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPass123"}'
```

#### 用户登录

```bash
curl -X POST http://localhost:14070/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPass123"}'
```

### 3. MQTT 连接测试

使用 mosquitto_clients：

```bash
# 订阅主题
mosquitto_sub -h localhost -p 14080 -t "chat/#" -v

# 发布消息（需要先获取有效 token）
mosquitto_pub -h localhost -p 14080 -t "chat/auth/login" -m '{
  "type": "login",
  "payload": {"username": "testuser", "password": "TestPass123"}
}'
```

### 4. WebSocket 连接测试

使用 `websocat`：

```bash
# 安装 websocat
# macOS: brew install websocat
# Linux: cargo install websocat

# 连接到 MQTT over WebSocket
websocat "ws://localhost:14083"
```

---

## ❓ 常见问题

### Q1: Docker 构建失败

**问题**: `docker build` 报错

**解决方案**:
```bash
# 清理 Docker 缓存
docker builder prune

# 重新构建
docker-compose build --no-cache
```

### Q2: 端口被占用

**问题**: `Error: listen EADDRINUSE`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :14070
lsof -i :14080
lsof -i :14083

# 杀掉进程或更改端口
# 编辑 .env 文件修改端口
```

### Q3: 数据库初始化失败

**问题**: `Database not initialized`

**解决方案**:
```bash
# 检查数据目录权限
ls -la data/

# 手动创建目录
mkdir -p data logs
chmod 755 data logs
```

### Q4: JWT Secret 警告

**问题**: 控制台显示 JWT Secret 警告

**解决方案**:
```bash
# 设置环境变量
export JWT_SECRET="your-very-long-secret-key-at-least-32-chars"

# 或编辑 .env 文件
echo "JWT_SECRET=your-very-long-secret-key-at-least-32-chars" >> .env
```

### Q5: MQTT 连接失败

**问题**: 客户端无法连接 MQTT

**解决方案**:
```bash
# 检查 MQTT 端口是否开放
nc -zv localhost 14080
nc -zv localhost 14083

# 检查 Docker 网络
docker network ls
docker network inspect mqtt-chat-server_mqtt-network
```

### Q6: 日志文件位置

**问题**: 找不到日志文件

**解决方案**:
```bash
# Docker 环境
docker exec mqtt-chat-server ls -la /app/logs/

# 本地环境
ls -la logs/
```

---

## 📞 获取帮助

- 📖 查看完整文档: [README.md](./README.md)
- 🐛 报告问题: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 讨论: [GitHub Discussions](https://github.com/your-repo/discussions)

---

**最后更新**: 2026-03-26
