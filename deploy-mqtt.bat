@echo off
chcp 65001 >nul
echo ==========================================
echo   干洗系统 MQTT Broker 部署脚本
echo ==========================================
echo.

echo [1/3] 正在拉取 EMQX 镜像（首次约需2-5分钟）...
docker pull emqx/emqx:latest

echo.
echo [2/3] 创建 Docker 网络...
docker network create dryclean-net 2>nul
echo 网络创建完成

echo.
echo [3/3] 启动 EMQX 容器...
docker run -d ^
  --name emqx ^
  --network dryclean-net ^
  -p 1883:1883 ^
  -p 8083:8083 ^
  -p 8883:8883 ^
  -p 8084:8084 ^
  -p 18083:18083 ^
  -e EMQX_LOADED_PLUGINS="emqx_management,emqx_dashboard" ^
  -e EMQX_DASHBOARD__DEFAULT_USERNAME=admin ^
  -e EMQX_DASHBOARD__DEFAULT_PASSWORD=public ^
  emqx/emqx:latest

echo.
echo ==========================================
echo   部署完成！
echo ==========================================
echo.
echo EMQX 控制台: http://localhost:18083
echo 用户名: admin
echo 密码: public
echo.
echo MQTT 端口: 1883
echo WebSocket 端口: 8083
echo.
echo 按任意键退出...
pause >nul
