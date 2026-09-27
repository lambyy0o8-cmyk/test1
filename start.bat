@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title ZeroScript Bridge
cd /d "%~dp0"

REM ====================================================================
REM  ZeroScript Bridge launcher - LamByy UI edition
REM  Backup of the original is start.bat.bak
REM  Plain ASCII only - no ANSI escapes (see start.bat.bak notes).
REM ====================================================================

if not exist "%~dp0logs" mkdir "%~dp0logs" >nul 2>nul
set "LOGFILE=%~dp0logs\start.log"
call :log "===== %DATE% %TIME%  start.bat launched ====="
for /f "tokens=*" %%v in ('ver') do set "WINVER=%%v"
call :log "%WINVER%"

REM --- Banner ----------------------------------------------------------------
call :banner

if not exist "%~dp0bridge.py" (
    call :status "FATAL" "bridge.py not found next to start.bat."
    echo.
    echo   If you opened start.bat from inside the downloaded ZIP, first EXTRACT
    echo   the whole ZIP ^(right-click, "Extract All..."^), then run start.bat
    echo   from the extracted folder.
    echo.
    call :log "FATAL: bridge.py missing next to start.bat (run from inside ZIP?)."
    pause
    exit /b 1
)

REM --- 1. Find Python --------------------------------------------------------
call :status "WAIT" "Looking for Python..."
set "PY="

where py >nul 2>nul && set "PY=py -3"
call :validate_py && goto :found

set "PY=python"
call :validate_py && goto :found

for %%R in (
    "%LOCALAPPDATA%\Programs\Python"
    "%ProgramFiles%"
    "%ProgramFiles(x86)%"
) do (
    if exist "%%~R" (
        for /f "delims=" %%D in ('dir /b /ad /o-n "%%~R\Python3*" 2^>nul') do (
            if exist "%%~R\%%D\python.exe" (
                set PY="%%~R\%%D\python.exe"
                call :validate_py && goto :found
            )
        )
    )
)

set "PY="
call :log "Python not found on PATH or in standard install folders."
goto :need_install

:found
for /f "tokens=*" %%v in ('call %PY% --version 2^>^&1') do set "PYVER=%%v"
call :status " OK " "%PYVER%"
call :log "Python found: %PY% (%PYVER%)"
goto :install_deps

:need_install
where winget >nul 2>nul
if errorlevel 1 (
    call :status "FATAL" "Python is not installed and winget is not available."
    echo.
    echo   Install Python manually: https://www.python.org/downloads/
    echo   IMPORTANT: tick "Add python.exe to PATH", then run start.bat again.
    echo.
    call :log "FATAL: no Python and no winget on this machine."
    pause
    exit /b 1
)
call :status "WAIT" "Installing Python via winget..."
winget install --id Python.Python.3.12 --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 call :log "winget install returned an error."
echo.
call :status "WAIT" "Checking again..."
set "PY=py -3"
call :validate_py && goto :ready
set "PY=python"
call :validate_py && goto :ready
for %%R in (
    "%LOCALAPPDATA%\Programs\Python"
    "%ProgramFiles%"
    "%ProgramFiles(x86)%"
) do (
    if exist "%%~R" (
        for /f "delims=" %%D in ('dir /b /ad /o-n "%%~R\Python3*" 2^>nul') do (
            if exist "%%~R\%%D\python.exe" (
                set PY="%%~R\%%D\python.exe"
                call :validate_py && goto :ready
            )
        )
    )
)
call :status "FATAL" "Python not found after install."
echo   Install manually: https://www.python.org/downloads/
call :log "FATAL: no usable Python found even after winget install."
pause
exit /b 1

:ready
for /f "tokens=*" %%v in ('call %PY% --version 2^>^&1') do set "PYVER=%%v"
call :status " OK " "%PYVER% (installed)"
call :log "Python ready after winget install: %PY%"

:install_deps
call :status "WAIT" "Checking websockets library..."
%PY% -c "import websockets" >nul 2>nul
if errorlevel 1 (
    call :status "WAIT" "Installing websockets - first time only..."
    %PY% -m pip install --user websockets
    if errorlevel 1 (
        call :status "FATAL" "Could not install websockets."
        echo   Common causes: no internet, firewall/antivirus, or broken pip.
        echo   If you used Microsoft Store python, install from python.org instead.
        call :log "FATAL: pip install websockets failed."
        pause
        exit /b 1
    )
)
call :status " OK " "websockets ready"
call :log "websockets library OK"

REM --- 3. Choose MCP server --------------------------------------------------
call :status "WAIT" "Select MCP server..."
call :pick_server_gui
call :log "User selected server: %ZS_SERVER_ARG%"

REM --- 4. Run the bridge -----------------------------------------------------
echo.
call :status "WAIT" "Starting bridge..."

REM --- Kill leftover zerolog window first (per Update Notes order) ---
set "ZS_OLDLOG="
for /f "tokens=2 delims=," %%p in ('tasklist /FI "IMAGENAME eq powershell.exe" /FO CSV /NH 2^>nul') do (
    wmic process where "ProcessId=%%~p" get CommandLine 2>nul | findstr /I "zerolog.ps1" >nul && set "ZS_OLDLOG=%%~p"
)
if defined ZS_OLDLOG (
    call :status "WARN" "Closing old AI activity window (pid !ZS_OLDLOG!)"
    call :log "Killing old zerolog window (pid !ZS_OLDLOG!)."
    taskkill /F /T /PID !ZS_OLDLOG! >nul 2>nul
    timeout /t 1 /nobreak >nul
)

set "OLDPID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :17613 ^| findstr LISTENING 2^>nul') do set "OLDPID=%%a"
if defined OLDPID (
    call :status "WARN" "Previous bridge (pid !OLDPID!) on port 17613 - replacing it."
    call :log "Killing previous bridge instance (pid !OLDPID!) on port 17613."
    taskkill /F /T /PID !OLDPID! >nul 2>nul
    timeout /t 1 /nobreak >nul
)

call :runbox "KEEP THIS WINDOW OPEN - DO NOT CLOSE IT" "ZeroScript stops working if you close it. Minimize instead."

echo.
call :status " OK " "Bridge starting on port 17613"
call :status "INFO" "Server: %ZS_SERVER_ARG%"
call :status "INFO" "Log:    logs\start.log"
call :status "INFO" "AI log: logs\ai_actions.log"
echo.

if exist "%~dp0zerolog.ps1" (
    where powershell >nul 2>nul
    if not errorlevel 1 (
        wscript "%~dp0zerolog_hidden.vbs"
        call :log "Opened AI activity window (zerolog.ps1)."
    )
)

call :log "Launching bridge.py with %PY% %ZS_SERVER_ARG%"
set "STARTTIME=%TIME%"
%PY% "%~dp0bridge.py" %ZS_SERVER_ARG%
set "BRIDGE_EXIT=%errorlevel%"
call :log "bridge.py exited with code %BRIDGE_EXIT%"

echo.
if not "%BRIDGE_EXIT%"=="0" (
    call :status "FAIL" "Bridge stopped with ERROR code %BRIDGE_EXIT%"
    echo   Scroll up for the Python error, or check logs\start.log
    echo   Include THIS WHOLE WINDOW in any bug report.
) else (
    call :status " OK " "Bridge stopped normally."
)
echo.
echo   Press any key to close.
pause >nul
exit /b 0

REM ====================================================================
REM  Subroutines
REM ====================================================================

:validate_py
%PY% -m pip --version >nul 2>nul || exit /b 1
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
exit /b %errorlevel%

:pick_server_gui
set "ZS_SERVER_ARG="
set "ZS_GUI_RC=0"
if not exist "%~dp0server_picker.ps1" goto :pick_server_gui_fallback
where powershell >nul 2>nul
if errorlevel 1 goto :pick_server_gui_fallback
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server_picker.ps1"
set "ZS_GUI_RC=%errorlevel%"
if "%ZS_GUI_RC%"=="1" (
    set "ZS_SERVER_ARG=--server=1"
    call :status " OK " "Selected: VS Code"
    exit /b 0
)
if "%ZS_GUI_RC%"=="2" (
    set "ZS_SERVER_ARG=--server=2"
    call :status " OK " "Selected: Roblox Studio"
    exit /b 0
)
if "%ZS_GUI_RC%"=="3" (
    set "ZS_SERVER_ARG=--server=3"
    call :status " OK " "Selected: Both"
    exit /b 0
)
:pick_server_gui_fallback
call :pick_server
exit /b 0

:pick_server
set "ZS_SERVER_ARG="
set "ZS_PICK="
echo.
call :print_box
set /p "ZS_PICK=   > "
set "ZS_PICK=%ZS_PICK: =%"
if "%ZS_PICK%"=="1" (
    set "ZS_SERVER_ARG=--server=1"
    call :pick_ok "VS Code"
) else if "%ZS_PICK%"=="2" (
    set "ZS_SERVER_ARG=--server=2"
    call :pick_ok "Roblox Studio"
) else if "%ZS_PICK%"=="3" (
    set "ZS_SERVER_ARG=--server=3"
    call :pick_ok "Both"
) else (
    set "ZS_SERVER_ARG=--server=2"
    call :pick_default
)
exit /b 0

:pick_ok
echo   ^>^> %~1
exit /b 0

:pick_default
echo   ^>^> Defaulting to Roblox Studio
exit /b 0

:print_box
echo.
echo   +--------------------------------------+
echo   ^|  1  VS Code                          ^|
echo   ^|  2  Roblox Studio                    ^|
echo   ^|  3  Both                             ^|
echo   +--------------------------------------+
exit /b 0

:banner
echo.
echo   ╭────────────────────────────────────╮
echo   │  ZeroScript Bridge  ·  Local Launcher
echo   │  Roblox Studio / VS Code AI Agent
echo   ╰────────────────────────────────────╯
echo.
exit /b 0

:status
REM %~1 = tag (OK/WAIT/WARN/FAIL/FATAL/INFO), %~2 = message
set "TAG=%~1"
if "%TAG%"==" OK " set "SYM=✔"
if "%TAG%"=="WAIT" set "SYM=·"
if "%TAG%"=="WARN" set "SYM=⚠"
if "%TAG%"=="FAIL" set "SYM=✘"
if "%TAG%"=="FATAL" set "SYM=✘"
if "%TAG%"=="INFO" set "SYM=ℹ"
echo   %SYM%  %~2
exit /b 0

:runbox
echo.
echo   ┌────────────────────────────────────┐
echo   │  %~1
echo   │  %~2
echo   └────────────────────────────────────┘
exit /b 0

:log
>>"%LOGFILE%" 2>nul echo(%~1
exit /b 0
