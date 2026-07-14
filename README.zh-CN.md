# Artifact Chain Assistant

[English](README.md)

Artifact Chain Assistant 是面向 `artifact-graph` 项目的 Codex / Claude Code 助手插件。

它打包了可复用 skills、按宿主划分的适配器 manifest 和安装指引，帮助 agent 发现正确制品上下文、
初始化项目本地配置，并维护 traceability version lock。

## 提供什么

### 技能

- **`where-am-i`** — 入口分诊与路由。在实现开始前搜索项目制品图，路由到 bootstrap、
  maintainer 或直接实现。
- **`artifact-chain-bootstrap`** — 显式调用的项目初始化。引导首次设置、迁移或修复，
  11 步流程覆盖配置、AGENTS/CLAUDE 补丁、验证、版本锁和 hook 安装。
- **`artifact-chain-maintainer`** — 日常维护。覆盖 version-lock 刷新/审计、doctor 诊断
  和 Git hook 更新，面向已建立制品链的项目。

### 扩展制品目录

在核心类型（`feature`、`scenario`、`decision`、`design`、`test`、`e2e_test`）之外，
提供配置驱动的可选制品类型：

| 层级 | 类型 |
| --- | --- |
| 设计与契约 | `api_contract`、`data_contract`、`integration_contract`、`cli_contract`、`ui_contract`、`ipc_contract` |
| 实现与验证 | `batch_job_contract`、`database_migration` |
| 安全与性能 | `security_review`、`performance_budget` |
| 部署与运维 | `deployment_manifest`、`runbook`、`migration_plan` |
| Agent 与治理 | `agent_skill`、`hook_policy`、`prompt_packet`、`release_policy`、`publish_skill`、`oss_compliance` |

每种类型的推荐路径、ID 模式、生命周期规则和审查检查点详见
[扩展制品目录](EXTENDED-ARTIFACT-CATALOG.zh-CN.md)。

### 按证据启用

bootstrap 仅在当地文件或目录存在时才启用扩展制品类型。例如：存在 OpenAPI/Swagger 规范
文件时启用 `api_contract`；存在 Flyway/Liquibase 迁移文件时启用 `database_migration`。
不会基于推测启用任何类型。

### 项目形态分类

九种项目画像各自映射到推荐的 starter 集合和延迟就绪列表：

- 文档/规划仓库 · TypeScript 库或 CLI · API 服务 · 企业级 Java/Spring/JVM ·
  桌面/全栈应用 · Agent/插件工具包 · Parent/发布治理仓库 ·
  已有成熟制品仓库 · 首次尝试的小型项目

bootstrap 技能对目标项目进行分类，仅启用具有稳定本地来源的类型。

### Starter 模板与采用指南

`templates/extended/` 为扩展类型提供入门指引。bootstrap 完成后，延迟启用的类型及其
证据条件会记录在项目的制品目录中，使未来的 profile 扩展成为有据可查的决策，而非临时添加。

### 专业技能族

两个与制品强绑定的技能族提供专业化的编写、审阅和修复工作流：

- **`prd-feature`** — 编写、审阅或修复 PRD 功能特性制品。每个子流程自行完成闭环：
  一旦进入，由 inspect → compose/review → validate → repair 循环自行终结，不需要
  上层规划器拆出独立的 review/repair 步骤。
- **`scenario-script`** — 编写、审阅或修复场景剧本制品。闭环契约与 `prd-feature` 相同。

每个技能族暴露四个公开入口：默认路由入口、`author`、`review` 和 `repair`。
内部工序资源（`inspect`、`compose`、`validate`）不注册为 catalog method。

目标项目配置和项目级 provider 优先。插件的默认技能族在项目无覆盖 provider 时作为
fallback 生效。

### Agent Method Registry（代理方法注册表）

插件内置了确定性的 agent-method-registry 集成，用于目录解析、提供者验证和 CLI 诊断。

**默认目录**：`<plugin-root>/agent-methods/catalog.yaml` 注册了 **8 个 workflow 入口**，
覆盖 `prd-feature` 和 `scenario-script` 两个技能族：

| Ref | 技能族 | 入口 |
|-----|--------|------|
| `artifact.prd-feature.default` | prd-feature | 默认路由入口 |
| `artifact.prd-feature.author` | prd-feature | 编写 |
| `artifact.prd-feature.review` | prd-feature | 审阅 |
| `artifact.prd-feature.repair` | prd-feature | 修复 |
| `artifact.scenario-script.default` | scenario-script | 默认路由入口 |
| `artifact.scenario-script.author` | scenario-script | 编写 |
| `artifact.scenario-script.review` | scenario-script | 审阅 |
| `artifact.scenario-script.repair` | scenario-script | 修复 |

#### 单独安装

如果只需要注册表能力，可以单独安装 `agent-method-registry@0.1.1`：

```bash
npm install agent-method-registry@0.1.1
```

安装后 CLI 可用为 `agent-method-registry`：

```bash
# 首先定位插件根目录
PLUGIN_ROOT=$(node -e "console.log(require.resolve('artifact-chain-assistant/package.json').replace('/package.json',''))")

# 验证目录
npx agent-method-registry validate --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml"

# 构建有效索引（无项目覆盖层）
npx agent-method-registry index \
  --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml" \
  --out .agent-method-registry/effective-index.json

# 查询索引
npx agent-method-registry query --index .agent-method-registry/effective-index.json
```

#### 构建有效索引

有效索引由目录加上可选的项目覆盖层构建：

```bash
# 仅目录（无项目 provider）
agent-method-registry index \
  --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml" \
  --out .agent-method-registry/effective-index.json
```

当项目没有 provider 文件时，注册表**不会**创建空的覆盖层文件，仅从目录构建有效索引。
只有项目定义了覆盖或禁用时才需要 `--project` 参数：

```bash
# 目录 + 项目覆盖层
agent-method-registry index \
  --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml" \
  --project agent-methods/project.yaml \
  --out .agent-method-registry/effective-index.json
```

#### 项目级覆盖

当目标项目有完整的入口定义时，在项目根目录放置 `agent-methods/project.yaml`。
示例 -- 将默认的 `prd-feature` 路由入口覆盖为项目本地技能：

```yaml
schemaVersion: 1
overrides:
  artifact.prd-feature.default:
    provider:
      scope: project
      skill: prd-feature
```

项目覆盖层还可以通过 `entries` 添加新入口，通过 `disabled` 禁用插件入口。

#### 有效索引是生成缓存

`.agent-method-registry/effective-index.json` 是**生成的构建产物**，不是事实来源。
它由 `catalog.yaml` 加上可选的 `project.yaml` 覆盖层派生而来。

- 不要手动编辑。
- 目录或项目覆盖层变更时需重新构建。
- 除非项目明确选择，否则不要提交到版本控制。

#### 面向规划器的紧凑查询

使用 `--format compact` 获取最小视图用于规划。紧凑查询只返回 `ref`、`kind` 和
`summary` -- 足够规划器选择入口而不加载完整元数据。选定后再用 `resolve` 获取提供者路径：

```bash
# 紧凑查询：规划器只看到 ref/kind/summary
agent-method-registry query \
  --index .agent-method-registry/effective-index.json \
  --domain artifact --artifact-type prd-feature \
  --kind workflow --format compact

# 选定后解析：获取完整提供者路径
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host claude-code \
  --plugin-root <plugin-root>/adapters/claude/skills
```

#### 闭环 workflow 入口

所有 8 个入口的 `kind` 均为 `workflow`。`workflow` 入口是**闭环叶子** -- 它自行完成
inspect、compose、review、validate 和 repair 循环。外层规划器不应为 workflow 入口
另行安排独立的 review 或 repair 步骤。

#### Registry 不可用时的 fallback 行为

当 `agent-method-registry` 未安装或有效索引不存在时，`where-am-i` 按以下流程回退：

1. 输出 `"registry unavailable"` 诊断信息。
2. 回退到现有项目配置与插件路由逻辑（基于配置的制品类型、技能路由决策树）。
3. **不会**尝试手动合并目录或创建空的有效索引。

#### 定位插件根目录

从已安装的包中查找插件根目录：

```bash
# npm / pnpm：解析包目录
PLUGIN_ROOT=$(node -e "console.log(require.resolve('artifact-chain-assistant/package.json').replace('/package.json',''))")
```

然后用于 resolve 命令：

```bash
# Codex
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host codex \
  --plugin-root "$PLUGIN_ROOT/adapters/codex/skills"

# Claude Code
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host claude-code \
  --plugin-root "$PLUGIN_ROOT/adapters/claude/skills"
```

### 其他资产

- **Codex** 仅暴露 `.codex-plugin/plugin.json` 和 `skills/**`，不暴露插件命令、hooks 或 settings。
- **Claude Code** 暴露 `.claude-plugin/plugin.json`、`skills/**`、slash command wrappers 和 Stop hook
  guardrail。
- Git hook 模板和安装器不依赖宿主。Git hooks 与 CI 才是 hard gate；各宿主的 skills 和 hooks 仅提供
  assistant guidance。

## 安装

当前 npm registry 尚未发布该包，请从公开 GitHub 仓库安装：

```bash
# Codex
codex plugin marketplace add https://github.com/mzdbxqh/artifact-chain-assistant.git
codex plugin add artifact-chain-assistant@artifact-chain-assistant

# Claude Code
claude plugin marketplace add https://github.com/mzdbxqh/artifact-chain-assistant.git
claude plugin install artifact-chain-assistant@artifact-chain-assistant --scope user
```

完成 registry 发布后，npm 安装可以成为首选 package 路径。

Codex / Claude Code 插件设置、目标项目准备和引导流程请参阅完整指南：
[INSTALL.md](INSTALL.md)。

每个目标项目都保留自己的 `artifact-graph.config.yaml`、`artifacts/**`、
`artifacts/traceability-version-lock.json`、`AGENTS.md`，以及可选的 `CLAUDE.md`。

## 相关项目

在使用插件做硬性校验之前，请先在目标项目中安装
[`artifact-graph`](https://github.com/mzdbxqh/artifact-graph)。

## 开源协议

Apache-2.0。详见 [LICENSE](LICENSE)。
