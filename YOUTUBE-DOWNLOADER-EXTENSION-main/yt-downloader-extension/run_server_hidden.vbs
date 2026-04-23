Set WshShell = CreateObject("WScript.Shell") 
strDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) 
WshShell.Run chr(34) & strDir & "\start_server.bat" & chr(34), 0 
Set WshShell = Nothing 
