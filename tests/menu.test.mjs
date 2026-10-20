import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSchedule } from '../js/menu.js';

test('layers slide in one after another, before the links rise', () => {
  const s = openSchedule(3, 6, 4);
  assert.deepEqual(s.layers, [0, 120, 240]);
  assert.ok(s.links[0] > s.layers[1], 'links start while the last layer is still arriving');
});

test('links and fades stagger in order, fades after the first link', () => {
  const s = openSchedule(3, 6, 4);
  for (let i = 1; i < s.links.length; i++) assert.equal(s.links[i] - s.links[i - 1], 50);
  for (let i = 1; i < s.fades.length; i++) assert.equal(s.fades[i] - s.fades[i - 1], 40);
  assert.ok(s.fades[0] > s.links[0]);
});
