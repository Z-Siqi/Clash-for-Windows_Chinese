$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
& npm --prefix $repoRoot run package:linux-arm64
if ($LASTEXITCODE -ne 0) { throw 'Linux ARM64 packaging failed.' }
