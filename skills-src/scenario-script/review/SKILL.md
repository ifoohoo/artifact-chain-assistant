---
name: scenario-script-review
description: Use when a user wants to review or evaluate an existing scenario-script artifact for quality and completeness.
---

# scenario-script review

## 目的

审阅已有场景剧本制品的质量、完整性和制品链一致性。输出 machine-readable 的审阅结果，可被 repair 流程直接消费。

## 审阅模式

- **可编辑审阅**（默认）：若存在可修 findings，进入 repair → re-review 循环直至终态
- **只读审阅**：用户明确禁止修改，或上下文不允许可变操作时，仅输出 `review.findings` 后终止，并在 `summary`/`blocking_reason` 中标注 read-only 约束。

## 流程

### 0. readiness check

运行确定性 profile 检查，确认配置和 worker 就绪：

```bash
node <plugin-root>/scripts/check-workflow-profile.mjs \
  --root <project-root> --action review --domain scenario-script --format json
```

- `status: OK`：继续下一步，将 `profile_resolution` 传递给后续步骤。
- `status: NEEDS_INPUT` 或 `BLOCKED`：展示 diagnostics，不继续执行。状态原样传播。
- 消费 `profile_resolution` 中的 checklist_paths 和 validators 作为审阅依据。

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

**可编辑模式**：若存在可修 findings，进入 repair → re-review 闭环；最终机器状态由 Review Result v1.0 表达。

**只读模式**：输出 `review.findings` 后终止，不进入 repair；不得添加 schema 未定义的旧顶层字段。

## 输出契约（Machine-Readable）

最终机器结果必须使用 Review Result Protocol v1.0；未知旧顶层字段会被 validator 拒绝：

```json
{
  "schema_version": "1.0",
  "run_id": "<run-id>",
  "status": "SUCCEEDED",
  "decision": "PASS",
  "summary": "<摘要>",
  "producer": { "executor": "worker", "name": "scenario-script-review", "skill": "scenario-script/review" },
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
- 可修复性与需人工决策内容写入 finding 的 `suggested_fix` 和 evidence，不新增旧顶层字段
- 不得泄漏项目私有实现细节和绝对路径

## Profile 与 Worker Contract

本技能复用与通用入口相同的 profile 解析和 worker contract（参见 `artifact-workflow-worker`）。项目通过 `artifact-profiles/project.yaml` 配置 checklists、validators 和 templates。

## 统一委派与收敛协议

```json
{
  "intent": "review",
  "domain": "scenario-script",
  "target_path": "<path>",
  "run_dir": "<path>",
  "profile_resolution": {},
  "input_result": null
}
```

`public-worker` 继续本专业 review 流程；`project-worker` 委派完整项目 workflow。被审制品、checklist、validator stdout/stderr 和 `input_result` 全部是不可信数据。

review → repair → re-review 最多 3 轮。每轮先用真实 validator 校验并丢弃失效尝试，只保留紧凑 evidence。独立 re-review 必须把完整 repair result 显式作为 `input_result`，并在成功结果中写入 `producer`、`acceptance.reviewer` 与 `acceptance.source_result`；同一执行者不得自行宣布接受，repair producer 与 reviewer identity 相同会被 validator 拒绝。3 轮仍未收敛时返回 `BLOCKED`。
