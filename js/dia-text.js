// Dia text: a band of colour sweeps through the words, leaving them in the text colour.
// With several phrases it repeats, swapping to the next phrase after each sweep: the new
// phrase blurs into focus and the box eases to its width.

export const DEFAULT_COLORS = ['#c679c4', '#fa3d1d', '#ffb005', '#a5a6f6', '#0358f7'];
const BAND_HALF = 17;
export const SWEEP_START = -BAND_HALF;
export const SWEEP_END = 100 + BAND_HALF;

export const sweepEase = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The text's background at sweep position `pos` (percent of its width). Left of the band the
 * text is solid; the band holds the colours; right of it is transparent (not yet revealed).
 */
export function buildGradient(pos, colors, textColor) {
  const bandStart = pos - BAND_HALF;
  const bandEnd = pos + BAND_HALF;
  if (bandStart >= 100) return `linear-gradient(90deg, ${textColor}, ${textColor})`;
  const count = colors.length;
  const parts = [];
  if (bandStart > 0) parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`);
  colors.forEach((color, i) => {
    const pct = count === 1 ? pos : bandStart + (i / (count - 1)) * BAND_HALF * 2;
    parts.push(`${color} ${pct.toFixed(2)}%`);
  });
  if (bandEnd < 100) parts.push(`transparent ${bandEnd.toFixed(2)}%`, 'transparent 100%');
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/**
 * Turn `el` into a sweeping text. Phrases come from `texts`, or `data-dia` (a string or a JSON
 * array); `data-dia-repeat` cycles them.
 */
export function mountDiaText(el, {
  texts = parseTexts(el),
  colors = DEFAULT_COLORS,
  // Not currentColor: the glyphs themselves are transparent, so that would vanish.
  textColor = getComputedStyle(el).color,
  duration = 1.5,
  delay = 0,
  repeat = el.hasAttribute('data-dia-repeat'),
  repeatDelay = 1.1,
} = {}) {
  if (!texts.length) return;
  const multi = texts.length > 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.classList.add('dia');
  el.classList.toggle('dia-multi', multi);
  el.textContent = '';
  const inner = document.createElement('span');
  inner.className = 'dia-inner';
  inner.setAttribute('aria-hidden', 'true');
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  el.append(inner, sr);

  let index = 0;
  const setText = (i) => { inner.textContent = texts[i]; sr.textContent = texts[i]; };
  setText(0);

  // Reduced motion: the words are simply there, in the text colour, and stay put.
  if (reduced) {
    inner.style.backgroundImage = buildGradient(SWEEP_END, colors, textColor);
    return;
  }
  inner.style.backgroundImage = buildGradient(SWEEP_START, colors, textColor);

  // Widths of every phrase, measured in the element's own type, so the box can ease between them.
  let widths = [];
  const measure = () => {
    if (!multi) return;
    const ghost = inner.cloneNode();
    Object.assign(ghost.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', width: 'auto' });
    el.appendChild(ghost);
    widths = texts.map((t) => { ghost.textContent = t; return ghost.getBoundingClientRect().width; });
    ghost.remove();
    el.style.width = widths[index] + 'px';
  };

  // Hidden tabs pause animation frames on their own, and the sweep is time-based, so it simply
  // resumes where it should be.
  let raf = 0;
  const sweep = () => {
    cancelAnimationFrame(raf);
    const t0 = performance.now() + delay * 1000;
    const step = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / (duration * 1000)));
      inner.style.backgroundImage = buildGradient(SWEEP_START + (SWEEP_END - SWEEP_START) * sweepEase(p), colors, textColor);
      if (p < 1) { raf = requestAnimationFrame(step); return; }
      if (repeat && multi) setTimeout(next, repeatDelay * 1000);
    };
    raf = requestAnimationFrame(step);
  };
  const next = () => {
    index = (index + 1) % texts.length;
    setText(index);
    el.style.width = widths[index] + 'px';
    inner.animate(
      [{ opacity: 0.58, filter: 'blur(8px)', transform: 'translateY(5.5px)' }, { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' }],
      { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
    sweep();
  };

  measure();
  document.fonts?.ready.then(measure);
  addEventListener('resize', measure);

  // Play once, the first time it comes into view.
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    sweep();
  }, { threshold: 0.1 });
  io.observe(el);
}

function parseTexts(el) {
  const raw = el.dataset.dia ?? el.textContent.trim();
  if (raw.startsWith('[')) {
    try { return JSON.parse(raw).map(String).filter(Boolean); } catch { /* fall through */ }
  }
  return raw ? [raw] : [];
}
