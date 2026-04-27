param(
    [string]$LocalFolder = "I:\test",
    [string]$HostName = "43.100.9.247",
    [string]$User = "uploader",
    [int]$Port = 22,
    [string]$RemotePath = "/CozeMap",
    [int]$StartFileIndex = 1,
    [bool]$SkipIfRemoteSameSize = $true
)

$Password = "CozeCSU2026"

if (!(Test-Path $LocalFolder)) {
    Write-Host "Local folder does not exist: $LocalFolder" -ForegroundColor Red
    exit 1
}

if ($Password -eq "your-password") {
    Write-Host "Set the password in upload_folder.ps1 before running." -ForegroundColor Red
    exit 1
}

$LocalFolder = (Resolve-Path $LocalFolder).Path
$RemoteBasePath = "${RemotePath}/$(Split-Path $LocalFolder -Leaf)"
$WinScpExe = Get-Command WinSCP.com -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
$WinScpNetDll = $null
$UseNetAssembly = $false
$script:UploadProgressContext = $null

if (-not $WinScpExe) {
    $candidatePaths = @(
        "C:\Program Files (x86)\WinSCP\WinSCP.com",
        "C:\Program Files\WinSCP\WinSCP.com"
    )
    $WinScpExe = $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $WinScpExe) {
    $searchRoots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        $env:LOCALAPPDATA
    ) | Where-Object { $_ -and (Test-Path $_) }

    foreach ($root in $searchRoots) {
        $foundExe = Get-ChildItem -Path $root -Filter "WinSCP.com" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        if ($foundExe) {
            $WinScpExe = $foundExe
            break
        }
    }
}

if (-not $WinScpExe) {
    Write-Host "WinSCP.com not found. Install WinSCP first." -ForegroundColor Red
    exit 1
}

function ConvertTo-WinScpQuoted {
    param([Parameter(Mandatory = $true)][string]$Value)

    return '"' + $Value.Replace('"', '""') + '"'
}

function Get-WinScpSessionUrl {
    $encodedUser = [System.Uri]::EscapeDataString($User)
    $encodedPassword = [System.Uri]::EscapeDataString($Password)
    return "sftp://${encodedUser}:${encodedPassword}@${HostName}:${Port}/"
}

function Get-WinScpNetDllPath {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)

    $candidatePaths = @(
        (Join-Path (Split-Path $ExecutablePath -Parent) "WinSCPnet.dll"),
        "C:\Program Files (x86)\WinSCP\WinSCPnet.dll",
        "C:\Program Files\WinSCP\WinSCPnet.dll"
    )

    return $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Format-DataSize {
    param([double]$Bytes)

    if ($Bytes -lt 0) {
        $Bytes = 0
    }

    $units = @("B", "KB", "MB", "GB", "TB")
    $size = [double]$Bytes
    $unitIndex = 0
    while ($size -ge 1024 -and $unitIndex -lt ($units.Count - 1)) {
        $size /= 1024
        $unitIndex++
    }

    if ($unitIndex -eq 0) {
        return ("{0:0} {1}" -f $size, $units[$unitIndex])
    }

    return ("{0:0.00} {1}" -f $size, $units[$unitIndex])
}

function Format-Duration {
    param([Nullable[double]]$Seconds)

    if (-not $Seconds.HasValue -or $Seconds.Value -lt 0) {
        return "--:--:--"
    }

    $rounded = [int][Math]::Round($Seconds.Value, 0)
    $span = [TimeSpan]::FromSeconds($rounded)
    return $span.ToString("hh\:mm\:ss")
}

function New-WinScpSessionOptions {
    if (-not $UseNetAssembly) {
        return $null
    }

    return New-Object WinSCP.SessionOptions -Property @{
        Protocol         = [WinSCP.Protocol]::Sftp
        HostName         = $HostName
        UserName         = $User
        Password         = $Password
        PortNumber       = $Port
        SshHostKeyPolicy = [WinSCP.SshHostKeyPolicy]::GiveUpSecurityAndAcceptAny
    }
}

function Update-TransferProgress {
    param($e)

    $context = $script:UploadProgressContext
    if (-not $context) {
        return
    }

    $now = Get-Date
    $currentFileBytes = [Math]::Min(
        $context.CurrentFileSize,
        [Math]::Max(0.0, [Math]::Round($context.CurrentFileSize * $e.FileProgress, 0))
    )
    $uploadedBytes = [Math]::Min(
        $context.TotalBytes,
        $context.CompletedBytes + $currentFileBytes
    )
    $overallPercent = if ($context.TotalBytes -gt 0) {
        [Math]::Round(($uploadedBytes * 100.0) / $context.TotalBytes, 2)
    }
    else {
        100
    }

    $speedBytes = [double]$e.CPS
    $remainingBytes = [Math]::Max(0.0, $context.TotalBytes - $uploadedBytes)
    $etaSeconds = if ($speedBytes -gt 0) {
        [double]($remainingBytes / $speedBytes)
    }
    else {
        $null
    }

    $overallStatus = "{0}/{1} files | {2} / {3} | elapsed {4} | ETA {5}" -f `
        $context.CurrentIndex, $context.TotalFileCount, `
        (Format-DataSize -Bytes $uploadedBytes), `
        (Format-DataSize -Bytes $context.TotalBytes), `
        (Format-Duration -Seconds ($now - $context.BatchStart).TotalSeconds), `
        (Format-Duration -Seconds $etaSeconds)
    $fileStatus = "{0} | {1} / {2} | {3}/s | elapsed {4}" -f `
        ("{0:0.00}%" -f ($e.FileProgress * 100)), `
        (Format-DataSize -Bytes $currentFileBytes), `
        (Format-DataSize -Bytes $context.CurrentFileSize), `
        (Format-DataSize -Bytes $speedBytes), `
        (Format-Duration -Seconds ($now - $context.CurrentFileStart).TotalSeconds)

    Write-Progress `
        -Id 0 `
        -Activity "Uploading to $RemoteBasePath" `
        -Status $overallStatus `
        -PercentComplete $overallPercent
    Write-Progress `
        -Id 1 `
        -Activity $context.CurrentRelativePath `
        -Status $fileStatus `
        -PercentComplete ($e.FileProgress * 100)
}

function Get-DiagnosticSnippet {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return "<empty>"
    }

    $oneLine = ($Text -replace "`r?`n", " | ").Trim()
    if ($oneLine.Length -gt 240) {
        return $oneLine.Substring(0, 240) + "..."
    }

    return $oneLine
}

function Invoke-WinScpBatch {
    param(
        [Parameter(Mandatory = $true)][string[]]$Commands,
        [Parameter(Mandatory = $true)][string]$CommandType,
        [switch]$ShowConsoleOutput
    )

    $scriptFile = [System.IO.Path]::GetTempFileName()
    $stdoutFile = $null
    $stderrFile = $null

    try {
        $scriptLines = @(
            "option batch abort",
            "option confirm off",
            "open $(Get-WinScpSessionUrl) -hostkey=*"
        ) + $Commands + @("exit")

        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllLines($scriptFile, $scriptLines, $utf8NoBom)

        if ($ShowConsoleOutput) {
            & $WinScpExe /ini=nul /script=$scriptFile
            return [PSCustomObject]@{
                ExitCode = $LASTEXITCODE
                StdOut   = ""
                StdErr   = ""
                Type     = $CommandType
            }
        }

        $stdoutFile = [System.IO.Path]::GetTempFileName()
        $stderrFile = [System.IO.Path]::GetTempFileName()

        $proc = Start-Process `
            -FilePath $WinScpExe `
            -ArgumentList @("/ini=nul", "/script=$scriptFile") `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutFile `
            -RedirectStandardError $stderrFile

        return [PSCustomObject]@{
            ExitCode = $proc.ExitCode
            StdOut   = Get-Content -Path $stdoutFile -Raw -ErrorAction SilentlyContinue
            StdErr   = Get-Content -Path $stderrFile -Raw -ErrorAction SilentlyContinue
            Type     = $CommandType
        }
    }
    catch {
        return [PSCustomObject]@{
            ExitCode = 1
            StdOut   = ""
            StdErr   = $_.Exception.Message
            Type     = $CommandType
        }
    }
    finally {
        Remove-Item -Path @($scriptFile, $stdoutFile, $stderrFile) -ErrorAction SilentlyContinue
    }
}

function Write-RemoteCommandDiagnostic {
    param([Parameter(Mandatory = $true)]$Result)

    $stderrSnippet = Get-DiagnosticSnippet -Text $Result.StdErr
    $stdoutSnippet = Get-DiagnosticSnippet -Text $Result.StdOut
    Write-Host ("[winscp-cmd-failed] type={0} exit={1} stderr={2} stdout={3}" -f $Result.Type, $Result.ExitCode, $stderrSnippet, $stdoutSnippet) -ForegroundColor Yellow
}

function Ensure-RemoteDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$DirectoryPath,
        [object]$Session = $null
    )

    if ($Session) {
        try {
            if (-not $Session.FileExists($DirectoryPath)) {
                $Session.CreateDirectory($DirectoryPath)
            }
            return $true
        }
        catch {
            Write-Host ("[winscp-net-failed] mkdir {0}: {1}" -f $DirectoryPath, $_.Exception.Message) -ForegroundColor Yellow
            return $false
        }
    }

    $quotedPath = ConvertTo-WinScpQuoted -Value $DirectoryPath
    $mkdirResult = Invoke-WinScpBatch -Commands @("mkdir $quotedPath") -CommandType "winscp-mkdir"
    if ($mkdirResult.ExitCode -eq 0) {
        return $true
    }

    $lsResult = Invoke-WinScpBatch -Commands @("ls $quotedPath") -CommandType "winscp-ls"
    if ($lsResult.ExitCode -eq 0) {
        return $true
    }

    Write-RemoteCommandDiagnostic -Result $mkdirResult
    Write-RemoteCommandDiagnostic -Result $lsResult
    return $false
}

function Invoke-WinScpPut {
    param(
        [Parameter(Mandatory = $true)][string]$LocalFilePath,
        [Parameter(Mandatory = $true)][string]$RemoteFilePath,
        [object]$Session = $null
    )

    if ($Session) {
        try {
            $transferOptions = New-Object WinSCP.TransferOptions
            $transferOptions.TransferMode = [WinSCP.TransferMode]::Binary
            $transferResult = $Session.PutFiles($LocalFilePath, $RemoteFilePath, $false, $transferOptions)
            $transferResult.Check()
            return [PSCustomObject]@{
                ExitCode = 0
                StdOut   = ""
                StdErr   = ""
                Type     = "winscp-net-put"
            }
        }
        catch {
            return [PSCustomObject]@{
                ExitCode = 1
                StdOut   = ""
                StdErr   = $_.Exception.Message
                Type     = "winscp-net-put"
            }
        }
    }

    $localQuoted = ConvertTo-WinScpQuoted -Value $LocalFilePath
    $remoteQuoted = ConvertTo-WinScpQuoted -Value $RemoteFilePath
    return Invoke-WinScpBatch -Commands @("put $localQuoted $remoteQuoted") -CommandType "winscp-put" -ShowConsoleOutput
}

function Get-RemoteFileSize {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteFilePath,
        [object]$Session = $null
    )

    if ($Session) {
        try {
            if (-not $Session.FileExists($RemoteFilePath)) {
                return $null
            }

            $fileInfo = $Session.GetFileInfo($RemoteFilePath)
            if ($null -eq $fileInfo) {
                return $null
            }

            return [long]$fileInfo.Length
        }
        catch {
            $message = $_.Exception.Message
            if ($message -notmatch "(?i)(no such file|not exist|not found)") {
                Write-Host ("[winscp-net-failed] stat {0}: {1}" -f $RemoteFilePath, $message) -ForegroundColor Yellow
            }
            return $null
        }
    }

    $remoteQuoted = ConvertTo-WinScpQuoted -Value $RemoteFilePath
    $statResult = Invoke-WinScpBatch -Commands @("stat $remoteQuoted") -CommandType "winscp-stat"
    $statText = @($statResult.StdOut, $statResult.StdErr) -join "`n"
    if ($statResult.ExitCode -ne 0) {
        if ($statText -match "(?i)(no such file|not found|can't get attributes|cannot get file attributes)") {
            return $null
        }
        return $null
    }

    if ($statText -match "(?im)^\s*size\s*:\s*(\d+)\b") {
        return [long]$Matches[1]
    }
    if ($statText -match "(?im)^\s*(\d+)\s*$") {
        return [long]$Matches[1]
    }

    return $null
}

if ($StartFileIndex -lt 1) {
    Write-Host "StartFileIndex must be >= 1: $StartFileIndex" -ForegroundColor Red
    exit 1
}

$files = Get-ChildItem -Path $LocalFolder -File -Recurse | Sort-Object FullName
if ($files.Count -eq 0) {
    Write-Host "No files to upload: $LocalFolder" -ForegroundColor Yellow
    exit 0
}
if ($StartFileIndex -gt $files.Count) {
    Write-Host "StartFileIndex($StartFileIndex) exceeds file count($($files.Count))" -ForegroundColor Red
    exit 1
}

Write-Host "Start upload: $LocalFolder" -ForegroundColor Cyan
Write-Host "Remote target: $RemoteBasePath" -ForegroundColor Cyan
Write-Host "Total files: $($files.Count), starting from index $StartFileIndex" -ForegroundColor Cyan
Write-Host "Skip same-size remote files: $SkipIfRemoteSameSize" -ForegroundColor Cyan

$WinScpNetDll = Get-WinScpNetDllPath -ExecutablePath $WinScpExe
if ($WinScpNetDll) {
    try {
        Add-Type -Path $WinScpNetDll -ErrorAction Stop
        $UseNetAssembly = $true
        Write-Host "Realtime progress enabled: WinSCPnet.dll" -ForegroundColor Cyan
    }
    catch {
        Write-Host ("WinSCPnet.dll load failed, fallback to console output: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    }
}
else {
    Write-Host "WinSCPnet.dll not found, fallback to WinSCP console progress." -ForegroundColor Yellow
}

if ($StartFileIndex -eq $files.Count) {
    $pendingFiles = @($files[$StartFileIndex - 1])
}
else {
    $pendingFiles = @($files[($StartFileIndex - 1)..($files.Count - 1)])
}

try {
    $uploadedCount = 0
    $skippedCount = 0
    $failedCount = 0

    $session = $null
    if ($UseNetAssembly) {
        $session = New-Object WinSCP.Session
        $session.add_FileTransferProgress( { Update-TransferProgress($_) } )
        $session.Open((New-WinScpSessionOptions))
    }

    if (-not (Ensure-RemoteDirectory -DirectoryPath $RemoteBasePath -Session $session)) {
        $failedCount++
        Write-Host "Failed to create remote directory: $RemoteBasePath" -ForegroundColor Red
        Write-Host ("Summary: uploaded={0}, skipped={1}, failed={2}" -f $uploadedCount, $skippedCount, $failedCount) -ForegroundColor Red
        Write-Host ("Start index used: {0}" -f $StartFileIndex) -ForegroundColor Red
        exit 1
    }

    $createdRemoteDirs = @{}
    $pendingTotalBytes = ($pendingFiles | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $pendingTotalBytes) {
        $pendingTotalBytes = 0
    }

    $script:UploadProgressContext = @{
        TotalBytes       = [double]$pendingTotalBytes
        CompletedBytes   = 0.0
        TotalFileCount   = $files.Count
        PendingFileCount = $pendingFiles.Count
        BatchStart       = Get-Date
        CurrentIndex     = $StartFileIndex
        CurrentFileSize  = 0.0
        CurrentFileStart = Get-Date
        CurrentRelativePath = ""
    }

    foreach ($file in $pendingFiles) {
        $currentIndex = [Array]::IndexOf($files, $file) + 1
        $progressPercent = [Math]::Round(($currentIndex * 100.0) / $files.Count, 2)
        $relativePath = $file.FullName.Substring($LocalFolder.Length).TrimStart('\', '/')
        $relativePathUnix = $relativePath -replace '\\', '/'
        $remoteFilePath = "$RemoteBasePath/$relativePathUnix"
        $remoteDir = $remoteFilePath -replace '/[^/]+$', ''

        if ($remoteDir -and -not $createdRemoteDirs.ContainsKey($remoteDir)) {
            if (-not (Ensure-RemoteDirectory -DirectoryPath $remoteDir -Session $session)) {
                $failedCount++
                Write-Host "Failed to create remote subdirectory: $remoteDir" -ForegroundColor Red
                Write-Host ("Summary: uploaded={0}, skipped={1}, failed={2}" -f $uploadedCount, $skippedCount, $failedCount) -ForegroundColor Red
                Write-Host ("Start index used: {0}" -f $StartFileIndex) -ForegroundColor Red
                exit 1
            }
            $createdRemoteDirs[$remoteDir] = $true
        }

        $script:UploadProgressContext.CurrentIndex = $currentIndex
        $script:UploadProgressContext.CurrentFileSize = [double]$file.Length
        $script:UploadProgressContext.CurrentFileStart = Get-Date
        $script:UploadProgressContext.CurrentRelativePath = $relativePathUnix

        $localFileSize = [long]$file.Length
        if ($SkipIfRemoteSameSize) {
            $remoteFileSize = Get-RemoteFileSize -RemoteFilePath $remoteFilePath -Session $session
        }
        else {
            $remoteFileSize = $null
        }

        if ($SkipIfRemoteSameSize -and $null -ne $remoteFileSize) {
            if ([long]$remoteFileSize -eq $localFileSize) {
                $skippedCount++
                $script:UploadProgressContext.CompletedBytes += [double]$localFileSize
                if ($UseNetAssembly) {
                    Write-Progress -Id 1 -Activity $relativePathUnix -Completed
                }
                Write-Host ("[{0}/{1} | {2}%] Skip (same size): {3} ({4})" -f $currentIndex, $files.Count, $progressPercent, $relativePathUnix, (Format-DataSize -Bytes $localFileSize)) -ForegroundColor DarkYellow
                continue
            }

            Write-Host ("[{0}/{1} | {2}%] Size mismatch, overwrite upload: {3} (local {4}, remote {5})" -f $currentIndex, $files.Count, $progressPercent, $relativePathUnix, (Format-DataSize -Bytes $localFileSize), (Format-DataSize -Bytes $remoteFileSize)) -ForegroundColor Yellow
        }

        Write-Host ("[{0}/{1} | {2}%] Upload start: {3} ({4})" -f $currentIndex, $files.Count, $progressPercent, $relativePathUnix, (Format-DataSize -Bytes $file.Length)) -ForegroundColor DarkCyan
        $putResult = Invoke-WinScpPut -LocalFilePath $file.FullName -RemoteFilePath $remoteFilePath -Session $session
        if ($putResult.ExitCode -ne 0) {
            $failedCount++
            Write-RemoteCommandDiagnostic -Result $putResult
            Write-Host ("[{0}/{1} | {2}%] Upload failed: {3} -> {4}" -f $currentIndex, $files.Count, $progressPercent, $relativePathUnix, $remoteFilePath) -ForegroundColor Red
            Write-Host ("Summary: uploaded={0}, skipped={1}, failed={2}" -f $uploadedCount, $skippedCount, $failedCount) -ForegroundColor Red
            Write-Host ("Start index used: {0}" -f $StartFileIndex) -ForegroundColor Red
            exit 1
        }

        $script:UploadProgressContext.CompletedBytes += [double]$file.Length
        $uploadedCount++
        if ($UseNetAssembly) {
            Write-Progress -Id 1 -Activity $relativePathUnix -Completed
        }
        Write-Host ("[{0}/{1} | {2}%] Upload done: {3}" -f $currentIndex, $files.Count, $progressPercent, $relativePathUnix) -ForegroundColor DarkGreen
    }

    if ($UseNetAssembly) {
        Write-Progress -Id 0 -Activity "Uploading to $RemoteBasePath" -Completed
        Write-Progress -Id 1 -Activity "Uploading file" -Completed
    }

    Write-Host "Upload complete." -ForegroundColor Green
    Write-Host "Remote result: $RemoteBasePath" -ForegroundColor Green
    Write-Host ("Summary: uploaded={0}, skipped={1}, failed={2}" -f $uploadedCount, $skippedCount, $failedCount) -ForegroundColor Green
    Write-Host ("Start index used: {0}" -f $StartFileIndex) -ForegroundColor Green
    if ($StartFileIndex -gt 1) {
        Write-Host "Resume mode, start index: $StartFileIndex" -ForegroundColor Green
    }
}
finally {
    if ($UseNetAssembly -and $session) {
        $session.Dispose()
    }
    $script:UploadProgressContext = $null
}
