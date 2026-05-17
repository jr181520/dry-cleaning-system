$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-emqx-start.bat"'
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'EMQX_AutoStart_v2' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
Write-Host 'Task created: EMQX_AutoStart_v2'
Get-ScheduledTask -TaskName 'EMQX_AutoStart_v2' | Select-Object TaskName, State, Description
