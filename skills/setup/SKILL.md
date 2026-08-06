---
name: setup
description: 只读环境检查：插件闭包完整性、Node/CLI 可用性、doctor 诊断、项目 config、版本锁和 registry 可用性。输出结构化状态报告和精确下一步。
---

# setup

## 目的

在不写入任何内容的前提下，检查当前环境是否具备使用 artifact-chain-assistant 的条件。每项检查输出 PASS/WARN/FAIL 状态和精确诊断信息，最终汇总为结构化状态报告和推荐的下一步操作。

## 职责边界

- **只读**：不写配置、不装 hook、不刷新/建立版本锁、不修改任何文件。
- **路由写入**：当检查发现需要写入操作时，明确路由到 `artifact-chain-bootstrap` 并说明原因。
- **不复制 bootstrap 逻辑**：setup 只做检查和报告，不复制 bootstrap 的任何写入步骤。
- **不猜测状态**：只报告可直接验证的事实，不推断项目生命周期或技能启用状态。

## 检查序列

按以下顺序执行七项只读检查：

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
  `artifactGraph.installSpec`，附加 `pnpm add -D <installSpec>` 精确修复建议；不得手写或猜测版本

### 4. Doctor 诊断

执行 `artifact-graph doctor --format json`，解析输出。

**输出**：
- exit 0 且输出有效 → `PASS: doctor 诊断通过`
- exit 非 0 → `WARN: doctor 报告问题`，附加诊断详情和修复建议
- 命令不存在 → `SKIP: artifact-graph CLI 不可用`

### 5. 项目 config 存在性

检查当前工作目录或项目根目录下 `artifact-graph.config.yaml` 是否存在。

**输出**：
- 存在 → `PASS: 项目 config 已配置`
- 不存在 → `WARN: 项目 config 不存在`，附加最小 config 示例和路由建议：`需要写入时请运行 artifact-chain-bootstrap`

### 6. 版本锁存在性

检查 `artifacts/traceability-version-lock.json` 是否存在。

**输出**：
- 存在 → `PASS: 版本锁已建立`
- 不存在 → `WARN: 版本锁不存在`，附加路由建议：`需要建锁时请运行 artifact-chain-bootstrap`

### 7. Registry CLI 可用性

检查 `agent-method-registry` CLI 是否可用（在 `node_modules/.bin/` 或 PATH 中）。

**输出**：
- 可用 → `PASS: agent-method-registry CLI 可用`
- 不可用 → `WARN: agent-method-registry CLI 不可用（contract-backed 服务解析将返回 NEEDS_INPUT）`

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

- 项目 config 和版本锁尚未建立。运行 `artifact-chain-bootstrap`（需用户授权）来初始化项目。
- Registry CLI 不可用。contract-backed 服务解析将返回 NEEDS_INPUT；可选安装 `agent-method-registry`。

## 状态摘要

- **可直接使用的能力**：help（只读能力查询）、where-am-i（只读项目分诊）
- **需要初始化后使用的能力**：bootstrap、maintainer、family/service（需要项目 config）
```

## 安全边界

- 所有检查均为只读，不产生副作用。
- 未获得用户明确授权时，不执行任何写入操作。
- 需要写入时，输出明确的路由建议并说明原因，由用户决定是否执行。
