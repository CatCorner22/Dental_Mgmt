// Swarm hunt, lens palette-rail-privacy: palette.js, rail.js, ui.js helpers, and the privacy/PHI sweep across
// every persona × route on operatory and shared glass. Check ids S-palette-rail-privacy-<n>.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => (ev.length ? [seq0 + 1, ev[ev.length - 1].seq] : [seq0, seq0]);
  const kinds = (ev) => ev.map((e) => e.seq + ':' + e.kind + (e.code ? ':' + e.code : '') + (e.table ? ':' + e.table + '/' + e.id : ''));
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const gatesUp = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => (r.dataset.code || '?') + '@' + (r.closest('#dialogs') ? 'dialog' : 'canvas')));
  const tableCounts = (p) => p.evaluate(() => Object.fromEntries(Object.entries(window.__proto.state()).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])));
  const diffCounts = (a, b) => Object.fromEntries(Object.keys({ ...a, ...b }).filter((k) => (a[k] || 0) !== (b[k] || 0)).map((k) => [k, [(a[k] || 0), (b[k] || 0)]]));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const phoneNameRow = (p) => p.evaluate(() => ((document.querySelector('.ph-card .ph-kv .ph-v') || {}).textContent || '').trim());
  // Palette: open, type, take row i, then enter a wrong date of birth so the second_identifier gate stands.
  const wrongDob = async (p, q, rowIndex) => {
    await p.keyboard.press('Control+k'); await p.waitForTimeout(120);
    await fill(p, 'palette.input', q); await p.waitForTimeout(120);
    await click(p, 'palette.row.' + rowIndex);
    await fill(p, 'palette.confirm.dob', '01/01/2000');
    await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  };

  return {
    // A2/A3 · phone.js:181 · Show name's aria-label promises "this tap is logged", and docs/13 §feature 24 says the card shows the
    // full name "only after a logged tap"; the handler only flips st().nameShown and re-renders: no store write, no disclosures row,
    // no write event. (A-screens-phone-1-2 scores the earlier phantom write event and reports false when nothing fires at all.)
    // Negative control: a compliant tap grows state().disclosures by one and logs one write event for that row; then
    // writeEvents.length > 0 / disclosures grows and the check reports false.
    async 'S-palette-rail-privacy-1'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals?device=phone');
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const request = await p.evaluate(() => (window.__proto.state().approvals.find((a) => a.id === 'ar-1') || null));
        const label = await p.$eval('[data-testid="phone.request.ar-1.name"]', (e) => e.getAttribute('aria-label')).catch(() => null);
        const before = await tableCounts(p);
        const nameBefore = await phoneNameRow(p);
        const seq0 = await lastSeq(p);
        const tapped = await click(p, 'phone.request.ar-1.name'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const afterC = await tableCounts(p);
        const nameAfter = await phoneNameRow(p);
        const controlGone = !(await p.$('[data-testid="phone.request.ar-1.name"]'));
        const w = writes(ev);
        const revealed = !!request && request.status === 'pending' && tapped && /Lena Fischer/.test(nameAfter) && !/Lena Fischer/.test(nameBefore) && controlGone;
        const reproduced = revealed && /logged/i.test(label || '') && w.length === 0 && (afterC.disclosures || 0) === (before.disclosures || 0) && Object.keys(diffCounts(before, afterC)).length === 0;
        rec('S-palette-rail-privacy-1', 'Show name reveals the full patient name on the phone card with no write event and no disclosures row although its own label reads "this tap is logged"', 'A2/A3 — the control does what its label promises and a PHI disclosure writes one row; docs/13 feature 24 "full name only after a logged tap"; phone.js:181',
          reproduced, { request, controlAriaLabel: label, nameRowBefore: nameBefore, nameRowAfter: nameAfter, controlGoneAfterTap: controlGone, disclosuresBeforeAfter: [before.disclosures || 0, afterC.disclosures || 0], tableCountDiff: diffCounts(before, afterC), writeEvents: w, eventsAfterTap: kinds(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // B8 · phone.js:179-181 · privacy mode is supposed to turn names into initials on shared glass, and the card's own sentence
    // (store.approvalSentence) reads "on LF"; the name row is gated only by st().nameShown, so with privacy=1 on device=shared
    // Show name prints "Lena Fischer" beside a sentence that says "LF", and a name revealed on the phone stays printed after the
    // same user's glass turns to privacy=1 shared with no Show name control left to hide it.
    // Negative control: under privacy the name row keeps the initials (or hides Show name) so fullNameUnderPrivacy is false and
    // the check reports false.
    async 'S-palette-rail-privacy-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/phone/approvals?device=shared&privacy=1');
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const flags = await p.evaluate(() => ({ privacy: window.__proto.privacy, device: window.__proto.device }));
        const rowBefore = await phoneNameRow(p);
        const sentenceBefore = await p.evaluate(() => ([...document.querySelectorAll('.ph-card p')].map((e) => e.textContent.trim()).find((t) => /requested by/i.test(t)) || null));
        const tapped = await click(p, 'phone.request.ar-1.name'); await p.waitForTimeout(150);
        const leg1 = await p.evaluate(() => ({ privacy: window.__proto.privacy, device: window.__proto.device, row: ((document.querySelector('.ph-card .ph-kv .ph-v') || {}).textContent || '').trim(), sentence: [...document.querySelectorAll('.ph-card p')].map((e) => e.textContent.trim()).find((t) => /requested by/i.test(t)) || null, fullNameInCanvas: document.getElementById('canvas').textContent.includes('Lena Fischer') }));
        // Leg 2: reveal on the phone (no privacy), then the same owner's glass turns to privacy=1 shared.
        await go(p, '#/phone/approvals?device=phone');
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        await click(p, 'phone.request.ar-1.name'); await p.waitForTimeout(100);
        await hop(p, '#/phone/approvals?device=shared&privacy=1'); await p.waitForTimeout(150);
        const leg2 = await p.evaluate(() => ({ privacy: window.__proto.privacy, device: window.__proto.device, row: ((document.querySelector('.ph-card .ph-kv .ph-v') || {}).textContent || '').trim(), showNameControl: !!document.querySelector('[data-testid="phone.request.ar-1.name"]'), fullNameInCanvas: document.getElementById('canvas').textContent.includes('Lena Fischer') }));
        const fullNameUnderPrivacy = leg1.privacy === true && leg1.device === 'shared' && /Lena Fischer/.test(leg1.row);
        const sentenceRedacts = /\bLF\b/.test(leg1.sentence || '') && !/Lena Fischer/.test(leg1.sentence || '');
        const persists = leg2.privacy === true && leg2.device === 'shared' && /Lena Fischer/.test(leg2.row) && !leg2.showNameControl;
        const reproduced = flags.privacy === true && flags.device === 'shared' && /^LF\b/.test(rowBefore) && tapped && fullNameUnderPrivacy && sentenceRedacts && persists;
        rec('S-palette-rail-privacy-2', 'With privacy=1 on a shared device the phone card prints "Lena Fischer · MRN-306" after Show name while its own sentence reads "on LF", and a name revealed on the phone stays printed after the glass turns to privacy mode', 'B8 — privacy mode turns names into initials everywhere on operatory and shared devices, nothing leaks; phone.js:179-181',
          reproduced, { flagsAtStart: flags, nameRowBefore: rowBefore, sentenceBefore, afterShowName: leg1, afterRevealThenPrivacyFlip: leg2, fullNameUnderPrivacy, sentenceRedactsSameCard: sentenceRedacts, persistsAcrossPrivacyFlip: persists });
      } finally { await c.close(); }
    },

    // A3/C8 · ui.js:52-64 · refusal() keeps one module-level `lastGate` key (code|verb|control) to skip re-logging a gate the
    // screen re-renders. The key does not know which gate instance stands: after Try again a second wrong date of birth, a wrong
    // date for a different patient, and a wrong date after the palette is closed and reopened are new raises that log no refusal
    // event and announce nothing (#live is not touched: zero mutations); and when the palette gate stands over a screen with its
    // own gate, the screen's next re-render (Explain toggled) logs and announces its unchanged gate a second time.
    // Negative control: each raise logs one second_identifier event and re-announces the verb (secondIdentifierEvents === 4,
    // liveMutations > 0), and the standing ledger gate is not re-logged after the palette (its event count stays 1); then the
    // check reports false.
    async 'S-palette-rail-privacy-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const seq0 = await lastSeq(p);
        await wrongDob(p, 'vega', 0);
        const raise1 = { gates: await gatesUp(p), live: await live(p), focus: await active(p) };
        await click(p, 'refusal.control'); await p.waitForTimeout(100);              // Try again: gate cleared, input focused
        const cleared = { gates: await gatesUp(p), focus: await active(p) };
        // Count writes to the live region from here on: announce() clears #live and sets the verb 10 ms later.
        await p.evaluate(() => { window.__liveMut = 0; const el = document.getElementById('live'); new MutationObserver(() => { window.__liveMut++; }).observe(el, { childList: true, characterData: true, subtree: true }); });
        await fill(p, 'palette.confirm.dob', '02/02/2001'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const raise2 = { gates: await gatesUp(p), live: await live(p), focus: await active(p) };
        await click(p, 'refusal.control'); await p.waitForTimeout(100);
        await click(p, 'palette.confirm.back'); await p.waitForTimeout(100);
        await click(p, 'palette.row.1'); await fill(p, 'palette.confirm.dob', '01/01/2000'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const raise3 = { patientLine: await p.evaluate(() => ((document.querySelector('#dialogs .pal-confirm b, #dialogs .pal-confirm p') || {}).textContent || '').trim()), gates: await gatesUp(p), live: await live(p) };
        await p.keyboard.press('Escape'); await p.waitForTimeout(120);
        await wrongDob(p, 'vega', 0);
        const raise4 = { gates: await gatesUp(p), live: await live(p) };
        const liveMutations = await p.evaluate(() => window.__liveMut);
        const evA = await after(p, seq0);
        const secondIdentifierEvents = refusalEvents(evA).filter((e) => e.code === 'second_identifier');
        const raisesSeen = [raise1, raise2, raise3, raise4].filter((r) => r.gates.some((g) => g.startsWith('second_identifier@dialog'))).length;
        // Leg B: a standing canvas gate is re-logged after the palette gate has taken the dedup slot.
        await go(p, '#/biller/ledger/p-301');
        const seqB = await lastSeq(p);
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(150);
        const gateEvents0 = refusalEvents(await after(p, seqB));
        const standing = gateEvents0.length === 1 ? gateEvents0[0] : null;               // the ledger's own gate (statement_held or zero_collect_refused by seed)
        const ledgerGate = { gates: await gatesUp(p), live: await live(p), event: standing };
        await click(p, 'ledger.explain'); await p.waitForTimeout(120);                 // re-render with the gate standing: no new event (by design)
        const sameGateAfterExplain = standing ? refusalEvents(await after(p, seqB)).filter((e) => e.code === standing.code).length : -1;
        await wrongDob(p, 'vega', 0);
        await p.keyboard.press('Escape'); await p.waitForTimeout(120);
        const gatesAfterEscape = await gatesUp(p);
        await click(p, 'ledger.explain'); await p.waitForTimeout(150);                 // same gate, unchanged, re-rendered once more
        const evB = await after(p, seqB);
        const sameGateEvents = standing ? refusalEvents(evB).filter((e) => e.code === standing.code && e.verb === standing.verb) : [];
        const liveAfter = await live(p);
        const legA = raisesSeen === 4 && secondIdentifierEvents.length === 1 && liveMutations === 0;
        const legB = !!standing && ledgerGate.gates.includes(standing.code + '@canvas') && sameGateAfterExplain === 1 && gatesAfterEscape.includes(standing.code + '@canvas') && sameGateEvents.length === 2 && liveAfter === standing.verb;
        rec('S-palette-rail-privacy-3', 'ui.refusal dedups by a single last-gate key: four wrong date-of-birth raises (retry, another patient, reopened palette) log one second_identifier event and the last three never touch the live region, while the ledger\'s standing gate is logged and announced a second time once the palette gate has passed through the slot', 'A3 — a gate writes one refusal event; C8 — announcements; ui.js:52-64 (lastGate), palette.js:298-328 confirmDob, app.js:38 resetGates only on route change',
          legA && legB, { legA: { raise1, afterTryAgain: cleared, raise2, raise3, raise4, raisesSeen, liveMutationsDuringRaises2to4: liveMutations, secondIdentifierEvents, refusalEvents: refusalEvents(evA), seqRange: range(evA, seq0) }, legB: { ledgerGate, standingGateEventsAfterExplainWithGateUp: sameGateAfterExplain, gatesAfterPaletteEscape: gatesAfterEscape, standingGateEvents: sameGateEvents, liveAfterSecondExplain: liveAfter, refusalEvents: refusalEvents(evB), seqRange: range(evB, seqB) } });
      } finally { await c.close(); }
    },

    // B10 · ui.js:118,127 · every dialog registers its own capture-phase keydown listener on document; Escape calls
    // ev.stopPropagation(), which does not stop the other listeners on the same node, so one Escape with the palette open
    // over the Statement preview closes both dialogs.
    // Negative control: Escape closes only the top dialog (dialogsAfterEscape === 1, Statement preview still open, focus back
    // on its close control) and the check reports false.
    async 'S-palette-rail-privacy-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-301');
        await click(p, 'ledger.statement.preview'); await p.waitForTimeout(150);
        const dialogs = () => p.evaluate(() => [...document.querySelectorAll('#dialogs [role="dialog"]')].map((d) => d.getAttribute('aria-label') || ((d.querySelector('h2') || {}).textContent || '').trim()));
        const one = { dialogs: await dialogs(), focus: await active(p) };
        await p.keyboard.press('Control+k'); await p.waitForTimeout(150);
        const two = { dialogs: await dialogs(), focus: await active(p) };
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        const afterEsc = { dialogs: await dialogs(), focus: await active(p) };
        const reproduced = one.dialogs.length === 1 && two.dialogs.length === 2 && two.focus === 'palette.input' && afterEsc.dialogs.length === 0;
        rec('S-palette-rail-privacy-4', 'One Escape with the palette open over the Statement preview closes both dialogs: each dialog\'s capture keydown listener runs and stopPropagation does not stop a sibling listener on document', 'B10 — dialogs hold focus and Escape closes them (the one that holds focus); ui.js:118, :127',
          reproduced, { afterPreviewOpen: one, afterCtrlK: two, afterOneEscape: afterEsc });
      } finally { await c.close(); }
    },

    // C5/B4 · palette.js:138-139 · the hint and the aria-live status say "N shown — the list is capped" for every non-empty
    // result, including a query whose two matches are the whole match set; store.search caps at eight, so the sentence is false
    // whenever fewer than eight rows come back.
    // Negative control: the hint carries the cap notice only when the store truncated (shown < uncapped matches); for a
    // two-row result the hint and status omit "capped" and the check reports false.
    async 'S-palette-rail-privacy-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await p.keyboard.press('Control+k'); await p.waitForTimeout(120);
        await fill(p, 'palette.input', 'vega'); await p.waitForTimeout(150);
        const hint = await p.evaluate(() => ((document.getElementById('palette-hint') || {}).textContent || '').trim() || null);
        const status = await p.evaluate(() => ((document.getElementById('palette-status') || {}).textContent || '').trim() || null);
        const rows = await p.evaluate(() => document.querySelectorAll('[data-testid^="palette.row."]').length);
        const storeReturned = await p.evaluate(() => Proto.store.search('vega').length);
        const uncapped = await p.evaluate(() => { const q = 'vega'; const S = window.__proto.state(); return S.patients.filter((x) => x.name.toLowerCase().includes(q) || x.phone.endsWith(q) || x.mrn.toLowerCase().includes(q)).length; });
        const claimsCap = /capped/i.test(hint || '') && /capped/i.test(status || '');
        const reproduced = rows === storeReturned && storeReturned === uncapped && uncapped > 0 && uncapped < 8 && claimsCap;
        rec('S-palette-rail-privacy-5', 'The palette hint and its aria-live status read "2 shown — the list is capped" for a query whose two matches are the entire match set (no row was cut)', 'C5 — one fact has one value; B4 — vocabulary that states a truncation that did not happen; palette.js:138-139',
          reproduced, { query: 'vega', rowsRendered: rows, storeReturned, uncappedPatientMatches: uncapped, hint, status });
      } finally { await c.close(); }
    },

    // A1/A4 · dailyclose.js:207-208 · the Tighten and Retire handlers reference an undefined `T` after Proto.store.reviewDecision
    // has already written decisions/d-1 and controlDecisions; the ReferenceError aborts the handler before rerender/say, so the
    // decided card stays on screen with its three buttons, nothing is announced, and a second press writes a second
    // controlDecisions row (store.js reviewDecision has no already-decided guard). Found while sweeping every control on every
    // route under privacy; Keep on the same card is the negative comparator and does not throw.
    // Negative control: Tighten writes its rows, no pageerror, the card leaves the screen with a result line and an
    // announcement, and the second press has no control to press; then pageErrors is empty and the check reports false.
    async 'S-palette-rail-privacy-6'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const before = await p.evaluate(() => ({ threshold: window.__proto.state().tenant.dualReleaseThresholdCents, d1: (window.__proto.state().decisions.find((d) => d.id === 'd-1') || {}).status, controlDecisions: window.__proto.state().controlDecisions.map((x) => x.id + ':' + x.action + ':' + x.supersedes) }));
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'close.decision.d-1.tighten'); await p.waitForTimeout(200);
        const ev1 = await after(p, seq0);
        const afterFirst = await p.evaluate(() => ({ threshold: window.__proto.state().tenant.dualReleaseThresholdCents, d1: (window.__proto.state().decisions.find((d) => d.id === 'd-1') || {}).status, controlDecisions: window.__proto.state().controlDecisions.map((x) => x.id + ':' + x.action + ':' + x.supersedes), cardStill: !!document.querySelector('[aria-label="Decision d-1"]'), buttonsStill: [...document.querySelectorAll('[data-testid^="close.decision.d-1."]')].map((e) => e.getAttribute('data-testid')), resultLine: [...document.querySelectorAll('#canvas *')].map((e) => e.textContent.trim()).find((t) => /^Tightened:/.test(t)) || null, live: (document.getElementById('live') || {}).textContent || '' }));
        const pageErrors = errs.slice();
        const pressedAgain = await click(p, 'close.decision.d-1.tighten'); await p.waitForTimeout(200);
        const ev2 = await after(p, seq0);
        const afterSecond = await p.evaluate(() => ({ d1: (window.__proto.state().decisions.find((d) => d.id === 'd-1') || {}).status, controlDecisions: window.__proto.state().controlDecisions.map((x) => x.id + ':' + x.action + ':' + x.supersedes) }));
        const wrote = writes(ev1).some((w) => w.table === 'controlDecisions');
        const reproduced = before.d1 === 'review_due' && pressed && wrote && afterFirst.d1 === 'tighten' && pageErrors.some((e) => /T is not defined/.test(e)) && ev1.some((e) => e.kind === 'error') && afterFirst.cardStill && afterFirst.buttonsStill.includes('close.decision.d-1.tighten') && afterFirst.resultLine === null && afterFirst.live === '' && pressedAgain && afterSecond.controlDecisions.length === afterFirst.controlDecisions.length + 1;
        rec('S-palette-rail-privacy-6', 'Tighten on decision d-1 throws "T is not defined" after the store has written decisions/d-1 and a controlDecisions row: the card and its buttons stay, nothing is announced, and a second press writes a second controlDecisions row for the same decision', 'A1 — no page error; A4 — repeating the control does not double-write; dailyclose.js:207-208 (undefined T), store.js reviewDecision (no already-decided guard)',
          reproduced, { before, afterFirstPress: afterFirst, pageErrors, eventsFirstPress: kinds(ev1), afterSecondPress: afterSecond, eventsBothPresses: kinds(ev2), seqRange: range(ev2, seq0) });
      } finally { await c.close(); }
    },
  };
};
