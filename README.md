<p align="right"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a></p>

<p align="center"><img src="docs/assets/brand/webcodex-app-icon.png" alt="WebCodex" width="96" height="96"></p>

<h1 align="center">WebCodex</h1>

<p align="center"><strong>Give cloud AI agents a real development environment on your own machines.</strong></p>
<p align="center">Connect ChatGPT, Claude, and other MCP clients to the repositories, Git checkout, and tools you already use.</p>
<p align="center"><a href="docs/unified-installation.md">One computer</a> · <a href="docs/unified-installation.md#several-computers">Several computers</a> · <a href="#what-this-fork-adds">Fork differences</a> · <a href="#documentation">Documentation</a> · <a href="https://github.com/9holy/webcodex/issues">Issues</a> · <a href="CONTRIBUTING.md">Contribute</a> · <a href="SECURITY.md">Security</a></p>

<p align="center">
  <a href="docs/MCP.md"><img src="https://img.shields.io/badge/protocol-MCP-2563EB?labelColor=1E40AF&amp;style=flat-square" alt="MCP protocol"></a>
  <a href="docs/QUICK_START.md#prerequisites"><img src="https://img.shields.io/badge/Node.js-18%2B-0D9488?labelColor=0F766E&amp;style=flat-square" alt="Node.js 18 or newer"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-2563EB?labelColor=1E40AF&amp;style=flat-square" alt="Apache 2.0 license"></a>
</p>

WebCodex is a self-hosted tool runtime: a Server authenticates requests and routes them to a Runner on the machine that owns the repository. Ask your assistant to inspect a repository, modify code, run tests, use Git, or investigate a failure. You do not need to move the project into a hosted workspace; requested file content and other tool results can still be returned to the AI client.

**This repository is [9holy/webcodex](https://github.com/9holy/webcodex), a fork of [yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex).** The upstream author and contributors created WebCodex's core architecture, tools, Desktop application, and documentation. This fork builds on that work under the same [Apache 2.0 license](LICENSE), with additional work on coding-agent integration, connection setup, permissions, and Windows upgrades.

## What this fork adds

The following describes changes in this fork's source. Published availability and platform acceptance are recorded in the corresponding [fork release](https://github.com/9holy/webcodex/releases); source implementation alone does not establish that every installer or real account has passed validation.

| Area | Changes in this fork |
| --- | --- |
| **Native Codex integration — experimental** | Prepare an installed Codex CLI as a coding-agent provider and run its actual app-server through WebCodex. It uses that installation's native tools, configured MCP servers, and Skills within the supported Run lifecycle. See the [provider guide and limits](integrations/codex_app_server/README.md). |
| **Approvals and network access** | Review coding-agent permission requests in Desktop or Runtime Console and send an explicit decision for the exact request. Approval access is a separate grant. Codex preparation also exposes an optional network-access setting, off by default, while retaining Project boundaries and operation approvals. See [Codex setup and approvals](docs/desktop-guide.md#configure-codex-and-review-coding-approvals). |
| **SSH connection setup** | Enter a host/IP, port, username, and password or private-key file, with a passphrase for encrypted keys. Inspect and trust the host fingerprint, test authentication, then save the resource. Existing OpenSSH aliases remain available. Credentials stay in protected Runner storage; Chat uses the resource name. See [Add an SSH server](docs/desktop-guide.md#add-an-ssh-server). |
| **Explicit background-process authorization** | Grant `job:detach` separately for long-running local processes. OAuth setup exposes capability choices and the replacement/reauthorization flow for an existing client; authorizing Desktop does not silently expand another Chat connection's access. See [Desktop permissions](docs/desktop-guide.md#configure-codex-and-review-coding-approvals) and [MCP authorization](docs/MCP.md). |
| **Windows installation and upstream upgrades** | Choose a folder for a new installation, preserve an existing installation's folder and user data on supported upgrades, and use guarded Runtime replacement and recovery. The full installer also coordinates installed Server/Runner services. See [Windows installation and upgrades](docs/desktop-install.md#1-install-webcodex-desktop). |
| **Recovery from silent Runner connections** | Detect an unresponsive registered connection, close it, and reconnect with the same Runner instance and retained Job inventory. Recovery preserves existing authority and does not replay commands or recreate persistent Shells. See [Runner connection and Job recovery](docs/RUNNER.md). |
| **Clearer activity failures** | Show available error categories and next steps, with expandable technical details. A failed task-finalization call is distinguished from the execution result. Older records without a retained reason say so instead of inventing a diagnosis. See [Desktop activity](docs/desktop-guide.md#activity-settings-and-background-operation). |

The Codex provider is an experimental integration with the installed Codex, with [explicit lifecycle and interaction limits](integrations/codex_app_server/README.md#supported-lifecycle-and-explicit-limits). It does not promise full parity with every Codex interface or recreate ChatGPT's private connectors, hosted browser, search, or image-generation services. External services and operating-system actions still require their own credentials and permissions.

The upstream project's community recognition is retained below:

<p align="center">
  <a href="https://trendshift.io/repositories/121867">
    <img src="https://trendshift.io/api/badge/repositories/121867" alt="Upstream yyjeqhc/webcodex | GitHub Trending" width="250" height="55" />
  </a>
</p>

## Start using WebCodex

For a persistent setup, download the complete installer for your operating system and architecture from [this fork's Releases](https://github.com/9holy/webcodex/releases). Choose the setup that matches where your code lives:

- **One computer:** install WebCodex on your personal workstation, open Desktop, and follow [Unified installation](docs/unified-installation.md). This setup includes Desktop, CLI, Server, and Runner in one platform package.
- **Several computers:** install the same package on the machine that will host the WebCodex Server and on each machine that owns repositories. Follow [Unified installation](docs/unified-installation.md#several-computers) and [Deployment validation](docs/unified-deployment-validation.md).

The complete installer includes Desktop, CLI, Server, and Runner. On Windows, use the `webcodex-unified-…-win32-x64.exe` file for a typical Intel/AMD PC, or `win32-arm64.exe` for an ARM PC. For an existing installation, follow [Desktop installation and upgrades](docs/desktop-install.md) and the selected Release's notes before upgrading.

Each Release lists its available files and validation evidence. Native builds and automated installation checks do not cover every real desktop, reboot, or upgrade scenario; the [validation checklist](docs/unified-deployment-validation.md) explains those boundaries. For a temporary one-repository trial, see [Quick Trial](docs/QUICK_START.md) and `webcodex share`. For a source preview, follow [Desktop development](docs/DESKTOP_DEVELOPMENT.md#linux-source-preview-against-an-existing-server) at the revision you intend to evaluate.

For Linux machines that join an existing Server without Desktop, see [Runtime installation and CLI join](docs/runtime-installation.md). For advanced self-hosting, npm/runtime archives, Docker, or historical release artifacts, see [Deployment](docs/DEPLOYMENT.md).

The `@yyjeqhc/webcodex` npm package referenced in the inherited guides is an upstream distribution. To use this fork's changes, select an asset from this fork's Releases or build this repository's chosen revision; installing the upstream npm package does not select this fork.

## What can it do?

- **Understand and edit code** — read, search, inspect, and make guarded changes inside configured projects.
- **Use the real toolchain** — run commands, tests, formatters, compilers, and project-specific tooling on the machine that owns the repository.
- **Work with Git** — inspect status and diffs while keeping repository operations visible and reviewable.
- **Handle long-running work** — keep jobs observable instead of requiring one model turn to stay open indefinitely.
- **Support human review** — use the [Runtime Console](docs/runtime-console.md), Workflow Session evidence, Jobs, and Git/diff review without a separate task/result acceptance subsystem.

## Why WebCodex?

- **Your code stays on your machine.** The repository does not need to be copied into the chat service.
- **The agent gets a real development environment.** It can use the same files, Git checkout, compilers, tests, and tools you already use.
- **Work survives beyond a single request.** Long-running execution and evidence remain observable through WebCodex.
- **Start temporary or run it long-term.** Use one-command sharing for a quick session, or connect machines to a self-hosted Server for a durable setup.

## How it works

```text
AI client
   |
   | MCP / HTTPS
   v
WebCodex Server
   |
   | authenticated Runner connection
   v
Runner on your machine
   |
   +-- repository
   +-- Git
   +-- compilers / tests / developer tools
```

For the internal Server/Runner architecture, protocol surfaces, and authority boundaries, see [Architecture](docs/ARCHITECTURE.md), [MCP](docs/MCP.md), and [Authentication](docs/AUTH_MODEL.md).

## Star History

This chart tracks the upstream [yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex) repository.

<a href="https://www.star-history.com/yyjeqhc/webcodex">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=yyjeqhc/webcodex&amp;type=Date&amp;theme=dark">
    <img alt="Star history of yyjeqhc/webcodex" src="https://api.star-history.com/svg?repos=yyjeqhc/webcodex&amp;type=Date">
  </picture>
</a>

## Platform packages

Complete installer formats are Windows `.exe`, macOS `.pkg`, and Linux `.deb` / `.rpm`, with x64 and arm64 variants. Download the files actually attached to the [selected Release](https://github.com/9holy/webcodex/releases), then follow [Unified installation](docs/unified-installation.md) for supported systems and setup. Separate Desktop installers and runtime archives are also available; advanced npm/Docker deployment paths are described in [Deployment](docs/DEPLOYMENT.md). The [`download/`](download/README.md) directory contains download-page source; the public download destination for this fork is GitHub Releases.

## Documentation

- [Unified installation](docs/unified-installation.md) — personal and multi-computer setup for the unified package
- [Deployment validation](docs/unified-deployment-validation.md) — platform acceptance status and required native checks
- [Runtime installation and CLI join](docs/runtime-installation.md) — headless Linux Runner setup and package update/recovery
- [Desktop installation and upgrades](docs/desktop-install.md) — installation, upstream migration, and ChatGPT connection
- [Using Desktop](docs/desktop-guide.md) — projects, connections, activity, and background operation
- [Desktop Runtime compatibility](docs/DESKTOP_RUNTIME_COMPATIBILITY.md) — compatible Runtime selection, diagnostics, and rollback
- [Runtime Console](docs/runtime-console.md) — browser-based activity, projects, Sessions, and Agent communication
- [Session continuity](docs/SESSION_CONTINUITY.md) — explicitly save and resume authorized work across conversations
- [Experimental Codex app-server provider](integrations/codex_app_server/README.md) — prepare native Codex, review approvals, and understand supported interactions
- [Optional Windows Codex chat bridge](integrations/codex/live-chat-bridge/README.md) — exchange messages between live WebCodex Codex tasks and Codex Desktop chats
- [Desktop development](docs/DESKTOP_DEVELOPMENT.md) — run from source on Linux, Windows, and macOS; build local packages
- [Full Setup](docs/PERSONAL_SETUP.md) — CLI, existing Server, Linux, and advanced regular Server + Runner setup
- [Quick Trial](docs/QUICK_START.md) — temporarily try one repository with `share`
- [MCP](docs/MCP.md) — ChatGPT, Claude, authentication choices, and MCP reference
- [Deployment](docs/DEPLOYMENT.md) — production, self-hosting, and advanced operations
- [Troubleshooting](docs/TROUBLESHOOTING.md) — ChatGPT/MCP Host, connection, and runtime problems
- [CLI](docs/CLI.md) — command and credential reference
- [AI-assisted setup](docs/AI_ONBOARDING.md) — have an AI agent help configure WebCodex
- [Security](SECURITY.md) — security model and operational guidance
- [Documentation index](docs/INDEX.md) — all user and contributor documentation

## Security

WebCodex can read and modify files and execute commands inside configured project boundaries. Use version control, keep credentials out of prompts/logs/Git, and register only project roots the assistant should access. Tool results, including requested file excerpts, may be returned to the AI client. Read [SECURITY.md](SECURITY.md) for the complete model.

## Build from source

If a release has a problem, you do not need to wait for a maintainer to produce a
new build. Reproducing the issue on current `main`, testing a focused fix locally,
and submitting the result as a pull request are all welcome.

For CLI / Server / Runner development, install [Git](https://git-scm.com/) and the
stable Rust toolchain through [rustup](https://rustup.rs/), then build the normal
dogfood profile:

```bash
cargo build --locked --profile dogfood --workspace --bins
```

The binaries are written under `target/dogfood/`. For Desktop/frontend work, also
install Node.js 22 + npm and the native platform toolchain. Windows Desktop
development needs an MSVC/Windows SDK environment; macOS development needs Xcode
Command Line Tools. The complete prerequisites and source-build workflow are in the
[Desktop development guide](docs/DESKTOP_DEVELOPMENT.md).

For local Desktop installer testing, use the repository helpers rather than a raw
Tauri bundle command:

```powershell
# Windows: clean committed source
.\scripts\build_desktop_windows_local.ps1

# Windows: explicitly package uncommitted local work as dirty dogfood
.\scripts\build_desktop_windows_local.ps1 -AllowDirty
```

```bash
# macOS
bash scripts/build_desktop_macos_local.sh
```

These are development/dogfood builds, not public release artifacts.

## Contributing

Issues and focused pull requests for this distribution are welcome in
[9holy/webcodex](https://github.com/9holy/webcodex). Maintainer response time may vary, so
users who can reproduce a problem on current `main` are especially encouraged to
investigate it, build and test a fix locally, and submit a PR rather than waiting for
the fix to be implemented by a maintainer. WebCodex itself, Codex, ChatGPT, Claude, or other
coding agents may be used to help inspect, edit, and validate the repository.

For what to include in a bug report, the self-service fix workflow, validation
expectations, and pull request guidance, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Acknowledgements

Thank you to **[yyjeqhc](https://github.com/yyjeqhc)** and the **[upstream WebCodex contributors](https://github.com/yyjeqhc/webcodex/graphs/contributors)** for creating and maintaining [WebCodex](https://github.com/yyjeqhc/webcodex). This fork inherits substantial implementation and documentation from their work. The original attribution and [Apache 2.0 license](LICENSE) remain in place.

Thanks to the [LINUX DO](https://linux.do/) community for its welcoming space for technical discussion and support for open-source sharing.

Thanks to [AtomGit](https://atomgit.com/yyjeqhc/webcodex) for hosting the upstream WebCodex mirror in China. This fork's releases are published separately on [9holy/webcodex](https://github.com/9holy/webcodex/releases).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

## Desktop Shell and Runtime upgrades

Desktop can keep its existing shell while using a separately selected compatible Runtime folder. Build revisions and package versions are diagnostic identity, not compatibility gates. See [Desktop Runtime compatibility](docs/DESKTOP_RUNTIME_COMPATIBILITY.md) for custom builds, safe switching/rollback, diagnostics, tracing and update notifications.
