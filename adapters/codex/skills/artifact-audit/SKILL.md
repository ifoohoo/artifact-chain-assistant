---
name: artifact-audit
description: Use when checking artifact-chain health, traceability, version-lock freshness, capability coverage, or release readiness without modifying project files.
argument-hint: "<target> [--root <path>] [--format json|markdown]"
---

# artifact-audit — 制品类型能力审计

## 目的

跨项目通用的制品链健康检查和能力审计。检查制品链完整性、追溯覆盖率、版本锁定状态和发布就绪性。

## 使用

```
/artifact-audit health --root <path> [--format json|markdown]
/artifact-audit release-gate --root <path> [--format json|markdown]
/artifact-audit capability --root <path> [--format json|markdown]
```

先运行只读检查：

```bash
node <plugin-root>/scripts/check-workflow-profile.mjs \
  --root <project-root> --action audit --domain health --format json
```

返回 `NEEDS_INPUT` 时只报告缺失的项目标记；不得继续输出发布就绪结论。

| 子命令 | 说明 |
|--------|------|
| health | 制品链健康检查（validate + version-lock + 追溯覆盖率） |
| release-gate | 发布门检查（health + 测试 + 构建 + 安全规则） |
| capability | 能力审计（哪些 artifact type 有完整覆盖、哪些缺失） |

## 健康检查项

1. **validate**：运行 `artifact-graph validate --root <path> --warning-only`。
2. **version-lock**：运行 `artifact-graph version-lock audit --root <path> --strict-missing-lock`。
3. **追溯覆盖率**：统计有代码/测试追溯的 artifact 比例。
4. **孤立检测**：无消费者或无生产者的 artifact。

## 发布门检查项

1. health 检查全部通过。
2. 确定性校验 0 errors。
3. 版本锁定完整。
4. 项目安全规则由 profile 配置定义（不硬编码特定项目的安全策略）。

## 约束

- 所有检查都是确定性的（调用 artifact-graph CLI）。
- 不修改项目文件。
- 结果以 JSON 或 Markdown 输出。

## 故障诊断

- 缺 `artifact-graph.config.yaml` 与 `artifacts/`：返回 `NEEDS_INPUT`。
- CLI validate/version-lock 非零：保留原始命令、退出码与诊断，release-gate 返回失败。
- 项目专用安全门：由项目 profile 注入；本技能不推断或硬编码规则。
