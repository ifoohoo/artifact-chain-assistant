#!/usr/bin/env node
// @feature ACA21 @scenario S-87 @scenario S-92 @decision D-ACA-26
// setup 技能的产品自持确定性执行器（F-09-P05：唯一 setup 业务逻辑实现）。
//
// skills-src/setup/SKILL.md 描述检查合同；本脚本是该合同的唯一代码实现，
// 测试与宿主入口都必须经由此执行器，不得在测试里维护第二份 setup 业务逻辑。
//
// F-09-P01：doctor 涉及两个独立合同——
//   1. 结构化检查项状态：doctor JSON 的 nativeBinding（ok/cause/failedStage/suggestion）；
//   2. 进程退出码：fail-closed（任一检查项失败即非零，S-94/ACA8）。
// 检查项 4 永远以结构化字段为准做独立裁决：nativeBinding.ok === false 时按
// cause（MISSING / ABI_MISMATCH / BUILD_DISABLED / LOAD_ERROR）输出独立 FAIL，
// 退出码只作旁证，不得作为唯一判据，也不得把 binding 故障降级为 WARN。

import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SETUP_CHECK_STATUSES = ['PASS', 'WARN', 'FAIL', 'SKIP'];

const NATIVE_BINDING_CAUSE_LABELS = {
  MISSING: 'better-sqlite3 包缺失（未安装或未解析到所选安装）',
  ABI_MISMATCH: '原生绑定与当前 Node ABI 不匹配',
  BUILD_DISABLED: 'lifecycle scripts 被禁或原生产物未构建',
  LOAD_ERROR: '原生绑定加载失败（未知原生错误）',
};

function findRegistryCli(projectRoot, pathEnv) {
  // SKILL.md 检查 7 的口径：node_modules/.bin/ 或 PATH。
  const local = join(projectRoot, 'node_modules', '.bin', 'agent-method-registry');
  if (existsSync(local)) return local;
  for (const dir of (pathEnv ?? '').split(':')) {
    if (!dir) continue;
    const candidate = join(dir, 'agent-method-registry');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * 检查项 4（Doctor 诊断）：执行 `artifact-graph doctor --format json`，
 * 按结构化 nativeBinding 状态独立裁决，退出码仅作旁证（F-09-P01）。
 */
export function checkDoctor({ projectRoot, env, artifactGraphCommand }) {
  const result = spawnSync(artifactGraphCommand, ['doctor', '--root', projectRoot, '--format', 'json'], {
    encoding: 'utf8',
    env,
  });
  if (result.error && result.error.code === 'ENOENT') {
    return { id: 4, name: 'Doctor 诊断', status: 'SKIP', detail: 'artifact-graph CLI 不可用' };
  }
  const stdout = result.stdout ?? '';
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return {
      id: 4,
      name: 'Doctor 诊断',
      status: 'WARN',
      detail: `doctor 输出无法解析为 JSON（exit ${result.status}），附原始输出片段：${stdout.slice(0, 200).replace(/\n/g, ' ')}`,
    };
  }
  const binding = report?.nativeBinding;
  if (!binding || typeof binding !== 'object' || typeof binding.ok !== 'boolean') {
    return { id: 4, name: 'Doctor 诊断', status: 'WARN', detail: 'doctor JSON 缺少 nativeBinding 字段' };
  }
  if (binding.ok === false) {
    const cause = typeof binding.cause === 'string' ? binding.cause : 'LOAD_ERROR';
    const label = NATIVE_BINDING_CAUSE_LABELS[cause] ?? NATIVE_BINDING_CAUSE_LABELS.LOAD_ERROR;
    const suggestion = typeof binding.suggestion === 'string' ? binding.suggestion : '';
    // 独立 FAIL：四类故障各自成立，不受退出码影响；退出码非零只是 fail-closed 旁证。
    return {
      id: 4,
      name: 'Doctor 诊断',
      status: 'FAIL',
      detail: `原生绑定不可用（${cause}：${label}）；失败阶段 ${binding.failedStage ?? '未知'}${suggestion ? `；修复建议：${suggestion}` : ''}`,
      cause,
      nativeBinding: binding,
    };
  }
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  if (result.status !== 0 || warnings.length > 0) {
    return {
      id: 4,
      name: 'Doctor 诊断',
      status: 'WARN',
      detail: `native binding 通过，但 doctor 报告其他问题：${warnings.join('；') || `exit ${result.status}`}`,
    };
  }
  return { id: 4, name: 'Doctor 诊断', status: 'PASS', detail: '诊断通过（nativeBinding.ok=true）' };
}

/**
 * 机械执行 skills-src/setup/SKILL.md 的七项只读检查序列与 Registry 降级探测。
 * @param {object} options
 * @param {string} options.installRoot 插件安装根（宿主 adapter 副本）
 * @param {string} options.projectRoot 目标项目根
 * @param {NodeJS.ProcessEnv} [options.env] 子进程环境（缺省 process.env）
 * @param {string} [options.artifactGraphCommand] artifact-graph 可执行命令（缺省 'artifact-graph'）
 * @param {string} [options.probeHost] Registry binding 探测宿主（缺省 'codex'）
 */
export async function runSetupChecks({
  installRoot,
  projectRoot,
  env = process.env,
  artifactGraphCommand = 'artifact-graph',
  probeHost = 'codex',
}) {
  const rows = [];
  const degradedServices = [];
  const pathEnv = env.PATH ?? env.Path ?? '';

  // 1. 插件闭包完整性
  const closurePaths = ['skills', 'family-apis', 'scripts', 'compatibility.json', 'agent-methods/catalog.yaml'];
  const missing = closurePaths.filter((p) => !existsSync(join(installRoot, ...p.split('/'))));
  rows.push(missing.length === 0
    ? { id: 1, name: '插件闭包完整性', status: 'PASS', detail: '全部路径存在' }
    : { id: 1, name: '插件闭包完整性', status: 'FAIL', detail: `缺失 ${missing.join(', ')}` });

  // 2. Node.js 可用性
  const nodeCheck = spawnSync(process.execPath, ['--version'], { encoding: 'utf8' });
  rows.push(nodeCheck.status === 0
    ? { id: 2, name: 'Node.js', status: 'PASS', detail: nodeCheck.stdout.trim() }
    : { id: 2, name: 'Node.js', status: 'FAIL', detail: 'Node.js 未找到' });

  // 3. artifact-graph CLI 可用性
  const cliCheck = spawnSync(artifactGraphCommand, ['--help'], { encoding: 'utf8', env });
  let cliAvailable = false;
  if (cliCheck.status === 0) {
    cliAvailable = true;
    rows.push({ id: 3, name: 'artifact-graph CLI', status: 'PASS', detail: '可用' });
  } else {
    const compat = JSON.parse(await readFile(join(installRoot, 'compatibility.json'), 'utf8'));
    rows.push({
      id: 3,
      name: 'artifact-graph CLI',
      status: 'FAIL',
      detail: `未找到；修复: pnpm add -D ${compat.artifactGraph.installSpec}`,
    });
  }

  // 4. Doctor 诊断（F-09-P01：结构化状态优先，退出码旁证）
  if (!cliAvailable) {
    rows.push({ id: 4, name: 'Doctor 诊断', status: 'SKIP', detail: 'artifact-graph CLI 不可用' });
  } else {
    rows.push(checkDoctor({ projectRoot, env, artifactGraphCommand }));
  }

  // 5. 项目 config 存在性
  rows.push(existsSync(join(projectRoot, 'artifact-graph.config.yaml'))
    ? { id: 5, name: '项目 config', status: 'PASS', detail: '已配置' }
    : { id: 5, name: '项目 config', status: 'WARN', detail: '不存在' });

  // 6. 版本锁存在性
  rows.push(existsSync(join(projectRoot, 'artifacts', 'traceability-version-lock.json'))
    ? { id: 6, name: '版本锁', status: 'PASS', detail: '已建立' }
    : { id: 6, name: '版本锁', status: 'WARN', detail: '不存在' });

  // 7. Registry CLI 可用性
  const registryCli = findRegistryCli(projectRoot, pathEnv);
  rows.push(registryCli
    ? { id: 7, name: 'Registry CLI', status: 'PASS', detail: 'agent-method-registry CLI 可用' }
    : { id: 7, name: 'Registry CLI', status: 'WARN', detail: '不可用（contract-backed 服务解析将返回 NEEDS_INPUT）' });

  // 降级探测：Registry CLI → effective index → 逐条 method binding 解析。
  const indexPath = join(projectRoot, '.agent-method-registry', 'effective-index.json');
  if (!registryCli) {
    degradedServices.push({
      service: 'contract-backed 专业服务解析',
      reason: 'agent-method-registry CLI 不可用，无法解析权威 binding',
    });
  } else if (!existsSync(indexPath)) {
    degradedServices.push({
      service: 'contract-backed 专业服务解析',
      reason: '.agent-method-registry/effective-index.json 缺失',
    });
  } else {
    let index;
    try {
      index = JSON.parse(await readFile(indexPath, 'utf8'));
    } catch {
      index = undefined;
    }
    if (!index || !Array.isArray(index.entries)) {
      degradedServices.push({
        service: 'contract-backed 专业服务解析',
        reason: 'effective-index.json 无法解析',
      });
    } else {
      for (const entry of index.entries) {
        const resolve = spawnSync(registryCli, [
          'resolve',
          '--index', indexPath,
          '--ref', entry.ref,
          '--host', probeHost,
          '--plugin-root', join(installRoot, 'skills'),
          '--project-root', join(projectRoot, 'project-skills'),
        ], { encoding: 'utf8', env });
        let parsed;
        try {
          parsed = JSON.parse(resolve.stdout ?? '');
        } catch {
          parsed = undefined;
        }
        if (!parsed || parsed.ok !== true || parsed.data?.verification?.status !== 'verified') {
          const codes = (parsed?.diagnostics ?? []).map((d) => d.code).join(',') || 'RESOLVE_FAILED';
          degradedServices.push({ service: entry.ref, reason: `binding 解析失败：${codes}` });
        }
      }
    }
  }

  // 报告文本（与 SKILL.md 输出格式一致）。
  const lines = ['## 环境检查报告', '', '| # | 检查项 | 状态 | 详情 |', '|---|--------|------|------|'];
  for (const row of rows) lines.push(`| ${row.id} | ${row.name} | ${row.status} | ${row.detail} |`);
  if (degradedServices.length > 0) {
    lines.push('', '## 尚不可执行的标准服务（Registry 缺失）', '', '| 服务 | 原因 |', '|------|------|');
    for (const item of degradedServices) lines.push(`| ${item.service} | ${item.reason} |`);
    lines.push('', '可选修复：安装 `agent-method-registry` 后重跑 setup。修复前上述服务保持不可执行，不得报告为可用。');
  }

  return { rows, degradedServices, report: lines.join('\n') };
}

function renderSetupReport(result) {
  return result.report;
}

// CLI 入口：node scripts/setup-checks.mjs --install-root <dir> --project-root <dir>
// [--path-env <PATH>] [--artifact-graph-command <cmd>] [--probe-host <host>] [--format json|report]
const isMainEntry = (() => {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? '');
  } catch {
    return false;
  }
})();
if (isMainEntry && process.argv.slice(2).some((arg) => arg.startsWith('--'))) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };
  const installRoot = flag('install-root');
  const projectRoot = flag('project-root');
  if (!installRoot || !projectRoot) {
    console.error('usage: setup-checks.mjs --install-root <dir> --project-root <dir> [--path-env <PATH>] [--format json|report]');
    process.exit(2);
  }
  const pathEnv = flag('path-env');
  const env = pathEnv !== undefined ? { ...process.env, PATH: pathEnv } : process.env;
  const result = await runSetupChecks({
    installRoot,
    projectRoot,
    env,
    artifactGraphCommand: flag('artifact-graph-command') ?? 'artifact-graph',
    probeHost: flag('probe-host') ?? 'codex',
  });
  if (flag('format') === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderSetupReport(result));
  }
}
