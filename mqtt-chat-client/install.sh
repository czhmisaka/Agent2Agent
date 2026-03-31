#!/bin/bash
# ===========================================
# MQTT Chat Client 一键安装脚本
# 
# 使用方式:
#   curl -fsSL https://your-server.com/install.sh | bash
#   或
#   bash <(curl -fsSL https://your-server.com/install.sh)
#
# ===========================================

set -e

# ============ 配置区 ============
# 修改为你的实际下载链接前缀
DOWNLOAD_BASE_URL="${DOWNLOAD_BASE_URL:-https://your-server.com/cli}"

# ============ 颜色定义 ============
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============ 欢迎信息 ============
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     📡 MQTT Chat Client 一键安装脚本                        ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============ 检测系统 ============
echo -e "\n${BLUE}[1/5]${NC} 检测操作系统..."

detect_os() {
    local os_name=""
    local os_type=$(uname -s)
    local machine=$(uname -m)
    
    case "$os_type" in
        Linux*)
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                os_name="linux-${ID:-unknown}"
            else
                os_name="linux"
            fi
            ;;
        Darwin*)
            os_name="macos"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            os_name="windows"
            ;;
        *)
            os_name="unknown"
            ;;
    esac
    
    # 检测 CPU 架构
    case "$machine" in
        arm64|aarch64)
            arch="arm64"
            ;;
        x86_64|x64|amd64)
            arch="x64"
            ;;
        *)
            arch="x64"
            ;;
    esac
    
    echo "${os_name}-${arch}"
}

get_binary_name() {
    local platform=$1
    
    case "$platform" in
        macos-arm64)
            echo "mqtt-chat-macos-arm64"
            ;;
        macos-x64)
            echo "mqtt-chat-macos-x64"
            ;;
        linux-arm64)
            echo "mqtt-chat-linux-arm64"
            ;;
        linux-x64)
            echo "mqtt-chat-linux-x64"
            ;;
        windows-x64)
            echo "mqtt-chat-win-x64.exe"
            ;;
        *)
            echo ""
            ;;
    esac
}

get_download_url() {
    local binary_name=$1
    echo "${DOWNLOAD_BASE_URL}/${binary_name}"
}

# 检测平台
PLATFORM=$(detect_os)
BINARY_NAME=$(get_binary_name "$PLATFORM")

echo -e "  ${CYAN}系统: ${PLATFORM}${NC}"

if [ -z "$BINARY_NAME" ]; then
    echo -e "\n${RED}❌ 错误: 不支持的操作系统或架构${NC}"
    echo "  支持的平台:"
    echo "    - macOS (Apple Silicon, Intel)"
    echo "    - Linux (x64, arm64)"
    echo "    - Windows (x64)"
    exit 1
fi

echo -e "${GREEN}✅ 检测到平台: ${BINARY_NAME}${NC}"

# ============ 检测现有安装 ============
echo -e "\n${BLUE}[2/5]${NC} 检查现有安装..."

INSTALL_DIR="${HOME}/.mqtt-chat"
BIN_DIR="${HOME}/.local/bin"
EXECUTABLE="${BIN_DIR}/mqtt-chat"

# 检查是否已安装
if [ -f "$EXECUTABLE" ]; then
    CURRENT_VERSION=$("$EXECUTABLE" --version 2>/dev/null || echo "未知")
    echo -e "  ${YELLOW}⚠️  已安装版本: ${CURRENT_VERSION}${NC}"
    read -p "  是否重新安装？[y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}取消安装${NC}"
        exit 0
    fi
fi

# ============ 创建目录 ============
echo -e "\n${BLUE}[3/5]${NC} 准备安装目录..."

mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

echo -e "  ${GREEN}✅ 安装目录: ${INSTALL_DIR}${NC}"
echo -e "  ${GREEN}✅ 二进制目录: ${BIN_DIR}${NC}"

# ============ 下载文件 ============
echo -e "\n${BLUE}[4/5]${NC} 下载客户端..."

DOWNLOAD_URL=$(get_download_url "$BINARY_NAME")
TEMP_FILE="${INSTALL_DIR}/${BINARY_NAME}"

echo -e "  ${CYAN}下载地址: ${DOWNLOAD_URL}${NC}"

# 显示进度
echo -ne "  ${CYAN}下载中... 0%${NC}"
curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$TEMP_FILE" &
CURL_PID=$!
sleep 1

# 简单进度条
while kill -0 $CURL_PID 2>/dev/null; do
    echo -ne "\r  ${CYAN}下载中... ████████████████ 100%${NC}"
    sleep 1
done

wait $CURL_PID
echo -e "\r  ${GREEN}✅ 下载完成${NC}"

# ============ 安装 ============
echo -e "\n${BLUE}[5/5]${NC} 安装程序..."

# 添加执行权限
chmod +x "$TEMP_FILE"

# 移动到 bin 目录
cp "$TEMP_FILE" "$EXECUTABLE"

# 清理临时文件
rm -f "$TEMP_FILE"

echo -e "  ${GREEN}✅ 安装完成: ${EXECUTABLE}${NC}"

# ============ 清理旧版本 ============
echo -e "\n${BLUE}清理...${NC}"

# 清理可能的旧版本
if [ -f "${INSTALL_DIR}/mqtt-chat" ] && [ "${INSTALL_DIR}/mqtt-chat" != "$EXECUTABLE" ]; then
    rm -f "${INSTALL_DIR}/mqtt-chat"
fi

# ============ 添加到 PATH ============
echo -e "\n${BLUE}配置 PATH...${NC}"

# 检测 shell 配置
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
fi

# 检查是否已添加到 PATH
PATH_LINE="export PATH=\"\$HOME/.local/bin:\$PATH\""

if [ -n "$SHELL_CONFIG" ]; then
    if ! grep -q "\.local/bin" "$SHELL_CONFIG" 2>/dev/null; then
        echo "" >> "$SHELL_CONFIG"
        echo "# MQTT Chat Client" >> "$SHELL_CONFIG"
        echo "$PATH_LINE" >> "$SHELL_CONFIG"
        echo -e "  ${GREEN}✅ 已添加 PATH 到 ${SHELL_CONFIG}${NC}"
    else
        echo -e "  ${YELLOW}⚠️  PATH 已配置${NC}"
    fi
fi

# 立即添加到当前 session 的 PATH
export PATH="$HOME/.local/bin:$PATH"

# ============ 验证安装 ============
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 安装成功！${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 验证
if "$EXECUTABLE" --help > /dev/null 2>&1 || "$EXECUTABLE" -h > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 验证通过${NC}"
else
    echo -e "${YELLOW}⚠️  验证跳过（CLI 可能不支持 --help）${NC}"
fi

echo -e "\n${BOLD}使用方式:${NC}"
echo "  ${CYAN}mqtt-chat <username> <password> [groupId] [message]${NC}"
echo ""
echo "  或进入交互模式:"
echo "  ${CYAN}mqtt-chat${NC}"
echo ""
echo -e "${BOLD}示例:${NC}"
echo "  ${CYAN}mqtt-chat alice password123${NC}"
echo "  ${CYAN}mqtt-chat alice password123 general 'Hello everyone!'${NC}"
echo ""

# 提示用户需要重新加载 shell
if [ -n "$SHELL_CONFIG" ]; then
    echo -e "${YELLOW}提示: 如果 'mqtt-chat' 命令不可用，请运行:${NC}"
    echo "  ${CYAN}source ${SHELL_CONFIG}${NC}"
    echo "  或重新打开终端"
fi

echo ""
