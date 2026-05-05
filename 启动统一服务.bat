@echo off
chcp 65001 >nul
title 干洗店管理系统 - 统一服务

echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║     干洗店管理系统 - 统一服务启动器                          ║
echo ║     所有服务合并到端口 3000                                 ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/4] 检查 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)
echo     ✅ Node.js 已安装

echo.
echo [2/4] 检查后端依赖...
cd backend
if not exist "node_modules" (
    echo     📦 正在安装后端依赖...
    call npm install
) else (
    echo     ✅ 后端依赖已安装
)

echo.
echo [3/4] 返回项目目录...
cd /d "%~dp0"

echo.
echo [4/4] 启动后端服务（端口 3000）...
echo     📝 所有服务将合并运行：
echo        - 后端API (订单、门店、商品)
echo        - 支付系统 (微信、支付宝、银联)
echo        - POS收银系统
echo        - 会员卡系统
echo.

echo ╔════════════════════════════════════════════════════════════╗
echo ║  🚀 服务地址: http://localhost:3000                         ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║  📱 管理员端: http://localhost:3000/admin.html              ║
echo ║  🏪 M端POS:    http://localhost:3000/m-index.html           ║
echo ║  👤 C端用户:   http://localhost:3000/c-index.html           ║
echo ║                                                            ║
echo ║  💳 支付页面:  http://localhost:3000/c-payment.html          ║
echo ║  🎫 会员充值:  http://localhost:3000/c-recharge.html        ║
echo ║                                                            ║
echo ║  ⚠️  按 Ctrl+C 停止服务                                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd backend
node server.js

pause
