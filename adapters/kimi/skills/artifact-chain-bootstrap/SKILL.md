---
name: artifact-chain-bootstrap
description: Use when a target project is adopting artifact-chain-assistant, after reading INSTALL.md, or when making project-level configuration decisions — artifact type trimming, artifact-graph.config.yaml contract content, version-lock bootstrap decisions, and full project workflow sections in AGENTS.md/CLAUDE.md. Mechanical install steps (CLI install, Git hook install, minimal AGENTS.md trigger block) belong to artifact-chain-setup (D-ACA-31).
---

# artifact-chain-bootstrap

<!-- @scenario S-07 @feature ACA6 -->

## Purpose

Guide a target project through first-time artifact-chain setup. This skill is opt-in: use it for
initialization, migration, or repair of project setup, not for routine feature work.

## Non-Negotiables

- Do not move project artifacts into the plugin.
- Do not hard-code machine-local CLI paths.
- Do not overwrite existing `AGENTS.md`, `CLAUDE.md`, or `artifact-graph.config.yaml`; patch them.
- Do not run `artifact-graph version-lock bootstrap --force` without explicit user approval.
- Treat project instructions as the source of truth when they are stricter than this skill.

## Discovery

1. Find the project root with `git rev-parse --show-toplevel` or the user's explicit path.
2. Read `../../INSTALL.md` relative to this `SKILL.md`.
3. Inspect existing `AGENTS.md`, `CLAUDE.md`, `README.md`, `artifact-graph.config.yaml`, `artifacts/**`, `src/**`, `test/**`, and package/workspace files.
4. Run compatibility pre-check: `node <plugin-root>/scripts/doctor.mjs --root <project-root> --format json`。
   - Locate `compatibility.json` and `<plugin-root>/scripts/doctor.mjs` relative to this `SKILL.md`; the plugin root is two levels above the skill file.
   - Do not hardcode machine-local absolute paths; always resolve from the skill's plugin root.
   - If doctor reports `cli_not_found` or `version_mismatch`, fix the dependency before proceeding.
5. Run `artifact-graph --help` and `artifact-graph doctor --root <root> --format json` if the CLI is available.
6. Classify the project shape before writing config. For extended type decisions, read
   `../../EXTENDED-ARTIFACT-CATALOG.md` and only copy templates from `../../templates/extended/**`.

## Project Shape And Trimming Rules

Use only artifact types that have stable local sources.

The assistant may maintain a broad reusable catalog, but bootstrap must enable a small
project-specific profile. Treat extended artifact types as opt-in starter guidance, not
global policy.

**Starter Templates**: The plugin provides starter templates for extended types in
`templates/extended/`. These are onboarding guidance, not project authority. After bootstrap,
projects should copy relevant templates to `artifacts/templates/` and customize them locally.

| Project shape | Start with | Usually defer |
| --- | --- | --- |
| Docs/planning repo | `feature`, `scenario`, `decision`, `design` | `test`, `e2e_test` until trace comments/tests exist |
| TypeScript library or CLI | `feature`, `decision`, `design`, `test`; add `cli_contract` only when CLI/API docs exist | `scenario` if no scenario scripts exist |
| API service | `feature`, `scenario`, `decision`, `design`, `test`; add `api_contract` and `data_contract` only when local contract files exist | `ui_contract`, `ipc_contract` |
| Enterprise Java/Spring or JVM service | `feature`, `scenario`, `decision`, `design`, `test`; add `api_contract`, `data_contract`, `integration_contract`, `batch_job_contract`, `database_migration`, `security_review`, `performance_budget`, `deployment_manifest`, or `runbook` only from local evidence | `ui_contract`, `ipc_contract`, agent-specific artifacts |
| Desktop or full-stack app | `feature`, `scenario`, `decision`, `design`, `test`, `e2e_test`; add `ui_contract`, `ipc_contract`, `api_contract`, or `data_contract` only from local evidence | custom entities until registry format is stable |
| Agent or plugin toolkit | `feature`, `scenario`, `decision`, `design`, `test`; add `agent_skill`, `hook_policy`, or `prompt_packet` only when local skill/hook/prompt files exist | release governance types unless this project owns releases |
| Parent or release governance repo | `feature`, `scenario`, `decision`, `design`, `e2e_test`; add `release_policy`, `publish_skill`, or `oss_compliance` only when local release files exist | product UI/API contracts |
| Existing mature artifact repo | types already present in `artifacts/**` | any type without templates or ID rules |
| Small project trying artifact-chain for the first time | `feature`, `decision`, `test` | everything else until useful |

Prefer a small correct graph over a large noisy one. Add more types only after the project has
templates, ID patterns, and review rules for them. See `../../EXTENDED-ARTIFACT-CATALOG.md` for
per-type recommended paths, ID patterns, lifecycle rules, and review checkpoints.

### 形态与采用阶段的实际就绪度

把项目实际证据归到一种形态：`cli-library`、`web`、`desktop` 或 `skill-plugin`；再选择当前阶段：`initial`（初建）、`legacy-backfill`（存量补档）或 `daily-iteration`（日常迭代）。运行同一个只读计算入口：

```bash
node <plugin-root>/scripts/check-workflow-profile.mjs \
  --root <project-root> \
  --project-shape <cli-library|web|desktop|skill-plugin> \
  --adoption-stage <initial|legacy-backfill|daily-iteration> \
  --types <explicitly-selected-type,...> \
  --format json
```

`--types` 只传已经由用户明确选择、但尚未写入配置或 profile 的类型；没有这种选择时省略。形态只产生候选，不证明项目拥有对应能力。库没有 CLI、静态 Web 没有 API、技能插件没有 hook 时，让相应契约留在 `candidate_types`，不要要求补齐。以脚本结果为准：

- `candidate_types` 列出形态和阶段建议，并说明是否由有效配置、已有 profile 或明确选择启用；
- `enabled_types` 只包含有上述依据的候选，候选本身不算缺口；
- `registration.ready` 同时检查有效类型、ID 模式、路径声明和目录；
- `template.ready` 检查插件 starter 是否真实存在；
- `methods.generate` 与 `methods.review` 复用当前 workflow profile 解析结果；需求/SPEC 的直接制作入口标为 `bundled-skill`，没有审阅方法时如实报告缺口；
- `project_specific_method_ready` 只在实际解析到 `project-worker` 时为 true；`bundled-skill`、`public-worker` 和 `project-worker` 分开报告；
- `gaps` 给出当前组合缺少的类型、目录、模板或方法，不把缺口写成已启用能力。

无配置项目仍能用 `artifact-chain-requirements` 把想法保存到 `artifacts/requirements/`。不要为了收集需求先强迫用户完成 bootstrap；需要把需求纳入图、建立当前制品或运行专业方法时，再按这里的结果补最小配置。

### Skill-family specification adoption

When the target is an agent, plugin, or skill-family project, keep professional specification
adoption separate from generic graph setup:

- Use only a specification source explicitly selected by the user, readable by the current task, and
  identified by a verifiable revision. A private Audit specification may be adopted when the user
  selects it and its current working-copy bytes are identified by a verifiable digest. Treat a source
  repository HEAD only as the repository baseline unless the selected files are tracked at that
  commit. Private location alone does not authorize trusting an arbitrary source.
- If the selected source is missing, unreadable, or has no verifiable commit or working-copy digest,
  pause only that professional judgment and do not report a target violation. If an integration
  specifically requires a published public contract, its absence blocks only that public-dependency
  path; it does not block an authorized private-reference adoption.
- Let Audit own skill-family artifact semantics and applicability. This assistant helps adopt the
  selected types, paths, identifiers, templates, and references. `artifact-graph` validates generic
  graph structure, relations, versions, freshness, and impact; configuration readiness does not prove
  professional conformance.
- Reference the selected specification and record the locally adopted scope in the target project's
  artifact catalog. Do not copy the specification, create a parallel specification lock, or introduce
  a second graph solely for adoption.
- Governance checks consume static source material and existing result records. They do not launch
  target tests, builds, validators, hooks, or business workflows. Authorized authoring, repair, and
  professional-provider work keeps its existing execution contract.
- Reuse an explicit authorization already given for the same project and exact writes. Ask again only
  if bootstrap discovers a new target, action, overwrite, or external effect.

### Enterprise Java/Spring/JVM Service Case Study

For enterprise Java/Spring Boot projects delivering digital business capabilities (order fulfillment, customer management, financial reconciliation), the delivery chain follows these phases:

**Phase 1: Requirements & Scenarios**
- `feature`: Business goals and acceptance criteria (e.g., `F-001-订单履约流程`)
- `scenario`: Behavior scripts (e.g., `S-001-订单创建场景`, `S-002-订单支付场景`)
- `decision`: Technical decisions (e.g., `D-001-采用事件驱动架构`)

**Phase 2: Design & Contracts**
- `design`: System architecture and component interaction (e.g., `design-order-fulfillment`)
- `api_contract`: REST/Message contracts (e.g., `API-001-订单服务REST接口`)
- `data_contract`: Data model and contracts (e.g., `DATA-001-订单数据模型`)
- `integration_contract`: External system integration (e.g., `INT-001-支付网关集成`)

**Phase 3: Implementation & Verification**
- `database_migration`: Schema changes (e.g., `MIG-20260709-001-创建订单表`)
- `batch_job_contract`: Batch processing (e.g., `BATCH-001-日终对账作业`)
- `test`: Unit and integration tests
- `e2e_test`: End-to-end verification (e.g., `TC-001-订单端到端测试`)

**Phase 4: Security & Performance Review**
- `security_review`: Threat modeling and security audit (e.g., `SEC-001-订单服务安全审查`)
- `performance_budget`: Performance targets and monitoring (e.g., `PERF-001-订单服务性能预算`)

**Phase 5: Deployment & Release**
- `deployment_manifest`: K8s/deployment config (e.g., `DEP-001-订单服务K8s部署清单`)
- `runbook`: Operations manual (e.g., `RUN-001-订单服务运维手册`)

**Phase 6: Post-Release Traceability**
- Version lock refresh: `artifact-graph version-lock refresh --all --format markdown`
- Validation: `artifact-graph validate --root . --warning-only`
- Audit: `artifact-graph version-lock audit --root . --strict-missing-lock`
- Production verification: monitoring metrics, logs, alerting configuration

**Traceability Example**:
```
F-001 (feature)
  ├─ S-001 (scenario)
  ├─ S-002 (scenario)
  └─ D-001 (decision)

API-001 (api_contract)
  ├─ related_features: [F-001]
  ├─ related_decisions: [D-001]
  └─ @api_contract API-001 (in Controller.java)

DATA-001 (data_contract)
  ├─ related_features: [F-001]
  └─ MIG-20260709-001 (database_migration)
```

**Completion Gate**:
1. `mvn clean test` passes
2. `mvn clean package` passes
3. `artifact-graph validate --root . --warning-only` has no warnings
4. `artifact-graph version-lock audit --root . --strict-missing-lock` passes
5. Security review and performance budget artifacts status is approved
6. Deployment manifest and runbook artifacts status is ready

**Evidence for Extended Types**: Enable extended types only when:
- `api_contract`: OpenAPI/Swagger spec files exist in `src/main/resources/static/` or similar
- `data_contract`: JPA/Hibernate entity files or database schema docs exist
- `integration_contract`: Feign/RestTemplate clients or message consumers exist
- `batch_job_contract`: Spring Batch job configurations or `@Scheduled` methods exist
- `database_migration`: Flyway/Liquibase migration files exist in `src/main/resources/db/migration/`
- `security_review`: Spring Security configurations or security-related code exists
- `performance_budget`: Performance test scripts or monitoring configurations exist
- `migration_plan`: Migration planning documents, architecture evolution docs, or system transition plans exist
- `deployment_manifest`: Dockerfile, K8s manifests, or Helm charts exist
- `runbook`: Operations documentation or runbook files exist

## Bootstrap Flow

1. If no config exists, run `artifact-graph init --root <root>`.
2. Edit `artifact-graph.config.yaml` to match real directories and IDs.
3. **Classify project shape and select artifact profile.** Use the Project Shape table above to
   determine which types to enable now and which to defer. Read
   `../../EXTENDED-ARTIFACT-CATALOG.md` for per-type recommended paths, ID patterns, lifecycle
   rules, and review checkpoints when adding any extended type. Enable only types whose `paths`
   actually exist on disk or whose directories will be created in the next step.
4. Create missing base directories only when useful, such as `artifacts/prd/features`,
   `artifacts/decisions`, or `artifacts/scenarios`.
5. Add or update an `AGENTS.md` Artifact Chain section with project-local paths, config ownership,
   lock ownership, CLI usage, refresh/audit commands, the `bootstrap --force` warning, and the
   value narrative rules (business purpose, project value, chain value, risk changes, verification
   evidence).
6. If Claude Code is used, make `CLAUDE.md` a thin pointer to `AGENTS.md` plus Claude-specific
   notes. Include a value narrative reference pointing to the AGENTS.md rules.
7. Run `artifact-graph validate --root <root> --warning-only`.
8. For a new project, run `artifact-graph version-lock bootstrap` only after config and initial
   relationships are reviewed. For an existing project, prefer `artifact-graph version-lock refresh
   --all --format markdown`.
9. Run `artifact-graph version-lock audit --root <root> --strict-missing-lock`.
10. Git hook installation is a mechanical step owned by `artifact-chain-setup` (D-ACA-31); bootstrap only
    decides whether hooks are ready and routes the user to setup for `artifact-graph hooks install-git
    --hook all` after validation and audit pass.
11. **Document available extended types for future enablement.** In `artifacts/README.md` or the
    project's equivalent catalog file, record which extended types were considered but deferred,
    along with the evidence condition that would trigger their enablement (e.g., "enable
    `api_contract` when OpenAPI spec files exist in `contracts/api/`"). This makes future profile
    expansion a documented decision rather than an ad-hoc addition.

## Config Guidance

Generate config from evidence. Common path patterns:

```yaml
types:
  requirement:
    paths: ["artifacts/requirements/**/*.md"]
    role: context
    aliases: [requirements]
    target: true
    extraFields:
      - { name: demand_kind, type: enum, enum: [business, it, mixed, unknown] }
      - { name: requirement_level, type: enum, enum: [source, development] }
      - { name: parent_requirement, type: string }
  spec:
    paths: ["artifacts/specs/**/*.md"]
    role: context
    aliases: [specs]
    target: true
  feature:
    paths: ["artifacts/prd/features/**/*.md"]
  scenario:
    paths: ["artifacts/scenarios/**/*.md"]
  decision:
    paths: ["artifacts/decisions/**/*.md"]
  design:
    paths: ["artifacts/design/**/*.md"]
  test:
    paths:
      - "src/**/*.{ts,tsx,js,jsx}"
      - "test/**/*.{ts,tsx,js,jsx}"
  e2e_test:
    paths: ["artifacts/tests/e2e/**/*.md"]
idPatterns:
  requirement: "^REQ-\\d+$"
  spec: "^SPEC-[A-Z0-9]+(?:-[A-Z0-9]+)*$"
  feature: "^[A-Z]{1,4}\\d+$"
  scenario: "^S-\\d+[a-z]?$"
  decision: "^D-[A-Z]+-\\d+$"
  design: "^[A-Za-z0-9._-]+$"
  test: "^.+\\.(ts|tsx|js|jsx)$"
statuses:
  - planned
  - active
  - done
  - deprecated
  - accepted
  - open
  - captured
  - proposed
  - approved
  - implemented
  - verified
  - released
statusViews:
  planned: planned
  open: planned
  done: history
  deprecated: history
  active: current
  accepted: current
relationSemantics:
  decomposes:
    label: "分解自"
    targetTypes: [requirement]
    fields: [parent_requirement]
  derives-from:
    label: "派生自"
    targetTypes: [requirement]
    fields: [derived_from]
context:
  universal_baseline: false
```

Remove any type whose `paths` do not exist and are not part of the immediate adoption plan.
The relation direction is child to parent: a child uses `parent_requirement` to point to a parent
with the same `requirement_level`, while a development requirement uses `derived_from` to point to
one or more source requirements. `derived_from` is an array-valued relation field and remains available in
raw frontmatter; do not misdeclare it as a scalar `extraFields` value.

Example config additions when evidence supports the four common ops/domain types:

```yaml
  database_migration:
    paths: ["artifacts/migrations/**/*.md"]
  security_review:
    paths: ["artifacts/security/**/*.md"]
  performance_budget:
    paths: ["artifacts/performance/**/*.md"]
  migration_plan:
    paths: ["artifacts/migrations/plan/**/*.md"]
idPatterns:
  database_migration: "^MIG-\\d{8}-\\d+$"
  security_review: "^SEC-\\d+$"
  performance_budget: "^PERF-\\d+$"
  migration_plan: "^MPLAN-\\d+$"
```

**Important**: Do not add these types to config unless local evidence exists (see Evidence for
Extended Types section above). The examples above are reference patterns; adjust paths and ID
patterns to match your project's conventions. Consult `../../EXTENDED-ARTIFACT-CATALOG.md`
for the per-type recommended path pattern, ID pattern, and lifecycle rules before adding them to
config. The catalog's "Bootstrap 裁剪策略" section defines the evidence-based rules: enable an
extended type only when the corresponding local files or directories exist, not when they are merely
planned.

## `AGENTS.md` Patch Content

The project should record:

- `artifact-chain-assistant` and `artifact-graph` are used.
- Artifact sources and lock files remain project-local.
- Use `artifact-graph ...`, never a machine-local absolute CLI path.
- `artifact-graph.config.yaml` is the artifact-chain contract.
- Keep `artifacts/traceability-version-lock.json` committed and reviewed.
- Context command before implementation:
  `artifact-graph context --root <project-root> --<type> <ID> --mode implementation`.
- Refresh command after relevant changes:
  `artifact-graph version-lock refresh --changed-only --staged --format markdown`.
- Completion checks:
  `artifact-graph validate --root <project-root> --warning-only` and
  `artifact-graph version-lock audit --root <project-root> --strict-missing-lock`.
- `bootstrap --force` requires explicit user approval.
- **Value Narrative**: L1/L2/L3 completion reports must explain business purpose, project value,
  chain value, risk changes, and verification evidence — not just what was done. See the AGENTS.md
  value narrative rules template in INSTALL.md for the full 5-dimension checklist.

## Output Contract

When finishing bootstrap, report. Every bootstrap report must follow the **value narrative rules** from
AGENTS.md: do not just list what was done; explain why it matters to the project.

### What Was Done

- project shape classification and the rationale (e.g., "TypeScript library → enabled feature,
  decision, design, test; deferred scenario because no scenario scripts exist");
- selected artifact types and the evidence for each;
- deferred extended types and the evidence condition that would trigger future enablement;
- files created or modified;
- exact validation commands and results;
- whether version lock was bootstrapped, refreshed, or left unchanged;
- remaining manual choices before enabling Git hooks.

### Value Narrative (价值叙事)

- **业务目的**：这轮 bootstrap 解决了目标项目的哪个采用或维护问题（首次配置、迁移、修复）。
- **项目价值**：它如何降低了目标项目的制品链采用门槛，或如何修复了现有链路的断点。
- **链路价值**：它补齐了配置、AGENTS/CLAUDE 说明、版本锁、hooks 中的哪一段缺口。
- **风险变化**：它消除了哪些配置风险；仍保留哪些需要后续人工决策的项目（如 deferred types 的启用时机）。
- **验证证据**：用实际的 validate/audit 输出证明制品链完整性，而非仅叙述"配置完成"。

## Skill Collaboration Boundary

### Division of Labor with artifact-chain-setup (D-ACA-31)

`artifact-chain-setup` is the general install skill: read-only diagnosis, then a mechanical install
plan, then user confirmation, then authorized execution, then re-verification. The mechanical steps
— installing the `artifact-graph` CLI from `compatibility.json`'s `artifactGraph.installSpec`,
installing/updating Git hooks, injecting the minimal `## Artifact Chain` trigger block into
`AGENTS.md`, and creating the thin `CLAUDE.md` pointer — belong to setup, not bootstrap.

Bootstrap keeps only the project-level decisions that require human judgment:

- artifact type trimming (project shape classification and evidence);
- `artifact-graph.config.yaml` contract content (`types`/`paths`/`idPatterns`);
- version-lock bootstrap/refresh decisions, including any `bootstrap --force` approval;
- the full workflow-methodology sections in `AGENTS.md`/`CLAUDE.md` (value narrative rules,
  completion gates, project-local ownership).

If setup's minimal trigger block already exists in `AGENTS.md`, bootstrap expands it into the full
project section through a reviewed patch rather than adding a duplicate block. Bootstrap may reuse
setup's diagnostic output but must re-verify the preconditions for its own writes and stay
fail-closed (unchanged from before D-ACA-31).

### Upgrade Scenario

When a target project upgrades `artifact-chain-assistant` to a new version, bootstrap is the
correct skill for non-destructive patching of project instructions. The upgrade scenario differs
from first-time setup:

**What bootstrap does during upgrade**:
- Patches `AGENTS.md` with missing sections (value narrative rules, completion gates, skill routing)
- Patches `CLAUDE.md` with missing references
- Validates existing `artifact-graph.config.yaml` against new plugin recommendations
- Reports conflicts where local sections differ from plugin templates (asks user to merge)
- Refreshes version lock and re-validates

**What bootstrap does NOT do during upgrade**:
- Overwrite existing `AGENTS.md` sections with local customizations
- Overwrite existing `CLAUDE.md` structure
- Remove artifact types from `artifact-graph.config.yaml`
- Copy templates from `templates/extended/` to project-local `artifacts/templates/`
- Run `version-lock bootstrap --force`

**Upgrade detection**: Bootstrap should detect upgrade context when:
- `artifact-graph.config.yaml` already exists and is valid
- `AGENTS.md` and `CLAUDE.md` already contain artifact-chain sections
- The user prompt mentions "upgrade", "update", or "new version"

In upgrade mode, bootstrap skips the project shape classification step (it was done during
first-time setup) and focuses on patching missing sections and validating existing configuration.

### Handoff to Maintainer

After bootstrap completes successfully, the project transitions to **maintainer** for ongoing operations:

1. **Bootstrap completion signals**:
   - `artifact-graph.config.yaml` has correct `types`, `paths`, and `idPatterns`
   - `AGENTS.md` and `CLAUDE.md` contain project-local artifact-chain instructions
   - `artifact-graph validate --root . --warning-only` passes
   - `artifact-graph version-lock audit --root . --strict-missing-lock` passes
   - Git hooks are installed (if requested)

2. **Handoff documentation**:
   - Report which artifact types are enabled and which are deferred
   - Document the evidence conditions for future profile expansion
   - Record the exact validation and audit commands for the project

3. **Post-bootstrap workflow**:
   - Daily development: use `artifact-chain-maintainer` for version-lock refresh/audit
   - Profile expansion: re-invoke `artifact-chain-bootstrap` when adding new artifact types
   - Configuration issues: re-invoke `artifact-chain-bootstrap` if `artifact-graph.config.yaml` needs major restructuring

### When to Re-invoke Bootstrap

**Re-invoke bootstrap** (not maintainer) when:
- Adding new artifact types to `artifact-graph.config.yaml` (profile expansion)
- Changing project shape classification (e.g., from CLI to API service)
- Major restructuring of artifact directories or ID patterns
- `artifact-graph doctor` reports configuration corruption
- Migrating from one artifact-chain setup to another

**Do NOT re-invoke bootstrap** for:
- Daily version-lock refresh/audit (use maintainer)
- Git hook updates (use maintainer)
- Fixing stale locks or orphan artifacts (use maintainer)
- Adding traceability annotations to code (use maintainer)

### Collaboration with artifact-chain-where-am-i

The `artifact-chain-where-am-i` skill routes to bootstrap when:
- Project has no `artifact-graph.config.yaml`
- Configuration is severely inconsistent with actual project structure
- Project shape has changed significantly
- Profile expansion is needed

Bootstrap should confirm the routing was correct by:
1. Running `artifact-graph doctor --root <root> --format json`
2. Comparing existing config with actual project structure
3. Reporting whether this is a fresh setup, migration, or repair
