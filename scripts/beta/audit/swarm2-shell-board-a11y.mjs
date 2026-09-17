// Swarm 2 · shell-board-a11y lens (verified: each check reproduces on f4032b3 and flips to no under a local fix of the named line): the shell in deep states (phone width, a dialog open across a route change,
// the patient rail's way out). Files: prototype/css/components.css (.topbar .btn.navmenu), prototype/js/ui.js
// (dialog close on hashchange → landFocus), prototype/js/screens/rail.js (rail.close handler).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, rec }) => {
  const dialogs = (p) => p.evaluate(() => [...document.querySelectorAll('#dialogs [role="dialog"]')].map((d) => d.getAttribute('aria-label')));
  const active = (p) => p.evaluate(() => {
    const a = document.activeElement; if (!a) return null;
    const canvas = document.getElementById('canvas');
    return { tag: a.tagName, testid: a.getAttribute('data-testid') || null, id: a.id || null, inCanvas: !!(canvas && canvas.contains(a)), isCanvas: a === canvas, inTopbar: !!a.closest('.topbar'), inRail: !!a.closest('#rail'), inDialog: !!a.closest('#dialogs') };
  });
  const h1 = (p) => p.evaluate(() => { const e = document.querySelector('#canvas h1'); return e ? e.textContent.trim() : null; });
  const hash = (p) => p.evaluate(() => location.hash);
  const lastSeq = (p) => p.evaluate(() => { const ev = window.__events || []; return ev.length ? ev[ev.length - 1].seq : 0; });

  return {
    // components.css:478 shows `.topbar .btn.navmenu` below 640 px and hides `.topbar nav`; components.css:542 then
    // hides `.topbar .btn.navmenu` again with an equal-specificity rule outside the media query, so it wins the
    // cascade at every width. Below 640 px both ways to another screen are display:none and the top bar carries
    // no destination at all (CONTRACTS §4: "nav.menu and nav.menu.<route> (the destinations, which collapse into
    // one control below 640 px)"). Negative control: at 420 px nav.menu is visible (display inline-flex, a box
    // ≥ 44 px), the nav.<route> row is hidden, and pressing nav.menu opens the "Go to" dialog with nav.menu.board.
    async 'S2-shell-board-a11y-1'(b) {
      const out = {};
      for (const [w, hh] of [[320, 860], [420, 860], [640, 900], [820, 900]]) {
        const { c, p, errs } = await ctx(b, w, hh);
        try {
          await go(p, '#/frontdesk/board' + (w <= 640 ? '?device=phone' : ''));
          const m = await p.evaluate(() => {
            const vis = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { display: cs.display, w: Math.round(r.width), h: Math.round(r.height), visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 }; };
            const q = (t) => document.querySelector('[data-testid="' + t + '"]');
            const routes = [...document.querySelectorAll('.topbar nav [data-testid^="nav."]')].map((e) => ({ testid: e.getAttribute('data-testid'), ...vis(e) }));
            const navEl = document.querySelector('.topbar nav');
            const topbarVisible = [...document.querySelectorAll('.topbar [data-testid]')].filter((e) => vis(e).visible).map((e) => e.getAttribute('data-testid'));
            return { width: innerWidth, navRow: vis(navEl), routes, menu: vis(q('nav.menu')), menuInDom: !!q('nav.menu'), topbarVisible, destinationsReachable: topbarVisible.filter((t) => /^nav\./.test(t)) };
          });
          let pressed = null;
          if (m.menuInDom) {
            // A hidden control cannot be pressed by a person; the harness asks the browser and records the refusal.
            pressed = await p.click('[data-testid="nav.menu"]', { timeout: 800 }).then(() => 'clicked').catch((e) => 'unreachable: ' + String(e.message).split('\n')[0].slice(0, 80));
            await p.waitForTimeout(120);
          }
          out[w] = { ...m, pressNavMenu: pressed, dialogsAfterPress: await dialogs(p), errs };
        } finally { await c.close(); }
      }
      const narrow = out[320], phone = out[420], mid = out[640], tablet = out[820];
      const breach = (o) => o && o.menuInDom && o.destinationsReachable.length === 0 && o.menu && !o.menu.visible && o.menu.display === 'none' && o.routes.length > 0 && o.routes.every((r) => !r.visible);
      rec('S2-shell-board-a11y-1', 'Below 640 px the topbar hides the nav.<route> row and also hides nav.menu (components.css:542 overrides the media rule at :478), so the shell offers no control that reaches another screen',
        'CONTRACTS §4 nav.menu collapses the destinations into one control below 640 px; docs/16 WCAG 2.1.1 / 1.4.10 — every destination stays reachable; components.css comment "The CSS shows exactly one of the two"',
        breach(narrow) && breach(phone) && breach(mid) && !!tablet && tablet.destinationsReachable.length > 0, out);
    },

    // ui.js dialog(): a hashchange closes the dialog and close() ends with landFocus(prev, prevId), the opener
    // (topbar.settings / topbar.author / topbar.search) that is still in the DOM — after app.js:110 has already rendered
    // the new screen and focused its h1 (focusHead, app.js:83). So Back (or Forward) with Settings, the author PIN pad or the palette open
    // leaves focus on a top-bar button of the old gesture instead of the heading of the screen that just arrived.
    // Negative control: after Back with each dialog open, document.activeElement is the #canvas h1 (or first
    // control) of the destination screen and no dialog remains.
    async 'S2-shell-board-a11y-2'(b) {
      const cases = {};
      for (const opener of ['topbar.settings', 'topbar.author', 'topbar.search']) {
        const { c, p, errs } = await ctx(b);
        try {
          await go(p, '#/frontdesk/board');
          await hop(p, '#/frontdesk/money');
          const before = { hash: await hash(p), h1: await h1(p), active: await active(p) };
          const seq0 = await lastSeq(p);
          if (!(await p.$(`[data-testid="${opener}"]`))) { cases[opener] = { missingOpener: true }; continue; }
          await p.click(`[data-testid="${opener}"]`); await p.waitForTimeout(150);
          const open = { dialogs: await dialogs(p), active: await active(p) };
          await p.goBack(); await p.waitForTimeout(350);
          const back = { hash: await hash(p), h1: await h1(p), dialogs: await dialogs(p), active: await active(p) };
          await p.goForward(); await p.waitForTimeout(350);
          const fwd = { hash: await hash(p), h1: await h1(p), dialogs: await dialogs(p), active: await active(p) };
          const seq1 = await lastSeq(p);
          cases[opener] = { before, open, back, fwd, seqRange: [seq0 + 1, seq1], errs };
        } finally { await c.close(); }
      }
      const stranded = Object.entries(cases).filter(([opener, k]) => !k.missingOpener && k.open.dialogs.length === 1 && k.open.active.inDialog
        && k.back.dialogs.length === 0 && k.back.hash === '#/frontdesk/board' && k.back.h1 && k.back.active && k.back.active.inTopbar && !k.back.active.inCanvas && k.back.active.testid === opener).map(([o]) => o);
      rec('S2-shell-board-a11y-2', 'Browser Back while Settings, the author PIN pad or the palette is open closes the dialog and lands focus on the top-bar opener of the old screen, not on the h1 of the screen that arrived',
        'B10 — focus after a route change is on the h1 or first control (docs/15 appendix); ui.js dialog close() → landFocus(prev) runs after the hashchange render',
        stranded.length > 0, { stranded, cases });
    },

    // rail.js renderRail(): the rail.close handler calls close() and then focuses #canvas (main, tabindex -1) — a
    // landmark, not a control — instead of the Rail toggle that opened it (board.card.<id>.rail, still in the DOM
    // with aria-pressed). The keyboard user who closed the rail from a Board card is put back at the top of the
    // canvas and must Tab through the whole Board to return to the card. Negative control: after rail.close,
    // document.activeElement is the opener board.card.a-1044.rail (or the card's next action), never the bare #canvas.
    async 'S2-shell-board-a11y-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const opener = 'board.card.a-1044.rail';
        await p.click('[data-testid="board.card.a-1044.expand"]'); await p.waitForTimeout(150);
        const hasOpener = !!(await p.$(`[data-testid="${opener}"]`));
        if (!hasOpener) { rec('S2-shell-board-a11y-3', 'rail.close drops focus on the bare #canvas landmark instead of the Rail toggle that opened it', 'B10 — after a mutation focus lands on the next action or state line', false, { hasOpener, note: 'opener not rendered; nothing measured' }); return; }
        await p.focus(`[data-testid="${opener}"]`); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const opened = { railHidden: await p.$eval('#rail', (e) => e.hidden), active: await active(p), openerPressed: await p.$eval(`[data-testid="${opener}"]`, (e) => e.getAttribute('aria-pressed')) };
        await p.focus('[data-testid="rail.close"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const closed = { railHidden: await p.$eval('#rail', (e) => e.hidden), active: await active(p), openerInDom: !!(await p.$(`[data-testid="${opener}"]`)), openerPressed: await p.$eval(`[data-testid="${opener}"]`, (e) => e.getAttribute('aria-pressed')).catch(() => null) };
        // Where the next Tab goes tells what the person lost: the first control of the canvas, not the card they worked.
        await p.keyboard.press('Tab'); await p.waitForTimeout(60);
        const afterTab = await active(p);
        const tabbablesBetween = await p.evaluate((tid) => {
          const canvas = document.getElementById('canvas'); const all = [...canvas.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"]), summary, a[href]')];
          const i = all.findIndex((e) => e.getAttribute('data-testid') === tid); return { total: all.length, indexOfOpener: i };
        }, opener);
        rec('S2-shell-board-a11y-3', 'Closing the patient rail from its Close button puts focus on the bare #canvas landmark (main) instead of returning it to the Rail toggle on the Board card that opened it',
          'B10 — after a mutation focus lands on the next action or state line; docs/16 WCAG 2.4.3 focus order (return to the opener); rail.js rail.close onClick focuses #canvas',
          opened.railHidden === false && opened.active.inRail && closed.railHidden === true && closed.openerInDom && closed.active && closed.active.isCanvas === true,
          { opened, closed, afterTab, tabbablesBetween, errs });
      } finally { await c.close(); }
    },
  };
};
