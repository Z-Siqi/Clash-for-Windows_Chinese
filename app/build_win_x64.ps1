$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
& npm --prefix $repoRoot run package:win-x64
if ($LASTEXITCODE -ne 0) { throw 'Windows x64 packaging failed.' }
