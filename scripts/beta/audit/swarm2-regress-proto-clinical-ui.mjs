// Swarm 2 · regression hunt after the fix round, proto-clinical-ui lens (every check reproduces on swarm2/fix-harness and
// flips to "no" under a local patch of the named line). Targets are lines the fix round changed: the perio grid's new
// focusout handler (screens/perio.js:391) and the rail's new closeToOpener (screens/rail.js:87).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, click, txt, events, rec }) => {
  const active = (p) => p.evaluate(() => {
    const a = document.activeElement; if (!a) return null;
    return { tag: a.tagName, testid: a.getAttribute('data-testid') || null, id: a.id || null, isBody: a === document.body, tabindex: a.getAttribute('tabindex') };
  });
  const lastSeq = (p) => p.evaluate(() => { const ev = window.__events || []; return ev.length ? ev[ev.length - 1].seq : 0; });
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null);
  const activeSite = (p) => p.evaluate(() => { const e = document.querySelector('.activesite span'); return e ? e.textContent.trim() : null; });

  return {
    // perio.js:391 (new on fix-harness) drops st.pendingZero on the grid's focusout without re-rendering, while
    // perio.js:621 prints " · 10+…" from that flag. After "0" the active-site line promises a two-digit depth; Tab out
    // and Shift+Tab back leave the promise on screen, and the next "5" records 5 mm, not the 15 the line announced.
    // Negative control: when the focusout handler re-renders (or leaves the buffer alone), the line and the recorded
    // depth agree — either no "10+…" is shown or 15 is recorded — and the check reports false.
    async 'S2-regress-proto-clinical-ui-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        const first = await p.$eval('[data-testid^="perio.grid.cell."]', (e) => e.getAttribute('data-testid'));
        await p.click(`[data-testid="${first}"]`); await p.waitForTimeout(120);
        await p.keyboard.press('0'); await p.waitForTimeout(100);
        const afterZero = { line: await activeSite(p), focus: await active(p) };
        await p.keyboard.press('Tab'); await p.waitForTimeout(100);
        const afterTab = { line: await activeSite(p), focus: await active(p) };
        await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(100);
        const back = { line: await activeSite(p), focus: await active(p) };
        const seq0 = await lastSeq(p);
        await p.keyboard.press('5'); await p.waitForTimeout(120);
        const cell = await txt(p, first);
        const live = await p.evaluate(() => (document.getElementById('live') || {}).textContent || null);
        const ev = await after(p, seq0);
        const promised = /10\+/.test(afterZero.line || '') && /10\+/.test(afterTab.line || '') && /10\+/.test(back.line || '');
        const reproduced = promised && back.focus && back.focus.testid === first && cell === '5';
        rec('S2-regress-proto-clinical-ui-1', 'After a leading "0" the perio active-site line keeps reading "10+…" once focus has left and returned to the grid, but the pending zero was dropped on focusout, so the next "5" records 5 mm where the screen promised a two-digit depth (15)',
          'A2 (the state line is the state) / B10; perio.js:391 focusout clears pendingZero without a re-render; perio.js:621 prints the flag',
          reproduced, { cell: first, afterZero, afterTab, back, recordedDepth: cell, liveAfterDigit: live, seqRange: range(ev), pageErrors: errs });
      } finally { await c.close(); }
    },

    // rail.js:86-92 (closeToOpener, new on fix-harness) falls back from the missing opener to `[data-testid="board.card.<id>"]`,
    // an <article> with no tabindex: focus() on it is a no-op and the keyboard lands on <body>. The `#canvas h1` fallback would
    // not take either: the Board re-render that collapsed the card rebuilt the h1 without the tabindex="-1" ui.js landFocus adds
    // lazily. Sequence: expand a Board card, open its rail, collapse the card (Show details) with the rail still open, press
    // rail.close. Negative control: when closeToOpener gives its target a tabindex before focusing (or falls through to the h1
    // and makes it focusable, as landFocus does), activeElement after Close is the card or the Board h1 and the check reports false.
    async 'S2-regress-proto-clinical-ui-2'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const aid = 'a-1044';
        await click(p, `board.card.${aid}.expand`); await p.waitForTimeout(120);
        const hasOpener = !!(await p.$(`[data-testid="board.card.${aid}.rail"]`));
        await p.focus(`[data-testid="board.card.${aid}.rail"]`); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const opened = { railHidden: await p.$eval('#rail', (e) => e.hidden), focus: await active(p) };
        await click(p, `board.card.${aid}.expand`); await p.waitForTimeout(120);
        const collapsed = { openerInDom: !!(await p.$(`[data-testid="board.card.${aid}.rail"]`)), railHidden: await p.$eval('#rail', (e) => e.hidden), expandAria: await p.$eval(`[data-testid="board.card.${aid}.expand"]`, (e) => e.getAttribute('aria-expanded')) };
        const card = await p.$eval(`[data-testid="board.card.${aid}"]`, (e) => ({ tag: e.tagName, tabindex: e.getAttribute('tabindex') })).catch(() => null);
        await p.focus('[data-testid="rail.close"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const closed = { railHidden: await p.$eval('#rail', (e) => e.hidden), focus: await active(p), h1: await p.$eval('#canvas h1', (e) => ({ text: e.textContent.trim(), tabindex: e.getAttribute('tabindex') })).catch(() => null), expandInDom: !!(await p.$(`[data-testid="board.card.${aid}.expand"]`)) };
        const reproduced = hasOpener && opened.railHidden === false && opened.focus && opened.focus.testid === 'rail.close' && !collapsed.openerInDom && collapsed.railHidden === false
          && closed.railHidden === true && !!closed.h1 && !!closed.focus && closed.focus.isBody;
        rec('S2-regress-proto-clinical-ui-2', 'Closing the patient rail after the Board card that opened it was collapsed drops focus on <body>: closeToOpener falls back to the non-focusable card <article>, and the re-rendered Board h1 it would fall back to next carries no tabindex either',
          'B10 — after a mutation focus lands on the next action or state line, never on body; rail.js:86-92 closeToOpener',
          reproduced, { hasOpener, opened, collapsed, card, closed, pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
