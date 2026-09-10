/* Shell: top bar, Andon slot, author chip + PIN pad, role-derived nav, temp first-shift rail, canvas mount.
   Screen modules register themselves as Proto.screens.<name> = { render(r) } and call
   Proto.router.on('<route>', (r) => Proto.screens.<name>.render(r)). The canvas is #canvas. */
(function () {
  const Proto = window.Proto; const { h, btn, chip } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const NAV = {
    frontdesk: [['board', 'Board'], ['money', 'Money Desk'], ['roles', 'Roles']],
    temp: [['board', 'Board']],
    biller: [['money', 'Money Desk'], ['board', 'Board'], ['close', 'Daily Close'], ['roles', 'Roles']],
    hygienist: [['chairs', 'Chairs'], ['board', 'Board']],
    dentist: [['exams', 'Exams to sign'], ['chairs', 'Chairs'], ['board', 'Board']],
    surgeon: [['exams', 'Exams to sign'], ['board', 'Board']],
    owner: [['close', 'Daily Close'], ['money', 'Money Desk'], ['board', 'Board'], ['roles', 'Roles'], ['risk', 'Practice risk']],
    compliance: [['risk', 'Practice risk'], ['roles', 'Roles'], ['close', 'Daily Close']],
  };

  function canvas() { return document.getElementById('canvas'); }
  function mount(node) { const c = canvas(); c.replaceChildren(node); return c; }
  // A toggle that rebuilds the bar it lives in removes the element that had focus, so the keyboard fell to
  // body after every press. Each such handler puts the keyboard back on the control's replacement.
  function refocus(testid) { const el = document.querySelector('[data-testid="' + testid + '"]'); if (el) el.focus(); }

  let authorId = null;                                   // who the chip last painted; a store write may move it
  function renderTopbar(r) {
    const top = document.getElementById('topbar');
    const P = window.__proto; const S = Proto.store.get();
    // One word per concept: the theme control reads "Dark" / "Light" here, in the signed-in bar and on sign-in.
    // Sign-in mirrors the same option, so its canvas repaints with the bar. P.set repaints the bar itself.
    if (!r.persona) { authorId = null; top.replaceChildren(h('span', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'Riverbend Dental'), h('span', { class: 'spacer' }), btn(P.theme === 'dark' ? 'Light' : 'Dark', { testid: 'topbar.theme', ariaLabel: 'Switch to ' + (P.theme === 'dark' ? 'light' : 'dark'), onClick: () => { P.set({ theme: P.theme === 'dark' ? 'light' : 'dark' }); Proto.router.render(); refocus('topbar.theme'); } })); return; }
    const u = Proto.store.currentUser(); authorId = u.id;
    const loc = S.locations[0];
    const nav = h('nav', { 'aria-label': 'Primary' }, ...(NAV[r.persona] || NAV.frontdesk).map(([route, label]) => btn(label, { testid: 'nav.' + route, onClick: () => Proto.router.go(r.persona, route), class: r.route === route ? 'current' : '' })));
    nav.querySelectorAll('button').forEach((b) => { if (b.classList.contains('current')) b.setAttribute('aria-current', 'page'); });
    // A missing day pass is not a person: the chip says so instead of printing the placeholder's initials.
    const authorChip = h('button', { type: 'button', class: 'authorchip', testid: 'topbar.author', 'aria-label': 'Who is charting: ' + u.name + (u.licence ? ', ' + u.licence : '') + '. Switch author', onClick: () => openPinPad(r) }, h('span', { text: u.noPass ? u.short : (P.device === 'shared' || P.device === 'operatory') ? (Proto.ui.initials(u.name) + (u.licence ? ' · ' + u.licence : '')) : (u.short || u.name) }));
    top.replaceChildren(
      h('span', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'Riverbend'),
      btn(loc.short, { testid: 'topbar.location', ariaLabel: 'Location: ' + loc.name + '. Switch location', onClick: () => Proto.router.announce('Switch location: not in this prototype') }),
      btn('Search  ⌘K', { testid: 'topbar.search', ariaLabel: 'Search patients, claims, and actions (Ctrl or Cmd K)', onClick: () => Proto.screens.palette.open(r) }),
      nav,
      h('span', { class: 'spacer' }),
      authorChip,
      // "Privacy mode" is the one word for this control here, on sign-in and in the accessible name; the
      // pressed state is the ✓ mark and aria-pressed, never a second label.
      btn('Privacy mode', { testid: 'topbar.privacy', pressed: P.privacy, ariaLabel: 'Privacy mode: hide patient names on operatory glass', onClick: () => { P.set({ privacy: !P.privacy }); refocus('topbar.privacy'); } }),
      btn(P.theme === 'dark' ? 'Light' : 'Dark', { testid: 'topbar.theme', ariaLabel: 'Switch to ' + (P.theme === 'dark' ? 'light' : 'dark'), onClick: () => { P.set({ theme: P.theme === 'dark' ? 'light' : 'dark' }); refocus('topbar.theme'); } }),
      btn('Sign out', { testid: 'topbar.signout', onClick: () => { location.hash = '#/signin'; } }),
    );
  }

  const supportLine = Proto.ui.support;                 // one support line for every outage gate (ui.js)
  // The Andon stands on every home, so it prints what the phone card prints before Show name: initials and MRN
  // in place of the patient's name (docs/13 feature 24, minimum necessary). The sentence is still the store's.
  function minimumSentence(req) {
    const p = Proto.store.patient(req.patientId); const s = Proto.store.approvalSentence(req) || '';
    return p && p.name && s.includes(p.name) ? s.split(p.name).join(Proto.ui.initials(p.name) + ' · ' + p.mrn) : s;
  }

  function renderAndon(r) {
    const a = document.getElementById('andon'); const P = window.__proto;
    if (!r.persona) { a.replaceChildren(); return; }
    if (P.outage) {
      a.replaceChildren(chip('required', 'Server unreachable', {}), h('span', { class: 'grow', text: 'Showing the Board from 7:58 am · reads only, no postings · incident INC-2093' }), btn('Support line', { testid: 'andon.control', kind: 'reversible', onClick: supportLine }));
      return;
    }
    const pending = Proto.store.pendingApprovalsFor();      // one count for the Andon, the phone and the tab
    if (pending.length) { a.replaceChildren(chip('review', pending.length + ' approval' + (pending.length > 1 ? 's' : '') + ' waiting', {}), h('span', { class: 'grow', text: minimumSentence(pending[0]) }), btn('Open approvals', { testid: 'andon.control', kind: 'reversible', onClick: () => { location.hash = '#/phone/approvals'; } })); return; }
    a.replaceChildren();
  }

  // The PIN rule is the store's (verifyPin: the match, the device's three-miss count, the five-minute lock and the
  // practice finding the lock writes). Until the store carries it, this fallback keeps the count and the lock
  // here and claims no finding, because none is written.
  const pinLock = { misses: 0, until: 0 };
  const PIN_LOCK_MS = 5 * 60 * 1000;
  const LOCK_VERB = 'Wait five minutes — device locked';
  const NO_MATCH = { verb: 'Retype the PIN — no match', control: 'Clear and retype', why: 'Six digits at most. Three misses lock this device for five minutes.' };
  const lockedOut = () => ({ ok: false, code: 'pin_locked', verb: LOCK_VERB, control: 'Close', why: 'Three PINs missed in a row. This device takes no PIN for five minutes.' });
  const localLock = () => typeof Proto.store.verifyPin !== 'function' && pinLock.until > Date.now();
  function verifyPin(typed) {
    if (typeof Proto.store.verifyPin === 'function') return Proto.store.verifyPin(typed);
    if (pinLock.until > Date.now()) return lockedOut();
    const user = Proto.store.get().users.find((u) => u.pin === typed);
    if (user) { pinLock.misses = 0; return { ok: true, user }; }
    pinLock.misses += 1;
    if (pinLock.misses >= 3) { pinLock.misses = 0; pinLock.until = Date.now() + PIN_LOCK_MS; return lockedOut(); }
    return Object.assign({ ok: false, code: 'pin_no_match' }, NO_MATCH);
  }

  function openPinPad(r) {
    const P = window.__proto; const S = Proto.store.get();
    let digits = '';
    const dots = h('div', { class: 'pindots', 'aria-live': 'polite', text: '' });
    // The finish path carries the instruction alone. What switching costs is an explanation, so it sits
    // behind a disclosure instead of standing in front of the first digit.
    const status = h('p', { class: 'hint', text: 'Enter the other person\'s PIN' });
    const policy = h('details', null, h('summary', { class: 'small', testid: 'pin.why' }, 'Why this signs you out'),
      h('p', { class: 'small muted', text: P.device === 'desk' ? 'This desk is not shared, so switching signs you out and in as the other person.' : 'Their session opens on this page; yours is revoked and local drafts are wiped after autosave.' }));
    let close;
    const refusalSlot = h('div', { class: 'pin-refusal' });
    function showRefusal(v) { refusalSlot.replaceChildren(Proto.ui.refusal(v)); }
    // The store's refusal, the pad's way out: retype puts the keyboard on the first key, a lock or an outage
    // closes the pad (the outage gate's control is the support line, so it says the number the Andon's says).
    function showStoreRefusal(res) {
      const retype = () => { const k = pad.querySelector('[data-testid="pin.key.1"]'); if (k) k.focus(); };
      const out = res.code === 'pin_no_match' ? retype : res.code === 'outage' ? () => { close(); supportLine(); } : () => close();
      showRefusal({ code: res.code, verb: res.verb, control: res.control, why: res.why, onControl: out, severity: res.code === 'pin_no_match' ? 'required' : 'stop', fresh: res.code === 'pin_no_match' || res.code === 'pin_locked' });
    }
    function submit() {
      const typed = digits; digits = ''; dots.textContent = '';
      // An empty Go is not a miss: it is refused here without reaching the device's count.
      const res = typed ? verifyPin(typed) : Object.assign({ ok: false, code: 'pin_no_match' }, NO_MATCH);
      if (!res.ok) { showStoreRefusal(res); return; }
      const who = res.user;
      const persona = Object.entries(S.personaUser).find(([, uid]) => uid === who.id);
      if (!persona) {
        // No chart persona for this account in the prototype: refuse rather than write a session that changes nothing.
        showRefusal({ code: 'no_chart_session', verb: 'Keep the current author — no charting session', control: 'Keep current author', onControl: () => close(), why: who.short + ' can approve and post but does not chart, so there is nothing for that account to open on this screen. The author stays as it was and nothing was written.', severity: 'info' });
        return;
      }
      // The switch opens that person's session through the store, which writes the row and logs it. The shell
      // used to emit a write event for a table the store did not hold, so the log named a row nothing wrote.
      const opened = Proto.store.openSession(who.id);
      if (!opened.ok) { showStoreRefusal(opened); return; }
      close();
      const p = persona[0]; P.set({ persona: p });
      location.hash = '#/' + p + '/' + (r.route === 'signin' ? Proto.router.HOME[p] : r.route) + (r.id ? '/' + r.id : '');
      Proto.router.announce('Now charting as ' + who.name);
    }
    const pad = h('div', { class: 'pinpad' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => btn(String(d), { testid: 'pin.key.' + d, onClick: () => { if (digits.length < 6) { digits += d; dots.textContent = '•'.repeat(digits.length); } } })), btn('⌫', { testid: 'pin.backspace', ariaLabel: 'Backspace', onClick: () => { digits = digits.slice(0, -1); dots.textContent = '•'.repeat(digits.length); } }), btn('0', { testid: 'pin.key.0', onClick: () => { if (digits.length < 6) { digits += '0'; dots.textContent = '•'.repeat(digits.length); } } }), btn('Go', { testid: 'pin.submit', kind: 'irreversible', onClick: submit }));
    /* One PIN pad, one grammar. The phone step-up took typed digits, Backspace and Enter while this pad took
       clicks only, so the same four keystrokes filled one pad and left the other empty — and Go then refused
       a PIN nobody had failed to type. The listener lives only while the pad is open. */
    const onPadKey = (ev) => {
      const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const top = Proto.ui.topDialog(); if (!top || !top.contains(pad)) return;   // the top dialog owns the keyboard
      if (/^[0-9]$/.test(ev.key)) { ev.preventDefault(); if (digits.length < 6) { digits += ev.key; dots.textContent = '•'.repeat(digits.length); } }
      else if (ev.key === 'Backspace') { ev.preventDefault(); digits = digits.slice(0, -1); dots.textContent = '•'.repeat(digits.length); }
      else if (ev.key === 'Enter' && !(t && t.getAttribute && t.getAttribute('data-testid') === 'pin.cancel')) { ev.preventDefault(); submit(); }
    };
    document.addEventListener('keydown', onPadKey, true);
    // Escape, the backdrop and a route change close the dialog without passing through Cancel, so the listener
    // leaves with the dialog itself: a wrapper around close() left it alive and typed digits kept switching authors.
    close = Proto.ui.dialog(h('div', { class: 'stack' }, h('h2', { text: 'Who is charting?' }), status, refusalSlot, dots, pad, policy, btn('Cancel', { testid: 'pin.cancel', onClick: () => close() })), { label: 'Switch author', focus: '[data-testid="pin.key.1"]', onClose: () => document.removeEventListener('keydown', onPadKey, true) });
    // A locked device says so before the first digit (the fallback's lock; the store's shows on the first Go).
    if (localLock()) showStoreRefusal(lockedOut());
  }

  function renderRail1(r) {
    // temp first-shift rail: chips retire on the temp's own events
    let bar = document.getElementById('rail1');
    if (r.persona !== 'temp') { if (bar) bar.remove(); return; }
    const S = Proto.store.get(); const steps = Proto.store.railSteps();
    if (!bar) { bar = h('div', { class: 'rail1', id: 'rail1', 'aria-label': 'Your first shift' }); document.getElementById('andon').after(bar); }
    if (S.rail1Collapsed) { bar.replaceChildren(btn('Show first-shift steps', { testid: 'rail1.toggle', onClick: () => { S.rail1Collapsed = false; renderRail1(r); refocus('rail1.toggle'); } })); return; }
    bar.replaceChildren(h('span', { class: 'small muted', text: 'Your first shift:' }), ...steps.map(([code, label], i) => { const retired = !!Proto.store.railStateFor()[code]; return btn(retired ? label + ' ✓' : label, { testid: 'rail1.chip.' + i, dataset: { retired: retired ? '1' : '0' }, ariaLabel: label + (retired ? ', done' : ', show me'), onClick: () => pulseFor(code, r) }); }), btn('Hide', { testid: 'rail1.toggle', onClick: () => { S.rail1Collapsed = true; renderRail1(r); refocus('rail1.toggle'); } }));
  }
  // One timer per ring. A single shared timer let the next press cancel the previous element's clear, so the
  // ring from an earlier "show me" stayed on its control for the rest of the shift.
  const pointTimers = new Map();
  function pulseFor(code, r) {
    // Payment is posted from Checkout; on the Board the step points at the Checkout control that gets there.
    const map = { arrive: '[data-testid$=".arrive"]', seat: '[data-testid$=".seat"]', checkout: '[data-testid$=".checkout"]', payment: '[data-testid="checkout.post"], [data-testid$=".checkout"]', find: '[data-testid="topbar.search"]', perio: '[data-testid$=".perio"]', save: '[data-testid="perio.save"]', tag: '[data-testid="perio.tag.add"]', ready: '[data-testid$=".ready"]' };
    const el = document.querySelector(map[code]);
    let verb = { arrive: 'Tap Arrive on the first card', seat: 'Seat the arrived patient', checkout: 'Open Checkout from the card', payment: 'Post after choosing a tender', find: 'Type three letters of a name', perio: 'Tap Perio on your first card', save: 'Save the exam', tag: 'Tag a tooth for the dentist', ready: 'Mark ready for exam' }[code];
    if (code === 'payment' && el && el.getAttribute('data-testid') !== 'checkout.post') verb = 'Open Checkout from the card, then post';
    if (el) {
      el.classList.remove('pulse', 'pointed'); void el.offsetWidth;
      el.classList.add('pulse', 'pointed');                       // 'pointed' is a static ring: it survives reduced motion
      el.scrollIntoView({ block: 'center' });
      clearTimeout(pointTimers.get(el)); pointTimers.set(el, setTimeout(() => { el.classList.remove('pointed'); pointTimers.delete(el); }, 6000));
      Proto.router.announce(verb);
    }
    else Proto.router.announce(code === 'checkout' || code === 'payment' ? 'Nothing to check out yet' : 'Nothing to do for this step yet');
  }

  // Every screen refreshes the Andon after a store write; a write on a shared device can also move the current
  // author (a PIN post opens that person's session), so the chip repaints with it.
  function refreshAndon(r) { renderAndon(r); if (r.persona && Proto.store.currentUser().id !== authorId) renderTopbar(r); }

  Proto.screens.shell = {
    render(r) { renderTopbar(r); renderAndon(r); renderRail1(r); document.getElementById('rail').hidden = !Proto.screens.rail || !Proto.screens.rail.isOpen(); },
    mount, canvas, openPinPad, refreshAndon, refreshRail1: renderRail1,
  };

  // A hash with no persona in it still has a way home: the persona signed in, or sign-in itself.
  Proto.router.on('notfound', (r) => mount(h('div', { class: 'stack' }, h('h1', { text: 'Nothing here' }), btn('Back to home', { testid: 'notfound.home', onClick: () => { const p = r.persona || window.__proto.persona; if (Proto.router.HOME[p]) Proto.router.go(p, Proto.router.HOME[p]); else location.hash = '#/signin'; } }))));

  // The skip link moves the keyboard, never the route: its href is a hash the router would read as a persona.
  const skip = document.querySelector('[data-testid="skip.canvas"]');
  if (skip) skip.addEventListener('click', (ev) => { ev.preventDefault(); canvas().focus(); });

  // One dialog at a time: Ctrl+K yields to a pad or palette already open (docs/04).
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) { const r = Proto.router.current(); if (r.persona) { ev.preventDefault(); if (!Proto.ui.topDialog()) Proto.screens.palette.open(r); } }
  });
})();
