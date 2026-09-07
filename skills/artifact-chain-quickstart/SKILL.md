---
name: artifact-chain-quickstart
description: artifact-chain-assistant 插件内的统一路由入口。用户用自然语言描述制品链/artifact-graph 相关需求（如"这个项目的制品链怎么用"、"帮我刷新版本锁"、"这个项目的制品链下一步该做什么"）但不知道用哪个技能时，按确定性路由表推荐正确的入口技能和最小调用提示词。只响应制品链领域信号，不认领无领域限定的裸全局输入。
---

# artifact-chain-quickstart

## 目的

为首次使用 artifact-chain-assistant 或不确定该用哪个技能的用户提供插件内的单一入口。根据用户描述的意图进行自然语言路由，输出目标技能名称、推荐理由和最小调用提示词。

## 职责边界

- **纯路由**：不执行任何写操作或项目分析。
- **不复制技能逻辑**：artifact-chain-quickstart 只做意图判断和路由推荐，不执行被路由技能的任何步骤。
- **不猜测意图**：当用户意图不明确时，输出追问而非猜测路由。

## 路由规则

### 确定性路由表

先按下表对用户输入做意图匹配。表中 `phrase` 是常见中英文自然语言需求的最小覆盖集；
语义相近的输入按同一 `target` 路由。本表与插件安装根下
`$PLUGIN_ROOT/scripts/lib/entry-discovery.mjs` 的权威路由向量一致，由确定性合同测试锁定，
不得手工漂移。这里的 `$PLUGIN_ROOT` 指宿主按安装说明发现的当前插件安装根；artifact-chain-quickstart
只引用该权威源，不执行脚本。

```json quickstart-routing-table
{
  "vectors": [
    { "phrase": "这个项目的制品链怎么用", "lang": "zh", "target": "help" },
    { "phrase": "artifact-chain-assistant 有哪些能力", "lang": "zh", "target": "help" },
    { "phrase": "how does the artifact chain work", "lang": "en", "target": "help" },
    { "phrase": "what can artifact-chain-assistant do", "lang": "en", "target": "help" },
    { "phrase": "我的制品链环境准备好了吗", "lang": "zh", "target": "setup" },
    { "phrase": "帮我检查 artifact-chain 环境", "lang": "zh", "target": "setup" },
    { "phrase": "is my artifact-chain environment ready", "lang": "en", "target": "setup" },
    { "phrase": "帮我初始化这个项目的制品链", "lang": "zh", "target": "setup-then-bootstrap" },
    { "phrase": "怎么开始使用 artifact-chain-assistant", "lang": "zh", "target": "setup-then-bootstrap" },
    { "phrase": "initialize the artifact chain for this project", "lang": "en", "target": "setup-then-bootstrap" },
    { "phrase": "how do i get started with artifact-chain", "lang": "en", "target": "setup-then-bootstrap" },
    { "phrase": "这个项目的制品链下一步该做什么", "lang": "zh", "target": "where-am-i" },
    { "phrase": "这个项目的制品链现在该从哪里入手", "lang": "zh", "target": "where-am-i" },
    { "phrase": "what should i do next with the artifact chain", "lang": "en", "target": "where-am-i" },
    { "phrase": "帮我把这些想法保存到制品链需求池", "lang": "zh", "target": "requirements" },
    { "phrase": "盘点这个项目的制品链已有能力和证据缺口", "lang": "zh", "target": "where-am-i" },
    { "phrase": "更新这条制品链需求的处置和承接位置", "lang": "zh", "target": "requirements" },
    { "phrase": "把这些制品链需求承接到本轮迭代 spec", "lang": "zh", "target": "requirements" },
    { "phrase": "补齐这个存量项目缺少的制品链制品", "lang": "zh", "target": "where-am-i" },
    { "phrase": "按制品链现有契约修复缺陷并保持行为一致", "lang": "zh", "target": "where-am-i" },
    { "phrase": "把大型迁移拆成多批可验收 artifact-chain spec", "lang": "zh", "target": "requirements" },
    { "phrase": "capture these ideas in the artifact-chain requirement pool", "lang": "en", "target": "requirements" },
    { "phrase": "帮我刷新版本锁", "lang": "zh", "target": "maintainer" },
    { "phrase": "refresh the version lock", "lang": "en", "target": "maintainer" },
    { "phrase": "请审阅这个 PRD feature", "lang": "zh", "target": "family-service" },
    { "phrase": "review this design spec", "lang": "en", "target": "family-service" }
  ],
  "targets": {
    "help": { "skill": "artifact-chain-help", "authorizationGate": false },
    "setup": { "skill": "artifact-chain-setup", "authorizationGate": false },
    "setup-then-bootstrap": { "skill": "artifact-chain-bootstrap", "authorizationGate": true },
    "where-am-i": { "skill": "artifact-chain-where-am-i", "authorizationGate": false },
    "requirements": { "skill": "artifact-chain-requirements", "authorizationGate": false },
    "maintainer": { "skill": "artifact-chain-maintainer", "authorizationGate": false },
    "family-service": { "skill": null, "authorizationGate": false }
  }
}
```

**应用规则**：

- 模糊的项目任务（"制品链下一步该做什么"、"制品链该从哪里入手"）路由 `artifact-chain-where-am-i`。
- 收集想法、查询或更新需求、把需求承接到迭代 SPEC 时路由 `artifact-chain-requirements`。收集和只读查询不要求项目先有配置或 Registry。
- 环境诊断（"制品链环境准备好了吗"、"检查 artifact-chain 环境"）路由 `artifact-chain-setup`。
- 写入初始化（"初始化制品链"、"怎么开始使用 artifact-chain-assistant"）先路由
  `artifact-chain-setup`：setup 默认只读诊断，机械安装步骤（装 CLI、装 hooks、注入
  `AGENTS.md` 触发块、`CLAUDE.md` 薄指针）经用户明确确认后由 setup 直接执行；仅当涉及
  项目级配置决策（制品类型裁剪、config 合同内容、版本锁 bootstrap 决策、完整工作法章节）
  时才进入 `artifact-chain-bootstrap`；未获确认不得建议执行任何写操作。
- 无领域限定的裸全局输入（"hello"、"你能做什么"、"怎么开始"）不在本表范围，
  本技能不认领，交由宿主或其他插件处理。
- 表中没有相近意图时，按下述意图规则判断；仍不明确时输出追问，不猜测路由。

### 意图规则

根据用户输入的意图，按以下规则路由：

### 能力说明或功能查询

**匹配关键词**：制品链能做什么、制品链能力、制品链功能、artifact chain、artifact-chain-assistant 能力

**路由目标**：`artifact-chain-help`

**理由**：artifact-chain-help 技能展示标准 Family API Catalog、bundled legacy 方法和采用步骤。

**最小提示词**：`请展示 artifact-chain-assistant 的标准能力和采用步骤。`

### 环境检查或采用状态确认

**匹配关键词**：制品链环境、artifact-chain 环境、版本锁状态、doctor、artifact-graph CLI

**路由目标**：`artifact-chain-setup`

**理由**：artifact-chain-setup 技能默认只读诊断并输出结构化状态报告；机械安装步骤经用户确认后由 setup 执行。

**最小提示词**：`请检查我的环境是否具备使用 artifact-chain-assistant 的条件。`

### 首次初始化或结构修复

**匹配关键词**：初始化制品链、artifact-chain 初始化、bootstrap、配置 artifact-graph、修复制品链配置

**路由目标**：先 `artifact-chain-setup`，机械安装由 setup 经用户确认后执行；需要项目级配置决策时进入 `artifact-chain-bootstrap`

**理由**：先通过 artifact-chain-setup 了解当前状态；装 CLI、装 hooks、注入触发块等机械步骤由 setup 经用户确认后直接完成，制品类型裁剪、config 合同、版本锁决策等需要人工判断的事项再由用户决定是否授权 bootstrap 执行。

**最小提示词**：`请先检查我的环境状态，然后引导我完成项目初始化。`

### 模糊的项目需求或制品定位

**匹配关键词**：制品链下一步、制品在哪、制品定位、当前制品状态、artifact-graph 查询

**路由目标**：`artifact-chain-where-am-i`

**理由**：artifact-chain-where-am-i 搜索项目配置和制品图，输出结构化的项目事实和路由建议。

**最小提示词**：`请分析我的项目当前状态并推荐下一步。`

### 需求收集、更新与迭代承接

**匹配关键词**：保存想法、需求池、更新需求、合并需求、延期需求、迭代 SPEC、大型迁移分批

**路由目标**：`artifact-chain-requirements`

**理由**：该技能在没有制品链配置时也能把想法保存到标准需求目录，并支持查重、处置、跨项目交接和增量 SPEC 验收。

**最小提示词**：`请把这些想法保存到需求池，查找重复项，并把我选中的需求承接到本轮 SPEC。`

### 日常维护、版本锁刷新或 hook 管理

**匹配关键词**：制品链维护、刷新锁、version-lock、hook、refresh the version lock

**路由目标**：`artifact-chain-maintainer`

**理由**：maintainer 技能处理日常维护任务，包括版本锁刷新和 hook 管理。

**最小提示词**：`请帮我执行日常维护任务。`

### 明确的制品制作/审阅/修复任务

**匹配关键词**：制作、审阅、修复、author、review、repair、PRD、scenario、design

**路由目标**：对应的 family/service

**理由**：用户已明确知道要执行的操作，直接路由到对应的专业入口。

**最小提示词**：根据具体任务构造，例如 `请审阅这个 PRD feature 制品。`

### 意图不明确

**行为**：输出追问，不猜测路由。

**追问示例**：
```
您的意图不太明确，请告诉我更多信息：
- 您想了解 artifact-chain-assistant 能做什么？→ 我会路由到 artifact-chain-help
- 您想检查制品链环境是否准备就绪？→ 我会路由到 artifact-chain-setup
- 您想初始化项目的制品链？→ 我会先检查环境；机械安装由 setup 经您确认后执行，项目级配置决策再进 bootstrap
- 您想知道制品链下一步该做什么？→ 我会路由到 artifact-chain-where-am-i
- 您有明确的制品任务？→ 请描述具体操作（制作/审阅/修复）和制品类型
```

## 输出格式

```
## 路由建议

**目标技能**：`artifact-chain-help`
**推荐理由**：您询问的是插件能力，artifact-chain-help 技能展示标准 Family API 和采用步骤。
**最小提示词**：`请展示 artifact-chain-assistant 的标准能力和采用步骤。`

> 直接将最小提示词发送给助手即可启动目标技能。
```

## 安全边界

- artifact-chain-quickstart 本身不执行任何写操作或项目分析。
- 路由推荐基于用户意图的自然语言匹配，不依赖项目状态。
- 当意图匹配多个技能时，输出候选列表和区分标准，由用户选择。
- 当意图超出插件能力范围时，明确说明并建议外部资源。
