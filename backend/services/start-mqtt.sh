#!/bin/bash

# ========================================
#   干洗系统 MQTT Broker 快速启动脚本
# ========================================

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================"
echo "  干洗系统 MQTT Broker 快速启动脚本"
echo "========================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Docker，请先安装 Docker${NC}"
    echo "下载地址: https://www.docker.com/products/docker-desktop/"
    exit 1
fi
echo -e "${GREEN}[✓] Docker 已安装${NC}"

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    echo -e "${RED}[错误] Docker 未运行，请启动 Docker${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Docker 已运行${NC}"

# 检查 EMQX 是否已存在
if docker ps -a --format "{{.Names}}" | grep -q "^emqx$"; then
    echo ""
    echo -e "${YELLOW}[提示] EMQX 容器已存在${NC}"
    docker start emqx > /dev/null 2>&1
    echo -e "${GREEN}[✓] EMQX 已启动${NC}"
else
    echo ""
    echo -e "${YELLOW}[提示] 正在创建并启动 EMQX 容器...${NC}"
    
    docker run -d \
        --name emqx \
        -p 1883:1883 \
        -p 8083:8083 \
        -p 8883:8883 \
        -p 8084:8084 \
        -p 18083:18083 \
        -e EMQX_LOADED_PLUGINS="emqx_management,emqx_dashboard" \
        -e EMQX_DASHBOARD__DEFAULT_USERNAME=admin \
        -e EMQX_DASHBOARD__DEFAULT_PASSWORD=public \
        emqx/emqx:latest > /dev/null 2>&1
        
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[✓] EMQX 创建并启动成功${NC}"
    else
        echo -e "${RED}[错误] EMQX 启动失败，请检查端口是否被占用${NC}"
        exit 1
    fi
fi

echo ""
echo "========================================"
echo "  MQTT Broker 启动完成！"
echo "========================================"
echo ""
echo -e "${GREEN}[服务地址]${NC}"
echo "  - MQTT 端口: mqtt://localhost:1883"
echo "  - WebSocket:  ws://localhost:8083/mqtt"
echo "  - 控制台:     http://localhost:18083"
echo ""
echo -e "${GREEN}[默认账号]${NC}"
echo "  - 用户名: admin"
echo "  - 密码:   public"
echo ""
echo -e "${YELLOW}[等待服务启动...]${NC}"
sleep 5

# 检查 EMQX 状态
if docker ps --format "{{.Status}}" | grep -q emqx; then
    echo -e "${GREEN}[✓] EMQX 运行中${NC}"
else
    echo -e "${RED}[错误] EMQX 未正常运行${NC}"
fi

echo ""
echo "========================================"
echo "  下一步操作："
echo "========================================"
echo ""
echo "1. 访问控制台: http://localhost:18083"
echo "2. 安装后端 MQTT 包:"
echo "   cd backend"
echo "   npm install mqtt"
echo "3. 重启后端服务"
echo "4. 访问后台管理系统，查看 MQTT 连接状态"
echo ""
echo "========================================"
