:: Copyright 2020 The Outline Authors
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

:: Queries the registry in order to retrieve the most recently installed TAP network adapter's name.
:: Accepts a single argument, the name of an environment variable to store the adapter's name.
:: Exits with a non-zero exit code on failure.
:: Usage example: find_tap_name.bat TAP_NAME

@echo off
:: See https://ss64.com/nt/delayedexpansion.html
setlocal enabledelayedexpansion

set NET_ADAPTERS_CLASS_GUID={4D36E972-E325-11CE-BFC1-08002BE10318}
set NET_ADAPTERS_KEY=HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Class\%NET_ADAPTERS_CLASS_GUID%
set NET_CONFIG_KEY=HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Network\%NET_ADAPTERS_CLASS_GUID%
set NET_ADAPTERS_FILE="%tmp%\netadapters.txt"

:: Find all network adapters that match the "tap0901" component ID and store their registry path in a file.
:: Note that adapter keys are increasing four-digit integers, padded with leading zeros.
reg query %NET_ADAPTERS_KEY% /s /f "tap0901" /e /d | findstr "HKEY.*\\[0-9][0-9][0-9][0-9]$" > %NET_ADAPTERS_FILE%
if %errorlevel% neq 0 (
  echo Could not find TAP network adapter in the registry. >&2
  exit /b 1
)

set TIMESTAMP=0
set NAME=
for /f "tokens=*" %%K in ('type "%NET_ADAPTERS_FILE%"') do (
  set ADAPTER_NAME=
  set ADAPTER_NET_CONFIG_ID=
  set ADAPTER_TIMESTAMP=

  :: Retrieve the adapter's network config ID.
  set ADAPTER_KEY=%%K
  for /f "tokens=3" %%I in ('reg query !ADAPTER_KEY! /v "NetCfgInstanceId"') do (
    set ADAPTER_NET_CONFIG_ID=%%I
  )

  :: Retrieve the adapter's install timestamp.
  for /f "tokens=3" %%T in ('reg query !ADAPTER_KEY! /v "InstallTimeStamp"') do (
    set ADAPTER_TIMESTAMP=%%T
  )

  :: Retrieve the adapter's name.
  set ADAPTER_CONFIG_KEY=!NET_CONFIG_KEY!\!ADAPTER_NET_CONFIG_ID!\Connection
  for /f "tokens=3*" %%N in ('reg query !ADAPTER_CONFIG_KEY! /v "Name"') do (
    :: If the name contains spaces our tokenization will store the rest of the name in %%O.
    if [%%O] == [] (
      set ADAPTER_NAME=%%N
    ) else (
      set ADAPTER_NAME=%%N %%O
    )
  )

  :: Ensure we found the adapter's install timestamp and name.
  if not [!ADAPTER_TIMESTAMP!] == [] (
    if not [!ADAPTER_NAME!] == [] (
      echo Found adapter "!ADAPTER_NAME!", !ADAPTER_TIMESTAMP!
      :: Store the adapter's name if it's the most recently installed one.
      if !ADAPTER_TIMESTAMP! gtr !TIMESTAMP! (
        set TIMESTAMP=!ADAPTER_TIMESTAMP!
        set NAME=!ADAPTER_NAME!
      )
    ) else (
      echo Failed to retrieve name of adapter !ADAPTER_KEY! >&2
    )
  ) else (
    echo Failed to retrieve install timestamp of adapter !ADAPTER_KEY! >&2
  )
)

if [!NAME!] == [] (
  echo Could not find TAP adapter name. >&2
  exit /b 1
)
echo TAP device name: "!NAME!"

endlocal & set "%1=%NAME%"
exit /b 0