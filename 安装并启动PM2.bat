@echo off
chcp 65001 >nul
echo ========================================
echo   PM2 安装和启动脚本
echo ========================================
echo.

REM 切换到项目目录
cd /d "%~dp0"

REM 检查PM2是否已安装
echo [1/6] 检查PM2安装状态...
pm2 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ PM2 已安装
    goto :start_service
) else (
    echo ❌ PM2 未安装
)

REM 安装PM2
echo.
echo [2/6] 正在安装PM2（请耐心等待）...
echo ⚠️  如果安装时间过长，可以手动运行: npm install -g pm2
echo.
npm install -g pm2

if %errorlevel% neq 0 (
    echo.
    echo ❌ PM2 安装失败
    echo.
    echo 请尝试以下方法：
    echo 1. 以管理员身份运行此脚本
    echo 2. 检查网络连接
    echo 3. 使用代理: npm install -g pm2 --registry https://registry.npmmirror.com
    echo.
    pause
    exit /b 1
)

echo ✅ PM2 安装完成

:start_service
REM 创建logs目录
echo.
echo [3/6] 创建日志目录...
if not exist "logs" mkdir logs
if not exist "backend\logs" mkdir backend\logs
echo ✅ 日志目录已创建

REM 停止已存在的PM2进程
echo.
echo [4/6] 清理旧的PM2进程...
pm2 delete all >nul 2>&1
echo ✅ 已清理旧进程

REM 启动服务
echo.
echo [5/6] 启动后端服务和MQTT Broker...
echo.
pm2 start ecosystem.config.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ 服务启动失败
    echo.
    echo 请检查 ecosystem.config.js 文件是否存在
    echo.
    pause
    exit /b 1
)

REM 保存PM2进程列表
echo.
echo [6/6] 保存PM2进程列表...
pm2 save

echo.
echo ========================================
echo   ✅ 服务启动成功！
echo ========================================
echo.
echo 📋 PM2 管理的服务:
echo    1. dry-cleaning-backend  - 主后端服务 (端口 3000)
echo    2. mqtt-broker          - MQTT消息服务 (端口 1884)
echo.
echo 📋 常用命令:
echo    pm2 list               - 查看服务状态
echo    pm2 logs               - 查看所有日志
echo    pm2 logs dry-cleaning-backend  - 查看后端日志
echo    pm2 logs mqtt-broker           - 查看MQTT日志
echo    pm2 monit              - 监控面板
echo.
echo 🌐 访问地址:
echo    后端API:  http://localhost:3000
echo    MQTT:     mqtt://localhost:1884
echo.
echo 💡 提示: 
echo    - 运行 "pm2 startup" 设置开机自启动
echo    - 使用 "pm2 restart all" 重启所有服务
echo.
pause
