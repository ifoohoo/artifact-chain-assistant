// @feature ACA17
// @scenario S-52
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const pluginRoot = resolve(import.meta.dirname, '..');
const artifactGraphCli = resolve(pluginRoot, '..', '..', 'node_modules/.bin/artifact-graph');
const hasArtifactGraphCli = await access(artifactGraphCli).then(() => true, () => false);
const runnerTest = hasArtifactGraphCli
  ? test
  : (name, fn) => test.skip(`${name} [requires public artifact-graph CLI]`, fn);
const runner = join(pluginRoot, 'scripts/run-artifact-workflow.mjs');
const workerPath = join(pluginRoot, 'skills-src/artifact-workflow-worker/SKILL.md');

async function fixture(intent) {
  const root = await mkdtemp(join(tmpdir(), `public-worker-${intent}-`));
  await mkdir(join(root, 'artifact-profiles'), { recursive: true });
  await mkdir(join(root, 'artifacts/checklists'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await mkdir(join(root, 'runs'), { recursive: true });
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true });
  await symlink(artifactGraphCli, join(root, 'node_modules/.bin/artifact-graph'));
  const profilePath = join(root, 'artifact-profiles/project.yaml');
  const checklistPath = join(root, 'artifacts/checklists/check.md');
  const templatePath = join(root, 'template.md');
  const targetPath = join(root, 'artifact.md');
  const validatorPath = join(root, 'scripts/validate.mjs');
  const taskPath = join(root, 'task.json');
  await writeFile(join(root, 'artifact-graph.config.yaml'), 'artifactTypes: {}\n');
  await writeFile(profilePath, `schema_version: 1
project:
  id: runner-test
  language: markdown
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/check.md
      validators:
        - scripts/validate.mjs
  repair:
    design-spec:
      checklists:
        - artifacts/checklists/check.md
      validators:
        - scripts/validate.mjs
  generate:
    design-spec:
      templates:
        - template.md
      validators:
        - scripts/validate.mjs
`);
  await writeFile(checklistPath, '# Checklist\n- target is valid\n');
  await writeFile(templatePath, '# Generated design\n');
  return { root, profilePath, checklistPath, templatePath, targetPath, validatorPath, taskPath };
}

function taskFor(paths, intent, inputResult = null) {
  return {
    intent,
    domain: 'design-spec',
    target_path: paths.targetPath,
    run_dir: join(paths.root, 'runs', intent),
    profile_resolution: {
      status: 'OK',
      profile_path: paths.profilePath,
      execution_mode: 'public-worker',
      worker_path: workerPath,
      checklist_paths: intent === 'generate' ? [] : [paths.checklistPath],
      validators: [{ path: paths.validatorPath, command: `node ${paths.validatorPath}`, exit_code: 0, stdout: '', stderr: '' }],
      template_paths: intent === 'generate' ? [paths.templatePath] : [],
      diagnostics: [],
      next: 'Invoke the resolved workflow.',
    },
    input_result: inputResult,
  };
}

function semanticReview(paths, overrides = {}) {
  return {
    schema_version: '1.0',
    run_id: 'semantic-review',
    status: 'SUCCEEDED',
    decision: 'PASS',
    summary: 'Independent semantic review passed.',
    producer: { executor: 'agent', name: 'semantic-reviewer', skill: 'project-review-design' },
    review: { source_files: [paths.targetPath], findings: [] },
    ...overrides,
  };
}

async function runTask(paths, task) {
  await writeFile(paths.taskPath, `${JSON.stringify(task, null, 2)}\n`);
  const { stdout } = await execFileAsync(process.execPath, [runner, '--task', paths.taskPath], { cwd: pluginRoot });
  return JSON.parse(stdout);
}

async function assertValidReviewResult(paths, result) {
  const resultPath = join(paths.root, 'official-review-result.json');
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  const { stdout } = await execFileAsync(artifactGraphCli, [
    'validate-review-result', '--root', paths.root, '--file', resultPath, '--format', 'json',
  ], { cwd: paths.root });
  const validation = JSON.parse(stdout);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
}

runnerTest('public review without an independently validated semantic result returns NEEDS_INPUT instead of PASS', async () => {
  const paths = await fixture('review');
  try {
    await writeFile(paths.targetPath, '# Valid design\n');
    await writeFile(paths.validatorPath, 'process.exit(0);\n');
    const result = await runTask(paths, taskFor(paths, 'review'));
    await assertValidReviewResult(paths, result);
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.equal(result.decision, 'NEEDS_INPUT');
    assert.equal(JSON.parse(await readFile(join(paths.root, 'runs/review/result.json'), 'utf8')).run_id, result.run_id);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('public review finalizes a valid semantic result and associates target, validator, and checklist evidence', async () => {
  const paths = await fixture('review');
  try {
    await writeFile(paths.targetPath, '# Valid design\n');
    await writeFile(paths.validatorPath, `import { appendFileSync } from 'node:fs'; appendFileSync(${JSON.stringify(join(paths.root, 'validator.log'))}, 'ran\\n');`);
    const result = await runTask(paths, taskFor(paths, 'review', semanticReview(paths)));
    await assertValidReviewResult(paths, result);
    assert.equal(result.decision, 'PASS');
    assert.equal(result.producer.executor, 'agent');
    assert.equal(await readFile(join(paths.root, 'validator.log'), 'utf8'), 'ran\n');
    for (const type of ['target', 'validator', 'checklist', 'semantic-validator']) {
      assert.ok(result.evidence.some((item) => item.type === type), `missing ${type} evidence`);
    }
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('public review preserves FAIL when a valid semantic result contains an open block finding', async () => {
  const paths = await fixture('review');
  try {
    await writeFile(paths.targetPath, '# Invalid design\n');
    await writeFile(paths.validatorPath, 'process.exit(0);\n');
    const input = semanticReview(paths, {
      decision: 'FAIL',
      summary: 'Blocking issue remains.',
      review: { source_files: [paths.targetPath], findings: [{ id: 'F-BLOCK', severity: 'block', message: 'Missing contract', status: 'open' }] },
    });
    const result = await runTask(paths, taskFor(paths, 'review', input));
    await assertValidReviewResult(paths, result);
    assert.equal(result.decision, 'FAIL');
    assert.equal(result.review.findings[0].status, 'open');
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('public generate reads template, writes the explicit target, then runs validator', async () => {
  const paths = await fixture('generate');
  try {
    await writeFile(paths.validatorPath, `import { readFileSync } from 'node:fs'; if (readFileSync(process.env.ARTIFACT_WORKFLOW_TARGET, 'utf8') !== '# Generated design\\n') process.exit(7);`);
    const result = await runTask(paths, taskFor(paths, 'generate'));
    await assertValidReviewResult(paths, result);
    assert.equal(result.status, 'SUCCEEDED', JSON.stringify(result));
    assert.equal(await readFile(paths.targetPath, 'utf8'), '# Generated design\n');
    assert.equal(result.decision, 'NOT_APPLICABLE');
    assert.equal(result.producer.executor, 'script');
    assert.deepEqual(result.outputs, [await realpath(paths.targetPath)]);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('public repair consumes a source result, applies only the located line repair, revalidates, and does not self-accept', async () => {
  const paths = await fixture('repair');
  try {
    await writeFile(paths.targetPath, 'title: wrng\nbody: keep\n');
    await writeFile(paths.validatorPath, `import { readFileSync } from 'node:fs'; if (!readFileSync(process.env.ARTIFACT_WORKFLOW_TARGET, 'utf8').startsWith('title: correct\\n')) process.exit(8);`);
    const source = {
      schema_version: '1.0', run_id: 'review-source', status: 'SUCCEEDED', decision: 'FAIL', summary: 'Repair required.',
      producer: { executor: 'worker', name: 'review-worker', skill: 'artifact-review' },
      review: { findings: [{
        id: 'F-1', severity: 'block', message: 'Title typo', status: 'open', suggested_fix: 'title: correct',
        location: { file: paths.targetPath, line: 1 },
      }] },
    };
    const result = await runTask(paths, taskFor(paths, 'repair', source));
    await assertValidReviewResult(paths, result);
    assert.equal(await readFile(paths.targetPath, 'utf8'), 'title: correct\nbody: keep\n');
    assert.equal(result.decision, 'NOT_APPLICABLE');
    assert.equal(result.producer.executor, 'script');
    assert.equal(result.acceptance, undefined);
    assert.deepEqual(result.repair.files_modified, [await realpath(paths.targetPath)]);
    assert.equal(result.repair.findings_addressed[0].status, 'resolved');
    assert.equal(result.repair.validation_after_repair.exit_code, 0);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('repair rejects a semantically invalid full source result without writing the target', async () => {
  const paths = await fixture('repair-invalid');
  try {
    await writeFile(paths.targetPath, 'title: original\n');
    await writeFile(paths.validatorPath, 'process.exit(0);\n');
    const invalid = semanticReview(paths, {
      decision: 'FAIL',
      legacy_findings: [],
      review: { findings: [{ id: 'F-1', severity: 'block', message: 'Fix', suggested_fix: 'title: changed', location: { file: paths.targetPath, line: 1 } }] },
    });
    const result = await runTask(paths, taskFor(paths, 'repair', invalid));
    await assertValidReviewResult(paths, result);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(await readFile(paths.targetPath, 'utf8'), 'title: original\n');
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('repair ignores resolved, accepted, and superseded findings and returns a no-op result without writing', async () => {
  const paths = await fixture('repair-noop');
  try {
    await writeFile(paths.targetPath, 'title: original\n');
    await writeFile(paths.validatorPath, 'process.exit(0);\n');
    const source = semanticReview(paths, {
      decision: 'FAIL',
      review: { findings: ['resolved', 'accepted', 'superseded'].map((status, index) => ({
        id: `F-${index}`, severity: 'warn', message: 'Already closed', status,
        suggested_fix: 'title: changed', location: { file: paths.targetPath, line: 1 },
      })) },
    });
    const result = await runTask(paths, taskFor(paths, 'repair', source));
    await assertValidReviewResult(paths, result);
    assert.equal(result.status, 'SKIPPED');
    assert.equal(result.decision, 'NOT_APPLICABLE');
    assert.deepEqual(result.repair.files_modified, []);
    assert.equal(await readFile(paths.targetPath, 'utf8'), 'title: original\n');
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('repair validator exit 9 leaves target bytes unchanged and writes a valid BLOCKED result with process evidence', async () => {
  const paths = await fixture('repair-blocked');
  try {
    await writeFile(paths.targetPath, 'title: original\n');
    await writeFile(paths.validatorPath, "process.stdout.write('out-nine'); process.stderr.write('err-nine'); process.exit(9);\n");
    const source = semanticReview(paths, {
      decision: 'FAIL',
      review: { findings: [{ id: 'F-1', severity: 'block', message: 'Fix', status: 'open', suggested_fix: 'title: changed', location: { file: paths.targetPath, line: 1 } }] },
    });
    const result = await runTask(paths, taskFor(paths, 'repair', source));
    await assertValidReviewResult(paths, result);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(await readFile(paths.targetPath, 'utf8'), 'title: original\n');
    assert.match(JSON.stringify(result.evidence), /exit=9/);
    assert.match(JSON.stringify(result.evidence), /out-nine/);
    assert.match(JSON.stringify(result.evidence), /err-nine/);
    assert.equal(JSON.parse(await readFile(join(paths.root, 'runs/repair/result.json'), 'utf8')).status, 'BLOCKED');
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

runnerTest('generate validator failure preserves an existing target and writes a valid BLOCKED result', async () => {
  const paths = await fixture('generate-blocked');
  try {
    await writeFile(paths.targetPath, 'existing bytes\n');
    await writeFile(paths.validatorPath, "process.stderr.write('generation rejected'); process.exit(9);\n");
    const result = await runTask(paths, taskFor(paths, 'generate'));
    await assertValidReviewResult(paths, result);
    assert.equal(result.status, 'BLOCKED', JSON.stringify(result));
    assert.equal(await readFile(paths.targetPath, 'utf8'), 'existing bytes\n');
    assert.match(JSON.stringify(result.evidence), /generation rejected/);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

for (const tamper of ['worker', 'profile', 'resources']) {
  runnerTest(`runner rejects forged ${tamper} provenance`, async () => {
    const paths = await fixture(`forged-${tamper}`);
    try {
      await writeFile(paths.targetPath, '# Valid design\n');
      await writeFile(paths.validatorPath, 'process.exit(0);\n');
      const task = taskFor(paths, 'review', semanticReview(paths));
      if (tamper === 'worker') task.profile_resolution.worker_path = join(paths.root, 'claimed-worker.md');
      if (tamper === 'profile') {
        const forged = join(paths.root, 'artifact-profiles/forged.yaml');
        await writeFile(forged, await readFile(paths.profilePath, 'utf8'));
        task.profile_resolution.profile_path = forged;
      }
      if (tamper === 'resources') {
        const forged = join(paths.root, 'artifacts/checklists/forged.md');
        await writeFile(forged, '# Forged\n');
        task.profile_resolution.checklist_paths = [forged];
      }
      const result = await runTask(paths, task);
      await assertValidReviewResult(paths, result);
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.blocking_reason, /provenance|profile|worker|resource/i);
    } finally {
      await rm(paths.root, { recursive: true, force: true });
    }
  });
}
