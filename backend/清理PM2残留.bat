@echo off
chcp 65001 >nul
echo ========================================
echo    PM2 进程清理工具
echo ========================================
echo.

cd /d "%~dp0"

echo 检查 PM2 状态...
call npm list pm2 -g >nul 2>&1
if %errorlevel% neq 0 (
    echo PM2 未安装，无需清理
    pause
    exit /b 0
)

echo 正在清理 PM2 进程...
call npx pm2 delete all >nul 2>&1
call npx pm2 kill >nul 2>&1

echo.
echo [1/3] 检查端口 3000 占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo 终止进程: %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo [2/3] 检查 PM2 残留 node 进程...
tasklist /FI "IMAGENAME eq node.exe" /FO CSV | findstr /i "node" >nul
if %errorlevel% equ 0 (
    echo 发现 Node.js 进程，可能需要手动确认
    tasklist /FI "IMAGENAME eq node.exe"
    echo.
    echo 如需强制终止所有 node 进程，请输入 Y
    set /p confirm="是否终止所有 Node.js 进程? (Y/N): "
    if /i "%confirm%"=="Y" (
        taskkill /IM node.exe /F >nul 2>&1
        echo 已终止所有 Node.js 进程
    )
)

echo [3/3] 验证端口...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [OK] 端口 3000 已释放
) else (
    echo [警告] 端口 3000 仍被占用，请手动检查
)

echo.
echo 清理完成！
pause
