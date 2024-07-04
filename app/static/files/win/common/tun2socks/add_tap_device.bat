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
:: See https://ss64.com/nt/delayedexpansion.html
setlocal enabledelayedexpansion

set DEVICE_NAME=cfw-tap
set DEVICE_HWID=tap0901

set SCRIPT_DIR=%~dp0
set ARCH=%1
set IP=%2
set SUBNET=%3
set GATEWAY=%4

:: Error codes for surfacing to the user and sentry.
set ERROR_TAP_INSTALL=1
set ERROR_TAP_FIND_NAME=2
set ERROR_TAP_RENAME=3
set ERROR_TAP_CONFIGURE_SUBNET=4
set ERROR_TAP_CONFIGURE_DNS=5

:: Because we've seen multiple failures due to commands (netsh, etc.) not being
:: found, append some common directories to the PATH.
::
:: Note:
::  - %SystemRoot% almost always expands to c:\windows.
::  - Do *not* surround with quotes.
set PATH=%PATH%;%SystemRoot%\system32;%SystemRoot%\system32\wbem;%SystemRoot%\system32\WindowsPowerShell/v1.0

:: Check whether the device already exists.
netsh interface show interface name=%DEVICE_NAME%
if %errorlevel% equ 0 (
  echo TAP network device already exists.
  goto :configure
)

echo Creating TAP network device...
"%SCRIPT_DIR%\%ARCH%\tapinstall" install "%SCRIPT_DIR%\%ARCH%\OemVista.inf" %DEVICE_HWID%
if %errorlevel% neq 0 (
  echo Could not create TAP network device. Try to do it manually. >&2
  REM exit /b %ERROR_TAP_INSTALL%
  start /wait /D "%SCRIPT_DIR%" tap-windows-installer.exe
)

:: Find the name of the most recently installed TAP device in the registry and rename it.
echo Searching for new TAP network device name...
call "%SCRIPT_DIR%\find_tap_device_name.bat" TAP_NAME
if %errorlevel% neq 0 (
  echo Could not find TAP device name. >&2
  exit /b %ERROR_TAP_FIND_NAME%
)
echo Found TAP device name: "%TAP_NAME%"

:: We've occasionally seen delays before netsh will "see" the new device, at least for
:: purposes of configuring IP and DNS ("netsh interface show interface name=xxx" does not
:: seem to be affected).
call :wait_for_device "%TAP_NAME%"

:: Attempt to rename the device even if waiting timed out.
netsh interface set interface name="%TAP_NAME%" newname="%DEVICE_NAME%"
if %errorlevel% neq 0 (
  :: Try to rename the device through powershell in case netsh failed due to not being able to "see"
  :: the device. Pipe input from /dev/null to prevent powershell from waiting forever on EOF.
  powershell "Rename-NetAdapter -Name \"%TAP_NAME%\" -NewName \"%DEVICE_NAME%\"" <nul
  :: Note that we use delayed variable expansion inside a control block to check errorlevel.
  if !errorlevel! neq 0 (
    echo Could not rename TAP device. >&2
    exit /b %ERROR_TAP_RENAME%
  )
)

:: Wait for the new name to propagate to netsh.
call :wait_for_device "%DEVICE_NAME%"

:: Attempt to configure the device even if waiting timed out.
:configure

:: Try to enable the device, in case it's somehow been disabled.
::
:: Annoyingly, this returns an error and outputs a confusing message if the device exists and is
:: already enabled:
::   This network connection does not exist.
::
:: So, continue even if this command fails - and always include its output.
echo (Re-)enabling TAP network device...
netsh interface set interface "%DEVICE_NAME%" admin=enabled
:: The powershell command is used to ensure the adapter is enabled if netsh fails and leaves it in
:: a disabled state. While no such failure has yet been observed, this command would correct it and
:: should behave idempotently otherwise.
powershell "Enable-NetAdapter -Name \"%DEVICE_NAME%\"" <nul

:: Give the device an IP address.
:: 10.0.85.x is a guess which we hope will work for most users (Docker for
:: Windows uses 10.0.75.x by default): if the address is already in use the
:: script will fail and the installer will show an error message to the user.
:: TODO: Actually search the system for an unused subnet or make the subnet
::       configurable in the Outline client.
echo Configuring TAP device subnet...
netsh interface ip set address %DEVICE_NAME% static %IP% %SUBNET% %GATEWAY%
if %errorlevel% neq 0 (
  echo Could not set TAP network device subnet. >&2
  exit /b %ERROR_TAP_CONFIGURE_SUBNET%
)

:: Windows has no system-wide DNS server; each network device can have its
:: "own" set of DNS servers. Windows seems to use the DNS server(s) of the
:: network device associated with the default gateway. This is good for us
:: as it means we do not have to modify the DNS settings of any other network
:: device in the system. Configure with OpenDNS and Dyn resolvers.
echo Configuring primary DNS...
netsh interface ip set dnsservers %DEVICE_NAME% static address=%IP%
if %errorlevel% neq 0 (
  echo Could not configure TAP device primary DNS. >&2
  exit /b %ERROR_TAP_CONFIGURE_DNS%
)
echo Setting interface metric (1) for this interface...
powershell "Set-NetIPInterface -InterfaceAlias \"%DEVICE_NAME%\" -InterfaceMetric 1" <nul
if %errorlevel% neq 0 (
  echo Could not set interface metric. >&2
  exit /b 1
)
echo TAP network device added and configured successfully
exit /b 0

:: Waits up to a minute until a device is visible to netsh. Accepts the device name as a parameter.
:: Exits with a non-zero code if the operation times out.
:wait_for_device
echo Testing that the network device "%~1" is visible to netsh...
netsh interface ip show interfaces | find "%~1" >nul 2>&1
if %errorlevel% equ 0 exit /b 0
for /l %%N in (1, 1, 6) do (
  echo Waiting... %%N
  :: timeout doesn't like the environment created by nsExec::ExecToStack and exits with:
  :: "ERROR: Input redirection is not supported, exiting the process immediately."
  waitfor /t 10 thisisnotarealsignalname >nul 2>&1
  netsh interface ip show interfaces | find "%~1" >nul 2>&1
  if !errorlevel! equ 0 exit /b 0
)
exit /b 1
