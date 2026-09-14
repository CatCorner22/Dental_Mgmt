/* Chairs (mine): hygienist home. One card per appointment in time order with the since-last-visit
   delta strip (what changed, what is due, what helped), alerts as stop chips, the recall chip,
   one primary verb per card (Ready for exam once there is exam content, otherwise Chart perio),
   an expander for coverage and forms, and the practice-level perio line counted from the rows.
   Ready for exam cannot be taken back, so it asks first: the press opens the shared read-back row and
   nothing is written until the second press (ui.js confirmable).
   Single-key shortcuts are a per-user preference that defaults off (Settings > Single-key shortcuts).
   While they are on, P and N open the grid and the note for the first open chair and R moves the
   keyboard to Ready for exam and writes nothing; each key is printed on the control it triggers.
   Keys are live only while this route is mounted. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, confirmable, money, displayName, pageHead, support, STATUS, TYPE, ELIG, GLYPH } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TODAY = (Proto.seed && Proto.seed.TODAY) || '2026-09-03';
  const READY_FROM = ['seated', 'in_chart'];
  const DONE = ['note_filed', 'checked_out', 'checked_out_unfiled', 'ready_for_exam'];
  const MED_HX = /anticoagulant|premed|apixaban|warfarin|antibiotic/i;

  // Per-screen UI state; cleared whenever the store is rebuilt (window.__proto.reset).
  let lastStore = null;
  let gates = {};    // apptId -> {code, verb, control, why, node}
  let expanded = {}; // apptId -> boolean
  let keysOn = false;
  let keyFor = {};   // while single-key shortcuts are on: { p: apptId, n: apptId, r: apptId } — the card each key acts on
  const shortcutsOn = () => Proto.store.prefsFor().shortcuts === 'on';

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  const byTime = (a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1);
  // One shape for a clock time on this screen: the card head, the aria-label and the sub line read alike.
  const fmtTime = Proto.ui.time;                       // one clock for every screen (ui.js)
  const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  const isHygienist = (u) => u.role === 'hygienist' || u.role === 'rdh';

  function syncStore() { const s = S(); if (s !== lastStore) { lastStore = s; gates = {}; expanded = {}; } }

  /* Whole months between an ISO date and today (2026-09-03); 2025-07-01 -> 14.
     A record holds a date, an empty string or nothing at all: anything that is not an ISO date
     answers null, so a missing last-visit date never throws and never prints NaN on a card. */
  function monthsAgo(iso) {
    const p = String(iso == null ? '' : iso).trim().split('-').map(Number);
    if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null;
    const [y1, m1, d1] = p; const [y2, m2, d2] = TODAY.split('-').map(Number);
    let n = (y2 - y1) * 12 + (m2 - m1); if (d2 < d1) n -= 1; return Math.max(0, n);
  }

  // ---- Derivations (rows only, never guesses) ---------------------------------------------
  function mine() {
    const u = Proto.store.currentUser(); const hyg = isHygienist(u);
    return S().appointments.filter((a) => a.locationId === 'loc-1' && (a.providerId === u.id || (!hyg && a.type === 'hygiene'))).sort(byTime);
  }
  // The latest row is the record: an addendum supersedes the exam it amends, and the strip reads the addendum.
  const perioToday = (a) => S().perioExams.filter((e) => e.encounterId === a.encounterId && e.date === TODAY).pop();
  function lastPerio(a) {
    if (a.perioLast) return a.perioLast;
    const prior = S().perioExams.filter((e) => e.patientId === a.patientId && e.date < TODAY).map((e) => e.date).sort();
    return prior.length ? prior[prior.length - 1] : null;
  }
  const hasNote = (a) => { const n = S().notes[a.encounterId]; return !!(n && Object.keys(n).length) || S().filedNotes.some((f) => f.encounterId === a.encounterId); };
  const canReady = (a) => READY_FROM.includes(a.status) || (!DONE.includes(a.status) && (!!perioToday(a) || hasNote(a)));
  function queuePosition(a) {
    if (a.status !== 'ready_for_exam') return 0;
    const order = S().appointmentEvents.filter((e) => e.kind === 'encounter.exam_requested').map((e) => e.appointmentId);
    const rank = (x) => { const i = order.indexOf(x.id); return i < 0 ? 1e6 : i; };
    const waiting = S().appointments.filter((x) => x.locationId === 'loc-1' && x.status === 'ready_for_exam').sort((x, y) => rank(x) - rank(y));
    return waiting.indexOf(a) + 1;
  }
  function deltas(a, pt) {
    const out = [];
    const today = perioToday(a);
    if (today && today.mode === 'screening') {
      // A screening records six codes, not sites; a 3 or 4 books the full chart (docs/13 feature 5).
      const codes = today.sextantCodes || [];
      out.push({ sev: 'clear', word: 'Perio charted today', text: 'screening, ' + codes.length + ' sextants coded' });
      if (codes.some((x) => x === '3' || x === '4')) out.push({ sev: 'required', word: 'Full chart due', text: 'screening code 3 or 4' });
    } else if (today) out.push({ sev: 'clear', word: 'Perio charted today', text: today.probed + ' sites probed, deepest ' + today.deepest + ' mm' });
    // The alert itself stands in the Alerts row above; the delta names the change once rather than printing the alert twice.
    for (const alert of pt.alerts || []) if (MED_HX.test(alert)) { out.push({ sev: 'stop', word: 'Med hx changed', text: 'see the alert above' }); break; }
    const lp = lastPerio(a);
    const lpm = lp ? monthsAgo(lp) : null;
    if (lpm != null) out.push({ sev: lpm >= 12 ? 'review' : 'info', word: 'Perio', text: lpm + ' mo ago' });
    if (a.bwxDue) out.push({ sev: 'review', word: 'BWX due', text: 'practice rule: 12 mo' });
    if (a.helpedLastTime) out.push({ sev: 'clear', word: 'What helped last time', text: a.helpedLastTime });
    return out;
  }
  function recallDue(a) { const m = lastPerio(a) ? monthsAgo(lastPerio(a)) : null; return a.type === 'hygiene' && ((m != null && m >= 6) || !!a.bwxDue); }

  /* The practice line is counted from the rows the screen already reads, so a perio exam saved this
     morning moves it: hygiene chairs at this location today, and how many of them are charted. */
  function practiceLine() {
    const s = S(); const today = s.tenant.today; const place = s.locations[0].name;
    const hyg = s.appointments.filter((a) => a.locationId === 'loc-1' && a.type === 'hygiene');
    if (!hyg.length) return 'Perio charted today (practice): no hygiene chairs at ' + place;
    const charted = hyg.filter((a) => s.perioExams.some((e) => e.encounterId === a.encounterId && e.date === today)).length;
    return 'Perio charted today (practice): ' + charted + ' of ' + hyg.length + ' hygiene chairs at ' + place;
  }

  // ---- Re-render after a mutation ----------------------------------------------------------
  function after(r, announce, focus) {
    Proto.screens.shell.refreshAndon(r);
    if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    render(r);
    if (focus) { const el = document.getElementById(focus) || document.querySelector('[data-testid="' + focus + '"]'); if (el) el.focus(); }
    if (announce) Proto.router.announce(announce);
  }
  // The store's control words, each doing the thing it names; the gate remembers whose press raised it.
  const BY_WORD = {
    'Switch author': (r) => Proto.screens.shell.openPinPad(r),
    'Open Roles': () => { location.hash = '#/owner/roles'; },   // the seat that issues a pass
    'Support line': support,
  };
  function gateFor(res, id, r) {
    const g = { code: res.code, verb: res.verb, control: res.control, why: res.why, userId: Proto.store.currentUser().id };
    // An unnamed word drops the gate and returns the keyboard to the verb it held.
    const act = g.code === 'outage' ? support : BY_WORD[g.control] || (() => { delete gates[id]; after(r, null, 'chairs.card.' + id + '.ready'); });
    g.node = refusal({ code: g.code, verb: g.verb, control: g.control, why: g.why, severity: g.code === 'outage' ? 'stop' : 'required', onControl: () => act(r) });
    return g;
  }

  // ---- Actions -----------------------------------------------------------------------------
  function goPerio(id, r) { const a = Proto.store.appt(id); if (a) Proto.router.go(r.persona, 'perio', a.encounterId); }
  function goNote(id, r) { const a = Proto.store.appt(id); if (a) Proto.router.go(r.persona, 'encounter', a.encounterId); }
  /* The outage is the store's gate, not the screen's: readyForExam refuses while the server is
     unreachable, with the verb the whole product uses, so the chair never invents a second one. */
  function doReady(id, r) {
    const a = Proto.store.appt(id); if (!a || !canReady(a)) return;
    const focusId = 'chairs.card.' + id + '.ready';
    const res = Proto.store.readyForExam(id);
    if (!res.ok) { gates[id] = gateFor(res, id, r); render(r); const b = document.querySelector('[data-testid="' + focusId + '"]'); if (b) b.focus(); return; }
    delete gates[id];
    Proto.store.retireChip('ready');
    const name = displayName(Proto.store.patient(a.patientId).name, P().privacy);
    // Focus lands on the queue chip that replaced the verb, not on Write note: a repeated Enter opens nothing.
    after(r, name + ' ready for exam, ' + ordinal(queuePosition(a)) + ' in queue', 'chairs-queue-' + id);
  }
  /* A press on a Held primary re-evaluates first: if its gate has fallen the press acts (FIX-ROUND2 stale-gate rule). */
  function heldReady(id, r) {
    render(r);
    const c = document.querySelector('[data-testid="chairs.card.' + id + '"] [data-testid="refusal.control"]');
    if (c) { c.focus(); return; }
    // The gate has fallen: the press reaches the verb, which asks first like any other press on it.
    const b = document.querySelector('[data-testid="chairs.card.' + id + '.ready"]'); if (b) { b.focus(); b.click(); }
  }
  function toggleExpand(id, r) { expanded[id] = !expanded[id]; render(r); const el = document.querySelector('[data-testid="chairs.card.' + id + '.expand"]'); if (el) el.focus(); }

  // ---- Card --------------------------------------------------------------------------------
  /* A severity mark without a fill: the shape says the severity, the words beside it say the fact.
     A chip is for a status word from the shared tables; everything else on the card face is text. */
  const mark = (sev) => h('span', { class: 'glyph', 'aria-hidden': 'true', text: GLYPH[sev] || '●' });
  const flag = (sev, text, attrs) => h('span', Object.assign({ class: 'ch-flag', style: 'display: inline-flex; align-items: center; gap: var(--space-1); font-weight: var(--weight-bold);' }, attrs || {}), mark(sev), text);
  /* The key a control answers to, printed on the control itself and declared for assistive tech;
     the legend in the sub line no longer carries keys, so the control is the one place to look. */
  function printKey(b, key) {
    if (!b || !key) return b;
    b.setAttribute('aria-keyshortcuts', key.toLowerCase());
    b.append(h('kbd', { class: 'ch-key', 'aria-hidden': 'true', style: 'font: inherit; border: 1px solid currentColor; border-radius: var(--radius); padding: 0 var(--space-1); line-height: 1.2;', text: key }));
    return b;
  }

  function card(a, r) {
    const priv = P().privacy; const s = S();
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv);
    const prov = Proto.store.user(a.providerId) || { short: '—' };
    const [ssev, sword] = STATUS[a.status] || ['info', a.status];
    const tword = Proto.ui.typeWord(a.type);
    const pos = queuePosition(a);
    const el = h('article', { class: 'card appt ' + (a.type || ''), testid: 'chairs.card.' + a.id, 'aria-label': fmtTime(a.time) + ' ' + name + ', chair ' + a.op });

    // One status chip on the face; the type is a word in the meta line, not a second chip.
    el.append(h('div', { class: 'who' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), chip(ssev, sword)));
    const meta = h('div', { class: 'meta' }, h('span', { text: 'Chair ' + a.op + ' · ' + tword }));
    if (recallDue(a)) meta.append(flag('review', 'Recall due'));
    // The queue position takes the keyboard after Ready for exam, so a repeated Enter opens nothing.
    if (pos) meta.append(flag('review', 'Exam: ' + ordinal(pos) + ' in queue', { id: 'chairs-queue-' + a.id, tabindex: '-1' }));
    el.append(meta);

    if (pt.alerts && pt.alerts.length) el.append(h('div', { class: 'row ch-alerts', role: 'group', 'aria-label': 'Alerts' }, ...pt.alerts.map((t) => chip('stop', t))));

    // Since last visit: what changed, what is due, what helped — lines of text with a severity mark,
    // outside any button, and only on a card that has something to say (the five without deltas say nothing).
    const detailsId = 'chairs-details-' + a.id;
    const ds = deltas(a, pt);
    if (ds.length) {
      const sinceId = 'chairs-since-' + a.id;
      el.append(h('div', { class: 'ch-since', role: 'group', 'aria-labelledby': sinceId, style: 'margin-top: var(--space-2);' },
        h('span', { class: 'small muted', id: sinceId, text: 'Since last visit' }),
        h('ul', { class: 'ch-deltas', style: 'list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1);' },
          ...ds.map((d) => h('li', { style: 'display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap;' }, mark(d.sev), h('span', { style: 'font-weight: var(--weight-bold);', text: d.word }), d.text ? h('span', { class: 'muted', text: d.text }) : null)))));
    }

    // One tap opens coverage, forms and the balance; the button says what it does and nothing else.
    const moreWord = expanded[a.id] ? 'Show less' : 'Show more';
    const more = btn(moreWord, { kind: 'quiet', class: 'compact', testid: 'chairs.card.' + a.id + '.expand', ariaLabel: moreWord + ': coverage, forms and balance for ' + name, onClick: () => toggleExpand(a.id, r) });
    more.setAttribute('aria-expanded', String(!!expanded[a.id])); more.setAttribute('aria-controls', detailsId);
    more.style.marginTop = 'var(--space-2)';
    el.append(more);

    const det = h('div', { class: 'ch-details', id: detailsId });
    if (!expanded[a.id]) det.hidden = true;
    const [esev, eword] = ELIG[a.eligibility] || ['info', 'Unknown'];
    det.append(h('div', { class: 'row' }, h('span', { text: 'Coverage: ' + (pt.selfPay || !pt.primary ? 'Self-pay' : Proto.store.carrierName(pt.primary) + (pt.secondary ? ' · secondary ' + Proto.store.carrierName(pt.secondary) : '')) }), chip(esev, eword)));
    det.append(h('span', { text: 'Forms: ' + (a.formsDone ? 'complete' : 'outstanding') }));
    // The balance is the ledger's, the same number the Board, Checkout and the Ledger print.
    const bal = Proto.store.balances(a.patientId);
    det.append(h('span', { text: 'Balance ' + money(bal.patientDue) + (bal.insurancePending ? ' · ' + money(bal.insurancePending) + ' waiting on insurance' : '') + (bal.credit ? ' · ' + money(bal.credit) + ' credit' : '') + ' · Provider ' + prov.short }));
    // The explanation belongs to the lines it explains, so it stands only where those lines do.
    if (ds.length) det.append(h('details', null, h('summary', { class: 'small', testid: 'chairs.card.' + a.id + '.why' }, 'Why these lines'), h('p', { class: 'small muted', text: 'Each line is a stored row: the medical-history alert on the patient, the last perio exam date, the practice\'s bitewing interval and the last filed what-helped field. Nothing here is a guess.' })));
    el.append(det);

    /* One primary verb per card: Ready for exam once there is exam content to hand over, otherwise
       Chart perio, the work that comes first. Write note stays a quiet second so the card names one
       next step rather than two nouns of equal weight. The group has a visible name inside the card,
       and it lays out two to a row so the irreversible verb always has an equal-size neighbour. */
    const ready = canReady(a);
    const actId = 'chairs-actions-' + a.id;
    const actions = h('div', { class: 'actions ch-actions', role: 'group', 'aria-labelledby': actId, style: 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));' },
      h('span', { class: 'small muted', id: actId, text: 'Next step', style: 'grid-column: 1 / -1; font-weight: var(--weight-bold);' }));
    const wrapText = (b) => { b.style.whiteSpace = 'normal'; b.style.minWidth = '0'; return b; };
    actions.append(printKey(wrapText(btn('Chart perio', { kind: ready ? 'quiet' : 'reversible', testid: 'chairs.card.' + a.id + '.perio', ariaLabel: 'Chart perio for ' + name + ', opens the grid at UR site 1', onClick: () => goPerio(a.id, r) })), keyFor.p === a.id ? 'P' : null));
    actions.append(printKey(wrapText(btn('Write note', { kind: 'quiet', testid: 'chairs.card.' + a.id + '.note', ariaLabel: 'Write the note for ' + name, onClick: () => goNote(a.id, r) })), keyFor.n === a.id ? 'N' : null));
    if (Proto.screens.rail) actions.append(wrapText(Proto.screens.rail.button(a.patientId, r, 'chairs.card.' + a.id + '.rail')));
    if (ready) {
      const readyLabel = 'Ready for exam: ' + name + ' joins the dentist\'s queue';
      if (gates[a.id]) actions.append(wrapText(btn('Ready for exam', { kind: 'held', testid: 'chairs.card.' + a.id + '.ready', onClick: () => heldReady(a.id, r) })));
      else if (s.outage) {
        // Nothing can write during the outage, so the press goes straight to the store's refusal rather than asking first.
        actions.append(printKey(wrapText(btn('Ready for exam', { kind: 'irreversible', testid: 'chairs.card.' + a.id + '.ready', ariaLabel: readyLabel, onClick: () => doReady(a.id, r) })), keyFor.r === a.id ? 'R' : null));
      } else {
        // The press asks first: the read-back names the patient, Cancel takes the keyboard, and the second press writes.
        const key = keyFor.r === a.id ? 'R' : null;
        const slot = confirmable('Ready for exam', { testid: 'chairs.card.' + a.id + '.ready', ariaLabel: readyLabel, readback: name + ' joins the dentist\'s queue. This cannot be taken back.', onConfirm: () => doReady(a.id, r), onCancel: () => printKey(wrapText(slot.firstElementChild), key) });
        // At rest the verb fills one cell beside Rail, the same size as every neighbour; the read-back row
        // it swaps in needs the whole width, so the slot spans both columns only while the row stands.
        slot.style.display = 'grid';
        new MutationObserver(() => { slot.style.gridColumn = slot.querySelector('.confirmrow') ? '1 / -1' : ''; }).observe(slot, { childList: true });
        printKey(wrapText(slot.firstElementChild), key);
        actions.append(slot);
      }
    }
    el.append(actions);
    if (gates[a.id]) el.append(h('div', { class: 'gate' }, gates[a.id].node));
    if (s.outage) el.append(h('div', { class: 'stamp', text: 'Read-only during the outage · nothing writes' }));
    return el;
  }

  // ---- Keyboard accelerators (active only while Chairs is the current route) ----------------
  function onKey(ev) {
    const r = Proto.router.current();
    if (r.route !== 'chairs') { document.removeEventListener('keydown', onKey); keysOn = false; return; }
    if (!shortcutsOn()) return;                          // a bare key does nothing until the person switches keys on
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('#dialogs .overlay')) return;
    const k = (ev.key || '').toLowerCase(); if (!['p', 'n', 'r'].includes(k)) return;
    ev.preventDefault();
    const list = mine(); const open = list.filter((a) => !DONE.includes(a.status));
    if (k === 'p') { const a = open[0] || list[0]; if (a) goPerio(a.id, r); else Proto.router.announce('No chairs assigned to you today'); }
    if (k === 'n') { const a = open[0] || list[0]; if (a) goNote(a.id, r); else Proto.router.announce('No chairs assigned to you today'); }
    // R is an accelerator, not the verb: it puts the keyboard on Ready for exam, which is irreversible
    // and is pressed on purpose. A bare key never writes an appointment event.
    if (k === 'r') {
      const a = list.find(canReady);
      const b = a && document.querySelector('[data-testid="chairs.card.' + a.id + '.ready"]');
      if (b) b.focus(); else Proto.router.announce('Nobody is seated with exam content yet');
    }
  }

  // ---- Screen ------------------------------------------------------------------------------
  function render(r) {
    syncStore();
    const s = S(); const u = Proto.store.currentUser(); const list = mine(); const hyg = isHygienist(u);
    // A gate belongs to its cause: the outage (the server answers again), the author whose press raised it (another
    // author's press asks the store afresh), the missing pass (issued since).
    for (const id of Object.keys(gates)) { const g = gates[id]; if ((g.code === 'outage' && !s.outage) || (g.code !== 'outage' && g.userId !== u.id) || (g.code === 'entitlement' && !u.noPass)) delete gates[id]; }
    // The keys are printed on the controls they trigger; the sub line only says that they are on.
    const keys = shortcutsOn(); const open = list.filter((a) => !DONE.includes(a.status)); const first = open[0] || list[0];
    keyFor = keys ? { p: first && first.id, n: first && first.id, r: (list.find(canReady) || {}).id } : {};
    const sub = fmtTime(s.clock.time) + ' · ' + list.length + ' chair' + (list.length === 1 ? '' : 's') + (hyg ? ' · yours' : ' · all hygiene chairs at ' + s.locations[0].name + ' and yours') + (P().outage ? ' · read-only during the outage' : '') + (keys ? ' · single-key shortcuts on' : '');
    // The heading names the set below it: for a hygienist that is her own chairs, for anyone else
    // every hygiene chair at this location plus their own.
    const page = h('div', { class: 'stack chairspage' }, pageHead(hyg ? 'Chairs · mine' : 'Chairs · hygiene and my own', sub));
    // One column in seat order, so the eye and the Tab key travel the same way; the cards keep a reading width.
    if (list.length) page.append(h('div', { class: 'ch-list', role: 'list', 'aria-label': 'Your chairs in seat order', style: 'grid-template-columns: minmax(0, 1fr); max-width: var(--measure);' }, ...list.map((a) => h('div', { role: 'listitem' }, card(a, r)))));
    else page.append(h('section', { class: 'card stack', 'aria-label': 'No chairs' }, h('h2', { text: 'No chairs assigned to you today' }), h('p', { class: 'muted', text: 'The Board shows every chair at ' + s.locations[0].name + '.' }), h('div', { class: 'btnrow' }, btn('Open the Board', { kind: 'reversible', testid: 'chairs.empty.board', onClick: () => Proto.router.go(r.persona, 'board') }))));
    page.append(h('p', { class: 'small muted practice-line', text: practiceLine() }));
    Proto.screens.shell.mount(page);
    if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; }
  }

  window.addEventListener('hashchange', () => { if (keysOn && Proto.router.current().route !== 'chairs') { document.removeEventListener('keydown', onKey); keysOn = false; } });

  Proto.screens.chairs = { render, ready: doReady, perio: goPerio, note: goNote, monthsAgo };
  Proto.router.on('chairs', (r) => Proto.screens.chairs.render(r));
})();
