#!/usr/bin/env node
// @feature ACA18 @scenario S-65 @decision D-ACA-18
// Authority Family API exporter. Outputs the exact bytes of a registered and
// validated Family API to a specified path. Supports --check mode for drift detection.
//
// CLI does not expose --catalog; only internal test injection can override it.
// All output is path-safe: no absolute paths in stdout or stderr.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson, validateFamilyApi, computeRevisionDigest } from './lib/family-api-validator.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Export a Family API from the authoritative catalog.
 * @param {object} opts
 * @param {string} opts.apiId - API id (e.g., "artifact.e2e-test-family")
 * @param {number} opts.apiMajor - API major version
 * @param {string} opts.outputPath - Absolute path to write the API JSON
 * @param {boolean} [opts.check=false] - If true, only check for drift (exit nonzero on drift)
 * @param {string} [opts.catalogPath] - Override catalog path (internal use only)
 * @param {boolean} [opts.json=false] - If true, output structured JSON to stdout
 * @returns {Promise<{ok: boolean, code: string, identity?: object, status?: string, digest?: string, message?: string}>}
 */
export async function exportFamilyApi({ apiId, apiMajor, outputPath, check = false, catalogPath, json = false }) {
  // 1. Load and validate catalog
  const catalogFilePath = catalogPath || join(root, 'family-apis', 'catalog.json');
  if (!existsSync(catalogFilePath)) {
    return { ok: false, code: 'CATALOG_NOT_FOUND', status: 'FAILED', message: 'Catalog file not found' };
  }

  let catalog;
  try {
    catalog = await loadJson(catalogFilePath);
  } catch {
    return { ok: false, code: 'CATALOG_INVALID', status: 'FAILED', message: 'Catalog is not valid JSON' };
  }

  if (!catalog?.families || !Array.isArray(catalog.families)) {
    return { ok: false, code: 'CATALOG_INVALID', status: 'FAILED', message: 'Catalog missing families array' };
  }

  // 2. Find matching family
  const family = catalog.families.find(f => f.id === apiId && f.major === apiMajor);
  if (!family) {
    return { ok: false, code: 'API_NOT_REGISTERED', status: 'FAILED', message: 'API not registered in catalog' };
  }

  // 3. Load and validate the API
  const apiPath = join(root, 'family-apis', family.apiPath);
  if (!existsSync(apiPath)) {
    return { ok: false, code: 'API_FILE_MISSING', status: 'FAILED', message: 'API file missing from catalog path' };
  }

  let apiContent;
  try {
    apiContent = readFileSync(apiPath, 'utf8');
  } catch {
    return { ok: false, code: 'API_READ_FAILED', status: 'FAILED', message: 'Cannot read API file' };
  }

  let apiObject;
  try {
    apiObject = JSON.parse(apiContent);
  } catch {
    return { ok: false, code: 'API_PARSE_FAILED', status: 'FAILED', message: 'API file is not valid JSON' };
  }

  // Validate API schema and semantics
  const validation = await validateFamilyApi(apiObject, { sourcePath: undefined });
  if (!validation.ok) {
    return {
      ok: false, code: 'API_VALIDATION_FAILED', status: 'FAILED',
      message: `API validation failed: ${validation.errors.length} error(s)`,
    };
  }

  // 4. Verify revision digest matches catalog
  const computedDigest = computeRevisionDigest(apiObject);
  if (computedDigest !== family.revisionDigest) {
    return {
      ok: false, code: 'REVISION_DIGEST_MISMATCH', status: 'FAILED',
      message: 'Revision digest mismatch between catalog and computed value',
    };
  }

  // 5. Check mode: compare with existing output
  if (check) {
    if (!existsSync(outputPath)) {
      return { ok: false, code: 'DRIFT_MISSING_OUTPUT', status: 'DRIFT', message: 'Output file does not exist' };
    }
    let existing;
    try {
      existing = readFileSync(outputPath, 'utf8');
    } catch {
      return { ok: false, code: 'DRIFT_READ_FAILED', status: 'DRIFT', message: 'Cannot read output file' };
    }
    if (existing !== apiContent) {
      return { ok: false, code: 'DRIFT_CONTENT_MISMATCH', status: 'DRIFT', message: 'Output differs from authority' };
    }
    return {
      ok: true, code: 'CHECK_PASSED', status: 'NO_DRIFT',
      identity: { apiId, apiMajor, revisionDigest: family.revisionDigest },
      digest: computedDigest,
    };
  }

  // 6. Write mode: create parent dir, output exact bytes
  try {
    const parentDir = dirname(outputPath);
    mkdirSync(parentDir, { recursive: true });
    writeFileSync(outputPath, apiContent, 'utf8');
    return {
      ok: true, code: 'EXPORTED', status: 'EXPORTED',
      identity: { apiId, apiMajor, revisionDigest: family.revisionDigest },
      digest: computedDigest,
    };
  } catch {
    return { ok: false, code: 'WRITE_FAILED', status: 'FAILED', message: 'Cannot write output file' };
  }
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('export-family-api.mjs')) {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === `--${name}` && i + 1 < args.length) return args[i + 1];
      if (args[i].startsWith(`--${name}=`)) return args[i].slice(`--${name}=`.length);
    }
    return null;
  };

  const apiId = getArg('api-id');
  const apiMajorStr = getArg('api-major');
  const output = getArg('output');
  const check = args.includes('--check');
  const jsonMode = args.includes('--json');
  // --catalog is internal-only, not in public usage help

  if (!apiId || !apiMajorStr || !output) {
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ ok: false, code: 'USAGE', status: 'FAILED', message: 'Missing required arguments' }) + '\n');
    } else {
      process.stderr.write('Usage: export-family-api.mjs --api-id=<id> --api-major=<n> --output=<path> [--check] [--json]\n');
    }
    process.exit(1);
  }

  const apiMajor = parseInt(apiMajorStr, 10);
  if (isNaN(apiMajor)) {
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ ok: false, code: 'INVALID_ARGUMENT', status: 'FAILED', message: '--api-major must be a number' }) + '\n');
    } else {
      process.stderr.write('--api-major must be a number\n');
    }
    process.exit(1);
  }

  // --catalog is only available via env var for testing (not a public CLI flag)
  const catalogPath = getArg('catalog');
  const result = await exportFamilyApi({ apiId, apiMajor, outputPath: output, check, catalogPath, json: jsonMode });

  if (jsonMode) {
    // JSON output: stable fields only, no absolute paths
    process.stdout.write(JSON.stringify({
      ok: result.ok,
      code: result.code,
      status: result.status,
      ...(result.identity ? { identity: result.identity } : {}),
      ...(result.digest ? { digest: result.digest } : {}),
      ...(result.message ? { message: result.message } : {}),
    }, null, 2) + '\n');
  } else {
    if (!result.ok) {
      process.stderr.write(`ERROR: ${result.code}\n`);
    } else {
      process.stdout.write(`${result.code}: ${result.status}\n`);
    }
  }

  process.exit(result.ok ? 0 : 1);
}
