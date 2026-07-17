// @feature ACA16 @scenario S-50
// @feature ACA17
// @scenario S-51
// @scenario S-53
// @scenario S-54
// @scenario S-63
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { checkWorkflowProfile } from '../scripts/check-workflow-profile.mjs';

const PLUGIN_ROOT = resolve(import.meta.dirname, '..');

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

  it('fails closed when no profile exists', async () => {
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.match(result.diagnostics.join('\n'), /profile/i);
  });

  it('requires profile configuration even for a dedicated domain', async () => {
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'prd-feature' });
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.match(result.diagnostics.join('\n'), /profile/i);
  });

  it('does not hardcode domain rejection when no profile exists', async () => {
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'unknown-type' });
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.match(result.diagnostics.join('\n'), /profile/i);
    assert.doesNotMatch(result.diagnostics.join('\n'), /unsupported/i);
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

  it('resolves YAML profile and uses buildCheckerOutput', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      worker:
        skill: project-review-design
`);
    await put(root, '.claude/skills/project-review-design/SKILL.md', '---\nname: project-review-design\ndescription: test\n---\n');
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'OK');
    assert.equal(result.execution_mode, 'project-worker');
    assert.ok(result.worker_path);
    assert.equal(result.checklist_paths.length, 1);
    assert.equal(result.diagnostics.length, 0);
  });

  it('uses JSON profile worker mapping with buildCheckerOutput', async () => {
    await put(root, '.artifact-review.json', JSON.stringify({ workers: { review: { 'design-spec': 'custom-review' } } }));
    await put(root, '.agents/skills/custom-review/SKILL.md', '---\nname: custom-review\n---\n');
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'OK');
    assert.equal(result.execution_mode, 'project-worker');
    assert.equal(result.worker_path, join(root, '.agents/skills/custom-review/SKILL.md'));
    assert.match(result.diagnostics.join('\n'), /deprecated/i);
  });

  it('produces BLOCKED for security violations', async () => {
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: /etc/passwd
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.diagnostics.join('\n'), /skill name|absolute/i);
  });

  it('returns fixed output contract fields', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    // Must include all fixed contract fields
    assert.ok('status' in result);
    assert.ok('profile_path' in result);
    assert.ok('execution_mode' in result);
    assert.ok('worker_path' in result);
    assert.ok('checklist_paths' in result);
    assert.ok('validators' in result);
    assert.ok('template_paths' in result);
    assert.ok('diagnostics' in result);
    assert.ok('next' in result);
    assert.ok(['OK', 'NEEDS_INPUT', 'BLOCKED'].includes(result.status));
  });

  it('worker field extracts skill name from path for backward compat', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      worker:
        skill: project-review-design
`);
    await put(root, '.claude/skills/project-review-design/SKILL.md', '---\nname: project-review-design\n---\n');
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.worker, 'project-review-design');
  });

  // DC-B False-Green Closure: Four independent verification scenarios

  it('public-worker resolves OK with worker_path when profile has checklists', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'OK');
    assert.equal(result.execution_mode, 'public-worker');
    assert.ok(result.worker_path);
    assert.equal(result.worker_path, join(PLUGIN_ROOT, 'skills-src/artifact-workflow-worker/SKILL.md'));
  });

  it('dedicated PRD returns OK with public-worker and worker_path', async () => {
    await put(root, 'artifacts/checklists/prd-review.md', '# PRD Review');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    prd-feature:
      checklists:
        - artifacts/checklists/prd-review.md
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'prd-feature' });
    assert.equal(result.status, 'OK');
    assert.equal(result.execution_mode, 'public-worker');
    assert.ok(result.worker_path);
    assert.equal(result.worker_path, join(PLUGIN_ROOT, 'skills-src/prd-feature/review/SKILL.md'));
  });

  it('missing-domain returns NEEDS_INPUT', async () => {
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'unknown-type' });
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.match(result.diagnostics.join('\n'), /workflows\.review\.unknown-type/i);
  });

  it('audit health returns OK when config and artifacts exist', async () => {
    const result = await checkWorkflowProfile({ root, action: 'audit', domain: 'health' });
    assert.equal(result.status, 'OK');
    assert.equal(result.execution_mode, 'public-worker');
    assert.equal(result.worker_path, join(PLUGIN_ROOT, 'skills-src/artifact-audit/SKILL.md'));
  });

  it('audit health returns NEEDS_INPUT when config missing', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'audit-health-no-config-'));
    try {
      await mkdir(join(empty, 'artifacts'), { recursive: true });
      const result = await checkWorkflowProfile({ root: empty, action: 'audit', domain: 'health' });
      assert.equal(result.status, 'NEEDS_INPUT');
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('scenario-script returns OK with public-worker', async () => {
    await put(root, 'artifacts/checklists/scenario-review.md', '# Scenario Review');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    scenario-script:
      checklists:
        - artifacts/checklists/scenario-review.md
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'scenario-script' });
    assert.equal(result.status, 'OK');
    assert.equal(result.execution_mode, 'public-worker');
    assert.equal(result.worker_path, join(PLUGIN_ROOT, 'skills-src/scenario-script/review/SKILL.md'));
  });

  for (const domain of ['prd-feature', 'scenario-script']) {
    for (const [action, leaf, resourceKey] of [
      ['generate', 'author', 'templates'],
      ['review', 'review', 'checklists'],
      ['repair', 'repair', 'checklists'],
    ]) {
      it(`${domain} ${action} resolves the dedicated public skill from source root`, async () => {
        const resource = action === 'generate' ? `templates/${domain}.md` : `artifacts/checklists/${domain}-${action}.md`;
        await put(root, resource, '# Resource');
        await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  ${action}:
    ${domain}:
      ${resourceKey}:
        - ${resource}
`);
        const result = await checkWorkflowProfile({ root, action, domain });
        assert.equal(result.status, 'OK');
        assert.equal(result.execution_mode, 'public-worker');
        assert.equal(result.worker_path, join(PLUGIN_ROOT, `skills-src/${domain}/${leaf}/SKILL.md`));
      });
    }
  }

  it('audit capability resolves artifact-audit without profile', async () => {
    const result = await checkWorkflowProfile({ root, action: 'audit', domain: 'capability' });
    assert.equal(result.status, 'OK');
    assert.equal(result.execution_mode, 'public-worker');
    assert.equal(result.worker_path, join(PLUGIN_ROOT, 'skills-src/artifact-audit/SKILL.md'));
  });

  // ── Target propagation and exit 2 classification ────────────────────

  it('propagates target to validator as positional arg and ARTIFACT_WORKFLOW_TARGET env', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'target.md', 'target content\n');
    await put(root, 'scripts/validate-target.mjs', `import { writeFileSync } from 'node:fs';
const out = { arg: process.argv[2] ?? null, env: process.env.ARTIFACT_WORKFLOW_TARGET ?? null };
writeFileSync(new URL('./target-evidence.json', import.meta.url), JSON.stringify(out));
process.exit(0);
`);
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      validators:
        - scripts/validate-target.mjs
`);
    const target = join(root, 'target.md');
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec', target });
    assert.equal(result.status, 'OK');
    assert.equal(result.validators[0].exit_code, 0);
    // Verify the validator received the target
    const { readFileSync } = await import('node:fs');
    const evidence = JSON.parse(readFileSync(join(root, 'scripts/target-evidence.json'), 'utf8'));
    assert.equal(evidence.arg, target);
    assert.equal(evidence.env, target);
  });

  it('does not pass target arg when no target provided', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'scripts/validate-no-target.mjs', `import { writeFileSync } from 'node:fs';
const out = { arg: process.argv[2] ?? null, env: process.env.ARTIFACT_WORKFLOW_TARGET ?? null };
writeFileSync(new URL('./no-target-evidence.json', import.meta.url), JSON.stringify(out));
process.exit(0);
`);
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      validators:
        - scripts/validate-no-target.mjs
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'OK');
    const { readFileSync } = await import('node:fs');
    const evidence = JSON.parse(readFileSync(join(root, 'scripts/no-target-evidence.json'), 'utf8'));
    assert.equal(evidence.arg, null);
    assert.equal(evidence.env, '');
  });

  it('returns NEEDS_INPUT for validator exit 2 instead of BLOCKED', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'scripts/needs-input.cjs', 'process.exit(2)');
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      validators:
        - scripts/needs-input.cjs
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'NEEDS_INPUT');
    assert.equal(result.validators[0].exit_code, 2);
    assert.match(result.diagnostics.join('\n'), /needs input/i);
  });

  // @feature ACA17
  // @decision D-ACA-17
  // Mixed [2,6] validators: BLOCKED must override NEEDS_INPUT
  it('returns BLOCKED when mixed validators [exit 2, exit 6] — blocking issues override exit 2', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'scripts/needs-input.cjs', 'process.exit(2)');
    await put(root, 'scripts/fail.cjs', "process.stderr.write('untrusted'); process.exit(6)");
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      validators:
        - scripts/needs-input.cjs
        - scripts/fail.cjs
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.validators[0].exit_code, 2);
    assert.equal(result.validators[1].exit_code, 6);
  });

  it('returns BLOCKED for validator exit 6 (non-zero, non-2)', async () => {
    await put(root, 'artifacts/checklists/design-review.md', '# Review');
    await put(root, 'scripts/fail.cjs', "process.stderr.write('untrusted'); process.exit(6)");
    await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      validators:
        - scripts/fail.cjs
`);
    const result = await checkWorkflowProfile({ root, action: 'review', domain: 'design-spec' });
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.validators[0].exit_code, 6);
  });
});
