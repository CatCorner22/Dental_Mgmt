// Round-3 fix-storm checks for the store owner: prototype/js/store.js, seed.js and the task scripts under scripts/beta/tasks.
// Each check names the round-3 finding it guards, drives the store verb the rule belongs to (through the screen where the
// breach was seen), and measures the breach; default position is NOT reproduced and every check carries its precondition
// values. Every check closes its browser context in `finally`.
export default ({ ctx, go, hop, click, state, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const setP = (p, o) => p.evaluate((x) => window.__proto.set(x), o);
  const balances = (p, pid) => p.evaluate((x) => Proto.store.balances(x), pid);
  const rows = (S, pid) => S.ledger.filter((e) => e.patientId === pid);
  const net = (S, pid) => rows(S, pid).reduce((t, e) => t + e.amountCents, 0);
  const code = (r) => (r && (r.ok ? 'ok' : r.code || (r.needsStepup ? 'needsStepup' : null))) || null;
  const fileEnc = (p, encId) => p.evaluate((e) => Proto.store.fileNote(e, { assessment: 'Recall exam; no new caries.', plan: 'Recall 6 months.' }, true), encId);
  const task = async (file, id) => { const fs = await import('node:fs'); const T = JSON.parse(fs.readFileSync(new URL('../tasks/' + file, import.meta.url), 'utf8')); return { start: T.start, task: T.tasks.find((t) => t.id === id) }; };
  const isTestid = (s) => /^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(s);

  return {
    // money-r3-1: decideApproval wrote the write-off without re-reading the balance, so a $410 request approved after the
    // window collected the $410 posted −$410 on a $0 account. Negative control: the approval refuses (or settles to the
    // live balance) and the ledger never nets negative.
    async 'A-storm3-store-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', '410'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post');
        const reqId = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).id || null);
        const paid = await p.evaluate(() => Proto.store.postCheckout('a-1047', { decision: 'collect', tender: 'cash', amountCents: 41000, selfPay: [], writeoffCents: 0, cadence: 'monthly', pin: null }));
        const due = (await balances(p, 'p-306')).patientDue;
        const dec = await p.evaluate((id) => (id ? Proto.store.decideApproval(id, 'u-dr-1', 'approved', { pin: '2468' }) : null), reqId);
        const S = await state(p);
        const wo = rows(S, 'p-306').filter((e) => e.kind === 'write_off' && e.approvalRequestId === reqId).map((e) => e.amountCents);
        const o = { requestId: reqId, collected: code(paid), patientDueBeforeDecision: due, decision: code(dec), writeOffsFromApproval: wo, netAfter: net(S, 'p-306'), balances: await balances(p, 'p-306') };
        rec('A-storm3-store-1', 'ar-1 ($410 courtesy on p-306) is approved with Dr. Reagan\'s PIN after the window collected the full $410: a −$410 write_off row posts on a $0 account and the ledger nets −$410 (Credit $410.00)', 'store.js writeoffCap (a write-off retires what the patient owes and no more) applied at posting time; docs/13 feature 23; store.js decideApproval',
          !!reqId && paid.ok === true && due === 0 && (dec.ok === true || wo.length > 0 || o.netAfter < 0), o);
      } finally { await c.close(); }
    },

    // money-r3-2: allocate() handed the 8/2 and 8/20 insurer payments on p-303 to today's charges once enc-9003 filed, re-opening
    // the paid 7/14 SRP for $217. Negative control: after File the SRP still reads paid in full and patientDue is the $44 share.
    async 'A-storm3-store-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        const b0 = await balances(p, 'p-303');
        const filed = await fileEnc(p, 'enc-9003');
        const b1 = await balances(p, 'p-303');
        const srp = await p.evaluate(() => (Proto.store.explain('p-303').find((x) => /^SRP/.test(x.sentence)) || {}).sentence || null);
        const o = { before: b0, filed: code(filed), after: b1, srpSentence: srp };
        rec('A-storm3-store-2', 'Filing enc-9003 turns p-303 from Patient due $0.00 into $261.00: the insurer payments that settled the 7/14 SRP are re-allocated to today\'s charges and the SRP reads "you owe $217.00"', 'docs/13 feature 23 (what waits on the plan is never called owed by the patient); CONTRACTS §7 flow 4 (File enc-9003 then Collect $44); store.js allocate()',
          b0.patientDue === 0 && filed.ok === true && (b1.patientDue !== 4400 || /you owe/.test(srp || '')), o);
      } finally { await c.close(); }
    },

    // money-r3-3 (store part): the Checkout pendingRequest carried no poster, so on a shared desk Dr. Reagan's PIN raised a request
    // in Priya's name and Dr. Reagan approved his own request. Negative control: requestedById is the PIN's owner and his own
    // approval refuses blocked_same_person.
    async 'A-storm3-store-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047?device=shared');
        const o = await p.evaluate(() => {
          const persona = Proto.store.currentUser().id;
          const post = Proto.store.postCheckout('a-1047', { decision: 'collect', tender: 'cash', amountCents: 21000, selfPay: [], writeoffCents: 20000, writeoffReason: 'courtesy', cadence: 'monthly', pin: '2468' });
          const req = post.pendingRequest ? Proto.store.requestApproval(post.pendingRequest) : null;
          const row = req && req.ok ? window.__proto.state().approvals.find((a) => a.id === req.requestId) : null;
          const dec = row ? Proto.store.decideApproval(row.id, 'u-dr-1', 'approved', { pin: '2468' }) : null;
          return { persona, gate: post.code, pendingRequest: !!post.pendingRequest, requestedById: row && row.requestedById, requestedBy: row && row.requestedBy, ownApproval: dec && (dec.ok ? 'ok' : dec.code) };
        });
        rec('A-storm3-store-3', 'On a shared desk the request Checkout raises after Dr. Reagan\'s PIN 2468 names Priya Raman (requestedById u-fd-1), so Dr. Reagan approves his own write-off: blocked_same_person never fires', 'store.js shared-desk rule (the PIN names the poster) and decideApproval blocked_same_person; Money Desk requestWriteoff passes poster(u); store.js postCheckout pendingRequest, requestApproval',
          o.persona === 'u-fd-1' && o.gate === 'needs_second' && o.pendingRequest && (o.requestedById !== 'u-dr-1' || o.ownApproval === 'ok'), o);
      } finally { await c.close(); }
    },

    // money-r3-4: Daily Close verbs posted on a shared device with no PIN while every other posting verb refused pin_required.
    // Negative control: closeDay, matchVariance, clearVariance and reviewDecision each refuse pin_required without extras.pin and
    // post with the owner's PIN.
    async 'A-storm3-store-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close?device=shared');
        const o = await p.evaluate(() => {
          const shared = window.__proto.device;
          const bare = { close: Proto.store.closeDay('loc-1'), match: Proto.store.matchVariance('v-1'), review: Proto.store.reviewDecision('d-1', 'keep') };
          const S = window.__proto.state();
          const money = Proto.store.eraPostMatched('era-1');
          return { device: shared, results: Object.fromEntries(Object.entries(bare).map(([k, v]) => [k, v.ok ? 'ok' : v.code])), rows: [S.dayCloses.filter((d) => d.date === S.tenant.today).length, S.reconciliationMatches.length, S.controlDecisions.length], sessions: S.sessions.length, moneyDesk: money.ok ? 'ok' : money.code };
        });
        rec('A-storm3-store-4', 'At #/owner/close?device=shared Close day, Match and Keep post with no PIN (dayCloses, reconciliationMatches and controlDecisions rows frozen to the persona, no session) while Money Desk on the same device refuses pin_required', 'store.js shared-desk rule ("One rule for every posting verb: the PIN is matched against the accounts"); CONTRACTS §4 money.pin/checkout.pin/ledger.pin; store.js closeDay, matchVariance, clearVariance, reviewDecision',
          o.device === 'shared' && o.moneyDesk === 'pin_required' && Object.values(o.results).some((x) => x === 'ok'), o);
      } finally { await c.close(); }
    },

    // money-r3-5: a payment posted after the location's day closed carried no mark, so Daily Close's "Postings into closed days"
    // count never moved. Negative control: the row carries postedAfterClose and closedDayId (the seed's own shape).
    async 'A-storm3-store-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const o = await p.evaluate(() => {
          const closed = Proto.store.closeDay('loc-1');
          window.__proto.set({ persona: 'frontdesk' });
          const paid = Proto.store.postCheckout('a-1046', { decision: 'collect', tender: 'cash', amountCents: 16800, selfPay: [], writeoffCents: 0, cadence: 'monthly', pin: null });
          const S = window.__proto.state();
          const dc = S.dayCloses.find((d) => d.locationId === 'loc-1' && d.date === S.tenant.today) || null;
          const pay = S.ledger.find((e) => e.kind === 'patient_payment' && e.patientId === 'p-305' && e.posted === S.tenant.today) || null;
          const late = S.ledger.filter((e) => e.postedAfterClose && e.actorKind !== 'worker').length;
          return { closed: closed.ok ? closed.dayClose.id : closed.code, paid: paid.ok ? 'ok' : paid.code, dayClose: dc && { id: dc.id, totals: dc.totals }, row: pay && { id: pay.id, locationId: pay.locationId, posted: pay.posted, postedAfterClose: pay.postedAfterClose || null, closedDayId: pay.closedDayId || null }, lateRows: late };
        });
        rec('A-storm3-store-5', 'After Dr. Reagan closes Main Street for 9/3, Checkout posts a $168 cash payment at loc-1 dated 9/3 with no postedAfterClose mark and no closedDayId: the closed day\'s frozen totals drift from the ledger and Daily Close\'s "Postings into closed days" stays at the seeded 1', 'store.js closeDay already_closed why ("A closed day never changes in place"); seed.js late posting shape (postedAfterClose, closedDayId); dailyclose.js lateRows; store.js ledger writes',
          !!o.dayClose && o.paid === 'ok' && !!o.row && (!o.row.postedAfterClose || !o.row.closedDayId), o);
      } finally { await c.close(); }
    },

    // money-r3-6: Money Desk verbs carried no pass or entitlement rule, so a temp with no pass and a hygienist posted 37 ERA rows and
    // a write-off. Negative control: each refuses entitlement (Open Roles for the pass-less temp) and writes nothing.
    async 'A-storm3-store-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/money');
        const run = () => p.evaluate(() => { const u = Proto.store.currentUser(); const n0 = window.__proto.state().ledger.length; const r = { era: Proto.store.eraPostMatched('era-1'), writeoff: Proto.store.requestWriteoff('p-306', 5000, 'courtesy'), statement: Proto.store.raiseStatement('p-306') }; const S = window.__proto.state(); return { who: u.name, entitlements: u.entitlements, noPass: !!u.noPass, results: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.ok ? 'ok' : v.code])), controls: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.control || null])), rowsWritten: S.ledger.length - n0, actors: [...new Set(S.ledger.slice(n0).map((e) => e.actor))] }; });
        const temp = await run();
        await p.evaluate(() => window.__proto.reset());
        await setP(p, { persona: 'hygienist' }); await hop(p, '#/hygienist/money');
        const hyg = await run();
        rec('A-storm3-store-6', 'As #/temp/money with no day pass ("No day pass issued", entitlements []) and as hygienist Bree Lawson (entitlements []), Post matched writes 37 insurance_payment rows and the write-off card posts $50 on p-306 under those names, while Checkout refuses both with entitlement', 'store.js NO_PASS rule and one entitlement rule needs(u, …) applied by postCheckout; seed grants post_era / write_off to the biller seat; store.js eraPostMatched, requestWriteoff, raiseStatement',
          temp.noPass && (hyg.entitlements || []).length === 0 && (Object.values(temp.results).some((x) => x === 'ok') || Object.values(hyg.results).some((x) => x === 'ok') || temp.rowsWritten > 0 || hyg.rowsWritten > 0), { temp, hygienist: hyg });
      } finally { await c.close(); }
    },

    // money-r3-9: postCheckout wrote statementsDue / paymentPlans / collectionDecisions from est.patientCents, ignoring the write-off
    // posted in the same transaction ($410 statement on a $310 balance). Negative control: the rows carry the post-write-off amount.
    async 'A-storm3-store-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        const o = await p.evaluate(() => {
          const est = Proto.store.windowEstimate('a-1047').patientCents;
          const res = Proto.store.postCheckout('a-1047', { decision: 'send_statement', tender: null, amountCents: 0, selfPay: [], writeoffCents: 10000, writeoffReason: 'courtesy', cadence: 'monthly', pin: null });
          const S = window.__proto.state();
          const sd = S.statementsDue[S.statementsDue.length - 1]; const cd = S.collectionDecisions[S.collectionDecisions.length - 1];
          return { estimate: est, post: res.ok ? 'ok' : res.code, balances: Proto.store.balances('p-306'), statement: sd && { id: sd.id, patientId: sd.patientId, amountCents: sd.amountCents }, decision: cd && { decision: cd.decision, patientPortionCents: cd.patientPortionCents } };
        });
        rec('A-storm3-store-7', 'Send statement + $100 courtesy write-off on a-1047 leaves Patient due $310.00 but writes statementsDue amountCents 41000 and collectionDecisions patientPortionCents 41000: a $410 statement queued on a $310 balance', 'docs/13 feature 23 (numbers on screen come from ledger rows); Posted card read-back must match the three numbers; store.js postCheckout',
          o.estimate === 41000 && o.post === 'ok' && o.balances.patientDue === 31000 && !!o.statement && o.statement.patientId === 'p-306' && (o.statement.amountCents !== 31000 || o.decision.patientPortionCents !== 31000), o);
      } finally { await c.close(); }
    },

    // clinical-day-r3-1: windowEstimate pinned patientCents to a.balanceCents (0) when no seeded estimate existed, so a visit charted
    // and filed today was un-collectable at the window. Negative control: after File the estimate is the released charges' patient
    // share ($130) and Collect posts.
    async 'A-storm3-store-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const o = await p.evaluate(() => {
          const paint = Proto.store.chartPaint('enc-9002', 30, ['d', 'o'], 'd2392', 'today');
          const filed = Proto.store.fileNote('enc-9002', { assessment: 'Caries #30 DO.', plan: 'Composite placed.' }, true);
          const bal = Proto.store.balances('p-302');
          const est = Proto.store.windowEstimate('a-1043');
          window.__proto.set({ persona: 'frontdesk' });
          const collect = Proto.store.postCheckout('a-1043', { decision: 'collect', tender: 'card', amountCents: bal.patientDue, selfPay: [], writeoffCents: 0, cadence: 'monthly', pin: null });
          return { paint: paint.ok, filed: filed.ok ? 'ok' : filed.code, balances: bal, estimate: est, collect: collect.ok ? 'ok' : collect.code, seededEstimate: !!window.__proto.state().estimates['a-1043'] };
        });
        rec('A-storm3-store-8', 'After Dr. Kim files enc-9002 (D2392 #30 DO, $260, plan estimate $130 patient) balances(p-302).patientDue is 13000 yet windowEstimate(a-1043).patientCents is 0 and postCheckout collect refuses zero_collect_refused: a visit charted and filed today with no seeded estimate cannot be collected at the window', 'docs/13 feature 1 (Checkout collects the patient portion of today\'s released charges); docs/04 one canonical view per fact; store.js windowEstimate()',
          o.paint && o.filed === 'ok' && !o.seededEstimate && o.balances.patientDue === 13000 && (o.estimate.patientCents !== 13000 || o.collect !== 'ok'), o);
      } finally { await c.close(); }
    },

    // clinical-day-r3-2 / shell-owner-r3-4: openSession looked up S.users only, so the day-pass holder's PIN verified and then refused
    // notfound. Negative control: openSession('u-temp') opens the pass holder's session and user('u-temp') resolves the holder.
    async 'A-storm3-store-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles?device=shared');
        const o = await p.evaluate(() => {
          const dp = Proto.store.addDayPass({ name: 'Alex Rivera', role: 'rdh', location: 'loc-1', end: '17:00', extra: [] }, null);
          const tu = Proto.store.get().tempUser || null;
          const v = tu ? Proto.store.verifyPin(tu.pin) : null;
          const opened = v && v.ok ? Proto.store.openSession(v.user.id) : null;
          const S = window.__proto.state();
          return { pass: dp.ok ? dp.dayPass.id : dp.code, pin: tu && tu.pin, verify: v && (v.ok ? v.user.id : v.code), user: (Proto.store.user('u-temp') || {}).name || null, opened: opened && (opened.ok ? 'ok' : opened.code), sessions: S.sessions.map((x) => x.userId + ':' + x.actor) };
        });
        rec('A-storm3-store-9', 'The day-pass PIN Roles just minted verifies to u-temp but openSession(u-temp) refuses notfound ("Open request from a list"), so the pad cannot switch the author to the pass holder on any clinical or Board screen', 'CONTRACTS §6 (notfound never renders through the Refusal component); docs/13 feature 30 (the pass is the identity every record is frozen onto); store.js openSession, user()',
          !!o.pin && o.verify === 'u-temp' && (o.opened !== 'ok' || !o.user), o);
      } finally { await c.close(); }
    },

    // clinical-day-r3-4 (store part): noteKillers offered the hygienist "Add an assessment" ahead of her Send killer, a control that
    // lands on a readonly dentist-only field. Negative control: for a non-dentist author the send killer comes first and the
    // assessment killer is not offered.
    async 'A-storm3-store-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/encounter/enc-9001');
        const o = await p.evaluate(() => { const u = Proto.store.currentUser(); const k = Proto.store.noteKillers('enc-9001', { assessment: '', plan: '' }); return { author: u.name, role: u.role, killers: k.map((x) => x.code + ' | ' + x.verb + ' | ' + x.control) }; });
        const codes = o.killers.map((k) => k.split(' | ')[0]);
        rec('A-storm3-store-10', 'On the hygienist\'s encounter noteKillers lists assessment_required ("Add an assessment") before the licence_scope send killer, although the hygienist cannot write the assessment (dentist only): the first control shown is one she cannot use', 'CONTRACTS §6 (a refusal\'s control resolves the refusal); docs/13 flow 2 hand-off (hygienist sends, dentist assesses); store.js noteKillers',
          o.role === 'hygienist' && codes.includes('licence_scope') && (codes.includes('assessment_required') && codes.indexOf('assessment_required') < codes.indexOf('licence_scope')), o);
      } finally { await c.close(); }
    },

    // clinical-day-r3-5: the claims row fileNote wrote carried no tooth while the seeded claims and the released charge do. Negative
    // control: the claim carries the first line's tooth (the seeded shape) and its lines name every released procedure.
    async 'A-storm3-store-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/surgeon/encounter/enc-9020');
        const o = await p.evaluate(() => {
          const a = Proto.store.chartPaint('enc-9020', 17, [], 'd7210', 'today'); const b2 = Proto.store.chartPaint('enc-9020', null, [], 'd9243', 'today');
          const filed = Proto.store.fileNote('enc-9020', { assessment: 'Impacted #17; IV sedation.', plan: 'Post-op review 1 week.' }, true);
          const S = window.__proto.state();
          const cl = S.claims.find((x) => x.encounterId === 'enc-9020') || null;
          const charge = S.ledger.find((e) => e.kind === 'charge' && e.cdt === 'd7210' && e.patientId === 'p-320') || null;
          return { paints: [a.ok, b2.ok], filed: filed.ok ? 'ok' : filed.code, claim: cl && { id: cl.id, cdt: cl.cdt, tooth: 'tooth' in cl ? cl.tooth : 'absent', lines: cl.lines }, chargeTooth: charge && charge.tooth, seededWithTooth: S.claims.filter((x) => !x.encounterId && 'tooth' in x).length };
        });
        rec('A-storm3-store-11', 'After the surgeon files D7210 #17 + D9243 on enc-9020 the claims row is {cdt d7210, lines [d7210, d9243]} with no tooth while the released charge carries tooth 17 and every seeded claim carries tooth: a tooth-specific extraction claim leaves the chart without its tooth', 'docs/03 data model (claim lines carry the procedure\'s tooth; Money Desk prints #tooth); CONTRACTS §7 flow 3 (chart, note and claim name the same tooth); store.js fileNote claims write',
          o.filed === 'ok' && !!o.claim && o.chargeTooth === 17 && o.seededWithTooth > 0 && o.claim.tooth !== 17, o);
      } finally { await c.close(); }
    },

    // clinical-day-r3-6: hy-6 targeted a-1042 after hy-2 sealed its exam (exam_sealed), and os-3 offered Dana's PIN, which has no
    // chart persona (no_chart_session). Negative control: hy-6's card is a visit with no exam after hy-2 and its screening saves;
    // os-3 names charting PINs only.
    async 'A-storm3-store-12'(b) {
      const { c, p } = await ctx(b);
      try {
        const hy = await task('hygienist.json', 'hy-6'); const os = await task('oral_surgeon.json', 'os-3');
        await go(p, '#/hygienist/perio/enc-9001');
        await p.keyboard.type('3'.repeat(168), { delay: 0 }); await click(p, 'perio.save'); await p.waitForTimeout(150);
        const sealed = (await state(p)).perioExams.filter((e) => e.encounterId === 'enc-9001').length;
        await hop(p, hy.start);
        const card = hy.task.steps.find((s) => /^chairs\.card\..*\.perio$/.test(s)) || null;
        const opened = card ? await click(p, card) : false;
        const screening = await click(p, 'perio.screening'); await p.waitForTimeout(120);
        const gate = await p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => r.dataset.code));
        for (const k of ['1', '2', '3', '2', '1', '0']) await p.keyboard.press(k);
        await click(p, 'perio.save'); await p.waitForTimeout(150);
        const S = await state(p);
        const target = card ? S.appointments.find((a) => a.id === card.split('.')[2]) : null;
        const screened = target ? S.perioExams.filter((e) => e.encounterId === target.encounterId && e.mode === 'screening').length : 0;
        const dana = (os.task.steps || []).some((s) => /pin\.key\.4\b/.test(s));   // Dana's 4444 offered as a step to press
        const o = { hy6Card: card, opened, screening, gateAfterScreening: gate, examsOnEnc9001AfterHy2: sealed, screeningExams: screened, os3Steps: os.task.steps, os3NamesDana: dana };
        rec('A-storm3-store-12', 'Task hy-6 (screening lane) targets a-1042 after hy-2 saved its full chart, so perio.screening meets exam_sealed and no screening exam can save; os-3 offers Dana\'s PIN 4444, which the pad refuses no_chart_session', 'scripts/beta/tasks/hygienist.json hy-6 and oral_surgeon.json os-3 against store.js exam_sealed and shell.js no_chart_session; brief category 5 (a task-script step that cannot run on its path)',
          sealed === 1 && !!card && opened && (gate.includes('exam_sealed') || screened === 0 || dana), o);
      } finally { await c.close(); }
    },

    // shell-owner-r3-10: the Daily Close entitlement gate's control "Send to Dana or the CPA" sent nothing — it opened the phone where
    // the same person is "not an approver". Negative control: the store's control is a word a screen acts on (Open Roles).
    async 'A-storm3-store-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/close');
        const o = await p.evaluate(() => { const u = Proto.store.currentUser(); const m = Proto.store.matchVariance('v-1'); const k = Proto.store.reviewDecision('d-1', 'keep'); return { who: u.name, entitlements: u.entitlements, match: { code: m.code, control: m.control }, keep: { code: k.code, control: k.control } }; });
        rec('A-storm3-store-13', 'For the biller, matchVariance and reviewDecision refuse entitlement with the control "Send to Dana or the CPA", a word that sends nothing: the screen can only open the phone, where Sam Dawson reads "not an approver"', 'CONTRACTS §6 (the control does what its label says; a refusal with nowhere to go is a dead end); store.js reconciles()',
          o.match.code === 'entitlement' && o.keep.code === 'entitlement' && (/^Send to/.test(o.match.control || '') || /^Send to/.test(o.keep.control || '')), o);
      } finally { await c.close(); }
    },
  };
};
