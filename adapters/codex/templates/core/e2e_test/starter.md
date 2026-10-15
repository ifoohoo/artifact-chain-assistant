---
id: {E2E_TEST_ID}
title: {标题}
status: draft
test_batch: {TEST_BATCH}
related_features: []
related_scenarios: []
scope: {FEATURE_ID}
ac_coverage: {}
---

# {E2E_TEST_ID}: {标题}

<!-- 本模板是插件 starter 指导，项目本地模板可完全覆盖 -->
<!-- 用例标题必须是 `## TC-nnn:` 或 `### TC-nnn:`，内核按该标题解析节点；`主场景` 标题不会生成 TC 节点。 -->

## 测试目标

{描述这个端到端测试要验证的完整用户流程}

## TC-001: {主场景名称}

**前置条件**：
- {条件 1}
- {条件 2}

**测试步骤**：
1. {步骤 1}
2. {步骤 2}
3. {步骤 3}

**预期结果**：
- {结果 1}
- {结果 2}

**后置清理**：
- {清理 1}

**覆盖场景**： {SCENARIO_ID}
**覆盖功能**： {FEATURE_ID}(AC1)
**优先级**： P0

## TC-002: {备选场景名称}

**前置条件**：
- {条件 1}

**测试步骤**：
1. {步骤 1}

**预期结果**：
- {结果 1}

**后置清理**：
- {清理 1}

**覆盖场景**： {SCENARIO_ID}
**覆盖功能**： {FEATURE_ID}(AC1)
**优先级**： P1

## 测试数据

{描述测试所需的数据准备}

## 环境要求

{列出测试环境的特殊要求}

## 关联制品

- 功能特性：{related_features}
- 场景：{related_scenarios}
