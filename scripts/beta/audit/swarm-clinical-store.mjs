// Swarm hunt, lens clinical-store (verified): clinical record integrity in prototype/js/store.js
// (savePerio, addTag, chartPaint, chartUndo, noteKillers, readyForExam, fileNote) and the seeded Filed-later visit.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.seq + ' ' + e.table + '/' + e.id);
  const range = (ev) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null);
  const NOTE = { assessment: 'Caries #30 MO confirmed clinically and on BWX.', plan: 'Composite #30 MO today under local; postoperative instructions given.' };

  return {
    // store.js:393 fileNote releases every procedure on the encounter that is not yet charged, including one
    // chartUndo (store.js:313) marked reversed/status 'reversed'. Paint composite #30, paint crown #19, Undo (crown), File.
    // Negative control: once release excludes reversed procedures, the ledger holds one charge (pr-500, 26000),
    // pr-501 keeps status 'reversed', Patient due is 26000, and the check reports false.
    async 'S-clinical-store-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9001');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate((NOTE) => {
          const S = window.Proto.store; const E = 'enc-9001';
          const paint1 = S.chartPaint(E, 30, ['M', 'O'], 'd2392', 'today'); const paint2 = S.chartPaint(E, 19, ['O'], 'd2740', 'today');
          const undo = S.chartUndo(E);
          const snap = () => S.get().procedures.filter((x) => x.encounterId === E).map((x) => ({ id: x.id, cdt: x.cdt, status: x.status, reversed: !!x.reversed, feeCents: x.feeCents }));
          const before = { procedures: snap(), balances: S.balances('p-301'), charges: S.get().ledger.filter((l) => l.patientId === 'p-301' && l.kind === 'charge').map((l) => l.id + ':' + l.procedureId + ':' + l.amountCents) };
          const file = S.fileNote(E, NOTE, true);
          const afterS = { procedures: snap(), balances: S.balances('p-301'), charges: S.get().ledger.filter((l) => l.patientId === 'p-301' && l.kind === 'charge').map((l) => l.id + ':' + l.procedureId + ':' + l.amountCents), filedMarkdown: (S.get().filedNotes.slice(-1)[0] || {}).markdown };
          return { paint1: paint1.ok, paint2: paint2.ok, undoOk: undo.ok, undoSupersedes: undo.supersedes, fileOk: file.ok, before, after: afterS };
        }, NOTE);
        const ev = await after(p, seq0);
        const reversedProc = r.before.procedures.find((x) => x.reversed);
        const chargedReversed = reversedProc ? r.after.charges.filter((s) => s.includes(':' + reversedProc.id + ':')) : [];
        const reversedNow = reversedProc ? r.after.procedures.find((x) => x.id === reversedProc.id) : null;
        const reproduced = r.paint1 && r.paint2 && r.undoOk && r.fileOk && !!reversedProc && chargedReversed.length > 0 && r.after.balances.patientDue > 26000 && !!reversedNow && reversedNow.status === 'completed';
        rec('S-clinical-store-1', 'File releases the crown #19 that Undo had reversed: fileNote charges pr-501 ($1,180) alongside the live composite, so Patient due is $1,440 for a note whose scaffold lists only the composite', 'A2, A5, B6 — store.js:393 release filter is !charged(p) and never excludes p.reversed',
          reproduced, { proceduresBeforeFile: r.before.procedures, chargesBeforeFile: r.before.charges, patientDueBeforeFile: r.before.balances.patientDue, proceduresAfterFile: r.after.procedures, chargesAfterFile: r.after.charges, patientDueAfterFile: r.after.balances.patientDue, chargedReversed, filedMarkdown: r.after.filedMarkdown, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // seed.js:227 seeds the Filed-later lane a-1050 (Devon Price, p-307) with credit cr-1 −9500 and store.js:16 seeds allocationIntent ai-0 pointing
    // at paymentId 'le-window-9010', but the ledger holds no such payment row. store.js:389 fileNote then flags cr-1 fromLedger/applied
    // (dropping it from balances) while no payment row ever offsets the released charge.
    // Negative control: with the $95 window payment on the ledger (or the credit left standing), filing a $118 prophy leaves Patient due 2300
    // (or 11800 with credit 9500 still counted); the check reports false.
    async 'S-clinical-store-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9010');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const s0 = S.get();
          const intent = s0.allocationIntents.find((i) => i.encounterId === 'enc-9010') || null;
          const paymentRow = intent ? s0.ledger.find((l) => l.id === intent.paymentId) || null : null;
          const before = { balances: S.balances('p-307'), ledger: s0.ledger.filter((l) => l.patientId === 'p-307').map((l) => l.id + ':' + l.kind + ':' + l.amountCents), credit: Object.assign({}, s0.credits.find((x) => x.id === 'cr-1')), decision: (s0.collectionDecisions.find((d) => d.encounterId === 'enc-9010') || {}).patientPortionCents };
          const paint = S.chartPaint('enc-9010', null, [], 'd1110', 'today');
          const file = S.fileNote('enc-9010', { assessment: 'Prophylaxis completed; tissues healthy.', plan: 'Recall in 6 months.' }, true);
          const s1 = S.get();
          const afterS = { balances: S.balances('p-307'), ledger: s1.ledger.filter((l) => l.patientId === 'p-307').map((l) => l.id + ':' + l.kind + ':' + l.amountCents), credit: Object.assign({}, s1.credits.find((x) => x.id === 'cr-1')), intent: Object.assign({}, s1.allocationIntents.find((i) => i.encounterId === 'enc-9010')), apptStatus: s1.appointments.find((a) => a.id === 'a-1050').status };
          return { intent, paymentRowExists: !!paymentRow, paintOk: paint.ok, fileOk: file.ok, before, after: afterS };
        });
        const ev = await after(p, seq0);
        const paidAtWindow = r.before.decision || 0;
        const expectedDue = 11800 - paidAtWindow;
        const reproduced = r.paintOk && r.fileOk && !!r.intent && !r.paymentRowExists && r.before.balances.credit === paidAtWindow && r.after.balances.credit === 0 && r.after.balances.patientDue === 11800 && r.after.balances.patientDue !== expectedDue && !r.after.ledger.some((l) => /patient_payment/.test(l));
        rec('S-clinical-store-2', 'Filing the Filed-later visit enc-9010 (a-1050, $95 collected at checkout) charges $118 and erases the $95 credit: seed intent ai-0 names payment le-window-9010 that no ledger row holds, so Patient due is $118.00 instead of $23.00', 'A2, B6, C5 — store.js:16 allocationIntents ai-0 paymentId dangling (seed.js:227 cr-1); store.js:389 sets cr-1.fromLedger without a payment row',
          reproduced, { intent: r.intent, paymentRowExists: r.paymentRowExists, patientPortionCollected: paidAtWindow, balancesBefore: r.before.balances, ledgerBefore: r.before.ledger, creditBefore: r.before.credit, balancesAfter: r.after.balances, ledgerAfter: r.after.ledger, creditAfter: r.after.credit, intentAfter: r.after.intent, expectedPatientDue: expectedDue, apptStatusAfter: r.after.apptStatus, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:276 duplicate_paint looks at every chartEvents row for the encounter/cdt/tooth, including the reversed paint and its
    // reversal row, so after Undo the same code on the same tooth is refused with "Undo the first one to change it" while the live chart is empty.
    // Negative control: when the duplicate rule reads only live paints, the second chartPaint returns ok and the check reports false.
    async 'S-clinical-store-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9001');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.m'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120);
        const painted = await p.evaluate(() => window.__proto.state().chartEvents.filter((c) => c.encounterId === 'enc-9001').map((c) => ({ id: c.id, kind: c.kind || 'paint', tooth: c.tooth, cdt: c.cdt, reversed: !!c.reversed })));
        await click(p, 'enc.undo'); await p.waitForTimeout(120);
        const afterUndo = await p.evaluate(() => ({ rows: window.__proto.state().chartEvents.filter((c) => c.encounterId === 'enc-9001').map((c) => ({ id: c.id, kind: c.kind || 'paint', tooth: c.tooth, cdt: c.cdt, reversed: !!c.reversed })), live: window.__proto.state().chartEvents.filter((c) => c.encounterId === 'enc-9001' && !c.reversed && c.kind !== 'reversal').length, undoBtn: !!document.querySelector('[data-testid="enc.undo"]') }));
        await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
        const again = await p.evaluate(() => { const S = window.Proto.store; const direct = S.chartPaint('enc-9001', 30, ['D', 'O'], 'd2392', 'today'); const ref = document.querySelector('.refusal'); return { direct: direct.ok ? { ok: true } : { ok: false, code: direct.code, verb: direct.verb, why: direct.why }, refusalDom: ref ? { code: ref.dataset.code || null, verb: ((ref.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() } : null, live: window.__proto.state().chartEvents.filter((c) => c.encounterId === 'enc-9001' && !c.reversed && c.kind !== 'reversal').length }; });
        const ev = await after(p, seq0);
        const reproduced = painted.length === 1 && afterUndo.live === 0 && again.direct.ok === false && again.direct.code === 'duplicate_paint' && again.live === 0;
        rec('S-clinical-store-3', 'After Undo of composite #30 the chart is empty, yet painting composite #30 again is refused duplicate_paint ("Undo the first one to change it") because the duplicate rule counts the reversed paint and its reversal row', 'A2, A5 — store.js:276 `already` does not exclude c.reversed or kind reversal',
          reproduced, { afterPaint: painted, afterUndo, repaintDirect: again.direct, repaintRefusalDom: again.refusalDom, livePaintsAfterRepaint: again.live, refusals: ev.filter((e) => e.kind === 'refusal').map((e) => e.seq + ' ' + e.code), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:366 noteKillers builds `toothed` from every chartEvents row, reversed paints and reversal rows included, and takes toothed[0]
    // as "the chart tooth". Paint #30, Undo, paint #19: a note naming the undone #30 files clean, and a note naming #14 is told to use #30.
    // Negative control: reading live paints only, the #30 note raises contradiction with chartTooth 19 and the #14 note names chartTooth 19; the check
    // reports false only when both facets are gone (a fix that picks the last paint but still reads reversed rows keeps it true).
    async 'S-clinical-store-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9001');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const E = 'enc-9001';
          const p1 = S.chartPaint(E, 30, ['M', 'O'], 'd2392', 'today'); const u = S.chartUndo(E); const p2 = S.chartPaint(E, 19, ['O'], 'd2740', 'today');
          const rows = S.get().chartEvents.filter((c) => c.encounterId === E).map((c) => ({ id: c.id, kind: c.kind || 'paint', tooth: c.tooth, reversed: !!c.reversed }));
          const live = rows.filter((c) => c.kind === 'paint' && !c.reversed).map((c) => c.tooth);
          const undone = S.noteKillers(E, { assessment: 'Caries #30 MO confirmed clinically.', plan: 'Composite #30 MO today under local.' }).map((k) => ({ code: k.code, verb: k.verb, chartTooth: k.chartTooth }));
          const other = S.noteKillers(E, { assessment: 'Fractured cusp #14, no pulpal exposure.', plan: 'Crown #14; temporized today.' }).map((k) => ({ code: k.code, verb: k.verb, chartTooth: k.chartTooth }));
          const file = S.fileNote(E, { assessment: 'Caries #30 MO confirmed clinically.', plan: 'Composite #30 MO today under local.' }, true);
          return { ok: p1.ok && u.ok && p2.ok, rows, live, killersForUndoneTooth: undone, killersForOtherTooth: other, fileOk: file.ok, fileCode: file.code, filedMarkdown: file.ok ? file.filed.markdown : null };
        });
        const ev = await after(p, seq0);
        const contra = r.killersForOtherTooth.find((k) => k.code === 'contradiction');
        // Either facet alone is the breach: the undone-tooth note files clean, or the fix names the undone tooth as the chart tooth.
        const undoneNoteFiles = !r.killersForUndoneTooth.some((k) => k.code === 'contradiction') && r.fileOk === true;
        const fixNamesUndone = !!contra && contra.chartTooth === 30;
        const reproduced = r.ok && r.live.length === 1 && r.live[0] === 19 && (undoneNoteFiles || fixNamesUndone);
        rec('S-clinical-store-4', 'With composite #30 undone and crown #19 the only live paint, a note about #30 raises no contradiction and files, and a note about #14 is told "Use the chart tooth #30" — the undone tooth — because noteKillers reads reversed chart events', 'A2, A8 — store.js:366-369 toothed includes reversed rows and toothed[0] is the reversed paint',
          reproduced, { chartRows: r.rows, liveTeeth: r.live, killersForUndoneTooth: r.killersForUndoneTooth, killersForOtherTooth: r.killersForOtherTooth, fileOk: r.fileOk, fileCode: r.fileCode || null, filedMarkdown: r.filedMarkdown, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:265 readyForExam sets status 'ready_for_exam' on any appointment; encounter.js:449-454 only guards "already in queue".
    // A hygienist opening the Filed-later visit enc-9010 (a-1050 checked_out_unfiled) and pressing "Send to Exams to sign" pulls the
    // checked-out patient back into the chair queue; the Board's Filed-later row vanishes; File then lands the visit on 'note_filed' with Checkout offered again.
    // Negative control: when readyForExam refuses (or the fix is not offered) for a checked-out visit, a-1050 stays checked_out_unfiled,
    // the Board queue row persists, and File moves it to checked_out; the check reports false. It stays true while either the status
    // regresses or File lands the decided visit anywhere but checked_out.
    async 'S-clinical-store-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/encounter/enc-9010');
        const before = await p.evaluate(() => ({ status: window.__proto.state().appointments.find((a) => a.id === 'a-1050').status, decision: !!window.__proto.state().collectionDecisions.find((d) => d.encounterId === 'enc-9010') }));
        await p.focus('[data-testid="enc.note.field.assessment"]'); await p.keyboard.press('Tab'); await p.waitForTimeout(400);
        const fixes = await p.evaluate(() => [...document.querySelectorAll('.killer [data-testid^="enc.killer."]')].map((e) => e.getAttribute('data-testid') + ' :: ' + e.textContent.trim()));
        const sendTid = (fixes.find((f) => /Send to Exams/.test(f)) || '').split(' :: ')[0];
        const seq0 = await lastSeq(p);
        if (sendTid) await click(p, sendTid);
        const mid = await p.evaluate(() => ({ status: window.__proto.state().appointments.find((a) => a.id === 'a-1050').status, examRequested: window.__proto.state().appointmentEvents.filter((e) => e.appointmentId === 'a-1050' && e.kind === 'encounter.exam_requested').length }));
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(150);
        const board = await p.evaluate(() => ({ queueRow: !!document.querySelector('[data-testid="board.queue.row.a-1050"]'), card: ((document.querySelector('[data-testid="board.card.a-1050"]') || {}).textContent || '').trim().slice(0, 120) }));
        await hop(p, '#/dentist/encounter/enc-9010'); await p.waitForTimeout(150);
        const filed = await p.evaluate(() => { const r = window.Proto.store.fileNote('enc-9010', { assessment: 'Prophylaxis completed; tissues healthy.', plan: 'Recall in 6 months.' }, true); return { ok: r.ok, status: window.__proto.state().appointments.find((a) => a.id === 'a-1050').status }; });
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(150);
        const board2 = await p.evaluate(() => ({ queueRow: ((document.querySelector('[data-testid="board.queue.row.a-1050"]') || {}).textContent || '').trim().slice(0, 120), checkoutOffered: !!document.querySelector('[data-testid="board.queue.row.a-1050.checkout"]') }));
        const ev = await after(p, seq0);
        // The breach is the status regression of a decided, checked-out visit; the Board row and the post-File status are its consequences.
        const regressed = mid.status === 'ready_for_exam';
        const filedWrong = filed.ok === true && filed.status !== 'checked_out';
        const reproduced = before.status === 'checked_out_unfiled' && !!before.decision && !!sendTid && (regressed || filedWrong);
        rec('S-clinical-store-5', 'The hygienist\'s "Send to Exams to sign" on the checked-out Filed-later visit a-1050 moves it from checked_out_unfiled to ready_for_exam (Board Filed-later row disappears), and File then sets note_filed instead of checked_out, offering Checkout again on a visit whose collection decision already exists', 'A2, B1 — store.js:265 readyForExam has no status guard; encounter.js:449 checks only ready_for_exam/exam_requested',
          reproduced, { statusBefore: before.status, collectionDecisionExists: before.decision, killerFixes: fixes, statusAfterSend: mid.status, examRequestedEvents: mid.examRequested, boardAfterSend: board, fileResult: filed, boardAfterFile: board2, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:253-255 screening summary computes worst = max(Number(code) || 0); the '*' sextant code (furcation/mobility/recession,
    // perio.js:132) becomes 0, so six flagged sextants read "highest 0 — healthy" in the hygiene note.
    // Negative control: when '*' is excluded from the numeric maximum (or summarised in its own words), the summary no longer contains
    // "highest 0 — healthy" for an all-'*' screening and the check reports false.
    async 'S-clinical-store-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        const seq0 = await lastSeq(p);
        await click(p, 'perio.screening'); await p.keyboard.press('Escape');
        for (let i = 0; i < 6; i++) await p.keyboard.type('*');
        await p.waitForTimeout(100);
        const cells = await p.evaluate(() => [...document.querySelectorAll('.pe-sextant')].map((e) => e.textContent.trim()));
        await click(p, 'perio.save'); await p.waitForTimeout(150);
        const r = await p.evaluate(() => { const s = window.__proto.state(); const ex = s.perioExams.filter((e) => e.encounterId === 'enc-9001'); return { exams: ex.map((e) => ({ id: e.id, mode: e.mode, codes: e.sextantCodes })), perioSummary: (s.notes['enc-9001'] || {}).perioSummary || null, onScreen: document.body.textContent.includes('highest 0 — healthy') }; });
        const direct = await p.evaluate(() => { const S = window.Proto.store; const six = {}; ['UR', 'UA', 'UL', 'LR', 'LA', 'LL'].forEach((k) => { six[k] = { code: '*', skipped: false }; }); const res = S.savePerio('enc-9002', six, { mode: 'screening' }); return { ok: res.ok, summary: (S.get().notes['enc-9002'] || {}).perioSummary || null }; });
        const ev = await after(p, seq0);
        const allStar = r.exams.length === 1 && r.exams[0].mode === 'screening' && r.exams[0].codes.length === 6 && r.exams[0].codes.every((x) => x === '*');
        const reproduced = allStar && /highest 0 — healthy/.test(r.perioSummary || '') && direct.ok && /highest 0 — healthy/.test(direct.summary || '');
        rec('S-clinical-store-6', 'A screening exam coded * in all six sextants (furcation/mobility/recession flags) is summarised in the hygiene note as "highest 0 — healthy" because Number("*") || 0 scores the flag as zero', 'A2, A8 — store.js:253 worst = max(Number(x) || 0); store.js:255 MEAN[0] = healthy',
          reproduced, { sextantCells: cells, exams: r.exams, perioSummary: r.perioSummary, healthyOnScreen: r.onScreen, directCall: direct, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:256 writes srpEvidence for a screening code >= 3; store.js:260 rewrites it only when a later full chart has deepest >= 5.
    // A screening 4 followed by the full six-point addendum it demands (deepest 2 mm) leaves the note saying a code-4 screening indicates therapy prep.
    // Negative control: when the addendum recomputes (clears or replaces) srpEvidence from its own sites, srpEvidence after the full chart is
    // null or names the 2 mm result, and the check reports false.
    async 'S-clinical-store-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const E = 'enc-9001';
          const six = {}; ['UR', 'UA', 'UL', 'LR', 'LA', 'LL'].forEach((k) => { six[k] = { code: '4', skipped: false }; });
          const scr = S.savePerio(E, six, { mode: 'screening' });
          const afterScreening = Object.assign({}, S.get().notes[E]);
          const sites = {}; for (let t = 1; t <= 32; t++) for (let s = 1; s <= 6; s++) sites[t + '-' + s] = { depth: 2, bleed: false, skipped: false };
          const full = S.savePerio(E, sites, { mode: 'full', amending: true });
          const afterFull = Object.assign({}, S.get().notes[E]);
          return { screeningOk: scr.ok, fullOk: full.ok, fullExam: full.ok ? { id: full.exam.id, kind: full.exam.kind, deepest: full.exam.deepest, probed: full.exam.probed, amends: full.exam.amendsExamId } : null, afterScreening, afterFull };
        });
        const ev = await after(p, seq0);
        const reproduced = r.screeningOk && r.fullOk && r.fullExam.kind === 'addendum' && r.fullExam.deepest === 2 && /Screening code 4/.test(r.afterScreening.srpEvidence || '') && r.afterFull.srpEvidence === r.afterScreening.srpEvidence && /deepest 2 mm/.test(r.afterFull.perioSummary || '');
        rec('S-clinical-store-7', 'After a code-4 screening and then the full six-point addendum it calls for (192 sites, deepest 2 mm), the note still carries "Screening code 4 indicates a full six-point chart before periodontal therapy" beside a summary that says deepest 2 mm', 'A2, B1 — store.js:256 sets srpEvidence; store.js:260 only overwrites when deepest >= 5, never clears',
          reproduced, { fullExam: r.fullExam, notesAfterScreening: r.afterScreening, notesAfterFullAddendum: r.afterFull, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:365 money_in_note tests /\b(fee|cost|price|estimate|copay)\b/i and /\$\s?\d/, so the inflected forms a dentist actually
    // types (fees, costs, copayment, estimates, "dollars") pass the gate and file into the sealed note.
    // Negative control: when the money cue matches inflections (fees?|costs?|copay(ment)?|estimates?|dollars), each sample raises money_in_note,
    // the file attempt is refused, and the check reports false. It stays true while Fees/Costs/Copayment pass or the fee line files;
    // "Estimates given" and "1,000 dollars" are carried as evidence only.
    async 'S-clinical-store-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9001');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const E = 'enc-9001';
          const samples = ['Fees discussed: 260 for the composite.', 'Costs reviewed with the patient before treatment.', 'Copayment 40 collected at the chair.', 'Estimates given for the crown.', 'Quoted 1,000 dollars for the crown.'];
          const control = ['Fee discussed: 260.', 'Patient owes $40.'];
          const flagged = (t) => S.noteKillers(E, { assessment: 'Exam normal.', plan: t }).map((k) => k.code);
          const bypass = samples.map((t) => ({ text: t, killers: flagged(t) }));
          const ctl = control.map((t) => ({ text: t, killers: flagged(t) }));
          const file = S.fileNote(E, { assessment: 'Exam normal, no caries.', plan: 'Fees discussed: 260 for the composite; recall 6 months.' }, true);
          return { bypass, control: ctl, fileOk: file.ok, fileCode: file.code || null, filedMarkdown: file.ok ? file.filed.markdown : null };
        });
        const ev = await after(p, seq0);
        // The breach is a fee line filing into the sealed note, or any inflection of a word the gate already knows passing it.
        const inflected = r.bypass.filter((x) => /^(Fees|Costs|Copayment)/.test(x.text)).some((x) => !x.killers.includes('money_in_note'));
        const feeLineFiled = r.fileOk === true && /Fees discussed: 260/.test(r.filedMarkdown || '');
        const reproduced = r.control.every((x) => x.killers.includes('money_in_note')) && (feeLineFiled || inflected);
        rec('S-clinical-store-8', 'The money gate flags "Fee" and "$40" but not "Fees", "Costs", "Copayment", "Estimates" or "1,000 dollars", so a plan reading "Fees discussed: 260" files into the sealed note', 'A2, A8 — store.js:365 word list has no inflections and no "dollars"',
          reproduced, { bypassSamples: r.bypass, controlSamples: r.control, fileOk: r.fileOk, fileCode: r.fileCode, filedMarkdown: r.filedMarkdown, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:367 reads one tooth (`text.match(/#(\d{1,2})/)`), so a note that names a charted tooth first and an uncharted tooth second
    // raises no contradiction; a note that writes "tooth 14" without '#' is not read at all.
    // Negative control: when every #NN (and "tooth NN") mention is checked against live paints, both samples raise contradiction and the check
    // reports false; it stays true while either sample passes.
    async 'S-clinical-store-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9001');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const E = 'enc-9001';
          const paint = S.chartPaint(E, 19, ['O'], 'd2740', 'today');
          const live = S.get().chartEvents.filter((c) => c.encounterId === E && !c.reversed && c.kind !== 'reversal').map((c) => c.tooth);
          const second = S.noteKillers(E, { assessment: 'Fractured cusp #19; caries #14 DO also confirmed on BWX.', plan: 'Crown #19 today; composite #14 DO today under local.' }).map((k) => k.code);
          const noHash = S.noteKillers(E, { assessment: 'Fractured cusp tooth 14, no pulpal exposure.', plan: 'Crown tooth 14; temporized today.' }).map((k) => k.code);
          const control = S.noteKillers(E, { assessment: 'Caries #14 DO confirmed.', plan: 'Composite #14 DO today.' }).map((k) => k.code);
          const file = S.fileNote(E, { assessment: 'Fractured cusp #19; caries #14 DO also confirmed on BWX.', plan: 'Crown #19 today; composite #14 DO today under local.' }, true);
          return { paintOk: paint.ok, live, secondToothKillers: second, noHashKillers: noHash, controlKillers: control, fileOk: file.ok, filedMarkdown: file.ok ? file.filed.markdown : null };
        });
        const ev = await after(p, seq0);
        // Either facet alone is the breach: the second #NN is never compared, or 'tooth NN' is never compared.
        const secondToothPasses = !r.secondToothKillers.includes('contradiction') && r.fileOk === true;
        const toothWordPasses = !r.noHashKillers.includes('contradiction');
        const reproduced = r.paintOk && r.live.length === 1 && r.live[0] === 19 && r.controlKillers.includes('contradiction') && (secondToothPasses || toothWordPasses);
        rec('S-clinical-store-9', 'With only crown #19 charted, a note that also plans "composite #14 DO today" files without a contradiction because only the first #NN in the note is compared to the chart, and "tooth 14" without a # is never compared', 'A2, A8 — store.js:367 single match, /#(\\d{1,2})/ only',
          reproduced, { liveTeeth: r.live, secondToothKillers: r.secondToothKillers, noHashKillers: r.noHashKillers, controlKillers: r.controlKillers, fileOk: r.fileOk, filedMarkdown: r.filedMarkdown, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // chartUndo (store.js:308) and fileNote (store.js:379) refuse on a filed note, but savePerio (store.js:237) and addTag (store.js:264) do not:
    // #/hygienist/perio/enc-9004 (Ruth Adler, noteFiled, status signed) renders the grid, and Save writes a perio exam and a tag onto the sealed
    // encounter, whose row the Exams queue skips (encounter.js:96), so no dentist ever sees them.
    // Negative control: when savePerio and addTag both refuse (exam_sealed, as fileNote does) on a noteFiled encounter, no perioExams or tags row is
    // written for enc-9004, notes['enc-9004'] is unchanged, and the check reports false; it stays true while either verb still writes.
    async 'S-clinical-store-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9004');
        const before = await p.evaluate(() => { const s = window.__proto.state(); const e = s.encounters.find((x) => x.id === 'enc-9004'); return { noteFiled: e.noteFiled, status: e.status, exams: s.perioExams.filter((x) => x.encounterId === 'enc-9004').length, tags: s.tags.filter((x) => x.encounterId === 'enc-9004').length, notes: s.notes['enc-9004'] || null, h1: (document.querySelector('h1') || {}).textContent || null, saveBtn: !!document.querySelector('[data-testid="perio.save"]') }; });
        const seq0 = await lastSeq(p);
        await click(p, 'perio.screening'); await p.keyboard.press('Escape');
        for (let i = 0; i < 6; i++) await p.keyboard.type('4');
        await click(p, 'perio.save'); await p.waitForTimeout(150);
        const r = await p.evaluate(() => { const S = window.Proto.store; const tag = S.addTag('enc-9004', 3, ['O'], 'Caries #3 O suspected'); const s = S.get(); return { tagOk: tag.ok, tagCode: tag.code || null, exams: s.perioExams.filter((x) => x.encounterId === 'enc-9004').map((x) => ({ id: x.id, mode: x.mode, kind: x.kind })), tags: s.tags.filter((x) => x.encounterId === 'enc-9004').map((x) => ({ id: x.id, disposition: x.disposition })), notes: s.notes['enc-9004'] || null, noteFiled: s.encounters.find((x) => x.id === 'enc-9004').noteFiled }; });
        await hop(p, '#/dentist/exams'); await p.waitForTimeout(150);
        const queue = await p.evaluate(() => ({ row9004: !!document.querySelector('[data-testid="exams.row.enc-9004"]'), rows: [...document.querySelectorAll('[data-testid^="exams.row."]')].map((e) => e.getAttribute('data-testid')).filter((t) => !/\.open$/.test(t)) }));
        const ev = await after(p, seq0);
        // Either write onto the sealed encounter is the breach.
        const perioWrote = r.exams.length === 1 && !!r.notes && /Perio screening/.test(r.notes.perioSummary || '');
        const tagWrote = r.tagOk === true && r.tags.length === 1;
        const reproduced = before.noteFiled === true && before.exams === 0 && before.tags === 0 && r.noteFiled === true && (perioWrote || tagWrote);
        rec('S-clinical-store-10', 'The perio route on the filed encounter enc-9004 (noteFiled, signed) accepts Save and addTag: a code-4 screening and an open tag are written onto the sealed visit while the Exams queue skips filed encounters, so the new finding has no reader', 'A2, B1 — store.js:237 savePerio and store.js:264 addTag have no noteFiled guard, unlike chartUndo:308 and fileNote:379',
          reproduced, { before, afterSave: r, examsQueue: queue, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:245 accepts any truthy extras.licence, and store.js:258 interpolates LICENCE_WORDS[extras.licence], so an unknown licence code
    // (or `true`) saves a full exam whose note reads "2 sites not probed (undefined)".
    // Negative control: when savePerio refuses a licence code outside LICENCE_WORDS (omission_licence), no exam is written for the bad code,
    // the summary never contains "undefined", and the check reports false.
    async 'S-clinical-store-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9002');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const S = window.Proto.store; const E = 'enc-9002';
          const sites = {}; for (let t = 1; t <= 32; t++) for (let s = 1; s <= 6; s++) sites[t + '-' + s] = { depth: 3, bleed: false, skipped: false };
          sites['1-1'] = { depth: null, skipped: true }; sites['1-2'] = { depth: null, skipped: true };
          const bogus = S.savePerio(E, sites, { mode: 'full', licence: 'bogus' });
          const summaryBogus = (S.get().notes[E] || {}).perioSummary || null;
          const bool = S.savePerio(E, sites, { mode: 'full', licence: true, amending: true });
          const summaryBool = (S.get().notes[E] || {}).perioSummary || null;
          const none = S.savePerio(E, sites, { mode: 'full' });
          return { known: Object.keys(S.LICENCE_WORDS), bogus: bogus.ok ? { ok: true, id: bogus.exam.id, licence: bogus.exam.licence } : { ok: false, code: bogus.code }, summaryBogus, bool: bool.ok ? { ok: true, id: bool.exam.id, licence: bool.exam.licence } : { ok: false, code: bool.code }, summaryBool, noLicence: none.ok ? { ok: true } : { ok: false, code: none.code } };
        });
        const ev = await after(p, seq0);
        const reproduced = r.bogus.ok === true && /not probed \(undefined\)/.test(r.summaryBogus || '') && r.bool.ok === true && /\(undefined\)/.test(r.summaryBool || '') && r.noLicence.ok === false && r.noLicence.code === 'omission_licence';
        rec('S-clinical-store-11', 'savePerio with licence "bogus" (or `true`) saves a full exam and writes "2 sites not probed (undefined)" into the hygiene note, while a missing licence is correctly refused', 'A8, C3 — store.js:245 tests truthiness only; store.js:258 LICENCE_WORDS[extras.licence] is undefined for unknown codes',
          reproduced, { knownLicences: r.known, bogusResult: r.bogus, summaryAfterBogus: r.summaryBogus, booleanResult: r.bool, summaryAfterBoolean: r.summaryBool, noLicenceResult: r.noLicence, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },
  };
};
