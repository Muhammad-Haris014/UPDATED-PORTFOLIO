import { test } from 'node:test';
import assert from 'node:assert/strict';
import { springStep, driftFor, placeCard } from '../js/link-preview.js';

test('the entrance spring settles on its target', () => {
  let x = 0, v = 0;
  for (let i = 0; i < 200; i++) [x, v] = springStep(x, v, 1, 260, 20, 1 / 60);
  assert.ok(Math.abs(x - 1) < 1e-3 && Math.abs(v) < 1e-2);
});

test('the entrance spring overshoots a little, which is the pop', () => {
  let x = 0, v = 0, peak = 0;
  for (let i = 0; i < 120; i++) { [x, v] = springStep(x, v, 1, 260, 20, 1 / 60); peak = Math.max(peak, x); }
  assert.ok(peak > 1 && peak < 1.2);
});

test('drift is zero at the centre and half the distance either side', () => {
  assert.equal(driftFor(50, 100), 0);
  assert.equal(driftFor(100, 100), 25);
  assert.equal(driftFor(0, 100), -25);
});

test('the card centres over the trigger and stays in the viewport', () => {
  const rect = { left: 400, width: 100, top: 500, bottom: 520 };
  assert.deepEqual(placeCard(rect, 200, 100, 1000), { left: 350, top: 390, below: false });
  assert.equal(placeCard({ ...rect, left: 0 }, 200, 100, 1000).left, 8);
  assert.equal(placeCard({ ...rect, left: 980 }, 200, 100, 1000).left, 1000 - 200 - 8);
});

test('with no room above, the card flips below', () => {
  const p = placeCard({ left: 400, width: 100, top: 40, bottom: 60 }, 200, 100, 1000);
  assert.equal(p.below, true);
  assert.equal(p.top, 70);
});
