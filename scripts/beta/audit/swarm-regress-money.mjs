// Swarm regression hunt after the fix round, lens: money (store.js money verbs, checkout.js, phone.js,
// moneydesk.js, dailyclose.js) on swarm/fix-G4-contract-and-harness-coverage. Sequences and edges the
// existing 294 checks did not drive: shared-desk PIN sessions on a held Post, a checkout write-off request on
// a visit whose charges post at checkout, a credits row for a decision that collected nothing, Match these
// from a seat with no identity, and two store-contract lies in postCheckout.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const sessionsOf = (p) => p.evaluate(() => window.__proto.state().sessions.map((s) => ({ id: s.id, userId: s.userId, actor: s.actor, device: s.device, endedAt: s.endedAt || null })));
  const todayRows = (p, pid) => p.evaluate((pid) => { const S = window.__proto.state(); return S.ledger.filter((e) => e.patientId === pid && e.posted === S.tenant.today).map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, actor: e.actor || null })); }, pid);
  const testids = (p, re) => p.evaluate((src) => { const r = new RegExp(src); return Array.from(document.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid')).filter((t) => r.test(t)); }, re.source);

  return {
    // S-regress-money-1 · A4 (a repeated control must not double-write), CONTRACTS §6 (a refusal writes nothing) · store.js:205
    // postCheckout opens the PIN holder's session (openSession writes sessions/ses-n and ends the prior row) before the
    // write-off dual-release gate (:212-215) and before the seat's own post_payment entitlement (:207). On a shared desk a held
    // Post therefore writes a sessions row per press: three presses of the same Held control leave ses-1..ses-3 with the first
    // two ended, while the refusal still says "Needs a second approver" and no ledger row exists. A hygienist's PIN (1111, no
    // post_payment) likewise gets a sessions row and then "Ask a seat that can post payments".
    // Negative control: openSession runs only once every gate has passed (or is idempotent for an open session of the same
    // seat on the same device); then a held Post leaves sessions.length 0 and repeated presses add nothing, and the check reports false.
    async 'S-regress-money-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/checkout/a-1047?device=shared');
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '180.00'); await click(p, 'checkout.writeoff.reason.contractual_ppo'); await fill(p, 'checkout.pin', '6666');
        const pinOwner = await p.evaluate(() => { const u = window.__proto.state().users.find((x) => x.pin === '6666'); return u ? { id: u.id, name: u.name, entitlements: u.entitlements } : null; });
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const first = { verb: await txt(p, 'refusal.verb'), postLabel: await txt(p, 'checkout.post'), sessions: await sessionsOf(p), ledger: await todayRows(p, 'p-306') };
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const third = { verb: await txt(p, 'refusal.verb'), postLabel: await txt(p, 'checkout.post'), sessions: await sessionsOf(p), ledger: await todayRows(p, 'p-306'), approvals: await p.evaluate(() => window.__proto.state().approvals.filter((a) => a.id.startsWith('ar-')).length) };
        // Second leg: a PIN that names a seat without post_payment.
        await p.evaluate(() => window.__proto.reset());
        await hop(p, '#/frontdesk/board'); await hop(p, '#/frontdesk/checkout/a-1046?device=shared'); await p.waitForTimeout(200);
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.pin', '1111');
        const seq1 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev2 = await after(p, seq1);
        const hyg = { verb: await txt(p, 'refusal.verb'), sessions: await sessionsOf(p), ledger: await todayRows(p, 'p-305'), writes: writes(ev2), seqRange: range(ev2, seq1) };
        const heldWritesSessions = /second approver/i.test(first.verb || '') && first.ledger.length === 0 && first.sessions.length >= 1
          && third.ledger.length === 0 && third.approvals === 0 && third.sessions.length >= 3 && third.sessions.filter((s) => s.endedAt).length >= 2;
        const refusedPinWritesSession = /post payments/i.test(hyg.verb || '') && hyg.ledger.length === 0 && hyg.sessions.length === 1 && hyg.sessions[0].userId === 'u-hy-1';
        const reproduced = heldWritesSessions || refusedPinWritesSession;
        rec('S-regress-money-1', 'On a shared desk a held Post writes a sessions row per press: three presses of Held on Checkout a-1047 (PIN 6666, $180 write-off) leave ses-1..ses-3 with two ended and no ledger row, and a hygienist\'s PIN 1111 writes ses-1 for Bree Lawson before the refusal "Ask a seat that can post payments"',
          'A4, CONTRACTS §6 — a repeated control must not double-write and a refusal writes nothing; store.js:205 openSession runs before the gates at :207 and :212-215', reproduced,
          { pinOwner, afterFirstPress: first, afterThirdPress: third, sessionWritesInRange: writes(ev).filter((w) => w.startsWith('sessions/')), seqRange: range(ev, seq0), heldWritesSessions, hygienistPin: hyg, refusedPinWritesSession, pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-regress-money-2 · A2/C5 (two surfaces disagree on a number; a main-flow control cannot complete) · store.js:312, :260
    // decideApproval reads balances(r.patientId).patientDue as the write-off ceiling and approvalSentence prints it as
    // "still open". For a checkout write-off on a note-filed visit whose charges post at checkout (a-1046, $168.00 patient
    // portion, nothing on the ledger yet) that number is $0.00, so the phone card says "$0.00 still open" beside the
    // checkout's "$168.00 est.", and Approve is refused "Nothing left to write off" while the request stays pending forever.
    // patientPortion (:173-174) already knows the not-yet-charged fees; the approval path ignores them.
    // Negative control: the ceiling adds the visit's uncharged procedure fees (patientDue + notYetCharged for r.appointmentId);
    // then the card reads "$168.00 still open", Approve posts $158.00 and the request is approved; the check reports false.
    async 'S-regress-money-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/checkout/a-1046');
        const before = await p.evaluate(() => ({ bal: Proto.store.balances('p-305'), portion: Proto.store.patientPortion('a-1046').patientCents, ledgerRows: window.__proto.state().ledger.filter((e) => e.patientId === 'p-305').length, estLine: Array.from(document.querySelectorAll('.co-est')).map((e) => e.textContent.trim()) }));
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '10.00'); await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '158.00'); await click(p, 'checkout.writeoff.reason.hardship');
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const held = { verb: await txt(p, 'refusal.verb'), control: await txt(p, 'refusal.control') };
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const req = await p.evaluate(() => (window.__proto.state().approvals.filter((a) => a.id.startsWith('ar-')).map((a) => ({ id: a.id, amountCents: a.amountCents, appointmentId: a.appointmentId, status: a.status })))[0] || null);
        if (!req) { rec('S-regress-money-2', 'Checkout write-off request on a-1046 (charges post at checkout) cannot be approved', 'A2/C5 — store.js:312, :260', false, { before, held, req, pageErrors: errs }); return; }
        await p.evaluate(() => window.__proto.set({ persona: 'owner', device: 'phone' }));
        await hop(p, '#/owner/phone/approvals'); await p.waitForTimeout(300);
        const sentence = await p.evaluate((id) => Proto.store.approvalSentence(window.__proto.state().approvals.find((a) => a.id === id)), req.id);
        const cardText = await p.evaluate((id) => { const el = document.querySelector('[data-testid="phone.request.' + id + '.approve"]'); const card = el && el.closest('.ph-card, .card, section, article'); return ((card || document.body).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500); }, req.id);
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.' + req.id + '.approve'); await p.waitForTimeout(200);
        for (const d of ['2', '4', '6', '8']) await p.keyboard.press(d);
        await p.waitForTimeout(100);
        if (await p.$('[data-testid="phone.stepup.submit"]')) await click(p, 'phone.stepup.submit');
        await p.waitForTimeout(300);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate((id) => { const S = window.__proto.state(); const r = S.approvals.find((a) => a.id === id); return { status: r.status, postedCents: r.postedCents || null, writeoffRows: S.ledger.filter((e) => e.kind === 'write_off' && e.approvalRequestId === id).map((e) => e.id + ':' + e.amountCents), bal: Proto.store.balances('p-305'), portion: Proto.store.patientPortion('a-1046').patientCents }; }, req.id);
        const refusal = { verb: await txt(p, 'refusal.verb'), control: await txt(p, 'refusal.control') };
        const zeroOpenOnCard = /\$0\.00 still open/.test(sentence) && /\$0\.00 still open/.test(cardText);
        const reproduced = before.portion === 16800 && req.amountCents === 15800 && zeroOpenOnCard && /Nothing left to write off/i.test(refusal.verb || '') && afterS.status === 'pending' && afterS.writeoffRows.length === 0 && afterS.portion === 16800;
        rec('S-regress-money-2', 'A $158.00 hardship write-off requested from Checkout a-1046 (patient portion $168.00, charges post at checkout) reaches the owner\'s phone as "$0.00 still open" and Approve is refused "Nothing left to write off": decideApproval and approvalSentence read balances().patientDue, which is $0 until the checkout that is waiting on this very approval posts the charges, so the request can never be approved',
          'A2, C5 — store.js:312 open = balances(r.patientId).patientDue, :260 same in approvalSentence; :173-174 patientPortion adds notYetCharged and the two surfaces disagree', reproduced,
          { before, held, request: req, approvalSentence: sentence, phoneCardText: cardText, approveRefusal: refusal, after: afterS, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-regress-money-3 · A2/C5 (money state wrong; two surfaces disagree) · store.js:240 postCheckout writes the
    // "Checked out unfiled: payment waiting for charges" credits row for every decision on an unfiled visit, sized
    // -(form.amountCents || est.patientCents || 0), whether or not a payment was collected. Send statement on a-1044
    // (decision send_statement, no patient_payment row) writes credits/cr-2 −4400, and Money Desk → Credits lists
    // "Ines Okoro $44.00 credit" (tab count 2) beside a statementsDue row for the same $44.00 the patient still owes.
    // Negative control: the credits row is written only when decision === 'collect' (sized from the payment row);
    // then Send statement writes no credits row, the Credits tab still lists one row (cr-1), and the check reports false.
    async 'S-regress-money-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        const before = await p.evaluate(() => ({ credits: window.__proto.state().credits.map((x) => x.id + ':' + x.patientId + ':' + x.amountCents), noteFiled: !!window.__proto.state().encounters.find((e) => e.id === 'enc-9003').noteFiled }));
        await click(p, 'checkout.collect.seg.send-statement'); await p.waitForTimeout(100);
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return {
          decision: (S.collectionDecisions.slice(-1)[0] || {}).decision || null,
          paymentsToday: S.ledger.filter((e) => e.patientId === 'p-303' && e.kind === 'patient_payment' && e.posted === S.tenant.today).map((e) => e.id + ':' + e.amountCents),
          creditRows: S.credits.filter((x) => x.patientId === 'p-303').map((x) => ({ id: x.id, amountCents: x.amountCents, reason: x.reason, fromLedger: !!x.fromLedger })),
          statementRows: S.statementsDue.filter((s) => s.patientId === 'p-303' && !s.sent).map((s) => s.id + ':' + s.amountCents),
          postedCardText: ((document.querySelector('.co-posted') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) }; });
        await hop(p, '#/biller/money'); await p.waitForTimeout(200); await click(p, 'money.tab.credits'); await p.waitForTimeout(200);
        const creditsTab = { label: await txt(p, 'money.tab.credits'), rows: await p.evaluate(() => Array.from(document.querySelectorAll('.worklist .wrow')).map((r) => r.textContent.replace(/\s+/g, ' ').trim())) };
        const phantom = afterS.creditRows.find((x) => /a-1044/.test(x.reason));
        const shownOnDesk = creditsTab.rows.some((r) => /Ines Okoro/.test(r) && /\$44\.00 credit/.test(r));
        const reproduced = !before.noteFiled && afterS.decision === 'send_statement' && afterS.paymentsToday.length === 0 && !!phantom && phantom.amountCents === -4400 && writes(ev).some((w) => w === 'credits/' + phantom.id) && shownOnDesk;
        rec('S-regress-money-3', 'Send statement on the unfiled a-1044 collects nothing yet writes credits/cr-2 −$44.00 "payment waiting for charges", and Money Desk → Credits lists "Ines Okoro $44.00 credit" while a $44.00 statement row for the same patient says she still owes it',
          'A2, C5 — store.js:240 writes the credits row for every decision on an unfiled visit, sized from est.patientCents when nothing was collected', reproduced,
          { creditsBefore: before.credits, noteFiledBefore: before.noteFiled, decision: afterS.decision, paymentsToday: afterS.paymentsToday, creditRowsAfter: afterS.creditRows, statementRows: afterS.statementRows, postedCardText: afterS.postedCardText, moneyDeskCreditsTab: creditsTab, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-regress-money-4 · docs/05 (reconciliation is a controlled mutation; a temp with no pass is nobody: store.js:46 actorGate)
    // · store.js:628 matchVariance has no actor gate: unlike clearVariance (:638) it never asks who is pressing. Daily Close renders
    // "Match these" to every persona, so a temp with no day pass (currentUser {noPass: true, entitlements: []}) taps it, v-1 flips
    // to matched, rr-loc-3 to tied, and reconciliationMatches/rm-1 is written with actor "No day pass issued".
    // Negative control: matchVariance refuses a no-pass temp (actorGate or noPass check) before touching state; then v-1 stays
    // open, no reconciliationMatches row exists and a refusal renders; the check reports false.
    async 'S-regress-money-4'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/temp/close');
        const me = await p.evaluate(() => { const u = Proto.store.currentUser(); return { id: u.id, name: u.name, role: u.role, noPass: !!u.noPass, entitlements: u.entitlements || [], dayPasses: window.__proto.state().dayPasses.length }; });
        const before = await p.evaluate(() => ({ v1: window.__proto.state().variances.find((v) => v.id === 'v-1').status, rr3: window.__proto.state().reconciliation.find((r) => r.id === 'rr-loc-3').state, matches: window.__proto.state().reconciliationMatches.length }));
        await click(p, 'close.tied.tile'); await p.waitForTimeout(200);
        let ids = await testids(p, /close\.(location|variance)\./);
        if (!ids.includes('close.variance.v-1.match') && ids.includes('close.location.loc-3')) { await click(p, 'close.location.loc-3'); await p.waitForTimeout(150); ids = await testids(p, /close\.variance\./); }
        const offered = ids.includes('close.variance.v-1.match');
        const cardText = await p.evaluate(() => ((document.querySelector('[aria-label="Variance v-1"]') || {}).textContent || '').replace(/\s+/g, ' ').trim());
        const seq0 = await lastSeq(p);
        if (offered) { await click(p, 'close.variance.v-1.match'); await p.waitForTimeout(200); }
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return { v1: S.variances.find((v) => v.id === 'v-1').status, rr3: S.reconciliation.find((r) => r.id === 'rr-loc-3').state, matches: S.reconciliationMatches.map((m) => ({ id: m.id, varianceId: m.varianceId, amountCents: m.amountCents, actor: m.actor })), live: (document.getElementById('live') || {}).textContent || null }; });
        const refusal = await txt(p, 'refusal.verb');
        const reproduced = me.noPass && me.entitlements.length === 0 && offered && before.v1 === 'open' && afterS.v1 === 'matched' && afterS.rr3 === 'tied' && afterS.matches.some((m) => m.varianceId === 'v-1' && m.actor === me.name) && refusal === null;
        rec('S-regress-money-4', 'A temp with no day pass taps "Match these" on Daily Close and ties Hillsboro: v-1 open → matched, rr-loc-3 → tied, reconciliationMatches/rm-1 written with actor "No day pass issued" and no refusal, while clearVariance beside it gates the actor',
          'docs/05 event spine (reconciliation variance matched is a controlled mutation), store.js:46 actorGate (a temp with no pass is nobody) — store.js:628 matchVariance has no actor gate', reproduced,
          { currentUser: me, offeredMatchControl: offered, varianceCardText: cardText, before, after: afterS, refusalAfter: refusal, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-regress-money-5 · A2/A8 (a verb posts the number it was given; boundary input 0) · store.js:190 validates a collect
    // amount with cents() which admits 0 ("at or above zero"), then :226 `form.amountCents || est.patientCents` treats 0 as
    // absent and posts the estimate. postCheckout('a-1046', {decision:'collect', tender:'card', amountCents: 0}) returns ok and
    // writes patient_payment −16800. The screen (checkout.js:80) blocks a typed 0 before the store, so this is the store contract
    // only; it still means the verb's own refusal copy and its posting disagree.
    // Negative control: the store refuses amountCents 0 on collect (amount_required) or posts exactly the amount given (0 is
    // not "absent"); then no −16800 payment row exists for a 0 request and the check reports false.
    async 'S-regress-money-5'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const out = await p.evaluate(() => {
          const S = window.__proto.state();
          const before = S.ledger.filter((e) => e.patientId === 'p-305').length;
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          let res; try { res = Proto.store.postCheckout('a-1046', { decision: 'collect', tender: 'card', amountCents: 0 }); } catch (e) { res = { threw: String(e) }; }
          const S2 = window.__proto.state();
          const rows = S2.ledger.filter((e) => e.patientId === 'p-305').slice(before).map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, tender: e.tender || null }));
          const ev = window.__events.filter((e) => e.seq > seq0);
          return { res, rowsAdded: rows, decision: S2.collectionDecisions.filter((d) => d.encounterId === 'enc-9005').map((d) => d.decision + ':' + d.patientPortionCents), writes: ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id), seqRange: [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0] };
        });
        const pay = out.rowsAdded.find((r) => r.kind === 'patient_payment');
        const reproduced = !!out.res && out.res.ok === true && !!pay && pay.amountCents === -16800;
        rec('S-regress-money-5', 'Proto.store.postCheckout(\'a-1046\', {decision: collect, tender: card, amountCents: 0}) passes the cents() check ("at or above zero") and then posts patient_payment −$168.00 — the estimate, not the amount given — because :226 treats 0 as absent',
          'A2, A8 — store.js:190 admits 0, :226 `form.amountCents || est.patientCents`', reproduced, { requestedAmountCents: 0, result: out.res, rowsAdded: out.rowsAdded, collectionDecisions: out.decision, writes: out.writes, seqRange: out.seqRange, pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-regress-money-6 · A2 (a write-off can only forgive what is owed) · store.js:330-332 requestWriteoff caps the amount at
    // balances().patientDue; the below-threshold write-off inside postCheckout (:212-215, :234-235) has no ceiling. A biller on
    // Checkout a-1044 (unfiled, $0 on the ledger, $44 estimate) adds a $100.00 courtesy write-off with Send statement: Post
    // writes write_off −10000, the store credit becomes $100.00 on a patient who owed nothing, while requestWriteoff('p-303',
    // 10000) refuses "Type an amount within the balance" for the same account and amount.
    // Negative control: postCheckout applies the same ceiling (patientDue + this visit's fees about to post); then Post refuses
    // amount_required, no write_off row is written and the check reports false.
    async 'S-regress-money-6'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/checkout/a-1044');
        const before = await p.evaluate(() => { let direct; try { direct = Proto.store.requestWriteoff('p-303', 10000, 'courtesy'); } catch (e) { direct = { threw: String(e) }; } return { bal: Proto.store.balances('p-303'), portion: Proto.store.patientPortion('a-1044').patientCents, directRequestWriteoff: direct && { ok: direct.ok, code: direct.code || null, verb: direct.verb || null }, ledgerRows: window.__proto.state().ledger.filter((e) => e.patientId === 'p-303').length }; });
        await click(p, 'checkout.collect.seg.send-statement'); await p.waitForTimeout(80);
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '100.00'); await click(p, 'checkout.writeoff.reason.courtesy');
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return { bal: Proto.store.balances('p-303'), writeoffs: S.ledger.filter((e) => e.patientId === 'p-303' && e.kind === 'write_off' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, reason: e.reason || null, actor: e.actor })), ledgerSum: S.ledger.filter((e) => e.patientId === 'p-303').reduce((s, e) => s + e.amountCents, 0), postedCardText: ((document.querySelector('.co-posted') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) }; });
        const refusal = await txt(p, 'refusal.verb');
        const wo = afterS.writeoffs.find((w) => w.amountCents === -10000);
        const reproduced = before.bal.patientDue === 0 && before.directRequestWriteoff && before.directRequestWriteoff.ok === false && !!wo && refusal === null && afterS.bal.credit >= 10000;
        rec('S-regress-money-6', 'A $100.00 courtesy write-off added on Checkout a-1044 (open balance $0.00) posts write_off −$100.00 and leaves the account with a $100.00 credit, while requestWriteoff for the same account and amount refuses "Type an amount within the balance": the checkout write-off has no ceiling',
          'A2 — store.js:330-332 cap the Money Desk write-off at patientDue; postCheckout :212-215 and :234-235 never do', reproduced,
          { before, refusalAfterPost: refusal, writeoffRowsToday: afterS.writeoffs, balanceAfter: afterS.bal, ledgerSumAfter: afterS.ledgerSum, postedCardText: afterS.postedCardText, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-regress-money-7 · C5 (one canonical value per fact; two surfaces disagree on a number) · checkout.js:213 renders
    // "Write-off <heldReq.amountCents> approved by …" and "Already on the ledger", while store.js:314 capped the posting at the
    // balance still open and recorded it in r.postedCents. Two requests on p-306 (checkout a-1047 $180.00, Money Desk $300.00)
    // approved larger-first: ar-2 posts −30000, ar-1 posts −11000 (postedCents 11000), and Checkout a-1047 reads
    // "Write-off $180.00 approved by Dr. Blake Reagan · Already on the ledger" over a ledger row of −$110.00.
    // Negative control: the chip reads the posted amount (postedCents when set), "Write-off $110.00 approved"; the check reports false.
    async 'S-regress-money-7'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/checkout/a-1047');
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '230.00'); await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '180.00'); await click(p, 'checkout.writeoff.reason.contractual_ppo');
        await click(p, 'checkout.post'); await p.waitForTimeout(150); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        const store = await p.evaluate(() => {
          const S = Proto.store;
          const ar1 = (S.get().approvals.find((a) => a.appointmentId === 'a-1047' && a.status === 'pending') || {}).id || null;
          const r2 = S.requestWriteoff('p-306', 30000, 'hardship'); const rq2 = r2.pendingRequest ? S.requestApproval(r2.pendingRequest) : r2;
          window.__proto.set({ persona: 'owner' });
          const d2 = rq2.requestId ? S.decideApproval(rq2.requestId, 'x', 'approved', true) : null;
          const d1 = ar1 ? S.decideApproval(ar1, 'x', 'approved', true) : null;
          window.__proto.set({ persona: 'biller' });
          const st = window.__proto.state();
          return { ar1, rq2, d2, d1, approvals: st.approvals.filter((a) => a.id.startsWith('ar-')).map((a) => ({ id: a.id, amountCents: a.amountCents, postedCents: a.postedCents || null, status: a.status })), writeoffRows: st.ledger.filter((e) => e.kind === 'write_off' && e.approvalRequestId).map((e) => ({ id: e.id, amountCents: e.amountCents, approvalRequestId: e.approvalRequestId })), bal: S.balances('p-306') };
        });
        await hop(p, '#/biller/board'); await hop(p, '#/biller/checkout/a-1047'); await p.waitForTimeout(300);
        const ev = await after(p, seq0);
        const chips = await p.evaluate(() => Array.from(document.querySelectorAll('#canvas .chip')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /rite-off/.test(t)));
        const line = await p.evaluate(() => ((document.querySelector('#canvas') || {}).textContent || '').replace(/\s+/g, ' ').match(/Write-off \$[\d.,]+ approved by[^.]*\.?[^.]*\./) || null);
        const row1 = store.writeoffRows.find((r) => r.approvalRequestId === store.ar1) || null;
        const reproduced = !!store.d1 && store.d1.ok === true && store.d1.postedCents === 11000 && !!row1 && row1.amountCents === -11000 && chips.some((t) => /Write-off \$180\.00 approved/.test(t)) && !chips.some((t) => /\$110\.00/.test(t));
        rec('S-regress-money-7', 'With two write-off requests on p-306 approved larger-first, the a-1047 request posts −$110.00 (postedCents 11000, capped at the open balance) but Checkout a-1047 reads "Write-off $180.00 approved by Dr. Blake Reagan · Already on the ledger": the screen shows the requested amount, the ledger holds the posted one',
          'C5 — checkout.js:213 money(st.heldReq.amountCents); store.js:314 records the capped amount in r.postedCents', reproduced,
          { store, checkoutChips: chips, checkoutLine: line, ledgerRowForCheckoutRequest: row1, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
