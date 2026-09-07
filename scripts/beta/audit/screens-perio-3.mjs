// Audit checks for prototype/js/screens/perio.js, chunk screens-perio-3.
// Root causes in order: RC-251, RC-179, RC-180, RC-181, RC-182, RC-183, RC-235, RC-245.
// Default position is NOT reproduced: each check drives the prototype from the claim's start hash,
// follows the repro steps by data-testid, and carries the measured values in evidence.
//
// Three measurement rules this file keeps, because each of them has produced a wrong verdict before:
//  1. Nothing here reads document.styleSheets. Over file:// cssRules access throws, and a
//     catch-and-continue then returns an empty rule list that reads as "no rule" for every claim.
//     A CSS consequence is measured through getComputedStyle and getBoundingClientRect instead.
//  2. A second go() to the same file URL is a same-document navigation, so the perio screen's
//     in-memory state (saved exam, pad/settings flags, tag draft) survives it. Every leg that must
//     start from a clean chart goes through reopen() (about:blank first) or its own context.
//  3. A collapsed <details> still lays out with a non-zero box in this Chromium, so the visible-text
//     walker below skips closed <details> explicitly (its <summary> stays visible).
// And: an element whose box starts past the viewport edge is not out of reach if the scroller that
// contains it computes overflow auto/scroll and can bring it in; RC-183 measures that separately.
import fs from 'node:fs';

const readRepo = (rel) => { try { return fs.readFileSync(new URL('../../../' + rel, import.meta.url), 'utf8'); } catch { return ''; } };
const listRepo = (rel) => { try { return fs.readdirSync(new URL('../../../' + rel, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => rel + '/' + f); } catch { return []; } };
const CONTRACTS = readRepo('prototype/CONTRACTS.md');
const DOCS13 = readRepo('docs/13-innovation-and-intuitiveness.md');
const PERIO_SRC = readRepo('prototype/js/screens/perio.js');

// ---- shared measurement helpers (browser side only; no lib.cjs) ------------------------------
const SEQ = (p) => p.evaluate(() => (window.__events[window.__events.length - 1] || { seq: 0 }).seq);
const AFTER = (p, from) => p.evaluate((f) => window.__events.filter((e) => e.seq > f).map((e) => ({
  seq: e.seq, kind: e.kind, testid: e.testid, key: e.key, field: e.field || false, synthetic: e.synthetic || false,
  table: e.table, id: e.id, code: e.code, verb: e.verb, control: e.control,
})), from);
const WRITES = (evs) => evs.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
const REFUSALS = (evs) => evs.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));

// The rendered gate, matched by its own code: "a refusal appeared" is not evidence for a claim about one code.
const GATE = (p, code) => p.evaluate((wanted) => {
  const nodes = [...document.querySelectorAll('#canvas .refusal')];
  const r = wanted ? nodes.find((n) => n.dataset.code === wanted) : nodes[0];
  if (!r) return null;
  const v = r.querySelector('[data-testid="refusal.verb"]'); const c = r.querySelector('[data-testid="refusal.control"]');
  return { code: r.dataset.code || null, verb: v ? v.textContent.trim() : null, control: c ? c.textContent.trim() : null };
}, code || null);

const LIVE = (p) => p.evaluate(() => (document.getElementById('live') || {}).textContent || '');
const TXTOF = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const ATTR = (p, sel, n) => p.evaluate(([s, a]) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; }, [sel, n]);
const ACTIVE = (p) => p.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { tag: 'BODY', testid: null };
  return { tag: a.tagName, testid: a.getAttribute ? a.getAttribute('data-testid') : null, id: a.id || null };
});
// The screen's own in-memory state, read through the exported stateFor.
const ST = (p, encId) => p.evaluate((id) => {
  const e = Proto.store.encounter(id); if (!e) return null;
  const st = Proto.screens.perio.stateFor(e);
  return { mode: st.mode, cur: st.cur, pathLen: st.path.length, sextants: st.sextants.slice(),
    probed: Object.values(st.sites).filter((v) => v.depth != null).length,
    arrowSkipped: Object.values(st.sites).filter((v) => v.skipped).length,
    saved: st.saved ? st.saved.id : null, licenceOpen: !!st.licenceOpen, settingsOpen: !!st.settingsOpen,
    tagOpen: !!st.tagOpen, tagTooth: st.tagTooth, tagTouched: !!st.tagTouched, gate: st.gate ? st.gate.code : null };
}, encId);
const EXAMS = (p, encId) => p.evaluate((id) => window.__proto.state().perioExams
  .filter((e) => e.encounterId === id).map((e) => ({ id: e.id, mode: e.mode, probed: e.probed, skipped: e.skipped, licence: e.licence || null, author: e.author })), encId);

// Visible text, as a reader sees it: skips display:none / visibility:hidden / zero-box / .sr-only,
// and skips the contents of a COLLAPSED <details> (which still lays out a non-zero box here).
const VISIBLE = (p, sel) => p.evaluate((s) => {
  const root = document.querySelector(s); if (!root) return null;
  const inClosedDetails = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const d = n.parentElement;
      if (d && d.tagName === 'DETAILS' && !d.open && !(n.tagName === 'SUMMARY')) return true;
    }
    return false;
  };
  const out = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const txt = (t.nodeValue || '').trim(); if (!txt) continue;
    const el = t.parentElement; if (!el) continue;
    if (inClosedDetails(el)) continue;
    if (el.closest('.sr-only')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
    out.push(txt);
  }
  return out;
}, sel);

const num = (re, s) => { const m = re.exec(String(s || '')); return m ? Number(m[1]) : null; };
async function typeDigits(p, s) { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(200); }
// A second go() to the same file URL is a same-document navigation: the document, and with it this
// screen's chart state, survives. Blank the page first so the next leg starts on a clean store.
async function reopen(p, go, hash) { await p.goto('about:blank'); await go(p, hash); }

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => ({

  // RC-251 (C5) — one fact, three renderings: the omission gate counts every unentered site (165),
  // the licence chooser it opens counts only arrow-skips (0), the saved card counts 165 again.
  // Measurement: the number in the gate verb, in the chooser h2, in the saved card's chart-status line
  // and in the announcement, against the stored exam's own `skipped` and the screen's arrow-skip count.
  // Second leg isolates the mechanism: two ArrowRight skips make the chooser say 2 while the gate says 165.
  // Negative control: if both numbers came from the same count the chooser would read 165, gateN would
  // equal chooserN and the check reports false. The gate is matched by code omission_licence, so a
  // different refusal (pin_required, screening_incomplete) reports false instead of being read as this one.
  async 'A-screens-perio-3-1'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await typeDigits(p, '345');                                  // three sites recorded, 165 never entered
      const beforeSave = await ST(p, 'enc-9001');
      const seq0 = await SEQ(p);
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const gate = await GATE(p, 'omission_licence');
      const gateEvents = REFUSALS(await AFTER(p, seq0));
      const activeLine = await TXTOF(p, '#canvas .activesite');
      await click(p, 'refusal.control'); await p.waitForTimeout(200);
      const chooser = await p.evaluate(() => {
        const s = document.querySelector('#canvas .pe-licence'); if (!s) return null;
        return { sectionAria: s.getAttribute('aria-label'), h2: (s.querySelector('h2') || {}).textContent || null };
      });
      await click(p, 'perio.licence.implant'); await p.waitForTimeout(400);   // the reason saves; Confirm was collapsed
      const evs = await AFTER(p, seq0);
      const card = await p.evaluate(() => {
        const s = document.querySelector('#canvas .pe-saved'); if (!s) return null;
        return { status: [...s.querySelectorAll('p')].map((e) => e.textContent.trim()).filter((t) => /not probed|Chart status/.test(t)), all: s.textContent.replace(/\s+/g, ' ').trim().slice(0, 320) };
      });
      const live = await LIVE(p);
      const exams = await EXAMS(p, 'enc-9001');
      const stored = exams[exams.length - 1] || null;

      const gateN = num(/(\d+)\s+sites?\s+(?:was|were)\s+not probed/i, gate && gate.verb);
      const chooserN = num(/were\s+(\d+)\s+sites?\s+not probed/i, chooser && chooser.h2);
      const cardN = num(/;\s*(\d+)\s+sites?\s+not probed/i, (card && card.status.join(' ')) || '');
      const liveN = num(/(\d+)\s+sites?\s+not probed/i, live);

      // Second leg, clean document: skip two sites with the arrow key. The chooser tracks arrow-skips only.
      await reopen(p, go, '#/hygienist/perio/enc-9001');
      await typeDigits(p, '345');
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(60);
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120);
      const stArrow = await ST(p, 'enc-9001');
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const gate2 = await GATE(p, 'omission_licence');
      await click(p, 'refusal.control'); await p.waitForTimeout(200);
      const chooser2H2 = await TXTOF(p, '#canvas .pe-licence h2');
      const gate2N = num(/(\d+)\s+sites?\s+(?:was|were)\s+not probed/i, gate2 && gate2.verb);
      const chooser2N = num(/were\s+(\d+)\s+sites?\s+not probed/i, chooser2H2);

      rec('A-screens-perio-3-1',
        'The omission gate says 165 sites were not probed, the licence chooser it opens asks "Why were 0 sites not probed?", and the saved card says 165 again: skippedCount counts arrow-skips only while savePerio counts every unentered site',
        'CHECKLIST C5: the same fact has one canonical value everywhere it appears',
        !!gate && gate.code === 'omission_licence' && gateEvents.some((e) => e.code === 'omission_licence')
          && gateN != null && chooserN != null && cardN != null && stored != null
          && gateN === stored.skipped && cardN === gateN && liveN === gateN
          && chooserN !== gateN && chooserN === beforeSave.arrowSkipped
          && gate2N === gateN && chooser2N === stArrow.arrowSkipped && chooser2N !== gate2N,
        { renderings: { gateVerb: gate && gate.verb, gateNumber: gateN, chooserHeading: chooser && chooser.h2, chooserNumber: chooserN,
            savedCardStatus: card && card.status, savedCardNumber: cardN, announcement: live, announcementNumber: liveN, activeSiteLine: activeLine },
          storeValue: { perioExam: stored, skippedInStore: stored && stored.skipped, probedInStore: stored && stored.probed },
          screenState: { sitesRecorded: beforeSave.probed, arrowSkipped: beforeSave.arrowSkipped, pathLength: beforeSave.pathLen },
          refusalEvents: gateEvents.filter((e) => e.code === 'omission_licence'),
          writesInRange: WRITES(evs),
          arrowSkipLeg: { arrowSkipped: stArrow.arrowSkipped, sitesRecorded: stArrow.probed, gateVerb: gate2 && gate2.verb, gateNumber: gate2N, chooserHeading: chooser2H2, chooserNumber: chooser2N },
          savedCardText: card && card.all });
    } finally { await c.close(); }
  },

  // RC-179 (C3) — raw record ids on screen: the saved card names the exam row, the unknown-id page the
  // encounter id. Measurement: the visible text of both pages (closed <details> skipped), the exam id
  // the store actually wrote, and a search of the specs for such an id on screen.
  // Negative control: a card headed "Full chart saved" with the id only in the record, and a not-found
  // page saying "No such visit", leave both regexes empty and the check reports false. The id matched on
  // the saved card must equal the id the store wrote, so a coincidental substring cannot pass.
  async 'A-screens-perio-3-2'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await typeDigits(p, '3'.repeat(168));                        // a complete chart: no omission gate
      await click(p, 'perio.save'); await p.waitForTimeout(400);
      const savedH2 = await TXTOF(p, '#canvas .pe-saved h2');
      const savedDerivedLine = await TXTOF(p, '#canvas .pe-saved p');
      const visibleSaved = await VISIBLE(p, '#canvas');
      const exams = await EXAMS(p, 'enc-9001');
      const storedId = exams.length ? exams[exams.length - 1].id : null;
      const RAW = /\b(?:pe|enc|el|tag|ae|pay|dp|sd|ar)-\d+\b/g;
      const rawOnSaved = [...new Set((visibleSaved || []).join(' § ').match(RAW) || [])];

      await reopen(p, go, '#/hygienist/perio/enc-9999');           // clean document for the unknown id
      const nfH1 = await TXTOF(p, '#canvas h1');
      const visibleNf = await VISIBLE(p, '#canvas');
      const rawOnNotFound = [...new Set((visibleNf || []).join(' § ').match(RAW) || [])];

      const specShowsExamId = { contracts: /\bpe-\d+\b/.test(CONTRACTS), docs13: /\bpe-\d+\b/.test(DOCS13) };
      rec('A-screens-perio-3-2',
        'The perio saved card prints the raw exam row id ("Full chart saved · exam pe-2") and the unknown-id page prints the raw encounter id ("No encounter enc-9999")',
        'CHECKLIST C3: no product-internal nouns or raw ids on screen unless the spec shows them',
        !!storedId && !!savedH2 && savedH2.includes(storedId) && rawOnSaved.includes(storedId)
          && nfH1 === 'No encounter enc-9999' && rawOnNotFound.includes('enc-9999')
          && !specShowsExamId.contracts && !specShowsExamId.docs13,
        { savedCard: { h2: savedH2, derivedLine: savedDerivedLine, examIdInStore: storedId, rawIdsInVisibleText: rawOnSaved },
          unknownId: { hash: '#/hygienist/perio/enc-9999', h1: nfH1, rawIdsInVisibleText: rawOnNotFound },
          specSearchedForExamIds: { 'prototype/CONTRACTS.md': specShowsExamId.contracts, 'docs/13-innovation-and-intuitiveness.md': specShowsExamId.docs13, pattern: '\\bpe-\\d+\\b' },
          visibleTextSavedPage: (visibleSaved || []).slice(0, 24) });
    } finally { await c.close(); }
  },

  // RC-180 (C7) — one shared tagTouched flag: blurring the Tooth field marks the Observation field, which
  // has never been focused, invalid. Measurement: aria-invalid and the invalid class on both inputs and the
  // hint text, before the blur and after it, plus where focus is (the Observation field was never left).
  // The Tooth field is left at its valid prefill so the mark on Observation cannot be a knock-on of an
  // invalid tooth. Negative control: per-field validation leaves the Observation input's aria-invalid null
  // after the Tooth field's blur, and the hint keeps its base sentence, so the check reports false. The
  // baseline read is required: a mark already present before the blur would not have been caused by it.
  async 'A-screens-perio-3-3'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await click(p, 'perio.tag.add'); await p.waitForTimeout(200);
      const read = async () => ({
        activeElement: await ACTIVE(p),
        tooth: { value: await p.evaluate(() => { const e = document.querySelector('[data-testid="perio.tag.tooth"]'); return e ? e.value : null; }),
          ariaInvalid: await ATTR(p, '[data-testid="perio.tag.tooth"]', 'aria-invalid'),
          invalidClass: await p.evaluate(() => { const e = document.querySelector('[data-testid="perio.tag.tooth"]'); return e ? e.classList.contains('invalid') : null; }) },
        text: { value: await p.evaluate(() => { const e = document.querySelector('[data-testid="perio.tag.text"]'); return e ? e.value : null; }),
          ariaInvalid: await ATTR(p, '[data-testid="perio.tag.text"]', 'aria-invalid'),
          invalidClass: await p.evaluate(() => { const e = document.querySelector('[data-testid="perio.tag.text"]'); return e ? e.classList.contains('invalid') : null; }) },
        hint: await TXTOF(p, '#pe-tag-hint'),
        tagTouched: (await ST(p, 'enc-9001')).tagTouched,
      });
      await p.focus('[data-testid="perio.tag.tooth"]');
      const before = await read();
      await p.keyboard.press('Tab'); await p.waitForTimeout(200);  // leave Tooth; land in Observation
      const after = await read();
      const observationEverBlurred = false;                        // focus entered it and has not left
      rec('A-screens-perio-3-3',
        'Blurring the Tooth field marks the Observation field invalid: one shared tagTouched flag makes a field the user has never left carry aria-invalid="true" and the hint "Say what you saw." while they are still typing in it',
        'CHECKLIST C7: validation is silent until blur',
        before.text.ariaInvalid === null && before.text.invalidClass === false && before.tagTouched === false
          && after.text.ariaInvalid === 'true' && after.text.invalidClass === true
          && after.tooth.ariaInvalid === null && after.tooth.invalidClass === false
          && after.activeElement.testid === 'perio.tag.text'
          && /Say what you saw\./.test(after.hint || '') && !/Say what you saw\./.test(before.hint || '')
          && observationEverBlurred === false,
        { beforeToothBlur: before, afterToothBlur: after,
          toothValueLeftValid: after.tooth.value, toothMarkedInvalid: after.tooth.ariaInvalid,
          observationFocusedNeverBlurred: after.activeElement, hintDelta: { before: before.hint, after: after.hint } });
    } finally { await c.close(); }
  },

  // RC-181 (C5) — the screening saved card pairs a clear "Recall" chip with the sentence "Full chart due".
  // Measurement: the chip's severity class, glyph and word, and the sentence in the same row, after a
  // screening save whose codes include a 3 and a 4; then the same row after a full-chart save with a deep
  // pocket, where the chip does follow the state ("Perio maintenance", required).
  // Negative control: if the chip tracked the screening outcome the word beside "Full chart due" would not
  // be the clear "Recall" and the check reports false. The contrast leg proves the chip is state-driven in
  // the other lane, so a mismatch here is the screening branch ignoring its own sentence, not a static label.
  async 'A-screens-perio-3-4'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      const nextRow = () => p.evaluate(() => {
        const s = document.querySelector('#canvas .pe-saved'); if (!s) return null;
        const row = s.querySelector('.pe-next'); if (!row) return null;
        const chip = row.querySelector('.chip');
        const rest = [...row.children].filter((e) => !e.classList.contains('chip')).map((e) => e.textContent.trim());
        return { chipWord: chip ? chip.textContent.replace(/[^A-Za-z \-]/g, '').trim() : null,
          chipSeverity: chip ? [...chip.classList].filter((x) => x !== 'chip').join(' ') : null,
          chipGlyph: chip ? (chip.querySelector('.glyph') || {}).textContent || null : null,
          sentence: rest.join(' '),
          codesLine: [...s.querySelectorAll('p')].map((e) => e.textContent.trim()).find((t) => /Screening codes|Chart status/.test(t)) || null,
          srp: [...s.querySelectorAll('p')].map((e) => e.textContent.trim()).find((t) => /Screening code \d indicates/.test(t)) || null };
      });

      await go(p, '#/hygienist/perio/enc-9001');
      await click(p, 'perio.screening'); await p.waitForTimeout(150);
      for (const k of ['1', '2', '3', '4', '0', '1']) { await p.keyboard.press(k); await p.waitForTimeout(60); }
      const stScr = await ST(p, 'enc-9001');
      await click(p, 'perio.save'); await p.waitForTimeout(400);
      const screening = await nextRow();
      const screeningExam = (await EXAMS(p, 'enc-9001')).pop() || null;
      const screeningLive = await LIVE(p);

      await reopen(p, go, '#/hygienist/perio/enc-9001');           // clean document: the full-chart lane
      const digits = '3'.repeat(168).split(''); digits[18] = '7';  // one 5 mm+ pocket
      await typeDigits(p, digits.join(''));
      await click(p, 'perio.save'); await p.waitForTimeout(400);
      const fullChart = await nextRow();

      rec('A-screens-perio-3-4',
        'The screening saved card shows the clear "●Recall" chip beside the sentence "Full chart due: a full six-point chart is booked into the next hygiene visit": the chip is chosen from the full-chart depth branch and ignores the screening codes',
        'CHECKLIST C5 / B5: a chip is glyph + word + fill for the state it labels, and the word agrees with the sentence it labels',
        !!screening && !!screeningExam && screeningExam.mode === 'screening'
          && stScr.sextants.some((x) => x === '3' || x === '4')
          && screening.chipWord === 'Recall' && screening.chipSeverity === 'clear' && screening.chipGlyph === '●'
          && /Full chart due/.test(screening.sentence || '')
          && !!fullChart && fullChart.chipWord !== screening.chipWord,
        { screeningSave: { sextantCodes: stScr.sextants, exam: screeningExam, chip: screening && { word: screening.chipWord, severity: screening.chipSeverity, glyph: screening.chipGlyph }, sentence: screening && screening.sentence, codesLine: screening && screening.codesLine, srpEvidenceOnCard: screening && screening.srp, announcement: screeningLive },
          fullChartContrast: fullChart && { chipWord: fullChart.chipWord, chipSeverity: fullChart.chipSeverity, sentence: fullChart.sentence },
          chipTracksDepthNotScreening: !!fullChart && !!screening && fullChart.chipWord !== screening.chipWord });
    } finally { await c.close(); }
  },

  // RC-182 (C5) — "Tag for Dr. Kim" is a literal fallback: a-1042's provider is the hygienist and no
  // dentist is on the record. Measurement: the tag form's h2 on enc-9001, the appointment's and the
  // encounter's providerId/role from the store, and the same h2 on enc-9020, whose provider IS a dentist.
  // Negative control: if the heading were derived, enc-9001 (no dentist) would not name one, and the
  // contrast leg proves the derived branch works — enc-9020 reads "Tag for Dr. Okafor" from the record.
  // If Dr. Kim had actually been this visit's provider the heading would be right and the check reports false.
  async 'A-screens-perio-3-5'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await click(p, 'perio.tag.add'); await p.waitForTimeout(200);
      const h2 = await TXTOF(p, '#canvas .pe-tag h2');
      const record = await p.evaluate(() => {
        const s = window.__proto.state();
        const a = s.appointments.find((x) => x.encounterId === 'enc-9001');
        const enc = s.encounters.find((x) => x.id === 'enc-9001');
        const u = a ? s.users.find((x) => x.id === a.providerId) : null;
        const kim = s.users.find((x) => x.short === 'Dr. Kim');
        return { appointment: a ? { id: a.id, providerId: a.providerId } : null,
          encounterProviderId: enc ? enc.providerId : null,
          provider: u ? { id: u.id, short: u.short, role: u.role } : null,
          dentistOnRecord: !!(u && u.role !== 'hygienist'),
          drKim: kim ? { id: kim.id, short: kim.short, role: kim.role } : null,
          drKimOnThisVisit: !!(a && kim && a.providerId === kim.id) };
      });
      const literalInSource = /: 'Dr\. Kim'/.test(PERIO_SRC);

      await reopen(p, go, '#/hygienist/perio/enc-9020');           // clean document: provider is a surgeon
      await click(p, 'perio.tag.add'); await p.waitForTimeout(200);
      const h2Contrast = await TXTOF(p, '#canvas .pe-tag h2');
      const contrastRecord = await p.evaluate(() => {
        const s = window.__proto.state();
        const a = s.appointments.find((x) => x.encounterId === 'enc-9020');
        const u = a ? s.users.find((x) => x.id === a.providerId) : null;
        return { appointmentId: a ? a.id : null, provider: u ? { id: u.id, short: u.short, role: u.role } : null };
      });

      rec('A-screens-perio-3-5',
        'The tag form on enc-9001 is headed "Tag for Dr. Kim" from a hard-coded fallback: the visit\'s provider is the hygienist Bree L. and no dentist is on the record, while enc-9020 (a real dentist on the record) reads its heading from the record',
        'CHECKLIST C5 / A7: a fact on screen is read from state, not from a literal; cited as C5 in the root cause',
        h2 === 'Tag for Dr. Kim' && !!record.provider && record.provider.role === 'hygienist'
          && record.dentistOnRecord === false && record.drKimOnThisVisit === false && literalInSource
          && h2Contrast === 'Tag for ' + (contrastRecord.provider || {}).short && h2Contrast !== 'Tag for Dr. Kim',
        { encounter: 'enc-9001', headingRendered: h2, recordForThisVisit: record, literalPresentInSource: literalInSource,
          contrast: { encounter: 'enc-9020', headingRendered: h2Contrast, record: contrastRecord,
            headingMatchesRecord: h2Contrast === 'Tag for ' + ((contrastRecord.provider || {}).short || '') } });
    } finally { await c.close(); }
  },

  // RC-183 (A2) — the Settings control opens a drawer that is appended below the grid, entirely below the
  // fold, with nothing scrolled and focus left on the toggle. Measurement: the section's rect against the
  // viewport at three widths, the scroll offsets of the document and of #canvas before and after the click,
  // aria-expanded on the toggle, and where focus is. It is measured separately whether the section is
  // merely off-screen (the scroller can bring it in) or out of reach: a box past the viewport edge inside a
  // scrollable container is not unreachable, and this one is not — the severity rests on that.
  // Negative control: if the drawer opened above the fold, or the code scrolled it in or moved focus to it,
  // top would be inside the viewport or the activeElement would be inside the section, and the check
  // reports false. The section must exist and aria-expanded must be true, so "not visible because it never
  // opened" cannot pass as this claim.
  async 'A-screens-perio-3-6'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    let c2 = null; let c3 = null;
    try {
      const measure = async (pg) => pg.evaluate(() => {
        const sec = document.getElementById('perio-settings');
        const canvas = document.getElementById('canvas');
        const de = document.scrollingElement;
        const cs = canvas ? getComputedStyle(canvas) : null;
        const r = sec ? sec.getBoundingClientRect() : null;
        return { sectionPresent: !!sec,
          rect: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) } : null,
          innerHeight: window.innerHeight,
          inView: r ? (r.top >= 0 && r.top < window.innerHeight) : null,
          documentScrollTop: Math.round(de.scrollTop), canvasScrollTop: canvas ? Math.round(canvas.scrollTop) : null,
          canvasOverflowY: cs ? cs.overflowY : null,
          canvasScrollable: canvas ? canvas.scrollHeight > canvas.clientHeight + 1 : null,
          documentScrollable: de.scrollHeight > de.clientHeight + 1 };
      });

      await go(p, '#/hygienist/perio/enc-9001');
      const beforeClick = await measure(p);
      await click(p, 'perio.settings'); await p.waitForTimeout(250);
      const desk = await measure(p);
      const expanded = await ATTR(p, '[data-testid="perio.settings"]', 'aria-expanded');
      const focusAfter = await ACTIVE(p);
      const focusInsideSection = await p.evaluate(() => { const s = document.getElementById('perio-settings'); return !!(s && document.activeElement && s.contains(document.activeElement)); });
      // Off-screen is not out of reach: bring it in through the scroller and re-measure.
      const afterScroll = await p.evaluate(() => {
        const s = document.getElementById('perio-settings'); if (!s) return null;
        s.scrollIntoView({ block: 'center', behavior: 'auto' });
        const r = s.getBoundingClientRect();
        return { top: Math.round(r.top), inView: r.top >= 0 && r.top < window.innerHeight };
      });

      // Fresh context per device: a second go() to the same URL would keep this screen's state.
      const op = await ctx(b, 1024, 768); c2 = op.c;
      await go(op.p, '#/hygienist/perio/enc-9001?device=operatory');
      await click(op.p, 'perio.settings'); await op.p.waitForTimeout(250);
      const operatory = await measure(op.p);

      const ph = await ctx(b, 420, 860); c3 = ph.c;
      await go(ph.p, '#/hygienist/perio/enc-9001?device=phone');
      await click(ph.p, 'perio.settings'); await ph.p.waitForTimeout(250);
      const phone = await measure(ph.p);

      const below = (m) => !!m.sectionPresent && m.rect && m.rect.top >= m.innerHeight;
      rec('A-screens-perio-3-6',
        'Pressing Settings opens the perio settings drawer entirely below the fold on every device (top 1049 px at 1280x900, 1071 at 1024x768, 1214 at 420x860) with nothing scrolled and focus left on the toggle',
        'CHECKLIST A2: the control does what its label and name promise — the drawer it opens is where the actor is looking',
        expanded === 'true' && below(desk) && below(operatory) && below(phone)
          && desk.documentScrollTop === 0 && desk.canvasScrollTop === 0
          && focusAfter.testid === 'perio.settings' && focusInsideSection === false,
        { deskBeforeClick: beforeClick,
          desk1280x900: desk, operatory1024x768: operatory, phone420x860: phone,
          toggleAriaExpanded: expanded, focusAfterOpen: focusAfter, focusInsideDrawer: focusInsideSection,
          reachability: { note: 'off-screen, not out of reach: the scroller brings it in', afterScrollIntoView: afterScroll,
            canvasOverflowY: desk.canvasOverflowY, canvasScrollable: desk.canvasScrollable, documentScrollable: desk.documentScrollable } });
    } finally { await c.close(); if (c2) await c2.close(); if (c3) await c3.close(); }
  },

  // RC-235 (B10, B4) — perio's two inline surfaces ignore Escape and let Tab walk out, and the licence
  // chooser has no dismiss at all, while the real dialogs on the same page close on Escape and return focus.
  // Measurement: the PIN pad (a Proto.ui.dialog) opened and closed with Escape in the same document — the
  // control that proves the key reaches a handler in this build — then the licence chooser and the tag form:
  // still present after Escape, their focusable lists, whether any of them is a dismiss, and where Tab from
  // the last one lands.
  // Negative control: if Escape closed the inline surfaces too, stillOpen is false and the check reports
  // false; the PIN pad leg must itself close, otherwise the Escape keypress proves nothing about the others.
  // A dismiss control anywhere in the chooser (a Cancel, Close or Back) makes noDismiss false.
  async 'A-screens-perio-3-7'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      const surface = (sel) => p.evaluate((s) => {
        const sec = document.querySelector(s); if (!sec) return { present: false };
        const f = [...sec.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"]), summary')];
        return { present: true,
          focusables: f.map((e) => ({ testid: e.getAttribute('data-testid'), text: (e.textContent || '').trim().slice(0, 40) })),
          dismissControls: f.filter((e) => /cancel|close|back|dismiss/i.test((e.getAttribute('data-testid') || '') + ' ' + (e.textContent || ''))).map((e) => e.getAttribute('data-testid')) };
      }, sel);

      // Control: a real Proto.ui.dialog on this very page.
      await go(p, '#/hygienist/perio/enc-9001');
      await click(p, 'topbar.author'); await p.waitForTimeout(200);
      const padOpen = await p.evaluate(() => !!document.querySelector('.overlay .dialog'));
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      const padAfterEscape = await p.evaluate(() => !!document.querySelector('.overlay .dialog'));
      const padFocus = await ACTIVE(p);

      // Inline surface 1: the omission licence chooser.
      await typeDigits(p, '345');
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const gate = await GATE(p, 'omission_licence');
      await click(p, 'refusal.control'); await p.waitForTimeout(250);
      const chooserOpen = await surface('#canvas .pe-licence');
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      const chooserAfterEscape = await surface('#canvas .pe-licence');
      const chooserStateAfterEscape = (await ST(p, 'enc-9001')).licenceOpen;
      /* The last focusable inside the chooser, read from the surface rather than named: the fix round
         collapsed the two-step licence step (choose a reason, then Confirm) into one, so a hard-coded
         `perio.licence.confirm` timed out and the whole check crashed — and a crashed check reports
         "not reproduced", which is a false pass. */
      /* The last focusable is read from the surface as it stands after Escape, not named and not read from
         the earlier snapshot. Two things changed under this leg: the fix round collapsed the two-step
         licence step, so the hard-coded `perio.licence.confirm` timed out, and Escape now closes the
         chooser, so the control from the pre-Escape snapshot is gone too. Either way the probe crashed, and
         a crashed check reports "not reproduced" — a false pass. When the chooser is already gone the Tab
         leg has nothing to measure and stays null; the predicate below already requires it to be present. */
      let afterTab = null, tabLeftSection = null, chooserLast = null;
      if (chooserAfterEscape.present) {
        chooserLast = (chooserAfterEscape.focusables || []).map((e) => e.testid).filter(Boolean).pop();
        if (chooserLast) {
          await p.focus('[data-testid="' + chooserLast + '"]');
          await p.keyboard.press('Tab'); await p.waitForTimeout(150);
          afterTab = await ACTIVE(p);
          tabLeftSection = await p.evaluate(() => { const s = document.querySelector('#canvas .pe-licence'); return !!(s && document.activeElement && !s.contains(document.activeElement)); });
        }
      }

      // Inline surface 2: the tag form (clean document, so the chart is not mid-gate).
      await reopen(p, go, '#/hygienist/perio/enc-9001');
      await click(p, 'perio.tag.add'); await p.waitForTimeout(200);
      const tagOpen = await surface('#canvas .pe-tag .card');
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      const tagAfterEscape = await surface('#canvas .pe-tag .card');
      const tagStateAfterEscape = (await ST(p, 'enc-9001')).tagOpen;

      rec('A-screens-perio-3-7',
        'Escape closes the real dialogs on this page and returns focus, but perio\'s two inline surfaces ignore it: the licence chooser stays open, Tab walks out of it into the page, and it carries no Cancel at all; the tag form also stays open (it at least has a Cancel)',
        'CHECKLIST B10 (dialogs hold focus and Escape closes them) and B4 (one shape for one concept)',
        padOpen === true && padAfterEscape === false && padFocus.testid === 'topbar.author'
          && !!gate && gate.code === 'omission_licence'
          && chooserOpen.present === true && chooserAfterEscape.present === true && chooserStateAfterEscape === true
          && chooserOpen.dismissControls.length === 0
          && tabLeftSection === true
          && tagOpen.present === true && tagAfterEscape.present === true && tagStateAfterEscape === true,
        { realDialogControl: { surface: 'topbar.author PIN pad (Proto.ui.dialog)', openedBeforeEscape: padOpen, presentAfterEscape: padAfterEscape, focusAfterEscape: padFocus },
          licenceChooser: { openedBy: gate && gate.control, focusables: chooserOpen.focusables, dismissControls: chooserOpen.dismissControls,
            presentAfterEscape: chooserAfterEscape.present, screenStateLicenceOpen: chooserStateAfterEscape,
            tabFromLastFocusableLandsOn: afterTab, tabLeftTheSection: tabLeftSection },
          tagForm: { focusables: tagOpen.focusables, dismissControls: tagOpen.dismissControls, presentAfterEscape: tagAfterEscape.present, screenStateTagOpen: tagStateAfterEscape } });
    } finally { await c.close(); }
  },

  // RC-245 (status "dead", C3/B4) — perio's MEANING table is defined and referenced nowhere; the meanings
  // the grammar actually returns are re-typed inline in apply() with different words. The same root cause
  // names two exported functions with no caller. Measurement: a reference scan of the source files (the
  // definition line excluded), the strings apply() returns for the same keys through the exported
  // Proto.screens.perio.apply, and typeof for the two exports in the browser.
  // Negative control: one more reference to MEANING anywhere in prototype/js, or a caller of
  // palette.isOpen / rail.render there, makes the corresponding list non-empty and the check reports false.
  // The typeof probe is required so "no caller" cannot be confused with "not exported at all".
  async 'A-screens-perio-3-8'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      // The regex is tested against the WHOLE line; the slice is for the evidence only. (Testing the
      // truncated text hid shell.js:113, the one real caller, and turned the positive control below false.)
      const scan = (rel, re) => readRepo(rel).split('\n')
        .map((l, i) => ({ line: i + 1, full: l.trim() }))
        .filter((x) => re.test(x.full))
        .map((x) => ({ line: x.line, text: x.full.slice(0, 200) }));
      const meaningRefs = scan('prototype/js/screens/perio.js', /\bMEANING\b/);
      const meaningDefLine = meaningRefs.length ? meaningRefs[0].line : null;
      const meaningUses = meaningRefs.filter((x) => !/^const MEANING\b/.test(x.text));
      // MEANING's own values, read from the source literal.
      const meaningLiteral = (() => {
        const m = /const MEANING = (\{[\s\S]*?\});/.exec(PERIO_SRC); if (!m) return null;
        const out = {};
        for (const mm of m[1].matchAll(/(?:'([^']*)'|([A-Za-z]+))\s*:\s*'([^']*)'/g)) out[mm[1] != null ? mm[1] : mm[2]] = mm[3];
        return out;
      })();

      await go(p, '#/hygienist/perio/enc-9001');
      // What the grammar really answers for the same keys (record one depth first so Space has a site).
      const applied = await p.evaluate(() => {
        const out = {};
        out['3 (depth)'] = Proto.screens.perio.apply('enc-9001', '3');
        for (const k of [' ', 's', 'Backspace', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp']) out[k === ' ' ? 'Space' : k] = Proto.screens.perio.apply('enc-9001', k);
        return out;
      });
      const exportsProbe = await p.evaluate(() => ({
        paletteIsOpen: typeof (Proto.screens.palette || {}).isOpen,
        railRender: typeof (Proto.screens.rail || {}).render,
        railIsOpen: typeof (Proto.screens.rail || {}).isOpen,
      }));

      const jsFiles = [...listRepo('prototype/js'), ...listRepo('prototype/js/screens')];
      const hits = (re) => { const out = []; for (const f of jsFiles) for (const row of scan(f, re)) out.push({ file: f, line: row.line, text: row.text }); return out; };
      const paletteIsOpenRefs = hits(/Proto\.screens\.palette\.isOpen/);
      const railRenderRefs = hits(/Proto\.screens\.rail\.render/);
      const railIsOpenRefs = hits(/Proto\.screens\.rail\.isOpen/);   // positive control: this export DOES have a caller
      const exportSites = hits(/Proto\.screens\.(palette|rail) = \{/);
      // The export lists themselves are definitions, not callers.
      const callerLike = (rows) => rows.filter((r) => !/Proto\.screens\.\w+ = \{/.test(r.text));

      const sameKeys = meaningLiteral ? Object.keys(meaningLiteral).map((k) => (k === ' ' ? 'Space' : k)).filter((k) => applied[k] != null) : [];
      const wordingDiffers = sameKeys.filter((k) => applied[k] !== meaningLiteral[k === 'Space' ? ' ' : k]);

      rec('A-screens-perio-3-8',
        'perio.js\'s MEANING table is defined at line 18 and referenced on no other line, while apply() answers the same keys with its own differently worded strings; Proto.screens.palette.isOpen and Proto.screens.rail.render are exported and called by nothing in prototype/js',
        'CHECKLIST status vocabulary "dead" (referenced nowhere in prototype/js), plus B4/C3 for two wordings of one key meaning',
        meaningDefLine === 18 && meaningUses.length === 0 && !!meaningLiteral
          && sameKeys.length >= 6 && wordingDiffers.length === sameKeys.length
          && callerLike(paletteIsOpenRefs).length === 0 && callerLike(railRenderRefs).length === 0
          && callerLike(railIsOpenRefs).length >= 1
          && exportsProbe.paletteIsOpen === 'function' && exportsProbe.railRender === 'function',
        { meaning: { definedAtLine: meaningDefLine, referencesFound: meaningRefs, usesOutsideDefinition: meaningUses, values: meaningLiteral },
          grammarStringsReturnedByApply: applied,
          keysComparedBothWays: sameKeys, keysWhereWordingDiffers: wordingDiffers,
          exportedNoCaller: { 'Proto.screens.palette.isOpen': { referencesInPrototypeJs: paletteIsOpenRefs, callersInPrototypeJs: callerLike(paletteIsOpenRefs) },
            'Proto.screens.rail.render': { referencesInPrototypeJs: railRenderRefs, callersInPrototypeJs: callerLike(railRenderRefs) },
            'Proto.screens.rail.isOpen (positive control: this one has a caller)': { referencesInPrototypeJs: railIsOpenRefs, callersInPrototypeJs: callerLike(railIsOpenRefs) } },
          exportSites, typeofInBrowser: exportsProbe, filesScanned: jsFiles });
    } finally { await c.close(); }
  },
});
