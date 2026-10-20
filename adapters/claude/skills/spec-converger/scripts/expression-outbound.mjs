#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// expression-outbound.mjs — style-guard 拟稿主流程的单次模型调用脚本。
// 纯 Node 内置模块。读稿件 → 调消费者配置的 OpenAI 兼容服务 → 把候选写到仓外路径 → 打印状态 JSON。
// 无接受权、无重试、无漂移检测、无风格判定。凭据值只从进程环境读取，禁止 CLI 传入。
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const skillRoot = resolve(dirname(thisFile), '..');

const ENV_ENDPOINT = 'SKILL_FAMILY_DOCS_ENDPOINT';
const ENV_MODEL = 'SKILL_FAMILY_DOCS_MODEL';
const ENV_CREDENTIAL_NAME = 'SKILL_FAMILY_DOCS_CREDENTIAL_ENV';
const DEFAULT_TIMEOUT_MS = 60_000;
const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CREDENTIAL_VALUE_FLAGS = new Set([
  '--api-key',
  '--api_key',
  '--apikey',
  '--authorization',
  '--auth',
  '--bearer',
  '--credential',
  '--key',
  '--password',
  '--secret',
  '--token',
]);

const STATUS = {
  CANDIDATE: 'candidate-produced',
  NOT_CONFIGURED: 'not-configured',
  FAILED: 'failed',
};

const REASON = {
  MISSING_CONFIG: 'missing-config',
  HTTP_STATUS: 'http-status',
  TIMEOUT: 'timeout',
  UNPARSEABLE: 'unparseable',
  TRUNCATED: 'truncated',
  EMPTY_BODY: 'empty-body',
  NON_TEXT: 'non-text',
  CONNECTION: 'connection',
  TLS: 'tls',
  CREDENTIAL_VIA_CLI: 'credential-via-cli',
  IN_REPO_OUTPUT: 'in-repo-output',
  INVALID_INPUT: 'invalid-input',
};

const USAGE = `用法: node scripts/expression-outbound.mjs --input <稿件> --output <仓外绝对路径> [--context <上下文>] [--endpoint <url>] [--model <id>] [--credential-env <环境变量名>] [--timeout-ms <毫秒>]
配置也可来自环境变量 ${ENV_ENDPOINT}、${ENV_MODEL}、${ENV_CREDENTIAL_NAME}（其值为存放凭据的环境变量名）。凭据值禁止作为命令行参数传入。`;

function result({ status, reasonClass = null, missing = null, httpStatus = null, outputPath = null }) {
  const payload = { status, reasonClass, httpStatus, outputPath };
  if (missing) payload.missing = missing;
  return payload;
}

function printStatus(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function printError(message) {
  process.stderr.write(`${message}\n`);
}

function exitCodeFor(payload) {
  if (payload.status === STATUS.CANDIDATE) return 0;
  if (payload.status === STATUS.NOT_CONFIGURED) return 2;
  if (payload.reasonClass === REASON.INVALID_INPUT || payload.reasonClass === REASON.CREDENTIAL_VIA_CLI
    || payload.reasonClass === REASON.IN_REPO_OUTPUT) {
    return 2;
  }
  return 1;
}

function fail(payload, message) {
  printStatus(payload);
  if (message) printError(message);
  return exitCodeFor(payload);
}

function parseArgs(argv) {
  const parsed = {
    input: null,
    output: null,
    context: null,
    endpoint: null,
    model: null,
    credentialEnv: null,
    timeoutMs: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    let name = token;
    let inline = null;
    if (token.startsWith('--') && token.includes('=')) {
      const eq = token.indexOf('=');
      name = token.slice(0, eq);
      inline = token.slice(eq + 1);
    }
    if (!name.startsWith('--')) {
      return { error: result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), message: '不接受位置参数。' };
    }
    if (CREDENTIAL_VALUE_FLAGS.has(name)) {
      return {
        error: result({ status: STATUS.FAILED, reasonClass: REASON.CREDENTIAL_VIA_CLI }),
        message: '凭据值禁止作为命令行参数传入。参数面只有环境变量名。',
      };
    }
    const take = () => {
      if (inline !== null) return inline;
      i += 1;
      if (i >= argv.length) return null;
      return argv[i];
    };
    switch (name) {
      case '--input':
        parsed.input = take();
        break;
      case '--output':
        parsed.output = take();
        break;
      case '--context':
        parsed.context = take();
        break;
      case '--endpoint':
        parsed.endpoint = take();
        break;
      case '--model':
        parsed.model = take();
        break;
      case '--credential-env':
        parsed.credentialEnv = take();
        break;
      case '--timeout-ms':
        parsed.timeoutMs = take();
        break;
      case '--help':
        parsed.help = true;
        break;
      default:
        return { error: result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), message: `未知参数: ${name}` };
    }
  }
  return { parsed };
}

function findGitRoot(start) {
  let dir = realpathSync(resolve(start));
  for (;;) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function isInside(child, parent) {
  if (!parent) return false;
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function readRegularFile(path, label) {
  if (!path) return { error: `${label} 缺失。` };
  const abs = resolve(path);
  try {
    const realAbs = realpathSync(abs);
    if (!statSync(realAbs).isFile()) return { error: `${label} 不存在或不是普通文件。` };
    return { abs, realAbs, text: readFileSync(realAbs, 'utf8') };
  } catch {
    return { error: `${label} 不存在、不是普通文件或无法读取。` };
  }
}

// 输出可以含尚未创建的目录；从最近现存父目录的真实路径推导实际写入位置。
function realOutputPath(outputAbs) {
  let parent = dirname(outputAbs);
  const pending = [basename(outputAbs)];
  while (!lstatSync(parent, { throwIfNoEntry: false })) {
    pending.unshift(basename(parent));
    const next = dirname(parent);
    if (next === parent) throw new Error('output-parent');
    parent = next;
  }
  if (!statSync(parent).isDirectory()) throw new Error('output-parent');
  return resolve(realpathSync(parent), ...pending);
}

function completionsUrl(endpoint) {
  const trimmed = String(endpoint).trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

function classifyFetchError(error) {
  const parts = [
    error?.name,
    error?.message,
    error?.code,
    error?.cause?.code,
    error?.cause?.name,
    error?.cause?.message,
  ].filter(Boolean).join(' ');
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || /aborted|timeout/i.test(parts)) {
    return REASON.TIMEOUT;
  }
  if (/CERT|UNABLE_TO_VERIFY|ERR_TLS|EPROTO|SSL|self[- ]signed|certificate/i.test(parts)) {
    return REASON.TLS;
  }
  return REASON.CONNECTION;
}

function extractCandidate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: REASON.UNPARSEABLE };
  }
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!choice || typeof choice !== 'object') return { error: REASON.UNPARSEABLE };
  const finish = choice.finish_reason ?? choice.finishReason ?? null;
  if (finish === 'length' || finish === 'max_tokens') return { error: REASON.TRUNCATED };
  const content = choice.message?.content;
  if (typeof content !== 'string') return { error: REASON.NON_TEXT };
  if (!content.trim()) return { error: REASON.EMPTY_BODY };
  return { text: content };
}

function resolveCredential(name) {
  if (!name) {
    return { missing: 'credential-env' };
  }
  if (!ENV_NAME_RE.test(name)) {
    return { invalidName: true };
  }
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    return { missing: 'credential-value' };
  }
  return { value };
}

async function main(argv) {
  const parsedArgs = parseArgs(argv);
  if (parsedArgs.error) return fail(parsedArgs.error, parsedArgs.message);
  const { parsed } = parsedArgs;
  if (parsed.help) {
    printError(USAGE);
    return 2;
  }
  if (!parsed.input || !parsed.output) {
    return fail(result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), USAGE);
  }

  const input = readRegularFile(parsed.input, '--input');
  if (input.error) {
    return fail(result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), input.error);
  }
  let contextText = '';
  if (parsed.context) {
    const context = readRegularFile(parsed.context, '--context');
    if (context.error) {
      return fail(result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), context.error);
    }
    contextText = context.text;
  }

  const outputAbs = resolve(parsed.output);
  if (!isAbsolute(parsed.output)) {
    return fail(
      result({ status: STATUS.FAILED, reasonClass: REASON.IN_REPO_OUTPUT }),
      '--output 必须是仓库外的绝对路径。',
    );
  }
  let outputReal;
  try {
    const blockedRoots = [skillRoot, findGitRoot(skillRoot), findGitRoot(process.cwd())].filter(Boolean);
    outputReal = realOutputPath(outputAbs);
    if (blockedRoots.some((root) => isInside(outputAbs, root) || isInside(outputReal, realpathSync(root)))) {
      return fail(
        result({ status: STATUS.FAILED, reasonClass: REASON.IN_REPO_OUTPUT }),
        '候选实际路径不得写入技能树或 Git 仓库内。',
      );
    }
    if (outputReal === input.realAbs) {
      return fail(result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), '--output 不能与 --input 指向同一原稿。');
    }
    if (lstatSync(outputAbs, { throwIfNoEntry: false })) {
      return fail(result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), '候选输出已存在或是链接，请选择新的仓外路径。');
    }
  } catch {
    return fail(result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), '无法核对候选输出的实际父目录。');
  }

  const endpoint = parsed.endpoint || process.env[ENV_ENDPOINT];
  const model = parsed.model || process.env[ENV_MODEL];
  const credentialEnvName = parsed.credentialEnv || process.env[ENV_CREDENTIAL_NAME];
  const missing = [];
  if (!endpoint) missing.push('endpoint');
  if (!model) missing.push('model');
  const credential = resolveCredential(credentialEnvName);
  if (credential.invalidName) {
    return fail(
      result({ status: STATUS.FAILED, reasonClass: REASON.CREDENTIAL_VIA_CLI }),
      `${ENV_CREDENTIAL_NAME} / --credential-env 必须是环境变量名，不能是凭据值。`,
    );
  }
  if (credential.missing) missing.push(credential.missing);
  if (missing.length) {
    return fail(
      result({ status: STATUS.NOT_CONFIGURED, reasonClass: REASON.MISSING_CONFIG, missing }),
      `外发表达未执行（原因：未配置 ${missing.join('/')}）。`,
    );
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (parsed.timeoutMs !== null) {
    const n = Number.parseInt(parsed.timeoutMs, 10);
    if (!Number.isInteger(n) || n <= 0) {
      return fail(result({ status: STATUS.FAILED, reasonClass: REASON.INVALID_INPUT }), '--timeout-ms 必须是正整数。');
    }
    timeoutMs = n;
  }

  const url = completionsUrl(endpoint);
  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: '按写作上下文指定的当前任务产出候选：任务可以是全文大纲或当前完整语义单元的正文。只输出当前任务要求的候选，不输出编辑说明或自评，不复述已接受前文，不把全文材料缩成摘要。上下文中的角色、读者、阅读任务、审核大纲、写作范围和最新裁决决定本次范围；原材料提供事实，已接受前文只用于衔接。角色、读者和审核说明是编排信息，不要把它们写成新的业务资格或前置要求；只拟写当前材料，不复制整篇大纲的其他节。标题和自然语言可以重组，但不得丢失或改变条件、例外、限制强度、版本来源、命令、配置、状态、授权、链接、数字、入口身份、代码、图表信息与稳定锚点。不要用其他技能入口替换原入口，不要补造事实或复述凭据。正文不额外包裹代码围栏，材料内已有的代码块保留。',
      },
      {
        role: 'user',
        content: `# 写作上下文\n${contextText || '（无附加上下文）'}\n\n# 当前稿件\n${input.text}`,
      },
    ],
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reasonClass = classifyFetchError(error);
    return fail(result({ status: STATUS.FAILED, reasonClass }), `外发表达失败（原因类：${reasonClass}）。`);
  }

  const httpStatus = response.status;
  if (httpStatus < 200 || httpStatus > 299) {
    return fail(
      result({ status: STATUS.FAILED, reasonClass: REASON.HTTP_STATUS, httpStatus }),
      `外发表达失败（原因类：http-status，HTTP ${httpStatus}）。`,
    );
  }

  let raw;
  try {
    raw = await response.text();
  } catch (error) {
    const reasonClass = classifyFetchError(error);
    return fail(
      result({ status: STATUS.FAILED, reasonClass, httpStatus }),
      `外发表达失败（原因类：${reasonClass}）。`,
    );
  }
  if (!raw || !raw.trim()) {
    return fail(
      result({ status: STATUS.FAILED, reasonClass: REASON.EMPTY_BODY, httpStatus }),
      '外发表达失败（原因类：empty-body）。',
    );
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    return fail(
      result({ status: STATUS.FAILED, reasonClass: REASON.UNPARSEABLE, httpStatus }),
      '外发表达失败（原因类：unparseable）。',
    );
  }

  const candidate = extractCandidate(parsedBody);
  if (candidate.error) {
    return fail(
      result({ status: STATUS.FAILED, reasonClass: candidate.error, httpStatus }),
      `外发表达失败（原因类：${candidate.error}）。`,
    );
  }

  try {
    mkdirSync(dirname(outputReal), { recursive: true });
    writeFileSync(outputReal, candidate.text, { encoding: 'utf8', flag: 'wx' });
  } catch {
    return fail(
      result({ status: STATUS.FAILED, reasonClass: REASON.CONNECTION, httpStatus }),
      '候选写入失败。',
    );
  }

  const payload = result({
    status: STATUS.CANDIDATE,
    outputPath: outputAbs,
    httpStatus,
  });
  printStatus(payload);
  return 0;
}

if (process.argv[1] && existsSync(process.argv[1])
  && realpathSync(process.argv[1]) === realpathSync(thisFile)) {
  const code = await main(process.argv.slice(2));
  process.exitCode = code;
}
