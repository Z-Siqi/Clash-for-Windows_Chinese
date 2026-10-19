param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^v?\d+\.\d+\.\d+$')]
    [string]$Version
)

$ErrorActionPreference = "Stop"
# Keep the historical Windows entry point; the cross-platform resolver owns updates.
& node (Join-Path $PSScriptRoot "../scripts/build/mihomo.js") update $Version
exit $LASTEXITCODE
