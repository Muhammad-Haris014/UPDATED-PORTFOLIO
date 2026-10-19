// The whole entrance is two numbers: formation (0..1) and expansion (0..1).
// Everything in this file is pure, so it can be unit-tested without a browser.

export const REEL_SLOTS = 16;

// Share of the formation each card spends moving; the rest is stagger.
export const DEAL = 0.3;

// Loader end of the interpolation: small ring, seen from above, dutch roll.
export const START = { radius: 460, perspective: 1200, tilt: -22, roll: -20, scale: 0.42, lift: -50 };

// Hero end: big ring, level camera inside it. Lifted so the headline has a floor to sit on.
export const END = { radius: 1800, perspective: 450, tilt: 0, roll: 0, scale: 2.3, lift: -80 };

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Wrap an angle into [-180, 180). 0 is the far centre, ±180 is nearest the camera. */
export function wrap(deg) {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

/** Resting angle of a slot after the whole ring has turned by `angle`. */
export function reelAngle(slot, angle, slots = REEL_SLOTS) {
  return wrap((slot * 360) / slots + angle);
}

/**
 * Camera + ring parameters for a given expansion.
 * `fit` = [startFit, endFit] uniformly scales the scene to the viewport
 * (radius, perspective, card scale and lift all scale together, so the look is identical).
 */
export function reelScene(expansion, fit = [1, 1]) {
  const e = clamp01(expansion);
  const f = lerp(fit[0], fit[1], e);
  return {
    radius: lerp(START.radius, END.radius, e) * f,
    perspective: lerp(START.perspective, END.perspective, e) * f,
    tilt: lerp(START.tilt, END.tilt, e),
    roll: lerp(START.roll, END.roll, e),
    // Squared: cards stay small for the first half, then swell as the camera drops in.
    scale: lerp(START.scale, END.scale, e * e) * f,
    lift: lerp(START.lift, END.lift, e) * f,
  };
}

/**
 * Position of one card. Undealt cards wait stacked at the front (-180)
 * and swing out to their real angle, staggered by how far around the ring they live.
 */
export function reelPose(angle, formation, scene) {
  const around = ((angle + 180) % 360 + 360) % 360; // 0..360, 0 = front
  const order = around / 360;
  const t = clamp01((formation - order * (1 - DEAL)) / DEAL);
  const dealt = 1 - (1 - t) ** 3; // ease-out cubic
  const placed = -180 + around * dealt;
  const r = (placed * Math.PI) / 180;
  const radius = scene.radius - (1 - dealt) * order * 24; // the waiting stack reads as one card
  const x = -Math.sin(r) * radius;
  const z = -Math.cos(r) * radius;
  return {
    x,
    y: 0,
    z,
    yaw: placed,
    appear: Math.min(1, t * 2.5),
    // Anything this close to (or past) the camera would blow up; hide it.
    behindCamera: z > scene.perspective - 120,
  };
}
