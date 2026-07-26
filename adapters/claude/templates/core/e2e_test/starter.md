---
id: {E2E_TEST_ID}
title: {标题}
status: draft
related_features: []
related_scenarios: []
---

# {E2E_TEST_ID}: {标题}

<!-- 本模板是插件 starter 指导，项目本地模板可完全覆盖 -->

## 测试目标

{描述这个端到端测试要验证的完整用户流程}

## 测试场景

### 主场景：{场景名称}

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

### 备选场景：{场景名称}

{同上结构}

## 测试数据

{描述测试所需的数据准备}

## 环境要求

{列出测试环境的特殊要求}

## 自动化脚本

{如果适用，关联自动化测试脚本路径}

```typescript
// 示例：Playwright E2E 测试
import { test, expect } from '@playwright/test';

test('{测试名称}', async ({ page }) => {
  await page.goto('{URL}');
  await page.click('{选择器}');
  await expect(page.locator('{选择器}')).toHaveText('{预期文本}');
});
```

## 关联制品

- 功能特性：{related_features}
- 场景：{related_scenarios}

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| {YYYY-MM-DD} | 初始草稿 | {作者} |
