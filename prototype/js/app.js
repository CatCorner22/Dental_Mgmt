/* Boot: global options, __proto API, render loop. */
(function () {
  const Proto = window.Proto;
  const root = document.documentElement;
  const P = (window.__proto = { ready: false, persona: null, theme: 'light', device: 'desk', outage: false, privacy: false, motion: 'auto', grayscale: false });

  P.set = function (opts) {
    opts = opts || {};
    if (opts.theme) { P.theme = opts.theme; root.setAttribute('data-theme', opts.theme); }
    if (opts.device) { P.device = opts.device; root.setAttribute('data-device', opts.device); }
    if (opts.outage != null) { P.outage = !!opts.outage && opts.outage !== '0'; Proto.store.get().outage = P.outage; }
    if (opts.privacy != null) { P.privacy = !!opts.privacy && opts.privacy !== '0'; root.toggleAttribute('data-privacy', P.privacy); }
    if (opts.grayscale != null) { P.grayscale = !!opts.grayscale && opts.grayscale !== '0'; if (P.grayscale) root.setAttribute('data-grayscale', '1'); else root.removeAttribute('data-grayscale'); }
    if (opts.motion) { P.motion = opts.motion; if (opts.motion === 'reduced') root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion'); }
    if (opts.persona) P.persona = opts.persona;
    if (opts.afterHours != null) Proto.store.get().clock.afterHours = !!opts.afterHours && opts.afterHours !== '0';
  };
  P.reset = function (seed) { Proto.store.reset(seed); Proto.events.reset(); Proto.router.render(); };
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
    Proto.screens.shell.render(r);
    Proto.router.render();
    if (changed) {
      // A new screen opens at its own top with its heading in view, and the keyboard lands on it.
      const c = document.getElementById('canvas');
      c.scrollTop = 0; window.scrollTo(0, 0);
      const first = c.querySelector('h1, [data-testid]');
      if (first && typeof first.focus === 'function') { const restore = first.getAttribute('tabindex'); if (restore == null) first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
      else c.focus({ preventScroll: true });
      lastRoute = r.raw.split('?')[0];
    }
    P.ready = true;
  }
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/signin';
  render();
})();
