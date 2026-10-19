// Contribution skyline: a year of GitHub activity as a heat map that folds up into an isometric
// skyline. One scene, one camera: switching views swings the camera from straight down to the
// corner while each week's bars rise in a wave from the oldest week to the newest.
import {
  lerp, easeInOutCubic, smoothstep, dayMs, buildGrid, computeStats, monthLabels, barHeight,
  riseAt, YAW_3D, ELEV_3D, YAW_RANGE, ELEV_RANGE, camera, project, mixRGB, luminance,
} from './skyline-core.js';

const FG_FALLBACK = [23, 23, 23];
const BG_FALLBACK = [255, 255, 255];

// Any CSS colour → sRGB, by letting the browser paint it.
let probe = null;
const toRGB = (color, fallback) => {
  if (!probe) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    probe = c.getContext('2d', { willReadFrequently: true });
  }
  if (!probe) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = 'rgba(0,0,0,0)';
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return d[3] < 8 ? fallback : [d[0], d[1], d[2]];
};
const rgbString = (r, g, b) => 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';

const pointInQuad = (p, o, x, y) => {
  let sign = 0;
  for (let k = 0; k < 4; k++) {
    const ax = p[o + k * 2], ay = p[o + k * 2 + 1];
    const bx = p[o + ((k + 1) % 4) * 2], by = p[o + ((k + 1) % 4) * 2 + 1];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
};

const quadPath = (ctx, p, o, r) => {
  if (r < 0.3) {
    ctx.moveTo(p[o], p[o + 1]);
    ctx.lineTo(p[o + 2], p[o + 3]);
    ctx.lineTo(p[o + 4], p[o + 5]);
    ctx.lineTo(p[o + 6], p[o + 7]);
    ctx.closePath();
    return;
  }
  ctx.moveTo((p[o + 6] + p[o]) / 2, (p[o + 7] + p[o + 1]) / 2);
  for (let k = 0; k < 4; k++) {
    const b = (k + 1) % 4;
    ctx.arcTo(p[o + k * 2], p[o + k * 2 + 1], p[o + b * 2], p[o + b * 2 + 1], r);
  }
  ctx.closePath();
};

const GRID_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/></svg>';
const CUBE_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.2 14.2 4.6v6.8L8 14.8 1.8 11.4V4.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M1.8 4.6 8 8l6.2-3.4M8 8v6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Mount a skyline into `root`. `data` is `{ date: 'YYYY-MM-DD', count }[]`.
 * Options: palette (4 colours, light → heavy), user (GitHub handle), view ('2d' | '3d').
 */
export function mountSkyline(root, data, {
  palette = ['#3d1a0e', '#86300f', '#e04a17', '#ff9a5c'],
  user = '',
  view: initialView = '3d',
  unit = 'contribution',
  duration = 1300,
  heightScale = 1,
  weekStart = 0,
  orbit = true,
  locale = 'en-US',
} = {}) {
  const plural = unit + 's';
  const noun = (n) => (n === 1 ? unit : plural);
  const nf = new Intl.NumberFormat(locale);
  const df = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dfy = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const dfl = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  // ---- model
  const dates = data.map((d) => dayMs(d.date)).filter(Number.isFinite);
  const end = dates.length ? Math.max(...dates) : dayMs(new Date());
  const grid = buildGrid(data, end, weekStart);
  const stats = computeStats(grid.cells);
  const model = { ...grid, stats, months: monthLabels(grid.cells, grid.weeks, locale) };

  const range = (a, b, withYear = false) => (!a || !b ? '—' : (withYear ? dfy : df).format(dayMs(a)) + ' — ' + (withYear ? dfy : df).format(dayMs(b)));
  const describe = (i) => {
    const c = model.cells[i];
    if (!c) return '';
    return (c.count ? nf.format(c.count) + ' ' + noun(c.count) : 'No ' + plural) + ' on ' + dfl.format(dayMs(c.date));
  };
  const statBlocks = [
    { label: '1 year total', value: nf.format(stats.total), unit: noun(stats.total), sub: range(stats.first, stats.last, true) },
    { label: 'Busiest day', value: nf.format(stats.busiest.count), unit: noun(stats.busiest.count), sub: stats.busiest.date ? df.format(dayMs(stats.busiest.date)) : '—' },
    { label: 'Longest streak', value: nf.format(stats.longest.days), unit: stats.longest.days === 1 ? 'day' : 'days', sub: range(stats.longest.start, stats.longest.end) },
    { label: 'Current streak', value: nf.format(stats.current.days), unit: stats.current.days === 1 ? 'day' : 'days', sub: range(stats.current.start, stats.current.end) },
  ];
  const stat = (b, cls) => `<div class="sky-stat ${cls}"><span class="sky-stat-label">${b.label}</span><span class="sky-stat-num"><b>${b.value}</b> ${b.unit}</span><span class="sky-stat-sub">${b.sub}</span></div>`;
  const levelNames = ['No ' + plural, 'Light', 'Moderate', 'Heavy', 'Heaviest'];

  // ---- DOM
  root.innerHTML = `
    <header class="sky-head">
      <h3 class="sky-title"><span class="sky-total">${nf.format(stats.total)}</span> ${noun(stats.total)} in the last year</h3>
      ${user ? `<a class="sky-handle" href="https://github.com/${esc(user)}" target="_blank" rel="noopener">@${esc(user)} ↗</a>` : ''}
      <div class="sky-toggle" role="group" aria-label="Chart view">
        <span class="sky-thumb" aria-hidden="true"></span>
        <button type="button" data-view="2d" aria-label="Flat heat map" title="Flat heat map">${GRID_ICON}</button>
        <button type="button" data-view="3d" aria-label="3D skyline" title="3D skyline">${CUBE_ICON}</button>
      </div>
    </header>
    <div class="sky-frame">
      <div class="sky-plot">
        <div class="sky-stage">
          <canvas tabindex="0" role="img"></canvas>
          <div class="sky-corner sky-tr" aria-hidden="true">${stat(statBlocks[0], 'sky-stat-end')}${stat(statBlocks[1], 'sky-stat-end')}</div>
          <div class="sky-corner sky-bl" aria-hidden="true">${stat(statBlocks[2], 'sky-stat-start')}${stat(statBlocks[3], 'sky-stat-start')}</div>
        </div>
        <div class="sky-tip" role="tooltip" aria-hidden="true"><span class="sky-tip-text"></span><i class="sky-tip-arrow"></i></div>
      </div>
      <div class="sky-row"><div><div class="sky-row-grid">${statBlocks.map((b) => stat(b, 'sky-stat-stack')).join('')}</div></div></div>
      <footer class="sky-foot">
        <span class="sky-hints"><span data-hint="2d">Hover a day for details · arrow keys to explore</span><span data-hint="3d">Drag to orbit · double-click to reset</span></span>
        <div class="sky-legend"><span>Less</span><span class="sky-swatches"></span><span>More</span></div>
      </footer>
    </div>
    <p class="sr-only sky-live" aria-live="polite"></p>`;

  const $ = (s) => root.querySelector(s);
  const stage = $('.sky-stage');
  const canvas = $('canvas');
  const tip = $('.sky-tip');
  const tipText = $('.sky-tip-text');
  const live = $('.sky-live');
  const swatchBox = $('.sky-swatches');
  const ctx = canvas.getContext('2d');

  let view = initialView;
  let legendLevel = -1;
  const swatchButtons = levelNames.map((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = name;
    b.setAttribute('aria-label', 'Highlight ' + name.toLowerCase() + ' days');
    b.setAttribute('aria-pressed', 'false');
    const set = (lvl) => { legendLevel = lvl; swatchButtons.forEach((s, k) => s.setAttribute('aria-pressed', String(k === lvl))); kick(); };
    b.addEventListener('mouseenter', () => set(i));
    b.addEventListener('focus', () => set(i));
    b.addEventListener('blur', () => set(-1));
    b.addEventListener('click', () => set(legendLevel === i ? -1 : i));
    swatchBox.appendChild(b);
    return b;
  });
  swatchBox.parentElement.addEventListener('mouseleave', () => { legendLevel = -1; swatchButtons.forEach((s) => s.setAttribute('aria-pressed', 'false')); kick(); });

  const syncChrome = () => {
    const is3d = view === '3d';
    root.classList.toggle('is-3d', is3d);
    root.querySelectorAll('.sky-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    root.querySelectorAll('.sky-corner').forEach((c) => c.setAttribute('aria-hidden', String(!(is3d && root.classList.contains('has-corners')))));
    canvas.setAttribute('aria-label', nf.format(stats.total) + ' ' + noun(stats.total) + ' between ' + range(stats.first, stats.last, true) +
      ', shown as a ' + (is3d ? '3D skyline' : 'heat map') + '. Use the arrow keys to read individual days.');
    canvas.style.touchAction = is3d && orbit ? 'pan-y' : 'auto';
  };
  root.querySelectorAll('.sky-toggle button').forEach((b) => b.addEventListener('click', () => {
    view = b.dataset.view;
    syncChrome();
    setTarget();
  }));
  root.style.setProperty('--sky-dur', duration + 'ms');

  // ---- engine state
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceMq.matches;
  let t = 0, target = 0, entered = false;
  let yaw = 0, elev = 0, yawGoal = 0, elevGoal = 0;
  let W = 0, H2 = 0, H3 = 0, Hmax = 0, lastH = -1, dpr = 1, gutter = 30, labelW = 30, font = '10px monospace';
  const col = new Float32Array(15), colGoal = new Float32Array(15);
  let colReady = false, fg = FG_FALLBACK, bg = BG_FALLBACK;
  const n = model.cells.length, weeks = model.weeks;
  const wk = new Float32Array(n), dy = new Float32Array(n), lv = new Uint8Array(n), hgt = new Float32Array(n);
  const zs = new Float32Array(n), hover = new Float32Array(n), dim = new Float32Array(n);
  const polys = new Float32Array(n * 24), faces = new Uint8Array(n);
  const order = Array.from({ length: n }, (_, i) => i);
  const months = model.months;
  const weekdayRows = [];
  let hovered = -1, pinned = -1, activeIdx = -1, tipW = 0, raf = 0, last = 0;

  for (let i = 0; i < n; i++) {
    const c = model.cells[i];
    wk[i] = c.week; dy[i] = c.day; lv[i] = c.level;
    hgt[i] = barHeight(c.count, model.max, heightScale);
  }
  const wf = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  for (let d = 0; d < 7 && d < n; d++) {
    const dow = new Date(dayMs(model.cells[d].date)).getUTCDay();
    if (dow === 1 || dow === 3 || dow === 5) weekdayRows.push({ day: d, label: wf.format(dayMs(model.cells[d].date)) });
  }

  const retheme = () => {
    const cs = getComputedStyle(root);
    fg = toRGB(cs.color, FG_FALLBACK) ?? FG_FALLBACK;
    const b = toRGB(cs.backgroundColor, null);
    bg = b ?? (luminance(fg) > 0.5 ? [10, 10, 10] : BG_FALLBACK);
    const isDark = luminance(bg) < 0.45;
    font = '500 10px ' + (cs.getPropertyValue('--mono').trim() || cs.fontFamily || 'monospace');
    const empty = mixRGB(bg, fg, isDark ? 0.09 : 0.075);
    const all = [empty, ...palette.map((c) => toRGB(c, FG_FALLBACK) ?? FG_FALLBACK)];
    for (let k = 0; k < 5; k++) for (let ch = 0; ch < 3; ch++) colGoal[k * 3 + ch] = all[k][ch];
    if (!colReady || reduced) { col.set(colGoal); colReady = true; }
    ctx.font = font;
    labelW = Math.ceil(Math.max(20, ...weekdayRows.map((r) => ctx.measureText(r.label).width))) + 8;
    all.forEach((c, k) => { swatchButtons[k].style.background = rgbString(c[0], c[1], c[2]); });
    root.style.setProperty('--sky-accent', rgbString(...all[4]));
    kick();
  };

  // Projected extent of the scene for camera e.
  const extent = (cam, e, full) => {
    const w = lerp(0.78, 0.9, e), off = (1 - w) / 2;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    const add = (x, y, z) => {
      const p = project(cam, x, y, z);
      if (p[0] < minx) minx = p[0];
      if (p[0] > maxx) maxx = p[0];
      if (p[1] < miny) miny = p[1];
      if (p[1] > maxy) maxy = p[1];
    };
    for (let i = 0; i < n; i++) {
      const x0 = wk[i] + off, y0 = dy[i] + off, z = full ? hgt[i] * e : zs[i];
      add(x0, y0, z); add(x0 + w, y0, z); add(x0, y0 + w, z);
      add(x0 + w, y0 + w, 0); add(x0, y0 + w, 0); add(x0 + w, y0, 0);
    }
    add(0, 7 + 1.5 * e, 0);
    add(weeks, 7 + 1.5 * e, 0);
    return { minx, maxx, miny, maxy };
  };

  const relayout = () => {
    const w = Math.round(stage.clientWidth);
    if (!w || !n) return;
    W = w;
    gutter = W < 520 ? 0 : labelW;
    dpr = Math.min(2, devicePixelRatio || 1);
    const b2 = extent(camera(0), 0, true);
    H2 = 20 + 4 + ((b2.maxy - b2.miny) / (b2.maxx - b2.minx)) * (W - gutter - 4);
    const b3 = extent(camera(1), 1, true);
    const natural = ((b3.maxy - b3.miny) / (b3.maxx - b3.minx)) * (W - 40) + 40;
    H3 = Math.max(Math.min(natural, W * 0.72, 620), Math.min(natural, 240));
    Hmax = Math.ceil(Math.max(H2, H3));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hmax * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = Hmax + 'px';
    lastH = -1;
    root.classList.toggle('has-corners', W >= 560);
    syncChrome();
    draw();
  };

  const draw = () => {
    if (!W || !n) return;
    const e = easeInOutCubic(t);
    const cam = camera(e, yaw, elev);
    const Hc = lerp(H2, H3, e);
    if (Math.abs(Hc - lastH) > 0.2) { stage.style.height = Hc.toFixed(1) + 'px'; lastH = Hc; }
    for (let i = 0; i < n; i++) zs[i] = riseAt(t, wk[i], weeks, dy[i]) * hgt[i];
    const b = extent(cam, e, false);
    const pad = lerp(2, 20, e);
    const left = pad + gutter * (1 - e);
    const top = pad + 20 * (1 - e);
    const aw = W - left - pad, ah = Hc - top - pad;
    const bw = Math.max(1e-6, b.maxx - b.minx), bh = Math.max(1e-6, b.maxy - b.miny);
    const s = Math.min(aw / bw, ah / bh);
    const ox = left + (aw - bw * s) / 2 - b.minx * s;
    const oy = top + (ah - bh * s) / 2 - b.miny * s;
    const { cs, sn, se, ce } = cam;
    const px = (x, y) => ox + (x * cs - y * sn) * s;
    const py = (x, y, z) => oy + ((x * sn + y * cs) * se - z * ce) * s;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hmax);
    order.sort((a, c) => (wk[a] + 0.5) * sn + (dy[a] + 0.5) * cs - ((wk[c] + 0.5) * sn + (dy[c] + 0.5) * cs));

    const w = lerp(0.78, 0.9, e), off = (1 - w) / 2;
    const radius = lerp(0.17, 0.03, e) * s;
    const outline = (1 - e) * 0.07;
    const lift = 0.7 * e;
    const ex = col[0], ey = col[1], ez = col[2];

    for (let k = 0; k < n; k++) {
      const i = order[k];
      const x0 = wk[i] + off, y0 = dy[i] + off, x1 = x0 + w, y1 = y0 + w;
      const z = zs[i] + hover[i] * lift;
      const o = i * 24;
      polys[o] = px(x0, y0); polys[o + 1] = py(x0, y0, z);
      polys[o + 2] = px(x1, y0); polys[o + 3] = py(x1, y0, z);
      polys[o + 4] = px(x1, y1); polys[o + 5] = py(x1, y1, z);
      polys[o + 6] = px(x0, y1); polys[o + 7] = py(x0, y1, z);
      polys[o + 8] = px(x0, y1); polys[o + 9] = py(x0, y1, 0);
      polys[o + 10] = px(x1, y1); polys[o + 11] = py(x1, y1, 0);
      polys[o + 12] = polys[o + 4]; polys[o + 13] = polys[o + 5];
      polys[o + 14] = polys[o + 6]; polys[o + 15] = polys[o + 7];
      polys[o + 16] = px(x1, y0); polys[o + 17] = py(x1, y0, 0);
      polys[o + 18] = polys[o + 10]; polys[o + 19] = polys[o + 11];
      polys[o + 20] = polys[o + 4]; polys[o + 21] = polys[o + 5];
      polys[o + 22] = polys[o + 2]; polys[o + 23] = polys[o + 3];

      const tall = z * ce * s;
      let f = 0;
      if (tall > 0.35 && w * cs * s > 0.35) f |= 1;
      if (tall > 0.35 && w * sn * s > 0.35) f |= 2;
      faces[i] = f;

      const L = lv[i] * 3;
      let r = col[L], g = col[L + 1], bl = col[L + 2];
      const d = dim[i];
      if (d > 0.002) { r += (ex - r) * 0.72 * d; g += (ey - g) * 0.72 * d; bl += (ez - bl) * 0.72 * d; }
      const hv = hover[i];
      if (hv > 0.002) { const m = 0.16 * hv; r += (fg[0] - r) * m; g += (fg[1] - g) * m; bl += (fg[2] - bl) * m; }
      if (f & 1) { ctx.beginPath(); quadPath(ctx, polys, o + 8, 0); ctx.fillStyle = rgbString(r * 0.84, g * 0.84, bl * 0.84); ctx.fill(); }
      if (f & 2) { ctx.beginPath(); quadPath(ctx, polys, o + 16, 0); ctx.fillStyle = rgbString(r * 0.68, g * 0.68, bl * 0.68); ctx.fill(); }
      ctx.beginPath();
      quadPath(ctx, polys, o, radius);
      ctx.fillStyle = rgbString(r, g, bl);
      ctx.fill();
      if (outline > 0.004) { ctx.strokeStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${outline.toFixed(3)})`; ctx.lineWidth = 1; ctx.stroke(); }
      if (hv > 0.02) { ctx.strokeStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${(0.85 * hv).toFixed(3)})`; ctx.lineWidth = 1.5; ctx.stroke(); }
    }

    // Labels: top and left in 2D, along the front edge in 3D. They fade, never pop.
    const muted = mixRGB(bg, fg, 0.5);
    const mutedRGBA = (a) => `rgba(${Math.round(muted[0])},${Math.round(muted[1])},${Math.round(muted[2])},${a.toFixed(3)})`;
    ctx.font = font;
    const a2 = 1 - smoothstep(0, 0.4, e);
    const a3 = smoothstep(0.62, 1, e);
    if (a2 > 0.004) {
      ctx.fillStyle = mutedRGBA(a2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      let edge = -Infinity;
      for (const m of months) {
        const x = px(m.week + off, -0.3), tw = ctx.measureText(m.label).width;
        if (x < edge || x + tw > W) continue;
        ctx.fillText(m.label, x, py(m.week + off, -0.3, 0) - 3);
        edge = x + tw + 6;
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      if (gutter > 0) for (const r of weekdayRows) ctx.fillText(r.label, px(0, r.day + 0.5) - 6, py(0, r.day + 0.5, 0));
    }
    if (a3 > 0.004) {
      ctx.fillStyle = mutedRGBA(a3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let edge = -Infinity;
      for (const m of months) {
        const x = px(m.week + 0.5, 7.3), tw = ctx.measureText(m.label).width;
        if (x < edge || x + tw > W) continue;
        ctx.fillText(m.label, x, py(m.week + 0.5, 7.3, 0) + 2);
        edge = x + tw + 10;
      }
    }

    // The tooltip rides the active cell through morphs and orbits.
    if (activeIdx >= 0 && activeIdx < n) {
      const i = activeIdx;
      const z = zs[i] + hover[i] * lift;
      const tx = px(wk[i] + 0.5, dy[i] + 0.5);
      const ty = Math.min(py(wk[i] + off, dy[i] + off, z), py(wk[i] + off + w, dy[i] + off, z), py(wk[i] + off, dy[i] + off + w, z));
      const half = tipW / 2;
      const cx = Math.min(W - half - 2, Math.max(half + 2, tx));
      tip.style.transform = `translate(${(cx - half).toFixed(1)}px,${(ty - 8).toFixed(1)}px) translateY(-100%)`;
      tip.style.setProperty('--arrow', (tx - cx + half).toFixed(1) + 'px');
    }
  };

  const tick = (now) => {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    let moving = false;
    if (t !== target) {
      const step = reduced ? 1 : (dt * 1000) / Math.max(1, duration);
      t = target > t ? Math.min(target, t + step) : Math.max(target, t - step);
      moving = true;
    }
    const ko = reduced ? 1 : 1 - Math.exp(-dt * 12);
    yaw += (yawGoal - yaw) * ko;
    elev += (elevGoal - elev) * ko;
    if (Math.abs(yawGoal - yaw) > 1e-4 || Math.abs(elevGoal - elev) > 1e-4) moving = true;
    else { yaw = yawGoal; elev = elevGoal; }
    const kc = reduced ? 1 : 1 - Math.exp(-dt * 7);
    for (let k = 0; k < 15; k++) {
      const d = colGoal[k] - col[k];
      if (Math.abs(d) > 0.4) { col[k] += d * kc; moving = true; } else col[k] = colGoal[k];
    }
    const kh = reduced ? 1 : 1 - Math.exp(-dt * 16);
    const kd = reduced ? 1 : 1 - Math.exp(-dt * 10);
    for (let i = 0; i < n; i++) {
      const hg = i === activeIdx ? 1 : 0;
      const dg = legendLevel >= 0 && lv[i] !== legendLevel ? 1 : 0;
      if (hover[i] !== hg) { hover[i] = Math.abs(hg - hover[i]) < 0.003 ? hg : hover[i] + (hg - hover[i]) * kh; moving = true; }
      if (dim[i] !== dg) { dim[i] = Math.abs(dg - dim[i]) < 0.003 ? dg : dim[i] + (dg - dim[i]) * kd; moving = true; }
    }
    draw();
    if (moving) raf = requestAnimationFrame(tick);
  };

  function kick() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  // The active day is the hovered one, else the pinned one (tap, click or keyboard).
  const refreshActive = () => {
    const next = hovered >= 0 ? hovered : pinned;
    if (next === activeIdx) return;
    activeIdx = next;
    const c = model.cells[next];
    tip.classList.toggle('is-on', next >= 0);
    tip.setAttribute('aria-hidden', String(next < 0));
    if (c) {
      tipText.innerHTML = `<strong>${c.count ? nf.format(c.count) + ' ' + noun(c.count) : 'No ' + plural}</strong><span> on ${dfy.format(dayMs(c.date))}</span>`;
      tipW = tip.offsetWidth;
    }
    kick();
  };

  const hit = (x, y) => {
    for (let k = n - 1; k >= 0; k--) {
      const i = order[k], o = i * 24;
      if (pointInQuad(polys, o, x, y)) return i;
      if (faces[i] & 1 && pointInQuad(polys, o + 8, x, y)) return i;
      if (faces[i] & 2 && pointInQuad(polys, o + 16, x, y)) return i;
    }
    return -1;
  };
  const local = (ev) => {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };

  let drag = null;
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const can = orbit && target === 1;
    drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, yaw: yawGoal, elev: elevGoal, moved: false, orbit: can, mouse: ev.pointerType === 'mouse' };
    if (can) { try { canvas.setPointerCapture(ev.pointerId); } catch { /* capture is a nicety */ } }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (drag && drag.orbit && ev.pointerId === drag.id) {
      const dx = ev.clientX - drag.x, dyy = ev.clientY - drag.y;
      if (drag.moved || Math.hypot(dx, dyy) > 4) {
        drag.moved = true;
        yawGoal = Math.min(YAW_RANGE[1] - YAW_3D, Math.max(YAW_RANGE[0] - YAW_3D, drag.yaw + dx * 0.006));
        if (drag.mouse) elevGoal = Math.min(ELEV_RANGE[1] - ELEV_3D, Math.max(ELEV_RANGE[0] - ELEV_3D, drag.elev + dyy * 0.004));
        canvas.style.cursor = 'grabbing';
        hovered = -1;
        refreshActive();
        kick();
        return;
      }
    }
    if (ev.pointerType !== 'mouse') return;
    const [x, y] = local(ev);
    const i = hit(x, y);
    if (i !== hovered) { hovered = i; refreshActive(); }
    canvas.style.cursor = orbit && target === 1 ? 'grab' : i >= 0 ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const wasMoved = drag.moved;
    drag = null;
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    canvas.style.cursor = orbit && target === 1 ? 'grab' : 'default';
    if (wasMoved) return;
    const [x, y] = local(ev);
    const i = hit(x, y);
    pinned = i === pinned ? -1 : i;
    if (ev.pointerType !== 'mouse') hovered = -1;
    refreshActive();
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { if (drag) return; hovered = -1; refreshActive(); });
  canvas.addEventListener('dblclick', () => { yawGoal = 0; elevGoal = 0; kick(); });
  canvas.addEventListener('keydown', (ev) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'];
    if (!keys.includes(ev.key) || !n) return;
    ev.preventDefault();
    if (ev.key === 'Escape') { pinned = -1; hovered = -1; refreshActive(); return; }
    let i = pinned >= 0 ? pinned : activeIdx >= 0 ? activeIdx : n - 1;
    if (pinned >= 0 || activeIdx >= 0) {
      if (ev.key === 'ArrowLeft') i -= 7;
      if (ev.key === 'ArrowRight') i += 7;
      if (ev.key === 'ArrowUp') i -= 1;
      if (ev.key === 'ArrowDown') i += 1;
      if (ev.key === 'Home') i = 0;
      if (ev.key === 'End') i = n - 1;
    }
    i = Math.max(0, Math.min(n - 1, i));
    pinned = i;
    hovered = -1;
    refreshActive();
    live.textContent = describe(i);
  });
  canvas.addEventListener('blur', () => { pinned = -1; refreshActive(); });

  function setTarget() {
    const goal = view === '3d' ? 1 : 0;
    if (!entered || goal === target) return;
    target = goal;
    if (goal === 0) { yawGoal = 0; elevGoal = 0; }
    canvas.style.cursor = orbit && target === 1 ? 'grab' : 'default';
    kick();
  }

  syncChrome();
  retheme();
  relayout();
  document.fonts?.ready.then(() => { retheme(); relayout(); });

  // The 3D view rises out of the flat one the first time it is seen.
  const enter = () => {
    if (entered) return;
    entered = true;
    if (reduced) t = view === '3d' ? 1 : 0;
    setTarget();
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { enter(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(stage);
  } else enter();

  new ResizeObserver(() => { if (Math.round(stage.clientWidth) !== W) relayout(); }).observe(stage);
  reduceMq.addEventListener('change', () => { reduced = reduceMq.matches; kick(); });
}

/** Live data from GitHub (via a public contributions API), falling back to the saved snapshot. */
export async function loadContributions(user, snapshotUrl) {
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  try {
    const res = await Promise.race([fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`), timeout(6000)]);
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    if (Array.isArray(json.contributions) && json.contributions.length) {
      return json.contributions.map((d) => ({ date: d.date, count: d.count }));
    }
  } catch { /* fall through to the snapshot */ }
  const res = await fetch(snapshotUrl);
  return res.json();
}

