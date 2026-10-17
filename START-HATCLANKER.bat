@echo off
title Fanbot Hatclanker
cd /d "%~dp0"
if not exist ".env" (
  echo Missing .env file.
  echo Copy .env.example to .env and add your Discord details first.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Installing Hatclanker dependencies...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)
echo Starting Hatclanker...
call npm.cmd start
pause
