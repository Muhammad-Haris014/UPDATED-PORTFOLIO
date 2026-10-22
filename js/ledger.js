// Experience ledger. Every place is a huge right-aligned wordmark with its years in italics;
// a row opens in place to show the role and the story. Point at a row and a wash of pigment
// blooms behind its wordmark, then drifts after the pointer with a little lag; its edges are
// ragged and darker, like watercolour settling into paper. The wash comes from the history:
// a longer tenure paints a longer stroke, and a role that ended longer ago has drier pigment.
// Each row paints on its own small canvas: no WebGL, no images.

/* ───────────── logic (pure, tested) ───────────── */

export const PALETTES = {
  ember: ['#f2266f', '#ff7417', '#ffcf33'],
  tide: ['#08706c', '#17b09c', '#c3ee8a'],
  moss: ['#4b6b17', '#93bb27', '#ece07a'],
  mono: ['#1b2027', '#535c68', '#c5cbd3'],
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(v)) return [0, 0, 0];
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
/** Pigment colour at t: 0 is the thin edge, 1 the dense core. */
export function rampAt(edge, body, core, t) {
  const u = clamp(t, 0, 1);
  const a = u < 0.5 ? edge : body, b = u < 0.5 ? body : core;
  const k = u < 0.5 ? u * 2 : (u - 0.5) * 2;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
/** Opening the open row closes it; anything else opens that row. */
export const nextOpen = (current, index) => (current === index ? null : index);
/** Font size that fits textWidth (measured at base) into avail, never below min. */
export function fitFont(base, textWidth, avail, min = 18) {
  if (!(textWidth > 0) || textWidth <= avail) return base;
  return Math.max(min, Math.floor(((base * avail) / textWidth) * 100) / 100);
}
export function luminance(r, g, b) {
  const f = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** Deterministic 0..1 hash of an integer lattice point. */
export function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise, 0..1. */
export function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** The years a role spans, from "2019-2022", "2022-now" or "2021". */
export function tenureOf(years, now) {
  const m = years.match(/(\d{4})\D+(\d{4}|now|present|current|today)/i);
  if (m) {
    const start = Number(m[1]);
    const end = /^\d{4}$/.test(m[2]) ? Number(m[2]) : now;
    return { start, end, length: Math.max(0.5, end - start) };
  }
  const one = years.match(/\d{4}/);
  if (!one) return null;
  const y = Number(one[0]);
  return { start: y, end: y, length: 0.5 };
}
/** How far a stroke reaches, as a share of its wordmark's width. */
export const reachOf = (length) => clamp(0.34 + length * 0.07, 0.38, 0.7);
/** How dry the pigment looks: 0 for a current role, up to 0.6 for one long over. */
export const drynessOf = (end, now) => clamp((now - end) / 12, 0, 0.6);

/* ───────────── pigment ───────────── */

const BLEED = 64;      // the canvas reaches past its row above and below, so the wash fades on its own
const BLEED_X = 40;    // ...and to each side, so a flush-right wordmark never cuts it
const MAX_BUFFER_W = 600;

function makeBlobs(seed) {
  const r = (i) => hash2(i, 7, seed);
  return Array.from({ length: 7 }, (_, i) => ({
    ox: -1 + (2 * i) / 6 + (r(i) - 0.5) * 0.22,
    oy: (r(i + 20) - 0.5) * 0.9,
    r: 0.72 + r(i + 40) * 0.36 - Math.abs(i - 3) * 0.05,
    w: 0.8 + r(i + 60) * 0.45 + (i === 3 ? 0.25 : 0),
    ph: r(i + 80) * 6.28,
    sp: 0.18 + r(i + 100) * 0.34,
  }));
}

function newSmear(seed) {
  return {
    canvas: null, ctx: null, img: null,
    noise: new Float32Array(0), hue: new Float32Array(0), grain: new Float32Array(0), low: new Float32Array(0),
    bw: 0, bh: 0, cssW: 0, cssH: 0, headH: 0, homeX: 0, homeY: 0, bleedX: BLEED_X,
    nameW: 0, nameTop: 0, nameH: 0, reach: 0.5, dry: 0, dim: 1, dimTarget: 1, lastActive: 0,
    ramp: [], level: 0, target: 0, cx: 0, cy: 0, tx: 0, ty: 0, pointer: false,
    blobs: makeBlobs(seed), seed, painted: false,
  };
}

/** Where the wash rests when nothing points at it: centred on the wordmark. */
const homeOf = (s) => [s.homeX ? s.bleedX + s.homeX : s.cssW * 0.6, BLEED + (s.homeY || s.headH * 0.5)];

// Size the pigment buffer to the row (plus bleed). Noise is hashed from buffer coordinates,
// so the paper texture stays put while a row opens.
function sizeSmear(s, w, h, headH) {
  s.cssW = w + s.bleedX * 2;
  s.cssH = h + BLEED * 2;
  s.headH = headH || h;
  if (!s.canvas) return;
  const scale = clamp(s.cssW / MAX_BUFFER_W, 1.5, 3);
  const bw = Math.max(8, Math.round(s.cssW / scale));
  const bh = Math.max(8, Math.round((s.cssH / s.cssW) * bw));
  s.canvas.style.left = -s.bleedX + 'px';
  s.canvas.style.width = `calc(100% + ${s.bleedX * 2}px)`;
  if (bw === s.bw && bh === s.bh && s.img) return;
  s.bw = bw; s.bh = bh;
  s.canvas.width = bw; s.canvas.height = bh;
  s.ctx = s.canvas.getContext('2d');
  s.img = s.ctx ? s.ctx.createImageData(bw, bh) : null;
  const n = bw * bh;
  s.noise = new Float32Array(n); s.hue = new Float32Array(n); s.low = new Float32Array(n); s.grain = new Float32Array(n);
  const u = scale / 3; // keep the texture the same size in css px at any buffer scale
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x, X = x * u, Y = y * u;
      s.noise[i] = 0.55 * valueNoise(X / 11, Y / 8, s.seed) + 0.3 * valueNoise(X / 4, Y / 4, s.seed + 11) + 0.15 * valueNoise(X / 1.6, Y / 1.6, s.seed + 17);
      s.hue[i] = valueNoise((0.8 * X + 0.6 * Y) / 20, (0.8 * Y - 0.6 * X) / 20, s.seed + 31); // rotated lattice: no scanlines
      s.low[i] = valueNoise(X / 40, Y / 40, s.seed + 41);
      s.grain[i] = hash2(x, y, s.seed + 23);
    }
  }
  s.painted = false;
}

function paintSmear(s, time, ramp, strength, dark, faint = false) {
  const ctx = s.ctx, img = s.img;
  if (!ctx || !img || ramp.length < 3) return;
  const data = img.data;
  data.fill(0);
  const level = s.level;
  if (level > 0.002) {
    const bw = s.bw, bh = s.bh, sc = s.cssW / bw;
    const grow = 1 - Math.pow(1 - clamp(level, 0, 1), 3);
    const narrow = s.cssW < 560;
    // The masses spread across the wordmark and always overlap: one body of pigment, not islands.
    const span = clamp((s.nameW || s.cssW * 0.3) * s.reach, 60, 320) * (0.5 + 0.5 * grow);
    const R = clamp(s.headH * (narrow ? 0.95 : 1.12), 70, 200) * (0.55 + 0.45 * grow);
    const dry = s.dry;
    // On paper age fades and greys pigment; on a dark surface that reads as mud, so there it only granulates more.
    const fade = smoothstep(0, 0.35, level) * strength * (1 - dry * (dark ? 0.08 : 0.45));
    const tooth = 0.76 + dry * 0.6;
    const [edge, body, core] = ramp;
    const n = s.blobs.length;
    const bx = new Float32Array(n), by = new Float32Array(n), br = new Float32Array(n);
    let x0 = bw, x1 = 0, y0 = bh, y1 = 0;
    const SQ = 1.65; // vertical squash: the wash runs along the row
    for (let k = 0; k < n; k++) {
      const b = s.blobs[k];
      const px = s.cx + b.ox * span + Math.sin(time * b.sp + b.ph) * R * 0.12;
      const py = s.cy + b.oy * R * 0.4 + Math.cos(time * b.sp * 0.8 + b.ph) * R * 0.06;
      const rr = (b.r * R) / sc;
      bx[k] = px / sc; by[k] = py / sc; br[k] = rr * rr;
      x0 = Math.min(x0, bx[k] - rr); x1 = Math.max(x1, bx[k] + rr);
      y0 = Math.min(y0, by[k] - rr / SQ); y1 = Math.max(y1, by[k] + rr / SQ);
    }
    const xs = Math.max(0, Math.floor(x0)), xe = Math.min(bw - 1, Math.ceil(x1));
    const ys = Math.max(0, Math.floor(y0)), ye = Math.min(bh - 1, Math.ceil(y1));
    // Keep the wash to the wordmark's band, with the same ragged edge as the rest, so small text never sits on pigment.
    const bandTop = s.nameH ? s.nameTop - s.nameH * 0.3 : 0;
    const bandBottom = s.nameH ? s.nameTop + s.nameH * 1.02 : s.headH - 6;
    const top = (BLEED + Math.max(0, bandTop)) / sc;
    const bottom = (BLEED + bandBottom) / sc;
    const feather = Math.min(36, (bandBottom - bandTop) * 0.4) / sc;
    const side = Math.max(s.bleedX - 4, 28) / sc;
    for (let y = ys; y <= ye; y++) {
      const env = smoothstep(top, top + feather, y) * (1 - smoothstep(bottom - feather, bottom, y));
      if (env <= 0) continue;
      for (let x = xs; x <= xe; x++) {
        let f = 0;
        for (let k = 0; k < n; k++) {
          const dx = x - bx[k], dy = (y - by[k]) * SQ, d2 = dx * dx + dy * dy;
          if (d2 < br[k]) { const q = 1 - d2 / br[k]; f += q * q * s.blobs[k].w; }
        }
        f *= env * smoothstep(0, side, x) * (1 - smoothstep(bw - 1 - side, bw - 1, x));
        if (f < 0.04) continue;
        const i = y * bw + x;
        // Paper tooth breaks the edge up; a slower noise varies its thickness so it never reads as an outline.
        const fe = f * (1 - tooth / 2 + tooth * s.noise[i]) + (s.low[i] - 0.5) * 0.24;
        const wash = dark ? smoothstep(0.2, 0.34, fe) : smoothstep(0.2, 0.6, fe);
        // Pigment collects at the drying edge: a denser tide line.
        const rim = smoothstep(0.2, 0.3, fe) * (1 - smoothstep(0.3, 0.5, fe));
        const depth = clamp(smoothstep(0.3, 1.55, fe) + (s.hue[i] - 0.5) * 0.6 + rim * (0.55 + dry * 0.4), 0, 1);
        const c = rampAt(edge, body, core, dark && faint ? 0.7 + depth * 0.3 : depth);
        if (dry > 0 && !dark) {
          const grey = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
          for (let q = 0; q < 3; q++) c[q] += (grey - c[q]) * dry * 0.15;
        }
        const g = s.grain[i];
        const shade = 1 - rim * (0.07 + dry * 0.2) + (g - 0.5) * 0.05;
        const a = (wash * (0.86 + 0.14 * depth) + rim * 0.1) * (0.9 + 0.1 * g * (1 + dry)) * fade;
        const j = i * 4;
        data[j] = c[0] * shade; data[j + 1] = c[1] * shade; data[j + 2] = c[2] * shade;
        data[j + 3] = a > 1 ? 255 : a * 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  s.painted = level > 0.002;
}

/** Whether the surface under `el` is dark, reading its real background through a 1px canvas. */
function surfaceIsDark(el) {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const g = probe.getContext('2d', { willReadFrequently: true });
  for (let node = el; node && g; node = node.parentElement) {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = '#000';
    g.fillStyle = getComputedStyle(node).backgroundColor;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    if (d[3] > 200) return luminance(d[0], d[1], d[2]) < 0.35;
  }
  return false;
}

/* ───────────── component ───────────── */

export function mountLedger(root, { palette = 'ember', strength = 0.82, residue = 0.2, ageing = true } = {}) {
  const rows = [...root.querySelectorAll('.pel-row')];
  const names = rows.map((li) => li.querySelector('.pel-name'));
  const smears = rows.map((_, i) => newSmear(i * 7919 + 101));
  const st = { raf: 0, last: 0, frame: 0, clock: 0, visible: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, dark: false };
  let openIndex = rows.findIndex((li) => li.dataset.open === 'true');
  if (openIndex < 0) openIndex = null;
  let hovered = null, focused = null;

  rows.forEach((li, i) => { smears[i].canvas = li.querySelector('.pel-ink'); });

  /* render the open / lit state into the DOM */
  const sync = () => {
    rows.forEach((li, i) => {
      const isOpen = i === openIndex;
      li.dataset.open = String(isOpen);
      li.dataset.lit = String(isOpen || i === hovered || i === focused);
      li.querySelector('.pel-trigger').setAttribute('aria-expanded', String(isOpen));
      const panel = li.querySelector('.pel-panel');
      panel.setAttribute('aria-hidden', String(!isOpen));
      panel.querySelectorAll('a').forEach((a) => { a.tabIndex = isOpen ? 0 : -1; });
    });
  };

  /* the paint loop: runs only while something is moving or breathing */
  const kick = () => {
    if (st.raf) return;
    const tick = (now) => {
      st.raf = 0;
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
      st.last = now;
      st.frame++;
      let alive = false, moving = false, breathing = false;
      for (const s of smears) {
        if (!s.ctx) continue;
        const prevLevel = s.level, prevX = s.cx, prevY = s.cy;
        if (st.reduced) {
          if (s.dim !== s.dimTarget) s.painted = false;
          s.dim = s.dimTarget; s.level = s.target; s.cx = s.tx; s.cy = s.ty;
        } else {
          const tau = s.target > s.level ? 0.3 : 0.2;
          s.level += (s.target - s.level) * (1 - Math.exp(-dt / tau));
          if (Math.abs(s.target - s.level) < 0.002) s.level = s.target;
          const prevDim = s.dim;
          s.dim += (s.dimTarget - s.dim) * (1 - Math.exp(-dt / 0.2));
          if (Math.abs(s.dimTarget - s.dim) < 0.002) s.dim = s.dimTarget;
          if (s.dim !== prevDim) s.painted = false;
          const k = 1 - Math.exp(-dt / 0.26);
          s.cx += (s.tx - s.cx) * k;
          s.cy += (s.ty - s.cy) * k;
        }
        const changed = Math.abs(s.level - prevLevel) > 1e-4 || Math.abs(s.cx - prevX) > 0.05 || Math.abs(s.cy - prevY) > 0.05;
        if (changed) moving = true;
        const active = s.level > 0.002 || s.target > 0;
        // A settled wash keeps breathing for a few seconds after the last activity, then holds its frame.
        const breathes = active && !st.reduced && now - s.lastActive < 3000;
        if (breathes) breathing = true;
        if (active) alive = true;
        if ((active || s.painted) && (changed || !s.painted || (breathes && st.frame % 2 === 0) || !active)) {
          paintSmear(s, st.clock, s.ramp, (st.dark ? Math.min(1, strength * 1.1) : strength) * s.dim, st.dark, s.dim < 0.6);
        }
      }
      if (breathing) st.clock += dt;
      if (st.visible && alive && (moving || breathing)) st.raf = requestAnimationFrame(tick);
      else st.last = 0;
    };
    st.raf = requestAnimationFrame(tick);
  };

  /* pigment colours: the preset, darkened at the pale end on a dark surface */
  const updateRamps = () => {
    st.dark = surfaceIsDark(root);
    const now = new Date().getFullYear();
    const base = (PALETTES[palette] || PALETTES.ember).map(hexToRgb);
    rows.forEach((li, i) => {
      const s = smears[i];
      s.ramp = st.dark ? [base[2].map((v, j) => v * 0.65 + base[1][j] * 0.35), base[1], base[0]] : [base[2], base[1], base[0]];
      const span = ageing ? tenureOf(li.dataset.years || '', now) : null;
      s.reach = span ? reachOf(span.length) : 0.5;
      s.dry = span ? drynessOf(span.end, now) : 0;
      s.painted = false;
    });
    kick();
  };

  /* targets: hovered, focused and open rows hold pigment; closed rows keep a faint dried residue */
  const updateTargets = () => {
    rows.forEach((_, i) => {
      const s = smears[i];
      const pointed = i === hovered || i === focused;
      const elsewhere = (hovered !== null && hovered !== i) || (focused !== null && focused !== i);
      const open = i === openIndex;
      const rest = Math.min(0.5, residue * (0.55 + s.dry * 0.75));
      const next = pointed || open ? 1 : residue > 0 ? 0.75 : 0;
      const dim = pointed ? 1 : open ? (elsewhere ? 0.22 : 1) : rest;
      if (next !== s.target || dim !== s.dimTarget) s.lastActive = performance.now();
      s.target = next;
      s.dimTarget = dim;
      if (!s.pointer) [s.tx, s.ty] = homeOf(s);
    });
    sync();
    kick();
  };

  /* sizes: rows feed the pigment buffers; the section width refits the wordmarks */
  const fit = () => names.forEach((el) => {
    if (!el?.parentElement) return;
    el.style.fontSize = '';
    const base = parseFloat(getComputedStyle(el).fontSize) || 64;
    const size = fitFont(base, el.scrollWidth, el.parentElement.clientWidth);
    if (size !== base) el.style.fontSize = size + 'px';
  });
  const sizeRow = (i) => {
    const li = rows[i], s = smears[i];
    const head = li.querySelector('.pel-trigger');
    const first = !s.cssW;
    s.bleedX = clamp(Math.floor(li.getBoundingClientRect().left - root.getBoundingClientRect().left) - 4, 0, BLEED_X);
    sizeSmear(s, li.clientWidth, li.offsetHeight, head ? head.offsetHeight : li.offsetHeight);
    const nm = names[i];
    if (nm) {
      const lr = li.getBoundingClientRect(), nr = nm.getBoundingClientRect();
      s.homeX = nr.left - lr.left + nr.width / 2;
      s.nameTop = nr.top - lr.top;
      s.nameH = nr.height;
      s.homeY = s.nameTop + nr.height * 0.5;
      s.nameW = nr.width;
    }
    if (first || !s.pointer) {
      [s.tx, s.ty] = homeOf(s);
      if (first) { s.cx = s.tx; s.cy = s.ty; }
    }
  };
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      if (e.target === root) { fit(); rows.forEach((_, i) => sizeRow(i)); }
      else { const i = rows.indexOf(e.target); if (i > -1) sizeRow(i); }
    }
    kick();
  });
  ro.observe(root);
  rows.forEach((li) => ro.observe(li));

  /* pointer: the wash leans toward the pointer but stays on the wordmark */
  const onMove = (i, e) => {
    if (e.pointerType === 'touch') return;
    const li = rows[i], s = smears[i];
    const r = li.getBoundingClientRect();
    const hx = homeOf(s)[0];
    const w = s.nameW || s.cssW * 0.3;
    s.tx = clamp(hx + (e.clientX - r.left + s.bleedX - hx) * 0.35, hx - w * 0.18, hx + w * 0.12);
    s.lastActive = performance.now();
    const y0 = s.nameH ? s.nameTop + s.nameH * 0.3 : s.headH * 0.35;
    const y1 = s.nameH ? s.nameTop + s.nameH * 0.7 : s.headH * 0.7;
    s.ty = BLEED + clamp(e.clientY - r.top, y0, y1);
    if (s.level < 0.05) { s.cx = s.tx; s.cy = s.ty; } // a fresh bloom starts where the pointer came in
    s.pointer = true;
    kick();
  };

  rows.forEach((li, i) => {
    const btn = li.querySelector('.pel-trigger');
    li.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { hovered = i; updateTargets(); } onMove(i, e); });
    li.addEventListener('pointermove', (e) => onMove(i, e));
    li.addEventListener('pointerleave', () => {
      const s = smears[i];
      s.pointer = false;
      [s.tx, s.ty] = homeOf(s);
      if (hovered === i) { hovered = null; updateTargets(); }
    });
    btn.addEventListener('click', () => {
      const s = smears[i];
      s.pointer = false;
      [s.tx, s.ty] = homeOf(s); // a click hands the wash back to its wordmark
      openIndex = nextOpen(openIndex, i);
      updateTargets();
    });
    btn.addEventListener('focus', () => {
      if (!btn.matches(':focus-visible')) return;
      smears[i].lastActive = performance.now();
      focused = i;
      updateTargets();
    });
    btn.addEventListener('blur', () => { if (focused === i) { focused = null; updateTargets(); } });
  });

  /* pause off screen and in background tabs; play the entrance once */
  if (!st.reduced) {
    root.dataset.enter = 'pending';
    rows.forEach((li, i) => li.style.setProperty('--i', i + 1));
    root.querySelector('.pel-foot')?.style.setProperty('--i', rows.length + 1);
  }
  new IntersectionObserver(([e]) => {
    st.visible = e.isIntersecting;
    if (e.isIntersecting) { root.dataset.enter = 'done'; kick(); }
  }, { threshold: 0.05 }).observe(root);
  document.addEventListener('visibilitychange', () => {
    st.visible = document.visibilityState === 'visible';
    if (st.visible) kick();
  });

  fit();
  rows.forEach((_, i) => sizeRow(i));
  document.fonts?.ready.then(() => { fit(); rows.forEach((_, i) => sizeRow(i)); kick(); });
  updateRamps();
  updateTargets();
}
