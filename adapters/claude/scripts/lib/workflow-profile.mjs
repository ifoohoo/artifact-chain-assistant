// @scenario S-51
// @scenario S-53
// @scenario S-54
// Single workflow-profile resolver for source and generated adapter runtimes.
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { parseMinimalYaml } from './inline-yaml-parser.mjs';

const PLUGIN_ROOT = resolve(import.meta.dirname, '..', '..');
const SCHEMA_PATH = join(PLUGIN_ROOT, 'schemas', 'artifact-workflow-profile.schema.json');
const YAML_PROFILE = 'artifact-profiles/project.yaml';
const LEGACY_JSON = '.artifact-review.json';
const VALIDATOR_TIMEOUT_MS = 30_000;
const VALID_ACTIONS = new Set(['generate', 'review', 'repair', 'audit', 'batch']);
const VALID_DOMAIN = /^[a-z][a-z0-9-]*$/u;
const PUBLIC_AUDIT_DOMAINS = new Set(['health', 'capability']);
const BLOCKED_PATTERN = /blocked|unsafe|absolute|traversal|escape|symlink|dangling|duplicate|regular file|not a file|cannot (?:read|resolve|start)|invalid (?:legacy|worker|validator)|conflict|inconsistent|reserved|kebab|directory separator|timed out|signal|exited|prototype|pollution|dangerous|__proto__/i;
let schemaCache;

function loadSchema() {
  schemaCache ??= JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  return schemaCache;
}

function own(value, key) {
  return Object.hasOwn(value, key);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function contained(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function realpathOrResolved(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function hasTraversalSegment(path) {
  return path.split(/[\\/]+/u).includes('..');
}

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

/** Minimal deterministic validator for the committed workflow-profile schema. */
export function validateAgainstSchema(data, schema, path = '') {
  const errors = [];
  if (schema.type) {
    const actual = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    if (schema.type === 'integer') {
      if (actual !== 'number' || !Number.isInteger(data)) {
        return { valid: false, errors: [`${path || '/'}: expected type integer, got ${actual}`] };
      }
    } else if (actual !== schema.type) {
      return { valid: false, errors: [`${path || '/'}: expected type ${schema.type}, got ${actual}`] };
    }
  }
  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path || '/'}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`);
  }
  if (schema.required && isObject(data)) {
    for (const key of schema.required) {
      if (!own(data, key)) errors.push(`${path}/${key}: required property missing`);
    }
  }
  if (schema.additionalProperties === false && isObject(data)) {
    const allowed = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(data)) {
      if (!allowed.has(key)) errors.push(`${path}/${key}: additional property not allowed`);
    }
  }
  if (schema.propertyNames?.enum && isObject(data)) {
    const allowedNames = new Set(schema.propertyNames.enum);
    for (const key of Object.keys(data)) {
      if (!allowedNames.has(key)) errors.push(`${path}/${key}: unsupported property name`);
    }
  }
  if (schema.properties && isObject(data)) {
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (own(data, key)) errors.push(...validateAgainstSchema(data[key], childSchema, `${path}/${key}`).errors);
    }
  }
  if (isObject(schema.additionalProperties) && isObject(data)) {
    const defined = new Set(Object.keys(schema.properties ?? {}));
    for (const [key, value] of Object.entries(data)) {
      if (!defined.has(key)) errors.push(...validateAgainstSchema(value, schema.additionalProperties, `${path}/${key}`).errors);
    }
  }
  if (schema.items && Array.isArray(data)) {
    data.forEach((value, index) => {
      errors.push(...validateAgainstSchema(value, schema.items, `${path}/${index}`).errors);
    });
  }
  if (schema.minLength !== undefined && typeof data === 'string' && data.length < schema.minLength) {
    errors.push(`${path}: string length ${data.length} is less than minLength ${schema.minLength}`);
  }
  if (schema.pattern !== undefined && typeof data === 'string' && !new RegExp(schema.pattern).test(data)) {
    errors.push(`${path}: string does not match pattern ${schema.pattern}`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate resource paths once and return the only resolved paths consumers may use.
 * details preserves input order so categories can be reconstructed without resolve() reuse.
 */
export function validateResourcePaths(paths, root) {
  const surfaceRoot = resolve(root);
  const realRoot = realpathOrResolved(root);
  const errors = [];
  const resolved = [];
  const details = [];
  const seen = new Set();
  paths.forEach((source, index) => {
    const reject = (error, kind = 'dangerous') => {
      errors.push(error);
      details.push({ index, source, resolved: null, error, kind });
    };
    if (typeof source !== 'string' || source.length === 0) {
      reject(`Invalid resource path: ${String(source)}`);
      return;
    }
    if (isAbsolute(source)) {
      reject(`Absolute path rejected: ${source}`);
      return;
    }
    if (hasTraversalSegment(source)) {
      reject(`Path traversal rejected: ${source}`);
      return;
    }
    const surface = resolve(surfaceRoot, source);
    if (!contained(surfaceRoot, surface)) {
      reject(`Path escapes root: ${source}`);
      return;
    }
    let surfaceStat;
    try {
      surfaceStat = lstatOrNull(surface);
    } catch (error) {
      reject(`Cannot inspect resource: ${source}: ${error.message}`);
      return;
    }
    if (!surfaceStat) {
      reject(`Path not found: ${source}`, 'missing');
      return;
    }
    if (surfaceStat.isSymbolicLink() && !existsSync(surface)) {
      reject(`Dangling resource symlink: ${source}`);
      return;
    }
    let stat;
    try {
      stat = statSync(surface);
    } catch (error) {
      reject(`Cannot read resource: ${source}: ${error.message}`);
      return;
    }
    if (!stat.isFile()) {
      reject(`Not a file: ${source}`);
      return;
    }
    let real;
    try {
      real = realpathSync(surface);
      readFileSync(real);
    } catch (error) {
      reject(`Cannot read resource: ${source}: ${error.message}`);
      return;
    }
    if (!contained(realRoot, real)) {
      reject(`Symlink escapes root: ${source}`);
      return;
    }
    if (seen.has(real)) {
      reject(`Duplicate resource: ${source}`);
      return;
    }
    seen.add(real);
    resolved.push(surface);
    details.push({ index, source, resolved: surface, error: null, kind: null });
  });
  return { safe: errors.length === 0, errors, resolved, details };
}

export function validateSkillName(name, projectId, { legacy = false } = {}) {
  if (typeof name !== 'string' || name.length === 0) return { valid: false, error: 'worker.skill is required' };
  if (isAbsolute(name) || hasTraversalSegment(name) || name.includes('/') || name.includes('\\')) {
    return { valid: false, error: `Invalid worker skill name or path: "${name}"` };
  }
  if (!/^[a-z][a-z0-9-]*$/u.test(name)) {
    return { valid: false, error: `Worker skill must be lowercase kebab-case: "${name}"` };
  }
  if (legacy) return { valid: true, error: null };
  if (name.startsWith('artifact-')) {
    return { valid: false, error: `Worker skill collides with reserved public prefix "artifact-": "${name}"` };
  }
  if (!name.startsWith('project-') && !name.startsWith(`${projectId}-`)) {
    return { valid: false, error: `Worker skill must start with "project-" or "${projectId}-": "${name}"` };
  }
  return { valid: true, error: null };
}

/** Validate explicit and auto-discovered profiles with one containment policy. */
export function validateProfilePathSafety(profilePath, root) {
  const surfaceRoot = resolve(root);
  const realProjectRoot = realpathOrResolved(root);
  const surface = isAbsolute(profilePath) ? resolve(profilePath) : resolve(surfaceRoot, profilePath);
  if (!contained(surfaceRoot, surface)) {
    return { safe: false, error: `Profile path outside project root: "${profilePath}"`, resolved: null };
  }
  if (!['.yaml', '.yml', '.json'].includes(extname(surface).toLowerCase())) {
    return { safe: false, error: `Profile must be .yaml, .yml, or .json: "${profilePath}"`, resolved: null };
  }
  let surfaceStat;
  try {
    surfaceStat = lstatOrNull(surface);
  } catch (error) {
    return { safe: false, error: `Cannot inspect profile: "${profilePath}": ${error.message}`, resolved: null };
  }
  if (!surfaceStat) return { safe: true, error: null, resolved: surface };
  if (surfaceStat.isSymbolicLink() && !existsSync(surface)) {
    return { safe: false, error: `Dangling profile symlink: "${profilePath}"`, resolved: null };
  }
  let stat;
  let real;
  try {
    stat = statSync(surface);
    real = realpathSync(surface);
    readFileSync(real);
  } catch (error) {
    return { safe: false, error: `Cannot read profile: "${profilePath}": ${error.message}`, resolved: null };
  }
  if (!stat.isFile()) return { safe: false, error: `Profile path is not a regular file: "${profilePath}"`, resolved: null };
  if (!contained(realProjectRoot, real)) {
    return { safe: false, error: `Profile symlink escapes project root: "${profilePath}"`, resolved: null };
  }
  return { safe: true, error: null, resolved: surface };
}

/** Resolve a private project worker and fail closed on every present host candidate. */
export function resolveWorkerPath(projectRoot, skillName) {
  const candidates = [];
  const realProjectRoot = realpathOrResolved(projectRoot);
  for (const base of ['.agents/skills', '.claude/skills']) {
    const skillsRoot = join(projectRoot, base);
    let rootSurface;
    try {
      rootSurface = lstatOrNull(skillsRoot);
    } catch (error) {
      return { path: null, error: `Cannot inspect worker skills root: ${skillsRoot}: ${error.message}` };
    }
    if (!rootSurface) continue;
    if (rootSurface.isSymbolicLink() && !existsSync(skillsRoot)) {
      return { path: null, error: `Dangling worker skills root symlink: ${skillsRoot}` };
    }
    let realSkillsRoot;
    try {
      if (!statSync(skillsRoot).isDirectory()) {
        return { path: null, error: `Worker skills root is not a directory: ${skillsRoot}` };
      }
      realSkillsRoot = realpathSync(skillsRoot);
    } catch (error) {
      return { path: null, error: `Cannot resolve worker skills root: ${skillsRoot}: ${error.message}` };
    }
    if (!contained(realProjectRoot, realSkillsRoot)) {
      return { path: null, error: `Worker skills root escapes project root: ${skillsRoot}` };
    }
    const candidate = join(skillsRoot, skillName, 'SKILL.md');
    let candidateSurface;
    try {
      candidateSurface = lstatOrNull(candidate);
    } catch (error) {
      return { path: null, error: `Cannot inspect worker candidate: ${candidate}: ${error.message}` };
    }
    if (!candidateSurface) continue;
    if (candidateSurface.isSymbolicLink() && !existsSync(candidate)) {
      return { path: null, error: `Dangling worker candidate symlink: ${candidate}` };
    }
    let stat;
    let real;
    let bytes;
    try {
      stat = statSync(candidate);
      if (!stat.isFile()) return { path: null, error: `Worker candidate is not a regular file: ${candidate}` };
      real = realpathSync(candidate);
      if (!contained(realSkillsRoot, real)) {
        return { path: null, error: `Worker SKILL.md escapes its skills root: ${candidate}` };
      }
      bytes = readFileSync(real);
    } catch (error) {
      return { path: null, error: `Cannot read worker candidate: ${candidate}: ${error.message}` };
    }
    candidates.push({ path: candidate, real, bytes });
  }
  if (candidates.length === 0) return { path: null, error: `Worker skill not found: ${skillName}`, missing: true };
  if (candidates.length === 2) {
    const hashes = candidates.map(({ bytes }) => createHash('sha256').update(bytes).digest('hex'));
    if (hashes[0] !== hashes[1]) {
      return { path: null, error: `Inconsistent worker skill content between .agents/skills and .claude/skills: ${skillName}` };
    }
  }
  return { path: candidates[0].path, error: null, missing: false };
}

function dangerousLegacyKey(value, path = '$') {
  if (!isObject(value) && !Array.isArray(value)) return null;
  for (const key of Object.keys(value)) {
    const next = `${path}.${key}`;
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return next;
    const nested = dangerousLegacyKey(value[key], next);
    if (nested) return nested;
  }
  return null;
}

function legacyShapeError(data) {
  if (!isObject(data)) return 'Invalid legacy profile shape: root must be an object';
  const dangerous = dangerousLegacyKey(data);
  if (dangerous) return `Invalid legacy profile: dangerous prototype key at ${dangerous}`;
  for (const top of ['workflows', 'workers']) {
    if (!own(data, top)) continue;
    if (!isObject(data[top])) return `Invalid legacy ${top} shape: expected object`;
    for (const [intent, domains] of Object.entries(data[top])) {
      if (!isObject(domains)) return `Invalid legacy ${top}.${intent} shape: expected object`;
      for (const [domain, value] of Object.entries(domains)) {
        if (top === 'workers' && typeof value !== 'string') {
          return `Invalid legacy workers.${intent}.${domain} shape: expected skill string`;
        }
        if (top === 'workflows') {
          if (!isObject(value)) return `Invalid legacy workflows.${intent}.${domain} shape: expected object`;
          for (const key of ['checklists', 'validators', 'templates']) {
            if (own(value, key) && (!Array.isArray(value[key]) || value[key].some(item => typeof item !== 'string'))) {
              return `Invalid legacy workflows.${intent}.${domain}.${key} shape: expected string array`;
            }
          }
        }
      }
    }
  }
  return null;
}

function normalizeLegacy(data) {
  const workflows = Object.create(null);
  for (const [intent, domains] of Object.entries(data.workflows ?? {})) {
    workflows[intent] = Object.create(null);
    for (const [domain, config] of Object.entries(domains)) workflows[intent][domain] = { ...config };
  }
  for (const [intent, domains] of Object.entries(data.workers ?? {})) {
    workflows[intent] ??= Object.create(null);
    for (const [domain, skill] of Object.entries(domains)) {
      workflows[intent][domain] ??= {};
      workflows[intent][domain].worker = { skill };
    }
  }
  return { schema_version: 1, project: { id: 'legacy', language: 'legacy' }, workflows };
}

async function loadYaml(path) {
  try {
    const data = parseMinimalYaml(await readFile(path, 'utf8'));
    const result = validateAgainstSchema(data, loadSchema());
    return result.valid
      ? { path, data, format: 'yaml', deprecated: false, error: null }
      : { path, data: null, format: 'yaml', deprecated: false, error: `Schema validation failed: ${result.errors.join('; ')}` };
  } catch (error) {
    return { path, data: null, format: 'yaml', deprecated: false, error: `Failed to load YAML profile: ${error.message}` };
  }
}

function loadLegacy(path) {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const error = legacyShapeError(raw);
    if (error) return { path, data: null, format: 'json', deprecated: true, error };
    return { path, data: normalizeLegacy(raw), format: 'json', deprecated: true, error: null };
  } catch (error) {
    return { path, data: null, format: 'json', deprecated: true, error: `Invalid legacy profile JSON: ${error.message}` };
  }
}

function profileFailure(path, error) {
  return { path, data: null, format: null, deprecated: false, error, diagnostics: [error] };
}

export async function loadProfile({ root, profilePath }) {
  const projectRoot = resolve(root);
  const candidates = profilePath
    ? [{ path: profilePath, explicit: true }]
    : [{ path: YAML_PROFILE, explicit: false }, { path: LEGACY_JSON, explicit: false }];
  for (const candidate of candidates) {
    const surface = isAbsolute(candidate.path) ? resolve(candidate.path) : resolve(projectRoot, candidate.path);
    if (!candidate.explicit && !lstatOrNull(surface)) continue;
    const safety = validateProfilePathSafety(candidate.path, projectRoot);
    if (!safety.safe) return profileFailure(surface, safety.error);
    if (!existsSync(safety.resolved)) {
      return profileFailure(safety.resolved, `Explicit profile not found: ${safety.resolved}`);
    }
    const result = ['.yaml', '.yml'].includes(extname(safety.resolved).toLowerCase())
      ? await loadYaml(safety.resolved)
      : loadLegacy(safety.resolved);
    const diagnostics = [];
    if (result.deprecated) diagnostics.push('Legacy .artifact-review.json format is deprecated and will be removed in 0.6.0; migrate to artifact-profiles/project.yaml');
    if (result.error) diagnostics.push(result.error);
    return { ...result, diagnostics };
  }
  return { path: null, data: null, format: null, deprecated: false, error: null, diagnostics: [] };
}

export function resolveExecutionMode(profile, intent, domain) {
  return profile?.workflows?.[intent]?.[domain]?.worker?.skill ? 'project-worker' : 'public-worker';
}

function publicSkillPath(intent, domain) {
  const skillsRoot = existsSync(join(PLUGIN_ROOT, 'skills-src')) ? join(PLUGIN_ROOT, 'skills-src') : join(PLUGIN_ROOT, 'skills');
  let skill = 'artifact-workflow-worker';
  if (intent === 'audit') {
    skill = 'artifact-audit';
  } else if (intent === 'batch') {
    skill = 'artifact-batch';
  } else if (domain === 'prd-feature' || domain === 'scenario-script') {
    const leaf = intent === 'generate' ? 'author' : intent;
    if (['author', 'review', 'repair'].includes(leaf)) skill = join(domain, leaf);
  }
  const path = join(skillsRoot, skill, 'SKILL.md');
  try {
    if (!statSync(path).isFile()) return { path: null, error: `Public worker is not a regular file: ${path}` };
    readFileSync(path);
    return { path, error: null };
  } catch (error) {
    return { path: null, error: `Cannot read public worker: ${path}: ${error.message}` };
  }
}

function runValidators(paths, { root, intent, domain, target }) {
  const results = [];
  const diagnostics = [];
  const exitCodes = [];
  for (const path of paths) {
    if (!['.mjs', '.js', '.cjs'].includes(extname(path).toLowerCase())) {
      diagnostics.push(`Invalid validator extension: ${path}`);
      results.push({ path, command: `${process.execPath} ${path}`, exit_code: null, stdout: '', stderr: 'Unsupported validator extension' });
      continue;
    }
    const command = `${process.execPath} ${path}${target ? ` ${target}` : ''}`;
    const child = spawnSync(process.execPath, [path, target].filter(Boolean), {
      cwd: root,
      encoding: 'utf8',
      timeout: VALIDATOR_TIMEOUT_MS,
      env: {
        ...process.env,
        ARTIFACT_WORKFLOW_INTENT: intent,
        ARTIFACT_WORKFLOW_DOMAIN: domain ?? '',
        ARTIFACT_WORKFLOW_ROOT: root,
        ARTIFACT_WORKFLOW_TARGET: target ?? '',
      },
    });
    const exitCode = Number.isInteger(child.status) ? child.status : null;
    exitCodes.push(exitCode);
    results.push({
      path,
      command,
      exit_code: exitCode,
      stdout: child.stdout ?? '',
      stderr: child.stderr ?? '',
      ...(child.signal ? { signal: child.signal } : {}),
    });
    if (child.error) diagnostics.push(`Validator cannot start or timed out: ${path}: ${child.error.message}`);
    else if (child.signal) diagnostics.push(`Validator terminated by signal ${child.signal}: ${path}`);
    else if (exitCode === 2) diagnostics.push(`Validator needs input: ${path}: exit 2`);
    else if (exitCode !== 0) diagnostics.push(`Validator exited ${String(exitCode)}: ${path}`);
  }
  return { results, diagnostics, exitCodes };
}

function fixedOutput({ status, profile, executionMode, workerPath, checklistPaths, validators, templatePaths, diagnostics }) {
  return {
    status,
    schema: profile?.format === 'yaml' ? 'artifact-workflow-profile' : profile?.format === 'json' ? 'legacy-artifact-review' : null,
    profile_path: profile?.path ?? null,
    execution_mode: executionMode,
    worker_path: workerPath,
    checklist_paths: checklistPaths,
    validators,
    template_paths: templatePaths,
    diagnostics,
    next: status === 'OK'
      ? 'Invoke the resolved workflow.'
      : status === 'BLOCKED'
        ? 'Fix blocked profile, worker, resource, or validator failures and run this check again.'
        : 'Add the missing project markers, profile mapping, or resource and run this check again.',
  };
}

/** The single readiness resolver used by source and both adapters. */
export async function buildCheckerOutput({ root, profilePath, intent = 'review', domain, runValidatorCommands = true, target }) {
  const projectRoot = resolve(root);
  if (!VALID_ACTIONS.has(intent)) {
    return fixedOutput({
      status: 'BLOCKED', profile: null, executionMode: null, workerPath: null,
      checklistPaths: [], validators: [], templatePaths: [],
      diagnostics: [`Unsupported action: ${String(intent)}`],
    });
  }
  if (typeof domain !== 'string' || !VALID_DOMAIN.test(domain)) {
    return fixedOutput({
      status: 'BLOCKED', profile: null, executionMode: null, workerPath: null,
      checklistPaths: [], validators: [], templatePaths: [],
      diagnostics: [`Invalid or missing domain: ${String(domain)}`],
    });
  }
  const executionRoot = realpathOrResolved(root);
  const warnings = [];
  const problems = [];
  const hasConfig = existsSync(join(projectRoot, 'artifact-graph.config.yaml'));
  const hasArtifacts = existsSync(join(projectRoot, 'artifacts')) && statSync(join(projectRoot, 'artifacts')).isDirectory();
  if (!hasConfig && !hasArtifacts) problems.push('Missing artifact-graph.config.yaml and artifacts/');

  const profile = await loadProfile({ root: projectRoot, profilePath });
  if (profile.deprecated) warnings.push(...profile.diagnostics.filter(item => /deprecated/i.test(item)));
  if (profile.error) problems.push(profile.error);

  const noProfileAudit = intent === 'audit' && PUBLIC_AUDIT_DOMAINS.has(domain);
  if (noProfileAudit && (!hasConfig || !hasArtifacts)) problems.push('Audit health/capability requires artifact-graph.config.yaml and artifacts/');
  const domainConfig = profile.data?.workflows?.[intent]?.[domain];
  if (!profile.data && !noProfileAudit && !profile.error) problems.push('No workflow profile found; create artifact-profiles/project.yaml');
  if (profile.data && !domainConfig && !noProfileAudit) problems.push(`Missing workflows.${intent}.${domain ?? '(missing)'} profile mapping`);
  if (intent === 'audit' && domain === 'release-gate' && !domainConfig) {
    problems.push('Audit release-gate requires workflows.audit.release-gate configuration');
  }

  let executionMode = null;
  let workerPath = null;
  let checklistPaths = [];
  let templatePaths = [];
  let validators = [];
  let needsInputExit = false;

  if (domainConfig || noProfileAudit) {
    executionMode = domainConfig?.worker?.skill ? 'project-worker' : 'public-worker';
    if (executionMode === 'project-worker') {
      const skill = domainConfig.worker.skill;
      const name = validateSkillName(skill, profile.data.project.id, { legacy: profile.format === 'json' });
      if (!name.valid) problems.push(name.error);
      else {
        const worker = resolveWorkerPath(projectRoot, skill);
        if (worker.error) problems.push(worker.error);
        else workerPath = worker.path;
      }
    } else {
      const worker = publicSkillPath(intent, domain);
      if (worker.error) problems.push(worker.error);
      else workerPath = worker.path;
    }

    if (domainConfig) {
      const checklistCount = domainConfig.checklists?.length ?? 0;
      const templateCount = domainConfig.templates?.length ?? 0;
      const validatorCount = domainConfig.validators?.length ?? 0;
      const resources = [
        ...(domainConfig.checklists ?? []),
        ...(domainConfig.templates ?? []),
        ...(domainConfig.validators ?? []),
      ];
      const checked = validateResourcePaths(resources, projectRoot);
      problems.push(...checked.errors);
      checklistPaths = checked.details.slice(0, checklistCount).flatMap(item => item.resolved ? [item.resolved] : []);
      templatePaths = checked.details.slice(checklistCount, checklistCount + templateCount).flatMap(item => item.resolved ? [item.resolved] : []);
      const validatorPaths = checked.details.slice(checklistCount + templateCount, checklistCount + templateCount + validatorCount).flatMap(item => item.resolved ? [item.resolved] : []);

      const needsProfileResources = executionMode === 'public-worker' || profile.format !== 'json';
      if (needsProfileResources && ['review', 'repair'].includes(intent) && checklistPaths.length === 0) {
        problems.push('Review/repair requires at least one checklist');
      }
      if (needsProfileResources && intent === 'generate' && templatePaths.length === 0) {
        problems.push('Generate requires at least one template');
      }
      if (executionMode === 'public-worker' && intent === 'audit' && domain === 'release-gate'
        && checklistPaths.length === 0 && validatorPaths.length === 0) {
        problems.push('Audit release-gate public worker requires at least one checklist or validator');
      }
      if (runValidatorCommands) {
        const validatorRun = runValidators(validatorPaths, { root: executionRoot, intent, domain, target });
        validators = validatorRun.results;
        problems.push(...validatorRun.diagnostics);
        needsInputExit = validatorRun.exitCodes.some(code => code === 2);
      } else {
        validators = validatorPaths.map(path => ({
          path,
          command: `${process.execPath} ${path}`,
          exit_code: null,
          stdout: '',
          stderr: '',
        }));
      }
    }
  }

  // @feature ACA17
  // @decision D-ACA-17
  // BLOCKED issues (non-0/2 exit, signal, timeout, security, path) always override exit 2 (NEEDS_INPUT).
  const isBlocked = problems.some(item => BLOCKED_PATTERN.test(item));
  const status = problems.length === 0 ? 'OK' : isBlocked ? 'BLOCKED' : needsInputExit ? 'NEEDS_INPUT' : 'NEEDS_INPUT';
  return fixedOutput({
    status,
    profile,
    executionMode,
    workerPath,
    checklistPaths,
    validators,
    templatePaths,
    diagnostics: [...warnings, ...problems],
  });
}
