# Artifact Chain Assistant

[中文](README.zh-CN.md)

Codex and Claude Code assistant plugin for projects that use `artifact-graph`.

Artifact Chain Assistant packages reusable skills, host-specific adapter manifests, and install
guidance for artifact-chain projects. It helps agents discover the right artifact context, bootstrap
project-local configuration, and maintain traceability version locks.

## What It Provides

### Skills

- **`where-am-i`** — intake and routing. Searches the project artifact graph before
  implementation begins and routes to bootstrap, maintainer, or direct implementation.
- **`artifact-chain-bootstrap`** — opt-in project initialization. Guides first-time setup,
  migration, or repair with an 11-step flow covering config, AGENTS/CLAUDE patching, validation,
  version lock, and hook installation.
- **`artifact-chain-maintainer`** — daily maintenance. Covers version-lock refresh/audit, doctor
  diagnostics, and Git hook updates for projects with an established artifact chain.

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

### Evidence-Based Enablement

Bootstrap only activates extended artifact types when local files or directories exist. For
example, `api_contract` is enabled when OpenAPI/Swagger specs are present; `database_migration`
is enabled when Flyway/Liquibase files exist. No type is enabled on speculation.

### Project Shape Classification

Nine project profiles each map to a recommended starter set and a defer-until-ready list:

- Docs/planning repo · TypeScript library or CLI · API service · Enterprise Java/Spring/JVM ·
  Desktop or full-stack app · Agent or plugin toolkit · Parent or release governance repo ·
  Existing mature artifact repo · Small first-time project

The bootstrap skill classifies the target project and enables only the types that have stable
local sources.

### Starter Templates & Adoption Guide

`templates/extended/` provides onboarding guidance for extended types. After bootstrap, deferred
types and their evidence conditions are documented in the project's artifact catalog so future
profile expansion is a recorded decision rather than an ad-hoc addition.

### Other Assets

- **Codex** exposes `.codex-plugin/plugin.json` and `skills/**`. It does not expose plugin commands,
  hooks, or settings.
- **Claude Code** exposes `.claude-plugin/plugin.json`, `skills/**`, slash command wrappers, and a
  Stop-hook guardrail.
- Git hook templates and installers are host-independent. Git hooks and CI are the hard gates;
  host-specific skills and hooks only provide assistant guidance.

## Install

The npm registry package is not published yet. Install from the public GitHub repository today:

```bash
# Codex
codex plugin marketplace add https://github.com/mzdbxqh/artifact-chain-assistant.git
codex plugin add artifact-chain-assistant@artifact-chain-assistant

# Claude Code
claude plugin marketplace add https://github.com/mzdbxqh/artifact-chain-assistant.git
claude plugin install artifact-chain-assistant@artifact-chain-assistant --scope user
```

After registry publication, npm installation can become the preferred package route.

For Codex/Claude Code plugin setup, target project preparation, and bootstrap flow, read the full
guide: [INSTALL.md](INSTALL.md).

Each target project keeps its own `artifact-graph.config.yaml`, `artifacts/**`,
`artifacts/traceability-version-lock.json`, `AGENTS.md`, and optional `CLAUDE.md`.

## Related Project

Install [`artifact-graph`](https://github.com/mzdbxqh/artifact-graph) in each target project before
using the plugin for hard validation gates.

## License

Apache-2.0. See [LICENSE](LICENSE).
