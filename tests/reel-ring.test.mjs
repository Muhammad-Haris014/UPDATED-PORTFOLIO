import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REEL_SLOTS, START, END, wrap, reelAngle, reelPose, reelScene } from '../js/reel-ring.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('wrap keeps angles in [-180, 180)', () => {
  for (let d = -1000; d <= 1000; d += 7.3) {
    const w = wrap(d);
    assert.ok(w >= -180 && w < 180, `${d} -> ${w}`);
    // Same direction on the circle: the difference is a whole number of turns.
    const turns = (w - d) / 360;
    close(turns, Math.round(turns), 1e-9);
  }
});

test('slots are evenly spread around the ring', () => {
  const angles = Array.from({ length: REEL_SLOTS }, (_, i) => reelAngle(i, 0)).sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i++) close(angles[i] - angles[i - 1], 360 / REEL_SLOTS);
});

test('scene interpolates from START to END', () => {
  const s0 = reelScene(0), s1 = reelScene(1);
  for (const k of ['radius', 'perspective', 'tilt', 'roll', 'scale', 'lift']) {
    close(s0[k], START[k]);
    close(s1[k], END[k]);
  }
});

test('fit scales lengths uniformly but not angles', () => {
  const a = reelScene(0.4), b = reelScene(0.4, [0.5, 0.5]);
  close(b.radius, a.radius * 0.5);
  close(b.perspective, a.perspective * 0.5);
  close(b.tilt, a.tilt);
});

test('once formed, every card sits on one circle facing the centre', () => {
  const scene = reelScene(1);
  for (let i = 0; i < REEL_SLOTS; i++) {
    const a = reelAngle(i, 13);
    const p = reelPose(a, 1, scene);
    close(Math.hypot(p.x, p.z), scene.radius, 1e-6);
    close(p.yaw, a, 1e-9);
    assert.equal(p.appear, 1);
  }
});

test('before formation every card waits at the front, invisible', () => {
  const scene = reelScene(0);
  for (let i = 0; i < REEL_SLOTS; i++) {
    const p = reelPose(reelAngle(i, 0), 0, scene);
    close(p.yaw, -180);
    assert.ok(p.z > 0, 'front of ring is towards the camera');
    assert.equal(p.appear, 0);
  }
});

test('each card travels monotonically from the front to its angle', () => {
  const scene = reelScene(0);
  for (const a of [-170, -90, 0, 45, 179]) {
    let prev = -Infinity;
    for (let f = 0; f <= 1.0001; f += 0.01) {
      const yaw = reelPose(a, f, scene).yaw;
      assert.ok(yaw >= prev - 1e-9, `angle ${a} went backwards at f=${f}`);
      prev = yaw;
    }
    close(prev, a, 1e-9);
  }
});

test('the deal travels around the ring: earlier angles finish first', () => {
  const scene = reelScene(0);
  const doneAt = (a) => {
    for (let f = 0; f <= 1.0001; f += 0.001) if (reelPose(a, f, scene).yaw === a) return f;
    return 1;
  };
  assert.ok(doneAt(-150) < doneAt(0));
  assert.ok(doneAt(0) < doneAt(150));
});

test('in the hero, the card nearest the camera is hidden, the far one is not', () => {
  const scene = reelScene(1);
  assert.equal(reelPose(-180, 1, scene).behindCamera, true);
  assert.equal(reelPose(0, 1, scene).behindCamera, false);
  // In the loader the camera is outside the ring, so nothing is hidden.
  const loader = reelScene(0);
  for (let i = 0; i < REEL_SLOTS; i++) assert.equal(reelPose(reelAngle(i, 0), 1, loader).behindCamera, false);
});
