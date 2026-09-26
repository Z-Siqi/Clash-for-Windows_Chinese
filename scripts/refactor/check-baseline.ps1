$ErrorActionPreference = 'Stop'

# Compatibility wrapper for existing Windows workflows. The canonical test
# command is cross-platform and lives in the repository root package.json.
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Push-Location $repoRoot
try {
    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "npm test failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
