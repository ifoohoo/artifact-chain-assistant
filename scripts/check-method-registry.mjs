#!/usr/bin/env node
// @feature ACA12 @scenario S-36,S-37,S-38,S-39
// Deterministic test for agent-method-registry catalog integration.
// No network access, no reading agent-method-registry source paths.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const catalogPath = join(root, 'agent-methods', 'catalog.yaml');
const codexCatalogPath = join(root, 'adapters', 'codex', 'agent-methods', 'catalog.yaml');
const claudeCatalogPath = join(root, 'adapters', 'claude', 'agent-methods', 'catalog.yaml');
const codexSkillsDir = join(root, 'adapters', 'codex', 'skills');
const claudeSkillsDir = join(root, 'adapters', 'claude', 'skills');

const REGISTRY_CLI = join(root, 'node_modules', '.bin', 'agent-method-registry');

if (!existsSync(REGISTRY_CLI)) {
  console.log('agent-method-registry CLI not found; skipping method registry check (devDependency not installed).');
  process.exit(0);
}

const tmpDir = join(root, '.tmp', 'method-registry-test');
mkdirSync(tmpDir, { recursive: true });

const issues = [];

function assert(condition, message) {
  if (!condition) {
    issues.push(message);
  }
}

function runRegistry(args) {
  try {
    const stdout = execFileSync(REGISTRY_CLI, args, { encoding: 'utf-8', cwd: root });
    return JSON.parse(stdout);
  } catch (error) {
    // CLI returns non-zero on failure; parse stdout for diagnostics
    const stdout = error.stdout ?? '';
    try {
      return JSON.parse(stdout);
    } catch {
      issues.push(`Registry CLI error (exit ${error.status}): ${error.message}`);
      return { ok: false, diagnostics: [{ message: error.message }] };
    }
  }
}

function runRegistryExpectFail(args) {
  try {
    const stdout = execFileSync(REGISTRY_CLI, args, { encoding: 'utf-8', cwd: root });
    // Should have failed but didn't
    const result = JSON.parse(stdout);
    if (result.ok) {
      return { failed: false, result };
    }
    return { failed: true, result };
  } catch (error) {
    const stdout = error.stdout ?? '';
    try {
      return { failed: true, result: JSON.parse(stdout) };
    } catch {
      return { failed: true, result: { ok: false } };
    }
  }
}

try {
  // ── 1. Schema validation ──
  const validation = runRegistry(['validate', '--catalog', catalogPath]);
  assert(validation.ok === true, 'catalog schema validation should pass');

  // ── 1b. Adapter catalog consistency ──
  const rootCatalogContent = readFileSync(catalogPath, 'utf-8');
  assert(existsSync(codexCatalogPath), 'codex adapter should have agent-methods/catalog.yaml');
  assert(existsSync(claudeCatalogPath), 'claude adapter should have agent-methods/catalog.yaml');
  assert(
    readFileSync(codexCatalogPath, 'utf-8') === rootCatalogContent,
    'codex adapter catalog should match root catalog',
  );
  assert(
    readFileSync(claudeCatalogPath, 'utf-8') === rootCatalogContent,
    'claude adapter catalog should match root catalog',
  );

  // ── 1c. Validate adapter catalogs ──
  const codexValidation = runRegistry(['validate', '--catalog', codexCatalogPath]);
  assert(codexValidation.ok === true, 'codex adapter catalog schema validation should pass');
  const claudeValidation = runRegistry(['validate', '--catalog', claudeCatalogPath]);
  assert(claudeValidation.ok === true, 'claude adapter catalog schema validation should pass');

  // ── 2. Build effective index from catalog only ──
  const indexPath = join(tmpDir, 'effective-index.json');
  const indexResult = runRegistry(['index', '--catalog', catalogPath, '--out', indexPath]);
  assert(indexResult.ok === true, 'index build should succeed');
  assert(existsSync(indexPath), 'effective-index.json should be created');

  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));

  // ── 3. Exactly 12 entries, all workflow ──
  assert(index.entries.length === 12, `expected 12 entries, got ${index.entries.length}`);
  for (const entry of index.entries) {
    assert(entry.kind === 'workflow', `entry ${entry.ref} should be workflow, got ${entry.kind}`);
  }

  // ── 4. Expected refs ──
  const expectedRefs = [
    'artifact.prd-feature.default',
    'artifact.prd-feature.author',
    'artifact.prd-feature.review',
    'artifact.prd-feature.repair',
    'artifact.scenario-script.default',
    'artifact.scenario-script.author',
    'artifact.scenario-script.review',
    'artifact.scenario-script.repair',
    'artifact.review',
    'artifact.repair',
    'artifact.batch',
    'artifact.audit',
  ];
  const actualRefs = index.entries.map(e => e.ref).sort();
  const sortedExpected = [...expectedRefs].sort();
  assert(
    JSON.stringify(actualRefs) === JSON.stringify(sortedExpected),
    `ref mismatch: expected ${JSON.stringify(sortedExpected)}, got ${JSON.stringify(actualRefs)}`
  );

  // ── 5. No internal skills ──
  const forbiddenPatterns = ['inspect', 'compose', 'validate'];
  for (const entry of index.entries) {
    for (const pattern of forbiddenPatterns) {
      assert(
        !entry.ref.includes(pattern) && !entry.provider.skill.includes(pattern),
        `entry ${entry.ref} should not reference internal skill "${pattern}"`
      );
    }
  }

  // ── 6. Query: PRD domain/type/kind = 4 ──
  const prdQuery = runRegistry([
    'query', '--index', indexPath,
    '--domain', 'artifact',
    '--artifact-type', 'prd-feature',
    '--kind', 'workflow',
  ]);
  assert(prdQuery.ok === true, 'PRD query should succeed');
  assert(
    prdQuery.data?.entries?.length === 4,
    `PRD query should return 4 results, got ${prdQuery.data?.entries?.length}`
  );

  // ── 7. Query: scenario domain/type/kind = 4 ──
  const scenarioQuery = runRegistry([
    'query', '--index', indexPath,
    '--domain', 'artifact',
    '--artifact-type', 'scenario-script',
    '--kind', 'workflow',
  ]);
  assert(scenarioQuery.ok === true, 'scenario query should succeed');
  assert(
    scenarioQuery.data?.entries?.length === 4,
    `scenario query should return 4 results, got ${scenarioQuery.data?.entries?.length}`
  );

  // ── 7b. Query: generic review intent = 1 unique ──
  const genericReviewQuery = runRegistry([
    'query', '--index', indexPath,
    '--domain', 'artifact',
    '--intent', 'review',
  ]);
  assert(genericReviewQuery.ok === true, 'generic review query should succeed');
  // Should find at least the generic review entry
  const hasGenericReview = genericReviewQuery.data?.entries?.some(e => e.ref === 'artifact.review');
  assert(hasGenericReview, 'generic review query should include artifact.review');

  // ── 7c. Query: generic audit intent = 1 unique ──
  const genericAuditQuery = runRegistry([
    'query', '--index', indexPath,
    '--domain', 'artifact',
    '--intent', 'audit',
  ]);
  assert(genericAuditQuery.ok === true, 'generic audit query should succeed');
  const hasGenericAudit = genericAuditQuery.data?.entries?.some(e => e.ref === 'artifact.audit');
  assert(hasGenericAudit, 'generic audit query should include artifact.audit');

  // ── 7d. Per generic artifact-type: each intent resolves to exactly one unique ref ──
  const genericTypes = ['design-spec', 'link', 'e2e', 'domain', 'contract', 'blueprint', 'verification'];
  const genericIntentToRef = {
    review: 'artifact.review',
    repair: 'artifact.repair',
    batch: 'artifact.batch',
    audit: 'artifact.audit',
    health: 'artifact.audit',
  };

  for (const artifactType of genericTypes) {
    for (const [intent, expectedRef] of Object.entries(genericIntentToRef)) {
      const query = runRegistry([
        'query', '--index', indexPath,
        '--domain', 'artifact',
        '--artifact-type', artifactType,
        '--intent', intent,
      ]);
      assert(
        query.ok === true,
        `query ${artifactType}/${intent} should succeed`,
      );
      const entries = query.data?.entries ?? [];
      assert(
        entries.length === 1,
        `query ${artifactType}/${intent} should return exactly 1 entry, got ${entries.length}`,
      );
      assert(
        entries[0]?.ref === expectedRef,
        `query ${artifactType}/${intent} should resolve to ${expectedRef}, got ${entries[0]?.ref}`,
      );
    }
  }

  // ── 8. Query: intent author for PRD = 1 unique ──
  const authorQuery = runRegistry([
    'query', '--index', indexPath,
    '--domain', 'artifact',
    '--artifact-type', 'prd-feature',
    '--intent', 'author',
  ]);
  assert(authorQuery.ok === true, 'PRD author query should succeed');
  assert(
    authorQuery.data?.entries?.length === 1 && authorQuery.data.entries[0].ref === 'artifact.prd-feature.author',
    `PRD author query should return exactly artifact.prd-feature.author, got ${JSON.stringify(authorQuery.data?.entries?.map(e => e.ref))}`
  );

  // ── 9. Query: intent review for scenario = 1 unique ──
  const reviewQuery = runRegistry([
    'query', '--index', indexPath,
    '--domain', 'artifact',
    '--artifact-type', 'scenario-script',
    '--intent', 'review',
  ]);
  assert(reviewQuery.ok === true, 'scenario review query should succeed');
  assert(
    reviewQuery.data?.entries?.length === 1 && reviewQuery.data.entries[0].ref === 'artifact.scenario-script.review',
    `scenario review query should return exactly artifact.scenario-script.review`
  );

  // ── 10. Resolve all 12 entries for Codex host (using adapter catalog) ──
  const codexIndexPath = join(tmpDir, 'codex-effective-index.json');
  const codexIndexResult = runRegistry(['index', '--catalog', codexCatalogPath, '--out', codexIndexPath]);
  assert(codexIndexResult.ok === true, 'codex adapter index build should succeed');
  for (const ref of expectedRefs) {
    const result = runRegistry([
      'resolve', '--index', codexIndexPath,
      '--ref', ref, '--host', 'codex',
      '--plugin-root', codexSkillsDir,
    ]);
    assert(result.ok === true, `resolve ${ref} for codex from adapter catalog should succeed`);
    assert(
      result.data?.verification?.status === 'verified',
      `resolve ${ref} for codex should be verified, got ${result.data?.verification?.status}`
    );
  }

  // ── 11. Resolve all 12 entries for Claude host (using adapter catalog) ──
  const claudeIndexPath = join(tmpDir, 'claude-effective-index.json');
  const claudeIndexResult = runRegistry(['index', '--catalog', claudeCatalogPath, '--out', claudeIndexPath]);
  assert(claudeIndexResult.ok === true, 'claude adapter index build should succeed');
  for (const ref of expectedRefs) {
    const result = runRegistry([
      'resolve', '--index', claudeIndexPath,
      '--ref', ref, '--host', 'claude-code',
      '--plugin-root', claudeSkillsDir,
    ]);
    assert(result.ok === true, `resolve ${ref} for claude-code from adapter catalog should succeed`);
    assert(
      result.data?.verification?.status === 'verified',
      `resolve ${ref} for claude-code should be verified, got ${result.data?.verification?.status}`
    );
  }

  // ── 12. Project overlay: override one ref ──
  const projectYaml = `schemaVersion: 1
overrides:
  artifact.prd-feature.default:
    provider:
      scope: project
      skill: prd-feature
`;
  const projectPath = join(tmpDir, 'project.yaml');
  writeFileSync(projectPath, projectYaml);

  const overlayIndexPath = join(tmpDir, 'overlay-index.json');
  const overlayResult = runRegistry([
    'index',
    '--catalog', catalogPath,
    '--project', projectPath,
    '--out', overlayIndexPath,
  ]);
  assert(overlayResult.ok === true, 'overlay index build should succeed');

  const overlayIndex = JSON.parse(readFileSync(overlayIndexPath, 'utf-8'));
  const overriddenEntry = overlayIndex.entries.find(e => e.ref === 'artifact.prd-feature.default');
  assert(overriddenEntry != null, 'overridden entry should exist');
  assert(
    overriddenEntry.provider.scope === 'project',
    `overridden entry should have project scope, got ${overriddenEntry.provider.scope}`
  );
  assert(
    overriddenEntry.provenance?.overriddenBy != null,
    'overridden entry provenance should indicate override source'
  );

  // Resolve project override BEFORE SKILL.md exists — expect PROVIDER_NOT_FOUND
  const projectResolve = runRegistry([
    'resolve', '--index', overlayIndexPath,
    '--ref', 'artifact.prd-feature.default',
    '--host', 'codex',
    '--project-root', join(tmpDir, 'project-skills'),
  ]);
  assert(projectResolve.ok === false, 'project resolve before SKILL.md exists should fail (ok: false)');
  const providerDiag = (projectResolve.diagnostics ?? []).find(d => d.code === 'PROVIDER_NOT_FOUND');
  assert(providerDiag != null, `project resolve should report PROVIDER_NOT_FOUND, got codes: ${(projectResolve.diagnostics ?? []).map(d => d.code).join(', ')}`);

  // Create the project skill for resolution
  const projectSkillDir = join(tmpDir, 'project-skills', 'prd-feature');
  mkdirSync(projectSkillDir, { recursive: true });
  writeFileSync(join(projectSkillDir, 'SKILL.md'), '# Project PRD Feature\n');

  const projectResolve2 = runRegistry([
    'resolve', '--index', overlayIndexPath,
    '--ref', 'artifact.prd-feature.default',
    '--host', 'codex',
    '--project-root', join(tmpDir, 'project-skills'),
  ]);
  assert(projectResolve2.ok === true, 'project override resolve should succeed');
  assert(
    projectResolve2.data?.verification?.status === 'verified',
    `project override resolve should be verified, got ${projectResolve2.data?.verification?.status}`
  );

  // ── 12b. Negative: resolve nonexistent ref — expect ENTRY_NOT_FOUND
  const nonexistentResolve = runRegistry([
    'resolve', '--index', overlayIndexPath,
    '--ref', 'artifact.nonexistent.missing',
    '--host', 'codex',
    '--plugin-root', codexSkillsDir,
  ]);
  assert(nonexistentResolve.ok === false, 'resolve for nonexistent ref should fail (ok: false)');
  const entryDiag = (nonexistentResolve.diagnostics ?? []).find(d => d.code === 'ENTRY_NOT_FOUND');
  assert(entryDiag != null, `resolve nonexistent ref should report ENTRY_NOT_FOUND, got codes: ${(nonexistentResolve.diagnostics ?? []).map(d => d.code).join(', ')}`);

  // ── 13. Compact query: only ref, kind, summary ──
  const compactQuery = runRegistry([
    'query', '--index', indexPath,
    '--domain', 'artifact',
    '--artifact-type', 'prd-feature',
    '--kind', 'workflow',
    '--format', 'compact',
  ]);
  if (compactQuery.ok && compactQuery.data?.entries) {
    for (const entry of compactQuery.data.entries) {
      const keys = Object.keys(entry);
      assert(
        keys.includes('ref') && keys.includes('kind') && keys.includes('summary'),
        `compact entry should have ref/kind/summary, got keys: ${keys.join(',')}`
      );
      assert(
        !keys.includes('match') && !keys.includes('accepts') && !keys.includes('produces'),
        `compact entry should not include full metadata, got keys: ${keys.join(',')}`
      );
    }
  }

  // ── 14. Negative: missing schemaVersion ──
  const badCatalog = join(tmpDir, 'bad-catalog.yaml');
  writeFileSync(badCatalog, `catalog:\n  id: test\n  version: "1.0.0"\nentries: []\n`);
  const badValidation = runRegistryExpectFail(['validate', '--catalog', badCatalog]);
  assert(badValidation.failed === true, 'catalog without schemaVersion should fail validation');

  // ── 15. Negative: duplicate ref ──
  const dupCatalog = join(tmpDir, 'dup-catalog.yaml');
  writeFileSync(dupCatalog, `schemaVersion: 1
catalog:
  id: test
  version: "1.0.0"
entries:
  - ref: artifact.prd-feature.default
    provider:
      scope: plugin
      plugin: test
      skill: test
    kind: workflow
    summary: test entry
    match:
      domains: [artifact]
      artifactTypes: [prd-feature]
      intents: [route]
    accepts: [input]
    produces: [output]
    sideEffects: [write-project-artifacts]
  - ref: artifact.prd-feature.default
    provider:
      scope: plugin
      plugin: test
      skill: test2
    kind: workflow
    summary: duplicate entry
    match:
      domains: [artifact]
      artifactTypes: [prd-feature]
      intents: [route]
    accepts: [input]
    produces: [output]
    sideEffects: [write-project-artifacts]
`);
  const dupValidation = runRegistryExpectFail(['validate', '--catalog', dupCatalog]);
  assert(dupValidation.failed === true, 'catalog with duplicate refs should fail validation');

} finally {
  // Cleanup temp directory
  rmSync(tmpDir, { recursive: true, force: true });
}

if (issues.length > 0) {
  console.error(`Method registry check FAILED with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
} else {
  console.log('Method registry check passed: 12 workflow entries, schema/query/resolve/overlay all verified.');
}
