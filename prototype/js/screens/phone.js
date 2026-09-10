/* Phone: the second approver's card (docs/13 features 24 and 25; the held $410 write-off). Route 'phone',
   id 'approvals', reachable from the Andon slot and #/phone/approvals for any persona; any other id is a
   Nothing-here. Each pending approval renders as one card: requester initials, patient initials and
   account number (never the full name; a logged tap reveals it), amount, reason, the ledger sentence the
   store builds, requested-at, eligible approvers, and two 44 px controls with an 8 px gap: Approve
   (irreversible; PIN step-up first, Held while a gate stands) and Send back (reversible; one-line reason
   that rides with the request, two taps). No 'Approve all'. Refusals render through the shared component;
   the store's requester ≠ approver check (blocked_same_person) is honored before the PIN pad opens. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, time, initials, pageHead } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  /* The sim plays the biller's side. The store keeps one open request per held posting, so a second press
     plays the next scenario instead of re-announcing the first one. Each scenario writes off no more than the
     account owes (the store refuses a write-off above the balance), and at least the dual-release threshold. */
  const SIMS = [
    { pid: 'p-306', cents: 41000, reason: 'courtesy' },
    { pid: 'p-313', cents: 22500, reason: 'hardship' },
  ];
  const REASON_LABEL = { courtesy: 'Courtesy', hardship: 'Hardship', contractual_ppo: 'Contractual (PPO)', small_balance: 'Small balance', promo: 'Promotion' };

  let lastRoute = null;
  let keysOn = false;
  let pad = null;                 // step-up state while the dialog is open: {reqId, digits, dots, hint, close, store}
  /* Card state is per user, never global: the gate one approver answered and the line they read after deciding
     belong to them, not to whoever opens the card next on a shared phone. It is keyed to the store instance, so a
     rebuilt store (reset) starts every card clean; a disclosed name is read from the store's own rows, not kept here. */
  let byUser = {}; let lastStore = null;
  function st() {
    const s = S(); if (s !== lastStore) { lastStore = s; byUser = {}; }
    const uid = Proto.store.currentUser().id;
    return (byUser[uid] = byUser[uid] || { refusal: {}, declineOpen: {}, declineReason: {}, declineHint: {}, done: {}, simNote: null, notice: null });
  }
  // A gate whose cause is gone falls: on the next render, and on a press of the Held primary before it focuses anything.
  const stale = (g) => !!g && g.code === 'outage' && !S().outage;
  const nameDisclosed = (a) => S().disclosures.some((d) => d.purpose === 'approval' && d.patientId === a.patientId && d.actor === me().name && (d.recordIds || []).includes(a.id));

  /* ---- helpers ---- */
  function pat(pid) { return Proto.store.patient(pid) || { name: '—', mrn: '—' }; }
  function requestedAt(a) { return a.requestedAt || S().clock.time; }
  // The store's redacted sentence (initials · MRN): the name stays behind Show name, a logged read.
  const cardSentence = (a) => Proto.store.approvalSentence(a, { redact: true });
  function denialLine(a) {
    const s = S();
    const denied = (s.claims || []).filter((c) => c.patientId === a.patientId && c.status === 'denied');
    if (!denied.length) return null;
    const appealed = (s.appealPackets || []).some((k) => denied.some((c) => c.id === k.claimId) && k.sent);
    if (appealed) return null;
    const c = denied[0];
    return 'Denied ' + (c.deniedOn ? Proto.ui.shortDate(c.deniedOn) : Proto.ui.shortDate(c.submitted || S().tenant.today)) + ', no appeal filed.';
  }
  function heldForHours(a) { const s = S(); return !!s.clock.afterHours || a.amountCents < s.tenant.dualReleaseThresholdCents; }
  function me() { return Proto.store.currentUser(); }
  function iAmEligible() { return (me().entitlements || []).includes('approve_second'); }
  function say(text) { Proto.router.announce(text); }
  function focusOn(sel) {
    if (!sel) return;
    const q = /^[[.#]/.test(sel) ? sel : '[data-testid="' + sel + '"]';
    const el = document.querySelector(q); if (el) el.focus();
  }
  function nextSim() {
    const open = Proto.store.pendingApprovalsFor();         // the requests this approver may decide
    return SIMS.find((x) => !open.some((a) => a.kind === 'write_off' && a.patientId === x.pid && a.amountCents === x.cents)) || SIMS[0];
  }
  function simWords(x) { return money(x.cents) + ' ' + (REASON_LABEL[x.reason] || x.reason).toLowerCase() + ' write-off'; }

  function rerender(r, focus) {
    r = r || lastRoute || Proto.router.current();
    render(r);
    Proto.screens.shell.refreshAndon(r);
    if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    focusOn(focus);
  }

  /* ---- step-up: 'Confirm your PIN' (the store matches the digits against the approver's own PIN) ---- */
  function openStepup(r, a) {
    const dots = h('div', { class: 'pindots', 'aria-live': 'polite', 'aria-label': 'PIN digits entered', text: '' });
    const hint = h('p', { class: 'hint ph-hint', text: 'Four to six digits.' });
    const state = { reqId: a.id, digits: '', dots, hint, close: null, store: S() };
    function paint() { dots.textContent = '•'.repeat(state.digits.length); }
    state.add = (d) => { if (state.digits.length < 6) { state.digits += d; paint(); } };
    state.back = () => { state.digits = state.digits.slice(0, -1); paint(); };
    state.submit = () => {
      if (state.digits.length < 4) { hint.textContent = 'Enter at least four digits, then tap Approve.'; hint.classList.add('ph-hint-warn'); return; }
      state.done = true;
      // The store may have been rebuilt under the pad: then there is no request to decide, and the person is told so.
      if (state.store !== S() || !S().approvals.some((x) => x.id === a.id)) { state.close(); notice(r, a.id); return; }
      const s = st();
      // The digits go to the store, which owns the PIN rule; until verifyPin lands the older store takes the bare step-up.
      const res = Proto.store.decideApproval(a.id, me().id, 'approved', Proto.store.verifyPin ? { pin: state.digits } : true);
      state.close();
      if (!res.ok) { s.refusal[a.id] = gate(r, a, res); if (res.code === 'pin_no_match') s.refusal[a.id].fresh = true; rerender(r, 'refusal.control'); return; }
      s.refusal[a.id] = null;
      s.done[a.id] = { kind: 'approved', text: 'Approved · posted with your name as second approver · the biller’s write-off is on the ledger' };
      say('Approved. Posted with your name as second approver.');
      rerender(r, '.ph-done');
    };
    const keys = h('div', { class: 'pinpad', role: 'group', 'aria-label': 'PIN keypad' },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => btn(String(d), { testid: 'phone.stepup.' + d, onClick: () => state.add(String(d)) })),
      btn('⌫', { testid: 'phone.stepup.backspace', ariaLabel: 'Backspace', onClick: state.back }),
      btn('0', { testid: 'phone.stepup.0', onClick: () => state.add('0') }),
      h('span', { class: 'ph-pad-spacer', 'aria-hidden': 'true' }),
      btn('Approve', { testid: 'phone.stepup.submit', kind: 'irreversible', class: 'ph-submit', ariaLabel: 'Submit PIN and approve ' + money(a.amountCents), onClick: state.submit }));
    const body = h('div', { class: 'stack ph-stepup' },
      h('h2', { text: 'Confirm your PIN' }),
      h('p', { class: 'small muted', text: 'Approving ' + money(a.amountCents) + ' ' + (REASON_LABEL[a.reason] || a.reason) + ' write-off for ' + initials(pat(a.patientId).name) + ' · ' + pat(a.patientId).mrn + '. Your name is recorded as second approver.' }),
      hint, dots, keys,
      btn('Cancel', { testid: 'phone.stepup.cancel', kind: 'quiet', onClick: () => state.close() }));
    // A pad closed over a rebuilt store (reset) confirmed nothing: the next render says so where focus can land.
    state.close = Proto.ui.dialog(body, { label: 'Confirm your PIN', focus: '[data-testid="phone.stepup.1"]', onClose: () => { if (pad === state) pad = null; if (!state.done && state.store !== S()) { const s = st(); s.notice = NOTICE(a.id); s.noticeFresh = true; } } });
    pad = state;
  }

  /* ---- decisions ---- */
  /* A refusal the store raised keeps the store's own verb and control word; the screen only wires the way
     out: Send back (blocked_same_person) opens the reason line, Open the ledger (already_decided) opens the
     patient's ledger, Support line (outage) announces the number; anything else names Switch author. */
  const WAY_OUT = {
    'Send back': (r, a) => onDecline(r, a),
    'Open the ledger': (r, a) => Proto.router.go(r.persona, 'ledger', a.patientId),
    'Support line': () => Proto.ui.support(),
  };
  // A missed PIN reopens the pad; a locked pad has nothing to reopen, so its control dismisses the gate.
  const BY_CODE = {
    pin_no_match: (r, a) => { st().refusal[a.id] = null; openStepup(r, a); },
    pin_locked: (r, a) => { st().refusal[a.id] = null; rerender(r, 'phone.request.' + a.id + '.approve'); },
  };
  function gate(r, a, res) {
    const control = res.control || 'Switch author';
    const out = BY_CODE[res.code] || WAY_OUT[control] || ((rr) => Proto.screens.shell.openPinPad(rr));
    return Object.assign({}, res, { control, onControl: () => out(r, a) });
  }
  // The request the pad was confirming is gone (store rebuilt, or decided elsewhere): say so where focus can land.
  const NOTICE = (reqId) => 'Request ' + reqId + ' is no longer waiting here; nothing was approved.';
  function notice(r, reqId) { const s = st(); s.notice = NOTICE(reqId); say(s.notice); rerender(r, '.ph-notice'); }
  function onApprove(r, a) {
    const s = st();
    s.refusal[a.id] = null;
    // Pre-check with the store's own rule set first (no mutation until step-up passes): the requester
    // approving their own request is blocked_same_person, whatever their entitlements. A step-up is a
    // challenge, not a gate — it carries needsStepup, not a refusal code.
    const pre = Proto.store.decideApproval(a.id, me().id, 'approved', false);
    if (!pre.ok && !pre.needsStepup) { s.refusal[a.id] = gate(r, a, pre); rerender(r, 'refusal.control'); return; }
    if (!iAmEligible()) {
      s.refusal[a.id] = { code: 'needs_second', verb: 'Needs a second approver — ' + (a.eligible || []).slice(0, 2).join(' or '), control: 'Switch author', onControl: () => Proto.screens.shell.openPinPad(r), why: 'Only people with the Second approver entitlement can second a held posting. Switching author signs the other person in under their own name; nothing is shared.' };
      rerender(r, 'refusal.control'); return;
    }
    openStepup(r, a);
  }
  function onDecline(r, a) {
    const s = st();
    s.refusal[a.id] = null;
    if (!s.declineOpen[a.id]) { s.declineOpen[a.id] = true; s.declineHint[a.id] = null; rerender(r, 'phone.request.' + a.id + '.reason'); return; }
    const reason = (s.declineReason[a.id] || '').trim();
    if (!reason) { s.declineHint[a.id] = 'One line for the biller: what should happen first?'; rerender(r, 'phone.request.' + a.id + '.reason'); return; }
    // The line the approver typed rides with the decision: the store carries it onto the request and the
    // log row, so "Send back with one line" leaves a line behind and not just a name.
    const res = Proto.store.decideApproval(a.id, me().id, 'declined', true, reason);
    if (!res.ok) { s.refusal[a.id] = gate(r, a, res); rerender(r, 'refusal.control'); return; }
    s.done[a.id] = { kind: 'declined', text: 'Sent back to ' + a.requestedBy + ': ' + reason, reason };
    s.declineOpen[a.id] = false;
    say('Sent back: ' + reason);
    rerender(r, '.ph-done');
  }
  function simulate(r) {
    const s = st(); const x = nextSim(); s.notice = null;
    const p = P(); const prev = p.persona;
    let res;
    try { p.persona = 'biller'; res = Proto.store.requestWriteoff(x.pid, x.cents, x.reason); }
    finally { p.persona = prev; }
    if (res && res.held) { s.simNote = 'Sam (biller) tapped Post on the ' + simWords(x) + '; it is waiting on you as request ' + res.requestId + '.'; say('Request ' + res.requestId + ' is waiting for you'); }
    else if (res && res.ok) { s.simNote = 'Below the threshold: the write-off posted without a second approver.'; say(s.simNote); }
    else { s.simNote = (res && res.verb) || 'Nothing was requested.'; say(s.simNote); }
    rerender(r, 'phone.simulate');
  }

  /* ---- render pieces ---- */
  function kv(label, value, extraClass) { return h('div', { class: 'ph-kv' + (extraClass ? ' ' + extraClass : '') }, h('span', { class: 'ph-k', text: label }), h('span', { class: 'ph-v', text: value })); }

  function requestCard(r, a) {
    const s = st();
    const p = pat(a.patientId);
    const who = me();
    const mine = a.requestedById === who.id;
    const at = requestedAt(a);
    if (stale(s.refusal[a.id])) s.refusal[a.id] = null;
    const gated = !!s.refusal[a.id];
    const card = h('article', { class: 'card ph-card', 'aria-label': 'Approval request ' + a.id, dataset: { req: a.id } });
    card.append(h('div', { class: 'ph-head' },
      h('span', { class: 'ph-initials', 'aria-label': 'Requested by ' + a.requestedBy, title: 'Requester', text: initials(a.requestedBy) }),
      h('div', { class: 'grow' },
        h('div', { class: 'ph-amount', text: money(a.amountCents) }),
        h('div', { class: 'small muted', text: (REASON_LABEL[a.reason] || a.reason) + ' write-off · ' + a.id })),
      chip('review', 'Waiting')));
    const nameRow = h('div', { class: 'ph-kv' }, h('span', { class: 'ph-k', text: 'Patient' }),
      nameDisclosed(a)
        ? h('span', { class: 'ph-v', text: p.name + ' · ' + p.mrn })
        : h('span', { class: 'ph-v' }, initials(p.name) + ' · ' + p.mrn + ' ', btn('Show name', { testid: 'phone.request.' + a.id + '.name', kind: 'quiet', class: 'compact', ariaLabel: 'Show the patient’s full name (this tap is logged)', onClick: () => {
          // The tap is the logged read the label promises; the store owns the disclosures row, and the card reads it back.
          if (Proto.store.disclose) Proto.store.disclose({ patientId: a.patientId, purpose: 'approval', recordIds: [a.id] });
          rerender(r, 'phone.request.' + a.id + '.approve');
        } })));
    card.append(h('div', { class: 'ph-grid' },
      nameRow,
      kv('Requested by', a.requestedBy + (mine ? ' (you)' : '')),
      kv('Requested at', time(at)),
      kv('Eligible', (a.eligible || []).join(' or ') || '—')));
    card.append(h('p', { class: 'ph-sentence', text: cardSentence(a) }));
    const denial = denialLine(a);
    if (denial) card.append(h('p', { class: 'ph-line' }, chip('required', 'Denial'), ' ', denial));
    if (heldForHours(a)) card.append(h('p', { class: 'ph-line' }, chip('info', 'After hours'), ' Requested at ' + time(at) + ', location closed at ' + time(S().tenant.businessHours.close) + '.'));
    if (gated) { card.append(refusal(s.refusal[a.id])); s.refusal[a.id].fresh = false; }
    if (s.declineOpen[a.id]) {
      // Validation is silent until blur; the hint updates in place so a blur never re-renders the
      // card under a tap that is landing on Approve or Send back.
      const hintId = 'ph-reason-hint-' + a.id;
      const hintEl = h('p', { class: 'hint' + (s.declineHint[a.id] ? ' ph-hint-warn' : ''), id: hintId, text: s.declineHint[a.id] || 'One line for the biller; it rides with the request.' });
      const input = h('input', { class: 'input', type: 'text', maxlength: '80', id: 'ph-reason-' + a.id, testid: 'phone.request.' + a.id + '.reason', placeholder: 'e.g. appeal first', value: s.declineReason[a.id] || '', 'aria-describedby': hintId,
        onInput: (ev) => { st().declineReason[a.id] = ev.target.value; },
        onBlur: (ev) => { if (!ev.target.value.trim()) { st().declineHint[a.id] = 'One line for the biller: what should happen first?'; hintEl.textContent = st().declineHint[a.id]; hintEl.classList.add('ph-hint-warn'); } },
        onKeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); onDecline(r, a); } } });
      card.append(h('div', { class: 'field' }, h('label', { for: 'ph-reason-' + a.id, text: 'Send back with one line' }), input, hintEl));
    }
    // While a gate stands the primary carries the Held identity (CONTRACTS §6): it never dims, and the
    // word Held is the button's whole label; what is held stays in its accessible name.
    card.append(h('div', { class: 'ph-actions' },
      gated
        ? btn('Approve ' + money(a.amountCents) + ' write-off', { testid: 'phone.request.' + a.id + '.approve', kind: 'held', onClick: () => (stale(s.refusal[a.id]) ? onApprove(r, a) : focusOn('refusal.control')) })
        : btn('Approve', { testid: 'phone.request.' + a.id + '.approve', kind: 'irreversible', ariaLabel: 'Approve ' + money(a.amountCents) + ' write-off; you will confirm your PIN', onClick: () => onApprove(r, a) }),
      btn('Send back', { testid: 'phone.request.' + a.id + '.decline', kind: 'reversible', ariaLabel: s.declineOpen[a.id] ? 'Send back with the reason above' : 'Send back with a one-line reason', onClick: () => onDecline(r, a) })));
    card.append(h('details', { class: 'ph-why' }, h('summary', { testid: 'phone.request.' + a.id + '.why', text: 'Why am I seeing this?' }),
      h('p', { class: 'small muted', text: 'Write-offs at or above ' + money(S().tenant.dualReleaseThresholdCents) + ', and any refund, adjustment, or write-off outside business hours, are held for a distinct second approver. The card carries the frozen evaluation so you never open the ledger. Requester and approver are two attributed identities; the requester’s session is never elevated.' })));
    return card;
  }

  function decidedCard(r, a) {
    const done = st().done[a.id]; const gated = st().refusal[a.id];
    const s = a.status === 'approved' ? ['clear', 'Approved'] : ['required', 'Sent back'];
    return h('article', { class: 'card flat ph-decided', 'aria-label': 'Decided request ' + a.id },
      h('div', { class: 'ph-head' }, chip(s[0], s[1]), h('span', { class: 'ph-amount small', text: money(a.amountCents) }), h('span', { class: 'small muted grow', text: a.id })),
      done ? h('p', { class: 'ph-done', role: 'status', tabindex: '-1', text: done.text }) : null,
      // A gate raised against a request that was decided under this approver's hands renders here, on the row it names.
      gated ? refusal(gated) : null,
      h('p', { class: 'small muted', text: cardSentence(a) + (a.decidedBy ? ' · ' + s[1] + ' · ' + a.decidedBy + ' at ' + time(a.decidedAt) : '') }),
      // The approver's one line rides with the decision; the requester reads it here, not just who sent it back.
      a.status === 'declined' && a.decisionReason && !done ? h('p', { class: 'small' }, h('b', { text: 'Their line: ' }), a.decisionReason) : null);
  }

  function renderNotFound(r) {
    detachKeys();
    const nf = Proto.store.notFound('request');
    Proto.screens.shell.mount(h('div', { class: 'stack' },
      h('h1', { text: 'Nothing here' }),
      h('p', { class: 'muted', text: nf.why }),
      btn('Back to home', { kind: 'quiet', testid: 'notfound.home', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) })));
  }

  function render(r) {
    lastRoute = r;
    // The address names one surface here. An id this screen does not know is a Nothing-here, as it is on
    // checkout, encounter and ledger, not the Approvals screen wearing someone else's id.
    if (r && r.id && r.id !== 'approvals') { renderNotFound(r); return; }
    const s = S(); const who = me(); const cards = st();
    if (pad && pad.store !== s) { const gone = pad; pad = null; gone.close(); }   // its onClose leaves the notice
    const pending = Proto.store.pendingApprovalsFor();
    const decided = s.approvals.filter((a) => a.status !== 'pending');
    const root = h('div', { class: 'phone ph-page' });
    root.append(pageHead('Approvals', 'Signed in as ' + who.name + (iAmEligible() ? ' · eligible second approver' : ' · not an approver')));
    if (cards.notice) root.append(h('p', { class: 'small ph-notice', role: 'status', tabindex: '-1', text: cards.notice }));
    if (pending.length) {
      root.append(h('p', { class: 'small muted', text: pending.length + ' waiting. One decision per card; there is no Approve all.' }));
      pending.forEach((a) => root.append(requestCard(r, a)));
    } else {
      // The count is read from the decided rows, not printed as a figure a person would have to trust.
      const done = decided.length;
      root.append(h('section', { class: 'card ph-empty', 'aria-label': 'Nothing waiting' },
        h('div', { class: 'ph-head' }, chip('clear', 'Clear'), h('h2', { class: 'grow', text: 'Nothing waiting for you' })),
        h('p', { class: 'practice-line muted', text: 'Decided here today: ' + done + '. A held posting appears the moment someone asks.' })));
    }
    if (decided.length) {
      root.append(h('section', { class: 'stack', 'aria-label': 'Decided' }, h('h2', { class: 'ph-h2', text: 'Decided' }), ...decided.slice().reverse().map((a) => decidedCard(r, a))));
    }
    const sim = nextSim();
    root.append(h('section', { class: 'card flat stack ph-sim', 'aria-label': 'Simulate a request' },
      h('h2', { class: 'ph-h2', text: 'Test the flow alone' }),
      h('p', { class: 'small muted', text: 'Plays the biller’s side of the request so you can approve from here.' }),
      btn('Simulate: the biller requests the ' + simWords(sim), { testid: 'phone.simulate', kind: 'reversible', class: 'ph-wrap', onClick: () => simulate(r) }),
      cards.simNote ? h('p', { class: 'small', role: 'status', text: cards.simNote }) : null));
    Proto.screens.shell.mount(root);
    attachKeys();
    if (cards.noticeFresh) { cards.noticeFresh = false; say(cards.notice); focusOn('.ph-notice'); }
  }

  /* ---- keyboard: digits, Backspace, Enter drive the step-up pad while this screen is mounted ---- */
  function onKey(ev) {
    if (Proto.router.current().route !== 'phone') { detachKeys(); if (pad) pad.close(); return; }
    if (!pad) return;
    const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (/^[0-9]$/.test(ev.key)) { ev.preventDefault(); pad.add(ev.key); }
    else if (ev.key === 'Backspace') { ev.preventDefault(); pad.back(); }
    /* Enter finishes the PIN wherever the keyboard happens to be sitting. The pad opens with focus on its
       landing key, so excluding focused buttons meant Enter typed a fifth digit instead of submitting and
       only the submit key would finish. Cancel keeps its own Enter, because it is a different verb. */
    else if (ev.key === 'Enter' && !(t && t.getAttribute && t.getAttribute('data-testid') === 'phone.stepup.cancel')) { ev.preventDefault(); pad.submit(); }
  }
  function attachKeys() { if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; } }
  function detachKeys() { if (keysOn) { document.removeEventListener('keydown', onKey); keysOn = false; } }
  window.addEventListener('hashchange', () => { if (Proto.router.current().route !== 'phone') { detachKeys(); if (pad) pad.close(); } });

  Proto.screens.phone = { render, simulate, approve: onApprove, decline: onDecline, state: () => st() };
  Proto.router.on('phone', (r) => Proto.screens.phone.render(r));
})();
