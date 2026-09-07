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

  let tab = 'era'; // remembered across renders
  let lastRoute = null; let lastStore = null; let keysOn = false;
  let st = null; // module state; rebuilt on store reset
  const fresh = () => ({ writeoffOpen: false, writeoffStr: '', writeoffReason: null, woRefusal: null, woHeldReq: null, woRequested: false, woPosted: false, appealFor: null, appealPacket: null, appealSent: null, denialRefusal: {}, previewFor: null, announced: '' });

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

  function rerender(r, focusTestid) {
    r = r || lastRoute || Proto.router.current();
    render(r);
    Proto.screens.shell.refreshAndon(r);
    if (focusTestid) { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el && el.focus) el.focus(); }
  }

  /* ---- data views ---- */
  function eraView(S) {
    const b = S.eraBatches[0]; const lines = S.eraLines.filter((l) => l.batchId === b.id);
    const by = (s) => lines.filter((l) => l.status === s);
    return { b, lines, deltas: by('delta'), posted: by('posted'), held: by('held'), disputed: by('disputed'), denied: by('denied') };
  }
  const denials = (S) => S.claims.filter((c) => c.status === 'denied' || c.status === 'appealed');
  const aging = (S) => S.claims.filter((c) => c.status === 'submitted' || c.status === 'pended');
  const statements = (S) => S.statementsDue;   // a sent row stays, carrying its confirmation
  const myVariances = (S) => { const u = Proto.store.currentUser(); return S.variances.filter((v) => v.status === 'open').filter((v) => { const rr = S.reconciliation.find((x) => x.id === v.reconciliationId); return rr && (rr.closer === u.name || u.role === 'biller' || u.role === 'owner' || u.role === 'office_manager'); }); };
  /* One meaning for every badge: work still open on that tab. A finished row stays on its tab carrying its
     confirmation, but it is no longer counted — Statements read 2 and Denials 1 with nothing left to do. */
  function counts(S) {
    const e = eraView(S);
    return { era: e.b.status === 'review' ? 1 : e.deltas.length, aging: aging(S).length, denials: denials(S).filter((c) => c.status === 'denied').length, statements: statements(S).filter((s) => !s.sent).length, credits: S.credits.length, variances: myVariances(S).length, approvals: Proto.store.pendingApprovalsFor().length };
  }

  /* ---- tabs ---- */
  function tabs(r, S) {
    const c = counts(S);
    return h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Worklists' }, ...TABS.map(([code, label]) => {
      const b = btn([label, h('span', { class: 'count', 'aria-label': plural(c[code], 'item'), text: String(c[code]) })], { testid: 'money.tab.' + code, onClick: () => { tab = code; rerender(r, 'money.tab.' + code); } });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', pressed(tab === code)); return b;
    }));
  }

  /* ---- ERA tab ---- */
  function postMatched(r) {
    const res = Proto.store.eraPostMatched('era-1');
    // One verb line, no storage id: an announcement is read aloud, not skimmed.
    if (res.ok) say(res.readback.length ? 'Read back ' + plural(res.readback.length, 'line') + ' that differ' : 'Posted the batch');
    else say(res.verb);
    rerender(r, res.readback && res.readback.length ? 'money.era.line.' + res.readback[0].id + '.confirm' : 'money.tab.era');
  }
  function handleLine(r, fn, lineId, word) {
    const res = fn(lineId);
    if (!res.ok) { say(res.verb); return; }
    const S = Proto.store.get(); const left = eraView(S).deltas;
    say(word + ' line ' + lineId.replace('el-', '') + (left.length ? ' — ' + plural(left.length, 'line') + ' left' : ' — batch complete'));
    if (!left.length) tab = 'denials';                       // the batch is done: go where the work went
    rerender(r, left.length ? 'money.era.line.' + left[0].id + '.confirm' : 'money.tab.denials');
  }
  function eraTab(r, S) {
    const e = eraView(S); const b = e.b;
    const head = h('p', { class: 'md-batchline', text: 'Delta 835 · ' + plural(b.lines, 'line') + ' · ' + b.postedLines + ' posted before you sat down · EFT ' + money(b.eftCents) + ' · ' + b.trn + ' · matched to bank line' });
    const status = h('div', { class: 'row' }, chip('clear', e.posted.length + ' posted'), e.deltas.length ? chip('review', plural(e.deltas.length, 'delta')) : null, e.held.length ? chip('info', e.held.length + ' set aside') : null, e.disputed.length ? chip('style', e.disputed.length + ' disputed') : null, e.denied.length ? chip('required', plural(e.denied.length, 'denial')) : null);
    const card = h('section', { class: 'card stack md-batch', 'aria-label': 'ERA batch era-1' }, h('h2', { text: 'Delta Dental 835 · era-1' }), head, status);
    if (b.status === 'review') {
      card.append(h('div', { class: 'btnrow' }, btn('Post matched', { kind: 'irreversible', testid: 'money.era.era-1.postmatched', ariaLabel: 'Post matched lines (P)', onClick: () => postMatched(r) }), h('span', { class: 'small muted', text: 'Posts the ' + b.postedLines + ' matched lines; only lines that differ from the claim will ask you.' })),
        h('details', { class: 'md-details' }, h('summary', { text: 'Why are ' + b.postedLines + ' already posted?', testid: 'money.era.' + b.id + '.why' }), h('p', { class: 'muted', text: 'The worker posted every clean line before you opened the batch. Each insurance payment and computed contractual write-off links to its 835 segment, claim line, and fee-schedule row; "Why did this post?" on any ledger row shows the four-line trace.' })));
      return card;
    }
    if (e.deltas.length) {
      card.append(h('h3', { text: 'Read back: ' + e.deltas.length + ' line' + (e.deltas.length > 1 ? 's' : '') + ' differ from the claim' }), h('div', { class: 'worklist' }, ...e.deltas.map((l) => deltaRow(r, S, l))));
      return card;
    }
    const parts = [e.posted.length + ' posted']; if (e.held.length) parts.push(e.held.length + ' set aside'); if (e.disputed.length) parts.push(e.disputed.length + ' disputed'); parts.push(plural(e.denied.length, 'denial') + ' moved to Denials');
    card.append(h('div', { class: 'row md-complete' }, chip('clear', 'Batch complete'), h('span', { text: 'Batch complete: ' + parts.join(', ') })), h('p', { class: 'small muted', text: 'The denied line is on the Denials tab with its plain reason and next action.' }));
    return card;
  }
  function deltaRow(r, S, l) {
    const carc = CARC[l.carc] || 'payer reason ' + l.carc;
    const isVariance = l.carc === '45';
    return h('div', { class: 'md-row', role: 'group', 'aria-label': 'Line ' + l.id.replace('el-', '') },
      h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, l.patientId) }), h('span', { class: 'muted', text: 'Line ' + l.id.replace('el-', '') + ' · ' + cdtLine(S, l.cdt, l.tooth) }), chip(isVariance ? 'review' : 'style', isVariance ? 'Contract variance' : 'Downcoded')),
      h('p', { class: 'md-delta', text: 'expected ' + money(l.expectedCents) + ', ERA says ' + money(l.paidCents) + ' · CARC ' + l.carc + ' (' + carc + ')' }),
      h('div', { class: 'btnrow' },
        btn('Confirm · post ' + money(l.paidCents) + ', write-off ' + money(l.expectedCents - l.paidCents), { kind: 'irreversible', testid: 'money.era.line.' + l.id + '.confirm', ariaLabel: 'Confirm line ' + l.id.replace('el-', '') + ': post ' + money(l.paidCents) + ' and a contractual write-off of ' + money(l.expectedCents - l.paidCents), onClick: () => handleLine(r, Proto.store.eraConfirm, l.id, 'Confirmed') }),
        // "Held" is the gated primary's identity (CONTRACTS §6); an ERA line that waits for a look is set aside.
        btn('Set aside', { kind: 'reversible', testid: 'money.era.line.' + l.id + '.hold', ariaLabel: 'Set aside line ' + l.id.replace('el-', '') + ' until you look at the note', onClick: () => handleLine(r, Proto.store.eraHold, l.id, 'Set aside') }),
        btn(isVariance ? 'Dispute contract variance' : 'Dispute', { kind: 'reversible', testid: 'money.era.line.' + l.id + '.dispute', onClick: () => handleLine(r, Proto.store.eraDispute, l.id, 'Disputed') })),
      h('details', { class: 'md-details' }, h('summary', { text: 'Why', testid: 'money.era.line.' + l.id + '.why' }), h('p', { class: 'muted', text: isVariance ? 'Paid ' + money(l.paidCents) + '; the Delta PPO fee schedule allows ' + money(l.expectedCents) + ' for ' + l.cdt.toUpperCase() + '. Dispute creates an appeal row citing the fee-schedule line. Confirm accepts it as contractual and posts the write-off with the frozen delta.' : 'The payer paid a different code than was billed. Confirm posts what was paid and the difference as contractual; Set aside keeps the line out of the ledger until you look at the note.' })));
  }

  /* ---- Open balances / write-off ---- */
  function writeoffCard(r, S) {
    const bal = Proto.store.balances(WRITEOFF_PID);
    const row = h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, WRITEOFF_PID) }), h('span', { class: 'amt', text: money(bal.patientDue) + ' open' }), h('span', { class: 'muted', text: 'Crown #19 · MetLife paid; patient portion outstanding since 9/1' }));
    if (st.woHeldReq) st.woHeldReq = S.approvals.find((x) => x.id === st.woHeldReq.id) || st.woHeldReq;
    const card = section('Open balances', row);
    if (st.woPosted) { card.append(h('div', { class: 'row' }, chip('clear', 'Write-off posted'), h('span', { class: 'muted', text: 'On the ledger with its reason code.' }))); return card; }
    if (st.woHeldReq && st.woHeldReq.status === 'approved') { card.append(h('div', { class: 'row' }, chip('clear', 'Write-off ' + money(st.woHeldReq.amountCents) + ' approved by ' + st.woHeldReq.decidedBy), h('span', { class: 'muted', text: 'Posted to the ledger by the approval.' }))); return card; }
    // A request that came back says so here, in the approver's word: the card used to fall through to a plain
    // Post with nothing to show that the phone had already answered.
    if (st.woHeldReq && (st.woHeldReq.status === 'declined' || st.woHeldReq.status === 'sent_back')) {
      card.append(h('div', { class: 'row' }, chip('required', 'Sent back'), h('span', { class: 'muted', text: 'Sent back by ' + st.woHeldReq.decidedBy + ' · nothing posted. Their line is on the approvals card; Post requests it again.' })));
    }
    if (!st.writeoffOpen) { card.append(h('div', { class: 'btnrow' }, btn('Write-off or adjustment', { kind: 'reversible', testid: 'money.writeoff.' + WRITEOFF_PID, ariaLabel: 'Write-off or adjustment for ' + pname(S, WRITEOFF_PID) + ' (W)', onClick: () => openWriteoff(r) }))); return card; }
    const amt = h('input', { class: 'input md-amount', type: 'text', inputmode: 'decimal', testid: 'money.writeoff.amount', value: st.writeoffStr, 'aria-label': 'Write-off amount in dollars', onInput: (ev) => { st.writeoffStr = ev.target.value; } });
    const hint = h('p', { class: 'hint', text: 'At or above ' + money(S.tenant.dualReleaseThresholdCents) + ' a second approver is needed; the posting is held, never silently allowed.' });
    amt.addEventListener('blur', () => { const bad = st.writeoffStr.trim() !== '' && !(cents(st.writeoffStr) > 0); amt.classList.toggle('invalid', bad); if (bad) hint.textContent = 'Enter a dollar amount above zero.'; });
    const reasons = h('div', { class: 'btnrow', role: 'group', 'aria-label': 'Reason code' }, ...REASONS.map(([code, label]) => btn(label, { testid: 'money.writeoff.reason.' + code, pressed: pressed(st.writeoffReason === code), onClick: () => { st.writeoffReason = code; st.woRefusal = null; rerender(r, 'money.writeoff.reason.' + code); } })));
    const held = st.woHeldReq && st.woHeldReq.status === 'pending';
    // The eligible approvers are one list, the one the request was written with; the biller is not told a
    // different set of names from the one the phone card and the verb line read.
    const approvers = held ? (st.woHeldReq.eligible || []).join(' or ') : '';
    const post = held
      ? btn('Held', { kind: 'held', testid: 'money.writeoff.post', ariaLabel: 'Held: waiting on a second approver', onClick: () => say('Waiting on ' + approvers) })
      : btn('Post', { kind: 'irreversible', testid: 'money.writeoff.post', onClick: () => postWriteoff(r) });
    const postRow = h('div', { class: 'btnrow' }, post, held ? h('span', { class: 'row' }, chip('review', 'Approval requested'), h('span', { class: 'small muted', text: approvers + ' will see it on their phone; this flips to Posted when they approve.' })) : null);
    // The gate stays on screen while the request is open: the refusal is the only thing that says what is
    // holding the posting and where to go next, and nulling it here left the Held button with no verb line.
    if (held) setTimeout(() => { const el = document.querySelector('[data-testid="money.writeoff.post"]'); if (el) { const b = el.getBoundingClientRect(); if (b.bottom > window.innerHeight || b.top < 0) el.scrollIntoView({ block: 'center' }); } }, 0);
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
    const res = Proto.store.requestWriteoff(WRITEOFF_PID, amountCents, st.writeoffReason);
    if (res.ok) { st.woPosted = true; st.woRefusal = null; say('Posted the ' + money(amountCents) + ' write-off'); rerender(r, 'money.tab.' + tab); return; }
    if (res.held) {
      const S = Proto.store.get(); st.woHeldReq = S.approvals.find((x) => x.id === res.requestId) || null;
      st.woRefusal = refusal({ code: res.code, verb: res.verb, control: res.control || 'Request approval', why: res.why, onControl: () => { st.woRequested = true; say('Requested approval from ' + ((st.woHeldReq && st.woHeldReq.eligible) || []).join(' or ')); rerender(r, 'money.writeoff.post'); } });
      rerender(r, 'refusal.control'); return;
    }
    st.woRefusal = refusal({ code: res.code, verb: res.verb, control: res.control || 'Back to ERA', why: res.why, onControl: () => { tab = 'era'; st.woRefusal = null; rerender(r, 'money.tab.era'); } });
    rerender(r, 'refusal.control');
  }

  /* ---- Denials tab ---- */
  function openAppeal(r, claimId) {
    const res = Proto.store.buildAppeal(claimId);
    if (!res.ok) { say(res.verb); return; }
    st.appealFor = claimId; st.appealPacket = res.packet; st.denialRefusal[claimId] = null;
    say('Built the appeal packet from the record');
    rerender(r, 'money.appeal.send');
  }
  function denialsTab(r, S) {
    const rows = denials(S);
    if (!rows.length) return section('Denials', h('div', { class: 'row' }, chip('clear', 'No open denials'), h('span', { class: 'muted', text: st.appealSent ? 'Appeal for ' + st.appealSent + ' sent · disclosure recorded.' : 'Denied lines from an ERA land here with a plain reason and one next action.' })));
    return section('Denials', h('div', { class: 'worklist' }, ...rows.map((c) => denialRow(r, S, c))));
  }
  // The done-word names its object once, the way a sent statement does.
  const sentLine = () => h('div', { class: 'row' }, chip('clear', 'Appeal sent'), h('span', { text: 'Disclosure recorded (clearinghouse, payment purpose, artifact hashes).' }));
  function denialRow(r, S, c) {
    const row = h('div', { class: 'md-row', role: 'group', 'aria-label': 'Denied claim ' + c.id },
      h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, c.patientId) }), h('span', { class: 'amt', text: money(c.amountCents) }), h('span', { class: 'muted', text: c.id + ' · ' + cdtLine(S, c.cdt, c.tooth) + ' · ' + c.payer }), chip('review', 'Appeal by ' + shortDate(c.appealBy))),
      h('p', { class: 'md-plain', text: c.plain }),
      h('p', { class: 'md-next' }, h('b', { text: 'Next: ' }), c.nextAction),
      h('div', { class: 'btnrow' },
        btn('Appeal', { kind: 'reversible', testid: 'money.denial.' + c.id + '.appeal', ariaLabel: 'Appeal claim ' + c.id + ' with a packet built from the record (A)', onClick: () => openAppeal(r, c.id) }),
        btn('Fix', { kind: 'quiet', testid: 'money.denial.' + c.id + '.fix', onClick: () => say('Opens the note field the payer cited') }),
        btn('Bill patient', { kind: 'quiet', testid: 'money.denial.' + c.id + '.bill', onClick: () => {
          st.denialRefusal[c.id] = refusal({ code: 'denial_suppression', verb: 'Appeal first — denial with no appeal', control: 'Build appeal', why: 'A write-off or patient bill after a denial with no appeal routes through dual release at any amount and cannot be posted by the claim\'s submitter.', onControl: () => openAppeal(r, c.id) });
          rerender(r, 'refusal.control');
        } })),
      st.denialRefusal[c.id] || null,
      st.appealSent === c.id ? sentLine() : null,
      h('details', { class: 'md-details' }, h('summary', { text: 'Why this code', testid: 'money.denial.' + c.id + '.why' }), h('p', { class: 'muted', text: 'CARC ' + c.carc + (c.rarc ? ' / RARC ' + c.rarc : '') + ' · ' + (CARC[c.carc] || 'payer reason') + '. Translated once by the versioned CARC dictionary with the ' + c.payer + ' overlay; the action is chosen by the table, not decoded by hand. Bill patient is offered only for PR group codes.' })));
    if (st.appealFor === c.id && st.appealPacket) row.append(appealDrawer(r, S, c));
    return row;
  }
  function appealDrawer(r, S, c) {
    const pk = st.appealPacket; const slots = [['perioChart', 'Perio chart', 'six-point exam, 7/1/2025, 4 sites ≥ 5 mm in the quadrant'], ['narrative', 'Narrative from the note', 'filed-note excerpt for the periodontal module, quoted verbatim'], ['radiograph', 'Radiograph', 'bitewings with interpretation, from the encounter'], ['letter', 'Letter', 'restates CARC ' + c.carc + ' and cites the fee-schedule line']];
    const list = h('ul', { class: 'md-slots' }, ...slots.map(([k, label, detail]) => h('li', { class: 'row' }, chip(pk.slots[k] ? 'clear' : 'required', pk.slots[k] ? 'Clear' : 'Required'), h('span', null, h('b', { text: label }), h('span', { class: 'muted', text: ' · ' + (pk.slots[k] ? detail : 'not on the record; add before sending') })))));
    const missing = slots.filter(([k]) => !pk.slots[k]).length;
    const drawer = h('div', { class: 'md-drawer stack', role: 'region', 'aria-label': 'Appeal packet for claim ' + c.id },
      h('div', { class: 'row drawer-head' }, h('h3', { class: 'grow', text: 'Appeal packet · built from the record' }), btn('Close', { kind: 'quiet', class: 'compact', testid: 'money.appeal.close', onClick: () => { st.appealFor = null; st.appealPacket = null; rerender(r, 'money.denial.' + c.id + '.appeal'); } })),
      list,
      h('div', { class: 'md-sentence' }, h('span', { class: 'small muted', text: 'What the patient reads: ' }), h('span', { text: pk.patientSentence })));
    if (st.appealSent === c.id) { drawer.append(sentLine()); return drawer; }
    drawer.append(h('div', { class: 'btnrow' }, btn('Send', { kind: 'irreversible', testid: 'money.appeal.send', ariaLabel: 'Send appeal for claim ' + c.id, onClick: () => {
      if (missing) { st.denialRefusal[c.id] = refusal({ code: 'packet_incomplete', verb: 'Add the required slot before sending', control: 'Show slots', why: 'An appeal that cites prose loses; every slot is a frozen record artifact.', onControl: () => rerender(r, 'money.appeal.send') }); rerender(r, 'refusal.control'); return; }
      const res = Proto.store.sendAppeal(c.id);
      if (!res.ok) { say(res.verb); return; }
      // The packet is gone; its confirmation stays on the row, the way a sent statement keeps its own.
      st.appealSent = c.id; st.appealFor = null; st.appealPacket = null;
      say('Sent the appeal — disclosure recorded'); rerender(r, 'money.tab.denials');
    } }), h('span', { class: 'small muted', text: 'Irreversible: writes a disclosure row with artifact hashes.' })));
    return drawer;
  }

  /* ---- Aging tab ---- */
  function agingAction(c) { if (c.status === 'pended') return 'attach'; if (c.age >= 60) return 'escalate'; return 'call'; }
  function agingTab(r, S) {
    const rows = aging(S); const groups = [['14', '14+ days', (c) => c.age >= 14 && c.age < 30], ['30', '30+ days', (c) => c.age >= 30 && c.age < 60], ['60', '60+ days', (c) => c.age >= 60]];
    const out = section('Claims aging', h('p', { class: 'small muted', text: 'Submitted and pended claims by age with one next action each. Counts are by payer, never by person.' }));
    for (const [, label, f] of groups) {
      const g = rows.filter(f); if (!g.length) continue;
      out.append(h('h3', { text: label + ' · ' + g.length }), h('div', { class: 'worklist' }, ...g.map((c) => { const act = agingAction(c); return h('div', { class: 'wrow' }, h('span', { class: 'obj', text: pname(S, c.patientId) }), h('span', { class: 'amt', text: money(c.amountCents) }), h('span', { class: 'why', text: c.id + ' · ' + cdtLine(S, c.cdt, c.tooth) + ' · ' + c.payer + ' · ' + c.age + ' days · ' + c.nextAction }), btn(AGING_ACTION[act], { kind: 'reversible', testid: 'money.aging.row.' + c.id + '.' + act, onClick: () => say(AGING_ACTION[act] + ' for ' + pname(S, c.patientId)) })); })));
    }
    return out;
  }

  /* ---- Statements, credits, variances, approvals ---- */
  function statementsTab(r, S) {
    const rows = statements(S);
    if (!rows.length) return section('Statements due', h('div', { class: 'row' }, chip('clear', 'Nothing due'), h('span', { class: 'muted', text: 'Statements sent today are disclosure rows on the ledger.' })));
    return section('Statements due', h('div', { class: 'worklist' }, ...rows.map((s) => {
      const row = h('div', { class: 'md-row' + (s.sent ? ' sent' : '') }, h('div', { class: 'md-rowhead' }, h('span', { class: 'obj', text: pname(S, s.patientId) }), h('span', { class: 'amt', text: money(s.amountCents) }), chip('info', 'Deferred'), h('span', { class: 'muted', text: 'deferred at the window ' + shortDate(s.created) + ' so insurance could settle first' })),
        s.sent
          ? h('div', { class: 'row' }, chip('clear', 'Statement sent'), h('span', { class: 'small muted', text: 'Sent to ' + pname(S, s.patientId) + ' · disclosure recorded · ' + shortDate(S.tenant.today) }))
          : h('div', { class: 'btnrow' }, btn('Send statement', { kind: 'irreversible', testid: 'money.statement.' + s.id + '.send', onClick: () => { const res = Proto.store.sendStatement(s.id); say(res.ok ? 'Sent the statement — disclosure recorded' : res.verb); rerender(r, 'money.tab.statements'); } }), btn('Preview', { kind: 'reversible', testid: 'money.statement.' + s.id + '.preview', pressed: pressed(st.previewFor === s.id), onClick: () => { st.previewFor = st.previewFor === s.id ? null : s.id; rerender(r, 'money.statement.' + s.id + '.preview'); } })));
      if (st.previewFor === s.id) { const ex = Proto.store.explain(s.patientId); row.append(h('div', { class: 'explain', 'aria-label': 'Patient-voice preview' }, h('p', { class: 'sentence', text: ex.length ? ex.map((x) => x.patientVoice).join(' ') : 'Your share is ' + money(s.amountCents) + ' after insurance. We held this statement so your plan could settle first; nothing here is an estimate.' }), h('p', { class: 'small muted', text: 'Same rows the biller sees, rendered in the patient voice: no reason codes, no poster names.' }))); }
      return row;
    })));
  }
  function creditsTab(r, S) {
    if (!S.credits.length) return section('Unallocated credits', h('div', { class: 'row' }, chip('clear', 'None'), h('span', { class: 'muted', text: 'Credits appear when a payment lands before its charges.' })));
    return section('Unallocated credits', h('div', { class: 'worklist' }, ...S.credits.map((cr) => h('div', { class: 'wrow' }, h('span', { class: 'obj', text: pname(S, cr.patientId) }), h('span', { class: 'amt', text: money(-cr.amountCents) + ' credit' }), h('span', { class: 'why', text: cr.reason }), btn('Apply when charges post', { kind: 'reversible', testid: 'money.credit.' + cr.id + '.apply', onClick: () => say('Apply ' + money(-cr.amountCents) + ' when the charges post') })))));
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
    // the chip, the phone and the write-off card all use — never the raw status beside it.
    return section('Approvals', h('div', { class: 'worklist' }, ...S.approvals.map((a) => { const s = STATUS[a.status] || ['info', a.status]; return h('div', { class: 'wrow' }, chip(s[0], s[1]), h('span', { class: 'amt', text: money(a.amountCents) }), h('span', { class: 'why', text: Proto.store.approvalSentence(a) + (a.decidedBy ? ' · ' + s[1] + ' by ' + a.decidedBy : '') })); })));
  }

  /* ---- keys: active only while mounted ---- */
  function onKey(ev) {
    if (Proto.router.current().route !== 'money') { detachKeys(); return; }
    const el = document.activeElement; if (!el || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('#dialogs .overlay')) return;
    const k = ev.key.toUpperCase(); const r = lastRoute || Proto.router.current(); const S = Proto.store.get();
    // An accelerator takes you to the control; the control does the thing. A bare letter used to run Post
    // matched (irreversible) and to write an appeal packet, with no gate between the keystroke and the write.
    if (k === 'P') { if (eraView(S).b.status === 'review') { ev.preventDefault(); tab = 'era'; rerender(r, 'money.era.era-1.postmatched'); } else say('Matched lines are already posted'); }
    else if (k === 'W') {
      ev.preventDefault();
      // No rerender once the card has stopped drawing an amount field: the focus target would not exist and
      // shell.mount() would have already dropped focus to body.
      if (st.woPosted) { say('Write-off already posted'); return; }
      if (st.woHeldReq && st.woHeldReq.status === 'approved') { say('Write-off already approved'); return; }
      if (tab !== 'era' && tab !== 'aging') tab = 'era';
      if (!st.writeoffOpen) openWriteoff(r); else rerender(r, 'money.writeoff.amount');
    } else if (k === 'A') { const d = denials(S).find((c) => c.status === 'denied'); if (d) { ev.preventDefault(); tab = 'denials'; rerender(r, 'money.denial.' + d.id + '.appeal'); } else say('No open denials to appeal'); }
  }
  function attachKeys() { if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; } }
  function detachKeys() { if (keysOn) { document.removeEventListener('keydown', onKey); keysOn = false; } }

  /* ---- render ---- */
  function render(r) {
    const S = Proto.store.get();
    if (lastStore !== S) { lastStore = S; st = fresh(); tab = 'era'; }
    lastRoute = r;
    const body = { era: eraTab, aging: agingTab, denials: denialsTab, statements: statementsTab, credits: creditsTab, variances: variancesTab, approvals: approvalsTab }[tab](r, S);
    const page = h('div', { class: 'stack md-page' },
      pageHead('Money Desk', 'Every row is patient, amount, one-line reason, one primary action. Keys: P post matched · W write-off · A appeal'),
      tabs(r, S),
      h('div', { class: 'stack', role: 'tabpanel', 'aria-label': (TABS.find((t) => t[0] === tab) || [])[1] }, body, writeoffCard(r, S)),
      h('p', { class: 'sr-only', 'aria-live': 'polite', text: st.announced }));
    Proto.screens.shell.mount(page);
    attachKeys();
  }

  window.addEventListener('hashchange', () => { if (Proto.router.current().route !== 'money') detachKeys(); });

  Proto.screens.moneydesk = { render, setTab: (t) => { tab = t; }, state: () => st };
  Proto.router.on('money', (r) => Proto.screens.moneydesk.render(r));
})();
