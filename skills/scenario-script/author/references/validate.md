# scenario-script validate

内部工序，不作为 catalog 入口。

## 目的

在 author 或 repair 完成后，验证场景剧本制品的结构完整性和制品链一致性。

## 步骤

### 1. 制品链验证

```bash
artifact-graph validate --root . --warning-only
```

检查：
- 无新增孤立制品警告
- 无新增关联引用警告
- 新制品已正确参与图遍历

### 2. 项目规范完整性

按项目配置、模板、治理文档和同类制品检查 frontmatter、ID、状态与正文结构；不要假设固定字段或枚举。

### 3. ID 唯一性

从项目配置中派生制品扫描路径，确认新制品的 ID 不与已有制品冲突。

### 4. 关联可达性

对项目规则声明的关联字段中的每个 ID：

```bash
artifact-graph query --from <ID>
```

确认关联制品在图中存在。

### 5. 场景质量基本检查

- 能定位角色与目标、前置条件、主路径和可观察结果（章节名服从项目模板）
- 关键异常路径得到覆盖
- 步骤与结果可验证，不依赖模糊表述

## 输出

validate 输出供 review 和 repair 消费：

```yaml
validation:
  artifact_id: <ID>
  artifact_path: <文件路径>
  issues:
    - code: <问题代码>
      severity: error | warning | info
      message: <问题描述>
      location: <文件路径>:<行号>
  pass: true | false
  chain_check:
    validate_output: <artifact-graph validate 关键输出>
    related_check:
      - id: <关联 ID>
        exists: true | false
quality_dimensions:
  role_and_goals: present | missing
  preconditions: present | missing
  main_path: present | missing
  exception_paths: present | missing
  observable_results: present | missing
  traceability: present | missing
```
