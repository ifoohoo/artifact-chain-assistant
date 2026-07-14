---
name: scenario-script-author
description: Use when a user wants to write or draft a new scenario-script artifact for an artifact-graph project.
---

# scenario-script author

## 目的

从零编写场景剧本制品。遵循 inspect → compose → validate → review 的完整闭环流程，确保产出的制品达到终态。

## 流程

### 1. inspect（参见 references/inspect.md）

- 读取 `artifact-graph.config.yaml` 确认项目配置、制品类型注册和路径
- 从配置中派生已有制品扫描路径，确认 ID 空间和命名模式
- 读取目标项目的模板、artifacts/README、治理文档，派生场景剧本的字段、status 枚举和章节结构
- 检查关联的需求/功能特性制品是否存在

### 2. compose（参见 references/compose.md）

基于 inspect 结果编写场景剧本。frontmatter 和正文结构从项目模板和已有制品派生，不硬编码字段名或章节。

场景剧本应覆盖通用质量维度：
- 角色与目标
- 前置条件
- 主路径（正常流程步骤）
- 异常路径（边界与错误处理）
- 可观察结果（可验证的终态）
- 需求追溯（与需求/功能特性的关联）

### 3. validate（参见 references/validate.md）

- 运行 `artifact-graph validate --root . --warning-only` 确认无新增制品链警告
- 检查 ID 唯一性和 pattern 匹配（从项目 idPatterns 派生）
- 检查 frontmatter 必填字段完整性（从项目模板派生）
- 检查关联制品 ID 是否在图中可达
- 检查场景剧本覆盖通用质量维度

### 4. review（闭环终态）

- 将 compose 产出的制品传入 `scenario-script-review` 流程
- 若 review verdict 为 `fail`：进入 repair → re-review 循环，直至 verdict 为 `pass`/`warning`/`BLOCKED`/`NEEDS_INPUT`
- 若 review verdict 为 `pass` 或 `warning`：直接输出终态

## 输出契约

author 输出必须可被 review 消费：

```yaml
artifact:
  id: <制品 ID>
  path: <制品文件路径>
  status: <项目派生的 status>
validation:
  issues: [<validate 输出的警告列表>]
  pass: true | false
related:
  artifacts: [<关联制品类型、ID 及存在状态>]
quality_dimensions:
  role_and_goals: present | missing
  preconditions: present | missing
  main_path: present | missing
  exception_paths: present | missing
  observable_results: present | missing
  traceability: present | missing
```

## 质量要求

- 场景步骤必须可执行、可验证
- 主路径和异常路径必须覆盖关键业务分支
- 按项目规则建立必要的需求或其他上游制品追溯；项目未要求时不擅自增加关联
- 前置条件必须明确列出依赖和假设
- 可观察结果必须是可验证的，不使用模糊词
- 所有项目专属字段和结构从目标项目派生，不硬编码
- 不得泄漏项目私有实现细节和绝对路径
