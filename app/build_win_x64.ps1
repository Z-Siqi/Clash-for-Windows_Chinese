# Requires PowerShell 3.0+
# Script Directory
$scriptDir   = $PSScriptRoot
$staticDir   = Join-Path $scriptDir 'clash_core\win_x64\static'
$mainDir     = Join-Path $scriptDir 'main'
$logoFile    = Join-Path $scriptDir 'logo.ico'
$outputDir   = Join-Path $scriptDir 'output'
$oldWinDir   = Join-Path $outputDir 'Clash for Windows'
$wrongWinDir = Join-Path $outputDir 'Clash for Windows-win32-x64'

Write-Host 'Checking environment...'

# Checking static
if (-not (Test-Path $staticDir)) {
    Write-Error 'Failed! "static" folder not found!'
    Read-Host 'Press Enter to exit'
    exit 1
}
# Checking main
if (-not (Test-Path $mainDir)) {
    Write-Error 'Failed! "main" folder not found!'
    Read-Host 'Press Enter to exit'
    exit 1
}
# Checking logo.ico
if (-not (Test-Path $logoFile)) {
    Write-Error 'Failed! "logo.ico" not found!'
    Read-Host 'Press Enter to exit'
    exit 1
}

# Checking npm
& npm --version > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host 'npm is detected...'
} else {
    Write-Error 'Failed! No npm command!'
    Write-Host 'Install Node.js might fix this.'
    Read-Host 'Press Enter to exit'
    exit 1
}

# Checking electron-packager
& npx electron-packager --version > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host 'electron-packager is detected...'
} else {
    Write-Warning 'Failed! No electron-packager command!'
    Write-Host 'But npm is detected!'
    Read-Host 'Press Enter to install electron-packager or Ctrl+C to exit'
    npm install -g electron-packager
}

# Checking asar
& npx asar --version > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host 'asar is detected...'
} else {
    Write-Warning 'Failed! No asar command!'
    Write-Host 'But npm is detected!'
    Read-Host 'Press Enter to install asar or Ctrl+C to exit'
    npm install -g asar
}

Write-Host 'Success!'

# Clear old output
if (Test-Path $oldWinDir) {
    Write-Host 'Detected old output!'
    Read-Host 'Press Enter to delete and rebuild'
    Remove-Item -Recurse -Force $oldWinDir
    Write-Host 'Success!'
}
if (Test-Path $wrongWinDir) {
    Write-Host 'Detected wrong building files!'
    Read-Host 'Press Enter to delete and continue'
    Remove-Item -Recurse -Force $wrongWinDir
    Write-Host 'Success!'
}

# Make sure output dir is existed
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# Start packaging
Write-Host 'Starting electron-packager...'
& npx electron-packager `
    "`"$mainDir`"" "Clash for Windows" `
    --platform=win32 --arch=x64 --electron-version=34.0.0 `
    --icon="`"$logoFile`"" --out="`"$outputDir`"" --prune=true --asar
if ($LASTEXITCODE -ne 0) {
    Write-Error 'electron-packager Failed!'
    exit 1
}

Write-Host 'Waiting app building...'
Write-Host 'Note: If wait too long, it may mean that the execution has failed. Press Ctrl+C to terminate.'

# Wait for the program
$exePath = Join-Path $wrongWinDir 'Clash for Windows.exe'
while (-not (Test-Path $exePath)) {
    Start-Sleep -Seconds 5
}
Write-Host 'Success!'

# Adding files and rename
Write-Host 'Adding proxy core files...'
Start-Sleep -Seconds 1
Rename-Item -Path $wrongWinDir -NewName 'Clash for Windows'
$destStatic = Join-Path $oldWinDir 'resources\static'

# Make sure resources dir is existed
$resourcesDir = Split-Path $destStatic -Parent
if (-not (Test-Path $resourcesDir)) {
    New-Item -ItemType Directory -Path $resourcesDir | Out-Null
}

# Make sure static dir is existed
if (-not (Test-Path $destStatic)) {
    New-Item -ItemType Directory -Path $destStatic | Out-Null
}

# Then copy it
Copy-Item -Path "$staticDir\*" -Destination $destStatic -Recurse -Force
Write-Host 'Success!'

Write-Host 'Finish!'
Read-Host 'Press Enter to exit'
