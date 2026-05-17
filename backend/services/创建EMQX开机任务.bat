@echo off
echo ===========================================
echo   EMQX开机启动任务创建脚本（改进版）
echo ===========================================
echo.
echo 即将以管理员权限创建计划任务...
echo.
echo 改进特性：
echo   - 使用系统启动触发（非用户登录）
echo   - 延迟30秒启动，确保WSL就绪
echo   - 使用SYSTEM账户，权限更高
echo   - 使用增强版启动脚本wsl-emqx-start.bat
echo.
powershell -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~dp0create-emqx-task.ps1' -Verb RunAs"
echo.
echo 如果PowerShell窗口没有自动弹出，请手动：
echo 1. 右键点击 create-emqx-task.ps1
echo 2. 选择 "使用管理员身份运行"
echo.
pause
