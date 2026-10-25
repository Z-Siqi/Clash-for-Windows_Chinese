param(
    [ValidateSet('Acquire','Release')][string]$Action = 'Acquire',
    [ValidateRange(1,2147483647)][int]$InterfaceIndex = 1,
    [ValidateRange(0,65535)][int]$OriginalMetric = 256,
    [ValidateRange(0,65535)][int]$AppliedMetric = 4096
)
$ErrorActionPreference = 'Stop'
if ($Action -eq 'Acquire') {
    $route = Get-NetRoute -AddressFamily IPv4 -InterfaceAlias 'cfw-tap' -DestinationPrefix '224.0.0.0/4' -PolicyStore ActiveStore | Where-Object { $_.NextHop -eq '0.0.0.0' } | Select-Object -First 1
    if ($null -eq $route) { throw 'TAP multicast route is unavailable' }
    # Copy scalars before Set-NetRoute refreshes its mutable CIM instance.
    $OriginalMetric = [int]$route.RouteMetric
    $AppliedMetric = [Math]::Max(4096, $OriginalMetric)
    $lease = @{ interfaceIndex=[int]$route.InterfaceIndex; originalMetric=$OriginalMetric; appliedMetric=$AppliedMetric; changed=($OriginalMetric -ne $AppliedMetric) }
    # Emit rollback information before the mutation, including on timeout/error.
    [Console]::Out.WriteLine(($lease | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
    if ($lease.changed) { $route | Set-NetRoute -RouteMetric $AppliedMetric -Confirm:$false }
} else {
    # Do not restore a reused interface index or overwrite a subsequent user edit.
    $route = Get-NetRoute -AddressFamily IPv4 -InterfaceIndex $InterfaceIndex -InterfaceAlias 'cfw-tap' -DestinationPrefix '224.0.0.0/4' -PolicyStore ActiveStore -ErrorAction SilentlyContinue | Where-Object { $_.NextHop -eq '0.0.0.0' } | Select-Object -First 1
    if ($null -ne $route -and [int]$route.RouteMetric -eq $AppliedMetric) { $route | Set-NetRoute -RouteMetric $OriginalMetric -Confirm:$false }
}
