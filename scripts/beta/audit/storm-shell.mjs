// Fix-storm checks for the shell owner: prototype/js/screens/shell.js, signin.js, palette.js, ui.js, app.js,
// router.js, index.html. Each check states the storm finding it guards, drives the prototype and measures
// the breach; default position is NOT reproduced, and every check carries the precondition it needed.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, state, events, rec }) => {
  const evalIn = (p, fn) => p.evaluate(fn);
  const padOpen = (p) => evalIn(p, () => !!document.querySelector('#dialogs .dialog'));
  const live = (p) => evalIn(p, () => document.getElementById('live').textContent);
  const clearLive = (p) => evalIn(p, () => { document.getElementById('live').textContent = ''; });
  const focused = (p) => evalIn(p, () => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName; });
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const refusalsSince = async (p, seq) => (await events(p)).filter((e) => e.seq > seq && e.kind === 'refusal').map((e) => e.code);
  const typeKeys = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(60); };
  const key = async (p, k) => { await p.keyboard.press(k); await p.waitForTimeout(120); };
  const tempSignin = async (p) => { await go(p, '#/frontdesk/roles'); await click(p, 'roles.daypass.add'); await p.fill('[data-testid="roles.daypass.name"]', 'Sam Lee'); await click(p, 'roles.daypass.save'); await click(p, 'roles.daypass.signin'); await p.waitForTimeout(200); };
  const heldWriteoff = async (p) => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); };

  return {
    // shell-nav-1, shell-nav-2, encounter-11: openPinPad added its keydown listener to the document and removed
    // it only from its own Cancel path, so Escape, the backdrop and a route change left it alive: Enter on any
    // control was swallowed, and digits typed anywhere plus Enter switched the author. Negative control: with
    // the pad closed, Enter on Arrive arrives the patient and 1357 Enter on the canvas changes nothing.
    async 'A-storm-shell-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        const opened = (await click(p, 'topbar.author')) && await padOpen(p);
        await key(p, 'Escape');
        const closed = !(await padOpen(p));
        await press(p, 'board.card.a-1042.arrive');
        const afterEnter = (await state(p)).appointments.find((a) => a.id === 'a-1042').status;
        await evalIn(p, () => document.getElementById('canvas').focus());
        const before = await evalIn(p, () => Proto.store.currentUser().id);
        await typeKeys(p, '1357'); await key(p, 'Enter'); await p.waitForTimeout(250);
        const after = await evalIn(p, () => ({ user: Proto.store.currentUser().id, persona: window.__proto.persona, hash: location.hash }));
        const sessions = (await state(p)).sessions.length;
        rec('A-storm-shell-1', 'Closing the author PIN pad with Escape leaves its keydown handler installed: Enter on Arrive is swallowed and 1357 Enter typed on the canvas opens a dentist session', 'docs/13 feature 28 (a dismissed pad is inert); CONTRACTS §5 (Enter on a focused control is a tap) — shell.js openPinPad',
          opened && closed && (afterEnter !== 'arrived' || after.user !== before || sessions > 0), { opened, closed, afterEnter, before, after, sessions });
      } finally { await c.close(); }
    },

    // shell-nav-3: the skip link's href="#canvas" was a hash the router parsed as an unknown persona, so Enter
    // on "Skip to work" rendered sign-in and dropped the Board and the open Rail. Negative control: focus lands
    // in #canvas, the hash still names the board and the rail stays open.
    async 'A-storm-shell-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await press(p, 'board.card.a-1042.rail');
        const railBefore = await evalIn(p, () => !document.getElementById('rail').hidden);
        await evalIn(p, () => document.querySelector('[data-testid="skip.canvas"]').focus());
        await key(p, 'Enter'); await p.waitForTimeout(200);
        const r = await evalIn(p, () => ({ hash: location.hash, signin: !!document.querySelector('[data-testid="signin.go"]'), board: !!document.querySelector('[data-testid="board.card.a-1042"]'), rail: !document.getElementById('rail').hidden, focusInCanvas: document.getElementById('canvas').contains(document.activeElement) || document.activeElement === document.getElementById('canvas') }));
        rec('A-storm-shell-2', 'Enter on the skip link sets the hash to #canvas, which the router renders as sign-in, discarding the Board and the open Patient Rail', 'docs/04 keyboard-first (a skip link moves focus, never navigates); CONTRACTS §2 — index.html skip.canvas, router.js parse',
          railBefore && (r.signin || !r.board || !r.rail || !/^#\/frontdesk\/board/.test(r.hash)), { railBefore, ...r });
      } finally { await c.close(); }
    },

    // shell-nav-4: every option toggle on sign-in re-rendered the screen and the chosen persona fell back to
    // Front desk, so Biller then Dark then Go landed on the Board. Negative control: biller stays pressed and
    // Go lands on #/biller/money.
    async 'A-storm-shell-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/signin');
        await click(p, 'signin.persona.biller');
        const pressedOf = () => evalIn(p, () => ([...document.querySelectorAll('[data-testid^="signin.persona."]')].find((x) => x.getAttribute('aria-pressed') === 'true') || { getAttribute: () => null }).getAttribute('data-testid'));
        const p1 = await pressedOf();
        await click(p, 'signin.theme.dark');
        const p2 = await pressedOf();
        await click(p, 'signin.go'); await p.waitForTimeout(200);
        const hash = await evalIn(p, () => location.hash);
        rec('A-storm-shell-3', 'Picking Biller then toggling Dark on sign-in resets the pressed persona to Front desk, and Go lands on #/frontdesk/board', 'docs/13 feature 28 (pick persona, set options, go); CONTRACTS §2 persona homes — signin.js render',
          p1 === 'signin.persona.biller' && (p2 !== 'signin.persona.biller' || hash !== '#/biller/money'), { p1, p2, hash });
      } finally { await c.close(); }
    },

    // shell-nav-5: three wrong PINs logged one refusal (the same gate is deduped as a re-render), locked
    // nothing, and a fourth, correct PIN switched the author. Negative control: three refusal events, the
    // fourth attempt is refused and the author stays u-fd-1.
    async 'A-storm-shell-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        const opened = (await click(p, 'topbar.author')) && await padOpen(p);
        const seq0 = await lastSeq(p);
        for (let i = 0; i < 3; i++) { await typeKeys(p, '0000'); await key(p, 'Enter'); }
        const refs = await refusalsSince(p, seq0);
        const why = await evalIn(p, () => (document.querySelector('#dialogs .refusal .whytext') || {}).textContent || '');
        const stillOpen = await padOpen(p);
        if (stillOpen) { await typeKeys(p, '1357'); await key(p, 'Enter'); await p.waitForTimeout(250); }
        const user = await evalIn(p, () => Proto.store.currentUser().id);
        const sessions = (await state(p)).sessions.length;
        rec('A-storm-shell-4', 'Three wrong PINs produce one refusal event instead of three and apply no lock, so a fourth correct PIN switches the author although the Why text promises a five-minute lock', 'docs/13 feature 28 (three misses lock the device); CONTRACTS §5 (every refusal shown is a refusal event), §6 (Why text is true) — shell.js openPinPad, ui.js refusal',
          opened && (refs.length < 3 || user !== 'u-fd-1' || sessions > 0), { opened, refusals: refs, whyAfterThird: why, padStillOpen: stillOpen, user, sessions });
      } finally { await c.close(); }
    },

    // shell-nav-6: a second wrong date of birth in the palette re-showed the same gate but ui.refusal deduped
    // it as a re-render, so the second miss logged nothing and announced nothing. Negative control: two misses,
    // two second_identifier events, and the live region reads the verb after the second miss too.
    async 'A-storm-shell-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await click(p, 'topbar.search'); await typeKeys(p, 'fis'); await click(p, 'palette.row.0');
        const seq0 = await lastSeq(p);
        await typeKeys(p, '01/01/2000'); await key(p, 'Enter'); await p.waitForTimeout(150);
        const live1 = await live(p);
        await p.click('#dialogs [data-testid="refusal.control"]'); await p.waitForTimeout(100);
        await clearLive(p);
        await typeKeys(p, '02/02/2002'); await key(p, 'Enter'); await p.waitForTimeout(200);
        const shown = await evalIn(p, () => !!document.querySelector('#dialogs .refusal[data-code="second_identifier"]'));
        const live2 = await live(p);
        const refs = await refusalsSince(p, seq0);
        rec('A-storm-shell-5', 'A second wrong date of birth in the palette shows the refusal card again but logs no refusal event and announces nothing', 'CONTRACTS §5 (each refusal shown is one refusal event), §6 (announced) — ui.js refusal dedupe via palette.js confirmDob',
          live1 === 'Check the date of birth' && shown && (live2 === '' || refs.length < 2), { live1, shown, live2, refusals: refs });
      } finally { await c.close(); }
    },

    // shell-nav-8: __proto.reset() rebuilt the store and re-rendered the canvas but not the shell, so the Andon
    // kept "1 approval waiting" over an empty approvals list. Negative control: after reset the Andon is empty.
    async 'A-storm-shell-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await heldWriteoff(p);
        await hop(p, '#/owner/close');
        const before = await evalIn(p, () => document.getElementById('andon').textContent);
        await evalIn(p, () => window.__proto.reset()); await p.waitForTimeout(150);
        const after = await evalIn(p, () => ({ text: document.getElementById('andon').textContent, pending: Proto.store.pendingApprovalsFor().length }));
        rec('A-storm-shell-6', 'After __proto.reset() clears the pending approval the Andon still announces "1 approval waiting"', 'docs/13 feature 30 (the Andon reflects live state); CONTRACTS §3 reset() — app.js P.reset',
          /1 approval waiting/.test(before) && after.pending === 0 && /approval/.test(after.text), { before, after });
      } finally { await c.close(); }
    },

    // shell-nav-9: on sign-in the top-bar theme control re-rendered the bar only, so the sign-in Dark button
    // stayed pressed while the theme was light. Negative control: both surfaces read the same theme.
    async 'A-storm-shell-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/signin');
        await click(p, 'signin.theme.dark');
        const a = await evalIn(p, () => window.__proto.theme);
        await click(p, 'topbar.theme');
        const r = await evalIn(p, () => ({ theme: window.__proto.theme, dark: document.querySelector('[data-testid="signin.theme.dark"]').getAttribute('aria-pressed'), light: document.querySelector('[data-testid="signin.theme.light"]').getAttribute('aria-pressed') }));
        rec('A-storm-shell-7', 'On sign-in, pressing the top-bar theme control flips the theme to light while signin.theme.dark stays aria-pressed=true', 'docs/13 feature 28 (options are shared shell state; both surfaces mirror it) — shell.js renderTopbar',
          a === 'dark' && r.theme === 'light' && (r.dark !== 'false' || r.light !== 'true'), { afterSigninDark: a, ...r });
      } finally { await c.close(); }
    },

    // shell-nav-10: signin render() ended with go.focus(), so every option toggle moved the keyboard to Open my
    // home. Negative control: after Enter on each toggle the focus is on that toggle's replacement.
    async 'A-storm-shell-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/signin');
        const out = [];
        for (const t of ['signin.device.shared', 'signin.motion', 'signin.grayscale', 'signin.privacy', 'signin.outage', 'signin.afterhours', 'signin.theme.dark']) { const ok = await press(p, t); out.push({ t, pressed: ok, focus: await focused(p) }); }
        rec('A-storm-shell-8', 'Every option toggle on sign-in moves keyboard focus to signin.go instead of keeping it on the toggled control', 'docs/04 keyboard-first (focus stays on the control you operated) — signin.js render',
          out.every((o) => o.pressed) && out.some((o) => o.focus !== o.t), { out });
      } finally { await c.close(); }
    },

    // shell-nav-11, invariants-7: P.reset put the outage flag back after rebuilding the store but not
    // clock.afterHours, so a page opened with ?afterHours=1 posted a courtesy write-off after a reset that the
    // pre-reset store had held. Negative control: afterHours survives reset and the write-off is held.
    async 'A-storm-shell-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money?afterHours=1');
        const before = await evalIn(p, () => window.__proto.state().clock.afterHours);
        await evalIn(p, () => window.__proto.reset()); await p.waitForTimeout(200);
        const after = await evalIn(p, () => window.__proto.state().clock.afterHours);
        await click(p, 'money.writeoff.p-306'); await p.fill('[data-testid="money.writeoff.amount"]', '20.00'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const posted = (await state(p)).ledger.some((r) => r.kind === 'write_off' && r.amountCents === -2000 && r.patientId === 'p-306');
        rec('A-storm-shell-9', '__proto.reset() on a page opened with ?afterHours=1 rebuilds the store with afterHours false, so the same page then posts a $20 courtesy write-off the pre-reset store held', 'CONTRACTS §3 (reset rebuilds the store for the same page; query flags drive the page) — app.js P.reset',
          before === true && (after !== true || posted), { before, after, posted });
      } finally { await c.close(); }
    },

    // shell-nav-12: P.set took any string, so ?theme=neon&device=tablet wrote data-theme="neon" and stamped
    // every event with values outside the contract. Negative control: unknown values are ignored.
    async 'A-storm-shell-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?theme=neon&device=tablet');
        const r = await evalIn(p, () => ({ theme: window.__proto.theme, device: window.__proto.device, dataTheme: document.documentElement.getAttribute('data-theme'), dataDevice: document.documentElement.getAttribute('data-device') }));
        await click(p, 'board.card.a-1042.arrive');
        const ev = (await events(p)).filter((e) => e.kind === 'click').pop() || {};
        rec('A-storm-shell-10', 'Query flags are applied without validation: ?theme=neon&device=tablet sets theme "neon" and device "tablet" on __proto, on <html> and on every event', 'CONTRACTS §5 event ctx (theme light|dark; device from the four profiles) — app.js P.set',
          !['light', 'dark'].includes(r.theme) || !['desk', 'operatory', 'shared', 'phone'].includes(r.device) || r.dataTheme === 'neon' || ev.theme === 'neon' || ev.device === 'tablet', { ...r, lastClick: { theme: ev.theme, device: ev.device } });
      } finally { await c.close(); }
    },

    // shell-nav-13: an unknown or upper-case persona parsed as sign-in, so #/FRONTDESK/board rendered the persona
    // picker and dropped the open Rail, and #/nope rendered sign-in instead of Nothing here. Negative control:
    // #/FRONTDESK/board keeps the Board and the Rail; #/nope shows notfound.home.
    async 'A-storm-shell-11'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await press(p, 'board.card.a-1042.rail');
        const railBefore = await evalIn(p, () => !document.getElementById('rail').hidden);
        await hop(p, '#/FRONTDESK/board');
        const a = await evalIn(p, () => ({ signin: !!document.querySelector('[data-testid="signin.go"]'), board: !!document.querySelector('[data-testid="board.card.a-1042"]'), rail: !document.getElementById('rail').hidden }));
        await hop(p, '#/nope');
        const b2 = await evalIn(p, () => ({ signin: !!document.querySelector('[data-testid="signin.go"]'), home: !!document.querySelector('[data-testid="notfound.home"]') }));
        rec('A-storm-shell-11', 'Hashes with an unknown or upper-case persona (#/nope, #/FRONTDESK/board) render sign-in instead of Nothing here, and #/FRONTDESK/board drops the open Patient Rail', 'CONTRACTS §2 (an unparseable route renders Nothing here with notfound.home) — router.js parse',
          railBefore && (a.signin || !a.board || !a.rail || b2.signin || !b2.home), { railBefore, upper: a, nope: b2, pageErrors: errs.slice() });
      } finally { await c.close(); }
    },

    // shell-nav-15: during an outage the PIN pad's refusal offered "Support line" and the control only closed
    // the pad; the Andon's control of the same name announces the number. Negative control: the pad's control
    // announces 615-555-0100.
    async 'A-storm-shell-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1');
        await click(p, 'topbar.author'); await typeKeys(p, '1357'); await key(p, 'Enter'); await p.waitForTimeout(200);
        const ref = await evalIn(p, () => { const r = document.querySelector('#dialogs .refusal'); return r ? { code: r.dataset.code, control: r.querySelector('[data-testid="refusal.control"]').textContent.trim() } : null; });
        await clearLive(p);
        await p.click('#dialogs [data-testid="refusal.control"]'); await p.waitForTimeout(250);
        const after = await live(p);
        rec('A-storm-shell-12', 'During an outage the PIN pad refusal\'s "Support line" control closes the pad and announces nothing, while the Andon\'s Support line announces 615-555-0100', 'CONTRACTS §6 (a control does what its label says) — shell.js openPinPad',
          !!ref && ref.code === 'outage' && /support/i.test(ref.control) && !/615-555-0100/.test(after), { ref, liveAfterControl: after });
      } finally { await c.close(); }
    },

    // shell-nav-16: under privacy the palette printed initials only, so two Vegas were two identical rows.
    // Negative control: rows for distinct patients read differently.
    async 'A-storm-shell-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?privacy=1');
        await click(p, 'topbar.search'); await typeKeys(p, 'veg');
        const rows = await evalIn(p, () => [...document.querySelectorAll('[data-testid^="palette.row."]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
        const patients = await evalIn(p, () => Proto.store.search('veg').filter((r) => r.kind === 'patient').map((r) => r.patientId));
        const names = await evalIn(p, () => Proto.store.search('veg').filter((r) => r.kind === 'patient').map((r) => r.label));
        const leaks = rows.some((t) => names.some((n) => t.includes(n)));
        rec('A-storm-shell-13', 'In privacy mode two palette rows for different patients render identical text (initials only), so the user cannot tell which row to pick', 'docs/13 feature 29 (rows are distinguishable; privacy hides PHI but keeps a disambiguator) — palette.js rowLabel',
          new Set(patients).size >= 2 && (new Set(rows).size < rows.length || leaks), { rows, patients, fullNameLeaked: leaks });
      } finally { await c.close(); }
    },

    // shell-nav-17: a temp with no day pass showed the chip "ND", the initials of the placeholder name "No day
    // pass issued". Negative control: the chip names the missing pass, not a person.
    async 'A-storm-shell-14'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board?device=shared');
        const chip = await txt(p, 'topbar.author');
        const noPass = await evalIn(p, () => !!Proto.store.currentUser().noPass);
        rec('A-storm-shell-14', 'A temp without a day pass shows the author chip "ND", the initials of the placeholder "No day pass issued", instead of a no-pass indicator', 'docs/13 feature 28 (the chip identifies the author; a placeholder must not read as initials) — shell.js renderTopbar',
          noPass && /^[A-Z]{2}$/.test(chip || ''), { chip, noPass });
      } finally { await c.close(); }
    },

    // owner-controls-10: a palette search retired the temp's "find" step in the store but the rail chip stayed
    // unretired until the next route change. Negative control: the chip reads retired as soon as the store does.
    async 'A-storm-shell-15'(b) {
      const { c, p } = await ctx(b);
      try {
        await tempSignin(p);
        const isTemp = await evalIn(p, () => window.__proto.persona === 'temp' && !!document.querySelector('[data-testid="rail1.chip.4"]'));
        await p.keyboard.press('Control+k'); await p.waitForTimeout(120); await typeKeys(p, 'vega'); await key(p, 'Escape');
        const retired = await evalIn(p, () => !!Proto.store.railStateFor().find);
        const chip = await evalIn(p, () => { const e = document.querySelector('[data-testid="rail1.chip.4"]'); return e ? e.dataset.retired : null; });
        rec('A-storm-shell-15', 'After the temp searches in the palette the store retires the "find" step but rail1.chip.4 stays data-retired=0 until the next route change', 'docs/13 feature 27 (the rail is derived from the event stream) — palette.js search path never refreshes the rail',
          isTemp && retired && chip === '0', { isTemp, retired, chip });
      } finally { await c.close(); }
    },

    // owner-controls-18: the "Take payment" chip pointed only at checkout.post, so on the Board it said
    // "Nothing to check out yet" beside a live Checkout control. Negative control: it rings that control.
    async 'A-storm-shell-16'(b) {
      const { c, p } = await ctx(b);
      try {
        await tempSignin(p);
        const hasCheckout = await evalIn(p, () => !![...document.querySelectorAll('[data-testid]')].find((e) => /^board\.card\..+\.checkout$/.test(e.getAttribute('data-testid'))));
        await click(p, 'rail1.chip.3'); await p.waitForTimeout(150);
        const l = await live(p);
        const pointed = await evalIn(p, () => [...document.querySelectorAll('.pointed')].map((e) => e.getAttribute('data-testid')));
        rec('A-storm-shell-16', 'The temp\'s "Take payment" chip announces "Nothing to check out yet" while a Checkout control is on the Board', 'docs/13 feature 27 (the rail points at the live control) — shell.js pulseFor',
          hasCheckout && (/Nothing to check out yet/.test(l) || !pointed.some((t) => /\.checkout$/.test(t || ''))), { hasCheckout, live: l, pointed });
      } finally { await c.close(); }
    },

    // owner-controls-19: the phone card keeps the patient's name behind a logged Show name tap while the Andon
    // strip on every home printed the full name with no tap. Negative control: the Andon sentence equals the
    // card's redacted one.
    async 'A-storm-shell-17'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/phone/approvals');
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const card = await evalIn(p, () => { const e = document.querySelector('.ph-sentence'); return e ? e.textContent.trim() : null; });
        const andon = await evalIn(p, () => document.getElementById('andon').textContent);
        const name = await evalIn(p, () => Proto.store.patient('p-306').name);
        rec('A-storm-shell-17', 'The phone card withholds the patient\'s name behind Show name while the Andon strip prints the same sentence with the full name and no tap', 'docs/13 feature 24 PHI (minimum necessary; full name only after a logged tap); one canonical sentence — shell.js renderAndon',
          !!card && !card.includes(name) && andon.includes(name), { card, andon, name });
      } finally { await c.close(); }
    },
  };
};
