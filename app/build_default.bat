@echo off
setlocal EnableExtensions

cd /d "%~dp0"
if errorlevel 1 (
    echo ERROR: Could not open the application build directory.
    set "BUILD_EXIT_CODE=1"
    goto :finish
)

where node.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js 18 or newer is required but was not found in PATH.
    set "BUILD_EXIT_CODE=1"
    goto :finish
)

set "NODE_MAJOR="
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
    echo ERROR: Could not determine the installed Node.js version.
    set "BUILD_EXIT_CODE=1"
    goto :finish
)
if %NODE_MAJOR% LSS 18 (
    echo ERROR: Node.js 18 or newer is required.
    node --version
    set "BUILD_EXIT_CODE=1"
    goto :finish
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found in PATH.
    set "BUILD_EXIT_CODE=1"
    goto :finish
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: Windows PowerShell was not found in PATH.
    set "BUILD_EXIT_CODE=1"
    goto :finish
)

set "HOST_ARCH=%PROCESSOR_ARCHITEW6432%"
if not defined HOST_ARCH set "HOST_ARCH=%PROCESSOR_ARCHITECTURE%"

if /I "%HOST_ARCH%"=="AMD64" goto :select_x64
if /I "%HOST_ARCH%"=="x86" goto :select_x86
if /I "%HOST_ARCH%"=="ARM64" goto :select_arm64

echo ERROR: Unsupported Windows architecture: %HOST_ARCH%
echo Supported architectures: AMD64, x86, ARM64.
set "BUILD_EXIT_CODE=1"
goto :finish

:select_x64
set "BUILD_TARGET=win-x64"
set "BUILD_SCRIPT=build_win_x64.ps1"
goto :build

:select_x86
set "BUILD_TARGET=win-ia32"
set "BUILD_SCRIPT=build_win32-ia32.ps1"
goto :build

:select_arm64
set "BUILD_TARGET=win-arm64"
set "BUILD_SCRIPT=build_win32_arm64.ps1"
goto :build

:build
echo Detected Windows architecture: %HOST_ARCH%
echo Selected native build target: %BUILD_TARGET%
echo.

if /I "%CFW_BUILD_DETECT_ONLY%"=="1" (
    set "BUILD_EXIT_CODE=0"
    goto :finish
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0%BUILD_SCRIPT%" %*
set "BUILD_EXIT_CODE=%ERRORLEVEL%"
echo.
if "%BUILD_EXIT_CODE%"=="0" (
    echo Build completed successfully: %BUILD_TARGET%
) else (
    echo Build failed with exit code %BUILD_EXIT_CODE%: %BUILD_TARGET%
)

:finish
echo.
if /I not "%CFW_BUILD_NO_PAUSE%"=="1" pause
exit /b %BUILD_EXIT_CODE%
