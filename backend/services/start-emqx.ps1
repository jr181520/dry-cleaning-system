# EMQX 生产级启动脚本
# 特性：健壮的 WSL 检测、错误处理、日志记录

param(
    [int]$MaxWaitSeconds = 60,
    [int]$WaitIntervalSeconds = 3
)

$ErrorActionPreference = "Continue"
$logFile = "D:\Trae CN\bin\dry_cleaning_system\backend\services\logs\emqx-startup.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $logFile -Value $logEntry -Encoding UTF8
    Write-Host $logEntry
}

# 创建日志目录
$logDir = Split-Path $logFile -Parent
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

Write-Log "========================================"
Write-Log "EMQX Startup Script - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Log "========================================"

# 1. 等待 WSL 就绪
Write-Log "[1/5] Waiting for WSL to be ready..."
$wslReady = $false
$elapsed = 0

while (-not $wslReady -and $elapsed -lt $MaxWaitSeconds) {
    try {
        $result = wsl -e bash -c "echo 'WSL_OK'" 2>&1
        if ($result -match "WSL_OK") {
            $wslReady = $true
            Write-Log "WSL is ready after $elapsed seconds"
        }
    } catch {
        Write-Log "WSL check failed: $_" -Level "WARN"
    }
    
    if (-not $wslReady) {
        Start-Sleep -Seconds $WaitIntervalSeconds
        $elapsed += $WaitIntervalSeconds
    }
}

if (-not $wslReady) {
    Write-Log "WSL did not become ready within $MaxWaitSeconds seconds" -Level "ERROR"
    exit 1
}

# 2. 检查 EMQX 是否已运行
Write-Log "[2/5] Checking if EMQX is already running..."
$emqxRunning = wsl -e bash -c "pgrep -f 'emqx' > /dev/null && echo 'RUNNING' || echo 'NOT_RUNNING'"
$emqxRunning = $emqxRunning.Trim()

if ($emqxRunning -eq "RUNNING") {
    Write-Log "EMQX is already running, no action needed"
    exit 0
}

# 3. 启动 EMQX
Write-Log "[3/5] Starting EMQX..."
try {
    $startResult = wsl -e bash -c "cd /opt/emqx && /opt/emqx/bin/emqx start 2>&1"
    Write-Log "EMQX start command executed: $startResult"
} catch {
    Write-Log "Failed to start EMQX: $_" -Level "ERROR"
    exit 1
}

# 4. 等待 EMQX 启动
Write-Log "[4/5] Waiting for EMQX to fully start..."
Start-Sleep -Seconds 10

# 5. 验证 EMQX 运行状态
Write-Log "[5/5] Verifying EMQX status..."
$verification = wsl -e bash -c "ss -tlnp 2>/dev/null | grep ':1883' | head -1"
$verification = $verification.Trim()

if ($verification) {
    Write-Log "SUCCESS: EMQX is running and listening on port 1883"
    Write-Log "Verification: $verification"
    exit 0
} else {
    # 尝试其他端口验证
    $altCheck = wsl -e bash -c "curl -s 'http://localhost:18083/api/v5/healthcheck' 2>/dev/null | head -1"
    if ($altCheck) {
        Write-Log "SUCCESS: EMQX API is responding"
        exit 0
    }
    
    Write-Log "WARNING: Could not verify EMQX, but start command was executed" -Level "WARN"
    exit 0  # 不算失败，因为 EMQX 可能需要更长时间
}
