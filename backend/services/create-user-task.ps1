$taskName = "EMQX_AutoStart_v2"
$scriptPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-emqx-start.bat"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating EMQX Auto-Start Task" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 删除旧任务（如果存在）
$oldTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($oldTask) {
    Write-Host "[1/4] Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Write-Host "[2/4] Creating task components..."
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'

Write-Host "[3/4] Configuring settings..."
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$settings.ExecutionTimeLimit = [TimeSpan]::Zero  # No time limit

# 使用当前用户
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Password -RunLevel Highest

Write-Host "[4/4] Registering task..." -ForegroundColor Yellow
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Task Created: $taskName" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State | Format-List
    Write-Host ""
    Write-Host "Trigger: System Startup (with 30s delay)" -ForegroundColor Cyan
    Write-Host "User: $env:USERNAME" -ForegroundColor Cyan
    Write-Host "Script: $scriptPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "EMQX will auto-start after Windows boots!" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "ERROR: Failed to create task" -ForegroundColor Red
    Write-Host $_ -ForegroundColor Red
}
