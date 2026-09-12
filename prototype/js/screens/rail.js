/* Patient Rail (persistent #rail panel, not a route) and the Ledger screen (route ledger/<patientId>).
   docs/04 IA (2): the rail appears on patient selection and stays across every surface; header with the
   un-collapsible critical-alert channel; nine one-tap targets; expandable summaries; privacy shows initials.
   docs/13 feature 23: one ledger view — three numbers, Explain in three voices, As-of by posted date,
   statements that hold for a reason. API: Proto.screens.rail = { open, close, isOpen, render, button }. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, shortDate, longDate, section, pageHead, displayName } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TABS = [['chart', 'Chart'], ['notes', 'Notes'], ['perio', 'Perio'], ['imaging', 'Imaging'], ['plan', 'Plan'], ['ledger', 'Ledger'], ['claims', 'Claims'], ['docs', 'Docs'], ['profile', 'Profile']];
  const KIND_WORD = { charge: 'Charge', patient_payment: 'Payment', insurance_payment: 'Insurance payment', write_off: 'Write-off', adjustment: 'Adjustment', refund: 'Refund', reversal: 'Reversal' };
  const ELIG = Proto.ui.ELIG;                           // one eligibility word per value, shared with the Board and Chairs
  /* Words for what the record holds: a status code, a general-ledger bucket or a reason code is a product-internal
     noun a first-day temp would have to decode, so the screen prints the words and leaves the codes in the record. */
  const CLAIM_WORD = { scrubbed: 'queued', submitted: 'submitted', pended: 'in review', denied: 'denied', appealed: 'appealed' };
  // The same word the Board and the Chairs card print for the same status: never a humanized status code.
  const STATUS_WORD = { scheduled: 'Scheduled', confirmed: 'Confirmed', arrived: 'Arrived', seated: 'Seated', in_chart: 'In chart', ready_for_exam: 'Exam requested', note_filed: 'Note filed', checked_out: 'Done', checked_out_unfiled: 'Filed later' };
  const GL_WORD = { ins_ar_primary: 'primary insurance', ins_ar_secondary: 'secondary insurance', patient_ar: 'patient balance', unapplied_credit: 'unapplied credit' };
  const REASON_WORD = { contractual_ppo: 'PPO fee schedule', posted_to_wrong_account: 'posted to wrong account', window_deferred: 'deferred at the window', balance_due: 'raised on the balance', courtesy: 'courtesy' };

  const rail = { pid: null, r: null, open: { balance: true }, explain: false, msg: null };
  const led = {}; // per user id and patient id: ledger view state (explain, patientVoice, asof, asofOpen, sent, gate, hi)

  const P = () => window.__proto || {};
  const S = () => Proto.store.get();
  const today = () => S().tenant.today;
  const route = () => rail.r || Proto.router.current();
  const announce = (text) => { Proto.router.announce(text); return text; };
  const cdtName = (code) => (S().cdt[code] || [String(code || '').toUpperCase()])[0];
  const numId = (id) => Number(String(id).replace(/\D/g, '')) || 0;
  const encsFor = (pid) => S().encounters.filter((e) => e.patientId === pid);
  const encsToday = (pid) => encsFor(pid).filter((e) => e.dos === today());
  const apptsToday = (pid) => S().appointments.filter((a) => a.patientId === pid).sort((a, b) => a.time.localeCompare(b.time));
  const rowsFor = (pid) => S().ledger.filter((e) => e.patientId === pid).sort((a, b) => b.posted.localeCompare(a.posted) || numId(b.id) - numId(a.id));
  /* Open means the payer has not answered yet, which starts the moment filing queues the claim (store writes it
     'scrubbed'): leaving that status out made the rail say "none open" for the claim the filing had just created. */
  const openClaims = (pid) => S().claims.filter((c) => c.patientId === pid && Object.keys(CLAIM_WORD).includes(c.status));
  /* View state is per user, never global: the As-of date one biller chose was what the next persona landed on. */
  let ledStore = null;
  const ledState = (pid) => {
    const now = S(); if (ledStore && ledStore !== now) for (const k of Object.keys(led)) delete led[k];   // store reset: every view is stale
    ledStore = now;
    const k = Proto.store.currentUser().id + '|' + pid; return (led[k] = led[k] || { explain: false, patientVoice: false, asof: null, asofOpen: false, sent: null, gate: null, hi: null, pin: '' });
  };
  const shared = () => P().device === 'shared';
  const humanize = (s) => String(s || '').replace(/_/g, ' ');
  const pressed = (b) => (b ? 'true' : 'false'); // h() writes boolean true as an empty attribute; aria-pressed needs the word

  /* Identifiers: privacy mode shows initials and hides the day and month of birth. */
  function identLine(p, priv) { return (priv ? 'Born ' + p.dob.slice(0, 4) : 'DOB ' + longDate(p.dob)) + ' · phone …' + p.phone.slice(-4); }
  /* Every amount in a sentence is emphasized so the eye can link it to its rows. */
  function boldAmounts(text) { return text.split(/(−?\$[\d,]+(?:\.\d{2})?)/).map((part, i) => (i % 2 ? h('b', { text: part }) : part)); }
  function threeNum(b, labels) {
    const L = labels || ['Patient due', 'Waiting on insurance', 'Credit'];
    return h('div', { class: 'threenum' }, [[L[0], b.patientDue], [L[1], b.insurancePending], [L[2], b.credit]].map(([l, v]) => h('div', { class: 'n' }, h('div', { class: 'v', text: money(v) }), h('div', { class: 'l', text: l }))));
  }
  function eligibilityChip(pid) { const a = apptsToday(pid).find((x) => !['checked_out', 'checked_out_unfiled'].includes(x.status)) || apptsToday(pid)[0]; const e = a ? ELIG[a.eligibility] || ELIG.none : ['info', 'Not checked today']; return chip(e[0], e[1]); }

  /* ---------------- Patient Rail ---------------- */
  /* The opener lives on another screen's card, so pressing it redraws only #rail; its own pressed state is put
     back here rather than waiting for that screen's next render. */
  function syncOpeners() {
    for (const el of document.querySelectorAll('[data-railopen]')) {
      const on = el.getAttribute('data-railopen') === rail.pid;
      el.setAttribute('aria-pressed', pressed(on));
      const mark = el.querySelector('.pressmark');
      if (on && !mark) el.prepend(h('span', { class: 'pressmark', 'aria-hidden': 'true', text: '✓' }));
      if (!on && mark) mark.remove();
    }
  }
  /* opts.keepFocus: the Ledger route opens the rail as part of its own render, and the keyboard belongs to the
     canvas heading there. Every other opener is a person's press, so the rail takes the focus it just earned. */
  function open(pid, r, opts) {
    if (!Proto.store.patient(pid)) { announce(Proto.store.notFound('patient').verb); return; }
    if (rail.pid !== pid) { rail.explain = false; rail.msg = null; }
    rail.pid = pid; if (r) rail.r = r;
    const box = document.getElementById('rail'); if (box) box.hidden = false;
    renderRail();
    syncOpeners();
    if (!(opts && opts.keepFocus)) { const c = document.querySelector('[data-testid="rail.close"]'); if (c) c.focus(); }
  }
  function close() { rail.pid = null; rail.msg = null; const box = document.getElementById('rail'); if (box) { box.replaceChildren(); box.hidden = true; } syncOpeners(); }
  function isOpen() { return !!rail.pid; }
  function button(pid, r, testid) {
    const p = Proto.store.patient(pid);
    return btn('Rail', { kind: 'quiet', class: 'compact', testid: testid || 'rail.open.' + pid, pressed: pressed(rail.pid === pid), dataset: { railopen: pid }, ariaLabel: 'Open the patient rail' + (p ? ' for ' + displayName(p.name, P().privacy) : ''), onClick: (ev) => { ev.stopPropagation(); open(pid, r || Proto.router.current()); } });
  }

  function summaryFor(code, pid) {
    const p = Proto.store.patient(pid); const st = S();
    if (code === 'imaging') { const a = apptsToday(pid).find((x) => x.bwxDue); return a ? 'Imaging: bitewings due today; last set on file opens in the encounter' : 'Imaging: nothing due; images open from the encounter'; }
    if (code === 'claims') { const cs = openClaims(pid); return cs.length ? 'Claims: ' + cs.length + ' open — ' + cs.map((c) => c.id + ' ' + (CLAIM_WORD[c.status] || humanize(c.status)) + ' (' + c.payer + ')').join(', ') : 'Claims: none open; a claim opens when a note is filed'; }
    if (code === 'docs') { const ids = encsFor(pid).map((e) => e.id); const notes = st.filedNotes.filter((n) => ids.includes(n.encounterId)).length; const disc = st.disclosures.filter((d) => d.patientId === pid).length; return 'Docs: ' + notes + ' filed note' + (notes === 1 ? '' : 's') + ', ' + disc + ' disclosure' + (disc === 1 ? '' : 's') + ', intake and consent forms on file'; }
    return 'Profile: ' + displayName(p.name, P().privacy) + ', ' + identLine(p, P().privacy) + ', ' + p.mrn + ', ' + (p.primary ? Proto.store.carrierName(p.primary) : 'self-pay');
  }
  /* The tab renders its summary and keeps the keyboard on the tab it redrew; the announcement is one verb line,
     not the summary read twice (the summary is on screen, in the rail, where the press put it). */
  function tabGo(code) {
    const r = route(); const pid = rail.pid; const persona = r.persona || P().persona || 'frontdesk'; const encs = encsToday(pid);
    const done = (msg, verb) => { rail.msg = msg; announce(verb); renderRail(); const t = document.querySelector('[data-testid="rail.tab.' + code + '"]'); if (t) t.focus(); };
    if (code === 'ledger') return Proto.router.go(persona, 'ledger', pid);
    if (code === 'perio') { const e = encs.find((x) => x.status === 'open'); if (e) return Proto.router.go(persona, 'perio', e.id); return done('Perio opens from the chair, once the patient is seated.', 'Seat the patient to open perio'); }
    if (code === 'chart' || code === 'notes' || code === 'plan') { if (encs[0]) return Proto.router.go(persona, 'encounter', encs[0].id); return done('No encounter today; the chart opens from the Board.', 'Open a chart from the Board'); }
    const label = (TABS.find(([c]) => c === code) || [code, code])[1];
    done(summaryFor(code, pid), 'Read the ' + label.toLowerCase() + ' summary in the rail');
  }

  function summary(key, title, ...body) {
    const d = h('details', { class: 'rail-sum', open: !!rail.open[key] }, h('summary', { testid: 'rail.sum.' + key }, title), h('div', { class: 'body' }, ...body));
    d.addEventListener('toggle', () => { rail.open[key] = d.open; });
    return d;
  }
  function apptSummary(pid) {
    const as = apptsToday(pid); const st = S();
    const next = as.find((a) => !['checked_out', 'checked_out_unfiled', 'note_filed'].includes(a.status));
    const prov = (a) => (Proto.store.user(a.providerId) || {}).short || '—';
    const word = (a) => STATUS_WORD[a.status] || humanize(a.status);
    const nextLine = next ? 'Next: today ' + Proto.ui.time(next.time) + ' ' + next.type + ' with ' + prov(next) + ', chair ' + next.op + ' (' + word(next) + ')' : as.length ? 'Next: nothing further today (' + word(as[as.length - 1]) + ')' : 'Next: nothing booked';
    const lastCharge = st.ledger.filter((e) => e.patientId === pid && e.kind === 'charge' && e.effective < today()).sort((a, b) => b.effective.localeCompare(a.effective))[0];
    const lastLine = lastCharge ? 'Last: ' + longDate(lastCharge.effective) + (lastCharge.cdt ? ' ' + cdtName(lastCharge.cdt) + (lastCharge.tooth ? ' #' + lastCharge.tooth : '') : '') : 'Last: no prior visit on record';
    return [h('div', { text: nextLine }), h('div', { class: 'muted', text: lastLine })];
  }
  function recallLine(pid) {
    const a = apptsToday(pid).find((x) => x.perioLast); const pe = S().perioExams.filter((x) => x.patientId === pid).sort((x, y) => y.date.localeCompare(x.date))[0];
    if (pe && pe.date === today()) return 'Perio charted today; next full chart in 12 months';
    // One months-since helper serves the Chairs delta strip and this line; the local days ÷ 30.44 rounding read a
    // month older than the Chairs card for any last chart in the first days of a month.
    if (a && a.perioLast) { const monthsAgo = (Proto.screens.chairs || {}).monthsAgo; const m = monthsAgo ? monthsAgo(a.perioLast) : null; return 'Perio due: last full chart ' + longDate(a.perioLast) + (m == null ? '' : ' (' + m + (m === 1 ? ' month ago)' : ' months ago)')); }
    return apptsToday(pid).some((x) => x.type === 'hygiene') ? 'Prophy recall: 6 months after today\'s hygiene visit' : 'Recall: 6 months from the last hygiene visit';
  }
  function plansBody(pid) {
    const ids = encsFor(pid).map((e) => e.id); const items = S().planItems.filter((pl) => ids.includes(pl.encounterId));
    if (!items.length) return [h('div', { class: 'muted', text: 'No open plans; charting a procedure adds one.' })];
    return items.map((pl) => h('div', { class: 'rail-plan' }, h('div', { text: cdtName(pl.cdt) + (pl.tooth ? ' #' + pl.tooth : '') + (pl.temporality === 'planned' ? ' (planned)' : '') }), h('div', { class: 'small muted' }, 'Fee ', h('b', { text: money((S().cdt[pl.cdt] || [0, 0])[1]) }), ' · plan pays about ', h('b', { text: money((S().cdt[pl.cdt] || [0, 0])[1] - pl.estimateCents) }), ' · you\'d owe about ', h('b', { text: money(pl.estimateCents) }), ' (estimate)')));
  }
  function lastNoteLine(pid) {
    const encs = encsFor(pid); const ids = encs.map((e) => e.id); const notes = S().filedNotes.filter((n) => ids.includes(n.encounterId));
    // One date shape for the rail: the stored 'YYYY-MM-DD HH:MM' reads as a date and a clock time, like every other date here.
    if (notes.length) { const n = notes[notes.length - 1]; return h('div', null, h('div', { text: (n.markdown || '').split('\n')[0] || 'Filed note' }), h('div', { class: 'small muted', text: 'Filed by ' + n.author + ' · ' + Proto.ui.dateTime([n.filedOn, n.filedTime].filter(Boolean).join(' ')) })); }
    const filed = encs.find((e) => e.noteFiled);
    return h('div', { class: 'muted', text: filed ? 'Note filed today by ' + ((Proto.store.user(filed.providerId) || {}).short || 'the provider') + '; opens from the encounter' : 'No filed note on record; the note files from the encounter.' });
  }

  function renderRail() {
    const box = document.getElementById('rail'); if (!box) return;
    const p = Proto.store.patient(rail.pid); if (!p) { close(); return; }
    const priv = !!P().privacy; const r = route(); const b = Proto.store.balances(rail.pid);
    box.hidden = false;
    // Below 1024 px the shell stacks (base.css:29-31) and an unbounded rail left the work canvas 32 px high with
    // no control reachable; the rail keeps at most two fifths of the viewport and scrolls inside itself.
    box.style.maxHeight = (window.matchMedia && window.matchMedia('(max-width: 1023px)').matches) ? '40vh' : '';
    // The whole rail is replaced on every render, so whatever the keyboard was on inside it is put back afterwards.
    const active = document.activeElement;
    const keepFocus = active && box.contains(active) ? active.getAttribute('data-testid') : null;
    const alertText = p.alerts.length ? 'Critical alerts: ' + p.alerts.join('; ') : 'No critical alerts';
    const alertbar = h('div', { class: 'alertbar' + (p.alerts.length ? '' : ' rail-clear'), testid: 'rail.alert', role: 'button', tabindex: '0', 'aria-label': alertText + '. Read aloud', onClick: () => announce(alertText), onKeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); announce(alertText); } } },
      h('span', { class: 'glyph', 'aria-hidden': 'true', text: p.alerts.length ? '■' : '●' }),
      p.alerts.length ? h('ul', { class: 'rail-alerts' }, p.alerts.map((a) => h('li', { text: a }))) : h('span', { text: 'No critical alerts' }));
    const tabs = h('div', { class: 'railtabs', role: 'navigation', 'aria-label': 'Patient sections' }, TABS.map(([code, label]) => { const cur = code === 'ledger' && r.route === 'ledger' && r.id === rail.pid; return btn(label, { kind: 'quiet', class: 'rail-tab', testid: 'rail.tab.' + code, onClick: () => tabGo(code) , ariaLabel: label + (cur ? ', current' : '') }); }));
    tabs.querySelectorAll('.btn').forEach((el) => { if (el.getAttribute('data-testid') === 'rail.tab.ledger' && r.route === 'ledger' && r.id === rail.pid) el.setAttribute('aria-current', 'page'); });
    // An Explain with no rows says why it is empty, in the same words as the Ledger's own Explain.
    const explainRows = rail.explain ? Proto.store.explain(rail.pid) : [];
    const explainBody = rail.explain ? h('div', { class: 'explain' }, explainRows.length ? explainRows.map((x) => h('p', { class: 'sentence' }, boldAmounts(x.sentence))) : h('p', { class: 'sentence muted', text: explainEmpty(false) })) : null;
    box.replaceChildren(...[
      h('div', { class: 'rail-head' }, h('div', null, h('div', { class: 'name', text: displayName(p.name, priv) }), h('div', { class: 'rail-ids', text: identLine(p, priv) })), btn('Close', { kind: 'quiet', class: 'compact', testid: 'rail.close', ariaLabel: 'Close the patient rail', onClick: () => { close(); const c = document.getElementById('canvas'); if (c) c.focus(); } })),
      alertbar, tabs,
      rail.msg ? h('p', { class: 'rail-msg', text: rail.msg }) : null,   // the verb line is announced once, from tabGo
      summary('appts', 'Appointments', ...apptSummary(rail.pid)),
      summary('coverage', 'Coverage', h('div', { class: 'row' }, h('span', { text: p.primary ? Proto.store.carrierName(p.primary) + (p.secondary ? ' + ' + Proto.store.carrierName(p.secondary) : '') : 'Self-pay' }), eligibilityChip(rail.pid))),
      summary('recall', 'Recall', h('div', { text: recallLine(rail.pid) })),
      summary('balance', 'Balance', threeNum(b), h('div', { class: 'btnrow' }, btn('Explain', { kind: 'reversible', testid: 'rail.explain', pressed: pressed(rail.explain), onClick: () => { rail.explain = !rail.explain; renderRail(); const e = document.querySelector('[data-testid="rail.explain"]'); if (e) e.focus(); } })), explainBody),
      summary('plans', 'Open plans', ...plansBody(rail.pid)),
      summary('note', 'Last filed note', lastNoteLine(rail.pid)),
    ].filter(Boolean)); // null children would render as the text "null"
    if (keepFocus) { const back = box.querySelector('[data-testid="' + keepFocus + '"]'); if (back && back.focus) back.focus(); }
  }

  /* ---------------- Ledger screen ---------------- */
  /* A row names the row it corrects the way the spec does — "Reverses #4412 from 9/1" — and names its bucket and
     its reason in words. Storage ids (ledger entries, ERA lines) and GL codes stay in the record, off the screen. */
  function rowRef(verb, id) { const o = S().ledger.find((x) => x.id === id); return verb + ' #' + numId(id) + (o ? ' from ' + shortDate(o.posted) : ''); }
  function reasonText(e, patientVoice) {
    const parts = [];
    if (e.kind === 'reversal' && e.reversesEntryId) parts.push(rowRef('Reverses', e.reversesEntryId));
    else if (e.correctsEntryId) parts.push(rowRef('Reposts', e.correctsEntryId));
    if (e.cdt) parts.push(cdtName(e.cdt) + (e.tooth ? ' #' + e.tooth : ''));
    if (e.payer) parts.push(e.payer + (e.gl && !patientVoice ? ' · ' + (GL_WORD[e.gl] || humanize(e.gl)) : ''));
    if (e.tender) parts.push(e.tender);
    if (e.reason && !patientVoice) parts.push(REASON_WORD[e.reason] || humanize(e.reason));
    if (e.eraLineId && !patientVoice) parts.push('from the payer\'s ERA');
    return parts.join(' · ') || '—';
  }
  function actorText(e) { return e.actor + (e.actorKind === 'worker' ? ' (worker)' : e.actorKind === 'file_event' ? ' (released by filed note)' : ''); }

  function ledgerTable(rows, st) {
    const head = ['Posted', 'Effective', 'Kind', 'Reason'].concat(st.patientVoice ? [] : ['Actor']).concat(['Amount']);
    const tbl = h('table', { class: 'data ledger-table' }, h('thead', null, h('tr', null, head.map((t) => h('th', { class: t === 'Amount' ? 'num' : null, scope: 'col', text: t })))),
      h('tbody', null, rows.length ? rows.map((e) => h('tr', { id: 'row-' + e.id, testid: 'ledger.row.' + e.id, class: st.hi && st.hi.includes(e.id) ? 'ledger-hi' : null },
        h('td', { class: 'num', text: shortDate(e.posted) }), h('td', { class: 'num', text: shortDate(e.effective) }),
        h('td', null, KIND_WORD[e.kind] || humanize(e.kind), e.postedAfterClose ? [' ', chip('info', 'After close')] : null),
        h('td', { text: reasonText(e, st.patientVoice) }),
        st.patientVoice ? null : h('td', { text: actorText(e) }),
        h('td', { class: 'num', text: money(e.amountCents) }))) : h('tr', null, h('td', { colspan: String(head.length), class: 'muted', text: 'No rows posted by this date' }))));
    return Proto.ui.scrollRegion('Ledger rows', 'ledger.rows', tbl);
  }

  /* One wording for the empty Explain, on the Ledger and in the rail, with the step that ends it. */
  function explainEmpty(patientVoice) { return patientVoice ? 'Nothing to explain: no charges on this account. A charge appears once the visit\'s note is filed.' : 'No charges on this account, so there is nothing to explain. Filing the visit\'s note releases the charge.'; }
  function explainBlock(pid, st, r) {
    // Under As-of the sentences allocate over the same rows as the three numbers: the account as it stood that day.
    const rows = Proto.store.explain(pid, st.asof);
    if (!rows.length) return h('div', { class: 'explain' }, h('p', { class: 'sentence muted', text: explainEmpty(st.patientVoice) }));
    return h('div', { class: 'explain', 'aria-live': 'polite' },
      st.patientVoice ? h('p', { class: 'small muted', text: 'Patient view: no reason codes, no poster names; estimate lines are labelled estimate. Turn the screen or print (this is recorded as a disclosure).' }) : null,
      rows.map((x) => h('div', { class: 'ledger-sentence' }, h('p', { class: 'sentence' }, boldAmounts(st.patientVoice ? x.patientVoice : x.sentence)),
        st.patientVoice ? null : btn('Rows', { kind: 'quiet', class: 'compact', testid: 'ledger.explain.rows.' + x.chargeId, ariaLabel: 'Highlight the ledger rows behind this sentence', onClick: () => { const ch = S().ledger.find((e) => e.id === x.chargeId); st.hi = S().ledger.filter((e) => e.patientId === pid && (e.id === ch.id || (e.kind !== 'charge' && e.effective >= ch.effective))).map((e) => e.id); rerender(r, 'ledger.explain.rows.' + x.chargeId); const el = document.getElementById('row-' + x.chargeId); if (el) el.scrollIntoView({ block: 'center' }); } }))));
  }

  /* Money Desk is where the biller works an account: a navigation, not a posting, so it claims nothing. Every gate
     here points at Statements due, so that is the tab it lands on; the ERA tab had nothing to do with a statement. */
  function openMoneyDesk(r, st) { if (st) st.gate = null; if (Proto.screens.moneydesk) Proto.screens.moneydesk.setTab('statements'); Proto.router.go(r.persona || P().persona || 'frontdesk', 'money'); }
  /* The store's control words get something to do on this screen: the Andon's support line for an outage, the PIN field
     for a PIN, Explain for a zero balance, Money Desk for a hold or a statement already sent (the "Open the ledger" the
     store offers is where we already are). */
  const focusPin = () => { const el = document.querySelector('[data-testid="ledger.pin"]'); if (el) el.focus(); };
  function storeGate(r, st, res) {
    if (res.code === 'outage') return Object.assign({}, res, { severity: 'stop', onControl: () => { const a = document.querySelector('[data-testid="andon.control"]'); if (a) a.focus(); else Proto.ui.support(); } });
    // A second wrong PIN reads the same as the first and is still a second refusal (ui.js `fresh`, consumed by the first draw);
    // Close on the lock empties the PIN and drops the gate, as Checkout's does.
    if (res.code === 'pin_locked') return Object.assign({}, res, { fresh: true, onControl: () => { st.pin = ''; st.gate = null; rerender(r, 'ledger.pin'); } });
    if (/^pin_/.test(res.code)) return Object.assign({}, res, { fresh: res.code === 'pin_no_match', onControl: focusPin });
    if (res.code === 'zero_collect_refused') return Object.assign({}, res, { control: 'Explain', onControl: () => { st.explain = true; st.gate = null; rerender(r, 'ledger.explain'); } });
    if (res.code === 'already_decided' || res.code === 'statement_held') return Object.assign({}, res, { control: 'Open Money Desk', onControl: () => openMoneyDesk(r, st) });
    // The entitlement and closed-day words act as on Checkout: Roles, the author pad, Daily Close.
    if (res.code === 'entitlement' && res.control === 'Switch author') return Object.assign({}, res, { onControl: () => Proto.screens.shell.openPinPad(r) });
    if (res.code === 'entitlement') return Object.assign({}, res, { control: res.control || 'Open Roles', onControl: () => { location.hash = '#/owner/roles'; } });
    if (res.code === 'already_closed') return Object.assign({}, res, { control: res.control || 'Open the day', onControl: () => Proto.router.go(r.persona, 'close') });
    return res;
  }
  /* The Ledger sends the row Money Desk raised; with none open it asks the store to raise one first, and the store's
     reasons for not raising (a claim still out, nothing due) are the gate. The Ledger used to word those holds itself and
     to send an account with a balance and no row to a tab with nothing to press. */
  function sendStatement(r, pid, st) {
    const extras = { pin: st.pin || null };
    // A row already sent is the store's to refuse (already_decided), not a reason to raise a second one on the same balance.
    let sd = S().statementsDue.find((x) => x.patientId === pid && !x.sent) || S().statementsDue.find((x) => x.patientId === pid);
    if (!sd) { const raised = Proto.store.raiseStatement(pid, extras); if (!raised.ok) { st.gate = storeGate(r, st, raised); return rerender(r, 'ledger.statement.send'); } sd = raised.statement; }
    const res = Proto.store.sendStatement(sd.id, extras);
    // The PIN named the sender of this statement and is spent; the keyboard lands on the sent stamp, not back on Send.
    if (res.ok) { st.sent = { id: sd.id, channel: 'mail' }; st.gate = null; st.pin = ''; announce('Sent the statement by mail'); return rerender(r, '#ledger-sent'); }
    st.gate = storeGate(r, st, res);
    rerender(r, 'ledger.statement.send');
  }
  function previewStatement(pid, st) {
    const p = Proto.store.patient(pid); const b = Proto.store.balances(pid); const rows = Proto.store.explain(pid);
    const pend = S().claims.filter((c) => c.patientId === pid && ['submitted', 'pended', 'appealed'].includes(c.status));
    let closeDlg;
    closeDlg = Proto.ui.dialog(h('div', { class: 'stack' },
      h('h2', { text: 'Statement preview' }), h('p', { class: 'muted', text: displayName(p.name, P().privacy) + ' · ' + identLine(p, P().privacy) + ' · prepared ' + longDate(today()) }),
      threeNum(b, ['You owe', 'Waiting on insurance', 'Credit']),
      h('div', { class: 'explain' }, rows.length ? rows.map((x) => h('p', { class: 'sentence' }, boldAmounts(x.patientVoice))) : h('p', { class: 'sentence muted', text: 'Nothing left to pay.' })),
      h('div', null, h('h3', { text: 'Waiting on insurance' }), pend.length ? h('ul', { class: 'ledger-list' }, pend.map((c) => h('li', { text: cdtName(c.cdt) + (c.tooth ? ' #' + c.tooth : '') + ' — ' + c.payer + ' is reviewing; no amount for you until they respond' }))) : h('p', { class: 'muted', text: 'Nothing pending' })),
      h('p', { class: 'small muted', text: 'Estimate lines are labelled estimate. Family members are named by first name; adult dependents show amount and date only unless they have authorized more.' }),
      h('div', { class: 'btnrow' }, btn('Close', { kind: 'quiet', testid: 'ledger.statement.preview.close', ariaLabel: 'Close the statement preview', onClick: () => closeDlg() }))), { label: 'Statement preview', focus: '[data-testid="ledger.statement.preview.close"]' });
  }

  function asOfBlock(pid, st, r, allRows) {
    const S0 = S(); const stmts = S0.statementsDue.filter((x) => x.patientId === pid);
    const later = st.asof ? allRows.filter((e) => e.posted > st.asof).sort((a, b) => a.posted.localeCompare(b.posted)) : [];
    const input = h('input', { class: 'input ledger-date', type: 'date', id: 'ledger-asof-date', testid: 'ledger.asof.date', value: st.asof || S0.tenant.closedDay, min: '2026-06-01', max: today(), 'aria-describedby': 'ledger-asof-hint' });
    const hint = h('p', { class: 'hint', id: 'ledger-asof-hint', text: 'Rows posted on or before this date, by posted date; the effective date stays visible in the table.' });
    /* Validation is silent until the value is committed (change fires on blur or picker close). */
    input.addEventListener('change', () => { const v = input.value; if (!v || v > today()) { input.classList.add('invalid'); hint.textContent = 'Pick a date up to today (' + longDate(today()) + ').'; return; } input.classList.remove('invalid'); st.asof = v; st.hi = null; const n = allRows.filter((e) => e.posted <= v).length; announce('As of ' + shortDate(v) + ': ' + n + (n === 1 ? ' row' : ' rows') + ' by posted date'); rerender(r, 'ledger.asof.back'); });
    return h('div', { class: 'ledger-asof stack' },
      h('div', { class: 'ledger-asof-row' }, h('div', { class: 'field' }, h('label', { for: 'ledger-asof-date', text: 'Show the ledger as it stood at the end of' }), input),
        stmts.length ? h('div', { class: 'field' }, h('span', { class: 'small muted', text: 'or the statement the patient is holding' }), h('div', { class: 'btnrow' }, stmts.map((s) => btn('Statement ' + s.id + ' · ' + shortDate(s.created), { kind: 'quiet', testid: 'ledger.asof.statement.' + s.id, onClick: () => { st.asof = s.created; st.hi = null; rerender(r, 'ledger.asof.back'); } })))) : null,
        st.asof ? btn('Back to today', { kind: 'reversible', testid: 'ledger.asof.back', onClick: () => { st.asof = null; st.hi = null; announce('Back to today'); rerender(r, 'ledger.asof'); } }) : null),
      hint,
      st.asof ? h('div', { class: 'ledger-changed' }, h('h3', { text: 'What changed since ' + shortDate(st.asof) }), later.length ? h('ul', { class: 'ledger-list' }, later.map((e) => h('li', null, shortDate(e.posted) + ' ', KIND_WORD[e.kind] || humanize(e.kind), ' ', h('b', { text: money(e.amountCents) }), ' · ' + reasonText(e, false) + ' · ' + actorText(e)))) : h('p', { class: 'muted', text: 'Nothing posted after this date' })) : null);
  }

  function renderLedger(r) {
    const pid = r.id; const p = Proto.store.patient(pid);
    /* An id in the address that names no row is the Nothing-here screen, in the shell's own words and with its
       own way out — not a second not-found page with a heading and a control of its own. */
    if (!p) { const nf = Proto.store.notFound('patient'); Proto.screens.shell.mount(h('div', { class: 'stack' }, h('h1', { text: 'Nothing here' }), h('p', { class: 'muted', text: nf.why }), btn('Back to home', { kind: 'quiet', testid: 'notfound.home', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) }))); return; }
    if (rail.pid !== pid) open(pid, r, { keepFocus: true }); else { rail.r = r; renderRail(); }
    const st = ledState(pid); const priv = !!P().privacy; const all = rowsFor(pid);
    // A gate whose cause is gone falls on the next render: the outage ended, or the desk is no longer shared.
    if (st.gate && ((st.gate.code === 'outage' && !S().outage) || (/^pin_/.test(st.gate.code) && !shared()))) st.gate = null;
    if (!shared()) st.pin = '';
    const rows = st.asof ? all.filter((e) => e.posted <= st.asof) : all;
    // One allocation pass for the three numbers and Explain, as of today or as of the chosen day.
    const b = Proto.store.balances(pid, st.asof);
    const gateNode = st.gate ? refusal(Object.assign({ onControl: () => { st.gate = null; rerender(r, 'ledger.statement.send'); } }, st.gate)) : null;
    if (st.gate) st.gate.fresh = false;                  // the first draw after the press logged it; a redraw does not
    const pinField = shared() ? h('div', { class: 'field' }, h('label', { for: 'ledger-pin', text: 'Your PIN' }), h('input', { class: 'input co-pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', id: 'ledger-pin', testid: 'ledger.pin', value: st.pin, onInput: (ev) => { st.pin = ev.target.value; if (st.gate && /^pin_/.test(st.gate.code)) { st.gate = null; rerender(r, 'ledger.pin'); const el = document.querySelector('[data-testid="ledger.pin"]'); if (el) el.setSelectionRange(el.value.length, el.value.length); } } }), h('p', { class: 'hint', text: 'Shared desk: the PIN makes you the frozen sender of this statement.' })) : null;
    const page = h('div', { class: 'stack ledger-page' },
      pageHead('Ledger', displayName(p.name, priv) + ' · ' + identLine(p, priv) + ' · ' + p.mrn,
        btn('Explain', { kind: 'reversible', testid: 'ledger.explain', pressed: pressed(st.explain), onClick: () => { st.explain = !st.explain; rerender(r, 'ledger.explain'); } }),
        btn('Show patient', { kind: 'reversible', testid: 'ledger.showpatient', pressed: pressed(st.patientVoice), ariaLabel: st.patientVoice ? 'Patient view on. Switch back to the staff view' : 'Show the patient view: same rows, plain words, no reason codes or poster names', onClick: () => { st.patientVoice = !st.patientVoice; if (st.patientVoice) st.explain = true; rerender(r, 'ledger.showpatient'); } }),
        btn('Open Money Desk', { kind: 'quiet', testid: 'ledger.sendbiller', ariaLabel: 'Open Money Desk to work this account', onClick: () => openMoneyDesk(r, st) }),
        btn(st.asof ? 'As of ' + shortDate(st.asof) + ' · by posted date' : 'As of today · by posted date', { kind: 'quiet', testid: 'ledger.asof', pressed: pressed(st.asofOpen), ariaLabel: (st.asof ? 'Showing the ledger as of ' + longDate(st.asof) : 'Showing the ledger as of today') + ', by posted date. Choose another date', onClick: () => { st.asofOpen = !st.asofOpen; rerender(r, st.asofOpen ? 'ledger.asof.date' : 'ledger.asof'); } })),
      st.asof ? h('p', { class: 'ledger-asofline', role: 'status', text: 'As of ' + shortDate(st.asof) + ': ' + rows.length + ' of ' + all.length + ' rows, posted on or before ' + longDate(st.asof) + '. Waiting on insurance reflects today\'s claims.' }) : null,
      section('Balance', threeNum(b, st.patientVoice ? ['You owe', 'Waiting on insurance', 'Credit'] : null),
        st.explain ? explainBlock(pid, st, r) : h('p', { class: 'small muted', text: 'Explain renders one sentence per open procedure from the rows below; Show patient says the same thing in the patient\'s words.' })),
      st.asofOpen ? section('As of', asOfBlock(pid, st, r, all)) : null,
      section('Rows', h('p', { class: 'small muted', text: 'Newest first by posted date. Reversals and reposts name the row they correct; nothing is edited in place.' }), ledgerTable(rows, st)),
      section('Statement',
        st.sent ? h('div', { class: 'ledger-sent row', id: 'ledger-sent', tabindex: '-1' }, chip('clear', 'Statement sent'), h('span', { text: 'Frozen and sent by ' + st.sent.channel + ' on ' + longDate(today()) + '; disclosure row written' })) : null,
        pinField,
        gateNode,
        h('div', { class: 'btnrow' },
          // A held primary renders the word Held from ui.btn; the label passed in becomes its accessible name.
          btn('Send statement', { kind: st.gate ? 'held' : 'irreversible', testid: 'ledger.statement.send', ariaLabel: st.gate ? 'Send statement is held: ' + st.gate.verb : 'Send the statement by mail; this freezes it with an id', onClick: () => sendStatement(r, pid, st) }),
          btn('Preview', { kind: 'reversible', testid: 'ledger.statement.preview', onClick: () => previewStatement(pid, st) })),
        h('details', { class: 'ledger-details' }, h('summary', { testid: 'ledger.statement.why' }, 'Why this statement'), h('p', { class: 'muted', text: 'The patient-voice sentences under three numbers; pending claims listed under Waiting on insurance with no patient dollar figure; family members by first name. Send freezes the statement with an id and writes a disclosure row per channel. A balance still waiting on insurance holds for a stated reason.' }))));
    Proto.screens.shell.mount(page);
  }
  function rerender(r, focus) {
    renderLedger(r); Proto.screens.shell.refreshAndon(r);
    if (focus) { const el = document.querySelector(focus[0] === '#' ? focus : '[data-testid="' + focus + '"]'); if (el && el.focus) el.focus(); }
  }

  /* The rail persists across routes: keep it current on navigation and when privacy mode flips. A PIN is typed for the
     posting at hand, so leaving the route disarms it for every account. */
  window.addEventListener('hashchange', () => { for (const v of Object.values(led)) v.pin = ''; const r = Proto.router.current(); if (r.route === 'signin') { close(); return; } if (isOpen()) { rail.r = r; rail.msg = null; renderRail(); } });
  if (window.MutationObserver) new MutationObserver(() => { if (isOpen()) renderRail(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-privacy'] });
  /* The rail shows the same facts as the work canvas, so it redraws when the canvas does. Waiting for the next
     hashchange left the open rail reading the balance from before a Post that the canvas beside it already showed. */
  if (window.MutationObserver) { const cv = document.getElementById('canvas'); if (cv) new MutationObserver(() => { if (isOpen()) renderRail(); }).observe(cv, { childList: true }); }

  Proto.screens.rail = { open, close, isOpen, render(r) { if (r) rail.r = r; if (isOpen()) renderRail(); }, button };
  Proto.screens.ledger = { render: renderLedger };
  Proto.router.on('ledger', (r) => Proto.screens.ledger.render(r));
})();
