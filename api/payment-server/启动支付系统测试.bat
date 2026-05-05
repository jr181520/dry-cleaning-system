@echo off
chcp 65001 >nul
title 支付系统测试工具

echo ========================================
echo    干洗店支付系统 - 一键启动测试
echo ========================================
echo.

echo [1/4] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未安装 Node.js
    echo 请先安装 Node.js：https://nodejs.org/
    pause
    exit
)
echo ✅ Node.js 已安装

echo.
echo [2/4] 启动支付服务器...
cd /d "%~dp0"
start "支付服务器" cmd /k "node server.js"

echo.
echo [3/4] 等待服务器启动...
timeout /t 3 /nobreak >nul

echo.
echo [4/4] 打开测试页面...
start http://localhost:3002/m-pos.html
start http://localhost:3002/c-payment.html
start http://localhost:3002/c-recharge.html

echo.
echo ========================================
echo ✅ 启动完成！
echo ========================================
echo.
echo 已打开以下页面：
echo   📱 M端POS收银: http://localhost:3002/m-pos.html
echo   💵 C端支付页面: http://localhost:3002/c-payment.html
echo   💰 C端充值页面: http://localhost:3002/c-recharge.html
echo.
echo 支付服务器运行在端口 3002
echo 请保持此窗口打开！
echo.
echo ========================================
echo.
echo 测试步骤：
echo 1. 先在 M端POS收银 添加商品，创建订单
echo 2. 选择支付方式完成支付
echo 3. 使用 C端充值页面 为会员卡充值
echo.
pause
