// Journey as a training run. The section pins while you scroll through it; scroll progress is the
// training clock. A loss curve draws itself down the graph paper while accuracy climbs, each year
// is a checkpoint on the curve, the year cards slide past, and a log line types each checkpoint.
// On small screens and with reduced motion it is a plain vertical timeline with the chart drawn.

/* ───────────── pure (tested) ───────────── */

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A believable loss curve: fast early drop, a few bumps that calm down as training goes on. */
export const lossAt = (x) => 0.06 + 0.86 * Math.exp(-3.4 * x) + (0.025 * Math.sin(23 * x) + 0.015 * Math.sin(57 * x)) * (1 - x);
/** Accuracy climbs towards ~0.95, mirroring the loss. */
export const accAt = (x) => 0.32 + 0.63 * (1 - Math.exp(-3.1 * x)) + 0.012 * Math.sin(31 * x) * (1 - x);

/** Chart y (viewBox 0–300, 0 at top) for a value in 0–1. */
export const yOf = (v) => 280 - v * 250;

/** An SVG path through `fn` sampled across the chart's 1000-wide viewBox. */
export function curvePath(fn, samples = 160) {
  let d = '';
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    d += (i ? 'L' : 'M') + (x * 1000).toFixed(1) + ',' + yOf(fn(x)).toFixed(1);
  }
  return d;
}

/** Scroll progress through a pinned track: 0 when its top reaches the viewport top, 1 when its bottom does. */
export const progressOf = (top, height, vh) => clamp01(-top / Math.max(1, height - vh));
/** Which epoch is training at progress p. */
export const activeIndex = (p, n) => Math.min(n - 1, Math.floor(p * n));
/** Where the card track sits: card k is centred at p = (k + 0.5) / n, its checkpoint. */
export const cardCenter = (p, n) => Math.max(0, Math.min(n - 1, p * n - 0.5));

/* ───────────── DOM ───────────── */

export function mountJourney(section) {
  const track = section.querySelector('.jr-track');
  const chart = section.querySelector('.jr-chart');
  const cardsEl = section.querySelector('.jr-cards');
  const cards = [...cardsEl.children];
  const n = cards.length;
  const lossLine = section.querySelector('.jr-loss-line');
  const accLine = section.querySelector('.jr-acc-line');
  const lossFill = section.querySelector('.jr-loss-fill');
  const scan = section.querySelector('.jr-scan');
  const epochEl = section.querySelector('.jr-epoch');
  const lossEl = section.querySelector('.jr-loss');
  const accEl = section.querySelector('.jr-acc');
  const logText = section.querySelector('.jr-log-text');
  const rail = section.querySelector('.jr-rail i');
  const staticMq = matchMedia('(max-width: 760px), (prefers-reduced-motion: reduce)');

  // Scroll length and the epoch total follow the number of years, so adding one is just a card.
  track.style.setProperty('--jr-length', `${100 + n * 80}vh`);
  const total = section.querySelector('.jr-readout small');
  if (total) total.textContent = '/' + String(n).padStart(2, '0');

  const lossD = curvePath(lossAt);
  lossLine.setAttribute('d', lossD);
  accLine.setAttribute('d', curvePath(accAt));
  lossFill.setAttribute('d', lossD + 'L1000,300L0,300Z');

  // A checkpoint on the curve for every year, with its year and a pencilled note.
  const nodes = cards.map((card, k) => {
    const x = (k + 0.5) / n;
    const node = document.createElement('span');
    // The last note writes leftwards, a line higher, so it stays on the paper and clears its neighbour.
    node.className = 'jr-node' + (k === n - 1 ? ' jr-node--end' : '');
    // On narrow paper the notes move onto their cards instead.
    const cardNote = document.createElement('p');
    cardNote.className = 'jr-card-note';
    cardNote.setAttribute('aria-hidden', 'true');
    cardNote.textContent = card.dataset.note || '';
    card.querySelector('.jr-meta')?.after(cardNote);
    node.style.left = (x * 100).toFixed(2) + '%';
    node.style.top = ((yOf(lossAt(x)) / 300) * 100).toFixed(2) + '%';
    const year = card.querySelector('.jr-meta span:last-child')?.textContent || '';
    node.innerHTML = `<i></i><em class="jr-note">${card.dataset.note || ''}</em><b class="jr-year">${year}</b>`;
    chart.appendChild(node);
    return { node, x };
  });

  let target = 0, shown = 0, raf = 0, active = -1, typing = 0, isStatic = false;
  let span = 0, cardW = 0, centerOffset = 0;

  const measure = () => {
    const gap = parseFloat(getComputedStyle(cardsEl).columnGap) || 24;
    cardW = cards[0].offsetWidth;
    span = cardW + gap;
    centerOffset = cardsEl.parentElement.clientWidth / 2 - cardW / 2 - cardsEl.offsetLeft;
  };

  const typeLog = (k) => {
    clearInterval(typing);
    const x = (k + 0.5) / n;
    const line = `$ ckpt save epoch_0${k + 1}/${cards[k].dataset.slug}  ·  loss ${lossAt(x).toFixed(3)}  acc ${accAt(x).toFixed(3)}  ✓ saved`;
    if (isStatic) { logText.textContent = line; return; }
    let i = 0;
    logText.textContent = '';
    typing = setInterval(() => {
      i += 2;
      logText.textContent = line.slice(0, i);
      if (i >= line.length) clearInterval(typing);
    }, 16);
  };

  const render = (p) => {
    const off = (1 - p).toFixed(4);
    lossLine.style.strokeDashoffset = off;
    accLine.style.strokeDashoffset = off;
    lossFill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
    scan.style.left = (p * 100).toFixed(3) + '%';
    scan.style.setProperty('--dot', ((yOf(lossAt(p)) / 300) * 100).toFixed(2) + '%');
    rail.style.transform = `scaleX(${p.toFixed(4)})`;

    epochEl.textContent = String(Math.min(n, Math.floor(p * n) + 1)).padStart(2, '0');
    lossEl.textContent = lossAt(p).toFixed(3);
    accEl.textContent = accAt(p).toFixed(3);
    nodes.forEach(({ node, x }) => node.classList.toggle('is-on', p >= x - 0.015));

    if (!isStatic) {
      const c = cardCenter(p, n);
      cardsEl.style.translate = `${(centerOffset - c * span).toFixed(1)}px 0`;
      cards.forEach((card, i) => card.style.setProperty('--d', Math.min(1.6, Math.abs(i - c)).toFixed(3)));
    }
    const k = activeIndex(p, n);
    if (k !== active) {
      active = k;
      cards.forEach((card, i) => card.classList.toggle('is-active', i === k));
      typeLog(k);
    }
  };

  // Ease the shown progress towards the scroll position, so fast scrolls still feel drawn.
  const tick = () => {
    raf = 0;
    shown += (target - shown) * 0.16;
    if (Math.abs(target - shown) < 0.0004) shown = target;
    render(shown);
    if (shown !== target) raf = requestAnimationFrame(tick);
  };
  const onScroll = () => {
    if (isStatic) return;
    const r = track.getBoundingClientRect();
    target = progressOf(r.top, r.height, innerHeight);
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const setMode = () => {
    isStatic = staticMq.matches;
    section.classList.toggle('jr-static', isStatic);
    cardsEl.style.translate = '';
    cards.forEach((card) => card.style.removeProperty('--d'));
    active = -1;
    if (isStatic) { shown = target = 1; render(1); return; }
    measure();
    onScroll();
    shown = target;
    render(shown);
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { if (!isStatic) { measure(); render(shown); } });
  staticMq.addEventListener('change', setMode);
  document.fonts?.ready.then(() => { if (!isStatic) { measure(); render(shown); } });
  setMode();
}
