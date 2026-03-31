#!/bin/bash
# ===========================================
# MQTT Chat Frontend 启动脚本
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
echo "║   🚀 MQTT Chat Frontend 启动脚本       ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

# 3. 检查 Vite 配置
echo -e "\n${BLUE}[3/4]${NC} 检查配置文件..."
if [ ! -f "vite.config.ts" ]; then
    echo -e "${RED}❌ vite.config.ts 不存在！${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Vite 配置正常${NC}"

# 4. 启动开发服务器
echo -e "\n${BLUE}[4/4]${NC} 启动开发服务器..."
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 前端启动成功！${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n🌐 访问地址:"
echo "   • 本地开发:   http://localhost:5173"
echo "   • API 代理:   http://localhost:5173/api"

echo -e "\n📡 后端服务:"
echo "   • HTTP API:  http://localhost:14070"
echo "   • MQTT TCP:  localhost:14080"

echo -e "\n🔧 常用命令:"
echo "   • 构建生产:   npm run build"
echo "   • 预览生产:   npm run preview"
echo "   • 停止服务:   Ctrl+C"

echo -e "\n${YELLOW}正在启动 Vite 开发服务器...${NC}\n"

# 启动开发服务器
npm run dev
