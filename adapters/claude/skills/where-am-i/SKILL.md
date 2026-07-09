---
name: where-am-i
description: 面向任意 artifact-graph 项目的搜索优先需求分诊技能。用于用户用自然语言提出模糊需求、询问接下来做什么、确认某个功能/规格/设计/契约/测试是否已存在，或从 PRD、场景、API/IPC/数据/报告/UI 契约、原型/样式问题、测试想法、规则纠偏、产品缺口进入开发前，帮助 Claude Code 根据当前项目配置自动检索现有制品并判断应使用哪条 artifact-graph context/packet 命令和后续技能。
---

# where-am-i

<!-- @scenario S-01 @feature ACA1 -->

## 目的

把模糊需求分诊到当前项目制品链中的正确阶段，再决定是否进入设计或实现。不要让用户自己判断生命周期阶段；必须先读取当前项目说明和 artifact-graph 配置，搜索既有制品、过程文档、设计来源和代码，再在仍有关键歧义时提出一个基于证据的苏格拉底式追问。

本技能只负责入口分诊和路由。只有产出有证据支撑的 intake 结果后，才能建议或调用后续技能。

## 项目发现

1. 以当前工作目录为项目根，必要时通过 `git rev-parse --show-toplevel` 或项目说明确认根目录。
2. 读取项目级说明文件，例如 `AGENTS.md`、`CLAUDE.md`、`README.md`、`artifact-graph.config.yaml`、制品链规范、制品类型注册表或等价文件。
3. 运行或查看 `artifact-graph --help`，确认当前项目支持的命令和 context 目标类型。如果项目使用本地 CLI 路径，按项目说明替换。
4. 从 `artifact-graph.config.yaml` 或等价配置中提取制品类型、路径、别名、层级和可作为目标的类型。不要把任何单一项目的类型集合当作通用事实。

## 必须执行的流程

1. 用一句话保留用户原始诉求。保留不确定性，不要把模糊表达强行改写成看似确定的工单。
2. 抽取搜索线索：领域名词、页面名、命令、规则、ID、API、IPC/消息名、数据/报告字段、错误词、期望结果和引号中的短语。
3. 先搜索再追问：优先搜索当前项目配置声明的制品路径、过程文档路径、设计来源路径和实现路径。若配置未声明，使用常见 fallback：`artifacts docs design-sources src packages tests apps` 中存在的目录。
4. 若找到 ID，运行当前项目支持的 `artifact-graph query --from <ID>`；若出现可能的实现目标，运行当前项目支持的 `artifact-graph context --<target-type> <ID> --mode implementation`。
5. 建立候选状态图：已存在的源头制品、实现证据、过期或缺失制品、最可能的 source of truth。
6. 如果当前项目 CLI 支持 `version-index`、`version-lock` 或 `trace-version`，并且问题涉及“代码是否落后”“哪个版本实现哪个制品”“实现与制品版本是否一致”，优先用这些命令做证据采样。
7. 只有搜索后仍存在影响路线的关键歧义时，问一个证据驱动的问题。

## Artifact-Graph 使用规则

自动使用 `artifact-graph`，但目标类型必须来自当前项目的 CLI 帮助或配置。`trace-version`、`version-lock`、`version-index` 只用于版本关系取证和过期判断；它们不替代实现前必须加载的 `context`、`packet` 或 `packet-prompt`。

如果 `context` 或 `packet` 输出 `missing`，停止实现路由，先建议修复追溯或制品缺口。

## 输出契约

输出必须二选一：`结论模式` 或 `追问模式`。不要在信息不足时同时输出完整判定、证据、追问和下一步技能。

### 结论模式

- `判定`：当前阶段、置信度、source-of-truth 制品，以及现在是否允许进入实现。
- `证据`：命中的制品、代码路径、设计来源，以及重要的缺失/过期制品。
- `需要加载的上下文`：已经运行或下一步应运行的精确 `artifact-graph` 命令。
- `下一步技能`：建议后续技能。
- `提示词建议`：给 Claude Code、Codex 或其他 AI Coding 工具的短提示词，默认不超过 4000 字符。

### 追问模式

- `已发现`：最多 5 条关键证据或候选方向。
- `还缺什么`：说明缺哪个决定性信息。
- `追问`：只问一个证据驱动问题。

## Claude Code 行为

在 Claude Code 中，优先产出可交接的 intake 结果。如果允许进入实现且任务要委派执行，生成或建议当前项目支持的 packet-prompt。
