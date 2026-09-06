// Audit checks for prototype/js/store.js, chunk store-1 (root causes RC-1, 4, 5, 6, 7, 8, 9, 12, 13, 14).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => e.table + '/' + e.id);
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: (r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || null,
    controls: r.querySelectorAll('[data-testid="refusal.control"]').length,
    buttons: r.querySelectorAll('button').length,
    controlLabels: [...r.querySelectorAll('button')].map((b) => b.textContent.trim()),
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const active = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('data-testid') || a.tagName); });
  // Word count: whitespace tokens; `words` drops tokens that are punctuation only (a lone em dash).
  const count = (verb) => { const tokens = (verb || '').trim().split(/\s+/).filter(Boolean); return { tokens: tokens.length, words: tokens.filter((t) => /[A-Za-z0-9#$]/.test(t)).length }; };
  // CONTRACTS §6 code list, parsed from the file so the check follows the contract, not a copy of it.
  const s6Codes = () => {
    const text = fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8');
    const sec = text.slice(text.indexOf('## 6. Refusals'), text.indexOf('## 7.'));
    const list = sec.slice(sec.indexOf('Codes:'), sec.indexOf('The list is the contract'));
    return { codes: [...list.matchAll(/`([a-z_0-9]+)`/g)].map((m) => m[1]), searched: list.trim() };
  };
  // Cents an Explain sentence says is left on one charge: "you owe $X" → +X, "credit $X" → −X, "paid in full" → 0.
  // Kept as source so the browser (page.evaluate) and Node run the identical parser.
  const OWE_SRC = `const m = /you owe \\$([\\d,]+\\.\\d\\d)/.exec(sentence); if (m) return Math.round(Number(m[1].replace(/,/g, '')) * 100);
    const c = /credit \\$([\\d,]+\\.\\d\\d)/.exec(sentence); if (c) return -Math.round(Number(c[1].replace(/,/g, '')) * 100);
    return 0;`;
  const owe = new Function('sentence', OWE_SRC);

  return {
    // RC-1 · A2/A7/C5 · store.js:108 postCheckout re-charges seeded pr-431 (crown #19, already on the ledger as le-4508).
    // Negative control: when the guard is right, Post writes one patient_payment of −$410 and no new `charge` for pr-431;
    // the pr-431 charge count stays 1 and Patient due goes 41000 → 0. Then chargesAfter === chargesBefore and the check reports false.
    async 'A-store-1-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047');
        const before = await p.evaluate(() => { const S = window.__proto.state(); return { charges431: S.ledger.filter((e) => e.kind === 'charge' && e.procedureId === 'pr-431').map((e) => e.id + ':' + e.amountCents), bal: Proto.store.balances('p-306'), pr431: S.procedures.find((x) => x.id === 'pr-431') }; });
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return { charges431: S.ledger.filter((e) => e.kind === 'charge' && e.procedureId === 'pr-431').map((e) => e.id + ':' + e.amountCents), bal: Proto.store.balances('p-306'), payments: S.ledger.filter((e) => e.kind === 'patient_payment' && e.patientId === 'p-306' && e.posted === S.tenant.today).map((e) => e.id + ':' + e.amountCents), allocations: S.allocations.map((a) => a.paymentId + '→' + a.chargeId + ':' + a.amountCents), threeNumbers: (document.querySelector('.threenum') || {}).textContent || null, explainCharges: Proto.store.explain('p-306').map((x) => x.sentence.split(':')[0]) }; });
        const ev = await after(p, seq0);
        const posted = ev.some((e) => e.kind === 'write' && e.table === 'collectionDecisions');
        const reproduced = posted && afterS.charges431.length > before.charges431.length && afterS.bal.patientDue > before.bal.patientDue;
        rec('A-store-1-1', 'Post on a-1047 (Lena Fischer, seeded crown pr-431 already charged as le-4508) writes the $1,180 crown charge a second time, so paying $410 in full raises Patient due', 'A2, A7, C5 — store.js:108 postCheckout guards on p.charged, which the seed never sets',
          reproduced, { postAccepted: posted, seedProcedure: before.pr431, charges431Before: before.charges431, charges431After: afterS.charges431, patientDueBefore: before.bal.patientDue, patientDueAfter: afterS.bal.patientDue, paymentsToday: afterS.payments, allocations: afterS.allocations, threeNumbersOnScreen: afterS.threeNumbers, explainChargeHeads: afterS.explainCharges, writes: writes(ev), seqRange: [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0] });
      } finally { await c.close(); }
    },

    // RC-4 · B8 · store.js:101/154 frozenSentence carries patient(...).name; shell.js:53, dailyclose.js:188, moneydesk.js:234 render it verbatim.
    // Negative control: with privacy=1 the same three surfaces show initials (LF) and the full name appears nowhere; the leak lists are empty
    // and the check reports false. The check also requires __proto.privacy === true at each reading so a privacy flag that failed to apply is not scored.
    async 'A-store-1-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money?privacy=1&device=operatory');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const req = await p.evaluate(() => (window.__proto.state().approvals[0] || null));
        const read = (label) => p.evaluate((label) => ({ where: label, privacy: window.__proto.privacy, device: window.__proto.device, persona: window.__proto.persona, andon: (document.getElementById('andon') || {}).textContent || '', canvas: (document.getElementById('canvas') || {}).textContent || '' }), label);
        await hop(p, '#/owner/close?privacy=1&device=operatory'); await p.waitForTimeout(150);
        const closeRead = await read('owner close');
        const closeApprovals = await p.evaluate(() => { const s = [...document.querySelectorAll('section')].find((x) => /^Approvals only I can give/.test(x.getAttribute('aria-label') || '')); return s ? s.textContent : null; });
        await hop(p, '#/owner/money?privacy=1&device=operatory'); await p.waitForTimeout(150);
        await click(p, 'money.tab.approvals'); await p.waitForTimeout(120);
        const moneyRead = await read('owner money approvals tab');
        const moneyApprovals = await p.evaluate(() => { const s = [...document.querySelectorAll('section')].find((x) => (x.getAttribute('aria-label') || '') === 'Approvals'); return s ? s.textContent : null; });
        const NAME = /Lena Fischer/;
        const leaks = { andonOnClose: NAME.test(closeRead.andon), closeApprovalsSection: NAME.test(closeApprovals || ''), andonOnMoney: NAME.test(moneyRead.andon), moneyApprovalsSection: NAME.test(moneyApprovals || '') };
        const privacyHeld = closeRead.privacy === true && moneyRead.privacy === true;
        const reproduced = !!req && privacyHeld && Object.values(leaks).some(Boolean);
        rec('A-store-1-2', 'Under privacy=1 on an operatory device the frozen approval sentence prints the full patient name in the Andon strip, the Daily Close approvals section and the Money Desk Approvals tab', 'B8 — names become initials in headers, cards, read-backs and announcements; frozenSentence is built from patient(...).name at store.js:101/154',
          reproduced, { requestWritten: req ? { id: req.id, frozenSentence: req.frozenSentence } : null, privacyOnClose: closeRead.privacy, privacyOnMoney: moneyRead.privacy, device: closeRead.device, leaks, andonOnClose: closeRead.andon.trim().slice(0, 160), closeApprovalsText: (closeApprovals || '').trim().slice(0, 200), moneyApprovalsText: (moneyApprovals || '').trim().slice(0, 200), initialsPresentOnMoneyCanvas: /\bLF\b/.test(moneyRead.canvas) });
      } finally { await c.close(); }
    },

    // RC-5 · A2/C5 · store.js:243 fileNote releases only status completed_pending_charge; seeded enc-9003 procedures are `completed` and uncharged.
    // Negative control: a correct File writes three `charge` rows for pr-401..403 (releasedByNoteId = the new note) and the $44 credit is absorbed
    // (credit 4400 → 0); then releasedCharges > 0 and the check reports false. The check first requires the note to have filed (filedNotes grows) —
    // a File that never happened is a different failure and is not scored as this one.
    async 'A-store-1-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        if (!(await click(p, 'board.card.a-1044.checkout'))) await hop(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const afterCheckout = await p.evaluate(() => { const S = window.__proto.state(); return { decisions: S.collectionDecisions.filter((d) => d.encounterId === 'enc-9003').length, bal: Proto.store.balances('p-303'), credits: S.credits.map((x) => x.id + ':' + x.amountCents) }; });
        await hop(p, '#/dentist/encounter/enc-9003'); await p.waitForTimeout(150);
        const beforeFile = await p.evaluate(() => { const S = window.__proto.state(); return { filedNotes: S.filedNotes.filter((n) => n.encounterId === 'enc-9003').length, charges: S.ledger.filter((e) => e.kind === 'charge' && ['pr-401', 'pr-402', 'pr-403'].includes(e.procedureId)).length, procs: S.procedures.filter((x) => x.encounterId === 'enc-9003').map((x) => ({ id: x.id, status: x.status, charged: !!x.charged, feeCents: x.feeCents })) }; });
        const seq0 = await lastSeq(p);
        await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(150);
        const gate = await refusalsDom(p);
        await click(p, 'refusal.control'); await p.waitForTimeout(250);
        const afterFile = await p.evaluate(() => { const S = window.__proto.state(); const note = S.filedNotes.filter((n) => n.encounterId === 'enc-9003').pop() || null; return { filedNotes: S.filedNotes.filter((n) => n.encounterId === 'enc-9003').length, noteId: note && note.id, released: S.ledger.filter((e) => e.kind === 'charge' && ['pr-401', 'pr-402', 'pr-403'].includes(e.procedureId)).map((e) => e.id + ':' + e.amountCents), releasedByNote: note ? S.ledger.filter((e) => e.releasedByNoteId === note.id).length : 0, procs: S.procedures.filter((x) => x.encounterId === 'enc-9003').map((x) => ({ id: x.id, status: x.status, charged: !!x.charged })), bal: Proto.store.balances('p-303'), credits: S.credits.map((x) => x.id + ':' + x.amountCents), filedCardText: ((document.querySelector('.enc-filed') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) }; });
        const ev = await after(p, seq0);
        const filed = afterFile.filedNotes > beforeFile.filedNotes;
        const reproduced = afterCheckout.decisions === 1 && filed && afterFile.released.length === 0 && afterFile.bal.credit === afterCheckout.bal.credit && afterFile.bal.credit > 0;
        rec('A-store-1-3', 'After a Filed-later checkout of a-1044, filing the note writes filedNotes and a claim but releases no charges for the seeded completed procedures pr-401..403, so the $44 credit never applies', 'A2, C5 — store.js:243 releases only status completed_pending_charge; postCheckout at :108 uses !p.charged; the two release paths disagree',
          reproduced, { checkoutDecisions: afterCheckout.decisions, balanceAfterCheckout: afterCheckout.bal, creditsAfterCheckout: afterCheckout.credits, readbackGate: gate, noteFiled: filed, noteId: afterFile.noteId, proceduresBefore: beforeFile.procs, proceduresAfter: afterFile.procs, chargesBefore: beforeFile.charges, chargesReleased: afterFile.released, rowsReleasedByNote: afterFile.releasedByNote, balanceAfterFile: afterFile.bal, creditsAfterFile: afterFile.credits, filedCardText: afterFile.filedCardText, writesSinceFile: writes(ev), seqRange: [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0] });
      } finally { await c.close(); }
    },

    // RC-6 · A3 · store.js:120-121 postCheckout sets a.status and pushes to S.credits without write().
    // Negative control: a compliant Post has a `write` event with table `credits` (and the row id) in the seq range of the press, and an
    // appointmentEvents row for the status change; then creditsWriteEvents > 0 and the check reports false. A Post that was refused (no
    // collectionDecisions write) is not scored.
    async 'A-store-1-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        if (!(await click(p, 'board.card.a-1044.checkout'))) await hop(p, '#/frontdesk/checkout/a-1044');
        await click(p, 'checkout.tender.card'); await fill(p, 'checkout.card.number', '4242424242424242');
        const before = await p.evaluate(() => { const S = window.__proto.state(); return { credits: S.credits.map((x) => x.id), status: S.appointments.find((a) => a.id === 'a-1044').status, apptEvents: S.appointmentEvents.length }; });
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(200);
        const afterS = await p.evaluate(() => { const S = window.__proto.state(); return { credits: S.credits.map((x) => x.id), creditRows: S.credits.filter((x) => x.patientId === 'p-303').map((x) => ({ id: x.id, amountCents: x.amountCents, fromLedger: !!x.fromLedger })), status: S.appointments.find((a) => a.id === 'a-1044').status, apptEvents: S.appointmentEvents.length }; });
        const ev = await after(p, seq0);
        const w = ev.filter((e) => e.kind === 'write');
        const posted = w.some((e) => e.table === 'collectionDecisions');
        const creditsAdded = afterS.credits.filter((id) => !before.credits.includes(id));
        const creditsWriteEvents = w.filter((e) => e.table === 'credits').length;
        const apptWriteEvents = w.filter((e) => e.table === 'appointmentEvents' || e.table === 'appointments').length;
        const reproduced = posted && creditsAdded.length > 0 && creditsWriteEvents === 0;
        rec('A-store-1-4', 'Post on a Filed-later checkout appends a credits row and flips the appointment status with no write event for either table', 'A3 — one write event per table a mutation changes; store.js:121 uses S.credits.push, not write()',
          reproduced, { postAccepted: posted, stateDiff: { creditsBefore: before.credits, creditsAfter: afterS.credits, creditsAdded, creditRowsForPatient: afterS.creditRows, statusBefore: before.status, statusAfter: afterS.status, appointmentEventsBefore: before.apptEvents, appointmentEventsAfter: afterS.apptEvents }, writeEventsInRange: writes(ev), creditsWriteEvents, appointmentWriteEvents: apptWriteEvents, seqRange: [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0] });
      } finally { await c.close(); }
    },

    // RC-7 · B2 / CONTRACTS §6 · store.js:140-141 decideApproval raises `blocked_same_person` (rendered by phone.js:95) and `stepup` (sentinel).
    // Negative control: if both codes are in the §6 list parsed from CONTRACTS.md, or the phone card raises a §6 code such as needs_second
    // instead, notInS6 is empty and the check reports false. The rendered code is read from the refusal's data-code and the refusal event, not
    // from any refusal that happens to be on screen.
    async 'A-store-1-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
        const reqId = await p.evaluate(() => (window.__proto.state().approvals[0] || {}).id || null);
        await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        const pressed = reqId ? await click(p, 'phone.request.' + reqId + '.approve') : false; await p.waitForTimeout(150);
        const dom = await refusalsDom(p);
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
        // The pre-check sentinel: a second approver with no step-up gets `stepup` back. No mutation happens before that return.
        const sentinel = reqId ? await p.evaluate((id) => { const r = Proto.store.decideApproval(id, 'u-om-1', 'approved', false); return { ok: r.ok, code: r.code, verb: r.verb, control: r.control }; }, reqId) : null;
        const { codes, searched } = s6Codes();
        const rendered = dom.filter((d) => d.code).map((d) => d.code);
        const raised = [...new Set([...rendered, ...ev.map((e) => e.code), sentinel && sentinel.code].filter(Boolean))];
        const notInS6 = raised.filter((code) => !codes.includes(code));
        const reproduced = pressed && rendered.includes('blocked_same_person') && notInS6.includes('blocked_same_person');
        rec('A-store-1-5', 'The requesting biller pressing Approve on her own request renders a refusal with code blocked_same_person, and the store uses `stepup` as a pre-check code; neither is in CONTRACTS §6', 'B2, CONTRACTS §6 — a code the product raises and the list omits is a defect in one of the two',
          reproduced, { requestId: reqId, approvePressed: pressed, renderedRefusals: dom, refusalEvents: ev, stepupSentinel: sentinel, codesRaised: raised, notInS6, s6Codes: codes, s6TextSearched: searched, persona: await p.evaluate(() => window.__proto.persona) });
      } finally { await c.close(); }
    },

    // RC-8 · B2 · store.js:263 closeDay refuses already_closed with control null; dailyclose.js:206 passes it through.
    // Negative control: a compliant gate renders exactly one [data-testid="refusal.control"] inside the already_closed refusal; then
    // controls === 1 and the check reports false. The first Close day must have succeeded (dayCloses gains dc-loc-1-0903) before the
    // repeat press is scored — a refusal on the first press would be a different code.
    async 'A-store-1-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(200);
        const closed = await p.evaluate(() => window.__proto.state().dayCloses.filter((d) => d.locationId === 'loc-1' && d.date === '2026-09-03').map((d) => d.id));
        const primary = await txt(p, 'close.closeday');
        const seq0 = await lastSeq(p);
        await click(p, 'close.closeday'); await p.waitForTimeout(200);
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'already_closed');
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
        const ctl = await box(p, 'refusal.control');
        const verb = dom.length ? dom[0].verb : null;
        const reproduced = closed.length === 1 && dom.length > 0 && dom[0].controls === 0;
        rec('A-store-1-6', 'Pressing the Held primary after the day is closed renders the already_closed refusal with a verb and Why but zero controls', 'B2 / CONTRACTS §6 — every gate renders exactly one 44 px refusal.control; store.js:263 passes control null',
          reproduced, { dayClosesWritten: closed, primaryLabelAfterClose: primary, alreadyClosedRefusals: dom, verb, verbCount: count(verb), verbFirstWord: verb ? verb.split(/\s+/)[0] : null, refusalControlBox: ctl, refusalEvents: ev, focusAfterPress: await active(p), viewport: '1280x900' });
      } finally { await c.close(); }
    },

    // RC-9 · B2 · store.js:93 refuse('tender_required', 'Choose a tender', null) passes no why; checkout.js:49 adds a control only.
    // Negative control: a compliant refusal has a [data-testid="refusal.why"] summary inside the tender_required refusal; then why === true
    // and the check reports false. Only the refusal whose data-code is tender_required is scored.
    async 'A-store-1-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1044');
        const seg = await p.evaluate(() => (document.querySelector('[data-testid="checkout.collect.seg.collect"]') || {}).getAttribute && document.querySelector('[data-testid="checkout.collect.seg.collect"]').getAttribute('aria-pressed'));
        const tender = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="checkout.tender."]')].map((b) => b.getAttribute('data-testid') + '=' + b.getAttribute('aria-pressed')));
        const seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(150);
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'tender_required');
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
        const ctl = await box(p, 'refusal.control');
        const reproduced = dom.length > 0 && dom[0].why === false;
        rec('A-store-1-7', 'Post with Collect selected and no tender raises tender_required, which renders a verb and one control but no Why disclosure', 'B2 / CONTRACTS §6 — every refusal carries a Why disclosure (refusal.why); store.js:93 passes no why',
          reproduced, { collectPressed: seg, tendersBeforePost: tender, tenderRequiredRefusals: dom, refusalWhyPresent: dom.length ? dom[0].why : null, refusalControlBox: ctl, refusalEvents: ev });
      } finally { await c.close(); }
    },

    // RC-12 · C5/A2 · store.js:54 explain() relates every later row to every earlier charge, so one payment is subtracted from each charge.
    // Negative control: when Explain is right, the per-charge "you owe"/"credit" amounts on the Ledger screen sum to the Patient due number
    // rendered above them for every patient (mismatches = [] and onScreenSum === onScreenPatientDue), and the check reports false.
    // A patient with one charge is trivially consistent, so the check also counts mismatches across all 40 seed patients.
    async 'A-store-1-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-308');
        const survey = await p.evaluate((oweSrc) => {
          const owe = new Function('sentence', oweSrc);
          const S = window.__proto.state(); const out = [];
          for (const pt of S.patients) {
            const rows = Proto.store.explain(pt.id); const bal = Proto.store.balances(pt.id);
            const sum = rows.reduce((s, x) => s + owe(x.sentence), 0);
            const due = bal.patientDue - bal.credit; // Explain speaks in net terms: owe positive, credit negative
            if (rows.length && sum !== due) out.push({ patientId: pt.id, charges: rows.length, explainSumCents: sum, patientDueCents: bal.patientDue, creditCents: bal.credit, sentences: rows.map((x) => x.sentence) });
          }
          return { patients: S.patients.length, mismatches: out };
        }, OWE_SRC);
        const onScreenTarget = survey.mismatches.some((m) => m.patientId === 'p-308') ? 'p-308' : (survey.mismatches[0] || {}).patientId || 'p-308';
        if (onScreenTarget !== 'p-308') { await hop(p, '#/biller/ledger/' + onScreenTarget); await p.waitForTimeout(150); }
        await click(p, 'ledger.explain'); await p.waitForTimeout(150);
        const screen = await p.evaluate(() => {
          const due = document.querySelector('.ledger-page .threenum .n .v'); const dueLabel = document.querySelector('.ledger-page .threenum .n .l');
          const sentences = [...document.querySelectorAll('.ledger-sentence .sentence')].map((e) => e.textContent.trim());
          return { patientDueText: due ? due.textContent.trim() : null, patientDueLabel: dueLabel ? dueLabel.textContent.trim() : null, sentences };
        });
        const parseMoney = (t) => t == null ? null : Math.round(Number(t.replace(/[^\d.]/g, '')) * 100) * (/−|-/.test(t) ? -1 : 1);
        const onScreenSum = screen.sentences.reduce((s, x) => s + owe(x), 0);
        const onScreenDue = parseMoney(screen.patientDueText);
        const reproduced = screen.sentences.length >= 2 && onScreenDue != null && onScreenSum !== onScreenDue && survey.mismatches.length > 0;
        rec('A-store-1-8', 'On the Ledger screen the per-charge Explain sentences ("you owe $X") do not sum to the Patient due number above them, because explain() relates every later payment to every earlier charge', 'C5, A2 — the same fact has one canonical value everywhere; store.js:54 uses effective >= charge.effective as the relation',
          reproduced, { patientOnScreen: onScreenTarget, patientDueOnScreen: screen.patientDueText, patientDueLabel: screen.patientDueLabel, explainSentencesOnScreen: screen.sentences, onScreenExplainSumCents: onScreenSum, onScreenPatientDueCents: onScreenDue, storePatientDue: await p.evaluate((id) => Proto.store.balances(id), onScreenTarget), patientsSurveyed: survey.patients, mismatchCount: survey.mismatches.length, mismatches: survey.mismatches.slice(0, 4).map((m) => ({ patientId: m.patientId, charges: m.charges, explainSumCents: m.explainSumCents, patientDueCents: m.patientDueCents, creditCents: m.creditCents })), mismatchIds: survey.mismatches.map((m) => m.patientId) });
      } finally { await c.close(); }
    },

    // RC-13 · B2 · store.js:199 chartPaint interpolates the CDT name and tooth into the duplicate_paint verb.
    // Negative control: an eight-word-or-shorter verb ("Already charted this visit — Periodic exam" is 6 words) gives words <= 8 and the check
    // reports false. The first paint must have written one chartEvent before the second press is scored; the second press must leave the
    // count at one (a duplicate written would be a different, worse defect and is reported in the evidence).
    async 'A-store-1-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/exams');
        await click(p, 'exams.row.enc-9002.open'); await p.waitForTimeout(200);
        await click(p, 'enc.tag.tag-1.chart'); await p.waitForTimeout(120);
        await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
        const afterFirst = await p.evaluate(() => window.__proto.state().chartEvents.filter((x) => x.encounterId === 'enc-9002').map((x) => x.id + ':' + x.cdt + '#' + x.tooth));
        const seq0 = await lastSeq(p);
        await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'duplicate_paint');
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
        const afterSecond = await p.evaluate(() => window.__proto.state().chartEvents.filter((x) => x.encounterId === 'enc-9002').length);
        const verb = dom.length ? dom[0].verb : null; const n = count(verb);
        const reproduced = afterFirst.length === 1 && dom.length > 0 && n.words > 8;
        rec('A-store-1-9', 'Charting Composite #30 twice raises duplicate_paint whose verb line interpolates the procedure name and tooth and runs past eight words', 'B2 / CONTRACTS §6 — verb line verb-first and at most eight words; store.js:199',
          reproduced, { chartEventsAfterFirstPaint: afterFirst, chartEventsAfterSecondPaint: afterSecond, verb, wordCount: n.words, tokenCount: n.tokens, refusalDom: dom, refusalEvents: ev, route: await p.evaluate(() => location.hash) });
      } finally { await c.close(); }
    },

    // RC-14 · B2 · store.js:285 addDayPass uses pv.conflicts[0].fraudPath (seed.js:220, a full sentence) as the sod_conflict verb.
    // Negative control: an eight-word-or-shorter verb line without a terminal period gives words <= 8 and the check reports false. The store's
    // refusal is told apart from the preview twin (roles.js:143) by its control text 'Remediate, compensate, or accept', and only a refusal
    // event recorded after the Save press with that control is scored; dayPasses must stay at 0 (the gate actually held the write).
    async 'A-store-1-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/roles');
        await click(p, 'roles.daypass.add'); await fill(p, 'roles.daypass.name', 'Tom Ford');
        await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(150);
        const form = await p.evaluate(() => ({ name: (document.querySelector('[data-testid="roles.daypass.name"]') || {}).value, refundPressed: (document.querySelector('[data-testid="roles.daypass.entitlement.refund"]') || {}).getAttribute('aria-pressed'), saveLabel: ((document.querySelector('[data-testid="roles.daypass.save"]') || {}).textContent || '').trim() }));
        const seq0 = await lastSeq(p);
        await click(p, 'roles.daypass.save'); await p.waitForTimeout(200);
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
        const storeGate = ev.find((e) => e.code === 'sod_conflict' && e.control === 'Remediate, compensate, or accept') || null;
        const dom = (await refusalsDom(p)).filter((d) => d.code === 'sod_conflict');
        const dayPasses = await p.evaluate(() => window.__proto.state().dayPasses.length);
        const fraudPath = await p.evaluate(() => (window.__proto.state().sodRules.find((r) => r.id === 'rule-post-refund') || {}).fraudPath);
        const verb = storeGate ? storeGate.verb : null; const n = count(verb);
        const live = await p.evaluate(() => (document.getElementById('live') || {}).textContent || null);
        const reproduced = !!storeGate && dayPasses === 0 && n.words > 8;
        rec('A-store-1-10', 'Issuing a Front desk day pass with the Refund extra is refused with sod_conflict whose verb is the seed fraud-path sentence, ten words with a terminal period', 'B2 — verb line verb-first and at most eight words; store.js:285 passes pv.conflicts[0].fraudPath as the verb',
          reproduced, { formBeforeSave: form, storeRefusalEvent: storeGate, verb, wordCount: n.words, tokenCount: n.tokens, endsWithPeriod: !!verb && /\.$/.test(verb), equalsSeedFraudPath: !!verb && verb === fraudPath, seedFraudPath: fraudPath, refusalEventsAfterSave: ev, sodRefusalsOnScreen: dom, dayPassesWritten: dayPasses, ariaLiveText: live });
      } finally { await c.close(); }
    },
  };
};
