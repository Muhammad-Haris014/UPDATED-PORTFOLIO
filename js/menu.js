// Kinetic full-screen menu. Opening: the overlay fades in, three backdrop layers slide in from
// the right one after another (accent, paper, ink), the links rise and straighten through their
// masks, then the small print fades up. Closing slides the whole panel away. Hovering a link
// glides a soft glow to it, rolls a giant outlined numeral to its index and names the section.

export const EASE_MAIN = 'cubic-bezier(.65, .01, .05, .99)';

/** Start times (ms) of the open sequence, so the choreography reads in one place. */
export function openSchedule(layers, links, fades) {
  const linksAt = 350;
  return {
    layers: Array.from({ length: layers }, (_, i) => i * 120),
    links: Array.from({ length: links }, (_, i) => linksAt + i * 50),
    fades: Array.from({ length: fades }, (_, i) => linksAt + 200 + i * 40),
  };
}

export function mountMenu({ button, menu, header, inertTargets = [] }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const overlay = menu.querySelector('.menu-overlay');
  const panel = menu.querySelector('.menu-panel');
  const layers = [...menu.querySelectorAll('.backdrop-layer')];
  const links = [...menu.querySelectorAll('.nav-link')];
  const fades = [...menu.querySelectorAll('[data-menu-fade]')];
  let isOpen = false;
  let running = [];

  const play = (el, keyframes, opts) => {
    const a = el.animate(keyframes, { easing: EASE_MAIN, fill: 'both', ...opts });
    running.push(a);
    return a;
  };
  const stopAll = () => { running.forEach((a) => a.cancel()); running = []; };
  const setInert = (on) => inertTargets.forEach((el) => { if (el) el.inert = on; });

  function open() {
    if (isOpen) return;
    isOpen = true;
    stopAll();
    menu.hidden = false;
    menu.dataset.nav = 'open';
    header.classList.add('menu-open');
    button.setAttribute('aria-expanded', 'true');
    root.classList.add('menu-locked');
    setInert(true);

    if (!reduced) {
      const at = openSchedule(layers.length, links.length, fades.length);
      play(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: 700 });
      layers.forEach((el, i) => play(el, [{ transform: 'translateX(101%)' }, { transform: 'translateX(0)' }], { duration: 575, delay: at.layers[i] }));
      links.forEach((el, i) => play(el, [{ transform: 'translateY(140%) rotate(10deg)' }, { transform: 'none' }], { duration: 700, delay: at.links[i] }));
      fades.forEach((el, i) => play(el, [{ opacity: 0, transform: 'translateY(50%)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: at.fades[i] }));
    }
    // Focus moves into the menu once the first link is on its way up.
    setTimeout(() => { if (isOpen) links[0]?.focus({ preventScroll: true }); }, reduced ? 0 : 420);
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    menu.dataset.nav = 'closed';
    header.classList.remove('menu-open');
    button.setAttribute('aria-expanded', 'false');
    // Unlock straight away so a link can scroll the page while the panel slides off.
    root.classList.remove('menu-locked');
    setInert(false);
    if (restoreFocus) button.focus({ preventScroll: true });

    const done = () => { if (!isOpen) { stopAll(); menu.hidden = true; } };
    if (reduced) { done(); return; }
    stopAll();
    play(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 });
    play(panel, [{ transform: 'translateX(0)' }, { transform: 'translateX(120%)' }], { duration: 700 }).finished.then(done, () => {});
  }

  button.addEventListener('click', () => (isOpen ? close() : open()));
  menu.querySelectorAll('[data-menu-close]').forEach((el) => el.addEventListener('click', () => close()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) { e.preventDefault(); close(); } });

  // Section links: close, then scroll to the section once the page is unlocked.
  links.forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id?.startsWith('#') && document.querySelector(id);
    if (!target) { close({ restoreFocus: false }); return; }
    e.preventDefault();
    close({ restoreFocus: false });
    history.pushState(null, '', id);
    requestAnimationFrame(() => target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
  }));

  // Keep Tab inside the open menu: the page behind is inert, so cycle between the button and the menu.
  addEventListener('keydown', (e) => {
    if (!isOpen || e.key !== 'Tab') return;
    const order = [button, ...menu.querySelectorAll('a[href]')];
    const i = order.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); order.at(-1).focus(); }
    else if (!e.shiftKey && i === order.length - 1) { e.preventDefault(); order[0].focus(); }
  });

  // Hover: the glow glides to the link and takes on its colours, the numeral rolls to its index,
  // and the eyebrow names the section.
  const glow = menu.querySelector('.menu-glow');
  const track = menu.querySelector('.menu-index-track');
  const eyebrow = menu.querySelector('.menu-eyebrow-text');
  const eyebrowRest = eyebrow?.textContent || '';
  const items = [...menu.querySelectorAll('.menu-list-item')];
  let hovered = -1;

  const say = (text) => {
    if (!eyebrow || eyebrow.textContent === text) return;
    if (reduced) { eyebrow.textContent = text; return; }
    eyebrow.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 140, easing: 'ease-in' })
      .finished.then(() => {
        eyebrow.textContent = text;
        eyebrow.animate([{ opacity: 0, filter: 'blur(4px)', transform: 'translateY(40%)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      }, () => {});
  };
  const focusItem = (i) => {
    if (i === hovered) return;
    hovered = i;
    const item = items[i];
    const p = panel.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    const [g1, g2] = (item.dataset.glow || '#ff5a1f,#c679c4').split(',');
    glow?.style.setProperty('--g1', g1.trim());
    glow?.style.setProperty('--g2', (g2 || g1).trim());
    glow?.style.setProperty('--gy', `${(r.top - p.top + r.height / 2).toFixed(1)}px`);
    track?.style.setProperty('--i', String(i));
    panel.classList.add('is-hovering');
    say(item.dataset.hint || eyebrowRest);
  };
  const rest = () => {
    hovered = -1;
    panel.classList.remove('is-hovering');
    say(eyebrowRest);
  };
  items.forEach((item, i) => {
    item.addEventListener('mouseenter', () => focusItem(i));
    item.addEventListener('focusin', () => focusItem(i));
  });
  menu.querySelector('.menu-list')?.addEventListener('mouseleave', rest);
  menu.querySelector('.menu-list')?.addEventListener('focusout', (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) rest();
  });
  button.addEventListener('click', () => { if (!isOpen) rest(); });

  return { open, close };
}
