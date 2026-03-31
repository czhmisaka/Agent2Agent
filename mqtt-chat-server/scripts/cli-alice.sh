#!/bin/bash
# ===========================================
# MQTT Chat CLI Client - Alice
# ===========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
SERVER_URL="http://localhost:14050"
MQTT_WS_PORT="14083"
USERNAME="alice_cli"
PASSWORD="Alice123"

# 状态
TOKEN=""
USER_ID=""
GROUP_ID=""

echo -e "${CYAN}=========================================="
echo -e "   💬 MQTT Chat CLI - Alice"
echo -e "==========================================${NC}"
echo ""

# 注册用户
register_user() {
    echo -e "${YELLOW}📝 Registering user: $USERNAME${NC}"
    
    RESPONSE=$(curl -s -X POST "$SERVER_URL/api/users/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
    
    if echo "$RESPONSE" | grep -q "success"; then
        TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Registration successful!${NC}"
        echo -e "   User ID: ${CYAN}$USER_ID${NC}"
    else
        # 用户可能已存在，尝试登录
        echo -e "${YELLOW}User exists, trying to login...${NC}"
        login_user
    fi
}

# 登录
login_user() {
    echo -e "${YELLOW}🔐 Logging in as: $USERNAME${NC}"
    
    RESPONSE=$(curl -s -X POST "$SERVER_URL/api/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
    
    if echo "$RESPONSE" | grep -q "success"; then
        TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Login successful!${NC}"
        echo -e "   User ID: ${CYAN}$USER_ID${NC}"
    else
        echo -e "${RED}❌ Login failed: $RESPONSE${NC}"
        exit 1
    fi
}

# 创建群组
create_group() {
    echo -e "${YELLOW}📦 Creating test group...${NC}"
    
    RESPONSE=$(curl -s -X POST "$SERVER_URL/api/groups" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"name":"CLI Test Room","description":"CLI chat room for testing"}')
    
    if echo "$RESPONSE" | grep -q "success"; then
        GROUP_ID=$(echo "$RESPONSE" | grep -o '"groupId":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Group created!${NC}"
        echo -e "   Group ID: ${CYAN}$GROUP_ID${NC}"
    else
        # 群组可能已存在，获取群组ID
        echo -e "${YELLOW}Getting existing groups...${NC}"
        GROUPS=$(curl -s "$SERVER_URL/api/groups" \
            -H "Authorization: Bearer $TOKEN")
        GROUP_ID=$(echo "$GROUPS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo -e "${GREEN}✅ Using existing group${NC}"
        echo -e "   Group ID: ${CYAN}$GROUP_ID${NC}"
    fi
}

# 发送消息
send_message() {
    local message="$1"
    
    # 通过 MQTT 发送
    TOPIC="chat/group/$GROUP_ID/message"
    JSON_MSG="{\"sender_id\":\"$USER_ID\",\"username\":\"$USERNAME\",\"content\":\"$message\",\"group_id\":\"$GROUP_ID\",\"created_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    
    # 使用 mosquitto_pub 发送 MQTT 消息
    mosquitto_pub -h localhost -p 1883 -t "$TOPIC" -m "$JSON_MSG" -u "$USERNAME" -P "$TOKEN" 2>/dev/null
    
    # 同时保存到数据库
    curl -s -X POST "$SERVER_URL/api/groups/$GROUP_ID/messages" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"content\":\"$message\"}" > /dev/null
    
    echo -e "${GREEN}[$USERNAME]${NC}: $message"
}

# 启动 MQTT 监听
start_listener() {
    echo -e "${BLUE}🔊 Starting message listener...${NC}"
    echo -e "${BLUE}Press Ctrl+C to exit${NC}"
    echo ""
    
    # 使用 mosquitto_sub 监听消息
    mosquitto_sub -h localhost -p 1883 -t "chat/group/$GROUP_ID/message" -u "$USERNAME" -P "$TOKEN" 2>/dev/null | while read -r message; do
        if [ -n "$message" ]; then
            SENDER=$(echo "$message" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
            CONTENT=$(echo "$message" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)
            if [ "$SENDER" != "$USERNAME" ]; then
                echo -e "${CYAN}[$SENDER]${NC}: $CONTENT"
            fi
        fi
    done &
}

# 主函数
main() {
    register_user
    login_user
    create_group
    start_listener
    
    echo ""
    echo -e "${GREEN}=========================================="
    echo -e "   Chat started! Type your messages below:"
    echo -e "==========================================${NC}"
    echo ""
    
    # 聊天循环
    while true; do
        printf "${GREEN}[$USERNAME]${NC}: "
        read -r message
        if [ "$message" = "exit" ] || [ "$message" = "quit" ]; then
            echo -e "${YELLOW}Goodbye!${NC}"
            exit 0
        fi
        send_message "$message"
    done
}

# 运行
main
