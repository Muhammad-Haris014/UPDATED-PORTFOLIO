import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubicBezier, bez, T, E, sampleTracks, tracksEnd, buildMessage, previewWords } from '../js/wa-orb.js';

test('cubic-bezier easing runs 0 → 1 and matches the linear curve', () => {
  const lin = cubicBezier(0.25, 0.25, 0.75, 0.75);
  for (const x of [0, 0.2, 0.5, 0.8, 1]) assert.ok(Math.abs(lin(x) - x) < 1e-4);
  assert.equal(E.out(0), 0);
  assert.equal(E.out(1), 1);
  assert.ok(E.spring(0.6) > 1, 'the spring overshoots');
});

test('the flight curve starts at the button and ends at the centre', () => {
  assert.equal(bez(0, 120, 40, 0), 120);
  assert.equal(bez(1, 120, 40, 0), 0);
});

test('tracks: later tracks on a channel take over once they start', () => {
  const tracks = [T('w', 200, 190, 0, 100, E.lin), T('w', 190, 56, 100, 500, E.lin)];
  assert.equal(sampleTracks(tracks, 50).w, 195);
  assert.equal(sampleTracks(tracks, 300).w, 123);
  assert.equal(sampleTracks(tracks, 900).w, 56);
  assert.equal(tracksEnd(tracks), 500);
  assert.equal(sampleTracks([T('a', 0, 1, 200, 300)], 100).a, undefined, 'nothing before a track starts');
});

test('the WhatsApp message keeps every field', () => {
  const msg = buildMessage({ name: 'Ali', email: 'a@b.co', subject: 'Model help', message: 'Can you look at my CNN?' });
  assert.match(msg, /^Hi Haris, I'm Ali \(a@b\.co\)\./);
  assert.match(msg, /\*Model help\*\nCan you look at my CNN\?$/);
});

test('the preview is subject — message, trimmed with an ellipsis', () => {
  assert.deepEqual(previewWords({ subject: 'Hi', message: 'there friend' }), ['Hi', '—', 'there', 'friend']);
  const long = previewWords({ subject: 'S', message: 'w '.repeat(50) }, 10);
  assert.equal(long.length, 11);
  assert.equal(long.at(-1), '…');
});
