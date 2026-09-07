---
name: artifact-chain-requirements
description: 收集、查询和更新 artifact-chain 项目的需求条目，并把已选需求承接到增量 SPEC。适用于保存一个或多个尚未细化的想法、查重、合并/延期/拒绝、跨项目交接、创建迭代规格，以及逐项验收 add/modify/delete 后回写当前制品。需求收集和只读查询不依赖 artifact-graph 配置或 Method Registry。
---

# artifact-chain-requirements

## 目标

把用户原始诉求保存在项目中，并维持“需求条目 → 当前制品 → 增量 SPEC → 验收证据”的可追溯关系。需求池保管诉求和处置结果，不复制执行计划、长任务状态或发布状态。

## 先确定项目根与权威位置

1. 从用户指定路径或 `git rev-parse --show-toplevel` 确定项目根，读取项目说明与现有 `artifact-graph.config.yaml`。
2. 先查项目是否已经约定需求目录和 ID 规则。有约定时沿用；没有约定时使用 `artifacts/requirements/<id>.md` 与 ID 模式 `^REQ-\d+$`，例如 `REQ-1`。分配前枚举目录中匹配该模式的 ID，选择最小未使用正整数；同一批多个想法按顺序各占一个 ID。以后登记 profile 时沿用这一模式，不改已有 ID。
3. 没有配置或配置尚未登记 `requirement` 类型时，仍可创建同一位置、同一 ID 的需求条目。在 `## 状态记录` 写明“尚未纳入图：项目未配置 requirement 类型”。以后配置扫描该文件即可，不迁移目录、不改 ID，也不创建 inbox。
4. 一次输入包含多个独立想法时，每个想法建立一个条目。不要把未选择的想法压进本轮 SPEC，也不要因换会话而丢弃。

创建条目时复制插件根下的 `templates/core/requirement-entry.starter.md`，替换全部占位符。新想法使用 `captured`；已经整理出清楚结果但尚未批准时使用 `proposed`。收集不等于批准。

## 区分诉求性质与需求层次

同一种 `requirement` 类型和 ID 规则承载原始诉求与可开发需求。用两个互不推导的维度说明条目：

- `demand_kind` 表示诉求性质，只能是 `business`、`it`、`mixed` 或 `unknown`。根据诉求内容和来源判断，不因项目所属行业或原话出现“业务”“IT”等字样猜测；缺少依据时记录 `unknown`，不编造指标。
- `requirement_level` 表示需求层次，只能是 `source` 或 `development`。`source` 保存原始目标、来源原话与不确定性；`development` 把目标整理为可开发、可直接验收的需求。业务/IT 与 source/development 是两条独立轴。

原始诉求也可以条目化并按目标或范围继续分解。每个可独立讨论的目标使用自己的 ID；同层子条目用 `parent_requirement` 指向同层父 ID。分解可以有多层，但编号不编码层次。上下级条目不是重复项，不得按查重结果合并。

从一个或多个原始诉求细化开发需求时，新建 `development` 条目，并用 `derived_from` 数组指向全部来源需求。保留原始条目，不用开发条目覆盖或改写来源。一个原始诉求可派生多个开发需求，一个开发需求也可承接多个来源。用户直接给出的内容已经具备可观察结果、范围和验收场景时，可以直接记录为 `development`，并在 `source` 字段保留原始输入；不要机械复制一个内容相同的 `source` 条目。

写入 `parent_requirement` 或 `derived_from` 前，读取实际目标条目并检查：引用存在、没有自引用、`parent_requirement` 两端同层、`derived_from` 的目标是来源需求，并且新增关系不会形成循环。发现问题时保留待写条目，报告具体冲突；不要靠新增通用验证器替代这次语义判断。

`development` 条目必须写出可观察结果、范围边界和直接验收场景。实现任务、负责人和执行进度继续放在项目既有执行计划中。项目优先级如需记录，应使用项目已有的独立字段；不能从分解层次推导紧急程度。

## 查重和查询

写入前先用 `rg` 搜索需求目录中的标题、领域词、期望结果和来源。相似度由当前 agent 结合语义判断，不另建索引系统。

- 没有相近条目：创建新条目，并保留原始来源与原话摘要。
- 找到相近条目：列出匹配依据，询问或依据用户已经给出的选择决定复用、关联或合并。
- 找到父子分解或来源派生关系：按 `parent_requirement` 或 `derived_from` 关联，保留各自层次与来源；这种关系不能作为重复项合并。
- 合并：保留两个原条目及各自来源，在被合并条目的 `## 处置与承接` 记录 `merged_into`、理由和日期。不得删除来源条目。
- 已登记 `requirement` 类型时，可补充运行 `artifact-graph query --from requirement:<id>`。目录检索始终可用，图查询失败不抹掉已保存条目。

查询结果应区分需求状态、处置和交付事实。`deferred`、`rejected`、`merged` 属于处置；`captured` 到 `released` 属于需求状态，二者不能互相换算。

查询需求时同时输出 `demand_kind`、`requirement_level`、同层父需求和来源需求。旧条目缺少可选字段时，把对应维度写成 `unknown`，不要判定条目无效。图已配置时，`decomposes` 表示 `parent_requirement` 关系，`derives-from` 表示 `derived_from` 关系；两者不能合并成普通“相关需求”。

## 更新需求状态或处置

用户澄清诉求时，可以修订 `## 期望的用户行为`、`## 直接验收场景` 和范围边界，但要保留原始来源，并在状态记录中写明修订日期与理由。处置或事实变化时更新目标条目的 frontmatter `status`、`## 处置与承接` 和 `## 状态记录`。没有用户决定或证据时不自动迁移状态。

状态词表为 `captured`、`proposed`、`approved`、`implemented`、`verified`、`released`。四类交付事实要分别判断；存量补档可以直接登记已有实际证据支持的事实，不得为满足线性顺序编造中间历史。先运行：

```bash
node <plugin-root>/scripts/requirement-state-check.mjs <entry-path> --from <current> --to <next> --evidence <path-or-ref>
```

该命令只检查字段、状态词和证据引用是否非空，不读取证据，也不判断引用是否证明目标事实。调用技能必须实际读取证据，核对适用对象、版本、动作和结果：`implemented` 需要实际执行或验收结果；源码文件、测试文件、`implements` 边或锁记录只算追溯声明；`verified` 需要测试运行结果或独立验收记录；`released` 需要发布结果和版本记录。检查返回 `BLOCKED` 时保留原状态。

合并、延期或拒绝不要求改变状态，但必须记录理由。延期还要记录重新评估条件；拒绝要保留原始来源；承接到 SPEC 时记录 `carried_into`。

## 从需求进入增量 SPEC

复制 `templates/core/spec-entry.starter.md` 到项目约定的迭代规格目录。没有约定时使用 `artifacts/specs/`。SPEC 必须引用需求条目以及受影响的 PRD、场景、设计和 ADR；ADR 记录方案取舍，不能代替需求条目。

每项变更都选择 `add`、`modify` 或 `delete`，并记录目标制品、验收条件、状态、证据和当前制品去向。实施后逐项处理：

1. 先逐字核对该项已经冻结的 `target`、范围边界和验收条件，再运行对应的行为测试或验收动作，取得真实结果。
2. 同时判断实现结果是否满足 `target`、范围边界和验收条件。测试通过只证明测试实际覆盖的行为；测试条件比冻结要求宽时，不能据此放宽、忽略或自行豁免未满足的要求。
3. 只有三者均满足时才把该项标为 `passed`，并更新 `evidence` 和 `current_artifact_destination`。任何一项有差异时标为 `failed` 或保持 `open`，记录“冻结要求、实际结果、差异”，等待修复；只有用户明确修订要求或批准豁免后，才能按新结论重新验收。
4. 已完成项回写对应当前制品；`delete` 要记录被移除行为的历史去向。
5. 未完成项保持 `open`，或明确写入 `carried_into` 指向后续 SPEC。不得因其他项完成而整体归档。
6. 只有全部变更项均为 `passed`、已满足各自冻结要求、具有证据和去向时，SPEC 才能把 frontmatter `status` 从 `open` 改为 `done` 并记录归档位置。存在 `open` 或 `failed` 项时保持 `open`。归档 SPEC 不自动修改需求状态。

## 六类旅程

根据用户目标走最小动作，避免把小修复扩大成整套补档：

- **探索**：只读盘点已有能力、证据缺口和未知项；新想法另存需求条目。出口是可引用的盘点结果和需求 ID。
- **存量项目补档**：从现有行为和代码恢复缺失的当前制品，明确哪些事实仍未知。出口是补齐的制品及其来源，不宣称代码已经通过验证。
- **初建基线**：交给 `artifact-chain-bootstrap` 按真实项目形态裁剪配置、模板和方法。出口是通过检查的最小制品链。
- **常规增量**：从已批准需求建立 SPEC，逐项实现、验收并回写当前制品。出口是每项变更的证据和去向。
- **缺陷修复或保持行为的重构**：复用既有需求和验收基线，只补本次修复所需的 SPEC/ADR/证据。小修复不要求补齐整个项目的文档。
- **大型迁移**：按依赖拆成多个 SPEC；每批保留未完成项和下一批承接位置。出口是可继续执行的批次边界，而不是提前完成的总状态。

续接已有任务时，先找 `open` SPEC 和需求条目的 `carried_into`。并行只是一种执行方式，进度继续由项目现有 execution plan 或长任务工具保管。

## 跨项目交接

交接仍是本项目需求条目。在 frontmatter 增加 `external: true`、`target_project`、`target_ref`、`target_version` 和 `acceptance_status`；版本无法固定时明确写“未固定”。离线、目标不存在证据或尚未被接收时输出 `unknown`，不自动修改外部项目。交接条目对本地场景、设计等引用仍须接受本地图校验。

## 四类交付事实

盘点或更新条目时分别报告：

- `approved`：用户或项目权威批准记录；
- `implemented`：实际实现或交付结果；
- `verified`：测试运行或独立验收结果；
- `released`：发布工具结果与精确版本。

每类都给出来源、适用对象或版本和结论。缺少该类证据时写 `unknown`。图边、追溯注释、测试文件、锁记录或发布输入清单只能作为声明证据，不能单独证明实现、验证或发布成功。

子需求或开发需求的实现、测试和发布证据只适用于该条目。父需求、来源需求和原始目标必须分别核对其整体范围；子项通过不能自动把父项或来源项改为 `verified`，也不能自动推导为 `released`。

## 与其他入口的边界

- 盘点与具体任务定位交给 `artifact-chain-where-am-i`；盘点、查询和需求收集不依赖 Method Registry。
- 环境诊断交给 `artifact-chain-setup` 或 `artifact-graph doctor`。
- 图关系、影响范围与覆盖边界使用 artifact-graph 的 `query`、`context`、`packet`、`impact`、`coverage` 和 `validate`。
- 只有确定要调用专业制作、审阅或修复服务时，才检查 Registry、binding 和 worker 是否可执行。

## 输出

报告实际创建或更新的需求/SPEC 路径、诉求性质、需求层次、父需求、来源需求、保留的原始来源、查重或处置结论、每个未完成项的承接位置，以及四类交付事实的证据或 `unknown`。不得用“模板已生成”“图检查通过”代替行为验收。
