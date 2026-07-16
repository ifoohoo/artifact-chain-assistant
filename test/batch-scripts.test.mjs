// @feature ACA16 @scenario S-49
// Tests for batch-split and batch-merge scripts.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { batchSplit } from '../scripts/batch-split.mjs';
import { batchMerge } from '../scripts/batch-merge.mjs';

/**
 * Helper: create a temporary directory.
 */
async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'batch-test-'));
}

/**
 * Helper: write a file with content.
 */
async function writeTestFile(dir, relativePath, content) {
  const fullPath = join(dir, relativePath);
  const parent = fullPath.substring(0, fullPath.lastIndexOf('/'));
  await mkdir(parent, { recursive: true });
  await writeFile(fullPath, content, 'utf8');
  return fullPath;
}

/**
 * Helper: create a valid Review Result Protocol v1.0 result.
 */
function createValidResult(overrides = {}) {
  return {
    schema_version: '1.0',
    run_id: 'test-run-001',
    status: 'SUCCEEDED',
    decision: 'PASS',
    summary: 'Test result',
    review: {
      metrics: {
        files_scanned: 5,
        findings_count: 0,
        batch_count: 1,
      },
      findings: [],
      ...overrides.review,
    },
    ...overrides,
  };
}

describe('batch-split', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should handle a single file', async () => {
    await writeTestFile(tempDir, 'single.md', '# Hello');

    const batches = await batchSplit(tempDir);

    assert.equal(batches.length, 1);
    assert.equal(batches[0].id, 'batch-001');
    assert.deepEqual(batches[0].files, ['single.md']);
    assert.equal(batches[0].chars, 7); // '# Hello' is 7 chars
  });

  it('should put multiple small files in one batch', async () => {
    await writeTestFile(tempDir, 'a.md', 'File A');
    await writeTestFile(tempDir, 'b.md', 'File B');
    await writeTestFile(tempDir, 'c.md', 'File C');

    const batches = await batchSplit(tempDir);

    assert.equal(batches.length, 1);
    assert.equal(batches[0].files.length, 3);
    // Files should be sorted by path
    assert.deepEqual(batches[0].files, ['a.md', 'b.md', 'c.md']);
  });

  it('should split into multiple batches when exceeding batch-size', async () => {
    // Create files where first two fit in one batch, third starts a new one
    await writeTestFile(tempDir, 'file1.md', 'A'.repeat(400));
    await writeTestFile(tempDir, 'file2.md', 'B'.repeat(400));
    await writeTestFile(tempDir, 'file3.md', 'C'.repeat(400));

    const batches = await batchSplit(tempDir, { batchSize: 1000 });

    // file1 (400) + file2 (400) = 800 <= 1000, fits in batch 1
    // file3 (400) would make 1200 > 1000, so batch 1 flushes, file3 starts batch 2
    assert.equal(batches.length, 2);
    assert.equal(batches[0].files.length, 2);
    assert.equal(batches[1].files.length, 1);
    assert.deepEqual(batches[0].files, ['file1.md', 'file2.md']);
    assert.deepEqual(batches[1].files, ['file3.md']);
  });

  it('should put a single large file in its own batch', async () => {
    await writeTestFile(tempDir, 'small.md', 'Small');
    await writeTestFile(tempDir, 'huge.md', 'X'.repeat(100000));
    await writeTestFile(tempDir, 'another.md', 'Another');

    const batches = await batchSplit(tempDir, { batchSize: 40000 });

    // huge.md should be its own batch
    const hugeBatch = batches.find(b => b.files.includes('huge.md'));
    assert.ok(hugeBatch, 'huge.md should be in a batch');
    assert.equal(hugeBatch.files.length, 1, 'huge.md should be alone in its batch');
  });

  it('should return empty array for empty directory', async () => {
    const batches = await batchSplit(tempDir);

    assert.deepEqual(batches, []);
  });

  it('should return empty array for non-existent directory', async () => {
    const batches = await batchSplit('/non/existent/path');

    assert.deepEqual(batches, []);
  });

  it('should produce deterministic output for same input', async () => {
    await writeTestFile(tempDir, 'z.md', 'Z file');
    await writeTestFile(tempDir, 'a.md', 'A file');
    await writeTestFile(tempDir, 'm.md', 'M file');

    const batches1 = await batchSplit(tempDir);
    const batches2 = await batchSplit(tempDir);

    assert.deepEqual(batches1, batches2);
  });

  it('should keep related batch-*.md part files together', async () => {
    // Create batch-001 with parts that are small enough to fit in one batch
    await writeTestFile(tempDir, 'batch-001-part-1.md', 'Part 1');
    await writeTestFile(tempDir, 'batch-001-part-2.md', 'Part 2');
    await writeTestFile(tempDir, 'batch-001-part-3.md', 'Part 3');
    await writeTestFile(tempDir, 'standalone.md', 'Standalone');

    const batches = await batchSplit(tempDir, { batchSize: 10000 });

    // All batch-001 parts should be in the same batch
    const batch001Batch = batches.find(b =>
      b.files.some(f => f.includes('batch-001'))
    );

    assert.ok(batch001Batch, 'batch-001 files should be in a batch');
    assert.ok(batch001Batch.files.includes('batch-001-part-1.md'));
    assert.ok(batch001Batch.files.includes('batch-001-part-2.md'));
    assert.ok(batch001Batch.files.includes('batch-001-part-3.md'));
  });

  it('should sort files deterministically by path', async () => {
    await writeTestFile(tempDir, 'zeta.md', 'Z');
    await writeTestFile(tempDir, 'alpha.md', 'A');
    await writeTestFile(tempDir, 'beta.md', 'B');
    await writeTestFile(tempDir, 'gamma.md', 'G');

    const batches = await batchSplit(tempDir);

    assert.deepEqual(batches[0].files, ['alpha.md', 'beta.md', 'gamma.md', 'zeta.md']);
  });
});

describe('batch-merge', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should merge two valid results', async () => {
    const result1 = createValidResult({
      run_id: 'run-001',
      stage_id: 'batch-001',
      review: {
        metrics: { files_scanned: 10, findings_count: 2, batch_count: 1 },
        findings: [
          { id: 'F-001', severity: 'warn', message: 'Warning 1' },
        ],
      },
    });
    const result2 = createValidResult({
      run_id: 'run-001',
      stage_id: 'batch-002',
      review: {
        metrics: { files_scanned: 8, findings_count: 1, batch_count: 1 },
        findings: [
          { id: 'F-002', severity: 'info', message: 'Info 1' },
        ],
      },
    });

    await writeTestFile(tempDir, 'batch-001.json', JSON.stringify(result1));
    await writeTestFile(tempDir, 'batch-002.json', JSON.stringify(result2));

    const merged = await batchMerge(tempDir);

    assert.equal(merged.schema_version, '1.0');
    assert.equal(merged.run_id, 'run-001');
    assert.equal(merged.status, 'SUCCEEDED');
    assert.equal(merged.decision, 'PASS');
    assert.equal(merged.review.findings.length, 2);
    assert.equal(merged.review.metrics.files_scanned, 18);
    assert.equal(merged.review.metrics.findings_count, 3);
    assert.equal(merged.review.metrics.batch_count, 2);
  });

  it('should reject result with missing schema_version', async () => {
    const invalid = { run_id: 'x', status: 'SUCCEEDED', decision: 'PASS', summary: 'bad' };
    await writeTestFile(tempDir, 'bad.json', JSON.stringify(invalid));

    await assert.rejects(
      () => batchMerge(tempDir),
      { message: /missing schema_version/ }
    );
  });

  it('should reject result with wrong schema_version', async () => {
    const invalid = { schema_version: '2.0', run_id: 'x', status: 'SUCCEEDED', decision: 'PASS', summary: 'bad' };
    await writeTestFile(tempDir, 'bad.json', JSON.stringify(invalid));

    await assert.rejects(
      () => batchMerge(tempDir),
      { message: /unsupported schema_version/ }
    );
  });

  it('should reject result with missing run_id', async () => {
    const invalid = { schema_version: '1.0', status: 'SUCCEEDED', decision: 'PASS', summary: 'bad' };
    await writeTestFile(tempDir, 'bad.json', JSON.stringify(invalid));

    await assert.rejects(
      () => batchMerge(tempDir),
      { message: /missing run_id/ }
    );
  });

  it('should reject result with missing status', async () => {
    const invalid = { schema_version: '1.0', run_id: 'x', decision: 'PASS', summary: 'bad' };
    await writeTestFile(tempDir, 'bad.json', JSON.stringify(invalid));

    await assert.rejects(
      () => batchMerge(tempDir),
      { message: /missing status/ }
    );
  });

  it('should reject result with missing decision', async () => {
    const invalid = { schema_version: '1.0', run_id: 'x', status: 'SUCCEEDED', summary: 'bad' };
    await writeTestFile(tempDir, 'bad.json', JSON.stringify(invalid));

    await assert.rejects(
      () => batchMerge(tempDir),
      { message: /missing decision/ }
    );
  });

  it('should reject schema-invalid status, producer and metrics', async () => {
    const invalid = createValidResult({
      status: 'MAYBE',
      producer: { executor: 'magic', name: 'x' },
      review: { metrics: { findings_count: -1 } },
    });
    await writeTestFile(tempDir, 'bad.json', JSON.stringify(invalid));

    await assert.rejects(
      () => batchMerge(tempDir),
      { message: /invalid status|invalid producer|invalid metric/ }
    );
  });

  it('should deduplicate findings by id', async () => {
    const result1 = createValidResult({
      stage_id: 'batch-001',
      review: {
        findings: [
          { id: 'F-001', severity: 'warn', message: 'Dup finding' },
          { id: 'F-002', severity: 'info', message: 'Unique 1' },
        ],
      },
    });
    const result2 = createValidResult({
      stage_id: 'batch-002',
      review: {
        findings: [
          { id: 'F-001', severity: 'warn', message: 'Dup finding (duplicate)' },
          { id: 'F-003', severity: 'info', message: 'Unique 2' },
        ],
      },
    });

    await writeTestFile(tempDir, 'batch-001.json', JSON.stringify(result1));
    await writeTestFile(tempDir, 'batch-002.json', JSON.stringify(result2));

    const merged = await batchMerge(tempDir);

    assert.equal(merged.review.findings.length, 3);
    const ids = merged.review.findings.map(f => f.id);
    assert.ok(ids.includes('F-001'));
    assert.ok(ids.includes('F-002'));
    assert.ok(ids.includes('F-003'));
    // First occurrence wins
    const f001 = merged.review.findings.find(f => f.id === 'F-001');
    assert.equal(f001.message, 'Dup finding');
  });

  it('should sum metrics across results', async () => {
    const result1 = createValidResult({
      review: {
        metrics: { files_scanned: 10, findings_count: 2, block_count: 1, warn_count: 1 },
      },
    });
    const result2 = createValidResult({
      review: {
        metrics: { files_scanned: 5, findings_count: 3, block_count: 0, warn_count: 2, info_count: 1 },
      },
    });

    await writeTestFile(tempDir, 'r1.json', JSON.stringify(result1));
    await writeTestFile(tempDir, 'r2.json', JSON.stringify(result2));

    const merged = await batchMerge(tempDir);

    assert.equal(merged.review.metrics.files_scanned, 15);
    assert.equal(merged.review.metrics.findings_count, 5);
    assert.equal(merged.review.metrics.block_count, 1);
    assert.equal(merged.review.metrics.warn_count, 3);
    assert.equal(merged.review.metrics.info_count, 1);
  });

  it('should aggregate status: all SUCCEEDED → SUCCEEDED', async () => {
    const result1 = createValidResult({ status: 'SUCCEEDED' });
    const result2 = createValidResult({ status: 'SUCCEEDED' });

    await writeTestFile(tempDir, 'r1.json', JSON.stringify(result1));
    await writeTestFile(tempDir, 'r2.json', JSON.stringify(result2));

    const merged = await batchMerge(tempDir);

    assert.equal(merged.status, 'SUCCEEDED');
  });

  it('should aggregate status: any FAILED → FAILED', async () => {
    const result1 = createValidResult({ status: 'SUCCEEDED' });
    const result2 = createValidResult({ status: 'FAILED' });

    await writeTestFile(tempDir, 'r1.json', JSON.stringify(result1));
    await writeTestFile(tempDir, 'r2.json', JSON.stringify(result2));

    const merged = await batchMerge(tempDir);

    assert.equal(merged.status, 'FAILED');
  });

  it('should aggregate decision: any FAIL → FAIL', async () => {
    const result1 = createValidResult({ decision: 'PASS' });
    const result2 = createValidResult({ decision: 'FAIL' });

    await writeTestFile(tempDir, 'r1.json', JSON.stringify(result1));
    await writeTestFile(tempDir, 'r2.json', JSON.stringify(result2));

    const merged = await batchMerge(tempDir);

    assert.equal(merged.decision, 'FAIL');
  });

  it('should aggregate decision: any BLOCKED → BLOCKED (when no FAIL)', async () => {
    const result1 = createValidResult({ decision: 'PASS' });
    const result2 = createValidResult({ decision: 'BLOCKED' });

    await writeTestFile(tempDir, 'r1.json', JSON.stringify(result1));
    await writeTestFile(tempDir, 'r2.json', JSON.stringify(result2));

    const merged = await batchMerge(tempDir);

    assert.equal(merged.decision, 'BLOCKED');
  });

  it('should override run_id when provided', async () => {
    const result = createValidResult({ run_id: 'original-run' });

    await writeTestFile(tempDir, 'r1.json', JSON.stringify(result));

    const merged = await batchMerge(tempDir, { runId: 'custom-run-id' });

    assert.equal(merged.run_id, 'custom-run-id');
  });

  it('should throw on empty directory', async () => {
    await assert.rejects(
      () => batchMerge(tempDir),
      { message: /No JSON files found/ }
    );
  });

  it('should throw on non-existent directory', async () => {
    await assert.rejects(
      () => batchMerge('/non/existent/path'),
      { message: /Cannot read results directory/ }
    );
  });
});
