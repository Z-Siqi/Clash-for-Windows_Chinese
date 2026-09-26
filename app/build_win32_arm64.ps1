$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
& npm --prefix $repoRoot run package:win-arm64
if ($LASTEXITCODE -ne 0) { throw 'Windows ARM64 packaging failed.' }
