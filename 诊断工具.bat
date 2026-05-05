@echo off
chcp 65001 >nul
echo ==========================================
echo   干洗店管理系统 - 诊断工具
echo ==========================================
echo.

echo [1] 检查后端服务状态...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1

if %errorlevel% equ 0 (
    echo   ✓ 后端服务正在运行（端口 3000）
) else (
    echo   ✗ 后端服务未运行
)
echo.

echo [2] 检查 MQTT Broker 状态...
netstat -ano | findstr ":1884" | findstr "LISTENING" >nul 2>&1

if %errorlevel% equ 0 (
    echo   ✓ MQTT Broker 正在运行（端口 1884）
) else (
    echo   ✗ MQTT Broker 未运行
)
echo.

echo [3] 检查 Node.js 进程...
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE | findstr "node.exe"
echo.

echo [4] 快速测试后端服务...
echo   正在访问 http://localhost:3000...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -TimeoutSec 3; Write-Host '   ✓ 后端服务响应: ' $response.Content } catch { Write-Host '   ✗ 后端服务无响应: ' $_.Exception.Message }"
echo.

echo ==========================================
echo   诊断完成
echo ==========================================
echo.
echo 常用命令：
echo   强制关闭端口 3000: netstat -ano ^| findstr :3000
echo   查看进程: tasklist /FI "IMAGENAME eq node.exe"
echo   关闭进程: taskkill /PID [进程ID] /F
echo.
pause
