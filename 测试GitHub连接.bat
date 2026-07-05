@echo off
echo ========================================
echo   GitHub连接测试工具
echo ========================================
echo.

echo 1. 测试GitHub网站可访问性...
ping -n 3 github.com

echo.
echo 2. 测试GitHub HTTPS端口(443)...
powershell -Command "Test-NetConnection github.com -Port 443"

echo.
echo 3. 测试GitHub SSH端口(22)...
powershell -Command "Test-NetConnection github.com -Port 22"

echo.
echo 4. 测试GitHub API...
curl -I https://api.github.com

echo.
echo 5. 测试当前Git配置...
git --version
git config --get remote.origin.url

echo.
echo ========================================
echo 测试完成！
echo ========================================
echo.
pause