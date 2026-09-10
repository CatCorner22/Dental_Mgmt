// Audit checks for prototype/js/screens/shell.js, chunk screens-shell
// (root causes RC-48, RC-56, RC-57, RC-58, RC-60, RC-61, RC-127, RC-234, RC-135, RC-138, RC-139, RC-142, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id, persona: e.persona }));
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, isBody: a === document.body }; });
  const whoAmI = (p) => p.evaluate(() => ({ persona: window.__proto.persona, userId: Proto.store.currentUser().id, user: Proto.store.currentUser().name, hash: location.hash }));
  // Word count: whitespace tokens that carry a letter or digit (a lone em dash is punctuation, not a word).
  const words = (s) => (s || '').trim().split(/\s+/).filter((t) => /[A-Za-z0-9#$]/.test(t));
  // Scoped click and read inside the dialog layer, so the pad's own refusal is measured and not a refusal on the canvas behind it.
  const clickIn = async (p, scope, tid) => { const s = `${scope} [data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.click(s); await p.waitForTimeout(90); return true; };
  const dialogRefusal = (p) => p.evaluate(() => { const r = document.querySelector('#dialogs .refusal'); if (!r) return null; return { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() || null, controls: r.querySelectorAll('[data-testid="refusal.control"]').length, why: !!r.querySelector('[data-testid="refusal.why"]') }; });
  const dots = (p) => p.evaluate(() => { const d = document.querySelector('#dialogs .pindots'); return d ? d.textContent : null; });
  const dialogOpen = (p) => p.evaluate(() => !!document.querySelector('#dialogs .dialog'));
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const andon = (p) => p.evaluate(() => { const a = document.getElementById('andon'); const chip = a.querySelector('.chip'); const t = (a.textContent || '').replace(/\s+/g, ' ').trim(); const m = t.match(/(\d+) approvals? waiting/); return { text: t, chip: chip ? chip.textContent.trim() : null, count: m ? Number(m[1]) : 0 }; });
  const phoneView = (p) => p.evaluate(() => { const S = window.__proto.state(); const line = [...document.querySelectorAll('#canvas p')].map((e) => e.textContent.trim()).find((t) => /^\d+ waiting/.test(t)) || null; return { waitingLine: line, waitingCount: line ? Number(line.match(/^(\d+)/)[1]) : 0, cards: [...document.querySelectorAll('[data-testid^="phone.request."][data-testid$=".approve"]')].map((e) => e.getAttribute('data-testid')), storePending: S.approvals.filter((a) => a.status === 'pending').map((a) => ({ id: a.id, requestedById: a.requestedById })) }; });
  const pinKeys = async (p, code) => { for (const d of code.split('')) await clickIn(p, '#dialogs', 'pin.key.' + d); };
  // CONTRACTS §4 as patterns, parsed from the file so the check follows the contract, not a copy of it.
  const s4 = () => {
    const text = fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8');
    const sec = text.slice(text.indexOf('## 4.'), text.indexOf('## 5.'));
    const ids = [...sec.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((x) => /^[a-z][a-z0-9]*\./.test(x));
    const toRe = (id) => new RegExp('^' + id.split(/(<[^>]+>)/).map((part) => {
      if (!part.startsWith('<')) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const inner = part.slice(1, -1);
      if (inner === '0-9') return '[0-9]';
      if (/^\d+-\d+$/.test(inner)) return '\\d+';
      if (inner.includes('|')) return '(' + inner.split('|').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')';
      return '[^.]+';
    }).join('') + '$');
    return { ids, res: ids.map(toRe), searched: sec.replace(/\s+/g, ' ').trim().slice(0, 4000) };
  };
  const domIds = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => ({ id: e.getAttribute('data-testid'), tag: e.tagName, where: e.closest('#topbar') ? 'topbar' : e.closest('#canvas') ? 'canvas' : e.closest('#andon') ? 'andon' : e.closest('#rail1') ? 'rail1' : e.closest('#dialogs') ? 'dialogs' : 'body' })));

  return {
    // RC-48 · B1 · shell.js:28 renders nav.<route> buttons and :117 renders notfound.home, both with click handlers; CONTRACTS §4's
    // Top bar row lists only topbar.location/search/theme/privacy/author/signout and andon.control, and no row names nav.* or notfound.*.
    // Negative control: when §4 carries a pattern that matches every rendered id (nav.<route>, notfound.home) the unmatched list is empty and
    // the check reports false. skip.canvas (index.html:12) is measured and reported but is outside shell.js, so it alone never reproduces.
    async 'A-screens-shell-1'(b) {
      const { c, p } = await ctx(b);
      try {
        const contract = s4();
        const seen = new Map();
        for (const hash of ['#/frontdesk/board', '#/owner/close', '#/frontdesk/nowhere']) {
          await go(p, hash);
          for (const e of await domIds(p)) if (!seen.has(e.id)) seen.set(e.id, Object.assign(e, { hash }));
        }
        const notfoundH1 = await p.evaluate(() => ((document.querySelector('#canvas h1') || {}).textContent || '').trim());
        const all = [...seen.values()];
        const unmatched = all.filter((e) => !contract.res.some((re) => re.test(e.id)));
        const shellUnmatched = unmatched.filter((e) => /^nav\.|^notfound\./.test(e.id));
        const reproduced = shellUnmatched.some((e) => /^nav\./.test(e.id) && e.tag === 'BUTTON') && shellUnmatched.some((e) => e.id === 'notfound.home' && e.tag === 'BUTTON');
        rec('A-screens-shell-1', 'nav.board/money/roles/close/risk (shell.js:28) and notfound.home (shell.js:117) are rendered as buttons with click handlers but match no id or pattern in CONTRACTS §4; skip.canvas (index.html:12) is unmatched too', 'B1 — every id in the DOM matches a §4 entry or pattern; shell.js:28, :117',
          reproduced, { unmatched: unmatched.map((e) => ({ id: e.id, tag: e.tag, where: e.where, hash: e.hash })), shellUnmatched: shellUnmatched.map((e) => e.id), notfoundH1, domIdsChecked: all.length, s4IdsParsed: contract.ids.length, s4Ids: contract.ids, s4TextSearched: contract.searched });
      } finally { await c.close(); }
    },

    // RC-56 · A2 · shell.js:97-106 keeps one module-level pointTimer; each press calls clearTimeout(pointTimer) before arming the new one and
    // classList.remove('pointed') runs only on the new target, so an earlier ring's clear is cancelled and it stays on screen.
    // Negative control: about six seconds after the last press no element carries .pointed (each ring cleared by its own timer or by the next
    // press) and the check reports false. The three presses must first have rung three distinct controls, or there is nothing to clear.
    async 'A-screens-shell-2'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        const chips = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="rail1.chip."]')].map((e) => ({ id: e.getAttribute('data-testid'), label: e.textContent.trim() })));
        const pointed = () => p.evaluate(() => [...document.querySelectorAll('.pointed')].map((e) => e.getAttribute('data-testid') || e.tagName));
        const seq0 = await lastSeq(p);
        const t0 = Date.now();
        const pressed = [];
        for (const tid of ['rail1.chip.0', 'rail1.chip.4', 'rail1.chip.2']) { pressed.push(await press(p, tid)); await p.waitForTimeout(150); }
        const afterPresses = await pointed();
        const announced = await live(p);
        await p.waitForTimeout(6500);
        const after6s = await pointed();
        await p.waitForTimeout(6500);
        const after13s = await pointed();
        const elapsedMs = Date.now() - t0;
        const ev = await after(p, seq0);
        const rang = pressed.every(Boolean) && afterPresses.length === 3 && new Set(afterPresses).size === 3;
        const reproduced = rang && elapsedMs > 12500 && after13s.length > 0;
        rec('A-screens-shell-2', 'After pressing three first-shift chips (Arrive, Find a patient, Checkout) three controls carry the .pointed ring; more than 12.5 s later the rings from the first two presses are still there — only the last press\'s ring clears', 'A2 — a "show me" chip points for about six seconds and the ring clears; shell.js:106 clearTimeout(pointTimer) cancels the earlier element\'s clear',
          reproduced, { chips, pressed, pointedAfterPresses: afterPresses, pointedAfter6s: after6s, pointedAfter13s: after13s, elapsedMs, lastAnnouncement: announced, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-57 · C5 · shell.js:52 counts pending approvals only when the viewer holds approve_second and did not request them; phone.js:187 and
    // moneydesk.js:49 count every pending approval. With two requests (one by the owner, one by the biller) the owner's Andon says 1 while the
    // phone shows 2 cards; the biller's Andon is empty while the phone shows 2 cards and the Approvals tab 2.
    // Negative control: when the three renderings carry the same number for one signed-in user (or the filtering surface says it filters) every
    // row has andonCount === cards.length and the check reports false. Both requests must be pending in the store before the counts are read.
    async 'A-screens-shell-3'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/owner/money');
        const seq0 = await lastSeq(p);
        await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200);
        const ownerRequest = await whoAmI(p);
        const ownerAndonAfterOwnRequest = await andon(p);
        await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        await click(p, 'phone.simulate'); await p.waitForTimeout(200);
        const rows = [];
        const owner = await whoAmI(p);
        rows.push({ persona: owner.persona, userId: owner.userId, andon: await andon(p), phone: await phoneView(p) });
        await hop(p, '#/biller/money'); await p.waitForTimeout(200);
        const biller = await whoAmI(p);
        const billerAndon = await andon(p);
        const tabCount = await p.evaluate(() => { const e = document.querySelector('[data-testid="money.tab.approvals"] .count'); return e ? Number(e.textContent.trim()) : null; });
        await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        rows.push({ persona: biller.persona, userId: biller.userId, andon: billerAndon, approvalsTabCount: tabCount, phone: await phoneView(p) });
        await hop(p, '#/frontdesk/board'); await p.waitForTimeout(150);
        const fd = await whoAmI(p);
        const fdAndon = await andon(p);
        await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        rows.push({ persona: fd.persona, userId: fd.userId, andon: fdAndon, phone: await phoneView(p) });
        const ev = await after(p, seq0);
        const twoPending = rows.every((r) => r.phone.storePending.length === 2);
        const scored = rows.map((r) => ({ persona: r.persona, andonCount: r.andon.count, phoneCards: r.phone.cards.length, phoneWaiting: r.phone.waitingCount, approvalsTab: r.approvalsTabCount == null ? undefined : r.approvalsTabCount, disagree: r.andon.count !== r.phone.cards.length }));
        const reproduced = twoPending && scored.some((s) => s.disagree);
        rec('A-screens-shell-3', 'With two pending requests (owner\'s ar-1, biller\'s ar-2) the owner\'s Andon reads "1 approval waiting" while the phone shows 2 cards and "2 waiting"; the biller\'s Andon is empty while the phone shows 2 cards and the Approvals tab 2', 'C5 — Andon count = approvals tab = phone cards; shell.js:52 filters by entitlement and requester, phone.js:187 does not',
          reproduced, { ownerRequest, ownerAndonAfterOwnRequest, rows, scored, twoPendingInStore: twoPending, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-58 · B10 · shell.js:38-39 rebuild the top bar with top.replaceChildren (and :38 re-renders the canvas) inside the focused button's own
    // handler, so the element that held focus is removed and document.activeElement falls to body.
    // Negative control: after each press activeElement is a control (the toggle itself or another data-testid element) and the check reports
    // false. Each press is scored only when its toggle worked (data-privacy / aria-pressed flipped; data-theme flipped), so a dead button is not
    // mistaken for dropped focus.
    async 'A-screens-shell-4'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const root = () => p.evaluate(() => ({ privacy: document.documentElement.hasAttribute('data-privacy'), theme: document.documentElement.getAttribute('data-theme'), privacyPressed: (document.querySelector('[data-testid="topbar.privacy"]') || {}).getAttribute && document.querySelector('[data-testid="topbar.privacy"]').getAttribute('aria-pressed'), privacyLabel: ((document.querySelector('[data-testid="topbar.privacy"]') || {}).textContent || '').trim(), themeLabel: ((document.querySelector('[data-testid="topbar.theme"]') || {}).textContent || '').trim() }));
        const seq0 = await lastSeq(p);
        const before = await root();
        const focusBeforePrivacy = await (async () => { await p.focus('[data-testid="topbar.privacy"]'); return focused(p); })();
        await press(p, 'topbar.privacy'); await p.waitForTimeout(150);
        const afterPrivacy = await root(); const focusAfterPrivacy = await focused(p);
        await press(p, 'topbar.theme'); await p.waitForTimeout(150);
        const afterTheme = await root(); const focusAfterTheme = await focused(p);
        const ev = await after(p, seq0);
        const privacyWorked = before.privacy === false && afterPrivacy.privacy === true && afterPrivacy.privacyPressed === 'true';
        const themeWorked = afterPrivacy.theme === 'light' && afterTheme.theme === 'dark';
        const reproduced = (privacyWorked && focusAfterPrivacy.isBody) || (themeWorked && focusAfterTheme.isBody);
        rec('A-screens-shell-4', 'Pressing Privacy (Enter, focus on the toggle) flips data-privacy and aria-pressed but leaves document.activeElement on BODY; pressing the theme toggle flips data-theme and leaves focus on BODY', 'B10 — after a control press focus lands on the next action or the state line, never on body; shell.js:38-39',
          reproduced, { before, focusBeforePrivacy, afterPrivacy, focusAfterPrivacy, privacyWorked, afterTheme, focusAfterTheme, themeWorked, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-60 · B10 · shell.js:94-95 replace the rail bar's children inside the toggle's own handler (bar.replaceChildren), removing the focused
    // Hide / Show button, so activeElement falls to body after both presses.
    // Negative control: activeElement after each press is the replacement toggle (data-testid rail1.toggle) or another control and the check
    // reports false. Each press is scored only when it worked (chips 5 → 0 with the label "Show first-shift steps", then 0 → 5 with "Hide").
    async 'A-screens-shell-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/temp/board');
        const rail = () => p.evaluate(() => ({ chips: document.querySelectorAll('[data-testid^="rail1.chip."]').length, toggleLabel: ((document.querySelector('[data-testid="rail1.toggle"]') || {}).textContent || '').trim(), collapsed: !!Proto.store.get().rail1Collapsed }));
        const seq0 = await lastSeq(p);
        const before = await rail();
        await press(p, 'rail1.toggle'); await p.waitForTimeout(150);
        const hidden = await rail(); const focusAfterHide = await focused(p);
        await press(p, 'rail1.toggle'); await p.waitForTimeout(150);
        const shown = await rail(); const focusAfterShow = await focused(p);
        const ev = await after(p, seq0);
        const hideWorked = before.chips > 0 && hidden.chips === 0 && hidden.collapsed && /show/i.test(hidden.toggleLabel);
        const showWorked = hideWorked && shown.chips === before.chips && !shown.collapsed && /hide/i.test(shown.toggleLabel);
        const reproduced = (hideWorked && focusAfterHide.isBody) || (showWorked && focusAfterShow.isBody);
        rec('A-screens-shell-5', 'Pressing Hide on the first-shift rail collapses it (5 chips → 0, toggle reads "Show first-shift steps") and leaves document.activeElement on BODY; pressing Show restores the chips and again leaves focus on BODY', 'B10 — after a control press focus lands on the next action, never on body; shell.js:94-95 bar.replaceChildren removes the focused toggle',
          reproduced, { before, hidden, focusAfterHide, hideWorked, shown, focusAfterShow, showWorked, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-61 · B2 · shell.js:69 and :75 render the pad's two refusals with verb lines "PIN did not match — try again" and "<name> has no charting
    // session here": the first token is the noun PIN or a person's name, not a verb. Noun-first is measured, not judged: the first token is an
    // all-caps acronym or equals a seed user's first name / short name.
    // Negative control: a verb-first line ("Retype the PIN", "Keep the current author") has a first token that is neither an acronym nor a seed
    // name and the check reports false. Each line is scored only when its refusal event carries the claimed code (pin_no_match, no_chart_session)
    // and the line came through the shared component (refusal.verb inside the dialog), so a different refusal is never mistaken for these two.
    async 'A-screens-shell-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const names = await p.evaluate(() => window.__proto.state().users.flatMap((u) => [u.short, u.name]).filter(Boolean).map((n) => n.replace(/^Dr\.\s+/, '').split(/\s+/)[0]));
        const seq0 = await lastSeq(p);
        await click(p, 'topbar.author'); await p.waitForTimeout(120);
        await pinKeys(p, '0000'); await clickIn(p, '#dialogs', 'pin.submit'); await p.waitForTimeout(150);
        const wrong = await dialogRefusal(p);
        await pinKeys(p, '4444'); await clickIn(p, '#dialogs', 'pin.submit'); await p.waitForTimeout(150);
        const dana = await dialogRefusal(p);
        const ev = await after(p, seq0);
        const refs = refusalEvents(ev);
        const score = (r, code) => { if (!r || r.code !== code) return { code, matched: false }; const w = words(r.verb); const first = (w[0] || '').replace(/[^A-Za-z.]/g, ''); return { code, matched: refs.some((e) => e.code === code && e.verb === r.verb), verb: r.verb, firstWord: first, wordCount: w.length, withinEight: w.length <= 8, acronymFirst: /^[A-Z]{2,}$/.test(first), seedNameFirst: names.includes(first), controls: r.controls, why: r.why }; };
        const s1 = score(wrong, 'pin_no_match'); const s2 = score(dana, 'no_chart_session');
        const nounFirst = (s) => s.matched && (s.acronymFirst || s.seedNameFirst);
        const reproduced = nounFirst(s1) && nounFirst(s2);
        rec('A-screens-shell-6', 'The pad\'s pin_no_match line "PIN did not match — try again" opens on the noun PIN and the no_chart_session line "Dana has no charting session here" opens on a person\'s name; neither is verb-first (both are within eight words and use the shared component)', 'B2 / CONTRACTS §6 — verb line verb-first, at most eight words; shell.js:69, :75',
          reproduced, { wrongPin: s1, danaPin: s2, seedFirstNames: names, refusalEvents: refs, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-127 · C2 · phone.js:99 names "Dana or Dr. Reagan" as the remedy and offers Switch author (shell.js openPinPad); shell.js:72-75 then
    // refuses Dana's PIN 4444 with no_chart_session because seed.personaUser has no entry for u-om-1, so the one control on the gate cannot do
    // what the verb line says for the first person it names. Dr. Reagan's PIN 2468 is the contrast: the same control switches the author.
    // Negative control: after PIN 4444 the current user is Dana (u-om-1) with the pad closed and no refusal, and the check reports false. The
    // check also reports false when the card's verb does not name Dana, or when Dana's PIN is not in the seed with approve_second.
    async 'A-screens-shell-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const viewer = await whoAmI(p);
        const danaSeed = await p.evaluate(() => { const u = window.__proto.state().users.find((x) => x.pin === '4444'); return u ? { id: u.id, short: u.short, entitlements: u.entitlements, inPersonaUser: Object.values(window.__proto.state().personaUser).includes(u.id) } : null; });
        await click(p, 'phone.simulate'); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(200);
        const card = await p.evaluate(() => { const r = document.querySelector('#canvas .refusal'); return r ? { code: r.dataset.code, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() } : null; });
        await clickIn(p, '#canvas', 'refusal.control'); await p.waitForTimeout(150);
        const padOpened = await dialogOpen(p);
        await pinKeys(p, '4444'); await clickIn(p, '#dialogs', 'pin.submit'); await p.waitForTimeout(200);
        const afterDana = { refusal: await dialogRefusal(p), padOpen: await dialogOpen(p), who: await whoAmI(p) };
        // Contrast: the second name on the line, Dr. Reagan (2468), through the same control.
        await clickIn(p, '#dialogs', 'refusal.control'); await p.waitForTimeout(150);
        await click(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(150);
        await clickIn(p, '#canvas', 'refusal.control'); await p.waitForTimeout(150);
        await pinKeys(p, '2468'); await clickIn(p, '#dialogs', 'pin.submit'); await p.waitForTimeout(300);
        const afterReagan = { padOpen: await dialogOpen(p), who: await whoAmI(p) };
        const ev = await after(p, seq0);
        const refs = refusalEvents(ev);
        const namesDana = !!card && /\bDana\b/.test(card.verb) && /switch author/i.test(card.control);
        const danaRefused = !!afterDana.refusal && afterDana.refusal.code === 'no_chart_session' && refs.some((e) => e.code === 'no_chart_session') && afterDana.who.userId === viewer.userId && afterDana.padOpen;
        const reaganSwitched = !afterReagan.padOpen && afterReagan.who.userId === 'u-dr-1';
        const reproduced = !!danaSeed && danaSeed.entitlements.includes('approve_second') && namesDana && padOpened && danaRefused;
        rec('A-screens-shell-7', 'The needs_second card names "Dana or Dr. Reagan" and offers Switch author; Dana\'s PIN 4444 (u-om-1, approve_second) is refused inside the pad with no_chart_session and the author stays Priya, while Dr. Reagan\'s 2468 through the same control switches the author', 'C2 — the one control does what the verb line says; shell.js:72-75 (personaUser has no entry for Dana), phone.js:99',
          reproduced, { viewer, danaSeed, cardRefusal: card, namesDana, padOpened, afterDana, danaRefused, afterReagan, reaganSwitched, refusalEvents: refs, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-234 · B4 / B10 · shell.js:84 builds the author pad from click-only buttons with no keydown handler, so typed digits never reach
    // `digits`; phone.js:212-219 gives the step-up pad a keyboard grammar, but its Enter clause excludes any focused button other than the
    // submit, so Enter on the landing key phone.stepup.1 activates that button and appends a digit instead of submitting.
    // Negative control: both pads show four dots after typing 1234 and Enter submits (a refusal or an approval follows, not a fifth dot), so
    // grammarsDiffer and enterAppended are both false and the check reports false. The author pad must have opened with focus on pin.key.1 and
    // the step-up on phone.stepup.1 before the typed keys are scored.
    async 'A-screens-shell-8'(b) {
      const author = {}; const stepup = {};
      { const { c, p } = await ctx(b);
        try {
          await go(p, '#/frontdesk/board');
          const seq0 = await lastSeq(p);
          await press(p, 'topbar.author'); await p.waitForTimeout(150);
          author.focusOnOpen = await focused(p);
          await p.keyboard.type('1234', { delay: 20 }); await p.waitForTimeout(120);
          author.dotsAfterTyping = await dots(p);
          await press(p, 'pin.submit'); await p.waitForTimeout(150);
          author.refusalAfterSubmit = await dialogRefusal(p);
          const ev = await after(p, seq0);
          author.keyEvents = ev.filter((e) => e.kind === 'key' && /^[0-9]$/.test(e.key)).map((e) => ({ seq: e.seq, key: e.key, testid: e.testid }));
          author.refusalEvents = refusalEvents(ev); author.seqRange = range(ev, seq0);
        } finally { await c.close(); } }
      { const { c, p } = await ctx(b);
        try {
          await go(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
          await press(p, 'phone.simulate'); await p.waitForTimeout(150);
          const seq0 = await lastSeq(p);
          await press(p, 'phone.request.ar-1.approve'); await p.waitForTimeout(150);
          stepup.focusOnOpen = await focused(p);
          await p.keyboard.type('1234', { delay: 20 }); await p.waitForTimeout(120);
          stepup.dotsAfterTyping = await dots(p);
          stepup.focusBeforeEnter = await focused(p);
          await p.keyboard.press('Enter'); await p.waitForTimeout(200);
          stepup.dotsAfterEnter = await dots(p);
          stepup.approvalAfterEnter = await p.evaluate(() => (window.__proto.state().approvals.find((a) => a.id === 'ar-1') || {}).status);
          stepup.padOpenAfterEnter = await dialogOpen(p);
          await press(p, 'phone.stepup.submit'); await p.waitForTimeout(250);
          stepup.approvalAfterSubmit = await p.evaluate(() => (window.__proto.state().approvals.find((a) => a.id === 'ar-1') || {}).status);
          const ev = await after(p, seq0);
          stepup.writes = writes(ev); stepup.seqRange = range(ev, seq0);
        } finally { await c.close(); } }
      const authorOpened = author.focusOnOpen && author.focusOnOpen.testid === 'pin.display';
      const stepupOpened = stepup.focusOnOpen && stepup.focusOnOpen.testid === 'phone.stepup.1';
      const authorIgnoresTyping = authorOpened && author.keyEvents.length === 4 && (author.dotsAfterTyping || '').length === 0 && !!author.refusalAfterSubmit && author.refusalAfterSubmit.code === 'pin_no_match';
      const stepupAcceptsTyping = stepupOpened && (stepup.dotsAfterTyping || '').length === 4;
      const grammarsDiffer = authorIgnoresTyping && stepupAcceptsTyping;
      const enterAppended = stepupAcceptsTyping && stepup.focusBeforeEnter.testid === 'phone.stepup.1' && (stepup.dotsAfterEnter || '').length === 5 && stepup.approvalAfterEnter === 'pending' && stepup.padOpenAfterEnter;
      const reproduced = grammarsDiffer || enterAppended;
      rec('A-screens-shell-8', 'Typing 1234 into the author pad leaves the dots empty and Go refuses pin_no_match, while the same keys in the phone step-up show four dots; on the step-up, Enter with focus on the landing key appends a fifth dot instead of submitting, and only the Approve key submits', 'B4 (same concept, same shape) / B10; shell.js:84 (no keydown grammar) versus phone.js:212-219 (Enter clause excludes the focused key)',
        reproduced, { authorPad: author, stepupPad: stepup, authorIgnoresTyping, stepupAcceptsTyping, grammarsDiffer, enterAppended });
    },

    // RC-135 · A3 · shell.js:78 calls Proto.events.write('sessions', 'sess-' + who.id) directly — an event, not a store write — so the log
    // reports a row in a table the store does not hold, while state() is byte-identical before and after the switch.
    // Negative control: a compliant switch either writes a sessions row (state() gains the table with a row whose id equals the event id) or
    // logs no write at all (a silent switch is a different finding) — either way the check reports false. The switch must first have landed
    // (persona dentist, current user u-dr-2, hash #/dentist/…) before the event is scored.
    async 'A-screens-shell-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const before = await whoAmI(p);
        const stateBefore = await p.evaluate(() => JSON.stringify(window.__proto.state()));
        const seq0 = await lastSeq(p);
        await click(p, 'topbar.author'); await p.waitForTimeout(120);
        await pinKeys(p, '1357'); await clickIn(p, '#dialogs', 'pin.submit'); await p.waitForTimeout(300);
        const afterW = await whoAmI(p);
        const stateAfter = await p.evaluate(() => JSON.stringify(window.__proto.state()));
        const ev = await after(p, seq0);
        const w = writes(ev);
        const tables = await p.evaluate((ids) => { const S = window.__proto.state(); return ids.map(([table, id]) => ({ table, id, tableExists: Object.prototype.hasOwnProperty.call(S, table), rowsInTable: Array.isArray(S[table]) ? S[table].length : null, rowWithId: Array.isArray(S[table]) ? S[table].some((r) => r && r.id === id) : false })); }, w.map((x) => [x.table, x.id]));
        const diffKeys = await p.evaluate(([a, b2]) => { const A = JSON.parse(a), B = JSON.parse(b2); return [...new Set([...Object.keys(A), ...Object.keys(B)])].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k])); }, [stateBefore, stateAfter]);
        const switched = before.userId === 'u-fd-1' && afterW.userId === 'u-dr-2' && afterW.persona === 'dentist' && /^#\/dentist\//.test(afterW.hash) && !(await dialogOpen(p));
        const phantom = tables.filter((t) => !t.tableExists || !t.rowWithId);
        const reproduced = switched && w.length > 0 && phantom.length === w.length && stateBefore === stateAfter;
        rec('A-screens-shell-9', 'Switching author with Dr. Kim\'s PIN logs {kind: write, table: sessions, id: sess-u-dr-2} while window.__proto.state() is byte-identical before and after and holds no sessions table', 'A3 — a write event names a table and id the store changed; shell.js:78 calls Proto.events.write directly',
          reproduced, { before, after: afterW, switched, writeEvents: w, writtenTablesInStore: tables, stateIdentical: stateBefore === stateAfter, stateDiffKeys: diffKeys, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-138 · C8 · shell.js:33 announces "Location switching is out of scope for the prototype" and :48 "Support: 615-555-0100, answered 7 am
    // to 6 pm Central" — nine words each, neither opening on a verb. The eight-word line is the product's own measure of "one verb line" (§6).
    // Negative control: each announcement is at most eight words (e.g. "Switch location: not in this prototype", "Call support: 615-555-0100")
    // and the check reports false. #live must have received the text (non-empty after the press) before it is counted.
    async 'A-screens-shell-10'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board?outage=1');
        const seq0 = await lastSeq(p);
        const out = [];
        for (const tid of ['topbar.location', 'andon.control']) {
          const label = await txt(p, tid);
          const pressed = await click(p, tid); await p.waitForTimeout(200);
          const text = await live(p); const w = words(text);
          out.push({ control: tid, label, pressed, announcement: text, wordCount: w.length, firstWord: w[0] || null, overEight: w.length > 8 });
        }
        const ev = await after(p, seq0);
        const reproduced = out.every((o) => o.pressed && o.announcement) && out.some((o) => o.overEight);
        rec('A-screens-shell-10', 'The location control announces "Location switching is out of scope for the prototype" (9 words, noun-first) and the outage Support line announces "Support: 615-555-0100, answered 7 am to 6 pm Central" (9 words, no verb) through #live', 'C8 — announcements are one verb line, not prose; shell.js:33, :48',
          reproduced, { announcements: out, seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-139 · B4 · shell.js:38 labels the control "Privacy" / "Privacy on" while its aria-label and signin.js:24 say "Privacy mode"; shell.js:25
    // labels the signed-out theme control "Dark theme" / "Light theme" while :39 and signin.js:17-18 say "Dark" / "Light".
    // Negative control: one term per concept (privacy labels and aria all "Privacy mode"; theme labels all "Dark"/"Light" or all "Dark theme")
    // gives one distinct term per concept and the check reports false. Terms are normalised only by dropping the ✓ mark, case, the state word
    // "on" and the aria prefix "Switch to", so the raw labels are in the evidence.
    async 'A-screens-shell-11'(b) {
      const { c, p } = await ctx(b);
      try {
        const read = (tid) => p.evaluate((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); return e ? { label: e.textContent.replace(/✓/g, '').trim(), aria: e.getAttribute('aria-label') } : null; }, tid);
        await go(p, '#/signin');
        const signin = { privacy: await read('signin.privacy'), themeLight: await read('signin.theme.light'), themeDark: await read('signin.theme.dark') };
        await go(p, '#/frontdesk/board');
        const bar = { privacy: await read('topbar.privacy'), theme: await read('topbar.theme') };
        await click(p, 'topbar.privacy'); await p.waitForTimeout(150);
        bar.privacyOn = await read('topbar.privacy');
        await click(p, 'topbar.theme'); await p.waitForTimeout(150);
        bar.themeAfterToggle = await read('topbar.theme');
        await click(p, 'topbar.signout'); await p.waitForTimeout(200);
        const signedOut = { theme: await read('topbar.theme') };
        const norm = (s) => (s || '').toLowerCase().replace(/^switch to\s+/, '').replace(/:.*$/, '').replace(/\s+on$/, '').trim();
        const privacyTerms = [signin.privacy && signin.privacy.label, bar.privacy && bar.privacy.label, bar.privacy && bar.privacy.aria, bar.privacyOn && bar.privacyOn.label].filter(Boolean).map(norm);
        const themeTerms = [signin.themeDark && signin.themeDark.label, bar.theme && bar.theme.label, bar.theme && bar.theme.aria, bar.themeAfterToggle && bar.themeAfterToggle.label, bar.themeAfterToggle && bar.themeAfterToggle.aria, signedOut.theme && signedOut.theme.label].filter(Boolean).map(norm);
        // A theme label names a target ("dark"); compare the term shape by dropping the colour word so "dark"/"light" is one shape and "dark theme" another.
        const themeShapes = [...new Set(themeTerms.map((t) => t.replace(/\b(dark|light)\b/, '<colour>')))];
        const privacyDistinct = [...new Set(privacyTerms)];
        const reproduced = !!signin.privacy && !!bar.privacy && !!signedOut.theme && (privacyDistinct.length > 1 || themeShapes.length > 1);
        rec('A-screens-shell-11', 'Privacy is "Privacy mode" on sign-in and in the top-bar aria-label but "Privacy" / "Privacy on" on the top-bar button; the theme control is "Dark"/"Light" signed in and on sign-in but "Dark theme"/"Light theme" on the signed-out top bar', 'B4 — one canonical word per concept across screens and aria-labels; shell.js:25, :38-39, signin.js:17-24',
          reproduced, { signin, topbar: bar, signedOut, privacyTerms, privacyDistinct, themeTerms, themeShapes });
      } finally { await c.close(); }
    },

    // RC-142 · C6 · shell.js:61 renders the policy paragraph ("…yours is revoked and local drafts are wiped after autosave.") as a visible .hint
    // the moment the pad opens, before any digit, not behind Why or a disclosure. Listed in docs/14 § Open after round 2 (known_in_docs14).
    // Negative control: the pad opens with no hint, or the hint sits inside a closed details/Why disclosure (not visible), and the check
    // reports false. The pad must be open with zero dots (no digit yet) when the hint is measured.
    async 'A-screens-shell-12'(b) {
      const { c, p } = await ctx(b);
      try {
        const out = [];
        for (const device of ['operatory', 'phone', 'desk']) {
          await go(p, '#/frontdesk/board?device=' + device);
          await click(p, 'topbar.author'); await p.waitForTimeout(150);
          const m = await p.evaluate(() => {
            const dlg = document.querySelector('#dialogs .dialog'); if (!dlg) return null;
            const hint = dlg.querySelector('.hint');
            const b = hint ? hint.getBoundingClientRect() : null;
            return { dialogOpen: true, dots: (dlg.querySelector('.pindots') || {}).textContent || '', refusalShown: !!dlg.querySelector('.refusal'), hint: hint ? hint.textContent.trim() : null, hintVisible: !!hint && b.height > 4 && getComputedStyle(hint).visibility !== 'hidden', insideDisclosure: !!(hint && hint.closest('details')), disclosureOpen: !!(hint && hint.closest('details') && hint.closest('details').open) };
          });
          const w = words(m && m.hint);
          out.push(Object.assign({ device, wordCount: w.length, policyProse: /revoked|wiped|signs you out/i.test((m && m.hint) || '') }, m || { dialogOpen: false }));
          await p.keyboard.press('Escape'); await p.waitForTimeout(100);
        }
        const onFinishPath = (o) => o.dialogOpen && o.dots === '' && !o.refusalShown && o.hintVisible && !(o.insideDisclosure && !o.disclosureOpen) && o.policyProse && o.wordCount > 8;
        const shared = out.filter((o) => o.device !== 'desk');
        const reproduced = shared.some(onFinishPath);
        rec('A-screens-shell-12', 'On operatory and phone the Switch author pad opens with a visible 21-word policy hint ("Enter the other person\'s PIN. Their session opens on this page; yours is revoked and local drafts are wiped after autosave.") before the first digit, not behind Why', 'C6 — policy prose never on the finish path; explanations behind Why or a disclosure; shell.js:61 (known in docs/14 § Open after round 2)',
          reproduced, { byDevice: out, sharedDevicesOnFinishPath: shared.map((o) => ({ device: o.device, onFinishPath: onFinishPath(o) })) });
      } finally { await c.close(); }
    },
  };
};
