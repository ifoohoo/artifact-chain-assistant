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
- 无新增孤立制品错误；`ORPHAN_SCENARIO`（场景无功能关联）是 warning、不阻断
  （exit 0），发现级场景尚未挂接功能时该警告属预期，如实记录即可，不强制消灭
- 无新增关联引用警告（引用了图中不存在的 ID 必须处理）
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

- 每个节点字段块齐全：`关联功能`/`关联决策`（机器锚点、必需）、`场景代码`（推荐）；
  项目扩展字段符合项目模板
- 能定位 Given/When/Then（小节标题形式服从项目模板）
- Given 是可构造的具体前置状态；When 是编号步骤的具体动作
- Then 是可观察、可验证的结果（输出、退出码、状态、记录），无口号、无模糊词
- 关键分支、边界、异常有变体节点覆盖，变体同样声明字段块
- 语体为结构化验收场景：无宣传收束、无空洞词；按密度原则判断，不误伤正常表达
  （行文规则见 `writing-style.md`）
- 词汇可懂性：正文通过"外行三问"，内部动词未裸用，术语首现有解释，slug 只在字段块
  （检查法见 `writing-style.md` 的"词汇可懂性纪律"节）
- 正文无机器私有路径：路径用项目相对形式或占位符
- 追溯一致：`关联功能` 只引用图中已存在的 ID，无编造关联；关联功能存在时，功能制品
  frontmatter 的 `scenarios` 回列本场景；功能制品暂缺时 `关联功能` 行按项目模板约定
  省略或标注，属可接受的发现级暂态，不判 fail

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
  field_block: present | missing
  given_when_then: present | missing
  variant_coverage: present | missing
  # 关联功能暂缺（发现级暂态）记 pending 而非 inconsistent
  traceability: consistent | inconsistent | pending
  style: present | missing
```
