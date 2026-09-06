// Audit checks for prototype/js/screens/palette.js (command palette), chunk screens-palette-2
// (root causes RC-173, RC-174, RC-175, RC-176, RC-177, RC-221, RC-227, in that order).
//
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its contexts in `finally` so one failure cannot hang the run.
//
// Three measurement rules this module follows, each learned from a verifier that got the wrong verdict without it:
//  1. Nothing here reads document.styleSheets: over file:// the cssRules getter throws and a catch-and-continue
//     silently reports "no rules", which reads as a pass. Where a rendered consequence matters it is read with
//     getComputedStyle (or from the element's own state, e.g. details.open) on the live node.
//  2. A second go() to the same file URL is a same-document navigation, so a screen module's private state
//     (palette `recents`, board `uiState`) survives it. Every leg that must start from a clean module state gets
//     its own context from ctx(); legs that must share state stay in one context. See check 2, which measures
//     one-recent and three-recent in two separate contexts on purpose.
//  3. A collapsed <details> still lays out with a non-zero box in this Chromium, so a box measurement is not
//     evidence that the text inside it is on screen. Check 3 reads details.open as the authority and records
//     the box and computed style only as context.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const since = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const writeEvents = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const kinds = (ev) => ev.map((e) => e.seq + ':' + e.kind + (e.testid ? ':' + e.testid : e.table ? ':' + e.table + '/' + e.id : e.code ? ':' + e.code : e.key ? ':' + e.key : ''));

  const openPalette = async (p) => { const ok = await click(p, 'topbar.search'); await p.waitForTimeout(160); return ok; };
  const type = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.waitForTimeout(200); return true; };
  const palRows = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid^="palette.row."]')].map((r) => ({
    testid: r.getAttribute('data-testid'),
    label: ((r.querySelector('.lbl') || {}).textContent || '').trim(),
    syn: ((r.querySelector('.syn') || {}).textContent || '').trim(),
    chip: ((r.querySelector('.chip') || {}).textContent || '').replace(/[^A-Za-z ]/g, '').trim(),
  })));
  const palHint = (p) => p.evaluate(() => ((document.getElementById('palette-hint') || {}).textContent || '').trim());
  const palStatus = (p) => p.evaluate(() => ((document.getElementById('palette-status') || {}).textContent || '').trim());
  const dialogText = (p) => p.evaluate(() => ((document.querySelector('#dialogs .dialog') || {}).textContent || '').replace(/\s+/g, ' ').trim());
  const labelOf = (p, tid) => p.evaluate((t) => { const b = document.querySelector('[data-testid="' + t + '"]'); return b ? { testid: t, text: b.textContent.trim(), ariaLabel: b.getAttribute('aria-label'), cls: b.className, tag: b.tagName } : null; }, tid);
  const summaries = (p) => p.evaluate(() => [...document.querySelectorAll('summary[data-testid]')].map((s) => {
    const d = s.closest('details');
    return { testid: s.getAttribute('data-testid'), label: s.textContent.trim(), open: d ? d.open : null, segment: (s.getAttribute('data-testid') || '').split('.').pop() };
  }));
  const refusalDom = (p) => p.evaluate(() => { const r = document.querySelector('.refusal'); if (!r) return null; return {
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => { const x = b.getBoundingClientRect(); return { text: b.textContent.trim(), w: Math.round(x.width), h: Math.round(x.height) }; }),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  }; });
  const dobField = (p) => p.evaluate(() => { const i = document.querySelector('[data-testid="palette.confirm.dob"]'); return {
    present: !!i, value: i ? i.value : null, ariaInvalid: i ? i.getAttribute('aria-invalid') : null, invalidClass: i ? i.classList.contains('invalid') : null,
    hint: ((document.getElementById('palette-dob-hint') || {}).textContent || '').trim(),
    primary: (() => { const b = document.querySelector('[data-testid="palette.confirm.go"]'); return b ? { text: b.textContent.trim(), cls: b.className } : null; })(),
  }; });

  // §4 of prototype/CONTRACTS.md, read from the file so the check cites the text it searched.
  const s4 = () => {
    let t = '';
    try { t = fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return { rows: [], entries: [], has: () => false }; }
    const sec = t.slice(t.indexOf('## 4.'), t.indexOf('## 5.'));
    const rows = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*Screen\s*\|/.test(l) && !/^\|---/.test(l)).map((l) => l.trim());
    const entries = rows.flatMap((row) => [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    const patterns = entries.map((e) => new RegExp('^' + e.replace(/[.]/g, '\\.').replace(/<([^>]+)>/g, (m, inner) => (inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+')) + '$'));
    return { rows, entries, has: (id) => patterns.some((re) => re.test(id)) };
  };

  return {
    /* RC-173 · C5 · palette.js:115. Claim: the palette prints "8 results" while forty rows match, because
       store.search() slices to eight (store.js:314) and refreshList() prints rows.length with no truncation notice.
       Measurement: the uncapped match count computed from window.__proto.state() with store.search's own three
       predicates, against Proto.store.search('mrn').length, the rendered palette.row.* count, the hint line and the
       aria-live status line, plus a scan of the whole dialog for any truncation words.
       Negative control: if the store returned every match (raw === shown) or the hint carried a truncation notice
       ("first 8 of 40", "more", "narrow"), `hidden` is false and the check reports false. The check also proves the
       cap is what makes the numbers differ by showing store.search returns exactly the eight rows rendered — if the
       store returned forty and the palette rendered eight, this would be a palette bug, not the claimed one. */
    async 'A-screens-palette-2-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const seq0 = await lastSeq(p);
        await openPalette(p);
        await type(p, 'palette.input', 'mrn');
        const raw = await p.evaluate((q) => {
          const S = window.__proto.state(); const ql = q.trim().toLowerCase();
          const hits = { synonyms: 0, actions: 0, patients: 0, claims: 0 };
          for (const s of S.synonyms) if (s.term.includes(ql) || s.target.toLowerCase().includes(ql)) hits.synonyms++;
          for (const a of S.actions) if (a.label.toLowerCase().includes(ql)) hits.actions++;
          for (const pt of S.patients) if (pt.name.toLowerCase().includes(ql) || pt.phone.endsWith(ql) || pt.mrn.toLowerCase().includes(ql)) hits.patients++;
          for (const cl of S.claims) if (cl.id.includes(ql) || (cl.payer || '').toLowerCase().includes(ql)) hits.claims++;
          return { perTable: hits, total: hits.synonyms + hits.actions + hits.patients + hits.claims, patientsInSeed: S.patients.length, storeReturned: Proto.store.search(q).length };
        }, 'mrn');
        const rowsShown = (await palRows(p)).length;
        const hint = await palHint(p);
        const status = await palStatus(p);
        const all = await dialogText(p);
        const truncationNotice = /first \d+|of \d+ (?:match|result)|showing \d+|narrow|more result|top \d+/i.test(hint + ' ' + status + ' ' + all);
        const ev = await since(p, seq0);
        const hidden = raw.total > rowsShown && raw.storeReturned === rowsShown && !truncationNotice;
        rec('A-screens-palette-2-1',
          'The palette prints "8 results" for a query forty rows match: store.search caps the list at eight and the count line reports the capped list with no truncation notice',
          'C5 (CHECKLIST): every number carries a label and the same fact has one canonical value everywhere it appears',
          hidden,
          { query: 'mrn', renderings: { hintLine: hint, ariaLiveStatus: status, rowsRendered: rowsShown }, storeValue: { searchReturned: raw.storeReturned, uncappedMatches: raw.total, perTable: raw.perTable, patientsInSeed: raw.patientsInSeed }, truncationNoticeAnywhereInDialog: truncationNotice, dialogTextSearched: all.slice(0, 240), seqRange: range(ev, seq0), events: kinds(ev) });
      } finally { await c.close(); }
    },

    /* RC-174 · C5 · palette.js:112. Claim: with one row in Recents the hint still reads "Your last three." — the
       word is the literal MAX_RECENTS (palette.js:8), not the count on screen.
       Measurement: two legs, each in its OWN context because `recents` is a module-scope array that a second go()
       to the same file URL would NOT clear (same-document navigation). Leg A activates one row and reads the hint
       and the rendered row count; leg B activates three rows and reads the same two values.
       Negative control: leg B is the control. With three recents the same sentence is accurate, so a count-aware
       hint and a literal hint are indistinguishable there; the breach is only leg A's one row under "Your last
       three". If leg A said "Your last one" (or carried no count) `mismatch` is false and the check reports false.
       Leg A also proves the row was remembered (recents API length 1, group header "Recents") — with no recents at
       all the hint is a different sentence and this measurement would not apply. */
    async 'A-screens-palette-2-2'(b) {
      const one = await ctx(b);
      const three = await ctx(b);
      try {
        // Leg A: exactly one activation, fresh module state.
        await go(one.p, '#/frontdesk/board');
        await openPalette(one.p);
        await type(one.p, 'palette.input', 'boa');
        const pickedA = (await palRows(one.p))[0] || null;
        await click(one.p, 'palette.row.0'); await one.p.waitForTimeout(250);
        await openPalette(one.p);
        const legA = {
          activations: 1,
          recentsApi: await one.p.evaluate(() => Proto.screens.palette.recents()),
          rowsRendered: await palRows(one.p),
          groupHeader: await one.p.evaluate(() => [...document.querySelectorAll('.pal-groups')].map((g) => g.textContent.trim())),
          hint: await palHint(one.p),
          picked: pickedA,
        };
        // Leg B (control): three activations, fresh module state in its own context.
        await go(three.p, '#/frontdesk/board');
        for (const q of ['boa', 'rol', 'mon']) {
          await openPalette(three.p);
          await type(three.p, 'palette.input', q);
          await click(three.p, 'palette.row.0'); await three.p.waitForTimeout(250);
        }
        await openPalette(three.p);
        const legB = {
          activations: 3,
          recentsApi: await three.p.evaluate(() => Proto.screens.palette.recents()),
          rowsRendered: await palRows(three.p),
          hint: await palHint(three.p),
        };
        const saysThree = /your last three/i.test(legA.hint || '');
        const mismatch = legA.rowsRendered.length === 1 && legA.recentsApi.length === 1 && saysThree;
        rec('A-screens-palette-2-2',
          'With one row under Recents the palette hint still reads "Your last three.": the word is the literal MAX_RECENTS, not the number of rows shown',
          'C5 (CHECKLIST): every number carries a label; the number on screen is the value it names',
          mismatch,
          { oneRecent: legA, threeRecents: legB, hintSaysThreeWithOneRow: saysThree, controlHintWithThreeRows: legB.hint, maxRecentsLiteral: 3 });
      } finally { await one.c.close(); await three.c.close(); }
    },

    /* RC-175 · A2 · palette.js:91. Claim: the "How search works" disclosure says three letters list patients as
       "name · date of birth · last four of the phone", while rowSyn (palette.js:22) deliberately prints neither.
       Measurement: the disclosure text; the rendered patient rows for "veg"; the rows store.search supplies for the
       same query (which DO carry "DOB 4/12/1978 · …0141"); and, because the sentence can also be read as what you
       may search BY, four store.search probes for a date of birth and for the last four of the phone.
       The disclosure is inside a collapsed <details>: details.open is the authority for whether the text is on
       screen (a collapsed <details> still returns a non-zero box in this Chromium), so the check records open,
       the box and the computed display together and does not infer visibility from the box.
       Negative control: if the rows printed the DOB and the last-4 that store.search already carries, `promised`
       and `shown` would agree and the check reports false; likewise if the disclosure did not name them. */
    async 'A-screens-palette-2-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await openPalette(p);
        const collapsed = await p.evaluate(() => {
          const s = document.querySelector('[data-testid="palette.how"]'); if (!s) return null;
          const d = s.closest('details'); const t = d.querySelector('.whytext');
          const bx = t.getBoundingClientRect(); const cs = getComputedStyle(t);
          return { summary: s.textContent.trim(), open: d.open, textBox: { w: Math.round(bx.width), h: Math.round(bx.height) }, display: cs.display, visibility: cs.visibility, text: t.textContent.trim() };
        });
        await click(p, 'palette.how'); await p.waitForTimeout(150);
        const opened = await p.evaluate(() => { const d = document.querySelector('[data-testid="palette.how"]').closest('details'); const t = d.querySelector('.whytext'); const bx = t.getBoundingClientRect(); return { open: d.open, textBox: { w: Math.round(bx.width), h: Math.round(bx.height) }, text: t.textContent.trim() }; });
        await type(p, 'palette.input', 'veg');
        const rendered = await palRows(p);
        const storeRows = await p.evaluate(() => Proto.store.search('veg'));
        const searchable = await p.evaluate(() => ({
          'dob 4/12/1978': Proto.store.search('4/12/1978').length,
          'dob 04/12/1978': Proto.store.search('04/12/1978').length,
          'dob year 1978': Proto.store.search('1978').length,
          'last4 0141': Proto.store.search('0141').length,
        }));
        const text = (opened && opened.text) || (collapsed && collapsed.text) || '';
        const promised = /name\s*·\s*date of birth\s*·\s*last four of the phone/i.test(text);
        const patientRows = rendered.filter((r) => /Vega/.test(r.label));
        const shownDob = patientRows.some((r) => /\d{1,2}\/\d{1,2}\/\d{4}|DOB/i.test(r.syn + ' ' + r.label));
        const shownLast4 = patientRows.some((r) => /…\d{4}|\b\d{4}\b/.test(r.syn));
        const storeCarries = storeRows.filter((r) => r.kind === 'patient').every((r) => /DOB .*·.*…\d{4}/.test(r.syn || ''));
        const breach = promised && patientRows.length > 0 && !shownDob && !shownLast4 && storeCarries;
        rec('A-screens-palette-2-3',
          'The "How search works" disclosure says three letters list patients as name, date of birth and last four of the phone, but every patient row prints only "Confirm the date of birth to open the chart" — and a date of birth is not searchable either',
          'A2 (CHECKLIST): the function does what its name and the calling control\'s label promise',
          breach,
          { disclosure: { summary: collapsed && collapsed.summary, collapsedState: collapsed, openedState: opened, promisesNameDobLast4: promised },
            renderedPatientRows: patientRows, rowsShowDob: shownDob, rowsShowLast4: shownLast4,
            storeSuppliesDobAndLast4: storeCarries, storeRows,
            searchBySecondReading: searchable });
      } finally { await c.close(); }
    },

    /* RC-176 · A8 · palette.js:48. Claim: parseDob's range check is 1–31 for every month, so 02/30/1990 and
       04/31/1978 parse to impossible ISO dates, pass validateDob, and reach the identity gate as a mismatch.
       parseDob is module-private (not on window.Proto), so it is measured through the field it feeds: the four
       legs record palette.confirm.dob's aria-invalid, the hint line, the primary button identity, and the refusal
       code raised. Legs 1-3 share one context on purpose (the repro resets with refusal.control between tries);
       the valid-date leg runs in its own context so no earlier Held state can colour the reading.
       Negative control: leg 3 (04/32/1978) is the control — a day the parser DOES reject sets aria-invalid="true",
       replaces the hint with "Use MM/DD/YYYY…", leaves the primary as "Open chart" and raises NO refusal. If
       02/30 behaved that way, `accepted` is false and the check reports false. The refusal claimed is specifically
       second_identifier: a different code would not be this breach, so the code is compared, not merely the
       presence of a refusal. Leg 4 shows the gate itself works on a real date (chart opens, phiAccessLog written). */
    async 'A-screens-palette-2-4'(b) {
      const main = await ctx(b);
      const valid = await ctx(b);
      try {
        await go(main.p, '#/frontdesk/board');
        const seq0 = await lastSeq(main.p);
        await openPalette(main.p);
        await type(main.p, 'palette.input', 'veg');
        await click(main.p, 'palette.row.0'); await main.p.waitForTimeout(200);
        const attempt = async (v) => {
          await type(main.p, 'palette.confirm.dob', v);
          const beforeGo = await dobField(main.p);
          await click(main.p, 'palette.confirm.go'); await main.p.waitForTimeout(220);
          const field = await dobField(main.p);
          const ref = await refusalDom(main.p);
          if (ref) { await click(main.p, 'refusal.control'); await main.p.waitForTimeout(150); }
          return { typed: v, onBlurState: { ariaInvalid: beforeGo.ariaInvalid, hint: beforeGo.hint }, afterGo: field, refusal: ref };
        };
        const feb30 = await attempt('02/30/1990');
        const apr31 = await attempt('04/31/1978');
        const apr32 = await attempt('04/32/1978');
        const ev = await since(main.p, seq0);

        await go(valid.p, '#/frontdesk/board');
        const vseq = await lastSeq(valid.p);
        await openPalette(valid.p);
        await type(valid.p, 'palette.input', 'veg');
        await click(valid.p, 'palette.row.0'); await valid.p.waitForTimeout(200);
        await type(valid.p, 'palette.confirm.dob', '04/12/1978');
        await click(valid.p, 'palette.confirm.go'); await valid.p.waitForTimeout(250);
        const vev = await since(valid.p, vseq);
        const good = { typed: '04/12/1978', refusal: await refusalDom(valid.p), paletteStillOpen: await valid.p.evaluate(() => Proto.screens.palette.isOpen()), writes: writeEvents(vev) };

        const impossibleAccepted = (leg) => leg.afterGo.ariaInvalid === 'false' && !/Use MM\/DD\/YYYY/.test(leg.afterGo.hint || '') && !!leg.refusal && leg.refusal.code === 'second_identifier';
        const controlRejects = apr32.afterGo.ariaInvalid === 'true' && /Use MM\/DD\/YYYY/.test(apr32.afterGo.hint || '') && !apr32.refusal;
        const accepted = impossibleAccepted(feb30) && impossibleAccepted(apr31) && controlRejects;
        rec('A-screens-palette-2-4',
          'parseDob range-checks the day 1-31 for every month, so 02/30/1990 and 04/31/1978 parse as real dates, pass validation and reach the identity gate as a second_identifier mismatch, while 04/32/1978 is correctly refused as a format error',
          'A8 (CHECKLIST): pure helpers return correct values on ordinary, boundary and null inputs',
          accepted,
          { feb30, apr31, controlApr32: apr32, validDate: good, controlLegRejectsImpossibleDay: controlRejects,
            refusalEvents: refusalEvents(ev), seqRange: range(ev, seq0), events: kinds(ev) });
      } finally { await main.c.close(); await valid.c.close(); }
    },

    /* RC-177 · B2 · palette.js:259. Claim: the second_identifier verb line "Date of birth does not match" is
       subject-first, not verb-first.
       Measurement: the rendered refusal.verb, its token count, the token index of the first finite/auxiliary verb,
       and whether the first token is an imperative verb. A verb-first line has its verb at index 0; this line has
       the noun phrase "Date of birth" first and the finite verb "does" at index 3. The check also records that the
       other half of B2 holds (six words, at most eight) and that the rest of the component is intact (exactly one
       control, a Why disclosure, and the primary switched to Held), so the verdict is about the wording only.
       Negative control: the same measurement is run against a conforming line raised in a second context — the
       board's ping_rate refusal "Wait 15 minutes — chair already pinged" — where the first token IS an imperative
       verb and no finite verb precedes it; that comparator reports notVerbFirst = false. If the palette line read
       "Confirm the date of birth" the same code reports false. The refusal measured is matched by code
       (second_identifier), not by "a refusal appeared". */
    async 'A-screens-palette-2-5'(b) {
      const { c, p } = await ctx(b);
      const cmp = await ctx(b);
      try {
        const FINITE = /^(is|are|was|were|does|do|did|has|have|had|can|cannot|could|will|would|must|needs|need)$/i;
        const IMPERATIVE = /^(add|approve|ask|call|cancel|check|choose|clear|close|collect|confirm|decline|enter|file|find|finish|fix|go|hold|issue|keep|match|name|open|pick|ping|post|press|probe|read|record|remove|retire|review|save|seat|select|send|set|sign|start|stop|switch|take|tap|try|type|undo|use|verify|wait|write)$/i;
        const shape = (verb) => {
          const words = (verb || '').split(/\s+/).filter(Boolean);
          const finiteAt = words.findIndex((w) => FINITE.test(w.replace(/[^A-Za-z]/g, '')));
          return { verb, words, wordCount: words.length, firstWord: words[0] || null, firstWordIsImperative: IMPERATIVE.test((words[0] || '').replace(/[^A-Za-z]/g, '')), finiteVerbAt: finiteAt, notVerbFirst: !IMPERATIVE.test((words[0] || '').replace(/[^A-Za-z]/g, '')) && finiteAt > 0 };
        };
        await go(p, '#/frontdesk/board');
        const seq0 = await lastSeq(p);
        await openPalette(p);
        await type(p, 'palette.input', 'veg');
        await click(p, 'palette.row.0'); await p.waitForTimeout(200);
        await type(p, 'palette.confirm.dob', '04/13/1978');
        await click(p, 'palette.confirm.go'); await p.waitForTimeout(250);
        const ref = await refusalDom(p);
        const primary = await labelOf(p, 'palette.confirm.go');
        const ev = await since(p, seq0);
        const refEv = refusalEvents(ev).filter((e) => e.code === 'second_identifier');
        const measured = shape(ref && ref.verb);

        await go(cmp.p, '#/frontdesk/board');
        await click(cmp.p, 'board.queue.row.a-1050.ping'); await cmp.p.waitForTimeout(140);
        await click(cmp.p, 'board.queue.row.a-1050.ping'); await cmp.p.waitForTimeout(220);
        const cmpRef = await refusalDom(cmp.p);
        const comparator = shape(cmpRef && cmpRef.verb);

        const breach = !!ref && ref.code === 'second_identifier' && measured.notVerbFirst && measured.wordCount <= 8 && comparator.notVerbFirst === false;
        rec('A-screens-palette-2-5',
          'The second_identifier refusal verb line reads "Date of birth does not match": the subject comes first and the finite verb is the fourth word, where B2 asks for a verb-first line',
          'B2 (CHECKLIST) and CONTRACTS §6: the verb line is verb first and at most eight words',
          breach,
          { measuredVerbLine: measured, refusalCode: ref && ref.code, refusalControls: ref && ref.controls, whyDisclosure: ref && ref.why, primaryAfterRefusal: primary,
            eightWordHalfOfB2Holds: measured.wordCount <= 8,
            comparatorVerbFirstLine: comparator, comparatorCode: cmpRef && cmpRef.code,
            refusalEvents: refEv, seqRange: range(ev, seq0) });
      } finally { await c.close(); await cmp.c.close(); }
    },

    /* RC-221 · B4/B1 · palette.js:90. Claim: the disclosure that explains how something was derived carries the
       control segment ".why" on fifteen ids but "how" in the palette (palette.how), "grammar" in perio
       (perio.settings.grammar) and "handled" on the board (board.readiness.handled).
       Measurement: every <summary data-testid> present in the DOM, collected across five legs, each in its OWN
       context (a second go() to the same URL would carry board/perio module state between legs). Leg 1 snapshots
       the board twice inside one context: with the palette on its search step (palette.how beside the board's own
       board.queue.why) and again on its confirm step after a mismatch (the §4-listed refusal.why) — the palette
       replaces its body between the two steps, so the two ids cannot appear at once. The check also records each
       summary's user-facing label (the words B4 actually governs) and whether §4 of CONTRACTS.md names the id.
       Only the DOM-measured ids count towards the verdict; board.readiness.handled needs an issued day pass, so
       its leg seeds the pass through Proto.store.addDayPass and then clears the three remaining readiness rows by
       their testids — the seeding is recorded as such and does not affect `drift`.
       Negative control: if every disclosure summary in the census ended in ".why", `nonWhy` is empty and the check
       reports false; if the census found no ".why" summary at all there would be no canonical to drift from, and
       `whyFamilies >= 2` fails, so the check reports false then too. */
    async 'A-screens-palette-2-6'(b) {
      const legs = [];
      const mk = async () => { const x = await ctx(b); legs.push(x); return x; };
      try {
        const found = [];
        // Leg 1: board queue disclosure + the palette's own disclosure + the shared refusal's Why, one DOM.
        const l1 = await mk();
        await go(l1.p, '#/frontdesk/board');
        found.push({ leg: 'board', at: 'landing', got: await summaries(l1.p) });
        await openPalette(l1.p);
        found.push({ leg: 'board+palette', at: 'palette open on its search step', got: await summaries(l1.p) });
        await type(l1.p, 'palette.input', 'veg');
        await click(l1.p, 'palette.row.0'); await l1.p.waitForTimeout(180);
        await type(l1.p, 'palette.confirm.dob', '04/13/1978');
        await click(l1.p, 'palette.confirm.go'); await l1.p.waitForTimeout(220);
        found.push({ leg: 'board+palette+refusal', at: 'palette on its confirm step with a second_identifier refusal', got: await summaries(l1.p) });
        // The Rail's section disclosures share the <summary> tag but open a Rail section rather than explain a
        // derivation; they are collected so the census can show them being set aside, not counted as drift.
        const l1b = await mk();
        await go(l1b.p, '#/biller/ledger/p-303');
        found.push({ leg: 'ledger+rail', at: 'landing', got: await summaries(l1b.p) });
        // Leg 2: perio settings.
        const l2 = await mk();
        await go(l2.p, '#/hygienist/perio/enc-9001');
        await click(l2.p, 'perio.settings'); await l2.p.waitForTimeout(180);
        found.push({ leg: 'perio', at: 'perio.settings open', got: await summaries(l2.p) });
        // Leg 3: money desk (ERA batch, then denials).
        const l3 = await mk();
        await go(l3.p, '#/biller/money');
        found.push({ leg: 'money.era', at: 'landing', got: await summaries(l3.p) });
        await click(l3.p, 'money.tab.denials'); await l3.p.waitForTimeout(180);
        found.push({ leg: 'money.denials', at: 'denials tab', got: await summaries(l3.p) });
        // Leg 4: checkout estimate.
        const l4 = await mk();
        await go(l4.p, '#/frontdesk/checkout/a-1044');
        found.push({ leg: 'checkout', at: 'landing', got: await summaries(l4.p) });
        // Leg 5: the board's handled disclosure (needs every readiness row cleared).
        const l5 = await mk();
        await go(l5.p, '#/frontdesk/board');
        const seeded = await l5.p.evaluate(() => { const r = Proto.store.addDayPass({ name: 'Alex Rivera', role: 'frontdesk', location: 'loc-1', end: '17:30', extra: [] }, null); return { ok: !!r.ok, dayPasses: window.__proto.state().dayPasses.length }; });
        await hop(l5.p, '#/frontdesk/chairs'); await hop(l5.p, '#/frontdesk/board');
        const cleared = [];
        for (const t of ['board.readiness.row.elig.reverify-all', 'board.readiness.row.lab-op3.call', 'board.readiness.row.device.reset']) cleared.push({ testid: t, clicked: await click(l5.p, t) });
        found.push({ leg: 'board.handled', at: 'readiness cleared (day pass seeded through the store, not the UI)', seeded, cleared, got: await summaries(l5.p) });

        const flat = [];
        for (const f of found) for (const s of f.got) if (!flat.some((x) => x.testid === s.testid)) flat.push({ testid: s.testid, label: s.label, leg: f.leg, segment: s.segment });
        const s4t = s4();
        const explainers = flat.filter((x) => !/^rail\.sum\./.test(x.testid)); // rail.sum.* opens a Rail section, not a derivation
        const why = explainers.filter((x) => x.segment === 'why');
        const nonWhy = explainers.filter((x) => x.segment !== 'why');
        const whyFamilies = new Set(why.map((x) => x.testid.replace(/\b(a-\d+|c-\d+|el-\d+|era-\d+|u-[a-z0-9-]+|d-\d+|ar-\d+|p-\d+)\b/g, '<id>'))).size;
        const drift = whyFamilies >= 2 && nonWhy.some((x) => x.testid === 'palette.how');
        rec('A-screens-palette-2-6',
          'One concept, several control words: the disclosure that explains a derivation is ".why" on most screens but "palette.how" in the palette, with "perio.settings.grammar" and "board.readiness.handled" drifting the same way',
          'B4/B1 (CHECKLIST): one canonical word per concept; every id in the DOM matches a §4 entry or pattern',
          drift,
          { censusByLeg: found.map((f) => ({ leg: f.leg, at: f.at, ids: f.got.map((s) => s.testid + ' "' + s.label + '"'), seeded: f.seeded || null, cleared: f.cleared || null })),
            whySummaries: why.map((x) => x.testid + ' "' + x.label + '"'),
            nonWhySummaries: nonWhy.map((x) => x.testid + ' "' + x.label + '"'),
            distinctWhyFamilies: whyFamilies,
            railSectionSummariesExcluded: flat.filter((x) => /^rail\.sum\./.test(x.testid)).map((x) => x.testid),
            s4Membership: Object.fromEntries(['refusal.why', 'palette.how', 'perio.settings.grammar', 'board.readiness.handled', 'board.queue.why', 'checkout.estimate.why'].map((id) => [id, s4t.has(id)])),
            s4TextSearched: s4t.rows.filter((r) => /Palette|Refusal|Board|Perio/.test(r)).map((r) => r.slice(0, 260)) });
      } finally { for (const l of legs) await l.c.close(); }
    },

    /* RC-227 · B4 · palette.js:88. Claim: one concept — dismiss this dialog — carries four different words:
       "Close" (palette), "Cancel" (PIN pad and phone step-up), "Close preview" (statement preview), and the
       palette's confirm step adds "Back to results".
       Measurement: the rendered text and accessible name of each dismiss control, each dialog opened in its OWN
       context (the PIN pad, the step-up pad and the preview are separate screens whose module state must not carry
       between legs). Each leg records whether the dialog actually opened, so a missing control is never read as a
       different word.
       Negative control: if every dialog's dismiss control read the same word, `distinctWords` is 1 and the check
       reports false. A leg whose dialog failed to open contributes no word (it is listed under notOpened), so an
       unreachable dialog cannot manufacture drift. */
    async 'A-screens-palette-2-7'(b) {
      const legs = [];
      const mk = async (w, h) => { const x = await ctx(b, w || 1280, h || 900); legs.push(x); return x; };
      try {
        const controls = [];
        const notOpened = [];
        // Palette: search step and confirm step.
        const l1 = await mk();
        await go(l1.p, '#/frontdesk/board');
        const palOpen = await openPalette(l1.p);
        if (palOpen) controls.push(Object.assign({ dialog: 'Search (palette)', step: 'search' }, await labelOf(l1.p, 'palette.close'))); else notOpened.push('palette');
        await type(l1.p, 'palette.input', 'veg');
        await click(l1.p, 'palette.row.0'); await l1.p.waitForTimeout(200);
        const onConfirm = await l1.p.$('[data-testid="palette.confirm.dob"]');
        if (onConfirm) {
          controls.push(Object.assign({ dialog: 'Search (palette)', step: 'confirm date of birth' }, await labelOf(l1.p, 'palette.close')));
          controls.push(Object.assign({ dialog: 'Search (palette)', step: 'confirm date of birth' }, await labelOf(l1.p, 'palette.confirm.back')));
        } else notOpened.push('palette confirm step');
        // PIN pad.
        const l2 = await mk();
        await go(l2.p, '#/dentist/exams?device=shared');
        await click(l2.p, 'topbar.author'); await l2.p.waitForTimeout(200);
        const padOpen = await l2.p.$('[data-testid="pin.key.1"]');
        if (padOpen) controls.push(Object.assign({ dialog: 'Author PIN pad', step: 'switch author' }, await labelOf(l2.p, 'pin.cancel'))); else notOpened.push('pin pad');
        // Phone step-up.
        const l3 = await mk(420, 860);
        await go(l3.p, '#/owner/phone/approvals');
        await click(l3.p, 'phone.simulate'); await l3.p.waitForTimeout(220);
        const approveId = await l3.p.evaluate(() => { const x = document.querySelector('[data-testid^="phone.request."][data-testid$=".approve"]'); return x ? x.getAttribute('data-testid') : null; });
        if (approveId) { await click(l3.p, approveId); await l3.p.waitForTimeout(220); }
        const stepupOpen = await l3.p.$('[data-testid="phone.stepup.submit"]');
        if (stepupOpen) controls.push(Object.assign({ dialog: 'Re-verify PIN (phone step-up)', step: 'approve a write-off', via: approveId }, await labelOf(l3.p, 'phone.stepup.cancel'))); else notOpened.push('phone step-up (' + approveId + ')');
        // Statement preview.
        const l4 = await mk();
        await go(l4.p, '#/biller/ledger/p-303');
        await click(l4.p, 'ledger.statement.preview'); await l4.p.waitForTimeout(220);
        const prevOpen = await l4.p.$('[data-testid="ledger.statement.preview.close"]');
        if (prevOpen) controls.push(Object.assign({ dialog: 'Statement preview', step: 'preview a statement' }, await labelOf(l4.p, 'ledger.statement.preview.close'))); else notOpened.push('statement preview');

        const words = controls.filter(Boolean).map((x) => x.text);
        const distinct = [...new Set(words)];
        const drift = distinct.length > 1 && words.includes('Close') && words.includes('Cancel');
        rec('A-screens-palette-2-7',
          'One concept, four words: a dialog is dismissed by "Close" in the palette, "Cancel" on the PIN pad and the phone step-up, "Close preview" in the statement preview, and "Back to results" on the palette\'s confirm step',
          'B4 (CHECKLIST): one canonical word per concept across all screens (Cancel / Back / Close is named in the rule)',
          drift,
          { dismissControls: controls, distinctWords: distinct, dialogsThatDidNotOpen: notOpened });
      } finally { for (const l of legs) await l.c.close(); }
    },
  };
};
