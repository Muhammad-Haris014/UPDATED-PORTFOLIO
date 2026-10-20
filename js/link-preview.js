// Link preview: hover (or focus) a link with `data-preview="image.jpg"` or
// `data-preview-card="name"` and a small card of its destination springs up above it, drifting
// sideways with the pointer. One shared card serves every link on the page.

/** One step of a damped spring (unit mass). Returns [position, velocity]. */
export function springStep(x, v, target, stiffness, damping, dt) {
  const a = -stiffness * (x - target) - damping * v;
  v += a * dt;
  return [x + v * dt, v];
}

/** Sideways drift for a pointer at `offsetX` across a trigger `width` wide: half its distance from centre. */
export const driftFor = (offsetX, width) => (offsetX - width / 2) / 2;

/** Where the card sits: centred over the trigger, kept inside the viewport, flipped below if there's no room above. */
export function placeCard(rect, cardW, cardH, vw, gap = 10, margin = 8) {
  let left = rect.left + rect.width / 2 - cardW / 2;
  left = Math.max(margin, Math.min(vw - cardW - margin, left));
  const above = rect.top - gap - cardH;
  const below = above < margin;
  return { left, top: below ? rect.bottom + gap : above, below };
}

export function mountLinkPreviews(root = document, templates = {}) {
  const links = [...root.querySelectorAll('[data-preview], [data-preview-card]')];
  if (!links.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;

  const card = document.createElement('a');
  card.className = 'lp-card';
  card.setAttribute('aria-hidden', 'true');
  card.tabIndex = -1;
  card.innerHTML = '<span class="lp-frame"></span>';
  document.body.appendChild(card);
  const frame = card.firstElementChild;

  // Warm the cache so the first hover shows a picture, not a blank.
  const warm = () => links.forEach((a) => { if (a.dataset.preview) new Image().src = a.dataset.preview; });
  if ('requestIdleCallback' in window) requestIdleCallback(warm); else setTimeout(warm, 1500);

  let active = null, openTimer = 0, closeTimer = 0, raf = 0, last = 0;
  let p = 0, pv = 0, pGoal = 0;          // entrance: 0 hidden → 1 shown
  let x = 0, xv = 0, xGoal = 0;          // sideways drift
  let place = { left: 0, top: 0, below: false };

  const render = () => {
    const s = 0.6 + 0.4 * p;
    const y = (place.below ? -20 : 20) * (1 - p);
    card.style.opacity = String(Math.max(0, Math.min(1, p)));
    card.style.transform = `translate3d(${(place.left + x).toFixed(1)}px, ${(place.top + y).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  };
  const tick = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    [p, pv] = springStep(p, pv, pGoal, 260, 20, dt);
    [x, xv] = springStep(x, xv, xGoal, 100, 15, dt);
    render();
    const settled = Math.abs(p - pGoal) < 0.002 && Math.abs(pv) < 0.01 && Math.abs(x - xGoal) < 0.1 && Math.abs(xv) < 0.1;
    if (settled && pGoal === 0) { card.classList.remove('is-open'); active = null; raf = 0; return; }
    raf = settled ? 0 : requestAnimationFrame(tick);
  };
  const kick = () => {
    if (reduced) { p = pGoal; x = 0; render(); if (!pGoal) { card.classList.remove('is-open'); active = null; } return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };

  const fill = (a) => {
    card.href = a.href;
    card.target = a.target || '';
    card.rel = a.rel || '';
    const tpl = a.dataset.previewCard;
    frame.innerHTML = tpl && templates[tpl]
      ? templates[tpl]
      : `<img src="${a.dataset.preview}" alt="" width="280" height="175" decoding="async">`;
  };

  const open = (a) => {
    clearTimeout(closeTimer);
    if (active === a && pGoal === 1) return;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      const fresh = active !== a;
      active = a;
      if (fresh) { fill(a); if (p < 0.05) { x = 0; xv = 0; xGoal = 0; } }
      card.classList.add('is-open');
      place = placeCard(a.getBoundingClientRect(), card.offsetWidth, card.offsetHeight, document.documentElement.clientWidth);
      card.style.transformOrigin = place.below ? '50% 0' : '50% 100%';
      pGoal = 1;
      kick();
    }, 50);
  };
  const close = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { pGoal = 0; xGoal = 0; kick(); }, 100);
  };

  links.forEach((a) => {
    a.classList.add('lp');
    if (canHover) {
      a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(a); });
      a.addEventListener('pointerleave', close);
      a.addEventListener('pointermove', (e) => {
        if (reduced || active !== a) return;
        const r = a.getBoundingClientRect();
        xGoal = driftFor(e.clientX - r.left, r.width);
        kick();
      });
    }
    a.addEventListener('focus', () => open(a));
    a.addEventListener('blur', close);
  });
  // Moving onto the card keeps it open, like the hover card it imitates.
  card.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  card.addEventListener('pointerleave', close);
  // The card is placed in viewport coordinates, so scrolling or resizing ends it.
  addEventListener('scroll', () => { if (active) { pGoal = 0; xGoal = 0; kick(); } }, { passive: true });
  addEventListener('resize', () => { if (active) { pGoal = 0; kick(); } });
}
