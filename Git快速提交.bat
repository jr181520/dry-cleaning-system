@echo off
chcp 65001 >nul
title Git 快速提交工具

echo ========================================
echo        Git 快速提交工具
echo ========================================
echo.

:: 检查Git是否安装
git --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Git，请先安装Git
    pause
    exit /b 1
)

:: 进入项目目录
cd /d "%~dp0"

:: 检查是否有修改
git status --porcelain > temp_status.txt
findstr /r "." temp_status.txt >nul
if errorlevel 1 (
    echo [信息] 没有检测到任何修改
    del temp_status.txt
    pause
    exit /b 0
)

:: 显示修改的文件
echo [检测] 发现以下文件有修改：
echo.
git status --short
echo.

:: 询问是否继续
set /p confirm=是否提交这些修改? (Y/N): 
if /i not "%confirm%"=="Y" (
    echo [取消] 操作已取消
    del temp_status.txt
    pause
    exit /b 0
)

:: 添加所有修改
echo.
echo [进度] 正在添加修改的文件...
git add -A

:: 获取默认提交信息（日期+时间）
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set date=%%a-%%b-%%c
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set time=%%a:%%b
set commit_msg=自动提交 %date% %time%

:: 询问提交信息
echo.
echo [提示] 默认提交信息: %commit_msg%
set /p custom_msg=输入提交信息（直接回车使用默认）: 

if "%custom_msg%"=="" (
    set final_msg=%commit_msg%
) else (
    set final_msg=%custom_msg%
)

:: 执行提交
echo.
echo [进度] 正在提交...
git commit -m "%final_msg%"

if errorlevel 1 (
    echo.
    echo [错误] 提交失败！
    del temp_status.txt
    pause
    exit /b 1
)

:: 显示提交结果
echo.
echo ========================================
echo [成功] 提交完成！
echo ========================================
echo.
git log --oneline -1
echo.

:: 清理临时文件
del temp_status.txt

pause
