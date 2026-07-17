// @feature ACA17
// @scenario S-56
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const entrySkills = [
  'artifact-review', 'artifact-repair', 'artifact-generate',
  'prd-feature/author', 'prd-feature/review', 'prd-feature/repair',
  'scenario-script/author', 'scenario-script/review', 'scenario-script/repair',
];
const professionalSkills = entrySkills.slice(3);

test('every fenced JSON example in source skills is valid JSON', async () => {
  for await (const path of glob(join(root, 'skills-src/**/*.md'))) {
    const content = await readFile(path, 'utf8');
    let index = 0;
    for (const match of content.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
      index += 1;
      assert.doesNotThrow(() => JSON.parse(match[1]), `${path} fenced JSON #${index} must parse`);
    }
  }
});

for (const skill of entrySkills) {
  test(`${skill} declares the shared six-field task object and trust boundary`, async () => {
    const content = await readFile(join(root, 'skills-src', skill, 'SKILL.md'), 'utf8');
    for (const field of ['intent', 'domain', 'target_path', 'run_dir', 'profile_resolution', 'input_result']) {
      assert.match(content, new RegExp(`"${field}"\\s*:`), `${skill} missing ${field}`);
    }
    assert.match(content, /不可信|untrusted/i);
    assert.match(content, /checklist/i);
    assert.match(content, /stdout/i);
    assert.match(content, /stderr/i);
  });
}

for (const skill of professionalSkills) {
  test(`${skill} caps repair/re-review convergence and separates acceptance`, async () => {
    const content = await readFile(join(root, 'skills-src', skill, 'SKILL.md'), 'utf8');
    assert.match(content, /最多\s*3\s*轮/);
    assert.match(content, /丢弃|失效尝试/);
    assert.match(content, /同一执行者.*接受|不得.*自行.*接受/);
    assert.match(content, /BLOCKED/);
  });
}

for (const skill of ['prd-feature/review', 'scenario-script/review']) {
  test(`${skill} uses Review Result v1.0 as the machine protocol`, async () => {
    const content = await readFile(join(root, 'skills-src', skill, 'SKILL.md'), 'utf8');
    assert.match(content, /Review Result Protocol v1\.0/);
    assert.match(content, /"schema_version"\s*:\s*"1\.0"/);
    assert.match(content, /"review"\s*:/);
    assert.doesNotMatch(content, /review 输出必须为可机读的结构:\s*\n\s*```yaml\s*\nverdict:/);
  });
}

test('internal workflow worker uses concrete enum examples and honest discoverability semantics', async () => {
  const content = await readFile(join(root, 'skills-src/artifact-workflow-worker/SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /"(?:status|decision)"\s*:\s*"[A-Z_]+\|/);
  assert.doesNotMatch(content.trimEnd(), /```$/);
  assert.match(content, /worker\.skill.*名称/);
  assert.match(content, /user-invocable:\s*false.*(?:元数据|提示|保证)/s);
  assert.match(content, /semantic validator|语义校验器/i);
  assert.match(content, /NEEDS_INPUT/);
  assert.match(content, /事务|transaction/i);
  assert.match(content, /ARTIFACT_WORKFLOW_TARGET/);
  assert.doesNotMatch(content, /读取全部 checklist[^\n]*\n?[^\n]*producer\.executor=worker/);
});
