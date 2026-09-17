/* Swarm 2 · harness-honesty. Meta-checks: each one runs an existing audit check through the same helpers it was
   written against — with click/press/txt instrumented for controls that were not on the page, the refusal codes and
   approval rows read back before the context closes, and (where the defect has since been fixed) an addInitScript
   monkey-patch that re-introduces the very defect the check claims to guard — and then measures the same breach
   directly. A check that stays "no" beside a measured breach is blind, and that is the finding. Every check here
   reports false once the blind check (or the product defect it hid) is corrected; the negative control is stated
   above each one. Nothing under prototype/ is touched: mutations live in page init scripts or in a temporary copy
   under os.tmpdir() that is removed in finally. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

export default (H) => {
  const { ctx, go, hop, press, click, txt, state, events, rec } = H;
  const fill = (p, tid, v) => p.fill(`[data-testid="${tid}"]`, v);
  const has = (p, tid) => p.evaluate((t) => !!document.querySelector('[data-testid="' + t + '"]'), tid);
  const attr = (p, tid, name) => p.evaluate(([t, n]) => { const e = document.querySelector('[data-testid="' + t + '"]'); return e ? e.getAttribute(n) : null; }, [tid, name]);
  const refusalsSince = (ev, seq0) => ev.filter((e) => e.kind === 'refusal' && e.seq > seq0).map((e) => e.code);
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const refusalOnScreen = (p) => p.evaluate(() => { const r = document.querySelector('.refusal'); return r ? { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() } : null; });

  /* Run one existing check through instrumented helpers. `missing` lists every click/press/txt whose control was not
     on the page; `refusals`/`approvals` are read from the page as each context closes; `init` is an addInitScript
     source string that re-introduces a defect. Outcome is the word reproduce.mjs would print. */
  const runTarget = async (b, file, id, init) => {
    const mod = await import(pathToFileURL(path.join(HERE, file)).href);
    const results = []; const missing = []; const refusals = []; const approvals = [];
    const wrap = (fn, kind) => async (p, tid, ...rest) => { const ok = await fn(p, tid, ...rest); if (ok === false || ok === null) missing.push(kind + ':' + tid); return ok; };
    const helpers = {
      ...H,
      ctx: async (...a) => {
        const r = await ctx(...a);
        if (init) await r.p.addInitScript(init);
        const close = r.c.close.bind(r.c);
        r.c.close = async () => {
          try {
            const snap = await r.p.evaluate(() => ({ refusals: (window.__events || []).filter((e) => e.kind === 'refusal').map((e) => e.code), approvals: window.__proto ? window.__proto.state().approvals.map((x) => [x.id, x.status]) : [] }));
            refusals.push(...snap.refusals); approvals.push(...snap.approvals);
          } catch (e) { refusals.push('unreadable:' + e.message.slice(0, 40)); }
          await close();
        };
        return r;
      },
      click: wrap(H.click, 'click'), press: wrap(H.press, 'press'), txt: wrap(H.txt, 'txt'),
      clickOnce: wrap(H.clickOnce, 'clickOnce'), pressOnce: wrap(H.pressOnce, 'pressOnce'),
      rec: (rid, claim, rule, reproduced, evidence) => { results.push({ id: rid, claim, rule, reproduced, evidence }); },
    };
    const checks = mod.default(helpers);
    let error = null;
    try { await checks[id](b); } catch (e) { error = e.message; }
    const r = results.find((x) => x.id === id) || null;
    return { id, outcome: error ? 'CRASH' : (r ? (r.reproduced ? 'YES' : 'no') : 'NOTHING'), missing, refusals, approvals, error, evidenceKeys: r ? Object.keys(r.evidence || {}) : null };
  };

  /* Which checks in the audit directory contain `pattern` (a RegExp) — split on the check headers. */
  const checksMatching = (test) => {
    const out = [];
    for (const f of fs.readdirSync(HERE).filter((x) => x.endsWith('.mjs') && !x.startsWith('swarm2-'))) {
      const src = fs.readFileSync(path.join(HERE, f), 'utf8');
      const parts = src.split(/async\s+'([^']+)'\s*\(/);
      for (let i = 1; i < parts.length; i += 2) if (test(parts[i + 1] || '')) out.push(parts[i]);
    }
    return out;
  };

  return {
    // S2-harness-honesty-1 · S-regress-money-2 (swarm-regress-money.mjs) claims a checkout write-off on a-1046 reaches the phone
    // as "$0.00 still open" and cannot be approved. Its own root cause — balances().patientDue is $0 for a visit whose charges
    // post at checkout — now fires one step earlier: store.js:320 caps the write-off at min(est − payment, patientDue) = 0, so
    // Post refuses "Remove the write-off — nothing left" beside a screen that reads "$168.00 est.", no request is ever raised,
    // and the check bails out with `req: null` and prints "no". The defect the check was written for is live and unmeasured.
    // Negative control: once the cap counts the visit's not-yet-charged fees, Post on a-1046 with $158.00 cash + $10.00 hardship
    // raises a write-off request (needs_second or a pending approval) instead of amount_required, and this check reports false.
    async 'S2-harness-honesty-1'(b) {
      const target = await runTarget(b, 'swarm-regress-money.mjs', 'S-regress-money-2');
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        const before = await p.evaluate(() => ({ est: [...document.querySelectorAll('.co-est')].map((e) => e.textContent.trim()).pop() || null, patientDue: Proto.store.balances('p-305').patientDue, ledgerRows: window.__proto.state().ledger.filter((e) => e.patientId === 'p-305').length, status: Proto.store.appt('a-1046').status }));
        await click(p, 'checkout.tender.cash'); await fill(p, 'checkout.amount', '158.00');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '10.00'); await click(p, 'checkout.writeoff.reason.hardship');
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const refusal = await refusalOnScreen(p);
        const codes = refusalsSince(await events(p), seq0);
        const direct = await p.evaluate(() => { const r = Proto.store.postCheckout('a-1046', { tender: 'cash', amountCents: 15800, writeoffCents: 1000, writeoffReason: 'hardship', decision: 'collect' }); return { ok: r.ok, code: r.code || null, verb: r.verb || null }; });
        const S = await state(p);
        const evidence = { target, screenBefore: before, refusal, refusalCodesSincePost: codes, directVerb: direct, approvals: S.approvals.length, ledgerRowsAfter: S.ledger.filter((e) => e.patientId === 'p-305').length, pageErrors: errs };
        const reproduced = target.outcome === 'no' && !!refusal && refusal.code === 'amount_required' && /nothing left/i.test(refusal.verb)
          && /\$168\.00/.test(before.est || '') && before.patientDue === 0 && direct.code === 'amount_required' && S.approvals.length === 0;
        rec('S2-harness-honesty-1', 'S-regress-money-2 prints "no" while its own defect is live: Post on a-1046 ($158.00 cash + $10.00 hardship write-off against a "$168.00 est." portion) is refused amount_required "nothing left" because store.js:320 caps the write-off at balances().patientDue = 0 before the checkout posts the charges, so no request exists for the check to measure',
          'A2/C5 · store.js:320 writeoffCap ceiling; swarm-regress-money.mjs S-regress-money-2 early exit', reproduced, evidence);
      } finally { await c.close(); }
    },

    // S2-harness-honesty-2 · swarm-checkout-screen.mjs S-checkout-screen-2 and -3 share requestWriteoff()/approveOnPhone(). The
    // helper leaves the prefilled $410.00 in checkout.amount and adds a $200.00 write-off, which store.js:320 refuses
    // amount_required (410 + 200 > the $410 portion), so no approval is raised; and approveOnPhone types 1-2-3-4 where the
    // owner's seeded PIN is 2-4-6-8, so even a raised request would be refused pin_no_match. Both checks gate on `approved`
    // and can only ever print "no". The same flow with $210.00 typed and 2-4-6-8 reaches an approved ar-1.
    // Negative control: when the helper types an amount that leaves room for the write-off and the owner's real PIN, the two
    // target runs create and approve ar-1 (approvals non-empty, no amount_required), and this check reports false.
    async 'S2-harness-honesty-2'(b) {
      const t2 = await runTarget(b, 'swarm-checkout-screen.mjs', 'S-checkout-screen-2');
      const t3 = await runTarget(b, 'swarm-checkout-screen.mjs', 'S-checkout-screen-3');
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        const prefill = await p.$eval('[data-testid="checkout.amount"]', (e) => e.value).catch(() => null);
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.amount', '210');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '200'); await click(p, 'checkout.writeoff.reason.courtesy');
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const afterPost = await refusalOnScreen(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const req = await p.evaluate(() => { const a = window.__proto.state().approvals.slice(-1)[0]; return a ? { id: a.id, status: a.status, amountCents: a.amountCents } : null; });
        let approved = null; let wrongPin = null;
        if (req) {
          await hop(p, '#/owner/phone'); await p.waitForTimeout(200);
          await click(p, 'phone.request.' + req.id + '.approve');
          for (const d of ['1', '2', '3', '4']) await click(p, 'phone.stepup.' + d);
          const seqA = await lastSeq(p);
          await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
          wrongPin = refusalsSince(await events(p), seqA);
          await click(p, 'refusal.control'); await p.waitForTimeout(150);
          if (!(await has(p, 'phone.stepup.2'))) { await click(p, 'phone.request.' + req.id + '.approve'); }
          for (const d of ['2', '4', '6', '8']) await click(p, 'phone.stepup.' + d);
          await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
          approved = await p.evaluate((id) => { const a = window.__proto.state().approvals.find((x) => x.id === id); return a ? { status: a.status, decidedBy: a.decidedBy || null } : null; }, req.id);
        }
        const evidence = { targets: [t2, t3], helperPrefillAmount: prefill, correctedSetup: { afterPost: afterPost && afterPost.code, request: req, refusalsWithPin1234: wrongPin, afterPin2468: approved }, pageErrors: errs };
        const targetsDead = [t2, t3].every((t) => t.outcome === 'no' && t.approvals.length === 0 && t.refusals.includes('amount_required'));
        const reproduced = targetsDead && !!req && req.status === 'pending' && Array.isArray(wrongPin) && wrongPin.includes('pin_no_match') && !!approved && approved.status === 'approved';
        rec('S2-harness-honesty-2', 'S-checkout-screen-2 and S-checkout-screen-3 can only print "no": their shared setup keeps the $410.00 prefill beside a $200.00 write-off (refused amount_required, no approval raised) and types owner PIN 1234 where the seed is 2468 (pin_no_match), while the same flow typed correctly reaches an approved ar-1',
          'harness honesty · swarm-checkout-screen.mjs requestWriteoff/approveOnPhone; seed.js owner PIN 2468', reproduced, evidence);
      } finally { await c.close(); }
    },

    // S2-harness-honesty-3 · dailyclose.js:188 now opens the grade tile at rest whenever the day is not tied (the seed has v-1
    // open), so `click(p, 'close.tied.tile')` — the opener every earlier check used — collapses it, and the close.location.* /
    // close.variance.* controls those checks then press are gone. S-moneydesk-close-4 (variance clear leaves the Card gap) is
    // run as a witness: its clear click is recorded as missing and it prints "no" without measuring anything.
    // Negative control: when the tile ships collapsed, or the checks open it only if aria-expanded is false, the variance
    // controls are still present after the setup step, the witness's missing list is empty, and this check reports false.
    async 'S2-harness-honesty-3'(b) {
      const witness = await runTarget(b, 'swarm-moneydesk-close.mjs', 'S-moneydesk-close-4');
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const read = async () => ({ expanded: await attr(p, 'close.tied.tile', 'aria-expanded'), match: await has(p, 'close.variance.v-1.match'), clear: await has(p, 'close.variance.v-1.clear'), loc3: await has(p, 'close.location.loc-3') });
        const atRest = await read();
        await click(p, 'close.tied.tile'); await p.waitForTimeout(150);
        const afterOpenerClick = await read();
        const affected = checksMatching((body) => /click\(p,\s*'close\.tied\.tile'\)/.test(body) && /(?:click|press|clickOnce|pressOnce)\(p,\s*'close\.(?:variance|location)\./.test(body));
        const evidence = { atRest, afterOpenerClick, witness, checksClickingTileThenVarianceOrLocation: affected, pageErrors: errs };
        const reproduced = atRest.expanded === 'true' && atRest.match && atRest.clear && afterOpenerClick.expanded === 'false' && !afterOpenerClick.match && !afterOpenerClick.clear && !afterOpenerClick.loc3
          && witness.outcome === 'no' && witness.missing.includes('click:close.variance.v-1.clear') && affected.length >= 5;
        rec('S2-harness-honesty-3', 'The Daily Close grade tile is expanded at rest, so the `close.tied.tile` press that ' + affected.length + ' audit checks use as an opener collapses it and their close.variance.*/close.location.* presses hit nothing; S-moneydesk-close-4 records click:close.variance.v-1.clear as missing and prints "no" unmeasured',
          'harness honesty · dailyclose.js:188 tileOpen default; screens-dailyclose-*, store-2/3, storm-owner, swarm-moneydesk-close', reproduced, evidence);
      } finally { await c.close(); }
    },

    // S2-harness-honesty-4 · board.js:318 builds the Board card's Rail button inside the "Show details" disclosure
    // (INT-temp-first-screenful), so `board.card.a-1042.rail` is not on the page until `board.card.a-1042.expand` is pressed.
    // Eleven checks across eight modules press it cold. A-screens-rail-2-1 (RC-133: the opener keeps aria-pressed="false" after
    // it opened the rail) is run with RC-133 re-introduced by init script; it prints "no" because its press found nothing, while
    // the same press after expanding the card measures the stale attribute.
    // Negative control: when the checks expand the card first (or the button returns to the card face), the rail press lands,
    // the mutated run prints YES, and this check reports false.
    async 'S2-harness-honesty-4'(b) {
      const RC133 = `(() => {
        let until = 0;
        document.addEventListener('click', (e) => { const el = e.target && e.target.closest && e.target.closest('[data-railopen]'); if (el) until = Date.now() + 150; }, true);
        const reset = () => { if (Date.now() > until) return; for (const el of document.querySelectorAll('[data-railopen]')) { el.setAttribute('aria-pressed', 'false'); const m = el.querySelector('.pressmark'); if (m) m.remove(); } };
        setInterval(reset, 10);
      })();`;
      const mutated = await runTarget(b, 'screens-rail-2.mjs', 'A-screens-rail-2-1', RC133);
      const { c, p, errs } = await ctx(b);
      await p.addInitScript(RC133);
      try {
        await go(p, '#/frontdesk/board');
        const button = () => p.evaluate(() => { const e = document.querySelector('[data-testid="board.card.a-1042.rail"]'); return e ? { pressed: e.getAttribute('aria-pressed'), pressmark: !!e.querySelector('.pressmark') } : null; });
        const cold = await button();
        await click(p, 'board.card.a-1042.expand'); await p.waitForTimeout(150);
        const afterExpand = await button();
        const pressed = await click(p, 'board.card.a-1042.rail'); await p.waitForTimeout(200);
        const afterPress = await button();
        const railOpen = await p.evaluate(() => Proto.screens.rail.isOpen() && !document.getElementById('rail').hidden);
        await hop(p, '#/frontdesk/money'); await hop(p, '#/frontdesk/board'); await p.waitForTimeout(150);
        if (!(await has(p, 'board.card.a-1042.rail'))) { await click(p, 'board.card.a-1042.expand'); await p.waitForTimeout(150); }
        const afterRedraw = await button();
        const cold_pressers = checksMatching((body) => /(?:click|press|clickOnce|pressOnce)\(p,\s*'board\.card\.a-\d+\.rail'\)/.test(body) && !/board\.card\.a-\d+\.expand/.test(body));
        const evidence = { mutatedTargetRun: mutated, buttonCold: cold, buttonAfterExpand: afterExpand, pressed, buttonAfterPress: afterPress, railOpen, buttonAfterRouteRedraw: afterRedraw, checksPressingRailWithoutExpand: cold_pressers, pageErrors: errs };
        const reproduced = mutated.outcome === 'no' && mutated.missing.includes('click:board.card.a-1042.rail') && cold === null && !!afterExpand && pressed && railOpen
          && !!afterPress && afterPress.pressed === 'false' && !!afterRedraw && afterRedraw.pressed === 'true' && cold_pressers.length >= 8;
        rec('S2-harness-honesty-4', 'A-screens-rail-2-1 prints "no" with RC-133 re-introduced (rail opens, opener stays aria-pressed="false", redraw reads "true") because board.card.a-1042.rail only exists inside the Show-details disclosure; ' + cold_pressers.length + ' checks press it without expanding the card and measure a page with no rail',
          'harness honesty · board.js:318 rail button inside details(); screens-rail-1/2, screens-phone-2, screens-board-1, storm-board, storm-shell', reproduced, evidence);
      } finally { await c.close(); }
    },

    // S2-harness-honesty-5 · storm-shell.mjs A-storm-shell-8 asserts `out.every(pressed)` over seven sign-in toggles, four of
    // which (signin.device.shared, signin.grayscale, signin.outage, signin.afterhours) are no longer on the sign-in screen.
    // The check therefore prints "no" whatever focus does. Run with its defect re-introduced (every option toggle hands focus
    // to signin.go) it still prints "no", while the three toggles that exist measure focus landing on signin.go.
    // Negative control: when the check presses only the toggles that exist (or the four return), the mutated run prints YES
    // and this check reports false.
    async 'S2-harness-honesty-5'(b) {
      const REFOCUS = `document.addEventListener('click', (e) => { const el = e.target && e.target.closest && e.target.closest('[data-testid^="signin."]'); if (!el || el.getAttribute('data-testid') === 'signin.go') return; setTimeout(() => { const g = document.querySelector('[data-testid="signin.go"]'); if (g) g.focus(); }, 30); }, true);`;
      const mutated = await runTarget(b, 'storm-shell.mjs', 'A-storm-shell-8', REFOCUS);
      const { c, p, errs } = await ctx(b);
      await p.addInitScript(REFOCUS);
      try {
        await go(p, '#/signin');
        const toggles = await p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid^="signin."]')].map((e) => e.getAttribute('data-testid')));
        const wanted = ['signin.device.shared', 'signin.motion', 'signin.grayscale', 'signin.privacy', 'signin.outage', 'signin.afterhours', 'signin.theme.dark'];
        const absent = wanted.filter((t) => !toggles.includes(t));
        const out = [];
        for (const t of wanted.filter((x) => toggles.includes(x))) { const ok = await press(p, t); await p.waitForTimeout(80); out.push({ t, pressed: ok, focus: await p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); }) }); }
        const evidence = { mutatedTargetRun: mutated, signinToggles: toggles, absentFromSignin: absent, correctedPresses: out, pageErrors: errs };
        const reproduced = mutated.outcome === 'no' && absent.length >= 4 && absent.every((t) => mutated.missing.includes('press:' + t))
          && out.length >= 3 && out.every((o) => o.pressed) && out.every((o) => o.focus === 'signin.go');
        rec('S2-harness-honesty-5', 'A-storm-shell-8 prints "no" with its defect re-introduced (every existing sign-in toggle drops focus onto signin.go) because it requires presses on ' + absent.length + ' toggles that are no longer on the sign-in screen',
          'harness honesty · storm-shell.mjs A-storm-shell-8 out.every(pressed); signin.js options', reproduced, evidence);
      } finally { await c.close(); }
    },

    // S2-harness-honesty-6 · scripts/verify-docs.sh §9 ("every data-testid named in the task scripts has a matching builder")
    // matches the id's head (`board.card`) and tail (`.checkout'`) as two independent substrings of all of prototype/js. Renaming
    // the Board card's Check out builder to `.pay` in a temporary copy leaves the head in board.js and the tail in the queue-row
    // builder, so §9 still PASSes while fo-2's first step `board.card.a-1044.checkout` has no builder and is absent from the board.
    // Negative control: a validator that requires the tail to be built under the id's own head prints FAIL for fo-2 after the
    // rename, and this check reports false.
    async 'S2-harness-honesty-6'(b) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-'));
      const { c, p, errs } = await ctx(b);
      try {
        fs.cpSync(ROOT, tmp, { recursive: true, filter: (src) => !/(^|\/)(node_modules|\.git|\.next|dist)(\/|$)/.test(src) });
        const boardFile = path.join(tmp, 'prototype/js/screens/board.js');
        const src = fs.readFileSync(boardFile, 'utf8');
        const needle = "testid: scope + '.checkout'";
        const occurrences = src.split(needle).length - 1;
        fs.writeFileSync(boardFile, src.replace(needle, "testid: scope + '.pay'"));
        const tasks = fs.readdirSync(path.join(tmp, 'scripts/beta/tasks')).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(tmp, 'scripts/beta/tasks', f), 'utf8')).tasks.filter((t) => t.steps.some((s) => s.startsWith('board.card.a-1044.checkout'))).map((t) => f + ':' + t.id));
        let output = '';
        try { output = execFileSync('bash', ['scripts/verify-docs.sh'], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { output = (e.stdout || '') + (e.stderr || ''); }
        const line9 = (output.split('\n').find((l) => /task-script test ids/.test(l)) || '').trim();
        const file = pathToFileURL(path.join(tmp, 'prototype/index.html')).href;
        await p.goto(file + '#/frontdesk/board'); await p.waitForFunction(() => window.__proto && window.__proto.ready); await p.waitForTimeout(150);
        const mutatedBoard = await p.evaluate(() => ({ checkout: !!document.querySelector('[data-testid="board.card.a-1044.checkout"]'), pay: !!document.querySelector('[data-testid="board.card.a-1044.pay"]') }));
        await go(p, '#/frontdesk/board');
        const realBoard = await has(p, 'board.card.a-1044.checkout');
        const evidence = { builderOccurrencesRenamed: occurrences, tasksNamingTheStep: tasks, verifyDocsSection9: line9, mutatedBoardHas: mutatedBoard, unmutatedBoardHasCheckout: realBoard, pageErrors: errs };
        const reproduced = occurrences === 1 && tasks.length >= 1 && /^PASS/.test(line9) && mutatedBoard.checkout === false && mutatedBoard.pay === true && realBoard === true;
        rec('S2-harness-honesty-6', 'verify-docs.sh §9 still prints PASS after the Board card Check out builder is renamed to .pay, although task ' + tasks.join(',') + ' names board.card.a-1044.checkout and the mutated board no longer renders it: head and tail are matched as independent substrings of all prototype JS',
          'harness honesty · scripts/verify-docs.sh:125-141 §9 ok = (head in js) and (tail-ish in js)', reproduced, evidence);
      } finally { await c.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
    },
  };
};
