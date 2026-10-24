@echo off
rem ===========================================================================
rem  Start ALL FIVE study sites at once, each on its own port:
rem    CS         : http://127.0.0.1:8123/index.html
rem    Math       : http://127.0.0.1:8124/index.html
rem    Physics    : http://127.0.0.1:8125/index.html
rem    Philosophy : http://127.0.0.1:8126/index.html
rem    LLM/AI     : http://127.0.0.1:8127/index.html
rem  The launcher also prints the LAN addresses, so a phone/tablet on the SAME
rem  WiFi can open every site (progress is then shared between phone and PC).
rem  NOTE: intentionally 100%% ASCII (cmd.exe parses .cmd byte by byte and
rem  non-ASCII text inside blocks can break parsing). Chinese docs: README.md
rem ===========================================================================
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Five study sites: CS + Math + Physics + Philosophy + AI
echo     CS         http://127.0.0.1:8123/index.html
echo     Math       http://127.0.0.1:8124/index.html
echo     Physics    http://127.0.0.1:8125/index.html
echo     Philosophy http://127.0.0.1:8126/index.html
echo     LLM/AI     http://127.0.0.1:8127/index.html
echo   Phone / tablet on the same WiFi: see the LAN URLs printed below.
echo   Close this window to stop all five servers.
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel%==0 goto use_node

echo [INFO] Node.js not found - opening the five sites directly from disk.
echo [INFO] Everything works the same; only phone access is unavailable.
echo.
start "" "%~dp0cs\index.html"
start "" "%~dp0math\index.html"
start "" "%~dp0physics\index.html"
start "" "%~dp0philosophy\index.html"
start "" "%~dp0llm\index.html"
goto done

:use_node
start "" "http://127.0.0.1:8123/index.html"
start "" "http://127.0.0.1:8124/index.html"
start "" "http://127.0.0.1:8125/index.html"
start "" "http://127.0.0.1:8126/index.html"
start "" "http://127.0.0.1:8127/index.html"
node "tools\serve-all.mjs" --lan
goto done

:done
echo.
echo All servers stopped. Press any key to close this window.
pause >nul
