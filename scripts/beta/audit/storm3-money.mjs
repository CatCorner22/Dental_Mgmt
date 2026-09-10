// Round-3 fix-storm checks, owner "money": prototype/js/screens/checkout.js, moneydesk.js, rail.js, board.js.
// Findings: money-r3-3 (screen), -5 (screen), -6 (screen), -8, -9 (screen), -10; clinical-day-r3-1 (screen); shell-owner-r3-7;
// plus the focus-after-request hardening (A-storm3-money-1..9). Where the store half is another fixer's, the store verb is stubbed in the page so
// the check measures this screen's rule alone. Default position is NOT reproduced: every check carries its precondition
// values and closes its context in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const gates = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].filter((r) => r.offsetParent !== null).map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() })));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.id || a.tagName; });
  const hash = (p) => p.evaluate(() => location.hash);
  const set = (p, o) => p.evaluate((o) => window.__proto.set(o), o);
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid')));
  const badge = (p, t) => p.$eval(tid('money.tab.' + t) + ' .count', (e) => Number(e.textContent)).catch(() => null);
  const enter2 = async (p, t) => { await p.focus(tid(t)); await p.keyboard.press('Enter'); await p.waitForTimeout(120); const f1 = await focused(p); await p.keyboard.press('Enter'); await p.waitForTimeout(250); return f1; };
  const stub = (p, verb, code, verbLine, control) => p.evaluate(([v, c, vl, ct]) => { Proto.store[v] = () => Proto.store.refuse(c, vl, ct, 'Stubbed by the check so the screen\'s control is measured alone.'); }, [verb, code, verbLine, control]);
  const writeoff = async (p, amount) => { await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', amount); await click(p, 'checkout.writeoff.reason.courtesy'); };

  return {
    // money-r3-3 (screen half): the held branch requested the approval with no PIN, so the row named the persona and the PIN
    // owner could approve his own request. Negative control: ar-1.requestedById is the PIN owner (u-dr-1).
    async 'A-storm3-money-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047?device=shared');
        await writeoff(p, '200'); await fill(p, 'checkout.amount', '210'); await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.pin', '2468'); await click(p, 'checkout.post');
        const g = (await gates(p))[0] || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const S = await state(p); const req = S.approvals.find((a) => a.id === 'ar-1') || null;
        const owner = S.users.find((u) => u.pin === '2468');
        rec('A-storm3-money-1', 'On a shared desk Checkout requests the write-off approval as the persona (u-fd-1), not as the PIN owner Dr. Reagan who typed 2468', 'store.js shared-desk rule (the PIN names the poster); decideApproval blocked_same_person (checkout.js doPost held branch, requestApproval extras)',
          !!g && g.code === 'needs_second' && !!req && !!owner && req.requestedById !== owner.id, { gate: g, request: req && { id: req.id, requestedBy: req.requestedBy, requestedById: req.requestedById, eligible: req.eligible }, pinOwner: owner && owner.id, persona: S.personaUser.frontdesk });
      } finally { await c.close(); }
    },

    // money-r3-8: the render prune dropped outage and entitlement gates only, so the after_hours gate outlived the clock.
    // Negative control: after afterHours flips off, no after_hours gate stands and Post reads Post; the press posts.
    async 'A-storm3-money-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047?afterHours=1');
        await writeoff(p, '50'); await fill(p, 'checkout.amount', '360'); await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post');
        const during = (await gates(p)).map((g) => g.code);
        await set(p, { afterHours: false }); await p.waitForTimeout(200);
        const after = (await gates(p)).map((g) => g.code); const label = await txt(p, 'checkout.post');
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const S = await state(p); const posted = S.ledger.some((e) => e.patientId === 'p-306' && e.posted === S.tenant.today);
        rec('A-storm3-money-2', 'Checkout\'s after_hours write-off gate stays rendered and Post reads Held after the clock leaves after hours; the press posts nothing', 'FIX-ROUND3 stale-gate rule (clock); CONTRACTS §6 (checkout.js render prune)',
          during.includes('after_hours') && S.clock.afterHours === false && (after.includes('after_hours') || label === 'Held' || !posted), { during, after, label, posted, afterHours: S.clock.afterHours });
      } finally { await c.close(); }
    },

    // money-r3-9 (screen half): the Send statement / Payment plan body printed est.patientCents with the typed write-off
    // ignored. Negative control: with a $100 write-off typed the row reads $310.00, and the Posted card's Statement due
    // equals the store's statementsDue row.
    async 'A-storm3-money-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.collect.seg.send-statement'); await writeoff(p, '100');
        const est = await p.evaluate(() => Proto.store.windowEstimate('a-1047').patientCents);
        const grab = async (re) => ((await canvas(p)).match(re) || [null])[0];
        const rowText = await grab(/statement-due row for \$[\d,.]+/);
        await click(p, 'checkout.collect.seg.payment-plan'); await p.waitForTimeout(100);
        const planText = await grab(/Plan for \$[\d,.]+/);
        await click(p, 'checkout.collect.seg.send-statement'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const S = await state(p); const sd = S.statementsDue.filter((x) => x.patientId === 'p-306').pop() || null;
        const card = await grab(/Statement due \$[\d,.]+/);
        const dollars = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
        rec('A-storm3-money-3', 'With a $100 write-off typed beside Send statement / Payment plan, Checkout prints the pre-write-off $410.00 as the statement / plan amount, or the Posted card\'s Statement due disagrees with the statementsDue row', 'docs/13 feature 23 (numbers on screen come from the rows); CONTRACTS Posted card read-back (checkout.js paymentCard, postedCard)',
          est === 41000 && ((rowText || '').includes(dollars(41000)) || (planText || '').includes(dollars(41000)) || (!!sd && !!card && !card.includes(dollars(sd.amountCents)))), { est, rowText, planText, statementsDue: sd && { id: sd.id, amountCents: sd.amountCents }, card, balances: await p.evaluate(() => Proto.store.balances('p-306')) });
      } finally { await c.close(); }
    },

    // money-r3-10: statements() kept only rows with live patientDue > 0, so a window_deferred row on an unfiled visit was on no
    // tab and off the badge. Negative control: Ines Okoro is listed under Statements due with a waiting state, badge = rows.
    async 'A-storm3-money-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.collect.seg.send-statement'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const S = await state(p); const sd = S.statementsDue.find((x) => x.patientId === 'p-303' && !x.sent) || null;
        const card = /Statement due \$44\.00/.test(await canvas(p));
        await hop(p, '#/biller/money'); const n = await badge(p, 'statements'); await click(p, 'money.tab.statements'); await p.waitForTimeout(120);
        const due = (await canvas(p)).split('Balances with no statement')[0];
        const rows = (await testids(p)).filter((t) => /^money\.statement\.sd-\d+\.(send|chart)$/.test(t)).length;
        rec('A-storm3-money-4', 'A Send statement queued on the unfiled visit a-1044 (sd row, Posted card "Statement due $44.00") is listed nowhere on Money Desk → Statements and the badge stays 2', 'Money Desk contract: badge equals rows; a queued row is findable (moneydesk.js statements filter)',
          !!sd && card && (!/Ines Okoro/.test(due) || n !== rows), { sd: sd && { id: sd.id, amountCents: sd.amountCents, reason: sd.reason }, card, badge: n, rows, inesListed: /Ines Okoro/.test(due), waiting: /[Ww]aiting for the note/.test(due) });
      } finally { await c.close(); }
    },

    // money-r3-6 (screen half): gate() mapped no "Open Roles" / "Switch author" word, so the store's entitlement refusal fell
    // to the tab focus. The verb is stubbed so the control is measured whatever the store decides. Negative control: Roles.
    async 'A-storm3-money-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/money');
        await stub(p, 'eraPostMatched', 'entitlement', 'Issue a day pass before posting', 'Open Roles');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(120);
        const g = (await gates(p))[0] || null; const label = await txt(p, 'money.era.era-1.postmatched');
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const h = await hash(p);
        rec('A-storm3-money-5', 'On Money Desk the store\'s entitlement gate "Open Roles" on Post matched reaches no Roles route', 'CONTRACTS §6 — the control does what it says; checkout.js openRoles convention (moneydesk.js gate())',
          !!g && g.code === 'entitlement' && g.control === 'Open Roles' && !/#\/owner\/roles/.test(h), { gate: g, label, hashAfter: h });
      } finally { await c.close(); }
    },

    // shell-owner-r3-7: openAppeal() re-rendered with focus on the irreversible Send, so Enter twice on Appeal sent it.
    // Negative control: after the first Enter focus is on the drawer heading; c-88 stays denied; no disclosure row.
    async 'A-storm3-money-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/money'); await click(p, 'money.tab.denials');
        const st0 = await state(p); const before = st0.claims.find((x) => x.id === 'c-88').status;
        const f1 = await enter2(p, 'money.denial.c-88.appeal');
        const st = await state(p); const cl = st.claims.find((x) => x.id === 'c-88');
        rec('A-storm3-money-6', 'Enter twice on money.denial.c-88.appeal opens the appeal drawer and then sends it: the drawer opens with focus on money.appeal.send', 'FIX-ROUND3 Enter-twice rule; docs/01 principle 11 (moneydesk.js openAppeal focus)',
          before === 'denied' && (f1 === 'money.appeal.send' || cl.status === 'appealed'), { before, focusAfterFirstEnter: f1, after: cl.status, disclosuresDelta: st.disclosures.length - st0.disclosures.length });
      } finally { await c.close(); }
    },

    // clinical-day-r3-1 (screen half): render() footed its own estimate from S.estimates / a.balanceCents instead of the store's
    // windowEstimate. Stubbed: the store says $130 due and the form must offer Collect; live: after filing enc-9002 the segments
    // must follow whatever the store's estimate says. Negative control: Collect offered and the footer reads the store's number.
    async 'A-storm3-money-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await p.evaluate(() => { Proto.store.windowEstimate = () => ({ patientCents: 13000, insuranceCents: 13000, writeoffCents: 0, note: 'stub' }); });
        await hop(p, '#/frontdesk/checkout/a-1043'); await p.waitForTimeout(120);
        const stubbed = { segs: (await testids(p)).filter((t) => t.startsWith('checkout.collect.seg.')), footer: await p.$eval('tfoot .co-est', (e) => e.textContent.trim()).catch(() => null), amount: await p.$eval(tid('checkout.amount'), (e) => e.value).catch(() => null) };
        await p.goto('about:blank'); await go(p, '#/dentist/encounter/enc-9002');   // a fresh document drops the stub
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        await set(p, { persona: 'frontdesk' }); await hop(p, '#/frontdesk/checkout/a-1043'); await p.waitForTimeout(120);
        const live = { est: await p.evaluate(() => Proto.store.windowEstimate('a-1043')), due: await p.evaluate(() => Proto.store.balances('p-302').patientDue), segs: (await testids(p)).filter((t) => t.startsWith('checkout.collect.seg.')), footer: await p.$eval('tfoot .co-est', (e) => e.textContent.trim()).catch(() => null) };
        const stubBad = stubbed.segs.length > 0 && (!stubbed.segs.includes('checkout.collect.seg.collect') || stubbed.amount !== '130.00');
        const liveBad = !!live.est && live.est.patientCents > 0 && !live.segs.includes('checkout.collect.seg.collect');
        rec('A-storm3-money-7', 'Checkout foots its own estimate: with the store\'s windowEstimate saying $130 due for a-1043 the form pre-selects Nothing due today and the footer reads $0.00 est.', 'docs/15 one rule, one owner (store.windowEstimate); docs/13 feature 1 (checkout.js render est)',
          stubBad || liveBad, { stubbed, live });
      } finally { await c.close(); }
    },

    // money-r3-5 (screen half): an already_closed refusal's "Open the day" fell to Checkout's default (Board) and Money Desk's
    // default (the tab). Stubbed so the control is measured whatever the store decides. Negative control: both land on close.
    async 'A-storm3-money-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        await stub(p, 'postCheckout', 'already_closed', 'Open the closed day to read it', 'Open the day');
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await p.waitForTimeout(120);
        const g1 = (await gates(p))[0] || null; await click(p, 'refusal.control'); await p.waitForTimeout(200); const h1 = await hash(p);
        await go(p, '#/biller/money');
        await stub(p, 'eraPostMatched', 'already_closed', 'Open the closed day to read it', 'Open the day');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(120);
        const g2 = (await gates(p))[0] || null; await click(p, 'refusal.control'); await p.waitForTimeout(200); const h2 = await hash(p);
        rec('A-storm3-money-8', 'The store\'s already_closed gate "Open the day" on Checkout Post goes Back to Board and on Money Desk Post matched stays on the tab; neither opens Daily Close', 'CONTRACTS §6 — the control does what it says (checkout.js withControl, moneydesk.js gate())',
          !!g1 && g1.code === 'already_closed' && !!g2 && g2.code === 'already_closed' && (!/\/close$/.test(h1) || !/\/close$/.test(h2)), { checkout: { gate: g1, hash: h1 }, moneyDesk: { gate: g2, hash: h2 } });
      } finally { await c.close(); }
    },

    // Hardening: after Request approval writes the row, focus landed on the (held) Post primary. Negative control: focus rests
    // on the request stamp, not on checkout.post.
    async 'A-storm3-money-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        await writeoff(p, '200'); await fill(p, 'checkout.amount', '210'); await click(p, 'checkout.tender.cash');
        await click(p, 'checkout.post'); await p.waitForTimeout(120);
        const g = (await gates(p))[0] || null; const f1 = await focused(p);
        if (g) { await p.focus(tid('refusal.control')); await p.keyboard.press('Enter'); await p.waitForTimeout(150); }
        const f2 = await focused(p); const req = (await state(p)).approvals.length;
        rec('A-storm3-money-9', 'After Request approval writes the row, Checkout lands the keyboard on the Post primary', 'FIX-ROUND3 Enter-twice rule (checkout.js doPost held branch rerender focus)',
          !!g && g.code === 'needs_second' && req === 1 && f2 === 'checkout.post', { focusAfterPost: f1, gate: g, focusAfterRequest: f2, approvals: req });
      } finally { await c.close(); }
    },
  };
};
