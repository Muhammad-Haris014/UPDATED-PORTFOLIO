// Experience & education as a git commit graph. Education is the long-running lane on the left
// (still in progress, so it carries on dashed above its last commit); the work branch forks off it
// and runs up to HEAD. The graph is measured from the commits themselves, so it always lines up.

/** Lane centres in the gutter, px. CSS places the commit dots on the same x. */
export const LANE_X = [18, 46];

/** A branch curve from (x1, y1) on the upper lane down into (x0, y0) on the lower one. */
export function forkPath(x1, y1, x0, y0) {
  const m = (y0 - y1) * 0.55;
  return `C${x1},${(y1 + m).toFixed(1)} ${x0},${(y0 - m).toFixed(1)} ${x0},${y0.toFixed(1)}`;
}

/** The three lane paths, top to bottom, from the dot centres of the commits on each lane. */
export function lanePaths({ work, fork, edu }) {
  const [x0, x1] = LANE_X;
  const lastWork = work[work.length - 1];
  const workD = `M${x1},0` + work.map((y) => `L${x1},${y.toFixed(1)}`).join('') + forkPath(x1, lastWork, x0, fork);
  const eduD = `M${x0},${fork.toFixed(1)}` + edu.map((y) => `L${x0},${y.toFixed(1)}`).join('');
  const wipD = `M${x0},0L${x0},${fork.toFixed(1)}`;
  return { workD, eduD, wipD };
}

export function mountGitlog(section) {
  const root = section.querySelector('.gitlog');
  const svg = root.querySelector('.gitlog-graph');
  const list = root.querySelector('.gitlog-list');
  const commits = [...list.children];
  const typed = section.querySelector('.xp-typed');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const centreY = (li) => {
    const dot = li.querySelector('.commit-dot');
    const r = dot.getBoundingClientRect(), base = list.getBoundingClientRect();
    return r.top - base.top + r.height / 2;
  };

  const draw = () => {
    const H = list.offsetHeight;
    const fork = commits.find((li) => li.hasAttribute('data-fork'));
    const forkIdx = commits.indexOf(fork);
    const { workD, eduD, wipD } = lanePaths({
      work: commits.filter((li) => li.dataset.lane === '1').map(centreY),
      fork: centreY(fork),
      edu: commits.slice(forkIdx + 1).map(centreY),
    });
    svg.setAttribute('viewBox', `0 0 64 ${H}`);
    svg.style.height = H + 'px';
    // Pulses ride each lane bottom-to-top (the paths run top-down, so keyPoints play them in reverse),
    // a few per lane at staggered starts, like history flowing up to HEAD.
    const pulses = (id, lane, count, dur) => reduced ? '' : Array.from({ length: count }, (_, i) =>
      `<circle class="lane-pulse on-${lane}" r="${i % 2 ? 2.6 : 3.4}">
        <animateMotion dur="${dur}s" begin="${(-i * dur) / count}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#${id}"/></animateMotion>
      </circle>`).join('');
    svg.innerHTML = `
      <defs>
        <linearGradient id="gl-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3ddc84" stop-opacity="0"/><stop offset=".06" stop-color="#3ddc84"/><stop offset=".22" stop-color="var(--accent)"/>
        </linearGradient>
      </defs>
      <path class="lane-glow lane-0" d="${eduD}"/>
      <path class="lane-glow lane-1" d="${workD}"/>
      <path class="lane lane-0 lane-wip" d="${wipD}"/>
      <path class="lane lane-0" id="gl-edu" d="${eduD}"/>
      <path class="lane lane-1" id="gl-work" d="${workD}"/>
      ${pulses('gl-edu', 0, 2, 4.5)}
      ${pulses('gl-work', 1, 3, 5.5)}`;
  };

  // Hovering a commit lights its lane, and a spotlight follows the pointer across its card.
  commits.forEach((li) => {
    const card = li.querySelector('.commit-card');
    li.addEventListener('mouseenter', () => { root.dataset.hoverLane = li.dataset.lane; });
    li.addEventListener('mouseleave', () => { delete root.dataset.hoverLane; });
    card?.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
      card.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
    });
  });

  // The command types itself the first time the section comes into view.
  const full = typed?.textContent || '';
  if (typed && !reduced) {
    typed.textContent = '';
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      let i = 0;
      const t = setInterval(() => { typed.textContent = full.slice(0, ++i); if (i >= full.length) clearInterval(t); }, 38);
    }, { threshold: 0.6 });
    // Watch the command line itself: the whole section is taller than a phone screen.
    io.observe(typed.closest('.xp-cmd') || typed);
  }

  draw();
  new ResizeObserver(draw).observe(list);
  document.fonts?.ready.then(draw);
}
