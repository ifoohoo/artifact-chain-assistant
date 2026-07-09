#!/usr/bin/env node
// @scenario S-06 @feature ACA3
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const cli = existsSync(join(process.cwd(), 'node_modules/.bin/artifact-graph'))
  ? join(process.cwd(), 'node_modules/.bin/artifact-graph')
  : 'artifact-graph';
const result = spawnSync(cli, ['doctor', ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write(`artifact-chain-assistant: failed to run artifact-graph doctor: ${result.error.message}\n`);
  process.exitCode = 127;
} else {
  process.exitCode = result.status ?? 1;
}
