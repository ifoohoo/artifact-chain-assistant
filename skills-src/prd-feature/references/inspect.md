# prd-feature inspect

内部工序，不作为 catalog 入口。

## 目的

在编写或审阅 PRD 功能特性制品前，收集项目配置、已有制品、关联关系和实现状态的证据。

## 步骤

### 1. 项目配置发现

```bash
# 确认项目根目录
git rev-parse --show-toplevel

# 读取 artifact-graph 配置
cat artifact-graph.config.yaml

# 确认 CLI 能力
artifact-graph --help
```

提取：
- PRD 对应的注册类型名、paths、target 与对应 `idPatterns`（如有）
- 项目模板、`artifacts/README.md`、`AGENTS.md`/`CLAUDE.md` 中的本地规则
- 项目注册的关联类型与同类制品实际使用的关联字段

### 2. 已有制品扫描

从步骤 1 提取的 PRD 注册类型 paths 扫描已有制品：

```bash
# 查询特定制品关系
artifact-graph query --from <ID>
```

记录：
- 已有制品 ID 列表（用于 ID 唯一性检查）
- 已有制品 status 分布
- 制品文件命名模式

### 3. 关联制品可达性

对项目配置、模板或同类制品声明的每个关联 ID：

```bash
artifact-graph query --from <RELATED_ID>
```

记录每个关联 ID 的存在状态；状态取值沿用目标项目的表达。

### 4. 实现状态检查

```bash
artifact-graph context --target <type>:<ID> --mode implementation
artifact-graph validate --root . --warning-only
```

记录：
- 实现文件列表
- validate 警告列表
- 追溯注释存在性

## 输出

inspect 输出供 author、review、repair 流程消费：

```yaml
project:
  root: <项目根目录>
  config_loaded: true | false
artifact_type:
  name: <项目注册的 PRD 类型名>
  registered: true | false
  paths: [<制品路径列表>]
  id_pattern: <ID pattern>
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
implementation:
  files: [<实现文件列表>]
  trace_comments: [<追溯注释列表>]
```
