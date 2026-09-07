// Audit checks for prototype/js/screens/roles.js, chunk screens-roles
// (root causes RC-197, 199, 200, 201, 202, 204, 206, 205, 207, 208, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';
const CONTRACTS = (() => { try { return fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8'); } catch { return ''; } })();

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const START = '#/owner/roles';
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const kinds = (ev) => ev.map((e) => e.seq + ':' + e.kind + (e.testid ? ':' + e.testid : e.table ? ':' + e.table + '/' + e.id : e.code ? ':' + e.code : e.key ? ':' + e.key : ''));
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body || !a ? { tag: 'BODY', testid: null } : { tag: a.tagName, testid: a.getAttribute('data-testid') }; });
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    controls: [...r.querySelectorAll('button')].map((b) => ({ testid: b.getAttribute('data-testid'), text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) })),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  const pressedOf = (p, tid) => p.evaluate((tid) => { const e = document.querySelector('[data-testid="' + tid + '"]'); return e ? e.getAttribute('aria-pressed') : null; }, tid);
  const typeName = async (p, name) => { await p.fill('[data-testid="roles.daypass.name"]', ''); await p.type('[data-testid="roles.daypass.name"]', name); };
  // Move focus out of a text field before a mouse press on the save button: the blur handler rebuilds the preview and the save button,
  // so a press that lands while a field has focus is the very defect RC-197 describes. Every other check settles first so it measures its own claim.
  // (A Tab inside a type=time input only moves between its hour/minute segments, so focus is released by blurring the active field directly.)
  const settle = async (p) => { await p.evaluate(() => { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }); await p.waitForTimeout(150); };
  const sec6Codes = () => { const m = /Codes:\s*([^\n]*)/.exec(CONTRACTS); return m ? [...m[1].matchAll(/`([a-z_]+)`/g)].map((x) => x[1]) : []; };
  const sec4Roles = () => { const line = CONTRACTS.split('\n').find((l) => /^\|\s*Roles\s*\|/.test(l)) || ''; return [...line.matchAll(/`([^`]+)`/g)].map((x) => x[1]); };
  const toPattern = (id) => new RegExp('^' + id.replace(/[.]/g, '\\.').replace(/<([^>]+)>/g, (m, inner) => inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9-]+') + '$');

  return {
    // RC-197 · A2/A1/B10 · roles.js:196 onBlur → refreshPreview(r, true) → :162-163 replace the preview node and roles.daypass.save while the pointer is down.
    // Negative control: a first mouse press that works logs click:roles.daypass.save and either writes dayPasses/dp-1 (Alex Rivera, Front desk, no
    // conflict) or raises a refusal in the same seq range; then `firstSwallowed` is false and the check reports false. The second, identical press
    // must succeed (dayPasses grows) or the failure is something other than a swallowed press and the check also reports false.
    async 'A-screens-roles-1'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await typeName(p, 'Alex Rivera');
        const focusBefore = await active(p);
        const dpBefore = (await state(p)).dayPasses.length;
        const bx = await box(p, 'roles.daypass.save');
        const labelBefore = await p.$eval('[data-testid="roles.daypass.save"]', (x) => { x.__mark = 'first'; return x.textContent.trim(); });
        const seq0 = await lastSeq(p);
        await p.mouse.move(bx.x + bx.w / 2, bx.y + bx.h / 2); await p.mouse.down(); await p.waitForTimeout(40);
        const replacedDuringPress = await p.$eval('[data-testid="roles.daypass.save"]', (x) => x.__mark !== 'first');
        const boxDuringPress = await box(p, 'roles.daypass.save');
        await p.mouse.up(); await p.waitForTimeout(200);
        const ev1 = await after(p, seq0);
        const first = { events: kinds(ev1), clicksOnSave: ev1.filter((e) => e.kind === 'click' && e.testid === 'roles.daypass.save').length, refusals: refusalEvents(ev1), writes: writes(ev1), dayPasses: (await state(p)).dayPasses.length, focus: await active(p), announcement: await live(p), seqRange: range(ev1, seq0) };
        // The swallowed press also built the preview, which moves the button down the page; the second press is aimed at the button where it now is.
        const seq1 = await lastSeq(p);
        const bx2 = await box(p, 'roles.daypass.save');
        await p.mouse.click(bx2.x + bx2.w / 2, bx2.y + bx2.h / 2); await p.waitForTimeout(200);
        const ev2 = await after(p, seq1);
        const second = { events: kinds(ev2), clicksOnSave: ev2.filter((e) => e.kind === 'click' && e.testid === 'roles.daypass.save').length, refusals: refusalEvents(ev2), writes: writes(ev2), dayPasses: (await state(p)).dayPasses.length, focus: await active(p), announcement: await live(p), seqRange: range(ev2, seq1) };
        const firstSwallowed = first.clicksOnSave === 0 && first.refusals.length === 0 && first.writes.length === 0 && first.dayPasses === dpBefore;
        const secondWorked = second.writes.some((w) => w.startsWith('dayPasses/')) && second.dayPasses === dpBefore + 1;
        const reproduced = focusBefore.testid === 'roles.daypass.name' && replacedDuringPress && firstSwallowed && secondWorked;
        rec('A-screens-roles-1', 'With the caret in roles.daypass.name, the first mouse press on Issue day pass is swallowed (the blur handler replaces the button between mousedown and mouseup: no click, no refusal, no write, focus on body) while the identical second press writes dayPasses/dp-1', 'A2, A1, B10 — the control does what its label promises on the first press and focus never lands on body; roles.js:196/199 onBlur → refreshPreview(r, true) → :162-163',
          reproduced, { focusBeforePress: focusBefore, saveLabelBefore: labelBefore, saveBoxBefore: bx, replacedDuringPress, saveBoxDuringPress: boxDuringPress, saveBoxAtSecondPress: bx2, dayPassesBefore: dpBefore, firstPress: first, secondPress: second, pageErrors: errs.slice(0, 3) });
      } finally { await c.close(); }
    },

    // RC-199 · B2 · roles.js:176-177 raise name_required and shift_end_required; CONTRACTS §6 lists neither.
    // Negative control: both gates render a data-code that appears in the §6 "Codes:" sentence (or §6 is later extended to carry them);
    // then `missing` is empty and the check reports false. The gate must actually be the one claimed — data-code and the refusal event code are
    // both read — a different refusal (or none) is not scored. Focus is moved out of the text field first so the press is not swallowed (RC-197).
    async 'A-screens-roles-2'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        const codes = sec6Codes();
        await go(p, START);
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await settle(p);
        const seq0 = await lastSeq(p);
        const pressedName = await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const evA = await after(p, seq0);
        const nameGate = { pressed: pressedName, dom: await refusalsDom(p), events: refusalEvents(evA), saveButton: await p.$eval('[data-testid="roles.daypass.save"]', (x) => ({ text: x.textContent.trim(), class: x.className, disabled: x.disabled })).catch(() => null), focus: await active(p), seqRange: range(evA, seq0) };
        await click(p, 'refusal.control'); await p.waitForTimeout(120);
        await typeName(p, 'Jordan Blake');
        await p.fill('[data-testid="roles.daypass.end"]', '08:00'); await p.waitForTimeout(60);
        await settle(p);
        const seq1 = await lastSeq(p);
        const pressedEnd = await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const evB = await after(p, seq1);
        const endGate = { pressed: pressedEnd, endValue: await p.$eval('[data-testid="roles.daypass.end"]', (x) => x.value).catch(() => null), dom: await refusalsDom(p), events: refusalEvents(evB), saveButton: await p.$eval('[data-testid="roles.daypass.save"]', (x) => ({ text: x.textContent.trim(), class: x.className, disabled: x.disabled })).catch(() => null), focus: await active(p), seqRange: range(evB, seq1) };
        const raised = [...new Set([...nameGate.events.map((e) => e.code), ...endGate.events.map((e) => e.code), ...nameGate.dom.map((d) => d.code), ...endGate.dom.map((d) => d.code)].filter(Boolean))];
        const missing = raised.filter((code) => !codes.includes(code));
        const claimed = ['name_required', 'shift_end_required'];
        const reproduced = codes.length > 0 && claimed.every((code) => raised.includes(code) && missing.includes(code));
        rec('A-screens-roles-2', 'Issue day pass raises gates with codes name_required and shift_end_required; neither code is in the CONTRACTS §6 list', 'B2 / CONTRACTS §6 — a code the product raises and the list omits is a defect in one of the two; roles.js:176-177',
          reproduced, { sec6CodesSearched: codes, codesRaised: raised, codesMissingFromSec6: missing, nameGate, endGate });
      } finally { await c.close(); }
    },

    // RC-200 · B1 · roles.js:231 roles.daypass.signin, :232 roles.daypass.expiry.why, :206 roles.daypass.extra.why, :79 roles.row.<userId>.why.
    // Negative control: every `roles.*` id found on a clickable element (button or details>summary) matches an entry or `<…>` pattern in the §4 Roles
    // row; then `unlisted` is empty and the check reports false. Ids are gathered across the four reachable states the claim names, and only ids that
    // actually rendered are scored — an id the code carries but the page never showed is not counted.
    async 'A-screens-roles-3'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        const listed = sec4Roles(); const patterns = listed.map(toPattern);
        const gather = (label) => p.evaluate((label) => [...document.querySelectorAll('#canvas [data-testid^="roles."]')].map((e) => ({ id: e.getAttribute('data-testid'), tag: e.tagName, clickable: e.tagName === 'BUTTON' || e.tagName === 'SUMMARY' || e.tagName === 'INPUT', state: label })), label);
        await go(p, START);
        const found = [];
        found.push(...await gather('table'));
        await click(p, 'roles.row.u-om-1'); await p.waitForTimeout(120);
        found.push(...await gather('row u-om-1 expanded'));
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        found.push(...await gather('form open'));
        await typeName(p, 'Alex Rivera');
        await click(p, 'roles.daypass.role.rdh'); await p.waitForTimeout(150);
        const issuedPressed = await click(p, 'roles.daypass.save'); await p.waitForTimeout(250);
        const issued = await p.evaluate(() => { const S = window.__proto.state(); return S.dayPasses.map((d) => d.id + ':' + d.name + ':' + d.role); });
        found.push(...await gather('issued card'));
        const byId = {}; for (const f of found) { byId[f.id] = byId[f.id] || { tag: f.tag, clickable: f.clickable, states: [] }; if (!byId[f.id].states.includes(f.state)) byId[f.id].states.push(f.state); }
        const unlisted = Object.entries(byId).filter(([id, v]) => v.clickable && !patterns.some((re) => re.test(id))).map(([id, v]) => ({ id, tag: v.tag, states: v.states }));
        const claimed = ['roles.daypass.signin', 'roles.daypass.expiry.why', 'roles.daypass.extra.why', 'roles.row.u-om-1.why'];
        const listedPresent = listed.filter((l) => Object.keys(byId).some((id) => toPattern(l).test(id)));
        const reproduced = listed.length > 0 && claimed.every((id) => unlisted.some((u) => u.id === id));
        rec('A-screens-roles-3', 'Four clickable Roles test ids rendered in reachable states (roles.daypass.signin, roles.daypass.expiry.why, roles.daypass.extra.why, roles.row.<userId>.why) match no entry or pattern in the CONTRACTS §4 Roles row', 'B1 / CONTRACTS §4 — every id in the DOM matches a §4 entry or pattern; roles.js:231, :232, :206, :79',
          reproduced, { sec4RolesIdsSearched: listed, sec4RolesRowText: (CONTRACTS.split('\n').find((l) => /^\|\s*Roles\s*\|/.test(l)) || '').trim(), issuePressed: issuedPressed, dayPassesIssued: issued, domIdsFound: byId, unlistedClickableIds: unlisted, sec4EntriesSeenInDom: listedPresent });
      } finally { await c.close(); }
    },

    // RC-201 · B2/C2 · roles.js:143 renders a refusal per conflict (control Remediate) plus :146-148 a Remediate/Compensate/Accept group; the Held press
    // adds the store gate (store.js:285) with the same code and verb and a second refusal.control.
    // Negative control: one .refusal with data-code sod_conflict, one refusal.verb, one refusal.control and no duplicate Remediate button after the Held
    // press; then `twoGroups` is false and the check reports false. The store gate must have been raised (a refusal event with code sod_conflict in the
    // seq range of the press) — a preview that alone shows one gate is not the claim.
    async 'A-screens-roles-4'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await typeName(p, 'Casey Morgan'); await settle(p);
        await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(200);
        const snapshot = () => p.evaluate(() => {
          const groups = [...document.querySelectorAll('#canvas .refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), controls: [...r.querySelectorAll('button')].map((b) => ({ testid: b.getAttribute('data-testid'), text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) })) }));
          const sod = document.querySelector('[aria-label="SoD decision"]');
          return { refusalGroups: groups, refusalVerbs: document.querySelectorAll('#canvas [data-testid="refusal.verb"]').length, refusalControls: [...document.querySelectorAll('#canvas [data-testid="refusal.control"]')].map((b) => b.textContent.trim()), sodGroupButtons: sod ? [...sod.querySelectorAll('button')].map((b) => ({ testid: b.getAttribute('data-testid'), text: b.textContent.trim() })) : null, save: (() => { const s = document.querySelector('[data-testid="roles.daypass.save"]'); return s ? { text: s.textContent.trim(), class: s.className } : null; })() };
        });
        const before = await snapshot();
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'roles.daypass.save'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterP = await snapshot();
        const gateEvents = refusalEvents(ev);
        const focus = await active(p); const announcement = await live(p);
        const sodGroups = afterP.refusalGroups.filter((g) => g.code === 'sod_conflict');
        const controlLabels = sodGroups.flatMap((g) => g.controls.filter((x) => x.testid === 'refusal.control').map((x) => x.text));
        const remediateCount = [...afterP.refusalControls, ...(afterP.sodGroupButtons || []).map((x) => x.text)].filter((t) => /^Remediate$/.test(t)).length;
        const totalControls = afterP.refusalControls.length + (afterP.sodGroupButtons || []).length;
        const storeGateRaised = gateEvents.some((e) => e.code === 'sod_conflict' && /Remediate, compensate, or accept/.test(e.control || ''));
        const twoGroups = sodGroups.length >= 2 && afterP.refusalVerbs >= 2 && afterP.refusalControls.length >= 2 && new Set(controlLabels).size >= 2;
        const reproduced = pressed && before.save && /Held/.test(before.save.text) && storeGateRaised && twoGroups && remediateCount >= 2;
        rec('A-screens-roles-4', 'After pressing the Held Issue day pass with Refund added, the form holds two sod_conflict refusal groups with the same verb (controls "Remediate" and "Remediate, compensate, or accept") plus a Remediate/Compensate/Accept button group: two refusal.verb, two refusal.control, five controls, and Remediate twice', 'B2, C2 — one gate is one verb line and exactly one 44 px control; every row has one primary action; roles.js:143-148 and the store gate at :179 / store.js:285',
          reproduced, { beforePress: before, savePressed: pressed, refusalEventsInRange: gateEvents, afterPress: afterP, sodConflictGroups: sodGroups.length, refusalControlLabels: controlLabels, remediateButtonCount: remediateCount, totalControlsOnGate: totalControls, focusAfterPress: focus, announcementAfterPress: announcement, eventsInRange: kinds(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-202 · A2/C7 · roles.js:238 toggles formOpen only; :181 resets the form solely on a successful save; :219 says "Close the form with the Add day pass
    // button to discard" while the open label (:238) reads "Close day pass form".
    // Negative control: after close and reopen the name is empty, Front desk / Main Street are the pressed segments, no extra is pressed, the preview is
    // not showing, and an untouched reopened form carries no aria-invalid and a live Issue button; then `persisted` and `invalidOnReopen` are both
    // false and the check reports false. The hint's wording is read from the DOM, not assumed.
    async 'A-screens-roles-5'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await typeName(p, 'Casey Morgan');
        await click(p, 'roles.daypass.role.rdh'); await click(p, 'roles.daypass.location.loc-3'); await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(150);
        const openState = await p.evaluate(() => ({ addLabel: (document.querySelector('[data-testid="roles.daypass.add"]') || {}).textContent.trim(), addExpanded: (document.querySelector('[data-testid="roles.daypass.add"]') || {}).getAttribute('aria-expanded'), hintBesideSave: ((document.querySelector('[data-testid="roles.daypass.save"]') || {}).nextElementSibling || {}).textContent || null }));
        const seq0 = await lastSeq(p);
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(150);
        const closed = await p.evaluate(() => ({ formPresent: !!document.querySelector('[data-testid="roles.daypass.name"]'), addLabel: (document.querySelector('[data-testid="roles.daypass.add"]') || {}).textContent.trim() }));
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(150);
        const ev = await after(p, seq0);
        const reopened = await p.evaluate(() => {
          const g = (tid) => document.querySelector('[data-testid="' + tid + '"]');
          const pressed = (prefix) => [...document.querySelectorAll('[data-testid^="' + prefix + '"]')].filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.getAttribute('data-testid'));
          return { nameValue: g('roles.daypass.name') ? g('roles.daypass.name').value : null, nameInvalid: g('roles.daypass.name') ? g('roles.daypass.name').getAttribute('aria-invalid') : null, rolePressed: pressed('roles.daypass.role.'), locationPressed: pressed('roles.daypass.location.'), extrasPressed: pressed('roles.daypass.entitlement.'), previewShown: !!document.querySelector('.rl-preview'), previewWaitShown: !!document.querySelector('.rl-preview-wait'), save: g('roles.daypass.save') ? { text: g('roles.daypass.save').textContent.trim(), class: g('roles.daypass.save').className } : null, writesSinceOpen: window.__events.filter((e) => e.kind === 'write').length };
        });
        const persisted = reopened.nameValue === 'Casey Morgan' && reopened.rolePressed.includes('roles.daypass.role.rdh') && reopened.locationPressed.includes('roles.daypass.location.loc-3') && reopened.extrasPressed.includes('roles.daypass.entitlement.refund');
        const hintSaysDiscard = /Add day pass button to discard/.test(openState.hintBesideSave || '');
        const labelMismatch = hintSaysDiscard && openState.addLabel !== 'Add day pass';
        // The C7 half: open, close (the focused name field blurs), reopen — an untouched empty form already invalid and Held.
        const { c: c2, p: p2 } = await ctx(b, 1280, 900);
        let untouched = null;
        try {
          await go(p2, START);
          await click(p2, 'roles.daypass.add'); await p2.waitForTimeout(120);
          const focusAfterOpen = await active(p2);
          await click(p2, 'roles.daypass.add'); await p2.waitForTimeout(120);
          await click(p2, 'roles.daypass.add'); await p2.waitForTimeout(150);
          untouched = await p2.evaluate(() => { const n = document.querySelector('[data-testid="roles.daypass.name"]'); const s = document.querySelector('[data-testid="roles.daypass.save"]'); const hint = document.getElementById('rl-name-hint'); return { nameValue: n ? n.value : null, nameInvalid: n ? n.getAttribute('aria-invalid') : null, nameClass: n ? n.className : null, hint: hint ? hint.textContent.trim() : null, save: s ? { text: s.textContent.trim(), class: s.className } : null, keysTyped: window.__events.filter((e) => e.kind === 'key' && e.field).length }; });
          untouched.focusAfterOpen = focusAfterOpen;
        } finally { await c2.close(); }
        const invalidOnReopen = !!untouched && untouched.nameValue === '' && untouched.nameInvalid === 'true' && untouched.keysTyped === 0 && !!untouched.save && /Held/.test(untouched.save.text);
        const reproduced = closed.formPresent === false && persisted && hintSaysDiscard;
        rec('A-screens-roles-5', 'Closing and reopening the day-pass form keeps the name, pressed role/location/extra and the live preview although the hint beside Issue day pass says "Close the form with the Add day pass button to discard" (and the open toggle reads "Close day pass form"); an untouched form closed and reopened shows Name already invalid and Save Held', 'A2, C7 — a control does what the adjacent instruction promises; validation is silent until the user leaves a field; roles.js:238 (toggle), :181 (reset only on save), :219 (hint), :196 (touched on blur)',
          reproduced, { whileOpen: openState, afterClose: closed, afterReopen: reopened, persisted, hintSaysDiscard, openLabelDiffersFromHint: labelMismatch, untouchedCloseReopen: untouched, invalidOnReopen, eventsInRange: kinds(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-204 · B4 · roles.js:170 "Issue day pass" vs :144/:208 "Save" vs :210/:238 "Add day pass" / "Close day pass form"; :18 "Write off" vs :23 "write-offs"
    // vs :137 "write-off"; :17 "Hygienist" vs seed template "RDH (hygienist)"; :148 "Accept on purpose" vs :149 "Accepted on purpose" vs :227 "accept on
    // purpose" vs store.js:285 "Remediate, compensate, or accept".
    // Negative control: one word per concept — the prose names the button by its label, one spelling of write-off, one role word, one decision word —
    // then every group has a single variant, `groupsWithVariants` is empty and the check reports false. Each rendering is read from the DOM in the state
    // that shows it; a variant the page never rendered is not counted.
    async 'A-screens-roles-6'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        const textOf = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim()), sel);
        const rowHy = await p.evaluate(() => { const b = document.querySelector('[data-testid="roles.row.u-hy-1"]'); const tr = b && b.closest('tr'); return tr ? [...tr.children].map((td) => td.textContent.replace(/\s+/g, ' ').trim()) : null; });
        const tableChips = await p.evaluate(() => [...new Set([...document.querySelectorAll('.rl-table .rl-chips .chip')].map((e) => e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()))]);
        await click(p, 'roles.row.u-om-1'); await p.waitForTimeout(120);
        const grantsLines = await p.evaluate(() => [...document.querySelectorAll('.rl-grants li')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /write/i.test(t)));
        const addLabelClosed = await txt(p, 'roles.daypass.add');
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        const addLabelOpen = await txt(p, 'roles.daypass.add');
        const sectionHead = await p.evaluate(() => { const h2 = [...document.querySelectorAll('#canvas h2')].map((e) => e.textContent.trim()); return h2; });
        const previewWait = (await textOf('.rl-preview-wait'))[0] || null;
        const roleSegLabels = await textOf('[data-testid^="roles.daypass.role."]');
        const extraLabels = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="roles.daypass.entitlement."]')].map((e) => ({ text: e.textContent.replace(/^✓\s*/, '').trim(), aria: e.getAttribute('aria-label') })));
        await typeName(p, 'Casey Morgan'); await settle(p);
        const nonclinicalLine = await p.evaluate(() => { const r = [...document.querySelectorAll('.rl-preview .row')].find((x) => /Nonclinical/.test(x.textContent)); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
        const saveLabel = await txt(p, 'roles.daypass.save'); // the live primary, before a conflict switches it to Held
        await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(200);
        const pickHint = await p.evaluate(() => { const e = [...document.querySelectorAll('.rl-preview p.hint')].find((x) => /before Save/.test(x.textContent)); return e ? e.textContent.trim() : null; });
        const heldLabel = await txt(p, 'roles.daypass.save');
        const acceptButton = await p.evaluate(() => { const e = document.querySelector('[data-testid="roles.sod.accept"]'); return e ? e.textContent.replace(/^✓\s*/, '').trim() : null; });
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const saveGateControl = await p.evaluate(() => [...document.querySelectorAll('.refusal[data-code="sod_conflict"] [data-testid="refusal.control"]')].map((b) => b.textContent.trim()).filter((t) => t !== 'Remediate'));
        await click(p, 'roles.sod.accept'); await p.waitForTimeout(200);
        const decisionChip = await p.evaluate(() => { const e = [...document.querySelectorAll('.rl-preview .chip')].find((x) => /on purpose/i.test(x.textContent)); return e ? e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim() : null; });
        const issueLabel = await txt(p, 'roles.daypass.save');
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(250);
        const issuedChips = await p.evaluate(() => [...document.querySelectorAll('.rl-issued .chip')].map((e) => e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()));
        const issued = await p.evaluate(() => window.__proto.state().dayPasses.map((d) => d.id + ':' + d.sodDecision));
        const groups = {
          finishingVerb: { button: saveLabel, buttonHeld: heldLabel, buttonWhenDecided: issueLabel, prosePick: pickHint, proseWait: previewWait, sectionHeading: sectionHead.find((t) => /day pass/i.test(t)) || null, toggleClosed: addLabelClosed, toggleOpen: addLabelOpen },
          writeOff: { tableChip: tableChips.find((t) => /write/i.test(t)) || null, extraButton: (extraLabels.find((x) => /write/i.test(x.text)) || {}).text || null, extraAria: (extraLabels.find((x) => /write/i.test(x.text)) || {}).aria || null, grantsLine: grantsLines.find((t) => /^Write off/.test(t)) || grantsLines[0] || null, previewNonclinical: nonclinicalLine },
          roleWord: { tableRoleCell_u_hy_1: rowHy ? rowHy[1] : null, tableRowButton_u_hy_1: rowHy ? rowHy[0] : null, roleSegment: roleSegLabels.find((t) => /RDH/.test(t)) || null },
          decisionWord: { button: acceptButton, previewChip: decisionChip, issuedChip: issuedChips.find((t) => /on purpose/i.test(t)) || null, saveGateControl: saveGateControl[0] || null },
        };
        const norm = (s) => (s || '').toLowerCase();
        const variants = {
          finishingVerb: [...new Set([groups.finishingVerb.button, /Save/.test(groups.finishingVerb.prosePick || '') ? 'Save' : null, /Save/.test(groups.finishingVerb.proseWait || '') ? 'Save' : null, groups.finishingVerb.toggleClosed, groups.finishingVerb.toggleOpen].filter(Boolean))],
          writeOff: [...new Set([groups.writeOff.tableChip, (groups.writeOff.grantsLine || '').match(/write[- ]?offs?/i) ? (groups.writeOff.grantsLine.match(/write[- ]?offs?/i) || [])[0] : null, ((groups.writeOff.previewNonclinical || '').match(/write[- ]?off/i) || [])[0] || null].filter(Boolean).map((v) => v.replace(/s$/, '')))].filter((v, i, a) => a.findIndex((x) => norm(x) === norm(v)) === i),
          roleWord: [...new Set([groups.roleWord.tableRoleCell_u_hy_1, groups.roleWord.roleSegment].filter(Boolean))],
          decisionWord: [...new Set([groups.decisionWord.button, groups.decisionWord.previewChip ? (groups.decisionWord.previewChip.match(/Accepted on purpose/) || [])[0] : null, groups.decisionWord.issuedChip ? (groups.decisionWord.issuedChip.match(/accept on purpose/) || [])[0] : null, groups.decisionWord.saveGateControl].filter(Boolean))],
        };
        const groupsWithVariants = Object.entries(variants).filter(([, v]) => v.length > 1).map(([k]) => k);
        const reproduced = groupsWithVariants.length === 4 && issued.length === 1;
        rec('A-screens-roles-6', 'The Roles screen renders variant words for one concept in four groups: Issue day pass / Save / Add day pass / Close day pass form; Write off / write-offs / write-off; Hygienist / RDH (hygienist); Accept on purpose / Accepted on purpose / accept on purpose / "Remediate, compensate, or accept"', 'B4 — one canonical word per concept across screens, refusals, announcements and aria-labels; roles.js:17-18, :137, :144, :148-149, :170, :208, :210, :227, :238 and store.js:285',
          reproduced, { renderings: groups, variantsPerGroup: variants, groupsWithVariants, dayPassIssued: issued });
      } finally { await c.close(); }
    },

    // RC-206 · C3 · roles.js:64 prints rule.pair.join(' + ') (entitlement codes) in the accepted-decision chip and :83 the raw decisionId; the SoD and licence
    // gate Why texts (store.js:279/285, roles.js:143) carry codes and a table name. This check covers the Roles part; the other screens named in the
    // root cause belong to their own files' modules.
    // Negative control: the chip and disclosure read the words the same table uses two columns left (Post payments, Refund) and no /\b[a-z]+_[a-z_]+\b/
    // code or /\bd-\d+\b/ id appears; then `codesOnScreen` is empty and `rawIdOnScreen` is false and the check reports false.
    async 'A-screens-roles-7'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        const grant = await p.evaluate(() => { const S = window.__proto.state(); const g = S.currentGrants[0]; const rule = S.sodRules.find((r) => r.id === g.accepted.ruleId); return { userId: g.userId, decisionId: g.accepted.decisionId, ruleId: rule.id, pair: rule.pair }; });
        const chipRow = await p.evaluate(() => { const b = document.querySelector('[data-testid="roles.row.u-om-1"]'); const tr = b && b.closest('tr'); return tr ? { entitlementChips: [...tr.children[2].querySelectorAll('.chip')].map((e) => e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()), decisionChip: tr.children[3].textContent.replace(/^[■▲◆★▬●]\s*/, '').replace(/\s+/g, ' ').trim() } : null; });
        await click(p, 'roles.row.u-om-1'); await p.waitForTimeout(120);
        await click(p, 'roles.row.u-om-1.why'); await p.waitForTimeout(120);
        const disclosure = await p.evaluate(() => { const n = document.querySelector('.rl-grants .rl-note'); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; });
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await typeName(p, 'Casey Morgan'); await settle(p);
        await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(200);
        const previewWhy = await p.evaluate(() => [...document.querySelectorAll('.rl-preview .refusal .whytext')].map((e) => e.textContent.trim()));
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const saveGateWhy = await p.evaluate(() => [...document.querySelectorAll('#canvas .refusal .whytext')].map((e) => e.textContent.trim()).filter((t) => /Critical conflict/.test(t)));
        await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(150); // turn Refund off
        await click(p, 'roles.daypass.role.rdh'); await p.waitForTimeout(200);          // unknown name + clinical role → licence gate
        const licenceWhy = await p.evaluate(() => [...document.querySelectorAll('.rl-preview .refusal[data-code="licence_not_on_file"] .whytext')].map((e) => e.textContent.trim()));
        const codeRe = /\b[a-z]+_[a-z_]+\b/g;
        const codesIn = (s) => (s || '').match(codeRe) || [];
        const codesOnScreen = { decisionChip: codesIn(chipRow && chipRow.decisionChip), disclosure: codesIn(disclosure), previewWhy: previewWhy.flatMap(codesIn), saveGateWhy: saveGateWhy.flatMap(codesIn), licenceWhy: licenceWhy.flatMap(codesIn) };
        const rawIdOnScreen = !!disclosure && new RegExp('\\b' + grant.decisionId + '\\b').test(disclosure);
        const chipUsesCodes = !!chipRow && grant.pair.every((code) => (chipRow.decisionChip || '').includes(code));
        const translatedWordsInSameRow = !!chipRow && chipRow.entitlementChips.some((t) => /Post payments/.test(t)) && chipRow.entitlementChips.some((t) => /^Refund$/.test(t));
        const reproduced = chipUsesCodes && translatedWordsInSameRow && rawIdOnScreen;
        rec('A-screens-roles-7', 'The Roles accepted-decision chip prints the entitlement codes "post_payment + refund" beside chips that translate the same codes to "Post payments" and "Refund", and the disclosure prints the raw decision id "d-0"; the SoD and licence Why texts carry codes and the table name staff_credentials', 'C3 — no product-internal nouns, codes or raw ids on screen unless the spec shows them; roles.js:64, :83, :143, store.js:279, :285',
          reproduced, { seedGrant: grant, peopleRow_u_om_1: chipRow, disclosureText: disclosure, previewWhyTexts: previewWhy, saveGateWhyTexts: saveGateWhy, licenceGateWhyTexts: licenceWhy, codesOnScreen, rawDecisionIdOnScreen: rawIdOnScreen, chipUsesCodes, translatedWordsInSameRow, scope: 'Roles part of RC-206 only; Daily Close, Phone, Ledger and Checkout parts are other files' });
      } finally { await c.close(); }
    },

    // RC-205 · B7 · roles.js:64 shortDate(reviewBy) → "10/1" in the decision chip; :67 longDate(expiresAt) → "6/30/2027" in the credential chip;
    // :83 longDate(reviewBy) → "10/1/2026" in prose; :13 the literal REVIEW_AT_SAVE "10/3" on the issued chip.
    // Negative control: every chip date matches one format (all M/D or all M/D/YYYY) and the issued chip reads the store's reviewBy through the same
    // formatter; then `formatsInChips.size <= 1` and the check reports false. Each rendering is paired with the store value it should derive from.
    async 'A-screens-roles-8'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        const store = await p.evaluate(() => { const S = window.__proto.state(); return { reviewBy: S.currentGrants[0].accepted.reviewBy, credentialExpires: (S.credentials.find((x) => x.userId === 'u-hy-1') || {}).expiresAt, today: S.tenant.today }; });
        const decisionChipTable = await p.evaluate(() => { const b = document.querySelector('[data-testid="roles.row.u-om-1"]'); const tr = b && b.closest('tr'); return tr ? tr.children[3].textContent.replace(/^[■▲◆★▬●]\s*/, '').replace(/\s+/g, ' ').trim() : null; });
        await click(p, 'roles.row.u-om-1'); await click(p, 'roles.row.u-om-1.why'); await p.waitForTimeout(120);
        const omPanel = await p.evaluate(() => { const g = document.querySelector('.rl-grants'); return g ? { chips: [...g.querySelectorAll('.chip')].map((e) => e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()), note: (g.querySelector('.rl-note') || {}).textContent || null } : null; });
        await click(p, 'roles.row.u-hy-1'); await p.waitForTimeout(120);
        const hyChips = await p.evaluate(() => { const gs = [...document.querySelectorAll('.rl-grants')]; const g = gs.find((x) => /Bree/.test(x.getAttribute('aria-label') || '')); return g ? [...g.querySelectorAll('.chip')].map((e) => e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()) : null; });
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await typeName(p, 'Casey Morgan'); await settle(p);
        await click(p, 'roles.daypass.entitlement.refund'); await click(p, 'roles.sod.compensate'); await p.waitForTimeout(150);
        const previewDecisionChip = await p.evaluate(() => { const e = [...document.querySelectorAll('.rl-preview .chip')].find((x) => /review/.test(x.textContent)); return e ? e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim() : null; });
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(250);
        const issued = await p.evaluate(() => { const S = window.__proto.state(); return { chips: [...document.querySelectorAll('.rl-issued .chip')].map((e) => e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()), controlDecisionReviewBy: (S.controlDecisions.slice(-1)[0] || {}).reviewBy || null }; });
        const shortRe = /\b\d{1,2}\/\d{1,2}(?!\/)\b/, longRe = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/;
        const fmt = (s) => longRe.test(s || '') ? 'M/D/YYYY' : shortRe.test(s || '') ? 'M/D' : null;
        const chipDates = { tableDecisionChip: decisionChipTable, panelDecisionChip: (omPanel && omPanel.chips.find((t) => /review/.test(t))) || null, credentialChip: (hyChips || []).find((t) => /expires/.test(t)) || null, previewDecisionChip, issuedDecisionChip: issued.chips.find((t) => /review/.test(t)) || null };
        const formatsInChips = new Set(Object.values(chipDates).map(fmt).filter(Boolean));
        const proseDate = ((omPanel && omPanel.note) || '').match(longRe) ? (omPanel.note.match(longRe) || [])[0] : null;
        const issuedLiteral = !!chipDates.issuedDecisionChip && /review 10\/3\b/.test(chipDates.issuedDecisionChip) && issued.controlDecisionReviewBy === '2026-10-03';
        const reproduced = formatsInChips.size > 1 && fmt(chipDates.tableDecisionChip) === 'M/D' && fmt(chipDates.credentialChip) === 'M/D/YYYY';
        rec('A-screens-roles-8', 'Roles chips carry two date formats: the decision chip "review 10/1" (shortDate) beside the credential chip "expires 6/30/2027" (longDate); the disclosure prose prints the same review date as "10/1/2026"; the issued chip prints the literal "review 10/3"', 'B7 — one date format per context; roles.js:64 (shortDate), :67 and :83 (longDate), :13 (literal REVIEW_AT_SAVE)',
          reproduced, { storeValues: store, chipRenderings: chipDates, chipFormats: Object.fromEntries(Object.entries(chipDates).map(([k, v]) => [k, fmt(v)])), formatsInChips: [...formatsInChips], disclosureProseDate: proseDate, issuedChipIsLiteral: issuedLiteral, controlDecisionReviewBy: issued.controlDecisionReviewBy });
      } finally { await c.close(); }
    },

    // RC-207 · C6 · roles.js:211, :137, :144, :219 (and the :208 wait paragraph) render explanatory prose directly on the finish path.
    // Negative control: those explanations sit inside a <details> (a Why or disclosure) or are absent, leaving the form with fields, the verb line and
    // the control; then `visibleProse` holds fewer than four paragraphs and the check reports false. Only text visible outside any <details> counts,
    // measured by getBoundingClientRect and by walking up for a details ancestor.
    async 'A-screens-roles-9'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        const prose = () => p.evaluate(() => {
          const form = document.querySelector('[data-testid="roles.daypass.save"]') && document.querySelector('[data-testid="roles.daypass.save"]').closest('section');
          if (!form) return null;
          const out = [];
          for (const e of form.querySelectorAll('p.hint, span.small.muted, p.rl-note, p.rl-preview-wait')) {
            if (e.closest('details')) continue;
            if (e.closest('.field') && e.id && /hint$/.test(e.id)) continue; // field-level input hints (aria-describedby) are not policy prose
            const b = e.getBoundingClientRect(); if (b.height < 4 || b.width < 4) continue;
            const t = e.textContent.replace(/\s+/g, ' ').trim(); if (t.split(/\s+/).length < 8) continue;
            out.push({ text: t, words: t.split(/\s+/).length, insidePreview: !!e.closest('.rl-preview'), besideSave: !!e.closest('.btnrow') });
          }
          return out;
        });
        const beforePreview = await prose();
        await typeName(p, 'Casey Morgan'); await settle(p);
        await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(200);
        const withConflict = await prose();
        const claimed = [/^Four fields\./, /Front desk template carries no refund/, /^Pick one before Save\./, /^Irreversible: writes the grant row/];
        const matched = claimed.map((re) => ({ pattern: re.source, found: (withConflict || []).find((x) => re.test(x.text)) || null }));
        const detailsInForm = await p.evaluate(() => [...document.querySelectorAll('#canvas section details summary')].map((s) => s.textContent.trim()));
        const reproduced = !!withConflict && matched.every((m) => !!m.found) && withConflict.length >= 4;
        rec('A-screens-roles-9', 'With Refund added, the day-pass form shows at least four explanatory paragraphs outside any Why or disclosure (form description, template note, "Pick one before Save", and the irreversibility note beside Issue day pass)', 'C6 — policy prose never on the finish path; explanations sit behind Why or a disclosure; roles.js:211, :137, :144, :219, :208',
          reproduced, { visibleProseBeforePreview: beforePreview, visibleProseWithConflict: withConflict, claimedParagraphs: matched, disclosuresAvailableInForm: detailsInForm });
      } finally { await c.close(); }
    },

    // RC-208 · C8/A2 · roles.js:110-113 remediate() strips every extra that appears in any conflict pair and announces the singular.
    // Negative control: Remediate on the Refund gate turns off Refund only (Write off stays aria-pressed="true" and its own gate remains), or the
    // announcement counts what was removed; then `bothRemoved` is false (or the announcement is plural) and the check reports false. Both extras must
    // have been on and both conflicts shown before the press, or the press did not face the situation claimed.
    async 'A-screens-roles-10'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, START);
        await click(p, 'roles.daypass.add'); await p.waitForTimeout(120);
        await typeName(p, 'Casey Morgan'); await settle(p);
        await click(p, 'roles.daypass.entitlement.refund'); await click(p, 'roles.daypass.entitlement.write_off'); await p.waitForTimeout(200);
        const before = { refundPressed: await pressedOf(p, 'roles.daypass.entitlement.refund'), writeOffPressed: await pressedOf(p, 'roles.daypass.entitlement.write_off'), conflicts: await p.evaluate(() => [...document.querySelectorAll('.rl-preview .refusal')].map((r) => ({ code: r.dataset.code, verb: (r.querySelector('[data-testid="refusal.verb"]') || {}).textContent, control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim(), why: ((r.querySelector('.whytext') || {}).textContent || '').trim() }))), storeConflicts: await p.evaluate(() => Proto.store.previewDayPass({ name: 'Casey Morgan', role: 'frontdesk', location: 'loc-1', end: '17:30', extra: ['refund', 'write_off'] }).conflicts.map((x) => x.id + ':' + x.severity)), hint: await p.evaluate(() => { const e = [...document.querySelectorAll('.rl-preview p.hint')].find((x) => /Remediate drops/.test(x.textContent)); return e ? e.textContent.trim() : null; }) };
        const firstControl = await p.evaluate(() => { const r = document.querySelector('.rl-preview .refusal'); const b = r && r.querySelector('[data-testid="refusal.control"]'); return b ? { code: r.dataset.code, why: ((r.querySelector('.whytext') || {}).textContent || '').trim(), text: b.textContent.trim() } : null; });
        const seq0 = await lastSeq(p);
        const pressed = await p.$('.rl-preview .refusal [data-testid="refusal.control"]').then(async (el) => { if (!el) return false; await el.click(); return true; }); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const afterP = { refundPressed: await pressedOf(p, 'roles.daypass.entitlement.refund'), writeOffPressed: await pressedOf(p, 'roles.daypass.entitlement.write_off'), conflictsShown: await p.evaluate(() => document.querySelectorAll('.rl-preview .refusal').length), announcement: await live(p), focus: await active(p) };
        const bothOnBefore = before.refundPressed === 'true' && before.writeOffPressed === 'true' && before.conflicts.length === 2;
        const bothRemoved = afterP.refundPressed === 'false' && afterP.writeOffPressed === 'false';
        const singular = /Extra entitlement removed/.test(afterP.announcement) && !/entitlements/.test(afterP.announcement);
        const reproduced = bothOnBefore && pressed && !!firstControl && /post_payment \+ refund/.test(firstControl.why) && bothRemoved && singular;
        rec('A-screens-roles-10', 'Pressing Remediate on the post_payment + refund gate turns off both Refund and Write off and announces "Extra entitlement removed; no SoD conflicts" in the singular', 'C8, A2 — the announcement states what happened and the control does what its row promises ("Remediate drops the extra entitlement"); roles.js:110-113',
          reproduced, { before, remediateControlPressed: firstControl, pressed, after: afterP, bothRemoved, announcementSingular: singular, eventsInRange: kinds(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
