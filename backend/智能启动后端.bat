@echo off
chcp 65001 >nul
echo ========================================
echo    干洗系统后端服务 - 智能启动
echo ========================================
echo.

:: 检查并清理占用端口的进程
echo [1/4] 检查端口占用情况...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo 发现残留进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    echo   已终止 PID: %%a
)

echo [2/4] 等待端口释放...
timeout /t 2 /nobreak >nul

:: 验证端口已释放
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [错误] 端口 3000 仍被占用，请手动检查
    pause
    exit /b 1
)
echo [OK] 端口 3000 已释放

:: 检查 PM2 残留进程
echo [3/4] 检查 PM2 残留进程...
cd /d "%~dp0"
call npm list pm2 -g >nul 2>&1
if %errorlevel% equ 0 (
    echo 清理 PM2 进程列表...
    call npx pm2 delete all >nul 2>&1
    call npx pm2 kill >nul 2>&1
)
echo [4/4] 启动后端服务...

:: 启动 nodemon
echo.
echo ----------------------------------------
echo  服务启动中，请勿关闭此窗口...
echo ----------------------------------------
echo.
npm run dev

:: 如果 nodemon 退出，显示按任意键退出
pause
