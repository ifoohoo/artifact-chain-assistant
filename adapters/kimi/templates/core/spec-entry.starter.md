---
id: <spec-id>
title: <iteration-title>
status: open
date: <YYYY-MM-DD>
baseline: <current-artifact-version-or-ref>
related_features: []
related_requirements:
  - <requirement-id>
related_scenarios: []
related_design_docs: []
related_decisions: []
---

# <spec-id> <iteration-title>

## 来源索引与版本依据

索引所采用制品的身份、具体章节和本轮适用内容，并写明版本依据。完整正文仍由原制品维护。引用未提交正文时标明工作树基线与已核验的评审快照。`HEAD` 不是未提交正文的版本。不能只凭摘要声称可以恢复全文。

## 本轮增量

明确本轮变更相对于基线的产品行为差异，列出需保留的原有功能与约束条件，说明关键实现决策及其依据，并界定本次实现涉及的源文件、派生物及外部对象。所有变更项须与全部验收条件建立清晰对应关系，关键方案应指向已评审设计文档的具体位置。产品约束写入规格，当次执行选择与任务状态在独立计划中维护。执行计划单独引用，不在本文复制完整进度。

短小单职责规格保持单文件。若各领域混在一起，导致某个职责需读取大量无关内容，则应按完整业务能力与公共接口组织详细正文；根规格必须独立完整地说明本轮全部变更、共同边界及验收总览，不得仅以链接替代正文。详细条件应有唯一权威来源，优先引用已评审的制品，必要时可按完整语义拆分原文并修正引用，禁止维护摘录副本。仅根规格保存本轮的身份与生命周期信息。

需要分层交付时，应在本节引用公共计划，定位领域正文与公共合同，并明确各职责在何时完整读取哪些材料、何种条件触发补读。启动单与执行计划不要求初始加载全部附件，但安全、授权、兼容性与失败处理语义始终为必读内容。章节链接不等同于宿主具备局部读取能力；单文件限制或材料能力缺口（即缺少必要材料或宿主处理能力不足）应如实保留，不得将根文件标记检查通过视为附件或全文通过。项目已有实际模板时以项目模板为准；本默认模板仍保留 `changes`、`scope`、`acceptance`、`acceptance-record`、`archive-record` 五个生命周期章节及全部合同标记。

<!-- marker: changes -->
## 相对基线的变更

<说明本次相对基线要改变的用户行为，并写明保留要求。>

### <change-id> add

- reason: <change-reason>
- target: <artifact-or-behavior>

### <change-id> modify

- reason: <change-reason>
- target: <artifact-or-behavior>

### <change-id> delete

- reason: <change-reason>
- target: <artifact-or-behavior>

<!-- marker: scope -->
## 产品变更范围

- <product-source-or-derived-path-or-external-object>

<!-- marker: acceptance -->
## 验收条件

- <change-id>: <observable-condition-or-scenario>

<!-- marker: acceptance-record -->
## 验收记录

### <change-id>

- status: open
- evidence: []
- date: pending
- current_artifact_destination: pending
- carried_into: none

为其他变更项各保留一段验收记录。`status` 只能取 `passed`、`failed` 或 `open`。

<!-- marker: archive-record -->
## 归档记录

- ready_to_archive: false
- remaining_changes: [<change-id>]
- archive_location: pending

全部变更项均为 `passed`、具有证据并完成当前制品回写后，把 frontmatter `status` 从 `open` 改为 `done`，再记录归档位置。存在 `open` 或 `failed` 项时保持 `open`。
