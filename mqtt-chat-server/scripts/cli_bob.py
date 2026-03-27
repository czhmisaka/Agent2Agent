#!/usr/bin/env python3
# ===========================================
# MQTT Chat CLI Client - Bob
# ===========================================

import json
import requests
import time
import sys
from datetime import datetime
from paho.mqtt import client as mqtt_client

# 配置
SERVER_URL = "http://localhost:14050"
MQTT_HOST = "localhost"
MQTT_PORT = 1883
USERNAME = "bob_cli"
PASSWORD = "Bob123"

# 颜色
class Colors:
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    RED = '\033[0;31m'
    NC = '\033[0m'  # No Color

# 状态
token = ""
user_id = ""
group_id = ""

def log(color, message):
    print(f"{color}{message}{Colors.NC}")

def register_user():
    """注册用户"""
    log(Colors.YELLOW, "📝 Registering user: bob_cli")
    
    try:
        response = requests.post(
            f"{SERVER_URL}/api/users/register",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=5
        )
        data = response.json()
        
        if response.status_code == 200 and data.get('success'):
            global token, user_id
            token = data['token']
            user_id = data['userId']
            log(Colors.GREEN, f"✅ Registration successful!")
            log(Colors.MAGENTA, f"   User ID: {user_id}")
        else:
            log(Colors.YELLOW, "User exists, trying to login...")
            login_user()
    except Exception as e:
        log(Colors.RED, f"❌ Registration error: {e}")
        sys.exit(1)

def login_user():
    """登录"""
    log(Colors.YELLOW, "🔐 Logging in as: bob_cli")
    
    try:
        response = requests.post(
            f"{SERVER_URL}/api/users/login",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=5
        )
        data = response.json()
        
        if response.status_code == 200 and data.get('success'):
            global token, user_id
            token = data['token']
            user_id = data['userId']
            log(Colors.GREEN, f"✅ Login successful!")
            log(Colors.MAGENTA, f"   User ID: {user_id}")
        else:
            log(Colors.RED, f"❌ Login failed: {data}")
            sys.exit(1)
    except Exception as e:
        log(Colors.RED, f"❌ Login error: {e}")
        sys.exit(1)

def join_group():
    """加入群组"""
    global group_id
    log(Colors.YELLOW, "📦 Joining test group...")
    
    try:
        response = requests.get(
            f"{SERVER_URL}/api/groups",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        groups = response.json()
        
        if groups and len(groups) > 0:
            group_id = groups[0]['id']
            log(Colors.GREEN, f"✅ Using existing group")
            log(Colors.MAGENTA, f"   Group ID: {group_id}")
            
            # 尝试加入群组
            try:
                requests.post(
                    f"{SERVER_URL}/api/groups/{group_id}/join",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5
                )
                log(Colors.GREEN, "✅ Joined group successfully")
            except:
                pass
        else:
            log(Colors.RED, "❌ No groups found. Please create one first.")
            sys.exit(1)
    except Exception as e:
        log(Colors.RED, f"❌ Join group error: {e}")
        sys.exit(1)

def on_connect(client, userdata, flags, rc):
    """MQTT连接回调"""
    if rc == 0:
        log(Colors.GREEN, "🔌 MQTT Connected successfully")
        topic = f"chat/group/{group_id}/message"
        client.subscribe(topic)
        log(Colors.BLUE, f"📡 Subscribed to: {topic}")
    else:
        log(Colors.RED, f"❌ MQTT Connection failed with code {rc}")

def on_message(client, userdata, msg):
    """收到消息回调"""
    try:
        message_data = json.loads(msg.payload.decode())
        sender = message_data.get('username', 'Unknown')
        content = message_data.get('content', '')
        
        if sender != USERNAME:
            log(Colors.MAGENTA, f"[{sender}]: {content}")
    except:
        pass

def send_message(message):
    """发送消息"""
    topic = f"chat/group/{group_id}/message"
    
    message_data = {
        "sender_id": user_id,
        "username": USERNAME,
        "content": message,
        "group_id": group_id,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    
    # 通过 MQTT 发送
    try:
        mqtt_client.Client.publish(mqtt_client.Client, topic, json.dumps(message_data))
    except:
        pass
    
    # 保存到数据库
    try:
        requests.post(
            f"{SERVER_URL}/api/groups/{group_id}/messages",
            json={"content": message},
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
    except:
        pass
    
    log(Colors.MAGENTA, f"[{USERNAME}]: {message}")

def main():
    """主函数"""
    log(Colors.MAGENTA, "=" * 50)
    log(Colors.MAGENTA, "   💬 MQTT Chat CLI - Bob")
    log(Colors.MAGENTA, "=" * 50)
    print()
    
    # 注册/登录
    register_user()
    login_user()
    join_group()
    
    # 创建 MQTT 客户端
    client = mqtt_client.Client(client_id=f"bob_cli_{int(time.time())}")
    client.username_pw_set(USERNAME, token)
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_start()
    except Exception as e:
        log(Colors.RED, f"❌ MQTT connection error: {e}")
        sys.exit(1)
    
    print()
    log(Colors.GREEN, "=" * 50)
    log(Colors.GREEN, "   Chat started! Type your messages below:")
    log(Colors.GREEN, "=" * 50)
    print()
    
    # 聊天循环
    try:
        while True:
            try:
                message = input(f"{Colors.MAGENTA}[{USERNAME}]{Colors.NC}: ").strip()
                
                if message.lower() in ['exit', 'quit']:
                    log(Colors.YELLOW, "Goodbye!")
                    break
                
                if message:
                    send_message(message)
            except KeyboardInterrupt:
                log(Colors.YELLOW, "\nGoodbye!")
                break
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
