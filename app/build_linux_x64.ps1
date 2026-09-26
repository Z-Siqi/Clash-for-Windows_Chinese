$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
& npm --prefix $repoRoot run package:linux-x64
if ($LASTEXITCODE -ne 0) { throw 'Linux x64 packaging failed.' }
