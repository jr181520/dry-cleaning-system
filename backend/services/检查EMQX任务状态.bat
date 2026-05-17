@echo off
echo ===========================================
echo   EMQX开机任务状态检查
echo ===========================================
echo.

echo [1/3] 检查计划任务状态...
schtasks /query /tn "WSL_EMQX_Startup" /fo list 2>nul
if %errorlevel% neq 0 (
    echo   ✗ 任务 WSL_EMQX_Startup 不存在
) else (
    echo   ✓ 任务 WSL_EMQX_Startup 存在
)

echo.
echo [2/3] 检查EMQX运行状态...
wsl -d Ubuntu -- bash -c "ss -tlnp | grep ':1883'" 2>nul
if %errorlevel% equ 0 (
    echo   ✓ EMQX正在运行 (端口1883)
) else (
    echo   ✗ EMQX未运行
)

echo.
echo [3/3] 检查EMQX管理面板...
wsl -d Ubuntu -- bash -c "curl -s http://localhost:18083/api/v5/healthcheck" 2>nul
if %errorlevel% equ 0 (
    echo   ✓ EMQX管理面板可访问
) else (
    echo   ✗ EMQX管理面板不可访问
)

echo.
echo ===========================================
echo   检查完成
echo ===========================================
echo.
pause