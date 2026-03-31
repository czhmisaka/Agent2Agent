#!/bin/bash
# Agent 测试脚本

cd /Users/chenzhihan/Desktop/Agent2Agent/mqtt-chat-client

source ~/.nvm/nvm.sh
nvm use 20 > /dev/null 2>&1

echo "=== 注册/登录 ==="
echo "/register agentbot2 SecurePassword123"
sleep 1

echo "/login agentbot MyPassword123"
sleep 1

echo "=== 创建群组 ==="
echo "/create agent-group"

echo "=== 加入群组 ==="
echo "/join agent-group"

echo "=== 发送消息 ==="
echo "Hello from Agent bot! Testing the CLI."

echo "=== 退出 ==="
echo "/exit"
