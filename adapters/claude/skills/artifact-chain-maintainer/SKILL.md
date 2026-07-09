---
name: artifact-chain-maintainer
description: 维护 artifact-graph 项目的制品链版本锁、诊断、hook 安装和刷新流程。用于代码或制品变更后检查 traceability-version-lock 是否新鲜，执行 changed-only refresh，或安装 Git/助手 hook。
---

# artifact-chain-maintainer

<!-- @scenario S-02 @feature ACA2 -->
<!-- @scenario S-03 @feature ACA2 -->
<!-- @scenario S-04 @feature ACA4 -->
<!-- @scenario S-06 @feature ACA3 -->

## 目的

帮助项目在修改制品、代码追溯注释、测试追溯注释或验证文件后，保持 `artifacts/traceability-version-lock.json` 与当前实现关系一致。

## 必须遵守

- 不要自动运行 `version-lock bootstrap --force`。
- 优先运行 `artifact-graph version-lock refresh --changed-only --staged` 或项目要求的等价命令。
- Git hooks 是硬门禁；助手 hooks 只做提醒、检查和辅助。
- 项目本地的 `artifacts/**`、`artifact-graph.config.yaml` 和 lock 文件不进入插件。

## 推荐流程

1. 运行 `artifact-graph doctor --format json` 确认 CLI、Node、配置和 lock 路径。
2. 对 staged 变更运行 `artifact-graph version-lock refresh --changed-only --staged --format markdown`。
3. 运行 `artifact-graph version-lock audit --strict-missing-lock`。
4. 如果配置文件变化，改用 `artifact-graph version-lock refresh --all`。
5. 如果出现 orphan lock，默认保留并让人审阅；只有明确清理时才加 `--remove-orphans`。
