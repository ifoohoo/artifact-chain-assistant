// @feature ACA18 @scenario S-66 @decision D-ACA-18
// Dependency-free project-facts and Method Query protocol implementation.
// JSON Schemas are compiled at build time into the generated validators below.
//
// Registry is the sole Method Query producer. This library provides:
// - buildProjectFactsEnvelope / validateProjectFacts: envelope lifecycle
// - buildMethodQueryCandidate: produces the 5-key candidate for Registry consumption
//
// DEPRECATED: buildMethodQuery and computeQueryDigest were removed to enforce
// Registry as the only producer of target/contract/evidence/queryDigest.
import { createHash } from 'node:crypto';
import { canonicalStringify, cloneStrictJsonData } from './generated/canonical-json-v1.generated.mjs';
import validateProjectFactsSchema, { schemaDigest as projectFactsSchemaDigest } from './generated/project-facts-validator.generated.mjs';

export { projectFactsSchemaDigest };

function digestObject(value) {
  return `sha256:${createHash('sha256').update(canonicalStringify(value)).digest('hex')}`;
}

export function computeEvidenceDigest(envelope) {
  const clone = structuredClone(envelope);
  delete clone.evidenceDigest;
  return digestObject(clone);
}

export function buildProjectFactsEnvelope(facts) {
  const snapshot = cloneStrictJsonData(facts);
  const contextTargets = normalizeContextTargets(snapshot.artifactGraphSummary?.contextTargets);
  const envelope = {
    schemaVersion: 1,
    projectRoot: snapshot.projectRoot,
    configDigest: snapshot.configDigest,
    artifactGraphSummary: {
      ...snapshot.artifactGraphSummary,
      contextTargets,
    },
    targetArtifact: snapshot.targetArtifact,
    contractRevisionDigest: snapshot.contractRevisionDigest,
    proofStatus: snapshot.proofStatus,
    versionLockStatus: snapshot.versionLockStatus,
    sourcesFreshness: snapshot.sourcesFreshness,
    bindingFreshness: snapshot.bindingFreshness,
  };
  if (Object.hasOwn(snapshot, 'policyDigest')) envelope.policyDigest = snapshot.policyDigest;
  envelope.evidenceDigest = computeEvidenceDigest(envelope);
  return envelope;
}

function normalizeContextTargets(value) {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new TypeError('artifactGraphSummary.contextTargets must be a string array');
  }
  return [...new Set(value)].sort();
}

function hasCanonicalContextTargets(value) {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return false;
  return value.every((item, index) => index === 0 || value[index - 1] < item);
}

function schemaErrors(validate) {
  return (validate.errors || []).map(error => ({
    code: 'SCHEMA_VALIDATION',
    path: error.instancePath || '/',
    message: error.message,
  }));
}

function validateProjectFactsSync(envelope) {
  if (!validateProjectFactsSchema(envelope)) {
    return { ok: false, status: 'NEEDS_INPUT', errors: schemaErrors(validateProjectFactsSchema) };
  }
  if (!hasCanonicalContextTargets(envelope.artifactGraphSummary.contextTargets)) {
    return {
      ok: false,
      status: 'NEEDS_INPUT',
      errors: [{
        code: 'NON_CANONICAL_CONTEXT_TARGETS',
        path: '/artifactGraphSummary/contextTargets',
        message: 'contextTargets must be sorted and unique',
      }],
    };
  }
  const computed = computeEvidenceDigest(envelope);
  if (computed !== envelope.evidenceDigest) {
    return {
      ok: false,
      status: 'NEEDS_INPUT',
      errors: [{
        code: 'DIGEST_MISMATCH',
        path: '/evidenceDigest',
        message: 'evidenceDigest mismatch',
      }],
    };
  }
  return { ok: true, status: 'READY', errors: [] };
}

export async function validateProjectFacts(envelope) {
  return validateProjectFactsSync(envelope);
}

/**
 * Build a Method Query candidate (5 top-level keys).
 * This is the input for Registry's queryEffectiveIndex. Registry may create a
 * process-local preparedQueryHandle for a downstream executor; this library
 * never receives, serializes or substitutes that capability.
 * Registry is the sole Method Query producer — do NOT use this to build a full query.
 */
export function buildMethodQueryCandidate(params) {
  const snapshot = cloneStrictJsonData(params);
  const allowedKeys = ['mode', 'intent', 'kind', 'projectFactsEvidence', 'authorization'];
  const keys = Object.keys(snapshot);
  const extraKeys = keys.filter(key => !allowedKeys.includes(key));
  const missingKeys = allowedKeys.filter(key => !Object.hasOwn(snapshot, key));
  if (extraKeys.length > 0 || missingKeys.length > 0) {
    throw new TypeError(`Method Query Candidate must contain exactly 5 keys; extra=[${extraKeys.join(', ')}], missing=[${missingKeys.join(', ')}]`);
  }

  // mode must be 'standard' (the only valid value)
  if (snapshot.mode !== 'standard') {
    throw new TypeError("mode must be 'standard'");
  }

  // intent must be a valid Method Query intent enum
  const VALID_INTENTS = new Set(['default', 'help', 'author', 'review', 'repair', 'route', 'audit', 'generate', 'batch']);
  if (typeof snapshot.intent !== 'string' || !VALID_INTENTS.has(snapshot.intent)) {
    throw new TypeError(`intent must be one of: ${[...VALID_INTENTS].join(', ')}`);
  }

  // kind must be 'workflow' or 'operation'
  if (snapshot.kind !== 'workflow' && snapshot.kind !== 'operation') {
    throw new TypeError("kind must be 'workflow' or 'operation'");
  }

  // authorization must have exactly sideEffectBudget and granted
  if (!snapshot.authorization || typeof snapshot.authorization !== 'object' || Array.isArray(snapshot.authorization)) {
    throw new TypeError('authorization must be an object');
  }
  const authorizationKeys = Object.keys(snapshot.authorization);
  const AUTHORIZATION_REQUIRED = ['sideEffectBudget', 'granted'];
  const AUTHORIZATION_ALLOWED = new Set(AUTHORIZATION_REQUIRED);
  const extraAuthKeys = authorizationKeys.filter(k => !AUTHORIZATION_ALLOWED.has(k));
  const missingAuthKeys = AUTHORIZATION_REQUIRED.filter(k => !authorizationKeys.includes(k));
  if (extraAuthKeys.length > 0 || missingAuthKeys.length > 0) {
    throw new TypeError(`authorization must have exactly sideEffectBudget and granted; extra=[${extraAuthKeys.join(', ')}], missing=[${missingAuthKeys.join(', ')}]`);
  }

  // sideEffectBudget must be a valid enum value
  const VALID_BUDGETS = new Set(['none', 'read-only', 'write-authorized-artifacts', 'write-review-result', 'write-project-artifacts']);
  if (!VALID_BUDGETS.has(snapshot.authorization.sideEffectBudget)) {
    throw new TypeError(`authorization.sideEffectBudget must be one of: ${[...VALID_BUDGETS].join(', ')}`);
  }

  // granted must be boolean
  if (typeof snapshot.authorization.granted !== 'boolean') {
    throw new TypeError('authorization.granted must be a boolean');
  }

  if (!snapshot.projectFactsEvidence || typeof snapshot.projectFactsEvidence !== 'object' || Array.isArray(snapshot.projectFactsEvidence)) {
    throw new TypeError('projectFactsEvidence must be a valid Project Facts Evidence Envelope object');
  }
  const validation = validateProjectFactsSync(snapshot.projectFactsEvidence);
  if (!validation.ok) {
    const codes = validation.errors.map(error => error.code).join(', ');
    throw new TypeError(`projectFactsEvidence validation failed: ${codes}`);
  }

  return {
    mode: snapshot.mode,
    intent: snapshot.intent,
    kind: snapshot.kind,
    projectFactsEvidence: snapshot.projectFactsEvidence,
    authorization: snapshot.authorization,
  };
}
