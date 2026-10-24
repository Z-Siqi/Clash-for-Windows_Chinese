param(
    [int] $Port = 53000,
    [string] $ManifestPath = (Join-Path $PSScriptRoot 'core-hashes.json'),
    [string] $ConfigPath = (Join-Path $PSScriptRoot 'service-config.json'),
    [string] $CoreDirectory = (Join-Path $PSScriptRoot 'cores')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$manifestFile = [IO.Path]::GetFullPath($ManifestPath)
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$trustedHashes = @{}
foreach ($entry in $manifest.cores) {
    $trustedHashes[$entry.name.ToLowerInvariant()] = $entry.sha256.ToUpperInvariant()
}

$policy = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($policy.token -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid service credentials' }
$script:dataDirectory = [IO.Path]::GetFullPath([string]$policy.dataDirectory)
if (-not (Test-Path -LiteralPath $script:dataDirectory -PathType Container)) { throw 'Invalid service data directory' }
$script:coreDirectory = [IO.Path]::GetFullPath($CoreDirectory)
$pidFile = Join-Path $PSScriptRoot 'core.pid'
$script:coreProcess = $null
$script:coreOutputLog = $null

# Stream callbacks cannot use PowerShell script blocks while AcceptTcpClient
# blocks its runspace. Dedicated CLR threads keep both pipes drained instead.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Threading;
public sealed class CFWCoreOutputLog : IDisposable {
    private readonly object gate = new object();
    private readonly string[] secrets;
    private StreamWriter writer;
    private Thread stdout, stderr;
    private bool disposed;
    public CFWCoreOutputLog(string path, string[] values) {
        secrets = values;
        Array.Sort(secrets, delegate(string a, string b) { return b.Length.CompareTo(a.Length); });
        if (!String.IsNullOrEmpty(path)) {
            writer = new StreamWriter(new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read), new System.Text.UTF8Encoding(false));
            writer.AutoFlush = true;
        }
    }
    private void Write(string text) {
        lock (gate) {
            if (disposed || writer == null) return;
            try { writer.Write(text); }
            catch (Exception) { try { writer.Dispose(); } catch (Exception) { } writer = null; }
        }
    }
    private void Drain(StreamReader reader) {
        byte[] buffer = new byte[2048];
        var decoder = System.Text.Encoding.UTF8.GetDecoder();
        char[] characters = new char[System.Text.Encoding.UTF8.GetMaxCharCount(buffer.Length)];
        string pending = "";
        try {
            int read;
            // StreamReader.Read can wait to fill its character request, hiding
            // the last message of a still-running core. Pipe reads return the
            // available bytes; the decoder retains split UTF-8 characters.
            while ((read = reader.BaseStream.Read(buffer, 0, buffer.Length)) > 0) {
                int count = decoder.GetChars(buffer, 0, read, characters, 0, false);
                pending += new string(characters, 0, count);
                foreach (string secret in secrets) pending = pending.Replace(secret, "[REDACTED]");
                // Hold only a possible split value, so ordinary low-volume
                // startup messages reach the file immediately.
                int keep = 0;
                foreach (string secret in secrets) {
                    for (int length = Math.Min(secret.Length - 1, pending.Length); length > keep; length--) {
                        if (String.CompareOrdinal(pending, pending.Length - length, secret, 0, length) == 0) {
                            keep = length; break;
                        }
                    }
                }
                int safe = pending.Length - keep;
                Write(pending.Substring(0, safe));
                pending = pending.Substring(safe);
            }
            Write(pending);
        } catch (IOException) { }
          catch (ObjectDisposedException) { }
    }
    public void Attach(System.Diagnostics.Process process) {
        stdout = new Thread(delegate() { Drain(process.StandardOutput); });
        stderr = new Thread(delegate() { Drain(process.StandardError); });
        stdout.IsBackground = true; stderr.IsBackground = true;
        stdout.Start(); stderr.Start();
    }
    public void Dispose() {
        if (stdout != null) stdout.Join(1000);
        if (stderr != null) stderr.Join(1000);
        lock (gate) {
            disposed = true;
            if (writer != null) { try { writer.Dispose(); } catch (Exception) { } writer = null; }
        }
    }
}
'@

function Write-HttpResponse {
    param($Stream, [int] $StatusCode, [string] $Body)

    $payload = [Text.Encoding]::UTF8.GetBytes($Body)
    $reason = switch ($StatusCode) {
        200 { 'OK' }
        403 { 'Forbidden' }
        404 { 'Not Found' }
        default { 'Internal Server Error' }
    }
    $headers = "HTTP/1.1 $StatusCode $reason`r`nX-CFW-Service-Protocol: 2`r`nX-CFW-Service-Features: core-output-log-v1,core-identity-v1`r`nContent-Type: text/plain; charset=utf-8`r`n" +
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
    $headers = @{}
    foreach ($line in $lines | Select-Object -Skip 1) {
        $separator = $line.IndexOf(':')
        if ($separator -gt 0) {
            $name = $line.Substring(0, $separator).Trim()
            if ($headers.ContainsKey($name)) { throw 'Duplicate HTTP header' }
            $headers[$name] = $line.Substring($separator + 1).Trim()
        }
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
        Headers = $headers
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
    param([string] $RequestedName)

    if ([string]::IsNullOrWhiteSpace($RequestedName) -or -not $trustedHashes.ContainsKey($RequestedName.ToLowerInvariant())) {
        throw [UnauthorizedAccessException]::new('Core is not allow-listed')
    }
    # Network requests select a manifest identity, never an executable path.
    $name = $RequestedName.ToLowerInvariant()
    if ([IO.Path]::GetFileName($name) -cne $name -or $name -match '[\\/:]') { throw [UnauthorizedAccessException]::new('Invalid core identity') }
    $fullPath = Join-Path $script:coreDirectory $name
    $item = Get-Item -LiteralPath $fullPath
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw [UnauthorizedAccessException]::new('Core is redirected') }

    $actualHash = (Get-FileSha256 $fullPath).ToUpperInvariant()
    if ($actualHash -ne $trustedHashes[$name]) {
        throw [UnauthorizedAccessException]::new('Core hash does not match the packaged manifest')
    }

    if ($manifest.PSObject.Properties.Name -contains 'dependencies') {
        foreach ($dependency in $manifest.dependencies) {
            if ($dependency.core -ine $name) { continue }
            $dependencyName = [string]$dependency.name
            if ($dependencyName -cne 'wintun.dll') { throw 'Invalid core dependency' }
            $dependencyPath = Join-Path $script:coreDirectory $dependencyName
            $dependencyItem = Get-Item -LiteralPath $dependencyPath
            if ($dependencyItem.PSIsContainer -or ($dependencyItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
                (Get-FileSha256 $dependencyPath) -ine $dependency.sha256) { throw [UnauthorizedAccessException]::new('Core dependency is redirected or modified') }
        }
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
            if ($validateRecoveredProcess) { Resolve-TrustedCore ([IO.Path]::GetFileName($candidatePath)) | Out-Null
                if ([IO.Path]::GetFullPath($candidatePath) -ine (Join-Path $script:coreDirectory ([IO.Path]::GetFileName($candidatePath)))) { throw 'Recovered core is outside the service installation' } }
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
    if ($null -ne $script:coreOutputLog) {
        $script:coreOutputLog.Dispose()
        $script:coreOutputLog = $null
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

function Read-JsonBody {
    param([string] $Body)
    return $Body | ConvertFrom-Json
}

function Start-CoreProcess {
    param($Payload, [string] $EncodedRedactions = '')

    if (@($Payload.PSObject.Properties.Name | Where-Object { $_ -notin @('core', 'silent', 'redactValues') }).Count -gt 0) { throw 'Unsupported start request' }
    if ($EncodedRedactions) {
        $values = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($EncodedRedactions)) | ConvertFrom-Json
        $Payload | Add-Member -NotePropertyName 'redactValues' -NotePropertyValue @($values) -Force
    }
    $redactValues = @([string]$policy.token)
    if ($Payload.PSObject.Properties.Name -contains 'redactValues') {
        if ($Payload.redactValues -isnot [array] -or $Payload.redactValues.Count -gt 32) { throw 'Invalid log redaction values' }
        foreach ($value in $Payload.redactValues) {
            if ($value -isnot [string] -or $value.Length -lt 1 -or $value.Length -gt 4096) { throw 'Invalid log redaction value' }
            $redactValues += $value
        }
    }
    $corePath = Resolve-TrustedCore ([string]$Payload.core)
    $workingDirectory = $script:dataDirectory
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
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $startInfo.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    # Both legacy Clash and Mihomo must read the requesting user's CFW data.
    # The helper itself runs as SYSTEM, so relying on a default home is incorrect.
    $startInfo.Arguments = '-d "' + $workingDirectory + '"'

    $logPath = ''
    if (-not [bool]$Payload.silent) {
        $logDirectory = Join-Path $workingDirectory 'logs'
        [IO.Directory]::CreateDirectory($logDirectory) | Out-Null
        if ((Get-Item -LiteralPath $logDirectory).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Core log directory is redirected' }
        $logPath = Join-Path $logDirectory ((Get-Date -Format 'yyyy-MM-dd-HHmmss') + '-' + [Guid]::NewGuid().ToString() + '.log')
    }

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $outputLog = [CFWCoreOutputLog]::new($logPath, [string[]]$redactValues)
    try {
        if (-not $process.Start()) {
            throw [InvalidOperationException]::new('Core process did not start')
        }
        $script:coreProcess = $process
        $script:coreOutputLog = $outputLog
        $outputLog.Attach($process)
    } catch {
        if ($script:coreProcess -eq $process) { Stop-CoreProcess }
        else { $outputLog.Dispose() }
        throw
    }
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
            if ($request.Headers['Authorization'] -cne ('Bearer ' + $policy.token) -or
                $request.Headers['Host'] -cne ("127.0.0.1:" + $Port) -or $request.Headers.ContainsKey('Origin')) {
                Write-HttpResponse $stream 403 'unauthorized service request'
                continue
            }

            if ($request.Method -eq 'GET' -and $request.Path -eq '/ping') {
                Write-HttpResponse $stream 200 'pong'
                continue
            }
            if ($request.Method -eq 'GET' -and $request.Path -eq '/status') {
                $running = $null -ne $script:coreProcess -and -not $script:coreProcess.HasExited
                $core = if ($running) { [IO.Path]::GetFileName($script:coreProcess.StartInfo.FileName) } else { $null }
                Write-HttpResponse $stream 200 (@{ running = $running; core = $core } | ConvertTo-Json -Compress)
                continue
            }
            if ($request.Method -eq 'POST' -and $request.Path -eq '/stop') {
                Stop-CoreProcess
                Write-HttpResponse $stream 200 'stopped'
                continue
            }
            if ($request.Method -eq 'POST' -and $request.Path -eq '/shutdown') {
                Stop-CoreProcess
                Write-HttpResponse $stream 200 'stopped'
                break
            }
            if ($request.Method -eq 'POST' -and $request.Path -eq '/start') {
                $redactions = if ($request.Headers.ContainsKey('X-CFW-Log-Redactions')) { [string]$request.Headers['X-CFW-Log-Redactions'] } else { '' }
                $logPath = Start-CoreProcess (Read-JsonBody $request.Body) $redactions
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
