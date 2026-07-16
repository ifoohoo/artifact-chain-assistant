---
name: artifact-batch
description: Use when a non-PRD, non-scenario artifact workflow needs deterministic file batching or Review Result aggregation across multiple worker results.
argument-hint: "<action> <domain> <target-path> [--batch-size N] [--max-concurrency N] [--run-dir <path>]"
---

# artifact-batch — 通用批处理编排

## 目的

跨项目通用的制品批处理编排。将大量制品按字符数或文件数切分为批次，并发执行审阅/修复/生成任务，汇总结果为 Review Result Protocol v1.0。

本技能替代旧版 `batch-orchestrator`，提供标准化的批次切分、并发控制和结果合并。

## 使用

```
/artifact-batch <action> <domain> <target-path> [--batch-size N] [--max-concurrency N] [--run-dir <path>]
```

| 参数 | 说明 |
|------|------|
| action | `review`、`repair`、`generate` |
| domain | 制品类型（同 artifact-review） |
| target-path | 制品目录 |
| --batch-size | 每批最大字符数，默认 40000 |
| --max-concurrency | 最大并发数，默认 3 |
| --run-dir | 结果输出目录 |

## 编排流程

1. **扫描目标**：收集 target-path 下所有匹配文件。
2. **批次切分**：按 batch-size 将文件分组。
3. **并发执行**：每波最多 max-concurrency 个 worker 并发。
4. **结果收集**：每个 worker 输出 result.json（Review Result Protocol v1.0）。
5. **汇总合并**：合并所有批次结果，生成 run-level 汇总。

## 确定性脚本

批次切分和结果合并由确定性脚本提供，支持 CLI 和 import 两种消费方式。

用 `node <plugin-root>/scripts/check-workflow-profile.mjs --root <project-root> --action batch --domain <domain>` 做只读环境检查。执行 review/repair worker 前仍分别运行对应 action 的 checker；任何 `NEEDS_INPUT` 都停止当前批次。

### batch-split.mjs

```bash
node scripts/batch-split.mjs <target-dir> [--batch-size N]
```

- 输出：JSON array to stdout，每项 `{ id, files, chars }`
- 默认 batch-size: 40000 字符
- 可 import: `import { batchSplit } from './scripts/batch-split.mjs'`

### batch-merge.mjs

```bash
node scripts/batch-merge.mjs <results-dir> [--run-id <id>]
```

- 输入：results-dir 下每个 `*.json` 是一个批次的 Review Result Protocol v1.0
- 输出：合并后的 Review Result Protocol v1.0 JSON to stdout
- 可 import: `import { batchMerge } from './scripts/batch-merge.mjs'`

## 批次切分规则

- 按文件字符数累计，超过 batch-size 时开始新批次。
- 单个文件超过 batch-size 时独占一个批次。
- 保持相关文件在同一批次（如同一 batch-*.md 的 part-1/part-2）。

## 结果合并

```json
{
  "schema_version": "1.0",
  "run_id": "...",
  "status": "SUCCEEDED",
  "decision": "PASS",
  "summary": "Batch completed: 21 batches, 83 files, 0 findings.",
  "review": {
    "batches": [
      { "id": "batch-001", "files": [...], "chars": 39207 },
      ...
    ],
    "metrics": {
      "batch_count": 21,
      "files_scanned": 83,
      "findings_count": 0,
      "block_count": 0,
      "warn_count": 0,
      "info_count": 0
    },
    "findings": []
  }
}
```

## 约束

- 批处理不修改制品源文件（action=review 时）。
- 并发 worker 之间无数据依赖。
- 结果合并是确定性的（按 batch_id 排序）。
- 所有结果遵循 Review Result Protocol v1.0。

## 故障诊断

- `No JSON files found`：确认 results-dir 包含批次 `*.json`。
- `Validation errors`：逐个运行 `artifact-graph validate-review-result --file`。
- 输出不稳定：固定输入目录后重复运行测试；文件与 stage/batch 排序必须稳定。
