@echo off
chcp 65001 >nul
echo ==========================================
echo   强制重启后端服务器
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] 查找并停止旧服务器进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo     正在停止进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo     ✅ 旧服务器已停止

echo.
echo [2/3] 等待端口释放...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] 启动新服务器...
start "干洗系统服务器" cmd /k "cd /d "%~dp0backend" && node server.js"

echo.
echo ==========================================
echo   ✅ 服务器重启完成！
echo ==========================================
echo.
echo   访问地址：
echo   - 管理员端: http://localhost:3000/admin.html
echo   - C端用户:  http://localhost:3000/c-index.html
echo   - M端POS:   http://localhost:3000/m-index.html
echo   - 订单列表: http://localhost:3000/c-orders.html
echo ==========================================
echo.
pause
