# MQTT Chat CLI Agent Skill

## 📋 概述

这是给 AI Agent 使用的 MQTT Chat CLI 操作指南。Agent 可以使用此技能通过命令行与聊天系统交互。

---

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

## 🎯 核心能力

### 1. 命令行参数模式（推荐）

**优势**：
- 一行命令完成登录、加入群组、发送消息
- 自动保持 MQTT 连接
- 适合 Agent 自动化操作

**基础语法**：
```bash
mqtt-chat <用户名> <密码> [群组ID] [消息]
```

**参数说明**：
| 参数 | 必填 | 说明 |
|------|------|------|
| 用户名 | ✅ | 登录用户名 |
| 密码 | ✅ | 登录密码（需满足复杂度要求） |
| 群组ID | ❌ | 加入的群组，不指定则保持连接待命 |
| 消息 | ❌ | 发送的消息内容 |

---

## 📝 Agent 常用操作

### 🔐 1. 登录并保持连接

```bash
mqtt-chat czhmisaka Czh12345
```

**使用场景**：
- Agent 需要持续监听消息
- 需要响应用户指令
- 进行多轮对话

### 💬 2. 发送消息

```bash
mqtt-chat <用户名> <密码> <群组ID> <消息内容>
```

**示例**：
```bash
# 发送简单消息
mqtt-chat czhmisaka Czh12345 test "Hello everyone!"

# 发送提及用户的消息
mqtt-chat czhmisaka Czh12345 test "@agentbot 你好！"

# 发送带表情的消息
mqtt-chat czhmisaka Czh12345 test "这个方案很好 👍"
```

### 🤖 3. agentbot 自动回复

agentbot 是一个自动回复机器人，监听 test 群组的消息。当消息包含 `@agentbot` 时会自动回复。

```bash
# 用户发送消息提及 agentbot
mqtt-chat czhmisaka Czh12345 test "@agentbot 你好"

# agentbot 会自动回复
```

### 📊 4. 查看消息

```bash
# 查看群组历史消息
# 需要先进入交互模式
mqtt-chat czhmisaka Czh12345 test
> /history test 50
```

### 👥 5. 查看在线用户

```bash
mqtt-chat czhmisaka Czh12345 test
> /who
```

---

## 🔧 Agent 实现示例

### 示例 1: Python 调用

```python
import subprocess

def send_message(username, password, group_id, message):
    """发送消息到指定群组"""
    cmd = [
        "mqtt-chat",
        username,
        password,
        group_id,
        message
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout, result.stderr

# 使用
stdout, stderr = send_message("czhmisaka", "Czh12345", "test", "Hello!")
```

### 示例 2: JavaScript/Node.js 调用

```javascript
const { execSync } = require('child_process');

function sendMessage(username, password, groupId, message) {
  try {
    const output = execSync(
      `mqtt-chat ${username} ${password} ${groupId} "${message}"`
    );
    return { success: true, output: output.toString() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 使用
const result = sendMessage("czhmisaka", "Czh12345", "test", "Hello!");
```

### 示例 3: 直接 MQTT 连接（高级）

```javascript
const mqtt = require('mqtt');
const http = require('http');

// 1. 登录获取 JWT token
async function login() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 14070,
      path: '/api/users/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ username: 'czhmisaka', password: 'Czh12345' }));
    req.end();
  });
}

async function main() {
  const loginRes = await login();
  if (!loginRes.success) {
    console.error('登录失败:', loginRes);
    return;
  }

  // 2. 使用 JWT token 连接 MQTT
  const client = mqtt.connect('mqtt://localhost:14080', {
    clientId: `agent-${Date.now()}`,
    username: loginRes.username,
    password: loginRes.token  // JWT token
  });

  client.on('connect', () => {
    console.log('✅ MQTT 已连接');
    
    // 3. 订阅消息
    client.subscribe('chat/group/test/message');
    
    // 4. 发送消息
    client.publish('chat/group/test/action', JSON.stringify({
      type: 'message',
      timestamp: new Date().toISOString(),
      payload: {
        userId: loginRes.userId,
        token: loginRes.token,
        content: 'Hello from code!'
      },
      meta: { groupId: 'test' }
    }), { qos: 1 });
  });

  client.on('message', (topic, message) => {
    console.log('📩 收到:', message.toString());
  });
}

main();
```

---

## 📌 Agent 工作流程

### 推荐流程

```
1. 验证环境
   └─ 检查 mqtt-chat 是否可用

2. 验证凭据（可选）
   └─ mqtt-chat --validate czhmisaka Czh12345

3. 执行业务操作
   ├─ 发送消息
   ├─ 查看历史
   └─ 获取用户列表

4. 处理结果
   └─ 解析 stdout/stderr
```

### 错误处理

```python
def safe_send_message(username, password, group_id, message):
    """安全发送消息，处理各种错误"""
    try:
        cmd = [
            "mqtt-chat",
            username,
            password,
            group_id,
            message
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30  # 超时保护
        )
        
        if result.returncode == 0:
            return {"success": True, "data": result.stdout}
        else:
            return {"success": False, "error": result.stderr}
            
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timeout"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## ⚙️ 配置要求

### 环境要求

- Node.js 16+
- mqtt-chat 已安装并链接
- 后端服务运行中：
  - HTTP API: localhost:14070
  - MQTT Broker: localhost:14080

### 依赖服务

| 服务 | 端口 | 用途 |
|------|------|------|
| HTTP API | 14070 | 认证、群组管理 |
| MQTT Broker | 14080 | 消息传输 |
| WebSocket | 14083 | WebSocket 连接 |

### 检查服务状态

```bash
# 检查 HTTP API
curl http://localhost:14070/api/users/login -X POST -H "Content-Type: application/json" -d '{"username":"czhmisaka","password":"Czh12345"}'

# 检查 MQTT（需要 mosquitto 或 mqtt-cli）
# nc -zv localhost 14080
```

---

## 🎯 最佳实践

### ✅ 推荐做法

1. **使用命令行参数模式**
   - 简单直接
   - 易于调试
   - 适合自动化

2. **设置合理的超时**
   - 建议 30 秒
   - 防止阻塞

3. **处理所有错误情况**
   - 网络错误
   - 认证失败
   - 消息发送失败

4. **记录操作日志**
   - 保存 stdout
   - 保存 stderr
   - 便于排查问题

### ❌ 避免做法

1. **不要忽略错误**
   ```python
   # ❌ 不好
   output = subprocess.check_output(cmd)
   
   # ✅ 好
   try:
       output = subprocess.check_output(cmd)
   except subprocess.CalledProcessError as e:
       log_error(e.stderr)
   ```

2. **不要硬编码凭据**
   ```python
   # ❌ 不好
   USERNAME = "czhmisaka"
   PASSWORD = "Czh12345"
   
   # ✅ 好
   USERNAME = os.getenv("CHAT_USERNAME")
   PASSWORD = os.getenv("CHAT_PASSWORD")
   ```

3. **不要无限等待**
   ```python
   # ❌ 不好
   subprocess.run(cmd)  # 可能永远阻塞
   
   # ✅ 好
   subprocess.run(cmd, timeout=30)
   ```

---

## 📚 完整命令参考

### 认证命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/register <user> <pwd>` | 注册账号 | `/register alice Czh12345` |
| `/login <user> <pwd>` | 登录账号 | `/login czhmisaka Czh12345` |
| `/who` | 查看在线用户 | `/who` |

### 群组命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/create <name>` | 创建群组 | `/create team-chat` |
| `/join <id>` | 加入群组 | `/join test` |
| `/leave <id>` | 离开群组 | `/leave test` |
| `/list` | 列出群组 | `/list` |
| `/members <id>` | 查看成员 | `/members test` |

### 消息命令

| 命令 | 说明 | 示例 |
|------|------|------|
| 直接输入 | 发送消息 | `Hello!` |
| `/send <g> <msg>` | 指定群组发送 | `/send test Hello` |
| `/history <g> [n]` | 查看历史 | `/history test 50` |
| `/mention` | 查看提及我的 | `/mention` |

### 机器人相关

| 命令 | 说明 | 示例 |
|------|------|------|
| `@agentbot` | 触发自动回复 | `@agentbot 你好` |
| `@所有人` | 提及所有成员 | `@所有人 开会了` |
| `@all` | 同上 | `@all 重要通知` |

---

## 🔍 调试技巧

### 1. 查看详细输出

```bash
# 捕获所有输出
mqtt-chat czhmisaka Czh12345 test "test" 2>&1
```

### 2. 验证凭据

```bash
# 不连接，只验证
curl -X POST http://localhost:14070/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"czhmisaka","password":"Czh12345"}'

# 成功输出：{"success":true,"userId":"...","username":"czhmisaka",...}
# 失败输出：{"error":"Username or password incorrect","code":1002}
```

### 3. 交互模式调试

```bash
# 进入交互模式，逐步操作
mqtt-chat czhmisaka Czh12345 test

> /who
> /list
> /history test 10
> /mention
```

### 4. 直接查看数据库

```bash
# 查看消息
sqlite3 data/chat.db "SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;"

# 查看提及
sqlite3 data/chat.db "SELECT * FROM message_mentions;"

# 查看用户
sqlite3 data/chat.db "SELECT username FROM users;"
```

---

## 📞 获取帮助

- **README**: `mqtt-chat-client/README.md`
- **源码**: `mqtt-chat-client/src/`
- **命令帮助**: `mqtt-chat` 后输入 `/help`
- **服务器日志**: 查看运行服务器的终端输出

---

**版本**: v3.0 (Updated with credentials)  
**创建日期**: 2026-03-31  
**最后更新**: 2026-03-31  
**适用对象**: AI Agent、自动化脚本
