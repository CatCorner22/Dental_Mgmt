// Round-2 fix-storm checks for the store owner: prototype/js/store.js, prototype/js/seed.js and the task scripts under
// scripts/beta/tasks. Each check names the round-2 finding it guards, drives the prototype (store verbs directly where the
// rule is the store's), and measures the breach; default position is NOT reproduced and every check carries its
// precondition values. Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, click, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const setPersona = (p, persona) => p.evaluate((x) => window.__proto.set({ persona: x }), persona);
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const refusalsSince = async (p, seq0) => (await events(p)).filter((e) => e.seq > seq0 && e.kind === 'refusal').map((e) => e.code);
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() })));
  const balances = (p, pid) => p.evaluate((x) => Proto.store.balances(x), pid);
  const rows = (S, pid) => S.ledger.filter((e) => e.patientId === pid);
  const fileEnc = (p, encId) => p.evaluate((e) => Proto.store.fileNote(e, { assessment: 'Recall exam; no new caries.', plan: 'Recall 6 months.' }, true), encId);
  const heldWriteoff = async (p) => { await go(p, '#/biller/money'); await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); return p.evaluate(() => (window.__proto.state().approvals[0] || {}).id || null); };
  const task = async (file, id) => { const fs = await import('node:fs'); const T = JSON.parse(fs.readFileSync('/workspace/scripts/beta/tasks/' + file, 'utf8')); return { start: T.start, task: T.tasks.find((t) => t.id === id) }; };
  const isTestid = (s) => /^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(s);

  return {
    // board-checkout-r2-1: allocate() let the $44 window payment on a-1044 eat the insurer's expected share of the exam
    // charge, so Patient due read $33.04 after the patient paid exactly her $44.00 share. Negative control: after File and
    // Post the patient share is 4400, the payment is allocated 4400 and patientDue is 0.
    async 'A-storm2-store-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        const filed = await fileEnc(p, 'enc-9003');
        await setPersona(p, 'frontdesk'); await hop(p, '#/frontdesk/checkout/a-1044');
        const b0 = await balances(p, 'p-303');
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S = await state(p); const b1 = await balances(p, 'p-303');
        const share = rows(S, 'p-303').filter((e) => e.kind === 'charge' && e.posted === S.tenant.today).reduce((t, e) => t + e.amountCents - (e.insuranceExpectedCents || 0), 0);
        const pay = rows(S, 'p-303').find((e) => e.kind === 'patient_payment') || null;
        const alloc = S.allocations.filter((a) => pay && a.paymentId === pay.id).reduce((t, a) => t + a.amountCents, 0);
        rec('A-storm2-store-1', 'After Dr. Kim files enc-9003, Collect $44.00 by card on a-1044 leaves Patient due $33.04: the payment is applied to the exam charge before its insurer share is taken out, so it settles the insurer\'s money and not the patient\'s', 'docs/13 feature 1 (the window\'s $44 settles the patient portion) and feature 23 (three numbers from ledger rows); store.js allocate()',
          filed.ok === true && b0.patientDue === 4400 && share === 4400 && !!pay && b1.patientDue > 0, { filed: filed.ok, before: b0, after: b1, patientShareToday: share, payment: pay && pay.amountCents, allocatedToCharges: alloc });
      } finally { await c.close(); }
    },

    // clinical-r2-d1: filing enc-9010 consumed intent ai-0 and marked cr-1 applied but wrote no allocations row for the $95 that
    // landed. Negative control: after File an allocations row names le-window-9010 and a released charge.
    async 'A-storm2-store-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9010');
        const res = await fileEnc(p, 'enc-9010');
        const S = await state(p);
        const ai = S.allocationIntents.find((x) => x.id === 'ai-0') || null;
        const alloc = S.allocations.filter((a) => a.paymentId === 'le-window-9010');
        rec('A-storm2-store-2', 'Filing enc-9010 applies intent ai-0 (appliedTo set) while allocations stays empty: the $95.00 payment and the released charge are on the ledger with no payment_allocation between them', 'docs/13 Filed-later lane (on note_filed the charges post and the allocations are applied) and Ledger spec (Explain reads payment_allocations); store.js fileNote',
          res.ok === true && (res.released || 0) > 0 && !!ai && !!ai.appliedTo && alloc.length === 0, { fileResult: res.ok ? { released: res.released } : res.code, intent: ai, allocationsForPayment: alloc, balances: await balances(p, 'p-307') });
      } finally { await c.close(); }
    },

    // board-checkout-r2-2: postCheckout ran the release gate on a write-off but never the balance cap requestWriteoff applies,
    // so $410 cash plus a $100 courtesy write-off on a-1047 netted −$100 and a $50 hardship write-off posted on a-1045's $0.
    // Negative control: both refuse with amount_required and no write_off row is written.
    async 'A-storm2-store-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        const due = (await balances(p, 'p-306')).patientDue;
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '100'); await click(p, 'checkout.writeoff.reason.courtesy');
        const n0 = (await state(p)).ledger.length;
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S = await state(p);
        const wo = S.ledger.slice(n0).filter((e) => e.kind === 'write_off' && e.patientId === 'p-306').map((e) => e.amountCents);
        const net = rows(S, 'p-306').reduce((t, e) => t + e.amountCents, 0);
        await go(p, '#/frontdesk/checkout/a-1045');
        const zero = await p.evaluate(() => Proto.store.postCheckout('a-1045', { decision: 'zero_due', tender: null, amountCents: 0, selfPay: [], writeoffCents: 5000, writeoffReason: 'hardship', cadence: 'monthly', pin: null }));
        const woZero = (await state(p)).ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-304').length;
        rec('A-storm2-store-3', 'Checkout posts a write-off above what the patient owes: $410 cash plus a $100 courtesy write-off on a-1047 nets −$100.00 (Credit $100.00), and a $50 hardship write-off posts on a-1045 whose patient portion is $0.00, while Money Desk refuses the same amounts', 'store.js requestWriteoff (a write-off retires what the patient owes and no more) and docs/01 principle 9; store.js postCheckout',
          due === 41000 && ((wo.length > 0 && net < 0) || zero.ok === true || woZero > 0), { patientDueBefore: due, writeOffsWritten: wo, netAfter: net, balances: await balances(p, 'p-306'), refusals: await refusals(p), a1045: zero.ok ? 'ok' : zero.code, a1045WriteOffs: woZero });
      } finally { await c.close(); }
    },

    // board-checkout-r2-3 (store part): postCheckout handed the after_hours hold a pendingRequest, and decideApproval wrote the
    // write-off without re-reading the clock, so an approver posted a held write-off while afterHours stayed true. Negative
    // control: after hours the Post refuses with no pendingRequest and an approval decided after hours is refused after_hours.
    async 'A-storm2-store-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047?afterHours=1');
        const o = await p.evaluate(() => {
          const S = window.__proto.state();
          const post = Proto.store.postCheckout('a-1047', { decision: 'collect', tender: 'card', amountCents: 41000, selfPay: [], writeoffCents: 10000, writeoffReason: 'courtesy', cadence: 'monthly', pin: null });
          const held = { code: post.code, pendingRequest: !!post.pendingRequest, control: post.control };
          const req = Proto.store.requestApproval({ kind: 'write_off', amountCents: 10000, reason: 'courtesy', patientId: 'p-306', eligible: ['Dana', 'Dr. Reagan'], appointmentId: 'a-1047' });
          const decided = req.ok ? Proto.store.decideApproval(req.requestId, 'u-dr-1', 'approved', { pin: '2468' }) : null;
          const wo = window.__proto.state().ledger.filter((e) => e.kind === 'write_off' && e.approvalRequestId === (req.requestId || null)).map((e) => e.amountCents);
          return { afterHours: S.clock.afterHours, held, request: req.ok ? req.requestId : req.code, decided: decided && (decided.ok ? 'ok' : decided.code), writeOffsFromApproval: wo };
        });
        rec('A-storm2-store-4', 'Under afterHours the Checkout write-off hold carries a pendingRequest (its control says Request approval) and the request it raises is approvable: Dr. Reagan approves it and the $100 write-off lands while clock.afterHours is still true', 'CONTRACTS §6 after_hours (held regardless of amount until 7:30 am); docs/13 feature 25; store.js postCheckout, decideApproval',
          o.afterHours === true && o.held.code === 'after_hours' && (o.held.pendingRequest || o.writeOffsFromApproval.length > 0), o);
      } finally { await c.close(); }
    },

    // board-checkout-r2-8: postCheckout never tested post_payment, so hygienist Bree Lawson (entitlements []) posted two charges and
    // a $168 payment from Checkout. Negative control: Post refuses with entitlement and writes no ledger row for p-305.
    async 'A-storm2-store-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/checkout/a-1046');
        const u = await p.evaluate(() => Proto.store.currentUser());
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S = await state(p);
        const written = rows(S, 'p-305').map((e) => e.kind + ':' + e.actor);
        rec('A-storm2-store-5', 'Hygienist Bree Lawson, whose entitlements are [], posts two charges and a $168.00 cash payment from #/hygienist/checkout/a-1046 with no refusal: Post never tests post_payment while closeDay, addDayPass and clearVariance test theirs', 'docs/01 principle 1 (controls enforced in the transaction path); docs/13 feature 30; seed SoD rules keyed on post_payment; store.js postCheckout',
          !(u.entitlements || []).includes('post_payment') && written.length > 0 && written.every((w) => w.endsWith(u.name)), { user: u.name, entitlements: u.entitlements, rowsWritten: written, refusals: await refusalsSince(p, seq0) });
      } finally { await c.close(); }
    },

    // board-checkout-r2-9 / invariants-r2-3 / shell-owner-r2-7: the desk PIN was matched with no miss count, so five wrong PINs
    // never locked the device, the sixth (correct) posted, and no store verb wrote the finding the pad's Why promised. Negative
    // control: the third miss refuses pin_locked and writes a findings row, and the correct PIN is refused while the lock stands.
    async 'A-storm2-store-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash');
        const seq0 = await lastSeq(p);
        const codes = [];
        for (const pin of ['1', '2', '3', '4', '5']) { await fill(p, 'checkout.pin', pin); await click(p, 'checkout.post'); codes.push(((await refusals(p))[0] || {}).code || null); }
        const n0 = (await state(p)).ledger.length;
        await fill(p, 'checkout.pin', '5555'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const S = await state(p);
        const o = { gates: codes, refusalEvents: await refusalsSince(p, seq0), postedAfterMisses: S.ledger.length - n0, findingsRows: (S.findings || []).length, pinLockout: await p.evaluate(() => typeof Proto.store.pinLockout), verifyPin: await p.evaluate(() => typeof Proto.store.verifyPin) };
        const locked = o.gates.includes('pin_locked');
        rec('A-storm2-store-6', 'Five wrong PINs in checkout.pin each raise pin_no_match with no lock and one refusal event in total, the sixth attempt with 5555 posts three ledger rows, and no findings row is written: the desk PIN has no miss counter and the store has no pinLockout', 'docs/13 feature 30 (throttled desk PIN, control_findings kind pin_failures_device) and feature 28 (three misses lock the device); CONTRACTS §5; store.js verifyPin, pinLockout',
          o.gates.filter(Boolean).length === 5 && (!locked || o.postedAfterMisses > 0 || o.findingsRows === 0 || o.pinLockout !== 'function'), o);
      } finally { await c.close(); }
    },

    // board-checkout-r2-12 / invariants-r2-2: a PIN post opened a live session for the PIN's owner (Dana, who has no chart persona)
    // while currentUser() and the chip stayed Priya, and the first-run rows retired for Priya. Negative control: the rows are
    // Dana's, no live session opens for her, the first-run rows name u-om-1 and currentUser() stays the author the chip shows.
    async 'A-storm2-store-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.pin', '4444'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const S = await state(p);
        const actors = rows(S, 'p-305').map((e) => e.actor);
        const live = S.sessions.filter((x) => !x.endedAt).map((x) => x.userId);
        const frs = S.firstRunState.map((f) => f.userId);
        const cur = await p.evaluate(() => Proto.store.currentUser().name);
        rec('A-storm2-store-7', 'Dana\'s PIN 4444 posts a-1046 frozen to Dana Whitfield and opens a live charting session for u-om-1 (no chart persona) while currentUser() stays Priya and the first-run rows written by the posting are frs-u-fd-1-*: Priya\'s first-shift chips retire on Dana\'s posting', 'docs/13 feature 30 (the PIN on Post names the poster; a session is a charting author) and docs/04 (first-run state belongs to a person); CONTRACTS §6 no_chart_session; store.js poster(), retireChip()',
          actors.length > 0 && actors.every((a) => a === 'Dana Whitfield') && (live.includes('u-om-1') || frs.includes('u-fd-1') || !frs.includes('u-om-1')), { actors, liveSessions: live, sessions: S.sessions.map((x) => x.userId + ':' + (x.endedAt ? 'ended' : 'live')), firstRunUsers: frs, currentUser: cur });
      } finally { await c.close(); }
    },

    // board-checkout-r2-13: the day pass carried no PIN and the desk PIN matched users only, so a temp on a shared desk could post
    // only under someone else's PIN. Negative control: addDayPass mints a PIN onto the pass and the holder posts under it.
    async 'A-storm2-store-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles?device=shared');
        const dp = await p.evaluate(() => Proto.store.addDayPass({ name: 'Sam Lee', role: 'frontdesk', location: 'loc-1', end: '17:00', extra: [] }, null));
        const tu = await p.evaluate(() => Proto.store.get().tempUser || null);
        await setPersona(p, 'temp'); await hop(p, '#/temp/checkout/a-1046');
        const own = await p.evaluate(() => Proto.store.postCheckout('a-1046', { decision: 'collect', tender: 'cash', amountCents: 16800, selfPay: [], writeoffCents: 0, cadence: 'monthly', pin: (Proto.store.get().tempUser || {}).pin || null }));
        const S = await state(p);
        const actors = rows(S, 'p-305').map((e) => e.actor);
        rec('A-storm2-store-8', 'Sam Lee\'s day pass (frontdesk, post_payment) carries no PIN, so on a shared desk the holder cannot post under it: Post refuses pin_required for the pass and only another person\'s PIN posts, frozen to that person', 'docs/13 feature 27 (the pass is the identity every record is frozen onto) and feature 30 (zero wrong-author events on shared devices); store.js addDayPass, verifyPin',
          dp.ok === true && !!tu && (!tu.pin || own.ok !== true || !actors.every((a) => a === 'Sam Lee')), { dayPass: dp.ok ? dp.dayPass.id : dp.code, tempUser: tu, passPin: tu && tu.pin ? 'set' : null, ownPost: own.ok ? 'ok' : own.code, actors });
      } finally { await c.close(); }
    },

    // board-checkout-r2-14: allocate() pushed a payment onto the last charge twice when its remainder over-applied, and explain()
    // never named a reversal, so p-312 read "you paid $1,079.00" twice for one row and p-311's sentence did not add up.
    // Negative control: one "you paid" per payment row and the sentence's arithmetic matches its stated owe.
    async 'A-storm2-store-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/ledger/p-312');
        const S = await state(p);
        const s312 = await p.evaluate(() => Proto.store.explain('p-312').map((x) => x.sentence).join(' '));
        const twice = (s312.match(/you paid \$1,079\.00 on 9\/2\/2026/g) || []).length;
        const oneRow = rows(S, 'p-312').filter((e) => e.amountCents === -107900).length === 1;
        const s311 = await p.evaluate(() => Proto.store.explain('p-311')[0].sentence);
        const parts = s311.replace(/\.$/, '').split('; ');
        const cents = (s) => Number(((s.match(/\$[\d,]+\.\d\d/) || ['$0.00'])[0]).replace(/[$,]/g, ''));
        const nums = parts.map(cents);
        // A reversal adds back what it reverses; every other listed amount came off the charge.
        const arith = nums[0] - parts.slice(1, -1).reduce((a, s) => a + (/^reversal of/.test(s) ? -cents(s) : cents(s)), 0);
        rec('A-storm2-store-9', 'Explain lists "you paid $1,079.00 on 9/2/2026" twice for the single −$1,079 row on p-312, and p-311\'s first sentence omits the $120 reversal so its listed payments do not add up to the "you owe" it states', 'docs/13 feature 23 (one sentence per charge from ledger rows and allocations; the sentence can be summed); store.js allocate(), explain()',
          oneRow && (twice >= 2 || Math.abs(arith - nums[nums.length - 1]) > 1), { p312Sentence: s312, timesListed: twice, oneRow, p311Sentence: s311, arithmetic: { chargeMinusListed: arith, stated: nums[nums.length - 1] }, p311Reversals: rows(S, 'p-311').filter((e) => e.kind === 'reversal').map((e) => e.id) });
      } finally { await c.close(); }
    },

    // board-checkout-r2-15: task fo-5 named a-1050, which the seed has already checked out (cd-0), so its steps ended in
    // tender_required and then already_decided with no allocationIntents write. Negative control: the task's literal steps run
    // on a fresh page from its group's start route and end with an intent written and no refusal standing.
    async 'A-storm2-store-10'(b) {
      const { c, p } = await ctx(b);
      try {
        const { start, task: t } = await task('front_office.json', 'fo-5');
        await go(p, start);
        const n0 = (await state(p)).allocationIntents.length;
        const ran = [];
        for (const step of t.steps) { if (isTestid(step)) ran.push(step + ':' + (await click(p, step))); }
        await p.waitForTimeout(200);
        const S = await state(p);
        rec('A-storm2-store-10', 'Task fo-5 (front_office.json) cannot succeed: its steps board.queue.row.a-1050.ping → .checkout → checkout.post end in tender_required, and with a tender in already_decided, because a-1050 is seeded already checked out (cd-0); no allocationIntents row is written', 'brief category 5 (a task-script step that cannot run on its path); CONTRACTS §8 (a-1050 is the visit already checked out with the note unfiled); scripts/beta/tasks/front_office.json fo-5',
          !!t && ran.length >= 3 && (S.allocationIntents.length === n0 || (await refusals(p)).length > 0), { steps: t && t.steps, ran, intentsBefore: n0, intentsAfter: S.allocationIntents.length, refusals: await refusals(p), hash: await p.evaluate(() => location.hash) });
      } finally { await c.close(); }
    },

    // clinical-r2-2: chartUndo reset every charted tag on the undone event's tooth, so undoing a crown on #30 reopened tag-1 that the
    // standing D2392 #30 DO paint had charted. Negative control: only the tag the undone event charted is reopened.
    async 'A-storm2-store-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const o = await p.evaluate(() => {
          const a = Proto.store.chartPaint('enc-9002', 30, ['d', 'o'], 'd2392', 'today');
          const t1 = Proto.store.get().tags.find((t) => t.id === 'tag-1').disposition;
          const b = Proto.store.chartPaint('enc-9002', 30, [], 'd2740', 'today');
          const u = Proto.store.chartUndo('enc-9002');
          const S = window.__proto.state();
          const live = S.chartEvents.filter((c) => c.encounterId === 'enc-9002' && !c.reversed && c.kind !== 'reversal').map((c) => c.cdt + ':' + c.tooth);
          return { paint1: a.ok, paint2: b.ok, undo: u.ok ? 'ok' : u.code, dispositionAfterPaint: t1, dispositionAfterUndo: S.tags.find((t) => t.id === 'tag-1').disposition, live };
        });
        rec('A-storm2-store-11', 'After tag-1 is charted as D2392 #30 DO and a D2740 #30 is painted, Undo (reversing only the crown) resets tag-1 to undispositioned while the D2392 paint that charted it still stands', 'docs/13 for-dentist tags (a tag\'s disposition follows the paint that charted it); store.js chartUndo',
          o.paint1 && o.paint2 && o.undo === 'ok' && o.dispositionAfterPaint === 'charted' && o.live.includes('d2392:30') && !o.live.includes('d2740:30') && o.dispositionAfterUndo !== 'charted', o);
      } finally { await c.close(); }
    },

    // clinical-r2-3: chartUndo looked the plan item up by encounter, code and tooth alone, so undoing an Existing D2392 #30 MO
    // reversed the Today paint's plan item pl-1. Negative control: the Today paint's plan item stands after the undo.
    async 'A-storm2-store-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const o = await p.evaluate(() => {
          const a = Proto.store.chartPaint('enc-9002', 30, ['d', 'o'], 'd2392', 'today');
          const b = Proto.store.chartPaint('enc-9002', 30, ['m', 'o'], 'd2392', 'existing');
          const plansBefore = window.__proto.state().planItems.filter((x) => x.encounterId === 'enc-9002' && !x.reversed).map((x) => x.id);
          const u = Proto.store.chartUndo('enc-9002');
          const S = window.__proto.state();
          return { paint1: a.ok, paint2: b.ok, undo: u.ok ? 'ok' : u.code, plansBefore, plans: S.planItems.filter((x) => x.encounterId === 'enc-9002' && x.cdt === 'd2392' && x.tooth === 30).map((x) => x.id + ':' + x.temporality + ':' + (x.reversed ? 'reversed' : 'live')), live: S.chartEvents.filter((c) => c.encounterId === 'enc-9002' && !c.reversed && c.kind !== 'reversal').map((c) => c.cdt + ':' + c.tooth + ':' + c.temporality) };
        });
        rec('A-storm2-store-12', 'Painting D2392 #30 MO as Existing after the Today D2392 #30 DO and pressing Undo marks the Today paint\'s plan item reversed although the Today chart event and its pending charge still stand', 'docs/13 flow 3 (Existing creates no plan item; Undo reverses the paint being undone); docs/01 principle 9; store.js chartUndo',
          o.paint1 && o.paint2 && o.undo === 'ok' && o.plansBefore.length >= 1 && o.live.includes('d2392:30:today') && o.plans.length > 0 && o.plans.every((x) => x.endsWith(':reversed')), o);
      } finally { await c.close(); }
    },

    // clinical-r2-4: chartPaint, addTag and readyForExam carried no pass or licence gate, so a temp with no day pass (and the front
    // desk) painted procedures with pending charges, tagged and requested exams as 'No day pass issued'. Negative control: each
    // refuses (entitlement for the pass-less temp, licence_scope for an unlicensed seat) and writes nothing.
    async 'A-storm2-store-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/encounter/enc-9002');
        const run = () => p.evaluate(() => { const who = Proto.store.currentUser(); const r = { paint: Proto.store.chartPaint('enc-9002', 19, [], 'd2740', 'today'), tag: Proto.store.addTag('enc-9001', 30, [], 'Recession'), ready: Proto.store.readyForExam('a-1042') }; return { who: who.name, licence: who.licence || null, noPass: !!who.noPass, results: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.ok ? 'ok' : v.code])) }; });
        const temp = await run();
        await setPersona(p, 'frontdesk'); await hop(p, '#/frontdesk/encounter/enc-9002');
        const fd = await run();
        const S = await state(p);
        const authors = S.chartEvents.map((e) => e.author).concat(S.tags.filter((t) => t.id !== 'tag-1').map((t) => t.author), S.appointmentEvents.map((e) => e.actor));
        rec('A-storm2-store-13', 'A temp with no day pass (licence null) and the front desk paint chart events with pending charges, add tags and request an exam: chartPaint, addTag and readyForExam carry no pass or licence gate, so rows are authored "No day pass issued"', 'docs/01 principle 22 (a day pass has no clinical entitlements without a verified credential); docs/06 (the clinical-licence axis cannot be bypassed); store.js chartPaint, addTag, readyForExam',
          temp.noPass && !fd.licence && (Object.values(temp.results).some((x) => x === 'ok') || Object.values(fd.results).some((x) => x === 'ok')), { temp, frontdesk: fd, authorsWritten: authors });
      } finally { await c.close(); }
    },

    // clinical-r2-10: addTag had no noteFiled test, so a tag saved on the filed encounter enc-9004 was written open where no queue
    // or screen could disposition it. Negative control: the tag is refused (exam_sealed) and no tags row is written.
    async 'A-storm2-store-14'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/perio/enc-9004');
        const o = await p.evaluate(() => { const filed = !!Proto.store.encounter('enc-9004').noteFiled; const res = Proto.store.addTag('enc-9004', 30, [], 'Recession'); const tag = window.__proto.state().tags.find((t) => t.encounterId === 'enc-9004') || null; return { filed, result: res.ok ? 'ok' : res.code, control: res.control || null, tag }; });
        rec('A-storm2-store-14', 'A tag saved from the Perio screen of the filed encounter enc-9004 is written open (disposition null) and reaches no Exams-to-sign row and no encounter screen, so nothing can disposition it', 'docs/13 Exams to sign (rows leave only by filing; zero undispositioned tags on signed exams); store.js addTag',
          o.filed && o.result === 'ok' && !!o.tag && !o.tag.disposition, o);
      } finally { await c.close(); }
    },

    // shell-owner-r2-2: matchVariance and reviewDecision had no entitlement rule, so a temp with no pass tied the day and retired
    // d-1 (moving the tenant threshold). Negative control: both refuse with entitlement beside clearVariance's rule.
    async 'A-storm2-store-15'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/close');
        const o = await p.evaluate(() => { const me = Proto.store.currentUser(); const t0 = Proto.store.get().tenant.dualReleaseThresholdCents; const m = Proto.store.matchVariance('v-1'); const d = Proto.store.reviewDecision('d-1', 'retire'); const S = window.__proto.state(); return { me: me.name, entitlements: me.entitlements, match: m.ok ? 'ok' : m.code, review: d.ok ? 'ok' : d.code, variance: S.variances[0].status, decision: S.decisions[0].status, threshold: [t0, S.tenant.dualReleaseThresholdCents], actors: S.reconciliationMatches.map((x) => x.actor).concat(S.controlDecisions.map((x) => x.by)) }; });
        rec('A-storm2-store-15', 'As #/temp/close (No day pass issued, entitlements []) Match on v-1 ties the day and Retire on d-1 moves tenant.dualReleaseThresholdCents, each recorded to "No day pass issued": matchVariance and reviewDecision carry no entitlement rule while clearVariance and closeDay do', 'docs/05 (reconciliation and decision review are money controls held to the seats that carry them); CONTRACTS §6 entitlement; store.js matchVariance, reviewDecision',
          !(o.entitlements || []).includes('bank_reconcile') && !(o.entitlements || []).includes('close_day') && (o.match === 'ok' || o.review === 'ok'), o);
      } finally { await c.close(); }
    },

    // invariants-r2-13: task da-5 sent a new hire to #/frontdesk/roles to issue her own pass, which addDayPass refuses (grant_roles
    // is the owner's or Dana's). Negative control: the task's route names a seat that grants roles and its steps issue the pass.
    async 'A-storm2-store-16'(b) {
      const { c, p } = await ctx(b);
      try {
        const { task: t } = await task('assistant.json', 'da-5');
        const route = ((t.steps[0] || '').match(/#\/[a-z]+\/roles/) || [null])[0];
        await go(p, route + '?device=shared');
        const me = await p.evaluate(() => Proto.store.currentUser());
        await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Sam Lee'); await click(p, 'roles.daypass.role.frontdesk'); await click(p, 'roles.daypass.location.loc-1'); await click(p, 'roles.daypass.save'); await p.waitForTimeout(150);
        const S = await state(p);
        const signin = !!(await p.$(tid('roles.daypass.signin')));
        rec('A-storm2-store-16', 'Task da-5 (assistant.json) routes a new hire to #/frontdesk/roles to issue her own day pass: roles.daypass.save is refused with entitlement "Ask a seat that grants roles", no dayPasses row is written and roles.daypass.signin never renders', 'scripts/beta/tasks/assistant.json da-5 against store.js addDayPass (grant_roles); docs/13 feature 27 (the office manager or owner provisions the pass; a hire granting her own is the SoD path the rule closes)',
          !!route && !(me.entitlements || []).includes('grant_roles') && S.dayPasses.length === 0 && !signin, { route, issuer: me.name, entitlements: me.entitlements, dayPasses: S.dayPasses.length, signinRendered: signin, refusals: await refusals(p) });
      } finally { await c.close(); }
    },

    // shell-owner-r2-1 (store part): decideApproval took any truthy step-up, so the phone pad approved ar-1 as Dr. Reagan on Bree's
    // 1111. Negative control: {pin} is matched against the approver's own PIN; 1111 refuses pin_no_match and writes nothing.
    async 'A-storm2-store-17'(b) {
      const { c, p } = await ctx(b);
      try {
        const reqId = await heldWriteoff(p);
        const o = await p.evaluate((id) => { const owner = Proto.store.user('u-dr-1'); const res = id ? Proto.store.decideApproval(id, 'u-dr-1', 'approved', { pin: '1111' }) : null; const a = window.__proto.state().approvals.find((x) => x.id === id) || {}; return { ownerPin: owner.pin, result: res && (res.ok ? 'ok' : res.code || (res.needsStepup ? 'needsStepup' : null)), status: a.status || null, decidedBy: a.decidedBy || null }; }, reqId);
        rec('A-storm2-store-17', 'decideApproval accepts a step-up carrying Bree\'s PIN 1111 for approver Dr. Reagan (PIN 2468): ar-1 is approved and decidedBy reads Dr. Blake Reagan', 'docs/13 feature 22 (step-up re-verifies the approver\'s identity); CONTRACTS §6 pin_no_match; store.js decideApproval, verifyPin',
          !!reqId && o.ownerPin !== '1111' && o.status === 'approved', Object.assign({ requestId: reqId }, o));
      } finally { await c.close(); }
    },
  };
};
