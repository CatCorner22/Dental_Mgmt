// Round-2 fix-storm checks, owner "controls": the store wave (33c8fce) emits refusal controls the screens did not
// act on. Files: prototype/js/screens/checkout.js, encounter.js, perio.js, chairs.js, roles.js. Rule throughout:
// a gate has one control and the control does what its label says (CONTRACTS §6). Default position is NOT
// reproduced: each check records the gate it measured and scores the breach only once the gate stood.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const gate = (p) => p.evaluate(() => { const r = [...document.querySelectorAll('.refusal')].filter((x) => x.offsetParent !== null)[0]; return r ? { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() } : null; });
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.id || a.tagName; });
  const hash = (p) => p.evaluate(() => location.hash);
  const has = (p, t) => p.$(tid(t)).then((x) => !!x);
  const padOpen = (p) => has(p, 'pin.submit');
  const set = (p, o) => p.evaluate((o) => window.__proto.set(o), o);
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const refusalsSince = async (p, seq) => (await events(p)).filter((e) => e.seq > seq && e.kind === 'refusal').map((e) => e.code);
  const pressControl = async (p, scope) => { await p.click((scope ? tid(scope) + ' ' : '') + tid('refusal.control')).catch(() => {}); await p.waitForTimeout(200); };
  const writeoff = async (p, amount) => { await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', amount); await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.post'); };

  return {
    // checkout.js withControl(): the store's write-off cap (amount_required, "Go to amount") fell to the default branch,
    // so the control went Back to Board. Negative control: focus lands on checkout.writeoff.amount and the route stays.
    async 'A-storm2-controls-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '100');
        await writeoff(p, '500');
        const g = await gate(p);
        await pressControl(p);
        const o = { gate: g, hash: await hash(p), focus: await focused(p) };
        rec('A-storm2-controls-1', 'On Checkout a-1047 a $500 write-off over a $310 balance raises amount_required "Go to amount", and the control leaves for the Board instead of the write-off field', 'CONTRACTS §6 — the control does what it says (checkout.js withControl amount_required)',
          !!g && g.code === 'amount_required' && g.control === 'Go to amount' && (!/checkout\/a-1047/.test(o.hash) || o.focus !== 'checkout.writeoff.amount'), o);
      } finally { await c.close(); }
    },

    // checkout.js withControl(): at a $0 cap the store says "Remove the write-off"; the control went Back to Board and
    // left the write-off open. Negative control: the write-off block closes, the gate falls, the route stays.
    async 'A-storm2-controls-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        await click(p, 'checkout.tender.cash');
        await writeoff(p, '50');
        const g = await gate(p);
        await pressControl(p);
        const o = { gate: g, hash: await hash(p), writeoffStillOpen: await has(p, 'checkout.writeoff.amount'), gateAfter: await gate(p) };
        rec('A-storm2-controls-2', 'On Checkout a-1046 (paid in full) a $50 write-off raises amount_required "Remove the write-off", and the control leaves for the Board with the write-off still open', 'CONTRACTS §6 — the control does what it says (checkout.js withControl amount_required at a $0 cap)',
          !!g && g.code === 'amount_required' && g.control === 'Remove the write-off' && (!/checkout\/a-1046/.test(o.hash) || o.writeoffStillOpen), o);
      } finally { await c.close(); }
    },

    // checkout.js withControl(): the after_hours control label was overridden to "Remove write-off" while the store says
    // "Remove the write-off". Negative control: the screen renders the store's word and the press removes the write-off.
    async 'A-storm2-controls-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047?afterHours=1');
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.amount', '100');
        await writeoff(p, '100');
        const g = await gate(p);
        const storeWord = await p.evaluate(() => Proto.store.postCheckout('a-1047', { decision: 'collect', tender: 'card', amountCents: 10000, writeoffCents: 10000, writeoffReason: 'courtesy', selfPay: [] }).control);
        await pressControl(p);
        const o = { gate: g, storeWord, writeoffStillOpen: await has(p, 'checkout.writeoff.amount'), hash: await hash(p) };
        rec('A-storm2-controls-3', 'Under after hours the Checkout write-off gate labels its control "Remove write-off" while the store\'s refusal says "Remove the write-off"', 'docs/15 one rule, one owner — the screen renders the store\'s control word (checkout.js withControl after_hours)',
          !!g && g.code === 'after_hours' && !!storeWord && (g.control !== storeWord || o.writeoffStillOpen), o);
      } finally { await c.close(); }
    },

    // checkout.js render()/withControl(): the entitlement prune read every entitlement gate as the pass gate, so Bree's
    // "Switch author" refusal was dropped before it rendered (Post did nothing, focus on body); had it rendered, the
    // control routed to Roles. Negative control: the gate stands and its control opens the PIN pad on Checkout.
    async 'A-storm2-controls-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/checkout/a-1046');
        const u = await p.evaluate(() => Proto.store.currentUser());
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post');
        const g = await gate(p); const focus = await focused(p);
        await pressControl(p);
        const posted = (await state(p)).ledger.filter((e) => e.patientId === 'p-305').length;
        const o = { user: u.name, entitlements: u.entitlements, gate: g, focusAfterPost: focus, padOpen: await padOpen(p), hash: await hash(p), rowsPosted: posted };
        rec('A-storm2-controls-4', 'Bree (no post_payment) pressing Post on Checkout a-1046 posts nothing and sees no gate, or sees entitlement "Switch author" whose control opens Roles instead of the PIN pad', 'CONTRACTS §6 — every refusal renders and its control does what it says (checkout.js render entitlement prune, withControl entitlement)',
          !(u.entitlements || []).includes('post_payment') && posted === 0 && (!g || g.code !== 'entitlement' || g.control !== 'Switch author' || !o.padOpen || /roles/.test(o.hash)), o);
      } finally { await c.close(); }
    },

    // checkout.js: one refusal event per press through the PIN lock (the store fixer read six events for five
    // presses). Negative control: refusal events == presses.
    async 'A-storm2-controls-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash');
        const seq0 = await lastSeq(p); const codes = [];
        for (const pin of ['9', '8', '7', '6', '5']) { await fill(p, 'checkout.pin', pin); await click(p, 'checkout.post'); codes.push(((await gate(p)) || {}).code || null); }
        const ev = await refusalsSince(p, seq0);
        rec('A-storm2-controls-5', 'Five wrong PINs on a shared Checkout log more refusal events than presses: pin_locked is logged twice per press', 'CONTRACTS §5 — one refusal event per raised gate (checkout.js withControl pin_locked)',
          codes.filter((x) => x === 'pin_locked').length >= 2 && ev.length > codes.filter(Boolean).length, { gates: codes, refusalEvents: ev });
      } finally { await c.close(); }
    },

    // encounter.js gateNode(): chartPaint's licence_scope "Switch author" ran the Send-to-Exams path (which refuses
    // again) and the temp's entitlement "Open Roles" is measured too. Negative control: pad opens; Roles route.
    async 'A-storm2-controls-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.proc.d2392');
        const g1 = await gate(p);
        await pressControl(p);
        const pad = await padOpen(p); const h1 = await hash(p);
        await go(p, '#/temp/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.proc.d2392');
        const g2 = await gate(p);
        await pressControl(p);
        const h2 = await hash(p);
        const o = { frontdesk: { gate: g1, padOpen: pad, hash: h1 }, temp: { gate: g2, hash: h2 } };
        const pre = !!g1 && g1.code === 'licence_scope' && g1.control === 'Switch author' && !!g2 && g2.code === 'entitlement' && /Roles/.test(g2.control);
        rec('A-storm2-controls-6', 'On the Encounter the front desk\'s paint gate "Switch author" opens no PIN pad and the pass-less temp\'s "Open Roles" reaches no Roles route', 'CONTRACTS §6 — the control does what it says (encounter.js gateNode licence_scope / entitlement)',
          pre && (!pad || !/roles/.test(h2)), o);
      } finally { await c.close(); }
    },

    // perio.js mkGate(): addTag's licence_scope "Switch author", the temp's "Open Roles" and the sealed note's
    // "Open the note" all fell to the default (drop the gate). Negative control: pad; Roles; the encounter route.
    async 'A-storm2-controls-7'(b) {
      const { c, p } = await ctx(b);
      const tag = async (h) => { await go(p, h); await click(p, 'perio.tag.add'); await fill(p, 'perio.tag.tooth', '30'); await fill(p, 'perio.tag.text', 'Bleeding on probing'); await click(p, 'perio.tag.save'); return gate(p); };
      try {
        const g1 = await tag('#/frontdesk/perio/enc-9001'); await pressControl(p); const pad = await padOpen(p);
        const g2 = await tag('#/temp/perio/enc-9001'); await pressControl(p); const h2 = await hash(p);
        const g3 = await tag('#/hygienist/perio/enc-9004'); await pressControl(p); const h3 = await hash(p);
        const o = { frontdesk: { gate: g1, padOpen: pad }, temp: { gate: g2, hash: h2 }, sealed: { gate: g3, hash: h3 } };
        const pre = !!g1 && g1.control === 'Switch author' && !!g2 && /Roles/.test(g2.control) && !!g3 && g3.code === 'exam_sealed' && g3.control === 'Open the note';
        rec('A-storm2-controls-7', 'On Perio the tag gates\' "Switch author", "Open Roles" and "Open the note" each only drop the gate: no pad, no Roles, no encounter', 'CONTRACTS §6 — the control does what it says (perio.js mkGate default)',
          pre && (!pad || !/roles/.test(h2) || !/encounter\/enc-9004/.test(h3)), o);
      } finally { await c.close(); }
    },

    // chairs.js gateFor()/render(): only outage had an action, so readyForExam's "Switch author" (front desk) changed
    // nothing; and the front desk's gate outlived the author switch, so the pass-less temp pressed a stale
    // licence_scope gate instead of her own entitlement "Open Roles". Negative control: pad; the temp's gate is
    // entitlement and its control reaches Roles.
    async 'A-storm2-controls-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board'); await click(p, 'board.card.a-1042.arrive'); await click(p, 'board.card.a-1042.seat');
        await hop(p, '#/frontdesk/chairs'); await click(p, 'chairs.card.a-1042.ready');
        const g1 = await gate(p); await pressControl(p, 'chairs.card.a-1042'); const pad = await padOpen(p);
        await p.keyboard.press('Escape'); await p.waitForTimeout(100);
        await set(p, { persona: 'temp' }); await hop(p, '#/temp/chairs'); await click(p, 'chairs.card.a-1042.ready');
        const g2 = await gate(p); const who = await p.evaluate(() => Proto.store.currentUser().name);
        await pressControl(p, 'chairs.card.a-1042'); const h2 = await hash(p);
        const o = { frontdesk: { gate: g1, padOpen: pad }, temp: { user: who, gate: g2, hash: h2 } };
        rec('A-storm2-controls-8', 'On Chairs the front desk\'s Ready-for-exam gate "Switch author" opens no PIN pad, and after the switch to a pass-less temp the stale licence gate stands in place of her entitlement gate, whose "Open Roles" reaches no Roles route', 'CONTRACTS §6 — the control does what it says; FIX-ROUND2 stale-gate rule (chairs.js gateFor onControl, render prune)',
          !!g1 && g1.code === 'licence_scope' && g1.control === 'Switch author' && (!pad || !g2 || g2.code !== 'entitlement' || !/roles/.test(h2)), o);
      } finally { await c.close(); }
    },

    // roles.js issuedCard(): addDayPass now returns the pass PIN and nothing showed it, so a temp could not post by PIN
    // on a shared desk. Negative control: the issued card carries the store's PIN once.
    async 'A-storm2-controls-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles');
        await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Sam Lee'); await click(p, 'roles.daypass.save'); await p.waitForTimeout(150);
        const dp = (await state(p)).dayPasses.find((d) => d.name === 'Sam Lee') || null;
        const card = await p.evaluate(() => ((document.querySelector('.rl-issued') || {}).textContent || '').replace(/\s+/g, ' ').trim());
        const shown = !!dp && !!dp.pin && (card.match(new RegExp('PIN ' + dp.pin, 'g')) || []).length;
        rec('A-storm2-controls-9', 'After Issue day pass the issued card never shows the pass PIN the store minted, so the temp cannot post by PIN on a shared desk', 'docs/13 feature 30 — the pad shows the PIN once, at issue (roles.js issuedCard)',
          !!dp && !!dp.pin && shown !== 1, { pass: dp && { id: dp.id, pin: dp.pin }, card: card.slice(0, 300), shown });
      } finally { await c.close(); }
    },
  };
};
