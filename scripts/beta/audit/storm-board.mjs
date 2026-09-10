// Audit checks for the fix storm, owner "board": defects the beta storm confirmed live in
// prototype/js/screens/checkout.js, prototype/js/screens/board.js and prototype/css (board-checkout-4, -5, -7,
// -8, -11 screen part, -14, -15, -18, -19, -20; invariants-4; shell-nav-14 checkout part).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, press, click, txt, state, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName; });
  const gateCode = (p) => p.evaluate(() => { const r = document.querySelector('.refusal'); return r ? r.dataset.code : null; });
  const btnState = (p, t) => p.$eval(tid(t), (e) => ({ text: e.textContent.trim(), held: e.classList.contains('held') })).catch(() => null);
  const hash = (p) => p.evaluate(() => location.hash);
  const canvasText = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const set = (p, o) => p.evaluate((o) => window.__proto.set(o), o);

  return {
    // checkout.js render(): st.refusalNode outlived the outage that raised it. Board prunes its outage gates
    // when the connection is back; Checkout kept Post on Held with "Wait for the server" while the Andon was
    // empty. Negative control: after the outage clears Post reads Post and no gate stands, so `staleGate` is false.
    async 'A-storm-board-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?outage=1');
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post');
        const during = { post: await btnState(p, 'checkout.post'), gate: await gateCode(p) };
        await set(p, { outage: false }); await hop(p, '#/frontdesk/checkout/a-1046');
        const after = { post: await btnState(p, 'checkout.post'), gate: await gateCode(p), andon: await p.evaluate(() => document.getElementById('andon').textContent.trim()), outage: await p.evaluate(() => window.__proto.outage) };
        const staleGate = during.gate === 'outage' && !after.outage && after.andon === '' && (after.gate === 'outage' || (after.post && after.post.held));
        rec('A-storm-board-1', 'A Checkout outage gate outlives the outage: after the outage clears Post still reads Held beside "Wait for the server" while the Andon slot is empty', 'CONTRACTS §6 — a held primary is never a dead end; board.js pruneStaleGates is the rule Checkout lacked (checkout.js render)',
          staleGate, { during, after });
      } finally { await c.close(); }
    },

    // checkout.js paymentCard()/postRow(): once pin_required stood, typing the PIN cleared nothing, so Post stayed
    // Held and Enter in the PIN field wrote nothing; only re-pressing a tender revived Post. Negative control:
    // typing the PIN dissolves the gate and Post writes the ledger rows, so `ledgerAfterPin > ledgerAtGate`.
    async 'A-storm-board-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046?device=shared');
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post');
        const gate = await gateCode(p);
        const ledgerAtGate = (await state(p)).ledger.length;
        await p.fill(tid('checkout.pin'), '5555'); await p.waitForTimeout(80);
        const postAfterTyping = await btnState(p, 'checkout.post');
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const ledgerAfterPin = (await state(p)).ledger.length;
        rec('A-storm-board-2', 'On a shared desk the pin_required gate stays up after the PIN is typed: Post reads Held and writes nothing until a tender is pressed again', 'docs/01 principle 11 / CONTRACTS §6 — the gate dissolves when its condition is met (checkout.js PIN field onInput)',
          gate === 'pin_required' && ledgerAfterPin === ledgerAtGate, { gate, ledgerAtGate, postAfterTyping, ledgerAfterPin, gateAfter: await gateCode(p) });
      } finally { await c.close(); }
    },

    // checkout.js doPost(): the self-pay toggle hid when the tender no longer covered the fee, but st.selfPay kept
    // the id and Post sent it, so a restriction posted with no payment at all. Negative control: with Send
    // statement chosen no procedure is restricted and no self_pay_restricted event is written.
    async 'A-storm-board-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.line.pr-421.selfpay');
        const pressedBefore = await p.$eval(tid('checkout.line.pr-421.selfpay'), (e) => e.getAttribute('aria-pressed')).catch(() => null);
        await click(p, 'checkout.collect.seg.send-statement');
        const hidden = await p.evaluate(() => { const b = document.querySelector('[data-testid="checkout.line.pr-421.selfpay"]'); return !b || b.hidden; });
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const S = await state(p);
        const restricted = S.procedures.filter((x) => x.selfPayRestricted).map((x) => x.id);
        const events = S.domainEvents.filter((e) => e.type === 'procedure.self_pay_restricted').length;
        const payments = S.ledger.filter((e) => e.kind === 'patient_payment' && e.patientId === 'p-305').length;
        rec('A-storm-board-3', 'A self-pay restriction toggled on posts after its toggle is hidden: Send statement on a-1046 writes selfPayRestricted on pr-421 with no payment', 'docs/13 feature 1 — the restriction posts with the payment that covers the fee (checkout.js doPost selfPay)',
          pressedBefore === 'true' && hidden && payments === 0 && restricted.includes('pr-421'), { pressedBefore, hidden, restricted, events, payments, decided: S.collectionDecisions.length });
      } finally { await c.close(); }
    },

    // checkout.js withControl(): the entitlement gate's control read "Open Roles" but fell to the default branch
    // and routed to the Board. Negative control: the hash after the press names roles.
    async 'A-storm-board-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/checkout/a-1046');
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post');
        const gate = await gateCode(p); const label = await txt(p, 'refusal.control');
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const h = await hash(p);
        rec('A-storm-board-4', 'For a temp with no day pass the Checkout gate offers "Open Roles" and the press lands on the Board', 'CONTRACTS §6 — the control does what its label says (checkout.js withControl entitlement)',
          gate === 'entitlement' && /roles/i.test(label || '') && !/\/roles/.test(h), { gate, label, hashAfter: h });
      } finally { await c.close(); }
    },

    // checkout.js paymentCard(): at a $0 patient portion the decision still offered Send statement and Set up
    // payment plan, two money objects for nothing. Negative control: only Nothing due today is offered at zero,
    // so `statementOffered` is false (the store's own guard is another fixer's; this check reads the screen).
    async 'A-storm-board-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1045');
        const segs = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="checkout.collect.seg."]')].map((e) => e.getAttribute('data-testid').split('.').pop()));
        const zero = segs.includes('zero-due');
        const statementOffered = segs.includes('send-statement') || segs.includes('payment-plan');
        let posted = null;
        if (statementOffered) { await click(p, 'checkout.collect.seg.send-statement'); await click(p, 'checkout.post'); await p.waitForTimeout(150); const S = await state(p); posted = S.statementsDue.filter((x) => x.patientId === 'p-304').map((x) => x.amountCents); }
        rec('A-storm-board-5', 'On a-1045 ($0 patient portion) the decision control offers Send statement and Set up payment plan, and Post can write a $0.00 statement or plan', 'docs/13 feature 1 — at $0 the decision is Nothing due today; a statement or plan is a money object (checkout.js paymentCard)',
          zero && statementOffered, { segs, zero, statementOffered, statementsDueFor304: posted });
      } finally { await c.close(); }
    },

    // components.css .board-layout: the two-column breakpoint read the viewport, so at 1280 px with the 320 px
    // Patient Rail open the chair columns overflowed their 552 px track into the queue column and controls
    // overlapped with no page overflow. Negative control: with the rail open no Board control intersects a
    // readiness or queue control (`overlaps` is 0).
    async 'A-storm-board-6'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1044.rail'); await p.waitForTimeout(200);
        const o = await p.evaluate(() => {
          const side = document.querySelector('.board-layout > .stack:last-child');
          const railOpen = !document.getElementById('rail').hidden;
          if (!side) return { railOpen, side: false, overlaps: [] };
          const vis = (list) => [...list].filter((e) => e.offsetParent !== null);
          const overlaps = [];
          for (const a of vis(document.querySelectorAll('.board button'))) for (const bb of vis(side.querySelectorAll('button'))) {
            const r1 = a.getBoundingClientRect(), r2 = bb.getBoundingClientRect();
            const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), hh = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
            if (w > 0 && hh > 0) overlaps.push(a.getAttribute('data-testid') + ' x ' + bb.getAttribute('data-testid') + ' ' + Math.round(w) + 'x' + Math.round(hh));
          }
          const board = document.querySelector('.board').getBoundingClientRect(), s = side.getBoundingClientRect();
          return { railOpen, side: true, overlaps, boardRight: Math.round(board.right), sideLeft: Math.round(s.left), columns: getComputedStyle(document.querySelector('.board-layout')).gridTemplateColumns, scrollWidth: document.scrollingElement.scrollWidth };
        });
        rec('A-storm-board-6', 'At 1280×900 with the Patient Rail open the Board keeps two columns in a 552 px track, so chair-column controls overlap queue and readiness controls', 'docs/04 — 44 px targets with 8 px gaps; overlapping controls are a defect (components.css .board-layout breakpoint)',
          o.railOpen && o.side && o.overlaps.length > 0, o);
      } finally { await c.close(); }
    },

    // board.js card()/doReverify(): under the outage Re-verify raised the gate but kept its label and reversible
    // identity and dropped focus to BODY, while Arrive, Seat and Checkout on the same Board switched to Held and
    // kept focus. Negative control: the button reads Held and focus stays on a control.
    async 'A-storm-board-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1');
        const pressed = await click(p, 'board.card.a-1042.reverify');
        const f = await focused(p);
        const button = await btnState(p, 'board.card.a-1042.reverify');
        const gateInCard = await p.evaluate(() => !!document.querySelector('[data-testid="board.card.a-1042"] .refusal'));
        rec('A-storm-board-7', 'Under the outage the Board\'s Re-verify raises the gate but keeps "Re-verify" and its reversible identity, and focus drops to BODY', 'CONTRACTS §6 — the primary switches to Held while a gate stands; docs/04 — focus never lands on the body (board.js card, doReverify)',
          pressed && gateInCard && (f === 'BODY' || !(button && button.held)), { pressed, gateInCard, focus: f, button });
      } finally { await c.close(); }
    },

    // checkout.js render(): the subtitle printed the store's 24-hour time and raw type code ("08:00 · exam") while
    // the Board card read "8:00 am" with the chip "Exam". Negative control: both read the same clock and word.
    async 'A-storm-board-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        const sub = await p.evaluate(() => (document.querySelector('#canvas .sub') || {}).textContent || null);
        await hop(p, '#/frontdesk/board');
        const who = await p.evaluate(() => (document.querySelector('[data-testid="board.card.a-1044"] .who span') || {}).textContent || null);
        const boardTime = (who || '').split(' · ')[0];
        const raw = !!sub && (/^\d\d:\d\d\b/.test(sub) || / · exam · /.test(sub) || !sub.startsWith(boardTime));
        rec('A-storm-board-8', 'The Checkout subtitle reads "08:00 · exam" for the visit the Board prints as "8:00 am" with the chip "Exam"', 'docs/04 one canonical view per fact; ui.js time() is the one clock (checkout.js render sub)',
          !!who && raw, { sub, who, boardTime });
      } finally { await c.close(); }
    },

    // checkout.js postRow(): a declined write-off showed "Write-off declined by <approver>" and nothing of the
    // reason the approver typed. Negative control: the canvas carries the decisionReason.
    async 'A-storm-board-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.tender.card'); await p.fill(tid('checkout.amount'), '100'); await click(p, 'checkout.writeoff.add');
        // $300 stays under the write-off cap (patient portion less the $100 collected) and above the dual-release threshold.
        await p.fill(tid('checkout.writeoff.amount'), '300'); await click(p, 'checkout.writeoff.reason.courtesy');
        await click(p, 'checkout.post'); await click(p, 'refusal.control');
        await set(p, { persona: 'owner' }); await hop(p, '#/owner/board'); await hop(p, '#/phone/approvals');
        await click(p, 'phone.request.ar-1.decline'); await p.fill(tid('phone.request.ar-1.reason'), 'appeal first'); await p.waitForTimeout(60);
        await click(p, 'phone.request.ar-1.decline'); await p.waitForTimeout(150);
        await set(p, { persona: 'frontdesk' }); await hop(p, '#/frontdesk/checkout/a-1047');
        const a = (await state(p)).approvals[0] || null;
        const text = await canvasText(p);
        rec('A-storm-board-9', 'When the approver sends the $300 write-off back with "appeal first", the requester\'s Checkout shows the decline chip and never the reason', 'docs/13 feature 24 — Send back carries a one-line reason to the requester (checkout.js postRow)',
          !!a && a.status === 'declined' && a.decisionReason === 'appeal first' && /declined by/.test(text) && !text.includes('appeal first'), { approval: a && { id: a.id, status: a.status, decisionReason: a.decisionReason }, declinedShown: /declined by/.test(text), reasonShown: text.includes('appeal first') });
      } finally { await c.close(); }
    },

    // board.js onKey(): C opened the first note_filed visit while the cards offer Checkout on in_chart too, so
    // the key skipped a-1044 which sits ahead in the queue with a live Checkout. Negative control: C lands on
    // the first visit whose card carries a Checkout control.
    async 'A-storm-board-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const cards = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="board.card."][data-testid$=".checkout"]')].map((b) => b.getAttribute('data-testid').split('.')[2]));
        const rows = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="board.queue.row."]')].map((e) => e.getAttribute('data-testid')).filter((t) => t.split('.').length === 4).map((t) => t.split('.')[3]));
        const firstCard = rows.find((id) => cards.includes(id)) || null;  // the queue is in chair-out order; the first row with a live card Checkout
        await p.focus('#canvas').catch(() => {}); await p.keyboard.press('c'); await p.waitForTimeout(200);
        const h = await hash(p);
        const landed = (h.match(/checkout\/(a-\d+)/) || [])[1] || null;
        rec('A-storm-board-10', 'The Board\'s C accelerator opens Checkout for a-1045 and skips a-1044, the in-chart visit ahead of it whose card offers a live Checkout', 'docs/13 feature 29 keys layer — the key runs the same verb the card runs (board.js onKey CHECKOUTABLE)',
          !!firstCard && !!landed && landed !== firstCard && rows.indexOf(firstCard) < rows.indexOf(landed), { cardsWithCheckout: cards, firstInQueueWithCardCheckout: firstCard, queueOrder: rows, hashAfterC: h, landed });
      } finally { await c.close(); }
    },

    // board.js card(): Seat renders in the slot Arrive vacated, so the second click of a double-click seated the
    // patient. Negative control: after a double-click on Arrive the status is arrived and no seat click is logged.
    async 'A-storm-board-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const seq0 = await p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
        const at = await p.$eval(tid('board.card.a-1042.arrive'), (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        await p.mouse.dblclick(at.x, at.y); await p.waitForTimeout(250);
        const a = (await state(p)).appointments.find((x) => x.id === 'a-1042');
        const clicks = await p.evaluate((s) => window.__events.filter((e) => e.seq > s && e.kind === 'click').map((e) => e.testid), seq0);
        const seatShown = !!(await p.$(tid('board.card.a-1042.seat')));
        rec('A-storm-board-11', 'A double-click on Arrive arrives and then seats a-1042 in one gesture: Seat renders where Arrive was and takes the second click', 'docs/01 principle 9 — one gesture, one step; CONTRACTS §7 flow 1 (board.js card Seat)',
          clicks.includes('board.card.a-1042.arrive') && a.status === 'seated', { status: a.status, clicks, seatShownAfter: seatShown });
      } finally { await c.close(); }
    },

    // checkout.js render(): an id that names no visit redirected to #/<persona>/notfound, so Back returned to the
    // notfound page. Negative control: the address keeps the bad id, the canvas reads Nothing here with
    // notfound.home, and Back returns to the Board.
    async 'A-storm-board-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await hop(p, '#/frontdesk/checkout/a-9999'); await p.waitForTimeout(100);
        const after = { hash: await hash(p), h1: await p.evaluate(() => (document.querySelector('#canvas h1') || {}).textContent || null), home: !!(await p.$(tid('notfound.home'))) };
        await p.goBack(); await p.waitForTimeout(300);
        const backHash = await hash(p);
        rec('A-storm-board-12', 'A bad checkout id redirects to #/frontdesk/notfound, so Back returns to the notfound page instead of the Board', 'docs/04 IA — Back always returns to the previous screen; CONTRACTS §4 notfound.home (checkout.js render)',
          after.h1 === 'Nothing here' && (after.hash === '#/frontdesk/notfound' || backHash !== '#/frontdesk/board'), { after, backHash });
      } finally { await c.close(); }
    },
  };
};
