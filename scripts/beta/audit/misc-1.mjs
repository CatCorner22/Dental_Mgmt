// Audit checks for the misc-1 chunk: prototype/CONTRACTS.md, prototype/css/components.css,
// prototype/js/app.js, prototype/js/router.js, prototype/js/screens/signin.js
// (root causes RC-211, RC-220, RC-124, RC-233, RC-109, RC-137, RC-62, RC-47, RC-55, RC-59, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes its browser context in `finally` so one failure cannot hang the run.
//
// CSS consequences are measured through getBoundingClientRect / getComputedStyle in the live page, and the
// authoring rules are quoted by reading the .css file from disk. document.styleSheets[].cssRules is never
// touched: over file:// it throws SecurityError and a catch-and-continue would silently report "no rules".
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const readRepo = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const CONTRACTS = readRepo('prototype/CONTRACTS.md');
const sectionOf = (n) => { const i = CONTRACTS.indexOf('## ' + n + '.'); if (i < 0) return ''; const j = CONTRACTS.indexOf('\n## ', i + 4); return CONTRACTS.slice(i, j < 0 ? CONTRACTS.length : j); };
// §6 lists its codes as backticked snake_case words; `refusal.verb`, `aria-live="polite"` and the rest carry
// characters no code has, so the class below picks out codes and nothing else.
const listedCodes = () => { const s = sectionOf(6); const m = s.slice(s.indexOf('Codes:')); return [...new Set([...m.matchAll(/`([a-z][a-z0-9_]*)`/g)].map((x) => x[1]))]; };
// §4: every backticked entry in every table row. `<a|b>` enumerates; a bare `<x>` stands for ONE id segment,
// so the placeholder never swallows a dot — that is what makes board.card.<apptId> different from
// board.card.a-1042.rail.
const s4Entries = () => { const rows = sectionOf(4).split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*Screen\s*\|/.test(l) && !/^\|\s*-+/.test(l)); return rows.flatMap((row) => [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1])); };
const s4Regex = (e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => (inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+')) + '$');
const JS_FILES = () => { const out = []; const walk = (d) => { for (const f of fs.readdirSync(path.join(ROOT, d))) { const rel = d + '/' + f; if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel); else if (f.endsWith('.js')) out.push(rel); } }; try { walk('prototype/js'); } catch { /* ignore */ } return out; };
const grepJs = (word) => { const re = new RegExp('\\b' + word + '\\b'); const hits = []; for (const f of JS_FILES()) { const lines = readRepo(f).split('\n'); lines.forEach((l, i) => { if (re.test(l)) hits.push(f + ':' + (i + 1)); }); } return hits; };

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const act = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, isBody: a === document.body }; });
  const refusalEvents = (p) => p.evaluate(() => window.__events.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control || null })));
  const writeEvents = (p) => p.evaluate(() => window.__events.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id })));
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const h1 = (p) => p.evaluate(() => { const e = document.querySelector('#canvas h1'); return e ? e.textContent.trim() : null; });
  const ids = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')));
  // A press that cannot hang the run: missing control -> false, unclickable control -> false.
  const tap = async (p, tid) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; try { await p.click(s, { timeout: 4000 }); } catch { return false; } await p.waitForTimeout(90); return true; };
  // Type into a field and blur it before the next press: the blur handlers reflow the card, and a click
  // aimed before the reflow lands on empty space (measured: a click event with no testid, no refusal).
  const type = async (p, tid, v) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, v); await p.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.blur(); }, s); await p.waitForTimeout(160); return true; };
  const rect = (p, tid) => p.evaluate((t) => { const e = document.querySelector(`[data-testid="${t}"]`); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; }, tid);
  const padCss = (p, tid) => p.evaluate((t) => { const e = document.querySelector(`[data-testid="${t}"]`); if (!e) return null; const pad = e.closest('.pinpad'); return { columns: pad ? getComputedStyle(pad).gridTemplateColumns : null, columnGap: pad ? getComputedStyle(pad).columnGap : null, keyMinWidth: getComputedStyle(e).minWidth, keyWidth: Math.round(e.getBoundingClientRect().width) }; }, tid);
  // A real document reload. p.goto to a URL that differs only in its fragment is a same-document navigation,
  // so the store, the screen modules and window.__events would survive it and one scenario would contaminate
  // the next; going through about:blank first guarantees a fresh page per scenario.
  const reload = async (p, hash) => { await p.goto('about:blank'); await go(p, hash); };
  // Walk the document's Tab order from a blurred start until it cycles; returns the ids in order.
  const tabWalk = async (p, max = 70) => {
    await p.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
    const order = [];
    for (let i = 0; i < max; i++) {
      await p.keyboard.press('Tab');
      const t = await p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });
      order.push(t);
      if (order.length > 4 && t === order[0] && order.slice(1).includes('BODY')) break;
    }
    return order;
  };

  return {
    // RC-211 · B2 / CONTRACTS §6 / A6 · CONTRACTS.md:96 — "a code the product raises and this list omits is a defect in one of the two".
    // Both sides are computed here: the listed side by parsing the §6 Codes sentence out of CONTRACTS.md, the raised side by driving the
    // seven paths the claim names and reading the `code` of every refusal event the run logged, plus a source scan for the two codes the
    // claim says are raised in code but not renderable and the three it says are listed but never rendered.
    // Negative control: if every code the driven gates raised were in §6, `raisedNotListed` would be empty and the check reports false —
    // and the run proves the driving works both ways, because the same eight scenarios also raise needs_second, which IS in §6 and is
    // therefore absent from the difference. The check also refuses to count a vacuous run: if no refusal fired at all it reports false.
    async 'A-misc-1-1'(b) {
      const { c, p } = await ctx(b);
      try {
        const listed = listedCodes();
        const raised = [];
        const scen = {};
        // Each scenario runs on a fresh document, so its refusal events are exactly the ones it raised.
        const collect = async (name) => { const ev = await refusalEvents(p); scen[name] = ev; for (const e of ev) raised.push({ code: e.code, verb: e.verb, where: name, seq: e.seq }); return ev; };

        // 1 · encounter.js:153 — dismiss a hygienist tag with an empty reason
        await reload(p, '#/dentist/encounter/enc-9002');
        await tap(p, 'enc.tag.tag-1.dismiss'); await tap(p, 'enc.tag.tag-1.dismiss');
        await collect('encounter: enc.tag.tag-1.dismiss x2');

        // 2 · moneydesk.js:136/:137 then store.js:134 — amount 0, then no reason, then the listed code
        await reload(p, '#/biller/money');
        await tap(p, 'money.writeoff.p-306'); await type(p, 'money.writeoff.amount', '0'); await tap(p, 'money.writeoff.post');
        await type(p, 'money.writeoff.amount', '410.00'); await tap(p, 'money.writeoff.post');
        await tap(p, 'money.writeoff.reason.courtesy'); await tap(p, 'money.writeoff.post');
        await collect('money: writeoff p-306 (amount 0, then no reason, then courtesy)');

        // 3 · perio.js:173 — save the screening lane with empty sextants
        await reload(p, '#/hygienist/perio/enc-9001');
        await tap(p, 'perio.screening'); await tap(p, 'perio.save');
        await collect('perio: perio.screening then perio.save');

        // 4/5 · roles.js:176/:177 — save the day-pass form with no name, then with a shift end in the past
        await reload(p, '#/owner/roles');
        await tap(p, 'roles.daypass.add'); await tap(p, 'roles.daypass.save'); await tap(p, 'roles.daypass.save');
        await type(p, 'roles.daypass.name', 'Bob Jones'); await type(p, 'roles.daypass.end', '08:00');
        await tap(p, 'roles.daypass.location.loc-1'); await tap(p, 'roles.daypass.save');
        await collect('roles: daypass save (no name, then end 08:00)');

        // 6 · rail.js:178 — statement on a balance still waiting on insurance
        await reload(p, '#/frontdesk/ledger/p-315');
        await tap(p, 'ledger.statement.send');
        await collect('ledger: ledger.statement.send on p-315');

        // 7 · store.js:140 via phone.js:95 — the requester approving their own request
        await reload(p, '#/biller/phone/approvals');
        await tap(p, 'phone.simulate'); await tap(p, 'phone.request.ar-1.approve');
        await collect('phone: simulate then phone.request.ar-1.approve as the biller');

        // The other direction: three codes §6 lists. note_unfiled and consent_scope are searched for in the
        // source; notfound is driven on the five unknown-id routes the claim names, each on a fresh document
        // so the refusal list below is what that route alone produced.
        const notfound = [];
        for (const hash of ['#/frontdesk/checkout/a-9999', '#/hygienist/perio/enc-nope', '#/dentist/encounter/enc-nope', '#/frontdesk/ledger/p-nope', '#/frontdesk/nowhere']) {
          await reload(p, hash);
          notfound.push({ hash, h1: await h1(p), refusalEvents: await refusalEvents(p) });
        }

        const raisedCodes = [...new Set(raised.map((x) => x.code))].sort();
        const raisedNotListed = raisedCodes.filter((x) => !listed.includes(x));
        const raisedAndListed = raisedCodes.filter((x) => listed.includes(x));
        const sourceOnly = ['packet_incomplete', 'stepup'].map((w) => ({ code: w, listedIn6: listed.includes(w), sourceHits: grepJs(w), renderedInThisRun: raisedCodes.includes(w) }));
        const listedNeverSeen = ['note_unfiled', 'consent_scope', 'notfound'].map((w) => ({ code: w, listedIn6: listed.includes(w), sourceHits: grepJs(w).length, refusalEventsInNotFoundRoutes: notfound.reduce((s, x) => s + x.refusalEvents.filter((e) => e.code === w).length, 0) }));

        rec('A-misc-1-1', 'CONTRACTS §6 and the product disagree both ways: codes the prototype raises and renders are missing from the §6 list, and three listed codes are never rendered as a refusal',
          'B2 / CONTRACTS §6 (the list is the contract: a code the product raises and this list omits is a defect in one of the two); A6',
          raisedNotListed.length > 0 && raisedCodes.length > 0,
          { section6ListedCodes: listed, section6Count: listed.length, raisedCodes, raisedNotListed, raisedAndListed, raisedWithVerbAndSeq: raised, scenarios: scen, raisedInCodeButNotRenderedHere: sourceOnly, listedButNeverRendered: listedNeverSeen, notFoundRoutes: notfound, note: 'listed side parsed from prototype/CONTRACTS.md §6; raised side is the `code` of every refusal event logged by the eight driven paths (window.__events, kind=refusal).' });
      } finally { await c.close(); }
    },

    // RC-220 · B1 · CONTRACTS.md:50 — every id in the DOM must match a §4 entry or pattern.
    // Both sides are computed here: §4 is parsed from CONTRACTS.md into entries and regexes (a bare <x> stands for exactly one id
    // segment, so it cannot swallow a dot), and the DOM side is a crawl of 8 personas x 12 routes plus sign-in, notfound and a pass of
    // states that sit behind one press. The difference is reported in both directions.
    // Negative control: an id that IS in the table (board.card.a-1042.arrive, rail.tab.chart, money.tab.era ...) matches its pattern and
    // never lands in `unmatched`; if the table had absorbed the families the code renders, `unmatched` would be empty and the check
    // reports false. The check also refuses a vacuous crawl: fewer than 300 observed ids, or a §4 parse that yields no entries, reports false.
    async 'A-misc-1-2'(b) {
      const { c, p } = await ctx(b);
      try {
        const entries = s4Entries();
        const pats = entries.map((e) => ({ e, re: s4Regex(e) }));
        const seen = new Map();
        const grab = async (where) => { for (const id of await ids(p)) if (!seen.has(id)) seen.set(id, where); };
        const visit = async (hash) => { await hop(p, hash); await grab(hash); };
        const step = async (tid) => { if (await tap(p, tid)) await grab('after ' + tid); };

        await go(p, '#/signin'); await grab('#/signin');
        const PERSONAS = ['frontdesk', 'biller', 'hygienist', 'dentist', 'surgeon', 'owner', 'compliance', 'temp'];
        const ROUTES = ['board', 'money', 'chairs', 'exams', 'close', 'risk', 'roles', 'phone/approvals', 'checkout/a-1044', 'perio/enc-9001', 'encounter/enc-9002', 'ledger/p-303'];
        for (const persona of PERSONAS) for (const route of ROUTES) await visit('#/' + persona + '/' + route);
        await visit('#/frontdesk/nowhere');
        const baseObserved = seen.size;

        // States behind one press (the auditor's "Phase B").
        await visit('#/frontdesk/board');
        for (const t of ['board.card.a-1042.expand', 'board.card.a-1042.arrive', 'board.card.a-1042.seat', 'board.readiness.toggle']) await step(t);
        await p.keyboard.press('Control+k'); await p.waitForTimeout(200); await grab('palette open');
        await p.keyboard.type('vega'); await p.waitForTimeout(250); await grab('palette results');
        await step('palette.row.0'); await step('palette.confirm.dob');
        for (const t of ['chart', 'notes', 'perio', 'imaging', 'plan', 'ledger', 'claims', 'docs', 'profile']) await step('rail.tab.' + t);
        await step('rail.close');
        await visit('#/hygienist/chairs'); for (const t of ['chairs.card.a-1042.expand', 'chairs.card.a-1042.ready']) await step(t);
        await visit('#/hygienist/perio/enc-9001');
        for (const t of ['perio.pad.toggle', 'perio.settings', 'perio.tag.add', 'perio.screening', 'perio.save', 'perio.full']) await step(t);
        await p.keyboard.type('3'.repeat(168), { delay: 0 }); await p.waitForTimeout(220); await grab('perio full chart');
        await step('perio.save'); await grab('perio saved');
        await visit('#/dentist/encounter/enc-9002');
        for (const t of ['enc.tag.tag-1.dismiss', 'enc.tooth.30', 'enc.surface.30.d', 'enc.proc.d2392', 'enc.note.starter.0', 'enc.file']) await step(t);
        await visit('#/biller/money');
        await step('money.writeoff.p-306'); await step('money.writeoff.post');
        for (const t of ['era', 'aging', 'denials', 'statements', 'credits', 'variances', 'approvals']) await step('money.tab.' + t);
        await step('money.tab.era'); await step('money.era.era-1.postmatched');
        await step('money.tab.denials'); await step('money.denial.c-88.appeal');
        await step('money.tab.variances'); await step('money.variance.v-1.open');
        await visit('#/owner/close'); for (const t of ['close.tied.tile', 'close.changed', 'close.late', 'close.closeday']) await step(t);
        await visit('#/owner/roles'); for (const t of ['roles.daypass.add', 'roles.daypass.role.rdh', 'roles.daypass.credential.add', 'roles.daypass.save']) await step(t);
        await visit('#/owner/phone/approvals'); for (const t of ['phone.simulate', 'phone.request.ar-1.approve']) await step(t);
        await grab('phone step-up pad'); await step('phone.stepup.cancel');
        await visit('#/frontdesk/checkout/a-1044?device=shared');
        for (const t of ['checkout.line.pr-1', 'checkout.tender.card', 'checkout.writeoff.add', 'checkout.explain', 'checkout.showpatient', 'checkout.post']) await step(t);
        await visit('#/frontdesk/ledger/p-315'); for (const t of ['ledger.statement.send', 'ledger.statement.preview', 'ledger.explain', 'ledger.asof']) await step(t);
        await visit('#/dentist/exams?device=shared'); await step('topbar.author'); await grab('shell PIN pad');

        const all = [...seen.keys()].sort();
        const unmatched = all.filter((id) => !pats.some((x) => x.re.test(id)));
        const matched = all.length - unmatched.length;
        const s4Unseen = entries.filter((e) => !all.some((id) => s4Regex(e).test(id)));
        const family = (id) => id.replace(/\b(a-\d+|p-\d+|enc-\d+|el-\d+|ar-\d+|c-\d+|v-\d+|d-\d+|pl-\d+|pr-\d+|tag-\d+|sd-\d+|cr-\d+|loc-\d+|era-\d+)\b/g, '<id>');
        const families = {};
        for (const id of unmatched) { const f = family(id); families[f] = (families[f] || 0) + 1; }

        rec('A-misc-1-2', 'CONTRACTS §4 never absorbed the test ids the code renders: a crawl of the personas, routes and one-press states finds ids in the DOM that match no §4 entry or pattern (whole Ledger screen, the .rail/.why families, nav.*, palette.*, perio.*, roles.*, phone.*)',
          'B1 (CHECKLIST) / CONTRACTS §4: every id in the DOM matches a §4 entry or pattern',
          unmatched.length > 0 && all.length >= 300 && entries.length > 0,
          { section4Entries: entries.length, observedIds: all.length, observedInBaseCrawl: baseObserved, matchedCount: matched, unmatchedCount: unmatched.length, unmatchedFamilies: families, unmatchedIds: unmatched, section4EntriesNotSeenInThisCrawl: s4Unseen, crawlScope: '8 personas x 12 routes at 1280x900 + #/signin + #/frontdesk/nowhere + one-press states; narrower than the claim\'s 8 x 15 x {desk,phone}, so the unmatched count is a lower bound', claimed: { observed: 868, unmatched: 174 }, sampleMatchedIds: all.filter((id) => pats.some((x) => x.re.test(id))).slice(0, 12) });
      } finally { await c.close(); }
    },

    // RC-124 · B11 · prototype/css/components.css:442 sets .pinpad to three 64 px columns at <=640 px while :141 keeps .pinpad .btn at
    // min-width 72 px, so each key overflows its column and the 8 px gap is eaten.
    // Measured through getBoundingClientRect and getComputedStyle in the live page (never document.styleSheets: cssRules access throws
    // over file:// and a swallowed exception would report "no rules" as "no problem"); the authoring rules are quoted from the .css file.
    // Negative control: the same measurement at 1280 px (and 641 px, one pixel past the media query) shows the columns at 72 px and a
    // real 8 px gap between the same two keys, so a pad that kept its gap at phone width would report false here.
    async 'A-misc-1-3'(b) {
      const css = readRepo('prototype/css/components.css').split('\n');
      const cssLine = (n) => ({ line: n, text: (css[n - 1] || '').trim() });
      const measure = async (w, h) => {
        const { c, p } = await ctx(b, w, h);
        try {
          await go(p, '#/owner/phone/approvals');
          await tap(p, 'phone.simulate'); await tap(p, 'phone.request.ar-1.approve');
          const one = await rect(p, 'phone.stepup.1'), two = await rect(p, 'phone.stepup.2'), four = await rect(p, 'phone.stepup.4');
          const stepup = { one, two, four, gapX: one && two ? two.l - one.r : null, gapY: one && four ? four.t - one.b : null, css: await padCss(p, 'phone.stepup.1') };
          await reload(p, '#/dentist/exams?device=shared');
          await tap(p, 'topbar.author');
          const k1 = await rect(p, 'pin.key.1'), k2 = await rect(p, 'pin.key.2');
          const shell = { one: k1, two: k2, gapX: k1 && k2 ? k2.l - k1.r : null, css: await padCss(p, 'pin.key.1') };
          return { viewport: w, stepup, shell };
        } finally { await c.close(); }
      };
      const narrow = await measure(420, 900);
      const edge = await measure(641, 900);
      const wide = await measure(1280, 900);
      const breach = (m) => m.stepup.gapX != null && m.stepup.gapX < 8;
      rec('A-misc-1-3', 'At 420 px (and every width the <=640 px media query covers) the PIN pad keys touch: the step-up pad and the shell author pad both render 72 px keys in 64 px columns, so the gap between neighbouring targets is 0 px instead of 8 px',
        'B11 (CHECKLIST): every control is at least 44x44 px with at least 8 px to its neighbours at 1280, 1024, 820 and 420 px wide',
        breach(narrow) && !breach(wide),
        { at420: narrow, at641: edge, at1280: wide, stepupGapX: { 420: narrow.stepup.gapX, 641: edge.stepup.gapX, 1280: wide.stepup.gapX }, shellPinGapX: { 420: narrow.shell.gapX, 641: edge.shell.gapX, 1280: wide.shell.gapX }, cssRules: [cssLine(140), cssLine(141), cssLine(441), cssLine(442)], method: 'getBoundingClientRect + getComputedStyle on the live page; CSS text read from prototype/css/components.css on disk. document.styleSheets is never read (cssRules throws over file://).' });
    },

    // RC-233 · B10 · prototype/js/app.js:43 — `if (restore == null) first.setAttribute('tabindex','-1')` is applied to
    // c.querySelector('h1, [data-testid]'). On Daily Close the tile BUTTON (dailyclose.js:87) precedes the pageHead h1, so the screen's
    // first control is stamped tabindex="-1" and drops out of the Tab order until something rebuilds it.
    // Negative control: on every other screen the element app.js stamps is the H1, which carries no click handler, so nothing leaves the
    // Tab order — and the Tab walk on the Board reaches its own controls. If Daily Close behaved the same way, `tabindex` on arrival
    // would be null (or the walk would reach close.tied.tile) and the check reports false. The walk must also demonstrably work
    // (it must reach close.closeday and cycle back), or the "never reached" reading would be vacuous.
    async 'A-misc-1-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const arrival = await p.evaluate(() => { const t = document.querySelector('[data-testid="close.tied.tile"]'); const a = document.activeElement; return { present: !!t, tag: t ? t.tagName : null, tabindex: t ? t.getAttribute('tabindex') : null, hasVisibleBox: t ? t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0 : false, focusedOnArrival: a && a.getAttribute ? a.getAttribute('data-testid') : (a ? a.tagName : null) }; });
        const order = await tabWalk(p);
        const reachedTile = order.includes('close.tied.tile');
        const walkWorks = order.includes('close.closeday') && order.length > 6;
        // The same screen after a bare T rebuilds the tile (dailyclose.js rerender) without the attribute.
        await p.keyboard.press('T'); await p.waitForTimeout(250);
        const afterT = await p.evaluate(() => { const t = document.querySelector('[data-testid="close.tied.tile"]'); return t ? { tabindex: t.getAttribute('tabindex') } : null; });
        const orderAfterT = await tabWalk(p);
        // Every persona, same route.
        const perPersona = [];
        for (const persona of ['frontdesk', 'biller', 'hygienist', 'dentist', 'surgeon', 'owner', 'compliance', 'temp']) {
          await hop(p, '#/' + persona + '/board'); await hop(p, '#/' + persona + '/close');
          perPersona.push({ persona, tabindex: await p.evaluate(() => { const t = document.querySelector('[data-testid="close.tied.tile"]'); return t ? t.getAttribute('tabindex') : 'MISSING'; }) });
        }
        // Control screens: what app.js:43 stamps when the first node is the heading.
        const controls = [];
        for (const hash of ['#/frontdesk/board', '#/biller/money', '#/hygienist/chairs', '#/dentist/exams', '#/compliance/risk']) {
          await hop(p, hash);
          controls.push(Object.assign({ hash }, await p.evaluate(() => { const f = document.getElementById('canvas').querySelector('h1, [data-testid]'); return { firstTag: f.tagName, firstTestid: f.getAttribute('data-testid'), tabindex: f.getAttribute('tabindex') }; })));
        }
        await hop(p, '#/frontdesk/board');
        const boardWalk = await tabWalk(p);

        rec('A-misc-1-4', 'app.js:43 stamps tabindex="-1" on the first h1-or-[data-testid] of the canvas; on Daily Close that node is the close.tied.tile button, which is therefore never reached by Tab for any persona until a re-render rebuilds it',
          'B10 (CHECKLIST): after a route change focus is on the h1 or the first control, and every control the screen renders stays reachable by keyboard',
          arrival.present && arrival.tag === 'BUTTON' && arrival.tabindex === '-1' && !reachedTile && walkWorks,
          { tileOnArrival: arrival, tabOrderOnClose: order, tileReachedByTab: reachedTile, tabWalkReachedCloseday: walkWorks, tileAfterBareT: afterT, tabOrderAfterT: orderAfterT, tileReachedAfterT: orderAfterT.includes('close.tied.tile'), tabindexPerPersona: perPersona, firstCanvasNodeOnOtherScreens: controls, tabOrderOnBoard: boardWalk.slice(0, 12) });
      } finally { await c.close(); }
    },

    // RC-109 · B10 · prototype/js/app.js:33 — `changed` is computed on the path only (r.raw.split('?')[0]), and router.go on an unchanged
    // hash calls router.render() with no hashchange at all, so the canvas is re-mounted while the arrival-focus block at :38 is skipped.
    // Two paths are measured: the UI-reachable one (a palette action for the route already open) and the query-only hash change.
    // Negative control: the same palette gesture for a DIFFERENT route (Roles) changes the hash, `changed` is true, and the measurement
    // shows focus on the new screen's H1 rather than BODY; if the unchanged-path case also landed on the H1 the check reports false.
    // The palette must be opened with Ctrl+K, not by clicking topbar.search: the dialog restores focus to whatever was focused before it
    // opened, so opening it from a button that survives the re-render hides the defect.
    async 'A-misc-1-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const arrival = await act(p);
        await p.keyboard.press('Control+k'); await p.waitForTimeout(200);
        const paletteOpen = await p.evaluate(() => !!document.querySelector('[data-testid="palette.input"]'));
        await p.keyboard.type('boa'); await p.waitForTimeout(250);
        const row0 = await txt(p, 'palette.row.0');
        await p.keyboard.press('Enter'); await p.waitForTimeout(350);
        const sameRoute = { hash: await p.evaluate(() => location.hash), focus: await act(p), routeEvents: await p.evaluate(() => window.__events.filter((e) => e.kind === 'route').length), canvasRebuilt: await h1(p) };
        // Negative control in the same run: a palette action whose route differs.
        await p.keyboard.press('Control+k'); await p.waitForTimeout(200);
        await p.keyboard.type('roles'); await p.waitForTimeout(250);
        await p.keyboard.press('Enter'); await p.waitForTimeout(350);
        const diffRoute = { hash: await p.evaluate(() => location.hash), focus: await act(p), h1: await h1(p) };
        // The query-only hash change (scripts and URL edits).
        await go(p, '#/biller/money');
        await tap(p, 'money.tab.aging');
        const beforeQuery = await act(p);
        await p.evaluate(() => { location.hash = '#/biller/money?theme=light'; }); await p.waitForTimeout(300);
        const afterQuery = await act(p);
        const remounted = await p.evaluate(() => !!document.querySelector('[data-testid="money.tab.aging"]'));

        rec('A-misc-1-5', 'A render on an unchanged path never sets focus: a palette action for the route already open, and a query-only hash change, both re-mount the canvas and leave document.activeElement on BODY',
          'B10 (CHECKLIST): after a route change focus is on the h1 or the first control, never on body; app.js:33 computes `changed` on the path only',
          sameRoute.focus.isBody && afterQuery.isBody && !diffRoute.focus.isBody && paletteOpen,
          { focusOnArrival: arrival, paletteOpened: paletteOpen, paletteRow0: row0, sameRouteAction: sameRoute, differentRouteAction_negativeControl: diffRoute, queryOnlyHop: { focusBefore: beforeQuery, focusAfter: afterQuery, canvasRemounted: remounted, hash: '#/biller/money?theme=light' } });
      } finally { await c.close(); }
    },

    // RC-137 · A2 · prototype/js/app.js:18 — P.reset() rebuilds the store from the seed (dropping S.outage, which app.js:11 had set) but
    // leaves window.__proto.outage true and never repaints the Andon strip, so the strip still says the Board is read-only while the store
    // accepts writes.
    // Negative control: the same measurement without reset (or after the next hashchange, which re-applies the query through P.set) shows
    // store.outage === true and arrive('a-1042') refused with code `outage` and no appointmentEvents write, so the check reports false.
    // The check requires the pre-reset state to have been a real outage (store true, Andon saying read-only, arrive refused) before it
    // counts the post-reset disagreement.
    async 'A-misc-1-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1');
        const before = await p.evaluate(() => ({ storeOutage: Proto.store.get().outage, storeOutageType: typeof Proto.store.get().outage, protoOutage: window.__proto.outage, andon: (document.getElementById('andon') || {}).textContent.trim(), arriveControlPresent: !!document.querySelector('[data-testid="board.card.a-1042.arrive"]') }));
        const refusedBefore = await p.evaluate(() => Proto.store.arrive('a-1042'));
        const seq0 = await lastSeq(p);
        const after = await p.evaluate(() => { window.__proto.reset(); return { storeOutage: Proto.store.get().outage, storeOutageType: typeof Proto.store.get().outage, protoOutage: window.__proto.outage, andon: (document.getElementById('andon') || {}).textContent.trim() }; });
        const arriveAfter = await p.evaluate(() => Proto.store.arrive('a-1042'));
        const wrote = (await writeEvents(p)).filter((e) => e.seq > seq0);
        const seqRange = [seq0 + 1, await lastSeq(p)];
        // Re-sync path (the negative control): a real hashchange re-applies the query through P.set, and the
        // same measurement then shows the store and the Andon agreeing again, with Arrive refused as before.
        // (The hash must actually change: setting location.hash to the value it already holds fires nothing.)
        await hop(p, '#/frontdesk/chairs?outage=1'); await hop(p, '#/frontdesk/board?outage=1');
        const afterHop = await p.evaluate(() => ({ storeOutage: Proto.store.get().outage, storeOutageType: typeof Proto.store.get().outage, protoOutage: window.__proto.outage, arrive: Proto.store.arrive('a-1043') }));

        rec('A-misc-1-6', 'window.__proto.reset() rebuilds the store without the outage flag while __proto.outage stays true and the Andon strip still says the Board is read-only: the same page then accepts an Arrive write that the pre-reset store refused',
          'A2 (CHECKLIST): the store and the harness state (CONTRACTS §3) agree, and a read-only Andon means writes are refused',
          before.storeOutage === true && refusedBefore.ok === false && after.storeOutage !== true && after.protoOutage === true && /read-only|reads only/i.test(after.andon) && arriveAfter.ok === true,
          { before, arriveBeforeReset: refusedBefore, after, arriveAfterReset: arriveAfter, writesInRange: wrote, seqRange, afterNextHashchange_negativeControl: afterHop, note: 'no UI control calls reset(); this is the harness API of CONTRACTS §3.' });
      } finally { await c.close(); }
    },

    // RC-62 · A1 · prototype/js/router.js:13 — decodeURIComponent is called on every key and value of the hash query with no guard, so a
    // malformed percent-escape throws URIError inside parse(), and every hashchange listener that calls router.current() throws with it.
    // Negative control: the same hop with a well-formed escape (?bad=%E0%A4%A4, a complete UTF-8 sequence) parses, raises no page error,
    // and renders the new screen — so a guarded decode would report false here. The check also requires the canvas to be left stale
    // (still showing the previous screen while location.hash names the new one), not merely that some error was logged.
    async 'A-misc-1-7'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        // Control first: a well-formed escape on the same route shape.
        await reload(p, '#/biller/money');
        await p.evaluate(() => { location.hash = '#/frontdesk/board?bad=%E0%A4%A4'; }); await p.waitForTimeout(300);
        const good = { pageErrors: errs.slice(), hash: await p.evaluate(() => location.hash), h1: await h1(p) };
        // Now the malformed one.
        await reload(p, '#/biller/money');
        const beforeH1 = await h1(p);
        errs.length = 0;
        await p.evaluate(() => { location.hash = '#/frontdesk/board?bad=%E0%A4%A'; }); await p.waitForTimeout(400);
        const bad = { pageErrors: errs.slice(), hash: await p.evaluate(() => location.hash), h1: await h1(p), errorEvents: await p.evaluate(() => window.__events.filter((e) => e.kind === 'error').map((e) => ({ seq: e.seq, message: e.message }))) };
        const parseThrew = await p.evaluate(() => { try { Proto.router.parse('#/frontdesk/board?bad=%E0%A4%A'); return null; } catch (e) { return String(e); } });
        const stale = bad.h1 === beforeH1 && /board/i.test(bad.hash);

        rec('A-misc-1-7', 'A malformed percent-escape in the hash query throws URIError out of router.parse, so every hashchange listener errors and the canvas is left on the previous screen while the hash names the new route',
          'A1 (CHECKLIST): reaching a route raises no page error and no console error; an unknown or bad hash lands on notfound/signin',
          bad.pageErrors.length > 0 && parseThrew != null && /URI/i.test(parseThrew) && stale && good.pageErrors.length === 0,
          { malformed: bad, canvasStale: stale, h1BeforeHop: beforeH1, parseDirect: parseThrew, wellFormedEscape_negativeControl: good, reachability: 'only by editing the URL: no UI control writes a query with a bad escape' });
      } finally { await c.close(); }
    },

    // RC-47 · B1 · prototype/js/screens/signin.js:26 renders signin.afterhours, which CONTRACTS §4 does not list.
    // The id and the §4 text searched are both carried in the evidence, and the control is exercised to show it is real (it toggles
    // clock.afterHours, which the store's after_hours gate reads).
    // Negative control: the same search over the same §4 row finds signin.go, signin.motion, signin.grayscale, signin.privacy and
    // signin.outage, all rendered on the same screen; if signin.afterhours were listed the check reports false.
    async 'A-misc-1-8'(b) {
      const { c, p } = await ctx(b);
      try {
        const rowSignin = sectionOf(4).split('\n').find((l) => /^\|\s*Sign-in\s*\|/.test(l)) || '';
        const entries = s4Entries();
        const inS4 = (id) => entries.some((e) => s4Regex(e).test(id));
        await go(p, '#/signin');
        const present = await p.evaluate(() => { const e = document.querySelector('[data-testid="signin.afterhours"]'); return e ? { tag: e.tagName, text: e.textContent.trim(), pressed: e.getAttribute('aria-pressed') } : null; });
        const beforeFlag = await p.evaluate(() => Proto.store.get().clock.afterHours);
        await tap(p, 'signin.afterhours');
        const afterFlag = await p.evaluate(() => Proto.store.get().clock.afterHours);
        const siblings = ['signin.go', 'signin.motion', 'signin.grayscale', 'signin.privacy', 'signin.outage', 'signin.persona.owner', 'signin.theme.dark'].map((id) => ({ id, inSection4: inS4(id), inDom: null }));
        for (const s of siblings) s.inDom = await p.evaluate((t) => !!document.querySelector(`[data-testid="${t}"]`), s.id);
        const screenIds = (await ids(p)).filter((x) => x.startsWith('signin.'));
        const unlisted = screenIds.filter((x) => !inS4(x));

        rec('A-misc-1-8', 'The sign-in screen renders signin.afterhours — a working toggle that flips clock.afterHours and drives the store\'s after_hours gate — and CONTRACTS §4 does not list it',
          'B1 (CHECKLIST) / CONTRACTS §4: every element with a click or key handler carries a data-testid that matches a §4 entry or pattern',
          !!present && !inS4('signin.afterhours') && beforeFlag !== afterFlag,
          { id: 'signin.afterhours', inSection4: inS4('signin.afterhours'), section4SignInRow: rowSignin.trim(), section4SignInEntries: [...rowSignin.matchAll(/`([^`]+)`/g)].map((m) => m[1]), section4EntryCount: entries.length, elementInDom: present, clockAfterHoursBefore: beforeFlag, clockAfterHoursAfter: afterFlag, signinIdsRendered: screenIds, signinIdsNotInSection4: unlisted, siblings_negativeControl: siblings });
      } finally { await c.close(); }
    },

    // RC-55 · B3 · prototype/js/screens/signin.js:28 builds signin.go with kind 'irreversible'.
    // B3 reserves that identity for Post, File, Save exam, Close day, Send, Approve and Go on the PIN pad; "Open my home" is none of
    // them, and the action is reversible in fact — the check proves that by signing in and signing out again, and shows the persona is
    // still preselected afterwards.
    // Negative control: the other "Open ..." verb in the product, the Andon strip's "Open approvals", is measured in the same run and
    // carries 'btn reversible'; if signin.go carried the same identity the check reports false.
    async 'A-misc-1-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/signin');
        const goBtn = await p.evaluate(() => { const e = document.querySelector('[data-testid="signin.go"]'); return e ? { label: e.textContent.replace(/✓/g, '').trim(), classes: e.className, kind: [...e.classList].filter((x) => ['irreversible', 'reversible', 'quiet', 'held'].includes(x)).join(' ') } : null; });
        // Reversibility in fact: sign in, then sign out; the persona is still selected.
        await tap(p, 'signin.persona.owner'); await tap(p, 'signin.go');
        const landed = await p.evaluate(() => location.hash);
        await tap(p, 'topbar.signout');
        const back = await p.evaluate(() => ({ hash: location.hash, ownerPressed: (document.querySelector('[data-testid="signin.persona.owner"]') || {}).getAttribute ? document.querySelector('[data-testid="signin.persona.owner"]').getAttribute('aria-pressed') : null }));
        // Comparator: the Andon strip's "Open approvals" once a request is pending.
        await go(p, '#/biller/money');
        await tap(p, 'money.writeoff.p-306'); await tap(p, 'money.writeoff.reason.courtesy'); await tap(p, 'money.writeoff.post');
        await hop(p, '#/dentist/exams');
        const andon = await p.evaluate(() => { const e = document.querySelector('[data-testid="andon.control"]'); return e ? { label: e.textContent.replace(/✓/g, '').trim(), classes: e.className, kind: [...e.classList].filter((x) => ['irreversible', 'reversible', 'quiet', 'held'].includes(x)).join(' ') } : null; });
        const b3Verbs = ['Post', 'File', 'Save exam', 'Close day', 'Send', 'Approve', 'Go'];

        rec('A-misc-1-9', '"Open my home" on sign-in carries the irreversible identity, which B3 reserves for Post, File, Save exam, Close day, Send, Approve and Go on the PIN pad; the same "Open ..." verb on the Andon strip is reversible, and signing in is reversible in fact (Sign out returns to #/signin with the persona still selected)',
          'B3 (CHECKLIST): the same verb carries the same identity on every screen; irreversible is reserved for the listed verbs',
          !!goBtn && goBtn.kind === 'irreversible' && !b3Verbs.includes(goBtn.label) && back.hash === '#/signin',
          { signinGo: goBtn, b3IrreversibleVerbs: b3Verbs, labelIsAB3Verb: !!goBtn && b3Verbs.includes(goBtn.label), landedAfterGo: landed, afterSignout: back, andonOpenApprovals_negativeControl: andon });
      } finally { await c.close(); }
    },

    // RC-59 · B10 · prototype/js/screens/signin.js:12 — paint() calls list.replaceChildren(...), which destroys the focused persona
    // button, and nothing re-focuses; render() (which ends at :35 with go.focus()) is not called on this path.
    // Negative control: in the same run, a control that DOES re-render the screen (signin.theme.dark at :18 calls render(r)) leaves
    // document.activeElement on signin.go, not BODY. So the measurement distinguishes "this repaint drops focus" from "focus is never
    // managed on this screen", and a persona press that kept focus would report false. The press must first have worked (the pressed
    // persona is the one chosen, aria-pressed="true") before the dropped focus is counted.
    async 'A-misc-1-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/signin');
        const arrival = await act(p);
        await p.focus('[data-testid="signin.persona.owner"]');
        const beforeEnter = await act(p);
        await p.keyboard.press('Enter'); await p.waitForTimeout(200);
        const afterEnter = await act(p);
        const pressed = await p.evaluate(() => { const e = document.querySelector('[data-testid="signin.persona.owner"]'); return e ? e.getAttribute('aria-pressed') : null; });
        await p.keyboard.press('Tab'); await p.waitForTimeout(140);
        const nextTab = await act(p);
        // Mouse path, same repaint.
        await go(p, '#/signin');
        await tap(p, 'signin.persona.compliance');
        const afterClick = await act(p);
        // Negative control: a control whose handler calls render(r), which ends with go.focus().
        await go(p, '#/signin');
        await tap(p, 'signin.theme.dark');
        const afterRerender = await act(p);

        rec('A-misc-1-10', 'Choosing a persona on sign-in repaints the radio group with replaceChildren and drops keyboard focus to BODY: the next Tab restarts at the first persona in the list instead of continuing to "Open my home"',
          'B10 (CHECKLIST): focus is never left on body after an action; the actor keeps their place',
          afterEnter.isBody && pressed === 'true' && !afterRerender.isBody,
          { focusOnArrival: arrival, focusBeforeEnter: beforeEnter, focusAfterEnter: afterEnter, personaAriaPressed: pressed, focusAfterNextTab: nextTab, focusAfterMouseClick: afterClick, focusAfterThemeToggle_negativeControl: afterRerender, why: 'signin.js:12 paint() replaces the focused button; signin.js:35 go.focus() only runs on the render() path (signin.js:17-26), which the persona buttons do not take.' });
      } finally { await c.close(); }
    },
  };
};
