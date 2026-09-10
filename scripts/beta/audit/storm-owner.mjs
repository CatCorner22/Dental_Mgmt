// Audit checks for the storm-owner chunk: defects the beta storm confirmed live on Daily Close / Practice risk
// (dailyclose.js), Roles (roles.js) and the approver's phone card (phone.js). Default position is NOT reproduced:
// every check measures the breach it claims, carries the precondition values in its evidence, and closes its
// context in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const since = async (p, seq, kind) => (await events(p)).filter((e) => e.seq > seq && (!kind || e.kind === kind)).map((e) => ({ seq: e.seq, kind: e.kind, code: e.code, table: e.table, id: e.id, testid: e.testid }));
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() })));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName; });
  const live = (p) => p.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent.trim()).join('|'));
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid')));
  const fill = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.waitForTimeout(60); return true; };
  const words = (v) => String(v || '').trim().split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;
  const badVerb = (v) => words(v) > 8 || /\.$/.test(String(v || '').trim()) || /^(Licence|Deposit|Pocket)\b/.test(String(v || '').trim());
  const heldWriteoff = async (p) => { await go(p, '#/biller/money'); await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150); };
  const asPersona = (p, persona) => p.evaluate((x) => window.__proto.set({ persona: x }), persona);

  return {
    // dailyclose.js varianceCard/decisions(): Match these and Keep 90 more days ignored res.ok === false, so under
    // ?outage=1 the press changed nothing and said nothing. Negative control: a compliant press renders one gate with
    // code outage and logs one refusal event; here rows stay unchanged AND no gate is rendered or logged.
    async 'A-storm-owner-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close?outage=1'); await click(p, 'close.tied.tile');
        const seq = await lastSeq(p);
        const pressedMatch = await click(p, 'close.variance.v-1.match');
        const afterMatch = { refusals: await refusals(p), events: await since(p, seq, 'refusal') };
        const seq2 = await lastSeq(p);
        const pressedKeep = await click(p, 'close.decision.d-1.keep');
        const afterKeep = { refusals: await refusals(p), events: await since(p, seq2, 'refusal') };
        const S = await state(p);
        const o = { outage: S.outage, pressedMatch, pressedKeep, variance: S.variances[0].status, decision: S.decisions[0].status, afterMatch, afterKeep };
        const silentMatch = pressedMatch && o.variance === 'open' && !afterMatch.refusals.some((x) => x.code === 'outage') && !afterMatch.events.length;
        const silentKeep = pressedKeep && o.decision === 'review_due' && !afterKeep.refusals.some((x) => x.code === 'outage') && !afterKeep.events.length;
        rec('A-storm-owner-1', 'During an outage, Match these and Keep 90 more days are live controls that do nothing when pressed: the store refuses, the screen renders no gate and logs no refusal', 'docs/01 principle 11; CONTRACTS §6 (dailyclose.js varianceCard match, decisions() act)', S.outage === true && (silentMatch || silentKeep), o);
      } finally { await c.close(); }
    },

    // phone.js state.submit: a request decided by Dana while the PIN pad is open gets already_decided from the store,
    // but the card it would render on is no longer pending, so nothing renders and focus drops to BODY. Negative
    // control: a compliant screen shows the gate on the decided card, logs the refusal, and focuses its control.
    async 'A-storm-owner-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate'); await click(p, 'phone.request.ar-1.approve');
        await p.keyboard.type('2468'); await p.waitForTimeout(60);
        // Dana's own PIN, read from state: the step-up verifies the approver's PIN (store.js verifyPin(pin, approver.id)).
        const raced = await p.evaluate(() => Proto.store.decideApproval('ar-1', 'u-om-1', 'approved', { pin: (window.__proto.state().users.find((u) => u.id === 'u-om-1') || {}).pin }));
        const seq = await lastSeq(p);
        await p.keyboard.press('Enter'); await p.waitForTimeout(250);
        const o = { raced, decidedBy: (await state(p)).approvals[0].decidedBy, refusals: await refusals(p), refusalEvents: await since(p, seq, 'refusal'), focused: await focused(p) };
        rec('A-storm-owner-2', 'When the request is decided by another approver while the PIN pad is open, submitting the PIN renders no refusal, logs none, and drops focus to BODY', 'CONTRACTS §6 already_decided; docs/13 feature 24 (phone.js state.submit, decidedCard)', raced.ok === true && o.decidedBy === 'Dana Whitfield' && (!o.refusals.some((x) => x.code === 'already_decided') || !o.refusalEvents.length || o.focused === 'BODY'), o);
      } finally { await c.close(); }
    },

    // dailyclose.js closeDaySection/varianceCard: 'Open the day' (already_closed) and 'Support line' (outage) had no
    // handler. Negative control: a press changes route, focus (to something other than the control), state, canvas
    // or live text; both must be dead for the check to report true.
    async 'A-storm-owner-3'(b) {
      const { c, p } = await ctx(b);
      try {
        const SNAP = () => ({ hash: location.hash, focus: (document.activeElement.getAttribute && document.activeElement.getAttribute('data-testid')) || document.activeElement.tagName, dom: document.getElementById('canvas').innerHTML.length, st: JSON.stringify(window.__proto.state()).length, live: [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent.trim()).join('|'), tile: (document.querySelector('[data-testid="close.tied.tile"]') || {}).getAttribute ? document.querySelector('[data-testid="close.tied.tile"]').getAttribute('aria-expanded') : null });
        const dead = async () => { const before = await p.evaluate(SNAP); await click(p, 'refusal.control'); await p.waitForTimeout(200); const after = await p.evaluate(SNAP); return { before, after, changed: before.hash !== after.hash || (before.focus !== after.focus && after.focus !== 'refusal.control') || before.dom !== after.dom || before.st !== after.st || before.live !== after.live }; };
        await go(p, '#/owner/close'); await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await click(p, 'close.closeday'); await p.waitForTimeout(120);
        const closed = { gate: (await refusals(p))[0] || null, press: await dead() };
        await go(p, '#/owner/close?outage=1'); await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(120);
        const outage = { gate: (await refusals(p))[0] || null, press: await dead() };
        const o = { closed, outage };
        const ok = closed.gate && closed.gate.code === 'already_closed' && outage.gate && outage.gate.code === 'outage';
        rec('A-storm-owner-3', 'Refusal controls on Daily Close are dead ends: "Open the day" after a second Close day press and "Support line" under outage change no route, focus, state, canvas or live text', 'CONTRACTS §6 (a refusal with nowhere to go is a dead end); docs/01 principle 11 (dailyclose.js closeDaySection)', !!ok && (!closed.press.changed || !outage.press.changed), o);
      } finally { await c.close(); }
    },

    // roles.js doSave: the store's outage gate got onControl → rerender(r, 'roles.sod.remediate'), a control that is
    // not on the page, so the press removed the gate and dropped focus to BODY. Negative control: the gate stays or
    // focus lands on a real control, and the support line is announced.
    async 'A-storm-owner-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles?outage=1'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan');
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(150);
        const gate = (await refusals(p))[0] || null;
        const live0 = await live(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const o = { gate, focused: await focused(p), gateAfter: (await refusals(p))[0] || null, liveChanged: (await live(p)) !== live0 };
        rec('A-storm-owner-4', 'On Roles the outage gate\'s Support line control dismisses the gate and drops focus to BODY instead of doing what its label says', 'CONTRACTS §6; docs/01 principle 11 (roles.js doSave onControl)', !!gate && gate.code === 'outage' && (o.focused === 'BODY' || (!o.gateAfter && !o.liveChanged)), o);
      } finally { await c.close(); }
    },

    // roles.js buildPreview: verb: c.fraudPath put the seed's fraud sentences on the verb line (12 words, periods,
    // noun-first). Negative control: every sod_conflict verb on the page and in the log is verb-first, ≤ 8 words, no
    // terminal period; the check needs the three gates to have rendered before it scores.
    async 'A-storm-owner-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan');
        for (const e of ['refund', 'write_off', 'prepare_deposit']) await click(p, 'roles.daypass.entitlement.' + e);
        await p.waitForTimeout(150);
        const gates = (await refusals(p)).filter((x) => x.code === 'sod_conflict');
        const logged = (await events(p)).filter((e) => e.kind === 'refusal' && e.code === 'sod_conflict').map((e) => e.verb);
        const o = { gates, logged, badOnPage: gates.filter((g) => badVerb(g.verb)).map((g) => g.verb), badLogged: logged.filter(badVerb) };
        rec('A-storm-owner-5', 'The sod_conflict gates on the day-pass form use the seed fraud-path sentences as verb lines: over eight words, terminal periods, noun-first', 'CONTRACTS §6 (verb first, at most eight words, no terminal period) (roles.js buildPreview)', gates.length === 3 && (o.badOnPage.length > 0 || o.badLogged.length > 0), o);
      } finally { await c.close(); }
    },

    // phone.js Show name: the control promises "this tap is logged" and reveals the name, and nothing is written.
    // Negative control: state().disclosures grows by one and a write event names that row.
    async 'A-storm-owner-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate');
        const before = (await state(p)).disclosures.length; const seq = await lastSeq(p);
        const label = await p.$eval('[data-testid="phone.request.ar-1.name"]', (e) => e.getAttribute('aria-label')).catch(() => null);
        const pressed = await click(p, 'phone.request.ar-1.name');
        const S = await state(p);
        const o = { label, pressed, disclosures: [before, S.disclosures.length], writes: await since(p, seq, 'write'), shown: await p.$eval('.ph-card .ph-kv .ph-v', (e) => e.textContent.trim()).catch(() => null), lastRow: S.disclosures[S.disclosures.length - 1] || null };
        rec('A-storm-owner-6', 'Show name on the phone card reveals the full name under a label that says the tap is logged, and writes no disclosures row and no write event', 'docs/13 feature 24 PHI (full name only after a logged tap); brief category 2 (phone.js requestCard)', pressed && /logged/.test(label || '') && /Lena Fischer/.test(o.shown || '') && (S.disclosures.length === before || !o.writes.some((w) => w.table === 'disclosures')), o);
      } finally { await c.close(); }
    },

    // dailyclose.js varianceCard Investigate: prints patient names "logged as a payment-purpose read" with nothing
    // logged. Negative control: opening the rows writes one disclosures row per patient shown.
    async 'A-storm-owner-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close'); await click(p, 'close.tied.tile');
        const before = (await state(p)).disclosures.length; const seq = await lastSeq(p);
        const pressed = await click(p, 'close.variance.v-1.investigate');
        const rows = await p.evaluate(() => [...document.querySelectorAll('[aria-label="Variance v-1"] .dc-sentences li')].map((e) => e.textContent.trim()));
        const S = await state(p);
        const o = { pressed, rows, disclosures: [before, S.disclosures.length], writes: await since(p, seq, 'write') };
        rec('A-storm-owner-7', 'Investigate on Daily Close prints patient names under "logged as a payment-purpose read" and writes no disclosures row', 'docs/13 feature 19 PHI (names only on expansion with a logged read) (dailyclose.js varianceCard)', pressed && rows.length > 0 && (S.disclosures.length === before || !o.writes.some((w) => w.table === 'disclosures')), o);
      } finally { await c.close(); }
    },

    // dailyclose.js sodView read currentGrants only, so a day pass issued with an accepted critical conflict wrote
    // controlDecisions and appeared nowhere on the owner home; the Roles People table never listed the pass either.
    // Negative control: the Expiring section grows one exception row carrying the 10/3 review date and Roles lists dp-1.
    async 'A-storm-owner-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const before = await p.$eval('section[aria-label^="Expiring"]', (e) => e.textContent.replace(/\s+/g, ' ').trim());
        await hop(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan');
        await click(p, 'roles.daypass.entitlement.refund'); await click(p, 'roles.sod.accept'); await click(p, 'roles.daypass.save'); await p.waitForTimeout(150);
        const S = await state(p);
        const dec = S.controlDecisions.find((x) => x.kind === 'accept_residual' && x.dayPassId) || null;
        const rolesRow = (await testids(p)).filter((t) => /^roles\.row\.dp-/.test(t));
        await hop(p, '#/owner/close');
        const after = await p.$eval('section[aria-label^="Expiring"]', (e) => e.textContent.replace(/\s+/g, ' ').trim());
        const o = { decision: dec, before, after, rolesRow, dayPasses: S.dayPasses.map((d) => d.id) };
        rec('A-storm-owner-8', 'Accepting a critical SoD conflict on a day pass writes controlDecisions, but Daily Close still counts "1 accepted exception" with no row for the pass and the Roles People table never lists the temp', 'docs/13 features 21 and 27; docs/04 one canonical view per fact (dailyclose.js sodView, roles.js peopleTable)', !!dec && S.dayPasses.length === 1 && (after === before || !/10\/3/.test(after) || !rolesRow.length), o);
      } finally { await c.close(); }
    },

    // dailyclose.js renderRisk: §4 lists risk.row.<id>.why and no row rendered it. Negative control: each due row
    // carries one Why disclosure with that id.
    async 'A-storm-owner-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/compliance/risk');
        const ids = await testids(p);
        const rows = ids.filter((t) => /^risk\.row\.[^.]+\.(open|renew|assign|start)$/.test(t));
        const whys = ids.filter((t) => /^risk\.row\.[^.]+\.why$/.test(t));
        const o = { rows, whys };
        rec('A-storm-owner-9', 'CONTRACTS §4 lists the Why disclosure risk.row.<id>.why but Practice risk renders no such id in any row', 'CONTRACTS §4 (the contract in both directions) (dailyclose.js renderRisk)', rows.length > 0 && whys.length === 0, o);
      } finally { await c.close(); }
    },

    // dailyclose.js auditSentences: every write event on approvals read "created an approval request", so the
    // approver's touch on decide narrated them as creating the request they approved. Negative control: the second
    // approvals event reads as a decision (approved/sent back), the first as created.
    async 'A-storm-owner-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate'); await click(p, 'phone.request.ar-1.approve');
        await p.keyboard.type('2468'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
        await hop(p, '#/owner/risk');
        const li = await p.$$eval('section[aria-label="Audit log (sentences)"] li', (l) => l.map((e) => e.textContent));
        const approvalsWrites = (await events(p)).filter((e) => e.kind === 'write' && e.table === 'approvals').map((e) => ({ seq: e.seq, persona: e.persona }));
        const o = { approvalsWrites, sentences: li.filter((t) => /#ar-1/.test(t)) };
        rec('A-storm-owner-10', 'After the owner approves ar-1 the audit log reads "Dr. Reagan (owner) created an approval request #ar-1" beside the biller\'s own created line', 'docs/13 feature 24 (requester ≠ approver); docs/05 audit log as evidence (dailyclose.js auditSentences)', approvalsWrites.length >= 2 && li.some((t) => /Dr\. Reagan \(owner\) created an approval request #ar-1/.test(t)) && li.some((t) => /Sam \(biller\) created an approval request #ar-1/.test(t)), o);
      } finally { await c.close(); }
    },

    // phone.js decidedCard: the one-line reason on Send back is stored on approvals[0].decisionReason and the
    // requester's phone card never prints it. Negative control: the biller's Decided card carries "appeal first".
    async 'A-storm-owner-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await heldWriteoff(p);
        await asPersona(p, 'owner'); await hop(p, '#/owner/phone/approvals');
        await click(p, 'phone.request.ar-1.decline'); await fill(p, 'phone.request.ar-1.reason', 'appeal first'); await click(p, 'phone.request.ar-1.decline'); await p.waitForTimeout(150);
        await asPersona(p, 'biller'); await hop(p, '#/biller/phone/approvals');
        const S = await state(p); const text = await canvas(p);
        const o = { decisionReason: S.approvals[0].decisionReason, status: S.approvals[0].status, hasReasonOnBillerPhone: /appeal first/.test(text), decidedSection: (text.match(/Decided.*$/) || [null])[0] };
        rec('A-storm-owner-11', 'The one-line reason typed on Send back is stored on the request but the biller\'s own phone card shows only "Sent back by Dr. Blake Reagan" without the line', 'docs/13 feature 24 (Send back carries a one-line reason to the requester) (phone.js decidedCard)', o.decisionReason === 'appeal first' && o.status === 'declined' && !o.hasReasonOnBillerPhone, o);
      } finally { await c.close(); }
    },

    // roles.js buildPreview printed "Pick one before issuing the pass." for every conflict while the store holds only a
    // critical one, so a high-only conflict issued with Save live and no decision under a sentence that said it could
    // not. Negative control: the hint beside a high-only conflict says the pass can issue and the finding stays open.
    async 'A-storm-owner-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Robin Hale');
        await click(p, 'roles.daypass.entitlement.write_off'); await p.waitForTimeout(150);
        const gates = (await refusals(p)).filter((x) => x.code === 'sod_conflict');
        const hint = await p.evaluate(() => [...document.querySelectorAll('.rl-preview p.hint')].map((e) => e.textContent.trim()).join(' | '));
        const label = await txt(p, 'roles.daypass.save');
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const S = await state(p);
        const o = { gates, hint, saveLabel: label, issued: S.dayPasses.map((d) => ({ id: d.id, ents: d.entitlements, sodDecision: d.sodDecision })), controlDecisions: S.controlDecisions.length };
        rec('A-storm-owner-12', 'With only Write-off added (high severity) the preview says "Pick one before issuing the pass." while Issue day pass stays live and issues with no decision recorded', 'docs/13 feature 27; brief category 7 (wording contradicts behaviour) (roles.js buildPreview)', gates.length === 1 && label === 'Issue day pass' && S.dayPasses.length === 1 && S.dayPasses[0].sodDecision === null && /Pick one before issuing the pass\./.test(hint), o);
      } finally { await c.close(); }
    },

    // dailyclose.js: st.closeStep lived in module state and fresh() ran only when the store object changed, so the
    // confirm group survived a trip to Money Desk and back. Negative control: the confirm control is gone on return.
    async 'A-storm-owner-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close'); await click(p, 'close.closeday');
        const opened = !!(await p.$('[data-testid="close.closeday.confirm"]'));
        await hop(p, '#/owner/money'); await hop(p, '#/owner/close');
        const stillOpen = !!(await p.$('[data-testid="close.closeday.confirm"]'));
        rec('A-storm-owner-13', 'The Close day confirm group stays open after leaving Daily Close for Money Desk and returning: the second step of an irreversible verb survives a route change', 'docs/01 principle 9 (confirmed where and when it is pressed); brief category 4 (dailyclose.js closeStep)', opened && stillOpen, { opened, stillOpen });
      } finally { await c.close(); }
    },

    // At 420 px the location row's source line wraps into a 51 px column six lines tall and the Card tender's Gap
    // chip runs past the tender table (components.css .dc-loc / .tender). Negative control: no source span is
    // narrower than its text by more than 4 px while taller than 80 px, and the chip ends inside the table.
    async 'A-storm-owner-14'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/close'); await click(p, 'close.tied.tile'); await p.waitForTimeout(150);
        const src = await p.$$eval('.dc-loc .small.muted.grow', (l) => l.map((e) => ({ text: e.textContent.trim(), sw: e.scrollWidth, cw: e.clientWidth, h: Math.round(e.getBoundingClientRect().height) })));
        const chip = await p.$eval('[data-testid="close.tender.card"] .chip', (e) => ({ text: e.textContent.trim(), right: Math.round(e.getBoundingClientRect().right), tableRight: Math.round(e.closest('.dc-detail').getBoundingClientRect().right) })).catch(() => null);
        const o = { viewport: 420, src, chip };
        rec('A-storm-owner-14', 'At 420x860 with the tile open the location row wraps its source line into a 51 px column six lines tall and the Card tender Gap chip runs past the right edge of the tender table', 'docs/04 (clipped or overlapping text is a bug) (components.css .dc-loc / .tender)', src.length > 0 && (src.some((x) => x.sw > x.cw + 4 && x.h > 80) || (!!chip && chip.right > chip.tableRight + 1)), o);
      } finally { await c.close(); }
    },

    // roles.js NOW = '08:40': the shift end was compared against a literal, not state().clock, so with the clock at
    // 14:05 a 09:00 pass issued already expired and the hint still read "8:40 am". Negative control: Save is held with
    // shift_end_required and the hint names 2:05 pm.
    async 'A-storm-owner-15'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles');
        await p.evaluate(() => { Proto.store.get().clock.time = '14:05'; Proto.router.render(); }); await p.waitForTimeout(150);
        await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Alex Rivera'); await fill(p, 'roles.daypass.end', '09:00');
        await p.evaluate(() => document.querySelector('[data-testid="roles.daypass.end"]').blur()); await p.waitForTimeout(120);
        const hint = await p.evaluate(() => (document.getElementById('rl-end-hint') || {}).textContent || null);
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(150);
        const S = await state(p);
        const o = { clock: S.clock.time, hint, dayPasses: S.dayPasses.map((d) => d.id + ':' + d.shiftEnd), gate: (await refusals(p))[0] || null };
        rec('A-storm-owner-15', 'The day-pass form compares the shift end against a literal 08:40: with the clock at 14:05 a pass ending 09:00 issues and the hint still names 8:40 am', 'CONTRACTS §3 / docs/13 (every "now" derives from state().clock; a grant must not issue already expired) (roles.js validEnd)', S.clock.time === '14:05' && (S.dayPasses.some((d) => d.shiftEnd === '09:00') || /8:40/.test(hint || '')), o);
      } finally { await c.close(); }
    },
  };
};
