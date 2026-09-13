// Round-2 storm checks for the owner chunk: Daily Close (dailyclose.js), Roles (roles.js) and the approver's phone
// card (phone.js). Default position is NOT reproduced: every check measures the breach it claims, carries the
// precondition values in its evidence, and closes its context in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const since = async (p, seq, kind) => (await events(p)).filter((e) => e.seq > seq && (!kind || e.kind === kind)).map((e) => ({ seq: e.seq, kind: e.kind, code: e.code, testid: e.testid, table: e.table, id: e.id }));
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), ids: [...r.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')) })));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName; });
  const fill = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.waitForTimeout(60); return true; };
  const set = (p, o) => p.evaluate((x) => window.__proto.set(x), o);
  const reset = (p) => p.evaluate(() => window.__proto.reset());
  const padOpen = (p) => p.evaluate(() => !!document.querySelector('#dialogs .dialog'));
  const keys = async (p, digits) => { for (const d of digits) await click(p, 'phone.stepup.' + d); };
  const enter = async (p, tid) => { await p.focus(`[data-testid="${tid}"]`); await p.keyboard.press('Enter'); await p.waitForTimeout(90); };

  return {
    // phone.js state.submit sent `true` to the store instead of the digits, so Bree's 1111 approved ar-1 as Dr. Reagan.
    // Negative control: the store refuses pin_no_match, the request stays pending, and a gate renders on the card.
    async 'A-storm2-owner-1'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate'); await click(p, 'phone.request.ar-1.approve');
        await keys(p, ['1', '1', '1', '1']); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
        const S = await state(p); const a = S.approvals[0] || {}; const owner = S.users.find((u) => u.id === 'u-dr-1');
        const o = { ownerPin: owner.pin, typed: '1111', status: a.status, decidedBy: a.decidedBy, refusals: await refusals(p), verifyPin: await p.evaluate(() => typeof Proto.store.verifyPin) };
        rec('A-storm2-owner-1', 'The phone step-up approves ar-1 as Dr. Reagan on any four digits: Bree\'s 1111 posts the write-off with the owner as second approver', 'docs/13 feature 22 (step-up re-verifies identity); CONTRACTS §6 pin_no_match (phone.js state.submit → store decideApproval {pin})', owner.pin !== '1111' && a.status === 'approved' && a.decidedBy === owner.name, o);
      } finally { await c.close(); }
    },

    // Match/Retire had no entitlement rule for a seat with no day pass; the screen's gate() must render the store's
    // refusal with a control that routes somewhere. Negative control: no mutation, one entitlement gate whose control moves the route.
    async 'A-storm2-owner-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/close');
        const me = await p.evaluate(() => Proto.store.currentUser());
        await click(p, 'close.tied.tile'); await click(p, 'close.variance.v-1.match'); await click(p, 'close.decision.d-1.retire'); await p.waitForTimeout(150);
        const S = await state(p); const gates = await refusals(p);
        const gate = gates.find((g) => g.code === 'entitlement') || null;
        const hash0 = await p.evaluate(() => location.hash);
        let moved = null;
        if (gate) { await click(p, 'refusal.control'); await p.waitForTimeout(200); moved = (await p.evaluate(() => location.hash)) !== hash0; }
        const mutated = S.variances[0].status === 'matched' || S.decisions[0].status === 'retire';
        const o = { me: { id: me.id, entitlements: me.entitlements }, variance: S.variances[0].status, decision: S.decisions[0].status, gates, moved };
        rec('A-storm2-owner-2', 'As the temp with no day pass, Match these and Retire on Daily Close tie the day and retire the decision with no entitlement gate, or the gate\'s control goes nowhere', 'docs/05 money controls held to their seats; CONTRACTS §6 entitlement (store matchVariance/reviewDecision; dailyclose.js gate())', !(me.entitlements || []).length && (mutated || (!!gate && !gate.ids.includes('refusal.control')) || (!!gate && moved === false)), o);
      } finally { await c.close(); }
    },

    // dailyclose.js kept the outage gate node in module state after the outage ended, so Match read Held across a hop.
    // Negative control: after the outage ends and the screen re-renders, no outage gate stands and Match reads its own label.
    async 'A-storm2-owner-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close'); await set(p, { outage: true }); await click(p, 'close.tied.tile'); await click(p, 'close.variance.v-1.match'); await p.waitForTimeout(120);
        const during = { label: await txt(p, 'close.variance.v-1.match'), gates: (await refusals(p)).map((g) => g.code) };
        await set(p, { outage: false }); await hop(p, '#/owner/money'); await hop(p, '#/owner/close'); await p.waitForTimeout(120);
        const after = { outage: (await state(p)).outage, label: await txt(p, 'close.variance.v-1.match'), gates: (await refusals(p)).map((g) => g.code), variance: (await state(p)).variances[0].status };
        const o = { during, after };
        rec('A-storm2-owner-3', 'Daily Close keeps the outage gate and the Held identity on Match these after the outage ends and the screen re-renders', 'ROUND2 stale-gate rule; CONTRACTS §6 (Held is the identity of a refused verb) (dailyclose.js varianceCard)', during.label === 'Held' && during.gates.includes('outage') && after.outage === false && after.variance === 'open' && (after.label === 'Held' || after.gates.includes('outage')), o);
      } finally { await c.close(); }
    },

    // phone.js byUser lived outside the store, so a fresh ar-1 after reset() was born Held under an outage gate from before.
    // Negative control: after reset the new card is live and carries no gate.
    async 'A-storm2-owner-4'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate'); await set(p, { outage: true }); await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(100);
        const during = { label: await txt(p, 'phone.request.ar-1.approve'), gates: (await refusals(p)).map((g) => g.code) };
        await set(p, { outage: false }); await reset(p); await p.waitForTimeout(150); await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const S = await state(p);
        const after = { outage: S.outage, approvals: S.approvals.map((a) => a.id + ':' + a.status), label: await txt(p, 'phone.request.ar-1.approve'), gates: (await refusals(p)).map((g) => g.code) };
        const o = { during, after };
        rec('A-storm2-owner-4', 'The phone card\'s outage gate outlives the outage and reset(): the fresh ar-1 renders Held under the old gate', 'ROUND2 stale-gate rule; CONTRACTS §3 reset() (phone.js byUser)', during.label === 'Held' && after.outage === false && after.approvals.includes('ar-1:pending') && (after.label === 'Held' || after.gates.includes('outage')), o);
      } finally { await c.close(); }
    },

    // phone.js nameShown was module memory, so after reset() the name showed with no disclosures row behind it.
    // Negative control: after reset the card shows initials and the Show name control, and disclosures is 0.
    async 'A-storm2-owner-5'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate'); await click(p, 'phone.request.ar-1.name'); await p.waitForTimeout(100);
        const before = { shown: await p.$eval('.ph-card .ph-kv .ph-v', (e) => e.textContent.trim()).catch(() => ''), disclosures: (await state(p)).disclosures.length };
        await reset(p); await p.waitForTimeout(150); await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const after = { shown: await p.$eval('.ph-card .ph-kv .ph-v', (e) => e.textContent.trim()).catch(() => ''), hasBtn: !!(await p.$('[data-testid="phone.request.ar-1.name"]')), disclosures: (await state(p)).disclosures.length };
        const o = { before, after };
        rec('A-storm2-owner-5', 'Show name on the phone card survives reset(): the new ar-1 prints Lena Fischer with state().disclosures empty', 'docs/06 (every PHI reveal writes a disclosure row); CONTRACTS §3 reset() (phone.js nameShown)', /Fischer/.test(before.shown) && before.disclosures === 1 && after.disclosures === 0 && (/Fischer/.test(after.shown) || !after.hasBtn), o);
      } finally { await c.close(); }
    },

    // roles.js renamed the licence gate's control to roles.daypass.credential.add, so the gate had no refusal.control.
    // Negative control: the gate carries refusal.control and the credential path carries its own id.
    async 'A-storm2-owner-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan'); await click(p, 'roles.daypass.role.rdh'); await p.waitForTimeout(150);
        const lic = (await refusals(p)).find((g) => g.code === 'licence_not_on_file') || null;
        const o = { lic };
        rec('A-storm2-owner-6', 'The Roles licence_not_on_file gate renames its control to roles.daypass.credential.add, so a visible gate has no refusal.control', 'CONTRACTS §6 (exactly one refusal.control per gate) (roles.js buildPreview)', !!lic && !lic.ids.includes('refusal.control'), o);
      } finally { await c.close(); }
    },

    // roles.js saveButton ignored saveGate, so Issue day pass stayed live under a store gate.
    // Negative control: while the entitlement gate stands the primary reads Held.
    async 'A-storm2-owner-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/roles'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan'); await click(p, 'roles.daypass.save'); await p.waitForTimeout(150);
        const gates = (await refusals(p)).map((g) => g.code); const label = await txt(p, 'roles.daypass.save'); const S = await state(p);
        const o = { gates, label, passes: S.dayPasses.length };
        rec('A-storm2-owner-7', 'While a store gate stands on the day-pass form, Issue day pass is not Held', 'CONTRACTS §6 (the primary switches to Held while a gate stands) (roles.js saveButton)', gates.includes('entitlement') && S.dayPasses.length === 0 && label !== 'Held', o);
      } finally { await c.close(); }
    },

    // phone.js: reset() with the step-up pad open left the pad over a store with no ar-1; Enter closed it silently.
    // Negative control: the pad is gone, a notice or gate names the missing request, and focus rests on it.
    async 'A-storm2-owner-8'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate'); await click(p, 'phone.request.ar-1.approve'); await p.keyboard.type('2468'); await p.waitForTimeout(60);
        const openBefore = await padOpen(p);
        await reset(p); await p.waitForTimeout(150);
        const openAfterReset = await padOpen(p);
        await p.keyboard.press('Enter'); await p.waitForTimeout(200);
        const notice = await p.evaluate(() => [...document.querySelectorAll('#canvas [role="status"], #canvas .refusal')].map((e) => e.textContent.trim()).filter((t) => /ar-1|no longer|request/i.test(t)));
        const o = { openBefore, openAfterReset, openAfterEnter: await padOpen(p), approvals: (await state(p)).approvals.length, notice, focused: await focused(p) };
        rec('A-storm2-owner-8', 'reset() with the step-up pad open leaves the pad over a store with no request; Enter closes it with no word and focus on BODY', 'CONTRACTS §6 (a refusal with nowhere to go is a dead end); ROUND2 reset() twist (phone.js openStepup)', openBefore && o.approvals === 0 && !o.openAfterEnter && (!notice.length || o.focused === 'BODY'), o);
      } finally { await c.close(); }
    },

    // dailyclose.js opened the confirm group with focus on close.closeday.confirm, so a repeated Enter closed the day.
    // Negative control: after the first Enter focus is not on the confirm control, and the second Enter writes nothing.
    async 'A-storm2-owner-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const before = (await state(p)).dayCloses.length; const seq = await lastSeq(p);
        await enter(p, 'close.closeday');
        const f1 = await focused(p); const confirmOpen = !!(await p.$('[data-testid="close.closeday.confirm"]'));
        await p.keyboard.press('Enter'); await p.waitForTimeout(250);
        const o = { f1, confirmOpen, clicks: (await since(p, seq, 'click')).map((e) => e.testid), dayCloses: [before, (await state(p)).dayCloses.length] };
        rec('A-storm2-owner-9', 'Two Enter presses on close.closeday close the day: the confirm group opens with focus already on its irreversible control', 'docs/01 principle 9; ROUND2 focus-after-action rule (dailyclose.js closeDaySection)', confirmOpen && (f1 === 'close.closeday.confirm' || o.dayCloses[1] > before), o);
      } finally { await c.close(); }
    },

    // dailyclose.js moved focus to close.closeday after Keep fired, so a second Enter opened the close-day confirm.
    // Negative control: focus rests on the Reviewed stamp and the second Enter opens nothing.
    async 'A-storm2-owner-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const seq = await lastSeq(p);
        await enter(p, 'close.decision.d-1.keep');
        const f1 = await focused(p); const kept = (await state(p)).decisions[0].status;
        await p.keyboard.press('Enter'); await p.waitForTimeout(200);
        const o = { f1, kept, clicks: (await since(p, seq, 'click')).map((e) => e.testid), confirmOpen: !!(await p.$('[data-testid="close.closeday.confirm"]')) };
        rec('A-storm2-owner-10', 'After Keep 90 more days fires, focus lands on Close day, so a repeated Enter opens the close-day confirm', 'ROUND2 focus-after-action rule (stamp or heading, never the next primary) (dailyclose.js decisions())', kept === 'keep' && (f1 === 'close.closeday' || o.confirmOpen), o);
      } finally { await c.close(); }
    },
  };
};
