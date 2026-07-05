@echo off
echo ========================================
echo   Git代码推送工具
echo ========================================
echo.

REM 切换到项目目录
cd /d "%~dp0"

REM 检查Git状态
echo 检查Git状态...
git status

echo.
echo ========================================
echo 当前有3个本地提交需要推送到远程仓库：
echo 1. 11937c2 - docs: 添加Git推送指南文档
echo 2. 8df76ee - chore: 添加代码推送脚本，方便后续同步
echo 3. 365f3f7 - feat: 完成连锁企业管理平台开发
echo.
echo 即将推送到：https://github.com/jr181520/dry-cleaning-system.git
echo ========================================
echo.

REM 询问用户是否继续
choice /c YN /n /m "是否继续推送代码？(Y/N): "
if %errorlevel% equ 2 (
    echo 用户取消操作。
    pause
    exit /b 0
)

echo.
echo 正在推送代码...
echo.

REM 尝试推送
git push origin master

if %errorlevel% equ 0 (
    echo.
    echo ✅ 代码推送成功！
    echo.
    echo 提交已成功推送到GitHub仓库。
    echo 仓库地址：https://github.com/jr181520/dry-cleaning-system
) else (
    echo.
    echo ❌ 推送失败！
    echo.
    echo 可能的解决方案：
    echo 1. 检查网络连接是否正常
    echo 2. 确认GitHub账户有仓库访问权限
    echo 3. 使用GitHub Desktop客户端推送
    echo 4. 使用GitHub CLI: gh repo sync
    echo 5. 手动执行: git push origin master
)

echo.
pause