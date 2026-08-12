# scenario-script inspect

内部工序，不作为 catalog 入口。

## 目的

在编写或审阅场景剧本制品前，收集项目配置、已有制品、关联关系和场景模板的证据。

## 步骤

### 1. 项目配置发现

```bash
# 确认项目根目录
git rev-parse --show-toplevel

# 读取 artifact-graph 配置
cat artifact-graph.config.yaml

# 确认场景类型注册和路径
artifact-graph --help
```

提取：
- 场景剧本对应的注册类型名、paths、target 与对应 `idPatterns`（如有）
- 项目注册的关联类型与同类制品实际使用的关联字段

### 2. 项目模板与治理文档

读取以下文件以派生场景剧本的合法字段、status 枚举和章节结构：
- `artifact-graph.config.yaml` 中场景类型的注册信息
- `artifacts/README.md` 中的制品边界说明
- `AGENTS.md` 或 `CLAUDE.md` 中的治理规则
- 同类已有制品（从步骤 3 的扫描结果中选取典型样本）

从以上来源派生：
- frontmatter 必填字段（不得假设固定字段集）
- status 合法枚举（不得假设固定枚举值）
- 章节结构要求（不得假设固定章节名）

### 3. 已有制品扫描

从步骤 1 提取的制品路径扫描已有场景制品：

```bash
# 查询特定制品关系
artifact-graph query --from <ID>
```

记录：
- 已有制品 ID 列表（用于 ID 唯一性检查）
- 已有制品 status 分布
- 制品文件命名模式

### 4. 关联制品盘点

场景剧本是结构化的发现级场景：时序上先于/驱动 PRD 与功能特性，允许先于功能制品
存在。本步骤盘点图中已有功能特性/决策制品，确定可挂接的关联对象：

```bash
artifact-graph query --from <RELATED_ID>
```

记录每个候选关联 ID 的存在状态；状态取值沿用目标项目的表达。待关联制品暂缺时
不阻塞：如实记录盘点结果（哪些可挂接、哪些暂缺），供 compose 按项目模板约定省略
或标注 `关联功能` 行；不编造 ID。同时记录候选功能制品 frontmatter 的 `scenarios`
字段现状，供 compose 在关联功能存在时建立双向回列。

### 5. 实现状态检查

```bash
artifact-graph validate --root . --warning-only
```

记录：
- validate 警告列表
- 制品链一致性状态

## 输出

inspect 输出供 author、review、repair 流程消费：

```yaml
project:
  root: <项目根目录>
  config_loaded: true | false
artifact_type:
  name: <项目注册的场景剧本类型名>
  registered: true | false
  paths: [<制品路径列表>]
  id_pattern: <ID pattern>
template:
  required_fields: [<从项目模板派生的必填字段>]
  status_enum: [<从项目模板派生的合法状态>]
  sections: [<从项目模板派生的必要章节>]
existing_artifacts:
  - id: <ID>
    path: <文件路径>
    status: <status>
target_artifact:
  id: <ID> | null
  path: <文件路径> | null
  exists: true | false
related:
  artifacts: [{ type, id, status }]
validation:
  warnings: [<警告列表>]
  pass: true | false
```
