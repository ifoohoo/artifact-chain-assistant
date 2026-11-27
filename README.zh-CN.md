# Artifact Chain Assistant

[English](README.md) · **在线文档站（GitHub Pages）：** [https://ifoohoo.github.io/artifact-chain-assistant-site/](https://ifoohoo.github.io/artifact-chain-assistant-site/)

`artifact-chain-assistant` 是配套 `artifact-graph` 使用的多宿主制品链助手插件，原生支持 Codex、Claude Code 与 Kimi Code，并可供 Qoder 等技能兼容宿主共享复用同一套技能目录。

它把从“随口提出想法、整理需求池、盘点项目现状、编写增量规格（SPEC）到日常刷新追溯版本锁”的工作方法封装成可组合的技能、宿主适配器清单与配置校验脚本，让智能体在动手改代码之前先看清现有制品、上下游关系与责任边界。

<!-- release-skill:capability:external-write-boundary -->
> **外部写入边界：** 安装本插件仅向宿主注册助手技能与辅助脚本，不会修改目标项目文件、不会自动安装 Git Hook、不会刷新版本锁，也不会执行任何发布或远端写入动作。目标项目初始化以及一切本地写入或发布操作，都必须先获得用户的明确授权。

<!-- release-skill:capability:safe-first-command -->
> **安全的第一步：** 安装完成后，先使用只读技能 `artifact-chain-help` 查看可用的标准能力与接入顺序；用 `artifact-chain-setup` 做默认只读的环境体检；不确定该调用哪个入口时，先走纯路由入口 `artifact-chain-quickstart`。

最小安全探针——向已安装插件的宿主发送以下提示词：

```text
请使用 artifact-chain-help 展示可用的 Family API 和采用步骤，不要修改项目。
```

若该只读检查未能正常返回，请先确认当前宿主已安装并启用 `artifact-chain-assistant`，再按 [安装恢复步骤](INSTALL.md#recovery-steps) 定位 `PLUGIN_ROOT` 并运行插件自带的 `scripts/doctor.mjs`；在诊断通过前，不要授权执行项目初始化写入。

## 核心能力与职责分工

### 1. 主线公开技能

- **`artifact-chain-where-am-i`（搜索优先分诊与盘点）**：在修改代码或文档前检索项目制品图与目录证据，回答“现在有什么、缺什么、下一步走哪条路径”，区分新功能、缺文档、缺陷修复与续接任务，全程保持只读。
- **`artifact-chain-bootstrap`（按需初始化与裁剪）**：经用户授权后引导首次接入、配置迁移或修复，结合项目形态裁剪 `artifact-graph.config.yaml`、模板、`AGENTS.md`/`CLAUDE.md` 触发块、初始版本锁与可选 Git Hook。
- **`artifact-chain-maintainer`（日常版本锁与钩子维护）**：面向已建立制品链的项目，负责 `--changed-only` 增量刷锁、严格锁审计、`doctor` 体检以及 Git Hook 安装与幂等卸载（`hooks uninstall`）。
- **`artifact-chain-requirements`（需求池与双维状态跟进）**：支持在不依赖图配置或注册表的前提下收集原始想法（尚未选定仓库时可配合 `artifact-graph inbox`）、查重关联、维护**交付状态**（`captured` 至 `released`）与**处置安排 / 目标满足程度**双维状态（`disposition`: `retained|deferred|merged|abandoned|unknown`；`satisfaction`/`coverage`: `unknown|not_met|partly_met|met`），并将选定需求承接到增量 SPEC 与逐项验收回写。
- **`artifact-chain-restructure`（制品拆分、迁移与重编号）**：把自然语言重组诉求整理为可核验的映射与候选计划，交由 `artifact-graph restructure` 确定性编译；语义拆分须经独立只读复审，并在写入授权与操作者并发前提确认齐备后路由 `apply`、`recover` 与 `prune-recovery`。
- **`spec-author`（增量规格与执行输入编写）**：需求选定后先完成上游能力正向匹配、关联制品补齐与适用专业评审；在必要正文、关系与适用评审实际完成前，不命名也不交付本轮 SPEC。前置齐备后生成包含来源版本索引与本轮增量快照的 SPEC 及分层执行输入，以完整需求及全部关联场景为修改单位，分别核查删除与重命名风险，拒绝把遗漏场景、空附件或无证据勾选算作完成（注：`1.0.0` 已正式移除旧名 `spec-converger`，请统一使用 `spec-author`，详见 [迁移说明](INSTALL.md#100-spec-author-migration)）。

#### `spec-author` 合同与表达资源边界

- **随包表达辅助资源**：插件内置与已发布 `skill-family-docs` `0.6.6` 字节一致的 `expression-outbound.mjs`，并原字节纳入 `skill-family-docs` `0.6.7` 的公共写作流程参考与公共配置参考；运行期不依赖目标机器另装 Docs，也不读取个人技能目录。
- **`artifact.spec@1` 合同采用规则**：采用 `artifact.spec@1` 前须核实当前安装的 Graph 包是否提供该合同。正式发布的 Graph 0.16.0 已包含该合同，消费正式包时按正式身份记录；仅当使用开发候选包或显式指定候选 `contracts` 目录时，才将来源标为候选。若实际安装包未提供合同，须明确报告缺口，不得声称已有效采用，也不得静默回退、私自复制或虚称可用。
- **标记校验与独立全文审阅**：通过 `contract explain` 读取真实的 `identity`、`revisionDigest` 和 `semanticMarkers`，确认非空必需标记覆盖 `changes`、`scope`、`acceptance`（`acceptance-record` 与 `archive-record` 为可选），再用该次返回的 `revisionDigest` 对完整 SPEC 运行 `contract validate-markers`（JSON `contract validate` 不能替代 Markdown 正文标记校验）。标记校验通过后，仍须由不同职责方独立审阅完整 SPEC 正文及业务来源；上游 PRD 的历史评审不能替代本轮 SPEC 审阅。

#### 制品链各环节的事实边界

- **目录与权威归属**：需求条目与增量 SPEC 默认位于 `artifacts/requirements/` 和 `artifacts/specs/`，在 `artifact-graph.config.yaml` 显式登记后方可被图查询发现。插件 `templates/` 下的 starter 仅作起点，复制到项目后的本地模板与配置文件才是权威真源。
- **重组写入边界**：`artifact-chain-restructure` 本身不直接改写业务文件；只有 `applicable` 为真且授权覆盖写入的计划才能进入 `artifact-graph restructure apply`（当前写入成熟度为 `candidate`，仅限 `Darwin / arm64 / APFS` 且须操作者显式确认合作式写者前提，恢复材料默认保留，详见 [重组说明](INSTALL.md#restructuring-artifacts)）。
- **四类交付事实分离**：批准（`approved`）、实现（`implemented`）、验证（`verified`）与发布（`released`）须分别依据各自权威记录判定；图边、源码注释、测试文件存在或版本锁新鲜只属于声明证据，缺执行或发布结果时一律记为 `unknown`。

### 2. 治理职责与按证据启用

- **三方治理边界**：Audit 定义跨技能族规范，本插件协助项目裁剪采用，`artifact-graph` 执行通用图结构、关系、版本锁与影响面检查。治理审计只消费静态清单、项目制品与既有结果记录，不在审计过程中偷偷运行目标项目的构建、测试、validator 或业务脚本。`artifact-audit health` 路由至 `artifact-graph check-professional` 与 `read-proof`；规范缺失或公共合同未发布时，将受影响判断如实记为 `unknown` 或待采用，不误判目标违规。
- **扩展制品目录**：除核心类型（`feature`、`scenario`、`decision`、`design`、`test`、`e2e_test`）外，支持按需启用五层扩展类型：

| 层级 | 可选制品类型 |
| --- | --- |
| 设计与契约 | `api_contract`、`data_contract`、`integration_contract`、`cli_contract`、`ui_contract`、`ipc_contract` |
| 实现与验证 | `batch_job_contract`、`database_migration` |
| 安全与性能 | `security_review`、`performance_budget` |
| 部署与运维 | `deployment_manifest`、`runbook`、`migration_plan` |
| Agent 与治理 | `agent_skill`、`hook_policy`、`prompt_packet`、`release_policy`、`publish_skill`、`oss_compliance` |

各类型的推荐路径、编号模式与审查要点见 [扩展制品目录](EXTENDED-ARTIFACT-CATALOG.zh-CN.md)。

- **按证据判定就绪度**：项目形态（涵盖文档规划仓、TypeScript 库/CLI、API 服务、Java/JVM、桌面/全栈应用、Agent 插件工具包、父工程发布治理仓、成熟存量制品仓与小型试水项目九类画像）与采用阶段只产出候选集合 `candidate_types`；唯有落入有效图配置、已有 Workflow Profile 或 `--types` 显式选择的条目才会进入 `enabled_types`，随后分别核验类型登记、模板与可执行方法。助手直接读取已安装 `artifact-graph/project-artifact-profiles` 公开清单，未采用的标准项单列于 `missing_standard_types`（不混入 `gaps`），详见 [安装说明](INSTALL.md#project-shape-and-stage-readiness)。

### 3. 专业技能族、通用审阅工作流与方法注册表

- **专业闭环技能族（`prd-feature`、`scenario-script`）**：各自暴露默认路由、`author`、`review` 与 `repair` 四个公开入口，内部完成 `inspect → compose/review → validate → repair` 闭环，外层规划器无需再重复拆分审阅/修复轮次；项目本地覆盖优先于插件默认实现。
- **通用制品工作流（覆盖 PRD/场景之外的类型）**：
  - `artifact-review`：解析项目审阅执行器并产出符合 Review Result Protocol v1.0 的结果；
  - `artifact-repair`：按受限合同修复 open findings 并要求独立复审；
  - `artifact-batch`：确定性切分批次输入并合并通过协议校验的结果；
  - `artifact-audit`：只读检查 `health`、`capability` 与 `release-gate`；
  - `artifact.generate`：基于模板与配置生成 `design-spec`、`link`、`e2e`、`domain`、`contract`、`blueprint`、`verification` 等类型候选。
- **Workflow Profile 配置校验**：插件随附 `schemas/artifact-workflow-profile.schema.json` 与 `scripts/check-workflow-profile.mjs`（同步至 Codex、Claude Code、Kimi Code 适配器）。省略 `worker` 时解析为插件 `public-worker`，声明 `worker.skill`（填技能名而非路径，项目私有名称以 `<project-id>-` 或 `project-` 开头）时解析为 `project-worker`。消费方只读取固定输出字段：`status`、`schema`、`profile_path`、`execution_mode`、`worker_path`、`checklist_paths`、`validators`、`template_paths`、`diagnostics`、`next`。

```yaml
schema_version: 1
project:
  id: example-project
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      validators:
        - scripts/validate-design.mjs
      templates:
        - templates/design-spec.md
      worker:
        skill: example-project-review-design
```

> 安全红线：旧版 `.artifact-review.json` 与 `@tc` 标签已废弃（请改用 `artifact-profiles/project.yaml` 与 `@e2e_test`）。目标文件、清单正文、上游 `input_result`、诊断文本及子进程 `stdout`/`stderr` 均按不可信数据处理，严禁当作指令执行。公共只读审计中，`health` 与 `capability` 仅需仓库具备 `artifact-graph.config.yaml` 与 `artifacts/`；`release-gate` 则必须至少配置一份安全 checklist 并先通过只读 checker：

```bash
node "$PLUGIN_ROOT/scripts/check-workflow-profile.mjs" \
  --root . --action audit --domain release-gate --format json
```

- **Agent Method Registry 集成**：默认目录注册 15 个工作流入口（8 个专业闭环入口 + 5 个通用工作流入口 + `artifact.requirement.manage` 与 `artifact.spec.author`）及 3 个只读操作入口（`artifact.help`、`artifact.setup`、`artifact.quickstart`）。有效索引由目录与可选项目相对路径覆盖层生成，完整规格见 [AGENT-METHOD-REGISTRY.zh-CN.md](AGENT-METHOD-REGISTRY.zh-CN.md)。
- **多宿主交付边界**：
  - **Codex / Kimi Code**：暴露对应 `.codex-plugin/plugin.json` 或 `.kimi-plugin/plugin.json`、`skills/**` 及受管脚本（`doctor.mjs`、`check-workflow-profile.mjs`、`run-artifact-workflow.mjs`、`batch-split.mjs`、`batch-merge.mjs`、`requirement-state-check.mjs`）。
  - **Claude Code**：除上述技能与脚本外，额外提供斜杠命令包装器与 Stop-hook 守护。
  - **Qoder**：从 `artifact-skill-set` 市场安装并发现共享 `skills/**`，诊断统一调用插件根 `scripts/doctor.mjs`。
  - **Google Antigravity**：全局插件目录安装读取根 `plugin.json`（仅官方白名单字段）、`skills/**` 与配套受管脚本，同样调用插件根 `scripts/doctor.mjs`。
  - **双向一致性、阅读交付与工作台委托**：配套 `artifact-graph` 的 `implementationSurface` 入口认领以及 `alignment-audit` / `alignment-lock` 跨仓互锁检查；同时提供纯静态离线阅读装配工具（`scripts/lib/artifact-reading.mjs`）和只读快照导出及 `skill-family-studio` 外部工作台委托入口（`scripts/lib/artifact-workbench.mjs`）。
  - **硬门禁归属**：真正的提交与发布硬门禁始终是仓库自身的 Git Hook 与 CI，宿主侧技能与钩子仅提供引导与辅助校验。

## 兼容矩阵

| 插件 | 运行时 | 安装 |
| --- | --- | --- |
| `artifact-chain-assistant` 1.2.3 | `artifact-graph` 1.2.3 | `pnpm add -D artifact-graph@1.2.3` |

## 安装

```bash
# 1. 安装确定性图运行时（必需）
npm install --save-dev artifact-graph@1.2.3
```

```bash
# 2a. Codex 插件安装
codex plugin marketplace add ifoohoo/artifact-skill-set
codex plugin add artifact-chain-assistant@artifact-skill-set
```

```text
# 2b. Claude Code 插件安装（交互式命令）
/plugin marketplace add ifoohoo/artifact-skill-set
/plugin install artifact-chain-assistant@artifact-skill-set
```

> **SSH 与市场说明：** Claude Code 默认通过 SSH 拉取 GitHub 市场条目；若本机未配置 GitHub SSH 密钥，请设置 `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` 或使用 `https://` 地址添加市场（见 [使用 HTTPS 代替 SSH](https://github.com/ifoohoo/artifact-skill-set#using-https-instead-of-ssh)）。`ifoohoo/artifact-skill-set` 为独立公开市场，需该市场已上架并启用 `artifact-chain-assistant` 1.2.3 后上述市场安装命令方可拉取。

```text
# 2c. Kimi Code 插件安装（交互式，安装或升级后执行 /reload 或重开会话生效）
/plugins install https://github.com/ifoohoo/artifact-chain-assistant
```

```bash
# 2d. Qoder 插件安装（示意命令，具体参数以执行时 qodercli plugin ... --help 为准）
qodercli plugin marketplace add ifoohoo/artifact-skill-set --scope user
qodercli plugin install artifact-chain-assistant@artifact-skill-set --scope user --json
qodercli plugin list --json
```

> **Google Antigravity 安装**：将完整插件包克隆或复制到 `~/.gemini/config/plugins/artifact-chain-assistant/`（读取根 `plugin.json`、`skills/**` 与 `scripts/**`）。

完整的宿主根路径定位、快速上手与团队成员克隆恢复说明见 [INSTALL.md](INSTALL.md)。

## 快速开始

1. 安装插件 1.2.3（见上节）并在目标仓库安装精确版本运行时：`pnpm add -D artifact-graph@1.2.3`。
2. 运行 `artifact-graph doctor --root . --format json` 验证运行时与原生模块绑定正常。
3. 首次接入项目时调用 `artifact-chain-setup` 体检，再按需授权 `artifact-chain-bootstrap` 初始化。
4. 日常收集需求与双维状态核查调用 `artifact-chain-requirements`；代码或制品改动后调用 `artifact-chain-maintainer` 刷新并审计版本锁。
5. 团队新成员克隆仓库后的环境恢复流程见 [INSTALL.md Clone Onboarding](INSTALL.md#clone-onboarding-second-developer-setup)。

## 常用 Agent 提示词

> 提示：版本锁审计只覆盖已声明并纳入扫描范围的关系，不等同于全部发布文件覆盖证明；代码与技能注释的扫描边界见运行时 [代码追溯接入说明](https://github.com/ifoohoo/artifact-graph/blob/main/INSTALL.md#code-traceability-and-coverage-boundaries)。

```text
请使用 artifact-chain-bootstrap，为当前项目初始化制品链。
先检查现有配置和制品，不要覆盖已有项目规则，也不要自动执行 bootstrap --force。
```

```text
请使用 artifact-chain-where-am-i 分析这个需求在当前制品链中的位置。
先检索已有制品，再推荐应加载的 context/packet 和后续入口技能。
```

```text
请使用 artifact-chain-maintainer 检查本次变更影响的制品关系，
执行 changed-only refresh，并用 strict-missing-lock 审计；如果锁文件变化，先让我审阅。
```

## 开源协议

Apache-2.0，详见 [LICENSE](LICENSE)。
