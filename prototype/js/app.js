/* Boot: global options, __proto API, render loop. */
(function () {
  const Proto = window.Proto;
  const root = document.documentElement;
  const P = (window.__proto = { ready: false, persona: null, theme: 'light', device: 'desk', outage: false, privacy: false, motion: 'auto', grayscale: false });

  // Options hold only the CONTRACTS §3 values: an enum outside its list is ignored, and a boolean is read from
  // 1|true|0|false (or a real boolean) alone, so "false" is false and "purple" leaves the theme as it was.
  const THEMES = ['light', 'dark']; const DEVICES = ['desk', 'operatory', 'shared', 'phone']; const MOTIONS = ['auto', 'reduced'];
  const pick = (list, v) => (list.includes(v) ? v : null);
  const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? true : v === false || v === 0 || v === '0' || v === 'false' ? false : null);
  P.set = function (opts) {
    opts = opts || {};
    const theme = pick(THEMES, opts.theme); const device = pick(DEVICES, opts.device); const motion = pick(MOTIONS, opts.motion);
    const outage = flag(opts.outage); const privacy = flag(opts.privacy); const grayscale = flag(opts.grayscale); const afterHours = flag(opts.afterHours);
    if (theme) { P.theme = theme; root.setAttribute('data-theme', theme); }
    if (device) { P.device = device; root.setAttribute('data-device', device); }
    if (outage != null) { P.outage = outage; Proto.store.get().outage = P.outage; }
    if (privacy != null) { P.privacy = privacy; root.toggleAttribute('data-privacy', P.privacy); }
    if (grayscale != null) { P.grayscale = grayscale; if (P.grayscale) root.setAttribute('data-grayscale', '1'); else root.removeAttribute('data-grayscale'); }
    if (motion) { P.motion = motion; if (motion === 'reduced') root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion'); }
    if (opts.persona) P.persona = opts.persona;
    if (afterHours != null) Proto.store.get().clock.afterHours = afterHours;
  };
  // reset() rebuilds the store, so the outage flag it carried has to be put back or the Andon says the server
  // is unreachable while every posting verb happily writes.
  P.reset = function (seed) { Proto.store.reset(seed); Proto.store.get().outage = P.outage; Proto.events.reset(); if (Proto.ui.resetGates) Proto.ui.resetGates(); Proto.router.render(); };
  P.state = function () { return JSON.parse(JSON.stringify(Proto.store.get())); };
  P.events = function () { return Proto.events.all(); };

  Proto.store.reset();

  function applyQuery(q) {
    const o = {};
    for (const k of ['theme', 'device', 'outage', 'privacy', 'grayscale', 'motion', 'afterHours']) if (q[k] != null) o[k] = q[k];
    if (Object.keys(o).length) P.set(o);
  }

  let lastRoute = null;
  function render() {
    const r = Proto.router.current();
    const changed = lastRoute !== r.raw.split('?')[0];
    applyQuery(r.query);
    if (r.persona) P.persona = r.persona;
    if (changed && Proto.ui.resetGates) Proto.ui.resetGates();   // a new screen starts with no gate already announced
    Proto.screens.shell.render(r);
    Proto.router.render();
    if (changed) {
      // A new screen opens at its own top with its heading in view, and the keyboard lands on it.
      const c = document.getElementById('canvas');
      c.scrollTop = 0; window.scrollTo(0, 0);
      // Focus the heading, never the first control: stamping tabindex="-1" on whatever came first took a real
      // button (the Daily Close tile) out of the Tab order for the rest of the session.
      const head = c.querySelector('h1');
      if (head) { if (head.getAttribute('tabindex') == null) head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
      else c.focus({ preventScroll: true });
      lastRoute = r.raw.split('?')[0];
    } else {
      // Re-rendering the same path still replaces the canvas, so the keyboard has to be put back on it.
      const c = document.getElementById('canvas');
      if (document.activeElement === document.body || !c.contains(document.activeElement)) {
        const head = c.querySelector('h1');
        if (head) { if (head.getAttribute('tabindex') == null) head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
      }
    }
    P.ready = true;
  }
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/signin';
  render();
})();
