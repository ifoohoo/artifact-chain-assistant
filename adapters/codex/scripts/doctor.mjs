#!/usr/bin/env node
// @scenario S-06 @feature ACA3
// @scenario S-44 @feature ACA13
// @decision D-ACA-15
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { inspectArtifactGraphRuntime } from './lib/artifact-graph-runtime.mjs';

const DOCTOR_HELP_TEXT = `artifact-chain-assistant doctor —— 检查 artifact-graph 运行时安装、版本一致性与工程健康状态

用法：
  node scripts/doctor.mjs [--root <project-dir>] [--format json|markdown] [--help | -h]

选项：
  --root <dir>              指定待检查的目标项目根目录（默认当前目录）
  --format <json|markdown>  透传给 artifact-graph doctor 的输出格式
  --help, -h                显示本帮助说明并退出 0
`;

// Parse --root from args (same as artifact-graph CLI convention)
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(DOCTOR_HELP_TEXT);
  process.exit(0);
}
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
