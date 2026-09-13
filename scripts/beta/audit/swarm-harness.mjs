// Swarm round, lens "harness": checks on the harness itself (scripts/beta/audit/*.mjs, scripts/proto-check.mjs, scripts/lib/flows.mjs).
// Each S-harness check re-introduces a defect an existing guard claims to catch — on a throw-away copy of prototype/ or through
// page.addInitScript, never by editing the repo — and measures that the guard stays silent while an honest measurement sees the defect.
// Default position is NOT reproduced: a check reports true only when the guard is proved silent AND the defect is proved visible.
// Each check closes its browser context and removes its copy in `finally` so one failure cannot hang the run or leave files behind.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import phone1 from './screens-phone-1.mjs';
import { FLOWS } from '../../lib/flows.mjs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec, FILE }) => {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const PROTO_CHECK = path.join(ROOT, 'scripts', 'proto-check.mjs');
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const identity = (p, tid) => p.evaluate((tid) => {
    const e = document.querySelector(`[data-testid="${tid}"]`); if (!e) return null;
    return { label: e.textContent.trim(), className: e.className, held: e.classList.contains('held'), irreversible: e.classList.contains('irreversible') };
  }, tid);
  const refusalCodes = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => r.dataset.code || null));
  // A throw-away copy of prototype/ with one mutation applied; proto-check is pointed at it with --url so the repo is never edited.
  const mutatedCopy = (mutate) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-mut-'));
    fs.cpSync(path.join(ROOT, 'prototype'), dir, { recursive: true });
    mutate(dir);
    return dir;
  };
  const runProtoCheck = (only, dir) => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-check-out-'));
    try {
      const r = spawnSync(process.execPath, [PROTO_CHECK, '--only', only, '--url', 'file://' + path.join(dir, 'index.html'), '--out', out], { encoding: 'utf8', env: process.env, timeout: 240000 });
      const line = (r.stdout || '').split('\n').find((l) => l.startsWith(only)) || null;
      const reportPath = path.join(out, 'report.json');
      const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
      const section = report && report.results ? report.results[only] : null;
      return { exit: r.status, line, pass: r.status === 0 && /PASS/.test(line || ''), failures: section ? section.failures : null, detail: section ? section.detail : null, stderr: (r.stderr || '').slice(0, 400) };
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  };
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
    // UI half of A-store-1-5 (biller pressing Approve); both are run here and their own evidence is carried (no press, no card).
    // Negative control: once A-screens-phone-1-3 drives an eligible approver to a reachable gate (owner + outage, or already_decided), the
    // injected defect makes it report true (or crash, which is an honest outcome), originalStaysSilent is false and this check reports false.
    async 'S-harness-1'(b) {
      const captured = [];
      const ctxWithDefect = async (browser, ...rest) => { const r = await ctx(browser, ...rest); await r.p.addInitScript(APPROVE_STAYS_IRREVERSIBLE); return r; };
      const capRec = (id, claim, rule, reproduced, evidence) => captured.push({ id, reproduced, evidence });
      const target = phone1({ ctx: ctxWithDefect, go, hop, press, click, txt, box, state, events, rec: capRec, FILE });
      let originalCrash = null;
      try { await target['A-screens-phone-1-3'](b); } catch (e) { originalCrash = e.message; }
      const original = captured.find((r) => r.id === 'A-screens-phone-1-3') || null;
      const cases = original && original.evidence && Array.isArray(original.evidence.cases) ? original.evidence.cases.map((k) => ({ case: k.case, viewer: k.viewer && k.viewer.user, approveBefore: k.approveBefore, approveAfter: k.approveAfter, refusalDom: k.refusalDom, refusalEvents: k.refusalEvents, seqRange: k.seqRange })) : [];
      // The sibling checks that use the same biller viewer: what did they actually get to press / read?
      const sibling = {};
      try { await target['A-screens-phone-1-7'](b); } catch (e) { sibling['A-screens-phone-1-7'] = { crash: e.message }; }
      const s17 = captured.find((r) => r.id === 'A-screens-phone-1-7');
      if (s17) sibling['A-screens-phone-1-7'] = { reproduced: s17.reproduced, viewer: s17.evidence && s17.evidence.viewer, refusalDom: s17.evidence && s17.evidence.refusalDom, gateMatches: s17.evidence && s17.evidence.gateMatches, whyOpened: s17.evidence && s17.evidence.whyOpened, seqRange: s17.evidence && s17.evidence.seqRange };
      try {
        const store1 = (await import('./store-1.mjs')).default({ ctx, go, hop, press, click, txt, box, state, events, rec: capRec, FILE });
        await store1['A-store-1-5'](b);
        const s15 = captured.find((r) => r.id === 'A-store-1-5');
        if (s15) sibling['A-store-1-5'] = { reproduced: s15.reproduced, approvePressed: s15.evidence && s15.evidence.approvePressed, renderedRefusals: s15.evidence && s15.evidence.renderedRefusals, codesRaised: s15.evidence && s15.evidence.codesRaised, persona: s15.evidence && s15.evidence.persona };
      } catch (e) { sibling['A-store-1-5'] = { crash: e.message }; }
      // The same defect on a path an eligible approver can actually reach: owner (approve_second) taps Approve during an outage.
      const { c, p } = await ctxWithDefect(b);
      let reachable = null;
      try {
        await go(p, '#/owner/close'); await hop(p, '#/phone/approvals');
        const pendingFor = await p.evaluate(() => { const S = window.__proto.state(); const u = Proto.store.currentUser(); return { viewer: u.name, entitlements: u.entitlements, pendingBeforeSim: Proto.store.pendingApprovalsFor().length, approvalsInStore: S.approvals.length }; });
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const visibleTo = await p.evaluate(() => ({ owner: Proto.store.pendingApprovalsFor(Proto.store.user('u-dr-1')).map((a) => a.id), frontdesk: Proto.store.pendingApprovalsFor(Proto.store.user('u-fd-1')).map((a) => a.id), biller: Proto.store.pendingApprovalsFor(Proto.store.user('u-bl-1')).map((a) => a.id) }));
        const cardsRendered = await p.evaluate(() => ({ owner: document.querySelectorAll('.ph-card').length }));
        const before = await identity(p, 'phone.request.ar-1.approve');
        // The refusal the original check wanted (blocked_same_person) is reachable from the store, just not from a card the biller is shown.
        const sameperson = await p.evaluate(() => { const r = Proto.store.decideApproval('ar-1', 'u-bl-1', 'approve', true, ''); return r && { ok: r.ok, code: r.code || null, verb: r.verb || null, control: r.control || null }; });
        await p.evaluate(() => window.__proto.set({ outage: true })); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        reachable = { ...pendingFor, cardVisibleTo: visibleTo, cardsRendered, approveBefore: before, refusalCodesOnScreen: await refusalCodes(p), approveUnderGate: await identity(p, 'phone.request.ar-1.approve'), refusalEvents: ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code })), seqRange: range(ev, seq0), directBillerDecide: sameperson };
      } finally { await c.close(); }
      const defectVisible = !!reachable && reachable.refusalCodesOnScreen.includes('outage') && !!reachable.approveUnderGate && reachable.approveUnderGate.irreversible && !reachable.approveUnderGate.held;
      // Silent = the original ran to completion and filed a refutation ("no") even though the defect it guards was live. A crash or a true is honest.
      const originalStaysSilent = originalCrash === null && !!original && original.reproduced === false;
      const originalSawNoCard = cases.length > 0 && cases.every((k) => k.approveBefore === null && Array.isArray(k.refusalDom) && k.refusalDom.length === 0);
      rec('S-harness-1', 'A-screens-phone-1-3 files "no" while the Approve primary keeps class irreversible under an on-screen gate, because the viewers it drives (frontdesk, biller) are never shown a card and the predicate can never become true', 'harness — a check must be able to fail under the defect it names; screens-phone-1.mjs:116-146, store.js:353',
        defectVisible && originalStaysSilent, { originalResult: original ? original.reproduced : null, originalCrash, originalSawNoCard, originalCases: cases, originalScored: original && original.evidence ? original.evidence.scored : null, siblingChecksSameViewer: sibling, reachablePathUnderSameDefect: reachable, defectVisible, originalStaysSilent });
    },

    // proto-check.mjs checkTargetsAt (:122-138) and checkContrast (:140-168) read only the landing state of each ROUTES entry; the PIN pad
    // (pin.key.*), the refusal control, the phone step-up keys and the palette exist only after a gated tap or a shortcut, so their 44 px size,
    // 8 px gaps and contrast are never measured. Measured, not inferred from source: a copy of prototype/ whose components.css shrinks those
    // controls to 20 px still gets `targets PASS 0` from proto-check, while the same shrink applied to a landing control (board.card.a-1044.checkout)
    // makes it FAIL; on the mutated copy the shrunken controls are visible and 20 px tall one or two taps into the flows.
    // Negative control: when proto-check's targets sweep drives those states (a STATES list that taps topbar.author, checkout.tender.card+post,
    // phone.simulate+approve, Control+k), the mutation run FAILs, mutationPasses is false and this check reports false.
    async 'S-harness-2'(b) {
      const source = src('scripts/proto-check.mjs');
      const personas = new Function('return ' + source.match(/const PERSONAS = (\[[^\]]*\]);/)[1])();
      const home = new Function('return ' + source.match(/const HOME = (\{[^}]*\});/)[1])();
      const routes = new Function('PERSONAS', 'HOME', 'return ' + source.match(/const ROUTES = (\[.*\]);/)[1])(personas, home);
      const FOCUSABLE = (source.match(/const FOCUSABLE = '([^']+)'/) || [])[1] || 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
      const visibleIds = (p) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && !e.disabled && !e.closest('[hidden]')).map((e) => e.getAttribute('data-testid')).filter(Boolean), FOCUSABLE);
      const sizes = (p, ids) => p.evaluate((ids) => ids.map((id) => { const e = document.querySelector(`[data-testid="${id}"]`); const r = e ? e.getBoundingClientRect() : null; return { id, w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null }; }), ids);
      const SHRINK = (sel) => `\n${sel} { min-height:20px !important; height:20px !important; min-width:20px !important; padding:0 !important; }\n`;
      const HIDDEN = '[data-testid^="pin.key."], [data-testid="refusal.control"], [data-testid^="phone.stepup."], [data-testid="palette.close"], [data-testid="checkout.pin"]';
      const LANDING = '[data-testid="board.card.a-1044.checkout"]';
      const dir = mutatedCopy((d) => fs.appendFileSync(path.join(d, 'css', 'components.css'), SHRINK(HIDDEN)));
      let mutation = null, control = null; const states = []; const notMeasured = []; const landing = new Set();
      try {
        mutation = runProtoCheck('targets', dir);
        // The landing sweep exactly as proto-check does it (one page, #/signin first, every ROUTES hash), on the mutated copy.
        const url = 'file://' + path.join(dir, 'index.html');
        const goCopy = async (p, hash) => { await p.goto(url + hash); await p.waitForFunction(() => window.__proto && window.__proto.ready); await p.waitForTimeout(120); };
        { const { c, p } = await ctx(b);
          try { await goCopy(p, '#/signin'); for (const r of routes) { await p.evaluate((h) => { location.hash = h; }, r); await p.waitForTimeout(150); for (const id of await visibleIds(p)) landing.add(id); } }
          finally { await c.close(); } }
        // The states a flow reaches with one or two taps; each in a fresh context so ?outage / ?device from the sweep do not leak in.
        const STATES = [
          { state: 'a-1044 shared desk after checkout.tender.card, checkout.post (pin_required)', start: '#/frontdesk/checkout/a-1044?device=shared', taps: ['checkout.tender.card', 'checkout.post', 'refusal.control'] },
          { state: 'owner on #/phone/approvals after phone.simulate, phone.request.ar-1.approve (step-up keypad)', start: '#/owner/close', hop: '#/phone/approvals', taps: ['phone.simulate', 'phone.request.ar-1.approve'] },
          { state: 'frontdesk board after topbar.author (PIN pad)', start: '#/frontdesk/board', taps: ['topbar.author'] },
          { state: 'frontdesk board after Control+k (palette)', start: '#/frontdesk/board', key: 'Control+k', taps: [] },
        ];
        for (const st of STATES) {
          const { c, p } = await ctx(b);
          try {
            await goCopy(p, st.start); if (st.hop) await hop(p, st.hop);
            const seq0 = await lastSeq(p);
            if (st.key) { await p.keyboard.press(st.key); await p.waitForTimeout(150); }
            for (const t of st.taps) await click(p, t);
            await p.waitForTimeout(200);
            const ids = await visibleIds(p);
            const fresh = ids.filter((id) => !landing.has(id));
            const ev = await after(p, seq0);
            const sz = await sizes(p, fresh);
            states.push({ state: st.state, refusalCodes: await refusalCodes(p), visibleIds: ids.length, notOnAnyLanding: fresh, sizesOnMutatedCopy: sz, seqRange: range(ev, seq0) });
            for (const s of sz) if (!notMeasured.some((x) => x.id === s.id)) notMeasured.push({ ...s, firstSeenIn: st.state });
          } finally { await c.close(); }
        }
        // Positive control on the same copy: the same shrink on a landing control is caught.
        fs.appendFileSync(path.join(dir, 'css', 'components.css'), SHRINK(LANDING));
        control = runProtoCheck('targets', dir);
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
      const shrunkYetVisible = notMeasured.filter((x) => x.h !== null && x.h < 44);
      const mutationPasses = !!mutation && mutation.pass === true && Array.isArray(mutation.failures) && mutation.failures.length === 0;
      const controlFails = !!control && control.pass === false && Array.isArray(control.failures) && control.failures.some((f) => /a-1044\.checkout/.test(f));
      const reproduced = mutationPasses && controlFails && shrunkYetVisible.length > 0;
      rec('S-harness-2', 'proto-check targets never measure the PIN pad keys, the refusal control, the step-up keypad or the palette: a copy of the prototype with those controls at 20 px still gets `targets PASS 0`, while the same 20 px on a landing control FAILs, because every ROUTES entry is read in its landing state and nothing is tapped', 'harness / docs/04 "44 px targets with 8 px gaps" — a 44 px sweep must reach every control a flow shows; proto-check.mjs:122-168',
        reproduced, { mutationRun: mutation, positiveControlRun: control ? { exit: control.exit, line: control.line, failureCount: Array.isArray(control.failures) ? control.failures.length : null, sample: Array.isArray(control.failures) ? control.failures.slice(0, 3) : null } : null, routesSwept: routes.length, landingIdCount: landing.size, statesDriven: states, notMeasuredCount: notMeasured.length, shrunkYetVisibleNotOnAnyLanding: shrunkYetVisible, mutationPasses, controlFails });
    },

    // proto-check.mjs runFlow (:71-96) counts `taps` as the number of {press} steps it executed, a constant of scripts/lib/flows.mjs, and
    // compares that constant with the flow's own budgetTaps (:105); the tap count the page records under CONTRACTS §5 (evTaps, :94) is stored
    // but never compared. Measured: a copy of the prototype whose page records one extra non-synthetic click per activation (evTaps = 2 x taps,
    // above every budget) still gets `flows PASS 0` and its report carries evTaps > budgetTaps for all five flows. CONTRACTS §7 flow 3 also names
    // enc.tooth.30 as tap 3, which flows.mjs does not press.
    // Negative control: when checkFlows compares the page-recorded taps (evTaps) with budgetTaps, the mutated copy FAILs five flows and this
    // check reports false.
    async 'S-harness-3'(b) {
      const source = src('scripts/proto-check.mjs');
      const contracts = src('prototype/CONTRACTS.md');
      const s7 = contracts.slice(contracts.indexOf('## 7.'), contracts.indexOf('## 8.'));
      const perFlow = FLOWS.map((f) => ({ id: f.id, budgetTaps: f.budgetTaps, pressSteps: f.steps.filter((s) => s.press).length, optionalPressSteps: f.steps.filter((s) => s.press && s.optional).length }));
      const constantWithinBudget = perFlow.every((f) => f.pressSteps <= f.budgetTaps);
      const comparesScriptCount = /r\.taps > flow\.budgetTaps/.test(source);
      const comparesPageCount = /evTaps\s*>/.test(source) || /evTaps\s*!==?\s*(r\.)?taps/.test(source) || /Math\.max\([^)]*evTaps/.test(source);
      const s7ChartIds = [...s7.matchAll(/`(enc\.[^`]+)`/g)].map((m) => m[1]);
      const flowChartIds = FLOWS.find((f) => f.id === 'chart').steps.filter((s) => s.press).map((s) => s.press);
      const inContractNotInFlow = s7ChartIds.filter((id) => !flowChartIds.includes(id));
      // The mutation: every activation also logs a second, non-synthetic click under §5, so the page's tap count doubles while behaviour is unchanged.
      const EXTRA_TAP = '<script>document.addEventListener("click", (e) => { const ev = window.__events; if (!ev) return; const el = e.target && e.target.closest ? e.target.closest("[data-testid]") : null; ev.push({ seq: ev.length ? ev[ev.length - 1].seq + 1 : 1, t: performance.now(), kind: "click", route: location.hash.slice(1), testid: (el && el.getAttribute("data-testid")) || "extra.confirm" }); }, true);</script>';
      const dir = mutatedCopy((d) => { const f = path.join(d, 'index.html'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('<head>', '<head>' + EXTRA_TAP)); });
      let mutation = null; let counts = null; let recorded = null;
      try {
        mutation = runProtoCheck('flows', dir);
        counts = mutation && mutation.detail ? Object.fromEntries(Object.entries(mutation.detail).map(([id, d]) => [id, { taps: d.taps, evTaps: d.evTaps, budgetTaps: (FLOWS.find((f) => f.id === id) || {}).budgetTaps, problems: d.problems }])) : null;
        // Independent read of the same copy: run the checkout flow as proto-check does and count §5 taps from window.__events directly.
        const { c, p } = await ctx(b);
        try {
          const flow = FLOWS.find((f) => f.id === 'checkout');
          await p.goto('file://' + path.join(dir, 'index.html') + flow.start); await p.waitForFunction(() => window.__proto && window.__proto.ready); await p.waitForTimeout(120);
          const seq0 = await lastSeq(p);
          let taps = 0;
          for (const st of flow.steps) {
            if (st.press) { const sel = `[data-testid="${st.press}"]`; if (!(await p.$(sel))) { if (st.optional) continue; break; } await p.focus(sel); await p.keyboard.press('Enter'); taps++; await p.waitForTimeout(80); }
            else if (st.fill) { await p.focus(`[data-testid="${st.fill[0]}"]`); await p.keyboard.type(st.fill[1]); }
          }
          const ev = await after(p, seq0);
          const evTaps = ev.filter((e) => (e.kind === 'click' && !e.synthetic) || (e.kind === 'key' && (e.key === 'Enter' || e.key === ' ') && e.testid && !e.field)).length;
          const posted = await p.evaluate(() => window.__proto.state().ledger.some((e) => e.kind === 'patient_payment' && e.patientId === 'p-303' && e.amountCents === -4400));
          recorded = { flow: flow.id, budgetTaps: flow.budgetTaps, scriptTaps: taps, pageRecordedTaps: evTaps, paymentPosted: posted, seqRange: range(ev, seq0) };
        } finally { await c.close(); }
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
      const overBudgetYetPass = !!mutation && mutation.pass === true && Array.isArray(mutation.failures) && mutation.failures.length === 0 && !!counts && Object.values(counts).length === FLOWS.length && Object.values(counts).every((k) => typeof k.evTaps === 'number' && k.evTaps > k.budgetTaps && k.problems.length === 0);
      const reproduced = overBudgetYetPass && comparesScriptCount && !comparesPageCount;
      rec('S-harness-3', 'proto-check\'s click-budget assertion compares a flows.mjs constant with a flows.mjs constant: a prototype whose page records twice the §5 taps (every flow over budget) still gets `flows PASS 0`, because taps is the number of press steps the script ran and evTaps is never compared', 'harness / CONTRACTS §5, docs/04 "budgets are measured on that basis" — the budget must be checked against what the page recorded; proto-check.mjs:85, :94, :105',
        reproduced, { mutationRun: { exit: mutation && mutation.exit, line: mutation && mutation.line, failures: mutation && mutation.failures }, perFlowOnMutatedCopy: counts, independentCheckoutRun: recorded, perFlowConstants: perFlow, constantWithinBudget, comparesScriptCount, comparesPageCount, s7ChartIds, flowChartIds, inContractNotInFlow, overBudgetYetPass });
    },
  };
};
