// Audit checks for prototype/js/seed.js, chunk `seed` (root causes RC-11, RC-67, RC-68, RC-78, RC-141).
// Default position is NOT reproduced: every check drives the prototype from a stated start hash and
// device, measures the values the claim depends on, and carries them in the evidence.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  // $150 / $150.00 / $1,642.50 → cents. Used on rendered copy, never on a substring guess.
  const centsOf = (s) => { const m = /\$\s?([\d,]+(?:\.\d\d)?)/.exec(String(s || '')); return m ? Math.round(Number(m[1].replace(/,/g, '')) * 100) : null; };
  const allCents = (s) => [...String(s || '').matchAll(/\$\s?([\d,]+(?:\.\d\d)?)/g)].map((m) => Math.round(Number(m[1].replace(/,/g, '')) * 100));
  const uniq = (a) => [...new Set(a.filter((x) => x != null))];
  // The three-number tiles (rail.js threeNum / checkout.js): value node .v, label node .l.
  const threeNum = (p, scope = '#canvas') => p.evaluate((sc) => [...document.querySelectorAll(sc + ' .threenum .n')]
    .map((n) => ({ label: (n.querySelector('.l') || {}).textContent || null, value: (n.querySelector('.v') || {}).textContent || null })), scope);
  // CONTRACTS §8 read from the file, so the check compares the seed with the contract text, not with a copy of it.
  const s8Row = (id) => {
    const text = fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8');
    const sec = text.slice(text.indexOf('## 8. Seed ids'));
    const line = sec.split('\n').find((l) => l.includes('`' + id + '`')) || null;
    return { section: '## 8. Seed ids the scripts rely on', row: line ? line.trim() : null };
  };

  return {
    // RC-11 · A2/C5 · seed.js:59-61 — the generated ids start at p-308 and run to p-339, so p-320 is created
    // twice: the contract patient Aiko Tanaka (seed.js:55 fixed list) and a generated "Cole Brandt".
    // Negative control: if the generator skipped the ids already taken, `dupNames` would hold one name, the
    // ledger route for p-320 would show the referred-in consult's own account (a-1060 carries balanceCents 0,
    // no seeded ledger rows) and the Patient due tile would read $0.00 — the check then reports false. The
    // check requires all three: two different names on one id, a non-zero Patient due tile rendered under the
    // first record's name, and the seeded appointment balance of 0 it contradicts.
    async 'A-seed-1'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/surgeon/exams');          // start hash from F-store-11 (surgeon, desk, light)
        await hop(p, '#/surgeon/ledger/p-320');  // the alternative repro the finding names
        const m = await p.evaluate(() => {
          const S = window.__proto.state();
          const recs = S.patients.filter((x) => x.id === 'p-320');
          const head = document.querySelector('#canvas .sub, #canvas .pagehead .sub');
          return {
            patientCount: S.patients.length,
            dupNames: recs.map((x) => x.name),
            dupRecords: recs.map((x) => ({ name: x.name, dob: x.dob, mrn: x.mrn, primary: x.primary })),
            storePatient: (Proto.store.patient('p-320') || {}).name,
            storeBalances: Proto.store.balances('p-320'),
            ledgerRows: S.ledger.filter((e) => e.patientId === 'p-320').map((e) => e.id + ':' + e.kind + ':' + e.amountCents + ':' + e.effective),
            appointmentsForId: S.appointments.filter((a) => a.patientId === 'p-320').map((a) => a.id + ':' + a.type + ':' + a.time),
            seededApptBalanceCents: (S.appointments.find((a) => a.id === 'a-1060') || {}).balanceCents,
            h1: (document.querySelector('#canvas h1') || {}).textContent || null,
            identLine: head ? head.textContent.trim() : null,
          };
        });
        m.tiles = await threeNum(p);
        const patientDueTile = (m.tiles.find((t) => /Patient due/i.test(t.label || '')) || {}).value;
        m.patientDueTileCents = centsOf(patientDueTile);
        const duplicated = m.dupNames.length > 1 && uniq(m.dupNames).length > 1;
        const reproduced = duplicated
          && m.storePatient === 'Aiko Tanaka'
          && m.patientDueTileCents > 0
          && m.patientDueTileCents === m.storeBalances.patientDue
          && m.seededApptBalanceCents === 0;
        rec('A-seed-1', 'seed.js generates the id p-320 twice (Aiko Tanaka and a generated Cole Brandt), so the ledger route for p-320 renders the second record\'s rows under the first record\'s name', 'A2, C5 — CHECKLIST A2 (the store does what the name promises) and C5 (one canonical value per fact); CONTRACTS §8 gives p-320 to the referred-in consult a-1060, whose balanceCents is 0',
          reproduced, Object.assign({ duplicatedId: duplicated, patientDueTile }, m));
      } finally { await c.close(); }
    },

    // RC-67 · C5 · seed.js:24 tenant.dualReleaseThresholdCents = 15000 against seed.js:~205 decision d-1
    // ("raised from $150 to $300", status review_due) and store.js:260 reviewDecision (retire → 15000,
    // tighten → 10000) rendered by dailyclose.js:172 as "back to $100.00 (base)" / "back to $150.00".
    // Two separate disagreements are measured, each from its own rendering plus the store value:
    //   current threshold — store/Money Desk hint ($150) against the decision card's in-force raise ($300);
    //   base threshold    — the card and Retire ($150) against Tighten's "(base)" ($100).
    // Negative control: if the seed and the copy agreed (the store holding the value the card says is in
    // force, and one number called the base), each set would collapse to a single value, currentValues and
    // baseValues would have length 1, and the check reports false. It parses only the four named
    // renderings, so an unrelated dollar amount elsewhere on the screen cannot make it fire.
    async 'A-seed-2'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      const second = await ctx(b, 1280, 900);   // Retire needs a page where d-1 is still review_due
      try {
        // Rendering 1: the Money Desk write-off hint (the threshold as the biller reads it).
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306');
        const hint = await p.evaluate(() => ([...document.querySelectorAll('#canvas .hint')].map((e) => e.textContent.trim()).find((t) => /at or above/i.test(t)) || null));
        // Rendering 2: the owner's decision card, and the store value behind it.
        await hop(p, '#/owner/close');
        const card = await p.evaluate(() => {
          const S = window.__proto.state();
          const el = document.querySelector('[data-testid="close.decision.d-1.tighten"]');
          const box = el ? el.closest('[aria-label="Decision d-1"]') : document.querySelector('[aria-label="Decision d-1"]');
          return {
            storeThresholdCents: S.tenant.dualReleaseThresholdCents,
            decision: (S.decisions.find((d) => d.id === 'd-1') || {}),
            cardText: box ? box.textContent.replace(/\s+/g, ' ').trim() : null,
            cardStatement: (S.decisions.find((d) => d.id === 'd-1') || {}).text || null,
          };
        });
        // Rendering 3: Tighten's result line and the value it writes.
        await click(p, 'close.decision.d-1.tighten');
        const tighten = await p.evaluate(() => ({
          line: [...document.querySelectorAll('#canvas span')].map((e) => e.textContent.trim()).find((t) => /^d-1: /.test(t)) || null,
          thresholdCents: window.__proto.state().tenant.dualReleaseThresholdCents,
        }));
        // Rendering 4: Retire's result line and the value it writes (fresh page: one review per decision).
        await go(second.p, '#/owner/close');
        await click(second.p, 'close.decision.d-1.retire');
        const retire = await second.p.evaluate(() => ({
          line: [...document.querySelectorAll('#canvas span')].map((e) => e.textContent.trim()).find((t) => /^d-1: /.test(t)) || null,
          thresholdCents: window.__proto.state().tenant.dualReleaseThresholdCents,
        }));
        const cardAmounts = allCents(card.cardStatement);          // "raised from $150 to $300" → [15000, 30000]
        const cardBase = cardAmounts.length === 2 ? cardAmounts[0] : null;
        const cardInForce = cardAmounts.length === 2 ? cardAmounts[1] : null;
        const hintCents = centsOf(hint);
        const tightenBase = centsOf(tighten.line);
        const retireBase = centsOf(retire.line);
        const currentValues = uniq([card.storeThresholdCents, hintCents, cardInForce]);
        const baseValues = uniq([cardBase, tightenBase, retireBase]);
        const stillApplying = card.decision.status === 'review_due';
        const reproduced = currentValues.length > 1 && baseValues.length > 1 && stillApplying;
        rec('A-seed-2', 'The write-off threshold is three numbers at once: the seed holds $150 while the in-force decision card says it was raised to $300, and Tighten calls $100 the base where the card and Retire call it $150', 'C5 — CHECKLIST C5 (the same fact has one canonical value everywhere it appears); seed.js:24 tenant.dualReleaseThresholdCents against seed.js decision d-1 and store.js:260 reviewDecision',
          reproduced, {
            storeThresholdCents: card.storeThresholdCents,
            decisionText: card.cardStatement, decisionStatus: card.decision.status, decisionReviewBy: card.decision.reviewBy,
            moneyDeskHint: hint, moneyDeskHintCents: hintCents,
            decisionCardText: card.cardText,
            tightenResultLine: tighten.line, thresholdAfterTighten: tighten.thresholdCents,
            retireResultLine: retire.line, thresholdAfterRetire: retire.thresholdCents,
            currentThresholdValuesNamed: currentValues, baseThresholdValuesNamed: baseValues,
          });
      } finally { await c.close(); await second.c.close(); }
    },

    // RC-68 · C5 · seed.js:209 statementsDue — sd-1 bills p-316 $84.00 and sd-2 bills p-319 $212.00, while the
    // ledgers those statements are sent from hold $0.00 and $996.00 patient due.
    // Negative control: if each seeded statement matched its ledger, statementCents would equal the Patient due
    // tile and the store balance for that patient, `mismatches` would be empty and the check reports false. The
    // check compares numbers, not text, and reads both the Money Desk row and the ledger tile so a single
    // mis-rendered number cannot carry it; the second Send is recorded as corroboration only.
    async 'A-seed-3'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/biller/money');
        await click(p, 'money.tab.statements');
        const rows = await p.evaluate(() => {
          const S = window.__proto.state();
          return S.statementsDue.map((s) => {
            const btn = document.querySelector('[data-testid="money.statement.' + s.id + '.send"]');
            const row = btn ? btn.closest('.md-row') : null;
            return {
              id: s.id, patientId: s.patientId, patientName: (Proto.store.patient(s.patientId) || {}).name,
              statementCents: s.amountCents,
              rowText: row ? row.textContent.replace(/\s+/g, ' ').trim() : null,
              rowAmount: row ? (row.querySelector('.amt') || {}).textContent || null : null,
              storeBalances: Proto.store.balances(s.patientId),
              ledgerRowsForPatient: S.ledger.filter((e) => e.patientId === s.patientId).length,
            };
          });
        });
        for (const r of rows) {
          if (r.rowAmount == null && r.rowText) r.rowAmount = (r.rowText.match(/\$[\d,]+\.\d\d/) || [null])[0];
          r.rowAmountCents = centsOf(r.rowAmount);
          await hop(p, '#/biller/ledger/' + r.patientId);
          r.ledgerTiles = await threeNum(p);
          const due = (r.ledgerTiles.find((t) => /Patient due/i.test(t.label || '')) || {}).value;
          r.ledgerPatientDueTile = due;
          r.ledgerPatientDueCents = centsOf(due);
        }
        // Corroboration: the ledger the $84.00 statement is sent from refuses the next Send because nothing is due.
        await hop(p, '#/biller/ledger/p-316');
        await click(p, 'ledger.statement.send');   // sends sd-1 (a statement for a $0.00 balance)
        await click(p, 'ledger.statement.send');   // the ledger's own verdict on that balance
        const gate = await p.evaluate(() => ({
          sendButton: (document.querySelector('[data-testid="ledger.statement.send"]') || {}).textContent || null,
          refusalVerb: (document.querySelector('[data-testid="refusal.verb"]') || {}).textContent || null,
          refusalCode: (document.querySelector('.refusal') || {}).getAttribute ? document.querySelector('.refusal').getAttribute('data-code') : null,
          disclosuresWritten: (window.__proto.state().disclosures || []).length,
        }));
        const mismatches = rows.filter((r) => r.statementCents !== r.storeBalances.patientDue && r.statementCents === r.rowAmountCents && r.ledgerPatientDueCents === r.storeBalances.patientDue);
        rec('A-seed-3', 'The seeded statements-due amounts do not match the ledgers they are sent from: sd-1 bills $84.00 on a $0.00 patient-due account and sd-2 bills $212.00 on a $996.00 one', 'C5 — CHECKLIST C5 (Board balance = ledger = checkout portion: one canonical value per fact); seed.js:209 statementsDue against store.js:33 balances',
          mismatches.length > 0, { statements: rows, mismatchIds: mismatches.map((r) => r.id), secondSendOnP316: gate });
      } finally { await c.close(); }
    },

    // RC-78 · B8 · seed.js:55 puts the guardian's full name in p-307's alert text ("Minor: guardian Alicia
    // Price"); chairs.js:127 and rail.js:113 render alerts verbatim, so the surname stands on operatory glass
    // in privacy mode next to the patient's own initials.
    // Negative control: if the seed carried initials (or privacy shortened the alert), the chip and the rail
    // bar would hold no given-name+surname pair, `namesInAlert` would be empty and the check reports false.
    // The check first proves privacy is actually engaged — __proto.privacy true and the card's own who-line
    // showing "DP", not "Devon Price" — so a privacy flag that failed to apply cannot be scored as a leak.
    async 'A-seed-4'(b) {
      const { c, p } = await ctx(b, 1024, 768);
      try {
        await go(p, '#/hygienist/chairs?privacy=1&device=operatory');
        const card = await p.evaluate(() => {
          const el = document.querySelector('[data-testid="chairs.card.a-1050"]');
          return {
            privacyOn: window.__proto.privacy === true,
            device: window.__proto.device,
            seedAlerts: (Proto.store.patient('p-307') || {}).alerts,
            seedPatientName: (Proto.store.patient('p-307') || {}).name,
            whoLine: el ? (el.querySelector('.who') || {}).textContent.trim() : null,
            alertChips: el ? [...el.querySelectorAll('.ch-alerts .chip')].map((x) => x.textContent.trim()) : null,
            cardAriaLabel: el ? el.getAttribute('aria-label') : null,
          };
        });
        await click(p, 'chairs.card.a-1050.rail');
        const rail = await p.evaluate(() => {
          const r = document.getElementById('rail');
          const bar = r ? r.querySelector('[data-testid="rail.alert"]') : null;
          return {
            railName: r ? (r.querySelector('.name') || {}).textContent : null,
            alertBar: bar ? bar.textContent.trim() : null,
            alertAnnouncement: bar ? bar.getAttribute('aria-label') : null,
          };
        });
        // A given-name + surname pair inside the alert copy, and it is not the patient's own name (which privacy already reduced to initials).
        const NAME = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
        const namesIn = (s) => [...String(s || '').matchAll(NAME)].map((m) => m[0]);
        const namesInAlert = uniq([].concat(...(card.alertChips || []).map(namesIn), namesIn(rail.alertBar)));
        // "DP" as a standalone token (the who-line reads "7:30 · DP◆Filed later", so the boundary is non-letter, not whitespace).
        const initials = /(^|[^A-Za-z])DP([^A-Za-z]|$)/;
        const initialsOnly = initials.test(card.whoLine || '') && initials.test(card.cardAriaLabel || '') && (rail.railName || '').trim() === 'DP'
          && !/Devon Price/.test((card.whoLine || '') + (card.cardAriaLabel || '') + (rail.railName || ''));
        const reproduced = card.privacyOn && initialsOnly && namesInAlert.length > 0 && namesInAlert.some((n) => n !== card.seedPatientName);
        rec('A-seed-4', 'In privacy mode on operatory glass the patient is "DP" but the seeded alert text prints the guardian\'s full name, "Minor: guardian Alicia Price", on the Chairs card, in the rail alert bar and in its read-aloud announcement', 'B8 — CHECKLIST B8 (privacy mode: names become initials in headers, cards, read-backs, palette rows, announcements; nothing leaks); seed.js:55 alert text rendered by chairs.js:127 and rail.js:113',
          reproduced, Object.assign({ namesInAlert, initialsOnly }, card, rail));
      } finally { await c.close(); }
    },

    // RC-141 · C5 · seed.js:131 estimates['a-1046'].patientCents = 16800 (d0140 $90 + d0274 $78) where
    // CONTRACTS §8 says Samir Haddad "pays a $180 exam in full".
    // Negative control: if the seed and the contract agreed, contractCents would equal estimateCents and the
    // rendered checkout total, `renderedCents` would contain 18000, and the check reports false. The §8 row is
    // read from prototype/CONTRACTS.md and carried verbatim; if the row cannot be found the check reports false
    // rather than assuming the contract text.
    async 'A-seed-5'(b) {
      const { c, p } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/frontdesk/checkout/a-1046');
        const m = await p.evaluate(() => {
          const S = window.__proto.state();
          const foot = [...document.querySelectorAll('#canvas tfoot th')].map((e) => e.textContent.trim());
          return {
            estimate: S.estimates['a-1046'],
            apptBalanceCents: (S.appointments.find((a) => a.id === 'a-1046') || {}).balanceCents,
            procedures: S.procedures.filter((x) => x.encounterId === 'enc-9005').map((x) => x.cdt + ':' + x.feeCents),
            h1: (document.querySelector('#canvas h1') || {}).textContent || null,
            checkoutTotalsRow: foot,
            estimateCells: [...document.querySelectorAll('#canvas .co-est')].map((e) => e.textContent.trim()),
            amountField: (document.querySelector('[data-testid="checkout.amount"]') || {}).value || null,
          };
        });
        const contract = s8Row('a-1046');
        const contractCents = centsOf(contract.row);
        const estimateCents = m.estimate ? m.estimate.patientCents : null;
        const renderedCents = uniq([].concat(allCents(m.checkoutTotalsRow.join(' ')), allCents((m.amountField || '').replace(/^/, '$'))));
        const reproduced = contract.row != null && contractCents != null && estimateCents != null
          && contractCents !== estimateCents && !renderedCents.includes(contractCents);
        rec('A-seed-5', 'The seed prices Samir Haddad\'s a-1046 visit at $168.00 (and the checkout screen renders $168.00) where CONTRACTS §8 says he "pays a $180 exam in full"', 'C5 — CHECKLIST C5 (the same fact has one canonical value everywhere) with CONTRACTS §8 as the source of authority for seed ids',
          reproduced, Object.assign({ contractSection: contract.section, contractRow: contract.row, contractCents, estimateCents, renderedCents }, m));
      } finally { await c.close(); }
    },
  };
};
