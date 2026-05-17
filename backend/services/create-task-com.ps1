# 使用 Task Scheduler COM 创建任务（可能不需要密码）

$taskName = "EMQX_AutoStart_v2"
$scriptPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\wsl-emqx-start.bat"

Write-Host "Creating EMQX Auto-Start Task using COM..."

try {
    $service = New-Object -ComObject Schedule.Service
    $service.Connect()
    
    $rootFolder = $service.GetFolder("\")
    
    # 删除旧任务
    $oldTask = $rootFolder.GetTask($taskName)
    if ($oldTask) {
        Write-Host "Removing old task..."
        $rootFolder.DeleteTask($taskName, 0)
    }
    
    # 创建任务定义
    $taskDefinition = $service.NewTask(0)
    
    # 设置注册信息
    $taskDefinition.RegistrationInfo.Description = "EMQX MQTT Broker Auto-Start v2"
    $taskDefinition.RegistrationInfo.Author = $env:USERNAME
    
    # 创建触发器 - 开机时
    $trigger = $taskDefinition.Triggers.Create(8)  # 8 = Boot
    $trigger.Delay = "PT30S"  # 30秒延迟
    
    # 创建动作 - 运行脚本
    $action = $taskDefinition.Actions.Create(0)  # 0 = Execute
    $action.Path = "cmd.exe"
    $action.Arguments = "/c `"$scriptPath`""
    
    # 设置 principal - 使用当前用户
    $principal = $taskDefinition.Principal
    $principal.LogonType = 3  # Password
    $principal.RunLevel = 1  # Highest
    
    # 设置设置
    $settings = $taskDefinition.Settings
    $settings.AllowStartOnBatteries = $true
    $settings.StopIfGoingOnBatteries = $false
    $settings.StartWhenAvailable = $true
    $settings.ExecutionTimeLimit = $null  # 无时间限制
    
    # 注册任务
    $rootFolder.RegisterTaskDefinition($taskName, $taskDefinition, 6, $null, $null, 3)
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Task Created: $taskName" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "ERROR: " -ForegroundColor Red -NoNewline
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "This method also failed. Try manually running Task Scheduler." -ForegroundColor Yellow
}
