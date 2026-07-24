// @feature ACA18 @scenario S-65 @decision D-ACA-18
// Family API validator tests: positive/negative cases for schema validation,
// revision digest, compatibility rules, and forbidden fields.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  validateFamilyApi,
  computeRevisionDigest,
  validateCatalogConsistency,
  checkApiCompatibility,
  loadJson,
  familyApiSchemaDigest,
} from '../scripts/lib/family-api-validator.mjs';

const pluginRoot = join(import.meta.dirname, '..');

test('generated Family API validator records the exact authoritative schema digest', async () => {
  const schema = await readFile(join(pluginRoot, 'family-apis/schema/family-api.schema.json'), 'utf8');
  assert.equal(familyApiSchemaDigest, `sha256:${createHash('sha256').update(schema).digest('hex')}`);
});

/** Helper: check if any error contains the substring (handles structured {message} or plain string) */
function hasError(errors, substr) {
  return errors.some(e => {
    const msg = typeof e === 'string' ? e : (e.message || '');
    return msg.includes(substr);
  });
}

// ── §5.1: Valid E2E API passes and digest is consistent ──

test('valid e2e-test API passes validation and digest matches', async () => {
  const api = await loadJson(join(pluginRoot, 'family-apis/e2e-test/api.json'));
  const result = await validateFamilyApi(api, { sourcePath: 'e2e-test/api.json' });
  assert.equal(result.ok, true, `Expected ok but got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.errors.length, 0);
});

test('revisionDigest is deterministic: same content → same digest, different key order → same digest', () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:placeholder', displayName: 'Test', summary: 'Test API' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] }],
  };
  const digest1 = computeRevisionDigest(api);

  const api2 = {
    schemaVersion: 1,
    api: { summary: 'Test API', displayName: 'Test', major: 1, id: 'artifact.test-family', revisionDigest: 'sha256:placeholder' },
    services: [{ intents: ['author'], kind: 'workflow', required: true, id: 'artifact.test.author' }],
  };
  const digest2 = computeRevisionDigest(api2);
  assert.equal(digest1, digest2, 'Different key order must produce same digest');
});

// ── §5.1: Digest drift fails ──

test('digest drift is detected', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'revisionDigest mismatch'));
});

// ── §5.1: Canonical namespace ──

test('non-canonical namespace fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'io.github.malicious-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'X', summary: 'X' },
    services: [{ id: 'io.github.malicious.svc', required: true, kind: 'workflow', intents: ['author'] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'canonical namespace pattern'));
});

test('artifact.* namespace is accepted for official APIs', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.my-test-family', major: 1, revisionDigest: 'sha256:placeholder', displayName: 'My', summary: 'My API' },
    services: [{ id: 'artifact.my-test.author', required: true, kind: 'workflow', intents: ['author'] }],
  };
  api.api.revisionDigest = computeRevisionDigest(api);
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, true, `Expected ok but got: ${JSON.stringify(result.errors)}`);
});

// ── §5.2: Forbidden fields ──

test('API with stage/worker/prompt/template/provider fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.bad-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Bad', summary: 'Bad' },
    services: [{ id: 'artifact.bad-family.author', required: true, kind: 'workflow', intents: ['author'], stage: 'internal-stage' }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'forbidden field "stage"'));
});

test('API with installation/enablement/trust state fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.bad-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Bad', summary: 'Bad', installation: 'INSTALLED' },
    services: [{ id: 'artifact.bad-family.author', required: true, kind: 'workflow', intents: ['author'] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'forbidden field'));
});

test('API with unknown fields in service fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.bad-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Bad', summary: 'Bad' },
    services: [{ id: 'artifact.bad-family.author', required: true, kind: 'workflow', intents: ['author'], providers: [] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'forbidden field'));
});

// ── §5.2: Illegal contract ref ──

test('invalid contract reference format fails when it looks like a contract ref', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], accepts: ['INVALID@1'] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'contract reference'));
});

test('natural language description in accepts is allowed', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:placeholder', displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.default', required: true, kind: 'workflow', intents: ['default'], accepts: ['User request description'] }],
  };
  api.api.revisionDigest = computeRevisionDigest(api);
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, true, `Expected ok but got: ${JSON.stringify(result.errors)}`);
});

// ── §5.2: Expanding side effect ──

test('side effect ceiling must be valid enum', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], sideEffectCeiling: 'destroy-world' }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  // Ajv reports enum violation via "allowed values" in message, path includes sideEffectCeiling
  assert.ok(
    result.errors.some(e =>
      (typeof e === 'object' && e.path?.includes('sideEffectCeiling')) ||
      hasError(result.errors, 'allowed values') ||
      hasError(result.errors, 'sideEffectCeiling')
    ),
    `Must report invalid sideEffectCeiling, got: ${JSON.stringify(result.errors)}`
  );
});

// ── §5.2: Duplicate service ID ──

test('duplicate service ID fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] },
      { id: 'artifact.test.author', required: false, kind: 'operation', intents: ['review'] },
    ],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'duplicate service'));
});

// ── §5.3: Compatibility rules ──

test('adding optional service is compatible', () => {
  const prev = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], sideEffectCeiling: 'write-authorized-artifacts' },
    ],
  };
  const curr = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], sideEffectCeiling: 'write-authorized-artifacts' },
      { id: 'artifact.test.audit', required: false, kind: 'operation', intents: ['audit'], sideEffectCeiling: 'read-only' },
    ],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, true);
});

test('removing required service is breaking', () => {
  const prev = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] },
      { id: 'artifact.test.review', required: true, kind: 'operation', intents: ['review'] },
    ],
  };
  const curr = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] },
    ],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, false);
  assert.ok(result.breaking.some(b => b.includes('required service') && b.includes('removed')));
});

test('changing accepts/produces is breaking', () => {
  const prev = {
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], accepts: ['artifact.feature@1'] }],
  };
  const curr = {
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], accepts: ['artifact.scenario@1'] }],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, false);
  assert.ok(result.breaking.some(b => b.includes('accepts changed')));
});

test('expanding side effect ceiling is breaking', () => {
  const prev = {
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], sideEffectCeiling: 'read-only' }],
  };
  const curr = {
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], sideEffectCeiling: 'write-authorized-artifacts' }],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, false);
  assert.ok(result.breaking.some(b => b.includes('sideEffectCeiling expanded')));
});

// ── §5.4: Catalog consistency ──

test('catalog consistency: matching API passes', () => {
  const catalog = { families: [{ id: 'artifact.e2e-test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64) }] };
  const apiFiles = [{ id: 'artifact.e2e-test-family', major: 1, content: { api: { revisionDigest: 'sha256:' + 'a'.repeat(64) } } }];
  const result = validateCatalogConsistency(catalog, apiFiles);
  assert.equal(result.ok, true);
});

test('catalog consistency: digest mismatch fails', () => {
  const catalog = { families: [{ id: 'artifact.e2e-test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64) }] };
  const apiFiles = [{ id: 'artifact.e2e-test-family', major: 1, content: { api: { revisionDigest: 'sha256:' + 'b'.repeat(64) } } }];
  const result = validateCatalogConsistency(catalog, apiFiles);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('does not match')));
});

test('catalog consistency: missing API file fails', () => {
  const catalog = { families: [{ id: 'artifact.missing-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64) }] };
  const result = validateCatalogConsistency(catalog, []);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('no matching API file')));
});

// ── §5.4: Real API file validation with computed digest ──

test('real e2e-test/api.json passes with computed digest', async () => {
  const apiPath = join(pluginRoot, 'family-apis/e2e-test/api.json');
  const api = await loadJson(apiPath);
  const result = await validateFamilyApi(api, { sourcePath: apiPath });
  assert.equal(result.ok, true, `Expected ok but got: ${JSON.stringify(result.errors)}`);
});

test('real catalog.json is consistent with e2e-test API', async () => {
  const catalogPath = join(pluginRoot, 'family-apis/catalog.json');
  const catalog = await loadJson(catalogPath);
  const apiPath = join(pluginRoot, 'family-apis/e2e-test/api.json');
  const api = await loadJson(apiPath);
  const result = validateCatalogConsistency(catalog, [{ id: api.api.id, major: api.api.major, content: api }]);
  assert.equal(result.ok, true, `Expected ok but got: ${JSON.stringify(result.errors)}`);
});

// ── Protocol reference validation ──

test('protocol reference with missing version fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [{
      id: 'artifact.test.review', required: true, kind: 'operation', intents: ['review'],
      produces: [{ protocol: 'review-result-v1.0' }],
    }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'protocol reference must have a string "version"'));
});

test('valid protocol reference passes', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:placeholder', displayName: 'Test', summary: 'Test' },
    services: [{
      id: 'artifact.test.review', required: true, kind: 'operation', intents: ['review'],
      produces: [{ protocol: 'review-result-v1.0', version: '1.0', input: 'Review Result JSON' }],
    }],
  };
  api.api.revisionDigest = computeRevisionDigest(api);
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, true, `Expected ok but got: ${JSON.stringify(result.errors)}`);
});

// ── Service must belong to the family ──

test('service ID not belonging to the API family fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.e2e-test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.other-family.author', required: true, kind: 'workflow', intents: ['author'] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  assert.ok(hasError(result.errors, 'does not belong to family'));
});

// ── R1: JSON Schema additionalProperties enforcement ──

test('unknown top-level field in API object fails (additionalProperties: false)', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test', unknownField: 'should-fail' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false, 'Must reject unknown field in api object');
  assert.ok(hasError(result.errors, 'additionalProperties') || hasError(result.errors, 'must NOT have additional'),
    `Must report unknown field error, got: ${JSON.stringify(result.errors)}`);
});

test('unknown top-level field at root level fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:placeholder', displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] }],
    someRandomField: 'should fail',
  };
  api.api.revisionDigest = computeRevisionDigest(api);
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false, 'Must reject unknown top-level field');
  assert.ok(hasError(result.errors, 'additionalProperties') || hasError(result.errors, 'must NOT have additional'),
    `Must report unknown field error, got: ${JSON.stringify(result.errors)}`);
});

test('unknown field in service definition fails', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'], unknownServiceField: 'bad' }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false, 'Must reject unknown field in service');
});

test('JSON Schema file change affects validator behavior', async () => {
  const api = {
    schemaVersion: 2,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] }],
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false, 'Must reject schemaVersion != 1 per JSON Schema');
});

test('schema validation produces structured diagnostics with code and path', async () => {
  const api = {
    schemaVersion: 1,
    api: { id: 'artifact.test-family', major: 1, revisionDigest: 'sha256:' + 'a'.repeat(64), displayName: 'Test', summary: 'Test' },
    services: [{ id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] }],
    bogus: true,
  };
  const result = await validateFamilyApi(api);
  assert.equal(result.ok, false);
  for (const err of result.errors) {
    if (typeof err === 'object') {
      assert.ok(err.code || err.message, 'Structured error must have code or message');
      assert.ok(err.path !== undefined, 'Structured error must have path');
    }
  }
});

// ── R2: New required service must be breaking ──

test('adding a new required service is breaking', () => {
  const prev = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] },
    ],
  };
  const curr = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] },
      { id: 'artifact.test.review', required: true, kind: 'operation', intents: ['review'] },
    ],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, false, 'Adding a required service must be breaking');
  assert.ok(result.breaking.some(b => b.includes('required service') || b.includes('new required')),
    `Must report required service addition as breaking, got: ${result.breaking.join('; ')}`);
});

test('changing service from required to optional is breaking', () => {
  const prev = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] },
    ],
  };
  const curr = {
    services: [
      { id: 'artifact.test.author', required: false, kind: 'workflow', intents: ['author'] },
    ],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, false, 'Changing required to optional must be breaking');
  assert.ok(result.breaking.some(b => b.includes('required') || b.includes('optional')),
    `Must report required→optional change, got: ${result.breaking.join('; ')}`);
});

test('changing service from optional to required is breaking', () => {
  const prev = {
    services: [
      { id: 'artifact.test.author', required: false, kind: 'workflow', intents: ['author'] },
    ],
  };
  const curr = {
    services: [
      { id: 'artifact.test.author', required: true, kind: 'workflow', intents: ['author'] },
    ],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, false, 'Changing optional to required must be breaking');
});

test('sibling side-effect swap (write-review-result ↔ write-authorized-artifacts) is breaking', () => {
  const prev = {
    services: [
      { id: 'artifact.test.review', required: true, kind: 'operation', intents: ['review'], sideEffectCeiling: 'write-review-result' },
    ],
  };
  const curr = {
    services: [
      { id: 'artifact.test.review', required: true, kind: 'operation', intents: ['review'], sideEffectCeiling: 'write-authorized-artifacts' },
    ],
  };
  const result = checkApiCompatibility(prev, curr);
  assert.equal(result.compatible, false, 'Sibling side-effect swap must be breaking');
  assert.ok(result.breaking.some(b => b.includes('sideEffectCeiling') || b.includes('side-effect')),
    `Must report side-effect change, got: ${result.breaking.join('; ')}`);
});
