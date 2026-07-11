import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import test from 'node:test';

import { readHookEvent } from '../runtime/claude/version-lock-stop.mjs';

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const hookPath = join(pluginRoot, 'runtime/claude/version-lock-stop.mjs');
const claudeSettingsTemplatePath = join(pluginRoot, 'templates', 'claude', 'settings.json.tpl');
const claudeHooksPath = join(pluginRoot, 'adapters', 'claude', 'hooks', 'hooks.json');

async function tempRoot(name) {
  return mkdtemp(join(tmpdir(), `aca-stop-${name}-`));
}

async function configureProject(root) {
  await writeFile(join(root, 'artifact-graph.config.yaml'), 'types: {}\n');
}

async function writeCli(path, source) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `#!/bin/sh\n${source}\n`);
  await chmod(path, 0o755);
}

function runHook({ input = '{}', cwd, env = {} } = {}) {
  return spawnSync(process.execPath, [hookPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    input,
  });
}

test('parses an empty Claude hook stream as an empty event', async () => {
  assert.deepEqual(await readHookEvent(Readable.from([''])), {});
});

test('returns 2 for malformed Claude hook JSON', async () => {
  const root = await tempRoot('malformed');
  const result = runHook({ input: '{not-json', cwd: root });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /invalid Claude hook input/i);
});

test('returns 0 for empty stdin outside an artifact-graph project', async () => {
  const root = await tempRoot('empty');
  const result = runHook({ input: '', cwd: root });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('returns 0 without a project config or version-lock', async () => {
  const root = await tempRoot('no-project');
  const result = runHook({ cwd: root });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('uses CLAUDE_PROJECT_DIR from a nested cwd and audits without git', async () => {
  const root = await tempRoot('project');
  const nested = join(root, 'packages', 'demo');
  const bin = await tempRoot('bin');
  const calls = join(root, 'audit-args.txt');
  await configureProject(root);
  await mkdir(nested, { recursive: true });
  await writeCli(join(bin, 'artifact-graph'), 'printf "%s\\n" "$@" > "$AUDIT_ARGS"\nexit 0');

  const result = runHook({
    cwd: nested,
    env: { AUDIT_ARGS: calls, CLAUDE_PROJECT_DIR: root, PATH: bin },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.deepEqual((await readFile(calls, 'utf8')).trimEnd().split('\n'), [
    'version-lock', 'audit', '--root', root, '--strict-missing-lock',
  ]);
});

test('suppresses successful artifact-graph stdout while preserving stderr diagnostics', async () => {
  const root = await tempRoot('cli-output');
  const bin = await tempRoot('bin');
  await configureProject(root);
  await writeCli(
    join(bin, 'artifact-graph'),
    'printf "audit result\\n"\nprintf "audit diagnostic\\n" >&2\nexit 0',
  );

  const result = runHook({ cwd: root, env: { PATH: bin } });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /audit diagnostic/);
});

test('returns 2 when version-lock audit exits non-zero', async () => {
  const root = await tempRoot('audit-failure');
  const bin = await tempRoot('bin');
  await configureProject(root);
  await writeCli(join(bin, 'artifact-graph'), 'exit 1');

  const result = runHook({ cwd: root, env: { PATH: bin } });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /version-lock audit failed/i);
});

test('returns 2 when no artifact-graph CLI can be run', async () => {
  const root = await tempRoot('no-cli');
  await configureProject(root);

  const result = runHook({ cwd: root, env: { PATH: '' } });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /artifact-graph CLI not found/i);
});

test('does not recurse when stop_hook_active is true', async () => {
  const root = await tempRoot('active');
  const bin = await tempRoot('bin');
  const marker = join(root, 'cli-was-called');
  await configureProject(root);
  await writeCli(join(bin, 'artifact-graph'), ': > "$CLI_MARKER"\nexit 0');

  const result = runHook({
    input: '{"stop_hook_active":true}',
    cwd: root,
    env: { CLI_MARKER: marker, PATH: bin },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  await assert.rejects(access(marker));
});

test('runs a project CLI from a root path containing spaces', async () => {
  const parent = await tempRoot('spaces');
  const root = join(parent, 'project with spaces');
  const calls = join(root, 'audit-args.txt');
  await mkdir(root);
  await configureProject(root);
  await writeCli(
    join(root, 'node_modules', '.bin', 'artifact-graph'),
    'printf "%s\\n" "$@" > "$AUDIT_ARGS"\nexit 0',
  );

  const result = runHook({
    cwd: root,
    env: { AUDIT_ARGS: calls, CLAUDE_PROJECT_DIR: root, PATH: '' },
  });

  assert.equal(result.status, 0);
  assert.deepEqual((await readFile(calls, 'utf8')).trimEnd().split('\n'), [
    'version-lock', 'audit', '--root', root, '--strict-missing-lock',
  ]);
});

test('declares the Claude Stop hook in exec form and passes special plugin roots literally', async () => {
  const expectedHook = {
    type: 'command',
    command: 'node',
    args: ['${CLAUDE_PLUGIN_ROOT}/hooks/version-lock-stop.mjs'],
  };
  const template = JSON.parse(await readFile(claudeSettingsTemplatePath, 'utf8'));
  const generated = JSON.parse(await readFile(claudeHooksPath, 'utf8'));
  const templateHook = template.hooks.Stop[0].hooks[0];
  const generatedHook = generated.hooks.Stop[0].hooks[0];

  assert.deepEqual(templateHook, expectedHook);
  assert.deepEqual(generatedHook, expectedHook);

  const pluginDir = await tempRoot('plugin root; $()');
  const argumentLog = join(pluginDir, 'hook-argument.txt');
  const scriptPath = join(pluginDir, 'hooks', 'version-lock-stop.mjs');
  await mkdir(dirname(scriptPath), { recursive: true });
  await writeFile(
    scriptPath,
    "import { writeFile } from 'node:fs/promises';\nawait writeFile(process.env.HOOK_ARGUMENT_LOG, process.argv[1]);\n",
  );

  const args = generatedHook.args.map((arg) => arg.replace('${CLAUDE_PLUGIN_ROOT}', pluginDir));
  const result = spawnSync(generatedHook.command, args, {
    encoding: 'utf8',
    env: { ...process.env, HOOK_ARGUMENT_LOG: argumentLog },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.equal(await readFile(argumentLog, 'utf8'), scriptPath);
});
