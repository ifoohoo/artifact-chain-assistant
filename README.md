# Artifact Chain Assistant

[中文](README.zh-CN.md)

Codex and Claude Code assistant plugin for projects that use `artifact-graph`.

Artifact Chain Assistant packages reusable skills, adapter manifests, commands, hooks, and install
guidance for artifact-chain projects. It helps agents discover the right artifact context, bootstrap
project-local configuration, and maintain traceability version locks.

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

## Related Project

Install [`artifact-graph`](https://github.com/mzdbxqh/artifact-graph) in each target project before
using the plugin for hard validation gates.

## License

Apache-2.0. See [LICENSE](LICENSE).
