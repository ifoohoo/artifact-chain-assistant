#!/usr/bin/env node
// @feature ACA28
// @scenario S-154,S-155,S-156,S-157,S-158
import { parseArgs } from 'node:util';
import { buildReading, checkReading, bundleReading, previewReading } from './lib/artifact-reading.mjs';

try {
  const { values, positionals } = parseArgs({ options: {
    root: { type: 'string' }, config: { type: 'string' }, output: { type: 'string' },
    out: { type: 'string' }, port: { type: 'string' }, help: { type: 'boolean' },
  }, allowPositionals: true, strict: true });
  const command = positionals[0];
  if (values.help) {
    console.log('artifact-reading.mjs <build|check|bundle|preview> --root <root> --config <relative-config> [--output <directory>] [bundle: --out <new-directory>] [preview: --port <port>]');
  } else {
    if (positionals.length !== 1 || !['build', 'check', 'bundle', 'preview'].includes(command) || !values.root || !values.config) throw new Error('需要四命令之一、--root 和 --config；使用 --help 查看参数。');
    if (values.out !== undefined && command !== 'bundle') throw new Error('--out 只用于 bundle 的导出目标。');
    if (values.port !== undefined && command !== 'preview') throw new Error('--port 只用于 preview。');
    if (command === 'bundle' && !values.out) throw new Error('bundle 需要 --out 指定新的导出目录。');
    const options = { root: values.root, config: values.config, output: values.output };
    if (command === 'preview') {
      const port = values.port === undefined ? 0 : Number(values.port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port 必须为 0 至 65535 的整数。');
      const result = await previewReading({ ...options, port });
      console.log(JSON.stringify({ ok: true, command, url: result.url }));
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => result.server.close());
    } else {
      const action = { build: buildReading, check: checkReading, bundle: bundleReading }[command];
      console.log(JSON.stringify({ ok: true, command, ...await action({ ...options, out: values.out }) }));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, ...(error.details ? { details: error.details } : {}) }));
  process.exitCode = 1;
}
