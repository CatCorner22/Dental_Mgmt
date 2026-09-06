// Audit checks for prototype/js/store.js, chunk store-3 (root causes RC-66, 69, 70, 96, 97, 232, 240, 244, 144).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const tables = (ev) => [...new Set(ev.filter((e) => e.kind === 'write').map((e) => e.table))];
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const trail = (ev) => ev.map((e) => e.seq + ':' + e.kind + ':' + (e.kind === 'write' ? e.table + '/' + e.id : e.code || e.testid || e.key || ''));
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: (r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || null,
    controls: r.querySelectorAll('[data-testid="refusal.control"]').length,
    buttons: [...r.querySelectorAll('button')].map((b) => b.textContent.trim()),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  // Word count: whitespace tokens; `words` drops tokens that are punctuation only (a lone em dash).
  const count = (verb) => { const tokens = (verb || '').trim().split(/\s+/).filter(Boolean); return { tokens: tokens.length, words: tokens.filter((t) => /[A-Za-z0-9#$]/.test(t)).length }; };
  const money = (cents) => (cents == null ? null : (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toFixed(2));

  return {
    // RC-66 · C5/A2/A7 · store.js:37-41 balances() adds every `charge` row to patientDue and derives insurancePending
    // only from claims in status submitted/pended, so a visit the same screen calls "Nothing due today" posts $183 of
    // patient debt the moment its charges release.
    // Negative control: when the attribution is right, Post on a-1045 leaves patientDue at 0 and shows the $183.00 under
    // Waiting on insurance on every surface; then patientDueAfter === 0 (or insurancePending picks the money up) and the
    // check reports false. A Post that was refused writes no collectionDecisions row and is not scored at all.
    async 'A-store-3-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1045');
        const read = () => p.evaluate(() => {
          const S = window.__proto.state(); const a = S.appointments.find((x) => x.id === 'a-1045');
          return {
            patientId: a.patientId, encounterId: a.encounterId,
            estimate: S.estimates['a-1045'],
            storeBalances: Proto.store.balances(a.patientId),
            noteFiled: !!(S.encounters.find((e) => e.id === a.encounterId) || {}).noteFiled,
            procedures: S.procedures.filter((x) => x.encounterId === a.encounterId).map((x) => x.id + ':' + x.cdt + ':' + x.feeCents + ':' + x.status + ':charged=' + !!x.charged),
            claims: S.claims.filter((x) => x.patientId === a.patientId).map((x) => x.id + ':' + x.status),
            ledger: S.ledger.filter((e) => e.patientId === a.patientId).map((e) => e.id + ':' + e.kind + ':' + e.amountCents),
            decisions: S.collectionDecisions.filter((d) => d.encounterId === a.encounterId).map((d) => d.id + ':' + d.decision + ':' + d.patientPortionCents),
            checkoutThreeNumbers: (document.querySelector('.threenum') || {}).textContent || null,
            segments: [...document.querySelectorAll('[data-testid^="checkout.collect.seg."]')].map((e) => e.getAttribute('data-testid') + '=' + e.getAttribute('aria-pressed')),
          };
        });
        const before = await read();
        const seq0 = await lastSeq(p);
        const posted = await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const afterS = await read();
        const ev = await after(p, seq0);
        const postedCard = await p.evaluate(() => ((document.querySelector('.co-posted') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260));
        const refusals = await refusalsDom(p);
        await hop(p, '#/biller/ledger/p-304'); await p.waitForTimeout(200);
        const ledgerScreen = await p.evaluate(() => ({
          threeNumbers: [...document.querySelectorAll('.threenum .n')].map((n) => ({ value: (n.querySelector('.v') || {}).textContent, label: (n.querySelector('.l') || {}).textContent })),
          storeBalances: Proto.store.balances('p-304'),
        }));
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(200);
        const boardCard = await p.evaluate(() => { const e = document.querySelector('[data-testid="board.card.a-1045"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null; });
        const decisionWritten = afterS.decisions.length > before.decisions.length;
        const reproduced = posted && decisionWritten && before.estimate.patientCents === 0 && before.storeBalances.patientDue === 0
          && afterS.storeBalances.patientDue > 0 && afterS.storeBalances.insurancePending === 0;
        rec('A-store-3-1', 'Posting the "Nothing due today" checkout of a-1045 (Ruth Adler, estimate note "Delta covers prophy and exam at 100%") moves Patient due from $0.00 to $183.00 on every surface while Waiting on insurance stays $0.00', 'C5, A2, A7 — the same fact has one canonical value and a number is computed from state; store.js:37 sums every charge into patientDue and store.js:41 derives insurancePending only from submitted/pended claims',
          reproduced, {
            estimate: before.estimate,
            decisionSegmentsOnScreen: before.segments,
            decisionRowsAfter: afterS.decisions,
            storeValueBefore: before.storeBalances, storeValueAfter: afterS.storeBalances,
            storeValueAfterAsMoney: { patientDue: money(afterS.storeBalances.patientDue), insurancePending: money(afterS.storeBalances.insurancePending), credit: money(afterS.storeBalances.credit) },
            renderingCheckoutBefore: before.checkoutThreeNumbers,
            renderingCheckoutAfter: afterS.checkoutThreeNumbers,
            renderingPostedCard: postedCard,
            renderingLedgerScreen: ledgerScreen.threeNumbers,
            renderingBoardCard: boardCard,
            ledgerBefore: before.ledger, ledgerAfter: afterS.ledger,
            claimsForPatient: afterS.claims,
            proceduresBefore: before.procedures, proceduresAfter: afterS.procedures,
            noteFiled: before.noteFiled,
            refusalsOnScreen: refusals,
            writeEvents: writes(ev), seqRange: range(ev, seq0),
          });
      } finally { await c.close(); }
    },

    // RC-69 · A2/C2 · store.js:101 postCheckout writes the approvals row inside the gate branch, before returning the
    // needs_second refusal whose control is labelled "Request approval"; checkout.js:79 wires that control to an
    // announcement and a rerender only.
    // Negative control: a control that performs its verb leaves approvals empty at Post (no `write approvals` event in the
    // Post seq range) and writes approvals/ar-1 in the control's own seq range; then writesAtControl is non-empty and the
    // check reports false. A run that never reached needs_second (no refusal with that code) is not scored.
    async 'A-store-3-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.writeoff.add');
        await fill(p, 'checkout.writeoff.amount', '410');
        await click(p, 'checkout.writeoff.reason.courtesy');
        await click(p, 'checkout.tender.card');
        await fill(p, 'checkout.card.number', '4242424242424242');
        const approvals = () => p.evaluate(() => window.__proto.state().approvals.map((a) => ({ id: a.id, status: a.status, amountCents: a.amountCents, requestedBy: a.requestedBy, frozenSentence: a.frozenSentence })));
        const beforePost = await approvals();
        const seqPost = await lastSeq(p);
        const postPressed = await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const afterPost = await approvals();
        const evPost = await after(p, seqPost);
        const gate = await refusalsDom(p);
        const stateAtGate = await p.evaluate(() => ({
          postLabel: ((document.querySelector('[data-testid="checkout.post"]') || {}).textContent || '').trim(),
          postClass: (document.querySelector('[data-testid="checkout.post"]') || {}).className || null,
          andon: ((document.getElementById('andon') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        }));
        const seqCtl = await lastSeq(p);
        const ctlPressed = await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const afterCtl = await approvals();
        const evCtl = await after(p, seqCtl);
        const announced = await p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
        const needsSecond = gate.find((g) => g.code === 'needs_second') || null;
        const writesAtPost = writes(evPost).filter((w) => w.startsWith('approvals/'));
        const writesAtControl = writes(evCtl);
        const reproduced = !!postPressed && !!needsSecond && ctlPressed
          && beforePost.length === 0 && afterPost.length === 1 && writesAtPost.length === 1
          && afterCtl.length === afterPost.length && writesAtControl.length === 0;
        rec('A-store-3-2', 'Post on the a-1047 write-off writes the approvals row ar-1 before the needs_second refusal is raised, so the control labelled "Request approval" writes nothing when it is finally pressed', 'A2, C2 — a control labelled with a verb performs that verb; store.js:101 writes approvals inside postCheckout and checkout.js:79 only announces',
          reproduced, {
            approvalsBeforePost: beforePost, approvalsAfterPost: afterPost, approvalsAfterControl: afterCtl,
            writeEventsAtPost: writes(evPost), approvalsWriteAtPost: writesAtPost, postSeqRange: range(evPost, seqPost), postEventTrail: trail(evPost),
            refusalOnScreen: needsSecond, refusalControlLabel: needsSecond ? needsSecond.buttons[0] || null : null,
            primaryButtonAtGate: stateAtGate.postLabel, primaryButtonClass: stateAtGate.postClass, andonAtGate: stateAtGate.andon,
            controlPressed: ctlPressed, writeEventsAtControl: writesAtControl, controlSeqRange: range(evCtl, seqCtl), controlEventTrail: trail(evCtl),
            announcementAfterControl: announced,
          });
      } finally { await c.close(); }
    },

    // RC-70 · B2 · store.js:259 clearVariance refuses with a noun-first sentence and control null; dailyclose.js:135 passes
    // both straight into Proto.ui.refusal, which renders no button when control is null.
    // The branch has no path through the shipped UI: the only user the store refuses is the biller (Sam Dawson, closer of
    // rr-loc-3), and dailyclose.js:135 hides Clear from the closer — so the check first surveys all eight personas, then
    // injects rr-loc-3.closer = 'Dana Whitfield' to make the control render while the biller/loc-3 arm still refuses.
    // Negative control: a compliant gate renders one [data-testid="refusal.control"] and a verb-first line of at most eight
    // words; then controls === 1 and words <= 8 and the check reports false. Only the refusal whose data-code is
    // clear_not_independent is scored, and the variance must stay open (a gate that let the write through is a different bug).
    async 'A-store-3-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/close');
        // Reachability survey: does any persona see Clear on a variance the store would refuse? Read-only, no mutation.
        const survey = await p.evaluate(() => {
          const out = {}; const back = window.__proto.persona;
          for (const persona of ['frontdesk', 'biller', 'hygienist', 'dentist', 'surgeon', 'owner', 'compliance', 'temp']) {
            window.__proto.set({ persona });
            const rr = Proto.store.get().reconciliation.find((r) => r.id === 'rr-loc-3');
            const u = Proto.store.currentUser();
            out[persona] = { user: u.name, role: u.role, storeWouldRefuse: rr.closer === u.name || (u.role === 'biller' && rr.locationId === 'loc-3'), uiHidesClear: rr.closer === u.name };
          }
          window.__proto.set({ persona: back });
          return out;
        });
        await hop(p, '#/biller/close'); await p.waitForTimeout(150);
        await click(p, 'close.tied.tile'); await p.waitForTimeout(150);
        const clearBeforeInject = await p.evaluate(() => !!document.querySelector('[data-testid="close.variance.v-1.clear"]'));
        const injected = await p.evaluate(() => { const rr = Proto.store.get().reconciliation.find((r) => r.id === 'rr-loc-3'); rr.closer = 'Dana Whitfield'; Proto.router.render(); return { closer: rr.closer, me: Proto.store.currentUser().name, role: Proto.store.currentUser().role }; });
        await p.waitForTimeout(200);
        const clearAfterInject = await p.evaluate(() => !!document.querySelector('[data-testid="close.variance.v-1.clear"]'));
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'close.variance.v-1.clear'); await p.waitForTimeout(200);
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'clear_not_independent');
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
        const ctlBox = await box(p, 'refusal.control');
        const variance = await p.evaluate(() => window.__proto.state().variances.map((v) => v.id + ':' + v.status));
        const verb = dom.length ? dom[0].verb : null; const n = count(verb);
        const reproduced = pressed && dom.length > 0 && dom[0].controls === 0 && n.words > 8 && variance.includes('v-1:open');
        rec('A-store-3-3', 'The clear_not_independent gate renders an eleven-word noun-first line ("You posted that day — Dana or the CPA seat can clear") with a Why and zero controls, and no persona can reach it through the shipped UI', 'B2 / CONTRACTS §6 — verb line verb-first and at most eight words, exactly one 44 px control; store.js:259 passes control null',
          reproduced, {
            reachabilitySurvey: survey,
            personasWhereStoreRefuses: Object.entries(survey).filter(([, v]) => v.storeWouldRefuse).map(([k, v]) => k + ' (' + v.user + ', UI hides Clear: ' + v.uiHidesClear + ')'),
            clearRenderedForBillerBeforeInjection: clearBeforeInject,
            injection: injected, clearRenderedAfterInjection: clearAfterInject,
            refusalDom: dom, verb, wordCount: n.words, tokenCount: n.tokens, verbFirstWord: verb ? verb.split(/\s+/)[0] : null,
            refusalControlBox: ctlBox, refusalEvents: ev, seqRange: range(await after(p, seq0), seq0),
            varianceStatusAfter: variance,
          });
      } finally { await c.close(); }
    },

    // RC-96 · A3 · store.js:215 chartPaint flips every open tag on the painted tooth to disposition 'charted' inside the
    // loop, with no write('tags', ...) — the three write events it does emit name chartEvents, procedures and planItems.
    // Negative control: the same table change on the dismiss path (encounter.js:170) emits {table:'tags', id:'tag-1'}; the
    // check drives that path in a second context and requires the event to be there. If the paint emitted a tags event the
    // same way, tagsWriteAtPaint would be 1 and the check reports false. A paint that never flipped the disposition
    // (dispositionBefore === dispositionAfter) is not scored.
    async 'A-store-3-4'(b) {
      const { c, p } = await ctx(b);
      const second = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const tag = () => p.evaluate(() => window.__proto.state().tags.filter((t) => t.encounterId === 'enc-9002').map((t) => ({ id: t.id, tooth: t.tooth, disposition: t.disposition, text: t.text })));
        const before = await tag();
        await click(p, 'enc.tag.tag-1.chart'); await p.waitForTimeout(120);
        await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
        const seq0 = await lastSeq(p);
        const painted = await click(p, 'enc.proc.d2392'); await p.waitForTimeout(200);
        const afterS = await tag();
        const ev = await after(p, seq0);
        const rows = await p.evaluate(() => { const S = window.__proto.state(); return { chartEvents: S.chartEvents.filter((x) => x.encounterId === 'enc-9002').map((x) => x.id), procedures: S.procedures.filter((x) => x.encounterId === 'enc-9002').map((x) => x.id), planItems: S.planItems.filter((x) => x.encounterId === 'enc-9002').map((x) => x.id) }; });
        // Negative control, driven: the dismiss path changes the same table and does log it.
        await go(second.p, '#/dentist/encounter/enc-9002');
        await click(second.p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(120);
        await second.p.fill('#reason-tag-1', 'Watch, no caries').catch(() => {});
        const seqD = await lastSeq(second.p);
        await click(second.p, 'enc.tag.tag-1.dismiss'); await second.p.waitForTimeout(200);
        const evD = await after(second.p, seqD);
        const dismissTag = await second.p.evaluate(() => window.__proto.state().tags.filter((t) => t.encounterId === 'enc-9002').map((t) => t.id + ':' + t.disposition));
        const tagsWriteAtPaint = ev.filter((e) => e.kind === 'write' && e.table === 'tags').length;
        const tagsWriteAtDismiss = evD.filter((e) => e.kind === 'write' && e.table === 'tags').length;
        const flipped = before[0] && afterS[0] && before[0].disposition == null && afterS[0].disposition === 'charted';
        const reproduced = !!painted && !!flipped && tagsWriteAtPaint === 0;
        rec('A-store-3-4', 'Charting from the hygienist tag flips tags/tag-1 from no disposition to "charted" and emits write events for chartEvents, procedures and planItems only — no tags event — while the dismiss path logs the same table change', 'A3 — a mutation writes one write event per table it changes, with table and id; store.js:215',
          reproduced, {
            stateDiff: { tagBefore: before, tagAfter: afterS, dispositionBefore: before[0] ? before[0].disposition : null, dispositionAfter: afterS[0] ? afterS[0].disposition : null },
            rowsWrittenByPaint: rows,
            writeEventsInPaintRange: writes(ev), tablesWritten: tables(ev), tagsWriteEventsAtPaint: tagsWriteAtPaint,
            paintSeqRange: range(ev, seq0), paintEventTrail: trail(ev),
            negativeControlDismiss: { tagAfterDismiss: dismissTag, writeEvents: writes(evD), tagsWriteEventsAtDismiss: tagsWriteAtDismiss, seqRange: range(evD, seqD) },
          });
      } finally { await c.close(); await second.c.close(); }
    },

    // RC-97 · A4 · store.js:234 fileNote never looks at enc.status / enc.noteFiled, so a second call on a signed encounter
    // runs the whole transaction again. The encounter screen hides the File control after filing, so the repeat is driven
    // through the store.
    // Negative control: the first filing must be shown to have worked (filedNotes 0 → 1, encounter status 'signed') before
    // the repeat is scored; a compliant store then returns {ok:false, code:'exam_sealed'} and filedNotes stays at 1, so
    // secondFiledNoteId is null and the check reports false. The check matches the code exam_sealed specifically — any
    // other refusal is reported as "refused with a different code" and still counts as not reproduced for this claim.
    async 'A-store-3-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart'); await p.waitForTimeout(120);
        await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
        await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120);
        await click(p, 'enc.note.starter.0'); await p.waitForTimeout(120);
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const readback = await refusalsDom(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const snap = () => p.evaluate(() => { const S = window.__proto.state(); const e = S.encounters.find((x) => x.id === 'enc-9002') || {}; return { filedNotes: S.filedNotes.filter((n) => n.encounterId === 'enc-9002').map((n) => n.id), status: e.status, noteFiled: !!e.noteFiled, claims: S.claims.filter((x) => x.patientId === 'p-302').map((x) => x.id + ':' + x.status), charges: S.ledger.filter((x) => x.kind === 'charge' && x.patientId === 'p-302').map((x) => x.id + ':' + x.amountCents), controlsOnScreen: [...document.querySelectorAll('[data-testid^="enc."]')].map((e2) => e2.getAttribute('data-testid')) }; });
        const afterFirst = await snap();
        const seq0 = await lastSeq(p);
        const secondCall = await p.evaluate(() => { try { const r = Proto.store.fileNote('enc-9002', { assessment: 'Second filing of a signed encounter', plan: 'Second filing of a signed encounter' }, true); return { threw: false, ok: !!r.ok, code: r.code || null, verb: r.verb || null, filedId: r.filed ? r.filed.id : null, killers: r.killers ? r.killers.map((k) => k.code) : null }; } catch (e) { return { threw: true, error: e.message }; } });
        const afterSecond = await snap();
        const ev = await after(p, seq0);
        const firstWorked = afterFirst.filedNotes.length === 1 && afterFirst.status === 'signed' && afterFirst.noteFiled === true;
        const sealed = secondCall.code === 'exam_sealed';
        const reproduced = firstWorked && !sealed && secondCall.ok === true && afterSecond.filedNotes.length > afterFirst.filedNotes.length;
        rec('A-store-3-5', 'Filing enc-9002 a second time is accepted on an encounter already status "signed": the store returns ok and writes filedNotes nf-2 and a second claim, with no exam_sealed refusal', 'A4 — repeating the same control is refused (exam_sealed) or is a visible no-op with its reason; store.js:234 fileNote never checks enc.status',
          reproduced, {
            readbackGateOnFirstFile: readback,
            rowCountsAfterFirstFile: { filedNotes: afterFirst.filedNotes, claims: afterFirst.claims, charges: afterFirst.charges, encounterStatus: afterFirst.status, noteFiled: afterFirst.noteFiled },
            controlsLeftOnScreenAfterFiling: afterFirst.controlsOnScreen,
            secondFileResult: secondCall, refusedWithExamSealed: sealed,
            rowCountsAfterSecondFile: { filedNotes: afterSecond.filedNotes, claims: afterSecond.claims, charges: afterSecond.charges },
            secondFiledNoteId: secondCall.filedId,
            writeEventsAtSecondFile: writes(ev), seqRange: range(ev, seq0), eventTrail: trail(ev),
          });
      } finally { await c.close(); }
    },

    // RC-232 · A3 · store.js:21 write() only logs rows it appends; every in-place field edit (a.status, l.status, s.sent, …)
    // changes a table with no write event naming it. Three of the listed steps are driven here, one per screen.
    // Negative control: for each step the appended row IS logged (appointmentEvents/ae-1, ledger/le-*, disclosures/dis-1),
    // which is what a compliant event for the edited table would look like; if the edited table also appeared in the seq
    // range — a `write` event with table 'appointments', 'eraLines' or 'statementsDue' — missingByStep would be empty and
    // the check reports false. A step whose row did not change in place is not scored (changedFields must be non-empty).
    async 'A-store-3-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const diffOf = (a, z) => { const out = {}; for (const k of new Set([...Object.keys(a || {}), ...Object.keys(z || {})])) { const x = JSON.stringify(a ? a[k] : undefined), y = JSON.stringify(z ? z[k] : undefined); if (x !== y) out[k] = (x === undefined ? '(absent)' : x) + ' → ' + (y === undefined ? '(absent)' : y); } return out; };
        const row = (table, id) => p.evaluate(({ table, id }) => (window.__proto.state()[table] || []).find((x) => x.id === id) || null, { table, id });
        const steps = [];

        // Step 1 — Board: arrive edits appointments/a-1042 in place.
        let before = await row('appointments', 'a-1042');
        let seq0 = await lastSeq(p);
        let pressed = await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(200);
        let ev = await after(p, seq0);
        steps.push({ step: 'board.card.a-1042.arrive', table: 'appointments', id: 'a-1042', pressed, changedFields: diffOf(before, await row('appointments', 'a-1042')), writeEvents: writes(ev), tablesLogged: tables(ev), seqRange: range(ev, seq0), eventTrail: trail(ev) });

        // Step 2 — Money Desk: eraConfirm edits eraLines/el-14 in place.
        await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        before = await row('eraLines', 'el-14');
        seq0 = await lastSeq(p);
        pressed = await click(p, 'money.era.line.el-14.confirm'); await p.waitForTimeout(200);
        ev = await after(p, seq0);
        steps.push({ step: 'money.era.line.el-14.confirm', table: 'eraLines', id: 'el-14', pressed, changedFields: diffOf(before, await row('eraLines', 'el-14')), writeEvents: writes(ev), tablesLogged: tables(ev), seqRange: range(ev, seq0), eventTrail: trail(ev) });

        // Step 3 — Money Desk: sendStatement edits statementsDue/sd-1 in place.
        await click(p, 'money.tab.statements'); await p.waitForTimeout(150);
        before = await row('statementsDue', 'sd-1');
        seq0 = await lastSeq(p);
        pressed = await click(p, 'money.statement.sd-1.send'); await p.waitForTimeout(200);
        ev = await after(p, seq0);
        steps.push({ step: 'money.statement.sd-1.send', table: 'statementsDue', id: 'sd-1', pressed, changedFields: diffOf(before, await row('statementsDue', 'sd-1')), writeEvents: writes(ev), tablesLogged: tables(ev), seqRange: range(ev, seq0), eventTrail: trail(ev) });

        const scored = steps.filter((s) => s.pressed && Object.keys(s.changedFields).length > 0);
        const missing = scored.filter((s) => !s.tablesLogged.includes(s.table));
        const reproduced = scored.length === steps.length && missing.length === steps.length;
        rec('A-store-3-6', 'Three driven mutations edit a row in place (appointments/a-1042, eraLines/el-14, statementsDue/sd-1) and none of the three emits a write event naming that table, though each logs the row it appends elsewhere', 'A3 — a mutation writes one write event per table it changes, with table and id; store.js:21 write() logs appended rows only',
          reproduced, {
            steps,
            stepsScored: scored.length, stepsWithNoEventForTheEditedTable: missing.map((s) => s.step + ' → ' + s.table + '/' + s.id),
            missingByStep: Object.fromEntries(scored.map((s) => [s.step, { editedTable: s.table, changedFields: s.changedFields, tablesLogged: s.tablesLogged, hasEventForEditedTable: s.tablesLogged.includes(s.table) }])),
          });
      } finally { await c.close(); }
    },

    // RC-240 · C5/B9 · store.js:30 currentUser() returns a hard-coded temp identity when S.tempUser is unset; roles.js:88
    // builds the people table from S().users only, so a dayPasses row never appears there; store.js:291 sets short to the
    // first name, so the same person's chip changes when the pass is issued.
    // Negative control: if the temp identity came from the store, currentUser() before any pass would not be a literal
    // (tempUser null → no Alex Rivera on the Board), Roles would list the holder once dp-1 exists, and the short name would
    // not change; then rolesListsHolderAfterPass is true (or the literal is absent) and the check reports false. The pass
    // must actually be written (dayPasses 0 → 1) before the "Roles still does not list the holder" half is scored.
    async 'A-store-3-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/signin');
        const signinTemp = await txt(p, 'signin.persona.temp');
        const rolesRead = () => p.evaluate(() => ({
          people: [...document.querySelectorAll('[data-testid^="roles.row."]')].filter((e) => !/\.why$/.test(e.getAttribute('data-testid'))).map((e) => e.textContent.trim()),
          digest: ((document.querySelector('.rl-digest') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          dayPasses: window.__proto.state().dayPasses.map((d) => d.id + ':' + d.name + ':' + d.role + ':' + d.locationId),
        }));
        const tempRead = () => p.evaluate(() => ({
          authorChip: ((document.querySelector('[data-testid="topbar.author"]') || {}).textContent || '').trim(),
          currentUser: Proto.store.currentUser(),
          tempUserInStore: Proto.store.get().tempUser === undefined ? '(undefined)' : Proto.store.get().tempUser,
          railChips: [...document.querySelectorAll('[data-testid^="rail1.chip."]')].map((e) => e.textContent.trim()),
          coordinatorLine: (((document.getElementById('canvas') || {}).textContent || '').replace(/\s+/g, ' ').match(/.{0,40}no coordinator.{0,20}/) || [null])[0],
        }));
        await hop(p, '#/owner/roles'); await p.waitForTimeout(250);
        const rolesBefore = await rolesRead();
        await hop(p, '#/temp/board'); await p.waitForTimeout(250);
        const tempBefore = await tempRead();
        await hop(p, '#/owner/roles'); await p.waitForTimeout(250);
        await click(p, 'roles.daypass.add');
        await fill(p, 'roles.daypass.name', 'Alex Rivera');
        await click(p, 'roles.daypass.role.rdh');
        await click(p, 'roles.daypass.location.loc-3');
        const seq0 = await lastSeq(p);
        const saved = await click(p, 'roles.daypass.save'); await p.waitForTimeout(300);
        const ev = await after(p, seq0);
        await hop(p, '#/owner/roles'); await p.waitForTimeout(300);
        const rolesAfter = await rolesRead();
        await hop(p, '#/temp/board'); await p.waitForTimeout(300);
        const tempAfter = await tempRead();
        const HOLDER = /Alex Rivera/;
        const listedBefore = rolesBefore.people.some((x) => HOLDER.test(x));
        const listedAfter = rolesAfter.people.some((x) => HOLDER.test(x));
        const passWritten = rolesAfter.dayPasses.length === 1 && rolesBefore.dayPasses.length === 0;
        const literalIdentity = tempBefore.currentUser && tempBefore.currentUser.name === 'Alex Rivera' && tempBefore.tempUserInStore === '(undefined)';
        const shortChanged = tempBefore.currentUser.short !== tempAfter.currentUser.short;
        const reproduced = !!saved && passWritten && literalIdentity && !listedBefore && !listedAfter && shortChanged;
        rec('A-store-3-7', 'The Temp persona signs in as a hard-coded "Alex Rivera · Front desk" with post_payment while the store holds no day pass and Roles lists no such person; after the RDH pass dp-1 is written Roles still lists the same eleven users and the author chip changes from "Alex R." to "Alex"', 'C5, B9 — one canonical value per fact and per-user state keyed by user id; store.js:30 default temp literal, roles.js:88 iterates users only, store.js:291 short = first name',
          reproduced, {
            signinTempLabel: signinTemp,
            beforePass: { dayPassesInStore: rolesBefore.dayPasses, rolesPeople: rolesBefore.people, rolesPeopleCount: rolesBefore.people.length, rolesDigest: rolesBefore.digest, holderListed: listedBefore, tempCurrentUser: tempBefore.currentUser, tempUserInStore: tempBefore.tempUserInStore, authorChip: tempBefore.authorChip, railChips: tempBefore.railChips, boardCoordinatorLine: tempBefore.coordinatorLine },
            passIssued: { saved, writeEvents: writes(ev), seqRange: range(ev, seq0), dayPassRows: rolesAfter.dayPasses },
            afterPass: { rolesPeople: rolesAfter.people, rolesPeopleCount: rolesAfter.people.length, rolesDigest: rolesAfter.digest, holderListed: listedAfter, tempCurrentUser: tempAfter.currentUser, tempUserInStore: tempAfter.tempUserInStore, authorChip: tempAfter.authorChip, railChips: tempAfter.railChips },
            shortNameBefore: tempBefore.currentUser.short, shortNameAfter: tempAfter.currentUser.short,
            digestVsStore: { digestBefore: rolesBefore.digest, dayPassRowsBefore: rolesBefore.dayPasses.length, digestAfter: rolesAfter.digest, dayPassRowsAfter: rolesAfter.dayPasses.length },
          });
      } finally { await c.close(); }
    },

    // RC-244 · B7 · store.js:60 builds the charge clause with Proto.ui.longDate and :61/:63 build the payment clauses with
    // Proto.ui.shortDate, so one Explain sentence carries two date shapes; store.js:241 stores filedAt as
    // S.tenant.today + ' ' + S.clock.time and encounter.js:377 prints that ISO string verbatim on the filed card.
    // Negative control: with one shape per context the sentence's date tokens would all carry a year or all omit it
    // (shapesInSentence.length === 1) and the filed card would read a formatted date ("9/3/2026 at 8:40"), matching no
    // ISO pattern; then either half is false and the check reports false. The filed-card half is scored only if the note
    // actually filed (a filedNotes row exists).
    async 'A-store-3-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const explain = await p.evaluate(() => {
          const rows = Proto.store.explain('p-303');
          return rows.map((r) => {
            const tokens = (r.sentence.match(/\d{1,2}\/\d{1,2}(?:\/\d{4})?/g) || []);
            return { sentence: r.sentence, dateTokens: tokens, longShape: tokens.filter((t) => /\/\d{4}$/.test(t)), shortShape: tokens.filter((t) => !/\/\d{4}$/.test(t)) };
          });
        });
        const formatters = await p.evaluate(() => ({ 'shortDate("2026-08-02")': Proto.ui.shortDate('2026-08-02'), 'longDate("2026-07-14")': Proto.ui.longDate('2026-07-14') }));
        const mixed = explain.filter((x) => x.longShape.length > 0 && x.shortShape.length > 0);
        // Second half: the ISO storage string on the filed card (surgeon files enc-9020).
        await hop(p, '#/surgeon/exams'); await p.waitForTimeout(200);
        await click(p, 'exams.row.enc-9020.open'); await p.waitForTimeout(200);
        await click(p, 'enc.tooth.17'); await click(p, 'enc.proc.d7210'); await p.waitForTimeout(120);
        await click(p, 'enc.note.starter.0'); await p.waitForTimeout(120);
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const gate = await refusalsDom(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(300);
        const filed = await p.evaluate(() => {
          const S = window.__proto.state(); const row = S.filedNotes.filter((n) => n.encounterId === 'enc-9020').pop() || null;
          const card = (document.querySelector('.enc-filed') || {}).textContent || '';
          return { row, cardText: card.replace(/\s+/g, ' ').trim().slice(0, 220), byLine: (card.replace(/\s+/g, ' ').match(/By [^·]+·/) || [null])[0], todayInStore: S.tenant.today, clock: S.clock };
        });
        const ISO = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
        const isoOnCard = !!filed.row && ISO.test(filed.cardText) && filed.row.filedAt === filed.todayInStore + ' ' + filed.clock.time;
        const reproduced = mixed.length > 0 && isoOnCard;
        rec('A-store-3-8', 'One Explain sentence for p-303 carries two date shapes (charge on 7/14/2026 from longDate, payments on 8/2 and 8/20 from shortDate) and the filed card prints the raw ISO storage string "2026-09-03 08:40" that fileNote stored', 'B7 — one date format per context, and a timestamp on screen is formatted through Proto.ui; store.js:60-63 and store.js:241 with encounter.js:377',
          reproduced, {
            explainSentences: explain,
            sentencesMixingShapes: mixed.length,
            longShapeTokens: mixed.flatMap((x) => x.longShape), shortShapeTokens: mixed.flatMap((x) => x.shortShape),
            formatterOutputs: formatters,
            readbackGateOnFile: gate,
            filedNoteRow: filed.row ? { id: filed.row.id, author: filed.row.author, filedAt: filed.row.filedAt } : null,
            filedAtEqualsTodayPlusClock: !!filed.row && filed.row.filedAt === filed.todayInStore + ' ' + filed.clock.time,
            storeToday: filed.todayInStore, storeClock: filed.clock,
            filedCardText: filed.cardText, filedCardByLine: filed.byLine, isoPatternOnCard: ISO.test(filed.cardText),
          });
      } finally { await c.close(); }
    },

    // RC-144 · A1/A2 · fifteen store verbs dereference the row they looked up without checking it exists, and four accept
    // impossible inputs (a tag on a non-existent encounter, a close on a non-existent location, a paint with an unknown
    // CDT, a write-off of zero or a negative amount). Driven through page.evaluate: every UI caller validates the id first,
    // so no persona reaches these branches — which is why this stays P3.
    // Negative control: arrive, seat, savePerio, chartPaint and fileNote take the same unknown ids and return
    // {ok:false, code:'notfound'}; those five are driven in the same pass and are the shape a guarded verb has. If every
    // verb behaved that way, threwCount would be 0 and junkRowsWritten empty and the check reports false.
    async 'A-store-3-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const seq0 = await lastSeq(p);
        const probe = await p.evaluate(() => {
          const S = () => window.__proto.state();
          const calls = [
            ['reverify("a-999")', () => Proto.store.reverify('a-999')],
            ['pingChair("a-999")', () => Proto.store.pingChair('a-999')],
            ['readyForExam("a-999")', () => Proto.store.readyForExam('a-999')],
            ['eraPostMatched("era-x")', () => Proto.store.eraPostMatched('era-x')],
            ['eraConfirm("el-x")', () => Proto.store.eraConfirm('el-x')],
            ['eraHold("el-x")', () => Proto.store.eraHold('el-x')],
            ['eraDispute("el-x")', () => Proto.store.eraDispute('el-x')],
            ['buildAppeal("c-x")', () => Proto.store.buildAppeal('c-x')],
            ['sendAppeal("c-x")', () => Proto.store.sendAppeal('c-x')],
            ['sendStatement("sd-x")', () => Proto.store.sendStatement('sd-x')],
            ['matchVariance("v-x")', () => Proto.store.matchVariance('v-x')],
            ['clearVariance("v-x")', () => Proto.store.clearVariance('v-x')],
            ['reviewDecision("d-x","keep")', () => Proto.store.reviewDecision('d-x', 'keep')],
            ['requestWriteoff("p-999",50000)', () => Proto.store.requestWriteoff('p-999', 50000, 'courtesy')],
            ['addDayPass({})', () => Proto.store.addDayPass({})],
          ];
          const guarded = [
            ['arrive("a-999")', () => Proto.store.arrive('a-999')],
            ['seat("a-999")', () => Proto.store.seat('a-999')],
            ['savePerio("enc-zzz",{})', () => Proto.store.savePerio('enc-zzz', {})],
            ['chartPaint("enc-zzz",…)', () => Proto.store.chartPaint('enc-zzz', 3, ['o'], 'd2392', 'today')],
            ['fileNote("enc-zzz",…)', () => Proto.store.fileNote('enc-zzz', { assessment: 'a' }, true)],
          ];
          const run = (list) => { const out = {}; for (const [name, fn] of list) { try { const r = fn(); out[name] = { threw: false, ok: !!(r && r.ok), code: (r && r.code) || null }; } catch (e) { out[name] = { threw: true, error: e.message }; } } return out; };
          const unguarded = run(calls); const guardedResults = run(guarded);
          const junk = {};
          const tagsBefore = S().tags.length;
          try { const r = Proto.store.addTag('enc-zzz', 3, ['o'], 'ghost'); junk['addTag on a non-existent encounter'] = { ok: !!r.ok, rowWritten: r.tag ? { id: r.tag.id, encounterId: r.tag.encounterId } : null, tagsBefore, tagsAfter: S().tags.length }; } catch (e) { junk['addTag on a non-existent encounter'] = { threw: e.message }; }
          try { const r = Proto.store.closeDay('loc-x'); junk['closeDay on a non-existent location'] = { ok: !!r.ok, rowsWritten: S().dayCloses.filter((d) => d.locationId === 'loc-x').map((d) => d.id) }; } catch (e) { junk['closeDay on a non-existent location'] = { threw: e.message }; }
          try { const r = Proto.store.chartPaint('enc-9002', 3, ['o'], 'd9999', 'today'); junk['chartPaint with an unknown CDT'] = { ok: !!r.ok, procedure: r.procedure ? { id: r.procedure.id, cdt: r.procedure.cdt, feeCents: r.procedure.feeCents } : null, noteScaffoldLine: (S().notes['enc-9002'] || {}).procedure || null }; } catch (e) { junk['chartPaint with an unknown CDT'] = { threw: e.message }; }
          const woBefore = S().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306').map((e) => e.id + ':' + e.amountCents);
          const balBefore = Proto.store.balances('p-306');
          try { const r = Proto.store.requestWriteoff('p-306', 0, 'courtesy'); junk['requestWriteoff of $0'] = { ok: !!r.ok, code: r.code || null, writeOffRows: S().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306').map((e) => e.id + ':' + e.amountCents) }; } catch (e) { junk['requestWriteoff of $0'] = { threw: e.message }; }
          try { const r = Proto.store.requestWriteoff('p-306', -5000, 'courtesy'); junk['requestWriteoff of −$50'] = { ok: !!r.ok, code: r.code || null, writeOffRows: S().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306').map((e) => e.id + ':' + e.amountCents), balanceBefore: balBefore, balanceAfter: Proto.store.balances('p-306') }; } catch (e) { junk['requestWriteoff of −$50'] = { threw: e.message }; }
          return { unguarded, guardedResults, junk, writeOffRowsBefore: woBefore };
        });
        const ev = await after(p, seq0);
        const threw = Object.entries(probe.unguarded).filter(([, v]) => v.threw);
        const guardedOk = Object.entries(probe.guardedResults).filter(([, v]) => !v.threw && v.code === 'notfound');
        const junkWritten = Object.entries(probe.junk).filter(([, v]) => v.ok === true);
        const reproduced = threw.length > 0 && junkWritten.length > 0;
        rec('A-store-3-9', 'Fifteen store verbs throw a TypeError on an unknown id instead of refusing, and four accept impossible inputs — a tag on a non-existent encounter, a day close on a non-existent location, a paint with an unknown CDT, and a write-off of $0 or −$50 that raises the balance', 'A1, A2 (store.js:1-2: every mutation returns ok or a refusal) — reachable only through page.evaluate, every UI caller validates the id first',
          reproduced, {
            threwCount: threw.length, threwOnUnknownId: Object.fromEntries(threw),
            refusedCleanlyCount: guardedOk.length, negativeControlGuardedVerbs: probe.guardedResults,
            junkRowsWritten: junkWritten.map(([k]) => k), junkDetail: probe.junk,
            writeOffRowsBeforeProbe: probe.writeOffRowsBefore,
            pageErrorEventsDuringProbe: ev.filter((e) => e.kind === 'error').map((e) => e.seq + ':' + e.message),
            writeEventsDuringProbe: writes(ev), seqRange: range(ev, seq0),
          });
      } finally { await c.close(); }
    },
  };
};
