@echo off
:: 一键创建EMQX开机启动任务
:: 需要管理员权限

echo Creating EMQX startup task...
schtasks /Create /TN "WSL_EMQX_Startup" /TR "cmd /c D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-start-emqx.bat" /SC ONLOGON /RL HIGHEST /F

echo.
echo Task created! Checking...
schtasks /Query /TN "WSL_EMQX_Startup"
pause
