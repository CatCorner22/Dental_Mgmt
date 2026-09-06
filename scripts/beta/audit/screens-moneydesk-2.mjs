// Audit checks for prototype/js/screens/moneydesk.js, chunk screens-moneydesk-2
// (root causes RC-168, RC-169, RC-170, RC-171, RC-172, RC-228, RC-241, RC-242, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
//
// Two traps this module avoids on purpose:
//  * CSS consequences are read through getComputedStyle on the live element, never by walking document.styleSheets
//    (cssRules access throws over file:// and a catch-and-continue silently returns an empty list).
//  * go(p, hash) on an already-open page is a same-document navigation, so module state (Money Desk's `tab`, `st`)
//    and the store survive it. Any check that compares two independent legs opens a FRESH context per leg; the
//    checks that deliberately need state to carry (RC-242's approval round trip) stay in one context and say so.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const keys = (ev) => ev.filter((e) => e.kind === 'key').map((e) => ({ seq: e.seq, key: e.key, testid: e.testid, field: !!e.field }));
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, isBody: a === document.body }; });
  // Label and accessible name of one control, read off the live element.
  const label = (p, tid) => p.evaluate((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); return e ? { label: e.textContent.replace(/\s+/g, ' ').trim(), aria: e.getAttribute('aria-label'), className: e.className } : null; }, tid);
  // Every visible text node under #canvas, with the element it hangs off. Visibility is measured through
  // getComputedStyle and getBoundingClientRect on the live node; screen-reader-only and aria-hidden text is dropped.
  const visibleText = (p) => p.evaluate(() => {
    const root = document.getElementById('canvas'); if (!root) return [];
    const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim(); if (!t) continue;
      const e = n.parentElement; if (!e) continue;
      if (e.closest('.sr-only') || e.closest('[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const b = e.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
      const cls = typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '';
      out.push({ text: t, where: e.tagName.toLowerCase() + cls + (e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : '') });
    }
    return out;
  });
  const chipText = (s) => (s || '').replace(/^[^0-9A-Za-z$]+/, '').trim();   // chips render a glyph span then the word
  const heldWriteoff = async (p) => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(220); };
  // Raw record ids the product coins for itself. Claim ids (c-88) are a payer-facing business identifier and are
  // counted separately, never scored. `a-1050` is an appointment id, matched explicitly.
  const INTERNAL_ID = /\b(?:era|ar|ap|pe|el|cr|sd|le|dis|cev|rm|al|dec|enc|nf)-[0-9]+\b|\ba-10[0-9]{2}\b/g;
  const CLAIM_ID = /\bc-[0-9]+\b/g;
  // C3 exempts an id "the spec shows". Search every spec (docs/*.md and prototype/CONTRACTS.md) for each id so the
  // exemption is measured, not assumed; an id any spec mentions at all is reported and never scored.
  const specHits = (ids) => {
    const dir = new URL('../../../docs/', import.meta.url);
    const texts = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ['docs/' + f, fs.readFileSync(new URL(f, dir), 'utf8')]);
    texts.push(['prototype/CONTRACTS.md', fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8')]);
    const out = {};
    for (const id of ids) out[id] = texts.filter(([, t]) => t.includes(id)).map(([n]) => n);
    return { filesSearched: texts.map(([n]) => n), hits: out };
  };
  const names = (s) => (s || '').split(/\s+or\s+/).map((x) => x.trim()).filter(Boolean);

  return {
    // RC-168 · A7 · moneydesk.js:81 ("Posts the 37 matched lines; …") and :82 ("Why are 37 already posted?") print 37 as a
    // string literal, while the same card's batch line (:77, from b.postedLines) and posted chip (:78, from eraLines) are computed.
    // Negative control: if both sentences were computed, moving the store (postedLines 37 → 30 and two posted lines → held, so the
    // computed posted count falls to 35) would move them too; helperNumber/whyNumber would then read 30 or 35 and the check reports
    // false. The check also requires the two computed numbers on the SAME card to actually move first — a probe whose mutation did
    // not land scores false instead of true. Store mutation + Proto.router.render() is used because no control on any screen changes
    // eraBatches[0].postedLines; the claim is precisely that these two numbers are not wired to the state at all.
    async 'A-screens-moneydesk-2-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const readCard = () => p.evaluate(() => {
          const card = document.querySelector('#canvas .md-batch');
          const t = card ? card.textContent.replace(/\s+/g, ' ') : '';
          const num = (re) => { const m = t.match(re); return m ? Number(m[1]) : null; };
          return {
            headSentence: ((card && card.querySelector('.md-batchline')) || {}).textContent || null,
            headNumber: num(/(\d+)\s+posted before you sat down/),
            chips: [...(card ? card.querySelectorAll('.chip') : [])].map((e) => e.textContent.trim()),
            chipPostedNumber: num(/●?(\d+)\s+posted(?!\s+before)/),
            helperSentence: (t.match(/Posts the [^.;]+[.;]/) || [])[0] || null,
            helperNumber: num(/Posts the (\d+) matched lines/),
            whySummary: ((card && card.querySelector('[data-testid="money.era.era-1.why"]')) || {}).textContent || null,
            whyNumber: num(/Why are (\d+) already posted\?/),
            storePostedLines: Proto.store.get().eraBatches[0].postedLines,
            storePostedLineCount: Proto.store.get().eraLines.filter((l) => l.batchId === 'era-1' && l.status === 'posted').length,
          };
        });
        const before = await readCard();
        const mutation = await p.evaluate(() => {
          const S = Proto.store.get(); S.eraBatches[0].postedLines = 30;
          const flip = S.eraLines.filter((l) => l.batchId === 'era-1' && l.status === 'posted').slice(0, 2);
          for (const l of flip) l.status = 'held';
          Proto.router.render();
          return { postedLinesSetTo: 30, linesFlippedToHeld: flip.map((l) => l.id) };
        });
        await p.waitForTimeout(180);
        const afterM = await readCard();
        const computedMoved = before.headNumber !== afterM.headNumber && before.chipPostedNumber !== afterM.chipPostedNumber
          && afterM.headNumber === afterM.storePostedLines && afterM.chipPostedNumber === afterM.storePostedLineCount;
        const literalStuck = afterM.helperNumber === before.helperNumber && afterM.whyNumber === before.whyNumber
          && afterM.helperNumber !== afterM.storePostedLines && afterM.helperNumber !== afterM.storePostedLineCount;
        rec('A-screens-moneydesk-2-1', 'The Money Desk ERA card prints "37" as a literal in the Post matched helper sentence and in the Why summary: move the store and the batch line and the posted chip follow, but both sentences still say 37', 'A7 / CHECKLIST — a number on screen is computed from state: change the state and the number moves; it is never a literal (moneydesk.js:81, :82)',
          computedMoved && literalStuck, {
            before, mutation, after: afterM,
            computedNumbersMoved: { headNumber: [before.headNumber, afterM.headNumber], chipPostedNumber: [before.chipPostedNumber, afterM.chipPostedNumber] },
            literalNumbersStuck: { helperNumber: [before.helperNumber, afterM.helperNumber], whyNumber: [before.whyNumber, afterM.whyNumber] },
            storeAfter: { postedLines: afterM.storePostedLines, postedLineCount: afterM.storePostedLineCount },
          });
      } finally { await c.close(); }
    },

    // RC-169 · C3 · moneydesk.js:79 (h2 "Delta Dental 835 · era-1"), :123 (chip "Request ar-1 waiting"), :234 (approvals row id),
    // :184 (drawer "Appeal packet · ap-1"), :180 (slot "six-point exam pe-1") and :224 (credit reason "(a-1050)") put raw seed ids
    // in text the biller reads.
    // Negative control: C3 exempts an id the spec shows, so every id found is looked up in every spec (docs/*.md and
    // prototype/CONTRACTS.md) — an id any spec mentions is reported and NOT scored, the strictest reading against the claim, even
    // though CONTRACTS §8 names its ids as the ones "the scripts rely on" (C3's own examples enc-9002 and el-14 are §8 seed ids too,
    // so a §8 mention cannot be what exempts a raw id from the screen). If Money Desk named these records in human words (as it
    // already does for ERA lines, where :96/:97 print "Line 14" from l.id.replace('el-','')), the scored list is empty and the check
    // reports false. Visible means visible:
    // text nodes are filtered by getComputedStyle and getBoundingClientRect, and .sr-only / aria-hidden text is dropped, so the
    // aria-live announcements are collected separately and never scored.
    async 'A-screens-moneydesk-2-2'(b) {
      const { c, p } = await ctx(b);
      try {
        const seen = [];
        const collect = async (where) => { for (const n of await visibleText(p)) { const ids = [...new Set(n.text.match(INTERNAL_ID) || [])]; const claims = [...new Set(n.text.match(CLAIM_ID) || [])]; if (ids.length || claims.length) seen.push({ where, internalIds: ids, claimIds: claims, text: n.text.slice(0, 90), element: n.where }); } };
        await go(p, '#/biller/money'); await collect('landing (ERA tab)');
        await heldWriteoff(p); await collect('after money.writeoff.p-306 → reason.courtesy → post (held)');
        await click(p, 'money.tab.approvals'); await p.waitForTimeout(120); await collect('money.tab.approvals');
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(180); await collect('after money.denial.c-88.appeal (packet drawer)');
        await click(p, 'money.tab.credits'); await p.waitForTimeout(120); await collect('money.tab.credits');
        await click(p, 'money.credit.cr-1.apply'); await p.waitForTimeout(150);
        const announced = await p.evaluate(() => ({ live: ((document.getElementById('live') || {}).textContent || '').trim(), screenLive: ((document.querySelector('#canvas .sr-only[aria-live]') || {}).textContent || '').trim() }));
        const idsFound = [...new Set(seen.flatMap((s) => s.internalIds))].sort();
        const claimIdsFound = [...new Set(seen.flatMap((s) => s.claimIds))].sort();
        const spec = specHits(idsFound.concat(claimIdsFound));
        const scored = idsFound.filter((id) => spec.hits[id].length === 0);
        const exempt = idsFound.filter((id) => spec.hits[id].length > 0);
        rec('A-screens-moneydesk-2-2', 'Money Desk prints raw seed ids in text the biller reads: the ERA heading "Delta Dental 835 · era-1", the held chip "Request ar-1 waiting" and its approvals row, the appeal drawer "Appeal packet · ap-1" and its "six-point exam pe-1" slot, and the credit reason "(a-1050)"', 'C3 / CHECKLIST — no product-internal nouns or raw ids on screen unless the spec shows them (moneydesk.js:79, :123, :180, :184, :224, :234)',
          scored.length > 0, {
            internalIdsOnScreen: idsFound, scoredMentionedByNoSpec: scored, notScoredBecauseASpecMentionsThem: exempt,
            claimIdsOnScreen: claimIdsFound, claimIdsNote: 'c-88 is a payer-facing claim number, collected but never scored',
            specsSearched: spec.filesSearched, specHits: spec.hits,
            occurrences: seen, announcementsNotScored: announced,
            contrastFileStripsIdsElsewhere: 'deltaRow (moneydesk.js:96-97) prints "Line 14" via l.id.replace("el-",""), so el-* ids never reach the screen',
          });
      } finally { await c.close(); }
    },

    // RC-170 · B4 · One concept, several words, inside one file: "write off" (Confirm label, :100) against "write-off" (that same
    // button's aria-label, :100, and the form at :114-116); "Held" (:121) against the lowercase "held:" chip (:214) against "Hold"
    // (:101); the done-word "Sent" on the appeal (:187) against "Statement sent" on the statement (:216); and two date formats in
    // one statement row — "9/2" from shortDate (:214) beside the raw ISO "2026-09-03" (:216).
    // Negative control: one canonical word per concept and one date format per context — then every variant set below has size 1,
    // variantsFound is empty, and the check reports false. Each leg opens a FRESH context: a second go() to the same file URL is a
    // same-document navigation, so Money Desk's remembered tab and st would otherwise leak from one leg into the next.
    async 'A-screens-moneydesk-2-3'(b) {
      const legs = {};
      { const { c, p } = await ctx(b);
        try { await go(p, '#/biller/money'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(220);
          legs.eraReadback = { confirm: await label(p, 'money.era.line.el-14.confirm'), hold: await label(p, 'money.era.line.el-14.hold'), dispute: await label(p, 'money.era.line.el-14.dispute') };
        } finally { await c.close(); } }
      { const { c, p } = await ctx(b);
        try { await go(p, '#/biller/money');
          legs.writeoffEntry = await label(p, 'money.writeoff.p-306');
          await click(p, 'money.writeoff.p-306');
          legs.writeoffForm = await p.evaluate(() => ({ fieldLabels: [...document.querySelectorAll('#canvas label')].map((e) => e.textContent.trim()), amountAria: (document.querySelector('[data-testid="money.writeoff.amount"]') || {}).getAttribute('aria-label') }));
          await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(220);
          legs.heldButton = await label(p, 'money.writeoff.post');
        } finally { await c.close(); } }
      { const { c, p } = await ctx(b);
        try { await go(p, '#/biller/money'); await click(p, 'money.tab.statements'); await p.waitForTimeout(150);
          legs.statementSendLabel = await label(p, 'money.statement.sd-1.send');
          await click(p, 'money.statement.sd-1.send'); await p.waitForTimeout(220);
          legs.statementRow = await p.evaluate(() => { const r = document.querySelector('#canvas .md-row.sent') || document.querySelector('#canvas .md-row'); return { text: r ? r.textContent.replace(/\s+/g, ' ').trim() : null, chips: r ? [...r.querySelectorAll('.chip')].map((e) => e.textContent.trim()) : [], dates: r ? (r.textContent.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g) || []) : [] }; });
        } finally { await c.close(); } }
      { const { c, p } = await ctx(b);
        try { await go(p, '#/biller/money'); await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(180);
          legs.appealDrawerButtons = await p.evaluate(() => [...document.querySelectorAll('#canvas .md-drawer button')].map((e) => ({ testid: e.getAttribute('data-testid'), label: e.textContent.trim() })));
          await click(p, 'money.appeal.send'); await p.waitForTimeout(220);
          legs.appealDone = await p.evaluate(() => { const d = document.querySelector('#canvas .md-drawer'); return { chips: d ? [...d.querySelectorAll('.chip')].map((e) => e.textContent.trim()) : [], text: d ? d.textContent.replace(/\s+/g, ' ').trim().slice(-90) : null }; });
        } finally { await c.close(); } }

      const variants = [];
      const cf = legs.eraReadback && legs.eraReadback.confirm;
      if (cf && /write off/.test(cf.label) && /write-off/.test(cf.aria || '')) variants.push({ concept: 'write-off', words: ['write off', 'write-off'], where: ['money.era.line.el-14.confirm label (moneydesk.js:100): ' + cf.label, 'that same button aria-label (moneydesk.js:100): ' + cf.aria] });
      const heldWords = [legs.heldButton && legs.heldButton.label, legs.eraReadback && legs.eraReadback.hold && legs.eraReadback.hold.label, ...((legs.statementRow && legs.statementRow.chips) || []).map(chipText).filter((t) => /^held/i.test(t))].filter(Boolean);
      const heldSet = [...new Set(heldWords)];
      if (heldSet.length > 1) variants.push({ concept: 'hold / held', words: heldSet, where: ['money.writeoff.post label (moneydesk.js:121)', 'money.era.line.el-14.hold label (moneydesk.js:101)', 'statement row chip (moneydesk.js:214)'] });
      const doneWords = [...new Set([...(((legs.appealDone || {}).chips) || []), ...(((legs.statementRow || {}).chips) || [])].map(chipText).filter((t) => /sent/i.test(t)))];
      if (doneWords.length > 1) variants.push({ concept: 'the done-word after an irreversible Send', words: doneWords, where: ['appeal drawer chip (moneydesk.js:187)', 'statement row chip (moneydesk.js:216)'] });
      const dateFormats = [...new Set(((legs.statementRow || {}).dates || []).map((d) => (/^\d{4}-/.test(d) ? 'YYYY-MM-DD' : 'M/D')))];
      if (dateFormats.length > 1) variants.push({ concept: 'date in one statement row', words: (legs.statementRow || {}).dates, formats: dateFormats, where: ['shortDate(s.created) (moneydesk.js:214)', 'S.tenant.today raw ISO (moneydesk.js:216)'] });
      rec('A-screens-moneydesk-2-3', 'Money Desk uses several words for one concept: "write off" in a button label and "write-off" in that same button\'s aria-label; "Held" / "held:" / "Hold"; the done-word "Sent" on an appeal and "Statement sent" on a statement; and both "9/2" and "2026-09-03" inside one statement row', 'B4 / CHECKLIST — one canonical word per concept across screens, refusals and aria-labels; one date format per context (moneydesk.js:100, :101, :114-116, :121, :187, :214, :216)',
        variants.length > 0, { variantsFound: variants, legs });
    },

    // RC-171 · B4 · moneydesk.js:78 concatenates e.deltas.length + ' deltas' and :56 gives every tab count the aria-label
    // c[code] + ' items', so a count of one reads "1 deltas" and "1 items".
    // Negative control: a screen that pluralises would render "1 delta" and "1 item"; pluralTabCounts would be empty and the delta
    // chip would not match /^1 deltas$/, so the check reports false. The contrast is inside the same file: the read-back heading at
    // :86 does pluralise ("1 line" / "2 lines"), and it is measured here to show the check can see a correct singular.
    async 'A-screens-moneydesk-2-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const tabCounts = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="money.tab."]')].map((e) => { const s = e.querySelector('.count'); return { testid: e.getAttribute('data-testid'), count: s ? s.textContent.trim() : null, ariaLabel: s ? s.getAttribute('aria-label') : null }; }));
        const pluralTabCounts = tabCounts.filter((t) => t.count === '1' && /\bitems\b/.test(t.ariaLabel || ''));
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(220);
        const chips3 = await p.evaluate(() => [...document.querySelectorAll('#canvas .md-batch .chip')].map((e) => e.textContent.trim()));
        const head3 = await p.evaluate(() => ((document.querySelector('#canvas .md-batch h3') || {}).textContent || '').trim());
        await click(p, 'money.era.line.el-14.confirm'); await p.waitForTimeout(160);
        await click(p, 'money.era.line.el-22.confirm'); await p.waitForTimeout(200);
        const chips1 = await p.evaluate(() => [...document.querySelectorAll('#canvas .md-batch .chip')].map((e) => e.textContent.trim()));
        const head1 = await p.evaluate(() => ((document.querySelector('#canvas .md-batch h3') || {}).textContent || '').trim());
        const deltasLeft = await p.evaluate(() => Proto.store.get().eraLines.filter((l) => l.batchId === 'era-1' && l.status === 'delta').length);
        const deltaChip = chips1.map(chipText).find((t) => /\bdeltas?\b/.test(t)) || null;
        const oneDeltas = deltasLeft === 1 && deltaChip === '1 deltas';
        rec('A-screens-moneydesk-2-4', 'A count of one reads plural on Money Desk: the ERA status chip says "1 deltas" with one delta left, and every tab count carries the aria-label "1 items"', 'B4 / CHECKLIST — consistent words for one concept; the same file pluralises the read-back heading correctly at moneydesk.js:86 (moneydesk.js:56, :78)',
          oneDeltas && pluralTabCounts.length > 0, {
            tabCounts, pluralTabCounts: pluralTabCounts.map((t) => t.testid + ' count=' + t.count + ' aria="' + t.ariaLabel + '"'),
            deltasLeftInStore: deltasLeft, deltaChipWithOneLeft: deltaChip, chipsWithThreeDeltas: chips3, chipsWithOneDelta: chips1,
            contrastHeadingPluralisesCorrectly: { withThreeDeltas: head3, withOneDelta: head1 },
          });
      } finally { await c.close(); }
    },

    // RC-172 · B10 · moneydesk.js:244 — the W key does `if (!st.writeoffOpen) openWriteoff(r); else rerender(r, 'money.writeoff.amount')`.
    // After a successful Post, st.writeoffOpen is still true (:139 sets only woPosted), so W re-renders and asks focus for an amount
    // field the posted card no longer draws (:112 returns early). shell.mount() has already replaced the DOM, so focus lands on body.
    // Negative control: the check first proves the FIRST press worked (a ledger write_off row for p-306 in the seq range, st.woPosted
    // true, the card showing "Write-off posted") and that focus was on a real control immediately before W (money.tab.era, not body).
    // A W that was a no-op would leave focus on that button, and a W that reopened a live field would put focus in the input — either
    // way focusAfterW.isBody is false and the check reports false.
    async 'A-screens-moneydesk-2-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '50'); await click(p, 'money.writeoff.reason.courtesy');
        const seq0 = await lastSeq(p);
        await click(p, 'money.writeoff.post'); await p.waitForTimeout(260);
        const evPost = await after(p, seq0);
        const afterPost = await p.evaluate(() => ({
          writeoffOpen: Proto.screens.moneydesk.state().writeoffOpen,
          woPosted: Proto.screens.moneydesk.state().woPosted,
          ledgerWriteoffs: window.__proto.state().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306').map((e) => ({ id: e.id, amountCents: e.amountCents, reason: e.reason })),
          cardText: ((document.querySelector('#canvas section[aria-label="Open balances"]') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
          amountFieldExists: !!document.querySelector('[data-testid="money.writeoff.amount"]'),
        }));
        const focusBefore = await focused(p);
        const seq1 = await lastSeq(p);
        await p.keyboard.press('w'); await p.waitForTimeout(280);
        const evW = await after(p, seq1);
        const focusAfter = await focused(p);
        const afterW = await p.evaluate(() => ({ amountFieldExists: !!document.querySelector('[data-testid="money.writeoff.amount"]'), writeoffOpen: Proto.screens.moneydesk.state().writeoffOpen, cardText: ((document.querySelector('#canvas section[aria-label="Open balances"]') || {}).textContent || '').replace(/\s+/g, ' ').trim() }));
        const firstPressWorked = afterPost.woPosted === true && afterPost.ledgerWriteoffs.some((e) => e.amountCents === -5000) && /Write-off posted/.test(afterPost.cardText) && writes(evPost).some((w) => w.table === 'ledger');
        const reproduced = firstPressWorked && !focusBefore.isBody && focusAfter.isBody && afterW.amountFieldExists === false;
        rec('A-screens-moneydesk-2-5', 'After a $50 write-off has posted, the W accelerator re-renders Money Desk and asks focus for the amount field the posted card no longer draws, dropping keyboard focus from the ERA tab button to the page body', 'B10 / CHECKLIST — after a mutation focus lands on the next action or the state line, never on body (moneydesk.js:139, :244)',
          reproduced, {
            firstPressWorked, afterPost, writesForPost: writes(evPost), seqRangeForPost: range(evPost, seq0),
            focusBeforeW: focusBefore, focusAfterW: focusAfter, afterW,
            keyEvents: keys(evW), seqRangeForW: range(evW, seq1),
            moduleStateExplains: 'st.writeoffOpen stayed ' + afterPost.writeoffOpen + ' after the post, so onKey W takes the else branch and rerenders to a focus target that no longer exists',
          });
      } finally { await c.close(); }
    },

    // RC-228 · B4 · The same object (a patient statement) carries different verbs and different done-words per screen:
    // moneydesk.js:217 "Send" → :216 chip "Statement sent"; rail.js:236 "Send statement" → :233 chip "Sent"; checkout.js:132
    // segment "Send statement".
    // Negative control: one verb and one done-word for one object would give verbSet and doneSet size 1 each and the check reports
    // false. Each screen is opened in a FRESH context, because a second go() to the same file URL is a same-document navigation:
    // Money Desk's remembered tab and the already-sent sd-1 would otherwise follow the check onto the Ledger leg and change what it
    // reads. The done-words are read from the confirmation chip each screen renders in place, not from the aria-live line.
    async 'A-screens-moneydesk-2-6'(b) {
      const legs = {};
      { const { c, p } = await ctx(b);
        try { await go(p, '#/biller/money'); await click(p, 'money.tab.statements'); await p.waitForTimeout(150);
          const sendBtn = await label(p, 'money.statement.sd-1.send');
          await click(p, 'money.statement.sd-1.send'); await p.waitForTimeout(240);
          const done = await p.evaluate(() => { const r = document.querySelector('#canvas .md-row.sent'); return { chipClear: r ? ((r.querySelector('.chip.clear') || {}).textContent || '').trim() : null, rowText: r ? r.textContent.replace(/\s+/g, ' ').trim() : null, sent: window.__proto.state().statementsDue.filter((s) => s.sent).map((s) => s.id) }; });
          legs.moneyDesk = { screen: '#/biller/money → money.tab.statements', verbControl: 'money.statement.sd-1.send', verbLabel: sendBtn && sendBtn.label, verbAria: sendBtn && sendBtn.aria, doneChip: chipText(done.chipClear), rowText: done.rowText, statementsSent: done.sent };
        } finally { await c.close(); } }
      { const { c, p } = await ctx(b);
        try { await go(p, '#/biller/ledger/p-316'); await p.waitForTimeout(150);
          const sendBtn = await label(p, 'ledger.statement.send');
          await click(p, 'ledger.statement.send'); await p.waitForTimeout(260);
          const done = await p.evaluate(() => { const r = document.querySelector('#canvas .ledger-sent'); return { chipClear: r ? ((r.querySelector('.chip') || {}).textContent || '').trim() : null, rowText: r ? r.textContent.replace(/\s+/g, ' ').trim() : null, sent: window.__proto.state().statementsDue.filter((s) => s.sent).map((s) => s.id) }; });
          legs.ledger = { screen: '#/biller/ledger/p-316 (the sd-1 patient)', verbControl: 'ledger.statement.send', verbLabel: sendBtn && sendBtn.label, verbAria: sendBtn && sendBtn.aria, doneChip: chipText(done.chipClear), rowText: done.rowText, statementsSent: done.sent };
        } finally { await c.close(); } }
      { const { c, p } = await ctx(b);
        try { await go(p, '#/frontdesk/checkout/a-1044'); await p.waitForTimeout(150);
          const seg = await label(p, 'checkout.collect.seg.send-statement');
          legs.checkout = { screen: '#/frontdesk/checkout/a-1044', verbControl: 'checkout.collect.seg.send-statement', verbLabel: seg && seg.label, verbAria: seg && seg.aria, doneChip: null };
        } finally { await c.close(); } }
      const verbSet = [...new Set([legs.moneyDesk.verbLabel, legs.ledger.verbLabel, legs.checkout.verbLabel].filter(Boolean))];
      const doneSet = [...new Set([legs.moneyDesk.doneChip, legs.ledger.doneChip].filter(Boolean))];
      const bothSent = legs.moneyDesk.statementsSent.length > 0 && legs.ledger.statementsSent.length > 0;
      rec('A-screens-moneydesk-2-6', 'One statement, three vocabularies: Money Desk sends it with "Send" and confirms "Statement sent"; the Ledger sends it with "Send statement" and confirms "Sent"; Checkout offers the decision as "Send statement"', 'B4 / CHECKLIST — one canonical word per concept across all screens; the same irreversible verb and the same done-word for the same object everywhere (moneydesk.js:216-217, rail.js:233,236, checkout.js:132)',
        bothSent && verbSet.length > 1 && doneSet.length > 1, { verbsForOneObject: verbSet, doneWordsForOneObject: doneSet, bothSendsLanded: bothSent, legs });
    },

    // RC-241 · C5, A7 · The set of people who may second one held write-off renders three ways: store.js:134 slices eligible to two
    // for the needs_second verb, phone.js:150 joins all three on the approver's card, and moneydesk.js:123 prints the literal string
    // "Dana or Dr. Reagan will see it on their phone" that is wired to nothing.
    // Negative control: if the three renderings came from one list, verbNames, hintNames and phoneNames would all equal the stored
    // approvals[0].eligible and leg B's rename would move all three together — then disagree is false and literalStuck is false, and
    // the check reports false. Leg B renames one eligible user in the store BEFORE the request so the derived renderings must move;
    // it runs in its own FRESH context so leg A's request and module state cannot leak into it. The needs_second verb is read from
    // the refusal EVENT, because this screen discards the refusal node before mounting (RC-30) — the event is the store's rendering.
    async 'A-screens-moneydesk-2-7'(b) {
      const leg = async (rename) => {
        const { c, p } = await ctx(b);
        try {
          await go(p, '#/biller/money');
          const renamed = rename ? await p.evaluate((to) => { const u = Proto.store.get().users.find((x) => x.short === 'Dana'); if (!u) return null; const was = u.short; u.short = to; return { userId: u.id, was, now: u.short }; }, rename) : null;
          const seq0 = await lastSeq(p);
          await heldWriteoff(p);
          const ev = await after(p, seq0);
          const verbEvent = refusalEvents(ev).find((e) => e.code === 'needs_second') || null;
          const dom = await p.evaluate(() => ({
            hint: [...document.querySelectorAll('#canvas .small.muted')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).find((t) => /will see it on their phone/.test(t)) || null,
            heldChip: [...document.querySelectorAll('#canvas .chip')].map((e) => e.textContent.trim()).find((t) => /waiting/i.test(t)) || null,
            refusalVerbInDom: ((document.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
          }));
          const stored = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).eligible || null);
          await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(200);
          const phone = await p.evaluate(() => { const kv = [...document.querySelectorAll('#canvas .ph-kv')].find((e) => /^Eligible/.test((e.querySelector('.ph-k') || {}).textContent || '')); return kv ? ((kv.querySelector('.ph-v') || {}).textContent || '').trim() : null; });
          const verbTail = verbEvent && verbEvent.verb ? verbEvent.verb.split('—').pop().trim() : null;
          const hintTail = dom.hint ? dom.hint.split(/\s+will see it/)[0].trim() : null;
          return { renamed, storedEligible: stored, refusalEvent: verbEvent, verbNames: names(verbTail), hintText: dom.hint, hintNames: names(hintTail), phoneEligible: phone, phoneNames: names(phone), heldChip: dom.heldChip, refusalVerbInDom: dom.refusalVerbInDom, writes: writes(ev), seqRange: range(ev, seq0) };
        } finally { await c.close(); }
      };
      const A = await leg(null);
      const B = await leg('Nadia');
      const disagree = !!A.storedEligible && (A.verbNames.length !== A.phoneNames.length || A.hintNames.length !== A.phoneNames.length || A.phoneNames.length !== A.storedEligible.length);
      const derivedMoved = B.verbNames.includes('Nadia') && B.phoneNames.includes('Nadia') && (B.storedEligible || []).includes('Nadia');
      const literalStuck = !!B.hintText && /\bDana\b/.test(B.hintText) && !B.hintNames.includes('Nadia');
      rec('A-screens-moneydesk-2-7', 'The eligible second approvers for one held write-off render three ways — three names on the phone card, two in the needs_second verb, and a hard-coded "Dana or Dr. Reagan" in the Money Desk Held hint that does not follow the store', 'C5, A7 / CHECKLIST — the same fact has one canonical value everywhere it appears, and a name on screen is computed from state, never a literal (moneydesk.js:123, store.js:134, phone.js:150)',
        disagree && derivedMoved && literalStuck, {
          asSeeded: { storeEligible: A.storedEligible, needsSecondVerb: A.refusalEvent, verbNames: A.verbNames, moneyDeskHint: A.hintText, hintNames: A.hintNames, phoneCardEligible: A.phoneEligible, phoneNames: A.phoneNames, heldChip: A.heldChip, seqRange: A.seqRange },
          afterRenamingOneEligibleUser: { renamed: B.renamed, storeEligible: B.storedEligible, needsSecondVerb: B.refusalEvent, verbNames: B.verbNames, moneyDeskHint: B.hintText, hintNames: B.hintNames, phoneCardEligible: B.phoneEligible, phoneNames: B.phoneNames, seqRange: B.seqRange },
          threeRenderingsDisagree: disagree, derivedRenderingsFollowedTheStore: derivedMoved, moneyDeskHintIsALiteral: literalStuck,
          note: 'the needs_second verb is read from the refusal event because moneydesk.js:124 nulls st.woRefusal before mounting, so no refusal.verb reaches the DOM (refusalVerbInDom=' + JSON.stringify(A.refusalVerbInDom) + ')',
        });
    },

    // RC-242 · C5, A7 · moneydesk.js:109 builds the Open balances row from a computed amount (Proto.store.balances(pid).patientDue)
    // and a fixed string "Crown #19 · MetLife paid; patient portion outstanding since 9/1", so once the write-off is approved the row
    // reads "$0.00 open … patient portion outstanding since 9/1".
    // Negative control: prose wired to the same state would change or drop when the balance reaches zero — then afterText no longer
    // carries "outstanding since 9/1" and the check reports false. The check will not score the "after" reading unless the approval
    // really landed: approvals[0].status must be 'approved' and a ledger write_off of -41000 must appear in the seq range, and the
    // computed number must actually have moved (41000 → 0). This leg deliberately stays in ONE context across the money → close →
    // phone → money hops: the held request lives in Money Desk's module state, and a fresh go() would throw it away.
    async 'A-screens-moneydesk-2-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy');
        const readRow = () => p.evaluate(() => { const s = document.querySelector('#canvas section[aria-label="Open balances"]'); const head = s ? s.querySelector('.md-rowhead') : null; return { rowhead: head ? head.textContent.replace(/\s+/g, ' ').trim() : null, amountSpan: head ? ((head.querySelector('.amt') || {}).textContent || '').trim() : null, proseSpan: head ? ((head.querySelector('.muted') || {}).textContent || '').trim() : null, chips: s ? [...s.querySelectorAll('.chip')].map((e) => e.textContent.trim()) : [], patientDue: Proto.store.balances('p-306').patientDue }; });
        const before = await readRow();
        const seq0 = await lastSeq(p);
        await click(p, 'money.writeoff.post'); await p.waitForTimeout(240);
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const heldRow = await readRow();
        const reqId = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).id || null);
        await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(200);
        let approved = null;
        if (reqId) {
          await click(p, 'phone.request.' + reqId + '.approve'); await p.waitForTimeout(120);
          for (const d of ['2', '4', '6', '8']) await click(p, 'phone.stepup.' + d);
          await click(p, 'phone.stepup.submit'); await p.waitForTimeout(320);
          approved = await p.evaluate(() => ({ approvals: window.__proto.state().approvals.map((a) => ({ id: a.id, status: a.status, decidedBy: a.decidedBy, amountCents: a.amountCents })), ledgerWriteoffs: window.__proto.state().ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306').map((e) => ({ id: e.id, amountCents: e.amountCents, approvalRequestId: e.approvalRequestId })) }));
        }
        await hop(p, '#/biller/money'); await p.waitForTimeout(260);
        const afterRow = await readRow();
        const ev = await after(p, seq0);
        const approvalLanded = !!approved && approved.approvals.some((a) => a.id === reqId && a.status === 'approved') && approved.ledgerWriteoffs.some((e) => e.amountCents === -41000) && writes(ev).some((w) => w.table === 'ledger');
        const numberMoved = before.patientDue === 41000 && afterRow.patientDue === 0 && /\$410\.00 open/.test(before.rowhead || '') && /\$0\.00 open/.test(afterRow.rowhead || '');
        const LITERAL = /patient portion outstanding since 9\/1/;
        const proseStuck = LITERAL.test(before.proseSpan || '') && LITERAL.test(afterRow.proseSpan || '');
        rec('A-screens-moneydesk-2-8', 'The Money Desk Open balances row pairs a computed amount with a fixed sentence, so after the $410 write-off is approved it reads "$0.00 open · Crown #19 · MetLife paid; patient portion outstanding since 9/1"', 'C5, A7 / CHECKLIST — the same fact has one canonical value and every number on screen is computed from state; the row\'s prose must agree with its number (moneydesk.js:109)',
          approvalLanded && numberMoved && proseStuck, {
            beforeRequest: before, whileHeld: heldRow, afterApproval: afterRow,
            approvalRequestId: reqId, approvalLanded, approvalState: approved,
            balancesPatientDue: { before: before.patientDue, after: afterRow.patientDue },
            proseUnchanged: { before: before.proseSpan, after: afterRow.proseSpan },
            writesInRange: writes(ev), seqRange: range(ev, seq0),
          });
      } finally { await c.close(); }
    },
  };
};
