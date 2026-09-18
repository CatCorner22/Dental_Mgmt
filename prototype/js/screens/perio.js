/* Perio (route 'perio', id = encounter id). Keyboard-first six-point grid for one gloved operator.
   Grammar (1-9 depth and advance; 0 then digit = 10+digit, above 15 refused at the control; Space bleeding
   on the last recorded site; S suppuration; Backspace undo and step back; ArrowRight/Down skip as 'not
   probed', never 0; ArrowLeft/Up step back; PageDown next tooth).

   The grammar is a composite-widget grammar, not a document accelerator: the keys act while the focus is
   inside the grid (role=grid) or the screening lane, and everywhere else only when the person has switched
   'Single-key shortcuts' on in Settings (Proto.store.prefsFor().shortcuts, which ships 'off'). With the
   preference off, Space on a focused button activates that button, as every other screen does.

   Glove pad, settings drawer (last key echo + probing path), screening lane (six sextant codes),
   Save exam (irreversible) with the omission-reason gate, derived note card, for-dentist tag. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, displayName, pageHead, longDate } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TODAY = (Proto.seed && Proto.seed.TODAY) || '2026-09-03';
  const UPPER = Array.from({ length: 16 }, (_, i) => i + 1);          // 1..16
  const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i);         // 32..17
  const LICENCES = [['implant', 'Implant'], ['crown_margin', 'Crown margin'], ['not_tolerated', 'Patient could not tolerate'], ['third_molar_absent', 'Third molar absent']];
  const PATHS = [['facial_lingual', 'Facial around, then lingual'], ['quadrant', 'Quadrant by quadrant'], ['arch', 'Arch by arch']];
  const SEXTANTS = [['UR', '1–5'], ['UA', '6–11'], ['UL', '12–16'], ['LL', '17–21'], ['LA', '22–27'], ['LR', '28–32']];
  /* Every observation control starts with the verb it performs; the words it writes into the note are the
     clinical words, which are not the same string as the button's label (INT-verb-labels). */
  const OBS = [
    ['caries', 'Note suspected caries', 'Suspected caries', 'tooth'],
    ['fracture', 'Note fractured restoration', 'Fractured restoration', 'tooth'],
    ['recession', 'Note recession ≥3 mm', 'Recession ≥3 mm', 'tooth'],
    ['mobility', 'Note mobility', 'Mobility', 'tissue'],
    ['lesion', 'Note soft-tissue lesion', 'Soft-tissue lesion', 'tissue'],
    ['other', 'Note another observation', 'Other observation', 'tissue'],
  ];
  // The key meanings live in apply(), which returns the sentence the echo, the flash and the announcement read.

  const S = () => Proto.store.get();
  const P = () => window.__proto;
  let lastStore = null; let states = {}; let keysOn = false; let pathPref = 'facial_lingual';
  const toothOf = (key) => Number(key.slice(1, key.indexOf('-')));
  const siteOf = (key) => Number(key.slice(key.indexOf('-s') + 2));
  const clock12 = Proto.ui.time;                       // one clock for every screen (ui.js)

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
    // A draft belongs to its author: drafts are keyed per author, so the PIN switch on a shared device shows the next author their own.
    const k = enc.id + '|' + Proto.store.currentUser().id;
    if (states[k]) return states[k];
    const prior = priorExam(enc.patientId);
    const missing = (prior && prior.missing) || [];
    const st = { encId: enc.id, prior: (prior && prior.sites) || {}, priorDate: prior ? prior.date : null, missing, path: buildPath(missing, pathPref), cur: 0, sites: {}, history: [], last: null, pendingZero: false,
      mode: 'full', sextants: ['', '', '', '', '', ''], scur: 0, padOpen: false, settingsOpen: false, lastKey: null, keystrokes: 0, flash: null, stamp: null, gate: null, licenceOpen: false, licencePick: null, saved: null, savedAt: null, amending: false,
      tagOpen: false, tagTooth: '', tagText: '', tagErrors: null, tagged: [] };
    states[k] = st; return st;
  }
  const curKey = (st) => st.path[st.cur] || null;
  const siteLabel = (key) => 'tooth ' + toothOf(key) + ' site ' + siteOf(key);
  const total = (st) => st.path.length;
  const probedCount = (st) => Object.values(st.sites).filter((v) => v.depth != null).length;
  /* One count of "not probed", the one the save writes: every site on the path that carries no depth, whether it
     was skipped with the arrow or never reached. Counting only arrow-skips made the gate say 165 and the chooser
     it opened say 0 for the same chart. */
  const skippedCount = (st) => st.path.filter((k) => !(st.sites[k] && st.sites[k].depth != null)).length;
  const deepest = (st) => Math.max(0, ...Object.values(st.sites).map((v) => v.depth || 0));

  // ---- Grammar core (shared by keys and the glove pad); returns the meaning shown and announced ----
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
  function undo(st) {
    const e = st.history.pop(); if (!e) return 'Nothing to undo';
    const removed = st.sites[e.key];
    if (e.prev) st.sites[e.key] = e.prev; else delete st.sites[e.key];
    st.cur = e.cur; const top = st.history[st.history.length - 1]; st.last = top ? top.key : null; st.stamp = null;
    return 'Undo: removed ' + (removed ? (removed.skipped ? 'not probed' : removed.depth + ' mm') : 'nothing') + ' at ' + siteLabel(e.key) + ', stepped back';
  }
  function toggle(st, field) {
    // A not-probed site stores nothing, so it carries no bleeding either: marking it drew a value the save dropped.
    const key = st.last; if (!key || !st.sites[key] || st.sites[key].skipped) return 'Record a depth first';
    const v = st.sites[key]; v[field] = !v[field];
    return (field === 'bleed' ? 'Bleeding ' : 'Suppuration ') + (v[field] ? 'on' : 'off') + ' at ' + siteLabel(key);
  }
  function nextTooth(st, dir) {
    if (dir > 0) { const key = curKey(st); if (!key) return 'Every site is entered. Save exam.'; const t = toothOf(key); let i = st.cur; while (i < st.path.length && toothOf(st.path[i]) === t) i++; st.cur = i; return 'Next tooth' + (curKey(st) ? ': tooth ' + toothOf(curKey(st)) : ', end of path'); }
    let i = Math.min(st.cur, st.path.length) - 1; if (i < 0) return 'Already at the first site';
    const t = toothOf(st.path[i]); while (i > 0 && toothOf(st.path[i - 1]) === t) i--; st.cur = i; return 'Previous tooth: tooth ' + t;
  }
  /* One live region for the whole screen, the shell's #live, written by the verb that changed something.
     The active-site line and the echo below it are torn down and rebuilt by every render, so marking them
     aria-live announced nothing at all: a live region has to survive the change it reports (WCAG 4.1.3).
     The echo holds until the next act replaces it — no timer takes it away (WCAG 2.2.1). */
  function say(st, text, opts) {
    if (!text) return;
    st.flash = text;
    if (!(opts && opts.quiet)) Proto.router.announce(text);
  }
  function depthGate(st, depth, r) {
    // Verb-first and eight words at most: the measured depth stays in the Why, where it cannot push the line over.
    const verb = 'Type a depth of 15 mm or less';
    st.gate = { code: 'depth_gt_15', cur: st.cur, node: gateNode({ code: 'depth_gt_15', verb, control: 'Re-enter the depth', why: 'Probing depths above 15 mm are not recordable; ' + depth + ' mm was refused, the site keeps its previous value and the cursor stays here. Type 0 then a digit for 10 to 15.', onControl: () => { st.gate = null; const c = Proto.router.current(); rerender(c); focusCell(st); } }) };
    // Over a filled site the refused key left no trace in the record, so nothing holds Save: the refusal is announced
    // once (above) and shown in the echo, and renderInner drops the gate with the render.
    const kept = siteDepth(st); if (kept != null) say(st, verb + ' — ' + depth + ' mm refused, site keeps ' + kept + ' mm', { quiet: true });
  }
  const siteDepth = (st) => { const v = curKey(st) && st.sites[curKey(st)]; return v && v.depth != null ? v.depth : null; };
  /* One sealed-exam gate for every way of reaching it: a grammar key, the Amend control, a lane segment. */
  function openAmendGate(st, r) {
    // The addendum starts with an empty two-digit buffer: a "0" pending from before Save is not its first digit.
    if (!st.amendGate) st.amendGate = gateNode({ code: 'exam_sealed', verb: 'Amend the saved exam with an addendum', control: 'Start an addendum', onControl: () => { st.saved = null; st.savedAt = null; st.amendGate = null; st.amending = true; st.pendingZero = false; rerender(Proto.router.current()); }, why: 'A saved exam is the record. Keys no longer change it; an amendment is a new dated entry by you that links to the original, and the original is never overwritten.', severity: 'info' });
    rerender(r || Proto.router.current());
    return 'Exam is saved; start an addendum to change it';
  }
  function apply(st, k, r) {
    if (st.saved) return openAmendGate(st, r);
    if (st.mode === 'screening') { const out = applyScreening(st, k); setTimeout(() => focusSextant(st), 0); return out; }
    if (/^[0-9]$/.test(k)) {
      const d = Number(k);
      if (st.pendingZero) { st.pendingZero = false; const depth = 10 + d; if (depth > 15) { depthGate(st, depth, r); return 'Depth ' + depth + ' mm refused (above 15)'; } return record(st, depth); }
      if (d === 0) { st.pendingZero = true; return 'Waiting for the second digit (10 or more)'; }
      return record(st, d);
    }
    st.pendingZero = false;
    if (k === ' ') return toggle(st, 'bleed');
    if (k === 's' || k === 'S') return toggle(st, 'sup');
    if (k === 'Backspace') return undo(st);
    if (k === 'ArrowRight' || k === 'ArrowDown') return skip(st);
    if (k === 'ArrowLeft' || k === 'ArrowUp') { if (st.cur > 0) st.cur--; return 'Step back to ' + (curKey(st) ? siteLabel(curKey(st)) : 'start'); }
    if (k === 'PageDown') return nextTooth(st, 1);
    if (k === 'PageUp') return nextTooth(st, -1);
    return null;
  }
  const uncoded = (st) => st.sextants.filter((c) => !c).length;
  function focusSextant(st) { const b = document.querySelector('[data-testid="perio.sextant.' + (st.scur + 1) + '"]'); if (b) b.focus(); }
  function applyScreening(st, k) {
    if (/^[0-4]$/.test(k) || k === '*') { if (st.scur > 5) return uncoded(st) ? 'Past the last sextant; go back to code the ' + uncoded(st) + ' empty' : 'All six sextants coded. Save exam.'; st.sextants[st.scur] = k; st.scur++; return 'Sextant ' + SEXTANTS[st.scur - 1][0] + ' = ' + k; }
    if (k === 'Backspace') { if (st.scur === 0) return 'Nothing to undo'; st.scur--; st.sextants[st.scur] = ''; return 'Undo: cleared sextant ' + SEXTANTS[st.scur][0]; }
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') { if (st.scur < 5) st.scur++; return 'Next sextant'; }
    if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { if (st.scur > 0) st.scur--; return 'Previous sextant'; }
    return null;
  }

  // ---- Document keydown -------------------------------------------------------------------------
  /* Single-character accelerators are opt-in (CUST-2.1.4): with the preference off — the shipped default —
     the grammar acts only while the focus is inside the instrument it belongs to, the perio grid or the
     screening lane, the way any composite widget owns its keys. Switch 'Single-key shortcuts' on in
     Settings and the same keys work wherever the focus is on this route. */
  const WORK_SURFACE = '[data-testid="perio.grid"], .pe-sextants';
  function shortcutsOn() { try { const pr = Proto.store.prefsFor && Proto.store.prefsFor(); return !!pr && pr.shortcuts === 'on'; } catch (e) { return false; } }
  function inWorkSurface(t) { return !!(t && t.closest && t.closest(WORK_SURFACE)); }
  function onKey(ev) {
    const r = Proto.router.current();
    if (r.route !== 'perio') { document.removeEventListener('keydown', onKey); keysOn = false; return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target;
    if (document.querySelector('.overlay')) return;          // a real dialog owns Escape and every other key
    const enc = Proto.store.encounter(r.id); if (!enc) return;
    const st = stateFor(enc); const k = ev.key;
    // Escape dismisses the inline sub-forms as it dismisses a dialog, from inside their fields too, and hands
    // focus back to the control that opened them.
    if (k === 'Escape' && (st.licenceOpen || st.tagOpen)) {
      const inTag = t && t.closest && t.closest('.pe-tag'); const inReason = t && t.closest && t.closest('.pe-licence');
      if (inTag && !st.tagOpen) return; if (inReason && !st.licenceOpen) return;
      ev.preventDefault(); closeInline(st, r, inTag ? 'tag' : inReason ? 'reason' : undefined); return;
    }
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const onCell = t && t.classList && t.classList.contains('psite');
    const onControl = t && !onCell && ['BUTTON', 'SUMMARY', 'A'].includes(t.tagName);
    // Enter and Tab stay native so every control is still keyboard-operable.
    if (k === 'Enter' || k === 'Tab' || k === 'Escape') return;
    if (!inWorkSurface(t) && !shortcutsOn()) return;   // the accelerator is off; the instrument keeps its own keys
    if (onControl && k === ' ') {
      // Only reachable with the accelerator switched on: the person asked for Space to be the bleeding key.
      if (st.saved) return;
      ev.preventDefault();
      const meaningSpace = apply(st, ' ', r);
      if (meaningSpace) { st.keystrokes++; st.lastKey = { key: 'Space', meaning: meaningSpace }; say(st, meaningSpace); rerender(r); }
      return;
    }
    const meaning = apply(st, k, r);
    if (!meaning) return;
    ev.preventDefault();
    st.keystrokes++; st.lastKey = { key: k === ' ' ? 'Space' : k, meaning };
    if (st.padOpen) st.padOpen = false; // the pad hides when a key or pedal event arrives
    say(st, meaning);
    rerender(r);
  }
  function viaPad(st, r, k) { const meaning = apply(st, k, r); if (!meaning) return; st.keystrokes++; st.lastKey = { key: 'Pad ' + (k === ' ' ? 'Bleeding' : k), meaning }; say(st, meaning); rerender(r); }

  // ---- Save ----------------------------------------------------------------------------------
  function buildSites(st) {
    const out = {};
    if (st.mode === 'screening') { st.sextants.forEach((c, i) => { out['sx' + (i + 1)] = { sextant: SEXTANTS[i][0], code: c, depth: null, bleed: false, skipped: false }; }); return out; }
    for (const key of st.path) { const v = st.sites[key]; out[key] = v && v.depth != null ? { depth: v.depth, bleed: !!v.bleed, sup: !!v.sup, skipped: false } : { depth: null, bleed: false, sup: false, skipped: true }; }
    return out;
  }
  const support = Proto.ui.support;                     // one support line for every outage gate (ui.js)
  // Every control acts: the store's words each do the thing they name (the pad, Roles, the note, the support line);
  // otherwise the gate falls and the keyboard returns to the cursor.
  const BY_WORD = {
    'Switch author': (st) => Proto.screens.shell.openPinPad(Proto.router.current()),
    'Open Roles': () => { location.hash = '#/owner/roles'; },   // the seat that issues a pass
    'Open the note': (st) => { const r = Proto.router.current(); Proto.router.go(r.persona, 'encounter', st.encId); },
    'Support line': support,
  };
  /* The shared refusal ships its severity mark at text size. A warning has to survive grayscale and a
     glance, so the mark this screen renders is given a 24 px box (CDS-WARNING-text-icon). */
  const BIG_GLYPH = 'font-size: var(--space-5); width: var(--space-5); height: var(--space-5); min-width: var(--space-5); display: inline-flex; align-items: center; justify-content: center; line-height: 1;';
  function gateNode(v) {
    const el = refusal(v);
    const g = el.querySelector('.glyph');
    if (g) g.setAttribute('style', BIG_GLYPH);
    return el;
  }
  /* The read-back a two-step confirm raises carries the same 24 px mark; it is built on the press, so the
     slot is watched rather than styled once. */
  function confirmable(label, opts) {
    const slot = Proto.ui.confirmable(label, opts);
    const paint = () => { const g = slot.querySelector('.confirmrow .glyph'); if (g) g.setAttribute('style', BIG_GLYPH); };
    if (window.MutationObserver) new MutationObserver(paint).observe(slot, { childList: true, subtree: true });
    return slot;
  }
  function mkGate(st, res, onControl) {
    const act = onControl || (res.code === 'outage' ? support : BY_WORD[res.control] ? () => BY_WORD[res.control](st) : () => { st.gate = null; rerender(Proto.router.current()); });
    st.gate = { code: res.code, node: gateNode({ code: res.code, verb: res.verb, control: res.control, why: res.why, severity: res.code === 'outage' ? 'stop' : 'required', onControl: act }) };
  }
  // A gate names the next thing to do, so the keyboard lands on it rather than on the Held primary behind it.
  function focusGateControl() { const c = document.querySelector('[data-testid="refusal.control"]'); if (c) c.focus(); }
  function doSave(st, r, licence) {
    st.pendingZero = false;
    // A second dispatch in the same tick lands on a saved exam: it is the amend path, not a second Save.
    if (st.saved) { openAmendGate(st, r); return; }
    if (st.mode === 'screening' && st.sextants.some((c) => c === '')) { const n = st.sextants.filter((c) => c === '').length; mkGate(st, { code: 'screening_incomplete', verb: 'Code ' + n + ' more sextant' + (n > 1 ? 's' : '') + ' before Save', control: 'Go to the first empty sextant', why: 'Screening saves six codes (0 to 4, or * for furcation, mobility, or recession). An empty box would read as 0.' }, () => { st.gate = null; st.scur = st.sextants.indexOf(''); rerender(r); const b = document.querySelector('[data-testid="perio.sextant.' + (st.scur + 1) + '"]'); if (b) b.focus(); }); rerender(r); focusGateControl(); return; }
    const res = Proto.store.savePerio(st.encId, buildSites(st), { mode: st.mode, licence: licence || undefined, amending: !!st.amending });
    if (!res.ok) {
      // The reasons open with the gate: the chart is finished, so the remaining decision is the reason and one Save.
      if (res.code === 'omission_licence') { st.licenceOpen = true; mkGate(st, res, () => { const b = document.querySelector('[data-testid="perio.licence.' + LICENCES[0][0] + '"]'); if (b) b.focus(); }); }
      // Only the store's "saved exam" refusal is the amend gate; its filed-note refusal keeps the store's words and
      // its control opens the note, where the addendum is written.
      else if (res.code === 'exam_sealed' && res.control === 'Start an addendum') { st.gate = null; openAmendGate(st, r); focusGateControl(); return; }
      else mkGate(st, res);
      rerender(r); focusGateControl(); return;
    }
    st.gate = null; st.licenceOpen = false; st.licencePick = null; st.amending = false; st.saved = res.exam; st.savedAt = S().clock.time; st.padOpen = false; st.flash = null;
    Proto.screens.shell.refreshAndon(r); if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    rerender(r);
    Proto.router.announce('Exam saved');   // one line; the card beside it carries the note, the recall and the count
    const b = document.querySelector('[data-testid="perio.tag.add"]'); if (b) b.focus();
  }
  /* The chip beside the line carries this, so it is the short form and it is said once (CLT-redundancy). */
  function recallLine(st) {
    if (st.mode === 'screening') return st.sextants.some((c) => c === '3' || c === '4') ? 'Full chart due' : '6-month recall';
    return deepest(st) >= 5 ? '4-month perio maintenance with BWX' : '6-month recall';
  }
  /* Escape leaves an inline sub-form the way it leaves a dialog, and focus returns to the control that opened it. */
  function closeInline(st, r, which) {
    const w = which || (st.licenceOpen ? 'reason' : 'tag');
    if (w === 'reason' && st.licenceOpen) { st.licenceOpen = false; st.licencePick = null; st.gate = null; rerender(r); const b = document.querySelector('[data-testid="perio.save"]'); if (b) b.focus(); return; }
    // Cancel discards the form: the abandoned observation came back pre-filled the next time it opened.
    if (st.tagOpen) { st.tagOpen = false; st.tagTooth = ''; st.tagText = ''; st.tagErrors = null; rerender(r); const b = document.querySelector('[data-testid="perio.tag.add"]'); if (b) b.focus(); }
  }

  // ---- The tag form ------------------------------------------------------------------------------
  const TAG_HINT = 'A finding, not a diagnosis. The tag lands as a checklist row on the dentist\'s exam; the note cannot be filed until it has a disposition.';
  const TOOTH_HINT = 'Required. A tooth number from 1 to 32 that is present in this mouth.';
  const TEXT_HINT = 'Required. Say what you saw, in observation words, up to 140 characters.';
  const TOOTH_MSG = 'Tooth: enter a number from 1 to 32 that is present in this mouth.';
  const TEXT_MSG = 'Observation: say what you saw.';
  const toothInvalid = (st) => { const t = Number(st.tagTooth); return !st.tagTooth || !Number.isInteger(t) || t < 1 || t > 32 || st.missing.includes(t); };
  const textInvalid = (st) => !st.tagText.trim();
  /* Validation happens on the press, never on the way out of a field: leaving Tooth to type into Observation
     used to raise a refusal against a field the person had not finished (INT-keep-data-and-gate-on-press).
     A blur may only take an error away, and it does that in place so the field being left is not detached. */
  function clearOnBlur(st, which) {
    if (!st.tagErrors || !st.tagErrors[which]) return;
    if (which === 'tooth' ? toothInvalid(st) : textInvalid(st)) return;
    st.tagErrors[which] = null;
    const wrap = document.getElementById(which === 'tooth' ? 'pe-tag-tooth' : 'pe-tag-text');
    const field = wrap && wrap.closest('.field');
    if (field && field._setError) field._setError(null);
    const sum = document.querySelector('[data-testid="perio.tag.errors"]');
    if (sum && !st.tagErrors.tooth && !st.tagErrors.text) sum.remove();
  }
  function saveTag(st, r) {
    const errs = { tooth: toothInvalid(st) ? TOOTH_MSG : null, text: textInvalid(st) ? TEXT_MSG : null };
    st.tagErrors = errs;
    if (errs.tooth || errs.text) {
      rerender(r);
      const sum = document.querySelector('[data-testid="perio.tag.errors"]');
      if (sum) sum.focus(); else { const el = document.querySelector('[data-testid="perio.tag.' + (errs.tooth ? 'tooth' : 'text') + '"]'); if (el) el.focus(); }
      return;
    }
    const res = Proto.store.addTag(st.encId, Number(st.tagTooth), [], st.tagText.trim());
    if (!res.ok) { mkGate(st, res); rerender(r); focusGateControl(); return; }
    const tooth = Number(st.tagTooth);
    st.tagged.push(res.tag); st.tagOpen = false; st.tagText = ''; st.tagErrors = null; Proto.store.retireChip('tag');
    Proto.screens.shell.refreshAndon(r); if (Proto.screens.shell.refreshRail1) Proto.screens.shell.refreshRail1(r);
    rerender(r); Proto.router.announce('Tagged tooth ' + tooth + ' for the dentist. A finding, not a diagnosis.');
    const b = document.querySelector('[data-testid="perio.tag.add"]'); if (b) b.focus();
  }

  // ---- Pieces ----------------------------------------------------------------------------------
  /* The grid scrolls inside its own box, sized to the room under it, so the pad and the active-site line above it
     stay on screen while the cursor walks the lower arch. A box that scrolls has to be reachable from the
     keyboard, sideways or downwards (WCAG 2.1.1); ui.js only watches the sideways case, so the downwards one
     is claimed here, after its observer has run. */
  function fitGrid() {
    const w = document.querySelector('.perio-wrap'); const canvas = document.getElementById('canvas'); if (!w || !canvas) return;
    const top = w.getBoundingClientRect().top + canvas.scrollTop;
    w.style.maxHeight = Math.max(200, window.innerHeight - top - 12) + 'px'; w.style.overflowY = 'auto';
    requestAnimationFrame(() => {
      const el = document.querySelector('.perio-wrap');
      if (el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) el.setAttribute('tabindex', '0');
    });
  }
  function scrollCursorIntoView() {
    const a = document.querySelector('.psite.active');
    if (!a) return;
    const b = a.getBoundingClientRect(); const w = a.closest('.perio-wrap'); const wb = w ? w.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    /* The smallest scroll that reveals the cursor, so the glove pad above the grid stays on screen with it. */
    if (b.top < Math.max(90, wb.top) || b.bottom > Math.min(window.innerHeight - 8, wb.bottom)) a.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
  function focusCell(st) { const key = curKey(st); const b = key && document.querySelector('[data-testid="perio.grid.cell.' + key + '"]'); if (b) b.focus(); }
  function cell(st, r, t, s) {
    const key = 't' + t + '-s' + s; const missing = st.missing.includes(t);
    /* A tooth that is not in the mouth is not a control that cannot act: it is a fact, so it is printed as
       text inside its cell rather than as a dimmed button nobody can use (INT-no-disabled-use-held). */
    if (missing) {
      return h('td', { role: 'gridcell', class: 'pe-cell', 'aria-label': 'Tooth ' + t + ' site ' + s + ', missing tooth' },
        h('span', { class: 'psite missing', 'aria-hidden': 'true', style: 'color: var(--ink-2)', text: 'x' }));
    }
    const v = st.sites[key]; const idx = st.path.indexOf(key);
    const active = !st.saved && curKey(st) === key;
    const cls = ['psite']; if (active) cls.push('active');
    if (v && v.bleed) cls.push('bleed'); if (v && v.depth >= 5) cls.push('deep'); if (v && v.skipped) cls.push('skipped'); if (v && v.sup) cls.push('sup');
    const desc = [v && v.depth != null ? v.depth + ' mm' : v && v.skipped ? 'not probed' : 'not entered', v && v.bleed ? 'bleeding' : null, v && v.sup ? 'suppuration' : null, st.prior[key] != null ? 'prior ' + st.prior[key] : null].filter(Boolean).join(', ');
    /* The cell is the widget: 168 buttons were 168 tab stops and 168 button identities for one instrument.
       Roving tabindex makes the grid one tab stop, and the cursor is the stop
       (INT-temp-first-screenful, CLT-similarity-identity, CLT-chunk-4). */
    /* Past the last site (the final site skipped) no cell is the cursor, so the last cell keeps the stop: the grid
       reads keys only from inside itself (CUST-2.1.4), and a keyboard has to be able to come back to step back. */
    const pastEnd = !st.saved && st.cur >= st.path.length && idx === st.path.length - 1;
    const roving = active || (st.saved && idx === 0) || pastEnd ? '0' : '-1';
    const face = h('span', { class: cls.join(' ') }, v && v.depth != null ? String(v.depth) : '—');
    // The ghosted prior depth is drawn by CSS from data-prior, so it is not part of the cell's text: the printed depth alone is
    // what a voice user says and what the name leads with (WCAG 2.5.3); the description still carries 'prior N'.
    if (st.prior[key] != null) face.dataset.prior = String(st.prior[key]);
    /* The name leads with the printed depth when there is one, so what a voice user sees is what they say
       (WCAG 2.5.3, axe label-content-name-mismatch); the tooth and site follow, and the rest is the description. */
    const name = (v && v.depth != null ? v.depth + ' mm, ' : '') + 'Tooth ' + t + ' site ' + s;
    return h('td', { role: 'gridcell', class: 'pe-cell', tabindex: roving, testid: 'perio.grid.cell.' + key, 'aria-label': name, 'aria-description': desc, title: desc,
      onClick: () => { if (st.saved) { openAmendGate(st, r); return; } if (idx < 0) return; st.cur = idx; st.padOpen = true; say(st, 'Cursor at ' + siteLabel(key) + (st.prior[key] != null ? ', prior ' + st.prior[key] + ' mm' : '')); rerender(r); } }, face);
  }
  const KEY_LEGEND = [['1–9', 'depth'], ['Space', 'bleeding'], ['S', 'suppuration'], ['⌫', 'undo'], ['→', 'not probed'], ['PgDn', 'next tooth']];
  function grid(st, r) {
    const table = h('table', { class: 'perio', role: 'grid', 'aria-label': 'Six-point perio grid, 32 teeth' });
    for (const [name, teeth] of [['Upper', UPPER], ['Lower', LOWER]]) {
      table.append(h('thead', { role: 'rowgroup' }, h('tr', { role: 'row' }, h('th', { role: 'columnheader', class: 'pe-rowlab', scope: 'col', text: name }), ...teeth.map((t) => h('th', { role: 'columnheader', scope: 'col', text: String(t) })))));
      const body = h('tbody', { role: 'rowgroup' });
      for (const s of [1, 2, 3, 4, 5, 6]) body.append(h('tr', { role: 'row' }, h('th', { role: 'rowheader', class: 'pe-rowlab', scope: 'row', text: (s <= 3 ? 'F' : 'L') + s }), ...teeth.map((t) => cell(st, r, t, s))));
      table.append(body);
    }
    const region = Proto.ui.scrollRegion('Perio grid', 'perio.grid:perio-wrap', table);
    region.setAttribute('aria-keyshortcuts', '1 2 3 4 5 6 7 8 9 0 Space S Backspace ArrowRight ArrowLeft PageDown PageUp');
    // The two-digit buffer belongs to the grid: leaving it drops a pending "0" rather than carrying it to the next key.
    region.addEventListener('focusout', (ev) => { if (!rendering && st.pendingZero && !(ev.relatedTarget && region.contains(ev.relatedTarget))) st.pendingZero = false; });
    /* The legend lives in the box with the cells it explains, not 440 px below them (CLT-split-attention),
       and the keys are printed beside the instrument they drive (CLT-recognition-keys). */
    const legend = h('div', { class: 'stack pe-legend-in' },
      h('p', { class: 'small muted', style: 'color: var(--ink-2)', id: 'pe-cellleg', text: 'Cell: depth in mm · — not entered · grey = prior exam · ● bleeding · ◆ suppuration · shaded = 5 mm or more · x = missing' + (st.missing.length ? ' (' + st.missing.join(', ') + ')' : '') }),
      h('p', { class: 'small muted', style: 'color: var(--ink-2)' }, 'Keys, while a cell has the focus: ',
        ...KEY_LEGEND.map(([k, what], i) => h('span', null, i ? ' · ' : '', kbd(k), ' ' + what))));
    return h('section', { class: 'card stack pe-gridcard', 'aria-labelledby': 'pe-gridhead' },
      h('h2', { id: 'pe-gridhead', class: 'small', text: 'Perio grid · six sites a tooth' }), legend, region);
  }
  function sextants(st, r) {
    return h('section', { class: 'card stack', 'aria-labelledby': 'pe-sxhead' },
      h('h2', { id: 'pe-sxhead', class: 'small', text: 'Screening: six sextant codes' }),
      h('p', { class: 'small muted', style: 'color: var(--ink-2)' }, 'Keys, while a sextant has the focus: ', kbd('0–4'), ' code · ', kbd('*'), ' furcation, mobility or recession · ', kbd('⌫'), ' undo · ', kbd('→'), ' next sextant'),
      h('div', { class: 'pe-sextants', role: 'group', 'aria-labelledby': 'pe-sxhead', 'aria-keyshortcuts': '0 1 2 3 4 * Backspace ArrowRight ArrowLeft' }, ...SEXTANTS.map(([lab, range], i) => {
        const code = st.sextants[i]; const cls = ['psite', 'pe-sextant']; if (!st.saved && st.scur === i) cls.push('active'); if (code === '3' || code === '4') cls.push('deep'); if (code === '*') cls.push('bleed');
        return h('button', { type: 'button', class: cls.join(' '), testid: 'perio.sextant.' + (i + 1), 'aria-label': 'Sextant ' + lab + ', teeth ' + range + (code ? ', code ' + code : ', no code yet'), onClick: () => { if (!st.saved) { st.scur = i; rerender(r); } } },
          h('span', { class: 'pe-sxcode', text: code || '—' }), h('span', { class: 'small muted', style: 'color: var(--ink-2)', text: lab + ' · ' + range }));
      })));
  }
  /* The glove pad is a keypad, not a row of buttons: its keys wear the keycap identity the grid cells wear,
     each prints the keystroke it stands for, and it is split into three named groups of at most ten
     (CLT-chunk-4, CLT-common-region, CLT-recognition-keys, CDS-BTN-text-bold-body). */
  const KBD_STYLE = 'font-family: inherit; font-size: var(--fs-1); border: 1px solid var(--line-strong); border-radius: var(--radius); padding: 0 var(--space-1); line-height: 1.4;';
  const kbd = (t) => h('kbd', { class: 'pe-kbd', style: KBD_STYLE, text: t });
  // A keycap prints its own keystroke; where the cap is one key wide the keystroke is declared instead of
  // printed twice, which is the other half of the same rule (CLT-recognition-keys).
  function padKey(st, r, k, label, tid, aria, shortcut, style) {
    const b = h('button', { type: 'button', class: 'psite pe-padkey', testid: tid, style: style || null,
      'aria-label': Proto.ui.leadWithLabel(label, aria), 'aria-keyshortcuts': shortcut, onClick: () => viaPad(st, r, k) }, label);
    if (shortcut && shortcut !== label && style) b.append(kbd(shortcut === ' ' ? 'Space' : shortcut));
    return b;
  }
  const WIDE = 'width: auto;';
  // Every group name is printed inside the group it names, not beside it (CLT-common-region).
  const groupLabel = (id, text) => h('p', { class: 'small muted', id, style: 'color: var(--ink-2); grid-column: 1 / -1; margin: 0;', text });
  function pad(st, r) {
    const wide = { style: 'display: grid; grid-template-columns: repeat(2, minmax(var(--target), 11rem)); gap: var(--gap); margin-top: var(--space-2);' };
    const digits = h('div', { class: 'pad', role: 'group', 'aria-labelledby': 'pe-paddepth' },
      groupLabel('pe-paddepth', 'Depth at the cursor, in millimetres'),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => padKey(st, r, String(n), String(n), 'perio.pad.key.' + n, 'Record ' + n + ' mm at the cursor', String(n))),
      padKey(st, r, '0', '10+', 'perio.pad.key.0', 'Record 10 mm or deeper: press this, then the second digit', '0'));
    const marks = h('div', Object.assign({ role: 'group', 'aria-labelledby': 'pe-padmarks' }, wide),
      groupLabel('pe-padmarks', 'Marks on the last recorded site'),
      padKey(st, r, ' ', 'Bleeding', 'perio.pad.bleed', 'Mark bleeding on the last recorded site', 'Space', WIDE),
      padKey(st, r, 's', 'Suppuration', 'perio.pad.supp', 'Mark suppuration on the last recorded site', 'S', WIDE));
    const move = h('div', Object.assign({ role: 'group', 'aria-labelledby': 'pe-padmove' }, wide),
      groupLabel('pe-padmove', 'Move the cursor'),
      padKey(st, r, 'ArrowRight', 'Skip', 'perio.pad.skip', 'Skip this site, stored as not probed, never 0', '→', WIDE),
      padKey(st, r, 'Backspace', 'Undo', 'perio.pad.undo', 'Undo the last entry and step back', '⌫', WIDE),
      padKey(st, r, 'PageDown', 'Next tooth', 'perio.pad.next', 'Go to the next tooth', 'PgDn', WIDE));
    // Three named key groups, not one box of fifteen controls (CLT-chunk-4).
    return h('div', { class: 'stack pe-padcard' },
      h('h2', { id: 'pe-padhead', class: 'small', text: 'Glove pad' }), digits, marks, move);
  }
  function settings(st, r) {
    const lk = st.lastKey;
    // The drawer opens below the grid, so it takes focus and scrolls itself in. tabindex -1 keeps it out of the Tab order.
    return h('section', { class: 'card stack pe-settings', 'aria-label': 'Perio settings', id: 'perio-settings', tabindex: '-1' },
      h('h2', { text: 'Perio settings' }),
      h('p', { class: 'pe-lastkey', text: 'Last key pressed: ' + (lk ? lk.key + ' → ' + lk.meaning : 'none yet. Press any key on a clicker or pedal to see how it maps.') }),
      h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'Any HID device that emits keystrokes works without a driver. Keystrokes this exam: ' + st.keystrokes + ' (counted, never scored per person).' }),
      h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'The keys act while a cell or a sextant has the focus. To use them wherever the focus is, switch Single-key shortcuts on in Settings on the top bar; it ships off.' }),
      h('div', { class: 'field' }, h('span', { class: 'small muted', style: 'color: var(--ink-2)', id: 'pe-pathlab', text: 'Probing path (your preference, chosen once)' }),
        h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'pe-pathlab' }, ...PATHS.map(([code, label]) => btn(label, { kind: 'quiet', testid: 'perio.path.' + code, pressed: pathPref === code, onClick: () => { pathPref = code; const key = curKey(st); st.path = buildPath(st.missing, code); st.cur = key ? Math.max(0, st.path.indexOf(key)) : 0; rerender(r); } })))),
      h('details', null, h('summary', { class: 'pe-summary', testid: 'perio.settings.grammar' }, 'The five-key grammar'), h('ul', { class: 'pe-list small' },
        h('li', { text: '1–9 record the depth and advance; 0 then a digit records 10 to 15; above 15 is refused.' }),
        h('li', { text: 'Space toggles bleeding and S suppuration on the last recorded site.' }),
        h('li', { text: 'Backspace undoes the last entry and steps back; the echo above the grid names what it removed.' }),
        h('li', { text: 'Right or Down arrow skips the site as not probed (never 0); Left or Up steps back; PageDown jumps to the next tooth.' }),
        h('li', { text: 'Every keystroke autosaves to this session only; the stamp under the grid names the last complete tooth.' }))));
  }
  /* One reason covers every unprobed site. The reasons are a choice, not four irreversible buttons: the gate
     lands the keyboard on a quiet toggle, and one held primary underneath does the saving, last in its region
     (CLT-neutral-irreversible, INT-one-primary-per-view, INT-no-disabled-use-held, CLT-serial-position). */
  function licenceChooser(st, r) {
    const n = skippedCount(st);
    const picked = LICENCES.find(([c]) => c === st.licencePick);
    const save = picked
      ? btn('Save exam with this reason', { kind: 'irreversible', testid: 'perio.licence.confirm', ariaLabel: 'Save exam with this reason: ' + picked[1] + '. One transaction; the exam is then the record.', onClick: () => doSave(st, r, picked[0]) })
      : btn('Save exam with this reason', { kind: 'held', testid: 'perio.licence.confirm', onClick: () => { const b = document.querySelector('[data-testid="perio.licence.' + LICENCES[0][0] + '"]'); if (b) b.focus(); } });
    return h('section', { class: 'card stack pe-licence', 'aria-labelledby': 'pe-reasonhead' },
      h('h2', { id: 'pe-reasonhead', text: (n === 1 ? 'Why was 1 site' : 'Why were ' + n + ' sites') + ' not probed?' }),
      h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'One reason covers every site left unprobed. The note says which sites were not probed and why; a blank never reads as a full chart.' }),
      h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'pe-reasonhead' }, ...LICENCES.map(([code, label]) => btn(label, { kind: 'quiet', testid: 'perio.licence.' + code, pressed: st.licencePick === code, onClick: () => { st.licencePick = code; say(st, 'Reason chosen: ' + label, { quiet: true }); rerender(r); const b = document.querySelector('[data-testid="perio.licence.confirm"]'); if (b) b.focus(); } }))),
      h('div', { class: 'btnrow' }, btn('Cancel', { kind: 'quiet', testid: 'perio.licence.cancel', ariaLabel: 'Cancel: keep charting, nothing is saved', onClick: () => closeInline(st, r, 'reason') }),
        picked ? null : h('span', { class: 'small muted', style: 'color: var(--ink-2)', text: 'Choose one reason above and Save becomes live.' }), save));
  }
  function tagBlock(st, r) {
    // Read from the record, and say "the dentist" when the record names none.
    const dentist = (() => { const a = S().appointments.find((x) => x.encounterId === st.encId); const u = a && Proto.store.user(a.providerId); return u && u.role !== 'hygienist' && u.role !== 'assistant' ? u.short : null; })();
    const wrap = h('div', { class: 'stack pe-tag' });
    if (st.tagged.length) wrap.append(h('div', { class: 'row' }, ...st.tagged.map((t) => chip('review', 'Tagged #' + t.tooth + ' · waiting for dentist'))));
    // The tooth the operator is on, not the deepest pocket in the mouth.
    const atCursor = curKey(st) || st.last;
    if (!st.tagOpen) { wrap.append(h('div', { class: 'btnrow' }, btn('Tag for dentist', { kind: 'reversible', testid: 'perio.tag.add', ariaLabel: 'Tag a tooth for the dentist: a finding, not a diagnosis', onClick: () => { st.tagOpen = true; st.tagErrors = null; if (!st.tagTooth && atCursor) st.tagTooth = String(toothOf(atCursor)); rerender(r); const el = document.querySelector('[data-testid="perio.tag.tooth"]'); if (el) el.focus(); } }))); return wrap; }
    const errs = st.tagErrors || { tooth: null, text: null };
    const toothIn = h('input', { class: 'input pe-toothin', type: 'number', min: '1', max: '32', inputmode: 'numeric', id: 'pe-tag-tooth', testid: 'perio.tag.tooth', value: st.tagTooth,
      onInput: (ev) => { st.tagTooth = ev.target.value; }, onBlur: () => clearOnBlur(st, 'tooth') });
    const textIn = h('input', { class: 'input', type: 'text', id: 'pe-tag-text', testid: 'perio.tag.text', value: st.tagText, maxlength: '140', placeholder: 'What you saw, in observation words',
      onInput: (ev) => { st.tagText = ev.target.value; }, onBlur: () => clearOnBlur(st, 'text') });
    const toothField = Proto.ui.field('Tooth', toothIn, { hint: TOOTH_HINT, required: true });
    const textField = Proto.ui.field('Observation', textIn, { hint: TEXT_HINT, required: true });
    if (errs.tooth) toothField._setError(errs.tooth);
    if (errs.text) textField._setError(errs.text);
    const summary = Proto.ui.errorSummary([errs.tooth ? { id: 'pe-tag-tooth', message: errs.tooth } : null, errs.text ? { id: 'pe-tag-text', message: errs.text } : null].filter(Boolean), { testid: 'perio.tag.errors' });
    const obsBtn = ([code, label, words]) => btn(label, { kind: 'quiet', class: 'compact', testid: 'perio.tag.obs.' + code, onClick: () => { st.tagText = words + (code === 'caries' ? ' #' + (st.tagTooth || '?') + ' — surface: ' : (code === 'lesion' ? ' — site: ' : '')); if (st.tagErrors) st.tagErrors.text = null; rerender(r); const el = document.querySelector('[data-testid="perio.tag.text"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } } });
    /* Two bounded regions of at most six controls rather than one of eleven, each with a name you can see
       (CLT-chunk-4, CLT-common-region); the words come first because they write into the field below them,
       and the region that finishes ends with the control that finishes it (CLT-serial-position). */
    wrap.append(h('section', { class: 'card stack', 'aria-labelledby': 'pe-obshead' },
      h('h2', { id: 'pe-obshead', class: 'small', text: 'Common observation words' }),
      h('div', { class: 'row', role: 'group', 'aria-labelledby': 'pe-obs-tooth' },
        h('span', { class: 'small muted', id: 'pe-obs-tooth', style: 'color: var(--ink-2)', text: 'About a tooth' }), ...OBS.filter((o) => o[3] === 'tooth').map(obsBtn)),
      h('div', { class: 'row', role: 'group', 'aria-labelledby': 'pe-obs-tissue' },
        h('span', { class: 'small muted', id: 'pe-obs-tissue', style: 'color: var(--ink-2)', text: 'About the tissue' }), ...OBS.filter((o) => o[3] === 'tissue').map(obsBtn))));
    wrap.append(h('section', { class: 'card stack', 'aria-labelledby': 'pe-taghead' },
      h('h2', { id: 'pe-taghead', text: 'Tag for ' + (dentist || 'the dentist') }),
      h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: TAG_HINT }),
      summary,
      h('div', { class: 'pe-tagfields' }, toothField, textField),
      h('div', { class: 'btnrow' }, btn('Cancel', { kind: 'quiet', testid: 'perio.tag.cancel', ariaLabel: 'Cancel: close this tag, nothing is written', onClick: () => closeInline(st, r, 'tag') }),
        confirmable('Save tag', { testid: 'perio.tag.save', severity: 'required', readback: 'This cannot be undone: the tag goes to the dentist\'s exam and holds the note until it has a disposition.', confirmLabel: 'Save tag', ariaLabel: 'Save tag: send this finding to the dentist', onConfirm: () => saveTag(st, r) }))));
    return wrap;
  }
  function savedCard(st, r) {
    const note = S().notes[st.encId] || {}; const deep = deepest(st);
    // Each fact once: the chip word names the state, the heading names the thing, and neither repeats the other.
    const card = h('section', { class: 'card stack pe-saved', 'aria-labelledby': 'pe-savedhead' },
      h('div', { class: 'row' }, chip('clear', 'Saved'), h('h2', { id: 'pe-savedhead', text: (st.mode === 'screening' ? 'Screening' : 'Full chart') + (st.saved.amendsExamId ? ' addendum' : '') })),
      // An addendum says what it amends: the row links to the original, and the card says so in the same breath.
      h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'Derived into the hygiene note at ' + clock12(st.savedAt) + ' · author ' + st.saved.author + (st.saved.amendsExamId ? ' · addendum to the saved exam, which stands unchanged' : '') + '. Read-only there; the exam is the source.' }));
    if (st.mode === 'screening') {
      card.append(h('p', { text: 'Screening codes: ' + SEXTANTS.map(([lab], i) => lab + ' ' + st.sextants[i]).join(' · ') }));
      if (st.sextants.some((c) => c === '3' || c === '4')) card.append(h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'A full six-point chart is booked into the next hygiene visit.' }));
    }
    else { card.append(h('p', { class: 'pe-note', text: note.perioSummary || '' })); if (note.srpEvidence) card.append(h('p', { class: 'pe-note', text: note.srpEvidence })); }
    if (st.mode === 'full' && !st.saved.skipped) card.append(h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'Chart status: full-mouth six-point chart recorded on ' + total(st) + ' sites.' }));
    if (st.mode === 'full' && st.saved.skipped) card.append(h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'Chart status: partial chart; ' + st.saved.skipped + (st.saved.skipped === 1 ? ' site' : ' sites') + ' not probed (' + (LICENCES.find(([c]) => c === st.saved.licence) || ['', st.saved.licence])[1] + '). This never reads as a full chart.' }));
    const fullChartDue = st.mode === 'screening' && st.sextants.some((c) => c === '3' || c === '4');
    const deepPockets = st.mode === 'full' && deep >= 5;
    // The chip carries the interval; the line beside it says whose rule it is, and says it only once.
    card.append(h('div', { class: 'row pe-next' }, chip(fullChartDue || deepPockets ? 'required' : 'clear', recallLine(st)), h('span', { text: 'Next visit, by practice policy, not a recommendation' })));
    card.append(h('details', null, h('summary', { class: 'pe-summary', testid: 'perio.saved.why' }, 'Why these numbers'), h('p', { class: 'small muted', style: 'color: var(--ink-2)', text: 'Deepest depth, bleeding count, and the chart-status sentence are computed from the frozen site rows in one transaction. The recall interval comes from the practice rule (4 months with BWX when any site is 5 mm or deeper, else 6 months); the dentist\'s plan supersedes it. No quadrant count proposes a billable code.' })));
    card.append(tagBlock(st, r));
    return card;
  }

  // ---- Screen ----------------------------------------------------------------------------------
  function rerender(r) {
    const ae = document.activeElement; const tid = ae && ae.getAttribute ? ae.getAttribute('data-testid') : null;
    const wrap0 = document.querySelector('.perio-wrap'); const wrapTop = wrap0 ? wrap0.scrollTop : 0;   // the grid box keeps its place across a key
    render(r);
    const wrap1 = document.querySelector('.perio-wrap'); if (wrap1 && wrapTop) wrap1.scrollTop = wrapTop;
    const enc = Proto.store.encounter(r.id); const st = enc ? stateFor(enc) : null;
    let target = null;
    if (tid && tid.startsWith('perio.grid.cell.')) { const key = st && curKey(st); target = (key && document.querySelector('[data-testid="perio.grid.cell.' + key + '"]')) || document.querySelector('[data-testid="' + tid + '"]'); }
    else if (tid) target = document.querySelector('[data-testid="' + tid + '"]');
    if (target && !target.disabled) target.focus();
    /* Nothing to give the focus back to: the control that was pressed has left the page with the gate it
       belonged to. The grammar is the work here, so the keyboard lands on the cursor. */
    else if (st) focusCursor(st);
    scrollCursorIntoView();   // last word on the scroll: focusing a control must not park the cursor off-screen
  }
  function focusCursor(st) {
    const sel = st.mode === 'screening'
      ? '[data-testid="perio.sextant.' + Math.min(st.scur + 1, SEXTANTS.length) + '"]'
      : (curKey(st) ? '[data-testid="perio.grid.cell.' + curKey(st) + '"]' : null);
    const el = (sel && document.querySelector(sel)) || document.querySelector('[data-testid="perio.save"]') || document.querySelector('[data-testid="perio.amend"]');
    if (el && !el.disabled) el.focus();
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
    /* An id that names no encounter is the shell's Nothing-here screen. */
    if (!enc) {
      const nf = Proto.store.notFound('encounter');
      Proto.screens.shell.mount(h('div', { class: 'stack' }, h('h1', { text: 'Nothing here' }),
        h('p', { class: 'small muted', text: nf.why }),
        h('div', { class: 'btnrow' }, btn('Back to home', { kind: 'reversible', testid: 'notfound.home', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) }))));
      return;
    }
    const st = stateFor(enc); const pt = Proto.store.patient(enc.patientId); const a = S().appointments.find((x) => x.encounterId === enc.id);
    // A gate answers a condition, and clears when the condition does.
    if (st.gate && ['licence_scope', 'entitlement'].includes(st.gate.code) && (Proto.store.clinician() || {}).code !== st.gate.code) st.gate = null;   // the author switched, or the pass was issued
    if (st.gate && st.gate.code === 'screening_incomplete' && !st.sextants.some((c) => c === '')) st.gate = null;
    if (st.gate && st.gate.code === 'depth_gt_15' && (st.cur !== st.gate.cur || siteDepth(st) != null)) st.gate = null;   // the next key answered it, or the site kept a valid depth
    if (st.gate && st.gate.code === 'omission_licence' && !skippedCount(st)) { st.gate = null; st.licenceOpen = false; st.licencePick = null; }
    if (st.gate && st.gate.code === 'outage' && !S().outage) st.gate = null;                                  // the gate belongs to the outage
    const name = displayName(pt.name, P().privacy); const key = curKey(st);
    /* Nine words, not thirty-seven: what the keys do is printed on the instrument they drive, and what the
       missing teeth are is printed in the grid's own legend (INT-temp-first-screenful, CLT-split-attention). */
    const sub = (a ? 'Chair ' + a.op + ' · ' : '') + (st.priorDate ? 'Prior exam ' + longDate(st.priorDate) + ' ghosted' : 'No prior exam on file') + ' · ' + (32 - st.missing.length) + ' teeth';

    // Selection carries its ✓ press mark, not fill alone: opts.pressed is the only way to get both.
    const segFull = btn('Full chart', { kind: 'quiet', testid: 'perio.full', pressed: st.mode === 'full', onClick: () => { if (st.saved) { openAmendGate(st, r); return; } st.mode = 'full'; st.gate = null; st.pendingZero = false; rerender(r); } });
    const segScr = btn('Screening', { kind: 'quiet', testid: 'perio.screening', pressed: st.mode === 'screening', ariaLabel: 'Screening lane: six sextant codes in at most 12 keystrokes', onClick: () => { if (st.saved) { openAmendGate(st, r); return; } st.mode = 'screening'; st.gate = null; st.padOpen = false; st.pendingZero = false; rerender(r); const b = document.querySelector('[data-testid="perio.sextant.' + (st.scur + 1) + '"]'); if (b) b.focus(); } });
    // The pad carries the full-chart grammar, so it is offered in the lane that has one, and not on a sealed chart.
    const padT = st.mode === 'full' && !st.saved ? btn(st.padOpen ? 'Hide glove pad' : 'Glove pad', { kind: 'quiet', testid: 'perio.pad.toggle', pressed: st.padOpen, ariaLabel: 'Glove pad: 44 px keys for gloved fingers', onClick: () => { st.padOpen = !st.padOpen; rerender(r); } }) : null;
    const setT = btn('Settings', { kind: 'quiet', testid: 'perio.settings', pressed: st.settingsOpen, ariaLabel: 'Perio settings: last key pressed and probing path', onClick: () => { st.settingsOpen = !st.settingsOpen; rerender(r); if (st.settingsOpen) { const sec = document.getElementById('perio-settings'); if (sec) { sec.scrollIntoView({ block: 'nearest', behavior: 'auto' }); sec.focus(); } } } }); setT.setAttribute('aria-expanded', String(st.settingsOpen)); setT.setAttribute('aria-controls', 'perio-settings');
    let save;
    if (st.saved) save = btn('Amend this exam', { kind: 'reversible', testid: 'perio.amend', ariaLabel: 'Amend the saved exam: adds a dated addendum, never overwrites', onClick: () => openAmendGate(st, r) });
    // A Held press re-reads the condition first. ui.js owns the held name: "Held" on glass, "Held: Save exam"
    // in the accessible name, the same on every screen (WCAG-3.2.4).
    else if (st.gate) save = btn('Save exam', { kind: 'held', testid: 'perio.save', onClick: () => { rerender(r); if (st.gate) focusGateControl(); } });
    else save = Proto.ui.confirmable('Save exam', { testid: 'perio.save', ariaLabel: 'Save exam: one transaction, derives the note and the recall',
      readback: 'This files the perio exam as one transaction and derives the note and the recall. It cannot be edited afterwards; an addendum can add to it.',
      confirmLabel: 'Save exam', onConfirm: () => doSave(st, r, null) });

    /* An irreversible control is never alone in its row: the way out stands beside the way on, at the same
       height, and the row ends with the control that finishes (CLT-neutral-irreversible, CLT-serial-position).
       One primary in the first screenful: while the reason chooser stands, the Save that finishes the exam
       is the one inside it, so the page head does not hold a second one (INT-one-primary-per-view). */
    const back = btn('Return to Chairs', { kind: 'reversible', testid: 'perio.back', ariaLabel: 'Return to Chairs: the draft stays in this session', onClick: () => Proto.router.go(r.persona, 'chairs') });
    const page = h('div', { class: 'stack periopage' }, pageHead('Perio · ' + name, sub, back, st.licenceOpen && !st.saved ? null : save));
    // Every group of three or more controls carries a name you can see, inside its own region (CLT-common-region).
    page.append(h('div', { class: 'stack pe-tools' },
      h('div', { class: 'btnrow', role: 'group', 'aria-labelledby': 'pe-toolslab' },
        h('span', { class: 'small muted', style: 'color: var(--ink-2)', id: 'pe-toolslab', text: 'Chart mode and tools' }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Chart mode' }, segFull, segScr), padT, setT)));

    const undoBtn = btn('Undo last entry', { kind: 'quiet', testid: 'perio.undo', ariaLabel: 'Undo last entry: puts back what the last key or tap changed', onClick: () => viaPad(st, r, 'Backspace') });
    undoBtn.setAttribute('aria-keyshortcuts', 'Backspace'); undoBtn.append(kbd('⌫'));
    if (st.mode === 'full') {
      const priorV = key ? st.prior[key] : null;
      page.append(h('div', { class: 'activesite' }, h('span', { text: st.saved ? 'Exam saved · grid is read-only' : key ? 'Tooth ' + toothOf(key) + ' · site ' + siteOf(key) + ' · prior ' + (priorV != null ? priorV : '—') + (st.pendingZero ? ' · 10+…' : '') : 'All ' + total(st) + ' sites entered · Save exam' }),
        h('span', { class: 'pe-count small', text: 'Sites recorded: ' + probedCount(st) + '/' + total(st) + (skippedCount(st) ? ' · ' + skippedCount(st) + ' not probed' : '') }),
        st.saved ? null : undoBtn));
    } else {
      const firstEmpty = st.sextants.findIndex((c) => !c);
      page.append(h('div', { class: 'activesite' }, h('span', { text: st.saved ? 'Screening saved' : st.scur <= 5 ? 'Sextant ' + SEXTANTS[st.scur][0] + ' (teeth ' + SEXTANTS[st.scur][1] + ') · keys 0–4 or *' : firstEmpty >= 0 ? uncoded(st) + ' sextant' + (uncoded(st) > 1 ? 's' : '') + ' still empty · ⌫ or ← back to ' + SEXTANTS[firstEmpty][0] : 'All six sextants coded · Save exam' }),
        h('span', { class: 'pe-count small', text: 'Codes: ' + st.sextants.filter(Boolean).length + '/6' + (st.sextants.some((c) => c === '3' || c === '4') ? ' · Full chart due' : '') }),
        st.saved ? null : undoBtn));
    }
    // The echo of the last act. #live does the announcing; this line is the visible copy, and it holds until
    // the next act replaces it (WCAG 2.2.1: no timer takes a message away).
    page.append(h('p', { class: 'pe-flash', text: st.flash || '' }));
    if (st.gate) page.append(st.gate.node);
    if (st.amendGate) page.append(st.amendGate);
    // The reasons stand with the gate that asked for them, above the chart, where the actor is already reading.
    if (st.licenceOpen && !st.saved) page.append(licenceChooser(st, r));
    /* The pad sits above the grid instead of sticking to the bottom of the scroller. */
    if (st.padOpen && !st.saved && st.mode === 'full') page.append(pad(st, r));
    page.append(st.mode === 'full' ? grid(st, r) : sextants(st, r));
    if (st.stamp) page.append(h('p', { class: 'small pe-legend' }, h('span', { class: 'stamp', text: st.stamp })));
    if (st.settingsOpen) page.append(settings(st, r));
    if (st.saved) page.append(savedCard(st, r)); else page.append(tagBlock(st, r));
    Proto.screens.shell.mount(page);
    fitGrid();
    /* The instrument takes the keyboard on arrival: the shell parks focus on the heading, and the grammar
       belongs to the grid, so the first key would otherwise be read by nobody. Only when nothing else has
       claimed the focus first (a gate, a field, a control that was just pressed). */
    requestAnimationFrame(() => {
      const c = Proto.router.current();
      if (c.route !== 'perio' || c.id !== st.encId || st.saved) return;
      const ae = document.activeElement;
      if (!ae || ae === document.body || ae.tagName === 'H1' || ae.id === 'canvas') { focusCursor(st); scrollCursorIntoView(); }
    });
    if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; }
  }

  window.addEventListener('hashchange', () => { if (keysOn && Proto.router.current().route !== 'perio') { document.removeEventListener('keydown', onKey); keysOn = false; } });

  Proto.screens.perio = { render, apply: (encId, key) => { const enc = Proto.store.encounter(encId); if (!enc) return null; return apply(stateFor(enc), key, Proto.router.current()); }, buildPath, stateFor };
  Proto.router.on('perio', (r) => Proto.screens.perio.render(r));
})();
