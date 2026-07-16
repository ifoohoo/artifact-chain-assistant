// @feature ACA16 @scenario S-49 @scenario S-50
// Adapter resource completeness: verify that check-workflow-profile.mjs,
// batch-split.mjs, and batch-merge.mjs are present and executable from
// each host adapter root (codex, claude).

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access, chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execPath } from 'node:process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PLUGIN_ROOT = resolve(dirname(import.meta.dirname));
const NODE = execPath;

const MANAGED_SCRIPTS = [
  'scripts/check-workflow-profile.mjs',
  'scripts/batch-split.mjs',
  'scripts/batch-merge.mjs',
];

const HOSTS = ['codex', 'claude'];

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
  test(`${host}: check-workflow-profile reports OK for project with conventional worker`, async () => {
    const adapterRoot = join(PLUGIN_ROOT, 'adapters', host);
    const projectRoot = await mkdtemp(join(tmpdir(), `profile-ok-${host}-`));
    try {
      await mkdir(join(projectRoot, 'artifacts/design'), { recursive: true });
      await writeFile(
        join(projectRoot, 'artifact-graph.config.yaml'),
        'artifactTypes: {}\n',
      );
      await mkdir(join(projectRoot, '.claude/skills/artifact-review-design'), { recursive: true });
      await writeFile(
        join(projectRoot, '.claude/skills/artifact-review-design/SKILL.md'),
        '---\nname: artifact-review-design\n---\n',
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
      assert.equal(result.worker, 'artifact-review-design');
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
