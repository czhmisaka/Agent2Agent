# MQTT Chat CLI 使用指南

## 🔑 测试凭据

### 用户账户
| 用户名 | 密码 | 用途 |
|--------|------|------|
| czhmisaka | Czh12345 | 主测试用户 |
| agentbot | agentbot123 | 机器人账户 |

### 群组信息
| 群组名称 | 群组 ID | 成员 |
|----------|---------|------|
| test | 36a11e6a-28c1-4a40-b4b9-823ce16d8994 | czhmisaka, agentbot |

### ⚠️ 重要提示
- **密码要求**：至少 8 个字符 + 至少一个大写字母
- 示例：`Czh12345` ✅ / `czh123` ❌ (缺少大写字母)

---

## 🚀 快速开始

### 1. 启动 CLI

```bash
cd mqtt-chat-client
./start.sh
```

### 2. 基本流程

```
1. 登录: /login czhmisaka Czh12345
2. 加入群组: /join test
3. 开始聊天: 直接输入消息
```

### 3. 快速登录（命令行模式）

```bash
# 使用测试账户登录
mqtt-chat czhmisaka Czh12345 test "Hello!"

# 登录并保持连接
mqtt-chat czhmisaka Czh12345
```

---

## ⚡ 命令行模式

支持直接通过命令行参数执行操作，无需进入交互模式：

### 基础用法

```bash
# 登录并保持连接
mqtt-chat <用户名> <密码>

# 登录并加入群组
mqtt-chat <用户名> <密码> <群组ID>

# 登录、加入群组、发送消息
mqtt-chat <用户名> <密码> <群组ID> <消息内容>

# 仅验证凭据
mqtt-chat --validate <用户名> <密码>
```

### 示例

```bash
# 使用测试账户登录并进入 test 群组
mqtt-chat czhmisaka Czh12345 test

# 一行命令发送消息
mqtt-chat czhmisaka Czh12345 test "Hello everyone!"

# 验证账号密码
mqtt-chat --validate czhmisaka Czh12345
```

---

## ⌨️ Tab 自动补全

CLI 支持 Tab 键自动补全功能：

| 触发条件 | 补全内容 | 示例 |
|---------|---------|------|
| `/` | 所有命令列表 | `/login` → `/login` |
| `/j` | 命令前缀匹配 | `/j` → `/join` |
| `@` | 在线用户搜索 | `@c` → `@czhmisaka` |
| `:` | 表情名称 | `:thu` → `:thumbsup:` |
| `/send ` | 群组 ID | `/send test` |

---

## 📖 完整命令列表

### 认证命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/register <用户名> <密码>` | 注册新账号 | `/register alice Czh12345` |
| `/login <用户名> <密码>` | 登录账号 | `/login czhmisaka Czh12345` |
| `/who` | 查看在线用户 | `/who` |

### 群组命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/create <群组名>` | 创建新群组 | `/create my-group` |
| `/join <群组名>` | 加入群组 | `/join test` |
| `/leave <群组名>` | 离开群组 | `/leave test` |
| `/list` | 列出所有群组 | `/list` |
| `/members <群组名>` | 查看群组成员 | `/members test` |

### 消息命令

| 命令 | 说明 | 示例 |
|------|------|------|
| 直接输入文本 | 发送消息 | `Hello everyone!` |
| `/send <群组> <消息>` | 向指定群组发送 | `/send test Hello` |
| `/history <群组> [条数]` | 查看历史消息 | `/history test 50` |
| `/highlight <消息ID>` | 高亮消息 | `/highlight msg_123` |
| `/pin <消息ID>` | 置顶消息 | `/pin msg_123` |
| `/react <消息ID> [表情]` | 添加表情反应 | `/react msg_123 👍` |
| `/recall <消息ID>` | 撤回消息 | `/recall msg_123` |

### 提及命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `@用户名` | 提及用户 | `@agentbot 你好！` |
| `/mention` | 查看提及我的消息 | `/mention` |

### 订阅命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/subscribe keyword <关键词>` | 订阅关键词 | `/subscribe keyword 重要` |
| `/subscribe user <用户名>` | 订阅用户 | `/subscribe user alice` |
| `/subscriptions` | 查看订阅 | `/subscriptions` |

### 其他命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/stats [用户名]` | 消息统计 | `/stats czhmisaka` |
| `/clear` | 清空屏幕 | `/clear` |
| `/help` | 显示帮助 | `/help` |
| `/exit` | 退出 | `/exit` |

---

## 💡 使用示例

### 示例 1: 命令行模式快速登录

```bash
# 登录并进入 test 群组
mqtt-chat czhmisaka Czh12345 test

# 一行命令发送消息
mqtt-chat czhmisaka Czh12345 test "Hello from CLI!"
```

### 示例 2: 交互模式完整流程

```bash
# 1. 登录
> /login czhmisaka Czh12345

# 2. 查看在线用户
> /who

# 3. 加入群组
> /join test

# 4. 发送消息
> Hello everyone!

# 5. 提及 agentbot
> @agentbot 你好！
```

### 示例 3: agentbot 互动

```bash
# 发送消息提及 agentbot
> @agentbot 你好，请介绍一下自己

# agentbot 会自动回复
```

---

## 🎨 界面说明

### 消息前缀

- 🟢 **绿色** - 你发送的消息
- 🔵 **蓝色** - 其他用户消息
- ⚪ **灰色** - 系统消息

### 通知类型

- 💬 **提及通知** - 有人@你
- 🔔 **订阅匹配** - 匹配订阅条件

---

## ⚠️ 注意事项

1. **密码要求** - 至少 8 字符 + 至少一个大写字母
2. **登录前无法发消息** - 必须先登录
3. **需要加入群组** - 使用 `/join <群组>`
4. **MQTT 连接失败** - 检查后端服务

---

## 🔧 故障排除

### 检查服务状态

```bash
# HTTP API
curl http://localhost:14070/health

# 查看数据库用户
sqlite3 ../mqtt-chat-server/data/chat.db "SELECT username FROM users;"
```

### 数据库调试

```bash
# 查看消息
sqlite3 ../mqtt-chat-server/data/chat.db "SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;"

# 查看提及
sqlite3 ../mqtt-chat-server/data/chat.db "SELECT * FROM message_mentions;"
```

---

## 📞 获取帮助

- 查看完整帮助: `/help`
- 查看源码: `src/cli/` 目录
- AI Agent 技能文档: `MQTT_CHAT_CLI_SKILL.md`

---

**版本**: v2.1 (Updated with credentials)  
**最后更新**: 2026-03-31
