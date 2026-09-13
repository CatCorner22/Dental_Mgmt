// Round-2 fix-storm checks, owner "polish". Files: prototype/js/store.js, screens/board.js, perio.js, dailyclose.js.
// Default position is NOT reproduced: each check records the precondition it reached and scores the breach only
// once that state stood.
export default ({ ctx, go, hop, click, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const gate = (p) => p.evaluate(() => { const r = [...document.querySelectorAll('.refusal')].filter((x) => x.offsetParent !== null)[0]; return r ? { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() } : null; });
  const hash = (p) => p.evaluate(() => location.hash);
  const pressControl = async (p) => { await p.click(tid('refusal.control')).catch(() => {}); await p.waitForTimeout(200); };
  const who = (p) => p.evaluate(() => { const u = Proto.store.currentUser(); return { name: u.name, noPass: !!u.noPass, licence: u.licence || null }; });
  // The store's own answer for one probed site, read without the screen in between; the store is rebuilt after, so a
  // save that went through cannot seal the exam for the next seat measured.
  const storeSave = (p) => p.evaluate(() => { const r = Proto.store.savePerio('enc-9001', { 't1-s1': { depth: 3, bleed: false, sup: false, skipped: false } }, { mode: 'full' }); window.__proto.reset(); return { ok: r.ok, code: r.code || null, control: r.control || null }; });

  return {
    // board.js gateFor()/readiness "Add day pass": the pass gate's "Open Roles" routed to the temp's own Roles
    // (#/temp/roles, where issuing is refused) while every other screen sends the word to #/owner/roles.
    // Negative control: the control lands on #/owner/roles.
    async 'A-storm2-polish-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        const u = await who(p);
        await click(p, 'board.card.a-1042.arrive');
        const g = await gate(p);
        await pressControl(p);
        const o = { user: u, gate: g, hash: await hash(p) };
        rec('A-storm2-polish-1', 'On the pass-less temp\'s Board the Arrive gate "Open Roles" routes to #/temp/roles, where issuing a pass is refused, while Checkout, Encounter, Perio and Chairs route the same word to #/owner/roles', 'docs/15 one rule, one owner — one destination for one control word (board.js gateFor, readiness Add day pass)',
          u.noPass && !!g && g.code === 'entitlement' && /Roles/.test(g.control) && o.hash !== '#/owner/roles', o);
      } finally { await c.close(); }
    },

    // store.js savePerio: no clinician() rule, so perio.js carried its own noPass/mayChart copy and a direct store
    // call saved an exam as "No day pass issued" or as the front desk. Negative control: the store refuses the temp
    // with entitlement and the front desk with licence_scope, and the screen renders the same code.
    async 'A-storm2-polish-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/perio/enc-9001');
        const temp = await who(p);
        await p.keyboard.press('3'); await p.waitForTimeout(60);
        await click(p, 'perio.save');
        const tempGate = await gate(p);
        const tempStore = await storeSave(p);
        await go(p, '#/frontdesk/perio/enc-9001');
        const fd = await who(p);
        await p.keyboard.press('3'); await p.waitForTimeout(60);
        await click(p, 'perio.save');
        const fdGate = await gate(p);
        const fdStore = await storeSave(p);
        await go(p, '#/hygienist/perio/enc-9001');
        const hyStore = await storeSave(p);
        const o = { temp: { user: temp, screenGate: tempGate, storeDirect: tempStore }, frontdesk: { user: fd, screenGate: fdGate, storeDirect: fdStore }, hygienist: { storeDirect: hyStore } };
        const pre = temp.noPass && !!tempGate && tempGate.code === 'entitlement' && !fd.licence && !!fdGate && fdGate.code === 'licence_scope';
        rec('A-storm2-polish-2', 'Perio Save refuses a pass-less temp and the front desk on screen, but Proto.store.savePerio called directly by the same seats saves the exam: the rule lives in perio.js, not in the store', 'docs/15 one rule, one owner — an entitlement rule belongs in the store and the screen renders its refusal (store.js savePerio, perio.js doSave)',
          pre && (tempStore.code !== 'entitlement' || fdStore.code !== 'licence_scope'), o);
      } finally { await c.close(); }
    },

    // dailyclose.js WROTE: no `notes` entry, so the touch('notes', encId) a chart paint logs reads as the default
    // "wrote a record" in the audit sentences. Negative control: the sentence names the note edit.
    async 'A-storm2-polish-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120);
        const noteWrites = await p.evaluate(() => window.__events.filter((e) => e.kind === 'write' && e.table === 'notes').map((e) => e.seq + ':' + e.id));
        await hop(p, '#/dentist/risk');
        const sentences = await p.$$eval('.dc-sentences li', (es) => es.map((e) => e.textContent.trim()));
        const noteLine = sentences.find((s) => /#enc-9002 /.test(s)) || null;
        const o = { noteWrites, noteLine, sentences };
        rec('A-storm2-polish-3', 'After a chart paint on enc-9002 the audit sentences name the note write with the default "wrote a record #enc-9002" because the WROTE map has no notes entry', 'docs/13 feature 27 — the log reads as sentences that say what was written (dailyclose.js WROTE)',
          noteWrites.length > 0 && !!noteLine && /wrote a record #enc-9002/.test(noteLine), o);
      } finally { await c.close(); }
    },
  };
};
