@echo off
echo.
echo  Kiwi Photo Library (Developer mode)
echo  ===================================
echo.
echo  This starts Kiwi without Docker — for developers only.
echo  Most users should use docker-start.bat instead.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Installing frontend dependencies...
  call npm install
)

if not exist server\node_modules (
  echo  Installing server dependencies...
  cd server && call npm install && cd ..
)

call npm start
pause
