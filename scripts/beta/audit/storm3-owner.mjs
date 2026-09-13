// Round-3 storm checks for the owner chunk: Daily Close (dailyclose.js), Roles (roles.js) and the approver's phone
// card (phone.js). Default position is NOT reproduced: every check measures the breach it claims, carries the
// precondition values in its evidence, and closes its context in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const since = async (p, seq, kind) => (await events(p)).filter((e) => e.seq > seq && (!kind || e.kind === kind)).map((e) => ({ seq: e.seq, kind: e.kind, code: e.code, testid: e.testid, table: e.table, id: e.id }));
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), controls: [...r.querySelectorAll('[data-testid="refusal.control"]')].map((b) => b.textContent.trim()) })));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName + (a.id ? '#' + a.id : ''); });
  const fill = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.waitForTimeout(60); return true; };
  const has = (p, tid) => p.$(`[data-testid="${tid}"]`).then((x) => !!x);
  const value = (p, tid) => p.$eval(`[data-testid="${tid}"]`, (e) => e.value).catch(() => null);
  const set = (p, o) => p.evaluate((x) => window.__proto.set(x), o);
  const hash = (p) => p.evaluate(() => location.hash);
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const device = (p) => p.evaluate(() => window.__proto.device);
  const keys = async (p, digits, prefix) => { for (const d of digits) await click(p, prefix + d); };
  const enter = async (p, tid) => { await p.focus(`[data-testid="${tid}"]`); await p.keyboard.press('Enter'); await p.waitForTimeout(120); };

  return {
    // money-r3-4 (screen half): on a shared device Daily Close posted with no PIN field and no pin_required gate.
    // Negative control: close.pin renders, Match without a PIN is refused, Match with the owner's PIN posts and clears the field.
    async 'A-storm3-owner-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close?device=shared');
        const S0 = await state(p); const owner = S0.users.find((u) => u.id === 'u-dr-1');
        const hasPin = await has(p, 'close.pin');
        await click(p, 'close.tied.tile'); await click(p, 'close.variance.v-1.match'); await p.waitForTimeout(120);
        const noPin = { gates: (await refusals(p)).map((g) => g.code), variance: (await state(p)).variances[0].status, label: await txt(p, 'close.variance.v-1.match') };
        await fill(p, 'close.pin', owner.pin); await click(p, 'close.variance.v-1.match'); await p.waitForTimeout(150);
        const S1 = await state(p);
        const withPin = { variance: S1.variances[0].status, gates: (await refusals(p)).map((g) => g.code), pinAfter: await value(p, 'close.pin'), sessions: S1.sessions.length };
        const o = { device: await device(p), hasPin, noPin, withPin };
        const refusedNoPin = noPin.gates.includes('pin_required') && noPin.variance === 'open';
        rec('A-storm3-owner-1', 'On a shared device Daily Close has no PIN field: Match, Keep and Close day post frozen to the persona with no pin_required gate, while Money Desk beside it refuses', 'ROUND3 shared-device rule (every posting verb runs requirePin on device shared; the screen renders <prefix>.pin) (dailyclose.js pinField/gate; store closeDay/matchVariance/clearVariance/reviewDecision)', o.device === 'shared' && (!hasPin || !refusedNoPin || withPin.variance !== 'matched' || withPin.pinAfter !== ''), o);
      } finally { await c.close(); }
    },

    // money-r3-7 / shell-owner-r3-2: phone.js stale() dropped only the outage gate, so an after_hours gate outlived the clock.
    // Negative control: once afterHours is off the gate is gone, Approve reads its own label and a press opens the step-up pad.
    async 'A-storm3-owner-2'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals'); await click(p, 'phone.simulate'); await set(p, { afterHours: true }); await p.waitForTimeout(120);
        await click(p, 'phone.request.ar-1.approve'); await keys(p, ['2', '4', '6', '8'], 'phone.stepup.'); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
        const on = { gates: (await refusals(p)).map((g) => g.code), label: await txt(p, 'phone.request.ar-1.approve') };
        await set(p, { afterHours: false }); await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const off = { afterHours: (await state(p)).clock.afterHours, gates: (await refusals(p)).map((g) => g.code), label: await txt(p, 'phone.request.ar-1.approve') };
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(150);
        const press = { pad: await has(p, 'phone.stepup.1'), focused: await focused(p), status: (await state(p)).approvals[0].status };
        const o = { on, off, press };
        rec('A-storm3-owner-2', 'The phone card\'s after-hours gate outlives the clock: with afterHours off the gate stands, Approve reads Held and a press opens no step-up, so a request held for hours can only be declined', 'ROUND3 stale-gate rule (clock); CONTRACTS §6 (a gate stands only while its cause does) (phone.js stale())', on.gates.includes('after_hours') && on.label === 'Held' && off.afterHours === false && press.status === 'pending' && (off.gates.includes('after_hours') || off.label === 'Held' || !press.pad), o);
      } finally { await c.close(); }
    },

    // money-r3-11: phone simulate() printed the store's pin_required verb as bare text on a shared device.
    // Negative control: the sim carries the biller's PIN, so ar-1 is requested; any refusal left renders through the gate component.
    async 'A-storm3-owner-3'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals?device=shared'); await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const S = await state(p); const gates = await refusals(p);
        const o = { device: await device(p), approvals: S.approvals.map((a) => a.id + ':' + a.status), gates, bareText: /Enter your PIN to post/.test(await canvas(p)), hasControl: await has(p, 'refusal.control') };
        rec('A-storm3-owner-3', 'On a shared device phone Simulate dead-ends in bare text: requestWriteoff refuses pin_required, nothing is requested, and no gate with a control renders', 'CONTRACTS §6 (every refusal renders the shared component with one control) (phone.js simulate())', o.device === 'shared' && S.approvals.length === 0 && !gates.length, o);
      } finally { await c.close(); }
    },

    // shell-owner-r3-3: roles.js staleSave had no author clause, so the dentist's entitlement gate stood for the owner and Held posted.
    // Negative control: after the author switch the gate has fallen and the primary reads its own label before it issues.
    async 'A-storm3-owner-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/roles?device=shared'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan'); await click(p, 'roles.daypass.save'); await p.waitForTimeout(150);
        const before = { gates: (await refusals(p)).map((g) => g.code), label: await txt(p, 'roles.daypass.save') };
        await click(p, 'topbar.author'); await keys(p, ['2', '4', '6', '8'], 'pin.key.'); await click(p, 'pin.submit'); await p.waitForTimeout(300);
        const after = { hash: await hash(p), gates: (await refusals(p)).map((g) => g.code), label: await txt(p, 'roles.daypass.save'), name: await value(p, 'roles.daypass.name') };
        const n0 = (await state(p)).dayPasses.length;
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const issued = (await state(p)).dayPasses.slice(n0).map((d) => d.name + ' by ' + d.createdBy);
        const o = { before, after, issued };
        rec('A-storm3-owner-4', 'The Roles entitlement gate survives an author switch to the owner and its Held primary issues the pass', 'ROUND3 stale-gate rule (author); CONTRACTS §6 (a Held primary never posts past a gate) (roles.js staleSave/saveButton)', before.gates.includes('entitlement') && before.label === 'Held' && /owner/.test(after.hash) && after.name === 'Casey Morgan' && (after.gates.includes('entitlement') || (after.label === 'Held' && issued.length === 1)), o);
      } finally { await c.close(); }
    },

    // shell-owner-r3-5: Keep, Tighten and Retire raised three identical-worded gates and ui.js logged one (dedupe key).
    // Negative control: each press logs its own refusal event.
    async 'A-storm3-owner-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/close');
        const log = [];
        for (const a of ['keep', 'tighten', 'retire']) {
          const seq = await lastSeq(p); await click(p, 'close.decision.d-1.' + a); await p.waitForTimeout(150);
          log.push({ a, label: await txt(p, 'close.decision.d-1.' + a), gates: (await refusals(p)).map((g) => g.code), ev: (await since(p, seq, 'refusal')).map((e) => e.code) });
        }
        const o = { log, decision: (await state(p)).decisions[0].status };
        rec('A-storm3-owner-5', 'Three presses on Keep, Tighten and Retire raise three entitlement gates but log one refusal event', 'CONTRACTS §5 (one refusal event per raised gate) (dailyclose.js gate(): fresh)', log.length === 3 && log.every((l) => l.label === 'Held' && l.gates.includes('entitlement')) && log.some((l) => !l.ev.length), o);
      } finally { await c.close(); }
    },

    // shell-owner-r3-6: doSave landed focus on roles.daypass.signin, so Enter twice skipped the one-time PIN card.
    // Negative control: focus rests on the issued card's heading and the second Enter stays on Roles with the PIN line shown.
    async 'A-storm3-owner-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Alex Rivera'); await click(p, 'roles.daypass.role.biller'); await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(100);
        if (await has(p, 'roles.sod.compensate')) await click(p, 'roles.sod.compensate');
        await enter(p, 'roles.daypass.save');
        const f1 = await focused(p); const card1 = /shown once/.test(await canvas(p)); const passes = (await state(p)).dayPasses.length;
        await p.keyboard.press('Enter'); await p.waitForTimeout(300);
        const o = { f1, card1, passes, hash: await hash(p), card2: /shown once/.test(await canvas(p)) };
        rec('A-storm3-owner-6', 'Enter twice on Issue day pass lands on Sign in as this temp and leaves the screen before the one-time PIN is read', 'ROUND3 Enter-twice rule (focus after a primary fires lands on a stamp/heading, never on a primary or a navigation control) (roles.js doSave)', passes === 1 && card1 && (f1 === 'roles.daypass.signin' || /^#\/temp\//.test(o.hash) || !o.card2), o);
      } finally { await c.close(); }
    },

    // shell-owner-r3-9: the Name field's blur rebuilt the primary under the focus move, so focus landed on BODY.
    // Negative control: focus moved from the Name field onto the primary rests on the primary.
    async 'A-storm3-owner-7'(b) {
      const { c, p } = await ctx(b, 1024, 768);
      try {
        await go(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await p.waitForTimeout(100);
        const f0 = await focused(p); await p.keyboard.type('Casey Morgan');
        await p.focus('[data-testid="roles.daypass.save"]'); await p.waitForTimeout(80); const f1 = await focused(p);
        await p.keyboard.press('Tab'); await p.waitForTimeout(80); const tabbed = await focused(p);
        await p.focus('[data-testid="roles.daypass.name"]'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(80); const back = await focused(p);
        const o = { f0, f1, tabbed, back, label: await txt(p, 'roles.daypass.save') };
        rec('A-storm3-owner-7', 'Moving focus from the Name field straight onto Issue day pass lands on BODY: the blur rebuilds the button under the focus move', 'docs/04 keyboard-first (focus never on BODY) (roles.js refreshPreview)', f0 === 'roles.daypass.name' && (f1 === 'BODY' || back === 'BODY'), o);
      } finally { await c.close(); }
    },

    // shell-owner-r3-10: the Daily Close entitlement gate's control routed to Approvals, where the same seat cannot act.
    // Negative control: the control routes to Roles, whatever word the store hands it.
    async 'A-storm3-owner-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/close'); await click(p, 'close.decision.d-1.keep'); await p.waitForTimeout(150);
        const gates = await refusals(p); const gate = gates.find((g) => g.code === 'entitlement') || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const o = { gate, hash: await hash(p), decision: (await state(p)).decisions[0].status };
        rec('A-storm3-owner-8', 'The Daily Close entitlement gate\'s control lands the biller on Approvals as "not an approver": the control acts on nothing', 'CONTRACTS §6 (the control does what its label says; a refusal with nowhere to go is a dead end) (dailyclose.js gate())', !!gate && o.decision === 'review_due' && !/\/roles/.test(o.hash), o);
      } finally { await c.close(); }
    },

    // Hardening: focus after Show name (phone), Close day (Daily Close) and Remediate (Roles) landed on a primary.
    // Negative control: each lands on the disclosed name, the Closed stamp and the preview heading.
    async 'A-storm3-owner-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/phone/approvals'); await click(p, 'phone.simulate'); await click(p, 'phone.request.ar-1.name'); await p.waitForTimeout(100);
        const name = { focused: await focused(p), disclosures: (await state(p)).disclosures.length };
        await hop(p, '#/owner/close'); await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(150);
        const S1 = await state(p);
        const close = { focused: await focused(p), closed: S1.dayCloses.some((d) => d.locationId === 'loc-1' && d.date === S1.tenant.today), label: await txt(p, 'close.closeday') };
        await hop(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan'); await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(100);
        const sod = (await refusals(p)).some((g) => g.code === 'sod_conflict'); await click(p, 'refusal.control'); await p.waitForTimeout(120);
        const remediate = { sod, focused: await focused(p), passes: (await state(p)).dayPasses.length };
        const o = { name, close, remediate };
        const primary = /\.(approve|closeday|save)$/;
        rec('A-storm3-owner-9', 'After Show name, Close day and Remediate fire, focus lands on another primary (Approve, the Held Close day, Issue day pass), so a repeated Enter fires a second verb', 'ROUND2/3 focus-after-action rule (phone.js requestCard, dailyclose.js closeDaySection, roles.js remediate)', name.disclosures === 1 && close.closed && remediate.sod && (primary.test(name.focused) || primary.test(close.focused) || primary.test(remediate.focused)), o);
      } finally { await c.close(); }
    },
  };
};
