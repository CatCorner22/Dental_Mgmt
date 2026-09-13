// Audit checks for the fix storm, owner "chairs": findings chairs-perio-1..6, 8..13 and invariants-10 from the beta
// storm, each confirmed live before it was fixed. Files: prototype/js/screens/perio.js, prototype/js/screens/chairs.js.
// Check numbers follow the finding numbers (chairs-perio-<n> -> A-storm-chairs-<n>; invariants-10 is the same
// defect as chairs-perio-4). Default position is NOT reproduced: every check carries its precondition values and
// scores the breach only once the page is measured in the state the claim names. Contexts close in `finally`.
export default ({ ctx, go, hop, click, txt, state, rec }) => {
  const PERIO = '#/hygienist/perio/enc-9001';
  const typeKeys = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(150); };
  const key = async (p, k) => { await p.keyboard.press(k); await p.waitForTimeout(60); };
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() })));
  const codes = async (p) => (await refusals(p)).map((r) => r.code);
  const exams = async (p) => (await state(p)).perioExams.filter((e) => e.encounterId === 'enc-9001');
  const live = (p) => p.evaluate(() => document.getElementById('live').textContent);
  const clearLive = (p) => p.evaluate(() => { document.getElementById('live').textContent = ''; });
  const q = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
  const has = (p, tid) => p.$(`[data-testid="${tid}"]`).then((x) => !!x);
  const space = async (p, tid) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.focus(s); await p.keyboard.press('Space'); await p.waitForTimeout(120); return true; };
  const fullChart = async (p) => { await typeKeys(p, '3'.repeat(168)); await click(p, 'perio.save'); await p.waitForTimeout(200); };
  // The outage gate on Save, then its control pressed with the live region emptied first: what the press changed.
  const pressControl = async (p) => {
    const before = await refusals(p); const hash0 = await p.evaluate(() => location.hash); await clearLive(p);
    await click(p, 'refusal.control'); await p.waitForTimeout(250);
    return { gate: before[0] || null, live: await live(p), overlay: await p.evaluate(() => !!document.querySelector('.overlay')), hashSame: (await p.evaluate(() => location.hash)) === hash0 };
  };

  return {
    // perio.js depthGate()/renderInner(): the depth_gt_15 gate was cleared only by its own control, so after "0 7"
    // was refused, every valid depth typed afterwards left Save reading Held and pressing it only focused the gate.
    // Negative control: a compliant gate leaves with the cursor (the next depth answers it), so after 168 valid
    // depths no refusal stands, Save reads "Save exam" and the press writes the perioExams row.
    async 'A-storm-chairs-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await typeKeys(p, '07');
        const gateAt07 = await codes(p);
        await typeKeys(p, '3'.repeat(168));
        const after = { codes: await codes(p), save: await txt(p, 'perio.save'), count: await q(p, '.pe-count') };
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const written = (await exams(p)).length;
        const pre = gateAt07.includes('depth_gt_15');
        rec('A-storm-chairs-1', 'After a depth above 15 is refused (0 then 7), the depth_gt_15 gate stays on screen and Save exam reads Held after valid depths fill every site; pressing Save writes no perioExams row', 'CONTRACTS §6 — a gate answers a condition and clears when the condition does; docs/13 feature 5 (perio.js depthGate / renderInner)',
          pre && (after.codes.includes('depth_gt_15') || after.save === 'Held') && written === 0, { gateAt07, after, writtenAfterSave: written });
      } finally { await c.close(); }
    },

    // perio.js doSave()/renderInner(): the omission gate was cleared only by Cancel, so probing the one skipped
    // site left the gate, the Held Save and a chooser asking "Why were 0 sites not probed?" on screen, and the
    // reason then saved a 168-site chart carrying a licence. Negative control: once no site is unprobed the gate
    // and the chooser leave, Save reads "Save exam" and the press writes the row with no licence.
    async 'A-storm-chairs-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await typeKeys(p, '2'.repeat(167)); await key(p, 'ArrowRight');
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const gate = (await refusals(p))[0] || null;
        await key(p, 'ArrowLeft'); await typeKeys(p, '3');
        const after = { chooserH2: await q(p, '.pe-licence h2'), codes: await codes(p), save: await txt(p, 'perio.save'), count: await q(p, '.pe-count') };
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const ex = (await exams(p))[0] || null;
        const pre = !!gate && gate.code === 'omission_licence';
        rec('A-storm-chairs-2', 'With the omission_licence gate open, stepping back and probing the skipped site leaves the gate and the Held Save in place (chooser reads "Why were 0 sites not probed?") and Save writes nothing', 'CONTRACTS §6 — the gate clears when its condition clears; docs/13 feature 5 (perio.js doSave / renderInner)',
          pre && (after.codes.includes('omission_licence') || after.save === 'Held' || /0 sites/.test(after.chooserH2 || '')) && !ex, { gate, after, exam: ex && { id: ex.id, skipped: ex.skipped, licence: ex.licence || null, probed: ex.probed } });
      } finally { await c.close(); }
    },

    // perio.js renderInner(): Chairs drops an outage gate the moment the store says the server is back; Perio kept
    // its own, so a Save refused during the outage stayed Held after the outage cleared and the press focused a
    // gate for a condition that no longer held. Negative control: with outage false the gate is gone, Save reads
    // "Save exam" after the press, and a second press writes the row.
    async 'A-storm-chairs-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO + '?outage=1');
        await fullChart(p);
        const gateInOutage = await codes(p);
        await p.evaluate(() => window.__proto.set({ outage: false })); await p.waitForTimeout(150);
        const storeOutage = (await state(p)).outage;
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const after = { codes: await codes(p), save: await txt(p, 'perio.save'), written: (await exams(p)).length };
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const writtenSecond = (await exams(p)).length;
        const pre = gateInOutage.includes('outage') && storeOutage === false;
        rec('A-storm-chairs-3', 'A Save refused during the outage stays refused after the outage clears: with the store outage false the Perio screen still shows the outage gate, Save reads Held and the press writes nothing', 'CONTRACTS §6 — the gate the outage raised belongs to the outage (chairs.js clears it on render; perio.js renderInner did not)',
          pre && after.written === 0 && (after.codes.includes('outage') || after.save === 'Held'), { gateInOutage, storeOutage, afterFirstPress: after, writtenAfterSecondPress: writtenSecond });
      } finally { await c.close(); }
    },

    // perio.js mkGate(): the outage gate's control "Support line" ran `() => {}` on Save exam and on Save tag, so
    // the press announced nothing, opened nothing and moved nowhere (Chairs announces the support line for the same
    // code). Also invariants-10. Negative control: the press fills the live region (the support line), so `live`
    // is non-empty for both gates.
    async 'A-storm-chairs-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO + '?outage=1');
        await fullChart(p);
        const save = await pressControl(p);
        await click(p, 'perio.tag.add'); await p.fill('[data-testid="perio.tag.tooth"]', '30'); await p.fill('[data-testid="perio.tag.text"]', 'Recession'); await click(p, 'perio.tag.save'); await p.waitForTimeout(150);
        const tagCodes = await codes(p);
        const tag = tagCodes.includes('outage') ? await pressControl(p) : null;
        const dead = (o) => !!o && o.gate && o.gate.code === 'outage' && o.live === '' && !o.overlay && o.hashSame;
        rec('A-storm-chairs-4', 'The outage refusal on Perio (Save exam and Save tag) carries the control "Support line" which does nothing when pressed: no announcement, no dialog, no route change', 'CONTRACTS §6 — every gate carries a control and a refusal with nowhere to go is a dead end (perio.js mkGate; invariants-10)',
          dead(save) || dead(tag), { saveGate: save, tagGateCodes: tagCodes, tagGate: tag });
      } finally { await c.close(); }
    },

    // chairs.js perioToday(): find() returned the first perioExams row for the encounter, so after an addendum the
    // "Perio charted today" strip read the superseded exam while the saved card and the note read the addendum.
    // Negative control: the strip reads the latest row ("deepest 7 mm") and never the superseded one.
    async 'A-storm-chairs-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await fullChart(p);
        await click(p, 'perio.amend'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        await key(p, 'ArrowLeft'); await typeKeys(p, '7');
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const rows = (await exams(p)).map((e) => ({ id: e.id, kind: e.kind, deepest: e.deepest }));
        const add = rows.find((e) => e.kind === 'addendum');
        await hop(p, '#/hygienist/chairs');
        const strip = await p.evaluate(() => [...document.querySelectorAll('[data-testid="chairs.card.a-1042.expand"] .d')].map((e) => e.textContent.trim()).join(' | '));
        const pre = !!add && add.deepest === 7;
        rec('A-storm-chairs-5', 'After an addendum changes a depth, the Chairs card "Perio charted today" strip still reads the superseded exam (deepest 3 mm) while the saved card and the note read the addendum (deepest 7 mm)', 'docs/04 one canonical view per fact; docs/13 feature 11 — the addendum is the record now (chairs.js perioToday)',
          pre && /deepest 3 mm/.test(strip) && !/deepest 7 mm/.test(strip), { exams: rows, strip });
      } finally { await c.close(); }
    },

    // chairs.js deltas(): the strip read probed/deepest whatever the exam mode, so a screening save printed
    // "0 sites probed, deepest 0 mm" and never the Full chart due badge the saved card shows for a code 3 or 4.
    // Negative control: the card names the screening and carries "Full chart due".
    async 'A-storm-chairs-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await click(p, 'perio.screening');
        for (const k of ['1', '2', '3', '*', '0', '4']) await key(p, k);
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const ex = (await exams(p))[0] || null;
        await hop(p, '#/hygienist/chairs');
        const card = await p.evaluate(() => (document.querySelector('[data-testid="chairs.card.a-1042"]') || {}).textContent || '');
        const pre = !!ex && ex.mode === 'screening' && (ex.sextantCodes || []).some((x) => x === '3' || x === '4');
        rec('A-storm-chairs-6', 'After a screening save with codes 3 and 4 the Chairs card strip reads "0 sites probed, deepest 0 mm" and shows no "Full chart due" badge, while the Perio saved card reads "Full chart due"', 'docs/13 features 4 and 5 — any 3 or 4 creates a Full chart due Chairs badge; docs/04 one canonical view per fact (chairs.js deltas)',
          pre && (/0 sites probed/.test(card) || !/Full chart due/.test(card)), { exam: ex && { mode: ex.mode, sextantCodes: ex.sextantCodes, probed: ex.probed, deepest: ex.deepest }, cardText: card.replace(/\s+/g, ' ').slice(0, 300) });
      } finally { await c.close(); }
    },

    // perio.js onKey(): the Space override (bleeding key) stayed on after Save, so Space on a focused button ran
    // apply() and raised exam_sealed instead of activating the control. Negative control: after Save, Space on
    // "Tag for dentist" opens the form and Space on "Back to Chairs" leaves the route.
    async 'A-storm-chairs-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await fullChart(p);
        const saved = (await exams(p)).length === 1 && await has(p, 'perio.amend');
        await space(p, 'perio.tag.add');
        const tagOpened = await has(p, 'perio.tag.tooth');
        const codesAfterSpace = await codes(p);
        await key(p, 'Escape');
        await space(p, 'perio.back');
        const hash = await p.evaluate(() => location.hash);
        rec('A-storm-chairs-8', 'After Save, pressing Space on a focused button (Tag for dentist, Back to Chairs) does not activate it and raises the exam_sealed refusal instead; only Enter works', 'docs/04 keyboard-first — every control is keyboard-operable; the Space override belongs to the grammar, which is sealed with the exam (perio.js onKey)',
          saved && !tagOpened && /perio\/enc-9001/.test(hash), { saved, tagOpened, codesAfterSpace, hashAfterSpaceOnBack: hash });
      } finally { await c.close(); }
    },

    // perio.js toggle(): Space accepted st.last when that site had been skipped, so the cell drew "bleed skipped"
    // and read "not probed, bleeding" while buildSites() stored bleed:false. Negative control: a skipped site
    // carries no bleeding on screen (class has no "bleed") and the stored row agrees.
    async 'A-storm-chairs-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await typeKeys(p, '3'); await key(p, 'ArrowRight'); await key(p, 'Space');
        const cell = await p.evaluate(() => { const e = document.querySelector('[data-testid="perio.grid.cell.t2-s2"]'); return e ? { cls: e.className, desc: e.getAttribute('aria-description') } : null; });
        await typeKeys(p, '3'.repeat(166)); await click(p, 'perio.save'); await p.waitForTimeout(150);
        await click(p, 'perio.licence.implant'); await p.waitForTimeout(200);
        const ex = (await exams(p))[0] || null;
        const site = ex && ex.sites['t2-s2'];
        const pre = !!cell && /skipped/.test(cell.cls) && !!site && site.skipped === true;
        rec('A-storm-chairs-9', 'Space after an ArrowRight skip toggles bleeding on the not-probed site: the cell renders "bleed skipped" and reads "not probed, bleeding" while the saved row stores bleed:false', 'docs/04 one canonical view per fact; docs/13 feature 5 — a skipped site stores not probed, never a value (perio.js toggle vs buildSites)',
          pre && /\bbleed\b/.test(cell.cls) && site.bleed === false, { cell, storedSite: site, bleeding: ex && ex.bleeding });
      } finally { await c.close(); }
    },

    // perio.js cell()/renderInner(): after Save a grid cell click returned silently and the Glove pad toggle still
    // rendered and pressed to "Hide glove pad" while the pad itself is gated by !st.saved. Negative control: the
    // cell click opens the exam_sealed gate (announced), and no pad toggle stands on a sealed chart.
    async 'A-storm-chairs-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await fullChart(p);
        const saved = (await exams(p)).length === 1;
        await clearLive(p);
        await click(p, 'perio.grid.cell.t2-s1'); await p.waitForTimeout(150);
        const cellClick = { codes: await codes(p), live: await live(p) };
        const toggleThere = await has(p, 'perio.pad.toggle');
        let toggle = null;
        if (toggleThere) { await click(p, 'perio.pad.toggle'); toggle = { pressed: await p.$eval('[data-testid="perio.pad.toggle"]', (e) => e.getAttribute('aria-pressed')).catch(() => null), padInDom: await p.evaluate(() => !!document.querySelector('.pad')), codes: await codes(p) }; }
        const silentCell = cellClick.codes.length === 0 && cellClick.live === '';
        const deadToggle = !!toggle && toggle.pressed === 'true' && !toggle.padInDom && toggle.codes.length === 0;
        rec('A-storm-chairs-10', 'After Save, clicking a grid cell does nothing and says nothing (no refusal, no announcement), and the Glove pad toggle presses to "Hide glove pad" while no pad renders', 'docs/04 amendment — a sealed record offers an amendment, never silence; a control does what its label promises (perio.js cell, renderInner padT)',
          saved && (silentCell || deadToggle), { saved, cellClick, toggleRendered: toggleThere, toggle });
      } finally { await c.close(); }
    },

    // perio.js licenceChooser()/savedCard(): with one site skipped the chooser asked "Why were 1 site not probed?"
    // and the status line read "1 sites not probed". The SRP line ("1 sites at or above 5 mm") is the store's and
    // is carried as evidence only; its fix belongs to store.js savePerio. Negative control: "Why was 1 site" and
    // "1 site not probed".
    async 'A-storm-chairs-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await typeKeys(p, '7'); await typeKeys(p, '2'.repeat(166)); await key(p, 'ArrowRight');
        await click(p, 'perio.save'); await p.waitForTimeout(150);
        const h2 = await q(p, '.pe-licence h2');
        await click(p, 'perio.licence.implant'); await p.waitForTimeout(200);
        const ps = await p.evaluate(() => [...document.querySelectorAll('.pe-saved p')].map((e) => e.textContent.trim()));
        const status = ps.find((t) => /^Chart status/.test(t)) || null; const srp = ps.find((t) => /^SRP evidence/.test(t)) || null;
        const pre = !!h2 && !!status && (await exams(p)).some((e) => e.skipped === 1);
        rec('A-storm-chairs-11', 'With one site skipped the licence chooser heading reads "Why were 1 site not probed?" and the saved card reads "1 sites not probed (Implant)"', 'docs/01 — omission licences read as words a patient-facing record can carry; copy catalog docs/13 feature 29 (perio.js licenceChooser, savedCard)',
          pre && (/were 1 site\b/.test(h2) || /\b1 sites not probed/.test(status)), { chooserH2: h2, statusLine: status, srpLine: srp, srpLineIsStoreCopy: true });
      } finally { await c.close(); }
    },

    // perio.js scrollCursorIntoView(): the grid scrolled the whole canvas to the cursor, so once the glove pad had
    // walked the cursor into the lower arch on a 1024x768 tablet the pad itself and the active-site line sat above
    // the viewport after every tap. Negative control: after 132 pad taps the pad key, the active-site line and the
    // active cell are all inside the viewport (the grid scrolls in its own box).
    async 'A-storm-chairs-12'(b) {
      const { c, p } = await ctx(b, 1024, 768);
      try {
        await go(p, PERIO + '?device=operatory');
        await click(p, 'perio.pad.toggle'); await p.waitForTimeout(150);
        const padOpen = await p.evaluate(() => !!document.querySelector('.pad'));
        for (let i = 0; i < 132; i++) await p.click('[data-testid="perio.pad.key.3"]', { timeout: 2000 });
        await p.waitForTimeout(250);
        const g = await p.evaluate(() => {
          const R = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); const w = e.closest('.perio-wrap'); const wb = w ? w.getBoundingClientRect() : null; return { top: Math.round(b.top), bottom: Math.round(b.bottom), inView: b.top >= 0 && b.bottom <= innerHeight && (!wb || (b.top >= wb.top - 1 && b.bottom <= wb.bottom + 1)) }; };
          return { activeLine: R('.activesite'), padKey3: R('[data-testid="perio.pad.key.3"]'), activeCell: R('.psite.active'), cursor: (document.querySelector('.psite.active') || {}).getAttribute ? document.querySelector('.psite.active').getAttribute('data-testid') : null, canvasScrollTop: Math.round(document.getElementById('canvas').scrollTop), recorded: (document.querySelector('.pe-count') || {}).textContent || null };
        });
        const pre = padOpen && /132\/168/.test(g.recorded || '');
        rec('A-storm-chairs-12', 'On a 1024x768 operatory tablet, tapping the glove pad through to the lower lingual row (132 taps) scrolls the pad and the active-site line out of the viewport, so each further pad tap needs a manual scroll first', 'docs/04 amendment — a gloved input surface docks within the viewport; docs/13 feature 5 — the pad and the active-site line share the screen (perio.js scrollCursorIntoView)',
          pre && (!g.padKey3 || !g.padKey3.inView || !g.activeLine || !g.activeLine.inView), Object.assign({ padOpen }, g));
      } finally { await c.close(); }
    },

    // perio.js closeInline(): Cancel on the tag form reset the touched flags but kept tagTooth and tagText, so the
    // abandoned observation came back pre-filled the next time the form opened. Negative control: after Cancel the
    // reopened form carries no observation text and the tooth is the cursor's again.
    async 'A-storm-chairs-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, PERIO);
        await click(p, 'perio.tag.add'); await p.fill('[data-testid="perio.tag.tooth"]', '30'); await click(p, 'perio.tag.obs.caries');
        await p.keyboard.type('DO'); await p.waitForTimeout(80);
        const typed = await p.$eval('[data-testid="perio.tag.text"]', (e) => e.value).catch(() => null);
        await click(p, 'perio.tag.cancel'); await p.waitForTimeout(100);
        const closed = !(await has(p, 'perio.tag.text'));
        await click(p, 'perio.tag.add'); await p.waitForTimeout(100);
        const reopened = { tooth: await p.$eval('[data-testid="perio.tag.tooth"]', (e) => e.value).catch(() => null), text: await p.$eval('[data-testid="perio.tag.text"]', (e) => e.value).catch(() => null) };
        const tags = (await state(p)).tags.filter((t) => t.encounterId === 'enc-9001').length;
        const pre = /DO$/.test(typed || '') && closed && tags === 0;
        rec('A-storm-chairs-13', 'Cancel on the Tag for dentist form keeps the typed observation text and tooth; reopening the form shows the abandoned text pre-filled', 'docs/04 glossary Cancel — discard the form (perio.js closeInline)',
          pre && (/DO$/.test(reopened.text || '') || reopened.tooth === '30'), { typed, closed, reopened, tagsWritten: tags });
      } finally { await c.close(); }
    },
  };
};
