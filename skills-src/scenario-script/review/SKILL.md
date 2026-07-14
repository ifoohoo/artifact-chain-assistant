---
name: scenario-script-review
description: Use when a user wants to review or evaluate an existing scenario-script artifact for quality and completeness.
---

# scenario-script review

## 目的

审阅已有场景剧本制品的质量、完整性和制品链一致性。输出 machine-readable 的审阅结果，可被 repair 流程直接消费。

## 审阅模式

- **可编辑审阅**（默认）：若存在可修 findings，进入 repair → re-review 循环直至终态
- **只读审阅**：用户明确禁止修改，或上下文不允许可变操作时，仅输出 findings 与 repair_entry 后终止。此时 verdict 受用户约束，必须在输出中标注 `constraint: read-only`

## 流程

### 1. inspect（参见 references/inspect.md）

- 读取目标场景剧本的 frontmatter 和正文
- 从 `artifact-graph.config.yaml` 加载 ID pattern、类型配置和制品路径
- 读取项目模板、artifacts/README 和治理文档，派生场景剧本的合法字段、status 枚举和章节结构
- 运行 `artifact-graph query --from <ID>` 获取上下游关系
- 检查关联制品是否存在且状态一致

### 2. 审阅维度

按以下维度逐一检查：

#### 结构完整性
- 项目模板规定的 frontmatter 必填字段
- ID 匹配项目 idPatterns 中对应的场景类型
- status 值在项目定义的合法枚举内
- 正文包含项目模板要求的必要章节

#### 场景质量
- 角色与目标：场景涉及的角色及其目标是否明确
- 前置条件：前置条件是否列出且非空
- 主路径：正常流程步骤是否编号且完整
- 异常路径：边界和错误处理是否覆盖关键分支
- 可观察结果：结果是否可验证（不使用"足够""合理""尽快"等模糊词）

#### 制品链一致性
- 关联需求/功能特性制品的 ID 在图中可达
- 关联设计文档、决策的 ID 在图中可达（若项目模板要求）
- 不存在孤立的关联引用（ID 存在但制品缺失）

#### 需求追溯
- `artifact-graph validate` 无新增警告
- 场景与需求/功能特性的追溯链完整

### 3. 输出审阅结果

**可编辑模式**：若存在可修 findings，自动进入 repair → re-review 循环，直至 verdict 为 `pass`/`warning`/`BLOCKED`/`NEEDS_INPUT`。

**只读模式**：输出 findings 和 repair_entry 后终止，不进入 repair。repair_entry 中标注 `constraint: read-only`。

## 输出契约（Machine-Readable）

review 输出必须为可机读的结构：

```yaml
verdict: pass | fail | warning
findings:
  - id: <finding_id>
    dimension: structure | scenario_quality | chain_consistency | traceability
    severity: error | warning | info
    location: <文件路径>:<行号或章节>
    message: <一句话描述问题>
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

- `SS-F-001`：不符合项目规定的 frontmatter 或结构
- `SS-F-002`：ID 不匹配 pattern
- `SS-F-003`：状态值不符合项目规则
- `SS-F-004`：缺少角色与目标
- `SS-F-005`：缺少前置条件
- `SS-F-006`：主路径步骤缺失或模糊
- `SS-F-007`：缺少异常路径
- `SS-F-008`：可观察结果缺失或含模糊词
- `SS-F-009`：关联制品不可达
- `SS-F-010`：制品链 validate 警告
- `SS-F-011`：需求追溯缺失
- `SS-F-*`：其他发现使用递增编号

## 质量要求

- 每个 finding 必须附带可定位的文件路径和行号/章节
- evidence 必须包含实际运行的命令和关键输出，不是叙述
- repair_entry 必须明确哪些 findings 可修复、哪些需要人工决策
- 不得泄漏项目私有实现细节和绝对路径
