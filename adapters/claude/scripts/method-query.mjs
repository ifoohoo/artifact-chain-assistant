#!/usr/bin/env node
// @feature ACA18 @scenario S-66 @decision D-ACA-18
// Method Query CLI: validate/build project-facts envelopes and candidates.
// Deterministic, fail-closed: invalid input → non-zero exit.
//
// Registry is the sole Method Query producer. This CLI provides:
// - validate-envelope: validate a project-facts evidence envelope
// - build-envelope: build and validate an envelope from raw facts
// - build-candidate: build a 5-key candidate for Registry consumption
//
// REMOVED: build-query, digest — these produced full Method Query/queryDigest
// outside Registry, violating the single-producer invariant.
import { readFile } from 'node:fs/promises';
import {
  buildProjectFactsEnvelope,
  validateProjectFacts,
  buildMethodQueryCandidate,
} from './lib/method-query.mjs';

const command = process.argv[2];

if (!command || command === '--help') {
  process.stderr.write(`Usage:
  method-query.mjs validate-envelope <path>   Validate a project-facts envelope
  method-query.mjs build-envelope <path>      Build envelope from raw facts JSON
  method-query.mjs build-candidate <path>     Build candidate for Registry
`);
  process.exit(command ? 0 : 1);
}

try {
  switch (command) {
    case 'validate-envelope': {
      const filePath = process.argv[3];
      if (!filePath) { process.stderr.write('Missing file path\n'); process.exit(1); }
      const envelope = JSON.parse(await readFile(filePath, 'utf8'));
      const result = await validateProjectFacts(envelope);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (!result.ok) process.exit(1);
      break;
    }
    case 'build-envelope': {
      const filePath = process.argv[3];
      if (!filePath) { process.stderr.write('Missing file path\n'); process.exit(1); }
      const facts = JSON.parse(await readFile(filePath, 'utf8'));
      const envelope = buildProjectFactsEnvelope(facts);
      const validation = await validateProjectFacts(envelope);
      process.stdout.write(JSON.stringify({ ...validation, envelope }, null, 2) + '\n');
      if (!validation.ok) process.exit(1);
      break;
    }
    case 'build-candidate': {
      const filePath = process.argv[3];
      if (!filePath) { process.stderr.write('Missing file path\n'); process.exit(1); }
      const params = JSON.parse(await readFile(filePath, 'utf8'));
      const candidate = buildMethodQueryCandidate(params);
      process.stdout.write(JSON.stringify({ ok: true, candidate }, null, 2) + '\n');
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exit(1);
  }
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
