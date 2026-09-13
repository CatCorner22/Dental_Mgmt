/* Board: front-desk and temp home. Readiness strip before open, chair strip (author initials only),
   one column per chair, checkout queue with the note and claim state in words, the Filed later lane,
   read-only outage rendering, and the A / S / C accelerators — off unless the reader has turned
   single-key shortcuts on, and printed on the three controls they act on rather than in a legend. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, displayName, initials, shortDate, pageHead, support, STATUS } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const IN_CHAIR = ['seated', 'in_chart', 'ready_for_exam'];
  const ARRIVABLE = ['scheduled', 'confirmed'];
  const CHECKOUTABLE = ['in_chart', 'note_filed'];

  const CACHE_TIME = '07:58'; // last successful fetch shown by the Andon slot during an outage
  const OUTAGE_WHY = 'Nothing posts while the server is unreachable: the controls that gate money and records cannot be enforced without it.';
  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const STALE_DEVICE = { userId: 'u-da-1', op: 2 };  // the shared tablet left signed in overnight

  // Per-screen UI state. Cleared whenever the store is rebuilt (window.__proto.reset).
  let lastStore = null;
  let gates = {};     // apptId -> {code, verb, control, why, node} rendered at the card's gate
  let rowGates = {};  // apptId -> gate rendered at the checkout-queue row
  let stripGate = null; // the readiness strip's own gate
  let pings = {};     // apptId -> {node} refusal or {text} stamp
  let expanded = {};  // apptId -> boolean
  let boardUi = {};   // userId -> {collapsed, labCalled, deviceReset, eligRerun, undo}; a shared desk is not a person
  let keysBound = false;

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  const byTime = (a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1);
  const todays = () => S().appointments.filter((a) => a.locationId === 'loc-1');
  const fmtTime = Proto.ui.time;                       // one clock for every screen (ui.js)
  const clock12 = fmtTime;
  const minutesBetween = (a, b) => { const [ah, am] = a.split(':').map(Number); const [bh, bm] = b.split(':').map(Number); return (bh * 60 + bm) - (ah * 60 + am); };
  const provInitials = (u) => (u ? initials(u.name.replace(/^Dr\.\s+/, '')) : '—');
  const noteFiled = (a) => { const enc = Proto.store.encounter(a.encounterId); return !!(enc && enc.noteFiled) || S().filedNotes.some((f) => f.encounterId === a.encounterId); };
  // Which codes want an attachment is the store's rule, not this screen's: the two lists had drifted, so one
  // filed surgical extraction read "Needs: attachment" here and "Ready" on Checkout for the same visit.
  const needsAttachment = (a) => S().procedures.some((p) => p.encounterId === a.encounterId && Proto.store.needsAttachment(p));
  /* What the window decided, read from the decision row and the payment it left waiting: "Paid at the window"
     only when a Collect actually took money (an allocation intent names the payment); a statement or a plan
     says so, and Nothing due today says that. */
  const WINDOW_WORD = { send_statement: 'Statement due', payment_plan: 'Payment plan set up', zero_due: 'Nothing due today' };
  const windowDecision = (a) => S().collectionDecisions.find((d) => d.encounterId === a.encounterId) || null;
  const paidAtWindow = (a) => { const d = windowDecision(a); return !!d && d.decision === 'collect' && S().allocationIntents.some((i) => i.encounterId === a.encounterId); };
  const windowWord = (a) => (paidAtWindow(a) ? 'Paid at the window' : WINDOW_WORD[(windowDecision(a) || {}).decision] || 'Checked out');
  /* The strip is one person's working state, so it is keyed by the user reading it and never written to a
     store table: a mark the front desk makes on a shared desk is not the temp's mark and records nothing. */
  const uiState = () => { const uid = Proto.store.currentUser().id; return (boardUi[uid] = boardUi[uid] || { collapsed: false, labCalled: null, deviceReset: null, eligRerun: 0, undo: null }); };
  /* Single-key accelerators are a preference, not a default: with `shortcuts` off (the shipped value) a key
     pressed on the page body does nothing at all, and with it on the letter is printed on the one control it
     acts on — never only in a legend the reader has to carry down the page (CUST-2.1.4, CLT-recognition-keys). */
  const shortcutsOn = () => Proto.store.prefsFor().shortcuts === 'on';
  function withKey(b, key) {
    if (!b) return b;
    b.setAttribute('aria-keyshortcuts', key.toUpperCase());
    b.append(h('kbd', { class: 'small', 'aria-hidden': 'true', text: key.toUpperCase() }));  // the name is already spoken; the print is for the eye
    return b;
  }
  const withKeyIf = (on, key, b) => (on ? withKey(b, key) : b);
  /* Which card each key would act on, so the marker sits on that card and nowhere else. Read once per
     render and held here, because every card asks. */
  let keyMarks = {};
  function keyTargets() {
    if (!shortcutsOn()) return {};
    const list = todays().sort(byTime);
    const a = list.find((x) => ARRIVABLE.includes(x.status));
    const s = list.find((x) => x.status === 'arrived');
    const c = list.find((x) => CHECKOUTABLE.includes(x.status));
    return { a: a && a.id, s: s && s.id, c: c && c.id };
  }
  /* Tomorrow's front-desk cover is a front-desk pass at this location, not any pass at any location. */
  const frontDeskCover = () => S().dayPasses.some((d) => d.role === 'frontdesk' && d.locationId === 'loc-1');
  const weekday = (iso) => { const p = String(iso == null ? '' : iso).trim().split('-').map(Number); return p.length === 3 && p.every((x) => Number.isFinite(x)) ? WEEKDAY[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] : null; };
  const outageRefusal = (what) => Proto.store.refuse('outage', 'Wait for the server — ' + what, 'Support line', OUTAGE_WHY);

  function syncStore() { const s = S(); if (s !== lastStore) { lastStore = s; gates = {}; rowGates = {}; stripGate = null; pings = {}; expanded = {}; boardUi = {}; } }
  /* A gate outlives its reason only if nobody clears it: once the connection is back (or the pass is issued) the
     gates that cause raised go and every primary returns to its own identity, so Held is never a dead end. */
  const stale = (g) => (g.code === 'outage' && !P().outage) || (g.code === 'entitlement' && !Proto.store.currentUser().noPass);
  function pruneStaleGates() {
    for (const k of Object.keys(gates)) if (stale(gates[k])) delete gates[k];
    for (const k of Object.keys(rowGates)) if (stale(rowGates[k])) delete rowGates[k];
    for (const k of Object.keys(pings)) if (pings[k].code && stale(pings[k])) delete pings[k];
    if (stripGate && stale(stripGate)) stripGate = null;
  }
  /* One cause, one gate: a second refusal for the same outage or missing pass moves the gate to the card that
     was pressed rather than standing a twin beside the first. */
  function dropGates(code) {
    if (!['outage', 'entitlement'].includes(code)) return;
    for (const k of Object.keys(gates)) if (gates[k].code === code) delete gates[k];
    for (const k of Object.keys(rowGates)) if (rowGates[k].code === code) delete rowGates[k];
    for (const k of Object.keys(pings)) if (pings[k].code === code) delete pings[k];
    if (stripGate && stripGate.code === code) stripGate = null;
  }

  /* Re-render after a mutation: Andon, temp rail, then this screen; move focus to a named control or a #selector. */
  function after(r, announce, focus) {
    Proto.screens.shell.refreshAndon(r);
    if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    render(r);
    if (focus) { const el = document.querySelector(focus[0] === '#' ? focus : '[data-testid="' + focus + '"]'); if (el) el.focus(); }
    if (announce) Proto.router.announce(announce);
  }
  // "Open Roles" / "Add day pass" mean the seat that issues a pass, as on Checkout, Encounter, Perio and Chairs.
  const openRoles = () => { location.hash = '#/owner/roles'; };
  /* Wrap a store refusal so its DOM node is built (and logged) once and reused across re-renders. The component
     logs and announces the gate; this screen never announces one itself. Every code has a control that acts:
     outage opens the support line, a missing pass opens Roles, anything else runs the caller's onControl. */
  function gateFor(res, r, onControl) {
    const g = { code: res.code, verb: res.verb, control: res.control, why: res.why };
    g.node = refusal({ code: g.code, verb: g.verb, control: g.control, why: g.why, fresh: true, severity: g.code === 'outage' ? 'stop' : 'required', onControl: () => { if (g.code === 'outage') support(); else if (g.code === 'entitlement') openRoles(); else if (onControl) onControl(g); } });
    return g;
  }
  const raise = (table, id, res, r, onControl) => { dropGates(res.code); table[id] = gateFor(res, r, onControl); };
  const focusGate = (scope) => { const c = document.querySelector((scope ? '[data-testid="' + scope + '"] ' : '') + '[data-testid="refusal.control"]'); if (c) c.focus(); };
  /* A press on a Held primary re-evaluates first: if its gate has fallen the press acts, otherwise it lands on the
     gate's control (FIX-ROUND2 stale-gate rule). */
  const heldPress = (r, table, id, scope, act) => { render(r); if (table[id]) focusGate(scope); else act(); };

  // ---- Actions -----------------------------------------------------------------------------
  function doArrive(id, r) {
    const a = Proto.store.appt(id); if (!a || !ARRIVABLE.includes(a.status)) return;
    const res = Proto.store.arrive(id);
    if (!res.ok) { raise(gates, id, res, r); render(r); const b = document.querySelector('[data-testid="board.card.' + id + '.arrive"]'); if (b) b.focus(); return; }
    delete gates[id];
    // Focus lands on the arrived stamp, not on Seat: a repeated Enter must never seat in the same gesture.
    after(r, displayName(Proto.store.patient(a.patientId).name, P().privacy) + ' arrived. Seat is the next step on the same card.', '#board-arrived-' + id);
  }
  function doSeat(id, r) {
    const a = Proto.store.appt(id); if (!a || a.status !== 'arrived') return;
    const res = Proto.store.seat(id);
    if (!res.ok) { raise(gates, id, res, r); render(r); const b = document.querySelector('[data-testid="board.card.' + id + '.seat"]'); if (b) b.focus(); return; }
    delete gates[id];
    // Focus stays on the card that was worked, not on the chair strip at the top of the page.
    after(r, 'Seated in chair ' + a.op + '. The chair strip now shows ' + provInitials(Proto.store.user(a.providerId)) + '.', 'board.card.' + id + '.expand');
  }
  function doReverify(id, r) {
    const a = Proto.store.appt(id); if (!a) return;
    const res = Proto.store.reverify(id);
    if (!res.ok) { raise(gates, id, res, r); render(r); const b = document.querySelector('[data-testid="board.card.' + id + '.reverify"]'); if (b) b.focus(); return; }
    delete gates[id];
    after(r, 'Eligibility re-run: active, deductible met.', 'board.card.' + id + '.expand');
  }
  /* The read-only Board offers no live action: Checkout is held here rather than routing to a screen that
     would refuse on arrival. */
  function goCheckout(id, r, where) {
    if (P().outage) {
      const scope = where === 'queue' ? 'board.queue.row.' + id : 'board.card.' + id;
      raise(where === 'queue' ? rowGates : gates, id, outageRefusal('checkout is read-only'), r);
      render(r); focusGate(scope); return;
    }
    Proto.router.go(r.persona, 'checkout', id);
  }
  function doPing(id, r) {
    const a = Proto.store.appt(id); if (!a) return;
    const res = Proto.store.pingChair(id);
    if (!res.ok) {
      // The rate gate's one control opens the chart it names; outage and pass gates carry their own controls.
      raise(pings, id, Object.assign({}, res, { why: res.why || 'One ping per encounter per 15 minutes. The chair device saw the first one; a second would only add noise.' }), r, () => Proto.router.go(r.persona, 'encounter', a.encounterId));
      render(r); focusGate('board.queue.row.' + id); return;
    }
    pings[id] = { text: 'Pinged chair ' + a.op + ' · ' + clock12(S().clock.time) + ' · one-to-one, not broadcast' };
    after(r, 'Pinged chair ' + a.op, 'board.queue.row.' + id + '.ping');
  }
  function holdStrip(r, res, testid) { dropGates(res.code); stripGate = gateFor(res, r); stripGate.testid = testid; render(r); focusGate(); }

  // ---- Readiness strip ---------------------------------------------------------------------
  /* A mark made on this strip is this reader's own, so the way out of it is this reader's own too: the act
     leaves an Undo beside the line it wrote, and pressing it puts the row back (INT-exit-and-undo). */
  function markUndo(ui, testid, done, label, run, announce) { ui.undo = { testid, done, label, run, announce }; }
  /* Every row's id segment is the seed id of the thing the row is about (CONTRACTS §4). */
  function readinessRows(r) {
    const s = S(); const ui = uiState(); const rows = [];
    const amber = todays().filter((a) => a.eligibility === 'amber' && !['checked_out', 'checked_out_unfiled'].includes(a.status)).sort(byTime);
    const reverifyAll = (testid) => {
      // Only the re-runs the store accepted are counted; when every one was refused the refusal is what shows.
      const results = amber.map((a) => Proto.store.reverify(a.id)); const ok = results.filter((x) => x.ok).length;
      if (!ok) { holdStrip(r, results[0], testid); return; }
      ui.eligRerun += ok;
      after(r, 'Re-ran ' + ok + ' eligibility check' + (ok > 1 ? 's' : '') + ': all active.', 'board.readiness.toggle');
    };
    if (amber.length) rows.push({ id: amber[0].id, time: amber[0].time, word: 'Eligibility', line: amber.length + ' insured patient' + (amber.length > 1 ? 's' : '') + ' came back amber at 6 am — first at ' + fmtTime(amber[0].time), control: 'Re-verify all', testid: 'board.readiness.row.' + amber[0].id + '.reverify-all', act: () => reverifyAll('board.readiness.row.' + amber[0].id + '.reverify-all') });
    const lab = todays().find((a) => a.labCase && a.labCase.status === 'not_back');
    if (lab && !ui.labCalled) rows.push({ id: lab.labCase.id, time: lab.time, word: 'Lab', line: 'Lab case for ' + fmtTime(lab.time) + ' chair ' + lab.op + ' not back — ' + lab.labCase.vendor + ', due ' + shortDate(lab.labCase.due), control: 'Call lab', testid: 'board.readiness.row.' + lab.labCase.id + '.call', act: () => { ui.labCalled = s.clock.time; markUndo(ui, 'board.readiness.row.' + lab.labCase.id + '.undo', 'Called ' + lab.labCase.vendor + ' · ' + clock12(s.clock.time), 'Undo the lab call', () => { ui.labCalled = null; }, 'Lab call taken back — the row is back on the strip.'); after(r, 'Called ' + lab.labCase.vendor + ' at ' + clock12(s.clock.time) + ' — marked on your readiness strip. Undo sits beside it.', 'board.readiness.toggle'); } });
    const stale = Proto.store.user(STALE_DEVICE.userId);
    if (stale && !ui.deviceReset) rows.push({ id: stale.id, time: '09:00', word: 'Device', line: 'Shared tablet chair ' + STALE_DEVICE.op + ' still signed in as ' + initials(stale.name) + ' from yesterday', control: 'Sign out the tablet', testid: 'board.readiness.row.' + stale.id + '.reset', act: () => { ui.deviceReset = s.clock.time; markUndo(ui, 'board.readiness.row.' + stale.id + '.undo', 'Tablet chair ' + STALE_DEVICE.op + ' signed out · ' + clock12(s.clock.time), 'Undo the sign-out', () => { ui.deviceReset = null; }, 'Sign-out taken back — the row is back on the strip.'); after(r, 'Tablet chair ' + STALE_DEVICE.op + ' signed out — marked on your readiness strip; the next author enters a PIN.', 'board.readiness.toggle'); } });
    const fd = s.roleTemplates.find((t) => t.code === 'frontdesk');
    if (fd && !frontDeskCover()) rows.push({ id: fd.code, time: '99:99', word: 'Tomorrow', line: 'Tomorrow: front desk has no coordinator', control: 'Add day pass', testid: 'board.readiness.row.' + fd.code + '.add', act: openRoles });
    rows.sort((x, y) => (x.time < y.time ? -1 : 1));
    return rows;
  }
  function handledLines() {
    const ui = uiState(); const out = [];
    if (ui.eligRerun) out.push(ui.eligRerun + ' eligibility check' + (ui.eligRerun > 1 ? 's' : '') + ' re-run');
    if (ui.labCalled) out.push('Called the lab · ' + clock12(ui.labCalled));
    if (ui.deviceReset) out.push('Tablet chair ' + STALE_DEVICE.op + ' signed out · ' + clock12(ui.deviceReset));
    if (frontDeskCover()) out.push('Front-desk day pass added for tomorrow');
    return out;
  }
  function renderReadiness(r) {
    const rows = readinessRows(r); const ui = uiState(); const bodyId = 'board-readiness-body';
    const toggle = btn(ui.collapsed ? 'Show' : 'Hide', { kind: 'quiet', class: 'compact', testid: 'board.readiness.toggle', ariaLabel: (ui.collapsed ? 'Show' : 'Hide') + ' the readiness strip', onClick: () => { ui.collapsed = !ui.collapsed; render(r); const t = document.querySelector('[data-testid="board.readiness.toggle"]'); if (t) t.focus(); } });
    toggle.setAttribute('aria-expanded', String(!ui.collapsed)); toggle.setAttribute('aria-controls', bodyId);
    // One chip on the strip's face: the row words themselves are text, so six severity fills no longer
    // compete for the same glance (CLT-chip-vocab, CDS-STATUS-roles-max).
    const head = h('div', { class: 'row between' },
      h('div', { class: 'row' }, h('h2', { text: 'Before open' }), rows.length ? chip('review', rows.length + ' to handle') : chip('clear', 'Ready', { big: true })),
      toggle);
    const body = h('div', { class: 'stack', id: bodyId });
    if (ui.collapsed) body.hidden = true;
    else if (rows.length) {
      for (const row of rows) {
        // Under the outage every control holds; a refusal of one row's own verb holds that row (CONTRACTS §6).
        // A held control takes its name from btn(): "Held", named "Held: <what>", one wording everywhere (WCAG 3.2.4).
        const held = !!stripGate && (stripGate.code === 'outage' || stripGate.testid === row.testid);
        const control = held
          ? btn(row.control, { kind: 'held', testid: row.testid, onClick: () => { render(r); if (stripGate) focusGate(); else { const b = document.querySelector('[data-testid="' + row.testid + '"]'); if (b) b.click(); } } })
          : btn(row.control, { kind: 'reversible', testid: row.testid, onClick: () => (P().outage ? holdStrip(r, outageRefusal('readiness is read-only'), row.testid) : row.act()) });
        body.append(h('div', { class: 'rdrow', role: 'group', 'aria-label': row.line }, h('span', { class: 'line' }, h('b', { text: row.word }), ' · ' + row.line), control));
      }
      if (stripGate) body.append(h('div', { class: 'gate' }, stripGate.node));
    } else {
      const done = handledLines();
      body.append(h('p', { class: 'small muted', text: 'Nothing blocks a chair today or tomorrow.' }));
      if (done.length) body.append(h('details', null, h('summary', { class: 'small', testid: 'board.readiness.handled' }, 'What was handled'), h('ul', { class: 'small muted' }, ...done.map((t) => h('li', { text: t })))));
    }
    if (!ui.collapsed && ui.undo) {
      const u = ui.undo;
      body.append(h('div', { class: 'rdrow', role: 'group', 'aria-label': u.done },
        h('span', { class: 'line small muted', text: u.done }),
        btn(u.label, { kind: 'quiet', class: 'compact', testid: u.testid, onClick: () => { ui.undo = null; u.run(); after(r, u.announce, 'board.readiness.toggle'); } })));
    }
    /* The strip is a region of rows, not one card: each row is its own bounded group with its own control, so
       a reader holds one row at a time rather than five controls inside one panel (CLT-chunk-4). */
    return h('section', { class: 'readiness', 'aria-label': 'Readiness before open' }, head, body);
  }

  // ---- Chair strip (initials and chair only; never patient data) ----------------------------
  function renderChairs(r) {
    const loc = S().locations[0]; const strip = h('div', { class: 'chairstrip', role: 'list', 'aria-label': 'Who is charting in each chair' });
    for (let n = 1; n <= loc.operatories; n++) {
      const seated = todays().find((a) => a.op === n && IN_CHAIR.includes(a.status));
      const prov = seated ? Proto.store.user(seated.providerId) : null;
      /* The strip states a fact — who is charting where — so it is written as one, not as three disclosures
         whose only content was the name they were hiding. The author's full name and licence sit in the line
         itself, which costs nothing to read and three controls less on the first screen
         (INT-temp-first-screenful, INT-verb-labels, CLT-label-words). */
      const who = prov ? prov.name + (prov.licence ? ', ' + prov.licence : '') : 'No author yet';
      const fact = h('span', { class: 'chair', testid: 'board.chair.' + n },
        h('span', { text: 'Chair ' + n + ' · ' + provInitials(prov) }),
        prov && prov.licence ? h('span', { class: 'small muted', text: ' · ' + prov.licence }) : null,
        seated && seated.status === 'ready_for_exam' ? chip('review', 'Exam requested') : null);
      strip.append(h('div', { class: 'chairwrap', role: 'listitem' }, fact, h('div', { class: 'stamp', text: who })));
    }
    return strip;
  }

  // ---- Appointment card --------------------------------------------------------------------
  function details(a) {
    // The balance is the ledger's, the same number the Checkout and the Ledger screen print.
    const bal = Proto.store.balances(a.patientId);
    const rows = [
      h('div', { class: 'row' }, h('span', { text: 'Forms' }), chip(a.formsDone ? 'clear' : 'review', a.formsDone ? 'Done' : 'Due at arrival')),
      h('div', { text: 'Balance ' + money(bal.patientDue) + (bal.insurancePending ? ' · ' + money(bal.insurancePending) + ' waiting on insurance' : '') + (bal.credit ? ' · ' + money(bal.credit) + ' credit' : '') }),
    ];
    if (a.eligibilityNote) rows.push(h('div', { text: a.eligibilityNote }));
    else if (a.eligibility === 'amber') rows.push(h('div', { text: '6 am 270/271 returned amber' + (a.eligibilityRerun === 'running' ? ' · re-run started on arrival' : ' · re-runs on arrival') }));
    if (a.arrivedAt) rows.push(h('div', { text: 'Arrived ' + clock12(a.arrivedAt) }));
    if (a.referral) rows.push(h('div', { text: 'Referred by ' + a.referral.from + ' — ' + a.referral.reason + (a.referral.recordsForwarded ? ' · records received' : '') }));
    if (a.labCase) rows.push(h('div', { text: 'Lab case at ' + a.labCase.vendor + ' · ' + (a.labCase.status === 'not_back' ? 'not back' : a.labCase.status) + ' · due ' + shortDate(a.labCase.due) }));
    return h('div', { class: 'details', id: 'board-details-' + a.id }, ...rows);
  }
  /* The words the card's face used to say in four more chips. The chip stays for the one thing that changes
     hour by hour — the visit's status — and the standing facts are read as a line (CLT-chip-vocab). */
  // The eligibility word is ui.js ELIG's, the one Chairs and the rail print, so an amber visit reads the same everywhere (WCAG 3.2.4).
  const ELIG_LINE = Object.fromEntries(Object.entries(Proto.ui.ELIG).map(([k, v]) => [k, v[1]]));
  function metaWords(a, pt) {
    const out = [Proto.ui.typeWord(a.type), ELIG_LINE[a.eligibility] || ELIG_LINE.none];
    if (pt.alerts.length) out.push(pt.alerts.length + ' alert' + (pt.alerts.length > 1 ? 's' : ''));
    if (a.labCase && a.labCase.status === 'not_back') out.push('Case not back');
    if (a.referral) out.push('Referred in');
    return out.join(' · ');
  }
  function card(a, r, inLane) {
    const priv = P().privacy; const outage = P().outage; const s = S();
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv);
    const [ssev, sword] = STATUS[a.status] || ['info', a.status]; const tword = Proto.ui.typeWord(a.type);
    const el = h('article', { class: 'card appt ' + a.type, testid: 'board.card.' + a.id, 'aria-label': fmtTime(a.time) + ' ' + name + ', ' + tword + ', ' + sword });
    el.append(h('div', { class: 'who' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), chip(ssev, sword)));
    const meta = h('div', { class: 'meta' }, h('span', { class: 'grow', text: metaWords(a, pt) }));
    const g = gates[a.id]; const scope = 'board.card.' + a.id;
    const held = (act) => () => heldPress(r, gates, a.id, scope, act);
    // Under the outage this control keeps its place too: the store refuses it, the gate says why, and it
    // switches to Held like every other control on the card (CONTRACTS §6).
    if (a.eligibility === 'amber') meta.append(btn('Re-verify', { kind: g ? 'held' : 'reversible', class: 'compact', testid: scope + '.reverify', ariaLabel: g ? null : 'Re-verify eligibility for ' + name, onClick: g ? held(() => doReverify(a.id, r)) : () => doReverify(a.id, r) }));
    el.append(meta);
    if (inLane) el.append(h('div', { class: 'stamp', text: windowWord(a) + ' · charges and claim release when ' + (Proto.store.user(a.providerId) || {}).short + ' files the note' }));
    // The arrived stamp is where the keyboard lands after Arrive (focusable, not a control), so Seat is a choice.
    if (a.status === 'arrived' && a.arrivedAt) el.append(h('div', { class: 'stamp', id: 'board-arrived-' + a.id, tabindex: '-1', text: 'Arrived ' + clock12(a.arrivedAt) + ' · Seat is the next step' }));
    if (outage) el.append(h('div', { class: 'stamp', text: 'As of ' + clock12(CACHE_TIME) + ' · ' + minutesBetween(CACHE_TIME, s.clock.time) + ' min old · read-only' }));
    // The primary keeps its place under the outage and switches to Held when the gate is raised (CONTRACTS §6).
    /* One action and one way to see more: the row's verb, and the disclosure that holds everything the verb
       does not need. The patient rail opens from inside that disclosure rather than from a third button on
       every card face, which is what put 34 controls on the first screen (INT-temp-first-screenful). */
    const kt = keyMarks;
    const actions = h('div', { class: 'actions' });
    if (ARRIVABLE.includes(a.status)) actions.append(withKeyIf(kt.a === a.id, 'a', btn('Arrive', { kind: g ? 'held' : 'reversible', testid: scope + '.arrive', ariaLabel: g ? null : 'Arrive ' + name, onClick: g ? held(() => doArrive(a.id, r)) : () => doArrive(a.id, r) })));
    else if (a.status === 'arrived') actions.append(withKeyIf(kt.s === a.id, 's', btn('Seat', { kind: g ? 'held' : 'reversible', testid: scope + '.seat', ariaLabel: g ? null : 'Seat ' + name + ' in chair ' + a.op, onClick: g ? held(() => doSeat(a.id, r)) : () => doSeat(a.id, r) })));
    else if (CHECKOUTABLE.includes(a.status)) actions.append(withKeyIf(kt.c === a.id, 'c', btn('Check out', { kind: g ? 'held' : 'reversible', testid: scope + '.checkout', ariaLabel: g ? null : 'Check out ' + name, onClick: g ? held(() => goCheckout(a.id, r, 'card')) : () => goCheckout(a.id, r, 'card') })));
    const ex = btn(expanded[a.id] ? 'Hide details' : 'Show details', { kind: 'quiet', class: 'compact', testid: 'board.card.' + a.id + '.expand', ariaLabel: (expanded[a.id] ? 'Hide' : 'Show') + ' details for ' + name, onClick: () => { expanded[a.id] = !expanded[a.id]; render(r); const b = document.querySelector('[data-testid="board.card.' + a.id + '.expand"]'); if (b) b.focus(); } });
    ex.setAttribute('aria-expanded', String(!!expanded[a.id])); ex.setAttribute('aria-controls', 'board-details-' + a.id);
    actions.append(ex);
    el.append(actions);
    if (g) el.append(h('div', { class: 'gate' }, g.node));
    if (expanded[a.id]) {
      const d = details(a);
      if (Proto.screens.rail) d.append(h('div', { class: 'row' }, Proto.screens.rail.button(a.patientId, r, 'board.card.' + a.id + '.rail')));
      el.append(d);
    }
    return el;
  }

  // ---- Chair columns and the Filed later lane ----------------------------------------------
  function renderColumns(r) {
    const loc = S().locations[0]; const board = h('div', { class: 'board' });
    for (let n = 1; n <= loc.operatories; n++) {
      const list = todays().filter((a) => a.op === n && a.status !== 'checked_out_unfiled').sort(byTime);
      /* The column is a named region, and its name is written on it — but not as a heading: three column
         headings plus the strip's own put five headings on the first screen, where four is the budget
         (CLT-one-task). The region name is what a screen reader lands on either way. */
      board.append(h('div', { class: 'opcol', role: 'region', 'aria-label': 'Chair ' + n },
        h('div', { class: 'ophead' }, h('b', { text: 'Chair ' + n }), h('span', { class: 'small muted', text: list.length + ' today' })),
        ...list.map((a) => card(a, r, false))));
    }
    return board;
  }
  function renderLane(r) {
    const unfiled = todays().filter((a) => a.status === 'checked_out_unfiled').sort(byTime);
    if (!unfiled.length) return null;
    const paid = unfiled.some(paidAtWindow);
    return h('section', { class: 'lane stack', 'aria-label': 'Filed later' },
      h('div', { class: 'row' }, h('h2', { text: 'Filed later' }), h('span', { class: 'small muted', text: unfiled.length + ' waiting on a note · checked out before the note filed; charges and the claim release when it does' + (paid ? ', and a window payment sits as unapplied credit with an allocation intent.' : '.') })),
      h('div', { class: 'board' }, ...unfiled.map((a) => card(a, r, true))));
  }

  // ---- Checkout queue ----------------------------------------------------------------------
  function queueRow(a, r) {
    const priv = P().privacy;
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv); const prov = Proto.store.user(a.providerId) || { short: '—', name: '—' };
    const filed = noteFiled(a); const [, sword] = STATUS[a.status] || ['info', a.status];
    /* Note and claim are read as a sentence, not as four more fills: the queue held sixteen chips of its own,
       a third of every chip on the screen, and the words are what the front desk repeats down the phone. */
    const noteWord = filed ? 'Note filed' : 'Note open · ' + provInitials(prov);
    // The claim keeps its chip — it is the one thing on this row the front desk cannot fix, and Checkout
    // prints the same word for the same visit (WCAG 3.2.4). Everything else on the row is read as a line.
    const claimChip = !filed ? chip('info', 'Waiting on note') : needsAttachment(a) ? chip('review', 'Needs: attachment') : chip('clear', 'Ready');
    const row = h('div', { class: 'qrow', testid: 'board.queue.row.' + a.id, role: 'group', 'aria-label': 'Checkout queue: ' + name + ', note ' + (filed ? 'filed' : 'open') });
    row.append(h('div', { class: 'head' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), h('span', { class: 'small muted', text: sword })));
    row.append(h('div', { class: 'row' }, h('span', { class: 'small muted', text: noteWord + ' · Claim' }), claimChip));
    if (!filed) {
      // The line above already says the note is open and whose it is; the control says what to do about it.
      row.append(h('div', { class: 'row' }, btn('Ping chair', { kind: 'reversible', class: 'compact', testid: 'board.queue.row.' + a.id + '.ping', ariaLabel: 'Ping chair ' + a.op + ' about the open note', onClick: () => doPing(a.id, r) })));
      const p = pings[a.id]; if (p) row.append(p.node || h('div', { class: 'stamp', text: p.text }));
    }
    const rg = rowGates[a.id];
    // The name says what the control does to whom; why it is worth doing is the line beside it, not twelve
    // more words inside the button's name (CLT-label-words).
    const checkout = (ariaLabel) => btn('Check out', { kind: rg ? 'held' : 'reversible', testid: 'board.queue.row.' + a.id + '.checkout', ariaLabel: rg ? null : ariaLabel, onClick: rg ? () => heldPress(r, rowGates, a.id, 'board.queue.row.' + a.id, () => goCheckout(a.id, r, 'queue')) : () => goCheckout(a.id, r, 'queue') });
    if (a.status === 'checked_out_unfiled') row.append(h('div', { class: 'row' }, checkout('Check out ' + name), h('span', { class: 'small muted', text: windowWord(a) + ' · in the Filed later lane until ' + prov.short + ' files; charges post then' })));
    else row.append(h('div', { class: 'row' }, checkout('Check out ' + name), filed ? null : h('span', { class: 'small muted', text: 'Checkout works now; charges post when the note files.' })));
    if (rg) row.append(h('div', { class: 'gate' }, rg.node));
    return row;
  }
  function renderQueue(r) {
    const rows = todays().filter((a) => CHECKOUTABLE.includes(a.status) || a.status === 'checked_out_unfiled').sort(byTime);
    const done = todays().filter((a) => a.status === 'checked_out').length;
    const toCome = todays().filter((a) => ARRIVABLE.includes(a.status)).length;
    // The empty state says which empty this is: a day that has not started, or one that has finished.
    const empty = done
      ? done + (done === 1 ? ' patient has' : ' patients have') + ' left the chair today and every one is checked out with the note filed' + (toCome ? ' — ' + toCome + ' still to arrive; Arrive them from the chair column.' : '. Nothing is waiting at the window; the day closes from Daily Close.')
      : 'Nobody has left the chair yet' + (toCome ? ' — the queue fills as patients are seated; Arrive the first one from the chair column.' : ' and nobody is scheduled to.');
    /* Like the readiness strip, a region of rows rather than one card: each row is the group a reader holds,
       and the panel that used to wrap eight controls and sixteen chips is gone (CLT-chunk-4, CLT-chip-vocab). */
    return h('section', { class: 'flat stack queue', 'aria-label': 'Checkout queue' },
      h('div', { class: 'row' }, h('h2', { text: 'Checkout queue' }), h('span', { class: 'small muted', text: rows.length + ' in chair-out order' })),
      rows.length ? h('div', { class: 'worklist' }, ...rows.map((a) => queueRow(a, r))) : h('p', { class: 'small muted', text: empty }),
      h('details', null, h('summary', { class: 'small', testid: 'board.queue.why' }, 'Why these words'), h('p', { class: 'small muted', text: 'Note reads the filed-note row on the encounter; Claim reads the claim state. No front-desk control can flip either. The ping is an in-app event to that chair only, one per encounter per 15 minutes.' })));
  }

  /* The practice line counts the notes this day actually filed, and the median arrive → filed span of the
     visits that carry both timestamps. */
  function practiceLine() {
    const s = S();
    const filed = s.filedNotes.filter((n) => n.filedOn === s.tenant.today);
    const spans = [];
    for (const n of filed) {
      const enc = Proto.store.encounter(n.encounterId); if (!enc) continue;
      const a = Proto.store.appt(enc.appointmentId); if (!a || !a.arrivedAt || !n.filedTime) continue;
      const m = minutesBetween(a.arrivedAt, n.filedTime); if (m >= 0) spans.push(m);
    }
    spans.sort((x, y) => x - y);
    const mid = spans.length ? (spans.length % 2 ? spans[(spans.length - 1) / 2] : Math.round((spans[spans.length / 2 - 1] + spans[spans.length / 2]) / 2)) : null;
    if (!filed.length) return 'No notes filed today yet';
    return filed.length + (filed.length === 1 ? ' note' : ' notes') + ' filed today' + (mid != null ? ' · median arrive → filed ' + mid + ' min' : '');
  }

  // ---- Keyboard accelerators (only while the Board is mounted and the reader asked for them) ----
  /* A bare letter that arrives a patient, seats one or opens checkout is an accelerator nobody asked for:
     pressed on the page body it wrote to the record with no opt-in and no off switch. The handler now asks
     the reader's own preference first — `shortcuts` ships 'off' and lives in Settings — and every key it
     honours is printed on the control it acts on (CUST-2.1.4 / WCAG 2.1.4). */
  function onKey(ev) {
    const r = Proto.router.current();
    if (r.route !== 'board') { document.removeEventListener('keydown', onKey); keysBound = false; return; }
    if (!shortcutsOn()) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('#dialogs .overlay')) return;
    const k = (ev.key || '').toLowerCase(); if (!['a', 's', 'c'].includes(k)) return;
    ev.preventDefault();
    // The key runs the same verb the card runs, so the outage is refused by the store through the gate the
    // card would have shown, not by an announcement of this screen's own.
    const list = todays().sort(byTime);
    if (k === 'a') { const a = list.find((x) => ARRIVABLE.includes(x.status)); if (a) doArrive(a.id, r); else Proto.router.announce('No one left to arrive'); }
    if (k === 's') { const a = list.find((x) => x.status === 'arrived'); if (a) doSeat(a.id, r); else Proto.router.announce('No one is waiting to be seated'); }
    if (k === 'c') { const a = list.find((x) => CHECKOUTABLE.includes(x.status)); if (a) goCheckout(a.id, r, 'card'); else Proto.router.announce('Nothing to check out yet'); }
  }

  // ---- Screen ------------------------------------------------------------------------------
  function render(r) {
    syncStore(); pruneStaleGates(); keyMarks = keyTargets();
    const s = S(); const loc = s.locations[0]; const outage = P().outage;
    const day = weekday(s.tenant.today);
    /* The heading names the screen; the day, the clock and the shape of the day are the line under it. The
       key legend is gone from here: a letter is printed on the control it presses, 546 px closer to the eye
       (CLT-scent-heading, CLT-split-attention, CLT-recognition-keys). */
    const sub = clock12(s.clock.time) + ' · ' + (day ? day + ' ' : '') + shortDate(s.tenant.today) + ' · ' + loc.operatories + ' chairs · ' + todays().length + ' appointments' + (outage ? ' · read-only from the ' + clock12(CACHE_TIME) + ' cache' : '');
    const lane = renderLane(r);
    // The chair columns come first: Arrive is the control this screen exists for (CONTRACTS §7 flow 1),
    // so the readiness strip and the queue share the side column rather than pushing it below the fold.
    const page = h('div', { class: 'stack boardpage' },
      pageHead('Board · ' + loc.name, sub),
      renderChairs(r),
      h('div', { class: 'board-layout' },
        h('div', { class: 'stack' }, renderColumns(r), lane),
        h('div', { class: 'stack' }, renderReadiness(r), renderQueue(r))),
      h('p', { class: 'small muted practice-line', text: practiceLine() }));
    Proto.screens.shell.mount(page);
    if (!keysBound) { document.addEventListener('keydown', onKey); keysBound = true; }
  }

  window.addEventListener('hashchange', () => { if (keysBound && Proto.router.current().route !== 'board') { document.removeEventListener('keydown', onKey); keysBound = false; } });

  Proto.screens.board = { render, arrive: doArrive, seat: doSeat, reverify: doReverify, ping: doPing };
  Proto.router.on('board', (r) => Proto.screens.board.render(r));
})();
