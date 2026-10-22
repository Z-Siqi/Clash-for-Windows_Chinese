:: Copyright 2018 The Outline Authors
::
:: Licensed under the Apache License, Version 2.0 (the "License");
:: you may not use this file except in compliance with the License.
:: You may obtain a copy of the License at
::
::      http://www.apache.org/licenses/LICENSE-2.0
::
:: Unless required by applicable law or agreed to in writing, software
:: distributed under the License is distributed on an "AS IS" BASIS,
:: WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
:: See the License for the specific language governing permissions and
:: limitations under the License.

@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "ARCH=%1"
set "IP=%2"
set "SUBNET=%3"
set "GATEWAY=%4"
set "PATH=%PATH%;%SystemRoot%\system32;%SystemRoot%\system32\wbem;%SystemRoot%\system32\WindowsPowerShell\v1.0"

:: The host's bounded state reader chooses repair for an existing adapter.
:: Never run netsh or the silent driver tool before launching the wizard: either
:: can stall during PnP removal and prevent the installer from ever opening.
if not "%ARCH%"=="amd64" exit /b 1
if "%5"=="configure" goto configure
if not "%5"=="" exit /b 1
if not exist "%SCRIPT_DIR%tap-windows-installer.exe" exit /b 1
:: UAC and the interactive installer have no automatic deadline. Configuration
:: starts only after this owned installer exits, including reboot-required exits.
start "" /wait /D "%SCRIPT_DIR%" "%SCRIPT_DIR%tap-windows-installer.exe"
:: Some installer outcomes (for example reboot requested) are nonzero despite
:: installing the device. The configuration verifier decides the final result.

:configure
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%configure_tap_device.ps1" -IP %IP% -Subnet %SUBNET% -Gateway %GATEWAY%
exit /b %errorlevel%
