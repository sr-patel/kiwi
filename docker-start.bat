@echo off
setlocal

echo.
echo  Kiwi Photo Library
echo  ==================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo  Docker is not installed or not in your PATH.
  echo  Install Docker from https://docs.docker.com/get-docker/
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo  Docker is not running.
  echo  Start the Docker service, then run this script again.
  pause
  exit /b 1
)

if not exist config.json (
  if exist config.example.json (
    echo  Creating config.json from config.example.json...
    copy config.example.json config.json >nul
  ) else (
    echo  config.json not found. Copy config.example.json to config.json first.
    pause
    exit /b 1
  )
)

echo  Starting Kiwi containers...
docker compose up -d --build
if errorlevel 1 (
  echo  Failed to start containers.
  pause
  exit /b 1
)

echo.
echo  Kiwi is starting.
echo  Open your browser at:  http://localhost:3000
echo.
echo  First time? Follow the setup wizard to select your Eagle library.
echo.

timeout /t 3 >nul
start http://localhost:3000

pause
