#!/usr/bin/env node
// @feature ACA1
// @feature ACA29 @scenario S-159 @scenario S-160 @scenario S-161
import { parseArgs } from 'node:util';
import {
  DEFAULT_STUDIO_PORT,
  buildWorkbenchSnapshot,
  delegateToSkillFamilyStudio,
} from './lib/artifact-workbench.mjs';

const USAGE = [
  '用法：',
  '  artifact-workbench.mjs snapshot --root <仓库目录> [--scan-roots <目录1,目录2>] [--repo <仓库标识>] [--json]',
  '  artifact-workbench.mjs serve --root <仓库目录> [--scan-roots <目录1,目录2>] [--port <端口>] [--tab <视图>] [--writable|--readonly]',
  '  artifact-workbench.mjs open --root <仓库目录> [--scan-roots <目录1,目录2>] [--port <端口>] [--tab <视图>] [--writable|--readonly]',
  '',
  '说明：',
  '  snapshot  以只读无头方式解析指定仓库的制品图节点、追溯边、版本锁新鲜度与审阅状态，输出标准化 JSON 快照。',
  '  serve     自动探测并委托统一控制台 skill-family-studio 启动本地可视化视图（默认只读附带 --readonly，传 --writable 开启审阅落盘）。',
  '  open      委托 skill-family-studio ensure 幂等启动控制台并定位制品图视图；未安装控制台时返回中文指引与退出码 2。',
].join('\n');

try {
  const { values, positionals } = parseArgs({
    options: {
      root: { type: 'string' },
      'scan-roots': { type: 'string' },
      repo: { type: 'string' },
      port: { type: 'string' },
      tab: { type: 'string' },
      writable: { type: 'boolean' },
      readonly: { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    console.log(USAGE);
  } else {
    const command = positionals.length === 0 && values.json ? 'snapshot' : positionals[0];
    if (positionals.length > 1 || !['snapshot', 'serve', 'open', 'ensure'].includes(command)) {
      throw new Error('请指定子命令 snapshot、serve 或 open（或传入 --json 导出快照）；运行 --help 查看参数说明。');
    }
    if (!values.root) {
      throw new Error('必须提供 --root <仓库目录>（目标目录需包含 artifact-graph.config.yaml）。');
    }

    if (command === 'snapshot') {
      if (values.port !== undefined || values.writable || values.readonly || values.tab !== undefined) {
        throw new Error('--port、--tab、--writable 与 --readonly 仅适用于 serve 或 open 委托启动模式。');
      }
      const snapshot = await buildWorkbenchSnapshot({
        root: values.root,
        scanRoots: values['scan-roots'],
        repoId: values.repo,
      });
      console.log(JSON.stringify({ ok: true, command: 'snapshot', ...snapshot }, null, 2));
    } else {
      if (values.writable && values.readonly) {
        throw new Error('--writable 与 --readonly 不能同时指定。');
      }
      const port = values.port === undefined ? DEFAULT_STUDIO_PORT : Number(values.port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('--port 必须为 0 至 65535 之间的整数（默认 57630）。');
      }
      const result = await delegateToSkillFamilyStudio({
        mode: command,
        root: values.root,
        scanRoots: values['scan-roots'],
        port,
        tab: values.tab ?? 'graph',
        writable: Boolean(values.writable) && !values.readonly,
        stdio: 'inherit',
      });
      if (!result.ok) {
        if (!result.delegated) {
          console.error(JSON.stringify(result, null, 2));
        }
        process.exitCode = result.exitCode || 2;
      }
    }
  }
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    code: error.code ?? 'WORKBENCH_CLI_ERROR',
    error: error.message,
    ...(error.details ? { details: error.details } : {}),
  }, null, 2));
  process.exitCode = error.exitCode ?? 1;
}
