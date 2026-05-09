@echo off
chcp 65001 >nul
REM ========================================
REM   PM2 开机自启动脚本 v2
REM ========================================

cd /d "d:\Trae CN\bin\dry_cleaning_system"

echo [INFO] PM2开机自启动启动中...
echo [INFO] 工作目录: %cd%

REM 检查PM2
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PM2 未安装！
    exit /b 1
)

REM 恢复PM2进程
pm2 resurrect

REM 等待服务启动
timeout /t 5 /nobreak >nul

REM 验证
pm2 list
