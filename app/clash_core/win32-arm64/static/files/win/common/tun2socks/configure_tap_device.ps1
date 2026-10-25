param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9.]+$')][string]$IP,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9.]+$')][string]$Subnet,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9.]+$')][string]$Gateway,
    [switch]$Worker
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\tap_device_state.ps1"

if (-not $Worker) {
    if ((Get-CfwTapState $IP $Subnet $Gateway).configured) { exit 0 }
    # Driver installation/UAC is outside this deadline. Only post-install
    # adapter configuration is bounded; never terminate an active installer.
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = Join-Path $PSHOME 'powershell.exe'
    $startInfo.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -IP ' + $IP + ' -Subnet ' + $Subnet + ' -Gateway ' + $Gateway + ' -Worker'
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $workerProcess = [System.Diagnostics.Process]::Start($startInfo)
    $finished = $workerProcess.WaitForExit(8000)
    # Completion is the verified adapter state, not a notification timeout or
    # the exit code of a wizard/netsh process. Preserve a successful result even
    # if the worker is slow to exit after committing the requested settings.
    $configured = (Get-CfwTapState $IP $Subnet $Gateway).configured
    if (-not $finished) {
        # This is our own worker and its descendants, never another adapter's
        # installer or a process selected by its executable name.
        $killInfo = New-Object System.Diagnostics.ProcessStartInfo
        $killInfo.FileName = "$env:SystemRoot\System32\taskkill.exe"
        $killInfo.Arguments = '/F /T /PID ' + $workerProcess.Id
        $killInfo.UseShellExecute = $false
        $killInfo.CreateNoWindow = $true
        $killProcess = [System.Diagnostics.Process]::Start($killInfo)
        if (-not $killProcess.WaitForExit(500)) { $killProcess.Kill(); $workerProcess.Kill() }
        if ($configured) { Write-Output 'CFW_TAP_CONFIGURED'; exit 0 }
        Write-Output 'CFW_TAP_SETUP_TIMEOUT: driver may be installed; adapter configuration is not complete.'
        exit 10
    }
    if ($configured) { Write-Output 'CFW_TAP_CONFIGURED'; exit 0 }
    if ($workerProcess.ExitCode -eq 0) { exit 1 }
    exit $workerProcess.ExitCode
}

$deviceName = 'cfw-tap'
$classGuid = '{4D36E972-E325-11CE-BFC1-08002BE10318}'
$classKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey("SYSTEM\CurrentControlSet\Control\Class\$classGuid")
$adapters = @()
try {
    foreach ($keyName in $classKey.GetSubKeyNames()) {
        if ($keyName -notmatch '^\d{4}$') { continue }
        $adapterKey = $classKey.OpenSubKey($keyName)
        try {
            if ($adapterKey.GetValue('ComponentId') -ne 'tap0901') { continue }
            $id = $adapterKey.GetValue('NetCfgInstanceId')
            $connectionKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey("SYSTEM\CurrentControlSet\Control\Network\$classGuid\$id\Connection")
            if ($null -eq $connectionKey) { continue }
            try { $name = $connectionKey.GetValue('Name') } finally { $connectionKey.Close() }
            if ($name) { $adapters += [pscustomobject]@{ Name = $name; Stamp = $adapterKey.GetValue('InstallTimeStamp', 0); Key = $keyName } }
        } finally { $adapterKey.Close() }
    }
} finally { if ($classKey) { $classKey.Close() } }
$adapter = $adapters | Where-Object { $_.Name -eq $deviceName } | Select-Object -First 1
if ($null -eq $adapter) { $adapter = $adapters | Sort-Object Stamp, Key -Descending | Select-Object -First 1 }
if ($null -eq $adapter) { throw 'The installed TAP adapter could not be found.' }

$netsh = "$env:SystemRoot\System32\netsh.exe"
if ($adapter.Name -ne $deviceName) {
    # PnP may publish the registry entry before netsh sees the adapter. Retry
    # briefly; the parent enforces one deadline across all configuration steps.
    do {
        & $netsh interface set interface "name=$($adapter.Name)" "newname=$deviceName"
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Milliseconds 150
    } while ($true)
}
& $netsh interface set interface "name=$deviceName" admin=enabled
# netsh reports an error for an already enabled adapter; IP configuration below
# is authoritative and must succeed before the script can report success.
& $netsh interface ipv4 set address "name=$deviceName" source=static "address=$IP" "mask=$Subnet" "gateway=$Gateway"
if ($LASTEXITCODE -ne 0) { throw 'Could not configure the TAP address.' }
& $netsh interface ipv4 set dnsservers "name=$deviceName" source=static "address=$IP" validate=no
if ($LASTEXITCODE -ne 0) { throw 'Could not configure TAP DNS.' }
& $netsh interface ipv4 set interface "interface=$deviceName" metric=1
if ($LASTEXITCODE -ne 0) { throw 'Could not configure the TAP metric.' }
Write-Output 'TAP network device added and configured successfully.'
exit 0
