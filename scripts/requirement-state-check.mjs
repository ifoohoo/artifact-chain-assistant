#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const STATUSES = ['captured', 'proposed', 'approved', 'implemented', 'verified', 'released'];
const EVIDENCE_REQUIRED = new Set(['implemented', 'verified', 'released']);

function usage() {
  return 'Usage: node requirement-state-check.mjs <entry-path> [--from <status>] [--to <status>] [--evidence <path|ref>] [--format json|text]';
}

export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) return null;
  const values = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/u);
    if (field) values[field[1]] = field[2].replace(/^['"]|['"]$/gu, '');
  }
  return values;
}

export function checkRequirementState({ markdown, from, to, evidence } = {}) {
  const diagnostics = [];
  const frontmatter = parseFrontmatter(markdown ?? '');
  const current = frontmatter?.status;
  if (!frontmatter) diagnostics.push('需求条目缺少 YAML frontmatter。');
  if (!STATUSES.includes(current)) diagnostics.push(`当前 status 不在允许词表中：${current ?? '(missing)'}`);
  if (from && !STATUSES.includes(from)) diagnostics.push(`--from 不在允许词表中：${from}`);
  if (to && !STATUSES.includes(to)) diagnostics.push(`--to 不在允许词表中：${to}`);
  if (from && current && from !== current) diagnostics.push(`条目当前状态为 ${current}，与 --from ${from} 不一致。`);

  if (to && EVIDENCE_REQUIRED.has(to) && !evidence?.trim()) {
    diagnostics.push(`记录 ${to} 事实必须提供非空证据引用。`);
  }

  return {
    status: diagnostics.length === 0 ? 'OK' : 'BLOCKED',
    current_status: current ?? null,
    requested_transition: to ? { from: from ?? current ?? null, to } : null,
    evidence: evidence ?? null,
    evidence_assessment: evidence?.trim() ? 'reference-present-unverified' : 'not-provided',
    note: '本检查只校验字段和引用是否齐全；调用技能必须读取实际对象、版本与结果，独立判断事实是否成立。',
    diagnostics,
  };
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const args = { entry: null, format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('-') && args.entry === null) {
      args.entry = item;
      continue;
    }
    if (!['--from', '--to', '--evidence', '--format'].includes(item) || index + 1 >= argv.length) {
      throw new Error(`未知、重复或缺少值的参数：${item}`);
    }
    const key = item.slice(2);
    if (args[key] !== undefined && key !== 'format') throw new Error(`参数重复：${item}`);
    args[key] = argv[++index];
  }
  if (!args.entry) throw new Error('缺少需求条目路径。');
  if (!['json', 'text'].includes(args.format)) throw new Error('--format 必须是 json 或 text。');
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const entryPath = isAbsolute(args.entry) ? args.entry : resolve(process.cwd(), args.entry);
  const markdown = await readFile(entryPath, 'utf8');
  const result = { entry_path: entryPath, ...checkRequirementState({ markdown, from: args.from, to: args.to, evidence: args.evidence }) };
  if (args.format === 'text') {
    console.log(`${result.status}: ${result.current_status ?? '(missing)'}${args.to ? ` -> ${args.to}` : ''}`);
    for (const diagnostic of result.diagnostics) console.log(`- ${diagnostic}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  return result.status === 'OK' ? 0 : 2;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  }).catch(error => {
    console.error(`BLOCKED: ${error.message}`);
    process.exitCode = 2;
  });
}
