import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lossAt, accAt, yOf, curvePath, progressOf, activeIndex, cardCenter } from '../js/journey.js';

test('loss falls and accuracy rises across the run', () => {
  assert.ok(lossAt(0) > 0.85 && lossAt(1) < 0.12);
  assert.ok(accAt(0) < 0.35 && accAt(1) > 0.9);
  for (const x of [0.1, 0.4, 0.7]) assert.ok(lossAt(x + 0.2) < lossAt(x), `loss keeps trending down at ${x}`);
});

test('both curves stay on the chart', () => {
  for (let i = 0; i <= 200; i++) {
    const x = i / 200;
    for (const v of [lossAt(x), accAt(x)]) {
      const y = yOf(v);
      assert.ok(y >= 0 && y <= 300, `y=${y} at x=${x}`);
    }
  }
});

test('the curve path spans the full width', () => {
  const d = curvePath(lossAt, 10);
  assert.ok(d.startsWith('M0.0,'));
  assert.ok(d.includes('L1000.0,'));
  assert.equal(d.match(/[ML]/g).length, 11);
});

test('progress runs 0 → 1 through the pinned track and clamps outside it', () => {
  assert.equal(progressOf(100, 4000, 1000), 0);
  assert.equal(progressOf(-1500, 4000, 1000), 0.5);
  assert.equal(progressOf(-5000, 4000, 1000), 1);
});

test('each epoch gets a quarter of the run, and its card is centred at its checkpoint', () => {
  assert.equal(activeIndex(0, 4), 0);
  assert.equal(activeIndex(0.3, 4), 1);
  assert.equal(activeIndex(1, 4), 3);
  assert.equal(cardCenter(0.125, 4), 0);
  assert.equal(cardCenter(0.625, 4), 2);
  assert.equal(cardCenter(1, 4), 3);
  assert.equal(cardCenter(0, 4), 0);
});
