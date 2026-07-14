# Extended Artifact Catalog

This document summarizes the extended artifact type catalog for `artifact-chain-assistant`. It
covers type classification, recommended paths and ID patterns, template adoption rules, and the
three-tier authority boundary between `artifact-graph`, the plugin, and target projects.

For core artifact types (`feature`, `scenario`, `decision`, `design`, `test`, `e2e_test`), see the
plugin README and INSTALL.md. This document covers opt-in types beyond the core set.

## Three-Tier Authority Model

| Layer | Scope | Responsibility for Extended Types |
| --- | --- | --- |
| **artifact-graph** | Deterministic graph capabilities | Reads type definitions from config; indexes artifacts; provides context/packet/validate. Does **not** ship default paths or ID patterns for extended types. Types without configured paths are not indexed. |
| **artifact-chain-assistant** | General assistant guidance | Provides starter templates, profile suggestions, and generic review checklists. **Templates are guidance, not authority.** Project-local templates and review skills override plugin suggestions. |
| **Target project** | Final working method | Decides which extended types to enable; maintains config, local templates, review skills, and ID rules. **Project-local overrides plugin suggestions.** Enables new types progressively as maturity grows. |

## Extended Artifact Type Catalog

Extended types are organized into four categories. Each type entry includes recommended paths, ID
patterns, lifecycle rules, and review checkpoints. All recommended values are **guidance** — the
project's `artifact-graph.config.yaml` is the final authority.

### Contract Artifacts

Contract artifacts record interface agreements at system boundaries. When requirements flow from
features and scenarios into implementation, contracts are key upstream artifacts for context
assembly.

| Type | Recommended Path | Recommended ID Pattern | Lifecycle | Review Checkpoints |
| --- | --- | --- | --- | --- |
| `api_contract` | `artifacts/contracts/api/` | `API-{nnn}` or `{service}-API-{version}` | Create/update on API change; mark deprecated when API is retired | Consistency with implementation, error code coverage, version compatibility, request/response schema completeness |
| `cli_contract` | `artifacts/contracts/cli/` | `CLI-{nnn}` or `{tool}-CLI-{version}` | Create/update on CLI interface change | Command signature, parameter types, exit codes, backward compatibility, help text accuracy |
| `ui_contract` | `artifacts/contracts/ui/` | `UI-{nnn}` | Create/update on UI flow change | Interaction flows, state transitions, accessibility, error state coverage |
| `ipc_contract` | `artifacts/contracts/ipc/` | `IPC-{nnn}` | Create/update on IPC channel change | Message format, error propagation, frontend/backend boundary, serialization compatibility |
| `data_contract` | `artifacts/contracts/data/` | `DATA-{nnn}` | Create/update on data model/schema change | Field semantics, version compatibility, migration path, default value semantics |
| `report_contract` | `artifacts/contracts/report/` | `RPT-{nnn}` | Create/update on report format change | Field semantics, aggregation logic, output format, time window semantics |
| `integration_contract` | `artifacts/contracts/integration/` | `INT-{nnn}` | Create/update on external system integration change | Interface protocol, timeout, retry strategy, idempotency, error classification |
| `batch_job_contract` | `artifacts/contracts/batch/` | `BATCH-{nnn}` | Create/update on batch job change | Input/output format, schedule expression, idempotency, error handling, replay strategy |

### Domain and Data Artifacts

Domain and data artifacts capture business concepts and technical data models. They are core
artifacts for enterprise Java and DDD projects.

| Type | Recommended Path | Recommended ID Pattern | Lifecycle | Review Checkpoints |
| --- | --- | --- | --- | --- |
| `domain_model` | `artifacts/domain/` | `DM-{nnn}` or entity name | Create/update on domain concept change | Aggregate boundaries, domain events, bounded context mapping, invariant definitions |
| `database_migration` | `artifacts/migrations/` | `MIG-{nnn}` or timestamp (e.g., `20260709-001`) | Create on schema change; mark executed after deployment | Rollback path, data compatibility, performance impact, large table change strategy |

### Deployment and Operations Artifacts

Deployment and operations artifacts cover production environment changes, security, performance, and
operational procedures. Enable only when the project has corresponding operational processes.

| Type | Recommended Path | Recommended ID Pattern | Lifecycle | Review Checkpoints |
| --- | --- | --- | --- | --- |
| `deployment_manifest` | `artifacts/deploy/` | `DEP-{nnn}` or environment name (e.g., `DEP-prod`) | Create/update on deployment config change | Environment differences, rollback strategy, resource limits, health check configuration |
| `security_review` | `artifacts/security/` | `SEC-{nnn}` | Create/update on security review cycle or major change | Threat model coverage, fix status tracking, compliance mapping, sensitive data handling |
| `performance_budget` | `artifacts/performance/` | `PERF-{nnn}` | Create/update on performance target change | Metric baseline, threshold definition, regression detection strategy, measurement method |
| `migration_plan` | `artifacts/migrations/plan/` | `MPLAN-{nnn}` | Create on migration start; update at each phase completion | Phase division, rollback point definition, data validation strategy, parallel run period |
| `runbook` | `artifacts/runbooks/` | `RUN-{nnn}` | Create/update on operational procedure change | Step accuracy, alert correlation, responsible person, last execution date |

### Release Governance Artifacts

Release governance artifacts cover versioning strategy, publishing workflows, and open-source
compliance. Enable only for parent repos, release governance repos, or multi-package monorepos that
own the release process.

| Type | Recommended Path | Recommended ID Pattern | Lifecycle | Review Checkpoints |
| --- | --- | --- | --- | --- |
| `release_policy` | `artifacts/governance/` | `RP-{nnn}` | Create/update on release policy change | Version semantics, release cadence, branch strategy, changelog standard, rollback plan |
| `publish_skill` | `artifacts/governance/` | `PS-{nnn}` | Create/update on publish workflow change | Publish targets, quality gates, compliance checks, error handling, rollback plan |
| `oss_compliance` | `artifacts/governance/` | `OSS-{nnn}` | Create/update on OSS compliance rule or release scope change | License policy, dependency audit, standard files, security disclosure, release exclusions |

### Agent and Hook Artifacts

Agent and hook artifacts cover AI-assisted workflows and CI/CD gates. Enable only when the project
has corresponding files or processes.

| Type | Recommended Path | Recommended ID Pattern | Lifecycle | Review Checkpoints |
| --- | --- | --- | --- | --- |
| `agent_skill` | `artifacts/skills/` | `SKILL-{nnn}` | Create/update on skill definition change | Input/output contract, tool dependencies, permission boundary, error handling |
| `hook_policy` | `artifacts/policies/` | `HOOK-{nnn}` | Create/update on hook policy change | Trigger conditions, gate rules, bypass approval process, audit log |
| `prompt_packet` | `artifacts/packets/` | `PP-{nnn}` | Create/update on prompt template or context assembly change | Context sources, prompt clarity, token budget, output contract, testability |

## Bootstrap Trimming Strategy

Bootstrap selects a **minimum viable profile** rather than enabling all known types.

Rules:

1. **Core set always enabled**: `feature`, `scenario`, `decision`, `design`, `test`, `e2e_test`.
2. **Contracts by evidence**: Enable only when the project has corresponding interface files (e.g., OpenAPI spec, CLI entry, IPC channel definition).
3. **Domain/data by project shape**: Enterprise Java/DDD projects may enable `domain_model`; projects with databases may enable `database_migration`.
4. **Ops by operational process**: Enable only when the project has deployment configs, security review processes, or operational manuals.
5. **Agent/hook by local files**: Enable only when the project has `skills/`, `policies/`, or hook config files.
6. **Progressive expansion**: As project maturity grows, add new types in `artifact-graph.config.yaml`. Existing artifacts and traceability relationships are unaffected.

After bootstrap, the enabled types, paths, and ID patterns are recorded in
`artifact-graph.config.yaml`. Deferred types and their evidence conditions are documented in the
project's artifact catalog so future expansion is a recorded decision.

## Template Adoption

### Template Source Rules

1. **Plugin templates are onboarding guidance.** `artifact-chain-assistant` provides starter
   templates for each extended type in `templates/extended/`, organized by category
   (`contracts/`, `domain/`, `ops/`, `agent/`). Plugin templates do not determine the project's
   artifact shape.
2. **Project-local templates are authority.** When a project needs different section structures,
   review standards, or naming rules, project-local templates override plugin templates.
3. **Fallback when no template exists.** If a project enables an extended type but has no local
   template, the assistant may reference the plugin starter but must note it has not been
   customized.
4. **Adoption flow.** Copy the starter template from `templates/extended/` to the project-local
   `artifacts/templates/` or equivalent, then customize.

### Template Lifecycle

1. **Bootstrap phase**: Bootstrap skill references plugin starters to generate initial artifact
   structure. Template source is recorded in `artifacts/README.md`.
2. **Adoption phase**: Team reviews the starter, decides which sections to keep/modify/remove,
   and copies to local. The customized version becomes authority.
3. **Mature phase**: Project maintains a complete local template library. Plugin starters are
   referenced only when onboarding new members or enabling new types.
4. **Upgrade review**: When the plugin updates a starter, the project reviews the diff and
   selectively merges useful changes while preserving local customizations.

### Template Directory Layout

```
templates/
  core/                          # Core artifact templates
    feature/
      starter.md                 # Drafting guidance template
      review-checklist.md        # Generic review checklist
    scenario/
      starter.md
      review-checklist.md
    decision/
      starter.md
      review-checklist.md
    design/
      starter.md
      review-checklist.md
    test/
      starter.md
      review-checklist.md
    e2e_test/
      starter.md
      review-checklist.md
  extended/                      # Extended artifact templates (by category)
    contracts/
      api_contract/
        starter.md
        review-checklist.md
      cli_contract/
        starter.md
        review-checklist.md
      data_contract/
        starter.md
        review-checklist.md
      ...                        # Other contract types follow the same structure
    domain/
      domain_model/
        starter.md
        review-checklist.md
      database_migration/
        starter.md
        review-checklist.md
    ops/
      deployment_manifest/
        starter.md
        review-checklist.md
      runbook/
        starter.md
        review-checklist.md
      ...
    governance/
      release_policy/
        starter.md
        review-checklist.md
      publish_skill/
        starter.md
        review-checklist.md
      oss_compliance/
        starter.md
        review-checklist.md
    agent/
      agent_skill/
        starter.md
        review-checklist.md
      hook_policy/
        starter.md
        review-checklist.md
      prompt_packet/
        starter.md
        review-checklist.md
```

Each type's `starter.md` contains the artifact structure template and minimal filling guidance.
`review-checklist.md` is the generic review checkpoint baseline. Both are **suggestions that can be
fully overridden by project-local templates**.

## Evidence-Based Enablement

Bootstrap activates extended artifact types only when local files or directories exist:

| Type | Enablement Evidence |
| --- | --- |
| `api_contract` | OpenAPI/Swagger spec, API documentation, or REST endpoint code exists |
| `cli_contract` | CLI entry code or command definitions exist |
| `data_contract` | Data model definitions or schema files exist |
| `domain_model` | DDD aggregates, entities, or value objects exist in code |
| `database_migration` | Database schema or migration scripts exist |
| `security_review` | Security review process, security-related code, or Spring Security config exists |
| `performance_budget` | Performance test scripts, monitoring config, or performance baseline docs exist |
| `migration_plan` | Migration planning docs, architecture evolution plans, or system transition plans exist |
| `runbook` | Operational procedures or runbook documents exist |
| `deployment_manifest` | Deployment configs (K8s, Docker, etc.) exist |
| `agent_skill` | Agent skill definition files exist |
| `hook_policy` | CI/CD hook configurations exist |
| `release_policy` | Release policy docs, versioning strategy, or release process files exist |
| `publish_skill` | Publish workflow scripts, CI/CD publish pipelines, or registry configuration exists |
| `prompt_packet` | Prompt template files, context assembly configs, or AI workflow definitions exist |
| `oss_compliance` | License files, dependency audit configs, or OSS compliance process docs exist |

**Rule**: Enable a type only when local evidence exists. Do not enable because the plugin provides a
template.

## artifact-graph Runtime Support for Custom Types

Starting with `artifact-graph` 0.3.0, config-driven custom types have full runtime support.
The extended catalog has two layers:

1. **Implemented in artifact-chain-assistant**: starter templates, review checklists, bootstrap
   recommendations, and evidence-based adoption guidance.
2. **Implemented in artifact-graph 0.3.0+**: config-driven indexing, graph traversal, `context`,
   `packet`, `validate`, `version-lock`, and `extraFields` for any registered custom type.

### What the Runtime Provides for Custom Types

Once a type is registered in `artifact-graph.config.yaml` with `paths` and optionally
`idPatterns`, the runtime delivers:

1. **Scanning and frontmatter parsing**: Read `types.{type}.paths` from config; scan matching
   files; parse frontmatter for `id`, `title`, `status` and other standard fields. Types without
   configured paths are not indexed.
2. **Graph edges**: Custom types participate in graph traversal through `related_<type>`
   frontmatter fields, `@<type> <ID>` traceability comments, and explicit relationship fields.
3. **Target selector**: `--target <type>:<id>` works with `context`, `packet`, `packet-prompt`,
   and `audit` for any type that has `target: true` in config. The ID may contain colons; only the
   first colon separates type from ID. There is **no** dynamic `--{type}` flag; `--target` is the
   universal entry point.
4. **Extra fields**: Declare `extraFields` in config to index specific frontmatter fields (string,
   number, boolean, enum). Undeclared fields remain in raw frontmatter but are not indexed.
5. **Validation**: Custom types participate in ID pattern checks, dangling relation warnings, orphan
   artifact warnings, and version-lock freshness checks.
6. **Version-lock**: Custom type artifacts and their traceability edges are included in
   version-lock refresh, audit, and bootstrap.

### Capability Matrix

| Capability | Core Types | Extended Types | Notes |
| --- | --- | --- | --- |
| File indexing and ID parsing | Implemented | Implemented via config `paths` + `idPatterns` | Types without configured paths are not indexed |
| Graph traversal (upstream/downstream) | Implemented | Implemented via `related_<type>` fields and traceability comments | Strength depends on traceability annotation density |
| context/packet assembly | Implemented (`--target <type>:<id>`) | Implemented (`--target <type>:<id>`) | `--target` is the universal entry; no dynamic `--{type}` flags |
| validate | Implemented | Implemented | ID pattern checks, dangling relations, orphan warnings, lock freshness |
| version-lock | Implemented | Implemented | Custom type edges included in refresh/audit/bootstrap |
| Artifact content quality judgment | No | No | artifact-graph does not judge "good PRD" or "good contract" |
| Built-in edge rules | No | No | All edge rules come from artifact content, not type metadata |

### Known Limitations

- **Content quality not judged**: artifact-graph validates structure and traceability, not whether
  an artifact's content is well-written or complete.
- **Sparse traceability annotations**: Custom artifacts without `related_*` frontmatter fields or
  implementation traceability comments will produce weak graph relationships. Mitigation:
  project-local review should require traceability fields.
- **ID pattern collisions**: Multiple types using the same ID pattern can cause ambiguous graph
  edges. Mitigation: use distinct ID prefixes per type (e.g., `API-`, `CLI-`).
- **Path overlaps**: Multiple types whose path globs match the same files create duplicate graph
  nodes. Mitigation: use mutually exclusive path globs.
- **Loosely-coupled ops artifacts**: Some types (e.g., `runbook`, `deployment_manifest`) may have
  naturally loose links to the core requirement chain. This is expected behavior, not a defect.

## Project Shape Profiles

Nine project profiles each map to a recommended starter set and a defer-until-ready list. Profiles
are used only during bootstrap — they are not a runtime concept. The final selection is written to
`artifact-graph.config.yaml`.

| Profile | Recommended Extended Types | Deferred Types |
| --- | --- | --- |
| Docs/planning repo | None | All extended types |
| TypeScript library or CLI | `cli_contract` | Other contracts, domain, ops |
| API service | `api_contract`, `data_contract` | `domain_model`, `deployment_manifest`, `runbook`, `performance_budget` |
| Enterprise Java/Spring/JVM | `api_contract`, `data_contract`, `integration_contract`, `batch_job_contract`, `domain_model`, `database_migration`, `security_review` | `deployment_manifest`, `runbook`, `performance_budget` |
| Desktop or full-stack app | `ui_contract`, `ipc_contract`, `api_contract` | `deployment_manifest`, `runbook` |
| Agent or plugin toolkit | `agent_skill`, `hook_policy`, `prompt_packet` | Other extended types |
| Parent or release governance repo | `release_policy`, `publish_skill`, `oss_compliance` | Other extended types |
| Existing mature artifact repo | As-needed based on existing files | Types without local evidence |
| Small first-time project | None | All extended types |

## Related Documents

- [README](templates/README.md) — Plugin overview with full feature list
- [INSTALL.md](INSTALL.md) — Installation, bootstrap flow, and profile expansion guide
- [ADOPTION-GUIDE](https://github.com/mzdbxqh/artifact-chain-assistant/blob/main/templates/extended/ADOPTION-GUIDE.md) — Step-by-step template adoption and upgrade review guide
