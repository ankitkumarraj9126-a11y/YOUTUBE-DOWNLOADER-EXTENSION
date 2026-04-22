@echo off
title YT Downloader Server
echo --------------------------------------------------
echo Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install it from https://nodejs.org/
    pause
    exit /b
)

echo Starting Local Server...
echo --------------------------------------------------
node server.js
pause
