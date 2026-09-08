// Swarm lens a11y-devices: accessibility, keyboard and device states in transient and deep states
// (prototype/js/screens/*.js, prototype/css/*.css). proto-check and R14 measure the document in landing
// states; these checks measure the canvas, the rail-open state and the focus that a keyboard user is left with.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, click, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });

  // Canvas geometry plus every visible control whose right edge lies past the canvas's own right edge
  // (part or all of the 44 px target is only reachable by panning the canvas sideways).
  const canvasOverflow = (p) => p.evaluate(() => {
    const c = document.getElementById('canvas'); const cr = c.getBoundingClientRect();
    const wrap = document.querySelector('.enc-odont-wrap'); const rail = document.getElementById('rail');
    const off = [...c.querySelectorAll('button, textarea, input, select')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => { const b = e.getBoundingClientRect(); return { id: e.getAttribute('data-testid') || e.tagName, left: Math.round(b.left), right: Math.round(b.right), visiblePx: Math.max(0, Math.round(Math.min(b.right, cr.right) - Math.max(b.left, cr.left))) }; })
      .filter((x) => x.right > cr.right + 1);
    return {
      viewport: window.innerWidth, documentScrollWidth: document.documentElement.scrollWidth,
      canvasClientWidth: c.clientWidth, canvasScrollWidth: c.scrollWidth, canvasRight: Math.round(cr.right), canvasOverflowX: getComputedStyle(c).overflowX,
      odontWrap: wrap ? { clientWidth: wrap.clientWidth, scrollWidth: wrap.scrollWidth, scrolls: wrap.scrollWidth > wrap.clientWidth } : null,
      railOpen: rail ? !rail.hidden : null, railWidth: rail ? Math.round(rail.getBoundingClientRect().width) : null,
      offscreenControls: off.length, fullyOffscreen: off.filter((x) => x.visiblePx === 0).map((x) => x.id), sample: off.slice(0, 8),
    };
  });

  return {
    // B11/docs/04 (wide content scrolls inside its own container; the page never pans sideways) · components.css:249-250
    // `.enc-layout { grid-template-columns: minmax(856px, 1.25fr) minmax(320px, 1fr) }` / `1fr` below 1280: the 1fr track is
    // minmax(auto, 1fr), so the column grows to the odontogram's min-content width (16 × 44 + 15 × 8 = 824 px; 8 × 44 + 7 × 8 = 408 px
    // at ≤ 640) instead of letting `.enc-odont-wrap { overflow-x: auto }` scroll, and at 1280 with the rail open the 856 + 16 + 320 px
    // minimum exceeds the 928 px canvas. The canvas (overflow: auto) absorbs the excess, so document.scrollWidth stays equal to the
    // viewport and R14 / proto-check see nothing while teeth, the tag chip, the Note textareas and File sit past the canvas edge.
    // Negative control: once the column is minmax(0, 1fr) (or the odontogram wrapper is allowed to scroll) canvasScrollWidth equals
    // canvasClientWidth at 420, 820, 1024 + rail and 1280 + rail, odontWrap.scrolls is true where the odontogram is wider than the
    // canvas, offscreenControls is 0 in every state, and the check reports false.
    async 'S-a11y-devices-1'(b) {
      const states = [
        { w: 420, route: '#/dentist/encounter/enc-9002?device=phone', open: null },
        { w: 820, route: '#/dentist/encounter/enc-9002?device=operatory', open: null },
        { w: 1024, route: '#/dentist/encounter/enc-9002', open: 'enc.rail' },
        { w: 1280, route: '#/dentist/encounter/enc-9002', open: 'enc.rail' },
      ];
      const out = [];
      for (const s of states) {
        const { c, p, errs } = await ctx(b, s.w, 900);
        try {
          await go(p, s.route);
          const landing = await canvasOverflow(p);
          const opened = s.open ? await click(p, s.open) : null;
          if (s.open) await p.waitForTimeout(250);
          const deep = s.open ? await canvasOverflow(p) : landing;
          out.push({ width: s.w, route: s.route, opened, errs, landingCanvasScrollWidth: landing.canvasScrollWidth, ...deep });
        } finally { await c.close(); }
      }
      // Breach: the canvas pans sideways (scrollWidth > clientWidth) while the document does not, and a real control is past the edge.
      const breached = out.filter((o) => o.canvasScrollWidth > o.canvasClientWidth + 1 && o.documentScrollWidth <= o.viewport && o.offscreenControls > 0);
      const wrapNeverScrolls = out.every((o) => !o.odontWrap || !o.odontWrap.scrolls);
      const reproduced = breached.length >= 3 && wrapNeverScrolls;
      rec('S-a11y-devices-1', 'The Encounter canvas pans sideways at 420 (450 > 420), 820 (866 > 820), 1024 + rail (866 > 704) and 1280 + rail (1208 > 960) because .enc-layout\'s 1fr/856px columns grow to the odontogram\'s width: teeth 16/17 keep 11 px of their 44 px, File and the Note textareas overhang the edge and at 1024 + rail six teeth are fully off-screen, while document.scrollWidth stays equal to the viewport so R14 and proto-check report nothing',
        'B11, docs/04 (wide content scrolls inside its own container; the visible target is the touch target); components.css:249-250',
        reproduced, { statesBreached: breached.map((o) => o.width + (o.railOpen ? '+rail' : '')), odontWrapScrollsAnywhere: !wrapNeverScrolls, states: out });
    },

    // B10 (after a mutation focus lands on the next action or state line, never on body) · board.js:105-109 doReverify.
    // The refusal branch is `gates[id] = gateFor(res); render(r); return;` — the only Board action whose refusal path neither
    // re-focuses its own button (doArrive/doSeat do) nor calls focusGate() (goCheckout/doPing/holdStrip do). render(r) replaces the
    // card, the focused Re-verify button is detached, and document.activeElement falls to body; the next Tab lands on the chair
    // strip at the top of the page.
    // Negative control: after the fix Enter on Re-verify under outage leaves focus on refusal.control (or the Re-verify button):
    // activeAfter !== 'BODY' on desk, operatory and phone, and the check reports false.
    async 'S-a11y-devices-2'(b) {
      const devices = [{ w: 1280, q: '?outage=1' }, { w: 1024, q: '?outage=1&device=operatory' }, { w: 420, q: '?outage=1&device=phone' }];
      const out = [];
      for (const d of devices) {
        const { c, p, errs } = await ctx(b, d.w, 900);
        try {
          await go(p, '#/frontdesk/board' + d.q);
          const sel = '[data-testid="board.card.a-1042.reverify"]';
          if (!(await p.$(sel))) { out.push({ width: d.w, query: d.q, reverifyPresent: false }); continue; }
          await p.focus(sel);
          const activeBefore = await active(p); const seq0 = await lastSeq(p);
          await p.keyboard.press('Enter'); await p.waitForTimeout(250);
          const activeAfter = await active(p);
          const dom = await p.evaluate(() => {
            const card = document.querySelector('[data-testid="board.card.a-1042"]');
            const gate = card && card.querySelector('.gate .refusal');
            return { outage: window.__proto.outage, gateCode: gate ? gate.dataset.code || null : null, gateVerb: gate ? (gate.querySelector('[data-testid="refusal.verb"]') || {}).textContent || null : null, gateControlPresent: !!(gate && gate.querySelector('[data-testid="refusal.control"]')), live: document.getElementById('live').textContent };
          });
          await p.keyboard.press('Tab'); await p.waitForTimeout(60);
          const activeAfterTab = await active(p);
          const ev = (await after(p, seq0)).map((e) => ({ seq: e.seq, kind: e.kind, testid: e.testid || null, code: e.code || null }));
          out.push({ width: d.w, query: d.q, reverifyPresent: true, errs, activeBefore, activeAfter, activeAfterTab, ...dom, eventSeqRange: ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null, events: ev });
        } finally { await c.close(); }
      }
      const dropped = out.filter((o) => o.reverifyPresent && o.outage === true && o.gateCode === 'outage' && o.gateControlPresent && o.activeBefore === 'board.card.a-1042.reverify' && o.activeAfter === 'BODY' && o.events.some((e) => e.kind === 'refusal' && e.code === 'outage'));
      const reproduced = dropped.length === out.filter((o) => o.reverifyPresent).length && dropped.length > 0;
      rec('S-a11y-devices-2', 'Enter on Re-verify (a-1042) during an outage renders the Stop gate "Wait for the server — eligibility cannot re-run" with its Support line control, then leaves document.activeElement on body on desk, operatory and phone; the next Tab starts over at the chair strip (board.chair.1), while Arrive/Seat/Checkout/Ping refusals keep focus',
        'B10 (focus never on body after a mutation or refusal); board.js:105-109 doReverify refusal branch',
        reproduced, { devicesDropped: dropped.map((o) => o.width + o.query), devices: out });
    },
  };
};
