/* Exams to sign (dentist and surgeon home) and Encounter (flow 3): tags hoisted, paint once
   (chart event + procedure with pending charge + plan card + note line) with temporality set by a
   human, ranked starters, at most three rows to fix, one File button behind the read-back line.
   Features 8, 9, 10, 11, 12, 30. Odontogram arrow keys and M/O/D/B/L are active only while mounted. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, displayName, pageHead, longDate, dateTime } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const SURFACES = ['M', 'O', 'D', 'B', 'L'];
  const ANTERIOR = [6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27];
  const QUEUE_STATUS = ['seated', 'in_chart', 'ready_for_exam', 'checked_out_unfiled'];
  const PROCS = [['d2392', 'Composite 2-surf D2392'], ['d2740', 'Crown D2740'], ['d0120', 'Periodic exam D0120'], ['d7210', 'Surgical extraction D7210'], ['d9243', 'IV sedation D9243']];
  const SURGEON_FIRST = ['d7210', 'd9243'];
  const TEMPORALITY = [['today', 'Today'], ['planned', 'Planned'], ['existing', 'Existing']];
  const STARTERS = {
    caries: { label: 'Caries confirmed, composite today', a: (t, s) => 'Caries #' + t + ' ' + s + ' confirmed clinically and on BWX; asymptomatic; vitality normal.', p: (t, s) => 'Composite #' + t + ' ' + s + ' today under local; postoperative instructions given.' },
    recurrent: { label: 'Recurrent decay at margin', a: (t) => 'Recurrent decay at the margin of the existing restoration #' + t + '; asymptomatic.', p: (t) => 'Replace restoration #' + t + ' today under local; postoperative instructions given.' },
    fractured: { label: 'Fractured cusp', a: (t) => 'Fractured cusp #' + t + ', no pulpal exposure; asymptomatic to percussion.', p: (t) => 'Crown #' + t + '; core build-up as needed; temporized today.' },
    sedation: { label: 'Sedation: ASA II, IV midazolam, monitored per protocol', a: (t) => 'Referred for surgical extraction #' + t + '; ASA II; airway and medical history reviewed; sedation consented.', p: (t) => 'Surgical extraction #' + t + ' under IV sedation (midazolam), monitored per protocol; postoperative instructions given to patient and escort.' },
  };
  const MONEY_CUE = /\$\s?\d|\b(fees?|costs?|prices?|estimates?|copay(?:ment)?s?|dollars?)\b/i;
  const MONEY_REPLACEMENT = 'See plan card for the quoted amount.';

  // ---- per-screen state, cleared whenever the store is rebuilt -----------------------------
  let lastStore = null; let lastRoute = null; let keysOn = false; let lastMountKey = null;
  let st = {}; // encId -> { tooth, surfaces:[{s, mixed}], temporality, note:{assessment, plan}, checked, killers, readback, filed, dismissing:{tagId: reason}, quoted }
  const S = () => Proto.store.get();
  const P = () => window.__proto;
  function syncStore() { const s = S(); if (s !== lastStore) { lastStore = s; st = {}; handoff = null; } }
  /* A draft belongs to its author: the PIN switch on a shared device leaves each author's draft under their own key, so
     the next author starts clean and the first finds theirs again. The one exception is the read-back gate's own
     Switch author: it says "this work is the other person's", so the draft moves to the author the pad names (once,
     and only through that control) — otherwise the correction the gate offers drops the note it was meant to file. */
  let handoff = null;                                   // { encId, fromKey, draft } set by the read-back's Switch author
  function state(encId) {
    syncStore(); const k = encId + '|' + Proto.store.currentUser().id;
    if (handoff && handoff.encId === encId && handoff.fromKey !== k) { st[k] = handoff.draft; delete st[handoff.fromKey]; handoff = null; }
    if (!st[k]) st[k] = { tooth: null, surfaces: [], temporality: 'today', note: { assessment: '', plan: '' }, checked: false, killers: [], readback: false, filed: null, dismissing: {}, quoted: null };
    return st[k];
  }
  function switchAuthorWithDraft(r, enc, x) {
    const fromKey = enc.id + '|' + Proto.store.currentUser().id;
    Proto.screens.shell.openPinPad(r, { onSwitch: () => { handoff = { encId: enc.id, fromKey, draft: x }; } });
  }

  // ---- lookups ------------------------------------------------------------------------------
  const isSurgeon = () => P().persona === 'surgeon';
  const dentistLike = () => ['dentist', 'owner', 'surgeon'].includes(Proto.store.currentUser().role);
  const apptOf = (enc) => S().appointments.find((a) => a.id === enc.appointmentId);
  const providerShort = (uid) => (S().users.find((u) => u.id === uid) || {}).short || '—';
  /* A helper answers on ordinary, boundary and null input: a tag with no author used to print the word
     "undefined" in the Exams row, because the split of an empty string is length 1 and fell through. */
  function shortName(full) {
    const name = String(full == null ? '' : full).trim(); if (!name) return '—';
    const u = S().users.find((x) => x.name === name); if (u) return u.short;
    const p = name.split(/\s+/);
    return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : name;
  }
  const byLine = (author) => (author ? ' — ' + shortName(author) : '');
  const tagsOf = (encId) => S().tags.filter((t) => t.encounterId === encId);
  const openTags = (encId) => tagsOf(encId).filter((t) => !t.disposition);
  /* The live paints on this visit. A reversal and the event it supersedes both stay in chartEvents — the
     record is never trimmed — so the odontogram, the note starters and the paint list read the standing
     paints, not the whole log. */
  const eventsOf = (encId) => S().chartEvents.filter((c) => c.encounterId === encId && c.kind !== 'reversal' && !c.reversed);
  const filedOf = (encId) => S().filedNotes.filter((f) => f.encounterId === encId).pop() || null;
  const referralLine = (a) => a.referral ? 'Referred by ' + a.referral.from + ': ' + a.referral.reason + (a.referral.recordsForwarded ? '; records forwarded' : '; records not yet received') : null;
  const clock12 = Proto.ui.time;                       // one clock for every screen (ui.js)
  const surfLabel = (tooth, s) => (s === 'O' && ANTERIOR.includes(tooth)) ? 'I' : s;
  const surfWord = { M: 'Mesial', O: 'Occlusal', D: 'Distal', B: 'Buccal', L: 'Lingual', I: 'Incisal' };
  function scaffoldLine(ce) {
    const s = S();
    const name = (s.cdt[ce.cdt] || [ce.cdt])[0];
    const site = ce.tooth != null ? ' #' + ce.tooth + (ce.surfaces && ce.surfaces.length ? ' ' + ce.surfaces.join('') : '') : '';
    return name + site + (ce.temporality === 'existing' ? ' (existing, placed elsewhere)' : ce.temporality === 'planned' ? ' (planned)' : '');
  }

  // ---- mount with focus kept on the same control across re-renders of the same screen ---------
  /* Focus is restored only inside the same screen instance. Restoring it by test id across encounters
     put the cursor in the next encounter's Assessment field; the route then focused the h1, the field
     blurred, and that encounter's checks ran before anyone had touched it (C7). */
  function mount(node, key) {
    const active = document.activeElement; const holder = active && active.closest ? active.closest('[data-testid]') : null;
    const tid = (key != null && key === lastMountKey && holder) ? holder.getAttribute('data-testid') : null;
    lastMountKey = key;
    Proto.screens.shell.mount(node);
    if (tid) { const again = node.querySelector('[data-testid="' + tid + '"]'); if (again && again.focus) again.focus({ preventScroll: true }); }
  }
  function rerender(r) { r = r || lastRoute || Proto.router.current(); Proto.router.render(); Proto.screens.shell.refreshAndon(r); }
  // A mutation lands the keyboard on the result or the next control, never on the body (B10).
  function focusFirst(...tids) {
    for (const t of tids) { if (!t) continue; const el = document.querySelector('[data-testid="' + t + '"]'); if (el && el.focus) { el.focus({ preventScroll: true }); return true; } }
    return false;
  }
  // A gate that has just been raised lands the keyboard on its verb, one Tab from its control: focusing the control
  // let the Enter that raised the read-back confirm it (invariants-r2-8).
  function focusGateVerb() { const v = document.querySelector('#enc-gate .refusal .verb') || document.querySelector('#enc-gate h2'); if (!v) return false; v.setAttribute('tabindex', '-1'); v.focus({ preventScroll: true }); return true; }
  const focusId = (id) => { const el = document.getElementById(id); if (!el) return false; el.focus({ preventScroll: true }); return true; };
  // Below 1280 px the gate column is pinned over the bottom of the page, so a field it points at is scrolled above it.
  function reveal(el) {
    el.scrollIntoView({ block: 'center' });
    const gate = document.getElementById('enc-gate-area'); if (!gate) return;
    const g = gate.getBoundingClientRect(); const b = el.getBoundingClientRect();
    if (b.left < g.right && b.right > g.left && b.bottom > g.top) { const sc = document.getElementById('canvas') || document.scrollingElement; sc.scrollTop += b.bottom - g.top + 8; }
  }

  // =========================================================================================
  // Exams to sign
  // =========================================================================================
  const minutesOf = (t) => { const p = String(t == null ? '' : t).split(':').map(Number); return p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? p[0] * 60 + p[1] : null; };
  /* Waits are read off the clock and the row, never from a table of constants: the old list said
     "14 min" and "26 min" whatever the time was, and every chair with no entry said three. */
  function waitMinutes(a) {
    const now = minutesOf(S().clock.time); const since = minutesOf(a.arrivedAt || a.seatedAt || a.time);
    return now == null || since == null ? 0 : Math.max(0, now - since);
  }
  function queueRows() {
    const s = S(); const rows = [];
    for (const a of s.appointments) {
      if (a.locationId !== 'loc-1') continue;
      const enc = s.encounters.find((e) => e.id === a.encounterId); if (!enc || enc.noteFiled || enc.status === 'signed') continue;
      const tags = openTags(enc.id);
      const referred = isSurgeon() && a.id === 'a-1060';
      if (!QUEUE_STATUS.includes(a.status) && !tags.length && !referred) continue;
      const upcoming = a.status === 'confirmed' || a.status === 'scheduled';
      rows.push({ a, enc, tags, wait: waitMinutes(a), upcoming, referred });
    }
    const rank = (row) => row.upcoming ? -2 : row.a.status === 'checked_out_unfiled' ? -1 : row.wait;
    return rows.sort((x, y) => rank(y) - rank(x) || (x.a.time < y.a.time ? -1 : 1));
  }
  function waitText(row) {
    if (row.upcoming) return 'Arrives ' + clock12(row.a.time);
    if (row.a.status === 'checked_out_unfiled') return 'Out of chair · ' + clock12(row.a.time) + ' visit';
    const mins = row.wait < 1 ? 'Just seated' : 'Waiting ' + row.wait + ' min';
    if (row.a.status === 'ready_for_exam') { const order = S().appointmentEvents.filter((e) => e.kind === 'encounter.exam_requested').map((e) => e.appointmentId); const pos = order.indexOf(row.a.id); return mins + (pos >= 0 ? ' · exam requested, ' + (pos + 1) + (pos === 0 ? 'st' : pos === 1 ? 'nd' : pos === 2 ? 'rd' : 'th') + ' in queue' : ''); }
    return mins;
  }
  function whatWaits(row) {
    const notes = S().notes[row.enc.id] || {}; const parts = [];
    if (row.referred || row.a.referral) parts.push(referralLine(row.a));
    for (const t of row.tags) parts.push(t.text + byLine(t.author));
    if (notes.perioSummary) parts.push(notes.perioSummary.replace(/\.$/, ''));
    // One word for one act: the queue is named "Exams to sign", the act is File (A, vocabulary).
    if (row.a.status === 'checked_out_unfiled') parts.push('Checked out, note unfiled — filing releases the held payment');
    else if (row.a.status === 'in_chart' || row.a.status === 'ready_for_exam') parts.push('Ready to file');
    else if (!parts.length) parts.push('Seated, exam to open');
    return parts.join(' · ');
  }
  function practiceLine() {
    const n = S().filedNotes.length;
    return 'Practice today: ' + (n === 1 ? '1 note filed' : n + ' notes filed') + ' (practice level, nobody ranked)';
  }
  function renderExams(r) {
    lastRoute = r; detachKeys();
    const rows = queueRows(); const priv = P().privacy;
    const list = h('div', { class: 'worklist', role: 'list', 'aria-label': 'Exams to sign' });
    for (const row of rows) {
      const p = Proto.store.patient(row.a.patientId);
      list.append(h('div', { class: 'wrow', role: 'listitem', testid: 'exams.row.' + row.enc.id },
        h('div', null, h('div', { class: 'obj', text: displayName(p.name, priv) }), h('div', { class: 'small muted', text: 'Chair ' + row.a.op + ' · ' + providerShort(row.a.providerId) })),
        h('div', { class: 'enc-wait', text: waitText(row) }),
        // The imaging chip is the row's own flag, not the appointment type: it used to print on every
        // restorative row whether or not that chair had bitewings waiting.
        h('div', { class: 'why' }, h('div', { text: whatWaits(row) }), row.a.bwxDue ? h('div', { class: 'row', style: 'margin-top:4px' }, chip('review', 'Bitewings due')) : null),
        btn('Open', { kind: 'reversible', testid: 'exams.row.' + row.enc.id + '.open', ariaLabel: 'Open exam for ' + displayName(p.name, priv), onClick: () => Proto.router.go(r.persona, 'encounter', row.enc.id) })));
    }
    if (!rows.length) list.append(h('p', { class: 'muted', text: 'Nothing to file. Rows leave only by filing.' }));
    mount(h('div', { class: 'stack enc-page' },
      pageHead('Exams to sign', rows.length ? rows.length + ' waiting · ordered by time in chair' : 'Hygiene findings, notes awaiting your licence, imaging awaiting interpretation'),
      list,
      h('p', { class: 'small muted practice-line', text: practiceLine() })), 'exams');
  }

  // =========================================================================================
  // Encounter
  // =========================================================================================
  function renderEncounter(r) {
    lastRoute = r; const enc = Proto.store.encounter(r.id);
    // One heading for one concept: an id in the address that names no row is the Nothing-here screen,
    // the same words the shell uses, with the store's own sentence under it (§6 notfound).
    if (!enc) {
      detachKeys();
      const nf = Proto.store.notFound('encounter');
      mount(h('div', { class: 'stack' }, h('h1', { text: 'Nothing here' }), h('p', { class: 'muted', text: nf.why }),
        btn('Back to home', { testid: 'notfound.home', kind: 'quiet', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) })), 'encounter:notfound');
      return;
    }
    const a = apptOf(enc); const p = Proto.store.patient(enc.patientId); const x = state(enc.id);
    const priv = P().privacy;
    // The h1 names the place, then the person, like every other route (C1).
    const head = pageHead('Encounter · ' + displayName(p.name, priv), 'DOS ' + longDate(enc.dos) + ' · ' + providerShort(enc.providerId) + (a ? ' · Chair ' + a.op + ' · ' + a.type[0].toUpperCase() + a.type.slice(1) : '') + (priv ? '' : ' · DOB ' + longDate(p.dob)),
      Proto.screens.rail ? Proto.screens.rail.button(enc.patientId, r, 'enc.rail') : null,
      btn('Back to Exams', { testid: 'enc.back', kind: 'reversible', onClick: () => Proto.router.go(r.persona, 'exams') }));
    const filed = filedOf(enc.id);
    if (enc.noteFiled || filed) { detachKeys(); mount(h('div', { class: 'stack enc-page' }, head, renderFiledCard(enc, filed, x)), 'encounter:' + enc.id); return; }
    attachKeys();
    // The filing gate is its own grid child so the stylesheet can pin it in view below 1280 px, where the
    // chart, the note and the gate stack in one column and File sat 1,300 px under the fold.
    const chart = h('div', { class: 'stack enc-col-chart' }, renderTags(r, enc, x), renderOdontogram(r, enc, x), renderTransactions(r, enc, x));
    const note = h('div', { class: 'stack enc-col-note' }, renderNote(r, enc, x));
    mount(h('div', { class: 'stack enc-page' }, head, a && a.referral ? h('div', { class: 'card flat' }, chip('info', 'Referral'), ' ', referralLine(a)) : null, h('div', { class: 'enc-layout' }, chart, note, renderGate(r, enc, x))), 'encounter:' + enc.id);
  }
  /* A gate this screen renders from a store refusal: one verb line, one control, and the control does what its
     label says (the support line, the undo, the procedure strip, the dentist's queue), never only a re-render. */
  // The store's control words, each doing the thing it names (the same words the Phone and Perio act on).
  const BY_WORD = {
    'Switch author': (r) => Proto.screens.shell.openPinPad(r),
    'Open Roles': () => { location.hash = '#/owner/roles'; },   // the seat that issues a pass
    'Open the note': (r, enc) => Proto.router.go(r.persona, 'encounter', enc.id),
    'Open the ledger': (r, enc) => Proto.router.go(r.persona, 'ledger', enc.patientId),
    'Open the procedure list': () => focusFirst('enc.proc.' + PROCS[0][0]),
  };
  function gateNode(r, enc, x, res, fallback) {
    const act = res.code === 'outage' ? () => (Proto.ui.support ? Proto.ui.support() : Proto.router.announce('Call support: 615-555-0100, 7 am to 6 pm'))
      : res.code === 'duplicate_paint' ? (res.undoable ? () => { x.gateNode = null; undo(r, enc, x, res.chartEventId); } : () => focusFirst('enc.proc.' + PROCS[0][0]))
      : BY_WORD[res.control] ? () => BY_WORD[res.control](r, enc, x)
      : res.code === 'licence_scope' ? () => { x.gateNode = null; fixKiller(r, enc, x, { fix: 'licence' }); }
      : fallback || (() => focusFirst('enc.tooth.' + (openTags(enc.id)[0] || { tooth: 30 }).tooth, 'enc.tooth.30', 'enc.back'));
    return refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why, severity: res.code === 'outage' ? 'stop' : undefined, onControl: act });
  }

  // ---- tags ---------------------------------------------------------------------------------
  function renderTags(r, enc, x) {
    const tags = tagsOf(enc.id);
    const body = tags.length ? tags.map((t) => renderTag(r, enc, x, t)) : [h('p', { class: 'muted small', text: 'No hygienist tags on this encounter.' })];
    const sec = Proto.ui.section('Hygienist tags', ...body); sec.id = 'enc-tags'; return sec;
  }
  function renderTag(r, enc, x, t) {
    const row = h('div', { class: 'enc-tagrow' }, h('div', { class: 'row between' }, h('span', null, h('b', { text: t.text }), h('span', { class: 'muted small', text: byLine(t.author) })),
      t.disposition === 'charted' ? chip('clear', 'Charted') : t.disposition === 'dismissed' ? chip('info', 'Dismissed') : chip('required', 'Needs disposition')));
    if (t.disposition === 'dismissed') { row.append(h('div', { class: 'small muted', text: 'Reason: ' + (t.reason || '—') + (t.dispositionBy ? ' · ' + shortName(t.dispositionBy) : '') })); return row; }
    if (t.disposition) return row;
    const dismissing = x.dismissing[t.id] != null;
    // Dismissing is the dentist's disposition (store.js dismissTag refuses anyone else), so only they are offered it.
    const controls = h('div', { class: 'btnrow' },
      btn('Chart it', { kind: 'reversible', testid: 'enc.tag.' + t.id + '.chart', onClick: () => chartTag(r, enc, x, t) }),
      dentistLike() ? btn(dismissing ? 'Dismiss with reason' : 'Dismiss', { kind: 'quiet', testid: 'enc.tag.' + t.id + '.dismiss', onClick: () => dismissTag(r, enc, x, t) }) : h('span', { class: 'small muted', text: 'Dismissed only by the dentist' }));
    row.append(controls);
    if (dismissing) {
      const input = h('input', { class: 'input', type: 'text', id: 'reason-' + t.id, testid: 'enc.tag.' + t.id + '.reason', 'aria-label': 'One-line reason for dismissing the tag', placeholder: 'One line: what you saw instead', value: x.dismissing[t.id], onInput: (ev) => { x.dismissing[t.id] = ev.target.value; }, maxlength: '120' });
      row.append(h('div', { class: 'field' }, h('label', { for: 'reason-' + t.id, text: 'Reason (one line)' }), input));
      if (x.dismissing[t.id] === '' && x.dismissTried) row.append(refusal({ code: 'reason_required', verb: 'Give a one-line reason', control: 'Type the reason', onControl: () => input.focus(), why: 'A dismissed hygienist finding stays in the record with why it was dismissed; the hygienist sees the reason on her card.' }));
    }
    return row;
  }
  function chartTag(r, enc, x, t) {
    x.tooth = t.tooth; x.surfaces = (t.surfaces || []).map((s) => ({ s: s.toUpperCase(), mixed: true }));
    rerender(r);
    const od = document.getElementById('enc-odont'); if (od) od.scrollIntoView({ block: 'start', behavior: P().motion === 'reduced' ? 'auto' : 'smooth' });
    focusFirst('enc.tooth.' + t.tooth);
    const sf = (t.surfaces || []).join(' ');
    Proto.router.announce('Selected #' + t.tooth + ' from the tag' + (sf ? ' · surfaces ' + sf : ''));
  }
  function dismissTag(r, enc, x, t) {
    if (x.dismissing[t.id] == null) { x.dismissing[t.id] = ''; x.dismissTried = false; rerender(r); const i = document.getElementById('reason-' + t.id); if (i) i.focus(); return; }
    const reason = (x.dismissing[t.id] || '').trim();
    if (!reason) { x.dismissTried = true; rerender(r); return; }
    // The store writes the disposition and logs the tags change; a screen never edits a row itself (A3, A5).
    const res = Proto.store.dismissTag(t.id, reason);
    if (!res.ok) { x.gateNode = gateNode(r, enc, x, res, () => focusFirst('enc.tag.' + t.id + '.reason')); rerender(r); focusFirst('refusal.control'); return; }
    delete x.dismissing[t.id];
    if (x.checked) x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3);
    rerender(r);
    const next = openTags(enc.id)[0];
    focusFirst(next ? 'enc.tag.' + next.id + '.chart' : null, 'enc.note.field.assessment', 'enc.file');
    Proto.router.announce('Dismissed the tag · ' + reason);
  }

  // ---- odontogram, surfaces, procedures, temporality ----------------------------------------
  function renderOdontogram(r, enc, x) {
    const ces = eventsOf(enc.id); const tagged = openTags(enc.id).map((t) => t.tooth);
    // The gate belongs to its cause and falls with it: a tooth picked, the server back (stale-gate rule).
    const gc = x.gateNode && x.gateNode.dataset.code;
    if ((gc === 'tooth_required' && x.tooth) || (gc === 'outage' && !S().outage) || (gc === 'entitlement' && !Proto.store.currentUser().noPass)) x.gateNode = null;
    const toothBtn = (n) => {
      const has = ces.some((c) => c.tooth === n); const isTag = tagged.includes(n); const sel = x.tooth === n;
      // Charted is never colour alone: the tooth carries a mark and a fill as well as its rail (B5).
      return h('button', { type: 'button', class: 'tooth' + (has ? ' has' : '') + (isTag ? ' enc-tagged' : ''), testid: 'enc.tooth.' + n,
        style: has && !sel ? 'background: var(--style-soft)' : null,
        'aria-pressed': sel ? 'true' : 'false', 'aria-label': 'Tooth ' + n + (has ? ', charted' : '') + (isTag ? ', tagged by hygienist' : ''),
        onClick: () => { if (x.tooth !== n) { x.tooth = n; x.surfaces = []; } rerender(r); } },
      String(n), has ? h('span', { 'aria-hidden': 'true', style: 'position:absolute;left:4px;top:2px;font-size:10px;line-height:1', text: '●' }) : null);
    };
    const upper = h('div', { class: 'odont', role: 'group', 'aria-label': 'Upper arch, teeth 1 to 16' }, ...Array.from({ length: 16 }, (_, i) => toothBtn(i + 1)));
    const lower = h('div', { class: 'odont', role: 'group', 'aria-label': 'Lower arch, teeth 32 to 17' }, ...Array.from({ length: 16 }, (_, i) => toothBtn(32 - i)));
    const sel = x.tooth ? 'Selected: #' + x.tooth + (x.surfaces.length ? ' · ' + x.surfaces.map((o) => surfLabel(x.tooth, o.s)).join(' ') : '') : 'Selected: none — tap a tooth';
    // Surfaces belong to a tooth, so they appear once one is picked: the strip used to render as
    // enc.surface.0.<s> on every encounter, a tooth segment outside the §4 pattern (B1).
    const surfaces = x.tooth ? h('div', { class: 'surfaces', role: 'group', 'aria-label': 'Surfaces for tooth ' + x.tooth }, ...SURFACES.map((sf) => {
      const cur = x.surfaces.find((o) => o.s === sf); const lbl = surfLabel(x.tooth, sf);
      return btn(lbl, { kind: 'quiet', testid: 'enc.surface.' + x.tooth + '.' + sf.toLowerCase(), pressed: cur ? (cur.mixed ? 'mixed' : 'true') : 'false', ariaLabel: surfWord[lbl] + (cur && cur.mixed ? ', suggested by the tag, tap to confirm' : ''), onClick: () => toggleSurface(r, enc, x, sf) });
    })) : null;
    const procs = (isSurgeon() ? PROCS.slice().sort((p1, p2) => (SURGEON_FIRST.includes(p2[0]) ? 1 : 0) - (SURGEON_FIRST.includes(p1[0]) ? 1 : 0)) : PROCS);
    const strip = h('div', { class: 'btnrow', role: 'group', 'aria-label': 'Procedures, ranked for this tooth type; nothing is pre-selected' }, ...procs.map(([code, label]) => btn(label, { kind: 'reversible', testid: 'enc.proc.' + code, onClick: () => paint(r, enc, x, code) })));
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Temporality' }, ...TEMPORALITY.map(([k, w]) => btn(w, { testid: 'enc.temporality.' + k, pressed: x.temporality === k ? 'true' : 'false', onClick: () => { x.temporality = k; rerender(r); } })));
    const sec = Proto.ui.section('Chart',
      h('div', { class: 'enc-odont-wrap' }, upper, lower),
      h('div', { class: 'activesite', id: 'enc-selected', 'aria-live': 'polite', text: sel }),
      x.tooth ? h('p', { class: 'small muted', text: 'Tap a dashed surface to confirm, again to remove' }) : null,
      surfaces,
      h('h3', { text: 'Procedure' }), strip,
      h('h3', { text: 'When' }), seg,
      h('p', { class: 'small muted', text: 'Today charges at File · Planned estimates · Existing is history' }),
      x.gateNode || null);
    sec.id = 'enc-odont'; return sec;
  }
  function toggleSurface(r, enc, x, sf) {
    if (!x.tooth) { x.gateNode = refusal({ code: 'tooth_required', verb: 'Pick a tooth first', control: 'Go to teeth', onControl: () => focusFirst('enc.tooth.30'), why: 'Surfaces belong to a tooth; the chart event needs both.' }); rerender(r); return; }
    const i = x.surfaces.findIndex((o) => o.s === sf);
    if (i < 0) x.surfaces.push({ s: sf, mixed: false }); else if (x.surfaces[i].mixed) x.surfaces[i].mixed = false; else x.surfaces.splice(i, 1);
    x.gateNode = null; rerender(r);
  }
  function paint(r, enc, x, code) {
    x.undoGate = null; x.fileGate = null;               // one live gate per screen: a new attempt supersedes the last
    // One code, one verb: the tooth gate reads the same wherever it is raised (B4). A service that belongs to
    // the visit (exam, prophy, sedation) carries no tooth, so it is charted with none picked.
    if (!x.tooth && !Proto.store.wholePatient(code)) { x.gateNode = refusal({ code: 'tooth_required', verb: 'Pick a tooth first', control: 'Go to teeth', onControl: () => focusFirst('enc.tooth.' + (openTags(enc.id)[0] || { tooth: 30 }).tooth, 'enc.tooth.30'), why: 'The procedure strip never auto-selects and never guesses a tooth; the chart event, plan item, and pending charge all point at the tooth you pick.' }); rerender(r); focusFirst('refusal.control'); return; }
    const surfaces = x.surfaces.map((o) => o.s);
    const res = Proto.store.chartPaint(enc.id, x.tooth, surfaces, code, x.temporality);
    if (!res.ok) { x.gateNode = gateNode(r, enc, x, res); rerender(r); focusFirst('refusal.control'); return; }
    x.gateNode = null; x.undoGate = null; x.lastPaint = res; x.surfaces = x.surfaces.map((o) => ({ s: o.s, mixed: false }));
    if (x.checked) x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3);
    rerender(r);
    Proto.router.announce('Charted ' + scaffoldLine(res.chartEvent) + (res.procedure ? ' · pending charge ' + money(res.procedure.feeCents) : ''));
  }

  // ---- transaction cards ---------------------------------------------------------------------
  function renderTransactions(r, enc, x) {
    const s = S(); const ces = eventsOf(enc.id).slice().reverse();
    // Procedures the visit carried before the chart was opened release at File like any paint. Hiding them let
    // the same exam be charted again and billed twice.
    const carried = s.procedures.filter((p) => p.encounterId === enc.id && !p.chartEventId && !p.reversed);
    if (!ces.length && !carried.length) return null;
    const carriedCards = carried.map((p) => {
      const name = (s.cdt[p.cdt] || [p.cdt])[0] + (p.tooth ? ' #' + p.tooth : ''); const done = Proto.store.charged(p);
      return h('div', { class: 'card enc-tx stack', 'aria-label': 'On the visit · ' + name },
        h('div', { class: 'row between' }, h('b', { text: 'On the visit before the chart opened' }), chip(done ? 'clear' : 'style', done ? 'Charged' : 'Today')),
        h('ul', { class: 'enc-rows' }, h('li', null, h('b', { text: 'Procedure ' }), p.cdt.toUpperCase() + ' ' + name + ' · ' + money(p.feeCents) + (done ? ' charged' : ' pending charge, released at File'))));
    });
    const cards = ces.map((ce, i) => {
      const proc = s.procedures.find((p) => p.chartEventId === ce.id);
      const plan = s.planItems.slice().reverse().find((pl) => pl.encounterId === enc.id && !pl.reversed && pl.tooth === ce.tooth && pl.cdt === ce.cdt && pl.temporality === ce.temporality);
      const fee = (s.cdt[ce.cdt] || [null, 0])[1];
      // Storage ids stay off the glass: a chart event, a procedure, a plan item and a note are named by
      // what they say, not by ce-1 / pr-500 / pl-1 (C3).
      const card = h('div', { class: 'card enc-tx stack', 'aria-label': 'Transaction · ' + scaffoldLine(ce) },
        h('div', { class: 'row between' }, h('b', { text: 'One paint, one transaction' }), chip(ce.temporality === 'today' ? 'style' : ce.temporality === 'planned' ? 'review' : 'info', TEMPORALITY.find((t) => t[0] === ce.temporality)[1])),
        h('ul', { class: 'enc-rows' },
          h('li', null, h('b', { text: 'Chart event ' }), scaffoldLine(ce) + byLine(ce.author)),
          h('li', null, h('b', { text: 'Procedure ' }), proc ? ce.cdt.toUpperCase() + ' ' + (s.cdt[ce.cdt] || [ce.cdt])[0] + ' · ' + money(proc.feeCents) + ' pending charge, released at File' : (ce.temporality === 'existing' ? 'none: Existing is history, no charge, no claim' : 'none until performed and filed (Planned)')),
          h('li', null, h('b', { text: 'Note ' }), (s.notes[enc.id] && s.notes[enc.id].procedure) || scaffoldLine(ce))),
        plan ? renderPlanCard(plan, fee, x) : null,
        i === 0 ? renderUndo(r, enc, x) : null);
      return card;
    });
    return h('div', { class: 'stack' }, ...cards, ...carriedCards);
  }
  function renderPlanCard(plan, fee, x) {
    const owe = plan.estimateCents; const pays = Math.max(0, fee - owe);
    return h('div', { class: 'card flat stack', 'aria-label': 'Plan card' },
      h('div', { class: 'row between' }, h('b', { text: 'Plan card' }), x.quoted && x.quoted.planId === plan.id ? chip('info', 'Quoted') : null),
      x.quoted && x.quoted.planId === plan.id ? h('div', { class: 'small muted', text: 'Quoted to the patient ' + longDate(x.quoted.date) }) : null,
      h('div', { class: 'threenum' }, num(money(fee), 'Fee'), num(money(pays), 'Your plan pays about'), num(money(owe), "You'd owe about")),
      h('details', null, h('summary', { testid: 'enc.plan.' + plan.id + '.why' }, 'Why'), h('div', { class: 'small muted', text: plan.ruleTrace + '. This is an estimate until the plan pays; it never joins the balance.' })));
  }
  const num = (v, l) => h('div', { class: 'n' }, h('div', { class: 'v', text: v }), h('div', { class: 'l', text: l }));
  /* Undo reverses the last paint through Proto.store.chartUndo: a reversing chart event is appended, the
     procedure and plan item are marked reversed, the note line is withdrawn and the tag goes back to open.
     Nothing is deleted (A5; docs/13 feature 10). The screen used to splice the rows out of their tables and
     log one write for an id no table held, which erased part of a clinical record and left the note line
     behind, so the next paint filed the same procedure line twice. */
  function renderUndo(r, enc, x) {
    if (staleGate(x.undoGate)) x.undoGate = null;
    if (!x.undoGate) return btn('Undo last paint', { kind: 'reversible', testid: 'enc.undo', onClick: () => undo(r, enc, x) });
    return h('div', { class: 'stack' },
      gateNode(r, enc, x, x.undoGate, () => focusFirst('enc.note.field.assessment')),
      // A Held press re-evaluates first: if the gate has fallen (the outage ended), the press reverses the paint.
      btn('Undo last paint', { kind: 'held', testid: 'enc.undo', ariaLabel: 'Held: ' + x.undoGate.verb, onClick: () => { rerender(r); if (x.undoGate) focusFirst('refusal.control', 'enc.note.field.assessment'); else undo(r, enc, x); } }));
  }
  // `ceId` names the paint to reverse (the duplicate's original from chartPaint's refusal); without it, the last one.
  function undo(r, enc, x, ceId) {
    x.gateNode = null; x.fileGate = null;               // one live gate per screen
    const res = Proto.store.chartUndo(enc.id, ceId);
    // With no standing paint there is no card to carry the gate, so it stands in the Chart section instead.
    if (!res.ok) { if (eventsOf(enc.id).length) x.undoGate = res; else x.gateNode = gateNode(r, enc, x, res); rerender(r); focusFirst('enc.undo', 'refusal.control'); return; }
    x.undoGate = null;
    x.tooth = null; x.surfaces = [];
    if (x.checked) x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3);
    rerender(r);
    focusFirst('enc.undo', 'enc.note.field.assessment');
    Proto.router.announce('Reversed ' + (res.reversal ? scaffoldLine(res.reversal) : 'the last paint'));
  }

  // ---- note ---------------------------------------------------------------------------------
  function starterTooth(enc, x) { if (x.tooth) return x.tooth; const ces = eventsOf(enc.id).filter((c) => c.tooth != null); if (ces.length) return ces[ces.length - 1].tooth; const t = openTags(enc.id)[0]; return t ? t.tooth : '[tooth]'; }
  function starterSurfaces(enc, x) { if (x.surfaces.length) return x.surfaces.map((o) => o.s).join(''); const ces = eventsOf(enc.id).filter((c) => c.tooth != null); if (ces.length && ces[ces.length - 1].surfaces && ces[ces.length - 1].surfaces.length) return ces[ces.length - 1].surfaces.join(''); const t = openTags(enc.id)[0]; return t && t.surfaces ? t.surfaces.join('') : 'DO'; }
  function starters() { return isSurgeon() ? ['sedation', 'caries', 'recurrent', 'fractured'] : ['caries', 'recurrent', 'fractured']; }
  function renderNote(r, enc, x) {
    const s = S(); const notes = s.notes[enc.id] || {}; const locked = !dentistLike();
    const field = (id, label, value) => {
      const ta = h('textarea', { class: 'input', id: 'note-' + id, testid: 'enc.note.field.' + id, 'aria-label': label + (locked ? ' (dentist only)' : ''), readonly: locked, value: null,
        onInput: (ev) => { x.note[id] = ev.target.value; }, onBlur: (ev) => onNoteBlur(r, enc, x, ev) });
      ta.value = value || '';
      return h('div', { class: 'field' }, h('label', { for: 'note-' + id }, label, locked ? h('span', { class: 'muted', text: ' · Dentist' }) : null), ta);
    };
    const starterBtns = starters().map((k, i) => btn(STARTERS[k].label, { kind: 'quiet', class: 'enc-starter', testid: 'enc.note.starter.' + i, onClick: () => applyStarter(r, enc, x, k) }));
    return Proto.ui.section('Note',
      h('p', { class: 'small muted', text: 'Starters fill both fields; money lives on the plan card' }),
      h('div', { class: 'btnrow', role: 'group', 'aria-label': 'Starters' }, ...starterBtns),
      field('assessment', 'Assessment', x.note.assessment),
      field('plan', 'Plan', x.note.plan),
      notes.procedure ? h('div', { class: 'enc-readonly small' }, h('b', { text: 'Procedure (from the chart): ' }), notes.procedure) : null,
      notes.perioSummary ? h('div', { class: 'enc-readonly small' }, h('b', { text: 'Perio (from the exam, read-only): ' }), notes.perioSummary, notes.srpEvidence ? ' ' + notes.srpEvidence : '') : null);
  }
  function applyStarter(r, enc, x, k) {
    if (!dentistLike()) { Proto.router.announce('Only a dentist writes Assessment and Plan'); return; }
    const t = starterTooth(enc, x); const sf = starterSurfaces(enc, x);
    x.note.assessment = STARTERS[k].a(t, sf); x.note.plan = STARTERS[k].p(t, sf);
    if (x.checked) x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3);
    rerender(r); const ta = document.getElementById('note-assessment'); if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); }
    Proto.router.announce('Starter filled Assessment and Plan for #' + t);
  }
  function onNoteBlur(r, enc, x, ev) {
    // A field that is being torn down by a re-render is not a person leaving a field.
    if (ev && ev.target && ev.target.isConnected === false) return;
    x.checked = true; x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3);
    // Swap the gate in place so the next field keeps focus. Never swap while focus is moving INTO the gate:
    // replacing the File button between mousedown and mouseup would swallow the click.
    const swap = () => { const gate = document.getElementById('enc-gate-area'); if (gate) gate.replaceWith(renderGate(r, enc, x)); };
    const to = ev && ev.relatedTarget;
    if (to && to.closest && to.closest('#enc-gate-area')) return;
    if (to) swap(); else setTimeout(() => { if ((lastRoute || {}).id === enc.id && Proto.router.current().route === 'encounter' && !(document.activeElement && document.activeElement.closest('#enc-gate-area'))) swap(); }, 220);
  }

  // ---- filing gate: at most three rows to fix + one File -------------------------------------
  // One stale-gate rule for File, Send and Undo: a gate whose cause is gone falls on the next render.
  const staleGate = (g) => !!g && g.code === 'outage' && !S().outage;
  // The chair is already in the dentist's queue: the Send killer reads as done, and a repeat writes nothing (A4).
  const sentToExams = (enc) => { const a = apptOf(enc); return !!a && (a.status === 'ready_for_exam' || S().appointmentEvents.some((e) => e.appointmentId === a.id && e.kind === 'encounter.exam_requested')); };
  const isSent = (k, enc) => k.fix === 'licence' && (!!k.sent || sentToExams(enc));
  function renderGate(r, enc, x) {
    // One gate, one 44 px control: the read-back used to carry three (Confirm and file, Switch author and
    // the held File). The gate card holds the gate; the author line and the primary stand beside it (§6).
    const area = h('div', { class: 'stack enc-gate-col', id: 'enc-gate-area' });
    const wrap = h('div', { class: 'card stack', id: 'enc-gate', 'aria-label': 'Filing gate' });
    area.append(wrap);
    // A File the store refused outright (outage, sealed note) stands here, beside the primary it held (§6),
    // and clears with the condition that raised it so the primary comes back when the server does.
    if (staleGate(x.fileGate)) x.fileGate = null;
    if (staleGate(x.sendGate)) x.sendGate = null;
    if (x.fileGate) {
      wrap.append(gateNode(r, enc, x, x.fileGate, () => focusFirst('enc.back')));
      // A Held press re-evaluates first: if the gate has fallen (the outage ended), the press files.
      area.append(btn('File', { kind: 'held', testid: 'enc.file', ariaLabel: 'Held: ' + x.fileGate.verb, onClick: () => { rerender(r); if (x.fileGate) focusFirst('refusal.control'); else doFile(r, enc, x, false); } }));
      return area;
    }
    const total = x.checked ? Proto.store.noteKillers(enc.id, x.note).length : 0;
    // A store refusal from Send to Exams to sign renders here with its own control; the screen's own gates carry theirs.
    if (x.sendGate) wrap.append(x.sendGate.onControl ? refusal(x.sendGate) : gateNode(r, enc, x, x.sendGate, () => focusFirst('enc.back')));
    if (x.checked && x.killers.length) {
      const open = x.killers.filter((k) => !isSent(k, enc)).length;
      wrap.append(h('div', { class: 'row between' }, h('h2', { text: 'Before File' }),
        h('span', { class: 'row' }, open ? chip('required', open + ' to fix') : chip('clear', 'Sent'), total > 3 ? h('span', { class: 'small muted', text: 'of ' + total }) : null)),
        h('div', { class: 'killer' }, ...x.killers.map((k, i) => killerRow(r, enc, x, k, i))));
    } else if (x.checked) wrap.append(h('div', { class: 'row' }, chip('clear', 'Nothing outstanding'), h('span', { class: 'small muted', text: 'File runs the same checks server-side' })));
    else wrap.append(h('p', { class: 'small muted', text: 'Checks run when you leave a field' }));
    const p = Proto.store.patient(enc.patientId); const ces = eventsOf(enc.id); const lastCe = ces[ces.length - 1];
    const priv = P().privacy;
    const site = lastCe && lastCe.tooth != null ? ' · #' + lastCe.tooth + ' ' + (lastCe.surfaces || []).join('') : '';
    // One patient, one way of naming them, and one date shape (B4, B7).
    const detail = 'Filing as ' + Proto.store.currentUser().name + ' for ' + displayName(p.name, priv) + (priv ? '' : ' · DOB ' + longDate(p.dob)) + site;
    if (x.readback && !(x.checked && x.killers.length)) {
      const res = Proto.store.fileNote(enc.id, x.note, false);
      if (res.ok === false && res.code === 'readback') {
        wrap.append(refusal({ code: res.code, verb: res.verb, control: res.control, controlKind: 'irreversible', why: res.why, severity: 'info', onControl: () => doFile(r, enc, x, true) }));
        area.append(h('div', { class: 'row' }, h('span', { class: 'small muted grow', text: detail }), btn('Switch author', { kind: 'reversible', testid: 'enc.readback.switch', onClick: () => switchAuthorWithDraft(r, enc, x) })),
          btn('Confirm the read-back', { kind: 'held', testid: 'enc.file', ariaLabel: 'Held: confirm the read-back', onClick: () => focusFirst('refusal.control') }));
        return area;
      }
      if (res.killers) { x.killers = res.killers; x.checked = true; x.readback = false; return renderGate(r, enc, x); }
    }
    if (x.checked && x.killers.length) area.append(btn('Fix the rows above, then File', { kind: 'held', testid: 'enc.file', ariaLabel: 'Held: fix the rows above, then File', onClick: () => doFile(r, enc, x, false) }));
    else area.append(h('div', { class: 'stack' }, btn('File', { kind: 'irreversible', testid: 'enc.file', ariaLabel: 'File the note: freezes text, releases charges, queues the claim', onClick: () => doFile(r, enc, x, false) }), h('span', { class: 'small muted', text: detail })));
    return area;
  }
  function killerRow(r, enc, x, k, i) {
    // Sent already: the row is the stamp the send lands the keyboard on, not a second Send (Enter-twice rule).
    if (isSent(k, enc)) return h('div', { class: 'row', id: 'enc-sent', tabindex: '-1', 'aria-label': 'Sent to Exams to sign' }, chip('clear', 'Sent to Exams to sign'), h('span', { class: 'small muted grow', text: k.sent ? k.verb : 'Wait for the dentist to file' }), btn(k.sent && k.control ? k.control : 'Back to Chairs', { kind: 'quiet', testid: 'enc.killer.' + i + '.fix', onClick: () => Proto.router.go(r.persona, 'chairs') }));
    const node = refusal({ code: k.code, verb: k.verb, control: k.control, why: KILLER_WHY[k.fix] || 'The same list runs server-side at File.', severity: k.fix === 'contradiction' ? 'stop' : 'required', onControl: () => fixKiller(r, enc, x, k) });
    const c = node.querySelector('[data-testid="refusal.control"]'); if (c) c.setAttribute('data-testid', 'enc.killer.' + i + '.fix');
    return node;
  }
  const KILLER_WHY = {
    tag: 'A hygienist finding leaves the record only by being charted or dismissed with a reason; it cannot be filed over.',
    money: 'Clinical text is exported on records requests; quoted amounts live on the plan card with the date, never in the note.',
    contradiction: 'Chart, note, and claim must name the same tooth. The fix writes the chart tooth into the note; the chart event is the human-painted source.',
    assessment: 'An empty assessment is the top content gap in closed claims; File needs the finding in your words.',
    licence: 'Assessment and Plan carry a dentist\'s licence. Sending to Exams to sign puts this chair in the dentist\'s queue.',
  };
  function fixKiller(r, enc, x, k) {
    x.sendGate = null;
    if (k.fix === 'tag') { const t = document.getElementById('enc-tags'); if (t) { t.scrollIntoView({ block: 'start' }); const b = t.querySelector('[data-testid$=".chart"]'); if (b) b.focus({ preventScroll: true }); } return; }
    if (k.fix === 'money') {
      const strip = (txt) => { const parts = (txt || '').split(/(?<=[.;!?])\s+/); let used = false; const out = []; for (const sen of parts) { if (MONEY_CUE.test(sen)) { if (!used) { out.push(MONEY_REPLACEMENT); used = true; } } else if (sen.trim()) out.push(sen); } return out.join(' '); };
      x.note.assessment = strip(x.note.assessment); x.note.plan = strip(x.note.plan);
      const plan = S().planItems.slice().reverse().find((pl) => pl.encounterId === enc.id); x.quoted = { planId: plan ? plan.id : null, date: S().tenant.today };
      x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3); rerender(r);
      focusGateVerb() || focusFirst('enc.file'); Proto.router.announce('Moved to plan card'); return;
    }
    if (k.fix === 'contradiction') {
      // The tooth comes from the killer row itself; reading it back out of the verb broke the moment the
      // verb was rewritten, and the fix silently did nothing.
      const m = String(k.verb || '').match(/#(\d{1,2})/);
      const chartTooth = k.chartTooth != null ? String(k.chartTooth) : m ? m[1] : null; if (!chartTooth) return;
      const bad = (k.badTeeth && k.badTeeth.length ? k.badTeeth : (k.noteTooth != null ? [k.noteTooth] : [])).map(Number);
      const fix = (txt) => (txt || '').replace(/#(\d{1,2})\b/g, (all, n) => (bad.length ? (bad.indexOf(Number(n)) >= 0 ? '#' + chartTooth : all) : (n === chartTooth ? all : '#' + chartTooth))).replace(/\btooth\s+(\d{1,2})\b/gi, (all, n) => (bad.indexOf(Number(n)) >= 0 ? 'tooth ' + chartTooth : all));
      x.note.assessment = fix(x.note.assessment); x.note.plan = fix(x.note.plan);
      x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3); rerender(r);
      focusGateVerb() || focusFirst('enc.file'); Proto.router.announce('Note now says #' + chartTooth + ', matching the chart'); return;
    }
    if (k.fix === 'assessment') {
      const ta = document.getElementById('note-assessment');
      // A read-only field takes no keys: for a seat that does not write the assessment the way through is the Send row.
      if (ta && ta.readOnly) { const v = document.querySelector('#enc-gate .refusal[data-code="licence_scope"] .verb'); if (v) { v.setAttribute('tabindex', '-1'); v.focus({ preventScroll: true }); } Proto.router.announce('Only a dentist writes the assessment — send to Exams to sign'); return; }
      if (ta) { reveal(ta); ta.focus({ preventScroll: true }); } return;
    }
    if (k.fix === 'licence') {
      // A repeated press does not write a second request (A4): the chair is already in the queue.
      if (sentToExams(enc)) {
        x.sendGate = { code: 'already_decided', verb: 'Wait for the dentist to open it', control: 'Back to Chairs', severity: 'info', onControl: () => Proto.router.go(r.persona, 'chairs'), why: 'This chair is already in the dentist\'s queue with its place in line. Asking twice does not move it up; it would show as two chairs waiting for the same note.' };
        rerender(r); focusFirst('refusal.control'); return;
      }
      const res = Proto.store.readyForExam(enc.appointmentId);
      if (res.ok) { x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3); rerender(r); const stamp = document.getElementById('enc-sent'); if (stamp) stamp.focus({ preventScroll: true }); else focusFirst('enc.file'); Proto.router.announce('Sent to Exams to sign'); return; }
      x.sendGate = res; rerender(r); focusGateVerb();   // the store's verdict renders; a silent refusal is a dead control
      return;
    }
  }
  function doFile(r, enc, x, confirmed) {
    // The filing gate is the live one, so no earlier gate is left holding the contract selectors (§6).
    x.checked = true; x.sendGate = null; x.gateNode = null; x.undoGate = null; x.fileGate = null;
    const res = Proto.store.fileNote(enc.id, x.note, confirmed);
    // Filed lands on the Filed card's stamp, never on Back to Exams: Enter twice used to leave before the card could be read.
    if (res.ok) { x.filed = res.filed; x.readback = false; rerender(r); focusId('enc-filed-head') || focusFirst('enc.rail'); Proto.router.announce('Filed · ' + (res.released ? 'charges released' : 'nothing to release') + (res.claim ? ' · claim queued' : '')); return; }
    if (res.killers) { x.killers = res.killers; x.readback = false; }
    else if (res.code === 'readback') { x.killers = []; x.readback = true; }
    else { x.fileGate = res; x.readback = false; }
    rerender(r);
    // Refused: the keyboard lands on the gate's verb, one Tab from its control. The first killer control used to take it,
    // and for a hygienist that control is Send to Exams to sign, so Enter twice on File sent the chair.
    focusGateVerb() || focusFirst('enc.file');
  }
  function renderFiledCard(enc, filed, x) {
    // The claim and the charges are the encounter's own: a claim looked up by patient said "queued" on a visit
    // that queued none, and a seeded filed visit counted no charge.
    const s = S(); const procs = s.procedures.filter((p) => p.encounterId === enc.id).map((p) => p.id);
    const released = filed ? s.ledger.filter((e) => e.releasedByNoteId === filed.id) : s.ledger.filter((e) => e.kind === 'charge' && procs.includes(e.procedureId));
    const claim = s.claims.find((c) => c.encounterId === enc.id) || null;
    return h('div', { class: 'card stack enc-filed', 'aria-label': 'Filed note' },
      h('div', { class: 'row', id: 'enc-filed-head', tabindex: '-1', 'aria-label': 'Filed, audit passed' }, chip('clear', 'Filed', { big: true }), chip('clear', 'Audit passed')),
      filed ? h('p', { class: 'small muted', text: 'By ' + filed.author + ' at ' + dateTime((filed.filedOn || '') + ' ' + (filed.filedTime || '')) + ' · text and version frozen; corrections are addenda, never edits.' }) : null,
      h('ul', { class: 'enc-rows' },
        h('li', null, h('b', { text: 'Charges released: ' + released.length }), released.length ? ' · ' + released.map((e) => money(e.amountCents) + (e.tooth ? ' #' + e.tooth : '')).join(', ') : ' (nothing pending)'),
        claim ? h('li', null, h('b', { text: 'Claim queued' }), ' · to ' + claim.payer + ' · ' + claim.nextAction) : h('li', null, h('b', { text: 'No claim queued' }), ' · ' + (released.length ? 'no plan on file to bill' : 'nothing released to bill')),
        h('li', null, 'Board chip flipped to Note filed; checkout releases any held payment.')),
      filed && filed.markdown ? h('div', { class: 'enc-readonly small', text: filed.markdown }) : null);
  }

  // ---- keyboard: odontogram arrows and M/O/D/B/L, only while the encounter is mounted --------
  function onKey(ev) {
    if (Proto.router.current().route !== 'encounter') { detachKeys(); return; }
    const el = document.activeElement; if (!el || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const inChart = el.closest && el.closest('#enc-odont');
    if (!inChart) return;
    if (el.classList.contains('tooth') && /^Arrow(Left|Right|Up|Down)$/.test(ev.key)) {
      const teeth = [...document.querySelectorAll('#enc-odont .tooth')]; const i = teeth.indexOf(el);
      const j = ev.key === 'ArrowLeft' ? i - 1 : ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowDown' ? i + 16 : i - 16;
      if (teeth[j]) { ev.preventDefault(); teeth[j].focus(); }
      return;
    }
    const sf = ev.key.toUpperCase(); const r = lastRoute || Proto.router.current(); const enc = Proto.store.encounter(r.id);
    if (SURFACES.includes(sf) && enc) { const x = state(enc.id); if (x.tooth) { ev.preventDefault(); toggleSurface(r, enc, x, sf); } }
  }
  function attachKeys() { if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; } }
  function detachKeys() { if (keysOn) { document.removeEventListener('keydown', onKey); keysOn = false; } }

  window.addEventListener('hashchange', () => { if (Proto.router.current().route !== 'encounter') detachKeys(); });

  Proto.screens.exams = { render: renderExams, rows: queueRows };
  Proto.screens.encounter = { render: renderEncounter, state, undo: (r) => { const enc = Proto.store.encounter(r.id); if (enc) undo(r, enc, state(enc.id)); } };
  Proto.router.on('exams', (r) => Proto.screens.exams.render(r));
  Proto.router.on('encounter', (r) => Proto.screens.encounter.render(r));
})();
