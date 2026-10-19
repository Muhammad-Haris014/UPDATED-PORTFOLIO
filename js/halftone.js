// Halftone wordmark footer: the wordmark set enormous, cropped by the bottom edge and printed
// as a field of dots. Each dot is sized by how much of the letter covers its cell. Move across
// it and the dots part around the pointer on springs, warming as they are pushed off their
// place; click and a shock ring runs through the word.

/** Hex → [r, g, b] in 0–255, or null for anything that isn't #rgb / #rrggbb. */
export function hwfHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Dot radius for a cell coverage in [0, 1]: area-true, so tone stays even. */
export function hwfRadius(coverage, gap) {
  const c = coverage < 0 ? 0 : coverage > 1 ? 1 : coverage;
  return Math.sqrt(c) * gap * 0.56;
}

/** One spring step home, plus the push from a pointer at (px, py) within radius r. → [x, y, vx, vy] */
export function hwfStep(x, y, vx, vy, hx, hy, px, py, r) {
  const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
  if (r > 0 && d2 < r * r) {
    const d = Math.sqrt(d2) + 0.001;
    const f = (1 - d / r) * 2.6;
    vx += (dx / d) * f;
    vy += (dy / d) * f;
  }
  vx = (vx + (hx - x) * 0.05) * 0.84;
  vy = (vy + (hy - y) * 0.05) * 0.84;
  return [x + vx, y + vy, vx, vy];
}

/** How warm a dot is drawn: 0 at home, 1 once it is `span` px or more away. */
export function hwfWarmth(x, y, hx, hy, span) {
  const d = Math.hypot(x - hx, y - hy);
  return span > 0 ? Math.min(1, d / span) : 0;
}

/** Font size that sets `measured` (width at 100px) to fill `width` exactly. */
export function hwfFitSize(measured, width) {
  return measured > 0 ? (width / measured) * 100 : 0;
}

/** Mount the dot field into `root` (which holds a <canvas>). Colours and type come from options. */
export function mountHalftone(root, {
  wordmark = 'haris',
  background = '#0c0c0b',
  ink = '#e9e4da',
  warm = '#ff5a1f',
  dotGap = 6,
  radius = 80,
  crop = 0.2,
  grain = 0.5,
  fontFamily = '"Inter Tight", "Helvetica Neue", Arial, sans-serif',
  fontWeight = 700,
} = {}) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inkRGB = hwfHex(ink) || [233, 228, 218];
  const warmRGB = hwfHex(warm) || [255, 90, 31];
  let w = 0, h = 0, dpr = 1, px = -1e5, py = -1e5, raf = 0, visible = true, awake = true;
  let ring = { x: 0, y: 0, t: -1 };
  let dots = new Float32Array(0); // x, y, vx, vy, hx, hy, r per dot
  let count = 0;
  let grainPattern = null;

  const layout = () => {
    const rect = root.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Set the word once, sized to fill the width, on a 1x mask.
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const m = mask.getContext('2d', { willReadFrequently: true });
    m.font = `${fontWeight} 100px ${fontFamily}`;
    const fit = hwfFitSize(m.measureText(wordmark).width, w * 1.02);
    m.font = `${fontWeight} ${fit}px ${fontFamily}`;
    const box = m.measureText(wordmark);
    const cap = box.actualBoundingBoxAscent || fit * 0.72;
    m.fillStyle = '#000';
    m.textBaseline = 'alphabetic';
    m.fillText(wordmark, (w - box.width) / 2, h + cap * Math.max(0, Math.min(0.6, crop)));
    const img = m.getImageData(0, 0, w, h).data;

    const gap = Math.max(3, dotGap);
    const cols = Math.ceil(w / gap), rows = Math.ceil(h / gap);
    const tmp = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        // Coverage: average alpha over a 3×3 sample of the cell.
        let sum = 0;
        for (let sy = 0; sy < 3; sy++) {
          for (let sx = 0; sx < 3; sx++) {
            const x = Math.min(w - 1, Math.floor(gx * gap + ((sx + 0.5) * gap) / 3));
            const y = Math.min(h - 1, Math.floor(gy * gap + ((sy + 0.5) * gap) / 3));
            sum += img[(y * w + x) * 4 + 3];
          }
        }
        const cov = sum / (9 * 255);
        if (cov < 0.06) continue;
        const hx = gx * gap + gap / 2, hy = gy * gap + gap / 2;
        tmp.push(hx, hy, 0, 0, hx, hy, hwfRadius(cov, gap));
      }
    }
    dots = new Float32Array(tmp);
    count = tmp.length / 7;

    // A fixed tile of print grain, drawn once and laid over every frame.
    const tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    const g = tile.getContext('2d');
    const id = g.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) {
      id.data[i] = id.data[i + 1] = id.data[i + 2] = Math.random() * 255;
      id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
    }
    g.putImageData(id, 0, 0);
    grainPattern = ctx.createPattern(tile, 'repeat');
    awake = true;
  };

  const draw = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    const r = reduced ? 0 : Math.max(0, radius);
    const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
    const ringR = ringAge * 0.9;
    let moving = false;
    for (let i = 0; i < count; i++) {
      const j = i * 7;
      let x = dots[j], y = dots[j + 1], vx = dots[j + 2], vy = dots[j + 3];
      const hx = dots[j + 4], hy = dots[j + 5];
      if (!reduced) {
        if (ringAge < 900) {
          const dx = hx - ring.x, dy = hy - ring.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
          const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
          if (band > 0) {
            const f = band * 3.2 * (1 - ringAge / 900);
            vx += (dx / d) * f;
            vy += (dy / d) * f;
          }
        }
        [x, y, vx, vy] = hwfStep(x, y, vx, vy, hx, hy, px, py, r);
        if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) moving = true;
        else { x = hx; y = hy; vx = 0; vy = 0; }
        dots[j] = x; dots[j + 1] = y; dots[j + 2] = vx; dots[j + 3] = vy;
      }
      const k = hwfWarmth(x, y, hx, hy, 28);
      ctx.fillStyle = k > 0.02
        ? `rgb(${Math.round(inkRGB[0] + (warmRGB[0] - inkRGB[0]) * k)},${Math.round(inkRGB[1] + (warmRGB[1] - inkRGB[1]) * k)},${Math.round(inkRGB[2] + (warmRGB[2] - inkRGB[2]) * k)})`
        : ink;
      ctx.beginPath();
      ctx.arc(x, y, dots[j + 6], 0, 6.2832);
      ctx.fill();
    }
    if (grainPattern && grain > 0) {
      ctx.globalAlpha = Math.min(1, grain) * 0.09;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // Sleep once everything is home and nothing is pushing.
    awake = moving || ringAge < 900 || px > -1e4;
  };

  const loop = (now) => {
    raf = 0;
    if (!visible) return;
    draw(now);
    if (awake) raf = requestAnimationFrame(loop);
  };
  const wake = () => {
    awake = true;
    if (!raf && visible) raf = requestAnimationFrame(loop);
  };
  const toLocal = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };

  root.addEventListener('pointermove', (e) => { [px, py] = toLocal(e); wake(); });
  root.addEventListener('pointerleave', () => { px = py = -1e5; wake(); });
  root.addEventListener('pointerdown', (e) => {
    if (reduced || e.target.closest('a,button')) return;
    const [x, y] = toLocal(e);
    ring = { x, y, t: performance.now() };
    wake();
  });

  layout();
  draw(performance.now());
  wake();
  let lastW = w;
  new ResizeObserver(() => {
    if (Math.round(root.getBoundingClientRect().width) === lastW && Math.round(root.getBoundingClientRect().height) === h) return;
    layout();
    lastW = w;
    wake();
  }).observe(root);
  new IntersectionObserver((entries) => {
    visible = entries[0] ? entries[0].isIntersecting : true;
    if (visible) wake();
  }).observe(root);
  // A web font that lands late re-sets the word in its real face.
  document.fonts?.ready.then(() => { layout(); wake(); });
}
