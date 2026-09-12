// Audit checks for the beta-storm findings fixed in prototype/js/store.js (encounter, perio and disclosure
// verbs), prototype/js/screens/encounter.js and prototype/css/components.css (encounter layout). Default
// position is NOT reproduced: every check measures the breach it claims, carries its preconditions in the
// evidence, and closes its browser context in `finally` so one failure cannot hang the run.
export default ({ ctx, go, hop, click, txt, state, events, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;
  const fill = async (p, t, v) => { if (!(await p.$(tid(t)))) return false; await p.fill(tid(t), v); await p.waitForTimeout(60); return true; };
  const blur = async (p) => { await p.click('#canvas h1'); await p.waitForTimeout(400); };
  const lastSeq = (p) => p.evaluate(() => (window.__events.length ? window.__events[window.__events.length - 1].seq : 0));
  const after = async (p, seq0) => (await events(p)).filter((e) => e.seq > seq0);
  const refusals = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim(), section: (r.closest('section') && r.closest('section').getAttribute('aria-label')) || null, inGate: !!r.closest('#enc-gate-area') })));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute && a.getAttribute('data-testid')) || a.tagName; });
  const canvas = (p) => p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim());
  const has = (p, t) => p.$(tid(t)).then((x) => !!x);
  const inView = (p, t) => p.$eval(tid(t), (e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), innerHeight: window.innerHeight, inView: b.top >= 0 && b.bottom <= window.innerHeight }; }).catch(() => null);
  const paint30 = async (p) => { await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); };
  const live = (S, encId) => S.chartEvents.filter((c) => c.encounterId === encId && !c.reversed && c.kind !== 'reversal');
  const fileThrough = async (p) => { await click(p, 'enc.file'); await click(p, 'refusal.control'); await p.waitForTimeout(150); };
  const sites = (depth, n, skipFirst) => { const o = {}; for (let i = 0; i < n; i++) o['t' + (1 + Math.floor(i / 6)) + '-s' + (1 + (i % 6))] = (skipFirst && i === 0) ? { skipped: true } : { depth: i === 0 ? depth : 2 }; return o; };

  return {
    // encounter-1: fileNote released every uncharged procedure, the reversed one included, so Undo then File
    // wrote a $260.00 charge for a paint the record says was reversed. Negative control: no charge row names
    // a reversed procedure and the filed card counts only standing paints.
    async 'A-storm-enc-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.undo');
        await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740'); await click(p, 'enc.note.starter.2');
        await fileThrough(p);
        const S = await state(p);
        const rev = S.procedures.filter((x) => x.encounterId === 'enc-9003' && x.reversed);
        const charged = S.ledger.filter((e) => e.kind === 'charge' && rev.some((x) => x.id === e.procedureId));
        rec('A-storm-enc-1', 'After Undo reverses the #30 composite, File still releases the reversed procedure as a $260.00 ledger charge', 'docs/01 principle 9 — money never posts for work not done; docs/13 feature 9/10 (store.js fileNote)',
          rev.length > 0 && S.filedNotes.some((f) => f.encounterId === 'enc-9003') && charged.length > 0, { reversed: rev.map((x) => x.id + ':' + x.status), chargesForReversed: charged.map((e) => e.id + ':' + e.amountCents), filed: S.filedNotes.length });
      } finally { await c.close(); }
    },

    // encounter-2: the duplicate check read chartEvents only, so the seeded D0120 on enc-9003 was painted again
    // and File released two $65.00 exams; the screen showed no card for the three seeded procedures. Negative
    // control: the second D0120 is refused (duplicate_paint), one D0120 charge, and a card per seeded procedure.
    async 'A-storm-enc-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        const seeded = (await state(p)).procedures.filter((x) => x.encounterId === 'enc-9003').map((x) => x.id + ':' + x.cdt);
        const cards = await p.$$eval('.enc-tx', (l) => l.length);
        await click(p, 'enc.tooth.3'); await click(p, 'enc.proc.d0120');
        const gate = (await refusals(p)).map((r) => r.code);
        await fill(p, 'enc.note.field.assessment', 'Recall exam; no new caries.'); await blur(p);
        await fileThrough(p);
        const S = await state(p);
        const d0120 = S.ledger.filter((e) => e.patientId === 'p-303' && e.kind === 'charge' && e.cdt === 'd0120');
        rec('A-storm-enc-2', 'The encounter renders no transaction card for the three seeded procedures on enc-9003, and painting D0120 again is not refused, so File releases two $65.00 exams on one visit', 'docs/13 beta amendment feature 9 — a duplicate clinical gesture is refused, not absorbed; docs/04 one canonical view per fact (store.js chartPaint, encounter.js renderTransactions)',
          seeded.length === 3 && (cards === 0 || (!gate.includes('duplicate_paint') && d0120.length >= 2)), { seededProcedures: seeded, txCardsOnOpen: cards, gateAfterSecondD0120: gate, d0120Charges: d0120.map((e) => e.id + ':' + e.procedureId) });
      } finally { await c.close(); }
    },

    // encounter-3: noteKillers counted reversed chart events, so a note saying #30 after the #30 paint was undone
    // raised no contradiction and filed. Negative control: killers include contradiction and the note is not filed.
    async 'A-storm-enc-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.undo');
        await click(p, 'enc.tooth.19'); await click(p, 'enc.proc.d2740');
        await fill(p, 'enc.note.field.assessment', 'Fractured cusp #30, no pulpal exposure.'); await fill(p, 'enc.note.field.plan', 'Crown #30 today.'); await blur(p);
        const killers = await p.evaluate(() => Proto.store.noteKillers('enc-9003', Proto.screens.encounter.state('enc-9003').note).map((k) => k.code));
        await fileThrough(p);
        const S = await state(p);
        const f = S.filedNotes.find((n) => n.encounterId === 'enc-9003') || null;
        const teeth = live(S, 'enc-9003').map((x) => x.tooth);
        rec('A-storm-enc-3', 'With the #30 paint reversed and #19 the only standing paint, a note that says #30 raises no contradiction and files', 'docs/13 feature 11 — chart, note and claim name the same tooth; feature 9 — the record reads the standing paints (store.js noteKillers)',
          teeth.length === 1 && teeth[0] === 19 && !killers.includes('contradiction') && !!f && /#30/.test(f.markdown), { liveTeeth: teeth, killers, filedMarkdown: f && f.markdown });
      } finally { await c.close(); }
    },

    // encounter-4: after Undo the reversed event still counted as "already charted", so repainting was refused and
    // the gate's Undo control had nothing to undo: no gate, no write, focus on the body. Negative control: the
    // repaint writes a new chart event and no duplicate_paint gate stands.
    async 'A-storm-enc-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await paint30(p); await click(p, 'enc.undo');
        const liveBefore = live(await state(p), 'enc-9002').length;
        await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.proc.d2392');
        const gate = (await refusals(p)).find((r) => r.code === 'duplicate_paint') || null;
        await click(p, 'refusal.control'); await p.waitForTimeout(120);
        const writes = (await after(p, seq0)).filter((e) => e.kind === 'write').map((e) => e.table + ':' + e.id);
        const S = await state(p);
        rec('A-storm-enc-4', 'After Undo, repainting D2392 on #30 is refused as duplicate_paint because the reversed event still counts, and the gate\'s "Undo the first one" control does nothing', 'CONTRACTS §6 — a refusal with nowhere to go is a dead end; docs/13 feature 9 (store.js chartPaint, encounter.js paint/undo)',
          liveBefore === 0 && !!gate && live(S, 'enc-9002').length === 0, { liveBeforeRepaint: liveBefore, gate, writesAfterPaintAndControl: writes, liveAfter: live(S, 'enc-9002').length, focus: await focused(p) });
      } finally { await c.close(); }
    },

    // encounter-5: the screen refused tooth_required before asking whether the code belongs to the visit, so a
    // periodic exam could not be charted without picking a tooth the store then discards. Negative control:
    // D0120 with no tooth writes one chart event with tooth null and raises no gate.
    async 'A-storm-enc-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        const seq0 = await lastSeq(p);
        await click(p, 'enc.proc.d9243');
        const ev = (await after(p, seq0)).filter((e) => e.kind === 'refusal').map((e) => e.code);
        const ces = (await state(p)).chartEvents.filter((x) => x.encounterId === 'enc-9003');
        rec('A-storm-enc-5', 'A whole-patient code (IV sedation D9243) cannot be charted without first picking a tooth: the strip refuses tooth_required although the store discards the tooth for that code', 'docs/13 beta amendment feature 9 — a service that belongs to the visit carries no tooth (encounter.js paint)',
          ev.includes('tooth_required') && ces.length === 0, { refusals: ev, chartEvents: ces.map((x) => x.cdt + ':' + x.tooth), gates: await refusals(p) });
      } finally { await c.close(); }
    },

    // encounter-6: chartPaint wrote a planItems row for every temporality, so an Existing crown carried a 50%
    // estimate and a plan card that said what the patient would owe. Negative control: no plan item, no plan card.
    async 'A-storm-enc-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003');
        await click(p, 'enc.tooth.14'); await click(p, 'enc.temporality.existing'); await click(p, 'enc.proc.d2740');
        const S = await state(p);
        const ce = S.chartEvents.find((x) => x.encounterId === 'enc-9003') || null;
        const pl = S.planItems.filter((x) => x.encounterId === 'enc-9003');
        const card = await p.evaluate(() => { const e = document.querySelector('[aria-label="Plan card"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
        rec('A-storm-enc-6', 'Painting an Existing crown writes a planItems row with a 50% estimate and shows a plan card saying "You\'d owe about $590.00" for a crown placed elsewhere', 'docs/13 feature 9 — Existing creates no plan item, charge, or module (store.js chartPaint)',
          !!ce && ce.temporality === 'existing' && (pl.length > 0 || !!card), { chartEvent: ce && ce.cdt + ':' + ce.temporality, planItems: pl, planCard: card });
      } finally { await c.close(); }
    },

    // encounter-7: the outage gate's "Support line" control only cleared or kept the gate: nothing announced,
    // nothing logged, focus on the body. Negative control: the press announces the support line and focus stays
    // on a control.
    async 'A-storm-enc-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?outage=1');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2392');
        const gate = (await refusals(p)).find((r) => r.code === 'outage') || null;
        const live0 = await p.$eval('#live', (e) => e.textContent);
        await click(p, 'refusal.control'); await p.waitForTimeout(150);
        const live1 = await p.$eval('#live', (e) => e.textContent);
        const focus = await focused(p);
        rec('A-storm-enc-7', 'Under outage the paint gate\'s "Support line" control does nothing: no announcement, no event beyond the click, focus drops to the body', 'CONTRACTS §6 — a gate\'s control does what its label says; docs/04 focus never lands on the page body (encounter.js paint)',
          !!gate && live1 === live0 && focus === 'BODY', { gate, liveBefore: live0, liveAfter: live1, focus });
      } finally { await c.close(); }
    },

    // encounter-8: a File refusal that was neither a killer nor the read-back went into the Chart section's gate
    // slot, and the primary kept the irreversible identity labelled File. Negative control: the gate stands in
    // #enc-gate-area and enc.file reads exactly Held.
    async 'A-storm-enc-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9003?outage=1');
        await fill(p, 'enc.note.field.assessment', 'Recall exam; no new caries.'); await blur(p);
        await click(p, 'enc.file'); await p.waitForTimeout(150);
        const label = await txt(p, 'enc.file'); const cls = await p.$eval(tid('enc.file'), (e) => e.className);
        const gate = (await refusals(p)).find((r) => r.code === 'outage') || null;
        const filed = (await state(p)).filedNotes.length;
        rec('A-storm-enc-8', 'Under outage, pressing File leaves the primary labelled File in the irreversible identity and renders the outage gate inside the Chart section, not the filing gate', 'CONTRACTS §6 — the primary switches to Held while its gate stands; the gate stands beside the control it refused (encounter.js doFile/renderGate)',
          !!gate && filed === 0 && (label !== 'Held' || !gate.inGate), { fileLabel: label, fileClass: cls, gate, filedNotes: filed });
      } finally { await c.close(); }
    },

    // encounter-9: dismissTag had no licence test, so a hygienist dismissed the for-dentist tag under her own name.
    // Negative control: the store refuses (licence_scope) and tag-1 stays open.
    async 'A-storm-enc-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/encounter/enc-9002');
        const role = await p.evaluate(() => Proto.store.currentUser().role);
        await click(p, 'enc.tag.tag-1.dismiss'); await fill(p, 'enc.tag.tag-1.reason', 'Stain, not caries'); await click(p, 'enc.tag.tag-1.dismiss');
        const direct = await p.evaluate(() => Proto.store.dismissTag('tag-1', 'Stain, not caries'));
        const t = (await state(p)).tags.find((x) => x.id === 'tag-1');
        rec('A-storm-enc-9', 'A hygienist dismisses the for-dentist tag: tag-1 is written dismissed with dispositionBy Bree Lawson and no dentist has seen it', 'docs/13 feature 7 — the disposition carries the dentist\'s attribution; licence scope enforced at the API (store.js dismissTag, encounter.js renderTag)',
          role === 'hygienist' && (t.disposition === 'dismissed' || direct.ok === true), { role, tag: { disposition: t.disposition, dispositionBy: t.dispositionBy || null }, directStoreCall: direct.ok ? 'ok' : direct.code, dismissOffered: await has(p, 'enc.tag.tag-1.dismiss') });
      } finally { await c.close(); }
    },

    // encounter-10: fileNote wrote a claim for every filed note, so enc-9010 (no procedures) queued a claim with no
    // CDT and $0 to Delta Dental. Negative control: no claim is written when nothing was released.
    async 'A-storm-enc-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9010');
        const procs = (await state(p)).procedures.filter((x) => x.encounterId === 'enc-9010').length;
        await fill(p, 'enc.note.field.assessment', 'Prophylaxis completed, no findings.'); await blur(p);
        await fileThrough(p);
        const S = await state(p);
        const claim = S.claims.find((x) => x.patientId === 'p-307' && x.status === 'scrubbed') || null;
        const text = await canvas(p);
        rec('A-storm-enc-10', 'Filing enc-9010, which holds no procedure, writes a claim with no CDT and $0.00 to Delta Dental and prints "Claim queued" on the filed card', 'docs/13 feature 10; docs/01 principle 9 — a record that names nothing is not written (store.js fileNote)',
          procs === 0 && S.filedNotes.some((f) => f.encounterId === 'enc-9010') && (!!claim && !claim.cdt || /Claim queued/.test(text)), { proceduresOnEncounter: procs, claim, filedCard: text.slice(0, 300) });
      } finally { await c.close(); }
    },

    // encounter-12: the released charge took insuranceExpectedCents from the seed estimate only, so with none on
    // file the $260 composite read Patient due $260.00 / Waiting on insurance $0.00 beside a plan card that said
    // the plan pays $130. Negative control: the charge carries 13000 and balances split 13000/13000.
    async 'A-storm-enc-11'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await paint30(p); await click(p, 'enc.note.starter.0'); await fileThrough(p);
        const S = await state(p);
        const pl = S.planItems.find((x) => x.encounterId === 'enc-9002' && !x.reversed) || null;
        const ch = S.ledger.find((e) => e.patientId === 'p-302' && e.kind === 'charge' && e.cdt === 'd2392') || null;
        const bal = await p.evaluate(() => Proto.store.balances('p-302'));
        rec('A-storm-enc-11', 'After filing enc-9002 the $260.00 charge carries insuranceExpectedCents 0 and the Ledger reads Patient due $260.00 / Waiting on insurance $0.00 while the plan card says the plan pays about $130.00', 'docs/13 feature 23 — a charge a plan is expected to cover waits on insurance; two screens cannot disagree on one fact (store.js fileNote)',
          !!pl && pl.estimateCents === 13000 && !!ch && (ch.insuranceExpectedCents === 0 || bal.insurancePending === 0), { planEstimate: pl && pl.estimateCents, charge: ch && { id: ch.id, amountCents: ch.amountCents, insuranceExpectedCents: ch.insuranceExpectedCents }, balances: bal });
      } finally { await c.close(); }
    },

    // encounter-14: the Dismiss outage verb ran to nine words. Negative control: every outage verb the encounter
    // raises is eight words or fewer.
    async 'A-storm-enc-12'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?outage=1');
        await click(p, 'enc.tag.tag-1.dismiss'); await fill(p, 'enc.tag.tag-1.reason', 'No caries on BWX'); await click(p, 'enc.tag.tag-1.dismiss');
        const direct = await p.evaluate(() => Proto.store.dismissTag('tag-1', 'No caries on BWX'));
        const verb = direct.ok ? null : direct.verb;
        const words = verb ? verb.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length : 0;
        rec('A-storm-enc-12', 'The outage verb for Dismiss, "Wait for the server — the tag cannot be dismissed", is nine words', 'CONTRACTS §6 — at most eight words (store.js dismissTag)',
          direct.code === 'outage' && words > 8, { verb, words, onScreen: await refusals(p) });
      } finally { await c.close(); }
    },

    // encounter-15: the filed card printed "Claim queued" unconditionally and looked the claim up by patient, so
    // the seeded filed encounter enc-9004 (no claim, no note row) said a claim was queued. Negative control: the
    // card names no claim when the store holds none for the encounter.
    async 'A-storm-enc-13'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9004');
        const S = await state(p);
        const claims = S.claims.filter((x) => x.patientId === 'p-304').length;
        const text = await canvas(p);
        rec('A-storm-enc-13', 'The seeded filed encounter enc-9004 renders a card that says "Claim queued" while the store holds no claim for p-304 and no filed note for the encounter', 'docs/04 one canonical view per fact (encounter.js renderFiledCard)',
          claims === 0 && /Filed/.test(text) && /Claim queued/.test(text), { claimsForP304: claims, filedNotesForEnc: S.filedNotes.filter((f) => f.encounterId === 'enc-9004').length, card: text.slice(0, 300) });
      } finally { await c.close(); }
    },

    // encounter-16: the duplicate check matched code and tooth only, so D2392 #30 OM after D2392 #30 DO was refused.
    // Negative control: two chart events, no gate.
    async 'A-storm-enc-14'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392');
        await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.m');
        const sel = await p.$eval('#enc-selected', (e) => e.textContent);
        await click(p, 'enc.proc.d2392');
        const gate = (await refusals(p)).find((r) => r.code === 'duplicate_paint') || null;
        const n = live(await state(p), 'enc-9002').length;
        rec('A-storm-enc-14', 'After D2392 on #30 DO, D2392 on #30 OM is refused as duplicate_paint although a duplicate is the same code, tooth and surfaces', 'docs/13 beta amendment feature 9 — the same code on the same tooth and surfaces twice is refused (store.js chartPaint)',
          /O M/.test(sel) && !!gate && n === 1, { selectedBeforeSecondPress: sel, gate, liveChartEvents: n });
      } finally { await c.close(); }
    },

    // encounter-17: chartPaint marked every open tag on the tooth charted whatever the temporality, so an Existing
    // crown stood in for a disposition of the caries finding. Negative control: tag-1 stays open.
    async 'A-storm-enc-15'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        await click(p, 'enc.tooth.30'); await click(p, 'enc.temporality.existing'); await click(p, 'enc.proc.d2740');
        const S = await state(p);
        const ce = S.chartEvents.find((x) => x.encounterId === 'enc-9002') || null;
        const t = S.tags.find((x) => x.id === 'tag-1');
        rec('A-storm-enc-15', 'Painting an Existing crown on #30 flips the hygienist tag "Suspected caries #30 DO" to Charted', 'docs/13 feature 7 — a tag leaves the record only by Chart it or a dismissal with a reason; feature 9 — Existing is history (store.js chartPaint)',
          !!ce && ce.temporality === 'existing' && t.disposition === 'charted', { chartEvent: ce && ce.cdt + ':' + ce.temporality, tagDisposition: t.disposition });
      } finally { await c.close(); }
    },

    // encounter-18: the read-back Why printed the date of birth under privacy mode while the header and the detail
    // line hid it. Negative control: no 1990 anywhere on the gate.
    async 'A-storm-enc-16'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002?privacy=1');
        await paint30(p); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(150);
        const why = await p.$eval('#enc-gate .whytext', (e) => e.textContent).catch(() => null);
        const detail = await p.evaluate(() => [...document.querySelectorAll('#enc-gate-area .small.muted')].map((e) => e.textContent).find((t) => /^Filing as/.test(t)) || null);
        rec('A-storm-enc-16', 'Under privacy the read-back detail line hides the date of birth while the gate\'s Why prints "born 11/2/1990"', 'docs/04 beta amendment — privacy mode covers every surface that carries a name, including gate copy (store.js fileNote)',
          !!why && /1990/.test(why) && !!detail && !/1990/.test(detail), { why, detail });
      } finally { await c.close(); }
    },

    // encounter-19: below 1280 px the note and the filing gate stacked under tags, odontogram and cards, so the
    // primary sat 1,277 px down on open at 1024x768 and 1,582 px at 420x860. Negative control: enc.file is in the
    // viewport on open, after a paint and at the read-back on both viewports.
    async 'A-storm-enc-17'(b) {
      const out = {};
      for (const [w, hgt] of [[1024, 768], [420, 860]]) {
        const { c, p } = await ctx(b, w, hgt);
        try {
          await go(p, '#/dentist/encounter/enc-9002');
          const open = await inView(p, 'enc.file');
          await paint30(p);
          const painted = await inView(p, 'enc.file');
          await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(150);
          const readback = await inView(p, 'enc.file');
          out[w + 'x' + hgt] = { open, painted, readback, overflow: await p.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth) };
        } finally { await c.close(); }
      }
      const stages = Object.values(out).flatMap((o) => [o.open, o.painted, o.readback]);
      rec('A-storm-enc-17', 'At 1024x768 and 420x860 the encounter\'s primary File button sits far below the fold on open, after painting and at the read-back gate', 'brief category 7 — the primary action above the fold; docs/04 home is the work (components.css .enc-layout)',
        stages.every((s) => !!s) && stages.some((s) => !s.inView), out);
    },

    // chairs-perio-7: the addendum summary named the prior exam by its row id ("Perio addendum to exam pe-2").
    // Negative control: the derived note carries no pe-<n> token; the exam row still links amendsExamId.
    async 'A-storm-enc-18'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        await p.keyboard.type('3'.repeat(168), { delay: 0 }); await p.waitForTimeout(60);
        await click(p, 'perio.save'); await click(p, 'perio.amend'); await click(p, 'refusal.control');
        await p.keyboard.press('ArrowLeft'); await p.keyboard.type('7'); await p.waitForTimeout(60);
        await click(p, 'perio.save'); await p.waitForTimeout(150);
        const S = await state(p);
        const exams = S.perioExams.filter((e) => e.encounterId === 'enc-9001');
        const note = (S.notes['enc-9001'] || {}).perioSummary || '';
        const card = await p.evaluate(() => [...document.querySelectorAll('.pe-saved .pe-note')].map((e) => e.textContent).join(' '));
        rec('A-storm-enc-18', 'The perio addendum derives the hygiene note as "Perio addendum to exam pe-2 (…)": a raw row id in a clinical note', 'docs/13 feature 6 — the derived note reads measurement words; C3 no raw row ids on screen (store.js savePerio)',
          exams.length === 2 && exams[1].kind === 'addendum' && (/\bpe-\d+\b/.test(note) || /\bpe-\d+\b/.test(card)), { exams: exams.map((e) => e.id + ':' + e.kind + ':' + (e.amendsExamId || '')), note, card });
      } finally { await c.close(); }
    },

    // chairs-perio-2 / chairs-perio-11 (store parts): savePerio stored a licence with skipped 0, and wrote
    // "SRP evidence: 1 sites". Driven on the store verb directly. Negative control: licence null when nothing was
    // skipped, and "1 site" in the singular.
    async 'A-storm-enc-19'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        const o = await p.evaluate((s) => {
          const r = Proto.store.savePerio('enc-9001', s, { mode: 'full', licence: 'crown_margin' });
          const S = window.__proto.state();
          return { ok: r.ok, code: r.code || null, exam: r.exam ? { skipped: r.exam.skipped, licence: r.exam.licence } : null, srp: (S.notes['enc-9001'] || {}).srpEvidence || null };
        }, sites(7, 168, false));
        rec('A-storm-enc-19', 'savePerio with nothing skipped stores licence "crown_margin" on the exam row, and with one deep site writes "SRP evidence: 1 sites at or above 5 mm"', 'docs/13 feature 5 — one licence only for the skipped set; docs/01 licences read as words a record can carry (store.js savePerio)',
          o.ok === true && o.exam.skipped === 0 && (!!o.exam.licence || /\b1 sites\b/.test(o.srp || '')), o);
      } finally { await c.close(); }
    },

    // invariants-12: savePerio had no already-saved guard, so two dispatches of Save wrote pe-2 and pe-3 from one
    // chart. Driven on the store verb: the second plain save must refuse (exam_sealed) and write no row.
    async 'A-storm-enc-20'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/hygienist/perio/enc-9001');
        const o = await p.evaluate((s) => {
          const n0 = window.__proto.state().perioExams.filter((e) => e.encounterId === 'enc-9001').length;
          const a = Proto.store.savePerio('enc-9001', s, { mode: 'full' });
          const b2 = Proto.store.savePerio('enc-9001', s, { mode: 'full' });
          const amend = Proto.store.savePerio('enc-9001', s, { mode: 'full', amending: true });
          const n1 = window.__proto.state().perioExams.filter((e) => e.encounterId === 'enc-9001').length;
          return { before: n0, first: a.ok ? 'ok' : a.code, second: b2.ok ? 'ok' : b2.code, amend: amend.ok ? 'ok' : amend.code, after: n1 };
        }, sites(3, 168, false));
        rec('A-storm-enc-20', 'Two saves of one perio chart write two perioExams rows: the store has no already-saved guard and relies on the screen swapping Save for Amend', 'docs/01 principle 9 / CONTRACTS §7 — Save exam is once only; the store enforces idempotence (store.js savePerio)',
          o.first === 'ok' && o.second === 'ok', o);
      } finally { await c.close(); }
    },

    // invariants-13: chartPaint, chartUndo and savePerio rewrote S.notes[encId] with no event naming the notes
    // table. Negative control: each mutation logs a write event for table notes.
    async 'A-storm-enc-21'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const seq0 = await lastSeq(p); const n0 = JSON.stringify((await state(p)).notes);
        await paint30(p);
        const n1 = JSON.stringify((await state(p)).notes);
        const paintWrites = (await after(p, seq0)).filter((e) => e.kind === 'write').map((e) => e.table);
        const seq1 = await lastSeq(p);
        await click(p, 'enc.undo');
        const undoWrites = (await after(p, seq1)).filter((e) => e.kind === 'write').map((e) => e.table);
        const perio = await p.evaluate((s) => { const seq = window.__events.length ? window.__events[window.__events.length - 1].seq : 0; Proto.store.savePerio('enc-9001', s, { mode: 'full' }); return window.__events.filter((e) => e.seq > seq && e.kind === 'write').map((e) => e.table); }, sites(3, 168, false));
        rec('A-storm-enc-21', 'Chart paint, Undo and a perio save each rewrite state().notes[encId] with no write event naming the notes table', 'CONTRACTS §5 — every in-place edit is logged with its table and id (store.js chartPaint/chartUndo/savePerio)',
          n0 !== n1 && paintWrites.length > 0 && (!paintWrites.includes('notes') || !undoWrites.includes('notes') || !perio.includes('notes')), { notesChanged: n0 !== n1, paintWrites, undoWrites, perioWrites: perio });
      } finally { await c.close(); }
    },

    // shell-nav-14 (encounter part): a bad encounter id rendered Nothing here with no notfound.home control.
    // Negative control: the heading, the store's sentence and notfound.home, hash unchanged.
    async 'A-storm-enc-22'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/dentist/exams'); await hop(p, '#/dentist/encounter/enc-0');
        const o = await p.evaluate(() => ({ hash: location.hash, h1: (document.querySelector('#canvas h1') || {}).textContent || null, home: !!document.querySelector('[data-testid="notfound.home"]'), why: [...document.querySelectorAll('#canvas p')].map((e) => e.textContent).join(' ') }));
        const why = await p.evaluate(() => Proto.store.notFound('encounter').why);
        rec('A-storm-enc-22', '#/dentist/encounter/enc-0 renders "Nothing here" without the notfound.home control', 'CONTRACTS §4 — notfound.home on every Nothing-here (encounter.js renderEncounter)',
          o.h1 === 'Nothing here' && (!o.home || !o.why.includes(why)), Object.assign(o, { storeWhy: why }));
      } finally { await c.close(); }
    },

    // Two owner checks (A-storm-owner-6, -7) need the store verb the phone card and Daily Close already call:
    // Proto.store.disclose writes the disclosures row a logged read promises. Negative control: the verb exists,
    // returns ok with an id, and one disclosures row and one write event name it.
    async 'A-storm-enc-23'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/close');
        const o = await p.evaluate(() => {
          const seq = window.__events.length ? window.__events[window.__events.length - 1].seq : 0;
          const before = (window.__proto.state().disclosures || []).length;
          const has = typeof Proto.store.disclose === 'function';
          const res = has ? Proto.store.disclose({ patientId: 'p-306', purpose: 'payment', recordIds: ['le-1'] }) : null;
          const S = window.__proto.state();
          return { has, res, before, after: (S.disclosures || []).length, row: S.disclosures ? S.disclosures[S.disclosures.length - 1] : null, writes: window.__events.filter((e) => e.seq > seq && e.kind === 'write').map((e) => e.table + ':' + e.id) };
        });
        rec('A-storm-enc-23', 'The store has no disclose verb, so every "logged read" on the phone card and Daily Close writes no disclosures row', 'docs/13 feature 19/24 PHI — a name shown after a logged tap is logged (store.js disclose)',
          !o.has || !o.res || o.res.ok !== true || o.after !== o.before + 1 || !o.writes.some((w) => w.startsWith('disclosures:')), o);
      } finally { await c.close(); }
    },
  };
};
