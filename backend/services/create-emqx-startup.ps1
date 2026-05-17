$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut("C:\Users\zh\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\EMQX_Broker.lnk")
$shortcut.TargetPath = "D:\Trae CN\bin\dry_cleaning_system\backend\services\emqx-startup.bat"
$shortcut.WorkingDirectory = "D:\Trae CN\bin\dry_cleaning_system\backend\services"
$shortcut.Description = "EMQX MQTT Broker"
$shortcut.Save()
Write-Host "EMQX 开机启动快捷方式已创建"
