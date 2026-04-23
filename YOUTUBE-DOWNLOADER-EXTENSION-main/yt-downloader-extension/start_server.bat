@echo off
setlocal
title YT Downloader Server
cd /d "%~dp0"

echo --------------------------------------------------
echo 🚀 YT Downloader - Starting Local Server
echo --------------------------------------------------

:: Check for Node.js in PATH first
where node >nul 2>nul
if %errorlevel% equ 0 (
    set NODE_CMD=node
) else (
    :: Fallback to default install path
    if exist "C:\Program Files\nodejs\node.exe" (
        set NODE_CMD="C:\Program Files\nodejs\node.exe"
    ) else (
        echo [ERROR] Node.js is not installed or not in PATH.
        echo Please install it from https://nodejs.org/
        pause
        exit /b
    )
)

%NODE_CMD% server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server crashed or failed to start.
    pause
)
