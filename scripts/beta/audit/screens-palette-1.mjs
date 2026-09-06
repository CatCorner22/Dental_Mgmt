// Audit checks for prototype/js/screens/palette.js (command palette), chunk screens-palette-1
// (root causes RC-35, 52, 103, 104, 105, 106, 107, 108, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const kinds = (ev) => ev.map((e) => e.seq + ':' + e.kind + (e.testid ? ':' + e.testid : e.table ? ':' + e.table + '/' + e.id : e.key ? ':' + e.key : e.code ? ':' + e.code : ''));
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? { tag: 'BODY', testid: null } : { tag: a.tagName, testid: a.getAttribute('data-testid'), id: a.id || null, text: (a.textContent || '').trim().slice(0, 40) }; });
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const hash = (p) => p.evaluate(() => location.hash);
  const who = (p) => p.evaluate(() => { const per = window.__proto.persona; const S = window.__proto.state(); return { persona: per, userId: S.personaUser[per] || null, currentUser: Proto.store.currentUser().id }; });
  const paletteOpen = (p) => p.evaluate(() => ({ isOpen: Proto.screens.palette.isOpen(), dialog: !!document.querySelector('#dialogs .dialog'), inputPresent: !!document.querySelector('[data-testid="palette.input"]'), dobPresent: !!document.querySelector('[data-testid="palette.confirm.dob"]') }));
  const rows = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid^="palette.row."]')].map((r) => ({ testid: r.getAttribute('data-testid'), label: ((r.querySelector('.lbl') || {}).textContent || '').trim(), syn: ((r.querySelector('.syn') || {}).textContent || '').trim(), chip: ((r.querySelector('.chip') || {}).textContent || '').replace(/[^A-Za-z ]/g, '').trim(), selected: r.getAttribute('aria-selected') })));
  const hint = (p) => p.evaluate(() => ((document.getElementById('palette-hint') || {}).textContent || '').trim());
  const groups = (p) => p.evaluate(() => [...document.querySelectorAll('.pal-groups')].map((g) => g.textContent.trim()));
  const openPalette = async (p) => { await click(p, 'topbar.search'); await p.waitForTimeout(150); };
  const search = async (p, q) => { await p.fill('[data-testid="palette.input"]', q); await p.waitForTimeout(200); return rows(p); };
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('#dialogs [data-testid]')].map((e) => e.getAttribute('data-testid')));
  const moneyTabs = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid^="money.tab."]')].map((e) => ({ tab: e.getAttribute('data-testid'), selected: e.getAttribute('aria-selected') })));
  const selectedTab = async (p) => { const t = (await moneyTabs(p)).filter((x) => x.selected === 'true').map((x) => x.tab); return t.length === 1 ? t[0] : t; };
  const gateOnScreen = (p) => p.evaluate(() => ({
    dialog: !!document.querySelector('#dialogs .dialog'),
    refusals: [...document.querySelectorAll('.refusal')].map((r) => r.dataset.code || 'no-code'),
    closedayConfirm: !!document.querySelector('[data-testid="close.closeday.confirm"]'),
    closedayCancel: !!document.querySelector('[data-testid="close.closeday.cancel"]'),
    closedayPrimary: (() => { const b = document.querySelector('[data-testid="close.closeday"]'); return b ? { text: b.textContent.trim(), class: b.className } : null; })(),
    postmatchedPrimary: (() => { const b = document.querySelector('[data-testid="money.era.era-1.postmatched"]'); return b ? { text: b.textContent.trim(), class: b.className } : null; })(),
    eraReadbackControls: document.querySelectorAll('[data-testid^="money.era.line."]').length,
    h1: ((document.querySelector('#canvas h1') || {}).textContent || '').trim(),
  }));
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => { const bx = b.getBoundingClientRect(); return { text: b.textContent.trim(), w: Math.round(bx.width), h: Math.round(bx.height) }; }),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  const button = (p, tid) => p.evaluate((tid) => { const b = document.querySelector('[data-testid="' + tid + '"]'); return b ? { text: b.textContent.trim(), class: b.className, disabled: b.disabled, opacity: getComputedStyle(b).opacity } : null; }, tid);
  const perTable = (p) => p.evaluate(() => { const S = window.__proto.state(); const out = {}; for (const k of Object.keys(S)) out[k] = JSON.stringify(S[k]); return out; });
  const CONTRACTS = () => { try { return fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return ''; } };
  // §4: every backticked entry in every row of the table; <a|b> enumerates, a bare <x> admits one seed-id or code token.
  const s4All = () => {
    const t = CONTRACTS(); const sec = t.slice(t.indexOf('## 4.'), t.indexOf('## 5.'));
    const rowsS4 = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*Screen\s*\|/.test(l) && !/^\|---/.test(l));
    const entries = rowsS4.flatMap((row) => [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    const patterns = entries.map((e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+') + '$'));
    return { rowsSearched: rowsS4.map((r) => r.trim()), entries, patterns };
  };

  return {
    // RC-35 · B9 · palette.js:9 `const recents = []` is one module-scope list; remember() (:36) and currentRows() (:99) never key it by
    // Proto.store.currentUser().id, so rows the front desk (u-fd-1) activated are what the biller (u-bl-1) sees under "Recents".
    // Negative control: per-user recents give the biller an empty palette on open (no "Recents" group, zero palette.row.*) or rows that are not
    // the front desk's labels; then `leaked` is false and the check reports false. The front desk's activations must have been remembered
    // (recents API non-empty after them) and the two personas must map to different user ids, or the reading is not this breach.
    async 'A-screens-palette-1-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const fd = await who(p);
        const activated = [];
        for (const q of ['chairs', 'roles', 'money desk']) {
          await openPalette(p);
          const found = await search(p, q);
          const row0 = found[0] || null;
          const pressed = await click(p, 'palette.row.0'); await p.waitForTimeout(200);
          activated.push({ query: q, row0, pressed, hashAfter: await hash(p), paletteAfter: await paletteOpen(p) });
        }
        const recentsAfterFrontdesk = await p.evaluate(() => Proto.screens.palette.recents());
        await hop(p, '#/biller/money'); await p.waitForTimeout(200);
        const biller = await who(p);
        await openPalette(p);
        const billerRows = await rows(p);
        const billerGroups = await groups(p);
        const billerHint = await hint(p);
        const billerRecentsApi = await p.evaluate(() => Proto.screens.palette.recents());
        const fdLabels = activated.filter((a) => a.row0 && a.pressed).map((a) => a.row0.label);
        const leaked = billerRows.length > 0 && billerGroups.includes('Recents') && billerRows.every((r) => fdLabels.includes(r.label));
        const reproduced = fd.userId !== biller.userId && recentsAfterFrontdesk.length > 0 && leaked;
        rec('A-screens-palette-1-1', 'Rows the front desk (u-fd-1) activated in the palette appear under "Recents" when the biller (u-bl-1) opens the palette on Money Desk with nothing typed: the recents list is one module variable shared across users', 'B9 — per-user state (recents) is keyed by user id, never global; palette.js:9, :36-41, :99',
          reproduced, { frontdesk: fd, activated, recentsApiAfterFrontdesk: recentsAfterFrontdesk, biller, billerPaletteOnOpen: { rows: billerRows, groups: billerGroups, hint: billerHint, recentsApi: billerRecentsApi }, frontdeskLabels: fdLabels, leaked });
      } finally { await c.close(); }
    },

    // RC-52 · B1 · palette.js:88 (palette.close), :90 (palette.how), :213/:268/:269 (palette.confirm.go), :223 (palette.confirm.back): the §4
    // Palette row lists only palette.input, palette.row.<n>, palette.confirm.dob.
    // Negative control: when every palette.* id rendered in the search step and the confirm step matches a §4 entry or pattern (parsed from
    // CONTRACTS.md at run time), `unlisted` is empty and the check reports false. The four ids must actually be in the DOM (they carry click
    // handlers) for the breach to count; refusal.* ids belong to the shared component's row and are matched against it.
    async 'A-screens-palette-1-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await openPalette(p);
        const searchIds = await testids(p);
        const found = await search(p, 'veg');
        await click(p, 'palette.row.0'); await p.waitForTimeout(150);
        const confirmIds = await testids(p);
        await p.fill('[data-testid="palette.confirm.dob"]', '01/01/1900'); await click(p, 'palette.confirm.go'); await p.waitForTimeout(150);
        const mismatchIds = await testids(p);
        const { rowsSearched, entries, patterns } = s4All();
        const ids = [...new Set([...searchIds, ...confirmIds, ...mismatchIds])].sort();
        const unlisted = ids.filter((id) => !patterns.some((re) => re.test(id)));
        const listed = ids.filter((id) => patterns.some((re) => re.test(id)));
        const four = ['palette.close', 'palette.how', 'palette.confirm.go', 'palette.confirm.back'];
        const reproduced = entries.length > 0 && four.every((id) => ids.includes(id) && unlisted.includes(id));
        rec('A-screens-palette-1-2', 'The palette renders palette.close, palette.how (search step) and palette.confirm.go, palette.confirm.back (confirm step), none of which matches a CONTRACTS §4 entry; the §4 Palette row lists only palette.input, palette.row.<n>, palette.confirm.dob', 'B1 — every id in the DOM matches a §4 entry or pattern; palette.js:88, :90, :213, :223, :268-269',
          reproduced, { searchStepIds: searchIds, confirmStepIds: confirmIds, mismatchStepIds: mismatchIds, row0: found[0] || null, listedInS4: listed, unlisted, s4PaletteRow: rowsSearched.filter((r) => /^\|\s*Palette\s*\|/.test(r)), s4EntryCount: entries.length });
      } finally { await c.close(); }
    },

    // RC-103 · A2 · palette.js:173 and :193 call Proto.router.go(persona, 'money') with no tab and never Proto.screens.moneydesk.setTab; the
    // Money Desk keeps `tab` as a module variable (moneydesk.js:17), so "ERA batch" lands on whatever tab was last used and "Claim c-88"
    // lands on the default ERA tab where the claim is not rendered.
    // Negative control: a palette that passes the tab gives aria-selected="true" on money.tab.era after "ERA batch" (from Denials) and a
    // money.denial.c-88.* control on the canvas after the claim row; then both `eraBreach` and `claimBreach` are false and the check reports
    // false. The row labels are recorded so the rows activated are the ones the claim names, and the Denials tab must have been selected first.
    // The claim half runs in its own browser context: go() to the same file with a new hash is a same-document navigation, so the Money Desk
    // module's `tab` would otherwise carry the ERA half's 'denials' into the claim landing.
    async 'A-screens-palette-1-3'(b) {
      const { c, p } = await ctx(b);
      const { c: c2, p: p2 } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.tab.denials'); await p.waitForTimeout(150);
        const tabBefore = await selectedTab(p);
        await openPalette(p);
        const eraRows = await search(p, 'eob');
        const seq0 = await lastSeq(p);
        const pressedEra = await click(p, 'palette.row.0'); await p.waitForTimeout(250);
        const eraLanding = { hash: await hash(p), selectedTab: await selectedTab(p), announcement: await live(p), eraBatchOnCanvas: !!(await p.$('[data-testid="money.era.era-1.postmatched"], [data-testid^="money.era.line."]')), eventsInRange: kinds(await after(p, seq0)) };
        // Claim row from a fresh landing in a second context (module tab is 'era' on first render).
        await go(p2, '#/frontdesk/board');
        await openPalette(p2);
        const claimRows = await search(p2, 'c-88');
        const seq1 = await lastSeq(p2);
        const pressedClaim = await click(p2, 'palette.row.0'); await p2.waitForTimeout(250);
        const claimControls = () => p2.evaluate(() => [...document.querySelectorAll('[data-testid*="c-88"]')].map((e) => e.getAttribute('data-testid')));
        const claimLanding = { hash: await hash(p2), selectedTab: await selectedTab(p2), announcement: await live(p2), claimControlOnCanvas: await claimControls(), claimTextOnCanvas: await p2.evaluate(() => /c-88/.test(document.getElementById('canvas').textContent)), eventsInRange: kinds(await after(p2, seq1)) };
        await click(p2, 'money.tab.denials'); await p2.waitForTimeout(150);
        const afterDenialsClick = { selectedTab: await selectedTab(p2), claimControlOnCanvas: await claimControls() };
        const eraRow0 = eraRows[0] || null; const claimRow0 = claimRows[0] || null;
        const eraBreach = pressedEra && !!eraRow0 && /ERA batch/.test(eraRow0.label) && tabBefore === 'money.tab.denials' && /\/money$/.test(eraLanding.hash) && eraLanding.selectedTab !== 'money.tab.era';
        const claimBreach = pressedClaim && !!claimRow0 && /Claim c-88/.test(claimRow0.label) && /\/money$/.test(claimLanding.hash) && claimLanding.claimControlOnCanvas.length === 0 && afterDenialsClick.claimControlOnCanvas.length > 0;
        rec('A-screens-palette-1-3', 'From the Denials tab, the palette row "ERA batch" routes to #/biller/money and the Denials tab stays selected; the row "Claim c-88 · Delta Dental" routes to Money Desk on the ERA tab where no c-88 control is rendered until Denials is clicked', 'A2 — the control does what its label promises (the named tab or row is on screen); palette.js:173, :193; moneydesk.js:17 module tab, setTab unused',
          eraBreach || claimBreach, { eraBatch: { tabSelectedBefore: tabBefore, row0: eraRow0, pressed: pressedEra, landing: eraLanding, breach: eraBreach }, claim: { row0: claimRow0, pressed: pressedClaim, landing: claimLanding, afterDenialsClick, breach: claimBreach }, known_in_docs14: true });
      } finally { await c.close(); await c2.close(); }
    },

    // RC-104 · A2 · palette.js:24 prints "Opens its gate first; nothing runs from here" on irreversible rows and :194 announces
    // "<label>: opens its gate; nothing executed", but :193 only calls router.go(persona, route): no dialog, confirm step or refusal is opened.
    // Negative control: a gate on screen after activation — a #dialogs .dialog, close.closeday.confirm (the Close day confirm step), a .refusal,
    // or an ERA read-back control — makes `noGateClose` / `noGatePost` false and the check reports false. The row's own promise (syn text, Gated
    // chip) and the announcement must have been rendered, or the user was never told a gate would open.
    async 'A-screens-palette-1-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await openPalette(p);
        const closeRows = await search(p, 'close day');
        const seq0 = await lastSeq(p);
        const pressedClose = await click(p, 'palette.row.0'); await p.waitForTimeout(300);
        const ev0 = await after(p, seq0);
        const closeLanding = { hash: await hash(p), announcement: await live(p), gate: await gateOnScreen(p), writes: writes(ev0), refusalEvents: refusalEvents(ev0), eventsInRange: kinds(ev0), seqRange: range(ev0, seq0) };
        await openPalette(p);
        const postRows = await search(p, 'post matched');
        const seq1 = await lastSeq(p);
        const pressedPost = await click(p, 'palette.row.0'); await p.waitForTimeout(300);
        const ev1 = await after(p, seq1);
        const postLanding = { hash: await hash(p), announcement: await live(p), gate: await gateOnScreen(p), writes: writes(ev1), refusalEvents: refusalEvents(ev1), eventsInRange: kinds(ev1), seqRange: range(ev1, seq1) };
        const closeRow0 = closeRows[0] || null; const postRow0 = postRows[0] || null;
        const promised = (r) => !!r && /Opens its gate/.test(r.syn) && /Gated/.test(r.chip);
        const noGate = (g) => !g.dialog && g.refusals.length === 0 && !g.closedayConfirm && g.eraReadbackControls === 0;
        const noGateClose = pressedClose && promised(closeRow0) && /Close day/.test(closeRow0.label) && /opens its gate/.test(closeLanding.announcement) && /\/close$/.test(closeLanding.hash) && noGate(closeLanding.gate) && !!closeLanding.gate.closedayPrimary && closeLanding.refusalEvents.length === 0;
        const noGatePost = pressedPost && promised(postRow0) && /Post matched/.test(postRow0.label) && /opens its gate/.test(postLanding.announcement) && /\/money$/.test(postLanding.hash) && noGate(postLanding.gate) && !!postLanding.gate.postmatchedPrimary && postLanding.refusalEvents.length === 0;
        rec('A-screens-palette-1-4', 'The gated rows "Close day" and "Post matched ERA lines" read "Opens its gate first; nothing runs from here" and announce "<label>: opens its gate; nothing executed", but activation only routes to the screen: no dialog, no confirm control, no refusal, no refusal event — only the ordinary primary button', 'A2 — the control does what its label and announcement promise; palette.js:24, :193-194',
          noGateClose && noGatePost, { closeDay: { row0: closeRow0, pressed: pressedClose, landing: closeLanding, noGate: noGateClose }, postMatched: { row0: postRow0, pressed: pressedPost, landing: postLanding, noGate: noGatePost } });
      } finally { await c.close(); }
    },

    // RC-105 · A2 · palette.js:159-160 Home/End on a focused row set st.sel and aria-selected but never move focus; Enter on a focused row
    // button fires its native click (activate(row) at :125), so the row opened is the focused one, not the highlighted one.
    // Negative control: if Home moved focus with the highlight (activeElement palette.row.0) or Enter opened the highlighted row, the confirm step
    // would name row 0's patient; then `wrongRowOpened` is false and the check reports false. Two distinct patient rows must be listed, focus must
    // be verified on row 1 before Home, and the highlight must have moved to row 0 after Home, or the reading is not this breach.
    async 'A-screens-palette-1-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await openPalette(p);
        const found = await search(p, 'veg');
        const focusStart = await active(p);
        await p.keyboard.press('Tab'); await p.waitForTimeout(60);
        await p.keyboard.press('Tab'); await p.waitForTimeout(60);
        const beforeHome = { focus: await active(p), rows: await rows(p) };
        await p.keyboard.press('Home'); await p.waitForTimeout(80);
        const afterHome = { focus: await active(p), rows: await rows(p), hint: await hint(p) };
        const seq0 = await lastSeq(p);
        await p.keyboard.press('Enter'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const afterEnter = { step: await paletteOpen(p), whoLine: await p.evaluate(() => ((document.querySelector('.pal-who .lbl') || {}).textContent || '').trim()), h2: await p.evaluate(() => ((document.querySelector('#dialogs h2') || {}).textContent || '').trim()), eventsInRange: kinds(ev), seqRange: range(ev, seq0) };
        const patients = found.filter((r) => r.chip === 'Patient');
        const label0 = found[0] ? found[0].label : null; const label1 = found[1] ? found[1].label : null;
        const distinct = patients.length >= 2 && label0 && label1 && label0 !== label1;
        const focusedRow1 = beforeHome.focus.testid === 'palette.row.1';
        const highlightMoved = afterHome.rows[0] && afterHome.rows[0].selected === 'true' && afterHome.rows[1] && afterHome.rows[1].selected === 'false';
        const focusStayed = afterHome.focus.testid === 'palette.row.1';
        const wrongRowOpened = afterEnter.step.dobPresent && afterEnter.whoLine.startsWith(label1) && !afterEnter.whoLine.startsWith(label0);
        const reproduced = distinct && focusedRow1 && highlightMoved && focusStayed && wrongRowOpened;
        rec('A-screens-palette-1-5', 'With palette.row.1 focused, Home highlights palette.row.0 (aria-selected true) but focus stays on row 1, and Enter opens row 1\'s patient in the confirm step while the hint says "Arrow keys move, Enter opens"', 'A2 — the control does what the hint promises: Enter opens the highlighted row; palette.js:159-160, :125',
          reproduced, { rowsFound: found, focusAtStart: focusStart, beforeHome, afterHome, afterEnter, labels: { row0: label0, row1: label1 }, focusedRow1BeforeHome: focusedRow1, highlightMovedToRow0: highlightMoved, focusStayedOnRow1: focusStayed, confirmNamesRow1: wrongRowOpened });
      } finally { await c.close(); }
    },

    // RC-106 · A3 · palette.js:247 Proto.events.write('phiAccessLog', p.id) records a write event directly; no store table of that name exists
    // (store.js:318 TABLES) and nothing is appended, so the log claims a write the state cannot show.
    // Negative control: a compliant PHI-access write appends a row to a table the snapshot carries (phiAccessLog present in state() with one more
    // row after the open); then `hasTable` is true and the check reports false. The write event must have been recorded and the chart must have
    // opened (palette closed, rail open or ledger route), or the path under test did not run.
    async 'A-screens-palette-1-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await openPalette(p);
        const found = await search(p, 'veg');
        await click(p, 'palette.row.0'); await p.waitForTimeout(150);
        const patient = await p.evaluate(() => { const S = window.__proto.state(); const p1 = S.patients.find((x) => x.name === 'Marisol Vega'); return p1 ? { id: p1.id, dob: p1.dob } : null; });
        const before = await perTable(p);
        await p.fill('[data-testid="palette.confirm.dob"]', '04/12/1978'); await p.waitForTimeout(60);
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'palette.confirm.go'); await p.waitForTimeout(300);
        const ev = await after(p, seq0);
        const afterT = await perTable(p);
        const opened = { palette: await paletteOpen(p), railOpen: await p.evaluate(() => { const r = document.getElementById('rail'); return !!r && !r.hidden; }), hash: await hash(p), announcement: await live(p) };
        const tablesBefore = Object.keys(before); const tablesAfter = Object.keys(afterT);
        const changed = tablesAfter.filter((k) => before[k] !== afterT[k]);
        const phiWrites = writes(ev).filter((w) => w.table === 'phiAccessLog');
        const hasTable = tablesAfter.includes('phiAccessLog') || tablesBefore.includes('phiAccessLog');
        const phiRows = hasTable ? JSON.parse(afterT.phiAccessLog || '[]').length : null;
        const reproduced = pressed && !!patient && phiWrites.length > 0 && phiWrites.every((w) => w.id === patient.id) && !hasTable && !opened.palette.isOpen;
        rec('A-screens-palette-1-6', 'Opening Marisol Vega\'s chart from the palette records a write event {table: phiAccessLog, id: p-301}, but the store has no phiAccessLog table and no row is appended anywhere for that write', 'A3 — a mutation writes one write event per table it changes, with table and id, and the table exists so the appended row is in state(); palette.js:247',
          reproduced, { row0: found[0] || null, patient, pressed, writesInRange: writes(ev), phiWrites, eventsInRange: kinds(ev), seqRange: range(ev, seq0), stateTables: tablesAfter.length, phiAccessLogInState: hasTable, phiAccessLogRows: phiRows, tablesChangedByOpen: changed, chartOpened: opened });
      } finally { await c.close(); }
    },

    // RC-107 · B10 · palette.js:263 swapGo(true) replaces the focused "Open chart" button with a new "Held" button (st.go.replaceWith at :270);
    // the removed node was document.activeElement, so focus falls to BODY while the refusal's control and the date field are both on screen.
    // Negative control: focus on refusal.control, palette.confirm.dob or the new Held button (activeElement not BODY) reports false. The refusal
    // must carry code second_identifier (any other refusal, or none, is not this claim), the primary must read Held, and the Open chart button
    // must have held focus before the press (press() focuses it and sends Enter) for the BODY reading to count.
    async 'A-screens-palette-1-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await openPalette(p);
        const found = await search(p, 'veg');
        await click(p, 'palette.row.0'); await p.waitForTimeout(150);
        await p.fill('[data-testid="palette.confirm.dob"]', '04/13/1978'); await p.waitForTimeout(60);
        await p.focus('[data-testid="palette.confirm.go"]');
        const focusBefore = await active(p);
        const goBefore = await button(p, 'palette.confirm.go');
        const seq0 = await lastSeq(p);
        const pressed = await press(p, 'palette.confirm.go'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const focusAfter = await active(p);
        const dom = await refusalsDom(p);
        const goAfter = await button(p, 'palette.confirm.go');
        const paletteState = await paletteOpen(p);
        const refusals = refusalEvents(ev);
        const gateFired = refusals.some((r) => r.code === 'second_identifier') && dom.some((d) => d.code === 'second_identifier' && d.controls.length === 1);
        const held = !!goAfter && /Held/.test(goAfter.text) && /\bheld\b/.test(goAfter.class);
        const reproduced = pressed && focusBefore.testid === 'palette.confirm.go' && gateFired && held && paletteState.dobPresent && focusAfter.tag === 'BODY';
        rec('A-screens-palette-1-7', 'After a date-of-birth mismatch, Open chart (focused) is replaced by the Held button and the second_identifier refusal renders with one control, but document.activeElement is BODY: neither the refusal control, the date field nor Held has focus', 'B10 — after a gate fires focus lands on the next action, never on body; palette.js:263, :270',
          reproduced, { row0: found[0] || null, focusBeforePress: focusBefore, goButtonBefore: goBefore, pressed, refusalEvents: refusals, refusalDom: dom, goButtonAfter: goAfter, paletteAfter: paletteState, focusAfterPress: focusAfter, eventsInRange: kinds(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-108 · B10 · palette.js:70-94 renderSearch() builds a new input and replaceChildren()s the dialog body without focusing it; the steer
    // paths at :180 (route null, e.g. sidekick → Patient Rail), :186 (route ledger) and the Back to results button at :223 all call it, so the
    // clicked row / old input is removed and activeElement is BODY while the palette stays open.
    // Negative control: a renderSearch that focuses its input gives activeElement palette.input (inputFocused true) on every path and the check
    // reports false. Each path must have left the palette open with its steer hint (or the "Search" heading for Back) on screen, or the reading
    // is of a closed dialog, not this breach.
    async 'A-screens-palette-1-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const read = async (label) => ({ path: label, palette: await paletteOpen(p), focus: await active(p), inputFocused: await p.evaluate(() => document.activeElement === document.querySelector('[data-testid="palette.input"]')), hint: await hint(p), h2: await p.evaluate(() => ((document.querySelector('#dialogs h2') || {}).textContent || '').trim()) });
        const paths = [];
        // (a) steer row by click
        await openPalette(p); const a = await search(p, 'sidekick'); await click(p, 'palette.row.0'); await p.waitForTimeout(150);
        paths.push(Object.assign(await read('sidekick → click palette.row.0'), { row0: a[0] || null }));
        await p.keyboard.press('Escape'); await p.waitForTimeout(120);
        // (b) steer row by Enter in the input
        await openPalette(p); const bRows = await search(p, 'sidekick'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        paths.push(Object.assign(await read('sidekick → Enter in palette.input'), { row0: bRows[0] || null }));
        await p.keyboard.press('Escape'); await p.waitForTimeout(120);
        // (c) ledger steer row
        await openPalette(p); const cRows = await search(p, 'ledger'); await click(p, 'palette.row.0'); await p.waitForTimeout(150);
        paths.push(Object.assign(await read('ledger → click palette.row.0'), { row0: cRows[0] || null }));
        await p.keyboard.press('Escape'); await p.waitForTimeout(120);
        // (d) Back to results from the confirm step
        await openPalette(p); const dRows = await search(p, 'bra'); await click(p, 'palette.row.0'); await p.waitForTimeout(150);
        const confirmStep = await paletteOpen(p);
        await click(p, 'palette.confirm.back'); await p.waitForTimeout(150);
        paths.push(Object.assign(await read('bra → palette.row.0 → click palette.confirm.back'), { row0: dRows[0] || null, confirmStepBeforeBack: confirmStep }));
        const steerShown = (x) => x.palette.isOpen && x.palette.inputPresent && /opens from a patient/i.test(x.hint);
        const ok = [steerShown(paths[0]), steerShown(paths[1]), steerShown(paths[2]) && /ledger/i.test(paths[2].hint), paths[3].palette.isOpen && paths[3].palette.inputPresent && paths[3].h2 === 'Search' && paths[3].confirmStepBeforeBack.dobPresent];
        const reproduced = ok.every(Boolean) && paths.every((x) => x.focus.tag === 'BODY' && !x.inputFocused);
        rec('A-screens-palette-1-8', 'After a steer row (sidekick → Patient Rail, by click or Enter; ledger) or Back to results re-renders the search step, the palette stays open with its new input but document.activeElement is BODY on all four paths', 'B10 — after an in-dialog step change focus lands on the next control (the search input), never on body; palette.js:70-94, :180, :186, :223',
          reproduced, { paths, pathRenderedAsExpected: ok });
      } finally { await c.close(); }
    },
  };
};
