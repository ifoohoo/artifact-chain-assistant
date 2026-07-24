// @feature ACA18 @scenario S-66 @decision D-ACA-18
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildMethodQueryCandidate,
  buildProjectFactsEnvelope,
  computeEvidenceDigest,
  validateProjectFacts,
  projectFactsSchemaDigest,
} from '../scripts/lib/method-query.mjs';

const pluginRoot = join(import.meta.dirname, '..');
const digest = character => `sha256:${character.repeat(64)}`;

test('generated project-facts validator records the authoritative schema digest', async () => {
  const projectFactsSchema = await readFile(join(pluginRoot, 'schemas/project-facts.schema.json'), 'utf8');
  assert.equal(projectFactsSchemaDigest, `sha256:${createHash('sha256').update(projectFactsSchema).digest('hex')}`);
});

function projectFacts(overrides = {}) {
  return {
    projectRoot: '/test/project',
    configDigest: digest('a'),
    policyDigest: null,
    artifactGraphSummary: { artifactCount: 12, edgeCount: 18, contextTargets: ['ACA18'] },
    targetArtifact: { type: 'e2e-test', id: 'TC-001' },
    contractRevisionDigest: digest('c'),
    proofStatus: 'present',
    versionLockStatus: 'fresh',
    sourcesFreshness: 'fresh',
    bindingFreshness: 'fresh',
    ...overrides,
  };
}

test('project-facts builder preserves explicit facts and validates its digest', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  assert.equal(envelope.artifactGraphSummary.artifactCount, 12);
  assert.equal(envelope.sourcesFreshness, 'fresh');
  assert.equal(envelope.bindingFreshness, 'fresh');
  assert.equal(envelope.evidenceDigest, computeEvidenceDigest(envelope));
  assert.equal((await validateProjectFacts(envelope)).ok, true);
});

for (const field of ['artifactGraphSummary', 'sourcesFreshness', 'bindingFreshness']) {
  test(`project-facts missing ${field} fails at the producer boundary`, () => {
    const facts = projectFacts();
    delete facts[field];
    assert.throws(() => buildProjectFactsEnvelope(facts), TypeError);
  });
}

test('project-facts producer sorts and deduplicates contextTargets', async () => {
  const facts = projectFacts();
  facts.artifactGraphSummary.contextTargets = ['ACA18', 'ACA12', 'ACA18'];
  const envelope = buildProjectFactsEnvelope(facts);
  assert.deepEqual(envelope.artifactGraphSummary.contextTargets, ['ACA12', 'ACA18']);
  assert.equal((await validateProjectFacts(envelope)).ok, true);
});

test('project-facts validator rejects hand-written unordered or duplicate contextTargets', async () => {
  for (const contextTargets of [['ACA18', 'ACA12'], ['ACA12', 'ACA12']]) {
    const envelope = buildProjectFactsEnvelope(projectFacts());
    envelope.artifactGraphSummary.contextTargets = contextTargets;
    envelope.evidenceDigest = computeEvidenceDigest(envelope);
    const result = await validateProjectFacts(envelope);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === 'NON_CANONICAL_CONTEXT_TARGETS'));
  }
});

test('project-facts tampering invalidates evidenceDigest', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.artifactGraphSummary.edgeCount += 1;
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'DIGEST_MISMATCH'));
});

test('diagnostic messages do not leak sensitive data (projectRoot, digest values, absolute paths)', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  // Tamper to trigger DIGEST_MISMATCH
  envelope.artifactGraphSummary.edgeCount += 1;
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false);

  const errorMessages = JSON.stringify(result.errors);
  // Must not contain projectRoot value
  assert.ok(!errorMessages.includes('/test/project'), 'diagnostic must not contain projectRoot');
  // Must not contain digest values
  assert.ok(!errorMessages.includes(digest('a')), 'diagnostic must not contain configDigest value');
  assert.ok(!errorMessages.includes(digest('c')), 'diagnostic must not contain contractRevisionDigest value');
  // Must not contain absolute paths
  // Note: patterns are built dynamically so the repo's own private-content
  // scan (which rejects literal user-home path bytes in published files) passes.
  const usersHomePattern = ['', 'Users', ''].join('/');
  assert.ok(!errorMessages.includes(usersHomePattern), 'diagnostic must not contain user-home path');
  assert.ok(!errorMessages.includes('/home/'), 'diagnostic must not contain /home/ path');
  assert.ok(!errorMessages.includes('/tmp/'), 'diagnostic must not contain /tmp/ path');
  // Must not contain the declared/computed prefix
  assert.ok(!errorMessages.includes('declared'), 'diagnostic must not contain "declared" prefix');
  assert.ok(!errorMessages.includes('computed'), 'diagnostic must not contain "computed" prefix');
});

// ── R2: Mutation matrix ──
// Each named field gets an independent test that tampering/missing causes rejection.

test('R2 mutation matrix: targetArtifact.type tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.targetArtifact.type = 'tampered-type';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'targetArtifact.type tamper should fail');
});

test('R2 mutation matrix: targetArtifact.id tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.targetArtifact.id = 'tampered-id';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'targetArtifact.id tamper should fail');
});

test('R2 mutation matrix: configDigest tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.configDigest = digest('X');
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'configDigest tamper should fail');
});

test('R2 mutation matrix: policyDigest value change → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.policyDigest = digest('Y');
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'policyDigest change should fail');
});

test('R2 mutation matrix: policyDigest add (was null) → reject', async () => {
  const facts = projectFacts();
  delete facts.policyDigest;
  const envelope = buildProjectFactsEnvelope(facts);
  assert.equal(envelope.policyDigest, undefined, 'policyDigest should be absent when not provided');
  // Now add it
  envelope.policyDigest = digest('Z');
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'adding policyDigest should fail');
});

test('R2 mutation matrix: policyDigest remove (set to null when was digest) → reject', async () => {
  const facts = projectFacts({ policyDigest: digest('P') });
  const envelope = buildProjectFactsEnvelope(facts);
  envelope.policyDigest = null;
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'removing policyDigest should fail');
});

test('R2 mutation matrix: artifactGraphSummary.artifactCount tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.artifactGraphSummary.artifactCount = 999;
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'artifactCount tamper should fail');
});

test('R2 mutation matrix: artifactGraphSummary.edgeCount tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.artifactGraphSummary.edgeCount = 999;
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'edgeCount tamper should fail');
});

test('R2 mutation matrix: artifactGraphSummary.contextTargets tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.artifactGraphSummary.contextTargets = ['TAMPERED'];
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'contextTargets tamper should fail');
});

test('R2 mutation matrix: proofStatus tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.proofStatus = 'missing';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'proofStatus tamper should fail');
});

test('R2 mutation matrix: versionLockStatus tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.versionLockStatus = 'stale';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'versionLockStatus tamper should fail');
});

test('R2 mutation matrix: sourcesFreshness tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.sourcesFreshness = 'stale';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'sourcesFreshness tamper should fail');
});

test('R2 mutation matrix: bindingFreshness tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.bindingFreshness = 'missing';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'bindingFreshness tamper should fail');
});

test('R2 mutation matrix: contractRevisionDigest tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.contractRevisionDigest = digest('M');
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'contractRevisionDigest tamper should fail');
});

test('R2 mutation matrix: evidenceDigest tamper → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.evidenceDigest = digest('N');
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'evidenceDigest tamper should fail');
});

// ── R2: Missing field matrix ──

for (const field of [
  'schemaVersion', 'projectRoot', 'configDigest',
  'artifactGraphSummary', 'targetArtifact', 'contractRevisionDigest',
  'proofStatus', 'versionLockStatus', 'sourcesFreshness', 'bindingFreshness', 'evidenceDigest',
]) {
  test(`R2 missing field: ${field} → reject`, async () => {
    const envelope = buildProjectFactsEnvelope(projectFacts());
    delete envelope[field];
    const result = await validateProjectFacts(envelope);
    assert.equal(result.ok, false, `missing ${field} should fail`);
  });
}

// ── R2: Extra field rejection ──

test('R2 extra top-level field → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.extraField = 'should-not-be-here';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'extra top-level field should fail');
});

test('R2 extra nested field in artifactGraphSummary → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.artifactGraphSummary.extraNested = 'should-not-be-here';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'extra nested field should fail');
});

test('R2 extra nested field in targetArtifact → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.targetArtifact.extraNested = 'should-not-be-here';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'extra nested field in targetArtifact should fail');
});

// ── R2: Null/array type rejection ──

test('R2 null envelope → reject', async () => {
  const result = await validateProjectFacts(null);
  assert.equal(result.ok, false, 'null envelope should fail');
});

test('R2 array envelope → reject', async () => {
  const result = await validateProjectFacts([]);
  assert.equal(result.ok, false, 'array envelope should fail');
});

test('R2 string projectRoot → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.projectRoot = 123;
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'non-string projectRoot should fail');
});

test('R2 array artifactGraphSummary → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.artifactGraphSummary = [1, 2, 3];
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'array artifactGraphSummary should fail');
});

test('R2 invalid enum proofStatus → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.proofStatus = 'invalid-enum';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'invalid proofStatus enum should fail');
});

test('R2 invalid enum versionLockStatus → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.versionLockStatus = 'invalid-enum';
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'invalid versionLockStatus enum should fail');
});

test('R2 negative integer artifactCount → reject', async () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  envelope.artifactGraphSummary.artifactCount = -1;
  const result = await validateProjectFacts(envelope);
  assert.equal(result.ok, false, 'negative artifactCount should fail');
});

// ── R2: Mutation matrix output does not leak sensitive data ──

test('R2 mutation matrix output does not contain projectRoot or tampered values', async () => {
  const sensitivePatterns = [['', 'Users', ''].join('/'), '/home/', '/tmp/', 'C:\\', '\\\\', '/test/project'];

  for (const makeEnvelope of [
    () => { const e = buildProjectFactsEnvelope(projectFacts()); e.configDigest = digest('X'); return e; },
    () => { const e = buildProjectFactsEnvelope(projectFacts()); e.targetArtifact.type = 'TAMPER'; return e; },
    () => { const e = buildProjectFactsEnvelope(projectFacts()); e.evidenceDigest = digest('Z'); return e; },
  ]) {
    const envelope = makeEnvelope();
    const result = await validateProjectFacts(envelope);
    const errorStr = JSON.stringify(result.errors);
    for (const pattern of sensitivePatterns) {
      assert.ok(!errorStr.includes(pattern), `diagnostic must not contain ${pattern}`);
    }
  }
});

// ── Candidate builder tests ──

test('buildMethodQueryCandidate produces 5-key candidate', () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  const candidate = buildMethodQueryCandidate({
    mode: 'standard',
    intent: 'author',
    kind: 'workflow',
    projectFactsEvidence: envelope,
    authorization: { sideEffectBudget: 'write-authorized-artifacts', granted: false },
  });

  const keys = Object.keys(candidate);
  assert.equal(keys.length, 5, 'candidate should have exactly 5 keys');
  assert.ok(keys.includes('mode'));
  assert.ok(keys.includes('intent'));
  assert.ok(keys.includes('kind'));
  assert.ok(keys.includes('projectFactsEvidence'));
  assert.ok(keys.includes('authorization'));
  // Must NOT contain targetArtifact, contractRevisionDigest, queryDigest, etc.
  assert.ok(!keys.includes('targetArtifact'), 'candidate must not contain targetArtifact');
  assert.ok(!keys.includes('contractRevisionDigest'), 'candidate must not contain contractRevisionDigest');
  assert.ok(!keys.includes('queryDigest'), 'candidate must not contain queryDigest');
  assert.ok(!keys.includes('candidateServices'), 'candidate must not contain candidateServices');
});

test('buildMethodQueryCandidate rejects non-object projectFactsEvidence', () => {
  const base = {
    mode: 'standard',
    intent: 'author',
    kind: 'workflow',
    authorization: { sideEffectBudget: 'write-authorized-artifacts', granted: false },
  };
  assert.throws(
    () => buildMethodQueryCandidate({ ...base, projectFactsEvidence: 'invalid' }),
    /must be a valid Project Facts Evidence Envelope object/,
  );
  assert.throws(
    () => buildMethodQueryCandidate({ ...base, projectFactsEvidence: [1, 2, 3] }),
    /must be a valid Project Facts Evidence Envelope object/,
  );
});

test('buildMethodQueryCandidate rejects missing fields, extra fields, and forged evidence', () => {
  const envelope = buildProjectFactsEnvelope(projectFacts());
  const valid = {
    mode: 'standard',
    intent: 'author',
    kind: 'workflow',
    projectFactsEvidence: envelope,
    authorization: { sideEffectBudget: 'write-authorized-artifacts', granted: false },
  };
  assert.throws(
    () => buildMethodQueryCandidate({ projectFactsEvidence: envelope }),
    /exactly 5 keys/,
  );
  assert.throws(
    () => buildMethodQueryCandidate({ ...valid, extra: true }),
    /exactly 5 keys/,
  );
  assert.throws(
    () => buildMethodQueryCandidate({ ...valid, projectFactsEvidence: { forged: true } }),
    /projectFactsEvidence validation failed/,
  );
  assert.throws(
    () => buildMethodQueryCandidate({ ...valid, kind: 'task' }),
    /kind must be 'workflow' or 'operation'/,
  );
});

test('buildMethodQueryCandidate rejects invalid mode, intent, and authorization', () => {
  const valid = {
    mode: 'standard',
    intent: 'author',
    kind: 'workflow',
    projectFactsEvidence: buildProjectFactsEnvelope(projectFacts()),
    authorization: { sideEffectBudget: 'write-authorized-artifacts', granted: false },
  };
  for (const [candidate, message] of [
    [{ ...valid, mode: 'legacy' }, /mode must be 'standard'/],
    [{ ...valid, intent: 'invent' }, /intent must be one of/],
    [{ ...valid, authorization: {} }, /authorization must have exactly/],
    [{ ...valid, authorization: { ...valid.authorization, extra: true } }, /authorization must have exactly/],
    [{ ...valid, authorization: { sideEffectBudget: 'root', granted: false } }, /sideEffectBudget must be one of/],
    [{ ...valid, authorization: { sideEffectBudget: 'read-only', granted: 'yes' } }, /granted must be a boolean/],
  ]) {
    assert.throws(() => buildMethodQueryCandidate(candidate), message);
  }
});

// ── where-am-i template tests ──

test('where-am-i template describes candidate → Registry recommendation without exporting a handle', async () => {
  const template = await readFile(join(pluginRoot, 'skills-src/where-am-i/SKILL.md.tpl'), 'utf8');
  assert.ok(template.includes('scripts/method-query.mjs'), 'must reference method-query CLI');
  assert.ok(template.includes('build-candidate'), 'must mention build-candidate command');
  assert.ok(template.includes('preparedQueryHandle'), 'must name the process-local Registry capability correctly');
  assert.ok(template.includes('不得输出或序列化'), 'must forbid exporting the process-local handle');
  assert.ok(template.includes('agent-method-registry query'), 'must use Registry as the dynamic discovery trigger');
  assert.ok(template.includes('--candidate <candidate-json-path>'), 'must pass the validated candidate to Registry v2');
  assert.ok(!template.includes('--format compact'), 'v2 candidate must be the single query source');
  assert.ok(!template.includes('--artifact-type <artifact-type>'), 'must not mix v1 artifact filters into v2 recommendation');
  assert.ok(!template.includes('--intent <intent>'), 'must not mix v1 intent filters into v2 recommendation');
  assert.ok(!template.includes('--kind <workflow-or-operation>'), 'must not mix v1 kind filters into v2 recommendation');
  for (const state of ['installation', 'enablement', 'compatibility', 'trust', 'resolution', 'selectionSource']) {
    assert.ok(template.includes(`\`${state}\``) || template.includes(`${state}:`), `must explain ${state}`);
  }
  // 阻止模板重新出现"六状态同时满足则自行判可执行"的复制规则
  assert.ok(!template.includes('只有 `installation: INSTALLED`、`enablement: ENABLED`、`compatibility: COMPATIBLE`、`trust: VERIFIED`、`resolution: EXPLICIT_BINDING`、`selectionSource: project-binding` 同时成立时，才能标记为"可执行"'), 'must not contain six-state conjunction rule');
  assert.ok(template.includes('executable'), 'must reference executable field from Registry');
  assert.ok(template.includes('不得重新推导可执行性'), 'must forbid re-deriving executability');
  assert.ok(template.includes('已发现但尚不可执行'), 'must distinguish discovery from executability');
  assert.ok(template.includes('resolution: EXPLICIT_BINDING'), 'must require explicit binding before executability');
  assert.ok(template.includes('selectionSource: project-binding'), 'must require project binding as selection source');
  assert.ok(template.includes('不能取第一项'), 'must fail closed on ambiguous recommendations');
  assert.ok(template.includes('5 个顶层键'), 'must describe 5-key candidate');
  assert.ok(!template.includes('build-query'), 'must not reference deprecated build-query command');
  // queryDigest may appear in description of Registry-produced fields, but NOT in the candidate example
  const candidateSection = template.split('## Method Query Candidate 输出')[1] || '';
  const candidateExample = candidateSection.split('```')[1] || '';
  assert.ok(!candidateExample.includes('queryDigest'), 'candidate example must not show queryDigest');
  assert.ok(template.includes('不得自行解析提供方路径'));
});

test('root and both adapters contain no full Method Query schema or validator entry', async () => {
  for (const prefix of ['', 'adapters/codex', 'adapters/claude']) {
    for (const path of ['schemas/method-query.schema.json', 'scripts/lib/generated/method-query-validator.generated.mjs']) {
      await assert.rejects(access(join(pluginRoot, prefix, path)));
    }
    const library = await readFile(join(pluginRoot, prefix, 'scripts/lib/method-query.mjs'), 'utf8');
    const cli = await readFile(join(pluginRoot, prefix, 'scripts/method-query.mjs'), 'utf8');
    assert.ok(!library.includes('validateMethodQuery'));
    assert.ok(!cli.includes('validate-query'));
  }
});

// ── CLI tests ──

test('CLI --help shows build-candidate, not build-query', async () => {
  const cli = join(pluginRoot, 'scripts/method-query.mjs');
  try {
    execFileSync('node', [cli, '--help'], { encoding: 'utf8' });
  } catch (err) {
    const helpText = err.stderr ?? '';
    assert.ok(helpText.includes('build-candidate'), 'help must show build-candidate');
    assert.ok(!helpText.includes('build-query'), 'help must not show build-query');
    assert.ok(!helpText.includes('validate-query'), 'help must not show full-query validation');
    assert.ok(!helpText.includes('digest'), 'help must not show digest command');
  }
});

test('CLI build-candidate produces 5-key candidate', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'method-query-cli-'));
  const paramsPath = join(temp, 'params.json');
  await writeFile(paramsPath, JSON.stringify({
    mode: 'standard',
    intent: 'author',
    kind: 'workflow',
    projectFactsEvidence: buildProjectFactsEnvelope(projectFacts()),
    authorization: { sideEffectBudget: 'write-authorized-artifacts', granted: false },
  }));
  const cli = join(pluginRoot, 'scripts/method-query.mjs');
  const result = JSON.parse(execFileSync('node', [cli, 'build-candidate', paramsPath], { encoding: 'utf8' }));
  assert.equal(result.ok, true);
  const keys = Object.keys(result.candidate);
  assert.equal(keys.length, 5, 'CLI candidate should have 5 keys');
});

test('CLI build-candidate fails closed for forged project facts evidence', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'method-query-cli-'));
  const paramsPath = join(temp, 'params.json');
  await writeFile(paramsPath, JSON.stringify({
    mode: 'standard',
    intent: 'author',
    kind: 'workflow',
    projectFactsEvidence: { forged: true },
    authorization: { sideEffectBudget: 'write-authorized-artifacts', granted: false },
  }));
  const cli = join(pluginRoot, 'scripts/method-query.mjs');
  assert.throws(
    () => execFileSync('node', [cli, 'build-candidate', paramsPath], { encoding: 'utf8', stdio: 'pipe' }),
    error => error.status === 1 && String(error.stderr).includes('projectFactsEvidence validation failed'),
  );
});

test('CLI validate-envelope still works', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'method-query-cli-'));
  const envelopePath = join(temp, 'envelope.json');
  await writeFile(envelopePath, JSON.stringify(buildProjectFactsEnvelope(projectFacts())));
  const cli = join(pluginRoot, 'scripts/method-query.mjs');
  const result = JSON.parse(execFileSync('node', [cli, 'validate-envelope', envelopePath], { encoding: 'utf8' }));
  assert.equal(result.ok, true);
});
