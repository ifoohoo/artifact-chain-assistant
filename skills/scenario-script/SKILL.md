---
name: scenario-script
description: Use when a user wants to write, review, or repair a scenario-script artifact for an artifact-graph project, routing to the appropriate sub-flow based on intent.
---

# scenario-script

## 目的

为场景剧本制品提供编写、审阅和修复的统一入口。根据用户意图路由到对应的子流程，实现场景剧本从起草到终态的完整闭环。

## 路由决策树

根据用户意图选择进入点：

### 路由到 author

- 用户要求"编写""起草""新建""创建"场景剧本
- 用户提供了业务目标或需求描述，需要从零产出制品
- 项目尚无对应场景剧本，需要初始化

### 路由到 review

- 用户要求"审阅""检查""审查""评估"已有场景剧本
- 用户提供了场景剧本文件路径或 ID
- author 流程完成后的质量验收

### 路由到 repair

- review 产生了 findings 需要修复
- 用户明确要求"修复""修正""改进"某个场景剧本
- 前一轮 review 输出了 repair_entry 建议

## 流程闭环规则

一旦进入子流程，该流程必须自行完成闭环。上层规划器不得另拆 review/repair 步骤：

1. **author 流程**：inspect → compose → validate → review。若 review 产生 findings，进入 repair → re-review 循环，直至终态 verdict（`pass`/`warning`/`BLOCKED`/`NEEDS_INPUT`）。
2. **review 流程**：inspect → review。若存在可修 findings 且非只读模式，进入 repair → re-review 循环直至终态；若只读审阅或用户明确禁止修改，输出 findings 与 repair_entry 后终止，并明确受用户约束。
3. **repair 流程**：基于 review 的 findings 修复 → re-review 确认终态（或 `BLOCKED`/`NEEDS_INPUT`）。

## 输出契约

### 默认入口输出

路由结果必须包含：
- `target_flow`：`author` | `review` | `repair`
- `reason`：路由理由（一句话）
- `artifact_id`：目标制品 ID（若已知）
- `artifact_path`：目标制品路径（若已知）

### 子流程输出

各子流程遵循各自的输出契约，详见：
- `author/SKILL.md`：author 输出契约
- `review/SKILL.md`：review 输出契约（含 machine-readable verdict/findings）
- `repair/SKILL.md`：repair 输出契约（含 re-review 终态）

## 通用质量维度

场景剧本是结构化的发现级场景：时序上先于、并驱动 PRD 与功能特性——场景是需求发现的载体，功能特性是场景的派生物；表达形式是结构化的（字段块 + Given/When/Then），作为实现与验收的依据。一个文件可含多个场景节点。具体字段、ID 格式、status 枚举、章节结构必须从目标项目的 artifact-graph.config.yaml、同类制品、项目模板和治理文档中派生：

- **节点结构**：主场景 `## S-NN：<名>`（H2），变体 `### S-NNa：<名>`（H3，字母后缀）；编号匹配 `^S-\d+[a-z]?$`，允许前导零；冒号半/全角由项目模板统一。节点标题是制品图的解析锚点（CLI 按 `^#{2,3}\s+(S-\d+[a-z]?)\s*[:：]` 识别节点，H2/H3 均可），不得随意变更形式。
- **字段块完整性**：节点标题下是加粗字段块——`**关联功能**` 与 `**关联决策**` 是机器锚点、必需（CLI 从含"关联功能/关联决策"字样的行内提取 ID 成边）；`**场景代码**` 是稳定交叉引用 slug、推荐。字段集允许项目模板扩展（如入口编号），技能族只强制上述三项。
- **Given/When/Then 可验证性**：`### Given` 写可构造的具体前置状态；`### When` 写用户或外部动作，编号步骤；`### Then` 写可观察、可验证的结果（输出、退出码、状态、记录）。小节标题形式从项目模板派生。
- **变体覆盖**：关键分支、边界、异常写成紧随主场景的变体节点，复用主场景语境、只写差异，每个变体同样声明字段块。
- **追溯一致（暂缺不判 fail）**：场景允许先于功能制品存在——发现级场景尚未挂接功能时，按项目模板约定处理 `关联功能` 行（省略或标注"尚无功能制品"），如实报告，不编造 ID，不判 fail；关联功能存在时，`关联功能` 只引用图中已存在的功能 ID，且功能制品 frontmatter 的 `scenarios` 字段必须回列本场景（双向一致，CLI 校验强制）。CLI 的 `ORPHAN_SCENARIO` 是对无功能关联场景的 warning、不阻断（exit 0）：发现级场景下该警告属预期，review 可按 warning 接受，不强制消灭。注意：场景→决策边只对 `D-XXX-数字` 形式的决策 ID 成边（CLI 硬编码），`ADR-\d{4}` 类编号只做文档级追溯，不得承诺其成边。
- **语体**：写可构造的状态、具体的动作、可观察的事实；不写口号、不写宣传、不写设计理由。场景正文不得出现机器私有路径：用项目相对路径或占位符表达。检查和验证细则见 `references/inspect.md` 与 `references/validate.md`；去 AI 味行文规则见 `references/writing-style.md`；项目无模板时的默认格式见 `references/compose.md` 与 `references/default-template.md`。

## 技能协作边界

- 本技能族只处理场景剧本制品，不处理 PRD 功能特性、设计文档或其他类型
- author 闭环包含 review 步骤，不依赖上层规划器拆出 review
- repair 必须基于 review 的 findings 执行，不凭空修改
- 修复后必须 re-review 确认终态，不跳过终态验证
- 所有项目专属配置（路径、字段、ID pattern、status、章节结构）从目标项目派生，不硬编码
