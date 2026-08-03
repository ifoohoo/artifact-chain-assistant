#!/usr/bin/env node
// @scenario S-44 @feature ACA13
// @decision D-ACA-15
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCompatibilityPolicy } from './lib/compatibility-policy.mjs';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const issues = await validateCompatibilityPolicy(pluginRoot);

if (issues.length > 0) {
  for (const issue of issues) {
    process.stderr.write(`compatibility: ${issue}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write('compatibility: all checks passed\n');
}
