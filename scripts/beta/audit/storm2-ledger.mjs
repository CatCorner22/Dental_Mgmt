// Round-2 fix-storm checks, owner "ledger": moneydesk-ledger-r2-1..14 plus the two sub-cap items (device flip leaves a stale
// PIN gate; Fix on an appealed claim), the store-owned redacted approval sentence and the store items other fixers asked for.
// Files: prototype/js/store.js, seed.js, screens/moneydesk.js, screens/rail.js. Default position is NOT reproduced: every check
// measures the breach it claims, carries its precondition values, and closes its browser context in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const enter2 = async (p, t) => { if (!(await p.$(tid(t)))) return false; await p.focus(tid(t)); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.waitForTimeout(250); return true; };
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const since = async (p, seq0, kind) => (await events(p)).filter((e) => e.seq > seq0 && e.kind === kind).map((e) => e.testid || e.code);
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => b.textContent.trim()) })));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName; });
  const tab = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid^="money.tab."]')].filter((e) => e.getAttribute('aria-selected') === 'true').map((e) => e.getAttribute('data-testid')));
  const badge = (p, t) => p.$eval(tid('money.tab.' + t) + ' .count', (e) => Number(e.textContent)).catch(() => null);
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid')));
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const value = (p, t) => p.$eval(tid(t), (e) => e.value).catch(() => null);
  const set = (p, o) => p.evaluate((x) => window.__proto.set(x), o);
  const primary = (t) => /\.(confirm|dispute|send|post|postmatched)$/.test(t || '');

  return {
    // r2-1: after Confirm the screen focused the next delta's Confirm, so a keyboard repeat posted a line nobody read.
    // Negative control: two Enters decide el-14 alone (two rows), el-22 stays delta and focus is on no primary.
    async 'A-storm2-ledger-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        const n0 = (await state(p)).ledger.length; const seq0 = await lastSeq(p);
        const pressed = await enter2(p, 'money.era.line.el-14.confirm');
        const S = await state(p); const st = (id) => S.eraLines.find((l) => l.id === id).status;
        const o = { pressed, clicks: await since(p, seq0, 'click'), el14: st('el-14'), el22: st('el-22'), ledgerDelta: S.ledger.length - n0, focused: await focused(p) };
        rec('A-storm2-ledger-1', 'Enter twice on money.era.line.el-14.confirm decides el-14 and then posts el-22: the re-render hands focus to the next Confirm inside the same key sequence', 'docs/01 principle 9 (one typed decision per posting); FIX-ROUND2 focus-after-action rule; moneydesk.js handleLine',
          pressed && o.el14 === 'posted' && (o.el22 !== 'delta' || o.ledgerDelta > 2 || primary(o.focused)), o);
      } finally { await c.close(); }
    },

    // r2-2: Money Desk and the Ledger built PIN gates without `fresh`, so the second miss was never logged, and pin_locked's
    // Close focused the PIN field with the failed digits still in it. Negative control: three gates, three refusal events,
    // Close empties the PIN and the lock gate is gone from the page (both screens).
    async 'A-storm2-ledger-2'(b) {
      const { c, p } = await ctx(b);
      try {
        const run = async (route, pinId, sendId) => {
          await go(p, route); if (route.includes('money')) await click(p, 'money.tab.statements');
          const seq0 = await lastSeq(p); let shown = 0;
          for (const pin of ['0000', '9999', '1234']) { await fill(p, pinId, pin); await click(p, sendId); await p.waitForTimeout(120); if ((await refusals(p)).some((r) => /^pin_/.test(r.code))) shown++; }
          const ev = await since(p, seq0, 'refusal');
          const locked = (await refusals(p)).find((r) => r.code === 'pin_locked') || null;
          await click(p, 'refusal.control'); await p.waitForTimeout(150);
          return { shown, refusalEvents: ev, lockedControls: locked && locked.controls, afterClose: { gates: (await refusals(p)).map((r) => r.code), pin: await value(p, pinId), focused: await focused(p) } };
        };
        const money = await run('#/biller/money?device=shared', 'money.pin', 'money.statement.sd-1.send');
        const ledger = await run('#/biller/ledger/p-306?device=shared', 'ledger.pin', 'ledger.statement.send');
        const bad = (o) => o.shown === 3 && (o.refusalEvents.filter((x) => /^pin_/.test(x)).length < 3 || o.afterClose.gates.includes('pin_locked') || (o.afterClose.pin || '') !== '');
        rec('A-storm2-ledger-2', 'Three wrong PINs on money.pin / ledger.pin show three gates but log two refusals (the second miss is unlogged), and the pin_locked control "Close" leaves the lock gate standing with the failed PIN in the field', 'docs/01 principle 5 (every refusal is an event); ui.js refusal `fresh`; checkout.js pin_locked convention; moneydesk.js gate(), rail.js storeGate()',
          (money.shown === 3 || ledger.shown === 3) && (bad(money) || bad(ledger)), { money, ledger });
      } finally { await c.close(); }
    },

    // r2-3: after Raise statement the screen focused the new row's Send, so a keyboard repeat mailed the statement.
    // Negative control: two Enters raise sd-3 and leave it unsent with no disclosure; focus is on no primary.
    async 'A-storm2-ledger-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.tab.statements'); await p.waitForTimeout(120);
        const seq0 = await lastSeq(p);
        const pressed = await enter2(p, 'money.statement.p-306.raise');
        const S = await state(p); const sd = S.statementsDue.filter((x) => x.patientId === 'p-306');
        const o = { pressed, raised: sd.map((x) => x.id + ':' + (x.sent ? 'sent' : 'open')), clicks: await since(p, seq0, 'click'), disclosures: S.disclosures.length, focused: await focused(p) };
        rec('A-storm2-ledger-3', 'Enter twice on money.statement.p-306.raise raises the statement and then sends it: the raise re-renders with focus on the irreversible Send', 'docs/01 principle 9; CONTRACTS §4 (.raise reversible, .send irreversible); FIX-ROUND2 focus-after-action rule; moneydesk.js statementsTab',
          pressed && sd.length >= 1 && (sd.some((x) => x.sent) || primary(o.focused)), o);
      } finally { await c.close(); }
    },

    // r2-4: the after_hours control "Set aside" fell to gate()'s default (ERA tab) and set nothing aside.
    // Negative control: the press holds el-14 (status held, claimEvents row) and the gate is gone.
    async 'A-storm2-ledger-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money?afterHours=1'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        await click(p, 'money.era.line.el-14.confirm'); await p.waitForTimeout(150);
        const g = (await refusals(p)).find((r) => r.code === 'after_hours') || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const o = { gate: g, el14: (await state(p)).eraLines.find((l) => l.id === 'el-14').status, gatesAfter: (await refusals(p)).map((r) => r.code), focused: await focused(p) };
        rec('A-storm2-ledger-4', 'Under afterHours the Confirm gate on el-14 offers "Set aside" and pressing it sets nothing aside: el-14 stays a delta, the gate stays, focus lands on money.tab.era', 'CONTRACTS §6 after_hours (the control names the next step and does it); moneydesk.js gate() default onControl',
          !!g && g.controls.includes('Set aside') && (o.el14 !== 'held' || o.gatesAfter.includes('after_hours')), o);
      } finally { await c.close(); }
    },

    // r2-5: the Ledger kept an outage gate after the outage ended. Negative control: on the next render the gate is gone
    // and Send reads its verb, not Held.
    async 'A-storm2-ledger-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-306'); await set(p, { outage: true }); await click(p, 'ledger.statement.send'); await p.waitForTimeout(150);
        const during = (await refusals(p)).map((r) => r.code);
        await set(p, { outage: false }); await hop(p, '#/biller/money'); await hop(p, '#/biller/ledger/p-306'); await p.waitForTimeout(200);
        const o = { during, after: (await refusals(p)).map((r) => r.code), btn: await txt(p, 'ledger.statement.send'), outage: (await state(p)).outage };
        rec('A-storm2-ledger-5', 'After the outage ends the Ledger still shows the outage stop gate and Send statement still reads Held', 'CONTRACTS §6 outage (the gate stands only while the outage does); FIX-ROUND2 stale-gate rule; rail.js ledState/storeGate',
          during.includes('outage') && !o.outage && (o.after.includes('outage') || o.btn === 'Held'), o);
      } finally { await c.close(); }
    },

    // r2-6: the Ledger's per-user|patient view survived a store reset. Negative control: after reset no sent chip and As-of today.
    async 'A-storm2-ledger-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-306'); await click(p, 'ledger.statement.send'); await p.waitForTimeout(150);
        await click(p, 'ledger.explain'); await click(p, 'ledger.asof'); await p.fill(tid('ledger.asof.date'), '2026-08-20'); await p.$eval(tid('ledger.asof.date'), (e) => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(150);
        const before = await p.evaluate(() => ((document.querySelector('.ledger-sent') || {}).textContent || '').trim());
        await p.evaluate(() => window.__proto.reset()); await p.waitForTimeout(200);
        const S = await state(p);
        const o = { sentBefore: before, sentAfter: await p.evaluate(() => ((document.querySelector('.ledger-sent') || {}).textContent || '').trim()), asof: await txt(p, 'ledger.asof'), rows: S.statementsDue.filter((x) => x.patientId === 'p-306').length, disclosures: S.disclosures.length };
        rec('A-storm2-ledger-6', 'After a store reset the Ledger still says "Statement sent" and "As of 8/20" while the store holds no statement and no disclosure', 'docs/01 principle 2 (the screen reads the store); moneydesk.js lastStore rule; rail.js led',
          /sent/i.test(before) && o.rows === 0 && o.disclosures === 0 && (/sent/i.test(o.sentAfter) || /8\/20/.test(o.asof || '')), o);
      } finally { await c.close(); }
    },

    // r2-7: settleBatch counted only deltas as open, so a held line let the batch post with no way to decide it.
    // Negative control: the batch stays 'deltas', the held row keeps Confirm/Dispute and the ERA badge counts it.
    async 'A-storm2-ledger-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.era.era-1.postmatched'); await click(p, 'money.era.line.el-22.hold'); await click(p, 'money.era.line.el-14.confirm'); await click(p, 'money.era.line.el-31.confirm'); await p.waitForTimeout(150);
        await click(p, 'money.tab.era'); await p.waitForTimeout(120);
        const S = await state(p);
        const o = { batch: S.eraBatches[0].status, el22: S.eraLines.find((l) => l.id === 'el-22').status, el22Rows: S.ledger.filter((e) => e.eraLineId === 'el-22').length, controls: (await testids(p)).filter((t) => t.startsWith('money.era.line.el-22.') && !t.endsWith('.why')), badge: await badge(p, 'era') };
        rec('A-storm2-ledger-7', 'With el-22 set aside and the other deltas confirmed, era-1 reads posted and "Batch complete" while el-22 is held with no ledger rows, no row controls and an ERA badge of 0', 'docs/13 feature 5 (an ERA posts when every line is decided); docs/01 principle 9; store.js settleBatch, moneydesk.js eraTab',
          o.el22 === 'held' && o.el22Rows === 0 && (o.batch === 'posted' || o.controls.length === 0 || o.badge === 0), o);
      } finally { await c.close(); }
    },

    // r2-8: sendAppeal hard-coded recordIds ["pe-1","nf-old"] (p-301's exam and a row that does not exist).
    // Negative control: every record id names a record of the claim's patient.
    async 'A-storm2-ledger-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await click(p, 'money.appeal.send'); await p.waitForTimeout(150);
        const S = await state(p); const cl = S.claims.find((x) => x.id === 'c-88');
        const d = S.disclosures.find((x) => x.channel === 'clearinghouse' && x.patientId === cl.patientId) || null;
        const owner = (id) => { const pe = S.perioExams.find((e) => e.id === id); if (pe) return pe.patientId; const nf = S.filedNotes.find((n) => n.id === id); if (nf) return (S.encounters.find((e) => e.id === nf.encounterId) || {}).patientId || null; return null; };
        const foreign = d ? d.recordIds.filter((id) => owner(id) !== cl.patientId) : [];
        rec('A-storm2-ledger-8', 'Sending the c-88 appeal (p-321) writes a clearinghouse disclosure whose recordIds are another patient\'s perio exam and a row that does not exist', 'docs/13 feature 7 (the disclosure names exactly what went out for this patient); docs/01 principle 8; store.js sendAppeal',
          cl.status === 'appealed' && !!d && (d.recordIds.length === 0 || foreign.length > 0), { claimPatient: cl.patientId, disclosure: d, foreign });
      } finally { await c.close(); }
    },

    // r2-9: the Credits tab listed S.credits, not the ledger. Negative control: Samir (credit > 0) is listed, an applied
    // credit is not, and the badge equals the rows.
    async 'A-storm2-ledger-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046'); await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '200'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        await hop(p, '#/frontdesk/checkout/a-1044'); await click(p, 'checkout.tender.card'); await click(p, 'checkout.post');
        await set(p, { persona: 'dentist' }); await hop(p, '#/dentist/encounter/enc-9003'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        await set(p, { persona: 'biller' }); await hop(p, '#/biller/money'); await click(p, 'money.tab.credits'); await p.waitForTimeout(120);
        const bal = await p.evaluate(() => ({ samir: Proto.store.balances('p-305').credit, ines: Proto.store.balances('p-303').credit }));
        const text = await canvas(p); const rows = (await testids(p)).filter((t) => /^money\.credit\./.test(t));
        const o = { balances: bal, samirListed: /Samir Haddad/.test(text), inesListed: /Ines Okoro/.test(text), rows, badge: await badge(p, 'credits') };
        rec('A-storm2-ledger-9', 'The Credits tab lists S.credits: Samir Haddad (ledger credit > 0) is absent, Ines Okoro (credit applied, balance 0) is listed, and the badge counts S.credits rows', 'docs/13 feature 23 (every worklist is a sum over ledger rows); docs/04 one canonical view per fact; moneydesk.js counts(), creditsTab',
          bal.samir > 0 && bal.ines === 0 && (!o.samirListed || o.inesListed || o.badge !== rows.length), o);
      } finally { await c.close(); }
    },

    // r2-10 / r2-11: gate()'s default control switched to the ERA tab. Negative control: "Go to amount" focuses the amount
    // field and the raise hold's control keeps the Statements tab.
    async 'A-storm2-ledger-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.tab.statements');
        await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '1000'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const g1 = (await refusals(p)).find((r) => r.code === 'amount_required') || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const amount = { gate: g1, tab: await tab(p), focused: await focused(p) };
        await go(p, '#/biller/money'); await click(p, 'money.tab.statements'); await click(p, 'money.statement.p-318.raise'); await p.waitForTimeout(150);
        const g2 = (await refusals(p)).find((r) => r.code === 'statement_held') || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const hold = { gate: g2, tab: await tab(p), hash: await p.evaluate(() => location.hash), focused: await focused(p) };
        rec('A-storm2-ledger-10', 'On the Statements tab the write-off cap control "Go to amount" and the raise hold\'s control each switch to the ERA tab and focus money.tab.era instead of the amount field / the statements row', 'CONTRACTS §6 (the control lands on the next step); moneydesk.js gate() default onControl; store.js raiseStatement control word',
          !!g1 && !!g2 && ((amount.tab.includes('money.tab.era') || amount.focused !== 'money.writeoff.amount') || (hold.tab.includes('money.tab.era') && hold.hash === '#/biller/money')), { amount, hold });
      } finally { await c.close(); }
    },

    // r2-12: a fixed claim (age 0) was on no tab while the Aging badge counted it. Negative control: c-88 renders on Aging
    // under a Resubmitted bucket and the badge equals the rows.
    async 'A-storm2-ledger-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.fix'); await p.waitForTimeout(150);
        const cl = (await state(p)).claims.find((x) => x.id === 'c-88');
        let seen = [];
        for (const t of ['era', 'aging', 'denials', 'statements', 'credits', 'variances', 'approvals']) { await click(p, 'money.tab.' + t); if ((await testids(p)).some((x) => x.includes('c-88')) || /\bc-88\b/.test(await canvas(p))) seen.push(t); }
        await click(p, 'money.tab.aging'); await p.waitForTimeout(100);
        const o = { c88: { status: cl.status, age: cl.age }, seenOn: seen, badge: await badge(p, 'aging'), rows: (await testids(p)).filter((t) => /^money\.aging\.row\./.test(t)).length };
        rec('A-storm2-ledger-11', 'After Denials → Fix, c-88 (submitted, age 0) appears on no Money Desk tab while the Aging badge counts it (badge > rows)', 'docs/13 feature 6 (a corrected claim stays in view until the 277); docs/04 badge equals rows; store.js claimAction, moneydesk.js agingTab/counts',
          cl.status === 'submitted' && cl.age === 0 && (!seen.length || o.badge !== o.rows), o);
      } finally { await c.close(); }
    },

    // r2-13: the Statements row printed the frozen seed amount and counted a row whose live balance was zero.
    // Negative control: after Post matched settles p-316, sd-1 leaves the badge and no row prints $84.00 for it.
    async 'A-storm2-ledger-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        await click(p, 'money.tab.statements'); await p.waitForTimeout(120);
        const bal = await p.evaluate(() => Proto.store.balances('p-316'));
        const row = await p.evaluate(() => { const b = document.querySelector('[data-testid="money.statement.sd-1.send"]'); const r = b && b.closest('.md-row'); return r ? r.textContent.replace(/\s+/g, ' ') : null; });
        const o = { balances: bal, row, badge: await badge(p, 'statements'), openRows: (await state(p)).statementsDue.filter((s) => !s.sent).length };
        rec('A-storm2-ledger-12', 'After Post matched settles p-316, the Statements row for sd-1 still prints $84.00 and counts in the badge while the live patient due is $0', 'docs/13 feature 23 (amounts shown are live sums over ledger rows); moneydesk.js statementsTab, counts()',
          bal.patientDue === 0 && (/\$84\.00/.test(row || '') || o.badge === o.openRows), o);
      } finally { await c.close(); }
    },

    // r2-14 and the device-flip item: the PIN stayed armed across routes and after a posting, and a shared→desk flip left a
    // pin_required gate standing. Negative control: the field is empty after the hop, Confirm without a PIN refuses, and the
    // gate falls when the device is no longer shared.
    async 'A-storm2-ledger-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money?device=shared'); await fill(p, 'money.pin', '2468'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const posted = (await state(p)).ledger.some((e) => e.eraLineId === 'el-1');
        await hop(p, '#/biller/ledger/p-306'); await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        const pinAfterHop = await value(p, 'money.pin');
        await click(p, 'money.era.line.el-14.confirm'); await p.waitForTimeout(150);
        const S = await state(p);
        const el14 = S.ledger.filter((e) => e.eraLineId === 'el-14').map((e) => e.actor);
        const gateShared = (await refusals(p)).map((r) => r.code);
        await set(p, { device: 'desk' }); await hop(p, '#/biller/ledger/p-306'); await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        const o = { posted, pinAfterHop, el14Actors: el14, gateShared, gateDesk: (await refusals(p)).map((r) => r.code), confirmLabel: await txt(p, 'money.era.line.el-14.confirm') };
        rec('A-storm2-ledger-13', 'On a shared device the PIN typed for Post matched stays in money.pin across a hop and Confirm posts el-14 as Dr. Reagan with no PIN retyped; flipping the device to desk leaves the pin_required gate standing', 'store.js PIN_WHY (the PIN mints your own session); checkout.js convention (pin cleared when the poster changes); FIX-ROUND2 stale-gate rule; moneydesk.js views',
          posted && (pinAfterHop === '2468' || el14.length > 0 || o.gateDesk.some((x) => /^pin_/.test(x)) || o.confirmLabel === 'Held'), o);
      } finally { await c.close(); }
    },

    // Sub-cap: Fix on an already-appealed claim kept status appealed and rewrote nextAction. Negative control: the store refuses
    // (already_decided) and the claim's nextAction is unchanged.
    async 'A-storm2-ledger-14'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const o = await p.evaluate(() => { const s = Proto.store.sendAppeal('c-88'); const before = Object.assign({}, Proto.store.get().claims.find((x) => x.id === 'c-88')); const fix = Proto.store.claimAction('c-88', 'fix'); const after = Proto.store.get().claims.find((x) => x.id === 'c-88'); return { sent: s.ok, fix: fix.ok ? 'ok' : fix.code, control: fix.control || null, status: after.status, nextBefore: before.nextAction, nextAfter: after.nextAction }; });
        rec('A-storm2-ledger-14', 'Fix on the appealed claim c-88 succeeds: status stays appealed while nextAction is rewritten to "Corrected and resubmitted"', 'docs/13 feature 16 (an appeal in review is waited on, not corrected under); CONTRACTS §6 already_decided; store.js claimAction',
          o.sent === true && o.status === 'appealed' && (o.fix === 'ok' || o.nextAfter !== o.nextBefore), o);
      } finally { await c.close(); }
    },

    // Item B (A-misc-2-3): the Andon and the phone card each redacted the store's sentence themselves. Negative control: the store
    // returns the redacted form for {redact:true} (initials · MRN, no name) and both surfaces print exactly that.
    async 'A-storm2-ledger-15'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        await hop(p, '#/owner/close'); await p.waitForTimeout(150);
        const o = await p.evaluate(() => { const req = Proto.store.pendingApprovalsFor()[0]; const who = req && Proto.store.patient(req.patientId); const red = req ? Proto.store.approvalSentence(req, { redact: true }) : null; const andon = ((document.querySelector('#andon span.grow') || {}).textContent || '').trim(); return { pending: !!req, name: who && who.name, redacted: red, andon }; });
        await hop(p, '#/owner/phone/approvals'); await p.waitForTimeout(150);
        o.phone = await p.evaluate(() => ((document.querySelector('.ph-sentence') || {}).textContent || '').trim());
        rec('A-storm2-ledger-15', 'The store has no redacted approval sentence: approvalSentence(req, {redact:true}) still prints the patient\'s name, and the Andon and phone card each derive their own initials · MRN form', 'docs/15 one rule, one owner; C5 one canonical sentence per request (store.js approvalSentence; shell.js minimumSentence; phone.js cardSentence)',
          o.pending && (!o.redacted || o.redacted.includes(o.name) || o.andon !== o.redacted || o.phone !== o.redacted), o);
      } finally { await c.close(); }
    },

    // Item C: chartUndo(encId, chartEventId) must reverse the named event; the day-pass licence verb must be verb-first; the
    // after-hours write-off refusal carries no requestId and its control acts on the write-off card.
    async 'A-storm2-ledger-16'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const undo = await p.evaluate(() => { const a = Proto.store.chartPaint('enc-9002', 30, ['d', 'o'], 'd2392', 'today'); Proto.store.chartPaint('enc-9002', 19, [], 'd2740', 'today'); const u = Proto.store.chartUndo('enc-9002', a.chartEvent.id); return { undo: u.ok ? u.supersedes : u.code, named: a.chartEvent.id }; });
        const licence = await p.evaluate(() => (Proto.store.previewDayPass({ name: 'Nobody Here', role: 'rdh' }).licenceGate || {}).verb || null);
        await go(p, '#/biller/money?afterHours=1'); await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '50'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const res = await p.evaluate(() => Proto.store.requestWriteoff('p-306', 5000, 'courtesy', {}));
        const g = (await refusals(p)).find((r) => r.code === 'after_hours') || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const o = { undo, licence, verbFirst: /^(Add|Verify|Attach|Issue|Choose)\b/.test(licence || '') && (licence || '').split(/\s+/).length <= 8, afterHours: { code: res.code, control: res.control, requestId: res.requestId || null }, gate: g, gateAfter: (await refusals(p)).map((r) => r.code), focused: await focused(p), approvals: (await state(p)).approvals.length };
        rec('A-storm2-ledger-16', 'chartUndo ignores the chart event id it is given, the day-pass licence verb opens on a noun ("Licence not on file — Front desk only"), or the after-hours write-off control does nothing on the write-off card', 'docs/13 flow 3 (Undo reverses the paint being undone); CONTRACTS §6 (verb first, ≤8 words; a control does what it says); store.js chartUndo, previewDayPass, requestWriteoff; moneydesk.js gate()',
          undo.undo !== undo.named || !o.verbFirst || res.code !== 'after_hours' || !!res.requestId || !g || o.gateAfter.includes('after_hours') || o.approvals > 0, o);
      } finally { await c.close(); }
    },
  };
};
