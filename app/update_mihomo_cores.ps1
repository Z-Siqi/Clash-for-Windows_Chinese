param(
    [string]$Version = "1.19.31"
)

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot
$baseUrl = "https://github.com/MetaCubeX/mihomo/releases/download/v$Version"
$targets = @(
    @{
        Asset = "mihomo-windows-amd64-compatible-v$Version.zip"
        Output = "clash_core/win_x64/static/files/win/x64/mihomo-windows-amd64.exe"
        Notice = "clash_core/win_x64/static/files/MIHOMO_NOTICE.txt"
        Kind = "zip"
    },
    @{
        Asset = "mihomo-windows-386-v$Version.zip"
        Output = "clash_core/win32-ia32/static/files/win/ia32/mihomo-windows-386.exe"
        Notice = "clash_core/win32-ia32/static/files/MIHOMO_NOTICE.txt"
        Kind = "zip"
    },
    @{
        Asset = "mihomo-windows-arm64-v$Version.zip"
        Output = "clash_core/win32-arm64/static/files/win/arm64/mihomo-windows-arm64.exe"
        Notice = "clash_core/win32-arm64/static/files/MIHOMO_NOTICE.txt"
        Kind = "zip"
    },
    @{
        Asset = "mihomo-linux-amd64-compatible-v$Version.gz"
        Output = "clash_core/linux-x64/static/files/linux/x64/mihomo-linux-amd64"
        Notice = "clash_core/linux-x64/static/files/MIHOMO_NOTICE.txt"
        Kind = "gzip"
    },
    @{
        Asset = "mihomo-linux-arm64-v$Version.gz"
        Output = "clash_core/linux-arm64/static/files/linux/arm64/mihomo-linux-arm64"
        Notice = "clash_core/linux-arm64/static/files/MIHOMO_NOTICE.txt"
        Kind = "gzip"
    },
    @{
        Asset = "mihomo-darwin-amd64-compatible-v$Version.gz"
        Output = "clash_core/darwin-x64/static/files/darwin/x64/mihomo-darwin-amd64"
        Notice = "clash_core/darwin-x64/static/files/MIHOMO_NOTICE.txt"
        Kind = "gzip"
    },
    @{
        Asset = "mihomo-darwin-arm64-v$Version.gz"
        Output = "clash_core/darwin-arm64/static/files/darwin/arm64/mihomo-darwin-arm64"
        Notice = "clash_core/darwin-arm64/static/files/MIHOMO_NOTICE.txt"
        Kind = "gzip"
    }
)

$tempDir = Join-Path ([IO.Path]::GetTempPath()) "cfw-mihomo-$Version"
if (Test-Path $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    $manifestTargets = @()
    foreach ($target in $targets) {
        $url = "$baseUrl/$($target.Asset)"
        $archive = Join-Path $tempDir $target.Asset
        $output = Join-Path $appDir $target.Output
        Write-Host "Downloading $($target.Asset)..."
        Invoke-WebRequest -Uri $url -OutFile $archive
        New-Item -ItemType Directory -Path (Split-Path $output -Parent) -Force | Out-Null

        if ($target.Kind -eq "zip") {
            $expanded = Join-Path $tempDir ([IO.Path]::GetFileNameWithoutExtension($target.Asset))
            Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
            $binary = Get-ChildItem -LiteralPath $expanded -Recurse -File |
                Where-Object { $_.Name -like "mihomo*.exe" } |
                Select-Object -First 1
            if (-not $binary) { throw "No Mihomo executable found in $($target.Asset)" }
            Copy-Item -LiteralPath $binary.FullName -Destination $output -Force
        } else {
            $inputStream = [IO.File]::OpenRead($archive)
            try {
                $gzipStream = [IO.Compression.GZipStream]::new(
                    $inputStream,
                    [IO.Compression.CompressionMode]::Decompress
                )
                try {
                    $outputStream = [IO.File]::Create($output)
                    try { $gzipStream.CopyTo($outputStream) }
                    finally { $outputStream.Dispose() }
                } finally { $gzipStream.Dispose() }
            } finally { $inputStream.Dispose() }
        }

        $manifestTargets += [ordered]@{
            asset = $target.Asset
            output = $target.Output.Replace("\\", "/")
            source = $url
            sha256 = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
        }
        $notice = @"
Mihomo core binary

Project: MetaCubeX/mihomo
Version: $Version
Release: https://github.com/MetaCubeX/mihomo/releases/tag/v$Version
Corresponding source: https://github.com/MetaCubeX/mihomo/tree/v$Version
License: GNU General Public License v3.0
License text: https://github.com/MetaCubeX/mihomo/blob/v$Version/LICENSE

The binary is redistributed unmodified from the official release. See
app/clash_core/mihomo-core-manifest.json in the source repository for the
asset URL and SHA-256 digest.
"@
        [IO.File]::WriteAllText(
            (Join-Path $appDir $target.Notice),
            $notice,
            [Text.UTF8Encoding]::new($false)
        )
    }

    $manifest = [ordered]@{
        project = "MetaCubeX/mihomo"
        version = $Version
        release = "https://github.com/MetaCubeX/mihomo/releases/tag/v$Version"
        targets = $manifestTargets
    }
    $manifestPath = Join-Path $appDir "clash_core/mihomo-core-manifest.json"
    $manifestJson = $manifest | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText($manifestPath, $manifestJson, [Text.UTF8Encoding]::new($false))

    $serviceTargets = @(
        @{ Directory = "clash_core/win_x64/static/files/win/x64"; Cores = @("clash-win64.exe", "mihomo-windows-amd64.exe") },
        @{ Directory = "clash_core/win32-ia32/static/files/win/ia32"; Cores = @("clash-win32.exe", "mihomo-windows-386.exe") },
        @{ Directory = "clash_core/win32-arm64/static/files/win/arm64"; Cores = @("clash-win-arm64.exe", "mihomo-windows-arm64.exe") },
        @{ Directory = "clash_core/linux-x64/static/files/linux/x64"; Cores = @("clash-linux", "mihomo-linux-amd64") },
        @{ Directory = "clash_core/linux-arm64/static/files/linux/arm64"; Cores = @("clash-linux", "mihomo-linux-arm64") },
        @{ Directory = "clash_core/darwin-x64/static/files/darwin/x64"; Cores = @("clash-darwin", "mihomo-darwin-amd64"); Helpers = @("sysproxy") },
        @{ Directory = "clash_core/darwin-arm64/static/files/darwin/arm64"; Cores = @("clash-darwin", "mihomo-darwin-arm64"); Helpers = @("sysproxy") }
    )
    foreach ($serviceTarget in $serviceTargets) {
        $directory = Join-Path $appDir $serviceTarget.Directory
        $serviceManifest = [ordered]@{
            cores = @($serviceTarget.Cores | ForEach-Object {
                [ordered]@{
                    name = $_
                    sha256 = (Get-FileHash -LiteralPath (Join-Path $directory $_) -Algorithm SHA256).Hash
                }
            })
        }
        if ($serviceTarget.Helpers) {
            $serviceManifest.helpers = @($serviceTarget.Helpers | ForEach-Object {
                [ordered]@{
                    name = $_
                    sha256 = (Get-FileHash -LiteralPath (Join-Path $directory $_) -Algorithm SHA256).Hash
                }
            })
        }
        $serviceManifestPath = Join-Path $directory "service/core-hashes.json"
        [IO.File]::WriteAllText(
            $serviceManifestPath,
            ($serviceManifest | ConvertTo-Json -Depth 5),
            [Text.UTF8Encoding]::new($false)
        )
    }
    Write-Host "Mihomo $Version installed for $($targets.Count) build targets."
} finally {
    if (Test-Path $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force }
}
