// Round-3 fix-storm checks for the shell owner: prototype/js/screens/shell.js, palette.js, signin.js, ui.js, app.js,
// router.js, prototype/js/screens/encounter.js, css. Each check names the round-3 finding it guards, drives the
// prototype and measures the breach; default position is NOT reproduced and every check carries its preconditions.
// Every check closes its browser context in `finally`.
export default ({ ctx, go, hop, press, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const dialogs = (p) => p.evaluate(() => document.querySelectorAll('#dialogs .dialog').length);
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.id || a.tagName; });
  const focusInDialog = (p) => p.evaluate(() => !!(document.activeElement && document.activeElement.closest('#dialogs')));
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const since = async (p, seq, kind) => (await events(p)).filter((e) => e.seq > seq && e.kind === kind);
  const typeKeys = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(60); };
  const key = async (p, k) => { await p.keyboard.press(k); await p.waitForTimeout(120); };
  const gates = (p, root = '') => p.evaluate((sel) => [...document.querySelectorAll(sel + ' .refusal')].map((r) => r.dataset.code), root);
  const refusalIds = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid^="refusal"]')].map((e) => e.getAttribute('data-testid')));
  const dots = (p) => p.$eval('.pindots', (e) => e.textContent).catch(() => null);
  const issuePass = async (p, name) => { await go(p, '#/owner/roles'); await click(p, 'roles.daypass.add'); await p.fill(tid('roles.daypass.name'), name); await click(p, 'roles.daypass.save'); await p.waitForTimeout(200); const dp = (await state(p)).dayPasses[0]; return dp ? dp.pin : null; };

  return {
    // shell-owner-r3-1: the pad's capture-phase Enter ran Go from every focused element but Cancel. Negative control:
    // Enter on a digit key presses the key (one dot, no gate, no miss), Enter on the gate's control runs the control
    // and keeps the keyboard inside the modal, Enter on the Why summary opens it; only Go submits.
    async 'A-storm3-shell-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/board?device=shared');
        const opened = (await click(p, 'topbar.author')) && (await dialogs(p)) === 1;
        await press(p, 'pin.key.7'); const dots1 = await dots(p); const gate1 = await gates(p, '#dialogs');
        await typeKeys(p, '24'); await press(p, 'pin.key.6'); const dots2 = await dots(p); const misses1 = (await state(p)).pinLock.misses;
        await click(p, 'pin.submit'); await p.waitForTimeout(150); const gate2 = await gates(p, '#dialogs');
        await press(p, 'refusal.control'); const f1 = await focused(p); const open1 = await dialogs(p);
        await press(p, 'pin.why'); const whyOpen = await p.$eval(tid('pin.why'), (e) => e.closest('details').open).catch(() => null);
        const misses2 = (await state(p)).pinLock.misses;
        rec('A-storm3-shell-1', 'In the author PIN pad Enter on a digit key, on the gate\'s control or on the Why summary runs Go instead of the focused control: an empty Go is refused, typed digits are submitted as a miss, the control\'s slot is rebuilt under the focus and the disclosure never opens', 'docs/04 keyboard-first (Enter activates the focused control; focus never on BODY); docs/01 principle 11 — shell.js openPinPad onPadKey',
          opened && gate2.includes('pin_no_match') && (dots1 !== '•' || gate1.length > 0 || dots2 !== '••••' || misses1 !== 0 || f1 === 'BODY' || open1 !== 1 || whyOpen !== true || misses2 !== 1),
          { opened, afterEnterOnKey7: { dots: dots1, gates: gate1 }, afterEnterOnKey6: { dots: dots2, misses: misses1 }, afterGo: gate2, afterEnterOnControl: { focus: f1, dialogs: open1 }, whyOpen, missesAtEnd: misses2 });
      } finally { await c.close(); }
    },

    // shell-owner-r3-4 / clinical-day-r3-2 (shell part): the day-pass PIN Roles minted was refused by the pad as notfound
    // and the author never moved. Negative control: the pad closes, the current user is the pass holder, the hash is the
    // temp persona's and the chip carries the holder's name (initials on the shared device).
    async 'A-storm3-shell-2'(b) {
      const { c, p } = await ctx(b);
      try {
        const pin = await issuePass(p, 'Alex Rivera');
        await hop(p, '#/owner/board?device=shared'); await p.waitForTimeout(100);
        const opened = (await click(p, 'topbar.author')) && (await dialogs(p)) === 1;
        const seq0 = await lastSeq(p);
        if (pin) { await typeKeys(p, pin); await click(p, 'pin.submit'); } await p.waitForTimeout(300);
        const r = await p.evaluate(() => ({ dialogs: document.querySelectorAll('#dialogs .dialog').length, gate: [...document.querySelectorAll('#dialogs .refusal')].map((x) => x.dataset.code), who: Proto.store.currentUser().name, hash: location.hash, chip: (document.querySelector('[data-testid="topbar.author"]') || {}).textContent || '', aria: (document.querySelector('[data-testid="topbar.author"]') || { getAttribute: () => '' }).getAttribute('aria-label') || '', persona: window.__proto.persona }));
        const ev = (await since(p, seq0, 'refusal')).map((e) => e.code);
        rec('A-storm3-shell-2', 'A day-pass PIN typed into the author pad on a shared device is refused (notfound through the Refusal component) or leaves the author unchanged: the pass holder cannot switch the author and the chip never names them', 'CONTRACTS §6 (notfound never renders through the component); docs/13 feature 31 (the pass is the identity) — shell.js openPinPad submit, store.js openSession',
          opened && /^80\d\d$/.test(pin || '') && (r.dialogs !== 0 || r.gate.length > 0 || ev.length > 0 || r.who !== 'Alex Rivera' || r.persona !== 'temp' || !/AR|Alex/.test(r.chip) || !r.aria.includes('Alex Rivera')),
          Object.assign({ opened, pin, refusalEvents: ev }, r));
      } finally { await c.close(); }
    },

    // shell-owner-r3-5 (ui part): refusal() deduped on code|verb|control, so identical gates raised by different
    // controls logged once. Negative control: a caller-supplied `scope` joins the key, so the same words on another
    // control log a second event while a repaint of the same gate on the same control still logs once.
    async 'A-storm3-shell-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/close');
        const r = await p.evaluate(() => {
          const n = () => window.__events.filter((e) => e.kind === 'refusal').length;
          const v = { code: 'entitlement', verb: 'Ask a seat that reconciles the bank', control: 'Send to Dana or the CPA', why: 'x' };
          const n0 = n(); Proto.ui.refusal(Object.assign({ scope: 'close.decision.d-1.keep' }, v)); const n1 = n();
          Proto.ui.refusal(Object.assign({ scope: 'close.decision.d-1.tighten' }, v)); const n2 = n();
          Proto.ui.refusal(Object.assign({ scope: 'close.decision.d-1.tighten' }, v)); const n3 = n();
          Proto.ui.refusal(Object.assign({ scope: 'close.decision.d-1.retire' }, v)); const n4 = n();
          return { first: n1 - n0, secondScope: n2 - n1, repaintSameScope: n3 - n2, thirdScope: n4 - n3 };
        });
        rec('A-storm3-shell-3', 'The shared refusal component swallows the refusal event of a gate with the same words raised on a different control (no scope in its dedupe key), so three presses on three verbs read as one refusal', 'CONTRACTS §5 (one refusal event per raised gate); §6 dedupe note — ui.js refusal() key',
          r.first === 1 && (r.secondScope !== 1 || r.repaintSameScope !== 0 || r.thirdScope !== 1), r);
      } finally { await c.close(); }
    },

    // shell-owner-r3-8: P.set of a canvas flag under an open dialog rebuilt the gates beneath it as refusal.* and moved
    // the keyboard to the hidden H1. Negative control: the gates stay refusal.prior.* while the dialog stands, focus stays
    // in the dialog and typing still lands in the palette input; the same with the author pad open.
    async 'A-storm3-shell-4'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/ledger/p-312');
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(120);
        const g0 = await gates(p, '#canvas');
        await click(p, 'topbar.search'); await p.waitForTimeout(120);
        const f1 = await focused(p); const ids1 = await refusalIds(p);
        await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(200);
        const f2 = await focused(p); const ids2 = await refusalIds(p); const inDlg = await focusInDialog(p); const open = await dialogs(p);
        await typeKeys(p, 'veg'); const typed = await p.$eval(tid('palette.input'), (e) => e.value).catch(() => null);
        await key(p, 'Escape');
        await hop(p, '#/owner/ledger/p-312?device=shared&outage=0'); await p.waitForTimeout(150);
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(120); await click(p, 'topbar.author'); await p.waitForTimeout(120);
        const padOpen = (await dialogs(p)) === 1;
        await p.evaluate(() => window.__proto.set({ privacy: true })); await p.waitForTimeout(200);
        const pad = { focus: await focused(p), inDialog: await focusInDialog(p), ids: await refusalIds(p) };
        rec('A-storm3-shell-4', 'With a gate on the Ledger and the palette (or the author pad) open, __proto.set of a canvas flag rebuilds the gate beneath as refusal.* under the modal and steals focus to the hidden H1, so typing goes nowhere', 'CONTRACTS §4 (gates beneath a dialog read refusal.prior.*); docs/04 (a modal owns the keyboard) — app.js repaintCanvas, router.js render, ui.js shadowGates',
          g0.length >= 1 && f1 === 'palette.input' && ids1.length > 0 && open === 1 && padOpen && (!inDlg || ids2.some((i) => !i.startsWith('refusal.prior.')) || typed !== 'veg' || !pad.inDialog || pad.ids.some((i) => !i.startsWith('refusal.prior.'))),
          { gateBefore: g0, paletteFocus: f1, idsUnderPalette: ids1, afterSet: { focus: f2, ids: ids2, focusInDialog: inDlg, dialogs: open, typed }, padOpen, padAfterSet: pad });
      } finally { await c.close(); }
    },

    // clinical-day-r3-3: Undo refused by the outage stayed Held after the outage ended. Negative control: the Held press
    // re-evaluates and reverses the paint; the stale outage gate is gone.
    async 'A-storm3-shell-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740');
        await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(80);
        await click(p, 'enc.undo'); await p.waitForTimeout(120); const held = await txt(p, 'enc.undo'); const g1 = await gates(p, '#canvas');
        await p.evaluate(() => window.__proto.set({ outage: false })); await p.waitForTimeout(120);
        const seq0 = await lastSeq(p); await press(p, 'enc.undo'); await p.waitForTimeout(150);
        const after = await txt(p, 'enc.undo'); const g2 = await gates(p, '#canvas'); const f = await focused(p);
        const S = await state(p); const rev = S.chartEvents.filter((x) => x.encounterId === 'enc-9002' && x.kind === 'reversal').length;
        const writes = (await since(p, seq0, 'write')).length;
        rec('A-storm3-shell-5', 'Undo last paint held by the outage stays Held after the outage ends: the next press only focuses the stale outage gate and writes no reversal', 'FIX-ROUND2 stale-gate rule (a Held press re-evaluates; a gate whose cause is gone falls on render); CONTRACTS §6 — encounter.js renderUndo / renderGate',
          held === 'Held' && g1.includes('outage') && S.outage === false && (rev !== 1 || g2.includes('outage') || writes === 0 || f === 'BODY'),
          { heldUnderOutage: held, gatesUnderOutage: g1, afterPress: { text: after, gates: g2, focus: f, reversals: rev, writes }, storeOutage: S.outage });
      } finally { await c.close(); }
    },

    // clinical-day-r3-4 (screen part): on the hygienist's encounter a killer control focused the read-only dentist-only
    // Assessment field, and the Send killer still read "Send to a dentist to file" after sending. Negative control: no
    // killer control lands on a read-only field, and after the send the row is a stamp with no Send control, the keyboard
    // on the stamp.
    async 'A-storm3-shell-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/encounter/enc-9001');
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const codes = await gates(p, '#enc-gate');
        const controls = await p.evaluate(() => [...document.querySelectorAll('#enc-gate [data-testid^="enc.killer."]')].map((b) => ({ tid: b.getAttribute('data-testid'), label: b.textContent.trim() })));
        const landings = [];
        for (const k of controls.filter((x) => !/Send to Exams/.test(x.label))) {
          await click(p, k.tid); await p.waitForTimeout(150);
          landings.push({ tid: k.tid, focus: await focused(p), readOnly: await p.evaluate(() => { const a = document.activeElement; return !!(a && (a.readOnly || a.hasAttribute('readonly'))); }) });
        }
        const send = controls.find((x) => /Send to Exams/.test(x.label));
        let sent = null;
        if (send) {
          await press(p, send.tid); await p.waitForTimeout(200);
          sent = await p.evaluate(() => ({ focus: (() => { const a = document.activeElement; return a === document.body ? 'BODY' : a.getAttribute('data-testid') || a.id || a.tagName; })(), sendControls: [...document.querySelectorAll('#enc-gate button')].filter((b) => /Send to Exams/.test(b.textContent)).length, stamp: /Sent to Exams/.test(document.getElementById('enc-gate').textContent), status: window.__proto.state().appointments.find((a) => a.id === 'a-1042').status }));
        }
        rec('A-storm3-shell-6', 'On the hygienist\'s encounter a killer control focuses the read-only dentist-only Assessment field (typed keys dropped), and after Send to Exams the killer row still offers "Send to Exams to sign" instead of reading as done', 'CONTRACTS §6 (a control resolves its gate; focus-after-action lands on a stamp); docs/04 keyboard-first — encounter.js fixKiller / killerRow, store.js noteKillers',
          codes.includes('licence_scope') && !!send && !!sent && sent.status === 'ready_for_exam' && (landings.some((l) => l.readOnly || l.focus === 'BODY') || sent.sendControls > 0 || !sent.stamp || sent.focus === 'BODY'),
          { killerCodes: codes, controls, landings, afterSend: sent });
      } finally { await c.close(); }
    },

    // Hardening: every way out of a dialog and every key path inside it lands the keyboard on a live element. Walks
    // the author pad (Escape, backdrop, Tab wrap, Enter on Cancel, Enter on the gate control), the palette (Escape,
    // backdrop) and a canvas gate's control by Enter; scores any landing on BODY.
    async 'A-storm3-shell-7'(b) {
      const { c, p } = await ctx(b);
      try {
        const out = [];
        await go(p, '#/owner/board?device=shared');
        // A dialog a step left standing is recorded, then closed, so the next step starts clean.
        const step = async (name, fn) => { await fn(); out.push({ name, focus: await focused(p), dialogs: await dialogs(p) }); if (await dialogs(p)) await key(p, 'Escape'); };
        await step('pad.escape', async () => { await click(p, 'topbar.author'); await key(p, 'Escape'); });
        await step('pad.backdrop', async () => { await click(p, 'topbar.author'); await p.mouse.click(5, 5); await p.waitForTimeout(120); });
        await step('pad.tab.wrap', async () => { await click(p, 'topbar.author'); await p.focus(tid('pin.cancel')); await key(p, 'Tab'); });
        await step('pad.shifttab.wrap', async () => { await click(p, 'topbar.author'); await p.focus(tid('pin.key.1')); await key(p, 'Shift+Tab'); });
        await step('pad.enter.cancel', async () => { await click(p, 'topbar.author'); await press(p, 'pin.cancel'); });
        await step('pad.enter.gate', async () => { await click(p, 'topbar.author'); await typeKeys(p, '0000'); await click(p, 'pin.submit'); await press(p, 'refusal.control'); });
        await step('pad.enter.locked.close', async () => { await click(p, 'topbar.author'); await typeKeys(p, '0000'); await click(p, 'pin.submit'); await typeKeys(p, '0000'); await click(p, 'pin.submit'); await press(p, 'refusal.control'); });
        await step('palette.escape', async () => { await click(p, 'topbar.search'); await key(p, 'Escape'); });
        await step('palette.backdrop', async () => { await click(p, 'topbar.search'); await p.mouse.click(5, 5); await p.waitForTimeout(120); });
        await go(p, '#/owner/ledger/p-312');
        await step('gate.enter.control', async () => { await click(p, 'ledger.statement.send'); await press(p, 'refusal.control'); });
        const walked = out.length === 10 && out.every((o) => o.dialogs <= 1);
        const closers = ['pad.escape', 'pad.backdrop', 'pad.enter.cancel', 'pad.enter.locked.close', 'palette.escape', 'palette.backdrop'];
        rec('A-storm3-shell-7', 'Escape, the backdrop, Tab wrap or Enter inside the author pad, the palette or a canvas gate leaves keyboard focus on BODY, or a closing control leaves the dialog standing', 'docs/04 keyboard-first; B10 focus never lands on body — ui.js dialog/refusal, shell.js openPinPad',
          walked && out.some((o) => o.focus === 'BODY' || (closers.includes(o.name) && o.dialogs !== 0)), { out, walked });
      } finally { await c.close(); }
    },
  };
};
