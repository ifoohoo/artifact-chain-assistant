// @feature ACA17
// @scenario S-51
// @scenario S-53
// @scenario S-54
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { checkWorkflowProfile } from '../scripts/check-workflow-profile.mjs';

async function put(root, path, content) {
  const target = join(root, path);
  await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true });
  await writeFile(target, content, 'utf8');
}

test('prints the four DC-B closure JSON results', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dc-b-four-'));
  try {
    await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
    await mkdir(join(root, 'artifacts/checklists'), { recursive: true });
    await put(root, 'artifacts/checklists/design.md', '# Design\n');
    await put(root, 'artifacts/checklists/prd.md', '# PRD\n');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: dc-b
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design.md
    prd-feature:
      checklists:
        - artifacts/checklists/prd.md
`);

    const results = {
      public_worker: await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' }),
      dedicated_prd: await checkWorkflowProfile({ root, action: 'review', domain: 'prd-feature' }),
      missing_domain: await checkWorkflowProfile({ root, action: 'review', domain: 'contract' }),
      audit_health: await checkWorkflowProfile({ root, action: 'audit', domain: 'health' }),
    };
    assert.deepEqual(Object.values(results).map(result => result.status), ['OK', 'OK', 'NEEDS_INPUT', 'OK']);
    assert.ok(results.public_worker.worker_path);
    assert.ok(results.dedicated_prd.worker_path);
    assert.ok(results.audit_health.worker_path);
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
