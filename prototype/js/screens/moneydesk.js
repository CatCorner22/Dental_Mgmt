/* Money Desk (flow 5; biller home). Seven worklists as tabs with counts. ERA: matched lines already
   posted, Post matched → delta readback (Confirm / Hold / Dispute), batch complete line. Denials: plain
   CARC, deterministic next action, appeal packet built from the record, patient sentence, denial
   suppression gate on Bill patient. Aging 14/30/60+, statements that hold for a reason, credits,
   variances I own, approvals. Write-off with dual release (held, never silently allowed).
   Route: money. Features 13, 14, 16, 23, 24, 25. Keys while mounted: P, W, A. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, section, pageHead, displayName, shortDate } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TABS = [['era', 'ERA'], ['aging', 'Aging'], ['denials', 'Denials'], ['statements', 'Statements'], ['credits', 'Credits'], ['variances', 'Variances'], ['approvals', 'Approvals']];
  const CARC = { 45: 'contract underpayment', 131: 'downcoded to D2391', 16: 'claim lacks information', 197: 'no pre-authorization' };
  const REASONS = [['courtesy', 'Courtesy'], ['hardship', 'Hardship'], ['prior_period', 'Prior period']];
  const AGING_ACTION = { call: 'Call payer', attach: 'Attach and resubmit', escalate: 'Escalate' };
  const WRITEOFF_PID = 'p-306';

  /* View state is the person's, not the workstation's: one biller's open write-off form and selected tab used to
     follow the next persona onto their own Money Desk. Keyed by user id, like the Ledger's ledState; cleared on reset. */
  const views = {};
  let lastRoute = null; let lastStore = null; let keysOn = false;
  let st = null; // the current user's view, set by render()
  const fresh = () => ({ tab: 'era', pin: '', writeoffOpen: false, writeoffStr: '', writeoffReason: null, woRefusal: null, woHeldReq: null, woPosted: false, appealFor: null, appealPacket: null, appealSent: null, denialRefusal: {}, sendGate: null, eraGate: null, lineGate: {}, stmtGate: {}, previewFor: null, announced: '' });
  const viewFor = () => { const k = Proto.store.currentUser().id; return (views[k] = views[k] || fresh()); }

  const priv = () => !!(window.__proto && window.__proto.privacy);
  const pname = (S, pid) => { const p = S.patients.find((x) => x.id === pid); return displayName(p ? p.name : pid, priv()); };
  const cdtName = (S, code) => (S.cdt[code] || [code.toUpperCase()])[0];
  const cdtLine = (S, code, tooth) => code.toUpperCase() + ' ' + cdtName(S, code) + (tooth ? ' · #' + tooth : '');
  /* A typed amount is read as typed or not at all: stripping every character but digits and '.' turned
     '-50' into a $50 write-off and '1e3' into $13. Anything that is not a plain positive decimal is NaN,
     which the blur hint flags and Post refuses. */
  const cents = (s) => { const t = String(s == null ? '' : s).trim().replace(/[$,\s]/g, ''); return /^\d+(?:\.\d+)?$/.test(t) ? Math.round(Number(t) * 100) : NaN; };
  const pressed = (b) => (b ? 'true' : 'false');
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
  const say = (text) => { st.announced = text; Proto.router.announce(text); };
  const shared = () => !!(window.__proto && window.__proto.device === 'shared');
  /* Every posting verb carries the PIN the shared desk asks for; the store decides whether it is needed. A posting spends
     it (the PIN names the poster of that posting, not of whoever is at the desk next), and a second wrong PIN is marked
     fresh so the gate it redraws is logged as the second refusal it is (ui.js refusal `fresh`). */
  const post = (fn, ...args) => { const res = fn(...args, { pin: st.pin || null }); if (res.ok || res.held) st.pin = ''; else if (/^pin_(no_match|locked)$/.test(res.code)) res.fresh = true; return res; };
  const focusEl = (sel) => { const el = document.querySelector(sel[0] === '#' ? sel : '[data-testid="' + sel + '"]'); if (el && el.focus) el.focus(); return !!el; };
  const focusPin = () => { if (focusEl('money.pin')) { const el = document.activeElement; el.setSelectionRange(el.value.length, el.value.length); } };
  const removeWriteoff = (r) => { st.writeoffOpen = false; st.writeoffStr = ''; st.writeoffReason = null; st.woRefusal = null; rerender(r, 'money.writeoff.' + WRITEOFF_PID); };
  /* A store refusal is rendered as the shared gate beside the control that raised it (verb, one control, Why), and every
     control word the store can hand this screen does the thing it says: the Andon's support line for an outage, the PIN
     field for a PIN (Close empties it and drops the lock gate), Set aside holds the line, Go to amount lands on the field,
     Open the claim lands on the claim's row, the account's ledger for a correction; otherwise the tab stays and the keyboard
     lands on the row that asked (o.focus). Every unmapped word used to fall to the ERA tab. */
  function gate(r, res, pid, o) {
    o = o || {}; const word = res.control || '';
    const onControl = res.code === 'outage' ? () => { if (!focusEl('andon.control')) Proto.ui.support(); }
      : res.code === 'pin_locked' ? () => { st.pin = ''; dropPinGates(); rerender(r, 'money.pin'); }
      : /^pin_/.test(res.code) ? focusPin
      : word === 'Set aside' && o.lineId ? () => handleLine(r, Proto.store.eraHold, o.lineId, 'Set aside')
      : word === 'Go to amount' ? () => focusEl('money.writeoff.amount')
      : word === 'Remove the write-off' ? () => removeWriteoff(r)
      : word === 'Open the claim' && o.claimId ? () => { st.tab = denials(Proto.store.get()).some((c) => c.id === o.claimId) ? 'denials' : 'aging'; rerender(r, '#md-claim-' + o.claimId); }
      : word === 'Go to the deltas' ? () => { st.tab = 'era'; rerender(r, '#md-readback'); }
      // The entitlement words act as on Checkout: the seat that issues a pass, or the pad that names another author.
      : word === 'Open Roles' ? () => { location.hash = '#/owner/roles'; }
      : word === 'Switch author' ? () => Proto.screens.shell.openPinPad(r)
      : word === 'Open the day' ? () => Proto.router.go(r.persona, 'close')
      : pid && /ledger/i.test(word) ? () => Proto.router.go(r.persona, 'ledger', pid)
      : () => rerender(r, o.focus || 'money.tab.' + st.tab);
    const v = { code: res.code, verb: res.verb, control: word || 'Back to the worklist', why: res.why, severity: res.code === 'outage' ? 'stop' : undefined, fresh: !!res.fresh, onControl };
    res.fresh = false;                                     // the first draw after the press logs it; a redraw does not
    return refusal(v);
  }
  /* A gate whose cause is gone falls on the next render: the outage ended, the desk is no longer shared, business hours
     began. The pressed Held primary re-asks the store either way. */
  const outageOver = (g) => {
    const code = g && ((g.dataset || g).code || ''); const S = Proto.store.get();
    const ctl = g ? g.control || ((g.querySelector && g.querySelector('[data-testid="refusal.control"]')) || {}).textContent || '' : '';
    return code === 'outage' ? !S.outage : /^pin_/.test(code) ? !shared() : code === 'after_hours' ? !S.clock.afterHours : code === 'entitlement' && ctl === 'Open Roles' ? !Proto.store.currentUser().noPass : false;
  };
  // Typing a PIN dissolves the gates that asked for one, as typing an amount does; the primaries are live again.
  const isPinGate = (g) => !!g && /^pin_/.test((g.dataset || g).code || '');
  function dropPinGates() {
    let n = 0;
    for (const k of ['eraGate', 'sendGate', 'woRefusal']) if (isPinGate(st[k])) { st[k] = null; n++; }
    for (const k of ['lineGate', 'stmtGate', 'denialRefusal']) for (const id of Object.keys(st[k])) if (isPinGate(st[k][id])) { delete st[k][id]; n++; }
    return n;
  }
  /* Shared desk: the PIN that names the poster, once per desk, beside the worklists every posting verb lives in. */
  function pinField(r) {
    if (!shared()) return null;
    const pin = h('input', { class: 'input co-pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', id: 'md-pin', testid: 'money.pin', value: st.pin, onInput: (ev) => { st.pin = ev.target.value; if (dropPinGates()) { rerender(r); focusPin(); } } });
    return h('div', { class: 'field md-pin' }, h('label', { for: 'md-pin', text: 'Your PIN' }), pin, h('p', { class: 'hint', text: 'Shared desk: the PIN makes you the frozen poster for every posting here.' }));
  }

  function rerender(r, focusTestid) {
    r = r || lastRoute || Proto.router.current();
    render(r);
    Proto.screens.shell.refreshAndon(r);
    if (focusTestid) focusEl(focusTestid);              // a test id, or '#id' for a stamp that is not a control
  }
  // A decided row's stamp or a row group: where the keyboard lands after a primary fires, so a repeated Enter fires nothing.
  const landing = (el, id) => { el.id = id; el.tabIndex = -1; return el; };

  /* ---- data views ---- */
  function eraView(S) {
    // No batch on file reads as an empty, posted batch rather than a TypeError on the ERA tab.
    const b = S.eraBatches[0] || { id: null, payer: '—', lines: 0, postedLines: 0, eftCents: 0, trn: 'no ERA received', status: 'posted' };
    const lines = S.eraLines.filter((l) => l.batchId === b.id);
    const by = (s) => lines.filter((l) => l.status === s);
    /* A line is matched until Post matched writes its ledger row and the store flips it to posted, so the status is the
       fact. The read-back is every line the payer paid differently (a CARC), decided or not, so a decided row keeps its
       place below the ones still waiting. */
    // A held line is set aside, not decided: its money is off the ledger until Confirm or Dispute, so it is still open.
    return { b, lines, deltas: by('delta'), matched: by('matched'), posted: by('posted'), held: by('held'), disputed: by('disputed'), denied: by('denied'), open: lines.filter((l) => l.status === 'delta' || l.status === 'held'), readback: lines.filter((l) => l.carc && l.status !== 'denied') };
  }
  const denials = (S) => S.claims.filter((c) => c.status === 'denied' || c.status === 'appealed');
  const aging = (S) => S.claims.filter((c) => c.status === 'submitted' || c.status === 'pended');
  /* A statement bills the live balance (store.sendStatement), so the row prints it and a row whose balance has since
     settled leaves the worklist; a sent row stays, carrying its confirmation and the amount it froze. */
  const due = (s) => Proto.store.balances(s.patientId).patientDue;
  /* A statement queued at the window on a visit whose note is unfiled waits for the note: its charges are not on the ledger
     yet, so the live balance reads $0 while the row is real. It was on no tab and off the badge until the dentist filed. */
  const waitingEnc = (S, s) => { if (s.sent || due(s) > 0) return null; const a = S.appointments.find((x) => x.patientId === s.patientId && x.status === 'checked_out_unfiled'); return a ? a.encounterId : null; };
  const statements = (S) => S.statementsDue.filter((s) => s.sent || due(s) > 0 || waitingEnc(S, s));
  /* An account has a statement while a row is open or one went out today for the balance as it still is: the store owns that
     rule (openStatement, the row raiseStatement returns or refuses on); until it lands, a row sent today stands in. */
  const hasStatement = (S, rows, pid) => (Proto.store.openStatement ? !!Proto.store.openStatement(pid) : rows.some((s) => s.patientId === pid && (!s.sent || (s.sentOn || S.tenant.today) === S.tenant.today)));
  // A decided approval prints what posted (the store settles min(amount, due)), never the figure that was asked for.
  const postedCents = (a) => (a.postedCents != null ? a.postedCents : a.amountCents);
  /* Credits are what the ledger says: every account whose rows net to money on hand, with the visit a payment is waiting to
     land on. The tab listed the S.credits rows, so an over-payment at the window was missing and an applied credit stayed
     listed, and counted, after the note filed. */
  function creditRows(S) {
    return S.patients.map((p) => ({ pid: p.id, cents: Proto.store.balances(p.id).credit })).filter((x) => x.cents > 0).map((x) => {
      const intent = S.allocationIntents.find((i) => !i.appliedTo && (S.encounters.find((e) => e.id === i.encounterId) || {}).patientId === x.pid);
      const cr = S.credits.find((c) => c.patientId === x.pid && !c.applied);
      return Object.assign(x, { id: cr ? cr.id : x.pid, encId: intent ? intent.encounterId : null, reason: cr ? cr.reason : 'Payments on the ledger exceed its charges' });
    });
  }
  const myVariances = (S) => { const u = Proto.store.currentUser(); return S.variances.filter((v) => v.status === 'open').filter((v) => { const rr = S.reconciliation.find((x) => x.id === v.reconciliationId); return rr && (rr.closer === u.name || u.role === 'biller' || u.role === 'owner' || u.role === 'office_manager'); }); };
  /* One meaning for every badge: rows still open on that tab. A finished row stays on its tab carrying its
     confirmation, but it is no longer counted — Statements read 2 and Denials 1 with nothing left to do. Approvals
     counts the Waiting rows the tab lists (the biller's badge read 0 over her own Waiting request); the Andon and
     the phone count what is mine to decide, which is a different question. */
  function counts(S) {
    const e = eraView(S);
    return { era: e.b.status === 'review' ? 1 : e.open.length, aging: aging(S).length, denials: denials(S).filter((c) => c.status === 'denied').length, statements: statements(S).filter((s) => !s.sent).length, credits: creditRows(S).length, variances: myVariances(S).length, approvals: S.approvals.filter((a) => a.status === 'pending').length };
  }

  /* ---- tabs ---- */
  function tabs(r, S) {
    const c = counts(S);
    return h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Worklists' }, ...TABS.map(([code, label]) => {
      const b = btn([label, h('span', { class: 'count', 'aria-label': plural(c[code], 'item'), text: String(c[code]) })], { testid: 'money.tab.' + code, onClick: () => { st.tab = code; rerender(r, 'money.tab.' + code); } });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', pressed(st.tab === code)); return b;
    }));
  }

  /* ---- ERA tab ---- */
  function postMatched(r) {
    const res = post(Proto.store.eraPostMatched, 'era-1');
    // One verb line, no storage id: an announcement is read aloud, not skimmed.
    if (res.ok) { st.eraGate = null; say(res.readback.length ? 'Read back ' + plural(res.readback.length, 'line') + ' that differ' : 'Posted the batch'); }
    else { st.eraGate = res; rerender(r, 'refusal.control'); return; }
    // The keyboard lands on the read-back heading, never on the first Confirm: a repeated Enter must not post a line.
    rerender(r, res.readback && res.readback.length ? '#md-readback' : 'money.tab.era');
  }
  function handleLine(r, fn, lineId, word) {
    const res = post(fn, lineId);
    if (!res.ok) { st.lineGate[lineId] = res; rerender(r, 'refusal.control'); return; }
    delete st.lineGate[lineId];
    const S = Proto.store.get(); const left = eraView(S).open;
    say(word + ' line ' + lineId.replace('el-', '') + (left.length ? ' — ' + plural(left.length, 'line') + ' left' : ' — batch complete'));
    if (!left.length) st.tab = 'denials';                       // the batch is done: go where the work went
    // Focus lands on the decided row's stamp, not the next line's Confirm: one Enter decides one line.
    rerender(r, left.length ? '#md-line-' + lineId : 'money.tab.denials');
  }
  function eraTab(r, S) {
    const e = eraView(S); const b = e.b; const review = b.status === 'review';
    if (outageOver(st.eraGate)) st.eraGate = null;
    const head = h('p', { class: 'md-batchline', text: 'Delta 835 · ' + plural(b.lines, 'line') + ' · ' + (review ? e.matched.length + ' matched, ready to post' : e.posted.length + ' posted') + ' · EFT ' + money(b.eftCents) + ' · ' + b.trn + ' · matched to bank line' });
    const status = h('div', { class: 'row' }, review ? chip('info', e.matched.length + ' matched') : chip('clear', e.posted.length + ' posted'), e.deltas.length ? chip('review', plural(e.deltas.length, 'delta')) : null, e.held.length ? chip('info', e.held.length + ' set aside') : null, e.disputed.length ? chip('style', e.disputed.length + ' disputed') : null, e.denied.length ? chip('required', plural(e.denied.length, 'denial')) : null);
    const card = h('section', { class: 'card stack md-batch', 'aria-label': 'ERA batch era-1' }, h('h2', { text: 'Delta Dental 835 · era-1' }), head, status);
    if (review) {
      const g = st.eraGate;
      card.append(h('div', { class: 'btnrow' }, btn('Post matched', { kind: g ? 'held' : 'irreversible', testid: 'money.era.era-1.postmatched', ariaLabel: g ? 'Post matched is held: ' + g.verb : 'Post matched lines (P)', onClick: () => postMatched(r) }), h('span', { class: 'small muted', text: 'Posts the ' + e.matched.length + ' matched lines; only lines that differ from the claim will ask you.' })),
        ...(g ? [gate(r, g)] : []),
        h('details', { class: 'md-details' }, h('summary', { text: 'Why are ' + e.matched.length + ' already matched?', testid: 'money.era.' + b.id + '.why' }), h('p', { class: 'muted', text: 'The worker matched every clean line to its claim and fee-schedule row before you opened the batch; nothing is on the ledger until you post. Post matched writes each insurance payment and computed contractual write-off linked to its 835 segment, claim line, and fee-schedule row; "Why did this post?" on any ledger row shows the four-line trace.' })));
      return card;
    }
    /* Decided rows stay where they were: removing a confirmed row moved the next line's Confirm under the pointer, so a
       double-click posted two lines. The list is the read-back record until the batch is done, and after. */
    const rows = h('div', { class: 'worklist' }, ...e.readback.map((l) => deltaRow(r, S, l)));
    if (e.open.length) { card.append(landing(h('h3', { text: 'Read back: ' + plural(e.open.length, 'line') + ' differ from the claim' + (e.held.length ? ' (' + e.held.length + ' set aside)' : '') }), 'md-readback'), rows); return card; }
    const parts = [e.posted.length + ' posted']; if (e.held.length) parts.push(e.held.length + ' set aside'); if (e.disputed.length) parts.push(e.disputed.length + ' disputed'); parts.push(plural(e.denied.length, 'denial') + ' moved to Denials');
    card.append(h('div', { class: 'row md-complete' }, chip('clear', 'Batch complete'), h('span', { text: 'Batch complete: ' + parts.join(', ') })), h('p', { class: 'small muted', text: 'The denied line is on the Denials tab with its plain reason and next action.' }), rows);
    return card;
  }
  const DECIDED = { posted: ['clear', 'Confirmed'], held: ['info', 'Set aside'], disputed: ['style', 'Disputed'] };
  function deltaRow(r, S, l) {
    const carc = CARC[l.carc] || 'payer reason ' + l.carc;
    const isVariance = l.carc === '45'; const n = l.id.replace('el-', '');
    if (outageOver(st.lineGate[l.id])) delete st.lineGate[l.id];
    const g = st.lineGate[l.id]; const done = DECIDED[l.status]; const held = l.status === 'held';
    // The disputed row reads the appeal row the store wrote, not a promise of one.
    const packet = l.status === 'disputed' ? S.appealPackets.find((p) => p.eraLineId === l.id) : null;
    // A set-aside line keeps Confirm and Dispute: it is still to be decided, and the batch waits for it.
    const verbs = !done || held ? [
      btn('Confirm · post ' + money(l.paidCents) + ', write-off ' + money(l.expectedCents - l.paidCents), { kind: g ? 'held' : 'irreversible', testid: 'money.era.line.' + l.id + '.confirm', ariaLabel: g ? 'Confirm line ' + n + ' is held: ' + g.verb : 'Confirm line ' + n + ': post ' + money(l.paidCents) + ' and a contractual write-off of ' + money(l.expectedCents - l.paidCents), onClick: () => handleLine(r, Proto.store.eraConfirm, l.id, 'Confirmed') }),
      // "Held" is the gated primary's identity (CONTRACTS §6); an ERA line that waits for a look is set aside.
      held ? null : btn('Set aside', { kind: 'reversible', testid: 'money.era.line.' + l.id + '.hold', ariaLabel: 'Set aside line ' + n + ' until you look at the note', onClick: () => handleLine(r, Proto.store.eraHold, l.id, 'Set aside') }),
      btn(isVariance ? 'Dispute contract variance' : 'Dispute', { kind: 'reversible', testid: 'money.era.line.' + l.id + '.dispute', onClick: () => handleLine(r, Proto.store.eraDispute, l.id, 'Disputed') })] : [];
    return h('div', { class: 'md-row' + (done && !held ? ' decided' : ''), role: 'group', 'aria-label': 'Line ' + n },
      h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, l.patientId) }), h('span', { class: 'muted', text: 'Line ' + n + ' · ' + cdtLine(S, l.cdt, l.tooth) }), chip(isVariance ? 'review' : 'style', isVariance ? 'Contract variance' : 'Downcoded')),
      h('p', { class: 'md-delta', text: 'expected ' + money(l.expectedCents) + ', ERA says ' + money(l.paidCents) + ' · CARC ' + l.carc + ' (' + carc + ')' }),
      h('div', { class: 'btnrow' },
        done ? [landing(chip(done[0], done[1]), 'md-line-' + l.id), h('span', { class: 'small muted', text: l.status === 'posted' ? 'Posted ' + money(l.paidCents) + ' and a contractual write-off of ' + money(l.expectedCents - l.paidCents) + '; on the ledger.' : held ? 'Out of the ledger until you look at the note; the batch waits for it.' : packet ? 'Appeal row written: ' + packet.citation + '.' : 'Disputed; no appeal row on record.' })] : null,
        ...verbs),
      g && verbs.length ? gate(r, g, l.patientId, { lineId: l.id }) : null,
      h('details', { class: 'md-details' }, h('summary', { text: 'Why', testid: 'money.era.line.' + l.id + '.why' }), h('p', { class: 'muted', text: isVariance ? 'Paid ' + money(l.paidCents) + '; the Delta PPO fee schedule allows ' + money(l.expectedCents) + ' for ' + l.cdt.toUpperCase() + '. Dispute creates an appeal row citing the fee-schedule line. Confirm accepts it as contractual and posts the write-off with the frozen delta.' : 'The payer paid a different code than was billed. Confirm posts what was paid and the difference as contractual; Set aside keeps the line out of the ledger until you look at the note.' })));
  }

  /* ---- Open balances / write-off ---- */
  function writeoffCard(r, S) {
    const bal = Proto.store.balances(WRITEOFF_PID);
    const row = h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, WRITEOFF_PID) }), h('span', { class: 'amt', text: money(bal.patientDue) + ' open' }), h('span', { class: 'muted', text: 'Crown #19 · MetLife paid; ' + (bal.patientDue > 0 ? 'patient portion outstanding since 9/1' : 'patient portion settled') }));
    if (st.woHeldReq) st.woHeldReq = S.approvals.find((x) => x.id === st.woHeldReq.id) || st.woHeldReq;
    const card = section('Open balances', row);
    if (st.woPosted) { card.append(h('div', { class: 'row' }, landing(chip('clear', 'Write-off posted'), 'md-wo-posted'), h('span', { class: 'muted', text: 'On the ledger with its reason code.' }))); return card; }
    if (st.woHeldReq && st.woHeldReq.status === 'approved') { card.append(h('div', { class: 'row' }, chip('clear', 'Write-off ' + money(postedCents(st.woHeldReq)) + ' approved by ' + st.woHeldReq.decidedBy), h('span', { class: 'muted', text: 'Posted to the ledger by the approval.' }))); return card; }
    // A request that came back says so here, in the approver's words: the card used to fall through to a plain
    // Post with nothing to show that the phone had already answered, and the needs_second gate that had held the
    // first Post stayed on screen with nothing left to hold.
    if (st.woHeldReq && (st.woHeldReq.status === 'declined' || st.woHeldReq.status === 'sent_back')) {
      const line = st.woHeldReq.decisionReason;
      if (st.woRefusal && st.woRefusal.dataset.code === 'needs_second') st.woRefusal = null;
      card.append(h('div', { class: 'row' }, chip('required', 'Sent back'), h('span', { class: 'muted' }, 'Sent back by ' + st.woHeldReq.decidedBy + (line ? ': ' : ' · no line given · '), line ? h('q', { class: 'md-line', text: line }) : null, (line ? ' · ' : '') + 'nothing posted. Post requests it again.')));
    }
    if (!st.writeoffOpen) { card.append(h('div', { class: 'btnrow' }, btn('Write-off or adjustment', { kind: 'reversible', testid: 'money.writeoff.' + WRITEOFF_PID, ariaLabel: 'Write-off or adjustment for ' + pname(S, WRITEOFF_PID) + ' (W)', onClick: () => openWriteoff(r) }))); return card; }
    const amt = h('input', { class: 'input md-amount', type: 'text', inputmode: 'decimal', testid: 'money.writeoff.amount', value: st.writeoffStr, 'aria-label': 'Write-off amount in dollars', onInput: (ev) => { st.writeoffStr = ev.target.value; } });
    const hint = h('p', { class: 'hint', text: 'At or above ' + money(S.tenant.dualReleaseThresholdCents) + ' a second approver is needed; the posting is held, never silently allowed.' });
    // Keep the hint copy fixed: swapping it on blur used to move Post under the pointer so the press never landed.
    amt.addEventListener('blur', () => { const bad = st.writeoffStr.trim() !== '' && !(cents(st.writeoffStr) > 0); amt.classList.toggle('invalid', bad); });
    const reasons = h('div', { class: 'btnrow', role: 'group', 'aria-label': 'Reason code' }, ...REASONS.map(([code, label]) => btn(label, { testid: 'money.writeoff.reason.' + code, pressed: pressed(st.writeoffReason === code), onClick: () => { st.writeoffReason = code; st.woRefusal = null; rerender(r, 'money.writeoff.reason.' + code); } })));
    const held = st.woHeldReq && st.woHeldReq.status === 'pending';
    // The eligible approvers are one list, the one the request was written with; the biller is not told a
    // different set of names from the one the phone card and the verb line read.
    const approvers = held ? (st.woHeldReq.eligible || []).join(' or ') : '';
    if (outageOver(st.woRefusal && st.woRefusal.dataset)) st.woRefusal = null;
    const post = held
      ? btn('Held', { kind: 'held', testid: 'money.writeoff.post', ariaLabel: 'Held: waiting on a second approver', onClick: () => say('Waiting on ' + approvers) })
      : btn('Post', { kind: st.woRefusal ? 'held' : 'irreversible', testid: 'money.writeoff.post', ariaLabel: st.woRefusal ? 'Post is held: ' + st.woRefusal.querySelector('.verb').textContent : null, onClick: () => postWriteoff(r) });
    const postRow = h('div', { class: 'btnrow' }, post, held ? h('span', { class: 'row' }, chip('review', 'Approval requested'), h('span', { class: 'small muted', text: approvers + ' will see it on their phone; this flips to Posted when they approve.' })) : null);
    // The gate stays on screen while the request is open: the refusal is the only thing that says what is
    // holding the posting and where to go next, and nulling it here left the Held button with no verb line.
    if (held) setTimeout(() => { if (Proto.router.current().raw !== r.raw) return; const el = document.querySelector('[data-testid="money.writeoff.post"]'); if (el) { const b = el.getBoundingClientRect(); if (b.bottom > window.innerHeight || b.top < 0) el.scrollIntoView({ block: 'center' }); } }, 0);
    // h() skips a null child; Element.append stringifies one, which put the word "null" on the card twice.
    const tail = [h('div', { class: 'md-two' }, h('div', { class: 'field' }, h('label', { for: 'md-wo-amt', text: 'Write-off amount' }), amt, hint), h('div', { class: 'field' }, h('label', { text: 'Reason code' }), reasons)), st.woRefusal, postRow, held ? h('p', { class: 'small muted', text: 'Approvals here usually take about 4 minutes (practice-level, last 30 days).' }) : null];
    card.append(...tail.filter(Boolean));
    amt.id = 'md-wo-amt';
    return card;
  }
  function openWriteoff(r) {
    const bal = Proto.store.balances(WRITEOFF_PID);
    st.writeoffOpen = true; st.writeoffStr = (bal.patientDue / 100).toFixed(2); st.woRefusal = null;
    rerender(r, 'money.writeoff.amount');
  }
  function postWriteoff(r) {
    const amountCents = cents(st.writeoffStr);
    if (!(amountCents > 0)) { st.woRefusal = refusal({ code: 'amount_required', verb: 'Enter an amount above zero', control: 'Fix amount', why: 'A write-off needs a dollar amount; the balance is prefilled.', onControl: () => { st.woRefusal = null; rerender(r, 'money.writeoff.amount'); } }); rerender(r, 'refusal.control'); return; }
    if (!st.writeoffReason) { st.woRefusal = refusal({ code: 'reason_required', verb: 'Choose a reason code', control: 'Courtesy', why: 'Every write-off carries a reason code so the ledger sentence and the reason digest can explain it.', onControl: () => { st.writeoffReason = 'courtesy'; st.woRefusal = null; rerender(r, 'money.writeoff.post'); } }); rerender(r, 'refusal.control'); return; }
    const res = post(Proto.store.requestWriteoff, WRITEOFF_PID, amountCents, st.writeoffReason);
    if (res.ok) { st.woPosted = true; st.woRefusal = null; say('Posted the ' + money(amountCents) + ' write-off'); rerender(r, '#md-wo-posted'); return; }
    if (res.held) {
      const S = Proto.store.get(); st.woHeldReq = S.approvals.find((x) => x.id === res.requestId) || null;
      // The store wrote the request at Post (the Held button and its chip say so), so a control reading
      // "Request approval" would promise a write that had already happened and then do nothing. The next
      // step for the biller is to see the request where it waits: the Approvals tab.
      st.woRefusal = refusal({ code: res.code, verb: res.verb, control: 'Open approvals', why: res.why, onControl: () => { st.tab = 'approvals'; rerender(r, 'money.tab.approvals'); } });
      rerender(r, 'refusal.control'); return;
    }
    st.woRefusal = gate(r, res, WRITEOFF_PID);
    rerender(r, 'refusal.control');
  }

  /* ---- Denials tab ---- */
  /* A row action that changes a claim (a claimEvents row, a new next action) is a store verb; the screen renders the
     store's answer and the row redraws with the claim's new state. */
  function claimAct(r, S, c, action) {
    const res = post(Proto.store.claimAction, c.id, action);
    if (!res.ok) { st.denialRefusal[c.id] = gate(r, res, c.patientId, { claimId: c.id, focus: '#md-claim-' + c.id }); rerender(r, 'refusal.control'); return; }
    delete st.denialRefusal[c.id];
    // A fixed or re-attached claim goes back to the payer, so its row moves to Aging (Resubmitted); the keyboard follows it.
    const S2 = Proto.store.get(); if (aging(S2).some((x) => x.id === c.id)) st.tab = 'aging';
    say('Recorded on claim ' + c.id.replace('c-', '')); rerender(r, '#md-claim-' + c.id);
  }
  function openAppeal(r, claimId) {
    const res = Proto.store.buildAppeal(claimId);
    if (!res.ok) { say(res.verb); return; }
    st.appealFor = claimId; st.appealPacket = res.packet; st.denialRefusal[claimId] = null;
    say('Built the appeal packet from the record');
    // The drawer opens on its heading, never on Send: a repeated Enter on Appeal must not mail the packet.
    rerender(r, '#md-appeal-head');
  }
  function denialsTab(r, S) {
    const rows = denials(S);
    if (!rows.length) return section('Denials', h('div', { class: 'row' }, chip('clear', 'No open denials'), h('span', { class: 'muted', text: st.appealSent ? 'Appeal for ' + st.appealSent + ' sent · disclosure recorded.' : 'Denied lines from an ERA land here with a plain reason and one next action.' })));
    return section('Denials', h('div', { class: 'worklist' }, ...rows.map((c) => denialRow(r, S, c))));
  }
  // The done-word names its object once, the way a sent statement does.
  const sentLine = () => h('div', { class: 'row' }, chip('clear', 'Appeal sent'), h('span', { text: 'Disclosure recorded (clearinghouse, payment purpose, artifact hashes).' }));
  function denialRow(r, S, c) {
    if (outageOver(st.denialRefusal[c.id] && st.denialRefusal[c.id].dataset)) delete st.denialRefusal[c.id];
    const row = landing(h('div', { class: 'md-row', role: 'group', 'aria-label': 'Denied claim ' + c.id },
      h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, c.patientId) }), h('span', { class: 'amt', text: money(c.amountCents) }), h('span', { class: 'muted', text: c.id + ' · ' + cdtLine(S, c.cdt, c.tooth) + ' · ' + c.payer }), chip('review', 'Appeal by ' + shortDate(c.appealBy))),
      h('p', { class: 'md-plain', text: c.plain }),
      h('p', { class: 'md-next' }, h('b', { text: 'Next: ' }), c.nextAction),
      h('div', { class: 'btnrow' },
        btn('Appeal', { kind: 'reversible', testid: 'money.denial.' + c.id + '.appeal', ariaLabel: 'Appeal claim ' + c.id + ' with a packet built from the record (A)', onClick: () => openAppeal(r, c.id) }),
        btn('Fix', { kind: 'quiet', testid: 'money.denial.' + c.id + '.fix', ariaLabel: 'Fix claim ' + c.id + ': correct and resubmit it', onClick: () => claimAct(r, S, c, 'fix') }),
        btn('Bill patient', { kind: 'quiet', testid: 'money.denial.' + c.id + '.bill', onClick: () => {
          // The gate names the record's state: "no appeal" is false once the appeal has gone.
          st.denialRefusal[c.id] = c.status === 'appealed'
            ? refusal({ code: 'denial_suppression', verb: 'Wait for the payer — appeal in review', control: 'Open the ledger', why: 'The appeal for this claim was sent and ' + c.payer + ' has not answered. A patient bill on a denial under appeal routes through dual release at any amount; the ledger shows what the account owes meanwhile.', onControl: () => Proto.router.go(r.persona, 'ledger', c.patientId) })
            : refusal({ code: 'denial_suppression', verb: 'Appeal first — denial with no appeal', control: 'Build appeal', why: 'A write-off or patient bill after a denial with no appeal routes through dual release at any amount and cannot be posted by the claim\'s submitter.', onControl: () => openAppeal(r, c.id) });
          rerender(r, 'refusal.control');
        } })),
      st.denialRefusal[c.id] || null,
      st.appealSent === c.id ? sentLine() : null,
      h('details', { class: 'md-details' }, h('summary', { text: 'Why this code', testid: 'money.denial.' + c.id + '.why' }), h('p', { class: 'muted', text: 'CARC ' + c.carc + (c.rarc ? ' / RARC ' + c.rarc : '') + ' · ' + (CARC[c.carc] || 'payer reason') + '. Translated once by the versioned CARC dictionary with the ' + c.payer + ' overlay; the action is chosen by the table, not decoded by hand. Bill patient is offered only for PR group codes.' }))), 'md-claim-' + c.id);
    if (st.appealFor === c.id && st.appealPacket) row.append(appealDrawer(r, S, c));
    return row;
  }
  function appealDrawer(r, S, c) {
    const pk = st.appealPacket; const slots = [['perioChart', 'Perio chart', 'six-point exam, 7/1/2025, 4 sites ≥ 5 mm in the quadrant'], ['narrative', 'Narrative from the note', 'filed-note excerpt for the periodontal module, quoted verbatim'], ['radiograph', 'Radiograph', 'bitewings with interpretation, from the encounter'], ['letter', 'Letter', 'restates CARC ' + c.carc + ' and cites the fee-schedule line']];
    const list = h('ul', { class: 'md-slots' }, ...slots.map(([k, label, detail]) => h('li', { class: 'row' }, chip(pk.slots[k] ? 'clear' : 'required', pk.slots[k] ? 'Clear' : 'Required'), h('span', null, h('b', { text: label }), h('span', { class: 'muted', text: ' · ' + (pk.slots[k] ? detail : 'not on the record; add before sending') })))));
    const missing = slots.filter(([k]) => !pk.slots[k]).length;
    const drawer = h('div', { class: 'md-drawer stack', role: 'region', 'aria-label': 'Appeal packet for claim ' + c.id },
      h('div', { class: 'row drawer-head' }, landing(h('h3', { class: 'grow', text: 'Appeal packet · built from the record' }), 'md-appeal-head'), btn('Close', { kind: 'quiet', class: 'compact', testid: 'money.appeal.close', onClick: () => { st.appealFor = null; st.appealPacket = null; st.sendGate = null; rerender(r, 'money.denial.' + c.id + '.appeal'); } })),
      list,
      h('div', { class: 'md-sentence' }, h('span', { class: 'small muted', text: 'What the patient reads: ' }), h('span', { text: pk.patientSentence })));
    if (st.appealSent === c.id) { drawer.append(sentLine()); return drawer; }
    if (outageOver(st.sendGate && st.sendGate.dataset)) st.sendGate = null;
    const g = st.sendGate;
    drawer.append(...[g, h('div', { class: 'btnrow' }, btn('Send', { kind: g ? 'held' : 'irreversible', testid: 'money.appeal.send', ariaLabel: g ? 'Send is held: ' + g.querySelector('.verb').textContent : 'Send appeal for claim ' + c.id, onClick: () => {
      if (missing) { st.sendGate = refusal({ code: 'packet_incomplete', verb: 'Add the required slot before sending', control: 'Show slots', why: 'An appeal that cites prose loses; every slot is a frozen record artifact.', onControl: () => { st.sendGate = null; rerender(r, 'money.appeal.send'); } }); rerender(r, 'refusal.control'); return; }
      const res = post(Proto.store.sendAppeal, c.id);
      if (!res.ok) { st.sendGate = gate(r, res, c.patientId, { claimId: c.id, focus: 'money.appeal.close' }); rerender(r, 'refusal.control'); return; }
      st.sendGate = null;
      // The packet is gone; its confirmation stays on the row, the way a sent statement keeps its own.
      st.appealSent = c.id; st.appealFor = null; st.appealPacket = null;
      say('Sent the appeal — disclosure recorded'); rerender(r, '#md-claim-' + c.id);
    } }), h('span', { class: 'small muted', text: 'Irreversible: writes a disclosure row with artifact hashes.' }))].filter(Boolean));
    return drawer;
  }

  /* ---- Aging tab ---- */
  function agingAction(c) { if (c.status === 'pended') return 'attach'; if (c.age >= 60) return 'escalate'; return 'call'; }
  function agingTab(r, S) {
    // A corrected or re-attached claim (age 0 today) stays in view until the 277 arrives; the badge counts every row here.
    const rows = aging(S); const groups = [['0', 'Resubmitted · waiting for the 277', (c) => c.age < 14], ['14', '14+ days', (c) => c.age >= 14 && c.age < 30], ['30', '30+ days', (c) => c.age >= 30 && c.age < 60], ['60', '60+ days', (c) => c.age >= 60]];
    const out = section('Claims aging', h('p', { class: 'small muted', text: 'Submitted and pended claims by age with one next action each. Counts are by payer, never by person.' }));
    for (const [, label, f] of groups) {
      const g = rows.filter(f); if (!g.length) continue;
      // The row carries the claim's current next action and the gate its last press raised, so a refused action is not silent.
      out.append(h('h3', { text: label + ' · ' + g.length }), h('div', { class: 'worklist' }, ...g.map((c) => { const act = agingAction(c); if (outageOver(st.denialRefusal[c.id] && st.denialRefusal[c.id].dataset)) delete st.denialRefusal[c.id]; return landing(h('div', { class: 'stack' }, h('div', { class: 'wrow' }, h('span', { class: 'obj', text: pname(S, c.patientId) }), h('span', { class: 'amt', text: money(c.amountCents) }), h('span', { class: 'why', text: c.id + ' · ' + cdtLine(S, c.cdt, c.tooth) + ' · ' + c.payer + ' · ' + c.age + ' days · ' + c.nextAction }), btn(AGING_ACTION[act], { kind: 'reversible', testid: 'money.aging.row.' + c.id + '.' + act, onClick: () => claimAct(r, S, c, act) })), st.denialRefusal[c.id] || null), 'md-claim-' + c.id); })));
    }
    return out;
  }

  /* ---- Statements, credits, variances, approvals ---- */
  // A row raised from a balance is worded as what it is; only the window's rows were deferred.
  const RAISED = { window_deferred: (s) => 'deferred at the window ' + shortDate(s.created) + ' so insurance could settle first', balance_due: (s) => 'raised on the balance ' + shortDate(s.created) };
  function statementsTab(r, S) {
    const rows = statements(S);
    const out = section('Statements due');
    if (!rows.length) out.append(h('div', { class: 'row' }, chip('clear', 'Nothing due'), h('span', { class: 'muted', text: 'Statements sent today are disclosure rows on the ledger.' })));
    else out.append(h('div', { class: 'worklist' }, ...rows.map((s) => {
      if (outageOver(st.stmtGate[s.id])) delete st.stmtGate[s.id];
      const g = st.stmtGate[s.id]; const enc = waitingEnc(S, s);
      // The stamp is where the keyboard lands after Send or Raise; the row group is where a gate's control lands.
      const row = landing(h('div', { class: 'md-row' + (s.sent ? ' sent' : '') }, h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, s.patientId) }), h('span', { class: 'amt', text: money(s.sent || enc ? s.amountCents : due(s)) }), landing(chip(enc ? 'review' : 'info', enc ? 'Waiting for the note' : s.reason === 'balance_due' ? 'Raised' : 'Deferred'), 'md-sd-stamp-' + s.id), h('span', { class: 'muted', text: enc ? 'deferred at the window ' + shortDate(s.created) + ' · charges post when the note files' : (RAISED[s.reason] || RAISED.window_deferred)(s) })),
        s.sent
          ? h('div', { class: 'row' }, chip('clear', 'Statement sent'), h('span', { class: 'small muted', text: 'Sent to ' + pname(S, s.patientId) + ' · disclosure recorded · ' + shortDate(S.tenant.today) }))
          // Nothing to send until the charges exist: the one action opens the chart whose filed note releases them.
          : enc ? h('div', { class: 'btnrow' }, btn('Open the chart', { kind: 'reversible', testid: 'money.statement.' + s.id + '.chart', ariaLabel: 'Open the chart whose filed note releases the charges this statement bills', onClick: () => Proto.router.go(r.persona, 'encounter', enc) }))
          : h('div', { class: 'btnrow' }, btn('Send statement', { kind: g ? 'held' : 'irreversible', testid: 'money.statement.' + s.id + '.send', ariaLabel: g ? 'Send statement is held: ' + g.verb : null, onClick: () => { const res = post(Proto.store.sendStatement, s.id); if (!res.ok) { st.stmtGate[s.id] = res; rerender(r, 'refusal.control'); return; } delete st.stmtGate[s.id]; say('Sent the statement — disclosure recorded'); rerender(r, '#md-sd-stamp-' + s.id); } }), btn('Preview', { kind: 'reversible', testid: 'money.statement.' + s.id + '.preview', pressed: pressed(st.previewFor === s.id), onClick: () => { st.previewFor = st.previewFor === s.id ? null : s.id; rerender(r, 'money.statement.' + s.id + '.preview'); } })),
        g && !s.sent ? gate(r, g, s.patientId, { focus: '#md-sd-' + s.id }) : null), 'md-sd-' + s.id);
      if (st.previewFor === s.id) { const ex = Proto.store.explain(s.patientId); row.append(h('div', { class: 'explain', 'aria-label': 'Patient-voice preview' }, h('p', { class: 'sentence', text: ex.length ? ex.map((x) => x.patientVoice).join(' ') : 'Your share is ' + money(s.amountCents) + ' after insurance. We held this statement so your plan could settle first; nothing here is an estimate.' }), h('p', { class: 'small muted', text: 'Same rows the biller sees, rendered in the patient voice: no reason codes, no poster names.' }))); }
      return row;
    })));
    /* Where a statement is raised: every account that owes and has no statement (open, or sent today), the Ledger's gate
       points here. The store decides whether it can be raised (a claim still out holds it), and the gate stands on the row that asked. */
    const owing = S.patients.map((p) => ({ p, due: Proto.store.balances(p.id).patientDue })).filter((x) => x.due > 0 && !hasStatement(S, rows, x.p.id)).sort((a, b) => b.due - a.due);
    if (owing.length) out.append(h('h3', { text: 'Balances with no statement · ' + owing.length }), h('div', { class: 'worklist' }, ...owing.map(({ p, due }) => {
      const k = 'raise:' + p.id; if (outageOver(st.stmtGate[k])) delete st.stmtGate[k]; const g = st.stmtGate[k];
      const pend = S.claims.find((c) => c.patientId === p.id && ['submitted', 'pended'].includes(c.status));
      // After Raise the keyboard lands on the new row's stamp, never on its Send: a repeated Enter must not mail it.
      return landing(h('div', { class: 'stack' }, h('div', { class: 'wrow' }, h('span', { class: 'obj', text: pname(S, p.id) }), h('span', { class: 'amt', text: money(due) }), h('span', { class: 'why', text: pend ? pend.payer + ' still reviewing ' + cdtName(S, pend.cdt) + ' · ' + pend.age + ' days' : 'nothing waiting on insurance' }),
        btn('Raise statement', { kind: g ? 'held' : 'reversible', testid: 'money.statement.' + p.id + '.raise', ariaLabel: (g ? 'Raise statement is held: ' + g.verb + '. ' : '') + 'Raise a statement for ' + pname(S, p.id), onClick: () => { const res = post(Proto.store.raiseStatement, p.id); if (!res.ok) { st.stmtGate[k] = res; rerender(r, 'refusal.control'); return; } delete st.stmtGate[k]; say('Raised the statement — send it above'); rerender(r, '#md-sd-stamp-' + res.statement.id); } })),
        g ? gate(r, g, p.id, { focus: '#md-raise-' + p.id }) : null), 'md-raise-' + p.id);
    })));
    return out;
  }
  function creditsTab(r, S) {
    const rows = creditRows(S);
    if (!rows.length) return section('Unallocated credits', h('div', { class: 'row' }, chip('clear', 'None'), h('span', { class: 'muted', text: 'Credits appear when a payment lands before its charges, or exceeds them.' })));
    /* A credit waiting for charges applies itself when the visit's note files (store.fileNote), so the row's one action
       is to open that chart: "Apply when charges post" promised a posting the biller cannot make and did nothing. */
    return section('Unallocated credits', h('div', { class: 'worklist' }, ...rows.map((cr) => h('div', { class: 'wrow' }, h('span', { class: 'obj', text: pname(S, cr.pid) }), h('span', { class: 'amt', text: money(cr.cents) + ' credit' }), h('span', { class: 'why', text: cr.reason + (cr.encId ? ' · applies when the note files' : '') }),
      btn(cr.encId ? 'Open the chart' : 'Open the ledger', { kind: 'reversible', testid: 'money.credit.' + cr.id + '.apply', ariaLabel: cr.encId ? 'Open the chart whose filed note releases the charges this credit applies to' : 'Open the ledger for this account', onClick: () => (cr.encId ? Proto.router.go(r.persona, 'encounter', cr.encId) : Proto.router.go(r.persona, 'ledger', cr.pid)) })))));
  }
  function variancesTab(r, S) {
    const rows = myVariances(S);
    if (!rows.length) return section('Variances I own', h('div', { class: 'row' }, chip('clear', 'Tied'), h('span', { class: 'muted', text: 'No open variances on days you posted.' })));
    return section('Variances I own', h('div', { class: 'worklist' }, ...rows.map((v) => { const loc = S.locations.find((l) => l.id === v.locationId); return h('div', { class: 'md-row' }, h('div', { class: 'md-rowhead' }, chip('required', 'Variance'), h('span', { class: 'obj', text: (loc ? loc.name : v.locationId) + ' · ' + v.tender + ' · ' + money(v.amountCents) }), h('span', { class: 'muted', text: 'proposed match: ' + v.proposedMatch.bankLine })), h('p', { class: 'md-plain', text: v.sentence }), h('div', { class: 'btnrow' }, btn('Open in Daily Close', { kind: 'reversible', testid: 'money.variance.' + v.id + '.open', onClick: () => Proto.router.go(r.persona, 'close') }), h('span', { class: 'small muted', text: 'You posted that day, so someone independent clears it there.' }))); })));
  }
  function approvalsTab(r, S) {
    const STATUS = { pending: ['review', 'Waiting'], approved: ['clear', 'Approved'], declined: ['required', 'Sent back'], sent_back: ['required', 'Sent back'] };
    if (!S.approvals.length) return section('Approvals', h('div', { class: 'row' }, chip('clear', 'None waiting'), h('span', { class: 'muted', text: 'Held postings appear here with the frozen sentence the approver reads.' })));
    // The sentence is built at read time (privacy hides the name on glass) and the decision keeps the one word
    // the chip, the phone and the write-off card all use — never the raw status beside it. The approver's line
    // rides with the decision: the card points here for it.
    return section('Approvals', h('div', { class: 'worklist' }, ...S.approvals.map((a) => { const s = STATUS[a.status] || ['info', a.status]; return h('div', { class: 'wrow' }, chip(s[0], s[1]), h('span', { class: 'amt', text: money(postedCents(a)) }), h('span', { class: 'why' }, Proto.store.approvalSentence(a) + (a.decidedBy ? ' · ' + s[1] + ' by ' + a.decidedBy : ''), a.decisionReason ? [': ', h('q', { class: 'md-line', text: a.decisionReason })] : null)); })));
  }

  /* ---- keys: active only while mounted ---- */
  function onKey(ev) {
    if (Proto.router.current().route !== 'money') { detachKeys(); return; }
    const el = document.activeElement; if (!el || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('#dialogs .overlay')) return;
    const k = ev.key.toUpperCase(); const r = lastRoute || Proto.router.current(); const S = Proto.store.get();
    // An accelerator takes you to the control; the control does the thing. A bare letter used to run Post
    // matched (irreversible) and to write an appeal packet, with no gate between the keystroke and the write.
    if (k === 'P') { if (eraView(S).b.status === 'review') { ev.preventDefault(); st.tab = 'era'; rerender(r, 'money.era.era-1.postmatched'); } else say('Matched lines are already posted'); }
    else if (k === 'W') {
      ev.preventDefault();
      // No rerender once the card has stopped drawing an amount field: the focus target would not exist and
      // shell.mount() would have already dropped focus to body.
      if (st.woPosted) { say('Write-off already posted'); return; }
      if (st.woHeldReq && st.woHeldReq.status === 'approved') { say('Write-off already approved'); return; }
      if (st.tab !== 'era' && st.tab !== 'aging') st.tab = 'era';
      if (!st.writeoffOpen) openWriteoff(r); else rerender(r, 'money.writeoff.amount');
    } else if (k === 'A') { const d = denials(S).find((c) => c.status === 'denied'); if (d) { ev.preventDefault(); st.tab = 'denials'; rerender(r, 'money.denial.' + d.id + '.appeal'); } else say('No open denials to appeal'); }
  }
  function attachKeys() { if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; } }
  function detachKeys() { if (keysOn) { document.removeEventListener('keydown', onKey); keysOn = false; } }

  /* ---- render ---- */
  function render(r) {
    const S = Proto.store.get();
    if (lastStore && lastStore !== S) for (const k of Object.keys(views)) delete views[k];   // store reset: every view is stale
    lastStore = S;
    st = viewFor(); lastRoute = r;
    if (!shared()) { st.pin = ''; dropPinGates(); }      // the desk is no longer shared: a PIN gate has nothing left to ask
    const body = { era: eraTab, aging: agingTab, denials: denialsTab, statements: statementsTab, credits: creditsTab, variances: variancesTab, approvals: approvalsTab }[st.tab](r, S);
    const page = h('div', { class: 'stack md-page' },
      pageHead('Money Desk', 'Every row is patient, amount, one-line reason, one primary action. Keys: P post matched · W write-off · A appeal'),
      pinField(r),
      tabs(r, S),
      h('div', { class: 'stack', role: 'tabpanel', 'aria-label': (TABS.find((t) => t[0] === st.tab) || [])[1] }, body, writeoffCard(r, S)),
      h('p', { class: 'sr-only', 'aria-live': 'polite', text: st.announced }));
    Proto.screens.shell.mount(page);
    attachKeys();
  }

  // A PIN is typed for the posting at hand: leaving the screen disarms it, so the next person at the desk is not the last.
  window.addEventListener('hashchange', () => { for (const v of Object.values(views)) v.pin = ''; if (Proto.router.current().route !== 'money') detachKeys(); });

  Proto.screens.moneydesk = { render, setTab: (t) => { viewFor().tab = t; }, state: () => st };
  Proto.router.on('money', (r) => Proto.screens.moneydesk.render(r));
})();
