// First-shift intuition: a new front-desk or hygienist should never see a storage value,
// a leftover draft, or a headline that disagrees with the count beside it.
export default ({ ctx, go, hop, click, rec }) => {
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); return true; };
  const pinSwitch = async (p, digits) => {
    if (!(await click(p, 'topbar.author'))) return false;
    for (const d of String(digits)) await click(p, 'pin.key.' + d);
    await click(p, 'pin.submit');
    await p.waitForTimeout(220);
    return true;
  };

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

    async 'U-note-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9001');
        const r = await p.evaluate(() => {
          const starter = document.querySelector('[data-testid="enc.note.starter.0"]');
          if (starter) starter.click();
          return {
            assessment: (document.querySelector('[data-testid="enc.note.field.assessment"]') || {}).value || '',
            plan: (document.querySelector('[data-testid="enc.note.field.plan"]') || {}).value || '',
            verb: ((document.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(),
            live: [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent.trim()).filter(Boolean),
          };
        });
        rec('U-note-2', 'Caries confirmed on a visit with no tooth painted or tagged writes "#[tooth]" or fills Assessment anyway',
          'C3 — a starter names a tooth the chart holds, or it refuses; it never invents a placeholder',
          /#\[tooth\]|#null\b/.test(r.assessment + ' ' + r.plan) || (!!r.assessment && !/Pick a tooth first/i.test(r.verb)), r);
      } finally { await c.close(); }
    },

    async 'U-board-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        await click(p, 'board.card.a-1044.expand');
        const before = await p.evaluate(() => ({
          expanded: !!document.getElementById('board-details-a-1044'),
          aria: (document.querySelector('[data-testid="board.card.a-1044.expand"]') || {}).getAttribute('aria-expanded'),
        }));
        await pinSwitch(p, '6666');
        const after = await p.evaluate(() => ({
          user: Proto.store.currentUser().name,
          hash: location.hash,
          expanded: !!document.getElementById('board-details-a-1044'),
          aria: (document.querySelector('[data-testid="board.card.a-1044.expand"]') || {}).getAttribute('aria-expanded'),
          label: ((document.querySelector('[data-testid="board.card.a-1044.expand"]') || {}).textContent || '').trim(),
        }));
        rec('U-board-1', 'Switching author on the shared Board leaves Ines\'s Details open for Sam',
          'B9 — local drafts and expanders are per author',
          before.expanded && after.user === 'Sam Dawson' && (after.expanded || after.aria === 'true'), { before, after });
      } finally { await c.close(); }
    },

    async 'U-close-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close?device=shared');
        await click(p, 'close.closeday');
        const opened = !!(await p.$('[data-testid="close.closeday.confirm"]'));
        await pinSwitch(p, '6666');
        const after = await p.evaluate(() => ({
          user: Proto.store.currentUser().name,
          hash: location.hash,
          confirm: !!document.querySelector('[data-testid="close.closeday.confirm"]'),
        }));
        rec('U-close-1', 'Switching author on Daily Close hands Sam the previous author\'s Close day confirm group',
          'B9 — the second step of an irreversible verb belongs to the author who opened it',
          opened && after.user === 'Sam Dawson' && after.confirm, { opened, after });
      } finally { await c.close(); }
    },

    async 'U-close-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        await click(p, 'close.tied.tile');
        await click(p, 'close.variance.v-1.investigate');
        const rows = await p.evaluate(() => [...document.querySelectorAll('[aria-label="Variance v-1"] .dc-sentences li')].map((e) => e.textContent.trim()));
        rec('U-close-2', 'Investigate prints a raw ledger id (#le-…) in the sentence a person reads',
          'C3 — no storage values on the glass',
          rows.some((t) => /#(?:le-|rr-|v-)| · #[A-Za-z][\w-]*$/.test(t)), { rows });
      } finally { await c.close(); }
    },

    async 'U-exams-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/exams');
        await p.evaluate(() => {
          Proto.store.get().filedNotes.push({
            id: 'fn-old', encounterId: 'enc-9001', author: 'Dr. Hana Kim', filedOn: '2026-08-01', filedTime: '09:00',
            rulesetVersion: '2.25.2', byteauditOk: true, markdown: 'old note',
          });
        });
        await hop(p, '#/dentist/exams');
        const line = await p.evaluate(() => ((document.querySelector('.practice-line') || {}).textContent || '').trim());
        rec('U-exams-1', 'Exams "Practice today" counts a note filed on another day',
          'C5 — one fact has one value; the line names today',
          /1 note filed/.test(line), { line });
      } finally { await c.close(); }
    },

    async 'U-chairs-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs?device=shared');
        await click(p, 'chairs.card.a-1042.expand');
        const before = await p.evaluate(() => {
          const det = document.getElementById('chairs-details-a-1042');
          const btn = document.querySelector('[data-testid="chairs.card.a-1042.expand"]');
          return { open: !!(det && !det.hidden), aria: btn && btn.getAttribute('aria-expanded'), more: btn ? btn.textContent : null };
        });
        await pinSwitch(p, '2468');
        const after = await p.evaluate(() => {
          const det = document.getElementById('chairs-details-a-1042');
          const btn = document.querySelector('[data-testid="chairs.card.a-1042.expand"]');
          return {
            user: Proto.store.currentUser().name,
            hash: location.hash,
            open: !!(det && !det.hidden),
            aria: btn && btn.getAttribute('aria-expanded'),
            more: btn ? btn.textContent : null,
          };
        });
        rec('U-chairs-1', 'Switching author on Chairs leaves Marisol\'s More strip open for the dentist',
          'B9 — expanders are per author',
          before.open && /Reagan|Kim/.test(after.user) && after.open, { before, after });
      } finally { await c.close(); }
    },

    async 'U-perio-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001?device=shared');
        await click(p, 'perio.settings');
        await click(p, 'perio.path.quadrant');
        const bree = await p.evaluate(() => (document.querySelector('[data-testid="perio.path.quadrant"]') || {}).getAttribute('aria-pressed'));
        await pinSwitch(p, '2468');
        const opened = await click(p, 'perio.settings');
        const after = await p.evaluate(() => ({
          user: Proto.store.currentUser().name,
          hash: location.hash,
          quadrant: (document.querySelector('[data-testid="perio.path.quadrant"]') || {}).getAttribute('aria-pressed'),
          facial: (document.querySelector('[data-testid="perio.path.facial_lingual"]') || {}).getAttribute('aria-pressed'),
        }));
        rec('U-perio-2', 'Switching author on Perio hands the next author the previous operator\'s probing path',
          'B9 — a path preference belongs to its author',
          bree === 'true' && after.quadrant === 'true', { bree, opened, after });
      } finally { await c.close(); }
    },

    async 'U-perio-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        await click(p, 'perio.settings');
        await click(p, 'perio.path.quadrant');
        const first = await p.evaluate(() => (document.querySelector('[data-testid="perio.path.quadrant"]') || {}).getAttribute('aria-pressed'));
        await hop(p, '#/hygienist/perio/enc-9002');
        await click(p, 'perio.settings');
        const second = await p.evaluate(() => ({
          hash: location.hash,
          user: Proto.store.currentUser().name,
          quadrant: (document.querySelector('[data-testid="perio.path.quadrant"]') || {}).getAttribute('aria-pressed'),
          facial: (document.querySelector('[data-testid="perio.path.facial_lingual"]') || {}).getAttribute('aria-pressed'),
        }));
        rec('U-perio-3', 'Choosing Quadrant on one perio exam resets to Facial around on the next exam for the same author',
          'docs/13 feature 5 — probing path is a per-user preference chosen once',
          first === 'true' && second.quadrant !== 'true', { first, second });
      } finally { await c.close(); }
    },

    async 'U-rail-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        await click(p, 'board.card.a-1042.rail');
        await click(p, 'rail.explain');
        const before = await p.evaluate(() => ({
          pressed: (document.querySelector('[data-testid="rail.explain"]') || {}).getAttribute('aria-pressed'),
          body: !!document.querySelector('#rail .explain'),
        }));
        await pinSwitch(p, '6666');
        const after = await p.evaluate(() => ({
          user: Proto.store.currentUser().name,
          hash: location.hash,
          pressed: (document.querySelector('[data-testid="rail.explain"]') || {}).getAttribute('aria-pressed'),
          body: !!document.querySelector('#rail .explain'),
        }));
        rec('U-rail-1', 'Switching author on the shared desk leaves the previous author\'s Patient Rail Explain open',
          'B9 — the rail\'s expanders belong to the author, not the workstation',
          before.pressed === 'true' && after.user === 'Sam Dawson' && (after.pressed === 'true' || after.body), { before, after });
      } finally { await c.close(); }
    },

    async 'U-phone-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/phone/approvals');
        await click(p, 'phone.simulate');
        await p.waitForTimeout(200);
        const seen = await p.evaluate(() => {
          const canvas = document.getElementById('canvas');
          const cards = [...document.querySelectorAll('.ph-card, .ph-decided, .ph-notice, .ph-sim')];
          return {
            text: ((canvas && canvas.innerText) || '').replace(/\s+/g, ' ').trim(),
            labels: cards.map((el) => el.getAttribute('aria-label') || ''),
            notice: ((document.querySelector('.ph-notice') || {}).textContent || '').trim(),
            waiting: !!document.querySelector('.ph-card'),
          };
        });
        rec('U-phone-1', 'The Approvals card prints the storage request id (ar-1) in the sentence a person reads or hears',
          'C3 — no storage values on the glass',
          !seen.waiting || /\bar-1\b/.test([seen.text, seen.notice].concat(seen.labels).join(' ')), seen);
      } finally { await c.close(); }
    },
  };
};
