@echo off
chcp 65001 >nul
echo ========================================
echo   干洗系统 - PM2服务管理
echo ========================================
echo.

cd /d "%~dp0"

REM 检查是否安装了PM2
echo [1/3] 检查PM2安装状态...
npm list -g pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PM2 未安装，正在安装...
    npm install -g pm2
    echo ✅ PM2 安装完成
) else (
    echo ✅ PM2 已安装
)

REM 创建logs目录
if not exist "logs" mkdir logs
echo ✅ 日志目录已创建

REM 根据参数执行不同操作
if "%1"=="" (
    echo.
    echo [2/3] 启动后端服务...
    echo.
    pm2 start ecosystem.config.js
    echo.
    echo ✅ 服务已启动！
) else if "%1"=="start" (
    echo.
    echo [2/3] 启动后端服务...
    echo.
    pm2 start ecosystem.config.js
    echo.
    echo ✅ 服务已启动！
) else if "%1"=="stop" (
    echo.
    echo [2/3] 停止后端服务...
    echo.
    pm2 stop dry-cleaning-backend
    echo.
    echo ✅ 服务已停止！
) else if "%1"=="restart" (
    echo.
    echo [2/3] 重启后端服务...
    echo.
    pm2 restart dry-cleaning-backend
    echo.
    echo ✅ 服务已重启！
) else if "%1"=="logs" (
    echo.
    echo [2/3] 查看服务日志（按 Ctrl+C 退出）...
    echo.
    pm2 logs dry-cleaning-backend --lines 100
) else if "%1"=="status" (
    echo.
    echo [2/3] 查看服务状态...
    echo.
    pm2 list
) else if "%1"=="autostart" (
    echo.
    echo [2/3] 设置开机自启动...
    echo.
    pm2 startup
    pm2 save
    echo.
    echo ✅ 开机自启动已设置！
) else if "%1"=="delete" (
    echo.
    echo [2/3] 删除服务...
    echo.
    pm2 delete dry-cleaning-backend
    echo.
    echo ✅ 服务已删除！
) else (
    echo.
    echo ❌ 未知命令: %1
    echo.
    echo 用法:
    echo   启动服务:   启动PM2服务.bat start
    echo   停止服务:   启动PM2服务.bat stop
    echo   重启服务:   启动PM2服务.bat restart
    echo   查看日志:   启动PM2服务.bat logs
    echo   服务状态:   启动PM2服务.bat status
    echo   开机自启:   启动PM2服务.bat autostart
    echo   删除服务:   启动PM2服务.bat delete
    echo.
)

echo [3/3] 完成
echo.
pause
