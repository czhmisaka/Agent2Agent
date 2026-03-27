# CLI 聊天客户端 - 使用指南

## 🎉 系统已就绪！

### 📊 服务状态
```
HTTP API: http://localhost:14050 ✅
MQTT TCP: localhost:1883 ✅
WebSocket: localhost:8883 ✅
```

## 🚀 使用方法

### 步骤 1: 启动 Alice 客户端
```bash
cd /Users/chenzhihan/Desktop/Agent2Agent/mqtt-chat-server
python3 scripts/cli_alice.py
```

输出示例：
```
==================================================
   💬 MQTT Chat CLI - Alice
==================================================

📝 Registering user: alice_cli
✅ Registration successful!
   User ID: xxx-xxx-xxx

🔐 Logging in as: alice_cli
✅ Login successful!
   User ID: xxx-xxx-xxx

📦 Creating test group...
✅ Group created!
   Group ID: xxx-xxx-xxx

🔌 MQTT Connected successfully
📡 Subscribed to: chat/group/xxx-xxx-xxx/message

==================================================
   Chat started! Type your messages below:
==================================================

[alice_cli]: Hello Bob!
```

### 步骤 2: 启动 Bob 客户端（新终端窗口）
```bash
cd /Users/chenzhihan/Desktop/Agent2Agent/mqtt-chat-server
python3 scripts/cli_bob.py
```

输出示例：
```
==================================================
   💬 MQTT Chat CLI - Bob
==================================================

📝 Registering user: bob_cli
✅ Registration successful!
   User ID: yyy-yyy-yyy

🔐 Logging in as: bob_cli
✅ Login successful!
   User ID: yyy-yyy-yyy

📦 Joining test group...
✅ Using existing group
   Group ID: xxx-xxx-xxx

🔌 MQTT Connected successfully
📡 Subscribed to: chat/group/xxx-xxx-xxx/message

==================================================
   Chat started! Type your messages below:
==================================================

[bob_cli]: Hi Alice!
```

### 步骤 3: 开始聊天！

现在两个终端都可以互相收发消息了！

**Alice 终端：**
```
[alice_cli]: Hello Bob!
[bob_cli]: Hi Alice!
[alice_cli]: How are you?
[bob_cli]: I'm fine! And you?
```

**Bob 终端：**
```
[alice_cli]: Hello Bob!
[bob_cli]: Hi Alice!
[alice_cli]: How are you?
[bob_cli]: I'm fine! And you?
```

## 📱 主机端查看数据

### 查看所有聊天记录
```bash
curl -s http://localhost:14050/api/admin/messages | python3 -m json.tool
```

### 查看所有群组
```bash
curl -s http://localhost:14050/api/admin/groups | python3 -m json.tool
```

### 查看管理界面
在浏览器打开：
```
http://localhost:14050/admin/index.html
```

## 🔧 技术细节

### 消息流程
```
Alice (CLI) 
    ↓ MQTT Publish
    ↓
MQTT Broker (1883)
    ↓
Bob (CLI) ← 实时接收
    ↓
数据库 (SQLite)
```

### MQTT Topic
```
chat/group/{group_id}/message
```

### 认证方式
- HTTP API: JWT Bearer Token
- MQTT: Username + Password (JWT Token)

## ❓ 常见问题

### Q: mosquitto 没有安装？
A: 不需要！使用 Python 的 paho-mqtt 库

### Q: 消息发送失败？
A: 检查服务器是否在运行：
```bash
curl http://localhost:14050/health
```

### Q: 如何退出？
A: 输入 `exit` 或 `quit`，或按 `Ctrl+C`

### Q: 需要同时运行两个客户端吗？
A: 是的！需要同时运行 Alice 和 Bob 才能聊天

## 🎊 测试清单

- [ ] Alice 客户端启动成功
- [ ] Bob 客户端启动成功
- [ ] Alice 发送消息给 Bob
- [ ] Bob 收到 Alice 的消息
- [ ] Bob 回复 Alice
- [ ] Alice 收到 Bob 的消息
- [ ] 管理界面显示所有消息

## 🎉 恭喜！

如果所有测试都通过，说明你的 MQTT 聊天系统已经完全正常工作了！

现在你可以：
1. 在两个终端窗口中聊天
2. 在浏览器中查看管理界面
3. 观察实时消息传递
