// Audit checks for prototype/js/screens/checkout.js, chunk screens-checkout-2
// (root causes RC-248, RC-150, RC-151, RC-152, RC-153, RC-154, RC-155, RC-229, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the measured values.
// Every check closes each browser context it opens in a `finally` so one failure cannot hang the run.
//
// Three measurement rules this module follows, each because the naive version gives a wrong verdict here:
//   1. CSS is measured through getComputedStyle on the live element. document.styleSheets[i].cssRules throws a
//      SecurityError over file://, and a catch-and-continue silently yields "no rules", which reads as a pass.
//   2. Every leg of a multi-leg check gets its OWN context. A second go() to the same file:// URL with a different
//      hash is a same-document navigation, so checkout.js's module-level `state` map (line 15) and rail.js's `led`
//      map survive it and the second leg would measure the first leg's form state.
//   3. The "visible text" walker skips closed <details> subtrees explicitly. A collapsed <details> still lays out
//      with a non-zero box in this Chromium, so a box-size-only filter counts text that is behind a disclosure as
//      if it were on screen — which would make a C6 "prose behind a disclosure" screen look like a breach.
export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const evSummary = (ev) => ev.map((e) => ({ seq: e.seq, kind: e.kind, testid: e.testid || null, code: e.code || null, table: e.table || null, id: e.id || null }));
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const live = (p) => p.evaluate(() => ((document.getElementById('live') || {}).textContent || '').trim());
  const h1 = (p) => p.evaluate(() => ((document.querySelector('#canvas h1') || document.querySelector('h1') || {}).textContent || '').trim());
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid')));
  const refusalDom = (p) => p.evaluate(() => { const r = document.querySelector('.refusal'); return r ? { code: r.dataset.code || null, verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim(), control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() } : null; });
  // Sentence split that does not break on an honorific: "Dana or Dr. Reagan will see it" is one sentence, not two.
  const sentences = (t) => t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).reduce((acc, part) => {
    if (acc.length && /\b(?:Dr|Drs|Mr|Mrs|Ms|St|Jr|Sr|vs|No|Inc|est)\.$/.test(acc[acc.length - 1])) acc[acc.length - 1] += ' ' + part; else acc.push(part);
    return acc;
  }, []);

  // Leaf text a sighted user can actually read, inside `sel`. Skips: closed <details> (rule 3 above, reported
  // separately as `behindDisclosure` so a check can prove the walker excluded it), hidden/display:none/visibility:hidden
  // (read from getComputedStyle, rule 1), and .sr-only screen-reader lines.
  const visibleLeaves = (p, sel) => p.evaluate((sel) => {
    const root = document.querySelector(sel); if (!root) return null;
    const out = { leaves: [], behindDisclosure: [] };
    const walk = (node) => {
      for (const el of node.children) {
        if (el.tagName === 'DETAILS' && !el.open) { out.behindDisclosure.push({ summary: ((el.querySelector('summary') || {}).textContent || '').trim(), text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120), boxHeight: Math.round(el.getBoundingClientRect().height) }); continue; }
        const cs = getComputedStyle(el);
        if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || el.classList.contains('sr-only')) continue;
        if (el.children.length === 0) {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (t) { const r = el.getBoundingClientRect(); out.leaves.push({ tag: el.tagName, cls: el.className, text: t, words: t.split(/\s+/).length, y: Math.round(r.y), h: Math.round(r.height) }); }
        } else walk(el);
      }
    };
    walk(root);
    return out;
  }, sel);

  // Box of a control against the fold: the work canvas is the scroller (#canvas, overflow-y auto), so "the fold"
  // is the lower of the window and the canvas's visible client rect, measured with the page unscrolled.
  const foldBox = (p, tid) => p.evaluate((tid) => {
    const el = document.querySelector(`[data-testid="${tid}"]`); if (!el) return { missing: true };
    const canvas = document.getElementById('canvas');
    const cr = canvas ? canvas.getBoundingClientRect() : null;
    const r = el.getBoundingClientRect();
    const fold = Math.min(window.innerHeight, cr ? Math.round(cr.bottom) : window.innerHeight);
    return { y: Math.round(r.y), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), fold, viewport: window.innerHeight,
      aboveFold: Math.round(r.bottom) <= fold, pixelsBelowFold: Math.max(0, Math.round(r.bottom) - fold),
      canvasScrollTop: canvas ? Math.round(canvas.scrollTop) : null, documentScrollTop: Math.round(document.scrollingElement.scrollTop),
      canvasScrollHeight: canvas ? Math.round(canvas.scrollHeight) : null, canvasClientHeight: canvas ? Math.round(canvas.clientHeight) : null };
  }, tid);

  return {
    // RC-248 · C2 (docs/04 "home is the work"; docs/14 records below-the-fold finish controls as defects) ·
    // checkout.js:247 appends paymentCard + postRow after the three-number strip, the status chips and the whole
    // procedures table, so Post is the last thing on a page taller than every device.
    // Measurement: each route opens in its OWN fresh context (rule 2: a second go() would carry the Rail and the
    // checkout form state of the previous leg and change the page height), and the finish control's box is read with
    // canvasScrollTop === 0 and documentScrollTop === 0 — i.e. before any scroll.
    // Negative control: when a finish control IS above the fold the same measurement returns aboveFold true with
    // pixelsBelowFold 0 — and it does so inside this very check for #/dentist/encounter/enc-9002 (enc.file at desk)
    // and #/biller/ledger/p-306 (ledger.statement.send at desk), both of which the claim itself says are above the
    // fold at 1280×900. So the measurement is not "everything is below the fold"; it separates the two. The check
    // scores only checkout.js's own control (checkout.post at 1280×900, 1024×768, 420×860); the other three
    // controls are measured as corroboration of the wider claim and reported in the evidence.
    async 'A-screens-checkout-2-1'(b) {
      const legs = [
        { hash: '#/frontdesk/checkout/a-1044', tid: 'checkout.post', w: 1280, h: 900, file: 'checkout.js', scored: true },
        { hash: '#/frontdesk/checkout/a-1044?device=operatory', tid: 'checkout.post', w: 1024, h: 768, file: 'checkout.js', scored: true },
        { hash: '#/frontdesk/checkout/a-1044?device=phone', tid: 'checkout.post', w: 420, h: 860, file: 'checkout.js', scored: true },
        { hash: '#/frontdesk/checkout/a-1047', tid: 'checkout.post', w: 1280, h: 900, file: 'checkout.js', scored: false },
        { hash: '#/owner/close', tid: 'close.closeday', w: 1280, h: 900, file: 'dailyclose.js', scored: false },
        { hash: '#/owner/close?device=operatory', tid: 'close.closeday', w: 1024, h: 768, file: 'dailyclose.js', scored: false },
        { hash: '#/owner/close?device=phone', tid: 'close.closeday', w: 420, h: 860, file: 'dailyclose.js', scored: false },
        { hash: '#/dentist/encounter/enc-9002', tid: 'enc.file', w: 1280, h: 900, file: 'encounter.js', scored: false },
        { hash: '#/dentist/encounter/enc-9002?device=operatory', tid: 'enc.file', w: 1024, h: 768, file: 'encounter.js', scored: false },
        { hash: '#/dentist/encounter/enc-9002?device=phone', tid: 'enc.file', w: 420, h: 860, file: 'encounter.js', scored: false },
        { hash: '#/biller/ledger/p-306', tid: 'ledger.statement.send', w: 1280, h: 900, file: 'rail.js', scored: false },
        { hash: '#/biller/ledger/p-306?device=operatory', tid: 'ledger.statement.send', w: 1024, h: 768, file: 'rail.js', scored: false },
        { hash: '#/biller/ledger/p-306?device=phone', tid: 'ledger.statement.send', w: 420, h: 860, file: 'rail.js', scored: false },
      ];
      const measured = [];
      for (const leg of legs) {
        const { c, p, errs } = await ctx(b, leg.w, leg.h);
        try {
          await go(p, leg.hash);
          const m = await foldBox(p, leg.tid);
          measured.push(Object.assign({ hash: leg.hash, tid: leg.tid, viewportW: leg.w, file: leg.file, scored: leg.scored, pageErrors: errs.slice(0, 2) }, m));
        } finally { await c.close(); }
      }
      const scored = measured.filter((m) => m.scored);
      const unscrolled = scored.every((m) => m.canvasScrollTop === 0 && m.documentScrollTop === 0);
      const reproduced = scored.length === 3 && unscrolled && scored.every((m) => !m.missing && m.aboveFold === false);
      rec('A-screens-checkout-2-1', 'Checkout’s finish control checkout.post sits below the fold at 1280×900, 1024×768 and 420×860 (RC-248 also claims close.closeday at every width and enc.file / ledger.statement.send at 1024×768 and 420×860 — measured here as corroboration)', 'C2 / docs/04 "home is the work; every row has exactly one primary action"; docs/14 records a finish control below the fold as a defect',
        reproduced, {
          scoredControl: 'checkout.post', scoredLegs: scored.map((m) => ({ hash: m.hash, viewport: m.viewportW + '×' + m.viewport, bottom: m.bottom, fold: m.fold, aboveFold: m.aboveFold, pixelsBelowFold: m.pixelsBelowFold })),
          measuredBeforeAnyScroll: unscrolled,
          corroboratingLegs: measured.filter((m) => !m.scored).map((m) => ({ file: m.file, hash: m.hash, tid: m.tid, viewport: m.viewportW + '×' + m.viewport, bottom: m.bottom, fold: m.fold, aboveFold: m.aboveFold, pixelsBelowFold: m.pixelsBelowFold })),
          aboveFoldControlsFoundByTheSameMeasurement: measured.filter((m) => m.aboveFold === true).map((m) => m.tid + ' @ ' + m.viewportW + ' (bottom ' + m.bottom + ' ≤ fold ' + m.fold + ')'),
          all: measured });
    },

    // RC-150 · A6 · checkout.js:229 — when Proto.store.appt(id) misses, render() mounts its own page
    // (h1 "No appointment <id>" + checkout.back) instead of handing the route to the shell's notfound handler
    // (shell.js:117, h1 "Nothing here" + notfound.home). CONTRACTS §2/A6: an unknown id lands on notfound.
    // Two legs, each in its own context (rule 2).
    // Negative control: leg B opens #/frontdesk/nosuchroute in a fresh context — a route the shell does own — and
    // the same measurement returns h1 "Nothing here" with notfound.home present. That is what "lands on notfound"
    // measures as in this build, so the check reports false whenever checkout gives the same answer; it does not
    // score on the absence of a heading, and it does not accept "some other page rendered" as the breach.
    async 'A-screens-checkout-2-2'(b) {
      let unknown = null; let control = null;
      const A = await ctx(b);
      try {
        await go(A.p, '#/frontdesk/checkout/a-9999');
        unknown = { h1: await h1(A.p), testids: await testids(A.p), notfoundHome: !!(await A.p.$('[data-testid="notfound.home"]')),
          canvasText: await A.p.evaluate(() => document.getElementById('canvas').textContent.replace(/\s+/g, ' ').trim().slice(0, 120)),
          refusalEvents: (await events(A.p)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code })),
          hash: await A.p.evaluate(() => location.hash), pageErrors: A.errs.slice(0, 2) };
      } finally { await A.c.close(); }
      const B = await ctx(b);
      try {
        await go(B.p, '#/frontdesk/nosuchroute');
        control = { h1: await h1(B.p), testids: await testids(B.p), notfoundHome: !!(await B.p.$('[data-testid="notfound.home"]')),
          refusalEvents: (await events(B.p)).filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code })) };
      } finally { await B.c.close(); }
      const reproduced = !!unknown && !!control && control.notfoundHome === true && control.h1 === 'Nothing here'
        && unknown.notfoundHome === false && unknown.h1 !== control.h1 && /a-9999/.test(unknown.h1);
      rec('A-screens-checkout-2-2', 'An unknown appointment id (#/frontdesk/checkout/a-9999) renders a checkout-local "No appointment a-9999" page instead of the shell notfound screen', 'A6 / CONTRACTS §2 — an unknown id lands on notfound; checkout.js:229 mounts its own page',
        reproduced, { unknownId: unknown, notfoundControlRoute: control, expectedH1: control && control.h1, observedH1: unknown && unknown.h1, notfoundCodeInEventLog: unknown && unknown.refusalEvents.length === 0 ? 'none' : unknown && unknown.refusalEvents });
    },

    // RC-151 · C6 · checkout.js:147/149/152/154 (Payment card paragraphs) and :164 (write-off hint) print policy
    // explanations as ordinary paragraphs in the Payment section, above Post.
    // Measurement: the visible-leaf walker over the Payment section, which SKIPS closed <details> (rule 3) — the
    // same page's estimate rationale IS behind a closed <details> ("How the estimate was built", checkout.js:118),
    // and the walker reports it under behindDisclosure instead of counting it. Prose is scored only when its leaf is
    // visible, is not inside any <details>, and sits above the Post button on the finish path.
    // Negative control: prose that has been moved behind a disclosure is exactly what behindDisclosure holds here —
    // that branch of the walker fires on this very page, so if the four Payment paragraphs and the write-off hint
    // moved behind Why the walker would return them there and `onFinishPath` would be empty, and the check reports
    // false. A short non-policy hint ("Prefilled with the patient portion estimate.") is not scored: only sentences
    // that explain policy (named below) count.
    async 'A-screens-checkout-2-3'(b) {
      const POLICY = [
        { key: 'zero_due (checkout.js:154)', re: /Post still writes the collection decision \(reason zero_due\)/ },
        { key: 'send_statement (checkout.js:149)', re: /Reversible until the statement job runs/ },
        { key: 'payment_plan (checkout.js:152)', re: /Only patient-due charges are eligible/ },
        { key: 'collect allocation (checkout.js:147)', re: /Allocates to oldest open charge first/ },
        { key: 'write-off hint (checkout.js:164)', re: /a second approver is needed; the posting is held, never silently allowed/ },
      ];
      const found = {}; let disclosure = null; let postY = null; let writeoffPostY = null;
      const A = await ctx(b);
      try {
        await go(A.p, '#/frontdesk/checkout/a-1045'); // $0 portion: the zero_due paragraph is the default state
        postY = (await foldBox(A.p, 'checkout.post')).y;
        const scan = async (label) => {
          const v = await visibleLeaves(A.p, '#canvas');
          if (!disclosure) disclosure = v.behindDisclosure;
          for (const P of POLICY) { const hit = v.leaves.find((l) => P.re.test(l.text)); if (hit && !found[P.key]) found[P.key] = { state: label, tag: hit.tag, cls: hit.cls, words: hit.words, y: hit.y, text: hit.text.slice(0, 170) }; }
        };
        await scan('zero_due (default at a-1045)');
        await click(A.p, 'checkout.collect.seg.send-statement'); await scan('send_statement');
        await click(A.p, 'checkout.collect.seg.payment-plan'); await scan('payment_plan');
      } finally { await A.c.close(); }
      const B = await ctx(b); // fresh context: a-1047 has a write-off block and a collect default (rule 2)
      try {
        await go(B.p, '#/frontdesk/checkout/a-1047');
        await click(B.p, 'checkout.writeoff.add');
        writeoffPostY = (await foldBox(B.p, 'checkout.post')).y;
        const v = await visibleLeaves(B.p, '#canvas');
        for (const P of POLICY) { const hit = v.leaves.find((l) => P.re.test(l.text)); if (hit && !found[P.key]) found[P.key] = { state: 'write-off open (a-1047)', tag: hit.tag, cls: hit.cls, words: hit.words, y: hit.y, text: hit.text.slice(0, 170) }; }
      } finally { await B.c.close(); }
      const onFinishPath = Object.entries(found).filter(([, v]) => v.y < (v.state.indexOf('a-1047') >= 0 ? writeoffPostY : postY));
      const reproduced = onFinishPath.length >= 3 && Array.isArray(disclosure) && disclosure.length > 0;
      rec('A-screens-checkout-2-3', 'Policy prose sits inline on the Checkout Payment card and on the write-off hint, on the finish path above Post, instead of behind Why or a disclosure', 'C6 / docs/04 "explanations behind progressive disclosure; policy prose never on the finish path"',
        reproduced, { policySentencesVisibleOnFinishPath: Object.fromEntries(onFinishPath), postButtonY: { 'a-1045': postY, 'a-1047': writeoffPostY },
          notScoredBecauseBehindAClosedDisclosure: disclosure, walkerSkippedClosedDetails: Array.isArray(disclosure) && disclosure.length > 0,
          policySentencesSearched: POLICY.map((x) => x.key) });
    },

    // RC-152 · C8 · checkout.js:73 announces 'Posted. ' + n + ' ledger rows and the collection decision are written.'
    // (two sentences, and the count is not pluralised) and checkout.js:81 announces the approval request as two
    // sentences ending in the raw request id.
    // Measurement: #live (index.html:20, aria-live polite) read after each action, with sentence count, word count,
    // the "1 ledger rows" agreement slip and the raw-id match.
    // Negative control: a one-verb-line announcement ("Posted." / "Approval requested") measures as one sentence with
    // no "N ledger rows" and no ar-N, and the check reports false. Leg B must reach the held branch, not just any
    // refusal: it selects a tender first, so the gate that fires is needs_second (store.js:100) — the check asserts
    // the refusal code is needs_second before it scores the announcement, so a tender_required refusal (a different
    // code) can never be mistaken for it.
    async 'A-screens-checkout-2-4'(b) {
      let post = null; let held = null;
      const A = await ctx(b);
      try {
        await go(A.p, '#/frontdesk/checkout/a-1044');
        await click(A.p, 'checkout.tender.card');
        await fill(A.p, 'checkout.card.number', '4111111111111111');
        const seq0 = await lastSeq(A.p);
        await click(A.p, 'checkout.post'); await A.p.waitForTimeout(400);
        const text = await live(A.p);
        const ev = await after(A.p, seq0);
        post = { announcement: text, sentenceList: sentences(text), sentences: sentences(text).length, words: text.split(/\s+/).filter(Boolean).length,
          pluralSlip: /\b1 ledger rows\b/.test(text), rawId: (text.match(/\b(?:le|cd|ar|sd|pp|ai|al)-\d+\b/g) || []),
          ledgerWrites: ev.filter((e) => e.kind === 'write' && e.table === 'ledger').map((e) => e.id), seqRange: range(ev, seq0) };
      } finally { await A.c.close(); }
      const B = await ctx(b); // fresh context (rule 2): checkout.js's state map would otherwise still hold a-1044's form
      try {
        await go(B.p, '#/frontdesk/checkout/a-1047');
        await click(B.p, 'checkout.tender.card');           // tender first, so the gate reached is the write-off gate
        await click(B.p, 'checkout.writeoff.add');
        await fill(B.p, 'checkout.writeoff.amount', '410.00');
        await click(B.p, 'checkout.writeoff.reason.courtesy');
        const seq0 = await lastSeq(B.p);
        await click(B.p, 'checkout.post'); await B.p.waitForTimeout(300);
        const ref = await refusalDom(B.p);
        await click(B.p, 'refusal.control'); await B.p.waitForTimeout(400);
        const text = await live(B.p);
        const ev = await after(B.p, seq0);
        held = { refusalCode: ref && ref.code, refusalVerb: ref && ref.verb, announcement: text,
          sentenceList: sentences(text), sentences: sentences(text).length, words: text.split(/\s+/).filter(Boolean).length,
          rawId: (text.match(/\b(?:le|cd|ar|sd|pp|ai|al)-\d+\b/g) || []),
          approvalWrites: ev.filter((e) => e.kind === 'write' && e.table === 'approvals').map((e) => e.id), events: evSummary(ev), seqRange: range(ev, seq0) };
      } finally { await B.c.close(); }
      const postBreach = !!post && post.sentences > 1 && post.pluralSlip;
      const heldBreach = !!held && held.refusalCode === 'needs_second' && held.sentences > 1 && held.rawId.length > 0;
      rec('A-screens-checkout-2-4', 'The Checkout aria-live announcements are prose, not one verb line: Post announces two sentences with the ungrammatical "1 ledger rows", and Request approval announces two sentences ending in the raw request id ar-1', 'C8 — announcements are one verb line, not prose',
        postBreach && heldBreach, { postAnnouncement: post, requestApprovalAnnouncement: held, postBreach, heldBreach });
    },

    // RC-153 · B11 · checkout.js:114 wraps the procedures table in .wrap-x; at 420 px the Self-pay column is past the
    // right edge of that box.
    // Measurement: the self-pay toggle's rect against the .wrap-x visible rect at first paint, its size, its gap to
    // the nearest neighbouring control, whether the wrapper is a horizontal scroller (overflow-x from getComputedStyle,
    // rule 1 — never from document.styleSheets, which throws over file://), whether scrolling or focusing the control
    // brings it fully inside, and whether the page body pans sideways.
    // Negative control / what makes this FALSE: B11 asks for 44×44 with 8 px gaps at 420 px and docs/04 allows wide
    // content to scroll inside its own container. So the check scores true only for an UNREACHABLE control: off the
    // wrapper's visible edge AND (too small, or under an 8 px gap, or not brought into view by scrolling/focus, or the
    // body itself pans). A control that is merely off-edge inside a scroller that reaches it is not a B11 breach and
    // the check reports false with the numbers that show why.
    async 'A-screens-checkout-2-5'(b) {
      let phone = null; let desk = null;
      const A = await ctx(b, 420, 900);
      try {
        await go(A.p, '#/frontdesk/checkout/a-1046?device=phone');
        phone = await A.p.evaluate(() => {
          const el = document.querySelector('[data-testid="checkout.line.pr-421.selfpay"]');
          if (!el) return { missing: true };
          const wrap = el.closest('.wrap-x');
          const rect = () => { const r = el.getBoundingClientRect(); const w = wrap.getBoundingClientRect(); return { elX: Math.round(r.x), elRight: Math.round(r.right), wrapX: Math.round(w.x), wrapRight: Math.round(w.right), fullyInside: r.left >= w.left - 0.5 && r.right <= w.right + 0.5 }; };
          const cs = getComputedStyle(el); const wcs = getComputedStyle(wrap);
          const r0 = el.getBoundingClientRect();
          let minGap = null;
          for (const o of wrap.querySelectorAll('button, input, a, [tabindex]')) { if (o === el) continue; const r = o.getBoundingClientRect(); const dx = Math.max(0, Math.max(r.left - r0.right, r0.left - r.right)); const dy = Math.max(0, Math.max(r.top - r0.bottom, r0.top - r.bottom)); const g = Math.round(Math.max(dx, dy)); if (minGap === null || g < minGap) minGap = g; }
          const atFirstPaint = rect();
          // the estimate column is read BEFORE anything is scrolled, or the numbers would describe a scrolled table
          const est = [...document.querySelectorAll('.co-est')].map((e) => { const r = e.getBoundingClientRect(); const w = wrap.getBoundingClientRect(); return { text: e.textContent.trim().slice(0, 26), x: Math.round(r.x), right: Math.round(r.right), clippedBy: Math.max(0, Math.round(r.right - w.right)) }; });
          wrap.scrollLeft = wrap.scrollWidth; const afterWrapScroll = rect();
          wrap.scrollLeft = 0; el.focus(); const afterFocus = Object.assign(rect(), { scrollLeftNow: Math.round(wrap.scrollLeft), didFocus: document.activeElement === el });
          return { atFirstPaint, afterWrapScroll, afterFocus, hidden: el.hidden, display: cs.display,
            size: { w: Math.round(r0.width), h: Math.round(r0.height) }, minGapToNeighbour: minGap,
            wrapper: { overflowX: wcs.overflowX, scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth, scrolls: wcs.overflowX === 'auto' || wcs.overflowX === 'scroll' },
            body: { scrollWidth: document.scrollingElement.scrollWidth, clientWidth: document.scrollingElement.clientWidth, pansSideways: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth },
            estimateColumn: est };
        });
      } finally { await A.c.close(); }
      const B = await ctx(b, 1280, 900); // fresh context (rule 2): same control at desk width, as the shape of "inside"
      try {
        await go(B.p, '#/frontdesk/checkout/a-1046');
        desk = await B.p.evaluate(() => { const el = document.querySelector('[data-testid="checkout.line.pr-421.selfpay"]'); if (!el) return { missing: true }; const w = el.closest('.wrap-x').getBoundingClientRect(); const r = el.getBoundingClientRect(); return { elX: Math.round(r.x), elRight: Math.round(r.right), wrapRight: Math.round(w.right), fullyInside: r.right <= w.right + 0.5, size: { w: Math.round(r.width), h: Math.round(r.height) } }; });
      } finally { await B.c.close(); }
      const offEdge = !!phone && !phone.missing && phone.atFirstPaint.fullyInside === false;
      const tooSmall = !!phone && !phone.missing && (phone.size.w < 44 || phone.size.h < 44);
      const gapTooTight = !!phone && !phone.missing && phone.minGapToNeighbour !== null && phone.minGapToNeighbour < 8;
      const unreachable = !!phone && !phone.missing && !(phone.afterWrapScroll.fullyInside || phone.afterFocus.fullyInside);
      const reproduced = offEdge && (tooSmall || gapTooTight || unreachable || (phone && !phone.missing && phone.body.pansSideways));
      rec('A-screens-checkout-2-5', 'At 420 px the Checkout self-pay toggles and the estimate column sit beyond the visible edge of the procedures table, breaching the 44 px / 8 px reach rule', 'B11 — every control is ≥44×44 with ≥8 px to its neighbours at 1280, 1024, 820 and 420 px; docs/04 allows wide content to scroll inside its own container',
        reproduced, { at420: phone, at1280: desk, offEdgeAtFirstPaint: offEdge, sizePasses: !tooSmall, gapPasses: !gapTooTight, reachableByScrollOrFocus: !unreachable,
          why: reproduced ? 'off-edge and not reachable / undersized / crowded' : 'off the wrapper’s visible edge at first paint, but 111×94 px with a ' + (phone && phone.minGapToNeighbour) + ' px neighbour gap, inside a .wrap-x whose computed overflow-x is ' + (phone && phone.wrapper && phone.wrapper.overflowX) + ' and which brings the control fully inside on scroll or focus, with the page body not panning — the B11 measurements pass' });
    },

    // RC-154 · B6 · checkout.js:18 dollars(c) = (c/100).toFixed(2) prefills checkout.amount (checkout.js:23 fresh()),
    // so a negative patient portion renders with an ASCII hyphen-minus and no currency mark, while Proto.ui.money
    // (ui.js:59) renders the same cents with U+2212. The seed carries no negative estimate, so the repro injects one:
    // a copy of a-1044 as a-tmp with patientCents -4400, exactly as the finding did.
    // The injection is done from #/frontdesk/board and the screen is then reached with location.hash (a same-document
    // hop, rule 2) ON PURPOSE: go() would reload the file and rebuild the store from the seed, discarding the
    // injection. a-tmp is a new id, so checkout.js's per-appointment state map has nothing carried over for it.
    // Negative control: if the prefill went through the same conversion as the rest of the screen, the input would
    // hold money()'s sign (U+2212, code 8722) and the two code-point lists would agree; then the check reports false.
    // The check compares code points, not the rendered glyphs, so a look-alike character cannot pass as a match.
    async 'A-screens-checkout-2-6'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/board');
        const injected = await p.evaluate(() => {
          const S = Proto.store.get();
          const a = S.appointments.find((x) => x.id === 'a-1044');
          if (!a) return { ok: false };
          S.appointments.push(Object.assign({}, a, { id: 'a-tmp' }));
          S.estimates['a-tmp'] = { patientCents: -4400, insuranceCents: 0, writeoffCents: 0, note: 'injected negative estimate' };
          return { ok: !!Proto.store.appt('a-tmp'), patientCents: S.estimates['a-tmp'].patientCents };
        });
        await hop(p, '#/frontdesk/checkout/a-tmp'); await p.waitForTimeout(150);
        const m = await p.evaluate(() => {
          const amt = document.querySelector('[data-testid="checkout.amount"]');
          const v = amt ? amt.value : null;
          const money = Proto.ui.money(-4400);
          return { heading: ((document.querySelector('#canvas h1') || {}).textContent || '').trim(),
            amountInputValue: v, amountCodePoints: v == null ? null : [...v].map((ch) => ch.codePointAt(0)),
            moneyRendering: money, moneyCodePoints: [...money].map((ch) => ch.codePointAt(0)),
            decisionPreselected: [...document.querySelectorAll('[data-testid^="checkout.collect.seg."]')].filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.getAttribute('data-testid')),
            estimateColumnRendering: [...document.querySelectorAll('td.co-est')].map((e) => e.textContent.trim()) };
        });
        const hyphen = m.amountInputValue != null && m.amountCodePoints.includes(45) && !m.amountCodePoints.includes(8722);
        const minus = m.moneyCodePoints.includes(8722);
        rec('A-screens-checkout-2-6', 'checkout.js:18 dollars() prefills checkout.amount with an ASCII hyphen ("-44.00") for a negative patient portion while Proto.ui.money renders the same cents as "−$44.00" (U+2212)', 'B6 — every amount passes through Proto.ui.money; negatives one way',
          hyphen && minus && m.amountInputValue !== m.moneyRendering, Object.assign({ injected }, m, { hyphenMinusInPrefill: hyphen, unicodeMinusInMoney: minus, note: 'boundary case: the seed carries no negative estimate, so the negative portion is injected' }));
      } finally { await c.close(); }
    },

    // RC-155 · C4 · checkout.js:120 renders the empty procedures state as one sentence and nothing else.
    // Measurement: an appointment whose encounter has no procedures (a-1063, verified from the store, not assumed),
    // the visible leaves of the "Completed today" section with closed <details> skipped (rule 3 — the estimate
    // disclosure is closed here, so a naive walker would count its text as the empty state's next step), and the
    // controls inside that section.
    // Negative control: leg B opens a-1044, whose encounter HAS procedures — the same measurement finds the table
    // rows and no empty-state sentence, so the check reports false there. An empty state that named a next step
    // would either carry a control in its section or a second sentence, and this check reports false in both cases.
    async 'A-screens-checkout-2-7'(b) {
      let empty = null; let nonEmpty = null;
      const A = await ctx(b);
      try {
        await go(A.p, '#/frontdesk/checkout/a-1063');
        const store = await A.p.evaluate(() => { const S = window.__proto.state(); const a = S.appointments.find((x) => x.id === 'a-1063'); return a ? { id: a.id, status: a.status, encounterId: a.encounterId, balanceCents: a.balanceCents, procedureCount: S.procedures.filter((x) => x.encounterId === a.encounterId).length } : null; });
        const sec = await A.p.evaluate(() => {
          const s = [...document.querySelectorAll('#canvas section')].find((x) => (x.getAttribute('aria-label') || '') === 'Completed today' || ((x.querySelector('h2') || {}).textContent || '').trim() === 'Completed today');
          if (!s) return null;
          const walkSel = s.getAttribute('aria-label') ? 'section[aria-label="Completed today"]' : null;
          return { selector: walkSel, controls: [...s.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')), hasTable: !!s.querySelector('table') };
        });
        const leaves = await visibleLeaves(A.p, '#canvas section[aria-label="Completed today"]');
        const post = await A.p.evaluate(() => { const e = document.querySelector('[data-testid="checkout.post"]'); const a = document.querySelector('[data-testid="checkout.amount"]'); return { postLabel: e ? e.textContent.trim() : null, postClass: e ? e.className : null, postDisabled: e ? !!e.disabled : null, amountPrefill: a ? a.value : null, decisionPreselected: [...document.querySelectorAll('[data-testid^="checkout.collect.seg."]')].filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.getAttribute('data-testid')) }; });
        const body = leaves ? leaves.leaves.filter((l) => l.tag !== 'H2') : [];
        const sentence = body.map((l) => l.text).join(' ');
        empty = { store, section: sec, visibleLeavesInSection: body, emptyStateSentence: sentence,
          sentenceCount: sentence.split(/(?<=[.!?])\s+/).filter(Boolean).length,
          behindDisclosure: leaves ? leaves.behindDisclosure : null,
          controlsInSection: sec ? sec.controls : null, finishPath: post };
      } finally { await A.c.close(); }
      const B = await ctx(b); // fresh context (rule 2): a-1044's encounter has three completed procedures
      try {
        await go(B.p, '#/frontdesk/checkout/a-1044');
        const leaves = await visibleLeaves(B.p, '#canvas section[aria-label="Completed today"]');
        nonEmpty = { rows: await B.p.evaluate(() => document.querySelectorAll('#canvas table.co-lines tbody tr').length),
          hasEmptySentence: !!(leaves && leaves.leaves.some((l) => /No completed procedures/.test(l.text))) };
      } finally { await B.c.close(); }
      const isEmpty = !!empty && empty.store && empty.store.procedureCount === 0;
      const saysWhy = !!empty && /No completed procedures on this encounter\./.test(empty.emptyStateSentence);
      const offersNextStep = !!empty && ((empty.controlsInSection || []).some((t) => t !== 'checkout.estimate.why') || empty.sentenceCount > 1);
      const reproduced = isEmpty && saysWhy && !offersNextStep && nonEmpty && nonEmpty.hasEmptySentence === false;
      rec('A-screens-checkout-2-7', 'The Checkout empty procedures state says why it is empty ("No completed procedures on this encounter.") but names no next step, while Collect stays pre-selected with the appointment balance prefilled and Post stays live', 'C4 — empty states say why they are empty and what to do next',
        reproduced, { emptyCase: empty, nonEmptyControlCase: nonEmpty, encounterHasNoProcedures: isEmpty, saysWhy, offersNextStep });
    },

    // RC-229 · B4, B3 · checkout.js:219 swaps the toggle's label to "Show staff" when the patient voice is on, while
    // rail.js:223 keeps "Show patient" and changes only aria-pressed and the aria-label.
    // Measurement: the label text with the ✓ press mark stripped (B5 adds that mark to every pressed control, so the
    // raw textContent is "✓Show staff"), aria-pressed and aria-label, before and after the press, on both screens.
    // Two legs in their own contexts (rule 2: rail.js keeps a per-patient `led` state map that a same-document hop
    // would carry, and checkout.js keeps `state[aid]`).
    // Negative control: the check compares the two screens' ON labels to each other, not to a word it expects. If
    // both screens read the same when on — both swapping, or both staying — the labels match and it reports false.
    // It also requires each toggle to have actually turned on (aria-pressed true), so a press that did nothing
    // cannot be scored as agreement or disagreement.
    async 'A-screens-checkout-2-8'(b) {
      const read = (p, tid) => p.evaluate((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); if (!e) return null; const raw = (e.textContent || '').trim(); return { raw, label: raw.replace(/^[✓✔●■]\s*/, '').trim(), pressed: e.getAttribute('aria-pressed'), ariaLabel: e.getAttribute('aria-label'), cls: e.className }; }, tid);
      let co = null; let led = null;
      const A = await ctx(b);
      try {
        await go(A.p, '#/frontdesk/checkout/a-1044');
        await click(A.p, 'checkout.explain');
        const before = await read(A.p, 'checkout.showpatient');
        await click(A.p, 'checkout.showpatient');
        const on = await read(A.p, 'checkout.showpatient');
        co = { screen: 'Checkout #/frontdesk/checkout/a-1044', testid: 'checkout.showpatient', off: before, on };
      } finally { await A.c.close(); }
      const B = await ctx(b);
      try {
        await go(B.p, '#/biller/ledger/p-303');
        const before = await read(B.p, 'ledger.showpatient');
        await click(B.p, 'ledger.showpatient');
        const on = await read(B.p, 'ledger.showpatient');
        led = { screen: 'Ledger #/biller/ledger/p-303', testid: 'ledger.showpatient', off: before, on };
      } finally { await B.c.close(); }
      const bothOn = !!co && !!led && co.on && led.on && co.on.pressed === 'true' && led.on.pressed === 'true';
      const sameOffLabel = !!co && !!led && co.off && led.off && co.off.label === led.off.label;
      const reproduced = bothOn && sameOffLabel && co.on.label !== led.on.label;
      rec('A-screens-checkout-2-8', 'The patient-voice toggle swaps its label to "Show staff" when on at Checkout but stays "Show patient" (aria-pressed, changed aria-label) on the Ledger', 'B4, B3 — one canonical word per concept; the same control carries the same shape on every screen',
        reproduced, { checkout: co, ledger: led, offLabelsAgree: sameOffLabel, onLabels: { checkout: co && co.on && co.on.label, ledger: led && led.on && led.on.label }, bothTogglesTurnedOn: bothOn });
    },
  };
};
