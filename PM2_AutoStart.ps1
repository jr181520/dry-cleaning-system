# PM2 Auto Start Script
# Delays 5 seconds to ensure system is ready
Start-Sleep -Seconds 5

# Switch to project directory
Set-Location "D:\Trae CN\bin\dry_cleaning_system"

# Execute PM2 resurrect
Write-Host "[PM2] Starting to restore processes..."
& pm2 resurrect

# Verify results
Start-Sleep -Seconds 2
& pm2 list

Write-Host "[DONE] PM2 auto start completed!"
