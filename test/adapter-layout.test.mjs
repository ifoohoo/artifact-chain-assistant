import assert from 'node:assert/strict';
import { access, chmod, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { runNode, tempPlugin } from './helpers.mjs';

async function markdownFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await markdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path);
    }
  }
  return files;
}

test('build adapter restores root marketplaces and removes the stale Claude marketplace', async () => {
  const root = await tempPlugin('marketplaces');
  const codexPath = join(root, '.agents/plugins/marketplace.json');
  const claudePath = join(root, '.claude-plugin/marketplace.json');
  const stalePath = join(root, 'adapters/claude/.claude-plugin/marketplace.json');

  await rm(dirname(codexPath), { recursive: true });
  await rm(dirname(claudePath), { recursive: true });
  await mkdir(dirname(stalePath), { recursive: true });
  await writeFile(stalePath, '{"name":"stale-marketplace"}\n');

  await assert.rejects(
    runNode(root, 'scripts/build-adapters.mjs', ['--check']),
    (error) => {
      assert.match(error.stderr, /Generated adapter drift: \.agents\/plugins\/marketplace\.json/);
      assert.match(error.stderr, /Generated adapter drift: \.claude-plugin\/marketplace\.json/);
      assert.match(error.stderr, /Generated adapter stale path: adapters\/claude\/\.claude-plugin\/marketplace\.json/);
      return true;
    },
  );

  await runNode(root, 'scripts/build-adapters.mjs');

  const codex = JSON.parse(await readFile(codexPath, 'utf8'));
  assert.equal(codex.name, 'artifact-chain-assistant');
  assert.equal(codex.plugins[0].source.source, 'local');
  assert.equal(codex.plugins[0].source.path, './adapters/codex');

  const claude = JSON.parse(await readFile(claudePath, 'utf8'));
  assert.equal(claude.name, 'artifact-chain-assistant');
  assert.equal(claude.plugins[0].source, './adapters/claude');

  await assert.rejects(readFile(stalePath));
  await runNode(root, 'scripts/build-adapters.mjs', ['--check']);
});

test('publishes host-specific runtime surfaces without Codex-only command claims', async () => {
  const root = await tempPlugin('host-runtime-surfaces');
  const codexRoot = join(root, 'adapters/codex');
  const claudeRoot = join(root, 'adapters/claude');

  await runNode(root, 'scripts/build-adapters.mjs');

  const findings = [];
  for (const path of [
    join(codexRoot, 'commands'),
    join(codexRoot, 'hooks'),
    join(codexRoot, 'settings'),
  ]) {
    try {
      await access(path);
      findings.push(`Codex includes Claude-only surface: ${path.slice(codexRoot.length + 1)}`);
    } catch {}
  }

  for (const path of [
    join(codexRoot, '.codex-plugin/plugin.json'),
    join(codexRoot, 'skills/artifact-chain-bootstrap/SKILL.md'),
    join(claudeRoot, '.claude-plugin/plugin.json'),
    join(claudeRoot, 'commands/version-lock-audit.md'),
    join(claudeRoot, 'bin/version-lock-audit.sh'),
    join(claudeRoot, 'hooks/hooks.json'),
  ]) {
    try {
      await access(path);
    } catch {
      findings.push(`Missing required host runtime surface: ${path.slice(root.length + 1)}`);
    }
  }

  for (const filename of ['README.md', 'README.zh-CN.md', 'INSTALL.md']) {
    const content = await readFile(join(root, filename), 'utf8');
    if (/Codex plugin commands/i.test(content)) {
      findings.push(`${filename} claims Codex plugin commands`);
    }
    if (/codex plugin update/i.test(content)) {
      findings.push(`${filename} uses unsupported codex plugin update`);
    }
  }
  assert.deepEqual(findings, []);

  for (const path of [
    join(codexRoot, 'commands/version-lock-audit.sh'),
    join(codexRoot, 'commands/version-lock-refresh.sh'),
  ]) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'stale Codex command\n');
  }
  await assert.rejects(
    runNode(root, 'scripts/build-adapters.mjs', ['--check']),
    (error) => {
      assert.match(error.stderr, /Generated adapter stale path: adapters\/codex\/commands\/version-lock-audit\.sh/);
      assert.match(error.stderr, /Generated adapter stale path: adapters\/codex\/commands\/version-lock-refresh\.sh/);
      return true;
    },
  );

  await runNode(root, 'scripts/build-adapters.mjs');
  await assert.rejects(access(join(codexRoot, 'commands')));
  await runNode(root, 'scripts/build-adapters.mjs', ['--check']);
});

test('Codex manifest describes only its skills surface', async () => {
  const root = await tempPlugin('codex-manifest-surface');
  await runNode(root, 'scripts/build-adapters.mjs');

  const manifest = JSON.parse(
    await readFile(join(root, 'adapters/codex/.codex-plugin/plugin.json'), 'utf8'),
  );
  const descriptions = [
    manifest.description,
    manifest.interface.shortDescription,
    manifest.interface.longDescription,
    ...manifest.interface.defaultPrompt,
  ];
  assert.ok(descriptions.every((description) => typeof description === 'string'));
  assert.deepEqual(
    descriptions.filter((description) => /\bcommands?\b/i.test(description)),
    [],
  );
  assert.equal(manifest.skills, './skills/');
  assert.deepEqual(manifest.hooks, {});
});

test('builds self-contained host runtime bundles', async () => {
  const root = await tempPlugin('runtime-bundles');
  for (const host of ['codex', 'claude']) {
    await rm(join(root, `adapters/${host}/INSTALL.md`));
    await rm(join(root, `adapters/${host}/EXTENDED-ARTIFACT-CATALOG.md`));
    await rm(join(root, `adapters/${host}/EXTENDED-ARTIFACT-CATALOG.zh-CN.md`));
    await rm(join(root, `adapters/${host}/templates`), { recursive: true });
  }
  await runNode(root, 'scripts/build-runtime-bundles.mjs');
  for (const host of ['codex', 'claude']) {
    await access(join(root, `adapters/${host}/INSTALL.md`));
    await access(join(root, `adapters/${host}/EXTENDED-ARTIFACT-CATALOG.md`));
    await access(join(root, `adapters/${host}/templates/core/feature/starter.md`));
    await access(join(root, `adapters/${host}/templates/extended/ops/runbook/review-checklist.md`));
    await access(join(root, `adapters/${host}/schemas/artifact-workflow-profile.schema.json`));
  }
  await runNode(root, 'scripts/build-runtime-bundles.mjs', ['--check']);
});

test('builds self-contained host runtime bundles with agent-methods catalog', async () => {
  const root = await tempPlugin('runtime-bundles-catalog');
  for (const host of ['codex', 'claude']) {
    await rm(join(root, `adapters/${host}/agent-methods`), { recursive: true, force: true });
  }
  await runNode(root, 'scripts/build-runtime-bundles.mjs');
  for (const host of ['codex', 'claude']) {
    await access(join(root, `adapters/${host}/agent-methods/catalog.yaml`));
  }
  const rootCatalog = await readFile(join(root, 'agent-methods/catalog.yaml'), 'utf8');
  for (const host of ['codex', 'claude']) {
    const adapterCatalog = await readFile(join(root, `adapters/${host}/agent-methods/catalog.yaml`), 'utf8');
    assert.equal(adapterCatalog, rootCatalog, `${host} adapter catalog should match root catalog`);
  }
  await runNode(root, 'scripts/build-runtime-bundles.mjs', ['--check']);
});

test('runtime bundle check detects agent-methods catalog content drift', async () => {
  const root = await tempPlugin('runtime-bundle-catalog-drift');
  await runNode(root, 'scripts/build-runtime-bundles.mjs');
  const catalogPath = join(root, 'adapters/codex/agent-methods/catalog.yaml');
  await writeFile(catalogPath, 'schemaVersion: 1\ncatalog:\n  id: drifted\n  version: "0.0.0"\nentries: []\n');

  await assert.rejects(
    runNode(root, 'scripts/build-runtime-bundles.mjs', ['--check']),
    (error) => {
      assert.match(error.stderr, /Runtime bundle drift: adapters\/codex\/agent-methods\/catalog\.yaml/);
      return true;
    },
  );
});

test('runtime bundle check detects managed file and template drift', async () => {
  const root = await tempPlugin('runtime-bundle-drift');
  const catalog = join(root, 'adapters/codex/EXTENDED-ARTIFACT-CATALOG.md');
  const modeDrift = join(root, 'adapters/claude/templates/core/feature/starter.md');
  const extra = join(root, 'adapters/claude/templates/core/extra.md');

  await runNode(root, 'scripts/build-runtime-bundles.mjs');
  await rm(catalog);
  await chmod(modeDrift, 0o755);
  await writeFile(extra, 'extra managed template drift\n');

  await assert.rejects(
    runNode(root, 'scripts/build-runtime-bundles.mjs', ['--check']),
    (error) => {
      assert.match(error.stderr, /Runtime bundle drift: adapters\/codex\/EXTENDED-ARTIFACT-CATALOG\.md/);
      assert.match(error.stderr, /Runtime bundle tree drift: adapters\/claude\/templates\/core/);
      return true;
    },
  );
});

test('runtime bundle check preserves exact executable permission bits', async () => {
  const root = await tempPlugin('runtime-bundle-executable-bits');
  const source = join(root, 'templates/core/feature/starter.md');
  const target = join(root, 'adapters/codex/templates/core/feature/starter.md');
  const matchingTarget = join(root, 'adapters/claude/templates/core/feature/starter.md');

  await chmod(source, 0o744);
  await chmod(target, 0o755);
  await chmod(matchingTarget, 0o744);

  await assert.rejects(
    runNode(root, 'scripts/build-runtime-bundles.mjs', ['--check']),
    (error) => {
      assert.match(error.stderr, /Runtime bundle drift: adapters\/codex\/templates\/core\/feature\/starter\.md/);
      return true;
    },
  );
  assert.equal((await stat(target)).mode & 0o777, 0o755);

  await runNode(root, 'scripts/build-runtime-bundles.mjs');
  assert.equal((await stat(target)).mode & 0o111, (await stat(source)).mode & 0o111);
  await runNode(root, 'scripts/build-runtime-bundles.mjs', ['--check']);
});

test('runtime template READMEs link to adapter skills', async () => {
  const root = await tempPlugin('runtime-bundle-template-links');
  await runNode(root, 'scripts/build-runtime-bundles.mjs');

  for (const host of ['codex', 'claude']) {
    const templatesReadme = await readFile(join(root, `adapters/${host}/templates/README.md`), 'utf8');
    const extendedReadme = await readFile(join(root, `adapters/${host}/templates/extended/README.md`), 'utf8');

    assert.match(templatesReadme, /\]\(\.\.\/skills\/artifact-chain-bootstrap\/SKILL\.md\)/);
    assert.match(extendedReadme, /\]\(\.\.\/\.\.\/skills\/artifact-chain-bootstrap\/SKILL\.md\)/);
    assert.doesNotMatch(templatesReadme, /skills-src/);
    assert.doesNotMatch(extendedReadme, /skills-src/);
    await access(join(root, `adapters/${host}/skills/artifact-chain-bootstrap/SKILL.md`));
  }
});

test('standalone template check does not read parent docs', async () => {
  const root = await tempPlugin('standalone-templates');
  await runNode(root, 'scripts/check-templates.mjs');
  await rm(join(root, 'templates/core'), { recursive: true });
  await assert.rejects(runNode(root, 'scripts/check-templates.mjs'));
});

test('public runtime text uses package-local catalog reference', async () => {
  const root = await tempPlugin('package-local-catalog');
  const changelog = join(root, 'CHANGELOG.md');

  for (const path of await markdownFiles(root)) {
    assert.doesNotMatch(await readFile(path, 'utf8'), /design-extended-artifact-catalog/, path);
  }
  assert.match(
    await readFile(changelog, 'utf8'),
    /\[EXTENDED-ARTIFACT-CATALOG\.md\]\(EXTENDED-ARTIFACT-CATALOG\.md\)/,
  );
});

test('rejects stale and missing generated skills', async () => {
  const root = await tempPlugin('skill-inventory');
  await cp(join(root, 'adapters/codex/skills/where-am-i'), join(root, 'adapters/codex/skills/obsolete'), { recursive: true });
  await assert.rejects(runNode(root, 'scripts/sync-skills.mjs', ['--check']));
  await rm(join(root, 'adapters/codex/skills/obsolete'), { recursive: true });
  await rm(join(root, 'adapters/claude/skills/artifact-chain-maintainer'), { recursive: true });
  await assert.rejects(runNode(root, 'scripts/sync-skills.mjs', ['--check']));
});

test('recursively syncs nested professional skills and detects drift in either adapter', async () => {
  const root = await tempPlugin('nested-skill-drift');
  const source = join(root, 'skills-src/prd-feature/author/SKILL.md');
  const codex = join(root, 'adapters/codex/skills/prd-feature/author/SKILL.md');
  const claude = join(root, 'adapters/claude/skills/prd-feature/author/SKILL.md');

  await runNode(root, 'scripts/sync-skills.mjs');
  assert.equal(await readFile(codex, 'utf8'), await readFile(source, 'utf8'));
  assert.equal(await readFile(claude, 'utf8'), await readFile(source, 'utf8'));

  await writeFile(codex, 'drifted nested Codex skill\n');
  await assert.rejects(
    runNode(root, 'scripts/sync-skills.mjs', ['--check']),
    error => {
      assert.match(error.stderr, /adapters\/codex\/skills\/prd-feature\/author\/SKILL\.md/);
      return true;
    },
  );
  await runNode(root, 'scripts/sync-skills.mjs');

  await writeFile(claude, 'drifted nested Claude skill\n');
  await assert.rejects(
    runNode(root, 'scripts/build-adapters.mjs', ['--check']),
    error => {
      assert.match(error.stderr, /prd-feature\/author\/SKILL\.md|skill drift/i);
      return true;
    },
  );
});

test('rejects executable mode drift', async () => {
  const root = await tempPlugin('mode-drift');
  const path = join(root, 'adapters/claude/bin/version-lock-audit.sh');
  await chmod(path, 0o644);
  await assert.rejects(runNode(root, 'scripts/build-adapters.mjs', ['--check']));
});

test('generated skill resource references resolve from each host inventory', async () => {
  const root = await tempPlugin('skill-resource-inventory');
  await runNode(root, 'scripts/sync-skills.mjs');
  await runNode(root, 'scripts/build-runtime-bundles.mjs');

  for (const host of ['codex', 'claude']) {
    const skillsRoot = join(root, `adapters/${host}/skills`);
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const skillPath = join(skillsRoot, entry.name, 'SKILL.md');
      const skill = await readFile(skillPath, 'utf8');
      const references = [...skill.matchAll(/`((?:\.\.\/)+[^`\s)]+)`/g)].map((match) => match[1]);

      for (const reference of references) {
        await access(join(dirname(skillPath), reference.replace(/\/\*\*$/, '')));
      }
    }
  }
});
