#!/bin/bash
# ===========================================
# MQTT Chat Client 启动脚本
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════╗"
echo "║   🚀 MQTT Chat Client 启动脚本         ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ==========================================
# 检查服务器是否可用
# ==========================================
check_server() {
    echo -e "\n${BLUE}检查服务器连接...${NC}"
    
    # 检查 HTTP API
    if curl -s --connect-timeout 3 http://localhost:14070/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTP API 服务器可访问 (localhost:14070)${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  HTTP API 服务器不可访问 (localhost:14070)${NC}"
        echo -e "${YELLOW}   提示：请确保 mqtt-chat-server 已启动${NC}"
        return 1
    fi
}

# 启动前检查
echo -e "\n${YELLOW}检查服务器状态...${NC}"
if ! check_server; then
    read -p "是否继续启动客户端？（可能会连接失败）[y/N]: " confirm
    case $confirm in
        y|Y) 
            echo -e "${YELLOW}继续启动...${NC}"
            ;;
        *)
            echo -e "${YELLOW}已取消启动${NC}"
            exit 0
            ;;
    esac
fi

# 1. 检查 Node.js 环境
echo -e "\n${BLUE}[1/4]${NC} 检查 Node.js 环境..."

# 检查 nvm 是否可用
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    echo -e "${GREEN}✅ nvm 已加载${NC}"
elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
    source "/usr/local/opt/nvm/nvm.sh"
    echo -e "${GREEN}✅ nvm 已加载${NC}"
fi

# 检查 Node.js 版本
NODE_VERSION=$(node --version 2>/dev/null || echo "")
if [ -z "$NODE_VERSION" ]; then
    echo -e "${RED}❌ Node.js 未安装！${NC}"
    echo "请安装 Node.js 20.x"
    echo "使用 nvm: nvm install 20 && nvm use 20"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本: $NODE_VERSION${NC}"

# 切换到 Node 20
if command -v nvm &> /dev/null; then
    nvm use 20 > /dev/null 2>&1 || true
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ 使用 Node.js: $NODE_VERSION${NC}"
fi

# 2. 安装依赖
echo -e "\n${BLUE}[2/4]${NC} 安装依赖..."
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules 已存在，跳过安装${NC}"
fi

# 3. 编译 TypeScript
echo -e "\n${BLUE}[3/4]${NC} 编译 TypeScript..."
npm run build
echo -e "${GREEN}✅ 编译完成${NC}"

# 4. 启动客户端
echo -e "\n${BLUE}[4/4]${NC} 启动客户端..."
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 客户端启动成功！${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n📡 连接配置:"
echo "   • MQTT Broker: localhost:14080"
echo "   • WebSocket:    localhost:14083"

echo -e "\n🔧 常用命令:"
echo "   • 查看帮助:   在 CLI 中输入 help"
echo "   • 退出程序:   Ctrl+C 或输入 exit"

echo -e "\n${YELLOW}正在启动客户端...${NC}\n"

# 启动客户端
npm start
