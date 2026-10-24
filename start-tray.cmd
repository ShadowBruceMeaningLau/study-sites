@echo off
rem ===========================================================================
rem  start-tray.cmd -- fallback launcher for the tray app.
rem
rem  Prefer double-clicking start-tray.vbs: VBScript is launched by wscript.exe,
rem  so nothing flashes at all. This .cmd only exists for machines where
rem  VBScript is disabled; it shows a console window for a fraction of a second
rem  and then the tray takes over.
rem
rem  Intentionally 100%% ASCII (cmd.exe parses .cmd byte by byte; non-ASCII text
rem  inside blocks can break parsing -- same reason as start-all.cmd).
rem ===========================================================================
setlocal
cd /d "%~dp0"

set "PS1=%~dp0tools\tray.ps1"
if not exist "%PS1%" (
  echo [ERROR] tools\tray.ps1 not found. Is the folder complete?
  pause
  exit /b 1
)

where powershell >nul 2>nul
if not %errorlevel%==0 (
  echo [ERROR] Windows PowerShell not found.
  pause
  exit /b 1
)

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%PS1%" %*
exit /b 0
