import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGrid, computeStats, levelOf, riseAt, camera, project, dayMs, monthLabels } from '../js/skyline-core.js';

const snapshot = JSON.parse(readFileSync(new URL('../data/contributions.json', import.meta.url)));
const end = dayMs(snapshot[snapshot.length - 1].date);

test('the grid covers a year, in whole weeks of seven rows, ending on the last day', () => {
  const g = buildGrid(snapshot, end);
  assert.ok(g.cells.length >= 365 && g.cells.length <= 371);
  assert.equal(g.cells.at(-1).date, snapshot.at(-1).date);
  assert.equal(new Date(dayMs(g.cells[0].date)).getUTCDay(), 0, 'starts on a Sunday');
  g.cells.forEach((c, i) => { assert.equal(c.week, Math.floor(i / 7)); assert.equal(c.day, i % 7); });
});

test('repeated dates add up and bad rows are ignored', () => {
  const g = buildGrid([{ date: '2026-01-10', count: 2 }, { date: '2026-01-10', count: 3 }, { date: 'nope', count: 4 }, { date: '2026-01-11', count: -1 }], dayMs('2026-01-11'));
  assert.equal(g.cells.find((c) => c.date === '2026-01-10').count, 5);
  assert.equal(g.cells.find((c) => c.date === '2026-01-11').count, 0);
});

test('levels: 0 for empty, 1–4 by quarters, capped at 4', () => {
  assert.equal(levelOf(0, 10), 0);
  assert.equal(levelOf(1, 10), 1);
  assert.equal(levelOf(5, 10), 3);
  assert.equal(levelOf(50, 10), 4);
});

test('stats match the snapshot', () => {
  const g = buildGrid(snapshot, end);
  const s = computeStats(g.cells);
  const total = snapshot.filter((d) => dayMs(d.date) >= dayMs(g.cells[0].date)).reduce((a, d) => a + d.count, 0);
  assert.equal(s.total, total);
  assert.equal(s.busiest.count, Math.max(...snapshot.map((d) => d.count)));
  assert.ok(s.longest.days >= s.current.days);
});

test('streaks: the current run may end yesterday because today is not over', () => {
  const days = ['2026-03-01', '2026-03-02', '2026-03-03'].map((date) => ({ date, count: 1 }));
  const s = computeStats(buildGrid(days, dayMs('2026-03-04')).cells);
  assert.equal(s.current.days, 3);
  assert.equal(s.longest.days, 3);
});

test('every bar is flat at t=0 and fully up at t=1, oldest week first', () => {
  for (const w of [0, 20, 52]) {
    assert.equal(riseAt(0, w, 53, 3), 0);
    assert.equal(riseAt(1, w, 53, 3), 1);
  }
  assert.ok(riseAt(0.3, 0, 53, 0) > riseAt(0.3, 52, 53, 0));
});

test('the flat camera is a plain grid: x across, y down, height invisible', () => {
  const cam = camera(0);
  const [x, y] = project(cam, 3, 2, 99);
  assert.ok(Math.abs(x - 3) < 1e-9 && Math.abs(y - 2) < 1e-9);
});

test('month labels never crowd the first column', () => {
  const g = buildGrid(snapshot, end);
  const m = monthLabels(g.cells, g.weeks);
  assert.ok(m.length >= 11);
  if (m.length > 1) assert.ok(m[1].week - m[0].week >= 3);
});
