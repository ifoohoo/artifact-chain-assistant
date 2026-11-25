---
name: artifact-chain-where-am-i
description: 面向 artifact-graph 项目的搜索优先分诊入口。用于只读盘点项目已有能力与证据缺口、判断诉求属于新功能/缺文档/缺陷修复/续接任务，并定位关联的需求、规格、设计、契约与测试。盘点与定位全程只读，不因缺少图配置、方法注册表或审阅执行器而提前中断。
---

<!-- @feature ACA12 @scenario S-39 -->

# artifact-chain-where-am-i

<!-- @scenario S-01 @feature ACA1 -->
<!-- @feature ACA24 @scenario S-101 @scenario S-102 -->
<!-- @feature ACA29 @scenario S-159 @scenario S-160 @scenario S-161 -->

## 目标

先基于项目真实文件与图证据回答“当前有什么、缺哪一环、下一步从哪里接手”，再决定是否需要进入制作、审阅或修复制品流程。本技能只负责检索、盘点与分诊路由，不修改任何项目文件，也不执行版本锁刷新或初始化命令。

## 分支 0：先判断诉求形态

- **只问现状或下一步（无具体变更）**：进入**盘点模式**。
- **提出具体新需求、缺陷、补档或续接请求**：进入**任务定位模式**。
- **同时要求把新点子记下来**：先完成只读盘点与查重检索；尚未选定仓库时可提示使用 `artifact-graph inbox add`，已确定目标仓库时路由 `artifact-chain-requirements` 落盘（无需预先具备图配置）。

两种模式都先完成业务语义分诊。即便 Method Registry、有效索引、`project-facts` 信封或审阅执行器缺失，也只把它们记入“方法执行缺口”，绝不在盘点前提前返回 `NEEDS_INPUT`。

## 项目发现步骤

1. 通过用户指定目录或 `git rev-parse --show-toplevel` 定位项目根目录。
2. 依次读取实际存在的 `AGENTS.md`、`CLAUDE.md`、`README.md`、`artifact-graph.config.yaml`、制品目录说明与执行计划（若工作区存在 `.artifact-inbox/ideas.jsonl`，也可一并检索相关想法）。
3. 存在 `artifact-graph.config.yaml` 时，读取已登记的制品类型、扫描路径、编号模式、别名与层级；配置不存在时，直接检索 `artifacts`、`docs`、`design-sources`、`src`、`packages`、`test`、`tests`、`apps` 等目录，并将“尚未建立制品链配置”列为缺口。
4. 先查看 `artifact-graph --help`，仅调用当前已安装 CLI 支持的只读子命令。环境诊断归属 `artifact-chain-setup` 或 `artifact-graph doctor`；图健康审计归属 `artifact-audit` 或 `artifact-graph validate`。

## 盘点模式

全程保持只读，按以下顺序归纳事实：

1. 梳理已有制品类型、核心业务能力、源码实现入口，以及最近的 `open` SPEC 与需求池条目。
2. 在已配置路径或回退目录中检索关键 ID、实现文件、测试与验证证据。读取需求条目时一并提取 `status`、`disposition`、`satisfaction`（或 `coverage`）、`demand_kind`、`requirement_level`、`parent_requirement` 与 `derived_from`；历史条目缺少可选字段时记为 `unknown`，不判为无效（批量盘点可用 `requirement-state-check.mjs --summary`）。
3. 配置与 CLI 就绪时运行只读的 `query`、`context`、`impact` 或 `coverage`（`coverage` 仅说明图关系、扫描与验证声明各自的覆盖边界，不代表业务验收完成）。
4. 将“证据缺口”与“未知项”分开列出；无明确基线分母时不虚构完成率百分比。
5. 给出唯一、最小的下一步动作（如保存需求、补齐当前制品、初始化配置、续接 `open` SPEC、刷新版本锁或调用某项专业服务）。

固定输出四栏结论：**已有能力**、**证据缺口**、**未知项**、**下一步**。

## 任务定位模式

先用一句话复述并保留用户原始诉求，提取其中的领域名词、界面/命令、制品 ID、API/字段、报错关键词与期望结果；随后检索需求池、`open` SPEC、当前制品、源码与测试，按证据归入四类路径之一：

- **新功能**：目标明确，但尚无对应实现且现有制品未定义该行为 → 下一步保存或复用需求条目并进入 SPEC 准备。
- **已实现但缺文档**：代码行为或运行证据已存在，但当前制品缺失或落后 → 下一步仅补齐直接关联的制品与追溯边。
- **缺陷修复**：实际表现偏离已批准的需求、契约或场景 → 下一步引用既有基线修复并补充回归验证（小缺陷修复不强制整仓补档）。
- **续接已有任务**：命中相关的 `open` SPEC、需求条目的 `carried_into` 或在途执行计划 → 下一步从既有未完成项接续，避免重复立项。

检索需求关系时严格区分两条有向边：`parent_requirement` 对应同层分解（`decomposes`），`derived_from` 对应从原始诉求派生开发需求（`derives-from`）；存在父子或派生关系的两端条目均须保留，不得当作重复需求合并。若现有证据不足以区分路径，输出 `unknown` 并只追问一个决定走向的关键问题。

## Artifact Graph 只读取证与四类交付事实

命中已配置类型的制品 ID 后，优先使用只读图命令提取上下文与影响面：

```bash
artifact-graph query --from <type>:<id>
artifact-graph context --target <type>:<id> --mode implementation
artifact-graph coverage --format json
artifact-graph impact --worktree
artifact-graph alignment-audit --json
```

其中 `alignment-audit --json` 用于只读核对单仓公开入口认领状态（`implementationSurface`）、高阶拆分清单与子项目上游回指绑定是否漂移，并读取由下游真实代码/测试锁机器派生的需求满足状态（`computedSatisfaction`）。若 `context` 或 `packet` 提示 `missing`，将其如实记入追溯缺口，禁止凭空推测实现状态。对每个候选需求或制品，分别核查并汇报四类独立事实（均须写明来源、适用版本与结论，无权威证据时填 `unknown`）：

- **批准（approved）**：用户或项目权威批准记录；
- **实现（implemented）**：真实代码交付或已核收变更记录；
- **验证（verified）**：测试实际运行输出或独立验收收据；
- **发布（released）**：发布工具结果与精确版本号。

图中的 `implements` / `verifies` 边、追溯注释、测试文件存在、锁文件新鲜或发布文件清单均只构成声明证据，不能自动升格为上述交付事实。

## Method Registry 按需检查规则（仅在需要调用专业服务时触发）

唯有当分诊结论已明确指向某项专业制作、审阅或修复服务时，才去检查 `<project>/.agent-method-registry/effective-index.json`、Registry CLI、项目绑定与 worker；若缺失，保留已得出的盘点/定位结论，仅将该服务标为“已发现但尚不可执行”（仅当用户要求立即执行且缺口无法补齐时返回 `NEEDS_INPUT`）：

- **严格区分 v1 overlay 与 v2 binding**：Registry v1 通过 catalog 与可选 `agent-methods/project.yaml`（`overrides[ref]`、`entries`、`disabled`）构建有效索引，不可混同于 v2 的 `BindingData`。Registry v2 由调用方将 `familyApi`、`implementations`、`inventory` 与 `bindings` 传入 `buildEffectiveIndex(...)`，再配合本技能构造的 `methodQueryCandidate` 调用 `queryEffectiveIndex({ index, methodQueryCandidate, purpose: 'recommendation' })`，仅依据返回的服务身份（`serviceId`、`apiId`、`apiMajor`、`apiRevisionDigest`）与原生状态字段（`executable`、`installation`、`enablement`、`compatibility`、`trust`、`resolution`、`selectionSource`）给出建议，不把实现细节反向写回图配置或制品正文。
### Method Query Candidate 输出

通过 `<plugin-root>/scripts/method-query.mjs` 依次运行 `build-envelope`、`validate-envelope`、`build-candidate`。生成的 Candidate 包含 5 个顶层键：`mode`、`intent`、`kind`、`projectFactsEvidence`、`authorization`（禁止手算摘要或把缺失事实伪造为 `fresh`），再调用公开入口：

```bash
agent-method-registry query \
  --index <project>/.agent-method-registry/effective-index.json \
  --candidate <candidate-json-path>
```

该查询仅作推荐（`recommendation`），不代表执行授权；进程内能力 `preparedQueryHandle` 仅由 prepare 模式在同一进程内签发，本技能不得输出或序列化、缓存或声称持有它（`queryDigest` 等完整查询字段同样只由 Registry 生成）。返回 0 项报缺失；返回多项报歧义并要求项目显式绑定，不能取第一项；返回 1 项且 `executable: true`（须具备 `resolution: EXPLICIT_BINDING` 与 `selectionSource: project-binding`）时方标为可执行，若为 `false` 则按返回字段解释缺口而不得重新推导可执行性。不得自行解析提供方路径或读取第三方 `SKILL.md`；写入型候选必须附带明确授权状态。

## 默认测试交接

<!-- @feature ACA27 @scenario S-151 -->

只读盘点与分诊阶段仅在“下一步”中提示默认测试规划入口与缺口，不因缺少测试工具而中断分诊。当用户确认继续并授权进入制作阶段后，按 `<plugin-root>/skills/spec-author/references/default-testing.md` 交接测试计划（已有测试计划时仅增量更新受影响部分）。

## 后续路由与返回说明

- **需求收集、双维状态更新与合并/延期/放弃**：路由 `artifact-chain-requirements`（纯收集与查询不依赖 Graph/Registry）。若用户已授权撰写专业需求正文或正式规格，转交前先按 `<plugin-root>/skills/artifact-review/references/method-selection.md` 查询 `artifact / requirement / author` 或 `artifact / spec / author` 并交接给唯一 `verified` 作者；解析失败时保留只读分诊结论与缺口诊断，不强行走默认作者。
- **首次建链、项目形态演进或扩展制品类型**：路由 `artifact-chain-bootstrap`。
- **日常版本锁刷新、严格审计与 Git Hook 装卸**：路由 `artifact-chain-maintainer`。
- **制品物理拆分、身份拆分、跨文件移动或重编号**：路由 `artifact-chain-restructure`（纯分析请求停在映射、候选计划与必要的独立复审，完整人工映射或纯确定性迁移不强制调用模型；待写入授权与并发确认齐备且复审通过后，由同一入口继续路由 `apply`、`recover`、`prune-recovery`，并将文件迁移与精确锁收尾分开汇报）。
- **已绑定且可执行的专业制作/审阅/修复**：路由对应的 family/service。
- **纯环境体检 / 纯图健康扫描**：分别路由 `artifact-chain-setup` 与 `artifact-audit`。
- **输出结构**：盘点模式输出已有能力、证据缺口、未知项、下一步及四类交付事实；任务定位模式输出原始诉求、路径分类、命中文件与图证据、四类交付事实（命中需求时附带 `disposition`、`satisfaction`、`demand_kind`、`requirement_level`、父需求与来源需求）、建议加载的上下文、方法执行缺口与目标入口技能。

## {{hostName}} 行为

{{hostBehavior}}
