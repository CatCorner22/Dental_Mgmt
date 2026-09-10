// Audit checks for prototype/js/screens/phone.js, chunk screens-phone-2
// (root causes RC-223, RC-184, RC-185, RC-186, RC-187, RC-188, RC-189, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
//
// Three measurement rules this module keeps, because getting them wrong produces a wrong verdict:
//  1. CSS consequences are read through getComputedStyle on the element. document.styleSheets[i].cssRules
//     throws a SecurityError over file:// and a catch-and-continue silently returns an empty rule list,
//     which reads as "no rule applies" for every question asked of it.
//  2. `go(p, hash)` on a page already at this file is a SAME-DOCUMENT navigation: the module-level card
//     state in phone.js (`st`) and the store both carry over. Every check below opens a fresh context per
//     leg unless the comment above it says the leg deliberately depends on the carry-over.
//  3. A collapsed <details> still lays out with a non-zero box in this Chromium, so "is this text on
//     screen" walkers skip the body of a closed <details> explicitly (only its <summary> is on screen).

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec, FILE }) => {

// The readiness row ids carry seed id segments (`board.readiness.row.<seedId>.<control>`), and a fix round
// can legitimately change which seed id a row names. A probe that hard-codes one stops pressing anything the
// day that happens — silently, because click() returns false rather than throwing — so each row is found by
// its control suffix instead. Trap 2: a rename disarms a check without crashing it.
const readinessRow = (p, control) => p.evaluate((c) => {
  const e = document.querySelector('[data-testid^="board.readiness.row."][data-testid$=".' + c + '"]');
  return e ? e.getAttribute('data-testid') : null;
}, control);
  const CONTRACTS_URL = FILE.replace(/index\.html$/, 'CONTRACTS.md');

  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id, persona: e.persona }));
  const errorEvents = (ev) => ev.filter((e) => e.kind === 'error').map((e) => ({ seq: e.seq, message: e.message }));
  const fill = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.waitForTimeout(60); return true; };
  const whoAmI = (p) => p.evaluate(() => ({ persona: window.__proto.persona, user: Proto.store.currentUser().name, userId: Proto.store.currentUser().id }));
  const approvalRow = (p, id) => p.evaluate((id) => { const a = window.__proto.state().approvals.find((x) => x.id === id); return a ? { id: a.id, status: a.status, amountCents: a.amountCents, requestedBy: a.requestedBy, requestedById: a.requestedById, decidedBy: a.decidedBy, decidedAt: a.decidedAt, frozenSentence: a.frozenSentence } : null; }, id);
  const label = (p, tid) => p.evaluate((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); return e ? { label: e.textContent.trim(), aria: e.getAttribute('aria-label'), tag: e.tagName } : null; }, tid);
  // Visible leaf text under a root. Rule 3: the body of a closed <details> is not on screen even though the
  // <details> box measures non-zero. Rule 1: visibility comes from getComputedStyle, never from a stylesheet scan.
  const leaves = (p, sel) => p.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    return [...root.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim()).map((e) => {
      const cs = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      const closed = e.closest('details:not([open])');
      const inClosedBody = !!closed && !e.closest('summary');
      return {
        text: e.textContent.trim(), tag: e.tagName, className: e.className,
        display: cs.display, visibility: cs.visibility, w: Math.round(b.width), h: Math.round(b.height),
        inClosedDetailsBody: inClosedBody,
        visible: !inClosedBody && cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1 && b.height > 1,
      };
    });
  }, sel);
  const sentences = (list) => list.flatMap((s) => String(s).split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter(Boolean);
  const uniq = (a) => [...new Set(a.filter((x) => x != null && x !== ''))];
  // Chip word with its shape glyph stripped: chips render "<glyph><word>" (ui.js chip()).
  const chipWords = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => ({ raw: e.textContent.trim(), word: e.textContent.replace(/[■▲◆★▬●✓]/g, '').trim(), severity: (e.className.match(/chip\s+(\w+)/) || [])[1] || null })), sel);
  const simulate = async (p) => { const ok = await click(p, 'phone.simulate'); await p.waitForTimeout(150); return ok; };
  // The step-up verifies the approver's OWN PIN (store.js verifyPin(pin, approver.id)); with no digits given, the current user's PIN is read at run time.
  const pin = async (p, digits) => { const ds = digits || [...await p.evaluate(() => String((Proto.store.currentUser() || {}).pin || ''))]; for (const d of ds) await click(p, 'phone.stepup.' + d); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(250); };

  return {
    // RC-223 · B4 · phone.js:80/84/168 name the PIN challenge "Re-verify" ("Re-verify: enter your PIN", dialog
    // aria-label "Re-verify PIN", Approve aria "you will re-verify with your PIN") while board.js:167/94 use the
    // same word for the eligibility re-check ("Re-verify", "Re-verify all") and the amber eligibility STATE is
    // called "Verify" on the Board (board.js:14) but "Re-verify" on the Rail (rail.js:12).
    // Negative control: under B4 the same amber eligibility state would carry one word on both surfaces
    // (board chip word === rail chip word, so eligStateWords has one member) and the PIN challenge would use a
    // different word from the eligibility action (phoneUsesReverify false); either alone makes the check report
    // false. Board and Rail are read from the same context on purpose — the Rail is opened from the a-1042 card,
    // so both chips describe one appointment's eligibility — and they are read BEFORE the Re-verify press, which
    // turns eligibility green and would erase the state being compared. The phone leg gets its own fresh context.
    async 'A-screens-phone-2-1'(b) {
      const board = {};
      { const { c, p } = await ctx(b, 1280, 900);
        try {
          await go(p, '#/frontdesk/board');
          board.viewer = await whoAmI(p);
          board.appointment = await p.evaluate(() => { const a = window.__proto.state().appointments.find((x) => x.id === 'a-1042'); return a ? { id: a.id, eligibility: a.eligibility, status: a.status, patientId: a.patientId } : null; });
          board.cardChips = await chipWords(p, '[data-testid="board.card.a-1042"] .chip');
          board.reverifyButton = await label(p, 'board.card.a-1042.reverify');
          board.readinessControl = await label(p, await readinessRow(p, 'reverify-all'));
          // Rail, same patient, same appointment. The Coverage summary is a closed <details> on open: its box
          // measures non-zero either way (rule 3), so it is opened explicitly and `open` is asserted.
          await click(p, 'board.card.a-1042.rail'); await p.waitForTimeout(150);
          board.railBefore = await p.evaluate(() => { const d = [...document.querySelectorAll('#rail details.rail-sum')].find((x) => (x.querySelector('summary') || {}).getAttribute && x.querySelector('summary').getAttribute('data-testid') === 'rail.sum.coverage'); if (!d) return null; const r = d.getBoundingClientRect(); return { open: d.open, boxW: Math.round(r.width), boxH: Math.round(r.height) }; });
          await click(p, 'rail.sum.coverage'); await p.waitForTimeout(150);
          board.railCoverage = await p.evaluate(() => {
            const d = [...document.querySelectorAll('#rail details.rail-sum')].find((x) => (x.querySelector('summary') || {}).getAttribute && x.querySelector('summary').getAttribute('data-testid') === 'rail.sum.coverage');
            if (!d) return null;
            const chip = d.querySelector('.chip');
            const cs = chip ? getComputedStyle(chip) : null;
            return { open: d.open, text: d.textContent.replace(/\s+/g, ' ').trim(), chipRaw: chip ? chip.textContent.trim() : null, chipWord: chip ? chip.textContent.replace(/[■▲◆★▬●✓]/g, '').trim() : null, chipDisplay: cs ? cs.display : null, chipVisibility: cs ? cs.visibility : null };
          });
          const seq0 = await lastSeq(p);
          await click(p, 'board.card.a-1042.reverify'); await p.waitForTimeout(200);
          board.announcementAfterReverify = await p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
          board.seqRange = range(await after(p, seq0), seq0);
          // The same two chips after the state moves to green: the Board chip word tracks the state
          // (Verify → Eligible), so the word being measured is not a constant. The already-open Rail panel is
          // not re-rendered by the Board's mutation and keeps its previous word; that is recorded as measured
          // and not read as agreement. (Read fresh, the green Rail chip is "Active" — a second word pair for
          // the same state, but the check scores only the amber pair the finding names.)
          board.afterReverify = await p.evaluate(() => {
            const a = window.__proto.state().appointments.find((x) => x.id === 'a-1042');
            const bc = [...document.querySelectorAll('[data-testid="board.card.a-1042"] .chip')].map((e) => ({ severity: (e.className.match(/chip\s+(\w+)/) || [])[1], word: e.textContent.replace(/[■▲◆★▬●✓]/g, '').trim() }));
            const d = [...document.querySelectorAll('#rail details.rail-sum')].find((x) => (x.querySelector('summary') || {}).getAttribute && x.querySelector('summary').getAttribute('data-testid') === 'rail.sum.coverage');
            const chip = d ? d.querySelector('.chip') : null;
            return { eligibility: a ? a.eligibility : null, boardChips: bc, railChipWord: chip ? chip.textContent.replace(/[■▲◆★▬●✓]/g, '').trim() : null, reverifyButtonStillRendered: !!document.querySelector('[data-testid="board.card.a-1042.reverify"]') };
          });
        } finally { await c.close(); } }
      const phone = {};
      { const { c, p } = await ctx(b, 420, 860);   // fresh context: no board state, no phone card state
        try {
          await go(p, '#/owner/phone/approvals?device=phone');
          phone.viewer = await whoAmI(p);
          await simulate(p);
          phone.approveAria = (await label(p, 'phone.request.ar-1.approve')) || {};
          await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);
          phone.dialog = await p.evaluate(() => { const d = document.querySelector('#dialogs .dialog'); return d ? { ariaLabel: d.getAttribute('aria-label'), h2: ((d.querySelector('h2') || {}).textContent || '').trim() } : null; });
        } finally { await c.close(); } }
      const boardChipWord = (board.cardChips || []).filter((x) => x.severity === 'review').map((x) => x.word).find((w) => /verify/i.test(w)) || null;
      const railChipWord = board.railCoverage ? board.railCoverage.chipWord : null;
      const eligStateWords = uniq([boardChipWord, railChipWord]);
      const eligActionWords = uniq([board.reverifyButton && board.reverifyButton.label, board.readinessControl && board.readinessControl.label]);
      const phoneUsesReverify = !!phone.dialog && /^re-verify\b/i.test(phone.dialog.h2 || '') && /re-verify/i.test(phone.dialog.ariaLabel || '');
      const eligUsesReverify = /^re-verify\b/i.test((board.reverifyButton || {}).label || '');
      const railOpened = !!board.railCoverage && board.railCoverage.open === true;
      const sameAmberState = !!board.appointment && board.appointment.eligibility === 'amber';
      const stateWordDrift = eligStateWords.length > 1;
      const reproduced = sameAmberState && railOpened && eligUsesReverify && phoneUsesReverify && stateWordDrift;
      rec('A-screens-phone-2-1', '"Re-verify" names two concepts: the eligibility re-check (Board button "Re-verify", readiness "Re-verify all") and the phone PIN challenge (dialog h2 "Re-verify: enter your PIN", aria-label "Re-verify PIN"); and the one amber eligibility state is called "Verify" on the Board card but "Re-verify" on the Patient Rail', 'B4 — one canonical word per concept across all screens, refusals, announcements and aria-labels (and its converse: one word for one concept); phone.js:80, :84, :168; board.js:14, :94, :167; rail.js:12',
        reproduced, { boardAppointment: board.appointment, boardViewer: board.viewer, boardCardChips: board.cardChips, boardChipWordForAmber: boardChipWord, boardReverifyButton: board.reverifyButton, boardReadinessControl: board.readinessControl, railCoverageDetailsBeforeOpen: board.railBefore, railCoverage: board.railCoverage, railChipWordForAmber: railChipWord, railOpened, announcementAfterReverify: board.announcementAfterReverify, chipsAfterReverifyGreen: board.afterReverify, boardSeqRange: board.seqRange, phoneViewer: phone.viewer, phoneApproveAria: phone.approveAria.aria, phoneStepupDialog: phone.dialog, eligibilityStateWords: eligStateWords, eligibilityActionWords: eligActionWords, phoneUsesReverify, eligUsesReverify, stateWordDrift });
    },

    // RC-184 · B4 · phone.js:169 labels one control "Decline" when closed and "Send back" when open, phone.js:111/177/181
    // report the result as "Sent back"/"sent back by", and moneydesk.js:234 prints the raw status "declined by" beside a
    // chip that says "Sent back"; the place itself is named four ways (phone.js:190 h1 "Approvals", shell.js:53
    // "Open approvals", dailyclose.js:188 "Open phone card", seed.js:241 "Approvals (phone card)").
    // Negative control: under B4 the control keeps one word, the result chip repeats it, the Money Desk prints that same
    // word rather than the raw status, and the place has one name — then decisionWords and placeWords each collapse to one
    // member and the check reports false. The result words are scored only after the send-back LANDED (approvals.ar-1
    // status 'declined' plus an approvalsLog write inside the seq range); an open-but-unsent decline is a different case.
    // The Money Desk leg deliberately reuses the same context: it must read the row written by this decision.
    async 'A-screens-phone-2-2'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/phone/approvals');
        const viewer = await whoAmI(p);
        const h1 = await p.evaluate(() => ((document.querySelector('#canvas h1') || {}).textContent || '').trim());
        await simulate(p);
        const andon = await label(p, 'andon.control');
        // The Daily Close names the same place while the request is still pending; read it before deciding.
        await hop(p, '#/owner/close'); await p.waitForTimeout(200);
        const closeControl = await p.evaluate(() => {
          const e = document.querySelector('[data-testid^="close.approval."]');
          const sec = [...document.querySelectorAll('#canvas section')].find((s) => /Approvals only I can give/.test(s.getAttribute('aria-label') || ''));
          return e
            ? { testid: e.getAttribute('data-testid'), label: e.textContent.trim(), sectionLabel: sec ? sec.getAttribute('aria-label') : null }
            : { testid: null, label: null, note: 'no pending approval row here', sectionLabel: sec ? sec.getAttribute('aria-label') : null, sectionText: sec ? sec.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null };
        });
        await hop(p, '#/phone/approvals'); await p.waitForTimeout(200);
        const closed = await label(p, 'phone.request.ar-1.decline');
        const approveLabel = await label(p, 'phone.request.ar-1.approve');
        await click(p, 'phone.request.ar-1.decline'); await p.waitForTimeout(120);
        const open = await label(p, 'phone.request.ar-1.decline');
        const fieldLabel = await p.evaluate(() => ((document.querySelector('label[for="ph-reason-ar-1"]') || {}).textContent || '').trim());
        const seq0 = await lastSeq(p);
        await fill(p, 'phone.request.ar-1.reason', 'appeal first');
        await click(p, 'phone.request.ar-1.decline'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const row = await approvalRow(p, 'ar-1');
        const landed = !!row && row.status === 'declined' && ev.some((e) => e.kind === 'write' && e.table === 'approvalsLog');
        const phoneResult = await p.evaluate(() => {
          const d = document.querySelector('.ph-decided');
          if (!d) return null;
          const ps = [...d.querySelectorAll('p.small.muted')];
          return { chip: d.querySelector('.chip') ? d.querySelector('.chip').textContent.replace(/[■▲◆★▬●✓]/g, '').trim() : null, done: ((d.querySelector('.ph-done') || {}).textContent || '').trim(), line: ps.length ? ps[ps.length - 1].textContent.trim() : null };
        });
        const announced = await p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
        // The biller's Money Desk reads the row this decision wrote.
        await hop(p, '#/biller/money'); await p.waitForTimeout(200);
        await click(p, 'money.tab.approvals'); await p.waitForTimeout(150);
        const moneyRow = await p.evaluate(() => { const r = document.querySelector('#canvas .wrow'); return r ? { text: r.textContent.replace(/\s+/g, ' ').trim(), chip: (r.querySelector('.chip') || {}).textContent ? r.querySelector('.chip').textContent.replace(/[■▲◆★▬●✓]/g, '').trim() : null, why: ((r.querySelector('.why') || {}).textContent || '').trim() } : null; });
        // The palette's own name for the same place.
        await click(p, 'topbar.search'); await p.keyboard.type('approv'); await p.waitForTimeout(250);
        const paletteRows = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="palette.row."]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
        const paletteName = (paletteRows.find((t) => /Approvals/.test(t)) || '').replace(/^[■▲◆★▬●✓]*Action/, '').replace(/Screen$/, '').trim() || null;
        const decisionWords = uniq([closed && closed.label, open && open.label, phoneResult && phoneResult.chip, /sent back by/i.test((phoneResult || {}).line || '') ? 'sent back by' : null, /declined by/i.test((moneyRow || {}).why || '') ? 'declined by' : null]);
        const placeWords = uniq([h1, andon && andon.label, closeControl && closeControl.label, paletteName]);
        const moneyRowShowsBothWords = !!moneyRow && moneyRow.chip === 'Sent back' && /declined by/i.test(moneyRow.why || '');
        const reproduced = landed && decisionWords.length > 2 && moneyRowShowsBothWords && placeWords.length > 2;
        rec('A-screens-phone-2-2', 'One send-back decision carries four words — control "Decline" (closed) → "Send back" (open) → chip "Sent back" / "sent back by" on the phone → "declined by" on the Money Desk row whose own chip says "Sent back" — and the place carries four names: h1 "Approvals", Andon "Open approvals", Daily Close "Open phone card", palette "Approvals (phone card)"', 'B4 — one canonical word per concept across screens, refusals, announcements and aria-labels; phone.js:169, :111, :177, :181, :190; moneydesk.js:234; shell.js:53; dailyclose.js:188; seed.js:241',
          reproduced, { viewer, phoneH1: h1, andonControl: andon, declineClosed: closed, declineOpen: open, approveControl: approveLabel, reasonFieldLabel: fieldLabel, approvalAfter: row, declineLanded: landed, phoneDecidedCard: phoneResult, announced, dailyCloseControl: closeControl, moneyDeskApprovalsRow: moneyRow, moneyRowShowsBothWords, paletteRows, paletteName, decisionWords, placeWords, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-185 · B7 · phone.js:151 prints the frozen sentence, which carries the 24-hour clock ("… at 08:40",
    // store.js:151 builds it from S.clock.time), while phone.js:149 prints the same instant through to12h()
    // ("Requested at 8:40 am"); phone.js:181 puts both in one paragraph on the decided card.
    // Negative control: under B7 one context uses one format, so every time token on the card matches one shape
    // (either all 24-hour or all 12-hour) — twelveHour and twentyFourHour are not both non-empty for the same card
    // and the check reports false. The decided-card half is scored only after the approval LANDED (status
    // 'approved' plus an approvalsLog write in the seq range), so an unsent decision cannot fake the mixture.
    async 'A-screens-phone-2-3'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals?device=phone');
        const viewer = await whoAmI(p);
        await simulate(p);
        const clock = await p.evaluate(() => window.__proto.state().clock);
        const request = await approvalRow(p, 'ar-1');
        const pending = await p.evaluate(() => {
          const card = document.querySelector('.ph-card');
          if (!card) return null;
          // The key and value are separate spans with no whitespace between them, so read them apart:
          // joining them ("Requested at8:40 am") destroys the word boundary a time token needs.
          const kv = [...card.querySelectorAll('.ph-kv')].find((e) => /Requested at/.test(e.textContent));
          return {
            sentence: ((card.querySelector('.ph-sentence') || {}).textContent || '').trim(),
            requestedAtKey: kv ? ((kv.querySelector('.ph-k') || {}).textContent || '').trim() : null,
            requestedAtValue: kv ? ((kv.querySelector('.ph-v') || {}).textContent || '').trim() : null,
            cardText: card.textContent.replace(/\s+/g, ' ').trim(),
          };
        });
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(150);
        await pin(p);
        const ev = await after(p, seq0);
        const decidedRow = await approvalRow(p, 'ar-1');
        const landed = !!decidedRow && decidedRow.status === 'approved' && ev.some((e) => e.kind === 'write' && e.table === 'approvalsLog');
        const decided = await p.evaluate(() => { const d = document.querySelector('.ph-decided'); if (!d) return null; const ps = [...d.querySelectorAll('p.small.muted')]; return { line: ps.length ? ps[ps.length - 1].textContent.trim() : null, text: d.textContent.replace(/\s+/g, ' ').trim() }; });
        // Every clock token, classified by shape: a token that ends in am/pm is 12-hour, otherwise 24-hour.
        // (\b would fail here — the rendered strings run text straight into the digits, e.g. "at 08:40Approve".)
        const scan = (s) => {
          const found = String(s || '').match(/(?<![\d:])\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?/gi) || [];
          return { twentyFourHour: uniq(found.filter((t) => !/m\.?$/i.test(t))), twelveHour: uniq(found.filter((t) => /m\.?$/i.test(t))) };
        };
        const sentenceTokens = scan(pending && pending.sentence);
        const requestedAtTokens = scan(pending && pending.requestedAtValue);
        const decidedLineTokens = scan(decided && decided.line);
        const pendingCard = scan(pending && pending.cardText);
        const decidedCard = scan(decided && decided.text);
        const mixedOnPendingCard = sentenceTokens.twentyFourHour.length > 0 && requestedAtTokens.twelveHour.length > 0;
        const mixedOnDecidedLine = landed && decidedLineTokens.twentyFourHour.length > 0 && decidedLineTokens.twelveHour.length > 0;
        const sameInstant = !!request && /\b08:40\b/.test(request.frozenSentence || '') && /8:40\s*am/.test((pending || {}).requestedAtValue || '') && (request.decidedAt == null || true);
        const reproduced = mixedOnPendingCard && sameInstant && mixedOnDecidedLine;
        rec('A-screens-phone-2-3', 'One approval card prints one instant in two formats: the frozen sentence reads "… requested by Sam Dawson at 08:40" while the row beside it reads "Requested at 8:40 am", and after the decision both sit in one paragraph ("… at 08:40 · approved by Dr. Blake Reagan at 8:40 am")', 'B7 — one date/time format per context; phone.js:151 (redactedSentence) and :149 (to12h), :181; store.js:151 builds the sentence from S.clock.time',
          reproduced, { viewer, storeClock: clock, approvalRow: request, pendingCard: pending, frozenSentenceTimeTokens: sentenceTokens, requestedAtRowTimeTokens: requestedAtTokens, pendingCardAllTimeTokens: pendingCard, decidedCard: decided, decidedLineTimeTokens: decidedLineTokens, decidedCardAllTimeTokens: decidedCard, approvalLanded: landed, approvalAfter: decidedRow, sameInstantTwoFormats: sameInstant, mixedOnPendingCard, mixedOnDecidedLine, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-186 · B6 · phone.js:205 hard-codes "$410" in the Simulate label while phone.js:121 prints the same amount
    // through money(SIM_CENTS) as "$410.00" in the status line directly under it.
    // Negative control: under B6 the label's amount is the money() rendering, so labelAmounts equals
    // [money(41000)] and the check reports false. Both renderings and the store value are carried: the store
    // holds 41000 cents (approvals.ar-1.amountCents), money(41000) is evaluated in the page, and the sim note is
    // read only after the simulated request LANDED (an approvals row exists), so a label with no counterpart
    // rendering cannot score.
    async 'A-screens-phone-2-4'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals?device=phone');
        const labelBefore = await label(p, 'phone.simulate');
        const moneyOf = await p.evaluate(() => ({ money41000: Proto.ui.money(41000), money0: Proto.ui.money(0), moneyNeg: Proto.ui.money(-4400) }));
        const seq0 = await lastSeq(p);
        await simulate(p);
        const ev = await after(p, seq0);
        const row = await approvalRow(p, 'ar-1');
        const simNote = await p.evaluate(() => ((document.querySelector('.ph-sim [role="status"]') || {}).textContent || '').trim());
        const cardAmount = await p.evaluate(() => ((document.querySelector('.ph-card .ph-amount') || {}).textContent || '').trim());
        const sentence = await p.evaluate(() => ((document.querySelector('.ph-sentence') || {}).textContent || '').trim());
        const AMT = /−?\$[\d,]+(?:\.\d{2})?/g;
        const labelAmounts = uniq(((labelBefore || {}).label || '').match(AMT) || []);
        const noteAmounts = uniq((simNote.match(AMT) || []));
        const requestLanded = !!row && row.amountCents === 41000;
        const labelSkipsMoney = labelAmounts.length > 0 && labelAmounts.every((a) => a !== moneyOf.money41000) && labelAmounts.includes('$410');
        const sameAmountElsewhere = noteAmounts.includes(moneyOf.money41000) && cardAmount === moneyOf.money41000;
        const reproduced = requestLanded && labelSkipsMoney && sameAmountElsewhere;
        rec('A-screens-phone-2-4', 'The Simulate button prints the amount as the literal "$410" while every other rendering of the same 41000 cents on that screen — the status line under the button, the card amount, the frozen sentence — prints money(41000) = "$410.00"', 'B6 — every amount passes through Proto.ui.money; the store holds cents; phone.js:205 (literal) against phone.js:121 (money(SIM_CENTS))',
          reproduced, { simulateLabel: labelBefore, labelAmounts, storeValueCents: row ? row.amountCents : null, moneyHelper: moneyOf, statusLineUnderButton: simNote, statusLineAmounts: noteAmounts, cardAmountRendering: cardAmount, frozenSentenceRendering: sentence, requestLanded, labelSkipsMoney, sameAmountElsewhere, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-187 · B1 · phone.js renders phone.request.<id>.name (:145), .reason (:161), .why (:170),
    // phone.stepup.backspace (:75), phone.stepup.cancel (:83) and phone.simulate (:205); CONTRACTS §4's Phone row
    // names only phone.request.<reqId>.approve/.decline, phone.stepup.<0-9> and phone.stepup.submit.
    // Negative control: if §4 named them, every rendered phone.* id would match a §4 entry or pattern and
    // `unmatched` would be empty, so the check reports false. §4 is read from the contract file through the browser
    // (Chromium serves it as text/markdown and renders it as text) and the check reports false unless that read
    // actually returned the §4 table with the Phone row — an empty or failed read cannot fake a positive; and the
    // ids compared are the ones measured live in the DOM, so an id that is not rendered cannot score either.
    async 'A-screens-phone-2-5'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals?device=phone');
        await simulate(p);
        await click(p, 'phone.request.ar-1.decline'); await p.waitForTimeout(120);   // renders .reason
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);   // opens the step-up dialog
        const rendered = uniq(await p.evaluate(() => [...document.querySelectorAll('[data-testid^="phone."]')].map((e) => e.getAttribute('data-testid'))));
        const dialogOpen = await p.evaluate(() => !!document.querySelector('#dialogs .dialog'));
        // Read CONTRACTS §4 through a second page in this context.
        const md = await c.newPage();
        let contracts = null;
        try { const resp = await md.goto(CONTRACTS_URL); contracts = await md.evaluate(() => document.body.textContent); if (!resp || resp.status() >= 400) contracts = null; } catch (e) { contracts = null; }
        await md.close();
        const section4 = contracts ? (contracts.split(/\n##\s+/).find((s) => /^4\.\s*`data-testid`/.test(s)) || null) : null;
        const phoneRow = section4 ? (section4.split('\n').find((l) => /^\|\s*Phone\s*\|/.test(l)) || null) : null;
        const entries = section4 ? uniq((section4.match(/`[^`]+`/g) || []).map((s) => s.slice(1, -1)).filter((s) => /^[a-z][a-z0-9]*(\.[^\s|]+)+$/.test(s))) : [];
        const toRe = (e) => new RegExp('^' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<0-9>/g, '[0-9]').replace(/<[^>]+>/g, '[^.]+') + '$');
        const matched = {}; const unmatched = [];
        for (const id of rendered) {
          const hit = entries.find((e) => toRe(e).test(id));
          if (hit) matched[id] = hit; else unmatched.push(id);
        }
        const contractsRead = !!section4 && !!phoneRow && entries.length > 20;
        const reproduced = contractsRead && rendered.length > 0 && unmatched.length > 0;
        rec('A-screens-phone-2-5', 'Six ids phone.js renders — phone.request.<id>.name, phone.request.<id>.reason, phone.request.<id>.why, phone.stepup.backspace, phone.stepup.cancel, phone.simulate — match no entry or pattern in the CONTRACTS §4 table, whose Phone row names only approve/decline, stepup.<0-9> and stepup.submit', 'B1 — every id in the DOM matches a §4 entry or pattern; phone.js:145, :161, :170, :75, :83, :205; CONTRACTS §4 Phone row',
          reproduced, { renderedPhoneIds: rendered, stepupDialogOpen: dialogOpen, unmatchedIds: unmatched, matchedIds: matched, contractsUrl: CONTRACTS_URL, contractsRead, section4TextSearched: section4 ? section4.slice(0, 2400) : null, section4PhoneRow: phoneRow, section4EntryCount: entries.length, section4PhoneEntries: entries.filter((e) => e.startsWith('phone.')) });
      } finally { await c.close(); }
    },

    // RC-188 · A6 · router.js:14 accepts any id under /phone (`id: parts[1] || 'approvals'`) and phone.js:184 render(r)
    // never reads r.id, so #/phone/xyz and #/owner/phone/nope draw the ordinary Approvals screen.
    // Negative control: a route that honours an unknown id says so — #/frontdesk/checkout/a-9999, #/dentist/encounter/enc-nope
    // and #/frontdesk/ledger/p-999 are driven in the same run as the contrast, and #/frontdesk/bogusroute shows the shell's
    // own notfound handler ("Nothing here"); if phone behaved like them, phoneSignalsNotFound would be true and the check
    // reports false. Fresh context, and the hash legs are same-document navigations on purpose: the point is what the
    // router and the screen do with an id, not what a reload does. The cited rule's literal wording is checked too:
    // notFoundRouteReached records whether ANY of these lands on the `notfound` route.
    async 'A-screens-phone-2-6'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        const read = async (hash) => {
          await go(p, hash);
          const seq0Errors = (await events(p)).filter((e) => e.kind === 'error').length;
          return await p.evaluate((n) => {
            const canvas = document.getElementById('canvas');
            const text = (canvas.textContent || '').replace(/\s+/g, ' ').trim();
            return { route: Proto.router.current(), h1: ((canvas.querySelector('h1') || {}).textContent || '').trim(), canvasHead: text.slice(0, 120), notFoundSignal: /not found|nothing here|no appointment|no patient|notfound/i.test(text), errorEventsSoFar: n };
          }, seq0Errors);
        };
        const phoneXyz = await read('#/phone/xyz');
        const phoneNope = await read('#/owner/phone/nope');
        const phoneReal = await read('#/phone/approvals');
        const checkout = await read('#/frontdesk/checkout/a-9999');
        const encounter = await read('#/dentist/encounter/enc-nope');
        const ledger = await read('#/frontdesk/ledger/p-999');
        const bogusRoute = await read('#/frontdesk/bogusroute');
        const ev = await events(p);
        const phoneSignalsNotFound = phoneXyz.notFoundSignal || phoneNope.notFoundSignal;
        const phoneRendersApprovals = phoneXyz.h1 === 'Approvals' && phoneNope.h1 === 'Approvals' && phoneXyz.h1 === phoneReal.h1;
        const idsWereUnknown = phoneXyz.route.id === 'xyz' && phoneNope.route.id === 'nope';
        const contrastRoutesSignal = checkout.notFoundSignal && encounter.notFoundSignal && ledger.notFoundSignal;
        const notFoundRouteReached = { phoneXyz: phoneXyz.route.route === 'notfound', bogusRoute: bogusRoute.h1 === 'Nothing here' };
        const reproduced = idsWereUnknown && phoneRendersApprovals && !phoneSignalsNotFound && contrastRoutesSignal;
        rec('A-screens-phone-2-6', 'An unknown id under /phone is accepted silently: #/phone/xyz and #/owner/phone/nope parse to {route:"phone", id:"xyz"/"nope"} and render the ordinary Approvals screen with no not-found signal, while the same kind of unknown id on checkout, encounter and ledger says the record was not found', 'A6 — an unknown id lands on notfound; router.js:14 accepts any id for the phone route and phone.js:184 render(r) ignores r.id',
          reproduced, { phoneXyz, phoneNope, phoneKnownId: phoneReal, contrastCheckoutUnknownId: checkout, contrastEncounterUnknownId: encounter, contrastLedgerUnknownId: ledger, contrastUnknownRoute: bogusRoute, idsWereUnknown, phoneRendersApprovals, phoneSignalsNotFound, contrastRoutesSignal, notFoundRouteReached, errorEvents: errorEvents(ev), eventCount: ev.length });
      } finally { await c.close(); }
    },

    // RC-189 · C6 · phone.js:58 and :81 put standing policy on the finish path: the step-up dialog opens with
    // "Approvals above the high-value band re-verify within two minutes." — verbatim the `why` string store.js:141
    // attaches to the same stepup gate — and "Your name is recorded as second approver.", with no disclosure in the
    // dialog at all (phone.js:79-84 renders no <details> and no Why control).
    // Negative control: under C6 that policy sentence sits behind a disclosure — the dialog would carry a <details>
    // or a control named Why (as the card's own phone.request.<id>.why does, measured here as the contrast) — or the
    // sentence would not be on the finish path; either makes disclosuresInDialog > 0 or policyOnFinishPath false and
    // the check reports false. Visibility is read through getComputedStyle, and the walker skips the body of a closed
    // <details> (the card's Why is closed on open and still measures a non-zero box). Fresh context, and the dialog is
    // measured BEFORE any digit is entered, so what is scored is what the dialog says on open.
    async 'A-screens-phone-2-7'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals?device=phone');
        const viewer = await whoAmI(p);
        await simulate(p);
        // The same gate's own `why` string, straight from the store; refuse() is pure (store.js:22) so this
        // neither mutates nor logs.
        const storeGate = await p.evaluate(() => { const r = Proto.store.decideApproval('ar-1', 'u-dr-1', 'approved', false); return { ok: r.ok, code: r.code, verb: r.verb, why: r.why }; });
        // Contrast: the card's own Why disclosure, closed on open, box still non-zero.
        const cardWhy = await p.evaluate(() => { const d = document.querySelector('.ph-card details.ph-why'); if (!d) return null; const r = d.getBoundingClientRect(); return { open: d.open, boxW: Math.round(r.width), boxH: Math.round(r.height), summary: ((d.querySelector('summary') || {}).textContent || '').trim(), bodyText: ((d.querySelector('p') || {}).textContent || '').trim().slice(0, 160) }; });
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const dialogOpen = await p.evaluate(() => !!document.querySelector('#dialogs .dialog'));
        const dialogLeaves = await leaves(p, '#dialogs .dialog');
        const dialogMeta = await p.evaluate(() => {
          const d = document.querySelector('#dialogs .dialog'); if (!d) return null;
          return { ariaLabel: d.getAttribute('aria-label'), h2: ((d.querySelector('h2') || {}).textContent || '').trim(),
            detailsCount: d.querySelectorAll('details').length, summaryCount: d.querySelectorAll('summary').length,
            whyControls: [...d.querySelectorAll('button, summary, [data-testid$=".why"]')].map((e) => e.textContent.trim()).filter((t) => /^why\b/i.test(t)),
            digitsEntered: ((d.querySelector('.pindots') || {}).textContent || '').length };
        });
        const visible = (dialogLeaves || []).filter((l) => l.visible).map((l) => l.text);
        const dialogSentences = sentences(visible.filter((t) => !/^[0-9⌫]$/.test(t) && !/^(Approve|Cancel)$/.test(t)));
        const norm = (s) => String(s).replace(/\s+/g, ' ').replace(/[.\u00a0]+$/, '').trim().toLowerCase();
        const policyFromStore = storeGate && storeGate.why ? norm(storeGate.why) : null;
        const policySentencesOnScreen = dialogSentences.filter((s) => norm(s) === policyFromStore || /recorded as second approver/i.test(s));
        const policyOnFinishPath = !!policyFromStore && dialogSentences.some((s) => norm(s) === policyFromStore);
        const disclosuresInDialog = dialogMeta ? dialogMeta.detailsCount + dialogMeta.summaryCount + dialogMeta.whyControls.length : 0;
        const measuredOnOpen = !!dialogMeta && dialogMeta.digitsEntered === 0;
        const reproduced = dialogOpen && measuredOnOpen && policyOnFinishPath && policySentencesOnScreen.length >= 2 && disclosuresInDialog === 0;
        rec('A-screens-phone-2-7', 'The step-up dialog opens on the finish path with two standing-policy sentences as ordinary body text — "Approvals above the high-value band re-verify within two minutes." (verbatim the store\'s own `why` for this gate) and "Your name is recorded as second approver." — and carries no Why disclosure at all, while the card behind it files the same kind of prose behind a Why', 'C6 — policy prose never on the finish path; explanations behind Why or a disclosure; phone.js:58, :81, :79-84; the same sentence is a `why` at store.js:141',
          reproduced, { viewer, stepupGateFromStore: storeGate, dialogOpen, dialogMeta, dialogVisibleLeaves: (dialogLeaves || []).map((l) => ({ text: l.text, tag: l.tag, className: l.className, display: l.display, visibility: l.visibility, w: l.w, h: l.h, inClosedDetailsBody: l.inClosedDetailsBody, visible: l.visible })), dialogSentences, policySentencesOnScreen, policyOnFinishPath, disclosuresInDialog, measuredOnOpen, cardWhyDisclosureContrast: cardWhy, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
