import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, normalize } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { pluginRoot } from './helpers.mjs';

const execFileAsync = promisify(execFile);
const repository = 'https://github.com/mzdbxqh/artifact-chain-assistant/';

test('packaged Markdown links resolve from the npm package file set', async () => {
  const files = await packageFiles(pluginRoot);
  const fileSet = new Set(files);
  const findings = [];

  for (const source of files.filter((file) => file.endsWith('.md'))) {
    const markdown = await readFile(`${pluginRoot}/${source}`, 'utf8');
    for (const href of inlineLinks(markdown)) {
      const target = packageTarget(source, href, fileSet);
      if (target) findings.push(`${source} -> ${target}`);
    }
  }

  assert.equal(
    findings.length,
    0,
    `Packaged Markdown link graph findings:\n${findings.join('\n')}`,
  );
});

async function packageFiles(root) {
  const { stdout } = await execFileAsync('npm', ['pack', '--dry-run', '--json'], { cwd: root });
  const [inventory] = JSON.parse(stdout);
  return inventory.files.map(({ path }) => path).sort();
}

function inlineLinks(markdown) {
  const prose = markdown
    .replace(/^ {0,3}(?:`{3,}|~{3,}).*?^ {0,3}(?:`{3,}|~{3,})\s*$/gms, '')
    .replace(/`[^`\n]*`/g, '');
  return [...prose.matchAll(/(?<!!)\[[^\]\n]*\]\(([^)\n]+)\)/g)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ''));
}

function packageTarget(source, href, fileSet) {
  if (href.startsWith('#') || href.startsWith('mailto:')) return null;

  if (href.startsWith(repository)) {
    const match = href.slice(repository.length).match(/^(?:blob|tree)\/[^/]+\/(.+?)(?:#.*)?$/);
    if (!match) return null;
    return existsInPackage(match[1], fileSet) ? null : href;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('/')) {
    return null;
  }

  const target = href.split('#', 1)[0];
  if (!target) return null;
  const resolved = normalize(`${dirname(source)}/${target}`).replaceAll('\\\\', '/');
  return existsInPackage(resolved, fileSet) ? null : resolved;
}

function existsInPackage(target, fileSet) {
  return fileSet.has(target) || [...fileSet].some((file) => file.startsWith(`${target}/`));
}
