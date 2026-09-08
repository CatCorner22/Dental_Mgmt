// Swarm hunt, lens checkout-screen: prototype/js/screens/checkout.js against store.postCheckout / allocate.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : [seq0, seq0]);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const val = (p, tid) => p.$eval(`[data-testid="${tid}"]`, (e) => e.value).catch(() => null);
  const pressedOf = (p, tid) => p.$eval(`[data-testid="${tid}"]`, (e) => e.getAttribute('aria-pressed')).catch(() => null);
  const mainText = (p) => p.evaluate(() => ((document.querySelector('#canvas') || document.body).innerText || '').replace(/\s+\n/g, '\n'));
  const threeNumbers = (p) => p.evaluate(() => [...document.querySelectorAll('.threenum .n')].map((n) => n.textContent.trim().replace(/\s+/g, ' ')));
  const todayRows = (p, pid) => p.evaluate((pid) => { const S = window.__proto.state(); return S.ledger.filter((e) => e.patientId === pid && e.posted === S.tenant.today).map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, tender: e.tender || null, actor: e.actor })); }, pid);
  const balances = (p, pid) => p.evaluate((pid) => Proto.store.balances(pid), pid);
  // Drives the write-off add → amount → courtesy → card → Post (needs_second) → Request approval sequence on the open checkout.
  const requestWriteoff = async (p, amount) => {
    await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', amount);
    await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.tender.card');
    await click(p, 'checkout.post'); await p.waitForTimeout(150);
    await click(p, 'refusal.control'); await p.waitForTimeout(150);
    return p.evaluate(() => { const a = window.__proto.state().approvals.slice(-1)[0]; return a ? { id: a.id, status: a.status, amountCents: a.amountCents, requestedBy: a.requestedBy } : null; });
  };
  // Approves one request from the owner's phone with the seeded step-up pad (four digits, then Submit).
  const approveOnPhone = async (p, reqId) => {
    await hop(p, '#/owner/phone'); await p.waitForTimeout(200);
    await click(p, 'phone.request.' + reqId + '.approve');
    for (const d of ['1', '2', '3', '4']) await click(p, 'phone.stepup.' + d);
    await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
    return p.evaluate((id) => { const S = window.__proto.state(); const a = S.approvals.find((x) => x.id === id) || {}; return { status: a.status, decidedBy: a.decidedBy, writeoffRows: S.ledger.filter((e) => e.kind === 'write_off' && e.posted === S.tenant.today).map((e) => [e.id, e.amountCents]), balances: Proto.store.balances(a.patientId) }; }, reqId);
  };

  return {
    // S-checkout-screen-1 · A7, C5, docs/13 feature 23 · store.js:59 allocate() applies a payment with take = Math.min(rem, c.open)
    // and drops the remainder, :73 `over` can therefore never be negative, so an overpayment at the window is not a credit
    // anywhere: balances().credit stays 0 and explain() calls every charge "paid in full".
    // Negative control: a compliant allocate carries the unapplied $32.00 as credit (balances.credit 3200, Credit tile "$32.00",
    // an Explain sentence naming the credit); then creditCents === 3200 and the check reports false.
    async 'S-checkout-screen-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        const before = await balances(p, 'p-305');
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '200');
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const rows = await todayRows(p, 'p-305');
        const net = rows.reduce((s, r) => s + r.amountCents, 0);
        const bal = await balances(p, 'p-305');
        const explain = await p.evaluate(() => Proto.store.explain('p-305').map((s) => s.sentence));
        await click(p, 'checkout.explain'); await p.waitForTimeout(100);
        const tiles = await threeNumbers(p);
        const paid = rows.find((r) => r.kind === 'patient_payment');
        const reproduced = !!paid && paid.amountCents === -20000 && net === -3200 && bal.credit === 0 && bal.patientDue === 0
          && explain.every((s) => /paid in full/.test(s)) && !explain.some((s) => /credit/i.test(s)) && tiles.some((t) => /Credit/.test(t) && /\$0\.00/.test(t));
        rec('S-checkout-screen-1', 'A $200.00 cash payment against the $168.00 self-pay visit posts, the ledger nets −$32.00, and the $32.00 overpayment is not a credit anywhere: balances().credit is 0, the Credit tile reads $0.00 and every Explain sentence says "paid in full"',
          'A7, C5, docs/13 feature 23 — the three numbers are sums over ledger rows; store.js:59 allocate() drops the unapplied remainder', reproduced,
          { balancesBefore: before, ledgerRowsToday: rows, ledgerNetCents: net, balancesAfter: bal, creditCents: bal.credit, explainSentences: explain, threeNumbers: tiles, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-checkout-screen-2 · A7, C5 · checkout.js:301 state[aid] keeps amountStr from the first render (fresh(est.patientCents)), :303 only
    // re-reads it when est.patientCents <= 0; a partial write-off approved between two visits to the screen leaves the field at the
    // pre-write-off number while :300 caps the displayed estimate, so Patient due and "est." read $210.00, Amount reads 410.00 and Post
    // collects $410.00 (the lost $200.00 then vanishes through S-checkout-screen-1). A-screens-checkout-1-5 only measures the full $410.
    // Negative control: once the prefill is re-derived from the capped estimate the field reads 210.00 and Post writes −21000; then
    // amountField !== '410.00' and the check reports false.
    async 'S-checkout-screen-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        const req = await requestWriteoff(p, '200');
        const approved = req ? await approveOnPhone(p, req.id) : null;
        await hop(p, '#/frontdesk/checkout/a-1047'); await p.waitForTimeout(200);
        const screen = { threeNumbers: await threeNumbers(p), estFoot: await p.evaluate(() => ((document.querySelector('.co-lines tfoot .co-est') || {}).textContent || '').trim()), amountField: await val(p, 'checkout.amount'), amountHint: await p.evaluate(() => ((document.querySelector('[data-testid="checkout.amount"]').closest('.field') || {}).innerText || '').trim()), postLabel: await txt(p, 'checkout.post'), balances: await balances(p, 'p-306') };
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const rows = await todayRows(p, 'p-306');
        const pay = rows.find((r) => r.kind === 'patient_payment');
        const posted = await p.evaluate(() => ((document.querySelector('.co-posted, [aria-label="Posted"]') || document.querySelector('#canvas')).innerText || '').match(/Payment[^\n]*/)?.[0] || null);
        const precondition = !!approved && approved.status === 'approved' && approved.balances.patientDue === 21000 && screen.balances.patientDue === 21000;
        const reproduced = precondition && /\$210\.00/.test(screen.estFoot) && screen.amountField === '410.00' && screen.postLabel === 'Post' && !!pay && pay.amountCents === -41000;
        rec('S-checkout-screen-2', 'After a $200.00 courtesy write-off on Lena Fischer is approved (Patient due $210.00, "$210.00 est."), Checkout a-1047 still prefills Amount with 410.00 and a live Post collects $410.00 — $200.00 more than the screen says is owed',
          'A7, C5 — a number on screen is computed from state; checkout.js:301-303 keeps the stale prefill unless the estimate reaches zero', reproduced,
          { approvalRequest: req, approvalAfterStepup: approved, screenAfterApproval: screen, paymentWritten: pay || null, ledgerRowsToday: rows, balancesAfterPost: await balances(p, 'p-306'), postedLine: posted, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-checkout-screen-3 · C5, A7 · store.js:159-163 write statementsDue / paymentPlans / collectionDecisions with est.patientCents read
    // straight from S.estimates[aid] (seed literal 41000) while checkout.js:300 shows the estimate capped by what is still owed, so after a
    // partial write-off the screen promises "a statement-due row for $210.00" and the store writes 41000; the posted card then reads
    // "Statement due $410.00" under a Patient due tile of $210.00.
    // Negative control: when postCheckout derives the amount from the open balance the statementsDue row is 21000 and the posted card
    // reads $210.00; then rowCents === 21000 and the check reports false.
    async 'S-checkout-screen-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        const req = await requestWriteoff(p, '200');
        const approved = req ? await approveOnPhone(p, req.id) : null;
        await hop(p, '#/frontdesk/checkout/a-1047'); await p.waitForTimeout(200);
        await click(p, 'checkout.collect.seg.send-statement'); await p.waitForTimeout(100);
        const promise = (await mainText(p)).match(/[^\n]*statement-due row[^\n]*/i)?.[0] || null;
        const tilesBefore = await threeNumbers(p);
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const store = await p.evaluate(() => { const S = window.__proto.state(); const sd = S.statementsDue.filter((x) => x.patientId === 'p-306' && x.created === S.tenant.today); const cd = S.collectionDecisions.filter((d) => d.encounterId === 'enc-9006'); return { statementRows: sd.map((x) => ({ id: x.id, amountCents: x.amountCents, reason: x.reason })), decisions: cd.map((d) => ({ id: d.id, decision: d.decision, patientPortionCents: d.patientPortionCents })), estimateInStore: S.estimates['a-1047'], balances: Proto.store.balances('p-306') }; });
        const postedCard = await p.evaluate(() => ((document.querySelector('#canvas') || {}).innerText || '').match(/Statement due[^\n]*|Collection decision:[^\n]*/g) || []);
        const tilesAfter = await threeNumbers(p);
        const row = store.statementRows[0];
        const precondition = !!approved && approved.status === 'approved' && store.balances.patientDue === 21000;
        const reproduced = precondition && !!promise && /\$210\.00/.test(promise) && !!row && row.amountCents === 41000
          && store.decisions.some((d) => d.patientPortionCents === 41000) && postedCard.some((t) => /Statement due \$410\.00/.test(t)) && tilesAfter.some((t) => /Patient due/.test(t) && /\$210\.00/.test(t));
        rec('S-checkout-screen-3', 'After a $200.00 write-off is approved, Checkout a-1047 promises "a statement-due row for $210.00" but Post writes statementsDue.amountCents 41000 and collectionDecisions.patientPortionCents 41000, and the posted card reads "Statement due $410.00" beside a Patient due tile of $210.00',
          'C5, A7 — one canonical value per fact; store.js:159,163 use the uncapped seed estimate that checkout.js:300 no longer shows', reproduced,
          { approvalRequest: req, approvalAfterStepup: approved, screenPromise: promise, threeNumbersBefore: tilesBefore, storeAfterPost: store, rowCents: row ? row.amountCents : null, postedCardLines: postedCard, threeNumbersAfter: tilesAfter, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-checkout-screen-4 · docs/05 §39, docs/04 §55, A2 · store.js:132 gates on `!form.pin` only: it never compares the PIN with
    // S.users[].pin (shell.js:76 does), never mints a session row, and posts under the persona's default user. 'abc' posts; Dr. Reagan's
    // seeded PIN 2468 posts as Priya Raman.
    // Negative control: a PIN that opens a session refuses 'abc' (pin_no_match or pin_required, no payment row) and posts 2468 with actor
    // Dr. Blake Reagan and a sessions write; then abcPosted is false and the check reports false.
    async 'S-checkout-screen-4'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.pin', 'abc');
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev1 = await after(p, seq0);
        const abc = { rows: await todayRows(p, 'p-305'), refusal: await txt(p, 'refusal.verb'), decidedBy: await p.evaluate(() => (window.__proto.state().collectionDecisions.find((d) => d.encounterId === 'enc-9005') || {}).decidedBy || null), sessions: await p.evaluate(() => window.__proto.state().sessions.length), writes: writes(ev1), seqRange: range(ev1, seq0) };
        // Second context: a real user's PIN on the same shared desk.
        await p.evaluate(() => window.__proto.reset());
        await hop(p, '#/frontdesk/board'); await hop(p, '#/frontdesk/checkout/a-1046?device=shared'); await p.waitForTimeout(200);
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.pin', '2468');
        const seq1 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev2 = await after(p, seq1);
        const reagan = { pinOwner: await p.evaluate(() => (window.__proto.state().users.find((u) => u.pin === '2468') || {}).name || null), rows: await todayRows(p, 'p-305'), decidedBy: await p.evaluate(() => (window.__proto.state().collectionDecisions.find((d) => d.encounterId === 'enc-9005') || {}).decidedBy || null), sessions: await p.evaluate(() => window.__proto.state().sessions.length), writes: writes(ev2), seqRange: range(ev2, seq1) };
        const abcPay = abc.rows.find((r) => r.kind === 'patient_payment'); const rPay = reagan.rows.find((r) => r.kind === 'patient_payment');
        const abcPosted = !!abcPay && abcPay.amountCents === -16800 && abc.refusal === null && abc.sessions === 0;
        const reproduced = abcPosted && !!rPay && rPay.actor === 'Priya Raman' && reagan.pinOwner === 'Dr. Blake Reagan' && reagan.sessions === 0 && !reagan.writes.some((w) => w.startsWith('sessions/'));
        rec('S-checkout-screen-4', 'On a shared desk Checkout accepts any non-empty PIN: "abc" posts a $168.00 payment with no refusal and no sessions row, and Dr. Reagan\'s seeded PIN 2468 posts with actor Priya Raman — the PIN mints no session and identifies nobody',
          'docs/05 §39 (the desk PIN mints the coordinator\'s own session), docs/04 §55 (a credential either opens a session or refuses); store.js:132 checks presence only', reproduced,
          { device: 'shared', pinAbc: abc, abcPosted, pinReagan: reagan, pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-checkout-screen-5 · A3, docs/13 feature 1 · checkout.js:134 hides the self-pay toggle when the typed amount no longer covers the fee
    // (:307 covers()) but :133 leaves p.id in st.selfPay, and :88 posts the set as-is, so a "Paid in full — don't send to insurance" choice
    // survives the amount being lowered and store.js:161 restricts a procedure the patient paid $10.00 toward.
    // Negative control: when hiding the toggle also drops the id (or Post prunes ids whose toggle is hidden) no self_pay_restricted event
    // is written and pr-401.selfPayRestricted stays false; then restricted is false and the check reports false.
    async 'S-checkout-screen-5'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        const hiddenAt44 = await p.$eval('[data-testid="checkout.line.pr-401.selfpay"]', (e) => e.hidden).catch(() => null);
        await fill(p, 'checkout.amount', '300'); await p.waitForTimeout(100);
        const visibleAt300 = await p.$eval('[data-testid="checkout.line.pr-401.selfpay"]', (e) => !e.hidden).catch(() => null);
        await click(p, 'checkout.line.pr-401.selfpay');
        const pressedAt300 = await pressedOf(p, 'checkout.line.pr-401.selfpay');
        await fill(p, 'checkout.amount', '10'); await p.waitForTimeout(100);
        const toggleAt10 = await p.$eval('[data-testid="checkout.line.pr-401.selfpay"]', (e) => ({ hidden: e.hidden, pressed: e.getAttribute('aria-pressed') })).catch(() => null);
        const visibleTogglesAt10 = await p.evaluate(() => [...document.querySelectorAll('[data-testid$=".selfpay"]')].filter((e) => !e.hidden).length);
        await click(p, 'checkout.tender.cash');
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const out = await p.evaluate(() => { const S = window.__proto.state(); const pr = S.procedures.find((x) => x.id === 'pr-401'); return { pr401: { selfPayRestricted: pr.selfPayRestricted, restrictedAt: pr.restrictedAt || null, feeCents: pr.feeCents }, restrictionEvents: S.domainEvents.filter((d) => d.type === 'procedure.self_pay_restricted').map((d) => ({ id: d.id, procedureId: d.procedureId })), paymentRows: S.ledger.filter((e) => e.kind === 'patient_payment' && e.patientId === 'p-303').map((e) => [e.id, e.amountCents]) }; });
        const restricted = out.pr401.selfPayRestricted === true && out.restrictionEvents.some((d) => d.procedureId === 'pr-401');
        const reproduced = hiddenAt44 === true && visibleAt300 === true && pressedAt300 === 'true' && !!toggleAt10 && toggleAt10.hidden === true && visibleTogglesAt10 === 0
          && out.paymentRows.some((r) => r[1] === -1000) && restricted;
        rec('S-checkout-screen-5', 'On Checkout a-1044 the self-pay toggle for the exam is shown at $300.00, pressed, then hidden again when the amount is lowered to $10.00, yet Post writes procedure.self_pay_restricted for pr-401 and sets selfPayRestricted on a procedure the patient paid $10.00 toward',
          'A3, docs/13 feature 1 — the restriction is for a patient who pays in full; checkout.js:134 hides the toggle but :88 posts the stale selection', reproduced,
          { hiddenAt44, visibleAt300, pressedAt300, toggleAt10, visibleTogglesAt10, afterPost: out, restricted, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-checkout-screen-6 · A8, A4 · store.js:154 `amt = form.amountCents || est.patientCents` and :146-165 never validate the form: a NaN
    // amount writes a NaN payment row and NaN balances, decision 'foo' is written as the typed decision, and a selfPay id from another
    // patient's encounter restricts that patient's procedure. requestWriteoff (:227) refuses a bad amount; postCheckout does not.
    // Negative control: a compliant postCheckout refuses each call (ok:false, no ledger/decision/domainEvents write, pr-431 untouched);
    // then none of nanWritten / fooWritten / crossPatientRestricted holds and the check reports false.
    async 'S-checkout-screen-6'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const out = await p.evaluate(() => {
          const run = (form, aid, pid) => {
            Proto.store.reset(); const S = Proto.store.get(); const n0 = window.__proto.events().length;
            let r; try { r = Proto.store.postCheckout(aid, form); } catch (e) { r = { threw: e.message }; }
            const ev = window.__proto.events().slice(n0);
            return { result: r, paymentRows: S.ledger.filter((e) => e.patientId === pid && e.kind === 'patient_payment').map((e) => ({ id: e.id, amountCents: Number.isNaN(e.amountCents) ? 'NaN' : e.amountCents, tender: e.tender })), decision: (S.collectionDecisions.find((d) => d.encounterId === S.appointments.find((a) => a.id === aid).encounterId) || {}).decision || null, status: S.appointments.find((a) => a.id === aid).status, balances: Object.fromEntries(Object.entries(Proto.store.balances(pid)).map(([k, v]) => [k, Number.isNaN(v) ? 'NaN' : v])), pr431Restricted: S.procedures.find((x) => x.id === 'pr-431').selfPayRestricted, pr431Patient: 'p-306', writes: ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id), seqRange: ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null };
          };
          const res = { nanAmount: run({ decision: 'collect', tender: 'bitcoin', amountCents: '12abc' }, 'a-1046', 'p-305'), zeroAmount: run({ decision: 'collect', tender: 'cash', amountCents: 0 }, 'a-1046', 'p-305'), fooDecision: run({ decision: 'foo' }, 'a-1046', 'p-305'), crossPatientSelfPay: run({ decision: 'zero_due', selfPay: ['pr-431'] }, 'a-1046', 'p-305') };
          Proto.store.reset();
          return res;
        });
        const nanWritten = out.nanAmount.result.ok === true && out.nanAmount.paymentRows.some((r) => r.amountCents === 'NaN' && r.tender === 'bitcoin') && out.nanAmount.balances.patientDue === 'NaN';
        const zeroBecameEstimate = out.zeroAmount.result.ok === true && out.zeroAmount.paymentRows.some((r) => r.amountCents === -16800);
        const fooWritten = out.fooDecision.result.ok === true && out.fooDecision.decision === 'foo' && out.fooDecision.status === 'checked_out';
        const crossPatientRestricted = out.crossPatientSelfPay.result.ok === true && out.crossPatientSelfPay.pr431Restricted === true;
        const reproduced = nanWritten && fooWritten && crossPatientRestricted;
        rec('S-checkout-screen-6', 'Proto.store.postCheckout validates nothing on the form: amountCents "12abc" with tender "bitcoin" writes a NaN payment row and balances().patientDue NaN, decision "foo" is written and checks the visit out, amountCents 0 silently becomes the $168.00 estimate, and selfPay ["pr-431"] from Lena Fischer\'s visit restricts her procedure while checking out Samir Haddad',
          'A8, A4 — a store verb refuses bad arguments instead of writing them; store.js:154,159-163 trust form.amountCents, form.decision and form.selfPay', reproduced,
          { ...out, nanWritten, zeroBecameEstimate, fooWritten, crossPatientRestricted, pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-checkout-screen-7 · B9 · checkout.js:17 `state` is keyed by appointment id only, so a draft typed by the front desk (amount, tender,
    // self-pay picks) is what the biller sees when they open the same visit under their own persona in the same session.
    // Negative control: state keyed by (user, appointment) gives the biller a fresh form (amount 44.00, no tender, no self-pay pressed);
    // then billerSeesDraft is false and the check reports false.
    async 'S-checkout-screen-7'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        const fresh = { amount: await val(p, 'checkout.amount'), check: await pressedOf(p, 'checkout.tender.check') };
        await fill(p, 'checkout.amount', '300'); await click(p, 'checkout.line.pr-401.selfpay'); await click(p, 'checkout.tender.check');
        const seq0 = await lastSeq(p);
        await hop(p, '#/biller/checkout/a-1044'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const biller = { persona: await p.evaluate(() => window.__proto.persona), user: await p.evaluate(() => Proto.store.currentUser().name), amount: await val(p, 'checkout.amount'), selfPayPressed: await pressedOf(p, 'checkout.line.pr-401.selfpay'), checkPressed: await pressedOf(p, 'checkout.tender.check') };
        const billerSeesDraft = biller.persona === 'biller' && biller.amount === '300' && biller.selfPayPressed === 'true' && biller.checkPressed === 'true';
        const reproduced = fresh.amount === '44.00' && fresh.check !== 'true' && billerSeesDraft;
        rec('S-checkout-screen-7', 'A checkout draft typed under the front-desk persona (Amount 300, Check, self-pay on the exam) is shown as-is when the biller opens #/biller/checkout/a-1044: the form state is keyed by appointment, not by user',
          'B9 — per-user state is keyed by user id, never global; checkout.js:17 state[aid]', reproduced,
          { frontdeskFresh: fresh, billerScreen: biller, billerSeesDraft, seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // S-checkout-screen-8 · A2, C7 · checkout.js:234 keeps the outage refusal in st.refusalNode and the gated Post only refocuses
    // refusal.control; nothing re-evaluates when the outage clears, so the screen stays Held with "postings are paused" while the store
    // would post (the perio screen had the same shape, RC-36).
    // Negative control: after the outage clears a Post press posts (status checked_out, payment row) or at least the gate re-evaluates;
    // then stuck is false and the check reports false.
    async 'S-checkout-screen-8'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        await click(p, 'checkout.tender.cash');
        await p.evaluate(() => window.__proto.set({ outage: 1 }));
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const gate = { refusal: await txt(p, 'refusal.verb'), post: await txt(p, 'checkout.post'), storeOutage: await p.evaluate(() => Proto.store.get().outage), writes: writes(await after(p, seq0)) };
        await p.evaluate(() => window.__proto.set({ outage: 0 }));
        const seq1 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const ev = await after(p, seq1);
        const afterClear = { storeOutage: await p.evaluate(() => Proto.store.get().outage), refusal: await txt(p, 'refusal.verb'), post: await txt(p, 'checkout.post'), status: await p.evaluate(() => window.__proto.state().appointments.find((a) => a.id === 'a-1046').status), paymentRows: await todayRows(p, 'p-305'), events: ev.map((e) => [e.seq, e.kind, e.testid || e.code || e.table]) };
        const storeWouldPost = await p.evaluate(() => { const r = Proto.store.postCheckout('a-1046', { decision: 'collect', tender: 'cash', amountCents: 16800 }); return r.ok === true; });
        const stuck = gate.refusal === 'Wait for the server — postings are paused' && gate.writes.length === 0 && afterClear.storeOutage === false && afterClear.post === 'Held' && afterClear.refusal === gate.refusal && afterClear.status === 'note_filed' && !ev.some((e) => e.kind === 'write');
        const reproduced = stuck && storeWouldPost;
        rec('S-checkout-screen-8', 'After a Post is refused during an outage and the outage then clears (store outage false, postCheckout would succeed), Checkout a-1046 stays Held with "Wait for the server — postings are paused"; two more Post presses write nothing and the gate never re-evaluates',
          'A2, C7 — a gate re-evaluates when its condition changes; checkout.js:234 gated Post only refocuses refusal.control', reproduced,
          { duringOutage: gate, afterOutageCleared: afterClear, storeWouldPost, seqRange: range(ev, seq1), pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
