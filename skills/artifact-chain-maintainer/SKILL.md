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

## Git Hook 安装契约

- 使用 `artifact-graph hooks install-git --hook all` 安装可选 Git hook。安装器通过 Git 解析真实
  hook 路径，支持普通仓库、linked worktree 和 `core.hooksPath`；不要自行假定 `.git/hooks` 路径。
- 缺失或空 hook 安装后第一行必须是 `#!/bin/sh` 并可被 Git 执行。已有 shell hook 没有任何 execute
  bit 时只增加 owner execute；卸载必须恢复安装前的 bytes、mode 和存在性。
- `--hook all` 必须先预检两个目标，再按事务应用；任一目标的解释器、symlink、快照或写入失败时，不能
  留下只安装一个 hook 的部分状态。
- 有效或 dangling symlink 都必须结构化拒绝，不能跟随或用 rename 替换 link；保留 link、target、mode
  和 mtime，并要求维护者在目标脚本中人工接入。
- 如果已有 hook 不是 POSIX shell，安装器必须以非零状态安全失败，不能改写 Python、Node 或未知解释器
  文件；失败时既有文件的 bytes、mode 和 mtime 必须保持不变。
- 非 shell hook 需要人工接入时，保留该文件的原语言和既有逻辑，并从该语言显式调用正式
  `artifact-graph` CLI 命令。不要把 managed shell block 直接粘贴到 Python、Node 或其他非 shell
  hook 中。
- Python 或 Node 的 `pre-commit` 人工接入必须调用
  `artifact-graph version-lock refresh --changed-only --staged --format markdown`；若 lock 文件发生
  变化，必须让提交非零失败，并要求开发者审查并暂存 lock 后重试。
- Python 或 Node 的 `pre-push` 人工接入必须按顺序调用
  `artifact-graph validate --warning-only`，再调用
  `artifact-graph version-lock audit --strict-missing-lock`；任一命令失败都必须以非零状态阻止 push。
- 原语言接入必须遵循同包 `INSTALL.md` 的 Optional Git Hooks 示例：Python 使用
  `subprocess.run([binary, *args], check=True)` 这类 list argv，Node 使用
  `spawnSync(binary, args, { shell: false, stdio: 'inherit' })` 并显式传播非零 status；路径和参数
  必须保持独立 argv，不得改成 shell 字符串拼接、shell 模式或基于命令字符串的执行 API。
- `INSTALL.md` 的完整示例按实际文件名 `pre-commit`/`pre-push` 自动分派；示例必须原样可执行，不能依赖
  文档外追加的 dispatcher。找不到 `artifact-graph` CLI 时必须非零失败。
- `pre-commit` 刷新后只检查锁文件的 worktree 相对 index 的差异：
  `git diff --quiet -- artifacts/traceability-version-lock.json`。若仍有未暂存变化，必须输出人工审查并
  暂存的要求后以非零状态退出；已经暂存、但相对 HEAD 仍有差异的 lock 不应再次阻断。不得自动暂存、提交或
  运行 `bootstrap --force`。
- `INSTALL.md` 中的 Python/Node 示例是人工接入的完整规范；本技能只负责提醒和路由，不替代该文档。
- 不要在 Git hook、助手 hook 或自动修复流程中运行
  `artifact-graph version-lock bootstrap --force`。它只能在用户明确授权接受新基线时使用。
- 如果安装器报告并发修改，先保留并审阅当前 hook，再重试安装命令；不要用覆盖写入绕过
  `CONCURRENT_HOOK_MODIFICATION`。
- Claude Stop hook 和其他助手 hook 不替代 Git hard gate 或 CI；它们只能提供提醒、检查和辅助。

## 推荐流程

1. 运行插件兼容诊断：`node <plugin-root>/scripts/doctor.mjs --root <project-root> --format json`。
   - 从当前 SKILL.md 所在插件根定位 `<plugin-root>/scripts/doctor.mjs` 和 `compatibility.json`，不硬编码机器绝对路径。
   - 诊断不通过时先修复依赖，再继续后续步骤。
2. 运行 `artifact-graph doctor --format json` 确认 CLI、Node、配置和 lock 路径。
3. 对 staged 变更运行 `artifact-graph version-lock refresh --changed-only --staged --format markdown`。
4. 运行 `artifact-graph version-lock audit --strict-missing-lock`。
5. 如果配置文件变化，改用 `artifact-graph version-lock refresh --all`。
6. 如果出现 orphan lock，默认保留并让人审阅；只有明确清理时才加 `--remove-orphans`。

## 技能协作边界

### 职责范围

**本技能负责**：
- 日常版本锁刷新（`--changed-only` 模式）
- 版本锁审计和完整性检查
- Git hook 安装和更新
- `artifact-graph doctor` 诊断
- 孤立制品的识别和审阅建议
- 插件升级后的版本锁刷新和 hook 重装

**本技能不负责**：
- 修改 `artifact-graph.config.yaml` 的类型定义（路由到 bootstrap）
- 添加或删除制品类型（路由到 bootstrap）
- 项目形态重新分类（路由到 bootstrap）
- 首次建立版本锁（路由到 bootstrap）
- 补充 AGENTS.md/CLAUDE.md 缺失的升级内容（路由到 bootstrap）

### 插件升级后的维护流程

当目标项目完成 bootstrap 升级补丁后，maintainer 接管以下工作：

1. **版本锁刷新**：运行 `artifact-graph version-lock refresh --all --format markdown` 以确保锁文件反映新的追溯关系
2. **版本锁审计**：运行 `artifact-graph version-lock audit --root . --strict-missing-lock` 确认完整性
3. **Hook 重装**：如果插件版本包含 hook 行为变更，运行 `artifact-graph hooks install-git --hook all`
4. **验证**：运行 `artifact-graph validate --root . --warning-only` 确认图一致性

**注意**：maintainer 不负责补丁 AGENTS.md 或 CLAUDE.md 的缺失内容。如果发现这些文件缺少新版本的规则（如价值叙事、完成门），应路由到 bootstrap。

### 何时路由到 bootstrap

当遇到以下情况时，应路由到 `artifact-chain-bootstrap`：

1. **配置严重不一致**：
   - `artifact-graph.config.yaml` 中的类型与实际项目结构不符
   - `artifact-graph doctor` 报告配置缺失或损坏
   - 项目形态发生重大变化（如从 CLI 扩展为 API 服务）

2. **需要扩展制品类型**：
   - 项目需要添加新的制品类型（如 `api_contract`、`deployment_manifest`）
   - 需要更新 `paths` 或 `idPatterns` 配置
   - 需要按项目形态裁剪制品 profile

3. **配置重建**：
   - `artifact-graph.config.yaml` 需要重大结构调整
   - 项目从一个 artifact-chain 设置迁移到另一个

### 与 artifact-chain-where-am-i 的协作

当 `artifact-chain-where-am-i` 路由到 maintainer 时，应确认：

1. 项目已有完整的 `artifact-graph.config.yaml`
2. 制品目录结构与配置一致
3. 版本锁文件存在且可审计

如果 maintainer 发现上述条件不满足，应：
1. 报告具体问题
2. 建议路由到 `artifact-chain-bootstrap`
3. 不尝试自行修复配置问题

### 完成门协作

maintainer 在日常开发中的完成门检查：

**日常开发**：
```bash
artifact-graph validate --root . --warning-only
artifact-graph version-lock refresh --changed-only --worktree --format markdown
artifact-graph version-lock audit --root . --strict-missing-lock
```

**提交前**：
```bash
artifact-graph version-lock refresh --changed-only --staged --format markdown
# 如果锁文件变更，必须失败并要求用户审查和暂存锁文件
```

**推送前**：
```bash
artifact-graph validate --root . --warning-only
artifact-graph version-lock audit --root . --strict-missing-lock
```

这些检查应在目标项目的 `AGENTS.md` 和 `CLAUDE.md` 中记录，由 maintainer 技能指导执行。

## 报告要求（价值叙事）

每次完成维护操作后，报告不能只列运行了哪些命令和输出结果。必须遵循 AGENTS.md 的**价值叙事规则**：

- **业务目的**：这轮维护解决了哪个具体的制品链一致性、版本锁陈旧或 hook 问题。
- **项目价值**：它如何增强了制品链的可信度、可追溯性或开发者信心。
- **链路价值**：它修复了版本锁、审计结果或 hook 配置中的哪段断点。
- **风险变化**：它降低了哪些"代码与制品不一致"的风险；仍保留哪些需要人工决策的问题（如 orphan lock 的清理时机）。
- **验证证据**：用 validate、audit 或 doctor 的实际输出证明维护完成，而非仅叙述"已刷新"。
