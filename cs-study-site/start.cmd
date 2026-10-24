@echo off
rem ===========================================================================
rem  Computer Science study site - packaged edition
rem    URL: http://127.0.0.1:8123/cs/index.html
rem  Serves THIS folder as the web root, so /cs/... resolves correctly.
rem  Falls back to opening cs\index.html directly if node/python are missing.
rem  NOTE: intentionally 100%% ASCII (cmd.exe parses .cmd byte by byte, and
rem  non-ASCII text inside blocks can break parsing). Chinese docs: README.md
rem ===========================================================================
setlocal
set "PORT=8123"
cd /d "%~dp0"

echo ============================================================
echo   Computer Science study site
echo   http://127.0.0.1:%PORT%/cs/index.html
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
start "" "http://127.0.0.1:%PORT%/cs/index.html"
node "cs\tools\serve.mjs" %PORT% --root . --lan
goto done

:use_python
start "" "http://127.0.0.1:%PORT%/cs/index.html"
python -m http.server %PORT%
goto done

:open_file
echo [INFO] Neither node nor python was found.
echo [INFO] Opening cs\index.html directly - all features work the same.
start "" "%~dp0cs\index.html"

:done
echo.
echo Server stopped. Press any key to close this window.
pause >nul
