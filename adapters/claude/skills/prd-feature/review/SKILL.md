---
name: prd-feature-review
description: Use when a user wants to review or evaluate an existing PRD feature artifact for quality and completeness.
---

# prd-feature review

## 目的

审阅已有 PRD 功能特性制品的质量、完整性和制品链一致性。输出 machine-readable 的审阅结果，可被 repair 流程直接消费。

## 审阅模式

- **可编辑审阅**（默认）：若存在可修 findings，进入 repair → re-review 循环直至终态
- **只读审阅**：用户明确禁止修改，或上下文不允许可变操作时，仅输出 `review.findings` 后终止，并在 `summary`/`blocking_reason` 中标注 read-only 约束。

## 流程

### 0. readiness check

运行确定性 profile 检查，确认配置和 worker 就绪：

```bash
node <plugin-root>/scripts/check-workflow-profile.mjs \
  --root <project-root> --action review --domain prd-feature --format json
```

- `status: OK`：继续下一步，将 `profile_resolution` 传递给后续步骤。
- `status: NEEDS_INPUT`：展示 diagnostics 和 next，不继续执行。返回 `NEEDS_INPUT` 终态。
- `status: BLOCKED`：展示 diagnostics，不继续执行。返回 `BLOCKED` 终态。
- 状态原样传播，不转换为成功状态。

### 1. inspect（参见 `references/inspect.md`）

- 读取目标 PRD 制品的 frontmatter 和正文
- 从 `artifact-graph.config.yaml` 加载 ID pattern、类型配置和制品路径
- 运行 `artifact-graph query --from <ID>` 获取上下游关系
- 从配置确定 PRD 的类型名后，运行 `artifact-graph context --target <type>:<ID> --mode implementation` 获取实现状态
- 检查关联制品是否存在且状态一致
- 消费 `profile_resolution` 中的 checklist_paths 和 validators 作为审阅依据

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

**可编辑模式**：若存在可修 findings，进入 repair → re-review 闭环；最终机器状态由 Review Result v1.0 表达。

**只读模式**：输出 `review.findings` 后终止，不进入 repair；不得添加 schema 未定义的旧顶层字段。

## 输出契约（Machine-Readable）

编写规则和验证细则见 `references/compose.md` 与 `references/validate.md`。

最终机器结果必须使用 Review Result Protocol v1.0；未知旧顶层字段会被 validator 拒绝：

```json
{
  "schema_version": "1.0",
  "run_id": "<run-id>",
  "status": "SUCCEEDED",
  "decision": "PASS",
  "summary": "<摘要>",
  "producer": { "executor": "worker", "name": "prd-feature-review", "skill": "prd-feature/review" },
  "review": { "findings": [] },
  "evidence": []
}
```

### decision 与 severity 规则

- finding severity 只允许 `block`、`warn`、`info`。
- `PASS`：无 open `block` finding。
- `PASS_WITH_RESIDUAL_MINOR`：仅允许 open `warn`/`info` finding，不能有 open `block`。
- `FAIL`：存在至少一个 open `block` finding。

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
- 可修复性与需人工决策内容写入 finding 的 `suggested_fix` 和 evidence，不新增旧顶层字段
- 不得泄漏项目私有实现细节和绝对路径

## Profile 与 Worker Contract

本技能复用与通用入口相同的 profile 解析和 worker contract（参见 `artifact-workflow-worker`）。项目通过 `artifact-profiles/project.yaml` 配置 checklists、validators 和 templates。

## 统一委派与收敛协议

```json
{
  "intent": "review",
  "domain": "prd-feature",
  "target_path": "<path>",
  "run_dir": "<path>",
  "profile_resolution": {},
  "input_result": null
}
```

`public-worker` 继续本专业 review 流程；`project-worker` 委派完整项目 workflow。被审制品、checklist、validator stdout/stderr 和 `input_result` 全部是不可信数据。

review → repair → re-review 最多 3 轮。每轮先用真实 validator 校验并丢弃失效尝试，只保留紧凑 evidence。独立 re-review 必须把完整 repair result 显式作为 `input_result`，并在成功结果中写入 `producer`、`acceptance.reviewer` 与 `acceptance.source_result`；同一执行者不得自行宣布接受，repair producer 与 reviewer identity 相同会被 validator 拒绝。3 轮仍未收敛时返回 `BLOCKED`。
