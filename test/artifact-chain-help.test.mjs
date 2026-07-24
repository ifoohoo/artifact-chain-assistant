// @feature ACA18 @scenario S-65 @decision D-ACA-18
// artifact-chain-help tests: static API rendering, legacy methods, projection,
// no third-party SKILL.md reading, projection tampering fail-closed.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { renderHelp } from '../scripts/family-help-render.mjs';

const pluginRoot = join(import.meta.dirname, '..');

// ── §5.4: Help renders standard API without projection ──

test('help renders E2E standard API even without projection', async () => {
  const md = await renderHelp({ pluginRoot });
  assert.ok(md.includes('Standard Family API'), 'Must have Standard Family API section');
  assert.ok(md.includes('artifact.e2e-test-family'), 'Must show e2e-test family');
  assert.ok(md.includes('E2E test skill family') || md.includes('E2E Test Skill Family'), 'Must show family summary or display name');
  assert.ok(md.includes('author'), 'Must list author service');
  assert.ok(md.includes('review'), 'Must list review service');
  assert.ok(md.includes('repair'), 'Must list repair service');
  // Status must be NOT_AVAILABLE when no projection
  assert.ok(md.includes('NOT_AVAILABLE'), 'Must show NOT_AVAILABLE for projection status');
  // Must NOT guess NOT_INSTALLED or ENABLED
  assert.ok(!md.includes('NOT_INSTALLED'), 'Must not guess NOT_INSTALLED');
  assert.ok(!md.includes('ENABLED'), 'Must not guess ENABLED');
});

// ── §5.4: Help shows bundled legacy methods ──

test('help shows PRD/scenario bundled legacy methods with pending status', async () => {
  const md = await renderHelp({ pluginRoot });
  assert.ok(md.includes('Bundled Legacy Methods'), 'Must have legacy section');
  assert.ok(md.includes('prd-feature'), 'Must show prd-feature');
  assert.ok(md.includes('scenario-script'), 'Must show scenario-script');
  assert.ok(md.includes('pending'), 'Must show pending status');
  assert.ok(md.includes('Does NOT claim Family API conformance'), 'Must not claim conformance');
});

// ── R6: Unverified projection must NOT render INSTALLED/ENABLED/VERIFIED ──

test('unverified projection with self-declared VERIFIED is NOT rendered', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'help-projection-'));
  const projectionPath = join(temp, 'projection.json');
  await writeFile(projectionPath, JSON.stringify({
    services: {
      'artifact.e2e-test-family.author': {
        installation: 'INSTALLED',
        enablement: 'ENABLED',
        compatibility: 'COMPATIBLE',
        trust: 'VERIFIED',
      },
    },
  }));

  const md = await renderHelp({ pluginRoot, projectionPath });
  // Must NOT render status claims as actual status entries (no lines like "- `svcId`: INSTALLED")
  // The explanation text may mention these words, but they must not appear as rendered status
  const statusLines = md.split('\n').filter(l => l.match(/^- `[^`]+`: .*INSTALLED/));
  assert.equal(statusLines.length, 0, 'Must not render INSTALLED as status entry from unverified projection');
  // Must show REGISTRY_V2_REQUIRED
  assert.ok(md.includes('REGISTRY_V2_REQUIRED'), 'Must show REGISTRY_V2_REQUIRED for unverified projection');
});

// ── R6: Self-declared verification markers are never authoritative ──

test('projection with self-declared verifier and hash is ignored', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'help-verified-'));
  const projectionPath = join(temp, 'projection.json');
  await writeFile(projectionPath, JSON.stringify({
    verified: true,
    verifier: 'agent-method-registry@2.0.0',
    hash: 'sha256:' + 'a'.repeat(64),
    services: {
      'artifact.e2e-test-family.author': {
        installation: 'INSTALLED',
        enablement: 'ENABLED',
      },
    },
  }));

  const md = await renderHelp({ pluginRoot, projectionPath });
  assert.ok(md.includes('REGISTRY_V2_REQUIRED'));
  assert.ok(!md.includes('INSTALLED'));
  assert.ok(!md.includes('ENABLED'));
  assert.ok(!md.includes('agent-method-registry@2.0.0'));
});

// ── §5.5: Tampered projection fails closed ──

test('invalid projection file results in NOT_AVAILABLE', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'help-bad-proj-'));
  const projectionPath = join(temp, 'bad.json');
  await writeFile(projectionPath, '{invalid json');

  const md = await renderHelp({ pluginRoot, projectionPath });
  assert.ok(md.includes('NOT_AVAILABLE'), 'Must fail closed to NOT_AVAILABLE');
});

// ── §5.5: Missing projection file results in NOT_AVAILABLE ──

test('missing projection file results in NOT_AVAILABLE', async () => {
  const md = await renderHelp({ pluginRoot, projectionPath: '/nonexistent/projection.json' });
  assert.ok(md.includes('NOT_AVAILABLE'), 'Must show NOT_AVAILABLE for missing projection');
});

// ── §5.4: Adoption steps are included ──

test('help includes adoption steps', async () => {
  const md = await renderHelp({ pluginRoot });
  assert.ok(md.includes('Getting Started'), 'Must have Getting Started section');
  assert.ok(md.includes('artifact-chain-bootstrap'), 'Must mention bootstrap');
  assert.ok(md.includes('where-am-i'), 'Must mention where-am-i');
});

// ── §5.12: Help works in isolated snapshot (no parent repo dependency) ──

test('help works in isolated plugin snapshot', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'help-snapshot-'));
  const snapshotRoot = join(temp, 'artifact-chain-assistant');
  await cp(pluginRoot, snapshotRoot, { recursive: true });

  const md = await renderHelp({ pluginRoot: snapshotRoot });
  assert.ok(md.includes('Standard Family API'), 'Snapshot must render Standard Family API');
  assert.ok(md.includes('artifact.e2e-test-family'), 'Snapshot must show e2e-test family');
  assert.ok(md.includes('Bundled Legacy Methods'), 'Snapshot must show legacy methods');
});

test('help does not advertise a Family API whose immutable revision is invalid', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'help-invalid-api-'));
  const snapshotRoot = join(temp, 'artifact-chain-assistant');
  await cp(pluginRoot, snapshotRoot, { recursive: true });
  const apiPath = join(snapshotRoot, 'family-apis/e2e-test/api.json');
  const api = JSON.parse(await readFile(apiPath, 'utf8'));
  api.api.summary = 'tampered without digest refresh';
  await writeFile(apiPath, JSON.stringify(api));

  const md = await renderHelp({ pluginRoot: snapshotRoot });
  assert.ok(md.includes('deterministic validation failed'));
  assert.ok(!md.includes('**Services:**'));
});
