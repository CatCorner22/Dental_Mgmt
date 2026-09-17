// Swarm 2, lens "store-rewrites": defects left behind (or re-exposed) by the store rewrites between 2a5ea39 and
// f4032b3, found by driving Proto.store.* directly and through the screens and measuring the rows, events and
// balances that moved. Files: prototype/js/store.js (decideApproval, chartPaint, postCheckout/writeoffCap).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, click, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const set = (p, o) => p.evaluate((o) => window.__proto.set(o), o);
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const writesAfter = (p, seq) => p.evaluate((seq) => window.__events.filter((e) => e.seq > seq && e.kind === 'write').map((e) => e.seq + ' ' + e.table + '/' + e.id), seq);
  const gate = (p) => p.evaluate(() => { const r = [...document.querySelectorAll('.refusal')].filter((x) => x.offsetParent !== null)[0]; return r ? { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() } : null; });

  return {
    // store.js decideApproval(): the approver is whoever the argument names (`user(approverId) || currentUser()`) and
    // no approve_second check exists; the PIN step-up PR #54 added only runs for 'approved', so a rejection needs no
    // credential at all. S-controls-4 stopped measuring this: it passes stepup=true without a PIN and now reads the
    // needsStepup refusal as "fixed". Leg A: Bree Lawson (entitlements []) approves the $410 request with her own PIN
    // and -$410 posts with secondApprover "Bree Lawson". Leg B: from the requesting biller's own session, passing
    // 'u-dr-1' with no PIN records the request as rejected by Dr. Blake Reagan. Negative control: leg A refuses on
    // entitlement (no approvalsLog or ledger row), leg B refuses (blocked_same_person / pin_required) and decidedBy
    // stays empty, so the check reports false.
    async 'S2-store-rewrites-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const st = window.Proto.store; const live = st.get();
          const pick = (a) => a && { id: a.id, status: a.status, amountCents: a.amountCents, requestedBy: a.requestedBy, requestedById: a.requestedById, decidedBy: a.decidedBy || null, postedCents: a.postedCents || null };
          // Leg B first, while the $410 balance still stands: the requester rejects his own $200 request as Dr. Reagan, no PIN.
          const sam = st.currentUser();
          const req2 = st.requestWriteoff('p-306', 20000, 'courtesy', {});
          const legB = st.decideApproval(req2.requestId, 'u-dr-1', 'rejected', {}, 'not today');
          const rowB = live.approvals.find((a) => a.id === req2.requestId) || null;
          // Leg A: the hygienist, from her own persona, approves the $410 request with her own PIN.
          const req = st.requestWriteoff('p-306', 41000, 'courtesy', {});
          const reqRow = live.approvals.find((a) => a.id === req.requestId) || null;
          window.__proto.set({ persona: 'hygienist' });
          const bree = st.currentUser();
          const legA = st.decideApproval(req.requestId, 'u-hy-1', 'approved', { pin: '1111' });
          const rowA = live.approvals.find((a) => a.id === req.requestId) || null;
          const woA = live.ledger.filter((e) => e.patientId === 'p-306' && e.kind === 'write_off').map((e) => ({ id: e.id, amountCents: e.amountCents, actor: e.actor, secondApprover: e.secondApprover || null, approvalRequestId: e.approvalRequestId || null }));
          const balA = st.balances('p-306');
          return {
            request: { code: req.code, requestId: req.requestId, row: pick(reqRow) },
            legA: { actor: { id: bree.id, name: bree.name, entitlements: bree.entitlements }, result: legA, row: pick(rowA), writeOffs: woA, balance: balA },
            legB: { actor: { id: sam.id, name: sam.name }, request: { code: req2.code, requestId: req2.requestId }, result: legB, row: pick(rowB) },
            log: live.approvalsLog.map((l) => ({ id: l.id, requestId: l.requestId, decision: l.decision, by: l.by })),
          };
        });
        const writes = await writesAfter(p, seq0);
        const postedByBree = r.legA.writeOffs.find((e) => e.amountCents === -41000 && e.secondApprover === 'Bree Lawson') || null;
        const legA = r.legA.result.ok === true && r.legA.row && r.legA.row.status === 'approved' && r.legA.row.decidedBy === 'Bree Lawson' && !!postedByBree && r.legA.actor.entitlements.length === 0;
        const legB = r.legB.result.ok === true && r.legB.row && r.legB.row.status === 'rejected' && r.legB.row.decidedBy === 'Dr. Blake Reagan' && r.legB.row.requestedById === r.legB.actor.id;
        rec('S2-store-rewrites-1', 'decideApproval still takes the approver from its argument and never checks approve_second: Bree Lawson (no entitlements) approves the $410 write-off with her own PIN and -$410 posts with her as second approver, and the requesting biller records his own $200 request as rejected by Dr. Blake Reagan with no PIN at all; S-controls-4 passes stepup=true and reads the needsStepup refusal as fixed', 'B3, CONTRACTS §6 blocked_same_person "enforced on the posting itself"; docs/05 dual release — store.js decideApproval (`user(approverId) || currentUser()`, PIN only on approved, no approve_second)',
          legA || legB, { ...r, writes, legAReproduced: legA, legBReproduced: legB, pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js chartPaint(): the tooth is validated with Number(tooth) (so '14', ' 14', '0x0e' and '1.4e1' pass) and
    // the surfaces with /^[modbl]$/i, but the duplicate_paint gate compares the raw values (`c.tooth === tooth`,
    // case-sensitive surfaces) and the row keeps the raw value, so the same composite on #14 O paints and bills six
    // times ($260 each) and the chart, plan and note carry teeth "0x0e" and " 14". Negative control: every repaint
    // after the first is refused duplicate_paint, one procedure exists for #14 and it stores the number 14.
    async 'S2-store-rewrites-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const st = window.Proto.store; const live = st.get(); const E = 'enc-9002';
          const variants = [[14, ['o']], [14, ['O']], ['14', ['o']], [' 14', ['o']], ['0x0e', ['o']], ['1.4e1', ['o']], [14, ['o']]];
          const results = variants.map(([tooth, surfaces]) => { const res = st.chartPaint(E, tooth, surfaces, 'd2392', 'today'); return { tooth, surfaces, ok: res.ok, code: res.code || null }; });
          const procs = live.procedures.filter((x) => x.encounterId === E).map((x) => ({ id: x.id, cdt: x.cdt, tooth: x.tooth, toothType: typeof x.tooth, surfaces: x.surfaces, feeCents: x.feeCents }));
          const chart = live.chartEvents.filter((x) => x.encounterId === E && !x.reversed).map((x) => ({ id: x.id, tooth: x.tooth, surfaces: x.surfaces }));
          const plan = live.planItems.filter((x) => x.encounterId === E).map((x) => ({ id: x.id, tooth: x.tooth, estimateCents: x.estimateCents }));
          return { results, procs, chart, plan, feeTotal: procs.reduce((s, x) => s + x.feeCents, 0), note: (live.notes[E] || {}).procedure || null, estimate: st.windowEstimate('a-1043') };
        });
        const writes = await writesAfter(p, seq0);
        const accepted = r.results.filter((x) => x.ok).length;
        const same14 = r.procs.filter((x) => x.cdt === 'd2392' && Number(x.tooth) === 14 && String(x.surfaces.join('')).toLowerCase() === 'o');
        rec('S2-store-rewrites-2', 'chartPaint dedupes on the raw tooth and case-sensitive surfaces while validating with Number() and /i: D2392 on #14 O charts and bills six times ($1,560) via 14, "14", " 14", "0x0e", "1.4e1" and O/o, and the procedure and chart rows store the raw strings', 'A2, B2 — store.js chartPaint duplicate_paint gate (`c.tooth === tooth`, sameSurfaces) vs its Number(tooth) / /^[modbl]$/i validation',
          accepted >= 2 && same14.length >= 2, { ...r, writes, acceptedPaints: accepted, sameToothSameSurfaceProcedures: same14.length, pageErrors: errs });
      } finally { await c.close(); }
    },

    // store.js postCheckout()/writeoffCap(): the write-off cap reads balances(pid).patientDue from the ledger BEFORE the
    // same call posts the filed visit's charges, so on a-1046 (note filed, $168 of charges not yet on the ledger,
    // estimate $168) a $160 cash payment with an $8 courtesy write-off is refused amount_required "Remove the write-off
    // — nothing left" while the screen's estimate says $168 is due. Negative control: the cap reads the balance after
    // the charges that post in the transaction (or the estimate portion), the write-off posts and the gate is absent.
    async 'S2-store-rewrites-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        const before = await p.evaluate(() => { const st = window.Proto.store; const live = st.get(); const a = live.appointments.find((x) => x.id === 'a-1046'); const enc = live.encounters.find((e) => e.id === a.encounterId); return { status: a.status, noteFiled: !!enc.noteFiled, estimate: st.windowEstimate('a-1046'), balance: st.balances('p-305'), uncharged: live.procedures.filter((x) => x.encounterId === a.encounterId && !st.charged(x)).map((x) => ({ id: x.id, cdt: x.cdt, feeCents: x.feeCents })), estimateDom: [...document.querySelectorAll('.threenum .v, .co-est, [data-testid^="checkout.line."] td.num')].map((e) => e.textContent.trim()).slice(0, 8) }; });
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '160.00');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '8.00'); await click(p, 'checkout.writeoff.reason.courtesy');
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const ui = await gate(p);
        const direct = await p.evaluate(() => { const st = window.Proto.store; const res = st.postCheckout('a-1046', { decision: 'collect', tender: 'cash', amountCents: 16000, selfPay: [], writeoffCents: 800, writeoffReason: 'courtesy' }); return { ok: res.ok, code: res.code || null, verb: res.verb || null, control: res.control || null }; });
        const after = await p.evaluate(() => { const st = window.Proto.store; const live = st.get(); return { status: live.appointments.find((x) => x.id === 'a-1046').status, balance: st.balances('p-305'), ledger: live.ledger.filter((e) => e.patientId === 'p-305').map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents })) }; });
        const writes = await writesAfter(p, seq0);
        const reproduced = before.noteFiled && before.estimate.patientCents === 16800 && before.balance.patientDue === 0 && before.uncharged.length > 0
          && direct.ok === false && direct.code === 'amount_required' && /nothing left/i.test(direct.verb || '') && after.ledger.length === 0;
        rec('S2-store-rewrites-3', 'On a-1046 (note filed, $168 of charges posting at checkout, estimate $168, ledger $0) a $160 payment with an $8 courtesy write-off is refused amount_required "Remove the write-off — nothing left" because writeoffCap reads the pre-posting ledger balance', 'docs/04 §checkout (estimate column separate from balance; write-off at the window), A7 — store.js postCheckout writeoffCap(form.writeoffCents, min(est.patientCents - amt, balances(pid).patientDue)) before the charges post',
          reproduced, { before, uiGate: ui, direct, after, writes, pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
