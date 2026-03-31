#!/bin/bash
# ===========================================
# MQTT Chat Server 启动脚本
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
echo "║   🚀 MQTT Chat Server 启动脚本       ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ==========================================
# 端口和进程清理函数
# ==========================================
cleanup_ports() {
    echo -e "\n${YELLOW}⚠️  正在检查并关闭已占用的端口...${NC}"
    
    # 需要检查的端口
    local PORTS=(14070 14080 14083)
    local PORTS_DESC=("HTTP API" "MQTT TCP" "MQTT WebSocket")
    
    for i in "${!PORTS[@]}"; do
        local PORT="${PORTS[$i]}"
        local DESC="${PORTS_DESC[$i]}"
        
        # 查找占用端口的进程
        if command -v lsof &> /dev/null; then
            local PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
        elif command -v netstat &> /dev/null; then
            local PIDS=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 || true)
        else
            local PIDS=""
        fi
        
        if [ -n "$PIDS" ]; then
            echo -e "   ${YELLOW}发现端口 $PORT ($DESC) 被占用${NC}"
            for PID in $PIDS; do
                if [ -n "$PID" ] && [ "$PID" != "PID" ]; then
                    # 获取进程名称
                    local PROC_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
                    echo -e "   ${YELLOW}正在关闭进程: $PID ($PROC_NAME)${NC}"
                    kill -15 $PID 2>/dev/null || true
                    sleep 1
                    # 如果还在运行，强制杀死
                    if ps -p $PID &>/dev/null; then
                        kill -9 $PID 2>/dev/null || true
                    fi
                fi
            done
            echo -e "   ${GREEN}✅ 端口 $PORT 已释放${NC}"
        else
            echo -e "   ${GREEN}✓ 端口 $PORT ($DESC) 空闲${NC}"
        fi
    done
    
    # 检查 node 进程（服务可能没直接监听端口）
    echo -e "\n${YELLOW}检查 node 服务进程...${NC}"
    local NODE_PIDS=$(pgrep -f "mqtt-chat-server" 2>/dev/null || true)
    if [ -n "$NODE_PIDS" ]; then
        echo -e "   ${YELLOW}发现 mqtt-chat-server 进程${NC}"
        for PID in $NODE_PIDS; do
            echo -e "   ${YELLOW}正在关闭进程: $PID${NC}"
            kill -15 $PID 2>/dev/null || true
            sleep 1
            if ps -p $PID &>/dev/null; then
                kill -9 $PID 2>/dev/null || true
            fi
        done
        echo -e "   ${GREEN}✅ node 进程已关闭${NC}"
    else
        echo -e "   ${GREEN}✓ 无运行的 node 服务进程${NC}"
    fi
    
    # 等待端口完全释放
    echo -e "\n${YELLOW}等待端口释放...${NC}"
    sleep 2
}

# 检查是否有服务正在运行
check_running() {
    local PORTS=(14070 14080 14083)
    for PORT in "${PORTS[@]}"; do
        if lsof -i:$PORT &>/dev/null; then
            return 0
        fi
    done
    return 1
}

# 检查启动方式参数
DEPLOY_MODE=${1:-""}

# 启动前检查
if check_running; then
    echo -e "\n${YELLOW}⚠️  检测到有服务正在运行${NC}"
    read -p "是否关闭已运行的服务后启动？[Y/n]: " confirm
    case $confirm in
        n|N) 
            echo -e "${YELLOW}已取消启动${NC}"
            exit 0
            ;;
        *)
            cleanup_ports
            ;;
    esac
fi

# 如果没有参数，交互式选择
if [ -z "$DEPLOY_MODE" ]; then
    echo -e "\n请选择启动方式："
    echo -e "  ${GREEN}1)${NC} 本地服务（Node.js 直接运行）"
    echo -e "  ${GREEN}2)${NC} Docker 容器"
    echo -e "  ${GREEN}q)${NC} 退出"
    echo ""
    read -p "请输入选项 [1/2/q]: " choice
    
    case $choice in
        1) DEPLOY_MODE="local" ;;
        2) DEPLOY_MODE="docker" ;;
        q|Q) 
            echo -e "${YELLOW}已退出${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}无效选项，使用默认选项（本地服务）${NC}"
            DEPLOY_MODE="local"
            ;;
    esac
fi

# ==========================================
# Docker 启动模式
# ==========================================
if [ "$DEPLOY_MODE" = "docker" ]; then
    echo -e "\n${BLUE}🚀 Docker 启动模式${NC}"
    
    # 检查 Docker
    echo -e "\n${BLUE}[1/4]${NC} 检查 Docker..."
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker 未安装！${NC}"
        echo "请先安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker 已安装${NC}"
    
    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose 未安装！${NC}"
        echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker Compose 已安装${NC}"
    
    # 确定 Docker Compose 命令
    if command -v docker-compose &> /dev/null; then
        DC_CMD="docker-compose"
    else
        DC_CMD="docker compose"
    fi
    
    # 检查环境变量文件
    echo -e "\n${BLUE}[2/4]${NC} 检查环境变量..."
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
            echo -e "${YELLOW}⚠️  请根据需要修改 .env 文件中的配置${NC}"
        fi
    else
        echo -e "${GREEN}✅ .env 文件已存在${NC}"
    fi
    
    # 构建并启动
    echo -e "\n${BLUE}[3/4]${NC} 构建 Docker 镜像..."
    $DC_CMD build --no-cache
    
    echo -e "\n${BLUE}[4/4]${NC} 启动 Docker 容器..."
    $DC_CMD up -d
    
    # 等待服务就绪
    echo -e "\n${YELLOW}等待服务启动...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:14070/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ 服务已就绪！${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Docker 容器启动成功！${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "\n📡 服务端口:"
    echo "   • HTTP API:  http://localhost:14070"
    echo "   • MQTT TCP:  localhost:14080"
    echo "   • MQTT WS:   localhost:14083"
    
    echo -e "\n🔧 常用命令:"
    echo "   • 查看日志:   $DC_CMD logs -f"
    echo "   • 停止服务:   $DC_CMD down"
    echo "   • 重启服务:   $DC_CMD restart"
    
    echo -e "\n${YELLOW}服务已在后台运行...${NC}"
    echo -e "按 Ctrl+C 退出此脚本（服务将继续运行）"
    
    # 保持脚本运行
    tail -f /dev/null
    
# ==========================================
# 本地启动模式
# ==========================================
else
    echo -e "\n${BLUE}🚀 本地启动模式${NC}"
    
    # 1. 检查 Node.js 环境
    echo -e "\n${BLUE}[1/5]${NC} 检查 Node.js 环境..."
    
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
    echo -e "\n${BLUE}[2/5]${NC} 安装依赖..."
    if [ ! -d "node_modules" ]; then
        npm install
        echo -e "${GREEN}✅ 依赖安装完成${NC}"
    else
        echo -e "${YELLOW}⚠️  node_modules 已存在，跳过安装${NC}"
    fi
    
    # 3. 重新编译原生模块（如 better-sqlite3）
    echo -e "\n${BLUE}[3/5]${NC} 重新编译原生模块..."
    npm rebuild
    echo -e "${GREEN}✅ 原生模块编译完成${NC}"
    
    # 4. 检查环境变量文件
    echo -e "\n${BLUE}[4/5]${NC} 检查环境变量..."
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
            echo -e "${YELLOW}⚠️  请根据需要修改 .env 文件中的配置${NC}"
        else
            echo -e "${YELLOW}⚠️  未找到 .env.example 文件${NC}"
        fi
    else
        echo -e "${GREEN}✅ .env 文件已存在${NC}"
    fi
    
    # 5. 启动服务
    echo -e "\n${BLUE}[5/5]${NC} 启动服务..."
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ 服务启动成功！${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "\n📡 服务端口:"
    echo "   • HTTP API:  http://localhost:14070"
    echo "   • MQTT TCP:  localhost:14080"
    echo "   • MQTT WS:   localhost:14083"
    echo "   • Admin UI:  http://localhost:14070/admin"
    echo "   • Client UI: http://localhost:14070/client"
    
    echo -e "\n🔧 常用命令:"
    echo "   • 运行测试:   npm test"
    echo "   • 停止服务:   Ctrl+C"
    
    echo -e "\n${YELLOW}正在启动服务...${NC}\n"
    
    # 使用 npm start（运行编译好的文件）
    npm start
fi
