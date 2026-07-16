# Changelog

## Unreleased

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
- **Installation documentation governance**: `docs/public/artifact-chain-assistant/INSTALL.md` is the parent authoring source of truth; plugin and adapter `INSTALL.md` are generated copies. npm registry is the default install path with GitHub tag fallback.
- **Human quick start**: step-by-step guide covering plugin install, runtime install, doctor verification, bootstrap, where-am-i, and maintainer.
- **Agent prompts**: copy-paste prompts for Codex/Claude Code to enter bootstrap, where-am-i, and maintainer skills.
- **Clone onboarding**: second-developer recovery path with frozen lockfile install, doctor validation, strict audit, local index rebuild, and per-machine hook installation. Git-tracked files are authoritative; `.artifact-graph/` and `.agent-method-registry/` are derived caches.
- **Runtime compatibility matrix**: README and INSTALL document the exact plugin 0.3.1 / `artifact-graph` 0.3.1 verified combination.
- **Version guardrail**: compatibility policy enforces precise version pinning; bare `artifact-graph`, `@latest`, `@^0.3.1`, and unpinned GitHub URLs are rejected in fenced install commands.

### Changed

- Default runtime install path changed from GitHub (`github:mzdbxqh/artifact-graph`) to npm registry (`pnpm add -D artifact-graph@0.3.1`).
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
