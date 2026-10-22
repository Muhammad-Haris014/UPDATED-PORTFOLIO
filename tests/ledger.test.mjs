import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tenureOf, reachOf, drynessOf, nextOpen, fitFont, hexToRgb, rampAt, valueNoise, hash2 } from '../js/ledger.js';

test('tenure parses ranges, open-ended roles and single years', () => {
  assert.deepEqual(tenureOf('2022-2024', 2026), { start: 2022, end: 2024, length: 2 });
  assert.deepEqual(tenureOf('2025-now', 2026), { start: 2025, end: 2026, length: 1 });
  assert.deepEqual(tenureOf('2025', 2026), { start: 2025, end: 2025, length: 0.5 });
  assert.equal(tenureOf('someday', 2026), null);
});

test('longer tenure paints a longer stroke, within bounds', () => {
  assert.ok(reachOf(2) > reachOf(0.5));
  assert.equal(reachOf(0), 0.38);
  assert.equal(reachOf(50), 0.7);
});

test('a current role is wet; older roles dry out, capped', () => {
  assert.equal(drynessOf(2026, 2026), 0);
  assert.ok(drynessOf(2024, 2026) > 0);
  assert.equal(drynessOf(1990, 2026), 0.6);
});

test('one row open at a time; opening the open row closes it', () => {
  assert.equal(nextOpen(null, 2), 2);
  assert.equal(nextOpen(2, 2), null);
  assert.equal(nextOpen(2, 0), 0);
});

test('wordmarks shrink to fit but never below the minimum', () => {
  assert.equal(fitFont(100, 400, 500), 100);
  assert.equal(fitFont(100, 1000, 500), 50);
  assert.equal(fitFont(100, 100000, 500), 18);
});

test('colour helpers', () => {
  assert.deepEqual(hexToRgb('#ff7417'), [255, 116, 23]);
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  const e = [0, 0, 0], b = [100, 100, 100], c = [200, 200, 200];
  assert.deepEqual(rampAt(e, b, c, 0), e);
  assert.deepEqual(rampAt(e, b, c, 0.5), b);
  assert.deepEqual(rampAt(e, b, c, 1), c);
});

test('noise is deterministic and in range', () => {
  assert.equal(hash2(3, 4, 9), hash2(3, 4, 9));
  for (let i = 0; i < 50; i++) {
    const v = valueNoise(i * 0.37, i * 0.61, 5);
    assert.ok(v >= 0 && v <= 1);
  }
});
