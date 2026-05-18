@echo off
chcp 65001 >nul
echo ========================================
echo 微信小程序订单功能测试
echo ========================================
echo.

echo [1/4] 检查后端服务状态...
curl -s http://192.168.1.8:3000/api/health
echo.
echo.

echo [2/4] 测试服务列表API...
curl -s http://192.168.1.8:3000/api/cleaning/services | findstr /C:"success"
echo.
echo.

echo [3/4] 测试订单创建API...
echo 请输入测试userId（直接回车使用默认测试ID）:
set /p userId=
if "%userId%"=="" set userId=test_user_001

curl -s -X POST http://192.168.1.8:3000/api/cleaning/orders ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"%userId%\",\"storeId\":\"ST001\",\"items\":[{\"name\":\"西装干洗\",\"price\":88,\"quantity\":1}],\"amounts\":{\"subtotal\":88,\"total\":88}}" | findstr /C:"success"
echo.
echo.

echo [4/4] 测试订单列表API...
curl -s "http://192.168.1.8:3000/api/cleaning/orders?userId=%userId%" | findstr /C:"success"
echo.
echo.

echo ========================================
echo 测试完成！
echo ========================================
echo.
echo 如果所有测试都显示 "success": true
echo 说明后端API工作正常
echo.
echo 下一步：
echo 1. 打开微信开发者工具
echo 2. 测试小程序下单流程
echo 3. 查看控制台日志确认订单创建成功
echo 4. 在订单列表中确认真实订单显示
echo.
pause
