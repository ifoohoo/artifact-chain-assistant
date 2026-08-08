#!/usr/bin/env node
// @feature ACA18 @scenario S-65 @decision D-ACA-18
// Thin full-family compiler facade. API-only validation belongs to
// check-family-api.mjs. Full conformance integrates the authoritative
// Registry v2 verifier for independent implementation verification.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson, validateCatalogConsistency, validateFamilyApi } from './lib/family-api-validator.mjs';
import { parseMinimalYaml } from './lib/inline-yaml-parser.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function subprocessCommandRunner({ command, args, cwd, timeout }) {
  return {
    stdout: execFileSync(command, args, { encoding: 'utf8', cwd, timeout }),
  };
}

export async function familyCompile({
  familyApiPath,
  catalogPath,
  implementationPath,
  pluginRoot,
  artifactGraphCommand,
  registryCommand,
  commandRunner = subprocessCommandRunner,
}) {
  const base = pluginRoot || root;
  const checks = [];
  const result = {
    ok: false,
    apiConformance: { status: 'FAIL' },
    familyConformance: { status: 'FAIL' },
    deterministicConformance: { status: 'FAIL', checks, attestations: [] },
    behaviorQualification: {
      status: 'NOT_RUN',
      evidence: [],
      limitations: [
        'Family behavior TCK has not run',
        'Behavior qualification cannot prove general LLM semantic quality',
      ],
    },
  };

  let api;
  const apiCheck = { name: 'family-api-validation', ok: false, status: 'FAIL', errors: [] };
  try {
    api = await loadJson(familyApiPath);
    const validation = await validateFamilyApi(api, { sourcePath: familyApiPath });
    apiCheck.ok = validation.ok;
    apiCheck.status = validation.ok ? 'PASS' : 'FAIL';
    apiCheck.errors = validation.errors.map(error => typeof error === 'string' ? error : `${error.code} ${error.path}: ${error.message}`);
    apiCheck.warnings = validation.warnings;
  } catch (error) {
    apiCheck.errors.push(`Failed to load API file: ${error.message}`);
  }
  checks.push(apiCheck);

  const catalogCheck = { name: 'catalog-consistency', ok: false, status: 'FAIL', errors: [] };
  try {
    const catalog = await loadJson(catalogPath || join(base, 'family-apis/catalog.json'));
    if (!api) api = await loadJson(familyApiPath);
    const validation = validateCatalogConsistency(catalog, [{
      id: api.api?.id,
      major: api.api?.major,
      content: api,
    }]);
    catalogCheck.ok = validation.ok;
    catalogCheck.status = validation.ok ? 'PASS' : 'FAIL';
    catalogCheck.errors = validation.errors;
  } catch (error) {
    catalogCheck.errors.push(`Catalog consistency check failed: ${error.message}`);
  }
  checks.push(catalogCheck);

  result.apiConformance.status = apiCheck.ok && catalogCheck.ok ? 'PASS' : 'FAIL';

  const contractCheck = {
    name: 'artifact-contract-validation',
    ok: false,
    status: 'FAIL',
    errors: [],
    resolvedContracts: [],
  };
  const command = artifactGraphCommand || findArtifactGraphCli(base);
  const contractRefs = collectContractRefs(api);
  if (!command) {
    contractCheck.errors.push('artifact-graph CLI not found; authoritative contract validation is required');
  } else {
    let allResolved = true;
    for (const contractRef of contractRefs) {
      try {
        const response = await commandRunner({
          command,
          args: ['contract', 'explain', '--contract', contractRef, '--format', 'json'],
          cwd: base,
          timeout: 30000,
        });
        const parsed = JSON.parse(response.stdout);
        const revisionDigest = parsed?.data?.identity?.revisionDigest;
        if (parsed?.ok !== true || !/^sha256:[a-f0-9]{64}$/.test(revisionDigest || '')) {
          throw new Error('contract explain returned no authoritative revision digest');
        }
        contractCheck.resolvedContracts.push({ ref: contractRef, revisionDigest, status: 'RESOLVED' });
      } catch (error) {
        allResolved = false;
        contractCheck.errors.push(`contract explain for ${contractRef} failed: ${error.message}`);
        contractCheck.resolvedContracts.push({ ref: contractRef, status: 'FAIL' });
      }
    }
    contractCheck.ok = allResolved;
    contractCheck.status = allResolved ? 'PASS' : 'FAIL';
  }
  checks.push(contractCheck);

  const implementationCheck = {
    name: 'implementation-descriptor-presence',
    ok: false,
    status: 'IMPLEMENTATION_REQUIRED',
    errors: [],
  };
  const registryCheck = {
    name: 'registry-v2-validation',
    ok: false,
    status: 'REGISTRY_V2_REQUIRED',
    errors: [],
  };

  let implementationDescriptor = null;

  if (!implementationPath) {
    implementationCheck.errors.push('Full family compile requires --implementation=<implementation.yaml>');
  } else if (!existsSync(implementationPath)) {
    implementationCheck.errors.push(`Implementation descriptor not found: ${implementationPath}`);
  } else {
    // Step 1: Invoke Registry v2 validate command
    const registryCmd = registryCommand || findRegistryCli(base);
    if (!registryCmd) {
      registryCheck.errors.push('Registry v2 CLI not found; authoritative validation is required');
      registryCheck.status = 'REGISTRY_V2_REQUIRED';
    } else {
      try {
        const registryResponse = await commandRunner({
          command: registryCmd,
          args: ['validate', '--catalog', implementationPath],
          cwd: base,
          timeout: 30000,
        });
        const registryParsed = JSON.parse(registryResponse.stdout);
        if (registryParsed?.ok !== true) {
          const diagnostics = (registryParsed?.diagnostics || [])
            .filter(d => d.severity === 'error')
            .map(d => d.message || d.code)
            .join('; ');
          throw new Error(`Registry v2 validation failed: ${diagnostics || 'ok=false'}`);
        }
        registryCheck.ok = true;
        registryCheck.status = 'PASS';

        // Step 2: Read and parse implementation descriptor using fail-closed YAML parser
        const yamlSource = readFileSync(implementationPath, 'utf8');
        implementationDescriptor = parseMinimalYaml(yamlSource);
        if (!implementationDescriptor || typeof implementationDescriptor !== 'object') {
          throw new Error('Failed to parse implementation descriptor as valid YAML mapping');
        }

        // Step 3: Execute assistant-owned API/implementation conformance checks
        const conformanceErrors = validateImplementationConformance(api, implementationDescriptor);
        if (conformanceErrors.length > 0) {
          implementationCheck.errors.push(...conformanceErrors);
          implementationCheck.status = 'CONFORMANCE_FAIL';
        } else {
          implementationCheck.ok = true;
          implementationCheck.status = 'PASS';
        }
      } catch (error) {
        registryCheck.errors.push(`Registry v2 validation failed: ${error.message}`);
        registryCheck.status = 'FAIL';
        implementationCheck.errors.push(`Implementation verification failed: ${error.message}`);
      }
    }
  }
  checks.push(implementationCheck);
  checks.push(registryCheck);

  const allPass = checks.every(check => check.ok === true);
  result.deterministicConformance.status = allPass ? 'PASS' : 'FAIL';
  result.familyConformance.status = allPass ? 'PASS' : 'FAIL';
  result.ok = allPass;
  return result;
}

function collectContractRefs(api) {
  const refs = new Set();
  for (const service of api?.services || []) {
    for (const ref of [...(service.accepts || []), ...(service.produces || [])]) {
      if (typeof ref === 'string' && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*@[0-9]+$/.test(ref)) refs.add(ref);
    }
  }
  return [...refs].sort();
}

function findArtifactGraphCli(base) {
  const candidates = [
    join(base, 'node_modules/.bin/artifact-graph'),
    join(base, '../../node_modules/.bin/artifact-graph'),
  ];
  return candidates.find(candidate => existsSync(candidate)) || null;
}

function findRegistryCli(base) {
  // Deterministic search in plugin and parent project node_modules
  const candidates = [
    join(base, 'node_modules/.bin/agent-method-registry'),
    join(base, '../../node_modules/.bin/agent-method-registry'),
  ];
  return candidates.find(candidate => existsSync(candidate)) || null;
}

/**
 * Validate implementation conformance against Family API.
 * Only checks what assistant owns: API identity match, required service coverage,
 * and no unknown services. Structure validation is Registry's responsibility.
 *
 * @param {object} api - The loaded Family API
 * @param {object} descriptor - The parsed implementation descriptor
 * @returns {string[]} Array of conformance errors (empty if all pass)
 */
function validateImplementationConformance(api, descriptor) {
  const errors = [];

  // Check implements block exists
  const impl = descriptor.implements;
  if (!impl || typeof impl !== 'object') {
    errors.push('Implementation descriptor missing "implements" block');
    return errors;
  }

  // Verify API identity match (exact match required)
  const apiId = api?.api?.id;
  const apiMajor = api?.api?.major;
  const apiRevisionDigest = api?.api?.revisionDigest;

  if (!apiId || apiMajor === undefined || !apiRevisionDigest) {
    errors.push('Family API missing required identity fields (id, major, revisionDigest)');
    return errors;
  }

  if (impl.apiId !== apiId) {
    errors.push(`API id mismatch: expected "${apiId}", got "${impl.apiId}"`);
  }
  if (impl.apiMajor !== apiMajor) {
    errors.push(`API major version mismatch: expected ${apiMajor}, got ${impl.apiMajor}`);
  }
  if (impl.apiRevisionDigest !== apiRevisionDigest) {
    errors.push(`API revision digest mismatch: expected "${apiRevisionDigest}", got "${impl.apiRevisionDigest}"`);
  }

  // Check services conformance
  const services = descriptor.services;
  if (!services || typeof services !== 'object' || Array.isArray(services)) {
    errors.push('"services" must be a mapping');
    return errors;
  }

  const implementedServices = new Set(Object.keys(services));

  // Check all required services are implemented
  const requiredServices = (api?.services || [])
    .filter(service => service.required === true)
    .map(service => service.id);

  for (const required of requiredServices) {
    if (!implementedServices.has(required)) {
      errors.push(`Required service not implemented: "${required}"`);
    }
  }

  // Check no unknown services (not in API)
  const apiServiceIds = new Set((api?.services || []).map(service => service.id));
  for (const implemented of implementedServices) {
    if (!apiServiceIds.has(implemented)) {
      errors.push(`Unknown service not in API: "${implemented}"`);
    }
  }

  return errors;
}

if (process.argv[1] && process.argv[1].endsWith('family-compile.mjs')) {
  const apiArg = process.argv.find(argument => argument.startsWith('--api='));
  if (!apiArg) {
    process.stderr.write('Usage: family-compile.mjs --api=<api.json> --implementation=<implementation.yaml> [--catalog=<catalog.json>] [--registry-command=<path>]\n');
    process.exit(1);
  }
  const catalogArg = process.argv.find(argument => argument.startsWith('--catalog='));
  const implementationArg = process.argv.find(argument => argument.startsWith('--implementation='));
  const registryCommandArg = process.argv.find(argument => argument.startsWith('--registry-command='));
  const result = await familyCompile({
    familyApiPath: apiArg.slice('--api='.length),
    catalogPath: catalogArg?.slice('--catalog='.length),
    implementationPath: implementationArg?.slice('--implementation='.length),
    registryCommand: registryCommandArg?.slice('--registry-command='.length),
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exit(1);
}
