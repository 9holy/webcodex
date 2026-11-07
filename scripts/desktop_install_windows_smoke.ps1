# Install, inspect, and uninstall one newly-built WebCodex Desktop NSIS package.
# The helper never kills by executable name and never removes WebCodex user state.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Installer,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$SourceSha,
    [Parameter(Mandatory = $true)][Int64]$BuiltAt,
    [Parameter(Mandatory = $true)][ValidateSet("win32-x64", "win32-arm64")][string]$Platform,
    [bool]$GitDirty = $false,
    [string]$InstallDir,
    [string]$PreviousInstaller,
    [string]$PreviousInstallerSha256
)

$ErrorActionPreference = "Stop"

function Resolve-InputPath([string]$Path) {
    return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
}
$Installer = Resolve-InputPath $Installer
if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) {
    throw "Desktop installer does not exist: $Installer"
}
if ($SourceSha -notmatch '^[0-9A-Fa-f]{40}$') {
    throw "SourceSha must be one exact 40-hex Git commit"
}
if ($BuiltAt -le 0) {
    throw "BuiltAt must be a positive Unix timestamp"
}
$requestedInstallDir = $null
if ($InstallDir) {
    $requestedInstallDir = (Resolve-InputPath $InstallDir).TrimEnd('\')
    if (Test-Path -LiteralPath $requestedInstallDir) {
        throw "refusing custom-directory smoke because the requested install directory already exists: $requestedInstallDir"
    }
}
if ([bool]$PreviousInstaller -ne [bool]$PreviousInstallerSha256) {
    throw "PreviousInstaller and its pinned SHA-256 must be supplied together"
}
if ($PreviousInstaller) {
    if (-not $requestedInstallDir) {
        throw "upstream upgrade smoke requires a new, explicit isolated InstallDir"
    }
    $PreviousInstaller = Resolve-InputPath $PreviousInstaller
    if (-not (Test-Path -LiteralPath $PreviousInstaller -PathType Leaf) -or
        $PreviousInstallerSha256 -notmatch '^[0-9a-fA-F]{64}$') {
        throw "upstream installer or its pinned SHA-256 is invalid"
    }
    if ((Get-FileHash -LiteralPath $PreviousInstaller -Algorithm SHA256).Hash -ne $PreviousInstallerSha256) {
        throw "upstream installer differs from the pinned published bytes"
    }
}

function Get-WebCodexUninstallEntry {
    $root = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
    if (-not (Test-Path -LiteralPath $root)) { return $null }
    $entries = @(
        Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue |
            ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue } |
            Where-Object { $_.DisplayName -eq "WebCodex Desktop" }
    )
    if ($entries.Count -gt 1) {
        throw "multiple current-user WebCodex Desktop uninstall entries found"
    }
    return @($entries | Select-Object -First 1)[0]
}

function Resolve-UninstallExecutable([string]$command) {
    if (-not $command) { throw "WebCodex uninstall command is missing" }
    $match = [regex]::Match($command, '^\s*"([^"]+)"')
    if ($match.Success) { return $match.Groups[1].Value }
    return ($command -split '\s+', 2)[0]
}

function Resolve-RegistryPath([string]$value, [string]$field) {
    if (-not $value) { throw "WebCodex $field is missing" }
    $trimmed = $value.Trim()
    if ($trimmed.StartsWith('"') -or $trimmed.EndsWith('"')) {
        if (-not ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"') -and $trimmed.Length -ge 2)) {
            throw "WebCodex $field has malformed quoting"
        }
        $trimmed = $trimmed.Substring(1, $trimmed.Length - 2)
    }
    if (-not $trimmed -or $trimmed.Contains('"')) {
        throw "WebCodex $field is not one executable-system path"
    }
    return [System.IO.Path]::GetFullPath($trimmed)
}

function Get-VersionLine([string]$binary, [string]$name) {
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $binary
    $start.Arguments = "--version"
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) {
            throw "$name.exe --version could not start after Desktop install"
        }
        $stdout = $process.StandardOutput.ReadToEnd()
        $null = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) {
            throw "$name.exe --version failed after Desktop install with exit code $($process.ExitCode)"
        }
        $lines = @($stdout -split "`r?`n" | Where-Object { $_ -ne "" })
        if ($lines.Count -ne 1) {
            throw "$name.exe --version returned an unexpected line count after Desktop install"
        }
        return $lines[0].TrimEnd()
    } finally {
        $process.Dispose()
    }
}

function Get-PeMachine([string]$binary) {
    $bytes = [System.IO.File]::ReadAllBytes($binary)
    if ($bytes.Length -lt 64 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) {
        throw "installed Desktop executable is not a PE image: $binary"
    }
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    if ($peOffset -lt 0 -or $peOffset -gt $bytes.Length - 6) {
        throw "installed Desktop executable has an invalid PE header offset: $binary"
    }
    if (
        $bytes[$peOffset] -ne 0x50 -or
        $bytes[$peOffset + 1] -ne 0x45 -or
        $bytes[$peOffset + 2] -ne 0x00 -or
        $bytes[$peOffset + 3] -ne 0x00
    ) {
        throw "installed Desktop executable has an invalid PE signature: $binary"
    }
    $optionalOffset = $peOffset + 24
    if ($optionalOffset -gt $bytes.Length - 70) {
        throw "installed Desktop executable has a truncated PE optional header: $binary"
    }
    if ([BitConverter]::ToUInt16($bytes, $optionalOffset + 68) -ne 2) {
        throw "installed Desktop must use the Windows GUI subsystem to survive closing its launcher's terminal: $binary"
    }
    return [BitConverter]::ToUInt16($bytes, $peOffset + 4)
}

function Wait-Until([scriptblock]$Condition, [int]$Seconds, [string]$Failure) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw $Failure
}

function Remove-FileEventually([string]$Path, [int]$Seconds, [string]$Failure) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
        try {
            Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
        } catch {
            if ([DateTime]::UtcNow -ge $deadline) {
                throw "$Failure Last error: $($_.Exception.Message)"
            }
            Start-Sleep -Milliseconds 250
            continue
        }
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw $Failure
}

if (Get-WebCodexUninstallEntry) {
    throw "refusing Desktop installer smoke because WebCodex Desktop is already installed for this user"
}

$installedDir = $null
$uninstaller = $null
$installed = $false
$dataSentinel = $null
$sentinelContents = $null
$createdDataDir = $false
$unrelatedProcess = $null
$unrelatedDir = $null
$dataDir = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "dev.webcodex.desktop"
try {
    if ($PreviousInstaller) {
        $previous = Start-Process -FilePath $PreviousInstaller -ArgumentList "/S /D=$requestedInstallDir" -Wait -PassThru
        if ($previous.ExitCode -ne 0) {
            throw "pinned upstream Desktop installer failed with exit code $($previous.ExitCode)"
        }
        Wait-Until { $null -ne (Get-WebCodexUninstallEntry) } 30 "upstream Desktop did not register an uninstall entry"
        $installed = $true
        $entry = Get-WebCodexUninstallEntry
        $installedDir = Resolve-RegistryPath ([string]$entry.InstallLocation) "InstallLocation"
        $uninstaller = Resolve-UninstallExecutable ([string]$entry.UninstallString)
        if (-not [string]::Equals($installedDir.TrimEnd('\'), $requestedInstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "upstream Desktop did not honor the isolated custom installation directory"
        }
        # Create one uniquely named, non-secret data fixture. Never overwrite
        # an existing user's configuration or delete their application data.
        $createdDataDir = -not (Test-Path -LiteralPath $dataDir)
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
        $dataSentinel = Join-Path $dataDir ("installer-upgrade-fixture-{0}.json" -f [Guid]::NewGuid().ToString("N"))
        $sentinelContents = '{"fixture":"preserve-existing-desktop-data"}'
        [IO.File]::WriteAllText($dataSentinel, $sentinelContents, [Text.Encoding]::UTF8)
        # An unrelated, owned fixture has the same executable name. Neither
        # upgrade nor an indirect old-uninstaller handoff may terminate it.
        $unrelatedDir = Join-Path ([IO.Path]::GetTempPath()) ("webcodex-unrelated-installer-fixture-" + [Guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Path $unrelatedDir | Out-Null
        $unrelatedExe = Join-Path $unrelatedDir "WebCodex.exe"
        Copy-Item -LiteralPath (Join-Path $env:SystemRoot "System32\cmd.exe") -Destination $unrelatedExe
        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = $unrelatedExe
        $start.Arguments = "/D /C set /p fixture="
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardInput = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        $unrelatedProcess = [Diagnostics.Process]::new()
        $unrelatedProcess.StartInfo = $start
        if (-not $unrelatedProcess.Start()) { throw "could not start the unrelated same-name process fixture" }
    }
    # NSIS requires /D= to be the final argument. Its value intentionally consumes
    # the remainder of the command line, so a path containing spaces is passed
    # literally without shell-style quoting or escaping.
    $installArguments = @("/S")
    if ($PreviousInstaller) {
        # Exercise the normal same-product update location discovery, without
        # /D= masking a failure to recognize the published upstream installation.
        $installArguments += "/UPDATE"
    } elseif ($requestedInstallDir) {
        $installArguments += "/D=$requestedInstallDir"
    }
    $installProcess = Start-Process -FilePath $Installer -ArgumentList $installArguments -Wait -PassThru
    if ($installProcess.ExitCode -ne 0) {
        throw "Desktop silent install failed with exit code $($installProcess.ExitCode)"
    }
    Wait-Until { $null -ne (Get-WebCodexUninstallEntry) } 30 "Desktop installer did not register a current-user uninstall entry"
    $installed = $true

    $entry = Get-WebCodexUninstallEntry
    $uninstaller = Resolve-UninstallExecutable ([string]$entry.UninstallString)
    if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        throw "registered WebCodex uninstaller does not exist: $uninstaller"
    }
    $installedDir = if ($entry.InstallLocation) {
        Resolve-RegistryPath ([string]$entry.InstallLocation) "InstallLocation"
    } else {
        Split-Path -Parent ([System.IO.Path]::GetFullPath($uninstaller))
    }
    if ($requestedInstallDir) {
        $actualInstallDir = $installedDir.TrimEnd('\')
        if (-not [string]::Equals($actualInstallDir, $requestedInstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "custom Desktop InstallLocation mismatch: expected '$requestedInstallDir', got '$installedDir'"
        }
    }
    if ($dataSentinel -and [IO.File]::ReadAllText($dataSentinel) -cne $sentinelContents) {
        throw "upstream-to-candidate upgrade changed the existing Desktop data fixture"
    }
    if ($unrelatedProcess -and $unrelatedProcess.HasExited) {
        throw "upstream-to-candidate upgrade terminated an unrelated same-name process"
    }

    $desktopExe = Join-Path $installedDir "WebCodex.exe"
    if (-not (Test-Path -LiteralPath $desktopExe -PathType Leaf)) {
        throw "installed WebCodex Desktop executable is missing: $desktopExe"
    }
    $expectedDesktopMachine = if ($Platform -eq "win32-x64") { 0x8664 } else { 0xAA64 }
    $actualDesktopMachine = Get-PeMachine $desktopExe
    if ($actualDesktopMachine -ne $expectedDesktopMachine) {
        throw ("installed WebCodex Desktop architecture mismatch: expected 0x{0:x4}, got 0x{1:x4}" -f $expectedDesktopMachine, $actualDesktopMachine)
    }
    $runtimeDir = Join-Path $installedDir "webcodex-runtime"
    if (-not (Test-Path -LiteralPath $runtimeDir -PathType Container)) {
        throw "installed bundled runtime directory is missing: $runtimeDir"
    }

    $sourceIdentity = $SourceSha.ToLowerInvariant()
    $dirtyText = if ($GitDirty) { "true" } else { "false" }
    foreach ($name in @("webcodex", "webcodex-server", "webcodex-runner")) {
        $binary = Join-Path $runtimeDir "$name.exe"
        if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) {
            throw "installed bundled binary is missing: $binary"
        }
        $line = Get-VersionLine $binary $name
        $expected = "$name $Version (commit $sourceIdentity, dirty=$dirtyText, built_at=$BuiltAt)"
        if ($line -ne $expected) {
            throw "unexpected installed $name.exe identity: '$line' (expected '$expected')"
        }
    }

    if ($PreviousInstaller) {
        Write-Output "Pinned upstream-to-candidate upgrade passed: original folder, Desktop data and unrelated process preserved"
    }
    Write-Output "Desktop install smoke passed: $installedDir"
    Write-Output "Bundled runtime: $runtimeDir"
} finally {
    if ($unrelatedProcess) {
        try {
            if (-not $unrelatedProcess.HasExited) {
                $unrelatedProcess.StandardInput.WriteLine()
                $unrelatedProcess.StandardInput.Close()
                if (-not $unrelatedProcess.WaitForExit(10000)) {
                    # Only the fixture process created above; never a name lookup.
                    $unrelatedProcess.Kill()
                    $unrelatedProcess.WaitForExit()
                }
            }
        } finally {
            $unrelatedProcess.Dispose()
        }
    }
    if ($unrelatedDir -and (Test-Path -LiteralPath $unrelatedDir -PathType Container)) {
        Remove-Item -LiteralPath $unrelatedDir -Recurse -Force
    }
    if ($installed) {
        if (-not $uninstaller) {
            $entry = Get-WebCodexUninstallEntry
            if ($entry) { $uninstaller = Resolve-UninstallExecutable ([string]$entry.UninstallString) }
        }
        if ($uninstaller -and (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
            if (-not $installedDir) {
                throw "WebCodex install directory is unknown before silent uninstall"
            }
            # NSIS normally copies the uninstaller to a temporary directory and exits the
            # original process. `_?=$INSTDIR` keeps the real uninstall in this process so
            # `-Wait` is authoritative for process exit. Windows can still release the
            # executable image handle slightly later, so the final uninstaller unlink is
            # retried for a bounded interval below.
            $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$installedDir" -Wait -PassThru
            if ($uninstallProcess.ExitCode -ne 0) {
                throw "Desktop silent uninstall failed with exit code $($uninstallProcess.ExitCode)"
            }
            Wait-Until { $null -eq (Get-WebCodexUninstallEntry) } 30 "Desktop uninstall entry remained after silent uninstall"

            $desktopExe = Join-Path $installedDir "WebCodex.exe"
            $runtimeDir = Join-Path $installedDir "webcodex-runtime"
            Wait-Until {
                -not (Test-Path -LiteralPath $desktopExe) -and
                -not (Test-Path -LiteralPath $runtimeDir)
            } 30 "Desktop installer-owned payload remained after silent uninstall: $installedDir"

            if (Test-Path -LiteralPath $installedDir -PathType Container) {
                $remaining = @(
                    Get-ChildItem -LiteralPath $installedDir -Force -ErrorAction SilentlyContinue |
                        Where-Object { $_.FullName -ne $uninstaller }
                )
                if ($remaining.Count -ne 0) {
                    throw "Desktop installer-owned files remained after silent uninstall: $($remaining.Name -join ', ')"
                }
                if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
                    Remove-FileEventually $uninstaller 30 "Desktop uninstaller remained locked after silent uninstall: $uninstaller"
                }
                Remove-Item -LiteralPath $installedDir -Force
            }
            if (Test-Path -LiteralPath $installedDir) {
                throw "Desktop install directory remained after deterministic uninstall cleanup: $installedDir"
            }
        }
    }
    if ($dataSentinel -and (Test-Path -LiteralPath $dataSentinel -PathType Leaf)) {
        Remove-Item -LiteralPath $dataSentinel -Force
    }
    if ($createdDataDir -and (Test-Path -LiteralPath $dataDir -PathType Container) -and
        @(Get-ChildItem -LiteralPath $dataDir -Force).Count -eq 0) {
        Remove-Item -LiteralPath $dataDir
    }
}

Write-Output "Desktop uninstall smoke passed"
