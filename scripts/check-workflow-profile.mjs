#!/usr/bin/env node
// @feature ACA17
// @scenario S-51
// @scenario S-53
// @scenario S-54
// @decision D-ACA-17
// Thin CLI wrapper. scripts/lib/workflow-profile.mjs is the single resolver.
import { resolve } from 'node:path';
import { buildCheckerOutput } from './lib/workflow-profile.mjs';

export async function checkWorkflowProfile({ root = process.cwd(), action = 'review', domain, profilePath, target } = {}) {
  const projectRoot = resolve(root);
  const checker = await buildCheckerOutput({ root: projectRoot, profilePath, intent: action, domain, target });
  return {
    ...checker,
    root: projectRoot,
    action,
    domain,
    profile: checker.profile_path,
    worker: checker.worker_path ? checker.worker_path.split('/').slice(-2, -1)[0] : null,
    dry_run: true,
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
    console.log('Usage: node check-workflow-profile.mjs --root <path> --action <generate|review|repair|audit|batch> --domain <type> [--profile <json|yaml>] [--target <path>] [--format json|text]');
    process.exit(0);
  }
  let result;
  try {
    result = await checkWorkflowProfile({
      root: value('--root') ?? process.cwd(),
      action: value('--action') ?? 'review',
      domain: value('--domain'),
      profilePath: value('--profile'),
      target: value('--target'),
    });
  } catch (error) {
    result = {
      status: 'BLOCKED', schema: null, profile_path: null, execution_mode: null,
      worker_path: null, checklist_paths: [], validators: [], template_paths: [],
      diagnostics: [`Checker failed closed: ${error.message}`],
      next: 'Fix the malformed or unsafe profile and run this check again.',
      root: resolve(value('--root') ?? process.cwd()),
      action: value('--action') ?? 'review', domain: value('--domain'), profile: null,
      worker: null, dry_run: true,
    };
  }
  if ((value('--format') ?? 'json') === 'text') {
    console.log(`${result.status}: ${result.action}/${result.domain ?? '(missing)'}`);
    for (const item of result.diagnostics) console.log(`- ${item}`);
    console.log(`Next: ${result.next}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(result.status === 'OK' ? 0 : 2);
}
