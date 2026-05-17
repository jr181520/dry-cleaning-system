@echo off
echo ===========================================
echo   EMQX开机任务修复脚本
echo ===========================================
echo.
echo 此脚本将：
echo 1. 删除现有的EMQX开机任务
echo 2. 使用改进的设置重新创建任务
echo 3. 解决WSL启动延迟问题
echo.
echo 即将以管理员权限执行...
echo.

:: 检查是否以管理员权限运行
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 需要管理员权限，正在请求提升权限...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

echo [1/4] 删除现有任务...
schtasks /delete /tn "WSL_EMQX_Startup" /f 2>nul
if %errorlevel% equ 0 (
    echo   ✓ 旧任务已删除
) else (
    echo   ! 任务可能不存在或已删除
)

echo.
echo [2/4] 创建改进的任务...
powershell -ExecutionPolicy Bypass -File "%~dp0create-emqx-task.ps1"
if %errorlevel% equ 0 (
    echo   ✓ 新任务创建成功
) else (
    echo   ✗ 任务创建失败
    goto :error
)

echo.
echo [3/4] 验证任务状态...
schtasks /query /tn "WSL_EMQX_Startup" /fo list 2>nul
if %errorlevel% equ 0 (
    echo   ✓ 任务验证成功
) else (
    echo   ✗ 任务验证失败
    goto :error
)

echo.
echo [4/4] 测试EMQX启动...
echo   手动测试EMQX启动脚本...
"%~dp0wsl-emqx-start.bat"

echo.
echo ===========================================
echo   修复完成！
echo ===========================================
echo.
echo 下次系统启动时，EMQX将自动启动。
echo 如需立即测试，请重启电脑或手动运行wsl-emqx-start.bat
echo.
pause
exit /b 0

:error
echo.
echo ===========================================
echo   修复过程中出现错误
echo ===========================================
echo.
echo 请检查：
echo 1. 是否以管理员权限运行
echo 2. WSL是否已正确安装和配置
echo 3. EMQX是否已安装在WSL中
echo.
pause
exit /b 1