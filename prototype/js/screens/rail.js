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
  const ELIG = { green: ['clear', 'Active'], amber: ['review', 'Re-verify'], red: ['required', 'Inactive'], none: ['info', 'Self-pay'] };
  const MAX_HOLD_DAYS = 45;

  const rail = { pid: null, r: null, open: { balance: true }, explain: false, msg: null };
  const led = {}; // per patient id: ledger view state (explain, patientVoice, asof, asofOpen, biller, sent, gate, hi)

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
  const openClaims = (pid) => S().claims.filter((c) => c.patientId === pid && ['submitted', 'pended', 'denied', 'appealed'].includes(c.status));
  const ledState = (pid) => (led[pid] = led[pid] || { explain: false, patientVoice: false, asof: null, asofOpen: false, biller: null, sent: null, gate: null, hi: null });
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
  /* Same arithmetic as store.balances over a chosen row set (As-of); estimates never join. */
  function sumsFrom(rows) { let due = 0; for (const e of rows) due += e.amountCents; return { patientDue: Math.max(0, due), credit: due < 0 ? -due : 0 }; }
  function eligibilityChip(pid) { const a = apptsToday(pid).find((x) => !['checked_out', 'checked_out_unfiled'].includes(x.status)) || apptsToday(pid)[0]; const e = a ? ELIG[a.eligibility] || ELIG.none : ['info', 'Not checked today']; return chip(e[0], e[1]); }

  /* ---------------- Patient Rail ---------------- */
  function open(pid, r) {
    if (!Proto.store.patient(pid)) { announce('Patient not found'); return; }
    if (rail.pid !== pid) { rail.explain = false; rail.msg = null; }
    rail.pid = pid; if (r) rail.r = r;
    const box = document.getElementById('rail'); if (box) box.hidden = false;
    renderRail();
  }
  function close() { rail.pid = null; rail.msg = null; const box = document.getElementById('rail'); if (box) { box.replaceChildren(); box.hidden = true; } }
  function isOpen() { return !!rail.pid; }
  function button(pid, r, testid) {
    const p = Proto.store.patient(pid);
    return btn('Rail', { kind: 'quiet', class: 'compact', testid: testid || 'rail.open.' + pid, pressed: pressed(rail.pid === pid), ariaLabel: 'Open the patient rail' + (p ? ' for ' + displayName(p.name, P().privacy) : ''), onClick: (ev) => { ev.stopPropagation(); open(pid, r || Proto.router.current()); const c = document.querySelector('[data-testid="rail.close"]'); if (c) c.focus(); } });
  }

  function summaryFor(code, pid) {
    const p = Proto.store.patient(pid); const st = S();
    if (code === 'imaging') { const a = apptsToday(pid).find((x) => x.bwxDue); return a ? 'Imaging: bitewings due today; last set on file opens in the encounter' : 'Imaging: nothing due; images open from the encounter'; }
    if (code === 'claims') { const cs = openClaims(pid); return cs.length ? 'Claims: ' + cs.length + ' open — ' + cs.map((c) => c.id + ' ' + c.status + ' (' + c.payer + ')').join(', ') : 'Claims: none open'; }
    if (code === 'docs') { const ids = encsFor(pid).map((e) => e.id); const notes = st.filedNotes.filter((n) => ids.includes(n.encounterId)).length; const disc = st.disclosures.filter((d) => d.patientId === pid).length; return 'Docs: ' + notes + ' filed note' + (notes === 1 ? '' : 's') + ', ' + disc + ' disclosure' + (disc === 1 ? '' : 's') + ', intake and consent forms on file'; }
    return 'Profile: ' + displayName(p.name, P().privacy) + ', ' + identLine(p, P().privacy) + ', ' + p.mrn + ', ' + (p.primary ? Proto.store.carrierName(p.primary) : 'self-pay');
  }
  function tabGo(code) {
    const r = route(); const pid = rail.pid; const persona = r.persona || P().persona || 'frontdesk'; const encs = encsToday(pid);
    if (code === 'ledger') return Proto.router.go(persona, 'ledger', pid);
    if (code === 'perio') { const e = encs.find((x) => x.status === 'open'); if (e) return Proto.router.go(persona, 'perio', e.id); rail.msg = announce('No open encounter today — perio opens from the chair'); return renderRail(); }
    if (code === 'chart' || code === 'notes' || code === 'plan') { if (encs[0]) return Proto.router.go(persona, 'encounter', encs[0].id); rail.msg = announce('No encounter today'); return renderRail(); }
    rail.msg = announce(summaryFor(code, pid)); renderRail();
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
    const nextLine = next ? 'Next: today ' + next.time + ' ' + next.type + ' with ' + prov(next) + ', chair ' + next.op + ' (' + humanize(next.status) + ')' : as.length ? 'Next: nothing further today (' + humanize(as[as.length - 1].status) + ')' : 'Next: nothing booked';
    const lastCharge = st.ledger.filter((e) => e.patientId === pid && e.kind === 'charge' && e.effective < today()).sort((a, b) => b.effective.localeCompare(a.effective))[0];
    const lastLine = lastCharge ? 'Last: ' + longDate(lastCharge.effective) + (lastCharge.cdt ? ' ' + cdtName(lastCharge.cdt) + (lastCharge.tooth ? ' #' + lastCharge.tooth : '') : '') : 'Last: no prior visit on record';
    return [h('div', { text: nextLine }), h('div', { class: 'muted', text: lastLine })];
  }
  function recallLine(pid) {
    const a = apptsToday(pid).find((x) => x.perioLast); const pe = S().perioExams.filter((x) => x.patientId === pid).sort((x, y) => y.date.localeCompare(x.date))[0];
    if (pe && pe.date === today()) return 'Perio charted today; next full chart in 12 months';
    if (a && a.perioLast) { const months = Math.round((new Date(today()) - new Date(a.perioLast)) / (30.44 * 864e5)); return 'Perio due: last full chart ' + longDate(a.perioLast) + ' (' + months + ' months ago)'; }
    return apptsToday(pid).some((x) => x.type === 'hygiene') ? 'Prophy recall: 6 months after today\'s hygiene visit' : 'Recall: 6 months from the last hygiene visit';
  }
  function plansBody(pid) {
    const ids = encsFor(pid).map((e) => e.id); const items = S().planItems.filter((pl) => ids.includes(pl.encounterId));
    if (!items.length) return [h('div', { class: 'muted', text: 'No open plans' })];
    return items.map((pl) => h('div', { class: 'rail-plan' }, h('div', { text: cdtName(pl.cdt) + (pl.tooth ? ' #' + pl.tooth : '') + (pl.temporality === 'planned' ? ' (planned)' : '') }), h('div', { class: 'small muted' }, 'Fee ', h('b', { text: money((S().cdt[pl.cdt] || [0, 0])[1]) }), ' · plan pays about ', h('b', { text: money((S().cdt[pl.cdt] || [0, 0])[1] - pl.estimateCents) }), ' · you\'d owe about ', h('b', { text: money(pl.estimateCents) }), ' (estimate)')));
  }
  function lastNoteLine(pid) {
    const encs = encsFor(pid); const ids = encs.map((e) => e.id); const notes = S().filedNotes.filter((n) => ids.includes(n.encounterId));
    if (notes.length) { const n = notes[notes.length - 1]; return h('div', null, h('div', { text: (n.markdown || '').split('\n')[0] || 'Filed note' }), h('div', { class: 'small muted', text: 'Filed by ' + n.author + ' · ' + n.filedAt })); }
    const filed = encs.find((e) => e.noteFiled);
    return h('div', { class: 'muted', text: filed ? 'Note filed today by ' + ((Proto.store.user(filed.providerId) || {}).short || 'the provider') + '; opens from the encounter' : 'No filed note on record' });
  }

  function renderRail() {
    const box = document.getElementById('rail'); if (!box) return;
    const p = Proto.store.patient(rail.pid); if (!p) { close(); return; }
    const priv = !!P().privacy; const r = route(); const b = Proto.store.balances(rail.pid);
    box.hidden = false;
    const alertText = p.alerts.length ? 'Critical alerts: ' + p.alerts.join('; ') : 'No critical alerts';
    const alertbar = h('div', { class: 'alertbar' + (p.alerts.length ? '' : ' rail-clear'), testid: 'rail.alert', role: 'button', tabindex: '0', 'aria-label': alertText + '. Read aloud', onClick: () => announce(alertText), onKeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); announce(alertText); } } },
      h('span', { class: 'glyph', 'aria-hidden': 'true', text: p.alerts.length ? '■' : '●' }),
      p.alerts.length ? h('ul', { class: 'rail-alerts' }, p.alerts.map((a) => h('li', { text: a }))) : h('span', { text: 'No critical alerts' }));
    const tabs = h('div', { class: 'railtabs', role: 'navigation', 'aria-label': 'Patient sections' }, TABS.map(([code, label]) => { const cur = code === 'ledger' && r.route === 'ledger' && r.id === rail.pid; return btn(label, { kind: 'quiet', class: 'rail-tab', testid: 'rail.tab.' + code, onClick: () => tabGo(code) , ariaLabel: label + (cur ? ', current' : '') }); }));
    tabs.querySelectorAll('.btn').forEach((el) => { if (el.getAttribute('data-testid') === 'rail.tab.ledger' && r.route === 'ledger' && r.id === rail.pid) el.setAttribute('aria-current', 'page'); });
    const explainBody = rail.explain ? h('div', { class: 'explain' }, Proto.store.explain(rail.pid).map((x) => h('p', { class: 'sentence' }, boldAmounts(x.sentence)))) : null;
    box.replaceChildren(...[
      h('div', { class: 'rail-head' }, h('div', null, h('div', { class: 'name', text: displayName(p.name, priv) }), h('div', { class: 'rail-ids', text: identLine(p, priv) })), btn('Close', { kind: 'quiet', class: 'compact', testid: 'rail.close', ariaLabel: 'Close the patient rail', onClick: () => { close(); const c = document.getElementById('canvas'); if (c) c.focus(); } })),
      alertbar, tabs,
      rail.msg ? h('p', { class: 'rail-msg', role: 'status', text: rail.msg }) : null,
      summary('appts', 'Appointments', ...apptSummary(rail.pid)),
      summary('coverage', 'Coverage', h('div', { class: 'row' }, h('span', { text: p.primary ? Proto.store.carrierName(p.primary) + (p.secondary ? ' + ' + Proto.store.carrierName(p.secondary) : '') : 'Self-pay' }), eligibilityChip(rail.pid))),
      summary('recall', 'Recall', h('div', { text: recallLine(rail.pid) })),
      summary('balance', 'Balance', threeNum(b), h('div', { class: 'btnrow' }, btn('Explain', { kind: 'reversible', testid: 'rail.explain', pressed: pressed(rail.explain), onClick: () => { rail.explain = !rail.explain; renderRail(); const e = document.querySelector('[data-testid="rail.explain"]'); if (e) e.focus(); } })), explainBody),
      summary('plans', 'Open plans', ...plansBody(rail.pid)),
      summary('note', 'Last filed note', lastNoteLine(rail.pid)),
    ].filter(Boolean)); // null children would render as the text "null"
  }

  /* ---------------- Ledger screen ---------------- */
  function reasonText(e, patientVoice) {
    const parts = [];
    if (e.kind === 'reversal' && e.reversesEntryId) parts.push('Reverses #' + e.reversesEntryId);
    else if (e.correctsEntryId) parts.push('Reposts #' + e.correctsEntryId);
    if (e.cdt) parts.push(cdtName(e.cdt) + (e.tooth ? ' #' + e.tooth : ''));
    if (e.payer) parts.push(e.payer + (e.gl && !patientVoice ? ' · ' + humanize(e.gl) : ''));
    if (e.tender) parts.push(e.tender);
    if (e.reason && !patientVoice) parts.push(humanize(e.reason));
    if (e.eraLineId && !patientVoice) parts.push('ERA line ' + e.eraLineId);
    return parts.join(' · ') || '—';
  }
  function actorText(e) { return e.actor + (e.actorKind === 'worker' ? ' (worker)' : e.actorKind === 'file_event' ? ' (released by filed note)' : ''); }

  function ledgerTable(rows, st) {
    const head = ['Posted', 'Effective', 'Kind', 'Reason'].concat(st.patientVoice ? [] : ['Actor']).concat(['Amount']);
    const tbl = h('table', { class: 'data ledger-table' }, h('thead', null, h('tr', null, head.map((t) => h('th', { class: t === 'Amount' ? 'num' : null, scope: 'col', text: t })))),
      h('tbody', null, rows.length ? rows.map((e) => h('tr', { id: 'row-' + e.id, class: st.hi && st.hi.includes(e.id) ? 'ledger-hi' : null },
        h('td', { class: 'num', text: shortDate(e.posted) }), h('td', { class: 'num', text: shortDate(e.effective) }),
        h('td', null, KIND_WORD[e.kind] || humanize(e.kind), e.postedAfterClose ? [' ', chip('info', 'After close')] : null),
        h('td', { text: reasonText(e, st.patientVoice) }),
        st.patientVoice ? null : h('td', { text: actorText(e) }),
        h('td', { class: 'num', text: money(e.amountCents) }))) : h('tr', null, h('td', { colspan: String(head.length), class: 'muted', text: 'No rows posted by this date' }))));
    return h('div', { class: 'wrap-x' }, tbl);
  }

  function explainBlock(pid, st, r) {
    const rows = Proto.store.explain(pid);
    if (!rows.length) return h('div', { class: 'explain' }, h('p', { class: 'sentence muted', text: st.patientVoice ? 'Nothing to explain: no charges on this account.' : 'No charges on this account, so there is nothing to explain.' }));
    return h('div', { class: 'explain', 'aria-live': 'polite' },
      st.patientVoice ? h('p', { class: 'small muted', text: 'Patient view: no reason codes, no poster names; estimate lines are labelled estimate. Turn the screen or print (this is recorded as a disclosure).' }) : null,
      rows.map((x) => h('div', { class: 'ledger-sentence' }, h('p', { class: 'sentence' }, boldAmounts(st.patientVoice ? x.patientVoice : x.sentence)),
        st.patientVoice ? null : btn('Rows', { kind: 'quiet', class: 'compact', testid: 'ledger.explain.rows.' + x.chargeId, ariaLabel: 'Highlight the ledger rows behind this sentence', onClick: () => { const ch = S().ledger.find((e) => e.id === x.chargeId); st.hi = S().ledger.filter((e) => e.patientId === pid && (e.id === ch.id || (e.kind !== 'charge' && e.effective >= ch.effective))).map((e) => e.id); rerender(r); const el = document.getElementById('row-' + x.chargeId); if (el) el.scrollIntoView({ block: 'center' }); } }))));
  }

  function sendBiller(r, pid, st) {
    const first = Proto.store.explain(pid)[0]; const b = Proto.store.balances(pid);
    st.biller = first ? first.sentence : 'Balance: patient due ' + money(b.patientDue) + ', waiting on insurance ' + money(b.insurancePending) + ', credit ' + money(b.credit) + '.';
    st.gate = null; announce('Money Desk row created with the sentence attached'); rerender(r, 'ledger.sendbiller');
  }
  function sendStatement(r, pid, st) {
    const st0 = S(); const b = Proto.store.balances(pid);
    const sd = st0.statementsDue.find((x) => x.patientId === pid && !x.sent);
    if (sd) { const res = Proto.store.sendStatement(sd.id); if (res.ok) { st.sent = { id: sd.id, channel: 'mail' }; st.gate = null; announce('Statement ' + sd.id + ' frozen and sent by mail; disclosure row written'); } else st.gate = res; return rerender(r, 'ledger.statement.send'); }
    const pend = st0.claims.filter((c) => c.patientId === pid && ['submitted', 'pended'].includes(c.status));
    if (pend.length) { const c = pend[0]; st.gate = { code: 'statement_held', verb: 'Held: ' + c.payer + ' claim pending ' + c.age + ' days on ' + c.cdt.toUpperCase(), control: 'Send to biller', onControl: () => sendBiller(r, pid, st), why: 'A statement never goes out on a balance still waiting on insurance. The hold reason is shown on Money Desk → Statements due; after ' + MAX_HOLD_DAYS + ' days the row surfaces regardless of the pending claim.' }; return rerender(r, 'ledger.statement.send'); }
    if (b.patientDue === 0) { st.gate = { code: 'zero_collect_refused', verb: 'Nothing due — no statement to send', control: 'Explain', onControl: () => { st.explain = true; st.gate = null; rerender(r, 'ledger.explain'); }, why: 'A statement for $0 is noise to the patient and a disclosure row for nothing. Explain shows why the balance is zero; a credit is refunded from Money Desk, never billed.' }; return rerender(r, 'ledger.statement.send'); }
    st.sent = { id: 'st-' + pid.slice(2) + '-' + today().slice(5).replace('-', ''), channel: 'mail', local: true }; st.gate = null;
    announce('Statement ' + st.sent.id + ' frozen and sent by mail'); rerender(r, 'ledger.statement.send');
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
      h('div', { class: 'btnrow' }, btn('Close preview', { kind: 'quiet', testid: 'ledger.statement.preview.close', onClick: () => closeDlg() }))), { label: 'Statement preview', focus: '[data-testid="ledger.statement.preview.close"]' });
  }

  function asOfBlock(pid, st, r, allRows) {
    const S0 = S(); const stmts = S0.statementsDue.filter((x) => x.patientId === pid);
    const later = st.asof ? allRows.filter((e) => e.posted > st.asof).sort((a, b) => a.posted.localeCompare(b.posted)) : [];
    const input = h('input', { class: 'input ledger-date', type: 'date', id: 'ledger-asof-date', testid: 'ledger.asof.date', value: st.asof || S0.tenant.closedDay, min: '2026-06-01', max: today(), 'aria-describedby': 'ledger-asof-hint' });
    const hint = h('p', { class: 'hint', id: 'ledger-asof-hint', text: 'Rows posted on or before this date, by posted date; the effective date stays visible in the table.' });
    /* Validation is silent until the value is committed (change fires on blur or picker close). */
    input.addEventListener('change', () => { const v = input.value; if (!v || v > today()) { input.classList.add('invalid'); hint.textContent = 'Pick a date up to today (' + longDate(today()) + ').'; return; } input.classList.remove('invalid'); st.asof = v; st.hi = null; announce('As of ' + shortDate(v) + ': ' + allRows.filter((e) => e.posted <= v).length + ' rows by posted date'); rerender(r, 'ledger.asof.back'); });
    return h('div', { class: 'ledger-asof stack' },
      h('div', { class: 'ledger-asof-row' }, h('div', { class: 'field' }, h('label', { for: 'ledger-asof-date', text: 'Show the ledger as it stood at the end of' }), input),
        stmts.length ? h('div', { class: 'field' }, h('span', { class: 'small muted', text: 'or the statement the patient is holding' }), h('div', { class: 'btnrow' }, stmts.map((s) => btn('Statement ' + s.id + ' · ' + shortDate(s.created), { kind: 'quiet', testid: 'ledger.asof.statement.' + s.id, onClick: () => { st.asof = s.created; st.hi = null; rerender(r, 'ledger.asof.back'); } })))) : null,
        st.asof ? btn('Back to today', { kind: 'reversible', testid: 'ledger.asof.back', onClick: () => { st.asof = null; st.hi = null; announce('Back to today'); rerender(r, 'ledger.asof'); } }) : null),
      hint,
      st.asof ? h('div', { class: 'ledger-changed' }, h('h3', { text: 'What changed since ' + shortDate(st.asof) }), later.length ? h('ul', { class: 'ledger-list' }, later.map((e) => h('li', null, shortDate(e.posted) + ' ', KIND_WORD[e.kind] || humanize(e.kind), ' ', h('b', { text: money(e.amountCents) }), ' · ' + reasonText(e, false) + ' · ' + actorText(e)))) : h('p', { class: 'muted', text: 'Nothing posted after this date' })) : null);
  }

  function renderLedger(r) {
    const pid = r.id; const p = Proto.store.patient(pid);
    if (!p) { Proto.screens.shell.mount(h('div', { class: 'stack' }, h('h1', { text: 'No patient with that id' }), btn('Back to home', { kind: 'quiet', testid: 'ledger.back', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) }))); return; }
    if (rail.pid !== pid) open(pid, r); else { rail.r = r; renderRail(); }
    const st = ledState(pid); const priv = !!P().privacy; const all = rowsFor(pid);
    const rows = st.asof ? all.filter((e) => e.posted <= st.asof) : all;
    const live = Proto.store.balances(pid);
    const b = st.asof ? Object.assign(sumsFrom(rows), { insurancePending: live.insurancePending }) : live;
    const gateNode = st.gate ? refusal(Object.assign({ onControl: () => { st.gate = null; rerender(r, 'ledger.statement.send'); } }, st.gate)) : null;
    const page = h('div', { class: 'stack ledger-page' },
      pageHead('Ledger', displayName(p.name, priv) + ' · ' + identLine(p, priv) + ' · ' + p.mrn,
        btn('Explain', { kind: 'reversible', testid: 'ledger.explain', pressed: pressed(st.explain), onClick: () => { st.explain = !st.explain; rerender(r, 'ledger.explain'); } }),
        btn('Show patient', { kind: 'reversible', testid: 'ledger.showpatient', pressed: pressed(st.patientVoice), ariaLabel: st.patientVoice ? 'Patient view on. Switch back to the staff view' : 'Show the patient view: same rows, plain words, no reason codes or poster names', onClick: () => { st.patientVoice = !st.patientVoice; if (st.patientVoice) st.explain = true; rerender(r, 'ledger.showpatient'); } }),
        btn('Send to biller', { kind: 'reversible', testid: 'ledger.sendbiller', onClick: () => sendBiller(r, pid, st) }),
        btn(st.asof ? 'As of ' + shortDate(st.asof) + ' · by posted date' : 'As of today · by posted date', { kind: 'quiet', testid: 'ledger.asof', pressed: pressed(st.asofOpen), ariaLabel: (st.asof ? 'Showing the ledger as of ' + longDate(st.asof) : 'Showing the ledger as of today') + ', by posted date. Choose another date', onClick: () => { st.asofOpen = !st.asofOpen; rerender(r, st.asofOpen ? 'ledger.asof.date' : 'ledger.asof'); } })),
      st.asof ? h('p', { class: 'ledger-asofline', role: 'status', text: 'As of ' + shortDate(st.asof) + ': ' + rows.length + ' of ' + all.length + ' rows, posted on or before ' + longDate(st.asof) + '. Waiting on insurance reflects today\'s claims.' }) : null,
      section('Balance', threeNum(b, st.patientVoice ? ['You owe', 'Waiting on insurance', 'Credit'] : null),
        st.explain ? explainBlock(pid, st, r) : h('p', { class: 'small muted', text: 'Explain renders one sentence per open procedure from the rows below; Show patient says the same thing in the patient\'s words.' }),
        st.biller ? h('div', { class: 'ledger-biller row' }, chip('info', 'Sent to biller'), h('span', { class: 'grow' }, boldAmounts(st.biller)), btn('Undo', { kind: 'reversible', class: 'compact', testid: 'ledger.sendbiller.undo', onClick: () => { st.biller = null; announce('Money Desk row withdrawn'); rerender(r, 'ledger.sendbiller'); } })) : null),
      st.asofOpen ? section('As of', asOfBlock(pid, st, r, all)) : null,
      section('Rows', h('p', { class: 'small muted', text: 'Newest first by posted date. Reversals and reposts name the row they correct; nothing is edited in place.' }), ledgerTable(rows, st)),
      section('Statement',
        st.sent ? h('div', { class: 'ledger-sent row' }, chip('clear', 'Sent'), h('span', { text: 'Statement ' + st.sent.id + ' frozen and sent by ' + st.sent.channel + ' on ' + longDate(today()) + (st.sent.local ? '' : '; disclosure row written') })) : null,
        gateNode,
        h('div', { class: 'btnrow' },
          btn(st.gate ? 'Held' : 'Send statement', { kind: st.gate ? 'held' : 'irreversible', testid: 'ledger.statement.send', ariaLabel: st.gate ? 'Send statement is held: ' + st.gate.verb : 'Send the statement by mail; this freezes it with an id', onClick: () => sendStatement(r, pid, st) }),
          btn('Preview', { kind: 'reversible', testid: 'ledger.statement.preview', onClick: () => previewStatement(pid, st) })),
        h('details', { class: 'ledger-details' }, h('summary', { testid: 'ledger.statement.why' }, 'What a statement contains'), h('p', { class: 'muted', text: 'The patient-voice sentences under three numbers; pending claims listed under Waiting on insurance with no patient dollar figure; family members by first name. Send freezes the statement with an id and writes a disclosure row per channel. A balance still waiting on insurance holds for a stated reason.' }))));
    Proto.screens.shell.mount(page);
  }
  function rerender(r, focusTestid) {
    renderLedger(r); Proto.screens.shell.refreshAndon(r);
    if (focusTestid) { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el && el.focus) el.focus(); }
  }

  /* The rail persists across routes: keep it current on navigation and when privacy mode flips. */
  window.addEventListener('hashchange', () => { const r = Proto.router.current(); if (r.route === 'signin') { close(); return; } if (isOpen()) { rail.r = r; rail.msg = null; renderRail(); } });
  if (window.MutationObserver) new MutationObserver(() => { if (isOpen()) renderRail(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-privacy'] });

  Proto.screens.rail = { open, close, isOpen, render(r) { if (r) rail.r = r; if (isOpen()) renderRail(); }, button };
  Proto.screens.ledger = { render: renderLedger };
  Proto.router.on('ledger', (r) => Proto.screens.ledger.render(r));
})();
