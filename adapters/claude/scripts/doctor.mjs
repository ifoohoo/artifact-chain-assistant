#!/usr/bin/env node
// @scenario S-06 @feature ACA3
// @scenario S-44 @feature ACA13
// @decision D-ACA-15
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { inspectArtifactGraphRuntime } from './lib/artifact-graph-runtime.mjs';

// Parse --root from args (same as artifact-graph CLI convention)
const args = process.argv.slice(2);
let projectRoot = process.cwd();
const rootIdx = args.indexOf('--root');
if (rootIdx !== -1 && args[rootIdx + 1]) {
  projectRoot = resolve(args[rootIdx + 1]);
}

const runtime = await inspectArtifactGraphRuntime({ projectRoot });

if (!runtime.ok) {
  const lines = [
    `artifact-chain-assistant: doctor pre-check failed`,
    `  reason: ${runtime.reason}`,
  ];
  if (runtime.cliPath) lines.push(`  cli: ${runtime.cliPath}`);
  if (runtime.packagePath) lines.push(`  package: ${runtime.packagePath}`);
  if (runtime.actualVersion != null) lines.push(`  actual version: ${runtime.actualVersion}`);
  if (runtime.expectedVersion != null) lines.push(`  expected version: ${runtime.expectedVersion}`);
  if (runtime.remediation) lines.push(`  fix: ${runtime.remediation}`);
  process.stderr.write(lines.join('\n') + '\n');
  process.exitCode = 1;
} else {
  // Forward all args to the real artifact-graph doctor
  const result = spawnSync(runtime.cliPath, ['doctor', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (result.error) {
    process.stderr.write(`artifact-chain-assistant: failed to run artifact-graph doctor: ${result.error.message}\n`);
    process.exitCode = 127;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
