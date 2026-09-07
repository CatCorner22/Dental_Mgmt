// Audit checks for prototype/js/ui.js, chunk ui
// (root causes RC-26, RC-210, RC-215, RC-217, RC-84, RC-140, RC-226, RC-136, RC-143, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const clicks = (ev) => ev.filter((e) => e.kind === 'click').map((e) => ({ seq: e.seq, testid: e.testid === undefined ? null : e.testid, synthetic: !!e.synthetic }));
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, isBody: a === document.body }; });
  const clickIn = async (p, scope, tid) => { const s = `${scope} [data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.click(s); await p.waitForTimeout(90); return true; };
  // Every refusal on the page with its code, severity class, verb and where it sits.
  const refusalsOnPage = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => ({ code: r.dataset.code || null, severity: [...r.classList].filter((c) => c !== 'refusal').join(' '), verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() || null, where: r.closest('#dialogs') ? 'dialogs' : r.closest('#canvas') ? 'canvas' : 'other' })));
  // A button's identity as rendered: label, classes, and the ::before glyph the held identity adds in CSS.
  const identity = (p, tid) => p.evaluate((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); if (!e) return null; return { testid: tid, label: e.textContent.replace(/✓/g, '').trim(), classes: e.className, held: e.classList.contains('held'), before: getComputedStyle(e, '::before').content, background: getComputedStyle(e).backgroundColor, ariaLabel: e.getAttribute('aria-label') }; }, tid);
  const heldButtons = (p) => p.evaluate(() => [...document.querySelectorAll('.btn.held')].map((e) => ({ testid: e.getAttribute('data-testid'), label: e.textContent.replace(/✓/g, '').trim() })));
  const dialogOpen = (p) => p.evaluate(() => !!document.querySelector('#dialogs .dialog'));
  const words = (s) => (s || '').trim().split(/\s+/).filter((t) => /[A-Za-z0-9#$]/.test(t));

  return {
    // RC-26 · A3 / B12 · ui.js:50 logs the refusal event (and :51 announces) inside refusal() itself, at construction, so a screen that rebuilds
    // its standing gate on every render (rail.js:219 renderLedger → refusal(st.gate)) logs the same gate again for every unrelated press.
    // Negative control: after the one gate press the refusal count is 1 and it stays 1 through two Explain and two Show patient toggles (no new
    // gate was pressed), so `added` is 0 and the check reports false. The gate press must first have raised statement_held (code matched in the
    // event and on the rendered node) before any later row is counted, and every added row must carry that same code with no ledger.statement.send
    // click between — a second gate press logging a second row is correct behaviour, not this defect.
    async 'A-ui-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/ledger/p-315');
        const seq0 = await lastSeq(p);
        const stateBefore = await p.evaluate(() => JSON.stringify(window.__proto.state()));
        await click(p, 'ledger.statement.send'); await p.waitForTimeout(200);
        const gate = (await refusalsOnPage(p)).find((r) => r.where === 'canvas') || null;
        const afterGate = refusalEvents(await after(p, seq0));
        const liveAfterGate = await live(p);
        const seq1 = await lastSeq(p);
        const steps = [];
        for (const tid of ['ledger.explain', 'ledger.explain', 'ledger.showpatient', 'ledger.showpatient']) {
          const pressed = await click(p, tid); await p.waitForTimeout(200);
          const evNow = await after(p, seq1);
          steps.push({ control: tid, pressed, refusalEventsSinceGate: refusalEvents(evNow).length, liveRegion: await live(p) });
        }
        const ev = await after(p, seq0);
        const evSinceGate = await after(p, seq1);
        const added = refusalEvents(evSinceGate);
        const gatePressesBetween = clicks(evSinceGate).filter((k) => k.testid === 'ledger.statement.send').length;
        const stateAfter = await p.evaluate(() => JSON.stringify(window.__proto.state()));
        const gateRaised = !!gate && gate.code === 'statement_held' && afterGate.length === 1 && afterGate[0].code === 'statement_held';
        const reproduced = gateRaised && gatePressesBetween === 0 && steps.every((s) => s.pressed) && added.length > 0 && added.every((e) => e.code === 'statement_held');
        rec('A-ui-1', 'One press of Send statement on p-315 raises statement_held and logs one refusal event; each of four unrelated toggles (Explain ×2, Show patient ×2) then logs another statement_held row and re-announces the same gate, with no gate press between and no state change', 'A3 / B12 — a gate writes one refusal event; ui.js:50-51 log and announce on construction, rail.js:219 reconstructs the standing gate each render',
          reproduced, { gateRendered: gate, refusalEventsForTheGatePress: afterGate, liveAfterGate, steps, addedByUnrelatedPresses: added, gatePressesBetween, stateChanged: stateBefore !== stateAfter, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-210 · B2 / B3 / B4 · ui.js:28-33 builds kind:'held' from whatever label the caller passes, so the Held identity (outline + lock glyph,
    // CONTRACTS §6: "the word Held") is rendered with "Close day" (dailyclose.js:205 under the entitlement refusal) and "Choose a reason above"
    // (perio.js:279 before a licence is chosen), while other screens label the same identity "Held".
    // Negative control: every `.btn.held` on the page reads exactly "Held" (or ui.btn normalises the held label), so `offLabel` is empty and the
    // check reports false. Each candidate is scored only when its own gate was raised (refusal event with code entitlement / omission_licence)
    // and the button measures as the held identity (class held, ::before "🔒") — a plain button with an odd label is not this defect.
    async 'A-ui-2'(b) {
      const { c, p } = await ctx(b);
      try {
        // Daily Close as the biller: Close day → confirm → entitlement refusal; the primary switches to held but keeps its verb label.
        await go(p, '#/biller/close');
        const seqA = await lastSeq(p);
        await click(p, 'close.closeday'); await click(p, 'close.closeday.confirm'); await p.waitForTimeout(200);
        const closeRefusal = refusalEvents(await after(p, seqA));
        const closeBtn = await identity(p, 'close.closeday');
        const closeHeldLabels = await heldButtons(p);
        // Perio: one probed site, one skipped → Save exam raises omission_licence; its control opens the licence chooser whose confirm is held.
        await go(p, '#/hygienist/perio/enc-9001');
        const seqB = await lastSeq(p);
        await p.keyboard.press('3'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(80);
        await click(p, 'perio.save'); await p.waitForTimeout(200);
        const perioRefusal = refusalEvents(await after(p, seqB));
        const perioSave = await identity(p, 'perio.save');
        await clickIn(p, '#canvas', 'refusal.control'); await p.waitForTimeout(200);
        /* Scored on whatever held button the gate actually leaves on the page, not on a named control: the
           fix round collapsed the licence step, so `perio.licence.confirm` is gone and naming it made this
           half of the check measure nothing at all while still reporting a clean result. */
        const perioHeldLabels = await heldButtons(p);
        const isHeld = (i) => !!i && i.held && /🔒/.test(i.before || '');
        const hasWordHeld = (i) => !!i && /\bHeld\b/.test(i.label);
        const licenceConfirm = perioHeldLabels[0] || null;
        const closeScored = closeRefusal.some((e) => e.code === 'entitlement') && isHeld(closeBtn) && !hasWordHeld(closeBtn);
        const perioScored = perioRefusal.some((e) => e.code === 'omission_licence') && perioHeldLabels.length > 0 && perioHeldLabels.some((x) => !/\bHeld\b/.test(x.label));
        const allHeld = [...closeHeldLabels, ...perioHeldLabels];
        const offLabel = allHeld.filter((x) => !/\bHeld\b/.test(x.label));
        const distinctHeldLabels = [...new Set(allHeld.map((x) => x.label))];
        const reproduced = closeScored || perioScored;
        rec('A-ui-2', 'Under the entitlement refusal close.closeday measures as the held identity (class held, ::before 🔒) labelled "Close day"; before a licence is chosen perio.licence.confirm measures held labelled "Choose a reason above"; perio.save beside it reads "Held" — one identity, three labels', 'B2 / B3 / B4 — CONTRACTS §6: the primary switches to the Held identity (outlined, lock glyph, the word Held), the same on every screen; ui.js:28-33 accepts any label for kind held',
          reproduced, { close: { refusalEvents: closeRefusal, primary: closeBtn, heldButtonsOnPage: closeHeldLabels, scored: closeScored }, perio: { refusalEvents: perioRefusal, save: perioSave, licenceConfirm, heldButtonsOnPage: perioHeldLabels, scored: perioScored }, heldLabelsWithoutTheWord: offLabel, distinctHeldLabels });
      } finally { await c.close(); }
    },

    // RC-215 · B1 · ui.js:53-55 stamp every refusal with the fixed ids refusal.verb / refusal.control / refusal.why. board.js:85 keeps the
    // ping_rate gate in `pings` across renders, so when the palette's second_identifier gate opens in the dialog layer the contract selector
    // resolves to two controls and Playwright takes the first — the Board's, under the overlay — and times out.
    // Negative control: after the palette gate there is one refusal.control on the page (or the first match is the dialog's), the plain-selector
    // click lands inside 2.5 s and clears the dialog gate, so `collided` is false and the check reports false. The Board gate must first be on
    // the page (ping_rate event and node) and the palette must have raised second_identifier before the selector is measured; the scoped click
    // is the contrast that shows the dialog's control itself works.
    async 'A-ui-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=desk');
        const seq0 = await lastSeq(p);
        const pingRow = (await p.$('[data-testid="board.queue.row.a-1044.ping"]')) ? 'a-1044' : 'a-1050';
        await click(p, `board.queue.row.${pingRow}.ping`); await p.waitForTimeout(120);
        await click(p, `board.queue.row.${pingRow}.ping`); await p.waitForTimeout(200);
        const boardGate = (await refusalsOnPage(p)).filter((r) => r.where === 'canvas');
        const controlsBeforeDialog = await p.evaluate(() => document.querySelectorAll('[data-testid="refusal.control"]').length);
        await click(p, 'topbar.search'); await p.waitForTimeout(150);
        await p.keyboard.type('okoro', { delay: 15 }); await p.waitForTimeout(250);
        const row0 = await p.$eval('#dialogs [data-testid="palette.row.0"]', (e) => e.textContent.trim()).catch(() => null);
        await clickIn(p, '#dialogs', 'palette.row.0'); await p.waitForTimeout(200);
        const dobPresent = !!(await p.$('#dialogs [data-testid="palette.confirm.dob"]'));
        if (dobPresent) { await p.fill('#dialogs [data-testid="palette.confirm.dob"]', '01/01/2000'); await clickIn(p, '#dialogs', 'palette.confirm.go'); await p.waitForTimeout(200); }
        const controls = await p.evaluate(() => [...document.querySelectorAll('[data-testid="refusal.control"]')].map((e, i) => { const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { index: i, label: e.textContent.trim(), where: e.closest('#dialogs') ? 'dialogs' : e.closest('#canvas') ? 'canvas' : 'other', x: Math.round(r.x), y: Math.round(r.y), receivesPointer: top === e || (!!top && e.contains(top)), topmostAtCenter: top ? (top.className || top.tagName) : null }; }));
        const verbs = await p.evaluate(() => document.querySelectorAll('[data-testid="refusal.verb"]').length);
        const whys = await p.evaluate(() => document.querySelectorAll('[data-testid="refusal.why"]').length);
        const goBefore = await p.$eval('#dialogs [data-testid="palette.confirm.go"]', (e) => e.textContent.trim()).catch(() => null);
        let plainClickError = null; const t0 = Date.now();
        try { await p.click('[data-testid="refusal.control"]', { timeout: 2500 }); } catch (e) { plainClickError = e.message.split('\n')[0]; }
        const plainClickMs = Date.now() - t0;
        const afterPlain = { dialogGateStillShown: await p.evaluate(() => !!document.querySelector('#dialogs .refusal')), goLabel: await p.$eval('#dialogs [data-testid="palette.confirm.go"]', (e) => e.textContent.trim()).catch(() => null) };
        const scopedClicked = await clickIn(p, '#dialogs', 'refusal.control'); await p.waitForTimeout(150);
        const afterScoped = { dialogGateStillShown: await p.evaluate(() => !!document.querySelector('#dialogs .refusal')), goLabel: await p.$eval('#dialogs [data-testid="palette.confirm.go"]', (e) => e.textContent.trim()).catch(() => null) };
        const ev = await after(p, seq0);
        const refs = refusalEvents(ev);
        const boardGateUp = boardGate.some((r) => r.code === 'ping_rate') && refs.some((e) => e.code === 'ping_rate') && controlsBeforeDialog === 1;
        const paletteGateUp = refs.some((e) => e.code === 'second_identifier') && controls.some((k) => k.where === 'dialogs');
        const collided = controls.length >= 2 && controls[0].where !== 'dialogs' && !controls[0].receivesPointer && !!plainClickError && afterPlain.dialogGateStillShown;
        const scopedWorks = scopedClicked && !afterScoped.dialogGateStillShown;
        const reproduced = boardGateUp && paletteGateUp && collided && scopedWorks;
        rec('A-ui-3', `With the Board's ping_rate gate standing (row ${pingRow}), the palette's second_identifier gate renders a second refusal.control; the contract selector resolves to two elements, the first is the Board's under the overlay, and a plain click times out while the dialog gate stays — the same click scoped to #dialogs clears it`, 'B1 — a data-testid addresses one control; ui.js:53-55 fixed ids, board.js:85 keeps the gate across renders, palette.js:258',
          reproduced, { pingRow, boardGate, controlsBeforeDialog, paletteRow0: row0, dobFieldShown: dobPresent, goBeforeClick: goBefore, refusalControls: controls, refusalVerbs: verbs, refusalWhys: whys, plainClickError, plainClickMs, afterPlainClick: afterPlain, scopedClicked, afterScopedClick: afterScoped, refusalEvents: refs, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-217 · B1 · ui.js:73 builds div.overlay with no testid and :89 gives it a click handler that closes the dialog (no caller passes
    // opts.modal), so the closing click is recorded by events.js:35 as {kind:'click'} with no testid — a tap nobody can attribute.
    // Negative control: the overlay (or an ancestor) carries a data-testid, so the closing click event names it — or the outside click does not
    // close the dialog (no handler) — and the check reports false. Each variant is scored only when the point clicked measured as the overlay
    // itself (elementFromPoint) and the dialog was open before and closed after, so a click that hit the top bar is never mistaken for this.
    async 'A-ui-4'(b) {
      const { c, p } = await ctx(b);
      try {
        const probe = async (openTid, hash) => {
          await go(p, hash);
          await click(p, openTid); await p.waitForTimeout(150);
          const before = await p.evaluate(() => {
            const ov = document.querySelector('#dialogs .overlay'); const dlg = ov && ov.querySelector('.dialog'); if (!ov || !dlg) return null;
            const o = ov.getBoundingClientRect(); const d = dlg.getBoundingClientRect();
            // A point inside the overlay and outside the dialog box: bottom-left corner of the overlay, nudged in.
            const x = Math.round(o.left + 4), y = Math.round(o.bottom - 4);
            const hit = document.elementFromPoint(x, y);
            return { dialogLabel: dlg.getAttribute('aria-label'), overlayTestid: ov.getAttribute('data-testid'), overlayAncestorTestid: ov.parentElement && ov.parentElement.closest('[data-testid]') ? ov.parentElement.closest('[data-testid]').getAttribute('data-testid') : null, point: { x, y }, pointHitsOverlay: hit === ov, pointInsideDialogBox: x >= d.left && x <= d.right && y >= d.top && y <= d.bottom, overlayRect: { w: Math.round(o.width), h: Math.round(o.height) } };
          });
          if (!before) return { openTid, hash, dialogOpened: false };
          const seq0 = await lastSeq(p);
          await p.mouse.click(before.point.x, before.point.y); await p.waitForTimeout(200);
          const ev = await after(p, seq0);
          const ks = clicks(ev);
          return { openTid, hash, dialogOpened: true, ...before, closedAfterClick: !(await dialogOpen(p)), focusAfter: await focused(p), clickEvents: ks, closingClickWithoutTestid: ks.length > 0 && ks.every((k) => k.testid == null), seqRange: range(ev, seq0) };
        };
        const pin = await probe('topbar.author', '#/frontdesk/board?device=desk');
        const preview = await probe('ledger.statement.preview', '#/biller/ledger/p-303');
        const scored = (r) => r.dialogOpened && r.pointHitsOverlay && !r.pointInsideDialogBox && r.closedAfterClick && r.overlayTestid == null && r.overlayAncestorTestid == null && r.closingClickWithoutTestid;
        const reproduced = scored(pin) || scored(preview);
        rec('A-ui-4', 'Clicking the backdrop outside the Switch author pad (and outside the Statement preview) closes the dialog; div.overlay carries no data-testid and has no ancestor with one, so window.__events records the closing activation as {kind: click} with no testid', 'B1 — every element with a click handler carries a data-testid; ui.js:73 (no testid), :89 (click-to-close handler, no caller passes modal)',
          reproduced, { pinPad: pin, statementPreview: preview, pinScored: scored(pin), previewScored: scored(preview) });
      } finally { await c.close(); }
    },

    // RC-84 · B5 · ui.js:52-55 render a refusal as verb + control + Why with no glyph and no chip; components.css:51-53 carry severity as
    // border-left-color alone, which the page's grayscale(1) filter collapses. Listed in docs/14 § Open after round 2 (known_in_docs14).
    // Negative control: each rendered refusal contains a .glyph or a .chip (glyph + word), or its verb carries the severity word, so
    // `colourOnly` is false and the check reports false. At least two distinct severity classes must be live on real gates (stop/required from
    // roles sod_conflict, required from ping_rate, info from the read-back) before the comparison counts — one refusal has nothing to differ from.
    async 'A-ui-5'(b) {
      const { c, p } = await ctx(b);
      try {
        const measure = (p) => p.evaluate(() => [...document.querySelectorAll('.refusal')].map((r) => { const cs = getComputedStyle(r); return { code: r.dataset.code || null, severity: [...r.classList].filter((x) => x !== 'refusal').join(' ') || '(default)', verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), glyphs: r.querySelectorAll('.glyph').length, chips: r.querySelectorAll('.chip').length, borderLeftColor: cs.borderLeftColor, borderLeftWidth: cs.borderLeftWidth, background: cs.backgroundColor, rootFilter: getComputedStyle(document.documentElement).filter, severityWordInVerb: /\b(stop|required|review|style|info|clear)\b/i.test(((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '')) }; }));
        const out = [];
        await go(p, '#/owner/roles?grayscale=1&theme=dark');
        await click(p, 'roles.daypass.add'); await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(250);
        out.push(...(await measure(p)).map((m) => ({ screen: 'roles', ...m })));
        await go(p, '#/frontdesk/board?grayscale=1&theme=dark');
        const pingRow = (await p.$('[data-testid="board.queue.row.a-1044.ping"]')) ? 'a-1044' : 'a-1050';
        await click(p, `board.queue.row.${pingRow}.ping`); await click(p, `board.queue.row.${pingRow}.ping`); await p.waitForTimeout(200);
        out.push(...(await measure(p)).map((m) => ({ screen: 'board', ...m })));
        await go(p, '#/dentist/encounter/enc-9002?grayscale=1&theme=dark');
        await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o'); await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(250);
        out.push(...(await measure(p)).map((m) => ({ screen: 'encounter', ...m })));
        const severities = [...new Set(out.map((m) => m.severity))];
        const colours = [...new Set(out.map((m) => m.borderLeftColor))];
        const colourOnly = out.length > 0 && out.every((m) => m.glyphs === 0 && m.chips === 0 && !m.severityWordInVerb);
        const grayscaleOn = out.every((m) => /grayscale\(1\)/.test(m.rootFilter));
        const reproduced = severities.length >= 2 && colourOnly && grayscaleOn;
        rec('A-ui-5', `Live refusals of ${severities.length} severities (${severities.join(', ')}) render zero .glyph and zero .chip; the severities differ only by border-left-color (${colours.length} colours), under the page's grayscale(1) filter`, 'B5 — every state is glyph + word + fill via Proto.ui.chip, never colour alone; ui.js:52-55, components.css:51-53 (known in docs/14 § Open after round 2)',
          reproduced, { refusals: out, severitiesRendered: severities, borderColours: colours, colourOnly, grayscaleOn });
      } finally { await c.close(); }
    },

    // RC-140 · B8 · ui.js:65 takes the first letter of the first two whitespace tokens, so "Dr. Hana Kim" → "DH"; board.js:37 provInitials
    // strips the honorific first → "HK", so the same author has two monograms on one shared-device screen.
    // Negative control: the author chip's initials equal the initials of the name without its honorific ("HK") and match the chair strip, so
    // `honorificCounted` is false and the check reports false. The check scores only when the current user's name actually begins with "Dr."
    // and the chip renders initials (shared device) — a non-titled user or a desk device (full short name) proves nothing either way.
    async 'A-ui-6'(b) {
      const { c, p } = await ctx(b, 1024, 768);
      try {
        await go(p, '#/dentist/board?device=shared');
        const m = await p.evaluate(() => {
          const u = Proto.store.currentUser();
          const bare = u.name.replace(/^Dr\.\s+/, '');
          const expected = bare.split(/\s+/).map((t) => t[0]).join('').slice(0, 2).toUpperCase();
          const chip = ((document.querySelector('[data-testid="topbar.author"]') || {}).textContent || '').trim();
          const chairs = [...document.querySelectorAll('[data-testid^="board.chair."]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
          const titled = window.__proto.state().users.filter((x) => /^Dr\./.test(x.name)).map((x) => ({ name: x.name, uiInitials: Proto.ui.initials(x.name), withoutHonorific: x.name.replace(/^Dr\.\s+/, '').split(/\s+/).map((t) => t[0]).join('').slice(0, 2).toUpperCase() }));
          return { device: window.__proto.device, user: u.name, uiInitials: Proto.ui.initials(u.name), expectedInitials: expected, authorChip: chip, chairStrip: chairs, chairShowsExpected: chairs.some((t) => t.includes(expected)), titledUsers: titled };
        });
        const honorificCounted = /^Dr\./.test(m.user) && m.device === 'shared' && m.authorChip.startsWith(m.uiInitials) && m.uiInitials[0] === 'D' && m.uiInitials !== m.expectedInitials;
        const reproduced = honorificCounted;
        rec('A-ui-6', `On a shared device the dentist's author chip reads "${m.authorChip}" for ${m.user} (Proto.ui.initials → ${m.uiInitials}) while the chair strip shows ${m.expectedInitials}; every "Dr." user gets a D-initial`, 'B8 — names become initials; a clinician\'s initials are her name\'s, not the honorific\'s; ui.js:65 versus board.js:37',
          reproduced, m);
      } finally { await c.close(); }
    },

    // RC-226 · C8 / B2 · ui.js:51 announces v.verb + '. ' + v.control, so every gate reaches the live region as two sentences and a verb that
    // already ends in a period is announced with "..".
    // Negative control: #live holds the verb line alone (text === verb, or at least does not end with the control label), so `twoLine` is false
    // and the check reports false. Each announcement is matched to the refusal event it came from (same verb, same control) before it is scored,
    // so a later unrelated announcement overwriting the region is never mistaken for the gate's.
    async 'A-ui-7'(b) {
      const { c, p } = await ctx(b);
      try {
        const out = [];
        const score = (text, ref) => { if (!ref) return { matched: false }; const expectedTwoLine = ref.verb + (ref.control ? '. ' + ref.control : ''); return { matched: text === expectedTwoLine || text === ref.verb, twoLine: !!ref.control && text === expectedTwoLine && text !== ref.verb, doublePeriod: /\.\./.test(text), verbEndsWithPeriod: /\.$/.test(ref.verb), verbWords: words(ref.verb).length, announcedWords: words(text).length }; };
        await go(p, '#/owner/roles');
        let seq0 = await lastSeq(p);
        await click(p, 'roles.daypass.add'); await click(p, 'roles.daypass.entitlement.refund'); await p.waitForTimeout(350);
        let refs = refusalEvents(await after(p, seq0)); let text = await live(p); let last = refs[refs.length - 1] || null;
        out.push({ screen: 'roles', control: 'roles.daypass.entitlement.refund', announced: text, refusal: last, ...score(text, last) });
        await go(p, '#/frontdesk/board');
        seq0 = await lastSeq(p);
        const pingRow = (await p.$('[data-testid="board.queue.row.a-1044.ping"]')) ? 'a-1044' : 'a-1050';
        await click(p, `board.queue.row.${pingRow}.ping`); await click(p, `board.queue.row.${pingRow}.ping`); await p.waitForTimeout(350);
        refs = refusalEvents(await after(p, seq0)); text = await live(p); last = refs[refs.length - 1] || null;
        out.push({ screen: 'board', control: `board.queue.row.${pingRow}.ping ×2`, announced: text, refusal: last, ...score(text, last) });
        await go(p, '#/frontdesk/checkout/a-1044');
        seq0 = await lastSeq(p);
        await click(p, 'checkout.post'); await p.waitForTimeout(350);
        refs = refusalEvents(await after(p, seq0)); text = await live(p); last = refs[refs.length - 1] || null;
        out.push({ screen: 'checkout', control: 'checkout.post (no tender)', announced: text, refusal: last, ...score(text, last) });
        // Scored on the gates that actually render through Proto.ui.refusal. The Board's ping_rate announced its verb
        // alone (announce() called outside the component), so "every gate" overstates it; that inconsistency belongs to
        // the Board chunk. What ui.js:51 does is measured here: it appends ". " + control to every refusal it renders.
        const scored = out.filter((o) => o.matched && o.refusal && o.refusal.control);
        const appended = scored.filter((o) => o.twoLine);
        const reproduced = appended.length >= 2 && appended.some((o) => o.doublePeriod && o.verbEndsWithPeriod);
        rec('A-ui-7', 'Proto.ui.refusal announces verb + ". " + control, so a gate is read as two sentences and the sod_conflict verb (already a full sentence) is announced with ".." before "Remediate"', 'C8 / B2 — the live region announces one verb line; ui.js:51 appends ". " + control',
          reproduced, { announcements: out, matchedToRefusalEvent: scored.length, doublePeriodSeen: out.some((o) => o.doublePeriod) });
      } finally { await c.close(); }
    },

    // RC-136 · A8 · ui.js:59-66: money() has no guard for undefined/NaN ("$NaN"); shortDate/longDate split on '-' so a datetime
    // ("2026-09-03T06:10", the seed's eraBatches.received shape) yields "9/NaN"; shortDate/longDate/initials/displayName throw on null.
    // Negative control: money(undefined) is "$0.00" (or another non-NaN fallback), the null inputs return a string instead of throwing, and the
    // datetime parses to 9/3, so `faults` is empty and the check reports false. Ordinary inputs are measured beside them so a helper that is
    // broken outright is not confused with one that only lacks boundary handling; the Money Desk canvas is searched for "NaN" so an on-screen
    // consequence would be recorded (none is expected — severity stays P3 unless one appears).
    async 'A-ui-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const m = await p.evaluate(() => {
          const tryCall = (label, fn) => { try { const v = fn(); return { call: label, result: v === undefined ? 'undefined' : String(v) }; } catch (e) { return { call: label, threw: e.constructor.name + ': ' + e.message }; } };
          const U = Proto.ui;
          const calls = [
            tryCall("money(-4400)", () => U.money(-4400)), tryCall('money(0)', () => U.money(0)), tryCall('money(null)', () => U.money(null)),
            tryCall('money(undefined)', () => U.money(undefined)), tryCall('money(NaN)', () => U.money(NaN)),
            tryCall("shortDate('2026-09-03')", () => U.shortDate('2026-09-03')), tryCall("longDate('2026-09-03')", () => U.longDate('2026-09-03')),
            tryCall("shortDate('2026-09-03T06:10')", () => U.shortDate('2026-09-03T06:10')), tryCall("longDate('2026-09-03T06:10')", () => U.longDate('2026-09-03T06:10')),
            tryCall('shortDate(null)', () => U.shortDate(null)), tryCall('longDate(undefined)', () => U.longDate(undefined)),
            tryCall("initials('Bree Lindqvist')", () => U.initials('Bree Lindqvist')), tryCall('initials(null)', () => U.initials(null)), tryCall('displayName(null, true)', () => U.displayName(null, true)),
          ];
          const received = (window.__proto.state().eraBatches[0] || {}).received || null;
          const canvasNaN = /NaN/.test(document.getElementById('canvas').textContent);
          return { calls, seedDatetimeShape: received, moneyDeskCanvasShowsNaN: canvasNaN };
        });
        const byCall = Object.fromEntries(m.calls.map((k) => [k.call, k]));
        const faults = m.calls.filter((k) => k.threw || /NaN/.test(k.result || ''));
        const ordinaryOk = byCall['money(-4400)'].result === '−$44.00' && byCall["shortDate('2026-09-03')"].result === '9/3' && byCall["longDate('2026-09-03')"].result === '9/3/2026' && byCall["initials('Bree Lindqvist')"].result === 'BL';
        const reproduced = ordinaryOk && faults.length > 0;
        rec('A-ui-8', 'money(undefined) and money(NaN) return "$NaN"; shortDate/longDate on the seed\'s datetime shape return "9/NaN" / "9/NaN/2026"; shortDate(null), longDate(undefined), initials(null), displayName(null, true) throw TypeError — while ordinary inputs are correct', 'A8 — pure helpers return correct values on ordinary, boundary, and null inputs; ui.js:59-66',
          reproduced, { calls: m.calls, faults: faults.map((k) => k.call), ordinaryInputsCorrect: ordinaryOk, seedDatetimeShape: m.seedDatetimeShape, moneyDeskCanvasShowsNaN: m.moneyDeskCanvasShowsNaN });
      } finally { await c.close(); }
    },

    // RC-143 · B5 · ui.js:33 forwards only named options to h() and drops opts.dataset, so shell.js:95's dataset:{retired} never reaches the
    // rail chip and components.css:149 (.rail1 .btn[data-retired="1"]) never applies.
    // Negative control: after Arrive the retired chip carries data-retired="1" (and Proto.ui.btn('x', {dataset:{retired:'1'}}) yields an element
    // whose dataset.retired is "1"), so `dropped` is false and the check reports false. The chip must first have retired (label gains ✓ and the
    // aria-label says done, after a real Arrive write) before its missing attribute is scored — an unretired chip has nothing to carry.
    async 'A-ui-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        const chips = () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="rail1.chip."]')].map((e) => ({ testid: e.getAttribute('data-testid'), label: e.textContent.trim(), ariaLabel: e.getAttribute('aria-label'), dataRetired: e.getAttribute('data-retired'), attributes: [...e.attributes].map((a) => a.name), textDecoration: getComputedStyle(e).textDecorationLine })));
        const before = await chips();
        const seq0 = await lastSeq(p);
        await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(250);
        const afterArrive = await chips();
        const ev = await after(p, seq0);
        const direct = await p.evaluate(() => { const b = Proto.ui.btn('probe', { dataset: { retired: '1' }, testid: 'probe.btn' }); const viaH = Proto.ui.h('span', { dataset: { retired: '1' } }); return { btnDatasetRetired: b.dataset.retired === undefined ? null : b.dataset.retired, btnAttributes: [...b.attributes].map((a) => a.name), hDatasetRetired: viaH.dataset.retired === undefined ? null : viaH.dataset.retired }; });
        const cssRule = await p.evaluate(() => { const found = []; for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch { continue; } for (const r of rules) if (r.selectorText && /data-retired/.test(r.selectorText)) found.push(r.selectorText); } return found; });
        const retired = afterArrive.filter((k) => /✓/.test(k.label) || /, done$/.test(k.ariaLabel || ''));
        // arrive() writes appointmentEvents/ae-N and firstRunState/frs-<uid>-arrive; the earlier guard looked for an
        // "appointments" write that never happens and made the whole check report false.
        const arrived = writes(ev).some((w) => w.table === 'appointmentEvents' || w.table === 'firstRunState');
        // components.css:149 styles .rail1 .btn[data-retired="1"], but document.styleSheets throws over file:// and the
        // scan returns [] regardless, so the visible consequence is measured instead: the retired chip is not struck out.
        const dropped = retired.length > 0 && retired.every((k) => k.dataRetired == null && k.textDecoration === 'none') && direct.btnDatasetRetired == null && direct.hDatasetRetired === '1';
        const reproduced = arrived && dropped;
        rec('A-ui-9', 'After Arrive on a-1042 the first-shift chip reads "Arrive ✓" / aria "Arrive, done" but carries no data-retired attribute; Proto.ui.btn with dataset:{retired:"1"} yields no data-retired while Proto.ui.h with the same option does; components.css keys a rule on [data-retired="1"] that can never match', 'B5 / contract drift — ui.js:33 forwards only named options and drops opts.dataset; shell.js:95 passes it; components.css:149',
          reproduced, { chipsBefore: before, chipsAfterArrive: afterArrive, retiredChips: retired.map((k) => ({ testid: k.testid, label: k.label, ariaLabel: k.ariaLabel, dataRetired: k.dataRetired, attributes: k.attributes })), directProbe: direct, cssRulesOnDataRetired: cssRule, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },
  };
};
