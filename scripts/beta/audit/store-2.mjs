// Audit checks for prototype/js/store.js, chunk store-2 (root causes RC-17, 31, 32, 198, 203, 213, 238, 63, 64, 65).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusals = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    controls: r.querySelectorAll('[data-testid="refusal.control"]').length,
  })));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const andon = (p) => p.evaluate(() => ((document.getElementById('andon') || {}).textContent || '').replace(/\s+/g, ' ').trim());
  // Word count: whitespace tokens; `words` drops tokens that are punctuation only (a lone em dash is not a word).
  const count = (verb) => { const tokens = (verb || '').trim().split(/\s+/).filter(Boolean); return { tokens: tokens.length, words: tokens.filter((t) => /[A-Za-z0-9#$]/.test(t)).length }; };
  const firstWord = (verb) => ((verb || '').trim().split(/\s+/)[0] || '').replace(/[^A-Za-z'-]/g, '');
  // Openers the contract's "verb first" accepts: an imperative, or the participle/finite forms the docs use as examples
  // ("Needs a second approver", "Held until 7:30 am", "Filing as <author>"). Anything else is recorded with its token.
  const VERB_OPENERS = /^(Choose|Enter|Needs|Held|Wait|Give|Pick|Name|Code|Switch|Appeal|Post|Set|Add|Confirm|Open|Send|Move|Chart|Use|Sign|Match|Clear|Undo|Remediate|Show|Take|Check|Ask|Call|Tap|Try|Fix|File|Save|Close|Review|Decide|Request|Record|Stop|Hold|Keep|Start|Finish|Re-enter|Retype|Dismiss|Wear|Get|Go|Come|Read|Reply|Complete|Correct|Remove|Attach|Build|Escalate|Investigate|Verify|Re-verify|Select|Tell|Bring|Put|Leave)$/;
  const verbFirst = (verb) => VERB_OPENERS.test(firstWord(verb)) || /^Filing as\b/.test((verb || '').trim());
  const rail = (p) => p.evaluate(() => ({
    // Proto.ui.btn does not forward `dataset`, so data-retired is never set; the retired mark is the ✓ appended to the label (shell.js:95).
    chips: [...document.querySelectorAll('[data-testid^="rail1.chip."]')].map((e) => ({ testid: e.getAttribute('data-testid'), text: e.textContent.trim(), retired: /✓\s*$/.test(e.textContent.trim()) ? '1' : '0', ariaLabel: e.getAttribute('aria-label') })),
    railState: (window.__proto.state().railState || {}),
    persona: window.__proto.persona,
    user: (Proto.store.currentUser() || {}).id,
  }));

  return {
    // RC-17 · A4 · store.js:83 pingChair refuses only when the appointment's last message is one of the two most recent messages overall.
    // Negative control: a per-encounter limiter refuses the fourth press (a-1044 again, still 08:40) with ping_rate exactly as it refused
    // the second, and a-1044 keeps one message row; then messagesForA1044After === 1 and fourthRefused is true, so the check reports false.
    // The second press must have been refused ping_rate first (the limiter exists) or the claim is a different defect and is not scored.
    async 'A-store-2-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const msgs = () => p.evaluate(() => window.__proto.state().messages.map((m) => m.id + ':' + m.appointmentId));
        const seq0 = await lastSeq(p);
        const p1 = await click(p, 'board.queue.row.a-1044.ping'); await p.waitForTimeout(120);
        const afterFirst = await msgs();
        const seq1 = await lastSeq(p);
        const p2 = await click(p, 'board.queue.row.a-1044.ping'); await p.waitForTimeout(120);
        const ev2 = await after(p, seq1); const afterSecond = await msgs();
        const secondRefused = refusals(ev2).some((r) => r.code === 'ping_rate');
        const seq2 = await lastSeq(p);
        const p3 = await click(p, 'board.queue.row.a-1050.ping'); await p.waitForTimeout(120);
        const ev3 = await after(p, seq2); const afterThird = await msgs();
        const seq3 = await lastSeq(p);
        const p4 = await click(p, 'board.queue.row.a-1044.ping'); await p.waitForTimeout(150);
        const ev4 = await after(p, seq3); const afterFourth = await msgs();
        const fourthRefused = refusals(ev4).some((r) => r.code === 'ping_rate');
        const forA1044 = (list) => list.filter((x) => x.endsWith(':a-1044')).length;
        const clock = await p.evaluate(() => window.__proto.state().clock.time);
        const reproduced = p1 && p2 && p3 && p4 && forA1044(afterFirst) === 1 && secondRefused && forA1044(afterSecond) === 1 && forA1044(afterFourth) === 2 && !fourthRefused;
        rec('A-store-2-1', 'The ping limiter is bypassed by pinging another chair in between: a-1044 pinged, refused ping_rate on the repeat, then a-1050 pinged, then a-1044 pinged again writes a second message at the same clock with no refusal', 'A4 — repeating the same control does not double-write; store.js:83 checks the position of the last message overall, not the encounter',
          reproduced, { pressesLanded: { first: p1, second: p2, third: p3, fourth: p4 }, clock, messagesAfterFirst: afterFirst, messagesAfterSecond: afterSecond, secondPressRefusals: refusals(ev2), messagesAfterThird: afterThird, thirdPressWrites: writes(ev3), messagesAfterFourth: afterFourth, fourthPressWrites: writes(ev4), fourthPressRefusals: refusals(ev4), messagesForA1044AfterFourth: forA1044(afterFourth), seqRange: range(await after(p, seq0), seq0) });
      } finally { await c.close(); }
    },

    // RC-31 · A4 · store.js:253 buildAppeal writes a new appealPackets row on every call; moneydesk.js:151 calls it on every Appeal press.
    // Negative control: a guarded Appeal writes ap-1 on the first press and, on the second press (and after Send), writes nothing and either
    // refuses or shows the same packet ap-1; then packetsAfterSecond === packetsAfterFirst and the check reports false. The first press
    // must have written exactly one packet (the control works) before the repeat is scored.
    async 'A-store-2-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.tab.denials'); await p.waitForTimeout(120);
        const packets = () => p.evaluate(() => window.__proto.state().appealPackets.map((k) => k.id + ':' + k.claimId));
        const drawerTitle = () => p.evaluate(() => { const h3 = [...document.querySelectorAll('.md-drawer h3')].map((e) => e.textContent.trim()); return h3.length ? h3 : null; });
        const seq0 = await lastSeq(p);
        const p1 = await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150);
        const afterFirst = await packets(); const title1 = await drawerTitle();
        const seq1 = await lastSeq(p);
        const p2 = await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150);
        const ev2 = await after(p, seq1); const afterSecond = await packets(); const title2 = await drawerTitle();
        const sent = await click(p, 'money.appeal.send'); await p.waitForTimeout(200);
        const claimStatus = await p.evaluate(() => (window.__proto.state().claims.find((x) => x.id === 'c-88') || {}).status);
        const seq2 = await lastSeq(p);
        const p3 = await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150);
        const ev3 = await after(p, seq2); const afterSent = await packets(); const title3 = await drawerTitle();
        const reproduced = p1 && p2 && afterFirst.length === 1 && afterSecond.length > afterFirst.length && refusals(ev2).length === 0;
        rec('A-store-2-2', 'Pressing Appeal on c-88 twice writes two appeal packets (ap-1, ap-2) and the drawer title changes to the new id; a third press after Send writes a fourth row, with no refusal at any press', 'A4 — the second press is refused or is a visible no-op with its reason; store.js:253 appends unconditionally',
          reproduced, { pressesLanded: { first: p1, second: p2, send: sent, afterSend: p3 }, packetsAfterFirst: afterFirst, drawerAfterFirst: title1, packetsAfterSecond: afterSecond, drawerAfterSecond: title2, secondPressWrites: writes(ev2), secondPressRefusals: refusals(ev2), claimStatusAfterSend: claimStatus, packetsAfterSendThenAppeal: afterSent, drawerAfterSendThenAppeal: title3, thirdPressWrites: writes(ev3), thirdPressRefusals: refusals(ev3), seqRange: range(await after(p, seq0), seq0) });
      } finally { await c.close(); }
    },

    // RC-32 · A3 · store.js:249 eraPostMatched flips b.status without write() and appends no row.
    // Negative control: a compliant Post matched has at least one `write` event (table eraBatches or ledger, with an id) in the seq range of
    // the press, and a posting changes the ledger row count; then writeEventsInRange.length > 0 and the check reports false. The status
    // must actually have changed review → deltas (the control did something) before the missing event is scored.
    async 'A-store-2-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const snap = () => p.evaluate(() => { const S = window.__proto.state(); return { batchStatus: (S.eraBatches.find((x) => x.id === 'era-1') || {}).status, ledgerRows: S.ledger.length, tables: Object.fromEntries(['ledger', 'claimEvents', 'allocations', 'domainEvents'].map((t) => [t, (S[t] || []).length])) }; });
        const before = await snap();
        const label = await txt(p, 'money.era.era-1.postmatched');
        const identity = await p.evaluate(() => { const e = document.querySelector('[data-testid="money.era.era-1.postmatched"]'); return e ? e.className : null; });
        const seq0 = await lastSeq(p);
        const pressed = await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200);
        const afterS = await snap();
        const ev = await after(p, seq0);
        const w = ev.filter((e) => e.kind === 'write');
        const changed = before.batchStatus !== afterS.batchStatus;
        const reproduced = pressed && changed && w.length === 0;
        rec('A-store-2-3', 'Post matched (irreversible identity) moves era-1 from review to deltas with no write event in the press’s seq range and no row appended anywhere', 'A3 — a mutation writes one write event per table it changes; store.js:249 has no write()',
          reproduced, { pressed, controlLabel: label, controlClass: identity, stateDiff: { before, after: afterS, batchStatusChanged: changed, ledgerDelta: afterS.ledgerRows - before.ledgerRows }, eventsInRange: ev.map((e) => e.seq + ':' + e.kind + (e.testid ? ':' + e.testid : '') + (e.table ? ':' + e.table + '/' + e.id : '')), writeEventsInRange: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-198 · A2 · store.js:290 addDayPass records the SoD decision against pv.conflicts[0] (seed order) and writes one row however many conflicts.
    // Negative control: a correct save writes a controlDecisions row whose ruleId is the critical conflict that held the save
    // (rule-deposit-post), or one row per conflict; then decisionRuleIds includes 'rule-deposit-post' and the check reports false.
    // The day pass must have been issued with sodDecision 'compensate' (the save happened) before the rows are scored.
    async 'A-store-2-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles');
        await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Casey Morgan');
        await click(p, 'roles.daypass.entitlement.write_off'); await click(p, 'roles.daypass.entitlement.prepare_deposit'); await p.waitForTimeout(150);
        const preview = await p.evaluate(() => {
          const pv = Proto.store.previewDayPass({ name: 'Casey Morgan', role: 'frontdesk', location: 'loc-1', end: '17:30', extra: ['write_off', 'prepare_deposit'] });
          return { conflicts: pv.conflicts.map((x) => ({ id: x.id, severity: x.severity, pair: x.pair })), gatesOnScreen: [...document.querySelectorAll('.rl-preview .refusal')].map((r) => ({ code: r.dataset.code, severity: [...r.classList].filter((k) => k !== 'refusal').join(' '), verb: (r.querySelector('.verb') || {}).textContent })), saveLabelBeforeDecision: ((document.querySelector('[data-testid="roles.daypass.save"]') || {}).textContent || '').trim() };
        });
        await click(p, 'roles.sod.compensate'); await p.waitForTimeout(150);
        const saveLabel = await txt(p, 'roles.daypass.save');
        const seq0 = await lastSeq(p);
        const saved = await click(p, 'roles.daypass.save'); await p.waitForTimeout(250);
        const ev = await after(p, seq0);
        const out = await p.evaluate(() => { const S = window.__proto.state(); return { dayPasses: S.dayPasses.map((d) => ({ id: d.id, name: d.name, role: d.role, sodDecision: d.sodDecision, entitlements: d.entitlements })), controlDecisions: S.controlDecisions.map((d) => ({ id: d.id, kind: d.kind, ruleId: d.ruleId, reviewBy: d.reviewBy })), issuedChip: [...document.querySelectorAll('.chip')].map((e) => e.textContent.trim()).filter((t) => /SoD decision/.test(t)) }; });
        const critical = preview.conflicts.filter((x) => x.severity === 'critical').map((x) => x.id);
        const decisionRuleIds = out.controlDecisions.map((d) => d.ruleId);
        const issued = out.dayPasses.length === 1 && out.dayPasses[0].sodDecision === 'compensate';
        const reproduced = saved && issued && preview.conflicts.length === 2 && critical.length === 1 && out.controlDecisions.length === 1 && !decisionRuleIds.includes(critical[0]);
        rec('A-store-2-4', 'Issuing a Front desk pass with Write off and Prepare deposit shows two SoD gates (high rule-post-writeoff, critical rule-deposit-post); only the critical one holds Save, yet Compensate + Save writes one controlDecisions row against rule-post-writeoff and none against the critical rule', 'A2 — the rows describe what happened; store.js:290 takes pv.conflicts[0] (seed order) and writes one row',
          reproduced, { conflictsInPreview: preview.conflicts, criticalConflicts: critical, gatesOnScreen: preview.gatesOnScreen, saveLabelBeforeDecision: preview.saveLabelBeforeDecision, saveLabelAfterCompensate: saveLabel, savePressed: saved, dayPassesWritten: out.dayPasses, controlDecisionsWritten: out.controlDecisions, decisionRuleIds, issuedChipText: out.issuedChip, writesInRange: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-203 · A2/B2/§6 outage · store.js:74 and :90 are the only S.outage checks; eraConfirm, sendStatement, savePerio, closeDay, fileNote,
    // addDayPass and decideApproval write rows under outage=1 while the Andon reads "reads only, no postings".
    // Negative control: with the gate applied everywhere, each verb under outage=1 records a refusal event with code `outage` and zero write
    // events in its seq range (as Checkout Post does, measured here as the comparator); then verbsWritingUnderOutage is empty and the check
    // reports false. Only refusal events with code outage count — a readback or other gate on the way is not the claimed refusal.
    async 'A-store-2-5'(b) {
      const { c, p } = await ctx(b);
      const results = {};
      const measure = async (name, hash, drive) => {
        await go(p, hash);
        const andonText = await andon(p);
        const outageFlag = await p.evaluate(() => ({ proto: window.__proto.outage, store: !!Proto.store.get().outage }));
        const seq0 = await lastSeq(p);
        const steps = await drive();
        const ev = await after(p, seq0);
        results[name] = { hash, andon: andonText, outageFlag, steps, writes: writes(ev), outageRefusals: refusals(ev).filter((r) => r.code === 'outage'), otherRefusals: refusals(ev).filter((r) => r.code !== 'outage').map((r) => r.code), seqRange: range(ev, seq0) };
      };
      try {
        // Comparator: the store's own gate on Post.
        await measure('checkout.post', '#/frontdesk/checkout/a-1044?outage=1', async () => [await click(p, 'checkout.tender.card'), await fill(p, 'checkout.card.number', '4242424242424242'), await click(p, 'checkout.post')]);
        await measure('era.confirm', '#/biller/money?outage=1', async () => [await click(p, 'money.era.era-1.postmatched'), await click(p, 'money.era.line.el-14.confirm')]);
        await measure('statement.send', '#/biller/money?outage=1', async () => [await click(p, 'money.tab.statements'), await click(p, 'money.statement.sd-1.send')]);
        await measure('perio.save', '#/hygienist/perio/enc-9001?outage=1', async () => { const s = [await click(p, 'perio.screening')]; for (const k of ['1', '2', '3', '2', '1', '0']) { await p.keyboard.press(k); await p.waitForTimeout(25); } s.push(await click(p, 'perio.save')); await p.waitForTimeout(150); return s; });
        await measure('close.closeday', '#/owner/close?outage=1', async () => [await click(p, 'close.closeday'), await click(p, 'close.closeday.confirm')]);
        await measure('encounter.file', '#/dentist/encounter/enc-9002?outage=1', async () => { const s = [await click(p, 'enc.tag.tag-1.chart'), await click(p, 'enc.surface.30.d'), await click(p, 'enc.proc.d2392'), await click(p, 'enc.note.starter.0')]; await p.waitForTimeout(120); s.push(await click(p, 'enc.file')); await p.waitForTimeout(150); s.push(await click(p, 'refusal.control')); await p.waitForTimeout(200); return s; });
        await measure('roles.daypass.save', '#/owner/roles?outage=1', async () => [await click(p, 'roles.daypass.add'), await fill(p, 'roles.daypass.name', 'Alex Rivera'), await click(p, 'roles.daypass.role.rdh'), await click(p, 'roles.daypass.save')]);
        await measure('phone.approve', '#/owner/phone/approvals?outage=1', async () => { const s = [await click(p, 'phone.simulate')]; await p.waitForTimeout(150); const reqId = await p.evaluate(() => ((window.__proto.state().approvals.filter((a) => a.status === 'pending')[0]) || {}).id || null); s.push(reqId); s.push(await click(p, 'phone.request.' + reqId + '.approve')); for (const d of ['1', '2', '3', '4']) s.push(await click(p, 'phone.stepup.' + d)); s.push(await click(p, 'phone.stepup.submit')); await p.waitForTimeout(200); return s; });
        const comparatorRefused = results['checkout.post'].outageRefusals.length > 0 && results['checkout.post'].writes.length === 0;
        const andonClaims = Object.values(results).every((r) => /reads only, no postings/.test(r.andon) && r.outageFlag.store === true);
        const verbsWritingUnderOutage = Object.entries(results).filter(([k, r]) => k !== 'checkout.post' && r.writes.length > 0 && r.outageRefusals.length === 0).map(([k]) => k);
        const reproduced = comparatorRefused && andonClaims && verbsWritingUnderOutage.length > 0;
        rec('A-store-2-5', 'With outage=1 and the Andon reading "reads only, no postings", ERA Confirm, Send statement, Save exam, Close day, File, Issue day pass and Approve each write rows with no outage refusal, while Checkout Post refuses with code outage', 'A2, B2, CONTRACTS §6 outage — during the outage every write is refused with the outage code the way store.js:74/:90 do, or the contract names which verbs stay open',
          reproduced, { comparatorCheckoutRefused: comparatorRefused, andonSaysNoPostingsEverywhere: andonClaims, verbsWritingUnderOutage, perVerb: results });
      } finally { await c.close(); }
    },

    // RC-213 · B2 / CONTRACTS §6 · store.js:94 and sibling gate sites: verb lines open with a noun, pronoun or gerund subject.
    // Negative control: when every rendered verb line opens with an imperative or one of the documented participle forms (Choose…, Needs…,
    // Held…, Filing as…), notVerbFirst is empty and the check reports false. Each gate is matched by its data-code / event code, not by
    // whichever refusal is on screen; the cited already_decided line must itself be measured for the check to score.
    async 'A-store-2-6'(b) {
      const { c, p } = await ctx(b);
      const gates = [];
      const harvest = async (label, hash, drive, wantCodes) => {
        await go(p, hash);
        const seq0 = await lastSeq(p);
        await drive();
        const ev = refusals(await after(p, seq0));
        const dom = await refusalsDom(p);
        for (const code of wantCodes) {
          const e = ev.find((x) => x.code === code) || null; const d = dom.find((x) => x.code === code) || null;
          const verb = (d && d.verb) || (e && e.verb) || null;
          gates.push({ label, hash, code, verb, firstWord: firstWord(verb), verbFirst: verb ? verbFirst(verb) : null, rendered: !!d, eventSeq: e ? e.seq : null });
        }
      };
      try {
        await harvest('checkout already_decided (store.js:94)', '#/frontdesk/checkout/a-1050', async () => { await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(150); }, ['already_decided']);
        await harvest('checkout outage (store.js:90)', '#/frontdesk/checkout/a-1044?outage=1', async () => { await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(150); }, ['outage']);
        await harvest('checkout tender_required (store.js:93, comparator)', '#/frontdesk/checkout/a-1044', async () => { await click(p, 'checkout.post'); await p.waitForTimeout(150); }, ['tender_required']);
        await harvest('close already_closed (store.js:263)', '#/owner/close', async () => { await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(150); await click(p, 'close.closeday'); await p.waitForTimeout(150); }, ['already_closed']);
        await harvest('close entitlement (store.js:262)', '#/biller/close', async () => { await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(150); }, ['entitlement']);
        await harvest('roles licence_not_on_file (store.js:279)', '#/owner/roles', async () => { await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Tom Ford'); await click(p, 'roles.daypass.role.rdh'); await p.waitForTimeout(150); }, ['licence_not_on_file']);
        await harvest('encounter killers (store.js:221/230)', '#/dentist/encounter/enc-9002', async () => { await click(p, 'enc.file'); await p.waitForTimeout(200); }, ['tag_undispositioned', 'assessment_required']);
        await harvest('encounter duplicate_paint (store.js:199)', '#/dentist/encounter/enc-9002', async () => { await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(120); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150); }, ['duplicate_paint']);
        await harvest('perio depth_gt_15 (perio.js:98)', '#/hygienist/perio/enc-9001', async () => { await p.keyboard.press('0'); await p.waitForTimeout(40); await p.keyboard.press('9'); await p.waitForTimeout(150); }, ['depth_gt_15']);
        await harvest('money needs_second (store.js:134, comparator) then phone blocked_same_person (store.js:140)', '#/biller/money', async () => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150); await hop(p, '#/biller/phone/approvals'); await p.waitForTimeout(150); const id = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).id); await click(p, 'phone.request.' + id + '.approve'); await p.waitForTimeout(150); }, ['needs_second', 'blocked_same_person']);
        await harvest('PIN pad pin_no_match (shell.js:69)', '#/dentist/exams?device=shared', async () => { await click(p, 'topbar.author'); for (const d of ['9', '9', '9', '9']) await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(150); }, ['pin_no_match']);
        const measured = gates.filter((g) => g.verb);
        const notVerbFirst = measured.filter((g) => g.verbFirst === false);
        const cited = gates.find((g) => g.code === 'already_decided');
        const reproduced = !!cited && !!cited.verb && cited.verbFirst === false && notVerbFirst.length >= 6;
        rec('A-store-2-6', 'Rendered refusal verb lines open with a noun, pronoun or gerund rather than a verb: "This visit is already checked out", "Server unreachable —", "Today is already closed…", "Closing the day needs…", "Licence not on file", "Hygienist tag #30…", "Assessment is empty", "Already charted…", "Depth 19 mm…", "You requested this…", "PIN did not match…"', 'B2 / CONTRACTS §6 — the verb line is verb first; store.js:94 and the sibling gate sites',
          reproduced, { gatesMeasured: measured.length, gatesNotVerbFirst: notVerbFirst.length, citedLine: cited, firstWords: measured.map((g) => g.code + ' → "' + g.firstWord + '"' + (g.verbFirst ? ' (verb)' : ' (not verb)')), gates, openerLexicon: VERB_OPENERS.source });
      } finally { await c.close(); }
    },

    // RC-238 · C5/A7 · store.js:258 matchVariance sets rr.state = 'tied' and never adjusts rr.bank / rr.expected; dailyclose.js:114 computes the gap from them.
    // Negative control: a consistent match makes the Hillsboro chip read Tied AND the Card tender row read tied (gap 0) or show the matched
    // $312.40 against the bank line; then tenderCardAfter.gap is 0 / no 'gap' chip and the check reports false. The match must have been
    // written (reconciliationMatches gains rm-1, v-1 status matched) before the disagreement is scored.
    async 'A-store-2-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        await click(p, 'close.tied.tile'); await p.waitForTimeout(150);
        // Opening the tile already expands the worst-graded location (loc-3); a click would collapse it. Expand only if it is closed.
        const expanded = () => p.evaluate(() => (document.querySelector('[data-testid="close.location.loc-3"]') || {}).getAttribute && document.querySelector('[data-testid="close.location.loc-3"]').getAttribute('aria-expanded'));
        if ((await expanded()) !== 'true') { await click(p, 'close.location.loc-3'); await p.waitForTimeout(150); }
        const read = () => p.evaluate(() => {
          const S = window.__proto.state();
          const loc = document.querySelector('[data-testid="close.location.loc-3"]');
          const row = document.querySelector('#dc-loc-loc-3 [data-testid="close.tender.card"]');
          const rr = S.reconciliation.find((r) => r.id === 'rr-loc-3') || S.reconciliation.find((r) => r.locationId === 'loc-3');
          return {
            tileText: ((document.querySelector('[data-testid="close.tied.tile"]') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
            loc3Chip: loc ? ((loc.querySelector('.chip') || {}).textContent || '').trim() : null,
            tenderCardRow: row ? { text: row.textContent.replace(/\s+/g, ' ').trim(), chip: ((row.querySelector('.chip') || {}).textContent || '').trim(), nums: [...row.querySelectorAll('.num')].map((e) => e.textContent.trim()) } : null,
            varianceCards: [...document.querySelectorAll('#dc-loc-loc-3 [aria-label^="Variance "]')].map((e) => e.getAttribute('aria-label')),
            store: { rrState: rr && rr.state, expectedCard: rr && rr.expected && rr.expected.card, bankCard: rr && rr.bank && rr.bank.card, v1: (S.variances.find((v) => v.id === 'v-1') || {}).status, matches: S.reconciliationMatches.map((m) => m.id + ':' + m.varianceId) },
          };
        });
        const before = await read();
        const seq0 = await lastSeq(p);
        const matched = await click(p, 'close.variance.v-1.match'); await p.waitForTimeout(200);
        const ev = await after(p, seq0);
        let afterR = await read();
        if (!afterR.tenderCardRow && (await expanded()) !== 'true') { await click(p, 'close.location.loc-3'); await p.waitForTimeout(150); afterR = await read(); }
        const gapStill = !!afterR.tenderCardRow && /gap/i.test(afterR.tenderCardRow.chip);
        const tiedWord = /Tied/i.test(afterR.loc3Chip || '');
        const written = afterR.store.matches.length > before.store.matches.length && afterR.store.v1 === 'matched';
        const reproduced = matched && written && tiedWord && gapStill && afterR.store.bankCard === before.store.bankCard && afterR.store.expectedCard === before.store.expectedCard;
        rec('A-store-2-7', 'After Match these on v-1, the Hillsboro row reads Tied and the variance card is gone, but the Card tender row on the same panel still shows bank $2,068.45 against expected $2,380.85 with the chip "gap −$312.40"', 'C5, A7 — one canonical value per fact; store.js:258 sets rr.state = tied and records no settlement against the bank line',
          reproduced, { matchPressed: matched, before, after: afterR, writesInRange: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-63 · B2 · store.js:134 evaluateRelease interpolates the two eligible approvers into the needs_second verb.
    // Negative control: a verb of eight words or fewer (the em dash is punctuation, not a word) gives words <= 8 on every rendered path and
    // the check reports false; the token count including the dash is carried so the reader can see both. Only refusals whose code is
    // needs_second are measured; the helper is also called for every seeded actor so a longer eligible list would surface.
    async 'A-store-2-8'(b) {
      const { c, p } = await ctx(b);
      try {
        const rendered = [];
        await go(p, '#/biller/money');
        let seq0 = await lastSeq(p);
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        for (const r of refusals(await after(p, seq0)).filter((x) => x.code === 'needs_second')) rendered.push({ path: '#/biller/money money.writeoff.p-306 → post', ...r, ...count(r.verb) });
        rendered.push(...(await refusalsDom(p)).filter((d) => d.code === 'needs_second').map((d) => ({ path: 'DOM after biller post', verb: d.verb, ...count(d.verb) })));
        await go(p, '#/frontdesk/checkout/a-1047');
        seq0 = await lastSeq(p);
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242'); await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '180'); await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        for (const r of refusals(await after(p, seq0)).filter((x) => x.code === 'needs_second')) rendered.push({ path: '#/frontdesk/checkout/a-1047 writeoff 180 → post', ...r, ...count(r.verb) });
        const helper = await p.evaluate(() => window.__proto.state().users.map((u) => { const g = Proto.store.evaluateRelease('write_off', 41000, u); return { actor: u.id, short: u.short, persona: Object.entries(window.__proto.state().personaUser).filter(([, id]) => id === u.id).map(([k]) => k), code: g.code, verb: g.verb || null }; }));
        const helperCounted = helper.map((h) => ({ ...h, ...count(h.verb) }));
        const over = rendered.filter((r) => r.words > 8);
        const reproduced = rendered.length > 0 && over.length > 0;
        rec('A-store-2-8', 'The needs_second verb "Needs a second approver — Dana or Dr. Reagan" runs past eight words on a rendered gate', 'B2 / CONTRACTS §6 — verb line at most eight words; store.js:134',
          reproduced, { renderedNeedsSecond: rendered, renderedOverEightWords: over, helperByActor: helperCounted, helperOverEightWords: helperCounted.filter((h) => h.words > 8).map((h) => ({ actor: h.actor, persona: h.persona, verb: h.verb, words: h.words })), countingRule: 'words = whitespace tokens containing a letter, digit, # or $; tokens = all whitespace tokens (the em dash counts as a token, not a word)' });
      } finally { await c.close(); }
    },

    // RC-64 · A4 · store.js:137 decideApproval has no already_decided guard; a second decision on a decided request re-posts the write-off.
    // Negative control: a guarded store returns {ok:false, code:'already_decided'} on the second call and writes nothing, so
    // approvalsLog and write_off rows for ar-1 stay at 1 each and the check reports false. The first (UI) approval must have written
    // exactly one approvalsLog row and one write_off before the repeat is scored; the check also records that no UI control remains.
    async 'A-store-2-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/phone/approvals');
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const reqId = await p.evaluate(() => ((window.__proto.state().approvals.filter((a) => a.status === 'pending')[0]) || {}).id || null);
        const rows = () => p.evaluate((id) => { const S = window.__proto.state(); return { status: (S.approvals.find((a) => a.id === id) || {}).status, approvalsLog: S.approvalsLog.filter((l) => l.requestId === id).map((l) => l.id + ':' + l.decision), writeoffs: S.ledger.filter((e) => e.kind === 'write_off' && e.approvalRequestId === id).map((e) => e.id + ':' + e.amountCents), balances: Proto.store.balances('p-306') }; }, reqId);
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.' + reqId + '.approve'); for (const d of ['1', '2', '3', '4']) await click(p, 'phone.stepup.' + d); await click(p, 'phone.stepup.submit'); await p.waitForTimeout(200);
        const afterFirst = await rows();
        const ev1 = await after(p, seq0);
        const uiControlLeft = !!(await p.$('[data-testid="phone.request.' + reqId + '.approve"]'));
        const seq1 = await lastSeq(p);
        const second = await p.evaluate((id) => { const r = Proto.store.decideApproval(id, 'u-dr-1', 'approved', true); return { ok: r.ok, code: r.code || null, verb: r.verb || null }; }, reqId);
        await p.waitForTimeout(100);
        const afterSecond = await rows();
        const ev2 = await after(p, seq1);
        const firstWorked = afterFirst.status === 'approved' && afterFirst.approvalsLog.length === 1 && afterFirst.writeoffs.length === 1;
        const reproduced = !!reqId && firstWorked && second.ok === true && afterSecond.approvalsLog.length === 2 && afterSecond.writeoffs.length === 2;
        rec('A-store-2-9', 'After the owner approves ar-1 on the phone, a second decideApproval on the same request returns ok and writes approvalsLog al-2 and a second −$410 write_off, turning Lena Fischer’s $0 balance into a $410 credit', 'A4 — a repeat is refused (already_decided, CONTRACTS §6) or is a visible no-op; store.js:137 has no guard',
          reproduced, { requestId: reqId, afterFirstApproval: afterFirst, firstApprovalWrites: writes(ev1), uiApproveControlLeftAfterFirst: uiControlLeft, secondCallResult: second, afterSecondCall: afterSecond, secondCallWrites: writes(ev2), secondCallRefusals: refusals(ev2), seqRange: range(await after(p, seq0), seq0) });
      } finally { await c.close(); }
    },

    // RC-65 · A2/B9 · store.js:296 RAIL_STEPS names 'save' and 'find'; no code path calls retireChip('save') or retireChip('find').
    // Negative control: doing the step retires its chip — after Save exam the "Save exam" chip carries the ✓ mark and railState
    // has a 'save' key; after a chart opens through the palette "Find a patient" does the same with 'find'; then both *Retired flags are
    // true and the check reports false. The Save must have written a perioExams row (the step happened) and the 'perio' chip must have
    // retired (the rail mechanism works for this user) before the two unretired chips are scored.
    async 'A-store-2-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles');
        await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Alex Rivera'); await click(p, 'roles.daypass.role.rdh'); await p.waitForTimeout(120);
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const pass = await p.evaluate(() => (window.__proto.state().dayPasses[0] || null));
        await click(p, 'roles.daypass.signin'); await p.waitForTimeout(250);
        const railAtStart = await rail(p);
        await hop(p, '#/temp/perio/enc-9001'); await p.waitForTimeout(200);
        await p.keyboard.type('3'.repeat(168), { delay: 0 }); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        const saved = await click(p, 'perio.save'); await p.waitForTimeout(250);
        const ev1 = await after(p, seq0);
        const exams = await p.evaluate(() => window.__proto.state().perioExams.filter((e) => e.encounterId === 'enc-9001').map((e) => e.id + ':' + e.author));
        await hop(p, '#/temp/board'); await p.waitForTimeout(200);
        const railAfterSave = await rail(p);
        // Find a patient through the palette: two identifiers, then the chart opens.
        await click(p, 'topbar.search'); await p.waitForTimeout(150);
        await p.keyboard.type('mar'); await p.waitForTimeout(250);
        const rowIdx = await p.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid^="palette.row."]')]; const i = rows.findIndex((r) => /Marisol|M\. V\.|MV/.test(r.textContent)); return i; });
        let found = false, chartOpened = null;
        if (rowIdx >= 0) {
          await click(p, 'palette.row.' + rowIdx); await p.waitForTimeout(150);
          await fill(p, 'palette.confirm.dob', '04/12/1978');
          const seq1 = await lastSeq(p);
          found = await click(p, 'palette.confirm.go'); await p.waitForTimeout(250);
          const ev2 = await after(p, seq1);
          chartOpened = { writes: writes(ev2), phiAccess: ev2.some((e) => e.kind === 'write' && e.table === 'phiAccessLog'), railOpen: await p.evaluate(() => { const r = document.getElementById('rail'); return r ? !r.hidden : null; }) };
        }
        await hop(p, '#/temp/board'); await p.waitForTimeout(200);
        const railAfterFind = await rail(p);
        const chip = (r, word) => r.chips.find((x) => x.text.replace(/\s*✓\s*$/, '') === word) || null;
        const bucket = railAfterFind.railState[railAfterFind.user] || {};
        const perioRetired = !!(chip(railAfterSave, 'Perio grammar') && chip(railAfterSave, 'Perio grammar').retired === '1');
        const saveRetired = !!(chip(railAfterSave, 'Save exam') && chip(railAfterSave, 'Save exam').retired === '1') || !!bucket.save;
        const findRetired = !!(chip(railAfterFind, 'Find a patient') && chip(railAfterFind, 'Find a patient').retired === '1') || !!bucket.find;
        const reproduced = !!pass && saved && exams.length === 1 && perioRetired && !saveRetired && (chartOpened && chartOpened.phiAccess ? !findRetired : true) && railAfterSave.chips.length > 0;
        rec('A-store-2-10', 'As the RDH day pass, Save exam retires "Perio grammar" but leaves "Save exam" open, and opening a chart through the palette leaves "Find a patient" open: RAIL_STEPS names save and find, nothing retires them', 'A2, B9 — doing the step retires its chip; store.js:296/298 — retireChip is called for arrive, seat, checkout, payment, perio, tag, ready only',
          reproduced, { dayPass: pass ? { id: pass.id, name: pass.name, role: pass.role } : null, railAtSignin: railAtStart, savePressed: saved, perioExamsWritten: exams, saveWrites: writes(ev1), railAfterSave, paletteRowForMarisol: rowIdx, chartOpened, railAfterFind, railStateBucket: bucket, perioChipRetired: perioRetired, saveChipRetired: saveRetired, findChipRetired: findRetired });
      } finally { await c.close(); }
    },
  };
};
