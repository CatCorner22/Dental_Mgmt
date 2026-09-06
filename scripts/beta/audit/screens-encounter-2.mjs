/* Function-audit checks for prototype/js/screens/encounter.js, chunk screens-encounter-2.
   Root causes, in order: RC-94, RC-95, RC-163, RC-247, RC-161, RC-162, RC-164, RC-165, RC-166, RC-167.
   Default position is NOT reproduced: every check drives the prototype and measures the breach.
   CSS consequences are measured through getComputedStyle only — document.styleSheets.cssRules throws
   over file:// and a swallowed error would silently report "no rules". */

// CONTRACTS §4, the two rows that can put an id inside #canvas on an encounter route, quoted verbatim.
const S4_ENCOUNTER_ROW = '`exams.row.<encId>`, `exams.row.<encId>.open`, `enc.tag.<tagId>.chart`, `enc.tag.<tagId>.dismiss`, `enc.tooth.<1-32>`, `enc.surface.<tooth>.<m|o|d|b|l>`, `enc.proc.<cdt>`, `enc.temporality.<today|planned|existing>`, `enc.note.field.<id>`, `enc.note.starter.<n>`, `enc.killer.<n>.fix`, `enc.readback.switch`, `enc.file`, `enc.undo`';
const S4_REFUSAL_ROW = '`refusal.verb`, `refusal.control`, `refusal.why`';
const S4_ENTRIES = (S4_ENCOUNTER_ROW + ', ' + S4_REFUSAL_ROW).match(/`([^`]+)`/g).map((x) => x.slice(1, -1));
const s4Matcher = (entry) => new RegExp('^' + entry.split(/(<[^>]+>)/).map((piece) => {
  if (!piece.startsWith('<')) return piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const inner = piece.slice(1, -1);
  if (/^\d+-\d+$/.test(inner)) return '\\d{1,2}';
  if (inner.includes('|')) return '(?:' + inner + ')';
  return '[^.]+';
}).join('') + '$');
const S4_RES = S4_ENTRIES.map(s4Matcher);
const inS4 = (id) => S4_RES.some((re) => re.test(id));

// Counts sentences the way a listener hears them: a terminator followed by whitespace, plus the tail.
// "$260.00" and "2.25.2" have no space after the dot, so money and version numbers do not split.
const sentences = (s) => (s || '').trim().split(/(?<=[.!?])\s+/).filter((x) => x.trim().length);

/* Collects every text node the eye can actually reach inside a root: skips sr-only, hidden,
   aria-hidden and zero-box ancestors, so a screen-reader-only line is never counted as "on screen".
   A closed <details> is skipped explicitly (its summary still counts): this Chromium still lays out
   the collapsed body, so its box is not zero and the geometry test alone would let hidden prose
   through. Injected as a string because it runs in the page. */
const VISIBLE_TEXT_FN = `(root) => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out = [];
  while (w.nextNode()) {
    const n = w.currentNode; const t = (n.nodeValue || '').trim(); if (!t) continue;
    const el = n.parentElement; if (!el) continue;
    if (el.closest('.sr-only, [hidden], [aria-hidden="true"]')) continue;
    const det = el.closest('details');
    if (det && !det.open && !el.closest('summary')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect(); if (r.height < 2 || r.width < 2) continue;
    out.push({ text: t, tag: el.tagName, cls: el.className, inDetails: !!det, inWhy: !!el.closest('.whytext') });
  }
  return out;
}`;

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => ({

  /* RC-94 · B4 vocabulary drift on the note-finishing concept.
     Negative control: if the product used one word for one concept, the exams screen would say
     "Exams to file"/"awaiting filing", the store status after File would be 'filed', the one
     tooth_required code would raise one verb, and the read-back gate would name the patient the
     same way in its verb and in its detail line. Each of those three measurements would then come
     back with a single distinct value and the check reports false. It is not enough that the words
     merely differ somewhere on the page: each pair below is the SAME concept in the SAME flow. */
  async 'A-screens-encounter-2-1'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      // 1. sign-family words on the queue of notes waiting to be finished
      await go(p, '#/dentist/exams');
      const examsH1 = await p.$eval('#canvas h1', (e) => e.textContent.trim());
      const examsRowWhys = await p.$$eval('[data-testid^="exams.row."] .why div', (es) => es.map((e) => e.textContent.trim()).filter(Boolean));
      const examsOpenLabel = await txt(p, 'exams.row.enc-9002.open');

      // 2. two verbs behind the one tooth_required code, in the one screen
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.surface.0.d');
      const trSurface = await p.evaluate(() => { const r = document.querySelector('.refusal'); return r ? { code: r.dataset.code, verb: r.querySelector('[data-testid="refusal.verb"]').textContent.trim() } : null; });
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.proc.d2740');
      const trProc = await p.evaluate(() => { const r = document.querySelector('.refusal'); return r ? { code: r.dataset.code, verb: r.querySelector('[data-testid="refusal.verb"]').textContent.trim() } : null; });

      // 3. the file-family words, and the read-back gate naming one patient two ways
      await go(p, '#/dentist/encounter/enc-9002');
      const fileLabel = await txt(p, 'enc.file');
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
      await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0');
      await click(p, 'enc.file'); await p.waitForTimeout(250);
      const readback = await p.evaluate(() => {
        const g = document.getElementById('enc-gate'); if (!g) return null;
        const v = g.querySelector('[data-testid="refusal.verb"]');
        const detail = [...g.querySelectorAll('.small.muted')].map((e) => e.textContent.trim()).filter((t) => /^Filing as/.test(t))[0] || null;
        return { verb: v ? v.textContent.trim() : null, detail };
      });
      await click(p, 'refusal.control'); await p.waitForTimeout(300);
      const filedChip = await p.evaluate(() => { const e = document.querySelector('.enc-filed .chip'); return e ? e.textContent.trim() : null; });
      const s = await state(p);
      const storeStatus = (s.encounters.find((e) => e.id === 'enc-9002') || {}).status;

      // 4. three headings for "the record you asked for is not there"
      await go(p, '#/dentist/encounter/enc-9999');
      const nfEncounter = await p.$eval('#canvas h1', (e) => e.textContent.trim());
      await go(p, '#/biller/ledger/p-99999');
      const nfLedger = await p.$eval('#canvas h1', (e) => e.textContent.trim());
      await go(p, '#/dentist/nosuchroute');
      const nfRoute = await p.$eval('#canvas h1', (e) => e.textContent.trim());

      const signCorpus = [examsH1, ...examsRowWhys].join(' · ');
      const signWords = /\b(sign|signing|signature)\b/i.test(signCorpus);
      const fileWords = /^File$/i.test(fileLabel || '') && /Filed/.test(filedChip || '') && /^Filing as/.test((readback && readback.detail) || '');
      const signFileDrift = signWords && fileWords && storeStatus === 'signed';
      const toothRequiredDrift = !!trSurface && !!trProc && trSurface.code === 'tooth_required' && trProc.code === 'tooth_required' && trSurface.verb !== trProc.verb;
      const readbackIdentityDrift = !!readback && !!readback.verb && !!readback.detail && /Theo Brandt/.test(readback.verb) && !/Theo Brandt/.test(readback.detail) && /\bTB\b/.test(readback.detail);
      const notFoundHeadings = [...new Set([nfEncounter, nfLedger, nfRoute])];

      rec('A-screens-encounter-2-1',
        'Encounter and Exams use two words for one concept: the queue says sign/signature while the control says File and the store writes status "signed"; one tooth_required code raises two different verbs; the read-back gate names the same patient in full in its verb and by initials in its detail line',
        'CHECKLIST B4 (one canonical word per concept across screens, refusals and announcements); CONTRACTS §6 (one verb line per gate)',
        signFileDrift && toothRequiredDrift && readbackIdentityDrift,
        { signFamily: { examsH1, examsRowWhys, examsOpenLabel, signWordsFound: (signCorpus.match(/\b(sign|signing|signature)\b/gi) || []) },
          fileFamily: { fileButtonLabel: fileLabel, filedChip, storeStatusAfterFile: storeStatus },
          toothRequired: { fromSurface: trSurface, fromProcedure: trProc, sameCodeTwoVerbs: toothRequiredDrift },
          readbackGate: readback, notFoundHeadings: { encounter: nfEncounter, ledger: nfLedger, unknownRoute: nfRoute, distinct: notFoundHeadings.length },
          verdictParts: { signFileDrift, toothRequiredDrift, readbackIdentityDrift } });
    } finally { await c.close(); }
  },

  /* RC-95 · B3 one verb, two button identities.
     Negative control: the check first proves both buttons carry the SAME label ("Back to Exams") —
     two different verbs are allowed to carry two identities, so a label mismatch reports false. It
     then reads the identity class and the rendered border through getComputedStyle: if both were
     'btn quiet' (or both 'btn reversible') and painted the same border colour, sameLabel would be
     true but differentIdentity false and the check reports false. */
  async 'A-screens-encounter-2-2'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      const readBack = async () => p.$eval('[data-testid="enc.back"]', (e) => {
        const cs = getComputedStyle(e);
        return { className: e.className, label: e.textContent.trim(), borderColor: cs.borderTopColor, borderWidth: cs.borderTopWidth, background: cs.backgroundColor, color: cs.color, fontWeight: cs.fontWeight };
      }).catch(() => null);
      await go(p, '#/dentist/encounter/enc-9999');
      const notFound = await readBack();
      await go(p, '#/dentist/encounter/enc-9002');
      const live = await readBack();
      const sameLabel = !!notFound && !!live && notFound.label === live.label;
      const kindOf = (cls) => (String(cls).split(/\s+/).find((k) => ['irreversible', 'reversible', 'quiet', 'held'].includes(k)) || null);
      const kNotFound = notFound && kindOf(notFound.className);
      const kLive = live && kindOf(live.className);
      const differentIdentity = !!kNotFound && !!kLive && kNotFound !== kLive;
      const rendersDifferently = !!notFound && !!live && notFound.borderColor !== live.borderColor;
      rec('A-screens-encounter-2-2',
        'The one verb "Back to Exams" carries two button identities in encounter.js: reversible on the not-found page and quiet on a live encounter',
        'CHECKLIST B3 (the same verb carries the same identity on every screen)',
        sameLabel && differentIdentity && rendersDifferently,
        { notFoundPage: notFound, liveEncounter: live, label: sameLabel ? notFound.label : { notFound: notFound && notFound.label, live: live && live.label },
          identity: { notFound: kNotFound, live: kLive }, sameLabel, differentIdentity, rendersDifferently });
    } finally { await c.close(); }
  },

  /* RC-163 · C3 product-internal nouns and raw storage ids on screen.
     Negative control: every string is looked for in VISIBLE text only (sr-only, aria-hidden, hidden
     and zero-box nodes are walked past, so a closed <details> and the #live announcer do not count).
     If the gate said "Fixes appear after you leave a field", the card said "Note draft", and the
     ids were absent, both lists come back empty and the check reports false. Raw ids are matched as
     whole tokens (\\bce-1\\b), so "ce-1" inside a longer word cannot pass. */
  async 'A-screens-encounter-2-3'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      const NOUNS = ['killer strip', 'Note scaffold', 'byteaudit', 'Ruleset 2.25.2', 'ruleset 2.25.2'];
      const IDS = ['ce-1', 'pr-500', 'pl-1', 'nf-1', 'c-100'];
      const scan = async (label) => {
        const nodes = await p.evaluate(`(${VISIBLE_TEXT_FN})(document.getElementById('canvas'))`);
        const blob = nodes.map((n) => n.text).join(' ');
        const nouns = NOUNS.filter((n) => blob.includes(n)).map((n) => ({ noun: n, at: (nodes.find((x) => x.text.includes(n)) || {}).cls, sample: (nodes.find((x) => x.text.includes(n)) || {}).text.slice(0, 110) }));
        const ids = IDS.filter((i) => new RegExp('(^|[^\\w-])' + i + '($|[^\\w-])').test(blob)).map((i) => ({ id: i, sample: (nodes.find((x) => new RegExp('(^|[^\\w-])' + i + '($|[^\\w-])').test(x.text)) || {}).text.slice(0, 110) }));
        return { state: label, nouns, ids };
      };
      await go(p, '#/dentist/encounter/enc-9002');
      const atOpen = await scan('gate before first blur');
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
      await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
      const atPaint = await scan('after one paint');
      await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(250);
      const atGate = await scan('read-back gate');
      await click(p, 'refusal.control'); await p.waitForTimeout(300);
      const atFiled = await scan('filed card');
      const all = [atOpen, atPaint, atGate, atFiled];
      const nounsSeen = [...new Set(all.flatMap((x) => x.nouns.map((n) => n.noun)))];
      const idsSeen = [...new Set(all.flatMap((x) => x.ids.map((n) => n.id)))];
      rec('A-screens-encounter-2-3',
        'The Encounter screen prints product-internal nouns (killer strip, Note scaffold, byteaudit, Ruleset 2.25.2) and raw storage ids (ce-1, pr-500, pl-1, nf-1, c-100) in visible text',
        'CHECKLIST C3 (no product-internal nouns on screen; no raw ids unless the spec shows them)',
        nounsSeen.length > 0 && idsSeen.length > 0,
        { nounsSeen, idsSeen, byState: all });
    } finally { await c.close(); }
  },

  /* RC-247 · C1 the h1 does not name the place.
     Negative control: the check reads a control route in the same run. If the Encounter h1 read
     "Encounter · Theo Brandt" the place test passes and the check reports false; if the control
     route's own h1 did NOT name its place either, then Encounter is not the odd one out and the
     check also reports false. A missing or duplicated h1 is a different defect and reports false. */
  async 'A-screens-encounter-2-4'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      const head = await p.evaluate(() => {
        const hs = [...document.querySelectorAll('#canvas h1')].filter((e) => e.getBoundingClientRect().height > 2);
        const sub = document.querySelector('#canvas .page-head .sub');
        return { count: hs.length, h1: hs.length ? hs[0].textContent.trim() : null, sub: sub ? sub.textContent.trim() : null };
      });
      const s = await state(p);
      const enc = s.encounters.find((e) => e.id === 'enc-9002');
      const patientName = (s.patients.find((x) => x.id === enc.patientId) || {}).name;
      await go(p, '#/frontdesk/checkout/a-1044');
      const controlH1 = await p.$eval('#canvas h1', (e) => e.textContent.trim()).catch(() => null);
      const placeInHead = /\b(encounter|exam|chart)\b/i.test((head.h1 || '') + ' ' + (head.sub || ''));
      const h1IsJustTheName = head.h1 === patientName;
      const controlNamesItsPlace = /Checkout/i.test(controlH1 || '');
      rec('A-screens-encounter-2-4',
        'The Encounter h1 is the patient\'s name alone; neither the heading nor its sub line names the place, while every other route\'s h1 does',
        'CHECKLIST C1 (every screen has one h1 that names the place in plain words)',
        head.count === 1 && h1IsJustTheName && !placeInHead && controlNamesItsPlace,
        { encounterHead: head, storePatientName: patientName, h1IsJustTheName, placeWordInHead: placeInHead, controlRoute: { hash: '#/frontdesk/checkout/a-1044', h1: controlH1, namesItsPlace: controlNamesItsPlace } });
    } finally { await c.close(); }
  },

  /* RC-161 · B5 charted tooth state carried by border colour alone.
     Measured only through getComputedStyle — document.styleSheets.cssRules throws over file://.
     Negative control, taken in the same run: the tagged state of the same tooth 30 BEFORE charting
     uses border-style dashed, so the measurement demonstrably CAN see a non-colour difference. If
     the charted state added a ::after glyph, a different background fill, a different border-style
     or a word in the visible label, colourOnly is false and the check reports false. */
  async 'A-screens-encounter-2-5'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002?grayscale=1');
      const snap = (n) => p.$eval(`[data-testid="enc.tooth.${n}"]`, (e) => {
        const cs = getComputedStyle(e); const af = getComputedStyle(e, '::after'); const bf = getComputedStyle(e, '::before');
        return { className: e.className, pressed: e.getAttribute('aria-pressed'), ariaLabel: e.getAttribute('aria-label'), visibleText: e.textContent.trim(),
          borderColor: cs.borderTopColor, borderStyle: cs.borderTopStyle, borderWidth: cs.borderTopWidth, background: cs.backgroundColor, color: cs.color, fontWeight: cs.fontWeight,
          afterContent: af.content, beforeContent: bf.content };
      }).catch(() => null);
      const taggedBefore = await snap(30);            // negative control: the tagged state uses a shape
      await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d');
      await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
      await click(p, 'enc.tooth.29'); await p.waitForTimeout(120);   // move selection off 30
      const charted = await snap(30);
      const plain = await snap(28);
      const lum = (rgb) => { const m = String(rgb).match(/\d+/g); return m ? Math.round(0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) : null; };
      const differs = (k) => charted && plain && charted[k] !== plain[k];
      const colourOnly = !!charted && !!plain && charted.className.includes('has') && charted.pressed === 'false'
        && differs('borderColor')
        && !differs('borderStyle') && !differs('borderWidth') && !differs('background') && !differs('fontWeight')
        && charted.visibleText === '30' && plain.visibleText === '28'
        && charted.afterContent === 'none' && charted.beforeContent === 'none';
      const controlSeesShape = !!taggedBefore && taggedBefore.borderStyle === 'dashed' && plain && plain.borderStyle === 'solid';
      rec('A-screens-encounter-2-5',
        'A charted tooth differs from a plain tooth by border colour only: same fill, same border style and width, no glyph and no word — the state is colour alone',
        'CHECKLIST B5 (every state is glyph + word + fill; never colour alone)',
        colourOnly && controlSeesShape,
        { chartedTooth30: charted, plainTooth28: plain, taggedTooth30BeforeCharting: taggedBefore,
          grayscaleLuminance: { charted: lum(charted && charted.borderColor), plain: lum(plain && plain.borderColor) },
          onlyDifference: 'border-color', colourOnly, controlSeesShape,
          note: 'grayscale=1 is a root filter, so getComputedStyle returns pre-filter colours; the luminance pair is reported instead' });
    } finally { await c.close(); }
  },

  /* RC-162 · A8 shortName on a null input.
     Negative control, taken in the same row: two well-formed authors are probed alongside the null
     one. If shortName returned a placeholder ('' or '—') the row would read "probe C — " and the
     check reports false; if the probe path itself were broken, probe A would not render "Alex R."
     and the check reports false, so a blank row cannot be mistaken for the defect. */
  async 'A-screens-encounter-2-6'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/surgeon/exams');
      const rowText = await p.evaluate(() => {
        const s = Proto.store.get();
        s.tags.push({ id: 'tag-probeA', encounterId: 'enc-9002', tooth: 30, surfaces: ['D'], text: 'probe A', author: 'Alex Rivera', disposition: null });
        s.tags.push({ id: 'tag-probeB', encounterId: 'enc-9002', tooth: 30, surfaces: ['D'], text: 'probe B', author: 'Cher', disposition: null });
        s.tags.push({ id: 'tag-probeC', encounterId: 'enc-9002', tooth: 30, surfaces: ['D'], text: 'probe C', author: undefined, disposition: null });
        Proto.router.render();
        const w = document.querySelector('[data-testid="exams.row.enc-9002"] .why div');
        return w ? w.textContent.trim() : null;
      });
      const twoWordOk = /probe A — Alex R\./.test(rowText || '');
      const oneWordOk = /probe B — Cher\b/.test(rowText || '');
      const nullRendersUndefined = /probe C — undefined\b/.test(rowText || '');
      rec('A-screens-encounter-2-6',
        'shortName(undefined) returns the input unchanged, so a tag with no author renders the literal word "undefined" in the Exams row',
        'CHECKLIST A8 (a pure helper returns a correct value on ordinary, boundary and null inputs)',
        twoWordOk && oneWordOk && nullRendersUndefined,
        { examsRowText: rowText, ordinaryInput: { in: 'Alex Rivera', renderedAsExpected: twoWordOk }, boundaryInput: { in: 'Cher', renderedAsExpected: oneWordOk },
          nullInput: { in: 'undefined (missing author)', rendered: (String(rowText).match(/probe C — (\S+)/) || [])[1] || null, rendersLiteralUndefined: nullRendersUndefined },
          reachability: 'store-written tags always carry currentUser().name; reached here by a malformed tag row, so the consequence is P3' });
    } finally { await c.close(); }
  },

  /* RC-164 · C8 announcements are prose, not one verb line.
     Negative control: sentences() splits only on a terminator followed by whitespace, so "$260.00"
     and "2.25.2" do not split — a genuine one-line announcement such as "Charted #30 OD" counts 1
     and the check reports false. The check requires EVERY one of the five encounter announcements
     to run to two sentences or more, so a single wordy line cannot carry the verdict. */
  async 'A-screens-encounter-2-7'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      const live = async () => { await p.waitForTimeout(160); return p.$eval('#live', (e) => e.textContent.trim()).catch(() => null); };
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.tag.tag-1.chart'); const aChartTag = await live();
      await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
      await click(p, 'enc.proc.d2392'); const aPaint = await live();
      await click(p, 'enc.note.starter.0'); const aStarter = await live();
      await click(p, 'enc.undo'); const aUndo = await live();
      await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
      await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120);
      await click(p, 'enc.file'); await p.waitForTimeout(250);
      await click(p, 'refusal.control'); const aFile = await live();
      const rows = [['chart the tag', aChartTag], ['paint a procedure', aPaint], ['apply a starter', aStarter], ['undo the paint', aUndo], ['file the note', aFile]]
        .map(([step, text]) => ({ step, text, sentences: sentences(text).length }));
      const allMeasured = rows.every((r) => r.text && r.text.length);
      rec('A-screens-encounter-2-7',
        'Every aria-live announcement encounter.js writes is multi-sentence prose rather than one verb line',
        'CHECKLIST C8 (announcements are one verb line, not prose)',
        allMeasured && rows.every((r) => r.sentences >= 2),
        { announcements: rows, allMeasured, maxSentences: Math.max(...rows.map((r) => r.sentences)) });
    } finally { await c.close(); }
  },

  /* RC-165 · B7 four date shapes on one screen.
     Negative control: each date is classified by shape, not merely collected. If every date on the
     screen rendered as M/D/YYYY the shape set has one member and the check reports false; the check
     also requires each of the four strings to have actually been found, so a missing plan chip or a
     missing filed card reports false instead of silently shrinking the set. */
  async 'A-screens-encounter-2-8'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      const headSub = await p.$eval('#canvas .page-head .sub', (e) => e.textContent.trim()).catch(() => null);
      const gateDetail = await p.evaluate(() => { const g = document.getElementById('enc-gate'); if (!g) return null; return ([...g.querySelectorAll('.small.muted')].map((e) => e.textContent.trim()).filter((t) => /^Filing as/.test(t))[0]) || null; });
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
      await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
      await p.fill('[data-testid="enc.note.field.assessment"]', 'Caries #30 confirmed; fee $260 discussed.');
      await p.click('#canvas h1'); await p.waitForTimeout(420);
      const killerCodes = await p.evaluate(() => [...document.querySelectorAll('#enc-gate .refusal')].map((e) => e.dataset.code));
      const moneyIdx = killerCodes.indexOf('money_in_note');
      if (moneyIdx >= 0) { await click(p, 'enc.killer.' + moneyIdx + '.fix'); await p.waitForTimeout(220); }
      const quotedChip = await p.evaluate(() => { const e = [...document.querySelectorAll('#canvas .chip')].find((x) => /Quoted to patient/.test(x.textContent)); return e ? e.textContent.replace(/^[^\w]*/, '').trim() : null; });
      await click(p, 'enc.file'); await p.waitForTimeout(250);
      await click(p, 'refusal.control'); await p.waitForTimeout(320);
      const filedLine = await p.evaluate(() => { const e = [...document.querySelectorAll('.enc-filed .small.muted')].find((x) => /^By /.test(x.textContent.trim())); return e ? e.textContent.trim() : null; });

      const SHAPES = [
        { name: 'YYYY-MM-DD HH:MM (ISO date + 24h clock)', re: /\b\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/ },
        { name: 'M/D/YYYY', re: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/ },
        { name: 'MM/YYYY', re: /\b\d{2}\/\d{4}\b/ },
        { name: 'M/D', re: /\b\d{1,2}\/\d{1,2}\b(?!\/)/ },
      ];
      const classify = (s) => { for (const sh of SHAPES) { const m = (s || '').match(sh.re); if (m) return { shape: sh.name, sample: m[0] }; } return { shape: null, sample: null }; };
      const found = [
        { where: 'page head sub (DOS/DOB)', text: headSub, ...classify(headSub) },
        { where: 'filing gate detail (DOB)', text: gateDetail, ...classify(gateDetail) },
        { where: 'plan card Quoted chip', text: quotedChip, ...classify(quotedChip) },
        { where: 'filed card By/at line', text: filedLine, ...classify(filedLine) },
      ];
      const allFound = found.every((f) => f.text && f.shape);
      const distinct = [...new Set(found.map((f) => f.shape).filter(Boolean))];
      rec('A-screens-encounter-2-8',
        'One encounter shows four different date shapes: M/D/YYYY in the head, MM/YYYY in the filing gate, M/D on the plan chip and a raw ISO date-time on the filed card',
        'CHECKLIST B7 (one date format per context)',
        allFound && distinct.length >= 4,
        { dates: found, distinctShapes: distinct, allFound });
    } finally { await c.close(); }
  },

  /* RC-166 · C6 policy prose on the finish path.
     Negative control: each paragraph is measured for whether it is visible AND outside any <details>
     and outside a refusal's .whytext. If the same sentences sat behind a Why disclosure the walker
     skips them (a closed <details> has a zero box) and the check reports false; the check also
     requires each paragraph to be long-form (over twelve words), so a short state line such as
     "Selected: none — tap a tooth" cannot be counted as policy prose. */
  async 'A-screens-encounter-2-9'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      const NEEDLES = [
        'Surfaces (anterior teeth show I for incisal)',
        'Today writes a pending charge',
        'Ranked starters fill Assessment and Plan',
        'The killer strip appears after you leave a field',
      ];
      const measure = async () => p.evaluate(([fnSrc, needles]) => {
        const nodes = eval('(' + fnSrc + ')')(document.getElementById('canvas'));
        return needles.map((n) => {
          const hit = nodes.find((x) => x.text.includes(n));
          return hit ? { needle: n, found: true, visible: true, inDetails: hit.inDetails, inWhyDisclosure: hit.inWhy, tag: hit.tag, cls: hit.cls, words: hit.text.split(/\s+/).length, text: hit.text }
            : { needle: n, found: false, visible: false, inDetails: null, inWhyDisclosure: null, words: 0, text: null };
        });
      }, [VISIBLE_TEXT_FN, NEEDLES]);
      const onOpen = await measure();
      // A Why disclosure on the same screen proves the walker does skip collapsed prose.
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d');
      await click(p, 'enc.proc.d2392'); await p.waitForTimeout(180);
      const collapsedWhyHidden = await p.evaluate(`(${VISIBLE_TEXT_FN})(document.getElementById('canvas')).some((n) => /50% after deductible/.test(n.text))`);
      const inlinePolicy = onOpen.filter((r) => r.found && r.visible && !r.inDetails && !r.inWhyDisclosure && r.words > 12);
      rec('A-screens-encounter-2-9',
        'Four multi-clause policy paragraphs sit inline on the path to File — surfaces, temporality, starters and the filing gate — instead of behind a Why disclosure',
        'CHECKLIST C6 (policy prose never on the finish path; explanations behind Why or a disclosure)',
        inlinePolicy.length === NEEDLES.length && collapsedWhyHidden === false,
        { paragraphs: onOpen, inlineCount: inlinePolicy.length, of: NEEDLES.length,
          walkerControl: { collapsedPlanCardWhyCountedAsVisible: collapsedWhyHidden, expected: false } });
    } finally { await c.close(); }
  },

  /* RC-167 · B1 test ids in the DOM that CONTRACTS §4 does not name.
     Negative control: the same matcher is run over the whole encounter DOM, and ids §4 does name
     (enc.file, enc.tooth.30, enc.note.starter.0, refusal.control) must come back matched. If every
     id matched a §4 entry the unmatched list is empty and the check reports false; if the matcher
     were broken, the listed ids would show as unmatched too and matcherControlOk is false. */
  async 'A-screens-encounter-2-10'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      const ids = async () => p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid')));
      await go(p, '#/dentist/encounter/enc-9999');
      const onNotFound = await ids();
      await go(p, '#/dentist/encounter/enc-9002');
      const onOpen = await ids();
      await click(p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(150);
      const onDismiss = await ids();
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
      await click(p, 'enc.proc.d2392'); await p.waitForTimeout(180);
      const onPainted = await ids();
      const seen = [...new Set([...onNotFound, ...onOpen, ...onDismiss, ...onPainted])].sort();
      const unmatched = seen.filter((id) => !inS4(id));
      const matched = seen.filter((id) => inS4(id));
      const controls = ['enc.file', 'enc.tooth.30', 'enc.note.starter.0', 'enc.surface.30.d', 'enc.proc.d2392'];
      const matcherControlOk = controls.every((id) => seen.includes(id) && inS4(id));
      rec('A-screens-encounter-2-10',
        'Four clickable ids the Encounter renders — enc.back, enc.rail, enc.tag.<tagId>.reason and enc.plan.<planId>.why — match no entry or pattern in the CONTRACTS §4 Encounter row',
        'CHECKLIST B1 / CONTRACTS §4 (every id in the DOM matches a §4 entry or pattern)',
        matcherControlOk && unmatched.length > 0,
        { unmatchedIds: unmatched, matchedCount: matched.length, totalIdsSeen: seen.length,
          s4TextSearched: { encounterRow: S4_ENCOUNTER_ROW, refusalRow: S4_REFUSAL_ROW },
          s4EntriesUsed: S4_ENTRIES, matcherControl: { ids: controls, allMatched: matcherControlOk },
          statesDriven: ['encounter/enc-9999 (not found)', 'encounter/enc-9002 (open)', 'enc.tag.tag-1.dismiss', 'after one paint'] });
    } finally { await c.close(); }
  },
});
