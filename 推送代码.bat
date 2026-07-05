@echo off
echo ========================================
echo   连锁洗衣系统 - Git代码推送工具
echo ========================================
echo.

cd /d "%~dp0"

REM 显示当前状态
echo 检查Git状态...
git status

echo.
echo ========================================
echo 本地有3个提交需要推送：
echo.
echo 1. feat: 完成连锁企业管理平台开发
echo    包含连锁管理平台、结算中心、价格管理、品类管理、
echo    数据层级权限、会员管理、消息服务等完整功能
echo.
echo 2. chore: 添加代码推送脚本，方便后续同步
echo.
echo 3. docs: 添加Git推送指南文档
echo ========================================
echo.

echo 远程仓库: https://github.com/jr181520/dry-cleaning-system.git
echo.

REM 检查网络连接
echo 正在检查网络连接...
ping -n 2 github.com >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 无法连接到GitHub，请检查网络！
    echo.
    echo 建议：
    echo 1. 确保网络连接正常
    echo 2. 运行"测试GitHub连接.bat"检查连接
    echo 3. 使用VPN或代理
    pause
    exit /b 1
)

echo ✅ 网络连接正常
echo.

choice /c YNC /n /m "选择操作: (Y)推送 / (N)取消 / (C)强制推送: "
if %errorlevel% equ 2 (
    echo 用户取消操作。
    pause
    exit /b 0
)

echo.
if %errorlevel% equ 3 (
    echo 正在强制推送...
    git push --force-with-lease origin master
) else (
    echo 正在推送代码...
    git push origin master
)

if %errorlevel% equ 0 (
    echo.
    echo ✅ 代码推送成功！
    echo.
    echo 提交已成功推送到GitHub仓库。
    echo 访问 https://github.com/jr181520/dry-cleaning-system 查看
    echo.
    echo 推送内容包括：
    echo 1. 连锁企业管理平台完整功能
    echo 2. 结算中心和权限管理系统
    echo 3. 完整的测试工具和文档
) else (
    echo.
    echo ❌ 推送失败！
    echo.
    echo 可能的解决方案：
    echo 1. 运行 git config --global http.postBuffer 1048576000
    echo 2. 使用SSH方式: git remote set-url origin git@github.com:jr181520/dry-cleaning-system.git
    echo 3. 使用GitHub Desktop客户端
    echo 4. 查看详细指南: GIT_SYNC_GUIDE.md
)

echo.
pause