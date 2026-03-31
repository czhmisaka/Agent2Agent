#!/bin/bash
# ===========================================
# MQTT Chat 一键部署脚本
# 支持 AI Agent (OpenClaw) 自动执行
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==========================================
# 检查必要命令
# ==========================================
check_commands() {
    log_info "检查必要命令..."
    
    local missing=()
    
    for cmd in node npm curl; do
        if ! command -v $cmd &> /dev/null; then
            missing+=($cmd)
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "缺少必要命令: ${missing[*]}"
        log_error "请先安装 Node.js 20.x 和 curl"
        exit 1
    fi
    
    log_ok "必要命令检查通过"
}

# ==========================================
# 检查 Node.js 版本
# ==========================================
check_nodejs() {
    log_info "检查 Node.js..."
    
    # 加载 nvm
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        source "$HOME/.nvm/nvm.sh"
    fi
    
    # 尝试使用 Node 20
    if command -v nvm &> /dev/null; then
        nvm use 20 > /dev/null 2>&1 || true
    fi
    
    local version=$(node --version)
    log_ok "Node.js: $version"
}

# ==========================================
# 部署服务器
# ==========================================
deploy_server() {
    log_info "部署 MQTT Chat Server..."
    
    local server_dir="$SCRIPT_DIR/mqtt-chat-server"
    cd "$server_dir"
    
    # 1. 安装依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装服务器依赖..."
        npm install
    else
        log_warn "服务器依赖已安装，跳过"
    fi
    
    # 2. 编译
    log_info "编译 TypeScript..."
    npm run build 2>/dev/null || tsc
    
    # 3. 检查端口占用
    local ports=(14070 14080 14083)
    for port in "${ports[@]}"; do
        if lsof -i:$port &>/dev/null; then
            log_warn "端口 $port 已被占用，尝试关闭..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    # 4. 启动服务器
    log_info "启动服务器..."
    node dist/index.js &
    SERVER_PID=$!
    
    # 5. 等待服务就绪
    log_info "等待服务就绪..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:14070/health > /dev/null 2>&1; then
            log_ok "服务器启动成功!"
            return 0
        fi
        sleep 1
        ((retries--))
    done
    
    log_error "服务器启动超时"
    return 1
}

# ==========================================
# 部署客户端
# ==========================================
deploy_client() {
    log_info "部署 MQTT Chat Client..."
    
    local client_dir="$SCRIPT_DIR/mqtt-chat-client"
    cd "$client_dir"
    
    # 1. 安装依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装客户端依赖..."
        npm install
    else
        log_warn "客户端依赖已安装，跳过"
    fi
    
    # 2. 编译
    log_info "编译 TypeScript..."
    npm run build 2>/dev/null || tsc
    
    log_ok "客户端编译完成"
}

# ==========================================
# 验证部署
# ==========================================
verify() {
    log_info "验证部署..."
    
    # 检查服务器
    if curl -s http://localhost:14070/health > /dev/null 2>&1; then
        log_ok "HTTP API: http://localhost:14070"
        log_ok "MQTT TCP: localhost:14080"
        log_ok "MQTT WS:  localhost:14083"
    else
        log_warn "服务器健康检查失败"
    fi
    
    log_ok "客户端已就绪，可运行: cd mqtt-chat-client && ./start.sh"
}

# ==========================================
# 主流程
# ==========================================
main() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║   🚀 MQTT Chat 一键部署                            ║"
    echo "║   适用于 AI Agent (OpenClaw) 自动执行               ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # 0. 加载 nvm
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        source "$HOME/.nvm/nvm.sh"
    fi
    
    # 1. 检查环境
    check_commands
    check_nodejs
    
    # 2. 部署服务器
    deploy_server
    
    # 3. 部署客户端
    deploy_client
    
    # 4. 验证
    verify
    
    echo -e "\n${GREEN}✅ 部署完成!${NC}"
    echo ""
    echo "使用方法:"
    echo "  1. 启动客户端: cd mqtt-chat-client && ./start.sh"
    echo "  2. 或直接运行: cd mqtt-chat-client && node dist/index.js"
    echo ""
    echo "测试账号:"
    echo "  用户名: czhmisaka"
    echo "  密码:   Czh12345"
    echo "  群组:   test (36a11e6a-28c1-4a40-b4b9-823ce16d8994)"
    echo ""
}

# 运行
main "$@"
