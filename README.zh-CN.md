<p align="right"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a></p>

<p align="center"><img src="docs/assets/brand/webcodex-app-icon.png" alt="WebCodex 标志" width="96" height="96"></p>

<h1 align="center">WebCodex</h1>

<p align="center"><strong>让云端 AI Agent 使用你自己机器上的真实开发环境。</strong></p>
<p align="center">把 ChatGPT、Claude 等 MCP 客户端连接到你已有的仓库、Git 工作区和开发工具。</p>
<p align="center"><a href="docs/unified-installation.zh-CN.md">一台电脑</a> · <a href="docs/unified-installation.zh-CN.md#多台电脑">多台电脑</a> · <a href="#本分支增加了什么">与上游的区别</a> · <a href="#文档">文档</a> · <a href="https://github.com/9holy/webcodex/issues">Issues</a> · <a href="CONTRIBUTING.zh-CN.md">参与贡献</a> · <a href="SECURITY.md">安全说明</a></p>

<p align="center">
  <a href="docs/MCP.zh-CN.md"><img src="https://img.shields.io/badge/protocol-MCP-2563EB?labelColor=1E40AF&amp;style=flat-square" alt="MCP 协议"></a>
  <a href="docs/QUICK_START.zh-CN.md#前置条件"><img src="https://img.shields.io/badge/Node.js-18%2B-0D9488?labelColor=0F766E&amp;style=flat-square" alt="需要 Node.js 18 或更新版本"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-2563EB?labelColor=1E40AF&amp;style=flat-square" alt="Apache 2.0 许可证"></a>
</p>

WebCodex 是自托管工具运行时：Server 认证请求，并将请求路由到仓库所在机器上的 Runner。你可以直接让 AI 理解项目、修改代码、运行测试、检查 Git 或排查问题。无需把整个项目搬到托管环境里；按请求读取的文件内容和其他工具结果仍可能返回给 AI 客户端。

**当前仓库是 [9holy/webcodex](https://github.com/9holy/webcodex)，基于 [yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex) 的分支。** WebCodex 的核心架构、工具、Desktop 应用和文档来自上游作者与贡献者。本分支遵循相同的 [Apache 2.0 许可证](LICENSE)，在此基础上继续完善编码代理接入、连接配置、权限操作和 Windows 升级。

## 本分支增加了什么

下表说明本分支源码中的改动。具体版本交付哪些功能、哪些平台已完成验收，以对应的[本分支 Release](https://github.com/9holy/webcodex/releases)为准；功能已实现不代表每种安装包或真实账号环境都已通过验证。

| 方向 | 本分支的改动 |
| --- | --- |
| **原生 Codex 接入（实验性）** | 将本机已安装的 Codex CLI 配置为编码代理，通过 WebCodex 调用其真实 app-server，在支持的任务生命周期内使用该安装的原生工具、已配置的 MCP 服务和 Skills。详见[接入指南与限制](integrations/codex_app_server/README.zh-CN.md)。 |
| **审批与网络选择** | 在 Desktop 或 Runtime Console 查看编码代理的权限请求，并对当前请求明确作出决定；审批能力需要单独授权。Codex 准备流程提供默认关闭的网络访问选项，项目边界和操作审批仍然生效。详见 [Codex 配置与审批](docs/desktop-guide.zh-CN.md#配置-codex-与处理编程审批)。 |
| **常用 SSH 登录配置** | 填写主机/IP、端口、用户名，选择密码或私钥文件；加密私钥可填写口令。先检查并信任主机指纹、测试认证，再保存资源，也保留已有 OpenSSH 别名入口。凭据保存在 Runner 的受保护存储中，Chat 使用资源名称。详见[添加 SSH 服务器](docs/desktop-guide.zh-CN.md#添加-ssh-服务器)。 |
| **显式后台进程授权** | 为本机长时间运行的进程单独授权 `job:detach`。OAuth 配置提供能力选项，以及已有客户端的替换、重新授权流程；给 Desktop 授权不会自动扩大另一条 Chat 连接的权限。详见 [Desktop 权限](docs/desktop-guide.zh-CN.md#配置-codex-与处理编程审批)和 [MCP 授权](docs/MCP.zh-CN.md)。 |
| **Windows 安装与上游升级** | 新安装可选择目录；在支持的升级路径中保留已有安装目录和用户数据，并提供受保护的 Runtime 替换与恢复。完整安装器还会协调已安装的 Server/Runner 服务。详见 [Windows 安装与升级](docs/desktop-install.zh-CN.md#1-安装-webcodex-desktop)。 |
| **Runner 静默连接恢复** | 检测已注册但不再响应的连接，关闭旧连接后以相同 Runner 实例和保留的 Job 清单重连。恢复不改变已有权限，不重放命令，也不重建持久 Shell。详见 [Runner 连接与任务恢复](docs/RUNNER.md)。 |
| **更清楚的活动失败诊断** | 展示可用的安全错误分类和下一步操作，技术信息按需展开。任务收尾调用失败与实际执行结果分开说明；旧记录未保留原因时会明确提示，不推测失败原因。详见 [Desktop 活动](docs/desktop-guide.zh-CN.md#活动设置和后台运行)。 |

Codex provider 是对已安装 Codex 的实验性接入，存在明确的[生命周期和交互限制](integrations/codex_app_server/README.zh-CN.md#支持的生命周期与明确限制)。它不承诺与 Codex 的全部接口完全对齐，也不会自动提供 ChatGPT 的私有连接器、托管浏览器、搜索或图像生成服务。外部服务和操作系统操作仍需各自的凭据与授权。

下方保留上游项目的社区关注信息：

<p align="center">
  <a href="https://trendshift.io/repositories/121867">
    <img src="https://trendshift.io/api/badge/repositories/121867" alt="上游 yyjeqhc/webcodex | GitHub Trending" width="250" height="55" />
  </a>
</p>

## 开始使用 WebCodex

长期使用，请从[本分支 Releases](https://github.com/9holy/webcodex/releases)下载与你的操作系统和架构对应的完整安装包，再按代码所在位置选择安装方式：

- **一台电脑：**在个人工作站安装 WebCodex，打开 Desktop，并按[统一安装指南](docs/unified-installation.zh-CN.md)操作。每个平台的统一安装包包含 Desktop、CLI、Server 和 Runner。
- **多台电脑：**在承载 WebCodex Server 的机器以及持有代码仓库的每台机器上安装相同平台安装包。按[统一安装指南](docs/unified-installation.zh-CN.md#多台电脑)和[部署验收清单](docs/unified-deployment-validation.md)操作。

完整安装包包含 Desktop、CLI、Server 和 Runner。Windows 普通 Intel/AMD 电脑选择 `webcodex-unified-…-win32-x64.exe`，ARM 电脑选择 `win32-arm64.exe`。已有安装的用户，请先查看 [Desktop 安装与升级](docs/desktop-install.zh-CN.md)及所选版本的发布说明。

每个 Release 列出实际提供的文件和验收证据。原生构建与自动安装检查不代表所有真实桌面、系统重启和升级场景都已覆盖，具体验收范围见[验收清单](docs/unified-deployment-validation.md)。临时体验单个仓库可查看[快速试用](docs/QUICK_START.zh-CN.md)，使用 `webcodex share`；源码预览则检出要验证的修订，按 [Desktop 开发指南](docs/DESKTOP_DEVELOPMENT.zh-CN.md#linux-源码预览与已有-server)操作。

Linux 机器不安装 Desktop 而加入已有 Server，请看 [Runtime 安装与 CLI 加入](docs/runtime-installation.zh-CN.md)。高级自托管、npm/runtime 压缩包、Docker 和历史版本请看[部署指南](docs/DEPLOYMENT.zh-CN.md)。

沿用指南中提到的 `@yyjeqhc/webcodex` npm 包属于上游发行渠道。要使用本分支的改动，请选择本分支的 Release 文件，或从本仓库的指定修订构建；安装上游 npm 包不会切换到本分支。

## 能做什么？

- **理解和修改代码** —— 读取、搜索、分析项目，并在配置好的项目范围内进行受保护的修改。
- **使用真实开发环境** —— 在仓库所在机器上运行命令、测试、格式化、编译器和项目自己的工具。
- **检查 Git** —— 查看状态和差异，让代码变化保持可见、可审查。
- **处理长时间任务** —— 任务可以持续运行并保持可观察，不需要一次模型回复一直等待到底。
- **保留人工审查** —— 通过 [Runtime Console](docs/runtime-console.md)、Workflow Session 证据、Job 和 Git 差异审查工作，无需额外的任务/结果验收子系统。

## 为什么用 WebCodex？

- **代码留在自己的机器上。** 不需要把整个仓库上传到聊天服务。
- **AI 使用的是真实开发环境。** 文件、Git、编译器、测试和已有工具链都可以直接复用。
- **工作不局限于一次请求。** 长时间执行、测试结果和相关证据可以继续观察。
- **既能临时使用，也能长期部署。** 可以一条命令快速分享，也可以连接到自托管服务长期使用。

## 工作方式

```text
AI 客户端
   |
   | MCP / HTTPS
   v
WebCodex Server
   |
   | 经过认证的 Runner 连接
   v
你机器上的 Runner
   |
   +-- 代码仓库
   +-- Git
   +-- 编译器 / 测试 / 开发工具
```

如果需要了解内部的 Server/Runner 架构、协议接口和权限边界，再阅读[架构说明](docs/ARCHITECTURE.md)、[MCP](docs/MCP.zh-CN.md)和[认证模型](docs/AUTH_MODEL.zh-CN.md)。

## Star History

下图展示上游仓库 [yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex) 的 Star 历史。

<a href="https://www.star-history.com/yyjeqhc/webcodex">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=yyjeqhc/webcodex&amp;type=Date&amp;theme=dark">
    <img alt="yyjeqhc/webcodex 的 Star 历史" src="https://api.star-history.com/svg?repos=yyjeqhc/webcodex&amp;type=Date">
  </picture>
</a>

## 平台安装包

完整安装包提供 Windows `.exe`、macOS `.pkg` 和 Linux `.deb` / `.rpm` 格式，区分 x64 与 arm64。请下载[对应 Release](https://github.com/9holy/webcodex/releases)实际附带的文件，再按[统一安装指南](docs/unified-installation.zh-CN.md)确认支持的系统和配置步骤。另有独立 Desktop 安装包与 Runtime 压缩包；高级 npm/Docker 部署方式见[部署指南](docs/DEPLOYMENT.zh-CN.md)。仓库 [`download/`](download/README.md) 目录是下载页源文件，本分支对外提供下载的入口为 GitHub Releases。

## 文档

- [统一安装指南](docs/unified-installation.zh-CN.md) —— 统一安装包的个人与多机配置
- [部署验收清单](docs/unified-deployment-validation.md) —— 各平台验收状态与真实机器检查项
- [Runtime 安装与 CLI 加入](docs/runtime-installation.zh-CN.md) —— 无 Desktop 的 Linux Runner 配置与安装包更新/恢复
- [Desktop 安装与升级](docs/desktop-install.zh-CN.md) —— 安装、上游迁移与 ChatGPT 连接
- [Desktop 日常使用](docs/desktop-guide.zh-CN.md) —— 项目、连接、活动与后台运行
- [Desktop Runtime 兼容说明](docs/DESKTOP_RUNTIME_COMPATIBILITY.zh-CN.md) —— 兼容 Runtime 选择、诊断与回滚
- [Runtime Console](docs/runtime-console.md) —— 浏览器中的活动、项目、Session 与 Agent 通信
- [任务接续](docs/SESSION_CONTINUITY.zh-CN.md) —— 显式保存并跨对话继续有权访问的工作
- [实验性 Codex app-server 接入](integrations/codex_app_server/README.zh-CN.md) —— 准备原生 Codex、处理审批与了解支持的交互
- [可选 Windows Codex 会话桥接](integrations/codex/live-chat-bridge/README.zh-CN.md) —— 在运行中的 WebCodex Codex 任务与 Codex Desktop 会话之间收发消息
- [Desktop 开发与打包](docs/DESKTOP_DEVELOPMENT.zh-CN.md) —— 在 Linux、Windows、macOS 从源码运行，以及本地打包
- [完整使用指南](docs/PERSONAL_SETUP.zh-CN.md) —— CLI、已有 Server、Linux 与高级普通 Server + Runner 配置
- [快速试用](docs/QUICK_START.zh-CN.md) —— 用 `share` 临时体验一个仓库
- [MCP](docs/MCP.zh-CN.md) —— ChatGPT、Claude、认证方式和 MCP 参考
- [部署指南](docs/DEPLOYMENT.zh-CN.md) —— 生产、自托管和高级运维
- [故障排查](docs/TROUBLESHOOTING.zh-CN.md) —— ChatGPT/MCP Host、连接和运行问题
- [CLI](docs/CLI.zh-CN.md) —— 命令与凭据参考
- [AI 辅助接入](docs/AI_ONBOARDING.zh-CN.md) —— 让 AI 帮你配置 WebCodex
- [安全说明](SECURITY.md) —— 安全模型与使用建议
- [文档索引](docs/INDEX.zh-CN.md) —— 全部用户和贡献者文档

## 安全

WebCodex 能在配置的项目范围内读取和修改文件、执行命令。建议使用版本控制，不要把凭据写进提示词、日志或 Git，只注册确实希望 AI 访问的项目目录。工具返回的结果（包括按请求读取的文件片段）可能传给 AI 客户端。完整安全模型见 [SECURITY.md](SECURITY.md)。

## 从源码构建

如果已发布版本遇到问题，不必只能等待维护者发布新版本。欢迎先在最新 `main`
复现问题，在本地构建并验证 focused fix，然后直接提交 pull request。

CLI / Server / Runner 开发需要先安装 [Git](https://git-scm.com/) 和通过
[rustup](https://rustup.rs/) 安装的 stable Rust toolchain，然后使用日常 dogfood
profile 构建：

```bash
cargo build --locked --profile dogfood --workspace --bins
```

产物位于 `target/dogfood/`。如果修改 Desktop/frontend，还需要 Node.js 22 + npm
以及对应平台的 native toolchain。Windows Desktop 开发需要 MSVC / Windows SDK
环境；macOS 需要 Xcode Command Line Tools。完整 prerequisites、源码运行和打包流程见
[Desktop 开发与打包](docs/DESKTOP_DEVELOPMENT.zh-CN.md)。

本地验证 Desktop installer 时请使用仓库 helper，而不是直接执行 raw Tauri bundle：

```powershell
# Windows：clean 且已提交的源码
.\scripts\build_desktop_windows_local.ps1

# Windows：显式把未提交修改打成 dirty dogfood installer
.\scripts\build_desktop_windows_local.ps1 -AllowDirty
```

```bash
# macOS
bash scripts/build_desktop_macos_local.sh
```

这些属于开发/dogfood 构建，不是正式 Release artifact。

## 参与贡献

本发行分支的 Issue 和 focused pull request 请提交到
[9holy/webcodex](https://github.com/9holy/webcodex)。维护者响应时间可能有所变化，因此如果
能够在最新 `main` 复现问题，尤其欢迎直接排查、在本地构建验证修复并提交 PR，而不必
等待维护者先实现。可以使用 WebCodex 本身、Codex、ChatGPT、Claude 或其他 coding
agent 辅助阅读、修改和验证仓库。

Bug 报告需要提供哪些信息、自助修复流程、验证要求与 PR 说明见
[CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。

## 致谢

感谢原作者 **[yyjeqhc](https://github.com/yyjeqhc)** 和 **[WebCodex 上游贡献者](https://github.com/yyjeqhc/webcodex/graphs/contributors)** 创建并持续维护 [WebCodex](https://github.com/yyjeqhc/webcodex)。本分支的大量实现与文档建立在他们的工作之上，并保留原有署名与 [Apache 2.0 许可证](LICENSE)。

感谢 [LINUX DO](https://linux.do/) 社区提供友好的技术交流与开源分享环境。

感谢 [AtomGit](https://atomgit.com/yyjeqhc/webcodex) 在国内托管上游 WebCodex 镜像。本分支的发布文件单独提供于 [9holy/webcodex Releases](https://github.com/9holy/webcodex/releases)。

## 许可证

使用 Apache License 2.0，见 [LICENSE](LICENSE)。

## Desktop Shell 与 Runtime 升级

Desktop 可以保留当前 Shell，并使用单独选择的兼容 Runtime。构建修订与软件版本用于诊断，不是兼容性开关。自行构建、切换与恢复、追踪、诊断报告与更新提示见 [Desktop Runtime 兼容说明](docs/DESKTOP_RUNTIME_COMPATIBILITY.zh-CN.md)。
