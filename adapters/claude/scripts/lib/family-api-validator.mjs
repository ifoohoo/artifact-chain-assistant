// @feature ACA18 @scenario S-65 @decision D-ACA-18
// Family API validator: deterministic, fail-closed validation of Skill Family API definitions.
// Executes the dependency-free validator compiled from the authoritative
// family-api.schema.json. The generated module is checked for drift at build/test.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import validateFamilyApiSchema, { schemaDigest as familyApiSchemaDigest } from './generated/family-api-validator.generated.mjs';
import { canonicalStringify } from './generated/canonical-json-v1.generated.mjs';

export { familyApiSchemaDigest, canonicalStringify };

/**
 * Load and parse a JSON file with fail-closed semantics.
 * @param {string} filePath
 * @returns {Promise<object>}
 */
export async function loadJson(filePath) {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Parse a JSON string safely.
 * @param {string} text
 * @returns {object}
 */
export function parseJson(text) {
  return JSON.parse(text);
}

/**
 * Compute the immutable revision digest of a Family API object.
 * Removes the revisionDigest field, serializes with sorted keys, and hashes SHA-256.
 * @param {object} apiObject - Parsed API YAML object
 * @returns {string} - "sha256:<hex>"
 */
export function computeRevisionDigest(apiObject) {
  const clone = structuredClone(apiObject);
  if (clone.api && typeof clone.api === 'object') {
    delete clone.api.revisionDigest;
  }
  const canonical = canonicalStringify(clone);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Deterministic JSON serialization with sorted keys at every level.
 * Regular arrays preserve input order; set fields are sorted and deduplicated.
 * @param {*} value
 * @returns {string}
 */
export function stableStringify(value) {
  return canonicalStringify(value);
}

/**
 * Compute canonical hash compatible with Registry's computeContentHash.
 * @param {*} value
 * @returns {string} "sha256:<hex>"
 */
export function computeCanonicalHash(value) {
  const canonical = canonicalStringify(value);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return `sha256:${hash}`;
}

// Forbidden fields that must not appear in a Family API service definition
const FORBIDDEN_SERVICE_FIELDS = new Set([
  'stage', 'worker', 'prompt', 'template', 'provider', 'providers',
  'installation', 'enablement', 'trust', 'resolution',
  'locked', 'compatibility', 'selectionSource',
  'bindings', 'sources',
]);

// Fields that must not appear at the top level of the API
const FORBIDDEN_API_FIELDS = new Set([
  'stage', 'worker', 'prompt', 'template', 'provider',
  'installation', 'enablement', 'trust', 'resolution',
  'locked', 'compatibility', 'selectionSource',
  'providers', 'bindings', 'sources',
]);

// Canonical namespace pattern
const CANONICAL_NAMESPACE_RE = /^artifact\.[a-z][a-z0-9-]*-family$/;
const SERVICE_ID_RE = /^artifact\.[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+$/;
const CONTRACT_REF_RE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*@[0-9]+$/;

/**
 * Validate a Family API definition against the authoritative JSON Schema and semantic constraints.
 * @param {object} apiObj - Parsed API object
 * @param {object} [opts] - Options
 * @param {string} [opts.sourcePath] - Source file path for error messages
 * @returns {Promise<{ ok: boolean, errors: Array<{code: string, path: string, message: string}>, warnings: string[] }>}
 */
export async function validateFamilyApi(apiObj, opts = {}) {
  const errors = [];
  const warnings = [];
  const prefix = opts.sourcePath ? `${opts.sourcePath}: ` : '';

  // 1. Run authoritative JSON Schema validation (includes additionalProperties: false)
  try {
    const schemaValid = validateFamilyApiSchema(apiObj);
    if (!schemaValid) {
      for (const err of validateFamilyApiSchema.errors || []) {
        errors.push({
          code: 'SCHEMA_VALIDATION',
          path: err.instancePath || '/',
          message: `${prefix}${err.message}${err.params ? ` (${JSON.stringify(err.params)})` : ''}`,
        });
      }
    }
  } catch (err) {
    errors.push({
      code: 'SCHEMA_LOAD_ERROR',
      path: '/schema',
      message: `Failed to load or compile JSON Schema: ${err.message}`,
    });
    return { ok: false, errors, warnings };
  }

  // 2. Semantic validation beyond JSON Schema capabilities
  if (!apiObj.api || typeof apiObj.api !== 'object') {
    return { ok: false, errors, warnings };
  }

  const api = apiObj.api;

  // 3. Canonical namespace
  if (api.id && !CANONICAL_NAMESPACE_RE.test(api.id)) {
    errors.push({
      code: 'CANONICAL_NAMESPACE',
      path: '/api/id',
      message: `${prefix}api.id "${api.id}" does not match canonical namespace pattern artifact.<family>-family`,
    });
  }

  // 4. Revision digest verification
  if (api.revisionDigest && /^sha256:[a-f0-9]{64}$/.test(api.revisionDigest)) {
    const computed = computeRevisionDigest(apiObj);
    if (computed !== api.revisionDigest) {
      errors.push({
        code: 'DIGEST_MISMATCH',
        path: '/api/revisionDigest',
        message: `${prefix}api.revisionDigest mismatch: declared ${api.revisionDigest}, computed ${computed}`,
      });
    }
  }

  // 5. Forbidden fields (explicit semantic blocklist beyond schema)
  for (const field of FORBIDDEN_API_FIELDS) {
    if (field in apiObj) {
      errors.push({
        code: 'FORBIDDEN_FIELD',
        path: `/${field}`,
        message: `${prefix}forbidden top-level field "${field}" in Family API`,
      });
    }
    if (field in api) {
      errors.push({
        code: 'FORBIDDEN_FIELD',
        path: `/api/${field}`,
        message: `${prefix}forbidden field "${field}" in api object`,
      });
    }
  }

  // 6. Services semantic validation
  if (Array.isArray(apiObj.services)) {
    const serviceIds = new Set();
    for (let i = 0; i < apiObj.services.length; i++) {
      const svc = apiObj.services[i];
      const svcPath = `/services/${i}`;

      // Service ID must belong to this API's family
      if (api.id && svc.id) {
        const familyPrefix = api.id.replace(/-family$/, '');
        if (!svc.id.startsWith(familyPrefix + '.')) {
          errors.push({
            code: 'SERVICE_FAMILY_MISMATCH',
            path: `${svcPath}/id`,
            message: `${prefix}services[${i}] id "${svc.id}" does not belong to family "${api.id}"`,
          });
        }
      }

      // Uniqueness
      if (serviceIds.has(svc.id)) {
        errors.push({
          code: 'DUPLICATE_SERVICE',
          path: `${svcPath}/id`,
          message: `${prefix}services[${i}] duplicate service id "${svc.id}"`,
        });
      }
      serviceIds.add(svc.id);

      // Forbidden service fields
      for (const field of FORBIDDEN_SERVICE_FIELDS) {
        if (field in svc) {
          errors.push({
            code: 'FORBIDDEN_SERVICE_FIELD',
            path: `${svcPath}/${field}`,
            message: `${prefix}services[${i}] forbidden field "${field}" in service definition`,
          });
        }
      }

      // accepts/produces references
      validateRefs(svc.accepts, `${prefix}services[${i}]`, 'accepts', errors);
      validateRefs(svc.produces, `${prefix}services[${i}]`, 'produces', errors);
    }
  }

  // 7. At least one discoverable service (default or help)
  if (Array.isArray(apiObj.services)) {
    const hasDefault = apiObj.services.some(s => s.discoverable?.default);
    const hasHelp = apiObj.services.some(s => s.discoverable?.help);
    if (!hasDefault) {
      warnings.push(`${prefix}no service declared as discoverable.default`);
    }
    if (!hasHelp) {
      warnings.push(`${prefix}no service declared as discoverable.help`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validate an array of contract/protocol references.
 * @param {Array} refs
 * @param {string} svcPrefix
 * @param {string} field
 * @param {Array} errors
 */
function validateRefs(refs, svcPrefix, field, errors) {
  if (refs === undefined) return;
  if (!Array.isArray(refs)) {
    errors.push({
      code: 'INVALID_REF_TYPE',
      path: `${svcPrefix}/${field}`,
      message: `${svcPrefix} ${field} must be an array`,
    });
    return;
  }
  for (let j = 0; j < refs.length; j++) {
    const ref = refs[j];
    const refPath = `${svcPrefix}/${field}[${j}]`;
    if (typeof ref === 'string') {
      if (ref.includes('@') && !CONTRACT_REF_RE.test(ref)) {
        errors.push({
          code: 'INVALID_CONTRACT_REF',
          path: refPath,
          message: `${refPath} "${ref}" looks like a contract reference but does not match pattern <authority>.<type>@<major>`,
        });
      }
    } else if (typeof ref === 'object' && ref !== null) {
      if (!ref.protocol || typeof ref.protocol !== 'string') {
        errors.push({
          code: 'MISSING_PROTOCOL',
          path: refPath,
          message: `${refPath} protocol reference must have a string "protocol" field`,
        });
      }
      if (!ref.version || typeof ref.version !== 'string') {
        errors.push({
          code: 'MISSING_VERSION',
          path: refPath,
          message: `${refPath} protocol reference must have a string "version" field`,
        });
      }
    } else {
      errors.push({
        code: 'INVALID_REF_TYPE',
        path: refPath,
        message: `${refPath} must be a string or protocol reference object`,
      });
    }
  }
}

/**
 * Validate that a catalog is consistent with its referenced API files.
 * @param {object} catalog - Parsed catalog.yaml
 * @param {Array<{id: string, major: number, content: object}>} apiFiles
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCatalogConsistency(catalog, apiFiles) {
  const errors = [];

  if (!catalog || !Array.isArray(catalog.families)) {
    errors.push('catalog.families must be an array');
    return { ok: false, errors };
  }

  for (const entry of catalog.families) {
    if (!entry.id || !entry.major) {
      errors.push(`catalog family entry missing id or major`);
      continue;
    }

    const apiFile = apiFiles.find(f => f.id === entry.id && f.major === entry.major);
    if (!apiFile) {
      errors.push(`catalog references ${entry.id}@${entry.major} but no matching API file found`);
      continue;
    }

    if (entry.revisionDigest !== apiFile.content.api.revisionDigest) {
      errors.push(
        `catalog revisionDigest for ${entry.id}@${entry.major} (${entry.revisionDigest}) ` +
        `does not match API file (${apiFile.content.api.revisionDigest})`
      );
    }
  }

  for (const apiFile of apiFiles) {
    const inCatalog = catalog.families.some(
      f => f.id === apiFile.id && f.major === apiFile.major
    );
    if (!inCatalog) {
      errors.push(`API file ${apiFile.id}@${apiFile.major} exists but is not in catalog`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Side-effect ceiling ranking for comparison.
 * Siblings (same rank) are NOT interchangeable — swapping between them is breaking.
 */
const CEILING_RANK = {
  'none': 0,
  'read-only': 1,
  'write-authorized-artifacts': 2,
  'write-review-result': 2,
  'write-project-artifacts': 3,
};

/**
 * Check API compatibility: adding optional service is compatible,
 * removing required, changing required/optional flag, changing accepts/produces,
 * swapping sibling side-effects, or expanding side effect is breaking.
 * @param {object} previousApi - Previous API object
 * @param {object} currentApi - Current API object
 * @returns {{ compatible: boolean, breaking: string[] }}
 */
export function checkApiCompatibility(previousApi, currentApi) {
  const breaking = [];
  const prevServices = new Map((previousApi.services || []).map(s => [s.id, s]));
  const currServices = new Map((currentApi.services || []).map(s => [s.id, s]));

  // Check removed services
  for (const [id, prev] of prevServices) {
    if (!currServices.has(id)) {
      if (prev.required) {
        breaking.push(`required service "${id}" removed`);
      }
      // Removing optional service is compatible
    }
  }

  // Check changed and new services
  for (const [id, curr] of currServices) {
    const prev = prevServices.get(id);
    if (!prev) {
      // New required service is breaking
      if (curr.required) {
        breaking.push(`new required service "${id}" added`);
      }
      // New optional service is compatible
      continue;
    }

    // Check required flag changed
    if (prev.required !== curr.required) {
      breaking.push(`service "${id}" required flag changed from ${prev.required} to ${curr.required}`);
    }

    // Check accepts changed
    const prevAccepts = stableStringify(prev.accepts || []);
    const currAccepts = stableStringify(curr.accepts || []);
    if (prevAccepts !== currAccepts) {
      breaking.push(`service "${id}" accepts changed`);
    }

    // Check produces changed
    const prevProduces = stableStringify(prev.produces || []);
    const currProduces = stableStringify(curr.produces || []);
    if (prevProduces !== currProduces) {
      breaking.push(`service "${id}" produces changed`);
    }

    // Check side effect: expansion OR sibling swap is breaking
    const prevCeiling = prev.sideEffectCeiling;
    const currCeiling = curr.sideEffectCeiling;
    if (prevCeiling !== currCeiling) {
      const prevRank = CEILING_RANK[prevCeiling] ?? 0;
      const currRank = CEILING_RANK[currCeiling] ?? 0;
      // Expansion (higher rank) is breaking
      if (currRank > prevRank) {
        breaking.push(`service "${id}" sideEffectCeiling expanded from "${prevCeiling}" to "${currCeiling}"`);
      }
      // Sibling swap (same rank, different ceiling) is also breaking
      // e.g., write-review-result ↔ write-authorized-artifacts
      else if (currRank === prevRank) {
        breaking.push(`service "${id}" sideEffectCeiling changed from "${prevCeiling}" to "${currCeiling}" (sibling swap)`);
      }
    }
  }

  return { compatible: breaking.length === 0, breaking };
}
