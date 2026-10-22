param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9.]+$')][string]$IP,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9.]+$')][string]$Subnet,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9.]+$')][string]$Gateway
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\tap_device_state.ps1"
Get-CfwTapState $IP $Subnet $Gateway | ConvertTo-Json -Compress
