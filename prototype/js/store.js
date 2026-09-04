/* In-memory store. Every mutation appends rows (never edits money rows), emits a write event,
   and returns either {ok:true, ...} or a refusal {ok:false, code, verb, control, why}. */
(function () {
  const Proto = (window.Proto = window.Proto || {});
  let S = null;
  // Every prefix write() uses starts here; seeded tables (credits cr-1, ERA lines el-1..41) start past their seed ids.
  const ID_START = { le: 5000, cd: 1, ar: 1, pe: 2, ce: 1, pr: 500, tag: 2, nf: 1, dc: 1, cl: 100, ap: 1, ue: 1, dp: 1, dec: 2, msg: 1, ai: 1, ae: 1, el: 100, al: 1, sd: 3, pp: 1, de: 1, cr: 2, cev: 1, pl: 1, dis: 1, rm: 1, dep: 1 };
  let nextId = Object.assign({}, ID_START);
  const id = (p) => { if (!Number.isFinite(nextId[p])) nextId[p] = 1; return p + '-' + (nextId[p]++); };

  function reset(seedNum) {
    S = Proto.seed.build(seedNum);
    nextId = Object.assign({}, ID_START);
    S.chartEvents = []; S.planItems = []; S.notes = {}; S.filedNotes = [];
    S.collectionDecisions = [{ id: 'cd-0', encounterId: 'enc-9010', decision: 'collect', patientPortionCents: 9500, decidedBy: 'Priya Raman', decidedAt: S.tenant.today + ' 07:52', statementDueId: null, paymentPlanId: null }];
    S.allocationIntents = [{ id: 'ai-0', paymentId: 'le-window-9010', encounterId: 'enc-9010', amountCents: 9500 }]; S.allocations = []; S.dayPasses = []; S.controlDecisions = []; S.disclosures = []; S.railState = {}; S.appealPackets = []; S.messages = [];
    S.clock = { time: '08:40', afterHours: false };
    return S;
  }
  const get = () => S;
  const write = (table, row) => { S[table].push(row); Proto.events.write(table, row.id); return row; };
  const refuse = (code, verb, control, why) => ({ ok: false, code, verb, control, why });

  // Lookups
  const patient = (pid) => S.patients.find((p) => p.id === pid);
  const appt = (aid) => S.appointments.find((a) => a.id === aid);
  const encounter = (eid) => S.encounters.find((e) => e.id === eid);
  const user = (uid) => S.users.find((u) => u.id === uid);
  const carrierName = (cid) => (S.carriers.find((c) => c.id === cid) || {}).name || '—';
  const currentUser = () => { const p = window.__proto && window.__proto.persona; if (p === 'temp') return S.tempUser || { id: 'u-temp', name: 'Alex Rivera', short: 'Alex R.', role: 'frontdesk', entitlements: ['schedule', 'post_payment'] }; return user(S.personaUser[p]) || S.users[0]; };

  // Balances: three numbers from ledger rows; estimates never join.
  function balances(pid) {
    let patientDue = 0, insurancePending = 0, credit = 0;
    for (const e of S.ledger) {
      if (e.patientId !== pid) continue;
      if (e.kind === 'charge') { patientDue += e.amountCents; }
      else if (e.kind === 'insurance_payment' || e.kind === 'write_off' || e.kind === 'adjustment' || e.kind === 'patient_payment' || e.kind === 'reversal' || e.kind === 'refund') { patientDue += e.amountCents; }
    }
    // pending insurance: submitted claims for this patient not yet paid
    for (const c of S.claims) if (c.patientId === pid && ['submitted', 'pended'].includes(c.status)) insurancePending += Math.round(c.amountCents * 0.5);
    const p = patient(pid);
    if (p && p.id === 'p-303') insurancePending = 0;
    if (patientDue < 0) { credit = -patientDue; patientDue = 0; }
    // Seeded credit rows carry money the ledger has no charge for yet. A payment already
    // counted above (its ledger row exists) must not be counted a second time here.
    for (const cr of S.credits) if (cr.patientId === pid && !cr.fromLedger) credit += -cr.amountCents;
    return { patientDue, insurancePending, credit };
  }
  function explain(pid) {
    const rows = S.ledger.filter((e) => e.patientId === pid && (e.kind === 'charge'));
    const out = [];
    for (const ch of rows) {
      const related = S.ledger.filter((e) => e.patientId === pid && e.id !== ch.id && e.effective >= ch.effective);
      const ins = related.filter((e) => e.kind === 'insurance_payment');
      const wo = related.filter((e) => e.kind === 'write_off');
      const pp = related.filter((e) => e.kind === 'patient_payment');
      const paid = ins.reduce((s, e) => s + e.amountCents, 0) + wo.reduce((s, e) => s + e.amountCents, 0) + pp.reduce((s, e) => s + e.amountCents, 0);
      const name = ch.cdt ? (S.cdt[ch.cdt] || [ch.cdt])[0] + (ch.tooth ? ' #' + ch.tooth : '') : 'Visit';
      const parts = [name + ' on ' + Proto.ui.longDate(ch.effective) + ': charge ' + Proto.ui.money(ch.amountCents)];
      ins.forEach((e) => parts.push(e.payer + ' paid ' + Proto.ui.money(-e.amountCents) + ' on ' + Proto.ui.shortDate(e.effective)));
      wo.forEach((e) => parts.push('contractual write-off ' + Proto.ui.money(-e.amountCents) + ' (' + (e.reason || 'PPO fee').replace(/_/g, ' ') + ')'));
      pp.forEach((e) => parts.push('you paid ' + Proto.ui.money(-e.amountCents) + ' on ' + Proto.ui.shortDate(e.effective)));
      const owe = ch.amountCents + paid;
      parts.push(owe > 0 ? 'you owe ' + Proto.ui.money(owe) : owe < 0 ? 'credit ' + Proto.ui.money(-owe) : 'paid in full');
      out.push({ chargeId: ch.id, sentence: parts.join('; ') + '.', patientVoice: name + ': ' + (owe > 0 ? 'Your share is ' + Proto.ui.money(owe) + ' after insurance.' : 'Nothing left to pay.') });
    }
    return out;
  }

  // Board
  function arrive(aid) {
    const a = appt(aid); if (!a) return refuse('notfound', 'Appointment not found', null);
    if (S.outage) return refuse('outage', 'Server unreachable — Board is read-only', 'Support line', 'Showing the Board from the last fetch. No writes are accepted until the connection returns.');
    a.status = 'arrived'; a.arrivedAt = S.clock.time;
    write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'appointment.arrived', actor: currentUser().name });
    if (a.eligibility === 'amber') a.eligibilityRerun = 'running';
    retireChip('arrive');
    return { ok: true };
  }
  function seat(aid) { const a = appt(aid); if (!a) return refuse('notfound', 'Appointment not found', null); a.status = 'seated'; write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'appointment.seated', actor: currentUser().name }); retireChip('seat'); return { ok: true }; }
  function reverify(aid) { const a = appt(aid); a.eligibility = 'green'; a.eligibilityNote = '270/271 re-run at ' + S.clock.time + ': active, deductible met'; write('eligibilityChecks', { id: id('el'), appointmentId: aid, result: 'active' }); return { ok: true }; }
  function pingChair(aid) { const a = appt(aid); const last = S.messages.filter((m) => m.appointmentId === aid).pop(); if (last && S.messages.length - S.messages.indexOf(last) < 2 && last.sameQuarter) return refuse('ping_rate', 'Wait 15 minutes — chair already pinged', 'Open the chart', 'One ping per encounter per 15 minutes keeps the operatory usable. Open the chart to see what the writer has so far.'); write('messages', { id: id('msg'), appointmentId: aid, kind: 'board.ping_chair', to: 'chair ' + a.op, sameQuarter: true }); return { ok: true }; }

  // Checkout (flow 4). decision: collect | send_statement | payment_plan | zero_due
  function postCheckout(aid, form) {
    const a = appt(aid); if (!a) return refuse('notfound', 'Appointment not found', null);
    const est = S.estimates[aid] || { patientCents: a.balanceCents || 0 };
    const u = currentUser();
    if (S.outage) return refuse('outage', 'Server unreachable — postings are paused', 'Support line', 'Money never posts offline: controls cannot be enforced without the server.');
    if (window.__proto.device === 'shared' && !form.pin) return refuse('pin_required', 'Enter your PIN to post', null, 'Shared desk: the PIN mints your own session for this posting.');
    if (form.decision === 'collect' && est.patientCents === 0) return refuse('zero_collect_refused', 'Nothing due today — choose Nothing due', 'Nothing due today', 'Collect with $0 writes nothing; the typed decision keeps the window honest.');
    if (form.decision === 'collect' && !form.tender) return refuse('tender_required', 'Choose a tender', null);
    if (S.collectionDecisions.some((d) => d.encounterId === a.encounterId)) return refuse('already_decided', 'This visit is already checked out', 'Open the ledger', 'One typed decision per visit. To change what was collected, post a correction from the ledger: a reversal and a repost, both linked to the original.');
    const encId = a.encounterId; const enc = encounter(encId);
    const procs = S.procedures.filter((p) => p.encounterId === encId);
    // Write-off gate (dual release inside the posting transaction)
    if (form.writeoffCents && form.writeoffCents > 0) {
      const gate = evaluateRelease('write_off', form.writeoffCents, u);
      if (!gate.ok) {
        const req = write('approvals', { id: 'ar-' + nextId.ar++, kind: 'write_off', amountCents: form.writeoffCents, reason: form.writeoffReason || 'courtesy', patientId: a.patientId, requestedBy: u.name, requestedById: u.id, status: 'pending', eligible: gate.eligible, frozenSentence: 'Write-off ' + Proto.ui.money(form.writeoffCents) + ' on ' + patient(a.patientId).name + ' (' + (form.writeoffReason || 'courtesy') + ') requested by ' + u.name + ' at ' + S.clock.time, appointmentId: aid, form });
        return Object.assign(refuse(gate.code, gate.verb, 'Request approval', gate.why), { requestId: req.id, held: true });
      }
    }
    // Post: charges (if note filed), payment, allocations, decision, self-pay flags in one transaction
    const noteFiled = enc && enc.noteFiled;
    const rows = [];
    if (noteFiled) for (const p of procs) if (!p.charged) { p.charged = true; rows.push(write('ledger', { id: id('le'), kind: 'charge', patientId: a.patientId, amountCents: p.feeCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, procedureId: p.id, cdt: p.cdt, tooth: p.tooth })); }
    if (form.decision === 'collect') {
      const amt = form.amountCents || est.patientCents;
      const pay = write('ledger', { id: id('le'), kind: 'patient_payment', patientId: a.patientId, amountCents: -amt, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, tender: form.tender, gl: noteFiled ? 'patient_ar' : 'unapplied_credit' });
      if (noteFiled) { let rem = amt; for (const r of rows) { if (rem <= 0) break; const alloc = Math.min(rem, r.amountCents); write('allocations', { id: id('al'), paymentId: pay.id, chargeId: r.id, amountCents: alloc }); rem -= alloc; } }
      else write('allocationIntents', { id: id('ai'), paymentId: pay.id, encounterId: encId, amountCents: amt });
    }
    if (form.decision === 'send_statement') write('statementsDue', { id: id('sd'), patientId: a.patientId, amountCents: est.patientCents, reason: 'window_deferred', createdBy: u.name, created: S.tenant.today });
    if (form.decision === 'payment_plan') write('paymentPlans', { id: id('pp'), patientId: a.patientId, amountCents: est.patientCents, cadence: form.cadence || 'monthly', eligibleBucket: 'patient_ar', createdBy: u.name });
    for (const pid of form.selfPay || []) { const p = S.procedures.find((x) => x.id === pid); if (p) { p.selfPayRestricted = true; p.restrictedAt = S.tenant.today; write('domainEvents', { id: id('de'), type: 'procedure.self_pay_restricted', procedureId: pid }); } }
    if (form.writeoffCents > 0) write('ledger', { id: id('le'), kind: 'write_off', patientId: a.patientId, amountCents: -form.writeoffCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: a.locationId, reason: form.writeoffReason || 'courtesy', approvalRequestId: form.approvalRequestId || null });
    write('collectionDecisions', { id: 'cd-' + nextId.cd++, encounterId: encId, decision: form.decision, patientPortionCents: est.patientCents, decidedBy: u.name, decidedAt: S.tenant.today + ' ' + S.clock.time, statementDueId: null, paymentPlanId: null });
    a.status = noteFiled ? 'checked_out' : 'checked_out_unfiled';
    if (!noteFiled) { if (!S.credits.find((c) => c.patientId === a.patientId && c.reason.includes(aid))) S.credits.push({ id: id('cr'), patientId: a.patientId, amountCents: -(form.amountCents || est.patientCents || 0), reason: 'Checked out unfiled: payment waiting for charges (' + aid + ')', intents: 'pending charges on ' + encId, fromLedger: true }); }
    retireChip('checkout'); if (form.decision === 'collect') retireChip('payment');
    return { ok: true, taps: 0 };
  }

  // Dual release evaluator (precog evaluateRelease, simplified)
  function evaluateRelease(channel, amountCents, actor) {
    const threshold = S.tenant.dualReleaseThresholdCents;
    const RANK = { office_manager: 0, owner: 1, dentist: 2, surgeon: 3 };
    const eligible = S.users.filter((x) => x.entitlements.includes('approve_second') && x.id !== actor.id)
      .sort((a, b) => (RANK[a.role] == null ? 9 : RANK[a.role]) - (RANK[b.role] == null ? 9 : RANK[b.role]))
      .map((x) => x.short);
    if (S.clock.afterHours && ['write_off', 'refund', 'adjustment'].includes(channel)) return { ok: false, code: 'after_hours', verb: 'Held until 7:30 am — after hours', why: 'Refunds, adjustments, and write-offs outside business hours are held regardless of amount. Policy set by Dr. Reagan, reviewed 8/4.', eligible };
    if (amountCents >= threshold) return { ok: false, code: 'needs_second', verb: 'Needs a second approver — ' + eligible.slice(0, 2).join(' or '), why: 'Write-offs at or above ' + Proto.ui.money(threshold) + ' need a distinct second approver (control policy v3, set by Dr. Reagan on 8/4, review due 9/1). Approvals here usually take about 4 minutes.', eligible };
    return { ok: true, code: 'below_threshold', eligible };
  }
  function decideApproval(reqId, approverId, decision, stepup) {
    const r = S.approvals.find((x) => x.id === reqId); if (!r) return refuse('notfound', 'Request not found', null);
    const approver = user(approverId) || currentUser();
    if (r.requestedById === approver.id) return refuse('blocked_same_person', 'You requested this — someone else must approve', null, 'CHECK requester_id <> second_approver_id.');
    if (!stepup) return refuse('stepup', 'Enter your PIN to approve', null, 'Approvals above the high-value band re-verify within two minutes.');
    r.status = decision; r.decidedBy = approver.name; r.decidedAt = S.clock.time;
    write('approvalsLog', { id: id('al'), requestId: reqId, decision, by: approver.name });
    if (decision === 'approved') {
      const a = appt(r.appointmentId);
      write('ledger', { id: id('le'), kind: 'write_off', patientId: r.patientId, amountCents: -r.amountCents, effective: S.tenant.today, posted: S.tenant.today, actor: r.requestedBy, actorKind: 'user', locationId: a ? a.locationId : 'loc-1', reason: r.reason, approvalRequestId: reqId, secondApprover: approver.name });
    }
    return { ok: true };
  }
  function requestWriteoff(accountPid, amountCents, reason) {
    const u = currentUser();
    const gate = evaluateRelease('write_off', amountCents, u);
    if (!gate.ok) {
      const req = write('approvals', { id: 'ar-' + nextId.ar++, kind: 'write_off', amountCents, reason, patientId: accountPid, requestedBy: u.name, requestedById: u.id, status: 'pending', eligible: gate.eligible, frozenSentence: 'Write-off ' + Proto.ui.money(amountCents) + ' on ' + patient(accountPid).name + ' (' + reason + ') requested by ' + u.name + ' at ' + S.clock.time, appointmentId: null });
      return Object.assign(refuse(gate.code, gate.verb, 'Request approval', gate.why), { requestId: req.id, held: true });
    }
    write('ledger', { id: id('le'), kind: 'write_off', patientId: accountPid, amountCents: -amountCents, effective: S.tenant.today, posted: S.tenant.today, actor: u.name, actorKind: 'user', locationId: 'loc-1', reason });
    return { ok: true };
  }

  // Perio (flow 2)
  function savePerio(encId, sites, extras) {
    const enc = encounter(encId); if (!enc) return refuse('notfound', 'Encounter not found', null);
    const entries = Object.entries(sites);
    const probed = entries.filter(([, v]) => v && v.depth != null).length;
    const skipped = entries.filter(([, v]) => v && v.skipped).length;
    const bleeding = entries.filter(([, v]) => v && v.bleed).length;
    const deepest = Math.max(0, ...entries.map(([, v]) => (v && v.depth) || 0));
    if (skipped > 0 && !(extras && extras.licence)) return refuse('omission_licence', 'Name why ' + skipped + (skipped === 1 ? ' site was' : ' sites were') + ' not probed', 'Choose a reason', 'A blank is never forced into a fabrication: pick implant, crown margin, patient could not tolerate, or third molar absent.');
    const mode = (extras && extras.mode) || 'full';
    const codes = entries.filter(([, v]) => v && v.code != null).map(([, v]) => v.code);
    const prior = S.perioExams.filter((e) => e.encounterId === encId).pop();
    const amends = (extras && extras.amending && prior) ? prior.id : null;
    const exam = write('perioExams', { id: 'pe-' + nextId.pe++, patientId: enc.patientId, encounterId: encId, date: S.tenant.today, sites, probed, skipped, bleeding, deepest, sextantCodes: codes, licence: extras && extras.licence, mode, author: currentUser().name, amendsExamId: amends, kind: amends ? 'addendum' : 'exam' });
    S.notes[encId] = S.notes[encId] || {};
    if (mode === 'screening') {
      const worst = codes.length ? Math.max(...codes.map((x) => Number(x) || 0)) : null;
      const MEAN = { 0: 'healthy', 1: 'bleeding on probing', 2: 'calculus or defective margin', 3: 'pocket 4 to 5 mm', 4: 'pocket 6 mm or deeper' };
      S.notes[encId].perioSummary = 'Perio screening: ' + codes.length + ' sextants scored (' + codes.join(', ') + ')' + (worst != null ? ', highest ' + worst + ' — ' + (MEAN[worst] || 'see chart') : '') + '.';
      if (worst != null && worst >= 3) S.notes[encId].srpEvidence = 'Screening code ' + worst + ' indicates a full six-point chart before periodontal therapy.';
    } else {
      S.notes[encId].perioSummary = (amends ? 'Perio addendum to exam ' + amends + ' (' + currentUser().name + ', ' + S.tenant.today + '): ' : 'Perio: ') + probed + ' sites probed, deepest ' + deepest + ' mm, bleeding at ' + bleeding + (bleeding === 1 ? ' site' : ' sites') + (skipped ? ', ' + skipped + (skipped === 1 ? ' site' : ' sites') + ' not probed (' + LICENCE_WORDS[extras.licence] + ')' : '') + '.';
    }
    if (deepest >= 5) S.notes[encId].srpEvidence = 'SRP evidence: ' + entries.filter(([, v]) => v && v.depth >= 5).length + ' sites at or above 5 mm.';
    retireChip('perio');
    return { ok: true, exam };
  }
  function addTag(encId, tooth, surfaces, text) { const t = write('tags', { id: 'tag-' + nextId.tag++, encounterId: encId, tooth, surfaces, text, author: currentUser().name, disposition: null }); return { ok: true, tag: t }; }
  function readyForExam(aid) { const a = appt(aid); a.status = 'ready_for_exam'; write('appointmentEvents', { id: id('ae'), appointmentId: aid, kind: 'encounter.exam_requested', actor: currentUser().name }); return { ok: true }; }

  // Encounter (flow 3)
  // Services that belong to the visit, not to a tooth.
  const WHOLE_PATIENT = ['d0120', 'd0140', 'd0274', 'd1110', 'd9230', 'd9243'];
  function chartPaint(encId, tooth, surfaces, cdtCode, temporality) {
    const enc = encounter(encId); if (!enc) return refuse('notfound', 'Encounter not found', null);
    const fee = (S.cdt[cdtCode] || [null, 0])[1];
    if (WHOLE_PATIENT.includes(cdtCode)) { tooth = null; surfaces = []; }
    const already = S.chartEvents.find((c) => c.encounterId === encId && c.cdt === cdtCode && c.tooth === tooth);
    if (already) return refuse('duplicate_paint', 'Already charted this visit — ' + (S.cdt[cdtCode] || [cdtCode])[0] + (tooth ? ' #' + tooth : ''), 'Undo the first one', 'One gesture writes one chart event, one procedure, one plan line and one pending charge. Charting it twice would bill it twice.');
    const ce = write('chartEvents', { id: 'ce-' + nextId.ce++, encounterId: encId, tooth, surfaces, cdt: cdtCode, temporality: temporality || 'today', author: currentUser().name });
    let proc = null;
    if ((temporality || 'today') === 'today') proc = write('procedures', { id: 'pr-' + nextId.pr++, encounterId: encId, patientId: enc.patientId, cdt: cdtCode, tooth, surfaces, feeCents: fee, status: 'completed_pending_charge', selfPayRestricted: false, chartEventId: ce.id });
    const pat = patient(enc.patientId);
    const carrier = pat && pat.primary ? carrierName(pat.primary) : null;
    const share = carrier ? 0.5 : 1;
    const est = Math.round(fee * share);
    const trace = carrier
      ? carrier + ' PPO: 50% after deductible (met) → patient est. ' + Proto.ui.money(est)
      : 'Self-pay, no coverage on file → patient est. ' + Proto.ui.money(est);
    const plan = write('planItems', { id: id('pl'), encounterId: encId, tooth, surfaces, cdt: cdtCode, estimateCents: est, ruleTrace: trace, temporality: temporality || 'today' });
    S.notes[encId] = S.notes[encId] || {};
    const line = (S.cdt[cdtCode] || [cdtCode])[0] + (tooth ? ' #' + tooth : '') + (surfaces && surfaces.length ? ' ' + surfaces.join('') : '') + (temporality === 'existing' ? ' (existing, placed elsewhere)' : temporality === 'planned' ? ' (planned)' : '');
    S.notes[encId].procedures = (S.notes[encId].procedures || []).concat([line]);
    S.notes[encId].procedure = S.notes[encId].procedures.join('; ');
    for (const t of S.tags) if (t.encounterId === encId && t.tooth === tooth && !t.disposition) t.disposition = 'charted';
    return { ok: true, chartEvent: ce, procedure: proc, plan };
  }
  function noteKillers(encId, note) {
    const enc = encounter(encId); const killers = [];
    const u = currentUser();
    for (const t of S.tags) if (t.encounterId === encId && !t.disposition) killers.push({ code: 'tag_undispositioned', verb: 'Hygienist tag #' + t.tooth + ' has no disposition', control: 'Chart it or dismiss', fix: 'tag' });
    const text = ((note && note.assessment) || '') + ' ' + ((note && note.plan) || '');
    if (/\$\s?\d/.test(text) || /\b(fee|cost|price|estimate|copay)\b/i.test(text)) killers.push({ code: 'money_in_note', verb: 'Money stays out of the note', control: 'Move to plan card', fix: 'money' });
    const toothed = S.chartEvents.filter((c) => c.encounterId === encId && c.tooth != null);
    const m = text.match(/#(\d{1,2})/);
    if (m && toothed.length && !toothed.some((c) => c.tooth === Number(m[1]))) {
      const c = toothed[0];
      killers.push({ code: 'contradiction', verb: 'Note says #' + m[1] + ', chart says #' + c.tooth, control: 'Use chart tooth', fix: 'contradiction', noteTooth: Number(m[1]), chartTooth: c.tooth });
    }
    if (!(note && note.assessment && note.assessment.trim().length)) killers.push({ code: 'assessment_required', verb: 'Assessment is empty', control: 'Add assessment', fix: 'assessment' });
    if (u.role !== 'dentist' && u.role !== 'owner' && u.role !== 'surgeon') killers.push({ code: 'licence_scope', verb: 'Filing needs a dentist\'s licence', control: 'Send to Exams to sign', fix: 'licence' });
    return killers;
  }
  function fileNote(encId, note, readbackConfirmed) {
    const enc = encounter(encId); if (!enc) return refuse('notfound', 'Encounter not found', null);
    const killers = noteKillers(encId, note);
    if (killers.length) return { ok: false, killers: killers.slice(0, 3), total: killers.length };
    if (!readbackConfirmed) { const pr = window.__proto && window.__proto.privacy; const who = patient(enc.patientId); return refuse('readback', 'Filing as ' + currentUser().name + ' for ' + (pr ? Proto.ui.initials(who.name) : who.name), 'Confirm and file', 'The read-back line repeats author and patient so a stale author on a shared device is caught at the last gate.'); }
    enc.noteFiled = true; enc.status = 'signed';
    const a = appt(enc.appointmentId); if (a) a.status = a.status === 'checked_out_unfiled' ? 'checked_out' : 'note_filed';
    const filed = write('filedNotes', { id: 'nf-' + nextId.nf++, encounterId: encId, author: currentUser().name, filedAt: S.tenant.today + ' ' + S.clock.time, rulesetVersion: '2.25.2', byteauditOk: true, markdown: [note.assessment, note.plan, S.notes[encId] && S.notes[encId].procedure, S.notes[encId] && S.notes[encId].perioSummary].filter(Boolean).join('\n') });
    // release pending charges and claim
    for (const p of S.procedures) if (p.encounterId === encId && p.status === 'completed_pending_charge') { p.status = 'completed'; p.charged = true; write('ledger', { id: id('le'), kind: 'charge', patientId: enc.patientId, amountCents: p.feeCents, effective: enc.dos, posted: S.tenant.today, actor: currentUser().name, actorKind: 'file_event', locationId: enc.locationId, procedureId: p.id, cdt: p.cdt, tooth: p.tooth, releasedByNoteId: filed.id }); }
    write('claims', { id: 'c-' + nextId.cl++, patientId: enc.patientId, status: 'scrubbed', cdt: (S.procedures.find((p) => p.encounterId === encId) || {}).cdt, amountCents: 0, payer: carrierName(patient(enc.patientId).primary), submitted: S.tenant.today, age: 0, nextAction: 'Queued to clearinghouse' });
    return { ok: true, filed };
  }

  // Money Desk (flow 5)
  function eraPostMatched(batchId) { const b = S.eraBatches.find((x) => x.id === batchId); const deltas = S.eraLines.filter((l) => l.batchId === batchId && l.status === 'delta'); b.status = 'deltas'; return { ok: true, readback: deltas }; }
  function eraConfirm(lineId) { const l = S.eraLines.find((x) => x.id === lineId); l.status = 'posted'; write('ledger', { id: id('le'), kind: 'insurance_payment', patientId: l.patientId, amountCents: -l.paidCents, effective: S.tenant.today, posted: S.tenant.today, actor: currentUser().name, actorKind: 'user', locationId: 'loc-1', payer: 'Delta Dental', eraLineId: lineId, gl: 'ins_ar_primary' }); write('ledger', { id: id('le'), kind: 'write_off', patientId: l.patientId, amountCents: -(l.expectedCents - l.paidCents), effective: S.tenant.today, posted: S.tenant.today, actor: currentUser().name, actorKind: 'user', locationId: 'loc-1', reason: 'contractual_ppo', eraLineId: lineId }); return { ok: true }; }
  function eraHold(lineId) { const l = S.eraLines.find((x) => x.id === lineId); l.status = 'held'; write('claimEvents', { id: id('cev'), claimId: l.claimId, kind: 'era.line_held', actor: currentUser().name }); return { ok: true }; }
  function eraDispute(lineId) { const l = S.eraLines.find((x) => x.id === lineId); l.status = 'disputed'; write('claimEvents', { id: id('cev'), claimId: l.claimId, kind: 'era.contract_variance_disputed', actor: currentUser().name }); return { ok: true }; }
  function buildAppeal(claimId) { const c = S.claims.find((x) => x.id === claimId); const pk = write('appealPackets', { id: id('ap'), claimId, slots: { perioChart: c.hasPerioChart, narrative: c.hasNarrative, radiograph: true, letter: true }, patientSentence: 'Delta asked for your gum chart; we are sending it. You owe nothing while they review.' }); return { ok: true, packet: pk }; }
  function sendAppeal(claimId) { const c = S.claims.find((x) => x.id === claimId); c.status = 'appealed'; write('claimEvents', { id: id('cev'), claimId, kind: 'claim.appealed', actor: currentUser().name }); write('disclosures', { id: id('dis'), patientId: c.patientId, channel: 'clearinghouse', purpose: 'payment', recordIds: ['pe-1', 'nf-old'], actor: currentUser().name }); return { ok: true }; }
  function sendStatement(sdId) { const s = S.statementsDue.find((x) => x.id === sdId); s.sent = true; write('disclosures', { id: id('dis'), patientId: s.patientId, channel: 'mail', purpose: 'payment', recordIds: [sdId], actor: currentUser().name }); return { ok: true }; }

  // Daily Close
  function matchVariance(vid) { const v = S.variances.find((x) => x.id === vid); v.status = 'matched'; const rr = S.reconciliation.find((r) => r.id === v.reconciliationId); rr.state = 'tied'; write('reconciliationMatches', { id: id('rm'), varianceId: vid, basis: 'timing_card_settlement', actor: currentUser().name }); return { ok: true }; }
  function clearVariance(vid) { const v = S.variances.find((x) => x.id === vid); const rr = S.reconciliation.find((r) => r.id === v.reconciliationId); const u = currentUser(); if (rr.closer === u.name || (u.role === 'biller' && rr.locationId === 'loc-3')) return refuse('clear_not_independent', 'You posted that day — ' + (rr.closer === u.name ? 'Dr. Reagan' : 'Dana') + ' or the CPA seat can clear', null, 'Whoever posted payments or prepared the deposit for a business day cannot clear that day\'s variance.'); v.status = 'cleared'; rr.state = 'tied'; write('reconciliationMatches', { id: id('rm'), varianceId: vid, basis: 'cleared_with_reason', actor: u.name }); return { ok: true }; }
  function reviewDecision(did, action) { const d = S.decisions.find((x) => x.id === did); d.status = action; write('controlDecisions', { id: 'dec-' + nextId.dec++, supersedes: did, action, by: currentUser().name, at: S.tenant.today }); if (action === 'retire') S.tenant.dualReleaseThresholdCents = 15000; if (action === 'tighten') S.tenant.dualReleaseThresholdCents = 10000; return { ok: true }; }
  function closeDay(locId) {
    const u = currentUser(); if (!u.entitlements.includes('close_day')) return refuse('entitlement', 'Closing the day needs Dana or Dr. Reagan', null);
    if (S.dayCloses.find((d) => d.locationId === locId && d.date === S.tenant.today)) return refuse('already_closed', 'Today is already closed for this location', null);
    const rows = S.ledger.filter((e) => e.locationId === locId && e.posted === S.tenant.today && e.kind === 'patient_payment');
    const tot = { cash: 0, check: 0, card: 0 }; rows.forEach((e) => { tot[e.tender || 'card'] += -e.amountCents; });
    const dc = write('dayCloses', { id: 'dc-' + locId + '-0903', locationId: locId, date: S.tenant.today, closedBy: u.name, closedAt: S.clock.time, chainHeadHash: 'a1c9…' + Math.floor(Math.random() * 9000 + 1000).toString(16), totals: tot });
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
    const pv = previewDayPass(form);
    if (pv.conflicts.some((c) => c.severity === 'critical') && !decision) return refuse('sod_conflict', pv.conflicts[0].fraudPath, 'Remediate, compensate, or accept', 'Critical conflict: ' + pv.conflicts[0].pair.join(' + ') + '. A grant that creates a critical conflict needs a recorded decision with a review date.');
    let ents = pv.entitlements; let role = form.role;
    if (pv.licenceGate) { const fd = S.roleTemplates.find((t) => t.code === 'frontdesk'); ents = fd.entitlements; role = 'frontdesk'; }
    const dp = write('dayPasses', { id: 'dp-' + nextId.dp++, name: form.name, role, requestedRole: form.role, locationId: form.location, shiftEnd: form.end, entitlements: ents, expiresAt: form.end + ' + 30 min grace', createdBy: currentUser().name, credentialId: pv.credential ? pv.credential.id : null, sodDecision: decision || null });
    write('userEntitlements', { id: 'ue-' + nextId.ue++, userId: 'u-temp', entitlements: ents, expiresAt: dp.expiresAt, grantedBy: currentUser().name });
    if (decision) write('controlDecisions', { id: 'dec-' + nextId.dec++, kind: decision, ruleId: pv.conflicts[0] && pv.conflicts[0].id, reviewBy: '2026-10-03', by: currentUser().name });
    S.tempUser = { id: 'u-temp', name: form.name, short: form.name.split(' ')[0], role, entitlements: ents, dayPass: dp.id };
    return { ok: true, dayPass: dp, downgraded: !!pv.licenceGate };
  }

  // Temp rail
  const RAIL_STEPS = { frontdesk: [['arrive', 'Arrive'], ['seat', 'Seat'], ['checkout', 'Checkout'], ['payment', 'Take payment'], ['find', 'Find a patient']], rdh: [['perio', 'Perio grammar'], ['save', 'Save exam'], ['tag', 'Tag for dentist'], ['ready', 'Ready for exam'], ['find', 'Find a patient']] };
  function railSteps() { const u = currentUser(); return RAIL_STEPS[u.role === 'hygienist' || u.role === 'rdh' ? 'rdh' : 'frontdesk']; }
  function retireChip(step) {
    if (!S.railState) return;
    const uid = currentUser().id;                       // one bucket per user; a tablet is not a person
    const bucket = (S.railState[uid] = S.railState[uid] || {});
    if (!bucket[step]) { bucket[step] = { retiredAt: S.clock.time, byEvent: Proto.events.all().length }; write('firstRunState', { id: 'frs-' + uid + '-' + step, userId: uid, step, retiredAt: S.clock.time }); }
  }
  function railStateFor() { const uid = currentUser().id; return (S.railState && S.railState[uid]) || {}; }

  // Palette search
  function search(q) {
    q = (q || '').trim().toLowerCase(); if (q.length < 3) return [];
    const out = [];
    for (const s of S.synonyms) if (s.term.includes(q) || s.target.toLowerCase().includes(q)) out.push({ kind: 'action', label: s.target, syn: s.term + ' — called that in ' + s.source, route: s.route, irreversible: false });
    for (const a of S.actions) if (a.label.toLowerCase().includes(q)) out.push({ kind: 'action', label: a.label, route: a.route, irreversible: !!a.irreversible });
    for (const p of S.patients) if (p.name.toLowerCase().includes(q) || p.phone.endsWith(q) || p.mrn.toLowerCase().includes(q)) out.push({ kind: 'patient', label: p.name, syn: 'DOB ' + Proto.ui.longDate(p.dob) + ' · …' + p.phone.slice(-4), patientId: p.id });
    for (const c of S.claims) if (c.id.includes(q) || (c.payer || '').toLowerCase().includes(q)) out.push({ kind: 'claim', label: 'Claim ' + c.id + ' · ' + c.payer, route: 'money' });
    return out.slice(0, 8);
  }

  // Ensure tables referenced by write() exist
  const TABLES = ['appointmentEvents', 'eligibilityChecks', 'messages', 'approvals', 'approvalsLog', 'allocations', 'allocationIntents', 'statementsDue', 'paymentPlans', 'domainEvents', 'collectionDecisions', 'perioExams', 'tags', 'chartEvents', 'procedures', 'planItems', 'filedNotes', 'claims', 'claimEvents', 'appealPackets', 'disclosures', 'reconciliationMatches', 'controlDecisions', 'dayCloses', 'deposits', 'dayPasses', 'userEntitlements', 'firstRunState', 'ledger'];
  const _reset = reset;
  reset = function (seedNum) { const s = _reset(seedNum); for (const t of TABLES) if (!s[t]) s[t] = []; return s; };

  const LICENCE_WORDS = { implant: 'implant', crown_margin: 'crown margin', not_tolerated: 'patient could not tolerate probing', third_molar_absent: 'third molar absent' };
  Proto.store = { reset, get, railStateFor, LICENCE_WORDS, patient, appt, encounter, user, carrierName, currentUser, balances, explain, arrive, seat, reverify, pingChair, postCheckout, evaluateRelease, decideApproval, requestWriteoff, savePerio, addTag, readyForExam, chartPaint, noteKillers, fileNote, eraPostMatched, eraConfirm, eraHold, eraDispute, buildAppeal, sendAppeal, sendStatement, matchVariance, clearVariance, reviewDecision, closeDay, previewDayPass, addDayPass, railSteps, retireChip, search, refuse };
})();
