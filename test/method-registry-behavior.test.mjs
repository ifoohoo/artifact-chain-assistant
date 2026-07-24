// @feature ACA12
// @feature ACA17
// @scenario S-55
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const root = join(import.meta.dirname, '..');
const cliDist = join(root, 'node_modules', 'agent-method-registry', 'dist', 'bin.js');
const cli = existsSync(cliDist) ? cliDist : join(root, 'node_modules/.bin/agent-method-registry');
const catalog = join(root, 'agent-methods/catalog.yaml');
const execFileAsync = promisify(execFile);
const hasRegistryCli = existsSync(cliDist) || existsSync(join(root, 'node_modules/.bin/agent-method-registry'));
const registryTest = hasRegistryCli
  ? test
  : (name, fn) => test.skip(`${name} [requires agent-method-registry CLI]`, fn);

function run(args) {
  return JSON.parse(execFileSync('node', [cli, ...args], { cwd: root, encoding: 'utf8' }));
}

function providerKeys(index) {
  const keys = [];
  for (const entry of index.entries) {
    for (const type of entry.match.artifactTypes ?? []) {
      for (const intent of entry.match.intents ?? []) keys.push(`${type}:${intent}`);
    }
  }
  return keys;
}

registryTest('S-55 catalog and project overlay keep one public provider per type+intent', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'method-registry-s55-'));
  try {
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const catalogText = await readFile(catalog, 'utf8');
    const catalogVersion = catalogText.match(/^\s*version:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1];
    assert.equal(catalogVersion, packageJson.version);

    const validation = run(['validate', '--catalog', catalog]);
    assert.equal(validation.ok, true);
    const indexPath = join(temp, 'index.json');
    assert.equal(run(['index', '--catalog', catalog, '--out', indexPath]).ok, true);
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    assert.equal(index.entries.length, 14);
    assert.equal(index.entries.some(entry => entry.ref.includes('artifact-workflow-worker')
      || entry.provider.skill.includes('artifact-workflow-worker')), false);
    const keys = providerKeys(index);
    assert.equal(new Set(keys).size, keys.length, 'catalog type+intent pairs must be unique');

    const projectPath = join(temp, 'project.yaml');
    await writeFile(projectPath, `schemaVersion: 1
overrides:
  artifact.review:
    provider:
      scope: project
      skill: project-review
`);
    const overlayPath = join(temp, 'overlay-index.json');
    assert.equal(run(['index', '--catalog', catalog, '--project', projectPath, '--out', overlayPath]).ok, true);
    const overlay = JSON.parse(await readFile(overlayPath, 'utf8'));
    assert.equal(overlay.entries.length, 14);
    const reviews = overlay.entries.filter(entry => entry.ref === 'artifact.review');
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].provider.scope, 'project');
    assert.ok(reviews[0].provenance?.overriddenBy);
    const overlayKeys = providerKeys(overlay);
    assert.equal(new Set(overlayKeys).size, overlayKeys.length, 'project overlay must not create a second provider');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

registryTest('two concurrent method-registry checks use isolated temporary state and both exit zero', async () => {
  const script = join(root, 'scripts/check-method-registry.mjs');
  const tempRoot = join(root, '.tmp');
  await rm(join(tempRoot, 'method-registry-test'), { recursive: true, force: true });
  const first = execFileAsync(process.execPath, [script], { cwd: root });
  // The checker intentionally completes its validation/query/resolve phases before
  // writing the project overlay. A release dry-run runs this test alongside other
  // CLI-heavy suites, so allow enough time to reach the concurrency probe without
  // weakening the requirement that both checker instances overlap and succeed.
  const deadline = Date.now() + 60_000;
  let firstProjectFile;
  while (Date.now() < deadline && !firstProjectFile) {
    const entries = await readdir(tempRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('method-registry-test')) continue;
      const candidate = join(tempRoot, entry.name, 'project.yaml');
      try {
        await access(candidate);
        firstProjectFile = candidate;
        break;
      } catch {
        // The first instance has not reached its overlay write yet.
      }
    }
    if (!firstProjectFile) await new Promise(resolveDelay => setTimeout(resolveDelay, 10));
  }
  assert.ok(firstProjectFile, 'first instance never reached the project overlay phase');
  const runs = await Promise.allSettled([
    first,
    execFileAsync(process.execPath, [script], { cwd: root }),
  ]);
  for (const [index, run] of runs.entries()) {
    assert.equal(
      run.status,
      'fulfilled',
      `concurrent instance ${index + 1} failed: ${run.status === 'rejected' ? `${run.reason?.stdout ?? ''}\n${run.reason?.stderr ?? ''}` : ''}`,
    );
    if (run.status === 'fulfilled') assert.match(run.value.stdout, /Method registry check passed/);
  }
});
