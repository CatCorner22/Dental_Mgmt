/* Perio (route 'perio', id = encounter id). Keyboard-first six-point grid for one gloved operator.
   Grammar (document keydown while mounted): 1-9 depth and advance; 0 then digit = 10+digit (above 15
   refused at the control); Space bleeding on the last recorded site; S suppuration; Backspace undo and
   step back; ArrowRight/Down skip as 'not probed' (never 0); ArrowLeft/Up step back; PageDown next tooth.
   Glove pad, settings drawer (last key echo + probing path), screening lane (six sextant codes),
   Save exam (irreversible) with the omission-licence gate, derived note card, for-dentist tag. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, displayName, pageHead, longDate } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TODAY = (Proto.seed && Proto.seed.TODAY) || '2026-09-03';
  const UPPER = Array.from({ length: 16 }, (_, i) => i + 1);          // 1..16
  const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i);         // 32..17
  const LICENCES = [['implant', 'Implant'], ['crown_margin', 'Crown margin'], ['not_tolerated', 'Patient could not tolerate'], ['third_molar_absent', 'Third molar absent']];
  const PATHS = [['facial_lingual', 'Facial around, then lingual'], ['quadrant', 'Quadrant by quadrant'], ['arch', 'Arch by arch']];
  const SEXTANTS = [['UR', '1–5'], ['UA', '6–11'], ['UL', '12–16'], ['LL', '17–21'], ['LA', '22–27'], ['LR', '28–32']];
  const OBS = [['caries', 'Suspected caries'], ['fracture', 'Fractured restoration'], ['recession', 'Recession ≥3 mm'], ['mobility', 'Mobility'], ['lesion', 'Soft-tissue lesion'], ['other', 'Other observation']];
  const MEANING = { ' ': 'Bleeding toggled on the last site', s: 'Suppuration toggled on the last site', Backspace: 'Undo, step back', ArrowRight: 'Skip site (not probed)', ArrowDown: 'Skip site (not probed)', ArrowLeft: 'Step back', ArrowUp: 'Step back', PageDown: 'Next tooth', PageUp: 'Previous tooth' };

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  let lastStore = null; let states = {}; let keysOn = false; let pathPref = 'facial_lingual'; let flashTimer = null;
  const toothOf = (key) => Number(key.slice(1, key.indexOf('-')));
  const siteOf = (key) => Number(key.slice(key.indexOf('-s') + 2));
  const clock12 = (t) => { const [hh, mm] = t.split(':').map(Number); return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm'); };

  function syncStore() { const s = S(); if (s !== lastStore) { lastStore = s; states = {}; } }
  function priorExam(pid) { return S().perioExams.filter((e) => e.patientId === pid && e.date < TODAY).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null; }

  /* Probing path: an ordered array of cell keys over present teeth. */
  function buildPath(missing, choice) {
    const ok = (t) => !missing.includes(t); const out = [];
    const run = (teeth, sites) => { for (const t of teeth) if (ok(t)) for (const s of sites) out.push('t' + t + '-s' + s); };
    const F = [1, 2, 3], L = [4, 5, 6]; const rev = (a) => a.slice().reverse();
    if (choice === 'quadrant') { for (const q of [[1, 8], [9, 16], [17, 24], [25, 32]]) { const teeth = []; for (let t = q[0]; t <= q[1]; t++) teeth.push(t); run(teeth, F); run(rev(teeth), L); } }
    else if (choice === 'arch') { run(UPPER, F); run(UPPER, L); run(LOWER, F); run(LOWER, L); }
    else { run(UPPER, F); run(rev(UPPER), L); run(LOWER, F); run(rev(LOWER), L); }
    return out;
  }

  function stateFor(enc) {
    syncStore();
    if (states[enc.id]) return states[enc.id];
    const prior = priorExam(enc.patientId);
    const missing = (prior && prior.missing) || [];
    const st = { encId: enc.id, prior: (prior && prior.sites) || {}, priorDate: prior ? prior.date : null, missing, path: buildPath(missing, pathPref), cur: 0, sites: {}, history: [], last: null, pendingZero: false,
      mode: 'full', sextants: ['', '', '', '', '', ''], scur: 0, padOpen: false, settingsOpen: false, lastKey: null, keystrokes: 0, flash: null, stamp: null, gate: null, licenceOpen: false, licence: null, saved: null, savedAt: null,
      tagOpen: false, tagTooth: '', tagText: '', tagTouched: false, tagged: [] };
    states[enc.id] = st; return st;
  }
  const curKey = (st) => st.path[st.cur] || null;
  const siteLabel = (key) => 'tooth ' + toothOf(key) + ' site ' + siteOf(key);
  const total = (st) => st.path.length;
  const probedCount = (st) => Object.values(st.sites).filter((v) => v.depth != null).length;
  const skippedCount = (st) => Object.values(st.sites).filter((v) => v.skipped).length;
  const deepest = (st) => Math.max(0, ...Object.values(st.sites).map((v) => v.depth || 0));

  // ---- Grammar core (shared by keys and the glove pad); returns the meaning shown in Settings ----
  function advance(st) { if (st.cur < st.path.length) st.cur++; }
  function stampTooth(st, key) { const t = toothOf(key); const done = [1, 2, 3, 4, 5, 6].every((s) => st.sites['t' + t + '-s' + s]); if (done) st.stamp = 'Saved to tooth #' + t + ' (draft, this session)'; }
  function record(st, depth) {
    const key = curKey(st); if (!key) return 'Every site is entered. Save exam.';
    const prev = st.sites[key]; st.history.push({ key, prev: prev ? Object.assign({}, prev) : null, cur: st.cur });
    st.sites[key] = { depth, bleed: !!(prev && prev.bleed), sup: !!(prev && prev.sup), skipped: false };
    st.last = key; advance(st); stampTooth(st, key);
    return 'Depth ' + depth + ' mm at ' + siteLabel(key) + ', next site';
  }
  function skip(st) {
    const key = curKey(st); if (!key) return 'Every site is entered. Save exam.';
    const prev = st.sites[key]; st.history.push({ key, prev: prev ? Object.assign({}, prev) : null, cur: st.cur });
    st.sites[key] = { depth: null, bleed: false, sup: false, skipped: true };
    st.last = key; advance(st); stampTooth(st, key);
    return 'Not probed at ' + siteLabel(key) + ' (stored as not probed, never 0)';
  }
  function undo(st, r) {
    const e = st.history.pop(); if (!e) return 'Nothing to undo';
    const removed = st.sites[e.key];
    if (e.prev) st.sites[e.key] = e.prev; else delete st.sites[e.key];
    st.cur = e.cur; const top = st.history[st.history.length - 1]; st.last = top ? top.key : null; st.stamp = null;
    flash(st, r, 'Undo: removed ' + (removed ? (removed.skipped ? 'not probed' : removed.depth) : 'nothing') + ' at ' + siteLabel(e.key));
    return 'Undo: removed ' + (removed ? (removed.skipped ? 'not probed' : removed.depth) : 'nothing') + ', stepped back';
  }
  function toggle(st, field) {
    const key = st.last; if (!key || !st.sites[key]) return 'Record a depth first';
    const v = st.sites[key]; v[field] = !v[field];
    return (field === 'bleed' ? 'Bleeding ' : 'Suppuration ') + (v[field] ? 'on' : 'off') + ' at ' + siteLabel(key);
  }
  function nextTooth(st, dir) {
    if (dir > 0) { const key = curKey(st); if (!key) return 'Every site is entered. Save exam.'; const t = toothOf(key); let i = st.cur; while (i < st.path.length && toothOf(st.path[i]) === t) i++; st.cur = i; return 'Next tooth' + (curKey(st) ? ': tooth ' + toothOf(curKey(st)) : ', end of path'); }
    let i = Math.min(st.cur, st.path.length) - 1; if (i < 0) return 'Already at the first site';
    const t = toothOf(st.path[i]); while (i > 0 && toothOf(st.path[i - 1]) === t) i--; st.cur = i; return 'Previous tooth: tooth ' + t;
  }
  function flash(st, r, text) {
    st.flash = text; Proto.router.announce(text); clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { st.flash = null; const c = Proto.router.current(); if (c.route === 'perio' && c.id === st.encId) rerender(c); }, 4500);
  }
  function depthGate(st, depth) {
    st.gate = { code: 'depth_gt_15', node: refusal({ code: 'depth_gt_15', verb: 'Depth ' + depth + ' mm is above the 15 mm limit', control: 'Re-enter the depth', why: 'Probing depths above 15 mm are not recordable; the site keeps its previous value and the cursor stays here. Type 0 then a digit for 10 to 15.', onControl: () => { st.gate = null; const c = Proto.router.current(); rerender(c); focusCell(st); } }) };
  }
  function apply(st, k, r) {
    if (st.saved) {
      if (!st.amendGate) { st.amendGate = Proto.ui.refusal({ code: 'exam_sealed', verb: 'Exam is filed — amend adds an addendum', control: 'Start an addendum', onControl: () => { st.saved = null; st.savedAt = null; st.amendGate = null; st.amending = true; rerender(Proto.router.current()); }, why: 'A filed exam is the record. Keys no longer change it; an amendment is a new dated entry that links to the original.', severity: 'info' }); rerender(Proto.router.current()); }
      return 'Exam is filed; start an addendum to change it';
    }
    if (st.mode === 'screening') { const out = applyScreening(st, k); setTimeout(() => focusSextant(st), 0); return out; }
    if (/^[0-9]$/.test(k)) {
      const d = Number(k);
      if (st.pendingZero) { st.pendingZero = false; const depth = 10 + d; if (depth > 15) { depthGate(st, depth); return 'Depth ' + depth + ' mm refused (above 15)'; } return record(st, depth); }
      if (d === 0) { st.pendingZero = true; return 'Waiting for the second digit (10 or more)'; }
      return record(st, d);
    }
    st.pendingZero = false;
    if (k === ' ') return toggle(st, 'bleed');
    if (k === 's' || k === 'S') return toggle(st, 'sup');
    if (k === 'Backspace') return undo(st, r);
    if (k === 'ArrowRight' || k === 'ArrowDown') return skip(st);
    if (k === 'ArrowLeft' || k === 'ArrowUp') { if (st.cur > 0) st.cur--; return 'Step back to ' + (curKey(st) ? siteLabel(curKey(st)) : 'start'); }
    if (k === 'PageDown') return nextTooth(st, 1);
    if (k === 'PageUp') return nextTooth(st, -1);
    return null;
  }
  function focusSextant(st) { const b = document.querySelector('[data-testid="perio.sextant.' + (st.scur + 1) + '"]'); if (b) b.focus(); }
  function applyScreening(st, k) {
    if (/^[0-4]$/.test(k) || k === '*') { if (st.scur > 5) return 'All six sextants coded. Save exam.'; st.sextants[st.scur] = k; st.scur++; return 'Sextant ' + SEXTANTS[st.scur - 1][0] + ' = ' + k; }
    if (k === 'Backspace') { if (st.scur === 0) return 'Nothing to undo'; st.scur--; st.sextants[st.scur] = ''; return 'Undo: cleared sextant ' + SEXTANTS[st.scur][0]; }
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') { if (st.scur < 5) st.scur++; return 'Next sextant'; }
    if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { if (st.scur > 0) st.scur--; return 'Previous sextant'; }
    return null;
  }

  // ---- Document keydown: active only while this route is mounted; never hijacks inputs or dialogs ----
  function onKey(ev) {
    const r = Proto.router.current();
    if (r.route !== 'perio') { document.removeEventListener('keydown', onKey); keysOn = false; return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.overlay')) return;
    const enc = Proto.store.encounter(r.id); if (!enc) return;
    const st = stateFor(enc); const k = ev.key;
    const onCell = t && t.classList && t.classList.contains('psite');
    const onControl = t && !onCell && ['BUTTON', 'SUMMARY', 'A'].includes(t.tagName);
    if (k === 'Enter' || k === 'Tab' || k === 'Escape' || (onControl && k === ' ')) return; // native activation and focus travel stay native
    const meaning = apply(st, k, r);
    if (!meaning) return;
    ev.preventDefault();
    st.keystrokes++; st.lastKey = { key: k === ' ' ? 'Space' : k, meaning };
    if (st.padOpen) st.padOpen = false; // the pad hides when a key or pedal event arrives
    rerender(r);
  }
  function viaPad(st, r, k) { const meaning = apply(st, k, r); if (!meaning) return; st.keystrokes++; st.lastKey = { key: 'Pad ' + (k === ' ' ? 'Bleed' : k), meaning }; rerender(r); }

  // ---- Save ----------------------------------------------------------------------------------
  function buildSites(st) {
    const out = {};
    if (st.mode === 'screening') { st.sextants.forEach((c, i) => { out['sx' + (i + 1)] = { sextant: SEXTANTS[i][0], code: c, depth: null, bleed: false, skipped: false }; }); return out; }
    for (const key of st.path) { const v = st.sites[key]; out[key] = v && v.depth != null ? { depth: v.depth, bleed: !!v.bleed, sup: !!v.sup, skipped: false } : { depth: null, bleed: false, sup: false, skipped: true }; }
    return out;
  }
  function mkGate(st, res, onControl) { st.gate = { code: res.code, node: refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why, severity: res.code === 'outage' ? 'stop' : 'required', onControl: onControl || (() => {}) }) }; }
  function doSave(st, r, licence) {
    const u = Proto.store.currentUser();
    if (P().device === 'shared' && !u.licence) { mkGate(st, { code: 'pin_required', verb: 'Switch author to the hygienist before Save', control: 'Who is charting?', why: 'On a shared tablet the exam is attributed to the PIN author. ' + u.name + ' holds no clinical licence, so Save waits until the hygienist enters her PIN.' }, () => Proto.screens.shell.openPinPad(r)); rerender(r); return; }
    if (st.mode === 'screening' && st.sextants.some((c) => c === '')) { const n = st.sextants.filter((c) => c === '').length; mkGate(st, { code: 'screening_incomplete', verb: 'Code ' + n + ' more sextant' + (n > 1 ? 's' : '') + ' before Save', control: 'Go to the first empty sextant', why: 'Screening saves six codes (0 to 4, or * for furcation, mobility, or recession). An empty box would read as 0.' }, () => { st.gate = null; st.scur = st.sextants.indexOf(''); rerender(r); const b = document.querySelector('[data-testid="perio.sextant.' + (st.scur + 1) + '"]'); if (b) b.focus(); }); rerender(r); return; }
    const res = Proto.store.savePerio(st.encId, buildSites(st), { mode: st.mode, licence: licence || undefined });
    if (!res.ok) {
      if (res.code === 'omission_licence') mkGate(st, res, () => { st.licenceOpen = true; rerender(r); const b = document.querySelector('[data-testid="perio.licence.' + LICENCES[0][0] + '"]'); if (b) b.focus(); });
      else mkGate(st, res);
      rerender(r); const c = document.querySelector('[data-testid="refusal.control"]'); if (c) c.focus(); return;
    }
    st.gate = null; st.licenceOpen = false; st.saved = res.exam; st.savedAt = S().clock.time; st.padOpen = false;
    if (!st.tagTooth) { const deep = Object.entries(st.sites).filter(([, v]) => v.depth >= 5).sort((a, b) => b[1].depth - a[1].depth)[0]; st.tagTooth = deep ? String(toothOf(deep[0])) : ''; }
    Proto.screens.shell.refreshAndon(r); if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    rerender(r);
    const note = S().notes[st.encId] || {};
    Proto.router.announce('Exam saved. ' + (note.perioSummary || '') + ' ' + recallLine(st));
    const b = document.querySelector('[data-testid="perio.tag.add"]'); if (b) b.focus();
  }
  function recallLine(st) {
    if (st.mode === 'screening') return st.sextants.some((c) => c === '3' || c === '4') ? 'Full chart due: a full six-point chart is booked into the next hygiene visit' : '6-month recall';
    return deepest(st) >= 5 ? '4-month perio maintenance with BWX' : '6-month recall';
  }
  function saveTag(st, r) {
    const tooth = Number(st.tagTooth); const bad = !st.tagTooth || !Number.isInteger(tooth) || tooth < 1 || tooth > 32 || st.missing.includes(tooth) || !st.tagText.trim();
    st.tagTouched = true;
    if (bad) { rerender(r); const el = document.querySelector('[data-testid="' + (!st.tagText.trim() && st.tagTooth ? 'perio.tag.text' : 'perio.tag.tooth') + '"]'); if (el) el.focus(); return; }
    const res = Proto.store.addTag(st.encId, tooth, [], st.tagText.trim());
    if (!res.ok) { mkGate(st, res); rerender(r); return; }
    st.tagged.push(res.tag); st.tagOpen = false; st.tagText = ''; st.tagTouched = false; Proto.store.retireChip('tag');
    Proto.screens.shell.refreshAndon(r); if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    rerender(r); Proto.router.announce('Tagged tooth ' + tooth + ' for the dentist. A finding, not a diagnosis.');
    const b = document.querySelector('[data-testid="perio.tag.add"]'); if (b) b.focus();
  }

  // ---- Pieces ----------------------------------------------------------------------------------
  const TAG_HINT = 'A finding, not a diagnosis. The tag lands as a checklist row on the dentist\'s exam; sign refuses until it has a disposition.';
  const TOOTH_MSG = ' Tooth must be 1 to 32 and present in the mouth.'; const TEXT_MSG = ' Say what you saw.';
  const toothInvalid = (st) => { const t = Number(st.tagTooth); return !st.tagTooth || !Number.isInteger(t) || t < 1 || t > 32 || st.missing.includes(t); };
  function validateTag(st) {
    const tooth = document.querySelector('[data-testid="perio.tag.tooth"]'); const text = document.querySelector('[data-testid="perio.tag.text"]'); const hint = document.getElementById('pe-tag-hint');
    if (!tooth || !text || !hint) return;
    const tb = st.tagTouched && toothInvalid(st); const xb = st.tagTouched && !st.tagText.trim();
    tooth.classList.toggle('invalid', tb); if (tb) tooth.setAttribute('aria-invalid', 'true'); else tooth.removeAttribute('aria-invalid');
    text.classList.toggle('invalid', xb); if (xb) text.setAttribute('aria-invalid', 'true'); else text.removeAttribute('aria-invalid');
    hint.textContent = TAG_HINT + (tb ? TOOTH_MSG : '') + (xb ? TEXT_MSG : '');
  }
  function scrollCursorIntoView() {
    const a = document.querySelector('.psite.active');
    if (!a) return;
    const b = a.getBoundingClientRect();
    if (b.top < 90 || b.bottom > window.innerHeight - 8) a.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  function focusCell(st) { const key = curKey(st); const b = key && document.querySelector('[data-testid="perio.grid.cell.' + key + '"]'); if (b) b.focus(); }
  function cell(st, r, t, s) {
    const key = 't' + t + '-s' + s; const v = st.sites[key]; const missing = st.missing.includes(t); const idx = st.path.indexOf(key);
    const cls = ['psite']; if (missing) cls.push('missing'); if (!missing && !st.saved && curKey(st) === key) cls.push('active');
    if (v && v.bleed) cls.push('bleed'); if (v && v.depth >= 5) cls.push('deep'); if (v && v.skipped) cls.push('skipped'); if (v && v.sup) cls.push('sup');
    const desc = missing ? 'Missing tooth' : [v && v.depth != null ? v.depth + ' mm' : v && v.skipped ? 'not probed' : 'not entered', v && v.bleed ? 'bleeding' : null, v && v.sup ? 'suppuration' : null, st.prior[key] != null ? 'prior ' + st.prior[key] : null].filter(Boolean).join(', ');
    const b = h('button', { type: 'button', class: cls.join(' '), testid: 'perio.grid.cell.' + key, 'aria-label': 'Tooth ' + t + ' site ' + s, 'aria-description': desc, title: desc, disabled: missing,
      onClick: () => { if (st.saved || idx < 0) return; st.cur = idx; st.padOpen = true; rerender(r); } },
      missing ? 'x' : v && v.depth != null ? String(v.depth) : '—');
    if (!missing && st.prior[key] != null) b.append(h('span', { class: 'ghost', 'aria-hidden': 'true', text: st.prior[key] }));
    return b;
  }
  function grid(st, r) {
    const table = h('table', { class: 'perio', 'aria-label': 'Six-point perio grid, 32 teeth' });
    for (const [name, teeth] of [['Upper', UPPER], ['Lower', LOWER]]) {
      table.append(h('thead', null, h('tr', null, h('th', { class: 'pe-rowlab', scope: 'col', text: name }), ...teeth.map((t) => h('th', { scope: 'col', text: String(t) })))));
      const body = h('tbody');
      for (const s of [1, 2, 3, 4, 5, 6]) body.append(h('tr', null, h('th', { class: 'pe-rowlab', scope: 'row', text: (s <= 3 ? 'F' : 'L') + s }), ...teeth.map((t) => h('td', null, cell(st, r, t, s)))));
      table.append(body);
    }
    return h('div', { class: 'perio-wrap' }, table);
  }
  function sextants(st, r) {
    return h('div', { class: 'pe-sextants', role: 'group', 'aria-label': 'Six sextant screening codes' }, ...SEXTANTS.map(([lab, range], i) => {
      const code = st.sextants[i]; const cls = ['psite', 'pe-sextant']; if (!st.saved && st.scur === i) cls.push('active'); if (code === '3' || code === '4') cls.push('deep'); if (code === '*') cls.push('bleed');
      return h('button', { type: 'button', class: cls.join(' '), testid: 'perio.sextant.' + (i + 1), 'aria-label': 'Sextant ' + lab + ', teeth ' + range + (code ? ', code ' + code : ', no code yet'), onClick: () => { if (!st.saved) { st.scur = i; rerender(r); } } },
        h('span', { class: 'pe-sxcode', text: code || '—' }), h('span', { class: 'small muted', text: lab + ' · ' + range }));
    }));
  }
  function pad(st, r) {
    const key = (k, label, tid, extra) => btn(label, { kind: 'quiet', class: 'pe-padkey' + (extra ? ' ' + extra : ''), testid: tid, ariaLabel: label === '→' ? 'Skip site, not probed' : label === '⌫' ? 'Undo last entry' : undefined, onClick: () => viaPad(st, r, k) });
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => key(String(n), String(n), 'perio.pad.key.' + n));
    return h('div', { class: 'pad', role: 'group', 'aria-label': 'Glove pad' }, ...keys,
      key('0', '10+', 'perio.pad.key.0'), key('s', 'Pus', 'perio.pad.supp'),
      key(' ', 'Bld', 'perio.pad.bleed'), key('ArrowRight', '→', 'perio.pad.skip'), key('Backspace', '⌫', 'perio.pad.undo'),
      btn('Next tooth', { kind: 'reversible', class: 'next', testid: 'perio.pad.next', onClick: () => viaPad(st, r, 'PageDown') }));
  }
  function settings(st, r) {
    const lk = st.lastKey;
    return h('section', { class: 'card stack pe-settings', 'aria-label': 'Perio settings', id: 'perio-settings' },
      h('h2', { text: 'Perio settings' }),
      h('p', { class: 'pe-lastkey', 'aria-live': 'polite', text: 'Last key pressed: ' + (lk ? lk.key + ' → ' + lk.meaning : 'none yet. Press any key on a clicker or pedal to see how it maps.') }),
      h('p', { class: 'small muted', text: 'Any HID device that emits keystrokes works without a driver. Keystrokes this exam: ' + st.keystrokes + ' (counted, never scored per person).' }),
      h('div', { class: 'field' }, h('span', { class: 'small muted', id: 'pe-pathlab', text: 'Probing path (your preference, chosen once)' }),
        h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'pe-pathlab' }, ...PATHS.map(([code, label]) => { const b = btn(label, { kind: 'quiet', testid: 'perio.path.' + code, onClick: () => { pathPref = code; const key = curKey(st); st.path = buildPath(st.missing, code); st.cur = key ? Math.max(0, st.path.indexOf(key)) : 0; rerender(r); } }); b.setAttribute('aria-pressed', String(pathPref === code)); return b; }))),
      h('details', null, h('summary', { class: 'pe-summary', testid: 'perio.settings.grammar' }, 'The five-key grammar'), h('ul', { class: 'pe-list small' },
        h('li', { text: '1–9 record the depth and advance; 0 then a digit records 10 to 15; above 15 is refused.' }),
        h('li', { text: 'Space toggles bleeding and S suppuration on the last recorded site.' }),
        h('li', { text: 'Backspace undoes the last entry and steps back; the removed value shows for two seconds.' }),
        h('li', { text: 'Right or Down arrow skips the site as not probed (never 0); Left or Up steps back; PageDown jumps to the next tooth.' }),
        h('li', { text: 'Every keystroke autosaves to this session only; the stamp under the grid names the last complete tooth.' }))));
  }
  function licenceChooser(st, r) {
    return h('section', { class: 'card stack pe-licence', 'aria-label': 'Reason the skipped sites were not probed' },
      h('h2', { text: 'Why were ' + skippedCount(st) + ' sites not probed?' }),
      h('p', { class: 'small muted', text: 'One licence covers the skipped set. The note will say which sites were not probed and why; a blank never reads as a full chart.' }),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Omission licence' }, ...LICENCES.map(([code, label]) => { const b = btn(label, { kind: 'quiet', testid: 'perio.licence.' + code, onClick: () => { st.licence = code; rerender(r); const c = document.querySelector('[data-testid="perio.licence.confirm"]'); if (c) c.focus(); } }); b.setAttribute('aria-pressed', String(st.licence === code)); return b; })),
      h('div', { class: 'btnrow' }, btn(st.licence ? 'Save exam with this reason' : 'Choose a reason above', { kind: st.licence ? 'irreversible' : 'held', testid: 'perio.licence.confirm', onClick: () => { if (st.licence) doSave(st, r, st.licence); else { const b = document.querySelector('[data-testid="perio.licence.' + LICENCES[0][0] + '"]'); if (b) b.focus(); } } })));
  }
  function tagBlock(st, r) {
    const dentist = (() => { const a = S().appointments.find((x) => x.encounterId === st.encId); const u = a && Proto.store.user(a.providerId); return u && u.role !== 'hygienist' ? u.short : 'Dr. Kim'; })();
    const wrap = h('div', { class: 'stack pe-tag' });
    if (st.tagged.length) wrap.append(h('div', { class: 'row' }, ...st.tagged.map((t) => chip('review', 'Tagged #' + t.tooth + ' · waiting for dentist'))));
    if (!st.tagOpen) { wrap.append(h('div', { class: 'btnrow' }, btn('Tag for dentist', { kind: 'reversible', testid: 'perio.tag.add', ariaLabel: 'Tag a tooth for the dentist: a finding, not a diagnosis', onClick: () => { st.tagOpen = true; if (!st.tagTooth && curKey(st)) st.tagTooth = String(toothOf(curKey(st))); rerender(r); const el = document.querySelector('[data-testid="perio.tag.tooth"]'); if (el) el.focus(); } }))); return wrap; }
    const tooth = Number(st.tagTooth); const toothBad = st.tagTouched && (!st.tagTooth || !Number.isInteger(tooth) || tooth < 1 || tooth > 32 || st.missing.includes(tooth));
    const textBad = st.tagTouched && !st.tagText.trim();
    // Validation is silent until blur, and blur validates in place (no re-render: that would detach the field being typed into).
    const toothIn = h('input', { class: 'input pe-toothin' + (toothBad ? ' invalid' : ''), type: 'number', min: '1', max: '32', inputmode: 'numeric', id: 'pe-tag-tooth', testid: 'perio.tag.tooth', value: st.tagTooth, 'aria-invalid': toothBad ? 'true' : null, 'aria-describedby': 'pe-tag-hint', onInput: (ev) => { st.tagTooth = ev.target.value; }, onBlur: () => { st.tagTouched = true; validateTag(st); } });
    const textIn = h('input', { class: 'input' + (textBad ? ' invalid' : ''), type: 'text', id: 'pe-tag-text', testid: 'perio.tag.text', value: st.tagText, maxlength: '140', placeholder: 'What you saw, in observation words', 'aria-invalid': textBad ? 'true' : null, 'aria-describedby': 'pe-tag-hint', onInput: (ev) => { st.tagText = ev.target.value; }, onBlur: () => { st.tagTouched = true; validateTag(st); } });
    wrap.append(h('section', { class: 'card stack', 'aria-label': 'Tag for dentist' },
      h('h2', { text: 'Tag for ' + dentist }),
      h('p', { class: 'small muted', id: 'pe-tag-hint', text: TAG_HINT + (toothBad ? TOOTH_MSG : '') + (textBad ? TEXT_MSG : '') }),
      h('div', { class: 'row', role: 'group', 'aria-label': 'Observation vocabulary' }, ...OBS.map(([code, label]) => btn(label, { kind: 'quiet', class: 'compact', testid: 'perio.tag.obs.' + code, onClick: () => { st.tagText = label + (code === 'caries' ? ' #' + (st.tagTooth || '?') + ' — surface: ' : (code === 'lesion' ? ' — site: ' : '')); rerender(r); const el = document.querySelector('[data-testid="perio.tag.text"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } } }))),
      h('div', { class: 'pe-tagfields' }, h('div', { class: 'field' }, h('label', { for: 'pe-tag-tooth', text: 'Tooth' }), toothIn), h('div', { class: 'field grow' }, h('label', { for: 'pe-tag-text', text: 'Observation' }), textIn)),
      h('div', { class: 'btnrow' }, btn('Save tag', { kind: 'irreversible', testid: 'perio.tag.save', onClick: () => saveTag(st, r) }), btn('Cancel', { kind: 'quiet', testid: 'perio.tag.cancel', onClick: () => { st.tagOpen = false; st.tagTouched = false; rerender(r); const b = document.querySelector('[data-testid="perio.tag.add"]'); if (b) b.focus(); } }))));
    return wrap;
  }
  function savedCard(st, r) {
    const note = S().notes[st.encId] || {}; const deep = deepest(st);
    const card = h('section', { class: 'card stack pe-saved', 'aria-label': 'Exam saved' },
      h('div', { class: 'row' }, chip('clear', 'Saved'), h('h2', { text: (st.mode === 'screening' ? 'Screening' : 'Full chart') + ' saved · exam ' + st.saved.id })),
      h('p', { class: 'small muted', text: 'Derived into the hygiene note from exam ' + clock12(st.savedAt) + ' · author ' + st.saved.author + '. Read-only there; the exam is the source.' }));
    if (st.mode === 'screening') card.append(h('p', { text: 'Screening codes: ' + SEXTANTS.map(([lab], i) => lab + ' ' + st.sextants[i]).join(' · ') + (st.sextants.some((c) => c === '3' || c === '4') ? ' · Full chart due' : '') }));
    else { card.append(h('p', { class: 'pe-note', text: note.perioSummary || '' })); if (note.srpEvidence) card.append(h('p', { class: 'pe-note', text: note.srpEvidence })); }
    if (st.mode === 'full' && !st.saved.skipped) card.append(h('p', { class: 'small muted', text: 'Chart status: full-mouth six-point chart recorded on ' + total(st) + ' sites.' }));
    if (st.mode === 'full' && st.saved.skipped) card.append(h('p', { class: 'small muted', text: 'Chart status: partial chart; ' + st.saved.skipped + ' sites not probed (' + (LICENCES.find(([c]) => c === st.saved.licence) || ['', st.saved.licence])[1] + '). This never reads as a full chart.' }));
    card.append(h('div', { class: 'row pe-next' }, chip(st.mode === 'full' && deep >= 5 ? 'required' : 'clear', st.mode === 'full' && deep >= 5 ? 'Perio maintenance' : 'Recall'), h('span', { text: 'Next visit (practice policy, not a recommendation): ' + recallLine(st) })));
    card.append(h('details', null, h('summary', { class: 'pe-summary', testid: 'perio.saved.why' }, 'How this was derived'), h('p', { class: 'small muted', text: 'Deepest depth, bleeding count, and the chart-status sentence are computed from the frozen site rows in one transaction. The recall interval comes from the practice rule (4 months with BWX when any site is 5 mm or deeper, else 6 months); the dentist\'s plan supersedes it. No quadrant count proposes a billable code.' })));
    card.append(tagBlock(st, r));
    card.append(h('div', { class: 'btnrow' }, btn('Back to Chairs', { kind: 'reversible', testid: 'perio.back', onClick: () => Proto.router.go(r.persona, 'chairs') })));
    return card;
  }

  // ---- Screen ----------------------------------------------------------------------------------
  function rerender(r) {
    const ae = document.activeElement; const tid = ae && ae.getAttribute ? ae.getAttribute('data-testid') : null;
    render(r);
    scrollCursorIntoView();
    if (!tid) return;
    let target = null;
    if (tid.startsWith('perio.grid.cell.')) { const enc = Proto.store.encounter(r.id); const st = enc && stateFor(enc); const key = st && curKey(st); target = (key && document.querySelector('[data-testid="perio.grid.cell.' + key + '"]')) || document.querySelector('[data-testid="' + tid + '"]'); }
    else target = document.querySelector('[data-testid="' + tid + '"]');
    if (target && !target.disabled) target.focus();
  }
  let rendering = false; // mount() replaces the canvas; a blur fired by that removal must not re-enter render
  function render(r) {
    if (rendering) return;
    rendering = true;
    try { renderInner(r); } finally { rendering = false; }
  }
  function renderInner(r) {
    syncStore();
    const enc = Proto.store.encounter(r.id);
    if (!enc) { Proto.screens.shell.mount(h('div', { class: 'stack' }, h('h1', { text: 'No encounter ' + (r.id || '') }), h('div', { class: 'btnrow' }, btn('Back to Chairs', { kind: 'reversible', testid: 'perio.back', onClick: () => Proto.router.go(r.persona, 'chairs') })))); return; }
    const st = stateFor(enc); const pt = Proto.store.patient(enc.patientId); const a = S().appointments.find((x) => x.encounterId === enc.id);
    const name = displayName(pt.name, P().privacy); const key = curKey(st);
    const sub = (a ? 'Chair ' + a.op + ' · ' : '') + (st.priorDate ? 'Prior exam ' + longDate(st.priorDate) + ' ghosted' : 'No prior exam on file') + ' · ' + (32 - st.missing.length) + ' teeth' + (st.missing.length ? ' (x = missing: ' + st.missing.join(', ') + ')' : '') + ' · Keys: 1–9 depth · Space bleed · S suppuration · ⌫ undo · → skip · PgDn next tooth';

    const segFull = btn('Full chart', { kind: 'quiet', testid: 'perio.full', onClick: () => { if (!st.saved) { st.mode = 'full'; st.gate = null; rerender(r); } } }); segFull.setAttribute('aria-pressed', String(st.mode === 'full'));
    const segScr = btn('Screening', { kind: 'quiet', testid: 'perio.screening', ariaLabel: 'Screening lane: six sextant codes in at most 12 keystrokes', onClick: () => { if (!st.saved) { st.mode = 'screening'; st.gate = null; rerender(r); const b = document.querySelector('[data-testid="perio.sextant.' + (st.scur + 1) + '"]'); if (b) b.focus(); } } }); segScr.setAttribute('aria-pressed', String(st.mode === 'screening'));
    const padT = btn(st.padOpen ? 'Hide glove pad' : 'Glove pad', { kind: 'quiet', testid: 'perio.pad.toggle', pressed: st.padOpen, ariaLabel: 'Glove pad: 44 px keys for gloved fingers', onClick: () => { st.padOpen = !st.padOpen; rerender(r); } });
    const setT = btn('Settings', { kind: 'quiet', testid: 'perio.settings', pressed: st.settingsOpen, ariaLabel: 'Perio settings: last key pressed and probing path', onClick: () => { st.settingsOpen = !st.settingsOpen; rerender(r); } }); setT.setAttribute('aria-expanded', String(st.settingsOpen)); setT.setAttribute('aria-controls', 'perio-settings');
    let save;
    if (st.saved) save = btn('Amend this exam', { kind: 'reversible', testid: 'perio.amend', ariaLabel: 'Amend the saved exam: adds a dated addendum, never overwrites', onClick: () => { st.amendGate = Proto.ui.refusal({ code: 'exam_sealed', verb: 'Exam is filed — amend adds an addendum', control: 'Start an addendum', onControl: () => { st.saved = null; st.savedAt = null; st.amendGate = null; st.amending = true; rerender(r); }, why: 'A filed exam is the record. An amendment is a new dated entry by you that links to it; the original is never overwritten.', severity: 'info' }); rerender(r); } });
    else if (st.gate) save = btn('Held', { kind: 'held', testid: 'perio.save', ariaLabel: 'Save exam is held: ' + (st.gate.node.querySelector('.verb') || {}).textContent, onClick: () => { const c = document.querySelector('[data-testid="refusal.control"]'); if (c) c.focus(); } });
    else save = btn('Save exam', { kind: 'irreversible', testid: 'perio.save', ariaLabel: 'Save exam: one transaction, derives the note and the recall', onClick: () => doSave(st, r, null) });

    const page = h('div', { class: 'stack periopage' },
      pageHead('Perio · ' + name, sub, h('div', { class: 'seg', role: 'group', 'aria-label': 'Chart mode' }, segFull, segScr), padT, setT, save));
    if (st.mode === 'full') {
      const priorV = key ? st.prior[key] : null;
      page.append(h('div', { class: 'activesite', 'aria-live': 'polite' }, h('span', { text: st.saved ? 'Exam saved · grid is read-only' : key ? 'Tooth ' + toothOf(key) + ' · site ' + siteOf(key) + ' · prior ' + (priorV != null ? priorV : '—') + (st.pendingZero ? ' · 10+…' : '') : 'All ' + total(st) + ' sites entered · Save exam' }),
        h('span', { class: 'pe-count small', text: 'Sites recorded: ' + probedCount(st) + '/' + total(st) + (skippedCount(st) ? ' · ' + skippedCount(st) + ' not probed' : '') })));
    } else {
      page.append(h('div', { class: 'activesite', 'aria-live': 'polite' }, h('span', { text: st.saved ? 'Screening saved' : st.scur <= 5 ? 'Sextant ' + SEXTANTS[st.scur][0] + ' (teeth ' + SEXTANTS[st.scur][1] + ') · keys 0–4 or *' : 'All six sextants coded · Save exam' }),
        h('span', { class: 'pe-count small', text: 'Codes: ' + st.sextants.filter(Boolean).length + '/6' + (st.sextants.some((c) => c === '3' || c === '4') ? ' · Full chart due' : '') })));
    }
    page.append(h('p', { class: 'pe-flash', 'aria-live': 'polite', 'aria-atomic': 'true', role: 'status', text: st.flash || '' }));
    if (st.gate) page.append(st.gate.node);
    page.append(st.mode === 'full' ? grid(st, r) : sextants(st, r));
    page.append(h('div', { class: 'row pe-legend small muted' }, h('span', { text: 'Cell: depth (or —) · small grey = prior exam · ● bleeding · ◆ suppuration · shaded = 5 mm or deeper · x = missing tooth' }), st.stamp ? h('span', { class: 'stamp', text: st.stamp }) : null));
    if (st.padOpen && !st.saved && st.mode === 'full') { const pd = pad(st, r); pd.classList.add('pad-dock'); page.append(pd); }
    if (st.settingsOpen) page.append(settings(st, r));
    if (st.licenceOpen && !st.saved) page.append(licenceChooser(st, r));
    if (st.amendGate) page.append(st.amendGate);
    if (st.saved) page.append(savedCard(st, r)); else page.append(tagBlock(st, r));
    Proto.screens.shell.mount(page);
    if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; }
  }

  window.addEventListener('hashchange', () => { if (keysOn && Proto.router.current().route !== 'perio') { document.removeEventListener('keydown', onKey); keysOn = false; } });

  Proto.screens.perio = { render, apply: (encId, key) => { const enc = Proto.store.encounter(encId); if (!enc) return null; return apply(stateFor(enc), key, Proto.router.current()); }, buildPath, stateFor };
  Proto.router.on('perio', (r) => Proto.screens.perio.render(r));
})();
