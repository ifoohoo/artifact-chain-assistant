#!/usr/bin/env node
// @scenario S-01 @feature ACA1
// @scenario S-05 @feature ACA5
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');

const hosts = [
  {
    id: 'codex',
    hostName: 'Codex',
    agentName: 'Codex',
    hostBehavior: '在 Codex 中，优先在当前线程完成搜索和 intake 结果。用户要求继续且路线清晰时，再调用推荐的后续技能，或基于已加载的 artifact-graph context 继续执行。',
  },
  {
    id: 'claude',
    hostName: 'Claude Code',
    agentName: 'Claude Code、Codex',
    hostBehavior: '在 Claude Code 中，优先产出可交接的 intake 结果。如果允许进入实现且任务要委派执行，生成或建议当前项目支持的 packet-prompt。',
  },
];

const template = await readFile(join(root, 'skills-src/where-am-i/SKILL.md.tpl'), 'utf-8');
const maintainer = await readFile(join(root, 'skills-src/artifact-chain-maintainer/SKILL.md'), 'utf-8');
const bootstrap = await readFile(join(root, 'skills-src/artifact-chain-bootstrap/SKILL.md'), 'utf-8');
const outputs = [];

for (const host of hosts) {
  outputs.push({
    path: join(root, `adapters/${host.id}/skills/where-am-i/SKILL.md`),
    content: render(template, host),
  });
  outputs.push({
    path: join(root, `adapters/${host.id}/skills/artifact-chain-maintainer/SKILL.md`),
    content: maintainer,
  });
  outputs.push({
    path: join(root, `adapters/${host.id}/skills/artifact-chain-bootstrap/SKILL.md`),
    content: bootstrap,
  });
}

let drift = false;
for (const output of outputs) {
  if (check) {
    let current = '';
    try {
      current = await readFile(output.path, 'utf-8');
    } catch {
      current = '';
    }
    if (current !== output.content) {
      drift = true;
      console.error(`Generated skill drift: ${relativeToRoot(output.path)}`);
    }
  } else {
    await mkdir(dirname(output.path), { recursive: true });
    await writeFile(output.path, output.content);
  }
}

if (drift) {
  process.exitCode = 1;
}

function render(source, vars) {
  return `${source.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) {
      throw new Error(`Unknown template variable: ${key}`);
    }
    return vars[key];
  }).trimEnd()}\n`;
}

function relativeToRoot(path) {
  return path.slice(root.length + 1);
}
