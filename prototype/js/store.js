/* In-memory store. Every mutation appends rows (never edits money rows), emits a write event,
   and returns either {ok:true, ...} or a refusal {ok:false, code, verb, control, why}. */
(function () {
  const Proto = (window.Proto = window.Proto || {});
  let S = null;
  // Every prefix write() uses starts here; seeded tables (credits cr-1, ERA lines el-1..41) start past their seed ids.
  const ID_START = { le: 5000, cd: 1, ar: 1, pe: 2, ce: 1, pr: 500, tag: 2, nf: 1, dc: 1, cl: 100, ap: 1, ue: 1, dp: 1, dec: 2, msg: 1, ai: 1, ae: 1, el: 100, al: 1, alog: 1, sd: 3, pp: 1, de: 1, cr: 2, cev: 1, pl: 1, dis: 1, rm: 1, dep: 1, ses: 1 };
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
  /* Shared desk: the PIN on the posting control names the poster. Checkout alone carried the rule, so Money Desk posted
     37 ERA rows, write-offs and statements frozen to whoever the persona was while Checkout beside it refused. One rule
     for every posting verb: the PIN is matched against the accounts (a guess never posts) and poster() opens that
     person's session when the rows are written. */
  const shared = () => !!(window.__proto && window.__proto.device === 'shared');
  function requirePin(extras) {
    if (!shared()) return { ok: true, user: currentUser() };
    const pin = extras && extras.pin;
    if (!pin) return refuse('pin_required', 'Enter your PIN to post', 'Enter PIN', 'Shared desk: the PIN mints your own session, so the posting carries your name and not the last person\'s.');
    const who = S.users.find((x) => x.pin && x.pin === String(pin));
    if (!who) return refuse('pin_no_match', 'Retype the PIN — no match', 'Enter PIN', 'No account carries that PIN. The posting freezes the poster the PIN names, so it cannot post under a guess.');
    return { ok: true, user: who };
  }
  const poster = (u) => { if (shared()) { const live = S.sessions.filter((x) => !x.endedAt).pop(); if (!live || live.userId !== u.id) openSession(u.id); } return u; };

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
  const NO_PASS_WHY = 'A temp works under their own day pass: it is the name every record is frozen onto. Until Roles issues one there is nobody to post as.';
  const noPass = (verb) => (currentUser().noPass ? refuse('entitlement', verb, 'Open Roles', NO_PASS_WHY) : null);

  // Balances: three numbers from ledger rows; estimates never join.
  /* One allocation pass serves both the three numbers and Explain, so they cannot disagree: every payment,
     write-off and reversal is applied to open charges oldest first, and each charge knows what reached it.
     Before, balances() called every charge patient-due (a visit awaiting insurance read $183.00 when the
     patient owed nothing) and explain() subtracted every later payment from every earlier charge, so 14 of
     40 patients had an Explain total that disagreed with the Patient due above it. */
  // asOf: the account as it stood at the end of that day (rows posted on or before it), for the Ledger's As-of view.
  function allocate(pid, asOf) {
    const rows = S.ledger.filter((e) => e.patientId === pid && (!asOf || e.posted <= asOf)).slice().sort((a, b) => String(a.effective).localeCompare(String(b.effective)) || String(a.id).localeCompare(String(b.id)));
    const charges = rows.filter((e) => e.kind === 'charge').map((ch) => ({ row: ch, open: ch.amountCents, applied: [], pending: 0, due: 0 }));
    const claimFor = (ch) => S.claims.find((c) => c.patientId === pid && c.cdt === ch.cdt && ['scrubbed', 'submitted', 'pended'].includes(c.status));
    const expected = (ch) => (Number.isFinite(ch.insuranceExpectedCents) ? ch.insuranceExpectedCents : null);
    // A credit that finds no open charge is still money on the account: it lands on the latest charge as an
    // over-payment, or, with no charge at all, in the unapplied pool. Dropping it read a $44 window payment
    // and 16 ERA payments as Credit $0.00 while the rows netted negative.
    let unapplied = 0;
    for (const e of rows) {
      if (e.kind === 'charge') continue;
      let rem = -e.amountCents;                       // credits are stored negative; a reversal is positive and re-opens
      if (e.amountCents > 0) {
        const take = Math.min(unapplied, e.amountCents); unapplied -= take;
        const back = charges.find((c) => c.applied.some((x) => x.id === e.reversesEntryId)) || charges.slice().reverse().find((c) => c.applied.length);
        if (back && e.amountCents - take > 0) { back.open += e.amountCents - take; back.applied.push(e); }
        continue;
      }
      for (const c of charges) { if (rem <= 0) break; if (c.open <= 0) continue; const take = Math.min(rem, c.open); c.open -= take; rem -= take; c.applied.push(e); }
      if (rem > 0) { const last = charges[charges.length - 1]; if (last) { last.open -= rem; last.applied.push(e); } else unapplied += rem; }
    }
    let patientDue = 0, insurancePending = 0;
    for (const c of charges) {
      if (c.open <= 0) continue;
      // A charge the plan is expected to cover waits on insurance, not on the patient. The expected share is
      // written onto the charge when it is released (from the visit's estimate); a claim that is still out is
      // the fallback. A covered prophy read "$183.00 Patient due" when the patient owed nothing.
      const exp = expected(c.row);
      const claim = exp == null ? claimFor(c.row) : null;
      c.pending = exp != null ? Math.min(c.open, exp) : claim ? Math.min(c.open, Math.round(c.row.amountCents * 0.5)) : 0;
      c.due = c.open - c.pending;
      insurancePending += c.pending; patientDue += c.due;
    }
    let credit = unapplied;
    const over = charges.reduce((s, c) => s + Math.min(0, c.open), 0);
    if (over < 0) { credit += -over; }
    for (const cr of S.credits) if (cr.patientId === pid && !cr.fromLedger) credit += -cr.amountCents;
    return { charges, patientDue: Math.max(0, patientDue), insurancePending, credit };
  }
  function balances(pid, asOf) { const a = allocate(pid, asOf); return { patientDue: a.patientDue, insurancePending: a.insurancePending, credit: a.credit }; }
  /* A procedure is charged when the ledger says so, whatever its flag claims. */
  const charged = (p) => !!p.charged || S.ledger.some((e) => e.kind === 'charge' && e.procedureId === p.id);
  function explain(pid, asOf) {
    const out = [];
    for (const c of allocate(pid, asOf).charges) {
      const ch = c.row;
      const ins = c.applied.filter((e) => e.kind === 'insurance_payment');
      const wo = c.applied.filter((e) => e.kind === 'write_off');
      const pp = c.applied.filter((e) => e.kind === 'patient_payment');
      const name = ch.cdt ? (S.cdt[ch.cdt] || [ch.cdt])[0] + (ch.tooth ? ' #' + ch.tooth : '') : 'Visit';
      // One date shape per sentence: the charge and every payment in it read the same way.
      const parts = [name + ' on ' + Proto.ui.longDate(ch.effective) + ': charge ' + Proto.ui.money(ch.amountCents)];
      ins.forEach((e) => parts.push(e.payer + ' paid ' + Proto.ui.money(-e.amountCents) + ' on ' + Proto.ui.longDate(e.effective)));
      // One template per reason code: a computed PPO write-off and a discretionary one are different things.
      wo.forEach((e) => parts.push((WRITEOFF_WORDS[e.reason] || 'write-off') + ' ' + Proto.ui.money(-e.amountCents) + ' (' + (e.reason || 'contractual_ppo').replace(/_/g, ' ') + ')'));
      pp.forEach((e) => parts.push('you paid ' + Proto.ui.money(-e.amountCents) + ' on ' + Proto.ui.longDate(e.effective)));
      // The same split balances() makes: what waits on the plan is never called owed by the patient.
      const owe = c.open < 0 ? c.open : c.due;
      if (c.pending > 0) parts.push('waiting on insurance ' + Proto.ui.money(c.pending));
      parts.push(owe > 0 ? 'you owe ' + Proto.ui.money(owe) : owe < 0 ? 'credit ' + Proto.ui.money(-owe) : c.pending > 0 ? 'nothing due from you yet' : 'paid in full');
      out.push({ chargeId: ch.id, sentence: parts.join('; ') + '.', patientVoice: name + ': ' + (owe > 0 ? 'Your share is ' + Proto.ui.money(owe) + ' after insurance.' : c.pending > 0 ? 'Nothing for you until your plan responds.' : 'Nothing left to pay.') });
    }
    return out;
  }
  const WRITEOFF_WORDS = { contractual_ppo: 'contractual write-off', courtesy: 'courtesy write-off', hardship: 'hardship write-off', prior_period: 'prior-period write-off' };

  // Board
  function arrive(aid) {
    const a = appt(aid); if (!a) return notFound('appointment');
    const off = offline('Wait for the server — the Board is read-only'); if (off) return off;
    const np = noPass('Issue a day pass before arriving'); if (np) return np;
    a.status = 'arrived'; a.arrivedAt = S.clock.time; touch('appointments', aid);
    write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'appointment.arrived', actor: currentUser().name });
    if (a.eligibility === 'amber') a.eligibilityRerun = 'running';
    retireChip('arrive');
    return { ok: true };
  }
  function seat(aid) { const a = appt(aid); if (!a) return notFound('appointment'); const off = offline('Wait for the server — the Board is read-only'); if (off) return off; const np = noPass('Issue a day pass before seating'); if (np) return np; a.status = 'seated'; touch('appointments', aid); write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'appointment.seated', actor: currentUser().name }); retireChip('seat'); return { ok: true }; }
  function reverify(aid) { const a = appt(aid); if (!a) return notFound('appointment'); const off = offline('Wait for the server — eligibility cannot re-run'); if (off) return off; const np = noPass('Issue a day pass before re-verifying'); if (np) return np; a.eligibility = 'green'; a.eligibilityNote = '270/271 re-run at ' + S.clock.time + ': active, deductible met'; touch('appointments', aid); write('eligibilityChecks', { id: id('el'), appointmentId: aid, result: 'active' }); return { ok: true }; }
  function pingChair(aid) {
    const a = appt(aid); if (!a) return notFound('appointment');
    const off = offline('Wait for the server — messages are paused'); if (off) return off;
    const np = noPass('Issue a day pass before pinging'); if (np) return np;
    // Rate-limit this chair, not the message list: the old check looked at the last two messages overall,
    // so pinging a second chair in between let the same chair be pinged again inside the window.
    const mine = S.messages.filter((m) => m.appointmentId === aid && m.kind === 'board.ping_chair');
    const last = mine[mine.length - 1];
    if (last && last.sameQuarter) return refuse('ping_rate', 'Wait 15 minutes — chair already pinged', 'Open the chart', 'One ping per encounter per 15 minutes keeps the operatory usable. Open the chart to see what the writer has so far.');
    write('messages', { id: id('msg'), appointmentId: aid, kind: 'board.ping_chair', to: 'chair ' + a.op, sameQuarter: true });
    return { ok: true };
  }

  // Checkout (flow 4). decision: collect | send_statement | payment_plan | zero_due
  /* What the window decides on: the plan estimate, capped by what the ledger still leaves open plus the visit's
     uncharged fees. The decision row used to freeze the seed estimate ($410) after a write-off had already taken
     the balance to zero, so the Posted card read "Nothing due today, patient portion $410.00". */
  function windowEstimate(aid) {
    const a = appt(aid); if (!a) return null;
    const seed = S.estimates[aid] || { patientCents: a.balanceCents || 0, insuranceCents: 0, writeoffCents: 0 };
    const open = balances(a.patientId).patientDue + S.procedures.filter((p) => p.encounterId === a.encounterId && !charged(p)).reduce((s, p) => s + p.feeCents, 0);
    return Object.assign({}, seed, { patientCents: Math.min(seed.patientCents, open) });
  }
  function postCheckout(aid, form) {
    const a = appt(aid); if (!a) return notFound('appointment');
    const est = windowEstimate(aid);
    let u = currentUser();
    const off = offline('Wait for the server — postings are paused'); if (off) return off;
    if (u.noPass) return refuse('entitlement', 'Issue a day pass before posting', 'Open Roles', 'A temp posts under their own day pass. Until Roles issues one there is no identity to freeze onto the posting.');
    const pin = requirePin(form); if (!pin.ok) return pin; u = pin.user;
    if (form.decision !== 'zero_due' && est.patientCents === 0) return refuse('zero_collect_refused', 'Choose Nothing due today', 'Nothing due today', 'Nothing is due, so a payment, a statement or a plan would post money for nothing; the typed decision keeps the window honest.');
    if (form.decision === 'collect' && !form.tender) return refuse('tender_required', 'Choose a tender', 'Choose card', 'The tender is what the day sheet reconciles against the bank, so a payment cannot post without one.');
    if (S.collectionDecisions.some((d) => d.encounterId === a.encounterId)) return refuse('already_decided', 'Correct this visit from the ledger', 'Open the ledger', 'One typed decision per visit. To change what was collected, post a correction from the ledger: a reversal and a repost, both linked to the original.');
    const encId = a.encounterId; const enc = encounter(encId);
    const procs = S.procedures.filter((p) => p.encounterId === encId);
    // Write-off gate (dual release inside the posting transaction). The request row is written when the
    // biller presses Request approval, not here: writing it at Post created an approval nobody asked for
    // and left the control itself a no-op.
    if (form.writeoffCents && form.writeoffCents > 0) {
      const gate = evaluateRelease('write_off', form.writeoffCents, u);
      if (!gate.ok) return Object.assign(refuse(gate.code, gate.verb, 'Request approval', gate.why), { held: true, pendingRequest: { kind: 'write_off', amountCents: form.writeoffCents, reason: form.writeoffReason || 'courtesy', patientId: a.patientId, eligible: gate.eligible, appointmentId: aid, form } });
    }
    // Post: charges (if note filed), payment, allocations, decision, self-pay flags in one transaction
    const noteFiled = enc && enc.noteFiled;
    poster(u);
    const rows = [];
    // charged() is the ledger, not a flag: the seed marks a crown "completed" without setting charged, so the
    // old test re-charged it and a patient who paid $410 in full walked out owing $1,180.
    const toCharge = noteFiled ? procs.filter((p) => !charged(p)) : [];
    const feeTotal = toCharge.reduce((s, p) => s + p.feeCents, 0);
    for (const p of toCharge) { p.charged = true; touch('procedures', p.id); rows.push(write('ledger', { id: id('le'), kind: 'charge', patientId: a.patientId, amountCents: p.feeCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, procedureId: p.id, cdt: p.cdt, tooth: p.tooth, insuranceExpectedCents: feeTotal ? Math.round((est.insuranceCents || 0) * p.feeCents / feeTotal) : 0 })); }
    if (form.decision === 'collect') {
      const amt = form.amountCents || est.patientCents;
      // Allocation defaults oldest-open across the account, not only the charges this Post released: a $410
      // payment on a crown already on the ledger used to post with no allocation row at all.
      const open = noteFiled ? allocate(a.patientId).charges.filter((c) => c.open > 0) : [];
      const pay = write('ledger', { id: id('le'), kind: 'patient_payment', patientId: a.patientId, amountCents: -amt, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, tender: form.tender, gl: noteFiled ? 'patient_ar' : 'unapplied_credit' });
      if (noteFiled) { let rem = amt; for (const c of open) { if (rem <= 0) break; const alloc = Math.min(rem, c.open); write('allocations', { id: id('al'), paymentId: pay.id, chargeId: c.row.id, amountCents: alloc }); rem -= alloc; } }
      else write('allocationIntents', { id: id('ai'), paymentId: pay.id, encounterId: encId, amountCents: amt });
    }
    if (form.decision === 'send_statement') write('statementsDue', { id: id('sd'), patientId: a.patientId, amountCents: est.patientCents, reason: 'window_deferred', createdBy: u.name, created: S.tenant.today });
    if (form.decision === 'payment_plan') write('paymentPlans', { id: id('pp'), patientId: a.patientId, amountCents: est.patientCents, cadence: form.cadence || 'monthly', eligibleBucket: 'patient_ar', createdBy: u.name });
    for (const pid of form.selfPay || []) { const p = S.procedures.find((x) => x.id === pid); if (p) { p.selfPayRestricted = true; p.restrictedAt = S.tenant.today; write('domainEvents', { id: id('de'), type: 'procedure.self_pay_restricted', procedureId: pid }); } }
    if (form.writeoffCents > 0) write('ledger', { id: id('le'), kind: 'write_off', patientId: a.patientId, amountCents: -form.writeoffCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, reason: form.writeoffReason || 'courtesy', approvalRequestId: form.approvalRequestId || null });
    write('collectionDecisions', { id: 'cd-' + nextId.cd++, encounterId: encId, decision: form.decision, patientPortionCents: est.patientCents, decidedBy: u.name, decidedAt: S.tenant.today + ' ' + S.clock.time, statementDueId: null, paymentPlanId: null });
    a.status = noteFiled ? 'checked_out' : 'checked_out_unfiled'; touch('appointments', aid);
    // The credit row exists only when money moved: a statement or plan on an unfiled visit takes no payment.
    if (!noteFiled && form.decision === 'collect' && !S.credits.find((c) => c.patientId === a.patientId && c.reason.includes(aid))) write('credits', { id: id('cr'), patientId: a.patientId, amountCents: -(form.amountCents || est.patientCents || 0), reason: 'Checked out unfiled: payment waiting for charges (' + aid + ')', intents: 'pending charges on ' + encId, fromLedger: true });
    retireChip('checkout'); if (form.decision === 'collect') retireChip('payment');
    return { ok: true, taps: 0 };
  }
  /* Written when the biller presses Request approval, so the control does the thing its label promises. */
  function requestApproval(pending, who) {
    if (!pending) return notFound('request');
    const off = offline('Wait for the server — approvals are paused'); if (off) return off;
    const u = who || currentUser();
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
    return 'Write-off ' + Proto.ui.money(req.amountCents) + ' on ' + name + ' (' + (req.reason || 'courtesy') + ') requested by ' + req.requestedBy + ' at ' + Proto.ui.time(req.requestedAt || S.clock.time);
  }

  // Dual release evaluator (precog evaluateRelease, simplified)
  /* opts.contractual: the amount is computed from the fee schedule (an ERA delta), so the threshold does not
     apply; the after-hours hold still does. `eligible` is the two seats the biller is told to ask, ranked
     office manager first: one list feeds the verb, the Held chip and the phone card, so they cannot disagree. */
  function evaluateRelease(channel, amountCents, actor, opts) {
    const threshold = S.tenant.dualReleaseThresholdCents;
    const RANK = { office_manager: 0, owner: 1, dentist: 2, surgeon: 3 };
    const eligible = S.users.filter((x) => x.entitlements.includes('approve_second') && x.id !== actor.id)
      .sort((a, b) => (RANK[a.role] == null ? 9 : RANK[a.role]) - (RANK[b.role] == null ? 9 : RANK[b.role]))
      .map((x) => x.short).slice(0, 2);
    if (S.clock.afterHours && ['write_off', 'refund', 'adjustment'].includes(channel)) return { ok: false, code: 'after_hours', verb: 'Held until 7:30 am — after hours', why: 'Refunds, adjustments, and write-offs outside business hours are held regardless of amount. Policy set by Dr. Reagan, reviewed 8/4.', eligible };
    // Two short names at most, so the verb never runs past eight words.
    if (amountCents >= threshold && !(opts && opts.contractual)) return { ok: false, code: 'needs_second', verb: 'Ask ' + eligible.join(' or ') + ' to approve', why: 'Write-offs at or above ' + Proto.ui.money(threshold) + ' need a distinct second approver (control policy v3, set by Dr. Reagan on 8/4, review due 9/1). Approvals here usually take about 4 minutes.', eligible };
    return { ok: true, code: 'below_threshold', eligible };
  }
  /* An approver who sends a request back says why: the biller reads the reason on the write-off card, and
     without it the card could name who sent it back but not their line. The reason rides on the request and
     on the log row, so the decision and its reason are one record. */
  function decideApproval(reqId, approverId, decision, stepup, reason) {
    const r = S.approvals.find((x) => x.id === reqId); if (!r) return notFound('request');
    const off = offline('Wait for the server — approvals are paused'); if (off) return off;
    const approver = user(approverId) || currentUser();
    if (r.requestedById === approver.id) return refuse('blocked_same_person', 'Ask someone else to approve this', 'Send back', 'You requested it, so you cannot be its second approver. The rule is enforced on the posting itself, not just on this screen.');
    // A step-up is a challenge, not a refusal: it carries no gate identity and never reached the shared component.
    if (!stepup) return { ok: false, needsStepup: true, verb: 'Enter your PIN to approve', why: 'Approvals above the high-value band re-verify within two minutes.' };
    if (r.status && r.status !== 'pending') return refuse('already_decided', 'Open the ledger to correct this', 'Open the ledger', 'This request was already ' + r.status + ' by ' + (r.decidedBy || 'someone') + '. Deciding it twice would post the write-off twice; a correction is a reversal and a repost.');
    // The reason rides on the request and on the log row, so the decision and its reason are one record. It is
    // carried, not yet required: the control that collects it lives on the approver's card, which the phone
    // screen has still to grow, and a gate on a word the product does not use yet would guard nothing.
    const why = String(reason || '').trim();
    r.status = decision; r.decidedBy = approver.name; r.decidedAt = S.clock.time; if (why) r.decisionReason = why; touch('approvals', r.id);
    write('approvalsLog', { id: id('alog'), requestId: reqId, decision, by: approver.name, reason: why || null });
    if (decision === 'approved') {
      const a = appt(r.appointmentId);
      write('ledger', { id: id('le'), kind: 'write_off', patientId: r.patientId, amountCents: -r.amountCents, effective: S.tenant.today, posted: S.tenant.today, actor: r.requestedBy, actorKind: 'user', locationId: a ? a.locationId : 'loc-1', reason: r.reason, approvalRequestId: reqId, secondApprover: approver.name });
    }
    return { ok: true };
  }
  function requestWriteoff(accountPid, amountCents, reason, extras) {
    if (!patient(accountPid)) return notFound('patient');
    const off = offline('Wait for the server — postings are paused'); if (off) return off;
    const pin = requirePin(extras); if (!pin.ok) return pin; const u = pin.user;
    if (!Number.isFinite(amountCents) || amountCents <= 0) return refuse('amount_required', 'Type an amount above zero', 'Go to amount', 'A write-off posts the number you type against the balance, so it cannot be blank, negative, or zero.');
    // A write-off retires what the patient owes and no more: $1,000 against a $410 balance posted and hid a −$590 net.
    const due = balances(accountPid).patientDue;
    if (amountCents > due) return refuse('amount_required', 'Type an amount up to ' + Proto.ui.money(due), 'Go to amount', 'The patient owes ' + Proto.ui.money(due) + ' on this account. A write-off above the balance would post a credit nobody paid; a refund or a correction is a different posting.');
    const gate = evaluateRelease('write_off', amountCents, u);
    if (!gate.ok) {
      const req = requestApproval({ kind: 'write_off', amountCents, reason, patientId: accountPid, eligible: gate.eligible, appointmentId: null }, poster(u));
      return Object.assign(refuse(gate.code, gate.verb, 'Request approval', gate.why), { requestId: req.requestId, held: true });
    }
    poster(u);
    write('ledger', { id: id('le'), kind: 'write_off', patientId: accountPid, amountCents: -amountCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: 'loc-1', reason });
    return { ok: true };
  }

  // Perio (flow 2)
  function savePerio(encId, sites, extras) {
    const enc = encounter(encId); if (!enc) return notFound('encounter');
    const off = offline('Wait for the server — the exam cannot save'); if (off) return off;
    const entries = Object.entries(sites);
    const probed = entries.filter(([, v]) => v && v.depth != null).length;
    const skipped = entries.filter(([, v]) => v && v.skipped).length;
    const bleeding = entries.filter(([, v]) => v && v.bleed).length;
    const deepest = Math.max(0, ...entries.map(([, v]) => (v && v.depth) || 0));
    if (skipped > 0 && !(extras && extras.licence)) return refuse('omission_licence', 'Name why ' + skipped + (skipped === 1 ? ' site was' : ' sites were') + ' not probed', 'Choose a reason', 'A blank is never forced into a fabrication: pick implant, crown margin, patient could not tolerate, or third molar absent.');
    const mode = (extras && extras.mode) || 'full';
    const codes = entries.filter(([, v]) => v && v.code != null).map(([, v]) => v.code);
    const prior = S.perioExams.filter((e) => e.encounterId === encId).pop();
    // Save is once only: a second Save on a saved chart is an addendum or nothing. The screen swapped the button
    // for Amend, but two dispatches of one Save wrote two exams.
    if (prior && !(extras && extras.amending)) return refuse('exam_sealed', 'Amend the saved exam with an addendum', 'Start an addendum', 'This visit already carries a saved exam. A saved exam is the record; a change is a dated addendum that links to it, never a second exam.');
    const amends = prior ? prior.id : null;
    // A licence explains skipped sites; with none skipped there is nothing for it to explain.
    const licence = skipped > 0 ? extras.licence : null;
    const exam = write('perioExams', { id: 'pe-' + nextId.pe++, patientId: enc.patientId, encounterId: encId, date: S.tenant.today, sites, probed, skipped, bleeding, deepest, sextantCodes: codes, licence, mode, author: currentUser().name, amendsExamId: amends, kind: amends ? 'addendum' : 'exam' });
    S.notes[encId] = S.notes[encId] || {};
    if (mode === 'screening') {
      const worst = codes.length ? Math.max(...codes.map((x) => Number(x) || 0)) : null;
      const MEAN = { 0: 'healthy', 1: 'bleeding on probing', 2: 'calculus or defective margin', 3: 'pocket 4 to 5 mm', 4: 'pocket 6 mm or deeper' };
      S.notes[encId].perioSummary = 'Perio screening: ' + codes.length + ' sextants scored (' + codes.join(', ') + ')' + (worst != null ? ', highest ' + worst + ' — ' + (MEAN[worst] || 'see chart') : '') + '.';
      if (worst != null && worst >= 3) S.notes[encId].srpEvidence = 'Screening code ' + worst + ' indicates a full six-point chart before periodontal therapy.';
    } else {
      // The prior exam is named by its date and author, never by its row id: the note is a clinical record.
      S.notes[encId].perioSummary = (amends ? 'Perio addendum to the ' + Proto.ui.longDate(prior.date) + ' exam (' + currentUser().name + ', ' + Proto.ui.longDate(S.tenant.today) + '): ' : 'Perio: ') + probed + ' sites probed, deepest ' + deepest + ' mm, bleeding at ' + bleeding + (bleeding === 1 ? ' site' : ' sites') + (skipped ? ', ' + skipped + (skipped === 1 ? ' site' : ' sites') + ' not probed (' + LICENCE_WORDS[licence] + ')' : '') + '.';
    }
    if (deepest >= 5) { const deep = entries.filter(([, v]) => v && v.depth >= 5).length; S.notes[encId].srpEvidence = 'SRP evidence: ' + deep + (deep === 1 ? ' site' : ' sites') + ' at or above 5 mm.'; }
    touch('notes', encId);
    retireChip('perio'); retireChip('save');
    return { ok: true, exam };
  }
  function addTag(encId, tooth, surfaces, text) { if (!encounter(encId)) return notFound('encounter'); const off = offline('Wait for the server — the tag cannot save'); if (off) return off; const t = write('tags', { id: 'tag-' + nextId.tag++, encounterId: encId, tooth, surfaces, text, author: currentUser().name, disposition: null }); retireChip('tag'); return { ok: true, tag: t }; }
  function readyForExam(aid) { const a = appt(aid); if (!a) return notFound('appointment'); const off = offline('Wait for the server — the exam queue is read-only'); if (off) return off; a.status = 'ready_for_exam'; touch('appointments', aid); write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'encounter.exam_requested', actor: currentUser().name }); retireChip('ready'); return { ok: true }; }

  // Encounter (flow 3)
  // Services that belong to the visit, not to a tooth.
  const WHOLE_PATIENT = ['d0120', 'd0140', 'd0274', 'd1110', 'd9230', 'd9243'];
  const wholePatient = (cdtCode) => WHOLE_PATIENT.includes(cdtCode);
  const liveEvents = (encId) => S.chartEvents.filter((c) => c.encounterId === encId && !c.reversed && c.kind !== 'reversal');
  const sameSurfaces = (a, b) => (a || []).slice().sort().join('') === (b || []).slice().sort().join('');
  function chartPaint(encId, tooth, surfaces, cdtCode, temporality) {
    const enc = encounter(encId); if (!enc) return notFound('encounter');
    const off = offline('Wait for the server — charting is paused'); if (off) return off;
    if (!S.cdt[cdtCode]) return refuse('licence_scope', 'Choose a procedure from the list', 'Open the procedure list', 'Only codes on the practice fee schedule can be charted; an unknown code would write a procedure with no fee and no claim line.');
    const fee = (S.cdt[cdtCode] || [null, 0])[1];
    if (wholePatient(cdtCode)) { tooth = null; surfaces = []; }
    temporality = temporality || 'today';
    // A duplicate is the same code, tooth and surfaces already standing on this visit: a live paint (the reversed
    // ones no longer count) or a procedure the visit carried before the chart was opened. The verb names no
    // procedure: interpolating it ran the line to ten words on a two-surface composite.
    const same = (o) => o.cdt === cdtCode && (o.tooth == null ? tooth == null : o.tooth === tooth) && sameSurfaces(o.surfaces, surfaces);
    const what = (S.cdt[cdtCode] || [cdtCode])[0] + (tooth ? ' #' + tooth : '');
    const painted = liveEvents(encId).find(same);
    if (painted) return Object.assign(refuse('duplicate_paint', 'Undo the first one to change it', 'Undo the first one', 'Already charted this visit: ' + what + '. One gesture writes one chart event, one procedure, one plan line and one pending charge. Charting it twice would bill it twice.'), { undoable: true, chartEventId: painted.id });
    const onVisit = S.procedures.find((p) => p.encounterId === encId && !p.reversed && !p.chartEventId && same(p));
    if (onVisit) return refuse('duplicate_paint', 'Choose another code — already on this visit', 'Go to the procedures', 'Already on this visit: ' + what + ', recorded before the chart was opened. Charting it again would bill it twice; it releases at File as it stands.');
    const ce = write('chartEvents', { id: 'ce-' + nextId.ce++, encounterId: encId, tooth, surfaces, cdt: cdtCode, temporality, author: currentUser().name });
    let proc = null, plan = null;
    if (temporality === 'today') proc = write('procedures', { id: 'pr-' + nextId.pr++, encounterId: encId, patientId: enc.patientId, cdt: cdtCode, tooth, surfaces, feeCents: fee, status: 'completed_pending_charge', selfPayRestricted: false, chartEventId: ce.id });
    // Existing is history: no plan item, no charge, no module, and it dispositions no finding.
    if (temporality !== 'existing') {
      const pat = patient(enc.patientId);
      const carrier = pat && pat.primary ? carrierName(pat.primary) : null;
      const share = carrier ? 0.5 : 1;
      const est = Math.round(fee * share);
      const trace = carrier
        ? carrier + ' PPO: 50% after deductible (met) → patient est. ' + Proto.ui.money(est)
        : 'Self-pay, no coverage on file → patient est. ' + Proto.ui.money(est);
      plan = write('planItems', { id: id('pl'), encounterId: encId, tooth, surfaces, cdt: cdtCode, estimateCents: est, ruleTrace: trace, temporality });
      for (const t of S.tags) if (t.encounterId === encId && t.tooth === tooth && !t.disposition) { t.disposition = 'charted'; touch('tags', t.id); }
    }
    S.notes[encId] = S.notes[encId] || {};
    const line = what + (surfaces && surfaces.length ? ' ' + surfaces.join('') : '') + (temporality === 'existing' ? ' (existing, placed elsewhere)' : temporality === 'planned' ? ' (planned)' : '');
    S.notes[encId].procedures = (S.notes[encId].procedures || []).concat([line]);
    S.notes[encId].procedure = S.notes[encId].procedures.join('; ');
    touch('notes', encId);
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
    const live = liveEvents(encId);
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
    for (const t of S.tags) if (t.encounterId === encId && t.tooth === ce.tooth && t.disposition === 'charted') { t.disposition = null; touch('tags', t.id); }
    return { ok: true, reversal: rev, supersedes: ce.id, procedure: proc || null, plan: plan || null };
  }
  /* Dismissing a hygienist's finding is a change to the record, so the store writes it and the reason is
     required: the screen used to set the disposition on the seed row itself. */
  function dismissTag(tagId, reason) {
    const t = S.tags.find((x) => x.id === tagId); if (!t) return notFound('request');
    const off = offline('Wait for the server — dismissals are paused'); if (off) return off;
    // The disposition carries the dentist's attribution: the hygienist who raised the finding cannot close it.
    if (!dentistLike(currentUser())) return refuse('licence_scope', 'Ask the dentist to disposition this', 'Send to Exams to sign', 'A hygienist finding is dispositioned by the dentist who examines it, under their licence: charted, or seen with a reason. Sending the chair to Exams to sign puts it in the dentist\'s queue.');
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
  const dentistLike = (u) => ['dentist', 'owner', 'surgeon'].includes(u.role);
  function noteKillers(encId, note) {
    const enc = encounter(encId); const killers = [];
    const u = currentUser();
    // Every verb line starts with its verb: the audit measured 19 of 39 gates opening on a noun, a pronoun
    // or a gerund, which reads as a description of the problem rather than the thing to do next.
    for (const t of S.tags) if (t.encounterId === encId && !t.disposition) killers.push({ code: 'tag_undispositioned', verb: 'Chart or dismiss tag #' + t.tooth, control: 'Chart it or dismiss', fix: 'tag' });
    const text = ((note && note.assessment) || '') + ' ' + ((note && note.plan) || '');
    if (/\$\s?\d/.test(text) || /\b(fee|cost|price|estimate|copay)\b/i.test(text)) killers.push({ code: 'money_in_note', verb: 'Move the fee to the plan card', control: 'Move to plan card', fix: 'money' });
    // Standing paints only: a reversed paint is not a tooth the chart names.
    const toothed = liveEvents(encId).filter((c) => c.tooth != null);
    const m = text.match(/#(\d{1,2})/);
    if (m && toothed.length && !toothed.some((c) => c.tooth === Number(m[1]))) {
      const c = toothed[0];
      killers.push({ code: 'contradiction', verb: 'Use the chart tooth #' + c.tooth, control: 'Use chart tooth', fix: 'contradiction', why: 'The note says #' + m[1] + ' and the chart says #' + c.tooth + '. A wrong-tooth claim is denied or paid wrongly, so the two must agree before filing.', noteTooth: Number(m[1]), chartTooth: c.tooth });
    }
    if (!(note && note.assessment && note.assessment.trim().length)) killers.push({ code: 'assessment_required', verb: 'Add an assessment', control: 'Add assessment', fix: 'assessment' });
    if (!dentistLike(u)) killers.push({ code: 'licence_scope', verb: 'Send to a dentist to file', control: 'Send to Exams to sign', fix: 'licence' });
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
      // Privacy mode covers the gate copy too: the date of birth stays off the Why when the header hides it.
      return Object.assign(refuse('readback', 'Confirm the author and the patient', 'Confirm and file', 'Filing as ' + currentUser().name + ' for ' + whoName + (who && who.dob && !pr ? ', born ' + Proto.ui.longDate(who.dob) : '') + '. The read-back repeats both so a stale author on a shared device is caught at the last gate.'), { readback: { author: currentUser().name, patient: whoName } });
    }
    enc.noteFiled = true; enc.status = 'signed'; touch('encounters', enc.id);
    const a = appt(enc.appointmentId); if (a) { a.status = a.status === 'checked_out_unfiled' ? 'checked_out' : 'note_filed'; touch('appointments', a.id); }
    const filed = write('filedNotes', { id: 'nf-' + nextId.nf++, encounterId: encId, author: currentUser().name, filedOn: S.tenant.today, filedTime: S.clock.time, rulesetVersion: '2.25.2', byteauditOk: true, markdown: [note.assessment, note.plan, S.notes[encId] && S.notes[encId].procedure, S.notes[encId] && S.notes[encId].perioSummary].filter(Boolean).join('\n') });
    // Release every charge this note holds, not only the ones painted this session: a seeded procedure sat
    // "completed" and uncharged forever, so filing wrote no ledger row and the patient's credit never applied.
    // A reversed paint is not work done, so it never releases.
    const release = S.procedures.filter((p) => p.encounterId === encId && !p.reversed && !charged(p));
    const relTotal = release.reduce((s, p) => s + p.feeCents, 0);
    const relEst = S.estimates[enc.appointmentId] || { insuranceCents: 0 };
    // What the plan is expected to cover comes from the paint's own plan card; the visit estimate is the fallback
    // for procedures the seed carried in. A charge released with 0 read "Patient due $260.00" beside a plan card
    // that said the plan pays $130.00.
    const expectedFor = (p) => { const pl = S.planItems.find((x) => x.encounterId === encId && x.cdt === p.cdt && x.tooth === p.tooth && x.temporality === 'today' && !x.reversed); return pl ? Math.max(0, p.feeCents - pl.estimateCents) : relTotal ? Math.round((relEst.insuranceCents || 0) * p.feeCents / relTotal) : 0; };
    for (const p of release) { p.status = 'completed'; p.charged = true; touch('procedures', p.id); write('ledger', { id: id('le'), kind: 'charge', patientId: enc.patientId, amountCents: p.feeCents, effective: enc.dos, posted: S.tenant.today, actor: currentUser().name, actorKind: 'file_event', locationId: enc.locationId, procedureId: p.id, cdt: p.cdt, tooth: p.tooth, releasedByNoteId: filed.id, insuranceExpectedCents: expectedFor(p) });
      // A payment taken before the note was filed is waiting as an intent; filing is what lets it land.
      for (const intent of S.allocationIntents.filter((x) => x.encounterId === encId && !x.appliedTo)) { intent.appliedTo = p.id; touch('allocationIntents', intent.id); const cr = S.credits.find((c) => c.patientId === enc.patientId && c.intents && c.intents.includes(encId)); if (cr) { cr.fromLedger = true; cr.applied = true; touch('credits', cr.id); } }
    }
    // A claim names the charges it bills: with nothing released, or no plan on file, there is no claim to queue.
    const payer = (patient(enc.patientId) || {}).primary;
    let claim = null;
    if (release.length && payer) claim = write('claims', { id: 'c-' + nextId.cl++, patientId: enc.patientId, encounterId: encId, status: 'scrubbed', cdt: release[0].cdt, lines: release.map((p) => p.cdt), amountCents: relTotal, payer: carrierName(payer), submitted: S.tenant.today, age: 0, nextAction: 'Queued to clearinghouse' });
    return { ok: true, filed, released: release.length, claim };
  }

  // Money Desk (flow 5)
  /* Post matched now posts: it writes the ledger rows for the lines it claims are already posted, and logs the
     batch state change. Before, it flipped a status, said "37 posted", and left the ledger untouched. */
  function eraPostMatched(batchId, extras) {
    const b = S.eraBatches.find((x) => x.id === batchId); if (!b) return notFound('claim');
    const off = offline('Wait for the server — postings are paused'); if (off) return off;
    if (b.status === 'deltas' || b.status === 'posted') return refuse('already_decided', 'Confirm the delta lines below', 'Go to the deltas', 'The matched lines of this batch are already posted. What is left is the lines where the payer differs from the claim.');
    const pin = requirePin(extras); if (!pin.ok) return pin; const u = poster(pin.user); let posted = 0;
    // A line is posted when its ledger row exists: the status flips here, with the row, never in the seed.
    for (const l of S.eraLines.filter((x) => x.batchId === batchId && x.status === 'matched')) {
      if (!S.ledger.some((e) => e.eraLineId === l.id)) write('ledger', { id: id('le'), kind: 'insurance_payment', patientId: l.patientId, amountCents: -l.paidCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: 'loc-1', payer: b.payer, eraLineId: l.id, gl: 'ins_ar_primary' });
      l.status = 'posted'; touch('eraLines', l.id);
      posted++;
    }
    b.status = 'deltas'; touch('eraBatches', b.id);
    return { ok: true, readback: S.eraLines.filter((l) => l.batchId === batchId && l.status === 'delta'), posted };
  }
  /* The word on screen and the status in the record agree: once no delta line is left the batch is posted. */
  function settleBatch(batchId) { const b = S.eraBatches.find((x) => x.id === batchId); if (b && b.status === 'deltas' && !S.eraLines.some((l) => l.batchId === batchId && l.status === 'delta')) { b.status = 'posted'; touch('eraBatches', b.id); } }
  function eraConfirm(lineId, extras) {
    const l = S.eraLines.find((x) => x.id === lineId); if (!l) return notFound('claim'); const off = offline('Wait for the server — postings are paused'); if (off) return off;
    if (l.status === 'posted') return refuse('already_decided', 'Open the ledger to correct this', 'Open the ledger', 'This line is posted. A correction is a reversal and a repost, both linked to the original.');
    const pin = requirePin(extras); if (!pin.ok) return pin;
    // A contractual write-off is still a write-off: the after-hours hold applies to it as to any other.
    const gate = evaluateRelease('write_off', l.expectedCents - l.paidCents, pin.user, { contractual: true });
    if (!gate.ok) return refuse(gate.code, gate.verb, 'Set aside', gate.why);
    const u = poster(pin.user);
    l.status = 'posted'; touch('eraLines', l.id);
    write('ledger', { id: id('le'), kind: 'insurance_payment', patientId: l.patientId, amountCents: -l.paidCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: 'loc-1', payer: 'Delta Dental', eraLineId: lineId, gl: 'ins_ar_primary' });
    write('ledger', { id: id('le'), kind: 'write_off', patientId: l.patientId, amountCents: -(l.expectedCents - l.paidCents), effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: 'loc-1', reason: 'contractual_ppo', eraLineId: lineId });
    settleBatch(l.batchId);
    return { ok: true };
  }
  function eraHold(lineId, extras) { const l = S.eraLines.find((x) => x.id === lineId); if (!l) return notFound('claim'); const off = offline('Wait for the server — the line cannot be held'); if (off) return off; const pin = requirePin(extras); if (!pin.ok) return pin; const u = poster(pin.user); l.status = 'held'; touch('eraLines', l.id); write('claimEvents', { id: id('cev'), claimId: l.claimId, kind: 'era.line_held', actor: u.name }); settleBatch(l.batchId); return { ok: true }; }
  /* Dispute writes the appeal row its Why promises: one packet per line, citing the fee-schedule line the payer paid under.
     It used to write the claim event alone, so the decided row said "An appeal row cites the fee-schedule line" over none. */
  function eraDispute(lineId, extras) {
    const l = S.eraLines.find((x) => x.id === lineId); if (!l) return notFound('claim'); const off = offline('Wait for the server — the dispute cannot send'); if (off) return off;
    const pin = requirePin(extras); if (!pin.ok) return pin; const u = poster(pin.user);
    l.status = 'disputed'; touch('eraLines', l.id);
    write('claimEvents', { id: id('cev'), claimId: l.claimId, kind: 'era.contract_variance_disputed', actor: u.name });
    const packet = S.appealPackets.find((p) => p.eraLineId === lineId) || write('appealPackets', { id: id('ap'), claimId: l.claimId, eraLineId: lineId, kind: 'contract_variance', slots: { feeSchedule: true, eraSegment: true, letter: true }, citation: 'Fee schedule allows ' + Proto.ui.money(l.expectedCents) + ' for ' + l.cdt.toUpperCase() + '; ERA paid ' + Proto.ui.money(l.paidCents) + ' (CARC ' + l.carc + ')', patientSentence: 'We are asking your plan about the amount it paid. You owe nothing while they review.' });
    settleBatch(l.batchId);
    return { ok: true, packet };
  }
  // One packet per claim: pressing Appeal four times wrote four packets and renamed the drawer each time.
  function buildAppeal(claimId) { const c = S.claims.find((x) => x.id === claimId); if (!c) return notFound('claim'); const existing = S.appealPackets.find((p) => p.claimId === claimId); if (existing) return { ok: true, packet: existing, already: true }; const pk = write('appealPackets', { id: id('ap'), claimId, slots: { perioChart: c.hasPerioChart, narrative: c.hasNarrative, radiograph: true, letter: true }, patientSentence: 'Delta asked for your gum chart; we are sending it. You owe nothing while they review.' }); return { ok: true, packet: pk }; }
  function sendAppeal(claimId, extras) { const c = S.claims.find((x) => x.id === claimId); if (!c) return notFound('claim'); const off = offline('Wait for the server — the appeal cannot send'); if (off) return off; if (c.status === 'appealed') return refuse('already_decided', 'Wait for the payer to answer', 'Open the claim', 'This appeal was already sent. Sending it twice does not speed it up and starts a second review.'); const pin = requirePin(extras); if (!pin.ok) return pin; const u = poster(pin.user); c.status = 'appealed'; touch('claims', c.id); write('claimEvents', { id: id('cev'), claimId, kind: 'claim.appealed', actor: u.name }); write('disclosures', { id: id('dis'), patientId: c.patientId, channel: 'clearinghouse', purpose: 'payment', recordIds: ['pe-1', 'nf-old'], actor: u.name }); return { ok: true }; }
  /* A row action on a claim is a claim event with a new next action, so Fix, Attach and resubmit, Call payer and Escalate
     write what they did; each used to announce and change nothing. A corrected or re-attached claim goes back to the payer. */
  const CLAIM_ACTION = { fix: ['Corrected and resubmitted; wait for the 277', 'submitted'], attach: ['Attachment sent with the resubmission; wait for the 277', 'submitted'], call: ['Called the payer; follow up in 7 days', null], escalate: ['Escalated to provider relations; timely-filing hold noted', null] };
  function claimAction(claimId, action, extras) {
    const c = S.claims.find((x) => x.id === claimId); if (!c) return notFound('claim');
    const step = CLAIM_ACTION[action]; if (!step) return notFound('claim');
    const off = offline('Wait for the server — claims are read-only'); if (off) return off;
    const pin = requirePin(extras); if (!pin.ok) return pin; const u = poster(pin.user);
    c.nextAction = step[0];
    if (step[1] && ['denied', 'pended', 'submitted'].includes(c.status)) { c.status = step[1]; c.age = 0; c.submitted = S.tenant.today; }
    touch('claims', c.id);
    write('claimEvents', { id: id('cev'), claimId, kind: 'claim.' + action, actor: u.name, at: S.tenant.today + ' ' + S.clock.time });
    return { ok: true };
  }
  /* A name shown after a "logged read" is logged here: the phone card and Daily Close call this when they reveal
     a patient, so the disclosures table is the record the label promises. */
  function disclose({ patientId, purpose, recordIds } = {}) {
    const row = write('disclosures', { id: id('dis'), patientId: patientId || null, channel: 'screen', purpose: purpose || 'treatment', recordIds: recordIds || [], actor: currentUser().name });
    return { ok: true, id: row.id };
  }
  function sendStatement(sdId, extras) {
    const s = S.statementsDue.find((x) => x.id === sdId); if (!s) return notFound('patient'); const off = offline('Wait for the server — statements cannot send'); if (off) return off;
    if (s.sent) return refuse('already_decided', 'Wait for this statement to land', 'Open the ledger', 'This statement was sent at ' + (s.sentAt || S.clock.time) + '. A second copy of the same balance confuses the patient and the phone call that follows.');
    const pin = requirePin(extras); if (!pin.ok) return pin;
    // The statement bills the live balance, not the figure frozen when the row was raised: an 835 that settled
    // the account in between used to leave an $84.00 statement sendable on a $0.00 balance.
    const due = balances(s.patientId).patientDue;
    if (due === 0) return refuse('zero_collect_refused', 'Nothing due — no statement to send', 'Open the ledger', 'The balance this row was raised for has since settled. A statement for $0 is noise to the patient and a disclosure row for nothing; a credit is refunded from Money Desk, never billed.');
    const u = poster(pin.user);
    s.amountCents = due; s.sent = true; s.sentAt = S.clock.time; touch('statementsDue', s.id);
    write('disclosures', { id: id('dis'), patientId: s.patientId, channel: 'mail', purpose: 'payment', recordIds: [sdId], actor: u.name });
    return { ok: true };
  }
  /* A statement is raised here, for the balance the ledger shows, and the Ledger sends the row. The Ledger held an account
     with $410 due and no row behind a gate whose only exit led to a tab with nothing to press; the hold reasons the Ledger
     used to word itself (a claim still out, nothing due) are the store's, once. */
  function raiseStatement(pid, extras) {
    if (!patient(pid)) return notFound('patient');
    const off = offline('Wait for the server — statements cannot raise'); if (off) return off;
    const pin = requirePin(extras); if (!pin.ok) return pin;
    const open = S.statementsDue.find((s) => s.patientId === pid && !s.sent); if (open) return { ok: true, statement: open, already: true };
    const due = balances(pid).patientDue;
    if (due === 0) return refuse('zero_collect_refused', 'Nothing due — no statement to raise', 'Explain', 'A statement for $0 is noise to the patient and a disclosure row for nothing. Explain shows why the balance is zero; a credit is refunded from Money Desk, never billed.');
    // The verb carries a number, never a payer name: "Delta Dental" would push the line past eight words.
    const pend = S.claims.find((c) => c.patientId === pid && ['submitted', 'pended'].includes(c.status));
    if (pend) return refuse('statement_held', 'Held: claim pending ' + (pend.age || 0) + ' days', 'Open Money Desk', pend.payer + ' is still reviewing ' + (S.cdt[pend.cdt] || [pend.cdt])[0] + '. A statement never goes out on a balance still waiting on insurance. The hold reason is shown on Money Desk → Statements due; after 45 days the row surfaces regardless of the pending claim.');
    const u = poster(pin.user);
    return { ok: true, statement: write('statementsDue', { id: id('sd'), patientId: pid, amountCents: due, reason: 'balance_due', createdBy: u.name, created: S.tenant.today }) };
  }

  // Daily Close
  /* Matching a variance settles it against the bank line, so the tender row and the location grade agree.
     Before, the grade flipped to "Tied · independent" while the Card row still showed a $312.40 gap. */
  function matchVariance(vid) {
    const v = S.variances.find((x) => x.id === vid); if (!v) return notFound('request');
    const off = offline('Wait for the server — reconciliation is read-only'); if (off) return off;
    if (v.status !== 'open') return refuse('already_decided', 'Open the day to see the match', 'Open the day', 'This variance was already ' + v.status + '. The settlement row that closed it is on the day.');
    const rr = S.reconciliation.find((r) => r.id === v.reconciliationId);
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
    if (!u.entitlements.includes('bank_reconcile') && !u.entitlements.includes('close_day')) return refuse('entitlement', 'Ask a seat that reconciles the bank', 'Send to Dana or the CPA', 'Clearing a variance signs off on the day\'s money. The seats that carry bank reconciliation or day close can do it; yours does not.');
    if (v.status !== 'open') return refuse('already_decided', 'Open the day to see the match', 'Open the day', 'This variance was already ' + v.status + '.');
    v.status = 'cleared'; touch('variances', v.id);
    // A cleared gap is explained, not matched: the bank line never moved, so the day is not tied. It goes to
    // second look with the gap on record; "Tied · independent" is earned only when every line met a bank row.
    rr.state = 'second_look'; rr.clearedBy = u.name; rr.clearedGap = { tender: v.tender, amountCents: v.amountCents }; touch('reconciliation', rr.id);
    write('reconciliationMatches', { id: id('rm'), varianceId: vid, basis: 'cleared_with_reason', tender: v.tender, amountCents: v.amountCents, actor: u.name });
    return { ok: true };
  }
  function reviewDecision(did, action) { const d = S.decisions.find((x) => x.id === did); if (!d) return notFound('request'); const off = offline('Wait for the server — decisions are read-only'); if (off) return off; d.status = action; touch('decisions', d.id); write('controlDecisions', { id: 'dec-' + nextId.dec++, supersedes: did, action, by: currentUser().name, at: S.tenant.today });
    // Retire ends the exception, so the threshold returns to what the decision raised it from; Retire used to
    // leave the raised value in force. The tenant row moved, so the log says so.
    if (action === 'retire' || action === 'tighten') { S.tenant.dualReleaseThresholdCents = d.fromCents || 10000; touch('tenant', S.tenant.id); }
    /* A decision that is kept or tightened comes back for review; the store sets the date so the sentence on
       screen and the row underneath it cannot disagree. The screen used to compute today + 90 itself. */
    let reviewBy = d.reviewBy || null;
    if (action === 'keep' || action === 'tighten') { const t = new Date(S.tenant.today + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 90); reviewBy = t.toISOString().slice(0, 10); d.reviewBy = reviewBy; }
    return { ok: true, reviewBy }; }
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
    const dc = write('dayCloses', { id: 'dc-' + locId + '-0903', locationId: locId, date: S.tenant.today, closedBy: u.name, closedAt: S.clock.time, chainHeadHash: 'a1c9…' + (S.ledger.length * 7 + 4096).toString(16), totals: tot });
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
    // Issuing a pass grants entitlements, so it is held to the seats that carry Grant roles; a temp with no
    // pass, the biller and the front desk used to issue one to anybody, Refund included.
    const me = currentUser();
    if (me.noPass || !me.entitlements.includes('grant_roles')) return refuse('entitlement', 'Ask a seat that grants roles', 'Dismiss', 'A day pass grants entitlements, so only a seat with Grant roles issues one: ' + S.users.filter((x) => x.entitlements.includes('grant_roles')).map((x) => x.short).join(' or ') + '. Yours does not carry it.');
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
    write('userEntitlements', { id: 'ue-' + nextId.ue++, userId: 'u-temp', entitlements: ents, expiresAt: dp.expiresAt, grantedBy: currentUser().name });
    if (decision) for (const c of (blocking.length ? blocking : pv.conflicts)) write('controlDecisions', { id: 'dec-' + nextId.dec++, kind: decision, ruleId: c.id, rulePair: c.pair, severity: c.severity, dayPassId: dp.id, reviewBy: '2026-10-03', by: currentUser().name });
    S.tempUser = { id: 'u-temp', name: form.name, short: form.name.split(' ')[0], role, entitlements: ents, dayPass: dp.id };
    return { ok: true, dayPass: dp, downgraded: !!pv.licenceGate };
  }

  // Temp rail
  const RAIL_STEPS = { frontdesk: [['arrive', 'Arrive'], ['seat', 'Seat'], ['checkout', 'Checkout'], ['payment', 'Take payment'], ['find', 'Find a patient']], rdh: [['perio', 'Perio grammar'], ['save', 'Save exam'], ['tag', 'Tag for dentist'], ['ready', 'Ready for exam'], ['find', 'Find a patient']] };
  function railSteps() { const u = currentUser(); return RAIL_STEPS[u.role === 'hygienist' || u.role === 'rdh' ? 'rdh' : 'frontdesk']; }
  function retireChip(step) {
    if (!S.railState || currentUser().noPass) return;   // nobody's first shift: a pass-less temp retires nothing
    const uid = currentUser().id;                       // one bucket per user; a tablet is not a person
    const bucket = (S.railState[uid] = S.railState[uid] || {});
    if (!bucket[step]) { bucket[step] = { retiredAt: S.clock.time, byEvent: Proto.events.all().length }; write('firstRunState', { id: 'frs-' + uid + '-' + step, userId: uid, step, retiredAt: S.clock.time }); }
  }
  function railStateFor() { const uid = currentUser().id; return (S.railState && S.railState[uid]) || {}; }

  // Palette search
  function search(q) {
    q = (q || '').trim().toLowerCase(); if (q.length < 3) return [];
    retireChip('find');
    const out = [];
    for (const s of S.synonyms) if (s.term.includes(q) || s.target.toLowerCase().includes(q)) out.push({ kind: 'action', label: s.target, syn: s.term + ' — called that in ' + s.source, route: s.route, irreversible: false });
    for (const a of S.actions) if (a.label.toLowerCase().includes(q)) out.push({ kind: 'action', label: a.label, route: a.route, irreversible: !!a.irreversible });
    for (const p of S.patients) if (p.name.toLowerCase().includes(q) || p.phone.endsWith(q) || p.mrn.toLowerCase().includes(q)) out.push({ kind: 'patient', label: p.name, syn: 'DOB ' + Proto.ui.longDate(p.dob) + ' · …' + p.phone.slice(-4), patientId: p.id });
    for (const c of S.claims) if (c.id.includes(q) || (c.payer || '').toLowerCase().includes(q)) out.push({ kind: 'claim', label: 'Claim ' + c.id + ' · ' + c.payer, route: 'money' });
    return out.slice(0, 8);
  }

  // Ensure tables referenced by write() exist
  const TABLES = ['appointmentEvents', 'eligibilityChecks', 'messages', 'approvals', 'approvalsLog', 'allocations', 'allocationIntents', 'statementsDue', 'paymentPlans', 'domainEvents', 'collectionDecisions', 'perioExams', 'tags', 'chartEvents', 'procedures', 'planItems', 'filedNotes', 'claims', 'claimEvents', 'appealPackets', 'disclosures', 'reconciliationMatches', 'controlDecisions', 'dayCloses', 'deposits', 'dayPasses', 'userEntitlements', 'firstRunState', 'ledger', 'credits', 'sessions'];
  const _reset = reset;
  reset = function (seedNum) { const s = _reset(seedNum); for (const t of TABLES) if (!s[t]) s[t] = []; return s; };

  const LICENCE_WORDS = { implant: 'implant', crown_margin: 'crown margin', not_tolerated: 'patient could not tolerate probing', third_molar_absent: 'third molar absent' };
  Proto.store = { reset, get, railStateFor, LICENCE_WORDS, patient, appt, encounter, user, carrierName, currentUser, balances, explain, allocate, charged, windowEstimate, arrive, seat, reverify, pingChair, postCheckout, evaluateRelease, decideApproval, requestApproval, approvalSentence, requestWriteoff, savePerio, addTag, readyForExam, wholePatient, chartPaint, chartUndo, dismissTag, needsAttachment, openSession, pendingApprovalsFor, noteKillers, fileNote, eraPostMatched, eraConfirm, eraHold, eraDispute, buildAppeal, sendAppeal, claimAction, disclose, sendStatement, raiseStatement, requirePin, matchVariance, clearVariance, reviewDecision, closeDay, previewDayPass, addDayPass, railSteps, retireChip, search, refuse, notFound };
})();
