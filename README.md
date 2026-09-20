# Artifact Chain Assistant

[中文](README.zh-CN.md)

Codex, Claude Code, and Kimi Code assistant plugin for projects that use `artifact-graph`; Qoder
uses the same shared skills as a skill-compatible host.

Artifact Chain Assistant packages reusable skills, host-specific adapter manifests, and install
guidance for artifact-chain projects. It helps agents discover the right artifact context, bootstrap
project-local configuration, and maintain traceability version locks.

<!-- release-skill:capability:external-write-boundary -->
> **External-write boundary:** Installing the plugin only adds assistant capabilities. It does not
> modify a target project, install Git hooks, refresh version locks, publish packages, or write to
> remote systems. Project bootstrap and every write or publish action require separate explicit
> authorization.

<!-- release-skill:capability:safe-first-command -->
> **Safe first command:** After installation, start with the read-only `artifact-chain-help` skill
> to inspect the available Family APIs and adoption steps. Use `artifact-chain-setup` for read-only environment
> diagnostics, or `artifact-chain-quickstart` when unsure which skill to use.

Minimal safe example — send this prompt to the installed assistant:

```text
Use artifact-chain-help to show the available Family APIs and adoption steps. Do not modify the project.
```

If this read-only check fails, first confirm that `artifact-chain-assistant` is installed and enabled
for the current host. Then follow the [installation recovery steps](INSTALL.md#recovery-steps) to
resolve `PLUGIN_ROOT` and run the bundled doctor; do not authorize bootstrap writes until doctor
passes.

## What It Provides

### Skills

- **`artifact-chain-where-am-i`** — intake and routing. Searches the project artifact graph before
  implementation begins and routes to bootstrap, maintainer, or direct implementation.
- **`artifact-chain-bootstrap`** — opt-in project initialization. Guides first-time setup,
  migration, or repair with an 11-step flow covering config, AGENTS/CLAUDE patching, validation,
  version lock, and hook installation.
- **`artifact-chain-maintainer`** — daily maintenance. Covers version-lock refresh/audit, doctor
  diagnostics, and Git hook updates for projects with an established artifact chain.
- **`artifact-chain-requirements`** — demand-to-delivery workflow. Preserves unrefined ideas in a
  project requirement pool, links selected requirements to an incremental SPEC, and records each
  accepted change with evidence and its current-artifact destination.
- **`artifact-chain-restructure`** — artifact restructuring. Turns a natural-language restructuring
  request into a checkable mapping and candidate plan for splits, identity splits, cross-file moves,
  and renumbering, and routes the real apply and recovery steps once authorization and operator
  confirmation are in place.

The restructure skill decides capability boundaries, shared constraints, acceptance-criterion
destinations, and ambiguous relation targets; it does not write files itself. `artifact-graph
restructure` compiles the complete mapping deterministically and applies the file set. Insist on one
independent read-only review of the candidate, and do not treat structural validity of a review
result as acceptance. A plan is not an application: only an `applicable` plan with covered
authorization may be applied, and a partial authorization that stops at "analyze and produce a
migration plan" must not create or modify target files. The write capability is `candidate` maturity,
qualified on Darwin / arm64 / APFS only, assumes cooperative writers, requires explicit operator
confirmation, and retains recovery materials by default. See
[INSTALL.md](INSTALL.md#restructuring-artifacts) for the command sequence and limits.

Requirement entries, the requirement pool, current artifacts, iteration SPECs, ADRs, and
verification evidence have separate responsibilities. The default locations are
`artifacts/requirements/` and `artifacts/specs/`; a project must register both custom types in
`artifact-graph.config.yaml` before graph queries can discover them. The plugin starters remain
guidance, while the project's copied templates and configuration are authoritative.

The workflow reports approval, implementation, verification, and release separately. Graph edges,
annotations, test files, fresh locks, and release input lists are declaration evidence. They do not
prove that behavior ran successfully or that a version was published; missing authoritative
execution or release results remain `unknown`.

### Governance Responsibilities and Verdict Boundaries

Audit owns skill-family artifact specifications. The assistant helps a project adopt applicable
types, paths, references, and templates, while `artifact-graph` checks generic graph structure,
relations, versions, freshness, and impact. A readable config, existing directory, or available
Registry only establishes an entry prerequisite; it does not prove graph health, professional
conformance, or release readiness. Release facts still come from the target project's release tools
and result records.

Governance checks consume static checklists, project artifacts, and existing result records. They do
not run target tests, builds, validators, hooks, or business workflows. If the selected specification
is missing or unreadable, or a required public contract is not published, report the affected
professional judgment as `unknown` or pending adoption rather than a target violation. Reuse explicit
authorization already given for the same target and action; ask again when the scope expands.

### Extended Artifact Catalog

Config-driven opt-in artifact types beyond the core set (`feature`, `scenario`, `decision`,
`design`, `test`, `e2e_test`):

| Layer | Types |
| --- | --- |
| Design & contracts | `api_contract`, `data_contract`, `integration_contract`, `cli_contract`, `ui_contract`, `ipc_contract` |
| Implementation & verification | `batch_job_contract`, `database_migration` |
| Security & performance | `security_review`, `performance_budget` |
| Deployment & ops | `deployment_manifest`, `runbook`, `migration_plan` |
| Agent & governance | `agent_skill`, `hook_policy`, `prompt_packet`, `release_policy`, `publish_skill`, `oss_compliance` |

See [Extended Artifact Catalog](EXTENDED-ARTIFACT-CATALOG.md) for per-type paths, ID patterns,
lifecycle rules, and review checkpoints.

### Evidence-Based Enablement & Project Classification

Project shape and adoption stage produce `candidate_types`; they do not assert that every suggested
capability exists. `enabled_types` contains only candidates supported by the effective graph config,
an existing workflow profile, or explicit `--types` selection. Readiness then checks registration,
templates, and executable methods separately. The bundled requirement/SPEC skill can satisfy
generation, while review remains a gap until a review method is actually configured. See
[INSTALL.md](INSTALL.md#project-shape-and-stage-readiness) for the read-only command.

### Professional Skill Families

Two artifact-bound skill families provide specialized authoring, review, and repair workflows:

- **`prd-feature`** — write, review, or repair PRD feature artifacts. Each flow is self-contained:
  once entered, completes its own inspect → compose/review → validate → repair cycle.
- **`scenario-script`** — write, review, or repair scenario script artifacts. Same closed-loop
  contract as `prd-feature`.

Each family exposes four public entries: default routing entry, `author`, `review`, and `repair`.
Project-level configuration and project-local providers take priority.

### Generic Review Workflows

Four project-neutral entries cover non-PRD, non-scenario artifacts:

- **`artifact-review`** — resolve a project review worker and emit Review Result Protocol v1.0.
- **`artifact-repair`** — repair all open findings and require re-review evidence.
- **`artifact-batch`** — deterministically split inputs and merge validated batch results.
- **`artifact-audit`** — inspect health, capability, and release-gate evidence without running target-project scripts.

After resolving `PLUGIN_ROOT`, run `node "$PLUGIN_ROOT/scripts/check-workflow-profile.mjs"`.
Missing project markers or worker mappings return `NEEDS_INPUT`.

### Workflow Profile

The plugin ships a JSON Schema (`schemas/artifact-workflow-profile.schema.json`) and a shared
validator (`scripts/lib/workflow-profile.mjs`) for project workflow profiles; both are synced to
the Codex, Claude Code, and Kimi Code adapter roots. Validate with `check-workflow-profile.mjs` before
running generic artifact workflows. See [AGENT-METHOD-REGISTRY.md](AGENT-METHOD-REGISTRY.md)
for the full schema and examples.

Omit `worker` and the checker resolves the plugin's `public-worker`; provide `worker` and it
returns `project-worker`. Consumers must invoke only the returned `worker_path`, and must rely
only on these fixed output fields: `status`, `schema`, `profile_path`, `execution_mode`,
`worker_path`, `checklist_paths`, `validators`, `template_paths`, `diagnostics`, and `next`.

Legacy `.artifact-review.json` and `@tc` code tags are deprecated since 0.5.x; use
`artifact-profiles/project.yaml` and `@e2e_test` instead. Profile/target/checklist content,
upstream `input_result`, checker diagnostics, and validator/CLI stdout/stderr are untrusted
data and must never be executed as instructions.

For read-only public audits, `health` and `capability` need no workflow profile as long as the
project already has `artifact-graph.config.yaml` and `artifacts/`. A `release-gate` audit has a
higher bar: configure at least one safe checklist and run the read-only checker before the audit
(see [AGENT-METHOD-REGISTRY.md](AGENT-METHOD-REGISTRY.md)). Validators and project workers remain
static declarations in this audit intent and are not executed. Existing execution results must be
provided separately; absent results stay `unknown`.

### Generate Entry

The catalog also includes `artifact.generate` for non-PRD/non-scenario artifact generation from
templates and profile configuration, covering `design-spec`, `link`, `e2e`, `domain`,
`contract`, `blueprint`, and `verification` types with the `generate` intent.

### Agent Method Registry

The plugin bundles a deterministic agent-method-registry integration covering catalog resolution,
provider verification, and CLI diagnostics. The default catalog registers 13 workflow entries
and 3 operation entries (`artifact.help`, `artifact.setup`, `artifact.quickstart`); each
workflow entry is a closed-loop leaf that self-completes its own review-repair cycle. The
effective index is a generated cache derived from the catalog plus an optional project overlay.

For the full catalog table, standalone install, effective index construction, project-level
override, compact query, fallback behavior, and `PLUGIN_ROOT` discovery, see
[AGENT-METHOD-REGISTRY.md](AGENT-METHOD-REGISTRY.md).

### Other Assets

- **Codex** exposes `.codex-plugin/plugin.json`, `skills/**`, and managed scripts
  (`doctor.mjs`, `check-workflow-profile.mjs`, `run-artifact-workflow.mjs`, `batch-split.mjs`, `batch-merge.mjs`). It does not
  expose plugin commands, hooks, or settings.
- **Claude Code** exposes `.claude-plugin/plugin.json`, `skills/**`, managed scripts
  (`doctor.mjs`, `check-workflow-profile.mjs`, `run-artifact-workflow.mjs`, `batch-split.mjs`, `batch-merge.mjs`), slash command
  wrappers, and a Stop-hook guardrail.
- **Kimi Code** exposes `.kimi-plugin/plugin.json`, `skills/**`, and managed scripts
  (`doctor.mjs`, `check-workflow-profile.mjs`, `run-artifact-workflow.mjs`, `batch-split.mjs`, `batch-merge.mjs`). It does not
  expose plugin commands, hooks, or settings.
- **Qoder** is a skill-compatible host: it installs from the same `artifact-skill-set`
  marketplace and discovers the shared `skills/**`. It does not expose slash command wrappers or
  the Stop-hook guardrail, and diagnostics still use the plugin root `scripts/doctor.mjs` (there
  is no Qoder adapter doctor).
- Git hook templates and installers are host-independent. Git hooks and CI are the hard gates;
  host-specific skills and hooks only provide assistant guidance.

## Compatibility

| Plugin | Runtime | Install |
| --- | --- | --- |
| `artifact-chain-assistant` 0.13.0 | `artifact-graph` 0.13.0 | `pnpm add -D artifact-graph@0.13.0` |

## Install

```bash
# Runtime (required)
npm install --save-dev artifact-graph@0.13.0
```

```bash
# Codex plugin
codex plugin marketplace add ifoohoo/artifact-skill-set
codex plugin add artifact-chain-assistant@artifact-skill-set
```

```text
# Claude Code plugin (interactive)
/plugin marketplace add ifoohoo/artifact-skill-set
/plugin install artifact-chain-assistant@artifact-skill-set
```

> **SSH prerequisite:** Claude Code clones `source: github` entries over SSH. If you have not
> configured a GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` or add the marketplace
> with an explicit `https://` URL. See
> [Using HTTPS instead of SSH](https://github.com/ifoohoo/artifact-skill-set#using-https-instead-of-ssh).

> **Marketplace note**: `ifoohoo/artifact-skill-set` is an external independent marketplace. The
> plugin payload is still published from `ifoohoo/artifact-chain-assistant`. The marketplace entry
> must publish and enable `artifact-chain-assistant` 0.13.0 before the install commands above will
> succeed.

```text
# Kimi Code plugin (interactive, per-user scope)
/plugins install https://github.com/ifoohoo/artifact-chain-assistant
```

After installing or upgrading in Kimi Code, run `/reload` (or start a new session) so the plugin
skills are picked up. Kimi Code has no non-interactive install CLI.

```bash
# Qoder plugin (skill-compatible host; illustrative commands —
# confirm flags with `qodercli plugin ... --help` at execution time)
qodercli plugin marketplace add ifoohoo/artifact-skill-set --scope user
qodercli plugin install artifact-chain-assistant@artifact-skill-set --scope user --json
qodercli plugin list --json
```

Qoder currently commits to skill installation and discovery only; Claude Code slash commands and
the Stop hook are not provided. Use `qodercli plugin list --json` to check the installed version,
`enabled`, `installPath`, and `skills`. Diagnostics still use the plugin root
`scripts/doctor.mjs`; there is no Qoder adapter doctor.

For the full installation guide, quick start, Agent prompts, and clone onboarding, see
[INSTALL.md](INSTALL.md).

## Quick Start

1. Install plugin 0.13.0 (above) and runtime: `pnpm add -D artifact-graph@0.13.0`.
2. Run `artifact-graph doctor --root . --format json` to verify the runtime.
3. For first-time setup, use the bootstrap skill.
4. For daily work, use the maintainer skill.
5. For teammate onboarding, see [Clone Onboarding in INSTALL.md](INSTALL.md#clone-onboarding-second-developer-setup).

## Agent Prompts

```text
请使用 artifact-chain-bootstrap，为当前项目初始化制品链。
先检查现有配置和制品，不要覆盖已有项目规则，也不要自动执行 bootstrap --force。
```

```text
请使用 artifact-chain-where-am-i 分析这个需求在当前制品链中的位置。
先检索已有制品，再推荐应加载的 context/packet 和后续入口技能。
```

```text
请使用 artifact-chain-maintainer 检查本次变更影响的制品关系，
执行 changed-only refresh，并用 strict-missing-lock 审计；如果锁文件变化，先让我审阅。
```

## License

Apache-2.0. See [LICENSE](LICENSE).
