// Audit checks for the beta storm's Money Desk and Ledger findings (moneydesk-ledger-3, -5, -6, -7, -8, -10, -11,
// -12, -13, -14 and invariants-3), each confirmed live before it was fixed. Files: prototype/js/screens/moneydesk.js,
// prototype/js/screens/rail.js. Default position is NOT reproduced: every check measures the breach it claims, carries
// the precondition it needed, and closes its browser context in `finally`.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
export default ({ ctx, go, hop, click, txt, rec, FILE }) => {
  const CONTRACTS = () => fs.readFileSync(fileURLToPath(FILE).replace(/index\.html$/, 'CONTRACTS.md'), 'utf8');
  // §4: every backticked entry in every row of the table; <a|b> enumerates, a bare <x> admits one seed-id or code token.
  const s4Patterns = () => { const t = CONTRACTS(); const sec = t.slice(t.indexOf('## 4.'), t.indexOf('## 5.')); const entries = [...sec.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((e) => /^[a-z0-9]+\./.test(e)); return { entries, patterns: entries.map((e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+') + '$')) }; };
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const after = (p, seq0) => p.evaluate((s) => window.__events.filter((e) => e.seq > s).map((e) => ({ seq: e.seq, kind: e.kind, testid: e.testid, code: e.code, table: e.table, id: e.id })), seq0);
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => b.textContent.trim()) })));
  const button = (p, tid) => p.$eval(`[data-testid="${tid}"]`, (e) => ({ text: e.textContent.trim(), className: e.className })).catch(() => null);
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid')));
  const selectedTab = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid^="money.tab."]')].filter((e) => e.getAttribute('aria-selected') === 'true').map((e) => e.getAttribute('data-testid')));
  const asOf = async (p, date) => { await click(p, 'ledger.asof'); await p.fill('[data-testid="ledger.asof.date"]', date); await p.$eval('[data-testid="ledger.asof.date"]', (e) => e.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(150); };
  const heldWriteoff = async (p) => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); };
  // One press of a Money Desk posting control under outage: the store refuses; the screen must show the shared gate,
  // log the refusal and switch the row's primary (the pressed control, or the Confirm beside a Set aside / Dispute) to
  // Held. ui.refusal logs one gate once until its verb changes, so the caller hops away and back between rows.
  const pressUnderOutage = async (p, tid, primary) => {
    const seq0 = await lastSeq(p); const before = await p.evaluate(() => JSON.stringify(window.__proto.state()));
    const pressed = await click(p, tid); await p.waitForTimeout(150);
    const ev = await after(p, seq0); const dom = await refusalsDom(p); const btn = await button(p, primary || tid);
    const stateSame = before === await p.evaluate(() => JSON.stringify(window.__proto.state()));
    const gated = dom.some((d) => d.code === 'outage') && ev.some((e) => e.kind === 'refusal' && e.code === 'outage') && !!btn && btn.text === 'Held';
    return { tid, pressed, stateSame, refusalEvents: ev.filter((e) => e.kind === 'refusal'), refusalDom: dom, primaryAfter: btn, gated, breach: pressed && stateSame && !gated };
  };

  return {
    // moneydesk.js postMatched / handleLine / appeal Send / statement Send: store.offline() refused every posting under
    // ?outage=1 but the screen only announced res.verb — no Refusal component, no refusal event, the primary still in its
    // irreversible identity. Negative control: each pressed control leaves the store unchanged AND shows an outage gate
    // with a refusal event AND reads Held; then every `breach` is false and the check reports no.
    async 'A-storm-money-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money?outage=1');
        const outage = await p.evaluate(() => ({ flag: window.__proto.outage, store: !!Proto.store.get().outage }));
        const rows = [await pressUnderOutage(p, 'money.era.era-1.postmatched')];
        await p.evaluate(() => window.__proto.set({ outage: false })); await hop(p, '#/biller/ledger/p-303'); await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(150);
        const posted = await p.evaluate(() => Proto.store.get().eraBatches[0].status);
        for (const tid of ['money.era.line.el-14.confirm', 'money.era.line.el-14.hold', 'money.era.line.el-14.dispute']) { await hop(p, '#/biller/ledger/p-303'); await hop(p, '#/biller/money'); await p.waitForTimeout(150); rows.push(await pressUnderOutage(p, tid, 'money.era.line.el-14.confirm')); }
        await hop(p, '#/biller/ledger/p-303'); await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150);
        rows.push(await pressUnderOutage(p, 'money.appeal.send'));
        await hop(p, '#/biller/ledger/p-303'); await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        await click(p, 'money.tab.statements'); rows.push(await pressUnderOutage(p, 'money.statement.sd-1.send'));
        const pressedAll = rows.every((r) => r.pressed);
        rec('A-storm-money-1', 'Under outage, Post matched, Confirm, Set aside, Dispute, appeal Send and statement Send on Money Desk are refused by the store but render no Refusal component, log no refusal event and keep the irreversible primary', 'CONTRACTS §6 (one shared component renders every gate; the primary switches to Held) and §5 (a refusal that never enters the log is not a finding); moneydesk.js postMatched, handleLine, appealDrawer, statementsTab',
          outage.flag === true && posted === 'deltas' && pressedAll && rows.some((r) => r.breach), { outage, batchAfterPost: posted, pressedAll, rows });
      } finally { await c.close(); }
    },

    // moneydesk.js eraTab: before Post matched the card read "37 posted before you sat down", a "37 posted" chip and a Why
    // saying the worker posted every clean line, while state().ledger held no row for any era-1 line (store.eraPostMatched
    // writes them at the press). Negative control: a card that says "matched" until the ledger carries the rows, and "posted"
    // only for lines with a ledger row, prints no posted count while `ledgerRows` is 0, so `postedWordShown` is false.
    async 'A-storm-money-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const read = () => p.evaluate(() => { const card = document.querySelector('#canvas .md-batch'); const t = card ? card.textContent.replace(/\s+/g, ' ') : ''; return { chips: [...(card ? card.querySelectorAll('.chip') : [])].map((e) => e.textContent.trim()), head: ((card && card.querySelector('.md-batchline')) || {}).textContent || null, why: ((card && card.querySelector('[data-testid="money.era.era-1.why"]')) || {}).textContent || null, postedCountShown: (t.match(/(\d+) posted/) || [null, null])[1], ledgerRows: window.__proto.state().ledger.filter((e) => e.eraLineId && e.eraLineId.startsWith('el-') && e.eraLineId !== 'el-prev-1').length, matchedLines: window.__proto.state().eraLines.filter((l) => l.batchId === 'era-1' && l.status === 'posted').length }; });
        const before = await read();
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const afterPost = await read();
        const postedWordShown = before.postedCountShown != null && Number(before.postedCountShown) > 0;
        rec('A-storm-money-2', 'Before Post matched the ERA card prints "37 posted" in its chip and batch line while the ledger holds no row for any era-1 line; the 37 rows are written only when Post matched is pressed', 'docs/04 one canonical view per fact; docs/13 feature 14 (matched lines already posted link to ledger rows); moneydesk.js eraTab derives "posted" from eraLines.status, not from ledger rows',
          before.ledgerRows === 0 && before.matchedLines > 0 && postedWordShown, { before, afterPost, postedWordShown });
      } finally { await c.close(); }
    },

    // rail.js renderLedger/explainBlock: the three numbers under As-of are summed over the filtered rows, but Explain called
    // store.explain(pid) over the live ledger, so p-303 at 7/20 read "Patient due $217.00" over "…MetLife paid $61.00 on
    // 8/20/2026; paid in full". Negative control: under As-of the Explain block names no payment dated after the chosen day and
    // does not say "paid in full" for a charge the numbers above say is due; then `contradiction` is false.
    async 'A-storm-money-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-303');
        await click(p, 'ledger.explain'); await asOf(p, '2026-07-20');
        const o = await p.evaluate(() => ({ three: [...document.querySelectorAll('#canvas .threenum .v')].map((e) => e.textContent.trim()), asofLine: ((document.querySelector('.ledger-asofline') || {}).textContent || '').trim(), explain: ((document.querySelector('#canvas .explain') || {}).textContent || '').replace(/\s+/g, ' ').trim(), rowsShown: document.querySelectorAll('#canvas .ledger-table tbody tr[data-testid]').length }));
        const laterDates = (o.explain.match(/\b(\d{1,2})\/(\d{1,2})\/2026\b/g) || []).filter((d) => { const [m, day] = d.split('/').map(Number); return m > 7 || (m === 7 && day > 20); });
        const contradiction = o.three[0] === '$217.00' && (laterDates.length > 0 || /paid in full/.test(o.explain));
        rec('A-storm-money-3', 'With the Ledger As-of set to 7/20 the three numbers read Patient due $217.00 while the Explain block beneath still renders the live allocation (payments on 8/2 and 8/20; "paid in full") for the same instant', 'docs/13 feature 23 (As-of re-renders the view as the sum over entries posted at or before the instant; Explain renders from the same rows); docs/04 one canonical view per fact; rail.js explainBlock',
          o.rowsShown === 1 && contradiction, Object.assign(o, { laterDatesInExplain: laterDates, contradiction }));
      } finally { await c.close(); }
    },

    // moneydesk.js writeoffCard / approvalsTab: after the owner sent the $410 write-off back with the line "appeal first" the
    // card said "Their line is on the approvals card" but neither the card nor the Approvals tab printed it, and the stale
    // needs_second gate stayed beside a live irreversible Post. Negative control: the line is on the card or the tab, and no
    // needs_second gate stands once the request is no longer pending; then `breach` is false.
    async 'A-storm-money-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await heldWriteoff(p);
        const reqId = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).id || null);
        await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        await click(p, 'phone.request.' + reqId + '.decline'); await p.waitForTimeout(100);
        await p.fill('[data-testid="phone.request.' + reqId + '.reason"]', 'appeal first');
        await click(p, 'phone.request.' + reqId + '.decline'); await p.waitForTimeout(200);
        const req = await p.evaluate(() => { const a = window.__proto.state().approvals[0] || {}; return { status: a.status, decidedBy: a.decidedBy, decisionReason: a.decisionReason }; });
        await hop(p, '#/biller/money'); await p.waitForTimeout(200);
        const card = await canvas(p); const post = await button(p, 'money.writeoff.post'); const gates = await refusalsDom(p);
        await click(p, 'money.tab.approvals'); await p.waitForTimeout(150);
        const tab = await canvas(p);
        const reasonShown = /appeal first/.test(card) || /appeal first/.test(tab);
        const staleGate = gates.some((g) => g.code === 'needs_second') && !!post && post.text === 'Post';
        const breach = !reasonShown || staleGate;
        rec('A-storm-money-4', 'After the owner sends the write-off back with the line "appeal first", the biller\'s card promises the line but prints it nowhere, and the stale needs_second gate stays rendered beside a live irreversible Post', 'docs/13 feature 24 (the one-line reason rides with the request; the biller reads it) and CONTRACTS §6 (a gate on screen names what holds the posting; here nothing is held); moneydesk.js writeoffCard, approvalsTab',
          req.status === 'declined' && req.decisionReason === 'appeal first' && breach, { request: req, reasonShown, staleGate, gatesOnCard: gates, postButton: post, cardText: card.slice(0, 400), approvalsTabText: tab.slice(0, 300) });
      } finally { await c.close(); }
    },

    // moneydesk.js creditsTab: "Apply when charges post" on cr-1 only announced; no write, no route, no dialog, no refusal.
    // Negative control: a press that changes the route, opens a dialog, writes a row or raises a gate is not dead; then `dead` is false.
    async 'A-storm-money-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await click(p, 'money.tab.credits');
        const before = await p.evaluate(() => JSON.stringify(window.__proto.state()));
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'money.credit.cr-1.apply'); await p.waitForTimeout(200);
        const ev = (await after(p, seq0)).filter((e) => !['click', 'focus', 'key'].includes(e.kind));
        const o = await p.evaluate(() => ({ route: location.hash, dialog: !!document.querySelector('#dialogs .overlay'), live: ((document.getElementById('live') || {}).textContent || '').trim() }));
        const stateSame = before === await p.evaluate(() => JSON.stringify(window.__proto.state()));
        const dead = ev.length === 0 && o.route === '#/biller/money' && !o.dialog && stateSame;
        rec('A-storm-money-5', 'The Credits row control "Apply when charges post" does nothing when pressed: no write, no route change, no dialog, no refusal — only an announcement', 'docs/01 principle 11 (a control that cannot act says so) and docs/13 feature 23; moneydesk.js creditsTab',
          pressed && dead, Object.assign(o, { pressed, eventsBeyondClick: ev, stateSame, dead }));
      } finally { await c.close(); }
    },

    // moneydesk.js denialRow Fix and agingTab actions: four claim-row controls only announced. Negative control: a press that
    // writes a row, changes the route, opens a dialog or raises a gate is not dead; the check reports no once every one acts.
    async 'A-storm-money-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const before = await p.evaluate(() => JSON.stringify(window.__proto.state()));
        const rows = [];
        for (const [tab, tid] of [['money.tab.denials', 'money.denial.c-88.fix'], ['money.tab.aging', 'money.aging.row.c-72.attach'], ['money.tab.aging', 'money.aging.row.c-65.call'], ['money.tab.aging', 'money.aging.row.c-51.escalate']]) {
          await hop(p, '#/biller/money'); await click(p, tab);
          const seq0 = await lastSeq(p);
          const pressed = await click(p, tid); await p.waitForTimeout(150);
          const ev = (await after(p, seq0)).filter((e) => !['click', 'focus', 'key'].includes(e.kind));
          const o = await p.evaluate(() => ({ route: location.hash, dialog: !!document.querySelector('#dialogs .overlay'), live: ((document.getElementById('live') || {}).textContent || '').trim() }));
          rows.push(Object.assign({ tid, pressed, events: ev, dead: pressed && ev.length === 0 && o.route === '#/biller/money' && !o.dialog }, o));
        }
        const stateSame = before === await p.evaluate(() => JSON.stringify(window.__proto.state()));
        rec('A-storm-money-6', 'Denials "Fix" and the Aging row actions (Attach and resubmit, Call payer, Escalate) do nothing when pressed: no write, no route change, no dialog, no refusal', 'docs/01 principle 11 and docs/13 feature 16 (one primary action per row that does the thing); moneydesk.js denialRow, agingTab',
          rows.every((r) => r.pressed) && rows.some((r) => r.dead), { rows, stateSame });
      } finally { await c.close(); }
    },

    // rail.js sendStatement / openMoneyDesk: on p-306 the statement_held gate's only control opened Money Desk on the ERA tab,
    // where nothing raises a statement; on p-316 a second Send after a successful one fell through to the same "Queue this
    // statement" gate with "no row raised yet" beneath the Statement sent chip. Negative control: the control lands on the
    // Statements tab and the second press is refused as already sent (not "no row raised"); then both breaches are false.
    async 'A-storm-money-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-306');
        const pre = await p.evaluate(() => ({ statementsDueForP306: window.__proto.state().statementsDue.filter((x) => x.patientId === 'p-306').length, due: Proto.store.balances('p-306').patientDue }));
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(150);
        const gate1 = await refusalsDom(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const landing = { route: await p.evaluate(() => location.hash), selectedTab: await selectedTab(p) };
        const deadExit = gate1.some((g) => g.code === 'statement_held') && !(landing.route === '#/biller/money' && landing.selectedTab.includes('money.tab.statements'));
        await hop(p, '#/biller/ledger/p-316'); await p.waitForTimeout(150);
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(150);
        const sentChip = await p.evaluate(() => ((document.querySelector('.ledger-sent') || {}).textContent || '').trim());
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(150);
        const gate2 = await refusalsDom(p); const why2 = await p.evaluate(() => ((document.querySelector('.refusal .whytext') || {}).textContent || '').trim());
        const wrongSecondGate = !!sentChip && gate2.some((g) => /Queue this statement/.test(g.verb)) || /no row raised/.test(why2);
        rec('A-storm-money-7', 'On p-306 the "Queue this statement on Money Desk" gate\'s only control lands on Money Desk\'s ERA tab, and on p-316 a second Send after a successful one repeats the same gate with "no row raised yet" beneath the Statement sent chip', 'CONTRACTS §6 (every gate carries a control that leads somewhere) and docs/13 feature 23 (Money Desk → Statements due is where a statement is raised); rail.js sendStatement, openMoneyDesk',
          pre.statementsDueForP306 === 0 && pre.due > 0 && (deadExit || wrongSecondGate), { precondition: pre, gate1, landing, deadExit, p316: { sentChip, gate2, why2, wrongSecondGate } });
      } finally { await c.close(); }
    },

    // moneydesk.js: `tab` and `st` were module singletons, so the biller's open write-off form (amount 77) and selected tab
    // carried into #/owner/money. Negative control: view state keyed by user id gives the owner a fresh Money Desk — no amount
    // field, ERA tab selected — so `leaked` is false.
    async 'A-storm-money-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.tab.statements'); await click(p, 'money.writeoff.p-306');
        await p.fill('[data-testid="money.writeoff.amount"]', '77'); await p.waitForTimeout(80);
        const biller = await p.evaluate(() => ({ user: Proto.store.currentUser().name, amount: (document.querySelector('[data-testid="money.writeoff.amount"]') || {}).value || null }));
        await hop(p, '#/owner/money'); await p.waitForTimeout(200);
        const owner = await p.evaluate(() => ({ user: Proto.store.currentUser().name, amount: (document.querySelector('[data-testid="money.writeoff.amount"]') || {}).value || null, formOpen: !!document.querySelector('[data-testid="money.writeoff.amount"]') }));
        owner.selectedTab = await selectedTab(p);
        const leaked = owner.amount === '77' || owner.selectedTab.includes('money.tab.statements');
        rec('A-storm-money-8', 'Money Desk view state is module-global: after the biller opens the write-off and types 77 on the Statements tab, #/owner/money renders the owner\'s desk with the form open, the amount 77 and Statements selected', 'docs/04 blueprint (state is the person\'s, not the workstation\'s; contrast rail.js ledState keyed by user id); moneydesk.js module state',
          biller.amount === '77' && owner.user !== biller.user && leaked, { biller, owner, leaked });
      } finally { await c.close(); }
    },

    // moneydesk.js denialRow Bill patient: a fixed refusal "Appeal first — denial with no appeal" / Build appeal, raised even after
    // the appeal was sent (claim appealed, disclosure written). Negative control: once appealed the gate names the true reason
    // (the payer is reviewing the appeal) and offers no "Build appeal"; then `contradicts` is false.
    async 'A-storm-money-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await click(p, 'money.appeal.send'); await p.waitForTimeout(200);
        const claim = await p.evaluate(() => { const S = window.__proto.state(); return { status: (S.claims.find((x) => x.id === 'c-88') || {}).status, disclosures: S.disclosures.filter((d) => d.channel === 'clearinghouse').length }; });
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'money.denial.c-88.bill'); await p.waitForTimeout(150);
        const gates = await refusalsDom(p); const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal');
        const g = gates.find((x) => x.code === 'denial_suppression') || null;
        const contradicts = !!g && (/no appeal/i.test(g.verb) || g.controls.some((x) => /build appeal/i.test(x)));
        rec('A-storm-money-9', 'After the c-88 appeal has been sent, Bill patient still refuses with "Appeal first — denial with no appeal" and a Build appeal control, contradicting the record', 'docs/13 feature 16 (the refusal names the true reason) and docs/04 glossary (wording never contradicts state); moneydesk.js denialRow',
          claim.status === 'appealed' && pressed && contradicts, { claim, pressed, gate: g, refusalEvents: ev });
      } finally { await c.close(); }
    },

    // moneydesk.js counts(): the Approvals badge counted store.pendingApprovalsFor() (requests for me to decide) while the tab
    // body listed every request, so the biller saw badge 0 over one Waiting row. Negative control: badge === Waiting rows.
    async 'A-storm-money-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money'); await heldWriteoff(p);
        await click(p, 'money.tab.approvals'); await p.waitForTimeout(150);
        const o = await p.evaluate(() => { const t = document.querySelector('[data-testid="money.tab.approvals"] .count'); const rows = [...document.querySelectorAll('#canvas section[aria-label="Approvals"] .wrow')]; return { badge: t ? t.textContent.trim() : null, aria: t ? t.getAttribute('aria-label') : null, rows: rows.length, waitingRows: rows.filter((r) => /Waiting/.test(((r.querySelector('.chip') || {}).textContent || ''))).length, pendingInStore: window.__proto.state().approvals.filter((a) => a.status === 'pending').length }; });
        rec('A-storm-money-10', 'For the biller the Approvals tab badge reads 0 while the tab body lists the one Waiting $410 request she just raised', 'docs/04 blueprint (a count encoded twice agrees; a worklist badge means the same thing on every tab); moneydesk.js counts()',
          o.waitingRows > 0 && Number(o.badge) !== o.waitingRows, o);
      } finally { await c.close(); }
    },

    // moneydesk.js deltaRow/handleLine: the confirmed row left the list synchronously, so the next line's Confirm moved under the
    // pointer and a double-click on el-14 posted el-22 as well (four ledger rows). Negative control: a decided row keeps its
    // place, so the second click of the pair lands on no live irreversible control and the ledger grows by exactly two rows.
    async 'A-storm-money-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const seq0 = await lastSeq(p); const n0 = await p.evaluate(() => window.__proto.state().ledger.length);
        const at = await p.$eval('[data-testid="money.era.line.el-14.confirm"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).catch(() => null);
        if (at) { await p.mouse.dblclick(at.x, at.y); await p.waitForTimeout(300); }
        const o = await p.evaluate(() => { const S = window.__proto.state(); return { ledgerAfter: S.ledger.length, el14: (S.eraLines.find((l) => l.id === 'el-14') || {}).status, el22: (S.eraLines.find((l) => l.id === 'el-22') || {}).status }; });
        const clicked = (await after(p, seq0)).filter((e) => e.kind === 'click').map((e) => e.testid);
        const delta = o.ledgerAfter - n0;
        rec('A-storm-money-11', 'A double-click on el-14 Confirm posts two delta lines: the second click lands on el-22\'s Confirm, which moved into the same spot when the confirmed row was removed', 'docs/01 principle 9 / CONTRACTS §5 (an irreversible control posts once per intent; rapid fire on one control never posts a different row); docs/13 feature 14; moneydesk.js deltaRow, handleLine',
          !!at && delta > 2 && clicked.includes('money.era.line.el-22.confirm') && o.el22 === 'posted', Object.assign({ confirmAt: at, ledgerBefore: n0, ledgerDelta: delta, clicked }, o));
      } finally { await c.close(); }
    },

    // CONTRACTS §4 in both directions: the Ledger renders ledger.asof.date, ledger.asof.back, ledger.asof.statement.<sdId> and
    // ledger.explain.rows.<chargeId>, and rail.button() defaults to rail.open.<pid>, none with a §4 entry. Negative control: once
    // §4 lists them every rendered ledger.*/rail.* id matches a pattern and `unlisted` is empty. (Report-only: the fix is in §4.)
    async 'A-storm-money-12'(b) {
      const { c, p } = await ctx(b);
      try {
        const seen = new Set();
        const collect = async () => { for (const id of await testids(p)) if (/^(ledger|rail)\./.test(id)) seen.add(id); };
        await go(p, '#/biller/ledger/p-303'); await click(p, 'ledger.explain'); await asOf(p, '2026-08-10'); await collect();
        await hop(p, '#/biller/ledger/p-316'); await p.waitForTimeout(150); await click(p, 'ledger.asof'); await collect();
        seen.add(await p.evaluate(() => Proto.screens.rail.button('p-306').getAttribute('data-testid')));
        const { entries, patterns } = s4Patterns();
        const ids = [...seen].sort(); const unlisted = ids.filter((id) => !patterns.some((re) => re.test(id)));
        rec('A-storm-money-12', 'The Ledger renders ledger.asof.date, ledger.asof.back, ledger.asof.statement.<sdId> and ledger.explain.rows.<chargeId>, and the rail\'s default opener id is rail.open.<pid>: none has a CONTRACTS §4 entry', 'CONTRACTS §4 (an id with no §4 entry is a defect); rail.js asOfBlock, explainBlock, button()',
          entries.length > 0 && unlisted.length > 0, { idsRendered: ids, unlisted, s4EntryCount: entries.length });
      } finally { await c.close(); }
    },
  };
};
