#!/bin/bash
# ===========================================
# MQTT Chat Client 打包脚本
# 使用 pkg 将 Node.js 应用打包成可执行文件
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
echo "║   📦 MQTT Chat Client 打包脚本       ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 检查 Node.js 环境
echo -e "\n${BLUE}[1/5]${NC} 检查 Node.js 环境..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装！${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js 版本: $NODE_VERSION${NC}"

# 2. 切换到 Node 20
echo -e "\n${BLUE}[2/5]${NC} 切换到 Node 20..."
if command -v nvm &> /dev/null; then
    nvm use 20 > /dev/null 2>&1 || true
fi
echo -e "${GREEN}✅ Node 20 已激活: $(node --version)${NC}"

# 3. 安装依赖
echo -e "\n${BLUE}[3/5]${NC} 安装依赖..."
npm install
echo -e "${GREEN}✅ 依赖安装完成${NC}"

# 4. 编译 TypeScript
echo -e "\n${BLUE}[4/5]${NC} 编译 TypeScript..."
npm run build
echo -e "${GREEN}✅ TypeScript 编译完成${NC}"

# 5. 检查并安装 pkg
echo -e "\n${BLUE}[5/5]${NC} 打包可执行文件..."

if ! command -v pkg &> /dev/null; then
    echo -e "${YELLOW}⚠️  pkg 未安装，正在安装...${NC}"
    npm install -g pkg
fi

# 创建 dist 目录
mkdir -p dist

# 清理旧文件
rm -rf dist/*

# 目标平台
TARGETS=(
    "node20-macos-arm64"
    "node20-macos-x64"
    "node20-linux-arm64"
    "node20-linux-x64"
    "node20-win-x64"
)

echo -e "\n${CYAN}开始打包...${NC}"

for target in "${TARGETS[@]}"; do
    echo -e "${BLUE}打包: ${target}${NC}"
    pkg package.json -t "$target" -o dist/mqtt-chat 2>/dev/null || {
        echo -e "${YELLOW}⚠️  $target 打包失败，跳过${NC}"
    }
done

# 重命名文件
echo -e "\n${CYAN}整理输出文件...${NC}"

# macOS arm64
if [ -f "dist/mqtt-chat-macos-arm64" ]; then
    mv dist/mqtt-chat-macos-arm64 dist/mqtt-chat-macos-arm64.exe
fi

# macOS x64
if [ -f "dist/mqtt-chat-macos-x64" ]; then
    mv dist/mqtt-chat-macos-x64 dist/mqtt-chat-macos-x64.exe
fi

# Linux arm64
if [ -f "dist/mqtt-chat-linux-arm64" ]; then
    chmod +x dist/mqtt-chat-linux-arm64
fi

# Linux x64
if [ -f "dist/mqtt-chat-linux-x64" ]; then
    chmod +x dist/mqtt-chat-linux-x64
fi

# 显示结果
echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         打包完成！                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo -e "\n${BLUE}输出文件:${NC}"
ls -lh dist/ 2>/dev/null || echo "没有生成可执行文件"

echo -e "\n${CYAN}下一步:${NC}"
echo "1. 将 dist/ 目录下的文件上传到你的服务器"
echo "2. 修改 install.sh 中的 DOWNLOAD_BASE_URL 为实际地址"
echo "3. 将 install.sh 和二进制文件放到可访问的 URL"
echo ""
echo "示例部署结构:"
echo "  https://your-server.com/cli/"
echo "  ├── install.sh"
echo "  ├── mqtt-chat-macos-arm64"
echo "  ├── mqtt-chat-macos-x64"
echo "  ├── mqtt-chat-linux-arm64"
echo "  └── mqtt-chat-linux-x64"
