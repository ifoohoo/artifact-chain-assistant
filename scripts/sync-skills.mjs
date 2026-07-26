#!/usr/bin/env node
// @scenario S-01 @feature ACA1
// @scenario S-05 @feature ACA5
// @feature ACA17
// @scenario S-56
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
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

const sources = await discoverSkillSources(root);
const outputs = [];

for (const host of hosts) {
  for (const source of sources) {
    const content = await readFile(source.sourcePath, 'utf-8');
    outputs.push({
      path: join(root, `adapters/${host.id}/skills/${source.name}/SKILL.md`),
      content: source.template ? render(content, host) : content,
    });
  }
}

let drift = false;
for (const host of hosts) {
  const expected = new Set(sources.map((source) => source.name));
  const skillsRoot = join(root, `adapters/${host.id}/skills`);
  const actual = await skillNames(skillsRoot);
  const missing = [...expected].filter((name) => !actual.has(name));
  const extra = [...actual].filter((name) => !expected.has(name));

  if (check) {
    for (const name of missing) {
      drift = true;
      console.error(`Generated skill missing: adapters/${host.id}/skills/${name}`);
    }
    for (const name of extra) {
      drift = true;
      console.error(`Generated skill stale: adapters/${host.id}/skills/${name}`);
    }
  } else {
    for (const name of extra) {
      await rm(join(skillsRoot, name), { recursive: true, force: true });
    }
  }
}

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

function relativeToRoot(filePath) {
  return filePath.startsWith(root) ? filePath.slice(root.length + 1) : filePath;
}

export async function discoverSkillSources(root) {
  const skillsRoot = join(root, 'skills-src');
  const sources = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const plain = join(directory, 'SKILL.md');
    const template = join(directory, 'SKILL.md.tpl');
    const sourcePath = await firstExisting([plain, template]);
    if (sourcePath) {
      const name = relative(skillsRoot, directory).split(sep).join('/');
      if (!name) throw new Error('skills-src root cannot itself be a skill');
      sources.push({ name, sourcePath, template: sourcePath.endsWith('.tpl') });
    }
    for (const entry of entries.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await visit(join(directory, entry.name));
    }
  }
  await visit(skillsRoot);
  return sources.sort((a, b) => a.name.localeCompare(b.name));
}

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await readFile(path);
      return path;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

async function skillNames(skillsRoot) {
  const names = new Set();
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    if (entries.some(entry => entry.isFile() && entry.name === 'SKILL.md')) {
      names.add(relative(skillsRoot, directory).split(sep).join('/'));
    }
    for (const entry of entries.filter(item => item.isDirectory())) await visit(join(directory, entry.name));
  }
  try {
    await visit(skillsRoot);
    return names;
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}
