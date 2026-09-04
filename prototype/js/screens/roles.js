/* Roles: who may do what, and the controls that sit in the workflow (docs/13 feature 27, docs/04
   'controls live in the workflow'). A table of people with entitlements as chips and the accepted
   SoD decision as a review chip; rows expand to plain grants (no scores, no rankings). Add day pass
   opens a four-field inline form with a live SoD + licence preview: clinical entitlements issue only
   against a verified credential on file (Codex fix); a critical SoD conflict needs a recorded
   decision before Save. Save is irreversible; the button switches to Held, never dims. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, longDate, shortDate, pageHead, section } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  const REVIEW_AT_SAVE = '10/3';   // review date the store writes on a compensate / accept decision
  const NOW = '08:40';             // the seed clock; a shift end must be later
  const DIGEST_BASE = 3;           // passes already issued this month before this session

  const ROLE_LABEL = { owner: 'Owner', dentist: 'Dentist', surgeon: 'Oral surgeon', hygienist: 'Hygienist', assistant: 'Assistant', office_manager: 'Office manager', frontdesk: 'Front desk', biller: 'Biller', compliance: 'Compliance lead', cpa: 'CPA seat' };
  const ENT_LABEL = { approve_second: 'Second approver', post_payment: 'Post payments', refund: 'Refund', write_off: 'Write off', bank_reconcile: 'Reconcile bank', grant_roles: 'Grant roles', close_day: 'Close day', prepare_deposit: 'Prepare deposit', schedule: 'Schedule', submit_claims: 'Submit claims', post_era: 'Post ERA', review_logs: 'Review audit log', view_reports: 'View reports', chart: 'Chart', perio: 'Perio', note_draft: 'Draft notes', chart_assist: 'Chart (assist)' };
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
    return { formOpen: false, expanded: {}, form: { name: '', role: 'frontdesk', location: 'loc-1', end: '17:30', extra: [] }, touched: {}, previewOn: false, decision: null, saveGate: null, issued: null, credentialNote: false, previewKey: null, previewNode: null };
  }
  function state() { const s = S(); if (s !== lastStore) { lastStore = s; st = freshState(); } return st; }

  const clock12 = (t) => { if (!/^\d{2}:\d{2}$/.test(t || '')) return t || '—'; const [hh, mm] = t.split(':').map(Number); return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm'); };
  const template = (code) => S().roleTemplates.find((t) => t.code === code);
  const roleLabel = (code) => { const t = template(code); return t ? t.label : (ROLE_LABEL[code] || code); };
  const entLabel = (e) => ENT_LABEL[e] || e;
  const firstName = (name) => (name || '').split(' ')[0];
  const shortBy = (name) => (name || '').startsWith('Dr.') ? 'Dr. ' + name.split(' ').pop() : firstName(name);
  const validEnd = (end) => /^\d{2}:\d{2}$/.test(end || '') && end > NOW;
  const q = (testid) => document.querySelector('[data-testid="' + testid + '"]');
  const focusTestid = (id) => { const el = id && q(id); if (el && el.focus) el.focus(); };

  function rerender(r, focusId) { render(r); Proto.screens.shell.refreshAndon(r); if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r); focusTestid(focusId); }

  // ---- People table ------------------------------------------------------------------------
  function decisionFor(uid) {
    const g = S().currentGrants.find((x) => x.userId === uid && x.accepted);
    if (!g) return null;
    const rule = S().sodRules.find((x) => x.id === g.accepted.ruleId);
    return { grant: g, rule, text: (rule ? rule.pair.join(' + ') : 'SoD pair') + ' accepted by ' + shortBy(g.accepted.by) + ', review ' + shortDate(g.accepted.reviewBy) };
  }
  const credentialFor = (u) => S().credentials.find((c) => c.userId === u.id);
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
        dec.rule ? h('details', null, h('summary', { testid: 'roles.row.' + u.id + '.why' }, 'What was accepted, and why'),
          h('div', { class: 'rl-note' },
            h('p', null, h('b', { text: 'Fraud path: ' }), dec.rule.fraudPath),
            h('p', null, h('b', { text: 'Compensating control: ' }), dec.rule.compensating),
            h('p', null, h('b', { text: 'Decision: ' }), 'accepted on purpose by ' + dec.grant.accepted.by + '; re-reviewed on ' + longDate(dec.grant.accepted.reviewBy) + '. Recorded as control decision ' + dec.grant.accepted.decisionId + '.'))) : null) : null);
  }

  function peopleTable(r) {
    const s = state(); const rows = [];
    for (const u of S().users) {
      const open = !!s.expanded[u.id]; const dec = decisionFor(u.id);
      const rowBtn = btn(u.name + (u.licence ? ' · ' + u.licence : ''), { kind: 'quiet', class: 'rl-rowbtn', testid: 'roles.row.' + u.id, ariaLabel: (open ? 'Hide grants for ' : 'Show grants for ') + u.name, onClick: () => { s.expanded[u.id] = !open; rerender(r, 'roles.row.' + u.id); } });
      rowBtn.setAttribute('aria-expanded', String(open));
      rows.push(h('tr', null,
        h('td', null, rowBtn),
        h('td', { text: ROLE_LABEL[u.role] || u.role }),
        h('td', null, h('div', { class: 'rl-chips' }, ...(u.entitlements.length ? u.entitlements.map((e) => chip('info', entLabel(e))) : [h('span', { class: 'muted small', text: 'Role scope only' })]))),
        h('td', null, dec ? chip('review', dec.text) : h('span', { class: 'muted', text: '—' }))));
      if (open) rows.push(h('tr', { class: 'rl-expanded' }, h('td', { colspan: '4' }, grantsPanel(u))));
    }
    return h('div', { class: 'rl-tablewrap' }, h('table', { class: 'data rl-table' },
      h('thead', null, h('tr', null, h('th', { text: 'Person' }), h('th', { text: 'Role' }), h('th', { text: 'Entitlements' }), h('th', { text: 'Accepted SoD decision' }))),
      h('tbody', null, ...rows)));
  }

  // ---- Day pass form: preview -----------------------------------------------------------------
  const previewKeyOf = (pv) => JSON.stringify({ gate: !!pv.licenceGate, cred: pv.credential ? pv.credential.id : null, conflicts: pv.conflicts.map((c) => c.id), ents: pv.entitlements, decision: state().decision, note: state().credentialNote, end: state().form.end });

  function remediate(r) {
    const s = state(); const pv = Proto.store.previewDayPass(s.form);
    const base = new Set((template(s.form.role) || { entitlements: [] }).entitlements);
    const offending = new Set(); pv.conflicts.forEach((c) => c.pair.forEach((e) => { if (!base.has(e)) offending.add(e); }));
    s.form.extra = s.form.extra.filter((e) => !offending.has(e));
    s.decision = null; s.saveGate = null; s.previewOn = true;
    Proto.router.announce('Extra entitlement removed; no SoD conflicts');
    rerender(r, 'roles.daypass.save');
  }
  function decide(r, kind) { const s = state(); s.decision = kind; s.saveGate = null; s.previewOn = true; rerender(r, kind === 'compensate' ? 'roles.sod.compensate' : 'roles.sod.accept'); }

  function buildPreview(r) {
    const s = state(); const f = s.form; const pv = Proto.store.previewDayPass(f);
    const tpl = template(f.role);
    const grantEnts = pv.licenceGate ? template('frontdesk').entitlements : pv.entitlements;
    const box = h('div', { class: 'rl-preview', 'aria-label': 'Day pass preview' }, h('h3', { text: 'Preview' }),
      h('div', { class: 'rl-chips' }, h('span', { class: 'small muted', text: 'Will grant:' }), ...grantEnts.map((e) => chip('info', entLabel(e))), h('span', { class: 'small muted', text: 'until ' + clock12(f.end) + ' + 30 min grace' })));

    // Licence gate (Codex fix): clinical entitlements only against a verified credential.
    if (tpl && tpl.clinical) {
      if (pv.licenceGate) {
        const g = pv.licenceGate;
        const node = refusal({ code: g.code, verb: g.verb, control: g.control, why: g.why, onControl: () => { s.credentialNote = true; rerender(r, 'roles.daypass.save'); } });
        const c = node.querySelector('[data-testid="refusal.control"]'); if (c) c.setAttribute('data-testid', 'roles.daypass.credential.add');
        box.append(node);
        if (s.credentialNote) box.append(h('p', { class: 'rl-note', text: 'Credential intake: licence number, state, expiry; verified by Dana; takes about a day. This pass stays Front desk only until the credential is verified.' }));
      } else {
        box.append(h('div', { class: 'row' }, credentialChip(pv.credential)));
      }
    } else {
      box.append(h('div', { class: 'row' }, chip('info', 'Nonclinical role · no licence needed'), h('span', { class: 'small muted', text: 'The Front desk template carries no refund, write-off, or reconciliation entitlement.' })));
    }

    // Segregation of duties, shown before save.
    if (pv.conflicts.length) {
      box.append(h('h3', { text: 'Segregation of duties' }));
      pv.conflicts.forEach((c) => box.append(refusal({ code: 'sod_conflict', verb: c.fraudPath, control: 'Remediate', severity: c.severity === 'critical' ? 'stop' : 'required', why: c.compensating + ' (' + c.pair.join(' + ') + ', ' + c.severity + ')', onControl: () => remediate(r) })));
      box.append(h('p', { class: 'hint', text: 'Pick one before Save. Remediate drops the extra entitlement; the other two write a control decision with a review date.' }));
      box.append(h('div', { class: 'btnrow', role: 'group', 'aria-label': 'SoD decision' },
        btn('Remediate', { kind: 'reversible', testid: 'roles.sod.remediate', onClick: () => remediate(r) }),
        btn('Compensate', { kind: 'reversible', testid: 'roles.sod.compensate', pressed: String(s.decision === 'compensate'), onClick: () => decide(r, 'compensate') }),
        btn('Accept on purpose', { kind: 'quiet', testid: 'roles.sod.accept', pressed: String(s.decision === 'accept_residual'), onClick: () => decide(r, 'accept_residual') })));
      if (s.decision) box.append(h('div', { class: 'row' }, chip('review', (s.decision === 'compensate' ? 'Compensating control recorded at save' : 'Accepted on purpose') + ' · review ' + REVIEW_AT_SAVE)));
    } else {
      box.append(h('div', { class: 'row' }, chip('clear', 'No SoD conflicts')));
    }
    s.previewKey = previewKeyOf(pv);
    return box;
  }

  /* Swap the preview in place (no page rebuild, so the caret and Tab focus survive). force=true after a blur. */
  function refreshPreview(r, force) {
    const s = state(); if (!s.previewOn || !s.previewNode) return;
    const pv = Proto.store.previewDayPass(s.form);
    if (!force && previewKeyOf(pv) === s.previewKey) return; // nothing that matters changed: no re-announce
    const next = buildPreview(r); s.previewNode.replaceWith(next); s.previewNode = next;
    const old = q('roles.daypass.save'); if (old) old.replaceWith(saveButton(r));
  }

  // ---- Day pass form: save ---------------------------------------------------------------------
  const blocking = () => { const s = state(); return Proto.store.previewDayPass(s.form).conflicts.some((c) => c.severity === 'critical') && !s.decision; };
  function saveButton(r) {
    const s = state(); const held = blocking() || (s.touched.name && !s.form.name.trim()) || (s.touched.end && !validEnd(s.form.end));
    return btn(held ? 'Held' : 'Issue day pass', { kind: held ? 'held' : 'irreversible', testid: 'roles.daypass.save', ariaLabel: held ? 'Held: decide on the conflict or complete the form, then issue' : 'Issue day pass (irreversible: a grant row is written)', onClick: () => doSave(r) });
  }

  function doSave(r) {
    const s = state(); const f = s.form;
    const gate = (v) => { s.previewOn = true; s.saveGate = refusal(v); rerender(r, 'refusal.control'); };
    if (!f.name.trim()) { s.touched.name = true; return gate({ code: 'name_required', verb: 'Name the temp before issuing the pass', control: 'Go to name', why: 'Every pass is a named identity: the name is frozen on everything they post. There is no shared temp login.', onControl: () => { s.saveGate = null; rerender(r, 'roles.daypass.name'); } }); }
    if (!validEnd(f.end)) { s.touched.end = true; return gate({ code: 'shift_end_required', verb: 'Set a shift end later than now', control: 'Go to shift end', why: 'Grants expire at shift end plus 30 minutes of grace; an end before now would issue a pass that is already expired.', onControl: () => { s.saveGate = null; rerender(r, 'roles.daypass.end'); } }); }
    const res = Proto.store.addDayPass({ name: f.name.trim(), role: f.role, location: f.location, end: f.end, extra: f.extra.slice() }, s.decision);
    if (!res.ok) return gate({ code: res.code, verb: res.verb, control: res.control, why: res.why, severity: 'stop', onControl: () => { s.saveGate = null; rerender(r, 'roles.sod.remediate'); } });
    s.issued = { dayPass: res.dayPass, downgraded: res.downgraded, requestedRole: f.role };
    Object.assign(s, { formOpen: false, saveGate: null, decision: null, previewOn: false, credentialNote: false, touched: {}, form: freshState().form });
    Proto.router.announce('Day pass issued to ' + res.dayPass.name);
    rerender(r, 'roles.daypass.signin');
  }

  // ---- Day pass form: fields -------------------------------------------------------------------
  function dayPassForm(r) {
    const s = state(); const f = s.form;
    const nameBad = () => s.touched.name && !f.name.trim(); const endBad = () => s.touched.end && !validEnd(f.end);
    const nameHint = h('span', { id: 'rl-name-hint', class: 'hint', text: nameBad() ? 'Enter the temp\'s full name as it appears on their licence.' : 'Credentials are matched by name, licence type, and state.' });
    const endHint = h('span', { id: 'rl-end-hint', class: 'hint', text: endBad() ? 'Shift end must be later than now (8:40 am).' : 'Grants lapse 30 minutes after this time; the session is revoked.' });
    // Validation is silent until blur: the input only marks itself once the field has been left.
    const mark = (input, bad, hint, badText, okText) => { input.classList.toggle('invalid', bad); if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); hint.textContent = bad ? badText : okText; };
    const nameIn = h('input', { id: 'rl-name', class: 'input' + (nameBad() ? ' invalid' : ''), type: 'text', autocomplete: 'off', value: f.name, placeholder: 'Full name as on the licence', testid: 'roles.daypass.name', 'aria-describedby': 'rl-name-hint', 'aria-invalid': nameBad() ? 'true' : null,
      onInput: (ev) => { f.name = ev.target.value; refreshPreview(r); },
      onBlur: () => { s.touched.name = true; s.previewOn = true; mark(nameIn, nameBad(), nameHint, 'Enter the temp\'s full name as it appears on their licence.', 'Credentials are matched by name, licence type, and state.'); refreshPreview(r, true); } });
    const endIn = h('input', { id: 'rl-end', class: 'input rl-time' + (endBad() ? ' invalid' : ''), type: 'time', value: f.end, testid: 'roles.daypass.end', 'aria-describedby': 'rl-end-hint', 'aria-invalid': endBad() ? 'true' : null,
      onInput: (ev) => { f.end = ev.target.value; refreshPreview(r); },
      onBlur: () => { s.touched.end = true; s.previewOn = true; mark(endIn, endBad(), endHint, 'Shift end must be later than now (8:40 am).', 'Grants lapse 30 minutes after this time; the session is revoked.'); refreshPreview(r, true); } });
    const seg = (label, items, current, testidFor, onPick) => h('div', { class: 'field' }, h('label', { text: label }),
      h('div', { class: 'seg', role: 'group', 'aria-label': label }, ...items.map(([code, text]) => btn(text, { kind: 'quiet', testid: testidFor(code), pressed: String(current === code), onClick: () => onPick(code) }))));
    const roleSeg = seg('Role', S().roleTemplates.map((t) => [t.code, t.label]), f.role, (c) => 'roles.daypass.role.' + c, (c) => { f.role = c; s.decision = null; s.saveGate = null; s.previewOn = true; rerender(r, 'roles.daypass.role.' + c); });
    const locSeg = seg('Location', S().locations.map((l) => [l.id, l.name]), f.location, (c) => 'roles.daypass.location.' + c, (c) => { f.location = c; s.previewOn = true; rerender(r, 'roles.daypass.location.' + c); });
    const extras = h('div', { class: 'field' }, h('label', { text: 'Extra entitlements (not in the role)' }),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Extra entitlements' }, ...EXTRA_OPTIONS.map((e) => { const on = f.extra.includes(e); return btn(entLabel(e), { kind: 'quiet', testid: 'roles.daypass.entitlement.' + e, pressed: String(on), ariaLabel: entLabel(e) + (on ? ', on' : ', off'), onClick: () => { f.extra = on ? f.extra.filter((x) => x !== e) : f.extra.concat(e); s.decision = null; s.saveGate = null; s.previewOn = true; rerender(r, 'roles.daypass.entitlement.' + e); } }); })),
      h('details', null, h('summary', { testid: 'roles.daypass.extra.why' }, 'Why would I add these?'), h('p', { class: 'hint', text: 'Rarely. A temp who also refunds, writes off, or prepares the deposit while posting payments creates a segregation-of-duties conflict; the preview shows the fraud path and the compensating control before you save.' })));

    s.previewNode = s.previewOn ? buildPreview(r) : h('p', { class: 'hint rl-preview-wait', text: 'The preview appears as soon as you leave a field: entitlements, licence check, and any SoD conflict, all before Save.' });

    return section('Add day pass',
      h('p', { class: 'hint', text: 'Four fields. The grant is an append-only row that expires at shift end + 30 min; the invite is a magic link plus TOTP on the temp\'s own phone.' }),
      h('div', { class: 'rl-grid' },
        h('div', { class: 'field' }, h('label', { for: 'rl-name', text: 'Name' }), nameIn, nameHint),
        roleSeg, locSeg,
        h('div', { class: 'field' }, h('label', { for: 'rl-end', text: 'Shift end' }), endIn, endHint)),
      extras,
      s.previewNode,
      s.saveGate,
      h('div', { class: 'btnrow' }, saveButton(r), h('span', { class: 'small muted', text: 'Irreversible: writes the grant row and sends the invite. Close the form with the Add day pass button to discard.' })));
  }

  function issuedCard() {
    const s = state(); const i = s.issued; if (!i) return null; const dp = i.dayPass;
    const wanted = template(i.requestedRole) || {};
    return h('section', { class: 'card stack rl-issued', 'aria-label': 'Day pass issued' },
      h('h2', { text: 'Day pass issued' }),
      h('div', { class: 'row' }, chip('clear', 'Issued'), i.downgraded ? chip('required', 'Downgraded to Front desk') : null, dp.sodDecision ? chip('review', 'SoD decision: ' + (dp.sodDecision === 'compensate' ? 'compensate' : 'accept on purpose') + ' · review ' + REVIEW_AT_SAVE) : null),
      h('p', { class: 'rl-sentence', text: 'Day pass issued to ' + dp.name + ' · ' + roleLabel(dp.role) + ' · expires ' + clock12(dp.shiftEnd) + ' + 30 min grace · magic link sent to their phone; TOTP on their own device' }),
      i.downgraded ? h('p', { class: 'rl-note', text: 'Issued as Front desk, not ' + roleLabel(i.requestedRole) + ': no verified ' + (wanted.licence || 'clinical') + ' credential on file for ' + dp.name + '. Nothing clinical was granted; clinical entitlements issue only after the credential is verified.' }) : null,
      h('div', { class: 'rl-chips' }, h('span', { class: 'small muted', text: 'Granted:' }), ...dp.entitlements.map((e) => chip('info', entLabel(e)))),
      h('div', { class: 'btnrow' }, btn('Sign in as this temp', { kind: 'reversible', testid: 'roles.daypass.signin', onClick: () => { P().set({ persona: 'temp' }); location.hash = '#/temp/board'; } })),
      h('details', null, h('summary', { testid: 'roles.daypass.expiry.why' }, 'What happens at expiry'), h('p', { class: 'hint', text: 'At ' + clock12(dp.shiftEnd) + ' + 30 min the grants lapse and the session is revoked. The account remains as a frozen name on everything it posted; issued by ' + dp.createdBy + ' for ' + (S().locations.find((l) => l.id === dp.locationId) || {}).name + '.' })));
  }

  // ---- Screen -------------------------------------------------------------------------------
  function render(r) {
    const s = state();
    const addBtn = btn(s.formOpen ? 'Close day pass form' : 'Add day pass', { kind: 'reversible', testid: 'roles.daypass.add', onClick: () => { s.formOpen = !s.formOpen; if (s.formOpen) s.issued = null; s.saveGate = null; rerender(r, s.formOpen ? 'roles.daypass.name' : 'roles.daypass.add'); } });
    addBtn.setAttribute('aria-expanded', String(s.formOpen));
    const page = h('div', { class: 'stack rl-page' },
      pageHead('Roles · Main Street', 'Who may do what; the controls sit in the grant, not on a dashboard.', addBtn),
      h('p', { class: 'small muted rl-digest', text: 'Day passes issued this month: ' + (DIGEST_BASE + S().dayPasses.length) + ' (practice)' }),
      s.formOpen ? dayPassForm(r) : null,
      issuedCard(),
      section('People and entitlements',
        h('p', { class: 'hint', text: 'Entitlements are listed per person; segregation-of-duties decisions are recorded, dated, and reviewed. Nothing here ranks or scores people.' }),
        peopleTable(r)));
    Proto.screens.shell.mount(page);
  }

  Proto.screens.roles = { render, remediate, decide, save: doSave };
  Proto.router.on('roles', (r) => Proto.screens.roles.render(r));
})();
