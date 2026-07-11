# 扩展制品目录

[English](EXTENDED-ARTIFACT-CATALOG.md)

本文档总结 `artifact-chain-assistant` 的扩展制品类型目录。涵盖类型分类、推荐路径和 ID 模式、
模板采用规则，以及 `artifact-graph`、插件与目标项目之间的三层权威边界。

核心制品类型（`feature`、`scenario`、`decision`、`design`、`test`、`e2e_test`）请参见
插件 README 和 INSTALL.md。本文档覆盖核心集合之外的可选类型。

## 三层权威模型

| 层级 | 权威范围 | 对扩展制品的职责 |
|------|---------|-----------------|
| **artifact-graph** | 确定性图能力 | 从 config 读取类型定义，索引制品，提供 context/packet/validate。**不内置扩展类型的默认路径或 ID 模式。** 缺失路径的类型不被索引。 |
| **artifact-chain-assistant** | 通用助手指导 | 提供扩展制品的入门模板、profile 建议和通用审查清单。**模板是指导，不是权威。** 项目本地模板和审查技能覆盖插件建议。 |
| **目标项目** | 最终工作法 | 决定启用哪些扩展类型，维护 config、本地模板、审查技能和 ID 规则。**项目本地覆盖插件建议。** 随成熟度渐进启用新类型。 |

## 扩展制品类型目录

扩展类型按四个类别组织。每类制品包含推荐路径、ID 模式、生命周期规则和审查要点。所有推荐值
均为**指导**——项目的 `artifact-graph.config.yaml` 是最终权威。

### 一、契约类制品

契约类制品记录系统边界的接口约定。当需求从功能和场景流入实现时，契约是上下文组装的关键上游。

| 制品类型 | 推荐路径 | 推荐 ID 模式 | 生命周期 | 审查要点 |
|---------|---------|-------------|---------|---------|
| `api_contract` | `artifacts/contracts/api/` | `API-{nnn}` 或 `{service}-API-{version}` | API 变更时创建/更新；废弃 API 时标记 deprecated | 与实现代码一致、覆盖错误码、版本兼容、请求/响应 schema 完整性 |
| `cli_contract` | `artifacts/contracts/cli/` | `CLI-{nnn}` 或 `{tool}-CLI-{version}` | CLI 接口变更时创建/更新 | 命令签名、参数类型、退出码、向后兼容、帮助文本准确性 |
| `ui_contract` | `artifacts/contracts/ui/` | `UI-{nnn}` | UI 流程变更时创建/更新 | 交互流程、状态转换、可访问性、错误状态覆盖 |
| `ipc_contract` | `artifacts/contracts/ipc/` | `IPC-{nnn}` | IPC 通道变更时创建/更新 | 消息格式、错误传播、前后端边界、序列化兼容 |
| `data_contract` | `artifacts/contracts/data/` | `DATA-{nnn}` | 数据模型/schema 变更时创建/更新 | 字段含义、版本兼容、迁移路径、默认值语义 |
| `report_contract` | `artifacts/contracts/report/` | `RPT-{nnn}` | 报告格式变更时创建/更新 | 字段含义、聚合逻辑、输出格式、时间窗口语义 |
| `integration_contract` | `artifacts/contracts/integration/` | `INT-{nnn}` | 外部系统集成变更时创建/更新 | 接口协议、超时、重试策略、幂等性、错误分类 |
| `batch_job_contract` | `artifacts/contracts/batch/` | `BATCH-{nnn}` | 批处理作业变更时创建/更新 | 输入/输出格式、调度表达式、幂等性、错误处理、重放策略 |

### 二、领域与数据制品

领域与数据制品捕捉业务概念和技术数据模型。它们是企业 Java 和 DDD 项目的核心制品。

| 制品类型 | 推荐路径 | 推荐 ID 模式 | 生命周期 | 审查要点 |
|---------|---------|-------------|---------|---------|
| `domain_model` | `artifacts/domain/` | `DM-{nnn}` 或实体名 | 领域概念变更时创建/更新 | 聚合边界、领域事件、限界上下文映射、不变量定义 |
| `database_migration` | `artifacts/migrations/` | `MIG-{nnn}` 或时间戳（如 `20260709-001`） | schema 变更时创建；上线后标记已执行 | 回滚路径、数据兼容性、性能影响、大表变更策略 |

### 三、部署与运维制品

部署与运维制品覆盖生产环境的变更、安全、性能和操作流程。仅当项目有对应运维流程时启用。

| 制品类型 | 推荐路径 | 推荐 ID 模式 | 生命周期 | 审查要点 |
|---------|---------|-------------|---------|---------|
| `deployment_manifest` | `artifacts/deploy/` | `DEP-{nnn}` 或环境名（如 `DEP-prod`） | 部署配置变更时创建/更新 | 环境差异、回滚策略、资源限制、健康检查配置 |
| `security_review` | `artifacts/security/` | `SEC-{nnn}` | 安全审查周期或重大变更时创建/更新 | 威胁模型覆盖、修复状态跟踪、合规映射、敏感数据处理 |
| `performance_budget` | `artifacts/performance/` | `PERF-{nnn}` | 性能目标变更时创建/更新 | 指标基线、阈值定义、回归检测策略、测量方法 |
| `migration_plan` | `artifacts/migrations/plan/` | `MPLAN-{nnn}` | 迁移启动时创建；每阶段完成时更新 | 阶段划分、回滚点定义、数据验证策略、并行运行期 |
| `runbook` | `artifacts/runbooks/` | `RUN-{nnn}` | 运维流程变更时创建/更新 | 步骤准确性、告警关联、责任人、最近执行日期 |

### 四、发布治理制品

发布治理制品覆盖版本策略、发布工作流和开源合规。仅当项目是父工程、发布治理仓库或拥有发布流程的多包 monorepo 时启用。

| 制品类型 | 推荐路径 | 推荐 ID 模式 | 生命周期 | 审查要点 |
|---------|---------|-------------|---------|---------|
| `release_policy` | `artifacts/governance/` | `RP-{nnn}` | 发布策略变更时创建/更新 | 版本语义、发布节奏、分支策略、变更日志规范、回滚计划 |
| `publish_skill` | `artifacts/governance/` | `PS-{nnn}` | 发布工作流变更时创建/更新 | 发布目标、质量门禁、合规检查、错误处理、回滚计划 |
| `oss_compliance` | `artifacts/governance/` | `OSS-{nnn}` | 开源合规规则或发布范围变更时创建/更新 | 许可证策略、依赖审计、标准文件、安全披露、发布排除规则 |

### 五、Agent 与 Hook 制品

Agent 与 Hook 制品覆盖 AI 辅助工作流和 CI/CD 门禁。仅当项目有对应文件或流程时启用。

| 制品类型 | 推荐路径 | 推荐 ID 模式 | 生命周期 | 审查要点 |
|---------|---------|-------------|---------|---------|
| `agent_skill` | `artifacts/skills/` | `SKILL-{nnn}` | 技能定义变更时创建/更新 | 输入/输出契约、工具依赖、权限边界、错误处理 |
| `hook_policy` | `artifacts/policies/` | `HOOK-{nnn}` | hook 策略变更时创建/更新 | 触发条件、门禁规则、绕过审批流程、审计日志 |
| `prompt_packet` | `artifacts/packets/` | `PP-{nnn}` | prompt 模板或上下文组装规则变更时创建/更新 | 上下文来源、prompt 清晰度、token 预算、输出契约、可测试性 |

## Bootstrap 裁剪策略

bootstrap 的职责是根据项目形态选择**最小可用 profile**，而非启用所有已知类型。

裁剪规则：

1. **基础集合始终启用**：`feature`、`scenario`、`decision`、`design`、`test`、`e2e_test`。
2. **契约类按证据加入**：仅当项目本地存在对应的接口文件（如 OpenAPI spec、CLI 入口、IPC 通道定义）时启用。
3. **领域与数据类按项目形态加入**：企业 Java/DDD 项目可启用 `domain_model`；有数据库的项目可启用 `database_migration`。
4. **运维类按运维流程加入**：仅有部署配置文件、安全审查流程或运维手册的项目才启用对应类型。
5. **Agent/Hook 类按本地文件加入**：仅当项目存在 `skills/`、`policies/` 或 hook 配置文件时启用。
6. **发布治理类按治理证据加入**：仅当项目存在发布策略、发布脚本或开源合规流程时启用 `release_policy`、`publish_skill`、`oss_compliance`。
7. **渐进扩展**：项目随成熟度增长，可按需在 `artifact-graph.config.yaml` 中添加新类型。已有制品和追溯关系不受影响。

bootstrap 执行后，启用的类型、路径和 ID 模式记录在 `artifact-graph.config.yaml` 中。延迟启用
的类型及其证据条件记录在项目制品目录中，使未来的扩展成为有据可查的决策。

## 模板采用

### 模板来源规则

1. **插件模板是入门指导**。`artifact-chain-assistant` 在 `templates/extended/` 中为每种扩展类型
   提供 starter 模板，按类别组织（`contracts/`、`domain/`、`ops/`、`agent/`）。插件模板不决定
   项目的制品形态。
2. **项目本地模板是权威**。当项目需要不同的章节结构、审查标准或命名规则时，项目本地模板覆盖
   插件模板。
3. **无模板时的回退**。如果项目启用了某扩展类型但无本地模板，助手可引用插件 starter，但必须
   提示用户该模板未经项目本地定制。
4. **采用流程**。从 `templates/extended/` 复制 starter 模板到项目本地 `artifacts/templates/` 或
   等价位置，定制后成为项目权威。

### 模板生命周期

1. **Bootstrap 阶段**：bootstrap 技能引用插件 starter 模板生成初始制品结构，模板来源记录在
   `artifacts/README.md` 中。
2. **采用阶段**：团队审阅 starter 模板，决定哪些章节保留、修改、删除，复制到本地。定制后的
   版本成为权威。
3. **成熟阶段**：项目在本地维护完整的模板库。插件 starter 仅在新成员加入或新类型启用时被
   参考。
4. **升级评审**：插件更新 starter 时，项目审查 diff 并选择性合入有用变更，保留本地定制。

### 模板目录布局

```
templates/
  core/                          # 核心制品模板
    feature/
      starter.md                 # 起草指引模板
      review-checklist.md        # 通用审查清单
    scenario/
      starter.md
      review-checklist.md
    decision/
      starter.md
      review-checklist.md
    design/
      starter.md
      review-checklist.md
    test/
      starter.md
      review-checklist.md
    e2e_test/
      starter.md
      review-checklist.md
  extended/                      # 扩展制品模板（按类别组织）
    contracts/
      api_contract/
        starter.md
        review-checklist.md
      cli_contract/
        starter.md
        review-checklist.md
      data_contract/
        starter.md
        review-checklist.md
      ...                        # 其他契约类型同构
    domain/
      domain_model/
        starter.md
        review-checklist.md
      database_migration/
        starter.md
        review-checklist.md
    ops/
      deployment_manifest/
        starter.md
        review-checklist.md
      runbook/
        starter.md
        review-checklist.md
      ...
    governance/
      release_policy/
        starter.md
        review-checklist.md
      publish_skill/
        starter.md
        review-checklist.md
      oss_compliance/
        starter.md
        review-checklist.md
    agent/
      agent_skill/
        starter.md
        review-checklist.md
      hook_policy/
        starter.md
        review-checklist.md
      prompt_packet/
        starter.md
        review-checklist.md
```

每个类型的 `starter.md` 包含制品结构模板和最小填写指引。`review-checklist.md` 是通用审查要点
基线。两者都是**可被项目本地完全覆盖的建议**。

## 按证据启用

bootstrap 仅在当地文件或目录存在时才启用扩展制品类型：

| 制品类型 | 启用证据 |
|---------|---------|
| `api_contract` | 存在 OpenAPI/Swagger 规范、API 文档或 REST 端点代码 |
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
| `prompt_packet` | 存在 prompt 模板文件、上下文组装配置或 AI 工作流定义 |
| `release_policy` | 存在发布策略文档、版本策略或发布流程文件 |
| `publish_skill` | 存在发布脚本、CI/CD 发布流水线或注册中心配置 |
| `oss_compliance` | 存在许可证文件、依赖审计配置或开源合规流程文档 |

**规则**：仅当本地证据存在时才启用对应类型。不要因为插件提供了模板就启用。

## artifact-graph 对自定义类型的运行时支持

扩展制品目录当前分为两个成熟度层级：

1. **已在 artifact-chain-assistant 实现**：starter 模板、审查清单、bootstrap 推荐和按证据采用指导。
2. **artifact-graph runtime 路线图**：任意自定义类型的配置驱动一等索引、图遍历、`context`、`packet`、
   `validate`、`version-lock` 和 `extraFields` 支持。

目前 `artifact-graph` 命令仍以核心制品类型为中心。在 runtime 路线图落地前，不要假设
`artifact-graph context --{type} {ID}`、`artifact-graph packet --{type} {ID}`，或针对所有自定义
类型的严格验证已经可用。

预期的未来 runtime 行为是：

1. **索引**：读取 `artifact-graph.config.yaml` 的 `types.{type}.paths`，扫描匹配文件，解析
   frontmatter 提取 `id`、`title`、`status` 等标准字段。
2. **图边建立**：让自定义类型通过 `related_*` frontmatter 字段、追溯注释和显式关系字段参与图遍历。
3. **context 组装**：为已注册自定义类型组装上游和下游上下文。
4. **packet 生成**：为已注册自定义类型生成任务包。
5. **验证和锁**：将已声明自定义类型纳入追溯验证和版本锁检查。

### 能力矩阵

| 能力 | 核心类型 | 扩展类型 | 说明 |
|------|---------|---------|------|
| 文件索引和 ID 解析 | 已实现 | 路线图 | 扩展类型应写入 config，但任意类型一等索引尚未实现 |
| 图遍历（上游/下游） | 已实现 | 路线图 | 未来行为取决于追溯注释密度 |
| context/packet 组装 | 核心命令 flag 已实现 | 路线图 | 通用 `--{type}` flag 尚不可用 |
| validate | 当前图模型已实现 | 任意自定义类型覆盖是路线图 | 不要依赖严格自定义类型覆盖 |
| version-lock | 当前 implementation edges 已实现 | 任意自定义类型覆盖是路线图 | 自定义类型锁覆盖依赖未来图能力 |
| 制品内容质量判断 | 不做 | 不做 | artifact-graph 不判断"好 PRD"或"好契约" |
| 内置边规则 | 不做 | 不做 | 所有边规则来自制品内容，不来自类型元数据 |

### 已知限制

- **运行时支持尚未完整**：扩展模板今天已经可用，但任意自定义类型还没有一等
  `context`/`packet`/`validate`/`version-lock` 覆盖。
- **追溯注释稀疏**：runtime 支持落地后，如果自定义制品缺少 `related_*` frontmatter 字段或实现文件缺少
  追溯注释，图遍历仍会产生较弱关系。缓解措施：项目本地审查应要求追溯字段。
- **ID 模式冲突**：多个类型使用相同的 ID 模式可能导致歧义图边。缓解措施：每个类型使用
  不同的 ID 前缀（如 `API-`、`CLI-`）。
- **路径重叠**：多个类型的路径 glob 匹配相同文件会创建重复图节点。缓解措施：使用互斥的
  路径 glob。
- **运维制品天然松散**：某些类型（如 `runbook`、`deployment_manifest`）与核心需求链的关联
  天然较松散。这是预期行为，不是缺陷。

## 项目形态 Profile

九种项目画像各自映射到推荐的 starter 集合和延迟就绪列表。Profile 仅在 bootstrap 阶段使用，
不是运行时概念。最终选择写入 `artifact-graph.config.yaml`。

| 项目形态 | 推荐启用的扩展类型 | 延迟启用的类型 |
|---------|------------------|-------------|
| 文档/规划仓库 | 无 | 所有扩展类型 |
| TypeScript 库或 CLI | `cli_contract` | 其他契约、领域、运维 |
| API 服务 | `api_contract`、`data_contract` | `domain_model`、`deployment_manifest`、`runbook`、`performance_budget` |
| 企业级 Java/Spring/JVM | `api_contract`、`data_contract`、`integration_contract`、`batch_job_contract`、`domain_model`、`database_migration`、`security_review` | `deployment_manifest`、`runbook`、`performance_budget` |
| 桌面/全栈应用 | `ui_contract`、`ipc_contract`、`api_contract` | `deployment_manifest`、`runbook` |
| Agent/插件工具包 | `agent_skill`、`hook_policy`、`prompt_packet` | 其他扩展类型 |
| Parent/发布治理仓库 | `release_policy`、`publish_skill`、`oss_compliance` | 其他扩展类型 |
| 已有成熟制品仓库 | 按现有文件按需启用 | 无本地证据的类型 |
| 首次尝试的小型项目 | 无 | 所有扩展类型 |

## 相关文档

- [README](README.md) — 插件概览与完整功能列表
- [INSTALL.md](INSTALL.md) — 安装、bootstrap 流程和 profile 扩展指南
- [ADOPTION-GUIDE](https://github.com/mzdbxqh/artifact-chain-assistant/blob/main/templates/extended/ADOPTION-GUIDE.md) — 模板采用和升级评审的分步指南
