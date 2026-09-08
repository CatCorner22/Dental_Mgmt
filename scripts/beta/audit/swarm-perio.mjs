// Swarm hunt, lens "perio": prototype/js/screens/perio.js and store.savePerio (store.js:237-263).
// Default position is NOT reproduced: every check drives the grammar, measures the breach and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
// Verified (swarm/verified-perio): all 14 reproduced by an independent probe, and each flipped to "no" under a local
// patch of the named defect (negative control), with the patch reverted before commit.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const ENC = 'enc-9001'; const ROUTE = '#/hygienist/perio/enc-9001';
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  // Every event after seq0, slimmed to the fields the claim relies on (key events included so the range is never empty).
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq).map((e) => ({ seq: e.seq, kind: e.kind, key: e.key, testid: e.testid, table: e.table, id: e.id, code: e.code, hash: e.hash }));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const keys = async (p, ks, wait = 60) => { for (const k of ks) { await p.keyboard.press(k === ' ' ? 'Space' : k); if (wait) await p.waitForTimeout(wait); } await p.waitForTimeout(150); };
  const typeDigits = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(250); };
  // Screen-local chart state, read through the exported stateFor (perio.js:455).
  const ST = (p) => p.evaluate((encId) => {
    const e = Proto.store.encounter(encId); const st = Proto.screens.perio.stateFor(e);
    return { mode: st.mode, cur: st.cur, curKey: st.path[st.cur] || null, pathLen: st.path.length, sextants: st.sextants.slice(), scur: st.scur, pendingZero: st.pendingZero, last: st.last, lastKey: st.lastKey,
      gate: st.gate ? st.gate.code : null, licenceOpen: st.licenceOpen, tagOpen: st.tagOpen, saved: st.saved ? st.saved.id : null, amending: !!st.amending,
      bleedMarks: Object.values(st.sites).filter((v) => v.bleed).length, probed: Object.values(st.sites).filter((v) => v.depth != null).length, keystrokes: st.keystrokes };
  }, ENC);
  const EXAMS = (p) => p.evaluate((encId) => window.__proto.state().perioExams.filter((e) => e.encounterId === encId).map((e) => ({ id: e.id, kind: e.kind, amendsExamId: e.amendsExamId, mode: e.mode, probed: e.probed, skipped: e.skipped, bleeding: e.bleeding, deepest: e.deepest, licence: e.licence, sextantCodes: e.sextantCodes })), ENC);
  const NOTE = (p) => p.evaluate((encId) => window.__proto.state().notes[encId] || null, ENC);
  const GATES = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas .refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || r.querySelector('.verb')) || {}).textContent || null, control: (r.querySelector('[data-testid="refusal.control"]') || {}).textContent || null, text: r.textContent.replace(/\s+/g, ' ').trim() })));
  const SAVE = (p) => p.evaluate(() => { const b = document.querySelector('[data-testid="perio.save"]') || document.querySelector('[data-testid="perio.amend"]'); return b ? { testid: b.getAttribute('data-testid'), text: b.textContent.trim(), ariaLabel: b.getAttribute('aria-label') } : null; });
  const ACTIVE = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });
  const CELL = (p, key) => p.evaluate((k) => { const b = document.querySelector('[data-testid="perio.grid.cell.' + k + '"]'); return b ? { text: b.textContent.trim(), classes: b.className, description: b.getAttribute('aria-description') } : null; }, key);
  const ACTIVESITE = (p) => p.evaluate(() => { const a = document.querySelector('.activesite'); return a ? { line: (a.children[0] || {}).textContent || null, count: (a.querySelector('.pe-count') || {}).textContent || null } : null; });
  const CARD = (p) => p.evaluate(() => [...document.querySelectorAll('.pe-saved p')].map((e) => e.textContent.trim()));

  return {
    // S-perio-1 · A2/B10 · perio.js:180 mkGate gives the outage gate a no-op control and perio.js:405-406 clears only
    // licence_scope and screening_incomplete when their condition ends; the outage gate outlives the outage.
    // Negative control: once the gate clears with the outage (or Save re-tries), the Save after outage=false writes a
    // perioExams row, `save.text` reads "Save exam" and examsAfter.length > 0, so the check reports false.
    async 'S-perio-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE); await typeDigits(p, '3'.repeat(168));
        await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const duringOutage = { gates: await GATES(p), save: await SAVE(p), outage: await p.evaluate(() => window.__proto.outage) };
        await p.evaluate(() => window.__proto.set({ outage: false })); await p.waitForTimeout(200);
        const afterClear = { gates: await GATES(p), save: await SAVE(p), outage: await p.evaluate(() => window.__proto.outage) };
        await press(p, 'perio.save'); const focusAfterSave = await ACTIVE(p);
        await press(p, 'refusal.control'); const afterControl = { gates: await GATES(p), save: await SAVE(p), focus: await ACTIVE(p) };
        await hop(p, '#/hygienist/chairs'); await hop(p, ROUTE); await p.waitForTimeout(200);
        const afterRoundTrip = { gates: await GATES(p), save: await SAVE(p), stGate: (await ST(p)).gate };
        const exams = await EXAMS(p); const ev = await after(p, seq0);
        const reproduced = duringOutage.gates.some((g) => g.code === 'outage') && afterClear.outage === false
          && afterClear.gates.some((g) => g.code === 'outage') && !!afterClear.save && afterClear.save.text === 'Held'
          && !!afterControl.save && afterControl.save.text === 'Held' && afterRoundTrip.stGate === 'outage'
          && exams.length === 0 && !ev.some((e) => e.kind === 'write' && e.table === 'perioExams');
        rec('S-perio-1', 'After one outage refusal Save reads Held for good: clearing the outage, pressing Held, pressing the gate control ("Support line", a no-op) and leaving and re-entering the route all keep the outage gate, and the finished 168-site chart can never be saved', 'A2, B10 (CHECKLIST); perio.js:180 mkGate default onControl () => {}; perio.js:405-406 only re-evaluate licence_scope and screening_incomplete',
          reproduced, { duringOutage, afterClear, focusAfterPressingHeld: focusAfterSave, afterControl, afterRoundTrip, perioExamsRows: exams.length, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-2 · A2/C5 · store.js:260 sets notes.srpEvidence only when deepest >= 5 and never clears it, so an addendum
    // that corrects every pocket below 5 mm leaves "SRP evidence: 2 sites at or above 5 mm" beside "deepest 3 mm".
    // Negative control: when savePerio rewrites or deletes srpEvidence per save, the addendum note carries no
    // srpEvidence (or one that says 0 sites), the card shows one summary line, and the check reports false.
    async 'S-perio-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE);
        const d = '3'.repeat(168).split(''); d[10] = '8'; d[11] = '6';
        await typeDigits(p, d.join('')); await press(p, 'perio.save');
        const first = { exam: (await EXAMS(p)).pop() || null, note: await NOTE(p) };
        await press(p, 'perio.amend'); await press(p, 'refusal.control'); await p.waitForTimeout(100);
        // Re-enter the two deep sites (path index 10 and 11 = tooth 5 sites 2 and 3) as 3 mm: a cell tap moves the cursor.
        await click(p, 'perio.grid.cell.t5-s2'); await keys(p, ['3', '3']);
        const reprobed = { t5s2: await CELL(p, 't5-s2'), t5s3: await CELL(p, 't5-s3') };
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const second = { exam: (await EXAMS(p)).pop() || null, note: await NOTE(p), card: await CARD(p) };
        const ev = await after(p, seq0);
        const reproduced = !!first.exam && first.exam.deepest === 8 && /SRP evidence: 2 sites/.test((first.note || {}).srpEvidence || '')
          && !!second.exam && second.exam.kind === 'addendum' && second.exam.deepest === 3
          && /deepest 3 mm/.test((second.note || {}).perioSummary || '') && /SRP evidence: 2 sites at or above 5 mm/.test((second.note || {}).srpEvidence || '')
          && second.card.some((t) => /SRP evidence: 2 sites/.test(t));
        rec('S-perio-2', 'An addendum that re-probes the only two 5 mm+ sites as 3 mm writes a note reading "deepest 3 mm" while notes.srpEvidence still says "SRP evidence: 2 sites at or above 5 mm", and the saved card prints both sentences', 'A2, C5 (CHECKLIST); store.js:260 assigns srpEvidence only inside `if (deepest >= 5)` and never deletes it',
          reproduced, { firstExam: first.exam, firstNote: first.note, reprobedCells: reprobed, addendum: second.exam, addendumNote: second.note, savedCardLines: second.card, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-3 · A2 · perio.js:113 routes every key to applyScreening before the `st.pendingZero = false` at :120, and
    // the lane buttons (:415-416) do not reset it, so a 0 typed before a lane switch is still pending when the operator returns.
    // Negative control: when the lane switch or the screening keys clear pendingZero, the first digit back in the full
    // lane records itself (3 mm, not 13 mm), the active-site line has no "10+…", and the check reports false.
    async 'S-perio-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE);
        await keys(p, ['3', '0']);
        await press(p, 'perio.screening'); await keys(p, ['1', '1']);
        const inScreening = await ST(p);
        await press(p, 'perio.full');
        const backInFull = { st: await ST(p), activeSite: await ACTIVESITE(p) };
        const seq0 = await lastSeq(p);
        await keys(p, ['3']);
        const afterDigit = { st: await ST(p), cell: await CELL(p, 't2-s2') };
        const ev = await after(p, seq0);
        const reproduced = inScreening.pendingZero === true && backInFull.st.pendingZero === true && backInFull.st.lastKey && /Sextant/.test(backInFull.st.lastKey.meaning)
          && !!afterDigit.cell && /^13/.test(afterDigit.cell.text) && /Depth 13 mm/.test((afterDigit.st.lastKey || {}).meaning || '');
        rec('S-perio-3', 'Type 3, 0, switch to Screening, code two sextants, switch back to Full chart: the pending 0 survives both lanes and the next key 3 records 13 mm at tooth 2 site 2 while the Settings echo last said "Sextant UA = 1"', 'A2 (CHECKLIST); perio.js:113 returns before :120 clears pendingZero; perio.js:415-416 lane buttons leave it set',
          reproduced, { pendingZeroInScreening: inScreening.pendingZero, backInFull, recordedDepthCell: afterDigit.cell, lastKey: afterDigit.st.lastKey, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-4 · A2/C5 · perio.js:87-90 toggle() accepts any site in st.sites, including a skipped one, and marks it
    // bleeding; perio.js:177 buildSites drops the mark for every site without a depth, so the grid and the record disagree.
    // Negative control: when toggle refuses a skipped site ("Record a depth first") or the save keeps the mark, the cell
    // carries no `bleed` class or the exam's bleeding equals the marks on the grid, and the check reports false.
    async 'S-perio-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE);
        await keys(p, ['3', 'ArrowRight', ' ']);
        const afterSpace = { st: await ST(p), cell: await CELL(p, 't2-s2'), count: await ACTIVESITE(p) };
        await typeDigits(p, '3'.repeat(166));
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save'); await press(p, 'perio.licence.implant');
        const exam = (await EXAMS(p)).pop() || null; const note = await NOTE(p); const ev = await after(p, seq0);
        const reproduced = !!afterSpace.cell && /\bbleed\b/.test(afterSpace.cell.classes) && /\bskipped\b/.test(afterSpace.cell.classes)
          && /Bleeding on at tooth 2 site 2/.test((afterSpace.st.lastKey || {}).meaning || '') && afterSpace.st.bleedMarks === 1
          && !!exam && exam.skipped === 1 && exam.bleeding === 0 && /bleeding at 0 sites/.test((note || {}).perioSummary || '');
        rec('S-perio-4', 'Space right after an arrow-skip announces "Bleeding on at tooth 2 site 2", the not-probed cell draws the ● bleeding mark, and the saved exam then records bleeding 0 and "bleeding at 0 sites": the grid and the record disagree on the count', 'A2, C5 (CHECKLIST); perio.js:88 toggle() only requires st.sites[key] to exist; perio.js:177 buildSites writes bleed:false for every depth-less site',
          reproduced, { afterSpace, savedExam: exam, note, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-5 · B10 · perio.js:101-103 depthGate is cleared only by its own control; record() at :65 accepts the
    // corrected depth and moves on, and render (:405-406) never re-evaluates depth_gt_15, so Save stays Held with a
    // Why that still says "the cursor stays here" after 168 accepted sites.
    // Negative control: when the next accepted depth (or the finished grid) clears the gate, Save reads "Save exam"
    // with no depth_gt_15 refusal on the page, the first Save press writes the exam, and the check reports false.
    async 'S-perio-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE);
        await keys(p, ['0', '9']);
        const gateUp = { gates: await GATES(p), st: await ST(p) };
        await typeDigits(p, '3'.repeat(168));
        const finished = { gates: await GATES(p), save: await SAVE(p), st: await ST(p) };
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save'); const focusAfterHeld = await ACTIVE(p); const examsAfterHeld = await EXAMS(p);
        await press(p, 'refusal.control'); const afterControl = { gates: await GATES(p), save: await SAVE(p) };
        const ev = await after(p, seq0);
        const reproduced = gateUp.gates.some((g) => g.code === 'depth_gt_15') && finished.st.probed === 168 && finished.st.cur === 168
          && finished.gates.some((g) => g.code === 'depth_gt_15' && /cursor stays here/.test(g.text || '')) && !!finished.save && finished.save.text === 'Held'
          && examsAfterHeld.length === 0 && focusAfterHeld === 'refusal.control' && afterControl.gates.length === 0 && !!afterControl.save && afterControl.save.text === 'Save exam';
        rec('S-perio-5', 'One refused 19 mm at the first site leaves the depth_gt_15 gate standing through all 168 accepted depths: Save reads Held, the refusal still says "the cursor stays here", and the finished chart needs two extra presses (Held, then Re-enter the depth) before Save exam is offered', 'B10 (CHECKLIST); perio.js:103 depthGate clears only via its control; perio.js:405-406 re-evaluate two other gates and not this one',
          reproduced, { gateAtFirstSite: gateUp.gates, afterAllSites: finished, examsAfterPressingHeld: examsAfterHeld.length, focusAfterPressingHeld: focusAfterHeld, afterControl, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-6 · C5 · the omission gate node is built once by mkGate (perio.js:195) with the count at that moment,
    // while the licence chooser (:310-312) recounts on every rerender; typing with the chooser open lets the two drift.
    // Negative control: when the gate is rebuilt (or dropped) as the count changes, gate verb and chooser heading name
    // the same number after the two extra depths, and the check reports false.
    async 'S-perio-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE);
        await typeDigits(p, '3'.repeat(10)); await keys(p, ['ArrowRight', 'ArrowRight']);
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const opened = { gates: await GATES(p), chooser: await p.evaluate(() => (document.querySelector('.pe-licence h2') || {}).textContent || null), count: await ACTIVESITE(p) };
        await keys(p, ['5', '5']);
        const typed = { gates: await GATES(p), chooser: await p.evaluate(() => (document.querySelector('.pe-licence h2') || {}).textContent || null), count: await ACTIVESITE(p) };
        await press(p, 'perio.licence.implant');
        const exam = (await EXAMS(p)).pop() || null; const ev = await after(p, seq0);
        const n = (s) => { const m = /(\d+) sites/.exec(s || ''); return m ? Number(m[1]) : null; };
        const gateN = n((typed.gates[0] || {}).verb); const chooserN = n(typed.chooser);
        const reproduced = opened.gates.some((g) => g.code === 'omission_licence') && gateN != null && chooserN != null && gateN !== chooserN && !!exam && exam.skipped === chooserN;
        rec('S-perio-6', 'With the omission gate and its reason chooser open, two more depths leave the gate saying "Name why 158 sites were not probed" while the chooser under it asks "Why were 156 sites not probed?" and the exam saves 156: two surfaces, one chart, two numbers', 'C5 (CHECKLIST); perio.js:195 mkGate freezes the store verb at first refusal; perio.js:310 licenceChooser recounts',
          reproduced, { whenOpened: opened, afterTwoMoreDepths: typed, gateCount: gateN, chooserCount: chooserN, savedSkipped: exam && exam.skipped, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-7 · C5 · perio.js:432 says "All six sextants coded" from `st.scur <= 5` (cursor position), :433 counts the
    // codes, and :132 accepts a code at any cursor; arrowing past empty sextants makes the two lines contradict.
    // Negative control: when the headline is derived from the filled codes, it reads "Sextant … keys 0–4 or *" (or names
    // the empty box) while Codes says 3/6, and the check reports false.
    async 'S-perio-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE); await press(p, 'perio.screening');
        await keys(p, ['*', '1', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', '3']);
        const st = await ST(p); const activeSite = await ACTIVESITE(p);
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const gates = await GATES(p); const exams = await EXAMS(p); const ev = await after(p, seq0);
        const filled = st.sextants.filter(Boolean).length;
        const reproduced = st.scur === 6 && filled === 3 && !!activeSite && /All six sextants coded/.test(activeSite.line || '') && /Codes: 3\/6/.test(activeSite.count || '')
          && gates.some((g) => g.code === 'screening_incomplete') && exams.length === 0;
        rec('S-perio-7', 'In the screening lane, *, 1, four Right arrows and 3 leave the active-site headline reading "All six sextants coded · Save exam" beside "Codes: 3/6", and Save is then refused with screening_incomplete', 'C5 (CHECKLIST); perio.js:432 tests st.scur <= 5 instead of the codes; perio.js:132 codes at the cursor even when earlier boxes are empty',
          reproduced, { sextants: st.sextants, scur: st.scur, activeSite, gatesOnSave: gates, perioExamsRows: exams.length, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-8 · A2/C5 · store.js:255 builds the screening note without `amends`; only the full-chart branch (:258)
    // says "Perio addendum to exam …", so a screening saved as an addendum is an addendum in the row and a fresh
    // screening in the note and on the card.
    // Negative control: when the screening branch carries the same addendum prefix, the note matches /addendum/ and the
    // check reports false.
    async 'S-perio-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE); await typeDigits(p, '3'.repeat(168)); await press(p, 'perio.save');
        const first = (await EXAMS(p)).pop() || null;
        await press(p, 'perio.amend'); await press(p, 'refusal.control'); await press(p, 'perio.screening');
        await keys(p, ['1', '1', '1', '1', '1', '1']);
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const exam = (await EXAMS(p)).pop() || null; const note = await NOTE(p); const card = await CARD(p); const ev = await after(p, seq0);
        const reproduced = !!first && !!exam && exam.id !== first.id && exam.mode === 'screening' && exam.kind === 'addendum' && exam.amendsExamId === first.id
          && !!note && /^Perio screening:/.test(note.perioSummary || '') && !/addendum/i.test(note.perioSummary || '') && !card.some((t) => /addendum/i.test(t));
        rec('S-perio-8', 'A screening saved through "Start an addendum" is written as kind addendum linked to the full chart, yet notes.perioSummary reads "Perio screening: 6 sextants scored …" with no addendum wording and the saved card never says it amends anything', 'A2, C5 (CHECKLIST); store.js:255 ignores `amends` in the screening branch; store.js:258 prefixes only the full-chart note',
          reproduced, { originalExam: first, addendumRow: exam, note, savedCardLines: card, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-9 · A2 · store.js:253 computes the worst screening code with `Number(x) || 0`, so the * code (furcation,
    // mobility or recession, per the lane's own legend at perio.js:446) is scored 0 and summarised "healthy".
    // Negative control: when * is excluded from the numeric worst (or summarised by its own words), the note does not
    // read "highest 0 — healthy" for a mouth coded * in every sextant, and the check reports false.
    async 'S-perio-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE); await press(p, 'perio.screening');
        await keys(p, ['*', '*', '*', '*', '*', '*']);
        const legend = await p.evaluate(() => (document.querySelector('.pe-legend') || {}).textContent || null);
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const exam = (await EXAMS(p)).pop() || null; const note = await NOTE(p); const card = await CARD(p); const ev = await after(p, seq0);
        const reproduced = !!exam && exam.mode === 'screening' && exam.sextantCodes.join('') === '******' && !!note && /highest 0 — healthy/.test(note.perioSummary || '')
          && /\* furcation, mobility, or recession/.test(legend || '');
        rec('S-perio-9', 'Six sextants coded * (furcation, mobility or recession by the lane\'s own legend) save a note reading "Perio screening: 6 sextants scored (*, *, *, *, *, *), highest 0 — healthy."', 'A2 (CHECKLIST); store.js:253 `Number(x) || 0` scores * as 0 and store.js:254 MEAN[0] = healthy',
          reproduced, { legend, savedExam: exam, note, savedCardLines: card, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-10 · B10 · perio.js:158-163 routes Space on any focused control into apply(); after Save, apply() (:112)
    // answers every key with openAmendGate, so Space on "Tag for dentist" raises the exam_sealed refusal instead of
    // opening the form, and Space on the refusal's own "Start an addendum" control does nothing at all.
    // Negative control: when Space stays native once the exam is saved (no bleeding key left to protect), Space on
    // perio.tag.add opens the tag form (tagOpen true, no exam_sealed gate) and Space on the control starts the
    // addendum (amending true), so the check reports false.
    async 'S-perio-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE); await typeDigits(p, '3'.repeat(168)); await press(p, 'perio.save');
        const saved = await ST(p);
        const seq0 = await lastSeq(p);
        await p.focus('[data-testid="perio.tag.add"]'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
        const afterTagSpace = { st: await ST(p), gates: await GATES(p), focus: await ACTIVE(p) };
        const hasControl = await p.$('[data-testid="refusal.control"]');
        if (hasControl) { await p.focus('[data-testid="refusal.control"]'); await p.keyboard.press('Space'); await p.waitForTimeout(150); }
        const afterControlSpace = { st: await ST(p), gates: await GATES(p), focus: await ACTIVE(p) };
        await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const afterControlEnter = { amending: (await ST(p)).amending, gates: await GATES(p) };
        const ev = await after(p, seq0);
        const reproduced = !!saved.saved && afterTagSpace.st.tagOpen === false && afterTagSpace.gates.some((g) => g.code === 'exam_sealed')
          && !!hasControl && afterControlSpace.st.amending === false && afterControlSpace.gates.some((g) => g.code === 'exam_sealed') && afterControlSpace.st.keystrokes === saved.keystrokes + 2
          && afterControlEnter.amending === true;
        rec('S-perio-10', 'On the saved exam, Space on the focused "Tag for dentist" button raises the exam_sealed refusal instead of opening the tag form, and Space on that refusal\'s "Start an addendum" control is swallowed as a keystroke (only Enter starts the addendum)', 'B10 (CHECKLIST); docs/04:62 "keys and controls that no longer act say why and offer the addendum path" — these controls still act; perio.js:158-163 feeds Space on controls to apply(); perio.js:112 turns every key into openAmendGate once st.saved is set',
          reproduced, { savedExam: saved.saved, afterSpaceOnTagAdd: afterTagSpace, afterSpaceOnControl: afterControlSpace, afterEnterOnControl: afterControlEnter, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-11 · docs/13 feature 5 (pad and active site share the screen) · perio.js:375 gives scrollCursorIntoView the
    // last word after every rerender, and the gate is mounted above the pad (:436, :442); on a 1024x768 operatory a
    // refused pad entry lands the refusal above the top of the viewport while focus stays on the tapped pad key.
    // Negative control: when the gate is scrolled into view (or placed by the cursor), the refusal's verb has top >= 0 and
    // bottom <= innerHeight after the refused pad tap, and the check reports false.
    // Verified: the breach is viewport-height bound. At 1024x900 and 1280x900 the same sequence leaves the verb at
    // top ≈ 70 px (visible); at 768 px tall the cursor-bottom scroll pushes it to bottom −40 px.
    async 'S-perio-11'(b) {
      const { c, p } = await ctx(b, 1024, 768);
      try {
        await go(p, ROUTE); await press(p, 'perio.pad.toggle');
        for (let i = 0; i < 100; i++) { await p.click('[data-testid="perio.pad.key.3"]'); }
        await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        await click(p, 'perio.pad.key.0'); await click(p, 'perio.pad.key.7'); await p.waitForTimeout(150);
        const o = await p.evaluate(() => {
          const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height) }; };
          const r = document.querySelector('#canvas .refusal');
          return { viewport: { width: window.innerWidth, height: window.innerHeight }, refusal: rect(r), verb: rect(r && (r.querySelector('[data-testid="refusal.verb"]') || r.querySelector('.verb'))), control: rect(r && r.querySelector('[data-testid="refusal.control"]')), pad: rect(document.querySelector('.pad')), activeCell: rect(document.querySelector('.psite.active')), focus: document.activeElement === document.body ? 'BODY' : (document.activeElement.getAttribute('data-testid') || document.activeElement.tagName), gateCode: r ? r.dataset.code : null };
        });
        const st = await ST(p); const ev = await after(p, seq0);
        const reproduced = o.gateCode === 'depth_gt_15' && !!o.verb && o.verb.bottom <= 0 && !!o.control && o.control.bottom <= 0 && /perio\.pad\.key\./.test(o.focus) && st.gate === 'depth_gt_15';
        rec('S-perio-11', 'On a 1024x768 operatory (not at 900 px tall), 100 pad taps then pad 10+ and 7 refuse 17 mm with a depth_gt_15 gate whose verb and control both sit above the top of the viewport (bottom < 0) while focus stays on the pad key: the gloved operator sees no refusal', 'docs/13 feature 5; CONTRACTS §6 (the gate the actor must read is on screen); perio.js:375 scrollCursorIntoView runs last and :436 mounts the gate above the pad',
          reproduced, { geometry: o, stateGate: st.gate, lastKey: st.lastKey, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-12 · A2/B2 · store.js:237-250 validates nothing about `sites` or `extras`: depths 99, -4, NaN and "7"
    // are stored and summarised, an unknown licence prints "(undefined)" into the note, an empty sites object saves
    // a full-chart exam of 0 sites with no omission licence, and mode "bogus" is written as is.
    // Negative control: when savePerio refuses out-of-range depths, unknown licence codes, unknown modes and an empty
    // chart (ok:false with a §6 code), none of the four rows is written and the check reports false. The four breaches
    // are OR-ed, so a partial fix (say, the depth range alone) keeps the check live for the ones still open; the
    // `openBreaches` list in the detail names them.
    async 'S-perio-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const seq0 = await lastSeq(p);
        const o = await p.evaluate((encId) => {
          const before = window.__proto.state().perioExams.length;
          const r1 = Proto.store.savePerio(encId, { 't2-s1': { depth: 99, skipped: false }, 't2-s2': { depth: -4, skipped: false }, 't2-s3': { depth: NaN, skipped: false }, 't2-s4': { depth: '7', skipped: false } }, {});
          const note1 = JSON.parse(JSON.stringify(window.__proto.state().notes[encId] || null));
          const r2 = Proto.store.savePerio(encId, { 't2-s1': { depth: null, skipped: true, bleed: false }, 't2-s2': { depth: 3, skipped: false, bleed: false } }, { licence: 'bogus' });
          const note2 = JSON.parse(JSON.stringify(window.__proto.state().notes[encId] || null));
          const r3 = Proto.store.savePerio(encId, {}, {});
          const r4 = Proto.store.savePerio(encId, {}, { mode: 'bogus' });
          const rows = window.__proto.state().perioExams.length - before;
          const slim = (r) => (r && r.ok ? { ok: true, id: r.exam.id, kind: r.exam.kind, mode: r.exam.mode, probed: r.exam.probed, skipped: r.exam.skipped, deepest: r.exam.deepest, licence: r.exam.licence } : r);
          return { depth99: slim(r1), noteAfterDepth99: note1, unknownLicence: slim(r2), noteAfterUnknownLicence: note2, emptySites: slim(r3), bogusMode: slim(r4), rowsWritten: rows };
        }, ENC);
        const ev = await after(p, seq0);
        const breaches = {
          depthOutOfRange: !!o.depth99 && o.depth99.ok === true && o.depth99.deepest === 99 && /deepest 99 mm/.test((o.noteAfterDepth99 || {}).perioSummary || ''),
          unknownLicence: !!o.unknownLicence && o.unknownLicence.ok === true && o.unknownLicence.licence === 'bogus' && /\(undefined\)/.test((o.noteAfterUnknownLicence || {}).perioSummary || ''),
          emptyChart: !!o.emptySites && o.emptySites.ok === true && o.emptySites.probed === 0 && o.emptySites.kind === 'exam',
          unknownMode: !!o.bogusMode && o.bogusMode.ok === true && o.bogusMode.mode === 'bogus',
        };
        const openBreaches = Object.keys(breaches).filter((k) => breaches[k]);
        const reproduced = openBreaches.length > 0 && o.rowsWritten === openBreaches.length && ev.filter((e) => e.kind === 'write' && e.table === 'perioExams').length === openBreaches.length;
        rec('S-perio-12', 'savePerio writes whatever it is handed: depths 99, -4, NaN and "7" save with "deepest 99 mm" in the note, licence "bogus" saves and the note reads "1 site not probed (undefined)", an empty sites object saves a full-chart exam of 0 sites without the omission licence, and mode "bogus" is stored', 'A2, A8, B2 (CHECKLIST); store.js:240-250 derive and write without validating depth range, licence code, mode or a non-empty chart (the only depth check is perio.js:116 at the screen; docs/13:155 places it "at the control", so the depth leg is a boundary gap, not a documented breach)',
          reproduced, { openBreaches, results: o, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-13 · B10 · perio.js:150 sends Escape to closeInline with no `which`, and :211 prefers the reason chooser
    // whenever it is open, so Escape typed inside the tag form closes the other form and moves focus to Save.
    // Negative control: when Escape closes the form that holds focus, tagOpen is false, licenceOpen stays true and focus
    // returns to perio.tag.add, so the check reports false.
    async 'S-perio-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE); await typeDigits(p, '333333');
        await press(p, 'perio.save'); await press(p, 'perio.tag.add');
        await p.focus('[data-testid="perio.tag.text"]'); await p.keyboard.type('Recession'); await p.waitForTimeout(80);
        const bothOpen = { st: await ST(p), focus: await ACTIVE(p), gates: (await GATES(p)).map((g) => g.code) };
        const seq0 = await lastSeq(p);
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        const afterEscape = { st: await ST(p), focus: await ACTIVE(p), gates: (await GATES(p)).map((g) => g.code), tagText: await p.evaluate(() => (document.querySelector('[data-testid="perio.tag.text"]') || {}).value || null) };
        const ev = await after(p, seq0);
        const reproduced = bothOpen.st.licenceOpen === true && bothOpen.st.tagOpen === true && bothOpen.focus === 'perio.tag.text'
          && afterEscape.st.licenceOpen === false && afterEscape.st.tagOpen === true && afterEscape.focus === 'perio.save' && afterEscape.gates.length === 0;
        rec('S-perio-13', 'With the reason chooser open, Escape pressed inside the tag form\'s Observation field closes the reason chooser and its gate, leaves the tag form (and the typed text) open, and moves focus to Save exam instead of back to Tag for dentist', 'B10 (CHECKLIST); perio.js:150 calls closeInline(st, r) without naming the form; perio.js:211 picks "reason" first',
          reproduced, { bothOpen, afterEscape, events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // S-perio-14 · C5 (words a record can carry) · store.js:258 pluralises "site(s) not probed" and "bleeding at N site(s)"
    // but not "N sites probed", and store.js:260 writes "SRP evidence: N sites" for N = 1; R20 fixed the same drift only
    // in the omission gate verb.
    // Negative control: when both strings pluralise on 1, the note reads "1 site probed" and "SRP evidence: 1 site at or
    // above 5 mm", and the check reports false.
    async 'S-perio-14'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, ROUTE);
        const d = '3'.repeat(168).split(''); d[0] = '6';
        await typeDigits(p, d.join(''));
        const seq0 = await lastSeq(p);
        await press(p, 'perio.save');
        const noteUI = await NOTE(p); const card = await CARD(p); const ev = await after(p, seq0);
        // Fresh document (a hash-only goto would not reload): one probed site, the rest licensed as not probed.
        await p.reload(); await p.waitForFunction(() => window.__proto && window.__proto.ready); await p.waitForTimeout(150);
        await keys(p, ['3']); await press(p, 'perio.save'); await press(p, 'perio.licence.implant');
        const noteOne = await NOTE(p); const cardOne = await CARD(p);
        const reproduced = !!noteUI && /SRP evidence: 1 sites at or above 5 mm/.test(noteUI.srpEvidence || '') && card.some((t) => /1 sites at or above/.test(t))
          && !!noteOne && /^Perio: 1 sites probed/.test(noteOne.perioSummary || '') && cardOne.some((t) => /1 sites probed/.test(t));
        rec('S-perio-14', 'A chart with one 6 mm pocket derives "SRP evidence: 1 sites at or above 5 mm" into the note and the saved card, and a one-site partial chart derives "Perio: 1 sites probed, … 167 sites not probed": the store pluralises the other counts in the same sentence but not these two', 'C5 (CHECKLIST); store.js:258 `probed + " sites probed"`; store.js:260 `+ " sites at or above 5 mm"`',
          reproduced, { noteOnePocket: noteUI, cardOnePocket: card.filter((t) => /SRP|Perio:/.test(t)), noteOneSite: noteOne, cardOneSite: cardOne.filter((t) => /Perio:/.test(t)), events: ev, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
