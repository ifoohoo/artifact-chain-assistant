---
name: help
description: 展示 artifact-chain-assistant 插件的标准 Family API、bundled legacy 方法和安装后采用步骤。安装后即使专业 family 实现未安装，用户也能看见标准能力。
---

# help

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
2. **Bootstrap**: Run `artifact-chain-bootstrap` (with user authorization) to set up your project.
3. **Orient**: Run `where-am-i` to get project-specific recommendations based on your current state.
4. **Adopt**: Follow where-am-i recommendations to adopt specific families and services.
```

## 故障诊断

- 如果 Family API Catalog 缺失或格式错误：检查 `family-apis/catalog.json` 是否存在于插件安装目录。
- 如果 bundled 方法不显示：检查 `families-src/*/implementation.yaml` 是否存在。
- 如果 registry 状态为 `NOT_AVAILABLE / REGISTRY_V2_REQUIRED`：等待或安装提供权威 projection verifier 的 Registry v2；不要信任手写状态文件。
