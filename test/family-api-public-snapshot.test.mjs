// @feature ACA18 @scenario S-65 @decision D-ACA-18
// Black-box the two generated adapter roots exactly as dependency-free plugin caches.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const pluginRoot = join(import.meta.dirname, '..');
const digest = character => `sha256:${character.repeat(64)}`;

function runNode(root, relativeScript, args = []) {
  return spawnSync('node', [join(root, relativeScript), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });
}

for (const host of ['codex', 'claude']) {
  test(`${host} adapter is a dependency-free executable plugin root`, async () => {
    const temp = await mkdtemp(join(tmpdir(), `aca-${host}-cache-`));
    const snapshotRoot = join(temp, 'artifact-chain-assistant');
    await cp(join(pluginRoot, 'adapters', host), snapshotRoot, { recursive: true });

    await assert.rejects(access(join(snapshotRoot, 'node_modules')));
    await assert.rejects(access(join(snapshotRoot, 'package.json')));

    const help = runNode(snapshotRoot, 'scripts/family-help-render.mjs');
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Standard Family API/);
    assert.match(help.stdout, /REGISTRY_V2_REQUIRED/);

    const apiCheck = runNode(snapshotRoot, 'scripts/check-family-api.mjs');
    assert.equal(apiCheck.status, 0, apiCheck.stderr || apiCheck.stdout);
    assert.equal(JSON.parse(apiCheck.stdout).ok, true);

    const methodHelp = runNode(snapshotRoot, 'scripts/method-query.mjs', ['--help']);
    assert.equal(methodHelp.status, 0, methodHelp.stderr);
    assert.ok(!methodHelp.stderr.includes('ERR_MODULE_NOT_FOUND'));

    const facts = {
      projectRoot: '/fixture/project',
      configDigest: digest('a'),
      policyDigest: null,
      artifactGraphSummary: { artifactCount: 1, edgeCount: 1, contextTargets: ['TC-001'] },
      targetArtifact: { type: 'e2e-test', id: 'TC-001' },
      contractRevisionDigest: digest('c'),
      proofStatus: 'present',
      versionLockStatus: 'fresh',
      sourcesFreshness: 'fresh',
      bindingFreshness: 'fresh',
    };
    const factsPath = join(snapshotRoot, 'project-facts-input.json');
    await writeFile(factsPath, JSON.stringify(facts));
    const builtFacts = runNode(snapshotRoot, 'scripts/method-query.mjs', ['build-envelope', factsPath]);
    assert.equal(builtFacts.status, 0, builtFacts.stderr || builtFacts.stdout);
    assert.equal(JSON.parse(builtFacts.stdout).ok, true);
    const envelope = JSON.parse(builtFacts.stdout).envelope;

    const candidateParams = {
      mode: 'standard',
      intent: 'author',
      kind: 'workflow',
      projectFactsEvidence: envelope,
      authorization: { sideEffectBudget: 'write-authorized-artifacts', granted: false },
    };
    const candidatePath = join(snapshotRoot, 'method-query-candidate-input.json');
    await writeFile(candidatePath, JSON.stringify(candidateParams));
    const builtCandidate = runNode(snapshotRoot, 'scripts/method-query.mjs', ['build-candidate', candidatePath]);
    assert.equal(builtCandidate.status, 0, builtCandidate.stderr || builtCandidate.stdout);
    const candidateResult = JSON.parse(builtCandidate.stdout);
    assert.equal(candidateResult.ok, true);
    const candidateKeys = Object.keys(candidateResult.candidate);
    assert.equal(candidateKeys.length, 5, 'candidate should have exactly 5 keys');
    assert.ok(candidateKeys.includes('mode'));
    assert.ok(candidateKeys.includes('intent'));
    assert.ok(candidateKeys.includes('kind'));
    assert.ok(candidateKeys.includes('projectFactsEvidence'));
    assert.ok(candidateKeys.includes('authorization'));

    const compiler = runNode(snapshotRoot, 'scripts/family-compile.mjs', [
      `--api=${join(snapshotRoot, 'family-apis/e2e-test/api.json')}`,
    ]);
    assert.equal(compiler.status, 1);
    const compilerResult = JSON.parse(compiler.stdout);
    assert.equal(compilerResult.ok, false);
    assert.ok(compilerResult.deterministicConformance.checks.some(check => check.status === 'IMPLEMENTATION_REQUIRED'));
    assert.ok(compilerResult.deterministicConformance.checks.some(check => check.status === 'REGISTRY_V2_REQUIRED'));
  });
}

test('method catalog and help skill are present in both adapters', async () => {
  for (const host of ['codex', 'claude']) {
    await access(join(pluginRoot, 'adapters', host, 'agent-methods/catalog.yaml'));
    await access(join(pluginRoot, 'adapters', host, 'skills/artifact-chain-help/SKILL.md'));
  }
});
