// Verifier checks for prototype/js/screens/dailyclose.js (chunk screens-dailyclose-2).
// Root causes, in order: RC-91, RC-225, RC-156, RC-157, RC-158, RC-159, RC-160.
// Default position is NOT reproduced: every check measures the breach it claims and states its negative control.
//
// Three measurement rules this file follows, each of which produced a wrong verdict elsewhere when broken:
//   1. CSS consequences are read with getComputedStyle. document.styleSheets[i].cssRules throws over file:// and a
//      catch-and-continue silently returns an empty rule list, which reads as "no rule exists".
//   2. A second go() to the same file URL is a same-document navigation, so a screen module's state (dailyclose.js
//      `st`, which is only reset when store identity changes) carries over between legs. Legs that need a clean
//      screen get their own document (blank() then go()); the one place a leg deliberately reuses the document is
//      marked, because there the store write must survive.
//   3. A collapsed <details> still lays out with a non-zero box in this Chromium, so "visible prose" is decided by
//      ancestry (closest('details')) plus computed visibility, never by box size.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec, FILE }) => {
  const blank = async (p) => { await p.goto('about:blank'); };
  const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
  const flat = (s) => (s || '').replace(/\s+/g, ' ').trim();
  // Chip word = the chip's text minus its shape glyph, plus the computed styles that could change what is read.
  const chips = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas .chip')].map((e) => {
    const g = e.querySelector('.glyph'); const cs = getComputedStyle(e);
    return { word: (e.textContent || '').replace(g ? g.textContent : '', '').trim(), glyph: g ? g.textContent : null, cls: e.className, textTransform: cs.textTransform, fontVariantCaps: cs.fontVariantCaps, visibility: cs.visibility };
  }));
  const live = (p) => p.evaluate(() => (document.getElementById('live') || {}).textContent || '');
  const riskRows = (p) => p.evaluate(() => [...document.querySelectorAll('section[aria-label="Due now"] .dc-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()));
  const LONG_DATE = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;                // longDate: 8/4/2026
  const SHORT_DATE = /(?<!\d)\d{1,2}\/\d{1,2}(?!\/?\d)/g;          // shortDate: 9/1 (not the head of 9/24/2026)

  return {
    // RC-91 (C6, claimed P2): policy prose sits on the Close day finish path. dailyclose.js:218 puts a 30-word paragraph
    // about reversal-and-repost pairs inside the Confirm close day group, between the totals and close.closeday.confirm,
    // outside any disclosure; dailyclose.js:189 puts the after-hours-hold policy in the Approvals section footer.
    // Negative control: if that copy sat behind a Why/disclosure, the same walk would find it under a <details> ancestor
    // and proseOutsideDetails would be empty, so the check reports false. It also reports false if the confirm group does
    // not carry the finish control (then it is not a finish path) or if the paragraph is not actually rendered
    // (visibility measured with getComputedStyle, not by box size, because a collapsed <details> still has a box).
    async 'A-screens-dailyclose-2-1'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        await click(p, 'close.closeday'); await p.waitForTimeout(150);
        const m = await p.evaluate(() => {
          const card = document.querySelector('[aria-label="Confirm close day"]');
          const read = (root) => root ? [...root.querySelectorAll('p, li')].map((e) => ({
            text: (e.textContent || '').replace(/\s+/g, ' ').trim(),
            words: (e.textContent || '').trim().split(/\s+/).filter(Boolean).length,
            inDetails: !!e.closest('details'),
            visibility: getComputedStyle(e).visibility,
            display: getComputedStyle(e).display,
          })) : [];
          const kids = card ? [...card.children] : [];
          const idx = (pred) => kids.findIndex(pred);
          const appr = document.querySelector('section[aria-label^="Approvals only I can give"]');
          return {
            confirmCardFound: !!card,
            finishControlInCard: !!(card && card.querySelector('[data-testid="close.closeday.confirm"]')),
            confirmParas: read(card),
            confirmDetailsCount: card ? card.querySelectorAll('details').length : 0,
            proseIndex: idx((e) => e.tagName === 'P'),
            totalRowIndex: idx((e) => /Total/.test(e.textContent || '') && e.classList.contains('tender')),
            finishRowIndex: idx((e) => !!e.querySelector('[data-testid="close.closeday.confirm"]')),
            approvalParas: read(appr),
            approvalsDetailsCount: appr ? appr.querySelectorAll('details').length : 0,
          };
        });
        const outside = m.confirmParas.filter((x) => !x.inDetails && x.visibility !== 'hidden' && x.words > 0);
        const apprOutside = m.approvalParas.filter((x) => !x.inDetails && x.visibility !== 'hidden' && /After-hours hold/.test(x.text));
        const evidence = {
          startHash: '#/owner/close (owner, desk 1280x900, light)', steps: ['close.closeday'],
          confirmCardFound: m.confirmCardFound, finishControlInSameCard: m.finishControlInCard,
          disclosuresInConfirmCard: m.confirmDetailsCount, disclosuresInApprovalsSection: m.approvalsDetailsCount,
          proseOutsideDetails: outside, proseWordsOutsideDetails: outside.reduce((s, x) => s + x.words, 0),
          domOrderInConfirmCard: { totalRow: m.totalRowIndex, prose: m.proseIndex, finishButtonRow: m.finishRowIndex },
          proseSitsBetweenTotalsAndFinish: m.totalRowIndex >= 0 && m.proseIndex > m.totalRowIndex && m.finishRowIndex > m.proseIndex,
          approvalsPolicyProse: apprOutside, pageErrors: errs,
        };
        const reproduced = m.confirmCardFound && m.finishControlInCard && m.confirmDetailsCount === 0
          && outside.some((x) => x.words >= 20 && /reversal-and-repost/.test(x.text))
          && evidence.proseSitsBetweenTotalsAndFinish
          && apprOutside.length === 1 && m.approvalsDetailsCount === 0;
        rec('A-screens-dailyclose-2-1', 'The Confirm close day group carries a 30-word policy paragraph about reversal-and-repost pairs between the totals and Close day, outside any disclosure, and the Approvals section carries the after-hours-hold policy the same way', 'C6 (CHECKLIST): policy prose never on the finish path; explanations behind Why or a disclosure', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-225 (B4 capitalization drift; B5 chip shape, claimed P2): chips rendered by dailyclose.js drift to lowercase
    // ("tied", "gap -$312.40" at line 115; "critical"/"high" at 195; "directional" at 178 and 232; "past review", "due",
    // "due 9/5", "none" at 274-278) while chips on the same screens are sentence case ("Tied . independent", "1 variance",
    // "Variance $312.40", "Review was due 9/1 (2 days ago)", "Expires 10/1", "21 days").
    // Negative control: the drift is in the text a reader sees only if no CSS re-cases it, so textTransform and
    // fontVariantCaps are read with getComputedStyle on every chip (never by scanning document.styleSheets, which throws
    // over file:// and would silently report "no rule"). If any chip carried text-transform: capitalize/uppercase, or if
    // every chip word started with a capital, lowercaseChips would be empty and the check reports false.
    async 'A-screens-dailyclose-2-2'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        // Leg 1: Daily Close with the tile and the variance location open.
        await go(p, '#/owner/close');
        await click(p, 'close.tied.tile'); await p.waitForTimeout(120);
        if (!(await p.$('[data-testid="close.tender.card"]'))) { await click(p, 'close.location.loc-3'); await p.waitForTimeout(120); }
        const closeChips = await chips(p);
        // Leg 2: Practice risk on its own document, so leg 1's open tile cannot leak through dailyclose.js's module state
        // (a second go() to the same file URL is a same-document navigation and would keep `st`).
        await blank(p); await go(p, '#/owner/risk');
        const riskChips = await chips(p);
        // Leg 3: the "none" chip needs d-1 out of review_due, so this leg deliberately keeps one document: the Retire
        // write must survive the move from close to risk.
        await blank(p); await go(p, '#/owner/close');
        await click(p, 'close.decision.d-1.retire'); await p.waitForTimeout(150);
        await hop(p, '#/owner/risk'); await p.waitForTimeout(150);
        const riskChipsNoDecisions = await chips(p);
        const all = [...closeChips, ...riskChips, ...riskChipsNoDecisions];
        const lower = [...new Set(all.filter((x) => /^[a-z]/.test(x.word || '')).map((x) => x.word))];
        const upper = [...new Set(all.filter((x) => /^[A-Z]/.test(x.word || '')).map((x) => x.word))];
        const numeric = [...new Set(all.filter((x) => /^[0-9]/.test(x.word || '')).map((x) => x.word))];
        const recased = all.filter((x) => x.textTransform !== 'none' || (x.fontVariantCaps !== 'normal' && x.fontVariantCaps !== ''));
        const glyphless = all.filter((x) => !x.glyph);
        const evidence = {
          startHash: '#/owner/close (owner, desk 1280x900, light) then #/owner/risk',
          steps: ['close.tied.tile', 'close.location.loc-3 (only if the tile did not auto-open it)', 'blank + #/owner/risk', 'close.decision.d-1.retire then #/owner/risk'],
          closeChips, riskChips, riskChipsAfterRetire: riskChipsNoDecisions,
          lowercaseChips: lower, sentenceCaseChipsOnSameScreens: upper, digitLedChipsOnSameScreens: numeric,
          computedTextTransformValues: [...new Set(all.map((x) => x.textTransform))],
          computedFontVariantCapsValues: [...new Set(all.map((x) => x.fontVariantCaps))],
          chipsRecasedByCss: recased.length, chipsWithoutGlyph: glyphless.map((x) => x.word),
          pageErrors: errs,
        };
        const reproduced = recased.length === 0 && lower.length >= 6 && upper.length >= 4
          && ['tied', 'critical', 'high', 'directional', 'past review', 'due'].every((w) => lower.includes(w))
          && lower.some((w) => /^gap /.test(w)) && lower.includes('none');
        rec('A-screens-dailyclose-2-2', 'Nine chip words rendered by dailyclose.js are lowercase ("tied", "gap -$312.40", "critical", "high", "directional", "past review", "due", "due 9/5", "none") while chips beside them are sentence case, and no CSS re-cases them', 'B4 (CHECKLIST): one canonical word per concept, capitalization drift reported; B5: chip = glyph + word + fill', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-156 (B4, claimed P3): one destination, two labels. The Daily Close approval row (dailyclose.js:188) says
    // "Open phone card"; the Andon strip control (shell.js:53) says "Open approvals"; both set location.hash to
    // #/phone/approvals, whose h1 is "Approvals". Dismiss controls drift too: "Cancel" (close.closeday.cancel,
    // dailyclose.js:227), "Close" (money.appeal.close), "Back to Board" (checkout.back).
    // Negative control: two labels are only a defect if they lead to the same place, so each control is pressed and the
    // resulting hash and h1 are recorded. If both carried one label, or if they landed on different routes, the check
    // reports false. Likewise the dismiss set must contain at least two distinct leading words.
    async 'A-screens-dailyclose-2-3'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        // One pending approval, so the Daily Close row and the Andon strip both render.
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const pending = (await state(p)).approvals.filter((a) => a.status === 'pending').map((a) => a.id);
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        const rowLabel = await txt(p, 'close.approval.ar-1.open');
        const andonLabel = await txt(p, 'andon.control');
        await click(p, 'close.approval.ar-1.open'); await p.waitForTimeout(200);
        const viaRow = await p.evaluate(() => ({ hash: location.hash, h1: (document.querySelector('h1') || {}).textContent || null }));
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        await click(p, 'andon.control'); await p.waitForTimeout(200);
        const viaAndon = await p.evaluate(() => ({ hash: location.hash, h1: (document.querySelector('h1') || {}).textContent || null }));
        // Dismiss labels for one concept, across the screens that render them.
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        await click(p, 'close.closeday'); await p.waitForTimeout(120);
        const cancelLabel = await txt(p, 'close.closeday.cancel');
        await hop(p, '#/frontdesk/checkout/a-1044'); await p.waitForTimeout(150);
        const backLabel = await txt(p, 'checkout.back');
        await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150);
        const closeLabel = await txt(p, 'money.appeal.close');
        const dismiss = { 'close.closeday.cancel': cancelLabel, 'money.appeal.close': closeLabel, 'checkout.back': backLabel };
        const leadWords = [...new Set(Object.values(dismiss).filter(Boolean).map((s) => s.split(/\s+/)[0]))];
        const evidence = {
          startHash: '#/biller/money (biller, desk 1280x900, light) then #/owner/close',
          steps: ['money.writeoff.p-306', 'money.writeoff.reason.courtesy', 'money.writeoff.post', '#/owner/close', 'close.approval.ar-1.open', 'andon.control', 'close.closeday', 'checkout.back', 'money.appeal.close'],
          pendingApprovals: pending,
          labelOnDailyClose: rowLabel, labelOnAndon: andonLabel,
          destinationViaDailyCloseRow: viaRow, destinationViaAndon: viaAndon,
          dismissLabels: dismiss, dismissLeadWords: leadWords, pageErrors: errs,
        };
        const reproduced = !!rowLabel && !!andonLabel && rowLabel !== andonLabel
          && viaRow.hash === '#/phone/approvals' && viaAndon.hash === viaRow.hash && viaRow.h1 === 'Approvals'
          && leadWords.length >= 2 && leadWords.includes('Cancel') && leadWords.includes('Close') && leadWords.includes('Back');
        rec('A-screens-dailyclose-2-3', 'One destination carries two labels — "Open phone card" (Daily Close) and "Open approvals" (Andon), both landing on #/phone/approvals with h1 "Approvals" — and the dismiss control is Cancel / Close / Back to Board', 'B4 (CHECKLIST): one canonical word per concept across screens; variants listed, not chosen', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-157 (B7, claimed P3): one card mixes the two date formatters. The Decision d-1 card (dailyclose.js:176) reads
    // "Review was due 9/1 (2 days ago)" via shortDate and "Decided 8/4/2026 by Dr. Reagan" via longDate; the Practice risk
    // "Due now" list mixes "(review was 9/1)" and "due 9/5" with "(9/24/2026)".
    // Negative control: the two formats are counted inside a single card (and a single list), not across screens, so a
    // deliberate per-context format is not scored as drift. If the card used one formatter throughout, one of the two
    // token lists would be empty and the check reports false. The short pattern refuses to match the head of a long date.
    async 'A-screens-dailyclose-2-4'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        const cardText = flat(await p.evaluate(() => { const e = document.querySelector('[aria-label="Decision d-1"]'); return e ? e.textContent : null; }));
        const chipText = flat(await p.evaluate(() => { const e = document.querySelector('[aria-label="Decision d-1"] .chip'); return e ? e.textContent : null; }));
        const decidedLine = flat(await p.evaluate(() => { const e = [...document.querySelectorAll('[aria-label="Decision d-1"] .row span')].find((x) => /^Decided/.test(x.textContent || '')); return e ? e.textContent : null; }));
        await blank(p); await go(p, '#/compliance/risk');
        const rows = await riskRows(p);
        const listText = rows.join(' ');
        const store = (await state(p)).decisions.find((d) => d.id === 'd-1');
        const take = (s, re) => [...new Set((s || '').match(re) || [])];
        const cardLong = take(cardText, LONG_DATE), cardShort = take(cardText, SHORT_DATE);
        const listLong = take(listText, LONG_DATE), listShort = take(listText, SHORT_DATE);
        const evidence = {
          startHash: '#/owner/close (owner, desk 1280x900, light) then #/compliance/risk',
          steps: ['read the Decision d-1 card', 'blank + #/compliance/risk', 'read the Due now rows'],
          decisionCardText: cardText, decisionChip: chipText, decisionDecidedLine: decidedLine,
          decisionCardLongDates: cardLong, decisionCardShortDates: cardShort,
          riskRows: rows, riskListLongDates: listLong, riskListShortDates: listShort,
          storeValues: store ? { reviewBy: store.reviewBy, decidedAt: store.decidedAt } : null, pageErrors: errs,
        };
        const reproduced = cardLong.length > 0 && cardShort.length > 0 && cardLong.includes('8/4/2026') && cardShort.includes('9/1')
          && listLong.length > 0 && listShort.length > 0;
        rec('A-screens-dailyclose-2-4', 'The Decision d-1 card carries both date formats at once ("Review was due 9/1" and "Decided 8/4/2026"), and the Practice risk Due now list mixes "9/1" and "due 9/5" with "(9/24/2026)"', 'B7 (CHECKLIST): one date format per context', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-158 (A8, claimed P3): the four helpers dailyclose.js exports (grade:36, overall:42, changedPairs:48, lateRows:54)
    // dereference their argument with no guard, so each throws a TypeError on null.
    // Negative control: A8 asks for correct values on ordinary, boundary AND null inputs, so the same run calls each helper
    // on real state and on boundary inputs first; those must return the right answers (grade tied/variance, overall
    // "1 variance", one changed pair, late rows, the 48-hour statement-lag edge, empty tables). If a helper returned a
    // fallback for null instead of throwing, its entry would read ok:true and the check reports false.
    async 'A-screens-dailyclose-2-5'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        const m = await p.evaluate(() => {
          const D = Proto.screens.dailyclose; const S = window.__proto.state();
          const call = (name, arg) => { try { return { ok: true, value: D[name](arg) }; } catch (e) { return { ok: false, error: (e && e.constructor ? e.constructor.name : 'Error') + ': ' + (e && e.message) }; } };
          const rr1 = S.reconciliation.find((x) => x.id === 'rr-loc-1'), rr3 = S.reconciliation.find((x) => x.id === 'rr-loc-3');
          const wrap = (r) => r.ok ? { ok: true, value: JSON.stringify(r.value).slice(0, 160) } : r;
          return {
            exported: Object.keys(D),
            nullInputs: {
              grade: call('grade', null), overall: call('overall', null), changedPairs: call('changedPairs', null), lateRows: call('lateRows', null),
            },
            undefinedInputs: { grade: call('grade', undefined), overall: call('overall', undefined) },
            ordinary: {
              gradeTied: wrap(call('grade', rr1)), gradeVariance: wrap(call('grade', rr3)),
              overall: wrap(call('overall', S)),
              changedPairsLength: (() => { const r = call('changedPairs', S); return r.ok ? r.value.length : r; })(),
              lateRowsLength: (() => { const r = call('lateRows', S); return r.ok ? r.value.length : r; })(),
            },
            boundary: {
              statementLag48h: wrap(call('grade', { state: 'ok', independent: true, closerPosted: false, source: 'statement', lagDays: 2 })),
              statementLag72h: wrap(call('grade', { state: 'ok', independent: true, closerPosted: false, source: 'statement', lagDays: 3 })),
              overallEmptyTables: wrap(call('overall', { reconciliation: [], variances: [] })),
              lateRowsEmptyLedger: wrap(call('lateRows', { ledger: [] })),
              changedPairsEmptyLedger: wrap(call('changedPairs', { ledger: [], tenant: { today: '2026-09-03' } })),
            },
          };
        });
        const nulls = m.nullInputs;
        const allThrow = ['grade', 'overall', 'changedPairs', 'lateRows'].every((k) => nulls[k].ok === false && /^TypeError/.test(nulls[k].error));
        const ordinaryRight = m.ordinary.gradeTied.value === '"tied"' && m.ordinary.gradeVariance.value === '"variance"'
          && /"grade":"variance"/.test(m.ordinary.overall.value) && m.ordinary.changedPairsLength >= 1 && m.ordinary.lateRowsLength >= 1;
        const boundaryRight = m.boundary.statementLag48h.value === '"tied"' && m.boundary.statementLag72h.value === '"second"'
          && /"grade":"tied"/.test(m.boundary.overallEmptyTables.value) && m.boundary.lateRowsEmptyLedger.value === '[]' && m.boundary.changedPairsEmptyLedger.value === '[]';
        const evidence = {
          startHash: '#/owner/close (owner, desk 1280x900, light)',
          steps: ['page.evaluate Proto.screens.dailyclose.grade(null) / .overall(null) / .changedPairs(null) / .lateRows(null)'],
          exportedHelpers: m.exported, nullInputs: nulls, undefinedInputs: m.undefinedInputs,
          ordinaryInputs: m.ordinary, boundaryInputs: m.boundary,
          allFourThrowOnNull: allThrow, ordinaryInputsCorrect: ordinaryRight, boundaryInputsCorrect: boundaryRight,
          pageErrors: errs,
        };
        rec('A-screens-dailyclose-2-5', 'grade, overall, changedPairs and lateRows each throw a TypeError on null while returning correct values on ordinary and boundary inputs', 'A8 (CHECKLIST): pure helpers return correct values on ordinary, boundary and null inputs', allThrow && ordinaryRight && boundaryRight, evidence);
      } finally { await c.close(); }
    },

    // RC-159 (A7, claimed P3): the Match announcement (dailyclose.js:133) hardcodes the basis and the location
    // ("... card settlement timing. Hillsboro now ties.") and the Keep result (dailyclose.js:172) hardcodes the review date
    // ("Kept 90 more days; review on 12/2."). Both are true only for the single seeded variance and today's seed date.
    // Negative control, measured in the same run: the money in the same announcement IS derived, so the row's amount is
    // changed too. If the location and basis were derived like the amount, the sentence would read "cash ... Northgate
    // Plaza" and the check reports false; the amount moving proves the announcement is re-rendered, not stale. For Keep,
    // today is moved to 2026-10-01, where 90 days is 12/30: a computed date would move and the check reports false.
    async 'A-screens-dailyclose-2-6'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);          // leg 1: Match
      const { c: c2, p: p2, errs: errs2 } = await ctx(b, 1280, 900);  // leg 2: Keep, on its own document and store
      try {
        await go(p, '#/owner/close');
        const mutated = await p.evaluate(() => {
          const S = Proto.store.get(); const v = S.variances.find((x) => x.id === 'v-1');
          S.locations.find((l) => l.id === 'loc-3').name = 'Northgate Plaza';   // the row's location, renamed
          v.tender = 'cash'; v.amountCents = 55555;                              // the row's basis and money
          return { locationName: S.locations.find((l) => l.id === 'loc-3').name, tender: v.tender, amountCents: v.amountCents };
        });
        await click(p, 'close.tied.tile'); await p.waitForTimeout(120);
        if (!(await p.$('[data-testid="close.variance.v-1.match"]'))) { await click(p, 'close.location.loc-3'); await p.waitForTimeout(120); }
        const cardText = flat(await p.evaluate(() => { const e = document.querySelector('[aria-label="Variance v-1"]'); return e ? e.textContent : null; }));
        // The card's own "tender · location · date" line, read as its own node: sibling spans concatenate in textContent
        // ("$555.55cash"), which would hide the tender behind a missing word boundary.
        const cardMeta = flat(await p.evaluate(() => { const e = document.querySelector('[aria-label="Variance v-1"] .row span.small'); return e ? e.textContent : null; }));
        await click(p, 'close.variance.v-1.match'); await p.waitForTimeout(250);
        const matchSay = flat(await live(p));
        const rm = (await state(p)).reconciliationMatches;

        await go(p2, '#/owner/close');
        const shifted = await p2.evaluate(() => { const S = Proto.store.get(); const was = S.tenant.today; S.tenant.today = '2026-10-01'; return { was, now: S.tenant.today }; });
        await click(p2, 'close.decision.d-1.keep'); await p2.waitForTimeout(250);
        const keepSay = flat(await live(p2));
        const keepLine = flat(await p2.evaluate(() => { const e = [...document.querySelectorAll('section[aria-label^="Decisions due"] p.row')].find((x) => /Reviewed today/.test(x.textContent || '')); return e ? e.textContent : null; }));
        const S2 = await state(p2);
        const d1 = S2.decisions.find((d) => d.id === 'd-1');
        const cd = S2.controlDecisions.filter((x) => x.supersedes === 'd-1');

        const evidence = {
          startHash: '#/owner/close (owner, desk 1280x900, light)',
          steps: ['rename loc-3 / retender + reprice v-1 in the store', 'close.tied.tile', 'close.variance.v-1.match', 'read #live', 'fresh document: move tenant.today to 2026-10-01', 'close.decision.d-1.keep', 'read the result line'],
          mutatedRow: mutated, varianceCardAfterMutation: cardText, varianceCardMetaLine: cardMeta, matchAnnouncement: matchSay,
          announcementAmountFollowedTheRow: /\$555\.55/.test(matchSay),
          announcementStillSaysHillsboro: /Hillsboro/.test(matchSay),
          announcementStillSaysCardSettlementTiming: /card settlement timing/.test(matchSay),
          cardSaysNewLocation: /Northgate Plaza/.test(cardMeta || ''), cardSaysNewTender: /^cash\b/.test(cardMeta || ''),
          reconciliationMatchesWritten: rm,
          todayShift: shifted, keepAnnouncement: keepSay, keepResultLine: keepLine,
          reviewDateInText: (keepSay.match(/review on (\d{1,2}\/\d{1,2})/) || [])[1] || null,
          ninetyDaysAfterShiftedToday: '12/30',
          decisionRowAfterKeep: d1 ? { status: d1.status, reviewBy: d1.reviewBy } : null,
          controlDecisionsWritten: cd, pageErrors: errs.concat(errs2),
        };
        const matchLiteral = /\$555\.55/.test(matchSay) && /Hillsboro/.test(matchSay) && /card settlement timing/.test(matchSay)
          && /Northgate Plaza/.test(cardMeta || '') && /^cash\b/.test(cardMeta || '');
        const keepLiteral = /review on 12\/2\b/.test(keepSay) && /review on 12\/2\b/.test(keepLine || '')
          && !!d1 && d1.status === 'keep' && d1.reviewBy === '2026-09-01' && cd.length === 1 && cd[0].at === '2026-10-01';
        rec('A-screens-dailyclose-2-6', 'After the row is renamed, re-tendered and repriced, the Match announcement still says "card settlement timing. Hillsboro now ties." while its amount follows the row, and Keep still promises "review on 12/2" with today moved to 10/1 and nothing in the store holding that date', 'A7 (CHECKLIST): text and numbers on screen are computed from state, never literals', matchLiteral && keepLiteral, evidence);
      } finally { await c.close(); await c2.close(); }
    },

    // RC-160 (A7, claimed P3): the three standing Practice risk rows (dailyclose.js:276-278) are string literals — "expires
    // in 21 days (9/24/2026)", "Training due: 3 staff", "due 9/5", and after Start "failed logins 2, exports 1,
    // break-glass 0" — with no store table behind them.
    // Negative control, measured in the same run: the fourth row of the same list IS derived from S.decisions, so d-1's
    // reviewBy is moved and today is moved 17 days forward. That row must change (proving the list really re-rendered)
    // while the three literal rows stay byte-identical; if they moved too, or if the store held the values the rows print,
    // the check reports false. The re-render is triggered by a real control (risk.row.audit.refresh), not by script.
    async 'A-screens-dailyclose-2-7'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/compliance/risk');
        const before = await riskRows(p);
        await click(p, 'risk.row.logreview.start'); await p.waitForTimeout(200);
        const afterStart = await riskRows(p);
        const startSay = flat(await live(p));
        const seq0 = (await events(p)).filter((e) => e.kind === 'write').length;
        const moved = await p.evaluate(() => {
          const S = Proto.store.get();
          const was = { today: S.tenant.today, reviewBy: S.decisions[0].reviewBy };
          S.tenant.today = '2026-09-20'; S.decisions[0].reviewBy = '2026-08-15';
          return { was, now: { today: S.tenant.today, reviewBy: S.decisions[0].reviewBy } };
        });
        await click(p, 'risk.row.audit.refresh'); await p.waitForTimeout(200);   // re-render through a control on the screen
        const afterMove = await riskRows(p);
        const backing = await p.evaluate(() => {
          const s = JSON.stringify(window.__proto.state());
          return { has_2026_09_24: s.includes('2026-09-24'), has_expires_field: /"expires"/.test(s), has_baa_table: /"baas?"/i.test(s), has_training_table: /"training"/i.test(s), has_break_glass: s.includes('break-glass'), has_log_review: /log review/i.test(s), stateTables: Object.keys(window.__proto.state()).length };
        });
        const pick = (rows, re) => rows.find((r) => re.test(r)) || null;
        const literalRows = [/BAA: Ridge Dental Lab/, /Training due/, /Monthly log review/];
        const derivedRow = { before: pick(afterStart, /past review date/), after: pick(afterMove, /past review date/) };
        const literalBefore = literalRows.map((re) => pick(afterStart, re));
        const literalAfter = literalRows.map((re) => pick(afterMove, re));
        const evidence = {
          startHash: '#/compliance/risk (compliance, desk 1280x900, light)',
          steps: ['read Due now rows', 'risk.row.logreview.start', 'move tenant.today to 2026-09-20 and d-1.reviewBy to 2026-08-15', 'risk.row.audit.refresh', 're-read Due now rows'],
          rowsBefore: before, rowsAfterStart: afterStart, startAnnouncement: startSay,
          writeEventsAfterStart: seq0, stateMoved: moved,
          rowsAfterStateMoved: afterMove,
          literalRowsBefore: literalBefore, literalRowsAfter: literalAfter,
          literalRowsUnchanged: JSON.stringify(literalBefore) === JSON.stringify(literalAfter),
          derivedControlRow: derivedRow, derivedRowMoved: !!derivedRow.before && derivedRow.before !== derivedRow.after,
          storeBackingSearch: backing, pageErrors: errs,
        };
        const reproduced = evidence.literalRowsUnchanged && evidence.derivedRowMoved
          && literalBefore.every(Boolean)
          && /expires in 21 days \(9\/24\/2026\)/.test(literalBefore[0] || '') && /3 staff/.test(literalBefore[1] || '') && /due 9\/5/.test(literalBefore[2] || '')
          && /failed logins 2, exports 1, break-glass 0/.test(literalAfter[2] || '')
          && backing.has_2026_09_24 === false && backing.has_break_glass === false && backing.has_training_table === false;
        rec('A-screens-dailyclose-2-7', 'The BAA, Training and Log review rows print "21 days (9/24/2026)", "3 staff" and "due 9/5" (and after Start "failed logins 2, exports 1, break-glass 0") unchanged after today moves 17 days, while the decision row beside them follows the store', 'A7 (CHECKLIST): a number on screen is computed from state; it is never a literal', reproduced, evidence);
      } finally { await c.close(); }
    },
  };
};
