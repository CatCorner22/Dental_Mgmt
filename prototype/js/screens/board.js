/* Board: front-desk and temp home. Readiness strip before open, chair strip (author initials only),
   one column per chair, checkout queue with Note/Claim chips, the Filed later lane,
   read-only outage rendering, and the A / S / C keyboard accelerators while mounted. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, displayName, initials, shortDate, pageHead } = Proto.ui;
  Proto.screens = Proto.screens || {};

  /* One word per status code, the same word the Chairs screen and the Rail print: a seated patient is
     Seated until the chart is open, and only then In chart. */
  const STATUS = {
    scheduled: ['info', 'Scheduled'], confirmed: ['info', 'Confirmed'], arrived: ['review', 'Arrived'],
    seated: ['info', 'Seated'], in_chart: ['info', 'In chart'], ready_for_exam: ['review', 'Exam requested'],
    note_filed: ['clear', 'Note filed'], checked_out: ['clear', 'Done'], checked_out_unfiled: ['review', 'Filed later'],
  };
  const TYPE = { hygiene: ['clear', 'Hygiene'], restorative: ['style', 'Restorative'], exam: ['info', 'Exam'], surgery: ['stop', 'Surgery'], emergency: ['required', 'Emergency'] };
  const ELIG = { green: ['clear', 'Eligible'], amber: ['review', 'Verify'], none: ['info', 'Self-pay'] };
  const IN_CHAIR = ['seated', 'in_chart', 'ready_for_exam'];
  const ARRIVABLE = ['scheduled', 'confirmed'];
  const CHECKOUTABLE = ['in_chart', 'note_filed'];

  const CACHE_TIME = '07:58'; // last successful fetch shown by the Andon slot during an outage
  const SUPPORT = 'Support: 615-555-0100, answered 7 am to 6 pm Central';
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
  let chairOpen = {}; // op -> boolean
  let boardUi = {};   // userId -> {collapsed, labCalled, deviceReset, eligRerun}; a shared desk is not a person
  let keysOn = false;

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
  /* The strip is one person's working state, so it is keyed by the user reading it and never written to a
     store table: a mark the front desk makes on a shared desk is not the temp's mark and records nothing. */
  const uiState = () => { const uid = Proto.store.currentUser().id; return (boardUi[uid] = boardUi[uid] || { collapsed: false, labCalled: null, deviceReset: null, eligRerun: 0 }); };
  /* Tomorrow's front-desk cover is a front-desk pass at this location, not any pass at any location. */
  const frontDeskCover = () => S().dayPasses.some((d) => d.role === 'frontdesk' && d.locationId === 'loc-1');
  const weekday = (iso) => { const p = String(iso == null ? '' : iso).trim().split('-').map(Number); return p.length === 3 && p.every((x) => Number.isFinite(x)) ? WEEKDAY[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] : null; };
  const outageRefusal = (what) => Proto.store.refuse('outage', 'Wait for the server — ' + what, 'Support line', OUTAGE_WHY);

  function syncStore() { const s = S(); if (s !== lastStore) { lastStore = s; gates = {}; rowGates = {}; stripGate = null; pings = {}; expanded = {}; chairOpen = {}; boardUi = {}; } }
  /* A gate outlives its reason only if nobody clears it: once the connection is back the outage gates go and
     every primary returns to its own identity, so a Held button is never a dead end after the outage ends. */
  function pruneStaleGates() {
    if (P().outage) return;
    for (const k of Object.keys(gates)) if (gates[k].code === 'outage') delete gates[k];
    for (const k of Object.keys(rowGates)) if (rowGates[k].code === 'outage') delete rowGates[k];
    for (const k of Object.keys(pings)) if (pings[k].code === 'outage') delete pings[k];
    if (stripGate && stripGate.code === 'outage') stripGate = null;
  }

  /* Re-render after a mutation: Andon, temp rail, then this screen; move focus to a named control. */
  function after(r, announce, focusTestid) {
    Proto.screens.shell.refreshAndon(r);
    if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    render(r);
    if (focusTestid) { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el) el.focus(); }
    if (announce) Proto.router.announce(announce);
  }
  /* Wrap a store refusal so its DOM node is built (and logged) once and reused across re-renders. The
     component logs and announces the gate; this screen never announces one itself. */
  function gateFor(res, onControl) {
    const g = { code: res.code, verb: res.verb, control: res.control, why: res.why };
    g.node = refusal({ code: g.code, verb: g.verb, control: g.control, why: g.why, severity: g.code === 'outage' ? 'stop' : 'required', onControl: () => { if (g.code === 'outage') Proto.router.announce(SUPPORT); if (onControl) onControl(g); } });
    return g;
  }
  const focusGate = () => { const c = document.querySelector('[data-testid="refusal.control"]'); if (c) c.focus(); };

  // ---- Actions -----------------------------------------------------------------------------
  function doArrive(id, r) {
    const a = Proto.store.appt(id); if (!a || !ARRIVABLE.includes(a.status)) return;
    const res = Proto.store.arrive(id);
    if (!res.ok) { gates[id] = gateFor(res); render(r); const b = document.querySelector('[data-testid="board.card.' + id + '.arrive"]'); if (b) b.focus(); return; }
    delete gates[id];
    after(r, displayName(Proto.store.patient(a.patientId).name, P().privacy) + ' arrived. Seat is the next step on the same card.', 'board.card.' + id + '.seat');
  }
  function doSeat(id, r) {
    const a = Proto.store.appt(id); if (!a || a.status !== 'arrived') return;
    const res = Proto.store.seat(id);
    if (!res.ok) { gates[id] = gateFor(res); render(r); const b = document.querySelector('[data-testid="board.card.' + id + '.seat"]'); if (b) b.focus(); return; }
    delete gates[id];
    // Focus stays on the card that was worked, not on the chair strip at the top of the page.
    after(r, 'Seated in chair ' + a.op + '. The chair strip now shows ' + provInitials(Proto.store.user(a.providerId)) + '.', 'board.card.' + id + '.expand');
  }
  function doReverify(id, r) {
    const a = Proto.store.appt(id); if (!a) return;
    const res = Proto.store.reverify(id);
    if (!res.ok) { gates[id] = gateFor(res); render(r); focusGate(); return; }
    after(r, 'Eligibility re-run: active, deductible met.', 'board.card.' + id + '.expand');
  }
  /* The read-only Board offers no live action: Checkout is held here rather than routing to a screen that
     would refuse on arrival. */
  function goCheckout(id, r, where) {
    if (P().outage) {
      const g = gateFor(outageRefusal('checkout is read-only'));
      if (where === 'queue') rowGates[id] = g; else gates[id] = g;
      render(r); focusGate(); return;
    }
    Proto.router.go(r.persona, 'checkout', id);
  }
  function doPing(id, r) {
    const a = Proto.store.appt(id); if (!a) return;
    const res = Proto.store.pingChair(id);
    if (!res.ok) {
      // The gate's one control opens the chart it names.
      pings[id] = { code: res.code, node: refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why || 'One ping per encounter per 15 minutes. The chair device saw the first one; a second would only add noise.', severity: res.code === 'outage' ? 'stop' : 'required', onControl: () => { if (res.code === 'outage') Proto.router.announce(SUPPORT); else Proto.router.go(r.persona, 'encounter', a.encounterId); } }) };
      render(r); focusGate(); return;
    }
    pings[id] = { text: 'Pinged chair ' + a.op + ' · ' + clock12(S().clock.time) + ' · one-to-one, not broadcast' };
    after(r, 'Pinged chair ' + a.op, 'board.queue.row.' + id + '.ping');
  }
  function holdStrip(r) { stripGate = stripGate || gateFor(outageRefusal('readiness is read-only')); render(r); focusGate(); }

  // ---- Readiness strip ---------------------------------------------------------------------
  /* Every row's id segment is the seed id of the thing the row is about (CONTRACTS §4). */
  function readinessRows(r) {
    const s = S(); const ui = uiState(); const rows = [];
    const amber = todays().filter((a) => a.eligibility === 'amber' && !['checked_out', 'checked_out_unfiled'].includes(a.status)).sort(byTime);
    if (amber.length) rows.push({ id: amber[0].id, time: amber[0].time, sev: 'review', word: 'Eligibility', line: amber.length + ' insured patient' + (amber.length > 1 ? 's' : '') + ' came back amber at 6 am — first at ' + fmtTime(amber[0].time), control: 'Re-verify all', testid: 'board.readiness.row.' + amber[0].id + '.reverify-all', act: () => { amber.forEach((a) => Proto.store.reverify(a.id)); ui.eligRerun += amber.length; after(r, 'Re-ran ' + amber.length + ' eligibility check' + (amber.length > 1 ? 's' : '') + ': all active.', 'board.readiness.toggle'); } });
    const lab = todays().find((a) => a.labCase && a.labCase.status === 'not_back');
    if (lab && !ui.labCalled) rows.push({ id: lab.labCase.id, time: lab.time, sev: 'review', word: 'Lab', line: 'Lab case for ' + fmtTime(lab.time) + ' chair ' + lab.op + ' not back — ' + lab.labCase.vendor + ', due ' + shortDate(lab.labCase.due), control: 'Call lab', testid: 'board.readiness.row.' + lab.labCase.id + '.call', act: () => { ui.labCalled = s.clock.time; after(r, 'Called ' + lab.labCase.vendor + ' at ' + clock12(s.clock.time) + ' — marked on your readiness strip.', 'board.readiness.toggle'); } });
    const stale = Proto.store.user(STALE_DEVICE.userId);
    if (stale && !ui.deviceReset) rows.push({ id: stale.id, time: '09:00', sev: 'required', word: 'Device', line: 'Shared tablet chair ' + STALE_DEVICE.op + ' still signed in as ' + initials(stale.name) + ' from yesterday', control: 'Sign out', testid: 'board.readiness.row.' + stale.id + '.reset', act: () => { ui.deviceReset = s.clock.time; after(r, 'Tablet chair ' + STALE_DEVICE.op + ' signed out — marked on your readiness strip; the next author enters a PIN.', 'board.readiness.toggle'); } });
    const fd = s.roleTemplates.find((t) => t.code === 'frontdesk');
    if (fd && !frontDeskCover()) rows.push({ id: fd.code, time: '99:99', sev: 'info', word: 'Tomorrow', line: 'Tomorrow: front desk has no coordinator', control: 'Add day pass', testid: 'board.readiness.row.' + fd.code + '.add', act: () => Proto.router.go(r.persona, 'roles') });
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
    const rows = readinessRows(r); const ui = uiState(); const outage = P().outage; const bodyId = 'board-readiness-body';
    const toggle = btn(ui.collapsed ? 'Show' : 'Hide', { kind: 'quiet', class: 'compact', testid: 'board.readiness.toggle', ariaLabel: (ui.collapsed ? 'Show' : 'Hide') + ' the readiness strip', onClick: () => { ui.collapsed = !ui.collapsed; render(r); const t = document.querySelector('[data-testid="board.readiness.toggle"]'); if (t) t.focus(); } });
    toggle.setAttribute('aria-expanded', String(!ui.collapsed)); toggle.setAttribute('aria-controls', bodyId);
    const head = h('div', { class: 'row between' },
      h('div', { class: 'row' }, h('h2', { text: 'Before open' }), rows.length ? chip('review', rows.length + ' to handle') : chip('clear', 'Ready', { big: true })),
      toggle);
    const body = h('div', { class: 'stack', id: bodyId });
    if (ui.collapsed) body.hidden = true;
    else if (rows.length) {
      for (const row of rows) {
        // Under the outage the control stays where it was and the gate says why it does nothing (CONTRACTS §6).
        const held = outage && !!stripGate;
        const control = held
          ? btn(row.control, { kind: 'held', testid: row.testid, onClick: focusGate })
          : btn(row.control, { kind: 'reversible', testid: row.testid, onClick: () => (P().outage ? holdStrip(r) : row.act()) });
        body.append(h('div', { class: 'rdrow', role: 'group', 'aria-label': row.line }, chip(row.sev, row.word), h('span', { class: 'line', text: row.line }), control));
      }
      if (outage && stripGate) body.append(h('div', { class: 'gate' }, stripGate.node));
    } else {
      const done = handledLines();
      body.append(h('p', { class: 'small muted', text: 'Nothing blocks a chair today or tomorrow.' }));
      if (done.length) body.append(h('details', null, h('summary', { class: 'small', testid: 'board.readiness.handled' }, 'What was handled'), h('ul', { class: 'small muted' }, ...done.map((t) => h('li', { text: t })))));
    }
    return h('section', { class: 'readiness card flat', 'aria-label': 'Readiness before open' }, head, body);
  }

  // ---- Chair strip (initials and chair only; never patient data) ----------------------------
  function renderChairs(r) {
    const loc = S().locations[0]; const strip = h('div', { class: 'chairstrip', role: 'list', 'aria-label': 'Who is charting in each chair' });
    for (let n = 1; n <= loc.operatories; n++) {
      const seated = todays().find((a) => a.op === n && IN_CHAIR.includes(a.status));
      const prov = seated ? Proto.store.user(seated.providerId) : null;
      const b = h('button', { type: 'button', class: 'chair', testid: 'board.chair.' + n, 'aria-expanded': String(!!chairOpen[n]), 'aria-label': 'Chair ' + n + (prov ? ', author ' + prov.name + (prov.licence ? ', ' + prov.licence : '') : ', empty') + '. Show device author', onClick: () => { chairOpen[n] = !chairOpen[n]; render(r); const el = document.querySelector('[data-testid="board.chair.' + n + '"]'); if (el) el.focus(); } },
        h('span', { text: 'Chair ' + n + ' · ' + provInitials(prov) }),
        prov && prov.licence ? h('span', { class: 'small muted', text: prov.licence }) : null,
        seated && seated.status === 'ready_for_exam' ? chip('review', 'Exam requested') : null);
      const detail = chairOpen[n] ? h('div', { class: 'stamp', text: prov ? prov.name + (prov.licence ? ', ' + prov.licence : '') + ' is the author on the chair ' + n + ' device' : 'No author on the chair ' + n + ' device; the next PIN opens a session' }) : null;
      strip.append(h('div', { class: 'chairwrap', role: 'listitem' }, b, detail));
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
  function card(a, r, inLane) {
    const priv = P().privacy; const outage = P().outage; const s = S();
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv);
    const [ssev, sword] = STATUS[a.status] || ['info', a.status]; const [tsev, tword] = TYPE[a.type] || ['info', a.type]; const [esev, eword] = ELIG[a.eligibility] || ELIG.none;
    const el = h('article', { class: 'card appt ' + a.type, testid: 'board.card.' + a.id, 'aria-label': fmtTime(a.time) + ' ' + name + ', ' + tword + ', ' + sword });
    el.append(h('div', { class: 'who' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), chip(ssev, sword)));
    const meta = h('div', { class: 'meta' }, chip(tsev, tword), chip(esev, eword));
    // Under the outage this control keeps its place too: the store refuses it and the gate says why.
    if (a.eligibility === 'amber') meta.append(btn('Re-verify', { kind: 'reversible', class: 'compact', testid: 'board.card.' + a.id + '.reverify', ariaLabel: 'Re-verify eligibility for ' + name, onClick: () => doReverify(a.id, r) }));
    if (pt.alerts.length) meta.append(chip('required', pt.alerts.length + ' alert' + (pt.alerts.length > 1 ? 's' : '')));
    if (a.labCase && a.labCase.status === 'not_back') meta.append(chip('review', 'Case not back'));
    if (a.referral) meta.append(chip('info', 'Referred in'));
    el.append(meta);
    if (inLane) el.append(h('div', { class: 'stamp', text: 'Paid at the window · charges and claim release when ' + (Proto.store.user(a.providerId) || {}).short + ' files the note' }));
    if (outage) el.append(h('div', { class: 'stamp', text: 'As of ' + clock12(CACHE_TIME) + ' · ' + minutesBetween(CACHE_TIME, s.clock.time) + ' min old · read-only' }));
    // The primary keeps its place under the outage and switches to Held when the gate is raised (CONTRACTS §6).
    const actions = h('div', { class: 'actions' });
    const g = gates[a.id];
    if (ARRIVABLE.includes(a.status)) actions.append(btn('Arrive', { kind: g ? 'held' : 'reversible', testid: 'board.card.' + a.id + '.arrive', ariaLabel: g ? 'Arrive held: ' + g.verb : 'Arrive ' + name, onClick: () => (g ? focusGate() : doArrive(a.id, r)) }));
    else if (a.status === 'arrived') actions.append(btn('Seat', { kind: g ? 'held' : 'reversible', testid: 'board.card.' + a.id + '.seat', ariaLabel: g ? 'Seat held: ' + g.verb : 'Seat ' + name + ' in chair ' + a.op, onClick: () => (g ? focusGate() : doSeat(a.id, r)) }));
    else if (CHECKOUTABLE.includes(a.status)) actions.append(btn('Checkout', { kind: g ? 'held' : 'reversible', testid: 'board.card.' + a.id + '.checkout', ariaLabel: g ? 'Checkout held: ' + g.verb : 'Checkout ' + name, onClick: () => (g ? focusGate() : goCheckout(a.id, r, 'card')) }));
    const ex = btn(expanded[a.id] ? 'Less' : 'Details', { kind: 'quiet', class: 'compact', testid: 'board.card.' + a.id + '.expand', ariaLabel: (expanded[a.id] ? 'Hide' : 'Show') + ' forms and balance for ' + name, onClick: () => { expanded[a.id] = !expanded[a.id]; render(r); const b = document.querySelector('[data-testid="board.card.' + a.id + '.expand"]'); if (b) b.focus(); } });
    ex.setAttribute('aria-expanded', String(!!expanded[a.id])); ex.setAttribute('aria-controls', 'board-details-' + a.id);
    actions.append(ex);
    if (Proto.screens.rail) actions.append(Proto.screens.rail.button(a.patientId, r, 'board.card.' + a.id + '.rail'));
    el.append(actions);
    if (g) el.append(h('div', { class: 'gate' }, g.node));
    if (expanded[a.id]) el.append(details(a));
    return el;
  }

  // ---- Chair columns and the Filed later lane ----------------------------------------------
  function renderColumns(r) {
    const loc = S().locations[0]; const board = h('div', { class: 'board' });
    for (let n = 1; n <= loc.operatories; n++) {
      const list = todays().filter((a) => a.op === n && a.status !== 'checked_out_unfiled').sort(byTime);
      board.append(h('div', { class: 'opcol', role: 'region', 'aria-label': 'Chair ' + n },
        h('div', { class: 'ophead' }, h('h2', { text: 'Chair ' + n }), h('span', { class: 'small muted', text: list.length + ' today' })),
        ...list.map((a) => card(a, r, false))));
    }
    return board;
  }
  function renderLane(r) {
    const unfiled = todays().filter((a) => a.status === 'checked_out_unfiled').sort(byTime);
    if (!unfiled.length) return null;
    return h('section', { class: 'lane stack', 'aria-label': 'Filed later' },
      h('div', { class: 'row' }, h('h2', { text: 'Filed later' }), chip('review', unfiled.length + ' waiting on a note'), h('span', { class: 'small muted', text: 'Checked out before the note filed; payment sits as unapplied credit with an allocation intent.' })),
      h('div', { class: 'board' }, ...unfiled.map((a) => card(a, r, true))));
  }

  // ---- Checkout queue ----------------------------------------------------------------------
  function queueRow(a, r) {
    const priv = P().privacy;
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv); const prov = Proto.store.user(a.providerId) || { short: '—', name: '—' };
    const filed = noteFiled(a); const [ssev, sword] = STATUS[a.status] || ['info', a.status];
    const noteChip = filed ? chip('clear', 'Filed') : chip('review', 'Open · ' + provInitials(prov));
    const claimChip = !filed ? chip('info', 'Waiting on note') : needsAttachment(a) ? chip('review', 'Needs: attachment') : chip('clear', 'Ready');
    const row = h('div', { class: 'qrow', testid: 'board.queue.row.' + a.id, role: 'group', 'aria-label': 'Checkout queue: ' + name + ', note ' + (filed ? 'filed' : 'open') });
    row.append(h('div', { class: 'head' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), chip(ssev, sword)));
    row.append(h('div', { class: 'row' }, h('span', { class: 'small muted', text: 'Note' }), noteChip, h('span', { class: 'small muted', text: 'Claim' }), claimChip));
    if (!filed) {
      row.append(h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Note not filed — ' + prov.short }), btn('Ping chair', { kind: 'reversible', class: 'compact', testid: 'board.queue.row.' + a.id + '.ping', ariaLabel: 'Ping chair ' + a.op + ' about the open note', onClick: () => doPing(a.id, r) })));
      const p = pings[a.id]; if (p) row.append(p.node || h('div', { class: 'stamp', text: p.text }));
    }
    const rg = rowGates[a.id];
    const checkout = (ariaLabel) => btn('Checkout', { kind: rg ? 'held' : 'reversible', testid: 'board.queue.row.' + a.id + '.checkout', ariaLabel: rg ? 'Checkout held: ' + rg.verb : ariaLabel, onClick: () => (rg ? focusGate() : goCheckout(a.id, r, 'queue')) });
    if (a.status === 'checked_out_unfiled') row.append(h('div', { class: 'row' }, checkout('Open checkout for ' + name + ' (already paid; charges post when the note files)'), h('span', { class: 'small muted', text: 'Paid at the window · in the Filed later lane until ' + prov.short + ' files' })));
    else row.append(h('div', { class: 'row' }, checkout('Checkout ' + name), filed ? null : h('span', { class: 'small muted', text: 'Checkout works now; charges post when the note files.' })));
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
    return h('section', { class: 'card flat stack queue', 'aria-label': 'Checkout queue' },
      h('div', { class: 'row' }, h('h2', { text: 'Checkout queue' }), chip('info', rows.length + ' in chair-out order')),
      rows.length ? h('div', { class: 'worklist' }, ...rows.map((a) => queueRow(a, r))) : h('p', { class: 'small muted', text: empty }),
      h('details', null, h('summary', { class: 'small', testid: 'board.queue.why' }, 'Why these chips'), h('p', { class: 'small muted', text: 'Note reads the filed-note row on the encounter; Claim reads the claim state. No front-desk control can flip either. The ping is an in-app event to that chair only, one per encounter per 15 minutes.' })));
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

  // ---- Keyboard accelerators (active only while the Board is the current route) -------------
  function onKey(ev) {
    const r = Proto.router.current();
    if (r.route !== 'board') { document.removeEventListener('keydown', onKey); keysOn = false; return; }
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
    if (k === 'c') { const a = list.find((x) => x.status === 'note_filed'); if (a) goCheckout(a.id, r, 'card'); else Proto.router.announce('Nothing to check out yet'); }
  }

  // ---- Screen ------------------------------------------------------------------------------
  function render(r) {
    syncStore(); pruneStaleGates();
    const s = S(); const loc = s.locations[0]; const outage = P().outage;
    const day = weekday(s.tenant.today);
    const sub = clock12(s.clock.time) + ' · ' + loc.operatories + ' chairs · ' + todays().length + ' appointments' + (outage ? ' · read-only from the ' + clock12(CACHE_TIME) + ' cache' : '') + ' · keys: A arrive, S seat, C checkout';
    const lane = renderLane(r);
    // The chair columns come first: Arrive is the control this screen exists for (CONTRACTS §7 flow 1),
    // so the readiness strip and the queue share the side column rather than pushing it below the fold.
    const page = h('div', { class: 'stack boardpage' },
      pageHead('Board · ' + loc.name + ' · ' + (day ? day + ' ' : '') + shortDate(s.tenant.today), sub),
      renderChairs(r),
      h('div', { class: 'board-layout' },
        h('div', { class: 'stack' }, renderColumns(r), lane),
        h('div', { class: 'stack' }, renderReadiness(r), renderQueue(r))),
      h('p', { class: 'small muted practice-line', text: practiceLine() }));
    Proto.screens.shell.mount(page);
    if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; }
  }

  window.addEventListener('hashchange', () => { if (keysOn && Proto.router.current().route !== 'board') { document.removeEventListener('keydown', onKey); keysOn = false; } });

  Proto.screens.board = { render, arrive: doArrive, seat: doSeat, reverify: doReverify, ping: doPing };
  Proto.router.on('board', (r) => Proto.screens.board.render(r));
})();
