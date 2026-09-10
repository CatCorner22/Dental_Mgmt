// Audit checks for the misc-2 chunk: defects found by a static read of prototype/js after the function
// audit closed, each confirmed live before it was fixed. Files: prototype/js/screens/dailyclose.js,
// prototype/js/router.js with screens/shell.js, screens/shell.js (Andon), screens/moneydesk.js, store.js.
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, click, txt, rec }) => {
  const h1 = (p) => p.evaluate(() => { const e = document.querySelector('#canvas h1'); return e ? e.textContent.trim() : null; });
  const writeEvents = (p) => p.evaluate(() => window.__events.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id })));
  const lastSeq = async (p) => { const ev = await writeEvents(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const heldWriteoff = async (p) => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); };

  return {
    // dailyclose.js decisions(): Tighten and Retire built their result sentence from `T`, a const that a
    // previous fix had removed with the date helper it served, so the store moved the threshold and wrote the
    // controlDecisions row while the screen threw ReferenceError before it could say so. Keep did not read T
    // and worked, which is why the harness stayed green. Negative control: a compliant screen throws nothing
    // and prints a sentence that carries the threshold now in force, so `threw` is empty and `sentence` names it.
    async 'A-misc-2-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        const out = {};
        for (const action of ['tighten', 'retire']) {
          await go(p, '#/owner/close');
          errs.length = 0;
          const pressed = await click(p, 'close.decision.d-1.' + action);
          const sentence = await p.evaluate(() => (document.getElementById('canvas').textContent.match(/(Kept|Tightened|Retired)[^.]*\./) || [null])[0]);
          const s = await p.evaluate(() => { const S = window.__proto.state(); return { threshold: S.tenant.dualReleaseThresholdCents, decisionStatus: (S.decisions.find((d) => d.id === 'd-1') || {}).status, controlDecisions: S.controlDecisions.length }; });
          out[action] = { pressed, threw: errs.slice(), sentence, store: s };
        }
        const broke = Object.values(out).some((o) => o.pressed && o.store.controlDecisions > 0 && (o.threw.some((e) => /T is not defined/.test(e)) || !o.sentence));
        rec('A-misc-2-1', 'Tighten and Retire on a decision due for review write the controlDecisions row and move the threshold, then throw "T is not defined" before the screen can say what happened', 'A3, B7 — a mutation that succeeded is confirmed in place; a screen never throws on a store result it asked for (dailyclose.js decisions())',
          broke, out);
      } finally { await c.close(); }
    },

    // router.js PERSONAS / shell.js openPinPad(): the seed maps `assistant` to Jo Ramirez (PIN 3333) but the
    // router did not know the persona, so a valid PIN wrote the sessions row, set #/assistant/<route> and then
    // parse() read that hash as sign-in: the author chip vanished and the encounter was replaced by the persona
    // picker. Negative control: a compliant switch keeps the route, shows the new initials, and renders no
    // sign-in control, so `signinShown` is false and `after` reads "JR · RDA".
    async 'A-misc-2-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?device=shared');
        const before = await txt(p, 'topbar.author');
        const seq0 = await lastSeq(p);
        await click(p, 'topbar.author');
        for (const d of ['3', '3', '3', '3']) await click(p, 'pin.key.' + d);
        await click(p, 'pin.submit'); await p.waitForTimeout(250);
        const after = await txt(p, 'topbar.author');
        const hash = await p.evaluate(() => location.hash);
        const signinShown = await p.evaluate(() => !!document.querySelector('[data-testid="signin.go"]'));
        const sessionWrites = (await writeEvents(p)).filter((w) => w.seq > seq0 && w.table === 'sessions').length;
        rec('A-misc-2-2', 'A valid PIN for the assistant (Jo Ramirez, 3333) writes a session and then lands on the sign-in screen with no author chip: the seed knows the persona and the router does not', 'docs/13 feature 30 — the PIN opens that person\'s session on the same page, or it refuses; it never half-succeeds (router.js PERSONAS, shell.js openPinPad)',
          sessionWrites > 0 && (signinShown || after === null || !/^JR\b/.test(after || '')), { before, after, hash, signinShown, sessionWrites, heading: await h1(p) });
      } finally { await c.close(); }
    },

    // shell.js renderAndon(): the strip read `pending[0].frozenSentence`, a field no approvals row carries (the
    // sentence is built at read time by store.approvalSentence so privacy mode can hide the name), so the
    // owner saw "1 approval waiting" with an empty sentence beside it. The Andon stands on every home, so the
    // form it prints is the store's redacted one (initials · MRN; approvalSentence(req, {redact:true})), the same
    // the phone card prints before Show name. Negative control: a compliant strip prints exactly that sentence,
    // so `sentenceShown` is non-empty and equals `expected`.
    // owner saw "1 approval waiting" with an empty sentence beside it. Negative control: a compliant strip
    // prints the same sentence the phone card prints, so `sentenceShown` is non-empty and equals `expected`.
    async 'A-misc-2-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await heldWriteoff(p);
        await hop(p, '#/owner/close');
        const o = await p.evaluate(() => {
          const a = document.getElementById('andon');
          const spans = [...a.querySelectorAll('span.grow')].map((s) => s.textContent.trim());
          const pending = Proto.store.pendingApprovalsFor();
          return { chip: ((a.querySelector('.chip') || {}).textContent || '').trim(), sentenceShown: spans[0] || '', expected: pending.length ? Proto.store.approvalSentence(pending[0], { redact: true }) : null, pending: pending.length };
          return { chip: ((a.querySelector('.chip') || {}).textContent || '').trim(), sentenceShown: spans[0] || '', expected: pending.length ? Proto.store.approvalSentence(pending[0]) : null, pending: pending.length };
        });
        rec('A-misc-2-3', 'With one approval waiting, the owner\'s Andon strip prints the count and an empty sentence: it reads a frozenSentence field that no approvals row has', 'C5 — one canonical sentence per request, built by the store; the Andon, the phone and Money Desk print the same one (shell.js renderAndon)',
          o.pending > 0 && (!o.sentenceShown || o.sentenceShown !== o.expected), o);
      } finally { await c.close(); }
    },

    // moneydesk.js postWriteoff(): store.requestWriteoff writes the approval at Post, and the card says so
    // (Held, "Approval requested"); the gate beside it still offered a "Request approval" control whose press
    // wrote nothing and only announced a request that had already gone. Negative control: a compliant gate's
    // control either writes the request it names or does something else it names; here the press must leave
    // the approvals count unchanged AND the label must promise a request for the check to report true.
    async 'A-misc-2-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const seq0 = await lastSeq(p);
        await heldWriteoff(p);
        const label = await txt(p, 'refusal.control');
        const approvalsAtPost = await p.evaluate(() => window.__proto.state().approvals.length);
        const seq1 = await lastSeq(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(200);
        const approvalsAfterPress = await p.evaluate(() => window.__proto.state().approvals.length);
        const writesAfterPress = (await writeEvents(p)).filter((w) => w.seq > seq1);
        const landed = await p.evaluate(() => ({ selectedTab: [...document.querySelectorAll('[data-testid^="money.tab."]')].filter((e) => e.getAttribute('aria-selected') === 'true').map((e) => e.getAttribute('data-testid')), focused: (document.activeElement.getAttribute && document.activeElement.getAttribute('data-testid')) || document.activeElement.tagName }));
        const promisesRequest = /request/i.test(label || '');
        rec('A-misc-2-4', 'After Post writes the write-off request, the held gate still offers "Request approval": pressing it writes nothing and changes nothing, and the card beside it already says the approval was requested', 'CONTRACTS §6 — the control is the first next step and does what its label says (moneydesk.js postWriteoff)',
          approvalsAtPost > 0 && promisesRequest && approvalsAfterPress === approvalsAtPost && writesAfterPress.length === 0,
          { label, approvalsAtPost, approvalsAfterPress, writesAfterPress, landedOn: landed, writesAtPost: (await writeEvents(p)).filter((w) => w.seq > seq0 && w.seq <= seq1) });
      } finally { await c.close(); }
    },

    // store.js decideApproval() minted approvalsLog ids with the `al` prefix and counter that allocations use,
    // so the log row of an approved write-off was al-1 and the first allocation of the day al-2: the prefix no
    // longer named the table, and which table held al-1 depended on the order of the day's events. Negative
    // control: with its own prefix the log row is alog-1, the first allocation is al-1, and `samePrefix` is
    // false. The check needs both tables to have rows before it scores (an approval decided on the phone,
    // then a checkout on a filed note).
    async 'A-misc-2-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await heldWriteoff(p);
        const reqId = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).id || null);
        await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals');
        if (reqId) {
          await click(p, 'phone.request.' + reqId + '.approve'); await p.waitForTimeout(120);
          for (const d of ['2', '4', '6', '8']) await click(p, 'phone.stepup.' + d);
          await click(p, 'phone.stepup.submit'); await p.waitForTimeout(300);
        }
        await hop(p, '#/frontdesk/board'); await hop(p, '#/frontdesk/checkout/a-1046');
        await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(250);
        const o = await p.evaluate(() => {
          const S = window.__proto.state(); const prefix = (id) => String(id).replace(/-\d+$/, '');
          const log = S.approvalsLog.map((x) => x.id), alloc = S.allocations.map((x) => x.id);
          const logPrefixes = [...new Set(log.map(prefix))], allocPrefixes = [...new Set(alloc.map(prefix))];
          return { approvalsLog: log, allocations: alloc, logPrefixes, allocPrefixes, samePrefix: logPrefixes.some((x) => allocPrefixes.includes(x)), firstAllocation: alloc[0] || null, approvalStatus: (S.approvals[0] || {}).status || null };
        });
        rec('A-misc-2-5', 'approvalsLog and allocations mint ids from one prefix and counter, so the approved write-off\'s log row is al-1 and the first allocation of the day is al-2: the prefix no longer names the table', 'A3 — the event log cites table and id, and an id\'s prefix is how a reader finds the table it names (store.js decideApproval)',
          o.approvalsLog.length > 0 && o.allocations.length > 0 && o.samePrefix, o);
      } finally { await c.close(); }
    },
  };
};
