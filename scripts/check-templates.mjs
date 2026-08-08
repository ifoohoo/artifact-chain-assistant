#!/usr/bin/env node
// @scenario S-01 @feature ACA1
// 模板目录完整性检查：校验 core 和 extended 下每个类型目录至少包含 starter.md 和 review-checklist.md
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
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

// ── Professional skill family contract checks ──────────────────────────────

const PROFESSIONAL_ENTRY_FILES = ['SKILL.md', 'author/SKILL.md', 'review/SKILL.md', 'repair/SKILL.md'];
const PROFESSIONAL_REFERENCE_FILES = ['references/inspect.md', 'references/compose.md', 'references/validate.md'];

/**
 * Prohibited literal patterns (case-insensitive for first group).
 * Absolute path patterns are checked separately.
 */
const PROHIBITED_LITERALS = [
  /\bheimdall\b/i,
  /\btauri\b/i,
  /\bquick\s+check\b/i,
  /\bopen\s+core\b/i,
  /\bsqlite\b/i,
];
const ABSOLUTE_PATH_RE = /(?:^|\s)\/(?:Users|home|opt|var|tmp|etc)\b/;

/**
 * Detect professional families under skills-src: a directory is a professional
 * family if it contains an `author/` subdirectory.
 */
async function discoverProfessionalFamilies(skillsSrcDir) {
  const families = [];
  const entries = await readdir(skillsSrcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const familyDir = join(skillsSrcDir, entry.name);
    try {
      await stat(join(familyDir, 'author'));
      families.push({ name: entry.name, dir: familyDir });
    } catch {
      // not a professional family
    }
  }
  return families;
}

/**
 * Recursively collect all .md files under a directory.
 */
async function collectMarkdownFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Parse YAML frontmatter fields from a markdown file.
 * Returns the raw frontmatter block and parsed { name, description, extra }.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { raw: null, fields: {} };
  const raw = match[1];
  const fields = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return { raw, fields };
}

/**
 * Check professional family contract compliance.
 * Returns array of error strings.
 */
async function checkProfessionalFamilies(skillsSrcDir) {
  const errors = [];
  const families = await discoverProfessionalFamilies(skillsSrcDir);

  for (const family of families) {
    // 1. Entry completeness
    for (const entry of PROFESSIONAL_ENTRY_FILES) {
      const entryPath = join(family.dir, entry);
      try {
        await stat(entryPath);
      } catch {
        errors.push(`family ${family.name}: missing required entry ${entry}`);
      }
    }

    // 1b. Internal reference completeness
    for (const ref of PROFESSIONAL_REFERENCE_FILES) {
      const refPath = join(family.dir, ref);
      try {
        await stat(refPath);
      } catch {
        errors.push(`family ${family.name}: missing required internal reference ${ref}`);
      }
    }

    // 2. Closed-loop keywords
    const readSafe = async (rel) => {
      try { return await readFile(join(family.dir, rel), 'utf8'); } catch { return ''; }
    };

    const authorContent = await readSafe('author/SKILL.md');
    const reviewContent = await readSafe('review/SKILL.md');
    const repairContent = await readSafe('repair/SKILL.md');

    // Default SKILL.md must contain routing keywords: author, review, repair
    const defaultContent = await readSafe('SKILL.md');
    if (defaultContent) {
      for (const kw of ['author', 'review', 'repair']) {
        if (!defaultContent.includes(kw)) {
          errors.push(`family ${family.name}/SKILL.md: missing routing keyword "${kw}"`);
        }
      }
    }

    // Author must contain: inspect, compose, validate, review (as steps)
    if (authorContent) {
      for (const kw of ['inspect', 'compose', 'validate', 'review']) {
        if (!authorContent.includes(kw)) {
          errors.push(`family ${family.name}/author: missing closed-loop keyword "${kw}"`);
        }
      }
    }

    // Review must contain: inspect, review, findings
    if (reviewContent) {
      for (const kw of ['inspect', 'review', 'findings']) {
        if (!reviewContent.includes(kw)) {
          errors.push(`family ${family.name}/review: missing closed-loop keyword "${kw}"`);
        }
      }
    }

    // Repair must contain: findings, repair, re-review
    if (repairContent) {
      for (const kw of ['findings', 'repair', 're-review']) {
        if (!repairContent.includes(kw)) {
          errors.push(`family ${family.name}/repair: missing closed-loop keyword "${kw}"`);
        }
      }
    }

    // Internal references: inspect.md must contain "inspect" and "config"
    //                     compose.md must contain "compose" and "frontmatter"
    //                     validate.md must contain "validate"
    const inspectRef = await readSafe('references/inspect.md');
    if (inspectRef) {
      for (const kw of ['inspect', 'config']) {
        if (!inspectRef.includes(kw)) {
          errors.push(`family ${family.name}/references/inspect.md: missing keyword "${kw}"`);
        }
      }
    }
    const composeRef = await readSafe('references/compose.md');
    if (composeRef) {
      for (const kw of ['compose', 'frontmatter']) {
        if (!composeRef.includes(kw)) {
          errors.push(`family ${family.name}/references/compose.md: missing keyword "${kw}"`);
        }
      }
    }
    const validateRef = await readSafe('references/validate.md');
    if (validateRef) {
      for (const kw of ['validate']) {
        if (!validateRef.includes(kw)) {
          errors.push(`family ${family.name}/references/validate.md: missing keyword "${kw}"`);
        }
      }
    }

    // 3. Prohibited literals in all family .md files
    const allFiles = await collectMarkdownFiles(family.dir);
    for (const filePath of allFiles) {
      const relPath = relative(root, filePath);
      const content = await readFile(filePath, 'utf8');
      for (const pattern of PROHIBITED_LITERALS) {
        if (pattern.test(content)) {
          errors.push(`${relPath}: contains prohibited literal matching ${pattern}`);
        }
      }
      if (ABSOLUTE_PATH_RE.test(content)) {
        errors.push(`${relPath}: contains absolute path`);
      }
    }

    // 4. References as non-entry: reference .md files must not have frontmatter
    const refsDir = join(family.dir, 'references');
    try {
      const refEntries = await readdir(refsDir, { withFileTypes: true });
      for (const ref of refEntries) {
        if (!ref.isFile() || !ref.name.endsWith('.md')) continue;
        const refContent = await readFile(join(refsDir, ref.name), 'utf8');
        if (refContent.startsWith('---')) {
          errors.push(
            `family ${family.name}/references/${ref.name}: reference file must not have frontmatter`
          );
        }
      }
    } catch {
      // no references dir — that's OK
    }

    // 5. Frontmatter shape: SKILL.md files must only have name + description
    for (const entry of PROFESSIONAL_ENTRY_FILES) {
      const entryPath = join(family.dir, entry);
      let content;
      try {
        content = await readFile(entryPath, 'utf8');
      } catch {
        continue; // already reported as missing
      }
      const { fields } = parseFrontmatter(content);
      const allowed = new Set(['name', 'description']);
      for (const key of Object.keys(fields)) {
        if (!allowed.has(key)) {
          errors.push(
            `family ${family.name}/${entry}: unexpected frontmatter field "${key}"`
          );
        }
      }
      // description must be third-person (should not start with first-person)
      if (fields.description && /^(I|We)\s/i.test(fields.description)) {
        errors.push(
          `family ${family.name}/${entry}: description must be third-person`
        );
      }
    }
  }

  return errors;
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
