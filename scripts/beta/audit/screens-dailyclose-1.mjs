// Verifier checks for prototype/js/screens/dailyclose.js (chunk screens-dailyclose-1).
// Root causes, in order: RC-25, RC-24, RC-50, RC-87, RC-88, RC-89, RC-90.
// Default position is NOT reproduced: every check measures the breach it claims and states its negative control.
import fs from 'node:fs';
import path from 'node:path';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec, FILE }) => {
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : ((a.getAttribute && a.getAttribute('data-testid')) || a.tagName); });
  const live = (p) => p.evaluate(() => (document.getElementById('live') || {}).textContent || '');
  const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
  // Clauses ended by . ; ! or ? ("Dr." is a title, not a sentence end).
  const sentences = (s) => (s || '').replace(/\bDr\./g, 'Dr').trim().split(/[.;!?](?:\s+|$)/).filter((x) => x.trim().length).length;
  const writesSince = (ev, seq) => ev.filter((e) => e.kind === 'write' && e.seq > seq).map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const refusalsSince = (ev, seq) => ev.filter((e) => e.kind === 'refusal' && e.seq > seq).map((e) => ({ seq: e.seq, code: e.code, verb: e.verb }));
  const lastSeq = (ev) => (ev.length ? ev[ev.length - 1].seq : 0);

  return {
    // RC-25 (A2, claimed P0): todayTotals (dailyclose.js:67) and closeDay (store.js:264) count the 9/3 repost of the 9/1 check
    // (le-4431, −$120 check) as collected today and ignore its reversal (le-4430, +$120), so the pair does not net to zero and
    // dayCloses/deposits freeze check 12000.
    // Negative control: if the pair netted, the confirm row would read Check $0.00 and dayCloses.totals.check would be 0 (or the
    // seed would carry no such pair), and the check reports false. It also reports false if the store shows a real check
    // payment posted today that would justify the $120.
    async 'A-screens-dailyclose-1-1'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        const S0 = await state(p);
        const todayLoc1 = S0.ledger.filter((e) => e.locationId === 'loc-1' && e.posted === S0.tenant.today && (e.kind === 'patient_payment' || e.kind === 'reversal'))
          .map((e) => ({ id: e.id, kind: e.kind, tender: e.tender || null, amountCents: e.amountCents, effective: e.effective, posted: e.posted, correctsEntryId: e.correctsEntryId || null }));
        const repost = todayLoc1.find((e) => e.kind === 'patient_payment' && e.tender === 'check' && e.correctsEntryId);
        const reversal = repost ? todayLoc1.find((e) => e.kind === 'reversal' && e.correctsEntryId === repost.correctsEntryId) : null;
        const netCheckToday = -todayLoc1.filter((e) => e.tender === 'check' || (e.kind === 'reversal' && repost && e.correctsEntryId === repost.correctsEntryId)).reduce((s, e) => s + e.amountCents, 0);
        const realCheckToday = todayLoc1.some((e) => e.kind === 'patient_payment' && e.tender === 'check' && !e.correctsEntryId);
        await click(p, 'close.closeday'); await p.waitForTimeout(120);
        const confirmRows = await p.evaluate(() => [...document.querySelectorAll('[aria-label="Confirm close day"] .tender')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
        const checkRow = confirmRows.find((r) => /^Check/.test(r)) || null;
        const checkShown = checkRow ? (checkRow.match(/\$[\d,]+\.\d\d/) || [null])[0] : null;
        const seqBefore = lastSeq(await events(p));
        await click(p, 'close.closeday.confirm'); await p.waitForTimeout(200);
        const S1 = await state(p); const ev = await events(p);
        const dc = S1.dayCloses.find((d) => d.locationId === 'loc-1' && d.date === S1.tenant.today) || null;
        const dep = dc ? (S1.deposits.find((d) => d.dayCloseId === dc.id) || null) : null;
        const evidence = {
          todayPostedRowsLoc1: todayLoc1, repostId: repost ? repost.id : null, reversalId: reversal ? reversal.id : null,
          netCheckCollectedTodayCents: netCheckToday, realCheckPaymentToday: realCheckToday,
          confirmRows, checkRowShown: checkShown,
          dayCloseTotals: dc ? dc.totals : null, depositLines: dep ? dep.lines : null,
          writes: writesSince(ev, seqBefore), pageErrors: errs,
        };
        const reproduced = !!repost && !!reversal && netCheckToday === 0 && !realCheckToday
          && checkShown === '$120.00' && !!dc && dc.totals.check === 12000 && !!dep && dep.lines.check === 12000;
        rec('A-screens-dailyclose-1-1', "Collected today counts yesterday's reposted check le-4431 as Check $120.00, excludes its reversal, and freezes check 12000 into dayCloses and deposits", 'A2 (CHECKLIST); docs/13 feature 20: a correction pair nets to zero in today\'s drawer', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-24 (A2, claimed P1): Clear with reason is offered to, and accepted from, any persona who is not the day's closer.
    // Bree Lawson (hygienist, entitlements []) is neither Dana, Dr. Reagan nor the CPA seat, yet the button renders and the store
    // writes reconciliationMatches with no refusal.
    // Negative control: if the gate held, either the button would be absent for the hygienist or the press would raise a
    // refusal with code clear_not_independent (or entitlement) and v-1 would stay 'open'; the check reports false in both cases.
    async 'A-screens-dailyclose-1-2'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/hygienist/close');
        const me = await p.evaluate(() => { const u = Proto.store.currentUser(); return { id: u.id, name: u.name, role: u.role, entitlements: u.entitlements }; });
        await click(p, 'close.tied.tile'); await p.waitForTimeout(120);
        const shown = !!(await p.$('[data-testid="close.variance.v-1.clear"]'));
        const before = (await state(p)).variances.find((v) => v.id === 'v-1');
        const seqBefore = lastSeq(await events(p));
        const pressed = shown ? await click(p, 'close.variance.v-1.clear') : false;
        await p.waitForTimeout(150);
        const S1 = await state(p); const ev = await events(p);
        const after = S1.variances.find((v) => v.id === 'v-1'); const rr = S1.reconciliation.find((r) => r.id === 'rr-loc-3');
        const refusals = refusalsSince(ev, seqBefore); const writes = writesSince(ev, seqBefore);
        const refusalVerb = await txt(p, 'refusal.verb');
        const evidence = { user: me, clearButtonShown: shown, pressed, varianceBefore: before.status, varianceAfter: after.status, rrLoc3StateAfter: rr.state, writes, refusals, refusalVerbOnScreen: refusalVerb, seqRange: [seqBefore + 1, lastSeq(ev)], pageErrors: errs };
        const reproduced = shown && pressed && me.entitlements.length === 0 && !['approve_second', 'bank_reconcile'].some((e) => me.entitlements.includes(e))
          && after.status === 'cleared' && refusals.length === 0 && writes.some((w) => w.table === 'reconciliationMatches');
        rec('A-screens-dailyclose-1-2', 'Clear with reason is offered to and accepted from a hygienist with no entitlements: v-1 clears, reconciliationMatches is written, nothing refuses', 'A2 (CHECKLIST); the screen\'s own copy: only Dana, Dr. Reagan or the CPA seat can clear', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-50 (B1, claimed P1): four Daily Close test ids rendered in the DOM (close.counts.why, close.decision.d-1.why,
    // close.approval.ar-1.open, close.sod.roles) match no entry or pattern in CONTRACTS §4.
    // Negative control: if §4 listed each id (literally or by a <pattern>), or the id were never rendered, it would not appear in
    // notInContract and the check reports false. Only ids actually found in the DOM are judged.
    async 'A-screens-dailyclose-1-3'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const root = path.resolve(path.dirname(new URL(FILE).pathname), '..');
        const contracts = fs.readFileSync(path.join(root, 'prototype', 'CONTRACTS.md'), 'utf8');
        const s4 = contracts.split(/^## 4\. /m)[1].split(/^## /m)[0];
        const ids = [...s4.matchAll(/`([A-Za-z0-9.<>|\-]+)`/g)].map((m) => m[1]);
        // A §4 entry becomes a regex: literal text escaped; <a|b|c> becomes (?:a|b|c); any other <placeholder> (<id>, <locId>,
        // <n>, <0-9>) matches one dotted segment. Generous on placeholders, so a listed pattern is never missed.
        const esc = (s) => s.replace(/[.*+?^${}()[\]\\]/g, '\\$&');
        const patterns = ids.map((id) => new RegExp('^' + id.split(/(<[^>]+>)/).map((seg) => !seg.startsWith('<') ? esc(seg) : seg.includes('|') ? '(?:' + seg.slice(1, -1).split('|').map(esc).join('|') + ')' : '[^.]+').join('') + '$'));
        const matches = (tid) => patterns.some((re) => re.test(tid));
        // One pending approval so the Approvals section renders a row for the owner.
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const pending = (await state(p)).approvals.filter((a) => a.status === 'pending').map((a) => a.id);
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        await click(p, 'close.tied.tile'); await click(p, 'close.variance.v-1.investigate'); await click(p, 'close.closeday'); await p.waitForTimeout(120);
        const dom = await p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid')).filter((t) => /^close\./.test(t)));
        const notInContract = [...new Set(dom)].filter((t) => !matches(t));
        const claimed = ['close.counts.why', 'close.decision.d-1.why', 'close.approval.ar-1.open', 'close.sod.roles'];
        const claimedFound = claimed.filter((t) => dom.includes(t));
        const claimedUnlisted = claimed.filter((t) => notInContract.includes(t));
        const s4DailyCloseRow = (s4.split('\n').find((l) => /^\| Daily Close/.test(l)) || '').trim();
        const evidence = { pendingApprovals: pending, closeTestidsInDom: [...new Set(dom)], notInContract, claimedIds: claimed, claimedIdsRendered: claimedFound, claimedIdsNotInContract: claimedUnlisted, section4DailyCloseRow: s4DailyCloseRow, section4IdsParsed: ids.filter((i) => /^close\./.test(i)), pageErrors: errs };
        const reproduced = claimedFound.length === 4 && claimedUnlisted.length === 4;
        rec('A-screens-dailyclose-1-3', 'Four Daily Close test ids rendered in the DOM are absent from CONTRACTS §4: close.counts.why, close.decision.d-1.why, close.approval.ar-1.open, close.sod.roles', 'B1 (CHECKLIST); CONTRACTS §4: every id in the DOM matches a §4 entry or pattern', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-87 (A7, claimed P2): the Practice health score and its three levers (dailyclose.js:232) are a string literal that does
    // not move when the state it describes changes (the vacation exception is retired; Hillsboro ties).
    // Negative control: if the score or levers were computed from state, the text after Retire and after Match would differ from
    // the text before (the "retire vacation exception" and "bank feed for Hillsboro" levers would drop), and the check reports
    // false. It also reports false if the mutations themselves did not change the store.
    async 'A-screens-dailyclose-1-4'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        const health = () => p.evaluate(() => { const e = document.querySelector('.dc-health'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
        const h0 = await health();
        const d0 = (await state(p)).decisions.find((d) => d.id === 'd-1').status;
        await click(p, 'close.decision.d-1.retire'); await p.waitForTimeout(150);
        const h1 = await health();
        const S1 = await state(p); const d1 = S1.decisions.find((d) => d.id === 'd-1').status;
        await click(p, 'close.tied.tile'); await p.waitForTimeout(100);
        await click(p, 'close.variance.v-1.match'); await p.waitForTimeout(150);
        const h2 = await health();
        const S2 = await state(p); const v2 = S2.variances.find((v) => v.id === 'v-1').status; const rr3 = S2.reconciliation.find((r) => r.id === 'rr-loc-3').state;
        const score = (s) => { const m = (s || '').match(/Practice health:\s*(\d+)/); return m ? Number(m[1]) : null; };
        const evidence = { healthBefore: h0, healthAfterRetire: h1, healthAfterHillsboroTies: h2, scoreBefore: score(h0), scoreAfter: score(h2), decisionStatus: { before: d0, afterRetire: d1 }, varianceV1After: v2, rrLoc3After: rr3, storeChanged: d0 !== d1 && v2 === 'matched' && rr3 === 'tied', pageErrors: errs };
        const reproduced = !!h0 && h0 === h1 && h1 === h2 && score(h0) != null && evidence.storeChanged && /retire vacation exception/i.test(h2) && /Hillsboro/i.test(h2);
        rec('A-screens-dailyclose-1-4', 'The Practice health score and levers are identical before and after retiring the vacation exception and after Hillsboro ties', 'A7 (CHECKLIST): a number on screen is computed from state and moves when state changes', reproduced, evidence);
      } finally { await c.close(); }
    },

    // RC-88 (A3/A4, claimed P2): Renew, Assign and Start on Practice risk announce a completed action, relabel the button, but
    // write nothing (no write event, store unchanged); a second press of Renew writes nothing, refuses nothing, and re-announces.
    // Negative control: the first press must visibly take (label changes and the announcement is spoken) or the second press is
    // meaningless. If any press wrote a row (a write event) or the second press raised a refusal, the check reports false.
    async 'A-screens-dailyclose-1-5'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/compliance/risk');
        const snap = async () => JSON.stringify(await state(p));
        const pressRow = async (tid) => {
          const before = await snap(); const seq0 = lastSeq(await events(p)); const label0 = await txt(p, tid);
          const ok = await click(p, tid); await p.waitForTimeout(150);
          const ev = await events(p); const after = await snap();
          return { testid: tid, pressed: ok, labelBefore: label0, labelAfter: await txt(p, tid), announced: await live(p), storeChanged: before !== after, writes: writesSince(ev, seq0), refusals: refusalsSince(ev, seq0), clicks: ev.filter((e) => e.kind === 'click' && e.seq > seq0).map((e) => e.seq), seqRange: [seq0 + 1, lastSeq(ev)] };
        };
        const renew1 = await pressRow('risk.row.baa-lab.renew');
        const renew2 = await pressRow('risk.row.baa-lab.renew');
        const assign = await pressRow('risk.row.training.assign');
        const start = await pressRow('risk.row.logreview.start');
        const evidence = { renewFirst: renew1, renewSecond: renew2, assign, start, pageErrors: errs };
        const firstTook = renew1.pressed && renew1.labelBefore !== renew1.labelAfter && renew1.announced.length > 0;
        const noWrites = [renew1, renew2, assign, start].every((r) => r.pressed && r.writes.length === 0 && !r.storeChanged);
        const repeatUnguarded = renew2.refusals.length === 0 && renew2.announced === renew1.announced && renew2.announced.length > 0;
        rec('A-screens-dailyclose-1-5', 'Renew, Assign and Start write no event and change no store row while announcing a completed action; a second Renew re-announces it with no refusal', 'A3 and A4 (CHECKLIST): a mutation writes one write event per table; a repeat press is refused or is a visible no-op with its reason', firstTook && noWrites && repeatUnguarded, evidence);
      } finally { await c.close(); }
    },

    // RC-89 (C8, claimed P2): Daily Close announcements are multi-sentence prose. Line 222 announces 'Day closed. Deposit slip
    // prepared; day sheet frozen with chain head …' (three clauses); line 224's refusal control announces a 15-word sentence.
    // Negative control: if each announcement were one verb line (one clause, at most eight words) the counts would be 1 sentence
    // and <= 8 words and the check reports false. The refusal component's own 'verb. control' announcement (ui.js:51) is recorded
    // but not counted against dailyclose.js.
    async 'A-screens-dailyclose-1-6'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      // The front-desk half runs on a fresh store: on a store where the owner already closed, line 206 (not 224) handles the
      // press and renders the refusal without its control.
      const { c: c2, p: p2, errs: errs2 } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(200);
        const closed = await live(p);
        const closedOk = !!(await state(p)).dayCloses.find((d) => d.locationId === 'loc-1');
        await go(p2, '#/frontdesk/close');
        await click(p2, 'close.closeday'); await click(p2, 'close.closeday.confirm'); await p2.waitForTimeout(200);
        const refusalAnnounce = await live(p2);
        const code = await p2.evaluate(() => { const r = document.querySelector('.refusal'); return r ? r.dataset.code : null; });
        const ctlLabel = await txt(p2, 'refusal.control');
        const ctlPressed = await click(p2, 'refusal.control'); await p2.waitForTimeout(200);
        const controlAnnounce = await live(p2);
        const m = (s) => ({ text: s, words: words(s), sentences: sentences(s) });
        const evidence = { dayClosedWritten: closedOk, closeDayAnnouncement: m(closed), frontdeskRefusalCode: code, refusalComponentAnnouncement: m(refusalAnnounce), refusalControlLabel: ctlLabel, refusalControlPressed: ctlPressed, refusalControlAnnouncement: m(controlAnnounce), pageErrors: errs.concat(errs2) };
        const reproduced = closedOk && /^Day closed/.test(closed) && (sentences(closed) > 1 || words(closed) > 8)
          && code === 'entitlement' && ctlPressed && controlAnnounce !== refusalAnnounce && (sentences(controlAnnounce) > 1 || words(controlAnnounce) > 8);
        rec('A-screens-dailyclose-1-6', 'Close day announces three clauses and twelve words; the entitlement refusal\'s control announces a fifteen-word sentence', 'C8 (CHECKLIST): announcements are one verb line, not prose', reproduced, evidence);
      } finally { await c.close(); await c2.close(); }
    },

    // RC-90 (C3, claimed P2): the Exceptions section prints entitlement codes with underscores ('post_payment + refund'), the
    // decision result line prints the raw id 'd-1: …', and the risk row prints 'Decision d-1 …'.
    // Negative control: if the rows used human labels (no snake_case tokens) and the result line and risk row named the decision
    // in words rather than by id, the regexes would match nothing and the check reports false.
    async 'A-screens-dailyclose-1-7'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        const rows = await p.evaluate(() => [...document.querySelectorAll('section[aria-label="Expiring exceptions and open SoD findings"] .dc-row .text')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
        const codes = [...new Set(rows.flatMap((r) => r.match(/\b[a-z]+_[a-z_]+\b/g) || []))];
        // The risk row exists only while d-1 is review_due: read it before Keep.
        await hop(p, '#/compliance/risk'); await p.waitForTimeout(150);
        const riskRows = await p.evaluate(() => [...document.querySelectorAll('section[aria-label="Due now"] .dc-row .text')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
        const rawIdOnRisk = riskRows.find((r) => /\bDecision d-\d+\b/.test(r)) || null;
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        await click(p, 'close.decision.d-1.keep'); await p.waitForTimeout(150);
        // The result line's own span, without the chip's word, so "Reviewed today" cannot run into the id.
        const resultLine = await p.evaluate(() => { const els = [...document.querySelectorAll('section[aria-label^="Decisions due"] p.row')]; const e = els.find((x) => /Reviewed today/.test(x.textContent)); const sp = e ? e.querySelector(':scope > span:not(.chip)') : null; return sp ? sp.textContent.replace(/\s+/g, ' ').trim() : null; });
        const rawIdInResult = !!resultLine && /^d-1:/.test(resultLine);
        const evidence = { exceptionRows: rows, entitlementCodesOnScreen: codes, riskRowsBeforeKeep: riskRows, riskRowWithRawId: rawIdOnRisk, decisionResultLine: resultLine, rawDecisionIdInResultLine: rawIdInResult, pageErrors: errs };
        const reproduced = rows.length > 0 && codes.includes('post_payment') && codes.length >= 2 && rawIdInResult && !!rawIdOnRisk;
        rec('A-screens-dailyclose-1-7', 'Exception rows print entitlement codes (post_payment + refund, post_payment + write_off) and the decision result line prints the raw id d-1', 'C3 (CHECKLIST): no product-internal nouns or raw ids on screen unless the spec shows them', reproduced, evidence);
      } finally { await c.close(); }
    },
  };
};
