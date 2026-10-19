import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hwfHex, hwfRadius, hwfStep, hwfWarmth, hwfFitSize } from '../js/halftone.js';

test('hex parses #rgb and #rrggbb, rejects the rest', () => {
  assert.deepEqual(hwfHex('#ff5a1f'), [255, 90, 31]);
  assert.deepEqual(hwfHex('#fff'), [255, 255, 255]);
  assert.equal(hwfHex('red'), null);
  assert.equal(hwfHex(''), null);
});

test('dot radius is area-true and clamped', () => {
  assert.equal(hwfRadius(0, 6), 0);
  assert.equal(hwfRadius(-1, 6), 0);
  assert.equal(hwfRadius(1, 6), hwfRadius(5, 6));
  // Quarter coverage → half the full radius, so a quarter of the area.
  assert.ok(Math.abs(hwfRadius(0.25, 6) - hwfRadius(1, 6) / 2) < 1e-9);
});

test('away from the pointer, a displaced dot springs home and rests', () => {
  let s = [20, -15, 0, 0];
  for (let i = 0; i < 400; i++) s = hwfStep(s[0], s[1], s[2], s[3], 0, 0, -1e5, -1e5, 80);
  assert.ok(Math.hypot(s[0], s[1]) < 0.01);
  assert.ok(Math.hypot(s[2], s[3]) < 0.01);
});

test('the pointer pushes a dot away from itself', () => {
  const [x] = hwfStep(10, 0, 0, 0, 10, 0, 0, 0, 80);
  assert.ok(x > 10);
});

test('warmth runs 0 at home to 1 at the span', () => {
  assert.equal(hwfWarmth(0, 0, 0, 0, 28), 0);
  assert.equal(hwfWarmth(14, 0, 0, 0, 28), 0.5);
  assert.equal(hwfWarmth(100, 0, 0, 0, 28), 1);
  assert.equal(hwfWarmth(5, 0, 0, 0, 0), 0);
});

test('fit size scales the 100px measurement to the width', () => {
  assert.equal(hwfFitSize(200, 1000), 500);
  assert.equal(hwfFitSize(0, 1000), 0);
});
