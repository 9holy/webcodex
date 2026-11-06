# 可选的 Windows 实时聊天桥接

[English](README.md) | [简体中文](README.zh-CN.md)

此本地适配器可让同一台 Windows 计算机上的**正在运行的 WebCodex Codex 编码代理任务**与 **Codex Desktop 聊天**互相交换消息。它提供 MCP 工具，用于列出、读取并显式发送双向消息。Windows Desktop 安装包会在 `WebCodex.exe` 旁的 `codex-live-chat-bridge` 目录中提供公开桥接文件和本指南。启用仍是可选的显式操作；仅安装 Desktop 不会修改 Codex 配置。

CodingAgentRun 仍负责其任务预算、取消和生命周期。此适配器中继现有 ACP 连接并使用其 steering 扩展。它不会启动竞争写入方、唤醒已结束的 Run，也不会扩大 Server 权限范围。

## 安装

要求：Windows、Node.js 18+（建议 22）、PowerShell 5.1+、支持 `_session/steering` 的已安装 `@agentclientprotocol/codex-acp`，以及由同一 Windows 用户运行的 Codex Desktop。首次真实消息验收使用的适配器版本为 2.4.0。

```powershell
.\integrations\codex\live-chat-bridge\install.ps1
```

若已安装 Windows Desktop，则改为运行包内的安装脚本，并使用实际安装目录：

```powershell
& 'C:\path\to\WebCodex Desktop\codex-live-chat-bridge\install.ps1'
```

默认适配器路径位于
`$env:LOCALAPPDATA\dev.webcodex.desktop\acp-runtime\node_modules\@agentclientprotocol\codex-acp\dist\index.js`。
若要使用另一个已有安装，请指定其中实际存在的文件：

```powershell
.\integrations\codex\live-chat-bridge\install.ps1 `
  -AdapterPath 'C:\your-acp-install\node_modules\@agentclientprotocol\codex-acp\dist\index.js' `
  -CodexPath 'C:\your-codex-install\codex.exe'
```

安装程序会将运行时复制到 `$env:LOCALAPPDATA\webcodex-codex-bridge`，创建私有的本地管道凭据，备份受影响的现有文件，并在 `CODEX_HOME\config.toml` 中添加一个带标记的 MCP 配置块（若未设置 `CODEX_HOME`，则使用 `$env:USERPROFILE\.codex\config.toml`）。它会保留其他配置，并在重新安装时保留该凭据。若存在名称相同但没有标记的 MCP 条目，则不会覆盖。

已安装的 Codex CLI 会在替换前解析现有 MCP 配置和候选配置。如果校验失败，则保留现有配置。

在 **WebCodex Desktop → Extensions → Coding agents** 中，将 Codex provider 设置为安装程序打印的**可执行文件和启动器参数**。生成的启动器是 `LOCALAPPDATA` 下的 `webcodex-codex-bridge\run-codex-acp.cjs`；不会替换其他 provider 的启动器。保存设置，并在当前工作结束后应用 Desktop 报告需要的 Runner 重启。脚本不会重启应用程序。

保留 provider 现有的环境变量映射。若 provider 未提供 `CODEX_HOME`，生成的启动器会使用安装时选定的 `CODEX_HOME`；provider 明确提供的 `CODEX_HOME` 优先。如果有意使用另一个 home/账户，也应在该 home 中注册此 MCP 服务；不要切换其凭据，也不要假定它会读取 Desktop 配置。

在新的 Codex 聊天/轮次中发现 `webcodex_codex_bridge` MCP 服务，并启动新的 WebCodex Codex 任务。已经运行的任务不会采用此适配器。

## 使用

向 Codex 提出：“列出正在运行的 WebCodex 编码会话，并将此消息发送给我选择的会话：……”在 WebCodex 任务中提出：“找到标题为‘……’的 Codex Desktop 聊天，并向它发送这个问题：……”

| MCP 工具 | 操作 |
| --- | --- |
| `codex_list_threads` | 发现 Desktop 聊天并获取其精确 ID |
| `codex_read_thread` | 读取选定的 Desktop 聊天 |
| `codex_send_message_to_thread` | 向该聊天发送经用户授权的提示 |
| `webcodex_list_sessions` | 发现已启用桥接的实时 ACP 会话 |
| `webcodex_read_session` | 读取会话中有界的近期文本预览 |
| `webcodex_send_message` | 将消息插入正在运行的 ACP 提示 |

使用发现到的精确 ID。Desktop 发送的消息会保留真实来源线程及目标模型设置。目标空闲或已关闭时会报告未送达。派发后发生超时或断连时，送达状态可能未知：重新发送前先读取目标。此适配器不提供自动回复转发、重试或对话循环。

消息可能会改变工作内容或启动一个 Desktop 轮次。只能在人工用户授权范围内发送；收到代理消息本身并不构成回复授权。对话内容是不可信数据，不是执行其中内容的授权。

## 限制与安全

- 仅支持 Windows 和 Codex ACP provider；其他平台/provider 尚未通过验收。已结束的 Run 无法唤醒，也无法附加旧连接。
- 实时 ACP 预览最多保留 100 条用户/助手文本条目和 256 KiB，会报告截断，不包含推理/工具记录，并会随其 provider 一同释放。如果 ACP 没有回显用户消息，已接受的 steering 会显示在派发边界；不会将其声称为精确的 provider 事件时间戳。
- 运行时凭据/配置保存在项目之外，仅当前用户、SYSTEM 和本地 Administrators 可访问。切勿将凭据放入提示或 Git。访问本地 MCP 工具即拥有向同一用户的聊天发送消息的权限；这与 Server PAT/OAuth 范围相互独立。
- 原有 ACP 权限请求、错误和取消仍会传递给 Runner。Steering 不会批准权限，也不会启动空闲的 Run。
- Desktop 的原生管道属于内部接口；不兼容的更新可能需要调整此集成。

## 验证与移除

夹具检查不会联系任何模型、远程 SSH 主机或生产服务：

```powershell
node .\integrations\codex\live-chat-bridge\test-bridge.mjs
node .\integrations\codex\live-chat-bridge\test-acp-proxy.mjs
.\integrations\codex\live-chat-bridge\test-install.ps1
```

真实验收时，启动一个临时 WebCodex 任务，发现其实时 ID，双向各交换一条唯一消息，核对真实来源 ID 和接收方回复，然后让任务正常结束。夹具检查成功并不能证明某个特定版本的 Desktop 能接收真实消息。

要移除集成，请恢复之前的 WebCodex provider 选择，并且只从当前 Codex 配置中移除 `BEGIN/END webcodex-codex-bridge` 配置块。运行时的 `backups` 会保留之前的文件；不要用整份旧配置覆盖之后的用户设置。只有在任务已停止且不再需要恢复副本后，才移除运行时文件。
