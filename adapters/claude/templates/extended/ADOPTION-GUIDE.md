# Starter 模板采用指南

本指南说明如何将插件 starter 模板定制为项目本地权威模板，以及后续模板升级时的评审流程。

## 概述

`artifact-chain-assistant` 提供的 starter 模板是**入门指导**，不是项目权威。项目采用扩展制品类型时，必须将 starter 模板复制到本地并定制，定制后的模板成为项目权威。

```
插件 starter 模板（入门指导）
    ↓ 复制 + 定制
项目本地模板（权威）
```

## 采用流程

### 步骤 1：评估是否需要该类型

在采用前，确认项目有对应的本地证据：

| 制品类型 | 启用证据 |
|---------|---------|
| `api_contract` | 存在 OpenAPI spec、API 文档或 REST 端点代码 |
| `cli_contract` | 存在 CLI 入口代码或命令定义 |
| `data_contract` | 存在数据模型定义或 schema 文件 |
| `domain_model` | 存在 DDD 聚合、实体或值对象代码 |
| `database_migration` | 存在数据库 schema 或迁移脚本 |
| `security_review` | 存在安全审查流程、安全相关代码或 Spring Security 配置 |
| `performance_budget` | 存在性能测试脚本、监控配置或性能基线文档 |
| `migration_plan` | 存在迁移规划文档、架构演进方案或系统过渡计划 |
| `runbook` | 存在运维流程或操作手册 |
| `deployment_manifest` | 存在部署配置（K8s、Docker 等） |
| `agent_skill` | 存在 Agent 技能定义文件 |
| `hook_policy` | 存在 CI/CD hook 配置 |

**规则**：仅当本地证据存在时才启用对应类型。不要因为插件提供了模板就启用。

### 步骤 2：复制 starter 模板到项目本地

```bash
# 示例：复制 api_contract starter
cp plugins/artifact-chain-assistant/templates/extended/contracts/api_contract/starter.md \
   artifacts/templates/api_contract.md

# 示例：复制 review checklist
cp plugins/artifact-chain-assistant/templates/extended/contracts/api_contract/review-checklist.md \
   artifacts/templates/api_contract-review-checklist.md
```

**推荐目录结构**：

```
artifacts/templates/
  api_contract.md              # 制品模板
  api_contract-review-checklist.md  # 审查清单
  cli_contract.md
  cli_contract-review-checklist.md
  ...
```

### 步骤 3：定制模板内容

定制四个维度：

#### 3.1 定制路径

修改 `artifact-graph.config.yaml` 中的 `types.{type}.paths`，匹配项目实际目录结构：

```yaml
types:
  api_contract:
    paths: ["artifacts/contracts/api/**/*.md"]  # 按项目实际路径调整
```

#### 3.2 定制 ID 模式

修改 `artifact-graph.config.yaml` 中的 `idPatterns.{type}`，匹配项目命名规范：

```yaml
idPatterns:
  api_contract: "^API-\\d+$"  # 或 "{service}-API-{version}" 等项目特定模式
```

#### 3.3 定制 frontmatter

修改模板中的 frontmatter 字段，匹配项目需求：

```markdown
---
id: {API_ID}           # 替换为项目 ID 模式，如 API-001
title: {API 名称}       # 替换为实际标题
status: draft           # 按项目状态值调整
version: {v1}           # 替换为实际版本
base_url: {基础 URL}    # 替换为实际 URL
related_features: []    # 填入关联的功能特性 ID
---
```

**必须保留的字段**：`id`、`title`、`status`（artifact-graph 依赖这些字段索引）

**可扩展的字段**：根据制品类型添加项目特定字段（如 `api_contract` 的 `base_url`、`version`）

#### 3.4 定制 review checklist

修改审查清单，添加项目特定检查项：

```markdown
## 项目特定检查项

- [ ] 与项目 API 网关集成点一致
- [ ] 符合项目安全认证规范
- [ ] 响应时间满足 SLA 要求
```

**规则**：项目本地审查规则覆盖插件通用基线。

### 步骤 4：在 artifacts/README.md 中记录模板来源

在项目 `artifacts/README.md` 或模板目录的 README 中记录：

```markdown
## 扩展制品模板

本项目采用以下扩展制品类型，模板来自插件 `templates/extended/`，已定制为本地权威：

| 制品类型 | 模板路径 | 定制日期 | 定制摘要 |
|---------|---------|---------|---------|
| api_contract | artifacts/templates/api_contract.md | 2026-07-09 | 添加项目认证规范、调整 ID 模式 |
| runbook | artifacts/templates/runbook.md | 2026-07-09 | 添加告警关联规则 |
```

### 步骤 5：更新 config 并验证

```bash
# 1. 更新 config
# 编辑 artifact-graph.config.yaml 添加新类型

# 2. 验证图
artifact-graph validate --root . --warning-only

# 3. 刷新版本锁
artifact-graph version-lock refresh --all --format markdown

# 4. 审计版本锁
artifact-graph version-lock audit --root . --strict-missing-lock
```

### 步骤 6：提交变更

```bash
git add artifact-graph.config.yaml artifacts/templates/ artifacts/README.md
git commit -m "feat: adopt api_contract template with local customization"
```

## 模板升级评审流程

当 `artifact-chain-assistant` 发布新版本且更新了 starter 模板时，已采用项目需要评审是否同步更新本地模板。

### 步骤 1：发现变更

查看插件 `CHANGELOG.md` 或 `templates/extended/` 目录的 git diff：

```bash
# 查看模板目录变更
git diff HEAD~1 plugins/artifact-chain-assistant/templates/extended/
```

### 步骤 2：对比本地模板

使用 diff 工具对比插件 starter 和项目本地模板：

```bash
# 对比 api_contract 模板
diff plugins/artifact-chain-assistant/templates/extended/contracts/api_contract/starter.md \
     artifacts/templates/api_contract.md
```

**diff 关注点**：
- 插件新增的章节是否对项目有用
- 插件修改的审查点是否应纳入项目审查清单
- 插件删除的章节是否项目仍在使用

### 步骤 3：评审决策

| 情况 | 决策 |
|------|------|
| 插件新增了有用的章节 | 选择性合入本地模板 |
| 插件修改了通用审查点 | 评估是否提升项目审查标准 |
| 插件删除了项目使用的章节 | 保留本地版本，不跟随删除 |
| 插件模板与本地模板冲突 | 以本地模板为准，插件仅作参考 |

**核心原则**：项目本地模板是权威，插件 starter 是参考。不要盲目同步。

### 步骤 4：选择性合并

手动合并有用的变更到本地模板：

```bash
# 不要直接复制覆盖！手动编辑合并
vim artifacts/templates/api_contract.md
```

### 步骤 5：更新审查清单

如果插件更新了 review-checklist.md，评估并选择性合入：

```bash
# 对比审查清单
diff plugins/artifact-chain-assistant/templates/extended/contracts/api_contract/review-checklist.md \
     artifacts/templates/api_contract-review-checklist.md
```

### 步骤 6：记录升级

在模板目录 README 中记录升级历史：

```markdown
## 升级历史

| 日期 | 插件版本 | 变更摘要 |
|------|---------|---------|
| 2026-07-09 | v1.2.0 | 合入插件新增的"安全认证"章节 |
```

## 常见问题

### Q: 可以直接引用插件 starter 模板吗？

**A: 不可以。** 插件 starter 是入门指导，不是权威。必须复制到本地定制后使用。

### Q: 插件更新时需要同步吗？

**A: 不需要自动同步。** 评审插件变更，选择性合入有用的部分。本地模板是权威。

### Q: 如何确认模板已定制完成？

**A: 检查清单**：
- [ ] 模板已复制到 `artifacts/templates/` 或等价位置
- [ ] frontmatter 字段符合项目 ID 模式
- [ ] 审查清单包含项目特定检查项
- [ ] `artifacts/README.md` 已记录模板来源
- [ ] `artifact-graph.config.yaml` 已添加类型定义
- [ ] `artifact-graph validate` 通过

### Q: 多个项目可以共享本地模板吗？

**A: 可以，但需各自定制。** 每个项目有独立的 `artifact-graph.config.yaml` 和本地模板，即使内容相似，也是各自维护的权威。

## 与三层权威模型的关系

本指南执行 D-ACA-07 定义的三层权威模型：

| 层级 | 对模板的职责 | 本指南动作 |
|------|------------|-----------|
| artifact-graph | 从 config 读取类型定义，索引制品 | 更新 config 的 types 和 idPatterns |
| artifact-chain-assistant | 提供 starter 模板作入门指导 | 复制 starter 到本地 |
| 目标项目 | 维护本地模板作权威 | 定制模板、记录来源、建立审查规则 |

## 相关文档

- [templates/extended/README.md](README.md) - Starter 模板目录
- [扩展制品目录](../../EXTENDED-ARTIFACT-CATALOG.md) - 类型分类、路径/ID 模式、生命周期规则
- [INSTALL.md](../../INSTALL.md) - 插件安装指南
