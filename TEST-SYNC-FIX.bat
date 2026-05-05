@echo off
chcp 65001 > nul
echo ============================================
echo   数据同步401错误修复验证测试
echo ============================================
echo.

echo [1/4] 检查后端服务状态...
curl -s http://localhost:3000/api/stores > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 后端服务未运行，请先启动服务
    echo    运行: 一键启动.bat
    pause
    exit /b 1
)
echo ✅ 后端服务运行正常

echo.
echo [2/4] 测试API访问...
curl -s "http://localhost:3000/api/cleaning/orders?page=1&pageSize=1" | findstr "success" > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ API访问失败
    pause
    exit /b 1
)
echo ✅ API访问正常

echo.
echo [3/4] 启动浏览器测试...
echo.
echo 请按以下步骤测试：
echo.
echo 1. 打开浏览器（推荐Chrome）
echo 2. 访问以下页面：
echo    - C端: http://localhost:3000/c-orders.html
echo    - M端: http://localhost:3000/m-index.html
echo    - 管理: http://localhost:3000/admin.html
echo.
echo 3. 按 F12 打开开发者工具
echo 4. 切换到 Console 标签
echo.
echo 5. 验证应该看到同步日志：
echo    [同步 xx:xx:xx] ℹ️ 开始同步订单数据...
echo    [同步 xx:xx:xx] ℹ️ 从 /cleaning/orders 获取到 X 条订单
echo    [同步 xx:xx:xx] ℹ️ 同步完成
echo.
echo 6. 确认没有401错误
echo.
echo ============================================
echo 修复版本: 5b8ca7b
echo ============================================
pause
