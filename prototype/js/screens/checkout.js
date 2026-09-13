/* Checkout (flow 4): completed procedures with the estimate column, typed collection decision
   (Collect / Send statement / Payment plan / Nothing due today), self-pay restriction toggle,
   write-off with dual release (held, never silently allowed), desk PIN on Post for shared desks,
   Explain in two voices. Route: checkout/<apptId>. Features 1, 23, 24, 25, 30. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, section, pageHead, displayName, field, confirmable, errorSummary } = Proto.ui;
  Proto.screens = Proto.screens || {};

  /* The same list the Board's queue row asks: a filed D7210 cannot read "Needs: attachment" there and
     "Claim ready" here. Two copies of one rule drifted; they now hold the same three codes. */
  const needsAttachment = Proto.store.needsAttachment;  // one rule, one table (store.js)
  const REASONS = [['courtesy', 'Courtesy'], ['hardship', 'Hardship'], ['prior_period', 'Prior period'], ['contractual_ppo', 'Contractual PPO']];
  const CADENCES = [['weekly', 'Weekly'], ['biweekly', 'Every two weeks'], ['monthly', 'Monthly']];
  const SEG = { collect: 'collect', 'send-statement': 'send_statement', 'payment-plan': 'payment_plan', 'zero-due': 'zero_due' };
  const DECISION_WORD = { collect: 'Collect', send_statement: 'Send statement', payment_plan: 'Set up payment plan', zero_due: 'Nothing due today' };
  const KIND_WORD = { charge: 'Charge', patient_payment: 'Payment', write_off: 'Write-off', adjustment: 'Adjustment' };
  const state = {}; // per appointment id: form state, last refusal node, held request, posted rows
  let stateOwner = null; // the store instance the state belongs to; a store reset clears it

  /* A prefill is never a negative number: a credit balance means nothing is due, so the field starts at 0.00
     and the decision starts on Nothing due today. Negatives on this screen read one way, through money(). */
  const dollars = (c) => ((Number.isFinite(c) && c > 0 ? c : 0) / 100).toFixed(2);
  /* An amount is the number the person typed or nothing at all. The old parser stripped every character it did
     not like, so "abc" and "" became 0 (and the store posted the estimate instead) and "-50" became +$50.00. */
  const MONEY_RE = /^-?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;
  const cents = (s) => { const t = String(s == null ? '' : s).trim().replace(/[$,\s]/g, '').replace(/−/g, '-'); return MONEY_RE.test(t) ? Math.round(Number(t) * 100) : NaN; };
  const pressed = (b) => (b ? 'true' : 'false');

  /* The commonest answer is chosen before anyone presses: card is the tender the window takes most, and courtesy is the
     reason the store used to write silently when none was pressed (CLT-tesler-defaults). The screen and the record now
     say the same thing; the person overrides or confirms. */
  function fresh(patientCents) {
    return { decision: patientCents > 0 ? 'collect' : 'zero_due', tender: 'card', amountStr: dollars(patientCents), cardStr: '', selfPay: new Set(), writeoffOpen: false, writeoffStr: '', writeoffReason: 'courtesy', cadence: 'monthly', pin: '', explainOpen: false, patientVoice: false, receipt: false, refusalNode: null, errors: {}, heldReq: null, requested: false, posted: null };
  }

  /* Per-line estimate: the appointment-level patient portion spread by fee so the column sums to it. */
  function lineEstimates(procs, patientCents) {
    const total = procs.reduce((s, p) => s + p.feeCents, 0); let acc = 0;
    return procs.map((p, i) => { if (i === procs.length - 1) return patientCents - acc; const v = total ? Math.round(patientCents * p.feeCents / total) : 0; acc += v; return v; });
  }

  function snapshot(S) { return { ledger: S.ledger.length, allocations: S.allocations.length, intents: S.allocationIntents.length, decisions: S.collectionDecisions.length, statements: S.statementsDue.length, plans: S.paymentPlans.length, events: S.domainEvents.length }; }
  function diff(S, b) {
    return { ledger: S.ledger.slice(b.ledger), allocations: S.allocations.slice(b.allocations), intents: S.allocationIntents.slice(b.intents), decisions: S.collectionDecisions.slice(b.decisions), statements: S.statementsDue.slice(b.statements), plans: S.paymentPlans.slice(b.plans), events: S.domainEvents.slice(b.events).filter((e) => e.type === 'procedure.self_pay_restricted') };
  }

  function rerender(r, focus) {
    r = r || lastRoute || Proto.router.current();
    render(r);
    Proto.screens.shell.refreshAndon(r);
    if (focus) { const el = document.querySelector(focus[0] === '#' ? focus : '[data-testid="' + focus + '"]'); if (el && el.focus) el.focus(); }
  }
  const focusPin = () => { const el = document.querySelector('[data-testid="checkout.pin"]'); if (el) el.focus(); };
  const removeWriteoff = (r, st, focus) => { st.writeoffOpen = false; st.writeoffStr = ''; st.writeoffReason = 'courtesy'; st.refusalNode = null; rerender(r, focus || 'checkout.writeoff.add'); };
  const focusField = (t) => () => { const el = document.querySelector('[data-testid="' + t + '"]'); if (el && el.focus) el.focus(); };
  // A repaint puts a fresh input under the keyboard; the caret goes back to the end of what was typed.
  const caretEnd = (t) => { const el = document.querySelector('[data-testid="' + t + '"]'); if (el && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); };
  // A read-back that is waiting for its second press is cancelled by any edit to the form it describes.
  const confirmPending = () => !!document.querySelector('[data-testid="checkout.post.confirm"]');
  const openRoles = () => { location.hash = '#/owner/roles'; };   // the seat that issues a pass, not the pass-less temp's own Roles

  /* Every gate has one control, and the control does what the store's word says. The store leaves a few controls
     null; supply the obvious one. */
  function withControl(res, r, a, st) {
    const v = { code: res.code, verb: res.verb, control: res.control, why: res.why };
    if (res.code === 'zero_collect_refused') { v.control = res.control || 'Nothing due today'; v.onControl = () => { st.decision = 'zero_due'; st.refusalNode = null; rerender(r, 'checkout.collect.seg.zero-due'); }; }
    // A second wrong PIN reads the same as the first and is still a second refusal (ui.js refusal `fresh`).
    else if (res.code === 'pin_required' || res.code === 'pin_no_match') { v.control = 'Enter PIN'; v.fresh = res.code === 'pin_no_match'; v.onControl = focusPin; }
    else if (res.code === 'pin_locked') { v.control = res.control || 'Close'; v.fresh = true; v.onControl = () => { st.pin = ''; st.refusalNode = null; rerender(r, 'checkout.pin'); }; }
    // After hours the write-off waits for business hours; the payment need not. The control takes the write-off
    // off this posting rather than requesting an approval the hours policy would still hold.
    else if (res.code === 'after_hours' || (res.code === 'amount_required' && res.control === 'Remove the write-off')) { v.control = res.control || 'Remove the write-off'; v.onControl = () => removeWriteoff(r, st, 'checkout.post'); }
    // The store's write-off cap names the field the number goes in.
    else if (res.code === 'amount_required') { v.control = res.control || 'Go to amount'; v.onControl = focusField('checkout.writeoff.amount'); }
    else if (res.code === 'tender_required') { v.control = 'Choose card'; v.onControl = () => { st.tender = 'card'; st.refusalNode = null; rerender(r, 'checkout.card.number'); }; }
    // The control that says "Open the ledger" opens the ledger. Every unnamed code used to fall through to the
    // Board, so the one gate whose label named a destination landed somewhere else.
    else if (res.code === 'already_decided') { v.control = res.control || 'Open the ledger'; v.onControl = () => Proto.router.go(r.persona, 'ledger', a.patientId); }
    // "Open the day" opens Daily Close, where the closed day is read.
    else if (res.code === 'already_closed') { v.control = res.control || 'Open the day'; v.onControl = () => Proto.router.go(r.persona, 'close'); }
    // The requester cannot be the approver: the gate stands until the request is dismissed here.
    else if (res.code === 'blocked_same_person') { v.control = res.control || 'Dismiss'; v.onControl = () => { st.refusalNode = null; rerender(r, 'checkout.post'); }; }
    // Two entitlement gates: no pass (Open Roles) and a seat without post_payment (Switch author, the PIN pad).
    else if (res.code === 'entitlement' && res.control === 'Switch author') { v.onControl = () => Proto.screens.shell.openPinPad(r); }
    else if (res.code === 'entitlement') { v.control = res.control || 'Open Roles'; v.onControl = openRoles; }
    else if (res.code === 'outage') { v.control = res.control || 'Support line'; v.severity = 'stop'; v.onControl = Proto.ui.support; }
    else { v.control = res.control || 'Back to Board'; v.onControl = () => Proto.router.go(r.persona, 'board'); }
    return v;
  }

  /* A gate this screen raises: one verb line, one control, and the control goes to the field it names. */
  function gate(r, st, v, focusTestid) {
    st.refusalNode = refusal(Object.assign({}, v, { onControl: () => { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el && el.focus) el.focus(); } }));
    rerender(r, 'refusal.control');
  }
  /* A gate whose cause is one field marks that field as well: aria-invalid, an "Error:" message between the label and
     the input, and one error summary before the form with a link to the field, which takes the keyboard (WCAG 3.3.1,
     3.3.3; CDS-ERR-message-prefix, CDS-ERR-summary-top). The refusal beside Post keeps the contract's verb, control and
     Why; the field error and the summary fall with it, on the keystroke or press that removes the cause. */
  const FIELD_IDS = { amount: 'co-amount', writeoff: 'co-wo-amount', pin: 'co-pin', tender: 'co-tender' };
  function fieldGate(r, st, v, key, focusTestid) {
    st.errors = {}; st.errors[key] = v.verb;
    st.refusalNode = refusal(Object.assign({ onControl: focusField(focusTestid) }, v));
    rerender(r, 'checkout.errors');
  }
  const PIN_WHY = 'Shared desk: the PIN mints your own session, so the posting carries your name and not the last person\'s.';
  const TENDER_WHY = 'The tender is what the day sheet reconciles against the bank, so a payment cannot post without one.';
  /* The first press of Post reads the form before it asks for a second: a blank amount, a missing tender or an empty PIN
     is a refusal at the field, not a read-back to confirm. Returns true when it raised a gate. */
  function precheck(r, a, st) {
    const approved = st.heldReq && st.heldReq.status === 'approved';
    if (st.decision === 'collect') {
      if (!st.tender) { fieldGate(r, st, { code: 'tender_required', verb: 'Choose a tender', control: 'Choose card', why: TENDER_WHY, onControl: () => { st.tender = 'card'; st.refusalNode = null; rerender(r, 'checkout.card.number'); } }, 'tender', 'checkout.tender.card'); return true; }
      if (!(cents(st.amountStr) > 0)) { fieldGate(r, st, { code: 'amount_required', verb: 'Type an amount above zero', control: 'Go to amount', why: AMOUNT_WHY }, 'amount', 'checkout.amount'); return true; }
    }
    const woTyped = !approved && st.writeoffOpen && String(st.writeoffStr).trim() !== '';
    if (woTyped && !(cents(st.writeoffStr) > 0)) { fieldGate(r, st, { code: 'amount_required', verb: 'Type an amount above zero', control: 'Go to amount', why: WRITEOFF_WHY }, 'writeoff', 'checkout.writeoff.amount'); return true; }
    if (window.__proto.device === 'shared' && !String(st.pin || '').trim()) { fieldGate(r, st, { code: 'pin_required', verb: 'Enter your PIN to post', control: 'Enter PIN', why: PIN_WHY }, 'pin', 'checkout.pin'); return true; }
    // Under an outage the store refuses before it writes, so the first press asks it and shows its gate in its own words.
    if (Proto.store.get().outage) { doPost(r, a, st); return true; }
    return false;
  }
  /* What the second press will write, in the clinic's words, for the read-back row (WCAG 3.3.4). */
  function readback(a, st, est, name) {
    const approved = st.heldReq && st.heldReq.status === 'approved';
    const wo = !approved && st.writeoffOpen ? cents(st.writeoffStr) : 0;
    const woText = wo > 0 ? ' and a ' + money(wo) + ' ' + (REASONS.find((x) => x[0] === (st.writeoffReason || 'courtesy')) || [null, 'courtesy'])[1].toLowerCase() + ' write-off' : '';
    const who = ' for ' + name + '.';
    const unfiled = !(Proto.store.encounter(a.encounterId) || {}).noteFiled;
    if (st.decision === 'collect') return 'Post a ' + money(cents(st.amountStr)) + ' ' + st.tender + ' payment' + woText + who + (unfiled ? ' It waits as credit until the note is filed.' : '') + ' This cannot be undone.';
    if (st.decision === 'send_statement') return 'Post the decision to send a ' + money(afterWriteoff(st, est)) + ' statement' + woText + who + ' This cannot be undone.';
    if (st.decision === 'payment_plan') return 'Post a ' + (CADENCES.find((c) => c[0] === st.cadence) || [null, 'monthly'])[1].toLowerCase() + ' payment plan for ' + money(afterWriteoff(st, est)) + woText + who + ' This cannot be undone.';
    return 'Post nothing due today' + woText + who + ' This cannot be undone.';
  }
  /* A restriction posts only with the payment that covers its fee (docs/13 feature 1). The toggle hides when the
     tender stops covering it, but st.selfPay kept the id, so Send statement posted a restriction with no payment. */
  function selfPayFor(S, a, st, payCents) {
    if (st.decision !== 'collect') return [];
    return [...st.selfPay].filter((pid) => { const p = S.procedures.find((x) => x.id === pid && x.encounterId === a.encounterId); return p && !p.selfPayRestricted && payCents >= p.feeCents; });
  }
  // A statement or plan bills what the write-off typed beside it leaves: the row the store writes carries the same number.
  const afterWriteoff = (st, est) => { const wo = st.writeoffOpen ? cents(st.writeoffStr) : 0; return Math.max(0, est.patientCents - (wo > 0 ? wo : 0)); };
  const AMOUNT_WHY = 'A payment posts the number in the field against the balance, so it cannot be blank, negative, or a value that is not a number. To take nothing at the window, choose Nothing due today.';
  const WRITEOFF_WHY = 'A write-off posts the number in the field against the balance, so it cannot be blank, negative, or a value that is not a number. Remove the write-off to post without one.';

  function doPost(r, a, st) {
    const S = Proto.store.get();
    const before = snapshot(S);
    const approved = st.heldReq && st.heldReq.status === 'approved';
    // The amount is read before anything posts: the store falls back to the estimate when the form says 0,
    // so a blank field used to post $44.00 nobody entered.
    const payCents = st.decision === 'collect' ? cents(st.amountStr) : 0;
    if (st.decision === 'collect' && !(payCents > 0)) return gate(r, st, { code: 'amount_required', verb: 'Type an amount above zero', control: 'Go to amount', why: AMOUNT_WHY }, 'checkout.amount');
    const woTyped = !approved && st.writeoffOpen && String(st.writeoffStr).trim() !== '';
    const woCents = woTyped ? cents(st.writeoffStr) : 0;
    if (woTyped && !(woCents > 0)) return gate(r, st, { code: 'amount_required', verb: 'Type an amount above zero', control: 'Go to amount', why: WRITEOFF_WHY }, 'checkout.writeoff.amount');
    const form = {
      decision: st.decision,
      tender: st.decision === 'collect' ? st.tender : null,
      amountCents: st.decision === 'collect' ? payCents : 0,
      selfPay: selfPayFor(S, a, st, payCents),
      writeoffCents: woCents,
      writeoffReason: st.writeoffReason || 'courtesy',
      cadence: st.cadence,
      pin: st.pin || null,
      approvalRequestId: approved ? st.heldReq.id : null,
    };
    const res = Proto.store.postCheckout(a.id, form);
    if (res.ok) {
      st.posted = diff(S, before); st.posted.form = form; st.refusalNode = null;
      Proto.router.announce('Posted');
      // The keyboard lands on the Posted card's heading, never on Back: a repeated Enter must not leave the read-back.
      rerender(r, '#co-posted-head');
      return;
    }
    if (res.held && res.code !== 'after_hours') {
      // The request row is written when this control is pressed, by the store verb that owns it. Post writes
      // nothing here, so a control labelled "Request approval" performs the request it names.
      st.refusalNode = refusal({ code: res.code, verb: res.verb, control: res.control || 'Request approval', why: res.why, onControl: () => {
        // The pending request names the PIN poster (store.js posterId), so the phone's same-person rule reads the right name.
        const out = Proto.store.requestApproval(res.pendingRequest);
        if (!out.ok) { st.refusalNode = refusal(withControl(out, r, a, st)); rerender(r, 'refusal.control'); return; }
        st.heldReq = Proto.store.get().approvals.find((x) => x.id === out.requestId) || null;
        st.requested = true; st.refusalNode = null; st.pin = '';
        Proto.router.announce('Approval requested');
        // The keyboard lands on the request stamp, not on the Held primary.
        rerender(r, '#co-requested');
      } });
      rerender(r, 'refusal.control');
      return;
    }
    // A PIN the store would not accept marks the PIN field as well as raising the gate.
    if (/^pin_/.test(res.code)) { st.errors = { pin: res.verb }; }
    st.refusalNode = refusal(withControl(res, r, a, st));
    rerender(r, 'refusal.control');
  }

  /* --- pieces --- */
  function threeNumbers(bal) {
    const n = (label, v) => h('div', { class: 'n' }, h('div', { class: 'v', text: money(v) }), h('div', { class: 'l', text: label }));
    return h('div', { class: 'threenum', role: 'group', 'aria-label': 'Account balance' }, n('Patient due', bal.patientDue), n('Waiting on insurance', bal.insurancePending), n('Credit', bal.credit));
  }

  function proceduresCard(S, a, st, procs, est, coversNow) {
    const ests = lineEstimates(procs, est.patientCents);
    const feeTotal = procs.reduce((s, p) => s + p.feeCents, 0);
    const rows = procs.map((p, i) => {
      const name = (S.cdt[p.cdt] || [p.cdt])[0];
      const pre = p.selfPayRestricted ? chip('info', 'Restricted — no claim') : needsAttachment(p) ? chip('review', 'Needs: attachment') : chip('clear', 'Ready');
      const on = st.selfPay.has(p.id);
      // Four printed words (CLT-label-words); the accessible name leads with them and adds the procedure.
      const toggle = btn('Don\'t send to insurance', { kind: 'reversible', class: 'compact co-selfpay', testid: 'checkout.line.' + p.id + '.selfpay', pressed: pressed(on), ariaLabel: 'Don\'t send to insurance: ' + name + ', paid in full', onClick: () => { if (on) st.selfPay.delete(p.id); else st.selfPay.add(p.id); rerender(null, 'checkout.line.' + p.id + '.selfpay'); } });
      toggle.dataset.fee = p.feeCents; toggle.hidden = !coversNow(p.feeCents) || !!p.selfPayRestricted;
      return h('tr', { testid: 'checkout.line.' + p.id },
        h('td', null, h('div', { text: name }), h('div', { class: 'small muted', text: p.cdt.toUpperCase() })),
        h('td', { class: 'num', text: p.tooth ? '#' + p.tooth : '—' }),
        h('td', { class: 'num', text: money(p.feeCents) }),
        h('td', { class: 'num co-est', text: money(ests[i]) }),
        h('td', null, pre),
        h('td', null, toggle));
    });
    // Every column header carries scope; the footer's numbers and note are data cells, not headers; the table names
    // itself with a caption (WCAG 1.3.1, axe th-has-data-cells). The caption repeats the region's name for a screen
    // reader only: the card's heading already prints it.
    const th = (text, cls) => h('th', { scope: 'col', class: cls, text });
    const table = Proto.ui.scrollRegion('Completed procedures', 'checkout.lines', h('table', { class: 'data co-lines' },
      h('caption', { class: 'sr-only', text: 'Completed procedures: fee, patient portion estimate, claim pre-flight and self-pay' }),
      h('thead', null, h('tr', null, th('Procedure'), th('Tooth', 'num'), th('Fee', 'num'), th('Patient portion (estimate)', 'num co-est'), th('Pre-flight'), th('Self-pay'))),
      h('tbody', null, ...rows),
      h('tfoot', null, h('tr', null, h('th', { scope: 'row', text: 'Totals' }), h('td'), h('td', { class: 'num', text: money(feeTotal) }), h('td', { class: 'num co-est', text: money(est.patientCents) + ' est.' }), h('td', { colspan: '2', class: 'small muted', text: 'Estimate is separate from the balance above; it never enters the ledger.' })))));
    const why = h('details', null, h('summary', { class: 'co-summary', testid: 'checkout.estimate.why' }, 'Why this estimate'),
      h('p', { class: 'hint', text: (est.note || 'No plan estimate on file.') + (est.insuranceCents ? ' Insurance est. ' + money(est.insuranceCents) + '.' : '') + (est.writeoffCents ? ' PPO write-off est. ' + money(est.writeoffCents) + '.' : '') }));
    // An empty state says why it is empty and what to do next: with nothing charted there is nothing to bill,
    // so the next move is the chart or a typed Nothing due today.
    const empty = h('div', { class: 'stack' },
      h('p', { class: 'muted', text: 'No completed procedures on this encounter.' }),
      h('p', { class: 'hint', text: 'Open the chart to record what was done, or choose Nothing due today and send the patient on.' }));
    return section('Completed today', procs.length ? table : empty, why);
  }

  /* A group of three or more controls carries its name inside its own region, visibly, the way the perio path row does:
     a printed label beside the row and role=group pointing at it (CLT-common-region). */
  function labelledRow(id, label, group) { group.setAttribute('role', 'group'); group.setAttribute('aria-labelledby', id); return h('div', { class: 'row' }, h('span', { id, text: label }), group); }

  /* The Payment region is not one card of a dozen controls: its groups are bounded and named one at a time — the
     decision row, the tender row, the two amount fields, the write-off — and none holds more than four (CLT-chunk-4).
     Why sits in the heading row, so the region's last control is the one that finishes it (CLT-serial-position). */
  function paymentCard(r, a, st, est, procs, finishRow) {
    const S = Proto.store.get();
    const policy = [];   // policy sentences live behind Why, never on the finish path (C6)
    const zero = est.patientCents <= 0;
    const errors = st.refusalNode ? st.errors || {} : (st.errors = {});   // a field error lives exactly as long as its gate
    // At $0 the decision is Nothing due today: a statement or a plan is a money object, and there is no money.
    const segs = zero ? [['zero-due', 'Nothing due today']] : [['collect', 'Collect'], ['send-statement', 'Send statement'], ['payment-plan', 'Set up payment plan']];
    const seg = h('div', { class: 'seg' }, ...segs.map(([code, label]) => btn(label, { testid: 'checkout.collect.seg.' + code, pressed: pressed(st.decision === SEG[code]), onClick: () => { st.decision = SEG[code]; st.refusalNode = null; rerender(r, 'checkout.collect.seg.' + code); } })));
    const body = h('div', { class: 'stack' });
    if (st.decision === 'collect') {
      const tenders = h('div', { class: 'btnrow', id: FIELD_IDS.tender, tabindex: '-1' }, ...['card', 'cash', 'check'].map((t) => btn(t[0].toUpperCase() + t.slice(1), { testid: 'checkout.tender.' + t, pressed: pressed(st.tender === t), onClick: () => { st.tender = t; st.refusalNode = null; rerender(r, t === 'card' ? 'checkout.card.number' : 'checkout.tender.' + t); } })));
      body.append(labelledRow('co-tender-lab', 'Tender (required)', tenders));
      const fields = h('div', { class: 'co-two' });
      if (st.tender === 'card') {
        const card = h('input', { class: 'input co-hosted', type: 'text', inputmode: 'numeric', autocomplete: 'off', testid: 'checkout.card.number', value: st.cardStr, placeholder: '•••• •••• •••• ••••', onInput: (ev) => { st.cardStr = ev.target.value; if (confirmPending()) { rerender(r, 'checkout.card.number'); caretEnd('checkout.card.number'); } } });
        const cf = field('Card (hosted, never stored)', card, { hint: '12 to 19 digits (processor vault).' });
        card.addEventListener('blur', () => { const d = st.cardStr.replace(/\D/g, ''); const bad = d.length > 0 && d.length < 12; card.classList.toggle('invalid', bad); cf._setError(bad ? 'That looks short for a card number; the hosted field will confirm before Post.' : null); });
        fields.append(cf);
      }
      // The requirement and the floor are in the label and the standing hint, before anyone types (WCAG 3.3.2).
      const amt = h('input', { class: 'input co-amount', id: FIELD_IDS.amount, type: 'text', inputmode: 'decimal', testid: 'checkout.amount', value: st.amountStr, onInput: (ev) => { st.amountStr = ev.target.value; if (st.refusalNode || confirmPending()) { st.refusalNode = null; rerender(r, 'checkout.amount'); caretEnd('checkout.amount'); return; } af._setError(null); const c = cents(st.amountStr); document.querySelectorAll('.co-selfpay').forEach((b) => { const restricted = b.closest('tr') && b.closest('tr').querySelector('.chip.info'); b.hidden = !(c >= Number(b.dataset.fee)) || !!restricted; }); } });
      const af = field('Amount', amt, { hint: 'Above $0.00; prefilled with the estimate.', required: true });
      if (errors.amount) af._setError(errors.amount);
      amt.addEventListener('blur', () => { const c = cents(st.amountStr); const bad = !(c > 0); amt.classList.toggle('invalid', bad); if (bad) af._setError('Enter an amount above $0.00, or choose Nothing due today.'); else if (!errors.amount) af._setError(null); });
      fields.append(af);
      body.append(fields);
      const unfiled = procs.length && !(Proto.store.encounter(a.encounterId) || {}).noteFiled;
      policy.push('Allocates to the oldest open charge first' + (unfiled ? '; until the note is filed, the payment waits as credit.' : '.'));
    } else if (st.decision === 'send_statement') {
      body.append(h('p', { class: 'muted', text: 'No ledger entry today. A statement-due row for ' + money(afterWriteoff(st, est)) + ' appears on Money Desk → Statements due.' }));
      policy.push('The window defers the balance to a statement, and the decision is reversible until the statement job runs.');
    } else if (st.decision === 'payment_plan') {
      body.append(labelledRow('co-cadence-lab', 'Cadence', h('div', { class: 'btnrow' }, ...CADENCES.map(([code, label]) => btn(label, { testid: 'checkout.plan.cadence.' + code, pressed: pressed(st.cadence === code), onClick: () => { st.cadence = code; st.refusalNode = null; rerender(r, 'checkout.plan.cadence.' + code); } })))));
      body.append(h('p', { class: 'muted', text: 'Plan for ' + money(afterWriteoff(st, est)) + ', ' + CADENCES.find((c) => c[0] === st.cadence)[1].toLowerCase() + ', on the processor token.' }));
      policy.push('Only patient-due charges are eligible; charges waiting on insurance are greyed.');
    } else {
      body.append(h('p', { class: 'muted', text: 'Nothing due today; there is nothing to collect at the window.' }));
      policy.push('Post still writes the typed decision, so the day\'s "Not collected at window" line stays honest.');
    }
    const wo = writeoffBlock(r, st, policy, errors);
    // Why: the same sentences, one tap away, off the path between the decision and Post (C6).
    const why = h('details', null, h('summary', { class: 'co-summary', testid: 'checkout.payment.why' }, 'Why this decision'),
      ...policy.map((t) => h('p', { class: 'hint', text: t })));
    // The summary stands before the first field, names each field in error and links to it; it takes the keyboard.
    const MESSAGE = { amount: 'Amount: type an amount above $0.00', writeoff: 'Write-off amount: type an amount above $0.00', pin: 'Your PIN: enter your PIN to post', tender: 'Tender: choose card, cash or check' };
    const summary = errorSummary(Object.keys(errors).map((k) => ({ id: FIELD_IDS[k], message: MESSAGE[k] || errors[k] })), { testid: 'checkout.errors' });
    // The shared summary's links are text-height; a link is a target like any other, so it takes the target height here
    // until components.css gives .errsummary a the rule (needs_shared).
    if (summary) summary.querySelectorAll('a').forEach((a) => { a.style.display = 'inline-flex'; a.style.alignItems = 'center'; a.style.minHeight = 'var(--target)'; });
    return h('section', { class: 'stack co-payment', 'aria-labelledby': 'co-pay-head' },
      h('div', { class: 'row between' }, h('h2', { id: 'co-pay-head', text: 'Payment' }), why),
      summary, labelledRow('co-decision-lab', 'Decision', seg), body, wo, finishRow);
  }

  function writeoffBlock(r, st, policy, errors) {
    const S = Proto.store.get();
    // What posted, not what was asked: the store settles min(amount, due) when the approval lands.
    if (st.heldReq && st.heldReq.status === 'approved') return h('div', { class: 'row' }, chip('clear', 'Write-off ' + money(st.heldReq.postedCents != null ? st.heldReq.postedCents : st.heldReq.amountCents) + ' approved by ' + st.heldReq.decidedBy), h('span', { class: 'small muted', text: 'Already on the ledger; Post writes the rest.' }));
    if (!st.writeoffOpen) return h('div', null, btn('Add write-off or adjustment', { kind: 'reversible', testid: 'checkout.writeoff.add', onClick: () => { st.writeoffOpen = true; st.refusalNode = null; rerender(r, 'checkout.writeoff.amount'); } }));
    policy.push('At or above ' + money(S.tenant.dualReleaseThresholdCents) + ' a second approver is needed; the posting is held.');
    const amt = h('input', { class: 'input co-amount', id: FIELD_IDS.writeoff, type: 'text', inputmode: 'decimal', testid: 'checkout.writeoff.amount', value: st.writeoffStr, onInput: (ev) => { st.writeoffStr = ev.target.value; if (st.refusalNode || confirmPending()) { st.refusalNode = null; rerender(r, 'checkout.writeoff.amount'); caretEnd('checkout.writeoff.amount'); } else wf._setError(null); } });
    // The floor and the ceiling are stated before typing; a blank write-off is no write-off, so the field is not required.
    const wf = field('Write-off amount', amt, { hint: 'Above $0.00, up to the balance; blank means none.' });
    if (errors && errors.writeoff) wf._setError(errors.writeoff);
    amt.addEventListener('blur', () => { const bad = st.writeoffStr.trim() !== '' && !(cents(st.writeoffStr) > 0); amt.classList.toggle('invalid', bad); if (bad) wf._setError('Enter a dollar amount above $0.00, or remove the write-off.'); else if (!(errors && errors.writeoff)) wf._setError(null); });
    // Courtesy starts pressed: the store wrote it whenever nothing was chosen, so the screen now says so (CLT-tesler-defaults).
    const reasons = h('div', { class: 'btnrow', role: 'group', 'aria-labelledby': 'co-reason-lab' }, ...REASONS.map(([code, label]) => btn(label, { testid: 'checkout.writeoff.reason.' + code, pressed: pressed(st.writeoffReason === code), onClick: () => { st.writeoffReason = code; st.refusalNode = null; rerender(r, 'checkout.writeoff.reason.' + code); } })));
    // One id, one verb: the control that removes the write-off is not the control that adds it.
    const remove = btn('Remove write-off', { kind: 'quiet', class: 'compact', testid: 'checkout.writeoff.remove', onClick: () => removeWriteoff(r, st) });
    return h('div', { class: 'stack co-writeoff', role: 'group', 'aria-labelledby': 'co-writeoff-lab' }, h('span', { id: 'co-writeoff-lab', text: 'Write-off or adjustment' }),
      h('div', { class: 'co-two' }, wf, h('div', { class: 'field' }, h('label', { id: 'co-reason-lab', text: 'Reason code' }), reasons)), remove);
  }

  /* The finish row. Post cannot be undone, so it is never alone and never writes on its first press: the shared
     confirmable puts a read-back and an equal-size Cancel between the first press and the write (WCAG 3.3.4,
     INT-irreversible-identity), and Return to Board stands beside it as the reversible way out (CLT-neutral-irreversible). */
  function postRow(r, a, st, est, name) {
    const P = window.__proto;
    const held = st.heldReq && st.heldReq.status === 'pending';
    // While a gate is on screen the primary never keeps the irreversible identity: it switches to Held, and the
    // verb line beside it says what to do next (CONTRACTS §6).
    const gated = !held && !!st.refusalNode;
    const errors = st.refusalNode ? st.errors || {} : {};
    const row = h('div', { class: 'co-postrow' });
    if (P.device === 'shared') {
      // Typing the PIN dissolves the gate that asked for it, as typing an amount does; Post is live again.
      const pin = h('input', { class: 'input co-pin', id: FIELD_IDS.pin, type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', testid: 'checkout.pin', value: st.pin, onInput: (ev) => { st.pin = ev.target.value; if (st.refusalNode || confirmPending()) { st.refusalNode = null; rerender(r, 'checkout.pin'); caretEnd('checkout.pin'); } } });
      pin.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const b = document.querySelector('[data-testid="checkout.post"]'); if (b) b.click(); } });
      const pf = field('Your PIN', pin, { hint: '6 digits; three misses lock this device. Shared desk: the PIN makes you the frozen poster for this posting.', required: true });
      if (errors.pin) pf._setError(errors.pin);
      row.append(pf);
    }
    const back = () => btn('Return to Board', { kind: 'reversible', testid: 'checkout.back', onClick: () => Proto.router.go(r.persona, 'board') });
    if (held) {
      // ui.btn owns the held name ("Held: Post"); the request stamp beside it says who is being waited on.
      const stamp = st.requested ? h('span', { class: 'row', id: 'co-requested', tabindex: '-1' }, chip('review', 'Request ' + st.heldReq.id + ' waiting'), h('span', { class: 'small muted', text: ((st.heldReq.eligible || []).join(' or ') || 'The approver') + ' will see it on their phone; this screen flips to Post when they approve.' })) : null;
      row.append(back(), btn('Post', { kind: 'held', testid: 'checkout.post', describedby: stamp ? 'co-requested' : null, onClick: () => Proto.router.announce('Waiting on ' + ((st.heldReq.eligible || []).slice(0, 2).join(' or ') || 'a second approver')) }));
      if (stamp) row.append(stamp);
    } else if (gated) {
      // A press on Held re-evaluates first: a gate whose cause is gone has fallen on the render, and the keyboard
      // lands on the live Post — whose own press asks for the read-back. Nothing writes straight through Held.
      row.append(back(), btn('Post', { kind: 'held', testid: 'checkout.post', onClick: () => { render(r); const el = document.querySelector('[data-testid="refusal.control"]'); if (el) el.focus(); else rerender(r, 'checkout.post'); } }));
    } else {
      const opts = { testid: 'checkout.post', confirmLabel: 'Post', severity: 'required', readback: readback(a, st, est, name), onConfirm: () => doPost(r, a, st) };
      const slot = confirmable('Post', opts);
      // The first press reads the form before it asks (precheck): a refusal at the field stops here, and the read-back
      // is composed from what is in the fields at this moment, not at the last repaint.
      slot.addEventListener('click', (ev) => {
        if (!ev.target.closest || !ev.target.closest('[data-testid="checkout.post"]')) return;
        if (precheck(r, a, st)) { ev.stopPropagation(); ev.preventDefault(); return; }
        opts.readback = readback(a, st, est, name);
      }, true);
      // The reversible way out first, the finish last (CLT-serial-position).
      row.append(back(), slot);
      // Send back carries the approver's one line to the requester (docs/13 feature 24), not the chip alone.
      if (st.heldReq && st.heldReq.status !== 'approved') row.append(h('span', { class: 'row' }, chip('info', 'Write-off ' + st.heldReq.status.replace(/_/g, ' ') + ' by ' + (st.heldReq.decidedBy || 'approver')), st.heldReq.decisionReason ? h('span', { class: 'small muted', text: '“' + st.heldReq.decisionReason + '”' }) : null));
    }
    return h('div', { class: 'stack' }, st.refusalNode, row);
  }

  /* The rows the card reads are the store's, live: the snapshot taken at Post names them, and a visit decided
     before this screen opened (the seeded Filed-later visit) derives them from its procedures and intents. A
     payment "held as credit until the note is filed" stops saying so once the note files. */
  function postedRows(S, a, st) {
    const byId = (table, rows) => S[table].filter((x) => rows.some((y) => y.id === x.id));
    const p = st.posted;
    if (p) return Object.assign({}, p, { ledger: byId('ledger', p.ledger), intents: byId('allocationIntents', p.intents), decisions: byId('collectionDecisions', p.decisions) });
    const procIds = S.procedures.filter((x) => x.encounterId === a.encounterId).map((x) => x.id);
    const intents = S.allocationIntents.filter((i) => i.encounterId === a.encounterId);
    const charges = S.ledger.filter((e) => e.kind === 'charge' && procIds.includes(e.procedureId));
    const payIds = new Set(intents.map((i) => i.paymentId));
    const allocations = S.allocations.filter((x) => payIds.has(x.paymentId) || charges.some((c) => c.id === x.chargeId));
    allocations.forEach((x) => payIds.add(x.paymentId));
    return { ledger: S.ledger.filter((e) => payIds.has(e.id) || charges.includes(e)), allocations, intents, statements: [], plans: [], events: [], decisions: S.collectionDecisions.filter((d) => d.encounterId === a.encounterId) };
  }

  function postedCard(r, a, st, pt) {
    const S = Proto.store.get(); const p = postedRows(S, a, st); const enc = Proto.store.encounter(a.encounterId);
    const li = (t) => h('li', { text: t });
    const items = [];
    // The card names what was written in the words a person reads: storage row ids stay out of it (C3).
    const procName = (pid) => { const x = S.procedures.find((y) => y.id === pid); return x ? (S.cdt[x.cdt] || [x.cdt])[0] + (x.tooth ? ' #' + x.tooth : '') : 'this procedure'; };
    const chargeName = (lid) => { const e = S.ledger.find((y) => y.id === lid); return e && e.cdt ? (S.cdt[e.cdt] || [e.cdt])[0] + (e.tooth ? ' #' + e.tooth : '') : 'the oldest open charge'; };
    const cadenceWord = (code) => ((CADENCES.find((c) => c[0] === code) || [null, code])[1] || '').toLowerCase();
    const waiting = (e) => e.gl === 'unapplied_credit' && !(enc && enc.noteFiled);
    // A row that landed on a day already closed says so here, as Daily Close counts it (store.js ledgerRow).
    p.ledger.forEach((e) => items.push(li((KIND_WORD[e.kind] || e.kind) + ' ' + money(Math.abs(e.amountCents)) + (e.tender ? ' by ' + e.tender : '') + (e.cdt ? ' · ' + (S.cdt[e.cdt] || [e.cdt])[0] : '') + (waiting(e) ? ' · held as credit until the note is filed' : '') + (e.postedAfterClose ? ' · posted into the closed day' : ''))));
    p.allocations.forEach((x) => items.push(li('Applied ' + money(x.amountCents) + ' to ' + chargeName(x.chargeId))));
    p.intents.forEach((x) => items.push(li('Allocation intent ' + money(x.amountCents) + (x.appliedTo ? ' applied to ' + procName(x.appliedTo) + ' when the note filed' : ' waits for this visit\'s charges (Filed-later lane)'))));
    p.statements.forEach((x) => items.push(li('Statement due ' + money(x.amountCents) + ' · goes out on the next statement run')));
    p.plans.forEach((x) => items.push(li('Payment plan ' + money(x.amountCents) + ', ' + cadenceWord(x.cadence))));
    p.events.forEach((x) => items.push(li('Self-pay restriction on ' + procName(x.procedureId) + ': claim assembly refuses it')));
    p.decisions.forEach((d) => items.push(li('Collection decision: ' + DECISION_WORD[d.decision] + ', patient portion ' + money(d.patientPortionCents) + ', decided by ' + d.decidedBy)));
    const receipt = st.receipt ? h('div', { class: 'explain', role: 'group', 'aria-label': 'Receipt, patient voice' }, h('p', { class: 'small muted', text: 'Receipt for ' + displayName(pt.name, window.__proto.privacy) + ' · ' + Proto.ui.longDate(S.tenant.today) + ' · patient voice, no reason codes or poster names' }),
      ...p.ledger.filter((e) => e.kind === 'patient_payment').map((e) => h('p', { class: 'sentence', text: 'You paid ' + money(-e.amountCents) + ' today by ' + e.tender + '.' })),
      ...Proto.store.explain(a.patientId).map((s) => h('p', { class: 'sentence', text: s.patientVoice })),
      h('p', { class: 'small muted', text: 'Prototype: nothing prints and no disclosure row is written here; the product records a payment-purpose disclosure per print.' })) : null;
    return h('section', { class: 'card stack co-posted', 'aria-label': 'Posted' },
      h('div', { class: 'row' }, chip('clear', 'Posted', { big: true }), h('h2', { id: 'co-posted-head', tabindex: '-1', text: st.posted ? 'Posted in one transaction' : 'Posted at the window earlier' })),
      h('ul', { class: 'co-rows' }, ...items),
      h('div', { class: 'btnrow' }, btn('Print receipt (disclosure)', { kind: 'reversible', testid: 'checkout.receipt', pressed: pressed(st.receipt), onClick: () => { st.receipt = !st.receipt; Proto.router.announce(st.receipt ? 'Receipt shown in patient voice' : 'Receipt hidden'); rerender(r, 'checkout.receipt'); } })),
      receipt);
  }

  function explainCard(r, a, st) {
    const rows = st.explainOpen ? Proto.store.explain(a.patientId) : [];
    const panel = st.explainOpen ? h('div', { class: 'explain', 'aria-live': 'polite' },
      rows.length ? rows.map((s) => h('p', { class: 'sentence', text: st.patientVoice ? s.patientVoice : s.sentence })) : h('p', { class: 'sentence muted', text: st.patientVoice ? 'Nothing on your account is waiting to be paid.' : 'No posted charges to explain yet; today\'s charges post when the note is filed.' }),
      h('p', { class: 'small muted', text: st.patientVoice ? 'Patient voice: no reason codes, no poster names; estimates labelled "estimate". Turn the screen or print.' : 'Staff voice: one sentence per charge from ledger rows and allocations; estimates never join.' })) : null;
    return section('Balance', h('div', { class: 'btnrow' },
      btn('Explain', { kind: 'reversible', testid: 'checkout.explain', pressed: pressed(st.explainOpen), onClick: () => { st.explainOpen = !st.explainOpen; rerender(r, 'checkout.explain'); } }),
      // One toggle, one label, on Checkout and on the Ledger alike: the press mark and aria-pressed carry the
      // state, and the accessible name says how to get back.
      st.explainOpen ? btn('Show patient', { kind: 'reversible', testid: 'checkout.showpatient', pressed: pressed(st.patientVoice), ariaLabel: st.patientVoice ? 'Show patient: on; press to return to the staff view' : 'Show patient: the same rows in plain words', onClick: () => { st.patientVoice = !st.patientVoice; rerender(r, 'checkout.showpatient'); } }) : null), panel);
  }

  /* --- screen --- */
  let lastRoute = null;
  function render(r) {
    r = r || lastRoute || Proto.router.current(); lastRoute = r;
    const S = Proto.store.get(); const P = window.__proto; const aid = r.id;
    if (stateOwner !== S) { for (const k of Object.keys(state)) delete state[k]; stateOwner = S; }
    const a = Proto.store.appt(aid);
    // An id in the address that names no visit reads Nothing here in place, the shell's words with the store's
    // sentence under them: the address keeps the bad id, so Back returns to the screen before it (A6, docs/04).
    if (!a) { const nf = Proto.store.notFound('appointment'); Proto.screens.shell.mount(h('div', { class: 'stack' }, h('h1', { text: 'Nothing here' }), h('p', { class: 'muted', text: nf.why }), btn('Back to home', { kind: 'quiet', testid: 'notfound.home', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) }))); return; }
    const pt = Proto.store.patient(a.patientId); const enc = Proto.store.encounter(a.encounterId);
    /* What the window collects is the store's one estimate (windowEstimate: the plan estimate capped by what the
       ledger still leaves open, or the released charges' patient side). This screen used to foot its own from
       S.estimates / a.balanceCents, so a visit charted and filed today read $130 due above a $0.00 est. footer. */
    const est = Object.assign({ note: 'No plan estimate on file; the patient portion shown is what the account still owes.' }, Proto.store.windowEstimate(aid));
    const st = state[aid] || (state[aid] = fresh(est.patientCents));
    // A stale prefill outlives the state it was built from: re-read it when the ledger has moved under it.
    if (st.decision !== 'zero_due' && est.patientCents <= 0 && !st.posted) { st.decision = 'zero_due'; st.amountStr = dollars(0); st.tender = null; }
    // A gate goes with its cause (the Board prunes its own the same way): Post is never Held for an outage the
    // Andon no longer shows or a pass that has since been issued.
    const code = st.refusalNode ? st.refusalNode.dataset.code : null;
    // Only the pass gate ("Open Roles") falls with a pass: a seat without post_payment keeps its Switch author gate.
    const ctl = st.refusalNode ? ((st.refusalNode.querySelector('button') || {}).textContent || '') : '';
    const me = Proto.store.currentUser(); const uid = me.id;
    // A gate remembers who raised it: another author at the desk re-evaluates rather than inheriting it.
    if (st.refusalNode) { const o = st.refusalNode.dataset.owner; if (!o) st.refusalNode.dataset.owner = uid; else if (o !== uid) st.refusalNode = null; }
    if ((code === 'outage' && !P.outage) || (code === 'after_hours' && !S.clock.afterHours) || (code === 'entitlement' && ctl === 'Open Roles' && !me.noPass) || (code === 'entitlement' && ctl === 'Switch author' && (me.entitlements || []).includes('post_payment'))) st.refusalNode = null;
    // The PIN authorises the person who typed it: a switch of author (the pad, a persona change) discards it.
    if (st.pinOwner !== uid) { if (st.pinOwner) st.pin = ''; st.pinOwner = uid; }
    if (st.heldReq) st.heldReq = S.approvals.find((x) => x.id === st.heldReq.id) || st.heldReq;
    const procs = S.procedures.filter((p) => p.encounterId === a.encounterId);
    const bal = Proto.store.balances(a.patientId);
    const covers = (fee) => st.decision === 'collect' && cents(st.amountStr) >= fee;
    const name = displayName(pt.name, P.privacy);
    // The same clock and the same type word as the Board card for this visit (ui.js time, typeWord).
    const sub = Proto.ui.time(a.time) + ' · ' + Proto.ui.typeWord(a.type) + ' · ' + (S.users.find((u) => u.id === a.providerId) || {}).short + ' · ' + (pt.primary ? Proto.store.carrierName(pt.primary) + (pt.secondary ? ' + ' + Proto.store.carrierName(pt.secondary) : '') : 'Self-pay');
    const railBtn = Proto.screens.rail ? Proto.screens.rail.button(a.patientId, r, 'checkout.rail') : null;
    // Return to Board stands beside Post while the form is open (the reversible way out, next to the irreversible one);
    // once the visit is posted there is no Post, so it returns to the head. One id, one control, in either state.
    const decided = st.posted || S.collectionDecisions.some((d) => d.encounterId === a.encounterId);
    const head = pageHead('Checkout · ' + name, sub, railBtn, decided ? btn('Return to Board', { kind: 'reversible', testid: 'checkout.back', onClick: () => Proto.router.go(r.persona, 'board') }) : null);
    const status = h('div', { class: 'row' },
      enc && enc.noteFiled ? chip('clear', 'Note filed') : chip('review', 'Note unfiled — Filed later'),
      procs.some((p) => needsAttachment(p)) ? chip('review', 'Claim needs pre-flight') : chip('clear', 'Claim ready'),
      !st.posted && String(a.status).startsWith('checked_out') ? chip('info', 'Already checked out') : null);
    // The decision and its finish control come before the line-by-line detail, so Post is on screen without
    // scrolling at 1280×900, 1024×768 and 420×860; the completed procedures read below it.
    const page = h('div', { class: 'stack co-page' }, head, threeNumbers(bal), status);
    // One typed decision per visit: a visit already decided shows its record, not a form whose only outcome is a refusal.
    if (decided) page.append(postedCard(r, a, st, pt));
    else page.append(paymentCard(r, a, st, est, procs, postRow(r, a, st, est, name)));
    page.append(proceduresCard(S, a, st, procs, est, covers), explainCard(r, a, st));
    Proto.screens.shell.mount(page);
  }

  Proto.screens.checkout = { render, state, lineEstimates };
  Proto.router.on('checkout', (r) => Proto.screens.checkout.render(r));
})();
