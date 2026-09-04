/* Command palette (docs/13 feature 28): one input, incumbent-vocabulary translation,
   second identifier before a chart opens, irreversible actions open their gate instead of executing.
   Not a route. API: Proto.screens.palette = { open(r), close(), isOpen() }. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, displayName } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const MAX_RECENTS = 3;
  const recents = []; // module variable: last activated rows, newest first; never shown on operatory glass
  let closeDialog = null; // the dialog's close() while open
  let st = null;          // per-open state

  function isOpen() { return !!closeDialog; }
  function privacy() { return !!(window.__proto && window.__proto.privacy); }
  function device() { return (window.__proto && window.__proto.device) || 'desk'; }
  function showRecents() { return device() !== 'operatory'; }

  function rowLabel(row) { return row.kind === 'patient' ? displayName(row.label, privacy()) : row.label; }
  function rowSyn(row) {
    // A patient row never prints the date of birth or the last-4: those are what the gate asks for,
    // and printing them here turns the second identifier into a formality (docs/13 feature 28).
    if (row.kind === 'patient') return 'Confirm the date of birth to open the chart';
    if (row.syn) return row.syn;
    if (row.kind === 'action' && row.irreversible) return 'Opens its gate first; nothing runs from here';
    if (row.kind === 'action') return row.route ? 'Screen' : 'Opens from a patient';
    if (row.kind === 'claim') return 'Money Desk';
    return '';
  }
  function rowChip(row) {
    if (row.kind === 'patient') return chip('info', 'Patient');
    if (row.kind === 'claim') return chip('info', 'Claim');
    if (row.irreversible) return chip('review', 'Gated');
    return chip('info', 'Action');
  }

  function remember(row) {
    const i = recents.findIndex((x) => x.label === row.label && x.kind === row.kind);
    if (i >= 0) recents.splice(i, 1);
    recents.unshift(Object.assign({}, row));
    if (recents.length > MAX_RECENTS) recents.length = MAX_RECENTS;
  }

  /* ---- date of birth: MM/DD/YYYY (leading zeros optional) compared to the seed's ISO dob ---- */
  function parseDob(str) {
    const m = String(str || '').trim().match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})$/);
    if (!m) return null;
    const mo = Number(m[1]), d = Number(m[2]), y = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  /* ---- open / close ---- */
  function open(r) {
    if (closeDialog) close();
    st = { r, q: '', rows: [], sel: -1, step: 'search', patient: null, row: null, dob: '', dobTouched: false, refused: false };
    const body = h('div', { class: 'stack pal', onKeydown: onKey });
    st.body = body;
    renderSearch();
    closeDialog = Proto.ui.dialog(body, {
      label: 'Search and actions',
      focus: '[data-testid="palette.input"]',
      onClose: () => { closeDialog = null; st = null; window.removeEventListener('hashchange', onHash); },
    });
    window.addEventListener('hashchange', onHash);
  }
  function close() { if (closeDialog) closeDialog(); }
  function onHash() { close(); }

  /* ---- step 1: search ---- */
  function renderSearch() {
    st.step = 'search'; st.refused = false;
    const input = h('input', {
      class: 'input pal-input', type: 'text', autocomplete: 'off', spellcheck: 'false',
      testid: 'palette.input', id: 'palette-input',
      role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list',
      'aria-label': 'Search patients, appointments, claims, reports, and actions',
      placeholder: 'Type three letters… try walkout statement, day sheet, Office Journal',
      value: st.q,
      onInput: (ev) => { st.q = ev.target.value; st.sel = -1; refreshList(); },
    });
    st.input = input;
    st.status = h('div', { class: 'sr-only', 'aria-live': 'polite', id: 'palette-status' });
    st.hint = h('p', { class: 'hint pal-hint', id: 'palette-hint' });
    st.list = h('div', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': 'Results' });
    st.body.replaceChildren(
      h('div', { class: 'pal-head' },
        h('h2', { class: 'pal-title', text: 'Search' }),
        btn('Close', { testid: 'palette.close', kind: 'quiet', class: 'compact', ariaLabel: 'Close search (Escape)', onClick: close })),
      input, st.hint, st.status, st.list,
      h('details', { class: 'pal-more' }, h('summary', { testid: 'palette.how' }, 'How search works'),
        h('div', { class: 'whytext', text: 'Three letters list patients (name · date of birth · last four of the phone), claims, screens, and actions. Words from Dentrix, Eaglesoft, Open Dental, and Curve are translated to the words this system uses, so you learn the term at the moment you need it. A patient chart opens only after a second identifier. Irreversible actions (Close day, Post matched) open their gate; nothing runs from here. Patient search never widens to phonetic matches.' })),
    );
    refreshList();
  }

  function currentRows() {
    const q = st.q.trim();
    if (q.length >= 3) return { rows: Proto.store.search(q), recents: false };
    if (showRecents() && recents.length) return { rows: recents.slice(), recents: true };
    return { rows: [], recents: false };
  }

  function refreshList() {
    const q = st.q.trim();
    const { rows, recents: isRecents } = currentRows();
    st.rows = rows;
    if (st.sel >= rows.length) st.sel = rows.length - 1;
    const nodes = [];
    if (isRecents) nodes.push(h('div', { class: 'small muted pal-groups', text: 'Recents' }));
    rows.forEach((row, i) => nodes.push(renderRow(row, i)));
    st.list.replaceChildren(...nodes);
    if (q.length === 0) st.hint.textContent = isRecents ? 'Your last three. Type three letters to search.' : 'Type three letters of a name, phone, claim, or the word you know from your old system.';
    else if (q.length < 3) st.hint.textContent = 'Type ' + (3 - q.length) + ' more letter' + (3 - q.length === 1 ? '' : 's') + '.';
    else if (!rows.length) st.hint.textContent = 'Nothing matches "' + q + '". Patient search does not widen to phonetic matches; try the last four digits of the phone or the MRN.';
    else st.hint.textContent = rows.length + ' result' + (rows.length === 1 ? '' : 's') + '. Arrow keys move, Enter opens.';
    st.status.textContent = q.length >= 3 ? (rows.length ? rows.length + ' results' : 'No results') : '';
    syncSelection();
  }

  function renderRow(row, i) {
    const id = 'palette-row-' + i;
    return h('button', {
      type: 'button', class: 'palette-row', id, role: 'option', testid: 'palette.row.' + i,
      'aria-selected': i === st.sel ? 'true' : 'false',
      onClick: () => activate(row),
      onFocus: () => { st.sel = i; syncSelection(); },
    },
    h('span', { class: 'pal-left' }, rowChip(row), h('span', { class: 'lbl', text: rowLabel(row) })),
    h('span', { class: 'syn', text: rowSyn(row) }));
  }

  function syncSelection() {
    const rows = [...st.list.querySelectorAll('.palette-row')];
    rows.forEach((el, i) => el.setAttribute('aria-selected', i === st.sel ? 'true' : 'false'));
    if (st.input) { if (st.sel >= 0 && rows[st.sel]) st.input.setAttribute('aria-activedescendant', rows[st.sel].id); else st.input.removeAttribute('aria-activedescendant'); }
    if (st.sel >= 0 && rows[st.sel]) rows[st.sel].scrollIntoView({ block: 'nearest' });
  }

  function move(delta) {
    if (!st.rows.length) return;
    st.sel = st.sel < 0 ? (delta > 0 ? 0 : st.rows.length - 1) : (st.sel + delta + st.rows.length) % st.rows.length;
    syncSelection();
    // Keep typing possible: focus stays in the input; the highlighted row is announced via aria-activedescendant.
    if (st.input && document.activeElement !== st.input) st.input.focus();
  }

  function onKey(ev) {
    if (!st) return;
    if (st.step === 'search') {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); return; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); return; }
      if (ev.key === 'Enter' && ev.target === st.input) {
        ev.preventDefault();
        const i = st.sel >= 0 ? st.sel : (st.rows.length ? 0 : -1);
        if (i >= 0) activate(st.rows[i]);
        else if (st.q.trim().length < 3) st.hint.textContent = 'Three letters first.';
        return;
      }
      if (ev.key === 'Home' && ev.target !== st.input) { ev.preventDefault(); st.sel = 0; syncSelection(); return; }
      if (ev.key === 'End' && ev.target !== st.input) { ev.preventDefault(); st.sel = st.rows.length - 1; syncSelection(); return; }
    } else if (st.step === 'confirm') {
      if (ev.key === 'Enter' && ev.target === st.dobInput) { ev.preventDefault(); confirmDob(); }
    }
  }

  /* ---- activation ---- */
  function activate(row) {
    if (!row || !st) return;
    const r = st.r;
    if (row.kind === 'patient') { st.row = row; st.patient = Proto.store.patient(row.patientId); renderConfirm(); return; }
    if (row.kind === 'claim') {
      remember(row); close();
      Proto.router.go(r.persona, row.route || 'money');
      Proto.router.announce('Money Desk. ' + row.label);
      return;
    }
    // kind: action
    if (!row.route) {
      // e.g. 'sidekick' → Patient Rail: it opens from a patient, so keep the palette open and steer.
      st.q = ''; st.sel = -1; renderSearch();
      st.hint.textContent = row.label + ' opens from a patient. Type three letters of a name.';
      Proto.router.announce(st.hint.textContent);
      return;
    }
    if (row.route === 'ledger') {
      st.q = ''; st.sel = -1; renderSearch();
      st.hint.textContent = 'The ledger opens from a patient. Type three letters of a name; the Rail shows three numbers and Explain.';
      Proto.router.announce(st.hint.textContent);
      return;
    }
    remember(row); close();
    if (row.route === 'phone') { location.hash = '#/phone/approvals'; return; }
    Proto.router.go(r.persona, row.route);
    if (row.irreversible) Proto.router.announce(row.label + ': opens its gate; nothing executed');
    else Proto.router.announce(row.label);
  }

  /* ---- step 2: second identifier ---- */
  function renderConfirm() {
    st.step = 'confirm'; st.dob = ''; st.dobTouched = false; st.refused = false;
    const p = st.patient; const row = st.row;
    const nameLine = displayName(p.name, privacy()) + ' · …' + p.phone.slice(-4) + ' · ' + p.mrn;
    const dobInput = h('input', {
      class: 'input pal-dob', type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '10',
      testid: 'palette.confirm.dob', id: 'palette-dob', placeholder: 'MM/DD/YYYY', 'aria-label': 'Date of birth, MM/DD/YYYY',
      'aria-describedby': 'palette-dob-hint',
      onInput: (ev) => { st.dob = ev.target.value; if (st.dobTouched) validateDob(false); },
      onBlur: () => { st.dobTouched = true; validateDob(false); },
    });
    st.dobInput = dobInput;
    st.dobHint = h('p', { class: 'hint', id: 'palette-dob-hint', text: 'Second identifier. Ask the patient, or read it from the appointment card.' });
    st.gate = h('div', { class: 'pal-gate' });
    st.go = btn('Open chart', { testid: 'palette.confirm.go', kind: 'reversible', onClick: confirmDob });
    st.body.replaceChildren(
      h('div', { class: 'pal-head' },
        h('h2', { class: 'pal-title', text: 'Confirm date of birth' }),
        btn('Close', { testid: 'palette.close', kind: 'quiet', class: 'compact', ariaLabel: 'Close search (Escape)', onClick: close })),
      h('div', { class: 'pal-who' }, chip('info', 'Patient'), h('span', { class: 'lbl', text: nameLine })),
      h('div', { class: 'field' }, h('label', { for: 'palette-dob', text: 'Date of birth' }), dobInput, st.dobHint),
      st.gate,
      h('div', { class: 'btnrow' },
        st.go,
        btn('Back to results', { testid: 'palette.confirm.back', kind: 'quiet', onClick: () => { st.sel = -1; renderSearch(); } })),
    );
    dobInput.focus();
  }

  function validateDob(loud) {
    const v = st.dob.trim();
    const ok = !v || !!parseDob(v);
    st.dobInput.classList.toggle('invalid', !ok);
    st.dobInput.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (!ok) st.dobHint.textContent = 'Use MM/DD/YYYY, for example 04/12/1978.';
    else if (!st.refused) st.dobHint.textContent = 'Second identifier. Ask the patient, or read it from the appointment card.';
    if (loud && !v) st.dobHint.textContent = 'Enter the date of birth to open the chart.';
    return ok && !!v;
  }

  function confirmDob() {
    if (!st || st.step !== 'confirm') return;
    st.dobTouched = true;
    if (!validateDob(true)) { st.dobInput.focus(); return; }
    const iso = parseDob(st.dob);
    const p = st.patient; const r = st.r; const row = st.row;
    if (iso === p.dob) {
      // Two identifiers matched: the chart may open. This is the moment the PHI access row is written.
      Proto.events.write('phiAccessLog', p.id);
      remember(row);
      close();
      if (Proto.screens.rail && typeof Proto.screens.rail.open === 'function') Proto.screens.rail.open(p.id, r);
      else Proto.router.go(r.persona, 'ledger', p.id); // Rail module absent in this build: the ledger route is the closest contract surface
      Proto.screens.shell.refreshAndon(r);
      Proto.router.announce('Chart open: ' + displayName(p.name, privacy()));
      return;
    }
    // Mismatch: one verb line, one control; the primary switches to Held.
    st.refused = true;
    st.gate.replaceChildren(refusal({
      code: 'second_identifier', verb: 'Date of birth does not match', control: 'Try again',
      onControl: () => { st.refused = false; st.dob = ''; st.dobInput.value = ''; st.dobInput.classList.remove('invalid'); st.gate.replaceChildren(); swapGo(false); st.dobHint.textContent = 'Second identifier. Ask the patient, or read it from the appointment card.'; st.dobInput.focus(); },
      why: 'Two identifiers before a chart opens; patient search never widens to phonetic matches.',
    }));
    swapGo(true);
  }

  function swapGo(held) {
    const nb = held
      ? btn('Held', { testid: 'palette.confirm.go', kind: 'held', ariaLabel: 'Open chart, held until the date of birth matches', onClick: () => { st.dobInput.focus(); } })
      : btn('Open chart', { testid: 'palette.confirm.go', kind: 'reversible', onClick: confirmDob });
    st.go.replaceWith(nb); st.go = nb;
  }

  Proto.screens.palette = { open, close, isOpen, recents: () => recents.map((x) => x.label) };
})();
