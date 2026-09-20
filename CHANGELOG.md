# Changelog

## Unreleased

## 0.13.0

### Added

- Added `artifact-chain-restructure` for reviewed record splits, identity splits, cross-file moves,
  renumbering, deterministic apply and recovery routing, and precise orphan-lock cleanup.
- Added workflow-profile resolution for bundled public workers while preserving explicit project
  worker overrides and stable checker output fields.

### Changed

- Raised the supported Node.js range to `>=22.22.2 <23` and synchronized runtime compatibility with
  `artifact-graph@0.13.0`.
- The restructuring apply and recovery path uses the exactly pinned Foundation `0.22.0` public
  file-set capability at `candidate` maturity, qualified only for Darwin / arm64 / APFS.
- Moved the packaged knowledge-site output to `site/` and retained the Codex, Claude Code, and Kimi
  Code adapter surfaces.

## 0.12.0

### Changed

- Declared pnpm `10.30.0` for source development.
- Runtime compatibility, installation commands, plugin manifests, Family API metadata, and adapter
  catalogs are synchronized with `artifact-graph@0.12.0`.
- Foundation runtime wiring and the existing generated-skill checks are unchanged.

## 0.11.0

### Added

- Added `artifact-chain-requirements` for preserving requirement entries, creating incremental
  SPECs, and recording item-level acceptance with evidence and current-artifact destinations.
- Added requirement and SPEC starter templates, requirement transition checks, project-shape and
  adoption-stage readiness guidance, and matching routes across generated host adapters.

### Changed

- Project inventory and task orientation report approval, implementation, verification, and
  release separately. Graph declarations, locks, test files, and release input lists no longer
  stand in for authoritative execution or publication results.

### Breaking Changes

- **Entry skills renamed with the `artifact-chain-` prefix.** In multi-plugin environments the
  bare entry names collided with same-named skills from other plugins and their descriptions
  claimed bare global prompts. The four entries are now `artifact-chain-help` (was `help`),
  `artifact-chain-setup` (was `setup`), `artifact-chain-quickstart` (was `quickstart`), and
  `artifact-chain-where-am-i` (was `where-am-i`) — consistent with the existing
  `artifact-chain-bootstrap` and `artifact-chain-maintainer` naming. No compatibility aliases or
  symlinks are kept. Update prompts, scripts, and docs that referenced the old bare names.
  Method registry refs (`artifact.help`, `artifact.setup`, `artifact.quickstart`) are unchanged;
  only the provider skill names moved.

### Changed

- **`artifact-chain-setup` is now a general install skill.** It still starts with read-only
  diagnostics (plugin closure, Node/CLI, doctor, config, version lock, registry) and a PASS/WARN/FAIL
  report, but after showing a mechanical install plan and receiving explicit user confirmation it
  executes the mechanical steps itself: installing the `artifact-graph` CLI from the plugin's pinned
  install spec, installing/updating Git hooks, injecting the minimal `AGENTS.md` trigger block, and
  creating the thin `CLAUDE.md` pointer — then re-runs diagnostics to verify. Steps are idempotent,
  and outdated existing blocks are reported for user decision instead of being overwritten.
  Project-level decisions (artifact type trimming, `artifact-graph.config.yaml` contract content,
  version-lock bootstrap, full workflow-methodology sections) remain with `artifact-chain-bootstrap`.
  Autonomous or overwriting installs without user confirmation remain forbidden.
- Entry descriptions and the quickstart routing vectors are domain-qualified: they respond to
  artifact-chain/artifact-graph/制品链/版本锁 cues only and no longer claim bare global prompts
  such as "hello", "what can you do", or "is my environment ready". The vague `ask` routing
  target is retired; unclear domain input still gets a clarifying question instead of a guessed
  route.
- Runtime compatibility, installation commands, plugin manifests, Family API metadata, and adapter
  catalogs are synchronized with `artifact-graph@0.11.0`.

## 0.10.0

### Added

- Added the product-owned setup runner and entry-discovery contract to every generated Codex,
  Claude Code, and Kimi Code surface. Setup reports native-binding failures from structured doctor
  output and keeps bootstrap behind explicit write authorization.

### Changed

- Aligned the existing 16-entry method catalog, generated host surfaces, and documentation with the
  canonical `help`, `quickstart`, and `setup` entry semantics.
- Runtime compatibility, installation commands, plugin manifests, Family API metadata, and adapter
  catalogs are synchronized with `artifact-graph@0.10.0`.

### Fixed

- Entry skills resolve shared scripts from the installed plugin root. Their behavior no longer
  depends on the target project's working directory or a parent-repository layout.

## 0.9.4

### Added

- Qoder can consume the existing root plugin package as a skills-only host. This compatibility
  path reuses the shared skills and does not add a Qoder-specific adapter, manifest, commands,
  hooks, or settings.

### Changed

- Host smoke verification now confirms that Qoder's reported install path is isolated and contains
  the shared runtime resource closure plus every expected skill entry point.
- Shared skill descriptions use host-neutral language where the workflow is not specific to Codex,
  so the same guidance remains accurate in Qoder and other supported hosts.
- Runtime compatibility and generated plugin manifests are synchronized with
  `artifact-graph@0.9.4`.

## 0.9.3

### Changed

- Runtime compatibility and generated plugin manifests are synchronized with
  `artifact-graph@0.9.3`. No new skill capabilities in this release.

## 0.9.2

### Changed

- Runtime compatibility and generated plugin manifests are synchronized with
  `artifact-graph@0.9.2`.

## 0.9.1

### Changed

- Runtime compatibility and generated plugin manifests are synchronized with
  `artifact-graph@0.9.1`.
- Revised the `scenario-script` skill documentation and scenario templates across all host
  adapters, and completed release compliance cleanup of the public surface.

## 0.9.0

### Added

- **Kimi Code adapter (third host)**: the plugin now ships `adapters/kimi/` and a root
  `.kimi-plugin/plugin.json`, installable in Kimi Code via
  `/plugins install https://github.com/ifoohoo/artifact-chain-assistant` (interactive, per-user
  scope; run `/reload` afterwards). The Kimi Code adapter mirrors the Codex surface — plugin
  manifest, skills, and managed scripts — without plugin commands, hooks, or settings. Because
  Kimi Code has no non-interactive install CLI, automated host smoke verifies the adapter layout
  deterministically instead of performing a CLI install.

### Changed

- Runtime compatibility and generated plugin manifests are synchronized with
  `artifact-graph@0.9.0`.
- Installation and onboarding documentation now covers Codex, Claude Code, and Kimi Code.

## 0.8.5

### Fixed

- The generated GitHub Pages knowledge site is now part of both the production release snapshot
  and npm package through 15 explicit `docs/` mappings. The release configuration also enables a
  closed-world `expectedPublicSurface` gate so newly added or omitted public files fail preparation
  instead of silently disappearing from the public repository.

### Changed

- Runtime compatibility and generated plugin manifests are synchronized with
  `artifact-graph@0.8.5`.
- Package, Claude, and Codex author metadata now consistently names
  广州市风荷科技有限公司; Apache-2.0 remains unchanged and `ifoohoo` remains the
  public repository owner.

## 0.8.4

### Changed

- The bundled pre-commit hook now reports version-lock refresh outcomes in Chinese and clearly
  explains that a refreshed but unstaged lock is not a validation failure. It provides the exact
  `git diff`, `git add`, and retry commands while preserving the review-before-commit safety gate.
- Runtime compatibility and generated plugin manifests are synchronized with
  `artifact-graph@0.8.4`.

## 0.8.3

### Fixed

- Runtime compatibility now pins `artifact-graph@0.8.3`, the first 0.8.x package containing its
  declared CLI, module, type, and contract payload. The read-only setup check now reads the precise
  repair version from `compatibility.json` instead of embedding a stale version.

### Changed

- The explicit release snapshot now covers the complete npm package file set, including generated
  Family API, validator, schema, and method-query runtime files.

## 0.8.2

### Fixed

- **Nested `author/review` skill reference file projection**: `sync-skills.mjs` now correctly
  projects family-level reference files (`references/{inspect,compose,validate}.md`) into nested
  `author/review` skill directories for `prd-feature` and `scenario-script` families. Both Codex
  and Claude Code adapter surfaces, as well as the root `skills/` tree, include the projected
  reference files. Skills that do not consume reference files no longer receive stale copies.

### Changed

- **Runtime compatibility pinned to `artifact-graph@0.8.2`**: plugin and runtime compatibility,
  marketplace manifests, and adapter manifests verify `artifact-graph@0.8.2` exactly.

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
