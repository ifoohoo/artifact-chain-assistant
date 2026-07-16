---
name: artifact-review
description: Use when routing reviews for non-PRD, non-scenario artifact types and the target project must prove a profile or worker mapping before execution.
argument-hint: "<domain> <target-path> [--run-dir <path>] [--format json|markdown]"
---

# artifact-review — 通用制品审阅

## 目的

跨项目通用的制品审阅编排入口。按 domain（artifact type）路由到对应的审阅 worker，汇总结果为 Review Result Protocol v1.0 格式。

本技能是**路由层**，不直接执行领域审阅。领域审阅逻辑由项目 profile 或类型专用 worker 技能提供。

## 使用

```
/artifact-review <domain> <target-path> [--run-dir <path>] [--format json|markdown]
```

先运行只读检查：

```bash
node <plugin-root>/scripts/check-workflow-profile.mjs \
  --root <project-root> --action review --domain <domain> --format json
```

仅在返回 `status: OK` 且 `worker_path` 存在时委派。返回 `NEEDS_INPUT` 时展示 diagnostics 与 next，不创建审阅成功结果。

| 参数 | 说明 |
|------|------|
| domain | `design-spec`、`link`、`e2e`、`domain`、`contract`、`blueprint`、`verification` |
| target-path | 制品文件或目录 |
| --run-dir | 结果输出目录，默认 `runs/artifact-review-<timestamp>` |
| --format | 输出格式，默认 `markdown` |

## 路由规则

1. **检查项目 profile**：运行确定性 checker；可选 `.artifact-review.json` 使用 `workers.review.<domain>` 映射。
2. **类型匹配**：根据 domain 选择对应 worker 技能。
3. **委派执行**：将任务委派给 worker，传递 target path、run dir 和 profile 配置。
4. **结果汇总**：收集所有 worker 的 result.json，生成 run-level 汇总。

## Worker 委派格式

每个 worker 接收标准化 task：

```json
{
  "domain": "<domain>",
  "target_path": "<path>",
  "run_dir": "<path>",
  "batch_id": "<optional>",
  "profile": { ... }
}
```

Worker 输出必须遵循 Review Result Protocol v1.0（schema: `artifact-graph schemas/review-result.schema.json`）。

## 结果结构

```
<run-dir>/
├── input/
│   └── manifest.json          ← 输入清单
├── stages/
│   └── review-<domain>/
│       └── result.json        ← 阶段结果（Review Result Protocol v1.0）
├── final/
│   ├── result.json            ← 汇总结果（Review Result Protocol v1.0）
│   └── summary.md             ← 人类可读摘要
└── evidence/                  ← 验证证据
```

## 约束

- 本技能不做领域审阅，只做路由和汇总。
- 项目特定的审阅规则、维度和阈值由 profile 配置。
- 不硬编码项目路径、ID 格式或专有规则。
- 不修改制品源文件（repair 由 artifact-repair 负责）。
- 所有结果遵循 Review Result Protocol v1.0。

## 发现入口

默认入口显示：

```
/artifact-review --help          ← 显示用法和可用 domain 列表
/artifact-review <domain> <path> ← 执行审阅
```

故障诊断：checker 退出 `2` 表示 `NEEDS_INPUT`；补齐 config、JSON profile 或项目 worker 后重复运行。`prd-feature` 与 `scenario-script` 使用各自的专业技能族。

## 项目扩展

项目通过以下方式注入差异：

1. **Profile**：`.artifact-review.json` 定义 `workers.review.<domain>` 映射。
2. **Template**：审阅报告模板。
3. **Checklist**：审阅检查清单。
4. **Config**：`artifact-graph.config.yaml` 中的 artifact types 和 constraints。
