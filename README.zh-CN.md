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
