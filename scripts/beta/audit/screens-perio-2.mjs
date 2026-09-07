// Audit checks for prototype/js/screens/perio.js, chunk screens-perio-2.
// Root causes in order: RC-116, RC-117, RC-118, RC-119, RC-120, RC-121, RC-122, RC-178, RC-214, RC-224.
// Default position is NOT reproduced: each check drives the prototype, takes the measurement the claim
// depends on, and carries the measured values in evidence.
//
// CSS note: nothing here reads document.styleSheets. Over file:// cssRules access throws and a
// catch-and-continue silently returns an empty rule list, which reads as "no rule" for every claim.
// Where a check needs a rendered consequence it measures the DOM (text, geometry, getComputedStyle).
import fs from 'node:fs';

const CONTRACTS = (() => { try { return fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return ''; } })();
const S7_FLOW2 = (() => { const m = CONTRACTS.match(/\n2\. Perio: ([^\n]*)/); return m ? m[0].trim() : ''; })();

// ---- shared measurement helpers (browser side only; no lib.cjs) ------------------------------
const SEQ = (p) => p.evaluate(() => (window.__events[window.__events.length - 1] || { seq: 0 }).seq);
const AFTER = (p, from) => p.evaluate((f) => window.__events.filter((e) => e.seq > f).map((e) => ({
  seq: e.seq, kind: e.kind, testid: e.testid, key: e.key, field: e.field || false, synthetic: e.synthetic || false,
  table: e.table, id: e.id, code: e.code, verb: e.verb, control: e.control,
})), from);
// CONTRACTS §5 tap accounting.
const TAPS = (evs) => evs.filter((e) => (e.kind === 'click' && !e.synthetic && e.testid) || (e.kind === 'key' && (e.key === 'Enter' || e.key === ' ') && e.testid && !e.field));
const WRITES = (evs) => evs.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
const REFUSALS = (evs) => evs.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));

const GATE = (p, code) => p.evaluate((wanted) => {
  const nodes = [...document.querySelectorAll('#canvas .refusal')];
  const r = wanted ? nodes.find((n) => n.dataset.code === wanted) : nodes[0];
  if (!r) return null;
  const v = r.querySelector('[data-testid="refusal.verb"]'); const c = r.querySelector('[data-testid="refusal.control"]');
  return {
    code: r.dataset.code || null,
    verb: v ? v.textContent.trim() : null,
    verbWords: v ? v.textContent.trim().split(/\s+/).length : null,
    verbFirstWord: v ? v.textContent.trim().split(/\s+/)[0] : null,
    control: c ? c.textContent.trim() : null,
    why: (r.querySelector('.whytext') || {}).textContent || null,
  };
}, code || null);

const LIVE = (p) => p.evaluate(() => (document.getElementById('live') || {}).textContent || '');
const HEAD = (p) => p.evaluate(() => ({
  h1: (document.querySelector('#canvas h1') || {}).textContent || null,
  sub: (document.querySelector('#canvas .sub') || {}).textContent || null,
  legend: (document.querySelector('#canvas .pe-legend') || {}).textContent || null,
  active: (document.querySelector('#canvas .activesite') || {}).textContent || null,
  gridCells: document.querySelectorAll('#canvas table.perio .psite').length,
  sextantBoxes: document.querySelectorAll('#canvas [data-testid^="perio.sextant."]').length,
}));
const ST = (p, encId) => p.evaluate((id) => {
  const e = Proto.store.encounter(id); if (!e) return null;
  const st = Proto.screens.perio.stateFor(e);
  const toothOf = (k) => Number(k.slice(1, k.indexOf('-')));
  const cur = st.path[st.cur] || null;
  const entered = Object.entries(st.sites).filter(([, v]) => v.depth != null).sort((a, b) => b[1].depth - a[1].depth);
  const deep = entered[0] || null;
  return {
    mode: st.mode, cur: st.cur, pathLen: st.path.length,
    cursorKey: cur, cursorTooth: cur ? toothOf(cur) : null,
    deepestKey: deep ? deep[0] : null, deepestTooth: deep ? toothOf(deep[0]) : null, deepestDepth: deep ? deep[1].depth : null,
    probed: entered.length, tagTooth: st.tagTooth, saved: st.saved ? st.saved.id : null,
    sextants: st.sextants.slice(), gate: st.gate ? st.gate.code : null,
  };
}, encId);
const WHO = (p) => p.evaluate(() => { const u = Proto.store.currentUser(); return { persona: window.__proto.persona, device: window.__proto.device, name: u.name, licence: u.licence || null }; });
const EXAMS = (p, encId) => p.evaluate((id) => window.__proto.state().perioExams.filter((e) => e.encounterId === id).map((e) => ({ id: e.id, author: e.author, probed: e.probed, skipped: e.skipped, licence: e.licence || null, mode: e.mode })), encId);
const TXTOF = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const ATTR = (p, sel, name) => p.evaluate(([s, n]) => { const e = document.querySelector(s); return e ? e.getAttribute(n) : null; }, [sel, name]);

const sentencesOf = (t) => String(t || '').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const wordsOf = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
// Which surface words a concept is expressed with, and where each was read.
function variants(sources, patterns) {
  const out = {};
  for (const [word, re] of Object.entries(patterns)) {
    const where = sources.filter(([, text]) => text && re.test(text)).map(([src]) => src);
    if (where.length) out[word] = where;
  }
  return out;
}
async function typeDigits(p, s) { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(200); }
// A second go() to the same file URL is a same-document navigation: the document, and with it the
// screen's in-memory chart state, survives. Blank the page first so the second leg starts clean.
async function reopen(p, go, hash) { await p.goto('about:blank'); await go(p, hash); }

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => ({

  // RC-116 (C6) — the screening lane keeps the full-chart key hints and the cell legend.
  // Measurement: the page-head sub line and the legend line in both lanes, plus whether the keys the sub
  // advertises actually work in the screening lane (7 is inert there; 4 codes a sextant).
  // Negative control: if the sub switched to the screening grammar (0–4 or *) the two sub strings would
  // differ and the full-chart hint substrings would be gone, so `same` is false and the check reports false.
  // If '7' did fill a sextant the advertised key would be true and inertKeyIgnored is false → check false.
  async 'A-screens-perio-2-1'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      const full = await HEAD(p);
      await click(p, 'perio.screening'); await p.waitForTimeout(150);
      const scr = await HEAD(p);
      const stBefore = await ST(p, 'enc-9001');
      await p.keyboard.press('7'); await p.waitForTimeout(120);      // '1–9 depth' is advertised in this lane
      const stAfter7 = await ST(p, 'enc-9001');
      await p.keyboard.press('4'); await p.waitForTimeout(120);      // the lane's real grammar
      const stAfter4 = await ST(p, 'enc-9001');
      const HINTS = ['Keys: 1–9 depth', 'Space bleed', 'S suppuration', '⌫ undo', '→ skip', 'PgDn next tooth'];
      const hintsPresent = HINTS.filter((x) => (scr.sub || '').includes(x));
      const legendKept = (scr.legend || '').includes('shaded = 5 mm or deeper') && (scr.legend || '').includes('● bleeding');
      const inertKeyIgnored = JSON.stringify(stBefore.sextants) === JSON.stringify(stAfter7.sextants);
      const realKeyWorked = stAfter4.sextants[0] === '4';
      const inScreening = scr.sextantBoxes === 6 && scr.gridCells === 0;
      rec('A-screens-perio-2-1',
        'In the screening lane the page-head sub still lists the full-chart key grammar and the legend still explains grid cells, so the instructions on screen describe keys the lane ignores',
        'CHECKLIST C6 / C1-C2 clarity: the explanation on the finish path matches the lane the operator is in',
        inScreening && full.sub === scr.sub && hintsPresent.length === HINTS.length && legendKept && inertKeyIgnored && realKeyWorked,
        { subFullLane: full.sub, subScreeningLane: scr.sub, subIdentical: full.sub === scr.sub, hintsStillShown: hintsPresent,
          legendScreeningLane: scr.legend, legendIdentical: full.legend === scr.legend,
          activeLineScreening: scr.active, sextantBoxes: scr.sextantBoxes, gridCells: scr.gridCells,
          sextantsBefore: stBefore.sextants, afterKey7: stAfter7.sextants, afterKey4: stAfter4.sextants,
          advertisedKey7Inert: inertKeyIgnored, laneKey4Works: realKeyWorked });
    } finally { await c.close(); }
  },

  // RC-117 (B2) — depth_gt_15's verb line is nine words, and it and exam_sealed both start with the noun.
  // Measurement: each verb line, its word count, its first word, and the refusal event's own code.
  // Negative control: matched by code, not by "a refusal appeared" — if the gate raised were some other
  // code the check reports false. A verb of eight words or fewer that begins with an imperative
  // ("Re-enter the depth…", "Start an addendum…") would give words <= 8 and a first word that is not the
  // subject noun, so the check reports false.
  async 'A-screens-perio-2-2'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      const seq0 = await SEQ(p);
      await p.keyboard.press('0'); await p.waitForTimeout(80);
      await p.keyboard.press('7'); await p.waitForTimeout(200);      // 0 then 7 = 17 mm, above the 15 mm limit
      const depthGate = await GATE(p, 'depth_gt_15');
      const depthEvents = REFUSALS(await AFTER(p, seq0));

      await reopen(p, go, '#/hygienist/perio/enc-9001');             // fresh document for the sealed-exam gate
      await typeDigits(p, '3'.repeat(168));
      await click(p, 'perio.save'); await p.waitForTimeout(300);
      const savedId = (await ST(p, 'enc-9001')).saved;
      const seq1 = await SEQ(p);
      await p.keyboard.press('3'); await p.waitForTimeout(250);      // a key on a filed exam
      const sealedGate = await GATE(p, 'exam_sealed');
      const sealedEvents = REFUSALS(await AFTER(p, seq1));

      const depthOk = !!depthGate && depthGate.code === 'depth_gt_15' && depthEvents.some((e) => e.code === 'depth_gt_15');
      const sealedOk = !!sealedGate && sealedGate.code === 'exam_sealed' && sealedEvents.some((e) => e.code === 'exam_sealed');
      rec('A-screens-perio-2-2',
        'The depth_gt_15 verb line is nine words (over the eight-word limit) and, like exam_sealed, opens with the noun instead of a verb',
        'CONTRACTS §6 / CHECKLIST B2: the verb line is verb-first and at most eight words',
        depthOk && sealedOk && depthGate.verbWords > 8 && depthGate.verbFirstWord === 'Depth' && sealedGate.verbFirstWord === 'Exam',
        { depth_gt_15: { verb: depthGate && depthGate.verb, words: depthGate && depthGate.verbWords, firstWord: depthGate && depthGate.verbFirstWord, control: depthGate && depthGate.control, limit: 8 },
          exam_sealed: { verb: sealedGate && sealedGate.verb, words: sealedGate && sealedGate.verbWords, firstWord: sealedGate && sealedGate.verbFirstWord, control: sealedGate && sealedGate.control },
          savedExam: savedId, refusalEventsDepth: depthEvents, refusalEventsSealed: sealedEvents });
    } finally { await c.close(); }
  },

  // RC-118 (B4) — one screen names one concept several ways.
  // Measurement: the exact strings the screen renders for four concepts, and where each was read.
  // Negative control: if the screen used one word per concept (only "filed", only "reason", only
  // "bleeding", only "suppuration") each variants map would hold one key and the check reports false.
  async 'A-screens-perio-2-3'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      const head = await HEAD(p);
      const saveLabel = await TXTOF(p, '[data-testid="perio.save"]');
      await click(p, 'perio.pad.toggle'); await p.waitForTimeout(150);
      const padSupp = await TXTOF(p, '[data-testid="perio.pad.supp"]');
      const padBleed = await TXTOF(p, '[data-testid="perio.pad.bleed"]');
      const padSkipAria = await ATTR(p, '[data-testid="perio.pad.skip"]', 'aria-label');

      await typeDigits(p, '3'.repeat(30));                            // 138 sites left unprobed
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const omission = await GATE(p, 'omission_licence');
      await click(p, 'refusal.control'); await p.waitForTimeout(200);
      const licenceCard = await p.evaluate(() => {
        const s = document.querySelector('#canvas .pe-licence'); if (!s) return null;
        return { sectionAria: s.getAttribute('aria-label'), h2: (s.querySelector('h2') || {}).textContent || null,
          blurb: (s.querySelector('p') || {}).textContent || null,
          segAria: (s.querySelector('.seg') || {}).getAttribute ? s.querySelector('.seg').getAttribute('aria-label') : null,
          reasonButtons: [...s.querySelectorAll('[data-testid^="perio.licence."]')].map((e) => e.getAttribute('data-testid')) };
      });
      const confirmAfter = await TXTOF(p, '[data-testid="perio.licence.not_tolerated"]');
      // Choosing the reason saves; the separate Confirm step was collapsed by the fix round (§7 tap budget).
      await click(p, 'perio.licence.not_tolerated'); await p.waitForTimeout(350);
      const saved = await p.evaluate(() => {
        const s = document.querySelector('#canvas .pe-saved'); if (!s) return null;
        return { chip: (s.querySelector('.chip') || {}).textContent || null, h2: (s.querySelector('h2') || {}).textContent || null,
          status: [...s.querySelectorAll('p')].map((e) => e.textContent.trim()).join(' | ') };
      });
      const activeAfterSave = await TXTOF(p, '#canvas .activesite');
      const amendLabel = await TXTOF(p, '[data-testid="perio.amend"]');
      await p.keyboard.press('3'); await p.waitForTimeout(250);
      const sealed = await GATE(p, 'exam_sealed');

      const sources = [
        ['head.sub', head.sub], ['legend', head.legend], ['perio.save label', saveLabel],
        ['pad.supp label', padSupp], ['pad.bleed label', padBleed], ['pad.skip aria-label', padSkipAria],
        ['omission verb', omission && omission.verb], ['omission control', omission && omission.control], ['omission why', omission && omission.why],
        ['licence section aria', licenceCard && licenceCard.sectionAria], ['licence h2', licenceCard && licenceCard.h2],
        ['licence blurb', licenceCard && licenceCard.blurb], ['licence seg aria', licenceCard && licenceCard.segAria],
        ['licence confirm (before pick)', licenceCard && licenceCard.confirmBefore], ['licence confirm (after pick)', confirmAfter],
        ['saved chip', saved && saved.chip], ['saved h2', saved && saved.h2], ['saved status', saved && saved.status],
        ['active line after save', activeAfterSave], ['amend button', amendLabel],
        ['exam_sealed verb', sealed && sealed.verb], ['exam_sealed control', sealed && sealed.control], ['exam_sealed why', sealed && sealed.why],
      ];
      const seal = variants(sources, { 'save/saved': /\bsaved?\b/i, 'file/filed': /\bfiled?\b/i });
      const licence = variants(sources, { licence: /licence/i, reason: /reason/i });
      const bleeding = variants(sources, { Bld: /\bBld\b/, bleed: /\bbleed\b/i, bleeding: /\bbleeding\b/i });
      const supp = variants(sources, { Pus: /\bPus\b/, suppuration: /suppuration/i });
      const skipped = variants(sources, { skip: /\bskip\b/i, 'not probed': /not probed/i });
      const n = (v) => Object.keys(v).length;
      rec('A-screens-perio-2-3',
        'One perio screen names one concept several ways: saved vs filed, licence vs reason, Bld/bleed/bleeding, Pus vs suppuration, skip vs not probed',
        'CHECKLIST B4: one canonical word per concept across screens, refusals and announcements',
        n(seal) >= 2 && n(licence) >= 2 && n(bleeding) >= 2 && n(supp) >= 2,
        { sealingAct: seal, omissionReason: licence, bleedingConcept: bleeding, suppurationConcept: supp, skippedSiteConcept: skipped,
          strings: Object.fromEntries(sources.filter(([, t]) => t)) });
    } finally { await c.close(); }
  },

  // RC-119 (A6) — an unknown encounter id renders a perio-local not-found page instead of shell notfound.
  // Measurement: the h1 and the testids the unknown-id page offers, against the shell's own notfound page
  // reached in the same context by an unknown route.
  // Negative control: if perio delegated to the shell the two h1s would match and notfound.home would be
  // present on both, so the check reports false. A page error would also be recorded, not swallowed.
  async 'A-screens-perio-2-4'(b) {
    const { c, p, errs } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9999');
      const perioPage = await p.evaluate(() => ({
        h1: (document.querySelector('#canvas h1') || {}).textContent || null,
        testids: [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid')),
        rawIdOnScreen: /enc-9999/.test(document.getElementById('canvas').textContent),
      }));
      await hop(p, '#/hygienist/no-such-route'); await p.waitForTimeout(200);
      const shellPage = await p.evaluate(() => ({
        h1: (document.querySelector('#canvas h1') || {}).textContent || null,
        testids: [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid')),
      }));
      rec('A-screens-perio-2-4',
        'An unknown encounter id renders a perio-local "No encounter enc-9999" page (raw id, Back to Chairs) instead of the shell notfound page',
        'CHECKLIST A6: an unknown id lands on notfound; CONTRACTS §2 routes',
        perioPage.h1 === 'No encounter enc-9999' && !perioPage.testids.includes('notfound.home')
          && shellPage.h1 === 'Nothing here' && shellPage.testids.includes('notfound.home'),
        { perioUnknownId: perioPage, shellNotfound: shellPage, pageErrors: errs });
    } finally { await c.close(); }
  },

  // RC-120 (A2) — the perio author gate tests only device === 'shared', so the same licence-less author
  // saves a clinical exam on a desk. Measurement: the write events and the refusal events in the seq range
  // for the desk save, the stored exam's author, and the same user on a shared device for contrast.
  // Negative control: if a licence gate fired on the desk there would be a refusal event and no
  // perioExams write, so the check reports false. The contrast leg must itself refuse (pin_required) —
  // if it did not, the difference measured would not be the device condition.
  async 'A-screens-perio-2-5'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/frontdesk/perio/enc-9001');
      const who = await WHO(p);
      await typeDigits(p, '3'.repeat(168));
      const seq0 = await SEQ(p);
      const before = await EXAMS(p, 'enc-9001');
      await click(p, 'perio.save'); await p.waitForTimeout(350);
      const evs = await AFTER(p, seq0);
      const after = await EXAMS(p, 'enc-9001');
      const gateOnDesk = await GATE(p);

      await reopen(p, go, '#/frontdesk/perio/enc-9001?device=shared'); // same user, same encounter, shared glass
      const whoShared = await WHO(p);
      const seq1 = await SEQ(p);
      await click(p, 'perio.save'); await p.waitForTimeout(300);
      const sharedGate = await GATE(p, 'pin_required');
      const sharedEvents = REFUSALS(await AFTER(p, seq1));

      const wroteExam = WRITES(evs).some((w) => w.table === 'perioExams');
      rec('A-screens-perio-2-5',
        'The perio author gate checks only device === "shared", so the front-desk author (licence null) saves a perio exam on a desk with no refusal',
        'CHECKLIST A2: the control does what its label promises; CONTRACTS §6 licence_scope / entitlement',
        who.licence === null && wroteExam && !gateOnDesk && REFUSALS(evs).length === 0
          && after.length === before.length + 1 && after[after.length - 1].author === who.name
          && !!sharedGate && sharedGate.code === 'pin_required',
        { author: who, examsBefore: before, examsAfter: after,
          stateDiff: { perioExamsBefore: before.length, perioExamsAfter: after.length },
          writesInRange: WRITES(evs), refusalsInRange: REFUSALS(evs), gateOnDesk,
          sharedDeviceContrast: { user: whoShared, gate: sharedGate, refusalEvents: sharedEvents } });
    } finally { await c.close(); }
  },

  // RC-121 (A2) — doSave prefills the tag form with the deepest-pocket tooth, not the tooth being tagged.
  // Measurement: the cursor tooth at save time, the deepest recorded tooth, st.tagTooth after doSave, and
  // the value the tooth input opens with.
  // Negative control: if doSave left tagTooth alone, "Tag for dentist" would fill it from the cursor
  // (tooth 12 here) or leave it empty, so inputValue would not equal the deepest tooth → check false.
  // The two teeth are made different on purpose; if they coincided the measurement would prove nothing.
  async 'A-screens-perio-2-6'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      // 30 depths along the default facial path: teeth 2..11. Index 18 is tooth 8 site 1 → the only deep site.
      const digits = '3'.repeat(30).split(''); digits[18] = '7';
      await typeDigits(p, digits.join(''));
      const atSave = await ST(p, 'enc-9001');
      await click(p, 'perio.save'); await p.waitForTimeout(250);      // omission gate: 138 sites unprobed
      await click(p, 'refusal.control'); await p.waitForTimeout(200);
      await click(p, 'perio.licence.implant'); await p.waitForTimeout(350);   // the reason saves; Confirm was collapsed
      const afterSave = await ST(p, 'enc-9001');
      await click(p, 'perio.tag.add'); await p.waitForTimeout(200);
      const inputValue = await p.evaluate(() => { const e = document.querySelector('[data-testid="perio.tag.tooth"]'); return e ? e.value : null; });
      rec('A-screens-perio-2-6',
        'After a save the tag form opens on the deepest-pocket tooth (8) rather than the tooth the hygienist is tagging: doSave overwrites tagTooth with the deepest site',
        'CHECKLIST A2 / C2: the control starts on what the actor is acting on',
        !!afterSave && afterSave.saved !== null && afterSave.deepestTooth !== atSave.cursorTooth
          && afterSave.tagTooth === String(afterSave.deepestTooth) && inputValue === String(afterSave.deepestTooth),
        { cursorToothAtSave: atSave.cursorTooth, cursorKeyAtSave: atSave.cursorKey,
          deepestTooth: afterSave && afterSave.deepestTooth, deepestSite: afterSave && afterSave.deepestKey, deepestDepth: afterSave && afterSave.deepestDepth,
          tagToothAfterSave: afterSave && afterSave.tagTooth, toothInputValue: inputValue, savedExam: afterSave && afterSave.saved, sitesRecorded: atSave.probed });
    } finally { await c.close(); }
  },

  // RC-122 (A2) — the omission gate costs four taps where §7 budgets one licence tap on top of Save.
  // Measurement: every tap (CONTRACTS §5 accounting) from Save to the perioExams write, plus proof that
  // no leg can be skipped: the licence buttons do not exist before refusal.control, and the confirm button
  // is Held until a licence is chosen.
  // Negative control: if the gate offered the licences in the refusal itself the tap list would be
  // Save + licence = 2 and the check reports false. If nothing was written the flow did not complete and
  // the count would not be a minimal path, so the write event is required too.
  async 'A-screens-perio-2-7'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await typeDigits(p, '3'.repeat(30));
      const seq0 = await SEQ(p);
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const gate = await GATE(p, 'omission_licence');
      /* Counts what the save actually costs rather than the old four-step shape. The original predicate
         required taps === 4 AND a held `perio.licence.confirm`; once the fix round collapsed that step the
         conjunction could never be true again, so the check would have reported clean even at five taps.
         What §7 flow 2 budgets is Save plus one reason tap, so that is what is measured: the reasons must
         stand on the page with the gate (no intervening control press) and the save must cost two taps. */
      const licenceBtnsWithGate = await p.evaluate(() => document.querySelectorAll('[data-testid^="perio.licence."]:not([data-testid="perio.licence.cancel"])').length);
      await click(p, 'perio.licence.implant'); await p.waitForTimeout(350);
      const evs = await AFTER(p, seq0);
      const taps = TAPS(evs).map((e) => ({ seq: e.seq, testid: e.testid }));
      const writes = WRITES(evs);
      const wrote = writes.some((w) => w.table === 'perioExams');
      rec('A-screens-perio-2-7',
        'Saving a chart with skipped sites costs more taps than CONTRACTS §7 flow 2 budgets (Save plus one reason tap), because the reasons do not stand on the page with the gate',
        'CHECKLIST A2 / CONTRACTS §7 flow 2 and §5 tap accounting',
        wrote && (taps.length > 2 || licenceBtnsWithGate === 0),
        { tapsFromSaveToWrite: taps, tapCount: taps.length, budgetedTaps: 2, contractsS7Flow2: S7_FLOW2,
          writesInRange: writes, gate: gate, examWritten: wrote,
          reasonButtonsStandingWithTheGate: licenceBtnsWithGate });
    } finally { await c.close(); }
  },

  // RC-178 (C8) — the Save announcement is prose, not one verb line.
  // Measurement: the #live text after Save in each lane, with its sentence and word counts.
  // Negative control: a one-line announcement ("Exam saved") splits into one sentence, so sentences >= 2
  // is false and the check reports false. The text is read from #live (the aria-live region) after the
  // announce timer, not from the page body.
  async 'A-screens-perio-2-8'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      const digits = '3'.repeat(168).split(''); digits[18] = '7';    // one 7 mm site: the deeper recall line
      await typeDigits(p, digits.join(''));
      await click(p, 'perio.save'); await p.waitForTimeout(400);
      const savedFull = (await ST(p, 'enc-9001')).saved;
      const fullLive = await LIVE(p);

      await reopen(p, go, '#/hygienist/perio/enc-9001');             // fresh document: the screening lane
      await click(p, 'perio.screening'); await p.waitForTimeout(150);
      for (const k of ['1', '2', '3', '4', '0', '1']) { await p.keyboard.press(k); await p.waitForTimeout(60); }
      await click(p, 'perio.save'); await p.waitForTimeout(400);
      const stScr = await ST(p, 'enc-9001');
      const scrLive = await LIVE(p);

      const fullS = sentencesOf(fullLive); const scrS = sentencesOf(scrLive);
      rec('A-screens-perio-2-8',
        'The Save announcement is prose: the full-chart save announces three sentences and the screening save three sentences of more than thirty words, where an announcement is one verb line',
        'CHECKLIST C8: announcements (aria-live) are one verb line, not prose',
        !!savedFull && !!stScr.saved && fullS.length >= 2 && wordsOf(fullLive) > 8 && scrS.length >= 2 && wordsOf(scrLive) > 30,
        { fullChartSave: { exam: savedFull, live: fullLive, words: wordsOf(fullLive), sentences: fullS.length, parts: fullS },
          screeningSave: { exam: stScr.saved, sextants: stScr.sextants, live: scrLive, words: wordsOf(scrLive), sentences: scrS.length, parts: scrS },
          region: '#live (aria-live="polite")' });
    } finally { await c.close(); }
  },

  // RC-214 (B4, B2) — one refusal code, two different verb lines and two different controls.
  // Measurement: on each screen, the refusal EVENT's code (not merely "a refusal appeared"), the rendered
  // verb line and the rendered control.
  // Negative control: the comparison is keyed on the code — if the perio gate raised anything other than
  // pin_required, or the checkout gate raised tender_required or already_decided instead, the check
  // reports false rather than comparing two unrelated refusals. If both screens rendered the same verb and
  // the same control for pin_required, the differences are empty and the check reports false.
  async 'A-screens-perio-2-9'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/frontdesk/perio/enc-9001?device=shared');
      const seq0 = await SEQ(p);
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const perioGate = await GATE(p, 'pin_required');
      const perioEvents = REFUSALS(await AFTER(p, seq0)).filter((e) => e.code === 'pin_required');

      await reopen(p, go, '#/frontdesk/checkout/a-1044?device=shared');
      const seq1 = await SEQ(p);
      await click(p, 'checkout.tender.card'); await p.waitForTimeout(120);
      await click(p, 'checkout.post'); await p.waitForTimeout(300);
      const coGate = await GATE(p, 'pin_required');
      const coEvents = REFUSALS(await AFTER(p, seq1)).filter((e) => e.code === 'pin_required');

      const bothRaised = perioEvents.length > 0 && coEvents.length > 0 && !!perioGate && !!coGate;
      rec('A-screens-perio-2-9',
        'The pin_required code carries a different verb line and a different control on Perio ("Switch author to the hygienist before Save" / "Who is charting?") than on Checkout ("Enter your PIN to post" / "Enter PIN")',
        'CHECKLIST B4 and B2 / CONTRACTS §6: one code means one thing and is phrased one way',
        bothRaised && perioGate.verb !== coGate.verb && perioGate.control !== coGate.control,
        { code: 'pin_required',
          perio: { hash: '#/frontdesk/perio/enc-9001?device=shared', verb: perioGate && perioGate.verb, control: perioGate && perioGate.control, why: perioGate && perioGate.why, events: perioEvents },
          checkout: { hash: '#/frontdesk/checkout/a-1044?device=shared', verb: coGate && coGate.verb, control: coGate && coGate.control, why: coGate && coGate.why, events: coEvents },
          verbsDiffer: !!(perioGate && coGate) && perioGate.verb !== coGate.verb,
          controlsDiffer: !!(perioGate && coGate) && perioGate.control !== coGate.control });
    } finally { await c.close(); }
  },

  // RC-224 (B4, C2) — the control that opens the PIN pad has two labels, one of them a question.
  // Measurement: the perio pin_required control's label and that it really opens the pad; the pad dialog's
  // aria-label and its h2; and the Encounter read-back button that opens the same pad.
  // Negative control: the perio control must open the pad (pin.key.1 present) — otherwise it is not the
  // same action and the comparison would be meaningless, and the check reports false. If every site said
  // "Switch author" the labels would match and the check reports false.
  async 'A-screens-perio-2-10'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/frontdesk/perio/enc-9001?device=shared');
      const seq0 = await SEQ(p);
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const perioGate = await GATE(p, 'pin_required');
      const perioRefusalEvents = REFUSALS(await AFTER(p, seq0)).filter((e) => e.code === 'pin_required');
      await click(p, 'refusal.control'); await p.waitForTimeout(250);
      const pad = await p.evaluate(() => {
        const d = document.querySelector('.overlay .dialog'); if (!d) return null;
        return { ariaLabel: d.getAttribute('aria-label'), h2: (d.querySelector('h2') || {}).textContent || null, hasPinKeys: !!d.querySelector('[data-testid="pin.key.1"]') };
      });
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);

      await reopen(p, go, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
      await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(350);
      const encSwitch = await TXTOF(p, '[data-testid="enc.readback.switch"]');
      const encOpensPad = await p.evaluate(() => !!document.querySelector('[data-testid="enc.readback.switch"]'));

      const sameAction = !!pad && pad.hasPinKeys === true;
      rec('A-screens-perio-2-10',
        'The control that opens the PIN pad is "Who is charting?" on Perio but "Switch author" on Encounter and in the pad\'s own dialog label, whose heading is the question again',
        'CHECKLIST B4 and C2: one label for one action; a control is a verb',
        sameAction && !!perioGate && perioGate.control === 'Who is charting?' && pad.ariaLabel === 'Switch author'
          && pad.h2 === 'Who is charting?' && encSwitch === 'Switch author' && perioGate.control !== encSwitch,
        { perioControlLabel: perioGate && perioGate.control, perioVerb: perioGate && perioGate.verb, perioRefusalEvents,
          perioControlOpensPinPad: sameAction, pinPadDialog: pad,
          encounterButtonLabel: encSwitch, encounterButtonPresent: encOpensPad,
          labelsDiffer: !!perioGate && perioGate.control !== encSwitch,
          dialogLabelVsHeading: pad ? { ariaLabel: pad.ariaLabel, h2: pad.h2, differ: pad.ariaLabel !== pad.h2 } : null });
    } finally { await c.close(); }
  },
});
