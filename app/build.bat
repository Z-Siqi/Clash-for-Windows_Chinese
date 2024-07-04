@echo off

echo Checking environment...

if not exist "%~dp0\static" (
    echo Failed! "\static\" folder not found!
    echo Press any key to exit
    pause>nul
    exit 1
)

if not exist "%~dp0\main" (
    echo Failed! "\main\" folder not found!
    echo Press any key to exit
    pause>nul
    exit 1
)

if not exist "%~dp0\logo.ico" (
    echo Failed! "\main\" folder not found!
    echo Press any key to exit
    pause>nul
    exit 1
)

where npm >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo npm is detected...
) else (
    echo Failed! No npm command!
    echo Install notejs might fix this.
    echo Press any key to exit
    pause>nul
    exit 1
)

where electron-packager >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo electron-packager is detected...
) else (
    echo Failed! No electron-packager command!
    echo But npm is detected!
    echo Press any key to install electron-packager or press "ctrl+C" to exit
    pause>nul
    npm install -g electron-packager
)

where asar >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo asar is detected...
) else (
    echo Failed! No asar command!
    echo But npm is detected!
    echo Press any key to install electron-packager or press "ctrl+C" to exit
    pause>nul
    npm install -g asar
)

echo Done!

if exist "%~dp0\output\Clash for Windows" (
    echo Detected old output!
    echo Press any key to delete and rebuild
    pause>nul
    rd /s /q "%~dp0\output\Clash for Windows\"
    echo Done!
)

if exist "%~dp0\output\Clash for Windows-win32-x64" (
    echo Detected wrong building files!
    echo Press any key to delete and continue
    pause>nul
    rd /s /q "%~dp0\output\Clash for Windows-win32-x64\"
    echo Done!
)

if not exist "%~dp0\output" (
    md "%~dp0\output"
)

start electron-packager "%~dp0\main" "Clash for Windows" --platform=win32 --arch=x64 --electron-version=29.4.3 --icon="%~dp0\logo.ico" --out="%~dp0\output"

echo Waiting app building...

echo Note:
echo If wait too long, it may mean that the execution has failed. Press "Ctrl+C" or close it directly to terminate the execution.

:waitloop
if exist "%~dp0\output\Clash for Windows-win32-x64" (
    echo Done! Adding proxy core files...
    timeout /t 1
    ren "%~dp0\output\Clash for Windows-win32-x64" "Clash for Windows"
    xcopy %~dp0\static\ "%~dp0\output\Clash for Windows\resources\static\" /E /Y
    echo Done!
    echo Waiting packing app asar...
    start asar pack "%~dp0\output\Clash for Windows\resources\app" "%~dp0\output\Clash for Windows\resources\app.asar"
    :waitpack
    if exist "%~dp0\output\Clash for Windows\resources\app.asar" (
	    echo Done! Delete old files...
        timeout /t 1
        rd /s /q "%~dp0\output\Clash for Windows\resources\app\"
        echo Finish!
        echo Press any key to exit
        pause>nul
        exit
    ) else (
        timeout /t 3 /nobreak
        goto waitpack
    )
) else (
    timeout /t 5 /nobreak
    goto waitloop
)
