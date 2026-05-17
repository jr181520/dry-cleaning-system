@echo off
echo Restarting Docker Desktop...
taskkill /F /IM \"Docker Desktop.exe\" 2>nul
timeout /t 3 /nobreak >nul
start \"\" \"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe\"
echo Waiting for Docker to start...
timeout /t 15 /nobreak >nul
echo Done. Docker should be running now.
pause
