// Swarm hunt, lens "controls": dual release, SoD/day passes, shared-desk PIN and author, entitlement gates, outage.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
// Verified (swarm/verified-controls): S-controls-1..9 reproduced independently and each flipped to "no" under a temporary
// patch of the described fix (PIN lookup + openSession; noPass guard on arrive/eraPostMatched/requestWriteoff; write_off
// entitlement; approver = currentUser + approve_second; user-keyed Checkout draft; offline() in buildAppeal; entitlement +
// already_decided in reviewDecision; deferred requestApproval on Money Desk; balance check in decideApproval).
// S-controls-v1 is the verifier's adjacent finding: Tighten/Retire throw `T is not defined` in dailyclose.js:207-208.

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
  const who = (p) => p.evaluate(() => { const u = Proto.store.currentUser(); return { id: u.id, name: u.name, entitlements: u.entitlements.slice(), noPass: !!u.noPass }; });
  const ledgerRows = (p, pid, kind) => p.evaluate(([pid, kind]) => window.__proto.state().ledger.filter((e) => e.patientId === pid && (!kind || e.kind === kind)).map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, actor: e.actor, secondApprover: e.secondApprover || null })), [pid, kind]);
  const stepUp = async (p, digits) => { for (const d of digits) await click(p, 'phone.stepup.' + d); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(150); };

  return {
    // RC-swarm-controls-1 · B3/A2 · store.js:132 postCheckout's shared-desk gate is `!form.pin` — a non-empty string satisfies it;
    // the digits are never matched to a user, no session is minted (store.js:341 openSession is not called) and the posting
    // freezes the persona's name, so Dana's PIN 4444 posts as Priya. The gate's own why-text promises the opposite.
    // Negative control: a PIN that is checked either refuses 'zz' / ' ' (pin_required or a wrong-PIN code, no ledger write)
    // or opens a session for the PIN's owner and freezes Dana's name on the payment; then anyLedgerWriteOnBadPin is false or
    // postedActorFor4444 is 'Dana Whitfield', and the check reports false.
    async 'S-controls-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        const runs = [];
        await go(p, '#/frontdesk/checkout/a-1044?device=shared');
        for (const pin of ['zz', ' ', '4444']) {
          // a fresh store for each PIN; the device flag from the query survives reset()
          await p.evaluate(() => window.__proto.reset()); await hop(p, '#/frontdesk/board'); await hop(p, '#/frontdesk/checkout/a-1044?device=shared');
          const device = await p.evaluate(() => window.__proto.device);
          const seq0 = await lastSeq(p);
          const before = await ledgerRows(p, 'p-303', 'patient_payment');
          await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242');
          await fill(p, 'checkout.pin', pin);
          const pressed = await click(p, 'checkout.post'); await p.waitForTimeout(200);
          const ev = await after(p, seq0);
          const payments = await ledgerRows(p, 'p-303', 'patient_payment');
          const sessions = await p.evaluate(() => window.__proto.state().sessions.map((s) => s.actor + ':' + (s.endedAt ? 'ended' : 'open')));
          const gate = await refusalsDom(p);
          runs.push({ pin: JSON.stringify(pin), device, pressed, paymentsBefore: before.length, paymentsAfter: payments.map((e) => e.id + ':' + e.amountCents + ':' + e.actor), newSessions: sessions, refusals: gate.map((g) => g.code), refusalEvents: refusalEv(ev), writes: writes(ev), seqRange: range(ev, seq0) });
        }
        const byPin = Object.fromEntries(runs.map((r) => [r.pin, r]));
        const bad = [byPin['"zz"'], byPin['" "']];
        const anyLedgerWriteOnBadPin = bad.every((r) => r && r.device === 'shared' && r.paymentsBefore === 0 && r.paymentsAfter.length === 1 && r.refusals.length === 0);
        const dana = byPin['"4444"'];
        const postedActorFor4444 = dana && dana.paymentsAfter.length === 1 ? dana.paymentsAfter[0].split(':')[2] : null;
        const reproduced = anyLedgerWriteOnBadPin && postedActorFor4444 === 'Priya Raman' && dana.newSessions.length === 0;
        rec('S-controls-1', 'On the shared desk Checkout posts a card payment for any non-empty PIN ("zz", a single space) and, given Dana\'s PIN 4444, freezes Priya Raman on the payment with no session opened — the PIN gate checks presence, not identity', 'B3, A2 — store.js:132 (`!form.pin`), whose why-text reads "the PIN mints your own session, so the posting carries your name and not the last person\'s"; docs/13 §30 wrong-author on a shared device',
          reproduced, { runs, anyLedgerWriteOnBadPin, postedActorFor4444, sessionsAfter4444: dana ? dana.newSessions : null, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-2 · B3/B9 · store.js:131 checks `u.noPass` only inside postCheckout; requestWriteoff (store.js:222),
    // eraPostMatched (:407) and arrive (:102) post under the NO_PASS ghost, so the temp persona with no day pass writes a
    // write-off, 37 insurance payments and an arrival, every row actor "No day pass issued". The ghost's arrive retires
    // firstRunState frs-u-temp-arrive, which the next real pass (same id u-temp) inherits as "Arrive ✓".
    // Negative control: when every posting verb refuses noPass (entitlement, "Issue a day pass before posting") the ghost's
    // ledger and appointmentEvents rows are absent, ghostRows is empty, and the check reports false.
    async 'S-controls-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/temp/money');
        const me = await who(p);
        const seq0 = await lastSeq(p);
        // one verb at a time, each with its own before/after
        const wo0 = await ledgerRows(p, 'p-306', 'write_off');
        const woPressed = await click(p, 'money.writeoff.p-306') && await click(p, 'money.writeoff.reason.courtesy') && await fill(p, 'money.writeoff.amount', '100') && await click(p, 'money.writeoff.post');
        await p.waitForTimeout(150);
        const wo1 = await ledgerRows(p, 'p-306', 'write_off');
        const woGate = await refusalsDom(p);
        const seq1 = await lastSeq(p);
        const ins0 = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.kind === 'insurance_payment' && e.actorKind === 'user').length);
        const eraPressed = await click(p, 'money.tab.era') && await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const ins1 = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.kind === 'insurance_payment' && e.actorKind === 'user').map((e) => e.actor));
        const eraGate = await refusalsDom(p);
        const seq2 = await lastSeq(p);
        await hop(p, '#/temp/board');
        const arrivePressed = await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(150);
        const arrivals = await p.evaluate(() => window.__proto.state().appointmentEvents.map((e) => e.kind + ':' + e.actor));
        const ghostRail = await p.evaluate(() => Proto.store.railStateFor());
        const ev = await after(p, seq0);
        // a real pass is now issued to a named temp; the rail must be hers, not the ghost's
        const nextTemp = await p.evaluate(() => { const r = Proto.store.addDayPass({ name: 'Jordan Lee', role: 'frontdesk', location: 'loc-1', end: '17:30' }); return { ok: r.ok, user: Proto.store.currentUser().name, rail: Proto.store.railStateFor() }; });
        await hop(p, '#/temp/board');
        const chips = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="rail1.chip."]')].map((b) => b.textContent.trim()));
        const ghostRows = [...wo1.filter((e) => e.actor === me.name).map((e) => 'ledger/' + e.id), ...(ins1.filter((a) => a === me.name).length ? ['ledger×' + ins1.filter((a) => a === me.name).length + ' insurance_payment'] : []), ...arrivals.filter((a) => a.endsWith(':' + me.name)).map((a) => 'appointmentEvents/' + a)];
        const reproduced = me.noPass && me.entitlements.length === 0 && woPressed && wo0.length === 1 && wo1.length === 2 && wo1[1].actor === me.name
          && eraPressed && ins0 === 0 && ins1.length > 0 && ins1.every((a) => a === me.name)
          && arrivePressed && arrivals.some((a) => a === 'appointment.arrived:' + me.name)
          && !!(nextTemp.rail && nextTemp.rail.arrive) && nextTemp.user === 'Jordan Lee';
        rec('S-controls-2', 'The temp persona with no day pass posts a $100 write-off, 37 ERA insurance payments and an arrival from Money Desk and the Board, every row actor "No day pass issued"; only Checkout refuses noPass, and the ghost\'s retired Arrive chip is then shown to the next named pass', 'B3, B9 — store.js:131 (noPass checked in postCheckout only), :222 requestWriteoff, :407 eraPostMatched, :102 arrive, :509 addDayPass reuses id u-temp; CONTRACTS §3 temp without a pass posts nothing',
          reproduced, { currentUser: me, writeoffRowsBefore: wo0, writeoffRowsAfter: wo1, writeoffGate: woGate, insuranceUserRowsBefore: ins0, insuranceUserRowsAfter: ins1.length, insuranceActors: [...new Set(ins1)], eraGate, arrivals, ghostRail, nextTemp, railChipsForJordan: chips, ghostRows, writes: writes(ev), refusalEvents: refusalEv(ev), seqRanges: { writeoff: [seq0 + 1, seq1], era: [seq1 + 1, seq2], arrive: [seq2 + 1, range(ev, seq0)[1]] }, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-3 · B3 · store.js:222 requestWriteoff never reads the actor's entitlements: evaluateRelease only sizes the
    // amount against the threshold, so Priya (post_payment, schedule — no write_off) posts a $100 courtesy write-off from
    // #/frontdesk/money while the Roles screen lists post_payment+write_off as a high SoD conflict.
    // Negative control: a write_off entitlement gate refuses with code entitlement and writes no ledger row; then
    // rowsAfter equals rowsBefore, refusal code is 'entitlement', and the check reports false.
    async 'S-controls-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/money');
        const me = await who(p);
        const seq0 = await lastSeq(p);
        const before = await ledgerRows(p, 'p-306', 'write_off');
        const bal0 = await p.evaluate(() => Proto.store.balances('p-306'));
        const pressed = await click(p, 'money.writeoff.p-306') && await click(p, 'money.writeoff.reason.courtesy') && await fill(p, 'money.writeoff.amount', '100') && await click(p, 'money.writeoff.post');
        await p.waitForTimeout(150);
        const ev = await after(p, seq0);
        const rows = await ledgerRows(p, 'p-306', 'write_off');
        const bal1 = await p.evaluate(() => Proto.store.balances('p-306'));
        const gate = await refusalsDom(p);
        const sod = await p.evaluate(() => window.__proto.state().sodRules.filter((r) => r.pair.includes('write_off')).map((r) => r.id + ':' + r.pair.join('+') + ':' + r.severity));
        const posted = rows.filter((e) => !before.some((x) => x.id === e.id));
        const reproduced = pressed && !me.entitlements.includes('write_off') && posted.length === 1 && posted[0].actor === me.name && posted[0].amountCents === -10000 && gate.length === 0 && bal1.patientDue === bal0.patientDue - 10000;
        rec('S-controls-3', 'Priya Raman, whose entitlements are post_payment and schedule, posts a $100 courtesy write-off on Lena Fischer from the front-desk Money Desk with no refusal: requestWriteoff has no write_off entitlement gate', 'B3 — store.js:222-233 requestWriteoff (evaluateRelease sizes the amount only); seed sodRules rule-post-writeoff names post_payment+write_off a high conflict; docs/05 entitlement gates',
          reproduced, { currentUser: me, rowsBefore: before, rowsAfter: rows, postedRow: posted[0] || null, balancesBefore: bal0, balancesAfter: bal1, refusalsDom: gate, sodRulesNamingWriteOff: sod, writes: writes(ev), refusalEvents: refusalEv(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-4 · B3 · store.js:202-216 decideApproval takes the approver from its argument (`user(approverId) ||
    // currentUser()`) and never checks approve_second: Bree Lawson (entitlements []) approves ar-1 and −$410 posts with
    // secondApprover "Bree Lawson"; from the requesting biller's own session, passing 'u-dr-1' records Dr. Reagan as decider.
    // Negative control: a verb that derives the approver from the session and requires approve_second refuses both calls
    // (entitlement / blocked_same_person), writes no approvalsLog or ledger row, and the check reports false.
    async 'S-controls-4'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const req = await p.evaluate(() => { const a = window.__proto.state().approvals[0]; return a ? { id: a.id, amountCents: a.amountCents, requestedBy: a.requestedBy, requestedById: a.requestedById, status: a.status } : null; });
        // Leg A: the hygienist, from her own persona route, decides through the store with her own id.
        await hop(p, '#/hygienist/phone');
        const bree = await who(p);
        const seqA = await lastSeq(p);
        const legA = await p.evaluate((id) => { const r = Proto.store.decideApproval(id, 'u-hy-1', 'approved', true); const S = window.__proto.state(); const a = S.approvals.find((x) => x.id === id); return { result: r, status: a.status, decidedBy: a.decidedBy, log: S.approvalsLog.map((l) => l.id + ':' + l.decision + ':' + l.by) }; }, req && req.id);
        const evA = await after(p, seqA);
        const woA = await ledgerRows(p, 'p-306', 'write_off');
        // Leg B: fresh store; the requesting biller passes another user's id as the approver.
        await p.evaluate(() => window.__proto.reset());
        await hop(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const sam = await who(p);
        const seqB = await lastSeq(p);
        const legB = await p.evaluate(() => { const S0 = window.__proto.state(); const id = S0.approvals[0].id; const r = Proto.store.decideApproval(id, 'u-dr-1', 'approved', true); const S = window.__proto.state(); const a = S.approvals.find((x) => x.id === id); return { id, result: r, requestedById: a.requestedById, status: a.status, decidedBy: a.decidedBy, log: S.approvalsLog.map((l) => l.id + ':' + l.decision + ':' + l.by) }; });
        const evB = await after(p, seqB);
        const woB = await ledgerRows(p, 'p-306', 'write_off');
        const rowA = woA.find((e) => e.amountCents === -41000) || null;
        const rowB = woB.find((e) => e.amountCents === -41000) || null;
        const reproduced = !!req && req.status === 'pending'
          && bree.id === 'u-hy-1' && bree.entitlements.length === 0 && legA.result.ok === true && legA.decidedBy === 'Bree Lawson' && !!rowA && rowA.secondApprover === 'Bree Lawson'
          && sam.id === legB.requestedById && legB.result.ok === true && legB.decidedBy === 'Dr. Blake Reagan' && !!rowB && rowB.secondApprover === 'Dr. Blake Reagan';
        rec('S-controls-4', 'decideApproval accepts any approver: Bree Lawson (no approve_second) approves the $410 write-off and is frozen as its second approver, and the requesting biller Sam Dawson, passing u-dr-1, has his own request recorded as approved by Dr. Blake Reagan', 'B3 — store.js:205 (`user(approverId) || currentUser()`), no approve_second check anywhere in decideApproval; CONTRACTS §6 blocked_same_person "enforced on the posting itself"; docs/05 dual release',
          reproduced, { request: req, legA: { currentUser: bree, ...legA, ledgerRow: rowA, writes: writes(evA), seqRange: range(evA, seqA) }, legB: { currentUser: sam, ...legB, ledgerRow: rowB, writes: writes(evB), seqRange: range(evB, seqB) }, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-5 · B9/B3 · checkout.js:301 keeps the draft per appointment (`state[aid]`), not per user: after the
    // shared-desk author switch (topbar.author → Bree's PIN 1111 → openSession) the new author inherits Priya's tender,
    // card number and PIN "5555", and Post passes store.js:132 with the previous author's PIN, posting as Bree Lawson.
    // Negative control: a draft keyed by user (or cleared on author switch) shows Bree an empty PIN and tender; Post refuses
    // pin_required / tender_required and writes no ledger row; then inheritedPin is '' and the check reports false.
    async 'S-controls-5'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044?device=shared');
        const first = await who(p);
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242'); await fill(p, 'checkout.pin', '5555');
        const seq0 = await lastSeq(p);
        const opened = await click(p, 'topbar.author');
        for (const d of '1111') await click(p, 'pin.key.' + d);
        await click(p, 'pin.submit'); await p.waitForTimeout(200);
        const second = await who(p);
        const inherited = await p.evaluate(() => ({ hash: location.hash, persona: window.__proto.persona, pin: (document.querySelector('[data-testid="checkout.pin"]') || {}).value, card: (document.querySelector('[data-testid="checkout.card.number"]') || {}).value, tenderPressed: [...document.querySelectorAll('[data-testid^="checkout.tender."]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-testid')) }));
        const seq1 = await lastSeq(p);
        const posted = await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const evPost = await after(p, seq1);
        const payments = await ledgerRows(p, 'p-303', 'patient_payment');
        const sessions = await p.evaluate(() => window.__proto.state().sessions.map((s) => s.id + ':' + s.actor + ':' + (s.endedAt ? 'ended' : 'open')));
        const gate = await refusalsDom(p);
        const reproduced = opened && first.id === 'u-fd-1' && second.id === 'u-hy-1' && inherited.pin === '5555' && inherited.card === '4242424242424242' && inherited.tenderPressed.includes('checkout.tender.card')
          && posted && payments.length === 1 && payments[0].actor === 'Bree Lawson' && gate.length === 0;
        rec('S-controls-5', 'Switching author mid-checkout on the shared desk hands Bree Lawson the previous author\'s draft — tender, card number and Priya\'s PIN 5555 still in the field — and Post accepts that PIN and freezes Bree on the $44 payment', 'B9, B3 — checkout.js:301 draft keyed by appointment id; store.js:132 pin gate; docs/13 §30 "wrong-author on a shared device is a Board complaint"; docs/04 shared-device author switch',
          reproduced, { authorBefore: first, authorAfter: second, inherited, sessions, payments, refusalsDom: gate, writesSwitchAndPost: writes(ev), writesAtPost: writes(evPost), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-6 · A2/C · store.js:424 buildAppeal has no offline() guard, while sendAppeal and every other posting verb
    // do; with the outage flag on, pressing Appeal on the c-88 denial writes appealPackets/ap-1 under an Andon that reads
    // "reads only, no postings". search()/retireChip (store.js:516, :525) likewise write firstRunState rows during the outage.
    // Negative control: a guarded buildAppeal returns the outage refusal and writes nothing; then packetsAfter equals
    // packetsBefore, writes is empty, and the check reports false.
    async 'S-controls-6'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money?outage=1');
        const flags = await p.evaluate(() => ({ outage: window.__proto.outage, storeOutage: window.__proto.state().outage, andon: ((document.getElementById('andon') || {}).textContent || '').replace(/\s+/g, ' ').trim() }));
        const before = await p.evaluate(() => window.__proto.state().appealPackets.length);
        await click(p, 'money.tab.denials');
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const packets = await p.evaluate(() => window.__proto.state().appealPackets.map((x) => ({ id: x.id, claimId: x.claimId })));
        const gate = await refusalsDom(p);
        // the sibling verbs under the same flag, for contrast, plus the two rail writers
        const siblings = await p.evaluate(() => { const st = Proto.store; const n0 = Proto.events.all().length; const send = st.sendAppeal('c-88'); const era = st.eraConfirm('el-14'); const n1 = Proto.events.all().length; const s = st.search('walk'); const n2 = Proto.events.all().length; return { sendAppeal: send.code || send.ok, eraConfirm: era.code || era.ok, siblingWrites: Proto.events.all().slice(n0, n1).filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id), searchWrites: Proto.events.all().slice(n1, n2).filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id) }; });
        const reproduced = flags.storeOutage === true && pressed && before === 0 && packets.length === 1 && writes(ev).includes('appealPackets/' + packets[0].id) && !gate.some((g) => g.code === 'outage') && siblings.sendAppeal === 'outage';
        rec('S-controls-6', 'With the server unreachable, pressing Appeal on the c-88 denial writes appealPackets/ap-1 (and Find writes firstRunState) under an Andon reading "reads only, no postings", while Send and every other posting verb refuse with outage', 'A2, CONTRACTS §3 outage ("every mutating verb refuses") — store.js:424 buildAppeal lacks the offline() guard that :425 sendAppeal carries; :516 retireChip / :525 search',
          reproduced, { flags, packetsBefore: before, packetsAfter: packets, refusalsDom: gate, writes: writes(ev), refusalEvents: refusalEv(ev), seqRange: range(ev, seq0), siblingsUnderOutage: siblings, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-7 · B3/A4 · store.js:449 reviewDecision has no entitlement gate and no already-decided gate, and
    // dailyclose.js:194 renders Keep/Tighten/Retire for every persona: Priya Raman changes tenant.dualReleaseThresholdCents
    // 15000 → 10000 from #/frontdesk/close, and a decision reviewed three times writes three controlDecisions rows.
    // resultLine is evidence only: on main it is null because the Tighten handler throws after the store mutation (S-controls-v1).
    // Negative control: a gated verb refuses the frontdesk seat (entitlement) and refuses a second review (already_decided),
    // so the threshold stays 15000, controlDecisions gains at most one row, and the check reports false.
    async 'S-controls-7'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/close');
        const me = await who(p);
        const buttons = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="close.decision.d-1."]')].map((b) => b.getAttribute('data-testid') + '=' + b.textContent.trim()));
        const t0 = await p.evaluate(() => window.__proto.state().tenant.dualReleaseThresholdCents);
        const cd0 = await p.evaluate(() => window.__proto.state().controlDecisions.length);
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'close.decision.d-1.tighten'); await p.waitForTimeout(150);
        const t1 = await p.evaluate(() => window.__proto.state().tenant.dualReleaseThresholdCents);
        const line = await p.evaluate(() => (document.body.textContent.match(/Tightened:[^.]*\./) || [])[0] || null);
        const gate = await refusalsDom(p);
        const seq1 = await lastSeq(p);
        // second and third review of the same decision, straight at the store
        const again = await p.evaluate(() => { const r1 = Proto.store.reviewDecision('d-1', 'keep'); const r2 = Proto.store.reviewDecision('d-1', 'retire'); const S = window.__proto.state(); return { r1, r2, status: S.decisions.find((d) => d.id === 'd-1').status, controlDecisions: S.controlDecisions.map((x) => x.id + ':' + x.action + ':' + x.by), threshold: S.tenant.dualReleaseThresholdCents }; });
        const ev = await after(p, seq0);
        // the threshold this seat lowered now gates the biller's $120 write-off
        const effect = await p.evaluate(() => Proto.store.evaluateRelease('write_off', 12000, Proto.store.currentUser()).code);
        const reproduced = pressed && me.id === 'u-fd-1' && buttons.length >= 3 && t0 === 15000 && t1 === 10000 && gate.length === 0
          && again.r1.ok === true && again.r2.ok === true && again.controlDecisions.length - cd0 === 3 && again.controlDecisions.slice(cd0).every((x) => x.endsWith(':' + me.name));
        rec('S-controls-7', 'The front-desk seat reviews the owner\'s dual-release decision: Tighten on #/frontdesk/close moves the write-off threshold from $150 to $100 under Priya Raman\'s name, and Keep then Retire on the same decision each write another controlDecisions row', 'B3, A4 — store.js:449 reviewDecision (no entitlement, no already-decided gate); dailyclose.js:194 renders the decision controls for every persona; docs/04 owner home decisions-due card; docs/05 "control policy changed"',
          reproduced, { currentUser: me, decisionButtons: buttons, thresholdBefore: t0, thresholdAfterTighten: t1, resultLine: line, refusalsDom: gate, secondAndThirdReview: again, controlDecisionsBefore: cd0, writes: writes(ev), refusalEvents: refusalEv(ev), seqRanges: { tighten: [seq0 + 1, seq1], repeats: [seq1 + 1, range(ev, seq0)[1]] }, releaseCodeFor120: effect, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-8 · A2/C2/B3 · store.js:229 requestWriteoff writes the approvals row inside the needs_second branch, so on
    // Money Desk the request exists at Post and the control labelled "Request approval" (moneydesk.js:163) only flips a flag —
    // the very defect A-store-3-2 guards on Checkout, where postCheckout now defers the write to the control.
    // Negative control: a Money Desk Post that writes nothing and a control that writes approvals/ar-1 make approvalsAtPost
    // empty and writesAtControl non-empty; then the check reports false.
    async 'S-controls-8'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const before = await p.evaluate(() => window.__proto.state().approvals.length);
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy');
        const seqPost = await lastSeq(p);
        const posted = await click(p, 'money.writeoff.post'); await p.waitForTimeout(200);
        const evPost = await after(p, seqPost);
        const approvalsAtPost = await p.evaluate(() => window.__proto.state().approvals.map((a) => a.id + ':' + a.status));
        const gate = await refusalsDom(p);
        const postLabel = await txt(p, 'money.writeoff.post');
        const seqCtl = await lastSeq(p);
        const ctl = await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const evCtl = await after(p, seqCtl);
        const approvalsAtControl = await p.evaluate(() => window.__proto.state().approvals.map((a) => a.id + ':' + a.status));
        const announced = await p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
        // Checkout, same amount, same account: the request row is written by the control, not by Post
        await p.evaluate(() => window.__proto.reset());
        await hop(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '410'); await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242');
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const checkoutAtPost = await p.evaluate(() => window.__proto.state().approvals.length);
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const checkoutAtControl = await p.evaluate(() => window.__proto.state().approvals.length);
        const needsSecond = gate.find((g) => g.code === 'needs_second') || null;
        const reproduced = posted && ctl && before === 0 && !!needsSecond && needsSecond.controlLabels.includes('Request approval')
          && approvalsAtPost.length === 1 && writes(evPost).some((w) => w.startsWith('approvals/')) && approvalsAtControl.length === 1 && writes(evCtl).length === 0
          && checkoutAtPost === 0 && checkoutAtControl === 1;
        rec('S-controls-8', 'On Money Desk, Post on the $410 write-off already writes approvals/ar-1 before the needs_second refusal is shown, so its "Request approval" control writes nothing — while Checkout, for the same account and amount, writes the request only when the control is pressed', 'A2, C2, B3 (one verb, one behaviour across screens) — store.js:229 requestWriteoff writes inside the gate branch; moneydesk.js:163 control sets woRequested only; A-store-3-2 measures Checkout only',
          reproduced, { approvalsBefore: before, approvalsAtPost, approvalsAtControl, postLabel, refusalsDom: gate, announcedAtControl: announced, writesAtPost: writes(evPost), writesAtControl: writes(evCtl), seqRanges: { post: range(evPost, seqPost), control: range(evCtl, seqCtl) }, checkoutComparator: { approvalsAtPost: checkoutAtPost, approvalsAtControl: checkoutAtControl }, pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-9 · A7/C5 · store.js:216 decideApproval posts the write-off with no look at what is left on the account:
    // two pending requests on Lena Fischer (Money Desk $410 + Checkout $300, one $410 balance), both approved, write −$710 of
    // write-offs; balances() and explain() then clamp to "$0.00 / paid in full" and the $300 row is invisible on every surface.
    // Negative control: a second approval that refuses (or a posting that caps at the open balance) leaves one write-off row
    // and the ledger sum equal to the charge; then overWrittenCents is 0 and the check reports false.
    async 'S-controls-9'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const seq0 = await lastSeq(p);
        const bal0 = await p.evaluate(() => Proto.store.balances('p-306'));
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150); await click(p, 'refusal.control');
        await hop(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '300'); await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242');
        await click(p, 'checkout.post'); await p.waitForTimeout(150); await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const requests = await p.evaluate(() => window.__proto.state().approvals.map((a) => ({ id: a.id, amountCents: a.amountCents, requestedBy: a.requestedBy, patientId: a.patientId, status: a.status })));
        await hop(p, '#/owner/phone');
        const cards = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="phone.request."][data-testid$=".approve"]')].map((b) => b.getAttribute('data-testid')));
        for (const r of requests) { await click(p, 'phone.request.' + r.id + '.approve'); await p.waitForTimeout(100); await stepUp(p, '2468'); }
        const ev = await after(p, seq0);
        const approvals = await p.evaluate(() => window.__proto.state().approvals.map((a) => a.id + ':' + a.status + ':' + a.decidedBy));
        const wo = await ledgerRows(p, 'p-306', 'write_off');
        const bal1 = await p.evaluate(() => Proto.store.balances('p-306'));
        const explain = await p.evaluate(() => Proto.store.explain('p-306').map((x) => x.sentence));
        await hop(p, '#/biller/ledger/p-306');
        const three = await p.evaluate(() => ((document.querySelector('.threenum') || {}).textContent || '').replace(/\s+/g, ' ').trim());
        const approvedRows = wo.filter((e) => e.secondApprover);
        const writtenOffCents = approvedRows.reduce((s, e) => s + -e.amountCents, 0);
        const overWrittenCents = writtenOffCents - bal0.patientDue;
        const reproduced = requests.length === 2 && requests.every((r) => r.patientId === 'p-306') && cards.length === 2 && approvals.every((a) => a.includes(':approved:'))
          && approvedRows.length === 2 && overWrittenCents === 30000 && bal1.patientDue === 0 && bal1.credit === 0 && explain.length === 1 && /paid in full/.test(explain[0]) && !/300/.test(explain[0]);
        rec('S-controls-9', 'Two second-approved courtesy write-offs on Lena Fischer\'s single $410 balance — $410 requested from Money Desk and $300 from Checkout — both post, leaving −$710 of write-off rows against a $410 charge while balances(), Explain and the ledger tiles read $0.00 / paid in full and never show the extra $300', 'A7, C5 — store.js:216 decideApproval posts without reading the open balance; store.js:78 balances clamps; the approver\'s frozen sentence (phone.js) carries no remaining-balance figure; docs/05 dual release is a control on the amount, which here exceeds the debt',
          reproduced, { balancesBefore: bal0, requests, approverCards: cards, approvals, writeOffRows: wo, writtenOffCents, overWrittenCents, balancesAfter: bal1, explain, ledgerTiles: three, writes: writes(ev), seqRange: range(ev, seq0), pageErrors: errs });
      } finally { await c.close(); }
    },

    // RC-swarm-controls-v1 · A4/A2 · dailyclose.js:207-208 build the Tighten/Retire result line from `T.dualReleaseThresholdCents`,
    // but no `T` is in scope (the tenant is `S.tenant`): the click handler throws ReferenceError AFTER store.reviewDecision has
    // mutated decisions/d-1, tenant and controlDecisions, so no result line and no announcement render and the card is not
    // re-rendered — Keep/Tighten/Retire stay on screen and a second press of the same control writes controlDecisions/dec-3 (A4).
    // Keep, which reads no `T`, renders "Kept 90 more days…" and removes the controls. Owner persona: this is the main flow.
    // Negative control: with `S.tenant.dualReleaseThresholdCents` (or a gated reviewDecision) the press throws nothing, the line
    // renders, the controls leave the card and the second press writes no row; then the check reports false.
    async 'S-controls-v1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        // each leg on its own document: a second go() to the same file URL is a same-document navigation and keeps the store
        const fresh = async () => { await p.goto('about:blank'); await go(p, '#/owner/close'); };
        const legs = {};
        for (const action of ['tighten', 'retire']) {
          await fresh();
          const seq0 = await lastSeq(p);
          const cd0 = await p.evaluate(() => window.__proto.state().controlDecisions.length);
          const errsBefore = errs.length;
          const pressed = await click(p, 'close.decision.d-1.' + action); await p.waitForTimeout(200);
          const view1 = await p.evaluate(() => ({
            buttons: [...document.querySelectorAll('[data-testid^="close.decision.d-1."]')].map((b) => b.getAttribute('data-testid')),
            resultLine: (document.body.textContent.match(/(Tightened|Retired|Kept)[^.]*\./) || [])[0] || null,
            live: ((document.getElementById('live') || {}).textContent || '').trim(),
            status: window.__proto.state().decisions.find((d) => d.id === 'd-1').status,
            controlDecisions: window.__proto.state().controlDecisions.map((x) => x.id + ':' + x.action),
          }));
          const pressedAgain = await click(p, 'close.decision.d-1.' + action); await p.waitForTimeout(200);
          const cd2 = await p.evaluate(() => window.__proto.state().controlDecisions.map((x) => x.id + ':' + x.action));
          const ev = await after(p, seq0);
          legs[action] = { pressed, pressedAgain, pageErrorsFromPress: errs.slice(errsBefore), afterFirstPress: view1, controlDecisionsAfterSecondPress: cd2, rowsWritten: cd2.length - cd0, writes: writes(ev), refusalEvents: refusalEv(ev), seqRange: range(ev, seq0) };
        }
        // Keep is the comparator: same card, same verb, no `T` in its string, so it renders and retires the controls.
        await fresh();
        const keepErrs = errs.length;
        await click(p, 'close.decision.d-1.keep'); await p.waitForTimeout(200);
        const keep = await p.evaluate(() => ({ buttons: [...document.querySelectorAll('[data-testid^="close.decision.d-1."]')].length, resultLine: (document.body.textContent.match(/Kept[^.]*\./) || [])[0] || null }));
        const keepPageErrors = errs.slice(keepErrs);
        const broken = (l) => l.pressed && l.pressedAgain && l.pageErrorsFromPress.some((e) => /T is not defined/.test(e)) && l.afterFirstPress.resultLine === null
          && l.afterFirstPress.status !== 'review_due' && l.afterFirstPress.buttons.length >= 3 && l.rowsWritten === 2 && l.controlDecisionsAfterSecondPress.filter((x) => x.endsWith(':' + l.afterFirstPress.status)).length === 2;
        const reproduced = broken(legs.tighten) && broken(legs.retire) && keep.buttons === 0 && !!keep.resultLine && keepPageErrors.length === 0;
        rec('S-controls-v1', 'On the owner\'s Daily Close, Tighten and Retire on decision d-1 throw "T is not defined" after the store has already changed d-1, the threshold and controlDecisions: no result line or announcement renders, the Keep/Tighten/Retire controls stay on the card, and pressing the same control again writes a second controlDecisions row', 'A4, A2 — dailyclose.js:207-208 read T.dualReleaseThresholdCents with no T in scope (the tenant is S.tenant); store.js:449 reviewDecision has already written decisions/d-1 and controlDecisions before the handler throws; Keep on the same card renders and retires its controls',
          reproduced, { legs, keepComparator: { buttonsLeft: keep.buttons, resultLine: keep.resultLine, pageErrors: keepPageErrors }, pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
