// Swarm round, lens "harness": checks on the harness itself (scripts/beta/audit/*.mjs, scripts/proto-check.mjs, scripts/lib/flows.mjs).
// Each S-harness check re-introduces (or names) a defect an existing check claims to guard and measures that the guard stays silent.
// Default position is NOT reproduced: every check measures the blindness it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';
import phone1 from './screens-phone-1.mjs';
import { FLOWS } from '../../lib/flows.mjs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const src = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const identity = (p, tid) => p.evaluate((tid) => {
    const e = document.querySelector(`[data-testid="${tid}"]`); if (!e) return null;
    return { label: e.textContent.trim(), className: e.className, held: e.classList.contains('held'), irreversible: e.classList.contains('irreversible') };
  }, tid);
  const refusalCodes = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => r.dataset.code || null));
  // The re-introduced defect A-screens-phone-1-3 guards (phone.js:207): while a gate stands, the card's primary keeps the filled Approve identity instead of Held.
  // Injected at the DOM so the store and the screen module stay untouched; a check that reads the primary while a refusal is on screen sees it.
  const APPROVE_STAYS_IRREVERSIBLE = `(() => {
    const swap = (root) => { for (const e of root.querySelectorAll('[data-testid$=".approve"].held')) { e.className = 'btn irreversible'; e.textContent = 'Approve'; } };
    new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) swap(n.parentElement || n); }).observe(document, { childList: true, subtree: true });
  })();`;

  return {
    // A-screens-phone-1-3 (screens-phone-1.mjs:116-146) claims to catch the Approve primary keeping class irreversible while needs_second /
    // blocked_same_person is on screen, but it drives Priya (frontdesk) and Sam (biller): since cb62618 store.js:353 pendingApprovalsFor()
    // returns [] for anyone without approve_second, so neither viewer is ever shown a card, approveBefore is null, no refusal reaches the DOM
    // and the predicate is false for every possible prototype. The same viewer choice blinds A-screens-phone-1-7 (biller Why text) and the
    // UI half of A-store-1-5 (biller pressing Approve).
    // Negative control: once A-screens-phone-1-3 drives an eligible approver to a reachable gate (owner + outage, or already_decided), the
    // injected defect makes it report true, originalStaysSilent is false and this check reports false.
    async 'S-harness-1'(b) {
      const captured = [];
      const ctxWithDefect = async (browser, ...rest) => { const r = await ctx(browser, ...rest); await r.p.addInitScript(APPROVE_STAYS_IRREVERSIBLE); return r; };
      const target = phone1({ ctx: ctxWithDefect, go, hop, press, click, txt, box, state, events, rec: (id, claim, rule, reproduced, evidence) => captured.push({ id, reproduced, evidence }) });
      await target['A-screens-phone-1-3'](b);
      const original = captured.find((r) => r.id === 'A-screens-phone-1-3') || null;
      const cases = original && original.evidence && original.evidence.cases ? original.evidence.cases.map((k) => ({ case: k.case, viewer: k.viewer && k.viewer.user, approveBefore: k.approveBefore, approveAfter: k.approveAfter, refusalDom: k.refusalDom, refusalEvents: k.refusalEvents, seqRange: k.seqRange })) : [];
      // The same defect on a path an eligible approver can actually reach: owner (approve_second) taps Approve during an outage.
      const { c, p } = await ctxWithDefect(b);
      let reachable = null;
      try {
        await go(p, '#/owner/close'); await hop(p, '#/phone/approvals');
        const pendingFor = await p.evaluate(() => { const S = window.__proto.state(); const u = Proto.store.currentUser(); return { viewer: u.name, entitlements: u.entitlements, pendingBeforeSim: Proto.store.pendingApprovalsFor().length, approvalsInStore: S.approvals.length }; });
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const visibleTo = await p.evaluate(() => ({ owner: Proto.store.pendingApprovalsFor(Proto.store.user('u-dr-1')).map((a) => a.id), frontdesk: Proto.store.pendingApprovalsFor(Proto.store.user('u-fd-1')).map((a) => a.id), biller: Proto.store.pendingApprovalsFor(Proto.store.user('u-bl-1')).map((a) => a.id) }));
        const before = await identity(p, 'phone.request.ar-1.approve');
        await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        reachable = { ...pendingFor, cardVisibleTo: visibleTo, approveBefore: before, refusalCodesOnScreen: await refusalCodes(p), approveUnderGate: await identity(p, 'phone.request.ar-1.approve'), refusalEvents: ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code })), seqRange: range(ev, seq0) };
      } finally { await c.close(); }
      const defectVisible = !!reachable && reachable.refusalCodesOnScreen.includes('outage') && !!reachable.approveUnderGate && reachable.approveUnderGate.irreversible && !reachable.approveUnderGate.held;
      const originalStaysSilent = !!original && original.reproduced === false && cases.length > 0 && cases.every((k) => k.approveBefore === null && k.refusalDom.length === 0);
      rec('S-harness-1', 'A-screens-phone-1-3 stays "no" while the Approve primary keeps class irreversible under an on-screen gate, because the viewers it drives (frontdesk, biller) are never shown a card and the predicate can never become true', 'harness — a check must be able to fail under the defect it names; screens-phone-1.mjs:116-146, store.js:353',
        defectVisible && originalStaysSilent, { originalResult: original ? original.reproduced : null, originalCases: cases, originalScored: original && original.evidence ? original.evidence.scored : null, reachablePathUnderSameDefect: reachable, defectVisible, originalStaysSilent });
    },

    // proto-check.mjs checkTargetsAt (:122-138) and checkContrast (:140-168) read only the landing state of each ROUTES entry; the PIN pad
    // (pin.key.*), the refusal control, the phone step-up keys and the palette exist only after a gated tap or a shortcut, so their 44 px size,
    // 8 px gaps and contrast are never measured. Under a CSS mutation shrinking those controls to 20 px, `proto-check --only targets` still PASSes.
    // Negative control: when every control this check reveals is also on a ROUTES landing state, or proto-check.mjs drives those states (its
    // source names pin.key / refusal.control / phone.stepup), notMeasured is empty and the check reports false.
    async 'S-harness-2'(b) {
      const source = src('../../proto-check.mjs');
      const personas = new Function('return ' + source.match(/const PERSONAS = (\[[^\]]*\]);/)[1])();
      const home = new Function('return ' + source.match(/const HOME = (\{[^}]*\});/)[1])();
      const routes = new Function('PERSONAS', 'HOME', 'return ' + source.match(/const ROUTES = (\[.*\]);/)[1])(personas, home);
      const FOCUSABLE = (source.match(/const FOCUSABLE = '([^']+)'/) || [])[1] || 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
      const visibleIds = (p) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && !e.disabled && !e.closest('[hidden]')).map((e) => e.getAttribute('data-testid')).filter(Boolean), FOCUSABLE);
      const sizes = (p, ids) => p.evaluate((ids) => ids.map((id) => { const e = document.querySelector(`[data-testid="${id}"]`); const r = e ? e.getBoundingClientRect() : null; return { id, w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null }; }), ids);
      // The landing sweep exactly as proto-check does it: one page, #/signin first, then every ROUTES hash in turn.
      const landing = new Set();
      { const { c, p } = await ctx(b);
        try { await go(p, '#/signin'); for (const r of routes) { await p.evaluate((h) => { location.hash = h; }, r); await p.waitForTimeout(150); for (const id of await visibleIds(p)) landing.add(id); } }
        finally { await c.close(); } }
      // The states a flow reaches with one or two taps; each in a fresh context so ?outage / ?device from the sweep do not leak in.
      const STATES = [
        { state: 'a-1044 shared desk after checkout.tender.card, checkout.post (pin_required)', start: '#/frontdesk/checkout/a-1044?device=shared', taps: ['checkout.tender.card', 'checkout.post', 'refusal.control'] },
        { state: 'owner on #/phone/approvals after phone.simulate, phone.request.ar-1.approve (step-up keypad)', start: '#/owner/close', hop: '#/phone/approvals', taps: ['phone.simulate', 'phone.request.ar-1.approve'] },
        { state: 'frontdesk board after topbar.author (PIN pad)', start: '#/frontdesk/board', taps: ['topbar.author'] },
        { state: 'frontdesk board after Control+k (palette)', start: '#/frontdesk/board', key: 'Control+k', taps: [] },
      ];
      const states = []; const notMeasured = []; let seqRange = null;
      for (const st of STATES) {
        const { c, p } = await ctx(b);
        try {
          await go(p, st.start); if (st.hop) await hop(p, st.hop);
          const seq0 = await lastSeq(p);
          if (st.key) { await p.keyboard.press(st.key); await p.waitForTimeout(150); }
          for (const t of st.taps) await click(p, t);
          await p.waitForTimeout(200);
          const ids = await visibleIds(p);
          const fresh = ids.filter((id) => !landing.has(id));
          const ev = await after(p, seq0);
          states.push({ state: st.state, refusalCodes: await refusalCodes(p), visibleIds: ids.length, notOnAnyLanding: fresh, sizesNow: await sizes(p, fresh), seqRange: range(ev, seq0) });
          for (const id of fresh) if (!notMeasured.some((x) => x.id === id)) notMeasured.push({ id, firstSeenIn: st.state });
          seqRange = seqRange ? [seqRange[0], range(ev, seq0)[1]] : range(ev, seq0);
        } finally { await c.close(); }
      }
      const namedInProtoCheck = ['pin.key', 'refusal.control', 'phone.stepup', 'palette', 'topbar.author'].filter((k) => source.includes(k));
      const drivesStates = /page\.(click|focus)\(|keyboard\.press\(/.test(source.slice(source.indexOf('async function checkTargetsAt'), source.indexOf('async function checkOverflow')));
      const reproduced = notMeasured.length > 0 && namedInProtoCheck.length === 0 && !drivesStates;
      rec('S-harness-2', 'proto-check targets/contrast never measure the PIN pad keys, the refusal control, the step-up keypad or the palette: they appear only after a gated tap or a shortcut and every ROUTES entry is read in its landing state', 'harness — a 44 px / contrast sweep must reach every control a flow shows; proto-check.mjs:122-168',
        reproduced, { routesSwept: routes, landingIdCount: landing.size, statesDriven: states, notMeasuredCount: notMeasured.length, notMeasured, namedInProtoCheck, targetsSectionDrivesStates: drivesStates, seqRangePerState: states.map((s) => s.seqRange) });
    },

    // proto-check.mjs runFlow (:71-96) counts `taps` as the number of {press} steps it executed, a constant of scripts/lib/flows.mjs, and
    // compares that constant with the flow's own budgetTaps (:105); the tap count the page records under CONTRACTS §5 (evTaps, :94) is stored
    // but never compared, so `taps > budgetTaps` cannot become true for any prototype. CONTRACTS §7 flow 3 also names enc.tooth.30 as tap 3,
    // which flows.mjs does not press.
    // Negative control: when proto-check compares the page-recorded taps (evTaps) with budgetTaps, or a flow's press count can exceed its budget,
    // budgetIsTautology is false and the check reports false.
    async 'S-harness-3'(b) {
      const source = src('../../proto-check.mjs');
      const contracts = src('../../../prototype/CONTRACTS.md');
      const s7 = contracts.slice(contracts.indexOf('## 7.'), contracts.indexOf('## 8.'));
      const perFlow = FLOWS.map((f) => ({ id: f.id, budgetTaps: f.budgetTaps, pressSteps: f.steps.filter((s) => s.press).length, optionalPressSteps: f.steps.filter((s) => s.press && s.optional).length }));
      const constantWithinBudget = perFlow.every((f) => f.pressSteps <= f.budgetTaps);
      const comparesScriptCount = /r\.taps > flow\.budgetTaps/.test(source);
      const comparesPageCount = /evTaps\s*>/.test(source) || /evTaps\s*!==?\s*(r\.)?taps/.test(source);
      const s7ChartIds = [...s7.matchAll(/`(enc\.[^`]+)`/g)].map((m) => m[1]);
      const flowChartIds = FLOWS.find((f) => f.id === 'chart').steps.filter((s) => s.press).map((s) => s.press);
      const inContractNotInFlow = s7ChartIds.filter((id) => !flowChartIds.includes(id));
      // Run the checkout flow the way proto-check does and read both counts, so the evidence carries what the page actually recorded.
      const { c, p } = await ctx(b);
      let run = null;
      try {
        const flow = FLOWS.find((f) => f.id === 'checkout');
        await go(p, flow.start); await p.evaluate(() => window.__proto.reset()); await p.evaluate((h) => { location.hash = h; }, flow.start); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        let taps = 0;
        for (const st of flow.steps) {
          if (st.press) { const sel = `[data-testid="${st.press}"]`; if (!(await p.$(sel))) { if (st.optional) continue; break; } await p.focus(sel); await p.keyboard.press('Enter'); taps++; await p.waitForTimeout(80); }
          else if (st.fill) { await p.focus(`[data-testid="${st.fill[0]}"]`); await p.keyboard.type(st.fill[1]); }
        }
        const ev = await after(p, seq0);
        const evTaps = ev.filter((e) => (e.kind === 'click' && !e.synthetic) || (e.kind === 'key' && (e.key === 'Enter' || e.key === ' ') && e.testid && !e.field)).length;
        const posted = await p.evaluate(() => window.__proto.state().ledger.some((e) => e.kind === 'patient_payment' && e.patientId === 'p-303' && e.amountCents === -4400));
        run = { flow: flow.id, budgetTaps: flow.budgetTaps, scriptTaps: taps, pageRecordedTaps: evTaps, paymentPosted: posted, seqRange: range(ev, seq0) };
      } finally { await c.close(); }
      const budgetIsTautology = constantWithinBudget && comparesScriptCount && !comparesPageCount;
      rec('S-harness-3', 'proto-check\'s click-budget assertion compares a flows.mjs constant with a flows.mjs constant: taps is the number of press steps the script itself ran, evTaps (the §5 tap count the page recorded) is never compared, so no prototype can fail the budget', 'harness / CONTRACTS §5, §7 — the budget must be checked against what the page recorded; proto-check.mjs:85, :94, :105',
        budgetIsTautology, { perFlow, constantWithinBudget, comparesScriptCount, comparesPageCount, s7ChartIds, flowChartIds, inContractNotInFlow, checkoutRun: run });
    },
  };
};
