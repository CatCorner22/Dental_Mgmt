// Audit checks for prototype/js/screens/rail.js (Patient Rail and the Ledger screen), chunk screens-rail-1
// (root causes RC-44, 45, 46, 54, 236, 110, 128, 129, 130, 131, 132, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const kinds = (ev) => ev.map((e) => e.kind + (e.testid ? ':' + e.testid : e.table ? ':' + e.table + '/' + e.id : e.key ? ':' + e.key : ''));
  const active = (p) => p.evaluate(() => { const a = document.activeElement; const rail = document.getElementById('rail'); return a === document.body || !a ? { tag: 'BODY', testid: null, insideRail: false } : { tag: a.tagName, testid: a.getAttribute('data-testid'), class: a.className || null, insideRail: !!(rail && rail.contains(a)) }; });
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const stateJson = (p) => p.evaluate(() => JSON.stringify(window.__proto.state()));
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => { const bx = b.getBoundingClientRect(); return { text: b.textContent.trim(), w: Math.round(bx.width), h: Math.round(bx.height) }; }),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  const button = (p, tid) => p.evaluate((tid) => { const b = document.querySelector('[data-testid="' + tid + '"]'); return b ? { text: b.textContent.trim(), class: b.className, disabled: b.disabled } : null; }, tid);
  const textOf = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  // Three numbers as {label: value} from one .threenum block; the rail's and the canvas's are read separately.
  const threeNum = (p, scope) => p.evaluate((scope) => [...document.querySelectorAll(scope + ' .threenum')].map((t) => Object.fromEntries([...t.querySelectorAll('.n')].map((n) => [n.querySelector('.l').textContent.trim(), n.querySelector('.v').textContent.trim()]))), scope);
  const railInfo = (p) => p.evaluate(() => { const r = document.getElementById('rail'); return { open: !!r && !r.hidden, name: r && !r.hidden ? ((r.querySelector('.rail-head .name') || {}).textContent || '').trim() : null }; });
  // The palette path that opens a chart: search, pick the first row, confirm the date of birth. Returns what the palette did.
  const openChartViaPalette = async (p, query, dob) => {
    await click(p, 'topbar.search'); await p.waitForTimeout(120);
    await p.fill('[data-testid="palette.input"]', query); await p.waitForTimeout(200);
    const row0 = await txt(p, 'palette.row.0');
    await click(p, 'palette.row.0'); await p.waitForTimeout(120);
    await p.fill('[data-testid="palette.confirm.dob"]', dob); await p.waitForTimeout(60);
    await click(p, 'palette.confirm.go'); await p.waitForTimeout(250);
    return { row0, paletteStillOpen: !!(await p.$('[data-testid="palette.input"], [data-testid="palette.confirm.dob"]')) };
  };
  const CONTRACTS = () => { try { return fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return ''; } };
  // §6: the codes are the backticked tokens after "Codes:" in the Refusals section.
  const s6Codes = () => { const t = CONTRACTS(); const sec = t.slice(t.indexOf('## 6.'), t.indexOf('## 7.')); const m = sec.match(/Codes:([\s\S]*?)\. The list is the contract/); return { codes: m ? [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]) : [], text: sec.trim() }; };
  // §4: every backticked entry in every row of the table; <a|b> enumerates, a bare <x> admits one seed-id or code token.
  const s4All = () => {
    const t = CONTRACTS(); const sec = t.slice(t.indexOf('## 4.'), t.indexOf('## 5.'));
    const rows = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*Screen\s*\|/.test(l) && !/^\|---/.test(l));
    const entries = rows.flatMap((row) => [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    const patterns = entries.map((e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+') + '$'));
    return { rowsSearched: rows.map((r) => r.trim()), entries, patterns };
  };

  return {
    // RC-44 · A2, A3, A4 · rail.js:168-172 sendBiller sets led[pid].biller to a sentence, announces "Money Desk row created" and rerenders;
    // it calls no store mutation, so no table changes and no write event is recorded; a second press does the same again.
    // Negative control: a compliant Send to biller writes one `write` event (messages, statementsDue or any table) in the press's seq range and
    // the store snapshot differs; a compliant repeat raises a refusal event or renders a refusal. Then `writes1.length > 0 || !stateIdentical`
    // or `refusals2.length > 0` and the check reports false. The chip and the announcement must have appeared, or nothing was pressed.
    async 'A-screens-rail-1-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-306');
        const before = await stateJson(p);
        const seq0 = await lastSeq(p);
        const pressed1 = await click(p, 'ledger.sendbiller'); await p.waitForTimeout(200);
        const ev1 = await after(p, seq0);
        const banner1 = await textOf(p, '.ledger-biller'); const live1 = await live(p);
        const after1 = await stateJson(p);
        const seq1 = await lastSeq(p);
        const pressed2 = await click(p, 'ledger.sendbiller'); await p.waitForTimeout(200);
        const ev2 = await after(p, seq1);
        const banner2 = await textOf(p, '.ledger-biller'); const live2 = await live(p);
        const after2 = await stateJson(p);
        const dom2 = await refusalsDom(p);
        const moneyDesk = await p.evaluate(() => { const S = window.__proto.state(); return { statementsDueForP306: S.statementsDue.filter((x) => x.patientId === 'p-306').length, messages: S.messages.length, disclosuresForP306: S.disclosures.filter((x) => x.patientId === 'p-306').length }; });
        const stateIdentical = before === after1 && after1 === after2;
        const reproduced = pressed1 && !!banner1 && /Sent to biller/.test(banner1) && /Money Desk row/.test(live1) && writes(ev1).length === 0 && stateIdentical && pressed2 && writes(ev2).length === 0 && refusalEvents(ev2).length === 0 && dom2.length === 0;
        rec('A-screens-rail-1-1', 'Send to biller on the Ledger shows a "Sent to biller" chip and announces "Money Desk row created with the sentence attached", but the store is deep-equal before and after, no write event is recorded, and a second press repeats the same announcement with no refusal', 'A2, A3, A4 — a mutation changes the store and writes one write event per table; a repeat is refused or a visible no-op with its reason; rail.js:168-172',
          reproduced, { firstPress: { pressed: pressed1, banner: banner1, announcement: live1, eventsInRange: kinds(ev1), writes: writes(ev1), seqRange: range(ev1, seq0) }, secondPress: { pressed: pressed2, banner: banner2, announcement: live2, eventsInRange: kinds(ev2), writes: writes(ev2), refusalEvents: refusalEvents(ev2), refusalDom: dom2, seqRange: range(ev2, seq1) }, stateDiff: { identicalAfterFirst: before === after1, identicalAfterSecond: after1 === after2, snapshotBytes: before.length }, moneyDeskAfter: moneyDesk });
      } finally { await c.close(); }
    },

    // RC-45 · A3, A4, B3 · rail.js:180-181: with no statementsDue row and no pending claim, Send statement sets led[pid].sent to a locally
    // minted id ('st-306-0903') and announces "frozen and sent", touching no table; the button stays "Send statement" (irreversible) and a
    // second press repeats. store.sendStatement (rail.js:176, the p-316 path) is read as the comparator that does write a disclosure.
    // Negative control: a compliant Send writes a statementsDue/disclosures row (a write event in range) and the repeat is refused (already
    // decided) or the primary switches to Held; then `writes1.length > 0` or `refusals2.length > 0 || label2 !== 'Send statement'` and the check
    // reports false. The precondition (no statementsDue row, no pending claim, patient due > 0 for p-306) is measured so the local branch is the
    // one under test.
    async 'A-screens-rail-1-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-306');
        const pre = await p.evaluate(() => { const S = window.__proto.state(); return { statementsDueForP306: S.statementsDue.filter((x) => x.patientId === 'p-306').length, pendingClaimsForP306: S.claims.filter((x) => x.patientId === 'p-306' && ['submitted', 'pended'].includes(x.status)).length, balances: Proto.store.balances('p-306') }; });
        const before = await stateJson(p);
        const btn0 = await button(p, 'ledger.statement.send');
        const seq0 = await lastSeq(p);
        const pressed1 = await click(p, 'ledger.statement.send'); await p.waitForTimeout(200);
        const ev1 = await after(p, seq0);
        const banner1 = await textOf(p, '.ledger-sent'); const live1 = await live(p);
        const after1 = await stateJson(p);
        const btn1 = await button(p, 'ledger.statement.send');
        const seq1 = await lastSeq(p);
        const pressed2 = await click(p, 'ledger.statement.send'); await p.waitForTimeout(200);
        const ev2 = await after(p, seq1);
        const banner2 = await textOf(p, '.ledger-sent'); const live2 = await live(p);
        const after2 = await stateJson(p);
        const btn2 = await button(p, 'ledger.statement.send');
        const dom2 = await refusalsDom(p);
        // Comparator: the store path on p-316 (seed statementsDue sd-1) writes disclosures.
        await hop(p, '#/biller/ledger/p-316'); await p.waitForTimeout(150);
        const seqC = await lastSeq(p);
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(200);
        const comparator = { writes: writes(await after(p, seqC)), banner: await textOf(p, '.ledger-sent') };
        const stateIdentical = before === after1 && after1 === after2;
        const precondition = pre.statementsDueForP306 === 0 && pre.pendingClaimsForP306 === 0 && pre.balances.patientDue > 0;
        const reproduced = precondition && pressed1 && !!banner1 && /frozen and sent/.test(banner1) && writes(ev1).length === 0 && refusalEvents(ev1).length === 0 && stateIdentical && pressed2 && writes(ev2).length === 0 && refusalEvents(ev2).length === 0 && dom2.length === 0 && !!btn2 && /Send statement/.test(btn2.text) && /\birreversible\b/.test(btn2.class);
        rec('A-screens-rail-1-2', 'On p-306 (no statementsDue row, no pending claim, $410 due) Send statement shows "Statement st-306-0903 frozen and sent by mail" and announces it, but writes no row and no event, the store is deep-equal, and a second press re-sends with the same banner while the button stays "Send statement" irreversible', 'A3, A4, B3 — an irreversible Send writes a row with a write event; the repeat is refused; the primary switches to Held when held; rail.js:180-181',
          reproduced, { precondition: pre, buttonBefore: btn0, firstPress: { pressed: pressed1, banner: banner1, announcement: live1, buttonAfter: btn1, eventsInRange: kinds(ev1), writes: writes(ev1), refusalEvents: refusalEvents(ev1), seqRange: range(ev1, seq0) }, secondPress: { pressed: pressed2, banner: banner2, announcement: live2, buttonAfter: btn2, eventsInRange: kinds(ev2), writes: writes(ev2), refusalEvents: refusalEvents(ev2), refusalDom: dom2, seqRange: range(ev2, seq1) }, stateDiff: { identicalAfterFirst: before === after1, identicalAfterSecond: after1 === after2 }, storePathComparator_p316: comparator });
      } finally { await c.close(); }
    },

    // RC-46 · B2 / CONTRACTS §6 · rail.js:178 builds a refusal with code 'statement_held' for a balance still waiting on a pending claim.
    // Negative control: if the code raised is in the §6 list parsed from CONTRACTS.md (e.g. a compliant zero_collect_refused or needs_second),
    // `inS6` is true and the check reports false; a refusal with any other code, or no refusal, is not this claim and reports false too.
    // The shape (verb ≤ 8 words, one 44 px control, Why, Held primary) is measured alongside so the severity rests on the code alone.
    async 'A-screens-rail-1-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-315');
        const pre = await p.evaluate(() => { const S = window.__proto.state(); return { statementsDueForP315: S.statementsDue.filter((x) => x.patientId === 'p-315').length, pendingClaims: S.claims.filter((x) => x.patientId === 'p-315' && ['submitted', 'pended'].includes(x.status)).map((x) => x.id + ':' + x.status + ':' + x.payer) }; });
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'ledger.statement.send'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const refusals = refusalEvents(ev);
        const dom = await refusalsDom(p);
        const primary = await button(p, 'ledger.statement.send');
        const { codes, text } = s6Codes();
        const raised = refusals.map((r) => r.code);
        const held = raised.includes('statement_held') && dom.some((d) => d.code === 'statement_held');
        const inS6 = codes.includes('statement_held');
        const verb = (dom.find((d) => d.code === 'statement_held') || {}).verb || null;
        const reproduced = pressed && held && codes.length > 0 && !inS6;
        rec('A-screens-rail-1-3', 'Send statement on p-315 (Cigna claim pended) raises a refusal whose code, statement_held, is not in the CONTRACTS §6 code list', 'B2 / CONTRACTS §6 — every refusal code the product raises is in the §6 list; rail.js:178',
          reproduced, { precondition: pre, pressed, refusalEvents: refusals, refusalDom: dom, verbWords: verb ? verb.split(/\s+/).length : null, primaryAfter: primary, s6Codes: codes, statementHeldInS6: inS6, s6TextSearched: text.slice(0, 400) + '…', writesInRange: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-54 · B1 · rail.js:77 (rail.sum.<key>), :127 (rail.explain), :58 (rail.open.<pid> default), :165-238 (ledger.*): the §4 table lists
    // only rail.tab.*, rail.alert and rail.close for the rail and has no Ledger row at all.
    // Negative control: when every rail.* and ledger.* id collected from reachable states matches a §4 entry or pattern (parsed from
    // CONTRACTS.md at run time), `unlisted` is empty and the check reports false. Only ids actually rendered (or returned by the public
    // rail.button default) are scored; ids from other screens' Rail buttons belong to those files' modules and are not counted here.
    async 'A-screens-rail-1-4'(b) {
      const { c, p } = await ctx(b);
      try {
        const seen = new Map();
        const collect = async (label) => { const ids = await p.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid') + '|' + e.tagName.toLowerCase())); for (const x of ids) { const [id, tag] = x.split('|'); if ((id.startsWith('rail.') || id.startsWith('ledger.')) && !seen.has(id)) seen.set(id, { firstSeenIn: label, tag }); } };
        await go(p, '#/biller/ledger/p-306'); await collect('p-306 landing (rail open)');
        await click(p, 'ledger.explain'); await collect('after ledger.explain');
        await click(p, 'rail.explain'); await collect('after rail.explain');
        await click(p, 'ledger.sendbiller'); await collect('after ledger.sendbiller');
        await click(p, 'ledger.asof'); await collect('after ledger.asof');
        await click(p, 'ledger.statement.preview'); await p.waitForTimeout(120); await collect('after ledger.statement.preview'); await click(p, 'ledger.statement.preview.close');
        await hop(p, '#/biller/ledger/p-316'); await p.waitForTimeout(150); await click(p, 'ledger.asof'); await collect('p-316 after ledger.asof');
        await click(p, 'ledger.asof.statement.sd-1'); await collect('p-316 after ledger.asof.statement.sd-1');
        await hop(p, '#/biller/ledger/p-999'); await p.waitForTimeout(150); await collect('p-999 (unknown id)');
        const defaultButtonId = await p.evaluate(() => Proto.screens.rail.button('p-306').getAttribute('data-testid'));
        if (defaultButtonId && !seen.has(defaultButtonId)) seen.set(defaultButtonId, { firstSeenIn: 'Proto.screens.rail.button(pid) default testid', tag: 'button' });
        const { rowsSearched, entries, patterns } = s4All();
        const ids = [...seen.keys()].sort();
        const unlisted = ids.filter((id) => !patterns.some((re) => re.test(id))).map((id) => Object.assign({ id }, seen.get(id)));
        const listed = ids.filter((id) => patterns.some((re) => re.test(id)));
        const reproduced = entries.length > 0 && unlisted.length > 0 && unlisted.some((u) => /^rail\.sum\./.test(u.id)) && unlisted.some((u) => /^ledger\./.test(u.id));
        rec('A-screens-rail-1-4', 'The rail renders rail.sum.<key>, rail.explain and (by default) rail.open.<pid>, and the Ledger screen renders ledger.* controls, none of which has a CONTRACTS §4 entry; §4 lists only rail.tab.*, rail.alert, rail.close and no Ledger row', 'B1 — every id in the DOM matches a §4 entry or pattern; rail.js:58, :77, :127, :165-238',
          reproduced, { idsRendered: ids, listedInS4: listed, unlisted, s4RowsSearched: rowsSearched.filter((r) => /Rail|Ledger|rail\./i.test(r)), s4EntryCount: entries.length, s4LedgerRowPresent: rowsSearched.some((r) => /^\|\s*Ledger\s*\|/.test(r)), defaultRailButtonTestid: defaultButtonId });
      } finally { await c.close(); }
    },

    // RC-236 · C5, A7 · rail.js:247 re-renders the rail on hashchange only; checkout.js rerender() redraws the canvas and Andon. After Post
    // the canvas three numbers and the store move while the open rail's Balance summary keeps the pre-Post figures until the next route change.
    // Negative control: a rail that re-renders with the canvas reads the same Credit as the canvas immediately after Post (railCredit ===
    // canvasCredit === money(store.credit)); then `disagree` is false and the check reports false. The Post must have written a ledger row, the
    // canvas must agree with the store, and the rail must catch up on the hop (proving the rail's figure was stale, not differently defined).
    async 'A-screens-rail-1-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const palette = await openChartViaPalette(p, 'okoro', '06/21/1985');
        const railAfterOpen = await railInfo(p);
        const railBefore = await threeNum(p, '#rail');
        await hop(p, '#/frontdesk/checkout/a-1044'); await p.waitForTimeout(200);
        const railOnCheckout = await railInfo(p);
        await click(p, 'checkout.tender.card'); await p.fill('[data-testid="checkout.card.number"]', '4242424242424242').catch(() => {});
        const seq0 = await lastSeq(p);
        const posted = await click(p, 'checkout.post'); await p.waitForTimeout(300);
        const ev = await after(p, seq0);
        const store = await p.evaluate(() => ({ balances: Proto.store.balances('p-303'), money: { credit: Proto.ui.money(Proto.store.balances('p-303').credit), patientDue: Proto.ui.money(Proto.store.balances('p-303').patientDue) } }));
        const railAfterPost = await threeNum(p, '#rail');
        const canvasAfterPost = await threeNum(p, '#canvas');
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(200);
        const railAfterHop = await threeNum(p, '#rail');
        const railCredit = railAfterPost[0] ? railAfterPost[0].Credit : null;
        const canvasCredit = canvasAfterPost[0] ? canvasAfterPost[0].Credit : null;
        const hopCredit = railAfterHop[0] ? railAfterHop[0].Credit : null;
        const ledgerWrites = writes(ev).filter((w) => w.startsWith('ledger/'));
        const disagree = railCredit != null && canvasCredit != null && railCredit !== canvasCredit;
        const reproduced = railAfterOpen.open && railOnCheckout.open && posted && ledgerWrites.length > 0 && canvasCredit === store.money.credit && disagree && hopCredit === canvasCredit;
        rec('A-screens-rail-1-5', 'With the Patient Rail open for Ines Okoro, Post on checkout a-1044 writes the $44 payment: the canvas reads Credit $44.00 and the store credit is 4400, but the rail Balance summary on the same page still reads Credit $0.00 until the next route change', 'C5, A7 — one canonical value per fact on one screen; a number is computed from state and moves with it; rail.js:247 re-renders only on hashchange',
          reproduced, { palette, railAfterOpen, railBalanceBeforePost: railBefore, railOnCheckout, postPressed: posted, writesInRange: writes(ev), ledgerWrites, seqRange: range(ev, seq0), storeAfterPost: store, railThreeNumbersAfterPost: railAfterPost, canvasThreeNumbersAfterPost: canvasAfterPost, railThreeNumbersAfterHop: railAfterHop, renderings: { railCredit, canvasCredit, storeCredit: store.money.credit, railCreditAfterHop: hopCredit }, disagreeOnSamePage: disagree });
      } finally { await c.close(); }
    },

    // RC-110 · B10 · rail.js:47-53 open() shows the rail and renders it but moves focus nowhere; palette.js:249-250 closes the dialog (which
    // restores focus to its opener, topbar.search) and then calls rail.open(). The Rail button path (rail.js:58) focuses rail.close itself.
    // Negative control: if the rail took focus when it opened, document.activeElement would be inside #rail (rail.close or a tab) and
    // `insideRail` would be true, so the check reports false. The rail must actually be open for the reading to count; the button path is
    // read in a fresh context as the comparator. Recorded in docs/14 "Open after round 2" (known_in_docs14 true).
    async 'A-screens-rail-1-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const seq0 = await lastSeq(p);
        const palette = await openChartViaPalette(p, 'okoro', '06/21/1985');
        const ev = await after(p, seq0);
        const rail = await railInfo(p);
        const focus = await active(p);
        const announcement = await live(p);
        // Comparator: the Rail button on a Board card, activated by keyboard (a pointer click on it is intercepted by the checkout queue at 1280 px).
        await go(p, '#/frontdesk/board');
        await press(p, 'board.card.a-1044.rail'); await p.waitForTimeout(200);
        const viaButton = { rail: await railInfo(p), focus: await active(p) };
        const reproduced = rail.open && !palette.paletteStillOpen && !focus.insideRail && focus.testid === 'topbar.search';
        rec('A-screens-rail-1-6', 'Opening a chart from the palette (search, row, date of birth, Open chart) opens the Patient Rail for Ines Okoro, but focus rests on topbar.search — the control that opened the palette — not inside the rail', 'B10 — after a mutation (PHI access row written) focus lands on the next action, never back on the opener; rail.js:47 open() never takes focus',
          reproduced, { palette, railAfterOpen: rail, focusAfterOpen: focus, announcement, phiWrites: writes(ev).filter((w) => w.startsWith('phiAccessLog/')), focusEventsInRange: ev.filter((e) => e.kind === 'focus').map((e) => e.seq + ':' + e.testid), seqRange: range(ev, seq0), railButtonComparator: viaButton, known_in_docs14: true });
      } finally { await c.close(); }
    },

    // RC-128 · B10 · rail.js:73 tabGo sets rail.msg and calls renderRail(), which replaceChildren()s the whole rail, removing the pressed tab
    // from the document; nothing is refocused (rail.explain at :127 refocuses itself by contrast).
    // Negative control: focus on the re-rendered tab, the .rail-msg status line or any node inside #rail gives insideRail true and the check
    // reports false. Each tab must have rendered its message (the action happened) before the BODY reading counts.
    async 'A-screens-rail-1-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1042.rail'); await p.waitForTimeout(200);
        const rail = await railInfo(p);
        const focusAfterButton = await active(p);
        const tabs = [];
        for (const t of ['imaging', 'claims', 'docs', 'profile']) {
          const seq0 = await lastSeq(p);
          const pressed = await press(p, 'rail.tab.' + t); await p.waitForTimeout(150);
          const ev = await after(p, seq0);
          tabs.push({ tab: t, pressed, msg: await textOf(p, '#rail .rail-msg'), focus: await active(p), tabStillInDom: !!(await p.$('[data-testid="rail.tab.' + t + '"]')), eventsInRange: kinds(ev), seqRange: range(ev, seq0) });
        }
        const reproduced = rail.open && tabs.length === 4 && tabs.every((x) => x.pressed && !!x.msg && x.focus.tag === 'BODY');
        rec('A-screens-rail-1-7', 'Pressing the Imaging, Claims, Docs and Profile rail tabs renders the summary line but leaves document.activeElement on BODY: renderRail replaces every child, including the tab that had focus', 'B10 — after an action focus lands on the next action or the state line, never on body; rail.js:73 with :108-131',
          reproduced, { railAfterButton: rail, focusAfterRailButton: focusAfterButton, tabs });
      } finally { await c.close(); }
    },

    // RC-129 · B10 · rail.js:165 the Rows button sets st.hi and calls rerender(r) with no focus testid; rerender (:241-244) only focuses when
    // one is given, and renderLedger remounts the canvas, so the pressed button is gone from the document.
    // Negative control: focus on the re-rendered Rows button, a highlighted row or any control (activeElement not BODY) reports false. The
    // highlight must have taken (ledger-hi rows > 0) for the BODY reading to count as this breach.
    async 'A-screens-rail-1-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-306');
        await click(p, 'ledger.explain'); await p.waitForTimeout(150);
        const chargeId = await p.evaluate(() => { const ch = window.__proto.state().ledger.find((e) => e.patientId === 'p-306' && e.kind === 'charge'); return ch ? ch.id : null; });
        const focusAfterExplain = await active(p);
        const rowsBtn = chargeId ? await button(p, 'ledger.explain.rows.' + chargeId) : null;
        const seq0 = await lastSeq(p);
        const pressed = chargeId ? await press(p, 'ledger.explain.rows.' + chargeId) : false; await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const hi = await p.evaluate(() => [...document.querySelectorAll('tr.ledger-hi')].map((tr) => tr.id));
        const focus = await active(p);
        const reproduced = pressed && hi.length > 0 && focus.tag === 'BODY';
        rec('A-screens-rail-1-8', 'On the Ledger, Explain → Rows highlights the charge and its related rows but drops focus to BODY: rerender(r) is called without a focus testid', 'B10 — after an action focus lands on the highlighted rows or stays on the control, never on body; rail.js:165',
          reproduced, { chargeId, rowsButtonBefore: rowsBtn, focusAfterExplain, pressed, highlightedRows: hi, focusAfterRows: focus, eventsInRange: kinds(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-130 · C8 · rail.js:61-67 summaryFor builds "Profile: <name>, DOB …, MRN, carrier" / "Docs: n filed notes, n disclosures, intake and
    // consent forms on file" / "Imaging: bitewings due today; …" and :73 passes it to announce() (#live) and the .rail-msg status line.
    // Negative control: an announcement that is one verb line — verb first, at most eight words (the §6 verb-line bound is the nearest number
    // in the contract for "one verb line") — has `words <= 8` or a first token that is not a noun label ending in ':'; then the check reports
    // false for that tab, and the claim needs all three tabs to breach.
    async 'A-screens-rail-1-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1042.rail'); await p.waitForTimeout(200);
        const rail = await railInfo(p);
        const tabs = [];
        for (const t of ['profile', 'docs', 'imaging']) {
          const pressed = await click(p, 'rail.tab.' + t); await p.waitForTimeout(200);
          const text = await live(p); const msg = await textOf(p, '#rail .rail-msg');
          const tokens = text.split(/\s+/).filter(Boolean);
          tabs.push({ tab: t, pressed, announcement: text, railMsg: msg, words: tokens.length, firstToken: tokens[0] || null, labelFirst: /^[A-Z][a-z]+:$/.test(tokens[0] || ''), overEight: tokens.length > 8 });
        }
        const reproduced = rail.open && tabs.length === 3 && tabs.every((x) => x.pressed && x.overEight && x.labelFirst);
        rec('A-screens-rail-1-9', 'The Profile, Docs and Imaging rail tabs announce 11-12 word noun-label summaries ("Profile: Marisol Vega, DOB 4/12/1978 · phone …0141, MRN-301, Delta Dental") to aria-live instead of one verb line', 'C8 — announcements (aria-live) are one verb line, not prose; rail.js:61-67, :73',
          reproduced, { railOpen: rail, tabs });
      } finally { await c.close(); }
    },

    // RC-131 · B7 · rail.js:103 prints n.filedAt raw (store.js:241 writes it as 'YYYY-MM-DD HH:MM') while the same rail prints every other date
    // through longDate (m/d/yyyy): "Last: 9/2/2026", "last full chart 7/1/2025".
    // Negative control: a note line whose date is m/d/yyyy (no ISO token) reports false; so does a run where the note did not file (filedNotes
    // for enc-9002 empty), since the line would then read "No filed note on record" and there is nothing to format.
    async 'A-screens-rail-1-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(150);
        const gate = await refusalsDom(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const filed = await p.evaluate(() => window.__proto.state().filedNotes.filter((n) => n.encounterId === 'enc-9002').map((n) => ({ id: n.id, author: n.author, filedAt: n.filedAt })));
        await hop(p, '#/dentist/ledger/p-302'); await p.waitForTimeout(200);
        const rail = await railInfo(p);
        const noteLine = await p.evaluate(() => { const s = document.querySelector('[data-testid="rail.sum.note"]'); const d = s ? s.parentElement : null; return d ? { body: (d.querySelector('.body') || {}).textContent.replace(/\s+/g, ' ').trim(), dateLine: ((d.querySelector('.body .small.muted') || {}).textContent || '').trim() } : null; });
        const railText = await textOf(p, '#rail');
        const isoTokens = (railText || '').match(/\b\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?\b/g) || [];
        const mdyTokens = (railText || '').match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || [];
        const filedAt = filed[0] ? filed[0].filedAt : null;
        const reproduced = filed.length > 0 && rail.open && !!noteLine && !!filedAt && noteLine.dateLine.includes(filedAt) && /\d{4}-\d{2}-\d{2}/.test(noteLine.dateLine) && mdyTokens.length > 0;
        rec('A-screens-rail-1-10', 'After filing the enc-9002 note, the rail\'s Last filed note line reads "Filed by Dr. Hana Kim · 2026-09-03 08:40" while every other date in the same rail is m/d/yyyy', 'B7 — one date format per context; rail.js:103 prints filedAt raw, :87 and :93 use longDate',
          reproduced, { fileGate: gate, filedNotes: filed, railOpen: rail, noteLine, isoTokensInRail: isoTokens, mdyTokensInRail: mdyTokens });
      } finally { await c.close(); }
    },

    // RC-132 · B9 · rail.js:16, :30 led[pid] is a module map keyed by patient id only; sign-out and a new persona do not clear it, so the As-of
    // date one user chose is what the next user sees on landing.
    // Negative control: per-user state gives the next persona a fresh ledger — no .ledger-asofline, the As-of button reading "As of today" —
    // so `frontdeskAsofLine` is null and the check reports false. The biller's choice must have taken (her own asof line present) and the
    // persona and its user id must differ between the two readings for the carry-over to be scored.
    async 'A-screens-rail-1-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-316');
        await click(p, 'ledger.asof'); await click(p, 'ledger.asof.statement.sd-1'); await p.waitForTimeout(200);
        const who = () => p.evaluate(() => { const S = window.__proto.state(); const per = window.__proto.persona; return { persona: per, userId: S.personaUser[per] || null, hash: location.hash }; });
        const biller = { who: await who(), asofLine: await textOf(p, '.ledger-asofline'), asofButton: await button(p, 'ledger.asof') };
        await hop(p, '#/signin'); await p.waitForTimeout(200);
        const signin = { hash: await p.evaluate(() => location.hash), railOpen: (await railInfo(p)).open, h1: await textOf(p, '#canvas h1') };
        await hop(p, '#/frontdesk/ledger/p-316'); await p.waitForTimeout(250);
        const frontdesk = { who: await who(), asofLine: await textOf(p, '.ledger-asofline'), asofButton: await button(p, 'ledger.asof'), rowsShown: await p.evaluate(() => document.querySelectorAll('.ledger-table tbody tr[id^="row-"]').length) };
        const reproduced = !!biller.asofLine && /As of 9\/2/.test(biller.asofLine) && biller.who.persona === 'biller' && frontdesk.who.persona === 'frontdesk' && biller.who.userId !== frontdesk.who.userId && !!frontdesk.asofLine && /As of 9\/2/.test(frontdesk.asofLine);
        rec('A-screens-rail-1-11', 'A biller sets the p-316 ledger As-of to statement sd-1 (9/2); after sign-out the front-desk persona opens the same ledger and lands on "As of 9/2: … rows, posted on or before 9/2/2026" — another user\'s historical view', 'B9 — per-user view state is keyed by user id, never global; rail.js:16 and :30 key led by patient id only',
          reproduced, { biller, signin, frontdesk, sameUser: biller.who.userId === frontdesk.who.userId });
      } finally { await c.close(); }
    },
  };
};
