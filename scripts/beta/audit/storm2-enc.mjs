// Round-2 fix-storm checks, owner "enc": clinical-r2-1, -5, -6, -7, -8, -11, -12, -13 and invariants-r2-8.
// Files: prototype/js/screens/encounter.js, prototype/js/screens/perio.js, prototype/css/components.css.
// Default position is NOT reproduced: each check carries its preconditions in the evidence and scores the
// breach only once the page is measured in the state the claim names. Contexts close in `finally`.
export default ({ ctx, go, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const blur = async (p) => { await p.click('#canvas h1'); await p.waitForTimeout(400); };
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const after = async (p, seq0) => (await events(p)).filter((e) => e.seq > seq0);
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() })));
  const codes = async (p) => (await refusals(p)).map((r) => r.code);
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.id || a.tagName; });
  const live = (p) => p.evaluate(() => document.getElementById('live').textContent);
  const clearLive = (p) => p.evaluate(() => { document.getElementById('live').textContent = ''; });
  const has = (p, t) => p.$(tid(t)).then((x) => !!x);
  const who = (p) => p.evaluate(() => Proto.store.currentUser().name);
  const typeKeys = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(150); };
  const pin = async (p, digits) => { await click(p, 'topbar.author'); for (const d of digits) await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(300); };
  const killerIdx = (p, code) => p.evaluate((c) => [...document.querySelectorAll('#enc-gate .refusal')].findIndex((r) => r.dataset.code === c), code);
  const paint30 = async (p) => { await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); };
  const chart = (S, encId) => S.chartEvents.filter((c) => c.encounterId === encId);
  const liveOf = (S, encId) => chart(S, encId).filter((c) => !c.reversed && c.kind !== 'reversal').map((c) => c.cdt + ':' + c.tooth);

  return {
    // clinical-r2-1: the duplicate_paint control "Undo the first one" ran chartUndo(encId), which reverses the LAST
    // live paint (the #19 crown), not the duplicate's original the refusal names in chartEventId. Negative control:
    // the reversal supersedes the D2392 #30 event and the crown stays live.
    async 'A-storm2-enc-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await paint30(p); await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392');
        const gate = (await refusals(p)).find((r) => r.code === 'duplicate_paint') || null;
        const liveBefore = liveOf(await state(p), 'enc-9002');
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const S = await state(p);
        const rev = chart(S, 'enc-9002').filter((x) => x.kind === 'reversal').map((x) => x.cdt + ':' + x.tooth);
        const liveAfter = liveOf(S, 'enc-9002');
        rec('A-storm2-enc-1', 'With D2392 #30 DO and D2740 #19 live, the duplicate_paint control "Undo the first one" reverses the last paint (the #19 crown) and leaves the duplicate\'s original standing', 'docs/13 flow 3 — Undo reverses the paint being undone; CONTRACTS §6 — a control resolves the gate it belongs to (encounter.js gateNode, store.js chartUndo)',
          !!gate && liveBefore.length === 2 && (rev.includes('d2740:19') || !rev.includes('d2392:30')), { gate, liveBefore, reversals: rev, liveAfter, live: await live(p) });
      } finally { await c.close(); }
    },

    // clinical-r2-5 (perio): the per-encounter draft survived the PIN author switch, so 168 depths Bree typed saved
    // under Jo. Negative control: after the switch the count is 0/168 and no exam with probed 168 carries Jo's name.
    async 'A-storm2-enc-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001?device=shared');
        const before = await who(p);
        await typeKeys(p, '3'.repeat(168));
        const countBefore = await p.$eval('.pe-count', (e) => e.textContent).catch(() => null);
        await pin(p, '3333');
        const afterWho = await who(p);
        const countAfter = await p.$eval('.pe-count', (e) => e.textContent).catch(() => null);
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const ex = (await state(p)).perioExams.find((e) => e.encounterId === 'enc-9001') || null;
        rec('A-storm2-enc-2', 'On a shared device a 168-site chart typed by Bree survives the PIN switch to Jo and Save writes the exam with author Jo Ramirez and probed 168', 'shell.js PIN pad policy line — your unsaved draft waits under your PIN; docs/01 principle 22 — every row carries the frozen name of the person who did the work (perio.js stateFor)',
          before === 'Bree Lawson' && /168\/168/.test(countBefore || '') && afterWho === 'Jo Ramirez' && (/168\/168/.test(countAfter || '') || (!!ex && ex.author === 'Jo Ramirez' && ex.probed === 168)), { before, countBefore, afterWho, countAfter, exam: ex && { author: ex.author, probed: ex.probed, skipped: ex.skipped } });
      } finally { await c.close(); }
    },

    // clinical-r2-5 (encounter): the note draft Dr. Kim started survived the switch to Dr. Reagan and filed under
    // his name. Negative control: after the switch the Assessment field is empty and nothing files with the text.
    async 'A-storm2-enc-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?device=shared');
        await paint30(p); await click(p, 'enc.note.starter.0');
        const before = { who: await who(p), text: await p.$eval('#note-assessment', (e) => e.value).catch(() => null) };
        await pin(p, '2468');
        const afterWho = await who(p);
        const text = await p.$eval('#note-assessment', (e) => e.value).catch(() => null);
        await click(p, 'enc.file'); await p.waitForTimeout(150); await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const f = (await state(p)).filedNotes.find((n) => n.encounterId === 'enc-9002') || null;
        rec('A-storm2-enc-3', 'On a shared device the encounter note Dr. Kim drafted survives the PIN switch to Dr. Reagan and files as "Dr. Blake Reagan" with Dr. Kim\'s text', 'shell.js PIN pad policy line — your unsaved draft waits under your PIN; docs/01 principle 22 (encounter.js state)',
          before.who === 'Dr. Hana Kim' && !!before.text && afterWho === 'Dr. Blake Reagan' && (!!text || (!!f && f.author === 'Dr. Blake Reagan' && f.markdown.includes(before.text))), { before, afterWho, assessmentAfterSwitch: text, filed: f && { author: f.author, hasDraftText: f.markdown.includes(before.text) } });
      } finally { await c.close(); }
    },

    // clinical-r2-6: the licence killer's "Send to Exams to sign" swallowed the store refusal under outage: no gate,
    // no announcement, status unchanged. Negative control: the outage gate renders in the filing gate.
    async 'A-storm2-enc-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/encounter/enc-9001');
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const idx = await killerIdx(p, 'licence_scope');
        await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(100);
        const seq0 = await lastSeq(p); await clearLive(p);
        if (idx >= 0) await click(p, 'enc.killer.' + idx + '.fix'); await p.waitForTimeout(250);
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => e.code);
        const S = await state(p); const st = S.appointments.find((a) => a.id === 'a-1042').status;
        const shown = await codes(p);
        rec('A-storm2-enc-4', 'Under outage the licence_scope killer\'s "Send to Exams to sign" does nothing visible: readyForExam refuses but no refusal renders or is announced and the chair status is unchanged', 'CONTRACTS §6 — every server verdict renders through the Refusal component (encounter.js fixKiller licence branch)',
          idx >= 0 && S.outage === true && st !== 'ready_for_exam' && !shown.includes('outage') && !ev.includes('outage'), { killerIdx: idx, outage: S.outage, status: st, refusalsShown: shown, refusalEvents: ev, live: await live(p) });
      } finally { await c.close(); }
    },

    // clinical-r2-7: the Chart-section gate never fell with its cause: tooth_required stood after a tooth was picked,
    // and the outage paint gate stood after the outage ended. Negative control: both gates are gone on the next render.
    async 'A-storm2-enc-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        await click(p, 'enc.proc.d2392'); const r1 = await codes(p);
        await click(p, 'enc.tooth.30'); const r2 = await codes(p);
        const sel = await p.$eval('#enc-selected', (e) => e.textContent);
        await go(p, '#/dentist/encounter/enc-9002?outage=1');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2392'); const g1 = await codes(p);
        await p.evaluate(() => window.__proto.set({ outage: false })); await p.waitForTimeout(100);
        await click(p, 'enc.tooth.19'); const g2 = await codes(p);
        const outage = (await state(p)).outage;
        const pre = r1.includes('tooth_required') && /30/.test(sel) && g1.includes('outage') && outage === false;
        rec('A-storm2-enc-5', 'The Chart-section gate stays after its cause is gone: tooth_required after tooth 30 is picked, and the outage paint gate after the outage ends and another tooth is picked', 'FIX-ROUND2 stale-gate rule; CONTRACTS §6 — the gate belongs to its cause (encounter.js renderOdontogram)',
          pre && (r2.includes('tooth_required') || g2.includes('outage')), { afterProc: r1, afterTooth30: r2, selected: sel, gateInOutage: g1, afterOutageEnded: g2, storeOutage: outage });
      } finally { await c.close(); }
    },

    // clinical-r2-8: File held by the outage stayed Held after the outage ended; the press only focused the stale
    // control. Negative control: the press re-evaluates, the gate falls and File acts (read-back or filed).
    async 'A-storm2-enc-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003?outage=1');
        await fill(p, 'enc.note.field.assessment', 'Recall exam; no new caries.'); await blur(p);
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const held1 = await txt(p, 'enc.file');
        await p.evaluate(() => window.__proto.set({ outage: false })); await p.waitForTimeout(100);
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const held2 = await txt(p, 'enc.file'); const refs = await codes(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const S = await state(p); const filed = S.filedNotes.filter((n) => n.encounterId === 'enc-9003').length;
        rec('A-storm2-enc-6', 'File held by the outage stays Held after the outage ends: the second press only focuses the stale outage control and nothing files although the store outage is false', 'FIX-ROUND2 stale-gate rule — a Held press re-evaluates before it focuses a gate control (encounter.js renderGate)',
          held1 === 'Held' && S.outage === false && (refs.includes('outage') || (held2 === 'Held' && filed === 0)), { held1, held2, refusalsAfterSecondPress: refs, storeOutage: S.outage, filedNotes: filed });
      } finally { await c.close(); }
    },

    // clinical-r2-11: at 1024x768 the sticky gate column covered the Assessment field the killer focused. Negative
    // control: after "Add assessment" the focused textarea is hit at its centre and sits above the gate.
    async 'A-storm2-enc-7'(b) {
      const { c, p } = await ctx(b, 1024, 768);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const idx = await killerIdx(p, 'assessment_required');
        if (idx >= 0) await click(p, 'enc.killer.' + idx + '.fix'); await p.waitForTimeout(350);
        const o = await p.evaluate(() => { const ta = document.getElementById('note-assessment'); const g = document.getElementById('enc-gate-area'); if (!ta || !g) return null; const r = ta.getBoundingClientRect(); const gb = g.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { focused: document.activeElement === ta, top: Math.round(r.top), bottom: Math.round(r.bottom), gateTop: Math.round(gb.top), hitIsField: hit === ta || ta.contains(hit), covered: r.bottom > gb.top && r.top < gb.bottom }; });
        rec('A-storm2-enc-7', 'At 1024x768 the sticky gate column covers the Assessment textarea the assessment_required killer focuses: the field has focus but its centre hits the gate', 'docs/13 note killers — each control jumps to the field, which must be visible (components.css .enc-gate-col, encounter.js fixKiller)',
          idx >= 0 && !!o && o.focused && (o.covered || !o.hitIsField), Object.assign({ killerIdx: idx }, o));
      } finally { await c.close(); }
    },

    // clinical-r2-12: a refused 17 mm over a filled site left Save Held behind depth_gt_15 though the site kept 3 mm.
    // Negative control: the record is valid, no gate holds Save, and Save writes the exam.
    async 'A-storm2-enc-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        await typeKeys(p, '3'.repeat(168)); await p.keyboard.press('ArrowLeft'); await typeKeys(p, '07');
        const count = await p.$eval('.pe-count', (e) => e.textContent).catch(() => null);
        const cellVal = await p.$eval('.psite.active', (e) => e.firstChild.textContent.trim()).catch(() => null);
        const refs = await codes(p); const save = await txt(p, 'perio.save');
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const n = (await state(p)).perioExams.filter((e) => e.encounterId === 'enc-9001').length;
        rec('A-storm2-enc-8', 'On a complete chart a refused 17 mm over a filled site leaves Save reading Held behind depth_gt_15 although the site kept 3 mm and the record is valid; Save writes nothing', 'FIX-ROUND2 stale-gate rule — the refused key left no trace in the record (perio.js depthGate / renderInner)',
          /168\/168/.test(count || '') && cellVal === '3' && (save === 'Held' || refs.includes('depth_gt_15')) && n === 0, { count, cellVal, refusals: refs, save, examsAfterSave: n });
      } finally { await c.close(); }
    },

    // clinical-r2-13: two same-tick dispatches of Save saved the screening once then rendered exam_sealed through
    // mkGate with a dead "Start an addendum". Negative control: no dead gate; a standing gate's control acts.
    async 'A-storm2-enc-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        await click(p, 'perio.screening'); await typeKeys(p, '012012');
        await p.$eval(tid('perio.save'), (e) => { e.click(); e.click(); }); await p.waitForTimeout(200);
        const n = (await state(p)).perioExams.filter((e) => e.encounterId === 'enc-9001').length;
        const refs = await codes(p);
        let dead = null;
        if (refs.includes('exam_sealed')) {
          const seq0 = await lastSeq(p); await clearLive(p);
          await click(p, 'refusal.control'); await p.waitForTimeout(250);
          dead = { after: await codes(p), live: await live(p), amendStill: await has(p, 'perio.amend'), saveBack: await has(p, 'perio.save'), events: (await after(p, seq0)).filter((e) => /write|refusal/.test(e.kind)).length };
        }
        rec('A-storm2-enc-9', 'Two dispatches of Save in one tick save the screening once and then render exam_sealed with a "Start an addendum" control that does nothing: the gate stays, nothing is written or announced', 'CONTRACTS §6 — a refusal with nowhere to go is a dead end; FIX-ROUND2 rapid double actions (perio.js doSave / mkGate)',
          n === 1 && refs.includes('exam_sealed') && !!dead && dead.after.includes('exam_sealed') && dead.amendStill && !dead.saveBack, { examsWritten: n, refusals: refs, afterControl: dead });
      } finally { await c.close(); }
    },

    // invariants-r2-8: the read-back rendered with focus on its own Confirm, so a second Enter on File filed the note.
    // Negative control: after the first Enter focus is not on refusal.control and the second Enter files nothing.
    async 'A-storm2-enc-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?device=shared');
        await paint30(p); await click(p, 'enc.note.starter.0');
        const seq0 = await lastSeq(p); const n0 = (await state(p)).filedNotes.length;
        await p.focus(tid('enc.file')); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
        const f1 = await focused(p); const refs = await codes(p);
        await p.keyboard.press('Enter'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const clicks = ev.filter((e) => e.kind === 'click').map((e) => e.testid);
        const filed = (await state(p)).filedNotes.length;
        rec('A-storm2-enc-10', 'Two Enter presses on File pass the read-back and file the note: the readback refusal renders with focus on its own "Confirm and file"', 'FIX-ROUND2 focus-after-action rule — after a primary fires, focus never lands on another primary; docs/13 feature 5 read-back (encounter.js doFile)',
          refs.includes('readback') && (f1 === 'refusal.control' || filed === n0 + 1), { focusAfterFirstEnter: f1, refusals: refs, clicks, filedBefore: n0, filedAfter: filed });
      } finally { await c.close(); }
    },
  };
};
