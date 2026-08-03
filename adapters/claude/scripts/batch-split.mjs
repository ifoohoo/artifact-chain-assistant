// @feature ACA16 @scenario S-49
// Deterministic batch splitting for artifact review workflows.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/**
 * Recursively collect all .md files under a directory.
 */
async function collectMarkdownFiles(dir, base) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      files.push(...await collectMarkdownFiles(fullPath, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = relative(base, fullPath);
      const content = await readFile(fullPath, 'utf8');
      files.push({
        path: relativePath,
        chars: content.length,
        content,
        // For grouping: detect part-*.md files that belong to a batch-*.md
        groupKey: extractGroupKey(entry.name, relativePath),
      });
    }
  }

  return files;
}

/**
 * Extract a group key for related-file co-location.
 * Files like batch-001-part-1.md, batch-001-part-2.md share the key "batch-001".
 * Standalone files get a unique key based on their path.
 */
function extractGroupKey(fileName, relativePath) {
  // Match batch-*.md pattern for grouping parts
  const batchMatch = fileName.match(/^(batch-[^/]+?)(?:-part-\d+)?\.md$/);
  if (batchMatch) {
    return `batch:${batchMatch[1]}`;
  }
  // Each standalone file is its own group
  return `file:${relativePath}`;
}

/**
 * Sort files deterministically by path.
 */
function sortFiles(files) {
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Build batches from sorted files.
 *
 * Strategy:
 * 1. Group files by groupKey to keep related files together.
 * 2. For each group, if adding the group to the current batch exceeds batch-size,
 *    and the current batch is non-empty, flush it and start a new one.
 * 3. If a single group exceeds batch-size, it gets its own batch.
 * 4. Sort groups by their first file's path for determinism.
 */
function buildBatches(files, batchSize) {
  // Group files by groupKey
  const groups = new Map();
  for (const file of files) {
    if (!groups.has(file.groupKey)) {
      groups.set(file.groupKey, []);
    }
    groups.get(file.groupKey).push(file);
  }

  // Sort groups by their first file's path for determinism
  const sortedGroups = [...groups.entries()].sort(([, a], [, b]) =>
    a[0].path.localeCompare(b[0].path)
  );

  const batches = [];
  let currentBatchFiles = [];
  let currentBatchChars = 0;

  for (const [, groupFiles] of sortedGroups) {
    const groupChars = groupFiles.reduce((sum, f) => sum + f.chars, 0);

    // If the group alone exceeds batch-size, it gets its own batch
    if (groupChars >= batchSize) {
      // Flush current batch if non-empty
      if (currentBatchFiles.length > 0) {
        batches.push(currentBatchFiles);
        currentBatchFiles = [];
        currentBatchChars = 0;
      }
      // This group is its own batch
      batches.push(groupFiles);
      continue;
    }

    // If adding this group would exceed batch-size, flush current batch
    if (currentBatchChars + groupChars > batchSize && currentBatchFiles.length > 0) {
      batches.push(currentBatchFiles);
      currentBatchFiles = [];
      currentBatchChars = 0;
    }

    // Add group to current batch
    currentBatchFiles.push(...groupFiles);
    currentBatchChars += groupChars;
  }

  // Flush remaining files
  if (currentBatchFiles.length > 0) {
    batches.push(currentBatchFiles);
  }

  return batches;
}

/**
 * Deterministic batch splitting.
 *
 * @param {string} targetDir - Directory to scan for .md files
 * @param {object} options
 * @param {number} [options.batchSize=40000] - Maximum characters per batch
 * @returns {Promise<Array<{id: string, files: string[], chars: number}>>}
 */
export async function batchSplit(targetDir, options = {}) {
  const { batchSize = 40000 } = options;
  const base = resolve(targetDir);

  // Verify target directory exists
  const targetStat = await stat(base).catch(() => null);
  if (!targetStat || !targetStat.isDirectory()) {
    return [];
  }

  // Collect and sort files
  const rawFiles = await collectMarkdownFiles(base, base);
  const files = sortFiles(rawFiles);

  // Build batches
  const batchArrays = buildBatches(files, batchSize);

  // Format output
  return batchArrays.map((batchFiles, index) => ({
    id: `batch-${String(index + 1).padStart(3, '0')}`,
    files: batchFiles.map(f => f.path),
    chars: batchFiles.reduce((sum, f) => sum + f.chars, 0),
  }));
}

// CLI entry point
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const targetDir = args[0];

  if (!targetDir) {
    console.error('Usage: node batch-split.mjs <target-dir> [--batch-size N]');
    process.exit(1);
  }

  let batchSize = 40000;
  const sizeIdx = args.indexOf('--batch-size');
  if (sizeIdx !== -1 && args[sizeIdx + 1]) {
    batchSize = parseInt(args[sizeIdx + 1], 10);
    if (isNaN(batchSize) || batchSize <= 0) {
      console.error('Error: --batch-size must be a positive integer');
      process.exit(1);
    }
  }

  try {
    const batches = await batchSplit(targetDir, { batchSize });
    console.log(JSON.stringify(batches, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
