#!/usr/bin/env node
// @scenario S-44 @feature ACA13
// @decision D-ACA-15
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const REQUIRED_SCHEMA_VERSION = '1.0';

/**
 * Load and validate the compatibility policy from pluginRoot.
 * Returns a frozen policy object.
 *
 * @param {string} pluginRoot
 * @returns {Promise<{schemaVersion: string, pluginVersion: string, artifactGraph: {verifiedVersion: string, installSpec: string, githubFallbackSpec: string}}>}
 */
export async function loadCompatibilityPolicy(pluginRoot) {
  const policyPath = join(pluginRoot, 'compatibility.json');
  let raw;
  try {
    raw = await readFile(policyPath, 'utf8');
  } catch (error) {
    throw new Error(`compatibility.json not found at ${policyPath}: ${error.message}`);
  }

  let policy;
  try {
    policy = JSON.parse(raw);
  } catch (error) {
    throw new Error(`compatibility.json is not valid JSON: ${error.message}`);
  }

  if (policy.schemaVersion !== REQUIRED_SCHEMA_VERSION) {
    throw new Error(
      `compatibility.json schemaVersion must be "${REQUIRED_SCHEMA_VERSION}", got "${policy.schemaVersion}"`,
    );
  }

  if (!policy.pluginVersion || typeof policy.pluginVersion !== 'string') {
    throw new Error('compatibility.json must have a non-empty pluginVersion string');
  }

  if (!policy.artifactGraph || typeof policy.artifactGraph !== 'object') {
    throw new Error('compatibility.json must have an artifactGraph object');
  }

  const { verifiedVersion, installSpec, githubFallbackSpec } = policy.artifactGraph;
  if (!verifiedVersion || typeof verifiedVersion !== 'string') {
    throw new Error('compatibility.json artifactGraph must have a non-empty verifiedVersion string');
  }
  if (!installSpec || typeof installSpec !== 'string') {
    throw new Error('compatibility.json artifactGraph must have a non-empty installSpec string');
  }
  if (!githubFallbackSpec || typeof githubFallbackSpec !== 'string') {
    throw new Error('compatibility.json artifactGraph must have a non-empty githubFallbackSpec string');
  }

  return deepFreeze(policy);
}

/**
 * Validate plugin version consistency, install specs, and documentation against the policy.
 * Returns an array of issue strings. Empty array means no issues.
 *
 * @param {string} pluginRoot
 * @returns {Promise<string[]>}
 */
export async function validateCompatibilityPolicy(pluginRoot) {
  const issues = [];
  let policy;
  try {
    policy = await loadCompatibilityPolicy(pluginRoot);
  } catch (error) {
    issues.push(`Policy load failed: ${error.message}`);
    return issues;
  }

  const { pluginVersion, artifactGraph } = policy;
  const { verifiedVersion, installSpec, githubFallbackSpec } = artifactGraph;

  // Check installSpec is precise
  const expectedInstallSpec = `artifact-graph@${verifiedVersion}`;
  if (installSpec !== expectedInstallSpec) {
    issues.push(
      `installSpec must be "${expectedInstallSpec}", got "${installSpec}"`,
    );
  }

  // Check githubFallbackSpec ends with correct tag
  const expectedTag = `artifact-graph-v${verifiedVersion}`;
  if (!githubFallbackSpec.endsWith(`#${expectedTag}`)) {
    issues.push(
      `githubFallbackSpec must end with "#${expectedTag}", got "${githubFallbackSpec}"`,
    );
  }

  // Check package.json version
  await checkJsonField(pluginRoot, 'package.json', 'version', pluginVersion, issues);

  // Check adapter manifest versions (real paths: .codex-plugin/plugin.json, .claude-plugin/plugin.json)
  for (const [adapter, manifestRel] of [
    ['codex', join('adapters', 'codex', '.codex-plugin', 'plugin.json')],
    ['claude', join('adapters', 'claude', '.claude-plugin', 'plugin.json')],
  ]) {
    await checkAdapterManifest(pluginRoot, adapter, manifestRel, pluginVersion, issues);
  }

  // Check adapter compatibility.json deep match against root policy
  for (const adapter of ['codex', 'claude']) {
    await checkAdapterCompatibility(pluginRoot, adapter, policy, issues);
  }

  // Check adapter doctor and lib files exist
  for (const adapter of ['codex', 'claude']) {
    await checkAdapterDoctorFiles(pluginRoot, adapter, issues);
  }

  // Check docs for forbidden install patterns (real public snapshot at plugin root)
  await checkDocsForForbiddenPatterns(pluginRoot, artifactGraph, issues);

  return issues;
}

async function checkJsonField(pluginRoot, relativePath, field, expected, issues) {
  const filePath = join(pluginRoot, relativePath);
  try {
    const raw = await readFile(filePath, 'utf8');
    const json = JSON.parse(raw);
    if (json[field] !== expected) {
      issues.push(
        `${relativePath} ${field} must be "${expected}", got "${json[field]}"`,
      );
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      issues.push(`${relativePath} is missing (required)`);
    } else if (error instanceof SyntaxError) {
      issues.push(`${relativePath} is not valid JSON: ${error.message}`);
    } else {
      issues.push(`${relativePath} error: ${error.message}`);
    }
  }
}

/**
 * Check adapter plugin manifest version.
 * Fail-closed: missing file or invalid JSON produces an issue, never silently skipped.
 */
async function checkAdapterManifest(pluginRoot, adapter, manifestRel, expectedVersion, issues) {
  const filePath = join(pluginRoot, manifestRel);
  try {
    const raw = await readFile(filePath, 'utf8');
    const json = JSON.parse(raw);
    if (json.version !== expectedVersion) {
      issues.push(
        `${adapter} adapter manifest version must be "${expectedVersion}", got "${json.version}"`,
      );
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      issues.push(`${adapter} adapter manifest is missing at ${manifestRel}`);
    } else if (error instanceof SyntaxError) {
      issues.push(`${adapter} adapter manifest is not valid JSON: ${error.message}`);
    } else {
      issues.push(`${adapter} adapter manifest error: ${error.message}`);
    }
  }
}

/**
 * Check adapter compatibility.json matches root policy (deep equality).
 * Fail-closed: missing file produces an issue.
 */
async function checkAdapterCompatibility(pluginRoot, adapter, rootPolicy, issues) {
  const compatRel = join('adapters', adapter, 'compatibility.json');
  const filePath = join(pluginRoot, compatRel);
  try {
    const raw = await readFile(filePath, 'utf8');
    const json = JSON.parse(raw);
    // Deep compare all fields that matter
    if (json.schemaVersion !== rootPolicy.schemaVersion) {
      issues.push(`${compatRel} schemaVersion must be "${rootPolicy.schemaVersion}", got "${json.schemaVersion}"`);
    }
    if (json.pluginVersion !== rootPolicy.pluginVersion) {
      issues.push(`${compatRel} pluginVersion must be "${rootPolicy.pluginVersion}", got "${json.pluginVersion}"`);
    }
    const ag = json.artifactGraph;
    const rag = rootPolicy.artifactGraph;
    if (!ag) {
      issues.push(`${compatRel} missing artifactGraph object`);
    } else {
      if (ag.verifiedVersion !== rag.verifiedVersion) {
        issues.push(`${compatRel} artifactGraph.verifiedVersion must be "${rag.verifiedVersion}", got "${ag.verifiedVersion}"`);
      }
      if (ag.installSpec !== rag.installSpec) {
        issues.push(`${compatRel} artifactGraph.installSpec must be "${rag.installSpec}", got "${ag.installSpec}"`);
      }
      if (ag.githubFallbackSpec !== rag.githubFallbackSpec) {
        issues.push(`${compatRel} artifactGraph.githubFallbackSpec must be "${rag.githubFallbackSpec}", got "${ag.githubFallbackSpec}"`);
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      issues.push(`${compatRel} is missing (required for adapter ${adapter})`);
    } else if (error instanceof SyntaxError) {
      issues.push(`${compatRel} is not valid JSON: ${error.message}`);
    } else {
      issues.push(`${compatRel} error: ${error.message}`);
    }
  }
}

// ── Install spec classification (argument-order agnostic) ─────────────

// Recognized package-manager install command prefixes.
const INSTALL_CMD_PREFIXES = [
  ['npm', 'install'],
  ['npm', 'i'],
  ['pnpm', 'add'],
];

/**
 * Classify a single code-block line for forbidden install specs.
 * Returns a description string if the spec is forbidden, null otherwise.
 *
 * Strategy: split the line into tokens, match a known install command prefix,
 * then scan ALL remaining tokens for an artifact-graph package spec — no
 * enumeration of flag orderings.
 *
 * Only exact matches against expectedInstallSpec and expectedGithubSpec are allowed.
 *
 * @param {string} line
 * @param {string} expectedInstallSpec - e.g. "artifact-graph@0.3.1"
 * @param {string} expectedGithubSpec - e.g. "github:ifoohoo/artifact-graph#artifact-graph-v0.3.1"
 */
function classifyInstallSpecViolation(line, expectedInstallSpec, expectedGithubSpec) {
  const tokens = line.split(/\s+/);

  // Standalone GitHub repo (no install command prefix needed)
  // Match both the current ifoohoo slug and the pre-migration mzdbxqh slug so
  // stale references are still flagged as mismatches.
  if (tokens.length === 1 && /^github:(?:mzdbxqh|ifoohoo)\/artifact-graph/.test(tokens[0])) {
    if (tokens[0] === expectedGithubSpec) return null;
    return `GitHub spec mismatch: got "${tokens[0]}", expected "${expectedGithubSpec}"`;
  }

  if (tokens.length < 3) return null;

  // Match command prefix (e.g. "npm install", "pnpm add")
  let cmdLen = 0;
  for (const [bin, sub] of INSTALL_CMD_PREFIXES) {
    if (tokens[0] === bin && tokens[1] === sub) {
      cmdLen = 2;
      break;
    }
  }
  if (cmdLen === 0) return null;

  // Scan remaining tokens for a package spec containing artifact-graph
  for (const tok of tokens.slice(cmdLen)) {
    // Skip flags
    if (tok.startsWith('-')) continue;

    // GitHub spec: github:ifoohoo/artifact-graph or github:ifoohoo/artifact-graph#tag
    if (/^github:(?:mzdbxqh|ifoohoo)\/artifact-graph/.test(tok)) {
      if (tok === expectedGithubSpec) continue;
      return `GitHub spec mismatch: got "${tok}", expected "${expectedGithubSpec}"`;
    }

    // npm/pnpm package spec
    if (/^artifact-graph(@|$)/.test(tok)) {
      if (tok === expectedInstallSpec) continue;
      return `install spec mismatch: got "${tok}", expected "${expectedInstallSpec}"`;
    }
  }

  return null;
}

/**
 * Check public docs for forbidden install patterns.
 * Scans real public snapshot files at plugin root:
 *   INSTALL.md, README.md, README.zh-CN.md, adapters/codex/INSTALL.md, adapters/claude/INSTALL.md
 *
 * For each fenced code block line, extracts the artifact-graph package spec
 * from any argument position and classifies it — no enumeration of flag orderings.
 *
 * @param {string} pluginRoot
 * @param {{installSpec: string, githubFallbackSpec: string}} artifactGraphPolicy
 * @param {string[]} issues
 */
async function checkDocsForForbiddenPatterns(pluginRoot, artifactGraphPolicy, issues) {
  const { installSpec: expectedInstallSpec, githubFallbackSpec: expectedGithubSpec } = artifactGraphPolicy;
  const docPaths = [
    'INSTALL.md',
    'README.md',
    'README.zh-CN.md',
    join('adapters', 'codex', 'INSTALL.md'),
    join('adapters', 'claude', 'INSTALL.md'),
  ];

  for (const relPath of docPaths) {
    const filePath = join(pluginRoot, relPath);
    let content;
    try {
      content = await readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        issues.push(`${relPath} is missing (required public doc)`);
      }
      continue;
    }

    const lines = extractCodeBlocks(content)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const violation = classifyInstallSpecViolation(line, expectedInstallSpec, expectedGithubSpec);
      if (violation) {
        issues.push(`${relPath} code blocks contain forbidden install pattern: ${violation}`);
      }
    }
  }
}

function extractCodeBlocks(markdown) {
  const blocks = [];
  const re = /```[\w-]*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join('\n');
}

/**
 * Check adapter doctor and lib files exist.
 * Fail-closed: missing file produces an issue.
 */
async function checkAdapterDoctorFiles(pluginRoot, adapter, issues) {
  const requiredFiles = [
    join('adapters', adapter, 'scripts', 'doctor.mjs'),
    join('adapters', adapter, 'scripts', 'lib', 'compatibility-policy.mjs'),
    join('adapters', adapter, 'scripts', 'lib', 'artifact-graph-runtime.mjs'),
  ];

  for (const relPath of requiredFiles) {
    const filePath = join(pluginRoot, relPath);
    try {
      await readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        issues.push(`${relPath} is missing (required for adapter ${adapter})`);
      } else {
        issues.push(`${relPath} error: ${error.message}`);
      }
    }
  }
}

function deepFreeze(obj) {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}
