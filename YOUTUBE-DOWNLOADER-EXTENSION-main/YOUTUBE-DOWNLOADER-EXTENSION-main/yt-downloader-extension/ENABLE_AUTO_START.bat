@echo off
setlocal
title YT Downloader - Enable Auto-Start
cd /d "%~dp0"

echo ==================================================
echo   YT Downloader - Enable Auto-Start
echo ==================================================
echo.
:: Unblock files to prevent security warnings
powershell -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File" >nul 2>&1
echo This script will make the server start automatically
echo in the background whenever you turn on your computer.
echo.

set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_FILE=%~dp0run_server_hidden.vbs

:: Recreate the VBS to ensure it is the latest, fixed version
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo strDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) >> "%VBS_FILE%"
echo WshShell.Run chr(34) ^& strDir ^& "\start_server.bat" ^& chr(34), 0 >> "%VBS_FILE%"
echo Set WshShell = Nothing >> "%VBS_FILE%"

:: Create a shortcut in the Startup folder using PowerShell
echo [1/1] Adding to Windows Startup...
powershell "$s=(New-Object -COM WScript.Shell).CreateShortcut('%STARTUP_FOLDER%\YTDownloader.lnk');$s.TargetPath='wscript.exe';$s.Arguments='\"%VBS_FILE%\"';$s.WorkingDirectory='%~dp0';$s.Save()"

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS! The server will now start automatically.
    echo No more terminal windows will pop up.
    echo.
    echo Starting the server now in background...
    start wscript.exe "%VBS_FILE%"
) else (
    echo.
    echo [ERROR] Failed to add to startup.
)

pause
