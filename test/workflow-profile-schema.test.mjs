// @feature ACA16 @scenario S-50
// @feature ACA17
// @scenario S-51
// @scenario S-54
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadProfile,
  validateAgainstSchema,
  validateResourcePaths,
  resolveExecutionMode,
  buildCheckerOutput,
} from '../scripts/lib/workflow-profile.mjs';

async function put(root, filePath, content = '') {
  const full = join(root, filePath);
  await mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
  await writeFile(full, content, 'utf8');
}

function validYaml() {
  return `schema_version: 1
project:
  id: test-proj
  language: typescript
  name: Test Project
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      validators:
        - scripts/validate-design.mjs
      templates:
        - templates/design-spec.md
      worker:
        skill: artifact-review-design
`;
}

describe('workflow-profile loader', () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wf-profile-'));
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  describe('loadProfile', () => {
    it('fails closed on a dangling canonical profile instead of falling back to legacy JSON', async () => {
      await mkdir(join(root, 'artifact-profiles'), { recursive: true });
      await symlink(join(root, 'missing-profile.yaml'), join(root, 'artifact-profiles/project.yaml'));
      await put(root, '.artifact-review.json', JSON.stringify({ workers: { review: {} } }));
      const result = await loadProfile({ root });
      assert.ok(result.error);
      assert.match(result.error, /dangling|symlink|cannot read/i);
      assert.notEqual(result.format, 'json');
    });

    it('loads a valid YAML profile', async () => {
      await put(root, 'artifact-profiles/project.yaml', validYaml());
      const result = await loadProfile({ root });
      assert.equal(result.path, join(root, 'artifact-profiles/project.yaml'));
      assert.equal(result.format, 'yaml');
      assert.equal(result.deprecated, false);
      assert.equal(result.error, null);
      assert.equal(result.data.schema_version, 1);
      assert.equal(result.data.project.id, 'test-proj');
    });

    it('returns null path when no profile exists', async () => {
      const result = await loadProfile({ root });
      assert.equal(result.path, null);
      assert.equal(result.data, null);
      assert.equal(result.error, null);
    });

    it('falls back to legacy .artifact-review.json', async () => {
      await put(root, '.artifact-review.json', JSON.stringify({ workers: { review: {} } }));
      const result = await loadProfile({ root });
      assert.equal(result.format, 'json');
      assert.equal(result.deprecated, true);
      assert.match(result.diagnostics.join('\n'), /deprecated/);
    });

    it('rejects dangerous keys recursively in legacy JSON profiles', async () => {
      await put(root, '.artifact-review.json', `{
        "workflows": {
          "review": {
            "design-spec": {
              "checklists": [],
              "constructor": { "polluted": true }
            }
          }
        }
      }`);
      const result = await loadProfile({ root });
      assert.ok(result.error);
      assert.match(result.error, /constructor|dangerous|prototype/i);
    });

    it('prefers YAML over legacy JSON', async () => {
      await put(root, 'artifact-profiles/project.yaml', validYaml());
      await put(root, '.artifact-review.json', JSON.stringify({ workers: { review: {} } }));
      const result = await loadProfile({ root });
      assert.equal(result.format, 'yaml');
      assert.equal(result.deprecated, false);
    });

    it('uses explicit profilePath', async () => {
      const explicit = join(root, 'custom/profile.yaml');
      await put(root, 'custom/profile.yaml', validYaml());
      const result = await loadProfile({ root, profilePath: explicit });
      assert.equal(result.path, explicit);
      assert.equal(result.format, 'yaml');
    });

    it('resolves a relative explicit profilePath from project root, not checker cwd', async () => {
      await put(root, 'custom/profile.yaml', validYaml());
      const result = await loadProfile({ root, profilePath: 'custom/profile.yaml' });
      assert.equal(result.error, null);
      assert.equal(result.path, join(root, 'custom/profile.yaml'));
    });

    it('rejects an auto-discovered YAML profile symlink that escapes project root', async () => {
      const outside = await mkdtemp(join(tmpdir(), 'wf-auto-profile-outside-'));
      try {
        await put(outside, 'project.yaml', validYaml());
        await mkdir(join(root, 'artifact-profiles'), { recursive: true });
        await symlink(join(outside, 'project.yaml'), join(root, 'artifact-profiles/project.yaml'));
        const result = await loadProfile({ root });
        assert.ok(result.error);
        assert.match(result.error, /escape|outside|symlink/i);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it('rejects missing explicit profilePath', async () => {
      const result = await loadProfile({ root, profilePath: '/nonexistent/profile.yaml' });
      assert.match(result.error, /not found|outside|escapes/i);
    });
  });

  describe('schema validation', () => {
    it('rejects an unsupported workflow intent in the canonical schema', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  deploy:
    design-spec: {}
`);
      const result = await loadProfile({ root });
      assert.match(result.error, /deploy|additional|intent/i);
    });

    it('does not let inherited properties satisfy required or properties validation', () => {
      const inherited = Object.create({ required_value: 'from-prototype' });
      const result = validateAgainstSchema(inherited, {
        type: 'object',
        required: ['required_value'],
        properties: { required_value: { type: 'string' } },
      });
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /required property missing/);
    });
    it('rejects missing schema_version', async () => {
      const yaml = `project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec: {}
`;
      await put(root, 'artifact-profiles/project.yaml', yaml);
      const result = await loadProfile({ root });
      assert.match(result.error, /schema_version|required/i);
    });

    it('rejects schema_version != 1', async () => {
      const yaml = `schema_version: 2
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec: {}
`;
      await put(root, 'artifact-profiles/project.yaml', yaml);
      const result = await loadProfile({ root });
      assert.match(result.error, /const|schema_version/i);
    });

    it('rejects missing project.id', async () => {
      const yaml = `schema_version: 1
project:
  language: typescript
workflows:
  review:
    design-spec: {}
`;
      await put(root, 'artifact-profiles/project.yaml', yaml);
      const result = await loadProfile({ root });
      assert.match(result.error, /project\/id|required/i);
    });

    it('rejects invalid project.id pattern', async () => {
      const yaml = `schema_version: 1
project:
  id: Bad_ID!
  language: typescript
workflows:
  review:
    design-spec: {}
`;
      await put(root, 'artifact-profiles/project.yaml', yaml);
      const result = await loadProfile({ root });
      assert.match(result.error, /pattern/i);
    });

    it('rejects additional top-level properties', async () => {
      const yaml = `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows: {}
extra: not-allowed
`;
      await put(root, 'artifact-profiles/project.yaml', yaml);
      const result = await loadProfile({ root });
      assert.match(result.error, /additional/i);
    });

    it('rejects worker with additional properties', async () => {
      const yaml = `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: my-skill
        bad: prop
`;
      await put(root, 'artifact-profiles/project.yaml', yaml);
      const result = await loadProfile({ root });
      assert.match(result.error, /additional/i);
    });

    it('accepts a minimal valid profile', async () => {
      const yaml = `schema_version: 1
project:
  id: minimal
  language: go
workflows: {}
`;
      await put(root, 'artifact-profiles/project.yaml', yaml);
      const result = await loadProfile({ root });
      assert.equal(result.error, null);
      assert.equal(result.data.project.id, 'minimal');
    });
  });

  describe('validateResourcePaths', () => {
    it('classifies a dangling resource symlink as dangerous rather than missing', async () => {
      await mkdir(join(root, 'artifacts/checklists'), { recursive: true });
      await symlink(join(root, 'missing-checklist.md'), join(root, 'artifacts/checklists/dangling.md'));
      const result = validateResourcePaths(['artifacts/checklists/dangling.md'], root);
      assert.equal(result.safe, false);
      assert.equal(result.details[0].kind, 'dangerous');
      assert.match(result.errors[0], /dangling|symlink|cannot read/i);
    });

    it('accepts safe relative paths', async () => {
      await put(root, 'artifacts/checklists/review.md', '# Review');
      const result = validateResourcePaths(['artifacts/checklists/review.md'], root);
      assert.equal(result.safe, true);
      assert.equal(result.errors.length, 0);
      assert.equal(result.resolved.length, 1);
    });

    it('rejects absolute paths', () => {
      const result = validateResourcePaths(['/etc/passwd'], root);
      assert.equal(result.safe, false);
      assert.match(result.errors[0], /absolute/i);
    });

    it('rejects paths with a traversal segment', () => {
      const result = validateResourcePaths(['../outside'], root);
      assert.equal(result.safe, false);
      assert.match(result.errors[0], /traversal/i);
    });

    it('accepts a legal filename containing two dots', async () => {
      await put(root, 'artifacts/checklists/review..v2.md', '# Review');
      const result = validateResourcePaths(['artifacts/checklists/review..v2.md'], root);
      assert.equal(result.safe, true);
      assert.deepEqual(result.resolved, [join(root, 'artifacts/checklists/review..v2.md')]);
    });

    it('rejects missing files', () => {
      const result = validateResourcePaths(['nonexistent.md'], root);
      assert.equal(result.safe, false);
      assert.match(result.errors[0], /not found/i);
    });

    it('rejects directories', async () => {
      await mkdir(join(root, 'some-dir'), { recursive: true });
      const result = validateResourcePaths(['some-dir'], root);
      assert.equal(result.safe, false);
      assert.match(result.errors[0], /not a file/i);
    });

    it('rejects duplicate resources', async () => {
      await put(root, 'a/file.md', 'content');
      const result = validateResourcePaths(['a/file.md', 'a/file.md'], root);
      assert.equal(result.safe, false);
      assert.match(result.errors[0], /duplicate/i);
    });

    it('rejects symlinks escaping root', async () => {
      const outside = await mkdtemp(join(tmpdir(), 'wf-outside-'));
      try {
        await put(outside, 'secret.md', 'secret');
        await mkdir(join(root, 'link-dir'), { recursive: true });
        await symlink(join(outside, 'secret.md'), join(root, 'link-dir', 'escape.md'));
        const result = validateResourcePaths(['link-dir/escape.md'], root);
        assert.equal(result.safe, false);
        assert.match(result.errors[0], /escapes/i);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });
  });

  describe('resolveExecutionMode', () => {
    it('returns project-worker when worker.skill is set', () => {
      const profile = {
        schema_version: 1,
        project: { id: 'x', language: 'ts' },
        workflows: {
          review: {
            'design-spec': { worker: { skill: 'my-skill' } },
          },
        },
      };
      assert.equal(resolveExecutionMode(profile, 'review', 'design-spec'), 'project-worker');
    });

    it('returns public-worker when no worker.skill', () => {
      const profile = {
        schema_version: 1,
        project: { id: 'x', language: 'ts' },
        workflows: {
          review: {
            'design-spec': { checklists: ['a.md'] },
          },
        },
      };
      assert.equal(resolveExecutionMode(profile, 'review', 'design-spec'), 'public-worker');
    });

    it('returns public-worker for missing intent', () => {
      const profile = {
        schema_version: 1,
        project: { id: 'x', language: 'ts' },
        workflows: {},
      };
      assert.equal(resolveExecutionMode(profile, 'review', 'design-spec'), 'public-worker');
    });

    it('returns public-worker for missing domain', () => {
      const profile = {
        schema_version: 1,
        project: { id: 'x', language: 'ts' },
        workflows: { review: {} },
      };
      assert.equal(resolveExecutionMode(profile, 'review', 'design-spec'), 'public-worker');
    });

    it('returns public-worker for null profile', () => {
      assert.equal(resolveExecutionMode(null, 'review', 'design-spec'), 'public-worker');
    });
  });

  describe('buildCheckerOutput', () => {
    it('rejects unsupported action before reading a damaged profile', async () => {
      await mkdir(join(root, 'artifact-profiles'), { recursive: true });
      await symlink(join(root, 'missing-profile.yaml'), join(root, 'artifact-profiles/project.yaml'));
      const result = await buildCheckerOutput({ root, intent: 'deploy', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /unsupported.*action|invalid.*action/i);
      assert.doesNotMatch(result.diagnostics.join('\n'), /profile.*symlink|dangling profile/i);
    });

    it('rejects a missing domain before reading a damaged profile', async () => {
      await mkdir(join(root, 'artifact-profiles'), { recursive: true });
      await symlink(join(root, 'missing-profile.yaml'), join(root, 'artifact-profiles/project.yaml'));
      const result = await buildCheckerOutput({ root, intent: 'review', domain: undefined });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /domain/i);
      assert.doesNotMatch(result.diagnostics.join('\n'), /profile.*symlink|dangling profile/i);
    });

    it('classifies prototype-pollution profile syntax as BLOCKED', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
  __proto__: polluted
workflows: {}
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /prototype|dangerous|__proto__/i);
    });

    it('produces OK output for valid setup', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
      const checklistDir = 'artifacts/checklists';
      await put(root, `${checklistDir}/design-review.md`, '# Review');
      await put(root, 'templates/design-spec.md', '# Template');
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      templates:
        - templates/design-spec.md
      worker:
        skill: project-review-design
`);
      await put(root, '.claude/skills/project-review-design/SKILL.md', '---\nname: project-review-design\n---\n');
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'OK');
      assert.equal(result.schema, 'artifact-workflow-profile');
      assert.equal(result.execution_mode, 'project-worker');
      assert.ok(result.worker_path);
      assert.equal(result.checklist_paths.length, 1);
      assert.equal(result.template_paths.length, 1);
      assert.equal(result.diagnostics.length, 0);
    });

    it('produces NEEDS_INPUT when no profile', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'NEEDS_INPUT');
      assert.equal(result.execution_mode, null);
      assert.ok(result.diagnostics.length > 0);
    });

    it('includes schema field for legacy profile', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
      await put(root, '.artifact-review.json', JSON.stringify({ workers: { review: {} } }));
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.schema, 'legacy-artifact-review');
    });

    it('translates a complete legacy worker mapping into project-worker mode with warning', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
      await put(root, 'artifacts/checklists/design-review.md', '# Review');
      await put(root, '.artifact-review.json', JSON.stringify({
        workflows: { review: { 'design-spec': { checklists: ['artifacts/checklists/design-review.md'] } } },
        workers: { review: { 'design-spec': 'custom-review' } },
      }));
      await put(root, '.claude/skills/custom-review/SKILL.md', '---\nname: custom-review\n---\n');
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'OK');
      assert.equal(result.execution_mode, 'project-worker');
      assert.equal(result.worker_path, join(root, '.claude/skills/custom-review/SKILL.md'));
      assert.match(result.diagnostics.join('\n'), /deprecated/i);
    });

    for (const malformed of [
      { workflows: [] },
      { workflows: { review: [] } },
      { workers: [] },
      { workers: { review: [] } },
      { workers: { review: { 'design-spec': ['not-a-string'] } } },
    ]) {
      it(`returns fixed checker JSON for malformed legacy shape: ${JSON.stringify(malformed)}`, async () => {
        await put(root, '.artifact-review.json', JSON.stringify(malformed));
        const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
        assert.equal(result.status, 'BLOCKED');
        assert.equal(result.execution_mode, null);
        assert.ok(Array.isArray(result.diagnostics));
        assert.match(result.diagnostics.join('\n'), /legacy|workflows|workers|shape/i);
      });
    }
  });

  // @feature ACA16 @scenario S-50
  // §1 security: skill name validation, profile path safety, worker path containment.
  describe('skill name validation', () => {
    it('rejects worker.skill with absolute path', async () => {
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
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /skill name/i);
    });

    it('rejects worker.skill with path traversal', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: ../../../escape
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /skill name/i);
    });

    it('rejects worker.skill with directory separator', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: some/path/skill
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /skill name/i);
    });

    it('rejects worker.skill with non-kebab-case', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: Bad_Name
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /skill name|kebab/i);
    });

    it('rejects worker.skill with public artifact-* name collision', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: artifact-review
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /reserved|collision/i);
    });

    it('accepts worker.skill with project- prefix', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
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
        skill: project-custom-review
`);
      await put(root, '.claude/skills/project-custom-review/SKILL.md', '---\nname: project-custom-review\n---\n');
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'OK');
    });

    it('accepts worker.skill with project.id prefix', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
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
        skill: test-proj-custom-review
`);
      await put(root, '.claude/skills/test-proj-custom-review/SKILL.md', '---\nname: test-proj-custom-review\n---\n');
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'OK');
    });
  });

  describe('profile path safety', () => {
    it('rejects explicit profile with absolute path outside root', async () => {
      const result = await loadProfile({ root, profilePath: '/etc/passwd' });
      assert.ok(result.error);
    });

    it('rejects explicit profile with path traversal', async () => {
      const result = await loadProfile({ root, profilePath: '../../../etc/passwd' });
      assert.ok(result.error);
    });

    it('rejects explicit profile that is a symlink escaping root', async () => {
      const outside = await mkdtemp(join(tmpdir(), 'wf-outside-'));
      try {
        await put(outside, 'evil.yaml', `schema_version: 1\nproject:\n  id: x\n  language: y\nworkflows: {}\n`);
        await mkdir(join(root, 'links'), { recursive: true });
        await symlink(join(outside, 'evil.yaml'), join(root, 'links/profile.yaml'));
        const result = await loadProfile({ root, profilePath: join(root, 'links/profile.yaml') });
        assert.ok(result.error);
        assert.match(result.error, /escapes|symlink|outside/i);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });
  });

  describe('worker path containment', () => {
    it('fails closed on an external empty skills root before looking for a worker in the other host', async () => {
      const outside = await mkdtemp(join(tmpdir(), 'wf-empty-skills-outside-'));
      try {
        await mkdir(join(outside, 'skills'), { recursive: true });
        await mkdir(join(root, '.agents'), { recursive: true });
        await symlink(join(outside, 'skills'), join(root, '.agents/skills'));
        await put(root, '.claude/skills/project-review/SKILL.md', '---\nname: project-review\n---\n');
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
        skill: project-review
`);
        const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
        assert.equal(result.status, 'BLOCKED');
        assert.equal(result.worker_path, null);
        assert.match(result.diagnostics.join('\n'), /skills root|outside|escape|symlink/i);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it('fails closed on a dangling skills root before looking for a worker in the other host', async () => {
      await mkdir(join(root, '.agents'), { recursive: true });
      await symlink(join(root, 'missing-skills'), join(root, '.agents/skills'));
      await put(root, '.claude/skills/project-review/SKILL.md', '---\nname: project-review\n---\n');
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
        skill: project-review
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.equal(result.worker_path, null);
      assert.match(result.diagnostics.join('\n'), /dangling|skills root|symlink/i);
    });

    it('fails closed when one host worker candidate is a dangling symlink even if the other is valid', async () => {
      await put(root, '.agents/skills/project-review/SKILL.md', '---\nname: project-review\n---\n');
      await mkdir(join(root, '.claude/skills/project-review'), { recursive: true });
      await symlink(join(root, 'missing-worker.md'), join(root, '.claude/skills/project-review/SKILL.md'));
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
        skill: project-review
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.equal(result.worker_path, null);
      assert.match(result.diagnostics.join('\n'), /dangling|symlink|candidate/i);
    });

    for (const hostRoot of ['.agents', '.claude']) {
      it(`rejects when the whole ${hostRoot}/skills root is a symlink outside the project`, async () => {
        const outside = await mkdtemp(join(tmpdir(), 'wf-skills-root-outside-'));
        try {
          await put(outside, 'skills/project-review/SKILL.md', '---\nname: project-review\n---\n');
          await mkdir(join(root, hostRoot), { recursive: true });
          await symlink(join(outside, 'skills'), join(root, hostRoot, 'skills'));
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
        skill: project-review
`);
          const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
          assert.equal(result.status, 'BLOCKED');
          assert.equal(result.worker_path, null);
          assert.match(result.diagnostics.join('\n'), /skills root|outside|escape|symlink/i);
        } finally {
          await rm(outside, { recursive: true, force: true });
        }
      });
    }

    it('rejects worker whose SKILL.md is a symlink escaping project root', async () => {
      const outside = await mkdtemp(join(tmpdir(), 'wf-outside-'));
      try {
        await put(outside, 'SKILL.md', '---\nname: project-evil\n---\n');
        await mkdir(join(root, '.claude/skills/project-evil'), { recursive: true });
        await symlink(join(outside, 'SKILL.md'), join(root, '.claude/skills/project-evil/SKILL.md'));
        await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: project-evil
`);
        const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
        assert.equal(result.status, 'BLOCKED');
        assert.match(result.diagnostics.join('\n'), /escapes|symlink|containment/i);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it('returns BLOCKED when both .claude and .agents have same skill with different content', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: test-proj-review
`);
      await put(root, '.claude/skills/test-proj-review/SKILL.md', '---\nname: test-proj-review\ncontent: A\n---\n');
      await put(root, '.agents/skills/test-proj-review/SKILL.md', '---\nname: test-proj-review\ncontent: B\n---\n');
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.match(result.diagnostics.join('\n'), /conflict|inconsistent/i);
    });

    it('rejects a worker symlink that stays in project root but escapes its skills root', async () => {
      await put(root, 'shared/SKILL.md', '---\nname: project-shared\n---\n');
      await mkdir(join(root, '.claude/skills/project-shared'), { recursive: true });
      await symlink(join(root, 'shared/SKILL.md'), join(root, '.claude/skills/project-shared/SKILL.md'));
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
        skill: project-shared
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.equal(result.worker_path, null);
      assert.match(result.diagnostics.join('\n'), /skills root|escape|symlink/i);
    });

    it('fails closed when either host worker candidate is not a regular file', async () => {
      await mkdir(join(root, '.claude/skills/project-review/SKILL.md'), { recursive: true });
      await put(root, '.agents/skills/project-review/SKILL.md', '---\nname: project-review\n---\n');
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
        skill: project-review
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.equal(result.worker_path, null);
      assert.match(result.diagnostics.join('\n'), /regular file|not a file|candidate/i);
    });
  });

  describe('missing required resources', () => {
    it('returns NEEDS_INPUT when review has no checklists', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      worker:
        skill: test-proj-review
`);
      await put(root, '.claude/skills/test-proj-review/SKILL.md', '---\nname: test-proj-review\n---\n');
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'NEEDS_INPUT');
      assert.match(result.diagnostics.join('\n'), /checklist/i);
    });

    it('returns NEEDS_INPUT when generate has no templates', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  generate:
    design-spec:
      worker:
        skill: test-proj-generate
`);
      await put(root, '.claude/skills/test-proj-generate/SKILL.md', '---\nname: test-proj-generate\n---\n');
      const result = await buildCheckerOutput({ root, intent: 'generate', domain: 'design-spec' });
      assert.equal(result.status, 'NEEDS_INPUT');
      assert.match(result.diagnostics.join('\n'), /template/i);
    });

    it('does not leak a rejected resource back into resolver output arrays', async () => {
      await put(root, 'artifacts/checklists/good.md', '# Good');
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/good.md
        - artifacts/checklists/../checklists/good.md
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.deepEqual(result.checklist_paths, [join(root, 'artifacts/checklists/good.md')]);
      assert.match(result.diagnostics.join('\n'), /traversal|duplicate/i);
    });

    it('classifies a declared but missing resource as NEEDS_INPUT and omits it', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/missing.md
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'NEEDS_INPUT');
      assert.deepEqual(result.checklist_paths, []);
      assert.match(result.diagnostics.join('\n'), /not found|missing/i);
    });
  });

  // @feature ACA16 @scenario S-50
  // §2: validator collection, audit release-gate, status values.
  describe('validator collection', () => {
    it('executes validators in profile order with project cwd and explicit environment', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts/design'), { recursive: true });
      await put(root, 'artifacts/checklists/design-review.md', '# Review');
      await put(root, 'scripts/validate-design.mjs', `
const expected = ['review', 'design-spec', process.cwd()];
const actual = [process.env.ARTIFACT_WORKFLOW_INTENT, process.env.ARTIFACT_WORKFLOW_DOMAIN, process.env.ARTIFACT_WORKFLOW_ROOT];
if (JSON.stringify(expected) !== JSON.stringify(actual)) process.exit(9);
process.stdout.write('validator-one');
process.stderr.write('untrusted-stderr');
`);
      await put(root, 'scripts/validate-second.cjs', `process.stdout.write('validator-two')`);
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
        - scripts/validate-design.mjs
        - scripts/validate-second.cjs
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'OK');
      assert.equal(result.validators.length, 2);
      assert.match(result.validators[0].path, /validate-design\.mjs$/);
      assert.match(result.validators[0].command, /node/);
      assert.equal(result.validators[0].exit_code, 0);
      assert.equal(result.validators[0].stdout, 'validator-one');
      assert.equal(result.validators[0].stderr, 'untrusted-stderr');
      assert.equal(result.validators[1].stdout, 'validator-two');
    });

    it('returns BLOCKED with validator evidence when a validator exits non-zero', async () => {
      await put(root, 'artifacts/checklists/design-review.md', '# Review');
      await put(root, 'scripts/fail.js', `process.stderr.write('untrusted failure'); process.exit(7)`);
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
        - scripts/fail.js
`);
      const result = await buildCheckerOutput({ root, intent: 'review', domain: 'design-spec' });
      assert.equal(result.status, 'BLOCKED');
      assert.equal(result.validators[0].exit_code, 7);
      assert.equal(result.validators[0].stderr, 'untrusted failure');
      assert.match(result.diagnostics.join('\n'), /validator/i);
    });
  });

  describe('audit release-gate', () => {
    it('returns NEEDS_INPUT for an empty public release-gate mapping', async () => {
      await put(root, 'artifact-graph.config.yaml', 'artifactTypes: {}\n');
      await mkdir(join(root, 'artifacts'), { recursive: true });
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  audit:
    release-gate: {}
`);
      const result = await buildCheckerOutput({ root, intent: 'audit', domain: 'release-gate' });
      assert.equal(result.status, 'NEEDS_INPUT');
      assert.match(result.diagnostics.join('\n'), /checklist|validator/i);
    });

    it('returns NEEDS_INPUT when release-gate config is missing', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows: {}
`);
      const result = await buildCheckerOutput({ root, intent: 'audit', domain: 'release-gate' });
      assert.equal(result.status, 'NEEDS_INPUT');
      assert.match(result.diagnostics.join('\n'), /release-gate/i);
    });

    it('accepts audit release-gate with valid config', async () => {
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  audit:
    release-gate:
      checklists:
        - artifacts/checklists/release.md
`);
      await put(root, 'artifacts/checklists/release.md', '# Release');
      const result = await buildCheckerOutput({ root, intent: 'audit', domain: 'release-gate' });
      assert.equal(result.status, 'OK');
      assert.equal(result.execution_mode, 'public-worker');
      assert.equal(result.worker_path, join(resolve(import.meta.dirname, '..'), 'skills-src/artifact-audit/SKILL.md'));
    });

    it('routes batch to the artifact-batch public worker', async () => {
      await put(root, 'artifacts/checklists/batch.md', '# Batch');
      await put(root, 'artifact-profiles/project.yaml', `schema_version: 1
project:
  id: test-proj
  language: typescript
workflows:
  batch:
    design-spec:
      checklists:
        - artifacts/checklists/batch.md
`);
      const result = await buildCheckerOutput({ root, intent: 'batch', domain: 'design-spec' });
      assert.equal(result.status, 'OK');
      assert.equal(result.execution_mode, 'public-worker');
      assert.equal(result.worker_path, join(resolve(import.meta.dirname, '..'), 'skills-src/artifact-batch/SKILL.md'));
    });
  });

  describe('status values', () => {
    it('status is always one of OK, NEEDS_INPUT, BLOCKED', async () => {
      // Test various scenarios
      const scenarios = [
        { config: false, intent: 'review', domain: 'design-spec' },
        { config: true, intent: 'review', domain: 'design-spec' },
        { config: true, intent: 'generate', domain: 'design-spec' },
      ];
      for (const s of scenarios) {
        if (s.config) {
          await put(root, 'artifact-profiles/project.yaml', `schema_version: 1\nproject:\n  id: test\n  language: ts\nworkflows: {}\n`);
        }
        const result = await buildCheckerOutput({ root, intent: s.intent, domain: s.domain });
        assert.ok(
          ['OK', 'NEEDS_INPUT', 'BLOCKED'].includes(result.status),
          `Status must be OK|NEEDS_INPUT|BLOCKED, got ${result.status}`
        );
      }
    });
  });
});
