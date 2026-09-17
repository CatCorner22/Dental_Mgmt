// Swarm 2 hunt, lens "perio-encounter-lineage": prototype/js/screens/perio.js + store.savePerio, screens/encounter.js +
// store.noteKillers/fileNote, screens/rail.js recallLine. Sequences the round-1 checks did not drive: Save on a visit whose
// note is already filed, a leading "0" carried across Save and into the addendum, a screening addendum on top of a full
// chart, "Use chart tooth" measured after File (where the killers now render), and the rail's recall beside the card's.
// Default position is NOT reproduced: every check drives the UI, measures the breach and carries the values.
// Each check closes its browser context in `finally`.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq).map((e) => ({ seq: e.seq, kind: e.kind, key: e.key, testid: e.testid, table: e.table, id: e.id, code: e.code }));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const typeDigits = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(250); };
  const fill = async (p, tid, v) => { await p.fill(`[data-testid="${tid}"]`, v); await p.waitForTimeout(60); };
  // Screen-local perio state through the exported stateFor (perio.js:455).
  const ST = (p, encId) => p.evaluate((id) => {
    const e = Proto.store.encounter(id); const st = Proto.screens.perio.stateFor(e); const last = st.path[st.cur - 1] || null;
    return { mode: st.mode, cur: st.cur, pendingZero: st.pendingZero, lastKey: st.lastKey, saved: st.saved ? st.saved.id : null, amending: !!st.amending, gate: st.gate ? st.gate.code : null,
      lastSite: last, lastDepth: last && st.sites[last] ? st.sites[last].depth : null, probed: Object.values(st.sites).filter((v) => v.depth != null).length };
  }, encId);
  const EXAMS = (p, encId) => p.evaluate((id) => window.__proto.state().perioExams.filter((e) => e.encounterId === id).map((e) => ({ id: e.id, kind: e.kind, amendsExamId: e.amendsExamId, mode: e.mode, probed: e.probed, skipped: e.skipped, deepest: e.deepest, bleeding: e.bleeding, licence: e.licence, codes: e.sextantCodes || null })), encId);
  const NOTE = (p, encId) => p.evaluate((id) => window.__proto.state().notes[id] || null, encId);
  const GATES = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas .refusal, #canvas [data-code]')].filter((r) => r.dataset.code).map((r) => ({ code: r.dataset.code, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null, control: ((r.querySelector('[data-testid="refusal.control"], [data-testid$=".fix"]') || {}).textContent || '').trim() || null })));
  const ACTIVE = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });
  const CARD = (p) => p.evaluate(() => [...document.querySelectorAll('.pe-saved p, .pe-saved .chip, .pe-saved h2')].map((e) => e.textContent.trim()));
  const NOTEVALUES = (p) => p.evaluate(() => ({ assessment: (document.querySelector('[data-testid="enc.note.field.assessment"]') || {}).value || null, plan: (document.querySelector('[data-testid="enc.note.field.plan"]') || {}).value || null }));
  const LIVE = (p, encId) => p.evaluate((id) => window.__proto.state().chartEvents.filter((c) => c.encounterId === id && !c.reversed && c.kind !== 'reversal').map((c) => c.cdt + '#' + c.tooth), encId);

  return {
    // S2-perio-encounter-lineage-1 · A2/B10, CONTRACTS §6 (a control does what its label says) · perio.js:261 maps every
    // exam_sealed refusal onto the screen's own amend gate, so the store's "Add an addendum to the filed note / Open the
    // note" (store.js:459, enc.noteFiled) is replaced by "Amend the saved exam with an addendum / Start an addendum";
    // the control only clears the local gate, Save repeats it, and no addendum path exists on a filed visit.
    // Negative control: once the screen surfaces the store's verb/control (and "Open the note" routes to the encounter),
    // `gate1.verb` reads "Add an addendum to the filed note" or `hashAfterControl` leaves the perio route; the check reports false.
    async 'S2-perio-encounter-lineage-1'(b) {
      const { c, p } = await ctx(b);
      try {
        const ENC = 'enc-9004'; await go(p, '#/hygienist/perio/' + ENC);
        const noteFiled = await p.evaluate((id) => !!Proto.store.encounter(id).noteFiled, ENC);
        const storeSays = await p.evaluate((id) => { const s = Proto.store.savePerio(id, { 't3-s1': { depth: 3, bleed: false, sup: false, skipped: false } }, { mode: 'full' }); return { ok: s.ok, code: s.code, verb: s.verb, control: s.control }; }, ENC);
        const seq0 = await lastSeq(p);
        await typeDigits(p, '3'.repeat(168));
        await press(p, 'perio.save'); const gate1 = (await GATES(p))[0] || null; const focus1 = await ACTIVE(p);
        await press(p, 'refusal.control'); await p.waitForTimeout(150);
        const afterControl = { gates: await GATES(p), hash: await p.evaluate(() => location.hash), focus: await ACTIVE(p), st: await ST(p, ENC) };
        await press(p, 'perio.save'); const gate2 = (await GATES(p))[0] || null;
        await press(p, 'refusal.control'); await press(p, 'perio.save'); const gate3 = (await GATES(p))[0] || null;
        const exams = await EXAMS(p, ENC); const ev = await after(p, seq0);
        const reproduced = noteFiled && storeSays.code === 'exam_sealed' && storeSays.control === 'Open the note'
          && !!gate1 && gate1.code === 'exam_sealed' && gate1.control === 'Start an addendum' && gate1.verb !== storeSays.verb
          && afterControl.hash === '#/hygienist/perio/' + ENC && afterControl.gates.length === 0 && afterControl.st.amending === true
          && !!gate2 && gate2.control === 'Start an addendum' && !!gate3 && gate3.control === 'Start an addendum'
          && exams.length === 0 && !ev.some((e) => e.kind === 'write' && e.table === 'perioExams');
        rec('S2-perio-encounter-lineage-1', 'On a visit whose note is filed (enc-9004) the store refuses Save with "Add an addendum to the filed note / Open the note", but the perio screen shows "Amend the saved exam with an addendum / Start an addendum" instead; the control clears the gate and sets amending, the next Save shows the same gate, and the loop never reaches the note or writes an exam', 'CONTRACTS §6 (the control does what it names); store.js:459 exam_sealed verb vs perio.js:261 openAmendGate substituted for every exam_sealed',
          reproduced, { noteFiled, storeSays, gate1, focusAfterSave: focus1, afterControl, gate2, gate3, perioExamsRows: exams.length, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S2-perio-encounter-lineage-2 · A2/C-clinical · perio.js:143 sets pendingZero on a leading "0"; doSave (perio.js:265)
    // and the amend control (perio.js:133) never clear it, so the "0" typed before Save is still pending when the addendum
    // opens and its first digit "3" records 13 mm: the addendum row reads deepest 13 and the note gains SRP evidence.
    // Negative control: once Save/amend reset pendingZero, `afterThree.lastDepth` is 3, the addendum's deepest is 3 and
    // srpEvidence stays null; the check reports false.
    async 'S2-perio-encounter-lineage-2'(b) {
      const { c, p } = await ctx(b);
      try {
        const ENC = 'enc-9001'; await go(p, '#/hygienist/perio/' + ENC);
        await typeDigits(p, '3'.repeat(167)); await typeDigits(p, '0');
        const afterZero = await ST(p, ENC);
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save'); const saveGate = (await GATES(p))[0] || null;
        await click(p, 'perio.licence.not_tolerated'); await click(p, 'perio.licence.confirm');
        const afterSave = await ST(p, ENC); const examsAfterSave = await EXAMS(p, ENC);
        await click(p, 'perio.amend'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const afterAmend = await ST(p, ENC); const focusAfterAmend = await ACTIVE(p);
        await typeDigits(p, '3');
        const afterThree = await ST(p, ENC);
        await press(p, 'perio.save');
        const exams = await EXAMS(p, ENC); const note = await NOTE(p, ENC); const card = await CARD(p); const ev = await after(p, seq0);
        const addendum = exams.find((e) => e.kind === 'addendum') || null;
        const reproduced = afterZero.pendingZero === true && afterSave.saved === 'pe-2' && afterSave.pendingZero === true && examsAfterSave.length === 1 && examsAfterSave[0].deepest === 3
          && afterAmend.amending === true && afterAmend.pendingZero === true && afterThree.lastDepth === 13 && /13 mm/.test((afterThree.lastKey || {}).meaning || '')
          && !!addendum && addendum.deepest === 13 && addendum.probed === 168 && !!note && /deepest 13 mm/.test(note.perioSummary || '') && /SRP evidence/.test(note.srpEvidence || '');
        rec('S2-perio-encounter-lineage-2', 'A leading "0" typed before Save stays pending through the omission-licence Save and through "Start an addendum": the addendum\'s first key "3" records 13 mm at tooth 31 site 6, the addendum row reads deepest 13 mm and the hygiene note gains "SRP evidence: 1 site at or above 5 mm" for a 3 mm pocket', 'A2/C — the saved number equals the typed number; perio.js:143 pendingZero, not reset by doSave (perio.js:265) or the amend control (perio.js:133)',
          reproduced, { afterZero, saveGate, afterSave, examsAfterSave, afterAmend, focusAfterAmend, afterThree, exams, note, card, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S2-perio-encounter-lineage-3 · A5 (two surfaces agree) · store.js:491-492 lets a screening addendum stand on top of
    // a full 168-site chart saved on the same visit: the note's perio line is replaced by the screening sentence and
    // srpEvidence now says a full six-point chart is indicated, while perioExams holds that full chart (pe-2, mode full).
    // Negative control: once a screening addendum is refused on a full-chart visit (or the note keeps the full-chart line
    // and does not demand a chart that exists), `exams` has no screening addendum or `note.srpEvidence` does not say
    // "indicates a full six-point chart"; the check reports false.
    async 'S2-perio-encounter-lineage-3'(b) {
      const { c, p } = await ctx(b);
      try {
        const ENC = 'enc-9001'; await go(p, '#/hygienist/perio/' + ENC);
        await typeDigits(p, '3'.repeat(168)); await press(p, 'perio.save');
        const noteAfterFull = await NOTE(p, ENC); const examsAfterFull = await EXAMS(p, ENC);
        const seq0 = await lastSeq(p);
        await click(p, 'perio.amend'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        await click(p, 'perio.screening'); await p.waitForTimeout(150);
        const modeAfter = (await ST(p, ENC)).mode;
        await p.focus('[data-testid="perio.sextant.1"]').catch(() => {}); await typeDigits(p, '444444');
        await press(p, 'perio.save');
        const exams = await EXAMS(p, ENC); const note = await NOTE(p, ENC); const card = await CARD(p); const ev = await after(p, seq0);
        const full = exams.find((e) => e.mode === 'full' && e.kind === 'exam') || null; const scr = exams.find((e) => e.mode === 'screening' && e.kind === 'addendum') || null;
        const reproduced = examsAfterFull.length === 1 && !!noteAfterFull && /^Perio: 168 sites probed/.test(noteAfterFull.perioSummary || '') && noteAfterFull.srpEvidence === null
          && modeAfter === 'screening' && !!full && full.probed === 168 && !!scr && scr.amendsExamId === full.id
          && !!note && /indicates a full six-point chart/.test(note.srpEvidence || '') && !/168 sites/.test(note.perioSummary || '') && /^Perio screening addendum/.test(note.perioSummary || '');
        rec('S2-perio-encounter-lineage-3', 'After a full 168-site chart is saved, an addendum in the screening lane (codes 4 x6) is accepted and the hygiene note drops the full-chart line and reads "Screening code 4 indicates a full six-point chart before periodontal therapy" — demanding the chart that stands in perioExams (pe-2, mode full, 168 probed) on this same visit', 'A5 — the note and the exam rows agree on what was charted; store.js:481-492 accepts a screening addendum to a full exam and overwrites perioSummary/srpEvidence from the latest lane only',
          reproduced, { noteAfterFull, examsAfterFull, modeAfter, exams, note, card, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S2-perio-encounter-lineage-4 · A5 (two surfaces agree on a status) · rail.js:125 returns "Perio charted today; next
    // full chart in 12 months" for any exam dated today, without reading mode or codes; the perio card (perio.js:272) and
    // the Chairs card say "Full chart due" for the same code-4 screening.
    // Negative control: once recallLine reads the exam's mode/codes, `rail` reads "Full chart due" (or names the next
    // hygiene visit) and the check reports false.
    async 'S2-perio-encounter-lineage-4'(b) {
      const { c, p } = await ctx(b);
      try {
        const ENC = 'enc-9001'; await go(p, '#/hygienist/perio/' + ENC);
        await click(p, 'perio.screening'); await p.waitForTimeout(150);
        await p.focus('[data-testid="perio.sextant.1"]').catch(() => {}); await typeDigits(p, '444444');
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const exams = await EXAMS(p, ENC); const card = await CARD(p);
        const cardRecall = card.find((t) => /Full chart due|6-month recall|perio maintenance/.test(t)) || null;
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const chairs = await p.evaluate(() => { const el = document.querySelector('[data-testid="chairs.card.a-1042"]'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; });
        await click(p, 'chairs.card.a-1042.rail'); await p.waitForTimeout(200);
        const rail = await p.evaluate(() => { const el = document.getElementById('rail') || document.querySelector('.rail, [data-testid="rail"]'); const t = el ? el.textContent : document.body.textContent; const m = t.match(/Perio charted today[^.]*|Perio due[^.]*|Full chart due[^.]*/); return m ? m[0].trim() : null; });
        const ev = await after(p, seq0);
        const reproduced = exams.length === 1 && exams[0].mode === 'screening' && Array.isArray(exams[0].codes) && exams[0].codes.length === 6 && exams[0].codes.every((k) => k === '4') && !!cardRecall && /Full chart due/.test(cardRecall)
          && !!chairs && /Full chart due/.test(chairs) && !!rail && /next full chart in 12 months/.test(rail);
        rec('S2-perio-encounter-lineage-4', 'After a screening with code 4 in all six sextants the perio card and the Chairs card read "Full chart due" while the patient rail reads "Perio charted today; next full chart in 12 months" — two surfaces disagree on the recall status', 'A5 — one status per patient; rail.js:125 recallLine keys off the exam date only, perio.js:272 recallLine keys off codes 3/4',
          reproduced, { exams, card, cardRecall, chairs, rail, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S2-perio-encounter-lineage-5 · A2, docs/13 §wrong-site · store.js:670 names the first live tooth as the chart tooth
    // and encounter.js:659 rewrites every "#nn" that differs from it. Killers render only after File (encounter.js:312
    // x.checked), which is where round-1 S-encounter-5 stopped measuring (it pressed no fix). With Composite #30 and Crown
    // #19 live and the note reading "#14 ... #19", "Use chart tooth" turns the correct #19 into #30, the gate clears,
    // the note files as "crown #30" and the claim bills the crown on #19.
    // Negative control: once the fix rewrites only the wrong tooth (#14), `noteAfterFix.plan` still contains "#19", the
    // filed markdown names the crown on #19 and the check reports false.
    async 'S2-perio-encounter-lineage-5'(b) {
      const { c, p } = await ctx(b);
      try {
        const ENC = 'enc-9002'; await go(p, '#/dentist/encounter/' + ENC);
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740');
        const live = await LIVE(p, ENC);
        await fill(p, 'enc.note.field.assessment', 'Caries #14; fractured cusp #19.'); await fill(p, 'enc.note.field.plan', 'Composite #14; crown #19.');
        const killersBeforeFile = await GATES(p);
        const seq0 = await lastSeq(p);
        await click(p, 'enc.file'); await p.waitForTimeout(200);
        const killersAfterFile = await GATES(p);
        const fixId = await p.evaluate(() => { const r = [...document.querySelectorAll('#canvas .refusal')].find((x) => x.dataset.code === 'contradiction'); const b = r && r.querySelector('[data-testid$=".fix"]'); return b ? b.dataset.testid : null; });
        const pressed = fixId ? await click(p, fixId) : false; await p.waitForTimeout(200);
        const noteAfterFix = await NOTEVALUES(p); const gatesAfterFix = await GATES(p);
        await click(p, 'enc.file'); await p.waitForTimeout(200); const readback = await GATES(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const filed = await p.evaluate((id) => window.__proto.state().filedNotes.filter((f) => f.encounterId === id).map((f) => f.markdown), ENC);
        const claimLines = await p.evaluate((id) => window.__proto.state().claims.filter((k) => k.encounterId === id).flatMap((k) => (k.lineItems || []).map((l) => l.cdt + '#' + l.tooth)), ENC);
        const ev = await after(p, seq0);
        const rewroteLiveTooth = !!noteAfterFix.plan && !/#19\b/.test(noteAfterFix.assessment || '') && !/#19\b/.test(noteAfterFix.plan) && (noteAfterFix.plan.match(/#30\b/g) || []).length === 2;
        const reproduced = live.includes('d2392#30') && live.includes('d2740#19') && !killersBeforeFile.some((g) => g.code === 'contradiction')
          && killersAfterFile.some((g) => g.code === 'contradiction' && g.control === 'Use chart tooth') && pressed && rewroteLiveTooth && !gatesAfterFix.some((g) => g.code === 'contradiction')
          && readback.some((g) => g.code === 'readback') && filed.length === 1 && /crown #30/.test(filed[0]) && /Crown[^\n]*#19/.test(filed[0]) && claimLines.includes('d2740#19');
        rec('S2-perio-encounter-lineage-5', 'With Composite #30 and Crown #19 live and the note reading "Caries #14; fractured cusp #19 / Composite #14; crown #19", "Use chart tooth" (offered only after File) rewrites both #14 and the correct #19 to #30, the contradiction gate clears, the note files reading "crown #30" beside its own procedure line "Crown ... #19" and the claim bills d2740 on #19 — the round-1 check S-encounter-5 read the killers before File and reports "no" while this stands', 'A2 — a fix changes the state it names and nothing else; docs/13 §wrong-site; store.js:670 toothed[0] as chart tooth, encounter.js:659 rewrites every #nn != chartTooth',
          reproduced, { livePaints: live, killersBeforeFile: killersBeforeFile.map((g) => g.code), killersAfterFile, fixPressed: pressed, noteAfterFix, rewroteLiveTooth, gatesAfterFix: gatesAfterFix.map((g) => g.code), readback: readback.map((g) => g.code), filedMarkdown: filed, claimLines, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
