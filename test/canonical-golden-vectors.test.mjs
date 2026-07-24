// @feature ACA18 @scenario S-66 @decision D-ACA-18
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canonicalStringify, validateJsonSafe } from '../scripts/lib/generated/canonical-json-v1.generated.mjs';

const vectors = JSON.parse(await readFile(new URL('../scripts/lib/generated/canonical-json-v1-vectors.generated.json', import.meta.url), 'utf8'));
const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;

for (const vector of vectors.legal) {
  test(`canonical-json-v1 bytes and digest: ${vector.name}`, () => {
    const canonical = canonicalStringify(vector.input);
    assert.equal(canonical, vector.canonical);
    assert.equal(digest(canonical), vector.digest);
    assert.equal(canonicalStringify(Object.fromEntries(Object.entries(vector.input).reverse())), vector.canonical);
  });
}

for (const vector of vectors.orderDifferences) {
  test(`canonical-json-v1 preserves array order: ${vector.name}`, () => {
    assert.notEqual(canonicalStringify(vector.left), canonicalStringify(vector.right));
  });
}

test('canonical-json-v1 rejects declared invalid kinds without invoking traps', () => {
  let accessorCalls = 0;
  let proxyCalls = 0;
  const circular = {}; circular.self = circular;
  const invalid = {
    undefined, nan: NaN, 'positive-infinity': Infinity, 'negative-infinity': -Infinity,
    bigint: 1n, symbol: Symbol('x'), function: () => {}, date: new Date(), regexp: /x/,
    map: new Map(), set: new Set(), promise: Promise.resolve(), error: new Error('x'),
    'custom-prototype': Object.create({}), circular, 'sparse-array': new Array(1),
    'hidden-field': Object.defineProperty({}, 'x', { value: 1, enumerable: false }),
    'symbol-key': { [Symbol('x')]: 1 },
    accessor: Object.defineProperty({}, 'x', { enumerable: true, get() { accessorCalls += 1; return 1; } }),
    proxy: new Proxy({}, { ownKeys() { proxyCalls += 1; return []; }, getPrototypeOf() { proxyCalls += 1; return Object.prototype; } }),
  };
  assert.deepEqual(Object.keys(invalid).sort(), [...vectors.invalidKinds].sort());
  for (const kind of vectors.invalidKinds) assert.throws(() => validateJsonSafe(invalid[kind]), TypeError);
  assert.equal(accessorCalls, 0);
  assert.equal(proxyCalls, 0);
});
