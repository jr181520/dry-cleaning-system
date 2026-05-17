@echo off
:: EMQX 开机启动任务创建器 v2
:: 创建系统级开机启动计划任务

echo ==========================================
echo   EMQX 开机启动任务创建器 v2
echo   (生产环境级可靠性)
echo ==========================================
echo.
echo 即将以管理员权限创建计划任务...
echo.
echo 此脚本将创建：
echo   - 任务名称: EMQX_AutoStart_v2
echo   - 触发条件: 系统启动时
echo   - 启动延迟: 30 秒
echo   - 运行账户: SYSTEM (最高权限)
echo.
echo ==========================================
echo.

:: 以管理员权限运行 PowerShell 脚本
powershell -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~dp0create-emqx-task-v2.ps1' -Verb RunAs -ArgumentList '-Force'"

echo.
echo 如果 PowerShell 窗口没有自动弹出，请手动：
echo 1. 右键点击 create-emqx-task-v2.ps1
echo 2. 选择 "使用管理员身份运行"
echo.
echo ==========================================
pause
