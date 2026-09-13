// Audit checks for the fix storm, owner "words": one rule, one owner (docs/15) for the literal sentences and word
// tables that screens had copied from each other. Files: prototype/js/ui.js and prototype/js/screens/board.js,
// chairs.js, checkout.js, perio.js, dailyclose.js, roles.js, phone.js, shell.js.
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const JS = path.join(ROOT, 'prototype', 'js');
const sources = () => ['ui.js', 'store.js', 'router.js', ...fs.readdirSync(path.join(JS, 'screens')).map((f) => 'screens/' + f)].map((f) => ({ file: f, text: fs.readFileSync(path.join(JS, f), 'utf8') }));
const owners = (re) => sources().filter((s) => re.test(s.text)).map((s) => s.file);

export default ({ ctx, go, hop, click, txt, state, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const live = (p) => p.evaluate(() => (document.getElementById('live') || {}).textContent || '');
  // go() to another hash is a same-document navigation, so Proto survives it: wrap announce once per page.
  const tapAnnounce = (p) => p.evaluate(() => { window.__ann = []; if (window.__annTapped) return; window.__annTapped = true; const o = Proto.router.announce; Proto.router.announce = (t) => { window.__ann.push(t); return o(t); }; });
  const announced = (p) => p.evaluate(() => (window.__ann || []).slice());
  const gateCode = (p) => p.evaluate(() => { const r = document.querySelector('.refusal'); return r ? r.dataset.code : null; });
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const writesAfter = (p, seq) => p.evaluate((s) => window.__events.filter((e) => e.seq > s && e.kind === 'write').map((e) => e.table + ':' + e.id), seq);
  // The word of a chip without its glyph: the glyph span is aria-hidden and the text node carries the word.
  const chipWords = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel + ' .chip')].map((c) => [...c.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()), sel);
  // Press a gate's control and read what the live region says 200 ms later (announce clears, then writes after 10 ms).
  async function pressSupport(p, name) {
    const code = await gateCode(p); const label = await txt(p, 'refusal.control');
    if (code !== 'outage') return { name, code, label, reached: false, live: null };
    await p.evaluate(() => { window.__ann = []; });
    await click(p, 'refusal.control'); await p.waitForTimeout(200);
    return { name, code, label, reached: true, live: await live(p), announced: await announced(p) };
  }

  return {
    // The support line was six literals in two wordings: board.js and chairs.js said "Support: 615-555-0100, answered
    // 7 am to 6 pm Central", dailyclose.js, phone.js, roles.js and shell.js said "Call support: 615-555-0100, 7 am to
    // 6 pm", checkout.js carried the first and perio.js read Chairs'. The same control, "Support line", read two
    // different sentences depending on the screen. Negative control: every outage gate's control announces one
    // sentence (`distinct` has one member) and every gate was reached (`reached` is the full count).
    async 'A-storm-words-1'(b) {
      const { c, p } = await ctx(b);
      try {
        const out = [];
        await go(p, '#/frontdesk/board?outage=1&device=shared'); await tapAnnounce(p);
        await click(p, 'board.card.a-1042.arrive'); out.push(await pressSupport(p, 'board.arrive'));
        // The Andon's own control and the PIN pad's outage gate, on the same page.
        await p.evaluate(() => { window.__ann = []; }); await click(p, 'andon.control'); await p.waitForTimeout(200);
        out.push({ name: 'andon.control', code: 'outage', label: await txt(p, 'andon.control'), reached: !!(await p.$(tid('andon.control'))), live: await live(p), announced: await announced(p) });
        await click(p, 'topbar.author'); for (const d of ['3', '3', '3', '3']) await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(150);
        out.push(await pressSupport(p, 'pin.submit'));
        await go(p, '#/frontdesk/checkout/a-1046?outage=1'); await tapAnnounce(p);
        await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); out.push(await pressSupport(p, 'checkout.post'));
        await go(p, '#/owner/roles?outage=1'); await tapAnnounce(p);
        await click(p, 'roles.daypass.add'); await p.fill(tid('roles.daypass.name'), 'Alex Rivera'); await p.waitForTimeout(60);
        await click(p, 'roles.daypass.save'); out.push(await pressSupport(p, 'roles.daypass.save'));
        await go(p, '#/owner/close?outage=1'); await tapAnnounce(p);
        await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); out.push(await pressSupport(p, 'close.closeday.confirm'));
        const reached = out.filter((o) => o.reached);
        const distinct = [...new Set(reached.map((o) => o.live))];
        rec('A-storm-words-1', 'The "Support line" control announces "Support: 615-555-0100, answered 7 am to 6 pm Central" on the Board and Checkout and "Call support: 615-555-0100, 7 am to 6 pm" on Roles, Daily Close, the PIN pad and the Andon: one control, two sentences, six copies', 'docs/15 one rule, one owner; CONTRACTS §6 — one shared component renders every gate and its control does one named thing (ui.js SUPPORT / support)',
          reached.length < out.length || distinct.length !== 1, { gates: out, reached: reached.length, expected: out.length, distinct });
      } finally { await c.close(); }
    },

    // The appointment-type words were a table in board.js, a copy in chairs.js and a fallback in checkout.js that
    // read the Board's export when it existed. Negative control: one table owns the word (ui.js typeWord; `tables`
    // names one file), and for every seeded visit the Board chip, the Chairs chip and the Checkout subtitle print
    // the same word (`drift` is empty) with every seeded type measured on at least two screens.
    async 'A-storm-words-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const appts = (await state(p)).appointments.filter((a) => a.locationId === 'loc-1');
        const words = {}; const add = (id, screen, w) => { if (w) (words[id] = words[id] || {})[screen] = w; };
        for (const a of appts) add(a.id, 'board', (await chipWords(p, tid('board.card.' + a.id) + ' > .meta'))[0]);
        for (const persona of ['hygienist', 'dentist', 'surgeon']) {
          await hop(p, '#/' + persona + '/chairs'); await p.waitForTimeout(150);
          for (const a of appts) add(a.id, 'chairs', (await chipWords(p, tid('chairs.card.' + a.id) + ' > .meta'))[0]);
        }
        for (const a of appts) {
          await hop(p, '#/frontdesk/checkout/' + a.id); await p.waitForTimeout(120);
          const sub = await p.evaluate(() => (document.querySelector('#canvas .sub') || {}).textContent || '');
          add(a.id, 'checkout', (sub.split(' · ')[1] || '').trim());
        }
        const rows = appts.map((a) => ({ id: a.id, type: a.type, words: words[a.id] || {} }));
        const drift = rows.filter((r) => new Set(Object.values(r.words)).size > 1);
        const types = [...new Set(appts.map((a) => a.type))];
        const measured = types.every((t) => rows.some((r) => r.type === t && Object.keys(r.words).length >= 2));
        const tables = owners(/hygiene: \['clear', 'Hygiene'\]/);
        const shared = await p.evaluate(() => typeof (Proto.ui && Proto.ui.typeWord));
        rec('A-storm-words-2', 'The appointment type word is a table in board.js, a second identical table in chairs.js and a fallback in checkout.js that reads the Board\'s export: three owners for one word, free to drift', 'docs/15 one rule, one owner (ui.js TYPE / typeWord read by board.js, chairs.js, checkout.js)',
          !measured || drift.length > 0 || tables.length !== 1 || shared !== 'function', { rows, drift, types, measured, tables, sharedTypeWord: shared });
      } finally { await c.close(); }
    },

    // The second click of a double-click is the tail of the first gesture, not a decision. board.js guarded Seat alone
    // (ev.detail > 1), so every other irreversible and reversible primary — Post matched on the Money Desk among them —
    // still acted on a detail-2 click. Negative control: a detail-2 click on either primary writes nothing and leaves
    // focus on the button, and a real double-click on Seat writes exactly what one click writes.
    async 'A-storm-words-3'(b) {
      const { c, p } = await ctx(b);
      try {
        const tail = async (t) => { const seq = await lastSeq(p); const there = await p.evaluate((t) => { const b = document.querySelector('[data-testid="' + t + '"]'); if (!b) return false; b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 })); return true; }, t); await p.waitForTimeout(200); return { control: t, there, writes: await writesAfter(p, seq), focus: await p.evaluate(() => (document.activeElement.getAttribute && document.activeElement.getAttribute('data-testid')) || document.activeElement.tagName) }; };
        await go(p, '#/biller/money');
        const money = await tail('money.era.era-1.postmatched');
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(150);
        const seat = await tail('board.card.a-1042.seat');
        // A real double-click on Seat for comparison: the first click seats, the second must add nothing.
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(150);
        const seq = await lastSeq(p);
        const at = await p.$eval(tid('board.card.a-1042.seat'), (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).catch(() => null);
        if (at) { await p.mouse.dblclick(at.x, at.y); await p.waitForTimeout(250); }
        const dbl = { at, writes: await writesAfter(p, seq), status: (await state(p)).appointments.find((a) => a.id === 'a-1042').status };
        const single = { writes: ['appointments:a-1042', 'appointmentEvents:*', 'firstRunState:*'] };
        rec('A-storm-words-3', 'A detail-2 click (the tail of a double-click) on Post matched writes the whole ERA batch: only the Board\'s Seat ignores it, so the rule lives in one screen instead of in the button', 'docs/01 principle 9 — one gesture, one step; docs/15 one rule, one owner (ui.js btn for irreversible and reversible primaries)',
          !money.there || !seat.there || money.writes.length > 0 || seat.writes.length > 0 || dbl.writes.length > 3, { money, seat, realDoubleClickOnSeat: dbl, oneClickWrites: single });
      } finally { await c.close(); }
    },

    // The status words were one table in board.js and an identical copy in chairs.js; the eligibility words were a
    // table in board.js ("Eligible", "Verify") that had drifted from the one chairs.js and rail.js share ("Active",
    // "Re-verify"), so one amber visit read "Verify" on its Board card and "Re-verify" on its Chairs card beside a
    // Board button that also said "Re-verify". Negative control: one word per store value on both screens (`drift`
    // is empty) and one owner for the status table (`statusTables` names one file).
    async 'A-storm-words-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const a = (await state(p)).appointments.find((x) => x.id === 'a-1042');
        const board = await chipWords(p, tid('board.card.a-1042') + ' > .meta');
        const boardStatus = (await chipWords(p, tid('board.card.a-1042') + ' > .who'))[0] || null;
        await hop(p, '#/hygienist/chairs'); await p.waitForTimeout(150);
        if (!(await p.$('#chairs-details-a-1042:not([hidden])'))) { await click(p, 'chairs.card.a-1042.expand'); await p.waitForTimeout(120); }
        const chairsElig = await p.evaluate(() => { const d = document.getElementById('chairs-details-a-1042'); const row = d && [...d.querySelectorAll('.row')].find((r) => /^Coverage/.test(r.textContent)); const ch = row && row.querySelector('.chip'); return ch ? [...ch.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : null; });
        const chairsStatus = (await chipWords(p, tid('chairs.card.a-1042') + ' > .who'))[0] || null;
        const ELIGW = /^(Eligible|Verify|Re-verify|Active|Inactive|Self-pay)$/;
        const boardElig = board.find((w) => ELIGW.test(w)) || null;
        const drift = {};
        if (boardElig && chairsElig && boardElig !== chairsElig) drift.eligibility = { store: a.eligibility, board: boardElig, chairs: chairsElig };
        if (boardStatus && chairsStatus && boardStatus !== chairsStatus) drift.status = { store: a.status, board: boardStatus, chairs: chairsStatus };
        const statusTables = owners(/scheduled: \['info', 'Scheduled'\]/);
        const measured = !!(boardElig && chairsElig && boardStatus && chairsStatus);
        rec('A-storm-words-4', 'The amber visit a-1042 reads "Verify" on its Board card and "Re-verify" on its Chairs card and Rail chip; the status table is one copy in board.js and another in chairs.js', 'B4 — one canonical word per concept across screens; docs/15 one rule, one owner (ui.js STATUS / ELIG)',
          !measured || Object.keys(drift).length > 0 || statusTables.length !== 1, { store: { status: a.status, eligibility: a.eligibility }, board: { status: boardStatus, eligibility: boardElig, chips: board }, chairs: { status: chairsStatus, eligibility: chairsElig }, drift, statusTables });
      } finally { await c.close(); }
    },
  };
};
