# Read-only baseline verification for the packaged Electron app.

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$appMainDir = Join-Path $repoRoot 'app\main'
$distDir = Join-Path $appMainDir 'dist\electron'
$packageJsonPath = Join-Path $appMainDir 'package.json'
$indexHtmlPath = Join-Path $distDir 'index.html'
$mainJsPath = Join-Path $distDir 'main.js'
$rendererJsPath = Join-Path $distDir 'renderer.js'

$expectedMainHash = 'AC7AEAB113BD96F831C5A8CC3819A2EB95211F1C2289C3D3A520FDB66672B25F'
$expectedRendererHash = '7FAA84516CDD9FC313B254C3DEE72294FE6EDA8921F73044FFE2BBEFD3D0D02B'
$expectedPackageMain = './dist/electron/main.js'

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $script:failures.Add($Message) | Out-Null
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Add-Pass {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Test-RequiredFile {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        Add-Pass "Found file: $Path"
    } else {
        Add-Failure "Missing file: $Path"
    }
}

Write-Host "Checking Electron refactor baseline..."
Write-Host "Root: $repoRoot"

$requiredFiles = @(
    $indexHtmlPath,
    $mainJsPath,
    $rendererJsPath,
    (Join-Path $distDir 'renderer.js.LICENSE.txt'),
    (Join-Path $distDir '287.js'),
    (Join-Path $distDir '295.js'),
    (Join-Path $distDir '585.js'),
    (Join-Path $distDir 'editor.worker.js')
)

foreach ($file in $requiredFiles) {
    Test-RequiredFile -Path $file
}

if (Test-Path -LiteralPath $mainJsPath -PathType Leaf) {
    $actualMainHash = (Get-FileHash -LiteralPath $mainJsPath -Algorithm SHA256).Hash
    if ($actualMainHash -eq $expectedMainHash) {
        Add-Pass "main.js SHA256 matches baseline."
    } else {
        Add-Failure "main.js SHA256 mismatch. Expected $expectedMainHash but found $actualMainHash."
    }
}

if (Test-Path -LiteralPath $rendererJsPath -PathType Leaf) {
    $actualRendererHash = (Get-FileHash -LiteralPath $rendererJsPath -Algorithm SHA256).Hash
    if ($actualRendererHash -eq $expectedRendererHash) {
        Add-Pass "renderer.js SHA256 matches baseline."
    } else {
        Add-Failure "renderer.js SHA256 mismatch. Expected $expectedRendererHash but found $actualRendererHash."
    }
}

if (Test-Path -LiteralPath $packageJsonPath -PathType Leaf) {
    $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
    if ($packageJson.main -eq $expectedPackageMain) {
        Add-Pass "package.json main is $expectedPackageMain."
    } else {
        Add-Failure "package.json main mismatch. Expected $expectedPackageMain but found $($packageJson.main)."
    }
} else {
    Add-Failure "Missing package.json: $packageJsonPath"
}

if (Test-Path -LiteralPath $indexHtmlPath -PathType Leaf) {
    $indexHtml = Get-Content -LiteralPath $indexHtmlPath -Raw
    if ($indexHtml -match 'src\s*=\s*["'']?renderer\.js["'']?') {
        Add-Pass "index.html loads renderer.js."
    } else {
        Add-Failure "index.html does not contain a renderer.js script reference."
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Baseline check failed with $($failures.Count) issue(s)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Baseline check passed." -ForegroundColor Green
exit 0
