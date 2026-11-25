---
name: artifact-chain-requirements
description: 收集、查询和更新项目的需求条目，维护“交付状态 + 处置安排 + 目标满足程度”双维台账，并将选定需求承接到增量 SPEC。支持随口保存原始想法、查重关联、合并/延期/放弃处置、跨项目交接及 add/modify/delete 逐项验收回写；需求收集与只读查询不依赖图配置或方法注册表。
---

# artifact-chain-requirements

## 目标

把用户的原始诉求完整保存在受控台账中，维持“需求条目 → 当前制品 → 增量 SPEC → 验收证据”的可追溯链路。需求池负责保管原始诉求、目标满足程度与业务处置安排，不复制执行计划进度、长任务状态或发布流水线状态。

## 专业需求制作的方法选择

仅执行原始想法收集、只读查询或处置状态登记时，直接沿用本需求池流程，不依赖 `artifact-graph` 配置或 Method Registry。若目标项目已启用专业制作方法，在正式撰写开发需求正文前，须先按 `<plugin-root>/skills/artifact-review/references/method-selection.md` 查询 `artifact / requirement / author`：命中本技能时继续执行下文；命中其他已验证 Skill 时，将原始诉求与项目上下文完整交接给该提供方并停止默认作者流程；解析失败时仅暂停正文制作，不影响需求收集与查询。

## 先确定项目根与权威位置

1. **尚未选定具体仓库的跨项目想法**：若用户只是在多仓库工作区随口记下想法、尚未决定归属哪个业务项目，优先使用 `artifact-graph inbox add "<原始想法>" --context "<背景>"` 记入工作区 `.artifact-inbox/ideas.jsonl`（初始状态 `captured`，自动扫描近似故事与需求，不触发项目初始化）。
2. **已确定目标项目的需求条目**：通过用户指定路径或 `git rev-parse --show-toplevel` 定位项目根目录，读取项目说明与 `artifact-graph.config.yaml`。项目已有需求目录与编号约定时直接沿用；无约定时使用 `artifacts/requirements/<id>.md` 与编号模式 `^REQ-\d+$`（如 `REQ-1`，按目录中最小未使用正整数顺序分配，后续接入配置时保留原编号不变）。
3. **项目尚未配置 `requirement` 类型时**：仍在同一目录按同一编号规则创建条目，并在 `## 状态记录` 注明“尚未纳入图：项目未配置 requirement 类型”；不在项目内另建临时 `inbox` 目录。
4. **多条想法拆分与起点模板**：一次输入包含多个独立诉求时，逐条建立独立需求条目，不把未选入本轮迭代的想法硬塞进当前 SPEC。新建条目复制 `<plugin-root>/templates/core/requirement-entry.starter.md` 并替换全部占位符：未细化的原始想法标为 `captured`，已整理出明确期望行为但尚未获批的条目标为 `proposed`（收集不代表已批准）。

## 区分诉求性质与需求层次

所有需求共用同一套编号规则，通过两个正交字段表达属性，禁止互相推导：

- **`demand_kind`（诉求性质）**：取值为 `business`、`it`、`mixed` 或 `unknown`。依据诉求实质内容与来源判定，不凭行业背景或个别字眼臆测；信息不足时填 `unknown`。
- **`requirement_level`（需求层次）**：取值为 `source`（保留原始目标、用户原话与待定问题）或 `development`（具备可观察结果、范围边界与直接验收场景的可开发需求）。

分解与派生规则：
- 同层次目标拆分使用 `parent_requirement` 指向同层父 ID（在图中对应 `decomposes` 边），支持多层分解但编号本身不编码层级；上下级条目不是重复项，不得合并。
- 从一个或多个原始诉求提炼可开发需求时，新建 `development` 条目并用 `derived_from` 数组指向来源需求（对应 `derives-from` 边），保留原 `source` 条目不被覆盖。若用户首次给出的诉求已具备完整验收条件与边界，可直接建为 `development` 并在 `source` 字段记录原始输入，无需机械补建同义 `source` 副本。
- 写入 `parent_requirement` 或 `derived_from` 前，必须读取目标文件核实：目标存在、无自引用、`parent_requirement` 两端同层、`derived_from` 指向 `source` 条目且无环路。发现冲突时保留草稿并如实报告。

## 查重与检索

落盘前先在需求目录中用 `rg` 检索标题、领域关键词、期望行为与来源（已配置 `requirement` 类型时可配合 `artifact-graph query --from requirement:<id>`）：

- **无近似项**：新建条目并完整保留用户原话与背景。
- **命中近似项**：列出匹配依据，按用户裁决决定复用、建立父子/派生关联，或执行合并（合并时保留两侧原条目及来源，在被合并条目的 `## 处置与承接` 填写有效的 `merged_into` 目标 ID、理由与日期，严禁删除来源文件）。
- **只读汇总与查询**：同时展示 `status`、`disposition`、`satisfaction`（或 `coverage`）、`demand_kind`、`requirement_level`、父需求与来源需求；存量旧条目缺失可选字段时按 `unknown` 呈现，不判为损坏。

## 双维需求状态与交付事实校验

需求条目将**生命周期交付状态**与**业务处置安排 / 目标满足程度**分开记录，互不换算：

- **交付状态 `status`**：`captured`、`proposed`、`approved`、`implemented`、`verified`、`released`。存量补档可直接登记已有真实证据支撑的状态，无需编造线性中间历史。
- **业务处置 `disposition`**：`retained`（保留跟进）、`deferred`（暂缓延期，须写明重评条件）、`merged`（已合并，必填非自身的 `merged_into`）、`abandoned`（放弃不做，保留原始来源）、`unknown`。
- **目标满足程度 `satisfaction`（同义兼容字段 `coverage`）**：`unknown`、`not_met`、`partly_met`、`met`。

修改状态或双维字段前，先运行校验脚本（支持单文件检查或 `--summary <目录>` 批量汇总双维矩阵）：

```bash
node <plugin-root>/scripts/requirement-state-check.mjs <entry-path> \
  --from <current> --to <next> --evidence <path-or-ref> \
  --disposition <disposition> --satisfaction <level>
```

脚本会机械拦截允许词表越界及语义矛盾（如 `merged` 未填 `merged_into`、`abandoned` 同时宣称 `met` 或 `verified`/`released`、已 `verified`/`released` 却标为 `not_met` 等）；返回 `BLOCKED` 时必须保留原状态。注意：脚本只校验字段自洽与引用非空，调用技能仍须亲自读取证据核实业务事实：
- `approved`：用户或项目权威批准记录；
- `implemented`：真实实现或交付结果（源码文件、`implements` 边或锁记录仅算追溯声明）；
- `verified`：测试实际运行结果或独立验收记录（子项通过不能自动推导父需求或来源需求整体 `verified`）；
- `released`：发布工具结果与精确版本号。

## 默认测试交接

<!-- @feature ACA27 @scenario S-151 -->
<!-- @feature ACA29 @scenario S-160 @scenario S-161 -->

仅收集、查询或登记需求处置时，不强制触发测试规划。当选定需求准备进入本轮迭代并确定验证范围时，先按 `<plugin-root>/skills/spec-author/references/default-testing.md` 的共享方法调用默认测试规划入口生成测试计划，并将测试计划连同原始需求一并交接给 `spec-author`；规划阶段不索要尚未发生的测试运行结果。

## 从需求进入增量 SPEC

将选定需求转为正式迭代规格前，先按 `<plugin-root>/skills/artifact-review/references/method-selection.md` 查询 `artifact / spec / author`（`spec-author` 为默认入口，项目显式覆盖时尊重项目选择；解析失败时保留需求与缺口诊断，不强行生成 SPEC）。

选定作者后遵循正式规格合同：只有受影响项目的必要前置正文、图关系与适用专业评审全部完成后，才生成 SPEC（默认起点模板为 `templates/core/spec-entry.starter.md`，默认目录 `artifacts/specs/`，在需求条目记录 `carried_into`）。ADR 用于记录方案取舍，不替代需求条目。

SPEC 中每项变更均须声明 `add`、`modify` 或 `delete`，并在实施后逐项核收：
1. 逐字对照已冻结的 `target`、范围边界与验收条件，执行对应的直接行为测试并获取真实结果（测试条件宽于冻结要求时，不得借“测试全绿”放宽或豁免未满足项）。
2. 三者全部满足时标为 `passed`，记录 `evidence` 与 `current_artifact_destination` 并回写当前制品（`delete` 须记录被移除行为的历史去向）；任一不符则标为 `failed` 或保持 `open`，写明“冻结要求、实际结果与差异”。
3. 未完成项保持 `open` 或通过 `carried_into` 显式移交下一批 SPEC；唯有全部变更项均为 `passed` 且具备证据与去向时，才可将 SPEC 的 `status` 从 `open` 改为 `done`（归档 SPEC 不会自动改写需求池状态）。

## 六类典型研发旅程与跨项目交接

按实际诉求走最小必要路径，避免把局部修复膨胀为全仓补档：
- **探索盘点**：只读梳理现有能力、证据缺口与未知项，新点子另存需求条目。
- **存量补档**：从既有代码与行为补建当前制品，如实标注仍为 `unknown` 的验证事实。
- **初建基线**：路由 `artifact-chain-bootstrap` 按项目形态裁剪最小制品链。
- **常规增量**：从已批准需求建立 SPEC，逐项实现、验收并回写当前制品。
- **缺陷修复或保行为重构**：复用既有需求与验收基线，仅补本次所需的最小 SPEC/ADR 与回归证据。
- **大型迁移分批**：按依赖拆成多份 SPEC，每批清晰记录未完成项与下一批承接位置。

涉及**跨项目交接**时，仍在本项目保留需求条目，在 frontmatter 填写 `external: true`、`target_project`、`target_ref`、`target_version`（无法锁定时写 `未固定`）及 `acceptance_status`；外部离线或尚未接收时记为 `unknown`，不越界直接改写外部仓库，且本地引用仍须通过本仓图校验。

涉及**高阶规划仓拆分派发与子项目互锁**时：高阶规划仓通过 `artifacts/portfolio-allocations.json` 登记拆分去向，子项目通过 `artifacts/upstream-bindings.json` 登记对称回指；每条高阶诉求的满足概况由 `artifact-graph alignment-audit` 根据下游真实 `implements` / `verifies` 锁或只读验证收据机器派生 `computedSatisfaction`（严禁人工覆写冒充已满足），两侧内容确认一致后通过 `artifact-graph alignment-lock` 同步刷新双方摘要。

## 与其他入口的协作及返回说明

- 现状盘点与任务分诊交由 `artifact-chain-where-am-i`；环境与依赖体检交由 `artifact-chain-setup` 或 `artifact-graph doctor`；图查询与影响面使用 `artifact-graph` 的 `query`、`context`、`packet`、`impact`、`coverage`、`validate`；规格编写与上游能力匹配交由 `spec-author`。
- **返回汇报结构**：明确列出本次新增或更新的需求/SPEC 文件路径、`demand_kind` 与 `requirement_level`、父需求与来源需求、查重结果、`status` + `disposition` + `satisfaction` 当前取值、未完成项的承接去向，以及 `approved` / `implemented` / `verified` / `released` 四类事实的权威证据或 `unknown`（严禁用“模板已创建”或“图校验通过”冒充行为验收通过）。
