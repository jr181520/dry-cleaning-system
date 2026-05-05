# 干洗系统后端安装脚本
# 用于 Windows PowerShell

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  干洗系统后端 - 自动安装脚本" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js 未安装" -ForegroundColor Red
    Write-Host "   请先安装 Node.js: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# 检查 npm
try {
    $npmVersion = npm -v
    Write-Host "✅ npm 版本: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm 未安装" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 进入 backend 目录
Set-Location -Path $PSScriptRoot\..
$backendDir = Get-Location

Write-Host "📦 正在安装依赖..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 依赖安装成功" -ForegroundColor Green
} else {
    Write-Host "❌ 依赖安装失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  安装完成！" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 下一步:" -ForegroundColor Yellow
Write-Host "   1. 配置数据库（编辑 .env 文件）" -ForegroundColor White
Write-Host "   2. 启动数据库服务" -ForegroundColor White
Write-Host "   3. 初始化数据库: npm run db:init" -ForegroundColor White
Write-Host "   4. 创建测试数据: npm run db:seed" -ForegroundColor White
Write-Host "   5. 启动服务: npm start" -ForegroundColor White
Write-Host ""
Write-Host "💡 查看完整指南: QUICKSTART.md" -ForegroundColor Gray
Write-Host ""
