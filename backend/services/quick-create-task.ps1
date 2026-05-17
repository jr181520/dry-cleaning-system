$taskName = "EMQX_AutoStart_v2"
$scriptPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-emqx-start.bat"

Write-Host "Creating EMQX startup task..."
Write-Host "Task Name: $taskName"

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Write-Host "SUCCESS: Task created!"
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State, TaskPath
