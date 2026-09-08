// Swarm hunt, encounter lens: sequences the per-file audits did not drive (Undo then repaint, Undo then File,
// reversed rows leaking into the duplicate/contradiction/release queries, Existing paints, File with nothing
// performed, painting into a sealed exam, malformed store arguments, DOB in the read-back under privacy).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const blur = async (p) => { await p.focus('[data-testid="enc.note.field.plan"]'); await p.focus('[data-testid="enc.file"]'); await p.waitForTimeout(250); };
  const gates = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    control: ((r.querySelector('[data-testid="refusal.control"],[data-testid$=".fix"]') || {}).textContent || '').trim() || null,
    why: ((r.querySelector('details') || {}).textContent || '').trim() || null,
  })));
  const noteValues = (p) => p.evaluate(() => ({
    assessment: (document.querySelector('[data-testid="enc.note.field.assessment"]') || {}).value || null,
    plan: (document.querySelector('[data-testid="enc.note.field.plan"]') || {}).value || null,
  }));
  // Snapshot of one encounter: live paints (not reversed, not reversal rows), procedures, plan items, tags, note scaffold.
  const snap = (p, encId) => p.evaluate((id) => {
    const s = window.__proto.state();
    const ce = s.chartEvents.filter((c) => c.encounterId === id);
    return {
      chartEvents: ce.map((c) => ({ id: c.id, cdt: c.cdt, tooth: c.tooth, kind: c.kind || 'paint', reversed: !!c.reversed, temporality: c.temporality })),
      live: ce.filter((c) => !c.reversed && c.kind !== 'reversal').map((c) => c.cdt + '#' + c.tooth),
      procedures: s.procedures.filter((x) => x.encounterId === id).map((x) => ({ id: x.id, cdt: x.cdt, tooth: x.tooth, feeCents: x.feeCents, status: x.status, reversed: !!x.reversed, charged: !!x.charged })),
      planItems: s.planItems.filter((x) => x.encounterId === id).map((x) => ({ id: x.id, cdt: x.cdt, tooth: x.tooth, estimateCents: x.estimateCents, temporality: x.temporality, reversed: !!x.reversed })),
      tags: s.tags.filter((t) => t.encounterId === id).map((t) => ({ id: t.id, tooth: t.tooth, disposition: t.disposition || null })),
      note: s.notes[id] || null,
      noteFiled: !!(s.encounters.find((e) => e.id === id) || {}).noteFiled,
    };
  }, encId);
  const patientLedger = (p, pid) => p.evaluate((pid) => {
    const s = window.__proto.state();
    return { charges: s.ledger.filter((l) => l.patientId === pid && l.kind === 'charge').map((l) => ({ id: l.id, cdt: l.cdt, tooth: l.tooth, amountCents: l.amountCents, procedureId: l.procedureId, releasedByNoteId: l.releasedByNoteId || null })), balance: Proto.store.balances(pid), claims: s.claims.filter((c) => c.patientId === pid).map((c) => ({ id: c.id, cdt: c.cdt === undefined ? 'undefined' : c.cdt, amountCents: c.amountCents, status: c.status, payer: c.payer })) };
  }, pid);
  // Chart tag-1 (#30 DO) as Composite, Undo it, then paint a crown on #30 and File through the read-back.
  const paintTag = async (p) => { await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); };
  const fileThrough = async (p) => { await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(150); await click(p, 'refusal.control'); await p.waitForTimeout(250); };

  return {
    // store.js:276 chartPaint's duplicate query scans every chartEvents row for the encounter, including the paint Undo
    // already marked reversed (and the reversal row itself), so Undo → same chip is refused as duplicate_paint with the
    // verb "Undo the first one" — the thing the dentist just did. Undo is not undoable by repainting.
    // Negative control: a duplicate query that skips reversed rows and kind 'reversal' lets the repaint write a new live
    // chart event + procedure; `repaint.code` is undefined, liveAfter has one d2392#30 row, and the check reports false.
    async 'S-encounter-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await paintTag(p);
        const painted = await snap(p, 'enc-9002');
        await click(p, 'enc.undo');
        const undone = await snap(p, 'enc-9002');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
        const repaintGate = (await gates(p)).find((g) => g.code === 'duplicate_paint') || null;
        const direct = await p.evaluate(() => { const r = Proto.store.chartPaint('enc-9002', 30, ['d', 'o'], 'd2392', 'today'); return { ok: !!r.ok, code: r.code || null, verb: r.verb || null, control: r.control || null }; });
        const afterS = await snap(p, 'enc-9002');
        const ev = await after(p, seq0);
        const undoWorked = painted.live.length === 1 && undone.live.length === 0 && undone.chartEvents.some((x) => x.kind === 'reversal');
        const reproduced = undoWorked && direct.ok === false && direct.code === 'duplicate_paint' && afterS.live.length === 0;
        rec('S-encounter-1', 'After Undo reverses Composite #30, painting Composite #30 again is refused as duplicate_paint ("Undo the first one") because the duplicate query counts the reversed paint and its reversal row; the visit cannot be re-charted', 'A2, A4 — Undo is reversible and a refusal names a next step that exists; store.js:276 chartPaint `already` does not exclude c.reversed / kind reversal',
          reproduced, { livePaintsBeforeUndo: painted.live, liveAfterUndo: undone.live, chartEventsAfterUndo: undone.chartEvents, repaintGateOnScreen: repaintGate, repaintDirect: direct, liveAfterRepaint: afterS.live, proceduresAfter: afterS.procedures, refusalEvents: ev.filter((e) => e.kind === 'refusal').map((e) => e.code), writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:384 fileNote releases every procedure that is not yet charged, including the one chartUndo marked
    // reversed; store.js:391 takes the claim CDT from the first procedure row, reversed or not. Undo then File bills the
    // undone composite ($260) beside the crown and queues a claim for the undone code.
    // Negative control: a release filter of `!charged(p) && !p.reversed` and a claim built from live procedures leave one
    // $1,180 charge, Patient due 118000, claim cdt d2740, `reversedCharged` empty, and the check reports false.
    async 'S-encounter-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const before = await patientLedger(p, 'p-302');
        await paintTag(p); await click(p, 'enc.undo');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2740');
        const preFile = await snap(p, 'enc-9002');
        const seq0 = await lastSeq(p);
        await fileThrough(p);
        const afterE = await snap(p, 'enc-9002');
        const afterL = await patientLedger(p, 'p-302');
        const filedCard = await p.evaluate(() => ((document.querySelector('.enc-filed') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 400));
        const ev = await after(p, seq0);
        const reversedProc = preFile.procedures.find((x) => x.reversed);
        const reversedCharged = reversedProc ? afterL.charges.filter((l) => l.procedureId === reversedProc.id) : [];
        const newClaim = afterL.claims.slice(before.claims.length);
        const reproduced = afterE.noteFiled && preFile.live.length === 1 && !!reversedProc && reversedCharged.length > 0 && afterL.balance.patientDue - before.balance.patientDue > 118000;
        rec('S-encounter-2', 'Undo Composite #30, paint Crown #30, File: filing releases the reversed composite as a $260 ledger charge beside the $1,180 crown (Patient due +$1,440, not +$1,180) and queues the claim under the undone code d2392', 'A7, C5 — one live paint releases one charge; a reversed procedure never reaches the ledger; store.js:384 release filter ignores p.reversed, store.js:391 claim cdt from S.procedures.find',
          reproduced, { livePaintsAtFile: preFile.live, proceduresAtFile: preFile.procedures, reversedProcedure: reversedProc || null, chargesForReversedProcedure: reversedCharged, chargesAfter: afterL.charges.filter((l) => l.releasedByNoteId), patientDueBefore: before.balance.patientDue, patientDueAfter: afterL.balance.patientDue, expectedDelta: 118000, newClaims: newClaim, filedCardText: filedCard, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:317 chartUndo reopens every tag on the undone tooth that reads 'charted', even when an earlier paint on
    // that tooth still stands. Chart the tag as Composite #30, paint a crown on #30, Undo the crown: the tag returns to
    // "Needs disposition", the File gate demands "Chart or dismiss tag #30", and Chart it → Composite → duplicate_paint.
    // Negative control: Undo reopens the tag only when no live paint remains on its tooth; `tagAfterUndo` stays 'charted',
    // no tag_undispositioned killer renders, and the check reports false.
    async 'S-encounter-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await paintTag(p); await click(p, 'enc.proc.d2740');
        const two = await snap(p, 'enc-9002');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.undo');
        const undone = await snap(p, 'enc-9002');
        const tagChip = await p.evaluate(() => ((document.getElementById('enc-tags') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 200));
        await fill(p, 'enc.note.field.assessment', 'Caries #30 DO confirmed.'); await blur(p);
        const killers = await gates(p);
        const direct = await p.evaluate(() => Proto.store.noteKillers('enc-9002', { assessment: 'Caries #30 DO confirmed.', plan: '' }).map((k) => k.code));
        const ev = await after(p, seq0);
        const tagBefore = two.tags.find((t) => t.id === 'tag-1'); const tagAfter = undone.tags.find((t) => t.id === 'tag-1');
        const reproduced = two.live.length === 2 && tagBefore.disposition === 'charted' && undone.live.includes('d2392#30') && tagAfter.disposition === null && direct.includes('tag_undispositioned');
        rec('S-encounter-3', 'Undo of a second paint on #30 (crown) reopens tag-1 to "Needs disposition" although Composite #30, the paint that dispositioned it, still stands live; the File gate then demands the tag be charted or dismissed', 'A2 — a fix changes the state it names, Undo reverses one paint; store.js:317 chartUndo reopens tags by tooth without checking remaining live paints',
          reproduced, { livePaintsBeforeUndo: two.live, tagBeforeUndo: tagBefore, livePaintsAfterUndo: undone.live, tagAfterUndo: tagAfter, tagRowText: tagChip, killersOnScreen: killers.map((k) => k.code + ' · ' + k.verb), noteKillersDirect: direct, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:357 noteKillers builds `toothed` from every chartEvents row with a tooth, reversed paints and reversal
    // rows included, so a note naming an undone tooth is not a contradiction. Paint #30, Undo, paint #19, write "#30":
    // the S0 wrong-site gate stays silent and File is allowed with note #30 vs chart #19.
    // Negative control: `toothed` limited to live paints raises `contradiction` (note #30, chart #19) both on screen and
    // from noteKillers; `contradictionDirect` is true and the check reports false.
    async 'S-encounter-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.undo');
        await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740');
        const s = await snap(p, 'enc-9002');
        const seq0 = await lastSeq(p);
        // Dismiss the open tag so the gate list is only about the tooth contradiction.
        await p.evaluate(() => Proto.store.dismissTag('tag-1', 'Not present on exam'));
        await fill(p, 'enc.note.field.assessment', 'Fractured cusp #30, no pulpal exposure.'); await fill(p, 'enc.note.field.plan', 'Crown #30; temporized today.'); await blur(p);
        const onScreen = await gates(p);
        const direct = await p.evaluate(() => Proto.store.noteKillers('enc-9002', { assessment: 'Fractured cusp #30, no pulpal exposure.', plan: 'Crown #30; temporized today.' }).map((k) => k.code));
        const control = await p.evaluate(() => Proto.store.noteKillers('enc-9002', { assessment: 'Fractured cusp #14.', plan: '' }).map((k) => k.code));
        const ev = await after(p, seq0);
        const reproduced = s.live.length === 1 && s.live[0] === 'd2740#19' && !direct.includes('contradiction') && control.includes('contradiction') && !onScreen.some((g) => g.code === 'contradiction');
        rec('S-encounter-4', 'With only Crown #19 live (Composite #30 undone), a note that says #30 raises no contradiction killer — the reversed #30 paint still satisfies the tooth check — while the same note saying #14 does', 'docs/13 §wrong-site S0: note, chart and claim must name the same tooth; store.js:357 `toothed` does not exclude reversed / reversal rows',
          reproduced, { livePaints: s.live, chartEvents: s.chartEvents, noteText: 'Fractured cusp #30 … Crown #30', killersOnScreen: onScreen.map((g) => g.code), noteKillersDirect: direct, contradictionDirect: direct.includes('contradiction'), controlNote14: control, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // encounter.js:440 the contradiction fix rewrites every "#nn" in both fields to the first charted tooth. With #30 and
    // #19 both live and the note naming #14 (wrong) and #19 (right), "Use chart tooth" turns #19 into #30 as well: the note
    // now says the crown was on #30 and the gate clears green.
    // Negative control: a fix that rewrites only the tooth the killer named (#14) leaves "#19" in both fields;
    // `rewroteLiveTooth` is false and the check reports false.
    async 'S-encounter-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740');
        const s = await snap(p, 'enc-9002');
        await fill(p, 'enc.note.field.assessment', 'Caries #14; fractured cusp #19.'); await fill(p, 'enc.note.field.plan', 'Composite #14; crown #19.'); await blur(p);
        const beforeFix = await gates(p);
        const idx = await p.evaluate(() => [...document.querySelectorAll('#enc-gate .refusal, .refusal')].findIndex((r) => r.dataset.code === 'contradiction'));
        const seq0 = await lastSeq(p);
        const pressed = idx >= 0 ? await click(p, 'enc.killer.' + idx + '.fix') : false; await p.waitForTimeout(200);
        const note = await noteValues(p);
        const afterFix = await gates(p);
        const ev = await after(p, seq0);
        const rewroteLiveTooth = !!note.assessment && !/#19\b/.test(note.assessment) && !/#19\b/.test(note.plan || '') && (note.assessment.match(/#30\b/g) || []).length === 2;
        const reproduced = pressed && s.live.includes('d2740#19') && s.live.includes('d2392#30') && rewroteLiveTooth && !afterFix.some((g) => g.code === 'contradiction');
        rec('S-encounter-5', '"Use chart tooth" on a note reading "Caries #14; fractured cusp #19" (chart: Composite #30 and Crown #19 live) rewrites both references to #30 — the correct #19 crown reference is destroyed — and the contradiction gate clears', 'A2 — a fix changes the state it names and nothing else; docs/13 §wrong-site: the extractor never guesses; encounter.js:440 fixKiller replaces every #nn with chartTooth',
          reproduced, { livePaints: s.live, noteBeforeFix: { assessment: 'Caries #14; fractured cusp #19.', plan: 'Composite #14; crown #19.' }, killersBeforeFix: beforeFix.map((g) => g.code + ' · ' + g.verb), fixPressed: pressed, noteAfterFix: note, rewroteLiveTooth, killersAfterFix: afterFix.map((g) => g.code), writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // encounter.js:339 starterTooth falls back to the last live paint's tooth, which is null for a whole-patient code
    // (store.js:275 clears tooth for d0120). Paint #30, Exam, Composite #30, Undo, then a starter: the note reads
    // "Caries #null DO …" and the announcement says "for #null".
    // Negative control: a starter that skips tooth-less paints (or falls back to the open tag / '[tooth]') writes no "#null";
    // `nullInNote` is false and the check reports false.
    async 'S-encounter-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d0120'); await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.undo');
        const s = await snap(p, 'enc-9002');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.note.starter.0'); await p.waitForTimeout(150);
        const note = await noteValues(p);
        const live = await p.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent.trim()).filter(Boolean));
        const ev = await after(p, seq0);
        const nullInNote = /#null\b/.test(note.assessment || '') || /#null\b/.test(note.plan || '');
        const reproduced = s.live.length === 1 && s.live[0] === 'd0120#null' && nullInNote;
        rec('S-encounter-6', 'After a whole-patient exam paint (tooth null) is the last live paint, the "Caries confirmed" starter writes "Caries #null DO …" and "Composite #null DO …" into Assessment and Plan', 'C3, B2 — no storage values on the glass, a note never names a tooth that does not exist; encounter.js:339 starterTooth returns the null tooth of the last paint',
          reproduced, { livePaints: s.live, chartEvents: s.chartEvents, noteAfterStarter: note, nullInNote, announcements: live, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:377 the read-back refusal's Why prints "born <full DOB>" regardless of privacy, while the screen's own
    // header (encounter.js:166) and read-back line (encounter.js:398) drop the DOB under privacy. Under ?privacy=1 the
    // gate shows "for TB, born 11/2/1990" on operatory glass.
    // Negative control: a Why built with the same `priv` guard (initials only, no DOB) leaves `dobInGateWhy` false and
    // the check reports false; the check requires __proto.privacy === true when it reads the gate.
    async 'S-encounter-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?privacy=1&device=operatory');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.file'); await p.waitForTimeout(200);
        const read = await p.evaluate(() => {
          const s = window.__proto.state(); const pat = s.patients.find((x) => x.id === 'p-302');
          const gate = document.querySelector('.refusal[data-code="readback"]');
          const canvas = (document.getElementById('canvas') || {}).textContent || '';
          const dobLong = Proto.ui.longDate(pat.dob);
          const gateText = gate ? gate.textContent.replace(/\s+/g, ' ') : null;
          const canvasSansGate = gate ? canvas.replace(gate.textContent, '') : canvas;
          return { privacy: window.__proto.privacy, device: window.__proto.device, dob: pat.dob, dobLong, fullName: pat.name, gateCode: gate ? gate.dataset.code : null, gateText, dobInGateWhy: !!gateText && gateText.includes(dobLong), fullNameInGate: !!gateText && gateText.includes(pat.name), dobElsewhereOnCanvas: canvasSansGate.includes(dobLong), headerText: ((document.querySelector('.enc-page h1, .enc-page h2, header h1') || {}).textContent || '').trim() };
        });
        const ev = await after(p, seq0);
        const reproduced = read.privacy === true && read.gateCode === 'readback' && read.dobInGateWhy && !read.dobElsewhereOnCanvas;
        rec('S-encounter-7', 'Under privacy=1 on an operatory device the read-back gate\'s Why prints the patient\'s full date of birth ("for TB, born 11/2/1990") while the encounter header and the screen\'s own read-back line hide the DOB', 'B8, docs/04 §privacy: "covers … any gate copy"; docs/15: "privacy mode leaks nothing"; store.js:377 fileNote appends longDate(who.dob) without the privacy guard used at encounter.js:166/398',
          reproduced, { privacy: read.privacy, device: read.device, gateCode: read.gateCode, gateText: read.gateText, dobLong: read.dobLong, dobInGateWhy: read.dobInGateWhy, fullNameInGate: read.fullNameInGate, dobElsewhereOnCanvas: read.dobElsewhereOnCanvas, refusalEvents: ev.filter((e) => e.kind === 'refusal').map((e) => e.code), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:289 chartPaint writes a planItems row with a patient estimate for every temporality, including Existing
    // ("history, no charge, no claim"), and encounter.js:300 renders it as a Plan card. One transaction card says
    // "Procedure none: Existing is history, no charge, no claim" and, three lines down, "You'd owe about $590.00".
    // Negative control: no planItems row (or a $0 estimate) for temporality 'existing' → `oweOnCard` is null, the plan row
    // list is empty, and the check reports false.
    async 'S-encounter-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.tooth.19'); await click(p, 'enc.temporality.existing'); await click(p, 'enc.proc.d2740'); await p.waitForTimeout(150);
        const s = await snap(p, 'enc-9002');
        const card = await p.evaluate(() => {
          const c = document.querySelector('.enc-tx'); if (!c) return null;
          const text = c.textContent.replace(/\s+/g, ' ');
          const nums = [...c.querySelectorAll('.threenum .n')].map((n) => ({ v: n.querySelector('.v').textContent.trim(), l: n.querySelector('.l').textContent.trim() }));
          return { text: text.slice(0, 500), saysNoCharge: /no charge, no claim/.test(text), planCard: !!c.querySelector('[aria-label="Plan card"]'), numbers: nums, owe: (nums.find((n) => /owe/i.test(n.l)) || {}).v || null };
        });
        const ev = await after(p, seq0);
        const existingPlan = s.planItems.filter((x) => x.temporality === 'existing');
        const reproduced = !!card && card.saysNoCharge && card.planCard && existingPlan.length > 0 && existingPlan[0].estimateCents > 0 && !!card.owe && card.owe !== '$0.00';
        rec('S-encounter-8', 'An Existing (placed elsewhere) crown on #19 writes a plan item with a $590 patient estimate and its transaction card shows "You\'d owe about $590.00" beside "Procedure none: Existing is history, no charge, no claim"', 'A7, C5 — two surfaces on one card disagree on a number; docs/13 temporality: Existing is history; store.js:289 plan row written for every temporality, encounter.js:300 renders it',
          reproduced, { procedures: s.procedures, planItems: s.planItems, existingPlanRows: existingPlan, cardText: card && card.text, cardNumbers: card && card.numbers, oweOnCard: card && card.owe, saysNoCharge: card && card.saysNoCharge, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:391 fileNote writes a claim unconditionally. A visit whose only paints are Planned and Existing has no
    // procedure row: the claim goes out with cdt undefined and $0, and the filed card says "Charges released: 0 (nothing
    // pending)" and "Claim queued · c-100 to Cigna" in consecutive lines.
    // Negative control: no claim written when the visit released no procedure; `claimsWritten` is empty and the check
    // reports false.
    async 'S-encounter-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const before = await patientLedger(p, 'p-302');
        await click(p, 'enc.tooth.3'); await click(p, 'enc.temporality.planned'); await click(p, 'enc.proc.d2392');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.temporality.existing'); await click(p, 'enc.proc.d2392');
        const preFile = await snap(p, 'enc-9002');
        const seq0 = await lastSeq(p);
        await fileThrough(p);
        const afterE = await snap(p, 'enc-9002');
        const afterL = await patientLedger(p, 'p-302');
        const card = await p.evaluate(() => ((document.querySelector('.enc-filed') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 400));
        const ev = await after(p, seq0);
        const claimsWritten = afterL.claims.slice(before.claims.length);
        const reproduced = afterE.noteFiled && preFile.procedures.length === 0 && afterL.charges.length === before.charges.length && claimsWritten.length > 0 && /Claim queued/.test(card) && /Charges released: 0/.test(card);
        rec('S-encounter-9', 'Filing a visit whose paints are only Planned and Existing (zero procedures, zero charges) still queues an insurance claim with cdt undefined and $0, and the filed card prints "Charges released: 0 (nothing pending)" and "Claim queued · c-100 to Cigna" together', 'A7, C5 — no claim for a visit that performed nothing; two lines of one card disagree; store.js:391 fileNote writes claims regardless of `release`',
          reproduced, { livePaintsAtFile: preFile.live, proceduresAtFile: preFile.procedures, chargesBefore: before.charges.length, chargesAfter: afterL.charges.length, claimsWritten, filedCardText: card, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:270 chartPaint has no exam_sealed guard (chartUndo and fileNote both have one). After File, a direct
    // chartPaint on the sealed encounter writes a chart event, a pending-charge procedure and a plan item the frozen note
    // never mentions; Checkout then charges it ($1,180) with releasedByNoteId null.
    // Negative control: chartPaint on enc.noteFiled returns {ok:false, code:'exam_sealed'} and writes nothing; `paint.ok`
    // is false, `uncoveredCharges` is empty and the check reports false.
    async 'S-encounter-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.proc.d2392'); await fileThrough(p);
        const filed = await snap(p, 'enc-9002');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const paint = Proto.store.chartPaint('enc-9002', 5, ['o'], 'd2740', 'today');
          const undo = Proto.store.chartUndo('enc-9002');
          const s = window.__proto.state(); const a = s.appointments.find((x) => x.encounterId === 'enc-9002');
          const post = Proto.store.postCheckout(a.id, { decision: 'send_statement' });
          return { paint: { ok: !!paint.ok, code: paint.code || null, procedure: paint.procedure ? { id: paint.procedure.id, cdt: paint.procedure.cdt, feeCents: paint.procedure.feeCents, status: paint.procedure.status } : null }, undo: { ok: !!undo.ok, code: undo.code || null }, appointment: a.id, post: { ok: !!post.ok, code: post.code || null } };
        });
        const afterE = await snap(p, 'enc-9002');
        const afterL = await patientLedger(p, 'p-302');
        const ev = await after(p, seq0);
        const uncoveredCharges = afterL.charges.filter((l) => !l.releasedByNoteId && afterE.procedures.some((x) => x.id === l.procedureId));
        const reproduced = filed.noteFiled && r.paint.ok === true && r.undo.ok === false && uncoveredCharges.length > 0;
        rec('S-encounter-10', 'After File seals enc-9002, Proto.store.chartPaint still accepts a crown on #5 (chartUndo and fileNote refuse with exam_sealed) and Checkout charges the $1,180 the frozen note never mentions, with releasedByNoteId null', 'A4, C5 — a sealed exam refuses every mutation the same way; a charge is released only by the note that covers it; store.js:270 chartPaint never checks enc.noteFiled',
          reproduced, { noteFiledBeforePaint: filed.noteFiled, paintAfterSeal: r.paint, undoAfterSeal: r.undo, appointment: r.appointment, checkout: r.post, proceduresAfter: afterE.procedures, chargesAfter: afterL.charges, uncoveredCharges, patientDue: afterL.balance.patientDue, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // store.js:270-291 chartPaint validates the CDT code and nothing else. A string `surfaces` throws TypeError at :291
    // (surfaces.join) after chartEvents, procedures and planItems were already written — the "one gesture, one
    // transaction" promise breaks half-way; tooth 99 / -1 / NaN and temporality 'yesterday' are accepted and written.
    // Negative control: a validating chartPaint returns {ok:false} for each and writes nothing: `threw` false, the three
    // counts unchanged, `tooth99.ok`/`badTemporality.ok` false, and the check reports false.
    async 'S-encounter-11'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate(() => {
          const cnt = () => { const s = window.__proto.state(); const f = (t) => s[t].filter((x) => x.encounterId === 'enc-9002').length; return { chartEvents: f('chartEvents'), procedures: f('procedures'), planItems: f('planItems') }; };
          const out = { before: cnt() };
          try { out.stringSurfaces = Proto.store.chartPaint('enc-9002', 3, 'mod', 'd2392', 'today'); out.threw = null; } catch (e) { out.threw = e.message; }
          out.afterString = cnt();
          const s = window.__proto.state();
          out.rowsWritten = { chartEvent: s.chartEvents.filter((x) => x.encounterId === 'enc-9002' && x.tooth === 3).map((x) => ({ id: x.id, surfaces: x.surfaces })), procedure: s.procedures.filter((x) => x.encounterId === 'enc-9002' && x.tooth === 3).map((x) => ({ id: x.id, surfaces: x.surfaces, status: x.status, feeCents: x.feeCents })), noteLines: (s.notes['enc-9002'] || {}).procedures || [] };
          const slim = (x) => ({ ok: !!x.ok, code: x.code || null, tooth: x.chartEvent ? x.chartEvent.tooth : undefined, procedure: x.procedure ? x.procedure.id : null, temporality: x.chartEvent ? x.chartEvent.temporality : undefined });
          out.tooth99 = slim(Proto.store.chartPaint('enc-9002', 99, ['o'], 'd2740', 'today'));
          out.toothNeg = slim(Proto.store.chartPaint('enc-9002', -1, ['o'], 'd2391', 'today'));
          out.badTemporality = slim(Proto.store.chartPaint('enc-9002', 19, ['o'], 'd2392', 'yesterday'));
          out.after = cnt();
          return out;
        });
        const ev = await after(p, seq0);
        const partial = r.threw && (r.afterString.chartEvents > r.before.chartEvents || r.afterString.procedures > r.before.procedures);
        const reproduced = !!partial || r.tooth99.ok === true || r.badTemporality.ok === true;
        rec('S-encounter-11', 'chartPaint with surfaces "mod" throws TypeError (surfaces.join) after writing the chart event, the $260 procedure and the plan item — a half-committed transaction with no note line — and accepts tooth 99, tooth -1 and temporality "yesterday" as written rows', 'A7, C5 — one gesture is one transaction or nothing; a verb refuses input it cannot chart; store.js:270-291 chartPaint validates only the CDT code',
          reproduced, { threw: r.threw, countsBefore: r.before, countsAfterStringSurfaces: r.afterString, rowsWrittenBeforeThrow: r.rowsWritten, tooth99: r.tooth99, toothNegative: r.toothNeg, badTemporality: r.badTemporality, countsAfterAll: r.after, pageErrors: errs, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
