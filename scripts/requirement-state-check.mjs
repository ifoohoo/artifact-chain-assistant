#!/usr/bin/env node
// @feature ACA24 @scenario S-99
import { realpathSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUSES = ['captured', 'proposed', 'approved', 'implemented', 'verified', 'released'];
export const DISPOSITIONS = ['retained', 'deferred', 'merged', 'abandoned', 'unknown'];
export const SATISFACTION_LEVELS = ['unknown', 'not_met', 'partly_met', 'met'];

const EVIDENCE_REQUIRED = new Set(['implemented', 'verified', 'released']);
const EMPTY_REFS = new Set(['', 'none', 'null', '-', '[]']);

function usage() {
  return [
    'Usage:',
    '  node requirement-state-check.mjs <entry-path> [--from <status>] [--to <status>] [--evidence <path|ref>]',
    '      [--disposition <retained|deferred|merged|abandoned|unknown>]',
    '      [--satisfaction <unknown|not_met|partly_met|met>] [--coverage <unknown|not_met|partly_met|met>]',
    '      [--merged-into <requirement-id>] [--format json|text]',
    '  node requirement-state-check.mjs --summary <requirements-dir-or-file> [--format json|text]',
  ].join('\n');
}

export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) return null;
  const values = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/u);
    if (field) values[field[1]] = field[2].replace(/^['"]|['"]$/gu, '');
  }
  return values;
}

export function parseDispositionSection(markdown) {
  const sectionMatch = /^##\s+处置与承接\s*\r?\n/mu.exec(markdown);
  if (!sectionMatch) return {};
  const body = markdown.slice(sectionMatch.index + sectionMatch[0].length);
  const nextHeading = body.search(/^##\s+/mu);
  const block = nextHeading === -1 ? body : body.slice(0, nextHeading);
  const values = {};
  for (const line of block.split(/\r?\n/u)) {
    const bullet = line.match(/^\s*-\s*([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/u);
    if (bullet) {
      values[bullet[1]] = bullet[2].replace(/^['"]|['"]$/gu, '');
    }
  }
  return values;
}

function cleanScalar(raw) {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || /^<[^>]+>$/u.test(trimmed)) return undefined;
  return trimmed;
}

function cleanRef(raw) {
  const scalar = cleanScalar(raw);
  if (!scalar) return null;
  const unwrapped = scalar.replace(/^\[(.*)\]$/u, '$1').trim().replace(/^['"]|['"]$/gu, '');
  if (EMPTY_REFS.has(unwrapped.toLowerCase()) || /^<[^>]+>$/u.test(unwrapped)) return null;
  return unwrapped;
}

export function checkRequirementState({
  markdown,
  from,
  to,
  evidence,
  disposition,
  satisfaction,
  coverage,
  mergedInto,
} = {}) {
  const diagnostics = [];
  const frontmatter = parseFrontmatter(markdown ?? '');
  const section = parseDispositionSection(markdown ?? '');
  const current = frontmatter?.status;

  if (!frontmatter) diagnostics.push('需求条目缺少 YAML frontmatter，请先按标准模板补齐头部元数据。');
  if (!STATUSES.includes(current)) {
    diagnostics.push(`当前 status 不在允许词表中：${current ?? '(missing)'}（允许值：${STATUSES.join(', ')}）。`);
  }
  if (from && !STATUSES.includes(from)) {
    diagnostics.push(`--from 不在允许词表中：${from}（允许值：${STATUSES.join(', ')}）。`);
  }
  if (to && !STATUSES.includes(to)) {
    diagnostics.push(`--to 不在允许词表中：${to}（允许值：${STATUSES.join(', ')}）。`);
  }
  if (from && current && from !== current) {
    diagnostics.push(`条目当前状态为 ${current}，与 --from ${from} 不一致。`);
  }
  if (to && EVIDENCE_REQUIRED.has(to) && !evidence?.trim()) {
    diagnostics.push(`将状态推进到 ${to} 必须提供非空证据引用（--evidence）。`);
  }

  const fmDisp = cleanScalar(frontmatter?.disposition);
  const secDisp = cleanScalar(section.disposition);
  if (fmDisp && secDisp && fmDisp !== secDisp) {
    diagnostics.push(`frontmatter 中的 disposition (${fmDisp}) 与“处置与承接”小节 (${secDisp}) 不一致。`);
  }
  const effectiveDisposition = cleanScalar(disposition) ?? fmDisp ?? secDisp ?? 'unknown';
  if (!DISPOSITIONS.includes(effectiveDisposition)) {
    diagnostics.push(`disposition 不在允许词表中：${effectiveDisposition}（允许值：${DISPOSITIONS.join(', ')}）。`);
  }

  const fmSat = cleanScalar(frontmatter?.satisfaction);
  const secSat = cleanScalar(section.satisfaction);
  if (fmSat && secSat && fmSat !== secSat) {
    diagnostics.push(`frontmatter 中的 satisfaction (${fmSat}) 与“处置与承接”小节 (${secSat}) 不一致。`);
  }
  const fmCov = cleanScalar(frontmatter?.coverage);
  const secCov = cleanScalar(section.coverage);
  if (fmCov && secCov && fmCov !== secCov) {
    diagnostics.push(`frontmatter 中的 coverage (${fmCov}) 与“处置与承接”小节 (${secCov}) 不一致。`);
  }
  const resolvedSat = cleanScalar(satisfaction) ?? fmSat ?? secSat;
  const resolvedCov = cleanScalar(coverage) ?? fmCov ?? secCov;
  if (resolvedSat && resolvedCov && resolvedSat !== resolvedCov) {
    diagnostics.push(`目标满足程度冲突：satisfaction (${resolvedSat}) 与 coverage (${resolvedCov}) 不一致，请统一取值。`);
  }
  const effectiveSatisfaction = resolvedSat ?? resolvedCov ?? 'unknown';
  if (!SATISFACTION_LEVELS.includes(effectiveSatisfaction)) {
    diagnostics.push(`目标满足程度不在允许词表中：${effectiveSatisfaction}（允许值：${SATISFACTION_LEVELS.join(', ')}）。`);
  }

  const fmMerged = cleanRef(frontmatter?.merged_into);
  const secMerged = cleanRef(section.merged_into);
  if (fmMerged && secMerged && fmMerged !== secMerged) {
    diagnostics.push(`frontmatter 中的 merged_into (${fmMerged}) 与“处置与承接”小节 (${secMerged}) 不一致。`);
  }
  const effectiveMergedInto = cleanRef(mergedInto) ?? fmMerged ?? secMerged;
  const effectiveCarriedInto = cleanRef(frontmatter?.carried_into) ?? cleanRef(section.carried_into);
  const effectiveStatus = to ?? current ?? null;

  if (effectiveDisposition === 'merged' && !effectiveMergedInto) {
    diagnostics.push('语义矛盾：处置安排标为 merged（已合并），但未填写有效的合并去向 merged_into。');
  }
  if (effectiveMergedInto && frontmatter?.id && effectiveMergedInto === frontmatter.id) {
    diagnostics.push(`语义矛盾：merged_into 不能指向当前需求条目自身（${frontmatter.id}）。`);
  }
  if (effectiveMergedInto && DISPOSITIONS.includes(effectiveDisposition) && effectiveDisposition !== 'merged') {
    diagnostics.push(`语义矛盾：已填写合并去向 merged_into=${effectiveMergedInto}，但处置安排为 ${effectiveDisposition}（应改为 merged 或清空 merged_into）。`);
  }
  if (effectiveDisposition === 'abandoned' && effectiveSatisfaction === 'met') {
    diagnostics.push('语义矛盾：处置安排标为 abandoned（放弃不做），不能同时声称目标满足程度为 met（已满足）。');
  }
  if (effectiveDisposition === 'abandoned' && ['implemented', 'verified', 'released'].includes(effectiveStatus)) {
    diagnostics.push(`语义矛盾：处置安排标为 abandoned（放弃不做），不能同时声明交付状态为 ${effectiveStatus}。`);
  }
  if (effectiveSatisfaction === 'not_met' && ['verified', 'released'].includes(effectiveStatus)) {
    diagnostics.push(`语义矛盾：交付状态已标为 ${effectiveStatus}，不能同时将目标满足程度标为 not_met（未满足）。`);
  }

  return {
    status: diagnostics.length === 0 ? 'OK' : 'BLOCKED',
    current_status: current ?? null,
    disposition: effectiveDisposition,
    satisfaction: effectiveSatisfaction,
    coverage: effectiveSatisfaction,
    merged_into: effectiveMergedInto,
    carried_into: effectiveCarriedInto,
    requested_transition: to ? { from: from ?? current ?? null, to } : null,
    evidence: evidence ?? null,
    evidence_assessment: evidence?.trim() ? 'reference-present-unverified' : 'not-provided',
    note: '本检查只校验字段、双维状态词表与证据引用是否齐全自洽；调用技能必须读取实际对象、版本与结果，独立判断业务事实是否成立。',
    diagnostics,
  };
}

export function summarizeRequirementStates(items = []) {
  const byStatus = Object.fromEntries([...STATUSES, 'invalid'].map((key) => [key, 0]));
  const byDisposition = Object.fromEntries([...DISPOSITIONS, 'invalid'].map((key) => [key, 0]));
  const bySatisfaction = Object.fromEntries([...SATISFACTION_LEVELS, 'invalid'].map((key) => [key, 0]));
  const matrix = {};
  const entries = [];
  let okCount = 0;
  let blockedCount = 0;

  for (const raw of items) {
    const record = typeof raw === 'string' ? { markdown: raw } : (raw ?? {});
    const fm = parseFrontmatter(record.markdown ?? '');
    const checked = checkRequirementState({ markdown: record.markdown ?? '' });
    if (checked.status === 'OK') okCount += 1;
    else blockedCount += 1;

    const statusKey = STATUSES.includes(checked.current_status) ? checked.current_status : 'invalid';
    const dispKey = DISPOSITIONS.includes(checked.disposition) ? checked.disposition : 'invalid';
    const satKey = SATISFACTION_LEVELS.includes(checked.satisfaction) ? checked.satisfaction : 'invalid';
    byStatus[statusKey] += 1;
    byDisposition[dispKey] += 1;
    bySatisfaction[satKey] += 1;
    const cell = `${dispKey}:${satKey}`;
    matrix[cell] = (matrix[cell] ?? 0) + 1;

    entries.push({
      id: record.id ?? fm?.id ?? null,
      ...(record.path ? { entry_path: record.path } : {}),
      ...checked,
    });
  }

  return {
    status: blockedCount === 0 ? 'OK' : 'BLOCKED',
    total: entries.length,
    ok_count: okCount,
    blocked_count: blockedCount,
    by_status: byStatus,
    by_disposition: byDisposition,
    by_satisfaction: bySatisfaction,
    matrix,
    entries,
  };
}

const VALUE_FLAGS = new Set([
  '--from', '--to', '--evidence', '--disposition', '--satisfaction', '--coverage', '--merged-into', '--summary', '--format',
]);

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const args = { entry: null, format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('-') && args.entry === null) {
      args.entry = item;
      continue;
    }
    if (!VALUE_FLAGS.has(item) || index + 1 >= argv.length) {
      throw new Error(`未知或缺少参数值的选项：${item}（运行 --help 查看完整用法）`);
    }
    const key = item.slice(2).replace(/-([a-z])/gu, (_, ch) => ch.toUpperCase());
    if (args[key] !== undefined && key !== 'format') throw new Error(`重复指定的参数：${item}`);
    args[key] = argv[++index];
  }
  if (!args.entry && !args.summary) throw new Error('缺少需求条目路径或 --summary 目录路径。');
  if (!['json', 'text'].includes(args.format)) throw new Error('--format 必须是 json 或 text。');
  return args;
}

async function collectMarkdownEntries(targetPath) {
  const info = await stat(targetPath);
  if (info.isFile()) {
    return [{ path: targetPath, markdown: await readFile(targetPath, 'utf8') }];
  }
  const names = (await readdir(targetPath))
    .filter((name) => name.endsWith('.md') && !/^README(?:\..+)?\.md$/iu.test(name))
    .sort();
  const list = [];
  for (const name of names) {
    const filePath = join(targetPath, name);
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      list.push({ path: filePath, markdown: await readFile(filePath, 'utf8') });
    }
  }
  return list;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.summary) {
    const targetPath = isAbsolute(args.summary) ? args.summary : resolve(process.cwd(), args.summary);
    const items = await collectMarkdownEntries(targetPath);
    const summary = summarizeRequirementStates(items);
    if (args.format === 'text') {
      console.log(`${summary.status}: 共 ${summary.total} 条（通过 ${summary.ok_count}，阻断 ${summary.blocked_count}）`);
      for (const entry of summary.entries.filter((item) => item.status !== 'OK')) {
        console.log(`- [${entry.id ?? entry.entry_path}] ${entry.diagnostics.join('；')}`);
      }
    } else {
      console.log(JSON.stringify(summary, null, 2));
    }
    return summary.status === 'OK' ? 0 : 2;
  }

  const entryPath = isAbsolute(args.entry) ? args.entry : resolve(process.cwd(), args.entry);
  const markdown = await readFile(entryPath, 'utf8');
  const result = {
    entry_path: entryPath,
    ...checkRequirementState({
      markdown,
      from: args.from,
      to: args.to,
      evidence: args.evidence,
      disposition: args.disposition,
      satisfaction: args.satisfaction,
      coverage: args.coverage,
      mergedInto: args.mergedInto,
    }),
  };
  if (args.format === 'text') {
    console.log(`${result.status}: status=${result.current_status ?? '(missing)'}${args.to ? ` -> ${args.to}` : ''}, disposition=${result.disposition}, satisfaction=${result.satisfaction}`);
    for (const diagnostic of result.diagnostics) console.log(`- ${diagnostic}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  return result.status === 'OK' ? 0 : 2;
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`BLOCKED: ${error.message}`);
    process.exitCode = 2;
  });
}
