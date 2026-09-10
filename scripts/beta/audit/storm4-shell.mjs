// Round-4 fix-storm checks for the shell owner: prototype/js/screens/encounter.js, shell.js, app.js, ui.js, css.
// Each check names the round-4 finding it guards, drives the prototype and measures the breach; default position is
// NOT reproduced and every check carries its preconditions. Every check closes its browser context in `finally`.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.id || a.tagName; });
  const focusedTag = (p) => p.evaluate(() => document.activeElement.tagName);
  const focusInDialog = (p) => p.evaluate(() => !!(document.activeElement && document.activeElement.closest('#dialogs')));
  const dialogs = (p) => p.evaluate(() => document.querySelectorAll('#dialogs .dialog').length);
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const since = async (p, seq, kind) => (await events(p)).filter((e) => e.seq > seq && e.kind === kind);
  const typeKeys = async (p, s) => { await p.keyboard.type(s, { delay: 0 }); await p.waitForTimeout(60); };
  const key = async (p, k) => { await p.keyboard.press(k); await p.waitForTimeout(150); };
  const gates = (p, root = '') => p.evaluate((sel) => [...document.querySelectorAll(sel + ' .refusal')].map((r) => r.dataset.code), root);
  const who = (p) => p.evaluate(() => Proto.store.currentUser().name);
  const hash = (p) => p.evaluate(() => location.hash);
  const noteFields = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid^="enc.note.field"]')].map((e) => e.value));
  const padDigits = async (p, digits) => { for (const d of digits) await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(300); };
  const chart = async (p, steps) => { for (const t of steps) { await click(p, t); await p.waitForTimeout(60); } };

  return {
    // shared-day-r4-2: the read-back gate's own Switch author dropped the typed note with the old author's draft, so the
    // corrected author met assessment_required. Negative control: after the pad names Dr. Okafor the fields still carry
    // the text, the gate is the read-back again and Confirm files it under Okafor with that text.
    async 'A-storm4-shell-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003?device=shared');
        await chart(p, ['enc.tooth.30', 'enc.surface.30.o', 'enc.proc.d2392', 'enc.note.starter.0']);
        const before = await p.evaluate(() => Proto.screens.encounter.state('enc-9003').note);
        await click(p, 'enc.file'); await p.waitForTimeout(200);
        const g1 = await gates(p, '#enc-gate'); const hasSwitch = !!(await p.$(tid('enc.readback.switch')));
        await click(p, 'enc.readback.switch'); await p.waitForTimeout(120); await padDigits(p, '9753');
        const after = { who: await who(p), hash: await hash(p), fields: await noteFields(p), gates: await gates(p, '#enc-gate') };
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const g3 = await gates(p, '#enc-gate');
        const filed = (await state(p)).filedNotes.find((n) => n.encounterId === 'enc-9003') || null;
        const carried = after.fields.length === 2 && after.fields[0] === before.assessment && after.fields[1] === before.plan;
        rec('A-storm4-shell-1', 'On a shared device the read-back gate\'s Switch author (enc.readback.switch) hands the pad to the right author but drops the typed assessment and plan: the fields are empty under the new author and File raises assessment_required, so the gate\'s own control cannot file what was read back', 'CONTRACTS §6 (every gate carries a control that resolves it; a refusal with nowhere to go is a dead end); store.fileNote readback Why — encounter.js state() keyed encId|userId, renderGate Switch author',
          !!before.assessment && g1.includes('readback') && hasSwitch && /Okafor/.test(after.who) && (!carried || g3.includes('assessment_required') || !filed || !/Okafor/.test(filed.author) || !filed.markdown.includes(before.assessment)),
          { before, gateBeforeSwitch: g1, hasSwitch, afterSwitch: after, carried, gatesAfterConfirm: g3, filed: filed && { author: filed.author, hasText: filed.markdown.includes(before.assessment) } });
      } finally { await c.close(); }
    },

    // shared-day-r4-3: after File the keyboard landed on enc.back, so a second Enter left the screen before the Filed card
    // could be read. Negative control: focus lands on the Filed card's stamp, a second Enter changes nothing.
    async 'A-storm4-shell-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?device=shared');
        await chart(p, ['enc.tag.tag-1.chart', 'enc.tooth.30', 'enc.surface.30.d', 'enc.surface.30.o', 'enc.proc.d2392', 'enc.note.starter.0']);
        await click(p, 'enc.file'); await p.waitForTimeout(150); await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const filed = (await state(p)).encounters.find((e) => e.id === 'enc-9002').noteFiled;
        const f1 = await focused(p); const inCard = await p.evaluate(() => !!(document.activeElement && document.activeElement.closest('.enc-filed')));
        const h1 = await hash(p); const card1 = await p.evaluate(() => !!document.querySelector('.enc-filed'));
        const seq0 = await lastSeq(p); await key(p, 'Enter'); await p.waitForTimeout(200);
        const h2 = await hash(p); const card2 = await p.evaluate(() => !!document.querySelector('.enc-filed')); const f2 = await focused(p);
        const routes = (await since(p, seq0, 'route')).length;
        rec('A-storm4-shell-2', 'After File succeeds keyboard focus lands on enc.back (a control that leaves the screen) instead of the Filed card\'s stamp, so Enter twice routes to Exams before the Filed card can be read', 'FIX-ROUND4 focus-after-action rule (after File focus lands on the Filed card\'s stamp/heading, never enc.back); docs/15 focus handed to the next primary — encounter.js doFile / renderFiledCard',
          filed && card1 && (f1 === 'enc.back' || f1 === 'BODY' || !inCard || h2 !== h1 || !card2 || routes > 0),
          { filed, afterFile: { focus: f1, inFiledCard: inCard, hash: h1, card: card1 }, afterSecondEnter: { focus: f2, hash: h2, card: card2, routeEvents: routes } });
      } finally { await c.close(); }
    },

    // shared-day-r4-5: the pad's policy line promised a wipe of local drafts the product does not do (drafts are kept per
    // author and return with the PIN). Negative control: the sentence and the behaviour agree.
    async 'A-storm4-shell-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001?device=shared');
        const own = () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="perio.grid.cell"]')].filter((x) => /^\d/.test((x.childNodes[0] || {}).textContent || '')).length);
        await typeKeys(p, '323323'); const bree1 = await own();
        await click(p, 'topbar.author'); await p.waitForTimeout(100);
        const policy = await p.evaluate(() => [...document.querySelectorAll('#dialogs details p')].map((x) => x.textContent.trim()).join(' | '));
        await padDigits(p, '3333'); const jo = { who: await who(p), cells: await own() };
        await click(p, 'topbar.author'); await padDigits(p, '1111'); const bree2 = { who: await who(p), cells: await own() };
        const saysWiped = /wiped|erased|cleared|lost/i.test(policy);
        const kept = bree1 === 6 && jo.cells === 0 && bree2.cells === 6;
        rec('A-storm4-shell-3', 'The author pad\'s policy line says local drafts are "wiped after autosave" while drafts are kept per author and come back with the PIN, so the one place the shared-desk switch is explained describes a wipe the product does not do', 'docs/04 "Measured, not asserted" (copy describes the behaviour) — shell.js openPinPad policy text; perio.js stateFor / encounter.js state keyed by user',
          bree1 === 6 && /Ramirez/.test(jo.who) && /Lawson/.test(bree2.who) && !!policy && (saysWiped === kept || !/draft/i.test(policy)),
          { bree1, policy, jo, bree2, saysWiped, draftsKeptPerAuthor: kept });
      } finally { await c.close(); }
    },

    // walks-clinical-r4-3: File refused with killers landed on enc.killer.0.fix, which for a non-dentist is "Send to Exams to
    // sign" — a button that writes — so Enter twice on File sent the chair. Negative control: focus lands on the gate verb
    // or the Before File heading (not a button) and a second Enter writes nothing; the dentist's leg lands off a button too.
    async 'A-storm4-shell-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/encounter/enc-9001');
        const seq0 = await lastSeq(p);
        await p.focus(tid('enc.file')); await key(p, 'Enter');
        const codes = await gates(p, '#enc-gate'); const f1 = await focused(p); const tag1 = await focusedTag(p);
        const inGate = await p.evaluate(() => !!(document.activeElement && document.activeElement.closest('#enc-gate')));
        await key(p, 'Enter'); await p.waitForTimeout(150);
        const status = (await state(p)).appointments.find((a) => a.id === 'a-1042').status;
        const writes = (await since(p, seq0, 'write')).map((e) => e.table);
        await go(p, '#/dentist/encounter/enc-9002');
        await p.focus(tid('enc.file')); await key(p, 'Enter');
        const dentist = { codes: await gates(p, '#enc-gate'), focus: await focused(p), tag: await focusedTag(p) };
        rec('A-storm4-shell-4', 'File refused with killers lands keyboard focus on the first killer row control; for a non-dentist that is "Send to Exams to sign", a button that writes, so Enter twice on File sends the chair to Exams', 'FIX-ROUND4 focus-after-action rule (File refused with killers lands on the gate verb or the Before File heading, never on a killer row control that writes); docs/01 principle 11 — encounter.js doFile',
          codes.includes('licence_scope') && dentist.codes.length > 0 && (tag1 === 'BUTTON' || f1 === 'BODY' || !inGate || status === 'ready_for_exam' || writes.includes('appointmentEvents') || dentist.tag === 'BUTTON' || dentist.focus === 'BODY'),
          { hygienist: { killers: codes, focusAfterFile: f1, tag: tag1, inGate, statusAfterSecondEnter: status, writes }, dentist });
      } finally { await c.close(); }
    },

    // walks-clinical-r4-4: __proto.set of theme/device/motion rebuilt the top bar under the keyboard and dropped focus to
    // BODY. Negative control: after each set() the control with the same test id has focus again.
    async 'A-storm4-shell-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'topbar.privacy'); const f0 = await focused(p);
        const out = [];
        for (const [t, o] of [['topbar.privacy', { device: 'shared' }], ['topbar.theme', { motion: 'reduced' }], ['nav.exams', { theme: 'dark' }], ['topbar.author', { device: 'operatory' }]]) {
          await p.focus(tid(t)); const before = await focused(p);
          await p.evaluate((oo) => window.__proto.set(oo), o); await p.waitForTimeout(120);
          out.push({ tid: t, set: o, before, after: await focused(p) });
        }
        rec('A-storm4-shell-5', 'window.__proto.set of theme, device or motion rebuilds the top bar with replaceChildren() and drops keyboard focus to BODY when it was on topbar.theme, topbar.privacy, topbar.author or a nav.* control', 'FIX-ROUND4 focus-preservation rule (a set() re-render keeps the keyboard on the control that had it, by test id); docs/04 keyboard-first (focus never on BODY) — app.js P.set, shell.js renderTopbar',
          f0 === 'topbar.privacy' && out.every((o) => o.before === o.tid) && out.some((o) => o.after !== o.tid), { f0, out });
      } finally { await c.close(); }
    },

    // walks-clinical-r4-5: a mousedown on non-focusable content inside the pad (the gate's verb, the heading, the Why
    // text) moved focus to BODY outside the modal. Negative control: focus stays inside the dialog after each click.
    async 'A-storm4-shell-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?device=shared');
        await click(p, 'topbar.author'); await typeKeys(p, '9999'); await key(p, 'Enter');
        const gate = (await gates(p, '#dialogs')).includes('pin_no_match'); const f0 = await focused(p);
        const out = [];
        for (const sel of [tid('refusal.verb'), '#dialogs h2', '#dialogs .hint']) {
          await p.click(sel); await p.waitForTimeout(100);
          out.push({ sel, focus: await focused(p), inDialog: await focusInDialog(p), dialogs: await dialogs(p) });
        }
        rec('A-storm4-shell-6', 'With the author pad open and its pin_no_match gate showing, a click on the gate\'s verb line, the pad\'s heading or its hint moves keyboard focus to BODY outside the modal until the next Tab', 'FIX-ROUND4 focus-preservation rule (a mousedown on non-focusable content inside a .dialog must not move focus out of the dialog); docs/04 (a modal owns the keyboard) — ui.js dialog()',
          gate && f0 === 'pin.display' && out.length === 3 && out.some((o) => o.focus === 'BODY' || !o.inDialog || o.dialogs !== 1), { gate, f0, out });
      } finally { await c.close(); }
    },
  };
};
