@echo off
chcp 65001 >nul
echo ========================================
echo 干洗系统服务启动器
echo ========================================
echo.

REM 切换到项目目录
cd /d "d:\Trae CN\bin\dry_cleaning_system"

REM 检查PM2是否安装
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] PM2 未安装，正在安装...
    npm install -g pm2
)

REM 启动PM2服务
echo [1/3] 检查PM2进程列表...
pm2 list

REM 如果没有运行的服务，则启动
pm2 list | findstr "dry-cleaning-backend" >nul
if %errorlevel% neq 0 (
    echo [2/3] 发现服务未运行，正在启动...
    echo.
    pm2 start ecosystem.config.js
) else (
    echo [2/3] 后端服务已在运行 ✓
)

REM 保存当前进程列表
echo [3/3] 保存PM2进程列表...
pm2 save

echo.
echo ========================================
echo 所有服务启动完成！
echo ========================================
echo.
echo 常用命令：
echo   pm2 list          - 查看服务状态
echo   pm2 logs          - 查看日志
echo   pm2 restart all   - 重启所有服务
echo.
pause
