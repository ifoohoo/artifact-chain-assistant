---
name: scenario-script-repair
description: Use when a user wants to fix issues found in a scenario-script artifact after a review.
---

# scenario-script repair

## 目的

基于 review 的 findings 修复场景剧本制品。修复后必须执行 re-review 确认终态，不跳过终态验证。

## 流程

### 1. 读取 review 结果

从 review 输出中提取：
- `verdict` 和 `findings` 列表
- `repair_entry` 中的 `applicable_findings`
- 每个 finding 的 `location`、`message` 和 `suggested_fix`

### 2. 按维度执行修复

#### 结构修复（SS-F-001 至 SS-F-003）
- 按项目配置、模板和同类制品补充或修正结构
- 修正 ID 使其匹配项目 idPatterns 中的对应 pattern
- 修正 status 为项目定义的合法枚举值

#### 场景质量修复（SS-F-004 至 SS-F-008）
- 补充缺失的角色与目标描述
- 补充前置条件
- 为无编号的主路径步骤添加编号，替换模糊词为可测试描述
- 补充异常路径覆盖
- 替换可观察结果中的模糊词为可验证条件

#### 制品链修复（SS-F-009 至 SS-F-010）
- 移除不可达的关联制品引用，或创建缺失的制品
- 修复 validate 报告的具体警告

#### 追溯修复（SS-F-011）
- 建立或修复与需求/功能特性制品的追溯关联

### 3. 修复后验证

- 运行 `artifact-graph validate --root . --warning-only` 确认修复未引入新问题
- 检查修复后的制品 ID 唯一性和 pattern 匹配
- 检查 frontmatter 完整性

### 4. re-review（终态确认）

修复完成后，必须重新运行 review 流程：

1. 将修复后的制品传入 `scenario-script-review`
2. 确认原 findings 已被修复
3. 确认未引入新的 findings
4. 产出终态 verdict

终态 verdict 必须为 `pass`、`warning`、`BLOCKED` 或 `NEEDS_INPUT`。若 re-review 仍为 `fail`，继续修复；无法安全修复时转为 `BLOCKED`/`NEEDS_INPUT` 并报告原因。

## 输出契约

```yaml
repair_summary:
  target_artifact: <制品 ID>
  target_file: <制品文件路径>
  fixes_applied:
    - finding_id: <finding ID>
      action: <执行的修复动作描述>
      result: fixed | skipped
  fixes_skipped:
    - finding_id: <finding ID>
      reason: <跳过原因>
re_review:
  verdict: pass | warning | BLOCKED | NEEDS_INPUT
  remaining_findings: [<未修复的 finding 列表>]
  new_findings: [<修复引入的新 finding 列表>]
```

## 修复边界

- **可自动修复**：项目规则明确且不改变业务语义的结构、格式和表述问题
- **需人工决策**：场景质量内容补充（角色目标、异常路径覆盖）、关联制品是否应创建、status 变更
- **不自动修改**：代码文件、需求制品、设计文档

## 质量要求

- 每个修复动作必须记录在 `fixes_applied` 或 `fixes_skipped` 中
- 修复不得改变场景的业务语义，只修正结构和格式问题
- re-review 必须运行实际的 validate 命令，不靠叙述确认
- 不得泄漏项目私有实现细节和绝对路径
