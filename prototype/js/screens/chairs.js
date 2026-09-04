/* Chairs (mine): hygienist home. One card per appointment in time order with the since-last-visit
   delta strip (what changed, what is due, what helped), alerts as stop chips, the recall chip,
   Perio / Note / Ready-for-exam, an expander for coverage and forms, and the practice-level
   perio completion line. P / N / R accelerators are active only while this route is mounted. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, displayName, pageHead } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TODAY = (Proto.seed && Proto.seed.TODAY) || '2026-09-03';
  const STATUS = {
    scheduled: ['info', 'Scheduled'], confirmed: ['info', 'Confirmed'], arrived: ['review', 'Arrived'],
    seated: ['info', 'Seated'], in_chart: ['info', 'In chart'], ready_for_exam: ['review', 'Exam requested'],
    note_filed: ['clear', 'Note filed'], checked_out: ['clear', 'Done'], checked_out_unfiled: ['review', 'Filed later'],
  };
  const TYPE = { hygiene: ['clear', 'Hygiene'], restorative: ['style', 'Restorative'], exam: ['info', 'Exam'], surgery: ['stop', 'Surgery'], emergency: ['required', 'Emergency'] };
  const ELIG = { green: ['clear', 'Eligible'], amber: ['review', 'Verify'], none: ['info', 'Self-pay'] };
  const READY_FROM = ['seated', 'in_chart'];
  const DONE = ['note_filed', 'checked_out', 'checked_out_unfiled', 'ready_for_exam'];
  const MED_HX = /anticoagulant|premed|apixaban|warfarin|antibiotic/i;
  const SUPPORT = 'Support: 615-555-0100, answered 7 am to 6 pm Central';
  const PRACTICE_LINE = 'Perio completion this week: 71% (practice)';

  // Per-screen UI state; cleared whenever the store is rebuilt (window.__proto.reset).
  let lastStore = null;
  let gates = {};    // apptId -> {code, verb, control, why, node}
  let expanded = {}; // apptId -> boolean
  let keysOn = false;

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  const byTime = (a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1);
  const fmtTime = (t) => { const [hh, mm] = t.split(':'); return Number(hh) + ':' + mm; };
  const clock12 = (t) => { const [hh, mm] = t.split(':').map(Number); return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm'); };
  const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  const isHygienist = (u) => u.role === 'hygienist' || u.role === 'rdh';

  function syncStore() { const s = S(); if (s !== lastStore) { lastStore = s; gates = {}; expanded = {}; } }

  /* Whole months between an ISO date and today (2026-09-03); 2025-07-01 -> 14. */
  function monthsAgo(iso) {
    const [y1, m1, d1] = iso.split('-').map(Number); const [y2, m2, d2] = TODAY.split('-').map(Number);
    let n = (y2 - y1) * 12 + (m2 - m1); if (d2 < d1) n -= 1; return Math.max(0, n);
  }

  // ---- Derivations (rows only, never guesses) ---------------------------------------------
  function mine() {
    const u = Proto.store.currentUser(); const hyg = isHygienist(u);
    return S().appointments.filter((a) => a.locationId === 'loc-1' && (a.providerId === u.id || (!hyg && a.type === 'hygiene'))).sort(byTime);
  }
  const perioToday = (a) => S().perioExams.find((e) => e.encounterId === a.encounterId && e.date === TODAY);
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
    if (today) out.push({ sev: 'clear', word: 'Perio charted today', text: today.probed + ' sites probed, deepest ' + today.deepest + ' mm' });
    for (const alert of pt.alerts || []) if (MED_HX.test(alert)) out.push({ sev: 'stop', word: 'Med hx changed', text: alert });
    const lp = lastPerio(a);
    if (lp) { const m = monthsAgo(lp); out.push({ sev: m >= 12 ? 'review' : 'info', word: 'Perio', text: m + ' mo ago' }); }
    if (a.bwxDue) out.push({ sev: 'review', word: 'BWX due', text: 'practice rule: 12 mo' });
    if (a.helpedLastTime) out.push({ sev: 'clear', word: 'What helped last time', text: a.helpedLastTime });
    return out;
  }
  function recallDue(a) { const lp = lastPerio(a); return a.type === 'hygiene' && ((lp && monthsAgo(lp) >= 6) || !!a.bwxDue); }

  // ---- Re-render after a mutation ----------------------------------------------------------
  function after(r, announce, focusTestid) {
    Proto.screens.shell.refreshAndon(r);
    if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    render(r);
    if (focusTestid) { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el) el.focus(); }
    if (announce) Proto.router.announce(announce);
  }
  function gateFor(res) {
    const g = { code: res.code, verb: res.verb, control: res.control, why: res.why };
    g.node = refusal({ code: g.code, verb: g.verb, control: g.control, why: g.why, severity: g.code === 'outage' ? 'stop' : 'required', onControl: () => { if (g.code === 'outage') Proto.router.announce(SUPPORT); } });
    return g;
  }

  // ---- Actions -----------------------------------------------------------------------------
  function goPerio(id, r) { const a = Proto.store.appt(id); if (a) Proto.router.go(r.persona, 'perio', a.encounterId); }
  function goNote(id, r) { const a = Proto.store.appt(id); if (a) Proto.router.go(r.persona, 'encounter', a.encounterId); }
  function doReady(id, r) {
    const a = Proto.store.appt(id); if (!a || !canReady(a)) return;
    const focusId = 'chairs.card.' + id + '.ready';
    if (P().outage) {
      gates[id] = gateFor({ code: 'outage', verb: 'Server unreachable — nothing writes', control: 'Support line', why: 'The exam request is an appointment event. During the outage the chair reads from the last fetch and accepts no writes; the request goes when the connection returns.' });
      render(r); const b = document.querySelector('[data-testid="' + focusId + '"]'); if (b) b.focus(); return;
    }
    const res = Proto.store.readyForExam(id);
    if (!res.ok) { gates[id] = gateFor(res); render(r); const b = document.querySelector('[data-testid="' + focusId + '"]'); if (b) b.focus(); return; }
    delete gates[id];
    Proto.store.retireChip('ready');
    const name = displayName(Proto.store.patient(a.patientId).name, P().privacy);
    after(r, name + ' ready for exam: ' + ordinal(queuePosition(a)) + ' in queue. The Board chair strip shows Exam requested.', 'chairs.card.' + id + '.note');
  }
  function toggleExpand(id, r) { expanded[id] = !expanded[id]; render(r); const el = document.querySelector('[data-testid="chairs.card.' + id + '.expand"]'); if (el) el.focus(); }

  // ---- Card --------------------------------------------------------------------------------
  function card(a, r) {
    const priv = P().privacy; const s = S();
    const pt = Proto.store.patient(a.patientId); const name = displayName(pt.name, priv);
    const prov = Proto.store.user(a.providerId) || { short: '—' };
    const [ssev, sword] = STATUS[a.status] || ['info', a.status];
    const [tsev, tword] = TYPE[a.type] || ['info', a.type];
    const pos = queuePosition(a);
    const el = h('article', { class: 'card appt ' + (a.type || ''), testid: 'chairs.card.' + a.id, 'aria-label': fmtTime(a.time) + ' ' + name + ', chair ' + a.op });

    el.append(h('div', { class: 'who' }, h('span', { text: fmtTime(a.time) + ' · ' + name }), chip(ssev, sword)));
    const meta = h('div', { class: 'meta' }, h('span', { text: 'Chair ' + a.op }), chip(tsev, tword));
    if (recallDue(a)) meta.append(chip('review', 'Recall due'));
    if (pos) meta.append(chip('review', 'Exam: ' + ordinal(pos) + ' in queue'));
    el.append(meta);

    if (pt.alerts && pt.alerts.length) el.append(h('div', { class: 'row ch-alerts', role: 'group', 'aria-label': 'Alerts' }, ...pt.alerts.map((t) => chip('stop', t))));

    // Since-last-visit strip: 0 taps to read, 1 tap to expand into coverage and forms.
    const detailsId = 'chairs-details-' + a.id;
    const ds = deltas(a, pt);
    const strip = btn(null, { kind: 'quiet', class: 'ch-strip', testid: 'chairs.card.' + a.id + '.expand', onClick: () => toggleExpand(a.id, r) });
    strip.setAttribute('aria-expanded', String(!!expanded[a.id])); strip.setAttribute('aria-controls', detailsId);
    strip.append(h('span', { class: 'small muted', text: 'Since last visit' }));
    if (ds.length) for (const d of ds) strip.append(h('span', { class: 'd' }, chip(d.sev, d.word), d.text ? h('span', { class: 'small', text: d.text }) : null));
    else strip.append(h('span', { class: 'small', text: 'No changes since last visit' }));
    strip.append(h('span', { class: 'small muted ch-more', text: expanded[a.id] ? 'Less' : 'More' }));
    el.append(strip);

    const det = h('div', { class: 'ch-details', id: detailsId });
    if (!expanded[a.id]) det.hidden = true;
    const [esev, eword] = ELIG[a.eligibility] || ['info', 'Unknown'];
    det.append(h('div', { class: 'row' }, h('span', { text: 'Coverage: ' + (pt.selfPay || !pt.primary ? 'Self-pay' : Proto.store.carrierName(pt.primary) + (pt.secondary ? ' · secondary ' + Proto.store.carrierName(pt.secondary) : '')) }), chip(esev, eword)));
    det.append(h('div', { class: 'row' }, h('span', { text: 'Forms: ' + (a.formsDone ? 'complete' : 'outstanding') }), a.formsDone ? chip('clear', 'Complete') : chip('review', 'Outstanding')));
    det.append(h('span', { text: 'Balance before today: ' + money(a.balanceCents || 0) + ' · Provider ' + prov.short }));
    det.append(h('details', null, h('summary', { class: 'small', testid: 'chairs.card.' + a.id + '.why' }, 'How this strip is derived'), h('p', { class: 'small muted', text: 'Deltas come from stored rows only: the medical-history alert on the patient, the last perio exam date, the bitewing interval (the practice\'s rule), and the last filed what-helped field. Nothing here is an AI guess. Card order is seat order; no per-person metric appears.' })));
    el.append(det);

    const actions = h('div', { class: 'actions ch-actions' });
    actions.append(btn('Perio', { kind: 'reversible', testid: 'chairs.card.' + a.id + '.perio', ariaLabel: 'Perio for ' + name + ', opens the grid at UR site 1', onClick: () => goPerio(a.id, r) }));
    actions.append(btn('Note', { kind: 'reversible', testid: 'chairs.card.' + a.id + '.note', ariaLabel: 'Note for ' + name, onClick: () => goNote(a.id, r) }));
    if (Proto.screens.rail) actions.append(Proto.screens.rail.button(a.patientId, r, 'chairs.card.' + a.id + '.rail'));
    if (canReady(a)) {
      if (gates[a.id]) actions.append(btn('Held', { kind: 'held', testid: 'chairs.card.' + a.id + '.ready', ariaLabel: 'Ready for exam is held: ' + gates[a.id].verb, onClick: () => { const c = el.querySelector('[data-testid="refusal.control"]'); if (c) c.focus(); } }));
      else actions.append(btn('Ready for exam', { kind: 'irreversible', testid: 'chairs.card.' + a.id + '.ready', ariaLabel: 'Ready for exam: ' + name + ' joins the dentist\'s queue', onClick: () => doReady(a.id, r) }));
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
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('#dialogs .overlay')) return;
    const k = (ev.key || '').toLowerCase(); if (!['p', 'n', 'r'].includes(k)) return;
    ev.preventDefault();
    const list = mine(); const open = list.filter((a) => !DONE.includes(a.status));
    if (k === 'p') { const a = open[0] || list[0]; if (a) goPerio(a.id, r); else Proto.router.announce('No chairs assigned to you today'); }
    if (k === 'n') { const a = open[0] || list[0]; if (a) goNote(a.id, r); else Proto.router.announce('No chairs assigned to you today'); }
    if (k === 'r') { const a = list.find(canReady); if (a) doReady(a.id, r); else Proto.router.announce('Nobody is seated with exam content yet'); }
  }

  // ---- Screen ------------------------------------------------------------------------------
  function render(r) {
    syncStore();
    const s = S(); const u = Proto.store.currentUser(); const list = mine(); const hyg = isHygienist(u);
    const sub = clock12(s.clock.time) + ' · ' + list.length + ' chair' + (list.length === 1 ? '' : 's') + (hyg ? ' · yours' : ' · all hygiene chairs at ' + s.locations[0].name) + (P().outage ? ' · read-only during the outage' : '') + ' · keys: P perio, N note, R ready';
    const page = h('div', { class: 'stack chairspage' }, pageHead('Chairs · mine', sub));
    if (list.length) page.append(h('div', { class: 'ch-list', role: 'list', 'aria-label': 'Your chairs in seat order' }, ...list.map((a) => { const c = card(a, r); c.setAttribute('role', 'listitem'); return c; })));
    else page.append(h('section', { class: 'card stack', 'aria-label': 'No chairs' }, h('h2', { text: 'No chairs assigned to you today' }), h('p', { class: 'muted', text: 'The Board shows every chair at ' + s.locations[0].name + '.' }), h('div', { class: 'btnrow' }, btn('Open the Board', { kind: 'reversible', testid: 'chairs.empty.board', onClick: () => Proto.router.go(r.persona, 'board') }))));
    page.append(h('p', { class: 'small muted practice-line', text: PRACTICE_LINE }));
    Proto.screens.shell.mount(page);
    if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; }
  }

  window.addEventListener('hashchange', () => { if (keysOn && Proto.router.current().route !== 'chairs') { document.removeEventListener('keydown', onKey); keysOn = false; } });

  Proto.screens.chairs = { render, ready: doReady, perio: goPerio, note: goNote, monthsAgo };
  Proto.router.on('chairs', (r) => Proto.screens.chairs.render(r));
})();
