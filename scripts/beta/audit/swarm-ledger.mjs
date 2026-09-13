// Swarm hunt, lens: ledger (prototype/js/store.js money verbs: allocate, balances, postCheckout, requestWriteoff,
// decideApproval, reviewDecision, eraConfirm, closeDay). Sequences and edges the existing 294 checks did not drive.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
// Verified (swarm/verified-ledger): S-ledger-1..8 reproduced by an independent probe and each flips to "no" under a
// one-line local fix of its own root cause (negative control); S-ledger-v1 added for the adjacent Daily Close defect.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  // The three labelled numbers of the canvas header (checkout.js:121 threeNumbers), keyed by label.
  const threeDom = (p) => p.evaluate(() => { const out = {}; const box = document.querySelector('#canvas .threenum') || document.querySelector('.threenum'); if (!box) return null; box.querySelectorAll('.n').forEach((n) => { out[n.querySelector('.l').textContent.trim()] = n.querySelector('.v').textContent.trim(); }); return out; });

  return {
    // S-ledger-1 · A7/C5 (docs/13 feature 23: the three numbers are sums over ledger rows) · store.js:59 allocate() caps
    // `take` at the charge's open amount and drops the remainder of a payment, so `over` (:73) can never go negative;
    // store.js:165 writes the Filed-later credits row with fromLedger:true, which :75 skips. Net: an unfiled $44 payment
    // is on the ledger (sum −4400) and the Posted card says "held as credit", but Credit reads $0.00 on the same screen.
    // Negative control: once allocate() carries the unapplied remainder into credit (or the credits row is counted), the
    // Credit tile reads $44.00 after Post and storeCredit === 4400; then creditTileZero is false and the check reports false.
    async 'S-ledger-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/checkout/a-1044');
        const before = await p.evaluate(() => ({ bal: Proto.store.balances('p-303'), ledgerSum: window.__proto.state().ledger.filter((e) => e.patientId === 'p-303').reduce((s, e) => s + e.amountCents, 0), noteFiled: !!window.__proto.state().encounters.find((e) => e.id === 'enc-9003').noteFiled }));
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242'); await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const posted = ev.some((e) => e.kind === 'write' && e.table === 'collectionDecisions');
        const dom = await threeDom(p);
        const afterS = await p.evaluate(() => {
          const S = window.__proto.state();
          const pay = S.ledger.filter((e) => e.kind === 'patient_payment' && e.patientId === 'p-303' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, gl: e.gl }));
          return {
            bal: Proto.store.balances('p-303'),
            payments: pay,
            ledgerSum: S.ledger.filter((e) => e.patientId === 'p-303').reduce((s, e) => s + e.amountCents, 0),
            credits: S.credits.filter((x) => x.patientId === 'p-303').map((x) => ({ id: x.id, amountCents: x.amountCents, fromLedger: !!x.fromLedger, applied: !!x.applied })),
            intents: S.allocationIntents.filter((x) => x.encounterId === 'enc-9003').map((x) => ({ id: x.id, amountCents: x.amountCents, appliedTo: x.appliedTo || null })),
            postedCardText: ((document.querySelector('.co-posted') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260),
            explain: Proto.store.explain('p-303').map((x) => x.sentence),
            // The same root cause on seed data: p-312's ledger nets to an overpayment the three numbers never show.
            seedOverpay: { patient: 'p-312', ledgerSum: S.ledger.filter((e) => e.patientId === 'p-312').reduce((s, e) => s + e.amountCents, 0), bal: Proto.store.balances('p-312'), explain: Proto.store.explain('p-312').map((x) => x.sentence) },
          };
        });
        const heldAsCredit = /held as credit/i.test(afterS.postedCardText);
        const creditTileZero = !!dom && dom.Credit === '$0.00';
        const reproduced = posted && !before.noteFiled && afterS.payments.length === 1 && heldAsCredit && creditTileZero && afterS.bal.credit === 0 && afterS.ledgerSum < 0 && afterS.intents.every((i) => !i.appliedTo);
        rec('S-ledger-1', 'Post on the unfiled a-1044 writes a −$44.00 payment the Posted card calls "held as credit", yet Credit reads $0.00 on the same screen and the store credit is 0: allocate() drops the unapplied remainder and skips the fromLedger credits row, so the money is on the ledger and in none of the three numbers (seed p-312 likewise nets −$31.00 with 0/0/0)', 'A7, C5 — docs/13 feature 23 three numbers from ledger rows; store.js:59 take=min(rem,open) drops rem, :73 over never < 0, :75 skips fromLedger, :165 writes fromLedger:true',
          reproduced, { postAccepted: posted, noteFiledBefore: before.noteFiled, balanceBefore: before.bal, ledgerSumBefore: before.ledgerSum, paymentsWritten: afterS.payments, threeNumbersOnScreen: dom, storeBalanceAfter: afterS.bal, ledgerSumAfter: afterS.ledgerSum, creditsRows: afterS.credits, allocationIntents: afterS.intents, postedCardText: afterS.postedCardText, explainAfter: afterS.explain, seedOverpayment: afterS.seedOverpay, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-2 · A7/C5 · store.js:59 applies a patient payment to the whole open amount of the oldest charge before :66-71
    // nets insurance's expected share out of what is left, so the patient's money pays insurance's part of one charge and
    // the patient's own part of the next charges stays open. Flow 4 (a-1044: fee $261, insurance expected $217, patient $44):
    // after collecting exactly the $44 the estimate asked for, Patient due reads $33.04 and Waiting on insurance $183.96.
    // Negative control: once the insurance share is netted per charge before patient money is applied (or payments are applied
    // to the patient portion only), Patient due is $0.00 and Waiting on insurance $217.00 after Post; then patientDueAfter === 0
    // and the check reports false. Measured in both orders (file then pay; pay unfiled then file) so a fix to one path is not scored.
    async 'S-ledger-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        const filed = await p.evaluate(() => Proto.store.fileNote('enc-9003', { assessment: 'Recall exam, no new caries', plan: 'Recall 6 months' }, true));
        await hop(p, '#/frontdesk/checkout/a-1044'); await p.waitForTimeout(150);
        const before = await p.evaluate(() => ({ bal: Proto.store.balances('p-303'), est: window.__proto.state().estimates['a-1044'], charges: window.__proto.state().ledger.filter((e) => e.kind === 'charge' && e.patientId === 'p-303').map((e) => ({ id: e.id, amountCents: e.amountCents, insuranceExpectedCents: e.insuranceExpectedCents })) }));
        const prefill = await p.$eval('[data-testid="checkout.amount"]', (e) => e.value).catch(() => null);
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242'); await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const posted = ev.some((e) => e.kind === 'write' && e.table === 'collectionDecisions');
        const dom = await threeDom(p);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return { bal: Proto.store.balances('p-303'), payment: S.ledger.filter((e) => e.kind === 'patient_payment' && e.patientId === 'p-303' && e.posted === S.tenant.today).map((e) => e.id + ':' + e.amountCents), decision: (S.collectionDecisions.find((d) => d.encounterId === 'enc-9003') || {}).patientPortionCents, explain: Proto.store.explain('p-303').map((x) => x.sentence), postedCardText: ((document.querySelector('.co-posted') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) }; });
        // Other order: pay unfiled first, then File releases the charges with the same prorated expected cents.
        await p.evaluate(() => window.__proto.reset()); await hop(p, '#/frontdesk/checkout/a-1044'); await p.waitForTimeout(150);
        const other = await p.evaluate(() => { const st = Proto.store; const a = st.postCheckout('a-1044', { decision: 'collect', tender: 'card', amountCents: 4400 }); window.__proto.set({ persona: 'dentist' }); const f = st.fileNote('enc-9003', { assessment: 'Recall exam', plan: 'Recall' }, true); return { post: a.ok, filed: f.ok, bal: st.balances('p-303') }; });
        const expectedIns = before.est ? before.est.insuranceCents : null;
        const reproduced = !!filed.ok && posted && before.bal.patientDue === 4400 && afterS.bal.patientDue > 0 && afterS.bal.patientDue < 4400 && expectedIns != null && afterS.bal.insurancePending < expectedIns && afterS.bal.insurancePending + afterS.bal.patientDue === expectedIns && !!dom && dom['Patient due'] !== '$0.00' && other.bal.patientDue === afterS.bal.patientDue;
        rec('S-ledger-2', 'Flow 4 on a-1044: after the patient pays the full $44.00 the estimate asked for, the ledger header reads Patient due $33.04 and Waiting on insurance $183.96 (estimate $217.00) because allocate() lets the patient payment absorb insurance\'s expected share of the first charge', 'A7, C5 — docs/13 feature 23; store.js:59 payment applied to full open before :66-71 nets insuranceExpectedCents',
          reproduced, { noteFiled: !!filed.ok, estimate: before.est, chargesReleased: before.charges, balanceBefore: before.bal, prefillAmount: prefill, postAccepted: posted, paymentWritten: afterS.payment, decisionPatientPortionCents: afterS.decision, threeNumbersOnScreen: dom, storeBalanceAfter: afterS.bal, explainAfter: afterS.explain, postedCardText: afterS.postedCardText, otherOrderPayThenFile: other, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-3 · A2 (docs/05 dual release: an approval-required entry carries an approved request; a write-off posts once) ·
    // store.js:160 postCheckout re-evaluates the gate at Post time and writes the write-off itself when the amount is now
    // below threshold, without touching the visit's pending request; store.js:202-220 decideApproval then posts the same
    // write-off again from the request. Sequence: Tighten (threshold $100) → biller requests $120 write-off (ar-1 pending)
    // → owner Retires (threshold $150) → biller's Post writes −$120 → owner approves ar-1 → second −$120 on the ledger.
    // Negative control: once Post either honours the pending request (holds) or withdraws it, and decideApproval refuses a
    // request whose write-off already posted, writeOffRowsAfterApprove has one −12000 row; then the check reports false.
    async 'S-ledger-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const st = Proto.store; const S = st.get(); const out = { steps: [] };
          const rows = () => S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, actor: e.actor, approvalRequestId: e.approvalRequestId || null }));
          out.threshold0 = S.tenant.dualReleaseThresholdCents;
          out.tighten = st.reviewDecision('d-1', 'tighten'); out.threshold1 = S.tenant.dualReleaseThresholdCents;
          window.__proto.set({ persona: 'biller' });
          out.post1 = st.postCheckout('a-1047', { decision: 'zero_due', writeoffCents: 12000, writeoffReason: 'courtesy' });
          out.request = out.post1.pendingRequest ? st.requestApproval(out.post1.pendingRequest) : null;
          out.approvalsAfterRequest = S.approvals.map((a) => ({ id: a.id, status: a.status, amountCents: a.amountCents, appointmentId: a.appointmentId }));
          window.__proto.set({ persona: 'owner' });
          out.retire = st.reviewDecision('d-1', 'retire'); out.threshold2 = S.tenant.dualReleaseThresholdCents;
          window.__proto.set({ persona: 'biller' });
          out.post2 = st.postCheckout('a-1047', { decision: 'zero_due', writeoffCents: 12000, writeoffReason: 'courtesy' });
          out.writeOffRowsAfterPost = rows();
          out.approvalsAfterPost = S.approvals.map((a) => ({ id: a.id, status: a.status }));
          window.__proto.set({ persona: 'owner' });
          out.approve = out.request && out.request.requestId ? st.decideApproval(out.request.requestId, 'u-dr-1', 'approved', true) : null;
          out.writeOffRowsAfterApprove = rows();
          out.balanceAfter = st.balances('p-306');
          out.approvalsAfterApprove = S.approvals.map((a) => ({ id: a.id, status: a.status, decidedBy: a.decidedBy }));
          return out;
        });
        const ev = await after(p, seq0);
        const twice = r.writeOffRowsAfterApprove.filter((x) => x.amountCents === -12000);
        const reproduced = !!r.tighten.ok && r.post1.code === 'needs_second' && !!(r.request && r.request.ok) && !!r.retire.ok && !!r.post2.ok && r.writeOffRowsAfterPost.length === 1 && r.approvalsAfterPost.some((a) => a.status === 'pending') && !!(r.approve && r.approve.ok) && twice.length === 2;
        rec('S-ledger-3', 'A pending write-off request survives a Post that no longer needs it: Tighten → request $120 (ar-1 pending) → Retire → Post writes −$120 below threshold and leaves ar-1 pending → the approver approves ar-1 and a second −$120 write-off posts, $240 written off for one $120 decision', 'A2 — docs/05 dual release in the transaction, an entry posts once against one approved request; store.js:160 postCheckout ignores the visit\'s pending request; store.js:202-220 decideApproval never checks whether the write-off already posted',
          reproduced, { thresholds: [r.threshold0, r.threshold1, r.threshold2], tighten: r.tighten, firstPost: { ok: r.post1.ok, code: r.post1.code || null }, request: r.request, approvalsAfterRequest: r.approvalsAfterRequest, retire: r.retire, secondPost: r.post2, writeOffRowsAfterPost: r.writeOffRowsAfterPost, approvalsAfterPost: r.approvalsAfterPost, approve: r.approve, writeOffRowsAfterApprove: r.writeOffRowsAfterApprove, approvalsAfterApprove: r.approvalsAfterApprove, balanceAfter: r.balanceAfter, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-4 · A2 (docs/05: write-off is a guarded channel; store.js:41 NO_PASS "every gate that needs one refuses") ·
    // store.js:222-231 requestWriteoff checks patient, outage, amount and the dual-release band but never the actor: no
    // write_off entitlement test and no noPass test (postCheckout has one at :131). On the Money Desk as the temp persona
    // with no day pass, a $100 write-off posts with actor "No day pass issued"; the front desk (no write_off entitlement)
    // posts a write-off through checkout Post; a hygienist posts one by verb.
    // Negative control: once requestWriteoff and the Post write-off branch refuse an actor without the write_off
    // entitlement (and NO_PASS), tempRow is null and the front-desk Post refuses with code entitlement; the check reports false.
    async 'S-ledger-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/money');
        const user = await p.evaluate(() => Proto.store.currentUser());
        const before = await p.evaluate(() => ({ bal: Proto.store.balances('p-306'), writeOffs: window.__proto.state().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306').map((e) => e.id) }));
        const seq0 = await lastSeq(p);
        const opened = await click(p, 'money.writeoff.p-306');
        await fill(p, 'money.writeoff.amount', '100.00'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const afterUi = await p.evaluate(() => { const S = window.__proto.state(); return { bal: Proto.store.balances('p-306'), rows: S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, actor: e.actor, actorKind: e.actorKind, locationId: e.locationId, reason: e.reason })), canvasChip: [...document.querySelectorAll('#canvas .chip')].map((x) => x.textContent.trim()).filter((t) => /write-off/i.test(t)), refusal: (document.querySelector('.refusal') || {}).textContent || null }; });
        const tempRow = afterUi.rows.find((x) => x.actor === user.name) || null;
        const verbs = await p.evaluate(() => {
          const st = Proto.store; const S = st.get(); const out = {};
          window.__proto.set({ persona: 'frontdesk' });
          out.frontdesk = { entitlements: st.currentUser().entitlements, post: st.postCheckout('a-1047', { decision: 'zero_due', writeoffCents: 5000, writeoffReason: 'courtesy' }) };
          out.frontdesk.row = S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && e.actor === st.currentUser().name).map((e) => ({ id: e.id, amountCents: e.amountCents, actor: e.actor }));
          window.__proto.set({ persona: 'hygienist' });
          out.hygienist = { entitlements: st.currentUser().entitlements, res: st.requestWriteoff('p-306', 2500, 'courtesy') };
          out.hygienist.row = S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && e.actor === st.currentUser().name).map((e) => ({ id: e.id, amountCents: e.amountCents, actor: e.actor }));
          out.balanceAfterAll = st.balances('p-306');
          return out;
        });
        const reproduced = !!user.noPass && user.entitlements.length === 0 && opened && !!tempRow && tempRow.amountCents === -10000 && afterUi.bal.patientDue === before.bal.patientDue - 10000 && !!verbs.frontdesk.post.ok && !verbs.frontdesk.entitlements.includes('write_off') && verbs.frontdesk.row.length === 1;
        rec('S-ledger-4', 'requestWriteoff and the Post write-off branch never check the actor: on the temp Money Desk with no day pass, Post writes a −$100.00 write-off with actor "No day pass issued", and the front desk (entitlements post_payment, schedule) posts a −$50.00 write-off through checkout Post while postCheckout itself refuses the same temp', 'A2 — docs/05 write-off is a guarded channel; store.js:41 NO_PASS comment; store.js:222-231 requestWriteoff and :160 write_off branch have no entitlement or noPass gate (cf. :131)',
          reproduced, { currentUserOnTempMoneyDesk: user, balanceBefore: before.bal, writeOffsBefore: before.writeOffs, writeOffCardOpened: opened, writeOffRowsToday: afterUi.rows, tempRow, balanceAfterTempPost: afterUi.bal, canvasChips: afterUi.canvasChip, refusalOnCanvas: afterUi.refusal, frontdesk: verbs.frontdesk, hygienist: verbs.hygienist, balanceAfterAll: verbs.balanceAfterAll, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-5 · C5/A7 (docs/13 feature 21: Retire is irreversible and "the exception stops applying") · store.js:458
    // reviewDecision('retire') sets dualReleaseThresholdCents = 15000, the raised value of d-1 ("raised from $100 to $150",
    // fromCents 10000, toCents 15000), so retiring the raise leaves the raise in force; dailyclose.js:208 then prints
    // "Retired: write-off threshold back to $150.00". A $120 write-off single-releases after the owner retired the raise.
    // A-seed-2 cannot see this: it requires the in-force number to disagree as well, and that half was fixed.
    // Negative control: once retire restores d.fromCents (10000), thresholdAfterRetire === fromCents, the $120 gate returns
    // needs_second and the line reads "back to $100.00"; then thresholdAfterRetire === decision.fromCents and the check reports false.
    async 'S-ledger-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const before = await p.evaluate(() => { const S = window.__proto.state(); const d = S.decisions.find((x) => x.id === 'd-1'); return { threshold: S.tenant.dualReleaseThresholdCents, decision: { id: d.id, text: d.text, fromCents: d.fromCents, toCents: d.toCents, status: d.status }, gate120: Proto.store.evaluateRelease('write_off', 12000, Proto.store.currentUser()).code }; });
        const seq0 = await lastSeq(p);
        const clicked = await click(p, 'close.decision.d-1.retire'); await p.waitForTimeout(150);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => {
          const S = Proto.store.get(); const d = S.decisions.find((x) => x.id === 'd-1');
          const line = (document.body.innerText.match(/[^\n]*Retired: write-off threshold[^\n]*/) || [null])[0];
          window.__proto.set({ persona: 'biller' });
          const gate = Proto.store.evaluateRelease('write_off', 12000, Proto.store.currentUser());
          const wo = Proto.store.requestWriteoff('p-306', 12000, 'courtesy');
          return { threshold: S.tenant.dualReleaseThresholdCents, decisionStatus: d.status, controlDecisions: S.controlDecisions.map((x) => x.id + ':' + x.action), resultLine: line, gate120AfterRetire: { code: gate.code, ok: gate.ok }, writeOff120: wo, writeOffRow: S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, approvalRequestId: e.approvalRequestId || null })), pendingApprovals: S.approvals.filter((a) => a.status === 'pending').length };
        });
        const reproduced = clicked && afterS.decisionStatus === 'retire' && before.decision.fromCents === 10000 && before.decision.toCents === 15000 && afterS.threshold === before.decision.toCents && afterS.threshold !== before.decision.fromCents && afterS.gate120AfterRetire.ok === true && !!afterS.writeOff120.ok && afterS.writeOffRow.length === 1 && afterS.pendingApprovals === 0;
        rec('S-ledger-5', 'Retire on decision d-1 ("raised from $100 to $150") leaves the threshold at $150.00 — the raised value — so a $120.00 write-off single-releases with no second approver after the owner retired the raise (dailyclose.js:208 words the result as "back to $150.00")', 'C5, A7 — docs/13 feature 21 Retire: the exception stops applying; store.js:458 retire → 15000 instead of d.fromCents; dailyclose.js:208 prints the live value as "back to"',
          reproduced, { thresholdBefore: before.threshold, decision: before.decision, gate120BeforeRetire: before.gate120, retirePressed: clicked, decisionStatusAfter: afterS.decisionStatus, thresholdAfterRetire: afterS.threshold, resultLineOnScreen: afterS.resultLine, controlDecisions: afterS.controlDecisions, gate120AfterRetire: afterS.gate120AfterRetire, requestWriteoff120: afterS.writeOff120, writeOffRowsToday: afterS.writeOffRow, pendingApprovals: afterS.pendingApprovals, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-6 · A2/C5 (docs/13 feature 20: a posting into a closed day is not refused; it posts marked after close, and
    // the closed day never changes; dailyclose.js:265 "Later postings dated today go into tomorrow ... or a marked late
    // posting") · store.js:151-153 postCheckout writes the payment with posted = today and no postedAfterClose regardless
    // of S.dayCloses; store.js:464 closeDay froze totals/deposit for loc-1 today. After Close day, a $44 cash checkout at
    // loc-1 lands in the sealed day: dayClose.totals.cash 0 and the deposit slip 0 while the same filter closeDay used now sums 4400,
    // and "Postings into closed days" (dailyclose.js:73 lateRows) does not list it.
    // Negative control: once postCheckout marks the row postedAfterClose (or routes it to the next open day), the closed
    // day's filter still sums to the frozen totals and lateRows grows by one; then the check reports false.
    async 'S-ledger-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const closed = await p.evaluate(() => { const r = Proto.store.closeDay('loc-1'); return { ok: r.ok, code: r.code || null, dayClose: r.dayClose ? { id: r.dayClose.id, totals: r.dayClose.totals, closedBy: r.dayClose.closedBy } : null, deposits: window.__proto.state().deposits.map((d) => ({ id: d.id, lines: d.lines })) }; });
        await p.evaluate(() => { window.__proto.set({ persona: 'dentist' }); Proto.store.fileNote('enc-9003', { assessment: 'Recall exam', plan: 'Recall' }, true); });
        await hop(p, '#/frontdesk/checkout/a-1044'); await p.waitForTimeout(150);
        const lateBefore = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.postedAfterClose && e.actorKind !== 'worker').map((e) => e.id));
        const seq0 = await lastSeq(p);
        const clickedTender = await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => {
          const S = window.__proto.state(); const today = S.tenant.today;
          const pay = S.ledger.filter((e) => e.kind === 'patient_payment' && e.patientId === 'p-303' && e.posted === today).map((e) => ({ id: e.id, amountCents: e.amountCents, tender: e.tender, posted: e.posted, effective: e.effective, locationId: e.locationId, postedAfterClose: e.postedAfterClose === undefined ? null : e.postedAfterClose, correctsEntryId: e.correctsEntryId || null }));
          const rows = S.ledger.filter((e) => e.locationId === 'loc-1' && e.posted === today && (e.kind === 'patient_payment' || e.kind === 'reversal'));
          const tot = { cash: 0, check: 0, card: 0 };
          for (const e of rows) { if (e.kind === 'reversal') { const o = S.ledger.find((x) => x.id === e.reversesEntryId); if (o && o.tender) tot[o.tender] -= e.amountCents; continue; } tot[e.tender || 'card'] += -e.amountCents; }
          const dc = S.dayCloses.find((d) => d.locationId === 'loc-1' && d.date === today) || null;
          return { payment: pay, frozenTotals: dc ? dc.totals : null, dayCloseId: dc ? dc.id : null, ledgerTotalsNow: tot, deposits: S.deposits.map((d) => ({ id: d.id, lines: d.lines })), lateRows: S.ledger.filter((e) => e.postedAfterClose && e.actorKind !== 'worker').map((e) => e.id), postedCard: ((document.querySelector('.co-posted') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) };
        });
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        const closeScreen = await p.evaluate(() => ({ lateCount: ((document.querySelector('[data-testid="close.late"] .count') || {}).textContent || null), closedLine: [...document.querySelectorAll('#canvas p')].map((e) => e.textContent.trim()).find((t) => /Closed .* deposit slip prepared/.test(t)) || null }));
        const posted = ev.some((e) => e.kind === 'write' && e.table === 'collectionDecisions');
        const reproduced = !!closed.ok && posted && clickedTender && afterS.payment.length === 1 && afterS.payment[0].locationId === 'loc-1' && afterS.payment[0].posted === afterS.payment[0].effective && !afterS.payment[0].postedAfterClose && afterS.frozenTotals !== null && afterS.ledgerTotalsNow.cash !== afterS.frozenTotals.cash && afterS.lateRows.length === lateBefore.length;
        rec('S-ledger-6', 'After Close day for Main Street, a $44.00 cash checkout at the same location posts into the sealed day: posted = effective = today, no postedAfterClose mark, the frozen totals and deposit slip stay at cash $0.00 while the closed day\'s own ledger filter now sums cash $44.00, and "Postings into closed days" does not count it', 'A2, C5 — docs/13 feature 20 sealed closed day with visible corrections; store.js:151-153 postCheckout ignores S.dayCloses; store.js:464 closeDay froze totals the ledger then outgrows; dailyclose.js:73 lateRows needs postedAfterClose',
          reproduced, { closeDay: closed, lateRowsBefore: lateBefore, tenderPressed: clickedTender, postAccepted: posted, paymentWritten: afterS.payment, dayCloseId: afterS.dayCloseId, frozenTotals: afterS.frozenTotals, ledgerTotalsForClosedDayNow: afterS.ledgerTotalsNow, deposits: afterS.deposits, lateRowsAfter: afterS.lateRows, postedCardText: afterS.postedCard, dailyCloseScreen: closeScreen, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-7 · A1/A2 (docs/13 ERA: Confirm accepts a contract delta; a denial goes to Denials for appeal) · store.js:420
    // eraConfirm refuses only status 'posted'; for the denied line el-40 (expected $285, paid $0, CARC 16, claim c-88 denied)
    // it writes a $0 insurance_payment and a −$285 contractual_ppo write-off, hard-codes payer 'Delta Dental' and loc-1, and
    // flips the line to 'posted' so the denial leaves the ERA count while claim c-88 stays denied and appealable.
    // Negative control: once eraConfirm refuses lines that are not deltas (or lines with paidCents 0 / a denial CARC), the
    // call returns ok:false, no ledger rows carry eraLineId el-40 and el-40 stays 'denied'; then the check reports false.
    async 'S-ledger-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const st = Proto.store; const S = st.get(); const out = {};
          const line = S.eraLines.find((l) => l.id === 'el-40');
          out.lineBefore = Object.assign({}, line);
          out.claimBefore = Object.assign({}, S.claims.find((x) => x.id === 'c-88'));
          out.balanceBefore = st.balances(line.patientId);
          out.deniedCountBefore = S.eraLines.filter((l) => l.status === 'denied').length;
          out.confirm = st.eraConfirm('el-40');
          out.rows = S.ledger.filter((e) => e.eraLineId === 'el-40').map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, payer: e.payer || null, locationId: e.locationId, reason: e.reason || null, gl: e.gl || null }));
          out.lineAfter = { status: line.status };
          out.claimAfter = { status: S.claims.find((x) => x.id === 'c-88').status };
          out.deniedCountAfter = S.eraLines.filter((l) => l.status === 'denied').length;
          out.balanceAfter = st.balances(line.patientId);
          out.explainAfter = st.explain(line.patientId).map((x) => x.sentence);
          return out;
        });
        const ev = await after(p, seq0);
        const wo = r.rows.find((x) => x.kind === 'write_off');
        const reproduced = r.lineBefore.status === 'denied' && r.lineBefore.paidCents === 0 && !!r.confirm.ok && r.rows.length === 2 && !!wo && wo.amountCents === -(r.lineBefore.expectedCents - r.lineBefore.paidCents) && wo.reason === 'contractual_ppo' && r.lineAfter.status === 'posted' && r.claimAfter.status === 'denied' && r.balanceAfter.patientDue === r.balanceBefore.patientDue - r.lineBefore.expectedCents;
        rec('S-ledger-7', 'eraConfirm("el-40") on the denied Delta line (expected $285.00, paid $0.00, CARC 16 "missing perio chart") posts a $0.00 insurance payment and a −$285.00 contractual_ppo write-off, drops Patient due by $285.00 and flips the line to posted while claim c-88 remains denied and appealable', 'A1, A2 — docs/13 ERA delta read-back: Confirm is for contract deltas; store.js:420 eraConfirm refuses only status posted and hard-codes payer/location',
          reproduced, { lineBefore: r.lineBefore, claimBefore: { id: r.claimBefore.id, status: r.claimBefore.status, appealBy: r.claimBefore.appealBy }, balanceBefore: r.balanceBefore, confirmResult: r.confirm, ledgerRowsWritten: r.rows, lineStatusAfter: r.lineAfter.status, claimStatusAfter: r.claimAfter.status, deniedLineCount: [r.deniedCountBefore, r.deniedCountAfter], balanceAfter: r.balanceAfter, explainAfter: r.explainAfter, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-8 · A1/A7 (store.js:226 says the write-off "posts the number you type against the balance") · store.js:222-231
    // requestWriteoff accepts any finite positive number: above the open balance and non-integer cents. On p-316 (Patient due
    // $84.00) a $134.00 write-off posts, the ledger nets to −$50.00 and the three numbers read 0/0/0 (allocate() drops the
    // excess); 0.5 and 1e-9 cents post as ledger rows the money() formatter cannot represent.
    // Negative control: once requestWriteoff caps at the open patient balance and requires integer cents, over and fractional
    // return ok:false with no ledger row; then rowsWritten is empty and the check reports false.
    async 'S-ledger-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const st = Proto.store; const S = st.get(); const out = {};
          out.before = st.balances('p-316');
          out.ledgerSumBefore = S.ledger.filter((e) => e.patientId === 'p-316').reduce((s, e) => s + e.amountCents, 0);
          out.over = st.requestWriteoff('p-316', out.before.patientDue + 5000, 'courtesy');
          out.afterOver = st.balances('p-316');
          out.ledgerSumAfterOver = S.ledger.filter((e) => e.patientId === 'p-316').reduce((s, e) => s + e.amountCents, 0);
          out.half = st.requestWriteoff('p-316', 0.5, 'courtesy');
          out.tiny = st.requestWriteoff('p-316', 1e-9, 'courtesy');
          out.rows = S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-316' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, money: Proto.ui.money(e.amountCents), integer: Number.isInteger(e.amountCents) }));
          out.after = st.balances('p-316');
          out.explain = st.explain('p-316').map((x) => x.sentence);
          return out;
        });
        const ev = await after(p, seq0);
        const fractional = r.rows.filter((x) => !x.integer);
        const reproduced = r.before.patientDue > 0 && !!r.over.ok && r.afterOver.patientDue === 0 && r.afterOver.credit === 0 && r.ledgerSumAfterOver < 0 && !!r.half.ok && !!r.tiny.ok && fractional.length === 2;
        rec('S-ledger-8', 'requestWriteoff posts any positive number: on p-316 (Patient due $84.00) a $134.00 write-off posts and the ledger nets to −$50.00 while the three numbers read $0.00/$0.00/$0.00, and 0.5 and 1e-9 cents post as ledger rows', 'A1, A7 — store.js:226 "posts the number you type against the balance"; store.js:222-231 no cap at the open balance and no integer-cents check',
          reproduced, { balanceBefore: r.before, ledgerSumBefore: r.ledgerSumBefore, overBalanceResult: r.over, balanceAfterOver: r.afterOver, ledgerSumAfterOver: r.ledgerSumAfterOver, halfCentResult: r.half, tinyResult: r.tiny, rowsWritten: r.rows, fractionalRows: fractional, balanceAfterAll: r.after, explainAfter: r.explain, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-ledger-v1 (verifier, adjacent to S-ledger-5) · B1/C3 (a control that fires once; a screen computed from state) ·
    // dailyclose.js:207-208 reads `T.dualReleaseThresholdCents` inside the decision button handler and no `T` is in scope,
    // so the first press of Retire (or Tighten) runs reviewDecision (store: d-1.status = retire, controlDecisions dec-2) and
    // then throws ReferenceError before the result line, the aria-live announcement and rerender(). The card keeps its three
    // buttons, so a second press (Tighten) reviews the same decision again: status retire → tighten, threshold 15000 → 10000,
    // a second controlDecisions row, and store.js:449 reviewDecision has no already_decided gate to stop it. Existing checks
    // (A-seed-2, A-screens-dailyclose-1-4) read the result line / health text but never the pageerror or the second review.
    // Negative control: with `T` defined (const T = S.tenant) the press writes the result line, rerender() drops the reviewed card
    // (status !== review_due), no ReferenceError fires and the second press has no button to hit; then the check reports false.
    async 'S-ledger-v1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const snap = () => p.evaluate(() => {
          const S = Proto.store.get(); const d = S.decisions.find((x) => x.id === 'd-1');
          return { status: d.status, reviewBy: d.reviewBy || null, threshold: S.tenant.dualReleaseThresholdCents,
            controlDecisions: S.controlDecisions.map((x) => x.id + ':' + x.action),
            buttons: ['keep', 'tighten', 'retire'].filter((a) => !!document.querySelector('[data-testid="close.decision.d-1.' + a + '"]')),
            reviewedLine: (document.body.innerText.match(/[^\n]*(Retired|Tightened|Kept)[^\n]*threshold[^\n]*|[^\n]*Reviewed today[^\n]*/) || [null])[0] };
        });
        const before = await snap();
        const seq0 = await lastSeq(p);
        const retired = await click(p, 'close.decision.d-1.retire'); await p.waitForTimeout(200);
        const afterRetire = await snap(); const errsAfterRetire = errs.slice();
        const tightened = await click(p, 'close.decision.d-1.tighten'); await p.waitForTimeout(200);
        const afterTighten = await snap();
        const ev = await after(p, seq0);
        const refErr = (list) => list.filter((m) => /T is not defined|ReferenceError/.test(m));
        const reproduced = retired && before.status === 'review_due' && afterRetire.status === 'retire' && refErr(errsAfterRetire).length >= 1
          && afterRetire.buttons.length === 3 && afterRetire.reviewedLine === null
          && tightened && afterTighten.status === 'tighten' && afterTighten.threshold === 10000 && afterTighten.controlDecisions.length === before.controlDecisions.length + 2;
        rec('S-ledger-v1', 'Pressing Retire on decision d-1 throws ReferenceError "T is not defined" (dailyclose.js:208) after the store has already recorded the retire: no result line, no announcement, no rerender, the three buttons stay, and a second press (Tighten) reviews the same decision again — status retire → tighten, threshold $150 → $100, two controlDecisions rows for one card', 'B1, C3, A7 — one decision per review; the screen is a projection of state; dailyclose.js:207-208 `T` undefined; store.js:449 reviewDecision has no already_decided gate',
          reproduced, { before, retirePressed: retired, afterRetire, pageErrorsAfterRetire: errsAfterRetire, tightenPressed: tightened, afterTighten, pageErrors: errs.slice(), writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
