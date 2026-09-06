// Audit checks for prototype/js/screens/chairs.js, chunk screens-chairs
// (root causes RC-19, 20, 21, 77, 79, 80, 81, 82, 83, 149, 249, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const kinds = (ev) => ev.map((e) => e.kind + (e.testid ? ':' + e.testid : e.table ? ':' + e.table + '/' + e.id : e.key ? ':' + e.key : ''));
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body || !a ? { tag: 'BODY', testid: null } : { tag: a.tagName, testid: a.getAttribute('data-testid') }; });
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const blur = (p) => p.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
  const apptStatus = (p, id) => p.evaluate((id) => { const a = window.__proto.state().appointments.find((x) => x.id === id); return a ? a.status : null; }, id);
  const readyButton = (p, id) => p.evaluate((id) => { const b = document.querySelector('[data-testid="chairs.card.' + id + '.ready"]'); return b ? { class: b.className, text: b.textContent.trim(), ariaLabel: b.getAttribute('aria-label') } : null; }, id);
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas .refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => b.textContent.trim()),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  const chipWord = (t) => t.replace(/^[■▲◆★▬●]\s*/, '').trim();
  // Seat Marisol Vega (a-1042, Bree's 9:00 hygiene) from the frontdesk Board so the hygienist's card can carry Ready for exam.
  const seat1042 = async (p) => { await go(p, '#/frontdesk/board'); await click(p, 'board.card.a-1042.arrive'); await click(p, 'board.card.a-1042.seat'); await p.waitForTimeout(150); return apptStatus(p, 'a-1042'); };
  const CONTRACTS = () => { try { return fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return ''; } };
  // §4: every backticked entry in every row of the table; <a|b> enumerates, a bare <x> admits one seed-id or code token.
  const s4All = () => {
    const t = CONTRACTS(); const sec = t.slice(t.indexOf('## 4.'), t.indexOf('## 5.'));
    const rows = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*Screen\s*\|/.test(l) && !/^\|---/.test(l));
    const entries = rows.flatMap((row) => [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    const patterns = entries.map((e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+') + '$'));
    return { chairsRow: rows.find((r) => /^\|\s*Chairs\s*\|/.test(r)) || null, entries, patterns };
  };
  const canvasIds = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid')));

  return {
    // RC-19 · A7 · chairs.js:21 PRACTICE_LINE is a string constant appended at :186.
    // Negative control: a computed completion figure moves once a perio exam is written for one of today's hygiene chairs — the line read
    // after Save differs from the seed reading — so `unchanged` is false and the check reports false. The exam must actually have been
    // written (perioExams gains a row for enc-9001 dated today) or the mutation is not counted and the check reports false.
    async 'A-screens-chairs-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const line = () => p.evaluate(() => ((document.querySelector('#canvas .practice-line') || {}).textContent || '').trim() || null);
        const derived = () => p.evaluate(() => { const S = window.__proto.state(); const today = S.tenant.today; const hyg = S.appointments.filter((a) => a.locationId === 'loc-1' && a.type === 'hygiene'); const charted = hyg.filter((a) => S.perioExams.some((e) => e.encounterId === a.encounterId && e.date === today)).length; return { hygieneChairsToday: hyg.length, perioChartedToday: charted, perioExamsTotal: S.perioExams.length, pctFromState: hyg.length ? Math.round((charted / hyg.length) * 100) + '%' : null }; });
        const seedLine = await line(); const seedDerived = await derived();
        const opened = await click(p, 'chairs.card.a-1042.perio'); await p.waitForTimeout(200);
        const hashOnPerio = await p.evaluate(() => location.hash);
        await p.keyboard.type('3'.repeat(168), { delay: 0 }); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        const saved = await click(p, 'perio.save'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const exam = await p.evaluate(() => { const S = window.__proto.state(); return S.perioExams.filter((e) => e.encounterId === 'enc-9001' && e.date === S.tenant.today).map((e) => ({ id: e.id, probed: e.probed, deepest: e.deepest })); });
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const afterLine = await line(); const afterDerived = await derived();
        const strip = await p.evaluate(() => { const s = document.querySelector('[data-testid="chairs.card.a-1042.expand"]'); return s ? s.textContent.replace(/\s+/g, ' ').trim() : null; });
        const unchanged = seedLine === afterLine;
        const isLiteral = !!seedLine && /71%/.test(seedLine);
        const reproduced = opened && saved && exam.length > 0 && isLiteral && unchanged;
        rec('A-screens-chairs-1', 'The Chairs line "Perio completion this week: 71% (practice)" reads the same before and after a full perio exam is saved for a-1042, while the card strip beside it reports the exam', 'A7 — a number on screen is computed from state and moves with it, never a literal; chairs.js:21 (constant), :186 (appended)',
          reproduced, { seedLine, afterLine, unchanged, isLiteral, perioOpened: opened, hashOnPerio, savePressed: saved, examWritten: exam, writesInRange: writes(ev), seqRange: range(ev, seq0), derivedFromState: { before: seedDerived, after: afterDerived }, cardStripAfter: strip });
      } finally { await c.close(); }
    },

    // RC-20 · A2, B2 · chairs.js:98-100 store the outage gate in gates[id]; :104 deletes it only on a successful readyForExam; the Held
    // onClick at :154 only focuses refusal.control, so nothing re-runs the request once the outage ends.
    // Negative control: with the outage over (window.__proto.outage false, no stamp, no outage in the sub line) a compliant card offers
    // Ready for exam again (class `irreversible`, no stale refusal), or pressing Held re-runs the request and writes appointmentEvents
    // (status ready_for_exam) — then `stillHeld` or `pressWroteNothing` is false and the check reports false. The gate must first have been
    // raised with code outage under outage=1 (refusal event) or the scenario is not this claim.
    async 'A-screens-chairs-2'(b) {
      const { c, p } = await ctx(b);
      try {
        const seated = await seat1042(p);
        await hop(p, '#/hygienist/chairs?outage=1'); await p.waitForTimeout(200);
        const underOutage = { outageFlag: await p.evaluate(() => window.__proto.outage), readyBefore: await readyButton(p, 'a-1042') };
        const seqA = await lastSeq(p);
        const pressedA = await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(200);
        const evA = await after(p, seqA);
        underOutage.pressed = pressedA; underOutage.refusalEvents = refusalEvents(evA); underOutage.writes = writes(evA); underOutage.readyAfter = await readyButton(p, 'a-1042'); underOutage.refusalsDom = await refusalsDom(p); underOutage.seqRange = range(evA, seqA);
        await hop(p, '#/hygienist/chairs?outage=0'); await p.waitForTimeout(200);
        const cleared = await p.evaluate(() => ({ outageFlag: window.__proto.outage, storeOutage: Proto.store.get().outage, stamp: ((document.querySelector('[data-testid="chairs.card.a-1042"] .stamp') || {}).textContent || '').trim() || null, subLine: ((document.querySelector('#canvas .page-head .sub') || {}).textContent || '').trim(), status: window.__proto.state().appointments.find((a) => a.id === 'a-1042').status }));
        cleared.ready = await readyButton(p, 'a-1042'); cleared.refusalsDom = await refusalsDom(p);
        const seqB = await lastSeq(p);
        const pressedB = await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(200);
        const evB = await after(p, seqB);
        const pressResult = { pressed: pressedB, writes: writes(evB), refusalEvents: refusalEvents(evB), eventsInRange: kinds(evB), seqRange: range(evB, seqB), statusAfter: await apptStatus(p, 'a-1042'), readyAfter: await readyButton(p, 'a-1042'), focusAfter: await active(p), announcement: await live(p) };
        const gateRaised = underOutage.outageFlag === true && pressedA && underOutage.refusalEvents.some((e) => e.code === 'outage') && !!underOutage.readyAfter && /\bheld\b/.test(underOutage.readyAfter.class);
        const stillHeld = cleared.outageFlag === false && !cleared.stamp && !/outage/i.test(cleared.subLine) && !!cleared.ready && /\bheld\b/.test(cleared.ready.class) && cleared.refusalsDom.some((d) => d.code === 'outage');
        const pressWroteNothing = pressedB && pressResult.writes.length === 0 && pressResult.refusalEvents.length === 0 && pressResult.statusAfter === 'seated';
        rec('A-screens-chairs-2', 'After the outage ends (outage flag false, no read-only stamp, no outage in the sub line) the a-1042 card still shows Ready for exam as Held with the outage refusal, and pressing Held writes nothing, raises nothing and leaves the status seated', 'A2, B2 — a control does what its label promises and the Held identity carries a live verdict; chairs.js:98-100 (gate stored), :104 (cleared only on success), :154 (Held only focuses the control)',
          seated === 'seated' && gateRaised && stillHeld && pressWroteNothing, { statusAfterSeat: seated, underOutage, afterOutageCleared: cleared, heldPressAfterOutage: pressResult, gateRaised, stillHeld, pressWroteNothing });
      } finally { await c.close(); }
    },

    // RC-21 · B3 · chairs.js:175 onKey('r') calls doReady on the first card that canReady; :155 renders Ready for exam as `btn irreversible`;
    // store.js:189 readyForExam has no gate.
    // Negative control: if Ready for exam carried the reversible identity (class without `irreversible`), or the key opened a confirmation
    // (#dialogs .overlay) or raised a refusal before writing, then `identityIrreversible` or `wroteWithoutGate` is false and the check
    // reports false. Focus is put on the body first so the key is a bare accelerator, not an Enter on a focused button.
    async 'A-screens-chairs-3'(b) {
      const { c, p } = await ctx(b);
      try {
        const seated = await seat1042(p);
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const identity = await readyButton(p, 'a-1042');
        const before = await p.evaluate(() => { const S = window.__proto.state(); return { status: S.appointments.find((a) => a.id === 'a-1042').status, appointmentEvents: S.appointmentEvents.length, readyCards: [...document.querySelectorAll('[data-testid$=".ready"]')].map((b) => b.getAttribute('data-testid')) }; });
        await blur(p);
        const focusBefore = await active(p);
        const seq0 = await lastSeq(p);
        await p.keyboard.press('r'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return { status: S.appointments.find((a) => a.id === 'a-1042').status, appointmentEvents: S.appointmentEvents.length, lastEvent: S.appointmentEvents[S.appointmentEvents.length - 1] || null, dialogOpen: !!document.querySelector('#dialogs .overlay'), refusalNodes: document.querySelectorAll('#canvas .refusal').length }; });
        const apptWrites = ev.filter((e) => e.kind === 'write' && e.table === 'appointmentEvents');
        const refusals = refusalEvents(ev);
        const identityIrreversible = !!identity && /\birreversible\b/.test(identity.class);
        const wroteWithoutGate = apptWrites.length > 0 && refusals.length === 0 && !afterS.dialogOpen && afterS.refusalNodes === 0 && afterS.status === 'ready_for_exam' && ev.filter((e) => e.kind === 'click').length === 0;
        rec('A-screens-chairs-3', 'On Chairs the bare R key requests the exam for seated a-1042 and writes appointmentEvents (encounter.exam_requested) with no click, confirmation or refusal, while the Ready for exam control carries the irreversible identity', 'B3 — the same verb carries the same identity everywhere and an irreversible verb never executes from a keyboard accelerator without its gate; chairs.js:155 (identity) and :175 (accelerator)',
          seated === 'seated' && identityIrreversible && wroteWithoutGate, { statusAfterSeat: seated, readyControl: identity, identityIrreversible, readyCardsBefore: before.readyCards, focusBeforeKey: focusBefore, statusBefore: before.status, statusAfterKey: afterS.status, appointmentEventsBefore: before.appointmentEvents, appointmentEventsAfter: afterS.appointmentEvents, lastAppointmentEvent: afterS.lastEvent, writesInRange: writes(ev), refusalEventsInRange: refusals, eventsInRange: kinds(ev), dialogOpenAfterKey: afterS.dialogOpen, refusalNodesAfterKey: afterS.refusalNodes, announcement: await live(p), focusAfterKey: await active(p), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-77 · B7 · chairs.js:32 fmtTime prints H:MM with no meridiem for the card head and aria-label, while :33 clock12 prints the sub line
    // clock as h:mm am/pm; board.js:35 fmtTime = clock12; rail.js:85 prints the raw HH:MM.
    // Negative control: one appointment time (store '09:00' for a-1042) renders in one shape on the Chairs card, the Board card and the Rail
    // line — the set of distinct time tokens has one member — and the check reports false. The store value is read at each screen so a
    // changed appointment is not scored as drift.
    async 'A-screens-chairs-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const TIME = /\b\d{1,2}:\d{2}(?:\s?[ap]m)?\b/;
        const tok = (s) => { const m = TIME.exec(s || ''); return m ? m[0] : null; };
        const storeTime = await p.evaluate(() => window.__proto.state().appointments.find((a) => a.id === 'a-1042').time);
        const chairs = await p.evaluate(() => { const card = document.querySelector('[data-testid="chairs.card.a-1042"]'); const who = card ? card.querySelector('.who span') : null; return { who: who ? who.textContent.trim() : null, ariaLabel: card ? card.getAttribute('aria-label') : null, sub: ((document.querySelector('#canvas .page-head .sub') || {}).textContent || '').trim(), clock: Proto.store.get().clock.time }; });
        await click(p, 'chairs.card.a-1042.rail'); await p.waitForTimeout(200);
        const rail = await p.evaluate(() => { const r = document.getElementById('rail'); if (!r || r.hidden) return null; return [...r.querySelectorAll('*')].map((e) => e.textContent.trim()).find((t) => /^Next: today/.test(t)) || null; });
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(200);
        const board = await p.evaluate(() => { const card = document.querySelector('[data-testid="board.card.a-1042"]'); const who = card ? card.querySelector('.who span') : null; return { who: who ? who.textContent.trim() : null, ariaLabel: card ? card.getAttribute('aria-label') : null, sub: ((document.querySelector('#canvas .page-head .sub') || {}).textContent || '').trim(), storeTime: window.__proto.state().appointments.find((a) => a.id === 'a-1042').time }; });
        const renderings = { chairsCardHead: tok(chairs.who), chairsAriaLabel: tok(chairs.ariaLabel), railNextLine: tok(rail), boardCardHead: tok(board.who) };
        const distinct = [...new Set(Object.values(renderings).filter(Boolean))];
        const clocks = { chairsSub: tok(chairs.sub), boardSub: tok(board.sub), storeClock: chairs.clock };
        const reproduced = storeTime === board.storeTime && !!renderings.chairsCardHead && !!renderings.boardCardHead && !!renderings.railNextLine && distinct.length > 1;
        rec('A-screens-chairs-4', 'One store time "09:00" for a-1042 renders "9:00" on the Chairs card head and aria-label, "9:00 am" on the Board card and "09:00" on the Rail line, while the Chairs sub line prints its clock as "8:40 am" beside the meridiem-less card', 'B7 — one format per context for dates and times; chairs.js:32 fmtTime vs :33 clock12, board.js:35, rail.js:85',
          reproduced, { storeTime, chairs, railNextLine: rail, board, timeTokens: renderings, distinctRenderings: distinct, clockRenderings: clocks });
      } finally { await c.close(); }
    },

    // RC-79 · C8 · chairs.js:107 announces name + ' ready for exam: <n> in queue. The Board chair strip shows Exam requested.'
    // Negative control: a compliant announcement is one verb line — one sentence — so `sentences` is 1 and the check reports false. The
    // request must have written appointmentEvents (status ready_for_exam) before the live text is scored, so a refusal announcement is
    // not mistaken for the success announcement.
    async 'A-screens-chairs-5'(b) {
      const { c, p } = await ctx(b);
      try {
        const seated = await seat1042(p);
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(300);
        const ev = await after(p, seq0);
        const text = await live(p);
        const status = await apptStatus(p, 'a-1042');
        const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const wrote = ev.some((e) => e.kind === 'write' && e.table === 'appointmentEvents') && status === 'ready_for_exam';
        rec('A-screens-chairs-5', 'The Ready for exam announcement for a-1042 is two sentences of prose ("Marisol Vega ready for exam: 1st in queue. The Board chair strip shows Exam requested."), not one verb line', 'C8 — announcements (aria-live) are one verb line, not prose; chairs.js:107',
          seated === 'seated' && pressed && wrote && sentences.length >= 2, { statusAfterSeat: seated, pressed, statusAfterPress: status, writesInRange: writes(ev), refusalEventsInRange: refusalEvents(ev), seqRange: range(ev, seq0), announcement: text, sentences, sentenceCount: sentences.length, words, focusAfter: await active(p) });
      } finally { await c.close(); }
    },

    // RC-80 · B1 · chairs.js:146 renders chairs.card.<id>.why (summary), :152 chairs.card.<id>.rail (rail.button), :185 chairs.empty.board.
    // Negative control: every id rendered under #canvas matches an entry or pattern of CONTRACTS §4 (parsed from the file at run time, so a
    // contract that gains the ids makes the check pass) — `undeclared` is empty and the check reports false. Ids are collected from the
    // rendered DOM in two states (a card expanded; the empty state after Bree's chairs are reassigned in the store) so that only ids that
    // actually render are scored.
    async 'A-screens-chairs-6'(b) {
      const { c, p } = await ctx(b);
      try {
        const s4 = s4All();
        await go(p, '#/hygienist/chairs');
        await click(p, 'chairs.card.a-1042.expand'); await p.waitForTimeout(120);
        const idsCards = await canvasIds(p);
        const handlersWithoutTestid = await p.evaluate(() => [...document.querySelectorAll('#canvas button, #canvas summary, #canvas [role="button"]')].filter((e) => !e.getAttribute('data-testid')).map((e) => e.tagName + ':' + e.textContent.trim().slice(0, 30)));
        // Empty state: move Bree's Main Street chairs to the other hygienist so mine() returns nothing, then re-render the route.
        await p.evaluate(() => { for (const a of Proto.store.get().appointments) if (a.providerId === 'u-hy-1') a.providerId = 'u-hy-2'; });
        await hop(p, '#/hygienist/board'); await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const emptyState = await p.evaluate(() => ({ cards: document.querySelectorAll('[data-testid^="chairs.card."]').length, h2: ((document.querySelector('#canvas section h2') || {}).textContent || '').trim() || null }));
        const idsEmpty = await canvasIds(p);
        const ids = [...new Set([...idsCards, ...idsEmpty])];
        const undeclared = ids.filter((id) => !s4.patterns.some((re) => re.test(id)));
        const families = [...new Set(undeclared.map((id) => id.replace(/\.a-\d+\./, '.<apptId>.')))];
        const reproduced = s4.entries.length > 0 && families.some((f) => /\.why$/.test(f)) && families.some((f) => /\.rail$/.test(f)) && emptyState.cards === 0 && undeclared.includes('chairs.empty.board');
        rec('A-screens-chairs-6', 'Chairs renders chairs.card.<apptId>.why, chairs.card.<apptId>.rail and (in the empty state) chairs.empty.board, none of which matches an entry or pattern in CONTRACTS §4; the Chairs row lists only .perio, .note, .ready, .expand', 'B1 — every id in the DOM matches a §4 entry or pattern; chairs.js:146, :152, :185',
          reproduced, { s4ChairsRow: s4.chairsRow, s4EntriesSearched: s4.entries, idsRenderedWithCards: idsCards, idsRenderedEmptyState: idsEmpty, emptyState, undeclared, undeclaredFamilies: families, handlersWithoutTestid });
      } finally { await c.close(); }
    },

    // RC-81 · B4 · chairs.js:16 ELIG green 'Eligible' / amber 'Verify' vs rail.js:12 'Active' / 'Re-verify' and board.js:167 button 'Re-verify';
    // chairs.js:12 ready_for_exam 'Exam requested' vs rail.js:85 humanize(status) '(ready for exam)'.
    // Negative control: for one store eligibility value the Chairs coverage chip, the Rail coverage chip and the Board control use one word
    // (each word set has one member), and one store status reads one way on the Chairs chip and the Rail line; then `drift` is empty and the
    // check reports false. The store value is read with each rendering so two screens showing two states are not scored as drift.
    async 'A-screens-chairs-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const ELIGW = /^(Eligible|Verify|Re-verify|Active|Inactive|Self-pay|Unknown|Not checked today)$/;
        const elig = (id) => p.evaluate((id) => window.__proto.state().appointments.find((a) => a.id === id).eligibility, id);
        const chairsChip = async (id) => { if (!(await p.$('#chairs-details-' + id + ':not([hidden])'))) { await click(p, 'chairs.card.' + id + '.expand'); await p.waitForTimeout(120); } return p.evaluate((id) => { const d = document.getElementById('chairs-details-' + id); const row = d ? [...d.querySelectorAll('.row')].find((r) => /^Coverage:/.test(r.textContent.trim())) : null; const ch = row ? row.querySelector('.chip') : null; return { coverageRow: row ? row.textContent.replace(/\s+/g, ' ').trim() : null, chip: ch ? ch.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim() : null }; }, id); };
        const railChip = async (id) => { await click(p, 'chairs.card.' + id + '.rail'); await p.waitForTimeout(200); return p.evaluate(() => { const r = document.getElementById('rail'); if (!r || r.hidden) return null; const chips = [...r.querySelectorAll('.chip')].map((c) => c.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()); const next = [...r.querySelectorAll('*')].map((e) => e.textContent.trim()).find((t) => /^Next: /.test(t)) || null; return { chips, nextLine: next }; }); };
        const rows = [];
        for (const id of ['a-1042', 'a-1050']) {
          const store = await elig(id);
          const chairs = await chairsChip(id);
          const rail = await railChip(id);
          rows.push({ appt: id, storeEligibility: store, chairsCoverageRow: chairs.coverageRow, chairsWord: chairs.chip, railWord: rail ? rail.chips.find((w) => ELIGW.test(w)) || null : null, railChips: rail ? rail.chips : null });
        }
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(200);
        const board = await p.evaluate(() => { const card = document.querySelector('[data-testid="board.card.a-1042"]'); const btn = document.querySelector('[data-testid="board.card.a-1042.reverify"]'); return { storeEligibility: window.__proto.state().appointments.find((a) => a.id === 'a-1042').eligibility, chips: card ? [...card.querySelectorAll('.chip')].map((c) => c.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()) : null, reverifyButton: btn ? btn.textContent.trim() : null }; });
        const wordSets = {};
        for (const r of rows) { const set = (wordSets[r.storeEligibility] = wordSets[r.storeEligibility] || new Set()); if (r.chairsWord) set.add(r.chairsWord); if (r.railWord) set.add(r.railWord); }
        if (board.storeEligibility === 'amber' && board.reverifyButton) (wordSets.amber = wordSets.amber || new Set()).add(board.reverifyButton);
        const drift = Object.fromEntries(Object.entries(wordSets).filter(([, s]) => s.size > 1).map(([k, s]) => [k, [...s]]));
        const measured = rows.every((r) => r.chairsWord && r.railWord);
        rec('A-screens-chairs-7', 'For one store eligibility value the Chairs coverage chip says "Verify" (amber) / "Eligible" (green) while the Rail coverage chip for the same patient says "Re-verify" / "Active" and the Board control says "Re-verify"', 'B4 — one canonical word per concept across screens, refusals, announcements and aria-labels; chairs.js:16 vs rail.js:12 vs board.js:167',
          measured && Object.keys(drift).length > 0, { perAppointment: rows, board, wordsByStoreEligibility: Object.fromEntries(Object.entries(wordSets).map(([k, s]) => [k, [...s]])), drift, variantsListedNotChosen: true });
      } finally { await c.close(); }
    },

    // RC-82 · C1, C5 · chairs.js:183 pageHead('Chairs · mine', ...) for every persona while :48 mine() returns every Main Street hygiene chair
    // plus the user's own for non-hygienists.
    // Negative control: the h1 names the set it shows — for the dentist the cards belong to one provider (the current user) or the heading does
    // not say "mine" — so `providers.length > 1 && saysMine` is false and the check reports false. Providers are read from the store for the
    // card ids actually rendered, and the hygienist reading is taken as the comparator where heading and set agree.
    async 'A-screens-chairs-8'(b) {
      const { c, p } = await ctx(b);
      try {
        const read = () => p.evaluate(() => { const S = window.__proto.state(); const me = Proto.store.currentUser(); const ids = [...document.querySelectorAll('[data-testid^="chairs.card."]')].map((e) => e.getAttribute('data-testid')).filter((t) => /^chairs\.card\.a-\d+$/.test(t)).map((t) => t.slice('chairs.card.'.length)); const appts = ids.map((id) => S.appointments.find((a) => a.id === id)).filter(Boolean); return { h1: ((document.querySelector('#canvas h1') || {}).textContent || '').trim(), sub: ((document.querySelector('#canvas .page-head .sub') || {}).textContent || '').trim(), listAriaLabel: (document.querySelector('#canvas .ch-list') || {}).getAttribute ? document.querySelector('#canvas .ch-list').getAttribute('aria-label') : null, currentUser: { id: me.id, role: me.role }, cards: ids.length, providers: [...new Set(appts.map((a) => a.providerId))], notMine: appts.filter((a) => a.providerId !== me.id).length, readyOffered: document.querySelectorAll('[data-testid$=".ready"]').length }; });
        await go(p, '#/dentist/chairs');
        const dentist = await read();
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const hygienist = await read();
        const saysMine = /\bmine\b/i.test(dentist.h1);
        const reproduced = saysMine && dentist.cards > 0 && dentist.providers.length > 1 && dentist.notMine > 0 && /all hygiene chairs/i.test(dentist.sub);
        rec('A-screens-chairs-8', 'For the dentist the h1 reads "Chairs · mine" while the list holds hygiene chairs from three providers and the sub line says "all hygiene chairs at Main Street"; the hygienist sees only her own under the same heading', 'C1, C5 — one h1 that names the place in plain words; the heading and the set it labels agree; chairs.js:183 (literal) vs :48 (mine())',
          reproduced, { dentist, hygienist, headingSaysMine: saysMine, hygienistHeadingSame: hygienist.h1 === dentist.h1 });
      } finally { await c.close(); }
    },

    // RC-83 · B2 · chairs.js:99 builds the outage refusal with verb 'Server unreachable — nothing writes'.
    // Negative control: a verb-first line opens with an imperative (Wait, Hold, Ask, Call, Retry, …) — `nounFirst` is false and the check
    // reports false. The refusal scored must carry code outage (refusal event and .refusal[data-code]); any other refusal is not this claim.
    async 'A-screens-chairs-9'(b) {
      const { c, p } = await ctx(b);
      try {
        const seated = await seat1042(p);
        await hop(p, '#/hygienist/chairs?outage=1'); await p.waitForTimeout(200);
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const refusals = refusalEvents(ev);
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'outage');
        const verb = await txt(p, 'refusal.verb');
        const control = await box(p, 'refusal.control');
        const firstWord = verb ? verb.split(/\s+/)[0] : null;
        const words = verb ? verb.split(/\s+/).filter(Boolean).length : 0;
        const IMPERATIVE = /^(Wait|Hold|Ask|Call|Retry|Try|Choose|Enter|Open|Post|File|Send|Check|Request|Confirm|Add|Save|Close|Show|Stop|Use|Pause|Keep|Read|Sign|Verify|Finish|Pick|Type|Tap|Press|Come|Go|Start|Let|Nothing)\b/i;
        const nounFirst = !!verb && !IMPERATIVE.test(verb) && /^Server\b/.test(verb);
        const isOutage = refusals.some((e) => e.code === 'outage') && dom.length > 0 && dom[0].verb === verb;
        rec('A-screens-chairs-9', 'The Chairs outage refusal verb line "Server unreachable — nothing writes" opens with the noun Server, not a verb', 'B2 / CONTRACTS §6 — the verb line is verb-first and at most eight words; chairs.js:99',
          seated === 'seated' && pressed && isOutage && nounFirst, { statusAfterSeat: seated, pressed, refusalEventsInRange: refusals, refusalDom: dom, verb, firstWord, words, controlBox: control, seqRange: range(ev, seq0), otherB2Elements: { controls: dom.length ? dom[0].controls.length : null, why: dom.length ? dom[0].why : null } });
      } finally { await c.close(); }
    },

    // RC-149 · A8 · chairs.js:40-43 monthsAgo splits its argument without a guard.
    // Negative control: a safe helper returns a number (or null) for null, undefined, '' and 'yesterday' and 14 for '2025-07-01' — no throw,
    // no NaN — so `throwsOnNull || nanOnBadInput` is false and the check reports false. Ordinary and boundary values are read alongside so
    // the helper is shown to be the exported one working on its normal inputs.
    async 'A-screens-chairs-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const out = await p.evaluate(() => {
          const f = Proto.screens.chairs && Proto.screens.chairs.monthsAgo;
          if (typeof f !== 'function') return { exported: false };
          const run = (x) => { try { const v = f(x); return Number.isNaN(v) ? 'NaN' : v; } catch (e) { return 'THROWS ' + e.constructor.name + ': ' + e.message; } };
          return { exported: true, today: window.__proto.state().tenant.today, results: { null: run(null), undefined: run(undefined), empty: run(''), yesterday: run('yesterday'), '2025-07-01': run('2025-07-01'), '2026-09-03': run('2026-09-03'), '2026-09-04': run('2026-09-04'), '2025-09-04': run('2025-09-04'), '2025-09-03': run('2025-09-03') } };
        });
        const r = out.results || {};
        const throwsOnNull = typeof r.null === 'string' && /^THROWS TypeError/.test(r.null) && typeof r.undefined === 'string' && /^THROWS/.test(r.undefined);
        const nanOnBadInput = r.empty === 'NaN' && r.yesterday === 'NaN';
        const ordinaryOk = r['2025-07-01'] === 14 && r['2026-09-03'] === 0 && r['2026-09-04'] === 0;
        rec('A-screens-chairs-10', 'Proto.screens.chairs.monthsAgo throws TypeError on null/undefined and returns NaN for "" and "yesterday", while ordinary ISO dates are correct (2025-07-01 → 14)', 'A8 — pure helpers return correct values on ordinary, boundary and null inputs; chairs.js:40',
          out.exported === true && throwsOnNull && nanOnBadInput && ordinaryOk, { ...out, throwsOnNull, nanOnBadInput, ordinaryOk, uiPathReachesThrow: false, note: 'callers guard with lastPerio() truthiness (chairs.js:71, :76), so no UI path reaches the throw' });
      } finally { await c.close(); }
    },

    // RC-249 · C2 · chairs.js:150-155 give every card two reversible-identity buttons labelled Perio and Note (and a third, irreversible
    // Ready for exam, once seated); no card carries exactly one primary.
    // Negative control: each card renders exactly one button of a primary identity (irreversible or reversible), labelled with a verb —
    // `cardsWithoutOnePrimary` is empty and the check reports false. Quiet and Held buttons are listed but not counted as primaries. The
    // seed state is read first; then a-1042 is seated and re-read so the state with Ready for exam is measured too.
    async 'A-screens-chairs-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const readCards = () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="chairs.card."]')].filter((e) => /^chairs\.card\.a-\d+$/.test(e.getAttribute('data-testid'))).map((card) => {
          const buttons = [...card.querySelectorAll('button')].map((b) => ({ testid: b.getAttribute('data-testid'), identity: (b.className.match(/\b(irreversible|reversible|quiet|held)\b/) || [null, null])[1], label: b.textContent.replace(/^✓\s*/, '').trim() }));
          const primaries = buttons.filter((b) => b.identity === 'irreversible' || b.identity === 'reversible');
          const status = window.__proto.state().appointments.find((a) => a.id === card.getAttribute('data-testid').slice('chairs.card.'.length)).status;
          return { card: card.getAttribute('data-testid'), status, buttons, primaryCount: primaries.length, primaryLabels: primaries.map((b) => b.label) };
        }));
        const seed = await readCards();
        await hop(p, '#/frontdesk/board'); await click(p, 'board.card.a-1042.arrive'); await click(p, 'board.card.a-1042.seat'); await p.waitForTimeout(150);
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const seated = (await readCards()).find((x) => x.card === 'chairs.card.a-1042') || null;
        const cardsWithoutOnePrimary = seed.filter((x) => x.primaryCount !== 1).map((x) => ({ card: x.card, status: x.status, primaryCount: x.primaryCount, primaryLabels: x.primaryLabels }));
        const labelSet = [...new Set(seed.flatMap((x) => x.primaryLabels))];
        const reproduced = seed.length > 0 && cardsWithoutOnePrimary.length === seed.length && !!seated && seated.primaryCount !== 1;
        rec('A-screens-chairs-11', 'Every Chairs card carries two reversible-identity buttons labelled with the nouns Perio and Note (three primaries once seated, with Ready for exam), so no card has exactly one primary action', 'C2 — every row has exactly one primary action, labelled with a verb that states what happens; chairs.js:150-155',
          reproduced, { cardsInSeedState: seed, cardsWithoutOnePrimary, primaryLabelsSeen: labelSet, a1042AfterSeat: seated, identitiesCounted: ['irreversible', 'reversible'], identitiesListedNotCounted: ['quiet', 'held'] });
      } finally { await c.close(); }
    },
  };
};
