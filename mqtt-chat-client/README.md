# MQTT Chat CLI 使用指南

## 🚀 快速开始

### 1. 启动 CLI

```bash
cd mqtt-chat-client
./start.sh
```

### 2. 基本流程

```
1. 注册账号: /register <用户名> <密码>
2. 登录: /login <用户名> <密码>
3. 创建群组: /create <群组名>
4. 加入群组: /join <群组名>
5. 开始聊天: 直接输入消息
```

## ⚡ 命令行模式（新功能）

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
# 快速登录并保持连接
mqtt-chat alice password123

# 登录并进入指定群组
mqtt-chat alice password123 general

# 一行命令完成所有操作
mqtt-chat alice password123 general "Hello everyone!"

# 验证账号密码是否正确
mqtt-chat --validate alice password123
```

### 使用流程

```
1. 命令行登录 → 自动连接 MQTT → 进入交互模式
2. 使用 /join 加入群组
3. 直接发送消息
```

## ⌨️ Tab 自动补全

CLI 支持 Tab 键自动补全功能：

| 触发条件 | 补全内容 | 示例 |
|---------|---------|------|
| `/` | 所有命令列表 | `/login` → `/login` |
| `/j` | 命令前缀匹配 | `/j` → `/join` |
| `@` | 在线用户搜索 | `@c` → `@czhmisaka` |
| `:` | 表情名称 | `:thu` → `:thumbsup:` |
| `/send ` | 群组 ID | `/send test` |
| `/subscribe ` | keyword/topic/user |

### 用户搜索

输入 `@` 可触发交互式用户选择器：
- 显示所有在线用户
- 支持模糊搜索
- 方向键选择 + 回车确认
- 支持 10+ 个备选项

```
示例流程：
> @c[Tab]
→ 弹出选择列表：czhmisaka, carl, charlie
→ 选择后自动填入：@czhmisaka 
```

## 📖 完整命令列表

### 认证命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/register <用户名> <密码>` | 注册新账号 | `/register alice password123` |
| `/login <用户名> <密码>` | 登录账号 | `/login alice password123` |
| `/who` | 查看在线用户 | `/who` |

### 群组命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/create <群组名>` | 创建新群组 | `/create general` |
| `/join <群组名>` | 加入群组 | `/join general` |
| `/leave <群组名>` | 离开群组 | `/leave general` |
| `/list` | 列出所有群组 | `/list` |
| `/members <群组名>` | 查看群组成员 | `/members general` |

### 消息命令

| 命令 | 说明 | 示例 |
|------|------|------|
| 直接输入文本 | 发送消息到当前群组 | `Hello everyone!` |
| `/send <群组> <消息>` | 向指定群组发送消息 | `/send general Hello` |
| `/history <群组> [条数]` | 查看历史消息 | `/history general 50` |
| `/highlight <消息ID>` | 高亮消息 ⭐ | `/highlight msg_123` |
| `/pin <消息ID>` | 置顶消息 📌 | `/pin msg_123` |
| `/unpin <消息ID>` | 取消置顶 | `/unpin msg_123` |
| `/react <消息ID> [表情]` | 添加表情反应 | `/react msg_123 👍` |
| `/recall <消息ID>` | 撤回消息 | `/recall msg_123` |

### 提及命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `@用户名` | 在消息中提及用户 | `@alice 你好！` |
| `/mention` | 查看所有提及我的消息 | `/mention` |

### 订阅命令 🔔

| 命令 | 说明 | 示例 |
|------|------|------|
| `/subscribe keyword <关键词>` | 订阅关键词 | `/subscribe keyword 重要` |
| `/subscribe topic <话题>` | 订阅话题 | `/subscribe topic 技术` |
| `/subscribe user <用户名>` | 订阅用户 | `/subscribe user alice` |
| `/subscriptions` | 查看我的所有订阅 | `/subscriptions` |

### 表情命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `:emoji:` | 使用表情 | `:thumbsup:` |
| `/emoji add <名称> <表情>` | 添加自定义表情 | `/emoji add smile 😊` |

### 统计和其他

| 命令 | 说明 | 示例 |
|------|------|------|
| `/stats [用户名]` | 查看消息统计 📊 | `/stats alice` |
| `/clear` | 清空屏幕 | `/clear` |
| `/help` | 显示帮助信息 | `/help` |
| `/exit` | 退出程序 | `/exit` |

## 💡 使用示例

### 示例 1: 命令行模式

```bash
# 1. 一行命令登录并保持连接
$ mqtt-chat alice password123

# 输出：
╔══════════════════════════════════════════╗
║       MQTT Chat CLI v2.0 (Extended)      ║
╚══════════════════════════════════════════╝
📡 Connecting...
🔐 Logging in as alice...
✅ Logged in successfully
✅ Connected to MQTT server
✅ MQTT services initialized
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Connected - entering interactive mode
   Use /join <groupId> to join a group
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 2. 进入交互模式后加入群组
> /join general
✅ Joined group: general

# 3. 发送消息
> Hello everyone!
```

### 示例 2: 一行命令完成所有操作

```bash
# 创建群组、发送消息、保持连接
$ mqtt-chat alice password123 tech-chat "Initial message"

# 如果群组不存在会失败，需要先用 /create 创建
```

### 示例 3: 使用 Tab 补全

```bash
# 输入 / 后按 Tab 查看所有命令
> /[Tab]
/help /login /register /who /list /exit ...

# 输入 @ 后按 Tab 选择用户
> @[Tab]
→ 显示所有在线用户列表

# 输入 : 后按 Tab 查看表情
> :[Tab]
→ :thumbsup: :heart: :laugh: ...
```

### 示例 4: 完整聊天流程

```bash
# 1. 命令行登录
$ mqtt-chat alice password123

# 2. 注册账号（如需要）
> /register alice password123

# 3. 登录
> /login alice password123

# 4. 创建群组
> /create tech-chat

# 5. 加入群组
> /join tech-chat

# 6. 开始聊天
> Hello everyone!
🟢 10:30 | alice: Hello everyone!

# 7. 提及其他用户（使用 Tab 补全）
> @bob[Tab] 你好！
🟢 10:31 | alice: @bob 你好！

# 8. 使用表情
> 这是一个好主意 :thumbsup:
```

## 🎨 界面说明

### 消息前缀

- 🟢 **绿色** - 你自己发送的消息
- 🔵 **蓝色** - 其他用户发送的消息
- ⚪ **灰色** - 系统消息

### 消息状态

- ⭐ **黄色边框** - 高亮消息
- 📌 **橙色标记** - 置顶消息
- 💬 **反应显示** - 表情反应列表

### 通知类型

- 💬 **提及通知** - 有人@你
- 🔔 **订阅匹配** - 匹配你的订阅条件
- ⭐ **高亮通知** - 你的消息被高亮
- 📌 **置顶通知** - 你的消息被置顶

## ⚠️ 注意事项

1. **登录前无法发送消息** - 必须先注册并登录
2. **需要加入群组才能聊天** - 使用 `/join <群组>` 加入
3. **MQTT 连接失败** - 检查后端服务是否运行
4. **表情名称** - 使用冒号包裹，如 `:thumbsup:`
5. **命令行模式会保持连接** - 即使不指定群组也会保持 MQTT 连接

## 🔧 故障排除

### 问题 1: 连接失败

```bash
# 检查后端是否运行
curl http://localhost:14070/health

# 检查 MQTT 端口
nc -zv localhost 14080
```

### 问题 2: 无法登录

```bash
# 1. 先注册
> /register username password

# 2. 再登录
> /login username password
```

### 问题 3: 找不到群组

```bash
# 查看所有可用的群组
> /list

# 确保群组已创建
> /create my-group
```

## 📞 获取帮助

- 查看完整帮助: `/help`
- 查看命令列表: 直接查看 renderer.ts
- 查看源码: `src/cli/` 目录

---

**版本**: v2.0 (Extended)  
**新增功能**: 命令行参数支持、Tab 自动补全、用户搜索  
**最后更新**: 2026-03-31
