/* Phone: the second approver's card (docs/13 features 24 and 25; signature moment 2 'The $410
   write-off'). Route 'phone', id 'approvals', reachable from the Andon slot and #/phone/approvals for
   any persona. Each pending approval renders as one card: requester initials, patient initials and
   account number (never the full name; a logged tap reveals it), amount, reason, the frozen ledger
   sentence, requested-at, eligible approvers, and two 44 px controls with an 8 px gap: Approve
   (irreversible; PIN step-up first) and Send back (reversible; one-line reason, two taps).
   No 'Approve all'. Refusals render through the shared component; the store's requester ≠ approver
   check (blocked_same_person) is honored before the PIN pad opens. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, initials, pageHead } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  const SIM_PID = 'p-306'; const SIM_CENTS = 41000; const SIM_REASON = 'courtesy';
  const REASON_LABEL = { courtesy: 'Courtesy', hardship: 'Hardship', contractual_ppo: 'Contractual (PPO)', small_balance: 'Small balance', promo: 'Promotion' };

  let lastRoute = null;
  let keysOn = false;
  let pad = null;                 // step-up state while the dialog is open: {reqId, digits, dots, hint, close}
  const st = { refusal: {}, declineOpen: {}, declineReason: {}, declineHint: {}, done: {}, nameShown: {}, simNote: null };

  /* ---- helpers ---- */
  function pat(pid) { return Proto.store.patient(pid) || { name: '—', mrn: '—' }; }
  function to12h(hhmm) { if (!hhmm) return '—'; const [hs, ms] = hhmm.split(':'); let hr = Number(hs); const ap = hr >= 12 ? 'pm' : 'am'; hr = hr % 12 || 12; return hr + ':' + ms + ' ' + ap; }
  function requestedAt(a) { const m = /\bat (\d{1,2}:\d{2})\s*$/.exec(a.frozenSentence || ''); return m ? m[1] : S().clock.time; }
  function redactedSentence(a) {
    const p = pat(a.patientId);
    const s = a.frozenSentence || '';
    return p.name && s.includes(p.name) ? s.split(p.name).join(initials(p.name) + ' · ' + p.mrn) : s;
  }
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
  function focusTestid(id) { if (!id) return; const el = document.querySelector('[data-testid="' + id + '"]'); if (el) el.focus(); }

  function rerender(r, focusId) {
    r = r || lastRoute || Proto.router.current();
    render(r);
    Proto.screens.shell.refreshAndon(r);
    if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    focusTestid(focusId);
  }

  /* ---- step-up: 'Re-verify: enter your PIN' (any 4-6 digits pass in the prototype) ---- */
  function openStepup(r, a) {
    const dots = h('div', { class: 'pindots', 'aria-live': 'polite', 'aria-label': 'PIN digits entered', text: '' });
    const hint = h('p', { class: 'hint ph-hint', text: 'Four to six digits. Approvals above the high-value band re-verify within two minutes.' });
    const state = { reqId: a.id, digits: '', dots, hint, close: null };
    function paint() { dots.textContent = '•'.repeat(state.digits.length); }
    state.add = (d) => { if (state.digits.length < 6) { state.digits += d; paint(); } };
    state.back = () => { state.digits = state.digits.slice(0, -1); paint(); };
    state.submit = () => {
      if (state.digits.length < 4) { hint.textContent = 'Enter at least four digits, then tap Approve.'; hint.classList.add('ph-hint-warn'); return; }
      const res = Proto.store.decideApproval(a.id, me().id, 'approved', true);
      state.close();
      if (!res.ok) { st.refusal[a.id] = res; rerender(r, 'phone.request.' + a.id + '.approve'); return; }
      st.refusal[a.id] = null;
      st.done[a.id] = { kind: 'approved', text: 'Approved · posted with your name as second approver · the biller’s Held button is now Posted' };
      say('Approved. Posted with your name as second approver.');
      rerender(r);
    };
    const keys = h('div', { class: 'pinpad', role: 'group', 'aria-label': 'PIN keypad' },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => btn(String(d), { testid: 'phone.stepup.' + d, onClick: () => state.add(String(d)) })),
      btn('⌫', { testid: 'phone.stepup.backspace', ariaLabel: 'Backspace', onClick: state.back }),
      btn('0', { testid: 'phone.stepup.0', onClick: () => state.add('0') }),
      h('span', { class: 'ph-pad-spacer', 'aria-hidden': 'true' }),
      btn('Approve', { testid: 'phone.stepup.submit', kind: 'irreversible', class: 'ph-submit', ariaLabel: 'Submit PIN and approve ' + money(a.amountCents), onClick: state.submit }));
    const body = h('div', { class: 'stack ph-stepup' },
      h('h2', { text: 'Re-verify: enter your PIN' }),
      h('p', { class: 'small muted', text: 'Approving ' + money(a.amountCents) + ' ' + (REASON_LABEL[a.reason] || a.reason) + ' write-off for ' + initials(pat(a.patientId).name) + ' · ' + pat(a.patientId).mrn + '. Your name is recorded as second approver.' }),
      hint, dots, keys,
      btn('Cancel', { testid: 'phone.stepup.cancel', kind: 'quiet', onClick: () => state.close() }));
    state.close = Proto.ui.dialog(body, { label: 'Re-verify PIN', focus: '[data-testid="phone.stepup.1"]', onClose: () => { if (pad === state) pad = null; } });
    pad = state;
  }

  /* ---- decisions ---- */
  function onApprove(r, a) {
    st.refusal[a.id] = null;
    // Pre-check with the store's own rule set first (no mutation until step-up passes): the requester
    // approving their own request is blocked_same_person, whatever their entitlements.
    const pre = Proto.store.decideApproval(a.id, me().id, 'approved', false);
    if (!pre.ok && pre.code !== 'stepup') {
      st.refusal[a.id] = Object.assign({}, pre, { control: 'Switch author', onControl: () => Proto.screens.shell.openPinPad(r) });
      rerender(r, 'phone.request.' + a.id + '.approve'); return;
    }
    if (!iAmEligible()) {
      st.refusal[a.id] = { code: 'needs_second', verb: 'Needs an eligible approver — ' + (a.eligible || []).slice(0, 2).join(' or '), control: 'Switch author', onControl: () => Proto.screens.shell.openPinPad(r), why: 'Only people with the Second approver entitlement can second a held posting. Switching author signs the other person in under their own name; nothing is shared.' };
      rerender(r, 'phone.request.' + a.id + '.approve'); return;
    }
    openStepup(r, a);
  }
  function onDecline(r, a) {
    st.refusal[a.id] = null;
    if (!st.declineOpen[a.id]) { st.declineOpen[a.id] = true; st.declineHint[a.id] = null; rerender(r, 'phone.request.' + a.id + '.reason'); return; }
    const reason = (st.declineReason[a.id] || '').trim();
    if (!reason) { st.declineHint[a.id] = 'One line for the biller: what should happen first?'; rerender(r, 'phone.request.' + a.id + '.reason'); return; }
    const res = Proto.store.decideApproval(a.id, me().id, 'declined', true);
    if (!res.ok) { st.refusal[a.id] = Object.assign({}, res, { control: res.control || 'Switch author', onControl: () => Proto.screens.shell.openPinPad(r) }); rerender(r, 'phone.request.' + a.id + '.decline'); return; }
    st.done[a.id] = { kind: 'declined', text: 'Sent back: ' + reason + ' · the biller’s screen now reads “Sent back: ' + reason + '”', reason };
    st.declineOpen[a.id] = false;
    say('Sent back: ' + reason);
    rerender(r);
  }
  function simulate(r) {
    const p = P(); const prev = p.persona;
    let res;
    try { p.persona = 'biller'; res = Proto.store.requestWriteoff(SIM_PID, SIM_CENTS, SIM_REASON); }
    finally { p.persona = prev; }
    if (res && res.held) { st.simNote = 'Sam (biller) tapped Post on the ' + money(SIM_CENTS) + ' courtesy write-off; it is held as request ' + res.requestId + '. Their button reads Held.'; say('Request ' + res.requestId + ' is waiting for you'); }
    else if (res && res.ok) { st.simNote = 'Below the threshold: the write-off posted without a second approver.'; say(st.simNote); }
    else { st.simNote = (res && res.verb) || 'Nothing was requested.'; say(st.simNote); }
    rerender(r, 'phone.simulate');
  }

  /* ---- render pieces ---- */
  function kv(label, value, extraClass) { return h('div', { class: 'ph-kv' + (extraClass ? ' ' + extraClass : '') }, h('span', { class: 'ph-k', text: label }), h('span', { class: 'ph-v', text: value })); }

  function requestCard(r, a) {
    const p = pat(a.patientId);
    const who = me();
    const mine = a.requestedById === who.id;
    const at = requestedAt(a);
    const card = h('article', { class: 'card ph-card', 'aria-label': 'Approval request ' + a.id, dataset: { req: a.id } });
    card.append(h('div', { class: 'ph-head' },
      h('span', { class: 'ph-initials', 'aria-label': 'Requested by ' + a.requestedBy, title: 'Requester', text: initials(a.requestedBy) }),
      h('div', { class: 'grow' },
        h('div', { class: 'ph-amount', text: money(a.amountCents) }),
        h('div', { class: 'small muted', text: (REASON_LABEL[a.reason] || a.reason) + ' write-off · ' + a.id })),
      chip('review', 'Waiting')));
    const nameRow = h('div', { class: 'ph-kv' }, h('span', { class: 'ph-k', text: 'Patient' }),
      st.nameShown[a.id]
        ? h('span', { class: 'ph-v', text: p.name + ' · ' + p.mrn })
        : h('span', { class: 'ph-v' }, initials(p.name) + ' · ' + p.mrn + ' ', btn('Show name', { testid: 'phone.request.' + a.id + '.name', kind: 'quiet', class: 'compact', ariaLabel: 'Show the patient’s full name (this tap is logged)', onClick: () => { st.nameShown[a.id] = true; Proto.events.write('disclosures', 'name-' + a.id); rerender(r, 'phone.request.' + a.id + '.approve'); } })));
    card.append(h('div', { class: 'ph-grid' },
      nameRow,
      kv('Requested by', a.requestedBy + (mine ? ' (you)' : '')),
      kv('Requested at', to12h(at)),
      kv('Eligible', (a.eligible || []).join(' or ') || '—')));
    card.append(h('p', { class: 'ph-sentence', text: redactedSentence(a) }));
    const denial = denialLine(a);
    if (denial) card.append(h('p', { class: 'ph-line' }, chip('required', 'Denial'), ' ', denial));
    if (heldForHours(a)) card.append(h('p', { class: 'ph-line' }, chip('info', 'After hours'), ' Requested at ' + to12h(at) + ', location closed at ' + to12h(S().tenant.businessHours.close) + '.'));
    if (st.refusal[a.id]) card.append(refusal(st.refusal[a.id]));
    if (st.declineOpen[a.id]) {
      // Validation is silent until blur; the hint updates in place so a blur never re-renders the
      // card under a tap that is landing on Approve or Send back.
      const hintId = 'ph-reason-hint-' + a.id;
      const hintEl = h('p', { class: 'hint' + (st.declineHint[a.id] ? ' ph-hint-warn' : ''), id: hintId, text: st.declineHint[a.id] || 'The biller sees this beside their Appeal control.' });
      const input = h('input', { class: 'input', type: 'text', maxlength: '80', id: 'ph-reason-' + a.id, testid: 'phone.request.' + a.id + '.reason', placeholder: 'e.g. appeal first', value: st.declineReason[a.id] || '', 'aria-describedby': hintId,
        onInput: (ev) => { st.declineReason[a.id] = ev.target.value; },
        onBlur: (ev) => { if (!ev.target.value.trim()) { st.declineHint[a.id] = 'One line for the biller: what should happen first?'; hintEl.textContent = st.declineHint[a.id]; hintEl.classList.add('ph-hint-warn'); } },
        onKeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); onDecline(r, a); } } });
      card.append(h('div', { class: 'field' }, h('label', { for: 'ph-reason-' + a.id, text: 'Send back with one line' }), input, hintEl));
    }
    card.append(h('div', { class: 'ph-actions' },
      btn('Approve', { testid: 'phone.request.' + a.id + '.approve', kind: 'irreversible', ariaLabel: 'Approve ' + money(a.amountCents) + ' write-off; you will re-verify with your PIN', onClick: () => onApprove(r, a) }),
      btn(st.declineOpen[a.id] ? 'Send back' : 'Decline', { testid: 'phone.request.' + a.id + '.decline', kind: 'reversible', ariaLabel: st.declineOpen[a.id] ? 'Send back with the reason above' : 'Decline: send back with a one-line reason', onClick: () => onDecline(r, a) })));
    card.append(h('details', { class: 'ph-why' }, h('summary', { testid: 'phone.request.' + a.id + '.why', text: 'Why am I seeing this?' }),
      h('p', { class: 'small muted', text: 'Write-offs at or above ' + money(S().tenant.dualReleaseThresholdCents) + ', and any refund, adjustment, or write-off outside business hours, are held for a distinct second approver. The card carries the frozen evaluation so you never open the ledger. Requester and approver are two attributed identities; the requester’s session is never elevated.' })));
    return card;
  }

  function decidedCard(a) {
    const done = st.done[a.id];
    const s = a.status === 'approved' ? ['clear', 'Approved'] : ['required', 'Sent back'];
    return h('article', { class: 'card flat ph-decided', 'aria-label': 'Decided request ' + a.id },
      h('div', { class: 'ph-head' }, chip(s[0], s[1]), h('span', { class: 'ph-amount small', text: money(a.amountCents) }), h('span', { class: 'small muted grow', text: a.id })),
      done ? h('p', { class: 'ph-done', role: 'status', text: done.text }) : null,
      h('p', { class: 'small muted', text: redactedSentence(a) + (a.decidedBy ? ' · ' + (a.status === 'approved' ? 'approved' : 'sent back') + ' by ' + a.decidedBy + ' at ' + to12h(a.decidedAt) : '') }));
  }

  function render(r) {
    lastRoute = r;
    const s = S(); const who = me();
    const pending = s.approvals.filter((a) => a.status === 'pending');
    const decided = s.approvals.filter((a) => a.status !== 'pending');
    const root = h('div', { class: 'phone ph-page' });
    root.append(pageHead('Approvals', 'Signed in as ' + who.name + (iAmEligible() ? ' · eligible second approver' : ' · not an approver')));
    if (pending.length) {
      root.append(h('p', { class: 'small muted', text: pending.length + ' waiting. One decision per card; there is no Approve all.' }));
      pending.forEach((a) => root.append(requestCard(r, a)));
    } else {
      root.append(h('section', { class: 'card ph-empty', 'aria-label': 'Nothing waiting' },
        h('div', { class: 'ph-head' }, chip('clear', 'Clear'), h('h2', { class: 'grow', text: 'Nothing waiting for you' })),
        h('p', { class: 'practice-line muted', text: 'Approvals this week: 6, median 4 minutes (practice)' })));
    }
    if (decided.length) {
      root.append(h('section', { class: 'stack', 'aria-label': 'Decided' }, h('h2', { class: 'ph-h2', text: 'Decided' }), ...decided.slice().reverse().map(decidedCard)));
    }
    root.append(h('section', { class: 'card flat stack ph-sim', 'aria-label': 'Simulate a request' },
      h('h2', { class: 'ph-h2', text: 'Test the flow alone' }),
      h('p', { class: 'small muted', text: 'Plays the biller’s side of signature moment 2 so you can approve from here.' }),
      btn('Simulate: the biller requests the $410 courtesy write-off', { testid: 'phone.simulate', kind: 'reversible', class: 'ph-wrap', onClick: () => simulate(r) }),
      st.simNote ? h('p', { class: 'small', role: 'status', text: st.simNote }) : null));
    Proto.screens.shell.mount(root);
    attachKeys();
  }

  /* ---- keyboard: digits, Backspace, Enter drive the step-up pad while this screen is mounted ---- */
  function onKey(ev) {
    if (Proto.router.current().route !== 'phone') { detachKeys(); if (pad) pad.close(); return; }
    if (!pad) return;
    const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (/^[0-9]$/.test(ev.key)) { ev.preventDefault(); pad.add(ev.key); }
    else if (ev.key === 'Backspace') { ev.preventDefault(); pad.back(); }
    else if (ev.key === 'Enter' && !(t && t.tagName === 'BUTTON' && t.getAttribute('data-testid') !== 'phone.stepup.submit')) { ev.preventDefault(); pad.submit(); }
  }
  function attachKeys() { if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; } }
  function detachKeys() { if (keysOn) { document.removeEventListener('keydown', onKey); keysOn = false; } }
  window.addEventListener('hashchange', () => { if (Proto.router.current().route !== 'phone') { detachKeys(); if (pad) pad.close(); } });

  Proto.screens.phone = { render, simulate, approve: onApprove, decline: onDecline, state: () => st };
  Proto.router.on('phone', (r) => Proto.screens.phone.render(r));
})();
