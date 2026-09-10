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

  const GLYPH = { stop: '■', required: '▲', review: '◆', style: '★', info: '▬', clear: '●' };

  function btn(label, opts) {
    opts = opts || {};
    const kind = opts.kind || 'quiet'; // irreversible | reversible | quiet | held
    // aria-pressed must be the word: h() would write boolean true as an empty attribute (aria-pressed="").
    const pressed = opts.pressed == null ? null : opts.pressed === true ? 'true' : opts.pressed === false ? 'false' : String(opts.pressed);
    // A held primary reads exactly "Held". It used to keep whatever label it was given — "Close day",
    // "Choose a reason above", "Held · day closed" — so the one word that names the identity was optional.
    // What is held stays in the accessible name; the verb line beside it says what to do next.
    const held = kind === 'held';
    const visible = held ? 'Held' : label;
    // The second click of a double-click is the tail of the first gesture, not a decision. A primary that renders in
    // the slot another primary just left (Arrive → Seat, one Confirm row under the next) would otherwise take it and
    // act; a bare key sends detail 0 and a single click detail 1, so both still pass. Quiet keys (pads, toggles) are
    // pressed in runs on purpose and keep every click.
    const primary = kind === 'irreversible' || kind === 'reversible';
    const onClick = primary && opts.onClick ? (ev) => (ev.detail > 1 ? ev.currentTarget.focus() : opts.onClick(ev)) : opts.onClick;
    const b = h('button', { type: 'button', class: 'btn ' + kind + (opts.class ? ' ' + opts.class : ''), testid: opts.testid, onClick, 'aria-pressed': pressed, 'aria-label': opts.ariaLabel || (held ? 'Held: ' + label : null), 'aria-describedby': opts.describedby, title: opts.title || (held ? String(label) : null), disabled: opts.disabled, dataset: opts.dataset }, visible);
    // Selection is never colour alone: a pressed control carries a check mark as well as its fill.
    if (pressed === 'true') b.prepend(h('span', { class: 'pressmark', 'aria-hidden': 'true', text: '✓' }));
    return b;
  }

  function chip(severity, word, opts) {
    opts = opts || {};
    return h('span', { class: 'chip ' + severity + (opts.big ? ' big' : ''), role: 'status', testid: opts.testid },
      h('span', { class: 'glyph', 'aria-hidden': 'true', text: GLYPH[severity] || '●' }), word);
  }

  /* Refusal: one verb line, one control, a Why disclosure, an aria-live announcement of the verb alone. */
  let refusalSeq = 0;
  let lastGate = null;                                  // the gate this screen has already logged and announced
  function resetGates() { lastGate = null; }
  function refusal(v) {
    // v: {code, verb, control, onControl, why, severity}
    const id = 'ref-' + (++refusalSeq);
    const sev = v.severity || 'required';
    // A screen that re-renders rebuilds the gate it is already showing. Logging and announcing on every
    // construction turned one visible gate into six refusal events and read the verb aloud again each time,
    // so the event log counted gates that were never raised. The same gate is logged once until it changes —
    // unless the caller says the press raised it again (`fresh`): a second wrong PIN or date of birth reads
    // the same as the first and is still a second refusal — and `scope` (the pressing control's test id) tells the
    // same words raised by another control apart, so Keep, Tighten and Retire on one card each log their gate.
    const key = v.code + '|' + v.verb + '|' + (v.control || '') + '|' + (v.scope || '');
    if (lastGate !== key || v.fresh) {
      lastGate = key;
      Proto.events.refusal(v.code, v.verb, v.control);
      Proto.router.announce(v.verb);                    // one verb line: the control label is not read as a second sentence
    }
    // Two gates can stand on one page. Each keeps its own contract ids: renaming every earlier gate to
    // refusal.prior.* left the older of two card gates with no refusal.control. Only a dialog shadows the gates
    // beneath it, and it gives them back when it closes (see dialog()).
    const el = h('div', { class: 'refusal ' + sev, role: 'group', 'aria-labelledby': id, dataset: { code: v.code, severity: sev } },
      h('span', { class: 'glyph', 'aria-hidden': 'true', text: GLYPH[sev] || '▲' }),   // severity three ways: glyph, word, fill
      h('span', { class: 'sevword sr-only', text: sev === 'stop' ? 'Stop' : sev === 'required' ? 'Required' : sev === 'review' ? 'Review' : sev === 'clear' ? 'Clear' : 'Note' }),
      h('span', { class: 'verb', id, testid: 'refusal.verb', text: v.verb }),
      v.control ? btn(v.control, { kind: v.controlKind || 'reversible', testid: 'refusal.control', onClick: v.onControl, describedby: id }) : null,
      v.why ? h('details', null, h('summary', { testid: 'refusal.why' }, 'Why'), h('div', { class: 'whytext', text: v.why })) : null);
    return el;
  }

  function money(cents) {
    if (!Number.isFinite(cents)) return '—';
    const neg = cents < 0; const a = Math.abs(cents);
    return (neg ? '−' : '') + '$' + (a / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  /* A formatter is called with whatever the record holds, including nothing. These returned "$NaN", threw,
     or mis-parsed a stored timestamp; each now answers with an em dash rather than putting NaN on screen. */
  function dateParts(v) { const s = String(v == null ? '' : v).trim().split(/[ T]/)[0]; const p = s.split('-'); return p.length === 3 && p.every((x) => x !== '' && Number.isFinite(Number(x))) ? p : null; }
  function shortDate(iso) { const p = dateParts(iso); return p ? Number(p[1]) + '/' + Number(p[2]) : '—'; }
  function longDate(iso) { const p = dateParts(iso); return p ? Number(p[1]) + '/' + Number(p[2]) + '/' + p[0] : '—'; }
  // A stored "2026-09-03 08:40" reads as a date and a clock time, never as the raw string.
  function dateTime(v) { const s = String(v == null ? '' : v).trim(); const t = (s.split(/[ T]/)[1] || '').slice(0, 5); const d = longDate(s); return d === '—' ? '—' : d + (t ? ' at ' + t : ''); }
  /* One clock for every screen. The store holds 24-hour times; a person reads a 12-hour one. Chairs and the
     Board each carried a private copy of this and the Patient Rail carried none, so the same 9 am appointment
     read "9:00 am" on two screens and "09:00" on the third. */
  function time(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm == null ? '' : hhmm).trim());
    if (!m) return '—';
    const hh = Number(m[1]); const mm = m[2];
    if (!(hh >= 0 && hh <= 23) || Number(mm) > 59) return '—';
    return ((hh + 11) % 12 + 1) + ':' + mm + (hh < 12 ? ' am' : ' pm');
  }
  const HONORIFIC = /^(dr|mr|mrs|ms|mx|prof|sr|fr)\.?$/i;
  // Initials name the person, not the title: "Dr. Hana Kim" read "DH" in the author chip and "HK" in the
  // chair strip, so one shared device showed the same dentist two ways.
  function initials(name) { const parts = String(name == null ? '' : name).split(/\s+/).filter((p) => p && !HONORIFIC.test(p)); return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '—'; }
  function displayName(name, privacy) { return privacy ? initials(name) : (name == null ? '—' : name); }

  /* One support line for every outage gate. Six screens carried their own copy in two wordings, so the same
     "Support line" control read one sentence on the Board and another on Daily Close. */
  const SUPPORT = 'Call support: 615-555-0100, 7 am to 6 pm';
  const support = () => Proto.router.announce(SUPPORT);
  /* One word per stored appointment status, type and eligibility value. The Board and Chairs each held these
     tables; the eligibility words had drifted, so one amber visit read "Verify" on the Board and "Re-verify" on
     Chairs and the Rail. Severity first, then the word a person reads. */
  const STATUS = {
    scheduled: ['info', 'Scheduled'], confirmed: ['info', 'Confirmed'], arrived: ['review', 'Arrived'],
    seated: ['info', 'Seated'], in_chart: ['info', 'In chart'], ready_for_exam: ['review', 'Exam requested'],
    note_filed: ['clear', 'Note filed'], checked_out: ['clear', 'Done'], checked_out_unfiled: ['review', 'Filed later'],
  };
  const TYPE = { hygiene: ['clear', 'Hygiene'], restorative: ['style', 'Restorative'], exam: ['info', 'Exam'], surgery: ['stop', 'Surgery'], emergency: ['required', 'Emergency'] };
  const ELIG = { green: ['clear', 'Active'], amber: ['review', 'Re-verify'], red: ['required', 'Inactive'], none: ['info', 'Self-pay'] };
  const typeWord = (t) => (TYPE[t] || ['info', String(t || '').replace(/^./, (ch) => ch.toUpperCase())])[1];

  /* Dialog: focus trapped, Escape closes, returns close() */
  const dialogRoot = () => document.getElementById('dialogs');
  // The top dialog owns the keyboard: a pad's key handler asks before it takes a key.
  const topDialog = () => { const r = dialogRoot(); return r && r.lastElementChild ? r.lastElementChild.querySelector('.dialog') : null; };
  // A closing dialog puts the keyboard on the element that opened it — or, when a repaint replaced that element,
  // on its replacement (same test id), the dialog beneath, the heading or the first control. Never body.
  function landFocus(prev, prevId) {
    const c = document.getElementById('canvas');
    const top = topDialog();
    let el = top ? top.querySelector('button:not([disabled]), input, [tabindex]') : null;
    if (!el && prev && prev !== document.body && prev.isConnected) el = prev;
    if (!el && prevId) el = document.querySelector('[data-testid="' + prevId + '"]');
    if (!el && c) { el = c.querySelector('h1') || c.querySelector('button:not([disabled]), input, [tabindex]') || c; if (el.tagName === 'H1' && el.getAttribute('tabindex') == null) el.setAttribute('tabindex', '-1'); }
    if (el && el.focus) el.focus();
  }
  // A gate under an open dialog cannot be pressed, so the contract selectors must resolve to the dialog's own gate:
  // the gates beneath give up their ids (refusal.* → refusal.prior.*) while a dialog stands and take them back when
  // the last one closes. Gates on one layer never shadow each other.
  function shadowGates(on) {
    const from = on ? 'refusal.' : 'refusal.prior.', to = on ? 'refusal.prior.' : 'refusal.';
    for (const el of document.querySelectorAll('[data-testid^="' + from + '"]')) { const id = el.getAttribute('data-testid'); if (on ? !id.startsWith('refusal.prior.') && !el.closest('#dialogs') : true) el.setAttribute('data-testid', to + id.slice(from.length)); }
  }
  function dialog(content, opts) {
    opts = opts || {};
    const root = dialogRoot();
    const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || 'Dialog' }, content);
    const overlay = h('div', { class: 'overlay' }, box);
    const prev = document.activeElement; const prevId = prev && prev.getAttribute ? prev.getAttribute('data-testid') : null;
    let closed = false;
    function close() { if (closed) return; closed = true; overlay.remove(); if (!root.children.length) shadowGates(false); document.removeEventListener('keydown', onKey, true); window.removeEventListener('hashchange', close); if (opts.onClose) opts.onClose(); landFocus(prev, prevId); }
    if (!root.children.length) shadowGates(true);
    overlay._close = close;                        // closeDialogs() reaches every open dialog through its overlay
    window.addEventListener('hashchange', close); // a dialog never outlives the route it opened on
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
    // A press on the dialog's own prose (a verb line, the heading, the Why text) is nowhere the keyboard can go: the browser
    // moved focus to body, outside the modal, until the next Tab. The click still lands; only the focus move is refused.
    box.addEventListener('mousedown', (ev) => { if (!(ev.target.closest && ev.target.closest('button, input, select, textarea, summary, a[href], [tabindex]'))) ev.preventDefault(); });
    // The backdrop closes the dialog, so it is a control and carries an id like every other control.
    overlay.setAttribute('data-testid', 'dialog.backdrop');
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay && !opts.modal) close(); });
    root.append(overlay);
    const f = box.querySelector(opts.focus || 'input, button, [tabindex]');
    if (f) f.focus();
    return close;
  }
  // A rebuilt store leaves no dialog standing over it: each closes through its own close(), so onClose runs.
  function closeDialogs() { const r = dialogRoot(); if (r) for (const o of [...r.children]) if (o._close) o._close(); }

  function section(title, ...children) {
    return h('section', { class: 'card stack', 'aria-label': title }, h('h2', { text: title }), ...children);
  }

  function pageHead(title, sub, ...controls) {
    return h('div', { class: 'page-head' }, h('div', null, h('h1', { text: title }), sub ? h('p', { class: 'sub', text: sub }) : null), controls.length ? h('div', { class: 'btnrow' }, ...controls) : null);
  }

  Proto.ui = { h, btn, chip, refusal, resetGates, money, shortDate, longDate, dateTime, time, initials, displayName, dialog, topDialog, closeDialogs, shadowGates, section, pageHead, GLYPH, SUPPORT, support, STATUS, TYPE, ELIG, typeWord };
})();
