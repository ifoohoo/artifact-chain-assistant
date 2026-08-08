# 扩展制品 Starter 模板

本目录包含 `artifact-chain-assistant` 插件为扩展制品类型提供的 **starter 模板**。

## 重要声明

**这些是 starter 模板，不是项目权威模板。**

项目采用后，应：
1. 复制到项目本地 `artifacts/templates/` 或等价位置
2. 根据项目需求定制内容
3. 本地定制后的模板成为项目权威
4. 插件 starter 仅作入门指导参考

## 模板目录

### 契约类制品（contracts）

- **api_contract** - REST/GraphQL/gRPC API 接口契约
  - 路径：`contracts/api_contract/starter.md`
  - 用途：定义 API 端点、请求/响应格式、错误码

- **cli_contract** - 命令行工具接口契约
  - 路径：`contracts/cli_contract/starter.md`
  - 用途：定义 CLI 命令、参数、退出码、配置

- **data_contract** - 数据模型和数据质量契约
  - 路径：`contracts/data_contract/starter.md`
  - 用途：定义数据 schema、质量规则、版本兼容性

- **ui_contract** - 用户界面交互流程契约
  - 路径：`contracts/ui_contract/starter.md`
  - 用途：定义 UI 流程、状态转换、交互元素、可访问性要求
  - 适用：桌面/全栈、Web/SaaS 应用

- **ipc_contract** - 进程间通信契约
  - 路径：`contracts/ipc_contract/starter.md`
  - 用途：定义 IPC 通道、消息格式、前后端边界、序列化规范
  - 适用：桌面/全栈（Tauri/Electron）应用

- **report_contract** - 报告生成契约
  - 路径：`contracts/report_contract/starter.md`
  - 用途：定义报告字段、聚合逻辑、输出格式、时间窗口语义
  - 适用：数据平台、BI、企业 Java 项目

- **integration_contract** - 外部系统集成契约
  - 路径：`contracts/integration_contract/starter.md`
  - 用途：定义接口协议、超时、重试策略、幂等性、错误分类
  - 适用：企业 Java、微服务、集成平台项目

- **batch_job_contract** - 批处理作业契约
  - 路径：`contracts/batch_job_contract/starter.md`
  - 用途：定义输入/输出格式、调度表达式、幂等性、错误处理、重放策略
  - 适用：企业 Java、数据平台项目

### 领域与数据制品（domain）

- **domain_model** - 领域模型设计
  - 路径：`domain/domain_model/starter.md`
  - 用途：定义聚合边界、领域事件、限界上下文映射、不变量

- **database_migration** - 数据库迁移
  - 路径：`domain/database_migration/starter.md`
  - 用途：定义 schema 变更、数据迁移策略、回滚方案、兼容性分析
  - 适用：企业 Java、有状态服务、数据库驱动项目

### 部署与运维制品（ops）

- **deployment_manifest** - 部署清单
  - 路径：`ops/deployment_manifest/starter.md`
  - 用途：定义环境配置、资源分配、健康检查、回滚计划

- **runbook** - 运维操作手册
  - 路径：`ops/runbook/starter.md`
  - 用途：定义运维流程、告警处理、回滚步骤

- **security_review** - 安全审查
  - 路径：`ops/security_review/starter.md`
  - 用途：定义威胁模型、安全发现项、修复跟踪、合规映射
  - 适用：企业 Java、安全敏感项目

- **performance_budget** - 性能预算
  - 路径：`ops/performance_budget/starter.md`
  - 用途：定义性能指标基线、阈值、回归检测策略、测量方法
  - 适用：性能敏感项目

- **migration_plan** - 迁移计划
  - 路径：`ops/migration_plan/starter.md`
  - 用途：定义迁移阶段、回滚点、数据迁移策略、并行运行期
  - 适用：大规模迁移、架构演进项目

### 发布治理制品（governance）

- **release_policy** - 发布策略
  - 路径：`governance/release_policy/starter.md`
  - 用途：定义版本语义、发布节奏、分支策略、合规要求、回滚方案
  - 适用：Parent/发布治理仓库、多包 monorepo

- **publish_skill** - 发布技能
  - 路径：`governance/publish_skill/starter.md`
  - 用途：定义自动化发布流程、注册中心目标、质量门禁、错误处理
  - 适用：Parent/发布治理仓库、CI/CD 集成发布

- **oss_compliance** - 开源合规
  - 路径：`governance/oss_compliance/starter.md`
  - 用途：定义许可证策略、依赖审查、发布文件清单、安全披露和发布排除规则
  - 适用：开源项目、Parent/发布治理仓库、多包 monorepo

### Agent 与 Hook 制品（agent）

- **hook_policy** - Hook 策略和门禁规则
  - 路径：`agent/hook_policy/starter.md`
  - 用途：定义 CI/CD hook 触发条件、门禁规则、绕过审批

- **agent_skill** - Agent 技能定义
  - 路径：`agent/agent_skill/starter.md`
  - 用途：定义 Agent 技能的输入/输出契约、处理流程、权限边界

- **prompt_packet** - Prompt Packet 上下文包
  - 路径：`agent/prompt_packet/starter.md`
  - 用途：定义 AI 辅助任务的上下文组装、Prompt 模板、Token 预算
  - 适用：Agent/插件工具包、AI 辅助开发流程

## 模板使用方式

### Bootstrap 阶段

1. `artifact-chain-bootstrap` 技能根据项目形态选择最小可用 profile
2. bootstrap 技能引用本目录的 starter 模板生成初始制品结构
3. 在 `artifacts/README.md` 中记录模板来源

### 采用阶段

1. 项目团队审阅 starter 模板
2. 决定哪些章节保留、哪些修改、哪些删除
3. 复制到项目本地 `artifacts/templates/` 或等价位置
4. 修改后的模板成为项目本地权威

### 成熟阶段

1. 项目在本地维护完整的模板库
2. 完全不再引用插件 starter
3. 插件 starter 仅在新成员加入或新类型启用时被参考

## 模板内容说明

### starter.md

每个类型的 `starter.md` 包含：
- 制品 frontmatter 结构（id, title, status, version 等）
- 最小填写指引
- 关键章节说明
- 关联制品示例

**使用建议**：
- 复制到项目本地后修改
- 根据项目需求调整章节
- 删除不适用的章节
- 添加项目特定的章节

### review-checklist.md

每个类型的 `review-checklist.md` 包含：
- 结构完整性检查
- 内容质量检查
- 追溯性检查
- 生命周期检查

**使用建议**：
- 作为审查基线参考
- 根据项目标准调整检查项
- 添加项目特定的检查项
- 在审查技能中引用

## Bootstrap 裁剪策略

bootstrap 的职责是根据项目形态选择**最小可用 profile**，而非启用所有已知类型。

裁剪规则：

1. **基础集合始终启用**：`feature`、`scenario`、`decision`、`design`、`test`、`e2e_test`
2. **契约类按证据加入**：仅当项目本地存在对应的接口文件时启用
3. **领域与数据类按项目形态加入**：企业 Java/DDD 项目可启用 `domain_model`；有数据库的项目可启用 `database_migration`
4. **运维类按运维流程加入**：仅有部署配置文件、安全审查流程、性能管理需求或迁移计划的项目才启用对应类型
5. **Agent/Hook 类按本地文件加入**：仅当项目存在 `skills/`、`policies/` 或 hook 配置文件时启用
6. **发布治理类按治理需求加入**：仅当项目是 Parent/发布治理仓库且有发布流程或开源合规文件时启用 `release_policy`、`publish_skill`、`oss_compliance`
7. **渐进扩展**：项目随成熟度增长，可按需添加新类型

## 扩展制品目录设计

本目录的模板结构遵循扩展制品目录规范：

- 模板目录按类别组织（contracts、domain、ops、governance、agent），每类含 starter.md 和 review-checklist.md
- 模板来源遵循权威层级：插件模板是入门指导，项目本地模板是权威
- Bootstrap 按项目形态裁剪，仅启用有本地证据的类型
- 模板生命周期：starter → 项目采用定制 → 本地权威

详细的类型目录、推荐路径、ID 模式和生命周期规则，请参考
[扩展制品目录](../../EXTENDED-ARTIFACT-CATALOG.md)。

## 插件版本升级时的模板同步

当 `artifact-chain-assistant` 发布新版本且包含新的 starter 模板时，已采用项目的同步流程：

### 发现新模板

1. 查看 `CHANGELOG.md` 中的"Extended templates"部分
2. 浏览 `templates/extended/` 目录，对比项目本地 `artifacts/templates/`
3. 确认哪些新类型对当前项目形态有用

### 同步步骤

**步骤 1：评估相关性**

根据项目形态决定是否需要新模板：

| 项目形态 | 可能相关的新模板 |
|----------|-----------------|
| API 服务 | `api_contract`, `data_contract`, `runbook`, `performance_budget` |
| CLI/库 | `cli_contract` |
| 企业 Java | 所有契约类、`domain_model`, `database_migration`, `deployment_manifest`, `security_review`, `runbook` |
| Agent/插件 | `agent_skill`, `hook_policy`, `prompt_packet` |
| Parent/发布治理 | `release_policy`, `publish_skill`, `oss_compliance` |
| 数据平台 | `data_contract`, `batch_job_contract`, `report_contract`, `database_migration` |
| 大规模迁移 | `migration_plan`, `database_migration`, `deployment_manifest` |

**步骤 2：复制到项目本地**

```bash
# 示例：复制 api_contract starter
cp plugins/artifact-chain-assistant/templates/extended/contracts/api_contract/starter.md \
   artifacts/templates/api_contract.md
```

**步骤 3：定制内容**

- 删除不适用的章节
- 添加项目特定的字段或检查项
- 调整 frontmatter 字段以匹配项目 ID 模式
- 添加本地审查规则

**步骤 4：记录模板来源**

在 `artifacts/README.md` 或项目模板目录的 README 中记录：
- 模板来源：插件 `templates/extended/`
- 定制日期和版本
- 本地修改摘要

### 重要规则

- **不要直接引用插件 starter**：复制到项目本地后定制
- **本地定制后覆盖插件**：项目本地模板成为权威，插件 starter 仅作参考
- **不自动同步**：插件更新不自动覆盖项目本地模板，需手动评估和复制

## 相关文档

- [templates/README.md](../README.md) - 模板目录总览
- [ADOPTION-GUIDE.md](ADOPTION-GUIDE.md) - **采用指南**：如何将 starter 模板定制为项目本地权威模板，以及升级评审流程
- [扩展制品目录](../../EXTENDED-ARTIFACT-CATALOG.md) - 类型分类、路径/ID 模式、生命周期规则
- [INSTALL.md](../../INSTALL.md) - 插件安装指南（含升级指南）
- [artifact-chain-bootstrap 技能](../../skills/artifact-chain-bootstrap/SKILL.md) - Bootstrap 技能文档
