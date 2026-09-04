/* Event recorder: the evidence contract between the prototype and the panel.
   window.__events is an array of {seq, t, kind, route, persona, theme, device, ...}. */
(function () {
  const Proto = (window.Proto = window.Proto || {});
  const t0 = performance.now();
  const events = (window.__events = []);
  let seq = 0;

  function ctx() {
    const p = window.__proto || {};
    return {
      route: (location.hash || '#/signin').slice(1),
      persona: p.persona || 'none',
      theme: p.theme || document.documentElement.getAttribute('data-theme') || 'light',
      device: p.device || document.documentElement.getAttribute('data-device') || 'desk',
    };
  }

  function record(kind, data) {
    const e = Object.assign({ seq: ++seq, t: Math.round(performance.now() - t0), kind }, ctx(), data || {});
    events.push(e);
    if (events.length > 20000) events.shift();
    return e;
  }

  function testidOf(el) {
    const n = el && el.closest ? el.closest('[data-testid]') : null;
    return n ? n.getAttribute('data-testid') : undefined;
  }

  document.addEventListener('click', (ev) => {
    const testid = testidOf(ev.target);
    // A click the browser synthesises from Enter or Space carries detail 0. The keydown was already
    // recorded, so mark this one so the tap formula counts one activation once (CONTRACTS §5).
    record('click', { testid, synthetic: ev.detail === 0 || undefined });
  }, true);

  document.addEventListener('keydown', (ev) => {
    const testid = testidOf(ev.target);
    // A key pressed inside a text field is typing, not tapping (CONTRACTS §5).
    const el = ev.target;
    const field = !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) || undefined;
    record('key', { testid, key: ev.key, field });
  }, true);

  document.addEventListener('focusin', (ev) => {
    const testid = testidOf(ev.target);
    if (testid) record('focus', { testid });
  }, true);

  window.addEventListener('hashchange', () => record('route', {}));

  window.addEventListener('error', (ev) => record('error', { message: String(ev.message || ev.error || 'error') }));
  window.addEventListener('unhandledrejection', (ev) => record('error', { message: String((ev.reason && ev.reason.message) || ev.reason || 'rejection') }));

  Proto.events = {
    record,
    refusal(code, verb, control) { return record('refusal', { code, verb, control }); },
    write(table, id) { return record('write', { table, id }); },
    reset() { events.length = 0; seq = 0; },
    all() { return events.slice(); },
  };
})();
