// Swarm hunt, lens events-contracts (verified): cross-cutting CONTRACTS.md drift and event-log honesty (§4 test ids, §5 event log, §6 refusals).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null);
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const writeEvents = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const ids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')));
  const settle = async (p) => { await p.evaluate(() => { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }); await p.waitForTimeout(150); };
  // Runs one store verb inside the page and returns the tables whose JSON changed plus the write events it emitted (A3: one write per changed table).
  const callVerb = (p, verb, args) => p.evaluate(({ verb, args }) => {
    const snap = () => { const S = window.__proto.state(); const out = {}; for (const k of Object.keys(S)) out[k] = JSON.stringify(S[k]); return out; };
    const before = snap(); const seq0 = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
    let result; try { result = Proto.store[verb](...args); } catch (e) { result = { threw: e.message }; }
    const afterS = snap();
    const changed = Object.keys(afterS).filter((k) => afterS[k] !== before[k]);
    const ev = window.__events.filter((e) => e.seq > seq0);
    const writes = ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
    const refusals = ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code }));
    return { result: result && result.ok !== undefined ? { ok: result.ok, code: result.code || null } : result, changed, writes, refusals, seqRange: ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null, kinds: [...new Set(ev.map((e) => e.kind))] };
  }, { verb, args });
  // CONTRACTS §4 table, parsed at run time (placeholders may carry capitals: <apptId>, <reqId>, <lineId>, <userId>, <locId>, <entryId>, <planId>).
  const s4Patterns = () => {
    const text = fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8');
    const sec = text.slice(text.indexOf('## 4.'), text.indexOf('## 5.'));
    const rows = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*Screen\s*\|/.test(l) && !/^\|---/.test(l));
    const entries = rows.flatMap((l) => [...l.matchAll(/`([A-Za-z0-9.<>|_\-]+)`/g)].map((m) => m[1])).filter((s) => s.includes('.'));
    const toRe = (pat) => {
      let re = ''; let i = 0;
      while (i < pat.length) {
        if (pat[i] === '<') { const j = pat.indexOf('>', i); const inner = pat.slice(i + 1, j); i = j + 1;
          if (/^\d+-\d+$/.test(inner)) re += '\\d+'; else if (inner.includes('|')) re += '(' + inner.split('|').join('|') + ')'; else re += '[a-zA-Z0-9_-]+';
        } else { re += pat[i] === '.' ? '\\.' : pat[i]; i++; }
      }
      return new RegExp('^' + re + '$');
    };
    return { entries, patterns: entries.map(toRe) };
  };
  const a1042 = (p) => p.evaluate(() => { const S = window.__proto.state(); const a = S.appointments.find((x) => x.id === 'a-1042'); return { status: a.status, arrivedAt: a.arrivedAt || null, appointmentEvents: S.appointmentEvents.filter((e) => e.appointmentId === 'a-1042').map((e) => ({ id: e.id, kind: e.kind })) }; });

  return {
    // §5 / A3 · ui.js refusal(): the "log once" guard is one global `lastGate` key. roles.js renders one refusal per SoD conflict, so with two
    // conflicts on the preview every rerender alternates the key and logs BOTH gates again (a refusal event per gate per rerender) though no new
    // refusal was returned — the SoD decision buttons (compensate/accept) only rerender the same two gates.
    // Negative control: a guard keyed per gate (or per render) logs each of the two conflicts once and the three decision presses add zero
    // refusal events; then `relogged` is 0 and the check reports false. Both gates must still be in the DOM after the presses (they are not new),
    // and the two conflicts must each have been logged once when they were raised (the gates are real, the guard's first pass worked).
    async 'S-events-contracts-1'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/roles');
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await p.fill('[data-testid="roles.daypass.name"]', 'Tom Ford'); await settle(p);
        const seq0 = await lastSeq(p);
        await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(150);
        await click(p, 'roles.daypass.entitlement.prepare_deposit'); await p.waitForTimeout(150);
        const gateEvents = refusalEvents(await after(p, seq0)).filter((e) => e.code === 'sod_conflict');
        const gatesDom = () => p.evaluate(() => [...document.querySelectorAll('#canvas .refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('.verb') || {}).textContent || '').trim() })));
        const domBefore = await gatesDom();
        const seq1 = await lastSeq(p);
        const presses = [];
        for (const tid of ['roles.sod.compensate', 'roles.sod.accept', 'roles.sod.compensate']) { presses.push(await click(p, tid)); await p.waitForTimeout(150); }
        const ev = await after(p, seq1);
        const relog = refusalEvents(ev);
        const domAfter = await gatesDom();
        const sameGates = JSON.stringify(domBefore.map((g) => g.code + '|' + g.verb).sort()) === JSON.stringify(domAfter.map((g) => g.code + '|' + g.verb).sort());
        const relogged = relog.filter((e) => e.code === 'sod_conflict').length;
        const reproduced = presses.every(Boolean) && domBefore.filter((g) => g.code === 'sod_conflict').length === 2 && gateEvents.length === 2 && sameGates && relogged > 0;
        rec('S-events-contracts-1', 'With two SoD conflicts on the day-pass preview, every SoD decision press (compensate/accept) re-logs both sod_conflict refusal events (2 gates → 6 new refusal events over 3 presses) though the same two gates merely rerendered', 'CONTRACTS §5 / A3 — each refusal returned to a screen is logged once; ui.js refusal() lastGate is a single global key, roles.js renders one refusal per conflict',
          reproduced, { gatesBeforePresses: domBefore, gatesAfterPresses: domAfter, gatesUnchanged: sameGates, refusalEventsWhileAddingConflicts: gateEvents, decisionPresses: presses, refusalEventsAfterPresses: relog, relogged, expectedNewRefusals: 0, seqRangeOfPresses: range(ev), writesDuringPresses: writeEvents(ev), pageErrors: errs });
      } finally { await c.close(); }
    },

    // §5 / A3 · store.js savePerio (S.notes[encId].perioSummary / srpEvidence), chartPaint (S.notes[encId].procedures / procedure) and chartUndo
    // rewrite the `notes` table but emit no `write` event for it; `notes` is a store table (reset() creates it, chairs.js hasNote(), encounter.js
    // and perio.js read it, fileNote copies it into the filed markdown) — chartUndo's own comment claims "one event per table it touched (A3, A5)".
    // Negative control: each verb emits a write event with table 'notes' (id = encId) when it changes S.notes; then `missing` is empty and the
    // check reports false. A verb that changes no notes entry is not this claim (the diff must show `notes` changed), and every verb must have
    // returned ok (a refused call changes nothing and proves nothing). Any one verb still missing its event keeps the check true.
    async 'S-events-contracts-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        await p.evaluate(() => window.__proto.reset());
        const perio = await callVerb(p, 'savePerio', ['enc-9001', { 't3-s1': { depth: 6, bleed: true }, 't14-s2': { depth: 5, bleed: false } }, {}]);
        await hop(p, '#/dentist/encounter/enc-9002');
        const paint = await callVerb(p, 'chartPaint', ['enc-9002', 30, ['o'], 'd2392', 'today']);
        const undo = await callVerb(p, 'chartUndo', ['enc-9002']);
        const notesAfter = await p.evaluate(() => window.__proto.state().notes);
        const runs = [['savePerio', perio], ['chartPaint', paint], ['chartUndo', undo]];
        const gap = (r) => r.changed.includes('notes') && !r.writes.some((w) => w.table === 'notes');
        const missing = runs.filter(([, r]) => gap(r)).map(([v]) => v);
        const allOk = runs.every(([, r]) => r.result && r.result.ok === true);
        const reproduced = allOk && missing.length > 0;
        rec('S-events-contracts-2', 'savePerio, chartPaint and chartUndo change the notes table (notes[encId].perioSummary / .procedures) with no write event for notes — the event log shows perioExams / chartEvents / procedures / planItems only', 'CONTRACTS §5 / A3 — a mutation writes one write event per table it changes; store.js savePerio, chartPaint, chartUndo',
          reproduced, { savePerio: perio, chartPaint: paint, chartUndo: undo, verbsChangingNotesWithoutWrite: missing, allVerbsOk: allOk, notesAfter, seqRange: perio.seqRange && undo.seqRange ? [perio.seqRange[0], (undo.seqRange || paint.seqRange)[1]] : perio.seqRange, pageErrors: errs });
      } finally { await c.close(); }
    },

    // §4 (both directions) / B1 · rail.js ledger view renders ledger.asof.date, ledger.asof.statement.<id>, ledger.asof.back and
    // ledger.explain.rows.<entryId>; none has a §4 entry. The existing A-screens-rail-1-4 measures these same `unlisted` ids but only reports
    // when a rail.sum.* id is ALSO unlisted, so since §4 gained a Rail summary row it reads "no" while still collecting them.
    // Negative control: when §4 lists these ids (or the code renders ids that match §4) `ledgerUnlisted` is empty and the check reports false;
    // any one ledger id still unlisted keeps it true. The §4 table must have parsed (entries > 100) so a broken parser cannot fake a breach.
    async 'S-events-contracts-3'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const seen = new Map();
        const collect = async (label) => { for (const id of await ids(p)) if (!seen.has(id)) seen.set(id, label); };
        await go(p, '#/biller/ledger/p-316'); await collect('#/biller/ledger/p-316');
        await click(p, 'ledger.explain'); await collect('after ledger.explain');
        await click(p, 'ledger.asof'); await p.waitForTimeout(150); await collect('after ledger.asof');
        const st = (await ids(p)).find((i) => /^ledger\.asof\.statement\./.test(i));
        if (st) { await click(p, st); await p.waitForTimeout(150); await collect('after ' + st); }
        const { entries, patterns } = s4Patterns();
        const all = [...seen.keys()].sort();
        const unlisted = all.filter((id) => !patterns.some((re) => re.test(id))).map((id) => ({ id, firstSeenIn: seen.get(id) }));
        const ledgerUnlisted = unlisted.filter((u) => /^ledger\./.test(u.id));
        const reproduced = entries.length > 100 && ledgerUnlisted.length > 0;
        rec('S-events-contracts-3', 'Rendered ids ledger.asof.date, ledger.asof.statement.<id>, ledger.asof.back and ledger.explain.rows.<entryId> match no CONTRACTS §4 entry; A-screens-rail-1-4 collects them but cannot flip on them alone (it also requires an unlisted rail.sum.*)', 'CONTRACTS §4 / B1 — an id with no §4 entry is a defect; rail.js ledger view (asOfBlock, Explain rows)',
          reproduced, { s4EntryCount: entries.length, idsRendered: all.length, unlisted, ledgerUnlisted, pageErrors: errs });
      } finally { await c.close(); }
    },

    // §5 / A3, A4 · store.js arrive() and seat() have no idempotency guard: a second call on the same appointment touches `appointments` (a write
    // event for a row whose JSON did not change) and appends a duplicate appointment.arrived / appointment.seated audit row. The Board hides the
    // control after the first press and doArrive/doSeat re-check status, so the repeat is reachable through Proto.store.* only.
    // Negative control: a repeat call returns a refusal (or ok with no writes), the appointments write event is absent when the row is unchanged,
    // and appointmentEvents holds one arrived and one seated row for a-1042; then neither verb repeats and the check reports false. Either verb
    // still repeating keeps it true (each is scored on its own in the evidence).
    async 'S-events-contracts-4'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await p.evaluate(() => window.__proto.reset());
        const arrive1 = await callVerb(p, 'arrive', ['a-1042']);
        const arrive2 = await callVerb(p, 'arrive', ['a-1042']);
        const seat1 = await callVerb(p, 'seat', ['a-1042']);
        const seat2 = await callVerb(p, 'seat', ['a-1042']);
        const rows = await a1042(p);
        const dupArrived = rows.appointmentEvents.filter((e) => e.kind === 'appointment.arrived').length;
        const dupSeated = rows.appointmentEvents.filter((e) => e.kind === 'appointment.seated').length;
        const unchangedTouch = (r) => !r.changed.includes('appointments') && r.writes.some((w) => w.table === 'appointments' && w.id === 'a-1042');
        const arriveRepeats = arrive1.result && arrive1.result.ok === true && arrive2.result && arrive2.result.ok === true && unchangedTouch(arrive2) && dupArrived >= 2;
        const seatRepeats = seat1.result && seat1.result.ok === true && seat2.result && seat2.result.ok === true && unchangedTouch(seat2) && dupSeated >= 2;
        const reproduced = !!(arriveRepeats || seatRepeats);
        rec('S-events-contracts-4', 'Repeating arrive(a-1042) and seat(a-1042) returns ok, emits a write event for appointments/a-1042 although the row did not change, and appends a second appointment.arrived / appointment.seated audit row', 'CONTRACTS §5 / A3, A4 — repeating the same verb does not double-write; a write event names a table that changed; store.js arrive, seat',
          reproduced, { arrive1, arrive2, seat1, seat2, arriveRepeats, seatRepeats, appointmentAfter: { status: rows.status, arrivedAt: rows.arrivedAt }, appointmentEventsForA1042: rows.appointmentEvents, dupArrived, dupSeated, seqRange: arrive1.seqRange && seat2.seqRange ? [arrive1.seqRange[0], seat2.seqRange[1]] : null, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A2 / A4 (verifier's adjacent finding) · store.js arrive() checks nothing about the current status: board.js only offers Arrive while the
    // status is scheduled|confirmed (ARRIVABLE) and doArrive re-checks it, but the store verb accepts a seated appointment, moves it BACK to
    // 'arrived' and appends a third appointment.arrived row, so the chair strip loses a patient who is in the chair. Reachable only through
    // Proto.store.* (no Board control), hence low. Negative control: arrive() on a non-ARRIVABLE status returns a refusal (or ok with no writes)
    // and the status stays 'seated'; then `regressed` is false and the check reports false. The seat must have succeeded first.
    async 'S-events-contracts-v1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await p.evaluate(() => window.__proto.reset());
        const arrive1 = await callVerb(p, 'arrive', ['a-1042']);
        const seat1 = await callVerb(p, 'seat', ['a-1042']);
        const seated = await a1042(p);
        const arriveAfterSeat = await callVerb(p, 'arrive', ['a-1042']);
        const rows = await a1042(p);
        const regressed = seated.status === 'seated' && rows.status === 'arrived';
        const reproduced = arrive1.result && arrive1.result.ok === true && seat1.result && seat1.result.ok === true && arriveAfterSeat.result && arriveAfterSeat.result.ok === true && regressed && arriveAfterSeat.changed.includes('appointments');
        rec('S-events-contracts-v1', 'arrive(a-1042) on an appointment already seated returns ok, moves its status from seated back to arrived and appends another appointment.arrived row — the Board’s ARRIVABLE (scheduled|confirmed) precondition lives only in board.js, not in the store verb', 'A2 / A4 — the verb does what its control promises and a repeat is refused or a no-op; board.js ARRIVABLE guard vs store.js arrive() with no status check',
          reproduced, { arrive1, seat1, statusAfterSeat: seated.status, arriveAfterSeat, statusAfterArriveAgain: rows.status, regressed, appointmentEventsForA1042: rows.appointmentEvents, seqRange: arrive1.seqRange && arriveAfterSeat.seqRange ? [arrive1.seqRange[0], arriveAfterSeat.seqRange[1]] : null, pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
