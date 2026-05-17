# ========================================
# 开机自启动计划任务创建脚本
# 创建两个任务：
# 1. PM2 后端服务开机启动
# 2. EMQX MQTT Broker 开机启动
# ========================================

$ErrorActionPreference = "Stop"

# 任务名称
$pm2TaskName = "PM2_Backend_Startup"
$emqxTaskName = "WSL_EMQX_Startup"

# 脚本路径
$pm2ScriptPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\pm2-startup.bat"
$emqxScriptPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-emqx-start.bat"

Write-Host "========================================"
Write-Host "  创建开机自启动计划任务"
Write-Host "========================================"
Write-Host ""

# ========================================
# 1. 创建 PM2 后端服务开机任务
# ========================================
Write-Host "[1/2] 创建 PM2 后端服务开机任务..." -ForegroundColor Cyan

# 删除已存在的任务
$existingPm2Task = Get-ScheduledTask -TaskName $pm2TaskName -ErrorAction SilentlyContinue
if ($existingPm2Task) {
    Write-Host "  - 删除旧任务: $pm2TaskName" -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $pm2TaskName -Confirm:$false
}

# 创建操作
$pm2Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$pm2ScriptPath`""

# 创建触发器 - 系统启动时
$pm2Trigger = New-ScheduledTaskTrigger -AtStartup
$pm2Trigger.Delay = "00:00:10"  # 延迟 10 秒启动，等待系统就绪

# 任务设置
$pm2Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -DontStopOnHardEnd

# 创建任务 - 使用最高权限确保能访问所有资源
$pm2Principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Highest

Register-ScheduledTask `
    -TaskName $pm2TaskName `
    -Action $pm2Action `
    -Trigger $pm2Trigger `
    -Settings $pm2Settings `
    -Principal $pm2Principal `
    -Description "PM2 后端服务开机自启动 - 干洗店系统" `
    | Out-Null

Write-Host "  ✓ PM2 任务已创建: $pm2TaskName" -ForegroundColor Green

# ========================================
# 2. 创建 EMQX 开机启动任务
# ========================================
Write-Host ""
Write-Host "[2/2] 创建 EMQX MQTT Broker 开机任务..." -ForegroundColor Cyan

# 删除已存在的任务
$existingEmqxTask = Get-ScheduledTask -TaskName $emqxTaskName -ErrorAction SilentlyContinue
if ($existingEmqxTask) {
    Write-Host "  - 删除旧任务: $emqxTaskName" -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $emqxTaskName -Confirm:$false
}

# 创建操作
$emqxAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$emqxScriptPath`""

# 创建触发器 - 系统启动时
$emqxTrigger = New-ScheduledTaskTrigger -AtStartup
$emqxTrigger.Delay = "00:00:30"  # 延迟 30 秒启动，确保 WSL 已就绪

# 任务设置
$emqxSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -DontStopOnHardEnd

# 创建任务
Register-ScheduledTask `
    -TaskName $emqxTaskName `
    -Action $emqxAction `
    -Trigger $emqxTrigger `
    -Settings $emqxSettings `
    -Principal $pm2Principal `
    -Description "EMQX MQTT Broker 开机自启动 - 干洗店系统" `
    | Out-Null

Write-Host "  ✓ EMQX 任务已创建: $emqxTaskName" -ForegroundColor Green

# ========================================
# 验证
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  验证计划任务" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Get-ScheduledTask | Where-Object { $_.TaskName -eq $pm2TaskName -or $_.TaskName -eq $emqxTaskName } | ForEach-Object {
    $info = Get-ScheduledTaskInfo -TaskName $_.TaskName
    Write-Host "任务: $($_.TaskName)" -ForegroundColor White
    Write-Host "  状态: $($_.State)" 
    Write-Host "  触发: 系统启动" 
    Write-Host "  上次运行: $($info.LastRunTime)"
    Write-Host "  上次结果: $($info.LastTaskResult)"
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "  设置完成！开机后将自动启动服务。" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "提示: 下次重启电脑后，后端服务和 EMQX 将自动启动。" -ForegroundColor Yellow
