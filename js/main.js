import { REEL_SLOTS, reelAngle, reelPose, reelScene } from './reel-ring.js';
import { CARDS, cardMarkup, cardFront } from './cards.js';
import { mountSkyline, loadContributions } from './skyline.js';
import { mountHalftone } from './halftone.js';
import { mountDiaText } from './dia-text.js';

const $ = (s) => document.querySelector(s);
const html = document.documentElement;
const intro = html.classList.contains('intro'); // false under prefers-reduced-motion

const stage = $('#stage');
const ring = $('#ring');
ring.innerHTML = CARDS.slice(0, REEL_SLOTS).map(cardMarkup).join('');
const cards = [...ring.querySelectorAll('.card')];

/* ---------------- motion helpers ---------------- */

function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x, d = dx(t);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sy(Math.max(0, Math.min(1, t)));
  };
}
const linear = (t) => t;
const entranceEase = cubicBezier(0.5, 0, 0.15, 1);

function tween(obj, key, to, seconds, ease, done) {
  const from = obj[key], t0 = performance.now();
  let stopped = false;
  const step = (now) => {
    if (stopped) return;
    const p = Math.min(1, (now - t0) / (seconds * 1000));
    obj[key] = from + (to - from) * ease(p);
    if (p < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
  return () => { stopped = true; };
}

/* ---------------- scene state ---------------- */

// The two motion values that drive everything.
const m = { formation: intro ? 0 : 1, expansion: intro ? 0 : 1 };

let angle = 0;       // visible ring angle (follows target through a spring)
let target = 0;      // where drag / spin / focus wants the ring
let velocity = 0;
let spinning = false;
let paused = !intro; // reduced motion: no auto spin
let interactive = !intro;

// Uniform scene scale for the viewport: [loader, hero].
let fit = [1, 1];
function measureFit() {
  const w = innerWidth, h = Math.max(520, innerHeight);
  const loader = Math.min(w / 1250, h / 940, 1.15);
  const hero = Math.min(h / 900, w / 500, 1.3);
  fit = [Math.max(0.42, loader), Math.max(0.55, hero)];
}
measureFit();
addEventListener('resize', measureFit);

// Write a style only when its value changed.
const written = new Map();
const write = (key, value, apply) => {
  if (written.get(key) === value) return;
  written.set(key, value);
  apply(value);
};

let scene = reelScene(m.expansion, fit);

function render() {
  scene = reelScene(m.expansion, fit);
  write('perspective', scene.perspective.toFixed(1), (v) => { stage.style.perspective = `${v}px`; });
  write('ring', `translateY(${scene.lift.toFixed(1)}px) rotateZ(${scene.roll.toFixed(2)}deg) rotateX(${scene.tilt.toFixed(2)}deg)`,
    (v) => { ring.style.transform = v; });

  const s = scene.scale.toFixed(4);
  for (let i = 0; i < cards.length; i++) {
    const el = cards[i];
    const a = reelAngle(i, angle);
    const p = reelPose(a, m.formation, scene);
    write(`t${i}`, p.behindCamera ? 'hidden'
      : `translate3d(${p.x.toFixed(1)}px,0,${p.z.toFixed(1)}px) rotateY(${p.yaw.toFixed(2)}deg) scale(${s})`,
    (v) => {
      if (v === 'hidden') { el.style.visibility = 'hidden'; return; }
      el.style.visibility = '';
      el.style.transform = v;
    });
    write(`o${i}`, p.appear.toFixed(3), (v) => { el.style.opacity = v; });
    const live = Math.abs(a) < 78 && m.expansion > 0.6;
    write(`l${i}`, live ? 1 : 0, (v) => el.classList.toggle('is-live', !!v));
    // Cards out of view shouldn't be reachable by Tab.
    const reachable = m.expansion > 0.99 && Math.abs(a) < 100;
    write(`f${i}`, reachable ? 1 : 0, (v) => { if (v) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', '-1'); });
  }
}

// Degrees of ring turn per pixel of drag, measured at the centre of the wall.
const degPerPx = () => {
  const r = scene.radius, p = scene.perspective;
  return 1 / ((r * p) / (p + r) * (Math.PI / 180));
};

/* ---------------- frame loop ---------------- */

let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe($('#top'));

let last = performance.now();
function frame(now) {
  const dt = Math.min(64, now - last) / 16.667;
  last = now;
  if (spinning && !paused && !drag.active) target -= 0.05 * dt;
  // Spring towards the target so nothing ever snaps.
  velocity = (velocity + (target - angle) * 0.055 * dt) * Math.pow(0.8, dt);
  angle += velocity * dt;
  if (heroVisible || !html.classList.contains('done')) render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- drag, swipe, wheel, keyboard ---------------- */

const drag = { active: false, id: null, last: 0, moved: 0, v: 0, t: 0, captured: false };

stage.addEventListener('pointerdown', (e) => {
  if (!interactive || e.button !== 0) return;
  Object.assign(drag, { active: true, id: e.pointerId, last: e.clientX, moved: 0, v: 0, t: e.timeStamp, captured: false });
});
addEventListener('pointermove', (e) => {
  if (!drag.active || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.last;
  drag.last = e.clientX;
  drag.moved += Math.abs(dx);
  drag.v = dx / Math.max(1, e.timeStamp - drag.t);
  drag.t = e.timeStamp;
  target -= dx * degPerPx();
  if (drag.moved > 6 && !drag.captured) {
    drag.captured = true;
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add('is-dragging');
  }
});
const endDrag = (e) => {
  if (!drag.active || e.pointerId !== drag.id) return;
  drag.active = false;
  stage.classList.remove('is-dragging');
  if (drag.captured) target -= drag.v * 220 * degPerPx(); // a little momentum on release
};
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);
// A drag is not a click.
stage.addEventListener('click', (e) => { if (drag.moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
stage.addEventListener('dragstart', (e) => e.preventDefault());

stage.addEventListener('wheel', (e) => {
  if (!interactive) return;
  const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
  if (!dx) return; // vertical wheel scrolls the page
  e.preventDefault();
  target -= dx * degPerPx() * 0.8;
}, { passive: false });

// Bring a focused card to the front of the wall.
const step = 360 / REEL_SLOTS;
ring.addEventListener('focusin', (e) => {
  const i = cards.indexOf(e.target.closest('.card'));
  if (i < 0) return;
  stage.scrollLeft = 0; stage.scrollTop = 0;
  target -= reelAngle(i, target); // shortest way round
});
ring.addEventListener('keydown', (e) => {
  const i = cards.indexOf(e.target.closest('.card'));
  if (i < 0 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
  e.preventDefault();
  const next = cards[(i + (e.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length];
  next.removeAttribute('tabindex');
  next.focus({ preventScroll: true });
});
stage.addEventListener('scroll', () => { stage.scrollLeft = 0; stage.scrollTop = 0; });

const spinToggle = $('#spinToggle');
const syncSpinToggle = () => {
  spinToggle.textContent = paused ? 'Play' : 'Pause';
  spinToggle.setAttribute('aria-pressed', String(paused));
  spinToggle.setAttribute('aria-label', paused ? 'Start rotating the carousel' : 'Stop rotating the carousel');
};
spinToggle.addEventListener('click', () => { paused = !paused; spinning = true; syncSpinToggle(); });
syncSpinToggle();

/* ---------------- entrance ---------------- */

const loader = $('#loader');
const loaderBrand = $('#loaderBrand');
const skipBtn = $('#skipIntro');
const wordmark = $('#wordmark');
const counter = $('#counter');

// Rolling counter: each digit is its own column.
counter.innerHTML = [0, 1, 2].map(() =>
  `<span class="digit"><span class="digit-strip">${'0123456789'.split('').map((d) => `<span>${d}</span>`).join('')}</span></span>`
).join('') + '<span class="pct">%</span>';
const digitCols = [...counter.querySelectorAll('.digit')];
let shownPct = -1;
function setCounter(pct) {
  if (pct === shownPct) return;
  shownPct = pct;
  const s = String(pct).padStart(3, '0');
  digitCols.forEach((col, i) => {
    col.firstElementChild.style.transform = `translateY(${-Number(s[i])}em)`;
    col.classList.toggle('dim', i < 3 - String(pct).length);
  });
}
setCounter(0);

// Scrambled caption.
function scramble(el, phrases) {
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=/<>';
  let phrase = 0, frameN = 0, timer;
  const tick = () => {
    const text = phrases[phrase];
    const settled = Math.floor(frameN / 2);
    el.textContent = text.split('').map((c, i) =>
      i < settled || c === ' ' ? c : glyphs[(Math.random() * glyphs.length) | 0]).join('');
    frameN++;
    if (settled > text.length) {
      phrase = (phrase + 1) % phrases.length;
      frameN = 0;
      timer = setTimeout(tick, 1300);
    } else timer = setTimeout(tick, 38);
  };
  tick();
  return () => clearTimeout(timer);
}

let stopScramble = () => {}, stopFormation = () => {}, stopExpansion = () => {};
let stopTimers = [];
let assetsLoaded = 0, assetsTotal = 1, assetsReady = false, formed = false, revealing = false, finished = false;

function trackAssets() {
  const urls = [...new Set([...ring.querySelectorAll('image[href]')].map((n) => n.getAttribute('href')))];
  assetsTotal = urls.length + 1; // + fonts
  const one = () => {
    assetsLoaded++;
    if (assetsLoaded >= assetsTotal) { assetsReady = true; tryReveal(); }
  };
  urls.forEach((src) => { const img = new Image(); img.onload = img.onerror = one; img.src = src; });
  document.fonts.ready.then(one);
  // Never hold the visitor hostage to a slow CDN.
  stopTimers.push(setTimeout(() => { assetsReady = true; tryReveal(); }, 7000));
}

function counterLoop() {
  if (finished || revealing) { setCounter(100); return; }
  // Real progress, never ahead of the deal so the two finish together.
  const real = assetsLoaded / assetsTotal;
  setCounter(Math.floor(Math.min(real, m.formation) * 100));
  requestAnimationFrame(counterLoop);
}

function flyBrand(seconds) {
  const from = loaderBrand.getBoundingClientRect();
  const to = wordmark.getBoundingClientRect();
  const k = to.width / from.width;
  const anim = loaderBrand.animate(
    [{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${k})` }],
    { duration: seconds * 1000, easing: 'cubic-bezier(.5,0,.15,1)', fill: 'forwards' });
  anim.finished.then(land, () => {});
}
function land() {
  html.classList.add('landed');
  loaderBrand.remove();
}

function tryReveal() {
  if (!formed || !assetsReady || revealing || finished) return;
  revealing = true;
  spinning = true;
  html.classList.add('revealing');
  setCounter(100);
  stopExpansion = tween(m, 'expansion', 1, 1.9, entranceEase, finish);
  // Overlap, don't queue: the brand and the page chrome start while the ring is still opening.
  stopTimers.push(setTimeout(() => flyBrand(0.95), 250));
  stopTimers.push(setTimeout(() => html.classList.add('entered'), 1050));
}

function finish() {
  if (finished) return;
  finished = true;
  interactive = true;
  spinning = true;
  stopScramble();
  html.classList.add('entered', 'done');
  html.classList.remove('intro', 'revealing');
  loader.remove();
  skipBtn.remove();
  if (loaderBrand.isConnected) land();
  removeEventListener('keydown', onIntroKey, true);
  removeEventListener('wheel', blockScroll, { capture: true });
  removeEventListener('touchmove', blockScroll, { capture: true });
}

function skip() {
  if (finished) return;
  stopFormation(); stopExpansion(); stopTimers.forEach(clearTimeout);
  m.formation = 1; m.expansion = 1;
  finish();
}

function onIntroKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); skip(); }
  if (e.key === 'Tab') skip();
}
function blockScroll(e) { e.preventDefault(); }

if (intro) {
  if (location.hash && location.hash !== '#top') {
    // Deep link: go straight to the content.
    skip();
  } else {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    addEventListener('keydown', onIntroKey, true);
    addEventListener('wheel', blockScroll, { passive: false, capture: true });
    addEventListener('touchmove', blockScroll, { passive: false, capture: true });
    skipBtn.addEventListener('click', skip);
    stopScramble = scramble($('#scramble'), ['Loading work', 'Dealing projects', 'Training models']);
    trackAssets();
    counterLoop();
    stopFormation = tween(m, 'formation', 1, 2.6, linear, () => { formed = true; tryReveal(); });
  }
} else {
  html.classList.add('entered', 'done', 'landed');
}

/* ---------------- rest of the page ---------------- */

const header = $('#header');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

$('#year').textContent = new Date().getFullYear();

/* ---------------- about: colour-sweep text ---------------- */

document.querySelectorAll('[data-dia]').forEach((el) => mountDiaText(el));

/* ---------------- footer: halftone wordmark ---------------- */

const footerEl = $('#footer');
if (footerEl) mountHalftone(footerEl, { wordmark: 'haris', warm: '#ff5a1f' });

/* ---------------- activity: contribution skyline ---------------- */

const skyEl = $('#skyline');
if (skyEl) {
  const user = skyEl.dataset.user;
  loadContributions(user, 'data/contributions.json')
    .then((data) => mountSkyline(skyEl, data, { user }))
    .catch(() => { skyEl.innerHTML = '<p class="sky-error">Activity is unavailable right now.</p>'; });
}

/* ---------------- work list: sliding highlight + card preview ---------------- */

(function workHover() {
  const wrap = $('#projectsWrap');
  if (!wrap || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const highlight = wrap.querySelector('.proj-highlight');
  const preview = wrap.querySelector('.proj-preview');
  const rows = [...wrap.querySelectorAll('.project')];
  const shots = rows.map((row) => {
    const i = Number(row.dataset.card);
    const c = CARDS[i];
    const shot = document.createElement('div');
    shot.className = 'proj-shot';
    shot.style.cssText = `--bg:${c.bg};--fg:${c.fg};--ac:${c.ac}`;
    shot.innerHTML = cardFront(c, i);
    preview.appendChild(shot);
    return shot;
  });

  let active = -1, z = 1, raf = 0;
  const pos = { x: 0, y: 0 }, goal = { x: 0, y: 0 };
  const place = () => { preview.style.translate = `${pos.x.toFixed(1)}px ${pos.y.toFixed(1)}px`; };
  const follow = () => {
    pos.x += (goal.x - pos.x) * 0.18;
    pos.y += (goal.y - pos.y) * 0.18;
    place();
    raf = Math.abs(goal.x - pos.x) + Math.abs(goal.y - pos.y) > 0.3 ? requestAnimationFrame(follow) : 0;
  };
  // Put the preview beside the point, flipping left near the right edge and staying inside the list.
  const aim = (clientX, clientY, snap) => {
    const r = wrap.getBoundingClientRect();
    const w = preview.offsetWidth, h = preview.offsetHeight;
    let x = clientX - r.left + 36;
    if (x + w > r.width) x = clientX - r.left - w - 36;
    goal.x = x;
    goal.y = Math.min(Math.max(clientY - r.top - h / 2, 0), r.height - h);
    if (snap) { pos.x = goal.x; pos.y = goal.y; place(); return; }
    if (!raf) raf = requestAnimationFrame(follow);
  };
  const aimAtRow = (row, snap) => {
    const r = row.getBoundingClientRect();
    aim(r.left + r.width * 0.55, r.top + r.height / 2, snap);
  };

  const activate = (i) => {
    if (i === active) return;
    const first = active < 0;
    if (!first) { rows[active].classList.remove('is-active'); shots[active].classList.remove('is-on'); }
    active = i;
    const row = rows[i];
    row.classList.add('is-active');
    // The bar appears in place the first time, then slides between rows.
    if (first) highlight.style.transition = 'opacity .35s ease';
    highlight.style.translate = `0 ${row.offsetTop}px`;
    highlight.style.height = `${row.offsetHeight}px`;
    highlight.style.opacity = '1';
    if (first) requestAnimationFrame(() => { highlight.style.transition = ''; });
    shots[i].style.zIndex = String(++z);
    shots[i].classList.add('is-on');
  };
  const clear = () => {
    if (active < 0) return;
    rows[active].classList.remove('is-active');
    shots[active].classList.remove('is-on');
    highlight.style.opacity = '0';
    active = -1;
  };

  wrap.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.project');
    if (!row) return;
    const wasIdle = active < 0;
    activate(rows.indexOf(row));
    // Reduced motion: no cursor parallax, the preview sits beside the row.
    if (reduce.matches) aimAtRow(row, true);
    else aim(e.clientX, e.clientY, wasIdle);
  });
  wrap.addEventListener('mouseleave', clear);
  wrap.addEventListener('focusin', (e) => {
    const row = e.target.closest('.project');
    if (!row) return;
    activate(rows.indexOf(row));
    aimAtRow(row, true);
  });
  wrap.addEventListener('focusout', (e) => { if (!wrap.contains(e.relatedTarget)) clear(); });
  addEventListener('resize', () => {
    if (active < 0) return;
    highlight.style.translate = `0 ${rows[active].offsetTop}px`;
    highlight.style.height = `${rows[active].offsetHeight}px`;
  });
})();

$('#contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const text = `Hi Haris, I'm ${f.get('name')} (${f.get('email')}).\n\n*${f.get('subject')}*\n${f.get('message')}`;
  window.open(`https://wa.me/923437354889?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});
