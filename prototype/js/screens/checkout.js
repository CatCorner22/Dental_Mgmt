/* Checkout (flow 4): completed procedures with the estimate column, typed collection decision
   (Collect / Send statement / Payment plan / Nothing due today), self-pay restriction toggle,
   write-off with dual release (held, never silently allowed), desk PIN on Post for shared desks,
   Explain in two voices. Route: checkout/<apptId>. Features 1, 23, 24, 25, 30. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, section, pageHead, displayName } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const NEEDS_ATTACHMENT = { d4341: true, d2740: true };
  const REASONS = [['courtesy', 'Courtesy'], ['hardship', 'Hardship'], ['prior_period', 'Prior period'], ['contractual_ppo', 'Contractual PPO']];
  const CADENCES = [['weekly', 'Weekly'], ['biweekly', 'Every two weeks'], ['monthly', 'Monthly']];
  const SEG = { collect: 'collect', 'send-statement': 'send_statement', 'payment-plan': 'payment_plan', 'zero-due': 'zero_due' };
  const DECISION_WORD = { collect: 'Collect', send_statement: 'Send statement', payment_plan: 'Set up payment plan', zero_due: 'Nothing due today' };
  const KIND_WORD = { charge: 'Charge', patient_payment: 'Payment', write_off: 'Write-off', adjustment: 'Adjustment' };
  const state = {}; // per appointment id: form state, last refusal node, held request, posted rows
  let stateOwner = null; // the store instance the state belongs to; a store reset clears it

  const dollars = (c) => (c / 100).toFixed(2);
  const cents = (s) => { const n = Number(String(s == null ? '' : s).replace(/[^0-9.]/g, '')); return isFinite(n) ? Math.round(n * 100) : 0; };
  const pressed = (b) => (b ? 'true' : 'false');

  function fresh(patientCents) {
    return { decision: patientCents === 0 ? 'zero_due' : 'collect', tender: null, amountStr: dollars(patientCents), cardStr: '', selfPay: new Set(), writeoffOpen: false, writeoffStr: '', writeoffReason: null, cadence: 'monthly', pin: '', explainOpen: false, patientVoice: false, receipt: false, refusalNode: null, heldReq: null, requested: false, posted: null };
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

  function rerender(r, focusTestid) {
    r = r || lastRoute || Proto.router.current();
    render(r);
    Proto.screens.shell.refreshAndon(r);
    if (focusTestid) { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el && el.focus) el.focus(); }
  }

  /* Every gate has one control. The store leaves a few controls null; supply the obvious one. */
  function withControl(res, r, st) {
    const v = { code: res.code, verb: res.verb, control: res.control, why: res.why };
    if (res.code === 'zero_collect_refused') { v.control = res.control || 'Nothing due today'; v.onControl = () => { st.decision = 'zero_due'; st.refusalNode = null; rerender(r, 'checkout.collect.seg.zero-due'); }; }
    else if (res.code === 'pin_required') { v.control = 'Enter PIN'; v.onControl = () => { const el = document.querySelector('[data-testid="checkout.pin"]'); if (el) el.focus(); }; }
    else if (res.code === 'tender_required') { v.control = 'Choose card'; v.onControl = () => { st.tender = 'card'; st.refusalNode = null; rerender(r, 'checkout.card.number'); }; }
    else if (res.code === 'outage') { v.control = res.control || 'Support line'; v.severity = 'stop'; v.onControl = () => Proto.router.announce('Support: 615-555-0100, answered 7 am to 6 pm Central'); }
    else { v.control = res.control || 'Back to Board'; v.onControl = () => Proto.router.go(r.persona, 'board'); }
    return v;
  }

  function doPost(r, a, st) {
    const S = Proto.store.get();
    const before = snapshot(S);
    const approved = st.heldReq && st.heldReq.status === 'approved';
    const form = {
      decision: st.decision,
      tender: st.decision === 'collect' ? st.tender : null,
      amountCents: st.decision === 'collect' ? cents(st.amountStr) : 0,
      selfPay: [...st.selfPay],
      writeoffCents: approved ? 0 : (st.writeoffOpen ? cents(st.writeoffStr) : 0),
      writeoffReason: st.writeoffReason || 'courtesy',
      cadence: st.cadence,
      pin: st.pin || null,
      approvalRequestId: approved ? st.heldReq.id : null,
    };
    const res = Proto.store.postCheckout(a.id, form);
    if (res.ok) {
      st.posted = diff(S, before); st.posted.form = form; st.refusalNode = null;
      Proto.router.announce('Posted. ' + st.posted.ledger.length + ' ledger rows and the collection decision are written.');
      rerender(r, 'checkout.back');
      return;
    }
    if (res.held) {
      st.heldReq = S.approvals.find((x) => x.id === res.requestId) || null;
      st.refusalNode = refusal({ code: res.code, verb: res.verb, control: res.control || 'Request approval', why: res.why, onControl: () => {
        st.requested = true;
        Proto.router.announce('Approval requested — Dana or Dr. Reagan will see it on their phone. Request ' + res.requestId);
        rerender(r, 'checkout.post');
      } });
      rerender(r, 'refusal.control');
      return;
    }
    st.refusalNode = refusal(withControl(res, r, st));
    rerender(r, 'refusal.control');
  }

  /* --- pieces --- */
  function threeNumbers(bal) {
    const n = (label, v) => h('div', { class: 'n' }, h('div', { class: 'v', text: money(v) }), h('div', { class: 'l', text: label }));
    return h('div', { class: 'threenum', 'aria-label': 'Account balance' }, n('Patient due', bal.patientDue), n('Waiting on insurance', bal.insurancePending), n('Credit', bal.credit));
  }

  function proceduresCard(S, a, st, procs, est, coversNow) {
    const ests = lineEstimates(procs, est.patientCents);
    const feeTotal = procs.reduce((s, p) => s + p.feeCents, 0);
    const rows = procs.map((p, i) => {
      const name = (S.cdt[p.cdt] || [p.cdt])[0];
      const pre = p.selfPayRestricted ? chip('info', 'Restricted — no claim') : NEEDS_ATTACHMENT[p.cdt] ? chip('review', 'Needs: attachment') : chip('clear', 'Ready');
      const on = st.selfPay.has(p.id);
      const toggle = btn('Paid in full — don\'t send to insurance', { kind: 'reversible', class: 'compact co-selfpay', testid: 'checkout.line.' + p.id + '.selfpay', pressed: pressed(on), ariaLabel: 'Paid in full, do not send ' + name + ' to insurance', onClick: () => { if (on) st.selfPay.delete(p.id); else st.selfPay.add(p.id); rerender(null, 'checkout.line.' + p.id + '.selfpay'); } });
      toggle.dataset.fee = p.feeCents; toggle.hidden = !coversNow(p.feeCents) || !!p.selfPayRestricted;
      return h('tr', { testid: 'checkout.line.' + p.id },
        h('td', null, h('div', { text: name }), h('div', { class: 'small muted', text: p.cdt.toUpperCase() })),
        h('td', { class: 'num', text: p.tooth ? '#' + p.tooth : '—' }),
        h('td', { class: 'num', text: money(p.feeCents) }),
        h('td', { class: 'num co-est', text: money(ests[i]) }),
        h('td', null, pre),
        h('td', null, toggle));
    });
    const table = h('div', { class: 'wrap-x' }, h('table', { class: 'data co-lines' },
      h('thead', null, h('tr', null, h('th', { text: 'Procedure' }), h('th', { class: 'num', text: 'Tooth' }), h('th', { class: 'num', text: 'Fee' }), h('th', { class: 'num co-est', text: 'Patient portion (estimate)' }), h('th', { text: 'Pre-flight' }), h('th', { text: 'Self-pay' }))),
      h('tbody', null, ...rows),
      h('tfoot', null, h('tr', null, h('th', { text: 'Totals' }), h('th'), h('th', { class: 'num', text: money(feeTotal) }), h('th', { class: 'num co-est', text: money(est.patientCents) + ' est.' }), h('th', { colspan: '2', class: 'small muted', text: 'Estimate is separate from the balance above; it never enters the ledger.' })))));
    const why = h('details', null, h('summary', { class: 'co-summary', testid: 'checkout.estimate.why' }, 'How the estimate was built'),
      h('p', { class: 'hint', text: (est.note || 'No plan estimate on file.') + (est.insuranceCents ? ' Insurance est. ' + money(est.insuranceCents) + '.' : '') + (est.writeoffCents ? ' PPO write-off est. ' + money(est.writeoffCents) + '.' : '') }));
    return section('Completed today', procs.length ? table : h('p', { class: 'muted', text: 'No completed procedures on this encounter.' }), why);
  }

  function field(label, input, hint) {
    const id = input.id || (input.id = 'f-' + Math.random().toString(36).slice(2, 8));
    const hintEl = h('p', { class: 'hint', id: id + '-hint', text: hint || '' });
    input.setAttribute('aria-describedby', hintEl.id);
    return { node: h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hintEl), hint: hintEl, input };
  }

  function paymentCard(r, a, st, est, procs) {
    const zero = est.patientCents === 0;
    const segs = (zero ? [['zero-due', 'Nothing due today']] : [['collect', 'Collect']]).concat([['send-statement', 'Send statement'], ['payment-plan', 'Set up payment plan']]);
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Collection decision' }, ...segs.map(([code, label]) => btn(label, { testid: 'checkout.collect.seg.' + code, pressed: pressed(st.decision === SEG[code]), onClick: () => { st.decision = SEG[code]; st.refusalNode = null; rerender(r, 'checkout.collect.seg.' + code); } })));
    const body = h('div', { class: 'stack' });
    if (st.decision === 'collect') {
      const tenders = h('div', { class: 'btnrow', role: 'group', 'aria-label': 'Tender' }, ...['card', 'cash', 'check'].map((t) => btn(t[0].toUpperCase() + t.slice(1), { testid: 'checkout.tender.' + t, pressed: pressed(st.tender === t), onClick: () => { st.tender = t; st.refusalNode = null; rerender(r, t === 'card' ? 'checkout.card.number' : 'checkout.tender.' + t); } })));
      body.append(tenders);
      if (st.tender === 'card') {
        const card = h('input', { class: 'input co-hosted', type: 'text', inputmode: 'numeric', autocomplete: 'off', testid: 'checkout.card.number', value: st.cardStr, placeholder: '•••• •••• •••• ••••', onInput: (ev) => { st.cardStr = ev.target.value; } });
        const cf = field('Card (hosted field, never stored here)', card, 'Processor vault, PCI SAQ-A. Any digits are accepted in the prototype.');
        card.addEventListener('blur', () => { const d = st.cardStr.replace(/\D/g, ''); const bad = d.length > 0 && d.length < 12; card.classList.toggle('invalid', bad); cf.hint.textContent = bad ? 'That looks short for a card number; the hosted field will confirm before Post.' : 'Processor vault, PCI SAQ-A. Any digits are accepted in the prototype.'; });
        body.append(cf.node);
      }
      const amt = h('input', { class: 'input co-amount', type: 'text', inputmode: 'decimal', testid: 'checkout.amount', value: st.amountStr, onInput: (ev) => { st.amountStr = ev.target.value; const c = cents(st.amountStr); document.querySelectorAll('.co-selfpay').forEach((b) => { const restricted = b.closest('tr') && b.closest('tr').querySelector('.chip.info'); b.hidden = !(c >= Number(b.dataset.fee)) || !!restricted; }); } });
      const af = field('Amount', amt, 'Prefilled with the patient portion estimate.');
      amt.addEventListener('blur', () => { const c = cents(st.amountStr); const bad = !(c > 0); amt.classList.toggle('invalid', bad); af.hint.textContent = bad ? 'Enter an amount above $0, or choose Nothing due today.' : 'Prefilled with the patient portion estimate.'; });
      body.append(h('div', { class: 'co-two' }, af.node, h('p', { class: 'hint co-alloc', text: 'Allocates to oldest open charge first' + (procs.length && !(Proto.store.encounter(a.encounterId) || {}).noteFiled ? '; the note is not filed yet, so the payment waits as credit until charges post.' : '.') })));
    } else if (st.decision === 'send_statement') {
      body.append(h('p', { class: 'muted', text: 'No ledger entry today. A statement-due row for ' + money(est.patientCents) + ' appears on Money Desk → Statements due, reason "window deferred". Reversible until the statement job runs.' }));
    } else if (st.decision === 'payment_plan') {
      body.append(h('div', { class: 'btnrow', role: 'group', 'aria-label': 'Cadence' }, ...CADENCES.map(([code, label]) => btn(label, { testid: 'checkout.plan.cadence.' + code, pressed: pressed(st.cadence === code), onClick: () => { st.cadence = code; rerender(r, 'checkout.plan.cadence.' + code); } }))));
      body.append(h('p', { class: 'muted', text: 'Only patient-due charges are eligible; Waiting-on-insurance charges greyed. Plan for ' + money(est.patientCents) + ', ' + CADENCES.find((c) => c[0] === st.cadence)[1].toLowerCase() + ', on the processor token.' }));
    } else {
      body.append(h('p', { class: 'muted', text: 'Patient portion is $0. Post still writes the collection decision (reason zero_due) so the day\'s "Not collected at window" line stays honest.' }));
    }
    return section('Payment', seg, body, writeoffBlock(r, st));
  }

  function writeoffBlock(r, st) {
    const S = Proto.store.get();
    if (st.heldReq && st.heldReq.status === 'approved') return h('div', { class: 'row' }, chip('clear', 'Write-off ' + money(st.heldReq.amountCents) + ' approved by ' + st.heldReq.decidedBy), h('span', { class: 'small muted', text: 'Already on the ledger; Post writes the rest.' }));
    if (!st.writeoffOpen) return h('div', null, btn('Add write-off or adjustment', { kind: 'reversible', testid: 'checkout.writeoff.add', onClick: () => { st.writeoffOpen = true; rerender(r, 'checkout.writeoff.amount'); } }));
    const amt = h('input', { class: 'input co-amount', type: 'text', inputmode: 'decimal', testid: 'checkout.writeoff.amount', value: st.writeoffStr, onInput: (ev) => { st.writeoffStr = ev.target.value; } });
    const wf = field('Write-off amount', amt, 'At or above ' + money(S.tenant.dualReleaseThresholdCents) + ' a second approver is needed; the posting is held, never silently allowed.');
    amt.addEventListener('blur', () => { const bad = st.writeoffStr.trim() !== '' && !(cents(st.writeoffStr) > 0); amt.classList.toggle('invalid', bad); if (bad) wf.hint.textContent = 'Enter a dollar amount, or remove the write-off.'; });
    const reasons = h('div', { class: 'btnrow', role: 'group', 'aria-label': 'Reason code' }, ...REASONS.map(([code, label]) => btn(label, { testid: 'checkout.writeoff.reason.' + code, pressed: pressed(st.writeoffReason === code), onClick: () => { st.writeoffReason = code; rerender(r, 'checkout.writeoff.reason.' + code); } })));
    const remove = btn('Remove write-off', { kind: 'quiet', class: 'compact', testid: 'checkout.writeoff.add', pressed: 'true', onClick: () => { st.writeoffOpen = false; st.writeoffStr = ''; st.writeoffReason = null; rerender(r, 'checkout.writeoff.add'); } });
    return h('div', { class: 'stack co-writeoff', 'aria-label': 'Write-off or adjustment' }, h('div', { class: 'co-two' }, wf.node, h('div', { class: 'field' }, h('label', { text: 'Reason code' }), reasons)), remove);
  }

  function postRow(r, a, st) {
    const P = window.__proto;
    const held = st.heldReq && st.heldReq.status === 'pending';
    const row = h('div', { class: 'co-postrow' });
    if (P.device === 'shared') {
      const pin = h('input', { class: 'input co-pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', testid: 'checkout.pin', value: st.pin, onInput: (ev) => { st.pin = ev.target.value; } });
      pin.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const b = document.querySelector('[data-testid="checkout.post"]'); if (b) b.click(); } });
      row.append(field('Your PIN', pin, 'Shared desk: the PIN makes you the frozen poster for this posting.').node);
    }
    if (held) {
      row.append(btn('Held', { kind: 'held', testid: 'checkout.post', ariaLabel: 'Held: waiting on a second approver', onClick: () => Proto.router.announce('Held. Waiting on ' + (st.heldReq.eligible || []).slice(0, 2).join(' or ') + ' for request ' + st.heldReq.id) }));
      if (st.requested) row.append(h('span', { class: 'row' }, chip('review', 'Request ' + st.heldReq.id + ' waiting'), h('span', { class: 'small muted', text: 'Dana or Dr. Reagan will see it on their phone; this screen flips to Post when they approve.' })));
    } else {
      row.append(btn('Post', { kind: 'irreversible', testid: 'checkout.post', onClick: () => doPost(r, a, st) }));
      if (st.heldReq && st.heldReq.status !== 'approved') row.append(chip('info', 'Write-off ' + st.heldReq.status.replace(/_/g, ' ') + ' by ' + (st.heldReq.decidedBy || 'approver')));
    }
    return h('div', { class: 'stack' }, st.refusalNode, row);
  }

  function postedCard(r, a, st, pt) {
    const S = Proto.store.get(); const p = st.posted;
    const li = (t) => h('li', { text: t });
    const items = [];
    p.ledger.forEach((e) => items.push(li((KIND_WORD[e.kind] || e.kind) + ' ' + money(Math.abs(e.amountCents)) + (e.tender ? ' by ' + e.tender : '') + (e.cdt ? ' · ' + (S.cdt[e.cdt] || [e.cdt])[0] : '') + (e.gl === 'unapplied_credit' ? ' · held as credit until the note is filed' : '') + ' · ' + e.id)));
    p.allocations.forEach((x) => items.push(li('Allocation ' + money(x.amountCents) + ' from ' + x.paymentId + ' to ' + x.chargeId)));
    p.intents.forEach((x) => items.push(li('Allocation intent ' + money(x.amountCents) + ' waits for charges on ' + x.encounterId + ' (Filed-later lane)')));
    p.statements.forEach((x) => items.push(li('Statement due ' + money(x.amountCents) + ' · window deferred · ' + x.id)));
    p.plans.forEach((x) => items.push(li('Payment plan ' + money(x.amountCents) + ' ' + x.cadence + ' · ' + x.id)));
    p.events.forEach((x) => items.push(li('Self-pay restriction on ' + x.procedureId + ': claim assembly refuses it')));
    p.decisions.forEach((d) => items.push(li('Collection decision ' + d.id + ': ' + DECISION_WORD[d.decision] + ', patient portion ' + money(d.patientPortionCents) + ', decided by ' + d.decidedBy)));
    const receipt = st.receipt ? h('div', { class: 'explain', 'aria-label': 'Receipt, patient voice' }, h('p', { class: 'small muted', text: 'Receipt for ' + displayName(pt.name, window.__proto.privacy) + ' · ' + Proto.ui.longDate(S.tenant.today) + ' · patient voice, no reason codes or poster names' }),
      ...p.ledger.filter((e) => e.kind === 'patient_payment').map((e) => h('p', { class: 'sentence', text: 'You paid ' + money(-e.amountCents) + ' today by ' + e.tender + '.' })),
      ...Proto.store.explain(a.patientId).map((s) => h('p', { class: 'sentence', text: s.patientVoice })),
      h('p', { class: 'small muted', text: 'Prototype: nothing prints and no disclosure row is written here; the product records a payment-purpose disclosure per print.' })) : null;
    return h('section', { class: 'card stack co-posted', 'aria-label': 'Posted' },
      h('div', { class: 'row' }, chip('clear', 'Posted', { big: true }), h('h2', { text: 'Posted in one transaction' })),
      h('ul', { class: 'co-rows' }, ...items),
      h('div', { class: 'btnrow' }, btn('Back to Board', { kind: 'reversible', testid: 'checkout.back', onClick: () => Proto.router.go(r.persona, 'board') }), btn('Print receipt (disclosure)', { kind: 'reversible', testid: 'checkout.receipt', pressed: pressed(st.receipt), onClick: () => { st.receipt = !st.receipt; Proto.router.announce(st.receipt ? 'Receipt shown in patient voice' : 'Receipt hidden'); rerender(r, 'checkout.receipt'); } })),
      receipt);
  }

  function explainCard(r, a, st) {
    const rows = st.explainOpen ? Proto.store.explain(a.patientId) : [];
    const panel = st.explainOpen ? h('div', { class: 'explain', 'aria-live': 'polite' },
      rows.length ? rows.map((s) => h('p', { class: 'sentence', text: st.patientVoice ? s.patientVoice : s.sentence })) : h('p', { class: 'sentence muted', text: st.patientVoice ? 'Nothing on your account is waiting to be paid.' : 'No posted charges to explain yet; today\'s charges post when the note is filed.' }),
      h('p', { class: 'small muted', text: st.patientVoice ? 'Patient voice: no reason codes, no poster names; estimates labelled "estimate". Turn the screen or print.' : 'Staff voice: one sentence per charge from ledger rows and allocations; estimates never join.' })) : null;
    return section('Balance', h('div', { class: 'btnrow' },
      btn('Explain', { kind: 'reversible', testid: 'checkout.explain', pressed: pressed(st.explainOpen), onClick: () => { st.explainOpen = !st.explainOpen; rerender(r, 'checkout.explain'); } }),
      st.explainOpen ? btn(st.patientVoice ? 'Show staff' : 'Show patient', { kind: 'reversible', testid: 'checkout.showpatient', pressed: pressed(st.patientVoice), onClick: () => { st.patientVoice = !st.patientVoice; rerender(r, 'checkout.showpatient'); } }) : null), panel);
  }

  /* --- screen --- */
  let lastRoute = null;
  function render(r) {
    r = r || lastRoute || Proto.router.current(); lastRoute = r;
    const S = Proto.store.get(); const P = window.__proto; const aid = r.id;
    if (stateOwner !== S) { for (const k of Object.keys(state)) delete state[k]; stateOwner = S; }
    const a = Proto.store.appt(aid);
    if (!a) { Proto.screens.shell.mount(h('div', { class: 'stack' }, h('h1', { text: 'No appointment ' + (aid || '') }), btn('Back to Board', { kind: 'reversible', testid: 'checkout.back', onClick: () => Proto.router.go(r.persona, 'board') }))); return; }
    const pt = Proto.store.patient(a.patientId); const enc = Proto.store.encounter(a.encounterId);
    const est = S.estimates[aid] || { patientCents: a.balanceCents || 0, insuranceCents: 0, writeoffCents: 0, note: 'No plan estimate on file; the patient portion shown is the appointment balance.' };
    const st = state[aid] || (state[aid] = fresh(est.patientCents));
    if (st.heldReq) st.heldReq = S.approvals.find((x) => x.id === st.heldReq.id) || st.heldReq;
    const procs = S.procedures.filter((p) => p.encounterId === a.encounterId);
    const bal = Proto.store.balances(a.patientId);
    const covers = (fee) => st.decision === 'collect' && cents(st.amountStr) >= fee;
    const name = displayName(pt.name, P.privacy);
    const sub = a.time + ' · ' + a.type + ' · ' + (S.users.find((u) => u.id === a.providerId) || {}).short + ' · ' + (pt.primary ? Proto.store.carrierName(pt.primary) + (pt.secondary ? ' + ' + Proto.store.carrierName(pt.secondary) : '') : 'Self-pay');
    const head = pageHead('Checkout · ' + name, sub, btn('Back to Board', { kind: 'reversible', testid: 'checkout.back', onClick: () => Proto.router.go(r.persona, 'board') }));
    const status = h('div', { class: 'row' },
      enc && enc.noteFiled ? chip('clear', 'Note filed') : chip('review', 'Note unfiled — Filed-later lane'),
      procs.some((p) => NEEDS_ATTACHMENT[p.cdt]) ? chip('review', 'Claim needs pre-flight') : chip('clear', 'Claim ready'),
      !st.posted && String(a.status).startsWith('checked_out') ? chip('info', 'Already checked out') : null);
    const page = h('div', { class: 'stack co-page' }, head, threeNumbers(bal), status, proceduresCard(S, a, st, procs, est, covers));
    if (st.posted) page.append(postedCard(r, a, st, pt));
    else page.append(paymentCard(r, a, st, est, procs), postRow(r, a, st));
    page.append(explainCard(r, a, st));
    Proto.screens.shell.mount(page);
  }

  Proto.screens.checkout = { render, state, lineEstimates };
  Proto.router.on('checkout', (r) => Proto.screens.checkout.render(r));
})();
