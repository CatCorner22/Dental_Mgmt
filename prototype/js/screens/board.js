/* Board: front-desk and temp home. Readiness strip before open, chair strip (author initials only),
   one operatory column per chair, checkout queue with Note/Claim chips, the Filed-later lane,
   read-only outage rendering, and the A / S / C keyboard accelerators while mounted. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, displayName, initials, shortDate, pageHead } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const STATUS = {
    scheduled: ['info', 'Scheduled'], confirmed: ['info', 'Confirmed'], arrived: ['review', 'Arrived'],
    seated: ['info', 'In chart'], in_chart: ['info', 'In chart'], ready_for_exam: ['review', 'Exam requested'],
    note_filed: ['clear', 'Note filed'], checked_out: ['clear', 'Done'], checked_out_unfiled: ['review', 'Filed later'],
  };
  const TYPE = { hygiene: ['clear', 'Hygiene'], restorative: ['style', 'Restorative'], exam: ['info', 'Exam'], surgery: ['stop', 'Surgery'], emergency: ['required', 'Emergency'] };
  const ELIG = { green: ['clear', 'Eligible'], amber: ['review', 'Verify'], none: ['info', 'Self-pay'] };
  const IN_CHAIR = ['seated', 'in_chart', 'ready_for_exam'];
  const ARRIVABLE = ['scheduled', 'confirmed'];
  const CHECKOUTABLE = ['in_chart', 'note_filed'];
  const ATTACHMENT_CDT = ['d2740', 'd4341', 'd7210'];
  const CACHE_TIME = '07:58'; // last successful fetch shown by the Andon slot during an outage
  const SUPPORT = 'Support: 615-555-0100, answered 7 am to 6 pm Central';

  // Per-screen UI state. Cleared whenever the store is rebuilt (window.__proto.reset).
  let lastStore = null;
  let gates = {};     // apptId -> {code, verb, control, why, node} rendered at the card's gate
  let pings = {};     // apptId -> {node} refusal or {text} stamp
  let expanded = {};  // apptId -> boolean
  let chairOpen = {}; // op -> boolean
  let keysOn = false;

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  const byTime = (a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1);
  const todays = () => S().appointments.filter((a) => a.locationId === 'loc-1');
  const clock12 = (t) => { const [hh, mm] = t.split(':').map(Number); return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm'); };
  const fmtTime = clock12;
  const minutesBetween = (a, b) => { const [ah, am] = a.split(':').map(Number); const [bh, bm] = b.split(':').map(Number); return (bh * 60 + bm) - (ah * 60 + am); };
  const provInitials = (u) => (u ? initials(u.name.replace(/^Dr\.\s+/, '')) : '—');
  const noteFiled = (a) => { const enc = Proto.store.encounter(a.encounterId); return !!(enc && enc.noteFiled) || S().filedNotes.some((f) => f.encounterId === a.encounterId); };
  const needsAttachment = (a) => S().procedures.some((p) => p.encounterId === a.encounterId && ATTACHMENT_CDT.includes(p.cdt));
  const uiState = () => { const s = S(); if (!s.boardUi) s.boardUi = { collapsed: false, labCalled: null, deviceReset: null, eligRerun: 0 }; return s.boardUi; };

  function syncStore() { const s = S(); if (s !== lastStore) { lastStore = s; gates = {}; pings = {}; expanded = {}; chairOpen = {}; } }

  /* Re-render after a mutation: Andon, temp rail, then this screen; move focus to a named control. */
  function after(r, announce, focusTestid) {
    Proto.screens.shell.refreshAndon(r);
    if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    render(r);
    if (focusTestid) { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el) el.focus(); }
    if (announce) Proto.router.announce(announce);
  }

  /* Wrap a store refusal so its DOM node is built (and logged) once and reused across re-renders. */
  function gateFor(res, onControl) {
    const g = { code: res.code, verb: res.verb, control: res.control, why: res.why };
    g.node = refusal({ code: g.code, verb: g.verb, control: g.control, why: g.why, severity: g.code === 'outage' ? 'stop' : 'required', onControl: () => { if (g.code === 'outage') Proto.router.announce(SUPPORT); if (onControl) onControl(g); } });
    return g;
  }

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
    if (!res.ok) { gates[id] = gateFor(res); render(r); return; }
    delete gates[id];
    after(r, 'Seated in chair ' + a.op + '. The chair strip now shows ' + provInitials(Proto.store.user(a.providerId)) + '.', 'board.chair.' + a.op);
  }
  function doReverify(id, r) {
    const a = Proto.store.appt(id); if (!a) return;
    const res = Proto.store.reverify(id);
    if (!res.ok) { gates[id] = gateFor(res); render(r); return; }
    after(r, 'Eligibility re-run: active, deductible met.', 'board.card.' + id + '.expand');
  }
  function goCheckout(id, r) { Proto.router.go(r.persona, 'checkout', id); }
  function doPing(id, r) {
    const a = Proto.store.appt(id); if (!a) return;
    const res = Proto.store.pingChair(id);
    if (!res.ok) pings[id] = { node: refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why || 'One ping per encounter per 15 minutes. The chair device saw the first one; a second would only add noise.' }) };
    else pings[id] = { text: 'Pinged chair ' + a.op + ' · ' + clock12(S().clock.time) + ' · one-to-one, not broadcast' };
    after(r, res.ok ? 'Pinged chair ' + a.op : res.verb, 'board.queue.row.' + id + '.checkout');
  }

  // ---- Readiness strip ---------------------------------------------------------------------
  function readinessRows(r) {
    const s = S(); const ui = uiState(); const rows = [];
    const amber = todays().filter((a) => a.eligibility === 'amber' && !['checked_out', 'checked_out_unfiled'].includes(a.status)).sort(byTime);
    if (amber.length) rows.push({ id: 'elig', time: amber[0].time, sev: 'review', word: 'Eligibility', line: amber.length + ' insured patient' + (amber.length > 1 ? 's' : '') + ' came back amber at 6 am — first at ' + fmtTime(amber[0].time), control: 'Re-verify all', testid: 'board.readiness.row.elig.reverify-all', act: () => { amber.forEach((a) => Proto.store.reverify(a.id)); ui.eligRerun += amber.length; after(r, 'Re-ran ' + amber.length + ' eligibility check' + (amber.length > 1 ? 's' : '') + ': all active.', 'board.readiness.toggle'); } });
    const lab = todays().find((a) => a.labCase && a.labCase.status === 'not_back');
    if (lab && !ui.labCalled) rows.push({ id: 'lab-op3', time: lab.time, sev: 'review', word: 'Lab', line: 'Lab case for ' + fmtTime(lab.time) + ' Op ' + lab.op + ' not back — ' + lab.labCase.vendor + ', due ' + shortDate(lab.labCase.due), control: 'Call lab', testid: 'board.readiness.row.lab-op3.call', act: () => { ui.labCalled = s.clock.time; after(r, 'Marked: Called Ridge Lab at ' + clock12(s.clock.time) + '.', 'board.readiness.toggle'); } });
    if (!ui.deviceReset) rows.push({ id: 'device', time: '09:00', sev: 'required', word: 'Device', line: 'Shared tablet Op 2 still signed in as J.R. from yesterday', control: 'Sign out', testid: 'board.readiness.row.device.reset', act: () => { ui.deviceReset = s.clock.time; after(r, 'Tablet Op 2 signed out; the next author enters a PIN.', 'board.readiness.toggle'); } });
    if (!s.dayPasses.length) rows.push({ id: 'temp', time: '99:99', sev: 'info', word: 'Tomorrow', line: 'Tomorrow: front desk has no coordinator', control: 'Add day pass', testid: 'board.readiness.row.temp.add', act: () => Proto.router.go(r.persona, 'roles') });
    rows.sort((x, y) => (x.time < y.time ? -1 : 1));
    return rows;
  }
  function handledLines() {
    const s = S(); const ui = uiState(); const out = [];
    if (ui.eligRerun) out.push(ui.eligRerun + ' eligibility check' + (ui.eligRerun > 1 ? 's' : '') + ' re-run');
    if (ui.labCalled) out.push('Called Ridge Lab · ' + clock12(ui.labCalled));
    if (ui.deviceReset) out.push('Tablet Op 2 signed out · ' + clock12(ui.deviceReset));
    if (s.dayPasses.length) out.push('Day pass added for tomorrow');
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
      for (const row of rows) body.append(h('div', { class: 'rdrow', role: 'group', 'aria-label': row.line },
        chip(row.sev, row.word), h('span', { class: 'line', text: row.line }),
        outage ? h('span', { class: 'small muted', text: 'Waits for the connection — nothing writes during the outage' }) : btn(row.control, { kind: 'reversible', testid: row.testid, onClick: row.act })));
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
      const detail = chairOpen[n] ? h('div', { class: 'stamp', text: prov ? prov.name + (prov.licence ? ', ' + prov.licence : '') + ' is the author on the Op ' + n + ' device' : 'No author on the Op ' + n + ' device; the next PIN opens a session' }) : null;
      strip.append(h('div', { class: 'chairwrap', role: 'listitem' }, b, detail));
    }
    return strip;
  }

  // ---- Appointment card --------------------------------------------------------------------
  function details(a) {
    const rows = [
      h('div', { class: 'row' }, h('span', { text: 'Forms' }), chip(a.formsDone ? 'clear' : 'review', a.formsDone ? 'Done' : 'Due at arrival')),
      h('div', { text: 'Balance ' + money(a.balanceCents || 0) + (a.balanceCents ? ' · patient portion, estimate separate' : '') }),
    ];
    if (a.eligibilityNote) rows.push(h('div', { text: a.eligibilityNote }));
    else if (a.eligibility === 'amber') rows.push(h('div', { text: '6 am 270/271 returned amber' + (a.eligibilityRerun === 'running' ? ' · re-run started on arrival' : ' · re-runs on arrival') }));
    if (a.arrivedAt) rows.push(h('div', { text: 'Arrived ' + clock12(a.arrivedAt) }));
    if (a.referral) rows.push(h('div', { text: 'Referred by ' + a.referral.from + ' — ' + a.referral.reason + (a.referral.recordsForwarded ? ' · records received' : '') }));
    if (a.labCase) rows.push(h('div', { text: 'Lab case ' + a.labCase.id + ' · ' + a.labCase.vendor + ' · ' + (a.labCase.status === 'not_back' ? 'not back' : a.labCase.status) }));
    return h('div', { class: 'details', id: 'board-details-' + a.id }, ...rows);
  }
  function card(a, r, inLane) {
    const priv = P().privacy; const outage = P().outage; const s = S();
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv);
    const [ssev, sword] = STATUS[a.status] || ['info', a.status]; const [tsev, tword] = TYPE[a.type] || ['info', a.type]; const [esev, eword] = ELIG[a.eligibility] || ELIG.none;
    const el = h('article', { class: 'card appt ' + a.type, testid: 'board.card.' + a.id, 'aria-label': fmtTime(a.time) + ' ' + name + ', ' + tword + ', ' + sword });
    el.append(h('div', { class: 'who' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), chip(ssev, sword)));
    const meta = h('div', { class: 'meta' }, chip(tsev, tword), chip(esev, eword));
    if (a.eligibility === 'amber' && !outage) meta.append(btn('Re-verify', { kind: 'reversible', class: 'compact', testid: 'board.card.' + a.id + '.reverify', ariaLabel: 'Re-verify eligibility for ' + name, onClick: () => doReverify(a.id, r) }));
    if (pt.alerts.length) meta.append(chip('required', pt.alerts.length + ' alert' + (pt.alerts.length > 1 ? 's' : '')));
    if (a.labCase && a.labCase.status === 'not_back') meta.append(chip('review', 'Case not back'));
    if (a.referral) meta.append(chip('info', 'Referred in'));
    el.append(meta);
    if (inLane) el.append(h('div', { class: 'stamp', text: 'Paid at the window · charges and claim release when ' + (Proto.store.user(a.providerId) || {}).short + ' files the note' }));
    if (outage) el.append(h('div', { class: 'stamp', text: 'As of ' + clock12(CACHE_TIME) + ' · ' + minutesBetween(CACHE_TIME, s.clock.time) + ' min old · read-only' }));
    const actions = h('div', { class: 'actions' });
    if (!outage) {
      const g = gates[a.id];
      if (ARRIVABLE.includes(a.status)) actions.append(btn(g ? 'Held' : 'Arrive', { kind: g ? 'held' : 'irreversible', testid: 'board.card.' + a.id + '.arrive', ariaLabel: (g ? 'Arrive held: ' + g.verb : 'Arrive ' + name), onClick: () => doArrive(a.id, r) }));
      else if (a.status === 'arrived') actions.append(btn(g ? 'Held' : 'Seat', { kind: g ? 'held' : 'reversible', testid: 'board.card.' + a.id + '.seat', ariaLabel: 'Seat ' + name + ' in chair ' + a.op, onClick: () => doSeat(a.id, r) }));
      else if (CHECKOUTABLE.includes(a.status)) actions.append(btn('Checkout', { kind: 'reversible', testid: 'board.card.' + a.id + '.checkout', ariaLabel: 'Checkout ' + name, onClick: () => goCheckout(a.id, r) }));
    }
    const ex = btn(expanded[a.id] ? 'Less' : 'Details', { kind: 'quiet', class: 'compact', testid: 'board.card.' + a.id + '.expand', ariaLabel: (expanded[a.id] ? 'Hide' : 'Show') + ' forms and balance for ' + name, onClick: () => { expanded[a.id] = !expanded[a.id]; render(r); const b = document.querySelector('[data-testid="board.card.' + a.id + '.expand"]'); if (b) b.focus(); } });
    ex.setAttribute('aria-expanded', String(!!expanded[a.id])); ex.setAttribute('aria-controls', 'board-details-' + a.id);
    actions.append(ex);
    if (Proto.screens.rail) actions.append(Proto.screens.rail.button(a.patientId, r, 'board.card.' + a.id + '.rail'));
    el.append(actions);
    if (!outage && gates[a.id]) el.append(h('div', { class: 'gate' }, gates[a.id].node));
    if (expanded[a.id]) el.append(details(a));
    return el;
  }

  // ---- Operatory columns and the Filed-later lane ------------------------------------------
  function renderColumns(r) {
    const loc = S().locations[0]; const board = h('div', { class: 'board' });
    for (let n = 1; n <= loc.operatories; n++) {
      const list = todays().filter((a) => a.op === n && a.status !== 'checked_out_unfiled').sort(byTime);
      board.append(h('div', { class: 'opcol', role: 'region', 'aria-label': 'Operatory ' + n },
        h('div', { class: 'ophead' }, h('h2', { text: 'Op ' + n }), h('span', { class: 'small muted', text: list.length + ' today' })),
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
    const priv = P().privacy; const outage = P().outage;
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv); const prov = Proto.store.user(a.providerId) || { short: '—', name: '—' };
    const filed = noteFiled(a); const [ssev, sword] = STATUS[a.status] || ['info', a.status];
    const noteChip = filed ? chip('clear', 'Filed') : chip('review', 'Open · ' + provInitials(prov));
    const claimChip = !filed ? chip('info', 'Held') : needsAttachment(a) ? chip('review', 'Needs: attachment') : chip('clear', 'Ready');
    const row = h('div', { class: 'qrow', testid: 'board.queue.row.' + a.id, role: 'group', 'aria-label': 'Checkout queue: ' + name + ', note ' + (filed ? 'filed' : 'open') });
    row.append(h('div', { class: 'head' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), chip(ssev, sword)));
    row.append(h('div', { class: 'row' }, h('span', { class: 'small muted', text: 'Note' }), noteChip, h('span', { class: 'small muted', text: 'Claim' }), claimChip));
    if (!filed) {
      row.append(h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Note not filed — ' + prov.short }), outage ? null : btn('Ping chair', { kind: 'reversible', class: 'compact', testid: 'board.queue.row.' + a.id + '.ping', ariaLabel: 'Ping chair ' + a.op + ' about the open note', onClick: () => doPing(a.id, r) })));
      const p = pings[a.id]; if (p) row.append(p.node || h('div', { class: 'stamp', text: p.text }));
    }
    if (a.status === 'checked_out_unfiled') row.append(h('div', { class: 'row' }, btn('Checkout', { kind: 'reversible', testid: 'board.queue.row.' + a.id + '.checkout', ariaLabel: 'Open checkout for ' + name + ' (already paid; charges post when the note files)', onClick: () => goCheckout(a.id, r) }), h('span', { class: 'small muted', text: 'Paid at the window · in the Filed-later lane until ' + prov.short + ' files' })));
    else if (!outage) row.append(h('div', { class: 'row' }, btn('Checkout', { kind: 'reversible', testid: 'board.queue.row.' + a.id + '.checkout', ariaLabel: 'Checkout ' + name, onClick: () => goCheckout(a.id, r) }), filed ? null : h('span', { class: 'small muted', text: 'Checkout works now; charges post when the note files.' })));
    return row;
  }
  function renderQueue(r) {
    const rows = todays().filter((a) => CHECKOUTABLE.includes(a.status) || a.status === 'checked_out_unfiled').sort(byTime);
    return h('section', { class: 'card flat stack queue', 'aria-label': 'Checkout queue' },
      h('div', { class: 'row' }, h('h2', { text: 'Checkout queue' }), chip('info', rows.length + ' in chair-out order')),
      rows.length ? h('div', { class: 'worklist' }, ...rows.map((a) => queueRow(a, r))) : h('p', { class: 'small muted', text: 'Nobody is out of the chair yet.' }),
      h('details', null, h('summary', { class: 'small', testid: 'board.queue.why' }, 'How the chips are derived'), h('p', { class: 'small muted', text: 'Note reads the filed-note row on the encounter; Claim reads the claim state. No front-desk control can flip either. The ping is an in-app event to that chair only, one per encounter per 15 minutes.' })));
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
    if (P().outage) { Proto.router.announce('Board is read-only during the outage; nothing writes.'); return; }
    const list = todays().sort(byTime);
    if (k === 'a') { const a = list.find((x) => ARRIVABLE.includes(x.status)); if (a) doArrive(a.id, r); else Proto.router.announce('No one left to arrive'); }
    if (k === 's') { const a = list.find((x) => x.status === 'arrived'); if (a) doSeat(a.id, r); else Proto.router.announce('No one is waiting to be seated'); }
    if (k === 'c') { const a = list.find((x) => x.status === 'note_filed'); if (a) goCheckout(a.id, r); else Proto.router.announce('Nothing to check out yet'); }
  }

  // ---- Screen ------------------------------------------------------------------------------
  function render(r) {
    syncStore();
    const s = S(); const loc = s.locations[0]; const outage = P().outage;
    const sub = clock12(s.clock.time) + ' · ' + loc.operatories + ' operatories · ' + todays().length + ' appointments' + (outage ? ' · read-only from the ' + clock12(CACHE_TIME) + ' cache' : '') + ' · keys: A arrive, S seat, C checkout';
    const lane = renderLane(r);
    const page = h('div', { class: 'stack boardpage' },
      pageHead('Board · ' + loc.name + ' · Thursday 9/3', sub),
      renderReadiness(r),
      renderChairs(r),
      h('div', { class: 'board-layout' }, h('div', { class: 'stack' }, renderColumns(r), lane), renderQueue(r)),
      h('p', { class: 'small muted practice-line', text: 'Median ready → filed today: 22 min (practice)' }));
    Proto.screens.shell.mount(page);
    if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; }
  }

  window.addEventListener('hashchange', () => { if (keysOn && Proto.router.current().route !== 'board') { document.removeEventListener('keydown', onKey); keysOn = false; } });

  Proto.screens.board = { render, arrive: doArrive, seat: doSeat, reverify: doReverify, ping: doPing };
  Proto.router.on('board', (r) => Proto.screens.board.render(r));
})();
