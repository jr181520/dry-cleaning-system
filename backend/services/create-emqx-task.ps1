# 创建EMQX开机启动计划任务（改进版）
$taskName = "WSL_EMQX_Startup"
$scriptPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-emqx-start.bat"

# 检查任务是否已存在
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "[INFO] Task already exists, removing old task..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# 创建新任务（使用系统启动触发，延迟30秒）
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT30S"  # 延迟30秒，确保WSL已就绪

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# 以SYSTEM用户身份运行，确保权限
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Start EMQX MQTT Broker in WSL at system startup (delayed 30s)" | Out-Null

Write-Host "[SUCCESS] EMQX startup task created!"
Write-Host "Task name: $taskName"
Write-Host "Will run: $scriptPath"
Write-Host "Trigger: At system startup (delayed 30s)"
Write-Host "User: SYSTEM (highest privileges)"
