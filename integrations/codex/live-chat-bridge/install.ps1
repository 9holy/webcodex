#requires -Version 5.1
param(
    [string]$AdapterPath = (Join-Path $env:LOCALAPPDATA 'dev.webcodex.desktop\acp-runtime\node_modules\@agentclientprotocol\codex-acp\dist\index.js'),
    [string]$CodexPath
)
$ErrorActionPreference = 'Stop'

$runtimeDir = Join-Path $env:LOCALAPPDATA 'webcodex-codex-bridge'
$codexHomePath = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
if (-not [IO.Path]::IsPathRooted($codexHomePath)) { throw 'CODEX_HOME must be an absolute directory.' }
$codexConfig = Join-Path $codexHomePath 'config.toml'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
if (-not $CodexPath) {
    $CodexPath = Get-CimInstance Win32_Process |
        Where-Object { $_.Name -eq 'codex.exe' -and $_.CommandLine -match '\bapp-server\b' } |
        Select-Object -First 1 -ExpandProperty ExecutablePath
}
if (-not $CodexPath) { throw 'Open Codex desktop, or pass its existing executable with -CodexPath.' }
foreach ($target in @($AdapterPath, $CodexPath)) {
    if (-not [IO.Path]::IsPathRooted($target) -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw "Required absolute file is missing: $target"
    }
}
foreach ($name in @('bridge.mjs', 'acp-proxy.mjs', 'tools.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $name) -PathType Leaf)) { throw "Missing bridge source: $name" }
}
function Read-McpConfiguration([string]$ConfigHome) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $CodexPath
    $start.Arguments = 'mcp list --json'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['CODEX_HOME'] = $ConfigHome
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'Codex MCP configuration validation timed out.' }
        # The CLI parses every supported TOML form. Never print other MCP credentials.
        if ($process.ExitCode -ne 0) { throw 'Codex rejected the MCP configuration; the existing configuration was preserved.' }
        $catalog = ConvertFrom-Json -InputObject $stdout.Result
        return $catalog
    } finally { $process.Dispose() }
}
$originalConfig = if (Test-Path -LiteralPath $codexConfig) { [IO.File]::ReadAllText($codexConfig) } else { '' }
$beginMarker = '# BEGIN webcodex-codex-bridge'
$endMarker = '# END webcodex-codex-bridge'
$managedBlock = '(?ms)^# BEGIN webcodex-codex-bridge\r?\n.*?^# END webcodex-codex-bridge\r?\n?'
if ($originalConfig.Contains($beginMarker) -ne $originalConfig.Contains($endMarker)) {
    throw 'The existing bridge config markers are incomplete; preserve and inspect the config.'
}
$baseConfig = [regex]::Replace($originalConfig, $managedBlock, '')
$existingMcp = @(Read-McpConfiguration $codexHomePath)
if (-not $originalConfig.Contains($beginMarker) -and @($existingMcp | Where-Object { $_.name -eq 'webcodex_codex_bridge' }).Count) {
    throw 'An unmanaged MCP entry uses webcodex_codex_bridge. It was not overwritten.'
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$privateAcl = [Security.AccessControl.DirectorySecurity]::new()
$privateAcl.SetOwner($identity)
$privateAcl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($identity, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
    $privateAcl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $runtimeDir -AclObject $privateAcl
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupDir = Join-Path $runtimeDir "backups\$stamp"
New-Item -ItemType Directory -Path (Join-Path $backupDir '.codex') -Force | Out-Null
if (Test-Path -LiteralPath $codexConfig) {
    Copy-Item -LiteralPath $codexConfig -Destination (Join-Path $backupDir ".codex\config.toml-$stamp")
}
foreach ($name in @('bridge.mjs', 'acp-proxy.mjs', 'tools.json', 'config.json', 'run-codex-acp.cjs')) {
    $existing = Join-Path $runtimeDir $name
    if (Test-Path -LiteralPath $existing) { Copy-Item -LiteralPath $existing -Destination (Join-Path $backupDir "$name-$stamp") }
}
foreach ($name in @('bridge.mjs', 'acp-proxy.mjs', 'tools.json')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $runtimeDir $name)
}
$tokenPath = Join-Path $runtimeDir 'bridge-token'
if (-not (Test-Path -LiteralPath $tokenPath)) {
    $bytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    [IO.File]::WriteAllText($tokenPath, ([BitConverter]::ToString($bytes).Replace('-', '')), [Text.UTF8Encoding]::new($false))
}
$configPath = Join-Path $runtimeDir 'config.json'
$config = @{ bridgeTokenFile = $tokenPath; adapterPath = $AdapterPath; codexPath = $CodexPath; codexHomePath = $codexHomePath }
[IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$configLiteral = ConvertTo-Json -InputObject $configPath -Compress
$proxyLiteral = ConvertTo-Json -InputObject (Join-Path $runtimeDir 'acp-proxy.mjs') -Compress
$wrapperPath = Join-Path $runtimeDir 'run-codex-acp.cjs'
$wrapper = @"
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const config = JSON.parse(fs.readFileSync($configLiteral, 'utf8'));
  if (!process.env.CODEX_HOME) process.env.CODEX_HOME = config.codexHomePath;
  if (!fs.existsSync(config.codexPath)) {
    const root = path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    const candidates = fs.readdirSync(root).map(name => path.join(root, name, 'codex.exe')).filter(file => fs.existsSync(file));
    candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!candidates.length) throw new Error('Codex CLI is missing. Open or repair Codex desktop.');
    config.codexPath = candidates[0];
  }
  await (await import(pathToFileURL($proxyLiteral).href)).startProxy(config);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
"@
[IO.File]::WriteAllText($wrapperPath, $wrapper, [Text.UTF8Encoding]::new($false))
$bridgePath = Join-Path $runtimeDir 'bridge.mjs'
$commandLiteral = ConvertTo-Json -InputObject $nodePath -Compress
$argsLiteral = ConvertTo-Json -InputObject @($bridgePath, '--config', $configPath) -Compress
$block = @"
$beginMarker
[mcp_servers.webcodex_codex_bridge]
command = $commandLiteral
args = $argsLiteral
startup_timeout_sec = 10
tool_timeout_sec = 90
$endMarker
"@
New-Item -ItemType Directory -Path $codexHomePath -Force | Out-Null
$candidate = $baseConfig.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
$validationHome = Join-Path $backupDir 'candidate'
New-Item -ItemType Directory -Path $validationHome -Force | Out-Null
$validationFile = Join-Path $validationHome 'config.toml'
try {
    [IO.File]::WriteAllText($validationFile, $candidate, [Text.UTF8Encoding]::new($false))
    Read-McpConfiguration $validationHome | Out-Null
} finally {
    Remove-Item -LiteralPath $validationFile -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $validationHome -ErrorAction SilentlyContinue
}
[IO.File]::WriteAllText($codexConfig, $candidate, [Text.UTF8Encoding]::new($false))
Write-Output "Installed local MCP bridge: $runtimeDir"
Write-Output "Recovery backup: $backupDir"
Write-Output 'Set the WebCodex Codex coding agent to this command and argument; the next run uses the bridge:'
Write-Output "Executable: $nodePath"
Write-Output "Argument: $wrapperPath"
