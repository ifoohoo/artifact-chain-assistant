import { execFile } from 'node:child_process';
import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);
export const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function tempPlugin(name) {
  const parent = await mkdtemp(join(tmpdir(), `aca-${name}-`));
  const root = join(parent, 'artifact-chain-assistant');
  await cp(pluginRoot, root, { recursive: true });
  return root;
}

export function runNode(root, script, args = []) {
  return execFileAsync(process.execPath, [script, ...args], { cwd: root });
}
