@echo off
chcp 65001 >nul
title 代客下单支付功能测试

echo ========================================
echo   代客下单支付功能测试脚本
echo ========================================
echo.

echo [1/5] 检查服务状态...
echo.

:: 检查后端服务 (端口3000)
netstat -an | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo ✓ 后端服务正在运行 (端口3000)
) else (
    echo ✗ 后端服务未运行 (端口3000)
    echo   请运行: cd backend ^&^& npm start
)

:: 检查支付服务 (端口3002)
netstat -an | findstr ":3002" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo ✓ 支付服务器正在运行 (端口3002)
) else (
    echo ✗ 支付服务器未运行 (端口3002)
    echo   请运行: cd api\payment-server ^&^& node server.js
)

echo.
echo [2/5] 测试访问地址...
echo.

:: 检查前端页面是否可访问
curl -s -o nul -w "%%{http_code}" http://localhost:3002/m-index.html > temp_code.txt 2>nul
set /p code=<temp_code.txt
del temp_code.txt

if "%code%"=="200" (
    echo ✓ M端页面可访问: http://localhost:3002/m-index.html
) else (
    echo ✗ M端页面无法访问 (HTTP %code%)
)

echo.
echo [3/5] 功能检查清单...
echo.

echo 请在浏览器中完成以下测试：
echo.
echo □ 1. 访问 http://localhost:3002/m-index.html
echo □ 2. 登录门店账号
echo □ 3. 点击"代客下单"按钮
echo □ 4. 输入测试手机号: 13800138001
echo □ 5. 添加一个测试物品
echo □ 6. 点击"确认下单"
echo □ 7. 在支付页面检查：
echo      - 是否显示会员余额（如果手机号存在）
echo      - 四个支付按钮是否正常显示
echo □ 8. 测试"打印订单"按钮
echo.
echo □ 9. 访问 http://localhost:3002/admin.html
echo □ 10. 查看"订单管理"是否显示刚才的订单
echo.

echo [4/5] 常见问题排查...
echo.

echo 如果遇到问题，请检查：
echo 1. 浏览器控制台 (F12) 是否有错误信息
echo 2. localStorage 是否有数据
echo 3. 服务是否正常启动
echo.

echo [5/5] 启动服务命令...
echo.

echo 后端服务:
echo   cd d:\Trae CN\bin\dry_cleaning_system\backend
echo   npm start
echo.
echo 支付服务器:
echo   cd d:\Trae CN\bin\dry_cleaning_system\api\payment-server
echo   node server.js
echo.
echo 前端服务 (如果没有):
echo   cd d:\Trae CN\bin\dry_cleaning_system
echo   npx http-server . -p 3002
echo.

echo ========================================
echo   测试脚本执行完成
echo ========================================
echo.
pause
