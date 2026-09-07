// Audit checks for prototype/js/screens/rail.js (Patient Rail and the Ledger screen), chunk screens-rail-2
// (root causes RC-133, 134, 190, 191, 192, 193, 194, 195, 196, 246, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// CSS consequences are read through getComputedStyle and geometry only; document.styleSheets is never scanned
// (cssRules throws over file:// and a catch-and-continue would silently return an empty list).
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  // A button as it stands in the DOM: identity class, aria-pressed word, and whether ui.btn's ✓ mark is present.
  const button = (p, tid) => p.evaluate((t) => {
    const e = document.querySelector('[data-testid="' + t + '"]');
    if (!e) return null;
    return { text: e.textContent.trim(), class: e.className, kind: ['irreversible', 'reversible', 'quiet', 'held'].filter((k) => e.classList.contains(k)), pressed: e.getAttribute('aria-pressed'), pressmark: !!e.querySelector('.pressmark') };
  }, tid);
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const railMsg = (p) => p.evaluate(() => ((document.querySelector('#rail .rail-msg') || {}).textContent || '').trim() || null);
  const railInfo = (p) => p.evaluate(() => { const r = document.getElementById('rail'); return { open: !!r && !r.hidden, name: r && !r.hidden ? ((r.querySelector('.rail-head .name') || {}).textContent || '').trim() : null }; });
  const h1 = (p) => p.evaluate(() => ((document.querySelector('#canvas h1') || {}).textContent || '').trim() || null);
  // Every ledger row as an array of cell strings, plus the header row, so the Reason column can be named by index.
  const ledgerRows = (p) => p.evaluate(() => {
    const t = document.querySelector('table.ledger-table'); if (!t) return null;
    return { head: [...t.querySelectorAll('thead th')].map((e) => e.textContent.trim()), rows: [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())) };
  });
  // The open summary body under a rail summary key (rail.sum.<key>).
  const railSummary = (p, key) => p.evaluate((k) => { const s = document.querySelector('[data-testid="rail.sum.' + k + '"]'); const d = s ? s.parentElement : null; const body = d ? d.querySelector('.body') : null; return body ? body.textContent.replace(/\s+/g, ' ').trim() : null; }, key);
  const filedNotes = (p, encId) => p.evaluate((e) => window.__proto.state().filedNotes.filter((n) => n.encounterId === e).map((n) => n.id), encId);

  return {
    // RC-133 · B5 · rail.js:56-58 button() computes `pressed: pressed(rail.pid === pid)` when the HOST screen renders its card;
    // the onClick calls open(pid) → renderRail(), which redraws #rail only, so the Board card's own button keeps the attribute it
    // was built with. Negative control: a control whose pressed state is recomputed when it acts reads aria-pressed="true" with a
    // ✓ immediately after the press (that is exactly what the same button reads after a route change forces the Board to redraw,
    // measured here as `afterRouteRedraw`), and the check reports false. The rail must actually be open for this patient before a
    // "false" reading counts as a breach — a press that opened nothing is not this claim.
    async 'A-screens-rail-2-1'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/frontdesk/board');
        const before = await button(p, 'board.card.a-1042.rail');
        const pressed = await click(p, 'board.card.a-1042.rail'); await p.waitForTimeout(200);
        const after = await button(p, 'board.card.a-1042.rail');
        const rail = await railInfo(p);
        const railPid = await p.evaluate(() => Proto.screens.rail.isOpen());
        // Comparator in the same run: leave and come back, which makes the Board rebuild the card.
        await hop(p, '#/frontdesk/money'); await hop(p, '#/frontdesk/board'); await p.waitForTimeout(150);
        const afterRouteRedraw = await button(p, 'board.card.a-1042.rail');
        const railStillOpen = await railInfo(p);
        const reproduced = pressed && rail.open && railPid && !!after && after.pressed === 'false' && after.pressmark === false
          && !!afterRouteRedraw && afterRouteRedraw.pressed === 'true' && afterRouteRedraw.pressmark === true;
        rec('A-screens-rail-2-1', 'Pressing the Rail button on Board card a-1042 opens the Patient Rail for Marisol Vega, but the button that opened it still reads aria-pressed="false" with no ✓ mark; the pressed state only appears after a route change rebuilds the card', 'B5 — a pressed control carries the ✓ mark and aria-pressed="true"; rail.js:56-58 computes pressed at host-render time and open() redraws only #rail',
          reproduced, { buttonBeforePress: before, pressed, buttonAfterPress: after, railAfterPress: rail, railIsOpen: railPid, buttonAfterRouteRedraw: afterRouteRedraw, railStillOpen });
      } finally { await c.close(); }
    },

    // RC-134 · B11 · base.css:29-31 turns .shell to a column under 1024 px and gives .rail flex 0 0 auto, so the rail takes its full
    // content height (rail.js:120 renders head, alert bar, nine tabs and six summaries) and the canvas keeps only what is left.
    // Negative control: a layout that leaves the work usable gives the canvas a client height in the hundreds and its controls are
    // hit-testable (elementFromPoint at a control's centre returns that control), so `reachable` is non-empty and the check reports
    // false. The rail must be open (it is the rail that costs the height) and the canvas must actually hold the Board (scrollHeight
    // in the thousands) for the reading to mean what it says; the window is then scrolled to the bottom so a page scroll cannot be
    // mistaken for the breach.
    async 'A-screens-rail-2-2'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/frontdesk/board?device=phone');
        const beforeOpen = await p.evaluate(() => { const cv = document.getElementById('canvas'); const r = cv.getBoundingClientRect(); return { canvasY: Math.round(r.y), canvasH: Math.round(r.height), railHidden: document.getElementById('rail').hidden, shellFlexDirection: getComputedStyle(document.querySelector('.shell')).flexDirection }; });
        const opened = await click(p, 'board.card.a-1042.rail'); await p.waitForTimeout(250);
        const hitTest = () => p.evaluate(() => {
          const r = document.getElementById('rail'), cv = document.getElementById('canvas');
          const bx = (e) => { const b = e.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height) }; };
          const hit = (el) => { const b = el.getBoundingClientRect(); const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2); if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return 'offscreen'; const t = document.elementFromPoint(x, y); if (!t) return 'none'; return t === el || el.contains(t) || t.contains(el) ? 'self' : (t.getAttribute('data-testid') || t.tagName); };
          const controls = [...cv.querySelectorAll('[data-testid]')];
          const hits = controls.map((e) => ({ tid: e.getAttribute('data-testid'), hit: hit(e) }));
          return { rail: bx(r), canvas: bx(cv), canvasClientHeight: cv.clientHeight, canvasScrollHeight: cv.scrollHeight, viewport: window.innerHeight, pageY: Math.round(window.scrollY), documentScrollHeight: document.scrollingElement.scrollHeight, canvasControls: controls.length, reachable: hits.filter((x) => x.hit === 'self').map((x) => x.tid), blockedSample: hits.filter((x) => x.hit !== 'self').slice(0, 6) };
        });
        const afterOpen = await hitTest();
        await p.evaluate(() => window.scrollTo(0, 99999)); await p.waitForTimeout(200);
        const afterPageScroll = await hitTest();
        const railWayOut = await p.evaluate(() => [...document.querySelectorAll('#rail [data-testid]')].map((e) => e.getAttribute('data-testid')).filter((t) => /close|collapse|hide|toggle/i.test(t)));
        const reproduced = opened && afterOpen.rail.h > 800 && afterOpen.canvasClientHeight < 60 && afterOpen.canvasScrollHeight > 1000
          && afterPageScroll.canvasClientHeight < 60 && afterPageScroll.reachable.length <= 1 && afterOpen.canvasControls > 20;
        rec('A-screens-rail-2-2', 'At 420×860 the open Patient Rail is 895 px tall and the work canvas is left 32 px high starting at y 952, below the fold: the Board renders 121 controls into a 32 px window and none of them is hit-testable, one after the page is scrolled to its end', 'B11 — every control the function renders is reachable at 420 px; base.css:29-31 with rail.js:120 (the rail has no collapse, only Close)',
          reproduced, { beforeOpen, opened, afterRailOpen: afterOpen, afterPageScrolledToEnd: afterPageScroll, railWayOutControls: railWayOut });
      } finally { await c.close(); }
    },

    // RC-190 · B3 · rail.js:224 builds "Send to biller" with kind 'reversible' while :236 builds "Send statement" with kind
    // 'irreversible', and moneydesk's "Send" controls are irreversible too. B3 lists Send among the irreversible verbs.
    // Negative control: one identity for the verb — every control whose label begins with "Send" carrying the same kind class —
    // makes `kindsForSend` a single value and the check reports false. Every control is read from a state where it is actually
    // rendered; the Undo that makes "Send to biller" honestly reversible is measured too, and carried, because it is the reason
    // the code may be right (rail.js:229) and it is not this check's job to decide the canonical identity, only to show the split.
    async 'A-screens-rail-2-3'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/biller/ledger/p-306');
        const sendbiller = await button(p, 'ledger.sendbiller');
        const sendstatement = await button(p, 'ledger.statement.send');
        await click(p, 'ledger.sendbiller'); await p.waitForTimeout(200);
        const undo = await button(p, 'ledger.sendbiller.undo');
        await hop(p, '#/biller/money'); await p.waitForTimeout(150);
        await click(p, 'money.tab.statements'); await p.waitForTimeout(150);
        const moneyStatementSend = await button(p, 'money.statement.sd-1.send');
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(250);
        const appealSend = await button(p, 'money.appeal.send');
        const all = [['ledger.sendbiller', sendbiller], ['ledger.statement.send', sendstatement], ['money.statement.sd-1.send', moneyStatementSend], ['money.appeal.send', appealSend]];
        const sendControls = all.filter(([, x]) => x && /^send\b/i.test(x.text)).map(([tid, x]) => ({ testid: tid, label: x.text, kind: x.kind.join('+') }));
        const kindsForSend = [...new Set(sendControls.map((x) => x.kind))];
        const reproduced = sendControls.length === 4 && kindsForSend.length > 1
          && !!sendbiller && sendbiller.kind.includes('reversible') && !sendbiller.kind.includes('irreversible')
          && [sendstatement, moneyStatementSend, appealSend].every((x) => !!x && x.kind.includes('irreversible'));
        rec('A-screens-rail-2-3', 'The Ledger\'s "Send to biller" carries the reversible identity while every other Send in the product — "Send statement" on the same page, the Money Desk statement Send and the appeal Send — carries the irreversible identity', 'B3 — the same verb carries the same identity on every screen (Send is listed irreversible); rail.js:224 against rail.js:236 and moneydesk',
          reproduced, { sendControls, distinctKindsForTheVerbSend: kindsForSend, ledgerSendToBiller: sendbiller, ledgerSendStatement: sendstatement, moneyStatementSend, moneyAppealSend: appealSend, undoOfferedForSendToBiller: undo });
      } finally { await c.close(); }
    },

    // RC-191 · B11 · rail.js:156 wraps the ledger table in .wrap-x (base.css:41 → overflow-x: auto, max-width: 100%). The claim is
    // that at 420 px the Amount column is off the right edge and out of reach. The measurement drives a real horizontal wheel over
    // the table and reads where the Amount column lands afterwards, and whether the page body itself pans.
    // Negative control (this is the reading that makes the claim TRUE): a column that cannot be reached leaves the wrapper's
    // scrollLeft at 0 after the gesture with Amount still right of the viewport, or forces document.scrollingElement.scrollWidth
    // past window.innerWidth — the same bar the harness's R36 sets (wrapperScrolls neither auto nor scroll). The rail is closed
    // first so the table is measured in a full-height canvas, and its starting position is recorded to show the column does begin
    // off the edge.
    async 'A-screens-rail-2-4'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/frontdesk/ledger/p-306?device=phone');
        await click(p, 'rail.close'); await p.waitForTimeout(150);
        const start = await p.evaluate(() => {
          const w = document.querySelector('.wrap-x'); const t = w.querySelector('table.ledger-table');
          const th = [...t.querySelectorAll('th')].find((e) => e.textContent.trim() === 'Amount');
          const r = th.getBoundingClientRect(); const cs = getComputedStyle(w);
          w.scrollIntoView({ block: 'center' });
          const r2 = w.getBoundingClientRect();
          return { amountLeft: Math.round(r.left), amountRight: Math.round(r.right), innerWidth: window.innerWidth, tableScrollWidth: t.scrollWidth, wrapClientWidth: w.clientWidth, wrapScrollWidth: w.scrollWidth, wrapOverflowX: cs.overflowX, wrapScrollLeft: Math.round(w.scrollLeft), wrapCentre: { x: Math.round(r2.x + r2.width / 2), y: Math.round(Math.min(Math.max(r2.y + r2.height / 2, 10), window.innerHeight - 10)) } };
        });
        await p.mouse.move(start.wrapCentre.x, start.wrapCentre.y);
        await p.mouse.wheel(400, 0); await p.waitForTimeout(300);
        const afterWheel = await p.evaluate(() => {
          const w = document.querySelector('.wrap-x'); const t = w.querySelector('table.ledger-table');
          const th = [...t.querySelectorAll('th')].find((e) => e.textContent.trim() === 'Amount');
          const r = th.getBoundingClientRect();
          const cell = [...t.querySelectorAll('tbody td.num')].filter((e) => /\$/.test(e.textContent))[0];
          const cr = cell ? cell.getBoundingClientRect() : null;
          return { wrapScrollLeft: Math.round(w.scrollLeft), amountLeft: Math.round(r.left), amountRight: Math.round(r.right), innerWidth: window.innerWidth, amountFullyInViewport: r.left >= 0 && r.right <= window.innerWidth, firstAmountCell: cell ? { text: cell.textContent.trim(), left: Math.round(cr.left), right: Math.round(cr.right), inViewport: cr.left >= 0 && cr.right <= window.innerWidth } : null, bodyScrollWidth: document.scrollingElement.scrollWidth };
        });
        const bodyPans = afterWheel.bodyScrollWidth > afterWheel.innerWidth;
        const unreachable = !afterWheel.amountFullyInViewport;
        const reproduced = unreachable || bodyPans;
        rec('A-screens-rail-2-4', 'At 420 px the ledger\'s Amount column starts 214 px past the right edge and cannot be brought into view', 'B11 / docs/04 — wide content scrolls inside its own container and the page body never scrolls horizontally; rail.js:156 with base.css:41',
          reproduced, { startingPosition: start, afterHorizontalWheelOverTheTable: afterWheel, amountUnreachableAfterGesture: unreachable, pageBodyPansSideways: bodyPans });
      } finally { await c.close(); }
    },

    // RC-192 · C3 · rail.js:136 prints 'Reverses #' + e.reversesEntryId (the row's raw ledger id), :139 appends humanize(e.gl)
    // (the GL bucket code with underscores swapped for spaces) and :142 appends 'ERA line ' + e.eraLineId; rail.js:64 prints the
    // claim id in the Claims summary. Each rendered token is checked against the store field it came from, so a substring cannot
    // pass for an id. docs/13:396 shows this row as 'Reverses #4412 from 9/1' — a number and a date, no 'le-' prefix.
    // Negative control: copy that names the thing in words ('MetLife · insurance A/R', 'Reverses #4429 from 9/1') leaves every
    // store id unmatched in the rendered cell, `rawIdsOnScreen` is empty and the check reports false. The store values are read
    // first so the check can only fire on ids the record actually holds.
    async 'A-screens-rail-2-5'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/biller/ledger/p-306');
        const store306 = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.patientId === 'p-306').map((e) => ({ id: e.id, kind: e.kind, eraLineId: e.eraLineId || null, gl: e.gl || null, reason: e.reason || null })));
        const table306 = await ledgerRows(p);
        await hop(p, '#/owner/ledger/p-311'); await p.waitForTimeout(200);
        const store311 = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.patientId === 'p-311' && e.kind === 'reversal').map((e) => ({ id: e.id, reversesEntryId: e.reversesEntryId || null, correctsEntryId: e.correctsEntryId || null })));
        const table311 = await ledgerRows(p);
        const claimPid = await p.evaluate(() => { const c2 = window.__proto.state().claims.find((x) => ['submitted', 'pended', 'denied', 'appealed'].includes(x.status)); return c2 ? { patientId: c2.patientId, id: c2.id, status: c2.status } : null; });
        let railClaims = null;
        if (claimPid) { await hop(p, '#/frontdesk/ledger/' + claimPid.patientId); await p.waitForTimeout(200); await click(p, 'rail.tab.claims'); await p.waitForTimeout(200); railClaims = { line: await railMsg(p), announcement: await live(p) }; }
        const reasonIdx = table306 ? table306.head.indexOf('Reason') : -1;
        const reason306 = table306 && reasonIdx >= 0 ? table306.rows.map((r) => r[reasonIdx]) : [];
        const reason311 = table311 && reasonIdx >= 0 ? table311.rows.map((r) => r[reasonIdx]) : [];
        const tok = (id) => new RegExp('(^|[^A-Za-z0-9-])' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z0-9-]|$)');
        const rawIdsOnScreen = [];
        for (const e of store306) if (e.eraLineId) for (const cell of reason306) if (tok(e.eraLineId).test(cell)) rawIdsOnScreen.push({ where: 'ledger p-306 Reason', storeField: 'ledger.eraLineId', value: e.eraLineId, cell });
        for (const e of store311) if (e.reversesEntryId) for (const cell of reason311) if (tok(e.reversesEntryId).test(cell)) rawIdsOnScreen.push({ where: 'ledger p-311 Reason', storeField: 'ledger.reversesEntryId', value: e.reversesEntryId, cell });
        if (claimPid && railClaims && railClaims.line && tok(claimPid.id).test(railClaims.line)) rawIdsOnScreen.push({ where: 'rail Claims summary', storeField: 'claims.id', value: claimPid.id, cell: railClaims.line });
        const glCodes = [];
        for (const e of store306) if (e.gl) { const humanized = e.gl.replace(/_/g, ' '); for (const cell of reason306) if (cell.includes(humanized)) glCodes.push({ storeField: 'ledger.gl', code: e.gl, rendered: humanized, cell }); }
        const reproduced = reason306.length > 0 && reason311.length > 0 && rawIdsOnScreen.length > 0 && glCodes.length > 0;
        rec('A-screens-rail-2-5', 'The staff ledger\'s Reason column prints raw record ids and a GL bucket code — "contractual ppo · ERA line el-prev-1", "MetLife · ins ar primary · ERA line el-prev-1", "Reverses #le-4429" — and the rail\'s Claims summary prints the claim id; the spec\'s own wording for that row is "Reverses #4412 from 9/1"', 'C3 — no product-internal nouns or raw ids (enc-9002, el-14) on screen unless the spec shows them; rail.js:136, :139, :142 and :64',
          reproduced, { ledgerHead: table306 ? table306.head : null, reasonColumn_p306: reason306, reasonColumn_p311: reason311, storeRows_p306: store306, storeReversals_p311: store311, railClaimsSummary: railClaims, claimInStore: claimPid, rawIdsOnScreen, glBucketCodesOnScreen: glCodes });
      } finally { await c.close(); }
    },

    // RC-193 · C4 · rail.js:119 renders the rail's Explain body as h('div', {class:'explain'}, store.explain(pid).map(...)); on an
    // account with no charges store.explain returns [], so the div renders with no children at all. The Ledger screen's
    // explainBlock (rail.js:161) has the sentence the rail lacks, and is read here as the comparator.
    // Negative control: an Explain that says why it is empty renders text (the ledger's "No charges on this account, so there is
    // nothing to explain."), so `railExplainText` is non-empty and the check reports false; the same block on a patient WITH
    // charges (p-306) is measured in the same run to show the block is not empty for want of a press. The button must read
    // aria-pressed="true" first, or Explain was never on.
    async 'A-screens-rail-2-6'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1042.rail'); await p.waitForTimeout(200);
        const rail = await railInfo(p);
        const pressedExplain = await click(p, 'rail.explain'); await p.waitForTimeout(200);
        const explainBtn = await button(p, 'rail.explain');
        const railExplain = await p.evaluate(() => { const e = document.querySelector('#rail .explain'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), childNodes: e.childNodes.length, w: Math.round(r.width), h: Math.round(r.height) }; });
        const explainRows = await p.evaluate(() => Proto.store.explain('p-301').length);
        const otherEmptyStates = await p.evaluate(() => ['plans', 'note'].map((k) => { const s = document.querySelector('[data-testid="rail.sum.' + k + '"]'); const d = s ? s.parentElement : null; return { key: k, body: d ? d.querySelector('.body').textContent.replace(/\s+/g, ' ').trim() : null }; }));
        // Comparator 1: the same patient's Ledger screen says why it is empty.
        await hop(p, '#/frontdesk/ledger/p-301'); await p.waitForTimeout(200);
        await click(p, 'ledger.explain'); await p.waitForTimeout(200);
        const ledgerExplain = await p.evaluate(() => { const e = document.querySelector('#canvas .explain'); return e ? e.textContent.trim() : null; });
        // Comparator 2: the same rail block on a patient who has charges is not empty.
        await hop(p, '#/frontdesk/ledger/p-306'); await p.waitForTimeout(200);
        await click(p, 'rail.explain'); await p.waitForTimeout(200);
        const railExplainWithCharges = await p.evaluate(() => { const e = document.querySelector('#rail .explain'); return e ? e.textContent.trim().slice(0, 120) : null; });
        const reproduced = rail.open && pressedExplain && !!explainBtn && explainBtn.pressed === 'true' && !!railExplain
          && railExplain.text === '' && railExplain.childNodes === 0 && explainRows === 0 && !!ledgerExplain && ledgerExplain.length > 0 && !!railExplainWithCharges;
        rec('A-screens-rail-2-6', 'Explain in the Patient Rail on an account with no charges (Marisol Vega, p-301) renders an empty block: a 279×26 div with no children and no text, where the Ledger screen for the same patient says "No charges on this account, so there is nothing to explain."', 'C4 — empty states say why they are empty and what to do next; rail.js:119 against rail.js:161',
          reproduced, { railOpen: rail, explainPressed: pressedExplain, explainButton: explainBtn, railExplainBlock: railExplain, storeExplainRowsForP301: explainRows, otherRailEmptyStates: otherEmptyStates, ledgerExplainSamePatient: ledgerExplain, railExplainOnPatientWithCharges: railExplainWithCharges });
      } finally { await c.close(); }
    },

    // RC-194 · A6, B4 · rail.js:211-213 renderLedger mounts its own page for an id the store has no patient for, instead of letting
    // the route fall through to the router's notfound handler (shell.js:117, "Nothing here").
    // Negative control: an unknown id that lands on notfound gives h1 "Nothing here" and the notfound.home control, so `ledgerH1`
    // equals the router's heading and the check reports false. The router's own notfound is read in the same run, from the same
    // build, so the two headings are compared as measured strings, not against a remembered one.
    async 'A-screens-rail-2-7'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/frontdesk/ledger/p-999');
        const ledger = { h1: await h1(p), route: await p.evaluate(() => Proto.router.current().route), controls: await p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid'))), backLabel: await txt(p, 'ledger.back') };
        const patientExists = await p.evaluate(() => !!Proto.store.patient('p-999'));
        await hop(p, '#/frontdesk/nonsense/x'); await p.waitForTimeout(200);
        const router = { h1: await h1(p), route: await p.evaluate(() => Proto.router.current().route), controls: await p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid'))), backLabel: await txt(p, 'notfound.home') };
        const reproduced = !patientExists && !!ledger.h1 && !!router.h1 && ledger.h1 !== router.h1
          && ledger.controls.includes('ledger.back') && !ledger.controls.includes('notfound.home') && router.h1 === 'Nothing here';
        rec('A-screens-rail-2-7', 'An unknown patient id on the Ledger route renders a ledger-local not-found page — h1 "No patient with that id" with a ledger.back control — while the router\'s own not-found for an unknown route says "Nothing here" with notfound.home: two headings and two ids for one concept', 'A6, B4 — an unknown id lands on notfound; one canonical word per concept; rail.js:211-213 against shell.js:117',
          reproduced, { ledgerRoute: ledger, routerNotfound: router, patientP999Exists: patientExists });
      } finally { await c.close(); }
    },

    // RC-195 · C5 · store.js:244 fileNote writes the new claims row with status 'scrubbed' and nextAction 'Queued to clearinghouse';
    // rail.js:29 openClaims counts only submitted | pended | denied | appealed, so rail.js:64 announces "Claims: none open" for the
    // claim the filing just created. The note is filed through the UI (tag → surfaces → procedure → starter → File → read-back).
    // Negative control: a rail that counts the queued claim reads "Claims: 1 open — c-100 scrubbed (Cigna)", so `railClaimsLine`
    // names the claim and the check reports false. The filing must have taken (a filedNotes row and a claims row for p-302 in the
    // store) before "none open" counts as a disagreement; with no claim row there is nothing for the rail to be wrong about.
    async 'A-screens-rail-2-8'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const claimsBefore = await p.evaluate(() => window.__proto.state().claims.filter((x) => x.patientId === 'p-302').length);
        for (const t of ['enc.tag.tag-1.chart', 'enc.surface.30.d', 'enc.surface.30.o', 'enc.proc.d2392', 'enc.note.starter.0', 'enc.file']) await click(p, t);
        await p.waitForTimeout(200);
        const readbackVerb = await txt(p, 'refusal.verb');
        await click(p, 'refusal.control'); await p.waitForTimeout(300);
        const filed = await filedNotes(p, 'enc-9002');
        const claimsAfter = await p.evaluate(() => window.__proto.state().claims.filter((x) => x.patientId === 'p-302').map((x) => ({ id: x.id, status: x.status, payer: x.payer, nextAction: x.nextAction, submitted: x.submitted })));
        const openStatuses = await p.evaluate(() => Proto.store.get().claims.filter((x) => x.patientId === 'p-302').map((x) => x.status));
        await hop(p, '#/dentist/ledger/p-302'); await p.waitForTimeout(250);
        const rail = await railInfo(p);
        const pressed = await click(p, 'rail.tab.claims'); await p.waitForTimeout(200);
        const line = await railMsg(p); const announcement = await live(p);
        const newClaim = claimsAfter.find((x) => x.status === 'scrubbed') || null;
        const reproduced = filed.length === 1 && claimsAfter.length === claimsBefore + 1 && !!newClaim && rail.open && pressed
          && line === 'Claims: none open' && announcement === 'Claims: none open';
        rec('A-screens-rail-2-8', 'Filing the enc-9002 note writes claim c-100 for Theo Brandt with status "scrubbed" and next action "Queued to clearinghouse", and the rail\'s Claims tab immediately announces "Claims: none open"', 'C5 — the same fact has one canonical value everywhere it appears; rail.js:29 omits the status store.js:244 writes',
          reproduced, { readbackGateVerb: readbackVerb, filedNoteIds: filed, claimsForP302Before: claimsBefore, claimsForP302After: claimsAfter, claimStatusesInStore: openStatuses, claimCreatedByFiling: newClaim, railOpen: rail, claimsTabPressed: pressed, railClaimsLine: line, announcement, openClaimsFilterInRail: ['submitted', 'pended', 'denied', 'appealed'] });
      } finally { await c.close(); }
    },

    // RC-196 · C8 · rail.js:202 announces 'As of ' + shortDate(v) + ': ' + n + ' rows by posted date' with no singular form, while
    // the on-screen status line at :226 reads "1 of 3 rows" correctly.
    // Negative control: an announcement that agrees with its own count reads "1 row" for one row, so `singularAnnouncement` does
    // not match /\b1 rows\b/ and the check reports false. A second date that really does select several rows is measured in the
    // same run, so a check that fired on any "rows" string would be caught: the plural is right in the plural case.
    async 'A-screens-rail-2-9'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/biller/ledger/p-306');
        const allRows = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.patientId === 'p-306').map((e) => e.posted));
        await click(p, 'ledger.asof'); await p.waitForTimeout(200);
        const setDate = async (v) => {
          await p.fill('[data-testid="ledger.asof.date"]', v); await p.waitForTimeout(80);
          await p.evaluate(() => { const i = document.querySelector('[data-testid="ledger.asof.date"]'); if (i) i.dispatchEvent(new Event('change', { bubbles: true })); });
          await p.waitForTimeout(300);
          return { announcement: await live(p), statusLine: await p.evaluate(() => ((document.querySelector('.ledger-asofline') || {}).textContent || '').trim()), rowsRendered: await p.evaluate(() => document.querySelectorAll('table.ledger-table tbody tr[id^="row-"]').length) };
        };
        const one = await setDate('2026-08-20');
        // The As-of block stays open across the change (rail.js:230 keeps st.asofOpen), so the same input takes the second date.
        const many = await setDate('2026-09-02');
        const reproduced = one.rowsRendered === 1 && /\b1 rows\b/.test(one.announcement) && many.rowsRendered > 1 && new RegExp('\\b' + many.rowsRendered + ' rows\\b').test(many.announcement);
        rec('A-screens-rail-2-9', 'Choosing an As-of date that selects a single ledger row announces "As of 8/20: 1 rows by posted date" to aria-live, while the status line on the same screen reads "1 of 3 rows"', 'C8 — announcements are one clean verb line; rail.js:202 has no singular form (rail.js:226 gets it right)',
          reproduced, { postedDatesInStore: allRows, singleRowDate: { date: '2026-08-20', announcement: one.announcement, statusLine: one.statusLine, rowsRendered: one.rowsRendered, words: one.announcement.split(/\s+/).length }, multiRowDate: { date: '2026-09-02', announcement: many.announcement, statusLine: many.statusLine, rowsRendered: many.rowsRendered } });
      } finally { await c.close(); }
    },

    // RC-246 · B7, A8 · rail.js:93 computes months as Math.round(days / 30.44) inline; chairs.js:40-43 monthsAgo counts calendar
    // months and subtracts one when the day of month has not been reached. Both render the same fact (months since the last full
    // perio chart) for the same appointment. The rail's helper is not exported, so it is driven through its own rendering: the
    // seed's a-1042 perioLast is moved in the live store and both surfaces are re-read for each value.
    // Negative control: one helper serving both surfaces gives the same integer on the Chairs delta strip and the Rail Recall line
    // for every date, so `disagreements` is empty and the check reports false. The seed's own value (2025-07-01 → 14 on both) is
    // measured too: the check requires agreement there and disagreement on ordinary dates, so a constant offset or a broken read
    // of either surface cannot pass for this claim.
    async 'A-screens-rail-2-10'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/hygienist/chairs');
        const today = await p.evaluate(() => window.__proto.state().tenant.today);
        const seedPerioLast = await p.evaluate(() => window.__proto.state().appointments.find((a) => a.id === 'a-1042').perioLast);
        const helperExported = await p.evaluate(() => typeof Proto.screens.chairs.monthsAgo === 'function');
        const readings = [];
        for (const d of [seedPerioLast, '2025-08-04', '2025-09-04', '2026-03-04']) {
          await p.evaluate((v) => { Proto.store.get().appointments.find((a) => a.id === 'a-1042').perioLast = v; }, d);
          await hop(p, '#/hygienist/board'); await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(150);
          const strip = await p.evaluate(() => { const e = document.querySelector('[data-testid="chairs.card.a-1042"]'); const t = e ? e.textContent.replace(/\s+/g, ' ') : ''; const m = t.match(/Perio\s*(\d+)\s*mo ago/); return { months: m ? Number(m[1]) : null, text: m ? m[0] : null }; });
          const chairsHelper = await p.evaluate((v) => Proto.screens.chairs.monthsAgo(v), d);
          await hop(p, '#/hygienist/ledger/p-301'); await p.waitForTimeout(200);
          const recall = await railSummary(p, 'recall');
          const m2 = recall ? recall.match(/\((\d+) months ago\)/) : null;
          readings.push({ perioLastInStore: d, chairsStrip: strip, chairsMonthsAgoHelper: chairsHelper, railRecallLine: recall, railMonths: m2 ? Number(m2[1]) : null });
        }
        const seedReading = readings[0];
        const others = readings.slice(1);
        const disagreements = readings.filter((r) => r.chairsStrip.months != null && r.railMonths != null && r.chairsStrip.months !== r.railMonths)
          .map((r) => ({ perioLast: r.perioLastInStore, chairs: r.chairsStrip.months, rail: r.railMonths }));
        const allRead = readings.every((r) => r.chairsStrip.months != null && r.railMonths != null && r.chairsStrip.months === r.chairsMonthsAgoHelper);
        const reproduced = helperExported && allRead && seedReading.chairsStrip.months === seedReading.railMonths && disagreements.length === others.length && others.length > 0;
        rec('A-screens-rail-2-10', 'Two months-since implementations render the same fact: with a-1042 perioLast at 2025-08-04 the Chairs delta strip says "Perio 12 mo ago" (chairs.js calendar months) and the Rail Recall line says "(13 months ago)" (rail.js days ÷ 30.44); the seed\'s own 2025-07-01 gives 14 on both, so the drift is invisible today', 'B7, A8 — one format per context and a helper that is right on ordinary inputs; rail.js:93 against chairs.js:40-43',
          reproduced, { today, seedPerioLast, chairsHelperExported: helperExported, readings, seedDateAgrees: seedReading.chairsStrip.months === seedReading.railMonths, disagreements, note: 'perioLast is varied by writing the live store row (Proto.store.get()), the only way to feed the rail\'s inline expression, which rail.js does not export' });
      } finally { await c.close(); }
    },
  };
};
