---
name: prd-feature-review
description: Use when a user wants to review or evaluate an existing PRD feature artifact for quality and completeness.
---

# prd-feature review

## 目的

审阅已有 PRD 功能特性制品的质量、完整性和制品链一致性。输出 machine-readable 的审阅结果，可被 repair 流程直接消费。

## 审阅模式

- **可编辑审阅**（默认）：若存在可修 findings，进入 repair → re-review 循环直至终态
- **只读审阅**：用户明确禁止修改，或上下文不允许可变操作时，仅输出 findings 与 repair_entry 后终止。此时 verdict 受用户约束，必须在输出中标注 `constraint: read-only`

## 流程

### 1. inspect（参见 references/inspect.md）

- 读取目标 PRD 制品的 frontmatter 和正文
- 从 `artifact-graph.config.yaml` 加载 ID pattern、类型配置和制品路径
- 运行 `artifact-graph query --from <ID>` 获取上下游关系
- 从配置确定 PRD 的类型名后，运行 `artifact-graph context --target <type>:<ID> --mode implementation` 获取实现状态
- 检查关联制品是否存在且状态一致

### 2. 审阅维度

按以下维度逐一检查：

#### 结构完整性
- frontmatter、ID、状态和正文结构符合项目配置、模板及同类制品约定
- 项目没有明示结构时，至少能够定位业务目标、可验证验收标准和关键约束

#### 验收标准质量
- 验收标准存在且非空
- 每条标准可测试（不使用模糊词如"足够""合理""尽快"）
- 每条标准有编号
- 未决事项按项目规则显式标注，且不与当前状态语义冲突

#### 制品链一致性
- 项目配置或模板声明的关联字段中的 ID 在图中可达
- 不存在孤立的关联引用（ID 存在但制品缺失）

#### 实现追溯
- `artifact-graph validate` 无新增警告
- 当项目规则要求进入实现阶段后建立追溯时，应存在相应实现证据

### 3. 输出审阅结果

**可编辑模式**：若存在可修 findings，自动进入 repair → re-review 循环，直至 verdict 为 `pass`/`warning`/`BLOCKED`/`NEEDS_INPUT`。

**只读模式**：输出 findings 和 repair_entry 后终止，不进入 repair。repair_entry 中标注 `constraint: read-only`。

## 输出契约（Machine-Readable）

review 输出必须为可机读的结构：

```yaml
verdict: pass | fail | warning
findings:
  - id: <finding_id>
    dimension: structure | acceptance_criteria | chain_consistency | traceability
    severity: error | warning | info
    location: <文件路径>:<行号或章节>
    description: <一句话描述问题>
    suggested_fix: <修复建议>
evidence:
  - type: artifact_query | validate | context | manual_inspection
    source: <命令或检查来源>
    result: <关键输出摘要>
repair_entry:
  target_artifact: <制品 ID>
  target_file: <制品文件路径>
  applicable_findings: [<可自动或半自动修复的 finding ID 列表>]
```

### verdict 规则

- `pass`：无 error 级别 findings
- `warning`：只有 warning/info 级别 findings
- `fail`：存在至少一个 error 级别 finding

### finding ID 命名

- `PRD-F-001`：不符合项目规定的 frontmatter 或结构
- `PRD-F-002`：ID 不匹配 pattern
- `PRD-F-003`：状态值不符合项目规则
- `PRD-F-004`：缺少验收标准
- `PRD-F-005`：验收标准含模糊词
- `PRD-F-006`：验收标准无编号
- `PRD-F-007`：未决事项与项目状态规则冲突
- `PRD-F-008`：关联制品不可达
- `PRD-F-009`：制品链 validate 警告
- `PRD-F-010`：项目要求的实现追溯缺失
- `PRD-F-*`：其他发现使用递增编号

## 质量要求

- 每个 finding 必须附带可定位的文件路径和行号/章节
- evidence 必须包含实际运行的命令和关键输出，不是叙述
- repair_entry 必须明确哪些 findings 可修复、哪些需要人工决策
- 不得泄漏项目私有实现细节和绝对路径
