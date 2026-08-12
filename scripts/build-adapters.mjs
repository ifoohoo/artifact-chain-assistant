#!/usr/bin/env node
// @scenario S-05 @feature ACA5
// @feature ACA17
// @scenario S-56
import { access, chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');

if (check) {
  const skillCheck = spawnSync(process.execPath, ['scripts/sync-skills.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (skillCheck.status !== 0) {
    if (skillCheck.stdout) process.stderr.write(skillCheck.stdout);
    if (skillCheck.stderr) process.stderr.write(skillCheck.stderr);
    process.exitCode = 1;
  }
}
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf-8'));
const vars = {
  pluginName: 'artifact-chain-assistant',
  version: packageJson.version,
};

const shellResolver = `artifact_graph() {
  if [ -x ./node_modules/.bin/artifact-graph ]; then
    ./node_modules/.bin/artifact-graph "$@"
    return $?
  fi
  if command -v artifact-graph >/dev/null 2>&1; then
    artifact-graph "$@"
    return $?
  fi
  if [ -n "\${ARTIFACT_GRAPH_LEGACY_CLI:-}" ] && [ -f "$ARTIFACT_GRAPH_LEGACY_CLI" ]; then
    node "$ARTIFACT_GRAPH_LEGACY_CLI" "$@"
    return $?
  fi
  echo "artifact-chain-assistant: artifact-graph CLI not found; install it in the project or PATH." >&2
  return 127
}
`;

const outputs = [
  {
    template: 'templates/codex/plugin.json.tpl',
    path: 'adapters/codex/.codex-plugin/plugin.json',
  },
  {
    template: 'templates/claude/plugin.json.tpl',
    path: 'adapters/claude/.claude-plugin/plugin.json',
  },
  {
    template: 'templates/kimi/plugin.json.tpl',
    path: 'adapters/kimi/.kimi-plugin/plugin.json',
  },
  {
    template: 'templates/claude/settings.json.tpl',
    path: 'adapters/claude/hooks/hooks.json',
  },
  {
    path: 'adapters/claude/hooks/version-lock-stop.mjs',
    content: await readFile(join(root, 'runtime/claude/version-lock-stop.mjs'), 'utf-8'),
  },
  {
    path: 'adapters/claude/bin/version-lock-audit.sh',
    content: `#!/bin/sh
set -u

${shellResolver}
artifact_graph version-lock audit --strict-missing-lock "$@"
`,
    executable: true,
  },
  {
    path: 'adapters/claude/bin/version-lock-refresh.sh',
    content: `#!/bin/sh
set -u

${shellResolver}
artifact_graph version-lock refresh --changed-only --staged "$@"
`,
    executable: true,
  },
  {
    path: 'adapters/claude/commands/version-lock-audit.md',
    content: '---\ndescription: Run strict artifact-chain version lock audit\n---\n\nRun this command from the project root:\n\n```bash\nartifact-graph version-lock audit --strict-missing-lock\n```\n',
  },
  {
    path: 'adapters/claude/commands/version-lock-refresh.md',
    content: '---\ndescription: Refresh staged artifact-chain version locks\n---\n\nRun this command from the project root, then review and stage the lock file if it changes:\n\n```bash\nartifact-graph version-lock refresh --changed-only --staged --format markdown\n```\n',
  },
];

let drift = false;
const stalePaths = [
  'adapters/claude/.claude-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
  '.claude-plugin/marketplace.json',
  'adapters/codex/commands',
  'adapters/codex/commands/version-lock-audit.sh',
  'adapters/codex/commands/version-lock-refresh.sh',
  'adapters/kimi/commands',
  'adapters/kimi/hooks',
  'adapters/kimi/bin',
];
for (const stalePath of stalePaths) {
  const target = join(root, stalePath);
  if (check) {
    try {
      await access(target);
      drift = true;
      console.error(`Generated adapter stale path: ${stalePath}`);
    } catch {}
  } else {
    await rm(target, { force: true, recursive: !stalePath.endsWith('.json') && !stalePath.endsWith('.sh') });
  }
}

const generatedContent = new Map();
for (const output of outputs) {
  const target = join(root, output.path);
  const content = output.content ?? render(await readFile(join(root, output.template), 'utf-8'), vars);
  generatedContent.set(output.path, content);
  if (check) {
    let current = '';
    try {
      current = await readFile(target, 'utf-8');
    } catch {
      current = '';
    }
    if (current !== content) {
      drift = true;
      console.error(`Generated adapter drift: ${output.path}`);
    }
    if (output.executable) {
      const mode = (await stat(target)).mode;
      if ((mode & 0o111) === 0) {
        drift = true;
        console.error(`Generated adapter mode drift: ${output.path}`);
      }
    }
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    if (output.executable) {
      await chmod(target, 0o755);
    }
  }
}

// Root plugin manifests for external marketplace installation. They derive from the generated adapter
// manifests above, so the adapter template render stays the single version source. External market
// installs from the repository root use these manifests to discover the generated root Claude skills
// at ./skills and the self-contained Codex/Kimi adapter skills at ./adapters/<host>/skills.
const rootManifests = [
  { from: 'adapters/claude/.claude-plugin/plugin.json', path: '.claude-plugin/plugin.json', rewriteSkills: false },
  { from: 'adapters/codex/.codex-plugin/plugin.json', path: '.codex-plugin/plugin.json', rewriteSkills: true, skillsPrefix: './adapters/codex/' },
  { from: 'adapters/kimi/.kimi-plugin/plugin.json', path: '.kimi-plugin/plugin.json', rewriteSkills: true, skillsPrefix: './adapters/kimi/' },
];
for (const manifest of rootManifests) {
  const target = join(root, manifest.path);
  const sourceContent =
    generatedContent.get(manifest.from) ?? (await readFile(join(root, manifest.from), 'utf-8'));
  // Root Claude manifest keeps ./skills/ for standard plugin installation at repository root.
  // Root Codex manifest rewrites to ./adapters/codex/skills/ because Codex adapter is self-contained.
  const content = manifest.rewriteSkills
    ? sourceContent.replace(
        /"skills": "\.\/skills\/"/,
        `"skills": "${manifest.skillsPrefix}skills/"`,
      )
    : sourceContent;
  if (check) {
    let current = '';
    try {
      current = await readFile(target, 'utf-8');
    } catch {
      current = '';
    }
    if (current !== content) {
      drift = true;
      console.error(`Generated root manifest drift: ${manifest.path}`);
    }
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

if (drift) {
  process.exitCode = 1;
}

function render(source, variables) {
  return `${source.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in variables)) {
      throw new Error(`Unknown template variable: ${key}`);
    }
    return variables[key];
  }).trimEnd()}\n`;
}
