#!/usr/bin/env node
// @scenario S-05 @feature ACA5
import { access, chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');
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
    template: 'templates/codex/marketplace.json.tpl',
    path: '.agents/plugins/marketplace.json',
  },
  {
    template: 'templates/claude/marketplace.json.tpl',
    path: '.claude-plugin/marketplace.json',
  },
  {
    template: 'templates/codex/plugin.json.tpl',
    path: 'adapters/codex/.codex-plugin/plugin.json',
  },
  {
    template: 'templates/claude/plugin.json.tpl',
    path: 'adapters/claude/.claude-plugin/plugin.json',
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
  'adapters/codex/commands',
  'adapters/codex/commands/version-lock-audit.sh',
  'adapters/codex/commands/version-lock-refresh.sh',
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
    await rm(target, { force: true, recursive: stalePath === 'adapters/codex/commands' });
  }
}

for (const output of outputs) {
  const target = join(root, output.path);
  const content = output.content ?? render(await readFile(join(root, output.template), 'utf-8'), vars);
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
