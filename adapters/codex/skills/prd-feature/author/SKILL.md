---
name: prd-feature-author
description: Use when a user wants to write or draft a new PRD feature artifact for an artifact-graph project.
---

# prd-feature author

## 目的

从零编写 PRD 功能特性制品。遵循 inspect → compose → validate → review 的完整闭环流程，确保产出的制品达到终态。

## 流程

### 1. inspect（参见 references/inspect.md）

- 读取 `artifact-graph.config.yaml` 确认项目配置、制品类型注册和路径
- 从配置中派生已有制品扫描路径，确认 ID 空间
- 检查关联的场景、设计和决策制品是否存在
- 运行 `artifact-graph query` 查找相关制品关系

### 2. compose（参见 references/compose.md）

基于 inspect 识别出的项目模板和同类制品编写 PRD。字段、状态、章节和文件位置必须来自项目规则；仅在项目没有明示结构时，补充业务目标、可测试验收标准、约束和关联制品等通用内容。

### 3. validate（参见 references/validate.md）

- 运行 `artifact-graph validate --root . --warning-only` 确认无新增制品链警告
- 检查 ID 唯一性和 pattern 匹配
- 检查 frontmatter 必填字段完整性
- 检查关联制品 ID 是否在图中可达

### 4. review（闭环终态）

- 将 compose 产出的制品传入 `prd-feature-review` 流程
- 若 review verdict 为 `fail`：进入 repair → re-review 循环，直至 verdict 为 `pass`/`warning`/`BLOCKED`/`NEEDS_INPUT`
- 若 review verdict 为 `pass` 或 `warning`：直接输出终态

## 输出契约

author 输出必须可被 review 消费：

```yaml
artifact:
  id: <项目规则派生的 ID>
  path: <制品文件路径>
  status: <项目规则定义的状态，如有>
validation:
  issues: [<validate 输出的警告列表>]
  pass: true | false
related:
  artifacts: [<关联制品类型、ID 及存在状态>]
```

## 质量要求

- 验收标准必须可测试、可验证
- 关键验收标准应与项目已注册的相关制品或验证证据建立追溯
- 未决事项按项目模板约定显式标注，不擅自发明状态值
- 不得泄漏项目私有实现细节和绝对路径
