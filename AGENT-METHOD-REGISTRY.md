# Agent Method Registry

[中文](AGENT-METHOD-REGISTRY.zh-CN.md)

The plugin bundles a deterministic agent-method-registry integration covering catalog resolution,
provider verification, and CLI diagnostics.

## Default Catalog

The default catalog is at `<plugin-root>/agent-methods/catalog.yaml` and registers **15 workflow entries**: 8 specialized PRD/scenario entries, 5 generic workflows, and 2 dedicated requirement/SPEC authoring entries. The 3 operation entries bring the total to 18; v2 family catalogs are separate.

The catalog also includes 3 `kind: operation` entries (`artifact.help`, `artifact.setup`,
`artifact.quickstart`) for read-only discovery and diagnostics; they are not workflow entries
and are omitted from the table below.

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
| `artifact.review` | artifact-review | Review |
| `artifact.repair` | artifact-repair | Repair |
| `artifact.batch` | artifact-batch | Batch |
| `artifact.audit` | artifact-audit | Audit / health |
| `artifact.generate` | artifact-generate | Generate |
| `artifact.requirement.manage` | artifact-chain-requirements | Capture, query, manage and carry requirements into an iteration |
| `artifact.spec.author` | spec-author | Author SPEC and execution inputs after prerequisites |

## Standalone Install

Install `agent-method-registry@0.2.0` as a separate dependency if you only need the registry
capabilities:

```bash
npm install agent-method-registry@0.2.0
```

The CLI is available as `agent-method-registry` after installation.

## v1 Overlay and v2 Binding

Registry 0.2.0 exposes two distinct input models. Callers must keep them separate:

- v1 builds from catalogs and an optional `ProjectOverlayData`. The usual project source is
  `agent-methods/project.yaml`; its `overrides[ref]`, `entries`, and `disabled` fields participate in
  the v1 effective-index build. It is not a v2 binding.
- v2 uses a raw `BindingData` document explicitly selected and parsed by the caller. The document
  contains `bindings` and may contain `serviceBindings`. Pass the complete document through the
  public package-root `bindings` input; do not reinterpret an overlay entry or internal worker as a
  binding.

The minimal v2 public call chain is below. The caller reads or builds `familyApi`,
`implementations`, `inventory`, `bindings`, and `methodQueryCandidate` from their respective
authoritative inputs:

```js
import { buildEffectiveIndex, queryEffectiveIndex } from 'agent-method-registry';

const built = buildEffectiveIndex({
  familyApi,
  implementations,
  inventory,
  bindings,
});
if (!built.ok || !built.index) throw new Error('Registry v2 index build failed');

const recommendation = queryEffectiveIndex({
  index: built.index,
  methodQueryCandidate,
  purpose: 'recommendation',
});
```

Artifact-side adoption records keep the binding-source reference and service identity:
`serviceId`, `apiId`, `apiMajor`, and `apiRevisionDigest`. Consumers use the Registry-returned
`executable`, `installation`, `enablement`, `compatibility`, `trust`, `resolution`, and
`selectionSource` states directly. Do not copy `familyImplementationId`,
`serviceImplementationId`, or provider paths into graph configuration, workflow profiles, or
artifact bodies. An internal project worker is not a Registry binding, and a source path mentioned
in prose does not create an automatic discovery protocol; the caller must still select and read the
binding input explicitly.

## Building the v1 Effective Index

The CLI examples below are v1. The effective index is built from the catalog plus an optional project overlay. First, locate
the installed plugin root from the host CLI. Do **not** use `require.resolve` — marketplace
installations do not place the plugin into the target project's `node_modules`.

**Codex** — use `codex plugin list --json` and the `CODEX_HOME` cache layout:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PLUGIN_ROOT=$(codex plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const data=JSON.parse(d);
      const p=data.installed.find(x=>x.pluginId==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.installed||!p.enabled||!p.marketplaceName||!p.name||!p.version){process.stderr.write('artifact-chain-assistant record incomplete\n');process.exit(1);}
      console.log(require('path').join(process.env.CODEX_HOME,'plugins','cache',p.marketplaceName,p.name,p.version));
    });
  ")
[ -f "$PLUGIN_ROOT/agent-methods/catalog.yaml" ] || { echo "catalog not found at $PLUGIN_ROOT"; exit 1; }
```

**Claude Code** — use `claude plugin list --json` and `installPath` directly:

```bash
PLUGIN_ROOT=$(claude plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const p=JSON.parse(d).find(x=>x.id==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.enabled||!p.installPath){process.stderr.write('artifact-chain-assistant not found, not enabled, or installPath missing\n');process.exit(1);}
      console.log(p.installPath);
    });
  ")
[ -f "$PLUGIN_ROOT/agent-methods/catalog.yaml" ] || { echo "catalog not found at $PLUGIN_ROOT"; exit 1; }
```

> For monorepo development only, the source checkout plugin root is `plugins/artifact-chain-assistant`.
> Marketplace users must use the host CLI discovery above.

After resolving `PLUGIN_ROOT`, verify the target project before running a generic workflow. This
check is read-only:

```bash
node "$PLUGIN_ROOT/scripts/check-workflow-profile.mjs" \
  --root . --action review --domain design-spec --format json
```

Exit code 0 means the required project marker and worker mapping exist. Exit code 2 returns
`NEEDS_INPUT`; add the missing project profile or worker instead of claiming workflow success.

For batch operations, use the split and merge scripts from the same resolved plugin root:

```bash
# Split artifacts into batches (JSON array to stdout)
node "$PLUGIN_ROOT/scripts/batch-split.mjs" ./artifacts/design --batch-size 40000

# Merge batch results from a results directory (merged JSON to stdout)
node "$PLUGIN_ROOT/scripts/batch-merge.mjs" ./batch-results --run-id my-run
```

Then build the index:

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
  --project agent-methods/project.yaml \
  --out .agent-method-registry/effective-index.json
```

## Project-Level Override

When the target project defines its own complete entries, put an
`agent-methods/project.yaml` file in the project root. For example, to override the default
`prd-feature` routing entry with a project-local skill:

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

### Default TEST and Replacement

On `codex` and `claude-code`, test planning and execution use strict Registry 0.2.0 v1 selection. With no override, explicitly adopt the TEST public package's `agent-methods/catalog.yaml`, query for a unique candidate using `testing`, `skill-family`, and `plan` or `run`, then verify the provider with the real host and `strictProvider:true`. Project-owned Skills use project `entries/overrides` and real `projectRoots`; an external plugin uses a user-selected catalog with a different ref and disables the original default ref. Invoke only verified providers. Disabled defaults, invalid overlays, missing directories/entries/verification roots, ambiguity, and same-ref catalog conflicts never silently fall back to TEST. Other hosts retain their existing public contracts; P1 is not claimed across every host.

## Effective Index Is a Generated Cache

The v1 `.agent-method-registry/effective-index.json` is a **generated build artifact**, not a source
of truth. It is derived from `catalog.yaml` plus the optional `project.yaml` overlay. A v2 index must
likewise be built through the Registry public API from Family API, implementation, inventory, and raw
binding inputs; it must not be handwritten.

- Do not edit it manually.
- Rebuild it when the catalog or project overlay changes.
- Do not commit it to version control unless the project explicitly opts in.

## Compact Query for Planners

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
  --plugin-root "$PLUGIN_ROOT/skills"
```

## Closed-Loop Workflow Entries

All 8 specialized entries have `kind: workflow`. A `workflow` entry is a **closed-loop leaf** -- it
self-completes its own inspect, compose, review, validate, and repair cycle. The outer
planner should not schedule separate review or repair steps for a workflow entry.

## Registry Unavailable: Fallback Behavior

When `agent-method-registry` is not installed, the effective index does not exist, or a required binding is missing,
`artifact-chain-where-am-i` follows this behavior:

1. Outputs a `"registry unavailable"` diagnostic.
2. For dynamic contract-backed professional services, returns `NEEDS_INPUT` with the missing-input message — **no fallback to builtin or config routing**.
3. Static help, ordinary graph queries, generic non-contract-backed entries, and existing fixed direct calls continue under their own contracts.
4. Does **not** attempt to merge catalogs manually or create an empty effective index.

## Locating the Plugin Root

To find the installed plugin root, use your host CLI. Do **not** use `require.resolve` —
marketplace installations do not place the plugin into the target project's `node_modules`.

**Codex**:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PLUGIN_ROOT=$(codex plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const data=JSON.parse(d);
      const p=data.installed.find(x=>x.pluginId==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.installed||!p.enabled||!p.marketplaceName||!p.name||!p.version){process.stderr.write('plugin record incomplete\n');process.exit(1);}
      console.log(require('path').join(process.env.CODEX_HOME,'plugins','cache',p.marketplaceName,p.name,p.version));
    });
  ")
```

**Claude Code**:

```bash
PLUGIN_ROOT=$(claude plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const p=JSON.parse(d).find(x=>x.id==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.enabled||!p.installPath){process.stderr.write('plugin not found, not enabled, or installPath missing\n');process.exit(1);}
      console.log(p.installPath);
    });
  ")
```

Then use it in resolve commands:

```bash
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host codex \
  --plugin-root "$PLUGIN_ROOT/skills"

agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host claude-code \
  --plugin-root "$PLUGIN_ROOT/skills"
```
