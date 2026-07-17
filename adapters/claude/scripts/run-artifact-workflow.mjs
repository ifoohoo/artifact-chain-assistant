#!/usr/bin/env node
// @feature ACA17
// @scenario S-52
// Deterministic public-worker executor and Review Result protocol finalizer.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { inspectArtifactGraphRuntime } from './lib/artifact-graph-runtime.mjs';
import { buildCheckerOutput } from './lib/workflow-profile.mjs';

const INTENTS = new Set(['review', 'repair', 'generate']);
const TASK_FIELDS = ['intent', 'domain', 'target_path', 'run_dir', 'profile_resolution', 'input_result'];

function contained(root, target) {
  const value = relative(root, target);
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value;
}

function resolveInside(root, value, label) {
  const surface = isAbsolute(value) ? resolve(value) : resolve(root, value);
  let ancestor = surface;
  const suffix = [];
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error(`${label} has no resolvable project ancestor`);
    suffix.unshift(basename(ancestor));
    ancestor = parent;
  }
  const path = resolve(realpathSync(ancestor), ...suffix);
  if (!contained(root, path)) throw new Error(`${label} escapes project root through a symlink`);
  return path;
}

function readableFile(path, root, label) {
  const real = realpathSync(path);
  if (!contained(root, real) || !statSync(real).isFile()) throw new Error(`${label} is not a safe regular file: ${path}`);
  return real;
}

function validateTask(input) {
  const task = assertObject(input, 'Task must be an object');
  for (const field of TASK_FIELDS) {
    if (!Object.hasOwn(task, field)) throw new Error(`Task missing field: ${field}`);
  }
  if (!INTENTS.has(task.intent)) throw new Error(`Unsupported public-worker intent: ${String(task.intent)}`);
  if (typeof task.domain !== 'string' || task.domain.length === 0) throw new Error('Task domain is required');
  if (typeof task.target_path !== 'string' || typeof task.run_dir !== 'string') throw new Error('Task paths must be strings');
  const profile = assertObject(task.profile_resolution, 'profile_resolution must be an object');
  if (profile.status !== 'OK' || profile.execution_mode !== 'public-worker' || typeof profile.worker_path !== 'string') {
    throw new Error('Public worker requires an OK public-worker profile resolution and worker_path');
  }
  return task;
}

function projectRoot(profile) {
  if (typeof profile.profile_path !== 'string') throw new Error('profile_path is required');
  return realpathSync(resolve(dirname(profile.profile_path), '..'));
}

function scriptProducer() {
  return { executor: 'script', name: 'run-artifact-workflow.mjs', skill: 'artifact-workflow-worker' };
}

function baseResult(task, status, decision, summary) {
  return {
    schema_version: '1.0',
    run_id: `public-${task.intent}-${basename(task.run_dir) || 'run'}`,
    status,
    decision,
    summary,
    producer: scriptProducer(),
  };
}

function blockedResult(task, reason, evidence = []) {
  return {
    ...baseResult(task, 'BLOCKED', 'BLOCKED', 'Public workflow was blocked before committing target changes.'),
    blocking_reason: reason,
    evidence,
  };
}

function canonicalExisting(value) {
  try {
    return realpathSync(String(value));
  } catch {
    return null;
  }
}

function samePaths(claimed, actual) {
  if (!Array.isArray(claimed) || claimed.length !== actual.length) return false;
  return claimed.every((value, index) => canonicalExisting(value) === canonicalExisting(actual[index]));
}

async function verifyProvenance(task, root) {
  const current = await buildCheckerOutput({
    root,
    intent: task.intent,
    domain: task.domain,
    runValidatorCommands: false,
  });
  const claimed = task.profile_resolution;
  const problems = [];
  if (current.status !== 'OK' || current.execution_mode !== 'public-worker') {
    problems.push(`current checker status is ${current.status}/${current.execution_mode ?? 'none'}`);
    problems.push(...current.diagnostics);
  }
  if (canonicalExisting(claimed.profile_path) !== canonicalExisting(current.profile_path)) problems.push('profile_path does not match the current canonical profile');
  if (canonicalExisting(claimed.worker_path) !== canonicalExisting(current.worker_path)) problems.push('worker_path does not match the current public worker');
  if (!samePaths(claimed.checklist_paths, current.checklist_paths)) problems.push('checklist resources do not match the current profile');
  if (!samePaths(claimed.template_paths, current.template_paths)) problems.push('template resources do not match the current profile');
  const claimedValidators = Array.isArray(claimed.validators) ? claimed.validators.map(item => item?.path) : null;
  const currentValidators = current.validators.map(item => item.path);
  if (!samePaths(claimedValidators, currentValidators)) problems.push('validator resources do not match the current profile');
  return { ok: problems.length === 0, problems, current };
}

function runOfficialValidator(value, { cliPath, root, runDir, label, retain = false }) {
  const path = join(runDir, `${label}-${randomUUID()}.json`);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  const child = spawnSync(cliPath, [
    'validate-review-result', '--root', root, '--file', path, '--format', 'json',
  ], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  const exitCode = Number.isInteger(child.status) ? child.status : null;
  const evidence = {
    type: 'semantic-validator',
    path,
    command: `${cliPath} validate-review-result --file ${path} --format json`,
    result: `exit=${String(exitCode)}\nstdout=${child.stdout ?? ''}\nstderr=${child.stderr ?? ''}`,
  };
  if (!retain) rmSync(path, { force: true });
  return { valid: !child.error && !child.signal && exitCode === 0, evidence };
}

function writeValidatedResult(result, context) {
  const validation = runOfficialValidator(result, { ...context, label: 'final-result' });
  if (!validation.valid) throw new Error(`Runner produced an invalid Review Result: ${validation.evidence.result}`);
  writeFileSync(join(context.runDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function executeValidators(entries, { root, target, task }) {
  const evidence = [];
  let ok = true;
  for (const entry of entries) {
    const path = readableFile(String(entry.path), root, 'validator');
    const child = spawnSync(process.execPath, [path, target], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        ARTIFACT_WORKFLOW_INTENT: task.intent,
        ARTIFACT_WORKFLOW_DOMAIN: task.domain,
        ARTIFACT_WORKFLOW_ROOT: root,
        ARTIFACT_WORKFLOW_TARGET: target,
      },
    });
    const exitCode = Number.isInteger(child.status) ? child.status : null;
    evidence.push({
      type: 'validator',
      path,
      command: `${process.execPath} ${path} ${target}`,
      result: `exit=${String(exitCode)}\nstdout=${child.stdout ?? ''}\nstderr=${child.stderr ?? ''}${child.signal ? `\nsignal=${child.signal}` : ''}${child.error ? `\nerror=${child.error.message}` : ''}`,
    });
    if (child.error || child.signal || exitCode !== 0) ok = false;
  }
  return { ok, evidence };
}

function checklistEvidence(paths, root) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error('Review/repair requires a checklist');
  return paths.map(value => {
    const path = readableFile(String(value), root, 'checklist');
    readFileSync(path, 'utf8');
    return { type: 'checklist', path, result: 'available to the semantic reviewer' };
  });
}

function makeStage(target, task) {
  mkdirSync(dirname(target), { recursive: true });
  const directory = join(dirname(target), `.artifact-workflow-${task.intent}-${randomUUID()}`);
  mkdirSync(directory, { recursive: false });
  return { directory, candidate: join(directory, basename(target)) };
}

function removeStage(stage) {
  rmSync(stage.directory, { recursive: true, force: true });
}

function commitStage(stage, target) {
  renameSync(stage.candidate, target);
  removeStage(stage);
}

function runReview(task, context) {
  const { root, target, cliPath, runDir } = context;
  const targetFile = readableFile(target, root, 'target');
  const deterministic = executeValidators(task.profile_resolution.validators ?? [], { root, target: targetFile, task });
  const evidence = [
    { type: 'target', path: targetFile, result: 'review scope' },
    ...deterministic.evidence,
    ...checklistEvidence(task.profile_resolution.checklist_paths, root),
  ];
  if (!deterministic.ok) return blockedResult(task, 'A deterministic validator failed.', evidence);
  if (task.input_result === null || task.input_result === undefined) {
    return {
      ...baseResult(task, 'NEEDS_INPUT', 'NEEDS_INPUT', 'An independent semantic Review Result is required; deterministic checklist access is not semantic review.'),
      blocking_reason: 'No semantic Review Result was supplied.',
      evidence,
    };
  }
  const source = assertObject(task.input_result, 'Review input_result must be an object');
  const validation = runOfficialValidator(source, { cliPath, root, runDir, label: 'semantic-review', retain: true });
  if (!validation.valid) return blockedResult(task, 'The supplied semantic Review Result failed the official validator.', [...evidence, validation.evidence]);
  if (!source.review || !Array.isArray(source.review.findings)) {
    return blockedResult(task, 'The supplied result is not a semantic review result with review.findings.', [...evidence, validation.evidence]);
  }
  return {
    ...source,
    review: {
      ...source.review,
      source_files: Array.from(new Set([...(source.review.source_files ?? []), targetFile])),
    },
    evidence: [...(source.evidence ?? []), ...evidence, validation.evidence],
  };
}

function runGenerate(task, context) {
  const { root, target } = context;
  const templates = task.profile_resolution.template_paths ?? [];
  if (!Array.isArray(templates) || templates.length === 0) throw new Error('Generate requires a template');
  const template = readableFile(String(templates[0]), root, 'template');
  const stage = makeStage(target, task);
  try {
    writeFileSync(stage.candidate, readFileSync(template));
    const deterministic = executeValidators(task.profile_resolution.validators ?? [], { root, target: stage.candidate, task });
    const evidence = [{ type: 'template', path: template, result: 'rendered to transaction candidate' }, ...deterministic.evidence];
    if (!deterministic.ok) return blockedResult(task, 'A validator rejected the generated transaction candidate.', evidence);
    const result = {
      ...baseResult(task, 'SUCCEEDED', 'NOT_APPLICABLE', 'Target generated transactionally and validated; independent review is still required.'),
      outputs: [target],
      evidence,
    };
    const validation = runOfficialValidator(result, { ...context, label: 'candidate-result' });
    if (!validation.valid) return blockedResult(task, 'Generated result failed official Review Result validation.', [...evidence, validation.evidence]);
    commitStage(stage, target);
    return result;
  } finally {
    if (existsSync(stage.directory)) removeStage(stage);
  }
}

function runRepair(task, context) {
  const { root, target, cliPath, runDir } = context;
  const source = assertObject(task.input_result, 'Repair requires a source Review Result');
  const sourceValidation = runOfficialValidator(source, { cliPath, root, runDir, label: 'repair-source', retain: true });
  if (!sourceValidation.valid) return blockedResult(task, 'Repair source failed the official Review Result validator.', [sourceValidation.evidence]);
  const findings = Array.isArray(source.review?.findings) ? source.review.findings : [];
  const openFindings = findings.filter(finding => finding?.status === undefined || finding.status === 'open');
  if (openFindings.length === 0) {
    return {
      ...baseResult(task, 'SKIPPED', 'NOT_APPLICABLE', 'NOOP: the source review contains no open findings.'),
      repair: {
        source_review_run_id: source.run_id,
        ...(typeof source.stage_id === 'string' ? { source_review_stage_id: source.stage_id } : {}),
        findings_addressed: [],
        files_modified: [],
      },
      evidence: [sourceValidation.evidence],
    };
  }
  const targetFile = readableFile(target, root, 'target');
  const lines = readFileSync(targetFile, 'utf8').split('\n');
  const addressed = [];
  for (const findingValue of openFindings) {
    const finding = assertObject(findingValue, 'Finding must be an object');
    const location = assertObject(finding.location, 'Repairable finding requires location');
    const findingPath = resolveInside(root, String(location.file), 'finding location');
    const line = Number(location.line);
    if (findingPath !== targetFile || !Number.isInteger(line) || line < 1 || line > lines.length || typeof finding.suggested_fix !== 'string') {
      return blockedResult(task, `Finding ${String(finding.id)} is outside the bounded line-repair contract.`, [sourceValidation.evidence]);
    }
    lines[line - 1] = finding.suggested_fix;
    addressed.push({ ...finding, status: 'resolved', resolved_by: 'artifact-workflow-worker bounded line repair' });
  }
  const stage = makeStage(targetFile, task);
  try {
    writeFileSync(stage.candidate, lines.join('\n'));
    const deterministic = executeValidators(task.profile_resolution.validators ?? [], { root, target: stage.candidate, task });
    const evidence = [sourceValidation.evidence, ...deterministic.evidence];
    if (!deterministic.ok) return blockedResult(task, 'A validator rejected the repair transaction candidate.', evidence);
    const result = {
      ...baseResult(task, 'SUCCEEDED', 'NOT_APPLICABLE', 'Bounded repair completed transactionally; independent re-review is required.'),
      repair: {
        source_review_run_id: source.run_id,
        ...(typeof source.stage_id === 'string' ? { source_review_stage_id: source.stage_id } : {}),
        findings_addressed: addressed,
        files_modified: [targetFile],
        validation_after_repair: { command: 'profile validators on transaction candidate', exit_code: 0, findings_remaining: 0 },
      },
      evidence,
    };
    const validation = runOfficialValidator(result, { ...context, label: 'candidate-result' });
    if (!validation.valid) return blockedResult(task, 'Repair result failed official Review Result validation.', [...evidence, validation.evidence]);
    commitStage(stage, targetFile);
    return result;
  } finally {
    if (existsSync(stage.directory)) removeStage(stage);
  }
}

export async function runArtifactWorkflow(input) {
  const task = validateTask(input);
  const root = projectRoot(task.profile_resolution);
  const target = resolveInside(root, task.target_path, 'target_path');
  const runDir = resolveInside(root, task.run_dir, 'run_dir');
  mkdirSync(runDir, { recursive: true });
  const runtime = await inspectArtifactGraphRuntime({ projectRoot: root });
  if (!runtime.ok) {
    const result = blockedResult(task, `Official artifact-graph Review Result validator unavailable: ${runtime.remediation ?? runtime.reason}`);
    writeFileSync(join(runDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
  const context = { root, target, runDir, cliPath: runtime.cliPath };
  const provenance = await verifyProvenance(task, root);
  if (!provenance.ok) {
    return writeValidatedResult(blockedResult(task, `Profile provenance mismatch: ${provenance.problems.join('; ')}`), context);
  }
  let result;
  try {
    result = task.intent === 'review'
      ? runReview(task, context)
      : task.intent === 'generate'
        ? runGenerate(task, context)
        : runRepair(task, context);
  } catch (error) {
    result = blockedResult(task, error.message);
  }
  return writeValidatedResult(result, context);
}

async function main(argv) {
  const taskIndex = argv.indexOf('--task');
  if (taskIndex < 0 || !argv[taskIndex + 1]) throw new Error('Usage: run-artifact-workflow.mjs --task <task.json>');
  const task = JSON.parse(readFileSync(resolve(argv[taskIndex + 1]), 'utf8'));
  process.stdout.write(`${JSON.stringify(await runArtifactWorkflow(task), null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
