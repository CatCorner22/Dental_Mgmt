// Swarm 2 hunt, lens "privacy-phi-events": PHI under privacy mode on visual and non-visual surfaces, the disclosure
// record the screens promise, the event log as a PHI/credential channel, and ui.js initials on unusual names.
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
// Clean under privacy=1 on desk/operatory/shared/phone x nine personas x every §2 route (details, rail tabs, dialogs,
// title, aria-*, title/placeholder/alt, data-*, #live, hash, storage): no seeded full name, DOB, phone or guardian.

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const disclosures = (p) => p.evaluate(() => ({
    rows: window.__proto.state().disclosures.length,
    writeEvents: window.__events.filter((e) => e.kind === 'write' && e.table === 'disclosures').length,
    seq: window.__events.length ? window.__events[window.__events.length - 1].seq : 0,
  }));
  const openPalette = async (p, q) => {
    await p.keyboard.press('Control+k'); await p.waitForTimeout(150);
    if (!(await p.$('[data-testid="palette.input"]'))) return false;
    await p.type('[data-testid="palette.input"]', q); await p.waitForTimeout(150);
    return true;
  };

  return {
    // palette.js:291 (field hint) and :336 (validateDob) hard-code the example date "04/12/1978", which is p-301
    // Marisol Vega's seeded date of birth (seed.js). With privacy=1 on a shared device the confirm step for MV prints
    // "MV · …0141 · MRN-301" and, one line under it, her exact DOB as the "example"; the hint is the input's
    // aria-describedby target, so a screen reader hears it too, and typing the example passes the second-identifier
    // gate ("Chart open: MV"). Privacy mode hides DOB on every other surface (rail identLine, encounter head, read-back).
    // Negative control: the hint and the format refusal use a date no seeded patient carries (or no example at all), so
    // hintHasP301Dob and refusalHasP301Dob are false and the check reports false.
    async 'S2-privacy-phi-events-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?device=shared&privacy=1');
        const dob301 = await p.evaluate(() => { const x = window.__proto.state().patients.find((q) => q.id === 'p-301'); return x ? { iso: x.dob, name: x.name } : null; });
        const us = dob301 ? (() => { const [y, m, d] = dob301.iso.split('-'); return m + '/' + d + '/' + y; })() : null; // 04/12/1978
        const opened = await openPalette(p, 'MRN-301');
        const row = opened && await p.$('[data-testid="palette.row.0"]');
        if (row) { await row.click(); await p.waitForTimeout(150); }
        const confirm = await p.evaluate(() => {
          const i = document.getElementById('palette-dob'); if (!i) return null;
          const ids = (i.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
          return { who: ((document.querySelector('.pal-who') || {}).textContent || '').trim(), describedby: ids, hint: ids.map((id) => ((document.getElementById(id) || {}).textContent || '').trim()).join(' '), privacy: window.__proto.privacy, device: window.__proto.device };
        });
        let refusalText = null, opened2 = null;
        if (confirm) {
          await p.fill('[data-testid="palette.confirm.dob"]', 'x'); await click(p, 'palette.confirm.go');
          refusalText = await p.evaluate(() => ((document.querySelector('.pal-errors') || {}).textContent || '').trim());
          await p.fill('[data-testid="palette.confirm.dob"]', us); await click(p, 'palette.confirm.go');
          opened2 = { live: await live(p), railName: await p.evaluate(() => ((document.querySelector('#rail .name') || {}).textContent || null)), paletteOpen: await p.evaluate(() => !!document.querySelector('[data-testid="palette.input"], [data-testid="palette.confirm.dob"]')) };
        }
        const hintHasP301Dob = !!(confirm && us && confirm.hint.includes(us));
        const refusalHasP301Dob = !!(refusalText && us && refusalText.includes(us));
        const exampleOpensChart = !!(opened2 && /^Chart open: MV\b/.test(opened2.live));
        const reproduced = !!confirm && confirm.privacy === true && confirm.device === 'shared' && /^▬?Patient\s*MV\b/.test(confirm.who) && hintHasP301Dob && exampleOpensChart;
        rec('S2-privacy-phi-events-1', 'With privacy=1 on a shared device the palette\'s second-identifier step for MV (p-301) prints her exact date of birth as the hint\'s "example" (also the input\'s aria-describedby text and the format refusal), and typing that example opens her chart', 'B8 privacy mode hides DOB; CONTRACTS §7 two identifiers before a chart opens; palette.js:291,336 vs seed.js p-301', reproduced, { p301: dob301, usDate: us, confirm, refusalText, afterTypingExample: opened2, hintHasP301Dob, refusalHasP301Dob, exampleOpensChart });
      } finally { await c.close(); }
    },

    // rail.js:219 · the Rail ledger tab's patient view prints "Turn the screen or print (this is recorded as a disclosure)",
    // but the press that shows it (ledger.showpatient, rail.js:347) and the Explain beside it call no Proto.store.disclose:
    // S.disclosures stays at 0 rows and window.__events carries no write to `disclosures` — the same promise the phone card
    // and Daily Close keep (store.js:803-808), and docs/13 §"PHI and controls" ("prints ... are disclosure rows"). Checkout's
    // own receipt (checkout.js:401) says the opposite on the same gesture ("no disclosure row is written here").
    // Negative control: ledger.showpatient (or Explain in patient voice) writes a disclosures row, so rowsAfter > rowsBefore
    // and writeEventsAfter > 0, and the check reports false — or the sentence stops claiming the record.
    async 'S2-privacy-phi-events-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        await click(p, 'board.card.a-1044.expand');
        const openers = await p.$$eval('[data-testid^="rail.open."]', (els) => els.map((e) => e.getAttribute('data-testid')));
        if (openers[0]) await click(p, openers[0]);
        else await p.evaluate(() => Proto.screens.rail.open('p-303', Proto.router.current()));
        await p.waitForTimeout(150);
        await click(p, 'rail.tab.ledger'); await p.waitForTimeout(100);
        const before = await disclosures(p);
        const pressed = await click(p, 'ledger.showpatient'); await p.waitForTimeout(150);
        if (!(await p.evaluate(() => [...document.querySelectorAll('p')].some((e) => /recorded as a disclosure/i.test(e.textContent))))) await click(p, 'ledger.explain');
        await p.waitForTimeout(100);
        const sentence = await p.evaluate(() => ([...document.querySelectorAll('p')].map((e) => e.textContent.trim()).find((t) => /recorded as a disclosure/i.test(t)) || null));
        const after = await disclosures(p);
        const showPatientState = await p.$eval('[data-testid="ledger.showpatient"]', (e) => e.getAttribute('aria-pressed')).catch(() => null);
        const reproduced = pressed && !!sentence && showPatientState === 'true' && after.rows === before.rows && after.writeEvents === 0;
        rec('S2-privacy-phi-events-2', 'The Rail ledger tab\'s patient view tells the user "this is recorded as a disclosure" while Show patient writes no disclosures row and logs no write event (0 rows before and after; seq range carries no write), unlike the phone card and Daily Close which write the row they promise', 'B7/A6 the record a label promises exists; store.js:803 disclose(); docs/13 PHI and controls; rail.js:219,347', reproduced, { opener: openers[0] || 'Proto.screens.rail.open', pressed, showPatientPressed: showPatientState, sentence, disclosuresBefore: before, disclosuresAfter: after, seqRange: [before.seq, after.seq] });
      } finally { await c.close(); }
    },

    // ui.js:initials · `p[0]` indexes UTF-16 code units, so a name whose first character is outside the BMP (e.g. the CJK
    // surname character 𠮷 U+20BB7, or any supplementary-plane letter) yields a lone high surrogate: initials('𠮷野 太郎') ===
    // '\uD842太' (isWellFormed() false). Under privacy mode displayName() returns that string, so the board card, its
    // aria-label and the rail header render a broken glyph instead of two initials — the privacy label is corrupt and
    // serialising it (JSON, announcements) carries an ill-formed string.
    // Negative control: initials() iterates code points ([...p][0] or codePointAt), so initialsWellFormed is true and the
    // rendered card text contains '𠮷太'; the check reports false.
    async 'S2-privacy-phi-events-3'(b) {
      const { c, p, errs } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?privacy=1');
        const helper = await p.evaluate(() => {
          const cases = ['𠮷野 太郎', '𐌰𐌽𐍃 Ulfila', 'Cher', 'Mary-Jane Watson', "Conor O'Brien", 'Ünal Öztürk'];
          return cases.map((n) => { const i = Proto.ui.initials(n); return { name: n, initials: i, units: [...Array(i.length)].map((_, k) => i.charCodeAt(k).toString(16)), wellFormed: typeof i.isWellFormed === 'function' ? i.isWellFormed() : ![...i].some((ch) => { const cp = ch.codePointAt(0); return cp >= 0xd800 && cp <= 0xdfff; }), privacyName: Proto.ui.displayName(n, true) }; });
        });
        const astral = helper[0];
        // Render the astral name on the board under privacy: a-1044's patient is renamed in the live store, then the board is repainted by routing away and back.
        const renamed = await p.evaluate(() => {
          const S = Proto.store.get(); const a = S.appointments.find((x) => x.id === 'a-1044'); const pt = a && S.patients.find((x) => x.id === a.patientId); if (!pt) return null;
          const before = pt.name; pt.name = '𠮷野 太郎'; return { before, patientId: pt.id };
        });
        await hop(p, '#/frontdesk/chairs'); await hop(p, '#/frontdesk/board');
        if (renamed) await p.evaluate((pid) => Proto.screens.rail.open(pid, Proto.router.current()), renamed.patientId);
        await p.waitForTimeout(150);
        const rendered = await p.evaluate((renamed) => {
          if (!renamed) return null;
          const card = document.querySelector('[data-testid="board.card.a-1044"]'); if (!card) return Object.assign({ card: null }, renamed);
          const text = card.textContent; const aria = card.getAttribute('aria-label') || '';
          const railName = ((document.querySelector('#rail .name') || {}).textContent || null);
          const lone = (s) => [...Array(s.length)].some((_, k) => { const u = s.charCodeAt(k); return u >= 0xd800 && u <= 0xdbff && !(s.charCodeAt(k + 1) >= 0xdc00 && s.charCodeAt(k + 1) <= 0xdfff); });
          return Object.assign({ cardText: text.slice(0, 80), cardAria: aria, railName, cardLoneSurrogate: lone(text), ariaLoneSurrogate: lone(aria), railLoneSurrogate: railName ? lone(railName) : null, privacy: window.__proto.privacy }, renamed);
        }, renamed);
        const reproduced = !!astral && astral.wellFormed === false && astral.units[0] === 'd842' && !!rendered && (rendered.cardLoneSurrogate || rendered.ariaLoneSurrogate);
        rec('S2-privacy-phi-events-3', 'Proto.ui.initials() splits a supplementary-plane first character into a lone UTF-16 surrogate ("\\uD842太" for 𠮷野 太郎), so under privacy mode the board card text and aria-label carry an ill-formed string instead of initials', 'B8 privacy mode shows initials; WCAG 1.3.1/4.1.2 name must be a well-formed string; ui.js initials()', reproduced, { helper, rendered, pageErrors: errs.slice(0, 3) });
      } finally { await c.close(); }
    },

    // events.js:31-44 · every click is logged with its closest data-testid and every keydown with `key`, so the in-page
    // event log becomes a credential and PHI channel: the phone step-up keypad's digits are testids (phone.stepup.<d>,
    // CONTRACTS §4), so the approver's PIN (2468 for the seeded dentist) is readable in order from window.__events; and the
    // palette's second identifier — a date of birth typed under privacy=1 — is reconstructed key by key from the `key`
    // field, even though privacy mode hides that date on every screen. CONTRACTS §5 documents `key: KeyboardEvent.key`,
    // so this is a documented-intent-vs-safety conflict (severity low).
    // Negative control: keys typed into a text field are logged without their value (key omitted or masked for field:true)
    // and keypad digits log a digit-free testid, so pinFromEvents !== the user's PIN and dobFromKeys does not contain the
    // typed date; the check reports false.
    async 'S2-privacy-phi-events-4'(b) {
      const { c, p } = await ctx(b, 420, 860);
      try {
        await go(p, '#/phone/approvals?device=phone');
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const user = await p.evaluate(() => { const u = Proto.store.currentUser(); return { id: u.id, name: u.name, pin: u.pin || null }; });
        const seq0 = await p.evaluate(() => window.__events.length ? window.__events[window.__events.length - 1].seq : 0);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(150);
        const padOpen = !!(await p.$('[data-testid="phone.stepup.display"]'));
        if (padOpen && user.pin) for (const d of user.pin) await click(p, 'phone.stepup.' + d);
        const pinEvents = await p.evaluate((s) => window.__events.filter((e) => e.seq > s && e.kind === 'click' && /^phone\.stepup\.\d$/.test(e.testid || '')).map((e) => ({ seq: e.seq, testid: e.testid })), seq0);
        const pinFromEvents = pinEvents.map((e) => e.testid.slice(-1)).join('');
        await click(p, 'phone.stepup.cancel');
        // The second identifier typed under privacy: the palette DOB field on a shared device.
        await hop(p, '#/frontdesk/board?device=shared&privacy=1'); await p.evaluate(() => window.__proto.set({ device: 'shared', privacy: true })); await p.waitForTimeout(150);
        const seq1 = await p.evaluate(() => window.__events[window.__events.length - 1].seq);
        const opened = await openPalette(p, 'MRN-302');
        const row = opened && await p.$('[data-testid="palette.row.0"]'); if (row) { await row.click(); await p.waitForTimeout(150); }
        const dob302 = await p.evaluate(() => { const x = window.__proto.state().patients.find((q) => q.id === 'p-302'); const [y, m, d] = x.dob.split('-'); return m + '/' + d + '/' + y; });
        if (await p.$('[data-testid="palette.confirm.dob"]')) await p.type('[data-testid="palette.confirm.dob"]', dob302, { delay: 5 });
        const keyEvents = await p.evaluate((s) => window.__events.filter((e) => e.seq > s && e.kind === 'key' && e.field === true && e.testid === 'palette.confirm.dob').map((e) => ({ seq: e.seq, key: e.key })), seq1);
        const dobFromKeys = keyEvents.map((e) => e.key).join('');
        const onScreenDob = await p.evaluate(() => document.getElementById('canvas').textContent.includes(window.__proto.state().patients.find((q) => q.id === 'p-302').dob.slice(5)));
        const privacy = await p.evaluate(() => ({ privacy: window.__proto.privacy, device: window.__proto.device }));
        const reproduced = padOpen && !!user.pin && pinFromEvents === user.pin && privacy.privacy === true && dobFromKeys.includes(dob302);
        rec('S2-privacy-phi-events-4', 'window.__events reconstructs the approver\'s step-up PIN from phone.stepup.<digit> click testids and the palette\'s typed date of birth from key events under privacy=1, so the event log carries a credential and the PHI privacy mode hides on screen', 'CONTRACTS §5 (key: KeyboardEvent.key; testid on click) vs B8 privacy / credential hygiene — documented-intent conflict, severity low; events.js:31-44, phone.js:122-124', reproduced, { user: { id: user.id, name: user.name }, pinLength: user.pin ? user.pin.length : 0, pinMatches: pinFromEvents === user.pin, pinSeqRange: pinEvents.length ? [pinEvents[0].seq, pinEvents[pinEvents.length - 1].seq] : null, dobKeySeqRange: keyEvents.length ? [keyEvents[0].seq, keyEvents[keyEvents.length - 1].seq] : null, dobFromKeys, dobOnScreenUnderPrivacy: onScreenDob, privacy });
      } finally { await c.close(); }
    },
  };
};
