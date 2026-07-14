#!/usr/bin/env node
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');
const hosts = ['codex', 'claude'];
const sharedFiles = [
  'INSTALL.md',
  'EXTENDED-ARTIFACT-CATALOG.md',
  'EXTENDED-ARTIFACT-CATALOG.zh-CN.md',
  'templates/README.md',
  'compatibility.json',
  'scripts/doctor.mjs',
];
const sharedDirectories = ['templates/core', 'templates/extended', 'scripts/lib', 'agent-methods'];

let drift = false;

for (const host of hosts) {
  for (const path of sharedFiles) {
    await syncFile(join(root, path), join(root, 'adapters', host, path));
  }
  for (const path of sharedDirectories) {
    await syncTree(join(root, path), join(root, 'adapters', host, path));
  }
}

if (drift) {
  process.exitCode = 1;
}

async function syncFile(source, target) {
  const [sourceContent, sourceStat] = await Promise.all([readFile(source), stat(source)]);
  const expectedContent = runtimeContent(source, sourceContent);

  if (!check) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, expectedContent);
    await chmod(target, sourceStat.mode & 0o777);
    return;
  }

  try {
    const [targetContent, targetStat] = await Promise.all([readFile(target), stat(target)]);
    if (
      !expectedContent.equals(targetContent) ||
      executableMode(sourceStat) !== executableMode(targetStat)
    ) {
      reportFileDrift(target);
    }
  } catch {
    reportFileDrift(target);
  }
}

async function syncTree(source, target) {
  const sourceFiles = await collectFiles(source);

  if (!check) {
    await rm(target, { recursive: true, force: true });
    for (const sourceFile of sourceFiles) {
      await syncFile(join(source, sourceFile), join(target, sourceFile));
    }
    return;
  }

  let targetFiles = [];
  try {
    targetFiles = await collectFiles(target);
  } catch {
    reportTreeDrift(target);
  }
  if (!samePaths(sourceFiles, targetFiles)) {
    reportTreeDrift(target);
  }
  for (const sourceFile of sourceFiles) {
    await syncFile(join(source, sourceFile), join(target, sourceFile));
  }
}

async function collectFiles(directory, current = directory) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(directory, path));
    } else if (entry.isFile()) {
      files.push(relative(directory, path));
    }
  }
  return files.sort();
}

function runtimeContent(source, content) {
  const sourcePath = relative(root, source);
  let runtime = content.toString('utf8');
  if (/^EXTENDED-ARTIFACT-CATALOG(?:\.zh-CN)?\.md$/.test(sourcePath)) {
    runtime = runtime.replaceAll('](README.md)', '](templates/README.md)');
  }
  if (/^templates(?:\/.*)?\/README\.md$/.test(sourcePath)) {
    runtime = runtime.replaceAll('skills-src/', 'skills/');
  }
  return Buffer.from(runtime);
}

function executableMode(fileStat) {
  return fileStat.mode & 0o111;
}

function samePaths(left, right) {
  return left.length === right.length && left.every((path, index) => path === right[index]);
}

function reportFileDrift(path) {
  drift = true;
  console.error(`Runtime bundle drift: ${relative(root, path)}`);
}

function reportTreeDrift(path) {
  drift = true;
  console.error(`Runtime bundle tree drift: ${relative(root, path)}`);
}
