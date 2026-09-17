// Swarm 2, lens "approvals-writeoff-era": sequences and forged calls through prototype/js/store.js decideApproval,
// requestApproval, requestWriteoff, postCheckout (write-off cap), eraHold, eraDispute, eraConfirm, and the surfaces
// that print them (phone.js, moneydesk.js, checkout.js). Several round-1 checks now read "no" because a later guard
// (PIN step-up, eraConfirm's disputed/denied refusal) sits in front of the path they drove, while the defect they
// named is still one call away; each check here drives the remaining path and measures it.
// Default position is NOT reproduced: every check records the values it measured and scores only the breach it names.
// Every check closes its browser context in `finally`.
export default ({ ctx, go, hop, click, txt, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const gate = (p) => p.evaluate(() => { const r = [...document.querySelectorAll('.refusal')].filter((x) => x.offsetParent !== null)[0]; return r ? { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() } : null; });
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const after = (p, seq) => p.evaluate((s) => window.__events.filter((e) => e.seq > s), seq);
  const brief = (ev) => ev.map((e) => e.seq + ':' + e.kind + ':' + (e.table || e.code || '') + (e.id ? '/' + e.id : ''));
  const range = (ev) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null);
  const reset = (p, persona) => p.evaluate((per) => { window.__proto.reset(); window.__proto.persona = per; }, persona);
  // Sam (biller, write_off) raises the $300 courtesy request on Lena Fischer's $410 balance; ar-1 pending, no ledger row.
  const raise = (p, cents = 30000) => p.evaluate((c) => { const r = Proto.store.requestWriteoff('p-306', c, 'courtesy'); const a = window.__proto.state().approvals.find((x) => x.id === r.requestId); return { id: r.requestId, held: !!r.held, status: a && a.status, amountCents: a && a.amountCents, requestedById: a && a.requestedById }; }, cents);
  const reqState = (p, id) => p.evaluate((rid) => { const S = window.__proto.state(); const r = S.approvals.find((x) => x.id === rid) || {}; return { status: r.status, decidedBy: r.decidedBy || null, postedCents: r.postedCents == null ? null : r.postedCents, log: S.approvalsLog.filter((l) => l.requestId === rid).map((l) => l.decision + ':' + l.by), rows: S.ledger.filter((e) => e.approvalRequestId === rid).map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, actor: e.actor, secondApprover: e.secondApprover || null })), due: Proto.store.balances('p-306').patientDue }; }, id);
  const eraLine = (p, id) => p.evaluate((lid) => { const S = window.__proto.state(); const l = S.eraLines.find((x) => x.id === lid) || {}; return { status: l.status, expectedCents: l.expectedCents, paidCents: l.paidCents, claimId: l.claimId, patientId: l.patientId, rows: S.ledger.filter((e) => e.eraLineId === lid).map((e) => e.id + ':' + e.kind + ':' + e.amountCents), batch: (S.eraBatches.find((b) => b.id === l.batchId) || {}).status, due: l.patientId ? Proto.store.balances(l.patientId).patientDue : null, claim: (S.claims.find((c) => c.id === l.claimId) || {}).status }; }, id);

  return {
    // store.js decideApproval: the approver is `user(approverId) || currentUser()` and the only identity checks are
    // blocked_same_person and verifyPin(pin, approver.id); nothing reads approve_second or the request's `eligible`
    // list, so any account with a PIN seconds a dual-release write-off. S-controls-4 passes `true` as the step-up
    // and is now refused by the PIN gate, so it no longer measures this. Negative control: Bree (entitlements [])
    // and Priya (post_payment) are refused on entitlement, ar-1 stays pending and no write_off row carries their name.
    async 'S2-approvals-writeoff-era-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const req = await raise(p);
        const seq0 = await lastSeq(p);
        const bree = await p.evaluate((id) => { const u = Proto.store.user('u-hy-1'); return { who: u.name, entitlements: u.entitlements, result: Proto.store.decideApproval(id, 'u-hy-1', 'approved', { pin: u.pin }) }; }, req.id);
        const breeAfter = await reqState(p, req.id);
        const evA = await after(p, seq0);
        await reset(p, 'biller');
        const req2 = await raise(p);
        const priya = await p.evaluate((id) => { const u = Proto.store.user('u-fd-1'); const r = window.__proto.state().approvals.find((x) => x.id === id); return { who: u.name, entitlements: u.entitlements, eligibleOnRequest: r.eligible, listedForHer: Proto.store.pendingApprovalsFor(u).length, result: Proto.store.decideApproval(id, 'u-fd-1', 'approved', { pin: u.pin }) }; }, req2.id);
        const priyaAfter = await reqState(p, req2.id);
        const rowA = breeAfter.rows[0] || null, rowB = priyaAfter.rows[0] || null;
        const reproduced = req.status === 'pending' && bree.entitlements.length === 0 && bree.result.ok === true && breeAfter.status === 'approved' && !!rowA && rowA.secondApprover === 'Bree Lawson' && rowA.amountCents === -30000
          && !priya.entitlements.includes('approve_second') && priya.listedForHer === 0 && priya.result.ok === true && !!rowB && rowB.secondApprover === 'Priya Raman';
        rec('S2-approvals-writeoff-era-1', 'decideApproval seconds a $300 dual-release write-off for any PIN holder: Bree Lawson (entitlements []) and Priya Raman (post_payment, not on the request\'s eligible list, zero cards on her phone) each approve ar-1 with their own PIN, the request flips to approved and a −$300 write_off row posts with them frozen as secondApprover', 'B3, docs/05 dual release (eligible independent second approver), CONTRACTS §6 — store.js decideApproval has no approve_second / eligible check; S-controls-4 stopped measuring behind the PIN gate',
          reproduced, { request: req, bree, breeAfter, priya, priyaAfter, writes: brief(evA), seqRange: range(evA), pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js decideApproval: `decision` is written to r.status and approvalsLog unvalidated, and the already_decided
    // guard then reads any non-'pending' string as decided. Negative control: an unknown decision is refused
    // (invalid_input), ar-1 stays pending and a later approve posts once.
    async 'S2-approvals-writeoff-era-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const req = await raise(p);
        const seq0 = await lastSeq(p);
        const r = await p.evaluate((id) => { const st = Proto.store; return { banana: st.decideApproval(id, 'u-dr-1', 'banana', { pin: '2468' }), thenApprove: st.decideApproval(id, 'u-dr-1', 'approved', { pin: '2468' }), thenDecline: st.decideApproval(id, 'u-om-1', 'declined', {}) }; }, req.id);
        const st = await reqState(p, req.id);
        const ev = await after(p, seq0);
        await hop(p, '#/biller/money'); await click(p, 'money.tab.approvals'); await p.waitForTimeout(200);
        const tab = await p.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').trim().slice(0, 400));
        const reproduced = req.status === 'pending' && r.banana.ok === true && st.status === 'banana' && st.log.includes('banana:Dr. Blake Reagan') && r.thenApprove.ok === false && r.thenApprove.code === 'already_decided' && r.thenDecline.ok === false && st.rows.length === 0;
        rec('S2-approvals-writeoff-era-2', 'decideApproval(ar-1, u-dr-1, "banana", PIN) returns ok with postedCents 30000, writes status "banana" and an approvalsLog row "banana", and every later approve or send-back is refused already_decided ("already banana"), so the request is neither approved nor declined and can never be decided', 'B2 (a decision is one of a closed set), CONTRACTS §6 invalid_input — store.js decideApproval writes `decision` unvalidated',
          reproduced, { request: req, ...r, after: st, approvalsTabText: tab, writes: brief(ev), seqRange: range(ev), pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js decideApproval: a send-back skips verifyPin (only `approved` checks stepup.pin) and there is no
    // entitlement check, so the requester's own session passing another id records that person as the decider, and a
    // seat with no approval grant closes the request. Negative control: the decider is the verified session/PIN owner
    // with approve_second; Sam's call is refused blocked_same_person and Bree's on entitlement; ar-1 stays pending.
    async 'S2-approvals-writeoff-era-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const req = await raise(p);
        const seq0 = await lastSeq(p);
        const forged = await p.evaluate((id) => ({ session: Proto.store.currentUser().name, result: Proto.store.decideApproval(id, 'u-dr-1', 'declined', true, 'no') }), req.id);
        const forgedAfter = await reqState(p, req.id);
        const evA = await after(p, seq0);
        await reset(p, 'biller');
        const req2 = await raise(p);
        const bree = await p.evaluate((id) => { window.__proto.persona = 'hygienist'; const u = Proto.store.currentUser(); return { session: u.name, entitlements: u.entitlements, result: Proto.store.decideApproval(id, u.id, 'declined', {}) }; }, req2.id);
        const breeAfter = await reqState(p, req2.id);
        await hop(p, '#/biller/money'); await click(p, 'money.tab.approvals'); await p.waitForTimeout(200);
        const tab = await p.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').trim().slice(0, 400));
        const reproduced = req.status === 'pending' && forged.session === 'Sam Dawson' && forged.result.ok === true && forgedAfter.status === 'declined' && forgedAfter.decidedBy === 'Dr. Blake Reagan'
          && bree.entitlements.length === 0 && bree.result.ok === true && breeAfter.status === 'declined' && breeAfter.decidedBy === 'Bree Lawson';
        rec('S2-approvals-writeoff-era-3', 'A send-back needs no PIN and no grant: from requester Sam Dawson\'s own session decideApproval(ar-1, "u-dr-1", "declined", true) records "declined by Dr. Blake Reagan" on the request, the log and the Approvals tab, and Bree Lawson (entitlements []) closes a fresh request as its decider', 'B3, docs/13 feature 18 (Approve and Send back are the eligible approver\'s two controls; identity re-checked on the posting) — store.js decideApproval verifies the PIN only for `approved` and never checks approve_second',
          reproduced, { request: req, forged, forgedAfter, request2: req2, bree, breeAfter, approvalsTabText: tab, writes: brief(evA), seqRange: range(evA), pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js requestApproval is a public verb (checkout.js calls it with the store's own pendingRequest) that
    // validates nothing about the pending it is handed: no sign/finite/type check on amountCents, no kind or patient
    // check, no entitlement; decideApproval then trusts the row (the balance cap applies only to kind 'write_off').
    // Negative control: requestApproval refuses a non-positive/NaN amount, an unknown kind or patient and a seat
    // without a billing grant, so no ledger row can carry +$50, NaN or an uncapped −$9,999.99.
    async 'S2-approvals-writeoff-era-4'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const r = await p.evaluate(() => {
          const st = Proto.store; const S = () => window.__proto.state(); const out = {};
          const leg = (pending, persona) => { window.__proto.reset(); window.__proto.persona = persona || 'biller'; const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0; const dueBefore = st.balances('p-306').patientDue; const req = st.requestApproval(pending); const dec = req.ok ? st.decideApproval(req.requestId, 'u-dr-1', 'approved', { pin: '2468' }) : null; const rows = req.ok ? S().ledger.filter((e) => e.approvalRequestId === req.requestId).map((e) => ({ kind: e.kind, amountCents: e.amountCents })) : []; return { request: req, decision: dec, rows, dueBefore, balancesAfter: st.balances('p-306'), seqRange: [seq0 + 1, window.__events.length ? window.__events[window.__events.length - 1].seq : seq0] }; };
          out.negative = leg({ kind: 'write_off', amountCents: -5000, reason: 'x', patientId: 'p-306' });
          out.nan = leg({ kind: 'write_off', amountCents: NaN, reason: 'x', patientId: 'p-306' });
          out.refundKind = leg({ kind: 'refund', amountCents: 999999, reason: 'x', patientId: 'p-306' });
          out.noGrant = leg({ kind: 'write_off', amountCents: 30000, reason: 'x', patientId: 'p-306' }, 'hygienist');
          out.noGrant.requester = (S().approvals[0] || {}).requestedBy;
          return out;
        });
        const notANumber = (v) => v === null || Number.isNaN(v);
        const reproduced = r.negative.request.ok === true && r.negative.rows.some((x) => x.amountCents === 5000) && r.negative.balancesAfter.patientDue === r.negative.dueBefore + 5000
          && r.nan.request.ok === true && r.nan.rows.length === 1 && notANumber(r.nan.rows[0].amountCents) && notANumber(r.nan.balancesAfter.patientDue)
          && r.refundKind.request.ok === true && r.refundKind.rows.some((x) => x.kind === 'write_off' && x.amountCents === -999999)
          && r.noGrant.request.ok === true && r.noGrant.requester === 'Bree Lawson';
        rec('S2-approvals-writeoff-era-4', 'requestApproval accepts and decideApproval posts whatever it is handed: amountCents −5000 approves into a +$50.00 write_off row that raises Lena Fischer\'s balance from $410.00 to $460.00; NaN approves into a write_off row with amountCents null and balances(p-306).patientDue becomes null; kind "refund" for 999999 skips the balance cap and posts a −$9,999.99 write_off row on a $410 account; Bree Lawson (entitlements []) raises a request in her name', 'A1/A7 (a posting is a finite, signed amount capped by what is owed), B3 — store.js requestApproval validates nothing; decideApproval caps only kind write_off and never checks sign or finiteness',
          reproduced, { ...r, pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js postCheckout: the write-off cap is min(est.patientCents − amt, balances().patientDue), and patientDue
    // is the ledger before this same Post writes the visit's $168 of charges (a-1046, note filed, nothing charged yet),
    // so the refusal says "The payment already covers what the patient owes here" while the Post it blocks would leave
    // $68 owed. CONTRACTS §4 gives Checkout the write-off controls (checkout.writeoff.add/amount/reason) and docs/04
    // puts the write-off gate inline on the form; for any visit whose charges land at Post the control can never post
    // (S-regress-money-2's held-request leg on the same visit is now refused by this cap before evaluateRelease runs,
    // so it reads "no" without measuring). Negative control (verified: cap on est.patientCents − amt): the $100 cash
    // + $68 write-off posts charge/charge/payment/write_off and the account nets $0.00.
    async 'S2-approvals-writeoff-era-5'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        const before = await p.evaluate(() => { const S = window.__proto.state(); const a = Proto.store.appt('a-1046'); const uncharged = S.procedures.filter((x) => x.encounterId === a.encounterId && !S.ledger.some((e) => e.kind === 'charge' && e.procedureId === x.id)).reduce((s, x) => s + x.feeCents, 0); return { persona: Proto.store.currentUser().name, due: Proto.store.balances('p-305').patientDue, windowPatientCents: Proto.store.windowEstimate('a-1046').patientCents, uncharged, noteFiled: !!(Proto.store.encounter(a.encounterId) || {}).noteFiled }; });
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '100');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '68'); await click(p, 'checkout.writeoff.reason.courtesy');
        const totalsText = await p.evaluate(() => { const t = document.querySelector('[data-testid="checkout.lines"]'); return t ? (t.textContent.match(/Totals.*?est\./) || [null])[0] : null; });
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const g = await gate(p);
        const why = await p.evaluate(() => { const r = [...document.querySelectorAll('.refusal')].filter((x) => x.offsetParent !== null)[0]; return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
        const ev = await after(p, seq0);
        const storeLevel = await p.evaluate(() => { const r = Proto.store.postCheckout('a-1046', { decision: 'collect', tender: 'cash', amountCents: 10000, writeoffCents: 6800, writeoffReason: 'courtesy', selfPay: [] }); return { ok: r.ok, code: r.code || null, verb: r.verb || null, why: r.why || null, rows: window.__proto.state().ledger.filter((e) => e.patientId === 'p-305').length }; });
        // The same Post without the write-off: what the patient actually owes once the charges it writes are on the ledger.
        const withoutWriteoff = await p.evaluate(() => { const r = Proto.store.postCheckout('a-1046', { decision: 'collect', tender: 'cash', amountCents: 10000, selfPay: [] }); const S = window.__proto.state(); return { ok: r.ok, code: r.code || null, due: Proto.store.balances('p-305').patientDue, rows: S.ledger.filter((e) => e.patientId === 'p-305').map((e) => e.kind + ':' + e.amountCents), apptStatus: (S.appointments.find((a) => a.id === 'a-1046') || {}).status }; });
        const reproduced = before.windowPatientCents === 16800 && before.due === 0 && before.uncharged === 16800 && /\$168\.00/.test(totalsText || '') && !!g && g.code === 'amount_required' && /nothing left/i.test(g.verb) && /already covers what the patient owes/.test(why || '') && storeLevel.ok === false && storeLevel.code === 'amount_required' && storeLevel.rows === 0 && withoutWriteoff.ok === true && withoutWriteoff.due === 6800;
        rec('S2-approvals-writeoff-era-5', 'On Checkout a-1046 (note filed, "Totals $168.00 est." of charges post at this Post, ledger $0) a $100 cash payment with a $68 courtesy write-off is refused amount_required "Remove the write-off — nothing left · The payment already covers what the patient owes here", yet the identical Post without the write-off returns ok and leaves Patient due $68.00 — the refusal states a balance the Post it blocks contradicts, and a below-threshold write-off can never post at the window for a visit whose charges land at Post', 'C5 (a refusal and the posting disagree on the balance), A2 (the Checkout write-off control of CONTRACTS §4 / docs/04 never posts for a visit charged at Post) — store.js postCheckout caps against balances().patientDue before the same call writes the visit\'s charges; windowEstimate counts them',
          reproduced, { before, totalsText, gate: g, refusalText: why, storeLevel, withoutWriteoff, refusals: brief(ev), seqRange: range(ev), pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js eraHold has no status guard: a `posted` line is overwritten to `held`, and eraConfirm refuses only
    // posted/disputed/denied, so the line posts a second time. S-moneydesk-close-6 named eraHold in its comment but
    // drove only the dispute leg, which eraConfirm now refuses, so it reads "no"; the hold leg is open (eraDispute on a
    // posted line likewise still flips it to disputed with its rows on the ledger). Negative control (verified): eraHold
    // on a posted line refuses already_decided and the ledger keeps exactly one insurance_payment + write_off pair for el-14.
    async 'S2-approvals-writeoff-era-6'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        await click(p, 'money.era.line.el-14.confirm'); await p.waitForTimeout(150);
        const posted = await eraLine(p, 'el-14');
        const seq0 = await lastSeq(p);
        const hold = await p.evaluate(() => Proto.store.eraHold('el-14'));
        const held = await eraLine(p, 'el-14');
        const confirmAgain = await p.evaluate(() => Proto.store.eraConfirm('el-14'));
        const twice = await eraLine(p, 'el-14');
        const ev = await after(p, seq0);
        const sums = await p.evaluate(() => { const S = window.__proto.state(); const f = (k) => S.ledger.filter((e) => e.eraLineId === 'el-14' && e.kind === k).reduce((s, e) => s + e.amountCents, 0); return { insurance: f('insurance_payment'), writeOff: f('write_off'), balances: Proto.store.balances('p-330') }; });
        const reproduced = posted.status === 'posted' && posted.rows.length === 2 && hold.ok === true && held.status === 'held' && held.rows.length === 2 && confirmAgain.ok === true && twice.rows.length === 4 && sums.insurance === -108000 && sums.writeOff === -10000;
        rec('S2-approvals-writeoff-era-6', 'After Confirm posts ERA line el-14 (−$540 insurance payment, −$50 contractual write-off), eraHold returns ok and flips the posted line to held with its two rows still on the ledger; eraConfirm then posts it again, so p-330 carries two −$540 payments and two −$50 write-offs (−$1,080 insurance, −$100 write-off) for one 835 line', 'A4 (an irreversible posting posts once) — store.js eraHold overwrites status with no posted guard; eraConfirm refuses posted/disputed/denied but not held-after-posted; S-moneydesk-close-6 stopped measuring',
          reproduced, { posted, hold, held, confirmAgain, twice, sums, writes: brief(ev), seqRange: range(ev), pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js eraConfirm refuses a `denied` line, but eraHold has no status guard and rewrites the denied line to
    // `held`, after which eraConfirm posts a $0 insurance payment and writes the whole expected amount off as
    // contractual_ppo while claim c-88 stays denied. Negative control: eraHold refuses a denied line (or eraConfirm
    // refuses paidCents 0 / a denial CARC), no row carries eraLineId el-40 and p-321's Patient due is unchanged.
    async 'S2-approvals-writeoff-era-7'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        const denied = await eraLine(p, 'el-40');
        const direct = await p.evaluate(() => Proto.store.eraConfirm('el-40'));
        const seq0 = await lastSeq(p);
        const hold = await p.evaluate(() => Proto.store.eraHold('el-40'));
        const held = await eraLine(p, 'el-40');
        const confirm = await p.evaluate(() => Proto.store.eraConfirm('el-40'));
        const posted = await eraLine(p, 'el-40');
        const ev = await after(p, seq0);
        const reproduced = denied.status === 'denied' && denied.paidCents === 0 && denied.claim === 'denied' && direct.ok === false && direct.code === 'already_decided' && hold.ok === true && held.status === 'held' && confirm.ok === true && posted.status === 'posted' && posted.rows.length === 2 && posted.rows.some((r) => /write_off:-28500$/.test(r)) && posted.due === denied.due - 28500 && posted.claim === 'denied';
        rec('S2-approvals-writeoff-era-7', 'eraConfirm("el-40") on the denied $0 line refuses, but eraHold("el-40") returns ok and sets it held, and eraConfirm then posts a $0.00 insurance_payment plus a −$285.00 contractual_ppo write-off: p-321\'s Patient due drops from $1,115.50 to $830.50 while claim c-88 stays denied and no appeal was sent', 'A2 (a denied line paid nothing; the denial worklist owns it), docs/13 feature 16 — store.js eraHold has no status guard, so the denied refusal in eraConfirm is one hold away from being skipped',
          reproduced, { denied, directConfirm: direct, hold, held, confirm, posted, writes: brief(ev), seqRange: range(ev), pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js eraPostMatched / eraConfirm / eraDispute gate on bills() = any of post_payment, post_era, write_off,
    // submit_claims, so Priya Raman (post_payment, schedule) posts the 835 and a contractual write_off row, while
    // requestWriteoff refuses her for lacking write_off one tab over. No doc names the grant that posts an 835 and the
    // bills() comment says the front desk posts here, so the breach measured is the grant disagreement (a write_off row
    // under a seat that write_off refuses) plus post_era being seeded and required by nothing — medium, not high.
    // Negative control (verified): the ERA verbs require post_era (and eraConfirm's write-off, write_off), Priya is
    // refused on entitlement and no ERA row carries her name.
    async 'S2-approvals-writeoff-era-8'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/money');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const st = Proto.store; const S = () => window.__proto.state(); const u = st.currentUser();
          const post = st.eraPostMatched('era-1');
          const confirm = st.eraConfirm('el-14');
          const dispute = st.eraDispute('el-22');
          const writeoff = st.requestWriteoff('p-306', 5000, 'courtesy');
          const mine = S().ledger.filter((e) => e.eraLineId && e.actor === u.name);
          return { who: u.name, entitlements: u.entitlements, post: { ok: post.ok, code: post.code || null, posted: post.posted }, confirm: { ok: confirm.ok, code: confirm.code || null }, dispute: { ok: dispute.ok, code: dispute.code || null, packetId: dispute.packet && dispute.packet.id }, writeoff: { ok: writeoff.ok, code: writeoff.code || null, verb: writeoff.verb || null }, eraRowsByHer: mine.length, writeOffRowsByHer: mine.filter((e) => e.kind === 'write_off').map((e) => e.id + ':' + e.amountCents + ':' + e.reason) };
        });
        const ev = await after(p, seq0);
        const reproduced = r.who === 'Priya Raman' && !r.entitlements.includes('post_era') && !r.entitlements.includes('write_off') && r.post.ok === true && r.post.posted === 37 && r.confirm.ok === true && r.dispute.ok === true && r.writeoff.ok === false && r.writeoff.code === 'entitlement' && r.eraRowsByHer === 39 && r.writeOffRowsByHer.length === 1;
        rec('S2-approvals-writeoff-era-8', 'As Priya Raman (post_payment, schedule; no post_era, no write_off) Post matched writes 37 insurance_payment rows, Confirm on el-14 writes a −$540 payment and a −$50 contractual write_off in her name, and Dispute on el-22 opens an appeal packet, while the write-off control on the same Money Desk refuses her "Ask a seat that can write off balances" for lacking write_off', 'B3 (entitlement per verb; two verbs disagree on the same grant), docs/05 SoD — store.js bills() admits any BILLING grant to eraPostMatched/eraConfirm/eraDispute; only requestWriteoff adds needs(write_off); post_era (seed.js, Sam) is required by no verb',
          reproduced, { ...r, writes: brief(ev).slice(0, 12), writeCount: ev.filter((e) => e.kind === 'write').length, seqRange: range(ev), pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js requestWriteoff checks Number.isFinite(amountCents) && > 0 but not Number.isInteger, unlike postCheckout's
    // collect amount, so a fractional or sub-cent amount posts a ledger row the cents ledger cannot represent.
    // Negative control: 100.5 and 1e-7 refuse amount_required and the ledger holds only integer amounts.
    async 'S2-approvals-writeoff-era-10'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const st = Proto.store; const S = () => window.__proto.state();
          const frac = st.requestWriteoff('p-306', 100.5, 'courtesy'); const tiny = st.requestWriteoff('p-306', 1e-7, 'courtesy');
          const rows = S().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && !Number.isInteger(e.amountCents)).map((e) => e.id + ':' + e.amountCents);
          const checkoutGuard = st.postCheckout('a-1047', { decision: 'collect', tender: 'cash', amountCents: 100.5, selfPay: [] });
          return { frac: { ok: frac.ok, code: frac.code || null }, tiny: { ok: tiny.ok, code: tiny.code || null }, nonIntegerRows: rows, due: st.balances('p-306').patientDue, dueDisplayed: Proto.ui.money(st.balances('p-306').patientDue), checkoutGuard: { ok: checkoutGuard.ok, code: checkoutGuard.code || null } };
        });
        const ev = await after(p, seq0);
        const reproduced = r.frac.ok === true && r.tiny.ok === true && r.nonIntegerRows.length === 2 && !Number.isInteger(r.due) && r.checkoutGuard.ok === false && r.checkoutGuard.code === 'amount_required';
        rec('S2-approvals-writeoff-era-10', 'requestWriteoff("p-306", 100.5) and requestWriteoff("p-306", 1e-7) both return ok and write write_off rows of −100.5 and −1e-7 cents, leaving Patient due 40899.4999999 (printed "$408.99"), while postCheckout refuses the same 100.5 as "a value the ledger cannot store"', 'A1 (a ledger amount is an integer number of cents), one rule one owner — store.js requestWriteoff lacks the Number.isInteger check postCheckout applies',
          reproduced, { ...r, writes: brief(ev), seqRange: range(ev), pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
