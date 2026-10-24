@echo off
rem ===========================================================================
rem  Start ONLY the LLM / Harness / Agent study site (this folder).
rem  Usage: double-click this file.  URL: http://127.0.0.1:8127/index.html
rem  For all five sites at once, use the start-all.cmd in the parent folder.
rem  NOTE: intentionally 100%% ASCII (see parent README).
rem ===========================================================================
setlocal
set "PORT=8127"
cd /d "%~dp0"

echo ============================================================
echo   LLM / Harness / Agent study site
echo   http://127.0.0.1:%PORT%/index.html
echo   Phone / tablet on the same WiFi: see the LAN URL printed below.
echo   Close this window to stop the server.
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel%==0 goto use_node

where python >nul 2>nul
if %errorlevel%==0 goto use_python

goto open_file

:use_node
start "" "http://127.0.0.1:%PORT%/index.html"
node "tools\serve.mjs" %PORT% --lan
goto done

:use_python
start "" "http://127.0.0.1:%PORT%/index.html"
python -m http.server %PORT%
goto done

:open_file
echo [INFO] Neither node nor python was found.
echo [INFO] Opening index.html directly - all features work the same.
start "" "%~dp0index.html"

:done
echo.
echo Server stopped. Press any key to close this window.
pause >nul
