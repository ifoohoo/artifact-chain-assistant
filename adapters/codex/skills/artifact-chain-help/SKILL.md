---
name: artifact-chain-help
description: 制品链能力说明入口。当用户询问 artifact-chain-assistant 插件能力或 artifact-graph 制品链/版本锁用法（如"这个项目的制品链怎么用"、"artifact-chain-assistant 有哪些能力"）时，展示 artifact-chain-assistant 的标准 Family API、bundled legacy 方法和安装后采用步骤。Registry 或专业 family 实现未安装时仍可用，诚实显示静态标准能力与尚不可执行的服务。
---

# artifact-chain-help

## 目的

轻量展示 artifact-chain 生态的可用标准能力，帮助用户了解安装后可以使用哪些技能族和服务。本技能只做安全渲染，不做项目生命周期判断。

## 职责边界

- **渲染静态 Family API Catalog**：从 `family-apis/catalog.json` 读取标准 family 和 service 定义，即使实现未安装也可见。
- **展示 bundled legacy 方法**：从 `families-src/*/implementation.yaml` 读取已有的 bundled family 迁移样本，诚实标记 `targetApiStatus: pending`。
- **动态 projection 当前 fail-closed**：Registry v2 verifier 尚未接入时，无论是否提供 projection 都只显示 `NOT_AVAILABLE / REGISTRY_V2_REQUIRED`。
- **不读取第三方 `SKILL.md`**：不解析项目 sources/bindings，不自行计算 provider 状态。
- **不猜测安装/启用/信任状态**：没有 projection 时不输出 `NOT_INSTALLED` 或 `ENABLED`。

## 渲染内容

### 1. Standard Family API

从 Family API Catalog 渲染所有已发布的标准 family：

```
## Standard Family API

| Family | Major | Services | Summary |
|--------|-------|----------|---------|
| artifact.e2e-test-family | 1 | default, help, author, review, repair | E2E Test Skill Family |

### artifact.e2e-test-family@1

Standard skill family for authoring, reviewing, and repairing E2E test specification artifacts.

**Services:**
- `default` (required, workflow) — Default route entry
- `help` (required, operation) — Help and capability overview
- `author` (required, workflow) — Author E2E test specs from feature/scenario artifacts
- `review` (required, operation) — Review E2E test specifications
- `repair` (required, workflow) — Repair E2E test specs based on review findings

**Artifact Contracts:** artifact.e2e-test@1；feature/scenario 输入仍以版本化 protocol ref 表达
**Side-effect ceiling:** write-authorized-artifacts (author/repair), write-review-result (review)
**Mix-safe:** No (default whole-family atomic binding)
```

### 2. Bundled Legacy Methods

从 `families-src/*/implementation.yaml` 渲染现有 bundled family：

```
## Bundled Legacy Methods

These bundled families predate the standard Family API system.
They are recorded as migration samples and will be migrated to formal Family API conformance.

### prd-feature (bundled-stable)
- Status: targetApiStatus: pending (no published Family API)
- Services: default, author, review, repair
- Note: Does NOT claim Family API conformance

### scenario-script (bundled-stable)
- Status: targetApiStatus: pending (no published Family API)
- Services: default, author, review, repair
- Note: Does NOT claim Family API conformance
```

### 3. Installation Status

```
## Installation Status

Registry projection: NOT_AVAILABLE (REGISTRY_V2_REQUIRED)
(Dynamic state is unavailable until the authoritative Registry v2 verifier is integrated.)
```

即使 projection 文件自称已校验，也不得由 assistant 直接渲染。后续只能消费 Registry v2 verifier 的权威结果。

## 采用步骤

```
## Getting Started

1. **Learn**: Review the Standard Family API above to understand available capabilities.
2. **Check**: Run `artifact-chain-setup` (read-only diagnosis by default) to verify the environment; it can also execute mechanical install steps — CLI install, Git hooks, the minimal `AGENTS.md` trigger block — after your explicit confirmation.
3. **Bootstrap**: Run `artifact-chain-bootstrap` for project-level configuration decisions (artifact type trimming, config contract, version-lock decisions) only after the user explicitly authorizes it.
4. **Capture**: Run `artifact-chain-requirements` to save, query, merge, defer, reject, or carry requirements into an incremental SPEC. Capturing and querying work before project config or Registry exists.
5. **Orient**: Run `artifact-chain-where-am-i` to inventory current capabilities or locate a concrete task.
6. **Adopt**: Follow artifact-chain-where-am-i recommendations to adopt specific families and services.
```

## 从需求到交付的公开分工

- **技能负责工作方法**：`artifact-chain-requirements` 保存原始诉求、处置与 SPEC 承接；`artifact-chain-where-am-i` 盘点和定位；制作、审阅、修复技能根据可执行 profile 工作。
- **artifact-graph CLI 负责确定性图操作**：用 `artifact-graph query --from <type>:<id>` 查询关系，用 `artifact-graph context --target <type>:<id> --mode implementation` 组装上下文，用 `artifact-graph validate --root <root> --warning-only` 检查图。
- **Node API 负责程序化组合**：从 `artifact-graph` 导入 `loadConfig`、`scanArtifacts` 与 `queryGraph`，读取项目配置后扫描，再按 `{ from: '<type>:<id>', schema }` 查询；调用方负责展示或消费结果。
- **测试与 E2E 负责行为验证**：测试文件或 `verifies` 声明只表明验证意图；只有实际运行结果或验收记录能证明验证事实。
- **目标项目的发布工具负责发布**：插件不代替 npm、GitHub、应用商店或部署系统。发布事实必须引用工具结果和精确版本。

环境问题用 `artifact-chain-setup` 和 `artifact-graph doctor`；图关系与覆盖健康用 `artifact-audit`。批准、实现、验证、发布四类事实分别给证据，缺证据时显示 `unknown`。

## Registry 不可用时的诚实降级

Registry、effective index 或 method binding 缺失时，本技能仍可执行，并按以下规则降级：

- 静态能力照常渲染：Standard Family API Catalog 与 Bundled Legacy Methods 来自插件自带
  文件，不依赖 Registry。
- Installation Status 显示 `NOT_AVAILABLE (REGISTRY_V2_REQUIRED)`，不把任何服务报告为
  已安装、已启用或已验证。
- 明确列出当前尚不可执行的标准服务及原因：contract-backed 专业服务解析、动态 projection
  状态均需要 Registry v2 verifier，缺失时只说明不可执行，不猜测状态。
- 不因部分服务缺失而拒绝整个入口；不虚报、不伪造 binding。

## 故障诊断

- 如果 Family API Catalog 缺失或格式错误：检查 `family-apis/catalog.json` 是否存在于插件安装目录。
- 如果 bundled 方法不显示：检查 `families-src/*/implementation.yaml` 是否存在。
- 如果 registry 状态为 `NOT_AVAILABLE / REGISTRY_V2_REQUIRED`：等待或安装提供权威 projection verifier 的 Registry v2；不要信任手写状态文件。
