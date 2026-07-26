// @feature ACA16 @scenario S-49
// Deterministic batch result merging for artifact review workflows.

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Severity ordering for status/decision aggregation.
 * Lower index = less severe.
 */
const STATUS_SEVERITY = ['SKIPPED', 'SUCCEEDED', 'NEEDS_INPUT', 'BLOCKED', 'FAILED'];
const DECISION_SEVERITY = ['NOT_APPLICABLE', 'PASS', 'PASS_WITH_RESIDUAL_MINOR', 'NEEDS_INPUT', 'BLOCKED', 'FAIL'];
const EXECUTORS = new Set(['script', 'worker', 'agent', 'manual', 'cli']);

/**
 * Get the most severe value from a list using a severity ordering.
 */
function mostSevere(values, severityOrder) {
  let maxIdx = -1;
  let result = null;
  for (const v of values) {
    const idx = severityOrder.indexOf(v);
    if (idx > maxIdx) {
      maxIdx = idx;
      result = v;
    }
  }
  return result;
}

/**
 * Validate a single result object against Review Result Protocol v1.0.
 * Returns an error string if invalid, or null if valid.
 */
function validateResult(result, filePath) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return `${filePath}: root must be an object`;
  if (!result.schema_version) {
    return `${filePath}: missing schema_version`;
  }
  if (result.schema_version !== '1.0') {
    return `${filePath}: unsupported schema_version "${result.schema_version}" (expected "1.0")`;
  }
  if (!result.run_id) {
    return `${filePath}: missing run_id`;
  }
  if (!result.status) {
    return `${filePath}: missing status`;
  }
  if (!STATUS_SEVERITY.includes(result.status)) return `${filePath}: invalid status`;
  if (!result.decision) {
    return `${filePath}: missing decision`;
  }
  if (!DECISION_SEVERITY.includes(result.decision)) return `${filePath}: invalid decision`;
  if (typeof result.summary !== 'string') return `${filePath}: invalid summary`;
  if (result.producer !== undefined) {
    if (!result.producer || typeof result.producer !== 'object' || Array.isArray(result.producer)) return `${filePath}: invalid producer`;
    if (!EXECUTORS.has(result.producer.executor) || typeof result.producer.name !== 'string') return `${filePath}: invalid producer`;
  }
  if (result.review?.metrics !== undefined) {
    if (!result.review.metrics || typeof result.review.metrics !== 'object' || Array.isArray(result.review.metrics)) return `${filePath}: invalid metrics`;
    for (const value of Object.values(result.review.metrics)) {
      if (!Number.isInteger(value) || value < 0) return `${filePath}: invalid metric`;
    }
  }
  return null;
}

/**
 * Merge findings arrays, deduplicating by finding id.
 * When duplicates exist, the first occurrence wins (deterministic by file sort order).
 */
function mergeFindings(allFindings) {
  const seen = new Set();
  const merged = [];

  for (const finding of allFindings) {
    if (finding.id && seen.has(finding.id)) {
      continue;
    }
    if (finding.id) {
      seen.add(finding.id);
    }
    merged.push(finding);
  }

  return merged;
}

/**
 * Sum numeric metrics across all results.
 */
function sumMetrics(allMetrics) {
  const sums = {};

  for (const metrics of allMetrics) {
    if (!metrics) continue;
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        sums[key] = (sums[key] || 0) + value;
      }
    }
  }

  return sums;
}

/**
 * Collect all findings from result objects.
 */
function collectFindings(results) {
  const allFindings = [];

  for (const result of results) {
    const findings = result.review?.findings || [];
    allFindings.push(...findings);

    // Also include resolved_findings for completeness
    const resolved = result.review?.resolved_findings || [];
    allFindings.push(...resolved);
  }

  return allFindings;
}

/**
 * Collect all metrics from result objects.
 */
function collectMetrics(results) {
  return results
    .map(r => r.review?.metrics)
    .filter(Boolean);
}

/**
 * Collect all batches from result objects.
 */
function collectBatches(results) {
  const batches = [];

  for (const result of results) {
    if (result.review?.batches) {
      batches.push(...result.review.batches);
    }
  }

  return batches;
}

/**
 * Determine merged run_id from results.
 * Uses the first result's run_id as the base, or the provided override.
 */
function determineRunId(results, overrideRunId) {
  if (overrideRunId) return overrideRunId;
  return results[0].run_id;
}

/**
 * Deterministic batch result merging.
 *
 * @param {string} resultsDir - Directory containing batch result JSON files
 * @param {object} options
 * @param {string} [options.runId] - Override run_id for merged result
 * @returns {Promise<object>} Merged Review Result Protocol v1.0
 * @throws {Error} If validation fails or no results found
 */
export async function batchMerge(resultsDir, options = {}) {
  const base = resolve(resultsDir);

  // Read all JSON files from results directory
  const entries = await readdir(base).catch(() => {
    throw new Error(`Cannot read results directory: ${base}`);
  });

  const jsonFiles = entries
    .filter(e => e.endsWith('.json'))
    .sort(); // Deterministic sort by filename

  if (jsonFiles.length === 0) {
    throw new Error(`No JSON files found in ${base}`);
  }

  // Load and validate all results
  const results = [];
  const errors = [];

  for (const fileName of jsonFiles) {
    const filePath = join(base, fileName);
    const content = await readFile(filePath, 'utf8');

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      errors.push(`${fileName}: invalid JSON - ${e.message}`);
      continue;
    }

    const validationError = validateResult(parsed, fileName);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    results.push(parsed);
  }

  if (errors.length > 0) {
    throw new Error(`Validation errors:\n${errors.join('\n')}`);
  }

  if (results.length === 0) {
    throw new Error(`No valid results found in ${base}`);
  }

  // Sort results by stage_id for deterministic ordering
  results.sort((a, b) => {
    const aKey = a.stage_id || '';
    const bKey = b.stage_id || '';
    return aKey.localeCompare(bKey);
  });

  // Merge components
  const allFindings = collectFindings(results);
  const mergedFindings = mergeFindings(allFindings);
  const mergedMetrics = sumMetrics(collectMetrics(results));
  const mergedBatches = collectBatches(results);

  // Aggregate status and decision
  const statuses = results.map(r => r.status);
  const decisions = results.map(r => r.decision);
  const mergedStatus = statuses.every(s => s === 'SUCCEEDED') ? 'SUCCEEDED' : mostSevere(statuses, STATUS_SEVERITY);
  const mergedDecision = decisions.includes('FAIL') ? 'FAIL' : decisions.includes('BLOCKED') ? 'BLOCKED' : mostSevere(decisions, DECISION_SEVERITY);

  // Build merged result
  const merged = {
    schema_version: '1.0',
    run_id: determineRunId(results, options.runId),
    status: mergedStatus,
    decision: mergedDecision,
    summary: `Batch completed: ${mergedBatches.length || results.length} batches, ${mergedMetrics.files_scanned || 0} files, ${mergedFindings.length} findings.`,
    review: {
      batches: mergedBatches,
      metrics: mergedMetrics,
      findings: mergedFindings,
    },
  };

  return merged;
}

// CLI entry point
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const resultsDir = args[0];

  if (!resultsDir) {
    console.error('Usage: node batch-merge.mjs <results-dir> [--run-id <id>]');
    process.exit(1);
  }

  let runId;
  const runIdIdx = args.indexOf('--run-id');
  if (runIdIdx !== -1 && args[runIdIdx + 1]) {
    runId = args[runIdIdx + 1];
  }

  try {
    const merged = await batchMerge(resultsDir, { runId });
    console.log(JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
