// @feature ACA1
// @feature ACA29 @scenario S-159 @scenario S-160 @scenario S-161
import { spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { lstat, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileContained, resolveContained } from 'skill-family-harness-node';
import { inspectArtifactGraphRuntime } from './artifact-graph-runtime.mjs';

export const DEFAULT_REVIEWS_PATH = 'artifacts/reviews/workbench-reviews.json';
export const DEFAULT_STUDIO_PORT = 57630;
export const STUDIO_NOT_INSTALLED_CODE = 'STUDIO_NOT_INSTALLED';

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SKIP_SCAN_DIRS = new Set([
  '.git', 'node_modules', 'dist', '.artifact-graph', '.artifacts', '.runs',
  '.release-skill', '.cache', '.qoder', '.codex', '.claude', '.kimi',
  '.worktrees', '.tmp', 'target', 'deliveries', '_archives', '_worktrees', '_runs',
]);
const CODE_NODE_EXT_RE = /\.(?:[cm]?[jt]sx?|py|rs|go|sh|java|kt)$/i;

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const requireFromHere = createRequire(import.meta.url);

export function sanitizeDisplayText(value) {
  let out = String(value ?? '');
  const home = homedir();
  if (home && home.length > 1) {
    out = out.replaceAll(home, '<USER_HOME>');
  }
  const osTmp = tmpdir().replace(/\/+$/, '');
  if (osTmp && osTmp.length > 1) {
    out = out.replaceAll(`/private${osTmp}`, '<TMP_DIR>').replaceAll(osTmp, '<TMP_DIR>');
  }
  return out
    .replace(/\/Users\/[^/"'\s]+\/\.local\/share\/fnm\/node-versions\/[^/"'\s]+\/installation\/bin/g, '<NODE_BIN>')
    .replace(/\/Volumes\/[^/\n"']+\/source/g, '<SOURCE_ROOT>')
    .replace(/\/Volumes\/[^/\n"']+/g, '<VOLUME_ROOT>')
    .replace(/(?:\/private)?\/var\/folders\/[^/\s"']+\/[^/\s"']+\/T/g, '<TMP_DIR>')
    .replace(/\/Users\/[A-Za-z0-9._-]+/g, '<USER_HOME>');
}

function cleanString(value, maxLen = 4000) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLen);
}

const TYPE_LABELS = {
  requirement: '原始需求',
  prd: '产品需求 PRD',
  feature: '功能特性',
  user_story: '用户故事',
  story: '用户故事',
  entity: '领域实体',
  domain_model: '领域模型',
  'domain-glossary': '领域术语表',
  'bounded-context-map': '限界上下文图',
  decision: '架构决策',
  design: '架构设计',
  interface_contracts: '接口契约',
  data_contracts: '数据契约',
  application_state_machines: '状态机契约',
  error_model: '错误模型',
  scenario: '场景剧本',
  spec: '接口与规格 SPEC',
  e2e_test: '端到端测试规格',
  e2e_registry: '测试注册表',
  'test-strategy': '测试策略',
  'rule-golden-cases': '规则黄金用例',
  test: '测试与代码验证',
  implementation: '实现追溯',
};

const EDGE_LABELS = {
  covers: '覆盖场景',
  references: '关联引用',
  depends_on: '前置依赖',
  verifies: '验证覆盖',
  implements: '代码实现',
  'derives-from': '派生自',
  decomposes: '分解自',
  supersedes: '完整替代',
  'partial-supersedes': '部分替代',
  'external-reference': '跨仓引用',
  evidence: '验证证据',
  'change-target': '变更目标',
};

const LAYER_DEFS = [
  { id: 'requirements', order: 0, label: '需求与规格', match: new Set(['requirement', 'spec']) },
  { id: 'product', order: 1, label: '产品与故事', match: new Set(['prd', 'feature', 'user_story', 'story']) },
  { id: 'domain', order: 2, label: '领域与决策', match: new Set(['entity', 'domain_model', 'domain-glossary', 'bounded-context-map', 'decision']) },
  { id: 'architecture', order: 3, label: '架构与契约', match: new Set(['design', 'interface_contracts', 'data_contracts', 'application_state_machines', 'error_model']) },
  { id: 'scenarios', order: 4, label: '场景剧本', match: new Set(['scenario']) },
  { id: 'verification', order: 5, label: '测试与验证', match: new Set(['e2e_test', 'e2e_registry', 'test-strategy', 'rule-golden-cases', 'test', 'implementation']) },
];

function classifyNodeLayer(type, configuredLayer) {
  for (const def of LAYER_DEFS) {
    if (def.match.has(type)) return def;
  }
  const lower = String(configuredLayer ?? '').toLowerCase();
  if (lower.includes('req') || lower.includes('spec')) return LAYER_DEFS[0];
  if (lower.includes('prd') || lower.includes('story') || lower.includes('feature')) return LAYER_DEFS[1];
  if (lower.includes('domain') || lower.includes('decision')) return LAYER_DEFS[2];
  if (lower.includes('scenario')) return LAYER_DEFS[4];
  if (lower.includes('verif') || lower.includes('test') || lower.includes('impl')) return LAYER_DEFS[5];
  return LAYER_DEFS[3];
}

async function resolveGraphApi(projectRoot, env) {
  let pkgJsonPath = null;
  for (const candidateRoot of [projectRoot, packageRoot]) {
    const runtime = await inspectArtifactGraphRuntime({ projectRoot: candidateRoot, env });
    if (runtime.ok && runtime.packagePath) {
      pkgJsonPath = runtime.packagePath;
      break;
    }
  }
  if (!pkgJsonPath) {
    try {
      pkgJsonPath = requireFromHere.resolve('artifact-graph/package.json');
    } catch {
      throw new Error('未找到可用的 artifact-graph 运行时；请先在项目或插件环境中安装匹配版本的 artifact-graph。');
    }
  }
  const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
  const entry = pkg.exports?.['.']?.import?.default ?? pkg.module ?? pkg.main;
  if (!entry) throw new Error('artifact-graph 包缺少 ESM 导入入口。');
  return import(pathToFileURL(join(dirname(pkgJsonPath), entry)).href);
}

async function fileExists(absPath) {
  try { await lstat(absPath); return true; } catch { return false; }
}

async function isUsableFile(absPath) {
  try {
    const st = await stat(absPath);
    return st.isFile();
  } catch {
    return false;
  }
}

function parseScanRoots(scanRoots) {
  if (!scanRoots) return [];
  if (Array.isArray(scanRoots)) return scanRoots.flatMap(s => String(s).split(',')).map(s => s.trim()).filter(Boolean);
  return String(scanRoots).split(',').map(s => s.trim()).filter(Boolean);
}

async function readLightweightRepoMeta(repoRealPath) {
  let pkgName = basename(repoRealPath);
  let description = '';
  let version = '';
  try {
    const raw = await readFileContained(repoRealPath, 'package.json', { encoding: 'utf8' });
    const pkg = JSON.parse(raw);
    if (typeof pkg.name === 'string' && pkg.name) pkgName = pkg.name;
    if (typeof pkg.description === 'string') description = sanitizeDisplayText(pkg.description);
    if (typeof pkg.version === 'string') version = pkg.version;
  } catch {}
  let lockPresent = false;
  let lockedCount = 0;
  try {
    const parsedLock = JSON.parse(await readFileContained(repoRealPath, 'artifacts/traceability-version-lock.json', { encoding: 'utf8' }));
    lockPresent = true;
    lockedCount = (Array.isArray(parsedLock.locks) ? parsedLock.locks.length : 0)
      + (Array.isArray(parsedLock.artifactRelations) ? parsedLock.artifactRelations.length : 0);
  } catch {}
  return { pkgName, description, version, lockPresent, lockedCount };
}

export async function discoverArtifactRepos({ root, scanRoots = [], writable = false } = {}) {
  if (!root) throw new Error('请通过 --root 指定包含 artifact-graph.config.yaml 的目标仓库目录。');
  const primaryReal = await realpath(resolve(root));
  if (!(await fileExists(join(primaryReal, 'artifact-graph.config.yaml')))) {
    throw new Error('目标根目录缺少 artifact-graph.config.yaml，无法解析制品图。');
  }

  const foundRealPaths = [primaryReal];
  const seenReal = new Set([primaryReal]);

  const tryAddCandidate = async dirPath => {
    if (!(await fileExists(join(dirPath, 'artifact-graph.config.yaml')))) return false;
    let real;
    try { real = await realpath(dirPath); } catch { return false; }
    if (seenReal.has(real)) return true;
    seenReal.add(real);
    foundRealPaths.push(real);
    return true;
  };

  for (const rawScan of parseScanRoots(scanRoots)) {
    let scanReal;
    try { scanReal = await realpath(resolve(rawScan)); } catch { continue; }
    if (await tryAddCandidate(scanReal)) continue;

    let level1 = [];
    try { level1 = await readdir(scanReal, { withFileTypes: true }); } catch { continue; }
    for (const e1 of level1.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e1.isDirectory() || e1.name.startsWith('.') || SKIP_SCAN_DIRS.has(e1.name)) continue;
      const d1 = join(scanReal, e1.name);
      if (await tryAddCandidate(d1)) continue;
      let level2 = [];
      try { level2 = await readdir(d1, { withFileTypes: true }); } catch { continue; }
      for (const e2 of level2.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!e2.isDirectory() || e2.name.startsWith('.') || SKIP_SCAN_DIRS.has(e2.name)) continue;
        await tryAddCandidate(join(d1, e2.name));
      }
    }
  }

  const usedIds = new Set();
  const records = [];
  for (const realPath of foundRealPaths) {
    const dirSlug = basename(realPath);
    const parentSlug = basename(dirname(realPath)) || 'workspace';
    let id = `${parentSlug}/${dirSlug}`;
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);
    const isPrimary = realPath === primaryReal;
    const meta = await readLightweightRepoMeta(realPath);
    records.push({
      id,
      name: dirSlug,
      packageName: meta.pkgName,
      group: parentSlug,
      version: meta.version,
      description: meta.description,
      isPrimary,
      writable: Boolean(writable && isPrimary),
      lockPresent: meta.lockPresent,
      lockedCount: meta.lockedCount,
      realPath,
    });
  }

  records.sort((a, b) => (a.isPrimary === b.isPrimary
    ? `${a.group}/${a.name}`.localeCompare(`${b.group}/${b.name}`)
    : (a.isPrimary ? -1 : 1)));

  const toPublicRepo = ({ realPath: _hidden, ...pub }) => pub;
  return {
    primaryReal,
    primaryRepoId: records[0].id,
    records,
    byId: new Map(records.map(r => [r.id, r])),
    publicRepos: records.map(toPublicRepo),
  };
}

async function loadSchemaReadOnly(api, repoRealPath) {
  try {
    const schema = await api.loadConfig(repoRealPath);
    return { schema, configStatus: 'ok', configMessage: null };
  } catch (error) {
    if (String(error?.message ?? '').includes('allowedEdges')) {
      const rawYaml = await readFileContained(repoRealPath, 'artifact-graph.config.yaml', { encoding: 'utf8' });
      const tmp = await mkdtemp(join(tmpdir(), 'aca-wb-cfg-'));
      try {
        await writeFile(join(tmp, 'artifact-graph.config.yaml'), `${rawYaml}\nallowedEdges: null\n`);
        const schema = await api.loadConfig(tmp);
        return {
          schema,
          configStatus: 'legacy_diagnostic',
          configMessage: '该仓库配置文件尚未显式声明 allowedEdges，当前按内置默认边规则只读解析。',
        };
      } finally {
        await rm(tmp, { recursive: true, force: true });
      }
    }
    throw error;
  }
}

async function collectConfiguredContents(api, repoRealPath, schema) {
  const prefixes = new Set();
  let needsRootWalk = false;
  for (const def of Object.values(schema.types ?? {})) {
    for (const pattern of def.paths ?? []) {
      const firstSeg = String(pattern).replace(/^\.\//, '').split('/')[0];
      if (!firstSeg || /[*?[\]{}]/.test(firstSeg)) {
        needsRootWalk = true;
      } else {
        prefixes.add(firstSeg);
      }
    }
  }

  const contents = new Map();
  async function walk(dirAbs) {
    let entries;
    try { entries = await readdir(dirAbs, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (SKIP_SCAN_DIRS.has(entry.name) && !prefixes.has(entry.name)) continue;
      if (entry.isSymbolicLink()) continue;
      const full = join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const rel = relative(repoRealPath, full).split('\\').join('/');
        if (api.matchesConfiguredArtifactPath(rel, schema)) {
          try {
            contents.set(rel, await readFileContained(repoRealPath, rel, { encoding: 'utf8' }));
          } catch {}
        }
      }
    }
  }

  if (needsRootWalk) {
    await walk(repoRealPath);
  } else {
    for (const pre of prefixes) {
      const candidate = join(repoRealPath, pre);
      try {
        const st = await lstat(candidate);
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) await walk(candidate);
        else if (st.isFile() && api.matchesConfiguredArtifactPath(pre, schema)) {
          contents.set(pre, await readFileContained(repoRealPath, pre, { encoding: 'utf8' }));
        }
      } catch {}
    }
  }
  return contents;
}

function emptyReviewStore(reviewsPath = DEFAULT_REVIEWS_PATH) {
  return {
    present: false,
    reviewsPath,
    schemaVersion: 1,
    updatedAt: null,
    decisions: {},
    annotations: [],
    counts: { decisions: 0, annotations: 0, unresolvedAnnotations: 0 },
  };
}

export async function readWorkbenchReviews(root, reviewsPath = DEFAULT_REVIEWS_PATH) {
  try {
    const abs = await resolveContained(root, reviewsPath);
    await lstat(abs);
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyReviewStore(reviewsPath);
    throw error;
  }
  const parsed = JSON.parse(await readFileContained(root, reviewsPath, { encoding: 'utf8' }));
  const rawDecisions = parsed.decisions && typeof parsed.decisions === 'object' && !Array.isArray(parsed.decisions)
    ? parsed.decisions
    : {};
  const decisions = {};
  for (const [k, v] of Object.entries(rawDecisions)) {
    if (FORBIDDEN_OBJECT_KEYS.has(k) || !v || typeof v !== 'object') continue;
    decisions[k] = {
      ...v,
      ...(typeof v.note === 'string' ? { note: sanitizeDisplayText(v.note) } : {}),
    };
  }
  const annotations = Array.isArray(parsed.annotations)
    ? parsed.annotations.map(item => ({
        ...item,
        ...(typeof item?.body === 'string' ? { body: sanitizeDisplayText(item.body) } : {}),
        ...(typeof item?.quote === 'string' ? { quote: sanitizeDisplayText(item.quote) } : {}),
      }))
    : [];
  return {
    present: true,
    reviewsPath,
    schemaVersion: 1,
    updatedAt: parsed.updatedAt ?? null,
    decisions,
    annotations,
    counts: {
      decisions: Object.keys(decisions).length,
      annotations: annotations.length,
      unresolvedAnnotations: annotations.filter(item => !item?.resolved).length,
    },
  };
}

export async function inspectRepoSnapshot(repoRecord, { api, emptyScanDir, reviewsPath = DEFAULT_REVIEWS_PATH }) {
  const { schema, configStatus, configMessage } = await loadSchemaReadOnly(api, repoRecord.realPath);
  const contents = await collectConfiguredContents(api, repoRecord.realPath, schema);
  const graph = await api.scanArtifacts(emptyScanDir, schema, { contents });
  const reviews = await readWorkbenchReviews(repoRecord.realPath, reviewsPath);

  const inDeg = new Map();
  const outDeg = new Map();
  for (const edge of graph.edges) {
    outDeg.set(edge.from, (outDeg.get(edge.from) ?? 0) + 1);
    inDeg.set(edge.to, (inDeg.get(edge.to) ?? 0) + 1);
  }

  const nodes = graph.nodes.map(node => {
    const typeConf = schema.types?.[node.type] ?? {};
    const layerDef = classifyNodeLayer(node.type, typeConf.layer);
    const isCode = node.type === 'test' || node.type === 'implementation' || CODE_NODE_EXT_RE.test(node.path);
    return {
      uid: node.uid,
      type: node.type,
      typeLabel: typeConf.displayName || TYPE_LABELS[node.type] || node.type,
      layer: layerDef.id,
      layerOrder: layerDef.order,
      layerLabel: layerDef.label,
      code: node.code,
      title: sanitizeDisplayText(node.title || node.code),
      path: node.path,
      line: node.line,
      status: node.status ?? null,
      reviewStatus: reviews.decisions[node.uid]?.status ?? 'pending',
      isDesignNode: !isCode,
      inDegree: inDeg.get(node.uid) ?? 0,
      outDegree: outDeg.get(node.uid) ?? 0,
    };
  });

  const relationLabels = schema.relationSemantics ?? {};
  const edges = graph.edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    kindLabel: relationLabels[edge.kind]?.label || EDGE_LABELS[edge.kind] || edge.kind,
    sourcePath: edge.sourcePath,
    sourceLine: edge.sourceLine,
  }));

  const lockRelPath = api.VERSION_LOCK_PATH || 'artifacts/traceability-version-lock.json';
  const lockExists = await fileExists(join(repoRecord.realPath, lockRelPath));
  let versionLock = {
    present: lockExists,
    lockPath: lockRelPath,
    status: 'missing',
    badgeTone: 'zinc',
    badgeLabel: '未建立版本锁',
    totalLocks: 0,
    fresh: 0,
    totalArtifactRelationLocks: 0,
    artifactRelationFresh: 0,
    issueCount: 0,
    blockingCount: 0,
    issues: [],
  };

  if (lockExists && typeof api.auditVersionLock === 'function') {
    try {
      const audit = await api.auditVersionLock(repoRecord.realPath, lockRelPath, graph, schema);
      const blockingCount = (audit.issues ?? []).filter(item => (
        typeof api.isVersionLockIssueBlocking === 'function'
          ? api.isVersionLockIssueBlocking(item, true)
          : item.severity !== 'warning'
      )).length;
      const totalAll = (audit.totalLocks ?? 0) + (audit.totalArtifactRelationLocks ?? 0);
      const freshAll = (audit.fresh ?? 0) + (audit.artifactRelationFresh ?? 0);
      const isFresh = blockingCount === 0 && (audit.issues ?? []).length === 0;
      versionLock = {
        present: true,
        lockPath: lockRelPath,
        status: isFresh ? (totalAll > 0 ? 'fresh' : 'empty') : 'stale',
        badgeTone: isFresh ? 'emerald' : (blockingCount > 0 ? 'rose' : 'amber'),
        badgeLabel: isFresh
          ? (totalAll > 0 ? `版本锁新鲜 (${freshAll}/${totalAll})` : '版本锁就绪 (0 条边)')
          : `发现 ${audit.issues.length} 项锁漂移`,
        totalLocks: audit.totalLocks ?? 0,
        fresh: audit.fresh ?? 0,
        totalArtifactRelationLocks: audit.totalArtifactRelationLocks ?? 0,
        artifactRelationFresh: audit.artifactRelationFresh ?? 0,
        issueCount: (audit.issues ?? []).length,
        blockingCount,
        issues: (audit.issues ?? []).slice(0, 25).map(it => ({
          status: it.status,
          edgeId: it.edgeId,
          severity: it.severity ?? 'error',
          message: sanitizeDisplayText(it.message),
        })),
      };
    } catch (err) {
      versionLock = {
        ...versionLock,
        status: 'diagnostic',
        badgeTone: 'amber',
        badgeLabel: '版本锁待核实',
        issues: [{ status: 'diagnostic', edgeId: '-', severity: 'warning', message: sanitizeDisplayText(err.message) }],
      };
    }
  }

  const typeCounts = {};
  for (const nd of nodes) typeCounts[nd.type] = (typeCounts[nd.type] ?? 0) + 1;

  let alignment = null;
  if (configStatus === 'ok' && typeof api.auditBidirectionalAlignment === 'function') {
    const hasPortfolio = await fileExists(join(repoRecord.realPath, 'artifacts/portfolio-allocations.json'));
    const hasUpstream = await fileExists(join(repoRecord.realPath, 'artifacts/upstream-bindings.json'));
    const hasSurface = Boolean(schema.implementationSurface);
    if (hasPortfolio || hasUpstream || hasSurface) {
      try {
        const alignRes = await api.auditBidirectionalAlignment(repoRecord.realPath, { strict: false });
        alignment = {
          ok: alignRes.ok,
          modes: alignRes.modes,
          intraRepo: alignRes.intraRepo,
          ...(alignRes.portfolio ? {
            portfolio: {
              portfolioId: alignRes.portfolio.portfolioId ?? null,
              title: alignRes.portfolio.title ? sanitizeDisplayText(alignRes.portfolio.title) : null,
              totalItems: alignRes.portfolio.totalItems,
              satisfactionSummary: alignRes.portfolio.satisfactionSummary,
              items: alignRes.portfolio.items.map(it => ({
                sourceUid: it.sourceUid,
                sourcePath: it.sourcePath,
                disposition: it.disposition,
                computedSatisfaction: it.computedSatisfaction,
                remainingScope: it.remainingScope,
                allocationsCount: it.allocationsCount,
                verifiedAllocationsCount: it.verifiedAllocationsCount,
              })),
            },
          } : {}),
          ...(alignRes.childProject ? {
            childProject: {
              upstreamPortfolio: alignRes.childProject.upstreamPortfolio,
              upstreamReachable: alignRes.childProject.upstreamReachable,
              totalBindings: alignRes.childProject.totalBindings,
              matchedBindings: alignRes.childProject.matchedBindings,
            },
          } : {}),
          summary: alignRes.summary,
          issues: (alignRes.issues ?? []).slice(0, 30).map(iss => ({
            code: iss.code,
            layer: iss.layer,
            severity: iss.severity,
            file: iss.file ? sanitizeDisplayText(iss.file) : null,
            uid: iss.uid ?? null,
            message: sanitizeDisplayText(iss.message),
          })),
        };
      } catch (err) {
        alignment = {
          ok: false,
          error: sanitizeDisplayText(err.message),
        };
      }
    }
  }

  return {
    repoId: repoRecord.id,
    repoName: repoRecord.name,
    group: repoRecord.group,
    isPrimary: repoRecord.isPrimary,
    writable: repoRecord.writable,
    configStatus,
    configMessage,
    counts: {
      nodes: nodes.length,
      designNodes: nodes.filter(n => n.isDesignNode).length,
      codeNodes: nodes.filter(n => !n.isDesignNode).length,
      edges: edges.length,
      byType: typeCounts,
    },
    layers: LAYER_DEFS.map(l => ({ id: l.id, order: l.order, label: l.label })),
    versionLock,
    ...(alignment ? { alignment } : {}),
    reviews,
    nodes,
    edges,
  };
}

export async function buildWorkbenchSnapshot({
  root,
  scanRoots = [],
  repoId,
  reviewsPath = DEFAULT_REVIEWS_PATH,
  env,
} = {}) {
  const catalog = await discoverArtifactRepos({ root, scanRoots, writable: false });
  const api = await resolveGraphApi(catalog.primaryReal, env);
  const selected = repoId ? catalog.byId.get(repoId) : catalog.records[0];
  if (!selected) {
    throw new Error(`未在扫描清单中找到仓库标识：${repoId}`);
  }
  const emptyScanDir = await mkdtemp(join(tmpdir(), 'aca-wb-scan-'));
  try {
    const snapshot = await inspectRepoSnapshot(selected, { api, emptyScanDir, reviewsPath });
    return {
      schemaVersion: 1,
      primaryRepoId: catalog.primaryRepoId,
      repoCount: catalog.publicRepos.length,
      repos: catalog.publicRepos,
      snapshot,
      reviews: snapshot.reviews,
    };
  } finally {
    await rm(emptyScanDir, { recursive: true, force: true });
  }
}

const STUDIO_PKG = 'skill-family-studio';
const wsDir = `${STUDIO_PKG}-workspace`;
const STUDIO_ECOSYSTEM_SUBPATHS = [
  `${wsDir}/packages/${STUDIO_PKG}/bin/${STUDIO_PKG}.mjs`,
  `skill-family/${wsDir}/packages/${STUDIO_PKG}/bin/${STUDIO_PKG}.mjs`,
  `${STUDIO_PKG}/packages/${STUDIO_PKG}/bin/${STUDIO_PKG}.mjs`,
  `skill-family/${STUDIO_PKG}/bin/${STUDIO_PKG}.mjs`,
  `${STUDIO_PKG}/bin/${STUDIO_PKG}.mjs`,
];

function collectAncestorDirs(startDir, maxHops = 9) {
  const dirs = [];
  let cur = resolve(startDir);
  for (let i = 0; i <= maxHops; i++) {
    dirs.push(cur);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return dirs;
}

function canResolveStudioRuntime(entryAbs) {
  try {
    createRequire(entryAbs).resolve('skill-family-harness-node');
    return true;
  } catch {
    return false;
  }
}

function uniqueStrings(items) {
  return [...new Set(items)];
}

export async function resolveSkillFamilyStudio({ root, cwd = process.cwd(), env = process.env } = {}) {
  const explicit = env?.SKILL_FAMILY_STUDIO_BIN;
  if (explicit !== undefined && String(explicit).trim() !== '') {
    const trimmed = String(explicit).trim();
    if (trimmed === 'none') {
      return { found: false, source: 'env', configuredPath: 'none' };
    }
    const candidate = resolve(trimmed);
    if (!(await isUsableFile(candidate))) {
      return { found: false, source: 'env', configuredPath: sanitizeDisplayText(trimmed) };
    }
    const realBin = await realpath(candidate);
    return { found: true, source: 'env', binPath: realBin, useNode: /\.[cm]?js$/i.test(realBin) };
  }

  const resolvedRoot = root ? resolve(root) : resolve(cwd);
  const isolated = env?.SKILL_FAMILY_STUDIO_ISOLATED === '1';
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const anchorDirs = isolated
    ? uniqueStrings([resolvedRoot, dirname(resolvedRoot)])
    : uniqueStrings([
        ...collectAncestorDirs(resolvedRoot, 9),
        ...collectAncestorDirs(cwd, 9),
        ...collectAncestorDirs(scriptDir, 9),
      ]);

  for (const base of anchorDirs) {
    const localBin = join(base, 'node_modules/.bin/skill-family-studio');
    if (await isUsableFile(localBin)) {
      return { found: true, source: 'workspace-bin', binPath: localBin, useNode: false };
    }
  }

  for (const pathDir of String(env?.PATH ?? '').split(delimiter).map(s => s.trim()).filter(Boolean)) {
    const pathBin = join(pathDir, 'skill-family-studio');
    if (await isUsableFile(pathBin)) {
      return { found: true, source: 'path', binPath: pathBin, useNode: false };
    }
  }

  let fallbackMatch = null;
  for (const anchor of anchorDirs) {
    for (const subpath of STUDIO_ECOSYSTEM_SUBPATHS) {
      const candidate = resolve(anchor, subpath);
      if (await isUsableFile(candidate)) {
        const realBin = await realpath(candidate);
        const match = { found: true, source: 'ecosystem', binPath: realBin, useNode: /\.[cm]?js$/i.test(realBin) };
        if (canResolveStudioRuntime(realBin)) {
          return match;
        }
        if (!fallbackMatch) fallbackMatch = match;
      }
    }
  }
  if (fallbackMatch) return fallbackMatch;

  return { found: false, source: 'not-found' };
}

export async function delegateToSkillFamilyStudio({
  mode = 'serve',
  root,
  scanRoots = [],
  port = DEFAULT_STUDIO_PORT,
  tab = 'graph',
  writable = false,
  cwd = process.cwd(),
  env = process.env,
  stdio = 'inherit',
} = {}) {
  if (!['serve', 'open', 'ensure'].includes(mode)) {
    throw new Error(`不支持的工作台启动子命令：${mode}（仅支持 serve、open 或 ensure）。`);
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('--port 必须为 0 至 65535 之间的整数。');
  }
  const studioCommand = mode === 'open' ? 'ensure' : mode;
  const targetTab = cleanString(tab, 40) || 'graph';
  const catalog = await discoverArtifactRepos({ root, scanRoots, writable });
  const normalizedScans = parseScanRoots(scanRoots);
  const forwardedArgs = [
    studioCommand,
    '--root', catalog.primaryReal,
    '--port', String(port),
    '--tab', targetTab,
    ...(normalizedScans.length ? ['--scan-roots', normalizedScans.join(',')] : []),
    ...(!writable ? ['--readonly'] : []),
  ];
  const sanitizedArgs = forwardedArgs.map(sanitizeDisplayText);
  const studio = await resolveSkillFamilyStudio({ root: catalog.primaryReal, cwd, env });

  if (!studio.found) {
    return {
      ok: false,
      delegated: false,
      code: STUDIO_NOT_INSTALLED_CODE,
      exitCode: 2,
      command: mode,
      studioCommand,
      port,
      tab: targetTab,
      error: '未检测到统一可视化控制台 skill-family-studio；当前插件不再内嵌网页前端，请通过 skill-family-studio 打开交互制品图。',
      guidance: [
        '在工作区或全局安装 skill-family-studio（或通过环境变量 SKILL_FAMILY_STUDIO_BIN 指定可执行文件）',
        `安装后可直接执行：skill-family-studio ${studioCommand} --root <仓库目录> --port ${port} --tab ${targetTab}${!writable ? ' --readonly' : ''}`,
        '若仅需在命令行或脚本中读取制品节点、追溯边、锁新鲜度与审阅状态，请改用：snapshot --root <仓库目录> --json',
      ],
      forwardedArgs: sanitizedArgs,
    };
  }

  const execCmd = studio.useNode ? process.execPath : studio.binPath;
  const execArgs = studio.useNode ? [studio.binPath, ...forwardedArgs] : forwardedArgs;

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(execCmd, execArgs, { cwd: catalog.primaryReal, env, stdio });
    let stdout = '';
    let stderr = '';
    if (stdio === 'pipe') {
      child.stdout?.on('data', chunk => { stdout += chunk.toString('utf8'); });
      child.stderr?.on('data', chunk => { stderr += chunk.toString('utf8'); });
    }
    const forwardSig = sig => child.kill(sig);
    process.once('SIGINT', forwardSig);
    process.once('SIGTERM', forwardSig);
    child.on('error', err => {
      process.off('SIGINT', forwardSig);
      process.off('SIGTERM', forwardSig);
      rejectRun(err);
    });
    child.on('close', (code, signal) => {
      process.off('SIGINT', forwardSig);
      process.off('SIGTERM', forwardSig);
      const exitCode = code ?? (signal ? 1 : 0);
      resolveRun({
        ok: exitCode === 0,
        delegated: true,
        studioSource: studio.source,
        exitCode,
        command: mode,
        studioCommand,
        port,
        tab: targetTab,
        forwardedArgs: sanitizedArgs,
        ...(stdio === 'pipe' ? { stdout, stderr } : {}),
      });
    });
  });
}
