// Swarm 2, regression hunt after the fix round (swarm2/fix-harness), lens "proto-money-identity": prototype money,
// approvals, ERA and identity paths in store.js / checkout.js / phone.js / moneydesk.js. Every check drives the
// store through the screens or through Proto.store.* the way a caller can, and measures the rows, statuses, gates
// and balances that moved. Default position is NOT reproduced: each check measures the breach it claims and carries
// the measured values in its evidence. Every check closes its browser context in `finally`.
// Verified: each check flipped to "no" under a temporary local patch of the named function (reverted before commit).
export default ({ ctx, go, click, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const after = (p, seq) => p.evaluate((seq) => window.__events.filter((e) => e.seq > seq).map((e) => e.seq + ':' + e.kind + ':' + (e.table ? e.table + '/' + e.id : e.code || e.testid || '')), seq);
  const gate = (p) => p.evaluate(() => { const r = [...document.querySelectorAll('.refusal')].filter((x) => x.offsetParent !== null)[0]; return r ? { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim(), why: ((r.querySelector('[data-testid="refusal.why"]') || r).textContent || '').replace(/\s+/g, ' ').trim() } : null; });
  const slim = (r) => (r ? { ok: r.ok, code: r.code || null, verb: r.verb || null, control: r.control || null, held: r.held || null, requestId: r.requestId || null, postedCents: r.postedCents == null ? null : r.postedCents } : null);

  return {
    // store.js postCheckout vs requestApproval/decideApproval: the fix round moved Post's write-off cap onto the balance
    // the Post leaves (ledger + the charges a filed note releases − payment), so on a-1046 (note filed, $168 of charges
    // not yet on the ledger, ledger $0) a $160 courtesy write-off passes the cap, reaches evaluateRelease and is held
    // needs_second with the control "Request approval". The request verb it hands off to, and the approval that would
    // settle it, still cap against balances(pid).patientDue — the pre-Post ledger, $0 — so pressing the control the
    // refusal offers is refused amount_required "Remove the write-off — nothing left" against a window that says
    // $168.00 is owed. Two verbs in one flow disagree on the same balance and a held write-off at the window can never
    // be requested for a visit whose charges land at Post.
    // Negative control: requestApproval (and decideApproval) cap against the balance the deferred Post would leave
    // (patientDue + uncharged fees of pending.appointmentId when its note is filed); the control writes an approvals row
    // and the phone/Approvals list carries it; the check reads "no".
    async 'S2-regress-proto-money-identity-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/checkout/a-1046');
        const before = await p.evaluate(() => ({ persona: Proto.store.currentUser().name, due: Proto.store.balances('p-305').patientDue, windowPatientCents: Proto.store.windowEstimate('a-1046').patientCents, threshold: window.__proto.state().tenant.dualReleaseThresholdCents, approvals: window.__proto.state().approvals.length }));
        await click(p, 'checkout.collect.seg.send-statement');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '160.00'); await click(p, 'checkout.writeoff.reason.courtesy');
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const postGate = await gate(p);
        const seq0 = await lastSeq(p);
        if (await p.$(tid('refusal.control'))) { await p.click(tid('refusal.control')); await p.waitForTimeout(200); }
        const requestGate = await gate(p);
        const ev = await after(p, seq0);
        const afterUi = await p.evaluate(() => ({ approvals: window.__proto.state().approvals.map((a) => a.id + ':' + a.status + ':' + a.amountCents), pendingForPhone: Proto.store.pendingApprovalsFor(window.__proto.state().users.find((u) => u.id === 'u-om-1')).length }));
        // The same disagreement at the store level: Post hands back the pending row, the request verb refuses it.
        const direct = await p.evaluate(() => {
          window.__proto.reset(); window.__proto.persona = 'biller'; const st = Proto.store;
          const post = st.postCheckout('a-1046', { decision: 'send_statement', amountCents: 0, writeoffCents: 16000, writeoffReason: 'courtesy', selfPay: [] });
          const req = post.pendingRequest ? st.requestApproval(post.pendingRequest) : null;
          return { post: { ok: post.ok, code: post.code || null, control: post.control || null, pending: post.pendingRequest || null }, request: req ? { ok: req.ok, code: req.code || null, verb: req.verb || null, why: req.why || null } : null, due: st.balances('p-305').patientDue, windowPatientCents: st.windowEstimate('a-1046').patientCents };
        });
        const reproduced = !!postGate && postGate.code === 'needs_second' && /Request approval/.test(postGate.control)
          && !!requestGate && requestGate.code === 'amount_required' && afterUi.approvals.length === before.approvals
          && !!direct.request && direct.request.ok === false && direct.request.code === 'amount_required' && direct.windowPatientCents > 16000;
        rec('S2-regress-proto-money-identity-1', 'On Checkout a-1046 (note filed, "$168.00 est.", ledger $0) Post with a $160 courtesy write-off is held needs_second and offers "Request approval"; pressing that control is refused amount_required "Remove the write-off — nothing left" and no approvals row is written, because requestApproval (and decideApproval) still cap against balances().patientDue = $0 while postCheckout was fixed to cap against the balance the Post leaves', 'C5 (two verbs in one flow disagree on the balance), A2 (the "Request approval" control of CONTRACTS §6 performs nothing) — store.js requestApproval writeoffCap(pending.amountCents, balances(pid).patientDue); decideApproval due = balances(r.patientId).patientDue',
          reproduced, { before, postGate, requestGate, approvalsAfterUi: afterUi, direct, events: ev, pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js eraDispute: the fix round gave eraHold a status guard (HOLDABLE = matched/unmatched/delta; posted →
    // already_decided) but left eraDispute without one, so the same posted line that Set aside now refuses is still
    // accepted by Dispute: el-14 flips posted → disputed while its −$540 insurance_payment and −$50 write_off stay
    // on the ledger, a claimEvents era.contract_variance_disputed row and an appealPackets row ("ERA paid $540.00")
    // are written for money already posted, and Money Desk counts the line as "1 disputed" instead of posted.
    // The screen hides the Dispute control on a decided row, so this is the store guard the fix half-landed.
    // Negative control: eraDispute on a posted (or disputed/denied) line refuses already_decided like eraHold, the
    // line stays posted and no claimEvents/appealPackets rows are written; the check reads "no".
    async 'S2-regress-proto-money-identity-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        await click(p, 'money.era.line.el-14.confirm'); await p.waitForTimeout(150);
        const r = await p.evaluate(() => {
          const st = Proto.store; const S = () => window.__proto.state();
          const line = () => S().eraLines.find((l) => l.id === 'el-14');
          const rows = () => S().ledger.filter((e) => e.eraLineId === 'el-14').map((e) => e.id + ':' + e.kind + ':' + e.amountCents);
          const out = { statusBefore: line().status, rowsBefore: rows(), packetsBefore: S().appealPackets.filter((x) => x.eraLineId === 'el-14').length, disputedEventsBefore: S().claimEvents.filter((e) => e.kind === 'era.contract_variance_disputed').length };
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          out.hold = st.eraHold('el-14'); out.statusAfterHold = line().status;
          out.dispute = st.eraDispute('el-14'); out.statusAfterDispute = line().status;
          out.rowsAfter = rows();
          out.packetsAfter = S().appealPackets.filter((x) => x.eraLineId === 'el-14').map((x) => x.id + ':' + x.kind + ':' + x.citation);
          out.disputedEventsAfter = S().claimEvents.filter((e) => e.kind === 'era.contract_variance_disputed').map((e) => e.claimId + ':' + e.actor);
          out.events = window.__events.filter((e) => e.seq > seq0).map((e) => e.seq + ':' + e.kind + ':' + (e.table ? e.table + '/' + e.id : e.code || ''));
          return out;
        });
        // The word on screen: after the flip the batch card counts the posted line among the disputed.
        await p.evaluate(() => { location.hash = '#/biller/board'; }); await p.waitForTimeout(150);
        await p.evaluate(() => { location.hash = '#/biller/money'; }); await p.waitForTimeout(200);
        const screen = await p.evaluate(() => { const t = document.body.textContent.replace(/\s+/g, ' '); const m = t.match(/\d+ posted[^.]*?disputed[^.]*/); return m ? m[0].trim() : null; });
        const reproduced = r.statusBefore === 'posted' && r.hold.ok === false && r.hold.code === 'already_decided' && r.statusAfterHold === 'posted'
          && !!r.dispute.ok && r.statusAfterDispute === 'disputed' && r.rowsAfter.length === r.rowsBefore.length && r.rowsAfter.length > 0
          && r.packetsAfter.length > r.packetsBefore && r.disputedEventsAfter.length > r.disputedEventsBefore;
        rec('S2-regress-proto-money-identity-2', 'eraHold on posted line el-14 refuses already_decided (the fix) but eraDispute on the same posted line returns ok, flips it posted → disputed with its −$540 insurance_payment and −$50 write_off still on the ledger, and writes a contract_variance appeal packet and an era.contract_variance_disputed claim event for money already posted', 'A4 / docs/04 (the word on screen and the status in the record agree; one 835 line is decided once) — store.js eraDispute has no status guard while eraHold (HOLDABLE) and eraConfirm do',
          reproduced, { ...r, screenAfter: screen, pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js requestApproval: `const u = who || (pending.posterId && user(pending.posterId)) || currentUser()` — the
    // requester is whoever the pending row names. postCheckout sets posterId to the PIN's owner, but the verb is on
    // Proto.store and trusts the field: from Bree's seat (entitlements [], own request refused "entitlement") the same
    // call with posterId 'u-bl-1' writes a pending request "requested by Sam Dawson" (requestedById u-bl-1), the
    // entitlement gate is evaluated against Sam, no PIN is asked, and Dana's approval posts a −$200 write_off with
    // actor "Sam Dawson" on Lena Fischer's $410 account. The identity on the request, the log row and the ledger is
    // one the caller chose, not one the store verified (the decideApproval comment above it states the opposite rule).
    // Negative control: requestApproval resolves the requester from the session or a verified PIN (posterId is only
    // honoured when it equals currentUser().id or a PIN in `pending`/extras names it), so Bree's forged row is refused
    // entitlement/pin_required and no approvals row or write_off carries Sam's name; the check reads "no".
    async 'S2-regress-proto-money-identity-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const r = await p.evaluate(() => {
          window.__proto.reset(); window.__proto.persona = 'hygienist';
          const st = Proto.store; const S = () => window.__proto.state(); const out = {};
          const seat = st.currentUser(); out.seat = { name: seat.name, id: seat.id, entitlements: seat.entitlements, device: window.__proto.device };
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const own = st.requestApproval({ kind: 'write_off', amountCents: 20000, reason: 'courtesy', patientId: 'p-306' });
          out.own = { ok: own.ok, code: own.code || null, verb: own.verb || null };
          const forged = st.requestApproval({ kind: 'write_off', amountCents: 20000, reason: 'courtesy', patientId: 'p-306', posterId: 'u-bl-1' });
          out.forged = { ok: forged.ok, code: forged.code || null, requestId: forged.requestId || null };
          const req = S().approvals.find((a) => a.id === forged.requestId);
          out.request = req ? { requestedBy: req.requestedBy, requestedById: req.requestedById, status: req.status, amountCents: req.amountCents } : null;
          out.sentence = req ? st.approvalSentence(req) : null;
          out.dueBefore = st.balances('p-306').patientDue;
          const dec = forged.ok ? st.decideApproval(forged.requestId, 'u-om-1', 'approved', { pin: '4444' }) : null;
          out.decision = dec ? { ok: dec.ok, code: dec.code || null, postedCents: dec.postedCents == null ? null : dec.postedCents } : null;
          out.rows = S().ledger.filter((e) => e.approvalRequestId === forged.requestId).map((e) => ({ kind: e.kind, amountCents: e.amountCents, actor: e.actor, secondApprover: e.secondApprover }));
          out.log = S().approvalsLog.filter((l) => l.requestId === forged.requestId).map((l) => l.decision + ':' + l.by);
          out.dueAfter = st.balances('p-306').patientDue;
          out.sessions = S().sessions.filter((s) => s.kind === 'posting').map((s) => s.userId);
          out.events = window.__events.filter((e) => e.seq > seq0).map((e) => e.seq + ':' + e.kind + ':' + (e.table ? e.table + '/' + e.id : e.code || ''));
          return out;
        });
        const reproduced = r.seat.id === 'u-hy-1' && r.own.ok === false && r.forged.ok === true && !!r.request && r.request.requestedById === 'u-bl-1' && r.request.requestedBy === 'Sam Dawson'
          && !!r.decision && r.decision.ok === true && r.rows.some((x) => x.kind === 'write_off' && x.amountCents === -20000 && x.actor === 'Sam Dawson') && r.dueAfter === r.dueBefore - 20000;
        rec('S2-regress-proto-money-identity-3', 'From Bree Lawson\'s seat (entitlements [], own request refused "entitlement"), requestApproval({..., posterId: "u-bl-1"}) writes a pending write-off request "requested by Sam Dawson" without a PIN, and Dana\'s approval then posts a −$200.00 write_off with actor "Sam Dawson" that takes Lena Fischer from $410.00 to $210.00 — the requester identity is whatever the caller passes', 'B3/docs/05 SoD (identity on a posting is the store\'s, never the caller\'s), A3 (a decision recorded under an identity nobody verified) — store.js requestApproval trusts pending.posterId via user(posterId)',
          reproduced, { ...r, pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
