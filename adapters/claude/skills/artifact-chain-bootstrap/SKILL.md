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

The published lists live in `artifact-graph/project-artifact-profiles` (`schema_version` `1.0`).
Graph owns `common_minimum` and approved `project_standards`. This assistant reads that JSON
through the resolved artifact-graph package, then checks registration, starter templates, and
methods. If the subpath is missing or `schema_version` is not `1.0`, report the gap and pause
only list-dependent recommendations; do not fall back to a copied STAGE/SHAPE table.

The assistant may maintain a broad reusable catalog of templates, but bootstrap must enable a small
project-specific profile. Treat extended artifact types as opt-in starter guidance, not
global policy. Reading the published lists does not enable types.

**Starter Templates**: The plugin provides starter templates for extended types in
`templates/extended/`. These are onboarding guidance, not project authority. After bootstrap,
projects should copy relevant templates to `artifacts/templates/` and customize them locally.

| Project shape | Start from published lists | Usually defer |
| --- | --- | --- |
| Docs/planning repo | common minimum `feature`, `scenario`, `design`; add `decision` when a choice must be traced | `test`, `e2e_test` until trace comments/tests exist |
| TypeScript library or CLI (`cli-library`) | common minimum; add `cli_contract` only when CLI/API docs exist | capability types without local evidence |
| API service (`web`) | common minimum; add `api_contract` and `data_contract` only when local contract files exist | `ui_contract`, `ipc_contract` |
| Enterprise Java/Spring or JVM service | common minimum; add `api_contract`, `data_contract`, `integration_contract`, `batch_job_contract`, `database_migration`, `security_review`, `performance_budget`, `deployment_manifest`, or `runbook` only from local evidence | `ui_contract`, `ipc_contract`, agent-specific artifacts |
| Desktop or full-stack app (`desktop`) | common minimum; add `ui_contract`, `ipc_contract`, `api_contract`, or `data_contract` only from local evidence | custom entities until registry format is stable |
| Agent or plugin toolkit (`skill-plugin`) | common minimum plus skill-plugin standard `agent_skill`, `e2e_test`; add `hook_policy` or `prompt_packet` only when local hook/prompt files exist | release governance types unless this project owns releases |
| Parent or release governance repo | common minimum; add `release_policy`, `publish_skill`, or `oss_compliance` only when local release files exist | product UI/API contracts |
| Existing mature artifact repo | types already present in `artifacts/**` | any type without templates or ID rules |
| Small project trying artifact-chain for the first time | common minimum `feature`, `scenario`, `design` | everything else until useful |

Prefer a small correct graph over a large noisy one. Add more types only after the project has
templates, ID patterns, and review rules for them. See `../../EXTENDED-ARTIFACT-CATALOG.md` for
per-type recommended paths, ID patterns, lifecycle rules, and review checkpoints.

### 形态与采用阶段的实际就绪度

把项目实际证据归到一种形态：`cli-library`、`web`、`desktop` 或 `skill-plugin`；再选当前阶段：`initial`（初建）、`legacy-backfill`（存量补档）或 `daily-iteration`（日常迭代）。候选来自 Graph 公开清单。共同最小三项 `feature`、`scenario`、`design` 始终可见，但可见不等于已启用。只有 `skill-plugin` 另有类别标准 `agent_skill` 与 `e2e_test`。阶段项按生命周期出现：`requirement` 在 `initial` 与 `daily-iteration`；`spec` 只在 `daily-iteration`；`decision` 在三个阶段都出现。接口、钩子、提示和发布类按能力出现。阶段项和能力项都只是候选，配置、profile 或用户明确选择之前不得启用。共同最小或技能族标准还没采用时，必须在结果里看得见。运行同一个只读计算入口：

```bash
node <plugin-root>/scripts/check-workflow-profile.mjs \
  --root <project-root> \
  --project-shape <cli-library|web|desktop|skill-plugin> \
  --adoption-stage <initial|legacy-backfill|daily-iteration> \
  --types <explicitly-selected-type,...> \
  --format json
```

`--types` 只传用户已经明确选择、但还没写入配置或 profile 的类型；没有这种选择时省略。形态只产生候选，不证明项目已经有对应能力。库没有 CLI、静态 Web 没有 API、技能插件没有 hook 时，把相应契约留在 `candidate_types`，不要要求补齐。项目已有配置或方法绑定里的额外类型必须保留。公开清单读不到，或 `schema_version` 不是 `1.0` 时，只暂停依赖清单的推荐路径，不回退复制表；已有额外类型仍保留。以检查结果为准：

- `profile_contract` 说明公开清单是否读到、`schema_version` 是否为 `1.0`；读不到或版本不兼容时只暂停清单推荐，不回退复制表。它不充当 `registration.ready` 的开关。
- `candidate_types` 列出共同最小、类别标准、阶段项、能力项和项目追加，并用 `applicability` 区分来源；`enabled` 只在有效配置、已有 profile 或明确选择时为 true。
- `missing_standard_types` 列出尚未采用的共同最小或技能族标准项。读清单成功不能当成已经采用。它和 `gaps` 分开看。
- `enabled_types` 只包含有上述依据的候选，候选本身不算缺口。
- `registration.ready` 同时检查有效类型、ID 模式、路径声明和目录。
- `candidate_types[].template_available` 只表示插件候选 starter 是否存在。有显式 generate 映射时，`artifacts[].template.ready` 与 `path` 反映该映射里实际选中且全部可用的模板：缺失、空映射、部分可用或非法路径时 `ready` 为 false、`path` 为 null，不回退插件 starter。没有映射时沿用既有捆绑模板观察，不宣称已经检查项目专属模板。worker 缺失与模板可用分开判断。
- `methods.generate` 与 `methods.review` 复用当前 workflow profile 解析结果；需求/SPEC 的直接制作入口标为 `bundled-skill`，没有审阅方法时如实报告缺口。
- `project_specific_method_ready` 只在实际解析到 `project-worker` 时为 true；`bundled-skill`、`public-worker` 和 `project-worker` 分开报告。
- `gaps` 给出当前组合缺少的目录、模板或方法。清单可读不能掩盖模板或方法未就绪。

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

## 首次采用

无配置时才走这条路径。先只读运行 `check-workflow-profile.mjs`，无配置也保留未采用与方法缺项的真实结果。候选推荐、项目选择和有效扫描范围分别核对，不把推荐清单自动启用。

1. 从当前实际解析到的已发布 Graph 包读取 `artifact-graph/project-artifact-profiles`，核对来源版本及 `schema_version`。现行清单为 `1.0`。共同最低推荐、项目类型标准和条件项只是选择依据。结合本项目真实交付、阶段和需求决定采用或暂缓，保留原有自定义类型。
2. 无配置时运行 `artifact-graph init --root <project-root>` 生成起点，再按项目选择调整。已有配置只作必要补丁，不整文件覆盖。
3. 填入实际扫描路径、ID、状态与关系，建立所选类型目录。`loadConfig` 合并内置类型和项目覆盖：省略类型键不会删除内置扫描；需要停用某内置路径时，在对应类型显式配置 `paths: []`，然后重新读取有效配置。`allowedEdges` 沿现有语义：空表使用内置默认，非空表是完整白名单。状态列表替换时保留仍需使用的状态。
4. 只为新采用的类型，或项目选定但缺失的模板，初始化本地模板。来源路径包含分类层：核心类型用 `templates/core/<type>/`，扩展类型用 `templates/extended/<category>/<type>/`，例如 `templates/extended/agent/agent_skill/` 和 `templates/extended/contracts/cli_contract/`。复制所选 starter 与 checklist 到项目本地后，再绑定本地文件。已有且有效的项目内路径不搬迁。不用上游副本整目录覆盖。
5. 在 `artifact-profiles/project.yaml` 绑定本地文件。沿用现有领域名，例如 feature 对应 prd-feature、scenario 对应 scenario-script、design 可对应 design-spec。没配置专属 worker 时可用既有 public-worker，不为了通过就绪检查虚构项目 worker。requirement 与 SPEC 保留已有需求入口和完整 SPEC 职责，不为了绑定本地模板改成通用复制任务。
6. 在已有 `artifacts/README.md` 记录实际来源、项目选择、裁剪理由、阶段要求、暂缓项及再考虑条件。更新本地工作约定。
7. 运行 Graph 配置与制品校验、方法资源检查。无历史锁且已核对初始关系时，才用既有 `version-lock bootstrap`。不得运行 `artifact-graph version-lock bootstrap --force`。最后 `version-lock audit --strict-missing-lock`。
8. Git hook 安装仍由 `artifact-chain-setup` 承接。初始化成功只说明定义及方法已就位，本次必要正文仍须实际补齐并评审。

下面只示例 feature 的现有 profile 接线，不是全项目完整配置：

```yaml
schema_version: 1
project:
  id: sample-skill-family
  language: zh-CN
workflows:
  generate:
    prd-feature:
      templates:
        - artifacts/templates/feature/starter.md
  review:
    prd-feature:
      checklists:
        - artifacts/templates/feature/review-checklist.md
```

调用检查时传入实际项目根、形态与阶段，例如 `node <plugin-root>/scripts/check-workflow-profile.mjs --root <project-root> --project-shape skill-plugin --adoption-stage initial --format json`。该 JSON 的 status 不是正文充分性。

## 已有定义维护

触发条件是需求暴露的表达缺口、项目主动采纳的规范变更、真实使用中的缺陷，或维护者选定的上游推荐。上游发版只提供对比来源，不强制更新项目。`spec-author` 只判断是否衔接并读取实际结果，不强制重跑本流程。形态或阶段实际变化时才重新判定；不一律跳过形态核对，也不一律拒绝复制所选缺失模板。

1. 读取当前本地文件和本次选定的新来源。旧采用来源可核验时，比较原采用版本、当前本地、选定新版本。旧来源缺失时，只报告当前本地与新来源的可见差异，不虚称三方合并，也不宣称可自动恢复定制历史。
2. 每项写明当前值、新建议、项目实际需求、拟改文件、是否影响已有制品，以及保留、选择性合入、暂缓或不适用。展示差异后再在授权写集内做最小变更。不整体覆盖。
3. 示例：早期设计模板只有“目标、职责、验收”，项目后来自行增加“恢复步骤”。选定上游新增“兼容影响”且本次变更涉及兼容性时，把“兼容影响”及对应清单合入本地模板，同时保留“恢复步骤”，再更新相关正文并重新评审。上游移除某章节，不删除项目仍在使用的部分。
4. 新增已选类型时补配置、目录、本地模板、清单和方法映射。已有类型只更新相关部分。身份拆分、路径迁移或重编号衔接现有 `artifact-chain-restructure`，不另写批量替换器。
5. 模板更新不自动重写所有历史正文。按本次需求和阶段约定识别受影响内容，保留历史事实。修改后重读实际文件，核对有效扫描范围、模板资源和生成/评审接线。已有定义变化使用 `version-lock refresh --all`；只有日常正文变化才用 changed-only。最后严格审计。不得 `bootstrap --force`。
6. 在 `artifacts/README.md` 更新采用记录。结论说明已生效改动、未改项、剩余缺口及其影响。缺口已阻断本次必要表达时，不得以暂缓为由继续输出 SPEC。无影响的新推荐可以暂缓，但不因此裁掉真实需求。他处迭代已经生效时读取该结果，不在当前流程重跑。

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
allowedEdges: []
context:
  universal_baseline: false
```

`allowedEdges` is required on an existing config. `[]`, `null`, or a YAML empty value adopts Graph's built-in default table. A non-empty list replaces that table and is a strict from/to/kind whitelist. Derive the project list from types, `relationSemantics`, and real artifact frontmatter in this project. Do not dump every scanned edge, and do not copy the default table and call it a project analysis. Keep unrelated fields. `forbiddenEdges` still wins.

Keep existing project-specific custom types. For a built-in type not selected for adoption, explicitly retain its type key and set `paths: []` to disable default scanning; omitting the key would otherwise restore the Graph's default scan paths. A new optional candidate that has never been selected or configured may remain absent.
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
- `artifact-graph.config.yaml` contract content (`types`/`paths`/`idPatterns`/`allowedEdges`);
- version-lock bootstrap/refresh decisions, including any `bootstrap --force` approval;
- the full workflow-methodology sections in `AGENTS.md`/`CLAUDE.md` (value narrative rules,
  completion gates, project-local ownership).

If setup's minimal trigger block already exists in `AGENTS.md`, bootstrap expands it into the full
project section through a reviewed patch rather than adding a duplicate block. Bootstrap may reuse
setup's diagnostic output but must re-verify the preconditions for its own writes and stay
fail-closed (unchanged from before D-ACA-31).

### 版本升级时的定义维护

目标项目升级 `artifact-chain-assistant` 时，仍走上面的“已有定义维护”，不把升级本身当成必须重做全套定义的事件。上游新版本只作为选定对比来源。

升级时可以补齐 `AGENTS.md` / `CLAUDE.md` 中缺失的工作约定，并校验现有配置。保留本地定制，例如“恢复步骤”。只有项目选定合入的上游章节，例如本次涉及兼容性时的“兼容影响”，才写入本地模板。不整体覆盖 `AGENTS.md`、`CLAUDE.md` 或 `artifact-graph.config.yaml`。不删除项目仍在使用的类型。不运行 `version-lock bootstrap --force`。

仅当项目形态或采用阶段实际变化时才重新分类。已有定义仍然适用时继续沿用，不强制升级。已有且有效的项目内模板路径不搬迁。只有新采用的类型或选定后仍然缺失的模板，才从含分类层的真实来源初始化。

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
