@echo off
cd /d "%~dp0"
echo Starting Nippon Vahan dashboard updater...
echo.
echo Clearing any previous updater on port 3099...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3099 .*LISTENING"') do (
  echo Stopping updater process %%P...
  taskkill /PID %%P /T /F >nul 2>nul
)
where git >nul 2>nul || (
  echo Git is required. Install Git, then run this file again.
  pause
  exit /b 1
)
where node >nul 2>nul || (
  echo Node.js is required. Install Node.js 20, then run this file again.
  pause
  exit /b 1
)
where python >nul 2>nul || (
  echo Python 3.11 is required. Install Python, then run this file again.
  pause
  exit /b 1
)
echo Updating this repo to the latest GitHub version...
git pull --ff-only origin master
if errorlevel 1 (
  echo Git pull failed. Make sure this folder is the GitHub repo and has no local uncommitted edits.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dashboard helper packages...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo Installing Python automation packages...
python -m pip install -r automation\requirements.txt
if errorlevel 1 (
  echo Python package install failed.
  pause
  exit /b 1
)
echo Installing Playwright browser...
set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=300000
set PLAYWRIGHT_INSTALL_ATTEMPT=0
:install_playwright_browser
set /a PLAYWRIGHT_INSTALL_ATTEMPT+=1
echo Playwright browser install attempt %PLAYWRIGHT_INSTALL_ATTEMPT% of 3...
python -m playwright install chromium
if errorlevel 1 (
  if %PLAYWRIGHT_INSTALL_ATTEMPT% LSS 3 (
    echo Playwright browser download failed or timed out. Retrying in 10 seconds...
    timeout /t 10 /nobreak >nul
    goto install_playwright_browser
  )
  echo Playwright browser install failed after 3 attempts.
  echo Checking for installed Chrome or Edge as a fallback...
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set PLAYWRIGHT_BROWSER_CHANNEL=chrome
    echo Using installed Google Chrome for the updater.
  ) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set PLAYWRIGHT_BROWSER_CHANNEL=chrome
    echo Using installed Google Chrome for the updater.
  ) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set PLAYWRIGHT_BROWSER_CHANNEL=msedge
    echo Using installed Microsoft Edge for the updater.
  ) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set PLAYWRIGHT_BROWSER_CHANNEL=msedge
    echo Using installed Microsoft Edge for the updater.
  ) else (
    echo No installed Chrome or Edge fallback was found.
    echo Check the internet connection, VPN/proxy, or firewall access to https://cdn.playwright.dev/
    pause
    exit /b 1
  )
)
echo.
echo Updater is ready.
echo Keep this window open, then open:
echo https://performance-dashboard-kvj8.onrender.com/
echo and click Update data.
echo.
node local_updater.js
pause
