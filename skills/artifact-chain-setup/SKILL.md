---
name: artifact-chain-setup
description: 制品链环境诊断与安装入口。当用户询问 artifact-chain/artifact-graph 制品链环境是否就绪（如"我的制品链环境准备好了吗"、"帮我检查 artifact-chain 环境"）或要求安装制品链机械组件时，先只读检查插件闭包完整性、Node/CLI 可用性、doctor 诊断、项目 config、版本锁和 registry 可用性，输出逐项 PASS/WARN/FAIL 状态报告与机械安装计划；经用户明确确认后执行机械安装步骤（安装 artifact-graph CLI、安装/更新 Git hooks、注入 AGENTS.md 极简触发块、建立 CLAUDE.md 薄指针）并复验。Registry 缺失时降级可用，诚实列出尚不可执行的标准服务。
---

# artifact-chain-setup

<!-- @scenario S-87 @feature ACA21 @decision D-ACA-31 -->

## 目的

按"只读诊断 → 输出计划 → 询问用户 → 授权执行 → 复验"五段式工作：先只读检查当前环境是否具备使用 artifact-chain-assistant 的条件，每项检查输出 PASS/WARN/FAIL 状态和精确诊断信息；再根据诊断结果输出机械安装计划，经用户明确确认后执行机械安装步骤，最后重跑诊断复验。

## 职责边界

- **默认只读**：诊断阶段不写配置、不装 hook、不刷新/建立版本锁、不修改任何文件。
- **授权执行**：机械安装步骤（见"机械安装计划与授权执行"）必须先展示计划并获得用户明确授权后才执行。当前任务已经明确授权同一目标和动作时直接沿用，不重复询问；目标、动作、覆盖范围或外部影响扩大时重新确认。禁止用户无感的自主安装与覆盖安装。
- **幂等**：所有安装步骤可安全重跑；已存在的目标跳过，内容过时的既有块报告差异交用户裁决，不擅自覆盖。
- **复验**：写入完成后重跑只读诊断，报告前后状态对比。
- **路由项目级决策**：制品类型裁剪、`artifact-graph.config.yaml` 合同内容、版本锁 bootstrap 决策、完整工作法章节等需要人工判断的事项，明确路由到 `artifact-chain-bootstrap` 并说明原因。
- **不复制 bootstrap 逻辑**：artifact-chain-setup 只做诊断、计划与机械安装，不复制 bootstrap 的项目级配置决策步骤。
- **不猜测状态**：只报告可直接验证的事实，不推断项目生命周期或技能启用状态。doctor 诊断环境与运行依赖；图关系和覆盖健康另行交给 `artifact-audit`。
- **分开报告采用状态**：当前版本兼容时说明可以保持不变；存在兼容的新版本时列为可选升级；当前版本缺失或不兼容时才列为必须调整。配置和依赖就绪不等于图健康、技能族规范通过或发布就绪。

## 检查序列

先按已安装 adapter 的 `INSTALL.md` 宿主发现流程解析并导出 `PLUGIN_ROOT`。后续路径都以
当前插件安装根为基准，不以目标项目或调用者的工作目录为基准。

按以下顺序执行七项只读检查。该检查序列的唯一产品实现是插件的
`$PLUGIN_ROOT/scripts/setup-checks.mjs`（产品自持确定性执行器）：宿主与测试都应执行该脚本
（`node "$PLUGIN_ROOT/scripts/setup-checks.mjs" --install-root "$PLUGIN_ROOT" --project-root <项目根> --format json`），
不得在测试或宿主侧重复实现第二份 artifact-chain-setup 业务逻辑。

### 1. 插件闭包完整性

检查插件安装目录中以下路径是否存在且为常规文件/目录：

| 检查项 | 路径 | 说明 |
|--------|------|------|
| 技能目录 | `skills/` | 当前宿主已安装的技能目录 |
| Family API 目录 | `family-apis/` | 标准 Family API 定义 |
| 脚本目录 | 插件根的 `scripts` 子目录 | 辅助脚本 |
| 兼容性文件 | `compatibility.json` | 运行时版本兼容声明 |
| Catalog 文件 | `agent-methods/catalog.yaml` | 方法注册目录 |

**输出**：
- 全部存在 → `PASS: 插件闭包完整`
- 缺失项 → `FAIL: 缺失 <路径>`，列出每个缺失路径

### 2. Node.js 可用性

执行 `node --version`，检查是否可用及版本。

**输出**：
- 可用 → `PASS: Node.js <版本>`
- 不可用 → `FAIL: Node.js 未找到`

### 3. artifact-graph CLI 可用性

执行 `artifact-graph --help`，检查 CLI 是否在 PATH 中。

**输出**：
- 可用 → `PASS: artifact-graph CLI 可用`
- 不可用 → `FAIL: artifact-graph CLI 未找到`，读取插件根 `compatibility.json` 的
  `artifactGraph.installSpec`，把 `pnpm add -D <installSpec>` 列入机械安装计划第 1 步候选；
  不得手写或猜测版本

### 4. Doctor 诊断

执行 `artifact-graph doctor --format json`。本检查项涉及**两个独立合同**，必须分开裁决，
不得互相替代：

1. **结构化检查项状态**：doctor JSON 输出的 `nativeBinding` 对象
   （`ok` / `cause` / `failedStage` / `suggestion`）。这是原生绑定检查项的裁决依据。
2. **进程退出码**：doctor 采用 fail-closed 口径（S-94/ACA8），任一检查项失败即退出非零。
   退出码只表达"至少存在一个问题"，不表达"是哪类问题"。

artifact-chain-setup 不从退出码推断故障类型。只要 stdout 能解析为 JSON，就必须读取
`nativeBinding` 结构化字段做独立裁决。

**输出**：

- 命令不存在 → `SKIP: artifact-graph CLI 不可用`（由检查项 3 决定）
- stdout 可解析为 JSON 且 `nativeBinding.ok === false` → **独立 FAIL**，按 `cause` 逐类输出，
  附 `suggestion`，不得因退出码形态降级为 WARN：

  | cause | 独立 FAIL 输出 |
  |-------|----------------|
  | `MISSING` | `FAIL: 原生绑定缺失（better-sqlite3 未安装或未解析到所选安装）` |
  | `ABI_MISMATCH` | `FAIL: 原生绑定与当前 Node ABI 不匹配` |
  | `BUILD_DISABLED` | `FAIL: lifecycle scripts 被禁或原生产物未构建` |
  | `LOAD_ERROR` | `FAIL: 原生绑定加载失败（未知原生错误）` |

- stdout 可解析为 JSON 且 `nativeBinding.ok === true`：
  - 退出码为 0 且无其他警告 → `PASS: doctor 诊断通过`
  - 退出码非 0 或存在其他警告 → `WARN: native binding 通过，但 doctor 报告其他问题`，附警告详情
  - 退出码为 0 但 `nativeBinding.ok === false` 属合同违例：仍按上一条独立 FAIL 输出，并标注不一致
- stdout 可解析为 JSON 但缺少 `nativeBinding` 字段 → `WARN: doctor 输出缺少 nativeBinding 字段`
- stdout 无法解析为 JSON → `WARN: doctor 输出无法解析`，附原始输出片段与退出码

### 5. 项目 config 存在性

检查当前工作目录或项目根目录下 `artifact-graph.config.yaml` 是否存在。

**输出**：
- 存在 → `PASS: 项目 config 已配置`
- 不存在 → `WARN: 项目 config 不存在`，附加最小 config 示例和路由建议：`config 合同内容属项目级决策，请运行 artifact-chain-bootstrap`

### 6. 版本锁存在性

检查 `artifacts/traceability-version-lock.json` 是否存在。

**输出**：
- 存在 → `PASS: 版本锁已建立`
- 不存在 → `WARN: 版本锁不存在`，附加路由建议：`建锁决策属项目级判断，请运行 artifact-chain-bootstrap`

### 7. Registry CLI 可用性

检查 `agent-method-registry` CLI 是否可用（在 `node_modules/.bin/` 或 PATH 中）。

**输出**：
- 可用 → `PASS: agent-method-registry CLI 可用`
- 不可用 → `WARN: agent-method-registry CLI 不可用（contract-backed 服务解析将返回 NEEDS_INPUT）`

## 机械安装计划与授权执行

诊断完成后，根据检查结果发现的问题组装机械安装计划。计划中的每一步都是无项目级判断含量的机械操作；需要人工判断的事项（制品类型裁剪、config 合同内容、版本锁 bootstrap、完整工作法章节）不进入本计划，路由到 `artifact-chain-bootstrap`。

### 计划步骤清单

1. **安装 artifact-graph CLI**（对应检查项 3 FAIL）：在目标项目执行
   `pnpm add -D <compatibility.json 的 artifactGraph.installSpec>`。版本只允许从
   `compatibility.json` 读取，不得手写或猜测。
2. **安装/更新 Git hooks**（用户要求或诊断确认 CLI 可用后）：在目标项目执行
   `artifact-graph hooks install-git --hook all`。安装器自身是幂等的事务式 patch；
   若既有 hook 为非 shell 或符号链接导致拒绝，如实报告并交用户裁决。
3. **注入 `AGENTS.md` 极简触发块**（目标项目有 `AGENTS.md` 且缺少 Artifact Chain 指引时）：
   幂等 patch——块已存在且内容一致则跳过；块已存在但内容过时时报告差异交用户裁决，不擅自覆盖。
   触发块内容固定为：

   ```markdown
   ## Artifact Chain
   本项目使用 artifact-graph + artifact-chain-assistant 管理制品链。
   涉及需求、设计、决策、评审、测试等制品工作时，先调用 artifact-chain-quickstart 获取路由；
   不确定项目当前状态时用 artifact-chain-where-am-i；能力详情见 artifact-chain-help。
   ```
4. **`CLAUDE.md` 薄指针**（目标项目使用 Claude Code 时）：确保 `CLAUDE.md` 为指向
   `AGENTS.md` 的薄指针；已存在则幂等跳过或报告差异，不覆盖既有内容。

### 执行纪律

- **先计划后核对授权**：把计划以"步骤 + 确切命令/patch 内容 + 目标文件"的形式展示给用户。若当前任务已明确授权完全相同的目标和动作，直接执行；否则等待明确确认。未获所需授权不得写入任何内容。
- **禁止自主安装与覆盖安装**：必须先具备上述明确授权，再执行计划中的写入。
- **幂等重跑**：每个步骤重复执行必须安全；已有正确内容时输出 SKIP 而非重复写入。
- **复验**：全部已确认步骤执行完后，重跑"检查序列"的诊断，报告前后状态对比。
- **失败关闭**：任一步骤失败即停止后续写入步骤，报告已完成项与失败原因，由用户决定修复或回退。
- **版本建议分级**：兼容版本说明“保持当前版本”，兼容的新版本说明“可选升级”，缺失或不兼容版本说明“必须调整”；不得把可选升级写成安装前提。

写入动作由本技能引导用户确认后，用包管理器命令、`artifact-graph hooks install-git` 与幂等文件 patch 完成；`$PLUGIN_ROOT/scripts/setup-checks.mjs` 保持只读诊断器定位，不承担任何写入。

## 输出格式

```
## 环境检查报告

| # | 检查项 | 状态 | 详情 |
|---|--------|------|------|
| 1 | 插件闭包完整性 | PASS | 全部路径存在 |
| 2 | Node.js | PASS | v20.11.0 |
| 3 | artifact-graph CLI | PASS | 可用 |
| 4 | Doctor 诊断 | PASS | 诊断通过 |
| 5 | 项目 config | WARN | 不存在 |
| 6 | 版本锁 | WARN | 不存在 |
| 7 | Registry CLI | WARN | 不可用 |

## 推荐下一步

- 项目 config 和版本锁尚未建立。config 合同内容与建锁决策属项目级判断，运行 `artifact-chain-bootstrap`（需用户授权）来初始化项目。
- Registry CLI 不可用。contract-backed 服务解析将返回 NEEDS_INPUT；可选安装 `agent-method-registry`。

## 机械安装计划（待用户确认）

| # | 步骤 | 命令/patch | 目标 |
|---|------|-----------|------|
| 1 | 安装 artifact-graph CLI | `pnpm add -D <compatibility.json 的 artifactGraph.installSpec>` | 目标项目 package.json |
| 2 | 安装 Git hooks | `artifact-graph hooks install-git --hook all` | Git 解析的 hooks 目录 |
| 3 | 注入 Artifact Chain 触发块 | 幂等 patch（已存在则跳过，过时则报差异） | 目标项目 `AGENTS.md` |
| 4 | 建立薄指针 | 幂等 patch（已存在则跳过，过时则报差异） | 目标项目 `CLAUDE.md` |

> 确认后我将按序执行并在完成后复验；任一失败即停止并报告。

## 状态摘要

- **可直接使用的能力**：artifact-chain-help（只读能力查询）、artifact-chain-where-am-i（只读项目分诊）、artifact-chain-requirements（无配置也能收集或查询需求）
- **需要初始化后使用的能力**：bootstrap、maintainer、family/service（需要项目 config）
```

## Registry 缺失时的降级输出

Registry CLI、effective index 或 method binding 缺失不阻断本入口：其余检查项照常输出
PASS/WARN/FAIL，并在状态摘要中追加一段诚实降级说明：

```
## 尚不可执行的标准服务（Registry 缺失）

| 服务 | 原因 |
|------|------|
| contract-backed 专业服务解析 | 需要 agent-method-registry 提供权威 binding |
| 动态 projection 状态渲染 | 需要 Registry v2 verifier，当前只能显示 NOT_AVAILABLE |

可选修复：安装 `agent-method-registry` 后重跑 artifact-chain-setup。修复前上述服务保持不可执行，
不得报告为可用。
```

- 不虚报不可用服务为可用，也不因部分服务缺失而拒绝整个入口。
- 降级说明只陈述事实与修复路径，不执行任何安装或写入。

## 安全边界

- 诊断阶段所有检查均为只读，不产生副作用。
- 未获得用户明确确认时，不执行任何写入操作；写入仅以用户确认为事务边界。
- 安装步骤幂等：已有正确内容跳过，既有内容过时报差异交用户裁决，不擅自覆盖。
- 需要项目级人工判断时，输出明确的 bootstrap 路由建议并说明原因，由用户决定是否执行。
