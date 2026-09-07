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

## 相对基线的变更

<说明本次相对基线要改变的用户行为。>

### <change-id> add

- reason: <change-reason>
- target: <artifact-or-behavior>

### <change-id> modify

- reason: <change-reason>
- target: <artifact-or-behavior>

### <change-id> delete

- reason: <change-reason>
- target: <artifact-or-behavior>

## 允许写入范围

- <path>

## 验收条件

- <change-id>: <observable-condition-or-scenario>

## 验收记录

### <change-id>

- status: open
- evidence: []
- date: pending
- current_artifact_destination: pending
- carried_into: none

为其他变更项各保留一段验收记录。`status` 只能取 `passed`、`failed` 或 `open`。

## 归档记录

- ready_to_archive: false
- remaining_changes: [<change-id>]
- archive_location: pending

全部变更项均为 `passed`、具有证据并完成当前制品回写后，把 frontmatter `status` 从 `open` 改为 `done`，再记录归档位置。存在 `open` 或 `failed` 项时保持 `open`。
