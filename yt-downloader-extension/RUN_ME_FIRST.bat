@echo off
setlocal
title YT Downloader - Auto Setup

echo ==================================================
echo   YT Downloader - One-Click Setup
echo ==================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set NODE_EXE="C:\Program Files\nodejs\node.exe"
    ) else (
        echo [ERROR] Node.js not found.
        echo Please install Node.js from https://nodejs.org/
        pause
        exit /b
    )
) else (
    set NODE_EXE=node
)

echo [1/2] Node.js found.
echo [2/2] Starting server and checking dependencies...
echo.

%NODE_EXE% server.js
pause
