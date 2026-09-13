// Round-4 fix-storm checks for the store owner: prototype/js/store.js, seed.js and screens/roles.js. Each check names the
// round-4 finding it guards, drives the verb through the screen where the breach was seen (or the store verb the rule
// belongs to), and measures the breach; default position is NOT reproduced and every check carries its precondition values.
// Every check closes its browser context in `finally`.
export default ({ ctx, go, hop, click, state, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const setP = (p, o) => p.evaluate((x) => window.__proto.set(x), o);
  const balances = (p, pid) => p.evaluate((x) => Proto.store.balances(x), pid);
  const code = (r) => (r && (r.ok ? 'ok' : r.code || null)) || null;
  const gates = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => r.dataset.code || null));
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const writesAfter = (p, seq) => p.evaluate((s) => window.__events.filter((e) => e.seq > s && e.kind === 'write').map((e) => e.table + ':' + e.id), seq);
  const fileEnc = (p, encId) => p.evaluate((e) => Proto.store.fileNote(e, { assessment: 'Recall exam; no new caries.', plan: 'Recall 6 months.' }, true), encId);
  const paint = async (p, t, sf, cdt) => { await click(p, 'enc.tooth.' + t); for (const x of sf) await click(p, 'enc.surface.' + t + '.' + x); await click(p, 'enc.proc.' + cdt); };

  return {
    // money-r4-1: the ERA rows Post matched wrote carried no pin, so allocate() handed Delta's money to a charge filed the same
    // day. Negative control: after Post matched, filing enc-9065 raises patientDue by the exam's patient share only, the new
    // charge waits on its own (Cigna) claim, and Explain never says Delta paid today's exam.
    async 'A-storm4-store-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const posted = await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        const b1 = await balances(p, 'p-308');
        await setP(p, { persona: 'owner' }); await hop(p, '#/owner/encounter/enc-9065');
        const paintRes = await p.evaluate(() => Proto.store.chartPaint('enc-9065', null, [], 'd0120', 'today'));
        const filed = await fileEnc(p, 'enc-9065');
        const b2 = await balances(p, 'p-308');
        const S = await state(p);
        const charge = S.ledger.find((e) => e.kind === 'charge' && e.patientId === 'p-308' && e.posted === S.tenant.today) || null;
        const claim = S.claims.find((x) => x.encounterId === 'enc-9065') || null;
        const explain = await p.evaluate(() => Proto.store.explain('p-308').map((x) => x.sentence));
        const examPaidByPlan = explain.some((x) => /Periodic exam on 9\/3\/2026.*Delta Dental paid/.test(x));
        const o = { posted, before: b1, paint: code(paintRes), filed: code(filed), after: b2, charge: charge && { id: charge.id, amountCents: charge.amountCents, insuranceExpectedCents: charge.insuranceExpectedCents }, claim: claim && { id: claim.id, status: claim.status, payer: claim.payer }, explain, examPaidByPlan };
        rec('A-storm4-store-1', 'After Post matched, filing enc-9065 (D0120 $65, plan share $32.50, claim c-100 scrubbed) raises p-308\'s Patient due by the full $65.00 with Waiting on insurance $0.00, and Explain reads "Periodic exam on 9/3/2026 … Delta Dental paid $32.50": the ERA row is pinned to no charge, so allocate() hands the 835\'s money to a charge filed the same day', 'store.js allocate() ("Insurer money stays on the charge it was paid against … only money no charge can claim floats"); docs/13 feature 23 (what waits on the plan is never called owed by the patient); store.js eraPostMatched / eraConfirm row shape',
          posted && filed.ok === true && !!charge && charge.insuranceExpectedCents === 3250 && !!claim && ((b2.patientDue - b1.patientDue) === 6500 || (b2.insurancePending === 0 && examPaidByPlan)), o);
      } finally { await c.close(); }
    },

    // money-r4-2 (store part): approvalSentence printed req.amountCents for a decided request whose posting settled to the balance,
    // so every screen that prints the sentence said $300.00 posted when $110.00 did. Negative control: for a decided request the
    // sentence (plain and redacted) carries postedCents.
    async 'A-storm4-store-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '300'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post');
        const o = await p.evaluate(() => {
          const req = window.__proto.state().approvals[0] || null; if (!req) return { request: null };
          window.__proto.set({ persona: 'frontdesk' });
          const paid = Proto.store.postCheckout('a-1047', { decision: 'collect', tender: 'cash', amountCents: 30000, selfPay: [], writeoffCents: 0, cadence: 'monthly', pin: null });
          const dec = Proto.store.decideApproval(req.id, 'u-dr-1', 'approved', { pin: '2468' });
          const r = window.__proto.state().approvals.find((a) => a.id === req.id);
          const wo = window.__proto.state().ledger.filter((e) => e.kind === 'write_off' && e.approvalRequestId === req.id).map((e) => e.amountCents);
          return { request: { id: r.id, status: r.status, amountCents: r.amountCents, postedCents: r.postedCents }, paid: paid.ok ? 'ok' : paid.code, decision: dec.ok ? 'ok' : dec.code, writeOffs: wo, sentence: Proto.store.approvalSentence(r), redacted: Proto.store.approvalSentence(r, { redact: true }) };
        });
        const saysRequested = !!o.sentence && /\$300\.00/.test(o.sentence) && !/\$110\.00/.test(o.sentence);
        const redactedSaysRequested = !!o.redacted && /\$300\.00/.test(o.redacted) && !/\$110\.00/.test(o.redacted);
        rec('A-storm4-store-2', 'ar-1 ($300 courtesy on p-306) approved after the window collected $300 settles to postedCents 11000 (one −$110 write_off row), yet Proto.store.approvalSentence(ar-1) reads "Write-off $300.00 …" in both its plain and redacted forms: the one sentence the phone, Money Desk and Daily Close print names the requested amount as what posted', 'FIX-ROUND4 one-rule-one-owner (approvalSentence prints what POSTED, req.postedCents, never the requested amount); brief category 2 (a number on screen that disagrees with the store); store.js decideApproval writes r.postedCents',
          !!o.request && o.request.status === 'approved' && o.request.postedCents === 11000 && o.writeOffs.length === 1 && o.writeOffs[0] === -11000 && (saysRequested || redactedSaysRequested), o);
      } finally { await c.close(); }
    },

    // money-r4-3 (store part): raiseStatement checked only unsent rows, so a statement sent today for the same balance did not stop a
    // second one. Negative control: after Raise → Send on p-306 a second raiseStatement refuses (or returns the sent row) and writes
    // no new statementsDue row.
    async 'A-storm4-store-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.tab.statements');
        const raised = await click(p, 'money.statement.p-306.raise'); await p.waitForTimeout(120);
        const first = await p.evaluate(() => (window.__proto.state().statementsDue.find((x) => x.patientId === 'p-306') || null));
        const sent = first ? await click(p, 'money.statement.' + first.id + '.send') : false; await p.waitForTimeout(120);
        const o = await p.evaluate((fid) => {
          const S0 = window.__proto.state(); const row = S0.statementsDue.find((x) => x.id === fid) || null;
          const n0 = S0.statementsDue.length;
          const again = Proto.store.raiseStatement('p-306');
          const S1 = window.__proto.state();
          return { firstRow: row && { id: row.id, sent: !!row.sent, amountCents: row.amountCents }, due: Proto.store.balances('p-306').patientDue, again: again.ok ? 'ok' : again.code, againRow: again.statement ? again.statement.id : null, control: again.control || null, newRows: S1.statementsDue.length - n0, rowsForP306: S1.statementsDue.filter((x) => x.patientId === 'p-306').map((x) => x.id + ':' + (x.sent ? 'sent' : 'open') + ':' + x.amountCents) };
        }, first && first.id);
        rec('A-storm4-store-3', 'After Raise statement → Send statement on Lena Fischer (sd-3 sent, $410 balance unchanged) Proto.store.raiseStatement(p-306) returns ok with a new statementsDue row (sd-4, $410) the same day: Money Desk can mail a second copy of the same balance while the Ledger\'s Send on the same account refuses already_decided', 'store.js sendStatement already_decided why ("A second copy of the same balance confuses the patient and the phone call that follows"); rail.js sendStatement comment (a row already sent is the store\'s to refuse, not a reason to raise a second one); brief category 3',
          raised && sent && !!o.firstRow && o.firstRow.sent && o.due === o.firstRow.amountCents && o.again === 'ok' && o.newRows > 0, o);
      } finally { await c.close(); }
    },

    // money-r4-5: the seeded ERA header's eftCents ($4,812.33) disagreed with what its 41 lines pay. Negative control: eftCents equals the
    // sum of the lines' paidCents, which is what the batch posts once every line is decided.
    async 'A-storm4-store-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const o = await p.evaluate(() => {
          const S = window.__proto.state(); const bt = S.eraBatches.find((x) => x.id === 'era-1');
          const lines = S.eraLines.filter((l) => l.batchId === 'era-1');
          const head = document.getElementById('canvas').textContent.replace(/\s+/g, ' ');
          return { eftCents: bt.eftCents, lines: lines.length, sumPaid: lines.reduce((a, l) => a + l.paidCents, 0), sumMatched: lines.filter((l) => l.status === 'matched').reduce((a, l) => a + l.paidCents, 0), headerEft: (head.match(/EFT \$[\d,]+\.\d\d/) || [null])[0] };
        });
        rec('A-storm4-store-4', 'era-1\'s header reads "EFT $4,812.33 · matched to bank line" while its 41 lines pay $21,385.00 and Post matched posts $20,423.00: the EFT the seed says was matched to the bank is a quarter of what the batch posts', 'brief category 2 (a number on screen that disagrees with the store\'s rows); docs/13 feature 27 (the batch\'s EFT, TRN and bank line reconcile to the lines posted); seed.js eraBatches era-1 eftCents',
          o.lines === 41 && o.sumPaid > 0 && o.eftCents !== o.sumPaid, o);
      } finally { await c.close(); }
    },

    // money-r4-6: c-72 / c-65 / c-51 billed procedures no ledger charge carried, so Aging said $1,180 out on Nico Iyer while his Ledger read
    // $0.00 everywhere. Negative control: each open seeded claim has a charge on its patient's ledger for its procedure and that
    // patient's Waiting on insurance is above zero.
    async 'A-storm4-store-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/ledger/p-315');
        const o = await p.evaluate(() => {
          const S = window.__proto.state();
          const open = S.claims.filter((x) => !x.encounterId && ['submitted', 'pended'].includes(x.status));
          return open.map((x) => { const ch = S.ledger.filter((e) => e.kind === 'charge' && e.patientId === x.patientId && e.cdt === x.cdt && (x.tooth == null || e.tooth === x.tooth)); return { id: x.id, patientId: x.patientId, status: x.status, cdt: x.cdt, amountCents: x.amountCents, charges: ch.map((e) => e.id + ':' + e.amountCents + ':' + e.insuranceExpectedCents), balances: Proto.store.balances(x.patientId) }; });
        });
        const orphans = o.filter((x) => !x.charges.length || x.balances.insurancePending === 0).map((x) => x.id);
        rec('A-storm4-store-5', 'Seeded open claims c-72 (p-315, D2740 $1,180), c-65 (p-318, D2392 $260) and c-51 (p-322, D4341 $285) bill procedures with no ledger charge on those patients, so Aging and the rail say a claim is out while the Ledger reads Waiting on insurance $0.00 and Explain never names the visit', 'brief category 2 (two screens disagreeing on one fact); docs/13 feature 23 (Waiting on insurance is what claims still out are expected to pay); seed.js claims vs ledger',
          o.length >= 3 && orphans.length > 0, { claims: o, orphans });
      } finally { await c.close(); }
    },

    // shared-day-r4-1: addDayPass overwrote S.tempUser, so only the newest pass's PIN verified while Roles listed both passes live.
    // Negative control: with two passes issued, the first pass's PIN opens its holder's session (no pin_no_match, no miss counted)
    // and the Roles rows carry the store's live state for each pass.
    async 'A-storm4-store-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles?device=shared');
        const issue = async (name) => { await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', name); await click(p, 'roles.daypass.save'); await p.waitForTimeout(150); return (/PIN (\d{4})/.exec(await p.evaluate(() => document.getElementById('canvas').textContent)) || [])[1] || null; };
        const pin1 = await issue('Alex Rivera'); const pin2 = await issue('Casey Morgan');
        const before = await p.evaluate(() => { const S = window.__proto.state(); return { passes: S.dayPasses.map((d) => d.id + ':' + d.name + ':' + (d.revokedAt || d.supersededBy ? 'ended' : 'live')), tempUser: S.tempUser && S.tempUser.name, rows: [...document.querySelectorAll('[data-testid^="roles.row.dp"]')].map((e) => e.closest('tr').textContent.replace(/\s+/g, ' ').trim().slice(0, 90)) }; });
        const seq0 = await lastSeq(p);
        await click(p, 'topbar.author'); for (const d of pin1 || '') await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(250);
        const padGates = await p.evaluate(() => [...document.querySelectorAll('#dialogs .refusal')].map((r) => r.dataset.code));
        const S = await state(p);
        const refusalEvents = (await p.evaluate((s) => window.__events.filter((e) => e.seq > s && e.kind === 'refusal').map((e) => e.code), seq0));
        const who = await p.evaluate(() => Proto.store.currentUser().name);
        const o = { pin1, pin2, before, padGates, misses: S.pinLock.misses, refusalEvents, authorAfter: who, persona: await p.evaluate(() => window.__proto.persona) };
        rec('A-storm4-store-6', 'With two day passes issued (dp-1 Alex Rivera PIN 8001, dp-2 Casey Morgan PIN 8002) and both listed live on Roles, the author pad refuses Alex\'s 8001 with pin_no_match and counts a miss toward the device lock: the store keeps only the newest pass as the temp identity', 'FIX-ROUND4 one-rule-one-owner (the store owns which day passes are live; verifyPin accepts every live pass); docs/04 ("A credential either opens a session or refuses"); CONTRACTS §4 roles.row.<dayPassId>; store.js addDayPass / verifyPin',
          pin1 === '8001' && pin2 === '8002' && before.passes.length === 2 && before.passes.every((x) => /live$/.test(x)) && (padGates.includes('pin_no_match') || refusalEvents.includes('pin_no_match') || S.pinLock.misses > 0), o);
      } finally { await c.close(); }
    },

    // walks-clinical-r4-1: chartUndo dropped the LAST note line whatever paint it reversed. Negative control: undoing the first of
    // three paints (through the duplicate gate's "Undo the first one") leaves the note naming exactly the two live paints.
    async 'A-storm4-store-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await paint(p, 30, ['d', 'o'], 'd2392'); await paint(p, 19, ['o'], 'd2392'); await paint(p, 3, ['m'], 'd2392');
        const noteBefore = await p.evaluate(() => (window.__proto.state().notes['enc-9002'] || {}).procedure || '');
        await paint(p, 30, ['d', 'o'], 'd2392');
        const dup = (await gates(p)).includes('duplicate_paint');
        const undone = await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const S = await state(p);
        const live = S.chartEvents.filter((x) => x.encounterId === 'enc-9002' && !x.reversed && x.kind !== 'reversal').map((x) => x.tooth);
        const note = (S.notes['enc-9002'] || {}).procedure || '';
        const screen = await p.evaluate(() => (document.querySelector('.enc-readonly') || {}).textContent || '');
        const o = { noteBefore, duplicateGate: dup, undone, liveTeeth: live, noteAfter: note, screen };
        rec('A-storm4-store-7', 'Three D2392 paints (#30 DO, #19 O, #3 M), repaint #30 DO → duplicate_paint → "Undo the first one" reverses ce-1 but the note reads "… #30 DO; … #19 O" while the live chart is #19 O and #3 M: chartUndo withdraws the last note line, not the line the named paint appended', 'docs/13 feature 10 (Undo reverses only what the paint wrote: the note line withdrawn); CONTRACTS §7 flow 3 (chart, note and claim name the same procedures); store.js chartUndo',
          /#3 M/.test(noteBefore) && dup && undone && live.length === 2 && !live.includes(30) && (/#30 DO/.test(note) || !/#3 M/.test(note) || /#30 DO/.test(screen)), o);
      } finally { await c.close(); }
    },

    // walks-clinical-r4-2: chartUndo carried no clinician / pass gate, so the front desk and a pass-less temp reversed the dentist's paint.
    // Negative control: each press of enc.undo renders the store's refusal (licence_scope / entitlement) and writes no reversal row.
    async 'A-storm4-store-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740'); await p.waitForTimeout(100);
        const painted = (await state(p)).chartEvents.filter((x) => x.encounterId === 'enc-9002').length;
        const tryUndo = async (persona) => {
          await setP(p, { persona }); await hop(p, '#/' + persona + '/encounter/enc-9002'); await p.waitForTimeout(120);
          const ownPaint = await p.evaluate(() => Proto.store.chartPaint('enc-9002', 3, ['o'], 'd2392', 'today').code || 'ok');
          const seq0 = await lastSeq(p);
          const pressed = await click(p, 'enc.undo'); await p.waitForTimeout(150);
          const S = await state(p);
          return { persona, who: await p.evaluate(() => Proto.store.currentUser().name), ownPaint, pressed, gates: await gates(p), writes: await writesAfter(p, seq0), reversals: S.chartEvents.filter((x) => x.kind === 'reversal').map((x) => x.id + ' by ' + x.author), reversedProcs: S.procedures.filter((x) => x.encounterId === 'enc-9002' && x.reversed).map((x) => x.id) };
        };
        const fd = await tryUndo('frontdesk');
        const temp = await tryUndo('temp');
        const reversed = (r) => r.pressed && r.ownPaint !== 'ok' && (r.reversals.length > 0 || r.writes.some((w) => /^chartEvents:/.test(w)) || !r.gates.length);
        rec('A-storm4-store-8', 'After Dr. Kim paints D2740 #19 on enc-9002, the front-desk persona (own paint refused licence_scope) and a pass-less temp (own paint refused entitlement) each press Undo last paint and reverse the dentist\'s paint with no refusal: a reversal chart event authored "Priya Raman" / "No day pass issued" is written', 'store.js clinician() rule (charting is clinical work under a licence; a pass-less temp is nobody); docs/13 feature 30 ("No day pass issued" is not an author); brief category 3 (an irreversible verb that acts when it should refuse); store.js chartUndo vs chartPaint',
          painted === 1 && fd.ownPaint === 'licence_scope' && temp.ownPaint === 'entitlement' && (reversed(fd) || reversed(temp)), { painted, frontdesk: fd, temp });
      } finally { await c.close(); }
    },
  };
};
