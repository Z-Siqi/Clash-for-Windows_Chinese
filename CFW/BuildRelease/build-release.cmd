@echo off
setlocal
node "%~dp0build-release.js" %*
set "RELEASE_EXIT_CODE=%ERRORLEVEL%"
if not "%RELEASE_EXIT_CODE%"=="0" echo Release build failed with exit code %RELEASE_EXIT_CODE%.
exit /b %RELEASE_EXIT_CODE%
