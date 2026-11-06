#requires -Version 5.1
param([string]$NativeCodexPath)
$ErrorActionPreference = 'Stop'
$fixtureParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixture = Join-Path $fixtureParent ("webcodex-bridge-install-'" + [Guid]::NewGuid().ToString('N'))
$fixtureLocal = Join-Path $fixture 'local'
$fixtureCodex = Join-Path $fixture 'codex'
$adapter = Join-Path $fixture 'adapter.mjs'
$nodePath = (Get-Command node.exe).Source
$fixtureCodexExecutable = if ($NativeCodexPath) { $NativeCodexPath } else { $nodePath }
$shellPath = (Get-Process -Id $PID).Path
$installer = Join-Path $PSScriptRoot 'install.ps1'
$catalogFixture = Join-Path $fixture 'mcp-catalog.json'
$cliFixture = Join-Path $fixture 'codex-cli.cjs'
$capturedHome = Join-Path $fixture 'adapter-home.txt'

function Assert($condition, [string]$message) { if (-not $condition) { throw $message } }
function Run-Installer {
    param([switch]$RejectCandidate)
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $shellPath
    $start.Arguments = '-NoProfile -File "' + $installer + '" -AdapterPath "' + $adapter + '" -CodexPath "' + $fixtureCodexExecutable + '"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['LOCALAPPDATA'] = $fixtureLocal
    $start.EnvironmentVariables['USERPROFILE'] = $fixture
    $start.EnvironmentVariables['CODEX_HOME'] = $fixtureCodex
    if (-not $NativeCodexPath) { $start.EnvironmentVariables['NODE_OPTIONS'] = '--require "' + $cliFixture.Replace('\', '/') + '"' }
    $start.EnvironmentVariables['BRIDGE_TEST_MCP_CATALOG'] = $catalogFixture
    $start.EnvironmentVariables['BRIDGE_TEST_REJECT_CANDIDATE'] = if ($RejectCandidate) { '1' } else { '0' }
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        return @{ code = $process.ExitCode; output = $stdout.Result + $stderr.Result }
    } finally { $process.Dispose() }
}

try {
    New-Item -ItemType Directory -Path $fixtureLocal, $fixtureCodex -Force | Out-Null
    [IO.File]::WriteAllText($cliFixture, 'if(process.argv[2]==="list"&&process.argv[3]==="--json"){if(process.env.BRIDGE_TEST_REJECT_CANDIDATE==="1"&&process.env.CODEX_HOME.endsWith("candidate"))process.exit(1);process.stdout.write(require("fs").readFileSync(process.env.BRIDGE_TEST_MCP_CATALOG));process.exit(0)}')
    [IO.File]::WriteAllText($catalogFixture, '[]')
    [IO.File]::WriteAllText($adapter, ('require("fs").writeFileSync(' + (ConvertTo-Json -InputObject $capturedHome -Compress) + ',process.env.CODEX_HOME || "")'))
    # The inert adapter uses CommonJS so Node can report only its selected home.
    $adapter = [IO.Path]::ChangeExtension($adapter, '.cjs')
    Move-Item -LiteralPath (Join-Path $fixture 'adapter.mjs') -Destination $adapter
    $configPath = Join-Path $fixtureCodex 'config.toml'
    $original = "# Keep this user setting.`r`nmodel = 'existing-model'`r`n"
    [IO.File]::WriteAllText($configPath, $original, [Text.UTF8Encoding]::new($false))
    $first = Run-Installer
    Assert ($first.code -eq 0) $first.output
    $runtime = Join-Path $fixtureLocal 'webcodex-codex-bridge'
    $tokenPath = Join-Path $runtime 'bridge-token'
    $token = [IO.File]::ReadAllText($tokenPath)
    Assert ($token -match '^[0-9A-F]{64}$') 'Invalid generated token.'
    $installedConfig = [IO.File]::ReadAllText($configPath)
    Assert ($installedConfig.StartsWith($original.TrimEnd())) 'Existing Codex configuration was lost.'
    $backups = @(Get-ChildItem -LiteralPath (Join-Path $runtime 'backups') -Recurse -File -Filter 'config.toml-*')
    Assert ($backups.Count -eq 1 -and [IO.File]::ReadAllText($backups[0].FullName) -eq $original) 'Original configuration backup is missing.'
    $allowed = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18', 'S-1-5-32-544')
    foreach ($rule in (Get-Acl -LiteralPath $tokenPath).Access) {
        $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        Assert ($rule.AccessControlType -ne 'Allow' -or $sid -in $allowed) 'Token inherited access outside its intended user.'
    }
    $line = [regex]::Match($installedConfig, '(?m)^args = (.+)$').Groups[1].Value
    $arguments = ConvertFrom-Json -InputObject $line
    Assert ($arguments.Count -eq 3 -and $arguments[0] -eq (Join-Path $runtime 'bridge.mjs')) 'MCP arguments did not preserve the quoted path.'
    & $nodePath --check (Join-Path $runtime 'run-codex-acp.cjs')
    Assert ($LASTEXITCODE -eq 0) 'Generated ACP launcher has invalid syntax.'
    foreach ($providerHome in @('', (Join-Path $fixture 'provider-home'))) {
        $launch = [Diagnostics.ProcessStartInfo]::new()
        $launch.FileName = $nodePath
        $launch.Arguments = '"' + (Join-Path $runtime 'run-codex-acp.cjs') + '"'
        $launch.UseShellExecute = $false
        $launch.CreateNoWindow = $true
        $launch.RedirectStandardInput = $true
        $launch.EnvironmentVariables.Remove('NODE_OPTIONS')
        $launch.EnvironmentVariables.Remove('CODEX_HOME')
        if ($providerHome) { $launch.EnvironmentVariables['CODEX_HOME'] = $providerHome }
        $child = [Diagnostics.Process]::Start($launch)
        try { $child.StandardInput.Close(); $child.WaitForExit(); Assert ($child.ExitCode -eq 0) 'Launcher fixture failed.' }
        finally { $child.Dispose() }
        $expectedHome = if ($providerHome) { $providerHome } else { $fixtureCodex }
        Assert ([IO.File]::ReadAllText($capturedHome) -eq $expectedHome) 'Launcher lost the selected home or replaced an explicit provider home.'
    }
    $second = Run-Installer
    Assert ($second.code -eq 0) $second.output
    Assert ([IO.File]::ReadAllText($tokenPath) -eq $token) 'Reinstall unexpectedly rotated the live token.'
    Assert ([regex]::Matches([IO.File]::ReadAllText($configPath), '\[mcp_servers\.webcodex_codex_bridge\]').Count -eq 1) 'Reinstall duplicated the MCP entry.'
    [IO.File]::WriteAllText($catalogFixture, '[{"name":"webcodex_codex_bridge"}]')
    foreach ($header in @('[mcp_servers.webcodex_codex_bridge]', '[ mcp_servers . "webcodex_codex_bridge" ]', "[mcp_servers.'webcodex_codex_bridge']")) {
        $unmanaged = $original + "`r`n$header`r`ncommand = 'user-owned'`r`n"
        [IO.File]::WriteAllText($configPath, $unmanaged)
        $collision = Run-Installer
        Assert ($collision.code -ne 0) 'An unmanaged MCP entry was accepted.'
        Assert ([IO.File]::ReadAllText($configPath) -eq $unmanaged) 'An unmanaged MCP entry was overwritten.'
    }
    [IO.File]::WriteAllText($catalogFixture, '[]')
    $inlineParent = 'mcp_servers = { unrelated = { command = "user-owned" } }'
    [IO.File]::WriteAllText($configPath, $inlineParent)
    $rejected = Run-Installer -RejectCandidate
    Assert ($rejected.code -ne 0) 'Invalid candidate configuration was accepted.'
    Assert ([IO.File]::ReadAllText($configPath) -eq $inlineParent) 'Failed candidate validation changed the existing configuration.'
    Write-Output 'Installer checks passed: settings/backup, private token, launcher home/override, reinstall, parsed collisions and rejected candidate preservation.'
} finally {
    $resolved = [IO.Path]::GetFullPath($fixture)
    Assert ($resolved.StartsWith((Join-Path $fixtureParent 'webcodex-bridge-install-'), [StringComparison]::OrdinalIgnoreCase)) 'Fixture cleanup escaped its expected directory.'
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
