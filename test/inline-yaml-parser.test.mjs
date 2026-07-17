// @feature ACA16 @scenario S-50
// Tests for the self-contained inline YAML parser used by workflow-profile loader.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMinimalYaml } from '../scripts/lib/inline-yaml-parser.mjs';

/** Recursively convert a plain object tree to null-prototype for deep comparison. */
function toNP(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toNP);
  const out = Object.create(null);
  for (const k of Object.keys(obj)) out[k] = toNP(obj[k]);
  return out;
}

/** Deep-strict-equal that treats regular and null-prototype objects as equivalent. */
function assertNP(actual, expected) {
  assert.deepStrictEqual(actual, toNP(expected));
}

describe('parseMinimalYaml', () => {
  describe('positive cases — valid YAML subset', () => {
    it('parses an empty document as null', () => {
      assert.equal(parseMinimalYaml(''), null);
    });

    it('parses a simple key: value', () => {
      const result = parseMinimalYaml('key: value');
      assertNP(result, { key: 'value' });
    });

    it('parses an integer scalar', () => {
      const result = parseMinimalYaml('schema_version: 1');
      assertNP(result, { schema_version: 1 });
    });

    it('parses a negative integer', () => {
      const result = parseMinimalYaml('count: -5');
      assertNP(result, { count: -5 });
    });

    it('parses a boolean true', () => {
      const result = parseMinimalYaml('enabled: true');
      assertNP(result, { enabled: true });
    });

    it('parses a boolean false', () => {
      const result = parseMinimalYaml('enabled: false');
      assertNP(result, { enabled: false });
    });

    it('parses null keyword', () => {
      const result = parseMinimalYaml('value: null');
      assertNP(result, { value: null });
    });

    it('parses a quoted string', () => {
      const result = parseMinimalYaml('name: "hello world"');
      assertNP(result, { name: 'hello world' });
    });

    it('parses a single-quoted string', () => {
      const result = parseMinimalYaml("name: 'hello world'");
      assertNP(result, { name: 'hello world' });
    });

    it('parses nested objects', () => {
      const yaml = `project:
  id: test-proj
  language: typescript`;
      const result = parseMinimalYaml(yaml);
      assertNP(result, { project: { id: 'test-proj', language: 'typescript' } });
    });

    it('accepts the next actual child indentation instead of requiring two spaces', () => {
      const yaml = `project:
     id: test-proj
     language: typescript`;
      const result = parseMinimalYaml(yaml);
      assertNP(result, { project: { id: 'test-proj', language: 'typescript' } });
    });

    it('parses deeply nested objects', () => {
      const yaml = `workflows:
  review:
    design-spec:
      checklists:
        - artifacts/checklists/design-review.md
      worker:
        skill: artifact-review-design`;
      const result = parseMinimalYaml(yaml);
      assertNP(result, {
        workflows: {
          review: {
            'design-spec': {
              checklists: ['artifacts/checklists/design-review.md'],
              worker: { skill: 'artifact-review-design' },
            },
          },
        },
      });
    });

    it('parses an array of strings', () => {
      const yaml = `items:
  - alpha
  - beta
  - gamma`;
      const result = parseMinimalYaml(yaml);
      assertNP(result, { items: ['alpha', 'beta', 'gamma'] });
    });

    it('parses an empty inline object {}', () => {
      const result = parseMinimalYaml('data: {}');
      assertNP(result, { data: {} });
    });

    it('parses an empty inline array []', () => {
      const result = parseMinimalYaml('items: []');
      assertNP(result, { items: [] });
    });

    it('parses a complete valid profile', () => {
      const yaml = `schema_version: 1
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
        skill: artifact-review-design`;
      const result = parseMinimalYaml(yaml);
      assert.equal(result.schema_version, 1);
      assert.equal(result.project.id, 'test-proj');
      assert.equal(result.project.language, 'typescript');
      assert.equal(result.project.name, 'Test Project');
      assertNP(result.workflows.review['design-spec'].checklists, ['artifacts/checklists/design-review.md']);
      assertNP(result.workflows.review['design-spec'].validators, ['scripts/validate-design.mjs']);
      assertNP(result.workflows.review['design-spec'].templates, ['templates/design-spec.md']);
      assert.equal(result.workflows.review['design-spec'].worker.skill, 'artifact-review-design');
    });

    it('parses an object with only empty braces as child', () => {
      const yaml = `workflows:
  review:
    design-spec: {}`;
      const result = parseMinimalYaml(yaml);
      assertNP(result, { workflows: { review: { 'design-spec': {} } } });
    });

    it('ignores comment lines', () => {
      const yaml = `# This is a comment
key: value
# Another comment`;
      const result = parseMinimalYaml(yaml);
      assertNP(result, { key: 'value' });
    });

    it('parses a string with colon in value', () => {
      const result = parseMinimalYaml('url: https://example.com');
      assertNP(result, { url: 'https://example.com' });
    });

    it('parses a string value with special chars', () => {
      const result = parseMinimalYaml('pattern: "^[a-z][a-z0-9-]*$"');
      assertNP(result, { pattern: '^[a-z][a-z0-9-]*$' });
    });
  });

  describe('negative cases — unsupported YAML constructs', () => {
    it('rejects tab indentation', () => {
      assert.throws(() => parseMinimalYaml("key:\n\tvalue"), /tab/i);
    });

    it('rejects duplicate keys at the same level', () => {
      const yaml = `key: first
key: second`;
      assert.throws(() => parseMinimalYaml(yaml), /duplicate/i);
    });

    it('rejects duplicate keys in a nested object', () => {
      const yaml = `project:
  id: first
  id: second`;
      assert.throws(() => parseMinimalYaml(yaml), /duplicate/i);
    });

    it('rejects anchor syntax', () => {
      const yaml = `key: &anchor value`;
      assert.throws(() => parseMinimalYaml(yaml), /anchor|unsupported/i);
    });

    it('rejects alias syntax', () => {
      const yaml = `key: *alias`;
      assert.throws(() => parseMinimalYaml(yaml), /alias|unsupported/i);
    });

    it('rejects YAML tags', () => {
      const yaml = `key: !!int 42`;
      assert.throws(() => parseMinimalYaml(yaml), /tag|unsupported/i);
    });

    it('rejects multi-document separator ---', () => {
      const yaml = `key: value
---
other: doc`;
      assert.throws(() => parseMinimalYaml(yaml), /multi-document|unsupported/i);
    });

    it('rejects document end marker ...', () => {
      const yaml = `key: value
...`;
      assert.throws(() => parseMinimalYaml(yaml), /multi-document|unsupported/i);
    });

    it('rejects complex (quoted) keys', () => {
      const yaml = `"complex key": value`;
      assert.throws(() => parseMinimalYaml(yaml), /complex key|unsupported/i);
    });

    it('rejects inconsistent sibling indentation in the same mapping block', () => {
      const yaml = `project:
     id: test-proj
      language: typescript`;
      assert.throws(() => parseMinimalYaml(yaml), /indent/i);
    });
  });

  describe('prototype pollution prevention', () => {
    // @feature ACA16 @scenario S-50
    // §1 security: inline YAML parser must block __proto__, prototype, constructor pollution.
    it('rejects top-level __proto__ key', () => {
      assert.throws(() => parseMinimalYaml('__proto__: polluted'), /proto|unsupported mapping key/i);
    });

    it('rejects nested __proto__ key', () => {
      const yaml = `project:
  __proto__: polluted`;
      assert.throws(() => parseMinimalYaml(yaml), /proto|unsupported mapping key/i);
    });

    it('rejects top-level prototype key', () => {
      assert.throws(() => parseMinimalYaml('prototype: polluted'), /prototype|unsupported mapping key/i);
    });

    it('rejects nested prototype key', () => {
      const yaml = `project:
  prototype: polluted`;
      assert.throws(() => parseMinimalYaml(yaml), /prototype|unsupported mapping key/i);
    });

    it('rejects top-level constructor key', () => {
      assert.throws(() => parseMinimalYaml('constructor: polluted'), /constructor|unsupported mapping key/i);
    });

    it('rejects nested constructor key', () => {
      const yaml = `project:
  constructor: polluted`;
      assert.throws(() => parseMinimalYaml(yaml), /constructor|unsupported mapping key/i);
    });

    it('returns null-prototype objects (no inherited properties)', () => {
      const result = parseMinimalYaml('key: value');
      assert.equal(Object.getPrototypeOf(result), null);
      assert.equal(result.hasOwnProperty, undefined);
    });

    it('returns null-prototype for nested objects', () => {
      const yaml = `project:
  id: test`;
      const result = parseMinimalYaml(yaml);
      assert.equal(Object.getPrototypeOf(result.project), null);
    });
  });
});
