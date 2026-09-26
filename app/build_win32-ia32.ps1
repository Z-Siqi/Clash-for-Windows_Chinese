$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
& npm --prefix $repoRoot run package:win-ia32
if ($LASTEXITCODE -ne 0) { throw 'Windows x86 packaging failed.' }
