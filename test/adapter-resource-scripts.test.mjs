// @feature ACA16 @scenario S-49 @scenario S-50
// @feature ACA17
// @scenario S-56
// Adapter resource completeness: verify that check-workflow-profile.mjs,
// batch-split.mjs, and batch-merge.mjs are present and executable from
// each host adapter root (codex, claude).

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access, chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execPath } from 'node:process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PLUGIN_ROOT = resolve(dirname(import.meta.dirname));
const NODE = execPath;
const PARENT_ARTIFACT_GRAPH_CLI = resolve(PLUGIN_ROOT, '..', '..', 'node_modules/.bin/artifact-graph');
const hasParentArtifactGraphCli = await access(PARENT_ARTIFACT_GRAPH_CLI).then(() => true, () => false);
const installedRunnerTest = hasParentArtifactGraphCli
  ? test
  : (name, fn) => test.skip(`${name} [requires parent artifact-graph CLI]`, fn);

const MANAGED_SCRIPTS = [
  'scripts/check-workflow-profile.mjs',
  'scripts/run-artifact-workflow.mjs',
  'scripts/batch-split.mjs',
  'scripts/batch-merge.mjs',
  'scripts/lib/inline-yaml-parser.mjs',
  'scripts/lib/workflow-profile.mjs',
];

const HOSTS = ['codex', 'claude'];

async function runChecker(adapterRoot, projectRoot, action, domain) {
  const args = ['scripts/check-workflow-profile.mjs', '--root', projectRoot, '--action', action, '--format', 'json'];
  if (domain !== undefined) args.push('--domain', domain);
  try {
    const { stdout } = await execFileAsync(NODE, args, { cwd: adapterRoot });
    return JSON.parse(stdout);
  } catch (error) {
    return JSON.parse(error.stdout);
  }
}

// ── existence & executability ─────────────────────────────────────────

for (const host of HOSTS) {
  for (const script of MANAGED_SCRIPTS) {
    test(`${host}: adapter contains ${script}`, async () => {
      const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
      await access(join(adapterRoot, script));
    });
  }
}

for (const host of HOSTS) {
  test(`${host}: three scripts have same file mode as source`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    for (const script of MANAGED_SCRIPTS) {
      const sourcePath = join(PLUGIN_ROOT, script);
      const adapterPath = join(adapterRoot, script);
      const [s, a] = await Promise.all([stat(sourcePath), stat(adapterPath)]);
      assert.equal(
        a.mode & 0o111,
        s.mode & 0o111,
        `${host}/${script} executable bits should match source`,
      );
    }
  });
}

// ── check-workflow-profile.mjs from adapter root ─────────────────────

for (const host of HOSTS) {
  test(`${host}: adapter fails closed for damaged profile, worker, resource, action, domain and prototype config`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);

    const danglingProfile = await mkdtemp(join(tmpdir(), `adapter-dangling-profile-${host}-`));
    const danglingWorker = await mkdtemp(join(tmpdir(), `adapter-dangling-worker-${host}-`));
    const danglingResource = await mkdtemp(join(tmpdir(), `adapter-dangling-resource-${host}-`));
    const prototypeProfile = await mkdtemp(join(tmpdir(), `adapter-prototype-${host}-`));
    const externalEmptyRoot = await mkdtemp(join(tmpdir(), `adapter-external-empty-root-${host}-`));
    const danglingSkillsRoot = await mkdtemp(join(tmpdir(), `adapter-dangling-skills-root-${host}-`));
    const dangerousLegacy = await mkdtemp(join(tmpdir(), `adapter-dangerous-legacy-${host}-`));
    const emptyRelease = await mkdtemp(join(tmpdir(), `adapter-release-${host}-`));
    try {
      await mkdir(join(danglingProfile, 'artifact-profiles'), { recursive: true });
      await symlink(join(danglingProfile, 'missing.yaml'), join(danglingProfile, 'artifact-profiles/project.yaml'));
      await writeFile(join(danglingProfile, '.artifact-review.json'), '{"workers":{"review":{}}}\n');
      assert.equal((await runChecker(adapterRoot, danglingProfile, 'review', 'design-spec')).status, 'BLOCKED');

      await mkdir(join(danglingWorker, 'artifact-profiles'), { recursive: true });
      await mkdir(join(danglingWorker, 'artifacts/checklists'), { recursive: true });
      await mkdir(join(danglingWorker, '.agents/skills/project-review'), { recursive: true });
      await mkdir(join(danglingWorker, '.claude/skills/project-review'), { recursive: true });
      await writeFile(join(danglingWorker, 'artifacts/checklists/review.md'), '# Review\n');
      await writeFile(join(danglingWorker, '.agents/skills/project-review/SKILL.md'), '---\nname: project-review\n---\n');
      await symlink(join(danglingWorker, 'missing-worker.md'), join(danglingWorker, '.claude/skills/project-review/SKILL.md'));
      await writeFile(join(danglingWorker, 'artifact-profiles/project.yaml'), `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/review.md
      worker:
        skill: project-review
`);
      assert.equal((await runChecker(adapterRoot, danglingWorker, 'review', 'design-spec')).status, 'BLOCKED');

      await mkdir(join(danglingResource, 'artifact-profiles'), { recursive: true });
      await mkdir(join(danglingResource, 'artifacts/checklists'), { recursive: true });
      await symlink(join(danglingResource, 'missing.md'), join(danglingResource, 'artifacts/checklists/review.md'));
      await writeFile(join(danglingResource, 'artifact-profiles/project.yaml'), `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/review.md
`);
      assert.equal((await runChecker(adapterRoot, danglingResource, 'review', 'design-spec')).status, 'BLOCKED');
      assert.equal((await runChecker(adapterRoot, danglingResource, 'deploy', 'design-spec')).status, 'BLOCKED');
      assert.equal((await runChecker(adapterRoot, danglingResource, 'review', undefined)).status, 'BLOCKED');

      await mkdir(join(prototypeProfile, 'artifact-profiles'), { recursive: true });
      await writeFile(join(prototypeProfile, 'artifact-profiles/project.yaml'), `schema_version: 1
project:
  id: test-proj
  language: typescript
  __proto__: polluted
workflows: {}
`);
      assert.equal((await runChecker(adapterRoot, prototypeProfile, 'review', 'design-spec')).status, 'BLOCKED');

      const outside = await mkdtemp(join(tmpdir(), `adapter-outside-empty-skills-${host}-`));
      await mkdir(join(outside, 'skills'), { recursive: true });
      await mkdir(join(externalEmptyRoot, '.agents'), { recursive: true });
      await symlink(join(outside, 'skills'), join(externalEmptyRoot, '.agents/skills'));
      await mkdir(join(externalEmptyRoot, '.claude/skills/project-review'), { recursive: true });
      await writeFile(join(externalEmptyRoot, '.claude/skills/project-review/SKILL.md'), '---\nname: project-review\n---\n');
      await writeFile(join(externalEmptyRoot, '.artifact-review.json'), '{"workers":{"review":{"design-spec":"project-review"}}}\n');
      assert.equal((await runChecker(adapterRoot, externalEmptyRoot, 'review', 'design-spec')).status, 'BLOCKED');
      await rm(outside, { recursive: true, force: true });

      await mkdir(join(danglingSkillsRoot, '.agents'), { recursive: true });
      await symlink(join(danglingSkillsRoot, 'missing-skills'), join(danglingSkillsRoot, '.agents/skills'));
      await mkdir(join(danglingSkillsRoot, '.claude/skills/project-review'), { recursive: true });
      await writeFile(join(danglingSkillsRoot, '.claude/skills/project-review/SKILL.md'), '---\nname: project-review\n---\n');
      await writeFile(join(danglingSkillsRoot, '.artifact-review.json'), '{"workers":{"review":{"design-spec":"project-review"}}}\n');
      assert.equal((await runChecker(adapterRoot, danglingSkillsRoot, 'review', 'design-spec')).status, 'BLOCKED');

      await writeFile(join(dangerousLegacy, '.artifact-review.json'), '{"workflows":{"review":{"design-spec":{"checklists":[],"constructor":{"polluted":true}}}}}\n');
      assert.equal((await runChecker(adapterRoot, dangerousLegacy, 'review', 'design-spec')).status, 'BLOCKED');

      await mkdir(join(emptyRelease, 'artifact-profiles'), { recursive: true });
      await mkdir(join(emptyRelease, 'artifacts'), { recursive: true });
      await writeFile(join(emptyRelease, 'artifact-graph.config.yaml'), 'artifactTypes: {}\n');
      await writeFile(join(emptyRelease, 'artifact-profiles/project.yaml'), `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  audit:
    release-gate: {}
`);
      assert.equal((await runChecker(adapterRoot, emptyRelease, 'audit', 'release-gate')).status, 'NEEDS_INPUT');
    } finally {
      await Promise.all([danglingProfile, danglingWorker, danglingResource, prototypeProfile, externalEmptyRoot, danglingSkillsRoot, dangerousLegacy, emptyRelease]
        .map((path) => rm(path, { recursive: true, force: true })));
    }
  });

  test(`${host}: check-workflow-profile reports OK for project with project worker`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const projectRoot = await mkdtemp(join(tmpdir(), `profile-ok-${host}-`));
    try {
      await mkdir(join(projectRoot, 'artifacts/design'), { recursive: true });
      await mkdir(join(projectRoot, 'artifacts/checklists'), { recursive: true });
      await writeFile(join(projectRoot, 'artifacts/checklists/design-review.md'), '# Review');
      await writeFile(
        join(projectRoot, 'artifact-graph.config.yaml'),
        'artifactTypes: {}\n',
      );
      await mkdir(join(projectRoot, '.claude/skills/project-review-design'), { recursive: true });
      await writeFile(
        join(projectRoot, '.claude/skills/project-review-design/SKILL.md'),
        '---\nname: project-review-design\n---\n',
      );
      await mkdir(join(projectRoot, 'artifact-profiles'), { recursive: true });
      await writeFile(
        join(projectRoot, 'artifact-profiles/project.yaml'),
        'schema_version: 1\nproject:\n  id: test-proj\n  language: typescript\nworkflows:\n  review:\n    design-spec:\n      checklists:\n        - artifacts/checklists/design-review.md\n      worker:\n        skill: project-review-design\n',
      );

      const { stdout } = await execFileAsync(NODE, [
        'scripts/check-workflow-profile.mjs',
        '--root', projectRoot,
        '--action', 'review',
        '--domain', 'design-spec',
        '--format', 'json',
      ], { cwd: adapterRoot });

      const result = JSON.parse(stdout);
      assert.equal(result.status, 'OK');
      assert.equal(result.execution_mode, 'project-worker');
      assert.ok(result.worker_path);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  test(`${host}: check-workflow-profile reports NEEDS_INPUT when worker missing`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const projectRoot = await mkdtemp(join(tmpdir(), `profile-needs-${host}-`));
    try {
      await mkdir(join(projectRoot, 'artifacts/design'), { recursive: true });
      await writeFile(
        join(projectRoot, 'artifact-graph.config.yaml'),
        'artifactTypes: {}\n',
      );

      try {
        await execFileAsync(NODE, [
          'scripts/check-workflow-profile.mjs',
          '--root', projectRoot,
          '--action', 'review',
          '--domain', 'design-spec',
          '--format', 'json',
        ], { cwd: adapterRoot });
        assert.fail('Should exit non-zero for NEEDS_INPUT');
      } catch (error) {
        assert.notEqual(error.code, 0);
        const result = JSON.parse(error.stdout);
        assert.equal(result.status, 'NEEDS_INPUT');
      }
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  test(`${host}: adapter public worker executes a zero validator from the project`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const projectRoot = await mkdtemp(join(tmpdir(), `profile-validator-ok-${host}-`));
    try {
      await mkdir(join(projectRoot, 'artifacts/checklists'), { recursive: true });
      await mkdir(join(projectRoot, 'artifact-profiles'), { recursive: true });
      await mkdir(join(projectRoot, 'scripts'), { recursive: true });
      await writeFile(join(projectRoot, 'artifact-graph.config.yaml'), 'artifactTypes: {}\n');
      await writeFile(join(projectRoot, 'artifacts/checklists/review.md'), '# Review\n');
      await writeFile(join(projectRoot, 'scripts/validate.mjs'), `process.stdout.write(process.env.ARTIFACT_WORKFLOW_DOMAIN ?? '')`);
      await writeFile(join(projectRoot, 'artifact-profiles/project.yaml'), `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/review.md
      validators:
        - scripts/validate.mjs
`);
      const { stdout } = await execFileAsync(NODE, [
        'scripts/check-workflow-profile.mjs', '--root', projectRoot,
        '--action', 'review', '--domain', 'design-spec', '--format', 'json',
      ], { cwd: adapterRoot });
      const result = JSON.parse(stdout);
      assert.equal(result.status, 'OK');
      assert.equal(result.worker_path, join(adapterRoot, 'skills/artifact-workflow-worker/SKILL.md'));
      assert.equal(result.validators[0].exit_code, 0);
      assert.equal(result.validators[0].stdout, 'design-spec');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  test(`${host}: adapter blocks a non-zero validator and returns execution evidence`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const projectRoot = await mkdtemp(join(tmpdir(), `profile-validator-fail-${host}-`));
    try {
      await mkdir(join(projectRoot, 'artifacts/checklists'), { recursive: true });
      await mkdir(join(projectRoot, 'artifact-profiles'), { recursive: true });
      await mkdir(join(projectRoot, 'scripts'), { recursive: true });
      await writeFile(join(projectRoot, 'artifact-graph.config.yaml'), 'artifactTypes: {}\n');
      await writeFile(join(projectRoot, 'artifacts/checklists/review.md'), '# Review\n');
      await writeFile(join(projectRoot, 'scripts/fail.cjs'), `process.stderr.write('untrusted'); process.exit(6)`);
      await writeFile(join(projectRoot, 'artifact-profiles/project.yaml'), `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/review.md
      validators:
        - scripts/fail.cjs
`);
      await assert.rejects(execFileAsync(NODE, [
        'scripts/check-workflow-profile.mjs', '--root', projectRoot,
        '--action', 'review', '--domain', 'design-spec', '--format', 'json',
      ], { cwd: adapterRoot }), error => {
        const result = JSON.parse(error.stdout);
        assert.equal(result.status, 'BLOCKED');
        assert.equal(result.validators[0].exit_code, 6);
        assert.equal(result.validators[0].stderr, 'untrusted');
        return true;
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  test(`${host}: adapter returns NEEDS_INPUT for validator exit 2 instead of BLOCKED`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const projectRoot = await mkdtemp(join(tmpdir(), `profile-validator-needs-${host}-`));
    try {
      await mkdir(join(projectRoot, 'artifacts/checklists'), { recursive: true });
      await mkdir(join(projectRoot, 'artifact-profiles'), { recursive: true });
      await mkdir(join(projectRoot, 'scripts'), { recursive: true });
      await writeFile(join(projectRoot, 'artifact-graph.config.yaml'), 'artifactTypes: {}\n');
      await writeFile(join(projectRoot, 'artifacts/checklists/review.md'), '# Review\n');
      await writeFile(join(projectRoot, 'scripts/needs-input.cjs'), 'process.exit(2)');
      await writeFile(join(projectRoot, 'artifact-profiles/project.yaml'), `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/review.md
      validators:
        - scripts/needs-input.cjs
`);
      await assert.rejects(execFileAsync(NODE, [
        'scripts/check-workflow-profile.mjs', '--root', projectRoot,
        '--action', 'review', '--domain', 'design-spec', '--format', 'json',
      ], { cwd: adapterRoot }), error => {
        const result = JSON.parse(error.stdout);
        assert.equal(result.status, 'NEEDS_INPUT');
        assert.equal(result.validators[0].exit_code, 2);
        return true;
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  installedRunnerTest(`${host}: installed runner needs semantic review, rejects provenance tampering, and preserves target on validator failure`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const projectRoot = await mkdtemp(join(tmpdir(), `installed-runner-${host}-`));
    try {
      await mkdir(join(projectRoot, 'artifacts/checklists'), { recursive: true });
      await mkdir(join(projectRoot, 'artifact-profiles'), { recursive: true });
      await mkdir(join(projectRoot, 'scripts'), { recursive: true });
      await mkdir(join(projectRoot, 'runs'), { recursive: true });
      await mkdir(join(projectRoot, 'node_modules/.bin'), { recursive: true });
      await symlink(PARENT_ARTIFACT_GRAPH_CLI, join(projectRoot, 'node_modules/.bin/artifact-graph'));
      await writeFile(join(projectRoot, 'artifact-graph.config.yaml'), 'artifactTypes: {}\n');
      await writeFile(join(projectRoot, 'artifacts/checklists/review.md'), '# Review\n');
      await writeFile(join(projectRoot, 'template.md'), '# Candidate\n');
      await writeFile(join(projectRoot, 'target.md'), 'original bytes\n');
      await writeFile(join(projectRoot, 'scripts/validate.mjs'), 'process.exit(Number(process.env.VALIDATOR_EXIT ?? 0));\n');
      const profilePath = join(projectRoot, 'artifact-profiles/project.yaml');
      await writeFile(profilePath, `schema_version: 1
project:
  id: installed-test
  language: markdown
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/review.md
      validators:
        - scripts/validate.mjs
  generate:
    design-spec:
      templates:
        - template.md
      validators:
        - scripts/validate.mjs
`);
      const validatorPath = join(projectRoot, 'scripts/validate.mjs');
      const baseProfile = {
        status: 'OK', profile_path: profilePath, execution_mode: 'public-worker',
        worker_path: join(adapterRoot, 'skills/artifact-workflow-worker/SKILL.md'),
        checklist_paths: [join(projectRoot, 'artifacts/checklists/review.md')],
        validators: [{ path: validatorPath }], template_paths: [], diagnostics: [],
      };
      const run = async (name, task, env = {}) => {
        const path = join(projectRoot, `${name}.json`);
        await writeFile(path, `${JSON.stringify(task)}\n`);
        const { stdout } = await execFileAsync(NODE, ['scripts/run-artifact-workflow.mjs', '--task', path], {
          cwd: adapterRoot, env: { ...process.env, ...env },
        });
        return JSON.parse(stdout);
      };
      const reviewTask = {
        intent: 'review', domain: 'design-spec', target_path: join(projectRoot, 'target.md'),
        run_dir: join(projectRoot, 'runs/review'), profile_resolution: baseProfile, input_result: null,
      };
      const needsInput = await run('review-task', reviewTask);
      assert.equal(needsInput.status, 'NEEDS_INPUT');
      assert.equal(needsInput.decision, 'NEEDS_INPUT');

      const forged = structuredClone(reviewTask);
      forged.run_dir = join(projectRoot, 'runs/forged');
      forged.profile_resolution.worker_path = join(projectRoot, 'claimed-worker.md');
      const rejected = await run('forged-task', forged);
      assert.equal(rejected.status, 'BLOCKED');

      const generateTask = {
        intent: 'generate', domain: 'design-spec', target_path: join(projectRoot, 'target.md'),
        run_dir: join(projectRoot, 'runs/generate'),
        profile_resolution: { ...baseProfile, checklist_paths: [], template_paths: [join(projectRoot, 'template.md')] },
        input_result: null,
      };
      const blocked = await run('generate-task', generateTask, { VALIDATOR_EXIT: '9' });
      assert.equal(blocked.status, 'BLOCKED');
      assert.equal(await readFile(join(projectRoot, 'target.md'), 'utf8'), 'original bytes\n');
      assert.equal(JSON.parse(await readFile(join(projectRoot, 'runs/generate/result.json'), 'utf8')).status, 'BLOCKED');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
}

// ── batch-split.mjs from adapter root ────────────────────────────────

for (const host of HOSTS) {
  test(`${host}: batch-split splits files from adapter root`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const targetDir = await mkdtemp(join(tmpdir(), `split-${host}-`));
    try {
      await writeFile(join(targetDir, 'a.md'), 'File A content');
      await writeFile(join(targetDir, 'b.md'), 'File B content');

      const { stdout } = await execFileAsync(NODE, [
        'scripts/batch-split.mjs',
        targetDir,
      ], { cwd: adapterRoot });

      const batches = JSON.parse(stdout);
      assert.ok(Array.isArray(batches));
      assert.ok(batches.length >= 1);
      assert.equal(batches[0].id, 'batch-001');
      assert.ok(batches[0].files.includes('a.md'));
      assert.ok(batches[0].files.includes('b.md'));
    } finally {
      await rm(targetDir, { recursive: true, force: true });
    }
  });
}

// ── batch-merge.mjs from adapter root ────────────────────────────────

for (const host of HOSTS) {
  test(`${host}: batch-merge merges results from adapter root`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const resultsDir = await mkdtemp(join(tmpdir(), `merge-${host}-`));
    try {
      const makeResult = (stageId) => JSON.stringify({
        schema_version: '1.0',
        run_id: 'test-run',
        status: 'SUCCEEDED',
        decision: 'PASS',
        summary: `Batch ${stageId}`,
        stage_id: stageId,
        review: {
          metrics: { files_scanned: 3, findings_count: 0, batch_count: 1 },
          findings: [],
        },
      });

      await writeFile(join(resultsDir, 'batch-001.json'), makeResult('batch-001'));
      await writeFile(join(resultsDir, 'batch-002.json'), makeResult('batch-002'));

      const { stdout } = await execFileAsync(NODE, [
        'scripts/batch-merge.mjs',
        resultsDir,
      ], { cwd: adapterRoot });

      const merged = JSON.parse(stdout);
      assert.equal(merged.schema_version, '1.0');
      assert.equal(merged.run_id, 'test-run');
      assert.equal(merged.status, 'SUCCEEDED');
      assert.equal(merged.decision, 'PASS');
      assert.equal(merged.review.metrics.files_scanned, 6);
      assert.equal(merged.review.metrics.batch_count, 2);
    } finally {
      await rm(resultsDir, { recursive: true, force: true });
    }
  });
}

// ── build-runtime-bundles --check catches missing managed scripts ────

test('runtime bundle check detects missing managed script after build', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'bundle-check-scripts-'));
  const tempPlugin = join(tempRoot, 'artifact-chain-assistant');
  await cp(PLUGIN_ROOT, tempPlugin, { recursive: true });

  // Build first so all managed scripts are synced to adapters
  await execFileAsync(NODE, ['scripts/build-runtime-bundles.mjs'], { cwd: tempPlugin });

  // Now remove a managed script from one adapter
  await rm(join(tempPlugin, 'adapters/codex/scripts/batch-split.mjs'));

  try {
    await assert.rejects(
      execFileAsync(NODE, ['scripts/build-runtime-bundles.mjs', '--check'], { cwd: tempPlugin }),
      (error) => {
        assert.match(error.stderr, /Runtime bundle drift: adapters\/codex\/scripts\/batch-split\.mjs/);
        return true;
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runtime bundle check detects content drift in managed script after build', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'bundle-drift-scripts-'));
  const tempPlugin = join(tempRoot, 'artifact-chain-assistant');
  await cp(PLUGIN_ROOT, tempPlugin, { recursive: true });

  // Build first so all managed scripts are synced to adapters
  await execFileAsync(NODE, ['scripts/build-runtime-bundles.mjs'], { cwd: tempPlugin });

  // Verify check passes after a clean build
  await execFileAsync(NODE, ['scripts/build-runtime-bundles.mjs', '--check'], { cwd: tempPlugin });

  // Tamper with a managed script's content in one adapter
  await writeFile(
    join(tempPlugin, 'adapters/claude/scripts/check-workflow-profile.mjs'),
    '// tampered\n',
  );

  try {
    await assert.rejects(
      execFileAsync(NODE, ['scripts/build-runtime-bundles.mjs', '--check'], { cwd: tempPlugin }),
      (error) => {
        assert.match(error.stderr, /Runtime bundle drift: adapters\/claude\/scripts\/check-workflow-profile\.mjs/);
        return true;
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// ── batch skill path regression guards ────────────────────────────────
// The authoritative skills-src/artifact-batch/SKILL.md and its generated
// adapter copies must NOT contain bare `node scripts/...` CLI examples or
// relative `./scripts/...` import guides. Users invoke skills from the
// target project cwd, so scripts must be referenced via the resolved
// <plugin-root>/scripts/... path.



/**
 * Require that the deterministic script section:
 * 1. Lists all three managed scripts (check-workflow-profile, batch-split, batch-merge)
 * 2. Returns NEEDS_INPUT when scripts are missing
 */
function assertDeterministicScriptSection(content, label) {
  const hasProfile = /check-workflow-profile\.mjs/.test(content);
  const hasSplit = /batch-split\.mjs/.test(content);
  const hasMerge = /batch-merge\.mjs/.test(content);
  assert.ok(
    hasProfile && hasSplit && hasMerge,
    `${label} must list all three managed scripts (check-workflow-profile, batch-split, batch-merge); ` +
    `found: profile=${hasProfile}, split=${hasSplit}, merge=${hasMerge}`,
  );
  assert.ok(
    /NEEDS_INPUT/i.test(content),
    `${label} must mention NEEDS_INPUT status for missing scripts`,
  );
}

/**
 * Forbid `import.meta.dirname` — unreliable for deriving installed plugin root
 * from target projects.
 */
function assertNoImportMetaDirname(content, label) {
  assert.ok(
    !content.includes('import.meta.dirname'),
    `${label} must not contain import.meta.dirname; resolve PLUGIN_ROOT via installed adapter's INSTALL.md host discovery instead`,
  );
}

/**
 * Forbid `import.meta.url` in SKILL.md — agent workflow docs should not
 * teach URL-based root derivation.
 */
function assertNoImportMetaUrl(content, label) {
  assert.ok(
    !content.includes('import.meta.url'),
    `${label} must not contain import.meta.url; resolve PLUGIN_ROOT via installed adapter's INSTALL.md host discovery instead`,
  );
}

/**
 * Forbid dynamic import tutorials using `pathToFileURL` in SKILL.md.
 * Agent workflows consume batch scripts via CLI, not dynamic import.
 */
function assertNoPathToFileURL(content, label) {
  assert.ok(
    !content.includes('pathToFileURL'),
    `${label} must not contain pathToFileURL dynamic import tutorials; use CLI invocation instead`,
  );
}

/**
 * Reject bare `node scripts/...` CLI patterns that resolve from cwd
 * instead of the resolved plugin root.
 */
function assertNoBareScriptPaths(content, label) {
  // Match `node scripts/batch-split.mjs` or `node scripts/batch-merge.mjs`
  // but NOT `node <plugin-root>/scripts/...` or `node "$PLUGIN_ROOT/scripts/..."`
  const bareCli = /node\s+scripts\/batch-(?:split|merge)\.mjs/g;
  const matches = content.match(bareCli);
  assert.ok(
    !matches,
    `${label} must not contain bare 'node scripts/batch-*.mjs' CLI examples; ` +
    `use '<plugin-root>/scripts/batch-*.mjs' or '$PLUGIN_ROOT/scripts/batch-*.mjs' instead` +
    (matches ? ` (found: ${matches.join(', ')})` : ''),
  );
}

/**
 * Reject relative import guides like `from './scripts/batch-*.mjs'` that
 * assume the consumer is co-located with the plugin scripts.
 */
function assertNoRelativeScriptImports(content, label) {
  // Match import ... from './scripts/batch-*' or from "../scripts/batch-*
  const relImport = /from\s+['"]\.\/scripts\/batch-(?:split|merge)\.mjs['"]/g;
  const matches = content.match(relImport);
  assert.ok(
    !matches,
    `${label} must not contain relative import guides like './scripts/batch-*.mjs'; ` +
    `use the documented $PLUGIN_ROOT CLI invocation instead` +
    (matches ? ` (found: ${matches.join(', ')})` : ''),
  );
}

test('authoritative artifact-batch SKILL.md must not use bare scripts/ CLI paths', async () => {
  const skillPath = join(PLUGIN_ROOT, 'skills-src', 'artifact-batch', 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  assertNoBareScriptPaths(content, 'skills-src/artifact-batch/SKILL.md');
});

test('authoritative artifact-batch SKILL.md must not use relative ./scripts/ imports', async () => {
  const skillPath = join(PLUGIN_ROOT, 'skills-src', 'artifact-batch', 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  assertNoRelativeScriptImports(content, 'skills-src/artifact-batch/SKILL.md');
});

for (const host of HOSTS) {
  test(`${host} adapter artifact-batch SKILL.md must not use bare scripts/ CLI paths`, async () => {
    const skillPath = join(PLUGIN_ROOT, 'adapters', host, 'skills', 'artifact-batch', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assertNoBareScriptPaths(content, `adapters/${host}/skills/artifact-batch/SKILL.md`);
  });

  test(`${host} adapter artifact-batch SKILL.md must not use relative ./scripts/ imports`, async () => {
    const skillPath = join(PLUGIN_ROOT, 'adapters', host, 'skills', 'artifact-batch', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assertNoRelativeScriptImports(content, `adapters/${host}/skills/artifact-batch/SKILL.md`);
  });
}

// ── deterministic-script-section guard ────────────────────────────────
// The SKILL.md must list all three managed scripts and mention NEEDS_INPUT
// for missing scripts.

test('authoritative artifact-batch SKILL.md must have deterministic script section', async () => {
  const skillPath = join(PLUGIN_ROOT, 'skills-src', 'artifact-batch', 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  assertDeterministicScriptSection(content, 'skills-src/artifact-batch/SKILL.md');
});

for (const host of HOSTS) {
  test(`${host} adapter artifact-batch SKILL.md must have deterministic script section`, async () => {
    const skillPath = join(PLUGIN_ROOT, 'adapters', host, 'skills', 'artifact-batch', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assertDeterministicScriptSection(content, `adapters/${host}/skills/artifact-batch/SKILL.md`);
  });
}

// ── YAGNI: forbid import.meta.dirname, import.meta.url, pathToFileURL ──
// The SKILL.md teaches CLI-only consumption of batch scripts. Dynamic import
// tutorials and import.meta.* root derivation are unreliable from target
// projects and outside the agent workflow contract.

test('authoritative artifact-batch SKILL.md must not contain import.meta.dirname', async () => {
  const skillPath = join(PLUGIN_ROOT, 'skills-src', 'artifact-batch', 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  assertNoImportMetaDirname(content, 'skills-src/artifact-batch/SKILL.md');
});

test('authoritative artifact-batch SKILL.md must not contain import.meta.url', async () => {
  const skillPath = join(PLUGIN_ROOT, 'skills-src', 'artifact-batch', 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  assertNoImportMetaUrl(content, 'skills-src/artifact-batch/SKILL.md');
});

test('authoritative artifact-batch SKILL.md must not contain pathToFileURL dynamic import', async () => {
  const skillPath = join(PLUGIN_ROOT, 'skills-src', 'artifact-batch', 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  assertNoPathToFileURL(content, 'skills-src/artifact-batch/SKILL.md');
});

for (const host of HOSTS) {
  test(`${host} adapter artifact-batch SKILL.md must not contain import.meta.dirname`, async () => {
    const skillPath = join(PLUGIN_ROOT, 'adapters', host, 'skills', 'artifact-batch', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assertNoImportMetaDirname(content, `adapters/${host}/skills/artifact-batch/SKILL.md`);
  });

  test(`${host} adapter artifact-batch SKILL.md must not contain import.meta.url`, async () => {
    const skillPath = join(PLUGIN_ROOT, 'adapters', host, 'skills', 'artifact-batch', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assertNoImportMetaUrl(content, `adapters/${host}/skills/artifact-batch/SKILL.md`);
  });

  test(`${host} adapter artifact-batch SKILL.md must not contain pathToFileURL dynamic import`, async () => {
    const skillPath = join(PLUGIN_ROOT, 'adapters', host, 'skills', 'artifact-batch', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assertNoPathToFileURL(content, `adapters/${host}/skills/artifact-batch/SKILL.md`);
  });
}
