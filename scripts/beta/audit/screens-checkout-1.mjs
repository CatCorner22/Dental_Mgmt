// Audit checks for prototype/js/screens/checkout.js, chunk screens-checkout-1
// (root causes RC-10, RC-23, RC-49, RC-209, RC-237, RC-243, RC-85, RC-86, RC-219, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: (r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || null,
    control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() || null,
    controls: r.querySelectorAll('[data-testid="refusal.control"]').length,
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  // Button identity as CONTRACTS §6 and B3 define it: class (irreversible | reversible | quiet | held), label, ::before glyph, fill.
  const identity = (p, tid) => p.evaluate((tid) => {
    const e = document.querySelector(`[data-testid="${tid}"]`); if (!e) return null;
    const cs = getComputedStyle(e);
    return { label: e.textContent.trim(), className: e.className, before: getComputedStyle(e, '::before').content, background: cs.backgroundColor, borderStyle: cs.borderTopStyle, held: e.classList.contains('held'), irreversible: e.classList.contains('irreversible') };
  }, tid);
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const hash = (p) => p.evaluate(() => location.hash);
  const h1 = (p) => p.evaluate(() => ((document.querySelector('#canvas h1') || document.querySelector('h1') || {}).textContent || '').trim());
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')));
  // The Checkout row of CONTRACTS §4, parsed from the file so the check follows the contract, not a copy of it.
  const s4Checkout = () => {
    const text = fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8');
    const sec = text.slice(text.indexOf('## 4.'), text.indexOf('## 5.'));
    const row = sec.split('\n').find((l) => /^\|\s*Checkout\s*\|/.test(l)) || '';
    const entries = [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    // A bare placeholder such as <procId> or <code> admits any seed id or code token (letters, digits, '-', '_'); an enumerated one is exact.
    const patterns = entries.map((e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+') + '$'));
    return { row: row.trim(), entries, patterns };
  };
  const RAW_ID = /\b(le|enc|cd|pr|sd|pp|ai|al|de|ar)-\d+\b/g;

  return {
    // RC-10 · A2, C2 · checkout.js:51 withControl's default branch wires every code it does not name to Proto.router.go(persona, 'board');
    // store.js:94 supplies the already_decided control label "Open the ledger".
    // Negative control: when the control does what it says, the hash after the tap is #/frontdesk/ledger/p-307 (Devon Price) and the h1 names
    // the ledger; then hashAfter matches /\/ledger\// and the check reports false. Only the already_decided refusal (data-code) is scored, and the
    // control's label must itself say "ledger" — a Board label routing to the Board would be consistent and not a breach.
    async 'A-screens-checkout-1-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1050');
        const before = await p.evaluate(() => { const S = window.__proto.state(); const a = S.appointments.find((x) => x.id === 'a-1050'); return { status: a.status, patientId: a.patientId, decisionsForEncounter: S.collectionDecisions.filter((d) => d.encounterId === a.encounterId).map((d) => d.id), segPressed: [...document.querySelectorAll('[data-testid^="checkout.collect.seg."]')].map((e) => e.getAttribute('data-testid') + '=' + e.getAttribute('aria-pressed')) }; });
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'already_decided');
        const controlLabel = await txt(p, 'refusal.control');
        const hashBefore = await hash(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const hashAfter = await hash(p); const heading = await h1(p);
        const ev = await after(p, seq0);
        const expectedHash = '#/frontdesk/ledger/' + before.patientId;
        const reproduced = dom.length > 0 && /ledger/i.test(controlLabel || '') && !/\/ledger\//.test(hashAfter);
        rec('A-screens-checkout-1-1', 'On an already checked-out visit (a-1050) Post raises already_decided whose one control reads "Open the ledger", and tapping it opens the Board', 'A2, C2 — the control does what its label says; checkout.js:51 routes every unnamed code to board',
          reproduced, { appointmentBefore: before, alreadyDecidedRefusals: dom, controlLabel, hashBefore, hashAfter, expectedHash, h1AfterControl: heading, refusalEvents: refusalEvents(ev), routeEvents: ev.filter((e) => e.kind === 'route').map((e) => ({ seq: e.seq, route: e.route })), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-23 · A2 · checkout.js:19 cents() strips everything but digits and '.', so '0', '', 'abc' → 0 and '-50' → 5000; store.js:110
    // `form.amountCents || est.patientCents` then posts the estimate when the form says 0.
    // Negative control: a correct Post refuses a non-positive amount (a refusal event, no ledger write; the blur hint already says "Enter an
    // amount above $0") and posts a negative entry as nothing or as a refusal; then every case has zero payments written or a refusal event and
    // the check reports false. Each case runs in a fresh context (one Post per visit); the amount the form actually held is read from
    // Proto.screens.checkout.state so a fill that did not take is visible in the evidence rather than scored.
    async 'A-screens-checkout-1-2'(b) {
      const cases = [];
      for (const input of ['0', '', 'abc', '-50', '1e3']) {
        const { c, p } = await ctx(b);
        try {
          await go(p, '#/frontdesk/checkout/a-1044');
          await click(p, 'checkout.tender.cash');
          await fill(p, 'checkout.amount', input);
          const held = await p.evaluate(() => ({ amountStr: (Proto.screens.checkout.state['a-1044'] || {}).amountStr, fieldValue: (document.querySelector('[data-testid="checkout.amount"]') || {}).value }));
          const seq0 = await lastSeq(p);
          await click(p, 'checkout.post'); await p.waitForTimeout(200);
          const ev = await after(p, seq0);
          const post = await p.evaluate(() => { const S = window.__proto.state(); const st = Proto.screens.checkout.state['a-1044'] || {}; return { formAmountCents: st.posted && st.posted.form ? st.posted.form.amountCents : null, payments: S.ledger.filter((e) => e.kind === 'patient_payment' && e.patientId === 'p-303' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, tender: e.tender })), decisions: S.collectionDecisions.filter((d) => d.encounterId === 'enc-9003').length, postedCardFirstLine: ((document.querySelector('.co-posted li') || {}).textContent || '').trim() || null }; });
          cases.push({ input, amountStrInForm: held.amountStr, fieldValue: held.fieldValue, formAmountCents: post.formAmountCents, paymentsWritten: post.payments, decisionsWritten: post.decisions, refusalEvents: refusalEvents(ev), writes: writes(ev), postedCardFirstLine: post.postedCardFirstLine, seqRange: range(ev, seq0) });
        } finally { await c.close(); }
      }
      const nonPositive = (s) => !(Number(s) > 0); // what the user typed, read plainly
      const badPosts = cases.filter((k) => k.amountStrInForm === k.input && nonPositive(k.input) && k.paymentsWritten.length > 0 && k.refusalEvents.length === 0);
      const negativeFlipped = cases.find((k) => k.input === '-50' && k.amountStrInForm === '-50' && k.paymentsWritten.some((x) => x.amountCents === -5000));
      const reproduced = badPosts.length > 0;
      rec('A-screens-checkout-1-2', 'With Collect and Cash, an Amount of 0, blank or text posts the $44.00 estimate as a payment with no refusal, and -50 posts a +$50.00 payment', 'A2 — Post writes the amount the user entered or refuses; checkout.js:19 cents() and store.js:110 `|| est.patientCents`',
        reproduced, { estimatePatientCents: 4400, cases, badPosts: badPosts.map((k) => ({ input: k.input, paymentsWritten: k.paymentsWritten })), negativeFlippedToPositive: !!negativeFlipped });
    },

    // RC-49 · B1 · checkout.js:118 (checkout.estimate.why), :151 (checkout.plan.cadence.*), :208 (checkout.receipt), :239 (checkout.rail) render
    // clickable elements whose test ids are not in the Checkout row of CONTRACTS §4.
    // Negative control: when every rendered checkout.* id matches a §4 entry or pattern, notInContract is empty and the check reports false.
    // The §4 row is parsed from CONTRACTS.md at run time (entries and derived patterns are in the evidence), and every id is collected from
    // reachable states by driving the screen, not from the source.
    async 'A-screens-checkout-1-3'(b) {
      const { c, p } = await ctx(b);
      try {
        const seen = new Map(); // id -> first state it was seen in
        const collect = async (label) => { for (const id of await testids(p)) if (id.startsWith('checkout.') && !seen.has(id)) seen.set(id, label); };
        await go(p, '#/frontdesk/checkout/a-1047?device=shared'); await collect('a-1047 shared, landing');
        await click(p, 'checkout.tender.card'); await collect('after checkout.tender.card');
        await click(p, 'checkout.writeoff.add'); await collect('after checkout.writeoff.add');
        await click(p, 'checkout.collect.seg.payment-plan'); await collect('after checkout.collect.seg.payment-plan');
        await click(p, 'checkout.explain'); await collect('after checkout.explain');
        // The device setting persists across a reload, so the desk is named explicitly; on a shared desk Post would stop at pin_required.
        await go(p, '#/frontdesk/checkout/a-1046?device=desk'); await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await p.waitForTimeout(200); await collect('a-1046 desk after checkout.post');
        const posted = await p.evaluate(() => !!document.querySelector('.co-posted'));
        const { row, entries, patterns } = s4Checkout();
        const ids = [...seen.keys()].sort();
        const notInContract = ids.filter((id) => !patterns.some((re) => re.test(id))).map((id) => ({ id, firstSeenIn: seen.get(id) }));
        const clickable = await p.evaluate((ids) => ids.map((id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e ? id + ':' + e.tagName.toLowerCase() : id + ':not-on-final-screen'; }), notInContract.map((x) => x.id));
        const reproduced = entries.length > 0 && notInContract.length > 0;
        rec('A-screens-checkout-1-3', 'Checkout renders clickable controls whose test ids (checkout.estimate.why, checkout.plan.cadence.*, checkout.receipt, checkout.rail) are not in CONTRACTS §4', 'B1 — every id in the DOM matches a §4 entry or pattern',
          reproduced, { s4RowSearched: row, s4Entries: entries, s4Patterns: patterns.map(String), idsRendered: ids, notInContract, notInContractTags: clickable, postedCardReached: posted });
      } finally { await c.close(); }
    },

    // RC-209 · B2, B3 · checkout.js:184 postRow renders Post with kind 'irreversible' whenever no needs_second/after_hours request is pending,
    // so under tender_required, pin_required, already_decided and outage the gated primary keeps the filled ▮ identity while the refusal is on screen.
    // Negative control: a compliant gate leaves checkout.post with class held, ::before "🔒" and the word Held (as it does under needs_second,
    // measured here as the contrast case); then irreversible is false for every gated case and the check reports false. A case is scored only
    // when a refusal with the expected data-code is on screen at the moment the primary is read.
    async 'A-screens-checkout-1-4'(b) {
      const CASES = [
        { code: 'tender_required', hash: '#/frontdesk/checkout/a-1044', steps: [] },
        { code: 'pin_required', hash: '#/frontdesk/checkout/a-1044?device=shared', steps: ['checkout.tender.card'] },
        { code: 'already_decided', hash: '#/frontdesk/checkout/a-1050', steps: [] },
        { code: 'outage', hash: '#/frontdesk/checkout/a-1044?outage=1', steps: ['checkout.tender.card'] },
      ];
      const results = [];
      for (const k of CASES) {
        const { c, p } = await ctx(b);
        try {
          await go(p, k.hash);
          const before = await identity(p, 'checkout.post');
          for (const s of k.steps) await click(p, s);
          const seq0 = await lastSeq(p);
          await click(p, 'checkout.post'); await p.waitForTimeout(150);
          const dom = (await refusalsDom(p)).filter((d) => d.code === k.code);
          const primary = await identity(p, 'checkout.post');
          const ev = await after(p, seq0);
          results.push({ code: k.code, start: k.hash, refusalOnScreen: dom.length > 0, refusal: dom[0] || null, primaryBefore: before, primaryUnderGate: primary, refusalEvents: refusalEvents(ev), seqRange: range(ev, seq0) });
        } finally { await c.close(); }
      }
      // Contrast: the one gate this screen does switch to Held (needs_second on a $410 write-off).
      let contrast = null;
      { const { c, p } = await ctx(b);
        try {
          await go(p, '#/frontdesk/checkout/a-1047');
          await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '410'); await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.tender.cash');
          await click(p, 'checkout.post'); await p.waitForTimeout(200);
          contrast = { code: 'needs_second', refusal: ((await refusalsDom(p)).filter((d) => d.code === 'needs_second'))[0] || null, primaryUnderGate: await identity(p, 'checkout.post') };
        } finally { await c.close(); } }
      const breached = results.filter((r) => r.refusalOnScreen && r.primaryUnderGate && r.primaryUnderGate.irreversible && !r.primaryUnderGate.held);
      const reproduced = breached.length > 0;
      rec('A-screens-checkout-1-4', 'While tender_required, pin_required, already_decided or outage is on screen, checkout.post keeps the label Post, class irreversible and the filled ▮ glyph instead of switching to the Held identity', 'B2, B3 / CONTRACTS §6 — the primary never dims, it switches to the Held identity (outlined, lock glyph, the word Held); checkout.js:184',
        reproduced, { gatedCases: results, casesBreached: breached.map((r) => r.code), contrastNeedsSecond: contrast, viewport: '1280x900' });
    },

    // RC-237 · C5, A7 · checkout.js:231 est = S.estimates[aid] (seed.js:132 literal 41000) and :23 fresh() prefills Collect from est.patientCents;
    // neither is re-derived from the ledger, so after the $410 write-off is approved and posted the screen still offers to collect $410.
    // Negative control: once the ledger carries the −$410 write-off and Patient due reads $0.00, a screen computed from state foots $0.00 est.,
    // prefills 0.00 (or lands on Nothing due today) and has no live Post for $410; then estFoot does not contain $410.00 and the check reports
    // false. The check first requires the approval to have posted (approval status approved, a write_off ledger row of −41000 for p-306,
    // store balances patientDue 0) before it scores the checkout screen — a write-off that never posted is a different failure.
    async 'A-screens-checkout-1-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/checkout/a-1047');
        const beforeScreen = await p.evaluate(() => ({ threeNumbers: [...document.querySelectorAll('.threenum .n')].map((n) => n.textContent.trim()), estFoot: ((document.querySelector('.co-lines tfoot .co-est') || {}).textContent || '').trim(), amount: (document.querySelector('[data-testid="checkout.amount"]') || {}).value, postLabel: ((document.querySelector('[data-testid="checkout.post"]') || {}).textContent || '').trim(), balances: Proto.store.balances('p-306') }));
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        await click(p, 'refusal.control'); await p.waitForTimeout(120);
        const req = await p.evaluate(() => { const a = window.__proto.state().approvals[0]; return a ? { id: a.id, amountCents: a.amountCents, reason: a.reason, status: a.status, requestedBy: a.requestedBy } : null; });
        await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const persona = await p.evaluate(() => window.__proto.persona);
        const seq0 = await lastSeq(p);
        if (req) { await click(p, 'phone.request.' + req.id + '.approve'); for (const d of ['2', '4', '6', '8']) await click(p, 'phone.stepup.' + d); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(250); }
        const ev = await after(p, seq0);
        const approved = await p.evaluate(() => { const S = window.__proto.state(); const a = S.approvals[0] || {}; return { status: a.status, decidedBy: a.decidedBy, writeoffRows: S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, reason: e.reason, approvalRequestId: e.approvalRequestId })), balances: Proto.store.balances('p-306') }; });
        await hop(p, '#/biller/checkout/a-1047'); await p.waitForTimeout(200);
        const screen = await p.evaluate(() => ({ h1: ((document.querySelector('#canvas h1') || {}).textContent || '').trim(), threeNumbers: [...document.querySelectorAll('.threenum .n')].map((n) => n.textContent.trim()), patientDueText: ((document.querySelector('.threenum .n .v') || {}).textContent || '').trim(), estFoot: ((document.querySelector('.co-lines tfoot .co-est') || {}).textContent || '').trim(), lineEstimates: [...document.querySelectorAll('.co-lines tbody .co-est')].map((e) => e.textContent.trim()), amount: (document.querySelector('[data-testid="checkout.amount"]') || {}).value, segPressed: [...document.querySelectorAll('[data-testid^="checkout.collect.seg."]')].map((e) => e.getAttribute('data-testid') + '=' + e.getAttribute('aria-pressed')), postLabel: ((document.querySelector('[data-testid="checkout.post"]') || {}).textContent || '').trim(), postClass: (document.querySelector('[data-testid="checkout.post"]') || {}).className, writeoffBlock: ((document.querySelector('.co-writeoff, .card.stack[aria-label="Payment"] .row') || {}).textContent || '').trim().slice(0, 160), estimateInStore: window.__proto.state().estimates['a-1047'], balances: Proto.store.balances('p-306') }));
        const posted = approved.status === 'approved' && approved.writeoffRows.some((r) => r.amountCents === -41000) && approved.balances.patientDue === 0;
        const reproduced = posted && /\$410\.00/.test(screen.estFoot) && screen.amount === '410.00' && screen.postLabel === 'Post' && screen.segPressed.includes('checkout.collect.seg.collect=true');
        rec('A-screens-checkout-1-5', 'After the $410 courtesy write-off on Lena Fischer is approved and on the ledger (Patient due $0.00), Checkout a-1047 still foots "$410.00 est.", prefills Collect 410.00 and offers a live Post', 'C5, A7 — one canonical value per fact; a number on screen is computed from state; checkout.js:231 and :23 read the seed estimate literal',
          reproduced, { screenBeforeWriteoff: beforeScreen, approvalRequest: req, personaOnPhone: persona, approvalAfterStepup: approved, writeoffPosted: posted, screenAfterApproval: screen, approvalEvents: { writes: writes(ev), refusals: refusalEvents(ev), seqRange: range(ev, seq0) } });
      } finally { await c.close(); }
    },

    // RC-243 · C5, B4 · checkout.js:9 NEEDS_ATTACHMENT = {d4341, d2740} and board.js:18 ATTACHMENT_CDT = ['d2740','d4341','d7210'] are two tables;
    // a filed D7210 (surgical extraction) is "Needs: attachment" on the Board queue row and "Claim ready" / "Ready" on Checkout for the same visit.
    // Negative control: one shared rule gives the same answer on both screens — both say attachment needed, or both say ready; then
    // boardSaysAttachment === checkoutSaysAttachment and the check reports false. The note must have filed (filedNotes for enc-9020, pr-500
    // status completed) before the chips are scored; a File that did not happen leaves the queue row in the Held state and is not this defect.
    async 'A-screens-checkout-1-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/surgeon/exams');
        await click(p, 'exams.row.enc-9020.open'); await p.waitForTimeout(200);
        await click(p, 'enc.tooth.17'); await click(p, 'enc.proc.d7210'); await p.waitForTimeout(150);
        await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(150);
        const gate = (await refusalsDom(p)).map((d) => d.code);
        const seq0 = await lastSeq(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const filed = await p.evaluate(() => { const S = window.__proto.state(); return { filedNotes: S.filedNotes.filter((n) => n.encounterId === 'enc-9020').map((n) => n.id), a1060status: (S.appointments.find((a) => a.id === 'a-1060') || {}).status, procs: S.procedures.filter((x) => x.encounterId === 'enc-9020').map((x) => ({ id: x.id, cdt: x.cdt, status: x.status })) }; });
        await hop(p, '#/surgeon/board'); await p.waitForTimeout(200);
        const boardChips = await p.evaluate(() => { const row = document.querySelector('[data-testid="board.queue.row.a-1060"]'); return row ? [...row.querySelectorAll('.chip')].map((e) => e.textContent.trim()) : null; });
        await hop(p, '#/surgeon/checkout/a-1060'); await p.waitForTimeout(200);
        const co = await p.evaluate(() => ({ h1: ((document.querySelector('#canvas h1') || {}).textContent || '').trim(), statusChips: [...document.querySelectorAll('.co-page > .row .chip')].map((e) => e.textContent.trim()), lineChips: [...document.querySelectorAll('[data-testid^="checkout.line."]')].filter((tr) => tr.tagName === 'TR').map((tr) => tr.getAttribute('data-testid') + ': ' + [...tr.querySelectorAll('.chip')].map((e) => e.textContent.trim()).join('|')) }));
        const boardSaysAttachment = Array.isArray(boardChips) && boardChips.some((t) => /attachment/i.test(t));
        const checkoutSaysAttachment = co.statusChips.some((t) => /pre-flight|attachment/i.test(t)) || co.lineChips.some((t) => /attachment/i.test(t));
        const reproduced = filed.filedNotes.length === 1 && filed.procs.some((x) => x.cdt === 'd7210' && x.status === 'completed') && boardChips !== null && boardSaysAttachment !== checkoutSaysAttachment;
        rec('A-screens-checkout-1-6', 'After the surgeon files a D7210 on enc-9020, the Board queue row for a-1060 says "Needs: attachment" while Checkout for the same visit says "Claim ready" and the D7210 line "Ready"', 'C5, B4 — one rule, one answer on both screens; checkout.js:9 and board.js:18 are separate tables',
          reproduced, { readbackGateCodes: gate, filed, boardQueueChips: boardChips, checkoutH1: co.h1, checkoutStatusChips: co.statusChips, checkoutLineChips: co.lineChips, boardSaysAttachment, checkoutSaysAttachment, writesAtFile: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-85 · C3 · checkout.js:194-200 postedCard appends storage row ids (le-, enc-, cd-, pr-, sd-, pp-) to every line; :81/:182 put the
    // request id in the announcement and the held chip; :154 prints the reason code zero_due in prose.
    // Negative control: a posted card whose lines carry only human labels (kind, amount, tender, procedure name) has no token matching
    // /\b(le|enc|cd|pr|sd|pp|ai|al|de|ar)-\d+\b/; then rawIdsOnPostedCard is empty and the check reports false. Post must have succeeded
    // (the .co-posted card is on screen and a collectionDecisions write is in the seq range) before the card text is scored.
    async 'A-screens-checkout-1-7'(b) {
      const { c, p } = await ctx(b);
      let heldEvidence = null, zeroProse = null;
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242');
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const posted = await p.evaluate(() => ({ cardPresent: !!document.querySelector('.co-posted'), lines: [...document.querySelectorAll('.co-posted li')].map((e) => e.textContent.trim()), announcement: ((document.getElementById('live') || {}).textContent || '').trim() }));
        const rawIdsOnPostedCard = [...new Set(posted.lines.join(' ').match(RAW_ID) || [])];
        // Held path: the request id in the announcement and the chip.
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '410'); await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        heldEvidence = await p.evaluate(() => ({ announcement: ((document.getElementById('live') || {}).textContent || '').trim(), chips: [...document.querySelectorAll('.co-postrow .chip')].map((e) => e.textContent.trim()) }));
        heldEvidence.rawIds = [...new Set((heldEvidence.announcement + ' ' + heldEvidence.chips.join(' ')).match(RAW_ID) || [])];
        // Zero-portion prose with the reason code.
        await go(p, '#/frontdesk/checkout/a-1045');
        zeroProse = await p.evaluate(() => [...document.querySelectorAll('.card.stack[aria-label="Payment"] p.muted')].map((e) => e.textContent.trim()).find((t) => /zero_due|reason/.test(t)) || null);
        const reproduced = posted.cardPresent && ev.some((e) => e.kind === 'write' && e.table === 'collectionDecisions') && rawIdsOnPostedCard.length > 0;
        rec('A-screens-checkout-1-7', 'The Posted card on Checkout prints storage row ids (le-5000, enc-9003, cd-1) on its lines; the held path announces "Request ar-1" and the $0 prose prints the code zero_due', 'C3 — no raw ids or product-internal codes on screen unless the spec shows them; checkout.js:194-200, :81, :182, :154',
          reproduced, { postedCard: posted, rawIdsOnPostedCard, writesAtPost: writes(ev), seqRange: range(ev, seq0), heldPath: heldEvidence, zeroPortionProse: zeroProse, internalCodeInProse: !!zeroProse && /zero_due/.test(zeroProse) });
      } finally { await c.close(); }
    },

    // RC-86 · B4 · checkout.js:10 labels contractual_ppo "Contractual PPO"; phone.js:16 labels the same code "Contractual (PPO)" on the card that
    // approves it; store.js:62 explain() prints "contractual write-off … (contractual ppo)" on Checkout's own Explain panel.
    // Negative control: one canonical label — the reason button on Checkout, the phone card's reason line and the Explain sentence all carry the
    // same words for contractual_ppo; then distinctLabels has one entry and the check reports false. The held request must carry reason
    // contractual_ppo (read from the store) so the phone line being compared is the label for the same code the Checkout button set.
    async 'A-screens-checkout-1-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.writeoff.add');
        const checkoutLabels = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="checkout.writeoff.reason."]')].map((e) => [e.getAttribute('data-testid').replace('checkout.writeoff.reason.', ''), e.textContent.replace(/^✓/, '').trim()]));
        await fill(p, 'checkout.writeoff.amount', '410'); await click(p, 'checkout.writeoff.reason.contractual_ppo'); await click(p, 'checkout.tender.cash');
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const req = await p.evaluate(() => { const a = window.__proto.state().approvals[0]; return a ? { id: a.id, reason: a.reason, amountCents: a.amountCents, frozenSentence: a.frozenSentence } : null; });
        await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const phone = await p.evaluate((id) => { const card = document.querySelector('[data-req="' + id + '"]'); return card ? { reasonLine: ((card.querySelector('.ph-head .small.muted') || {}).textContent || '').trim(), sentence: ((card.querySelector('.ph-sentence') || {}).textContent || '').trim() } : null; }, req ? req.id : 'none');
        // Decision-status wording on the phone (Decline → Sent back) and on Checkout (declined by).
        let decided = null;
        if (req) { await click(p, 'phone.request.' + req.id + '.decline'); await fill(p, 'phone.request.' + req.id + '.reason', 'appeal first'); await click(p, 'phone.request.' + req.id + '.decline'); await p.waitForTimeout(200);
          decided = await p.evaluate(() => ({ status: (window.__proto.state().approvals[0] || {}).status, phoneChip: ((document.querySelector('.ph-decided .chip') || {}).textContent || '').trim(), phoneDone: ((document.querySelector('.ph-done') || {}).textContent || '').trim() })); }
        await hop(p, '#/frontdesk/checkout/a-1047'); await p.waitForTimeout(200);
        await click(p, 'checkout.explain'); await p.waitForTimeout(150);
        const co = await p.evaluate(() => ({ statusChips: [...document.querySelectorAll('.co-postrow .chip')].map((e) => e.textContent.trim()), explainSentences: [...document.querySelectorAll('.explain .sentence')].map((e) => e.textContent.trim()), storeExplain: Proto.store.explain('p-306').map((s) => s.sentence) }));
        const checkoutLabel = (checkoutLabels.find((x) => x[0] === 'contractual_ppo') || [])[1] || null;
        const phoneLabel = phone && phone.reasonLine ? phone.reasonLine.replace(/\s*write-off.*$/i, '').trim() : null;
        const explainPhrase = (co.explainSentences.join(' ').match(/contractual write-off[^;]*?\([^)]*\)/i) || [null])[0];
        const distinctLabels = [...new Set([checkoutLabel, phoneLabel, explainPhrase && (explainPhrase.match(/\(([^)]*)\)/) || [])[1]].filter(Boolean))];
        const reproduced = !!req && req.reason === 'contractual_ppo' && !!checkoutLabel && !!phoneLabel && checkoutLabel !== phoneLabel;
        rec('A-screens-checkout-1-8', 'The reason code contractual_ppo reads "Contractual PPO" on the Checkout button that sets it, "Contractual (PPO)" on the phone card that approves it, and "(contractual ppo)" in the Explain sentence', 'B4 — one canonical word per concept across screens, refusals and announcements; checkout.js:10, phone.js:16, store.js:62',
          reproduced, { checkoutReasonLabels: checkoutLabels, heldRequest: req, phoneCard: phone, checkoutLabel, phoneLabel, explainPhraseOnCheckout: explainPhrase, distinctLabels, decisionWording: { phone: decided, checkoutChips: co.statusChips }, explainSentencesOnScreen: co.explainSentences, storeExplain: co.storeExplain });
      } finally { await c.close(); }
    },

    // RC-219 · B1 · checkout.js:167 gives the "Remove write-off" control the same testid as the add control (checkout.js:162), so after one
    // press the only element with data-testid checkout.writeoff.add reads "Remove write-off" and a second press closes the form it opened.
    // Negative control: a compliant screen carries checkout.writeoff.add only on the add control; after the press the remove control has a
    // different id (or the id is gone) and pressing checkout.writeoff.add again is a no-op; then textAfterFirstPress does not match /remove/i and
    // the check reports false. The first press must have opened the form (checkout.writeoff.amount present) before the second is scored.
    async 'A-screens-checkout-1-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044?device=desk');
        const read = () => p.evaluate(() => { const els = [...document.querySelectorAll('[data-testid="checkout.writeoff.add"]')]; return { count: els.length, texts: els.map((e) => e.textContent.trim()), pressed: els.map((e) => e.getAttribute('aria-pressed')), classes: els.map((e) => e.className), formOpen: !!document.querySelector('[data-testid="checkout.writeoff.amount"]'), removeIdPresent: !!document.querySelector('[data-testid="checkout.writeoff.remove"]') }; });
        const before = await read();
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.writeoff.add'); await p.waitForTimeout(120);
        const afterFirst = await read();
        await click(p, 'checkout.writeoff.add'); await p.waitForTimeout(120);
        const afterSecond = await read();
        const ev = await after(p, seq0);
        const reproduced = before.count === 1 && /^add/i.test(before.texts[0] || '') && afterFirst.formOpen && afterFirst.count === 1 && /remove/i.test(afterFirst.texts[0] || '') && afterSecond.formOpen === false;
        rec('A-screens-checkout-1-9', 'After one press of checkout.writeoff.add the only element with that id reads "Remove write-off" (aria-pressed true), and a second press of the same id removes the form the first opened', 'B1 — screen.object[.id].control: the control segment names what the control does; one id, one verb; checkout.js:162 and :167',
          reproduced, { before, afterFirstPress: afterFirst, afterSecondPress: afterSecond, clickEvents: ev.filter((e) => e.kind === 'click').map((e) => ({ seq: e.seq, testid: e.testid })), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
