---
name: quickstart
description: 不知道用哪个技能、怎么上手时的统一路由入口。用户用自然语言描述需求（如"这个项目的制品链怎么用"、"怎么开始"、"what can this plugin do"）时，按确定性路由表推荐正确的入口技能和最小调用提示词。
---

# quickstart

## 目的

为首次使用 artifact-chain-assistant 或不确定该用哪个技能的用户提供单一入口。根据用户描述的意图进行自然语言路由，输出目标技能名称、推荐理由和最小调用提示词。

## 职责边界

- **纯路由**：不执行任何写操作或项目分析。
- **不复制技能逻辑**：quickstart 只做意图判断和路由推荐，不执行被路由技能的任何步骤。
- **不猜测意图**：当用户意图不明确时，输出追问而非猜测路由。

## 路由规则

### 确定性路由表

先按下表对用户输入做意图匹配。表中 `phrase` 是常见中英文自然语言需求的最小覆盖集；
语义相近的输入按同一 `target` 路由。本表与插件安装根下
`$PLUGIN_ROOT/scripts/lib/entry-discovery.mjs` 的权威路由向量一致，由确定性合同测试锁定，
不得手工漂移。这里的 `$PLUGIN_ROOT` 指宿主按安装说明发现的当前插件安装根；quickstart
只引用该权威源，不执行脚本。

```json quickstart-routing-table
{
  "vectors": [
    { "phrase": "你能做什么", "lang": "zh", "target": "help" },
    { "phrase": "这个插件有哪些能力", "lang": "zh", "target": "help" },
    { "phrase": "这个项目的制品链怎么用", "lang": "zh", "target": "help" },
    { "phrase": "what can this plugin do", "lang": "en", "target": "help" },
    { "phrase": "how does the artifact chain work", "lang": "en", "target": "help" },
    { "phrase": "我的环境准备好了吗", "lang": "zh", "target": "setup" },
    { "phrase": "帮我检查一下环境", "lang": "zh", "target": "setup" },
    { "phrase": "is my environment ready", "lang": "en", "target": "setup" },
    { "phrase": "帮我初始化这个项目", "lang": "zh", "target": "setup-then-bootstrap" },
    { "phrase": "怎么开始使用这个插件", "lang": "zh", "target": "setup-then-bootstrap" },
    { "phrase": "initialize this project", "lang": "en", "target": "setup-then-bootstrap" },
    { "phrase": "how do i get started", "lang": "en", "target": "setup-then-bootstrap" },
    { "phrase": "我下一步该做什么", "lang": "zh", "target": "where-am-i" },
    { "phrase": "这个项目现在该从哪里入手", "lang": "zh", "target": "where-am-i" },
    { "phrase": "what should i do next", "lang": "en", "target": "where-am-i" },
    { "phrase": "帮我刷新版本锁", "lang": "zh", "target": "maintainer" },
    { "phrase": "refresh the version lock", "lang": "en", "target": "maintainer" },
    { "phrase": "请审阅这个 PRD feature", "lang": "zh", "target": "family-service" },
    { "phrase": "review this design spec", "lang": "en", "target": "family-service" },
    { "phrase": "随便看看", "lang": "zh", "target": "ask" },
    { "phrase": "hello", "lang": "en", "target": "ask" }
  ],
  "targets": {
    "help": { "skill": "help", "authorizationGate": false },
    "setup": { "skill": "setup", "authorizationGate": false },
    "setup-then-bootstrap": { "skill": "artifact-chain-bootstrap", "authorizationGate": true },
    "where-am-i": { "skill": "where-am-i", "authorizationGate": false },
    "maintainer": { "skill": "artifact-chain-maintainer", "authorizationGate": false },
    "family-service": { "skill": null, "authorizationGate": false },
    "ask": { "skill": null, "authorizationGate": false }
  }
}
```

**应用规则**：

- 模糊的项目任务（"下一步该做什么"、"该从哪里入手"）路由 `where-am-i`。
- 环境诊断（"环境准备好了吗"、"检查环境"）路由 `setup`。
- 写入初始化（"初始化项目"、"怎么开始使用"）先路由 `setup` 做只读检查，只有在用户
  明确授权后才进入 `artifact-chain-bootstrap`；未获授权不得建议执行任何写操作。
- 表中没有相近意图时，按下述意图规则判断；仍不明确时输出追问，不猜测路由。

### 意图规则

根据用户输入的意图，按以下规则路由：

### 能力说明或功能查询

**匹配关键词**：能做什么、功能、能力、what can、help、capabilities

**路由目标**：`help`

**理由**：help 技能展示标准 Family API Catalog、bundled legacy 方法和采用步骤。

**最小提示词**：`请展示 artifact-chain-assistant 的标准能力和采用步骤。`

### 环境检查或采用状态确认

**匹配关键词**：环境、检查、准备好了吗、状态、setup、ready

**路由目标**：`setup`

**理由**：setup 技能执行只读环境检查并输出结构化状态报告。

**最小提示词**：`请检查我的环境是否具备使用 artifact-chain-assistant 的条件。`

### 首次初始化或结构修复

**匹配关键词**：初始化、初始化项目、bootstrap、设置、configure、init、修复配置

**路由目标**：先 `setup`，经用户授权后进入 `artifact-chain-bootstrap`

**理由**：先通过 setup 了解当前状态，再由用户决定是否授权 bootstrap 执行写入操作。

**最小提示词**：`请先检查我的环境状态，然后引导我完成项目初始化。`

### 模糊的项目需求或制品定位

**匹配关键词**：该做什么、下一步、当前状态、制品在哪、where、定位

**路由目标**：`where-am-i`

**理由**：where-am-i 搜索项目配置和制品图，输出结构化的项目事实和路由建议。

**最小提示词**：`请分析我的项目当前状态并推荐下一步。`

### 日常维护、版本锁刷新或 hook 管理

**匹配关键词**：维护、刷新锁、version-lock、hook、maintain、update

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
- 您想了解这个插件能做什么？→ 我会路由到 help
- 您想检查环境是否准备就绪？→ 我会路由到 setup
- 您想初始化项目？→ 我会先检查环境，再引导 bootstrap
- 您想知道下一步该做什么？→ 我会路由到 where-am-i
- 您有明确的制品任务？→ 请描述具体操作（制作/审阅/修复）和制品类型
```

## 输出格式

```
## 路由建议

**目标技能**：`help`
**推荐理由**：您询问的是插件能力，help 技能展示标准 Family API 和采用步骤。
**最小提示词**：`请展示 artifact-chain-assistant 的标准能力和采用步骤。`

> 直接将最小提示词发送给助手即可启动目标技能。
```

## 安全边界

- quickstart 本身不执行任何写操作或项目分析。
- 路由推荐基于用户意图的自然语言匹配，不依赖项目状态。
- 当意图匹配多个技能时，输出候选列表和区分标准，由用户选择。
- 当意图超出插件能力范围时，明确说明并建议外部资源。
