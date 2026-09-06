// Audit checks for prototype/js/screens/encounter.js, chunk screens-encounter-1.
// Root causes in order: RC-2, RC-3, RC-27, RC-28, RC-29, RC-216, RC-231, RC-71, RC-92, RC-93.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
import fs from 'node:fs';

const CONTRACTS = (() => { try { return fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return ''; } })();
const section = (n) => { const m = CONTRACTS.match(new RegExp('\\n## ' + n + '\\.[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)')); return m ? m[1] : ''; };
const S6_CODES = (() => { const t = section(6); const m = t.match(/Codes:([^\n]*)/); return m ? [...m[1].matchAll(/`([a-z_]+)`/g)].map((x) => x[1]) : []; })();
const S4_ENCOUNTER_ROW = (() => { const t = section(4); const m = t.match(/\| Encounter \|([^\n]*)\|/); return m ? m[1].trim() : ''; })();

const ACTIVE = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, isBody: a === document.body }; });
const WRITES = (p, from) => p.evaluate((f) => window.__events.filter((e) => e.seq > f && (e.kind === 'write' || e.kind === 'refusal')).map((e) => ({ seq: e.seq, kind: e.kind, table: e.table, id: e.id, code: e.code })), from);
const SEQ = (p) => p.evaluate(() => (window.__events[window.__events.length - 1] || { seq: 0 }).seq);
const ENC_COUNTS = (p, enc) => p.evaluate((encId) => {
  const s = window.__proto.state();
  const tag = (s.tags || []).find((t) => t.id === 'tag-1') || {};
  return { chartEvents: s.chartEvents.filter((c) => c.encounterId === encId).length, procedures: s.procedures.filter((c) => c.encounterId === encId).length, planItems: s.planItems.filter((c) => c.encounterId === encId).length, tags: s.tags.length, tag1Disposition: tag.disposition === undefined ? null : tag.disposition, notes: s.notes[encId] || null, tables: Object.keys(s).length };
}, enc);
// Every row id per table (to tell rows Undo appended from rows the seed already held, e.g. the 9/01 ledger reversal).
const ROW_IDS = (p) => p.evaluate(() => { const s = window.__proto.state(); const out = {}; for (const [k, v] of Object.entries(s)) if (Array.isArray(v)) out[k] = v.map((r) => (r && r.id != null) ? String(r.id) : JSON.stringify(r)); return out; });
// Rows present after but not before, with a flag for reversal/undo markers in id, kind or type.
const NEW_ROWS = (p, before) => p.evaluate((b) => {
  const s = window.__proto.state(); const out = [];
  for (const [table, v] of Object.entries(s)) if (Array.isArray(v)) { const had = new Set(b[table] || []); for (const row of v) { const id = (row && row.id != null) ? String(row.id) : JSON.stringify(row); if (!had.has(id)) out.push({ table, id, reversalMarker: /undo|revers/i.test(id + ' ' + String((row && (row.kind || row.type)) || '')) }); } }
  return out;
}, before);
// Flow 3 up to the read-back gate on enc-9002 (dentist): tag → surfaces → procedure → starter → File.
async function toReadback(p, click) {
  await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
  await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(200);
}
const GATE_BUTTONS = (p) => p.evaluate(() => { const g = document.getElementById('enc-gate'); if (!g) return null; const r = g.querySelector('.refusal'); return { code: r ? r.dataset.code : null, buttons: [...g.querySelectorAll('button')].map((b) => ({ testid: b.getAttribute('data-testid'), text: b.textContent.trim(), kind: [...b.classList].filter((k) => k !== 'btn').join(' '), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })) }; });

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => ({
  // RC-2 (A5, A2): Undo never trims notes[enc].procedures, so a repaint doubles the scaffold line and File freezes it.
  // Negative control: if Undo trimmed the array, notes.procedures after Undo is empty, the repaint yields exactly one
  // "Composite" line while chartEvents === 1, and the filed markdown carries it once → reproduced false.
  async 'A-screens-encounter-1-1'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120);
      const afterPaint = await ENC_COUNTS(p, 'enc-9002');
      await click(p, 'enc.undo'); await p.waitForTimeout(150);
      const afterUndo = await ENC_COUNTS(p, 'enc-9002');
      await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
      const afterRepaint = await ENC_COUNTS(p, 'enc-9002');
      const scaffoldDom = await p.evaluate(() => { const li = [...document.querySelectorAll('.enc-tx li')].find((l) => /Note scaffold/.test(l.textContent)); return li ? li.textContent.replace(/\s+/g, ' ').trim() : null; });
      await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(200);
      const gateCode = await p.evaluate(() => { const r = document.querySelector('#enc-gate .refusal'); return r ? r.dataset.code : null; });
      await click(p, 'refusal.control'); await p.waitForTimeout(250);
      const filed = await p.evaluate(() => { const s = window.__proto.state(); const f = s.filedNotes.filter((n) => n.encounterId === 'enc-9002'); return f.length ? { id: f[f.length - 1].id, markdown: f[f.length - 1].markdown } : null; });
      // The scaffold line is the exact string chartPaint wrote at the first paint; count that string, not the word
      // "Composite" (the starter's Plan sentence also says Composite and would inflate a word count).
      const scaffold = ((afterPaint.notes || {}).procedures || [])[0] || 'Composite, 2 surf posterior #30 DO';
      const count = (t) => (t || '').split(scaffold).length - 1;
      const repaintLine = (afterRepaint.notes || {}).procedure || '';
      const linesInFiled = filed ? count(filed.markdown) : 0;
      const undoLeftProcedures = ((afterUndo.notes || {}).procedures || []).length;
      const reproduced = afterRepaint.chartEvents === 1 && count(repaintLine) > 1 && !!filed && linesInFiled > 1;
      rec('A-screens-encounter-1-1', 'Undo never trims notes[enc].procedures: after Undo → repaint the scaffold line reads Composite twice for one chart event, and File freezes the doubled line into the filed note', 'A5, A2 (CHECKLIST); CONTRACTS §7 flow 3', reproduced,
        { scaffoldLineCounted: scaffold, afterPaint: { chartEvents: afterPaint.chartEvents, notesProcedures: (afterPaint.notes || {}).procedures }, afterUndo: { chartEvents: afterUndo.chartEvents, notesProcedures: (afterUndo.notes || {}).procedures, notesProcedure: (afterUndo.notes || {}).procedure || null, undoLeftProceduresEntries: undoLeftProcedures }, afterRepaint: { chartEvents: afterRepaint.chartEvents, notesProcedure: repaintLine, scaffoldLineCount: count(repaintLine), scaffoldDom }, gateCodeBeforeConfirm: gateCode, filedNote: filed, scaffoldLineCountInFiledMarkdown: linesInFiled });
    } finally { await c.close(); }
  },

  // RC-3 (A5): Undo splices chartEvents/procedures/planItems in place and resets the tag; no reversal row anywhere.
  // Negative control: an append-only Undo leaves the counts unchanged or higher and some table holds a reversal row
  // (id ce-1:undo or kind undo/reversal); either makes reproduced false. A first paint that did not write is also false.
  async 'A-screens-encounter-1-2'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120);
      const before = await ENC_COUNTS(p, 'enc-9002');
      const ceId = await p.evaluate(() => { const s = window.__proto.state(); const ce = s.chartEvents.filter((x) => x.encounterId === 'enc-9002').pop(); return ce ? ce.id : null; });
      const idsBefore = await ROW_IDS(p);
      const seq0 = await SEQ(p);
      const pressed = await click(p, 'enc.undo'); await p.waitForTimeout(150);
      const after = await ENC_COUNTS(p, 'enc-9002');
      const writes = await WRITES(p, seq0);
      const newRows = await NEW_ROWS(p, idsBefore);
      const reversal = newRows.filter((r) => r.reversalMarker);
      const rowForWriteId = await p.evaluate((ids) => { const s = window.__proto.state(); return ids.map((id) => ({ id, foundIn: Object.entries(s).filter(([, v]) => Array.isArray(v) && v.some((r) => r && r.id === id)).map(([k]) => k) })); }, writes.filter((w) => w.kind === 'write').map((w) => w.id));
      const painted = before.chartEvents === 1 && before.procedures >= 1 && before.planItems === 1 && before.tag1Disposition === 'charted';
      const spliced = after.chartEvents < before.chartEvents && after.procedures < before.procedures && after.planItems < before.planItems;
      const reproduced = pressed && painted && spliced && newRows.length === 0 && reversal.length === 0;
      rec('A-screens-encounter-1-2', 'Undo removes the chart event, procedure and plan item in place and resets the tag disposition; no row is appended to any table (no reversal row) and the one write event names an id no table holds', 'A5 (CHECKLIST); A3', reproduced,
        { chartEventId: ceId, before: { chartEvents: before.chartEvents, procedures: before.procedures, planItems: before.planItems, tag1Disposition: before.tag1Disposition }, after: { chartEvents: after.chartEvents, procedures: after.procedures, planItems: after.planItems, tag1Disposition: after.tag1Disposition }, writeAndRefusalEventsAfterSeq: { from: seq0, events: writes }, writeIdsFoundInTables: rowForWriteId, rowsAppendedByUndoInAnyTable: newRows, reversalRowsAppended: reversal });
    } finally { await c.close(); }
  },

  // RC-27 (A4): the licence killer's "Send to Exams to sign" calls readyForExam on every press; the repeat is not refused.
  // Negative control: the first press must write one encounter.exam_requested row (0→1); if the second press leaves the
  // count at 1, or a refusal event with a code other than the killer rows already on screen (a refusal OF the repeat,
  // e.g. already_decided) is logged for it, reproduced is false. The killer strip re-rendering its own three rows logs
  // tag_undispositioned / assessment_required / licence_scope again; those are not a refusal of the press.
  async 'A-screens-encounter-1-3'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/hygienist/encounter/enc-9002');
      await p.focus('[data-testid="enc.note.field.assessment"]'); await p.keyboard.press('Tab'); await p.waitForTimeout(350);
      const findSend = () => p.evaluate(() => { const b = [...document.querySelectorAll('#enc-gate [data-testid^="enc.killer."]')].find((x) => /Send to Exams to sign/.test(x.textContent)); return b ? b.getAttribute('data-testid') : null; });
      const count = () => p.evaluate(() => window.__proto.state().appointmentEvents.filter((e) => e.appointmentId === 'a-1043' && e.kind === 'encounter.exam_requested').map((e) => e.id));
      const killers = await p.evaluate(() => [...document.querySelectorAll('#enc-gate .refusal')].map((r) => r.dataset.code));
      const tid1 = await findSend(); const before = await count(); const seq0 = await SEQ(p);
      const first = tid1 ? await click(p, tid1) : false; await p.waitForTimeout(150);
      const afterFirst = await count(); const seq1 = await SEQ(p);
      const tid2 = await findSend();
      const second = tid2 ? await click(p, tid2) : false; await p.waitForTimeout(150);
      const afterSecond = await count();
      const ev1 = await WRITES(p, seq0); const ev2 = ev1.filter((e) => e.seq > seq1);
      const status = await p.evaluate(() => window.__proto.state().appointments.find((a) => a.id === 'a-1043').status);
      const refusalOfRepeat = ev2.filter((e) => e.kind === 'refusal' && !killers.includes(e.code));
      const reproduced = first && second && before.length === 0 && afterFirst.length === 1 && afterSecond.length === 2 && refusalOfRepeat.length === 0;
      rec('A-screens-encounter-1-3', "Pressing the licence killer's 'Send to Exams to sign' twice writes two encounter.exam_requested rows (ae-1, ae-2) with no refusal of the repeat", 'A4 (CHECKLIST)', reproduced,
        { killerCodesRenderedBeforePress: killers, controlTestid: { first: tid1, second: tid2 }, examRequestedRows: { before, afterFirst, afterSecond }, eventsFirstPress: ev1.filter((e) => e.seq <= seq1), eventsSecondPress: ev2, refusalEventsWithANewCodeOnSecondPress: refusalOfRepeat, appointmentStatus: status });
    } finally { await c.close(); }
  },

  // RC-28 (B2): dismissing a tag with an empty reason raises code reason_required, which CONTRACTS §6 does not list.
  // Negative control: a refusal whose code is in the §6 list (or no refusal at all) → reproduced false. The code is read
  // from the refusal event and the rendered component's data-code, and compared with the parsed §6 list.
  async 'A-screens-encounter-1-4'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(120);
      const reasonValue = await p.$eval('[data-testid="enc.tag.tag-1.reason"]', (e) => e.value).catch(() => null);
      const seq0 = await SEQ(p);
      await click(p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(150);
      const ev = await WRITES(p, seq0);
      const refusals = ev.filter((e) => e.kind === 'refusal');
      const rendered = await p.evaluate(() => { const r = document.querySelector('.enc-tagrow .refusal'); if (!r) return null; const ctl = r.querySelector('[data-testid="refusal.control"]'); return { code: r.dataset.code, verb: (r.querySelector('[data-testid="refusal.verb"]') || {}).textContent, control: ctl ? ctl.textContent.trim() : null, controlH: ctl ? Math.round(ctl.getBoundingClientRect().height) : null, why: !!r.querySelector('[data-testid="refusal.why"]') }; });
      const code = rendered ? rendered.code : (refusals[0] || {}).code;
      const verbWords = rendered && rendered.verb ? rendered.verb.trim().split(/\s+/).length : null;
      const reproduced = !!code && reasonValue === '' && S6_CODES.length > 0 && !S6_CODES.includes(code) && refusals.some((r) => r.code === code);
      rec('A-screens-encounter-1-4', "The empty-reason Dismiss gate raises code 'reason_required', which is not in the CONTRACTS §6 code list", 'B2 (CHECKLIST); CONTRACTS §6', reproduced,
        { reasonFieldValue: reasonValue, refusalEvents: refusals, rendered, verbWordCount: verbWords, codeInS6: S6_CODES.includes(code), s6Codes: S6_CODES });
    } finally { await c.close(); }
  },

  // RC-29 (B2): the read-back gate renders three 44 px controls (Confirm and file, Switch author, Held).
  // Negative control: the gate must carry the readback code; if #enc-gate then holds exactly one button of 44 px or
  // taller, reproduced is false. Summary "Why" is not a button and is not counted.
  async 'A-screens-encounter-1-5'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      const seq0 = await SEQ(p);
      await toReadback(p, click);
      const gate = await GATE_BUTTONS(p);
      const refusals = (await WRITES(p, seq0)).filter((e) => e.kind === 'refusal');
      const big = gate ? gate.buttons.filter((x) => x.h >= 44) : [];
      const reproduced = !!gate && gate.code === 'readback' && big.length > 1;
      rec('A-screens-encounter-1-5', 'The read-back gate renders more than one 44 px control for one gate', 'B2 (CHECKLIST); CONTRACTS §6 one 44 px control', reproduced,
        { gateCode: gate ? gate.code : null, buttonsInGate: gate ? gate.buttons : null, controlsAtLeast44px: big.length, refusalEvents: refusals });
    } finally { await c.close(); }
  },

  // RC-216 (B1): with no tooth selected the five surface buttons carry enc.surface.0.<s>; 0 is outside §4's 1-32.
  // Negative control: if the initial ids already have a tooth in 1-32 (or no surface buttons render) reproduced is
  // false. Selecting tooth 30 afterwards must move the ids to enc.surface.30.<s>, showing the measurement discriminates.
  async 'A-screens-encounter-1-6'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002?device=desk');
      const ids = () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="enc.surface."]')].map((e) => e.getAttribute('data-testid')));
      const initial = await ids();
      const toothOf = (id) => { const m = id.match(/^enc\.surface\.(\d+)\.(m|o|d|b|l)$/); return m ? Number(m[1]) : NaN; };
      const outOfRange = initial.filter((id) => { const t = toothOf(id); return !(t >= 1 && t <= 32); });
      const seq0 = await SEQ(p);
      const pressed = await click(p, 'enc.surface.0.m'); await p.waitForTimeout(150);
      const afterPress = await ids(); const ev = await WRITES(p, seq0);
      await click(p, 'enc.tooth.30'); await p.waitForTimeout(120);
      const afterTooth = await ids();
      const reproduced = initial.length > 0 && outOfRange.length === initial.length && pressed && afterPress.every((id) => toothOf(id) === 0);
      rec('A-screens-encounter-1-6', 'Every encounter first renders enc.surface.0.<m|o|d|b|l>: the tooth segment 0 is outside the §4 pattern 1-32, and pressing one refuses tooth_required while the ids stay at 0', 'B1 (CHECKLIST); CONTRACTS §4 Encounter row', reproduced,
        { initialSurfaceIds: initial, outOfContract: outOfRange, section4EncounterRow: S4_ENCOUNTER_ROW, pressEnc_surface_0_m: { accepted: pressed, events: ev, idsAfter: afterPress }, idsAfterSelectingTooth30: afterTooth });
    } finally { await c.close(); }
  },

  // RC-231 (A3, A5), encounter.js half: undo splices four tables and logs one write with a non-row id; dismissTag edits
  // the seed tag in place and calls Proto.events.write('tags', 'tag-1') with no appended row.
  // Negative control: an Undo that appends (counts not lower, the written id present in a table) and a Dismiss whose
  // write id is a new row (tags count grows) both make reproduced false. The shell/palette/phone sites are other files.
  async 'A-screens-encounter-1-7'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/encounter/enc-9002');
      await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120);
      const beforeUndo = await ENC_COUNTS(p, 'enc-9002'); const seq0 = await SEQ(p);
      await click(p, 'enc.undo'); await p.waitForTimeout(150);
      const afterUndo = await ENC_COUNTS(p, 'enc-9002'); const seq1 = await SEQ(p);
      const undoEvents = await WRITES(p, seq0);
      const undoIdsInTables = await p.evaluate((ids) => { const s = window.__proto.state(); return ids.map((id) => ({ id, foundIn: Object.entries(s).filter(([, v]) => Array.isArray(v) && v.some((r) => r && r.id === id)).map(([k]) => k) })); }, undoEvents.filter((e) => e.kind === 'write').map((e) => e.id));
      await click(p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(120);
      await p.fill('[data-testid="enc.tag.tag-1.reason"]', 'No caries seen on BWX');
      const seq2 = await SEQ(p);
      await click(p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(150);
      const afterDismiss = await ENC_COUNTS(p, 'enc-9002');
      const dismissEvents = await WRITES(p, seq2);
      const tagRow = await p.evaluate(() => { const t = window.__proto.state().tags.find((x) => x.id === 'tag-1'); return t ? { id: t.id, disposition: t.disposition, reason: t.reason, dispositionBy: t.dispositionBy } : null; });
      const tablesShrunk = ['chartEvents', 'procedures', 'planItems'].filter((k) => afterUndo[k] < beforeUndo[k]);
      const undoBypasses = tablesShrunk.length >= 2 && undoEvents.filter((e) => e.kind === 'write').length === 1 && undoIdsInTables.every((x) => x.foundIn.length === 0);
      const dismissWrite = dismissEvents.filter((e) => e.kind === 'write' && e.table === 'tags');
      const dismissBypasses = dismissWrite.length === 1 && afterDismiss.tags === beforeUndo.tags && !!tagRow && tagRow.disposition === 'dismissed' && dismissWrite[0].id === 'tag-1';
      rec('A-screens-encounter-1-7', 'encounter.js bypasses Proto.store: Undo removes rows from chartEvents, procedures and planItems and logs one write for an id no table holds; Dismiss edits seed row tag-1 in place and logs a tags write with no appended row', 'A3, A5 (CHECKLIST)', undoBypasses && dismissBypasses,
        { undo: { before: { chartEvents: beforeUndo.chartEvents, procedures: beforeUndo.procedures, planItems: beforeUndo.planItems, tag1: beforeUndo.tag1Disposition }, after: { chartEvents: afterUndo.chartEvents, procedures: afterUndo.procedures, planItems: afterUndo.planItems, tag1: afterUndo.tag1Disposition }, tablesShrunk, events: { from: seq0, to: seq1, list: undoEvents }, writeIdsFoundInTables: undoIdsInTables },
          dismiss: { tagsCountBefore: beforeUndo.tags, tagsCountAfter: afterDismiss.tags, events: { from: seq2, list: dismissEvents }, tagRow }, scopeNote: 'shell.js/palette.js/phone.js sites of RC-231 are outside this file and not measured here' });
    } finally { await c.close(); }
  },

  // RC-71 (B10): after File, the last Undo, Dismiss, Move to plan card and Use chart tooth, focus is on body.
  // Negative control: each scenario first shows the mutation took (state diff); a scenario whose activeElement has a
  // data-testid (the next action or state line) counts as a landing. Reproduced only if a completed mutation left BODY.
  async 'A-screens-encounter-1-8'(b) {
    const out = {};
    // (a) File via the read-back control on enc-9002
    { const { c, p } = await ctx(b, 1280, 900);
      try { await go(p, '#/dentist/encounter/enc-9002'); await toReadback(p, click);
        const filedBefore = await p.evaluate(() => window.__proto.state().filedNotes.length);
        await press(p, 'refusal.control'); await p.waitForTimeout(250);
        const filedAfter = await p.evaluate(() => window.__proto.state().filedNotes.length);
        out.fileConfirm = { mutated: filedAfter > filedBefore, filedNotes: [filedBefore, filedAfter], focus: await ACTIVE(p) };
      } finally { await c.close(); } }
    // (b) Undo of the only paint on enc-9003
    { const { c, p } = await ctx(b, 1280, 900);
      try { await go(p, '#/dentist/encounter/enc-9003'); await press(p, 'enc.tooth.20'); await press(p, 'enc.proc.d2740'); await p.waitForTimeout(120);
        const n0 = (await ENC_COUNTS(p, 'enc-9003')).chartEvents; await press(p, 'enc.undo'); await p.waitForTimeout(200);
        const n1 = (await ENC_COUNTS(p, 'enc-9003')).chartEvents;
        out.undoLast = { mutated: n0 === 1 && n1 === 0, chartEvents: [n0, n1], focus: await ACTIVE(p) };
      } finally { await c.close(); } }
    // (c) Dismiss with a reason on enc-9002
    { const { c, p } = await ctx(b, 1280, 900);
      try { await go(p, '#/dentist/encounter/enc-9002'); await press(p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(120);
        await p.fill('[data-testid="enc.tag.tag-1.reason"]', 'No caries seen on BWX'); await press(p, 'enc.tag.tag-1.dismiss'); await p.waitForTimeout(200);
        const d = await p.evaluate(() => window.__proto.state().tags.find((t) => t.id === 'tag-1').disposition);
        out.dismiss = { mutated: d === 'dismissed', tag1Disposition: d, focus: await ACTIVE(p) };
      } finally { await c.close(); } }
    // (d) Move to plan card, (e) Use chart tooth, on enc-9003
    { const { c, p } = await ctx(b, 1280, 900);
      try { await go(p, '#/dentist/encounter/enc-9003');
        await p.fill('[data-testid="enc.note.field.assessment"]', 'Fee quoted $40 for the crown.'); await p.keyboard.press('Tab'); await p.waitForTimeout(350);
        const fixTid = () => p.evaluate((w) => { const b = [...document.querySelectorAll('#enc-gate [data-testid^="enc.killer."]')].find((x) => new RegExp(w).test(x.textContent)); return b ? b.getAttribute('data-testid') : null; }, 'Move to plan card');
        const t1 = await fixTid(); if (t1) await press(p, t1); await p.waitForTimeout(200);
        const assess1 = await p.evaluate(() => Proto.screens.encounter.state('enc-9003').note.assessment);
        out.moveToPlan = { control: t1, mutated: !!t1 && !/\$/.test(assess1), assessmentAfter: assess1, focus: await ACTIVE(p) };
        await press(p, 'enc.tooth.20'); await press(p, 'enc.proc.d2740'); await p.waitForTimeout(120);
        await p.fill('[data-testid="enc.note.field.assessment"]', 'Fractured cusp #19, crown today.'); await p.keyboard.press('Tab'); await p.waitForTimeout(350);
        const t2 = await p.evaluate(() => { const b = [...document.querySelectorAll('#enc-gate [data-testid^="enc.killer."]')].find((x) => /Use chart tooth/.test(x.textContent)); return b ? b.getAttribute('data-testid') : null; });
        if (t2) await press(p, t2); await p.waitForTimeout(200);
        const assess2 = await p.evaluate(() => Proto.screens.encounter.state('enc-9003').note.assessment);
        out.useChartTooth = { control: t2, mutated: !!t2 && /#20/.test(assess2) && !/#19/.test(assess2), assessmentAfter: assess2, focus: await ACTIVE(p) };
      } finally { await c.close(); } }
    const onBody = Object.entries(out).filter(([, v]) => v.mutated && v.focus.isBody).map(([k]) => k);
    const landed = Object.entries(out).filter(([, v]) => v.mutated && !v.focus.isBody).map(([k, v]) => k + '→' + (v.focus.testid || v.focus.tag));
    rec('A-screens-encounter-1-8', 'After File, the last Undo, Dismiss with reason, Move to plan card and Use chart tooth the encounter re-mount finds no focus target and document.activeElement is BODY', 'B10 (CHECKLIST)', onBody.length > 0,
      { scenarios: out, completedMutationsLeavingFocusOnBody: onBody, completedMutationsThatLanded: landed });
  },

  // RC-92 (C7): mount() restores focus by testid across encounters; app.js then focuses the h1, the field blurs, and the
  // new encounter's killer strip renders before the user touched it.
  // Negative control: leaving enc-9003 with focus on a button (enc.tooth.20) and hopping to enc-9002 must leave
  // enc-9002 unchecked with the hint line; if the field-focus variant also stays unchecked, reproduced is false.
  async 'A-screens-encounter-1-9'(b) {
    const leak = async (focusTid, type) => {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        await p.focus('[data-testid="' + focusTid + '"]'); if (type) await p.keyboard.type(type);
        const before = await p.evaluate(() => { const x = Proto.screens.encounter.state('enc-9002'); return { checked: x.checked, killers: x.killers.map((k) => k.code) }; });
        const seq0 = await SEQ(p);
        await hop(p, '#/dentist/encounter/enc-9002'); await p.waitForTimeout(400);
        const after = await p.evaluate(() => { const x = Proto.screens.encounter.state('enc-9002'); const g = document.getElementById('enc-gate'); return { checked: x.checked, killers: x.killers.map((k) => k.code), gateText: g ? g.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) : null, killerRows: g ? g.querySelectorAll('.killer .refusal').length : 0 }; });
        const ev = await p.evaluate((f) => window.__events.filter((e) => e.seq > f && ['route', 'focus', 'refusal', 'click', 'key'].includes(e.kind)).map((e) => e.kind + ':' + (e.testid || e.code || '')), seq0);
        return { leftFocusOn: focusTid, before, after, eventsAfterHop: ev, userEventsAfterHop: ev.filter((e) => /^(click|key)/.test(e)).length, focusNow: await ACTIVE(p) };
      } finally { await c.close(); }
    };
    const fromField = await leak('enc.note.field.assessment', 'Recall exam.');
    const fromButton = await leak('enc.tooth.20', null);
    const reproduced = fromField.before.checked === false && fromField.after.checked === true && fromField.after.killerRows > 0 && fromField.userEventsAfterHop === 0;
    rec('A-screens-encounter-1-9', "Arriving at enc-9002 with the cursor left in enc-9003's Assessment field fires enc-9002's killer strip with no user blur: mount() refocuses the same testid and the h1 focus blurs it", 'C7 (CHECKLIST)', reproduced,
      { fromField, controlFromButton: fromButton });
  },

  // RC-93 (A7): the Exams list's practice line ("3 notes filed", "11 min"), the BWX chip and the wait minutes are literals.
  // Negative control: file a note and return to Exams; if the "notes filed" number moved with filedNotes (or the line is
  // not rendered), reproduced is false. The chip and wait readings are carried as supporting measurements.
  async 'A-screens-encounter-1-10'(b) {
    const { c, p } = await ctx(b, 1280, 900);
    try {
      await go(p, '#/dentist/exams');
      const read = () => p.evaluate(() => {
        const s = window.__proto.state();
        const line = document.querySelector('.practice-line'); const m = line ? line.textContent.match(/(\d+) notes filed/) : null;
        const rows = [...document.querySelectorAll('[data-testid^="exams.row."]:not([data-testid$=".open"])')].map((r) => ({ id: r.getAttribute('data-testid'), wait: (r.querySelector('.enc-wait') || {}).textContent, bwxChip: /BWX/.test(r.textContent), type: (s.appointments.find((a) => a.encounterId === r.getAttribute('data-testid').replace('exams.row.', '')) || {}).type }));
        return { practiceLine: line ? line.textContent.trim() : null, notesFiledOnScreen: m ? Number(m[1]) : null, filedNotesInStore: s.filedNotes.length, clock: s.clock.time, rows, bwxDueFlagsInSeed: s.appointments.filter((a) => a.bwxDue).map((a) => a.id) };
      });
      const before = await read();
      await click(p, 'exams.row.enc-9002.open'); await p.waitForTimeout(150);
      await toReadback(p, click); await click(p, 'refusal.control'); await p.waitForTimeout(250);
      await hop(p, '#/dentist/exams'); await p.waitForTimeout(200);
      const after = await read();
      const filedMoved = after.filedNotesInStore > before.filedNotesInStore;
      const reproduced = filedMoved && before.notesFiledOnScreen != null && after.notesFiledOnScreen === before.notesFiledOnScreen && after.practiceLine === before.practiceLine;
      rec('A-screens-encounter-1-10', "The Exams practice line's 'notes filed' count does not move when a note is filed; the BWX chip renders on every restorative row and wait minutes are constants", 'A7 (CHECKLIST); C5', reproduced,
        { before, after, filedNotesMoved: filedMoved, practiceLineUnchanged: after.practiceLine === before.practiceLine, restorativeRowsWithChip: after.rows.filter((r) => r.type === 'restorative').map((r) => r.id + ':' + r.bwxChip) });
    } finally { await c.close(); }
  },
});
