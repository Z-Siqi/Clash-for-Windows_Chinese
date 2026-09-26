param(
    [int] $Port = 53000,
    [string] $ManifestPath = (Join-Path $PSScriptRoot 'core-hashes.json')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$manifestFile = [IO.Path]::GetFullPath($ManifestPath)
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$trustedHashes = @{}
foreach ($entry in $manifest.cores) {
    $trustedHashes[$entry.name.ToLowerInvariant()] = $entry.sha256.ToUpperInvariant()
}

$pidFile = Join-Path $PSScriptRoot 'core.pid'
$script:coreProcess = $null

function Write-HttpResponse {
    param($Stream, [int] $StatusCode, [string] $Body)

    $payload = [Text.Encoding]::UTF8.GetBytes($Body)
    $reason = switch ($StatusCode) {
        200 { 'OK' }
        403 { 'Forbidden' }
        404 { 'Not Found' }
        default { 'Internal Server Error' }
    }
    $headers = "HTTP/1.1 $StatusCode $reason`r`nContent-Type: text/plain; charset=utf-8`r`n" +
        "Content-Length: $($payload.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    $Stream.Write($payload, 0, $payload.Length)
    $Stream.Flush()
    # Windows PowerShell's TcpClient can otherwise close with an abortive RST
    # before a loopback peer has consumed the complete response.
    Start-Sleep -Milliseconds 50
}

function Try-WriteHttpResponse {
    param($Client, [int] $StatusCode, [string] $Body)

    try {
        if ($null -ne $Client -and $Client.Connected) {
            Write-HttpResponse $Client.GetStream() $StatusCode $Body
        }
    } catch {
        # A timed-out renderer may have closed the socket while a core was
        # starting. Its response must not terminate the long-running helper.
    }
}

function Read-HttpRequest {
    param($Stream)

    $headerBytes = [Collections.Generic.List[byte]]::new()
    while ($headerBytes.Count -lt 16384) {
        $value = $Stream.ReadByte()
        if ($value -lt 0) { throw [IO.EndOfStreamException]::new('Unexpected end of HTTP headers') }
        $headerBytes.Add([byte]$value)
        $count = $headerBytes.Count
        if ($count -ge 4 -and $headerBytes[$count - 4] -eq 13 -and $headerBytes[$count - 3] -eq 10 -and
            $headerBytes[$count - 2] -eq 13 -and $headerBytes[$count - 1] -eq 10) {
            break
        }
    }
    if ($headerBytes.Count -ge 16384) { throw [IO.InvalidDataException]::new('HTTP headers are too large') }

    $header = [Text.Encoding]::ASCII.GetString($headerBytes.GetRange(0, $headerBytes.Count - 4).ToArray())
    $lines = $header -split "`r`n"
    $requestParts = $lines[0].Split(' ')
    if ($requestParts.Length -lt 2) { throw [IO.InvalidDataException]::new('Invalid HTTP request line') }

    $contentLength = 0
    foreach ($line in $lines | Select-Object -Skip 1) {
        $separator = $line.IndexOf(':')
        if ($separator -gt 0 -and $line.Substring(0, $separator).Trim() -ieq 'Content-Length') {
            $contentLength = [int]$line.Substring($separator + 1).Trim()
        }
    }
    if ($contentLength -lt 0 -or $contentLength -gt 65536) {
        throw [IO.InvalidDataException]::new('Invalid request body size')
    }

    $bodyBytes = New-Object byte[] $contentLength
    $offset = 0
    while ($offset -lt $contentLength) {
        $read = $Stream.Read($bodyBytes, $offset, $contentLength - $offset)
        if ($read -le 0) { throw [IO.EndOfStreamException]::new('Unexpected end of HTTP body') }
        $offset += $read
    }

    return [pscustomobject]@{
        Method = $requestParts[0].ToUpperInvariant()
        Path = $requestParts[1].Split('?')[0].ToLowerInvariant()
        Body = [Text.Encoding]::UTF8.GetString($bodyBytes)
    }
}

function Get-FileSha256 {
    param([string] $Path)

    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '')
    } finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Resolve-TrustedCore {
    param([string] $RequestedPath)

    if ([string]::IsNullOrWhiteSpace($RequestedPath)) {
        throw [UnauthorizedAccessException]::new('Missing core path')
    }

    $fullPath = [IO.Path]::GetFullPath($RequestedPath)
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw [UnauthorizedAccessException]::new('Core file does not exist')
    }

    $name = [IO.Path]::GetFileName($fullPath).ToLowerInvariant()
    if (-not $trustedHashes.ContainsKey($name)) {
        throw [UnauthorizedAccessException]::new('Core is not allow-listed')
    }

    $actualHash = (Get-FileSha256 $fullPath).ToUpperInvariant()
    if ($actualHash -ne $trustedHashes[$name]) {
        throw [UnauthorizedAccessException]::new('Core hash does not match the packaged manifest')
    }

    return $fullPath
}

function Stop-CoreProcess {
    $candidate = $script:coreProcess
    $validateRecoveredProcess = $null -eq $candidate
    if ($null -eq $candidate -and (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
        $savedPid = Get-Content -LiteralPath $pidFile -Raw
        if ($savedPid -match '^\s*\d+\s*$') {
            $candidate = Get-Process -Id ([int]$savedPid.Trim()) -ErrorAction SilentlyContinue
        }
    }

    if ($null -ne $candidate -and -not $candidate.HasExited) {
        $candidatePath = $candidate.Path
        if (-not [string]::IsNullOrWhiteSpace($candidatePath)) {
            # The in-memory process was already hash-checked before launch.
            # Revalidate only a PID recovered after the helper restarted.
            if ($validateRecoveredProcess) { Resolve-TrustedCore $candidatePath | Out-Null }
            $candidate.Kill()
            if (-not $candidate.WaitForExit(2000)) {
                $candidate.Kill()
                if (-not $candidate.WaitForExit(2000)) {
                    throw [InvalidOperationException]::new('Managed core did not exit after termination')
                }
            }
        }
    }

    $script:coreProcess = $null
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

function Read-JsonBody {
    param([string] $Body)
    return $Body | ConvertFrom-Json
}

function Start-CoreProcess {
    param($Payload)

    $corePath = Resolve-TrustedCore ([string]$Payload.path)
    $workingDirectory = [IO.Path]::GetFullPath([string]$Payload.cwd)
    if (-not (Test-Path -LiteralPath $workingDirectory -PathType Container)) {
        throw [IO.DirectoryNotFoundException]::new('Core working directory does not exist')
    }

    Stop-CoreProcess

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $corePath
    $startInfo.WorkingDirectory = $workingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    # Both legacy Clash and Mihomo must read the requesting user's CFW data.
    # The helper itself runs as SYSTEM, so relying on a default home is incorrect.
    $startInfo.Arguments = '-d "' + $workingDirectory + '"'

    $logPath = ''
    if (-not [bool]$Payload.silent) {
        $logDirectory = Join-Path $workingDirectory 'logs'
        [IO.Directory]::CreateDirectory($logDirectory) | Out-Null
        $logPath = Join-Path $logDirectory ((Get-Date -Format 'yyyy-MM-dd-HHmmss') + '.log')
        [IO.File]::WriteAllText($logPath, '')
    }

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw [InvalidOperationException]::new('Core process did not start')
    }

    $script:coreProcess = $process
    [IO.File]::WriteAllText($pidFile, [string]$process.Id, [Text.Encoding]::ASCII)
    return $logPath
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.LingerState = [Net.Sockets.LingerOption]::new($true, 1)
            $client.ReceiveTimeout = 1000
            $client.SendTimeout = 1000
            $stream = $client.GetStream()
            $request = Read-HttpRequest $stream

            if ($request.Method -eq 'GET' -and $request.Path -eq '/ping') {
                Write-HttpResponse $stream 200 'pong'
                continue
            }
            if ($request.Method -eq 'GET' -and $request.Path -eq '/stop') {
                Stop-CoreProcess
                Write-HttpResponse $stream 200 'stopped'
                continue
            }
            if ($request.Method -eq 'GET' -and $request.Path -eq '/shutdown') {
                Stop-CoreProcess
                Write-HttpResponse $stream 200 'stopped'
                break
            }
            if ($request.Method -eq 'POST' -and $request.Path -eq '/start') {
                $logPath = Start-CoreProcess (Read-JsonBody $request.Body)
                Write-HttpResponse $stream 200 ([string]$logPath)
                continue
            }

            Write-HttpResponse $stream 404 'not found'
        } catch [UnauthorizedAccessException] {
            Try-WriteHttpResponse $client 403 'forbidden'
        } catch {
            [Console]::Error.WriteLine($_.Exception.Message)
            Try-WriteHttpResponse $client 500 'service error'
        } finally {
            $client.Close()
        }
    }
} finally {
$listener.Stop()
}
