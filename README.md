# 1688-shopping

可移植的 1688 找货、核价与下单技能。采用标准 `SKILL.md`，不绑定 Codex、Ego 或某台电脑。

覆盖三段能力：

1. **找货**：关键词、图片、相似商品搜索，少量自用候选比较
2. **核价**：核对目标 SKU 的价格、起购量、运费、优惠
3. **下单**（需明确授权）：选规格、挂地址、提交到收银台；**支付始终由用户本人完成**

默认只读。用户没有说"下单/买/帮我买"时，不会加购或下单。

## 获取

```text
git clone https://github.com/huntingrin/1688-shopping.git
```

也可以从仓库页面下载 ZIP 解压。仓库不含 `node_modules`，依赖按锁文件在本地重新安装。

## 使用

1. 将整个 `1688-shopping` 文件夹放到目标 Agent 的技能目录；见 [安装位置与环境要求](references/installation.md)。
2. 如使用本地查询脚本，在该文件夹运行：

   ```text
   npm ci --ignore-scripts --no-audit --no-fund
   node scripts/catalog.mjs --doctor
   ```

3. 刷新宿主的技能列表或重新打开会话，提出"使用 1688-shopping 帮我找……"。

## 文档结构

| 文档 | 作用 |
|---|---|
| [SKILL.md](SKILL.md) | Agent 入口、授权边界、三段流程 |
| [尺寸匹配](references/sizing.md) | 外框换净尺寸、档位命名、褶皱系数、轨道长度 |
| [页面操作配方](references/dom-recipes.md) | 详情页/订单页的选择器、未登录读价、已知坑 |
| [下单执行](references/ordering.md) | 登录前置、六步下单、收银台与交付话术 |
| [目录查询](references/catalog.md) | 只读脚本的 JSON 输入输出 |
| [网页核验](references/browser-verification.md) | 登录核价与逐项核对清单 |
| [安装与兼容性](references/installation.md) | 六类 Agent 的目录、依赖、验收 |

目录查询结果只是渠道参考价。普通采购的指定 SKU、起购量、运费和优惠需用当前可用浏览器核实。没有浏览器时仍能提供候选，但不能声称已核价。

## 下单边界

- 只提交到收银台，不点「立即付款」
- 不代填支付密码、不代扫码
- 1688 收银台默认选中「先采后付」（现在 0 元、收货后下月 8 号自动扣），交接时必须说明
- 未支付订单约 4 天 23 小时后自动取消

## 兼容范围与验证

按 Agent Skills 格式和各宿主官方目录说明适配 Codex、Claude Code、Cursor、OpenCode、Gemini CLI、GitHub Copilot / VS Code。其他能加载文件、执行脚本或使用网页工具的 Agent 可手动读取入口使用。

本包在 macOS arm64 / Node.js 26.5.0 下验证；Windows/Linux 原生包由锁定 UTP 提供，平台映射有离线测试，但不代表所有操作系统和所有 Agent 都完成端到端实测。账号权限、网络可达性和可交互浏览器由宿主提供。

执行 `npm test` 可运行离线测试（含文档完整性检查：frontmatter、相对链接、版本一致性）。转移或分享时排除 `node_modules`、任务输出、Cookie、账号配置和会话；目标机器按锁文件重新安装依赖。
