// Regression checks for guards that a later store rewrite dropped after the swarm merged (PR #6): each was
// reproduced live against the merged head before it was restored. Files: prototype/js/store.js (chartPaint,
// requestWriteoff, evaluateRelease), prototype/css/base.css (.canvas).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, rec }) => {
  const events = (p) => p.evaluate(() => window.__events.slice());
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const writesAfter = async (p, seq) => (await events(p)).filter((e) => e.seq > seq && e.kind === 'write').map((e) => e.seq + ' ' + e.table + '/' + e.id);

  return {
    // store.js chartPaint(): savePerio and addTag refuse exam_sealed once the note is filed, but the paint verb lost
    // its guard, so a paint on a filed visit wrote a chart event, a procedure, a plan line and a pending charge that
    // the sealed note never carried. Negative control: the paint is refused (exam_sealed) and no table grows.
    async 'A-regress-3-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const E = 'enc-9002';
          const dismissed = S.dismissTag('tag-1', 'Seen; no caries on exam.');
          const filed = S.fileNote(E, { assessment: 'Recall exam; no new caries.', plan: 'Recall 6 months.' }, true);
          const count = () => { const st = window.__proto.state(); return { chartEvents: st.chartEvents.length, procedures: st.procedures.length, planItems: st.planItems.length, ledger: st.ledger.length }; };
          const before = count();
          const paint = S.chartPaint(E, 14, ['M', 'O'], 'd2392', 'today');
          return { dismissedOk: dismissed.ok, filedOk: filed.ok, filedCode: filed.code || null, noteFiled: !!(S.encounter(E) || {}).noteFiled, paintOk: paint.ok, paintCode: paint.code || null, before, after: count() };
        });
        const grew = Object.keys(r.before).some((k) => r.after[k] !== r.before[k]);
        rec('A-regress-3-1', 'chartPaint on a visit whose note is filed returns ok and appends chart, procedure and plan rows behind the sealed note', 'A2, A8 — store.js chartPaint lacks the exam_sealed guard that savePerio and addTag carry',
          r.filedOk === true && r.noteFiled && (r.paintOk === true || grew), r);
      } finally { await c.close(); }
    },

    // store.js requestWriteoff(): the broad billing gate admits any seat with post_payment, so Priya (post_payment,
    // schedule; no write_off) retired a balance from Money Desk. Negative control: the store refuses on entitlement
    // and the ledger holds no write_off row by her.
    async 'A-regress-3-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/money');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const st = window.__proto.state();
          const priya = S.currentUser();
          if (!priya || !/Priya/.test(priya.name)) return { noUser: true, entitlements: [] };
          const rows = () => window.__proto.state().ledger.filter((e) => e.kind === 'write_off');
          const before = rows().length;
          const res = S.requestWriteoff('p-306', 10000, 'courtesy');
          return { user: priya.name, entitlements: priya.entitlements, ok: res.ok, code: res.code || null, verb: res.verb || null, writeoffRows: rows().length - before, byPriya: rows().some((e) => e.actor === priya.name) };
        });
        const writes = await writesAfter(p, seq0);
        rec('A-regress-3-2', 'A seat with post_payment but no write_off entitlement posts a $100 write-off from the store', 'B2 — store.js requestWriteoff gates on the shared BILLING list instead of the write_off grant',
          !r.noUser && !r.entitlements.includes('write_off') && (r.ok === true || r.writeoffRows > 0 || r.byPriya), Object.assign(r, { writes }));
      } finally { await c.close(); }
    },

    // store.js evaluateRelease(): a write-off on an account whose claim is denied and not appealed must route through
    // dual release at any amount (docs/13 feature 25). Negative control: the $50 write-off on p-321 (claim c-88 denied,
    // no appeal sent) is held with a pending approval request and no ledger row.
    async 'A-regress-3-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const st = window.__proto.state();
          const denied = st.claims.find((cl) => cl.patientId === 'p-321' && cl.status === 'denied');
          const appealed = denied ? st.appealPackets.some((k) => k.claimId === denied.id && k.sent) : null;
          const rows = () => window.__proto.state().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-321').length;
          const before = rows();
          const res = S.requestWriteoff('p-321', 5000, 'courtesy');
          return { deniedClaim: denied ? denied.id : null, appealed, ok: res.ok, code: res.code || null, held: !!res.held, requestId: res.requestId || null, ledgerRows: rows() - before, pending: window.__proto.state().approvals.filter((a) => a.patientId === 'p-321' && a.status === 'pending').length };
        });
        rec('A-regress-3-3', 'A $50 write-off on an account with a denied, unappealed claim posts straight to the ledger instead of routing through dual release', 'B2, docs/13 feature 25 — evaluateRelease is called without the account, so the denial check never runs',
          !!r.deniedClaim && r.appealed === false && (r.ok === true || r.ledgerRows > 0), r);
      } finally { await c.close(); }
    },
  };
};
