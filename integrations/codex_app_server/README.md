# Codex app-server provider

[简体中文](README.zh-CN.md)

This bundled Python 3.10+ adapter lets an authorized WebCodex CodingAgentRun use
the installed Codex CLI's actual app-server. Codex reads and changes files, runs
its native commands, and uses the MCP servers and skills configured for that
Codex installation. The adapter translates real thread/turn events and approval
requests into the existing ACP Run lifecycle. It does not emulate tools by name.

The upstream interface is experimental. Enable this provider explicitly, pin an
installation through preparation, and validate it on the target machine before
depending on it. Compatibility preparation is not a model benchmark or proof
that a particular account, MCP service, or operating-system sandbox is ready.

## Install and configure

The native WebCodex packages embed the adapter sources; no repository checkout,
pip package, or additional adapter download is required. Python 3.10+ and a
compatible Codex CLI installation remain explicit prerequisites. Install and
authenticate Codex under the same OS account that runs the Runner. A custom
CODEX_HOME must be an existing directory accessible to that account.

In Desktop's **Coding agents** page, use **Prepare Codex**, choose the installed
executables when automatic discovery is insufficient, and review the generated
profile. Preparation returns a disabled profile. Save and enable it through the
normal provider configuration workflow, then apply the Runner configuration as
shown by Desktop. Existing configured providers are not silently replaced.

Network access is off by default. Select **Allow network access** during Codex
preparation when this provider needs to download dependencies, push commits, or
contact deployment services. After saving and applying the profile, subsequent
Runs use that setting while retaining workspace-write and on-request approval.
Service credentials are still configured separately; this option does not add
GitHub tokens, SSH agent credentials, or permission to write outside the Project.

The headless preparation command creates the same reviewable profile:

```sh
webcodex coding-agent prepare-codex --experimental --json
```

Add `--network` to explicitly select the same network permission from the CLI.
The setting is stored in the generated provider arguments, not in a separate
permission registry or the installation compatibility receipt. Prepare and save
the provider again to change it, then apply the configuration shown by Desktop.

For an explicit installation:

```sh
webcodex coding-agent prepare-codex --experimental \
  --codex-bin /absolute/path/to/codex \
  --python-bin /absolute/path/to/python3 \
  --config-dir /absolute/private/webcodex-config \
  --expected-version YOUR_EXACT_INSTALLED_VERSION --json
```

This command prepares resources and a compatibility receipt. It does not edit
Runner TOML, enable a provider, grant OAuth scopes, log in, or restart a service.
The JSON profile can be supplied to an existing configuration owner. Desktop
handles the save/revision/enable flow for interactive users.

Windows .cmd/.bat/PowerShell launchers are not executed through a shell. Select
the actual native Codex executable, or explicitly configure a native Node
executable plus its fixed absolute Codex launcher script with --codex-arg. The
same fixed launcher arguments are used for version detection, schema generation,
and app-server execution; model input cannot replace them.

Preparation invokes the selected executable's --version and
app-server generate-json-schema --experimental. It validates the protocol subset
used by this adapter, then stores the exact version, executable/explicit script
hashes, and schema digest in a private receipt. It does not restrict installations
to the developer's alpha build, and does not accept an arbitrary version flag as
proof of compatibility. An incompatible schema fails closed. A changed version
or executable requires explicit preparation again. Each native preparation uses
a separate receipt, preserving already configured providers.

## Authorization and approvals

The caller needs the existing coding_agent:run and project:write grants to start
a Run. Observing, cancelling, and approving still require their own canonical
authorization and ownership checks. In particular, installing this provider
does not grant the separate coding_agent:approve scope. See the
[ACP Run contract](../../docs/agent/acp-coding-agent-run.md) and
[authority model](../../docs/agent/permission-model.md).

The adapter uses on-request approval with the user reviewer. Its default native
sandbox is workspace-write in the exact admitted Project, with network disabled
and implicit temporary-directory write roots excluded. It checks the effective
thread policy before submitting a prompt. An unexpected cwd, sandbox mode,
reviewer, broader network access, or additional write root is a setup failure. A
stricter initial network policy is allowed; the turn carries the operator's
explicit network setting. There is
no danger-full-access or unsandboxed shell fallback. An operator may explicitly
enable network during preparation or select read-only mode in provider arguments; callers
cannot inject these changes through the prompt or ACP config options.

Command and file approval requests become ACP session/request_permission calls
with complete bounded command/cwd, file diff, or requested permission details.
The user selects an advertised option through the WebCodex approval flow. The
adapter never makes that selection itself. Command/file approval maps to native
accept or decline for the exact outstanding request; it does not send
acceptForSession or persistent policy amendments. Permission-profile approval
returns exactly the requested permissions with scope: turn, and states that scope
in the displayed option. Denial grants none. Cancellation/timeout never grants.

Replies are bound to the original native thread, turn, request, and ACP request
ID. A duplicate or late selection cannot approve a newer request. Approval
details that cannot be presented completely within the 60 KiB adapter limit
fail closed, rather than offering approval of truncated content.

Native tools run under Codex's sandbox and the Runner's OS account. This does
not make WebCodex file-tool revision guards apply to every internal Codex action.
Configured external MCP services retain their own account and permission
boundaries. WebCodex Run admission, identity, ownership, and process-tree cleanup
remain authoritative.

## Supported lifecycle and explicit limits

Each adapter process accepts one ACP session and one prompt. It initializes the
native server, creates a new ephemeral thread, starts one turn, forwards text and
normalized command/file/MCP activity, and returns success only after the matching
native turn/completed notification. Partial text, a successful turn/start reply,
or an accepted turn/interrupt request is not terminal success.

session/cancel interrupts the same native turn. If terminal interruption is not
confirmed within the cancellation deadline, the outcome is an explicit failure,
and the Runner cleans up its owned process tree. EOF, malformed frames, lost
responses, and deadlines never create a replacement turn. Keep observing the
original WebCodex Run after uncertain dispatch.

The current slice does not load/resume/fork stored Codex threads, accept a second
prompt, offer turn/steer, bridge arbitrary dynamic tools, or translate generic
user questionnaires and MCP form/URL elicitation. Unsupported native interactive
requests receive an explicit protocol error and fail the Run; they do not hang
or receive fabricated answers. Approval requests for an unbound child thread
also fail closed. Native capabilities that do not require these host interactions
remain available according to the installed Codex and its configuration. A
ChatGPT-internal connector, hosted browser, search service, or image generator is
not automatically recreated by this adapter or by supplying an API key.

Bounds: 1 MiB per JSON-RPC frame, 64 KiB prompt, 32 MiB native traffic, 8,192 native
events, 256 retained item identities, 64 native requests, eight queued approvals,
and 1 MiB forwarded text by default. Permission waits default to 300 seconds and
are capped at 600 seconds; the Runner's own permission and overall Run deadlines
may be shorter. Overall adapter execution is capped at 3,600 seconds. Stdout is
ACP-only; native stderr, credentials, and arbitrary native error bodies are not
forwarded. The Runner injects only explicitly mapped environment variables.

## Validation and packaging

```sh
python3 -m unittest discover -s integrations/codex_app_server/tests -v
python3 -m unittest scripts.tests.test_codex_app_server_package -v
cargo test --locked --profile dogfood -p webcodex-environment codex_app_server
cargo test --locked --profile dogfood -p webcodex-cli coding_agent
cargo test --locked --profile dogfood -p webcodex-runner codex_app_server_adapter
```

The Python fixtures launch the real adapter and a separate stdio process, perform
Project-local effects after explicit approvals, and check denial, cancellation,
identity/replay safety, schema/version changes, policy boundaries and bounded
failures. The Runner test covers the actual Runner-to-ACP-to-app-server bridge.
Fixtures do not require a paid model or real credentials. A target-machine test
with a configured Codex account is still required for real model/tool readiness.

For a standalone distribution, the deterministic stdlib packaging script emits a
self-contained zipapp using the same embedded sources:

```sh
python3 scripts/package_codex_app_server_adapter.py --output /absolute/path/webcodex-codex-app-server.pyz
python3 /absolute/path/webcodex-codex-app-server.pyz prepare --experimental \
  --receipt /absolute/private/codex-compatibility.json
```

Protocol reference: [official Codex app-server documentation](https://learn.chatgpt.com/docs/app-server).
The installed binary's generated schema is the version-specific compatibility
source; website examples do not override it.
