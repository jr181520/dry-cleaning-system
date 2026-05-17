# Windows EMQX Edge 开机自启动任务创建脚本
$taskName = "NanoMQ_AutoStart"
$exePath = "C:\EMQX\emqx-edge.exe"
$workingDir = "C:\EMQX"
$logFile = "C:\EMQX\tmp\nanomq-startup.log"

# 删除旧任务（如果存在）
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "[INFO] 删除旧任务..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# 创建动作
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd /d C:\EMQX && echo [%date% %time%] Starting EMQX Edge... >> $logFile && start /b emqx-edge.exe start" -WorkingDirectory $workingDir

# 创建触发器 - 开机时
$trigger = New-ScheduledTaskTrigger -AtStartup

# 创建主体 - SYSTEM 账户，最高权限
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# 创建设置
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfIdle:$false -DontStopOnIdleEnd

# 注册任务
Write-Host "[INFO] 创建计划任务: $taskName ..."
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Windows EMQX Edge MQTT Broker - Auto Start at Boot"

Write-Host "[SUCCESS] 任务创建成功!"
Write-Host ""
Write-Host "任务配置:"
Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo | Select-Object TaskName, State, LastRunTime, LastTaskResult
