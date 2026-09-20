---
name: artifact-chain-where-am-i
description: 面向 artifact-graph 项目的搜索优先分诊入口。用户要盘点项目已有能力与证据缺口、判断一个需求属于新功能/缺文档/缺陷/续接任务，或查找相关规格、设计、契约和测试时使用。盘点与语义定位保持只读，不因缺少配置、Method Registry 或 worker 而停止。
---

<!-- @feature ACA12 @scenario S-39 -->

# artifact-chain-where-am-i

<!-- @scenario S-01 @feature ACA1 @feature ACA24 @scenario S-101 @scenario S-102 -->

## 目标

先用项目证据回答“现在有什么、缺什么、这件事该从哪里继续”，再决定是否需要制作、审阅或修复制品。该技能只做搜索、盘点和分诊，不修改项目，也不运行维护命令。

## 分支 0：先判断有没有明确任务

- 用户没有提出具体变更，只问项目现状或下一步：进入**盘点模式**。
- 用户提出了具体想法、缺陷、文档或续接请求：进入**任务定位模式**。
- 用户同时要求保存新想法：先完成只读盘点，再路由 `artifact-chain-requirements` 保存每个想法。项目没有配置也能保存。

盘点与任务定位都先完成语义判断。Method Registry、effective index、project-facts envelope 或 worker 缺失时，把它们列为方法执行缺口，不得提前返回 `NEEDS_INPUT`。

## 项目发现

1. 以用户指定路径或 `git rev-parse --show-toplevel` 确定项目根。
2. 读取存在的 `AGENTS.md`、`CLAUDE.md`、`README.md`、`artifact-graph.config.yaml`、制品目录说明和执行计划。
3. 配置存在时，从中读取制品类型、路径、ID 模式、别名、层级和 target 类型。配置不存在时，搜索实际存在的 `artifacts`、`docs`、`design-sources`、`src`、`packages`、`test`、`tests`、`apps`，并把“尚未建立制品链配置”列为缺口。
4. 查看 `artifact-graph --help`，只调用当前 CLI 确实支持的命令。环境诊断属于 `artifact-chain-setup` 或 `artifact-graph doctor`；图健康检查属于 `artifact-audit` 或 `artifact-graph validate`。

## 盘点模式

保持只读，按以下顺序建立结果：

1. 列出已有制品类型、主要能力、实现入口和最近的 open SPEC/需求条目。
2. 使用配置路径或 fallback 路径搜索关键 ID、代码入口、测试和运行证据。
   需求条目同时读取 `demand_kind`、`requirement_level`、`parent_requirement` 和 `derived_from`；旧条目缺字段时对应维度为 `unknown`，不判为无效。
3. 配置与 CLI 支持时运行 `query`、`context`、`impact` 或 `coverage`。`coverage` 只说明图关系、扫描、行为验证和发布覆盖各自评估到哪里；它不证明项目完整。
4. 分开记录证据缺口与未知项。没有目标基线时不输出完成率。
5. 给出一个最小下一步：保存需求、补当前制品、建立配置、续接 open SPEC、修复追溯，或进入明确的专业服务。

输出固定包含“已有能力”“证据缺口”“未知项”“下一步”。缺 Registry 或 worker 只影响专业方法是否可执行，不影响这四项结论。

## 任务定位模式

用一句话保留用户原始诉求，再抽取领域名词、页面、命令、ID、API/IPC、字段、错误词和期望结果。先搜索需求池、open SPEC、当前制品、实现和测试，再按证据分到一种情况：

- **新功能**：需求或期望结果明确，但没有对应实现，或现有制品也未定义该行为。下一步通常是保存/复用需求并起草 SPEC。
- **已实现但缺文档**：实际行为或实现证据存在，当前制品缺失或过期。下一步只补直接相关制品与追溯。
- **缺陷修复**：实际行为与已经批准的需求、契约或场景不一致。下一步引用现有基线并修复、回归验证；小修复不要求补齐整套项目文档。
- **续接已有任务**：存在相关 `open` SPEC、需求条目的 `carried_into` 或明确执行计划。下一步先恢复未完成项及其承接位置，不另起重复需求。

需求检索要区分两种方向：子条目的 `parent_requirement` 指向同层父条目，对应 `decomposes`（分解自）边；开发条目的 `derived_from` 指向一个或多个来源原始条目，对应 `derives-from`（派生自）边。有上下级或派生关系时保留两端条目，不能按重复项合并。

证据不足以选择时输出 `unknown`，并只问一个会改变路线的问题。

## Artifact Graph 取证

目标类型必须来自当前配置或 CLI 帮助。找到 ID 后优先运行当前版本支持的查询，例如：

```bash
artifact-graph query --from <type>:<id>
artifact-graph context --target <type>:<id> --mode implementation
```

命令用于取得关系和实现上下文。若 `context` 或 `packet` 报告 `missing`，把它列为追溯缺口，不得据此猜测实现状态。版本锁、锁边、源码注释和测试文件只证明存在追溯声明。

当前 CLI 支持时，可用 `artifact-graph coverage --format json` 查看评估边界，用 `artifact-graph impact` 查看变更关联制品。这些命令保持只读；不要在本技能中运行 `version-lock refresh`、`bootstrap` 或自动修复。

## 四类交付事实

对候选需求或制品分别报告：

- **批准**：用户或项目权威批准记录；
- **实现**：实际实现、交付结果或被接受的变更记录；
- **验证**：测试运行结果或独立验收记录；
- **发布**：发布工具结果和精确版本。

每类都注明来源、适用对象或版本和结论。没有对应证据时写 `unknown`。`implements`/`verifies` 边、execution 文件引用、测试文件、锁记录或发布输入清单不能自动升级任何事实维度。

## Method Registry 只在选择服务时检查

只有分诊已经明确指向某个制作、审阅或修复服务时，才检查 `<project>/.agent-method-registry/effective-index.json`、Registry CLI、binding 和 worker。缺少配置、有效索引、binding 或 worker 时，保留前面的盘点/定位结论，把专业服务标为“已发现但尚不可执行”。只有用户要求立即调用该服务且缺口无法补齐时，输出 `NEEDS_INPUT`。

### v1 overlay 与 v2 binding 不混用

- Registry v1 从 catalog 和可选的 `ProjectOverlayData` 构建有效索引。项目覆盖源通常是
  `agent-methods/project.yaml`；`overrides[ref]`、`entries` 和 `disabled` 只表达 v1 入口覆盖，
  不能当作 v2 binding。
- Registry v2 使用已经选定并解析为 `BindingData` 的原始绑定文档。调用方把 `familyApi`、
  `implementations`、`inventory` 和完整 `bindings` 文档传给包根公开函数
  `buildEffectiveIndex(...)`，再把返回的 index 与本技能产出的 `methodQueryCandidate` 传给
  `queryEffectiveIndex({ index, methodQueryCandidate, purpose: 'recommendation' })`。
- recommendation 只按 Registry 返回的服务身份 `serviceId`、`apiId`、`apiMajor`、
  `apiRevisionDigest` 和原生状态 `executable`、`installation`、`enablement`、`compatibility`、
  `trust`、`resolution`、`selectionSource` 做建议。本技能不得把实现身份复制进图配置、
  workflow profile 或制品正文。
- 制品侧采用记录只保存绑定源引用和服务身份。项目内部 worker 不等于 Registry binding；
  文档中出现的路径也不构成自动发现协议，调用方必须显式选择并读取输入。

### Method Query Candidate 输出

调用插件安装根中的 `<plugin-root>/scripts/method-query.mjs`，依次执行 `build-envelope`、`validate-envelope` 和 `build-candidate`。Candidate 有 5 个顶层键：`mode`、`intent`、`kind`、`projectFactsEvidence`、`authorization`。不要手工计算 digest，也不要把缺失事实写成全零或 fresh。

动态发现使用 Registry 的公开查询入口：

```bash
agent-method-registry query \
  --index <project>/.agent-method-registry/effective-index.json \
  --candidate <candidate-json-path>
```

该命令只做 recommendation，不等于执行授权。0 项返回缺失建议；多项报告歧义并要求项目 binding 明确选择，不能取第一项；1 项只有在 Registry 返回 `executable: true` 时才标记可执行。若 `executable: false`，读取 `installation`、`enablement`、`compatibility`、`trust`、`resolution`、`selectionSource` 解释缺口，但不得重新推导可执行性。`resolution: EXPLICIT_BINDING` 与 `selectionSource: project-binding` 是可执行的必要条件。

`preparedQueryHandle` 只由 Registry 在 prepare 模式的同一进程内签发。本技能使用 recommendation 模式，不创建它，也不得输出或序列化、缓存或声称持有它。`queryDigest` 等完整 Method Query 字段同样由 Registry 产生。

不得自行解析提供方路径或读取第三方 `SKILL.md`。contract-backed service 不使用 builtin/config fallback；写入型 candidate 必须携带明确授权状态。

Registry、有效索引或所需 binding 缺失时，只把动态专业服务标为不可执行。静态 help、普通图查询和已有固定直调入口继续按各自合同工作；不得据此宣布动态 projection 已接入。

## 后续路由

- 保存、查询、合并、延期、拒绝需求，或建立/验收增量 SPEC：`artifact-chain-requirements`。
- 首次建立配置、项目形态变化或扩展类型：`artifact-chain-bootstrap`。
- 锁刷新、审计与日常追溯维护：`artifact-chain-maintainer`。
- 制品拆分、身份拆分、跨文件移动或重编号：`artifact-chain-restructure`。只分析请求停在映射、候选计划和必要的独立复审；完整人工映射或纯确定性路径不强制调用模型。授权覆盖真实写入且复审通过后，同一入口继续路由应用、恢复与清理，并把文件迁移与精确锁收尾分别报告。
- 明确制品制作、审阅或修复：在 Registry 确认可执行后路由对应 family/service。
- 单纯环境诊断：`artifact-chain-setup`；单纯图健康检查：`artifact-audit`。

续接和并行是执行方式。执行进度继续使用项目现有 execution plan 或长任务工具，不复制进需求池或本次盘点。

## 输出

盘点模式输出已有能力、证据缺口、未知项、下一步和四类事实。任务定位模式输出原始诉求、分类、命中证据、四类事实、需要加载的上下文、方法执行缺口和下一步技能。命中需求条目时，另列诉求性质、需求层次、同层父需求和来源需求；缺少可选字段时输出 `unknown`。所有路径和命令来自当前项目；不输出虚构完成率，不把图健康或模板存在当作交付完成。

## {{hostName}} 行为

{{hostBehavior}}
