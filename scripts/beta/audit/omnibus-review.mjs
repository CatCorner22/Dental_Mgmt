// Omnibus review (2026-09-11): the fixes that came out of the read-only review, each pinned by the breach it closed.
export default ({ ctx, go, hop, press, click, rec }) => ({
  // What is typed is never evidence: PIN digits on the pad and text in any field reach __events as bullets.
  async 'O-review-1'(b) {
    const { c, p } = await ctx(b);
    try {
      await go(p, '#/frontdesk/board');
      await press(p, 'topbar.author'); await p.keyboard.type('1357', { delay: 10 }); await p.keyboard.press('Escape');
      await hop(p, '#/frontdesk/checkout/a-1044?device=shared');
      await p.focus('[data-testid="checkout.amount"]'); await p.keyboard.type('47', { delay: 10 });
      await p.focus('[data-testid="checkout.pin"]').catch(() => null); await p.keyboard.type('99', { delay: 10 });
      const r = await p.evaluate(() => { const ks = window.__events.filter((e) => e.kind === 'key'); return { plain: ks.filter((e) => /^[0-9]$/.test(e.key)).length, bullets: ks.filter((e) => e.secret && e.key === '•').length, named: ks.filter((e) => e.key === 'Escape').length }; });
      rec('O-review-1', 'Digits typed on the PIN pad or into a field are recorded in plain text in window.__events',
        'Security — credentials and typed PHI never enter the evidence log (events.js keydown)',
        r.plain > 0 || r.bullets < 6 || r.named < 1, r);
    } finally { await c.close(); }
  },

  // A route word from the address bar is nowhere, never an Object internal.
  async 'O-review-2'(b) {
    const { c, p, errs } = await ctx(b);
    try {
      const out = {};
      for (const h of ['#/frontdesk/hasOwnProperty', '#/frontdesk/constructor', '#/frontdesk/__proto__']) {
        await go(p, h); out[h] = { text: await p.evaluate(() => document.getElementById('canvas').textContent.slice(0, 80)), home: (await p.$('[data-testid="notfound.home"]')) !== null };
      }
      rec('O-review-2', 'A prototype-key route word throws from the hashchange handler or renders a blank canvas',
        'C4 — every unknown route lands on Nothing here (router.js handlers)',
        errs.length > 0 || Object.values(out).some((o) => !/Nothing here/.test(o.text) || !o.home), { errs, out });
    } finally { await c.close(); }
  },

  // No persona chosen is nobody, not the owner.
  async 'O-review-3'(b) {
    const { c, p } = await ctx(b);
    try {
      await go(p, '#/signin');
      const r = await p.evaluate(() => { const u = Proto.store.currentUser(); return { persona: window.__proto.persona, id: u.id, ents: (u.entitlements || []).length, noPass: !!u.noPass }; });
      rec('O-review-3', 'With no persona chosen the store treats the seat as the owner with every entitlement',
        'Security — an unknown or unset persona resolves to nobody (store.js currentUser)',
        r.ents > 0 || !r.noPass, r);
    } finally { await c.close(); }
  },

  // A write is stamped with its author at write time; the audit trail does not re-author it after a PIN switch.
  async 'O-review-4'(b) {
    const { c, p } = await ctx(b);
    try {
      await go(p, '#/frontdesk/board');
      const before = await p.evaluate(() => Proto.store.currentUser().id);
      await p.evaluate(() => Proto.store.arrive('a-1042'));
      await click(p, 'topbar.author'); for (const d of '6666') await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(200);
      const r = await p.evaluate((before) => { const ws = window.__events.filter((e) => e.kind === 'write'); const now = Proto.store.currentUser().id; return { before, now, writes: ws.length, stamped: ws.filter((e) => e.userId === before).length, unstamped: ws.filter((e) => !e.userId).length }; }, before);
      rec('O-review-4', 'Write events carry no author, so the Daily Close audit trail attributes earlier writes to whoever the persona maps to now',
        'Audit — the author is stamped on the write event (events.js write; dailyclose auditSentences)',
        r.writes === 0 || r.unstamped > 0 || r.stamped === 0 || r.now === r.before, r);
    } finally { await c.close(); }
  },

  // The assistant has a bar of their own, not the front desk's money and roles.
  async 'O-review-5'(b) {
    const { c, p } = await ctx(b);
    try {
      await go(p, '#/assistant/board');
      const labels = await p.evaluate(() => [...document.querySelectorAll('.topbar nav button')].map((x) => x.textContent.trim()));
      rec('O-review-5', 'The assistant persona inherits the front desk\'s navigation (Money Desk, Roles)',
        'Roles — every persona carries its own bar (shell.js NAV)',
        labels.includes('Money Desk') || labels.includes('Roles') || !labels.includes('Chairs'), { labels });
    } finally { await c.close(); }
  },
});
