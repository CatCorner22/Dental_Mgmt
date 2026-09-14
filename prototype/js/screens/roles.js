/* Roles: who may do what, and the controls that sit in the workflow (docs/13 feature 27, docs/04
   'controls live in the workflow'). A table of people, each row naming its role, its entitlements and
   the accepted SoD decision; Show grants opens the plain grants (no scores, no rankings). Add day pass
   opens a four-field inline form with a live SoD + licence preview: clinical entitlements issue only
   against a verified credential on file (Codex fix); a critical SoD conflict needs a recorded
   decision before the pass issues. Issue day pass cannot be taken back, so it asks a second time
   through ui.js confirmable, with Cancel beside it; it switches to Held, never dims, and a seat that
   does not grant roles reads why before it fills anything in. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, longDate, pageHead, section, field, errorSummary, confirmable } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  const REVIEW_AT_SAVE = '2026-10-03';   // the review date store.js writes on a compensate / accept decision
  const now = () => S().clock.time;      // the store clock; a shift end must be later than it
  const DIGEST_BASE = 3;           // passes already issued this month before this session

  const ROLE_LABEL = { owner: 'Owner', dentist: 'Dentist', surgeon: 'Oral surgeon', hygienist: 'Hygienist', assistant: 'Assistant', office_manager: 'Office manager', frontdesk: 'Front-desk coordinator', biller: 'Biller', compliance: 'Compliance lead', cpa: 'CPA seat' };
  // The seed's day-pass templates carry their own labels ("RDH (hygienist)", "Front desk"), so one role read two
  // ways on one screen. A person reads the same role word here as in the People table; the licence is a suffix
  // only where two templates would otherwise share a word.
  const TEMPLATE_LABEL = { frontdesk: 'Front-desk coordinator', rdh: 'Hygienist', rda: 'Assistant · RDA', da: 'Assistant · DA' };
  const ENT_LABEL = { approve_second: 'Second approver', post_payment: 'Post payments', refund: 'Refund', write_off: 'Write-off', bank_reconcile: 'Reconcile bank', grant_roles: 'Grant roles', close_day: 'Close day', prepare_deposit: 'Prepare deposit', schedule: 'Schedule', submit_claims: 'Submit claims', post_era: 'Post ERA', review_logs: 'Review audit log', view_reports: 'View reports', chart: 'Chart', perio: 'Perio', note_draft: 'Draft notes', chart_assist: 'Chart (assist)' };
  const ENT_DESC = {
    approve_second: 'Can be the second approver on refunds and write-offs, never on their own request.',
    post_payment: 'Posts patient payments at the window.',
    refund: 'Issues refunds; every refund goes through dual release.',
    write_off: 'Posts write-offs; above the threshold a second approver is needed.',
    bank_reconcile: 'Clears the bank reconciliation for a day they did not post.',
    grant_roles: 'Grants roles and issues day passes.',
    close_day: 'Closes the day; the close seals the ledger chain.',
    prepare_deposit: 'Prepares the deposit slip.',
    schedule: 'Books, moves, and arrives appointments.',
    submit_claims: 'Submits and corrects claims.',
    post_era: 'Posts matched ERA lines and works deltas.',
    review_logs: 'Reads the audit log in sentences.',
    view_reports: 'Reads practice-level reports only.',
    chart: 'Charts findings under their own licence.',
    perio: 'Records perio exams under their own licence.',
    note_draft: 'Drafts clinical notes for a dentist to file.',
    chart_assist: 'Charts as an assistant; the dentist files.',
  };
  const EXTRA_OPTIONS = ['refund', 'write_off', 'prepare_deposit'];

  // Per-screen UI state; cleared whenever the store is rebuilt (window.__proto.reset).
  let lastStore = null; let st = null;
  function freshState() {
    return { formOpen: false, expanded: {}, form: { name: '', role: 'frontdesk', location: 'loc-1', end: '17:30', extra: [] }, touched: {}, errors: [], previewOn: false, decision: null, saveGate: null, issued: null, credentialNote: false, credentialRequested: false, previewKey: null, previewNode: null, removed: null };
  }
  function state() { const s = S(); if (s !== lastStore) { lastStore = s; st = freshState(); } return st; }
  const clock12 = Proto.ui.time;                       // one clock for every screen (ui.js)
  const template = (code) => S().roleTemplates.find((t) => t.code === code);
  const roleLabel = (code) => TEMPLATE_LABEL[code] || ROLE_LABEL[code] || (template(code) || {}).label || code;
  const entLabel = (e) => ENT_LABEL[e] || e;
  const firstName = (name) => (name || '').split(' ')[0];
  const shortBy = (name) => (name || '').startsWith('Dr.') ? 'Dr. ' + name.split(' ').pop() : firstName(name);
  const validEnd = (end) => /^\d{2}:\d{2}$/.test(end || '') && end > now();
  const endBadText = () => 'Shift end must be later than now (' + clock12(now()) + ').';
  const q = (testid) => document.querySelector('[data-testid="' + testid + '"]');
  /* Only a seat that grants roles may issue a day pass (store addDayPass). The compliance lead — whose home
     this screen is — holds review_logs alone, so every press of Issue day pass was refused after the form was
     filled and nothing said so beforehand. The constraint is now printed where the form is offered and the
     primary stands Held from the first paint, so nobody types a pass they cannot issue. */
  const orList = (a) => (a.length <= 1 ? a[0] || 'a seat that grants roles' : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]);
  const granters = () => orList(S().users.filter((u) => (u.entitlements || []).includes('grant_roles')).map((u) => u.short));
  const canIssue = () => { const me = Proto.store.currentUser(); return !me.noPass && (me.entitlements || []).includes('grant_roles'); };
  const seatWord = () => ROLE_LABEL[Proto.store.currentUser().role] || 'this seat';
  const cannotLine = () => 'Only a seat that grants roles can issue a day pass. Yours (' + seatWord() + ') does not: ask ' + granters() + '.';
  const focusTestid = (id) => { const el = id && (/^[[.#]/.test(id) ? document.querySelector(id) : q(id)); if (el && el.focus) el.focus(); };

  function rerender(r, focusId) { pendingRefresh = false; render(r); Proto.screens.shell.refreshAndon(r); if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r); focusTestid(focusId); }

  /* A mouse press on a control blurs whatever field has focus before the click is dispatched. The blur rebuilt
     the preview and the primary, so the control under the pointer was replaced between mousedown and mouseup
     and the first press was lost: no click, no gate, focus on body. The rebuild now waits until the press has
     finished, and a full rerender supersedes it. A keyboard blur (Tab) still rebuilds immediately. */
  let pressing = false; let pendingRefresh = false; let lastRoute = null;
  document.addEventListener('mousedown', () => { pressing = true; }, true);
  document.addEventListener('mouseup', () => {
    if (!pressing) return;
    pressing = false;
    if (!pendingRefresh) return;
    setTimeout(() => { if (pendingRefresh) { pendingRefresh = false; refreshPreview(lastRoute, true); } }, 0);
  }, true);

  // ---- People table ------------------------------------------------------------------------
  /* A day pass is a grant like any other, so it sits in the People table with the seats it was issued beside;
     its SoD decision is the controlDecisions row the store wrote for it. */
  const passAsSeat = (dp) => ({ id: dp.id, name: dp.name, role: dp.role, licence: null, entitlements: dp.entitlements || [], dayPass: dp });
  // Whether a pass is live is the store's word (passState): every live pass's PIN opens its holder's session, so the row
  // says live, ended or revoked in the store's terms and never lists a credential the pad would refuse.
  const PASS_STATE = { live: (dp) => chip('clear', 'Live until ' + clock12(dp.shiftEnd) + ' + 30 min'), ended: () => chip('required', 'Ended · grants lapsed'), revoked: (dp) => chip('required', 'Revoked' + (dp.revokedBy ? ' by ' + shortBy(dp.revokedBy) : '')) };
  const passChip = (dp) => PASS_STATE[Proto.store.passState(dp)](dp);
  function decisionFor(uid) {
    const g = S().currentGrants.find((x) => x.userId === uid && x.accepted);
    const d = g ? null : S().controlDecisions.find((x) => x.dayPassId === uid && x.ruleId);
    if (!g && !d) return null;
    const accepted = g ? g.accepted : { ruleId: d.ruleId, by: d.by, reviewBy: d.reviewBy, decisionId: d.id };
    const rule = S().sodRules.find((x) => x.id === accepted.ruleId);
    const word = g || d.kind === 'accept_residual' ? 'accepted' : 'compensated';
    return { grant: g || { accepted }, rule, text: (rule ? rule.pair.map(entLabel).join(' + ') : 'SoD pair') + ' ' + word + ' by ' + shortBy(accepted.by) + ', review ' + longDate(accepted.reviewBy) };
  }
  const credentialFor = (u) => S().credentials.find((c) => (u.dayPass ? c.id === u.dayPass.credentialId : c.userId === u.id));
  const credentialChip = (c) => chip('clear', 'Licence verified · ' + c.licenceType + ' · ' + c.state + ' · expires ' + longDate(c.expiresAt) + ' · verified by ' + firstName(c.verifiedBy));

  function grantsPanel(u) {
    const cred = credentialFor(u); const dec = decisionFor(u.id);
    return h('div', { class: 'rl-grants', role: 'region', 'aria-label': 'Grants for ' + u.name },
      h('div', { class: 'row' }, h('b', { text: 'Grants' }), h('span', { class: 'small muted', text: 'listed, never scored or ranked' })),
      u.entitlements.length
        ? h('ul', null, ...u.entitlements.map((e) => h('li', null, h('b', { text: entLabel(e) }), ' — ', ENT_DESC[e] || 'Role entitlement.')))
        : h('p', { class: 'hint', text: 'Role scope only: ' + (ROLE_LABEL[u.role] || u.role) + (u.licence ? ' under ' + u.licence + ' licence' : '') + '. No money entitlements.' }),
      cred ? h('div', { class: 'row' }, credentialChip(cred)) : (u.licence ? h('p', { class: 'hint', text: 'Licence ' + u.licence + ' on the account; no credential row in this seed.' }) : null),
      dec ? h('div', { class: 'stack' },
        h('div', { class: 'row' }, chip('review', dec.text)),
        dec.rule ? h('details', null, h('summary', { testid: 'roles.row.' + u.id + '.why', 'aria-label': 'Why this was accepted' }, 'Why'),
          h('div', { class: 'rl-note' },
            h('p', null, h('b', { text: 'Fraud path: ' }), dec.rule.fraudPath),
            h('p', null, h('b', { text: 'Compensating control: ' }), dec.rule.compensating),
            h('p', null, h('b', { text: 'Decision: ' }), 'accepted on purpose by ' + dec.grant.accepted.by + '; re-reviewed on ' + longDate(dec.grant.accepted.reviewBy) + '. Recorded as a control decision with that review date.'))) : null) : null);
  }

  function peopleTable(r) {
    const s = state(); const rows = [];
    for (const u of [...S().users, ...S().dayPasses.map(passAsSeat)]) {
      const open = !!s.expanded[u.id]; const dec = decisionFor(u.id);
      /* The name is data, so it is text in its cell; the row's control is the verb that opens the grants.
         As a button the name read "Dr. Chidi Okafor · DDS, OMS" — six words, not a verb, and two lines
         high at 1024 (CLT-label-words, INT-verb-labels, CDS-BTN-text-bold-body). */
      const rowBtn = btn(open ? 'Hide grants' : 'Show grants', { kind: 'quiet', class: 'rl-rowbtn', testid: 'roles.row.' + u.id, ariaLabel: (open ? 'Hide grants for ' : 'Show grants for ') + u.name, onClick: () => { s.expanded[u.id] = !open; rerender(r, 'roles.row.' + u.id); } });
      rowBtn.setAttribute('aria-expanded', String(open));
      rows.push(h('tr', null,
        h('td', null, h('div', { class: 'rl-chips' }, h('span', { text: u.name + (u.licence ? ' · ' + u.licence : '') + (u.dayPass ? ' · day pass' : '') }), rowBtn)),
        u.dayPass ? h('td', null, h('div', { class: 'rl-chips' }, h('span', { text: roleLabel(u.role) }), passChip(u.dayPass))) : h('td', { text: ROLE_LABEL[u.role] || u.role }),
        // Entitlements are a list of facts, not statuses: as one chip each they put up to eight chips on a
        // single row and fourteen chip words on the screen, so the chips stopped signalling (CLT-chip-vocab).
        h('td', null, u.entitlements.length ? h('span', { text: u.entitlements.map(entLabel).join(', ') }) : h('span', { class: 'muted small', text: 'Role scope only' })),
        h('td', null, dec ? chip('review', dec.text) : h('span', { class: 'muted', text: '—' }))));
      if (open) rows.push(h('tr', { class: 'rl-expanded' }, h('td', { colspan: '4' }, grantsPanel(u))));
    }
    // Every column header says which column it heads (scope) and the table carries its own name (caption),
    // so a screen reader can place any cell without the surrounding heading (AXE-1.3.1).
    return Proto.ui.scrollRegion('Roles and grants', 'roles.table:rl-tablewrap', h('table', { class: 'data rl-table', 'aria-label': 'Seats, roles, entitlements and accepted SoD decisions' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Person' }), h('th', { scope: 'col', text: 'Role' }), h('th', { scope: 'col', text: 'Entitlements' }), h('th', { scope: 'col', text: 'Accepted SoD decision' }))),
      h('tbody', null, ...rows)));
  }

  // ---- Day pass form: preview -----------------------------------------------------------------
  const previewKeyOf = (pv) => JSON.stringify({ gate: !!pv.licenceGate, cred: pv.credential ? pv.credential.id : null, conflicts: pv.conflicts.map((c) => c.id), ents: pv.entitlements, decision: state().decision, note: state().credentialNote, requested: state().credentialRequested, end: state().form.end, removed: state().removed });

  /* Remediate on one gate drops that gate's own extra entitlement, not every extra that appears in any pair;
     the group control remediates all of them. The announcement names what went and what is left. */
  function remediate(r, conflict) {
    const s = state(); const pv = Proto.store.previewDayPass(s.form);
    const base = new Set((template(s.form.role) || { entitlements: [] }).entitlements);
    const offending = new Set(); (conflict ? [conflict] : pv.conflicts).forEach((c) => c.pair.forEach((e) => { if (!base.has(e)) offending.add(e); }));
    const removed = s.form.extra.filter((e) => offending.has(e));
    s.form.extra = s.form.extra.filter((e) => !offending.has(e));
    s.decision = null; s.saveGate = null; s.previewOn = true;
    const left = Proto.store.previewDayPass(s.form).conflicts.length;
    // What is announced is also printed in the preview: a line only the screen reader hears is a change
    // nobody watching the screen can see (WCAG 1.3.2).
    s.removed = 'Removed ' + removed.map(entLabel).join(' and ') + '; ' + (left ? left + (left === 1 ? ' SoD conflict left' : ' SoD conflicts left') : 'no SoD conflicts');
    Proto.router.announce(s.removed);
    // Focus lands on the preview the press changed, never on Issue day pass: a repeated Enter must not issue the pass.
    rerender(r, '#rl-preview-head');
  }
  function decide(r, kind) { const s = state(); s.decision = kind; s.saveGate = null; s.previewOn = true; rerender(r, kind === 'compensate' ? 'roles.sod.compensate' : 'roles.sod.accept'); }

  function buildPreview(r) {
    const s = state(); const f = s.form; const pv = Proto.store.previewDayPass(f);
    const tpl = template(f.role);
    const grantEnts = pv.licenceGate ? template('frontdesk').entitlements : pv.entitlements;
    const box = h('div', { class: 'rl-preview', role: 'group', 'aria-label': 'Day pass preview' }, h('h3', { id: 'rl-preview-head', tabindex: '-1', text: 'Preview' }),
      h('div', { class: 'rl-chips' }, h('span', { class: 'small muted', text: 'Will grant:' }), ...grantEnts.map((e) => chip('info', entLabel(e))), h('span', { class: 'small muted', text: 'until ' + clock12(f.end) + ' + 30 min grace' })),
      s.removed ? h('p', { class: 'small muted', text: s.removed }) : null);

    // Licence gate (Codex fix): clinical entitlements only against a verified credential.
    if (tpl && tpl.clinical) {
      if (pv.licenceGate) {
        const g = pv.licenceGate;
        // The gate keeps its own control; it opens the intake path, whose control carries the credential id (§4).
        box.append(refusal({ code: g.code, verb: g.verb, control: g.control, why: g.why, onControl: () => { s.credentialNote = true; rerender(r, 'roles.daypass.credential.request'); } }));
        if (s.credentialNote) box.append(h('p', { class: 'rl-note' }, 'Credential intake: licence number, state, expiry; verified by Dana; takes about a day. This pass stays Front-desk coordinator only until the credential is verified. ',
          s.credentialRequested
            ? h('span', { id: 'rl-cred-requested', tabindex: '-1' }, chip('review', 'Credential check requested for ' + (f.name.trim() || 'this temp') + '; Dana verifies within a day'))
            // The id says what the control does, so the "add" suffix is not shared with Add day pass (WCAG 3.2.4).
            : btn('Request credential check', { kind: 'reversible', class: 'compact', testid: 'roles.daypass.credential.request', onClick: () => { s.credentialRequested = true; Proto.router.announce('Credential check requested for ' + (f.name.trim() || 'this temp') + '; Dana verifies within a day'); rerender(r, '#rl-cred-requested'); } })));
      } else {
        box.append(h('div', { class: 'row' }, credentialChip(pv.credential)));
      }
    } else {
      box.append(h('div', { class: 'row' }, chip('info', 'Nonclinical role · no licence needed')));
    }

    // Segregation of duties, shown before save.
    if (pv.conflicts.length) {
      box.append(h('h3', { text: 'Segregation of duties' }));
      // The verb line is the store's own words for this gate; the seed's fraud-path sentence is evidence and reads under Why.
      // The Why is the evidence: the fraud path and the control that answers it. What each of the three
      // decision buttons does is on the buttons, so repeating it here ran the answer to 53 words (INT-error-wording).
      pv.conflicts.forEach((c) => box.append(refusal({ code: 'sod_conflict', verb: 'Remediate, compensate, or accept this conflict', control: 'Remediate', severity: c.severity === 'critical' ? 'stop' : 'required',
        why: 'Fraud path: ' + c.fraudPath + ' Compensating control: ' + c.compensating + ' One person holding ' + c.pair.map(entLabel).join(' and ') + ' is a ' + c.severity + ' conflict.',
        onControl: () => remediate(r, c) })));
      // Only a critical conflict holds the pass (store addDayPass); a high one issues and stands as an open finding.
      box.append(h('p', { class: 'hint', text: pv.conflicts.some((c) => c.severity === 'critical') ? 'Pick one before issuing the pass.' : 'Pick one, or issue as is: an undecided conflict stays an open SoD finding on Daily Close.' }));
      // Each gate carries its own Remediate; the group's is the one that clears every conflict at once, so it
      // appears only when there is more than one — the word never stands twice on a single gate.
      box.append(h('div', { class: 'btnrow', role: 'group', 'aria-label': 'SoD decision' },
        pv.conflicts.length > 1 ? btn('Remediate', { kind: 'reversible', testid: 'roles.sod.remediate', ariaLabel: 'Remediate every conflict', onClick: () => remediate(r) }) : null,
        btn('Compensate', { kind: 'reversible', testid: 'roles.sod.compensate', pressed: String(s.decision === 'compensate'), onClick: () => decide(r, 'compensate') }),
        btn('Accept on purpose', { kind: 'quiet', testid: 'roles.sod.accept', pressed: String(s.decision === 'accept_residual'), onClick: () => decide(r, 'accept_residual') })));
      if (s.decision) box.append(h('div', { class: 'row' }, chip('review', (s.decision === 'compensate' ? 'Compensating control' : 'Accepted on purpose') + ' · review ' + longDate(REVIEW_AT_SAVE))));
    } else {
      box.append(h('div', { class: 'row' }, chip('clear', 'No SoD conflicts')));
    }
    s.previewKey = previewKeyOf(pv);
    return box;
  }

  /* Swap the preview in place (no page rebuild, so the caret and Tab focus survive). force=true after a blur. Focus
     is kept by test id across the swap: the control it rested on is replaced, so the replacement takes it. */
  function refreshPreview(r, force) {
    const s = state(); if (!r || !s.previewOn || !s.previewNode || !s.previewNode.isConnected) return;
    if (pressing) { pendingRefresh = true; return; }         // a press is in flight: replacing its control would swallow it
    const pv = Proto.store.previewDayPass(s.form);
    if (!force && previewKeyOf(pv) === s.previewKey && !staleSave(s)) return; // nothing that matters changed: no re-announce
    const active = document.activeElement; const tid = active && active.getAttribute && active.getAttribute('data-testid');
    const next = buildPreview(r); s.previewNode.replaceWith(next); s.previewNode = next;
    refreshSave(r);
    if (tid && !active.isConnected) focusTestid(tid);
  }
  // A blur rebuilds after focus has landed, so the control the keyboard moved onto is the one that gets replaced and re-focused.
  const refreshAfterBlur = (r) => setTimeout(() => refreshPreview(r, true), 0);
  /* The primary carries the read-back ("Issue a day pass to Sam Rivera as …"), so it is rebuilt as the form
     changes — but only when what it says has actually changed, and never while its own confirm step is
     standing. Rebuilding it on every blur replaced the button between the press going down and coming up,
     and the press was lost. */
  let saveKey = null;
  const saveKeyOf = (s) => JSON.stringify([heldWhy(s), s.form.name, s.form.role, s.form.end]);
  function refreshSave(r) {
    const s = state(); const old = document.getElementById('rl-saverow');
    if (!old || saveKeyOf(s) === saveKey || q('roles.daypass.save.confirm')) return;
    old.replaceWith(saveRow(r));
  }

  // ---- Day pass form: save ---------------------------------------------------------------------
  const blocking = () => { const s = state(); return Proto.store.previewDayPass(s.form).conflicts.some((c) => c.severity === 'critical') && !s.decision; };
  /* A store gate whose cause is gone (outage over, name typed, shift end fixed, a different author at the desk) falls on
     the next render; while one stands the primary is Held, and its press re-evaluates the gate before it focuses the
     gate's control — it never posts past a standing gate. The gate remembers the author who raised it. */
  const staleSave = (s) => { const code = s.saveGate && s.saveGate.dataset.code; return (code === 'outage' && !S().outage) || (code === 'entitlement' && s.saveGateWho !== Proto.store.currentUser().id); };
  const dropStaleGate = (s) => { if (s.saveGate && staleSave(s)) { s.saveGate.remove(); s.saveGate = null; } };
  /* What holds the primary, in the words the person needs, or null when it can act. The line is printed in the
     button's own row as well as read into its accessible name (INT-no-disabled-use-held). */
  // A field that has been fixed loses its line in the summary and its hold on the primary.
  const liveErrors = (s) => (s.errors || []).filter((e) => (e.id === 'rl-name' ? !s.form.name.trim() : !validEnd(s.form.end)));
  function heldWhy(s) {
    if (!canIssue()) return 'your seat does not grant roles';
    if (s.saveGate) return 'answer the gate above, then issue';
    if (blocking()) return 'decide on the critical conflict, then issue';
    if (liveErrors(s).length) return 'complete the form, then issue';
    // Leaving a field empty does not hold the primary: it marks the field. What holds the primary is a
    // submit that was refused, and the line beside it says so.
    return null;
  }
  /* The row, not the button: an irreversible primary never stands alone (CLT-neutral-irreversible), and a
     pass that cannot be taken back is issued in two steps (INT-irreversible-identity, ui.js confirmable). */
  function saveRow(r) {
    const s = state(); const f = s.form; dropStaleGate(s);
    const why = heldWhy(s); saveKey = saveKeyOf(s);
    const cancel = btn('Cancel', { kind: 'reversible', testid: 'roles.daypass.cancel', ariaLabel: 'Cancel the day pass form', onClick: () => closeForm(r) });
    const primary = why
      ? btn('Issue day pass', { kind: 'held', testid: 'roles.daypass.save', ariaLabel: 'Held: ' + why, onClick: () => { dropStaleGate(s); if (s.saveGate) return rerender(r, 'refusal.control'); doSave(r); } })
      : confirmable('Issue day pass', { testid: 'roles.daypass.save', severity: 'stop', confirmLabel: 'Issue day pass', onCancel: () => { cancel.style.display = ''; },
        readback: 'Issue a day pass to ' + f.name.trim() + ' as ' + roleLabel(f.role) + ', good until ' + clock12(f.end) + ' + 30 min grace. The grant row cannot be taken back.',
        ariaLabel: 'Issue day pass (irreversible: a grant row is written)', onConfirm: () => doSave(r) });
    if (!why) {
      const first = primary.firstElementChild;
      if (first) first.addEventListener('click', () => { cancel.style.display = 'none'; });
    }
    return h('div', { id: 'rl-saverow' }, h('div', { class: 'btnrow' }, cancel, primary, why ? h('span', { class: 'hint', text: 'Held: ' + why + (canIssue() ? '' : '; ask ' + granters()) }) : null));
  }

  function doSave(r) {
    const s = state(); const f = s.form;
    const gate = (v) => { s.previewOn = true; s.saveGate = refusal(v); s.saveGateWho = Proto.store.currentUser().id; rerender(r, 'refusal.control'); };
    // The seat that cannot grant roles was told so before it typed; pressing repeats the line rather than
    // raising a fresh refusal at the foot of a form it was never going to be able to send.
    if (!canIssue()) { Proto.router.announce(cannotLine()); return rerender(r, '#rl-cannot'); }
    // One summary before the form, with a link per field in error (CDS-ERR-summary-top), and the message
    // itself between the label and the input it names (CDS-ERR-message-prefix, ui.js field).
    const errs = [];
    if (!f.name.trim()) errs.push({ id: 'rl-name', message: 'Name the temp before issuing the pass' });
    if (!validEnd(f.end)) errs.push({ id: 'rl-end', message: 'Set a shift end later than now (' + clock12(now()) + ')' });
    if (errs.length) { s.errors = errs; s.touched.name = true; s.touched.end = true; s.previewOn = true; return rerender(r, 'roles.daypass.errors'); }
    s.errors = [];
    const res = Proto.store.addDayPass({ name: f.name.trim(), role: f.role, location: f.location, end: f.end, extra: f.extra.slice() }, s.decision);
    // The conflict the store refuses on is the gate the preview is already showing. A second copy of it put two
    // verb lines and two controls on one gate, so the press points at the gate on screen instead (B2, C2).
    if (!res.ok && res.code === 'sod_conflict' && s.previewOn) { s.saveGate = null; return rerender(r, 'refusal.control'); }
    // The control does what its label says: Support line announces the number and the gate stands; anything else returns to the primary.
    if (!res.ok) return gate({ code: res.code, verb: res.verb, control: res.control, why: res.why, severity: 'stop', onControl: () => { if (res.code === 'outage') { Proto.ui.support(); return; } s.saveGate = null; rerender(r, 'roles.daypass.save'); } });
    s.issued = { dayPass: res.dayPass, pin: res.pin, downgraded: res.downgraded, requestedRole: f.role };
    Object.assign(s, { formOpen: false, saveGate: null, decision: null, previewOn: false, credentialNote: false, credentialRequested: false, touched: {}, errors: [], removed: null, form: freshState().form });
    Proto.router.announce('Day pass issued to ' + res.dayPass.name);
    // Focus lands on the issued card, where the one-time PIN is read; never on Sign in, which a repeated Enter would take.
    rerender(r, '#rl-issued-head');
  }

  // ---- Day pass form: fields -------------------------------------------------------------------
  function dayPassForm(r) {
    const s = state(); const f = s.form; dropStaleGate(s);
    const nameBad = () => s.touched.name && !f.name.trim(); const endBad = () => s.touched.end && !validEnd(f.end);
    s.errors = liveErrors(s);
    const nameIn = h('input', { id: 'rl-name', class: 'input' + (nameBad() ? ' invalid' : ''), type: 'text', autocomplete: 'off', value: f.name, placeholder: 'Full name as on the licence', testid: 'roles.daypass.name',
      /* A message that clears on blur re-flows the form under the pointer between a press going down and
         coming up, and the press is lost. A fixed value clears its own message as it is typed; leaving the
         field only ever raises one. */
      onInput: (ev) => { f.name = ev.target.value; if (f.name.trim()) { nameIn.classList.remove('invalid'); nameField._setError(null); } refreshSave(r); refreshPreview(r); },
      // A blur raised by the press on another control must not move that control: the message lands on the
      // next render instead, which the press itself brings.
      onBlur: () => { s.touched.name = true; s.previewOn = true; if (!pressing) { nameIn.classList.toggle('invalid', nameBad()); if (nameBad()) nameField._setError('Enter the temp\'s full name as it appears on their licence.'); } refreshAfterBlur(r); } });
    // The requirement and the format stand in the label and the hint, before anyone types (INT-instructions-before-input).
    const nameField = field('Name', nameIn, { required: true, hint: 'Full name as on their licence; credentials are matched by name, licence type and state.' });
    const endIn = h('input', { id: 'rl-end', class: 'input rl-time' + (endBad() ? ' invalid' : ''), type: 'time', value: f.end, testid: 'roles.daypass.end',
      onInput: (ev) => { f.end = ev.target.value; if (validEnd(f.end)) { endIn.classList.remove('invalid'); endField._setError(null); } refreshSave(r); refreshPreview(r); },
      onBlur: () => { s.touched.end = true; s.previewOn = true; if (!pressing) { endIn.classList.toggle('invalid', endBad()); if (endBad()) endField._setError(endBadText()); } refreshAfterBlur(r); } });
    // A time input is entered once and walked in segments; only the first segments carried the ring, so the
    // stop before the field is left had none. The ring is held for as long as the field has the keyboard (WCAG 2.4.7).
    endIn.addEventListener('focus', () => { endIn.style.outline = '3px solid var(--focus)'; endIn.style.outlineOffset = '2px'; });
    endIn.addEventListener('blur', () => { endIn.style.outline = ''; endIn.style.outlineOffset = ''; });
    const endField = field('Shift end', endIn, { required: true, hint: 'Later than ' + clock12(now()) + '; grants lapse 30 minutes after it.' });
    nameField.style.maxWidth = 'var(--measure)';
    if (nameBad()) nameField._setError('Enter the temp\'s full name as it appears on their licence.');
    if (endBad()) endField._setError(endBadText());
    const seg = (label, items, current, testidFor, onPick) => h('div', { class: 'field' }, h('label', { text: label }),
      h('div', { class: 'seg', role: 'group', 'aria-label': label }, ...items.map(([code, text]) => btn(text, { kind: 'quiet', testid: testidFor(code), pressed: String(current === code), onClick: () => onPick(code) }))));
    const roleSeg = seg('Role', S().roleTemplates.map((t) => [t.code, roleLabel(t.code)]), f.role, (c) => 'roles.daypass.role.' + c, (c) => { f.role = c; s.decision = null; s.saveGate = null; s.removed = null; s.previewOn = true; rerender(r, 'roles.daypass.role.' + c); });
    const locSeg = seg('Location', S().locations.map((l) => [l.id, l.name]), f.location, (c) => 'roles.daypass.location.' + c, (c) => { f.location = c; s.previewOn = true; rerender(r, 'roles.daypass.location.' + c); });
    const extras = h('div', { class: 'field' }, h('label', { text: 'Extra entitlements (not in the role)' }),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Extra entitlements' }, ...EXTRA_OPTIONS.map((e) => { const on = f.extra.includes(e); return btn(entLabel(e), { kind: 'quiet', testid: 'roles.daypass.entitlement.' + e, pressed: String(on), ariaLabel: entLabel(e) + (on ? ', on' : ', off'), onClick: () => { f.extra = on ? f.extra.filter((x) => x !== e) : f.extra.concat(e); s.decision = null; s.saveGate = null; s.removed = null; s.previewOn = true; rerender(r, 'roles.daypass.entitlement.' + e); } }); })),
      // One sentence, one idea: the 32-word answer read at grade nine (CLT-reading-grade).
      h('details', null, h('summary', { testid: 'roles.daypass.extra.why', 'aria-label': 'Why would I add these?' }, 'Why'), h('p', { class: 'hint', text: 'Rarely. A temp who refunds or writes off while posting payments creates a segregation-of-duties conflict. The preview names the fraud path and the compensating control before you save.' })));

    s.previewNode = s.previewOn ? buildPreview(r) : h('p', { class: 'hint rl-preview-wait', text: 'Leave a field to see the preview.' });

    return section('Add day pass',
      errorSummary(s.errors, { testid: 'roles.daypass.errors' }),
      // One field per row: side by side, Tab crossed from the foot of one column to the head of the next
      // and the keyboard appeared to travel upwards three times (WCAG 2.4.3).
      h('div', { class: 'stack' }, nameField, roleSeg, locSeg, endField),
      extras,
      s.previewNode,
      s.saveGate,
      saveRow(r));
  }

  function issuedCard() {
    const s = state(); const i = s.issued; if (!i) return null; const dp = i.dayPass;
    const wanted = template(i.requestedRole) || {};
    const decRow = S().controlDecisions.find((d) => d.dayPassId === dp.id);   // the review date the store wrote, read back, not restated
    return h('section', { class: 'card stack rl-issued', 'aria-label': 'Day pass issued' },
      h('h2', { id: 'rl-issued-head', tabindex: '-1', text: 'Day pass issued' }),
      h('div', { class: 'row' }, chip('clear', 'Issued'), i.downgraded ? chip('required', 'Downgraded to ' + roleLabel('frontdesk')) : null, dp.sodDecision ? chip('review', 'SoD decision: ' + (dp.sodDecision === 'compensate' ? 'Compensating control' : 'Accepted on purpose') + ' · review ' + longDate((decRow || {}).reviewBy || REVIEW_AT_SAVE)) : null),
      // The words staff use, not the acronym: a one-time code from an authenticator app (INT-real-world-words).
      h('p', { class: 'rl-sentence', text: 'Day pass issued to ' + dp.name + ' · ' + roleLabel(dp.role) + ' · expires ' + clock12(dp.shiftEnd) + ' + 30 min grace · sign-in link sent to their phone; one-time codes from their own authenticator app' }),
      i.downgraded ? h('p', { class: 'rl-note', text: 'Issued as ' + roleLabel('frontdesk') + ', not ' + roleLabel(i.requestedRole) + ': no verified ' + (wanted.licence || 'clinical') + ' credential on file for ' + dp.name + '. Nothing clinical was granted; clinical entitlements issue only after the credential is verified.' }) : null,
      // Shown once, at issue: the PIN is how the holder posts under their own name on a shared desk.
      i.pin ? h('p', { class: 'rl-sentence', text: 'PIN ' + i.pin + ' — for shared-desk postings; shown once' }) : null,
      h('div', { class: 'rl-chips' }, h('span', { class: 'small muted', text: 'Granted:' }), ...dp.entitlements.map((e) => chip('info', entLabel(e)))),
      h('div', { class: 'btnrow' }, btn('Sign in as this temp', { kind: 'reversible', testid: 'roles.daypass.signin', onClick: () => { P().set({ persona: 'temp' }); location.hash = '#/temp/board'; } })),
      h('details', null, h('summary', { testid: 'roles.daypass.expiry.why', 'aria-label': 'Why it expires' }, 'Why'), h('p', { class: 'hint', text: 'At ' + clock12(dp.shiftEnd) + ' + 30 min the grants lapse and the session is revoked. The account remains as a frozen name on everything it posted; issued by ' + dp.createdBy + ' for ' + (S().locations.find((l) => l.id === dp.locationId) || {}).name + '.' })));
  }

  // ---- Screen -------------------------------------------------------------------------------
  /* Cancel discards: the name, the pressed role, location and extras, the preview and the validation state all
     go back to fresh, so a reopened form is the empty one the label promises. */
  function closeForm(r) {
    const s = state();
    Object.assign(s, { formOpen: false, saveGate: null, errors: [], removed: null, form: freshState().form, touched: {}, decision: null, previewOn: false, credentialNote: false, credentialRequested: false, previewNode: null, previewKey: null });
    rerender(r, 'roles.daypass.add');
  }

  function render(r) {
    const s = state(); lastRoute = r;
    // One label per id: the opener used to read "Cancel" while the form was open, so one test id carried two
    // labels (WCAG 3.2.4). The form owns its own Cancel; this control opens it and then points at it.
    const addBtn = btn('Add day pass', { kind: 'reversible', testid: 'roles.daypass.add', ariaLabel: s.formOpen ? 'Add day pass (the form is open below)' : 'Add day pass', onClick: () => {
      if (s.formOpen) return focusTestid('roles.daypass.name');
      s.formOpen = true; s.saveGate = null; s.issued = null;
      rerender(r, 'roles.daypass.name');
    } });
    addBtn.setAttribute('aria-expanded', String(s.formOpen));
    const page = h('div', { class: 'stack rl-page' },
      pageHead('Roles · Main Street', 'Who may do what; controls live in the grant.', addBtn),
      h('p', { class: 'small muted rl-digest', text: 'Day passes issued this month: ' + (DIGEST_BASE + S().dayPasses.length) + ' (practice)' }),
      // The constraint before the form, not after the press: a seat without Grant roles reads what it can and
      // cannot do here before it fills anything in (INT-instructions-before-input).
      canIssue() ? null : h('p', { class: 'hint rl-seatline', id: 'rl-cannot', tabindex: '-1', text: cannotLine() }),
      s.formOpen ? dayPassForm(r) : null,
      issuedCard(),
      section('People and entitlements',
        h('p', { class: 'hint', text: 'Listed per person, never scored or ranked.' }),
        peopleTable(r)));
    Proto.screens.shell.mount(page);
  }

  /* A confirmation belongs to the visit that earned it: the issued card used to survive a hop to another route
     and back, so a pass issued minutes ago still read as news (INT-success-says-what-next). The record is the
     row in People and entitlements, which stays. */
  window.addEventListener('hashchange', () => { if (st && Proto.router.current().route !== 'roles') { st.issued = null; st.removed = null; } });

  Proto.screens.roles = { render, remediate, decide, save: doSave };
  Proto.router.on('roles', (r) => Proto.screens.roles.render(r));
})();
