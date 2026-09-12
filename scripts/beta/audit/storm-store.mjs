// Audit checks for the beta-storm findings fixed in prototype/js/store.js and prototype/js/seed.js
// (board-checkout, invariants, moneydesk-ledger and owner-controls areas). Default position is NOT
// reproduced: every check measures the breach it claims, carries its preconditions in the evidence, and
// closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const setPersona = (p, persona) => p.evaluate((x) => window.__proto.set({ persona: x }), persona);
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const after = async (p, seq0) => (await events(p)).filter((e) => e.seq > seq0);
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() })));
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const tile = (p, label) => p.evaluate((l) => { const n = [...document.querySelectorAll('.threenum .n')].find((x) => x.querySelector('.l').textContent === l); return n ? n.querySelector('.v').textContent : null; }, label);
  const net = (S, pid) => S.ledger.filter((e) => e.patientId === pid).reduce((s, e) => s + e.amountCents, 0);
  const balances = (p, pid) => p.evaluate((x) => Proto.store.balances(x), pid);
  const postMatched = async (p) => { await go(p, '#/biller/money'); await click(p, 'money.tab.era'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150); };
  const approveOnPhone = async (p, reqId) => { await setPersona(p, 'owner'); await hop(p, '#/owner/board'); await hop(p, '#/phone/approvals'); await click(p, 'phone.request.' + reqId + '.approve'); for (const k of ['2', '4', '6', '8']) await click(p, 'phone.stepup.' + k); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200); };
  const heldWriteoff = async (p, amount) => { await click(p, 'money.writeoff.p-306'); if (amount != null) await fill(p, 'money.writeoff.amount', amount); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); };

  return {
    // board-checkout-1 / invariants-2: allocate() dropped a payment with no open charge to land on, so the $44
    // window payment on a-1044 was on the ledger while Credit read $0.00 on Checkout and balances(). Negative
    // control: the rows net −4400 and credit is 4400.
    async 'A-storm-store-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S = await state(p); const n = net(S, 'p-303'); const bal = await balances(p, 'p-303');
        const creditTile = await tile(p, 'Credit');
        rec('A-storm-store-1', 'The $44.00 window payment on a-1044 is on the ledger (rows net −$44.00) while balances() and the Checkout Credit tile read $0.00', 'docs/13 feature 23 — the three numbers are sums over ledger rows (store.js allocate())',
          n === -4400 && (bal.credit === 0 || creditTile === '$0.00'), { ledgerNet: n, balances: bal, creditTile, paymentRows: S.ledger.filter((e) => e.patientId === 'p-303' && e.kind === 'patient_payment').length });
      } finally { await c.close(); }
    },

    // invariants-1 / moneydesk-ledger-1: on the seed p-312 nets −$31.00 and after Post matched 16 patients carry
    // ERA payments with no charge; balances() returned 0/0/0 for each. Negative control: for every patient whose
    // rows net negative, credit equals −net plus any external credits row, so `violators` is empty.
    async 'A-storm-store-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-312');
        const seed = { net: net(await state(p), 'p-312'), balances: await balances(p, 'p-312'), creditTile: await tile(p, 'Credit') };
        await postMatched(p);
        const violators = await p.evaluate(() => { const S = window.__proto.state(); return S.patients.filter((pt) => { const rows = S.ledger.filter((e) => e.patientId === pt.id); if (!rows.length) return false; const n = rows.reduce((a, e) => a + e.amountCents, 0); const bl = Proto.store.balances(pt.id); const ext = S.credits.filter((cr) => cr.patientId === pt.id && !cr.fromLedger).reduce((a, cr) => a - cr.amountCents, 0); return n < 0 && bl.credit !== -n + ext; }).map((pt) => pt.id); });
        const posted = (await state(p)).eraBatches[0].status;
        rec('A-storm-store-2', 'Accounts whose ledger nets negative (p-312 on the seed; 16 patients after Post matched) read Credit $0.00: allocate() counts only over-applied charges, never a credit with no charge to land on', 'docs/13 feature 23 — balances() is the one allocation pass and cannot disagree with the rows it reads (store.js allocate())',
          posted !== 'review' && (violators.length > 0 || (seed.net < 0 && seed.balances.credit === 0)), { seedP312: seed, batchStatus: posted, violatorsAfterPostMatched: violators });
      } finally { await c.close(); }
    },

    // board-checkout-2: postCheckout wrote the "payment waiting for charges" credits row for every decision on an
    // unfiled visit, so Send statement on a-1044 minted a $44.00 credit with no payment. Negative control: a
    // statement decision writes the statementsDue row and no credits row; no patient_payment exists either way.
    async 'A-storm-store-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.collect.seg.send-statement'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S = await state(p);
        const cr = S.credits.find((x) => x.patientId === 'p-303') || null;
        const pays = S.ledger.filter((e) => e.patientId === 'p-303' && e.kind === 'patient_payment').length;
        const decided = S.collectionDecisions.find((d) => d.encounterId === 'enc-9003') || null;
        rec('A-storm-store-3', 'Send statement on the unfiled visit a-1044 writes a $44.00 "payment waiting for charges" credits row although no payment was posted', 'docs/01 principle 2 — money rows only when money moves (store.js postCheckout)',
          !!decided && decided.decision === 'send_statement' && pays === 0 && !!cr, { decision: decided, creditRow: cr, paymentRows: pays, statements: S.statementsDue.filter((s) => s.patientId === 'p-303').length });
      } finally { await c.close(); }
    },

    // board-checkout-3: explain() called every open charge owed by the patient while balances() put the same
    // charge under Waiting on insurance, so a-1045 read Patient due $0.00 beside "you owe $118.00". Negative
    // control: with $183 pending and $0 due, no sentence says "you owe" or "Your share is".
    async 'A-storm-store-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1045');
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const bal = await balances(p, 'p-304');
        const ex = await p.evaluate(() => Proto.store.explain('p-304'));
        const staff = ex.map((x) => x.sentence).join(' '), voice = ex.map((x) => x.patientVoice).join(' ');
        rec('A-storm-store-4', 'After the $0 checkout of a-1045 posts its charges, Patient due reads $0.00 and Waiting on insurance $183.00 while Explain says "you owe $118.00" and the patient voice "Your share is $118.00 after insurance"', 'docs/13 feature 23 — the three numbers and Explain render the same rows and cannot disagree (store.js explain())',
          bal.patientDue === 0 && bal.insurancePending > 0 && ex.length > 0 && (/you owe \$/.test(staff) || /Your share is \$/.test(voice)), { balances: bal, staff: ex.map((x) => x.sentence), patientVoice: ex.map((x) => x.patientVoice) });
      } finally { await c.close(); }
    },

    // board-checkout-6: on a shared desk postCheckout tested only `!form.pin`, so "9" (no such PIN) posted the
    // visit frozen to Priya with no sessions row, and Dana's 4444 posted as Priya too. Negative control: "9" is
    // refused with pin_no_match and nothing writes; 4444 posts with actor Dana Whitfield and a sessions row.
    async 'A-storm-store-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.pin', '9');
        const n0 = (await state(p)).ledger.length;
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S1 = await state(p); const rows9 = S1.ledger.slice(n0); const ref9 = await refusals(p);
        await go(p, '#/frontdesk/checkout/a-1047?device=shared');
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.pin', '4444');
        const n1 = (await state(p)).ledger.length;
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S2 = await state(p); const rowsDana = S2.ledger.slice(n1);
        const usersWithPin9 = S1.users.filter((u) => u.pin === '9').length;
        rec('A-storm-store-5', 'The shared-desk PIN gate accepts any non-empty value: PIN "9" (no such user) posts a-1046 frozen to Priya Raman with no sessions row, and Dana\'s 4444 posts a-1047 as Priya', 'docs/13 feature 30 — the PIN on Post identifies the poster; CONTRACTS §6 pin_no_match (store.js postCheckout)',
          usersWithPin9 === 0 && ((rows9.length > 0 && rows9.every((e) => e.actor === 'Priya Raman')) || (rowsDana.length > 0 && rowsDana.some((e) => e.actor !== 'Dana Whitfield'))),
          { pin9: { rowsWritten: rows9.map((e) => e.kind + ':' + e.actor), refusals: ref9, sessions: S1.sessions.length, usersWithPin9 }, pin4444: { rowsWritten: rowsDana.map((e) => e.kind + ':' + e.actor), sessions: S2.sessions.map((s) => s.userId), decidedBy: (S2.collectionDecisions.find((d) => d.encounterId === 'enc-9006') || {}).decidedBy || null } });
      } finally { await c.close(); }
    },

    // board-checkout-9 / owner-controls-7: arrive, seat, reverify and pingChair never tested currentUser().noPass,
    // so a temp with no day pass worked the Board frozen to "No day pass issued" and retired the u-temp rail
    // chip for whoever got a pass next. Negative control: each verb refuses (code entitlement), a-1042 stays
    // confirmed, and railState holds no u-temp bucket.
    async 'A-storm-store-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        const me = await p.evaluate(() => Proto.store.currentUser());
        const res = await p.evaluate(() => ({ arrive: Proto.store.arrive('a-1042'), seat: Proto.store.seat('a-1042'), reverify: Proto.store.reverify('a-1042'), ping: Proto.store.pingChair('a-1044') }));
        const S = await state(p);
        const actors = S.appointmentEvents.map((e) => e.actor);
        const rail = await p.evaluate(() => (Proto.store.get().railState || {})['u-temp'] || null);
        rec('A-storm-store-6', 'A temp with no day pass can Arrive, Seat, Re-verify and Ping from the Board; each record is frozen to the placeholder "No day pass issued" and the u-temp first-run chip retires before any pass exists', 'docs/13 feature 27 — the pass is the identity; docs/01 principle 8 frozen attribution (store.js arrive/seat/reverify/pingChair, retireChip)',
          !!me.noPass && Object.values(res).some((r) => r.ok) && (actors.includes('No day pass issued') || !!rail), { currentUser: me, results: Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.ok ? 'ok' : r.code])), a1042Status: S.appointments.find((a) => a.id === 'a-1042').status, actors, eligibilityChecks: S.eligibilityChecks.length, messages: S.messages.length, railStateTemp: rail });
      } finally { await c.close(); }
    },

    // board-checkout-10: postCheckout allocated the payment only over the charges written in the same call, so the
    // $410 payment on a-1047 (crown already on the ledger) wrote no allocations row. Negative control: one
    // allocation of 41000 against the crown charge.
    async 'A-storm-store-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        const openBefore = await p.evaluate(() => Proto.store.allocate('p-306').charges.map((x) => ({ id: x.row.id, open: x.open })));
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S = await state(p);
        const pay = S.ledger.find((e) => e.kind === 'patient_payment' && e.patientId === 'p-306') || null;
        rec('A-storm-store-7', 'Collecting $410 on a-1047, whose crown charge is already on the ledger, writes the payment with no allocations row', 'docs/01 principle 9 — explicit allocation rows between payments and charges; allocation defaults oldest-open (store.js postCheckout)',
          !!pay && pay.amountCents === -41000 && openBefore.some((x) => x.open > 0) && S.allocations.length === 0, { openChargesBefore: openBefore, payment: pay && pay.id, allocations: S.allocations });
      } finally { await c.close(); }
    },

    // board-checkout-11: only Collect was guarded at $0, so Send statement on a-1045 wrote a statementsDue row for
    // $0.00 and Payment plan a $0.00 plan. The rule is the store's, so the store verb is driven directly (the
    // screen may no longer offer the segments). Negative control: both refuse with zero_collect_refused, no row.
    async 'A-storm-store-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1045');
        const est = await p.evaluate(() => (window.__proto.state().estimates['a-1045'] || {}).patientCents);
        const stmt = await p.evaluate(() => Proto.store.postCheckout('a-1045', { decision: 'send_statement', tender: null, amountCents: 0, selfPay: [], writeoffCents: 0, cadence: 'monthly', pin: null }));
        await go(p, '#/frontdesk/checkout/a-1045');
        const plan = await p.evaluate(() => Proto.store.postCheckout('a-1045', { decision: 'payment_plan', tender: null, amountCents: 0, selfPay: [], writeoffCents: 0, cadence: 'monthly', pin: null }));
        const S = await state(p); const sd = S.statementsDue.filter((s) => s.patientId === 'p-304'); const pp = S.paymentPlans.filter((s) => s.patientId === 'p-304');
        rec('A-storm-store-8', 'On a-1045 ($0 patient portion) Post writes a statementsDue row for $0.00 or a paymentPlans row for $0.00 while the store refuses Collect at $0', 'docs/13 feature 1 — at $0 the typed decision is Nothing due today; money never posts for nothing (store.js postCheckout)',
          est === 0 && (stmt.ok === true || plan.ok === true || sd.some((s) => s.amountCents === 0) || pp.some((s) => s.amountCents === 0)), { estimatePatientCents: est, sendStatement: stmt.ok ? 'ok' : stmt.code, paymentPlan: plan.ok ? 'ok' : plan.code, statements: sd, plans: pp });
      } finally { await c.close(); }
    },

    // board-checkout-12: the decision row froze S.estimates' $410 after the approved write-off had taken the
    // balance to zero, so the Posted card read "Nothing due today, patient portion $410.00". Negative control:
    // with the ledger at zero the decision row carries patientPortionCents 0.
    async 'A-storm-store-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '410'); await click(p, 'checkout.writeoff.reason.courtesy');
        await click(p, 'checkout.post'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const reqId = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).id || null);
        if (reqId) await approveOnPhone(p, reqId);
        await setPersona(p, 'frontdesk'); await hop(p, '#/frontdesk/checkout/a-1047'); await p.waitForTimeout(150);
        const due = (await balances(p, 'p-306')).patientDue;
        const foot = await p.evaluate(() => { const e = document.querySelector('tfoot .co-est'); return e ? e.textContent.trim() : null; });
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const cd = (await state(p)).collectionDecisions.find((x) => x.encounterId === 'enc-9006') || null;
        rec('A-storm-store-9', 'After the $410 write-off on a-1047 is approved, Checkout foots $0.00 and pre-selects Nothing due today, but the decision row records patientPortionCents 41000', 'docs/13 feature 1 — the decision row records the portion the window decided on; one canonical view per fact (store.js postCheckout)',
          !!reqId && due === 0 && !!cd && cd.patientPortionCents !== 0, { requestId: reqId, patientDueAfterApproval: due, footer: foot, decision: cd });
      } finally { await c.close(); }
    },

    // board-checkout-16: the Filed-later visit a-1050 was seeded with a credits row and an allocation intent naming
    // payment le-window-9010, but no ledger row: $95.00 credit on an account with zero rows. Negative control:
    // the intent's payment is a ledger row and the credit is derived from it.
    async 'A-storm-store-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/ledger/p-307');
        const S = await state(p);
        const rows = S.ledger.filter((e) => e.patientId === 'p-307');
        const intent = S.allocationIntents.find((x) => x.encounterId === 'enc-9010') || null;
        const paymentExists = !!intent && S.ledger.some((e) => e.id === intent.paymentId);
        const bal = await balances(p, 'p-307');
        rec('A-storm-store-10', 'The seeded Filed-later visit a-1050 shows a $95.00 credit while p-307 has no ledger rows and intent ai-0 names a payment no table holds', 'docs/01 principle 2 — balances are sums over append-only ledger entries (seed.js credits, store.js reset() allocationIntents)',
          bal.credit > 0 && (rows.length === 0 || !paymentExists), { ledgerRows: rows.map((e) => e.id + ':' + e.kind + ':' + e.amountCents), intent, paymentExists, balances: bal, creditTile: await tile(p, 'Credit') });
      } finally { await c.close(); }
    },

    // board-checkout-17 / moneydesk-ledger-17: the needs_second verb interpolated two approver names and ran to
    // nine tokens, while the request row and the Held chip carried three. Negative control: the verb is at most
    // eight tokens and the names it carries are exactly the request row's eligible list.
    async 'A-storm-store-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await heldWriteoff(p);
        const ev = (await events(p)).filter((e) => e.kind === 'refusal' && e.code === 'needs_second');
        const verb = ev.length ? ev[ev.length - 1].verb : null;
        const eligible = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).eligible || null);
        const chip = await p.evaluate(() => ([...document.querySelectorAll('#canvas .small.muted')].map((e) => e.textContent.trim()).find((t) => /will see it on their phone/.test(t)) || null));
        const tokens = verb ? verb.split(/\s+/).length : 0;
        const namesInVerb = eligible ? eligible.filter((n) => verb && verb.includes(n)) : [];
        rec('A-storm-store-11', 'The needs_second verb reads "Needs a second approver — Dana or Dr. Reagan" (nine tokens) while the request row and the Held chip name three approvers', 'CONTRACTS §6 — at most eight words, no list that can push it past eight; one canonical approver list (store.js evaluateRelease)',
          !!verb && !!eligible && (tokens > 8 || namesInVerb.length !== eligible.length), { verb, tokens, storedEligible: eligible, namesInVerb, heldChip: chip });
      } finally { await c.close(); }
    },

    // invariants-5: eraConfirm wrote a contractual write_off without evaluateRelease, so after hours it posted
    // while a $20 courtesy write-off was held. Negative control: with afterHours set, Confirm refuses with
    // after_hours and writes no write_off row.
    async 'A-storm-store-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money?afterHours=1');
        await click(p, 'money.tab.era'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        const clock = (await state(p)).clock; const n0 = (await state(p)).ledger.length;
        const res = await p.evaluate(() => Proto.store.eraConfirm('el-14'));
        const S = await state(p); const wo = S.ledger.slice(n0).filter((e) => e.kind === 'write_off');
        rec('A-storm-store-12', 'With clock.afterHours true, Confirm on ERA delta line el-14 writes a −$50.00 write_off straight to the ledger with no after_hours refusal', 'CONTRACTS §6 after_hours — write-offs outside business hours are held regardless of amount (store.js eraConfirm)',
          clock.afterHours === true && wo.length > 0, { clock, result: res.ok ? 'ok' : res.code, newWriteOffs: wo.map((e) => e.id + ':' + e.amountCents), lineStatus: S.eraLines.find((l) => l.id === 'el-14').status });
      } finally { await c.close(); }
    },

    // invariants-8: reviewDecision moved tenant.dualReleaseThresholdCents with no event for the tenant row.
    // Negative control: a write event names table tenant in the same seq range.
    async 'A-storm-store-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const seq0 = await lastSeq(p); const t0 = (await state(p)).tenant.dualReleaseThresholdCents;
        await click(p, 'close.decision.d-1.tighten'); await p.waitForTimeout(150);
        const t1 = (await state(p)).tenant.dualReleaseThresholdCents;
        const writes = (await after(p, seq0)).filter((e) => e.kind === 'write').map((e) => e.table + ':' + e.id);
        rec('A-storm-store-13', 'Tighten on d-1 moves tenant.dualReleaseThresholdCents from 15000 to 10000 with write events only for decisions and controlDecisions: nothing names the tenant row whose money gate moved', 'CONTRACTS §5 — every in-place edit is logged with its table and id (store.js reviewDecision)',
          t0 !== t1 && !writes.some((w) => w.startsWith('tenant:')), { before: t0, after: t1, writes });
      } finally { await c.close(); }
    },

    // invariants-14: sendStatement never re-read the balance, so after Post matched settled p-316 the $84.00
    // seed row still sent (and wrote a disclosure). Negative control: Send refuses with zero_collect_refused.
    async 'A-storm-store-14'(b) {
      const { c, p } = await ctx(b);
      try {
        await postMatched(p);
        const due = (await balances(p, 'p-316')).patientDue;
        const seq0 = await lastSeq(p);
        const res = await p.evaluate(() => Proto.store.sendStatement('sd-1'));
        const S = await state(p);
        const sent = !!(S.statementsDue.find((s) => s.id === 'sd-1') || {}).sent;
        const writes = (await after(p, seq0)).filter((e) => e.kind === 'write').map((e) => e.table + ':' + e.id);
        rec('A-storm-store-14', 'After Post matched settles p-316 to Patient due $0.00, sending sd-1 still marks it sent and writes a disclosures row with no zero_collect_refused', 'CONTRACTS §6 zero_collect_refused — a statement never goes out on a balance the patient does not owe (store.js sendStatement)',
          due === 0 && (sent || res.ok), { patientDue: due, result: res.ok ? 'ok' : res.code, sent, writes });
      } finally { await c.close(); }
    },

    // moneydesk-ledger-2: requestWriteoff checked only "above zero", so $1,000 against the $410 balance raised
    // a request, was approved and left a −$590 net the three numbers hid. Negative control: the request refuses
    // with amount_required and no approvals row is written.
    async 'A-storm-store-15'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const due = (await balances(p, 'p-306')).patientDue;
        await heldWriteoff(p, '1000');
        const S = await state(p);
        const req = S.approvals[0] || null;
        rec('A-storm-store-15', 'The p-306 write-off accepts $1,000.00 against a $410.00 balance: an approvals row for 100000 is written and, once approved, the ledger nets −$590.00', 'docs/01 principle 9 — a posting is only what the record supports (store.js requestWriteoff)',
          due === 41000 && !!req && req.amountCents === 100000, { patientDueBefore: due, request: req && { id: req.id, amountCents: req.amountCents, status: req.status }, refusals: await refusals(p) });
      } finally { await c.close(); }
    },

    // moneydesk-ledger-15: explain() labelled every write_off "contractual write-off", hardship and courtesy
    // included. Negative control: a hardship write-off reads "hardship write-off $100.00 (hardship)".
    async 'A-storm-store-16'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '100'); await click(p, 'money.writeoff.reason.hardship'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const S = await state(p);
        const wo = S.ledger.find((e) => e.patientId === 'p-306' && e.kind === 'write_off' && e.reason === 'hardship') || null;
        const ex = await p.evaluate(() => Proto.store.explain('p-306').map((x) => x.sentence).join(' '));
        rec('A-storm-store-16', 'Explain labels a $100 hardship write-off "contractual write-off $100.00 (hardship)"', 'docs/13 feature 23 — one explanation template per reason code; a contractual write-off is a different thing from a discretionary one (store.js explain())',
          !!wo && /contractual write-off \$100\.00 \(hardship\)/.test(ex), { writeOffRow: wo && wo.id, explain: ex });
      } finally { await c.close(); }
    },

    // moneydesk-ledger-16: after every delta line was decided the screen said "Batch complete" while
    // eraBatches[0].status stayed "deltas". Negative control: the batch status is posted.
    async 'A-storm-store-17'(b) {
      const { c, p } = await ctx(b);
      try {
        await postMatched(p);
        for (const l of ['el-14', 'el-22', 'el-31']) { await click(p, 'money.era.line.' + l + '.confirm'); await p.waitForTimeout(100); }
        const S = await state(p);
        const deltas = S.eraLines.filter((l) => l.batchId === 'era-1' && l.status === 'delta').length;
        rec('A-storm-store-17', 'After every delta line is decided the ERA card shows "Batch complete" while eraBatches[0].status stays "deltas" forever', 'docs/04 — the word on screen and the status in the record agree (store.js eraConfirm/eraHold/eraDispute)',
          deltas === 0 && S.eraBatches[0].status === 'deltas', { deltaLinesLeft: deltas, batchStatus: S.eraBatches[0].status });
      } finally { await c.close(); }
    },

    // owner-controls-1: Retire on d-1 set the threshold to 15000, the raised value the decision describes, so a
    // $120 courtesy write-off then posted with no second approver. Negative control: Retire restores fromCents
    // (10000) and the $120 write-off is held.
    async 'A-storm-store-18'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const d0 = (await state(p)).decisions.find((d) => d.id === 'd-1');
        await click(p, 'close.decision.d-1.retire'); await p.waitForTimeout(150);
        const S = await state(p);
        const res = await p.evaluate(() => { const P = window.__proto, prev = P.persona; P.persona = 'biller'; try { return Proto.store.requestWriteoff('p-306', 12000, 'courtesy'); } finally { P.persona = prev; } });
        rec('A-storm-store-18', 'Retire on decision d-1 leaves the threshold at the raised $150.00, and a $120 courtesy write-off requested by the biller afterwards posts with no second approver', 'docs/13 feature 21 — Retire ends the exception; a temporary raise cannot quietly become permanent (store.js reviewDecision)',
          d0.fromCents === 10000 && S.decisions.find((d) => d.id === 'd-1').status === 'retire' && (S.tenant.dualReleaseThresholdCents !== d0.fromCents || res.ok === true), { decisionBefore: { fromCents: d0.fromCents, toCents: d0.toCents }, thresholdAfterRetire: S.tenant.dualReleaseThresholdCents, billerWriteoff12000: res.ok ? 'ok' : res.code });
      } finally { await c.close(); }
    },

    // owner-controls-2: clearVariance set the reconciliation row to "tied" while the bank figure still differed
    // from the expected total. Negative control: after Clear the row is not tied and the gap is on record.
    async 'A-storm-store-19'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const res = await p.evaluate(() => Proto.store.clearVariance('v-1'));
        const S = await state(p);
        const rr = S.reconciliation.find((x) => x.id === 'rr-loc-3');
        const gap = (rr.bank.card || 0) - (rr.expected.card || 0);
        rec('A-storm-store-19', 'Clear with reason on v-1 sets rr-loc-3 to state "tied" while its Card tender still reads Expected $2,380.85 / Bank $2,068.45 (gap −$312.40)', 'docs/13 feature 18 — Tied · independent only when every deposit line matched a bank row; Tied is never self-asserted (store.js clearVariance)',
          res.ok === true && gap !== 0 && rr.state === 'tied', { result: res.ok ? 'ok' : res.code, varianceStatus: S.variances[0].status, reconciliationState: rr.state, cardGapCents: gap, clearedGap: rr.clearedGap || null });
      } finally { await c.close(); }
    },

    // owner-controls-6: addDayPass had no entitlement test, so a temp with no pass (and the front desk) issued a
    // pass carrying Refund and recorded the SoD decision "by: No day pass issued". Negative control: both refuse
    // with code entitlement and no dayPasses row is written.
    async 'A-storm-store-20'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/roles');
        const me = await p.evaluate(() => Proto.store.currentUser());
        const asTemp = await p.evaluate(() => Proto.store.addDayPass({ name: 'Nobody Special', role: 'frontdesk', location: 'loc-1', end: '17:00', extra: ['refund'] }, 'accept_residual'));
        await setPersona(p, 'frontdesk'); await hop(p, '#/frontdesk/roles');
        const asFrontdesk = await p.evaluate(() => Proto.store.addDayPass({ name: 'Sam Lee', role: 'frontdesk', location: 'loc-1', end: '17:00', extra: [] }, null));
        const S = await state(p);
        rec('A-storm-store-20', 'A temp with no day pass, and the front desk without grant_roles, issue a day pass carrying Refund: dayPasses.createdBy reads "No day pass issued" and the critical SoD decision is recorded by it', 'docs/13 feature 27 — grants are entitlement-gated; the office manager provisions the pass (store.js addDayPass)',
          !!me.noPass && (asTemp.ok === true || asFrontdesk.ok === true), { currentUserOnTemp: me, asTemp: asTemp.ok ? 'ok' : asTemp.code, asFrontdesk: asFrontdesk.ok ? 'ok' : asFrontdesk.code, dayPasses: S.dayPasses.map((d) => ({ createdBy: d.createdBy, entitlements: d.entitlements })), controlDecisionsBy: S.controlDecisions.map((d) => d.by) });
      } finally { await c.close(); }
    },
  };
};
