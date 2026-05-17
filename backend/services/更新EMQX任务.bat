@echo off
:: 更新EMQX开机启动任务
:: 需要管理员权限

echo Updating EMQX startup task...

:: 删除旧任务
schtasks /Delete /TN "WSL_EMQX_Startup" /F 2>nul

:: 创建新任务
schtasks /Create /TN "WSL_EMQX_Startup" /TR "cmd /c D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-start-emqx.bat" /SC ONLOGON /RL HIGHEST /F

echo.
echo Task updated! Checking...
schtasks /Query /TN "WSL_EMQX_Startup"
pause
