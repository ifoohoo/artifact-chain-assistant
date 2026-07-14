#!/usr/bin/env node
// @scenario S-44 @feature ACA13 @feature ACA3
// @decision D-ACA-15
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execPath } from 'node:process';
import test from 'node:test';

const NODE_DIR = dirname(execPath);
const CLEAN_PATH = NODE_DIR;
const RUNTIME_MODULE = join(import.meta.dirname, '..', 'scripts', 'lib', 'artifact-graph-runtime.mjs');

/**
 * Create a fake artifact-graph CLI with a proper package structure
 * so resolvePackageVersion can find version.
 */
async function createFakeCli(dir, { version = '0.3.1', executable = true } = {}) {
  await mkdir(join(dir, 'node_modules', 'artifact-graph', 'bin'), { recursive: true });
  await mkdir(join(dir, 'node_modules', '.bin'), { recursive: true });

  const cliContent = `#!/usr/bin/env node
if (process.argv[2] === '--version') { process.stdout.write('${version}\\n'); process.exit(0); }
`;
  const cliPath = join(dir, 'node_modules', 'artifact-graph', 'bin', 'cli.mjs');
  await writeFile(cliPath, cliContent);
  await chmod(cliPath, executable ? 0o755 : 0o644);

  const binPath = join(dir, 'node_modules', '.bin', 'artifact-graph');
  await writeFile(binPath, cliContent);
  await chmod(binPath, executable ? 0o755 : 0o644);

  await writeFile(
    join(dir, 'node_modules', 'artifact-graph', 'package.json'),
    JSON.stringify({ name: 'artifact-graph', version, bin: { 'artifact-graph': './bin/cli.mjs' } }) + '\n',
  );

  return binPath;
}

/**
 * Create a bare CLI on PATH (no package structure) for PATH lookup testing.
 */
async function createBareCli(dir, { version = '0.3.1', executable = true } = {}) {
  await mkdir(dir, { recursive: true });
  const cliPath = join(dir, 'artifact-graph');
  const content = `#!/usr/bin/env node
if (process.argv[2] === '--version') { process.stdout.write('${version}\\n'); process.exit(0); }
`;
  await writeFile(cliPath, content);
  await chmod(cliPath, executable ? 0o755 : 0o644);
  return cliPath;
}

// --- Resolution order: local .bin → PATH → legacy env ---

test('prefers project-local .bin over PATH', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await mkdtemp(join(tmpdir(), 'rt-local-'));
  const pathDir = await mkdtemp(join(tmpdir(), 'rt-path-'));
  try {
    // Create local .bin with correct version and proper package structure
    await createFakeCli(projectRoot, { version: '0.3.1' });
    // Create a CLI on PATH with wrong version (also needs package structure for version resolution)
    await createFakeCli(pathDir, { version: '0.2.0' });

    const result = await inspectArtifactGraphRuntime({
      projectRoot,
      env: { PATH: `${join(pathDir, 'node_modules', '.bin')}:${CLEAN_PATH}` },
    });
    assert.equal(result.ok, true);
    assert.equal(result.actualVersion, '0.3.1');
    assert.ok(result.cliPath.includes('node_modules'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(pathDir, { recursive: true, force: true });
  }
});

test('prefers PATH over ARTIFACT_GRAPH_LEGACY_CLI', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await mkdtemp(join(tmpdir(), 'rt-path-vs-legacy-'));
  const pathDir = await mkdtemp(join(tmpdir(), 'rt-path-'));
  const legacyDir = await mkdtemp(join(tmpdir(), 'rt-legacy-'));
  try {
    await mkdir(join(projectRoot, 'node_modules'), { recursive: true });

    // PATH has correct version
    await createFakeCli(pathDir, { version: '0.3.1' });
    // Legacy has wrong version
    await createFakeCli(legacyDir, { version: '0.2.0' });
    const legacyCli = join(legacyDir, 'node_modules', '.bin', 'artifact-graph');

    const result = await inspectArtifactGraphRuntime({
      projectRoot,
      env: {
        PATH: `${join(pathDir, 'node_modules', '.bin')}:${CLEAN_PATH}`,
        ARTIFACT_GRAPH_LEGACY_CLI: legacyCli,
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.actualVersion, '0.3.1');
    assert.ok(result.cliPath.includes(pathDir));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(pathDir, { recursive: true, force: true });
    await rm(legacyDir, { recursive: true, force: true });
  }
});

test('falls back to ARTIFACT_GRAPH_LEGACY_CLI when PATH has no match', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await mkdtemp(join(tmpdir(), 'rt-legacy-fb-'));
  const legacyDir = await mkdtemp(join(tmpdir(), 'rt-legacy-'));
  try {
    await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
    await createFakeCli(legacyDir, { version: '0.3.1' });
    const legacyCli = join(legacyDir, 'node_modules', '.bin', 'artifact-graph');

    const result = await inspectArtifactGraphRuntime({
      projectRoot,
      env: {
        PATH: CLEAN_PATH,
        ARTIFACT_GRAPH_LEGACY_CLI: legacyCli,
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.actualVersion, '0.3.1');
    assert.ok(result.cliPath.includes(legacyDir));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(legacyDir, { recursive: true, force: true });
  }
});

// --- Executability check ---

test('rejects non-executable file even if it exists', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await mkdtemp(join(tmpdir(), 'rt-noexec-'));
  const pathDir = await mkdtemp(join(tmpdir(), 'rt-path-'));
  try {
    await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
    // Create a non-executable file on PATH
    await createFakeCli(pathDir, { version: '0.3.1', executable: false });

    const result = await inspectArtifactGraphRuntime({
      projectRoot,
      env: { PATH: `${join(pathDir, 'node_modules', '.bin')}:${CLEAN_PATH}` },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'cli_not_found');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(pathDir, { recursive: true, force: true });
  }
});

test('resolves executable file when it has correct permissions', async () => {
  const { inspectArtifactGraphRuntime } = await import(RUNTIME_MODULE);
  const projectRoot = await mkdtemp(join(tmpdir(), 'rt-exec-'));
  const pathDir = await mkdtemp(join(tmpdir(), 'rt-path-'));
  try {
    await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
    await createFakeCli(pathDir, { version: '0.3.1', executable: true });

    const result = await inspectArtifactGraphRuntime({
      projectRoot,
      env: { PATH: `${join(pathDir, 'node_modules', '.bin')}:${CLEAN_PATH}` },
    });
    assert.equal(result.ok, true);
    assert.equal(result.actualVersion, '0.3.1');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(pathDir, { recursive: true, force: true });
  }
});

// --- PATH delimiter ---

test('uses platform PATH delimiter', async () => {
  const { findOnPath } = await import(RUNTIME_MODULE);
  const pathDir = await mkdtemp(join(tmpdir(), 'rt-delim-'));
  try {
    await createBareCli(pathDir, { version: '0.3.1' });
    const path = await import('node:path');
    const delim = path.delimiter;
    const result = await findOnPath({
      PATH: `${pathDir}${delim}${CLEAN_PATH}`,
    });
    assert.ok(result !== null, 'Should find CLI with platform delimiter');
    assert.ok(result.includes('artifact-graph'));
  } finally {
    await rm(pathDir, { recursive: true, force: true });
  }
});

// --- doctor.mjs preserves error categories and exit codes ---

test('doctor.mjs reports cli_not_found when no CLI available', async () => {
  const { execFileSync } = await import('node:child_process');
  const projectRoot = await mkdtemp(join(tmpdir(), 'rt-doctor-nf-'));
  const PLUGIN_ROOT = join(import.meta.dirname, '..');
  const DOCTOR_SCRIPT = join(PLUGIN_ROOT, 'scripts', 'doctor.mjs');
  try {
    await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
    try {
      execFileSync('node', [DOCTOR_SCRIPT, '--root', projectRoot, '--format', 'json'], {
        encoding: 'utf8',
        cwd: PLUGIN_ROOT,
        env: { ...process.env, PATH: CLEAN_PATH },
      });
      assert.fail('Should fail');
    } catch (error) {
      assert.notEqual(error.status, 0);
      assert.ok(error.stderr.includes('cli_not_found'));
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('doctor.mjs reports version_mismatch with precise remediation', async () => {
  const { execFileSync } = await import('node:child_process');
  const projectRoot = await mkdtemp(join(tmpdir(), 'rt-doctor-vm-'));
  const PLUGIN_ROOT = join(import.meta.dirname, '..');
  const DOCTOR_SCRIPT = join(PLUGIN_ROOT, 'scripts', 'doctor.mjs');
  try {
    // Create fake project with wrong version
    await createFakeCli(projectRoot, { version: '0.3.0' });

    try {
      execFileSync('node', [DOCTOR_SCRIPT, '--root', projectRoot, '--format', 'json'], {
        encoding: 'utf8',
        cwd: PLUGIN_ROOT,
        env: { ...process.env, PATH: `${join(projectRoot, 'node_modules', '.bin')}:${CLEAN_PATH}` },
      });
      assert.fail('Should fail');
    } catch (error) {
      assert.notEqual(error.status, 0);
      assert.ok(error.stderr.includes('version_mismatch'), `Expected version_mismatch in stderr, got: ${error.stderr}`);
      assert.ok(error.stderr.includes('0.3.0'), `Expected 0.3.0 in stderr, got: ${error.stderr}`);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
