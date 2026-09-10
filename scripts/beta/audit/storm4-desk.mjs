// Round-4 fix-storm checks, owner "desk": prototype/js/screens/phone.js, moneydesk.js, checkout.js.
// Findings: money-r4-2 (what posted vs what was requested), money-r4-3 (a second statement on a balance mailed today),
// money-r4-4 / shared-day-r4-4 (the step-up pad's Enter grammar). Default position is NOT reproduced: every check carries
// its precondition values and closes its context in `finally`.
export default ({ ctx, go, hop, press, click, txt, state, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const set = (p, o) => p.evaluate((o) => window.__proto.set(o), o);
  const has = (p, t) => p.$(tid(t)).then((x) => !!x);
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.id || a.tagName; });
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const q = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const dots = (p) => q(p, '#dialogs .pindots');
  const dollars = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const req = async (p, id) => (await state(p)).approvals.find((a) => a.id === id) || null;
  // Says the requested figure and not the posted one: the print a partial approval must never make.
  const saysRequested = (text, r) => !!text && !!r && r.postedCents != null && r.postedCents !== r.amountCents && text.includes(dollars(r.amountCents)) && !text.includes(dollars(r.postedCents));

  // The $300 courtesy request on Lena Fischer, $300 collected at the window, approved by Dr. Reagan: the store settles $110.
  async function partialApproval(p) {
    await go(p, '#/biller/money');
    await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '300'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post');
    await set(p, { persona: 'frontdesk' }); await hop(p, '#/frontdesk/checkout/a-1047'); await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '300'); await click(p, 'checkout.post');
    await set(p, { persona: 'owner' }); await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals');
    await click(p, 'phone.request.ar-1.approve'); for (const d of '2468') await click(p, 'phone.stepup.' + d); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
    const r = await req(p, 'ar-1');
    const phone = { amount: await q(p, '.ph-decided .ph-amount'), done: await q(p, '.ph-done'), sentence: await q(p, '.ph-decided p.small.muted') };
    await hop(p, '#/owner/money'); await click(p, 'money.tab.approvals'); await p.waitForTimeout(120);
    const approvals = { amount: await q(p, '.wrow .amt'), sentence: await q(p, '.wrow .why') };
    await set(p, { persona: 'biller' }); await hop(p, '#/biller/board'); await hop(p, '#/biller/money'); await p.waitForTimeout(120);
    const woCard = ((await canvas(p)).match(/Write-off \$[\d,.]+ approved by/) || [null])[0];
    return { r: r && { amountCents: r.amountCents, postedCents: r.postedCents, status: r.status }, phone, approvals, woCard };
  }

  return {
    // money-r4-2 (screens' own prints): the phone's decided amount and done line, the Approvals tab amount, the write-off
    // card's approved chip and the Checkout approved chip printed the requested figure after a partial approval. Negative
    // control: postedCents 11000 (13000 in the Checkout variant) and every print carries the posted figure.
    async 'A-storm4-desk-1'(b) {
      const { c, p } = await ctx(b);
      let o = {};
      try {
        o = await partialApproval(p);
        // Checkout variant: the request is raised at the window for $200, two $140 write-offs leave $130, the approval posts $130.
        await p.goto('about:blank'); await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '200'); await click(p, 'checkout.writeoff.reason.courtesy'); await fill(p, 'checkout.amount', '210'); await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const below = await p.evaluate(() => { const prev = window.__proto.persona; window.__proto.persona = 'biller'; try { return [Proto.store.requestWriteoff('p-306', 14000, 'courtesy'), Proto.store.requestWriteoff('p-306', 14000, 'courtesy')].map((x) => x.ok); } finally { window.__proto.persona = prev; } });
        await set(p, { persona: 'owner' }); await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals');
        await click(p, 'phone.request.ar-1.approve'); for (const d of '2468') await click(p, 'phone.stepup.' + d); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
        const r2 = await req(p, 'ar-1');
        await set(p, { persona: 'frontdesk' }); await hop(p, '#/frontdesk/checkout/a-1047'); await p.waitForTimeout(150);
        const chip = ((await canvas(p)).match(/Write-off \$[\d,.]+ approved by/) || [null])[0];
        o.checkout = { below, r: r2 && { amountCents: r2.amountCents, postedCents: r2.postedCents, status: r2.status }, chip };
        const r = o.r;
        const pre = !!r && r.status === 'approved' && r.postedCents === 11000 && r.amountCents === 30000;
        const pre2 = !!r2 && r2.status === 'approved' && r2.postedCents === 13000 && r2.amountCents === 20000;
        const wrong = pre && (saysRequested(o.phone.amount, r) || saysRequested(o.phone.done, r) || !(o.phone.done || '').includes(dollars(r.postedCents)) || saysRequested(o.approvals.amount, r) || saysRequested(o.woCard, r));
        const wrong2 = pre2 && saysRequested(chip, r2);
        o.pre = pre; o.pre2 = pre2;
        rec('A-storm4-desk-1', 'After a partial approval settles $110 of a $300 request (and $130 of a $200 Checkout request), the phone\'s decided card amount or done line, the Money Desk Approvals amount, the biller\'s write-off card chip or the Checkout approved chip prints the requested figure instead of what posted', 'FIX-ROUND4 one-rule-one-owner (a decided approval prints req.postedCents ?? req.amountCents); BRIEF category 2 (phone.js decidedCard/submit, moneydesk.js approvalsTab/writeoffCard, checkout.js approved chip)',
          wrong || wrong2, o);
      } finally { await c.close(); }
    },

    // money-r4-2 (sentence half, the store's approvalSentence): the frozen sentence the phone card and the Approvals tab
    // print names the requested $300 with no posted figure beside it. Reads YES until store.js approvalSentence prints
    // postedCents; the screens print the store's sentence unchanged. Negative control: both sentences carry $110.00.
    async 'A-storm4-desk-2'(b) {
      const { c, p } = await ctx(b);
      let o = {};
      try {
        o = await partialApproval(p);
        const r = o.r; const pre = !!r && r.status === 'approved' && r.postedCents === 11000 && r.amountCents === 30000;
        o.pre = pre;
        rec('A-storm4-desk-2', 'After a partial approval settles $110 of a $300 request, the approval sentence on the phone\'s decided card or on Money Desk → Approvals reads "Write-off $300.00 …" with no $110.00 anywhere in it', 'FIX-ROUND4 one-rule-one-owner (store.approvalSentence prints what posted); BRIEF category 2 (store.js approvalSentence, printed by phone.js cardSentence and moneydesk.js approvalsTab)',
          pre && (saysRequested(o.phone.sentence, r) || saysRequested(o.approvals.sentence, r)), o);
      } finally { await c.close(); }
    },

    // money-r4-3 (screen half): the owing filter skipped only unsent rows, so an account whose statement went out today was
    // offered Raise statement again and Send mailed the same balance twice. Negative control: after Send the account is
    // off "Balances with no statement"; one row, one mail disclosure for p-306.
    async 'A-storm4-desk-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.tab.statements');
        await click(p, 'money.statement.p-306.raise'); await p.waitForTimeout(120);
        let S = await state(p); const first = S.statementsDue.find((x) => x.patientId === 'p-306') || null;
        if (first) { await click(p, 'money.statement.' + first.id + '.send'); await p.waitForTimeout(150); }
        S = await state(p); const sent = !!first && !!S.statementsDue.find((x) => x.id === first.id).sent;
        const offered = await has(p, 'money.statement.p-306.raise');
        const rowsBefore = S.statementsDue.filter((x) => x.patientId === 'p-306').map((x) => x.id + ':' + (x.sent ? 'sent' : 'open') + ':' + x.amountCents);
        let raisedAgain = null;
        if (offered) { await click(p, 'money.statement.p-306.raise'); await p.waitForTimeout(150); S = await state(p); raisedAgain = S.statementsDue.filter((x) => x.patientId === 'p-306').map((x) => x.id + ':' + (x.sent ? 'sent' : 'open') + ':' + x.amountCents); }
        const mailed = S.disclosures.filter((x) => x.patientId === 'p-306' && x.channel === 'mail').map((x) => x.recordIds).flat();
        rec('A-storm4-desk-3', 'After Raise statement → Send statement mails Lena Fischer\'s $410 balance, Money Desk → Statements lists her again under "Balances with no statement" with a live Raise statement, the way to a second statement on the same balance the same day', 'store.js sendStatement already_decided why (a second copy of the same balance) and rail.js sendStatement; BRIEF category 3 (moneydesk.js statementsTab owing filter)',
          sent && offered, { first: first && first.id, sent, offered, rowsBefore, raisedAgain, mailed, due: await p.evaluate(() => Proto.store.balances('p-306').patientDue) });
      } finally { await c.close(); }
    },

    // money-r4-4 / shared-day-r4-4: onKey ran submit on Enter from every focused element but Cancel, so Enter on a digit
    // key or Backspace approved (or missed) instead of typing. Negative control: with 2-4-6 entered, Enter on the 8 key shows
    // four dots, Enter on Backspace shows three, the request stays pending with the pad open; Enter on the display submits.
    async 'A-storm4-desk-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '300'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post');
        await set(p, { persona: 'owner' }); await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals');
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(120);
        const landing = await focused(p);
        for (const d of '246') await click(p, 'phone.stepup.' + d);
        const d0 = await dots(p);
        await press(p, 'phone.stepup.8'); await p.waitForTimeout(120);
        const afterDigit = { dots: await dots(p), status: (await req(p, 'ar-1') || {}).status, open: await has(p, 'phone.stepup.submit') };
        await press(p, 'phone.stepup.backspace'); await p.waitForTimeout(120);
        const afterBackspace = { dots: await dots(p), status: (await req(p, 'ar-1') || {}).status, open: await has(p, 'phone.stepup.submit'), hint: await q(p, '#dialogs .ph-hint') };
        // Enter off a control (the display) is the submit: with three digits it asks for four and stays open.
        let display = null;
        if (await has(p, 'phone.stepup.display')) { await press(p, 'phone.stepup.display'); await p.waitForTimeout(120); display = { dots: await dots(p), hint: await q(p, '#dialogs .ph-hint'), open: await has(p, 'phone.stepup.submit'), status: (await req(p, 'ar-1') || {}).status }; }
        await click(p, 'phone.stepup.8'); await press(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
        const final = (await req(p, 'ar-1') || {}).status;
        const pre = d0 === '•••' && afterDigit.status !== undefined;
        const breach = afterDigit.dots !== '••••' || afterDigit.status !== 'pending' || !afterDigit.open || afterBackspace.dots !== '•••' || afterBackspace.status !== 'pending' || !afterBackspace.open;
        rec('A-storm4-desk-4', 'On the phone\'s Confirm-your-PIN pad, Enter on a focused digit key or on Backspace does not activate that key but submits the PIN: with 2-4-6 entered Enter on the 8 key leaves three dots (or approves once four are in) instead of entering the digit', 'FIX-ROUND4 pad grammar rule (Enter on a focused button activates it; only Enter on the display or the submit control submits); shell.js onPadKey; docs/01 principle 11 (phone.js onKey)',
          pre && breach, { landing, d0, afterDigit, afterBackspace, display, final });
      } finally { await c.close(); }
    },
  };
};
