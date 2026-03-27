#!/bin/bash
# ===========================================
# MQTT Chat Server 一键部署脚本
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
echo "║   🚀 MQTT Chat Server 一键部署工具      ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# 检查环境
echo -e "\n${BLUE}[1/6]${NC} 检查运行环境..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装！${NC}"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✅ Docker 已安装${NC}"

# 检查 Docker Compose (支持 V1 和 V2)
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
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

# 检查 curl
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl 未安装！${NC}"
    exit 1
fi
echo -e "${GREEN}✅ curl 已安装${NC}"

# 2. 准备环境变量
echo -e "\n${BLUE}[2/6]${NC} 准备环境变量..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
        echo -e "${YELLOW}⚠️  请根据需要修改 .env 文件中的配置${NC}"
    fi
else
    echo -e "${GREEN}✅ .env 文件已存在${NC}"
fi

# 3. 停止旧服务
echo -e "\n${BLUE}[3/6]${NC} 停止旧服务..."
$DC_CMD down 2>/dev/null || true
echo -e "${GREEN}✅ 旧服务已停止${NC}"

# 4. 构建镜像
echo -e "\n${BLUE}[4/6]${NC} 构建 Docker 镜像..."
$DC_CMD build --no-cache

# 5. 启动服务
echo -e "\n${BLUE}[5/6]${NC} 启动服务..."
$DC_CMD up -d

# 6. 等待服务启动
echo -e "\n${BLUE}[6/6]${NC} 等待服务就绪..."
echo -n "检查服务状态"
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "\n${GREEN}✅ 服务已就绪！${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# 检查最终状态
echo ""
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════╗"
    echo "║   🎉 部署成功！服务已启动              ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "\n📡 服务端口:"
    echo "   • HTTP API:  http://localhost:3000"
    echo "   • MQTT TCP:  localhost:1883"
    echo "   • MQTT WS:   localhost:8883"
    
    echo -e "\n🔧 常用命令:"
    echo "   • 查看日志:   docker-compose logs -f"
    echo "   • 停止服务:   docker-compose down"
    echo "   • 重启服务:   docker-compose restart"
    echo "   • 运行测试:   ./scripts/test.sh"
    
    echo -e "\n🌐 健康检查:"
    curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
    
    echo ""
else
    echo -e "${RED}❌ 服务启动失败！${NC}"
    echo -e "\n查看日志诊断问题："
    echo "docker-compose logs"
    exit 1
fi
