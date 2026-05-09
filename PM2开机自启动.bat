@echo off
chcp 65001 >nul
echo ========================================
echo   PM2 开机自启动配置
echo ========================================
echo.

REM 切换到项目目录
cd /d "%~dp0"

REM 检查PM2是否已安装
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] PM2 未安装！
    echo 请先运行: npm install -g pm2
    pause
    exit /b 1
)

echo [1/2] 正在恢复 PM2 进程列表...
pm2 resurrect

if %errorlevel% neq 0 (
    echo [错误] PM2 恢复失败！
    pause
    exit /b 1
)

echo.
echo [2/2] 验证服务状态...
timeout /t 3 /nobreak >nul

pm2 list

echo.
echo ========================================
echo   ✅ PM2 开机自启动配置完成！
echo ========================================
echo.
echo 📋 当前运行的服务:
echo    - dry-cleaning-backend (后端服务)
echo    - mqtt-broker (MQTT消息服务)
echo.
echo 💡 提示:
echo    - 服务将在开机时自动启动
echo    - 如需手动重启，请运行: pm2 resurrect
echo    - 查看日志: pm2 logs
echo.
pause
