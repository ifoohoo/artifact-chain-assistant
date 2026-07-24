// @feature ACA18 @scenario S-65 @decision D-ACA-18
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { familyCompile } from '../scripts/family-compile.mjs';

const pluginRoot = join(import.meta.dirname, '..');
const apiPath = join(pluginRoot, 'family-apis/e2e-test/api.json');
const implementationPath = join(pluginRoot, 'families-src/prd-feature/implementation.yaml');
const revisionDigest = `sha256:${'a'.repeat(64)}`;

// Mock Registry v2 CLI that always succeeds
function successfulRegistryRunner() {
  return ({ command, args }) => {
    if (args[0] === 'validate') {
      return { stdout: JSON.stringify({ ok: true, data: null, diagnostics: [] }) };
    }
    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };
}

// Separate runner for artifact-graph commands
function successfulArtifactGraphRunner(calls = []) {
  return request => {
    calls.push(request);
    return { stdout: JSON.stringify({ ok: true, data: { identity: { revisionDigest } } }) };
  };
}

// Combined runner that handles both artifact-graph and registry commands
function combinedRunner(artifactGraphCalls = [], registryCalls = []) {
  return request => {
    if (request.command === 'artifact-graph-shim' || request.args[0] === 'contract') {
      artifactGraphCalls.push(request);
      return { stdout: JSON.stringify({ ok: true, data: { identity: { revisionDigest } } }) };
    }
    if (request.args[0] === 'validate') {
      registryCalls.push(request);
      return { stdout: JSON.stringify({ ok: true, data: null, diagnostics: [] }) };
    }
    throw new Error(`Unexpected command: ${request.command} ${request.args.join(' ')}`);
  };
}

test('API-only checks can pass while full family conformance fails closed without registry command', async () => {
  // Create a temporary implementation with implements block for testing
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-api-only-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    // Explicit nonexistent registryCommand so findRegistryCli is bypassed
    registryCommand: '/nonexistent/no-such-registry',
    commandRunner: request => {
      if (request.args[0] === 'validate') {
        throw new Error('ENOENT: no such file or directory');
      }
      return { stdout: JSON.stringify({ ok: true, data: { identity: { revisionDigest } } }) };
    },
  });
  assert.equal(result.apiConformance.status, 'PASS');
  assert.equal(result.familyConformance.status, 'FAIL');
  assert.equal(result.deterministicConformance.status, 'FAIL');
  assert.equal(result.ok, false);
  assert.equal(result.behaviorQualification.status, 'NOT_RUN');
  const registryCheck = result.deterministicConformance.checks.find(check => check.name === 'registry-v2-validation');
  assert.equal(registryCheck.status, 'FAIL');
  assert.ok(registryCheck.errors.some(e => e.includes('Registry v2 validation failed')));
});

test('full compile without implementation returns IMPLEMENTATION_REQUIRED', async () => {
  const result = await familyCompile({
    familyApiPath: apiPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    commandRunner: successfulArtifactGraphRunner(),
  });
  const check = result.deterministicConformance.checks.find(item => item.name === 'implementation-descriptor-presence');
  assert.equal(check.status, 'IMPLEMENTATION_REQUIRED');
  assert.equal(result.ok, false);
});

test('compiler delegates every formal contract ref with exact command arguments', async () => {
  const artifactGraphCalls = [];
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-contract-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
    '  artifact.e2e-test.help:',
    '    skill: e2e-test',
    '    summary: "E2E test help service"',
    '  artifact.e2e-test.author:',
    '    skill: e2e-test',
    '    summary: "E2E test author service"',
    '  artifact.e2e-test.review:',
    '    skill: e2e-test',
    '    summary: "E2E test review service"',
    '  artifact.e2e-test.repair:',
    '    skill: e2e-test',
    '    summary: "E2E test repair service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner(artifactGraphCalls),
  });
  assert.equal(artifactGraphCalls.length, 1);
  assert.equal(artifactGraphCalls[0].command, 'artifact-graph-shim');
  assert.deepEqual(artifactGraphCalls[0].args, ['contract', 'explain', '--contract', 'artifact.e2e-test@1', '--format', 'json']);
  assert.equal(artifactGraphCalls[0].timeout, 30000);
  const contractCheck = result.deterministicConformance.checks.find(check => check.name === 'artifact-contract-validation');
  assert.equal(contractCheck.status, 'PASS');
  assert.equal(contractCheck.resolvedContracts[0].revisionDigest, revisionDigest);
});

for (const [name, runner] of [
  ['subtool failure', () => { throw new Error('timeout'); }],
  ['invalid JSON', () => ({ stdout: '{not-json' })],
  ['missing revision', () => ({ stdout: JSON.stringify({ ok: true, data: {} }) })],
]) {
  test(`compiler fails closed on contract ${name}`, async () => {
    const temp = await mkdtemp(join(tmpdir(), `family-compile-contract-${name.replace(/\s/g, '-')}-`));
    const implPath = join(temp, 'implementation.yaml');
    await writeFile(implPath, [
      'schemaVersion: 1',
      'implements:',
      '  apiId: artifact.e2e-test-family',
      '  apiMajor: 1',
      '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
      'services:',
      '  artifact.e2e-test.default:',
      '    skill: e2e-test',
      '    summary: "E2E test default service"',
    ].join('\n'));

    const result = await familyCompile({
      familyApiPath: apiPath,
      implementationPath: implPath,
      pluginRoot,
      artifactGraphCommand: 'artifact-graph-shim',
      registryCommand: 'registry-shim',
      commandRunner: request => {
        if (request.args[0] === 'validate') {
          return { stdout: JSON.stringify({ ok: true, data: null, diagnostics: [] }) };
        }
        return runner(request);
      },
    });
    const check = result.deterministicConformance.checks.find(item => item.name === 'artifact-contract-validation');
    assert.equal(check.status, 'FAIL');
    assert.equal(result.ok, false);
  });
}

test('invalid Family API fails API and full conformance', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-invalid-'));
  const invalidPath = join(temp, 'api.json');
  await writeFile(invalidPath, JSON.stringify({ schemaVersion: 1, api: {}, services: [] }));
  const result = await familyCompile({
    familyApiPath: invalidPath,
    catalogPath: join(pluginRoot, 'family-apis/catalog.json'),
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    commandRunner: successfulArtifactGraphRunner(),
  });
  assert.equal(result.apiConformance.status, 'FAIL');
  assert.equal(result.ok, false);
});

test('CLI exits non-zero and reports both implementation and Registry v2 gaps', () => {
  const cli = join(pluginRoot, 'scripts/family-compile.mjs');
  const run = spawnSync('node', [cli, `--api=${apiPath}`], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  const result = JSON.parse(run.stdout);
  assert.equal(result.ok, false);
  assert.equal(result.deterministicConformance.status, 'FAIL');
  const statuses = result.deterministicConformance.checks.map(check => check.status);
  assert.ok(statuses.includes('IMPLEMENTATION_REQUIRED'));
  assert.ok(statuses.includes('REGISTRY_V2_REQUIRED'));
});

test('compiler invokes Registry v2 validate with exact command arguments', async () => {
  const registryCalls = [];
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-registry-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
    '  artifact.e2e-test.help:',
    '    skill: e2e-test',
    '    summary: "E2E test help service"',
    '  artifact.e2e-test.author:',
    '    skill: e2e-test',
    '    summary: "E2E test author service"',
    '  artifact.e2e-test.review:',
    '    skill: e2e-test',
    '    summary: "E2E test review service"',
    '  artifact.e2e-test.repair:',
    '    skill: e2e-test',
    '    summary: "E2E test repair service"',
  ].join('\n'));

  await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner([], registryCalls),
  });

  assert.equal(registryCalls.length, 1);
  assert.equal(registryCalls[0].command, 'registry-shim');
  assert.deepEqual(registryCalls[0].args, ['validate', '--catalog', implPath]);
  assert.equal(registryCalls[0].timeout, 30000);
});

test('Registry v2 non-zero exit fails compilation', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-registry-fail-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: request => {
      if (request.args[0] === 'validate') {
        return { stdout: JSON.stringify({ ok: false, diagnostics: [{ code: 'INVALID', severity: 'error', message: 'Validation failed' }] }) };
      }
      return successfulArtifactGraphRunner()(request);
    },
  });
  assert.equal(result.ok, false);
  const registryCheck = result.deterministicConformance.checks.find(check => check.name === 'registry-v2-validation');
  assert.equal(registryCheck.status, 'FAIL');
});

test('Registry v2 timeout fails compilation', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-registry-timeout-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: request => {
      if (request.args[0] === 'validate') {
        throw new Error('timeout');
      }
      return successfulArtifactGraphRunner()(request);
    },
  });
  assert.equal(result.ok, false);
  const registryCheck = result.deterministicConformance.checks.find(check => check.name === 'registry-v2-validation');
  assert.equal(registryCheck.status, 'FAIL');
});

test('Registry v2 invalid JSON fails compilation', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-registry-invalid-json-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: request => {
      if (request.args[0] === 'validate') {
        return { stdout: '{not-json' };
      }
      return successfulArtifactGraphRunner()(request);
    },
  });
  assert.equal(result.ok, false);
  const registryCheck = result.deterministicConformance.checks.find(check => check.name === 'registry-v2-validation');
  assert.equal(registryCheck.status, 'FAIL');
});

test('API id mismatch fails conformance', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-api-mismatch-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.wrong-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner(),
  });
  assert.equal(result.ok, false);
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'CONFORMANCE_FAIL');
  assert.ok(implCheck.errors.some(e => e.includes('API id mismatch')));
});

test('API major version mismatch fails conformance', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-major-mismatch-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 2',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner(),
  });
  assert.equal(result.ok, false);
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'CONFORMANCE_FAIL');
  assert.ok(implCheck.errors.some(e => e.includes('API major version mismatch')));
});

test('API revision digest mismatch fails conformance', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-revision-mismatch-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner(),
  });
  assert.equal(result.ok, false);
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'CONFORMANCE_FAIL');
  assert.ok(implCheck.errors.some(e => e.includes('API revision digest mismatch')));
});

test('missing required service fails conformance', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-missing-service-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner(),
  });
  assert.equal(result.ok, false);
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'CONFORMANCE_FAIL');
  assert.ok(implCheck.errors.some(e => e.includes('Required service not implemented')));
});

test('unknown service fails conformance', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-unknown-service-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
    '  artifact.e2e-test.help:',
    '    skill: e2e-test',
    '    summary: "E2E test help service"',
    '  artifact.e2e-test.author:',
    '    skill: e2e-test',
    '    summary: "E2E test author service"',
    '  artifact.e2e-test.review:',
    '    skill: e2e-test',
    '    summary: "E2E test review service"',
    '  artifact.e2e-test.repair:',
    '    skill: e2e-test',
    '    summary: "E2E test repair service"',
    '  artifact.e2e-test.unknown:',
    '    skill: e2e-test',
    '    summary: "Unknown service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner(),
  });
  assert.equal(result.ok, false);
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'CONFORMANCE_FAIL');
  assert.ok(implCheck.errors.some(e => e.includes('Unknown service not in API')));
});

test('full deterministic conformance passes with valid implementation', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-full-pass-'));
  const implPath = join(temp, 'implementation.yaml');
  await writeFile(implPath, [
    'schemaVersion: 1',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    skill: e2e-test',
    '    summary: "E2E test default service"',
    '  artifact.e2e-test.help:',
    '    skill: e2e-test',
    '    summary: "E2E test help service"',
    '  artifact.e2e-test.author:',
    '    skill: e2e-test',
    '    summary: "E2E test author service"',
    '  artifact.e2e-test.review:',
    '    skill: e2e-test',
    '    summary: "E2E test review service"',
    '  artifact.e2e-test.repair:',
    '    skill: e2e-test',
    '    summary: "E2E test repair service"',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    registryCommand: 'registry-shim',
    commandRunner: combinedRunner(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.apiConformance.status, 'PASS');
  assert.equal(result.familyConformance.status, 'PASS');
  assert.equal(result.deterministicConformance.status, 'PASS');
  assert.equal(result.behaviorQualification.status, 'NOT_RUN');
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'PASS');
  const registryCheck = result.deterministicConformance.checks.find(check => check.name === 'registry-v2-validation');
  assert.equal(registryCheck.status, 'PASS');
});

test('API-only validation passes even without implementation', async () => {
  const result = await familyCompile({
    familyApiPath: apiPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    commandRunner: successfulArtifactGraphRunner(),
  });
  assert.equal(result.apiConformance.status, 'PASS');
  assert.equal(result.ok, false);
});

test('behaviorQualification limitations do not mention Registry v2 integration', async () => {
  const result = await familyCompile({
    familyApiPath: apiPath,
    pluginRoot,
    artifactGraphCommand: 'artifact-graph-shim',
    commandRunner: successfulArtifactGraphRunner(),
  });
  const limitations = result.behaviorQualification.limitations;
  assert.ok(!limitations.some(l => l.includes('Registry v2')));
});

// ── Real Registry v2 / E2E descriptor acceptance tests ─────────────
// These use the real registry CLI and real v2 implementation descriptor.
// They verify the full compile pipeline end-to-end.

const v2FixturePath = join(pluginRoot, 'test/fixtures/e2e-test-family/implementation-v2.yaml');
// Registry v2 lives in a separately versioned project until its public package
// is released.  Cross-project acceptance must opt in with an explicit CLI;
// never mutate or silently rely on this plugin's installed Registry package.
function discoverRegistryCli() {
  if (process.env.AGENT_METHOD_REGISTRY_V2_CLI) return process.env.AGENT_METHOD_REGISTRY_V2_CLI;
  // Check installed package first (pnpm override or published version)
  const installed = join(pluginRoot, 'node_modules', 'agent-method-registry', 'dist', 'bin.js');
  try { statSync(installed); return installed; } catch {}
  // Fall back to sibling workspace for cross-repo development
  const sibling = join(pluginRoot, '..', '..', '..', 'agent-method-registry', 'packages', 'agent-method-registry', 'dist', 'bin.js');
  try { statSync(sibling); return sibling; } catch { return ''; }
}
const registryCli = discoverRegistryCli();

function registryV2Available() {
  if (!registryCli) return false;
  try {
    const run = spawnSync(registryCli, ['validate', '--catalog', v2FixturePath], { encoding: 'utf8', timeout: 10000 });
    if (run.status !== 0) return false;
    const parsed = JSON.parse(run.stdout);
    return parsed.ok === true;
  } catch {
    return false;
  }
}

const skipV2 = !registryV2Available();

// The full-pass acceptance also drives the real artifact-graph CLI through
// `contract explain`. Published artifact-graph releases before the contract
// kernel do not provide that command, and standalone snapshots may not have
// the CLI at all, so probe the capability instead of assuming it.
function discoverArtifactGraphCli() {
  if (process.env.ARTIFACT_GRAPH_CLI) return process.env.ARTIFACT_GRAPH_CLI;
  const candidates = [
    join(pluginRoot, 'node_modules', '.bin', 'artifact-graph'),
    join(pluginRoot, '..', '..', 'node_modules', '.bin', 'artifact-graph'),
  ];
  for (const candidate of candidates) {
    try { statSync(candidate); return candidate; } catch {}
  }
  return '';
}
const artifactGraphCli = discoverArtifactGraphCli();

function artifactGraphContractsAvailable() {
  if (!artifactGraphCli) return false;
  try {
    const run = spawnSync(
      artifactGraphCli,
      ['contract', 'explain', '--contract', 'artifact.e2e-test@1', '--format', 'json'],
      { encoding: 'utf8', timeout: 30000, cwd: pluginRoot },
    );
    if (run.status !== 0) return false;
    const parsed = JSON.parse(run.stdout);
    return parsed?.ok === true && /^sha256:[a-f0-9]{64}$/.test(parsed?.data?.identity?.revisionDigest ?? '');
  } catch {
    return false;
  }
}

const skipRealCompile = skipV2 || !artifactGraphContractsAvailable();

test('real Registry v2 + E2E descriptor: full compile passes, behavior NOT_RUN', { skip: skipRealCompile }, async () => {
  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: v2FixturePath,
    pluginRoot,
    registryCommand: registryCli,
    // Use real CLI commands (no mock runner).
  });
  assert.equal(result.ok, true);
  assert.equal(result.apiConformance.status, 'PASS');
  assert.equal(result.familyConformance.status, 'PASS');
  assert.equal(result.deterministicConformance.status, 'PASS');
  assert.equal(result.behaviorQualification.status, 'NOT_RUN');
  const registryCheck = result.deterministicConformance.checks.find(check => check.name === 'registry-v2-validation');
  assert.equal(registryCheck.status, 'PASS');
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'PASS');
});

test('real Registry v2: missing required service fails conformance', { skip: skipV2 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-real-missing-'));
  const implPath = join(temp, 'implementation-v2-bad.yaml');
  // Write a valid v2 descriptor but missing required services
  await writeFile(implPath, [
    'documentKind: v2-implementation',
    'schemaVersion: 2',
    'familyImplementationId: com.github.mzdbxqh.e2e-test',
    'version: 0.1.0',
    'pluginId: artifact-chain-assistant',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:66cdd1098a93eb8d128c57010a9405dd1de55bee1e702ced44a93c202cc4b463"',
    'services:',
    '  artifact.e2e-test.default:',
    '    serviceImplementationId: com.github.mzdbxqh.e2e-test.default',
    '    skill: e2e-test/default',
    'bundle:',
    '  roots:',
    '    - skills-src/e2e-test',
    '  treeDigest: "sha256:4d576ef1be4a0b322f2497f8942666087ae48763d16aa0549e1bbf8d782c3271"',
    'lifecycle:',
    '  ownership: bundled',
    '  maturity: stable',
    'conformance:',
    '  deterministicAttestation: null',
    '  behaviorQualification: null',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    registryCommand: registryCli,
  });
  assert.equal(result.ok, false);
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'CONFORMANCE_FAIL');
  assert.ok(implCheck.errors.some(e => e.includes('Required service not implemented')));
});

test('real Registry v2: API revision digest mismatch fails conformance', { skip: skipV2 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'family-compile-real-revision-'));
  const implPath = join(temp, 'implementation-v2-bad-rev.yaml');
  await writeFile(implPath, [
    'documentKind: v2-implementation',
    'schemaVersion: 2',
    'familyImplementationId: com.github.mzdbxqh.e2e-test',
    'version: 0.1.0',
    'pluginId: artifact-chain-assistant',
    'implements:',
    '  apiId: artifact.e2e-test-family',
    '  apiMajor: 1',
    '  apiRevisionDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"',
    'services:',
    '  artifact.e2e-test.default:',
    '    serviceImplementationId: com.github.mzdbxqh.e2e-test.default',
    '    skill: e2e-test/default',
    '  artifact.e2e-test.help:',
    '    serviceImplementationId: com.github.mzdbxqh.e2e-test.help',
    '    skill: e2e-test/help',
    '  artifact.e2e-test.author:',
    '    serviceImplementationId: com.github.mzdbxqh.e2e-test.author',
    '    skill: e2e-test/author',
    '  artifact.e2e-test.review:',
    '    serviceImplementationId: com.github.mzdbxqh.e2e-test.review',
    '    skill: e2e-test/review',
    '  artifact.e2e-test.repair:',
    '    serviceImplementationId: com.github.mzdbxqh.e2e-test.repair',
    '    skill: e2e-test/repair',
    'bundle:',
    '  roots:',
    '    - skills-src/e2e-test',
    '  treeDigest: "sha256:4d576ef1be4a0b322f2497f8942666087ae48763d16aa0549e1bbf8d782c3271"',
    'lifecycle:',
    '  ownership: bundled',
    '  maturity: stable',
    'conformance:',
    '  deterministicAttestation: null',
    '  behaviorQualification: null',
  ].join('\n'));

  const result = await familyCompile({
    familyApiPath: apiPath,
    implementationPath: implPath,
    pluginRoot,
    registryCommand: registryCli,
  });
  assert.equal(result.ok, false);
  const implCheck = result.deterministicConformance.checks.find(check => check.name === 'implementation-descriptor-presence');
  assert.equal(implCheck.status, 'CONFORMANCE_FAIL');
  assert.ok(implCheck.errors.some(e => e.includes('API revision digest mismatch')));
});
