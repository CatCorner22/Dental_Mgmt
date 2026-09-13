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
  // A scripted set() (theme, device, motion) repaints the bars the same way: whichever control held the keyboard gets it
  // back by test id, or the bar's first control does — never body (focus-preservation rule).
  function keepFocus(bar, paint) {
    const a = document.activeElement; const holder = a && bar.contains(a) && a.closest ? a.closest('[data-testid]') : null;
    const had = holder ? holder.getAttribute('data-testid') : null;
    paint();
    if (had) { const el = bar.querySelector('[data-testid="' + had + '"]') || bar.querySelector('button'); if (el) el.focus({ preventScroll: true }); }
  }

  let authorId = null;                                   // who the chip last painted; a store write may move it
  function renderTopbar(r) {
    const top = document.getElementById('topbar');
    const P = window.__proto; const S = Proto.store.get();
    // One word per concept: the theme control reads "Dark" / "Light" here, in the signed-in bar and on sign-in.
    // Sign-in mirrors the same option, so its canvas repaints with the bar. P.set repaints the bar itself.
    if (!r.persona) { authorId = null; keepFocus(top, () => top.replaceChildren(h('span', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'Riverbend Dental'), h('span', { class: 'spacer' }), btn(P.theme === 'dark' ? 'Light' : 'Dark', { testid: 'topbar.theme', ariaLabel: 'Switch to ' + (P.theme === 'dark' ? 'light' : 'dark'), onClick: () => { P.set({ theme: P.theme === 'dark' ? 'light' : 'dark' }); Proto.router.render(); refocus('topbar.theme'); } }))); return; }
    const u = Proto.store.currentUser(); authorId = u.id;
    const loc = S.locations[0];
    // A nested screen belongs to the destination that leads to it, so that destination reads as
    // current: the Ledger under Money Desk, Checkout under the Board, Perio under Chairs, an
    // Encounter under Exams to sign (docs/16 CLT-jakob-nav; WCAG 2.4.8).
    const PARENT = { checkout: 'board', ledger: 'money', perio: 'chairs', encounter: 'exams' };
    const isCurrent = (route) => r.route === route || PARENT[r.route] === route;
    const nav = h('nav', { 'aria-label': 'Primary' }, ...(NAV[r.persona] || NAV.frontdesk).map(([route, label]) => btn(label, { testid: 'nav.' + route, onClick: () => Proto.router.go(r.persona, route), class: isCurrent(route) ? 'current' : '' })));
    nav.querySelectorAll('button').forEach((b) => { if (b.classList.contains('current')) b.setAttribute('aria-current', 'page'); });
    // A missing day pass is not a person: the chip says so instead of printing the placeholder's initials.
    const chipWord = u.noPass ? u.short : (P.device === 'shared' || P.device === 'operatory') ? (Proto.ui.initials(u.name) + (u.licence ? ' · ' + u.licence : '')) : (u.short || u.name);
    const authorChip = h('button', { type: 'button', class: 'authorchip btn quiet', testid: 'topbar.author', 'aria-label': Proto.ui.leadWithLabel(chipWord, 'Who is charting: ' + u.name + (u.licence ? ', ' + u.licence : '') + '. Switch author'), onClick: () => openPinPad(r) }, h('span', { text: chipWord }));
    /* The bar carries the four things a person needs from every screen: where they are,
       how to find a patient, where else they can go, and who is charting. Privacy, the
       colour scheme, the seven preferences and Sign out moved behind one Settings control,
       which took the signed-in bar from nine to eleven controls down to six to eight and
       stopped it scrolling sideways on a phone with six of ten controls off the edge
       (docs/16 CLT-topbar-7, WCAG 1.4.10). The location is a fact, not a control: it used
       to be a button whose only act was to say that switching is not in this prototype. */
    keepFocus(top, () => top.replaceChildren(
      h('span', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'Riverbend'),
      h('span', { class: 'loc', testid: 'topbar.location', title: loc.name, text: loc.short }),
      btn('Search  ⌘K', { testid: 'topbar.search', ariaLabel: 'Search patients, claims, and actions (Ctrl or Cmd K)', onClick: () => Proto.screens.palette.open(r) }),
      nav,
      // Below the phone breakpoint the destinations collapse into one control, so nothing
      // is pushed off the edge of the bar. The CSS shows exactly one of the two.
      btn('Go to', { class: 'navmenu', testid: 'nav.menu', ariaLabel: 'Go to another screen', onClick: () => openNavMenu(r) }),
      h('span', { class: 'spacer' }),
      authorChip,
      btn('Settings', { testid: 'topbar.settings', ariaLabel: 'Settings, privacy and sign out', onClick: () => openSettings(r) }),
    ));
  }

  /* Everything a person can set about how the product looks and behaves, in one place, at one
     level of depth. Seven preferences, each with two or three options and a default that needs
     no decision; the three whose equivalent the operating system already answers open on
     "System", so a reader who set dark mode or reduced motion for their machine is obeyed
     without touching this (docs/16 CUST-settings-surface-small, CUST-os-first-tristate).

     Privacy mode and Sign out sit apart from the preferences because they are not preferences:
     privacy belongs to the device in front of the patient, and signing out ends the session. */
  const PREF_WORDS = {
    theme: ['Colour scheme', { system: 'System', light: 'Light', dark: 'Dark' }],
    textSize: ['Text size', { default: 'Default', large: 'Large', larger: 'Larger' }],
    density: ['Density', { comfortable: 'Comfortable', compact: 'Compact' }],
    contrast: ['Contrast', { system: 'System', more: 'More' }],
    motion: ['Motion', { system: 'System', reduced: 'Reduced' }],
    colourAid: ['Colour-vision aid', { off: 'Off', grayscale: 'Grey only' }],
    shortcuts: ['Single-key shortcuts', { off: 'Off', on: 'On' }],
  };
  function openSettings(r) {
    const P = window.__proto;
    let close = null;
    const body = h('div', { class: 'stack settings' });
    function paint() {
      const pr = Proto.store.prefsFor();
      const device = P.device;
      const rows = Object.keys(PREF_WORDS).map((name) => {
        const [label, words] = PREF_WORDS[name];
        const options = Proto.store.PREF_OPTIONS[name];
        const id = 'set-' + name.toLowerCase();
        const note = name === 'density' && (device === 'shared' || device === 'operatory')
          ? 'This device keeps the comfortable spacing, whatever you set at your own desk.' : null;
        return h('div', { class: 'field' },
          h('span', { class: 'setlabel', id }, label),
          note ? h('p', { class: 'hint', text: note }) : null,
          h('div', { class: 'seg', role: 'group', 'aria-labelledby': id },
            ...options.map((o) => btn(words[o] || o, {
              testid: 'settings.' + name.toLowerCase() + '.' + o,
              pressed: pr[name] === o,
              onClick: () => { P.setPref(name, o); paint(); },
            }))));
      });
      keepFocus(body, () => body.replaceChildren(
        h('h2', { text: 'Settings' }),
        h('p', { class: 'hint', text: 'These are yours: they follow your PIN to any device in the practice.' }),
        h('div', { class: 'stack' }, ...rows),
        btn('Reset to defaults', { kind: 'reversible', testid: 'settings.reset', onClick: () => { Proto.store.resetPrefs(); P.applyPrefs(); paint(); Proto.router.announce('Settings reset to defaults'); } }),
        h('h3', { text: 'This device' }),
        h('p', { class: 'hint', text: 'Privacy belongs to the screen in front of the patient, not to you, so it stays with the device.' }),
        btn('Privacy mode', { testid: 'topbar.privacy', pressed: P.privacy, ariaLabel: 'Privacy mode: hide patient names on operatory glass', onClick: () => { P.set({ privacy: !P.privacy }); paint(); } }),
        h('div', { class: 'btnrow' },
          btn('Close', { kind: 'reversible', testid: 'settings.close', onClick: () => close && close() }),
          btn('Sign out', { testid: 'topbar.signout', onClick: () => { if (close) close(); location.hash = '#/signin'; } }))));
    }
    paint();
    close = Proto.ui.dialog(body, { label: 'Settings' });
  }

  /* On a phone the destinations live behind one control rather than scrolling off the bar. */
  function openNavMenu(r) {
    let close = null;
    const list = h('div', { class: 'stack' }, h('h2', { text: 'Go to' }),
      ...(NAV[r.persona] || NAV.frontdesk).map(([route, label]) => btn(label, {
        kind: route === r.route ? 'quiet' : 'reversible', testid: 'nav.menu.' + route,
        ariaLabel: label + (route === r.route ? ', current screen' : ''),
        onClick: () => { if (close) close(); Proto.router.go(r.persona, route); },
      })),
      btn('Close', { kind: 'reversible', testid: 'nav.menu.close', onClick: () => close && close() }));
    close = Proto.ui.dialog(list, { label: 'Go to another screen' });
  }

  const supportLine = Proto.ui.support;                 // one support line for every outage gate (ui.js)
  // The Andon stands on every home, so it prints what the phone card prints before Show name: the store's redacted
  // sentence (initials and MRN in place of the name; docs/13 feature 24, minimum necessary).
  const minimumSentence = (req) => Proto.store.approvalSentence(req, { redact: true });

  function renderAndon(r) {
    const a = document.getElementById('andon'); const P = window.__proto;
    if (!r.persona) { a.replaceChildren(); return; }
    if (P.outage) {
      keepFocus(a, () => a.replaceChildren(chip('required', 'Server unreachable', {}), h('span', { class: 'grow', text: 'Showing the Board from 7:58 am · reads only, no postings · incident INC-2093' }), btn('Support line', { testid: 'andon.control', kind: 'reversible', onClick: supportLine })));
      return;
    }
    const pending = Proto.store.pendingApprovalsFor();      // one count for the Andon, the phone and the tab
    if (pending.length) { keepFocus(a, () => a.replaceChildren(chip('review', pending.length + ' approval' + (pending.length > 1 ? 's' : '') + ' waiting', {}), h('span', { class: 'grow', text: minimumSentence(pending[0]) }), btn('Open approvals', { testid: 'andon.control', kind: 'reversible', onClick: () => { location.hash = '#/phone/approvals'; } }))); return; }
    a.replaceChildren();
  }

  // The PIN rule is the store's (verifyPin: the match, the device's three-miss count, the five-minute lock and the
  // practice finding the lock writes). Until the store carries it, this fallback keeps the count and the lock
  // here and claims no finding, because none is written.
  const pinLock = { misses: 0, until: 0 };
  const PIN_LOCK_MS = 5 * 60 * 1000;
  const LOCK_VERB = 'Wait five minutes — device locked';
  /* One sentence in front of the first digit, on this pad and on the phone step-up: how long the PIN is and
     what three misses cost. The pad used to say only "Enter the other person's PIN" and let the length and the
     lock be discovered through a refusal that said "Six digits at most" only after the miss
     (INT-instructions-before-input, WCAG 3.3.2). */
  const PIN_RULE = 'Four to six digits. Three misses lock this device for five minutes.';
  const NO_MATCH = { verb: 'Retype the PIN — no match', control: 'Clear and retype', why: PIN_RULE };
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

  // opts.onSwitch(who) runs once the other person's session is open, before the route repaints under their name: the
  // caller that must carry something across the switch (the read-back's draft) hands it over there.
  function openPinPad(r, opts) {
    const P = window.__proto; const S = Proto.store.get(); opts = opts || {};
    let digits = '';
    let shown = false;          // the show-digits assist: the PIN is otherwise a pure memory test with nothing to read back
    let lockTick = null;
    // The keyboard lands on the digit display, not on a key: typed digits fill it and Enter there is Go, while Enter
    // on a focused key presses that key (one grammar with the phone step-up, whose landing key is its display).
    // It carries .input because it is the box a person types into: with no border on a transparent ground there was
    // nothing on screen to type into, and an aria-label was its only name (WCAG 3.3.2, 1.4.11).
    const dots = h('div', { class: 'pindots input', testid: 'pin.display', tabindex: '0', role: 'textbox', 'aria-readonly': 'true', 'aria-live': 'polite', text: '' });
    const paint = () => { dots.textContent = shown ? digits : '•'.repeat(digits.length); };
    // The label is visible and above the box, the rule is stated before the first digit, and a refused press
    // writes its message between the two, opened by a hidden "Error:" (ui.js field/setFieldError).
    const field = Proto.ui.field('PIN', dots, { hint: PIN_RULE + ' Enter here is Go.', required: true });
    const lab = field.querySelector('label'); lab.id = 'pin-label';
    dots.setAttribute('aria-labelledby', 'pin-label');   // a div is not labelable: it is named the way a widget is named
    const showSlot = h('div', { class: 'pin-show' });
    function paintShow() {
      showSlot.replaceChildren(btn('Show digits', { testid: 'pin.show', pressed: shown, class: 'compact', ariaLabel: 'Show digits: read the PIN back as numbers instead of dots', onClick: toggleShow }));
    }
    function toggleShow() { shown = !shown; paintShow(); paint(); const b = showSlot.querySelector('button'); if (b) b.focus(); }
    paintShow(); paint(); field.append(showSlot);
    // The finish path carries the instruction alone. What switching costs is an explanation, so it sits
    // behind a disclosure instead of standing in front of the first digit.
    const policy = h('details', null, h('summary', { class: 'small', testid: 'pin.why' }, 'Why this signs you out'),
      // The sentence says what the product does: drafts are kept per author (perio.js stateFor, encounter.js state), not wiped.
      h('p', { class: 'small muted', text: P.device === 'desk' ? 'This desk is not shared, so switching signs you out and in as the other person.' : 'Their session opens on this page and yours is revoked; your unsaved draft waits under your PIN.' }));
    let close;
    const refusalSlot = h('div', { class: 'pin-refusal' });
    // Rebuilding the slot removes the control that may hold the keyboard; it lands on the new gate's control, never body.
    function showRefusal(v, extra) { refusalSlot.replaceChildren(...[Proto.ui.refusal(v), extra].filter(Boolean)); if (document.activeElement === document.body) { const k = refusalSlot.querySelector('[data-testid="refusal.control"]') || dots; k.focus(); } }
    /* The five-minute device lock is a security limit WCAG 2.2.1 exempts, but a wait with no clock is still a
       wait nobody can plan around: the gate prints the time left and counts it down while the pad is open. */
    function lockLeft() {
      const until = (((Proto.store.get() || {}).pinLock || {}).until) || pinLock.until || 0;   // the store's lock, or this file's fallback
      const el = h('p', { class: 'hint' });
      const write = () => {
        const ms = until - Date.now();
        if (ms <= 0) { el.textContent = 'The lock has ended — enter the PIN again.'; clearInterval(lockTick); lockTick = null; return; }
        const s = Math.ceil(ms / 1000);
        el.textContent = 'Time left on this device: ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.';
      };
      write(); clearInterval(lockTick); lockTick = setInterval(write, 1000);
      return el;
    }
    // The store's refusal, the pad's way out: the way out clears the digits and puts the keyboard back on the
    // display, a lock or an outage closes the pad (the outage gate's control is the support line, so it says
    // the number the Andon's says).
    function showStoreRefusal(res) {
      const retype = () => { digits = ''; paint(); field._setError(null); dots.focus(); };
      const out = res.code === 'pin_no_match' ? retype : res.code === 'outage' ? () => { close(); supportLine(); } : () => close();
      showRefusal({ code: res.code, verb: res.verb, control: res.control, why: res.why, onControl: out, severity: res.code === 'pin_no_match' ? 'required' : 'stop', fresh: res.code === 'pin_no_match' || res.code === 'pin_locked' },
        res.code === 'pin_locked' ? lockLeft() : null);
    }
    function submit() {
      const typed = digits;
      // An empty Go is not a miss: it is answered at the field, without reaching the device's count.
      if (!typed) { field._setError('Enter the PIN before you press Go.'); dots.focus(); return; }
      // The digits stay on screen through the verdict: a refusal that wipes the field makes the person start
      // from nothing and hides what they actually typed (INT-keep-data-and-gate-on-press).
      const res = verifyPin(typed);
      if (!res.ok) { showStoreRefusal(res); return; }
      field._setError(null); digits = ''; paint();
      const who = res.user;
      const persona = Object.entries(S.personaUser).find(([, uid]) => uid === who.id);   // the day-pass holder is the temp persona's user
      if (!persona) {
        // No chart persona for this account in the prototype: refuse rather than write a session that changes nothing.
        showRefusal({ code: 'no_chart_session', verb: 'Keep the current author — no charting session', control: 'Keep current author', onControl: () => close(), why: who.short + ' can approve and post but does not chart, so there is nothing for that account to open on this screen. The author stays as it was and nothing was written.', severity: 'info' });
        return;
      }
      // The switch opens that person's session through the store, which writes the row and logs it. The shell
      // used to emit a write event for a table the store did not hold, so the log named a row nothing wrote.
      const opened = Proto.store.openSession(who.id);
      if (!opened.ok) { showStoreRefusal(opened); return; }
      if (opts.onSwitch) opts.onSwitch(who);
      close();
      const p = persona[0]; P.set({ persona: p });
      location.hash = '#/' + p + '/' + (r.route === 'signin' ? Proto.router.HOME[p] : r.route) + (r.id ? '/' + r.id : '');
      Proto.router.announce('Now charting as ' + who.name);
    }
    const type = (d) => { if (digits.length < 6) { digits += d; paint(); } };
    // Twelve keys with nothing naming them was a group of twelve anonymous controls (CLT-common-region); the
    // heading above them is visible, sits in the same bounded region, and is what the group is labelled by.
    const padHead = h('h3', { class: 'small', id: 'pin-pad-label', text: 'Keypad' });
    const pad = h('div', { class: 'pinpad', role: 'group', 'aria-labelledby': 'pin-pad-label' },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => btn(String(d), { testid: 'pin.key.' + d, onClick: () => type(String(d)) })),
      btn('⌫', { testid: 'pin.backspace', ariaLabel: 'Backspace', onClick: () => { digits = digits.slice(0, -1); paint(); } }),
      btn('0', { testid: 'pin.key.0', onClick: () => type('0') }));
    // Go and Cancel stand side by side at equal size, as they do on the phone step-up: one pad, one grammar,
    // and the irreversible half never alone in its row (CLT-neutral-irreversible, WCAG 3.2.4).
    const decide = h('div', { class: 'btnrow' },
      btn('Cancel', { testid: 'pin.cancel', onClick: () => close() }),
      btn('Go', { testid: 'pin.submit', kind: 'irreversible', ariaLabel: 'Go: sign in as the person whose PIN this is', onClick: submit }));
    /* One PIN pad, one grammar. The phone step-up took typed digits, Backspace and Enter while this pad took
       clicks only, so the same four keystrokes filled one pad and left the other empty — and Go then refused
       a PIN nobody had failed to type. The listener lives only while the pad is open. Enter on a focused control
       (a key, the gate's control, the Why summary, Cancel) is that control's own activation: intercepting it ran Go
       from a digit key and counted a miss nobody typed. Only Enter off a control submits. */
    const onPadKey = (ev) => {
      const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const top = Proto.ui.topDialog(); if (!top || !top.contains(pad)) return;   // the top dialog owns the keyboard
      if (/^[0-9]$/.test(ev.key)) { ev.preventDefault(); type(ev.key); }
      else if (ev.key === 'Backspace') { ev.preventDefault(); digits = digits.slice(0, -1); paint(); }
      else if (ev.key === 'Enter' && !(t && t.closest && t.closest('button, summary, a, [role="button"]'))) { ev.preventDefault(); submit(); }
    };
    document.addEventListener('keydown', onPadKey, true);
    // Escape, the backdrop and a route change close the dialog without passing through Cancel, so the listener
    // leaves with the dialog itself: a wrapper around close() left it alive and typed digits kept switching authors.
    close = Proto.ui.dialog(h('div', { class: 'stack' }, h('h2', { text: 'Who is charting?' }), refusalSlot, field, padHead, pad, policy, decide),
      { label: 'Switch author', focus: '[data-testid="pin.display"]', onClose: () => { document.removeEventListener('keydown', onPadKey, true); clearInterval(lockTick); lockTick = null; } });
    // A locked device says so before the first digit (the fallback's lock; the store's shows on the first Go).
    if (localLock()) showStoreRefusal(lockedOut());
  }

  function renderRail1(r) {
    // temp first-shift rail: chips retire on the temp's own events
    let bar = document.getElementById('rail1');
    if (r.persona !== 'temp') { if (bar) bar.remove(); return; }
    const S = Proto.store.get(); const steps = Proto.store.railSteps();
    if (!bar) { bar = h('div', { class: 'rail1', id: 'rail1', role: 'region', 'aria-label': 'Your first shift' }); document.getElementById('andon').after(bar); }
    if (S.rail1Collapsed) { bar.replaceChildren(btn('Show first-shift steps', { testid: 'rail1.toggle', onClick: () => { S.rail1Collapsed = false; renderRail1(r); refocus('rail1.toggle'); } })); return; }
    keepFocus(bar, () => bar.replaceChildren(h('span', { class: 'small muted', text: 'Your first shift:' }), ...steps.map(([code, label], i) => { const retired = !!Proto.store.railStateFor()[code]; return btn(retired ? label + ' ✓' : label, { testid: 'rail1.chip.' + i, dataset: { retired: retired ? '1' : '0' }, ariaLabel: label + (retired ? ', done' : ', show me'), onClick: () => pulseFor(code, r) }); }), btn('Hide', { testid: 'rail1.toggle', onClick: () => { S.rail1Collapsed = true; renderRail1(r); refocus('rail1.toggle'); } })));
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
    // PIN_RULE is shared with the phone step-up: the same component states the same rule in the same words.
    mount, canvas, openPinPad, refreshAndon, refreshRail1: renderRail1, PIN_RULE,
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
