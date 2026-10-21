#!/usr/bin/env node
// @scenario S-01 @feature ACA1
// @scenario S-05 @feature ACA5
// @feature ACA17
// @scenario S-56
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANAGED_SKILL_TREES = ['spec-author'];
const RETIRED_MANAGED_SKILL_TREES = ['spec-converger'];

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
  {
    id: 'kimi',
    hostName: 'Kimi Code',
    agentName: 'Kimi Code',
    hostBehavior: '在 Kimi Code 中，优先产出可交接的 intake 结果。如果允许进入实现且任务要委派执行，生成或建议当前项目支持的 packet-prompt。',
  },
];

const sources = await discoverSkillSources(root);
const outputs = [];

for (const host of hosts) {
  for (const source of sources) {
    const content = await readFile(source.sourcePath, 'utf-8');
    outputs.push({
      path: join(root, `adapters/${host.id}/skills/${source.name}/SKILL.md`),
      content: renderGeneratedSkill(source.template ? render(content, host) : content, source.name),
    });
  }
}

// Root skills/** is the Claude-semantic distribution copy for standard plugin installation.
const claudeHost = hosts.find((h) => h.id === 'claude');
for (const source of sources) {
  const content = await readFile(source.sourcePath, 'utf-8');
  outputs.push({
    path: join(root, `skills/${source.name}/SKILL.md`),
    content: renderGeneratedSkill(source.template ? render(content, claudeHost) : content, source.name),
  });
}

// Sync non-SKILL reference files from skills-src to root skills/** and adapter skills/**.
const referenceOutputs = await collectReferenceOutputs(root, sources, hosts);

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

// Root skills stale check
{
  const expected = new Set(sources.map((source) => source.name));
  const skillsRoot = join(root, 'skills');
  const actual = await skillNames(skillsRoot);
  const missing = [...expected].filter((name) => !actual.has(name));
  const extra = [...actual].filter((name) => !expected.has(name));

  if (check) {
    for (const name of missing) {
      drift = true;
      console.error(`Generated skill missing: skills/${name}`);
    }
    for (const name of extra) {
      drift = true;
      console.error(`Generated skill stale: skills/${name}`);
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

// Write or check reference outputs
for (const ref of referenceOutputs) {
  if (check) {
    let current = '';
    try {
      current = await readFile(ref.path, 'utf-8');
    } catch {
      current = '';
    }
    if (current !== ref.content) {
      drift = true;
      console.error(`Generated skill drift: ${relativeToRoot(ref.path)}`);
    }
  } else {
    await mkdir(dirname(ref.path), { recursive: true });
    await writeFile(ref.path, ref.content);
  }
}

const expectedManagedPaths = [...outputs, ...referenceOutputs].map((item) => item.path);
await reconcileManagedSkillTrees(expectedManagedPaths);
await verifyPinnedManagedResources();

if (drift) {
  process.exitCode = 1;
}

/**
 * Collect non-SKILL reference files from skills-src and produce outputs for
 * root skills/**, adapters/claude/skills/**, and adapters/codex/skills/**.
 * Files are copied byte-for-byte (no template rendering).
 *
 * For families with a references/ directory, the family-level references are
 * projected only into nested skills whose SKILL.md consumes `references/...`.
 */
async function collectReferenceOutputs(root, sources, hosts) {
  const skillsSrcRoot = join(root, 'skills-src');
  const outputs = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        // Skip SKILL.md and SKILL.md.tpl — handled by the main outputs
        if (entry.name === 'SKILL.md' || entry.name === 'SKILL.md.tpl') continue;

        const relFromSrc = relative(skillsSrcRoot, fullPath);
        const content = await readFile(fullPath, 'utf-8');
        // Root skills
        outputs.push({ path: join(root, 'skills', relFromSrc), content });
        // Adapter skills
        for (const host of hosts) {
          outputs.push({ path: join(root, `adapters/${host.id}/skills`, relFromSrc), content });
        }
      }
    }
  }

  try {
    await walk(skillsSrcRoot);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // Project family-level references/ only into nested consumers.
  const familyEntries = await readdir(skillsSrcRoot, { withFileTypes: true });
  for (const familyEntry of familyEntries) {
    if (!familyEntry.isDirectory()) continue;
    const familyDir = join(skillsSrcRoot, familyEntry.name);
    const refsDir = join(familyDir, 'references');
    let refFiles;
    try {
      refFiles = (await readdir(refsDir)).filter((f) => f !== 'SKILL.md' && f !== 'SKILL.md.tpl');
    } catch {
      continue; // no references/ directory in this family
    }
    if (refFiles.length === 0) continue;

    // Find nested skills (subdirectories with SKILL.md)
    const subEntries = await readdir(familyDir, { withFileTypes: true });
    for (const sub of subEntries) {
      if (!sub.isDirectory() || sub.name === 'references') continue;
      const nestedSkillMd = join(familyDir, sub.name, 'SKILL.md');
      try {
        await access(nestedSkillMd);
      } catch {
        continue; // not a nested skill
      }
      const nestedSkillContent = await readFile(nestedSkillMd, 'utf-8');
      const consumesFamilyReferences = nestedSkillContent.includes('references/');
      const nestedSourceRefs = join(familyDir, sub.name, 'references');

      if (!consumesFamilyReferences) {
        let hasOwnReferences = true;
        try {
          await access(nestedSourceRefs);
        } catch {
          hasOwnReferences = false;
        }
        if (!hasOwnReferences) {
          for (const generatedRoot of [
            join(root, 'skills'),
            ...hosts.map((host) => join(root, `adapters/${host.id}/skills`)),
          ]) {
            const staleDir = join(generatedRoot, familyEntry.name, sub.name, 'references');
            if (check) {
              try {
                await access(staleDir);
                console.error(`Generated skill stale: ${relativeToRoot(staleDir)}`);
                process.exitCode = 1;
              } catch {
                // No stale projection.
              }
            } else {
              await rm(staleDir, { recursive: true, force: true });
            }
          }
        }
        continue;
      }
      // Project each family reference file into the nested skill's references/
      for (const refFile of refFiles) {
        const srcPath = join(refsDir, refFile);
        const content = await readFile(srcPath, 'utf-8');
        const nestedRel = `${familyEntry.name}/${sub.name}/references/${refFile}`;
        outputs.push({ path: join(root, 'skills', nestedRel), content });
        for (const host of hosts) {
          outputs.push({ path: join(root, `adapters/${host.id}/skills`, nestedRel), content });
        }
      }
    }
  }

  return outputs;
}

function render(source, vars) {
  return `${source.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) {
      throw new Error(`Unknown template variable: ${key}`);
    }
    return vars[key];
  }).trimEnd()}\n`;
}

function renderGeneratedSkill(content, skillName) {
  if (!skillName.includes('/')) return content;
  return content.replaceAll('../references/', 'references/');
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

async function collectRelativeFiles(directory, current = directory) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectRelativeFiles(directory, fullPath));
    } else if (entry.isFile()) {
      files.push(relative(directory, fullPath).split(sep).join('/'));
    }
  }
  return files.sort();
}

async function pruneEmptyDirectories(tree) {
  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      throw error;
    }
    let empty = true;
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const childEmpty = await visit(fullPath);
        if (!childEmpty) empty = false;
      } else {
        empty = false;
      }
    }
    if (empty && dir !== tree) {
      await rm(dir, { recursive: true, force: true });
      return true;
    }
    return empty;
  }
  await visit(tree);
}

function managedSkillTrees(skillName) {
  return [
    join(root, 'skills', skillName),
    ...hosts.map((host) => join(root, `adapters/${host.id}/skills`, skillName)),
  ];
}

/**
 * Keep generated spec-author trees identical to the generator's expected
 * file set. Source deletes or renames must drop the old copy. A retired
 * spec-converger tree is reported stale and removed only inside this
 * syncer's managed output locations. Other skills and unmanaged files stay.
 */
async function reconcileManagedSkillTrees(expectedAbsolutePaths) {
  const expectedByTree = new Map();
  const retiredTrees = new Set();
  for (const skillName of MANAGED_SKILL_TREES) {
    for (const tree of managedSkillTrees(skillName)) expectedByTree.set(tree, new Set());
  }
  for (const skillName of RETIRED_MANAGED_SKILL_TREES) {
    for (const tree of managedSkillTrees(skillName)) {
      expectedByTree.set(tree, new Set());
      retiredTrees.add(tree);
    }
  }

  for (const absPath of expectedAbsolutePaths) {
    for (const [tree, files] of expectedByTree) {
      if (retiredTrees.has(tree)) continue;
      const prefix = `${tree}${sep}`;
      if (absPath === tree || absPath.startsWith(prefix)) {
        files.add(relative(tree, absPath).split(sep).join('/'));
      }
    }
  }

  for (const [tree, expected] of expectedByTree) {
    let actual = [];
    try {
      actual = await collectRelativeFiles(tree);
    } catch (error) {
      if (error.code === 'ENOENT') {
        if (check && expected.size > 0) {
          drift = true;
          console.error(`Generated skill missing: ${relativeToRoot(tree)}`);
        }
        continue;
      }
      throw error;
    }

    for (const file of actual) {
      if (expected.has(file)) continue;
      const fullPath = join(tree, file);
      if (check) {
        drift = true;
        console.error(`Generated skill stale: ${relativeToRoot(fullPath)}`);
      } else {
        await rm(fullPath, { force: true });
      }
    }

    if (!check) {
      await pruneEmptyDirectories(tree);
      try {
        const remaining = await readdir(tree);
        if (remaining.length === 0) await rm(tree, { recursive: true, force: true });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
}

async function verifyPinnedManagedResources() {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const pins = pkg.artifactChainManagedResources ?? {};
  for (const [name, pin] of Object.entries(pins)) {
    if (!pin || typeof pin !== 'object' || typeof pin.consumerSource !== 'string' || typeof pin.sha256 !== 'string') {
      drift = true;
      console.error(`Managed resource declaration invalid: ${name}`);
      continue;
    }
    const sourcePath = join(root, pin.consumerSource);
    let bytes;
    try {
      bytes = await readFile(sourcePath);
    } catch {
      drift = true;
      console.error(`Managed resource missing: ${pin.consumerSource}`);
      continue;
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== pin.sha256) {
      drift = true;
      console.error(`Managed resource digest mismatch: ${pin.consumerSource}`);
    }
  }
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
