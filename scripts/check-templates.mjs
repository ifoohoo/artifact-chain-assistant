#!/usr/bin/env node
// @scenario S-01 @feature ACA1
// 模板目录完整性检查：校验 core 和 extended 下每个类型目录至少包含 starter.md 和 review-checklist.md
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const templatesDir = join(root, 'templates');
const REQUIRED_FILES = ['starter.md', 'review-checklist.md'];
const CATALOG_FILES = [
  join(root, 'templates/extended/README.md'),
  join(root, 'EXTENDED-ARTIFACT-CATALOG.md'),
  join(root, 'EXTENDED-ARTIFACT-CATALOG.zh-CN.md'),
];

/** 判断路径是否为目录 */
async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** 获取目录下的子目录名列表 */
async function subdirs(path) {
  if (!(await isDir(path))) return [];
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/** 检查单个类型目录，返回缺失文件列表 */
async function checkTypeDir(dirPath) {
  const missing = [];
  for (const file of REQUIRED_FILES) {
    try {
      await stat(join(dirPath, file));
    } catch {
      missing.push(file);
    }
  }
  return missing;
}

async function main() {
  const errors = [];
  const extendedTypes = [];

  for (const requiredRoot of ['core', 'extended']) {
    const path = join(templatesDir, requiredRoot);
    if (!(await isDir(path)) || (await subdirs(path)).length === 0) {
      errors.push({ type: `templates/${requiredRoot}`, missing: ['non-empty directory'] });
    }
  }

  // 1. core 目录：每个子目录即一个类型
  const coreDir = join(templatesDir, 'core');
  for (const typeName of await subdirs(coreDir)) {
    const missing = await checkTypeDir(join(coreDir, typeName));
    if (missing.length > 0) {
      errors.push({ type: `core/${typeName}`, missing });
    }
  }

  // 2. extended 目录：每类（contracts, domain, ops, governance, agent）下各有类型子目录
  const extendedDir = join(templatesDir, 'extended');
  for (const category of await subdirs(extendedDir)) {
    for (const typeName of await subdirs(join(extendedDir, category))) {
      extendedTypes.push(typeName);
      const missing = await checkTypeDir(join(extendedDir, category, typeName));
      if (missing.length > 0) {
        errors.push({ type: `extended/${category}/${typeName}`, missing });
      }
    }
  }

  for (const catalogFile of CATALOG_FILES) {
    let text = '';
    try {
      text = await readFile(catalogFile, 'utf8');
    } catch {
      errors.push({ type: catalogFile, missing: ['catalog file'] });
      continue;
    }
    for (const typeName of extendedTypes) {
      if (!text.includes(typeName)) {
        errors.push({ type: catalogFile, missing: [`catalog entry for ${typeName}`] });
      }
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(
        `Template integrity violation: ${err.type} is missing ${err.missing.join(', ')}`
      );
    }
    console.error(
      `\n${errors.length} type(s) have incomplete templates. ` +
        `Each type directory must contain: ${REQUIRED_FILES.join(', ')}`
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Template integrity check passed: ${extendedTypes.length} extended type(s) have ` +
        'required files and catalog coverage.'
    );
  }
}

main();
