@echo off
chcp 65001 > nul
echo 启动 EMQX Broker...
cd /d "C:\Program Files\emqx\bin"
start /b emqx start
echo EMQX 已在后台启动
echo 访问控制台: http://localhost:18083
