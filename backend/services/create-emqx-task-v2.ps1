# 创建 EMQX 可靠开机启动计划任务 (v2)
# 改进：系统级任务、延迟启动、更健壮的错误处理

param(
    [switch]$Force
)

$taskName = "EMQX_AutoStart_v2"
$scriptPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-emqx-start.bat"
$logFile = "D:\Trae CN\bin\dry_cleaning_system\backend\services\logs\task-creation.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $logFile -Value $logEntry -Encoding UTF8
    Write-Host $logEntry
}

Write-Log "========================================"
Write-Log "EMQX Task Creation Script v2"
Write-Log "========================================"

# 1. 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Log "Administrator check: $isAdmin"

if (-not $isAdmin) {
    Write-Log "This script needs to run as Administrator for system-level task" -Level "ERROR"
    Write-Host "`n请右键选择 '使用管理员身份运行' PowerShell" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 2. 检查脚本文件是否存在
if (-not (Test-Path $scriptPath)) {
    Write-Log "Script file not found: $scriptPath" -Level "ERROR"
    exit 1
}

# 3. 删除旧任务（如果存在）
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Log "Removing existing task: $taskName"
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Start-Sleep -Seconds 2
}

# 4. 创建日志目录
$logDir = Split-Path $scriptPath -Parent | Join-Path -ChildPath "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Write-Log "Created log directory: $logDir"
}

# 5. 创建计划任务
Write-Log "Creating scheduled task..."

try {
    # 动作：执行批处理脚本
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`""
    
    # 触发器：系统启动时（关键改进）
    $trigger = New-ScheduledTaskTrigger -AtStartup
    
    # 延迟：启动后等待 30 秒（让 WSL 完全就绪）
    $trigger.Delay = "PT30S"  # 30 秒延迟
    
    # 任务设置
    $settings = New-ScheduledTaskSettingsSet -Description "EMQX MQTT Broker Auto Start - Production v2"
    $settings.AllowStartIfOnBatteries = $true
    $settings.DontStopIfGoingOnBatteries = $true
    $settings.StartWhenAvailable = $true
    $settings.RunOnlyIfNetworkAvailable = $false
    $settings.ExecutionTimeLimit = [TimeSpan]::FromHours(1)  # 最多运行 1 小时
    
    # 用户：系统级（最高权限）
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    # 注册任务
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    
    Write-Log "SUCCESS: Task created: $taskName"
    
} catch {
    Write-Log "Failed to create task: $_" -Level "ERROR"
    exit 1
}

# 6. 显示任务信息
Write-Log "`n========================================"
Write-Log "Task Configuration Summary:"
Write-Log "========================================"
Write-Log "Task Name:      $taskName"
Write-Log "Trigger:        At System Startup"
Write-Log "Delay:          30 seconds (PT30S)"
Write-Log "Script:         $scriptPath"
Write-Log "User:           SYSTEM (Service Account)"
Write-Log "Run Level:      Highest"
Write-Log "========================================"

# 7. 测试任务（可选）
if ($Force) {
    Write-Log "`nTesting task execution..."
    Start-ScheduledTask -TaskName $taskName
    Write-Log "Task started for testing"
    Start-Sleep -Seconds 5
    
    $taskInfo = Get-ScheduledTask -TaskName $taskName
    Write-Log "Task State: $($taskInfo.State)"
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✓ EMQX 开机启动任务创建成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "任务名称: $taskName"
Write-Host "触发条件: 系统启动时"
Write-Host "启动延迟: 30 秒"
Write-Host ""
Write-Host "重启电脑后，EMQX 将自动启动" -ForegroundColor Cyan
Write-Host "========================================`n"
