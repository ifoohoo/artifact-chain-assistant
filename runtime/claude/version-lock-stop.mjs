#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function readHookEvent(input) {
  let source = '';
  for await (const chunk of input) {
    source += chunk;
  }
  if (source.trim() === '') return {};

  const event = JSON.parse(source);
  if (event === null || Array.isArray(event) || typeof event !== 'object') {
    throw new Error('Claude hook input must be a JSON object');
  }
  return event;
}

export function buildCliCandidates(root, env) {
  const candidates = [
    { command: join(root, 'node_modules', '.bin', 'artifact-graph'), prefix: [] },
    { command: 'artifact-graph', prefix: [] },
  ];
  const legacyCli = env.ARTIFACT_GRAPH_LEGACY_CLI;
  if (legacyCli) {
    const legacyPath = isAbsolute(legacyCli) ? legacyCli : resolve(root, legacyCli);
    if (existsSync(legacyPath)) {
      candidates.push({ command: process.execPath, prefix: [legacyPath] });
    }
  }
  return candidates;
}

export async function runStopAudit({
  input = process.stdin,
  env = process.env,
  cwd = process.cwd(),
  spawn = spawnSync,
  stderr = (text) => process.stderr.write(text),
} = {}) {
  let event;
  try {
    event = await readHookEvent(input);
  } catch (error) {
    stderr(`artifact-chain-assistant: invalid Claude hook input: ${error.message}\n`);
    return 2;
  }
  if (event.stop_hook_active === true) return 0;

  const root = resolve(env.CLAUDE_PROJECT_DIR || cwd);
  if (!existsSync(join(root, 'artifact-graph.config.yaml')) &&
      !existsSync(join(root, 'artifacts', 'traceability-version-lock.json'))) {
    return 0;
  }

  for (const candidate of buildCliCandidates(root, env)) {
    const result = spawn(candidate.command, [
      ...candidate.prefix,
      'version-lock', 'audit', '--root', root, '--strict-missing-lock',
    ], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
    if (result.error?.code === 'ENOENT') continue;
    if (result.error || result.status !== 0) {
      stderr('artifact-chain-assistant: version-lock audit failed; repair the lock before stopping.\n');
      return 2;
    }
    return 0;
  }

  stderr('artifact-chain-assistant: artifact-graph CLI not found.\n');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runStopAudit();
}
