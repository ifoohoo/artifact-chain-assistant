---
id: <requirement-id>
title: <short-title>
status: captured
date: <YYYY-MM-DD>
source: <user-message-or-authoritative-reference>
demand_kind: unknown
requirement_level: source
# 同层父需求存在时取消注释；编号本身不编码层次。
# parent_requirement: <same-level-parent-requirement-id>
# 开发需求由已登记的来源需求细化时取消注释；允许多对多。
# derived_from: [<source-requirement-id>]
related_features: []
related_scenarios: []
related_design_docs: []
related_decisions: []
related_requirements: []
evidence: []
# 跨项目交接条目取消下列注释并填值；普通条目不添加这些字段。
# external: true
# target_project: <project-or-repository>
# target_ref: <artifact-or-contract-id>
# target_version: <exact-version-commit-or-未固定>
# acceptance_status: unknown
---

# <requirement-id> <short-title>

## 来源与背景

<保留用户提出的问题、场景和不确定性。>

## 期望的用户行为

<说明使用者希望看到的结果，不提前指定实现方案。>

## 直接验收场景

- <可观察的用户行为或结果>

## 范围边界

- 范围内：<本条需求覆盖的边界>
- 范围外：<本条需求暂不覆盖的边界>

## 处置与承接

- disposition: retained
- reason: <保留或处置理由>
- carried_into: none
- merged_into: none

跨项目交接时，把目标项目、目标引用、精确版本和接收状态写入 frontmatter 中已预留的可解析字段。普通条目不添加这些字段。

## 状态记录

- <YYYY-MM-DD> captured：<来源与当前判断>。
- 尚未纳入图：<项目未配置 requirement 类型；已登记时删除本行>。
