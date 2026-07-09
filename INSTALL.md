# Artifact Chain Assistant Installation

This guide separates two responsibilities:

1. Install the assistant plugin into Codex and/or Claude Code.
2. Prepare each target project so the plugin has a project-local artifact chain to manage.

The plugin provides skills, commands, hooks, and guidance. It does not own a target project's
artifacts, graph config, version lock, or project instructions.

## Prerequisites

- Node.js `>=22.0.0`.
- An `artifact-graph` CLI available to the target project.

Preferred CLI setup for a target project:

```bash
pnpm add -D artifact-graph
```

If the package is consumed from a private repository or local checkout, use the equivalent package
manager command or a local development link. The plugin wrappers resolve the CLI in this order:

1. `./node_modules/.bin/artifact-graph`;
2. `artifact-graph` from `PATH`;
3. explicit legacy override from `ARTIFACT_GRAPH_LEGACY_CLI`, only when you intentionally point at
   an older checkout.

Do not hard-code a machine-specific path such as `/absolute/path/to/artifact-graph/dist/cli.js` in project
instructions, hooks, or generated prompts.

## Install The Plugin

### Codex

Install the plugin from the marketplace where this repository is registered:

```bash
codex plugin add artifact-chain-assistant@<marketplace>
```

For local monorepo development, a personal marketplace can point at:

```text
plugins/artifact-chain-assistant/adapters/codex
```

For Git-based installation from this repository, register the Codex marketplace against the Codex
adapter path or use the host's sparse/path mechanism for:

```text
plugins/artifact-chain-assistant/adapters/codex
```

### Claude Code

Add the marketplace and install the plugin:

```bash
claude plugin marketplace add <path-or-repo>/plugins/artifact-chain-assistant/adapters/claude
claude plugin install artifact-chain-assistant@artifact-chain-assistant --scope user
```

Use `--scope project` instead of `--scope user` when a team wants the plugin enabled only for one
project.

For Git-based installation from the monorepo, use the Claude adapter path or sparse/path mechanism
for:

```text
plugins/artifact-chain-assistant/adapters/claude
```

## Prepare A Target Project

Each project must keep its own artifact-chain state:

- `artifacts/**`;
- `artifact-graph.config.yaml`;
- `artifacts/traceability-version-lock.json`;
- project `AGENTS.md`;
- project `CLAUDE.md` if Claude Code is used;
- project-specific skills, reviews, scenario scripts, and workflow rules;
- installed Git hooks and CI policy.

The plugin should not move these files into the plugin repository.

For guided setup, ask the assistant to use the `artifact-chain-bootstrap` skill after reading this
file. That skill is intentionally opt-in: it is for project adoption and migration, not routine
feature work. It helps classify the project, trim artifact types, generate or update
`artifact-graph.config.yaml`, patch `AGENTS.md` and `CLAUDE.md`, initialize or refresh the version
lock, and decide whether Git hooks are ready.

Recommended first assistant prompt after installation:

```text
Read the Artifact Chain Assistant INSTALL.md and use the opt-in artifact-chain-bootstrap skill for
this project. First inspect the project type, existing docs, tests, AGENTS.md, CLAUDE.md, and any
artifact-graph.config.yaml or artifacts directory. Then propose a short initialization plan before
editing files. The plan should cover artifact type trimming, artifact-graph.config.yaml paths and
idPatterns, AGENTS.md Artifact Chain instructions, CLAUDE.md referencing AGENTS.md, version-lock
bootstrap or refresh, and whether Git hooks are ready.
```

### Bootstrap `artifact-graph.config.yaml`

From the target project root, create the initial config:

```bash
artifact-graph init --root .
```

Then edit `artifact-graph.config.yaml` for the target project's real artifact layout. The generated
file is a starting point, not a universal contract. At minimum, confirm:

- every artifact type has the correct `paths`;
- `idPatterns` match the project's ID conventions;
- source/test traceability paths include the implementation files that can contain trace comments;
- project-specific artifact types are added only after their format is stable enough for deterministic
  scanning.

Example small-project config:

```yaml
types:
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
  feature: "^[A-Z]{1,4}\\d+$"
  scenario: "^S-\\d+[a-z]?$"
  decision: "^D-[A-Z]+-\\d+$"
  design: "^[A-Za-z0-9._-]+$"
  test: "^.+\\.(ts|tsx|js|jsx)$"
```

After editing the config, validate the graph:

```bash
artifact-graph validate --root . --warning-only
```

### Initialize The Version Lock

The version lock is project-local state and should live at:

```text
artifacts/traceability-version-lock.json
```

For a new project with no existing lock, bootstrap once after the config and initial traceability
relationships are reviewed:

```bash
artifact-graph version-lock bootstrap
artifact-graph version-lock audit --root . --strict-missing-lock
```

For an existing project, prefer a refresh/audit flow:

```bash
artifact-graph version-lock refresh --all --format markdown
artifact-graph version-lock audit --root . --strict-missing-lock
```

Do not run `artifact-graph version-lock bootstrap --force` as a routine repair. It accepts the
current working tree as the new baseline and can hide stale or accidental traceability changes.

### Recommended `AGENTS.md` Section

Add a project-specific section like this:

```markdown
## Artifact Chain

- This project uses `artifact-chain-assistant` plus the `artifact-graph` CLI.
- Keep artifact sources local: `artifacts/**`, `artifact-graph.config.yaml`, and
  `artifacts/traceability-version-lock.json`.
- Do not hard-code a machine-local `artifact-graph` path. Use `artifact-graph ...` and install the
  CLI as a project dependency or PATH command.
- Treat `artifact-graph.config.yaml` as the project artifact-chain contract. Update it when artifact
  directories, ID formats, source trace paths, or artifact types change.
- Keep `artifacts/traceability-version-lock.json` committed and review diffs before staging it.
- Do not run `artifact-graph version-lock bootstrap --force` unless the user explicitly approves
  accepting the current tree as the new traceability baseline.
- Before implementation work tied to a feature, scenario, decision, design, or E2E test, get context
  with `artifact-graph context --root <project-root> --<type> <ID> --mode implementation`.
- When artifact files, traceability annotations, source files, tests, or verifiers change, refresh
  the lock with `artifact-graph version-lock refresh --changed-only --staged --format markdown`.
- Before claiming completion, run:
  - `artifact-graph validate --root <project-root> --warning-only`;
  - `artifact-graph version-lock audit --root <project-root> --strict-missing-lock`;
  - any project-specific tests or review scripts named elsewhere in this file.
```

If the project has stronger local rules, keep them in `AGENTS.md`. The plugin's generic skills
should defer to project instructions.

### Recommended `CLAUDE.md`

Keep Claude Code instructions thin and point back to `AGENTS.md`:

```markdown
# Claude Code Instructions

Read and follow `AGENTS.md` first. It is the canonical project instruction file.

Claude-specific additions:

- Use the installed `artifact-chain-assistant` plugin for artifact-chain intake and version-lock
  maintenance.
- Treat Claude Code hooks as assistant guardrails only. Git hooks and CI remain the hard gate.
- Do not bypass `AGENTS.md`, `artifact-graph.config.yaml`, or
  `artifacts/traceability-version-lock.json`.
```

## Optional Git Hooks

After the target project has a working `artifact-graph` CLI, install Git hooks from the project root:

```bash
artifact-graph hooks install-git --hook all
```

The hooks are a hard gate. Claude Code hooks and Codex plugin commands are helper guardrails, not a
replacement for Git hooks or CI.

## Smoke Test

Run these from the target project root:

```bash
artifact-graph doctor --format markdown
artifact-graph validate --root . --warning-only
artifact-graph version-lock audit --root . --strict-missing-lock
```

If `artifact-graph doctor` cannot find the CLI or config, fix the target project setup before
relying on plugin skills or hooks.

## What To Remove From An Existing Project

After a project has installed the CLI and plugin, it can remove copied toolkit source directories,
for example an old nested `artifact-graph/` implementation checkout.

Do not remove project-local state:

- `artifact-graph.config.yaml`;
- `artifacts/traceability-version-lock.json`;
- project artifacts under `artifacts/**`;
- project instruction files and local workflow skills.
