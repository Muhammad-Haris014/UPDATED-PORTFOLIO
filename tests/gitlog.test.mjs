import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANE_X, forkPath, lanePaths } from '../js/gitlog.js';

test('the fork curve ends exactly on the education lane at the fork commit', () => {
  const d = forkPath(46, 300, 18, 600);
  assert.match(d, /^C/);
  assert.ok(d.endsWith('18,600.0'));
});

test('the work branch runs from the top through each work commit, then forks into education', () => {
  const { workD, eduD, wipD } = lanePaths({ work: [40, 320], fork: 600, edu: [780, 900] });
  const [x0, x1] = LANE_X;
  assert.ok(workD.startsWith(`M${x1},0`));
  assert.ok(workD.includes(`L${x1},40.0`) && workD.includes(`L${x1},320.0`));
  assert.ok(workD.endsWith(`${x0},600.0`));
  assert.equal(eduD, `M${x0},600.0L${x0},780.0L${x0},900.0`);
  assert.equal(wipD, `M${x0},0L${x0},600.0`, 'education stays open above its last commit');
});
