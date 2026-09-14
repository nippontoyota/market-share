@echo off
set TASK_NAME=Nippon Toyota Vahan Dashboard Refresh
set SCRIPT_PATH=%~dp0Run_Full_Automation.bat

schtasks /Create /F /TN "%TASK_NAME% - 10th" /SC MONTHLY /D 10 /ST 09:00 /TR "\"%SCRIPT_PATH%\""
schtasks /Create /F /TN "%TASK_NAME% - 25th" /SC MONTHLY /D 25 /ST 09:00 /TR "\"%SCRIPT_PATH%\""

echo Scheduled Vahan dashboard refresh on the 10th and 25th of every month at 09:00.
pause
