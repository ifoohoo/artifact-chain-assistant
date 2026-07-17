// @feature ACA12
// @feature ACA17
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { validateCatalogPackageVersion } from '../scripts/lib/method-registry-version.mjs';

const root = join(import.meta.dirname, '..');

test('catalog.version must match the plugin package version exactly', async () => {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const catalogText = await readFile(join(root, 'agent-methods/catalog.yaml'), 'utf8');
  const currentVersion = catalogText.match(/^\s*version:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1];
  assert.deepEqual(validateCatalogPackageVersion({ catalog: { version: currentVersion } }, packageJson), []);
  assert.deepEqual(
    validateCatalogPackageVersion({ catalog: { version: '9.9.9' } }, packageJson),
    [`catalog.version 9.9.9 must equal package version ${packageJson.version}`],
  );
});
