# Git 快速提交工具
# 使用方法：右键 -> 使用PowerShell运行 / 或双击运行

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       Git 快速提交工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查Git是否安装
try {
    $gitVersion = git --version
    Write-Host "[OK] 检测到Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] 未检测到Git，请先安装Git" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

# 进入脚本所在目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 检查是否有修改
$status = git status --porcelain
if (-not $status) {
    Write-Host "[信息] 没有检测到任何修改" -ForegroundColor Yellow
    Read-Host "按回车退出"
    exit 0
}

# 显示修改的文件
Write-Host ""
Write-Host "[检测] 发现以下文件有修改：" -ForegroundColor Cyan
Write-Host ""
git status --short
Write-Host ""

# 确认操作
$confirm = Read-Host "是否提交这些修改? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "[取消] 操作已取消" -ForegroundColor Yellow
    exit 0
}

# 添加所有修改
Write-Host ""
Write-Host "[进度] 正在添加修改的文件..." -ForegroundColor Cyan
git add -A

# 生成默认提交信息
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$defaultMsg = "自动提交 $timestamp"

# 询问提交信息
Write-Host ""
Write-Host "[提示] 默认提交信息: $defaultMsg" -ForegroundColor Gray
$customMsg = Read-Host "输入提交信息（直接回车使用默认）"

if ([string]::IsNullOrWhiteSpace($customMsg)) {
    $commitMsg = $defaultMsg
} else {
    $commitMsg = $customMsg
}

# 执行提交
Write-Host ""
Write-Host "[进度] 正在提交..." -ForegroundColor Cyan
try {
    git commit -m $commitMsg
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "[成功] 提交完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "最近提交：" -ForegroundColor Cyan
    git log --oneline -1
    Write-Host ""
    
    # 询问是否推送到远程
    $pushConfirm = Read-Host "是否推送到远程仓库? (Y/N)"
    if ($pushConfirm -eq "Y" -or $pushConfirm -eq "y") {
        Write-Host ""
        Write-Host "[进度] 正在推送到远程..." -ForegroundColor Cyan
        git push
        Write-Host ""
        Write-Host "[成功] 推送完成！" -ForegroundColor Green
    }
    
} catch {
    Write-Host ""
    Write-Host "[错误] 提交失败：$_" -ForegroundColor Red
}

Write-Host ""
Read-Host "按回车退出"
