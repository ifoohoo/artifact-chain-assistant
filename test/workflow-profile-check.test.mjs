// @feature ACA16 @scenario S-50
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkWorkflowProfile } from '../scripts/check-workflow-profile.mjs';

async function put(root, path, content = '') {
  const full = join(root, path);
  await mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
  await writeFile(full, content, 'utf8');
}

describe('workflow profile check', () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'artifact-profile-'));
    await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
    await mkdir(join(root, 'artifacts/design'), { recursive: true });
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('fails closed when no review worker mapping exists', async () => {
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.match(result.diagnostics.join('\n'), /worker/i);
  });

  it('discovers a conventional project worker without writing files', async () => {
    await put(root, '.claude/skills/artifact-review-design/SKILL.md', '---\nname: artifact-review-design\ndescription: test\n---\n');
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'OK');
    assert.equal(result.worker, 'artifact-review-design');
  });

  it('uses an explicit JSON profile worker mapping', async () => {
    await put(root, '.artifact-review.json', JSON.stringify({ workers: { review: { 'design-spec': 'custom-review' } } }));
    await put(root, '.agents/skills/custom-review/SKILL.md', '---\nname: custom-review\ndescription: test\n---\n');
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'OK');
    assert.equal(result.worker, 'custom-review');
    assert.match(result.profile, /.artifact-review.json$/);
  });

  it('uses the generic repair worker for supported domains', async () => {
    await put(root, '.claude/skills/artifact-review-repair/SKILL.md', '---\nname: artifact-review-repair\ndescription: test\n---\n');
    const result = await checkWorkflowProfile({ root, action: 'repair', domain: 'contract' });
    assert.equal(result.status, 'OK');
    assert.equal(result.worker, 'artifact-review-repair');
  });

  it('rejects types owned by dedicated skill families', async () => {
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'prd-feature' });
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.match(result.diagnostics.join('\n'), /dedicated/i);
  });

  it('reports missing artifact-graph project markers', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'artifact-profile-empty-'));
    try {
      const result = await checkWorkflowProfile({ root: empty, action: 'audit', domain: 'health' });
      assert.equal(result.status, 'NEEDS_INPUT');
      assert.match(result.diagnostics.join('\n'), /artifact-graph.config.yaml|artifacts/);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
