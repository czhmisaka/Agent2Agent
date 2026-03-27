#!/bin/bash
# ===========================================
# MQTT Chat CLI Client - Bob
# ===========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 配置
SERVER_URL="http://localhost:14050"
MQTT_WS_PORT="8883"
USERNAME="bob_cli"
PASSWORD="Bob123"

# 状态
TOKEN=""
USER_ID=""
GROUP_ID=""

echo -e "${MAGENTA}=========================================="
echo -e "   💬 MQTT Chat CLI - Bob"
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
        echo -e "   User ID: ${MAGENTA}$USER_ID${NC}"
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
        echo -e "   User ID: ${MAGENTA}$USER_ID${NC}"
    else
        echo -e "${RED}❌ Login failed: $RESPONSE${NC}"
        exit 1
    fi
}

# 加入群组
join_group() {
    echo -e "${YELLOW}📦 Joining test group...${NC}"
    
    # 获取群组ID
    GROUPS=$(curl -s "$SERVER_URL/api/groups" \
        -H "Authorization: Bearer $TOKEN")
    GROUP_ID=$(echo "$GROUPS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$GROUP_ID" ]; then
        echo -e "${GREEN}✅ Using existing group${NC}"
        echo -e "   Group ID: ${MAGENTA}$GROUP_ID${NC}"
        
        # 尝试加入群组
        curl -s -X POST "$SERVER_URL/api/groups/$GROUP_ID/join" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" > /dev/null
    else
        echo -e "${YELLOW}No groups found. Please create one first.${NC}"
        exit 1
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
    
    echo -e "${MAGENTA}[$USERNAME]${NC}: $message"
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
                echo -e "${MAGENTA}[$SENDER]${NC}: $CONTENT"
            fi
        fi
    done &
}

# 主函数
main() {
    register_user
    login_user
    join_group
    start_listener
    
    echo ""
    echo -e "${GREEN}=========================================="
    echo -e "   Chat started! Type your messages below:"
    echo -e "==========================================${NC}"
    echo ""
    
    # 聊天循环
    while true; do
        printf "${MAGENTA}[$USERNAME]${NC}: "
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
