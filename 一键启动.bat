@echo off
chcp 65001 >nul
echo ==========================================
echo   干洗店管理系统 - 一键启动
echo ==========================================
echo.

cd /d "%~dp0"

echo [检查] 后端服务状态...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo   ✓ 后端服务已在运行！
    echo.
    echo ==========================================
    echo   打开浏览器访问：
    echo.
    echo   管理员端: http://localhost:3000/admin.html
    echo   客户端:    http://localhost:3000/c-index.html
    echo   移动端:    http://localhost:3000/m-index.html
    echo   离线移动端: http://localhost:3000/m-index-offline.html
    echo ==========================================
) else (
    echo.
    echo   后端服务未启动，正在启动...
    echo.
    
    start "后端服务" cmd /k "cd /d "%~dp0backend" && node server.js"
    
    echo   等待服务启动...
    timeout /t 3 /nobreak >nul
    
    netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
    
    if %errorlevel% equ 0 (
        echo.
        echo   ✓ 后端服务启动成功！
        echo.
        echo ==========================================
        echo   打开浏览器访问：
        echo.
        echo   管理员端: http://localhost:3000/admin.html
        echo   客户端:    http://localhost:3000/c-index.html
        echo   移动端:    http://localhost:3000/m-index.html
        echo   离线移动端: http://localhost:3000/m-index-offline.html
        echo ==========================================
    ) else (
        echo.
        echo   ✗ 后端服务启动失败
        echo   请检查错误信息，或手动启动：
        echo   cd d:\Trae CN\bin\dry_cleaning_system\backend
        echo   npm start
    )
)

echo.
pause