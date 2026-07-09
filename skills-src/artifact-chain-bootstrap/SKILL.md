---
name: artifact-chain-bootstrap
description: Use when a target project is adopting artifact-chain-assistant, after reading INSTALL.md, or when bootstrapping artifact-graph.config.yaml, AGENTS.md, CLAUDE.md, version locks, Git hooks, or artifact type trimming for a project.
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
2. Read `INSTALL.md` from the plugin if present.
3. Inspect existing `AGENTS.md`, `CLAUDE.md`, `README.md`, `artifact-graph.config.yaml`, `artifacts/**`, `src/**`, `test/**`, and package/workspace files.
4. Run `artifact-graph --help` and `artifact-graph doctor --root <root> --format json` if the CLI is available.
5. Classify the project shape before writing config.

## Project Shape And Trimming Rules

Use only artifact types that have stable local sources.

| Project shape | Start with | Usually defer |
| --- | --- | --- |
| Docs/planning repo | `feature`, `scenario`, `decision`, `design` | `test`, `e2e_test` until trace comments/tests exist |
| TypeScript library or CLI | `feature`, `decision`, `design`, `test` | `scenario` if no scenario scripts exist |
| Desktop or full-stack app | `feature`, `scenario`, `decision`, `design`, `test`, `e2e_test` | custom entities until registry format is stable |
| Existing mature artifact repo | types already present in `artifacts/**` | any type without templates or ID rules |
| Small project trying artifact-chain for the first time | `feature`, `decision`, `test` | everything else until useful |

Prefer a small correct graph over a large noisy one. Add more types only after the project has
templates, ID patterns, and review rules for them.

## Bootstrap Flow

1. If no config exists, run `artifact-graph init --root <root>`.
2. Edit `artifact-graph.config.yaml` to match real directories and IDs.
3. Create missing base directories only when useful, such as `artifacts/prd/features`,
   `artifacts/decisions`, or `artifacts/scenarios`.
4. Add or update an `AGENTS.md` Artifact Chain section with project-local paths, config ownership,
   lock ownership, CLI usage, refresh/audit commands, and the `bootstrap --force` warning.
5. If Claude Code is used, make `CLAUDE.md` a thin pointer to `AGENTS.md` plus Claude-specific notes.
6. Run `artifact-graph validate --root <root> --warning-only`.
7. For a new project, run `artifact-graph version-lock bootstrap` only after config and initial
   relationships are reviewed. For an existing project, prefer `artifact-graph version-lock refresh
   --all --format markdown`.
8. Run `artifact-graph version-lock audit --root <root> --strict-missing-lock`.
9. Offer `artifact-graph hooks install-git --hook all` only after validation and audit pass.

## Config Guidance

Generate config from evidence. Common path patterns:

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

Remove any type whose `paths` do not exist and are not part of the immediate adoption plan.

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

## Output Contract

When finishing bootstrap, report:

- project shape and selected artifact types;
- files created or modified;
- exact validation commands and results;
- whether version lock was bootstrapped, refreshed, or left unchanged;
- remaining manual choices before enabling Git hooks.
