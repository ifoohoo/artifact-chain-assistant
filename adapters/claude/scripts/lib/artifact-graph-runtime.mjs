#!/usr/bin/env node
// @scenario S-44 @feature ACA13 @feature ACA3
// @decision D-ACA-15
import { access, readFile, realpath } from 'node:fs/promises';
import { delimiter, join, dirname, resolve } from 'node:path';
import { loadCompatibilityPolicy } from './compatibility-policy.mjs';

/**
 * Locate the artifact-graph CLI in a target project, resolve its package version,
 * and compare against the plugin's compatibility policy.
 *
 * Resolution order:
 *   1. <projectRoot>/node_modules/.bin/artifact-graph
 *   2. PATH lookup for artifact-graph
 *   3. ARTIFACT_GRAPH_LEGACY_CLI env var (explicit fallback)
 *
 * For the resolved CLI, look up its owning package.json (name === "artifact-graph")
 * and compare the version field against policy.artifactGraph.verifiedVersion.
 *
 * @param {{ projectRoot: string, env?: Record<string,string> }} opts
 * @returns {Promise<{ok: boolean, cliPath?: string, packagePath?: string, actualVersion?: string, expectedVersion?: string, reason?: string, remediation?: string}>}
 */
export async function inspectArtifactGraphRuntime({ projectRoot, env }) {
  const pluginRoot = resolve(import.meta.dirname, '..', '..');
  let policy;
  try {
    policy = await loadCompatibilityPolicy(pluginRoot);
  } catch (error) {
    return {
      ok: false,
      reason: 'policy_load_failed',
      remediation: `Failed to load compatibility policy: ${error.message}`,
      expectedVersion: null,
    };
  }

  const expectedVersion = policy.artifactGraph.verifiedVersion;
  const installSpec = policy.artifactGraph.installSpec;

  // 1. Try project-local CLI first
  const localBin = join(projectRoot, 'node_modules', '.bin', 'artifact-graph');
  let cliPath = await resolveIfExecutable(localBin);

  // 2. Try PATH
  if (!cliPath) {
    cliPath = await findOnPath(env ?? process.env);
  }

  // 3. Try explicit legacy CLI override
  if (!cliPath) {
    const legacy = (env ?? process.env).ARTIFACT_GRAPH_LEGACY_CLI;
    if (legacy) {
      cliPath = await resolveIfExecutable(legacy);
    }
  }

  if (!cliPath) {
    return {
      ok: false,
      reason: 'cli_not_found',
      expectedVersion,
      remediation: `artifact-graph CLI not found. Run: pnpm add -D ${installSpec}`,
    };
  }

  // 4. Resolve the owning package.json
  const { packagePath, version } = await resolvePackageVersion(cliPath);

  if (!version) {
    return {
      ok: false,
      cliPath,
      packagePath,
      reason: 'version_unresolved',
      expectedVersion,
      remediation: `Could not determine artifact-graph version from ${packagePath || cliPath}. Run: pnpm add -D ${installSpec}`,
    };
  }

  if (version !== expectedVersion) {
    return {
      ok: false,
      cliPath,
      packagePath,
      actualVersion: version,
      expectedVersion,
      reason: 'version_mismatch',
      remediation: `artifact-graph version is ${version}, expected ${expectedVersion}. Run: pnpm add -D ${installSpec}`,
    };
  }

  return {
    ok: true,
    cliPath,
    packagePath,
    actualVersion: version,
    expectedVersion,
  };
}

/**
 * Resolve a path to its realpath if it exists and is executable (X_OK).
 */
async function resolveIfExecutable(path) {
  try {
    const real = await realpath(path);
    await access(real, 1); // X_OK = 1
    return real;
  } catch {
    return null;
  }
}

/**
 * Search PATH for artifact-graph binary.
 * Does NOT check ARTIFACT_GRAPH_LEGACY_CLI — that's the caller's fallback.
 */
export async function findOnPath(env) {
  const pathEnv = env.PATH || '';
  const pathDirs = pathEnv.split(delimiter);

  for (const dir of pathDirs) {
    if (!dir) continue;
    const candidate = join(dir, 'artifact-graph');
    const resolved = await resolveIfExecutable(candidate);
    if (resolved) return resolved;
  }

  return null;
}

/**
 * Given a CLI path, find the owning artifact-graph package.json and its version.
 *
 * Strategy:
 * 1. Walk up from the CLI directory looking for package.json with name === "artifact-graph".
 * 2. If CLI is under .bin/, also try walking up from the sibling artifact-graph/ package directory.
 *
 * Returns { packagePath, version } or { packagePath: null, version: null }.
 */
export async function resolvePackageVersion(cliPath) {
  // Strategy 1: walk up from CLI location
  const result = await walkUpForPackage(dirname(cliPath));
  if (result.packagePath) return result;

  // Strategy 2: if CLI is under a .bin/ directory, check sibling package directories
  const dir = dirname(cliPath);
  const parentDir = dirname(dir);
  if (dir.endsWith('.bin') || dir.endsWith('.bin/')) {
    // Check parentDir/artifact-graph/package.json directly
    const siblingPkg = join(parentDir, 'artifact-graph', 'package.json');
    try {
      const raw = await readFile(siblingPkg, 'utf8');
      const pkg = JSON.parse(raw);
      if (pkg.name === 'artifact-graph') {
        return { packagePath: siblingPkg, version: pkg.version || null };
      }
    } catch {
      // No sibling package found
    }
  }

  return { packagePath: null, version: null };
}

async function walkUpForPackage(startDir) {
  let dir = startDir;
  const seen = new Set();

  while (dir && !seen.has(dir)) {
    seen.add(dir);
    const pkgPath = join(dir, 'package.json');
    try {
      const raw = await readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      if (pkg.name === 'artifact-graph') {
        return { packagePath: pkgPath, version: pkg.version || null };
      }
    } catch {
      // No package.json at this level, or not valid JSON
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return { packagePath: null, version: null };
}
