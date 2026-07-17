#!/usr/bin/env node
// @scenario S-42 @feature ACA13
// @decision D-ACA-15
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

// Plugin root is always one level up from test/
const PLUGIN_ROOT = join(import.meta.dirname, '..');

// In the parent repo, docs live at docs/public/artifact-chain-assistant/.
// In the snapshot, they live at the plugin root.
// Detect which context by checking for the parent repo path.
const PARENT_REPO_ROOT = join(PLUGIN_ROOT, '..', '..');
const PARENT_DOCS_DIR = join(PARENT_REPO_ROOT, 'docs', 'public', 'artifact-chain-assistant');

async function resolveDocPath(filename) {
  // Try parent repo path first, fall back to plugin root (snapshot context)
  const parentPath = join(PARENT_DOCS_DIR, filename);
  try {
    await access(parentPath);
    return parentPath;
  } catch {
    return join(PLUGIN_ROOT, filename);
  }
}

const INSTALL_PATH = await resolveDocPath('INSTALL.md');
const README_EN_PATH = await resolveDocPath('README.md');
const README_ZH_PATH = await resolveDocPath('README.zh-CN.md');

async function readUtf8(path) {
  return readFile(path, 'utf8');
}

/**
 * Detect whether we're in the parent repo (has AGENTS.md at repo root)
 * or in a standalone snapshot. Parent-repo-only tests are skipped in snapshot.
 */
async function isInParentRepo() {
  try {
    await access(join(PARENT_REPO_ROOT, 'AGENTS.md'));
    return true;
  } catch {
    return false;
  }
}

// --- INSTALL.md contract tests ---

test('INSTALL.md contains precise npm install command', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /pnpm add -D artifact-graph@0.5.0/);
});

test('INSTALL.md contains GitHub fallback with precise tag', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /github:mzdbxqh\/artifact-graph#artifact-graph-v0.5.0/);
});

test('INSTALL.md mentions artifact-chain-bootstrap', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /artifact-chain-bootstrap/);
});

test('INSTALL.md mentions where-am-i', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /where-am-i/);
});

test('INSTALL.md mentions artifact-chain-maintainer', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /artifact-chain-maintainer/);
});

test('INSTALL.md contains clone onboarding with frozen lockfile', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /pnpm install --frozen-lockfile/);
});

test('INSTALL.md warns against bootstrap --force', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /bootstrap --force/i);
});

/**
 * Extract all fenced code block contents from markdown.
 */
function extractCodeBlocks(markdown) {
  const blocks = [];
  const re = /```[\w-]*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join('\n');
}

test('INSTALL.md code blocks do not contain forbidden unlocked npm install pattern', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const codeBlocks = extractCodeBlocks(content);
  const forbidden = /pnpm\s+add\s+-D\s+artifact-graph\s*$/gm;
  assert.ok(!forbidden.test(codeBlocks), 'INSTALL.md code blocks must not contain unlocked artifact-graph install');
});

test('INSTALL.md code blocks do not contain artifact-graph@latest', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const codeBlocks = extractCodeBlocks(content);
  assert.ok(!codeBlocks.includes('artifact-graph@latest'), 'INSTALL.md code blocks must not contain @latest');
});

test('INSTALL.md code blocks do not contain artifact-graph with caret range', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const codeBlocks = extractCodeBlocks(content);
  assert.ok(!codeBlocks.includes('artifact-graph@^'), 'INSTALL.md code blocks must not contain caret range');
});

test('INSTALL.md code blocks do not contain unlocked GitHub repo (no tag)', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const codeBlocks = extractCodeBlocks(content);
  const forbidden = /github:mzdbxqh\/artifact-graph\s*$/gm;
  assert.ok(!forbidden.test(codeBlocks), 'INSTALL.md code blocks must not contain unlocked GitHub repo');
});

// --- README contract tests ---

test('English README contains version 0.5.0 reference', async () => {
  const content = await readUtf8(README_EN_PATH);
  assert.match(content, /0.5.0/);
});

test('English README links to INSTALL.md', async () => {
  const content = await readUtf8(README_EN_PATH);
  assert.match(content, /INSTALL\.md|INSTALL/);
});

test('Chinese README contains version 0.5.0 reference', async () => {
  const content = await readUtf8(README_ZH_PATH);
  assert.match(content, /0.5.0/);
});

test('Chinese README links to INSTALL.md', async () => {
  const content = await readUtf8(README_ZH_PATH);
  assert.match(content, /INSTALL\.md|INSTALL/);
});

test('English README code blocks do not contain forbidden install patterns', async () => {
  const content = await readUtf8(README_EN_PATH);
  const codeBlocks = extractCodeBlocks(content);
  assert.ok(!codeBlocks.includes('artifact-graph@latest'), 'README code blocks must not contain @latest');
  assert.ok(!codeBlocks.includes('artifact-graph@^'), 'README code blocks must not contain caret range');
});

test('Chinese README code blocks do not contain forbidden install patterns', async () => {
  const content = await readUtf8(README_ZH_PATH);
  const codeBlocks = extractCodeBlocks(content);
  assert.ok(!codeBlocks.includes('artifact-graph@latest'), 'README code blocks must not contain @latest');
  assert.ok(!codeBlocks.includes('artifact-graph@^'), 'README code blocks must not contain caret range');
});

// --- AGENTS.md authority boundary (parent repo only) ---

test('AGENTS.md contains docs/public authoring source boundary', { skip: !(await isInParentRepo()) }, async () => {
  const content = await readUtf8(join(PARENT_REPO_ROOT, 'AGENTS.md'));
  assert.match(content, /docs\/public\/artifact-chain-assistant\/INSTALL\.md/);
  assert.match(content, /authoring source of truth|authoring source/);
});

test('AGENTS.md states plugin INSTALL is generated copy', { skip: !(await isInParentRepo()) }, async () => {
  const content = await readUtf8(join(PARENT_REPO_ROOT, 'AGENTS.md'));
  assert.match(content, /render-public-docs\.mjs/);
  assert.match(content, /不得直接编辑或反向同步/);
});

// --- .gitignore (parent repo only) ---

test('.gitignore ignores .artifact-graph/ directory', { skip: !(await isInParentRepo()) }, async () => {
  const content = await readUtf8(join(PARENT_REPO_ROOT, '.gitignore'));
  assert.match(content, /\.artifact-graph\//);
});

test('.gitignore ignores .agent-method-registry/ directory', { skip: !(await isInParentRepo()) }, async () => {
  const content = await readUtf8(join(PARENT_REPO_ROOT, '.gitignore'));
  assert.match(content, /\.agent-method-registry\//);
});

// --- Goal 2: No require.resolve in public docs ---

test('no public README or INSTALL contains require.resolve for plugin root discovery', async () => {
  const docs = [INSTALL_PATH, README_EN_PATH, README_ZH_PATH];
  for (const docPath of docs) {
    const content = await readUtf8(docPath);
    assert.doesNotMatch(
      content,
      /require\.resolve\(['"]artifact-chain-assistant\/package\.json['"]\)/,
      `${docPath} must not use require.resolve('artifact-chain-assistant/package.json') for plugin root discovery`,
    );
  }
});

test('INSTALL.md contains Codex CLI JSON root discovery', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /codex plugin list --json/);
});

test('INSTALL.md contains Claude CLI JSON root discovery', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /claude plugin list --json/);
});

test('INSTALL.md contains agent-methods/catalog.yaml existence check', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /agent-methods\/catalog\.yaml/);
});

test('INSTALL.md uses installed adapter skills path, not adapters/<host>/skills', async () => {
  const content = await readUtf8(INSTALL_PATH);
  // Should reference $PLUGIN_ROOT/skills for marketplace installs, not $PLUGIN_ROOT/adapters/<host>/skills
  assert.doesNotMatch(
    content,
    /\$PLUGIN_ROOT\/adapters\/(codex|claude)\/skills/,
    'INSTALL.md must use $PLUGIN_ROOT/skills for installed adapter skills, not $PLUGIN_ROOT/adapters/<host>/skills',
  );
});

test('English README does not contain require.resolve for plugin root', async () => {
  const content = await readUtf8(README_EN_PATH);
  assert.doesNotMatch(
    content,
    /require\.resolve\(['"]artifact-chain-assistant\/package\.json['"]\)/,
    'English README must not use require.resolve for plugin root discovery',
  );
});

test('Chinese README does not contain require.resolve for plugin root', async () => {
  const content = await readUtf8(README_ZH_PATH);
  assert.doesNotMatch(
    content,
    /require\.resolve\(['"]artifact-chain-assistant\/package\.json['"]\)/,
    'Chinese README must not use require.resolve for plugin root discovery',
  );
});

// --- Goal 3: Plugin doctor in clone recovery ---

test('clone recovery uses plugin doctor, not runtime doctor directly', async () => {
  const content = await readUtf8(INSTALL_PATH);
  assert.match(content, /scripts\/doctor\.mjs/);
  // Must not label pnpm exec artifact-graph doctor as "plugin version diagnostic"
  const codeBlocks = extractCodeBlocks(content);
  assert.doesNotMatch(
    codeBlocks,
    /pnpm exec artifact-graph doctor.*plugin.*diagnostic/i,
    'clone recovery must not label runtime doctor as plugin diagnostic',
  );
});

// --- Goal 4: EXTENDED-ARTIFACT-CATALOG no longer claims Roadmap for custom types ---

test('EXTENDED-ARTIFACT-CATALOG does not claim custom types runtime is Roadmap', async () => {
  const content = await readUtf8(await resolveDocPath('EXTENDED-ARTIFACT-CATALOG.md'));
  assert.doesNotMatch(
    content,
    /Roadmap for artifact-graph runtime|Roadmap.*custom types|custom types.*Roadmap/i,
    'EXTENDED-ARTIFACT-CATALOG must not claim custom types runtime support is Roadmap',
  );
});

test('EXTENDED-ARTIFACT-CATALOG capability matrix uses Implemented for custom types', async () => {
  const content = await readUtf8(await resolveDocPath('EXTENDED-ARTIFACT-CATALOG.md'));
  // The capability matrix should use --target for extended types, not generic --{type} flags
  assert.match(content, /--target <type>:<id>/);
  assert.doesNotMatch(
    content,
    /Generic `--\{type\}` flags are not available yet|通用 `--\{type\}` flag 尚不可用/,
    'Capability matrix should not claim --{type} flags are unavailable; --target is the universal entry',
  );
});

test('Chinese EXTENDED-ARTIFACT-CATALOG does not claim custom types runtime is Roadmap', async () => {
  const content = await readUtf8(await resolveDocPath('EXTENDED-ARTIFACT-CATALOG.zh-CN.md'));
  assert.doesNotMatch(
    content,
    /路线图.*自定义类型|自定义类型.*路线图|Roadmap.*custom types|custom types.*Roadmap/i,
    'Chinese EXTENDED-ARTIFACT-CATALOG must not claim custom types runtime support is Roadmap',
  );
});

// --- Fixture-based JSON root discovery verification ---

test('Codex JSON root discovery extracts versioned cache root from fixture JSON', async () => {
  // Simulate codex plugin list --json output (real schema: object with installed array)
  const fixtureJson = JSON.stringify({
    installed: [
      {
        pluginId: 'artifact-chain-assistant@artifact-chain-assistant',
        marketplaceName: 'artifact-chain-assistant',
        name: 'artifact-chain-assistant',
        version: '0.5.0',
        installed: true,
        enabled: true,
      },
    ],
  });

  // Extract using the same Node logic the docs describe
  const result = JSON.parse(fixtureJson);
  const plugin = result.installed.find(
    (p) => p.pluginId === 'artifact-chain-assistant@artifact-chain-assistant',
  );
  assert.ok(plugin, 'should find plugin by pluginId');
  assert.equal(plugin.installed, true);
  assert.equal(plugin.enabled, true);

  // Simulate path construction: ~/.codex/plugins/cache/<marketplaceName>/<name>/<version>
  const codexHome = '/home/user/.codex';
  const versionedRoot = join(
    codexHome,
    'plugins',
    'cache',
    plugin.marketplaceName,
    plugin.name,
    plugin.version,
  );
  assert.equal(
    versionedRoot,
    '/home/user/.codex/plugins/cache/artifact-chain-assistant/artifact-chain-assistant/0.5.0',
  );
});

test('Claude JSON root discovery extracts installPath from fixture JSON', async () => {
  // Simulate claude plugin list --json output (real schema: array with id field)
  const fixtureJson = JSON.stringify([
    {
      id: 'artifact-chain-assistant@artifact-chain-assistant',
      version: '0.5.0',
      scope: 'user',
      enabled: true,
      installPath: '/home/user/.claude/plugins/cache/artifact-chain-assistant/artifact-chain-assistant/0.5.0',
    },
  ]);

  const result = JSON.parse(fixtureJson);
  const plugin = result.find(
    (p) => p.id === 'artifact-chain-assistant@artifact-chain-assistant',
  );
  assert.ok(plugin, 'should find plugin by id');
  assert.equal(plugin.enabled, true);
  assert.match(plugin.installPath, /artifact-chain-assistant\/0.5.0$/);
});

// --- Document-equivalent parser execution tests ---

test('Codex parser handles CODEX_HOME with spaces via env (not shell interpolation)', async () => {
  const { execSync } = await import('node:child_process');
  const { writeFile, unlink, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  // Real Codex fixture
  const fixtureJson = JSON.stringify({
    installed: [
      {
        pluginId: 'artifact-chain-assistant@artifact-chain-assistant',
        marketplaceName: 'artifact-chain-assistant',
        name: 'artifact-chain-assistant',
        version: '0.5.0',
        installed: true,
        enabled: true,
      },
    ],
  });

  // Parser equivalent to document's logic
  const parserScript = `
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const data = JSON.parse(d);
  const p = data.installed.find(x => x.pluginId === 'artifact-chain-assistant@artifact-chain-assistant');
  if (!p || !p.installed || !p.enabled) {
    process.stderr.write('artifact-chain-assistant not found or not enabled\\n');
    process.exit(1);
  }
  const path = require('path');
  console.log(path.join(process.env.CODEX_HOME, 'plugins', 'cache', p.marketplaceName, p.name, p.version));
});
`;

  // Write parser to temp file to avoid shell escaping issues
  const tmpDir = await mkdtemp(join(tmpdir(), 'parser-'));
  const parserPath = join(tmpDir, 'codex-parser.cjs');
  await writeFile(parserPath, parserScript);

  try {
    // Test with space in path
    const codexHome = '/home/Test User/.codex';
    const result = execSync(`node ${parserPath}`, {
      input: fixtureJson,
      env: { ...process.env, CODEX_HOME: codexHome },
      encoding: 'utf8',
    }).trim();

    assert.equal(
      result,
      '/home/Test User/.codex/plugins/cache/artifact-chain-assistant/artifact-chain-assistant/0.5.0',
      'Must handle CODEX_HOME with spaces via process.env, not shell interpolation',
    );
  } finally {
    await unlink(parserPath).catch(() => {});
  }
});

test('Claude parser extracts installPath by id field', async () => {
  const { execSync } = await import('node:child_process');
  const { writeFile, unlink, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  // Real Claude fixture
  const fixtureJson = JSON.stringify([
    {
      id: 'artifact-chain-assistant@artifact-chain-assistant',
      version: '0.5.0',
      scope: 'user',
      enabled: true,
      installPath: '/home/user/.claude/plugins/cache/artifact-chain-assistant/artifact-chain-assistant/0.5.0',
    },
  ]);

  // Parser equivalent to document's logic
  const parserScript = `
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const data = JSON.parse(d);
  const p = data.find(x => x.id === 'artifact-chain-assistant@artifact-chain-assistant');
  if (!p || !p.enabled) {
    process.stderr.write('artifact-chain-assistant not found or not enabled\\n');
    process.exit(1);
  }
  console.log(p.installPath);
});
`;

  // Write parser to temp file to avoid shell escaping issues
  const tmpDir = await mkdtemp(join(tmpdir(), 'parser-'));
  const parserPath = join(tmpDir, 'claude-parser.cjs');
  await writeFile(parserPath, parserScript);

  try {
    const result = execSync(`node ${parserPath}`, {
      input: fixtureJson,
      encoding: 'utf8',
    }).trim();

    assert.equal(
      result,
      '/home/user/.claude/plugins/cache/artifact-chain-assistant/artifact-chain-assistant/0.5.0',
      'Must extract installPath by id field',
    );
  } finally {
    await unlink(parserPath).catch(() => {});
  }
});

test('Codex parser fails non-zero when plugin not found', async () => {
  const { execSync } = await import('node:child_process');
  const { writeFile, unlink, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  // Fixture with empty installed array
  const fixtureJson = JSON.stringify({ installed: [] });

  const parserScript = `
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const data = JSON.parse(d);
  const p = data.installed.find(x => x.pluginId === 'artifact-chain-assistant@artifact-chain-assistant');
  if (!p || !p.installed || !p.enabled) {
    process.stderr.write('artifact-chain-assistant not found or not enabled\\n');
    process.exit(1);
  }
  console.log('should not reach here');
});
`;

  // Write parser to temp file to avoid shell escaping issues
  const tmpDir = await mkdtemp(join(tmpdir(), 'parser-'));
  const parserPath = join(tmpDir, 'codex-parser-fail.cjs');
  await writeFile(parserPath, parserScript);

  try {
    assert.throws(
      () => execSync(`node ${parserPath}`, {
        input: fixtureJson,
        env: { ...process.env, CODEX_HOME: '/home/user/.codex' },
        encoding: 'utf8',
      }),
      (err) => err.status !== 0,
      'Must exit non-zero when plugin not found',
    );
  } finally {
    await unlink(parserPath).catch(() => {});
  }
});

test('Claude parser fails non-zero when plugin disabled', async () => {
  const { execSync } = await import('node:child_process');
  const { writeFile, unlink, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  // Fixture with disabled plugin
  const fixtureJson = JSON.stringify([
    {
      id: 'artifact-chain-assistant@artifact-chain-assistant',
      version: '0.5.0',
      scope: 'user',
      enabled: false,
      installPath: '/home/user/.claude/plugins/cache/artifact-chain-assistant/artifact-chain-assistant/0.5.0',
    },
  ]);

  const parserScript = `
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const data = JSON.parse(d);
  const p = data.find(x => x.id === 'artifact-chain-assistant@artifact-chain-assistant');
  if (!p || !p.enabled) {
    process.stderr.write('artifact-chain-assistant not found or not enabled\\n');
    process.exit(1);
  }
  console.log('should not reach here');
});
`;

  // Write parser to temp file to avoid shell escaping issues
  const tmpDir = await mkdtemp(join(tmpdir(), 'parser-'));
  const parserPath = join(tmpDir, 'claude-parser-fail.cjs');
  await writeFile(parserPath, parserScript);

  try {
    assert.throws(
      () => execSync(`node ${parserPath}`, {
        input: fixtureJson,
        encoding: 'utf8',
      }),
      (err) => err.status !== 0,
      'Must exit non-zero when plugin disabled',
    );
  } finally {
    await unlink(parserPath).catch(() => {});
  }
});

// --- Document pattern scanning tests ---

test('Codex docs must not use JSON.parse(d).find directly (real schema is object)', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const codeBlocks = extractCodeBlocks(content);

  // Extract only the Codex-specific code block
  const codexMatch = content.match(/\*\*Codex\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (codexMatch) {
    const codexBlock = codexMatch[1];
    assert.doesNotMatch(
      codexBlock,
      /JSON\.parse\(d\)\.find/,
      'Codex docs must access .installed before .find (real schema is {installed: [...]})',
    );
  }
});

test('Claude docs must use id field, not pluginId', async () => {
  const content = await readUtf8(INSTALL_PATH);

  // Extract Claude code block
  const claudeMatch = content.match(/\*\*Claude Code\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (claudeMatch) {
    const claudeBlock = claudeMatch[1];
    assert.doesNotMatch(
      claudeBlock,
      /pluginId/,
      'Claude docs must use id field, not pluginId',
    );
    assert.doesNotMatch(
      claudeBlock,
      /p\.installed/,
      'Claude docs must not check p.installed (field does not exist in real schema)',
    );
  }
});

test('README EN must not use adapters/<host>/skills paths', async () => {
  const content = await readUtf8(README_EN_PATH);
  assert.doesNotMatch(
    content,
    /<plugin-root>\/adapters\/(codex|claude)\/skills/,
    'README EN must use $PLUGIN_ROOT/skills, not <plugin-root>/adapters/<host>/skills',
  );
  assert.doesNotMatch(
    content,
    /\$PLUGIN_ROOT\/adapters\/(codex|claude)\/skills/,
    'README EN must use $PLUGIN_ROOT/skills, not $PLUGIN_ROOT/adapters/<host>/skills',
  );
});

test('README ZH must not use adapters/<host>/skills paths', async () => {
  const content = await readUtf8(README_ZH_PATH);
  assert.doesNotMatch(
    content,
    /<plugin-root>\/adapters\/(codex|claude)\/skills/,
    'README ZH must use $PLUGIN_ROOT/skills, not <plugin-root>/adapters/<host>/skills',
  );
  assert.doesNotMatch(
    content,
    /\$PLUGIN_ROOT\/adapters\/(codex|claude)\/skills/,
    'README ZH must use $PLUGIN_ROOT/skills, not $PLUGIN_ROOT/adapters/<host>/skills',
  );
});

test('README EN must use relative path for project overlay', async () => {
  const content = await readUtf8(README_EN_PATH);
  assert.doesNotMatch(
    content,
    /\$PLUGIN_ROOT\/agent-methods\/project\.yaml/,
    'README EN must use relative path agent-methods/project.yaml for project overlay',
  );
});

test('README ZH must use relative path for project overlay', async () => {
  const content = await readUtf8(README_ZH_PATH);
  assert.doesNotMatch(
    content,
    /\$PLUGIN_ROOT\/agent-methods\/project\.yaml/,
    'README ZH must use relative path agent-methods/project.yaml for project overlay',
  );
});

// --- Blocker 2 (documentation content): fail-closed checks in INSTALL.md ---

test('INSTALL.md Codex parser condition must fail-closed on marketplaceName', async () => {
  const content = await readUtf8(INSTALL_PATH);
  // Extract the if(...) condition from the Codex code block
  const codexMatch = content.match(/\*\*Codex\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (codexMatch) {
    const codexBlock = codexMatch[1];
    // The condition line: if(!p||!p.installed||!p.enabled) → must also include !p.marketplaceName
    const condMatch = codexBlock.match(/if\s*\(([^)]+)\)/);
    if (condMatch) {
      const condition = condMatch[1];
      assert.match(
        condition,
        /p\.marketplaceName/,
        'INSTALL.md Codex parser if-condition must check p.marketplaceName (not just use it in path)',
      );
    }
  }
});

test('INSTALL.md Codex parser condition must fail-closed on name and version', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const codexMatch = content.match(/\*\*Codex\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (codexMatch) {
    const codexBlock = codexMatch[1];
    const condMatch = codexBlock.match(/if\s*\(([^)]+)\)/);
    if (condMatch) {
      const condition = condMatch[1];
      assert.match(
        condition,
        /p\.name/,
        'INSTALL.md Codex parser if-condition must check p.name',
      );
      assert.match(
        condition,
        /p\.version/,
        'INSTALL.md Codex parser if-condition must check p.version',
      );
    }
  }
});

test('INSTALL.md Claude parser condition must fail-closed on installPath', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const claudeMatch = content.match(/\*\*Claude Code\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (claudeMatch) {
    const claudeBlock = claudeMatch[1];
    // The condition line: if(!p||!p.enabled) → must also include !p.installPath
    const condMatch = claudeBlock.match(/if\s*\(([^)]+)\)/);
    if (condMatch) {
      const condition = condMatch[1];
      assert.match(
        condition,
        /p\.installPath/,
        'INSTALL.md Claude parser if-condition must check p.installPath (not just use it in output)',
      );
    }
  }
});

test('README EN Codex parser condition must fail-closed on marketplaceName/name/version', async () => {
  const content = await readUtf8(README_EN_PATH);
  const codexMatch = content.match(/\*\*Codex\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (codexMatch) {
    const codexBlock = codexMatch[1];
    const condMatch = codexBlock.match(/if\s*\(([^)]+)\)/);
    if (condMatch) {
      const condition = condMatch[1];
      assert.match(condition, /p\.marketplaceName/, 'README EN Codex condition must check p.marketplaceName');
      assert.match(condition, /p\.name/, 'README EN Codex condition must check p.name');
      assert.match(condition, /p\.version/, 'README EN Codex condition must check p.version');
    }
  }
});

test('README EN Claude parser condition must fail-closed on installPath', async () => {
  const content = await readUtf8(README_EN_PATH);
  const claudeMatch = content.match(/\*\*Claude Code\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (claudeMatch) {
    const claudeBlock = claudeMatch[1];
    const condMatch = claudeBlock.match(/if\s*\(([^)]+)\)/);
    if (condMatch) {
      const condition = condMatch[1];
      assert.match(condition, /p\.installPath/, 'README EN Claude condition must check p.installPath');
    }
  }
});

test('README ZH Codex parser condition must fail-closed on marketplaceName/name/version', async () => {
  const content = await readUtf8(README_ZH_PATH);
  const codexMatch = content.match(/\*\*Codex\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (codexMatch) {
    const codexBlock = codexMatch[1];
    const condMatch = codexBlock.match(/if\s*\(([^)]+)\)/);
    if (condMatch) {
      const condition = condMatch[1];
      assert.match(condition, /p\.marketplaceName/, 'README ZH Codex condition must check p.marketplaceName');
      assert.match(condition, /p\.name/, 'README ZH Codex condition must check p.name');
      assert.match(condition, /p\.version/, 'README ZH Codex condition must check p.version');
    }
  }
});

test('README ZH Claude parser condition must fail-closed on installPath', async () => {
  const content = await readUtf8(README_ZH_PATH);
  const claudeMatch = content.match(/\*\*Claude Code\*\*[\s\S]*?```bash\n([\s\S]*?)```/);
  if (claudeMatch) {
    const claudeBlock = claudeMatch[1];
    const condMatch = claudeBlock.match(/if\s*\(([^)]+)\)/);
    if (condMatch) {
      const condition = condMatch[1];
      assert.match(condition, /p\.installPath/, 'README ZH Claude condition must check p.installPath');
    }
  }
});

// --- Blocker 1: CODEX_HOME export propagation ---

test('Codex docs must use export CODEX_HOME (not plain assignment)', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const codeBlocks = extractCodeBlocks(content);
  assert.match(
    codeBlocks,
    /export CODEX_HOME=/,
    'INSTALL.md Codex code blocks must use export CODEX_HOME so Node subprocess reads the value',
  );
  assert.doesNotMatch(
    codeBlocks,
    /(?:^|\n)CODEX_HOME="\$\{CODEX_HOME/,
    'INSTALL.md must not use plain CODEX_HOME= without export',
  );
});

test('README EN Codex section must use export CODEX_HOME', async () => {
  const content = await readUtf8(README_EN_PATH);
  const codeBlocks = extractCodeBlocks(content);
  assert.match(
    codeBlocks,
    /export CODEX_HOME=/,
    'README EN must use export CODEX_HOME for Node subprocess propagation',
  );
});

test('README ZH Codex section must use export CODEX_HOME', async () => {
  const content = await readUtf8(README_ZH_PATH);
  const codeBlocks = extractCodeBlocks(content);
  assert.match(
    codeBlocks,
    /export CODEX_HOME=/,
    'README ZH must use export CODEX_HOME for Node subprocess propagation',
  );
});

// --- Blocker 2: Claude JSON parser fail-closed for installPath ---

test('Claude parser fails non-zero when installPath is missing', async () => {
  const { execSync } = await import('node:child_process');
  const { writeFile, unlink, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  // Fixture with missing installPath
  const fixtureJson = JSON.stringify([
    {
      id: 'artifact-chain-assistant@artifact-chain-assistant',
      version: '0.5.0',
      scope: 'user',
      enabled: true,
    },
  ]);

  // Parser matching the document's current fail-closed check:
  // checks enabled and non-empty installPath
  const parserScript = `
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const data = JSON.parse(d);
  const p = data.find(x => x.id === 'artifact-chain-assistant@artifact-chain-assistant');
  if (!p || !p.enabled || !p.installPath) {
    process.stderr.write('artifact-chain-assistant not found, not enabled, or installPath missing\\n');
    process.exit(1);
  }
  console.log(p.installPath);
});
`;

  const tmpDir = await mkdtemp(join(tmpdir(), 'parser-'));
  const parserPath = join(tmpDir, 'claude-missing-installpath.cjs');
  await writeFile(parserPath, parserScript);

  try {
    assert.throws(
      () => execSync(`node ${parserPath}`, {
        input: fixtureJson,
        encoding: 'utf8',
      }),
      (err) => err.status !== 0,
      'Must exit non-zero when installPath is missing from Claude plugin record',
    );
  } finally {
    await unlink(parserPath).catch(() => {});
  }
});

// --- Codex fail-closed for required location fields ---

test('Codex parser fails non-zero when marketplaceName is missing', async () => {
  const { execSync } = await import('node:child_process');
  const { writeFile, unlink, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  // Fixture with marketplaceName missing
  const fixtureJson = JSON.stringify({
    installed: [
      {
        pluginId: 'artifact-chain-assistant@artifact-chain-assistant',
        name: 'artifact-chain-assistant',
        version: '0.5.0',
        installed: true,
        enabled: true,
      },
    ],
  });

  // Parser matching the document's fail-closed check for all required fields
  const parserScript = `
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const data = JSON.parse(d);
  const p = data.installed.find(x => x.pluginId === 'artifact-chain-assistant@artifact-chain-assistant');
  if (!p || !p.installed || !p.enabled || !p.marketplaceName || !p.name || !p.version) {
    process.stderr.write('artifact-chain-assistant record incomplete\\n');
    process.exit(1);
  }
  const path = require('path');
  console.log(path.join(process.env.CODEX_HOME, 'plugins', 'cache', p.marketplaceName, p.name, p.version));
});
`;

  const tmpDir = await mkdtemp(join(tmpdir(), 'parser-'));
  const parserPath = join(tmpDir, 'codex-missing-field.cjs');
  await writeFile(parserPath, parserScript);

  try {
    assert.throws(
      () => execSync(`node ${parserPath}`, {
        input: fixtureJson,
        env: { ...process.env, CODEX_HOME: '/home/user/.codex' },
        encoding: 'utf8',
      }),
      (err) => err.status !== 0,
      'Must exit non-zero when marketplaceName is missing from Codex plugin record',
    );
  } finally {
    await unlink(parserPath).catch(() => {});
  }
});

// --- Normal fixture regression: export CODEX_HOME still works ---

test('CODEX_HOME export propagation: Node subprocess receives default value', async () => {
  const { execSync } = await import('node:child_process');

  // Simulate the exact document pattern: export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
  // When CODEX_HOME is NOT in env, the shell expands $HOME/.codex and exports it.
  // The Node subprocess must read it via process.env.CODEX_HOME.
  const result = execSync(
    `bash -c 'unset CODEX_HOME; export CODEX_HOME="\${CODEX_HOME:-$HOME/.codex}"; node -e "process.stdout.write(process.env.CODEX_HOME)"'`,
    { encoding: 'utf8', env: { HOME: '/test-home', PATH: process.env.PATH } },
  );

  assert.equal(
    result,
    '/test-home/.codex',
    'Node subprocess must receive the exported CODEX_HOME default when unset',
  );
});

// --- Blocker 3: Clone Recovery Steps PLUGIN_ROOT self-containment ---

/**
 * Extract a markdown section (heading + body until next heading at same or higher level).
 * @param {string} markdown - full document
 * @param {string} headingText - exact heading text to match (e.g. "Recovery Steps")
 * @param {number} [level=3] - heading level (### = 3)
 * @returns {string|null} section body after the heading, or null if not found
 */
function extractSection(markdown, headingText, level = 3) {
  const prefix = '#'.repeat(level);
  const escaped = headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${prefix} ${escaped}\\s*$`, 'm');
  const match = re.exec(markdown);
  if (!match) return null;
  const afterHeading = markdown.slice(match.index + match[0].length);
  // Find next markdown heading at same or higher level.
  // Walk line-by-line, tracking code fences so bash comments inside ``` blocks are skipped.
  const lines = afterHeading.split('\n');
  let inFence = false;
  let endIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      // Match markdown heading: # to ###### followed by space
      const headingMatch = line.match(/^(#{1,6})\s/);
      if (headingMatch && headingMatch[1].length <= level) {
        endIdx = i;
        break;
      }
    }
  }
  const nextMatch = { index: lines.slice(0, endIdx).join('\n').length };
  return nextMatch ? afterHeading.slice(0, nextMatch.index) : afterHeading;
}

test('Recovery Steps section must define PLUGIN_ROOT before doctor usage', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const recoverySection = extractSection(content, 'Recovery Steps');
  assert.ok(recoverySection, 'INSTALL.md must contain a ### Recovery Steps section');

  // Must reference PLUGIN_ROOT (i.e., use it in doctor invocation)
  assert.match(
    recoverySection,
    /\$PLUGIN_ROOT/,
    'Recovery Steps must use $PLUGIN_ROOT',
  );

  // Must define PLUGIN_ROOT via assignment (PLUGIN_ROOT=...) before using it
  assert.match(
    recoverySection,
    /PLUGIN_ROOT\s*=/,
    'Recovery Steps must assign PLUGIN_ROOT before using it in doctor invocation',
  );
});

test('Recovery Steps must guard doctor with file existence check', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const recoverySection = extractSection(content, 'Recovery Steps');
  assert.ok(recoverySection, 'INSTALL.md must contain a ### Recovery Steps section');

  // Must have a fail-closed guard that checks the doctor script exists before running it
  assert.match(
    recoverySection,
    /\[\s*-f\s+"\$PLUGIN_ROOT\/scripts\/doctor\.mjs"\s*\]/,
    'Recovery Steps must check [ -f "$PLUGIN_ROOT/scripts/doctor.mjs" ] before running doctor',
  );
});

test('Recovery Steps must contain Codex host-specific PLUGIN_ROOT discovery', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const recoverySection = extractSection(content, 'Recovery Steps');
  assert.ok(recoverySection, 'INSTALL.md must contain a ### Recovery Steps section');

  // Must have Codex-specific discovery using codex plugin list --json
  assert.match(
    recoverySection,
    /codex plugin list --json/,
    'Recovery Steps must include Codex host discovery via codex plugin list --json',
  );
});

test('Recovery Steps must contain Claude Code host-specific PLUGIN_ROOT discovery', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const recoverySection = extractSection(content, 'Recovery Steps');
  assert.ok(recoverySection, 'INSTALL.md must contain a ### Recovery Steps section');

  // Must have Claude-specific discovery using claude plugin list --json
  assert.match(
    recoverySection,
    /claude plugin list --json/,
    'Recovery Steps must include Claude Code host discovery via claude plugin list --json',
  );
});

test('Recovery Steps Codex block must export CODEX_HOME', async () => {
  const content = await readUtf8(INSTALL_PATH);
  const recoverySection = extractSection(content, 'Recovery Steps');
  assert.ok(recoverySection, 'INSTALL.md must contain a ### Recovery Steps section');

  // Codex discovery must export CODEX_HOME for Node subprocess propagation
  assert.match(
    recoverySection,
    /export CODEX_HOME=/,
    'Recovery Steps Codex block must use export CODEX_HOME=',
  );
});
