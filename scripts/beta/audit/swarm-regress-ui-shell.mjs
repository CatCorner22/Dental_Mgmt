// Swarm regression hunt after the G4 fix round, lens ui-shell: shell.js, ui.js, index.html, board.js, CONTRACTS §4/§5.
// Hunted on swarm/fix-G4-contract-and-harness-coverage. Line references are to that branch.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const brief = (ev) => ev.map((e) => e.seq + ':' + e.kind + (e.code ? '/' + e.code : e.table ? '/' + e.table + '/' + e.id : e.key ? '/' + e.key + (e.testid ? '@' + e.testid : '') : e.testid ? '/' + e.testid : ''));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });
  const overlays = (p) => p.evaluate(() => document.querySelectorAll('#dialogs .overlay').length);
  const dots = (p) => p.evaluate(() => ((document.querySelector('#dialogs .pindots') || {}).textContent || ''));
  const gateIds = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((g) => ({ code: g.dataset.code, ids: [...g.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid')) })));
  // Counts the verb lines the shared component hands to the live region: announce() is the only way a gate is read aloud.
  const tapAnnounce = (p) => p.evaluate(() => { window.__ann = []; const o = Proto.router.announce; Proto.router.announce = (t) => { window.__ann.push(t); return o(t); }; });
  const announced = (p) => p.evaluate(() => window.__ann.slice());

  return {
    // shell.js:101-107 onPadKey is a capture-phase document listener that preventDefault-s Enter on every target that is not
    // an INPUT/TEXTAREA or pin.cancel and calls submit(). The pad's own dialog holds other controls: the pin_no_match gate's
    // "Clear and retype" (refusal.control), the two disclosures (pin.why, refusal.why) and pin.backspace. Enter on the focused
    // refusal.control never fires the control: submit() runs with the two typed digits, pin_no_match is raised again, the
    // node under the keyboard is replaced (replaceChildren at :74) and document.activeElement is body inside an open dialog
    // (B10). Enter on pin.why leaves the <details> closed; Enter on pin.backspace wipes every digit instead of one.
    // Negative control: once onPadKey ignores Enter on any target other than a digit key (or lets buttons and summaries keep
    // their default activation), Enter on refusal.control runs onControl and focus is pin.key.1, Enter on pin.why opens the
    // disclosure and Enter on pin.backspace leaves one dot; then controlSwallowed, whyStuck and backspaceWiped are all false
    // and the check reports false. The pad must be open with the gate standing or the scenario is not this claim.
    async 'S-regress-ui-shell-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        await click(p, 'topbar.author'); await p.waitForTimeout(120);
        const padOpen = !!(await p.$('[data-testid="pin.key.1"]'));
        await p.keyboard.type('12'); await p.keyboard.press('Enter'); await p.waitForTimeout(120);
        const gateStanding = !!(await p.$('#dialogs .refusal[data-code="pin_no_match"]'));
        await p.keyboard.type('12'); await p.waitForTimeout(60);
        const dotsBeforeControl = await dots(p);
        const seq0 = await lastSeq(p);
        await p.focus('[data-testid="refusal.control"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        const ev1 = await after(p, seq0);
        const afterControl = { focus: await active(p), dots: await dots(p), overlays: await overlays(p), clicked: ev1.some((e) => e.kind === 'click' && e.testid === 'refusal.control') };
        const controlSwallowed = gateStanding && dotsBeforeControl === '••' && !afterControl.clicked && afterControl.focus !== 'pin.key.1' && afterControl.overlays === 1;
        const focusOnBody = afterControl.focus === 'BODY';
        // Enter on the Why disclosure inside the pad
        const whyEl = await p.$('[data-testid="pin.why"]');
        let whyOpen = null;
        if (whyEl) { await p.focus('[data-testid="pin.why"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(100); whyOpen = await p.evaluate(() => document.querySelector('[data-testid="pin.why"]').closest('details').open); }
        const whyStuck = whyOpen === false;
        // Enter on the Backspace key with three digits typed
        await p.keyboard.type('123'); await p.waitForTimeout(60);
        const dotsBeforeBackspace = await dots(p);
        const seq1 = await lastSeq(p);
        await p.focus('[data-testid="pin.backspace"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(120);
        const ev2 = await after(p, seq1);
        const dotsAfterBackspace = await dots(p);
        const backspaceWiped = dotsBeforeBackspace === '•••' && dotsAfterBackspace === '' && !ev2.some((e) => e.kind === 'click' && e.testid === 'pin.backspace');
        const reproduced = padOpen && gateStanding && (controlSwallowed || whyStuck || backspaceWiped);
        rec('S-regress-ui-shell-1', 'Inside the open Switch-author pad, Enter on the pin_no_match gate\'s "Clear and retype" control is swallowed by onPadKey (shell.js:105): the control never fires, submit() re-raises the gate with the typed digits and focus lands on body; Enter on pin.why leaves the disclosure closed and Enter on pin.backspace wipes every digit', 'A2/B10 — shell.js:101-107 onPadKey preventDefault-s Enter on every non-input target inside the dialog, not only on the digit keys it was written for; shell.js:74 replaceChildren removes the focused node',
          reproduced, { padOpen, gateStanding, dotsBeforeControl, afterControl, eventsAfterControl: brief(ev1), seqRangeControl: range(ev1, seq0), controlSwallowed, focusOnBody, whyOpen, whyStuck, dotsBeforeBackspace, dotsAfterBackspace, eventsAfterBackspace: brief(ev2), seqRangeBackspace: range(ev2, seq1), backspaceWiped });
      } finally { await c.close(); }
    },

    // ui.js:62-67 logs and announces a gate only when no earlier node with the same code|verb|control key is still connected.
    // shell.js:74 showRefusal builds the new pin_no_match node while the previous one is still in the slot (replaceChildren
    // evaluates its argument first), so every wrong PIN after the first is treated as a rerender: three misses log one
    // refusal event and announce the verb once. The palette got the same fix right because swapGo/Try again clears its
    // gate slot before the next raise (palette.js:321). A3 asks one refusal event per gate raise.
    // Negative control: once showRefusal clears the slot before building (or the pad tracks its own raise), each wrong PIN
    // logs its own pin_no_match event and re-announces the verb; then refusalEvents equals wrongPins and the check reports false.
    async 'S-regress-ui-shell-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        await tapAnnounce(p);
        await click(p, 'topbar.author'); await p.waitForTimeout(120);
        const padOpen = !!(await p.$('[data-testid="pin.key.1"]'));
        const seq0 = await lastSeq(p);
        const pins = ['12', '34', '56'];
        const gatesSeen = [];
        for (const pin of pins) { await p.keyboard.type(pin); await p.keyboard.press('Enter'); await p.waitForTimeout(120); gatesSeen.push(await p.evaluate(() => document.querySelectorAll('#dialogs .refusal[data-code="pin_no_match"]').length)); }
        const ev = await after(p, seq0);
        const refusalEvents = ev.filter((e) => e.kind === 'refusal' && e.code === 'pin_no_match').length;
        const announces = (await announced(p)).filter((t) => /PIN/.test(t)).length;
        const overlaysNow = await overlays(p);
        const everyRaiseVisible = gatesSeen.length === pins.length && gatesSeen.every((n) => n === 1);
        const reproduced = padOpen && overlaysNow === 1 && everyRaiseVisible && refusalEvents < pins.length;
        rec('S-regress-ui-shell-2', 'Three wrong PINs in the open Switch-author pad each render a pin_no_match gate but log one refusal event and announce the verb once: ui.js:63 treats a raise while the previous node is still connected as a rerender, and shell.js:74 builds the new node before the old one leaves the slot', 'A3 — ui.js:62-67 standing-node dedup; shell.js:74 replaceChildren(refusal(v)) evaluates the new gate while the old one stands',
          reproduced, { padOpen, wrongPins: pins.length, gatesSeenPerRaise: gatesSeen, refusalEvents, announces, events: brief(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // index.html:12 renders the skip link as <a href="#canvas">; router.js:9-21 parses "#canvas" as a path whose first segment
    // is not a persona and routes to signin, and app.js:68 rerenders on hashchange. Activating "Skip to work" on the Board
    // therefore leaves the Board for the sign-in screen (route signin, h1 "Riverbend Dental") — the opposite of its label.
    // Negative control: once the link targets the canvas without changing the route (a click handler that focuses #canvas,
    // or a router that ignores non-route fragments), the hash stays on the board route, the h1 is still the Board's and no
    // route event is logged; then routeLost is false and the check reports false.
    async 'S-regress-ui-shell-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const before = await p.evaluate(() => ({ hash: location.hash, route: Proto.router.current().route, h1: ((document.querySelector('#canvas h1') || {}).textContent || '').trim() }));
        const link = await p.$('[data-testid="skip.canvas"]');
        const seq0 = await lastSeq(p);
        if (link) { await p.focus('[data-testid="skip.canvas"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
        const ev = await after(p, seq0);
        const afterSkip = await p.evaluate(() => ({ hash: location.hash, route: Proto.router.current().route, h1: ((document.querySelector('#canvas h1') || {}).textContent || '').trim(), focus: document.activeElement === document.body ? 'BODY' : (document.activeElement.getAttribute('data-testid') || document.activeElement.tagName) }));
        const routeLost = !!link && before.route === 'board' && afterSkip.route !== 'board' && afterSkip.h1 !== before.h1;
        rec('S-regress-ui-shell-3', 'Activating the "Skip to work" link on the Board (skip.canvas, href="#canvas") routes to the sign-in screen: the router reads #canvas as a path with no persona and renders signin, so the skip link abandons the screen it promised to skip into', 'A2/B10 — index.html:12 href="#canvas" in a hash-routed app; router.js:18-19 maps an unknown first segment to signin',
          routeLost, { linkPresent: !!link, before, afterSkip, events: brief(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // ui.js:62-67 keys the standing-node dedup on code|verb|control alone. Two outage gates on two different Board cards share
    // the key ("outage|Wait for the server — checkout is read-only|Support line"), so the second card's raise is a "rerender"
    // of the first: two gates stand, one refusal event is logged, the second verb is never announced (A3, C8).
    // Negative control: once a raise on a different slot (a new gateFor node not replacing a connected one) logs its own
    // event — by keying on the slot or by letting the caller mark a fresh raise — the second Hold logs a second outage
    // refusal event; then secondRaiseSilent is false and the check reports false. Both gates must be on the page or the
    // scenario is not this claim.
    async 'S-regress-ui-shell-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1');
        await tapAnnounce(p);
        const seq0 = await lastSeq(p);
        await click(p, 'board.card.a-1045.checkout'); await p.waitForTimeout(100);
        const ev1 = await after(p, seq0);
        const seq1 = await lastSeq(p);
        await click(p, 'board.card.a-1046.checkout'); await p.waitForTimeout(100);
        const ev2 = await after(p, seq1);
        const gates = await p.evaluate(() => [...document.querySelectorAll('.refusal')].map((g) => ({ code: g.dataset.code, card: (g.closest('[data-testid^="board.card."]') || { getAttribute: () => null }).getAttribute('data-testid'), verb: (g.querySelector('.verb') || {}).textContent })));
        const firstLogged = ev1.filter((e) => e.kind === 'refusal' && e.code === 'outage').length;
        const secondLogged = ev2.filter((e) => e.kind === 'refusal' && e.code === 'outage').length;
        const announces = (await announced(p)).filter((t) => /checkout is read-only/.test(t)).length;
        const twoGates = gates.filter((g) => g.code === 'outage').length === 2 && new Set(gates.map((g) => g.card)).size === 2;
        const secondRaiseSilent = twoGates && firstLogged === 1 && secondLogged === 0;
        rec('S-regress-ui-shell-4', 'Under an outage, Hold on checkout for a-1045 and then for a-1046 stands two outage gates on two Board cards but logs one refusal event and announces once: ui.js:63 dedups on code|verb|control while a same-key node is connected, so a raise on a second card is counted as a rerender of the first', 'A3/C8 — ui.js:62-67 standing-node dedup keyed on the gate text, not on the slot it fills; board.js:110-114 goCheckout builds a fresh gateFor node per card',
          secondRaiseSilent, { gates, firstLogged, secondLogged, announces, eventsFirst: brief(ev1), seqRangeFirst: range(ev1, seq0), eventsSecond: brief(ev2), seqRangeSecond: range(ev2, seq1) });
      } finally { await c.close(); }
    },

    // ui.js:70 renames every refusal.* id already on the page to refusal.prior.* before a new gate mounts, so the §4 contract
    // selectors name the newest gate. It never renames back: when the newer gate leaves (the pad closes on Escape) the only
    // gate left on the page carries refusal.prior…control, and each further raise prefixes it again (refusal.prior.prior.prior.*).
    // A visible gate then has no refusal.control (§4/B1: the DOM and §4 agree both ways) and any caller that queries the
    // contract selector — board.js:84 focusGate, the harness, an assistive script — finds nothing while the gate stands.
    // Negative control: once the live gate is renamed back (or the prior prefix is removed when the shadowing gate leaves),
    // the remaining gate's control reads refusal.control after the pad closes; then orphaned is false and the check reports false.
    async 'S-regress-ui-shell-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1&device=shared');
        await click(p, 'board.card.a-1045.checkout'); await p.waitForTimeout(100);
        const boardGateIds = await gateIds(p);
        await click(p, 'topbar.author'); await p.waitForTimeout(120);
        const seq0 = await lastSeq(p);
        for (const pin of ['12', '34', '56']) { await p.keyboard.type(pin); await p.keyboard.press('Enter'); await p.waitForTimeout(100); }
        const withPadIds = await gateIds(p);
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        const ev = await after(p, seq0);
        const afterPad = await p.evaluate(() => ({ overlays: document.querySelectorAll('#dialogs .overlay').length, gates: [...document.querySelectorAll('.refusal')].map((g) => ({ code: g.dataset.code, visible: g.offsetParent !== null, ids: [...g.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid')) })), contractControl: !!document.querySelector('[data-testid="refusal.control"]'), contractVerb: !!document.querySelector('[data-testid="refusal.verb"]') }));
        const boardHadContractIds = boardGateIds.length === 1 && boardGateIds[0].ids.includes('refusal.control');
        const orphaned = boardHadContractIds && afterPad.overlays === 0 && afterPad.gates.length === 1 && afterPad.gates[0].visible && !afterPad.contractControl && afterPad.gates[0].ids.some((id) => /^refusal\.prior\./.test(id));
        rec('S-regress-ui-shell-5', 'With an outage gate standing on the Board, three wrong PINs in the Switch-author pad and Escape leave the Board gate as the only gate on the page with ids refusal.prior.prior.prior.{verb,control,why}: no element carries refusal.control although a gate is visible, and the ids match no §4 entry', 'B1/§4 — ui.js:70 prefixes prior gate ids on every mount and never restores them when the shadowing gate leaves',
          orphaned, { boardGateIds, withPadIds, afterPad, events: brief(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
