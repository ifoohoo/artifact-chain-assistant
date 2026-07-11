# Changelog

## Unreleased

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
