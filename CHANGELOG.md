# Changelog

## 0.8.1

### Breaking Changes

- **`artifact-chain-help` renamed to `help`**: the `artifact-chain-help` skill is now `help`. The old name is not preserved as an alias. Update any prompts or scripts that reference `artifact-chain-help`.
- **New entry skills `setup` and `quickstart`**: `setup` provides read-only environment diagnostics; `quickstart` routes user intent to the correct skill. Both are `kind: operation` in the agent-method catalog.
- **Self-marketplace removed**: the plugin no longer ships `.agents/plugins/marketplace.json` or `.claude-plugin/marketplace.json`. Installation now uses the external `ifoohoo/artifact-skill-set` marketplace. Root `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` are retained for external marketplace discovery.

### Changed

- **Deterministic release manifests clarified**: root plugin manifests now describe external marketplace
  installation flow — the marketplace entry uses these root manifests to discover host-specific adapter
  skills at `./adapters/claude` and `./adapters/codex`.

## 0.8.0

### Changed

- **Runtime compatibility pinned to `artifact-graph@0.8.0`**: plugin and runtime compatibility,
  marketplace manifests, and adapter manifests verify `artifact-graph@0.8.0` exactly.
- **Fail-closed Registry-unavailable guidance**: installation guidance now distinguishes generic
  configuration-driven routing from contract-backed services. Contract-backed service resolution
  returns `NEEDS_INPUT` when Registry is unavailable instead of claiming a built-in or project
  configuration fallback.
- **Deterministic release manifests**: Claude and Codex root plugin manifests are generated as
  byte-identical copies of their authoritative adapter manifests for release assessment and package
  verification. Marketplace installation sources remain `./adapters/claude` and `./adapters/codex`;
  the repository root is not presented as an alternate host installation surface.
- **Unified marketplace installation**: the supported Codex and Claude Code installation path now
  adds the external `ifoohoo/artifact-skill-set` marketplace and installs
  `artifact-chain-assistant@artifact-skill-set`. The plugin payload remains in
  `ifoohoo/artifact-chain-assistant`; the marketplace entry must publish and enable version 0.8.0
  before users install it.

## 0.7.0

### Added

- **Registry v2 SPI discovery in where-am-i**: the `where-am-i` skill now dynamically discovers
  professional skill families through the agent-method-registry v2 SPI and reports project facts as
  a structured evidence envelope, instead of relying on a static family list.
- **artifact-chain-help skill**: new `artifact-chain-help` skill as the discoverable entry point
  for plugin capabilities, workflows, and guidance.
- **Family API compile/validate toolchain**: deterministic compile and validate tooling for skill
  family API contract definitions, with the generated family catalog synced to both Codex and
  Claude Code adapter roots.

### Changed

- **agent-method-registry 0.2.0**: runtime dependency upgraded to `agent-method-registry@0.2.0`
  (Registry v2 with SPI identity binding and lock).
- **Organization migration to `ifoohoo`**: the public repository transferred to the `ifoohoo`
  GitHub organization (`ifoohoo/artifact-chain-assistant`, name unchanged). Copyright is now held
  by 广州市风荷科技有限公司 (Guangzhou Fenghe Technology Co., Ltd.) together with the project
  contributors; the NOTICE file states that the organization transfer is an administrative hosting
  change, not a copyright assignment. Marketplace manifests, installation docs, and repository
  references were updated accordingly; the plugin and npm package names are unchanged.

## 0.6.1

### Changed

- **Version compatibility upgrade**: plugin and runtime compatibility pinned to `artifact-graph@0.6.1`.
- **Hook staged-config branch**: existing pre-commit hooks installed before 0.6.0 can gain the
  staged config → `version-lock refresh --all` branch by re-running `artifact-graph hooks install-git`
  (idempotent). No hook business logic changes in this release.

## 0.6.0

### Changed

- **E2E coverage proof**: artifact-chain-assistant profiles and templates now reference the 0.6.0
  E2E coverage proof mechanism from artifact-graph. Chain spec updated with TC status lifecycle,
  chain_type vocabulary, deterministic checklist rules, and ac_coverage_rate schema.

## 0.5.0

### Added

- **Workflow Profile schema and validation**: add `artifact-workflow-profile.schema.json` to `schemas/` and
  `scripts/lib/workflow-profile.mjs` shared library for project workflow profile validation. Both are
  synced to Codex and Claude Code adapter roots via runtime bundles.
- **Generate entry in agent-method catalog**: add `artifact.generate` workflow entry for generic
  non-PRD/non-scenario artifact generation from templates and profile configuration. Catalog version
  bumped to 0.5.0; total workflow entries now 13.
- **Adapter layout test coverage**: adapter-layout tests verify `schemas/artifact-workflow-profile.schema.json`
  exists in each host adapter root; adapter-resource-scripts tests verify `scripts/lib/workflow-profile.mjs`
  presence and executable mode parity.

### Changed

- **AGENTS.md dispatch rules**: replace local skill names (`goal-workflow-planner`, `loop-run-generator`,
  `claude-code-loop`) with unified global FQN `loop-agent` for long-task planning and L0~L3 loop management.
- **Package required paths**: add `schemas/artifact-workflow-profile.schema.json` and
  `scripts/lib/workflow-profile.mjs` (plus adapter copies) to required package paths for both Codex and
  Claude Code adapter surfaces.
- **Single resolver and real validator execution**: route public, dedicated, audit, project, and legacy
  profiles through `scripts/lib/workflow-profile.mjs`; execute validators in order and fail closed with
  structured evidence.
- **Recursive skill synchronization**: synchronize nested PRD/scenario author, review, and repair skills
  to both adapters and make both drift checks reject nested changes.
- **Review Result consumer contract**: repair workflows now consume only validated protocol fields,
  reject unknown top-level fields, require `attempt` to be 1–3, require producer identity for successful
  PASS decisions, reject PASS with open block findings, and reject acceptance/self-acceptance violations by
  stable `executor + name`. This is an intentional Review Result v1.0 consumption-compatibility tightening:
  migrate legacy top-level fields into protocol sections and run
  `artifact-graph validate-review-result --file <result.json> --format json` before supplying a result.

- `.artifact-review.json` remains read-only compatible in 0.5.x and is planned for removal in 0.6.0;
  `artifact-profiles/project.yaml` is the canonical format.
- `@tc` remains a compatibility alias for `e2e_test` but now emits `E2E-TRACE-007`; use
  `@e2e_test` in new and migrated code comments.

### Fixed

- Public workers now resolve from the installed source/adapter root, missing workflow domains no longer
  pass, `@tc` maps to `e2e_test` with a warning, and unknown unregistered trace tags are ignored.
- Pre-commit refresh switches to `--all` whenever `artifact-graph.config.yaml` is staged, so config
  path/type changes cannot leave a false-fresh changed-only lock.

## 0.4.1

### Fixed

- **Adapter runtime bundle completeness**: add `check-workflow-profile.mjs`, `batch-split.mjs`, and `batch-merge.mjs` to the managed file list in `build-runtime-bundles.mjs`, so both Codex and Claude Code adapter roots include all scripts referenced by the four generic artifact workflow skills. Previously only `scripts/doctor.mjs` was synced, leaving skill script references unresolvable from installed adapter paths.
- **Batch skill path correction**: fix `artifact-batch` skill CLI examples from bare `node scripts/batch-*.mjs` (which resolves from the target project cwd) to `node "$PLUGIN_ROOT/scripts/batch-*.mjs"`. Remove unreliable `import.meta.dirname` root derivation and `pathToFileURL` dynamic import tutorials (YAGNI for agent workflows). Deterministic script section now directs agents to resolve `PLUGIN_ROOT` via the installed adapter's INSTALL.md host discovery and returns `NEEDS_INPUT` when scripts are missing. INSTALL.md and README adapter surface descriptions updated to include managed scripts alongside skills.

## 0.4.0

### Added

- Add `artifact-review`, `artifact-repair`, `artifact-batch`, and `artifact-audit` for non-PRD,
  non-scenario artifacts, with Codex and Claude Code adapters.
- Add Review Result Protocol v1.0 integration, deterministic batch split/merge scripts, and
  read-only profile/worker readiness checks that fail closed with `NEEDS_INPUT`.
- Expand the method catalog to 12 non-overlapping workflow entries and test type+intent uniqueness.

## 0.3.1

### Added

- **Precise runtime compatibility**: `artifact-chain-assistant` 0.3.1 verifies `artifact-graph@0.3.1` exactly. `compatibility.json` is the machine-readable single source of truth for the plugin/runtime version combination.
- **Compatibility checker**: `check-compatibility.mjs` validates plugin version consistency across `package.json`, marketplace manifests, adapter manifests, and prevents forbidden unlocked install patterns in public documentation.
- **Doctor version diagnosis**: plugin `doctor` inspects the target project's locally installed `artifact-graph` version before forwarding to the underlying CLI. Reports `cli_not_found`, `version_mismatch`, `version_unresolved` with exact remediation commands (`pnpm add -D artifact-graph@0.3.1`).
- **Installation documentation governance**: `INSTALL.md` is the authoritative installation guide; plugin and adapter copies are generated from it to ensure consistency. npm registry is the default install path with GitHub tag fallback.
- **Human quick start**: step-by-step guide covering plugin install, runtime install, doctor verification, bootstrap, where-am-i, and maintainer.
- **Agent prompts**: copy-paste prompts for Codex/Claude Code to enter bootstrap, where-am-i, and maintainer skills.
- **Clone onboarding**: second-developer recovery path with frozen lockfile install, doctor validation, strict audit, local index rebuild, and per-machine hook installation. Git-tracked files are authoritative; `.artifact-graph/` and `.agent-method-registry/` are derived caches.
- **Runtime compatibility matrix**: README and INSTALL document the exact plugin 0.3.1 / `artifact-graph` 0.3.1 verified combination.
- **Version guardrail**: compatibility policy enforces precise version pinning; bare `artifact-graph`, `@latest`, `@^0.3.1`, and unpinned GitHub URLs are rejected in fenced install commands.

### Changed

- Default runtime install path changed from GitHub (`github:ifoohoo/artifact-graph`) to npm registry (`pnpm add -D artifact-graph@0.3.1`).
- `doctor.mjs` now performs version pre-check before forwarding to underlying `artifact-graph doctor`.
- Bootstrap and maintainer skills now run compatibility diagnosis before first-time adoption, upgrade, and daily operations.
- `check:compatibility` added to plugin test gate.

## 0.3.0

### Added

- **Agent method registry integration**: deterministic catalog resolution, provider verification, and CLI diagnostics via `agent-method-registry@0.1.1`. Ships with default catalog of 8 workflow entries across `prd-feature` and `scenario-script` skill families.
- **Professional skill families**: `prd-feature` and `scenario-script` each provide default entry, author, review, and repair closed-loop flows. Internal inspect/compose/validate workflows are not exposed as catalog methods.
- **Custom type runtime support**: `artifact-graph` now provides config-driven scanning, relation building, context/packet, validate, and version-lock for any registered Markdown type via `artifact-graph.config.yaml`.
- **Dynamic `--target` selector**: unified `--target <type>:<id>` for context, packet, packet-prompt, and audit commands; legacy `--feature`, `--scenario`, `--decision`, `--design`, `--e2e-test` flags remain compatible.
- **Generic Markdown frontmatter parser**: registered custom types (e.g., `api_contract`, `data_contract`, `db_migration`) are parsed from frontmatter with config-declared `extraFields` (string, number, boolean, enum).

### Changed

- Scenario-PRD validation (`--include scenario-prd-links`) is now opt-in instead of unconditionally executed.
- Sync skills script now recursively copies all `skills-src/**` SKILL.md files instead of only the three original skills.

## 0.2.0

### Added

- Standalone Codex and Claude Code marketplace adapters with independent install/upgrade flows. See [INSTALL.md](INSTALL.md) for host-specific instructions.
- Self-contained runtime bundles with integrity checksums; `build:runtime` generates `runtime/bundles/` and `runtime/bundles.integrity.json`.
- Generated skill inventory: `sync:skills` scans `skills-src/` and produces `skills/` plus `skills/manifest.json`; `sync:skills:check` enforces CI drift detection.
- Claude Stop-hook / version-lock guardrail (`runtime/claude/version-lock-stop.mjs`) that pre-validates artifact versions before commit.
- Real dual-host installation smoke test (`public:smoke-hosts`) validating Codex and Claude Code plugin wiring end-to-end.
- Executable install/upgrade workflow (`scripts/doctor.mjs`) that detects host, checks prerequisites, and reports actionable remediation.
- Extended artifact catalog with config-driven opt-in types: `api_contract`, `data_contract`, `integration_contract`, `batch_job_contract`, `database_migration`, `security_review`, `performance_budget`, `migration_plan`, `deployment_manifest`, `runbook`, and more. See [EXTENDED-ARTIFACT-CATALOG.md](EXTENDED-ARTIFACT-CATALOG.md) for per-type paths, ID patterns, and lifecycle rules.
- Evidence-based enablement: bootstrap only activates extended artifact types when local files or directories exist (e.g., enable `api_contract` when OpenAPI specs are present; enable `database_migration` when Flyway/Liquibase files exist).
- Project shape classification with 9 profiles (Docs/planning, TypeScript CLI, API service, Enterprise Java/Spring/JVM, Desktop/full-stack, Agent/plugin toolkit, Parent/release governance, Existing mature artifact, Small first-time project). Each profile maps to a recommended starter set and a defer-until-ready list.
- Starter templates in `templates/extended/` for onboarding guidance on extended artifact types.
- Template adoption guide: bootstrap documents deferred types and their evidence conditions so future profile expansion is a recorded decision, not an ad-hoc addition.
- Enterprise Java/Spring/JVM delivery chain case study covering 6 phases from requirements to post-release traceability, with concrete artifact ID examples and a completion gate.
- Plugin-layer extended catalog/template/evidence enablement delivered as opt-in bootstrap behavior.

### Changed

- Document the current GitHub marketplace install and upgrade flows for Codex and Claude Code, and clarify that Git hooks and CI remain the hard gate.
- Expand `release-verifier` sub-agent to check CHANGELOG completeness and GitHub Release readiness.
- Document CHANGELOG format standard (Keep a Changelog style with category headings).
- Document version decision rules (semver based on CHANGELOG content).
- Add GitHub Releases creation step to publish workflow.
- Reference release-policy.md for version/CHANGELOG/GitHub Releases procedures in SKILL.md.

## 0.1.4

### Changed

- Publish Artifact Chain Assistant as a standalone public plugin package.
- Add Codex and Claude Code adapters.
- Add opt-in bootstrap, maintainer, and intake skills.
- Add package README, Chinese README, NOTICE, and Apache-2.0 license files.
