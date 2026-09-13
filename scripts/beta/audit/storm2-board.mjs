// Audit checks for fix-storm round 2, owner "board": defects confirmed live in prototype/js/screens/board.js,
// checkout.js and chairs.js (board-checkout-r2-3 screen part, -4, -5, -6, -7, -9 screen part, -10, -11;
// invariants-r2-1, -5, -6, -9, -10, -12; clinical-r2-9). Default position is NOT reproduced: every check carries
// its precondition values and scores the breach only once the page is measured in the state the claim names.
// Contexts close in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.id || a.tagName; });
  const gates = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].filter((r) => r.offsetParent !== null).map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim(), prior: r.querySelectorAll('[data-testid^="refusal.prior."]').length })));
  const btnState = (p, t) => p.$eval(tid(t), (e) => ({ text: e.textContent.trim(), held: e.classList.contains('held') })).catch(() => null);
  const hash = (p) => p.evaluate(() => location.hash);
  const set = (p, o) => p.evaluate((o) => window.__proto.set(o), o);
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const since = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const cardText = (p, t) => p.evaluate((t) => ((document.querySelector('[data-testid="' + t + '"]') || {}).textContent || '').replace(/\s+/g, ' ').trim(), t);
  const enterTwice = async (p, t) => { await p.focus(tid(t)); await p.keyboard.press('Enter'); const f1 = await focused(p); await p.keyboard.press('Enter'); await p.waitForTimeout(250); return f1; };
  const issuePass = async (p) => { await set(p, { persona: 'owner' }); await hop(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await p.fill(tid('roles.daypass.name'), 'Sam Lee'); await click(p, 'roles.daypass.save'); await click(p, 'roles.daypass.signin'); await p.waitForTimeout(200); return p.evaluate(() => Proto.store.currentUser().name); };

  return {
    // board.js gateFor(): doArrive/doSeat/doReverify passed no onControl, so the entitlement gate's "Open Roles"
    // changed nothing; doPing routed every non-outage code to the encounter. Negative control: the card control
    // lands on #/temp/roles and the Ping gate's control does not land on an encounter.
    async 'A-storm2-board-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        await click(p, 'board.card.a-1042.arrive');
        const card = (await gates(p))[0] || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const afterCard = await hash(p);
        await hop(p, '#/temp/board');
        await click(p, 'board.queue.row.a-1044.ping');
        const ping = (await gates(p))[0] || null;
        await p.click(tid('board.queue.row.a-1044') + ' ' + tid('refusal.control')).catch(() => {}); await p.waitForTimeout(150);
        const afterPing = await hash(p);
        const pre = !!card && card.code === 'entitlement' && /Roles/.test(card.control) && !!ping && ping.code === 'entitlement';
        rec('A-storm2-board-1', 'For a pass-less temp the Board entitlement gate\'s "Open Roles" control changes no route on the card and routes the queue-row Ping gate to an encounter', 'CONTRACTS §6 — the control does what its label says (board.js gateFor onControl, doPing)',
          pre && (!/\/roles/.test(afterCard) || /encounter/.test(afterPing)), { card, afterCard, ping, afterPing });
      } finally { await c.close(); }
    },

    // board.js pruneStaleGates() / checkout.js render(): only outage gates fell with their cause, so the entitlement
    // gate outlived the issued pass and the Held press only focused it. Negative control: after the pass the card
    // and Post read their own identity, and the press writes (status arrived; ledger grows).
    async 'A-storm2-board-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        await click(p, 'board.card.a-1042.arrive');
        const gateBefore = (await gates(p))[0] || null;
        const who = await issuePass(p);
        const arrive = await btnState(p, 'board.card.a-1042.arrive');
        await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(150);
        const status = (await state(p)).appointments.find((a) => a.id === 'a-1042').status;
        const boardStale = !!gateBefore && gateBefore.code === 'entitlement' && who === 'Sam Lee' && !!arrive && (arrive.held || status !== 'arrived');
        rec('A-storm2-board-2', 'After Dr. Reagan issues Sam Lee\'s pass and signs her in, the a-1042 Arrive still reads Held behind "Issue a day pass before arriving" and the press writes nothing', 'FIX-ROUND2 stale-gate rule; CONTRACTS §6 — a held primary is never a dead end (board.js pruneStaleGates, checkout.js render)',
          boardStale, { gateBefore, currentUser: who, arriveAfterPass: arrive, statusAfterPress: status });
      } finally { await c.close(); }
    },

    // checkout.js render(): the Checkout half of the same defect. Post refused for the pass-less temp; the pass is
    // issued; back on Checkout Post still reads Held until a tender is pressed again.
    async 'A-storm2-board-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/checkout/a-1046');
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post');
        const gateBefore = (await gates(p))[0] || null;
        const who = await issuePass(p);
        await hop(p, '#/temp/checkout/a-1046');
        const post = await btnState(p, 'checkout.post'); const gateAfter = (await gates(p))[0] || null;
        const n0 = (await state(p)).ledger.length;
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const n1 = (await state(p)).ledger.length;
        const pre = !!gateBefore && gateBefore.code === 'entitlement' && who === 'Sam Lee';
        rec('A-storm2-board-3', 'After the pass is issued Checkout a-1046 keeps Post on Held behind the entitlement gate and the press posts nothing', 'FIX-ROUND2 stale-gate rule (checkout.js render prunes only outage)',
          pre && ((post && post.held) || (gateAfter && gateAfter.code === 'entitlement')) && n1 === n0, { gateBefore, currentUser: who, postAfterPass: post, gateAfter, ledgerDelta: n1 - n0 });
      } finally { await c.close(); }
    },

    // board.js readinessRows(): Re-verify all ignored every store result, so two refused re-verifications announced
    // "Re-ran 2 eligibility checks: all active." Negative control: a refusal is rendered/logged and no success is read.
    async 'A-storm2-board-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        const st0 = await state(p); const seq0 = await lastSeq(p);
        const amber0 = st0.appointments.filter((a) => a.locationId === 'loc-1' && a.eligibility === 'amber').map((a) => a.id);
        const row = await p.evaluate(() => { const e = document.querySelector('[data-testid$=".reverify-all"]'); return e ? e.getAttribute('data-testid') : null; });
        if (row) await click(p, row);
        const st1 = await state(p);
        const amber1 = st1.appointments.filter((a) => a.locationId === 'loc-1' && a.eligibility === 'amber').map((a) => a.id);
        const refusalEvents = (await since(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => e.code);
        const announced = await p.evaluate(() => document.getElementById('live').textContent);
        const g = await gates(p);
        rec('A-storm2-board-4', 'For a pass-less temp "Re-verify all" announces "Re-ran 2 eligibility checks: all active." while both re-verifications were refused and no gate is rendered or logged', 'docs/01 principle 11; CONTRACTS §6 — the store\'s refusal is rendered and logged (board.js readinessRows act)',
          !!row && amber0.length > 0 && amber1.length === amber0.length && st1.eligibilityChecks.length === st0.eligibilityChecks.length && /Re-ran/.test(announced) && refusalEvents.length === 0, { row, amber0, amber1, checksDelta: st1.eligibilityChecks.length - st0.eligibilityChecks.length, announced, refusalEvents, gates: g });
      } finally { await c.close(); }
    },

    // board.js card()/queueRow(): the Filed-later stamps read "Paid at the window" for every lane visit, including a
    // Send statement with zero payment rows. Negative control: the words follow the typed decision.
    async 'A-storm2-board-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.collect.seg.send-statement'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const st = await state(p);
        const pays = st.ledger.filter((e) => e.patientId === 'p-303' && e.kind === 'patient_payment').length;
        const decision = (st.collectionDecisions.find((d) => d.encounterId === 'enc-9003') || {}).decision || null;
        await hop(p, '#/frontdesk/board');
        const card = await cardText(p, 'board.card.a-1044'); const row = await cardText(p, 'board.queue.row.a-1044');
        const aria = await p.$eval(tid('board.queue.row.a-1044.checkout'), (e) => e.getAttribute('aria-label')).catch(() => null);
        rec('A-storm2-board-5', 'After Send statement on a-1044 (no payment) the Board lane card and queue row read "Paid at the window" and the row\'s Checkout says "already paid"', 'docs/04 one canonical view per fact; docs/13 feature 2 (board.js card inLane stamp, queueRow)',
          pays === 0 && decision === 'send_statement' && (/Paid at the window/.test(card) || /Paid at the window/.test(row) || /already paid/.test(aria || '')), { pays, decision, card: card.slice(0, 200), row: row.slice(0, 260), aria });
      } finally { await c.close(); }
    },

    // board.js doArrive(): focus moved to the freshly rendered Seat, so a second Enter seated the patient.
    // Negative control: after Enter, Enter the status is arrived and no seat click is logged.
    async 'A-storm2-board-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const seq0 = await lastSeq(p);
        const f1 = await enterTwice(p, 'board.card.a-1042.arrive');
        const a = (await state(p)).appointments.find((x) => x.id === 'a-1042');
        const clicks = (await since(p, seq0)).filter((e) => e.kind === 'click').map((e) => e.testid);
        rec('A-storm2-board-6', 'Two Enter presses on Arrive arrive and then seat a-1042: focus lands on Seat after the first', 'FIX-ROUND2 focus-after-action rule; docs/01 principle 9 (board.js doArrive after focus)',
          clicks.includes('board.card.a-1042.arrive') && (f1 === 'board.card.a-1042.seat' || a.status === 'seated'), { focusAfterFirstEnter: f1, status: a.status, clicks, focusAfter: await focused(p) });
      } finally { await c.close(); }
    },

    // checkout.js doPost(): after Post focus moved to Back to Board, so a second Enter left the Posted card unread.
    // Negative control: focus rests on the Posted card and the route stays on checkout.
    async 'A-storm2-board-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        await click(p, 'checkout.tender.cash');
        const seq0 = await lastSeq(p);
        const f1 = await enterTwice(p, 'checkout.post');
        const h = await hash(p);
        const posted = (await state(p)).ledger.some((e) => e.patientId === 'p-305' && e.kind === 'patient_payment');
        const clicks = (await since(p, seq0)).filter((e) => e.kind === 'click').map((e) => e.testid);
        rec('A-storm2-board-7', 'Two Enter presses on Post post a-1046 and then press Back to Board: focus lands on checkout.back after the first', 'FIX-ROUND2 focus-after-action rule (checkout.js doPost rerender focus)',
          posted && (f1 === 'checkout.back' || /\/board$/.test(h)), { focusAfterFirstEnter: f1, hash: h, posted, clicks, focusAfter: await focused(p) });
      } finally { await c.close(); }
    },

    // checkout.js doPost(): the after_hours hold was given the "Request approval" control, and the request it wrote
    // was approvable while the hours policy still held. Negative control: the gate's control is not Request approval
    // and pressing it writes no approvals row.
    async 'A-storm2-board-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047?afterHours=1');
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.writeoff.add');
        await p.fill(tid('checkout.writeoff.amount'), '100'); await click(p, 'checkout.writeoff.reason.courtesy');
        await click(p, 'checkout.post');
        const g = (await gates(p))[0] || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const st = await state(p);
        rec('A-storm2-board-8', 'Under after hours the Checkout write-off gate "Held until 7:30 am — after hours" carries the control "Request approval", and the press writes an approvable request', 'CONTRACTS §6 after_hours; store.js evaluateRelease "held regardless of amount" (checkout.js doPost held branch)',
          !!g && g.code === 'after_hours' && st.clock.afterHours === true && (g.control === 'Request approval' || st.approvals.length > 0), { gate: g, approvals: st.approvals.map((a) => a.id + ':' + a.status), afterHours: st.clock.afterHours });
      } finally { await c.close(); }
    },

    // checkout.js withControl(): pin_no_match was rendered without fresh:true, so four misses logged one refusal
    // event. Negative control: every miss logs (events >= misses) — or the store locks the pad (pin_locked).
    async 'A-storm2-board-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash');
        const seq0 = await lastSeq(p); const codes = [];
        for (const pin of ['9', '8', '7']) { await p.fill(tid('checkout.pin'), pin); await click(p, 'checkout.post'); codes.push(((await gates(p))[0] || {}).code || null); }
        const refusals = (await since(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => e.code);
        const misses = codes.filter((x) => x === 'pin_no_match').length;
        rec('A-storm2-board-9', 'Three wrong PINs in checkout.pin each re-show pin_no_match but log one refusal event in total', 'CONTRACTS §5 — one refusal event per raised gate; ui.js refusal fresh (checkout.js withControl pin_no_match)',
          misses >= 2 && refusals.length < codes.filter(Boolean).length, { codes, refusals });
      } finally { await c.close(); }
    },

    // checkout.js state[aid].pin: the typed PIN survived an author switch through the pad, so Post ran under the
    // PIN's owner after Bree signed in. Negative control: the field is empty after the switch.
    async 'A-storm2-board-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash'); await p.fill(tid('checkout.pin'), '2468');
        await click(p, 'topbar.author'); for (let i = 0; i < 4; i++) await click(p, 'pin.key.1'); await click(p, 'pin.submit'); await p.waitForTimeout(200);
        const who = await p.evaluate(() => Proto.store.currentUser().name);
        const pin = await p.$eval(tid('checkout.pin'), (e) => e.value).catch(() => null);
        const stPin = await p.evaluate(() => (Proto.screens.checkout.state['a-1046'] || {}).pin);
        rec('A-storm2-board-10', 'On a shared desk the PIN typed into checkout.pin survives an author switch made through the pad (field still 2468 after Bree signs in)', 'docs/13 feature 5 — a switch of author invalidates any pending credential (checkout.js render st.pin)',
          /Bree/.test(who || '') && (pin === '2468' || stPin === '2468'), { currentUser: who, pinField: pin, statePin: stPin, hash: await hash(p) });
      } finally { await c.close(); }
    },

    // checkout.js render(): a-1050 carries the seeded decision cd-0 yet rendered the live tender form and Post.
    // Negative control: the decided visit shows its record (no checkout.post / tender controls).
    async 'A-storm2-board-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1050');
        const st = await state(p); const a = st.appointments.find((x) => x.id === 'a-1050');
        const decided = st.collectionDecisions.some((d) => d.encounterId === a.encounterId);
        const post = !!(await p.$(tid('checkout.post'))); const tender = !!(await p.$(tid('checkout.tender.cash')));
        const text = await p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' '));
        rec('A-storm2-board-11', 'Checkout for a-1050 (decision cd-0 seeded, chip "Already checked out") renders the live tender form with an irreversible Post', 'CONTRACTS §6 already_decided; docs/01 principle 9 — a decided visit shows its record (checkout.js render posted card keyed on st.posted)',
          decided && (post || tender), { decided, post, tender, alreadyChip: /Already checked out/.test(text) });
      } finally { await c.close(); }
    },

    // chairs.js card(): "Balance before today" printed appointment.balanceCents, not the ledger's balances().
    // Negative control: the card's balance equals Proto.store.balances(pid).patientDue.
    async 'A-storm2-board-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const ids = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="chairs.card."][data-testid$=".expand"]')].map((e) => e.getAttribute('data-testid')));
        for (const t of ids) await click(p, t);
        const rows = await p.evaluate(() => { const S = Proto.store.get(); const out = []; for (const card of document.querySelectorAll('[data-testid^="chairs.card."]')) { const t = card.getAttribute('data-testid'); if (!/^chairs\.card\.a-\d+$/.test(t)) continue; const m = /Balance(?: before today)?:? \$([\d,]+\.\d\d)/.exec(card.textContent); if (!m) continue; const a = S.appointments.find((x) => x.id === t.slice(12)); out.push({ aid: a.id, shown: Math.round(Number(m[1].replace(/,/g, '')) * 100), field: a.balanceCents, patientDue: Proto.store.balances(a.patientId).patientDue }); } return out; });
        rec('A-storm2-board-12', 'The Chairs card detail "Balance before today" prints appointment.balanceCents, which disagrees with Proto.store.balances(pid) for the same visit', 'C5 one canonical value per fact — Chairs balance = Ledger = Board (chairs.js details line)',
          rows.length > 0 && rows.some((r) => r.shown === r.field && r.shown !== r.patientDue), { rows });
      } finally { await c.close(); }
    },

    // chairs.js doReady(): focus moved to Write note after Ready, so a second Enter opened the note.
    // Negative control: after Enter, Enter the route is still chairs and no note click is logged.
    async 'A-storm2-board-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board'); await click(p, 'board.card.a-1042.arrive'); await click(p, 'board.card.a-1042.seat');
        await hop(p, '#/hygienist/chairs');
        const seq0 = await lastSeq(p);
        const f1 = await enterTwice(p, 'chairs.card.a-1042.ready');
        const clicks = (await since(p, seq0)).filter((e) => e.kind === 'click').map((e) => e.testid);
        const status = (await state(p)).appointments.find((x) => x.id === 'a-1042').status;
        rec('A-storm2-board-13', 'Two Enter presses on Ready for exam request the exam and then open the note: focus lands on chairs.card.a-1042.note after the first', 'FIX-ROUND2 focus-after-action rule (chairs.js doReady after focus)',
          status === 'ready_for_exam' && (f1 === 'chairs.card.a-1042.note' || clicks.includes('chairs.card.a-1042.note')), { focusAfterFirstEnter: f1, status, clicks, hash: await hash(p) });
      } finally { await c.close(); }
    },

    // board.js gates[]: a second refused Arrive under the outage left two identical outage gates standing, the older
    // one stripped of its contract ids. Negative control: one visible outage gate, carrying refusal.control.
    async 'A-storm2-board-14'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1');
        await click(p, 'board.card.a-1075.arrive'); await click(p, 'board.card.a-1061.arrive');
        const g = await gates(p);
        const outageGates = g.filter((x) => x.code === 'outage');
        rec('A-storm2-board-14', 'Under the outage a second refused Arrive on another Board card leaves two identical outage gates, the older with no refusal.control', 'CONTRACTS §4/§6 — one cause, one gate; every visible gate carries one refusal.control (board.js gates per card)',
          outageGates.length >= 2 || outageGates.some((x) => !x.control && x.prior > 0), { gates: g });
      } finally { await c.close(); }
    },

    // checkout.js postedCard(): the card read the st.posted snapshot, so after the note filed it still said "held as
    // credit until the note is filed" beside Credit $0.00. Negative control: the sentence follows live state.
    async 'A-storm2-board-15'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.post');
        await set(p, { persona: 'dentist' }); await hop(p, '#/dentist/encounter/enc-9003'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const st = await state(p); const filed = st.filedNotes.some((n) => n.encounterId === 'enc-9003');
        const bal = await p.evaluate(() => Proto.store.balances('p-303'));
        await set(p, { persona: 'frontdesk' }); await hop(p, '#/frontdesk/checkout/a-1044');
        const text = await p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' '));
        rec('A-storm2-board-15', 'After the note files and Credit reads $0.00, the Checkout Posted card for a-1044 still says the payment is "held as credit until the note is filed"', 'C5 one canonical value per fact — a screen summary reads the store, not a post-time snapshot (checkout.js postedCard)',
          filed && bal.credit === 0 && /held as credit until the note is filed/.test(text), { filed, balances: bal, stale: /held as credit until the note is filed/.test(text), waits: /waits for this visit/.test(text) });
      } finally { await c.close(); }
    },

    // chairs.js Held Ready onClick: it only focused the stale outage control, so after the outage ended without a
    // re-render the press requested nothing. The flags are flipped directly (no repaint) so the check measures the
    // screen's own rule, not app.js set(). Negative control: the press re-evaluates and writes the exam request.
    async 'A-storm2-board-16'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board'); await click(p, 'board.card.a-1042.arrive'); await click(p, 'board.card.a-1042.seat');
        await hop(p, '#/hygienist/chairs?outage=1');
        await click(p, 'chairs.card.a-1042.ready');
        const t1 = await btnState(p, 'chairs.card.a-1042.ready');
        await p.evaluate(() => { window.__proto.outage = false; Proto.store.get().outage = false; });
        await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(150);
        const t2 = await btnState(p, 'chairs.card.a-1042.ready'); const g = await gates(p);
        const st = await state(p); const status = st.appointments.find((a) => a.id === 'a-1042').status;
        rec('A-storm2-board-16', 'Chairs "Ready for exam" held by the outage stays Held after the outage ends without a re-render, and the press only focuses the stale outage control', 'FIX-ROUND2 stale-gate rule — a press on Held re-evaluates first (chairs.js Held onClick)',
          !!t1 && t1.held && st.outage === false && ((t2 && t2.held) || g.some((x) => x.code === 'outage')) && status !== 'ready_for_exam', { duringOutage: t1, afterOutage: t2, gates: g, status });
      } finally { await c.close(); }
    },
  };
};
