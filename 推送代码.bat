@echo off
echo 正在推送代码到GitHub仓库...
echo.

cd /d "%~dp0"

REM 检查是否有未提交的更改
git status --porcelain >nul 2>&1
if %errorlevel% equ 0 (
    echo 发现有未提交的更改，正在提交...
    git add .
    git commit -m "auto-commit: 自动提交更改"
)

REM 尝试推送
echo.
echo 正在推送到远程仓库...
git push origin master

if %errorlevel% equ 0 (
    echo.
    echo ✅ 代码推送成功！
) else (
    echo.
    echo ❌ 推送失败，请检查网络连接或Git配置。
    echo.
    echo 可能的解决方案：
    echo 1. 检查网络连接
    echo 2. 确认有GitHub仓库的访问权限
    echo 3. 使用GitHub CLI: gh repo sync
    echo 4. 手动推送: git push origin master
)

echo.
pause