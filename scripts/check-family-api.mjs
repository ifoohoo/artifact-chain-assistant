#!/usr/bin/env node
// @feature ACA18 @scenario S-65 @decision D-ACA-18
// Deterministic Family API catalog validator.
// Validates all API files in family-apis/ and checks catalog consistency.
// JSON envelope output; non-zero exit on failure.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateFamilyApi,
  validateCatalogConsistency,
  loadJson,
} from './lib/family-api-validator.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const familyApisDir = join(root, 'family-apis');

const errors = [];
const warnings = [];
const checked = [];

try {
  // 1. Load catalog
  const catalogPath = join(familyApisDir, 'catalog.json');
  let catalog;
  try {
    catalog = await loadJson(catalogPath);
  } catch (err) {
    errors.push(`Failed to load catalog.json: ${err.message}`);
    emitResult();
    process.exit(1);
  }

  // 2. Discover API files
  const apiFiles = [];
  const familiesDir = join(familyApisDir);
  for (const entry of await readdir(familiesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'schema') continue;
    const apiPath = join(familiesDir, entry.name, 'api.json');
    try {
      const content = await loadJson(apiPath);
      apiFiles.push({
        path: `${entry.name}/api.json`,
        id: content.api?.id,
        major: content.api?.major,
        content,
      });
    } catch (err) {
      // Non-API directories are fine
    }
  }

  // 3. Validate each API file (async now)
  for (const apiFile of apiFiles) {
    const result = await validateFamilyApi(apiFile.content, { sourcePath: apiFile.path });
    errors.push(...result.errors.map(e => typeof e === 'string' ? e : e.message || JSON.stringify(e)));
    warnings.push(...result.warnings);
    checked.push(apiFile.path);
  }

  // 4. Validate catalog consistency
  const consistency = validateCatalogConsistency(
    catalog,
    apiFiles.map(f => ({ id: f.id, major: f.major, content: f.content })),
  );
  errors.push(...consistency.errors);

  emitResult();
  if (errors.length > 0) process.exit(1);
} catch (err) {
  errors.push(`Unexpected error: ${err.message}`);
  emitResult();
  process.exit(1);
}

function emitResult() {
  const envelope = {
    ok: errors.length === 0,
    checked,
    errors,
    warnings,
  };
  process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
}
