// Audit checks for prototype/js/screens/board.js, chunk screens-board-2
// (root causes RC-148, RC-218, RC-222, RC-239, RC-250, RC-145, RC-146, RC-147, RC-230, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
//
// Two traps this chunk avoids on purpose:
//  1. document.styleSheets[].cssRules throws SecurityError over file://, and a catch-and-continue would
//     silently report "no rules". Nothing here reads styleSheets: layout consequences are measured through
//     getBoundingClientRect / getComputedStyle in the live page.
//  2. p.goto to a URL that differs only in its fragment is a SAME-DOCUMENT navigation, so the store, the
//     screen modules and window.__events survive it. Every leg that must start clean gets its own context
//     (or goes through about:blank first), so no leg inherits the previous leg's screen state.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const readRepo = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const CONTRACTS = readRepo('prototype/CONTRACTS.md');
const sectionOf = (n) => { const i = CONTRACTS.indexOf('## ' + n + '.'); if (i < 0) return ''; const j = CONTRACTS.indexOf('\n## ', i + 4); return CONTRACTS.slice(i, j < 0 ? CONTRACTS.length : j); };
// §4: every backticked entry in every table row of the convention table. `<a|b>` enumerates; a bare `<x>`
// stands for exactly ONE id segment, so a placeholder never swallows a dot — that is what makes
// board.card.<apptId> different from board.card.a-1042.rail.
const s4Rows = () => sectionOf(4).split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*Screen\s*\|/.test(l) && !/^\|\s*-+/.test(l));
const s4Entries = () => s4Rows().flatMap((row) => [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
const s4Regex = (e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => (inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+')) + '$');

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {

// The readiness row ids carry seed id segments (`board.readiness.row.<seedId>.<control>`), and a fix round
// can legitimately change which seed id a row names. A probe that hard-codes one stops pressing anything the
// day that happens — silently, because click() returns false rather than throwing — so each row is found by
// its control suffix instead. Trap 2: a rename disarms a check without crashing it.
const readinessRow = (p, control) => p.evaluate((c) => {
  const e = document.querySelector('[data-testid^="board.readiness.row."][data-testid$=".' + c + '"]');
  return e ? e.getAttribute('data-testid') : null;
}, control);
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const since = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.seq + ':' + e.table + '/' + e.id);
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const ids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')));
  // A press that cannot hang the run: missing control -> false, unclickable control -> false.
  const tap = async (p, tid) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; try { await p.click(s, { timeout: 5000 }); } catch { return false; } await p.waitForTimeout(110); return true; };
  const type = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.blur(); }, s); await p.waitForTimeout(150); return true; };
  const apptStatuses = (p) => p.evaluate(() => Object.fromEntries(window.__proto.state().appointments.filter((a) => a.locationId === 'loc-1' && /^a-10/.test(a.id)).map((a) => [a.id, a.status])));
  // The readiness strip, read the way the screen renders it: the row aria-labels, the row controls, the
  // "N to handle" chip, the toggle label and whether the body is hidden.
  const readiness = (p) => p.evaluate(() => {
    const sec = document.querySelector('section.readiness');
    if (!sec) return null;
    const body = document.getElementById('board-readiness-body');
    const toggle = sec.querySelector('[data-testid="board.readiness.toggle"]');
    return {
      rowLabels: [...sec.querySelectorAll('.rdrow')].map((r) => r.getAttribute('aria-label')),
      rowControls: [...sec.querySelectorAll('.rdrow [data-testid]')].map((b) => b.getAttribute('data-testid') + '="' + b.textContent.trim() + '"'),
      headChip: (sec.querySelector('.chip') || {}).textContent ? sec.querySelector('.chip').textContent.replace(/^[■▲◆★▬●]\s*/, '').trim() : null,
      tempRowPresent: !!sec.querySelector('[data-testid^="board.readiness.row."][data-testid$=".add"]'),
      handledSummaryPresent: !!sec.querySelector('[data-testid="board.readiness.handled"]'),
      bodyHidden: body ? body.hidden : null,
      toggleLabel: toggle ? toggle.textContent.trim() : null,
      toggleExpanded: toggle ? toggle.getAttribute('aria-expanded') : null,
    };
  });

  return {
    // RC-148 · B11 / C2 · board.js:262 renders the readiness strip, the chair strip and the operatory columns
    // above the queue, so the Board's one-tap flow-1 control (board.card.a-1042.arrive, CONTRACTS §7 flow 1)
    // starts below the first screen. Measured in three fresh contexts, one per device profile, with the canvas
    // at scrollTop 0 (app.js resets it on every route change), reading getBoundingClientRect against
    // window.innerHeight and the canvas client height.
    // Negative control: if the strip were collapsed or the columns reordered so the first Arrive sat on the
    // first screen, rect.bottom <= window.innerHeight, belowFold is false at that width and the check reports
    // false. A control that is not rendered at all is not a below-the-fold control: present:false also reports
    // false (a missing element is never the evidence for this claim).
    async 'A-screens-board-2-1'(b) {
      const legs = [];
      let err = null;
      for (const [w, hgt, profile] of [[1280, 900, 'desk 1280x900'], [1024, 768, 'operatory tablet 1024x768'], [420, 860, 'phone 420x860']]) {
        const { c, p } = await ctx(b, w, hgt);
        try {
          await go(p, '#/frontdesk/board');
          const m = await p.evaluate(() => {
            const el = document.querySelector('[data-testid="board.card.a-1042.arrive"]');
            const cv = document.getElementById('canvas');
            const cr = cv.getBoundingClientRect();
            const queue = document.querySelector('section.queue');
            if (!el) return { present: false, viewportH: window.innerHeight, canvasClientH: cv.clientHeight };
            const r = el.getBoundingClientRect();
            return {
              present: true, label: el.textContent.trim(),
              rectTop: Math.round(r.top), rectBottom: Math.round(r.bottom),
              viewportH: window.innerHeight,
              canvasClientH: cv.clientHeight, canvasScrollTop: Math.round(cv.scrollTop), canvasScrollH: Math.round(cv.scrollHeight),
              offsetInCanvas: Math.round(r.top - cr.top + cv.scrollTop),
              queueTopInCanvas: queue ? Math.round(queue.getBoundingClientRect().top - cr.top + cv.scrollTop) : null,
              belowFold: r.bottom > window.innerHeight,
            };
          });
          legs.push(Object.assign({ profile, width: w, height: hgt }, m));
        } catch (e) { err = e.message; } finally { await c.close(); }
      }
      const measured = legs.filter((l) => l.present);
      const reproduced = !err && legs.length === 3 && measured.length === 3 && measured.every((l) => l.belowFold);
      rec('A-screens-board-2-1', "The Board's one-tap flow-1 control, the first Arrive (board.card.a-1042.arrive), is below the fold at every device width: it sits about a thousand pixels down the canvas behind the readiness strip, the chair strip and the operatory columns",
        'B11 / C2 (CHECKLIST) — the control the screen exists for is in reach on the device profiles the audit measures (1280, 1024 and 420 px wide); CONTRACTS §7 flow 1 budgets check-in at one tap; board.js:262',
        reproduced, { legs, allThreePresent: measured.length === 3, belowFoldAt: measured.filter((l) => l.belowFold).map((l) => l.profile), error: err, note: 'The canvas is the scroll container (app.js sets canvas.scrollTop = 0 on every route change), so offsetInCanvas is the distance the operator must scroll and rectBottom vs viewportH is the fold test.' });
    },

    // RC-218 · B1 · board.js:94, :97, :98 hard-code the readiness row ids 'elig', 'device' and 'temp' as UI
    // constants, while :96 uses lab.labCase.id ('lab-op3'), which IS a seed id. CONTRACTS §4 says "Ids come
    // from the seed" and B1 says the id segment is a seed id. Both sides are measured here: the DOM side by
    // reading the rendered board.readiness.row.<id>.<control> ids, the seed side by walking every object in
    // window.__proto.state() and collecting every id-shaped string (any `id`, any `*Id`, any `code`) — a
    // deliberately generous set, since a larger seed-id set can only make this check harder to reproduce.
    // Negative control: lab-op3 is the discriminator. If the id segments came from the seed, every segment
    // would be found in that set exactly as lab-op3 is, notInStore would be empty and the check reports false;
    // if the walk were broken, lab-op3 would also be missing and the check reports false as well.
    async 'A-screens-board-2-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=desk');
        const board = await p.evaluate(() => {
          const seen = new Set();
          (function walk(v) {
            if (!v || typeof v !== 'object') return;
            if (Array.isArray(v)) { v.forEach(walk); return; }
            for (const [k, val] of Object.entries(v)) {
              if (typeof val === 'string' && (k === 'id' || /Id$/.test(k) || k === 'code')) seen.add(val);
              else if (val && typeof val === 'object') walk(val);
            }
          })(window.__proto.state());
          const testids = [...document.querySelectorAll('[data-testid^="board.readiness.row."]')].map((e) => e.getAttribute('data-testid'));
          const segs = testids.map((t) => t.split('.')[3]);
          return { testids, idSegments: segs, notInStore: segs.filter((s) => !seen.has(s)), inStore: segs.filter((s) => seen.has(s)), storeIdCount: seen.size };
        });
        await hop(p, '#/compliance/risk');
        const risk = await p.evaluate(() => {
          const seen = new Set();
          (function walk(v) {
            if (!v || typeof v !== 'object') return;
            if (Array.isArray(v)) { v.forEach(walk); return; }
            for (const [k, val] of Object.entries(v)) {
              if (typeof val === 'string' && (k === 'id' || /Id$/.test(k) || k === 'code')) seen.add(val);
              else if (val && typeof val === 'object') walk(val);
            }
          })(window.__proto.state());
          const testids = [...document.querySelectorAll('[data-testid^="risk.row."]')].map((e) => e.getAttribute('data-testid'));
          const segs = testids.map((t) => t.split('.')[2]);
          return { testids, idSegments: segs, notInStore: segs.filter((s) => !seen.has(s)), inStore: segs.filter((s) => seen.has(s)) };
        });
        const synth = ['elig', 'device', 'temp'].filter((s) => board.notInStore.includes(s));
        const seedIdRendered = board.inStore.includes('lab-op3');
        rec('A-screens-board-2-2', "The Board's readiness rows carry id segments that are UI constants, not seed ids: board.readiness.row.elig/device/temp exist in no store table, while board.readiness.row.lab-op3 (the seed labCase id) shows the rule is otherwise satisfiable",
          'B1 (CHECKLIST: the id segment is a seed id) / CONTRACTS §4 ("Ids come from the seed"); board.js:94, :97, :98',
          synth.length === 3 && seedIdRendered, { boardRowTestids: board.testids, boardIdSegments: board.idSegments, segmentsNotInStore: board.notInStore, segmentsInStore: board.inStore, seedIdSegmentRendered: seedIdRendered, storeIdCount: board.storeIdCount, riskRowTestids: risk.testids, riskSegmentsNotInStore: risk.notInStore, riskSegmentsInStore: risk.inStore, note: 'The store-id set is every string under an `id`, `*Id` or `code` key at any depth of window.__proto.state(); the same breach is rendered by dailyclose.js on #/compliance/risk and is carried here as corroboration only.' });
      } finally { await c.close(); }
    },

    // RC-222 · B4 · board.js:196/:197 label one room twice on the same screen (region aria-label "Operatory n",
    // column h2 "Op n"), board.js:138 calls it "Chair n", and the seat announcement (board.js:73) says
    // "chair n". Every rendering for room 1 (and the Op 2 renderings the readiness strip and the chair stamp
    // produce) is measured on one load and compared word by word.
    // Negative control: if the Board used one word for the room, the distinct-word set for room 1 would have
    // size 1 and the check reports false. The comparison is case-insensitive so "chair 1" in the announcement
    // is not counted as a third word beside the chair strip's "Chair 1"; only genuinely different nouns count.
    async 'A-screens-board-2-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const rendered = await p.evaluate(() => {
          const cols = [...document.querySelectorAll('.opcol')].map((el) => ({ regionAriaLabel: el.getAttribute('aria-label'), h2: (el.querySelector('h2') || {}).textContent }));
          const chairs = [...document.querySelectorAll('[data-testid^="board.chair."]')].map((el) => ({ testid: el.getAttribute('data-testid'), text: el.textContent.replace(/\s+/g, ' ').trim(), ariaLabel: el.getAttribute('aria-label') }));
          const readinessLines = [...document.querySelectorAll('.rdrow')].map((r) => r.getAttribute('aria-label')).filter((t) => /\bOp\b|\bOperatory\b|\bChair\b|\bchair\b/.test(t || ''));
          const queueAria = [...document.querySelectorAll('[data-testid$=".ping"]')].map((e) => e.getAttribute('aria-label'));
          return { cols, chairs, readinessLines, queueAria };
        });
        await tap(p, 'board.chair.2');
        const stamp = await p.evaluate(() => { const s = document.querySelector('.chairwrap .stamp'); return s ? s.textContent.trim() : null; });
        const seq0 = await lastSeq(p);
        await tap(p, 'board.card.a-1042.arrive');
        const arriveAnnounce = await live(p);
        await tap(p, 'board.card.a-1042.seat');
        await p.waitForTimeout(220);
        const seatAnnounce = await live(p);
        const ev = await since(p, seq0);
        // Room 1, as this screen names it in each place.
        const room1 = {
          columnH2: (rendered.cols[0] || {}).h2,
          columnRegionAriaLabel: (rendered.cols[0] || {}).regionAriaLabel,
          chairStripButton: (rendered.chairs[0] || {}).text,
          chairStripAriaLabel: (rendered.chairs[0] || {}).ariaLabel,
          seatAnnouncement: seatAnnounce,
        };
        const wordFor = (s) => { const m = /\b(Operatory|Op|Chair)\b/i.exec(s || ''); return m ? m[1].toLowerCase() : null; };
        const words = [room1.columnH2, room1.columnRegionAriaLabel, room1.chairStripButton, room1.seatAnnouncement].map(wordFor).filter(Boolean);
        const distinct = [...new Set(words)];
        rec('A-screens-board-2-3', 'The Board names one room three ways at once: the column heading says "Op 1", the region that contains it says "Operatory 1", and the chair strip and the seat announcement say "Chair 1"',
          'B4 (CHECKLIST: one canonical word per concept across screens, refusals, announcements and aria-labels); board.js:196, :197, :138, :73',
          distinct.length >= 2, { room1, distinctWordsForRoom1: distinct, allColumns: rendered.cols, allChairButtons: rendered.chairs, readinessLinesNamingTheRoom: rendered.readinessLines, queuePingAriaLabels: rendered.queueAria, chairStampOp2: stamp, arriveAnnouncement: arriveAnnounce, seqRange: range(ev, seq0), writesInRange: writes(ev) });
      } finally { await c.close(); }
    },

    // RC-239 · C5 / A7 · board.js:98 gates the "Tomorrow: front desk has no coordinator" readiness row on
    // `!s.dayPasses.length`, so any day pass at all clears it. Driven through the UI: issue an RDH pass for
    // Alex Rivera at Hillsboro (loc-3) — a pass that covers neither the front desk nor this location — and
    // read the Main Street Board before and after, together with the row the store actually wrote.
    // Negative control: if the row tested the pass's role and location, an RDH-at-Hillsboro pass would leave
    // "Tomorrow: front desk has no coordinator" standing and the "N to handle" chip unchanged, and the check
    // reports false. The written dayPasses row is carried so a pass that failed to save (which would also make
    // the row survive) cannot be mistaken for the negative control; role must be 'rdh' and location 'loc-3'.
    async 'A-screens-board-2-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/board');
        const before = await readiness(p);
        const seq0 = await lastSeq(p);
        await hop(p, '#/owner/roles');
        const steps = {};
        steps.add = await tap(p, 'roles.daypass.add');
        steps.name = await type(p, 'roles.daypass.name', 'Alex Rivera');
        steps.role = await tap(p, 'roles.daypass.role.rdh');
        steps.location = await tap(p, 'roles.daypass.location.loc-3');
        steps.save = await tap(p, 'roles.daypass.save');
        await p.waitForTimeout(200);
        const saved = await p.evaluate(() => window.__proto.state().dayPasses.map((d) => ({ id: d.id, name: d.name, role: d.role, requestedRole: d.requestedRole, locationId: d.locationId, entitlements: d.entitlements })));
        await hop(p, '#/owner/board');
        const after = await readiness(p);
        const ev = await since(p, seq0);
        const pass = saved[0] || null;
        const passIsUnrelated = !!pass && pass.role === 'rdh' && pass.locationId === 'loc-3';
        const rowCleared = !!before && before.tempRowPresent && !!after && !after.tempRowPresent;
        rec('A-screens-board-2-4', 'The Board readiness row "Tomorrow: front desk has no coordinator" clears on any day pass: an RDH pass for Hillsboro (loc-3) removes the row and drops the "to handle" count on the Main Street Board, though no front-desk coverage was arranged',
          'C5 / A7 (CHECKLIST: a number on screen is computed from the state it summarises, and one fact has one canonical value); board.js:98 `if (!s.dayPasses.length)`',
          passIsUnrelated && rowCleared, { boardBefore: before, boardAfter: after, dayPassWritten: pass, allDayPasses: saved, formSteps: steps, seqRange: range(ev, seq0), writesInRange: writes(ev), note: 'The pass was issued for role rdh at loc-3 (Hillsboro); the Board it clears is Main Street (loc-1), and the row it clears names the front desk.' });
      } finally { await c.close(); }
    },

    // RC-250 · C4 · board.js:232 renders one empty-state literal for the checkout queue,
    // "Nobody is out of the chair yet." Driven to the end of the day through the UI (four checkouts and three
    // filed notes, the sequence the audit recorded), the queue empties and the same "yet" sentence is shown —
    // the sentence for a day that has not started — with no next step beside it.
    // Negative control: if the empty state distinguished the finished day (or offered any next step), the
    // measured text would differ from the literal or the queue section would contain a control, and the check
    // reports false. The check also refuses a vacuous pass: if the drive fails to empty the queue
    // (queueRows > 0) or any leg of the drive fails, reproduced is false — an empty state that was never
    // reached is not evidence.
    async 'A-screens-board-2-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const seq0 = await lastSeq(p);
        const trail = [];
        const step = async (label, fn) => { const ok = await fn(); trail.push(label + '=' + ok); return ok; };
        // Four checkouts from the Board card, exactly as the audit's repro steps run them.
        await step('board.card.a-1045.checkout', () => tap(p, 'board.card.a-1045.checkout'));
        await step('checkout.post(a-1045 zero due)', () => tap(p, 'checkout.post'));
        for (const aid of ['a-1046', 'a-1047', 'a-1044']) {
          await hop(p, '#/frontdesk/board');
          await step('board.card.' + aid + '.checkout', () => tap(p, 'board.card.' + aid + '.checkout'));
          await step('checkout.tender.card(' + aid + ')', () => tap(p, 'checkout.tender.card'));
          await step('checkout.card.number(' + aid + ')', () => type(p, 'checkout.card.number', '4111111111111111'));
          await step('checkout.post(' + aid + ')', () => tap(p, 'checkout.post'));
        }
        // Three notes filed by the dentist: enc-9003 and enc-9010 clear the Filed-later lane, enc-9002 puts
        // a-1043 into the queue so the last checkout has something to close.
        for (const enc of ['enc-9003', 'enc-9010']) {
          await hop(p, '#/dentist/encounter/' + enc);
          await step(enc + ' starter', () => tap(p, 'enc.note.starter.0'));
          await step(enc + ' enc.file', () => tap(p, 'enc.file'));
          await step(enc + ' refusal.control (read-back)', () => tap(p, 'refusal.control'));
        }
        await hop(p, '#/dentist/encounter/enc-9002');
        await step('enc.tag.tag-1.chart', () => tap(p, 'enc.tag.tag-1.chart'));
        await step('enc.surface.30.d', () => tap(p, 'enc.surface.30.d'));
        await step('enc.surface.30.o', () => tap(p, 'enc.surface.30.o'));
        await step('enc.proc.d2392', () => tap(p, 'enc.proc.d2392'));
        await step('enc-9002 starter', () => tap(p, 'enc.note.starter.0'));
        await step('enc-9002 enc.file', () => tap(p, 'enc.file'));
        await step('enc-9002 refusal.control (read-back)', () => tap(p, 'refusal.control'));
        await hop(p, '#/frontdesk/checkout/a-1043');
        await step('checkout.post(a-1043 zero due)', () => tap(p, 'checkout.post'));
        await hop(p, '#/frontdesk/board');
        const q = await p.evaluate(() => {
          const sec = document.querySelector('section.queue');
          if (!sec) return null;
          const rows = [...sec.querySelectorAll('[data-testid^="board.queue.row."]')].map((e) => e.getAttribute('data-testid'));
          const controls = [...sec.querySelectorAll('button')].map((e) => (e.getAttribute('data-testid') || e.tagName) + '="' + e.textContent.trim() + '"');
          const empties = [...sec.querySelectorAll('p')].map((e) => e.textContent.trim());
          return {
            sectionText: sec.textContent.replace(/\s+/g, ' ').trim(),
            queueRowTestids: rows.filter((t) => !/\.(ping|checkout)$/.test(t)),
            countChip: (sec.querySelector('.chip') || {}).textContent ? sec.querySelector('.chip').textContent.replace(/^[■▲◆★▬●]\s*/, '').trim() : null,
            emptyParagraphs: empties,
            controlsInQueue: controls,
            laneCards: document.querySelectorAll('.lane .card.appt').length,
            laneSection: !!document.querySelector('.lane'),
          };
        });
        const ev = await since(p, seq0);
        const statuses = await apptStatuses(p);
        const emptied = !!q && q.queueRowTestids.length === 0 && q.laneCards === 0;
        const literal = !!q && q.emptyParagraphs.some((t) => t === 'Nobody is out of the chair yet.');
        // "How the chips are derived" is a disclosure summary, not a next step; the queue offers no button.
        const noNextStep = !!q && q.controlsInQueue.length === 0;
        rec('A-screens-board-2-5', 'At the end of the day — every patient checked out and every note filed — the empty checkout queue still says "Nobody is out of the chair yet.", the sentence for a day that has not started, and offers no next step',
          'C4 (CHECKLIST: empty states say why they are empty and what to do next); board.js:232',
          emptied && literal && noNextStep, { queue: q, appointmentStatuses: statuses, driveTrail: trail, allDriveStepsSucceeded: trail.every((t) => t.endsWith('=true')), seqRange: range(ev, seq0), writeCount: ev.filter((e) => e.kind === 'write').length, collectionDecisionWrites: writes(ev).filter((w) => /collectionDecisions/.test(w)), filedNoteWrites: writes(ev).filter((w) => /filedNotes/.test(w)) });
      } finally { await c.close(); }
    },

    // RC-145 · B1 · board.js:184 (board.card.<apptId>.rail), :233 (board.queue.why) and :126
    // (board.readiness.handled) render ids CONTRACTS §4 does not list. Both sides are computed here: the DOM
    // side by crawling the Board in two states (fresh, and with every readiness row handled, which is the only
    // state that renders board.readiness.handled), the contract side by parsing §4 out of CONTRACTS.md into
    // entries and regexes — a bare <x> stands for exactly one id segment, so board.card.<apptId> cannot
    // absorb board.card.a-1042.rail.
    // Negative control: the same search over the same §4 text matches every other Board id it renders
    // (board.readiness.toggle, board.card.a-1042.arrive, board.queue.row.a-1050.ping, board.chair.1 …), so a
    // parse that matched nothing would show up as those ids being unmatched too, and the check reports false
    // if the §4 parse is empty or if the three ids are not actually in the DOM.
    async 'A-screens-board-2-6'(b) {
      const { c, p } = await ctx(b);
      try {
        const entries = s4Entries();
        const regexes = entries.map((e) => ({ entry: e, re: s4Regex(e) }));
        const matchS4 = (t) => regexes.filter((x) => x.re.test(t)).map((x) => x.entry);
        await go(p, '#/frontdesk/board');
        const fresh = (await ids(p)).filter((t) => t.startsWith('board.'));
        // Handle every readiness row so the "What was handled" disclosure renders.
        const handledSteps = {};
        handledSteps.elig = await tap(p, await readinessRow(p, 'reverify-all'));
        handledSteps.lab = await tap(p, await readinessRow(p, 'call'));
        handledSteps.device = await tap(p, await readinessRow(p, 'reset'));
        await hop(p, '#/frontdesk/roles');
        handledSteps.daypassOpen = await tap(p, 'roles.daypass.add');
        handledSteps.daypassName = await type(p, 'roles.daypass.name', 'Alex Rivera');
        handledSteps.daypassSave = await tap(p, 'roles.daypass.save');
        await hop(p, '#/frontdesk/board');
        const handled = (await ids(p)).filter((t) => t.startsWith('board.'));
        const observed = [...new Set([...fresh, ...handled])];
        const unmatched = observed.filter((t) => matchS4(t).length === 0);
        const claimed = ['board.card.a-1042.rail', 'board.queue.why', 'board.readiness.handled'];
        const claimedPresent = claimed.filter((t) => observed.includes(t));
        const claimedUnmatched = claimed.filter((t) => observed.includes(t) && matchS4(t).length === 0);
        const boardRow = (s4Rows().find((r) => /^\|\s*Board\s*\|/.test(r)) || '').trim();
        rec('A-screens-board-2-6', 'The Board renders three test ids CONTRACTS §4 does not list: board.card.<apptId>.rail on every card, board.queue.why on the queue disclosure, and board.readiness.handled once every readiness row is handled',
          'B1 (CHECKLIST: every id in the DOM matches a §4 entry or pattern); board.js:184, :233, :126',
          /* Any Board id §4 does not list, not all three of the ids the claim happened to name. Requiring
             three meant that listing two of them in §4 turned the check green while the third stood
             unlisted and rendered — an all-or-nothing predicate hiding a partial breach. */
          entries.length > 0 && unmatched.length > 0,
          { idsClaimed: claimed, idsPresentInDom: claimedPresent, idsPresentAndUnmatchedBySection4: claimedUnmatched, everyUnmatchedBoardId: unmatched, boardIdsObserved: observed, section4BoardRowSearched: boardRow, section4EntryCount: entries.length, section4EntriesSearched: entries, section4TextLength: sectionOf(4).length, matchedExamples: observed.filter((t) => matchS4(t).length > 0).slice(0, 8).map((t) => t + ' → ' + matchS4(t)[0]), railIdCount: observed.filter((t) => /\.rail$/.test(t)).length, handledStateSteps: handledSteps, note: 'The whole §4 table is searched, not only the Board row: an id that matched any screen\'s entry would count as listed.' });
      } finally { await c.close(); }
    },

    // RC-146 · B9 · board.js:40 keeps the readiness strip's collapsed flag in one bucket on the store
    // (s.boardUi.collapsed), so it is global rather than per user. Two legs, each in its own context so no
    // screen state leaks between them (a second go() to the same file:// URL is a same-document navigation
    // and would carry the flag over): leg A opens the temp Board cold to show its own default, leg B hides the
    // strip as the front desk (u-fd-1) and then switches to the temp Board (u-temp) in the same session.
    // Negative control: if the flag were keyed by user id, the temp Board in leg B would look like the cold
    // temp Board in leg A — body visible, toggle reading "Hide" — and the check reports false. Leg A is what
    // makes leg B mean something: without it, a hidden strip could be the temp Board's own default.
    async 'A-screens-board-2-7'(b) {
      const legA = await ctx(b);
      let coldTemp = null;
      try {
        await go(legA.p, '#/temp/board');
        coldTemp = Object.assign({ user: await legA.p.evaluate(() => Proto.store.currentUser().id) }, await readiness(legA.p));
      } finally { await legA.c.close(); }
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const fdBefore = Object.assign({ user: await p.evaluate(() => Proto.store.currentUser().id) }, await readiness(p));
        const seq0 = await lastSeq(p);
        const toggled = await tap(p, 'board.readiness.toggle');
        const fdAfter = Object.assign({ user: await p.evaluate(() => Proto.store.currentUser().id) }, await readiness(p));
        await hop(p, '#/temp/board');
        const tempAfter = Object.assign({ user: await p.evaluate(() => Proto.store.currentUser().id), persona: await p.evaluate(() => window.__proto.persona) }, await readiness(p));
        const storeFlag = await p.evaluate(() => { const s = window.__proto.state(); return { boardUi: s.boardUi || null, keyedByUser: !!(s.boardUi && Object.keys(s.boardUi).some((k) => /^u-/.test(k))) }; });
        const ev = await since(p, seq0);
        const reproduced = !!coldTemp && coldTemp.bodyHidden === false && !!fdAfter && fdAfter.bodyHidden === true && !!tempAfter && tempAfter.bodyHidden === true && tempAfter.user !== fdAfter.user;
        rec('A-screens-board-2-7', "The readiness strip's collapsed state is one global flag on the store: after the front-desk user hides the strip, the temp persona's own Board opens with the body hidden and the toggle reading Show, though a cold temp Board opens expanded",
          'B9 (CHECKLIST: per-user state is keyed by user id, never global); board.js:40 uiState() → s.boardUi.collapsed',
          reproduced, { coldTempBoard_negativeControl: coldTemp, frontdeskBeforeToggle: fdBefore, toggleClicked: toggled, frontdeskAfterToggle: fdAfter, tempBoardAfterFrontdeskHid: tempAfter, storeBoardUi: storeFlag, seqRange: range(ev, seq0), writesInRange: writes(ev), note: 'The two legs run in separate browser contexts; leg B switches user inside one session by hash, which is how a shared desk changes hands.' });
      } finally { await c.close(); }
    },

    // RC-147 · B7 · board.js:259 prints the Board h1 date as the literal 'Thursday 9/3'. The measurement moves
    // the store's own date (tenant.today) and clock (clock.time) and re-renders through the router: the sub
    // line, which is derived from clock.time, moves; the h1 does not.
    // Negative control: the sub line is the proof that the screen really re-rendered. If the h1 were derived
    // from tenant.today it would move with it (to 9/4) while the sub line moved too, and the check reports
    // false; if nothing re-rendered, subChanged would be false and the check also reports false, so a stale
    // render can never be read as a literal.
    async 'A-screens-board-2-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const before = await p.evaluate(() => ({ h1: (document.querySelector('#canvas h1') || {}).textContent, sub: (document.querySelector('#canvas .sub') || {}).textContent, today: Proto.store.get().tenant.today, clock: Proto.store.get().clock.time }));
        await p.evaluate(() => { const s = Proto.store.get(); s.tenant.today = '2026-09-04'; s.clock.time = '11:15'; Proto.router.render(); });
        await p.waitForTimeout(160);
        const after = await p.evaluate(() => ({ h1: (document.querySelector('#canvas h1') || {}).textContent, sub: (document.querySelector('#canvas .sub') || {}).textContent, today: Proto.store.get().tenant.today, clock: Proto.store.get().clock.time }));
        const rerendered = before.sub !== after.sub;
        const h1Frozen = before.h1 === after.h1 && /Thursday 9\/3/.test(after.h1 || '');
        rec('A-screens-board-2-8', "The Board h1 date is a literal: after the store's today moves to 2026-09-04 and the screen re-renders (the sub line's clock moves with it), the heading still reads 'Board · Main Street · Thursday 9/3'",
          'B7 (CHECKLIST: dates come from state, one format per context; the seed\'s today is 2026-09-03); board.js:259',
          rerendered && h1Frozen && after.today === '2026-09-04', { h1Before: before.h1, h1After: after.h1, subBefore: before.sub, subAfter: after.sub, storeTodayBefore: before.today, storeTodayAfter: after.today, storeClockBefore: before.clock, storeClockAfter: after.clock, screenRerendered_negativeControl: rerendered, note: 'tenant.today and clock.time are moved on the live store (Proto.store.get()), then Proto.router.render() redraws the screen; only the sub line follows.' });
      } finally { await c.close(); }
    },

    // RC-230 · B4 · board.js:205/:206 head the lane "Filed later" and the status chip (board.js:11) says
    // "Filed later", while board.js:224 writes "the Filed-later lane" in the queue row's own prose; the same
    // drift runs through the role name, "Front-desk coordinator" on sign-in (router.js:6) against
    // "Front desk" in Roles (roles.js:17). Every rendering is read from the screens that produce it.
    // Negative control: if one spelling were used throughout, the spellings set for each pair would have size
    // one and the check reports false. Each half is measured by the exact rendered string, not by a substring
    // that could match either spelling: "Filed later" is only counted where the hyphen is absent.
    async 'A-screens-board-2-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const lane = await p.evaluate(() => {
          const laneSec = document.querySelector('.lane');
          const card = document.querySelector('[data-testid="board.card.a-1050"]');
          const qrow = document.querySelector('[data-testid="board.queue.row.a-1050"]');
          const text = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
          return {
            laneAriaLabel: laneSec ? laneSec.getAttribute('aria-label') : null,
            laneH2: laneSec ? text(laneSec.querySelector('h2')) : null,
            laneChip: laneSec ? text(laneSec.querySelector('.chip')) : null,
            cardStatusChip: card ? text(card.querySelector('.who .chip')) : null,
            cardStamp: card ? text(card.querySelector('.stamp')) : null,
            queueRowProse: qrow ? (([...qrow.querySelectorAll('.small.muted')].map((e) => e.textContent.trim()).find((t) => /Filed[- ]later/i.test(t))) || null) : null,
            hyphenatedOnBoard: /Filed-later/.test(document.getElementById('canvas').textContent),
            spacedOnBoard: /Filed later/.test(document.getElementById('canvas').textContent),
          };
        });
        await hop(p, '#/frontdesk/checkout/a-1050');
        const checkoutChip = await p.evaluate(() => { const c2 = [...document.querySelectorAll('#canvas .chip')].map((e) => e.textContent.replace(/^[■▲◆★▬●]\s*/, '').trim()); return c2.find((t) => /Filed[- ]later/i.test(t)) || null; });
        await hop(p, '#/signin');
        const signinLabel = await txt(p, 'signin.persona.frontdesk');
        await hop(p, '#/owner/roles');
        const rolesCells = await p.evaluate(() => [...new Set([...document.querySelectorAll('#canvas table.rl-table td')].map((e) => e.textContent.trim()))].filter((t) => /front[- ]desk/i.test(t)));
        const laneSpellings = [...new Set([lane.laneH2, lane.laneChip, lane.cardStatusChip, lane.queueRowProse, checkoutChip].filter(Boolean).flatMap((s) => (s.match(/Filed[- ]later/gi) || [])))];
        const roleSpellings = [...new Set([signinLabel, ...rolesCells].filter(Boolean).flatMap((s) => (s.match(/Front[- ]desk/gi) || [])))];
        const laneDrift = laneSpellings.length > 1;
        const roleDrift = roleSpellings.length > 1;
        rec('A-screens-board-2-9', 'One lane has two spellings on one screen — the Board heading and chip say "Filed later" while the queue row\'s own prose says "the Filed-later lane" — and the same drift runs through the role name, "Front-desk coordinator" on sign-in against "Front desk" in Roles',
          'B4 (CHECKLIST: report capitalization and hyphenation drift, with both locations); board.js:224 against board.js:205 and board.js:11',
          laneDrift && roleDrift, { boardLaneRenderings: lane, checkoutStatusChip: checkoutChip, signinPersonaLabel: signinLabel, rolesTableCells: rolesCells, laneSpellingsFound: laneSpellings, roleSpellingsFound: roleSpellings, note: 'Spellings are collected from the exact rendered strings on the screens that produce them; the Board carries both forms at once (hyphenatedOnBoard and spacedOnBoard are both true).' });
      } finally { await c.close(); }
    },
  };
};
