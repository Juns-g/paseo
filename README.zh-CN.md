<p align="center">
  <img src="packages/website/public/logo.svg" width="64" height="64" alt="Paseo logo">
</p>

<h1 align="center">Paseo</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/getpaseo/paseo/stargazers">
    <img src="https://img.shields.io/github/stars/getpaseo/paseo?style=flat&logo=github" alt="GitHub stars">
  </a>
  <a href="https://github.com/getpaseo/paseo/releases">
    <img src="https://img.shields.io/github/v/release/getpaseo/paseo?style=flat&logo=github" alt="GitHub release">
  </a>
  <a href="https://x.com/moboudra">
    <img src="https://img.shields.io/badge/%40moboudra-555?logo=x" alt="X">
  </a>
  <a href="https://discord.gg/jz8T2uahpH">
    <img src="https://img.shields.io/badge/Discord-555?logo=discord" alt="Discord">
  </a>
  <a href="https://www.reddit.com/r/PaseoAI/">
    <img src="https://img.shields.io/badge/Reddit-555?logo=reddit" alt="Reddit">
  </a>
</p>

<p align="center">Claude Code、Codex、Copilot、OpenCode 和 Pi agents 的统一界面。</p>

> ### 🛠️ Juns's Custom Fork / 个人增强分支说明
>
> 本仓库为个人维护的 Paseo 增强分支（上游官方仓库：[getpaseo/paseo](https://github.com/getpaseo/paseo)，官方网站：[paseo.sh](https://paseo.sh)）。
>
> **个人定制与采用的官方能力：**
>
> 1. **官方元数据生成**：使用官方 structured-agent 管线及隔离的 `omp-metadata` 配置；已退休 fork 专用 HTTP 实现。
> 2. **分栏拖拽按帧合并防掉帧**：使用 `requestAnimationFrame` 合并高频鼠标事件，减少左右拖拽分栏时的重复渲染。
> 3. **Hermes 图标**：普通内置图标采用官方实现；外置 Bot provider 继续保留自己的图标注册。
> 4. **无图标项目会话首字与专属底色**：无自定义 Logo 的项目，侧边栏图标不再千篇一律显示单一仓库名首字，而是自动按当前会话标题提取首字（完整支持汉字与 Emoji），并按会话分配专属底色；有 Logo 的项目 100% 保持原有图标。
>
> **实验性独立分支（以 MR/PR 形式在远端单独留存）：**
>
> - [`feat/intent-aware-image-previews`](https://github.com/Juns-g/paseo/tree/feat/intent-aware-image-previews)：区分 Agent 排错截图与成果图，长图自动折叠为紧凑横条，防止霸屏（独立分支备查，主干不打包）。
>
> **本地使用指南（与官方命令保持一致）：**
>
> - 本地桌面运行：`npm run dev:desktop`
> - 本地后台服务运行：`npm run dev:server`
> - 本地构建 macOS 专属 App：`npm run build:desktop`
> - 官方原版命令与起步指南：请参阅下文 [快速开始](#快速开始) 或 [官方文档](https://paseo.sh/docs)。

## 安装个人增强版

仓库：[Juns-g/paseo](https://github.com/Juns-g/paseo)。本分支基于 2026-10-20 确认的官方 `main` 提交 `adf27de7d`，保留尚未由官方完全覆盖的个人行为。图片预览实验分支不包含在内。

可把下面的提示词交给本机编码助手：

```text
请帮我从 https://github.com/Juns-g/paseo 的 main 分支构建并安装 Paseo 个人增强版，保留后台续接、旧附件与失效模型保护及个人显示定制；元数据生成与普通 Hermes 图标使用官方实现。

先阅读仓库 README、AGENTS.md、docs/development.md 和 docs/custom-providers.md，确认我的操作系统、CPU 架构、Paseo 安装方式及当前任务状态。备份现有应用与配置，保留历史会话、已有 provider 配置和本地定制。

使用仓库完整桌面构建流程，同时构建前端、后台和 CLI，不要手工混装不同版本的 app.asar 或仅覆盖 server 文件。按平台处理本地签名，先用独立 PASEO_HOME、回环地址和非正式端口验证，再替换安装；退出前确认没有任务会被误中断。

轻量元数据使用我自己的 OpenAI 兼容或 Gemini API 配置。若无法从本机现有配置确定 endpoint、model 和 apiKey，再询问我；不要复制作者的服务地址或密钥，不要把密钥写入 Git。没有可用 API 时明确说明会使用规则兜底。

验证应用页面、后台健康、已有 agent provider 的初始化以及一次真实标题生成；记录来源提交和验证边界，保留回滚路径。不要替我发布 release、推送仓库或启用公共访问。说明官方更新可能覆盖此定制版。
```

<p align="center">
  <img src="https://paseo.sh/hero-mockup.png" alt="Paseo app screenshot" width="100%">
</p>

<p align="center">
  <img src="https://paseo.sh/mobile-mockup.png" alt="Paseo mobile app" width="100%">
</p>

> [!NOTE]
> 我是独立维护者，不一定每天都能及时处理 GitHub Issues。
> 如果问题很紧急或阻塞了你，[Discord](https://discord.gg/jz8T2uahpH) 是最快联系到我的地方。

---

在你自己的机器上并行运行 agents。无论在手机上还是桌前，都能推进交付。

- **自托管：** Agents 在你的机器上运行，使用完整的本地开发环境、工具、配置和技能。
- **多提供商：** 通过同一个界面使用 Claude Code、Codex、Copilot、OpenCode 和 Pi。为每个任务选择合适的模型。
- **语音控制：** 在语音模式下口述任务或讨论问题。需要免手操作时很方便。
- **跨设备：** 支持 iOS、Android、桌面端、Web 和 CLI。在桌前开始工作，用手机查看进度，也可以从终端脚本化操作。
- **隐私优先：** Paseo 没有遥测、追踪，也不会强制登录。

## 赞助商

<!-- Sponsors: one cell per sponsor in the order of packages/website/src/data/sponsors.ts, then "become a sponsor" cells up to three. -->
<table>
  <tr>
    <td align="center" width="33%"><a href="https://hoplite.sh/?utm_source=paseo&utm_medium=readme&utm_campaign=sponsor"><picture><source media="(prefers-color-scheme: dark)" srcset="packages/website/public/sponsors/hoplite-on-dark.svg"><img src="packages/website/public/sponsors/hoplite-on-light.svg" alt="Hoplite" height="40"></picture></a><br><sub>Cloud coding agents</sub></td>
    <td align="center" width="33%"><a href="https://paseo.sh/sponsor">成为 Paseo 赞助商</a></td>
    <td align="center" width="33%"><a href="https://paseo.sh/sponsor">成为 Paseo 赞助商</a></td>
  </tr>
</table>

## 快速开始

Paseo 会运行一个名为 daemon 的本地服务，用来管理你的 coding agents。桌面 app、移动 app、Web app 和 CLI 等客户端都会连接到它。

### 前置条件

你至少需要安装一个 agent CLI，并用你的凭据完成配置：

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex](https://github.com/openai/codex)
- [GitHub Copilot](https://github.com/features/copilot/cli/)
- [OpenCode](https://github.com/anomalyco/opencode)
- [Pi](https://pi.dev)

### 桌面 app（推荐）

从 [paseo.sh/download](https://paseo.sh/download) 或 [GitHub releases 页面](https://github.com/getpaseo/paseo/releases)下载。打开 app 后 daemon 会自动启动，不需要再安装其他东西。

如果要从手机连接，在 Settings 中扫描显示的二维码。

### CLI / 无头模式

安装 CLI 并启动 Paseo：

```bash
npm install -g @getpaseo/cli
paseo
```

终端中会显示一个二维码。你可以从任意客户端连接。这个方式适合服务器和远程机器。

完整安装和配置见：

- [文档](https://paseo.sh/docs)
- [配置参考](https://paseo.sh/docs/configuration)

## CLI

你能在 app 中完成的事情，也都可以在终端中完成。

```bash
paseo run --provider claude/opus-4.6 "implement user authentication"
paseo run --provider codex/gpt-5.4 --worktree feature-x "implement feature X"

paseo ls                           # 列出正在运行的 agents
paseo attach abc123                # 实时流式查看输出
paseo send abc123 "also add tests" # 发送后续任务

# 在远程 daemon 上运行
paseo --host workstation.local:6767 run "run the full test suite"
```

更多内容见[完整 CLI 参考](https://paseo.sh/docs/cli)。

## Skills

Skills 会教你的 agent 使用 Paseo 来编排其他 agents。

```bash
npx skills add getpaseo/paseo
```

然后在任意 agent 对话中使用：

- `/paseo-handoff` — 在 agents 之间交接工作。我会用它先和 Claude 规划，再交给 Codex 实现。
- `/paseo-advisor` — 启动单个 agent 作为 advisor，提供第二意见，但不把工作委托出去。
- `/paseo-committee` — 组建两个风格互补的 agents，让它们后退一步做根因分析并产出计划。

## 开发

Monorepo 包结构速览：

- `packages/server`：Paseo daemon（agent 进程编排、WebSocket API、MCP server）
- `packages/app`：Expo 客户端（iOS、Android、Web）
- `packages/cli`：用于 daemon 和 agent 工作流的 `paseo` CLI
- `packages/desktop`：Electron 桌面 app
- `packages/relay`：用于远程连接的 relay 包
- `packages/website`：营销站点和文档（`paseo.sh`）

常用命令：

```bash
# 运行所有本地开发服务
npm run dev

# 单独运行某个界面
npm run dev:server
npm run dev:app
npm run dev:desktop
npm run dev:website

# 构建 server stack
npm run build:server

# 全仓库检查
npm run typecheck
```

## 支持 Paseo

Paseo 由一个人开发，靠使用它的人来资助。你可以通过 [GitHub Sponsors](https://github.com/sponsors/boudra) 支持这项工作。公司也可以按月[赞助 Paseo](https://paseo.sh/sponsor#spot)，logo 会展示在本 README 顶部，以及 paseo.sh 的首页和文档中。

## 相关项目

- [getpaseo/paseo-relay](https://github.com/getpaseo/paseo-relay) — 官方分布式 relay，使用 Elixir 编写
- [paseo-vscode](https://marketplace.visualstudio.com/items?itemName=hinnes.paseo-vscode) — VS Code 扩展

### 自托管 relay TLS

自托管 relay 默认使用 `ws://`，除非显式启用 TLS。对于 nginx 后面、监听 443 的 relay，可以这样启动 daemon：

```bash
PASEO_RELAY_ENDPOINT=127.0.0.1:8080 \
PASEO_RELAY_PUBLIC_ENDPOINT=relay.example.com:443 \
PASEO_RELAY_USE_TLS=true \
paseo daemon start
```

等价配置：

```json
{
  "daemon": {
    "relay": {
      "enabled": true,
      "endpoint": "127.0.0.1:8080",
      "publicEndpoint": "relay.example.com:443",
      "useTls": true
    }
  }
}
```

最小 nginx WebSocket 代理配置：

```nginx
server {
  listen 443 ssl;
  server_name relay.example.com;

  ssl_certificate /etc/letsencrypt/live/relay.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/relay.example.com/privkey.pem;

  location /ws {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

## License

Apache-2.0
