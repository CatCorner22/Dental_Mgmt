// First-shift intuition: a new front-desk or hygienist should never see a storage value,
// a leftover draft, or a headline that disagrees with the count beside it.
export default ({ ctx, go, hop, click, rec }) => {
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); return true; };

  return {
    async 'U-note-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const r = await p.evaluate(() => {
          const S = Proto.store;
          S.chartPaint('enc-9002', null, [], 'd0120', 'today');
          const last = S.get().chartEvents.filter((e) => e.encounterId === 'enc-9002' && !e.reversed).pop();
          document.querySelector('[data-testid="enc.note.starter.0"]').click();
          const assessment = (document.querySelector('[data-testid="enc.note.field.assessment"]') || {}).value || '';
          const plan = (document.querySelector('[data-testid="enc.note.field.plan"]') || {}).value || '';
          return { lastTooth: last && last.tooth, assessment, plan };
        });
        rec('U-note-1', 'A whole-patient exam paint leaves Caries confirmed writing "#null" into Assessment or Plan',
          'C3 — a note never names a tooth that does not exist',
          /#null\b/.test(r.assessment + ' ' + r.plan), r);
      } finally { await c.close(); }
    },

    async 'U-checkout-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044?device=shared');
        await fill(p, 'checkout.amount', '300');
        await click(p, 'checkout.tender.check');
        await click(p, 'topbar.author');
        for (const d of ['6', '6', '6', '6']) await click(p, 'pin.key.' + d);
        await click(p, 'pin.submit');
        await p.waitForTimeout(200);
        const seen = await p.evaluate(() => ({
          user: Proto.store.currentUser().name,
          amount: (document.querySelector('[data-testid="checkout.amount"]') || {}).value || null,
          check: (document.querySelector('[data-testid="checkout.tender.check"]') || {}).getAttribute('aria-pressed'),
        }));
        rec('U-checkout-1', 'Switching author on the shared desk hands Sam the previous author\'s $300 check draft',
          'B9 — local drafts are per author',
          seen.user === 'Sam Dawson' && (seen.amount === '300' || seen.check === 'true'), seen);
      } finally { await c.close(); }
    },

    async 'U-palette-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-301');
        await click(p, 'ledger.statement.preview');
        await p.keyboard.press('Control+k');
        await p.waitForTimeout(150);
        const afterOpen = await p.evaluate(() => ({
          dialogs: [...document.querySelectorAll('#dialogs [role="dialog"]')].map((d) => d.getAttribute('aria-label') || ((d.querySelector('h2') || {}).textContent || '').trim()),
          palette: !!document.querySelector('[data-testid="palette.input"]'),
        }));
        if (afterOpen.palette) {
          await fill(p, 'palette.input', 'vega');
          await p.waitForTimeout(120);
        }
        const hint = await p.evaluate(() => ((document.getElementById('palette-hint') || {}).textContent || ''));
        await p.keyboard.press('Escape');
        await p.waitForTimeout(150);
        const afterEsc = await p.evaluate(() => ({
          dialogs: [...document.querySelectorAll('#dialogs [role="dialog"]')].map((d) => d.getAttribute('aria-label') || ((d.querySelector('h2') || {}).textContent || '').trim()),
          palette: !!document.querySelector('[data-testid="palette.input"]'),
        }));
        rec('U-palette-1', 'Ctrl+K with the Statement preview open does not open Search, or one Escape closes the preview with it',
          'B10 — Search stacks over a preview; Escape closes only Search; the hint does not say a two-row list is capped',
          !afterOpen.palette || afterEsc.dialogs.length === 0 || /capped/i.test(hint), { afterOpen, hint, afterEsc });
      } finally { await c.close(); }
    },

    async 'U-perio-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        await click(p, 'perio.screening');
        await p.keyboard.type('*1');
        for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
        await p.keyboard.type('3');
        const line = await p.evaluate(() => ((document.querySelector('.activesite span') || {}).textContent || ''));
        const count = await p.evaluate(() => ((document.querySelector('.pe-count') || {}).textContent || ''));
        rec('U-perio-1', 'Screening headline says all six sextants are coded while the count still reads 3/6',
          'C5 — one fact has one value',
          /All six sextants coded/.test(line) && /3\/6/.test(count), { line, count });
      } finally { await c.close(); }
    },
  };
};
