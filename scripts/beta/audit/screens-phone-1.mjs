// Audit checks for prototype/js/screens/phone.js, chunk screens-phone-1
// (root causes RC-40, RC-41, RC-42, RC-43, RC-123, RC-125, RC-126, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id, persona: e.persona }));
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control, persona: e.persona }));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, isBody: a === document.body }; });
  const identity = (p, tid) => p.evaluate((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); return e ? { label: e.textContent.trim(), className: e.className, held: e.classList.contains('held'), irreversible: e.classList.contains('irreversible'), disabled: e.disabled } : null; }, tid);
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas .refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() || null,
    why: ((r.querySelector('.whytext') || {}).textContent || '').trim() || null,
  })));
  // Row count of every store table, so a write event can be checked against the row it claims to have written.
  const tableCounts = (p) => p.evaluate(() => { const S = window.__proto.state(); const out = {}; for (const [k, v] of Object.entries(S)) if (Array.isArray(v)) out[k] = v.length; return out; });
  const diffCounts = (a, b) => Object.fromEntries(Object.keys(b).filter((k) => a[k] !== b[k]).map((k) => [k, [a[k], b[k]]]));
  const whoAmI = (p) => p.evaluate(() => ({ persona: window.__proto.persona, user: Proto.store.currentUser().name, userId: Proto.store.currentUser().id, subtitle: ((document.querySelector('#canvas .page-head p, #canvas header p, #canvas .sub') || {}).textContent || '').trim() || null }));
  const approvalRow = (p, id) => p.evaluate((id) => { const a = window.__proto.state().approvals.find((x) => x.id === id); return a ? { id: a.id, status: a.status, decidedBy: a.decidedBy, decidedAt: a.decidedAt, keys: Object.keys(a) } : null; }, id);
  // The biller's held request from the Money Desk (Sam Dawson, u-bl-1): ar-1 pending, $410 courtesy on p-306.
  const heldWriteoff = async (p) => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); };
  // The step-up verifies the approver's OWN PIN (store.js verifyPin(pin, approver.id)), so the digits are read from the current user at run time.
  const ownPin = (p) => p.evaluate(() => String((Proto.store.currentUser() || {}).pin || ''));
  const approveWithPin = async (p, reqId) => { await click(p, 'phone.request.' + reqId + '.approve'); await p.waitForTimeout(100); for (const d of await ownPin(p)) await click(p, 'phone.stepup.' + d); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(250); };
  const visibleLeaf = (p, re) => p.evaluate((src) => {
    const RE = new RegExp(src, 'i');
    return [...document.querySelectorAll('#canvas *')].filter((e) => e.children.length === 0 && RE.test((e.textContent || '').trim()))
      .map((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { text: e.textContent.trim().slice(0, 140), tag: e.tagName, className: e.className, visible: b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.sr-only') }; });
  }, re.source);

  return {
    // RC-40 · A2 · phone.js:109-111 onDecline calls Proto.store.decideApproval(a.id, me().id, 'declined', true) with no reason argument, then
    // writes the done text "the biller's screen now reads 'Sent back: <reason>'" from a module variable the store never saw.
    // Negative control: a compliant Send back persists the line — the approvals row (or approvalsLog row) carries it and the biller's Money Desk
    // shows it beside the request — so reasonInState is true or billerScreenHasReason is true and the check reports false. The decline must first
    // have landed (approvals.ar-1.status 'declined' and an approvalsLog write in the seq range); a decline that was refused is a different case.
    async 'A-screens-phone-1-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await heldWriteoff(p);
        const req = await approvalRow(p, 'ar-1');
        await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const viewer = await whoAmI(p);
        const REASON = 'appeal first';
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.decline'); await p.waitForTimeout(100);
        const filled = await fill(p, 'phone.request.ar-1.reason', REASON);
        const controlLabel = await txt(p, 'phone.request.ar-1.decline');
        const promise = await p.evaluate(() => ({ label: ((document.querySelector('label[for="ph-reason-ar-1"]') || {}).textContent || '').trim(), hint: ((document.getElementById('ph-reason-hint-ar-1') || {}).textContent || '').trim() }));
        await click(p, 'phone.request.ar-1.decline'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const row = await approvalRow(p, 'ar-1');
        const store = await p.evaluate((reason) => {
          const S = window.__proto.state();
          const json = JSON.stringify(S);
          const log = S.approvalsLog.filter((l) => l.requestId === 'ar-1');
          return { reasonInStateJSON: json.includes(reason), approvalsLogRows: log, approvalsRowFields: S.approvals.find((a) => a.id === 'ar-1') };
        }, REASON);
        const doneText = await p.evaluate(() => ((document.querySelector('.ph-done') || {}).textContent || '').trim());
        const announced = await p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
        // The biller's own screen, which the done text says now reads the line.
        await hop(p, '#/biller/money'); await p.waitForTimeout(200);
        const billerLanding = await p.evaluate((reason) => ({ canvasHasReason: document.getElementById('canvas').textContent.includes(reason), postButton: (() => { const e = document.querySelector('[data-testid="money.writeoff.post"]'); return e ? { label: e.textContent.trim(), className: e.className } : null; })() }), REASON);
        await click(p, 'money.tab.approvals'); await p.waitForTimeout(150);
        const billerApprovals = await p.evaluate((reason) => ({ canvasHasReason: document.getElementById('canvas').textContent.includes(reason), row: ((document.querySelector('#canvas .worklist .wrow') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) }), REASON);
        const declineLanded = !!row && row.status === 'declined' && ev.some((e) => e.kind === 'write' && e.table === 'approvalsLog');
        const reasonInState = store.reasonInStateJSON;
        const billerScreenHasReason = billerLanding.canvasHasReason || billerApprovals.canvasHasReason;
        const doneClaimsBillerReads = /biller.s screen now reads/i.test(doneText);
        const reproduced = !!req && req.status === 'pending' && viewer.persona === 'owner' && filled && declineLanded && !reasonInState && !billerScreenHasReason;
        rec('A-screens-phone-1-1', 'Send back with "appeal first" writes the decision but never the reason: decideApproval takes no reason, state() does not contain the line, and the biller\'s Money Desk shows no "Sent back" text although the done text claims it does', 'A2 — the control does what its label promises ("Send back with one line", "The biller sees this beside their Appeal control"); phone.js:109-111, store.js:137',
          reproduced, { requestBefore: req, viewer, reasonTyped: REASON, controlLabelBeforePress: controlLabel, promiseOnCard: promise, approvalAfter: row, approvalsLogRows: store.approvalsLogRows, approvalsRowFields: store.approvalsRowFields, reasonInStateJSON: reasonInState, doneText, doneClaimsBillerReads, announced, billerLanding, billerApprovalsTab: billerApprovals, billerScreenHasReason, declineLanded, writes: writes(ev), refusalEvents: refusalEvents(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-41 · A3 · phone.js:145 Show name calls Proto.events.write('disclosures', 'name-' + a.id) directly — an event, not a store write — so
    // the log reports a disclosures row that no table holds; the id shape name-ar-1 is not the store's dis-N either.
    // Negative control: a compliant tap writes a disclosures row (state().disclosures grows by one, the row id equals the event id) and the check
    // reports false; the check also reports false when no write event fires at all (a silent reveal is a different finding). The tap must have
    // revealed the name (full name on the card, control gone) before the event is scored.
    async 'A-screens-phone-1-2'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals?device=phone');
        const viewer = await whoAmI(p);
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const pending = await approvalRow(p, 'ar-1');
        const before = await tableCounts(p);
        const nameBefore = await p.evaluate(() => ((document.querySelector('.ph-card .ph-kv .ph-v') || {}).textContent || '').trim());
        const seq0 = await lastSeq(p);
        const tapped = await click(p, 'phone.request.ar-1.name'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const afterCounts = await tableCounts(p);
        const nameAfter = await p.evaluate(() => ({ text: ((document.querySelector('.ph-card .ph-kv .ph-v') || {}).textContent || '').trim(), controlStill: !!document.querySelector('[data-testid="phone.request.ar-1.name"]') }));
        const w = writes(ev);
        const disclosureWrites = w.filter((x) => x.table === 'disclosures');
        const rowsForIds = await p.evaluate((ids) => { const S = window.__proto.state(); const out = {}; for (const id of ids) out[id] = Object.entries(S).filter(([, v]) => Array.isArray(v)).flatMap(([k, v]) => v.filter((r) => r && r.id === id).map(() => k)); return out; }, disclosureWrites.map((x) => x.id));
        const diff = diffCounts(before, afterCounts);
        const revealed = !!pending && pending.status === 'pending' && tapped && /Lena Fischer/.test(nameAfter.text) && !nameAfter.controlStill;
        const reproduced = revealed && disclosureWrites.length > 0 && (afterCounts.disclosures || 0) === (before.disclosures || 0) && disclosureWrites.every((x) => (rowsForIds[x.id] || []).length === 0);
        rec('A-screens-phone-1-2', 'Show name logs a write event for table disclosures (id name-ar-1) while state().disclosures stays at the same length and no table holds a row with that id', 'A3 — a write event names a table and id that changed in the store; phone.js:145',
          reproduced, { viewer, request: pending, nameRowBefore: nameBefore, nameRowAfter: nameAfter, revealed, disclosuresLengthBeforeAfter: [before.disclosures || 0, afterCounts.disclosures || 0], tableCountDiff: diff, writeEvents: w, disclosureWriteEvents: disclosureWrites, tablesHoldingWrittenIds: rowsForIds, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-42 · B2 · phone.js requestCard renders the Approve primary; when s.refusal[a.id] is set the card shows the refusal but the primary
    // may keep class 'btn irreversible' and the word Approve instead of switching to Held (outlined, lock glyph, Held).
    // The card is only rendered for a viewer pendingApprovalsFor() admits (approve_second), so the gate is driven from the owner (Dr. Reagan,
    // u-dr-1): Approve under an outage is refused by the store's pre-check (code outage) and the refusal lands on the card. The biller's Money
    // Desk Post in its held state is read as the contrast case for the same identity rule.
    // Negative control: while a refusal stands on the card, a compliant primary has class 'held' (or the word Held) and the check reports false; it
    // also reports false when no refusal reached the DOM or the viewer was shown no card, because then there is no gate for the identity to answer.
    async 'A-screens-phone-1-3'(b) {
      const cases = [];
      // Contrast: the biller's Post that just went Held on the Money Desk.
      let contrast = null;
      { const { c, p } = await ctx(b);
        try { await go(p, '#/biller/money'); await heldWriteoff(p); contrast = await identity(p, 'money.writeoff.post'); }
        finally { await c.close(); } }
      // Owner (eligible approver) sees ar-1; Approve during an outage → the store's outage refusal on the card.
      { const { c, p } = await ctx(b);
        try {
          await go(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
          const viewer = await whoAmI(p);
          await click(p, 'phone.simulate'); await p.waitForTimeout(150);
          const cardShown = await p.evaluate(() => ({ cards: document.querySelectorAll('.ph-card').length, pendingForViewer: Proto.store.pendingApprovalsFor().map((a) => a.id) }));
          const before = await identity(p, 'phone.request.ar-1.approve');
          await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(150);
          const seq0 = await lastSeq(p);
          const pressed = await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);
          const ev = await after(p, seq0);
          cases.push({ case: 'owner outage', viewer, cardShown, pressed, approveBefore: before, refusalEvents: refusalEvents(ev), refusalDom: await refusalsDom(p), approveAfter: await identity(p, 'phone.request.ar-1.approve'), heldButtonsOnCard: await p.evaluate(() => document.querySelectorAll('.ph-card .btn.held').length), contrast: { moneyDeskPostWhenHeld: contrast }, seqRange: range(ev, seq0) });
        } finally { await c.close(); } }
      const scored = cases.map((k) => { const gate = k.cardShown.cards > 0 && !!k.approveBefore && k.refusalDom.length > 0 && k.refusalEvents.some((e) => k.refusalDom.some((d) => d.code === e.code)); const a = k.approveAfter; return { case: k.case, gateOnScreen: gate, codes: k.refusalDom.map((d) => d.code), approveClass: a && a.className, approveLabel: a && a.label, keepsIrreversible: !!a && a.irreversible && !a.held && !/held/i.test(a.label) }; });
      const reproduced = scored.length === 1 && scored.every((s) => s.gateOnScreen && s.keepsIrreversible);
      rec('A-screens-phone-1-3', 'After a refusal on the phone card (the owner\'s Approve refused under an outage) the Approve button keeps class "btn irreversible" and the word Approve; it never switches to the Held identity the Money Desk Post uses for the same situation', 'B2 / CONTRACTS §6 — the primary button never dims; it switches to the Held identity while the gate stands; phone.js requestCard',
        reproduced, { cases, scored });
    },

    // RC-43 · B9 · phone.js:21 holds refusal, nameShown and done text in one module-level `st` keyed by request id only, so a disclosure the owner
    // made shows the full name to the next user, and a done text written for the approver ("your name as second approver") is read by whoever
    // opens the card next.
    // Negative control: per-user state shows Priya initials plus her own Show name control (no disclosure by her yet), and shows Dr. Kim a done
    // text that names Dr. Reagan (or no "your name" text) — then frontdeskSeesFullNameWithoutOwnDisclosure and dentistReadsYourName are both false
    // and the check reports false. Each viewer's persona and current user are read from the page so a hop that did not switch users is visible.
    async 'A-screens-phone-1-4'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/owner/phone/approvals?device=phone');
        const owner = await whoAmI(p);
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.name'); await p.waitForTimeout(150);
        const ownerReveal = await p.evaluate(() => ((document.querySelector('.ph-card .ph-kv .ph-v') || {}).textContent || '').trim());
        // Frontdesk (Priya Raman, u-fd-1) opens the same card.
        await hop(p, '#/frontdesk/board'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(200);
        const frontdesk = await whoAmI(p);
        const frontdeskView = await p.evaluate(() => ({ nameRow: ((document.querySelector('.ph-card .ph-kv .ph-v') || {}).textContent || '').trim(), showNameControl: !!document.querySelector('[data-testid="phone.request.ar-1.name"]'), fullNameOnCard: /Lena Fischer/.test(((document.querySelector('.ph-card') || {}).textContent || '')) }));
        const evSoFar = await after(p, seq0);
        const disclosureEvents = evSoFar.filter((e) => e.kind === 'write' && e.table === 'disclosures').map((e) => ({ seq: e.seq, id: e.id, persona: e.persona }));
        // Owner approves with the PIN.
        await hop(p, '#/owner/phone/approvals'); await p.waitForTimeout(200);
        const ownerAgain = await whoAmI(p);
        await approveWithPin(p, 'ar-1');
        const decided = await approvalRow(p, 'ar-1');
        const ownerDone = await p.evaluate(() => ((document.querySelector('.ph-done') || {}).textContent || '').trim());
        // Dentist (Dr. Kim, u-dr-2) opens the screen.
        await hop(p, '#/dentist/phone/approvals'); await p.waitForTimeout(200);
        const dentist = await whoAmI(p);
        const dentistView = await p.evaluate(() => ({ doneText: ((document.querySelector('.ph-done') || {}).textContent || '').trim(), decidedLine: ((document.querySelector('.ph-decided .small.muted') || {}).textContent || '').trim(), subtitle: ((document.querySelector('#canvas h1') || {}).parentElement || {}).textContent }));
        const ev = await after(p, seq0);
        const usersDistinct = owner.userId !== frontdesk.userId && frontdesk.userId !== dentist.userId && owner.userId !== dentist.userId;
        const frontdeskSeesFullNameWithoutOwnDisclosure = frontdeskView.fullNameOnCard && !frontdeskView.showNameControl && !disclosureEvents.some((d) => d.persona === 'frontdesk');
        const dentistReadsYourName = /your name as second approver/i.test(dentistView.doneText) && !!decided && decided.decidedBy !== dentist.user;
        const reproduced = usersDistinct && /Lena Fischer/.test(ownerReveal) && !!decided && decided.status === 'approved' && (frontdeskSeesFullNameWithoutOwnDisclosure || dentistReadsYourName);
        rec('A-screens-phone-1-4', 'Card state is module-global: after the owner reveals the name, Priya (frontdesk) sees "Lena Fischer · MRN-306" with no Show name control and no disclosure of her own; after the owner approves, Dr. Kim (dentist) reads "Approved · posted with your name as second approver" for Dr. Reagan\'s decision', 'B9 — per-user state keyed by user id, never global; phone.js:21 (st), :143-145, :176-180',
          reproduced, { owner, ownerNameRowAfterReveal: ownerReveal, frontdesk, frontdeskView, disclosureEvents, frontdeskSeesFullNameWithoutOwnDisclosure, ownerAgain, approvalAfter: decided, ownerDoneText: ownerDone, dentist, dentistView, dentistReadsYourName, usersDistinct, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-123 · B10 · phone.js:71 (state.submit) and :114 (onDecline) call rerender(r) with no focus id after the mutation; the dialog's close()
    // restores focus to the old Approve button, which the re-mounted canvas then discards, so focus falls to body.
    // Negative control: after a landed approval or send-back, focus is on a control or the state line (activeElement is not body, has a tag and
    // usually a data-testid) and the check reports false. Each measurement is scored only when its mutation landed (status changed and a write
    // in the seq range), so a refused press is not mistaken for a dropped focus.
    async 'A-screens-phone-1-5'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals?device=phone');
        const viewer = await whoAmI(p);
        await click(p, 'phone.simulate'); await p.waitForTimeout(120); await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const pendingIds = await p.evaluate(() => window.__proto.state().approvals.filter((a) => a.status === 'pending').map((a) => a.id));
        // Approve ar-1 through the PIN step-up.
        const seq0 = await lastSeq(p);
        await approveWithPin(p, 'ar-1');
        const evA = await after(p, seq0);
        const focusAfterApprove = await focused(p);
        const approved = await approvalRow(p, 'ar-1');
        const dialogOpen = await p.evaluate(() => !!document.querySelector('#dialogs .dialog'));
        // Send back ar-2: open, type the reason, Enter in the field (phone.js:164) — the keyboard path; then the click path is not needed.
        const seq1 = await lastSeq(p);
        await click(p, 'phone.request.ar-2.decline'); await p.waitForTimeout(100);
        const focusAfterOpen = await focused(p);
        await fill(p, 'phone.request.ar-2.reason', 'appeal first');
        await p.press('[data-testid="phone.request.ar-2.reason"]', 'Enter'); await p.waitForTimeout(250);
        const evD = await after(p, seq1);
        const focusAfterDecline = await focused(p);
        const declined = await approvalRow(p, 'ar-2');
        const approveLanded = !!approved && approved.status === 'approved' && evA.some((e) => e.kind === 'write' && e.table === 'approvalsLog');
        const declineLanded = !!declined && declined.status === 'declined' && evD.some((e) => e.kind === 'write' && e.table === 'approvalsLog');
        const approveDropsFocus = approveLanded && focusAfterApprove.isBody;
        const declineDropsFocus = declineLanded && focusAfterDecline.isBody;
        const reproduced = approveDropsFocus || declineDropsFocus;
        rec('A-screens-phone-1-5', 'After Approve (PIN submit) and after Send back, document.activeElement is BODY: rerender(r) is called with no focus id and the re-mounted canvas discards the element the dialog restored focus to', 'B10 — after a mutation focus lands on the next action or the state line, never on body; phone.js:71, :114',
          reproduced, { viewer, pendingBefore: pendingIds, approve: { landed: approveLanded, approval: approved, dialogStillOpen: dialogOpen, activeElement: focusAfterApprove, writes: writes(evA), seqRange: range(evA, seq0) }, decline: { landed: declineLanded, approval: declined, activeElementAfterOpen: focusAfterOpen, activeElement: focusAfterDecline, writes: writes(evD), seqRange: range(evD, seq1) }, approveDropsFocus, declineDropsFocus });
      } finally { await c.close(); }
    },

    // RC-125 · A7 · phone.js:197 renders the string 'Approvals this week: 6, median 4 minutes (practice)' as a literal in the empty state.
    // Negative control: a number computed from state moves — after two decisions in this session (approvalsLog grows, two approvals decided) the
    // count or the median changes, or the figure equals a state-derived count — and the check reports false. The empty state must actually be
    // rendered both times (no pending request) and both decisions must have landed before the line is compared.
    async 'A-screens-phone-1-6'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals?device=phone');
        const readLine = () => p.evaluate(() => { const S = window.__proto.state(); const el = document.querySelector('.practice-line'); return { text: el ? el.textContent.trim() : null, emptyStateShown: !!document.querySelector('.ph-empty'), pendingInStore: S.approvals.filter((a) => a.status === 'pending').length, approvalsLog: S.approvalsLog.length, decided: S.approvals.filter((a) => a.status !== 'pending').length, decidedToday: S.approvals.filter((a) => a.status !== 'pending' && a.decidedAt).length }; });
        const before = await readLine();
        const seq0 = await lastSeq(p);
        await click(p, 'phone.simulate'); await p.waitForTimeout(120); await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        await approveWithPin(p, 'ar-1');
        await click(p, 'phone.request.ar-2.decline'); await p.waitForTimeout(100);
        await fill(p, 'phone.request.ar-2.reason', 'appeal first');
        await click(p, 'phone.request.ar-2.decline'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterLine = await readLine();
        const nums = (s) => (s || '').match(/\d+/g) || [];
        const bothLanded = ev.filter((e) => e.kind === 'write' && e.table === 'approvalsLog').length >= 2 && afterLine.decided >= before.decided + 2;
        const unchanged = !!before.text && before.text === afterLine.text;
        const figuresMatchState = nums(afterLine.text).some((n) => Number(n) === afterLine.approvalsLog || Number(n) === afterLine.decided);
        const reproduced = before.emptyStateShown && afterLine.emptyStateShown && bothLanded && unchanged && !figuresMatchState;
        rec('A-screens-phone-1-6', 'The empty-state line "Approvals this week: 6, median 4 minutes (practice)" reads the same before and after two decisions in the session (approvalsLog 0 → 2, decided 0 → 2): the figures are literals', 'A7 — a number on screen is computed from state; change the state through a mutation and the number moves; phone.js:197',
          reproduced, { before, after: afterLine, figuresInLine: nums(afterLine.text), bothDecisionsLanded: bothLanded, lineUnchanged: unchanged, figuresMatchAnyStateCount: figuresMatchState, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-126 · C3 · phone.js:204 renders "Plays the biller's side of signature moment 2 so you can approve from here." and the
    // blocked_same_person refusal (store.js:140, rendered through phone.js:95) carries the Why text "CHECK requester_id <> second_approver_id."
    // Negative control: neither string is rendered as visible text (the sim section says what it does in plain words; the Why explains the rule
    // without a constraint expression) and both flags are false, so the check reports false. The Why is a details disclosure, so it is opened
    // through refusal.why before its text is measured; a whytext that stays hidden is not counted as on screen.
    async 'A-screens-phone-1-7'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals?device=phone');
        const simLeaves = await visibleLeaf(p, /signature moment/);
        const simSection = await p.evaluate(() => ((document.querySelector('.ph-sim') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240));
        // Biller (Sam) simulates his own request and taps Approve → blocked_same_person; open Why.
        await go(p, '#/biller/money?device=phone'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const viewer = await whoAmI(p);
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        const refusal = await refusalsDom(p);
        const whyOpened = await click(p, 'refusal.why'); await p.waitForTimeout(120);
        const whyLeaves = await visibleLeaf(p, /requester_id|second_approver_id|CHECK\s/);
        const whyText = await p.evaluate(() => { const d = document.querySelector('#canvas .refusal details'); return d ? { open: d.open, text: ((d.querySelector('.whytext') || {}).textContent || '').trim() } : null; });
        const simVisible = simLeaves.some((l) => l.visible);
        const whyVisible = !!whyText && whyText.open && whyLeaves.some((l) => l.visible);
        const gateMatches = refusal.some((d) => d.code === 'blocked_same_person') && refusalEvents(ev).some((e) => e.code === 'blocked_same_person');
        const reproduced = simVisible || (gateMatches && whyVisible);
        rec('A-screens-phone-1-7', 'Product-internal wording is on screen: the sim section reads "Plays the biller\'s side of signature moment 2…" and the blocked_same_person Why reads "CHECK requester_id <> second_approver_id."', 'C3 — no product-internal nouns on screen; explanations in plain words; phone.js:204, store.js:140 via phone.js:95',
          reproduced, { simSectionText: simSection, signatureMomentLeaves: simLeaves, simVisible, viewer, refusalDom: refusal, refusalEvents: refusalEvents(ev), gateMatches, whyOpened, whyDetails: whyText, whyLeaves, whyVisible, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
