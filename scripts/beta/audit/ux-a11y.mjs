// UI and UX review (docs/16), accessibility fixes: each check reproduces a defect axe-core found in the review's baseline
// and the harness reports it only if the defect is back. Default position is NOT reproduced: every check measures the
// breach it claims and carries the values. Each check closes its browser context in `finally`.

export default ({ ctx, go, rec }) => {
  const region = (p, tid) => p.evaluate((tid) => { const e = document.querySelector('[data-testid="' + tid + '"]'); return e ? { tabindex: e.getAttribute('tabindex'), overflow: e.scrollWidth - e.clientWidth, role: e.getAttribute('role'), label: e.getAttribute('aria-label') } : null; }, tid);
  // aria-label on an element with no role is prohibited by ARIA 1.2 on generic elements and ignored by screen readers.
  const labelledGeneric = (p) => p.evaluate(() => [...document.querySelectorAll('div[aria-label]:not([role]), span[aria-label]:not([role]), p[aria-label]:not([role])')].map((e) => e.tagName.toLowerCase() + '.' + (e.className || '').split(' ')[0] + '[' + e.getAttribute('aria-label').slice(0, 30) + ']'));

  return {
    // A-ux-1 · WCAG 2.1.1 (axe scrollable-region-focusable, serious in the baseline) · ui.js scrollRegion: a table wider than
    // its column scrolls sideways inside .wrap-x; the wrapper must be in the tab order while it overflows (so a keyboard user
    // can scroll it) and out of it while it fits (so a stop that does nothing is not added). Reproduced when either half fails
    // on Checkout's procedures table or the Ledger's rows table, or when the overflowing wrapper does not scroll on ArrowRight.
    async 'A-ux-1'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const out = {};
        for (const [tid, hash] of [['checkout.lines', '#/frontdesk/checkout/a-1044'], ['ledger.rows', '#/biller/ledger/p-319']]) {
          await p.setViewportSize({ width: 1280, height: 900 }); await go(p, hash); await p.waitForTimeout(150);
          const wide = await region(p, tid);
          await p.setViewportSize({ width: 420, height: 860 }); await p.waitForTimeout(300);
          const narrow = await region(p, tid);
          let scrolled = null;
          if (narrow && narrow.tabindex === '0') { await p.focus('[data-testid="' + tid + '"]'); for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120); } await p.waitForTimeout(400); scrolled = await p.$eval('[data-testid="' + tid + '"]', (e) => e.scrollLeft); }
          out[tid] = { wide, narrow, scrolledPx: scrolled };
        }
        const bad = Object.entries(out).filter(([, o]) => !o.wide || !o.narrow || o.wide.overflow > 1 || o.wide.tabindex !== null || o.narrow.overflow <= 1 || o.narrow.tabindex !== '0' || o.narrow.role !== 'region' || !o.narrow.label || !(o.scrolledPx > 0)).map(([k]) => k);
        rec('A-ux-1', 'A sideways-scrolling table (Checkout procedures, Ledger rows) is not reachable from the keyboard while it overflows, or keeps a tab stop while it fits, or does not scroll on ArrowRight', 'WCAG 2.1.1; axe scrollable-region-focusable; docs/16 accessibility baseline', bad.length > 0, { ...out, failing: bad, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-2 · ARIA 1.2 prohibited attributes (axe aria-prohibited-attr, "needs review" in the baseline) · seventeen labelled
    // div/span elements carried aria-label with no role. Reproduced when any route paints such an element.
    async 'A-ux-2'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const found = {};
        for (const hash of ['#/frontdesk/board', '#/frontdesk/checkout/a-1044', '#/biller/money', '#/biller/ledger/p-319', '#/hygienist/chairs', '#/hygienist/perio/enc-9001', '#/dentist/exams', '#/dentist/encounter/enc-9002', '#/owner/close', '#/compliance/risk', '#/compliance/roles', '#/temp/board', '#/phone/approvals']) {
          await go(p, hash);
          if (hash.includes('phone')) { const s = await p.$('[data-testid="phone.simulate"]'); if (s) { await s.click(); await p.waitForTimeout(200); } }
          const hits = await labelledGeneric(p); if (hits.length) found[hash] = hits;
        }
        rec('A-ux-2', 'A div, span or p carries aria-label with no role, so its label is prohibited by ARIA and ignored by screen readers', 'ARIA 1.2 prohibited attributes; axe aria-prohibited-attr; docs/16 accessibility baseline', Object.keys(found).length > 0, { found, pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
