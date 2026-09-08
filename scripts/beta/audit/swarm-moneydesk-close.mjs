// Swarm audit, lens moneydesk-close: prototype/js/screens/moneydesk.js, screens/dailyclose.js and their store verbs.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values it read.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null);
  const brief = (ev) => ev.map((e) => (e.kind === 'write' ? 'w:' + e.table + '/' + e.id : e.kind === 'refusal' ? 'r:' + e.code : e.kind + ':' + (e.testid || e.verb || '')));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => r.dataset.code || null));
  const heldWriteoff = async (p) => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150); };
  const decisionCard = (p) => p.evaluate(() => { const b = document.querySelector('[data-testid^="close.decision.d-1."]'); const card = b ? b.closest('section, .card, article') || b.parentElement : null; return { buttons: [...document.querySelectorAll('[data-testid^="close.decision.d-1."]')].map((e) => e.getAttribute('data-testid')), text: card ? card.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : null }; });

  return {
    // S-1 · A3/B12 · dailyclose.js:207-208 read `T.dualReleaseThresholdCents`; no `T` is in scope, so Tighten and Retire throw
    // ReferenceError after Proto.store.reviewDecision has already written decisions/d-1 and controlDecisions/dec-2. The screen
    // never re-renders or announces: the Keep/Tighten/Retire buttons stay on a decision the store marks decided.
    // Negative control: once the sentence reads the threshold from state (S.tenant), pageErrors is empty, the live region
    // announces "Tightened the write-off threshold", the buttons are gone and the check reports false.
    async 'S-moneydesk-close-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const before = await p.evaluate(() => ({ status: window.__proto.state().decisions.find((d) => d.id === 'd-1').status, controlDecisions: window.__proto.state().controlDecisions.length }));
        const seq0 = await lastSeq(p);
        await click(p, 'close.decision.d-1.tighten'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => ({ status: window.__proto.state().decisions.find((d) => d.id === 'd-1').status, controlDecisions: window.__proto.state().controlDecisions.length, threshold: window.__proto.state().tenant.dualReleaseThresholdCents }));
        const card = await decisionCard(p);
        const announced = await live(p);
        const wrote = ev.some((e) => e.kind === 'write' && e.table === 'decisions' && e.id === 'd-1');
        const crashed = errs.some((m) => /T is not defined/.test(m)) || ev.some((e) => e.kind === 'error');
        const reproduced = wrote && crashed && card.buttons.length > 0;
        rec('S-moneydesk-close-1', 'Tighten on decision d-1 writes decisions/d-1 and controlDecisions then throws "T is not defined" in dailyclose.js:207; the card keeps its Keep/Tighten/Retire buttons and nothing is announced', 'A3,B12 · dailyclose.js:207-208',
          reproduced, { before, after: afterS, pageErrors: errs, announced, buttonsStillRendered: card.buttons, cardText: card.text, events: brief(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // S-2 · A7/docs/13:413 · store.js:458 reviewDecision('retire') sets dualReleaseThresholdCents = 15000 — the raised value d-1 introduced
    // (fromCents 10000 → toCents 15000). "Retired" leaves the temporary raise in force, the very thing docs/13 says cannot quietly become permanent.
    // Negative control: after Retire, tenant.dualReleaseThresholdCents === d-1.fromCents (10000) and the check reports false.
    async 'S-moneydesk-close-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const d = await p.evaluate(() => { const S = window.__proto.state(); const d = S.decisions.find((x) => x.id === 'd-1'); return { id: d.id, kind: d.kind, fromCents: d.fromCents, toCents: d.toCents, status: d.status, thresholdBefore: S.tenant.dualReleaseThresholdCents }; });
        const seq0 = await lastSeq(p);
        const res = await p.evaluate(() => Proto.store.reviewDecision('d-1', 'retire'));
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return { status: S.decisions.find((x) => x.id === 'd-1').status, threshold: S.tenant.dualReleaseThresholdCents, lastControlDecision: S.controlDecisions[S.controlDecisions.length - 1] }; });
        const reproduced = !!res.ok && afterS.status === 'retire' && d.fromCents === 10000 && afterS.threshold === d.toCents;
        rec('S-moneydesk-close-2', 'Retiring d-1 (raise_threshold $100 → $150) leaves tenant.dualReleaseThresholdCents at 15000, the raised amount, so the retired raise stays in force', 'A7 · docs/13:413 · store.js:458',
          reproduced, { decision: d, result: res, after: afterS, pageErrors: errs, events: brief(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // S-3 · A4 · store.js:458 reviewDecision has no already-decided guard: a second review of d-1 flips its status and writes another
    // controlDecisions row without touching the threshold, so the decision row says "keep" while the threshold says "tightened".
    // Negative control: the second call returns { ok:false, code:'already_decided' }, writes nothing, and the check reports false.
    async 'S-moneydesk-close-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const r = await p.evaluate(() => {
          const S = () => window.__proto.state(); const snap = () => ({ status: S().decisions.find((x) => x.id === 'd-1').status, threshold: S().tenant.dualReleaseThresholdCents, controlDecisions: S().controlDecisions.map((x) => x.id + ':' + x.action) });
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const first = Proto.store.reviewDecision('d-1', 'tighten'); const afterFirst = snap();
          const second = Proto.store.reviewDecision('d-1', 'keep'); const afterSecond = snap();
          return { first, afterFirst, second, afterSecond, ev: window.__events.filter((e) => e.seq > seq0) };
        });
        const reproduced = !!r.first.ok && !!r.second.ok && r.afterSecond.status === 'keep' && r.afterSecond.threshold === 10000 && r.afterSecond.controlDecisions.length === r.afterFirst.controlDecisions.length + 1;
        rec('S-moneydesk-close-3', 'After Tighten (threshold 10000) a second reviewDecision("d-1","keep") is accepted: status becomes keep, a third controlDecisions row is written, and the threshold stays 10000', 'A4 · store.js:458',
          reproduced, { first: r.first, afterFirst: r.afterFirst, second: r.second, afterSecond: r.afterSecond, pageErrors: errs, events: brief(r.ev), seqRange: range(r.ev) });
      } finally { await c.close(); }
    },

    // S-4 · A7/C5 · store.js:454 clearVariance sets rr.state = 'tied' without settling rr.bank (matchVariance at :437 does), so the grade
    // tile reads "Tied" and the Hillsboro row is marked cleared while the Card tender row still prints "Gap −$312.40".
    // Negative control: after Clear the Card row reads "Tied" (bank === expected) or the grade stays a non-tied word; the check reports false.
    async 'S-moneydesk-close-4'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        await click(p, 'close.tied.tile'); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        const clicked = await click(p, 'close.variance.v-1.clear'); await p.waitForTimeout(150);
        const ev = await after(p, seq0);
        const S = await state(p);
        const rr = S.reconciliation.find((x) => x.id === 'rr-loc-3'); const v = S.variances.find((x) => x.id === 'v-1');
        const dom = await p.evaluate(() => {
          const rows = [...document.querySelectorAll('[data-testid^="close.tender."]')].map((e) => e.closest('tr, li, .row, div').textContent.replace(/\s+/g, ' ').trim());
          const gapRows = [...document.querySelectorAll('td, span, div')].filter((e) => e.children.length === 0 && /Gap/.test(e.textContent)).map((e) => e.textContent.trim());
          const tile = (document.querySelector('[data-testid="close.tied.tile"]') || {}).textContent || '';
          return { rows, gapRows, tile: tile.replace(/\s+/g, ' ').trim().slice(0, 300), allText: document.getElementById('canvas').textContent.replace(/\s+/g, ' ') };
        });
        const gap = rr ? (rr.bank.card || 0) - (rr.expected.card || 0) : null;
        const reproduced = clicked && !!v && v.status === 'cleared' && !!rr && rr.state === 'tied' && gap !== 0 && /Gap/.test(dom.allText) && /Tied/.test(dom.allText);
        rec('S-moneydesk-close-4', 'Clearing v-1 marks rr-loc-3 tied and clearedBy the owner while rr.bank.card (206845) still differs from rr.expected.card (238085) by −31240, so the screen says Tied and shows Gap −$312.40 in the same view', 'A7,C5 · store.js:441-455',
          reproduced, { variance: v && { id: v.id, status: v.status, amountCents: v.amountCents }, reconciliation: rr && { id: rr.id, state: rr.state, clearedBy: rr.clearedBy || null, expected: rr.expected, bank: rr.bank }, cardGapCents: gap, gapTextOnScreen: dom.gapRows, tile: dom.tile, pageErrors: errs, events: brief(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // S-5 · A2/docs/04 · store.js:126 postCheckout never consults dayCloses: after Close day for Main Street a cash payment posts into today
    // at loc-1 with no postedAfterClose flag and no reversal-and-repost, so the frozen dayClose totals and the ledger disagree and the
    // "Postings into closed days" count does not move.
    // Negative control: the post is refused (day_closed) or lands as a marked late posting (postedAfterClose, close.late count +1); the check reports false.
    async 'S-moneydesk-close-5'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        await click(p, 'close.closeday'); await p.waitForTimeout(100); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(200);
        const closed = await p.evaluate(() => { const S = window.__proto.state(); const dc = S.dayCloses.find((d) => d.locationId === 'loc-1' && d.date === S.tenant.today); return dc ? { id: dc.id, totals: dc.totals } : null; });
        const lateBefore = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.postedAfterClose).length);
        const idsBefore = new Set(await p.evaluate(() => window.__proto.state().ledger.map((e) => e.id)));
        const seq0 = await lastSeq(p);
        await hop(p, '#/frontdesk/checkout/a-1044'); await p.waitForTimeout(150);
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const S = await state(p);
        const newRows = S.ledger.filter((e) => e.kind === 'patient_payment' && e.locationId === 'loc-1' && e.posted === S.tenant.today && !idsBefore.has(e.id)).map((e) => ({ id: e.id, amountCents: e.amountCents, tender: e.tender, posted: e.posted, postedAfterClose: e.postedAfterClose || null }));
        const ledgerToday = { cash: 0, check: 0, card: 0 };
        for (const e of S.ledger.filter((e) => e.locationId === 'loc-1' && e.posted === S.tenant.today && e.kind === 'patient_payment')) ledgerToday[e.tender || 'card'] += -e.amountCents;
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        const lateText = await txt(p, 'close.late');
        const lateAfter = S.ledger.filter((e) => e.postedAfterClose).length;
        const reproduced = !!closed && newRows.length > 0 && newRows.every((r) => !r.postedAfterClose) && ledgerToday.cash !== closed.totals.cash && lateAfter === lateBefore;
        rec('S-moneydesk-close-5', 'After Close day (dc-loc-1-0903 totals frozen) a cash checkout at Main Street posts into today unmarked: dayClose.totals.cash stays 0 while the ledger for today reads the new cash, and "Postings into closed days" stays at its old count', 'A2 · docs/04 · dailyclose.js:265 · store.js:126',
          reproduced, { dayClose: closed, newRows, ledgerTodayLoc1: ledgerToday, lateCountBefore: lateBefore, lateCountAfter: lateAfter, lateLineText: lateText, pageErrors: errs, events: brief(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // S-6 · A4 (double post) · store.js:421-422 eraHold/eraDispute accept a `posted` line and overwrite its status, after which eraConfirm at :420
    // no longer sees `posted` and writes a second insurance_payment + write_off pair for the same ERA line.
    // Negative control: eraDispute/eraHold on a posted line refuse (already_decided) and the ledger keeps exactly one pair for el-14; the check reports false.
    async 'S-moneydesk-close-6'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        await click(p, 'money.era.line.el-14.confirm'); await p.waitForTimeout(150);
        const r = await p.evaluate(() => {
          const S = () => window.__proto.state(); const rows = () => S().ledger.filter((e) => e.eraLineId === 'el-14').map((e) => e.id + ':' + e.kind + ':' + e.amountCents);
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const out = { statusBefore: S().eraLines.find((l) => l.id === 'el-14').status, rowsBefore: rows() };
          out.dispute = Proto.store.eraDispute('el-14'); out.statusAfterDispute = S().eraLines.find((l) => l.id === 'el-14').status;
          out.confirmAgain = Proto.store.eraConfirm('el-14'); out.rowsAfter = rows();
          out.sumInsurance = S().ledger.filter((e) => e.eraLineId === 'el-14' && e.kind === 'insurance_payment').reduce((s, e) => s + e.amountCents, 0);
          out.ev = window.__events.filter((e) => e.seq > seq0);
          return out;
        });
        const reproduced = r.statusBefore === 'posted' && !!r.dispute.ok && !!r.confirmAgain.ok && r.rowsAfter.length === r.rowsBefore.length * 2;
        rec('S-moneydesk-close-6', 'eraDispute on posted line el-14 returns ok and flips it to disputed; eraConfirm then posts it again, so the ledger holds two −$540 insurance payments and two −$50 write-offs for one ERA line', 'A4 · store.js:420-422',
          reproduced, { statusBefore: r.statusBefore, rowsBefore: r.rowsBefore, dispute: r.dispute, statusAfterDispute: r.statusAfterDispute, confirmAgain: r.confirmAgain, rowsAfter: r.rowsAfter, insurancePaidCentsForLine: r.sumInsurance, pageErrors: errs, events: brief(r.ev), seqRange: range(r.ev) });
      } finally { await c.close(); }
    },

    // S-7 · A2 · store.js:420 eraConfirm has no status/denial guard: confirming the denied line el-40 (claim c-88, paid $0) writes a $0
    // insurance_payment and a −$285 contractual write_off while c-88 stays `denied` on the Denials tab.
    // Negative control: eraConfirm('el-40') refuses (a denied line has nothing to post) and no ledger rows carry eraLineId el-40; the check reports false.
    async 'S-moneydesk-close-7'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const r = await p.evaluate(() => {
          const S = () => window.__proto.state(); const line = S().eraLines.find((l) => l.id === 'el-40');
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const out = { line: line && { id: line.id, status: line.status, claimId: line.claimId, paidCents: line.paidCents, billedCents: line.billedCents, allowedCents: line.allowedCents, carc: line.carc }, claimBefore: (S().claims.find((x) => x.id === 'c-88') || {}).status, rowsBefore: S().ledger.filter((e) => e.eraLineId === 'el-40').length };
          out.res = Proto.store.eraConfirm('el-40');
          out.rowsAfter = S().ledger.filter((e) => e.eraLineId === 'el-40').map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, reason: e.reason || null }));
          out.lineStatusAfter = S().eraLines.find((l) => l.id === 'el-40').status; out.claimAfter = (S().claims.find((x) => x.id === 'c-88') || {}).status;
          out.ev = window.__events.filter((e) => e.seq > seq0);
          return out;
        });
        const wo = r.rowsAfter.find((x) => x.kind === 'write_off'); const pay = r.rowsAfter.find((x) => x.kind === 'insurance_payment');
        const reproduced = !!r.line && r.line.paidCents === 0 && !!r.res.ok && !!pay && pay.amountCents === 0 && !!wo && wo.amountCents < 0 && r.claimAfter === 'denied';
        rec('S-moneydesk-close-7', 'eraConfirm("el-40") on the denied $0 line returns ok, marks it posted and writes insurance_payment $0 plus write_off −$285 while claim c-88 remains denied', 'A2 · store.js:420',
          reproduced, { line: r.line, claimBefore: r.claimBefore, result: r.res, rowsWritten: r.rowsAfter, lineStatusAfter: r.lineStatusAfter, claimAfter: r.claimAfter, pageErrors: errs, events: brief(r.ev), seqRange: range(r.ev) });
      } finally { await c.close(); }
    },

    // S-8 · A7/C5 · seed.js:208 eraBatches.era-1.eftCents = 481233 is a literal: the 41 seeded lines pay 2,138,500 cents, so the ERA heading
    // prints "EFT $4,812.33" beside lines whose paid column totals $21,385.00, and no state change can reconcile the two.
    // Negative control: eftCents equals the sum of paidCents over the batch's lines (or is derived at read time) and the check reports false.
    async 'S-moneydesk-close-8'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const r = await p.evaluate(() => {
          const S = window.__proto.state(); const batch = S.eraBatches.find((x) => x.id === 'era-1'); const lines = S.eraLines.filter((l) => l.batchId === 'era-1');
          const sumPaid = lines.reduce((s, l) => s + l.paidCents, 0);
          const text = document.getElementById('canvas').textContent.replace(/\s+/g, ' ');
          const eft = (text.match(/EFT\s*\$[\d,]+\.\d\d/) || [null])[0];
          return { eftCents: batch.eftCents, lines: batch.lines, linesInState: lines.length, sumPaidCents: sumPaid, eftOnScreen: eft, moneyOfEft: Proto.ui.money(batch.eftCents), moneyOfSum: Proto.ui.money(sumPaid) };
        });
        const reproduced = r.eftOnScreen !== null && r.eftOnScreen.replace(/\s+/g, '') === ('EFT' + r.moneyOfEft).replace(/\s+/g, '') && r.eftCents !== r.sumPaidCents;
        rec('S-moneydesk-close-8', 'The ERA heading prints "EFT $4,812.33" from the literal eftCents 481233 while the 41 lines of era-1 sum to $21,385.00 paid — two numbers for one remittance', 'A7,C5 · seed.js:208 · moneydesk.js eraTab heading',
          reproduced, r);
      } finally { await c.close(); }
    },

    // S-9 · B2/CONTRACTS §6 (dual release) · store.js:202-218 decideApproval checks blocked_same_person and stepup but never that the approver
    // holds approve_second (phone.js:55 gates only the button). Any seat — here the front desk and the temp "No day pass issued" — approves a
    // held $410 write-off and the ledger posts it with that name as secondApprover.
    // Negative control: decideApproval by a user without approve_second refuses (entitlement / needs_second), ar-1 stays pending, no write_off posts; the check reports false.
    async 'S-moneydesk-close-9'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await heldWriteoff(p);
        const req = await p.evaluate(() => { const a = window.__proto.state().approvals[0]; return a && { id: a.id, status: a.status, requestedById: a.requestedById, amountCents: a.amountCents, eligible: a.eligible }; });
        await p.evaluate(() => window.__proto.set({ persona: 'frontdesk' })); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = () => window.__proto.state(); const me = Proto.store.currentUser();
          const out = { approver: { id: me.id, name: me.name, role: me.role, entitlements: me.entitlements }, pendingForMe: Proto.store.pendingApprovalsFor().length };
          out.res = Proto.store.decideApproval('ar-1', me.id, 'approved', true);
          const a = S().approvals.find((x) => x.id === 'ar-1'); out.request = { status: a.status, decidedBy: a.decidedBy || null };
          out.writeoffs = S().ledger.filter((e) => e.approvalRequestId === 'ar-1').map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, secondApprover: e.secondApprover || null }));
          out.patientDue306 = Proto.store.balances('p-306').patientDue;
          return out;
        });
        const ev = await after(p, seq0);
        // second measurement: the temp seat with no day pass, by id, from a fresh request
        const temp = await p.evaluate(() => { const S = () => window.__proto.state(); const t = S().users.find((u) => u.role === 'temp') || null; return t && { id: t.id, entitlements: t.entitlements, noPass: !!t.noPass }; });
        const noEnt = !(r.approver.entitlements || []).includes('approve_second');
        const reproduced = !!req && req.status === 'pending' && noEnt && !!r.res.ok && r.request.status === 'approved' && r.writeoffs.some((w) => w.kind === 'write_off' && w.amountCents === -req.amountCents);
        rec('S-moneydesk-close-9', 'The front desk seat (entitlements post_payment, schedule; not on ar-1.eligible) approves the held $410 courtesy write-off via decideApproval: ar-1 becomes approved, decidedBy Priya Raman, and write_off −41000 posts with her as secondApprover', 'B2 · CONTRACTS §6 · store.js:202-218 · phone.js:55',
          reproduced, { request: req, approver: r.approver, pendingApprovalsForApprover: r.pendingForMe, result: r.res, requestAfter: r.request, writeoffsPosted: r.writeoffs, patientDue306After: r.patientDue306, tempSeat: temp, pageErrors: errs, events: brief(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // S-10 · B2 · store.js:222-233 requestWriteoff gates only on amount ≥ threshold (evaluateRelease); moneydesk.js:194 promises that a write-off
    // after a denial with no appeal "routes through dual release at any amount and cannot be posted by the claim's submitter". A $50 write-off on
    // p-321 (denied claim c-88, no appeal packet) posts straight to the ledger with no approval request.
    // Negative control: requestWriteoff on an account with an unappealed denial returns held (denial_suppression / needs_second) and writes approvals, not ledger; the check reports false.
    async 'S-moneydesk-close-10'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const r = await p.evaluate(() => {
          const S = () => window.__proto.state(); const c88 = S().claims.find((x) => x.id === 'c-88');
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const out = { claim: { id: c88.id, status: c88.status, patientId: c88.patientId, submitter: c88.submittedBy || c88.actor || null }, appealPackets: S().appealPackets.filter((k) => k.claimId === 'c-88').length, me: Proto.store.currentUser().id, threshold: S().tenant.dualReleaseThresholdCents };
          out.res = Proto.store.requestWriteoff(c88.patientId, 5000, 'courtesy');
          out.ledgerRows = S().ledger.filter((e) => e.kind === 'write_off' && e.patientId === c88.patientId && e.posted === S().tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, approvalRequestId: e.approvalRequestId || null, secondApprover: e.secondApprover || null }));
          out.approvals = S().approvals.length;
          out.ev = window.__events.filter((e) => e.seq > seq0);
          return out;
        });
        const reproduced = r.claim.status === 'denied' && r.appealPackets === 0 && !!r.res.ok && r.ledgerRows.length === 1 && r.ledgerRows[0].approvalRequestId === null && r.approvals === 0;
        rec('S-moneydesk-close-10', 'requestWriteoff(p-321, 5000, courtesy) posts a −$50 write_off with no approval request on the account whose claim c-88 is denied and unappealed, though the Bill patient refusal says such write-offs route through dual release at any amount', 'B2 · store.js:222-233 · moneydesk.js:194',
          reproduced, { claim: r.claim, appealPacketsForClaim: r.appealPackets, currentUser: r.me, threshold: r.threshold, result: r.res, writeoffRows: r.ledgerRows, approvalsCount: r.approvals, pageErrors: errs, events: brief(r.ev), seqRange: range(r.ev) });
      } finally { await c.close(); }
    },

    // S-11 · A2/A7 · store.js:222-233 requestWriteoff never compares the amount to the account balance, and allocate() at store.js:76 clamps
    // patientDue to 0 and reports credit 0 for the over-write-off, so a −$149.99 write-off on an $84.00 balance posts and the resulting
    // −$65.99 net disappears from every balance surface.
    // Negative control: the write-off is refused (amount above balance) or balances() reports credit 6599; the check reports false.
    async 'S-moneydesk-close-11'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const r = await p.evaluate(() => {
          const S = () => window.__proto.state(); const net = () => S().ledger.filter((e) => e.patientId === 'p-316').reduce((s, e) => s + e.amountCents, 0);
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const out = { before: { balances: Proto.store.balances('p-316'), netCents: net() } };
          out.res = Proto.store.requestWriteoff('p-316', 14999, 'courtesy');
          out.after = { balances: Proto.store.balances('p-316'), netCents: net(), explain: Proto.store.explain('p-316').map((x) => x.sentence) };
          out.ev = window.__events.filter((e) => e.seq > seq0);
          return out;
        });
        const reproduced = r.before.balances.patientDue === 8400 && !!r.res.ok && r.after.netCents < 0 && r.after.balances.patientDue === 0 && r.after.balances.credit === 0;
        rec('S-moneydesk-close-11', 'A $149.99 courtesy write-off on p-316 ($84.00 due) posts; the ledger nets −$65.99 but balances() reports patientDue 0 and credit 0 and Explain says "paid in full"', 'A2,A7 · store.js:222-233 · store.js:76',
          reproduced, { before: r.before, result: r.res, after: r.after, pageErrors: errs, events: brief(r.ev), seqRange: range(r.ev) });
      } finally { await c.close(); }
    },

    // S-12 · A7/C5 · moneydesk.js:240 prints statementsDue.amountCents, a frozen seed figure, and store.js:426 sendStatement has no balance check:
    // after the $84 balance is written off the row still reads "$84.00", Preview says "Nothing left to pay", and Send records a payment disclosure.
    // Negative control: the row amount re-derives from the ledger ($0.00 / "Nothing due") or Send refuses on a zero balance; the check reports false.
    async 'S-moneydesk-close-12'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const wo = await p.evaluate(() => ({ res: Proto.store.requestWriteoff('p-316', 8400, 'courtesy'), balances: Proto.store.balances('p-316') }));
        await click(p, 'money.tab.statements'); await p.waitForTimeout(120);
        const rowAmt = await p.evaluate(() => { const b = document.querySelector('[data-testid="money.statement.sd-1.send"]'); const row = b && b.closest('.md-row'); return row ? (row.querySelector('.amt') || {}).textContent : null; });
        await click(p, 'money.statement.sd-1.preview'); await p.waitForTimeout(120);
        const preview = await p.evaluate(() => ((document.querySelector('[aria-label="Patient-voice preview"] .sentence') || {}).textContent || null));
        const seq0 = await lastSeq(p);
        await click(p, 'money.statement.sd-1.send'); await p.waitForTimeout(150);
        const ev = await after(p, seq0);
        const S = await state(p);
        const sd = S.statementsDue.find((s) => s.id === 'sd-1');
        const disclosures = S.disclosures.filter((d) => d.recordIds && d.recordIds.includes('sd-1')).map((d) => ({ id: d.id, purpose: d.purpose, channel: d.channel }));
        const reproduced = !!wo.res.ok && wo.balances.patientDue === 0 && rowAmt === '$84.00' && /Nothing left to pay/.test(preview || '') && !!sd && sd.sent === true && disclosures.length > 0;
        rec('S-moneydesk-close-12', 'With p-316 written down to $0.00 the Statements row still shows "$84.00", its Preview reads "Nothing left to pay", and Send statement succeeds and writes a payment disclosure for the zero-balance account', 'A7,C5 · moneydesk.js:240-244 · store.js:426',
          reproduced, { writeoff: wo, rowAmountText: rowAmt, previewText: preview, statementAfter: sd, disclosures, announced: await live(p), pageErrors: errs, events: brief(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // S-13 · B10/A3 · moneydesk.js:131 the amount input's blur handler swaps the hint text on an invalid amount, and the Post button beneath moves
    // during the press: mousedown blurs the field, the layout shifts, mouseup lands on nothing. The click is logged without a testid, postWriteoff
    // never runs, no refusal renders and nothing is announced — the press is lost.
    // Negative control: Post keeps its box across the blur, the click carries testid money.writeoff.post and an amount_required refusal renders; the check reports false.
    async 'S-moneydesk-close-13'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        // The press first, with the field still focused so the mousedown performs the blur exactly as a user's would.
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy');
        await fill(p, 'money.writeoff.amount', '1e3');
        const seq0 = await lastSeq(p);
        await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const ev = await after(p, seq0);
        const clickEv = ev.filter((e) => e.kind === 'click').map((e) => e.testid || null);
        const refs = await refusals(p);
        const announced = await live(p);
        // Then the geometry, on a fresh load so the hint swap has not already happened: Post's box before and after the field blurs.
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy');
        await fill(p, 'money.writeoff.amount', '1e3');
        const boxBefore = await box(p, 'money.writeoff.post');
        await p.evaluate(() => document.querySelector('[data-testid="money.writeoff.amount"]').blur()); await p.waitForTimeout(60);
        const boxAfterBlur = await box(p, 'money.writeoff.post');
        const hint = await p.evaluate(() => (document.querySelector('.hint') || {}).textContent || null);
        const moved = !!boxBefore && !!boxAfterBlur && boxBefore.y !== boxAfterBlur.y;
        const reproduced = moved && clickEv.length > 0 && clickEv.every((t) => t !== 'money.writeoff.post') && refs.length === 0 && ev.every((e) => e.kind !== 'refusal');
        rec('S-moneydesk-close-13', 'With "1e3" in the write-off amount, pressing Post moves the button under the pointer (hint text swap on blur): the click is logged with no testid, no amount_required refusal renders and the live region stays empty', 'B10,A3 · moneydesk.js:131',
          reproduced, { postBoxBeforeBlur: boxBefore, postBoxAfterBlur: boxAfterBlur, hintAfterBlur: hint, clickTestids: clickEv, refusalsRendered: refs, announced, pageErrors: errs, events: brief(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // S-14 · B12 (id/hash integrity) · store.js:477 closeDay derives chainHeadHash from S.ledger.length alone and hard-codes the day suffix '-0903';
    // closing Riverbend East and Hillsboro back to back produces two dayCloses rows with the same chain head, so the "chain head" printed on
    // the close card cannot identify which day it seals.
    // Negative control: each dayClose carries a distinct chainHeadHash (hash over the row itself) and the check reports false.
    async 'S-moneydesk-close-14'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const r = await p.evaluate(() => {
          const S = () => window.__proto.state();
          const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const a = Proto.store.closeDay('loc-2'); const b2 = Proto.store.closeDay('loc-3');
          const today = S().dayCloses.filter((d) => d.date === S().tenant.today).map((d) => ({ id: d.id, locationId: d.locationId, chainHeadHash: d.chainHeadHash, closedAt: d.closedAt }));
          return { first: a.ok ? a.dayClose.id : a, second: b2.ok ? b2.dayClose.id : b2, todayCloses: today, ev: window.__events.filter((e) => e.seq > seq0) };
        });
        const hashes = r.todayCloses.map((d) => d.chainHeadHash);
        const reproduced = r.todayCloses.length >= 2 && new Set(hashes).size < hashes.length;
        rec('S-moneydesk-close-14', 'closeDay("loc-2") then closeDay("loc-3") write dc-loc-2-0903 and dc-loc-3-0903 with the identical chainHeadHash, because the hash is a function of ledger length only', 'B12 · store.js:477',
          reproduced, { first: r.first, second: r.second, todayCloses: r.todayCloses, distinctHashes: new Set(hashes).size, pageErrors: errs, events: brief(r.ev), seqRange: range(r.ev) });
      } finally { await c.close(); }
    },
  };
};
