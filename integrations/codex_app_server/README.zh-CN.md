# Codex app-server 提供方

[English](README.md)

这个随 WebCodex 安装的 Python 3.10+ 适配器，让已获授权的 CodingAgentRun
调用本机真正的 Codex app-server。文件读写、命令执行，以及该 Codex 安装已配置的
MCP 服务和 Skills，由 Codex 实际执行；适配器把 thread/turn 事件和权限请求接入现有
ACP Run 生命周期，并非只映射工具名称。

上游接口仍是实验性接口。需要显式启用、验证并固定安装版本，在目标机器上完成验证后
再依赖它。兼容性预检成功不代表账号、模型、MCP 服务或操作系统沙箱已经可用。

## 安装和配置

WebCodex 原生安装包已嵌入适配器源码，无需克隆仓库、安装 pip 包或另行下载适配器。
仍需明确安装 Python 3.10+ 和兼容的 Codex CLI，并在运行 Runner 的同一系统账号下完成
Codex 登录。自定义 CODEX_HOME 必须指向该账号可访问的已有目录。

在 Desktop 的 **Coding agents（编码代理）** 页面选择 **Prepare Codex（准备 Codex）**。
自动发现不足时指定已有可执行文件，检查生成的配置，再通过正常配置流程保存、启用，
按界面提示应用 Runner 配置。预检返回的配置默认禁用，不会悄悄替换已有提供方。

无界面环境可以生成同样可审核的配置：

```sh
webcodex coding-agent prepare-codex --experimental --json
```

指定安装位置及精确版本：

```sh
webcodex coding-agent prepare-codex --experimental \
  --codex-bin /absolute/path/to/codex \
  --python-bin /absolute/path/to/python3 \
  --config-dir /absolute/private/webcodex-config \
  --expected-version YOUR_EXACT_INSTALLED_VERSION --json
```

该命令只准备资源和兼容性凭据，不修改 Runner TOML，不启用提供方，不授予 OAuth scope，
不登录、不重启服务。JSON profile 可交给已有配置管理入口；交互用户使用 Desktop 完成
版本冲突检查、保存和启用，无需手改 TOML。

Windows 的 .cmd/.bat/PowerShell 启动器不会被交给 shell 执行。请选择真实 Codex 原生
可执行文件，或显式选择 Node 原生可执行文件，并使用 --codex-arg 配置固定的 Codex
启动脚本绝对路径。检测版本、生成 schema 和运行 app-server 使用同一命令；模型输入
不能替换命令或固定参数。

预检执行所选安装的 --version 和 app-server generate-json-schema --experimental，
验证适配器实际使用的协议，然后把精确版本、可执行文件/显式启动脚本哈希、schema
摘要写入私有凭据。它不局限于开发机器上的 alpha 版本，也不会把任意版本参数当作兼容
证明。不兼容的 schema 会被拒绝；升级或修改可执行文件后需重新预检。每次原生预检
生成独立凭据，已配置提供方的凭据保持有效且不被覆盖。

## 权限和审批

发起 Run 仍需 coding_agent:run 与 project:write。观察、取消和批准仍经过各自的
规范授权与所有权检查。安装提供方不会增加独立的 coding_agent:approve scope。
详见 [ACP Run 契约](../../docs/agent/acp-coding-agent-run.md) 和
[权限模型](../../docs/agent/permission-model.md)。

适配器使用 on-request 审批与 user reviewer。默认原生沙箱为精确已授权 Project 内的
workspace-write，网络关闭，排除隐式临时目录写入根。发出 prompt 前会核对实际
thread 策略；cwd、沙箱模式、reviewer、扩大后的网络权限或额外写入目录不符合预期即失败。
初始网络策略更严格时可以继续，turn 会携带 operator 明确配置的网络设置。没有
danger-full-access 或沙箱外 shell 兜底。operator 可在提供方参数中显式选择 read-only
或开启网络；调用方不能通过 prompt 或 ACP 配置选项改变这些策略。

命令/文件审批转换为 ACP session/request_permission，携带完整且有界的命令、cwd、
文件 diff 或请求权限。用户通过 WebCodex 审批流程选择已展示选项，适配器不会代选。
命令/文件只转换为对应请求的一次 accept 或 decline，不发送 acceptForSession，也不
写持久规则。权限集合批准只返回原请求中的精确权限，范围固定为当前 turn，并在选项
名称中明确说明。拒绝不授予任何权限，取消和超时也不会批准。

回复绑定原生 thread、turn、请求和 ACP 请求 ID；重复或迟到回复不能批准新请求。
审批详情如果不能在适配器 60 KiB 限制内完整呈现，会安全失败，不展示截断内容后继续
提供批准选项。

原生工具使用 Codex 沙箱和 Runner 系统账号。这并不会让 WebCodex 文件工具的版本
保护自动约束每个 Codex 内部动作。外部 MCP 服务仍有自己的账号和权限边界。
WebCodex 的 Run 准入、身份、所有权和进程树清理继续生效。

## 支持的生命周期与明确限制

每个适配器进程仅接受一个 ACP session 和一个 prompt：初始化原生服务、创建新的
ephemeral thread、启动一个 turn、转发文本及规范化命令/文件/MCP 事件。只有收到精确
对应的 native turn/completed 才返回成功；部分文本、turn/start 已受理或
turn/interrupt 已受理都不是终态成功。

session/cancel 中断原 turn。如果取消期限内无法确认终态中断，会明确失败，由 Runner
清理其拥有的进程树。EOF、错误帧、响应丢失和超时不会自动创建替代 turn。派发结果不
确定时，应继续观察原 WebCodex Run。

当前纵向实现不加载/续接/fork 既有 Codex thread，不接受第二个 prompt，不提供
turn/steer、不桥接任意 dynamic tools，也不转换通用用户问答及 MCP form/URL
elicitation。不支持的原生交互请求会得到明确协议错误并终止 Run，不会一直等待或伪造
用户答案。未绑定子 thread 的审批也会被拒绝。其他不依赖这些宿主交互的原生能力，
按已安装 Codex 和配置实际可用。ChatGPT 内部连接器、托管浏览器、搜索服务和图片
生成不会因为安装适配器或提供 API Key 就被自动复制。

资源边界：单帧 1 MiB、prompt 64 KiB、原生流量 32 MiB、8,192 个原生事件、256 个
保留 item 身份、64 个原生请求、8 个排队审批，默认转发文本总量 1 MiB。审批等待默认
300 秒、上限 600 秒；Runner 自身的审批及 Run 期限可能更短。适配器总运行期限上限
3,600 秒。stdout 只输出 ACP；不转发原生 stderr、凭据或任意错误正文。Runner 只注入
operator 显式配置的环境变量映射。

## 验证和打包

```sh
python3 -m unittest discover -s integrations/codex_app_server/tests -v
python3 -m unittest scripts.tests.test_codex_app_server_package -v
cargo test --locked --profile dogfood -p webcodex-environment codex_app_server
cargo test --locked --profile dogfood -p webcodex-cli coding_agent
cargo test --locked --profile dogfood -p webcodex-runner codex_app_server_adapter
```

Python 测试启动真实适配器及独立 stdio fixture，明确批准后才在 Project 内产生文件
效果，并覆盖拒绝、取消、身份/重放、版本/schema 变化、策略边界和资源限制。Runner
测试覆盖真实 Runner→ACP→app-server 桥接。fixture 无需付费模型或真实凭据；真实
模型和工具的就绪状态仍需在目标机器上使用已配置账号验收。

独立分发可以使用同一嵌入源码生成确定性的自包含 zipapp：

```sh
python3 scripts/package_codex_app_server_adapter.py --output /absolute/path/webcodex-codex-app-server.pyz
python3 /absolute/path/webcodex-codex-app-server.pyz prepare --experimental \
  --receipt /absolute/private/codex-compatibility.json
```

协议参考：[官方 Codex app-server 文档](https://learn.chatgpt.com/docs/app-server)。
每个版本以实际安装生成的 schema 为兼容性依据，网页示例不覆盖实际协议。
