@echo off
chcp 65001 > nul
echo ========================================
echo   干洗系统 MQTT Broker 快速启动脚本
echo ========================================
echo.

:: 检查 Docker 是否安装
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Docker，请先安装 Docker
    echo 下载地址: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [✓] Docker 已安装

:: 检查 Docker 是否运行
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未运行，请启动 Docker Desktop
    pause
    exit /b 1
)

echo [✓] Docker 已运行

:: 检查 EMQX 是否已存在
docker ps -a --format "{{.Names}}" | findstr /i "^emqx$" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo [提示] EMQX 容器已存在
    docker start emqx >nul 2>&1
    echo [✓] EMQX 已启动
) else (
    echo.
    echo [提示] 正在创建并启动 EMQX 容器...
    
    docker run -d ^
        --name emqx ^
        -p 1883:1883 ^
        -p 8083:8083 ^
        -p 8883:8883 ^
        -p 8084:8084 ^
        -p 18083:18083 ^
        -e EMQX_LOADED_PLUGINS="emqx_management,emqx_dashboard" ^
        -e EMQX_DASHBOARD__DEFAULT_USERNAME=admin ^
        -e EMQX_DASHBOARD__DEFAULT_PASSWORD=public ^
        emqx/emqx:latest >nul 2>&1
        
    if %errorlevel% equ 0 (
        echo [✓] EMQX 创建并启动成功
    ) else (
        echo [错误] EMQX 启动失败，请检查端口是否被占用
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo   MQTT Broker 启动完成！
echo ========================================
echo.
echo [服务地址]
echo   - MQTT 端口: mqtt://localhost:1883
echo   - WebSocket:  ws://localhost:8083/mqtt
echo   - 控制台:     http://localhost:18083
echo.
echo [默认账号]
echo   - 用户名: admin
echo   - 密码:   public
echo.
echo [等待服务启动...]
timeout /t 5 /nobreak > nul

:: 检查 EMQX 状态
docker ps --format "{{.Status}}" | findstr emqx >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] EMQX 运行中
) else (
    echo [错误] EMQX 未正常运行
)

echo.
echo ========================================
echo   下一步操作：
echo ========================================
echo.
echo 1. 访问控制台: http://localhost:18083
echo 2. 安装后端 MQTT 包:
echo    cd backend
echo    npm install mqtt
echo 3. 重启后端服务
echo 4. 访问后台管理系统，查看 MQTT 连接状态
echo.
echo ========================================
pause
