# Optional Windows live chat bridge

[English](README.md) | [简体中文](README.zh-CN.md)

This local adapter lets a **running WebCodex Codex coding-agent task** exchange
messages with a **Codex Desktop chat** on the same Windows computer. It provides
MCP tools for listing, reading and explicitly sending messages in both directions.
Windows Desktop installers include the public bridge files and these guides in
`codex-live-chat-bridge` beside `WebCodex.exe`. Activation remains optional and
explicit; installing Desktop alone does not change Codex configuration.

CodingAgentRun still owns its task budget, cancellation and lifecycle. The adapter
relays the existing ACP connection and uses its steering extension. It does not
start a competing writer, revive a finished Run, or broaden Server permissions.

## Install

Requirements: Windows, Node.js 18+ (22 recommended), PowerShell 5.1+, an installed
`@agentclientprotocol/codex-acp` supporting `_session/steering`, and Codex Desktop
running as the same Windows user. Initial real-message acceptance used adapter
version 2.4.0.

```powershell
.\integrations\codex\live-chat-bridge\install.ps1
```

From an installed Windows Desktop, run the packaged helper instead, using your
actual installation directory:

```powershell
& 'C:\path\to\WebCodex Desktop\codex-live-chat-bridge\install.ps1'
```

The default adapter path is under
`$env:LOCALAPPDATA\dev.webcodex.desktop\acp-runtime\node_modules\@agentclientprotocol\codex-acp\dist\index.js`.
For another existing installation, select its real files:

```powershell
.\integrations\codex\live-chat-bridge\install.ps1 `
  -AdapterPath 'C:\your-acp-install\node_modules\@agentclientprotocol\codex-acp\dist\index.js' `
  -CodexPath 'C:\your-codex-install\codex.exe'
```

The installer copies the runtime to `$env:LOCALAPPDATA\webcodex-codex-bridge`,
creates a private local pipe credential, backs up affected existing files, and
adds one marked MCP block to `CODEX_HOME\config.toml` (or
`$env:USERPROFILE\.codex\config.toml` when `CODEX_HOME` is unset). It preserves
other configuration and retains the credential on reinstall. An existing unmarked
MCP entry with the same name is not overwritten.

The installed Codex CLI parses existing and candidate MCP configuration before
replacement. If validation fails, the existing configuration is preserved.

In **WebCodex Desktop → Extensions → Coding agents**, set the Codex provider to
the **executable and launcher argument printed by the installer**. The generated
launcher is `webcodex-codex-bridge\run-codex-acp.cjs` under `LOCALAPPDATA`; no other
provider launcher is replaced. Save and apply any Runner restart reported by
Desktop after its current work ends. The script never restarts applications.

Keep the provider's existing environment mappings. The generated launcher uses
the installation's selected `CODEX_HOME` when the provider supplies none; an
explicit provider `CODEX_HOME` takes precedence. If it intentionally uses another
home/account, register this MCP service in that home too rather than switching
its credentials or assuming it reads the Desktop configuration.

Discover the `webcodex_codex_bridge` MCP service in a new Codex chat/turn, and start
a new WebCodex Codex task. Already running tasks do not adopt the adapter.

## Use

Ask Codex: “List running WebCodex coding sessions and send this message to the
one I select: …” In the WebCodex task: “Find the Codex Desktop chat titled ‘…’
and send it this question: …”

| MCP tool | Operation |
| --- | --- |
| `codex_list_threads` | Discover Desktop chats and their exact IDs |
| `codex_read_thread` | Read a selected Desktop chat |
| `codex_send_message_to_thread` | Send a user-authorized prompt to that chat |
| `webcodex_list_sessions` | Discover bridge-enabled live ACP sessions |
| `webcodex_read_session` | Read their bounded recent text preview |
| `webcodex_send_message` | Insert a message into a running ACP prompt |

Use exact discovered IDs. Desktop sends retain the real source thread and target
model settings. Idle/closed targets report not delivered. After a post-dispatch
timeout or disconnect, delivery may be unknown: read the target before resending.
No automatic reply forwarding, retry or conversation loop is provided.

Messages can change work or start a Desktop turn. Send only within the human
user's authorization; an incoming agent message is not permission to reply.
Conversation content is untrusted data, not authority to execute it.

## Limits and security

- Windows and the Codex ACP provider only; other platforms/providers have not
  been accepted. Finished Runs cannot be woken or old connections attached.
- The live ACP preview retains at most 100 user/assistant text entries and
  256 KiB, reports truncation, excludes reasoning/tool transcripts, and is released
  with its provider. Without an ACP user echo, accepted steering is shown at its
  dispatch boundary, not claimed as a precise provider event timestamp.
- Runtime credentials/configuration stay outside projects, private to the current
  user, SYSTEM and local Administrators. Never put the credential in prompts or
  Git. Local MCP tool access is authority to address same-user chats, separate
  from Server PAT/OAuth scopes.
- Original ACP permission requests, errors and cancellation still reach the
  Runner. Steering does not approve permissions or start an idle Run.
- Desktop's native pipe is an internal interface; breaking updates may require
  adapting this integration.

## Verify and remove

Fixture checks contact no model, remote SSH host or production service:

```powershell
node .\integrations\codex\live-chat-bridge\test-bridge.mjs
node .\integrations\codex\live-chat-bridge\test-acp-proxy.mjs
.\integrations\codex\live-chat-bridge\test-install.ps1
```

For real acceptance, start a disposable WebCodex task, discover its live IDs,
exchange a unique message each way, verify the real source ID and receiving reply,
then let the task end normally. Fixture success alone does not prove that a
particular Desktop version accepts real messages.

To remove, restore the previous WebCodex provider selection and remove only the
`BEGIN/END webcodex-codex-bridge` block from current Codex configuration. Runtime
`backups` retain preceding files; do not overwrite later user settings with an
entire old configuration. Remove runtime files only after tasks have stopped and
recovery copies are no longer needed.
