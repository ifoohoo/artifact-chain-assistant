---
name: where-am-i
description: 面向任意 artifact-graph 项目的搜索优先需求分诊技能。用于用户用自然语言提出模糊需求、询问接下来做什么、确认某个功能/规格/设计/契约/测试是否已存在，或从 PRD、场景、API/IPC/数据/报告/UI 契约、原型/样式问题、测试想法、规则纠偏、产品缺口进入开发前，帮助 Codex 根据当前项目配置自动检索现有制品并判断应使用哪条 artifact-graph context/packet 命令和后续技能。
---

<!-- @feature ACA12 @scenario S-39 -->

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

## Method Registry 消费

<!-- @scenario S-39 @feature ACA12 -->

在完成项目发现后，检查是否有 `agent-method-registry` 可用于专业制品入口解析。

1. **查找 effective index**：检查 `<project>/.agent-method-registry/effective-index.json` 是否存在。
2. **检查 registry CLI**：检查 `agent-method-registry` 是否在 PATH 或项目的 `node_modules/.bin/` 中可用。
3. **如果两者都可用**：
   - 运行 recommendation query 获取匹配当前制品类型和意图的入口元数据及 `installation`、`enablement`、`compatibility`、`trust`、`resolution`、`selectionSource` 状态。
   - 只推荐 effective provider，不同时列出插件默认和项目覆盖两份候选。
   - 如果匹配入口的 `kind: workflow`，将其视为闭环叶子——不建议外围 review/repair 阶段。
   - **不得自行解析提供方路径或加载第三方 `SKILL.md`**。产出五字段候选后交给 Registry 查询；`loop-agent` 可复用本技能的分诊结果，也可直接调用 Registry，但不属于本技能内部流程。
4. **如果不可用**：
   - 输出 `NEEDS_INPUT` + "registry unavailable" 诊断和采用步骤。
   - 不自行合并 catalog 和 overlay，不猜测合并结果。
   - 不自动创建空 overlay 或空 effective index。
   - contract-backed service 不得使用 builtin/config fallback。

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

## Project-Facts Evidence Envelope

在产出最终判定之前，必须形成结构化的 project-facts evidence envelope。这是与 registry 和外层规划器（如 `loop-agent`）的机器可消费交接对象。

```json
{
  "schemaVersion": 1,
  "projectRoot": "<project-root-identity>",
  "configDigest": "sha256:<hex-of-artifact-graph-config>",
  "policyDigest": "sha256:<hex-of-project-policy-or-null>",
  "artifactGraphSummary": {
    "artifactCount": 0,
    "edgeCount": 0,
    "contextTargets": []
  },
  "targetArtifact": {
    "type": "<artifact-type>",
    "id": "<artifact-id>"
  },
  "contractRevisionDigest": "sha256:<hex-of-contract-revision-content>",
  "proofStatus": "present | missing | stale",
  "versionLockStatus": "fresh | stale | missing",
  "sourcesFreshness": "fresh | stale | missing",
  "bindingFreshness": "fresh | stale | missing",
  "evidenceDigest": "sha256:<hex-of-envelope-content-excluding-this-field>"
}
```

**`evidenceDigest` 计算**：对移除 `evidenceDigest` 字段后的 envelope 内容按确定性键排序序列化，再计算 SHA-256。相同语义不同键顺序必须产生相同 digest。

**Fail-closed 规则**：
- 缺 `projectRoot`：`NEEDS_INPUT`，不得继续
- 缺 `configDigest`（无 `artifact-graph.config.yaml`）：`NEEDS_INPUT`，建议 `artifact-chain-bootstrap`
- 缺 `targetArtifact` 且用户需求明确指向某制品类型：`NEEDS_INPUT`
- 缺 `artifactGraphSummary`、`sourcesFreshness` 或 `bindingFreshness`：`NEEDS_INPUT`，不得制造全零或 fresh 证据
- `versionLockStatus: stale` 或 `missing`：报告风险，建议先运行 `artifact-chain-maintainer`
- `proofStatus: missing`：在推荐中提醒追溯缺口

## Method Query Candidate 输出

结论模式的输出必须附加结构化 Method Query Candidate（方法查询候选，5 个顶层键），供 Registry 的 `queryEffectiveIndex` 消费并返回匹配服务元数据：

```json
{
  "mode": "standard",
  "intent": "author",
  "kind": "workflow",
  "projectFactsEvidence": { "schemaVersion": 1, "..." : "完整 envelope 内容" },
  "authorization": {
    "sideEffectBudget": "write-authorized-artifacts",
    "granted": false
  }
}
```

**Candidate 构建流程**（fail-closed）：
1. 生成并验证 project-facts envelope（`build-envelope` + `validate-envelope`）
2. 构建 5-key candidate（`build-candidate`）
3. 通过 Registry 查询有效索引，取得 0、1 或多个匹配服务并形成推荐解释
4. Registry 不可用、索引无效、绑定缺失或查询被拒绝时：输出 `NEEDS_INPUT` 和诊断步骤，标明“尚不可执行”

动态发现使用 Registry 的公开查询入口，不读取其内部文件结构：

```bash
agent-method-registry query \
  --index <project>/.agent-method-registry/effective-index.json \
  --candidate <candidate-json-path>
```

该命令用于推荐，不等于执行授权。必须按以下规则解释结果：

- 0 项：返回缺失建议，不得声称存在可用技能。
- 多项：报告歧义并建议项目通过 binding（绑定）明确选择，不能取第一项。
- 1 项：可以推荐该技能作为下一步候选，但只有当 Registry 返回的 `executable` 字段为 `true` 时，才能标记为“可执行”。
- 单候选若 `executable` 为 `false`：输出 `NEEDS_INPUT`，读取六状态（`installation`、`enablement`、`compatibility`、`trust`、`resolution`、`selectionSource`）用于诊断，但**不得重新推导可执行性**。明确标注“已发现但尚不可执行”。
- 六状态中 `resolution: EXPLICIT_BINDING`，`selectionSource: project-binding`，这是可执行的必要条件。

**Candidate 校验规则**：
- 缺 `projectFactsEvidence`：不得输出 candidate
- envelope 验证失败：不得构建 candidate
- 写入型推荐必须显式携带授权状态；`granted: false` 表示可推荐但不可执行

**执行能力只由 Registry 产出**：
- `targetArtifact`、`contractRevisionDigest`、`projectFactsEvidenceDigest`、`candidateServices`、`registrySnapshot`、`queryDigest` 均由 Registry 从 candidate 和 effective index 派生
- 助手不得自行生成完整 Method Query 或 queryDigest
- `preparedQueryHandle` 是 Registry 在 `prepare` 模式下在同一进程内签发给后续执行器的不可伪造能力；本技能使用 `recommendation` 模式查询，不创建它，也不得输出或序列化、缓存、声称持有它
- v2 查询使用 `purpose: 'recommendation'`，CLI 输出不含 handle 或 queryDigest

**不允许的行为**：
- 不得输出 provider path 或 "直接运行 SKILL.md"
- 不得对 contract-backed service 使用 builtin/config fallback
- 不得自动选择第一候选或多候选中的"最佳"
- 只有明确标记为 generic non-contract-backed 的旧入口可按其既有协议建议，且必须与标准 service 区分

必须调用插件安装根中的 `scripts/method-query.mjs` 构建并验证 envelope 和 candidate，不手工拼装摘要或 digest。Registry 不可用时：输出 `NEEDS_INPUT` + 诊断步骤，不假装可以解析。

## 输出契约

输出必须二选一：`结论模式` 或 `追问模式`。不要在信息不足时同时输出完整判定、证据、追问和下一步技能。

所有报告必须遵循**价值叙事规则**：不能只列"做了什么"或"发现了什么"，还要说明它对项目的意义。参见 AGENTS.md 的"价值叙事规则"段落。

### 结论模式

- `判定`：当前阶段、置信度、source-of-truth 制品，以及现在是否允许进入实现。
- `证据`：命中的制品、代码路径、设计来源，以及重要的缺失/过期制品。
- `project-facts evidence envelope`：结构化项目事实摘要（JSON），包含 projectRoot、configDigest、targetArtifact、proofStatus、versionLockStatus 和 evidenceDigest。
- `需要加载的上下文`：已经运行或下一步应运行的精确 `artifact-graph` 命令。
- `候选标准服务`：`serviceId@major` 列表，来自 Family API Catalog。
- `方法查询候选`：五字段结构化候选（JSON），以及 Registry 返回的 0、1 或歧义匹配结果；不得输出完整 Method Query 或进程内句柄。
- `下一步技能`：建议后续技能。
- `提示词建议`：给 Codex 或其他 AI Coding 工具的短提示词，默认不超过 4000 字符。
- `价值判断`：说明本次分诊结果对项目的价值——它揭示了哪些缺口或确认了哪些能力已就绪，以及这对后续工作路径意味着什么。

### 追问模式

- `已发现`：最多 5 条关键证据或候选方向。每条证据附带其对项目决策的意义，而非仅列文件名。
- `还缺什么`：说明缺哪个决定性信息，以及这个信息对路线选择的影响。
- `追问`：只问一个证据驱动问题。

## 技能协作边界

### 路由决策树

当完成入口分诊后，根据以下条件路由到后续技能：

**路由到 `artifact-chain-bootstrap`**：
- 项目首次采用 artifact-chain（无 `artifact-graph.config.yaml`）
- 项目需要迁移或重建制品链配置
- 项目形态发生重大变化（如从 CLI 扩展为 API 服务）
- 需要扩展制品类型 profile（如新增 `api_contract`、`deployment_manifest`）
- `artifact-graph doctor` 报告配置缺失或严重不一致

**路由到 `artifact-chain-maintainer`**：
- 项目已有完整的制品链配置
- 日常开发中的版本锁刷新、审计、hook 管理
- 代码或制品变更后的追溯维护
- `artifact-graph validate` 或 `version-lock audit` 发现的问题修复
- Git hook 安装或更新

**直接进入实现**：
- 制品链配置完整，版本锁新鲜
- `artifact-graph context` 输出包含完整的上下游关系
- 无孤立制品或缺失追溯警告

### 技能生命周期衔接

```
用户模糊需求
    ↓
where-am-i 分诊
    ↓
┌─────────────────────────────────────────────────┐
│ 项目状态判断                                      │
├─────────────────────────────────────────────────┤
│ 无配置/配置严重不一致 → artifact-chain-bootstrap  │
│ 配置完整但锁陈旧/有警告 → artifact-chain-maintainer│
│ 配置完整且锁新鲜 → 直接实现                       │
└─────────────────────────────────────────────────┘
    ↓
bootstrap 完成后 → maintainer 接管日常维护
maintainer 发现配置问题 → 重新路由到 bootstrap
```

### 关键边界规则

1. **where-am-i 不执行维护操作**：只负责分诊和路由，不运行 `version-lock refresh` 或 `validate`
2. **bootstrap 不做日常维护**：初始化完成后交接给 maintainer，不重复运行 `version-lock refresh --changed-only`
3. **maintainer 不重建配置**：发现配置严重问题时路由回 bootstrap，不自行修改 `artifact-graph.config.yaml` 的类型定义
4. **技能间不嵌套调用**：每个技能独立完成其职责，通过输出契约交接

## Codex 行为

在 Codex 中，优先在当前线程完成搜索和 intake 结果。用户要求继续且路线清晰时，再调用推荐的后续技能，或基于已加载的 artifact-graph context 继续执行。
