// Swarm 2 hunt, lens "identity-pin-passes": who the actor is on a shared desk with day-pass PINs — the temp seat,
// the author switch, the approval second signature, and the drafts and controls that key on a user id.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : [seq, seq]);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusalEv = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => e.code + ':' + (e.verb || ''));
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: (r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || null,
    controlLabels: [...r.querySelectorAll('button')].map((b) => b.textContent.trim()),
  })));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const value = (p, tid) => p.$eval(`[data-testid="${tid}"]`, (e) => e.value).catch(() => null);
  const attr = (p, tid, a) => p.$eval(`[data-testid="${tid}"]`, (e, a) => e.getAttribute(a), a).catch(() => null);
  const who = (p) => p.evaluate(() => { const u = Proto.store.currentUser(); return { id: u.id, name: u.name, entitlements: (u.entitlements || []).slice(), noPass: !!u.noPass }; });
  const chip = async (p) => ({ text: await txt(p, 'topbar.author'), label: await attr(p, 'topbar.author', 'aria-label') });
  const tempSeat = (p) => p.evaluate(() => { const t = Proto.store.get().tempUser; return t ? { id: t.id, name: t.name, dayPass: t.dayPass } : null; });
  const sessions = (p) => p.evaluate(() => window.__proto.state().sessions.map((s) => s.id + ':' + s.userId + ':' + s.actor + ':' + (s.endedAt ? 'ended' : 'open')));
  const issuePass = (p, name, role = 'frontdesk', extra = []) => p.evaluate(([name, role, extra]) => {
    const r = Proto.store.addDayPass({ name, role, location: 'loc-1', end: '17:30', extra }, null);
    return { ok: !!r.ok, code: r.code || null, pin: r.pin || null, id: r.dayPass ? r.dayPass.id : null, entitlements: r.dayPass ? r.dayPass.entitlements.slice() : null };
  }, [name, role, extra]);
  // The shared-desk pad: open it from the author chip, key the digits, submit.
  const pad = async (p, digits) => { await click(p, 'topbar.author'); for (const d of digits) await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(200); };
  const ledgerRows = (p, pid, kind) => p.evaluate(([pid, kind]) => window.__proto.state().ledger.filter((e) => e.patientId === pid && (!kind || e.kind === kind)).map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, actor: e.actor, secondApprover: e.secondApprover || null, approvalRequestId: e.approvalRequestId || null })), [pid, kind]);

  return {
    // RC-S2-identity-1 · A2/B3 · store.js passUser() gives every day-pass holder `id: 'u-temp'`, and checkout.js keys its
    // draft on currentUser().id + '|' + aid. Alex (dp-1, PIN 8001) types $20.00 card and his PIN into Checkout; the pad
    // switches the author to Casey (dp-2, 8002) — sessions and the chip now say Casey — yet Casey's Checkout still holds
    // Alex's $20.00 and Alex's PIN 8001, and Post freezes "Alex Rivera" on the payment and the collection decision.
    // Two causes, both needed (verified by patching each alone — still YES — and both — no): (1) the shared key, and (2) shell.js's
    // pad submit assigns location.hash a value equal to the current hash for a temp→temp switch (same persona, same route), so no
    // hashchange fires and the canvas is never repainted — the old author's inputs and Post closure stay on screen. Existing
    // S-checkout-screen-7 / S-controls-5 cover permanent-user switches (distinct ids, persona hash change), not two passes.
    // Negative control: keying the draft per pass AND repainting the canvas on a same-hash switch (Proto.router.render(), as
    // router.go does) makes Casey's Checkout open fresh (pin '', amount 44.00) and nothing posts under Alex → 'no'.
    async 'S2-identity-pin-passes-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/roles?device=shared');
        const alex = await issuePass(p, 'Alex Rivera'); const casey = await issuePass(p, 'Casey Morgan');
        await hop(p, '#/temp/board'); await pad(p, alex.pin || '8001');
        const seatAlex = await who(p); const chipAlex = await chip(p);
        await hop(p, '#/temp/checkout/a-1044');
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242');
        await fill(p, 'checkout.amount', '20.00'); await fill(p, 'checkout.pin', alex.pin || '8001');
        const draftAlex = { pin: await value(p, 'checkout.pin'), amount: await value(p, 'checkout.amount') };
        await pad(p, casey.pin || '8002');
        const seatCasey = await who(p); const chipCasey = await chip(p); const hash = await p.evaluate(() => location.hash);
        const draftSeenByCasey = { pin: await value(p, 'checkout.pin'), amount: await value(p, 'checkout.amount') };
        const seq0 = await lastSeq(p); const before = await ledgerRows(p, 'p-303', 'patient_payment');
        await click(p, 'checkout.post'); await p.waitForTimeout(300);
        const ev = await after(p, seq0);
        const payments = await ledgerRows(p, 'p-303', 'patient_payment');
        const decisions = await p.evaluate(() => window.__proto.state().collectionDecisions.filter((d) => d.encounterId === 'enc-9003').map((d) => ({ id: d.id, decidedBy: d.decidedBy, amountCents: d.amountCents })));
        const ses = await sessions(p); const seatAfterPost = await who(p); const chipAfterPost = await chip(p);
        const gate = await refusalsDom(p);
        const paymentActor = payments.length === 1 ? payments[0].actor : null;
        const caseyIsAuthor = seatCasey.name === 'Casey Morgan' && chipCasey.text === 'CM' && ses.some((s) => /Casey Morgan:open$/.test(s));
        const draftLeaked = draftSeenByCasey.pin === (alex.pin || '8001') && draftSeenByCasey.amount === '20.00';
        const postedUnderAlex = before.length === 0 && paymentActor === 'Alex Rivera' && decisions.some((d) => d.decidedBy === 'Alex Rivera') && gate.length === 0;
        const reproduced = alex.ok && casey.ok && seatAlex.name === 'Alex Rivera' && hash === '#/temp/checkout/a-1044' && caseyIsAuthor && (draftLeaked || postedUnderAlex);
        rec('S2-identity-pin-passes-1', 'Two day-pass holders share one principal u-temp, so on the shared desk Casey Morgan\'s Checkout opens on Alex Rivera\'s draft — his $20.00 and his PIN 8001 still in the fields — and Post, with Casey on the chip and on the open session, freezes "Alex Rivera" on the payment and the collection decision', 'A2 (actor is the PIN\'s owner), B3 (draft keyed per author) — store.js passUser `id: \'u-temp\'`, checkout.js `Proto.store.currentUser().id + \'|\' + aid`; docs/13 §30 wrong-author on a shared device',
          reproduced, { passes: { alex, casey }, seatAlex, chipAlex, draftAlex, seatCasey, chipCasey, hash, draftSeenByCasey, draftLeaked, postedUnderAlex, paymentsBefore: before, paymentsAfter: payments, paymentActor, decisions, sessionsAfter: ses, seatAfterPost, chipAfterPost, refusals: gate, writes: writes(ev), refusalEvents: refusalEv(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-S2-identity-2 · A2 · store.js verifyPin() sets S.tempUser = passUser(pass) the moment a day-pass PIN matches — before
    // openSession() checks the outage, and before requestWriteoff()'s entitlement gate. Two refused actions therefore move the
    // temp seat: (a) the pad switch Alex→Casey during an outage is refused ("sessions cannot open", no session row, one
    // refusal event) yet currentUser() is now Casey while the chip still reads AR; (b) a write-off with Casey's PIN is refused
    // on entitlement with no write and no event, yet the seat is Casey. Every later record under this persona carries Casey's name.
    // Negative control: a verify that only reads (seat moved by openSession/the succeeding verb) leaves currentUser() Alex after
    // both refusals — seatAfterOutageSwitch.name === 'Alex Rivera' and seatAfterRefusedWriteoff.name === 'Alex Rivera'.
    async 'S2-identity-pin-passes-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/roles?device=shared');
        const alex = await issuePass(p, 'Alex Rivera'); const casey = await issuePass(p, 'Casey Morgan');
        await hop(p, '#/temp/board'); await pad(p, alex.pin || '8001');
        const seat0 = await who(p); const chip0 = await chip(p); const sessions0 = await sessions(p);
        // (a) outage: the pad's verify succeeds, openSession refuses
        await p.evaluate(() => window.__proto.set({ outage: true }));
        const seqA = await lastSeq(p);
        await pad(p, casey.pin || '8002');
        const evA = await after(p, seqA);
        const refusalsA = await refusalsDom(p);
        const seatAfterOutageSwitch = await who(p); const chipAfterOutageSwitch = await chip(p); const sessionsA = await sessions(p);
        await click(p, 'pin.cancel'); await p.evaluate(() => window.__proto.set({ outage: false }));
        // restore Alex through a switch that is allowed to succeed
        await pad(p, alex.pin || '8001');
        const seatRestored = await who(p); const sessionsRestored = await sessions(p);
        // (b) a refused posting verb carrying Casey's PIN: the front-desk pass has no write_off
        const seqB = await lastSeq(p); const ledgerBefore = await p.evaluate(() => window.__proto.state().ledger.length);
        const resB = await p.evaluate((pin) => { const r = Proto.store.requestWriteoff('p-306', 100, 'courtesy', { pin }); return { ok: !!r.ok, code: r.code || null, verb: r.verb || null }; }, casey.pin || '8002');
        const evB = await after(p, seqB); const ledgerAfter = await p.evaluate(() => window.__proto.state().ledger.length);
        const seatAfterRefusedWriteoff = await who(p); const chipAfterRefusedWriteoff = await chip(p); const sessionsB = await sessions(p);
        const outageRefused = refusalsA.some((r) => r.code === 'outage') && refusalEv(evA).some((x) => x.startsWith('outage:')) && writes(evA).length === 0 && sessionsA.length === sessions0.length;
        const reproduced = alex.ok && casey.ok && seat0.name === 'Alex Rivera' && chip0.text === 'AR'
          && outageRefused && seatAfterOutageSwitch.name === 'Casey Morgan' && chipAfterOutageSwitch.text === 'AR'
          && seatRestored.name === 'Alex Rivera' && !resB.ok && resB.code === 'entitlement' && evB.length === 0 && ledgerAfter === ledgerBefore && sessionsB.length === sessionsRestored.length
          && seatAfterRefusedWriteoff.name === 'Casey Morgan' && chipAfterRefusedWriteoff.text === 'AR';
        rec('S2-identity-pin-passes-2', 'A day-pass PIN moves the temp seat even when the verb it was typed for is refused: the pad switch to Casey during an outage is refused with no session row, and a write-off with Casey\'s PIN is refused on entitlement with no write and no event, yet after each currentUser() is Casey Morgan while the author chip still shows AR', 'A2 (the actor is the one the session names), B1 (a refused verb writes nothing — here it rewrites the actor) — store.js verifyPin `if (pass) S.tempUser = who` runs before openSession()\'s offline() and before requestWriteoff()\'s bills()/needs() gates',
          reproduced, { passes: { alex, casey }, seat0, chip0, sessions0, outage: { refusals: refusalsA, refusalEvents: refusalEv(evA), writes: writes(evA), seqRange: range(evA, seqA), sessionsAfter: sessionsA, seatAfterOutageSwitch, chipAfterOutageSwitch }, seatRestored, sessionsRestored, refusedWriteoff: { result: resB, events: evB.length, ledgerBefore, ledgerAfter, sessionsAfter: sessionsB, seatAfterRefusedWriteoff, chipAfterRefusedWriteoff }, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-S2-identity-3 · B3 (dual release: a distinct SECOND APPROVER) · store.js decideApproval() resolves `approver = user(approverId)
    // || currentUser()` and checks same-person and the approver's own PIN, but never that the approver carries approve_second or is
    // on the request's eligible list. Bree Lawson (hygienist, entitlements []) approves Sam's held $410 write-off with her own PIN
    // 1111 and the -$410 posts with secondApprover "Bree Lawson"; a front-desk temp with a pass (no approve_second) does the same
    // with PIN 8002. S-controls-4 and S-moneydesk-close-9 pass `stepup: true` and are answered by the needsStepup challenge, so
    // they read "no" without ever reaching the entitlement gate — they stopped measuring.
    // Negative control: an approve_second / eligible gate refuses Bree and the temp (an 'entitlement' code, status stays pending,
    // no ledger write) — breeApproved and tempApproved both false.
    async 'S2-identity-pin-passes-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        const legs = {};
        // Leg A: the biller raises a held write-off; the hygienist seconds it with her own PIN.
        await go(p, '#/biller/money');
        const req = await p.evaluate(() => { const r = Proto.store.requestWriteoff('p-306', 41000, 'courtesy', {}); return { ok: !!r.ok, code: r.code || null, requestId: r.requestId || null, held: !!r.held }; });
        await hop(p, '#/hygienist/chairs');
        const bree = await who(p); const seqA = await lastSeq(p);
        const request = await p.evaluate((id) => { const a = window.__proto.state().approvals.find((x) => x.id === id); return a ? { id: a.id, status: a.status, requestedBy: a.requestedBy, requestedById: a.requestedById, amountCents: a.amountCents, eligible: a.eligible || null } : null; }, req.requestId);
        const dueBefore = await p.evaluate(() => Proto.store.balances('p-306').patientDue);
        const bare = await p.evaluate((id) => { const r = Proto.store.decideApproval(id, 'u-hy-1', 'approved', true); return { ok: !!r.ok, code: r.code || null, needsStepup: !!r.needsStepup }; }, req.requestId);
        const withPin = await p.evaluate((id) => { const r = Proto.store.decideApproval(id, 'u-hy-1', 'approved', { pin: '1111' }); return { ok: !!r.ok, code: r.code || null, postedCents: r.postedCents || null }; }, req.requestId);
        const evA = await after(p, seqA);
        const afterA = await p.evaluate((id) => { const S = window.__proto.state(); const a = S.approvals.find((x) => x.id === id); return { status: a.status, decidedBy: a.decidedBy || null, log: S.approvalsLog.filter((l) => l.requestId === id).map((l) => l.decision + ':' + l.by) }; }, req.requestId);
        const writeoffsA = await ledgerRows(p, 'p-306', 'write_off');
        const dueAfter = await p.evaluate(() => Proto.store.balances('p-306').patientDue);
        legs.bree = { request, approver: bree, dueBefore, bare, withPin, after: afterA, writeoffs: writeoffsA, dueAfter, writes: writes(evA), seqRange: range(evA, seqA) };
        const breeApproved = req.held && request && request.status === 'pending' && !bree.entitlements.includes('approve_second') && bare.needsStepup && withPin.ok && afterA.status === 'approved' && afterA.decidedBy === 'Bree Lawson'
          && writeoffsA.some((e) => e.approvalRequestId === req.requestId && e.amountCents === -41000 && e.secondApprover === 'Bree Lawson') && dueAfter === 0;
        // Leg B: fresh store; the same request seconded by a front-desk temp holding a pass with no approve_second.
        await p.evaluate(() => window.__proto.reset()); await hop(p, '#/biller/money');
        const req2 = await p.evaluate(() => { const r = Proto.store.requestWriteoff('p-306', 41000, 'courtesy', {}); return { ok: !!r.ok, code: r.code || null, requestId: r.requestId || null, held: !!r.held }; });
        await hop(p, '#/owner/roles'); const temp = await issuePass(p, 'Casey Morgan');
        await hop(p, '#/temp/board'); const seat = await who(p); const seqB = await lastSeq(p);
        const tempRes = await p.evaluate(([id, pin]) => { const r = Proto.store.decideApproval(id, 'u-temp', 'approved', { pin }); return { ok: !!r.ok, code: r.code || null, postedCents: r.postedCents || null }; }, [req2.requestId, temp.pin || '8002']);
        const evB = await after(p, seqB);
        const afterB = await p.evaluate((id) => { const a = window.__proto.state().approvals.find((x) => x.id === id); return { status: a.status, decidedBy: a.decidedBy || null }; }, req2.requestId);
        const writeoffsB = await ledgerRows(p, 'p-306', 'write_off');
        legs.temp = { request: req2, pass: temp, approver: seat, result: tempRes, after: afterB, writeoffs: writeoffsB, writes: writes(evB), seqRange: range(evB, seqB) };
        const tempApproved = req2.held && temp.ok && seat.name === 'Casey Morgan' && !seat.entitlements.includes('approve_second') && tempRes.ok && afterB.status === 'approved' && afterB.decidedBy === 'Casey Morgan'
          && writeoffsB.some((e) => e.approvalRequestId === req2.requestId && e.amountCents === -41000 && e.secondApprover === 'Casey Morgan');
        rec('S2-identity-pin-passes-3', 'decideApproval never checks that the approver may second: Bree Lawson (hygienist, no approve_second, not on the eligible list) approves the held $410 write-off with her own PIN 1111 and the -$410 posts with secondApprover "Bree Lawson"; a front-desk temp with a day pass does the same with PIN 8002. The existing checks S-controls-4 / S-moneydesk-close-9 pass a bare `true` step-up and are stopped by the PIN challenge, so they never reach this gate', 'B3 dual release needs a distinct, entitled second approver — store.js decideApproval `approver = user(approverId) || currentUser()` with no approve_second / eligible test; requestApproval\'s eligible list names Dana or Dr. Reagan; docs/05 dual release',
          breeApproved && tempApproved, { legs, breeApproved, tempApproved, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-S2-identity-4 · B3 same-person, independence · because every pass holder is `u-temp`, the same-person rule cannot tell two
    // temps apart. Alex Rivera (pass with write_off, PIN 8001) raises a held $410 write-off; Casey Morgan (pass with approve_second,
    // PIN 8002, a different person on a different pass) is refused 'blocked_same_person' — "You requested it" — and
    // pendingApprovalsFor() hides the request from her, while the request row itself says requestedBy "Alex Rivera".
    // Negative control: a per-pass principal (or a same-person test on the pass/name) lets Casey see and decide Alex's request —
    // caseyResult.code !== 'blocked_same_person' and pendingForCasey includes the request.
    async 'S2-identity-pin-passes-4'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/roles');
        const alex = await issuePass(p, 'Alex Rivera', 'frontdesk', ['write_off']);
        await hop(p, '#/temp/board'); const alexSeat = await who(p);
        const req = await p.evaluate((pin) => { const r = Proto.store.requestWriteoff('p-306', 41000, 'courtesy', { pin }); return { ok: !!r.ok, code: r.code || null, requestId: r.requestId || null, held: !!r.held }; }, alex.pin || '8001');
        await hop(p, '#/owner/roles');
        const casey = await issuePass(p, 'Casey Morgan', 'frontdesk', ['approve_second']);
        await hop(p, '#/temp/board'); const caseySeat = await who(p);
        const request = await p.evaluate((id) => { const a = window.__proto.state().approvals.find((x) => x.id === id); return a ? { id: a.id, status: a.status, requestedBy: a.requestedBy, requestedById: a.requestedById, amountCents: a.amountCents } : null; }, req.requestId);
        const pendingForCasey = await p.evaluate(() => Proto.store.pendingApprovalsFor().map((x) => x.id));
        const seq0 = await lastSeq(p);
        const caseyResult = await p.evaluate(([id, pin]) => { const r = Proto.store.decideApproval(id, 'u-temp', 'approved', { pin }); return { ok: !!r.ok, code: r.code || null, verb: r.verb || null, why: r.why || null }; }, [req.requestId, casey.pin || '8002']);
        const ev = await after(p, seq0);
        const statusAfter = await p.evaluate((id) => window.__proto.state().approvals.find((x) => x.id === id).status, req.requestId);
        await hop(p, '#/temp/phone');
        const phoneHead = await p.evaluate(() => { const m = document.querySelector('main'); return m ? m.innerText.replace(/\s+/g, ' ').slice(0, 220) : null; });
        const reproduced = alex.ok && casey.ok && alex.id !== casey.id && alexSeat.name === 'Alex Rivera' && caseySeat.name === 'Casey Morgan'
          && req.held && request && request.requestedBy === 'Alex Rivera' && caseySeat.entitlements.includes('approve_second')
          && !pendingForCasey.includes(req.requestId) && caseyResult.code === 'blocked_same_person' && statusAfter === 'pending' && /Nothing waiting for you/.test(phoneHead || '');
        rec('S2-identity-pin-passes-4', 'The same-person control conflates two day-pass holders: Casey Morgan, an eligible second approver on her own pass, is refused Alex Rivera\'s held write-off with "You requested it" (blocked_same_person) and her Approvals screen says "Nothing waiting for you", because both passes resolve to the one principal u-temp', 'B3 independence is a property of two people, not of one seat id — store.js passUser `id: \'u-temp\'`; decideApproval `r.requestedById === approver.id`; pendingApprovalsFor `a.requestedById !== u.id`',
          reproduced, { passes: { alex, casey }, alexSeat, request, caseySeat, pendingForCasey, caseyResult, statusAfter, phoneHead, events: ev.length, seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
