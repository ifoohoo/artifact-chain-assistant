---
name: artifact-repair
description: Use when repairing open findings for non-PRD, non-scenario artifacts after a Review Result exists and a project repair worker must be resolved first.
argument-hint: "<domain> <target-path> --review-result <path> [--run-dir <path>]"
---

# artifact-repair — 通用制品修复

## 目的

跨项目通用的制品修复编排入口。根据审阅结果（Review Result Protocol v1.0）自动修复制品中的 open findings。

本技能是**路由层**，不直接执行领域修复。领域修复逻辑由项目 profile 或类型专用 worker 技能提供。

## 使用

```
/artifact-repair <domain> <target-path> --review-result <path> [--run-dir <path>]
```

先运行只读检查：

```bash
node <plugin-root>/scripts/check-workflow-profile.mjs \
  --root <project-root> --action repair --domain <domain> --format json
```

返回 `NEEDS_INPUT` 时停止；不得修改文件或生成成功结果。默认约定 worker 为项目技能 `artifact-review-repair`，也可由 `.artifact-review.json` 的 `workers.repair.<domain>` 显式覆盖。

| 参数 | 说明 |
|------|------|
| domain | 制品类型（同 artifact-review） |
| target-path | 待修复制品文件或目录 |
| --review-result | 审阅结果 JSON 文件路径（Review Result Protocol v1.0） |
| --run-dir | 修复结果输出目录 |

## 修复流程

1. **读取审阅结果**：解析 review-result.json，提取所有 open findings（不限 severity）。
2. **分类 findings**：按 severity 优先级（block > warn > info）和 category 分组。
3. **委派修复**：将每组 findings 委派给对应的 repair worker。
4. **验证修复**：修复后重新运行确定性校验。
5. **输出结果**：生成 repair result（Review Result Protocol v1.0 repair 段）。

## 结果结构

```json
{
  "schema_version": "1.0",
  "run_id": "...",
  "status": "SUCCEEDED",
  "decision": "PASS",
  "summary": "...",
  "repair": {
    "source_review_run_id": "...",
    "source_review_stage_id": "...",
    "findings_addressed": [...],
    "files_modified": [...],
    "validation_after_repair": {
      "command": "artifact-graph validate",
      "exit_code": 0,
      "findings_remaining": 0
    }
  }
}
```

## 约束

- 修复全部 open findings（按 severity 优先级：block > warn > info）。
- 不能修复的 finding 必须保留为 open 并影响最终 decision。
- 修复后必须重新验证（re-review 闭环）。
- 不修改未被 findings 标记的文件。
- 修复结果遵循 Review Result Protocol v1.0。

## 故障诊断

- checker 退出 `2`：补齐 project config/profile/worker 后重试。
- Review Result 校验失败：先运行 `artifact-graph validate-review-result --file <path>`，按 JSON path 修复输入。
- re-review 仍有 open finding：保留 finding，并使用 `FAIL` 或 `PASS_WITH_RESIDUAL_MINOR`，不得伪造 `PASS`。
