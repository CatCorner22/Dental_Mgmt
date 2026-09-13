// Audit checks for the beta storm's third wave, owner "ledger": moneydesk-ledger-4, -9, -10 (remainder), -6 (remainder),
// the era-1 seed status and the Filed-later visit enc-9010. Files: prototype/js/store.js, prototype/js/seed.js,
// prototype/js/screens/moneydesk.js, prototype/js/screens/rail.js. Default position is NOT reproduced: every check measures
// the breach it claims, carries the precondition it needed in the evidence, and closes its browser context in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const after = async (p, seq0) => (await events(p)).filter((e) => e.seq > seq0).map((e) => ({ seq: e.seq, kind: e.kind, code: e.code, table: e.table, id: e.id }));
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => b.textContent.trim()) })));
  const fill = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.waitForTimeout(60); return true; };
  const asOf = async (p, date) => { await click(p, 'ledger.asof'); await p.fill('[data-testid="ledger.asof.date"]', date); await p.$eval('[data-testid="ledger.asof.date"]', (e) => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(150); };
  const era1 = (S) => S.eraLines.filter((l) => l.batchId === 'era-1');
  const era1Ledger = (S) => S.ledger.filter((e) => e.eraLineId && /^el-\d+$/.test(e.eraLineId)).length;

  return {
    // store.js requirePin / moneydesk.js: on ?device=shared every Money Desk posting verb wrote with no PIN and no pin_required
    // refusal while Checkout Post on the same flag refused. Negative control: each press is refused with pin_required (a
    // refusal event and a gate on screen), no ledger row, write-off or statement is written, and the gate's control lands the
    // keyboard on a PIN field; then `posted` is false and the check reports no.
    async 'A-storm-ledger-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money?device=shared');
        const device = await p.evaluate(() => window.__proto.device);
        const n0 = (await state(p)).ledger.length; const seq0 = await lastSeq(p);
        const pressedPost = await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const ev1 = await after(p, seq0);
        const gate = await refusalsDom(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(120);
        const focused = await p.evaluate(() => { const a = document.activeElement; return (a && a.getAttribute && a.getAttribute('data-testid')) || (a ? a.tagName : null); });
        await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '100'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        await click(p, 'money.tab.statements'); await click(p, 'money.statement.sd-1.send'); await p.waitForTimeout(150);
        const S = await state(p);
        const o = { device, pressedPost, ledgerRowsWritten: S.ledger.length - n0, eraLedgerRows: era1Ledger(S), writeOffs: S.ledger.filter((e) => e.patientId === 'p-306' && e.kind === 'write_off' && !e.eraLineId).length, sd1Sent: !!(S.statementsDue.find((s) => s.id === 'sd-1') || {}).sent, sessions: S.sessions.length, pinRefusals: (await events(p)).filter((e) => e.kind === 'refusal' && /^pin_/.test(e.code)).length, gateAfterPost: gate, controlFocused: focused, eventsAfterPost: ev1.filter((e) => e.kind !== 'click' && e.kind !== 'focus').length };
        const posted = o.eraLedgerRows > 0 || o.writeOffs > 0 || o.sd1Sent;
        rec('A-storm-ledger-1', 'On a shared device Post matched, the write-off Post and Send statement on Money Desk write ledger rows and send with no PIN and no pin_required refusal, while Checkout on the same device refuses', 'docs/13 feature 30 (shared desk: the PIN on Post names the poster) and CONTRACTS §6 pin_required; store.js eraPostMatched, requestWriteoff, sendStatement, moneydesk.js',
          device === 'shared' && pressedPost && posted && o.pinRefusals === 0, o);
      } finally { await c.close(); }
    },

    // store.js eraDispute: the line's Why promised "Dispute creates an appeal row citing the fee-schedule line" and the decided row
    // said "An appeal row cites the fee-schedule line", but Dispute wrote only the line status and a claimEvents row. Negative
    // control: an appealPackets row naming the line (or its claim) is written by the press; then `noAppealRow` is false.
    async 'A-storm-ledger-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const why = await p.$eval('[data-testid="money.era.line.el-14.why"] + p', (e) => e.textContent).catch(() => null);
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'money.era.line.el-14.dispute'); await p.waitForTimeout(200);
        const S = await state(p); const line = S.eraLines.find((l) => l.id === 'el-14') || {};
        const writes = (await after(p, seq0)).filter((e) => e.kind === 'write').map((e) => e.table + ':' + e.id);
        const packets = S.appealPackets.filter((x) => x.eraLineId === 'el-14' || x.claimId === line.claimId);
        const rowText = await p.evaluate(() => { const r = [...document.querySelectorAll('#canvas .md-row')].find((x) => /Line 14\b/.test(x.textContent)); return r ? r.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : null; });
        const noAppealRow = packets.length === 0 && !writes.some((w) => w.startsWith('appealPackets:'));
        rec('A-storm-ledger-2', 'Dispute on ERA line el-14 (CARC 45) promises an appeal row citing the fee-schedule line and writes only eraLines and a claimEvents row: no appealPackets row exists for the line or its claim', 'docs/13 feature 14 (Dispute creates an appeal row citing the fee-schedule line) and docs/04 (the word on screen and the record agree); store.js eraDispute',
          pressed && /appeal row/.test(why || '') && line.status === 'disputed' && noAppealRow, { why, pressed, lineStatus: line.status, claimId: line.claimId, writes, appealPackets: packets, decidedRowText: rowText });
      } finally { await c.close(); }
    },

    // store.js explain/allocate, rail.js explainBlock: under As-of the three numbers were sums over rows posted by that day while
    // Explain either read the live ledger (last storm) or, after the first fix, printed a note instead of sentences. Negative
    // control: the block renders one sentence per charge posted by the day, its "you owe" total equals the patient due computed
    // fresh over those rows, and it names no date after the day; then `mismatch` is false.
    async 'A-storm-ledger-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-303');
        await click(p, 'ledger.explain'); await asOf(p, '2026-07-20');
        const o = await p.evaluate(() => {
          const rows = window.__proto.state().ledger.filter((e) => e.patientId === 'p-303' && e.posted <= '2026-07-20');
          const fresh = { charges: rows.filter((e) => e.kind === 'charge').length, dueCents: Math.max(0, rows.reduce((s, e) => s + e.amountCents, 0)) };
          const sentences = [...document.querySelectorAll('#canvas .explain .sentence')].filter((e) => !e.classList.contains('muted')).map((e) => e.textContent.replace(/\s+/g, ' ').trim());
          const owe = sentences.map((s) => (s.match(/you owe \$([\d,]+\.\d{2})/) || [null, null])[1]).filter(Boolean).reduce((s, x) => s + Math.round(Number(x.replace(/,/g, '')) * 100), 0);
          return { three: [...document.querySelectorAll('#canvas .threenum .v')].map((e) => e.textContent.trim()), rowsShown: document.querySelectorAll('#canvas .ledger-table tbody tr[data-testid]').length, fresh, sentences, oweCents: owe, note: ((document.querySelector('#canvas .explain .sentence.muted') || {}).textContent || '').trim() || null };
        });
        const laterDates = o.sentences.join(' ').match(/\b(\d{1,2})\/(\d{1,2})\/2026\b/g) || [];
        const late = laterDates.filter((d) => { const [m, day] = d.split('/').map(Number); return m > 7 || (m === 7 && day > 20); });
        const mismatch = o.sentences.length !== o.fresh.charges || o.oweCents !== o.fresh.dueCents || late.length > 0;
        rec('A-storm-ledger-3', 'With the Ledger As-of set to 7/20 on p-303 the Explain block does not render the allocation over the rows posted by that day: it prints a note (or the live sentences) while the three numbers above read Patient due $217.00 over one charge', 'docs/13 feature 23 (As-of re-renders the view over entries posted at or before the instant; Explain renders from the same rows); store.js explain(pid, asOf), rail.js explainBlock',
          o.rowsShown === 1 && o.three[0] === '$217.00' && o.fresh.charges === 1 && mismatch, Object.assign(o, { datesAfterAsOf: late, mismatch }));
      } finally { await c.close(); }
    },

    // seed.js procedures / store.js fileNote: the Exams row for enc-9010 read "filing releases the held payment", but the visit
    // carried no procedure, so filing released no charge and the $95 intent ai-0 could never land. Negative control: the seed
    // gives the hygiene visit its procedure, filing releases at least one charge, the intent is applied and the payment shows
    // against the charge in balances(); then `stranded` is false.
    async 'A-storm-ledger-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/exams');
        const before = await p.evaluate(() => { const S = window.__proto.state(); return { procedures: S.procedures.filter((x) => x.encounterId === 'enc-9010').map((x) => x.id + ':' + x.cdt), row: ((document.querySelector('[data-testid="exams.row.enc-9010"] .why') || {}).textContent || '').trim(), intent: S.allocationIntents.find((x) => x.id === 'ai-0') || null, balances: Proto.store.balances('p-307') }; });
        const res = await p.evaluate(() => Proto.store.fileNote('enc-9010', { assessment: 'Healthy gingiva, light calculus.', plan: 'Prophylaxis today; recall 6 months.' }, true));
        const afterFile = await p.evaluate(() => { const S = window.__proto.state(); const a = Proto.store.allocate('p-307'); return { intent: S.allocationIntents.find((x) => x.id === 'ai-0') || null, charges: S.ledger.filter((e) => e.patientId === 'p-307' && e.kind === 'charge').map((e) => e.id + ':' + e.cdt + ':' + e.amountCents), applied: a.charges.map((ch) => ({ charge: ch.row.id, applied: ch.applied.map((x) => x.id), open: ch.open })), balances: Proto.store.balances('p-307') }; });
        const stranded = (res.released || 0) === 0 || !(afterFile.intent && afterFile.intent.appliedTo) || !afterFile.applied.some((ch) => ch.applied.includes('le-window-9010'));
        rec('A-storm-ledger-4', 'The Filed-later visit enc-9010 promises "filing releases the held payment" but carries no procedure: filing its note releases no charge, intent ai-0 is never applied and the $95.00 payment stays an unapplied credit', 'docs/13 feature 1 (a payment taken before filing lands when the note files) and docs/04 (wording never contradicts state); seed.js procedures, store.js fileNote',
          /releases the held payment/.test(before.row) && res.ok === true && stranded, { before, fileResult: res.ok ? { released: res.released, claim: res.claim && res.claim.id } : res.code, after: afterFile, stranded });
      } finally { await c.close(); }
    },

    // store.js raiseStatement / rail.js sendStatement: on p-306 ($410 due, no statementsDue row) Send was held with a gate whose
    // only exit led to a tab with nothing to raise. Negative control: Send raises the row and sends it (a statementsDue row for
    // p-306 marked sent, a mail disclosure) or refuses for a reason the store names; then `deadEnd` is false.
    async 'A-storm-ledger-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-306');
        const pre = await p.evaluate(() => ({ rows: window.__proto.state().statementsDue.filter((x) => x.patientId === 'p-306').length, due: Proto.store.balances('p-306').patientDue, pendingClaims: window.__proto.state().claims.filter((c) => c.patientId === 'p-306' && ['submitted', 'pended'].includes(c.status)).length, raiseVerb: typeof Proto.store.raiseStatement }));
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'ledger.statement.send'); await p.waitForTimeout(200);
        const S = await state(p); const gate = await refusalsDom(p);
        const rows = S.statementsDue.filter((x) => x.patientId === 'p-306').map((x) => ({ id: x.id, sent: !!x.sent, amountCents: x.amountCents }));
        const writes = (await after(p, seq0)).filter((e) => e.kind === 'write').map((e) => e.table + ':' + e.id);
        const deadEnd = rows.length === 0 && gate.some((g) => g.code === 'statement_held');
        rec('A-storm-ledger-5', 'On #/biller/ledger/p-306 ($410.00 due, no statementsDue row, no pending claim) Send statement raises no row and is held with "Queue this statement on Money Desk": nothing on Money Desk raises one', 'docs/13 feature 23 (Money Desk → Statements due is where a statement is raised; the Ledger sends it) and CONTRACTS §6 (a gate with nowhere to go is a dead end); store.js raiseStatement, rail.js sendStatement',
          pressed && pre.rows === 0 && pre.due > 0 && pre.pendingClaims === 0 && deadEnd, { precondition: pre, pressed, gate, statementsForP306: rows, writes, deadEnd });
      } finally { await c.close(); }
    },

    // seed.js eraLines / store.js eraPostMatched: the 37 matched lines were seeded status 'posted' before any ledger row carried
    // their id, so the screen had to infer "posted" from ledger rows. Negative control: the lines are 'matched' until Post matched
    // writes their rows and flips them to 'posted' (37 rows, 37 posted, 0 matched); then `postedWithoutRows` is false.
    async 'A-storm-ledger-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const S0 = await state(p);
        const before = { posted: era1(S0).filter((l) => l.status === 'posted').length, matched: era1(S0).filter((l) => l.status === 'matched').length, ledgerRows: era1Ledger(S0), batch: S0.eraBatches[0].status };
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const S1 = await state(p);
        const afterPost = { posted: era1(S1).filter((l) => l.status === 'posted').length, matched: era1(S1).filter((l) => l.status === 'matched').length, ledgerRows: era1Ledger(S1), batch: S1.eraBatches[0].status };
        const postedWithoutRows = before.posted > 0 && before.ledgerRows === 0;
        rec('A-storm-ledger-6', 'On the seed the 37 matched era-1 lines carry status "posted" while the ledger holds no row for any of them; the status says posted before Post matched has written anything', 'docs/04 (one canonical view per fact: a status names what the record holds) and docs/13 feature 14; seed.js eraLines, store.js eraPostMatched',
          before.batch === 'review' && postedWithoutRows, { before, afterPost, postedWithoutRows });
      } finally { await c.close(); }
    },
  };
};
