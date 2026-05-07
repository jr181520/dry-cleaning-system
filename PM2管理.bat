@echo off
chcp 65001 >nul
echo ========================================
echo   PM2 服务管理脚本
echo ========================================
echo.
echo 请选择操作:
echo.
echo   1. 启动所有服务
echo   2. 停止所有服务
echo   3. 重启所有服务
echo   4. 查看服务状态
echo   5. 查看后端日志
echo   6. 查看MQTT日志
echo   7. 查看所有日志
echo   8. 设置开机自启动
echo   9. 清理所有进程
echo   0. 退出
echo.
echo ========================================
echo.

set /p choice=请输入选项 (0-9): 

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto status
if "%choice%"=="5" goto backend_logs
if "%choice%"=="6" goto mqtt_logs
if "%choice%"=="7" goto all_logs
if "%choice%"=="8" goto startup
if "%choice%"=="9" goto delete
if "%choice%"=="0" goto end

echo 无效的选项，请重新选择
echo.
pause
goto menu

:start
echo.
echo 正在启动所有服务...
echo.
pm2 start ecosystem.config.js
pm2 save
echo.
echo ✅ 启动完成！
echo.
pause
goto end

:stop
echo.
echo 正在停止所有服务...
echo.
pm2 stop all
echo.
echo ✅ 停止完成！
echo.
pause
goto end

:restart
echo.
echo 正在重启所有服务...
echo.
pm2 restart all
echo.
echo ✅ 重启完成！
echo.
pause
goto end

:status
echo.
echo ========================================
echo   PM2 服务状态
echo ========================================
echo.
pm2 list
echo.
echo 按任意键返回菜单...
pause >nul
goto menu

:backend_logs
echo.
echo ========================================
echo   后端服务日志 (Ctrl+C 退出)
echo ========================================
echo.
pm2 logs dry-cleaning-backend --f
goto end

:mqtt_logs
echo.
echo ========================================
echo   MQTT Broker 日志 (Ctrl+C 退出)
echo ========================================
echo.
pm2 logs mqtt-broker --f
goto end

:all_logs
echo.
echo ========================================
echo   所有服务日志 (Ctrl+C 退出)
echo ========================================
echo.
pm2 logs --f
goto end

:startup
echo.
echo 正在设置开机自启动...
echo.
echo ⚠️  可能需要管理员权限，请按照提示操作
echo.
pm2 startup
pm2 save
echo.
echo ✅ 开机自启动设置完成！
echo.
pause
goto end

:delete
echo.
echo ⚠️  正在清理所有PM2进程...
echo.
pm2 delete all
pm2 kill
echo.
echo ✅ 清理完成！
echo.
pause
goto end

:menu
cls
call "%~f0"
exit /b

:end
