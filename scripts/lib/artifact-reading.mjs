// @feature ACA28
// @scenario S-154,S-155,S-156,S-157,S-158
// Domain assembly only. Markdown and diagrams remain owned by their providers.
import { readFile, writeFile, mkdir, readdir, lstat, realpath, mkdtemp, rm } from 'node:fs/promises';
import { dirname, basename, resolve, relative, join, extname, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { parse as parseJavaScript } from 'acorn';
import { validateDocument } from 'skill-family-contracts';
import { resolveContained, readFileContained, computeResourceClosure, digestBytes,
  createFixedSetPublicationManifest, publishFixedSet, replaceFixedSetAtomic } from 'skill-family-harness-node';
import { inspectArtifactGraphRuntime } from './artifact-graph-runtime.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const runFile = promisify(execFile);
const assistantManifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
const expectedDocsVersion = assistantManifest.dependencies?.['skill-family-doc-render'];
const schema = JSON.parse(await readFile(join(packageRoot, 'schemas/artifact-reading.schema.json'), 'utf8'));
const templateRoot = join(packageRoot, 'templates/core/artifact-reading');
const MODEL = 'reading-build.json';
const hash = bytes => `sha256:${digestBytes(bytes)}`;
const slash = value => value.replaceAll('\\', '/');
const inside = (parent, child) => child === parent || child.startsWith(`${parent}/`);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function fail(message, details) { const error = new Error(message); if (details) error.details = details; throw error; }
function validate(value, kind) {
  const selected = { ...schema, $id: `${schema.$id}/${kind}`, oneOf: [{ $ref: `#/$defs/${kind}` }] };
  const result = validateDocument(value, { schema: selected, dialect: '2020-12', policy: 'strict' });
  if (!result.valid) fail(`阅读${kind}不符合合同`, result.errors);
}
async function json(root, path) { return JSON.parse(await readFileContained(root, path, { encoding: 'utf8' })); }
async function write(root, path, content) {
  const target = await resolveContained(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
async function files(root, sub = '') {
  const result = [];
  for (const entry of await readdir(join(root, sub), { withFileTypes: true })) {
    const path = slash(join(sub, entry.name));
    if (entry.isSymbolicLink()) fail(`生成树不接受符号链接：${path}`);
    if (entry.isDirectory()) result.push(...await files(root, path));
    else if (entry.isFile()) result.push(path);
    else fail(`生成树不是普通文件：${path}`);
  }
  return result.sort();
}
async function exists(path) { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
function docsRuntime() {
  const manifestPath = require.resolve('skill-family-doc-render/package.json');
  return { manifestPath, cli: join(dirname(manifestPath), 'bin/skill-family-doc-render.mjs') };
}
async function docsConfigurationName() {
  // The provider publishes its configuration schema. Derive its file identity
  // there instead of maintaining a second filename authority in the assistant.
  const runtime = docsRuntime();
  const contract = JSON.parse(await readFile(join(dirname(runtime.manifestPath), 'schemas/public-release.schema.json'), 'utf8'));
  const name = contract.title;
  if (typeof name !== 'string' || basename(name) !== name || !name.endsWith('.json')) fail('Docs公开配置Schema未给出安全的文件身份。');
  return name;
}
async function docs(root, check = false) {
  const runtime = docsRuntime();
  const manifest = JSON.parse(await readFile(runtime.manifestPath, 'utf8'));
  if (!expectedDocsVersion || manifest.version !== expectedDocsVersion) fail(`Docs 版本必须为 ${expectedDocsVersion}，实际为 ${manifest.version}`);
  try { await runFile(process.execPath, [runtime.cli, ...(check ? ['--check'] : []), '--repo', 'reading'], { cwd: root, maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) { fail('Docs CLI 执行失败', { exitCode: error.code, stdout: error.stdout, stderr: error.stderr }); }
}

async function load(options) {
  const root = await realpath(resolve(options.root));
  const config = await json(root, options.config);
  validate(config, 'config');
  const outputPath = options.output ?? config.output;
  const output = await resolveContained(root, outputPath);
  const runtime = await inspectArtifactGraphRuntime({ projectRoot: root });
  if (!runtime.ok) fail('Graph 运行时不可用', runtime);
  const pkg = JSON.parse(await readFile(runtime.packagePath, 'utf8'));
  const api = await import(pathToFileURL(join(dirname(runtime.packagePath), pkg.exports['.'].import.default)).href);
  const graph = await api.scanArtifacts(root, await api.loadConfig(root));
  const nodeByUid = new Map(graph.nodes.map(node => [node.uid, node]));
  const selected = new Set([options.config, 'artifact-graph.config.yaml']);
  const deliveredSources = new Set();
  const documents = [], figures = [], ids = new Set(), targets = new Set(), figureIds = new Set();
  for (const path of config.inputs) {
    selected.add(path);
    const projection = await json(root, path); validate(projection, 'projection');
    for (const document of projection.documents) {
      if (ids.has(document.pageId) || targets.has(document.target)) fail(`重复阅读身份：${document.target}/${document.pageId}`);
      ids.add(document.pageId); targets.add(document.target);
      const node = nodeByUid.get(document.target);
      if (!node) fail(`Graph 中没有目标：${document.target}`);
      const source = await readFileContained(root, node.path);
      const markdown = await readFileContained(root, document.markdown);
      const actualSourceRevision = hash(source);
      if (actualSourceRevision !== document.sourceRevision) {
        fail(
          `原件修订不匹配：${document.target}（输入文件 ${path} 期望摘要 ${document.sourceRevision}，原件 ${node.path} 实际摘要 ${actualSourceRevision}；请先核对原件改动并同步更新阅读文稿及输入描述中的 sourceRevision / markdownRevision，再运行 node scripts/artifact-reading.mjs build --root <项目根> --config ${options.config} 刷新阅读包）`,
          { target: document.target, inputPath: path, sourcePath: node.path, expectedRevision: document.sourceRevision, actualRevision: actualSourceRevision },
        );
      }
      const actualMarkdownRevision = hash(markdown);
      if (actualMarkdownRevision !== document.markdownRevision) {
        fail(
          `文章修订不匹配：${document.pageId}（输入文件 ${path} 期望摘要 ${document.markdownRevision}，文章 ${document.markdown} 实际摘要 ${actualMarkdownRevision}；请确认定稿内容无误后将 ${path} 中的 markdownRevision 更新为 ${actualMarkdownRevision}，再运行 node scripts/artifact-reading.mjs build --root <项目根> --config ${options.config} 刷新阅读包）`,
          { pageId: document.pageId, inputPath: path, markdownPath: document.markdown, expectedRevision: document.markdownRevision, actualRevision: actualMarkdownRevision },
        );
      }
      selected.add(node.path); selected.add(document.markdown);
      deliveredSources.add(node.path); deliveredSources.add(document.markdown);
      if (document.coverage) { selected.add(document.coverage); deliveredSources.add(document.coverage); }
      const current = { ...document, source: node.path, markdownText: markdown.toString('utf8') };
      documents.push(current);
      for (const figure of document.figures ?? []) {
        if (figureIds.has(figure.id)) fail(`重复图身份：${figure.id}`);
        figureIds.add(figure.id);
        figures.push({ ...figure, pageId: document.pageId });
        for (const resource of [figure.html, figure.svg, ...figure.resources].filter(Boolean)) selected.add(resource);
      }
    }
  }
  for (const figure of figures) {
    if (figure.parent && (!figureIds.has(figure.parent) || figure.parent === figure.id)) fail(`图的父入口无效：${figure.id}`);
    const seen = new Set([figure.id]); let parent = figure.parent;
    while (parent) { if (seen.has(parent)) fail(`图导航循环：${figure.id}`); seen.add(parent); parent = figures.find(item => item.id === parent)?.parent; }
    for (const binding of figure.bindings) if (!ids.has(binding.pageId)) fail(`图绑定指向未选择页面：${binding.pageId}`);
  }
  const resources = [];
  for (const path of selected) {
    const absolute = await resolveContained(root, path);
    if (inside(slash(output), slash(absolute)) || inside(slash(absolute), slash(output))) fail(`源与输出重叠：${path}`);
    if (!(await lstat(absolute)).isFile()) fail(`输入不是普通文件：${path}`);
    resources.push({ path, role: 'input' });
  }
  const inputs = await computeResourceClosure({ root, resources });
  return { root, config, output, outputPath, documents, figures, selected: [...selected].sort(), deliveredSources: [...deliveredSources].sort(), docResources: [], inputs };
}

// The same layout is retained for native HTML/CSS/JS dependencies. Only declared
// resources are copied, then actual references are checked rather than guessed.
function referencePath(origin, raw) {
  if (!raw || raw === '#') return null;
  if (/^(?:data:|blob:)/i.test(raw)) return null;
  if (/^(?:https?:|mailto:|tel:)/i.test(raw)) return { external: raw };
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw) || raw.startsWith('/')) fail(`不允许的运行时引用：${origin} -> ${raw}`);
  let decoded;
  try { decoded = decodeURIComponent(raw.split('#')[0].split('?')[0]); } catch { fail(`资源 URL 编码错误：${origin}`); }
  const fragment = raw.includes('#') ? decodeURIComponent(raw.slice(raw.indexOf('#') + 1)) : '';
  const path = decoded ? posix.normalize(posix.join(posix.dirname(origin), decoded)) : origin;
  if (path === '..' || path.startsWith('../') || posix.isAbsolute(path)) fail(`资源引用越界：${origin} -> ${raw}`);
  return { path, fragment };
}
function attributeValue(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    return named[entity.toLowerCase()] ?? String.fromCodePoint(entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10));
  });
}
function references(text, extension) {
  const result = [];
  const styles = extension === '.css' ? [text] : [];
  const scripts = ['.js', '.mjs'].includes(extension) ? [{ text, sourceType: extension === '.mjs' ? 'module' : 'script' }] : [];
  if (['.html', '.svg'].includes(extension)) {
    // Raw script/style bodies have their own language. In particular, JavaScript
    // new URL(...) is not a CSS url(...) dependency or an HTML attribute.
    const markup = text.replace(/<!--[\s\S]*?-->|<(script|style)\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/\1\s*>/gi, (_, name, attrs, body) => {
      if (!name) return '';
      const type = [...attrs.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)].find(attr => attr[1].toLowerCase() === 'type');
      const language = attributeValue(type?.[2] ?? type?.[3] ?? type?.[4] ?? '').trim().toLowerCase();
      if (name.toLowerCase() === 'style') { if (!language || language === 'text/css') styles.push(body); }
      else if (!language || /^(?:module|(?:text|application)\/(?:java|ecma)script)$/.test(language)) scripts.push({ text: body, sourceType: language === 'module' ? 'module' : 'script' });
      return `<${name}${attrs}>`;
    });
    for (const tag of markup.matchAll(/<([A-Za-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
      const name = tag[1].toLowerCase();
      for (const attr of tag[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
        const key = attr[1].toLowerCase();
        const raw = attributeValue(attr[2] ?? attr[3] ?? attr[4]);
        if (['href', 'xlink:href', 'src', 'poster', 'data'].includes(key)) {
          if (key === 'data' && name !== 'object') continue;
          result.push({ raw, resource: !['href', 'xlink:href'].includes(key) || ['link', 'image', 'use'].includes(name) });
        }
        if (key === 'srcset') for (const candidate of raw.split(',')) {
          const path = candidate.trim().split(/\s+/)[0];
          if (path) result.push({ raw: path, resource: true });
        }
        if (['style', 'fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker', 'marker-start', 'marker-mid', 'marker-end', 'cursor'].includes(key)) styles.push(raw);
      }
    }
  }
  for (const style of styles) {
    const css = style.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\([a-f0-9]{1,6})\s?|\\(.)/gi, (_, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16) || 0xfffd) : char);
    for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) result.push({ raw: (match[1] ?? match[2] ?? match[3]).trim(), resource: true });
    for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) result.push({ raw: match[1], resource: true });
  }
  for (const script of scripts) {
    // Parse the published language rather than matching keywords inside quoted
    // strings, comments or regex literals in a provider's native viewer.
    const tree = parseJavaScript(script.text, { ecmaVersion: 'latest', sourceType: script.sourceType, allowImportExportEverywhere: true, allowAwaitOutsideFunction: true });
    const pending = [tree];
    while (pending.length) {
      const node = pending.pop();
      let source;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) source = node.source;
      if (node.type === 'CallExpression' && (node.callee.type === 'Identifier' && node.callee.name === 'fetch' ||
          node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'fetch')) source = node.arguments[0];
      if (source?.type === 'Literal' && typeof source.value === 'string') result.push({ raw: source.value, resource: true });
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
        else if (value?.type) pending.push(value);
      }
    }
  }
  return result;
}
async function inspectLinks(root, paths) {
  const set = new Set(paths), texts = new Map();
  for (const path of paths) if (['.html', '.svg', '.css', '.js', '.mjs'].includes(extname(path))) texts.set(path, await readFileContained(root, path, { encoding: 'utf8' }));
  for (const [origin, text] of texts) for (const ref of references(text, extname(origin))) {
    const target = referencePath(origin, ref.raw); if (!target) continue;
    if (target.external) { if (ref.resource) fail(`阅读资源依赖外部网络：${origin} -> ${ref.raw}`); continue; }
    if (!set.has(target.path)) fail(`阅读资源缺失：${origin} -> ${ref.raw}`);
    if (target.fragment && ['.html', '.svg'].includes(extname(target.path))) {
      const targetText = texts.get(target.path) ?? '';
      const ids = [...targetText.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
      if (!ids.includes(target.fragment)) fail(`阅读锚点不存在：${origin} -> ${ref.raw}`);
    }
  }
}
async function validateBindings(root, data) {
  for (const figure of data.figures) {
    const native = await readFileContained(root, `visual/${figure.svg ?? figure.html}`, { encoding: 'utf8' });
    const ids = new Set([...native.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]));
    for (const binding of figure.bindings) {
      if (!ids.has(binding.nodeId)) fail(`图节点不存在：${figure.id}/${binding.nodeId}`);
      const html = await readFileContained(root, `articles/${binding.pageId}.html`, { encoding: 'utf8' });
      const anchors = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]));
      if (!anchors.has(binding.anchor)) fail(`文章锚点不存在：${binding.pageId}#${binding.anchor}`);
    }
  }
}

async function populate(staging, data) {
  const pages = data.documents.map((doc, index) => ({ id: doc.pageId, title: doc.title, role: index === 0 ? 'overview' : 'reference', kind: index === 0 ? 'home' : 'reference', group: 'documents', order: index, inPager: false }));
  for (const document of data.documents) await write(staging, `.docs-src/${document.pageId}.md`, document.markdownText);
  // Docs owns Markdown interpretation and SVG safety. Supply only explicitly
  // selected SVG bytes, retaining both project-relative and article-relative
  // names where contained; do not parse or rewrite image syntax ourselves.
  for (const document of data.documents) for (const figure of document.figures ?? []) {
    for (const path of [figure.svg, ...figure.resources].filter(path => path && extname(path) === '.svg')) {
      const bytes = await readFileContained(data.root, path);
      const articleRelative = slash(relative(dirname(document.markdown), path));
      const names = new Set([slash(path), ...(!articleRelative.startsWith('../') && articleRelative !== '..' ? [articleRelative] : [])]);
      for (const name of names) {
        const destination = `.docs-src/${name}`;
        if (await exists(join(staging, destination)) && !(await readFileContained(staging, destination)).equals(bytes)) fail(`正文资源名称冲突：${name}`);
        await write(staging, destination, bytes);
        data.docResources.push([destination, path]);
      }
    }
  }
  await write(staging, '.docs-src/pages.json', JSON.stringify({ site: { title: data.config.title, description: '当前选中资料的完整阅读稿；范围由制作方说明。', productKind: data.config.productKind }, groups: [{ id: 'documents', title: '阅读资料' }], pages }, null, 2));
  await write(staging, 'package.json', JSON.stringify({ name: 'artifact-reading-output', version: '0.1.0', private: true }));
  await write(staging, await docsConfigurationName(), JSON.stringify({ repos: [{ name: 'reading', source: '.', site: { dir: '.docs-src', target: 'articles', pages: 'pages.json', format: 'markdown-v1', template: 'editorial' } }] }, null, 2));
  await docs(staging);
  for (const path of data.deliveredSources) await write(staging, `sources/${path}`, await readFileContained(data.root, path));
  for (const figure of data.figures) for (const path of [figure.html, figure.svg, ...figure.resources].filter(Boolean)) await write(staging, `visual/${path}`, await readFileContained(data.root, path));
  const model = { title: data.config.title, documents: data.documents.map(({ pageId, title, target, sourceRevision, markdownRevision, source }) => ({ pageId, title, target, sourceRevision, markdownRevision, source: `sources/${source}` })), figures: data.figures };
  const template = await readFile(join(templateRoot, 'index.html.tpl'), 'utf8');
  const modelText = JSON.stringify(model).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  await write(staging, 'index.html', template.replaceAll('{{TITLE}}', esc(data.config.title)).replace('{{MODEL}}', modelText));
  for (const name of ['reading.js', 'reading.css']) await write(staging, `assets/${name}`, await readFile(join(templateRoot, name)));
  await write(staging, 'READING.md', await readFile(join(templateRoot, 'reader.md')));
  await docs(staging, true);
  await validateBindings(staging, data);
  const paths = await files(staging); await inspectLinks(staging, paths);
  const output = await computeResourceClosure({ root: staging, resources: paths.map(path => ({ path, role: 'input' })) });
  await write(staging, MODEL, JSON.stringify({ schemaVersion: 1, inputs: data.inputs, output }, null, 2));
}

async function verifyPreparedInputs(staging, data) {
  const expected = new Map(data.inputs.resources.map(entry => [entry.path, entry.sha256]));
  for (const document of data.documents) {
    if (hash(await readFileContained(data.root, document.source)) !== document.sourceRevision ||
        hash(await readFileContained(data.root, document.markdown)) !== document.markdownRevision) fail(`构建期间修订发生变化：${document.target}`);
    if (hash(await readFileContained(staging, `.docs-src/${document.pageId}.md`)) !== document.markdownRevision) fail(`已装配正文修订不匹配：${document.pageId}`);
  }
  const copied = [...data.docResources, ...data.deliveredSources.map(path => [`sources/${path}`, path])];
  for (const figure of data.figures) for (const path of [figure.html, figure.svg, ...figure.resources].filter(Boolean)) copied.push([`visual/${path}`, path]);
  for (const [destination, source] of copied) if (digestBytes(await readFileContained(staging, destination)) !== expected.get(posix.normalize(slash(source)))) fail(`构建期间资源发生变化：${source}`);
  const current = await computeResourceClosure({ root: data.root, resources: data.selected.map(path => ({ path, role: 'input' })) });
  if (current.digest !== data.inputs.digest) fail('构建期间输入发生变化；保留旧输出，重新核对制作修订。');
}

// Exposed only to tests of the caller's post-commit handling; production always
// uses the exact Foundation functions, with no alternative filesystem algorithm.
export async function commitReadingDirectory(staging, output, operations = { createFixedSetPublicationManifest, publishFixedSet, replaceFixedSetAtomic }) {
  const args = { sourceRoot: staging, targetParent: dirname(output), targetSegment: basename(output) };
  if (await exists(output)) return operations.replaceFixedSetAtomic(args);
  const manifest = await operations.createFixedSetPublicationManifest(args);
  const result = await operations.publishFixedSet({ ...args, manifest });
  if (result.status !== 'succeeded') fail('阅读目录发布未成功；保留暂存材料', { ...result, staging });
  return result;
}
export async function buildReading(options) {
  const data = await load(options);
  await mkdir(dirname(data.output), { recursive: true });
  if (await exists(data.output)) {
    // Refuse adopting an unrelated directory as generated output.
    const previous = await json(data.output, MODEL);
    if (previous.schemaVersion !== 1 || !previous.output?.resources) fail('目标不是本工具生成的阅读目录');
  }
  const staging = await mkdtemp(join(dirname(data.output), '.artifact-reading-'));
  try { await populate(staging, data); await verifyPreparedInputs(staging, data); }
  catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  // No finally cleanup: an exchange may have committed before a failure was reported.
  try { const result = await commitReadingDirectory(staging, data.output); return { output: data.outputPath, documents: data.documents.length, figures: data.figures.length, publication: result }; }
  catch (error) { fail(error.message, { ...error.details, staging, output: data.outputPath, recovery: '按实际提交阶段保留两侧材料；不自动回滚或重试。Windows原目录替换不可用时，可用 --output 指定新目录。' }); }
}
export async function checkReading(options) {
  const data = await load(options);
  const built = await json(data.output, MODEL);
  if (built.schemaVersion !== 1 || built.inputs?.digest !== data.inputs.digest) fail('阅读输出已过时，需明确制作或重建后再检查。');
  const paths = (await files(data.output)).filter(path => path !== MODEL);
  const actual = await computeResourceClosure({ root: data.output, resources: paths.map(path => ({ path, role: 'input' })) });
  if (actual.digest !== built.output?.digest) fail('阅读输出已修改、缺失或多出文件。');
  await docs(data.output, true); await validateBindings(data.output, data); await inspectLinks(data.output, paths);
  return { output: data.outputPath, documents: data.documents.length, figures: data.figures.length };
}
export async function bundleReading(options) {
  const checked = await checkReading(options);
  const root = await realpath(resolve(options.root));
  const source = await resolveContained(root, checked.output);
  const output = await resolveContained(root, options.out);
  if (inside(slash(source), slash(output)) || inside(slash(output), slash(source))) fail('导出目录与生成目录不能重叠。');
  if (await exists(output)) fail('导出目录已存在，拒绝覆盖。');
  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(join(dirname(output), '.artifact-reading-bundle-'));
  try { for (const path of await files(source)) await write(staging, path, await readFileContained(source, path)); await inspectLinks(staging, await files(staging)); }
  catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  // New-directory-only even if another writer creates the destination meanwhile.
  const args = { sourceRoot: staging, targetParent: dirname(output), targetSegment: basename(output) };
  try {
    const manifest = await createFixedSetPublicationManifest(args);
    const result = await publishFixedSet({ ...args, manifest });
    if (result.status !== 'succeeded') fail('阅读包导出未成功', result);
    return { ...checked, bundle: options.out };
  } catch (error) { fail(error.message, { ...error.details, staging }); }
}
export async function previewReading(options) {
  const root = await realpath(resolve(options.root)); const config = await json(root, options.config); validate(config, 'config');
  const outputPath = options.output ?? config.output; const output = await resolveContained(root, outputPath);
  const built = await json(output, MODEL); if (built.schemaVersion !== 1) fail('没有已构建阅读结果。');
  const server = createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const url = new URL(req.url, 'http://127.0.0.1');
      const path = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
      const bytes = await readFileContained(output, path);
      const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' }[extname(path)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(options.port ?? 0, '127.0.0.1', yes); });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}
