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

### Professional Skill Families

Two artifact-bound skill families provide specialized authoring, review, and repair workflows:

- **`prd-feature`** — write, review, or repair PRD feature artifacts. Each flow is self-contained:
  once entered, the flow completes its own inspect → compose/review → validate → repair cycle without
  requiring the outer planner to split review/repair steps.
- **`scenario-script`** — write, review, or repair scenario script artifacts. Same closed-loop
  contract as `prd-feature`.

Each family exposes four public entries: default routing entry, `author`, `review`, and `repair`.
Internal workflow resources (`inspect`, `compose`, `validate`) are not registered as catalog methods.

Project-level configuration and project-local providers take priority. The plugin's default skill
families serve as fallback when the project has no overriding provider.

### Agent Method Registry

The plugin ships with a deterministic agent-method-registry integration for catalog resolution,
provider verification, and CLI diagnostics.

**Default catalog**: `<plugin-root>/agent-methods/catalog.yaml` registers **8 workflow entries**
across the `prd-feature` and `scenario-script` skill families:

| Ref | Family | Entry |
|-----|--------|-------|
| `artifact.prd-feature.default` | prd-feature | Default routing entry |
| `artifact.prd-feature.author` | prd-feature | Author |
| `artifact.prd-feature.review` | prd-feature | Review |
| `artifact.prd-feature.repair` | prd-feature | Repair |
| `artifact.scenario-script.default` | scenario-script | Default routing entry |
| `artifact.scenario-script.author` | scenario-script | Author |
| `artifact.scenario-script.review` | scenario-script | Review |
| `artifact.scenario-script.repair` | scenario-script | Repair |

#### Standalone Install

Install `agent-method-registry@0.1.1` as a separate dependency if you only need the registry
capabilities:

```bash
npm install agent-method-registry@0.1.1
```

The CLI is available as `agent-method-registry` after installation:

```bash
PLUGIN_ROOT=$(node -e "console.log(require.resolve('artifact-chain-assistant/package.json').replace('/package.json',''))")

npx agent-method-registry validate --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml"
npx agent-method-registry query --index .agent-method-registry/effective-index.json
```

#### Building the Effective Index

The effective index is built from the catalog plus an optional project overlay:

```bash
# Catalog only (no project provider)
agent-method-registry index \
  --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml" \
  --out .agent-method-registry/effective-index.json
```

When no project provider file exists, the registry does **not** create an empty overlay file.
It builds the effective index from the catalog alone. The `--project` flag is only needed when
the project defines overrides or disables:

```bash
# Catalog + project overlay
agent-method-registry index \
  --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml" \
  --project "$PLUGIN_ROOT/agent-methods/project.yaml" \
  --out .agent-method-registry/effective-index.json
```

#### Project-Level Override

When the target project has its own complete entry definition, place a
`agent-methods/project.yaml` in the project root. Example -- override the default
`prd-feature` routing entry to use a project-local skill:

```yaml
schemaVersion: 1
overrides:
  artifact.prd-feature.default:
    provider:
      scope: project
      skill: prd-feature
```

The project overlay can also add new entries (via `entries`) and disable plugin entries
(via `disabled`).

#### Effective Index Is a Generated Cache

`.agent-method-registry/effective-index.json` is a **generated build artifact**, not a source
of truth. It is derived from `catalog.yaml` plus the optional `project.yaml` overlay.

- Do not edit it manually.
- Rebuild it when the catalog or project overlay changes.
- Do not commit it to version control unless the project explicitly opts in.

#### Compact Query for Planners

Use `--format compact` to get a minimal view for planning. Compact queries return only
`ref`, `kind`, and `summary` -- enough for the planner to select an entry without loading
full metadata. After selection, use `resolve` to get the provider path:

```bash
# Compact query: planner sees ref/kind/summary only
agent-method-registry query \
  --index .agent-method-registry/effective-index.json \
  --domain artifact --artifact-type prd-feature \
  --kind workflow --format compact

# Resolve after selection: get full provider path
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host claude-code \
  --plugin-root <plugin-root>/adapters/claude/skills
```

#### Closed-Loop Workflow Entries

All 8 entries have `kind: workflow`. A `workflow` entry is a **closed-loop leaf** -- it
self-completes its own inspect, compose, review, validate, and repair cycle. The outer
planner should not schedule separate review or repair steps for a workflow entry.

#### Registry Unavailable: Fallback Behavior

When `agent-method-registry` is not installed or the effective index does not exist,
`where-am-i` follows this fallback:

1. Outputs a `"registry unavailable"` diagnostic.
2. Falls back to existing project configuration and plugin routing logic (config-driven
   artifact types, skill routing decision tree).
3. Does **not** attempt to merge catalogs manually or create an empty effective index.

#### Locating the Plugin Root

To find the plugin root from an installed package:

```bash
# npm / pnpm: resolve the package directory
PLUGIN_ROOT=$(node -e "console.log(require.resolve('artifact-chain-assistant/package.json').replace('/package.json',''))")
```

Then use it in resolve commands:

```bash
# Codex
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host codex \
  --plugin-root "$PLUGIN_ROOT/adapters/codex/skills"

# Claude Code
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host claude-code \
  --plugin-root "$PLUGIN_ROOT/adapters/claude/skills"
```

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
