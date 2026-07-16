#!/usr/bin/env node
// @scenario S-44 @feature ACA13 @feature ACA3
// @decision D-ACA-15
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execPath } from 'node:process';
import test from 'node:test';

// Minimal PATH that still allows `execFileSync('node', ...)` to find node itself
const NODE_DIR = dirname(execPath);
const CLEAN_PATH = NODE_DIR;

const PLUGIN_ROOT = join(import.meta.dirname, '..');
const DOCTOR_SCRIPT = join(PLUGIN_ROOT, 'scripts', 'doctor.mjs');
const RUNTIME_MODULE = join(PLUGIN_ROOT, 'scripts', 'lib', 'artifact-graph-runtime.mjs');

async function createFakeProject({ version = '0.4.1', withBin = true, pkgName = 'artifact-graph' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'doctor-test-'));
  const nmDir = join(dir, 'node_modules', pkgName);
  const binDir = join(dir, 'node_modules', '.bin');
  await mkdir(nmDir, { recursive: true });
  await mkdir(binDir, { recursive: true });

  const binCliDir = join(nmDir, 'bin');
  await mkdir(binCliDir, { recursive: true });

  await writeFile(join(nmDir, 'package.json'), JSON.stringify({
    name: pkgName,
    version,
    bin: { 'artifact-graph': './bin/cli.mjs' },
  }) + '\n');

  // Fake CLI that echoes version or runs doctor
  const cliContent = `#!/usr/bin/env node
const arg = process.argv[2];
if (arg === '--version') {
  process.stdout.write('${version}\\n');
  process.exit(0);
}
if (arg === 'doctor') {
  // Simulate doctor behavior: pass through exit code from --test-exit
  const exitIdx = process.argv.indexOf('--test-exit');
  if (exitIdx !== -1) {
    process.exitCode = Number(process.argv[exitIdx + 1]) || 0;
  }
  process.stdout.write(JSON.stringify({ ok: true, args: process.argv.slice(3) }));
  process.exit(0);
}
`;
  await writeFile(join(nmDir, 'bin', 'cli.mjs'), cliContent);
  await chmod(join(nmDir, 'bin', 'cli.mjs'), 0o755);

  if (withBin) {
    // Create .bin symlink
    await writeFile(join(binDir, 'artifact-graph'), cliContent);
    await chmod(join(binDir, 'artifact-graph'), 0o755);
  }

  return dir;
}

// --- inspectArtifactGraphRuntime tests ---

test('inspectArtifactGraphRuntime resolves correct version from project node_modules', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await createFakeProject({ version: '0.4.1' });
  try {
    const result = await inspectArtifactGraphRuntime({ projectRoot });
    assert.equal(result.ok, true);
    assert.equal(result.actualVersion, '0.4.1');
    assert.equal(result.expectedVersion, '0.4.1');
    assert.equal(result.reason, undefined);
    assert.ok(result.cliPath.includes('artifact-graph'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('inspectArtifactGraphRuntime detects version mismatch', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await createFakeProject({ version: '0.3.0' });
  try {
    const result = await inspectArtifactGraphRuntime({ projectRoot });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'version_mismatch');
    assert.equal(result.actualVersion, '0.3.0');
    assert.equal(result.expectedVersion, '0.4.1');
    assert.match(result.remediation, /pnpm add -D artifact-graph@0\.4\.1/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('inspectArtifactGraphRuntime detects missing CLI', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await mkdtemp(join(tmpdir(), 'doctor-missing-'));
  try {
    await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
    // Use clean PATH so we don't pick up real artifact-graph from workspace
    const result = await inspectArtifactGraphRuntime({ projectRoot, env: { PATH: CLEAN_PATH } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'cli_not_found');
    assert.match(result.remediation, /pnpm add -D artifact-graph@0\.4\.1/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('inspectArtifactGraphRuntime detects unresolvable version (wrong package name)', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await createFakeProject({ version: '0.4.1', pkgName: 'wrong-package' });
  try {
    // .bin/artifact-graph exists (as wrong-package binary), but its package.json
    // name is not "artifact-graph" → version_unresolved
    const result = await inspectArtifactGraphRuntime({ projectRoot, env: { PATH: CLEAN_PATH } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'version_unresolved');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

// --- doctor.mjs integration tests ---

test('doctor.mjs passes with correct version', async () => {
  const projectRoot = await createFakeProject({ version: '0.4.1' });
  try {
    const out = execFileSync('node', [DOCTOR_SCRIPT, '--root', projectRoot, '--format', 'json'], {
      encoding: 'utf8',
      cwd: PLUGIN_ROOT,
    });
    assert.ok(out.includes('"ok"'));
  } catch (error) {
    // Should not fail with correct version
    assert.fail(`doctor should pass with correct version: ${error.stderr || error.message}`);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('doctor.mjs fails with wrong version', async () => {
  const projectRoot = await createFakeProject({ version: '0.3.0' });
  try {
    execFileSync('node', [DOCTOR_SCRIPT, '--root', projectRoot, '--format', 'json'], {
      encoding: 'utf8',
      cwd: PLUGIN_ROOT,
    });
    assert.fail('doctor should fail with wrong version');
  } catch (error) {
    assert.notEqual(error.status, 0);
    assert.ok(error.stderr.includes('version_mismatch') || error.stderr.includes('0.3.0'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('doctor.mjs fails when CLI not found', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'doctor-nocli-'));
  try {
    await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
    // Use clean PATH for isolation
    execFileSync('node', [DOCTOR_SCRIPT, '--root', projectRoot, '--format', 'json'], {
      encoding: 'utf8',
      cwd: PLUGIN_ROOT,
      env: { ...process.env, PATH: CLEAN_PATH },
    });
    assert.fail('doctor should fail when CLI not found');
  } catch (error) {
    assert.notEqual(error.status, 0);
    const stderr = String(error.stderr || '');
    assert.ok(stderr.includes('cli_not_found') || stderr.includes('not found'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('doctor.mjs forwards arguments to underlying doctor on correct version', async () => {
  const projectRoot = await createFakeProject({ version: '0.4.1' });
  try {
    const out = execFileSync('node', [DOCTOR_SCRIPT, '--root', projectRoot, '--format', 'json'], {
      encoding: 'utf8',
      cwd: PLUGIN_ROOT,
    });
    // The fake CLI echoes the args it received
    assert.ok(out.includes('--format'));
    assert.ok(out.includes('json'));
  } catch (error) {
    assert.fail(`doctor should forward args: ${error.stderr || error.message}`);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('doctor.mjs preserves underlying doctor exit code', async () => {
  // Create a fake project where the CLI returns exit code 7 on doctor
  const projectRoot = await createFakeProject({ version: '0.4.1' });
  try {
    // Overwrite the CLI to exit with code 7
    const nmDir = join(projectRoot, 'node_modules', 'artifact-graph', 'bin');
    await writeFile(join(nmDir, 'cli.mjs'), `#!/usr/bin/env node
const arg = process.argv[2];
if (arg === '--version') { process.stdout.write('0.4.1\\n'); process.exit(0); }
process.exit(7);
`);
    await chmod(join(nmDir, 'cli.mjs'), 0o755);

    // Also update .bin
    await writeFile(join(projectRoot, 'node_modules', '.bin', 'artifact-graph'), `#!/usr/bin/env node
const arg = process.argv[2];
if (arg === '--version') { process.stdout.write('0.4.1\\n'); process.exit(0); }
process.exit(7);
`);
    await chmod(join(projectRoot, 'node_modules', '.bin', 'artifact-graph'), 0o755);

    try {
      execFileSync('node', [DOCTOR_SCRIPT, '--root', projectRoot], {
        encoding: 'utf8',
        cwd: PLUGIN_ROOT,
      });
      assert.fail('doctor should fail with exit code 7');
    } catch (error) {
      assert.equal(error.status, 7);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
