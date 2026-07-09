# Artifact Chain Assistant

Codex and Claude Code assistant plugin for artifact-chain projects.

This plugin packages reusable skills, adapter manifests, commands, hooks, and installation guidance
for projects that use `artifact-graph`.

## What It Provides

- `where-am-i`: intake and routing for artifact-chain projects.
- `artifact-chain-maintainer`: version-lock, audit, doctor, and hook maintenance guidance.
- `artifact-chain-bootstrap`: opt-in project initialization skill.
- Codex and Claude Code adapter assets.
- Git hook templates and installers.

## Install

Read the full guide:

```text
INSTALL.md
```

Each target project keeps its own `artifact-graph.config.yaml`, `artifacts/**`,
`artifacts/traceability-version-lock.json`, `AGENTS.md`, and optional `CLAUDE.md`.

## License

MIT
