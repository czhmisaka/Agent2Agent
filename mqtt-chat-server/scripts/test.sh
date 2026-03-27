#!/bin/bash
# ===========================================
# MQTT Chat Server 测试脚本
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
SERVER_URL="http://localhost:14050"
MQTT_TCP_PORT=1883
MQTT_WS_PORT=8883
TEST_USER="testuser_$(date +%s)"
TEST_PASS="TestPass123"
TEST_GROUP="TestGroup_$(date +%s)"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 测试计数器
PASSED=0
FAILED=0

# 测试结果函数
test_pass() {
    ((PASSED++))
    log_success "✅ $1"
}

test_fail() {
    ((FAILED++))
    log_error "❌ $1"
}

# ===========================================
# 1. 健康检查测试
# ===========================================
test_health_check() {
    log_info "测试 1: 健康检查..."
    
    response=$(curl -s -w "\n%{http_code}" "$SERVER_URL/health")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response")
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q "ok"; then
        test_pass "健康检查通过 - HTTP $http_code"
        echo "响应: $body"
    else
        test_fail "健康检查失败 - HTTP $http_code"
    fi
}

# ===========================================
# 2. 用户注册测试
# ===========================================
test_user_registration() {
    log_info "测试 2: 用户注册..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/api/users/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response")
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q "success"; then
        test_pass "用户注册成功"
        echo "响应: $body"
    else
        test_fail "用户注册失败 - HTTP $http_code"
        echo "响应: $body"
    fi
}

# ===========================================
# 3. 用户登录测试
# ===========================================
test_user_login() {
    log_info "测试 3: 用户登录..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/api/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response")
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q "success"; then
        test_pass "用户登录成功"
        echo "响应: $body"
    else
        test_fail "用户登录失败 - HTTP $http_code"
        echo "响应: $body"
    fi
}

# ===========================================
# 4. 密码强度验证测试
# ===========================================
test_password_validation() {
    log_info "测试 4: 密码强度验证..."
    
    # 测试弱密码（太短）
    response=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/api/users/register" \
        -H "Content-Type: application/json" \
        -d '{"username":"weakuser","password":"weak"}')
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "400" ]; then
        test_pass "弱密码被正确拒绝"
    else
        test_fail "弱密码未被拒绝 - HTTP $http_code"
    fi
    
    # 测试强密码
    response=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/api/users/register" \
        -H "Content-Type: application/json" \
        -d '{"username":"stronguser","password":"StrongPass123"}')
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "400" ]; then
        test_pass "强密码验证功能正常"
    else
        test_fail "强密码验证失败 - HTTP $http_code"
    fi
}

# ===========================================
# 5. 创建群组测试
# ===========================================
test_create_group() {
    log_info "测试 5: 创建群组..."
    
    # 先登录获取 token
    login_response=$(curl -s -X POST "$SERVER_URL/api/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    
    TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/api/groups" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"name\":\"$TEST_GROUP\",\"description\":\"Test group description\"}")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response")
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q "success"; then
        test_pass "创建群组成功"
        echo "响应: $body"
    else
        test_fail "创建群组失败 - HTTP $http_code"
        echo "响应: $body"
    fi
}

# ===========================================
# 6. 获取群组列表测试
# ===========================================
test_get_groups() {
    log_info "测试 6: 获取群组列表..."
    
    # 先登录获取 token
    login_response=$(curl -s -X POST "$SERVER_URL/api/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    
    TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$SERVER_URL/api/groups" \
        -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ]; then
        test_pass "获取群组列表成功"
    else
        test_fail "获取群组列表失败 - HTTP $http_code"
    fi
}

# ===========================================
# 7. 获取用户列表测试
# ===========================================
test_get_users() {
    log_info "测试 7: 获取用户列表..."
    
    # 先登录获取 token
    login_response=$(curl -s -X POST "$SERVER_URL/api/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    
    TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$SERVER_URL/api/users" \
        -H "Authorization: Bearer $TOKEN")
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ]; then
        test_pass "获取用户列表成功"
    else
        test_fail "获取用户列表失败 - HTTP $http_code"
    fi
}

# ===========================================
# 8. JWT Token 验证测试
# ===========================================
test_jwt_validation() {
    log_info "测试 8: JWT Token 验证..."
    
    # 测试无效 token
    response=$(curl -s -w "\n%{http_code}" -X GET "$SERVER_URL/api/users/me" \
        -H "Authorization: Bearer invalid_token")
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "401" ]; then
        test_pass "无效 Token 被正确拒绝"
    else
        test_fail "无效 Token 未被拒绝 - HTTP $http_code"
    fi
}

# ===========================================
# 9. 端口检查测试
# ===========================================
test_ports() {
    log_info "测试 9: 端口检查..."
    
    # 检查 HTTP 端口
    if curl -s "$SERVER_URL/health" > /dev/null; then
        test_pass "HTTP 端口 3000 开放"
    else
        test_fail "HTTP 端口 3000 未响应"
    fi
    
    # 检查 MQTT TCP 端口
    if nc -z localhost $MQTT_TCP_PORT 2>/dev/null; then
        test_pass "MQTT TCP 端口 $MQTT_TCP_PORT 开放"
    else
        test_fail "MQTT TCP 端口 $MQTT_TCP_PORT 未开放"
    fi
    
    # 检查 MQTT WebSocket 端口
    if nc -z localhost $MQTT_WS_PORT 2>/dev/null; then
        test_pass "MQTT WebSocket 端口 $MQTT_WS_PORT 开放"
    else
        test_fail "MQTT WebSocket 端口 $MQTT_WS_PORT 未开放"
    fi
}

# ===========================================
# 主函数
# ===========================================
main() {
    echo "=========================================="
    echo "🚀 MQTT Chat Server 测试套件"
    echo "=========================================="
    echo ""
    
    # 检查服务器是否运行
    if ! curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
        log_error "服务器未运行！请先启动服务："
        echo "  npm run dev"
        echo "  或"
        echo "  npm start"
        exit 1
    fi
    
    log_info "服务器已启动，开始测试..."
    echo ""
    
    # 运行测试
    test_health_check
    echo ""
    
    test_user_registration
    echo ""
    
    test_user_login
    echo ""
    
    test_password_validation
    echo ""
    
    test_create_group
    echo ""
    
    test_get_groups
    echo ""
    
    test_get_users
    echo ""
    
    test_jwt_validation
    echo ""
    
    test_ports
    echo ""
    
    # 打印结果摘要
    echo "=========================================="
    echo "📊 测试结果摘要"
    echo "=========================================="
    echo -e "${GREEN}✅ 通过: $PASSED${NC}"
    echo -e "${RED}❌ 失败: $FAILED${NC}"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 所有测试通过！${NC}"
        exit 0
    else
        echo -e "${RED}⚠️  有 $FAILED 个测试失败${NC}"
        exit 1
    fi
}

# 运行主函数
main
