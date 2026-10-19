import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGradient, sweepEase, SWEEP_START, SWEEP_END } from '../js/dia-text.js';

const colors = ['#c679c4', '#fa3d1d', '#ffb005'];

test('before the sweep the text is hidden: the band is off the left edge, the rest transparent', () => {
  const g = buildGradient(SWEEP_START, colors, 'ink');
  assert.ok(!g.includes('ink'), 'no solid text yet');
  assert.ok(g.includes('transparent 100%'));
});

test('after the sweep the text is solid ink', () => {
  assert.equal(buildGradient(SWEEP_END, colors, 'ink'), 'linear-gradient(90deg, ink, ink)');
});

test('mid-sweep: ink on the left, the band in order, transparent on the right', () => {
  const g = buildGradient(50, colors, 'ink');
  const i = (s) => g.indexOf(s);
  assert.ok(i('ink 0%') >= 0);
  assert.ok(i('ink 0%') < i('#c679c4') && i('#c679c4') < i('#fa3d1d') && i('#fa3d1d') < i('#ffb005') && i('#ffb005') < i('transparent'));
});

test('one colour sits at the sweep position', () => {
  assert.ok(buildGradient(40, ['#fff'], 'ink').includes('#fff 40.00%'));
});

test('the sweep eases from 0 to 1 symmetrically', () => {
  assert.equal(sweepEase(0), 0);
  assert.equal(sweepEase(1), 1);
  assert.equal(sweepEase(0.5), 0.5);
  assert.ok(Math.abs(sweepEase(0.25) + sweepEase(0.75) - 1) < 1e-12);
});
