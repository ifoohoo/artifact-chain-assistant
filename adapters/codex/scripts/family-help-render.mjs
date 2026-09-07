#!/usr/bin/env node
// @feature ACA18 @scenario S-65 @decision D-ACA-18
// Deterministic renderer for help skill.
// Reads Family API catalog, implementation samples, and optional projection;
// outputs Markdown help text. Fail-closed: projection parse failure → NOT_AVAILABLE.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMinimalYaml } from './lib/inline-yaml-parser.mjs';
import { validateCatalogConsistency, validateFamilyApi } from './lib/family-api-validator.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export async function renderHelp({ projectionPath, pluginRoot } = {}) {
  const base = pluginRoot || root;
  const sections = [];

  // 1. Load and render Family API Catalog
  const catalogPath = join(base, 'family-apis', 'catalog.json');
  let catalog;
  try {
    catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  } catch {
    sections.push('## Standard Family API\n\n> Family API catalog not found or invalid.\n');
    return sections.join('\n---\n\n');
  }

  const apiSummary = await renderApiCatalog(catalog, base);
  sections.push(apiSummary);

  // 2. Load and render bundled legacy implementations
  const familiesDir = join(base, 'families-src');
  const legacySection = await renderLegacyMethods(familiesDir);
  sections.push(legacySection);

  // 3. Render installation status from optional projection
  const statusSection = await renderInstallationStatus(projectionPath);
  sections.push(statusSection);

  // 4. Adoption steps
  sections.push(renderPublicWorkflowDivision());
  sections.push(renderAdoptionSteps());

  return sections.join('\n---\n\n');
}

async function renderApiCatalog(catalog, base) {
  const lines = ['## Standard Family API', ''];

  if (!catalog.families || catalog.families.length === 0) {
    lines.push('> No standard families registered.\n');
    return lines.join('\n');
  }

  const loadedFamilies = [];
  const diagnostics = [];
  for (const family of catalog.families) {
    const api = await loadApi(join(base, 'family-apis', family.apiPath));
    if (!api) {
      diagnostics.push(`${family.id}@${family.major}: API file missing or invalid JSON`);
      continue;
    }
    const validation = await validateFamilyApi(api, { sourcePath: family.apiPath });
    if (!validation.ok) {
      diagnostics.push(...validation.errors.map(error => `${family.id}@${family.major}: ${error.code} ${error.path} ${error.message}`));
      continue;
    }
    loadedFamilies.push({ family, api });
  }

  const consistency = validateCatalogConsistency(catalog, loadedFamilies.map(({ api }) => ({
    id: api.api.id,
    major: api.api.major,
    content: api,
  })));
  diagnostics.push(...consistency.errors);
  if (diagnostics.length > 0) {
    lines.push('> Standard Family API catalog is unavailable because deterministic validation failed.');
    lines.push('>');
    for (const diagnostic of diagnostics) lines.push(`> - ${diagnostic}`);
    return lines.join('\n');
  }

  // Summary table
  lines.push('| Family | Major | Services | Summary |');
  lines.push('|--------|-------|----------|---------|');

  for (const { family, api } of loadedFamilies) {
    const serviceNames = (api.services || []).map(s => s.id.split('.').pop()).join(', ');
    lines.push(`| ${family.id} | ${family.major} | ${serviceNames} | ${family.summary || api.api?.summary || ''} |`);
  }

  // Detailed per-family sections
  for (const { family, api } of loadedFamilies) {
    lines.push('');
    lines.push(`### ${family.id}@${family.major}`);
    lines.push('');
    lines.push(api.api?.summary || '');
    lines.push('');
    lines.push('**Services:**');

    for (const svc of api.services || []) {
      const required = svc.required ? 'required' : 'optional';
      const discoverable = svc.discoverable?.default ? ' [DEFAULT]' : (svc.discoverable?.help ? ' [HELP]' : '');
      lines.push(`- \`${svc.id.split('.').pop()}\` (${required}, ${svc.kind})${discoverable} — ${renderServiceSummary(svc)}`);
    }

    // Contract refs
    const contractRefs = new Set();
    for (const svc of api.services || []) {
      for (const ref of [...(svc.accepts || []), ...(svc.produces || [])]) {
        if (typeof ref === 'string' && ref.includes('@')) {
          contractRefs.add(ref);
        }
      }
    }
    if (contractRefs.size > 0) {
      lines.push(`**Artifact Contracts:** ${[...contractRefs].join(', ')}`);
    }

    // Capabilities
    if (api.capabilities && api.capabilities.length > 0) {
      lines.push('');
      lines.push('**Capabilities:**');
      for (const cap of api.capabilities) {
        lines.push(`- ${cap.id}: ${cap.summary}`);
      }
    }
  }

  return lines.join('\n');
}

function renderServiceSummary(svc) {
  const parts = [];
  if (svc.intents) parts.push(`intents: ${svc.intents.join(', ')}`);
  if (svc.sideEffectCeiling) parts.push(`ceiling: ${svc.sideEffectCeiling}`);
  return parts.length > 0 ? parts.join('; ') : svc.id;
}

async function renderLegacyMethods(familiesDir) {
  const lines = ['## Bundled Legacy Methods', ''];
  lines.push('These bundled families predate the standard Family API system.');
  lines.push('They are recorded as migration samples and do NOT claim Family API conformance.');
  lines.push('');

  let found = false;
  try {
    for (const entry of await readdir(familiesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const implPath = join(familiesDir, entry.name, 'implementation.yaml');
      try {
        const content = await readFile(implPath, 'utf8');
        const impl = parseMinimalYaml(content);
        if (!impl) continue;
        found = true;
        const status = impl.targetApiStatus === 'pending' ? 'pending (no published Family API)' : impl.targetApiStatus || 'unknown';
        const ownership = impl.lifecycle?.ownership || 'unknown';
        const maturity = impl.lifecycle?.maturity || 'unknown';
        lines.push(`### ${entry.name} (${maturity})`);
        lines.push(`- Status: targetApiStatus: ${status}`);
        lines.push(`- Ownership: ${ownership}`);
        const serviceIds = impl.services ? Object.keys(impl.services) : [];
        const serviceNames = serviceIds.map(s => s.split('.').pop());
        lines.push(`- Services: ${serviceNames.join(', ')}`);
        lines.push('- Note: Does NOT claim Family API conformance');
        lines.push('');
      } catch {
        // No implementation.yaml — skip
      }
    }
  } catch {
    // families-src directory not found
  }

  if (!found) {
    lines.push('> No bundled legacy family implementations found.\n');
  }

  return lines.join('\n');
}

async function renderInstallationStatus(projectionPath) {
  const lines = ['## Installation Status', ''];
  lines.push('Registry projection: **NOT_AVAILABLE** (REGISTRY_V2_REQUIRED)');
  lines.push('');
  lines.push('Dynamic provider state is intentionally unavailable until the Registry v2 projection verifier is integrated.');
  if (projectionPath) lines.push('The supplied projection was ignored; assistant-side marker checks are not an authority.');
  return lines.join('\n');
}

function renderAdoptionSteps() {
  return `## Getting Started

1. **Learn**: Review the Standard Family API above to understand available capabilities.
2. **Check**: Run \`artifact-chain-setup\` for read-only environment diagnosis; review its plan before authorizing mechanical installation.
3. **Capture**: Run \`artifact-chain-requirements\` to save or query ideas even when project config and Registry are absent.
4. **Bootstrap**: Run \`artifact-chain-bootstrap\` (with user authorization) for project-level configuration decisions.
5. **Orient**: Run \`artifact-chain-where-am-i\` to inventory the project or locate a concrete task.
6. **Adopt**: Follow artifact-chain-where-am-i recommendations to adopt specific families and services.`;
}

function renderPublicWorkflowDivision() {
  return `## Demand-to-delivery responsibilities

- Skills preserve requirements, route artifact work, and record incremental SPEC acceptance.
- \`artifact-graph query --from <type>:<id>\`, \`context --target <type>:<id>\`, and \`validate\` provide deterministic graph operations.
- The Node API exposes \`loadConfig\`, \`scanArtifacts\`, and \`queryGraph\` for programmatic use.
- Actual test and E2E run results prove verification; test files and traceability declarations alone do not.
- The target project's release tools prove publishing and must report the exact released version.

Use \`artifact-chain-setup\` and \`artifact-graph doctor\` for environment diagnosis. Use \`artifact-audit\` for graph health. Missing evidence leaves approval, implementation, verification, or release status unknown.`;
}

async function loadApi(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('family-help-render.mjs')) {
  const projectionArg = process.argv.find(a => a.startsWith('--projection='));
  const projectionPath = projectionArg ? projectionArg.slice('--projection='.length) : undefined;
  const md = await renderHelp({ projectionPath });
  process.stdout.write(md + '\n');
}
