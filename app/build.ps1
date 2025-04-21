# Requires PowerShell 3.0+
# 脚本根目录
$scriptDir   = $PSScriptRoot
$staticDir   = Join-Path $scriptDir 'static'
$mainDir     = Join-Path $scriptDir 'main'
$logoFile    = Join-Path $scriptDir 'logo.ico'
$outputDir   = Join-Path $scriptDir 'output'
$oldWinDir   = Join-Path $outputDir 'Clash for Windows'
$wrongWinDir = Join-Path $outputDir 'Clash for Windows-win32-x64'

Write-Host 'Checking environment...'

# 检查 static
if (-not (Test-Path $staticDir)) {
    Write-Error 'Failed! "static" folder not found!'
    Read-Host 'Press Enter to exit'
    exit 1
}
# 检查 main
if (-not (Test-Path $mainDir)) {
    Write-Error 'Failed! "main" folder not found!'
    Read-Host 'Press Enter to exit'
    exit 1
}
# 检查 logo.ico
if (-not (Test-Path $logoFile)) {
    Write-Error 'Failed! "logo.ico" not found!'
    Read-Host 'Press Enter to exit'
    exit 1
}

# 检查 npm
& npm --version > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host 'npm is detected...'
} else {
    Write-Error 'Failed! No npm command!'
    Write-Host 'Install Node.js might fix this.'
    Read-Host 'Press Enter to exit'
    exit 1
}

# 检查 electron-packager
& npx electron-packager --version > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host 'electron-packager is detected...'
} else {
    Write-Warning 'Failed! No electron-packager command!'
    Write-Host 'But npm is detected!'
    Read-Host 'Press Enter to install electron-packager or Ctrl+C to exit'
    npm install -g electron-packager
}

# 检查 asar
& npx asar --version > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host 'asar is detected...'
} else {
    Write-Warning 'Failed! No asar command!'
    Write-Host 'But npm is detected!'
    Read-Host 'Press Enter to install asar or Ctrl+C to exit'
    npm install -g asar
}

Write-Host 'Done!'

# 清理旧输出
if (Test-Path $oldWinDir) {
    Write-Host 'Detected old output!'
    Read-Host 'Press Enter to delete and rebuild'
    Remove-Item -Recurse -Force $oldWinDir
    Write-Host 'Done!'
}
if (Test-Path $wrongWinDir) {
    Write-Host 'Detected wrong building files!'
    Read-Host 'Press Enter to delete and continue'
    Remove-Item -Recurse -Force $wrongWinDir
    Write-Host 'Done!'
}

# 确保 output 目录存在
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# 开始打包
Write-Host 'Starting electron-packager...'
& npx electron-packager `
    "`"$mainDir`"" "Clash for Windows" `
    --platform=win32 --arch=x64 --electron-version=29.4.3 `
    --icon="`"$logoFile`"" --out="`"$outputDir`""
if ($LASTEXITCODE -ne 0) {
    Write-Error 'electron-packager 执行失败'
    exit 1
}

Write-Host 'Waiting app building...'
Write-Host 'Note: If wait too long, it may mean that the execution has failed. Press Ctrl+C to terminate.'

# 等待 exe 出现
$exePath = Join-Path $wrongWinDir 'Clash for Windows.exe'
while (-not (Test-Path $exePath)) {
    Start-Sleep -Seconds 5
}

# 重命名并拷贝静态文件
Write-Host 'Done! Adding proxy core files...'
Start-Sleep -Seconds 1
Rename-Item -Path $wrongWinDir -NewName 'Clash for Windows'
$destStatic = Join-Path $oldWinDir 'resources\static'
# 确保 resources 目录存在
$resourcesDir = Split-Path $destStatic -Parent
if (-not (Test-Path $resourcesDir)) {
    New-Item -ItemType Directory -Path $resourcesDir | Out-Null
}

# 确保 static 目录存在
if (-not (Test-Path $destStatic)) {
    New-Item -ItemType Directory -Path $destStatic | Out-Null
}

# 然后再复制
Copy-Item -Path "$staticDir\*" -Destination $destStatic -Recurse -Force
Write-Host 'Done!'

# 打包 asar
Write-Host 'Waiting packing app asar...'
& npx asar pack `
    "`"$oldWinDir\resources\app`"" `
    "`"$oldWinDir\resources\app.asar`""

# 循环等待 asar 生成
$asarPath = Join-Path $oldWinDir 'resources\app.asar'
while (-not (Test-Path $asarPath)) {
    Start-Sleep -Seconds 3
}

# 删除旧 app 文件夹
Write-Host 'Done! Delete old files...'
Start-Sleep -Seconds 1
Remove-Item -Recurse -Force (Join-Path $oldWinDir 'resources\app')
Write-Host 'Finish!'
Read-Host 'Press Enter to exit'
