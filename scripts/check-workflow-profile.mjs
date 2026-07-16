#!/usr/bin/env node
// @feature ACA16 @scenario S-50
// Read-only profile and worker readiness check for generic artifact workflows.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SUPPORTED_DOMAINS = new Set(['design-spec', 'link', 'e2e', 'domain', 'contract', 'blueprint', 'verification']);
const DEDICATED_DOMAINS = new Set(['prd-feature', 'scenario-script']);
const REVIEW_WORKERS = {
  'design-spec': 'artifact-review-design',
  link: 'artifact-review-link',
  e2e: 'artifact-review-e2e',
  domain: 'artifact-review-domain',
  contract: 'artifact-review-contract',
  blueprint: 'artifact-review-blueprint',
  verification: 'artifact-review-verification',
};

function findSkill(root, name) {
  for (const base of ['.claude/skills', '.agents/skills']) {
    if (existsSync(join(root, base, name, 'SKILL.md'))) return join(base, name, 'SKILL.md');
  }
  return null;
}

function readProfile(root, explicitPath) {
  const profilePath = explicitPath ? resolve(explicitPath) : join(root, '.artifact-review.json');
  if (!existsSync(profilePath)) return { path: null, data: null, error: null };
  try {
    return { path: profilePath, data: JSON.parse(readFileSync(profilePath, 'utf8')), error: null };
  } catch (error) {
    return { path: profilePath, data: null, error: `Invalid profile JSON: ${error.message}` };
  }
}

export async function checkWorkflowProfile({ root = process.cwd(), action = 'review', domain, profilePath } = {}) {
  const projectRoot = resolve(root);
  const diagnostics = [];
  const hasConfig = existsSync(join(projectRoot, 'artifact-graph.config.yaml'));
  const hasArtifacts = existsSync(join(projectRoot, 'artifacts'));
  if (!hasConfig && !hasArtifacts) diagnostics.push('Missing artifact-graph.config.yaml and artifacts/');

  if (DEDICATED_DOMAINS.has(domain)) diagnostics.push(`${domain} is owned by a dedicated skill family`);
  if (!SUPPORTED_DOMAINS.has(domain) && action !== 'audit') diagnostics.push(`Unsupported generic workflow domain: ${domain ?? '(missing)'}`);

  const profile = readProfile(projectRoot, profilePath);
  if (profile.error) diagnostics.push(profile.error);

  let worker = null;
  let workerPath = null;
  if (diagnostics.length === 0 && action !== 'audit' && action !== 'batch') {
    worker = profile.data?.workers?.[action]?.[domain]
      ?? (action === 'review' ? REVIEW_WORKERS[domain] : action === 'repair' ? 'artifact-review-repair' : null);
    if (!worker) diagnostics.push(`No ${action} worker mapping for ${domain}`);
    else {
      workerPath = findSkill(projectRoot, worker);
      if (!workerPath) diagnostics.push(`Mapped worker not found: ${worker}`);
    }
  }

  return {
    status: diagnostics.length === 0 ? 'OK' : 'NEEDS_INPUT',
    root: projectRoot,
    action,
    domain,
    profile: profile.path,
    worker,
    worker_path: workerPath,
    dry_run: true,
    diagnostics,
    next: diagnostics.length === 0 ? 'Invoke the resolved workflow.' : 'Add the missing config/profile/worker and run this check again.',
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const value = flag => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  if (args.includes('--help')) {
    console.log('Usage: node check-workflow-profile.mjs --root <path> --action <review|repair|audit|batch> --domain <type> [--profile <json>] [--format json|text]');
    process.exit(0);
  }
  const result = await checkWorkflowProfile({
    root: value('--root') ?? process.cwd(),
    action: value('--action') ?? 'review',
    domain: value('--domain'),
    profilePath: value('--profile'),
  });
  if ((value('--format') ?? 'json') === 'text') {
    console.log(`${result.status}: ${result.action}/${result.domain ?? '(missing)'}`);
    for (const item of result.diagnostics) console.log(`- ${item}`);
    console.log(`Next: ${result.next}`);
  } else console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'OK' ? 0 : 2);
}
