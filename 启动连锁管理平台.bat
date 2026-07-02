@echo off
echo ========================================
echo 连锁企业管理平台启动脚本
echo ========================================
echo.

REM 检查Node.js是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    pause
    exit /b 1
)

REM 检查后端目录
if not exist "backend\server.js" (
    echo [错误] 找不到后端文件：backend\server.js
    pause
    exit /b 1
)

echo [信息] 启动连锁企业管理平台...
echo.

echo 1. 启动后端服务器...
start cmd /k "cd /d backend && node server.js"
echo [成功] 后端服务器已启动在 http://localhost:3000
echo.

echo 2. 打开测试页面...
start "" "test-chain-admin.html"
echo [成功] 测试页面已打开
echo.

echo 3. 打开管理平台...
start "" "chain-admin.html"
echo [成功] 管理平台已打开
echo.

echo ========================================
echo 使用说明：
echo 1. 后端服务器运行在 http://localhost:3000
echo 2. 测试页面用于验证API接口
echo 3. 管理平台是完整的连锁企业管理界面
echo.
echo 测试账号：admin / admin123
echo ========================================
echo.

echo 按任意键打开使用文档...
pause >nul
start "" "CHAIN_ADMIN_PLATFORM.md"

echo.
echo [完成] 连锁企业管理平台已启动完毕！
pause