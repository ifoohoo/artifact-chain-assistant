#!/usr/bin/env node
// @scenario S-44 @feature ACA13
// @decision D-ACA-15
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const VALID_POLICY = {
  schemaVersion: '1.0',
  pluginVersion: '0.4.0',
  artifactGraph: {
    verifiedVersion: '0.4.0',
    installSpec: 'artifact-graph@0.4.0',
    githubFallbackSpec: 'github:mzdbxqh/artifact-graph#artifact-graph-v0.4.0',
  },
};

/**
 * Create a fixture that mirrors the real checked-in file layout:
 *
 *   <dir>/
 *     compatibility.json
 *     package.json
 *     INSTALL.md                         ← public docs (from render-public-docs)
 *     README.md
 *     README.zh-CN.md
 *     .agents/plugins/marketplace.json   ← Codex marketplace (NO version field)
 *     .claude-plugin/marketplace.json    ← Claude marketplace (metadata.version)
 *     adapters/codex/.codex-plugin/plugin.json
 *     adapters/codex/compatibility.json
 *     adapters/codex/INSTALL.md
 *     adapters/claude/.claude-plugin/plugin.json
 *     adapters/claude/compatibility.json
 *     adapters/claude/INSTALL.md
 */
async function createFixture(overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'compat-policy-'));
  const pv = overrides.pluginVersion ?? '0.4.0';

  // --- root compatibility.json ---
  const policy = {
    schemaVersion: overrides.schemaVersion ?? '1.0',
    pluginVersion: pv,
    artifactGraph: {
      verifiedVersion: overrides.artifactGraph?.verifiedVersion ?? pv,
      installSpec: overrides.artifactGraph?.installSpec ?? `artifact-graph@${pv}`,
      githubFallbackSpec:
        overrides.artifactGraph?.githubFallbackSpec ??
        `github:mzdbxqh/artifact-graph#artifact-graph-v${pv}`,
    },
  };
  await writeFile(join(dir, 'compatibility.json'), JSON.stringify(policy, null, 2) + '\n');

  // --- root package.json ---
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'artifact-chain-assistant', version: pv }, null, 2) + '\n',
  );

  // --- Codex marketplace (real schema: NO version field) ---
  await mkdir(join(dir, '.agents', 'plugins'), { recursive: true });
  await writeFile(
    join(dir, '.agents', 'plugins', 'marketplace.json'),
    JSON.stringify(
      {
        name: 'artifact-chain-assistant',
        interface: { displayName: 'Artifact Chain Assistant' },
        plugins: [
          {
            name: 'artifact-chain-assistant',
            source: { source: 'local', path: './adapters/codex' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
            category: 'Productivity',
          },
        ],
      },
      null,
      2,
    ) + '\n',
  );

  // --- Claude marketplace (real schema: metadata.version) ---
  await mkdir(join(dir, '.claude-plugin'), { recursive: true });
  await writeFile(
    join(dir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify(
      {
        name: 'artifact-chain-assistant',
        owner: { name: 'Artifact Graph Maintainers' },
        metadata: {
          description: 'Artifact-chain intake, diagnostics, hooks, and version-lock maintenance helpers.',
          version: pv,
        },
        plugins: [
          {
            name: 'artifact-chain-assistant',
            source: './adapters/claude',
            description: 'Artifact-chain intake, diagnostics, hooks, and version-lock maintenance helpers.',
            category: 'productivity',
            tags: ['artifact-graph', 'traceability', 'codex', 'claude-code'],
          },
        ],
      },
      null,
      2,
    ) + '\n',
  );

  // --- Codex adapter: real manifest path + compatibility.json ---
  await mkdir(join(dir, 'adapters', 'codex', '.codex-plugin'), { recursive: true });
  await writeFile(
    join(dir, 'adapters', 'codex', '.codex-plugin', 'plugin.json'),
    JSON.stringify(
      {
        name: 'artifact-chain-assistant',
        displayName: 'Artifact Chain Assistant',
        version: pv,
        description: 'Artifact-chain intake, diagnostics, hooks, and version-lock maintenance helpers.',
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    join(dir, 'adapters', 'codex', 'compatibility.json'),
    JSON.stringify(policy, null, 2) + '\n',
  );
  // Codex adapter doctor and lib files
  await mkdir(join(dir, 'adapters', 'codex', 'scripts', 'lib'), { recursive: true });
  await writeFile(join(dir, 'adapters', 'codex', 'scripts', 'doctor.mjs'), '// Codex doctor script\n');
  await writeFile(join(dir, 'adapters', 'codex', 'scripts', 'lib', 'compatibility-policy.mjs'), '// Codex compatibility policy\n');
  await writeFile(join(dir, 'adapters', 'codex', 'scripts', 'lib', 'artifact-graph-runtime.mjs'), '// Codex artifact graph runtime\n');

  // --- Claude adapter: real manifest path + compatibility.json ---
  await mkdir(join(dir, 'adapters', 'claude', '.claude-plugin'), { recursive: true });
  await writeFile(
    join(dir, 'adapters', 'claude', '.claude-plugin', 'plugin.json'),
    JSON.stringify(
      {
        name: 'artifact-chain-assistant',
        displayName: 'Artifact Chain Assistant',
        version: pv,
        description: 'Artifact-chain intake, diagnostics, hooks, and version-lock maintenance helpers.',
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    join(dir, 'adapters', 'claude', 'compatibility.json'),
    JSON.stringify(policy, null, 2) + '\n',
  );
  // Claude adapter doctor and lib files
  await mkdir(join(dir, 'adapters', 'claude', 'scripts', 'lib'), { recursive: true });
  await writeFile(join(dir, 'adapters', 'claude', 'scripts', 'doctor.mjs'), '// Claude doctor script\n');
  await writeFile(join(dir, 'adapters', 'claude', 'scripts', 'lib', 'compatibility-policy.mjs'), '// Claude compatibility policy\n');
  await writeFile(join(dir, 'adapters', 'claude', 'scripts', 'lib', 'artifact-graph-runtime.mjs'), '// Claude artifact graph runtime\n');

  // --- Public docs at plugin root (real snapshot layout) ---
  await writeFile(
    join(dir, 'INSTALL.md'),
    `# Install\n\n\`\`\`bash\npnpm add -D artifact-graph@${pv}\n\`\`\`\n`,
  );
  await writeFile(join(dir, 'README.md'), `# README v${pv}\n\nSee [INSTALL](INSTALL.md).\n`);
  await writeFile(join(dir, 'README.zh-CN.md'), `# README v${pv}\n\nSee [INSTALL](INSTALL.md).\n`);
  await writeFile(
    join(dir, 'adapters', 'codex', 'INSTALL.md'),
    `# Codex Install\n\n\`\`\`bash\npnpm add -D artifact-graph@${pv}\n\`\`\`\n`,
  );
  await writeFile(
    join(dir, 'adapters', 'claude', 'INSTALL.md'),
    `# Claude Install\n\n\`\`\`bash\npnpm add -D artifact-graph@${pv}\n\`\`\`\n`,
  );

  return dir;
}

// ─── loadCompatibilityPolicy ────────────────────────────────────────

test('loadCompatibilityPolicy loads and freezes valid policy', async () => {
  const { loadCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const policy = await loadCompatibilityPolicy(dir);
    assert.equal(policy.schemaVersion, '1.0');
    assert.equal(policy.pluginVersion, '0.4.0');
    assert.equal(policy.artifactGraph.verifiedVersion, '0.4.0');
    assert.equal(policy.artifactGraph.installSpec, 'artifact-graph@0.4.0');
    assert.ok(Object.isFrozen(policy));
    assert.ok(Object.isFrozen(policy.artifactGraph));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadCompatibilityPolicy rejects missing file', async () => {
  const { loadCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'compat-missing-'));
  try {
    await assert.rejects(() => loadCompatibilityPolicy(dir), /compatibility\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadCompatibilityPolicy rejects missing schemaVersion', async () => {
  const { loadCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture({ schemaVersion: undefined });
  try {
    // Remove schemaVersion from the written file
    const raw = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(dir, 'compatibility.json'), 'utf8'),
    );
    const json = JSON.parse(raw);
    delete json.schemaVersion;
    const { writeFile: wf } = await import('node:fs/promises');
    await wf(join(dir, 'compatibility.json'), JSON.stringify(json, null, 2) + '\n');
    await assert.rejects(() => loadCompatibilityPolicy(dir), /schemaVersion/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadCompatibilityPolicy rejects wrong schemaVersion', async () => {
  const { loadCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
    const raw = await rf(join(dir, 'compatibility.json'), 'utf8');
    const json = JSON.parse(raw);
    json.schemaVersion = '2.0';
    await wf(join(dir, 'compatibility.json'), JSON.stringify(json, null, 2) + '\n');
    await assert.rejects(() => loadCompatibilityPolicy(dir), /schemaVersion/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── validateCompatibilityPolicy: version consistency ────────────────

test('validateCompatibilityPolicy returns empty for valid fixture', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const issues = await validateCompatibilityPolicy(dir);
    assert.deepEqual(issues, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy detects package.json version mismatch', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const pkg = { name: 'artifact-chain-assistant', version: '0.3.0' };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('package.json') && i.includes('0.3.0')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy detects Claude marketplace metadata.version mismatch', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { readFile: rf } = await import('node:fs/promises');
    const raw = await rf(join(dir, '.claude-plugin', 'marketplace.json'), 'utf8');
    const json = JSON.parse(raw);
    json.metadata.version = '0.2.9';
    await writeFile(join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify(json, null, 2) + '\n');
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('marketplace') && i.includes('0.2.9')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy detects Codex marketplace plugin source path mismatch', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { readFile: rf } = await import('node:fs/promises');
    const raw = await rf(join(dir, '.agents', 'plugins', 'marketplace.json'), 'utf8');
    const json = JSON.parse(raw);
    json.plugins[0].source.path = './adapters/wrong';
    await writeFile(join(dir, '.agents', 'plugins', 'marketplace.json'), JSON.stringify(json, null, 2) + '\n');
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('source.path') || i.includes('codex')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy detects non-precise installSpec', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture({
    artifactGraph: { installSpec: 'artifact-graph@^0.4.0' },
  });
  try {
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('installSpec')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy detects wrong GitHub tag', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture({
    artifactGraph: { githubFallbackSpec: 'github:mzdbxqh/artifact-graph#artifact-graph-v0.3.0' },
  });
  try {
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('githubFallbackSpec')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── validateCompatibilityPolicy: adapter manifest versions ──────────

test('validateCompatibilityPolicy detects Codex adapter manifest version mismatch', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    await writeFile(
      join(dir, 'adapters', 'codex', '.codex-plugin', 'plugin.json'),
      JSON.stringify({ name: 'artifact-chain-assistant', version: '0.2.0' }, null, 2) + '\n',
    );
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('codex') && i.includes('0.2.0')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy detects Claude adapter manifest version mismatch', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    await writeFile(
      join(dir, 'adapters', 'claude', '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'artifact-chain-assistant', version: '0.2.0' }, null, 2) + '\n',
    );
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('claude') && i.includes('0.2.0')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy fails closed when adapter manifest is missing', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'codex', '.codex-plugin', 'plugin.json'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('codex') && (i.includes('missing') || i.includes('not found') || i.includes('not valid'))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy fails closed when adapter manifest is invalid JSON', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    await writeFile(join(dir, 'adapters', 'codex', '.codex-plugin', 'plugin.json'), 'NOT JSON');
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('codex') && (i.includes('not valid') || i.includes('JSON'))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── validateCompatibilityPolicy: adapter compatibility.json deep match ──

test('validateCompatibilityPolicy detects adapter compatibility.json mismatch', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { readFile: rf } = await import('node:fs/promises');
    const raw = await rf(join(dir, 'adapters', 'codex', 'compatibility.json'), 'utf8');
    const json = JSON.parse(raw);
    json.pluginVersion = '0.2.0';
    await writeFile(join(dir, 'adapters', 'codex', 'compatibility.json'), JSON.stringify(json, null, 2) + '\n');
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('compatibility') && i.includes('codex')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validateCompatibilityPolicy fails closed when adapter compatibility.json is missing', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'claude', 'compatibility.json'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('compatibility') && i.includes('claude')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── validateCompatibilityPolicy: doc forbidden patterns ─────────────

test('detects forbidden install patterns in plugin-root INSTALL.md', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    await writeFile(
      join(dir, 'INSTALL.md'),
      '# Install\n\n```bash\npnpm add -D artifact-graph\n```\n',
    );
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('INSTALL.md') && i.includes('mismatch')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects forbidden @latest in adapter INSTALL.md', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    await writeFile(
      join(dir, 'adapters', 'codex', 'INSTALL.md'),
      '# Install\n\n```bash\npnpm add -D artifact-graph@latest\n```\n',
    );
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('INSTALL.md') && i.includes('mismatch')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects forbidden caret range in adapter INSTALL.md', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    await writeFile(
      join(dir, 'adapters', 'claude', 'INSTALL.md'),
      '# Install\n\n```bash\npnpm add -D artifact-graph@^0.4.0\n```\n',
    );
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('INSTALL.md') && i.includes('mismatch')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects forbidden unlocked GitHub install across multiple files without lastIndex bug', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    // First file is clean, second file has forbidden pattern — tests g flag lastIndex bug
    await writeFile(
      join(dir, 'INSTALL.md'),
      '# Install\n\n```bash\npnpm add -D artifact-graph@0.4.0\n```\n',
    );
    await writeFile(
      join(dir, 'adapters', 'codex', 'INSTALL.md'),
      '# Codex Install\n\n```bash\ngithub:mzdbxqh/artifact-graph\n```\n',
    );
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('codex') && i.includes('INSTALL.md') && i.includes('mismatch')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects forbidden install patterns in README.md code blocks', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    await writeFile(
      join(dir, 'README.md'),
      '# README\n\n```bash\npnpm add -D artifact-graph@latest\n```\n',
    );
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('README.md') && i.includes('mismatch')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('precise version install is not forbidden', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const issues = await validateCompatibilityPolicy(dir);
    const mismatchIssues = issues.filter((i) => i.includes('mismatch'));
    assert.deepEqual(mismatchIssues, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects missing adapter doctor script in Codex adapter', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'codex', 'scripts', 'doctor.mjs'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('codex') && i.includes('doctor.mjs')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects missing adapter doctor script in Claude adapter', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'claude', 'scripts', 'doctor.mjs'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('claude') && i.includes('doctor.mjs')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects missing adapter lib compatibility-policy.mjs in Codex adapter', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'codex', 'scripts', 'lib', 'compatibility-policy.mjs'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('codex') && i.includes('compatibility-policy.mjs')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects missing adapter lib artifact-graph-runtime.mjs in Codex adapter', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'codex', 'scripts', 'lib', 'artifact-graph-runtime.mjs'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('codex') && i.includes('artifact-graph-runtime.mjs')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects missing adapter lib compatibility-policy.mjs in Claude adapter', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'claude', 'scripts', 'lib', 'compatibility-policy.mjs'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('claude') && i.includes('compatibility-policy.mjs')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detects missing adapter lib artifact-graph-runtime.mjs in Claude adapter', async () => {
  const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
  const dir = await createFixture();
  try {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(join(dir, 'adapters', 'claude', 'scripts', 'lib', 'artifact-graph-runtime.mjs'));
    const issues = await validateCompatibilityPolicy(dir);
    assert.ok(issues.some((i) => i.includes('claude') && i.includes('artifact-graph-runtime.mjs')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── validateCompatibilityPolicy: install spec patterns (table-driven) ──
//
// Each row: { cmd, forbidden, label }
//   cmd       — the full install command string (inside a fenced code block)
//   forbidden — true if this should produce a "forbidden" issue
//   label     — human-readable description for the test name

const FORBIDDEN_INSTALL_SPECS = [
  // ── pnpm variants ──
  { cmd: 'pnpm add -D artifact-graph', forbidden: true, label: 'pnpm add -D artifact-graph' },
  { cmd: 'pnpm add artifact-graph', forbidden: true, label: 'pnpm add artifact-graph' },
  { cmd: 'pnpm add -D artifact-graph@latest', forbidden: true, label: 'pnpm add -D artifact-graph@latest' },
  { cmd: 'pnpm add artifact-graph@latest', forbidden: true, label: 'pnpm add artifact-graph@latest' },
  { cmd: 'pnpm add -D artifact-graph@^0.4.0', forbidden: true, label: 'pnpm add -D artifact-graph@^0.4.0' },
  { cmd: 'pnpm add artifact-graph@^0.4.0', forbidden: true, label: 'pnpm add artifact-graph@^0.4.0' },
  // ── npm install variants ──
  { cmd: 'npm install -D artifact-graph', forbidden: true, label: 'npm install -D artifact-graph' },
  { cmd: 'npm install artifact-graph', forbidden: true, label: 'npm install artifact-graph' },
  { cmd: 'npm i -D artifact-graph', forbidden: true, label: 'npm i -D artifact-graph' },
  { cmd: 'npm i artifact-graph', forbidden: true, label: 'npm i artifact-graph' },
  { cmd: 'npm install -D artifact-graph@latest', forbidden: true, label: 'npm install -D artifact-graph@latest' },
  { cmd: 'npm install artifact-graph@latest', forbidden: true, label: 'npm install artifact-graph@latest' },
  { cmd: 'npm i -D artifact-graph@latest', forbidden: true, label: 'npm i -D artifact-graph@latest' },
  { cmd: 'npm i artifact-graph@latest', forbidden: true, label: 'npm i artifact-graph@latest' },
  { cmd: 'npm install -D artifact-graph@^0.4.0', forbidden: true, label: 'npm install -D artifact-graph@^0.4.0' },
  { cmd: 'npm install artifact-graph@^0.4.0', forbidden: true, label: 'npm install artifact-graph@^0.4.0' },
  { cmd: 'npm i -D artifact-graph@^0.4.0', forbidden: true, label: 'npm i -D artifact-graph@^0.4.0' },
  { cmd: 'npm i artifact-graph@^0.4.0', forbidden: true, label: 'npm i artifact-graph@^0.4.0' },
  // ── GitHub spec ──
  { cmd: 'github:mzdbxqh/artifact-graph', forbidden: true, label: 'unlocked github:mzdbxqh/artifact-graph' },
  // ── NEW: wrong exact version, tilde, wildcard, dist-tag ──
  { cmd: 'npm install artifact-graph@0.2.0 -D', forbidden: true, label: 'npm install artifact-graph@0.2.0 -D (wrong exact version)' },
  { cmd: 'pnpm add artifact-graph@~0.4.0', forbidden: true, label: 'pnpm add artifact-graph@~0.4.0 (tilde range)' },
  { cmd: 'pnpm add artifact-graph@*', forbidden: true, label: 'pnpm add artifact-graph@* (wildcard)' },
  { cmd: 'npm i artifact-graph@next', forbidden: true, label: 'npm i artifact-graph@next (dist-tag)' },
  // ── NEW: standalone wrong GitHub tag ──
  { cmd: 'github:mzdbxqh/artifact-graph#wrong-tag', forbidden: true, label: 'standalone github:mzdbxqh/artifact-graph#wrong-tag' },
  { cmd: 'pnpm add github:mzdbxqh/artifact-graph#artifact-graph-v0.2.0', forbidden: true, label: 'pnpm add github:mzdbxqh/artifact-graph#artifact-graph-v0.2.0 (wrong github tag)' },
  // ── REGRESSION: argument order variants (L0 rejection from ec529a0) ──
  { cmd: 'npm install artifact-graph -D', forbidden: true, label: 'npm install artifact-graph -D (spec before flag)' },
  { cmd: 'npm install --save-dev artifact-graph', forbidden: true, label: 'npm install --save-dev artifact-graph (long flag before spec)' },
  { cmd: 'npm i --save-dev artifact-graph@latest', forbidden: true, label: 'npm i --save-dev artifact-graph@latest (long flag before spec+tag)' },
  { cmd: 'pnpm add artifact-graph@^0.4.0 --save-dev', forbidden: true, label: 'pnpm add artifact-graph@^0.4.0 --save-dev (spec+caret before flag)' },
  { cmd: 'pnpm add github:mzdbxqh/artifact-graph --save-dev', forbidden: true, label: 'pnpm add github:mzdbxqh/artifact-graph --save-dev (github before flag)' },
  // ── Allowed: pinned version (any argument order) ──
  { cmd: 'npm install artifact-graph@0.4.0 -D', forbidden: false, label: 'npm install artifact-graph@0.4.0 -D (pinned, spec before flag)' },
  { cmd: 'pnpm add --save-dev github:mzdbxqh/artifact-graph#artifact-graph-v0.4.0', forbidden: false, label: 'pnpm add --save-dev github:mzdbxqh/artifact-graph#artifact-graph-v0.4.0 (tagged github)' },
  // ── Allowed: pinned version (original order) ──
  { cmd: 'pnpm add -D artifact-graph@0.4.0', forbidden: false, label: 'pnpm add -D artifact-graph@0.4.0 (pinned)' },
  { cmd: 'npm install -D artifact-graph@0.4.0', forbidden: false, label: 'npm install -D artifact-graph@0.4.0 (pinned)' },
];

for (const { cmd, forbidden, label } of FORBIDDEN_INSTALL_SPECS) {
  const shouldOrShouldNot = forbidden ? 'forbids' : 'allows';
  test(`${shouldOrShouldNot}: ${label}`, async () => {
    const { validateCompatibilityPolicy } = await import('../scripts/lib/compatibility-policy.mjs');
    const dir = await createFixture();
    try {
      await writeFile(
        join(dir, 'INSTALL.md'),
        `# Install\n\n\`\`\`bash\n${cmd}\n\`\`\`\n`,
      );
      const issues = await validateCompatibilityPolicy(dir);
      const mismatchIssues = issues.filter((i) => i.includes('INSTALL.md') && i.includes('mismatch'));
      if (forbidden) {
        assert.ok(mismatchIssues.length > 0, `expected mismatch issue for: ${cmd}`);
      } else {
        assert.deepEqual(mismatchIssues, [], `unexpected mismatch issue for: ${cmd}`);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
