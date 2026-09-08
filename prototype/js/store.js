/* In-memory store. Every mutation appends rows (never edits money rows), emits a write event,
   and returns either {ok:true, ...} or a refusal {ok:false, code, verb, control, why}. */
(function () {
  const Proto = (window.Proto = window.Proto || {});
  let S = null;
  // Every prefix write() uses starts here; seeded tables (credits cr-1, ERA lines el-1..41) start past their seed ids.
  const ID_START = { le: 5000, cd: 1, ar: 1, pe: 2, ce: 1, pr: 500, tag: 2, nf: 1, dc: 1, cl: 100, ap: 1, ue: 1, dp: 1, dec: 2, msg: 1, ai: 1, ae: 1, el: 100, al: 1, sd: 3, pp: 1, de: 1, cr: 2, cev: 1, pl: 1, dis: 1, rm: 1, dep: 1, ses: 1 };
  let nextId = Object.assign({}, ID_START);
  const id = (p) => { if (!Number.isFinite(nextId[p])) nextId[p] = 1; return p + '-' + (nextId[p]++); };

  function reset(seedNum) {
    S = Proto.seed.build(seedNum);
    nextId = Object.assign({}, ID_START);
    S.chartEvents = []; S.planItems = []; S.notes = {}; S.filedNotes = [];
    S.collectionDecisions = [{ id: 'cd-0', encounterId: 'enc-9010', decision: 'collect', patientPortionCents: 9500, decidedBy: 'Priya Raman', decidedAt: S.tenant.today + ' 07:52', statementDueId: null, paymentPlanId: null }];
    S.allocationIntents = [{ id: 'ai-0', paymentId: 'le-window-9010', encounterId: 'enc-9010', amountCents: 9500 }]; S.allocations = []; S.dayPasses = []; S.controlDecisions = []; S.disclosures = []; S.railState = {}; S.appealPackets = []; S.messages = []; S.sessions = [];
    S.clock = { time: '08:40', afterHours: false };
    return S;
  }
  const get = () => S;
  const write = (table, row) => { S[table].push(row); Proto.events.write(table, row.id); return row; };
  /* An edit in place is still a change to that table, so it is logged too (A3). The audit found 23 of 41
     driven mutations changing a row without any event for its table, which made the log unreadable as evidence. */
  const touch = (table, id) => { Proto.events.write(table, id); return id; };
  const refuse = (code, verb, control, why) => ({ ok: false, code, verb, control, why });
  /* Every posting verb refuses while the Andon says the server is unreachable. Before, only Arrive and Post
     checked, so Confirm, Send statement, Save exam, Close day, File and Issue day pass all wrote during an outage. */
  const OFFLINE_WHY = 'Nothing posts while the server is unreachable: the controls that gate money and records cannot be enforced without it.';
  const offline = (verb) => (S.outage ? refuse('outage', verb, 'Support line', OFFLINE_WHY) : null);

  // Lookups
  const patient = (pid) => S.patients.find((p) => p.id === pid);
  const appt = (aid) => S.appointments.find((a) => a.id === aid);
  const encounter = (eid) => S.encounters.find((e) => e.id === eid);
  const user = (uid) => S.users.find((u) => u.id === uid);
  const carrierName = (cid) => (S.carriers.find((c) => c.id === cid) || {}).name || '—';
  const NOT_FOUND = { appointment: 'Open a scheduled appointment', encounter: 'Open a chart from the Board', patient: 'Search for the patient', claim: 'Open a claim from Money Desk', request: 'Open a request from Approvals' };
  const notFound = (what) => refuse('notfound', 'Open ' + what + ' from a list', NOT_FOUND[what] || 'Go back', 'The id in the address does not name a row in this practice. Nothing was read and nothing was written.');
  /* A temp with no day pass is nobody: the pass is the identity, so until Roles issues one the persona carries no
     name and no entitlement, and every gate that needs one refuses instead of posting as a hard-coded "Alex Rivera". */
  const NO_PASS = { id: 'u-temp', name: 'No day pass issued', short: 'No day pass', role: 'temp', entitlements: [], noPass: true };
  const currentUser = () => { const p = window.__proto && window.__proto.persona; if (p === 'temp') return S.tempUser || NO_PASS; return user(S.personaUser[p]) || S.users[0]; };
  /* One actor test for every posting verb: a temp without a pass is nobody, and a seat posts only through
     the entitlement it carries. The gate is the same wherever the money moves, so no verb is the soft one. */
  const ENTITLEMENT_WORDS = { post_payment: 'post payments', write_off: 'write off balances', post_era: 'post an ERA', approve_second: 'approve as a second', close_day: 'close the day', schedule: 'work the schedule' };
  function actorGate(u, entitlement, doing) {
    if (u.noPass) return refuse('entitlement', 'Issue a day pass before posting', 'Open Roles', 'A temp posts under their own day pass. Until Roles issues one there is no identity to freeze onto the posting.');
    const need = entitlement ? [].concat(entitlement) : [];
    if (need.length && !need.some((e) => (u.entitlements || []).includes(e))) return refuse('entitlement', 'Ask a seat that can ' + (ENTITLEMENT_WORDS[need[0]] || need[0]), 'Open approvals', (doing || 'This') + ' is held to the seats that carry the ' + need.map((e) => e.replace(/_/g, ' ')).join(' or ') + ' entitlement; yours (' + (u.entitlements || []).map((e) => e.replace(/_/g, ' ')).join(', ') + ') does not. Nothing was written.');
    return null;
  }
  /* Every ledger row lands on a day; a day that is closed stays closed. A row posted after the close is marked
     as late and keeps the frozen totals honest instead of growing them silently. */
  function stampClose(row) {
    const dc = S.dayCloses.find((d) => d.locationId === row.locationId && d.date === row.effective);
    if (dc) { row.postedAfterClose = true; row.closedDayId = dc.id; row.postedAt = S.clock.time; }
    return row;
  }
  const ALLOWED_FROM = { arrive: ['scheduled', 'confirmed'], seat: ['arrived'], readyForExam: ['seated', 'in_chart'], checkout: ['arrived', 'seated', 'in_chart', 'ready_for_exam', 'note_filed'] };
  function statusGate(a, verb, next) {
    if (a.status === next) return refuse('already_decided', 'Nothing to do — already ' + next.replace(/_/g, ' '), 'Open the chart', 'This visit is already ' + next.replace(/_/g, ' ') + '. Doing it again would write a second event for a row that did not change.');
    if (!ALLOWED_FROM[verb].includes(a.status)) return refuse('wrong_status', 'Open the visit — it is ' + a.status.replace(/_/g, ' '), 'Open the visit', 'A visit moves forward one step at a time: ' + ALLOWED_FROM[verb].map((s) => s.replace(/_/g, ' ')).join(' or ') + ' comes before ' + next.replace(/_/g, ' ') + '. This one is ' + a.status.replace(/_/g, ' ') + ', so nothing was written.');
    return null;
  }

  // Balances: three numbers from ledger rows; estimates never join.
  /* One allocation pass serves both the three numbers and Explain, so they cannot disagree: every payment,
     write-off and reversal is applied to open charges oldest first, and each charge knows what reached it.
     Before, balances() called every charge patient-due (a visit awaiting insurance read $183.00 when the
     patient owed nothing) and explain() subtracted every later payment from every earlier charge, so 14 of
     40 patients had an Explain total that disagreed with the Patient due above it. */
  function allocate(pid) {
    const rows = S.ledger.filter((e) => e.patientId === pid).slice().sort((a, b) => String(a.effective).localeCompare(String(b.effective)) || String(a.id).localeCompare(String(b.id)));
    const charges = rows.filter((e) => e.kind === 'charge').map((ch) => ({ row: ch, open: ch.amountCents, applied: [] }));
    const claimFor = (ch) => S.claims.find((c) => c.patientId === pid && c.cdt === ch.cdt && ['submitted', 'pended'].includes(c.status));
    const expected = (ch) => (Number.isFinite(ch.insuranceExpectedCents) ? ch.insuranceExpectedCents : null);
    // A charge the plan is expected to cover waits on insurance, not on the patient. The expected share is
    // written onto the charge when it is released (from the visit's estimate); a claim that is still out is
    // the fallback. The split is made before any money lands, so a patient payment reaches only the
    // patient's own share and the payer's share stays waiting on the payer.
    for (const c of charges) {
      const exp = expected(c.row);
      const claim = exp == null ? claimFor(c.row) : null;
      c.ins = Math.min(c.open, exp != null ? exp : claim ? Math.round(c.row.amountCents * 0.5) : 0);
      c.pat = c.open - c.ins;
    }
    const isInsuranceSide = (e) => e.kind === 'insurance_payment' || (e.kind === 'write_off' && (e.eraLineId || e.reason === 'contractual_ppo'));
    const drain = (c, side, rem) => { const take = Math.min(rem, c[side]); c[side] -= take; c.open -= take; return take; };
    let unapplied = 0;
    for (const e of rows) {
      if (e.kind === 'charge') continue;
      if (e.amountCents > 0) {                        // a reversal is positive and re-opens the last charge it reached
        const orig = e.reversesEntryId ? rows.find((x) => x.id === e.reversesEntryId) : null;
        const back = charges.slice().reverse().find((c) => c.applied.length);
        if (back) { back.open += e.amountCents; back[orig && isInsuranceSide(orig) ? 'ins' : 'pat'] += e.amountCents; back.applied.push(e); } else unapplied -= e.amountCents;
        continue;
      }
      let rem = -e.amountCents;                       // credits are stored negative
      const order = isInsuranceSide(e) ? ['ins', 'pat'] : ['pat', 'ins'];
      for (const side of order) for (const c of charges) { if (rem <= 0) break; if (c[side] <= 0) continue; const took = drain(c, side, rem); if (took > 0) { rem -= took; if (!c.applied.includes(e)) c.applied.push(e); } }
      // Money that found no open charge stays with the patient as credit; it is never dropped and never
      // reported as paid in full.
      if (rem > 0) unapplied += rem;
    }
    const patientDue = charges.reduce((s, c) => s + Math.max(0, c.pat), 0);
    const insurancePending = charges.reduce((s, c) => s + Math.max(0, c.ins), 0);
    let credit = Math.max(0, unapplied);
    for (const cr of S.credits) if (cr.patientId === pid && !cr.fromLedger && !cr.applied) credit += -cr.amountCents;
    return { charges, patientDue, insurancePending, credit };
  }
  function balances(pid) { const a = allocate(pid); return { patientDue: a.patientDue, insurancePending: a.insurancePending, credit: a.credit }; }
  /* A procedure is charged when the ledger says so, whatever its flag claims. */
  const charged = (p) => !!p.charged || S.ledger.some((e) => e.kind === 'charge' && e.procedureId === p.id);
  /* The procedures a visit still stands on. A reversed row stays in the chart's history and never reaches the
     ledger, the claim, the estimate or the checkout table: one list for every path that bills the visit. */
  const liveProcedures = (encId) => S.procedures.filter((p) => p.encounterId === encId && !p.reversed);
  /* What a write-off may forgive: the ledger's open patient balance plus the charges this visit is about to
     post (a filed note releases them at checkout). One ceiling for the desk, the checkout and the approver. */
  function openCeiling(pid, encId) {
    const enc = encId ? encounter(encId) : null;
    const pending = enc && enc.noteFiled ? liveProcedures(encId).filter((p) => !charged(p)).reduce((t, p) => t + p.feeCents, 0) : 0;
    return balances(pid).patientDue + pending;
  }
  function explain(pid) {
    const out = [];
    for (const c of allocate(pid).charges) {
      const ch = c.row;
      const ins = c.applied.filter((e) => e.kind === 'insurance_payment');
      const wo = c.applied.filter((e) => e.kind === 'write_off');
      const pp = c.applied.filter((e) => e.kind === 'patient_payment');
      const name = ch.cdt ? (S.cdt[ch.cdt] || [ch.cdt])[0] + (ch.tooth ? ' #' + ch.tooth : '') : 'Visit';
      // One date shape per sentence: the charge and every payment in it read the same way.
      const parts = [name + ' on ' + Proto.ui.longDate(ch.effective) + ': charge ' + Proto.ui.money(ch.amountCents)];
      ins.forEach((e) => parts.push(e.payer + ' paid ' + Proto.ui.money(-e.amountCents) + ' on ' + Proto.ui.longDate(e.effective)));
      wo.forEach((e) => parts.push('contractual write-off ' + Proto.ui.money(-e.amountCents) + ' (' + (e.reason || 'PPO fee').replace(/_/g, ' ') + ')'));
      pp.forEach((e) => parts.push('you paid ' + Proto.ui.money(-e.amountCents) + ' on ' + Proto.ui.longDate(e.effective)));
      const owe = c.open;
      parts.push(owe > 0 ? 'you owe ' + Proto.ui.money(owe) : owe < 0 ? 'credit ' + Proto.ui.money(-owe) : 'paid in full');
      out.push({ chargeId: ch.id, sentence: parts.join('; ') + '.', patientVoice: name + ': ' + (owe > 0 ? 'Your share is ' + Proto.ui.money(owe) + ' after insurance.' : 'Nothing left to pay.') });
    }
    return out;
  }

  // Board
  function arrive(aid) {
    const a = appt(aid); if (!a) return notFound('appointment');
    const off = offline('Wait for the server — the Board is read-only'); if (off) return off;
    const who = actorGate(currentUser()); if (who) return who;
    const st = statusGate(a, 'arrive', 'arrived'); if (st) return st;
    a.status = 'arrived'; a.arrivedAt = S.clock.time; touch('appointments', aid);
    write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'appointment.arrived', actor: currentUser().name });
    if (a.eligibility === 'amber') a.eligibilityRerun = 'running';
    retireChip('arrive');
    return { ok: true };
  }
  function seat(aid) { const a = appt(aid); if (!a) return notFound('appointment'); const off = offline('Wait for the server — the Board is read-only'); if (off) return off; const who = actorGate(currentUser()); if (who) return who; const st = statusGate(a, 'seat', 'seated'); if (st) return st; a.status = 'seated'; touch('appointments', aid); write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'appointment.seated', actor: currentUser().name }); retireChip('seat'); return { ok: true }; }
  function reverify(aid) { const a = appt(aid); if (!a) return notFound('appointment'); const off = offline('Wait for the server — eligibility cannot re-run'); if (off) return off; a.eligibility = 'green'; a.eligibilityNote = '270/271 re-run at ' + S.clock.time + ': active, deductible met'; touch('appointments', aid); write('eligibilityChecks', { id: id('el'), appointmentId: aid, result: 'active' }); return { ok: true }; }
  function pingChair(aid) {
    const a = appt(aid); if (!a) return notFound('appointment');
    const off = offline('Wait for the server — messages are paused'); if (off) return off;
    // Rate-limit this chair, not the message list: the old check looked at the last two messages overall,
    // so pinging a second chair in between let the same chair be pinged again inside the window.
    const mine = S.messages.filter((m) => m.appointmentId === aid && m.kind === 'board.ping_chair');
    const last = mine[mine.length - 1];
    const minutes = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
    const now = S.tenant.today + ' ' + S.clock.time;
    const since = last ? (last.pingedDate === S.tenant.today ? minutes(S.clock.time) - minutes(last.pingedAt) : Infinity) : Infinity;
    if (last && since >= 0 && since < 15) return refuse('ping_rate', 'Wait 15 minutes — chair already pinged', 'Open the chart', 'One ping per encounter per 15 minutes keeps the operatory usable. Open the chart to see what the writer has so far.');
    write('messages', { id: id('msg'), appointmentId: aid, kind: 'board.ping_chair', to: 'chair ' + a.op, pingedDate: S.tenant.today, pingedAt: S.clock.time, at: now });
    return { ok: true };
  }

  // Checkout (flow 4). decision: collect | send_statement | payment_plan | zero_due
  const DECISIONS = ['collect', 'send_statement', 'payment_plan', 'zero_due'];
  const TENDERS = ['card', 'cash', 'check', 'hsa'];
  const cents = (v) => Number.isInteger(v) && v >= 0;
  // The patient portion of a visit is one number for the screen and the posting: the plan estimate, capped by
  // what the ledger still says is open plus the visit's charges not yet posted. A write-off that landed on the
  // ledger lowers it everywhere at once.
  function patientPortion(aid) {
    const a = appt(aid); if (!a) return null;
    const seed = S.estimates[aid] || { patientCents: a.balanceCents || 0, insuranceCents: 0, writeoffCents: 0, note: 'No plan estimate on file; the patient portion shown is the appointment balance.' };
    const notYetCharged = liveProcedures(a.encounterId).filter((p) => !charged(p)).reduce((t, p) => t + p.feeCents, 0);
    const collectible = balances(a.patientId).patientDue + notYetCharged;
    return Object.assign({}, seed, { patientCents: Math.max(0, Math.min(seed.patientCents, collectible)) });
  }
  function postCheckout(aid, form) {
    const a = appt(aid); if (!a) return notFound('appointment');
    form = form || {};
    const est = patientPortion(aid);
    let u = currentUser();
    const off = offline('Wait for the server — postings are paused'); if (off) return off;
    const who = actorGate(u, 'post_payment', 'Posting at the window'); if (who) return who;
    // The form is data from a screen; the verb keeps its own contract, so a malformed field refuses instead
    // of landing on the ledger.
    if (!DECISIONS.includes(form.decision)) return refuse('invalid_input', 'Choose a decision before posting', 'Nothing due today', 'The visit closes with one of four typed decisions: collect, send statement, payment plan, or nothing due today. "' + String(form.decision) + '" is none of them, so nothing was written.');
    if (form.decision === 'collect' && form.amountCents != null && !(cents(form.amountCents) && form.amountCents > 0)) return refuse('amount_required', 'Type an amount above zero', 'Go to amount', 'A payment is a whole number of cents above zero. "' + String(form.amountCents) + '" is not, so nothing was written. To take nothing at the window, choose Nothing due today.');
    if (form.decision === 'collect' && form.tender && !TENDERS.includes(form.tender)) return refuse('tender_required', 'Choose a tender the bank knows', 'Choose card', 'The day sheet reconciles card, cash, check and HSA against the bank. "' + String(form.tender) + '" is not one of them, so nothing was written.');
    if (form.writeoffCents != null && form.writeoffCents !== 0 && !(Number.isInteger(form.writeoffCents) && form.writeoffCents > 0)) return refuse('amount_required', 'Type the write-off in whole cents', 'Go to amount', 'A write-off is a whole number of cents above zero. "' + String(form.writeoffCents) + '" is not, so nothing was written.');
    if (S.collectionDecisions.some((d) => d.encounterId === a.encounterId)) return refuse('already_decided', 'Correct this visit from the ledger', 'Open the ledger', 'One typed decision per visit. To change what was collected, post a correction from the ledger: a reversal and a repost, both linked to the original.');
    const st = statusGate(a, 'checkout', a.encounterId && encounter(a.encounterId) && encounter(a.encounterId).noteFiled ? 'checked_out' : 'checked_out_unfiled'); if (st) return st;
    if (form.decision === 'collect' && est.patientCents === 0) return refuse('zero_collect_refused', 'Choose Nothing due today', 'Nothing due today', 'Collect with $0 writes nothing; the typed decision keeps the window honest.');
    if (form.decision === 'collect' && !form.tender) return refuse('tender_required', 'Choose a tender', 'Choose card', 'The tender is what the day sheet reconciles against the bank, so a payment cannot post without one.');
    const encId = a.encounterId; const enc = encounter(encId);
    const procs = liveProcedures(encId);
    const foreign = (form.selfPay || []).filter((pid) => !procs.some((p) => p.id === pid));
    if (foreign.length) return refuse('invalid_input', 'Choose a procedure from this visit', 'Open the chart', 'Self-pay restriction marks a procedure of this visit. ' + foreign.join(', ') + ' belongs to another chart, so nothing was written.');
    // Shared desk: the PIN names the poster. It must match a seat that can post; the seat's own session is
    // minted only once every gate below has passed, so a refused or held Post leaves no sessions row behind.
    let pinSeat = null;
    if (window.__proto.device === 'shared') {
      const pin = String(form.pin == null ? '' : form.pin).trim();
      if (!pin) return refuse('pin_required', 'Enter your PIN to post', 'Enter PIN', 'Shared desk: the PIN mints your own session, so the posting carries your name and not the last person\'s.');
      const match = S.users.find((x) => x.pin === pin);
      if (!match) return refuse('pin_no_match', 'Try your PIN again — no match', 'Enter PIN', 'The PIN did not match any seat in this practice, so there is no name to freeze onto the posting. Nothing was written.');
      u = pinSeat = match;
      const seat2 = actorGate(u, 'post_payment', 'Posting at the window'); if (seat2) return seat2;
    }
    // Write-off gate (dual release inside the posting transaction). The request row is written when the
    // biller presses Request approval, not here: writing it at Post created an approval nobody asked for
    // and left the control itself a no-op.
    if (form.writeoffCents && form.writeoffCents > 0) {
      const seat = actorGate(u, 'write_off', 'A write-off'); if (seat) return seat;
      const ceiling = openCeiling(a.patientId, encId);
      if (form.writeoffCents > ceiling) return refuse('amount_required', 'Type a write-off within the balance', 'Go to amount', 'This account has ' + Proto.ui.money(ceiling) + ' open once this visit posts. A write-off above that would push the ledger negative, so nothing was written.');
      const gate = evaluateRelease('write_off', form.writeoffCents, u, a.patientId);
      if (!gate.ok) return Object.assign(refuse(gate.code, gate.verb, 'Request approval', gate.why), { held: true, pendingRequest: { kind: 'write_off', amountCents: form.writeoffCents, reason: form.writeoffReason || 'courtesy', patientId: a.patientId, eligible: gate.eligible, appointmentId: aid, form } });
    }
    if (pinSeat) { const session = openSession(pinSeat.id); if (!session.ok) return session; }
    // Post: charges (if note filed), payment, allocations, decision, self-pay flags in one transaction
    const noteFiled = enc && enc.noteFiled;
    const rows = [];
    // charged() is the ledger, not a flag: the seed marks a crown "completed" without setting charged, so the
    // old test re-charged it and a patient who paid $410 in full walked out owing $1,180.
    const toCharge = noteFiled ? procs.filter((p) => !charged(p)) : [];
    const feeTotal = toCharge.reduce((s, p) => s + p.feeCents, 0);
    for (const p of toCharge) { p.charged = true; touch('procedures', p.id); rows.push(write('ledger', stampClose({ id: id('le'), kind: 'charge', patientId: a.patientId, amountCents: p.feeCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, procedureId: p.id, cdt: p.cdt, tooth: p.tooth, insuranceExpectedCents: feeTotal ? Math.round((est.insuranceCents || 0) * p.feeCents / feeTotal) : 0 }))); }
    let pay = null;
    if (form.decision === 'collect') {
      const amt = form.amountCents != null ? form.amountCents : est.patientCents;
      pay = write('ledger', stampClose({ id: id('le'), kind: 'patient_payment', patientId: a.patientId, amountCents: -amt, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, tender: form.tender, gl: noteFiled ? 'patient_ar' : 'unapplied_credit' }));
      if (noteFiled) { let rem = amt; for (const r of rows) { if (rem <= 0) break; const alloc = Math.min(rem, r.amountCents); write('allocations', { id: id('al'), paymentId: pay.id, chargeId: r.id, amountCents: alloc }); rem -= alloc; } }
      else write('allocationIntents', { id: id('ai'), paymentId: pay.id, encounterId: encId, amountCents: amt });
    }
    if (form.decision === 'send_statement') write('statementsDue', { id: id('sd'), patientId: a.patientId, encounterId: encId, amountCents: est.patientCents, reason: 'window_deferred', createdBy: u.name, created: S.tenant.today });
    if (form.decision === 'payment_plan') write('paymentPlans', { id: id('pp'), patientId: a.patientId, amountCents: est.patientCents, cadence: form.cadence || 'monthly', eligibleBucket: 'patient_ar', createdBy: u.name });
    for (const pid of form.selfPay || []) { const p = S.procedures.find((x) => x.id === pid); if (p) { p.selfPayRestricted = true; p.restrictedAt = S.tenant.today; write('domainEvents', { id: id('de'), type: 'procedure.self_pay_restricted', procedureId: pid }); } }
    if (form.writeoffCents > 0) {
      write('ledger', stampClose({ id: id('le'), kind: 'write_off', patientId: a.patientId, amountCents: -form.writeoffCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, reason: form.writeoffReason || 'courtesy', approvalRequestId: form.approvalRequestId || null }));
      supersedePending(a.patientId, form.writeoffCents, form.approvalRequestId);
    }
    write('collectionDecisions', { id: 'cd-' + nextId.cd++, encounterId: encId, decision: form.decision, patientPortionCents: est.patientCents, decidedBy: u.name, decidedAt: S.tenant.today + ' ' + S.clock.time, statementDueId: null, paymentPlanId: null });
    a.status = noteFiled ? 'checked_out' : 'checked_out_unfiled'; touch('appointments', aid);
    // A payment taken before the note is filed waits as credit; a decision that collected nothing has no credit to wait.
    if (!noteFiled && pay && !S.credits.find((c) => c.patientId === a.patientId && c.reason.includes(aid))) write('credits', { id: id('cr'), patientId: a.patientId, amountCents: pay.amountCents, reason: 'Checked out unfiled: payment waiting for charges (' + aid + ')', intents: 'pending charges on ' + encId, fromLedger: true });
    retireChip('checkout'); if (form.decision === 'collect') retireChip('payment');
    return { ok: true, taps: 0 };
  }
  /* Written when the biller presses Request approval, so the control does the thing its label promises. */
  function requestApproval(pending) {
    if (!pending) return notFound('request');
    const off = offline('Wait for the server — approvals are paused'); if (off) return off;
    const u = currentUser();
    const open = S.approvals.find((x) => x.status === 'pending' && x.kind === pending.kind && x.patientId === pending.patientId && x.amountCents === pending.amountCents);
    if (open) return { ok: true, requestId: open.id, already: true };
    const req = write('approvals', Object.assign({ id: 'ar-' + nextId.ar++, requestedBy: u.name, requestedById: u.id, status: 'pending', requestedAt: S.clock.time }, pending));
    return { ok: true, requestId: req.id };
  }
  /* The frozen sentence is built at read time so privacy mode can hide the name on operatory glass; storing
     the finished string put "Lena Fischer" verbatim into the Andon, Daily Close and Money Desk under privacy. */
  function approvalSentence(req) {
    if (!req) return '';
    const who = patient(req.patientId);
    const name = who ? Proto.ui.displayName(who.name, !!(window.__proto && window.__proto.privacy)) : 'this account';
    const open = req.patientId ? openCeiling(req.patientId, (appt(req.appointmentId) || {}).encounterId) : null;
    return 'Write-off ' + Proto.ui.money(req.amountCents) + ' on ' + name + ' (' + (req.reason || 'courtesy') + ') requested by ' + req.requestedBy + ' at ' + Proto.ui.time(req.requestedAt || S.clock.time) + (open == null ? '' : ' · ' + Proto.ui.money(open) + ' still open');
  }

  // Dual release evaluator (precog evaluateRelease, simplified)
  /* A write-off that lands while a request for it is still pending closes that request: one decision, one
     row. A request the approver reaches later then finds nothing left to post. */
  function supersedePending(pid, amountCents, requestId) {
    for (const r of S.approvals) {
      if (r.kind !== 'write_off' || r.patientId !== pid || r.status !== 'pending' || r.id === requestId) continue;
      r.status = 'superseded'; r.decidedAt = S.clock.time; r.decisionReason = 'Write-off of ' + Proto.ui.money(amountCents) + ' posted directly'; touch('approvals', r.id);
    }
  }
  const openDenial = (pid) => S.claims.find((c) => c.patientId === pid && c.status === 'denied' && !S.appealPackets.some((p) => p.claimId === c.id && p.sent));
  function evaluateRelease(channel, amountCents, actor, pid) {
    const threshold = S.tenant.dualReleaseThresholdCents;
    const RANK = { office_manager: 0, owner: 1, dentist: 2, surgeon: 3 };
    const eligible = S.users.filter((x) => x.entitlements.includes('approve_second') && x.id !== actor.id)
      .sort((a, b) => (RANK[a.role] == null ? 9 : RANK[a.role]) - (RANK[b.role] == null ? 9 : RANK[b.role]))
      .map((x) => x.short);
    if (S.clock.afterHours && ['write_off', 'refund', 'adjustment'].includes(channel)) return { ok: false, code: 'after_hours', verb: 'Held until 7:30 am — after hours', why: 'Refunds, adjustments, and write-offs outside business hours are held regardless of amount. Policy set by Dr. Reagan, reviewed 8/4.', eligible };
    if (amountCents >= threshold) return { ok: false, code: 'needs_second', verb: 'Needs a second approver — ' + eligible.slice(0, 2).join(' or '), why: 'Write-offs at or above ' + Proto.ui.money(threshold) + ' need a distinct second approver (control policy v3, set by Dr. Reagan on 8/4, review due 9/1). Approvals here usually take about 4 minutes.', eligible };
    // An account with an open denial routes every write-off through dual release: writing the balance off
    // is how a denial disappears without an appeal, whatever the amount.
    const denial = channel === 'write_off' && pid ? openDenial(pid) : null;
    if (denial) return { ok: false, code: 'needs_second', verb: 'Needs a second approver — claim denied', why: 'Claim ' + denial.id + ' on this account is denied and not yet appealed. A write-off here at any amount needs a distinct second approver, so the denial is decided on the record and not written away.', eligible };
    return { ok: true, code: 'below_threshold', eligible };
  }
  /* An approver who sends a request back says why: the biller reads the reason on the write-off card, and
     without it the card could name who sent it back but not their line. The reason rides on the request and
     on the log row, so the decision and its reason are one record. */
  function decideApproval(reqId, approverId, decision, stepup, reason) {
    const r = S.approvals.find((x) => x.id === reqId); if (!r) return notFound('request');
    const off = offline('Wait for the server — approvals are paused'); if (off) return off;
    // The second approver is whoever holds this session; a name passed in is not an identity.
    const approver = currentUser();
    const who = actorGate(approver, 'approve_second', 'A second approval'); if (who) return who;
    if (r.requestedById === approver.id) return refuse('blocked_same_person', 'Ask someone else to approve this', 'Send back', 'You requested it, so you cannot be its second approver. The rule is enforced on the posting itself, not just on this screen.');
    if (Array.isArray(r.eligible) && r.eligible.length && !r.eligible.includes(approver.short) && !r.eligible.includes(approver.name)) return refuse('entitlement', 'Ask a listed approver to decide this', 'Open approvals', 'The request names who may second it (' + r.eligible.join(', ') + '); you are not on that list, so nothing was written.');
    if (!['approved', 'declined', 'sent_back'].includes(decision)) return refuse('invalid_input', 'Choose approve or send back', 'Send back', 'A request is approved or sent back; "' + String(decision) + '" is neither, so nothing was written.');
    // A step-up is a challenge, not a refusal: it carries no gate identity and never reached the shared component.
    if (!stepup) return { ok: false, needsStepup: true, verb: 'Enter your PIN to approve', why: 'Approvals above the high-value band re-verify within two minutes.' };
    if (r.status && r.status !== 'pending') return refuse('already_decided', 'Open the ledger to correct this', 'Open the ledger', 'This request was already ' + r.status + ' by ' + (r.decidedBy || 'someone') + '. Deciding it twice would post the write-off twice; a correction is a reversal and a repost.');
    // The reason rides on the request and on the log row, so the decision and its reason are one record. It is
    // carried, not yet required: the control that collects it lives on the approver's card, which the phone
    // screen has still to grow, and a gate on a word the product does not use yet would guard nothing.
    const why = String(reason || '').trim();
    // The balance is read when the approval lands, not when it was asked for: a write-off never exceeds
    // what is still open, and a balance already written off has nothing left to approve.
    let amount = r.amountCents;
    if (decision === 'approved' && r.kind === 'write_off') {
      if (S.ledger.some((e) => e.kind === 'write_off' && e.approvalRequestId === reqId)) return refuse('already_decided', 'Open the ledger to correct this', 'Open the ledger', 'The write-off for this request is already on the ledger. Posting it again would double it; a correction is a reversal and a repost.');
      const open = openCeiling(r.patientId, (appt(r.appointmentId) || {}).encounterId);
      if (open <= 0) return refuse('amount_required', 'Nothing left to write off', 'Open the ledger', 'This account\'s open balance is ' + Proto.ui.money(0) + ': the write-off was already posted or the balance was paid. Approving would write off money nobody owes.');
      amount = Math.min(r.amountCents, open);
    }
    r.status = decision; r.decidedBy = approver.name; r.decidedAt = S.clock.time; if (why) r.decisionReason = why; if (amount !== r.amountCents) r.postedCents = amount; touch('approvals', r.id);
    write('approvalsLog', { id: id('al'), requestId: reqId, decision, by: approver.name, reason: why || null });
    if (decision === 'approved') {
      const a = appt(r.appointmentId);
      write('ledger', stampClose({ id: id('le'), kind: 'write_off', patientId: r.patientId, amountCents: -amount, effective: S.tenant.today, posted: S.tenant.today, actor: r.requestedBy, actorKind: 'user', locationId: a ? a.locationId : 'loc-1', reason: r.reason, approvalRequestId: reqId, secondApprover: approver.name, requestedCents: r.amountCents }));
    }
    return { ok: true, postedCents: decision === 'approved' ? amount : 0 };
  }
  function requestWriteoff(accountPid, amountCents, reason) {
    const u = currentUser();
    if (!patient(accountPid)) return notFound('patient');
    const off = offline('Wait for the server — postings are paused'); if (off) return off;
    const who = actorGate(u, 'write_off', 'A write-off'); if (who) return who;
    if (!Number.isInteger(amountCents) || amountCents <= 0) return refuse('amount_required', 'Type an amount above zero', 'Go to amount', 'A write-off posts the number you type against the balance in whole cents, so it cannot be blank, negative, zero, or a fraction of a cent.');
    // A write-off can only forgive what is owed; the open balance is the ceiling.
    const open = openCeiling(accountPid, null);
    if (amountCents > open) return refuse('amount_required', 'Type an amount within the balance', 'Go to amount', 'This account has ' + Proto.ui.money(open) + ' open. A write-off above that would push the ledger negative, so nothing was written.');
    const gate = evaluateRelease('write_off', amountCents, u, accountPid);
    // The request row is written when the biller presses Request approval, not here.
    if (!gate.ok) return Object.assign(refuse(gate.code, gate.verb, 'Request approval', gate.why), { held: true, pendingRequest: { kind: 'write_off', amountCents, reason, patientId: accountPid, eligible: gate.eligible, appointmentId: null } });
    const loc = S.ledger.filter((e) => e.patientId === accountPid && e.locationId).pop();
    write('ledger', stampClose({ id: id('le'), kind: 'write_off', patientId: accountPid, amountCents: -amountCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: loc ? loc.locationId : 'loc-1', reason }));
    supersedePending(accountPid, amountCents, null);
    return { ok: true };
  }

  // Perio (flow 2)
  const PERIO_MODES = ['full', 'screening'];
  const SCREENING_CODES = ['0', '1', '2', '3', '4', '*'];
  const sitesWord = (n) => n + (n === 1 ? ' site' : ' sites');
  const sealedExam = () => refuse('exam_sealed', 'Add an addendum to change this', 'Start an addendum', 'This visit\'s note is filed, so its chart and exam are sealed. A filed record is never edited in place; a correction is an addendum that supersedes it.');
  /* Every precondition of a perio save, in the order a save would meet them, with nothing written. The screen
     re-runs this against the chart as it stands so a standing gate answers the current condition and clears
     when the condition does. */
  function perioGate(encId, sites, extras) {
    const enc = encounter(encId); if (!enc) return notFound('encounter');
    const off = offline('Wait for the server — the exam cannot save'); if (off) return off;
    if (enc.noteFiled) return sealedExam();
    const mode = (extras && extras.mode) || 'full';
    if (!PERIO_MODES.includes(mode)) return refuse('invalid_input', 'Choose Full chart or Screening', 'Choose a lane', 'An exam is a full six-point chart or a screening; "' + mode + '" names neither, so nothing was written.');
    const entries = sites && typeof sites === 'object' ? Object.entries(sites) : [];
    if (!entries.length) return refuse('invalid_input', 'Chart at least one site first', 'Go to the chart', 'An exam with no sites has nothing to summarise; nothing was written.');
    for (const [, v] of entries) {
      if (mode === 'screening') {
        if (!v || !SCREENING_CODES.includes(String(v.code))) return refuse('invalid_input', 'Code each sextant 0 to 4 or *', 'Go to the sextants', 'A screening sextant carries one code 0 to 4 or the * flag; anything else cannot be scored, so nothing was written.');
        continue;
      }
      if (v && v.depth != null) {
        if (!Number.isInteger(v.depth) || v.depth < 0) return refuse('invalid_input', 'Type a whole depth from 0 to 15', 'Re-enter the depth', 'A pocket depth is a whole number of millimetres from 0 to 15; nothing was written.');
        if (v.depth > 15) return refuse('depth_gt_15', 'Re-enter a depth of 15 or less', 'Re-enter the depth', 'A pocket depth above 15 mm is outside the probe; nothing was written.');
      }
    }
    const licence = extras && extras.licence;
    if (licence != null && !Object.hasOwn(LICENCE_WORDS, licence)) return refuse('omission_licence', 'Choose a reason from the list', 'Choose a reason', 'The reason a site was not probed is one of: implant, crown margin, patient could not tolerate, third molar absent. "' + licence + '" is not on that list, so nothing was written.');
    const skipped = entries.filter(([, v]) => v && v.skipped).length;
    if (skipped > 0 && !licence) return refuse('omission_licence', 'Name why ' + skipped + (skipped === 1 ? ' site was' : ' sites were') + ' not probed', 'Choose a reason', 'A blank is never forced into a fabrication: pick implant, crown margin, patient could not tolerate, or third molar absent.');
    return null;
  }
  function savePerio(encId, sites, extras) {
    const gate = perioGate(encId, sites, extras); if (gate) return gate;
    const enc = encounter(encId);
    const entries = Object.entries(sites);
    const probed = entries.filter(([, v]) => v && v.depth != null).length;
    const skipped = entries.filter(([, v]) => v && v.skipped).length;
    const bleeding = entries.filter(([, v]) => v && v.bleed && v.depth != null).length;
    const deepest = Math.max(0, ...entries.map(([, v]) => (v && v.depth) || 0));
    const mode = (extras && extras.mode) || 'full';
    const licence = (extras && extras.licence) || null;
    const codes = entries.filter(([, v]) => v && v.code != null).map(([, v]) => String(v.code));
    const prior = S.perioExams.filter((e) => e.encounterId === encId).pop();
    const amends = (extras && extras.amending && prior) ? prior.id : null;
    const exam = write('perioExams', { id: 'pe-' + nextId.pe++, patientId: enc.patientId, encounterId: encId, date: S.tenant.today, sites, probed, skipped, bleeding, deepest, sextantCodes: codes, licence, mode, author: currentUser().name, amendsExamId: amends, kind: amends ? 'addendum' : 'exam' });
    const n = S.notes[encId] = S.notes[encId] || {};
    const amendsPrefix = amends ? ' addendum to exam ' + amends + ' (' + currentUser().name + ', ' + S.tenant.today + '): ' : ': ';
    // The latest exam is the whole evidence: a sentence the current sites no longer support is withdrawn.
    if (mode === 'screening') {
      const numeric = codes.filter((x) => x !== '*').map(Number);
      const flagged = codes.length - numeric.length;
      const worst = numeric.length ? Math.max(...numeric) : null;
      const MEAN = { 0: 'healthy', 1: 'bleeding on probing', 2: 'calculus or defective margin', 3: 'pocket 4 to 5 mm', 4: 'pocket 6 mm or deeper' };
      n.perioSummary = 'Perio screening' + amendsPrefix + codes.length + ' sextants scored (' + codes.join(', ') + ')' + (worst != null ? ', highest ' + worst + ' — ' + (MEAN[worst] || 'see chart') : '') + (flagged ? ', ' + flagged + (flagged === 1 ? ' sextant' : ' sextants') + ' flagged * (furcation, mobility or recession)' : '') + '.';
      if (worst != null && worst >= 3) n.srpEvidence = 'Screening code ' + worst + ' indicates a full six-point chart before periodontal therapy.';
      else delete n.srpEvidence;
    } else {
      n.perioSummary = 'Perio' + amendsPrefix + sitesWord(probed) + ' probed, deepest ' + deepest + ' mm, bleeding at ' + sitesWord(bleeding) + (skipped ? ', ' + sitesWord(skipped) + ' not probed (' + LICENCE_WORDS[licence] + ')' : '') + '.';
      const deep = entries.filter(([, v]) => v && v.depth >= 5).length;
      if (deep) n.srpEvidence = 'SRP evidence: ' + sitesWord(deep) + ' at or above 5 mm.';
      else delete n.srpEvidence;
    }
    touch('notes', encId);
    retireChip('perio'); retireChip('save');
    return { ok: true, exam };
  }
  function addTag(encId, tooth, surfaces, text) { const enc = encounter(encId); if (!enc) return notFound('encounter'); const off = offline('Wait for the server — the tag cannot save'); if (off) return off; if (enc.noteFiled) return sealedExam(); const t = write('tags', { id: 'tag-' + nextId.tag++, encounterId: encId, tooth, surfaces, text, author: currentUser().name, disposition: null }); retireChip('tag'); return { ok: true, tag: t }; }
  function readyForExam(aid) { const a = appt(aid); if (!a) return notFound('appointment'); const off = offline('Wait for the server — the exam queue is read-only'); if (off) return off; const who = actorGate(currentUser()); if (who) return who; const st = statusGate(a, 'readyForExam', 'ready_for_exam'); if (st) return st; a.status = 'ready_for_exam'; touch('appointments', aid); write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'encounter.exam_requested', actor: currentUser().name }); retireChip('ready'); return { ok: true }; }

  // Encounter (flow 3)
  // Services that belong to the visit, not to a tooth.
  const WHOLE_PATIENT = ['d0120', 'd0140', 'd0274', 'd1110', 'd9230', 'd9243'];
  const TEMPORALITY = ['today', 'planned', 'existing'];
  const SURFACES = ['M', 'O', 'D', 'B', 'L', 'I', 'F'];
  const livePaints = (encId) => S.chartEvents.filter((c) => c.encounterId === encId && c.kind !== 'reversal' && !c.reversed);
  function chartPaint(encId, tooth, surfaces, cdtCode, temporality) {
    const enc = encounter(encId); if (!enc) return notFound('encounter');
    const off = offline('Wait for the server — charting is paused'); if (off) return off;
    if (enc.noteFiled) return sealedExam();
    if (!S.cdt[cdtCode]) return refuse('licence_scope', 'Choose a procedure from the list', 'Open the procedure list', 'Only codes on the practice fee schedule can be charted; an unknown code would write a procedure with no fee and no claim line.');
    // One gesture is one transaction or nothing: every argument is checked before the first row is written.
    temporality = temporality || 'today';
    if (!TEMPORALITY.includes(temporality)) return refuse('invalid_input', 'Choose Today, Planned or Existing', 'Go to When', 'A paint is performed today, planned, or existing work placed elsewhere; "' + temporality + '" is none of these, so nothing was written.');
    const fee = (S.cdt[cdtCode] || [null, 0])[1];
    if (WHOLE_PATIENT.includes(cdtCode)) { tooth = null; surfaces = []; }
    if (tooth != null && !(Number.isInteger(tooth) && tooth >= 1 && tooth <= 32)) return refuse('tooth_required', 'Pick a tooth from 1 to 32', 'Go to the teeth', 'The chart numbers teeth 1 to 32; "' + tooth + '" names none of them, so nothing was written.');
    if (!Array.isArray(surfaces) || surfaces.some((x) => !SURFACES.includes(String(x).toUpperCase()))) return refuse('invalid_input', 'Pick surfaces from M, O, D, B, L', 'Go to the surfaces', 'Surfaces are a list of the letters M, O, D, B, L, I or F; nothing else can be charted, so nothing was written.');
    const already = livePaints(encId).find((c) => c.cdt === cdtCode && c.tooth === tooth);
    // The verb names no procedure: interpolating it ran the line to ten words on a two-surface composite.
    if (already) return refuse('duplicate_paint', 'Undo the first one to change it', 'Undo the first one', 'Already charted this visit: ' + (S.cdt[cdtCode] || [cdtCode])[0] + (tooth ? ' #' + tooth : '') + '. One gesture writes one chart event, one procedure, one plan line and one pending charge. Charting it twice would bill it twice.');
    const ce = write('chartEvents', { id: 'ce-' + nextId.ce++, encounterId: encId, tooth, surfaces, cdt: cdtCode, temporality, author: currentUser().name });
    let proc = null;
    if (temporality === 'today') proc = write('procedures', { id: 'pr-' + nextId.pr++, encounterId: encId, patientId: enc.patientId, cdt: cdtCode, tooth, surfaces, feeCents: fee, status: 'completed_pending_charge', selfPayRestricted: false, chartEventId: ce.id });
    // Existing work was placed elsewhere: it is history on the chart, never an estimate or a plan line.
    let plan = null;
    if (temporality !== 'existing') {
      const pat = patient(enc.patientId);
      const carrier = pat && pat.primary ? carrierName(pat.primary) : null;
      const share = carrier ? 0.5 : 1;
      const est = Math.round(fee * share);
      const trace = carrier
        ? carrier + ' PPO: 50% after deductible (met) → patient est. ' + Proto.ui.money(est)
        : 'Self-pay, no coverage on file → patient est. ' + Proto.ui.money(est);
      plan = write('planItems', { id: id('pl'), encounterId: encId, tooth, surfaces, cdt: cdtCode, estimateCents: est, ruleTrace: trace, temporality });
    }
    S.notes[encId] = S.notes[encId] || {};
    const line = (S.cdt[cdtCode] || [cdtCode])[0] + (tooth ? ' #' + tooth : '') + (surfaces && surfaces.length ? ' ' + surfaces.join('') : '') + (temporality === 'existing' ? ' (existing, placed elsewhere)' : temporality === 'planned' ? ' (planned)' : '');
    S.notes[encId].procedures = (S.notes[encId].procedures || []).concat([line]);
    S.notes[encId].procedure = S.notes[encId].procedures.join('; ');
    touch('notes', encId);
    for (const t of S.tags) if (t.encounterId === encId && t.tooth === tooth && !t.disposition) { t.disposition = 'charted'; touch('tags', t.id); }
    return { ok: true, chartEvent: ce, procedure: proc, plan };
  }
  /* Undo reverses the last paint; it never deletes. The screen used to splice the chart event, its procedure
     and its plan item out of their tables and log one write for an id no table held, which erased part of a
     clinical record and left the note line behind. A reversal is written the way every other correction is:
     a reversing chart event that names what it supersedes, the procedure and plan item marked reversed, the
     note line withdrawn, the tag put back to open, and one event per table it touched (A3, A5). */
  function chartUndo(encId) {
    const enc = encounter(encId); if (!enc) return notFound('encounter');
    const off = offline('Wait for the server — charting is paused'); if (off) return off;
    const live = S.chartEvents.filter((c) => c.encounterId === encId && !c.reversed && c.kind !== 'reversal');
    if (!live.length) return refuse('already_decided', 'Chart something before undoing it', 'Chart a tooth', 'Nothing has been painted on this visit yet, so there is nothing to reverse.');
    const ce = live[live.length - 1];
    if (enc.noteFiled) return refuse('already_decided', 'Amend the filed note instead', 'Open the note', 'The note is filed, so the paint is sealed. A correction after filing is an addendum that supersedes it, not an undo.');
    ce.reversed = true; touch('chartEvents', ce.id);
    const rev = write('chartEvents', { id: 'ce-' + nextId.ce++, encounterId: encId, kind: 'reversal', supersedes: ce.id, tooth: ce.tooth, surfaces: ce.surfaces, cdt: ce.cdt, temporality: ce.temporality, author: currentUser().name });
    const proc = S.procedures.find((p) => p.chartEventId === ce.id && !p.reversed);
    if (proc) { if (charged(proc)) { ce.reversed = false; touch('chartEvents', ce.id); return refuse('already_decided', 'Correct this visit from the ledger', 'Open the ledger', 'This procedure is already on the ledger. A charged procedure is corrected by a reversal and a repost from the ledger, both linked to the original.'); } proc.reversed = true; proc.status = 'reversed'; touch('procedures', proc.id); }
    const plan = S.planItems.filter((pl) => pl.encounterId === encId && pl.cdt === ce.cdt && pl.tooth === ce.tooth && !pl.reversed).pop();
    if (plan) { plan.reversed = true; touch('planItems', plan.id); }
    const n = S.notes[encId];
    if (n && n.procedures && n.procedures.length) { n.procedures = n.procedures.slice(0, -1); n.procedure = n.procedures.join('; '); touch('notes', encId); }
    // A tag reopens only when no paint on its tooth still stands.
    if (!livePaints(encId).some((c) => c.tooth === ce.tooth)) for (const t of S.tags) if (t.encounterId === encId && t.tooth === ce.tooth && t.disposition === 'charted') { t.disposition = null; touch('tags', t.id); }
    return { ok: true, reversal: rev, supersedes: ce.id, procedure: proc || null, plan: plan || null };
  }
  /* Dismissing a hygienist's finding is a change to the record, so the store writes it and the reason is
     required: the screen used to set the disposition on the seed row itself. */
  function dismissTag(tagId, reason) {
    const t = S.tags.find((x) => x.id === tagId); if (!t) return notFound('request');
    const off = offline('Wait for the server — the tag cannot be dismissed'); if (off) return off;
    if (t.disposition) return refuse('already_decided', 'Open the tag to see its disposition', 'Open the tag', 'This finding already carries a disposition (' + t.disposition + '). Changing it is a new note, not a second dismissal.');
    const text = String(reason || '').trim();
    if (!text) return refuse('reason_required', 'Give a one-line reason', 'Type the reason', 'A dismissed hygienist finding stays in the record with why it was dismissed; the hygienist sees the reason on her card.');
    t.disposition = 'dismissed'; t.reason = text; t.dispositionBy = currentUser().name; t.dispositionAt = S.tenant.today + ' ' + S.clock.time;
    touch('tags', t.id);
    return { ok: true, tag: t };
  }
  /* Which procedures a payer wants an attachment for. The Board and Checkout each held their own copy of this
     list and they had drifted apart, so one filed surgical extraction read "Needs: attachment" on the Board
     queue row and "Ready" on Checkout for the same visit. One rule, one table. */
  const ATTACHMENT_CDT = { d4341: true, d2740: true, d7210: true };
  const needsAttachment = (p) => !!(p && ATTACHMENT_CDT[typeof p === 'string' ? p : p.cdt]);
  /* Switching the charting author on a shared device opens that person's session, and the record says so.
     The shell used to emit a write event for a `sessions` table the store did not hold, so the log named a
     row nothing had written; removing the event left the switch unrecorded instead. One verb writes the row
     and the event together, and the author every later record is frozen onto is the one this row names. */
  function openSession(userId) {
    const who = user(userId); if (!who) return notFound('request');
    const off = offline('Wait for the server — sessions cannot open'); if (off) return off;
    const prior = S.sessions.filter((x) => !x.endedAt).pop() || null;
    if (prior) { prior.endedAt = S.clock.time; prior.endedBy = who.name; touch('sessions', prior.id); }
    const row = write('sessions', { id: 'ses-' + nextId.ses++, userId: who.id, actor: who.name, device: (window.__proto && window.__proto.device) || 'desk', startedAt: S.clock.time, supersedes: prior ? prior.id : null, endedAt: null });
    return { ok: true, session: row };
  }
  /* The approvals one person is waiting on. Four surfaces counted this and disagreed: the Andon filtered by
     entitlement and requester, the phone card and the Money Desk tab counted every pending row, so with two
     requests open the owner's Andon said one while the phone beside it showed two. A request is yours to
     decide when you carry the second-approver entitlement and did not raise it yourself. */
  function pendingApprovalsFor(who) {
    const u = who || currentUser();
    if (!u || !u.entitlements || !u.entitlements.includes('approve_second')) return [];
    return S.approvals.filter((a) => a.status === 'pending' && a.requestedById !== u.id);
  }
  function noteKillers(encId, note) {
    const enc = encounter(encId); const killers = [];
    const u = currentUser();
    // Every verb line starts with its verb: the audit measured 19 of 39 gates opening on a noun, a pronoun
    // or a gerund, which reads as a description of the problem rather than the thing to do next.
    for (const t of S.tags) if (t.encounterId === encId && !t.disposition) killers.push({ code: 'tag_undispositioned', verb: 'Chart or dismiss tag #' + t.tooth, control: 'Chart it or dismiss', fix: 'tag' });
    const text = ((note && note.assessment) || '') + ' ' + ((note && note.plan) || '');
    if (/\$\s?\d/.test(text) || /\b(fees?|costs?|prices?|pricing|estimates?|copay(ment)?s?|co-pay(ment)?s?|dollars?|cents)\b/i.test(text)) killers.push({ code: 'money_in_note', verb: 'Move the fee to the plan card', control: 'Move to plan card', fix: 'money' });
    // Every tooth the note names, as #NN or "tooth NN", is compared with the paints that still stand.
    const toothed = livePaints(encId).filter((c) => c.tooth != null);
    const named = [...text.matchAll(/(?:#|\btooth\s+#?)(\d{1,2})\b/gi)].map((m) => Number(m[1]));
    const wrong = named.find((t) => !toothed.some((c) => c.tooth === t));
    if (wrong != null && toothed.length) {
      const c = toothed[0];
      killers.push({ code: 'contradiction', verb: 'Use the chart tooth #' + c.tooth, control: 'Use chart tooth', fix: 'contradiction', why: 'The note says #' + wrong + ' and the chart says #' + c.tooth + '. A wrong-tooth claim is denied or paid wrongly, so the two must agree before filing.', noteTooth: wrong, chartTooth: c.tooth });
    }
    if (!(note && note.assessment && note.assessment.trim().length)) killers.push({ code: 'assessment_required', verb: 'Add an assessment', control: 'Add assessment', fix: 'assessment' });
    if (u.role !== 'dentist' && u.role !== 'owner' && u.role !== 'surgeon') killers.push({ code: 'licence_scope', verb: 'Send to a dentist to file', control: 'Send to Exams to sign', fix: 'licence' });
    return killers;
  }
  function fileNote(encId, note, readbackConfirmed) {
    const enc = encounter(encId); if (!enc) return notFound('encounter');
    const off = offline('Wait for the server — the note cannot file'); if (off) return off;
    // Filing is irreversible and once only: a second File wrote a second note and a second claim.
    if (enc.noteFiled) return refuse('exam_sealed', 'Add an addendum to change this', 'Start an addendum', 'This note is filed. A filed note is never edited in place; a correction is an addendum that supersedes the span it changes and propagates to the claim.');
    const killers = noteKillers(encId, note);
    if (killers.length) return { ok: false, killers: killers.slice(0, 3), total: killers.length };
    if (!readbackConfirmed) {
      const pr = window.__proto && window.__proto.privacy; const who = patient(enc.patientId);
      const whoName = who ? Proto.ui.displayName(who.name, pr) : 'this patient';
      // Privacy covers gate copy too: the date of birth is read back only where the header would show it.
      return Object.assign(refuse('readback', 'Confirm the author and the patient', 'Confirm and file', 'Filing as ' + currentUser().name + ' for ' + whoName + (who && who.dob && !pr ? ', born ' + Proto.ui.longDate(who.dob) : '') + '. The read-back repeats both so a stale author on a shared device is caught at the last gate.'), { readback: { author: currentUser().name, patient: whoName } });
    }
    enc.noteFiled = true; enc.status = 'signed'; touch('encounters', enc.id);
    const a = appt(enc.appointmentId); if (a) { a.status = a.status === 'checked_out_unfiled' ? 'checked_out' : 'note_filed'; touch('appointments', a.id); }
    const filed = write('filedNotes', { id: 'nf-' + nextId.nf++, encounterId: encId, author: currentUser().name, filedOn: S.tenant.today, filedTime: S.clock.time, rulesetVersion: '2.25.2', byteauditOk: true, markdown: [note.assessment, note.plan, S.notes[encId] && S.notes[encId].procedure, S.notes[encId] && S.notes[encId].perioSummary].filter(Boolean).join('\n') });
    // Release every charge this note holds, not only the ones painted this session: a seeded procedure sat
    // "completed" and uncharged forever, so filing wrote no ledger row and the patient's credit never applied.
    // Only a procedure that still stands is released: a reversed one never reaches the ledger or the claim.
    const release = liveProcedures(encId).filter((p) => !charged(p));
    const relTotal = release.reduce((s, p) => s + p.feeCents, 0);
    const relEst = S.estimates[enc.appointmentId] || { insuranceCents: 0 };
    for (const p of release) { p.status = 'completed'; p.charged = true; touch('procedures', p.id); write('ledger', stampClose({ id: id('le'), kind: 'charge', patientId: enc.patientId, amountCents: p.feeCents, effective: enc.dos, posted: S.tenant.today, actor: currentUser().name, actorKind: 'file_event', locationId: enc.locationId, procedureId: p.id, cdt: p.cdt, tooth: p.tooth, releasedByNoteId: filed.id, insuranceExpectedCents: relTotal ? Math.round((relEst.insuranceCents || 0) * p.feeCents / relTotal) : 0 }));
      // A payment taken before the note was filed is waiting as an intent; filing is what lets it land.
      // An intent lands only when the payment it names is on the ledger; a credit with no payment behind it is not money.
      for (const intent of S.allocationIntents.filter((x) => x.encounterId === encId && !x.appliedTo && S.ledger.some((e) => e.id === x.paymentId))) { intent.appliedTo = p.id; touch('allocationIntents', intent.id); const cr = S.credits.find((c) => c.patientId === enc.patientId && c.intents && c.intents.includes(encId)); if (cr) { cr.fromLedger = true; cr.applied = true; touch('credits', cr.id); } }
    }
    // A claim carries the released procedures, one line each; a visit that performed nothing sends none.
    let claim = null;
    if (release.length) claim = write('claims', { id: 'c-' + nextId.cl++, patientId: enc.patientId, encounterId: encId, status: 'scrubbed', cdt: release[0].cdt, tooth: release[0].tooth, lines: release.map((p) => ({ procedureId: p.id, cdt: p.cdt, tooth: p.tooth, amountCents: p.feeCents })), amountCents: relTotal, payer: carrierName((patient(enc.patientId) || {}).primary), submitted: S.tenant.today, age: 0, nextAction: 'Queued to clearinghouse' });
    return { ok: true, filed, claim };
  }

  // Money Desk (flow 5)
  /* Post matched now posts: it writes the ledger rows for the lines it claims are already posted, and logs the
     batch state change. Before, it flipped a status, said "37 posted", and left the ledger untouched. */
  function eraPostMatched(batchId) {
    const b = S.eraBatches.find((x) => x.id === batchId); if (!b) return notFound('claim');
    const off = offline('Wait for the server — postings are paused'); if (off) return off;
    if (b.status === 'deltas' || b.status === 'posted') return refuse('already_decided', 'Confirm the delta lines below', 'Go to the deltas', 'The matched lines of this batch are already posted. What is left is the lines where the payer differs from the claim.');
    const u = currentUser(); let posted = 0;
    const who = actorGate(u, ['post_era', 'post_payment'], 'Posting an ERA'); if (who) return who;
    for (const l of S.eraLines.filter((x) => x.batchId === batchId && x.status === 'posted')) {
      if (S.ledger.some((e) => e.eraLineId === l.id)) continue;
      write('ledger', stampClose({ id: id('le'), kind: 'insurance_payment', patientId: l.patientId, amountCents: -l.paidCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: lineLocation(l), payer: b.payer, eraLineId: l.id, gl: 'ins_ar_primary' }));
      posted++;
    }
    b.status = 'deltas'; touch('eraBatches', b.id);
    return { ok: true, readback: S.eraLines.filter((l) => l.batchId === batchId && l.status === 'delta'), posted };
  }
  // The line's own claim and batch say where and from whom the money is; a literal did not.
  const lineLocation = (l) => { const c = S.claims.find((x) => x.id === l.claimId); return (l.locationId || (c && c.locationId)) || 'loc-1'; };
  const linePayer = (l) => { const b = S.eraBatches.find((x) => x.id === l.batchId); const c = S.claims.find((x) => x.id === l.claimId); return (b && b.payer) || (c && c.payer) || 'Delta Dental'; };
  function eraConfirm(lineId) {
    const l = S.eraLines.find((x) => x.id === lineId); if (!l) return notFound('claim');
    const off = offline('Wait for the server — postings are paused'); if (off) return off;
    const u = currentUser(); const who = actorGate(u, ['post_era', 'post_payment'], 'Posting an ERA line'); if (who) return who;
    // Posted is a fact of the ledger, not of the line's status flag: a line with rows behind it never posts twice.
    if (l.status === 'posted' || S.ledger.some((e) => e.eraLineId === lineId)) return refuse('already_decided', 'Open the ledger to correct this', 'Open the ledger', 'This line is posted. A correction is a reversal and a repost, both linked to the original.');
    // A denial pays nothing and writes nothing off: the balance stays open for the appeal or the patient.
    if (l.status === 'denied' || l.paidCents <= 0) return refuse('denial_suppression', 'Appeal or bill the patient instead', 'Open the denial', 'This line paid ' + Proto.ui.money(l.paidCents || 0) + (l.carc ? ' (CARC ' + l.carc + ')' : '') + '. Confirming it would write the whole ' + Proto.ui.money(l.expectedCents) + ' off as contractual while the claim stays denied. Appeal it or bill the patient; nothing was written.');
    l.status = 'posted'; touch('eraLines', l.id);
    const loc = lineLocation(l);
    write('ledger', stampClose({ id: id('le'), kind: 'insurance_payment', patientId: l.patientId, amountCents: -l.paidCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: loc, payer: linePayer(l), eraLineId: lineId, gl: 'ins_ar_primary' }));
    if (l.expectedCents - l.paidCents > 0) write('ledger', stampClose({ id: id('le'), kind: 'write_off', patientId: l.patientId, amountCents: -(l.expectedCents - l.paidCents), effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: loc, reason: 'contractual_ppo', eraLineId: lineId }));
    return { ok: true };
  }
  function eraHold(lineId) { const l = S.eraLines.find((x) => x.id === lineId); if (!l) return notFound('claim'); const off = offline('Wait for the server — the line cannot be held'); if (off) return off; l.status = 'held'; touch('eraLines', l.id); write('claimEvents', { id: id('cev'), claimId: l.claimId, kind: 'era.line_held', actor: currentUser().name }); return { ok: true }; }
  function eraDispute(lineId) { const l = S.eraLines.find((x) => x.id === lineId); if (!l) return notFound('claim'); const off = offline('Wait for the server — the dispute cannot send'); if (off) return off; const who = actorGate(currentUser(), ['post_era', 'post_payment'], 'Disputing an ERA line'); if (who) return who; if (l.status === 'posted' || S.ledger.some((e) => e.eraLineId === lineId)) return refuse('already_decided', 'Reverse the posting to dispute this', 'Open the ledger', 'This line is on the ledger. A posted line is disputed by reversing its rows first, so the dispute and the money agree; flipping the flag alone would let it post again.'); l.status = 'disputed'; touch('eraLines', l.id); write('claimEvents', { id: id('cev'), claimId: l.claimId, kind: 'era.contract_variance_disputed', actor: currentUser().name }); return { ok: true }; }
  // One packet per claim: pressing Appeal four times wrote four packets and renamed the drawer each time.
  function buildAppeal(claimId) { const c = S.claims.find((x) => x.id === claimId); if (!c) return notFound('claim'); const existing = S.appealPackets.find((p) => p.claimId === claimId); if (existing) return { ok: true, packet: existing, already: true }; const off = offline('Wait for the server — the packet cannot build'); if (off) return off; const pk = write('appealPackets', { id: id('ap'), claimId, slots: { perioChart: c.hasPerioChart, narrative: c.hasNarrative, radiograph: true, letter: true }, patientSentence: 'Delta asked for your gum chart; we are sending it. You owe nothing while they review.' }); return { ok: true, packet: pk }; }
  function sendAppeal(claimId) { const c = S.claims.find((x) => x.id === claimId); if (!c) return notFound('claim'); const off = offline('Wait for the server — the appeal cannot send'); if (off) return off; if (c.status === 'appealed') return refuse('already_decided', 'Wait for the payer to answer', 'Open the claim', 'This appeal was already sent. Sending it twice does not speed it up and starts a second review.'); c.status = 'appealed'; touch('claims', c.id); write('claimEvents', { id: id('cev'), claimId, kind: 'claim.appealed', actor: currentUser().name }); write('disclosures', { id: id('dis'), patientId: c.patientId, channel: 'clearinghouse', purpose: 'payment', recordIds: ['pe-1', 'nf-old'], actor: currentUser().name }); return { ok: true }; }
  // Showing a redacted name on glass is a disclosure like any other: it writes the row the control's label promises.
  function discloseName(patientId, recordId) {
    const p = patient(patientId); if (!p) return notFound('patient');
    const row = write('disclosures', { id: id('dis'), patientId, channel: 'screen', purpose: 'operations', recordIds: recordId ? [recordId] : [], actor: currentUser().name });
    return { ok: true, disclosureId: row.id };
  }
  // A statement bills what the account owes now, not the figure it was raised with: a write-off that landed since
  // lowers it, and a visit still waiting for its charges keeps them in. Once sent, the row keeps what it billed.
  function statementDue(s) {
    if (s.sent) return s.amountCents;
    const pending = s.encounterId ? liveProcedures(s.encounterId).filter((p) => !charged(p)).reduce((t, p) => t + p.feeCents, 0) : 0;
    return Math.max(0, balances(s.patientId).patientDue + pending);
  }
  function sendStatement(sdId) { const s = S.statementsDue.find((x) => x.id === sdId); if (!s) return notFound('patient'); const off = offline('Wait for the server — statements cannot send'); if (off) return off; if (s.sent) return refuse('already_decided', 'Wait for this statement to land', 'Open the ledger', 'This statement was sent at ' + (s.sentAt || S.clock.time) + '. A second copy of the same balance confuses the patient and the phone call that follows.'); const due = statementDue(s); if (due <= 0) return refuse('zero_collect_refused', 'Nothing due — no statement to send', 'Open the ledger', 'The ledger says this account owes nothing now, so a statement would bill $0.00 and log a disclosure for no purpose. The row stays until the balance moves.'); s.amountCents = due; s.sent = true; s.sentAt = S.clock.time; touch('statementsDue', s.id); write('disclosures', { id: id('dis'), patientId: s.patientId, channel: 'mail', purpose: 'payment', recordIds: [sdId], actor: currentUser().name }); return { ok: true }; }

  // Daily Close
  /* Matching a variance settles it against the bank line, so the tender row and the location grade agree.
     Before, the grade flipped to "Tied · independent" while the Card row still showed a $312.40 gap. */
  /* Settling a variance, by match or by reason, is a money control: the seat needs an identity, the entitlement
     that reconciles the bank or closes the day, and independence from the hands that posted or closed that day. */
  function reconcileGate(rr, u) {
    const who = actorGate(u, ['bank_reconcile', 'close_day'], 'Settling a variance'); if (who) return who;
    if (rr && (rr.closer === u.name || rr.posters === u.name || (u.role === 'biller' && rr.locationId === 'loc-3'))) return refuse('clear_not_independent', 'Ask an independent seat to clear', 'Send to Dana or the CPA', 'You posted or prepared the deposit for that day, so settling your own variance would leave nobody checking the money. ' + (rr.closer === u.name ? 'Dr. Reagan' : 'Dana') + ' or the CPA seat can settle it.');
    return null;
  }
  function matchVariance(vid) {
    const v = S.variances.find((x) => x.id === vid); if (!v) return notFound('request');
    const off = offline('Wait for the server — reconciliation is read-only'); if (off) return off;
    const rr = S.reconciliation.find((r) => r.id === v.reconciliationId);
    const seat = reconcileGate(rr, currentUser()); if (seat) return seat;
    if (v.status !== 'open') return refuse('already_decided', 'Open the day to see the match', 'Open the day', 'This variance was already ' + v.status + '. The settlement row that closed it is on the day.');
    v.status = 'matched'; touch('variances', v.id);
    if (rr) { rr.bank = Object.assign({}, rr.bank); rr.bank[v.tender] = (rr.bank[v.tender] || 0) + v.amountCents; rr.settled = (rr.settled || []).concat([{ tender: v.tender, amountCents: v.amountCents, basis: 'timing_card_settlement' }]); rr.state = 'tied'; touch('reconciliation', rr.id); }
    write('reconciliationMatches', { id: id('rm'), varianceId: vid, basis: 'timing_card_settlement', tender: v.tender, amountCents: v.amountCents, actor: currentUser().name });
    return { ok: true };
  }
  function clearVariance(vid) {
    const v = S.variances.find((x) => x.id === vid); if (!v) return notFound('request');
    const off = offline('Wait for the server — reconciliation is read-only'); if (off) return off;
    const rr = S.reconciliation.find((r) => r.id === v.reconciliationId); const u = currentUser();
    if (!rr) return notFound('request');
    // Whoever posted the day cannot clear it; the verb says what to do, and the Why names who can.
    if (rr.closer === u.name || rr.posters === u.name || (u.role === 'biller' && rr.locationId === 'loc-3')) return refuse('clear_not_independent', 'Ask an independent seat to clear', 'Send to Dana or the CPA', 'You posted or prepared the deposit for that day, so clearing your own variance would leave nobody checking the money. ' + (rr.closer === u.name ? 'Dr. Reagan' : 'Dana') + ' or the CPA seat can clear it.');
    /* Independence is not enough on its own: clearing a variance is a money control, so the seat also needs
       the entitlement for it. The screen applies this test to decide who is offered the control; the rule is
       enforced here too, because a control that never renders is not a control that cannot be reached. */
    if (u.noPass || (!u.entitlements.includes('bank_reconcile') && !u.entitlements.includes('close_day'))) return refuse('entitlement', 'Ask a seat that reconciles the bank', 'Send to Dana or the CPA', 'Clearing a variance signs off on the day\'s money. The seats that carry bank reconciliation or day close can do it; yours does not.');
    if (v.status !== 'open') return refuse('already_decided', 'Open the day to see the match', 'Open the day', 'This variance was already ' + v.status + '.');
    // Tied is derived, never declared: every tender's bank line must equal what was expected once the
    // explained variances are settled against it. A gap no variance explains keeps the day open.
    const settled = (rr.settled || []).concat([{ tender: v.tender, amountCents: v.amountCents, basis: 'cleared_with_reason' }]);
    const bank = Object.assign({}, rr.bank); bank[v.tender] = (bank[v.tender] || 0) + v.amountCents;
    const gaps = Object.keys(Object.assign({}, rr.expected, bank)).map((t) => ({ tender: t, gap: (bank[t] || 0) - (rr.expected[t] || 0) })).filter((g) => g.gap !== 0);
    const unexplained = gaps.filter((g) => !S.variances.some((x) => x.id !== vid && x.reconciliationId === rr.id && x.tender === g.tender && x.status === 'open'));
    if (unexplained.length) return refuse('gap_unexplained', 'Explain the ' + unexplained[0].tender + ' gap before clearing', 'Investigate', 'Clearing this variance would still leave ' + unexplained.map((g) => g.tender + ' ' + Proto.ui.money(g.gap)).join(', ') + ' between the bank and the sheet with no variance naming it. A day is tied when every tender ties; nothing was written.');
    v.status = 'cleared'; touch('variances', v.id);
    rr.bank = bank; rr.settled = settled; rr.state = gaps.length ? 'variance' : 'tied'; rr.clearedBy = u.name; touch('reconciliation', rr.id);
    write('reconciliationMatches', { id: id('rm'), varianceId: vid, basis: 'cleared_with_reason', tender: v.tender, amountCents: v.amountCents, actor: u.name });
    return { ok: true, tied: rr.state === 'tied' };
  }
  const DECISION_ACTIONS = ['keep', 'tighten', 'retire'];
  function reviewDecision(did, action) { const d = S.decisions.find((x) => x.id === did); if (!d) return notFound('request'); const off = offline('Wait for the server — decisions are read-only'); if (off) return off;
    // The owner's control decision is reviewed by the seats that own controls, once, with one of three answers.
    const u = currentUser(); const who = actorGate(u); if (who) return who;
    if (!(u.entitlements || []).includes('grant_roles') && u.role !== 'owner') return refuse('entitlement', 'Ask Dr. Reagan or Dana to review this', 'Open approvals', 'A dual-release decision is the owner\'s control; only the seats that set controls (owner, office manager) review it. Nothing was written.');
    if (!DECISION_ACTIONS.includes(action)) return refuse('invalid_input', 'Choose keep, tighten or retire', 'Keep 90 more days', 'A review ends one of three ways: keep, tighten or retire. "' + String(action) + '" is none of them, so nothing was written.');
    if (d.status !== 'review_due') return refuse('already_decided', 'Open the decision to read it', 'Open the day', 'This decision was already reviewed (' + d.status + '). A review is one answer, recorded once; a change of mind is a new decision.');
    d.status = action; d.reviewedBy = u.name; d.reviewedAt = S.tenant.today; touch('decisions', d.id); write('controlDecisions', { id: 'dec-' + nextId.dec++, supersedes: did, action, by: u.name, at: S.tenant.today });
    // The threshold comes from the decision row: retire and tighten both return to what it was raised from.
    if (action === 'retire' || action === 'tighten') S.tenant.dualReleaseThresholdCents = d.fromCents;
    /* A decision that is kept or tightened comes back for review; the store sets the date so the sentence on
       screen and the row underneath it cannot disagree. The screen used to compute today + 90 itself. */
    let reviewBy = d.reviewBy || null;
    if (action === 'keep' || action === 'tighten') { const t = new Date(S.tenant.today + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 90); reviewBy = t.toISOString().slice(0, 10); d.reviewBy = reviewBy; }
    return { ok: true, reviewBy, thresholdCents: S.tenant.dualReleaseThresholdCents }; }
  function chainHash(s) { let h1 = 0x811c9dc5, h2 = 0x01000193; for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519) >>> 0; } return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')); }
  function closeDay(locId) {
    const u = currentUser();
    const off = offline('Wait for the server — the day cannot close'); if (off) return off;
    if (!S.locations.some((l) => l.id === locId)) return notFound('request');
    if (!u.entitlements.includes('close_day')) return refuse('entitlement', 'Ask Dana or Dr. Reagan to close', 'Open approvals', 'Closing the day freezes the sheet and prepares the deposit, so it is held to the two seats that carry the close-day entitlement.');
    if (S.dayCloses.find((d) => d.locationId === locId && d.date === S.tenant.today)) return refuse('already_closed', 'Open the closed day to read it', 'Open the day', 'This location is already closed for today. A closed day never changes in place: a correction is a reversal and a repost, both visible on the day.');
    // Count what actually settles: a repost is money, its reversal is not, and the pair must net to zero.
    const rows = S.ledger.filter((e) => e.locationId === locId && e.posted === S.tenant.today && (e.kind === 'patient_payment' || e.kind === 'reversal'));
    const tot = { cash: 0, check: 0, card: 0 };
    for (const e of rows) {
      if (e.kind === 'reversal') { const orig = S.ledger.find((x) => x.id === e.reversesEntryId); if (orig && orig.tender) tot[orig.tender] -= e.amountCents; continue; }
      tot[e.tender || 'card'] += -e.amountCents;
    }
    // Each close chains on the previous head and on its own location, date and totals, so two closes never share a hash.
    const prev = S.dayCloses.length ? S.dayCloses[S.dayCloses.length - 1].chainHeadHash : 'genesis';
    const dc = write('dayCloses', { id: 'dc-' + locId + '-0903', locationId: locId, date: S.tenant.today, closedBy: u.name, closedAt: S.clock.time, prevHeadHash: prev, chainHeadHash: chainHash([prev, locId, S.tenant.today, tot.cash, tot.check, tot.card, rows.length].join('|')), totals: tot });
    write('deposits', { id: id('dep'), dayCloseId: dc.id, lines: tot, preparedBy: u.name });
    return { ok: true, dayClose: dc };
  }

  // Roles: day pass
  function previewDayPass(form) {
    const tpl = S.roleTemplates.find((t) => t.code === form.role);
    const ents = new Set([...(tpl ? tpl.entitlements : []), ...(form.extra || [])]);
    const conflicts = S.sodRules.filter((r) => r.pair.every((e) => ents.has(e)));
    let credential = null, licenceGate = null;
    if (tpl && tpl.clinical) {
      credential = S.credentials.find((c) => c.name.toLowerCase() === (form.name || '').trim().toLowerCase() && c.licenceType === tpl.licence && c.state === 'TN' && c.expiresAt > S.tenant.today && c.verifiedBy);
      if (!credential) licenceGate = refuse('licence_not_on_file', 'Licence not on file — Front desk only', 'Add credential', 'Clinical entitlements issue only against an active, verified staff_credentials row (licence type and state match, expiry after shift end, verifier frozen).');
    }
    return { conflicts, credential, licenceGate, entitlements: [...ents] };
  }
  function addDayPass(form, decision) {
    const off = offline('Wait for the server — day passes cannot issue'); if (off) return off;
    form = form || {};
    if (!String(form.name || '').trim()) return refuse('name_required', 'Name the temp before issuing', 'Go to name', 'The pass freezes a name onto every posting the temp makes, so it cannot issue without one.');
    if (!form.end) return refuse('shift_end_required', 'Set a shift end later than now', 'Go to shift end', 'The pass expires at the shift end plus a grace period; without one the grant would never lapse.');
    const pv = previewDayPass(form);
    // The decision is recorded against the conflict that actually held the save, not against whichever rule
    // the seed happened to list first, and every conflict the grant carries gets its own row.
    const blocking = pv.conflicts.filter((c) => c.severity === 'critical');
    if (blocking.length && !decision) return refuse('sod_conflict', 'Remediate, compensate, or accept this', 'Remediate, compensate, or accept', 'Granting ' + blocking[0].pair.join(' + ') + ' together opens a fraud path: ' + blocking[0].fraudPath + ' A grant that creates a critical conflict needs a recorded decision with a review date.');
    let ents = pv.entitlements; let role = form.role;
    if (pv.licenceGate) { const fd = S.roleTemplates.find((t) => t.code === 'frontdesk'); ents = fd.entitlements; role = 'frontdesk'; }
    const dp = write('dayPasses', { id: 'dp-' + nextId.dp++, name: form.name, role, requestedRole: form.role, locationId: form.location, shiftEnd: form.end, entitlements: ents, expiresAt: form.end + ' + 30 min grace', createdBy: currentUser().name, credentialId: pv.credential ? pv.credential.id : null, sodDecision: decision || null });
    // Each pass is its own identity: two temps on one day never share a user id on the postings they make.
    const tempId = 'u-temp-' + dp.id;
    write('userEntitlements', { id: 'ue-' + nextId.ue++, userId: tempId, entitlements: ents, expiresAt: dp.expiresAt, grantedBy: currentUser().name });
    if (decision) for (const c of (blocking.length ? blocking : pv.conflicts)) write('controlDecisions', { id: 'dec-' + nextId.dec++, kind: decision, ruleId: c.id, rulePair: c.pair, severity: c.severity, dayPassId: dp.id, reviewBy: '2026-10-03', by: currentUser().name });
    S.tempUser = { id: tempId, name: form.name, short: form.name.split(' ')[0], role, entitlements: ents, dayPass: dp.id };
    return { ok: true, dayPass: dp, downgraded: !!pv.licenceGate };
  }

  // Temp rail
  const RAIL_STEPS = { frontdesk: [['arrive', 'Arrive'], ['seat', 'Seat'], ['checkout', 'Checkout'], ['payment', 'Take payment'], ['find', 'Find a patient']], rdh: [['perio', 'Perio grammar'], ['save', 'Save exam'], ['tag', 'Tag for dentist'], ['ready', 'Ready for exam'], ['find', 'Find a patient']] };
  function railSteps() { const u = currentUser(); return RAIL_STEPS[u.role === 'hygienist' || u.role === 'rdh' ? 'rdh' : 'frontdesk']; }
  function retireChip(step) {
    if (!S.railState || S.outage) return;
    const uid = currentUser().id;                       // one bucket per user; a tablet is not a person
    const bucket = (S.railState[uid] = S.railState[uid] || {});
    if (!bucket[step]) { bucket[step] = { retiredAt: S.clock.time, byEvent: Proto.events.all().length }; write('firstRunState', { id: 'frs-' + uid + '-' + step, userId: uid, step, retiredAt: S.clock.time }); }
  }
  function railStateFor() { const uid = currentUser().id; return (S.railState && S.railState[uid]) || {}; }

  // Palette search
  const SEARCH_CAP = 8;
  function search(q) {
    q = (q || '').trim().toLowerCase(); if (q.length < 3) return [];
    retireChip('find');
    const out = [];
    for (const s of S.synonyms) if (s.term.includes(q) || s.target.toLowerCase().includes(q)) out.push({ kind: 'action', label: s.target, syn: s.term + ' — called that in ' + s.source, route: s.route, irreversible: false });
    for (const a of S.actions) if (a.label.toLowerCase().includes(q)) out.push({ kind: 'action', label: a.label, route: a.route, irreversible: !!a.irreversible });
    for (const p of S.patients) if (p.name.toLowerCase().includes(q) || p.phone.endsWith(q) || p.mrn.toLowerCase().includes(q)) out.push({ kind: 'patient', label: p.name, syn: 'DOB ' + Proto.ui.longDate(p.dob) + ' · …' + p.phone.slice(-4), patientId: p.id });
    for (const c of S.claims) if (c.id.includes(q) || (c.payer || '').toLowerCase().includes(q)) out.push({ kind: 'claim', label: 'Claim ' + c.id + ' · ' + c.payer, route: 'money' });
    // The list carries whether the cap cut it, so the palette says "capped" only when a row was left out.
    const rows = out.slice(0, SEARCH_CAP);
    Object.defineProperty(rows, 'capped', { value: out.length > SEARCH_CAP });
    return rows;
  }

  // Ensure tables referenced by write() exist
  const TABLES = ['appointmentEvents', 'eligibilityChecks', 'messages', 'approvals', 'approvalsLog', 'allocations', 'allocationIntents', 'statementsDue', 'paymentPlans', 'domainEvents', 'collectionDecisions', 'perioExams', 'tags', 'chartEvents', 'procedures', 'planItems', 'filedNotes', 'claims', 'claimEvents', 'appealPackets', 'disclosures', 'reconciliationMatches', 'controlDecisions', 'dayCloses', 'deposits', 'dayPasses', 'userEntitlements', 'firstRunState', 'ledger', 'credits', 'sessions'];
  const _reset = reset;
  reset = function (seedNum) { const s = _reset(seedNum); for (const t of TABLES) if (!s[t]) s[t] = []; return s; };

  const LICENCE_WORDS = { implant: 'implant', crown_margin: 'crown margin', not_tolerated: 'patient could not tolerate probing', third_molar_absent: 'third molar absent' };
  Proto.store = { reset, get, railStateFor, LICENCE_WORDS, patient, appt, encounter, user, carrierName, currentUser, balances, patientPortion, openCeiling, explain, allocate, charged, liveProcedures, reconcileGate, arrive, seat, reverify, pingChair, postCheckout, evaluateRelease, decideApproval, requestApproval, approvalSentence, requestWriteoff, perioGate, savePerio, addTag, readyForExam, chartPaint, chartUndo, dismissTag, needsAttachment, openSession, pendingApprovalsFor, noteKillers, fileNote, eraPostMatched, eraConfirm, eraHold, eraDispute, buildAppeal, sendAppeal, sendStatement, statementDue, discloseName, matchVariance, clearVariance, reviewDecision, closeDay, previewDayPass, addDayPass, railSteps, retireChip, search, refuse, notFound };
})();
