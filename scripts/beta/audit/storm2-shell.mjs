// Round-2 fix-storm checks for the shell owner: prototype/js/screens/shell.js, signin.js, palette.js, ui.js,
// app.js, router.js, index.html. Each check names the round-2 finding it guards, drives the prototype and
// measures the breach; default position is NOT reproduced and every check carries its precondition values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, state, events, rec }) => {
  const evalIn = (p, fn, arg) => p.evaluate(fn, arg);
  const dialogs = (p) => evalIn(p, () => document.querySelectorAll('#dialogs .dialog').length);
  const focused = (p) => evalIn(p, () => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName; });
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const since = async (p, seq, kind) => (await events(p)).filter((e) => e.seq > seq && e.kind === kind);
  const typeKeys = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(60); };
  const key = async (p, k) => { await p.keyboard.press(k); await p.waitForTimeout(120); };
  const padGate = (p) => evalIn(p, () => { const r = document.querySelector('#dialogs .refusal'); return r ? { code: r.dataset.code, why: (r.querySelector('.whytext') || {}).textContent || '' } : null; });

  return {
    // shell-owner-r2-7, board-checkout-r2-9 (shell part): the pad kept its own miss counter, so the lock gate's Why
    // promised a practice finding nothing wrote and the lock outlived __proto.reset(). The rule is the store's
    // (verifyPin): a claimed finding is a write event, and a rebuilt store takes Dr. Kim's PIN again. Negative
    // control: pin_locked after three misses; Why true (a write follows, or it claims none); 1357 after reset switches.
    async 'A-storm2-shell-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        const opened = (await click(p, 'topbar.author')) && (await dialogs(p)) === 1;
        const seq0 = await lastSeq(p);
        for (let i = 0; i < 3; i++) { await typeKeys(p, '0000'); await key(p, 'Enter'); }
        const gate = await padGate(p);
        const writes = (await since(p, seq0, 'write')).map((e) => e.table);
        const claimsFinding = !!gate && /finding/i.test(gate.why);
        await key(p, 'Escape'); await evalIn(p, () => window.__proto.reset()); await p.waitForTimeout(150);
        await click(p, 'topbar.author'); await typeKeys(p, '1357'); await key(p, 'Enter'); await p.waitForTimeout(250);
        const after = await evalIn(p, () => ({ user: Proto.store.currentUser().id, gate: (document.querySelector('#dialogs .refusal') || { dataset: {} }).dataset.code || null }));
        rec('A-storm2-shell-1', 'After three PIN misses the lock gate\'s Why says a finding is raised while no write event follows, and the lock survives __proto.reset() so Dr. Kim\'s correct PIN is still refused', 'docs/13 feature 28 (three misses lock the device and raise a practice finding); CONTRACTS §3 reset() rebuilds the store, §6 Why is true — store.js verifyPin, shell.js openPinPad',
          opened && !!gate && gate.code === 'pin_locked' && ((claimsFinding && !writes.length) || after.user !== 'u-dr-2'), { opened, gate, writes, claimsFinding, afterReset: after });
      } finally { await c.close(); }
    },

    // board-checkout-r2-12 (shell part): after a PIN post on a shared desk the store may move the current author,
    // but the chip was painted once per route, so it kept the previous person's initials. Negative control: the
    // chip's accessible name carries whoever Proto.store.currentUser() names after the posting.
    async 'A-storm2-shell-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash'); await p.fill('[data-testid="checkout.pin"]', '4444'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const r = await evalIn(p, () => ({ posted: window.__proto.state().ledger.filter((e) => e.patientId === 'p-305').map((e) => e.actor), storeUser: Proto.store.currentUser().name, aria: document.querySelector('[data-testid="topbar.author"]').getAttribute('aria-label') }));
        rec('A-storm2-shell-2', 'After Dana\'s PIN posts on the shared desk the author chip keeps naming the previous author while Proto.store.currentUser() names another person', 'docs/13 feature 30 (the chip shows the session owner); docs/04 one canonical view per fact — shell.js renderTopbar / refreshAndon',
          r.posted.length > 0 && !r.aria.includes(r.storeUser), r);
      } finally { await c.close(); }
    },

    // shell-owner-r2-11: Ctrl+K over the author PIN pad opened the palette as a second modal and the pad's document
    // keydown took the palette's Enter as a PIN. Negative control: one dialog stays; Enter on a palette row is never a
    // PIN miss.
    async 'A-storm2-shell-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared');
        const opened = (await click(p, 'topbar.author')) && (await dialogs(p)) === 1;
        await key(p, 'Control+k'); await p.waitForTimeout(100);
        const stacked = await dialogs(p);
        let codes = [];
        if (stacked > 1) { await typeKeys(p, 'veg'); const seq0 = await lastSeq(p); await press(p, 'palette.row.0'); await p.waitForTimeout(150); codes = (await since(p, seq0, 'refusal')).map((e) => e.code); }
        rec('A-storm2-shell-3', 'Ctrl+K while the author PIN pad is open stacks the palette over it, and Enter on a palette row is swallowed by the pad as a PIN miss', 'docs/04 (one modal at a time; a dialog owns the keyboard while it is on top) — shell.js Ctrl+K handler and openPinPad key scope, palette.js open',
          opened && (stacked !== 1 || codes.includes('pin_no_match')), { opened, dialogsAfterCtrlK: stacked, refusalsOnEnter: codes });
      } finally { await c.close(); }
    },

    // shell-owner-r2-12: __proto.set({outage:true}) flipped the store's flag without repainting the shell, so the
    // Andon stayed empty while closeDay refused with outage. Negative control: the Andon says the server is
    // unreachable as soon as the flag is set, and empties again when it is cleared.
    async 'A-storm2-shell-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        await evalIn(p, () => window.__proto.set({ outage: true })); await p.waitForTimeout(100);
        const on = await evalIn(p, () => ({ andon: document.getElementById('andon').textContent.trim(), close: Proto.store.closeDay('loc-1').code || 'ok' }));
        await evalIn(p, () => window.__proto.set({ outage: false })); await p.waitForTimeout(100);
        const off = await evalIn(p, () => /unreachable/i.test(document.getElementById('andon').textContent));
        rec('A-storm2-shell-4', '__proto.set({outage:true}) leaves the Andon empty while the store already refuses closeDay with code outage', 'CONTRACTS §3 (set() applies the same options as the hash flags, which paint the Andon); docs/04 the Andon reflects live state — app.js P.set',
          on.close === 'outage' && (!/unreachable/i.test(on.andon) || off), { whileOn: on, stillUnreachableAfterOff: off });
      } finally { await c.close(); }
    },

    // invariants-r2-11, shell-owner-r2-10 (app part): __proto.reset() rebuilt the store and repainted the shell but
    // left the palette, the author pad and the phone step-up pad standing over it, and closing them then fell to
    // BODY because the opener they remembered was replaced. Negative control: no dialog survives a reset and the
    // keyboard lands on a live element.
    async 'A-storm2-shell-5'(b) {
      const { c, p } = await ctx(b);
      try {
        const out = [];
        await go(p, '#/biller/ledger/p-306');
        await click(p, 'topbar.search'); const openedPalette = (await dialogs(p)) === 1;
        await evalIn(p, () => window.__proto.reset()); await p.waitForTimeout(150);
        out.push({ dialog: 'palette', opened: openedPalette, openAfterReset: await dialogs(p), focus: await focused(p) });
        await go(p, '#/frontdesk/board?device=shared');
        await click(p, 'topbar.author'); const openedPad = (await dialogs(p)) === 1;
        await evalIn(p, () => window.__proto.reset()); await p.waitForTimeout(150);
        out.push({ dialog: 'pin', opened: openedPad, openAfterReset: await dialogs(p), focus: await focused(p) });
        await go(p, '#/owner/phone/approvals?device=desk');   // the shared flag from the pad step would otherwise carry over
        await click(p, 'phone.simulate'); await click(p, 'phone.request.ar-1.approve'); const openedStepup = (await dialogs(p)) === 1;
        await evalIn(p, () => window.__proto.reset()); await p.waitForTimeout(150);
        out.push({ dialog: 'stepup', opened: openedStepup, openAfterReset: await dialogs(p), focus: await focused(p) });
        rec('A-storm2-shell-5', '__proto.reset() leaves the palette, the author PIN pad and the phone step-up pad open over the rebuilt store, and the keyboard falls to BODY', 'CONTRACTS §3 reset() (a full rebuild leaves no stale surface); B10 focus never lands on body — app.js P.reset, ui.js dialog',
          out.every((o) => o.opened) && out.some((o) => o.openAfterReset > 0 || o.focus === 'BODY'), { out });
      } finally { await c.close(); }
    },

    // Hardening (invariants-r2-11 cause): ui.dialog close() focused the element that opened it even after a repaint
    // had detached it, so focus fell to BODY. Negative control: after the canvas is rebuilt under an open palette,
    // Escape lands on the opener's replacement (same test id) or on the heading, never BODY.
    async 'A-storm2-shell-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await evalIn(p, () => document.querySelector('[data-testid="board.card.a-1042.arrive"]').focus());
        await key(p, 'Control+k'); const opened = (await dialogs(p)) === 1;
        await evalIn(p, () => Proto.router.render()); await p.waitForTimeout(80);
        await key(p, 'Escape'); await p.waitForTimeout(100);
        const focus = await focused(p);
        rec('A-storm2-shell-6', 'Closing a dialog after the screen beneath it was repainted drops keyboard focus to BODY: close() focuses the detached opener', 'B10 focus never lands on body; docs/04 keyboard-first — ui.js dialog close()',
          opened && focus === 'BODY', { opened, focusAfterEscape: focus });
      } finally { await c.close(); }
    },

    // invariants-r2-10 (component part): ui.refusal renamed every gate already on the page to refusal.prior.*, so
    // with two outage gates standing on two Board cards the older one had no refusal.control. Negative control:
    // every visible gate keeps exactly one refusal.control and no refusal.prior.* id exists.
    async 'A-storm2-shell-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1');
        await click(p, 'board.card.a-1075.arrive'); await click(p, 'board.card.a-1061.arrive'); await p.waitForTimeout(100);
        const r = await evalIn(p, () => ({
          gates: [...document.querySelectorAll('#canvas .refusal')].filter((x) => x.offsetParent !== null).map((x) => ({ code: x.dataset.code, controls: x.querySelectorAll('[data-testid="refusal.control"]').length })),
          priorIds: [...document.querySelectorAll('[data-testid^="refusal.prior."]')].length,
        }));
        rec('A-storm2-shell-7', 'With two outage gates on two Board cards the older gate loses its refusal.control (renamed refusal.prior.control), so a visible gate has no contract control', 'CONTRACTS §4/§6 — every visible gate carries one refusal.control — ui.js refusal() prior rename',
          r.gates.length >= 2 && (r.gates.some((g) => g.controls !== 1) || r.priorIds > 0), r);
      } finally { await c.close(); }
    },
  };
};
