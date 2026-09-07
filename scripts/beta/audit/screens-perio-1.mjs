// Audit checks for prototype/js/screens/perio.js, chunk screens-perio-1.
// Root causes in order: RC-36, RC-37, RC-38, RC-39, RC-53, RC-111, RC-112, RC-113, RC-114, RC-115.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
import fs from 'node:fs';

const CONTRACTS = (() => { try { return fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return ''; } })();
const section = (n) => { const m = CONTRACTS.match(new RegExp('\\n## ' + n + '\\.[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)')); return m ? m[1] : ''; };
const S6_CODES = (() => { const t = section(6); const m = t.match(/Codes:([^\n]*)/); return m ? [...m[1].matchAll(/`([a-z_]+)`/g)].map((x) => x[1]) : []; })();
/* Every §4 row, not the Perio row alone: an id Perio renders can be listed on a cross-cutting row instead
   (`perio.back` under screen-local returns and closers, `perio.saved.why` under Why disclosures,
   `perio.full` under Perio beyond the grid). Reading one row made the check report ids the contract lists. */
const S4_PERIO_ROW = (() => { const t = section(4); return t.split('\n').filter((l) => l.startsWith('|') && /`perio\.|`refusal\./.test(l)).join(' '); })();
// §4 entries as patterns: `<1-9>` → [1-9], `<1-6>` → [1-6], any other `<name>` → one lowercase segment.
const S4_PERIO_PATTERNS = [...S4_PERIO_ROW.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((x) => /^(perio|refusal)\./.test(x)).map((id) => {
  const src = id.split(/(<[^>]+>)/).map((part) => {
    if (!part) return '';
    const rng = part.match(/^<(\d)-(\d)>$/); if (rng) return '[' + rng[1] + '-' + rng[2] + ']';
    if (/^<[^>]+>$/.test(part)) return '[a-z0-9_-]+';
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { id, re: new RegExp('^' + src + '$') };
});

const ACTIVE = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, text: a && a !== document.body ? (a.textContent || '').trim().slice(0, 40) : null, isBody: a === document.body }; });
const SEQ = (p) => p.evaluate(() => (window.__events[window.__events.length - 1] || { seq: 0 }).seq);
const EVENTS_AFTER = (p, from) => p.evaluate((f) => window.__events.filter((e) => e.seq > f).map((e) => ({ seq: e.seq, kind: e.kind, testid: e.testid, key: e.key, table: e.table, id: e.id, code: e.code, verb: e.verb, control: e.control })), from);
const WR = (p, from) => p.evaluate((f) => window.__events.filter((e) => e.seq > f && (e.kind === 'write' || e.kind === 'refusal')).map((e) => ({ seq: e.seq, kind: e.kind, table: e.table, id: e.id, code: e.code, verb: e.verb, control: e.control })), from);
const EXAMS = (p, enc) => p.evaluate((encId) => window.__proto.state().perioExams.filter((e) => e.encounterId === encId).map((e) => ({ id: e.id, kind: e.kind, amendsExamId: e.amendsExamId, author: e.author, mode: e.mode, probed: e.probed })), enc);
const GATE = (p) => p.evaluate(() => { const r = document.querySelector('#canvas .refusal'); if (!r) return null; const ctl = r.querySelector('[data-testid="refusal.control"]'); const verb = r.querySelector('[data-testid="refusal.verb"]'); return { code: r.dataset.code, verb: verb ? verb.textContent.trim() : null, verbWords: verb ? verb.textContent.trim().split(/\s+/).length : null, control: ctl ? ctl.textContent.trim() : null, controlH: ctl ? Math.round(ctl.getBoundingClientRect().height) : null, why: !!r.querySelector('[data-testid="refusal.why"]') }; });
const SAVE_BTN = (p) => p.evaluate(() => { const b = document.querySelector('[data-testid="perio.save"]'); return b ? { text: b.textContent.trim(), kind: [...b.classList].filter((k) => k !== 'btn').join(' ') } : null; });
const ST = (p, enc) => p.evaluate((encId) => { const e = Proto.store.encounter(encId); const st = Proto.screens.perio.stateFor(e); return { mode: st.mode, cur: st.cur, pathLen: st.path.length, probed: Object.values(st.sites).filter((v) => v.depth != null).length, sextants: st.sextants.slice(), padOpen: st.padOpen, saved: st.saved ? st.saved.id : null, amending: !!st.amending, gate: st.gate ? st.gate.code : null }; }, enc);
const WHO = (p) => p.evaluate(() => { const u = Proto.store.currentUser(); return { persona: window.__proto.persona, device: window.__proto.device, name: u.name, licence: u.licence || null, hash: location.hash, authorChip: (document.querySelector('[data-testid="topbar.author"]') || {}).textContent || null }; });
const PRESSED = (p, tid) => p.evaluate((t) => { const b = document.querySelector('[data-testid="' + t + '"]'); if (!b) return null; return { testid: t, ariaPressed: b.getAttribute('aria-pressed'), pressmark: !!b.querySelector('.pressmark'), checkInText: /✓/.test(b.textContent), text: b.textContent.trim(), disabled: b.disabled }; }, tid);
const LIVE = (p) => p.evaluate(() => (document.getElementById('live') || {}).textContent || '');
async function typeDigits(p, n) { await p.keyboard.type('3'.repeat(n), { delay: 0 }); await p.waitForTimeout(200); }

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => ({
  // RC-36 (A2): on a shared tablet the pin_required gate never re-evaluates after the PIN switch; Save stays Held.
  // Negative control: the first Save must raise pin_required (a refusal event with that code) and the PIN switch must
  // land on Bree Lawson (RDH) — if either fails the check is false. If, once the author holds a licence, Save writes a
  // perioExams row for enc-9001 (or the gate on screen is gone and the button reads "Save exam"), reproduced is false.
  async 'A-screens-perio-1-1'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/frontdesk/perio/enc-9001?device=shared');
      const before = await WHO(p);
      await typeDigits(p, 168);
      const seq0 = await SEQ(p);
      await press(p, 'perio.save'); await p.waitForTimeout(150);
      const gate1 = await GATE(p); const ev1 = await WR(p, seq0);
      await click(p, 'refusal.control'); await p.waitForTimeout(150);
      const padOpen = !!(await p.$('[data-testid="pin.key.1"]'));
      for (let i = 0; i < 4; i++) await click(p, 'pin.key.1');
      await click(p, 'pin.submit'); await p.waitForTimeout(400);
      const after = await WHO(p);
      const gateAfterPin = await GATE(p); const saveAfterPin = await SAVE_BTN(p);
      const examsBefore = await EXAMS(p, 'enc-9001');
      const seq1 = await SEQ(p);
      const s1 = await press(p, 'perio.save'); await p.waitForTimeout(200);
      const s2 = await press(p, 'perio.save'); await p.waitForTimeout(200);
      const examsAfter = await EXAMS(p, 'enc-9001');
      const ev2 = await WR(p, seq1);
      const gateEnd = await GATE(p); const saveEnd = await SAVE_BTN(p);
      const gateRaised = !!gate1 && gate1.code === 'pin_required' && ev1.some((e) => e.kind === 'refusal' && e.code === 'pin_required');
      const switched = after.name === 'Bree Lawson' && after.licence === 'RDH' && after.device === 'shared';
      const stuck = !!gateEnd && gateEnd.code === 'pin_required' && !!saveEnd && saveEnd.text === 'Held' && examsAfter.length === examsBefore.length && !ev2.some((e) => e.kind === 'write' && e.table === 'perioExams');
      const reproduced = gateRaised && padOpen && switched && s1 && s2 && stuck;
      rec('A-screens-perio-1-1', 'On a shared tablet the pin_required gate stays on screen after the PIN switch to Bree Lawson (RDH): Save reads Held, two presses write no perioExams row', 'A2 (CHECKLIST); docs/13 feature 30', reproduced,
        { authorBefore: before, firstSave: { gate: gate1, events: ev1 }, pinPadOpened: padOpen, authorAfterPin: after, gateAfterPin, saveAfterPin, perioExamsBeforeTwoPresses: examsBefore, twoPresses: { accepted: [s1, s2], eventsFromSeq: seq1, events: ev2 }, perioExamsAfterTwoPresses: examsAfter, gateAtEnd: gateEnd, saveAtEnd: saveEnd });
    } finally { await c.close(); }
  },

  // RC-37 (A2): "Start an addendum" sets st.amending but doSave never passes extras.amending; a plain exam is written.
  // Negative control: the first Save must write an exam row (kind exam) and the amend control's gate must carry code
  // exam_sealed; if the second Save's row has kind 'addendum' and amendsExamId equal to the first row's id (and the note
  // says "addendum"), reproduced is false. No second row at all is also false.
  async 'A-screens-perio-1-2'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await typeDigits(p, 168);
      await press(p, 'perio.save'); await p.waitForTimeout(250);
      const first = await EXAMS(p, 'enc-9001');
      await click(p, 'perio.amend'); await p.waitForTimeout(150);
      const amendGate = await GATE(p);
      await click(p, 'refusal.control'); await p.waitForTimeout(150);
      const stAfterControl = await ST(p, 'enc-9001');
      await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(60); await p.keyboard.press('5'); await p.waitForTimeout(120);
      const seq0 = await SEQ(p);
      await click(p, 'perio.save'); await p.waitForTimeout(250);
      const second = await EXAMS(p, 'enc-9001');
      const ev = await WR(p, seq0);
      const note = await p.evaluate(() => (window.__proto.state().notes['enc-9001'] || {}).perioSummary || null);
      const savedH2 = await p.evaluate(() => { const h = document.querySelector('.pe-saved h2'); return h ? h.textContent.trim() : null; });
      const firstRow = first[first.length - 1] || null; const newRows = second.slice(first.length);
      const row = newRows[0] || null;
      const reproduced = !!firstRow && firstRow.kind === 'exam' && !!amendGate && amendGate.code === 'exam_sealed' && stAfterControl.amending === true && stAfterControl.saved === null && !!row && row.kind === 'exam' && row.amendsExamId == null && !/addendum/i.test(note || '');
      rec('A-screens-perio-1-2', "After 'Start an addendum' the next Save writes a second plain exam (kind 'exam', amendsExamId null) and a note with no addendum wording", 'A2 (CHECKLIST); docs/13 feature 11', reproduced,
        { firstSaveRows: first, amendGate, stateAfterStartAddendum: stAfterControl, secondSaveEvents: ev, rowsAfterSecondSave: second, newRow: row, expectedAmendsExamId: firstRow ? firstRow.id : null, perioSummary: note, savedCardH2: savedH2 });
    } finally { await c.close(); }
  },

  // RC-38 (B2): saving the screening lane with empty sextants raises code screening_incomplete, absent from §6.
  // Negative control: four sextant codes must be entered (st.sextants shows 4 of 6) so the gate fires; a refusal whose
  // code is in the parsed §6 list, or no refusal event at all, makes reproduced false.
  async 'A-screens-perio-1-3'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await click(p, 'perio.screening'); await p.waitForTimeout(100);
      for (const k of ['1', '*', '2', '4']) { await p.keyboard.press(k); await p.waitForTimeout(40); }
      const st = await ST(p, 'enc-9001');
      const seq0 = await SEQ(p);
      await press(p, 'perio.save'); await p.waitForTimeout(200);
      const ev = await WR(p, seq0);
      const gate = await GATE(p);
      const refusals = ev.filter((e) => e.kind === 'refusal');
      const code = gate ? gate.code : (refusals[0] || {}).code;
      const reproduced = st.mode === 'screening' && st.sextants.filter(Boolean).length === 4 && !!code && S6_CODES.length > 0 && !S6_CODES.includes(code) && refusals.some((r) => r.code === code);
      rec('A-screens-perio-1-3', "Saving a four-of-six screening raises refusal code 'screening_incomplete', which the CONTRACTS §6 list does not contain", 'B2 (CHECKLIST); CONTRACTS §6', reproduced,
        { stateBeforeSave: st, refusalEvents: refusals, renderedGate: gate, code, codeInS6: S6_CODES.includes(code), s6Codes: S6_CODES });
    } finally { await c.close(); }
  },

  // RC-39 (B5): perio.full / perio.screening, the probing-path and licence buttons set aria-pressed after btn(), so no
  // ✓ pressmark renders; selection is fill and border only.
  // Negative control: perio.pad.toggle on the same row is built with opts.pressed and must carry the .pressmark when
  // open (shows the measurement discriminates). If every aria-pressed="true" element measured carries a .pressmark or a
  // ✓ in its text, reproduced is false.
  async 'A-screens-perio-1-4'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      const full = await PRESSED(p, 'perio.full'); const scrOff = await PRESSED(p, 'perio.screening');
      await click(p, 'perio.pad.toggle'); await p.waitForTimeout(100);
      const padOn = await PRESSED(p, 'perio.pad.toggle');
      await click(p, 'perio.pad.toggle'); await p.waitForTimeout(100);
      await click(p, 'perio.settings'); await p.waitForTimeout(100);
      const pathDefault = await PRESSED(p, 'perio.path.facial_lingual');
      await click(p, 'perio.path.quadrant'); await p.waitForTimeout(100);
      const pathQuadrant = await PRESSED(p, 'perio.path.quadrant');
      await click(p, 'perio.screening'); await p.waitForTimeout(100);
      const scrOn = await PRESSED(p, 'perio.screening');
      await click(p, 'perio.full'); await p.waitForTimeout(100);
      // licence chooser: skip one site, fill the rest, Save → omission_licence → control → pick a reason
      await typeDigits(p, 20); await p.keyboard.press('ArrowRight'); await typeDigits(p, 147);
      await press(p, 'perio.save'); await p.waitForTimeout(200);
      const gate = await GATE(p);
      await click(p, 'refusal.control'); await p.waitForTimeout(150);
      await click(p, 'perio.licence.implant'); await p.waitForTimeout(150);
      const licenceOn = await PRESSED(p, 'perio.licence.implant');
      const measured = { full, screeningOff: scrOff, padToggleOn: padOn, pathDefault, pathQuadrant, screeningOn: scrOn, licenceOn };
      const pressedNoMark = Object.entries(measured).filter(([, v]) => v && v.ariaPressed === 'true' && !v.pressmark && !v.checkInText).map(([k, v]) => k + ':' + v.testid);
      const controlHasMark = !!padOn && padOn.ariaPressed === 'true' && padOn.pressmark;
      const reproduced = controlHasMark && pressedNoMark.length > 0;
      rec('A-screens-perio-1-4', 'Full chart / Screening, probing path and licence buttons carry aria-pressed="true" with no ✓ pressmark, while the Glove pad toggle beside them does carry one', 'B5 (CHECKLIST)', reproduced,
        { measured, pressedWithoutMark: pressedNoMark, padToggleControlHasMark: controlHasMark, omissionGate: gate });
    } finally { await c.close(); }
  },

  // RC-53 (B1): perio.* test ids rendered in reachable states that match no CONTRACTS §4 Perio entry or pattern.
  // Negative control: if every perio.* id collected over the states (initial, pad, settings, tag open, screening, saved
  // card) matches a §4 pattern, reproduced is false. The §4 row text and the parsed patterns are carried.
  async 'A-screens-perio-1-5'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      const ids = new Set(); const byState = {};
      const collect = async (name) => { const list = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="perio."]')].map((e) => e.getAttribute('data-testid'))); byState[name] = list.length; list.forEach((x) => ids.add(x)); };
      await collect('initial');
      await click(p, 'perio.pad.toggle'); await p.waitForTimeout(100); await collect('padOpen');
      await click(p, 'perio.pad.toggle'); await click(p, 'perio.settings'); await p.waitForTimeout(100); await collect('settingsOpen');
      await click(p, 'perio.settings'); await click(p, 'perio.tag.add'); await p.waitForTimeout(100); await collect('tagOpen');
      await click(p, 'perio.tag.cancel'); await click(p, 'perio.screening'); await p.waitForTimeout(100); await collect('screening');
      await click(p, 'perio.full'); await p.waitForTimeout(100);
      await typeDigits(p, 168); await press(p, 'perio.save'); await p.waitForTimeout(250); await collect('saved');
      const saved = await EXAMS(p, 'enc-9001');
      const all = [...ids].sort();
      const unmatched = all.filter((id) => !S4_PERIO_PATTERNS.some((x) => x.re.test(id)));
      const distinctFamilies = [...new Set(unmatched.map((id) => id.replace(/\.(\d+|[a-z_]+)$/, (m) => (/^\.\d+$/.test(m) ? '.<n>' : m))))];
      const reproduced = S4_PERIO_PATTERNS.length > 0 && all.length > 0 && unmatched.length > 0 && saved.length > 0;
      rec('A-screens-perio-1-5', 'Perio renders test ids (perio.full, perio.amend, perio.back, perio.saved.why, perio.pad.key.0, perio.pad.supp, perio.sextant.<n>, perio.path.*, perio.settings.grammar, perio.tag.obs.*, perio.tag.cancel) that match no CONTRACTS §4 Perio entry', 'B1 (CHECKLIST); CONTRACTS §4', reproduced,
        { idsPerState: byState, allPerioIds: all, unmatchedIds: unmatched, unmatchedFamilies: distinctFamilies, section4PerioRow: S4_PERIO_ROW, section4Patterns: S4_PERIO_PATTERNS.map((x) => x.id), savedRows: saved });
    } finally { await c.close(); }
  },

  // RC-111 (B10): rerender() returns before focusing when the active element has no testid; the first grammar key
  // (focus on the h1) and "Start an addendum" (its button removed) leave document.activeElement on BODY.
  // Negative control: each scenario first shows the mutation took (a site recorded 0→1; saved exam released to amending);
  // if the active element afterwards carries a testid (a cell, the state line, a control) reproduced is false.
  async 'A-screens-perio-1-6'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/chairs');
      await press(p, 'chairs.card.a-1042.perio'); await p.waitForTimeout(300);
      const focusAfterRoute = await ACTIVE(p);
      const st0 = await ST(p, 'enc-9001');
      await p.keyboard.press('3'); await p.waitForTimeout(150);
      const st1 = await ST(p, 'enc-9001');
      const focusAfterKey = await ACTIVE(p);
      await typeDigits(p, 167);
      await press(p, 'perio.save'); await p.waitForTimeout(250);
      const st2 = await ST(p, 'enc-9001');
      await click(p, 'perio.amend'); await p.waitForTimeout(150);
      await click(p, 'refusal.control'); await p.waitForTimeout(150);
      const st3 = await ST(p, 'enc-9001');
      const focusAfterAddendum = await ACTIVE(p);
      const keyDropped = st0.probed === 0 && st1.probed === 1 && focusAfterKey.isBody;
      const addendumDropped = !!st2.saved && st3.saved === null && st3.amending && focusAfterAddendum.isBody;
      rec('A-screens-perio-1-6', "The first grammar key after opening Perio and the 'Start an addendum' control both leave keyboard focus on BODY", 'B10 (CHECKLIST)', keyDropped || addendumDropped,
        { focusAfterRoute, firstKey: { probedBefore: st0.probed, probedAfter: st1.probed, focus: focusAfterKey, dropped: keyDropped }, startAddendum: { savedBefore: st2.saved, savedAfter: st3.saved, amending: st3.amending, focus: focusAfterAddendum, dropped: addendumDropped } });
    } finally { await c.close(); }
  },

  // RC-112 (B10): the pin_required and screening_incomplete gates rerender without focusing refusal.control, so focus
  // stays on the Save button now labelled Held.
  // Negative control: each gate must actually render with its code; if focus is then on refusal.control (as the
  // omission_licence gate does, measured as the contrast) reproduced is false. Save is activated by keyboard (press)
  // so the button is the focused element going in.
  async 'A-screens-perio-1-7'(b) {
    const run = async (hash, prep) => {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, hash); await prep(p);
        const seq0 = await SEQ(p);
        await press(p, 'perio.save'); await p.waitForTimeout(200);
        const gate = await GATE(p); const focus = await ACTIVE(p); const ev = await WR(p, seq0);
        return { gate, focus, refusalEvents: ev.filter((e) => e.kind === 'refusal') };
      } finally { await c.close(); }
    };
    const pin = await run('#/frontdesk/perio/enc-9001?device=shared', async (p) => { await typeDigits(p, 168); });
    const scr = await run('#/hygienist/perio/enc-9001', async (p) => { await click(p, 'perio.screening'); await p.waitForTimeout(100); for (const k of ['1', '*', '2', '4']) { await p.keyboard.press(k); await p.waitForTimeout(40); } });
    const lic = await run('#/hygienist/perio/enc-9001', async (p) => { await typeDigits(p, 20); await p.keyboard.press('ArrowRight'); await typeDigits(p, 147); });
    const onHeld = (r, code) => !!r.gate && r.gate.code === code && r.focus.testid === 'perio.save' && /Held/.test(r.focus.text || '');
    const pinStuck = onHeld(pin, 'pin_required'); const scrStuck = onHeld(scr, 'screening_incomplete');
    const contrastLands = !!lic.gate && lic.gate.code === 'omission_licence' && lic.focus.testid === 'refusal.control';
    rec('A-screens-perio-1-7', 'After the pin_required and screening_incomplete gates focus stays on the Held Save button instead of refusal.control (the omission_licence gate does move focus to the control)', 'B10 (CHECKLIST)', pinStuck && scrStuck,
      { pinRequired: Object.assign({ focusOnHeld: pinStuck }, pin), screeningIncomplete: Object.assign({ focusOnHeld: scrStuck }, scr), contrastOmissionLicence: Object.assign({ focusOnControl: contrastLands }, lic) });
  },

  // RC-113 (B11): the sticky .pad-dock sits over lower-arch cells, including the active cell once the cursor reaches it.
  // Negative control: the pad must be open (a .pad-dock in the DOM). If no enabled grid cell's centre hit-tests into the
  // pad, or the active cell stays clear of the pad as the cursor crosses the lower arch, reproduced is false. Cells
  // scrolled out of the viewport are not counted as covered.
  async 'A-screens-perio-1-8'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await click(p, 'perio.pad.toggle'); await p.waitForTimeout(200);
      const occlusion = () => p.evaluate(() => {
        const pad = document.querySelector('.pad-dock'); if (!pad) return { padOpen: false };
        const pr = pad.getBoundingClientRect();
        const out = { padOpen: true, padTop: Math.round(pr.top), padBottom: Math.round(pr.bottom), viewportH: window.innerHeight, canvasScrollTop: Math.round(document.getElementById('canvas').scrollTop), covered: [], inViewCells: 0 };
        for (const cell of document.querySelectorAll('.psite:not(.missing)')) {
          const r = cell.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= window.innerHeight) continue; out.inViewCells++;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (hit && hit !== cell && !cell.contains(hit) && pad.contains(hit)) out.covered.push({ cell: cell.getAttribute('data-testid'), hit: hit.getAttribute('data-testid') || hit.className });
        }
        const a = document.querySelector('.psite.active');
        if (a) { const r = a.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); out.active = { cell: a.getAttribute('data-testid'), top: Math.round(r.top), underPad: !!hit && hit !== a && !a.contains(hit) && pad.contains(hit), hit: hit ? (hit.getAttribute('data-testid') || hit.className) : null }; }
        out.coveredCount = out.covered.length; out.covered = out.covered.slice(0, 6); return out;
      });
      const initial = await occlusion();
      // Drive the cursor through the pad keys (the pad stays open) until the active cell is in the lower arch and under the pad.
      let underPad = null; const trail = [];
      for (let i = 0; i < 168 && !underPad; i++) {
        await click(p, 'perio.pad.key.3');
        if (i % 6 === 5) { const o = await occlusion(); trail.push({ presses: i + 1, active: o.active }); if (o.active && o.active.underPad) underPad = o; }
      }
      const reproduced = initial.padOpen && initial.coveredCount > 0 && !!underPad;
      rec('A-screens-perio-1-8', 'With the glove pad docked at 1280×900 the sticky pad covers lower-arch grid cells, and as the cursor reaches the lower arch the active cell itself hit-tests into a pad key', 'B11 (CHECKLIST); docs/13 feature 5', reproduced,
        { atOpen: initial, activeUnderPad: underPad ? { presses: trail[trail.length - 1].presses, active: underPad.active, padTop: underPad.padTop, canvasScrollTop: underPad.canvasScrollTop } : null, cursorTrail: trail.slice(-6) });
    } finally { await c.close(); }
  },

  // RC-114 (A2): in the screening lane the Glove pad toggle turns pressed ("✓Hide glove pad") but line 363 renders the
  // pad only in full mode; nothing appears and nothing is announced.
  // Negative control: in full mode the same toggle must put a .pad in the DOM (the contrast). In screening, if a .pad
  // renders, or the toggle is absent/disabled, or the toggle does not read pressed, reproduced is false.
  async 'A-screens-perio-1-9'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await click(p, 'perio.pad.toggle'); await p.waitForTimeout(150);
      const fullMode = { toggle: await PRESSED(p, 'perio.pad.toggle'), padInDom: !!(await p.$('.pad')) };
      await click(p, 'perio.pad.toggle'); await p.waitForTimeout(100);
      await click(p, 'perio.screening'); await p.waitForTimeout(150);
      const seq0 = await SEQ(p);
      const pressed = await click(p, 'perio.pad.toggle'); await p.waitForTimeout(250);
      const toggle = await PRESSED(p, 'perio.pad.toggle');
      const padInDom = !!(await p.$('.pad'));
      const st = await ST(p, 'enc-9001');
      const live = await LIVE(p); const ev = await EVENTS_AFTER(p, seq0);
      const reproduced = fullMode.padInDom && pressed && st.mode === 'screening' && !!toggle && toggle.ariaPressed === 'true' && !toggle.disabled && st.padOpen === true && !padInDom;
      rec('A-screens-perio-1-9', "In the screening lane the Glove pad toggle reads pressed ('✓Hide glove pad', aria-pressed=true, st.padOpen true) but no pad renders and nothing is announced", 'A2 (CHECKLIST)', reproduced,
        { contrastFullMode: fullMode, screening: { toggleAccepted: pressed, toggle, padInDom, state: st, liveRegion: live, eventsAfterPress: ev } });
    } finally { await c.close(); }
  },

  // RC-115 (A4): after Save the Full chart / Screening segments stay enabled and press as a silent no-op.
  // Negative control: the Save must have written a perioExams row. If the segment is then disabled, or pressing it
  // logs a refusal event / renders a refusal / changes the mode / announces anything, reproduced is false.
  async 'A-screens-perio-1-10'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/perio/enc-9001');
      await typeDigits(p, 168); await press(p, 'perio.save'); await p.waitForTimeout(300);
      const saved = await EXAMS(p, 'enc-9001');
      await p.waitForTimeout(200); await p.evaluate(() => { const l = document.getElementById('live'); if (l) l.textContent = ''; });
      const segBefore = await PRESSED(p, 'perio.screening');
      const stBefore = await ST(p, 'enc-9001');
      const seq0 = await SEQ(p);
      const pressed = await click(p, 'perio.screening'); await p.waitForTimeout(250);
      const stAfter = await ST(p, 'enc-9001');
      const ev = await EVENTS_AFTER(p, seq0);
      const gate = await GATE(p); const live = await LIVE(p);
      const segAfter = await PRESSED(p, 'perio.screening');
      const nonClick = ev.filter((e) => e.kind !== 'click' && e.kind !== 'focus');
      const reproduced = saved.length > 0 && pressed && !!segBefore && !segBefore.disabled && stBefore.mode === 'full' && stAfter.mode === 'full' && !gate && nonClick.length === 0 && live === '';
      rec('A-screens-perio-1-10', 'After Save the Screening segment is still enabled; pressing it logs a click and nothing else: mode unchanged, no refusal, no announcement', 'A4 (CHECKLIST)', reproduced,
        { savedRows: saved, segmentBefore: segBefore, stateBefore: stBefore, press: { accepted: pressed, eventsAfter: ev, nonClickEvents: nonClick }, stateAfter: stAfter, refusalRendered: gate, liveRegionAfter: live, segmentAfter: segAfter });
    } finally { await c.close(); }
  },
});
