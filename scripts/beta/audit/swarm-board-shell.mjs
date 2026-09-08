// Swarm hunt, lens board-shell: router.js, app.js, events.js, screens/shell.js, signin.js, board.js, chairs.js.
// Verified (swarm/verified-board-shell): all five checks reproduced independently against 2a5ea39 and each flipped to
// "no" under a local negative-control patch (onClose hook in openPinPad; status gates in postCheckout, arrive, seat;
// clock comparison in pingChair; enum/boolean validation in P.set). Line references are to 2a5ea39.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const brief = (ev) => ev.map((e) => e.seq + ':' + e.kind + (e.code ? '/' + e.code : e.table ? '/' + e.table + '/' + e.id : e.key ? '/' + e.key : ''));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });
  const overlays = (p) => p.evaluate(() => document.querySelectorAll('#dialogs .overlay').length);
  const appt = (p, id) => p.evaluate((id) => { const a = window.__proto.state().appointments.find((x) => x.id === id); return a ? { status: a.status, arrivedAt: a.arrivedAt || null } : null; }, id);

  return {
    // shell.js:108-110 openPinPad wraps the dialog's close() so Cancel and a matched PIN also remove the capture-phase
    // onPadKey listener (:107), but ui.js:115-118 close the dialog on Escape, on the backdrop and on hashchange through
    // the dialog's OWN close, which the wrapper never sees. After Escape the pad is gone and onPadKey stays on document:
    // Enter on any focused button is preventDefault-ed (the button never fires) and submit() logs an invisible pin_no_match
    // refusal; digits typed anywhere accumulate, and a seed PIN + Enter opens a session and switches the author with no dialog.
    // Cancel and a matched PIN do go through the wrapper, so this is specific to the three dialog-owned exits. ui.js:115
    // already calls opts.onClose from the dialog's close(); openPinPad simply does not pass one.
    // Negative control: once Escape/backdrop/hashchange route through the wrapper (or the dialog takes an onClose), Enter on
    // board.card.a-1042.arrive arrives Marisol (status → arrived, no pin_no_match), typing 2468 + Enter writes no sessions row
    // and the persona stays frontdesk; then enterSwallowed, ghostRefusal and authorSwitched are all false and the check reports false.
    // The pad must have been open and then closed by Escape (padOpen true → false) or the scenario is not this claim.
    async 'S-board-shell-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        await click(p, 'topbar.author'); await p.waitForTimeout(120);
        const padOpen = !!(await p.$('[data-testid="pin.key.1"]'));
        await p.keyboard.press('Escape'); await p.waitForTimeout(120);
        const padClosed = !(await p.$('[data-testid="pin.key.1"]')) && (await overlays(p)) === 0;
        const before = await appt(p, 'a-1042');
        const seq0 = await lastSeq(p);
        await p.focus('[data-testid="board.card.a-1042.arrive"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const ev1 = await after(p, seq0);
        const afterEnter = await appt(p, 'a-1042');
        const ghost = ev1.filter((e) => e.kind === 'refusal').map((e) => e.code);
        const visibleRefusals = await p.evaluate(() => document.querySelectorAll('.refusal').length);
        const personaBefore = await p.evaluate(() => window.__proto.persona);
        const seq1 = await lastSeq(p);
        await p.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
        for (const k of ['2', '4', '6', '8']) await p.keyboard.press(k);
        await p.keyboard.press('Enter'); await p.waitForTimeout(250);
        const ev2 = await after(p, seq1);
        const afterPin = await p.evaluate(() => ({ persona: window.__proto.persona, hash: location.hash, overlays: document.querySelectorAll('#dialogs .overlay').length, sessions: window.__proto.state().sessions.map((s) => s.id + ':' + s.userId + ':' + (s.endedAt || 'open')), author: ((document.querySelector('[data-testid="topbar.author"]') || {}).textContent || '').trim() }));
        const enterSwallowed = before && afterEnter && before.status === afterEnter.status && !ev1.some((e) => e.kind === 'write' && e.table === 'appointments');
        const ghostRefusal = ghost.includes('pin_no_match') && visibleRefusals === 0;
        const authorSwitched = afterPin.persona !== personaBefore && ev2.some((e) => e.kind === 'write' && e.table === 'sessions') && afterPin.overlays === 0;
        const reproduced = padOpen && padClosed && (enterSwallowed || ghostRefusal || authorSwitched);
        rec('S-board-shell-1', 'Closing the Switch-author pad with Escape leaves its capture-phase keydown handler on document: Enter on any button is swallowed and logs a hidden pin_no_match refusal, and a PIN typed on the Board with no dialog open switches the author', 'A2/B10 — shell.js:107-110 removes onPadKey only through its wrapper; ui.js:115-118 Escape/backdrop/hashchange close bypass it (ui.js:115 offers opts.onClose, unused)',
          reproduced, { padOpen, padClosed, a1042Before: before, a1042AfterEnter: afterEnter, enterSwallowed, eventsAfterEnter: brief(ev1), seqRangeEnter: range(ev1, seq0), ghostRefusalCodes: ghost, visibleRefusalsOnPage: visibleRefusals, ghostRefusal, personaBefore, afterPin, eventsAfterPin: brief(ev2), seqRangePin: range(ev2, seq1), authorSwitched });
      } finally { await c.close(); }
    },

    // board.js:19 offers Checkout only for CHECKOUTABLE statuses (in_chart, note_filed), but router.js accepts
    // #/<persona>/checkout/<apptId> for any appointment and neither checkout.js (Post at :236) nor store.js:126 postCheckout
    // checks the appointment status. Opening a-1042 (confirmed, 9:00, not arrived) by URL and pressing Post writes a collection
    // decision and a credit and moves the status to checked_out_unfiled; back on the Board the card reads "Filed later" with
    // no Arrive, Seat or Checkout control, so the visit can never be worked.
    // Negative control: when postCheckout (or the checkout screen) refuses a not-arrived appointment, no collectionDecisions/
    // appointments write follows Post, a-1042 stays confirmed and keeps board.card.a-1042.arrive; then posted and statusJumped
    // are false and the check reports false. a-1042 must start confirmed with no arrivedAt or the scenario is not this claim.
    async 'S-board-shell-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1042');
        const before = await appt(p, 'a-1042');
        const clock = await p.evaluate(() => window.__proto.state().clock.time);
        const postLive = !!(await p.$('[data-testid="checkout.post"]'));
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const afterPost = await appt(p, 'a-1042');
        const money = await p.evaluate(() => { const S = window.__proto.state(); return { collectionDecisions: S.collectionDecisions.filter((d) => d.encounterId === (S.appointments.find((a) => a.id === 'a-1042') || {}).encounterId).map((d) => d.id + ':' + d.decision + ':' + d.patientPortionCents), credits: (S.credits || []).map((x) => x.id + ':' + (x.amountCents || x.cents || '')) }; });
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(150);
        const card = await p.evaluate(() => { const c = document.querySelector('[data-testid="board.card.a-1042"]'); return { chips: c ? [...c.querySelectorAll('.chip')].map((e) => e.textContent.trim()) : null, controls: [...document.querySelectorAll('[data-testid^="board.card.a-1042."]')].map((e) => e.getAttribute('data-testid')) }; });
        const posted = ev.some((e) => e.kind === 'write' && e.table === 'collectionDecisions') && ev.some((e) => e.kind === 'write' && e.table === 'appointments' && e.id === 'a-1042');
        const statusJumped = !!before && before.status === 'confirmed' && before.arrivedAt === null && !!afterPost && /checked_out/.test(afterPost.status) && afterPost.arrivedAt === null;
        const stuck = !card.controls.some((t) => /\.(arrive|seat|checkout)$/.test(t));
        const reproduced = postLive && posted && statusJumped;
        rec('S-board-shell-2', 'Checkout before arrival: #/frontdesk/checkout/a-1042 (confirmed, never arrived) shows a live Post that writes a collection decision and moves the appointment to checked_out_unfiled; the Board card then reads Filed later with no Arrive/Seat/Checkout control', 'A2/C5 — board.js:19 CHECKOUTABLE is the only status gate; store.js:126 postCheckout and checkout.js:236 Post never check appointment status',
          reproduced, { clock, postLive, a1042Before: before, a1042AfterPost: afterPost, money, events: brief(ev), seqRange: range(ev, seq0), boardCardChips: card.chips, boardCardControls: card.controls, noWorkableControlLeft: stuck });
      } finally { await c.close(); }
    },

    // store.js:121 writes every ping with the constant sameQuarter: true and :120 refuses whenever the chair's last message
    // carries it, so the "Wait 15 minutes" window never opens again: two hours later, and on the next calendar day, the same
    // chair is still refused ping_rate and the Board shows the same verb.
    // Negative control: a limiter that compares the last ping's time to clock.time lets the second ping at 10:40 write a
    // second messages row with no refusal; then refusedLater is false and the check reports false. The first ping must have
    // written exactly one message and the clock must actually have moved (clockAfter !== clockBefore) or nothing is measured.
    async 'S-board-shell-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const clockBefore = await p.evaluate(() => window.__proto.state().clock.time);
        const seq0 = await lastSeq(p);
        await click(p, 'board.queue.row.a-1050.ping'); await p.waitForTimeout(120);
        const ev1 = await after(p, seq0);
        const msgs1 = await p.evaluate(() => window.__proto.state().messages.filter((m) => m.appointmentId === 'a-1050').map((m) => m.id + ':' + (m.sameQuarter === true ? 'sameQuarter' : String(m.sameQuarter))));
        await p.evaluate(() => { Proto.store.get().clock.time = '10:40'; Proto.router.render(); }); await p.waitForTimeout(120);
        const clockAfter = await p.evaluate(() => window.__proto.state().clock.time);
        const seq1 = await lastSeq(p);
        await click(p, 'board.queue.row.a-1050.ping'); await p.waitForTimeout(150);
        const ev2 = await after(p, seq1);
        const verb = await txt(p, 'refusal.verb');
        const msgs2 = await p.evaluate(() => window.__proto.state().messages.filter((m) => m.appointmentId === 'a-1050').length);
        const nextDay = await p.evaluate(() => { const s = Proto.store.get(); s.tenant.today = '2026-09-04'; s.clock.time = '08:00'; const r = Proto.store.pingChair('a-1050'); return { ok: r.ok, code: r.code || null, verb: r.verb || null }; });
        const firstWrote = ev1.some((e) => e.kind === 'write' && e.table === 'messages') && msgs1.length === 1;
        const refusedLater = ev2.some((e) => e.kind === 'refusal' && e.code === 'ping_rate') && msgs2 === 1 && !!verb && /15 minutes/.test(verb);
        const reproduced = firstWrote && clockAfter !== clockBefore && refusedLater && nextDay.ok === false && nextDay.code === 'ping_rate';
        rec('S-board-shell-3', 'The chair-ping limiter never expires: after the store clock moves from 08:40 to 10:40 (and on the next day) Ping chair on a-1050 is still refused "Wait 15 minutes — chair already pinged" because sameQuarter is a stored constant, never compared to the clock', 'A2/A4 — store.js:120-121 pingChair writes sameQuarter: true and refuses on it without reading clock.time',
          reproduced, { clockBefore, clockAfter, firstPingEvents: brief(ev1), messagesAfterFirst: msgs1, secondPingEvents: brief(ev2), seqRange: [seq0 + 1, range(ev2, seq1)[1]], verbAt1040: verb, messagesAfterSecond: msgs2, nextDayDirectCall: nextDay });
      } finally { await c.close(); }
    },

    // store.js:102-111 arrive() and seat() have no status guard: they overwrite a.status unconditionally (the Board's
    // doArrive/doSeat at board.js:88/:95 guard only the button). Called directly, arrive('a-1050') drags a checked-out
    // appointment back to arrived (its arrivedAt is rewritten to the clock), seat('a-1046') drops a filed note's visit back
    // to seated, and a second seat() on the same appointment is accepted again with a second appointment.seated event — the
    // checkout queue then loses a-1050 (its row board.queue.row.a-1050.ping disappears).
    // Negative control: with a status gate, each call returns a refusal (or ok:false) and writes nothing; statuses stay
    // checked_out_unfiled / note_filed, the second seat is refused, and regressed/doubleSeat are false so the check reports false.
    // The seed statuses are read first; the check is not scored unless a-1050 started checked_out* and a-1046 note_filed.
    async 'S-board-shell-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const before = { a1050: await appt(p, 'a-1050'), a1046: await appt(p, 'a-1046') };
        const onBoardBefore = await p.evaluate(() => ({ laneA1050: !!document.querySelector('[data-testid="board.card.a-1050.checkout"]'), queueA1050: !!document.querySelector('[data-testid="board.queue.row.a-1050.ping"]'), queueA1046: !!document.querySelector('[data-testid="board.queue.row.a-1046.ping"]') }));
        const seq0 = await lastSeq(p);
        const results = await p.evaluate(() => ({ arrive1050: Proto.store.arrive('a-1050'), seat1046: Proto.store.seat('a-1046'), seat1046Again: Proto.store.seat('a-1046') }));
        const ev = await after(p, seq0);
        const afterS = { a1050: await appt(p, 'a-1050'), a1046: await appt(p, 'a-1046') };
        const seatedEvents = await p.evaluate(() => window.__proto.state().appointmentEvents.filter((e) => e.appointmentId === 'a-1046' && e.kind === 'appointment.seated').length);
        await p.evaluate(() => Proto.router.render()); await p.waitForTimeout(120);
        const onBoardAfter = await p.evaluate(() => ({ laneA1050: !!document.querySelector('[data-testid="board.card.a-1050.checkout"]'), queueA1050: !!document.querySelector('[data-testid="board.queue.row.a-1050.ping"]'), queueA1046: !!document.querySelector('[data-testid="board.queue.row.a-1046.ping"]') }));
        const seeded = before.a1050 && /^checked_out/.test(before.a1050.status) && before.a1046 && before.a1046.status === 'note_filed';
        const regressed = results.arrive1050.ok === true && afterS.a1050.status === 'arrived' && results.seat1046.ok === true && afterS.a1046.status === 'seated';
        const doubleSeat = results.seat1046Again.ok === true && seatedEvents >= 2;
        const reproduced = !!seeded && regressed && doubleSeat && onBoardBefore.queueA1050 && !onBoardAfter.queueA1050;
        rec('S-board-shell-4', 'Proto.store.arrive and seat carry no status guard: arrive("a-1050") pulls a checked-out visit back to arrived, seat("a-1046") pulls a filed visit back to seated, a second seat is accepted with a second seated event, and the checkout queue loses a-1050', 'A2/A4 — store.js:102-111 write a.status unconditionally; only board.js:88/:95 guard the buttons',
          reproduced, { seeded, before, results, after: afterS, seatedEventsForA1046: seatedEvents, events: brief(ev), seqRange: range(ev, seq0), onBoardBefore, onBoardAfter });
      } finally { await c.close(); }
    },

    // CONTRACTS §3 types theme as 'light'|'dark', device as 'desk'|'operatory'|'shared'|'phone' and privacy as boolean, and §3
    // says query parameters "set the same options" (its example is privacy=1&outage=1). app.js:9-10 set() copies any truthy
    // string into __proto.theme/device and onto data-theme/data-device, :12-13 coerce privacy/outage with a truthiness test
    // that only special-cases '0', and app.js:28 forwards every query value unfiltered, so ?theme=purple&device=tv&privacy=false
    // leaves the page reporting theme 'purple', device 'tv' and privacy TRUE, and the values persist on later routes.
    // Negative control: a set() that validates against the §3 enums and reads booleans only from '1'/'true' leaves theme
    // 'light', device 'desk', privacy false (and data-theme/data-device the same); then outOfContract is empty and the check reports false. The
    // well-formed ?theme=dark&device=phone contrast is read in the same context so a set() that ignores queries entirely is
    // also reported false rather than mistaken for validation.
    async 'S-board-shell-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?theme=purple&device=tv&privacy=false');
        const read = () => p.evaluate(() => ({ hash: location.hash, theme: window.__proto.theme, device: window.__proto.device, privacy: window.__proto.privacy, dataTheme: document.documentElement.getAttribute('data-theme'), dataDevice: document.documentElement.getAttribute('data-device'), h1: ((document.querySelector('#canvas h1') || {}).textContent || '').trim() }));
        const bad = await read();
        await hop(p, '#/frontdesk/chairs'); await p.waitForTimeout(120);
        const persisted = await read();
        const viaSet = await p.evaluate(() => { window.__proto.set({ theme: 'neon', device: 'toaster' }); return { theme: window.__proto.theme, device: window.__proto.device, dataTheme: document.documentElement.getAttribute('data-theme'), dataDevice: document.documentElement.getAttribute('data-device') }; });
        await go(p, '#/frontdesk/board?theme=dark&device=phone');
        const good = await read();
        const THEMES = ['light', 'dark']; const DEVICES = ['desk', 'operatory', 'shared', 'phone'];
        const outOfContract = [];
        if (!THEMES.includes(bad.theme)) outOfContract.push('query theme=' + bad.theme);
        if (!DEVICES.includes(bad.device)) outOfContract.push('query device=' + bad.device);
        if (bad.privacy === true) outOfContract.push('query privacy=false read as true');
        if (!THEMES.includes(persisted.theme) || !DEVICES.includes(persisted.device)) outOfContract.push('persists to next route: theme=' + persisted.theme + ' device=' + persisted.device);
        if (!THEMES.includes(viaSet.theme)) outOfContract.push('set() theme=' + viaSet.theme);
        if (!DEVICES.includes(viaSet.device)) outOfContract.push('set() device=' + viaSet.device);
        const queriesWork = good.theme === 'dark' && good.device === 'phone' && good.dataTheme === 'dark';
        const reproduced = queriesWork && outOfContract.length > 0 && !!bad.h1;
        rec('S-board-shell-5', '?theme=purple&device=tv&privacy=false and set({theme:"neon", device:"toaster"}) are accepted verbatim: __proto.theme/device and data-theme/data-device carry values outside the CONTRACTS §3 enums, privacy=false turns privacy ON, and the values persist across routes', 'CONTRACTS §3 — app.js:9-13 set() and :28 applyQuery copy option strings without validating them; booleans are truthy-coerced',
          reproduced, { afterBadQuery: bad, afterHopToChairs: persisted, afterSetWithBadValues: viaSet, wellFormedContrast: good, outOfContract });
      } finally { await c.close(); }
    },
  };
};
