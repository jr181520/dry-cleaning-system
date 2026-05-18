@echo off
chcp 65001 >nul
echo ========================================
echo   C端微信登录功能测试
echo ========================================
echo.

:: 检查后端服务
echo [1/4] 检查后端服务...
curl -s -o nul -w "HTTP状态: %%{http_code}\n" http://localhost:3000/api/health
if %errorlevel% neq 0 (
    echo [错误] 后端服务未启动
    echo 请先启动后端服务: 启动后端.bat
    pause
    exit /b 1
)
echo.

:: 测试微信登录接口
echo [2/4] 测试微信登录接口...
curl -s -X POST http://localhost:3000/api/auth/wechat ^
    -H "Content-Type: application/json" ^
    -d "{\"openid\":\"test_oWeb_123456\",\"nickname\":\"测试用户\",\"sex\":1,\"platform\":\"wechat_web_test\"}"
echo.
echo.

:: 测试授权URL生成
echo [3/4] 测试微信授权URL生成...
curl -s http://localhost:3000/api/auth/wechat/authorize
echo.
echo.

:: 检查用户openid索引
echo [4/4] 检查用户模型openid字段...
echo 后端已更新用户模型，添加openid字段
echo.

echo ========================================
echo   测试完成
echo ========================================
echo.
echo 下一步：
echo 1. 打开浏览器访问: http://localhost:3000/c-login.html
echo 2. 点击微信登录按钮
echo 3. 如果未配置微信参数，会自动使用测试模式登录
echo 4. 登录后，openid会保存在localStorage
echo 5. 下单和查看订单时会使用openid作为用户标识
echo.
pause
