// Swarm regression hunt, lens clinical: what the fix round (swarm/fix-G4-contract-and-harness-coverage) left or
// moved in the clinical paths — chartUndo/fileNote/postCheckout across store.js and checkout.js, the chairs
// readiness control, the encounter licence killer, and perioGate's licence lookup.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.seq + ' ' + e.table + '/' + e.id);
  const refusals = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => e.seq + ' ' + e.code);
  const range = (ev) => (ev.length ? [ev[0].seq, ev[ev.length - 1].seq] : null);
  const status = (p, aid) => p.evaluate((aid) => window.__proto.state().appointments.find((a) => a.id === aid).status, aid);
  const activeTestid = (p) => p.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-testid')) || document.activeElement.tagName);
  // 192 probed sites at 3 mm; `skip` names a tooth whose six sites are left unprobed.
  const fullMouth = (skip) => Object.fromEntries([...Array(32).keys()].flatMap((t) => [1, 2, 3, 4, 5, 6].map((s) => ['t' + (t + 1) + '-s' + s, t + 1 === skip ? { depth: null, skipped: true, bleed: false } : { depth: 3, skipped: false, bleed: false }])));
  const killerFix = (p, label) => p.evaluate((label) => { const el = [...document.querySelectorAll('[data-testid^="enc.killer."][data-testid$=".fix"]')].find((e) => e.textContent.trim() === label); return el ? el.getAttribute('data-testid') : null; }, label);

  return {
    // store.js:557 fileNote now skips reversed procedures, but store.js:222 postCheckout's `toCharge` (noteFiled ? !charged(p))
    // and checkout.js:314 `procs` still take every procedure row of the visit. Paint composite #30, paint crown #19, Undo (crown),
    // File: File releases $260 only. Then Checkout lists the undone crown under Completed today and Post charges it ($1,180).
    // Negative control: with `!p.reversed` in postCheckout's toCharge (and checkout.js procs), the ledger holds one charge
    // (pr-500, 26000), Patient due stays 26000 after Post, the table omits the crown, and the check reports false.
    async 'S-regress-clinical-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tag.tag-1.chart');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392');
        await click(p, 'enc.tooth.19'); await click(p, 'enc.surface.19.o'); await click(p, 'enc.proc.d2740');
        await click(p, 'enc.undo');
        await click(p, 'enc.note.starter.0');
        await click(p, 'enc.file'); await p.waitForTimeout(200);
        if (!(await p.evaluate(() => window.Proto.store.encounter('enc-9002').noteFiled))) { await click(p, 'refusal.control'); await p.waitForTimeout(200); }
        const filed = await p.evaluate(() => { const S = window.Proto.store; const procs = S.get().procedures.filter((x) => x.encounterId === 'enc-9002').map((x) => ({ id: x.id, cdt: x.cdt, feeCents: x.feeCents, status: x.status, reversed: !!x.reversed, charged: S.charged(x) })); return { noteFiled: S.encounter('enc-9002').noteFiled, procedures: procs, charges: S.get().ledger.filter((l) => l.kind === 'charge' && l.patientId === 'p-302').map((l) => l.id + ':' + l.procedureId + ':' + l.amountCents), patientDue: S.balances('p-302').patientDue, filedCard: ((document.querySelector('.enc-filed') || {}).innerText || '').split('\n').find((s) => /Charges released/.test(s)) || null }; });
        await hop(p, '#/frontdesk/checkout/a-1043');
        const table = await p.evaluate(() => [...document.querySelectorAll('table tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const posted = await p.evaluate(() => { const S = window.Proto.store; return { charges: S.get().ledger.filter((l) => l.kind === 'charge' && l.patientId === 'p-302').map((l) => l.id + ':' + l.procedureId + ':' + l.amountCents + ':' + l.actorKind), patientDue: S.balances('p-302').patientDue, status: S.get().appointments.find((a) => a.id === 'a-1043').status, postedCard: (document.body.innerText.match(/Posted in one transaction[^]*?Collection decision/) || [''])[0].replace(/\s+/g, ' '), explain: S.explain('p-302').map((x) => x.sentence) }; });
        const ev = await after(p, seq0);
        const reversedProc = filed.procedures.find((x) => x.reversed) || null;
        const chargedReversed = reversedProc ? posted.charges.filter((s) => s.includes(':' + reversedProc.id + ':')) : [];
        const tableListsReversed = !!reversedProc && table.some((row) => /D2740 #19/.test(row));
        const reproduced = filed.noteFiled && !!reversedProc && filed.charges.length === 1 && filed.patientDue === 26000 && posted.status === 'checked_out' && chargedReversed.length > 0 && posted.patientDue > filed.patientDue;
        rec('S-regress-clinical-1', 'After Undo reverses Crown #19 and File releases the composite alone ($260), Checkout still lists the undone crown as Completed today and Post charges it to the ledger ($1,180): Patient due goes from $260 to $1,440 for a visit whose filed note names one procedure', 'A5, A7, C5 — a reversed procedure never reaches the ledger; store.js:222 postCheckout toCharge filters !charged(p) but not p.reversed, checkout.js:314 procs takes every procedure row',
          reproduced, { proceduresAtFile: filed.procedures, chargesAtFile: filed.charges, patientDueAfterFile: filed.patientDue, filedCardLine: filed.filedCard, checkoutTable: table, tableListsReversed, chargesAfterPost: posted.charges, chargedReversed, patientDueAfterPost: posted.patientDue, statusAfterPost: posted.status, postedCard: posted.postedCard, explain: posted.explain, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // chairs.js:63 canReady offers Ready for exam whenever the visit has a perio exam or a note, whatever its status, while
    // store.js:410 readyForExam allows only seated/in_chart. Arrive a-1042 (the hygienist flow, docs/13 §22: "arrive → perio →
    // Ready for exam"), save the perio exam, press the enabled irreversible Ready for exam: wrong_status, status stays arrived,
    // and the refusal's control (Open the visit) is a no-op that changes neither route nor status. The hygienist has no seat verb.
    // Negative control: when canReady requires a READY_FROM status (or readyForExam accepts arrived after a perio exam), the
    // press either is not offered or moves the visit to ready_for_exam with one appointments write; the check reports false.
    async 'S-regress-clinical-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        const setup = await p.evaluate((sites) => { const S = window.Proto.store; return { arrive: S.arrive('a-1042').ok, perio: S.savePerio('enc-9001', sites, { mode: 'full' }).ok }; }, fullMouth(0));
        await hop(p, '#/hygienist/board'); await hop(p, '#/hygienist/chairs');
        const before = await status(p, 'a-1042');
        const button = await p.evaluate(() => { const e = document.querySelector('[data-testid="chairs.card.a-1042.ready"]'); return e ? { text: e.textContent.trim(), className: e.className, disabled: e.disabled, ariaDisabled: e.getAttribute('aria-disabled') } : null; });
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(150);
        const gate = await p.evaluate(() => { const r = document.querySelector('[data-testid="chairs.card.a-1042"] .refusal'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; });
        const afterPress = await status(p, 'a-1042');
        const hash0 = await p.evaluate(() => location.hash);
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const afterControl = { status: await status(p, 'a-1042'), hash: await p.evaluate(() => location.hash), focus: await activeTestid(p) };
        const ev = await after(p, seq0);
        const reproduced = setup.arrive && setup.perio && before === 'arrived' && !!button && /irreversible/.test(button.className) && !button.disabled && pressed && refusals(ev).some((s) => /wrong_status/.test(s)) && afterPress === 'arrived' && afterControl.status === 'arrived' && afterControl.hash === hash0 && !writes(ev).some((w) => /appointments\//.test(w));
        rec('S-regress-clinical-2', 'Chairs offers an enabled, irreversible-styled Ready for exam on an arrived visit once the perio exam is saved; the press is refused wrong_status ("it is arrived"), the status stays arrived, and the refusal\'s only control is a no-op, so the documented hygienist flow arrive → perio → Ready for exam cannot finish from Chairs', 'A2, docs/13 §22 hygienist flow — chairs.js:63 canReady (perioToday || hasNote) ignores READY_FROM while store.js:410 readyForExam gates on seated/in_chart',
          reproduced, { setup, statusBefore: before, button, gateText: gate, statusAfterPress: afterPress, afterControl, hashBefore: hash0, refusals: refusals(ev), writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // encounter.js:458 fixKiller('licence') calls store.readyForExam and rerenders only when res.ok; a refusal (wrong_status
    // on an arrived visit) is dropped: no gate, no refusal event, no announcement, the killer row stays as it was. The hygienist
    // (store.js:535 licence_scope killer) is the persona who meets it.
    // Negative control: when the refusal is rendered as x.sendGate (as already_decided is) the DOM holds a .refusal with
    // "wrong_status" text and the log holds one refusal event after the click; the check reports false.
    async 'S-regress-clinical-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/encounter/enc-9001');
        const setup = await p.evaluate(() => { const S = window.Proto.store; return { arrive: S.arrive('a-1042').ok, status: S.get().appointments.find((a) => a.id === 'a-1042').status, user: S.currentUser().role }; });
        await hop(p, '#/hygienist/chairs'); await hop(p, '#/hygienist/encounter/enc-9001');
        await click(p, 'enc.file'); await p.waitForTimeout(150); // the killer rows (including the licence killer) render after a File press
        const tid = await killerFix(p, 'Send to Exams to sign');
        const killersBefore = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="enc.killer."][data-testid$=".fix"]')].map((e) => e.textContent.trim()));
        const seq0 = await lastSeq(p);
        const pressed = tid ? await click(p, tid) : false; await p.waitForTimeout(200);
        const direct = await p.evaluate(() => { const r = window.Proto.store.readyForExam('a-1042'); return r.ok ? 'ok' : r.code; });
        const domAfter = await p.evaluate(() => ({ refusal: [...document.querySelectorAll('.refusal')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()), killers: [...document.querySelectorAll('[data-testid^="enc.killer."][data-testid$=".fix"]')].map((e) => e.textContent.trim()), live: [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent.trim()).filter(Boolean), status: window.__proto.state().appointments.find((a) => a.id === 'a-1042').status }));
        const ev = (await after(p, seq0)).filter((e) => e.kind !== 'focus');
        const clickEv = ev.filter((e) => e.kind === 'click').map((e) => e.seq + ' ' + e.testid);
        const reproduced = setup.arrive && !!tid && pressed && direct === 'wrong_status' && domAfter.status === 'arrived' && !domAfter.refusal.some((t) => /arrived|wrong_status/.test(t)) && refusals(ev).length === 0 && writes(ev).length === 0 && domAfter.killers.includes('Send to Exams to sign');
        rec('S-regress-clinical-3', 'On an arrived visit the encounter\'s licence killer "Send to Exams to sign" silently does nothing: the store refuses wrong_status but the screen renders no refusal, logs no refusal event and announces nothing, so the hygienist sees a control that neither acts nor explains', 'A2, A3, docs/04 refusal component — encounter.js:458 fixKiller handles res.ok only; the wrong_status refusal from store.js:410 is dropped',
          reproduced, { setup, killerTestid: tid, killersBefore, directStoreResult: direct, domAfter, clicks: clickEv, refusals: refusals(ev), writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // chairs.js:208 clears a card's held gate only when its code is 'outage'; a wrong_status gate stays after the front desk
    // seats the patient. The card then shows chip "Seated" beside "Open the visit — it is arrived", Ready for exam is Held,
    // and pressing it only focuses the stale control: the store's readyForExam is never called although it would now succeed.
    // Negative control: when the gate is cleared on re-render once the status moved (or Held re-earns the refusal), the second
    // press moves a-1042 to ready_for_exam with an appointments write; the check reports false.
    async 'S-regress-clinical-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/chairs');
        await p.evaluate((sites) => { const S = window.Proto.store; S.arrive('a-1042'); S.savePerio('enc-9001', sites, { mode: 'full' }); }, fullMouth(0));
        await hop(p, '#/hygienist/board'); await hop(p, '#/hygienist/chairs');
        await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(150);
        const gate1 = await p.evaluate(() => { const r = document.querySelector('[data-testid="chairs.card.a-1042"] .refusal'); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; });
        const seated = await p.evaluate(() => window.Proto.store.seat('a-1042').ok);
        await hop(p, '#/hygienist/board'); await hop(p, '#/hygienist/chairs');
        const card = await p.evaluate(() => { const card = document.querySelector('[data-testid="chairs.card.a-1042"]'); const r = card && card.querySelector('.refusal'); const btn = card && card.querySelector('[data-testid="chairs.card.a-1042.ready"]'); return { chip: card ? (card.querySelector('.who') || {}).innerText : null, gate: r ? r.innerText.replace(/\s+/g, ' ').trim() : null, button: btn ? { text: btn.textContent.trim(), className: btn.className } : null }; });
        const statusBefore = await status(p, 'a-1042');
        const seq0 = await lastSeq(p);
        await click(p, 'chairs.card.a-1042.ready'); await p.waitForTimeout(150);
        const afterPress = { status: await status(p, 'a-1042'), focus: await activeTestid(p) };
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const afterControl = { status: await status(p, 'a-1042'), hash: await p.evaluate(() => location.hash) };
        const ev = await after(p, seq0);
        const reproduced = !!gate1 && seated && statusBefore === 'seated' && !!card.gate && /arrived/.test(card.gate) && /Seated/.test(card.chip || '') && !!card.button && /held/.test(card.button.className) && afterPress.status === 'seated' && afterControl.status === 'seated' && refusals(ev).length === 0 && !writes(ev).some((w) => /appointments\//.test(w));
        rec('S-regress-clinical-4', 'A wrong_status gate on a Chairs card outlives the status it describes: after the front desk seats the arrived patient the card reads "Seated" beside "Open the visit — it is arrived", Ready for exam is Held, and the press neither calls the store (which would now succeed) nor re-earns a refusal', 'A2, A4, docs/04 refusal component (a refusal is re-earned by a press) — chairs.js:208 clears held gates only for code outage',
          reproduced, { gateAfterFirstPress: gate1, seated, statusBeforeSecondPress: statusBefore, card, afterPress, afterControl, refusals: refusals(ev), writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },

    // store.js:369 perioGate accepts any licence for which `LICENCE_WORDS[licence]` is truthy, so Object.prototype names
    // ('constructor', 'toString', 'hasOwnProperty') pass the gate, and store.js:400 savePerio interpolates the inherited
    // function into the clinical summary: "6 sites not probed (function Object() { [native code] })".
    // Negative control: with an own-property lookup (Object.hasOwn(LICENCE_WORDS, licence)) each of the three is refused
    // omission_licence like 'bogus', no perioExams row is written, and the check reports false.
    async 'S-regress-clinical-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9002');
        const seq0 = await lastSeq(p);
        const r = await p.evaluate((sites) => {
          const S = window.Proto.store; const E = 'enc-9002';
          const out = {};
          const hasGate = typeof S.perioGate === 'function';
          for (const lic of ['bogus', 'constructor', 'toString', 'hasOwnProperty']) {
            const before = S.get().perioExams.filter((x) => x.encounterId === E).length;
            const gate = hasGate ? S.perioGate(E, sites, { mode: 'full', licence: lic }) : null;
            const res = S.savePerio(E, sites, { mode: 'full', licence: lic });
            const n = S.get().notes[E] || {};
            out[lic] = { gateCode: gate ? gate.code : (res && res.code) || null, ok: !!res.ok, code: res.code || null, examsBefore: before, examsAfter: S.get().perioExams.filter((x) => x.encounterId === E).length, summary: res.ok ? n.perioSummary : null };
          }
          return { own: Object.keys(S.LICENCE_WORDS || {}), hasGate, results: out };
        }, fullMouth(19));
        const ev = await after(p, seq0);
        const inherited = ['constructor', 'toString', 'hasOwnProperty'].filter((k) => !r.own.includes(k));
        const accepted = inherited.filter((k) => r.results[k].gateCode === null && r.results[k].ok && r.results[k].examsAfter === r.results[k].examsBefore + 1 && /native code/.test(r.results[k].summary || ''));
        const reproduced = r.results.bogus.code === 'omission_licence' && inherited.length === 3 && accepted.length === inherited.length;
        rec('S-regress-clinical-5', 'perioGate/savePerio accept "constructor", "toString" and "hasOwnProperty" as omission licences (bogus is refused) and write a perio exam whose note summary reads "6 sites not probed (function Object() { [native code] })"', 'A8, C-record — store.js:369 perioGate tests `!LICENCE_WORDS[licence]` (prototype chain) instead of own membership; store.js:400 interpolates LICENCE_WORDS[licence]',
          reproduced, { ownLicenceKeys: r.own, results: r.results, acceptedInherited: accepted, writes: writes(ev), seqRange: range(ev) });
      } finally { await c.close(); }
    },
  };
};
