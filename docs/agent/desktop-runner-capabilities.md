# Desktop Runner capabilities: ACP discovery and managed SSH

The original increment addressed #616 and #603 by exposing existing Runner
capabilities. SSH connection setup now also supports an explicit host, port,
account, authentication method, and host-key confirmation. Both setup paths use
the Runner's one canonical managed SSH registry. There is no second ACP runtime,
provider auto-download, ACP hot reload, or automatic SSH configuration import.

## User workflow

The existing **Extensions** route now starts with first-class tabs for **Coding
agents**, **SSH resources**, **MCP servers**, **Skills**, and **Instructions**.
Native Tool Plugins remain under Advanced. Project selection and instruction/
Skill path management stay on their project-specific tabs.

### Coding Agents

1. Install an ACP-compatible executable through an operator-controlled process.
2. Choose **Add coding agent**, then supply its name, logical Provider ID,
   absolute executable path, and JSON array of literal arguments.
3. Advanced settings optionally map child environment variable names to Runner
   environment variable names, allow specific ACP configuration options, and
   manage global concurrency/permission timeout settings.
4. **Save** commits Desktop desired state. It neither writes the active Runner
   configuration nor restarts Runner, Server, or Tunnel.
5. **Saved · Restart Runner to apply** remains visible until the explicit
   **Restart Runner** action applies the desired state. Availability is then
   re-observed from that exact Runner, not inferred from the saved form.

Environment mapping is names-to-names only, for example
`OPENAI_API_KEY ← SUB2API_API_KEY`. No environment values are resolved by Desktop.
Credentials belong in operator-controlled environment/private agent configuration,
not in executable arguments or the form. No provider is installed at run start.

Configured and Active are independent facts. A disabled/removed/reconfigured
provider can still be advertised by the old running process until restart.
Advertised providers that are not in Desktop desired state are shown read-only.
The displayed name and logical ID must match the live advertisement before a
Desktop-managed row is shown as Active.

### SSH Resources

The inventory always comes from the exact Desktop Runner's canonical
`manage_ssh_resource` gateway. It shows only name, Managed/Static source, active state,
and pending-restart state. Static resources have no Remove action.

**Add SSH resource** defaults to a direct connection: resource name, host/IP,
port (22 by default), username, authentication method, and optional remote
working directory. Password authentication accepts a write-only password;
identity-file authentication refers to a key on the **Runner's machine**, with
an optional write-only passphrase. Existing-environment authentication uses that
Runner account's default keys or agent. Direct connections have an isolated
OpenSSH configuration and do not inherit aliases, jump hosts, or proxy commands.

The operator first inspects the host key, compares the displayed SHA-256
fingerprint with the server administrator's trusted fingerprint, and explicitly
confirms it. Inspection alone never establishes trust. A bounded challenge binds
the selected key to the exact endpoint, Runner process, and registry revision.
Connection tests and saving authenticate against that exact key. A changed key,
expired challenge, incorrect password, or unavailable SSH client produces a
specific closed error; none silently disables host-key verification or retries
with weaker authentication.

The advanced OpenSSH-target mode still accepts `user@host`, a hostname, an
`ssh://user@host:port` destination, or an existing alias such as `special`.
It retains the Runner's existing OpenSSH configuration. Desktop does not import
`~/.ssh/config` or copy a local key to a different Runner.

After submission, connection fields and secrets are cleared from the transient
form. Inventory still returns logical names and lifecycle state only. Credentials
are stored in private, owner-checked files on the Runner, separately from the
managed registry; they are not an operating-system encrypted password vault.
They do not enter model tool arguments, Workflow Session history, or full tool
traces. There is no Desktop connection-history database. To change a saved
connection, remove its managed resource and add it again. Removing the reference
does not remove files on the remote machine.

**Loaded** means the running Runner loaded that configuration; it is not a live
connection or a successful login assertion. A successful connection test is
evidence about that form's endpoint, key, and credentials at that moment. Saving
still stages desired state and explicitly restarting the Runner applies it.
Chat can then select the active logical resource without receiving its password.

Every mutation consumes a fresh observation and immediately re-lists. An uncertain
result remains explicitly uncertain even when the subsequent list succeeds.
**Operation status uncertain. Refresh resources before retrying** is not an
invitation for an automatic mutation retry: register/remove are each sent at most
once per explicit submission. Runner replacement and stale-registry errors also
discard old observations.

## ACP discovery contract

`get_runtime_status` (full, compact, and exact-Runner focus), `list_runners` (full and
summary), the Desktop Runner overview, and Project startup use a dedicated safe
summary type:

```json
{
  "coding_agent_providers": [
    { "provider_id": "pi", "name": "Pi Agent" }
  ]
}
```

The summary is bounded to the canonical provider limit and contains only logical
ID and display name. It never serializes `provider_instance_id`, executable,
arguments, cwd, environment, source environment names, configuration paths, or
ACP session identifiers. Runner visibility continues to be authorized before
projection. Empty, null, or absent old inventories yield an empty safe list;
an old Runner serializing an empty list does not acquire execution capability.

Project startup selects only the Project's online owning Runner from the already
authorized runtime observation. It does not merge fleet inventories or establish
a default provider. The compact `work_on_project` projection retains this field,
so normal project entry naturally exposes provider choices. Instruction content
can still specify a preferred provider; Server does not choose one implicitly.

`coding_agent_provider_unavailable` remains a not-started error. It includes the
exact Runner's safe available providers and a mechanical `get_runtime_status` call
for re-observation. It does not search PATH, substitute a provider, or retry a
different logical ID. Existing internal Runner/provider replacement fences remain
unchanged.

## Desktop ACP ownership and persistence

`coding-agents.json` is Desktop desired state, with a schema version, monotonic
revision, private stable owner UUID, provider profiles, optional global settings,
and retained managed-ID tombstones. It is bounded, rejects malformed state, and
uses compare-and-swap atomic persistence. Invalid state is not treated as an
empty writable configuration.

Reconciliation writes a `desktop_owner` marker on each owned `[[acp.agents]]`
entry. It is configuration ownership metadata, not model-facing provider identity.
Existing operator entries are never adopted solely because their IDs match:
matching IDs without the exact ownership marker are conflicts. Removal and rename
retain old IDs as tombstones. The same desired state is reconciled when restarting
Runner or generating/selecting enrollment slots, so an older A/B slot cannot
resurrect an entry the Desktop removed.

Both table-array and inline-array TOML are supported. Unrelated entries, comments,
server URL, client ID, token, policy, and other capability settings are preserved.
The combined operator/Desktop enabled-provider count must fit Runner's limit.
Global settings remain untouched unless explicitly managed through Advanced.

Save stages and validates a candidate against the exact current configuration
before committing desired state. Runner startup preflights ACP ownership before
capability reconciliation. ACP is still in the restart-required configuration
domain; there is no hot replacement or fabricated Active result.

## Closed SSH native boundary

The WebView has closed native commands for listing, inspecting, probing,
registering, and removing SSH resources. It cannot choose an arbitrary runtime
tool, endpoint, Runner, header, or WebCodex credential. Native code calls only
the fixed `/api/runtime-console/ssh-resources/` operator endpoints with the current
connection's private user token. These endpoints require first-party operator
credentials with `ssh:local`; OAuth/model, Agent, Shared Key, and Project
credentials cannot use them. Runner visibility, ownership, exact-instance,
revision, and binding checks remain in the canonical SSH gateway.

The model-facing `manage_ssh_resource` schema remains list/register/remove for
existing OpenSSH destinations. It never admits passwords, passphrases, host-key
trust, or arbitrary operator actions. Structured setup requires the Runner's
explicit `ssh_connection_setup` capability, so older Runner processes are never
sent an operation they cannot decode.

Only an opaque Desktop observation ID is projected to the WebView.
The canonical Server binding stays native. Its native observation is tied to the
Server/Runner/configuration/credential-file identity. A local single-flight gate
serializes operations; inspection and probing preserve the observation, while a
mutation consumes it once. The Server independently enforces binding/revision.
The Desktop state lock is not held across network I/O. Late reads are discarded
when the connection changes or shutdown begins.

HTTP requests do not follow redirects. Request/response sizes and credential reads
are bounded. HTTP transport uncertainty, malformed mutation responses, or lost
native IPC responses never trigger another mutation. Error presentation uses a
closed vocabulary rather than raw response/parser text.

## Explicit enrollment and legacy local authorization

The SSH gateway still requires `ssh:local`; calling it with an old under-scoped
user token does not bypass that check.

New administrator-issued pairing codes can explicitly opt into Runner capability
access with `runner_capabilities: true`, or CLI `pairing create
--runner-capabilities`. The issuance record, not the enrolling client's body,
determines the grant. Local Desktop setup requests this opt-in using its existing
operator authority. Old persisted codes migrate with the flag false, and old
transport tokens do not gain SSH or coding-agent permissions.

An existing Desktop-owned local connection can choose **Authorize Runner
capabilities** from either **Coding agents** or **SSH resources**, review the
same scope description, and explicitly confirm. The shared flow observes current
user-token scopes through a closed native `runner_capability_authorization` call
to `/api/pairing/runner-capabilities/status`. This read needs `runtime:read`, not
SSH access, a Project, provider inventory, or an online SSH registry. Coding-only
legacy connections therefore discover the upgrade without ever opening SSH.
Connection changes discard the previous confirmation; unavailable observations
are not interpreted as permission. Grant results are re-observed with the user
token independently of SSH inventory; uncertain grants are never retried automatically. This uses
a narrow native-only call to `/api/pairing/runner-capabilities` with the local
Server operator credential and a hash identifying the existing user token. The
endpoint requires account-management plus administrator/bootstrap authority,
an online exact Runner whose owner matches that user, and a live unbound user
key. It adds only `ssh:local` and `coding_agent:run` using a fenced database update.
It cannot accept arbitrary scope names. Token bytes, owner, expiration, revocation,
and Runner transport credentials are unchanged.

The local grant reads the bound address and operator credential from one bounded
private environment-file snapshot and sends neither value nor token hash to the
WebView. Only literal loopback HTTP endpoints with an explicit port are eligible.
Remote connections require an operator-approved pairing code instead. Grants are
never attempted automatically, including after a failure. No Server, Runner, or
Tunnel restart is required for the scope update.

ACP callback approval is a separate opt-in. The ordinary grant above never adds
`coding_agent:approve`. A separately confirmed native request with
`permission_approval: true` adds only that scope to the exact existing user key;
it does not fill in missing SSH, Run, Project or administrator scopes. Status
adds `permission_approval`, and older Servers omitting it do not acquire support
by inference. The Desktop clears the confirmation when the connection changes
and re-observes the same credential after the grant.

The approval panel reads caller-owned Run inventory and complete bounded
`pending_permission` details, then sends the fixed canonical
`respond_coding_agent_permission` tool with one exact `run_id`, `request_id` and
selection/cancellation. Native connection and settings-generation fences remain
in force before and after the request. A response receipt is not provider
completion; the panel refreshes the same Run and never retries a mutation
automatically. The configured permission wait defaults to 300 seconds, accepts
1–600 seconds, and cannot outlive the Run's remaining deadline.

This grants an approval capability to a trusted client, not an unforgeable human
identity. Every program given the same approval-capable credential has the same
authority. Keep it separate from clients that should only start/observe Runs;
existing OAuth clients and grants are not silently widened.

Detached process authority is another independent opt-in. **Settings → Files & permissions →
Long-running background processes** uses the same canonical status/grant flow
with `detached_execution: true`. It adds only
`job:detach` to the exact eligible user key, never SSH, Coding Agent, ordinary
Job/Project or administrator authority. The selector is mutually exclusive with
the approval selector. An absent status field on an older Server means support
is unknown, not authorized. This scope permits an explicitly requested native
process on the Runner to outlive Runner restart/replacement. Named SSH sessions
do not support detached native argv; remote services use their server's service
manager through the SSH account. This scope does not establish reboot persistence
or grant a remote OS account service-management rights. Existing Chat credentials
must be re-observed and OAuth reauthorized separately when necessary.

Status remains a POST with an empty JSON object. New native clients explicitly
negotiate the additive field using
`x-webcodex-runner-capability-status: detached-execution-v1`; only this exact
value enables the `detached_execution` projection. Missing or unknown values
retain the published three-field response for older Desktop parsers. An older
Server ignores the header and the newer client reports this opt-in unavailable,
without retrying or inferring authority.

## Codex configuration and approval UI contracts

Desktop exposes **Configure Codex (experimental)** on the existing Coding agents page. The native `prepare_codex_coding_agent` request carries the captured `SettingsTarget` and desired-state revision. It rejects a replacement connection or stale manifest before installing resources or running a probe. It calls the shared `webcodex_environment::codex_app_server::prepare_codex` helper on a bounded worker: bundled source resources, Python/Codex discovery, exact version/schema checks, a unique private receipt, and a disabled typed profile. It does not save desired state, authorize scopes or restart processes.

The successful dialog presents **Save and enable Codex**. That explicit action uses the existing `save_coding_agent` revision/ownership transaction, with `enabled: true`; a replacement names the existing Desktop-owned provider. Uncertain saves require observation before another attempt. The normal apply bar exposes **Restart Runner**. Executable paths, up to eight fixed launcher arguments and the optional exact version are advanced inputs; no TOML-edit instruction is part of the normal product flow.

The dialog also exposes an unchecked **Allow network access** option. The
explicit `allow_network` input is passed through the shared preparation helper
and must exactly match the resulting provider's `serve --network` arguments.
The existing profile arguments remain the single authority for this setting;
the compatibility receipt does not become a second permission store. Applying
the setting keeps `workspace-write`, the exact Project writable root and
`on-request` provider approval. It does not expand inherited credentials or
enable unrestricted filesystem access. CLI preparation uses the corresponding
explicit `prepare-codex --network` option.

The Web **Runtime → Approvals** tab and Desktop **Coding agents → Review approvals** share the same bounded request/receipt UI. It renders complete provider `details` as escaped plain text, offers only actual one-time provider options plus explicit cancellation, fences component state by connection identity, disables expired requests and synchronously locks double submissions. Polling never interrupts a slower in-flight read. The UI rejects an HTTP-success response unless the canonical tool also returns `success: true` and `output.response_accepted: true`; stable `output.error_kind` values carry permission/stale failures without exposing arbitrary diagnostic text.

Desktop's closed `workspace_query` vocabulary adds `coding_agent_runs` and `coding_agent_permission`, each with the exact expected settings target. The native bridge verifies that target before dispatch, keeps credentials native, and retains the existing runtime/operation generation fence after dispatch. Inventory uses `/api/runtime-console/coding-agent-runs`; the mutation calls only `/api/tools/call` with the fixed `respond_coding_agent_permission` tool. The Web adapter uses the same routes and its credential-revision fence. Read coalescing never includes a mutation.

## Validation and manual acceptance

Automated coverage includes safe full/compact/focused discovery, Project ownership,
old inventory compatibility, unavailable-provider recovery, desired-state CAS and
restarts, A/B tombstones, operator collisions/comments, names-only environment
mapping, closed SSH requests, single-use observations, static read-only behavior,
stale/replaced/conflict/uncertain outcomes, bounded HTTP transport, explicit grants,
old-code schema migration, and accessible UI workflows. Native HTTP fixture tests
drop a mutation response after receiving it and assert `list → register → list`,
never `register → register`.

These tests are not a substitute for deployment, native Computer Use, or an actual
model-backed Pi run. Acceptance must record these independently:

| Layer | Required evidence |
| --- | --- |
| Fixture ACP E2E | Desktop Add/Save/Restart, actual advertisement, fresh Project bootstrap, start/observe to terminal against the repository fixture |
| Real Pi ACP E2E | Pinned installed adapter/platform versions, real executable, ACP session and terminal output on a safe read-only Project |
| sub2api + Grok | Actual authenticated local model inventory, selected returned Grok ID, evidence of a request and returned output, no provider/model/API fallback |
| SSH/Computer Use | Accessible Add/Refresh/Active/Remove on the native Desktop, a controlled read-only SSH command, and removal of only the temporary managed resource |
| Deployment safety | Independent control-plane access, current rollback/build identities, protected independent Runner hash unchanged, and unchanged Server/Tunnel identity across Runner-only actions |

On the implementation host, the independent mini control Runner was offline and
the existing local sub2api model endpoint returned HTTP 401. Those are acceptance
blockers, not successful dogfood evidence. Do not install a second API service,
guess a Grok model ID, expose credentials, silently switch providers, or deploy by
stopping the Desktop from its own managed Runner to work around them.
