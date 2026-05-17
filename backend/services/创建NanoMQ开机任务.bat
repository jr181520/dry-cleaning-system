@echo off
chcp 65001 >nul
echo ==========================================
echo   NanoMQ (Windows EMQX Edge) 开机任务创建
echo ==========================================
echo.
echo 即将以管理员权限创建计划任务...
echo.
echo 任务配置:
echo   - 任务名称: NanoMQ_AutoStart
echo   - 触发条件: 系统启动时 (ONSTART)
echo   - 运行账户: SYSTEM
echo   - 权限级别: 最高
echo   - 执行程序: C:\EMQX\emqx-edge.exe
echo.
echo ==========================================
pause

schtasks /create /tn "NanoMQ_AutoStart" /tr "cmd /c cd /d C:\EMQX ^&^& start /b emqx-edge.exe start" /sc ONSTART /ru SYSTEM /rl HIGHEST /f

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo   任务创建成功!
    echo ==========================================
    echo.
    schtasks /query /tn "NanoMQ_AutoStart" /fo list
) else (
    echo.
    echo ==========================================
    echo   任务创建失败，请检查权限
    echo ==========================================
)

pause
