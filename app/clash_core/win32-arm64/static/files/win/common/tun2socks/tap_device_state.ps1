# Read only the fixed TAP adapter and its persisted IPv4 configuration. A TAP
# link is normally Disconnected until go-tun2socks opens it; that is not a failed
# driver installation. Registry values also survive PnP notification delays.
function Get-CfwTapState([string]$IP, [string]$Subnet, [string]$Gateway) {
    $adapter = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object { $_.Name -eq 'cfw-tap' } | Select-Object -First 1
    $result = [ordered]@{ exists = $false; configured = $false; interfaceIndex = 0 }
    if ($null -eq $adapter) { return [pscustomobject]$result }
    $id = ([guid]$adapter.Id).ToString('B')
    $classKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Class\{4D36E972-E325-11CE-BFC1-08002BE10318}')
    $driverMatches = $false
    try {
        foreach ($name in $classKey.GetSubKeyNames()) {
            if ($name -notmatch '^\d{4}$') { continue }
            $key = $classKey.OpenSubKey($name)
            try {
                if ($key.GetValue('NetCfgInstanceId') -eq $id -and $key.GetValue('ComponentId') -eq 'tap0901') { $driverMatches = $true; break }
            } finally { $key.Close() }
        }
    } finally { if ($classKey) { $classKey.Close() } }
    if (-not $driverMatches) { return [pscustomobject]$result }
    $result.exists = $true
    $result.interfaceIndex = $adapter.GetIPProperties().GetIPv4Properties().Index
    $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey("SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\$id")
    if ($null -eq $key) { return [pscustomobject]$result }
    try {
        $addresses = @($key.GetValue('IPAddress', @()))
        $masks = @($key.GetValue('SubnetMask', @()))
        $position = [array]::IndexOf($addresses, $IP)
        $dns = [string]$key.GetValue('NameServer', '') -split '[,;\s]+'
        $gateways = @($key.GetValue('DefaultGateway', @()))
        $result.configured = $position -ge 0 -and $masks.Count -gt $position -and $masks[$position] -eq $Subnet -and $dns -contains $IP -and $gateways -contains $Gateway -and $key.GetValue('InterfaceMetric', 0) -eq 1
    } finally { $key.Close() }
    return [pscustomobject]$result
}
