# 安装与兼容性

这是标准 Agent Skills 文件夹，入口是 `SKILL.md`。整包复制即可，不需要将说明改写成每家产品的专有规则。`agents/openai.yaml` 只是可选界面元数据，其他宿主可以忽略。

## 放置目录

下表路径均需再接 `1688-shopping/`，其下直接放 `SKILL.md`、`scripts/`、`references/`、`package.json` 和锁文件。选择一个位置即可，避免重复安装同名版本。目录支持情况于 2026-09-29 核对官方文档；自动发现和执行仍受宿主版本、工作区信任和权限设置影响。

| Agent | 项目目录 | 用户目录 | 官方说明 |
|---|---|---|---|
| Codex | `.agents/skills/` | `~/.agents/skills/` | [文档](https://learn.chatgpt.com/docs/build-skills) |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` | [文档](https://code.claude.com/docs/en/skills) |
| Cursor | `.cursor/skills/` 或 `.agents/skills/` | `~/.cursor/skills/` 或 `~/.agents/skills/` | [文档](https://cursor.com/docs/skills) |
| OpenCode | `.opencode/skills/` 或 `.agents/skills/` | `~/.config/opencode/skills/` 或 `~/.agents/skills/` | [文档](https://opencode.ai/docs/skills/) |
| Gemini CLI | `.gemini/skills/` 或 `.agents/skills/` | `~/.gemini/skills/` 或 `~/.agents/skills/` | [文档](https://geminicli.com/docs/cli/skills/) |
| GitHub Copilot / VS Code | `.github/skills/` 或 `.agents/skills/` | `~/.copilot/skills/` 或 `~/.agents/skills/` | [文档](https://code.visualstudio.com/docs/agent-customization/agent-skills) |

多个支持 `.agents/skills/` 的宿主可共享一份目录；Claude Code 可另用它支持的目录。不要覆盖已有同名技能而不保留原版本。

云端 Agent 需要把文件和运行依赖放到它实际执行的环境。本地安装和浏览器登录态不会自动传到云端。无原生 Skills 支持但能读文件的 Agent，可让其读取本包 `SKILL.md` 后按需执行相对路径资源；这不等于自动发现。

## 本地脚本安装

需要 Node.js 20+、npm、联网能力。进入实际技能根目录运行，macOS/Linux shell 和 Windows PowerShell 均使用以下命令：

```text
npm ci --ignore-scripts --no-audit --no-fund
node scripts/catalog.mjs --doctor
node scripts/catalog.mjs --help
```

保持 `package-lock.json` 的固定版本，不用全局安装 UTP，不复制另一台机器的 `node_modules`。需要保留 npm 可选依赖；不要使用 `--omit=optional`，UTP 的平台二进制属于可选依赖。首次运行可能由 UTP 在用户目录创建自身配置/会话，不会修改 Agent 的 MCP 配置。

当前锁定 UTP 0.6.38 提供 macOS arm64/x64、Linux arm64/x64、Windows x64 原生包。Windows arm64 等未提供的平台走已有 MCP 或网页方式，不声称脚本通用可运行。Linux 的系统库兼容性以原生程序实际启动为准。

`--doctor` 只验证 Node 版本、可导入依赖及本机二进制文件，不测试网络、服务权限、浏览器或登录态。能加载技能不代表已验证完整购物流程。

## 验收

```text
npm test
```

再用 [目录查询](catalog.md) 的关键词请求做一次真实只读查询。退出码应为 0，stdout 应为 JSON，结果应明确标为渠道参考。然后在宿主中提出：

> 使用 1688-shopping，找一个自用笔记本支架，先给候选并区分渠道价和已核实采购价。

观察是否读取技能、选择实际可用工具、正确处理登录和价格来源。无浏览器时不能声称核价完成。

## 下单能力的验收

下单需要可交互浏览器，且该浏览器里已登录 1688。验收时**不要真的付款**，按下面顺序做一次空跑：

1. 提出"用 1688-shopping 看一下这个链接的规格和价格，先别下单"，确认它只读、不提交。
2. 再提出"授权下单，走到付款页就停"。
3. 检查它是否：选对颜色与规格（不是页面默认项）、把地址真正挂到订单（顶部不再是"请添加地址"）、报出金额构成、停在收银台、明确写"未付款"。
4. 确认落在收银台后**取消订单**，避免留下待付款单。

任一步失败都按 [下单执行](ordering.md) 的"失败与边界"处理，不要换账号或拆单绕过。仅能加载技能不等于完成端到端实测。

本包格式依据 [Agent Skills 规范](https://agentskills.io/specification)；格式兼容与在每个 Agent 中完成实测是两回事。
