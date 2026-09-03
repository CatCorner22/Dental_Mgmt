/* UI helpers: element builder, buttons with the two identities, chips with shape glyphs,
   the shared Refusal component, dialogs, money and date formatting. */
(function () {
  const Proto = (window.Proto = window.Proto || {});

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'testid') el.setAttribute('data-testid', v);
      else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const GLYPH = { stop: '■', required: '▲', review: '◆', style: '●', info: '▬', clear: '●' };

  function btn(label, opts) {
    opts = opts || {};
    const kind = opts.kind || 'quiet'; // irreversible | reversible | quiet | held
    const b = h('button', { type: 'button', class: 'btn ' + kind + (opts.class ? ' ' + opts.class : ''), testid: opts.testid, onClick: opts.onClick, 'aria-pressed': opts.pressed, 'aria-label': opts.ariaLabel, 'aria-describedby': opts.describedby, title: opts.title, disabled: opts.disabled }, label);
    return b;
  }

  function chip(severity, word, opts) {
    opts = opts || {};
    return h('span', { class: 'chip ' + severity + (opts.big ? ' big' : ''), role: 'status', testid: opts.testid },
      h('span', { class: 'glyph', 'aria-hidden': 'true', text: GLYPH[severity] || '●' }), word);
  }

  /* Refusal: one verb line, one control, a Why disclosure, an aria-live announcement. */
  let refusalSeq = 0;
  function refusal(v) {
    // v: {code, verb, control, onControl, why, severity}
    const id = 'ref-' + (++refusalSeq);
    Proto.events.refusal(v.code, v.verb, v.control);
    Proto.router.announce(v.verb + (v.control ? '. ' + v.control : ''));
    const el = h('div', { class: 'refusal ' + (v.severity || 'required'), role: 'group', 'aria-labelledby': id, dataset: { code: v.code } },
      h('span', { class: 'verb', id, testid: 'refusal.verb', text: v.verb }),
      v.control ? btn(v.control, { kind: v.controlKind || 'reversible', testid: 'refusal.control', onClick: v.onControl, describedby: id }) : null,
      v.why ? h('details', null, h('summary', { testid: 'refusal.why' }, 'Why'), h('div', { class: 'whytext', text: v.why })) : null);
    return el;
  }

  function money(cents) {
    const neg = cents < 0; const a = Math.abs(cents);
    return (neg ? '−' : '') + '$' + (a / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function shortDate(iso) { const [y, m, d] = iso.split('-'); return Number(m) + '/' + Number(d); }
  function longDate(iso) { const [y, m, d] = iso.split('-'); return Number(m) + '/' + Number(d) + '/' + y; }
  function initials(name) { return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }
  function displayName(name, privacy) { return privacy ? initials(name) : name; }

  /* Dialog: focus trapped, Escape closes, returns close() */
  function dialog(content, opts) {
    opts = opts || {};
    const root = document.getElementById('dialogs');
    const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || 'Dialog' }, content);
    const overlay = h('div', { class: 'overlay' }, box);
    const prev = document.activeElement;
    function close() { overlay.remove(); if (prev && prev.focus) prev.focus(); document.removeEventListener('keydown', onKey, true); if (opts.onClose) opts.onClose(); }
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); close(); }
      if (ev.key === 'Tab') {
        const f = [...box.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"]), summary')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay && !opts.modal) close(); });
    root.append(overlay);
    const f = box.querySelector(opts.focus || 'input, button, [tabindex]');
    if (f) f.focus();
    return close;
  }

  function section(title, ...children) {
    return h('section', { class: 'card stack', 'aria-label': title }, h('h2', { text: title }), ...children);
  }

  function pageHead(title, sub, ...controls) {
    return h('div', { class: 'page-head' }, h('div', null, h('h1', { text: title }), sub ? h('p', { class: 'sub', text: sub }) : null), controls.length ? h('div', { class: 'btnrow' }, ...controls) : null);
  }

  Proto.ui = { h, btn, chip, refusal, money, shortDate, longDate, initials, displayName, dialog, section, pageHead, GLYPH };
})();
