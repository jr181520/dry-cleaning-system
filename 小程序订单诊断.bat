@echo off
chcp 65001 >nul
echo ========================================
echo 微信小程序订单功能诊断工具
echo ========================================
echo.

echo [1/8] 检查后端服务是否运行...
curl -s http://192.168.1.8:3000/api/health >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 后端服务运行正常
) else (
    echo ❌ 后端服务未运行或无法访问
    echo    请检查：
    echo    1. 后端服务是否已启动
    echo    2. IP地址是否正确（当前：192.168.1.8）
)
echo.

echo [2/8] 检查数据库连接...
curl -s http://192.168.1.8:3000/api/system/modules >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 数据库连接正常
) else (
    echo ❌ 数据库连接可能有问题
)
echo.

echo [3/8] 测试服务列表API...
curl -s http://192.168.1.8:3000/api/cleaning/services > %temp%\services_test.txt 2>&1
findstr /C:"success" %temp%\services_test.txt >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 服务列表API正常
) else (
    echo ❌ 服务列表API异常
    echo    响应内容：
    type %temp%\services_test.txt
)
echo.

echo [4/8] 测试订单列表API（无userId）...
curl -s "http://192.168.1.8:3000/api/cleaning/orders" > %temp%\orders_test.txt 2>&1
findstr /C:"success" %temp%\orders_test.txt >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 订单列表API正常（无userId）
) else (
    echo ⚠️  订单列表API可能需要userId参数
)
echo.

echo [5/8] 测试订单创建API...
curl -s -X POST "http://192.168.1.8:3000/api/cleaning/orders" ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"test_diagnosis_user\",\"storeId\":\"ST001\",\"items\":[{\"name\":\"测试服务\",\"price\":50}],\"amounts\":{\"total\":50}}" > %temp%\create_test.txt 2>&1
findstr /C:"success" %temp%\create_test.txt >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 订单创建API正常
    echo    新增测试订单已创建
) else (
    echo ❌ 订单创建API异常
    echo    响应内容：
    type %temp%\create_test.txt
)
echo.

echo [6/8] 测试订单列表API（有userId）...
curl -s "http://192.168.1.8:3000/api/cleaning/orders?userId=test_diagnosis_user" > %temp%\orders_user_test.txt 2>&1
findstr /C:"success" %temp%\orders_user_test.txt >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 带userId的订单查询正常
) else (
    echo ❌ 订单查询可能有问题
    echo    响应内容：
    type %temp%\orders_user_test.txt
)
echo.

echo [7/8] 检查小程序配置...
findstr /C:"192.168.1.8" wechat-mini-app\app.js >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 小程序API地址配置正确
) else (
    echo ❌ 小程序API地址可能配置错误
    echo    请检查 wechat-mini-app\app.js 中的 apiBaseUrl
)
echo.

echo [8/8] 检查订单页面代码...
findstr /C:"userId" wechat-mini-app\pages\orders\index.js >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 订单列表传递userId参数
) else (
    echo ❌ 订单列表可能未传递userId
)
echo.

echo ========================================
echo 诊断完成！
echo ========================================
echo.
echo 如果有问题，请检查：
echo 1. 后端服务是否启动（PM2服务管理）
echo 2. MongoDB数据库是否运行
echo 3. 小程序app.js中的API地址配置
echo 4. 查看后端日志获取更多错误信息
echo.
echo 下一步操作：
echo 1. 打开微信开发者工具
echo 2. 测试登录和下单流程
echo 3. 查看控制台日志中的 [订单] 相关输出
echo.
pause
del %temp%\services_test.txt 2>nul
del %temp%\orders_test.txt 2>nul
del %temp%\create_test.txt 2>nul
del %temp%\orders_user_test.txt 2>nul
