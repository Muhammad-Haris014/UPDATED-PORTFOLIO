// WhatsApp send sequence for the contact form, after the "thinking orb" pattern.
// The submit button morphs into a ball and flies to the middle of the (now dark) form card,
// assembles into a rotating sphere of dots, "thinks" while labels cycle, sweeps WhatsApp green,
// condenses into a check and unfolds into a card with the message and an "Open WhatsApp" link.
// WhatsApp opens from that link, a real click, so browsers never block the new tab.

/* ───────────── maths + easing (pure, tested) ───────────── */

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Quadratic Bézier between p0 and p2 through control c. */
export const bez = (t, p0, c, p2) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p2;

export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

export const E = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  fly: cubicBezier(0.5, 0, 0.1, 1),
  grow: cubicBezier(0.3, 0, 0.2, 1),
  vortex: cubicBezier(0.6, 0, 0.2, 1),
  spring: cubicBezier(0.34, 1.4, 0.64, 1),
  card: cubicBezier(0.65, 0, 0.2, 1),
  lin: (t) => t,
};

/** A channel animates from → to between t0 and t1 (ms). */
export const T = (ch, from, to, t0, t1, ease = E.io) => ({ ch, from, to, t0, t1, ease });

/** Value of every channel at time t, given tracks in order (later tracks on a channel win once started). */
export function sampleTracks(tracks, t) {
  const out = {};
  for (const k of tracks) {
    if (t < k.t0) continue;
    const p = Math.min(1, (t - k.t0) / Math.max(1, k.t1 - k.t0));
    out[k.ch] = k.from + (k.to - k.from) * k.ease(p);
  }
  return out;
}
export const tracksEnd = (tracks) => tracks.reduce((m, k) => Math.max(m, k.t1), 0);

/** The message the form sends, and the short preview the result card shows. */
export function buildMessage({ name, email, subject, message }) {
  return `Hi Haris, I'm ${name} (${email}).\n\n*${subject}*\n${message}`;
}
export function previewWords({ subject, message }, max = 22) {
  const words = `${subject} — ${message}`.split(/\s+/).filter(Boolean);
  return words.length > max ? [...words.slice(0, max), '…'] : words;
}

/* ───────────── geometry ───────────── */

const BALL = 56, ORB_D = 132, ORB_R = 66, FLY_D = 138, CANVAS = 220, CARD_H = 212;

/* ───────────── dotted orb ───────────── */

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
const RINGS = 16;
const DOTS = (() => {
  const rand = mulberry32(7);
  const out = [];
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2;
    const r = Math.sqrt(1 - y * y);
    const m = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU + k * 0.35;
      out.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u: (1 - y) / 2, seed: rand() * TAU });
    }
  }
  return out;
})();
const N = DOTS.length;
const DX = Float32Array.from(DOTS, (d) => d.x), DY = Float32Array.from(DOTS, (d) => d.y);
const DZ = Float32Array.from(DOTS, (d) => d.z), DU = Float32Array.from(DOTS, (d) => d.u);
const DS = Float32Array.from(DOTS, (d) => d.seed);

// Dots go from warm paper to WhatsApp green as the sweep passes them.
const G_STEPS = 24, A_STEPS = 48;
const COLORS = (() => {
  const out = [];
  for (let gi = 0; gi <= G_STEPS; gi++) {
    const g = gi / G_STEPS;
    const r = Math.round(lerp(244, 37, g)), gg = Math.round(lerp(238, 211, g)), b = Math.round(lerp(228, 102, g));
    for (let ai = 0; ai <= A_STEPS; ai++) out.push(`rgba(${r},${gg},${b},${(ai / A_STEPS).toFixed(3)})`);
  }
  return out;
})();
const ORB_KEYS = ['k', 'alpha', 'spin', 'sweep', 'pop', 'vortex', 'gain', 'floor', 'rad'];

function createOrb(canvas, reduced) {
  const P = {};
  const ctx = canvas.getContext('2d');
  const lit = new Float32Array(N);
  const SX = new Float32Array(N), SY = new Float32Array(N), SR = new Float32Array(N), SD = new Float32Array(N);
  const SC = new Int16Array(N);
  const pw = [1, 0, 0, 0];
  let time = 0, raf = 0, last = 0;

  const reset = () => {
    Object.assign(P, { k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1, vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0 });
    lit.fill(0);
    pw.splice(0, 4, 1, 0, 0, 0);
    time = reduced ? 1.2 : 0;
  };
  reset();
  if (!ctx) return { P, ensure() {}, reset };

  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(CANVAS * dpr);
  canvas.height = Math.round(CANVAS * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const S = 0.6, CP = Math.cos(0.35), SP = Math.sin(0.35), C0 = CANVAS / 2;

  const draw = (dt) => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    time += dt;
    P.rot += P.spin * dt;
    const yaw = P.rot + P.vortex, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const stepW = dt / 0.35;
    for (let q = 0; q < 4; q++) {
      const d = (q === P.prog ? 1 : 0) - pw[q];
      pw[q] += Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW;
    }
    const decay = Math.exp(-dt / 0.5);
    const h0 = (time * 300) % N, h3 = (time * 480) % N;
    const a1 = time * 0.8, b1 = Math.sin(time * 0.5) * 0.9;
    const f1x = Math.cos(b1) * Math.cos(a1), f1y = Math.sin(b1), f1z = Math.cos(b1) * Math.sin(a1);
    const a2 = time * 0.55 + 2.1, b2 = Math.cos(time * 0.42) * 0.9;
    const f2x = Math.cos(b2) * Math.cos(a2), f2y = Math.sin(b2), f2z = Math.cos(b2) * Math.sin(a2);
    const lat = Math.sin(time * 2.2);
    const swirlK = P.vortex * 1.5;

    for (let n = 0; n < N; n++) {
      const dx = DX[n], dy = DY[n], dz = DZ[n], u = DU[n];
      // Four light programs take turns while it thinks: a chase, two spotlights, a scan line, a fast chase.
      let pulse = 0;
      if (pw[0] > 0.001) { let dd = Math.abs(n - h0); if (dd > N - dd) dd = N - dd; const v = Math.max(0, 1 - dd / 16); pulse = Math.max(pulse, v * v * pw[0]); }
      if (pw[1] > 0.001) {
        const v = Math.max(Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28), Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28));
        pulse = Math.max(pulse, v * v * pw[1]);
      }
      if (pw[2] > 0.001) { const e = dy - lat; const v = Math.max(0, 1 - (e * e) / 0.02); pulse = Math.max(pulse, v * v * pw[2]); }
      if (pw[3] > 0.001) { let dd = Math.abs(n - h3); if (dd > N - dd) dd = N - dd; const v = Math.max(0, 1 - dd / 22); pulse = Math.max(pulse, v * v * pw[3]); }
      const l = Math.max(lit[n] * decay, pulse * P.gain);
      lit[n] = l;

      // Top dots appear first; on the way out the bottom collapses first.
      const ki = clamp01(P.k * (1 + S) - S * u);
      if (ki <= 0.001) { SC[n] = -1; continue; }
      const eo = E.out(ki), kk = eo * P.pop;
      const x1 = dx * cyw + dz * syw, z1 = -dx * syw + dz * cyw;
      const y2 = dy * CP - z1 * SP, z2 = dy * SP + z1 * CP;
      const f = 2.8 / (2.8 - z2), depth = (z2 + 1) / 2;
      let ox = x1 * ORB_R * kk * f, oy = -y2 * ORB_R * kk * f;
      if (swirlK > 0.001) {
        const sw = (1 - ki) * swirlK, cc = Math.cos(sw), ss = Math.sin(sw);
        const tx = ox * cc - oy * ss;
        oy = ox * ss + oy * cc;
        ox = tx;
      }
      const g = clamp01((P.sweep * 1.4 - u) / 0.4);
      let a = 0.1 + 0.035 * Math.sin(DS[n] + time * 1.6) * (1 - g) + 0.32 * depth * depth + 0.75 * l * (1 - g) + g * (0.55 + 0.4 * depth) + 2 * g * (1 - g);
      a = Math.max(a, P.floor * (0.7 + 0.3 * depth));
      if (a > 1) a = 1;
      a *= eo * P.alpha;
      SX[n] = C0 + ox; SY[n] = C0 + oy; SD[n] = depth;
      SR[n] = (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l + g * 0.25) * (1 + P.rad) * (0.4 + 0.6 * eo);
      const ai = Math.round(a * A_STEPS), gi = Math.round(g * G_STEPS);
      SC[n] = ai <= 0 ? -1 : gi * (A_STEPS + 1) + ai;
    }
    // Back half first, then the front half over it.
    for (let pass = 0; pass < 2; pass++) {
      for (let n = 0; n < N; n++) {
        const c = SC[n];
        if (c < 0 || (SD[n] >= 0.5) !== (pass === 1)) continue;
        ctx.fillStyle = COLORS[c];
        ctx.beginPath();
        ctx.arc(SX[n], SY[n], SR[n], 0, TAU);
        ctx.fill();
      }
    }
  };
  const frame = (now) => {
    raf = 0;
    const dt = reduced ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    draw(dt);
    if (P.alpha > 0.002) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, CANVAS, CANVAS);
  };
  const ensure = () => {
    if (raf || P.alpha <= 0.002) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  return { P, ensure, reset };
}

/* ───────────── async helpers ───────────── */

const ABORT = Symbol('abort');
const sleep = (ms, sig) => new Promise((res) => {
  if (sig.aborted) return res();
  const id = setTimeout(res, Math.max(0, ms));
  sig.addEventListener('abort', () => { clearTimeout(id); res(); }, { once: true });
});

/* ───────────── the sequence ───────────── */

const LABELS = ['Reading your note', 'Tidying it up', 'Drafting the message', 'Preparing WhatsApp'];
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

export function mountWhatsAppOrb(form, { phone, minThinkMs = 2400 }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const submit = form.querySelector('button[type="submit"]');
  const fields = [...form.children];

  const stage = document.createElement('div');
  stage.className = 'wa-stage';
  stage.innerHTML = `
    <div class="wa-mover">
      ${'<span class="wa-trail" aria-hidden="true"></span>'.repeat(6)}
      <div class="wa-actor">
        <div class="wa-ball" aria-hidden="true"><span class="wa-ball-label">${submit.textContent.trim()}</span></div>
        <canvas class="wa-orb" aria-hidden="true"></canvas>
        <div class="wa-green" aria-hidden="true">${CHECK}</div>
        <div class="wa-pulse" aria-hidden="true"></div>
        <div class="wa-card" role="group" aria-label="Message ready" tabindex="-1">
          <div class="wa-card-head"><i class="wa-dot" aria-hidden="true"></i><span>Message ready</span></div>
          <p class="wa-card-body"></p>
          <div class="wa-card-actions">
            <a class="wa-open" target="_blank" rel="noopener">Open WhatsApp ↗</a>
            <button type="button" class="wa-edit">Edit</button>
          </div>
        </div>
      </div>
    </div>
    <div class="wa-status" aria-hidden="true"><span class="wa-lab"></span></div>
    <div class="sr-only" role="status" aria-live="polite"></div>`;
  form.appendChild(stage);

  const $ = (s) => stage.querySelector(s);
  const mover = $('.wa-mover'), actor = $('.wa-actor'), statusEl = $('.wa-status'), lab = $('.wa-lab');
  const pulseEl = $('.wa-pulse'), card = $('.wa-card'), body = $('.wa-card-body');
  const openLink = $('.wa-open'), editBtn = $('.wa-edit'), live = stage.querySelector('[role="status"]');
  const ghosts = [...stage.querySelectorAll('.wa-trail')];
  const orb = createOrb($('.wa-orb'), reduced);

  // Channels: each name maps to one DOM write. Values are batched and flushed once per frame.
  const vals = {};
  const CH = {};
  ['oBall', 'oHot', 'oLabel', 'oGreen', 'gs', 'oCard', 'hOp', 'dotS'].forEach((n) => { CH[n] = (v) => actor.style.setProperty('--' + n, v.toFixed(4)); });
  ['w', 'h', 'r'].forEach((n) => { CH[n] = (v) => actor.style.setProperty('--' + n, v.toFixed(2) + 'px'); });
  CH.fOp = (v) => form.style.setProperty('--fOp', v.toFixed(4));
  CH.sOp = (v) => statusEl.style.setProperty('--sOp', v.toFixed(4));
  CH.sTy = (v) => statusEl.style.setProperty('--sTy', v.toFixed(2) + 'px');
  CH.pulse = (v) => {
    if (v < 0) { pulseEl.style.opacity = '0'; return; }
    pulseEl.style.opacity = (0.5 * (1 - v)).toFixed(3);
    pulseEl.style.transform = `scale(${(1 + v).toFixed(3)})`;
  };
  ORB_KEYS.forEach((n) => { CH['orb.' + n] = (v) => { orb.P[n] = v; if (n === 'alpha') orb.ensure(); }; });

  // The flight: a curve from the button to the centre, with a comet trail of fading ghosts.
  const path = { x0: 0, y0: 0, dir: 1 };
  const hist = [];
  let curX = 0, curY = 0, trail = 0;
  const applyPath = (u) => {
    curX = bez(u, path.x0, path.x0 * 0.4 + path.dir * Math.abs(path.y0) * 0.45, 0);
    curY = bez(u, path.y0, path.y0 * 0.15, 0);
    mover.style.transform = `translate3d(${curX.toFixed(2)}px,${curY.toFixed(2)}px,0)`;
    const now = performance.now();
    hist.push({ t: now, x: curX, y: curY, d: vals.w ?? BALL });
    while (hist.length > 2 && hist[0].t < now - 500) hist.shift();
    renderTrail(now);
  };
  const at = (t) => {
    for (let i = hist.length - 1; i > 0; i--) {
      const a = hist[i - 1], b = hist[i];
      if (t >= a.t) { const k = Math.min(1, (t - a.t) / (b.t - a.t || 1)); return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), d: lerp(a.d, b.d, k) }; }
    }
    return hist[0] || { x: 0, y: 0, d: 0 };
  };
  const renderTrail = (now = performance.now()) => {
    ghosts.forEach((g, i) => {
      if (trail <= 0.001) { g.style.opacity = '0'; return; }
      const s = at(now - (i + 1) * 45);
      g.style.transform = `translate3d(${(s.x - curX).toFixed(2)}px,${(s.y - curY).toFixed(2)}px,0) translate(-50%,-50%) scale(${((s.d * (1 - 0.08 * (i + 1))) / 100).toFixed(3)})`;
      g.style.opacity = (0.3 * Math.pow(1 - i / 6, 1.5) * trail).toFixed(3);
    });
  };
  CH.u = (v) => applyPath(v);
  CH.trail = (v) => { trail = v; renderTrail(); };
  CH.wp = (v) => {
    const words = body.querySelectorAll('.wa-w');
    const stagger = words.length > 1 ? Math.min(40, 300 / (words.length - 1)) : 0;
    const time = v * ((words.length - 1) * stagger + 320);
    words.forEach((el, i) => {
      const p = E.out(clamp01((time - i * stagger) / 320));
      el.style.opacity = p.toFixed(3);
      el.style.filter = p > 0.999 || reduced ? 'none' : `blur(${((1 - p) * 4).toFixed(2)}px)`;
      el.style.transform = p > 0.999 || reduced ? 'none' : `translateY(${((1 - p) * 4).toFixed(2)}px)`;
    });
  };

  const setNow = (ch, v) => { vals[ch] = v; CH[ch]?.(v); };
  const play = (tracks, sig) => new Promise((res) => {
    if (sig.aborted) return res();
    const end = tracksEnd(tracks);
    let t = 0, last = performance.now(), raf = 0;
    const stop = () => { cancelAnimationFrame(raf); res(); };
    sig.addEventListener('abort', stop, { once: true });
    const step = (now) => {
      t += Math.min(100, now - last);
      last = now;
      const v = sampleTracks(tracks, t);
      for (const ch in v) setNow(ch, v[ch]);
      if (t >= end) { sig.removeEventListener('abort', stop); res(); } else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });

  const INIT = { oBall: 0, oHot: 0, oLabel: 1, oGreen: 0, gs: 0.55, oCard: 0, hOp: 0, dotS: 0, fOp: 1, sOp: 0, sTy: 6, pulse: -1, trail: 0, wp: 0, r: 999,
    'orb.k': 0, 'orb.alpha': 0, 'orb.spin': 0, 'orb.pop': 1, 'orb.sweep': 0, 'orb.vortex': 0, 'orb.gain': 1, 'orb.floor': 0, 'orb.rad': 0 };
  const resetAll = () => { orb.reset(); hist.length = 0; for (const ch in INIT) setNow(ch, INIT[ch]); };

  let labelI = 0;
  const swapLabel = (text, done = false) => {
    lab.classList.toggle('is-done', done);
    if (reduced) { lab.textContent = text; return; }
    lab.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 160, easing: 'ease-in' }).finished.then(() => {
      lab.textContent = text;
      lab.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    }, () => {});
  };

  let current = null, phase = 'idle';
  const setPhase = (p) => { phase = p; form.dataset.phase = p; };
  const lockFields = (on) => fields.forEach((el) => { el.inert = on; });

  async function run(data, sig) {
    const go = async (tracks) => { await play(tracks, sig); if (sig.aborted) throw ABORT; };
    const f = form.getBoundingClientRect(), b = submit.getBoundingClientRect(), m = stage.getBoundingClientRect();
    const originX = m.left + m.width / 2, originY = m.top + m.height * 0.44;
    path.x0 = b.left + b.width / 2 - originX;
    path.y0 = b.top + b.height / 2 - originY;
    path.dir = -path.dir;
    const cw = Math.min(360, f.width - 40);
    const bw = b.width, bh = b.height;

    body.innerHTML = previewWords(data).map((w) => `<span class="wa-w">${w.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</span>`).join(' ');
    openLink.href = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(data))}`;
    labelI = 0;
    lab.textContent = LABELS[0];
    lab.classList.remove('is-done');

    // Launch: the button becomes a pill on the stage, shrinks to a hot ball and flies to the centre.
    setPhase('launch');
    form.classList.add('is-sending');
    setNow('w', bw); setNow('h', bh); setNow('u', 0); setNow('oBall', 1);
    if (!reduced) {
      await go([
        T('fOp', 1, 0, 0, 320, E.out),
        T('oLabel', 1, 0, 0, 160, E.in),
        T('w', bw, bw - 12, 0, 100, E.out),
        T('w', bw - 12, BALL, 100, 520, E.io),
        T('h', bh, BALL, 100, 520, E.io),
        T('oHot', 0, 1, 120, 520, E.out),
        T('u', 0, 1, 560, 1400, E.fly),
        T('w', BALL, FLY_D, 560, 1200, E.grow),
        T('h', BALL, FLY_D, 560, 1200, E.grow),
        T('w', FLY_D, ORB_D, 1200, 1400, E.out),
        T('h', FLY_D, ORB_D, 1200, 1400, E.out),
        T('trail', 0, 1, 620, 720, E.out),
        T('trail', 1, 0, 1200, 1400, E.in),
      ]);
      setPhase('assemble');
      await go([
        T('oBall', 1, 0, 0, 260, E.out),
        T('orb.k', 0, 1, 0, 800, E.out),
        T('orb.alpha', 0, 1, 0, 800, E.out),
        T('orb.spin', 0, 0.9, 0, 800, E.out),
        T('orb.pop', 1, 1.05, 0, 420, E.out),
        T('orb.pop', 1.05, 1, 420, 800, E.io),
        T('sOp', 0, 1, 300, 620, E.out),
        T('sTy', 6, 0, 300, 620, E.out),
      ]);
    } else {
      setNow('u', 1); setNow('w', ORB_D); setNow('h', ORB_D); setNow('orb.k', 1); setNow('sTy', 0);
      await go([T('fOp', 1, 0, 0, 200, E.out), T('oBall', 1, 0, 0, 200, E.out), T('orb.alpha', 0, 1, 0, 200, E.out), T('sOp', 0, 1, 0, 200, E.out)]);
    }

    // Think: the light programs and labels take turns for a moment.
    setPhase('think');
    live.textContent = 'Preparing your WhatsApp message';
    const t0 = performance.now();
    const think = reduced ? 600 : minThinkMs;
    while (performance.now() - t0 < think - 100) {
      await sleep(Math.min(1000, think - (performance.now() - t0)), sig);
      if (sig.aborted) throw ABORT;
      if (performance.now() - t0 >= think - 100) break;
      labelI = (labelI + 1) % LABELS.length;
      orb.P.prog = labelI % 4;
      swapLabel(LABELS[labelI]);
    }

    // Resolve → condense → unfold.
    const n = previewWords(data).length;
    const wordsMs = (n - 1) * (n > 1 ? Math.min(40, 300 / (n - 1)) : 0) + 320;
    setPhase('resolve');
    swapLabel('Ready', true);
    if (!reduced) {
      await go([
        T('orb.sweep', 0, 1, 0, 700, E.io), T('orb.spin', 0.9, 0.3, 0, 700, E.out), T('orb.gain', 1, 0, 0, 700, E.out),
        T('orb.floor', 0, 0.95, 400, 900, E.out), T('orb.rad', 0, 0.15, 400, 900, E.out),
        T('orb.pop', 1, 1.04, 600, 800, E.out), T('orb.pop', 1.04, 1, 800, 900, E.out),
      ]);
      setPhase('condense');
      await go([
        T('orb.pop', 1, 1.06, 0, 120, E.out), T('sOp', 1, 0, 0, 160, E.in), T('sTy', 0, -6, 0, 160, E.in),
        T('orb.k', 1, 0, 120, 640, E.vortex), T('orb.vortex', 0, 1.6, 120, 640, E.vortex),
        T('oGreen', 0, 1, 260, 700, E.spring), T('gs', 0.55, 1, 260, 700, E.spring),
        T('pulse', 0, 1, 320, 760, E.out), T('orb.alpha', 1, 0, 500, 800, E.out),
      ]);
      setPhase('unfold');
      await go([
        T('w', ORB_D, 124, 0, 90, E.in), T('h', ORB_D, 124, 0, 90, E.in),
        T('w', 124, cw, 90, 700, E.card), T('h', 124, CARD_H, 90, 700, E.out), T('r', ORB_D / 2, 20, 90, 700, E.io),
        T('oGreen', 1, 0, 200, 560, E.out), T('oCard', 0, 1, 200, 560, E.out),
        T('hOp', 0, 1, 520, 840, E.out), T('dotS', 0, 1, 520, 840, E.spring),
        T('wp', 0, 1, 600, 600 + wordsMs, E.lin),
      ]);
    } else {
      setNow('r', ORB_D / 2);
      await go([T('orb.sweep', 0, 1, 0, 250, E.io), T('orb.floor', 0, 0.95, 0, 250, E.out)]);
      await go([T('oGreen', 0, 1, 0, 250, E.out), T('orb.alpha', 1, 0, 0, 250, E.out), T('sOp', 1, 0, 0, 250, E.out)]);
      setNow('w', cw); setNow('h', CARD_H); setNow('r', 20); setNow('dotS', 1); setNow('gs', 1);
      await go([T('oGreen', 1, 0, 0, 120, E.out), T('oCard', 0, 1, 0, 250, E.out), T('hOp', 0, 1, 0, 250, E.out), T('wp', 0, 1, 0, 250, E.lin)]);
    }
    setPhase('answered');
    live.textContent = 'Message ready. Open WhatsApp to send it.';
    openLink.focus({ preventScroll: true });
  }

  // Back to the form: everything fades, the form returns (with its text, unless it was sent).
  async function toIdle({ clear = false } = {}) {
    current?.abort();
    const ac = new AbortController();
    current = ac;
    setPhase('reset');
    const fade = ['oBall', 'oGreen', 'oCard', 'sOp', 'orb.alpha', 'trail', 'hOp'].filter((c) => (vals[c] ?? 0) > 0.001).map((c) => T(c, vals[c], 0, 0, 220, E.out));
    await play(fade, ac.signal);
    if (ac.signal.aborted) return;
    if (clear) form.reset();
    resetAll();
    setNow('fOp', 0);
    form.classList.remove('is-sending');
    lockFields(false);
    await play([T('fOp', 0, 1, 0, reduced ? 1 : 420, E.out)], ac.signal);
    current = null;
    setPhase('idle');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (phase !== 'idle') return;
    const fd = new FormData(form);
    const data = Object.fromEntries(['name', 'email', 'subject', 'message'].map((k) => [k, String(fd.get(k) || '').trim()]));
    lockFields(true);
    const ac = new AbortController();
    current = ac;
    resetAll();
    run(data, ac.signal).catch((err) => { if (err !== ABORT) toIdle(); });
  });
  editBtn.addEventListener('click', () => { if (phase === 'answered') toIdle(); });
  // Once WhatsApp has opened, start fresh behind it.
  openLink.addEventListener('click', () => setTimeout(() => toIdle({ clear: true }), 700));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !['idle', 'reset'].includes(phase)) { e.preventDefault(); toIdle(); }
  });

  resetAll();
  setPhase('idle');
}
