@echo off
setlocal
title YT Downloader - Background Service Setup
cd /d "%~dp0"

echo ==================================================
echo   YT Downloader - background Service Setup
echo ==================================================
echo.
:: Unblock files to prevent security warnings
powershell -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File" >nul 2>&1
echo This script will register the YT Downloader Server to run
echo automatically in the background when you log in.
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    set NODE_CMD=node
) else (
    if exist "C:\Program Files\nodejs\node.exe" (
        set NODE_CMD="C:\Program Files\nodejs\node.exe"
    ) else (
        echo [ERROR] Node.js not found. Please install it first.
        pause
        exit /b
    )
)

:: Get absolute path to server.js
set SERVER_JS=%~dp0server.js

:: Create a VBScript to run the batch hidden
echo Set WshShell = CreateObject("WScript.Shell") > "%temp%\run_hidden.vbs"
echo strDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) >> "%temp%\run_hidden.vbs"
echo WshShell.Run chr(34) ^& strDir ^& "\start_server.bat" ^& chr(34), 0 >> "%temp%\run_hidden.vbs"
echo Set WshShell = Nothing >> "%temp%\run_hidden.vbs"

:: Move VBScript to project folder
move /y "%temp%\run_hidden.vbs" "%~dp0run_server_hidden.vbs" >nul

:: Create Task Scheduler entry
echo [1/2] Creating Task Scheduler entry...
schtasks /create /tn "YTDownloaderServer" /tr "wscript.exe \"%~dp0run_server_hidden.vbs\"" /sc onlogon /f /rl limited

if %errorlevel% equ 0 (
    echo.
    echo [2/2] Success! The server will now run in the background.
    echo Starting it now...
    schtasks /run /tn "YTDownloaderServer"
    echo.
    echo ==================================================
    echo SETUP COMPLETE!
    echo Your extension is now ready to use permanently.
    echo ==================================================
) else (
    echo.
    echo [ERROR] Failed to create scheduled task. 
    echo Please try running this script as Administrator.
)

pause
