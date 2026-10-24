@echo off
rem ===========================================================================
rem  Start the Philosophy study site.
rem    - With Node.js: serves it over HTTP on port 8126 and also listens on the
rem      LAN, so a phone/tablet on the SAME WiFi can open it (the LAN address is
rem      printed in this window). Progress is shared between phone and PC.
rem    - Without Node.js: falls back to opening the file directly (local only).
rem  NOTE: intentionally 100%% ASCII. cmd.exe parses .cmd files byte by byte and
rem  multi-byte text (UTF-8 without BOM) shifts the parser, which silently eats
rem  the following line -- an independent audit caught exactly that here: the
rem  Chinese echo lines swallowed the "start" line, so double-clicking this file
rem  opened nothing and printed four "not recognized as a command" errors.
rem  Chinese docs live in philosophy\README.md.
rem ===========================================================================
setlocal
set "PORT=8126"
title Philosophy study site
cd /d "%~dp0"

echo.
echo   ============================================
echo     Philosophy undergraduate study site
echo   ============================================
echo.

if not exist "index.html" (
  echo   [!] index.html not found - rebuilding...
  node tools\build.mjs
  echo.
)

where node >nul 2>nul
if %errorlevel%==0 goto use_node

echo   [INFO] Node.js not found - opening the page directly (this PC only,
echo          no phone access).
echo.
start "" "index.html"
goto done

:use_node
echo   Local browser : http://127.0.0.1:%PORT%/index.html
echo   Phone / tablet: see the LAN address printed below
echo                   (same WiFi required)
echo.
start "" "http://127.0.0.1:%PORT%/index.html"
node "tools\serve.mjs" %PORT% --lan
goto done

:done
echo.
echo   Server stopped. Press any key to close this window.
pause >nul
