// Stability and performance gates for the clickable prototype. Default position is NOT
// reproduced: a check reports true only when a budget is missed, a page error is thrown,
// a render leaves the canvas empty, or a number the UI prints is NaN.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, click, rec, FILE }) => {
  const ROUTES = [
    '#/signin',
    '#/frontdesk/board',
    '#/biller/money',
    '#/hygienist/chairs',
    '#/dentist/exams',
    '#/surgeon/exams',
    '#/owner/close',
    '#/compliance/risk',
    '#/temp/board',
    '#/assistant/board',
    '#/frontdesk/checkout/a-1044',
    '#/hygienist/perio/enc-9001',
    '#/dentist/encounter/enc-9002',
    '#/biller/ledger/p-303',
    '#/owner/roles',
    '#/phone/approvals',
    '#/frontdesk/board?outage=1',
    '#/frontdesk/board?privacy=1&device=shared',
  ];
  const BOOT_MS = 1500;
  const NAV_MS = 250;
  const ALLOC_PASS_MS = 80;
  const STATE_MS = 200;
  const SCREEN_MS = 300;
  const RESETS = 20;
  const WALKS = 80;

  const pageErrors = (p) => p.evaluate(() => (window.__events || []).filter((e) => e.kind === 'error').map((e) => e.message));
  const canvasKids = (p) => p.evaluate(() => { const c = document.getElementById('canvas'); return c ? c.children.length : 0; });
  const nanHits = (p) => p.evaluate(() => {
    const t = document.getElementById('canvas') ? document.getElementById('canvas').textContent : '';
    return (t.match(/\$NaN|\bNaN\b|undefined is not|cannot read/gi) || []).slice(0, 8);
  });
  const overflow = (p) => p.evaluate(() => {
    const se = document.scrollingElement;
    return { sw: se ? se.scrollWidth : 0, iw: window.innerWidth };
  });
  const nodes = (p) => p.evaluate(() => document.getElementsByTagName('*').length);
  // hashchange is a task: measure from assignment through the router's render handler, not the
  // assignment alone (which always looks like 0.2 ms).
  const hashPaintMs = (p, hash) => p.evaluate((h) => new Promise((resolve) => {
    if (location.hash === h) { resolve(0); return; }
    const t0 = performance.now();
    const on = () => { window.removeEventListener('hashchange', on); resolve(performance.now() - t0); };
    window.addEventListener('hashchange', on);
    location.hash = h;
  }), hash);

  return {
    // A page that throws before __proto.ready is a dead prototype: the two bad merges shipped
    // SyntaxError on store.js / app.js / ui.js and every later check timed out rather than naming it.
    async 'P-boot-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        const t0 = Date.now();
        await p.goto(FILE + '#/signin', { waitUntil: 'domcontentloaded' });
        let readyMs = null; let readyErr = null;
        try {
          await p.waitForFunction(() => window.__proto && window.__proto.ready, null, { timeout: 5000 });
          readyMs = Date.now() - t0;
        } catch (e) { readyErr = e.message; readyMs = Date.now() - t0; }
        const kids = readyErr ? 0 : await canvasKids(p);
        rec('P-boot-1', 'Boot to __proto.ready throws, exceeds ' + BOOT_MS + ' ms, or leaves the canvas empty',
          'A1 — the first paint raises no page error and is interactive',
          !!readyErr || errs.length > 0 || readyMs > BOOT_MS || kids === 0,
          { readyMs, readyErr, pageerrors: errs.slice(), canvasChildren: kids });
      } finally { await c.close(); }
    },

    // Hash navigation is the only router. A route that paints empty, throws, or takes hundreds of
    // milliseconds is a stability defect the five daily flows will hit.
    async 'P-nav-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/signin');
        const rows = [];
        for (const hash of ROUTES) {
          errs.length = 0;
          const ms = await hashPaintMs(p, hash);
          const kids = await canvasKids(p);
          const evErr = await pageErrors(p);
          const nan = await nanHits(p);
          rows.push({ hash, ms, kids, pageerrors: errs.slice(), evErr, nan });
        }
        const broke = rows.some((r) => r.ms > NAV_MS || r.kids === 0 || r.pageerrors.length || r.evErr.length || r.nan.length);
        rec('P-nav-1', 'A contracted route paints empty, throws, prints NaN, or takes more than ' + NAV_MS + ' ms to hash-navigate',
          'A1, A8 — every route renders; a number on screen is a finite number',
          broke, { budgetMs: NAV_MS, slowest: rows.slice().sort((a, b) => b.ms - a.ms).slice(0, 5), failed: rows.filter((r) => r.ms > NAV_MS || r.kids === 0 || r.pageerrors.length || r.evErr.length || r.nan.length) });
      } finally { await c.close(); }
    },

    // allocate() walks the ledger per patient. Money Desk statements used to call it twice per
    // account; a full-practice pass that grows without bound is what makes the Board hitch.
    async 'P-alloc-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const measure = await p.evaluate(() => {
          const S = Proto.store.get();
          const ids = S.patients.map((x) => x.id);
          const once = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
          const first = {};
          const pass1 = once(() => { for (const id of ids) first[id] = Proto.store.balances(id); });
          const pass2 = once(() => { for (const id of ids) Proto.store.balances(id); });
          const repeatEqual = ids.every((id) => {
            const a = first[id]; const b = Proto.store.balances(id);
            return a.patientDue === b.patientDue && a.insurancePending === b.insurancePending && a.credit === b.credit;
          });
          const one = Proto.store.allocate('p-307');
          const two = Proto.store.allocate('p-307');
          const memoHit = one === two;
          const held = Proto.store.requestWriteoff('p-306', 5000, 'courtesy');
          const three = Proto.store.allocate('p-307');
          const busted = three !== one;
          const untouchedEqual = three.patientDue === one.patientDue && three.insurancePending === one.insurancePending && three.credit === one.credit;
          const allPatients = once(() => { for (const id of ids) Proto.store.balances(id); });
          return { patients: ids.length, pass1, pass2, allPatients, repeatEqual, memoHit, busted, untouchedEqual, heldOk: !!(held && (held.ok || held.held)), ledgerRows: S.ledger.length };
        });
        const broke = errs.length > 0 || measure.pass1 > ALLOC_PASS_MS || measure.allPatients > ALLOC_PASS_MS || !measure.repeatEqual || !measure.memoHit || !measure.busted || !measure.untouchedEqual;
        rec('P-alloc-1', 'A full-practice balances() pass exceeds ' + ALLOC_PASS_MS + ' ms, two reads disagree, or a posting does not move the cached numbers',
          'A8 — a number on screen moves when the state behind it moves; allocate is one pass per patient until the next write',
          broke, measure);
      } finally { await c.close(); }
    },

    // __proto.state() deep-copies the store for every check. If it throws or takes hundreds of
    // milliseconds the harness itself becomes the bottleneck and a hung check looks like a product defect.
    async 'P-state-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const measure = await p.evaluate(() => {
          const t0 = performance.now();
          const snap = window.__proto.state();
          const ms = performance.now() - t0;
          const patients = (snap.patients || []).length;
          const ledger = (snap.ledger || []).length;
          snap._probe = true;
          const live = Proto.store.get();
          return { ms, patients, ledger, isolated: live._probe !== true };
        });
        rec('P-state-1', 'state() throws, exceeds ' + STATE_MS + ' ms, or returns a live store reference',
          'CONTRACTS §3 — state() is a deep copy the harness can mutate without moving the product',
          errs.length > 0 || measure.ms > STATE_MS || !measure.isolated,
          { ...measure, pageerrors: errs.slice() });
      } finally { await c.close(); }
    },

    // reset() rebuilds the store and must close dialogs and drop per-screen maps. Twenty resets
    // that grow the DOM are a leak; a reset that leaves the canvas empty is a boot failure.
    async 'P-reset-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await p.evaluate(() => window.__proto.reset());
        await hop(p, '#/frontdesk/board');
        const firstNodes = await nodes(p);
        const firstKids = await canvasKids(p);
        const series = [];
        for (let i = 0; i < RESETS; i++) {
          errs.length = 0;
          await p.evaluate(() => window.__proto.reset());
          await hop(p, i % 2 === 0 ? '#/frontdesk/board' : '#/biller/money');
          series.push({ i, kids: await canvasKids(p), nodes: await nodes(p), pageerrors: errs.slice(), nan: await nanHits(p) });
        }
        const last = series[series.length - 1];
        const grew = last.nodes > firstNodes * 1.35 + 80;
        const empty = series.some((s) => s.kids === 0);
        const threw = series.some((s) => s.pageerrors.length || s.nan.length);
        rec('P-reset-1', 'Twenty reset-and-repaint cycles throw, empty the canvas, or grow the DOM by more than 35%',
          'A1 — a rebuilt store paints; per-screen maps and dialogs do not accumulate',
          empty || threw || grew || firstKids === 0,
          { firstNodes, firstKids, last, grew, empty, threw, seriesTail: series.slice(-3) });
      } finally { await c.close(); }
    },

    // A seeded walk across the five homes and the posting surfaces. The storm-4 clinical walk
    // already covers random clinical clicks; this one measures page errors, NaN, overflow and
    // a hitch on the money and board surfaces a front desk actually sits on.
    async 'P-walk-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/signin');
        const steps = [
          '#/frontdesk/board', 'board.card.a-1044.arrive', 'board.card.a-1044.seat',
          '#/frontdesk/checkout/a-1044', 'checkout.tender.card',
          '#/biller/money', 'money.tab.aging', 'money.tab.statements', 'money.tab.credits', 'money.tab.era',
          '#/hygienist/chairs', '#/hygienist/perio/enc-9001',
          '#/dentist/encounter/enc-9002',
          '#/owner/close', '#/owner/roles',
          '#/phone/approvals',
          '#/frontdesk/board?theme=dark', '#/frontdesk/board?device=phone',
        ];
        const log = [];
        let i = 0;
        while (i < WALKS) {
          const step = steps[i % steps.length];
          errs.length = 0;
          const ms = step.startsWith('#')
            ? await hashPaintMs(p, step)
            : await p.evaluate((tid) => {
              const el = document.querySelector('[data-testid="' + tid + '"]');
              const t0 = performance.now();
              if (el) el.click();
              return performance.now() - t0;
            }, step);
          const row = { i, step, ms, kids: await canvasKids(p), pageerrors: errs.slice(), evErr: await pageErrors(p), nan: await nanHits(p), overflow: await overflow(p) };
          log.push(row);
          i += 1;
        }
        const broke = log.some((r) => r.pageerrors.length || r.evErr.length || r.nan.length || r.kids === 0 || r.overflow.sw > r.overflow.iw + 1 || r.ms > SCREEN_MS);
        rec('P-walk-1', 'An ' + WALKS + '-step walk across Board, Checkout, Money Desk, Chairs, Encounter, Close and Roles throws, paints empty, prints NaN, overflows, or hitches past ' + SCREEN_MS + ' ms',
          'A1, A8, B11 — the five daily surfaces stay up and inside the viewport',
          broke,
          { failed: log.filter((r) => r.pageerrors.length || r.evErr.length || r.nan.length || r.kids === 0 || r.overflow.sw > r.overflow.iw + 1 || r.ms > SCREEN_MS).slice(0, 12), slowest: log.slice().sort((a, b) => b.ms - a.ms).slice(0, 5), steps: log.length });
      } finally { await c.close(); }
    },

    // Rapid hash changes used to leave lastRoute and the canvas out of sync when render() re-entered.
    async 'P-rapid-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/signin');
        const hops = ['#/frontdesk/board', '#/biller/money', '#/hygienist/chairs', '#/owner/close', '#/dentist/exams', '#/signin'];
        const measure = await p.evaluate((list) => {
          const t0 = performance.now();
          for (let i = 0; i < 40; i++) location.hash = list[i % list.length];
          return { ms: performance.now() - t0, ready: !!(window.__proto && window.__proto.ready), hash: location.hash };
        }, hops);
        await p.waitForTimeout(80);
        const kids = await canvasKids(p);
        const evErr = await pageErrors(p);
        rec('P-rapid-1', 'Forty hash assignments throw, drop ready, or leave the canvas empty',
          'A1 — the render loop is re-entrant enough to survive a burst of hashchange events',
          errs.length > 0 || evErr.length > 0 || !measure.ready || kids === 0,
          { ...measure, kids, pageerrors: errs.slice(), evErr });
      } finally { await c.close(); }
    },

    // Money Desk ERA (41 lines) plus the statements tab (balances for every patient) is the
    // heaviest paint in the prototype. A hitch here is what a biller feels.
    async 'P-money-1'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const tabs = ['era', 'aging', 'denials', 'statements', 'credits', 'variances', 'approvals'];
        const rows = [];
        for (const tab of tabs) {
          errs.length = 0;
          const ms = await p.evaluate((tid) => {
            const el = document.querySelector('[data-testid="' + tid + '"]');
            const t0 = performance.now();
            if (el) el.click();
            return { ms: performance.now() - t0, pressed: !!el };
          }, 'money.tab.' + tab);
          await p.waitForTimeout(40);
          rows.push({ tab, pressed: ms.pressed, ms: ms.ms, kids: await canvasKids(p), pageerrors: errs.slice(), nan: await nanHits(p) });
        }
        const broke = rows.some((r) => !r.pressed || r.ms > SCREEN_MS || r.kids === 0 || r.pageerrors.length || r.nan.length);
        rec('P-money-1', 'A Money Desk tab takes more than ' + SCREEN_MS + ' ms, throws, prints NaN, or does not switch',
          'A1, A8 — the heaviest worklist paints in one frame budget',
          broke, { budgetMs: SCREEN_MS, rows });
      } finally { await c.close(); }
    },
  };
};
