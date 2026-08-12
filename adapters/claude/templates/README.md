# Artifact Chain Assistant 模板目录

本目录提供 `artifact-chain-assistant` 插件的 starter 模板，为目标项目提供制品结构的入门指导。

## 权威层级

**关键原则：插件模板是入门指导，项目本地模板是权威。**

| 层级 | 权威范围 | 对模板的职责 |
|------|---------|-------------|
| **插件（本目录）** | 通用助手指导 | 提供 starter 模板和通用审查清单。**模板是指导，不是权威。** |
| **目标项目** | 最终工作法 | 维护项目本地模板，覆盖或补充插件建议。**项目本地模板是权威。** |

当项目需要不同的章节结构、审查标准或命名规则时，项目本地模板覆盖插件模板。项目本地审查技能覆盖插件通用审查规则。

## 目录结构

```
templates/
├── core/                          # 核心制品模板
│   ├── feature/                   # 功能特性
│   │   ├── starter.md             # 起草指引模板
│   │   └── review-checklist.md    # 通用审查清单
│   ├── scenario/                  # 场景
│   ├── decision/                  # 决策
│   ├── design/                    # 设计文档
│   ├── test/                      # 测试
│   └── e2e_test/                  # 端到端测试
│
├── extended/                      # 扩展制品模板（按类别组织）
│   ├── contracts/                 # 契约类制品
│   │   ├── api_contract/          # API 契约
│   │   ├── cli_contract/          # CLI 契约
│   │   └── data_contract/         # 数据契约
│   ├── domain/                    # 领域与数据制品
│   │   └── domain_model/          # 领域模型
│   ├── ops/                       # 部署与运维制品
│   │   ├── runbook/               # 运维手册
│   │   └── deployment_manifest/   # 部署清单
│   └── agent/                     # Agent 与 Hook 制品
│       ├── agent_skill/           # Agent 技能
│       └── hook_policy/           # Hook 策略
│
├── git-hooks/                     # Git hook 脚本模板
├── claude/                        # Claude Code 适配器模板
└── codex/                         # Codex 适配器模板
```

## 模板使用方式

### Bootstrap 阶段

1. `artifact-chain-bootstrap` 技能根据项目形态选择最小可用 profile
2. bootstrap 技能引用本目录的 starter 模板生成初始制品结构
3. 在 `artifacts/README.md` 中记录模板来源

### 采用阶段

1. 项目团队审阅 starter 模板
2. 决定哪些章节保留、哪些修改、哪些删除
3. 修改后的模板成为项目本地权威

### 成熟阶段

1. 项目可能在本地维护完整的模板库
2. 完全不再引用插件 starter
3. 插件 starter 仅在新成员加入或新类型启用时被参考

## 模板内容说明

### starter.md

每个类型的 `starter.md` 包含：
- 制品 frontmatter 结构
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

## 扩展制品类型说明

### 契约类制品

记录系统边界的接口约定。当需求从功能和场景流入实现时，契约是上下文组装的关键上游。

- **api_contract**：REST/GraphQL/gRPC API 接口契约
- **cli_contract**：命令行工具接口契约
- **data_contract**：数据模型和数据质量契约

### 领域与数据制品

捕捉业务概念和技术数据模型。是企业 Java 和 DDD 项目的核心制品。

- **domain_model**：聚合、实体、值对象、领域事件

### 部署与运维制品

覆盖生产环境的变更、安全、性能和操作流程。仅当项目有对应运维流程时启用。

- **runbook**：运维操作手册
- **deployment_manifest**：部署配置清单

### Agent 与 Hook 制品

覆盖 AI 辅助工作流和 CI/CD 门禁。仅当项目有对应文件或流程时启用。

- **agent_skill**：Agent 技能定义
- **hook_policy**：Hook 策略和门禁规则

## Bootstrap 裁剪策略

bootstrap 的职责是根据项目形态选择**最小可用 profile**，而非启用所有已知类型。

裁剪规则：

1. **基础集合始终启用**：`feature`、`scenario`、`decision`、`design`、`test`、`e2e_test`
2. **契约类按证据加入**：仅当项目本地存在对应的接口文件时启用
3. **领域与数据类按项目形态加入**：企业 Java/DDD 项目可启用 `domain_model`
4. **运维类按运维流程加入**：仅有部署配置文件或运维手册的项目才启用对应类型
5. **Agent/Hook 类按本地文件加入**：仅当项目存在 `skills/`、`policies/` 或 hook 配置文件时启用
6. **渐进扩展**：项目随成熟度增长，可按需添加新类型

## 扩展制品目录设计

本目录的模板结构遵循扩展制品目录规范：

- 模板按类别组织（contracts、domain、ops、agent），每类含 starter 模板和审查清单
- 模板来源遵循权威层级：插件模板是入门指导，项目本地模板是权威
- Bootstrap 按项目形态裁剪，仅启用有本地证据的类型
- 模板生命周期：starter → 项目采用定制 → 本地权威

详细的类型目录、推荐路径、ID 模式和生命周期规则，请参考
[扩展制品目录](../EXTENDED-ARTIFACT-CATALOG.md)。

## 相关文档

- [扩展制品目录](../EXTENDED-ARTIFACT-CATALOG.md) - 类型分类、路径/ID 模式、生命周期规则
- [ADOPTION-GUIDE](extended/ADOPTION-GUIDE.md) - 模板采用与升级评审指南
- [INSTALL.md](../INSTALL.md) - 插件安装指南
- [artifact-chain-bootstrap 技能](../skills/artifact-chain-bootstrap/SKILL.md) - Bootstrap 技能文档
