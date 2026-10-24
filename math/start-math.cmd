@echo off
rem ===========================================================================
rem  Start the offline MATH study site in a local browser.
rem  NOTE: intentionally 100%% ASCII (cmd.exe parses .cmd byte by byte and
rem  non-ASCII text can break parsing). Chinese instructions: math\README.md
rem ===========================================================================
setlocal
set "PORT=8124"
cd /d "%~dp0"

echo ============================================================
echo   Basic Mathematics - undergraduate study site
echo   Local server: http://127.0.0.1:%PORT%/
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
