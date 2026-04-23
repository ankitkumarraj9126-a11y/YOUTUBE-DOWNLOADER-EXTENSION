@echo off
setlocal
title YT Downloader - Auto Setup
cd /d "%~dp0"

echo ==================================================
echo   YT Downloader - One-Click Setup
echo ==================================================
echo.
:: Unblock files to prevent security warnings
powershell -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File" >nul 2>&1

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
echo [2/2] Launching server...
echo.
echo TIP: Run 'install_background_service.bat' to make the 
echo server run automatically in the background!
echo.

%NODE_EXE% server.js
pause
