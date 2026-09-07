// Audit checks for prototype/js/screens/board.js, chunk screens-board-1
// (root causes RC-15, 16, 18, 22, 212, 72, 73, 74, 75, 76, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {

// The readiness row ids carry seed id segments (`board.readiness.row.<seedId>.<control>`), and a fix round
// can legitimately change which seed id a row names. A probe that hard-codes one stops pressing anything the
// day that happens — silently, because click() returns false rather than throwing — so each row is found by
// its control suffix instead. Trap 2: a rename disarms a check without crashing it.
const readinessRow = (p, control) => p.evaluate((c) => {
  const e = document.querySelector('[data-testid^="board.readiness.row."][data-testid$=".' + c + '"]');
  return e ? e.getAttribute('data-testid') : null;
}, control);
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const kinds = (ev) => ev.map((e) => e.kind + (e.testid ? ':' + e.testid : e.table ? ':' + e.table + '/' + e.id : e.key ? ':' + e.key : ''));
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body || !a ? { tag: 'BODY', testid: null } : { tag: a.tagName, testid: a.getAttribute('data-testid') }; });
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const railOpen = (p) => p.evaluate(() => { const r = document.getElementById('rail'); return !!r && !r.hidden; });
  const canvasLen = (p) => p.evaluate(() => (document.getElementById('canvas') || {}).innerHTML.length || 0);
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => b.textContent.trim()),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  // The status chip is the first .chip inside the card's .who (Board) / head (Chairs); words are read without the glyph.
  const chipWords = (p, tid) => p.evaluate((tid) => { const el = document.querySelector('[data-testid="' + tid + '"]'); if (!el) return null; return [...el.querySelectorAll('.chip')].map((c) => c.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()); }, tid);
  const cents = (text) => { const m = /Balance\s+(−?)\$([\d,]+\.\d\d)/.exec(text || ''); return m ? Math.round(Number(m[2].replace(/,/g, '')) * 100) * (m[1] ? -1 : 1) : null; };

  return {
    // RC-15 · B3 · board.js:247 onKey('a') calls doArrive on the first arrivable card; board.js:177 renders Arrive as `btn irreversible`.
    // Negative control: if Arrive carried the reversible identity (class without `irreversible`), or the key opened a confirmation
    // (an #dialogs .overlay) or raised a refusal before writing, then `identityIrreversible` or `wroteWithoutGate` is false and the check
    // reports false. Focus is put on the body first so the key is a bare accelerator, not an Enter on a focused button.
    async 'A-screens-board-1-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const identity = await p.evaluate(() => { const el = document.querySelector('[data-testid="board.card.a-1042.arrive"]'); return el ? { class: el.className, text: el.textContent.trim() } : null; });
        const before = await p.evaluate(() => { const S = window.__proto.state(); return { statuses: S.appointments.filter((a) => a.locationId === 'loc-1' && ['scheduled', 'confirmed'].includes(a.status)).map((a) => a.id + ':' + a.status), appointmentEvents: S.appointmentEvents.length }; });
        await p.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
        const focusBefore = await active(p);
        const seq0 = await lastSeq(p);
        await p.keyboard.press('a'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); const arrived = S.appointments.filter((a) => a.locationId === 'loc-1' && a.status === 'arrived').map((a) => a.id); return { arrived, appointmentEvents: S.appointmentEvents.length, lastEvent: S.appointmentEvents[S.appointmentEvents.length - 1] || null, dialogOpen: !!document.querySelector('#dialogs .overlay') }; });
        const apptWrites = ev.filter((e) => e.kind === 'write' && e.table === 'appointmentEvents');
        const refusals = refusalEvents(ev);
        const identityIrreversible = !!identity && /\birreversible\b/.test(identity.class);
        const wroteWithoutGate = apptWrites.length > 0 && refusals.length === 0 && !afterS.dialogOpen && afterS.arrived.length > 0;
        rec('A-screens-board-1-1', 'On the Board the bare A key arrives the first arrivable patient and writes appointmentEvents with no confirmation or refusal, while the Arrive control carries the irreversible identity', 'B3 — the same verb carries the same identity everywhere and an irreversible verb never executes from a keyboard accelerator without its gate; board.js:177 (identity) and :247 (accelerator)',
          identityIrreversible && wroteWithoutGate, { arriveControl: identity, identityIrreversible, focusBeforeKey: focusBefore, arrivableBefore: before.statuses, arrivedAfterKey: afterS.arrived, appointmentEventsBefore: before.appointmentEvents, appointmentEventsAfter: afterS.appointmentEvents, lastAppointmentEvent: afterS.lastEvent, writesInRange: writes(ev), refusalEventsInRange: refusals, dialogOpenAfterKey: afterS.dialogOpen, announcement: await live(p), focusAfterKey: await active(p), seqRange: range(ev, seq0), note: 'CONTRACTS §7 flow 1 budgets check-in at one tap, so the gate-free write is by design; the breach measured is the identity the gate-free verb carries.' });
      } finally { await c.close(); }
    },

    // RC-16 · B2 · board.js:85 builds the ping_rate refusal without onControl, so "Open the chart" has no handler.
    // Negative control: a working control opens the Patient Rail (#rail not hidden) or routes to the encounter (hash changes, a `route`
    // event); then `hashChanged || railOpenedAfter` is true and the check reports false. The first ping must have written a messages row
    // and the second must have raised code ping_rate with control "Open the chart" — any other refusal is not this claim.
    async 'A-screens-board-1-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const seqA = await lastSeq(p);
        await click(p, 'board.queue.row.a-1044.ping'); await p.waitForTimeout(150);
        const firstWrites = writes(await after(p, seqA));
        const seqB = await lastSeq(p);
        await click(p, 'board.queue.row.a-1044.ping'); await p.waitForTimeout(150);
        const gateEvents = refusalEvents(await after(p, seqB));
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'ping_rate');
        const beforeCtl = { hash: await p.evaluate(() => location.hash), railOpen: await railOpen(p), canvasLen: await canvasLen(p), live: await live(p) };
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterCtl = { hash: await p.evaluate(() => location.hash), railOpen: await railOpen(p), canvasLen: await canvasLen(p), live: await live(p) };
        const hashChanged = beforeCtl.hash !== afterCtl.hash;
        const routeEvents = ev.filter((e) => e.kind === 'route').length;
        const gateIsPingRate = dom.length > 0 && dom[0].controls.includes('Open the chart') && gateEvents.some((e) => e.code === 'ping_rate');
        const reproduced = firstWrites.some((w) => w.startsWith('messages/')) && gateIsPingRate && pressed && !hashChanged && !afterCtl.railOpen && routeEvents === 0;
        rec('A-screens-board-1-2', 'After a second Ping chair on a-1044 the ping_rate refusal renders "Open the chart", and pressing it changes nothing: no route, no rail, no state', 'B2 / CONTRACTS §6 — the one control of a refusal does what its label says; board.js:85 passes no onControl',
          reproduced, { firstPingWrites: firstWrites, secondPingRefusalEvents: gateEvents, pingRateRefusalDom: dom, controlPressed: pressed, before: beforeCtl, after: afterCtl, hashChanged, routeEventsInRange: routeEvents, eventsInRange: kinds(ev), writesInRange: writes(ev), seqRange: range(ev, seq0), focusAfterPress: await active(p) });
      } finally { await c.close(); }
    },

    // RC-18 · C5 · board.js:151 renders a.balanceCents (the seed estimate) under the word "Balance"; store.js:33 balances() reads the ledger.
    // Negative control: when the card is right, the cents parsed from "Balance $X" equal money(balances(pid).patientDue) for a-1044 and a-1046
    // (both $0.00 in the seed) and equal the Checkout/Ledger "Patient due" figure; then `disagree` is empty and the check reports false.
    // a-1047 is read too as the control case where all renderings agree at $410.00.
    async 'A-screens-board-1-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const cases = [['a-1044', 'p-303'], ['a-1046', 'p-305'], ['a-1047', 'p-306']];
        const rows = [];
        for (const [aid, pid] of cases) {
          await click(p, 'board.card.' + aid + '.expand'); await p.waitForTimeout(100);
          const card = await p.evaluate((aid) => { const d = document.getElementById('board-details-' + aid); return d ? d.textContent.replace(/\s+/g, ' ').trim() : null; }, aid);
          const store = await p.evaluate(([aid, pid]) => { const S = window.__proto.state(); const a = S.appointments.find((x) => x.id === aid); return { balanceCents: a.balanceCents, estimatePatientCents: (S.estimates[aid] || {}).patientCents ?? null, balances: Proto.store.balances(pid), ledgerRows: S.ledger.filter((e) => e.patientId === pid).map((e) => e.kind + ':' + e.amountCents) }; }, [aid, pid]);
          rows.push({ aid, pid, cardDetails: card, cardBalanceCents: cents(card), store });
        }
        for (const row of rows) {
          await hop(p, '#/frontdesk/checkout/' + row.aid); await p.waitForTimeout(150);
          row.checkoutThreeNumbers = await p.evaluate(() => { const t = document.querySelector('.threenum'); return t ? t.textContent.replace(/\s+/g, ' ').trim() : null; });
          await hop(p, '#/frontdesk/ledger/' + row.pid); await p.waitForTimeout(150);
          row.ledgerThreeNumbers = await p.evaluate(() => { const t = document.querySelector('#canvas .threenum'); return t ? t.textContent.replace(/\s+/g, ' ').trim() : null; });
          row.patientDueRendered = { checkout: ((row.checkoutThreeNumbers || '').match(/\$[\d,]+\.\d\d(?=\s*Patient due)/) || [null])[0], ledger: ((row.ledgerThreeNumbers || '').match(/\$[\d,]+\.\d\d(?=\s*Patient due)/) || [null])[0] };
        }
        const disagree = rows.filter((r) => r.cardBalanceCents != null && r.cardBalanceCents !== r.store.balances.patientDue).map((r) => ({ aid: r.aid, cardBalanceCents: r.cardBalanceCents, storePatientDue: r.store.balances.patientDue, appointmentBalanceCents: r.store.balanceCents }));
        const readsSeedField = rows.every((r) => r.cardBalanceCents === r.store.balanceCents);
        // The value the card shows does not move when the ledger does: post the $44 checkout and read the card again.
        await hop(p, '#/frontdesk/checkout/a-1044'); await click(p, 'checkout.tender.card'); await p.fill('[data-testid="checkout.card.number"]', '4242424242424242').catch(() => {}); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(150);
        // `expanded` survives the route change, so only press Expand when the details are not already open.
        if (!(await p.$('#board-details-a-1044'))) { await click(p, 'board.card.a-1044.expand'); await p.waitForTimeout(100); }
        const afterPost = await p.evaluate(() => { const d = document.getElementById('board-details-a-1044'); const S = window.__proto.state(); const a = S.appointments.find((x) => x.id === 'a-1044'); return { appointmentStatus: a.status, appointmentBalanceCents: a.balanceCents, cardDetails: d ? d.textContent.replace(/\s+/g, ' ').trim() : null, balances: Proto.store.balances('p-303'), posted: S.collectionDecisions.filter((x) => x.encounterId === 'enc-9003').length }; });
        afterPost.cardBalanceCents = cents(afterPost.cardDetails);
        rec('A-screens-board-1-3', 'The Board card "Balance" for a-1044 ($44.00) and a-1046 ($168.00) is appointment.balanceCents, while the store ledger balance, the Checkout three numbers and the Ledger screen all read Patient due $0.00 for the same patients', 'C5 — Board balance = ledger = checkout portion; board.js:151 renders a.balanceCents, store.js:33 balances() reads the ledger',
          disagree.length >= 2 && readsSeedField, { renderings: rows, disagree, cardEqualsSeedBalanceCents: readsSeedField, afterPostingCheckout: afterPost });
      } finally { await c.close(); }
    },

    // RC-22 · B4/C5 · board.js:10 STATUS.seated = 'In chart' (and in_chart = 'In chart'); chairs.js:12 STATUS.seated = 'Seated';
    // rail.js:85 prints humanize(status) = '(seated)'; board.js:14 ELIG.green = 'Eligible' vs rail.js:12 ELIG.green = 'Active'.
    // Negative control: one word for status seated on the Board chip, the Board aria-label, the Chairs chip, the Rail line and the Seat
    // announcement, and one word for eligibility green on the Board and the Rail; then `statusWords.size === 1 && eligWords.size === 1`
    // and the check reports false. The store status is read at each reading so two screens showing two states are not scored as drift.
    async 'A-screens-board-1-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const status1043 = await p.evaluate(() => window.__proto.state().appointments.find((a) => a.id === 'a-1043').status);
        const boardChips = await chipWords(p, 'board.card.a-1043');
        const boardAria = await p.evaluate(() => (document.querySelector('[data-testid="board.card.a-1043"]') || {}).getAttribute('aria-label'));
        await click(p, 'board.card.a-1043.rail'); await p.waitForTimeout(200);
        const rail = await p.evaluate(() => { const r = document.getElementById('rail'); if (!r || r.hidden) return null; const line = [...r.querySelectorAll('*')].map((e) => e.textContent.trim()).find((t) => /^Next: /.test(t)) || null; const chips = [...r.querySelectorAll('.chip')].map((c) => c.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()); return { nextLine: line, chips }; });
        // Seat a-1042 and read the announcement word against the chip word for the same new status.
        await click(p, 'board.card.a-1042.arrive'); await click(p, 'board.card.a-1042.seat'); await p.waitForTimeout(200);
        const seatAnnouncement = await live(p);
        const chips1042 = await chipWords(p, 'board.card.a-1042');
        const status1042 = await p.evaluate(() => window.__proto.state().appointments.find((a) => a.id === 'a-1042').status);
        await hop(p, '#/dentist/chairs'); await p.waitForTimeout(200);
        const chairsChips1043 = await chipWords(p, 'chairs.card.a-1043');
        const chairsStatus1043 = await p.evaluate(() => window.__proto.state().appointments.find((a) => a.id === 'a-1043').status);
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(200);
        const chairsChips1042 = await chipWords(p, 'chairs.card.a-1042');
        const statusWords = new Set([boardChips && boardChips[0], chairsChips1043 && chairsChips1043[0]].filter(Boolean));
        const railSeated = rail && rail.nextLine ? (rail.nextLine.match(/^Next:[^(]*\(([^)]+)\)/) || [])[1] || null : null;
        const boardElig = boardChips ? boardChips.find((w) => /Eligible|Verify|Self-pay/.test(w)) : null;
        const railElig = rail ? rail.chips.find((w) => /Active|Re-verify|Inactive|Self-pay|Eligible/.test(w)) : null;
        const eligWords = new Set([boardElig, railElig].filter(Boolean));
        const sameStatus = status1043 === 'seated' && chairsStatus1043 === 'seated';
        const reproduced = sameStatus && statusWords.size > 1;
        rec('A-screens-board-1-4', 'One store status "seated" reads "In chart" on the Board chip and aria-label, "Seated" on the Chairs chip, "(seated)" on the Rail line and "Seated in chair" in the Board announcement; eligibility green reads "Eligible" on the Board and "Active" on the Rail', 'B4, C5 — one canonical word per concept across screens, announcements and aria-labels; board.js:10/14 vs chairs.js:12/16 vs rail.js:12/85',
          reproduced, { storeStatus_a1043: { onBoard: status1043, onChairs: chairsStatus1043 }, boardChips_a1043: boardChips, boardAriaLabel_a1043: boardAria, chairsChips_a1043_dentist: chairsChips1043, railLine_a1043: rail && rail.nextLine, railStatusWord: railSeated, railChips: rail && rail.chips, statusWordsForSeated: [...statusWords, railSeated, seatAnnouncement.split('.')[0]].filter(Boolean), eligibilityWordsForGreen: [...eligWords], eligibilityDrift: eligWords.size > 1, a1042: { statusAfterSeat: status1042, boardChips: chips1042, announcement: seatAnnouncement, chairsChips_hygienist: chairsChips1042 } });
      } finally { await c.close(); }
    },

    // RC-212 · B2/A3 · board.js:122 (readiness row → bare span), :175-180 (Arrive/Seat/Checkout removed), :221 (Ping removed), :245 (A key announces).
    // This check covers the Board part of the root cause; the other five screens belong to their own files' modules.
    // Negative control: a compliant outage Board keeps its controls as Held with an outage refusal (a .refusal node with data-code outage,
    // one refusal.control) and the A key raises a refusal event with code outage; then `arrivePresent || refusalNodes > 0 || keyRefusals > 0`
    // and the check reports false. The online Board is read first so a control that never exists is not scored as "removed".
    async 'A-screens-board-1-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const online = await p.evaluate(() => ({ readinessButtons: document.querySelectorAll('.rdrow button').length, arrive: !!document.querySelector('[data-testid="board.card.a-1042.arrive"]'), pingButtons: document.querySelectorAll('[data-testid$=".ping"]').length, cardCheckouts: document.querySelectorAll('[data-testid^="board.card."][data-testid$=".checkout"]').length }));
        await go(p, '#/frontdesk/board?outage=1');
        const outageFlag = await p.evaluate(() => ({ proto: window.__proto.outage, store: Proto.store.get().outage }));
        const outage = await p.evaluate(() => ({
          readinessRows: [...document.querySelectorAll('.rdrow')].map((r) => ({ buttons: r.querySelectorAll('button').length, text: [...r.querySelectorAll('span.small.muted')].map((s) => s.textContent.trim()).join(' | ') })),
          readinessButtons: document.querySelectorAll('.rdrow button').length,
          arrive: !!document.querySelector('[data-testid="board.card.a-1042.arrive"]'),
          heldButtons: [...document.querySelectorAll('.btn.held')].map((b) => b.getAttribute('data-testid')),
          pingButtons: document.querySelectorAll('[data-testid$=".ping"]').length,
          cardCheckouts: document.querySelectorAll('[data-testid^="board.card."][data-testid$=".checkout"]').length,
          refusalNodes: document.querySelectorAll('.refusal').length,
          stamps: [...document.querySelectorAll('.card.appt .stamp')].slice(0, 2).map((s) => s.textContent.trim()),
        }));
        await p.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
        const seq0 = await lastSeq(p);
        await p.keyboard.press('a'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const keyRefusals = refusalEvents(ev);
        const afterKey = { announcement: await live(p), refusalNodes: await p.evaluate(() => document.querySelectorAll('.refusal').length), writes: writes(ev), arrivedAny: await p.evaluate(() => window.__proto.state().appointments.some((a) => a.status === 'arrived')) };
        // Comparator on another screen: the same outage code through the shared component (chairs.js:98-99). a-1043 is seated, so the
        // dentist's Chairs card carries Ready for exam; under outage that press builds the outage refusal and switches the primary to Held.
        await go(p, '#/dentist/chairs?outage=1');
        const seqC = await lastSeq(p);
        const readyPressed = await click(p, 'chairs.card.a-1043.ready'); await p.waitForTimeout(200);
        const chairs = { readyPressed, refusals: (await refusalsDom(p)).filter((d) => d.code === 'outage'), refusalEvents: refusalEvents(await after(p, seqC)), primaryAfter: await p.evaluate(() => { const b = document.querySelector('[data-testid="chairs.card.a-1043.ready"]'); return b ? { class: b.className, text: b.textContent.trim() } : null; }) };
        const controlsRemoved = online.arrive && !outage.arrive && online.readinessButtons > 0 && outage.readinessButtons === 0 && online.pingButtons > 0 && outage.pingButtons === 0;
        const bareSpan = outage.readinessRows.length > 0 && outage.readinessRows.every((r) => r.buttons === 0 && /Waits for the connection/.test(r.text));
        const keyOnlyAnnounces = keyRefusals.length === 0 && afterKey.refusalNodes === 0 && afterKey.writes.length === 0 && !afterKey.arrivedAny && /read-only/.test(afterKey.announcement);
        const reproduced = outageFlag.proto === true && controlsRemoved && bareSpan && outage.refusalNodes === 0 && outage.heldButtons.length === 0 && keyOnlyAnnounces;
        rec('A-screens-board-1-5', 'Under outage the Board removes Arrive, Seat, Ping and every readiness control and prints a bare span in their place, and the A key only announces — no refusal node, no Held primary, no refusal event — while Chairs renders the same outage code through the shared component', 'B2, A3 — a hand-rolled gate (bare paragraph, removed control, announcement) breaches B2 and writes no refusal event; board.js:122, :175-180, :221, :245',
          reproduced, { outageFlag, online, outage, aKeyUnderOutage: { announcement: afterKey.announcement, refusalEvents: keyRefusals, refusalNodesAfter: afterKey.refusalNodes, writes: afterKey.writes, arrivedAny: afterKey.arrivedAny, eventsInRange: kinds(ev), seqRange: range(ev, seq0) }, chairsComparator: chairs, scope: 'Board part of RC-212 only; Daily Close, Phone, Encounter, Money Desk and Rail parts are other files' });
      } finally { await c.close(); }
    },

    // RC-72 · A3 · board.js:96-97 set boardUi.labCalled / boardUi.deviceReset, remove the row and list it under "What was handled" with no write().
    // Negative control: a compliant control writes one `write` event (any table) in the seq range of the press; then `labWrites.length > 0`
    // (or the device one) and the check reports false. The row must have existed before the press and the state field must have changed —
    // a press on a missing control is not scored. The strip's "Re-verify all" is read as the comparator that does write.
    async 'A-screens-board-1-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const ui = () => p.evaluate(() => { const S = window.__proto.state(); return S.boardUi ? { labCalled: S.boardUi.labCalled, deviceReset: S.boardUi.deviceReset, eligRerun: S.boardUi.eligRerun } : null; });
        const before = await ui();
        const rowsBefore = await p.evaluate(() => [...document.querySelectorAll('.rdrow button')].map((b) => b.getAttribute('data-testid')));
        const seq0 = await lastSeq(p);
        const labPressed = await click(p, await readinessRow(p, 'call')); await p.waitForTimeout(150);
        const labEv = await after(p, seq0);
        const afterLab = await ui(); const labLive = await live(p);
        const seq1 = await lastSeq(p);
        const devPressed = await click(p, await readinessRow(p, 'reset')); await p.waitForTimeout(150);
        const devEv = await after(p, seq1);
        const afterDev = await ui(); const devLive = await live(p);
        const seq2 = await lastSeq(p);
        const rvPressed = await click(p, await readinessRow(p, 'reverify-all')); await p.waitForTimeout(150);
        const rvEv = await after(p, seq2);
        const handled = await p.evaluate(() => { const d = [...document.querySelectorAll('summary')].find((s) => /What was handled/.test(s.textContent)); return d ? d.parentElement.textContent.replace(/\s+/g, ' ').trim() : null; });
        const rowsAfter = await p.evaluate(() => [...document.querySelectorAll('.rdrow button')].map((b) => b.getAttribute('data-testid')));
        const labChanged = labPressed && (before == null || before.labCalled == null) && !!(afterLab && afterLab.labCalled);
        const devChanged = devPressed && (afterLab == null || afterLab.deviceReset == null) && !!(afterDev && afterDev.deviceReset);
        const labWrites = writes(labEv), devWrites = writes(devEv);
        const reproduced = labChanged && labWrites.length === 0 && devChanged && devWrites.length === 0;
        rec('A-screens-board-1-6', 'Call lab and Sign out on the readiness strip change boardUi (labCalled, deviceReset), announce completion and move to "What was handled", but the event log holds no write event for either', 'A3 — a mutation writes one write event per table it changes; board.js:96-97 set boardUi fields directly',
          reproduced, { readinessButtonsBefore: rowsBefore, stateDiff: { before, afterCallLab: afterLab, afterSignOut: afterDev }, callLab: { pressed: labPressed, announcement: labLive, eventsInRange: kinds(labEv), writes: labWrites, seqRange: range(labEv, seq0) }, signOut: { pressed: devPressed, announcement: devLive, eventsInRange: kinds(devEv), writes: devWrites, seqRange: range(devEv, seq1) }, reverifyAllComparator: { pressed: rvPressed, writes: writes(rvEv), seqRange: range(rvEv, seq2) }, handledList: handled, readinessButtonsAfter: rowsAfter });
      } finally { await c.close(); }
    },

    // RC-73 · A2 · board.js:224 renders the Filed-later row's Checkout with no outage guard while :225 (other rows) and :175 (cards) hide theirs.
    // Negative control: under outage the row's Checkout is absent like every other action on the read-only Board (queueCheckoutPresent false),
    // or pressing it stays on the Board; then the check reports false. The online Board is read first so the control is known to exist.
    async 'A-screens-board-1-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const online = await p.evaluate(() => ({ queueCheckouts: [...document.querySelectorAll('[data-testid^="board.queue.row."][data-testid$=".checkout"]')].map((b) => b.getAttribute('data-testid')), cardCheckouts: [...document.querySelectorAll('[data-testid^="board.card."][data-testid$=".checkout"]')].map((b) => b.getAttribute('data-testid')) }));
        await go(p, '#/frontdesk/board?outage=1');
        const outage = await p.evaluate(() => ({ outageFlag: window.__proto.outage, subLine: ((document.querySelector('.page-head .sub') || {}).textContent || '').trim(), queueCheckouts: [...document.querySelectorAll('[data-testid^="board.queue.row."][data-testid$=".checkout"]')].map((b) => b.getAttribute('data-testid')), cardCheckouts: [...document.querySelectorAll('[data-testid^="board.card."][data-testid$=".checkout"]')].map((b) => b.getAttribute('data-testid')), arriveSeatPing: document.querySelectorAll('[data-testid$=".arrive"], [data-testid$=".seat"], [data-testid$=".ping"]').length, a1050status: window.__proto.state().appointments.find((a) => a.id === 'a-1050').status }));
        const hashBefore = await p.evaluate(() => location.hash);
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'board.queue.row.a-1050.checkout'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const hashAfter = await p.evaluate(() => location.hash);
        const h1 = await p.evaluate(() => ((document.querySelector('#canvas h1') || {}).textContent || '').trim());
        const present = outage.queueCheckouts.includes('board.queue.row.a-1050.checkout');
        const routed = pressed && /checkout\/a-1050/.test(hashAfter) && hashAfter !== hashBefore;
        const reproduced = outage.outageFlag === true && online.queueCheckouts.includes('board.queue.row.a-1050.checkout') && present && outage.cardCheckouts.length === 0 && outage.arriveSeatPing === 0 && routed;
        rec('A-screens-board-1-7', 'On the read-only outage Board the Filed-later queue row still renders board.queue.row.a-1050.checkout and pressing it routes to the checkout screen while every other Board action is hidden', 'A2 — the outage Board is read-only (CONTRACTS §3); board.js:224 has no outage guard where :225 and :175 do',
          reproduced, { online, outage, queueCheckoutPresentUnderOutage: present, pressed, hashBefore, hashAfter, landedH1: h1, eventsInRange: kinds(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-74 · A7 · board.js:263 renders the literal 'Median ready → filed today: 22 min (practice)'.
    // Negative control: a computed median moves when the state it summarises moves — after arriving and seating a-1042, filing the note on
    // enc-9002 (a ready → filed event today) and moving the clock to 11:15 the line differs from the seed reading; then `unchanged` is false
    // and the check reports false. The note must actually have filed (filedNotes grows) or the mutation is not counted.
    async 'A-screens-board-1-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const line = () => p.evaluate(() => ((document.querySelector('.practice-line') || {}).textContent || '').trim() || null);
        const sub = () => p.evaluate(() => ((document.querySelector('.page-head .sub') || {}).textContent || '').trim());
        const seed = { line: await line(), sub: await sub() };
        await click(p, 'board.card.a-1042.arrive'); await click(p, 'board.card.a-1042.seat'); await p.waitForTimeout(150);
        const afterSeat = { line: await line() };
        await hop(p, '#/dentist/encounter/enc-9002'); await p.waitForTimeout(200);
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(150);
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const filed = await p.evaluate(() => { const S = window.__proto.state(); return { filedNotes: S.filedNotes.filter((n) => n.encounterId === 'enc-9002').map((n) => n.id + '@' + n.filedAt), a1043status: S.appointments.find((a) => a.id === 'a-1043').status }; });
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(200);
        const afterFile = { line: await line(), sub: await sub() };
        await p.evaluate(() => { Proto.store.get().clock.time = '11:15'; });
        await hop(p, '#/frontdesk/chairs'); await hop(p, '#/frontdesk/board'); await p.waitForTimeout(200);
        const afterClock = { line: await line(), sub: await sub() };
        const readings = [seed.line, afterSeat.line, afterFile.line, afterClock.line];
        const unchanged = readings.every((x) => x === seed.line);
        const isLiteral = !!seed.line && /22 min/.test(seed.line);
        const reproduced = isLiteral && filed.filedNotes.length > 0 && unchanged && /11:15/.test(afterClock.sub);
        rec('A-screens-board-1-8', 'The Board line "Median ready → filed today: 22 min (practice)" is unchanged after arriving and seating a-1042, filing the enc-9002 note today and moving the clock to 11:15 am, while the sub line beside it moves', 'A7 — a number on screen is computed from state and moves with it, never a literal; board.js:263',
          reproduced, { seedLine: seed.line, seedSub: seed.sub, readings, unchanged, noteFiled: filed, a1043StatusAfterFile: filed.a1043status, subAfterClock: afterClock.sub, subMoved: seed.sub !== afterClock.sub });
      } finally { await c.close(); }
    },

    // RC-75 · B10 · board.js:73 doSeat calls after(..., 'board.chair.' + a.op), moving focus to the chair strip.
    // Negative control: focus after Seat rests on a control inside board.card.a-1042 (its Details/Rail button or a Checkout) or on the status
    // line; then `focus.testid` does not start with `board.chair.` and the check reports false. The Seat must have written (status seated)
    // before the focus reading is scored. Recorded in docs/14 "Open after round 2" (known_in_docs14 true).
    async 'A-screens-board-1-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(150);
        const focusAfterArrive = await active(p);
        const seq0 = await lastSeq(p);
        const pressed = await press(p, 'board.card.a-1042.seat'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const focus = await active(p);
        const s = await p.evaluate(() => { const a = window.__proto.state().appointments.find((x) => x.id === 'a-1042'); return { status: a.status, op: a.op }; });
        const geometry = await p.evaluate((tid) => { const f = document.activeElement; const card = document.querySelector('[data-testid="board.card.a-1042"]'); const fb = f && f.getBoundingClientRect ? f.getBoundingClientRect() : null; const cb = card ? card.getBoundingClientRect() : null; return { focusedTop: fb ? Math.round(fb.top) : null, cardTop: cb ? Math.round(cb.top) : null, focusedInsideCard: !!(card && f && card.contains(f)), cardControls: card ? [...card.querySelectorAll('button')].map((b) => b.getAttribute('data-testid')) : null }; }, 'x');
        const reproduced = pressed && s.status === 'seated' && !!focus.testid && focus.testid === 'board.chair.' + s.op && !geometry.focusedInsideCard;
        rec('A-screens-board-1-9', 'After Seat on a-1042 focus lands on board.chair.1 in the chair strip at the top of the page, not on the card the coordinator was working', 'B10 — after a mutation focus lands on the next action or the state line; board.js:73 focuses board.chair.<op>',
          reproduced, { focusAfterArrive, seatPressed: pressed, statusAfterSeat: s.status, chair: s.op, focusAfterSeat: focus, geometry, focusEventsInRange: ev.filter((e) => e.kind === 'focus').map((e) => e.seq + ':' + e.testid), announcement: await live(p), seqRange: range(ev, seq0), known_in_docs14: true });
      } finally { await c.close(); }
    },

    // RC-76 · C3 · board.js:157 renders 'Lab case ' + a.labCase.id (seed id lab-op3) in the card details.
    // Negative control: the details line names the vendor and status without the raw id (no /\blab-op3\b/ match); then the check reports false.
    // The lab appointment is found from state (the seed generates it at loc-1, Op 3, 11:00); the dedup step names a-1050, which has no lab
    // case, so that id is recorded but not relied on.
    async 'A-screens-board-1-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const lab = await p.evaluate(() => { const S = window.__proto.state(); const a = S.appointments.find((x) => x.locationId === 'loc-1' && x.labCase); const a1050 = S.appointments.find((x) => x.id === 'a-1050'); return a ? { id: a.id, op: a.op, time: a.time, labCase: a.labCase, a1050HasLabCase: !!(a1050 && a1050.labCase) } : null; });
        if (!lab) { rec('A-screens-board-1-10', 'The expanded card for the lab-case appointment prints the raw seed id "lab-op3"', 'C3 — no raw ids on screen unless the spec shows them; board.js:157', false, { labAppointment: null }); return; }
        const pressed = await click(p, 'board.card.' + lab.id + '.expand'); await p.waitForTimeout(120);
        const details = await p.evaluate((id) => { const d = document.getElementById('board-details-' + id); return d ? d.textContent.replace(/\s+/g, ' ').trim() : null; }, lab.id);
        const labLine = details ? (details.match(/Lab case[^·]*(?:·[^·]*){0,2}/) || [null])[0] : null;
        const rawIdOnScreen = !!details && /\blab-op3\b/.test(details);
        const readinessLine = await p.evaluate(() => { const r = [...document.querySelectorAll('.rdrow')].find((x) => /Lab case/.test(x.textContent)); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
        rec('A-screens-board-1-10', 'Expanding the lab-case card prints "Lab case lab-op3 · Ridge Dental Lab · not back" — the raw seed id on screen', 'C3 — no product-internal nouns or raw ids on screen unless the spec shows them; board.js:157',
          pressed && rawIdOnScreen, { labAppointment: lab, expandPressed: pressed, detailsText: details, labLine, rawIdOnScreen, readinessRowText: readinessLine, dedupStepNamedA1050WithLabCase: lab.a1050HasLabCase });
      } finally { await c.close(); }
    },
  };
};
