@echo off
cd /d "D:\Trae CN\bin\dry_cleaning_system"
timeout /t 5 /nobreak >nul
pm2 resurrect
exit
