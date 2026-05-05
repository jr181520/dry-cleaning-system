#!/bin/bash

# 干洗系统后端安装脚本
# 用于 Windows: 使用 Git Bash 或 WSL 运行
# 或直接在 PowerShell 中运行

echo "=========================================="
echo "  干洗系统后端 - 自动安装脚本"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    echo "   请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"
echo ""

# 进入 backend 目录
cd "$(dirname "$0")/.." || exit

# 安装依赖
echo "📦 正在安装依赖..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ 依赖安装成功"
else
    echo "❌ 依赖安装失败"
    exit 1
fi

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "📝 下一步:"
echo "   1. 配置数据库（编辑 .env 文件）"
echo "   2. 启动数据库服务"
echo "   3. 初始化数据库: npm run db:init"
echo "   4. 创建测试数据: npm run db:seed"
echo "   5. 启动服务: npm start"
echo ""
echo "💡 查看完整指南: QUICKSTART.md"
echo ""
