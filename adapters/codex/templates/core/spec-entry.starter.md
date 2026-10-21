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

写清相对基线的行为变更、保留要求、关键实现决定、允许与禁止范围，以及变更项和验收条件的对应关系。关键方案指向已评审设计的具体位置。执行计划单独引用，不把完整任务进度复制到本文。项目已有实际模板时以项目模板为准；本默认模板仍保留下面五个生命周期章节和全部合同标记：`changes`、`scope`、`acceptance`、`acceptance-record`、`archive-record`。

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
## 允许写入范围

- <path>

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
