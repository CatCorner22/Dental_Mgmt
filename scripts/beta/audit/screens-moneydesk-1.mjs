// Audit checks for prototype/js/screens/moneydesk.js, chunk screens-moneydesk-1
// (root causes RC-30, RC-33, RC-34, RC-51, RC-101, RC-98, RC-99, RC-100, RC-102, in that order).
// Default position is NOT reproduced: every check measures the breach it claims and carries the values.
// Each check closes its browser context in `finally` so one failure cannot hang the run.
import fs from 'node:fs';

export default ({ ctx, go, hop, press, click, txt, box, state, events, rec }) => {
  const lastSeq = async (p) => { const ev = await events(p); return ev.length ? ev[ev.length - 1].seq : 0; };
  const after = async (p, seq) => (await events(p)).filter((e) => e.seq > seq);
  const writes = (ev) => ev.filter((e) => e.kind === 'write').map((e) => ({ seq: e.seq, table: e.table, id: e.id }));
  const refusalEvents = (ev) => ev.filter((e) => e.kind === 'refusal').map((e) => ({ seq: e.seq, code: e.code, verb: e.verb, control: e.control }));
  const range = (ev, seq0) => [seq0 + 1, ev.length ? ev[ev.length - 1].seq : seq0];
  const fill = async (p, tid, value) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.fill(s, value); await p.waitForTimeout(60); return true; };
  const refusalsDom = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas .refusal')].map((r) => ({
    code: r.dataset.code || null,
    verb: ((r.querySelector('[data-testid="refusal.verb"]') || {}).textContent || '').trim() || null,
    control: ((r.querySelector('[data-testid="refusal.control"]') || {}).textContent || '').trim() || null,
    controls: r.querySelectorAll('[data-testid="refusal.control"]').length,
    why: !!r.querySelector('[data-testid="refusal.why"]'),
  })));
  const focused = (p) => p.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, testid: a && a.getAttribute ? a.getAttribute('data-testid') : null, isBody: a === document.body }; });
  const identity = (p, tid) => p.evaluate((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); return e ? { label: e.textContent.trim(), className: e.className, held: e.classList.contains('held'), irreversible: e.classList.contains('irreversible') } : null; }, tid);
  // Proto.router.announce clears #live and fills it after a 10 ms timeout; read after settling. Money Desk also renders its own sr-only aria-live line.
  const live = (p) => p.evaluate(() => ({ live: ((document.getElementById('live') || {}).textContent || '').trim(), moneyLive: ((document.querySelector('#canvas .sr-only[aria-live]') || {}).textContent || '').trim() }));
  const testids = (p) => p.evaluate(() => [...document.querySelectorAll('#canvas [data-testid]')].map((e) => e.getAttribute('data-testid')));
  const contracts = () => fs.readFileSync(new URL('../../../prototype/CONTRACTS.md', import.meta.url), 'utf8');
  // The Money Desk row of CONTRACTS §4, parsed from the file so the check follows the contract, not a copy of it.
  const s4MoneyDesk = () => {
    const text = contracts();
    const sec = text.slice(text.indexOf('## 4.'), text.indexOf('## 5.'));
    const row = sec.split('\n').find((l) => /^\|\s*Money Desk\s*\|/.test(l)) || '';
    const entries = [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    // A bare placeholder such as <batchId> or <code> admits any seed id or code token (letters, digits, '-', '_'); an enumerated one is exact.
    const patterns = entries.map((e) => new RegExp('^' + e.replace(/\./g, '\\.').replace(/<([^>]+)>/g, (m, inner) => inner.includes('|') ? '(?:' + inner.split('|').join('|') + ')' : '[a-z0-9_-]+') + '$'));
    return { row: row.trim(), entries, patterns };
  };
  // The §6 code list, parsed from the file: every `code` in backticks between "Codes:" and the end of that paragraph.
  const s6Codes = () => {
    const text = contracts();
    const sec = text.slice(text.indexOf('## 6.'), text.indexOf('## 7.'));
    const codesPara = sec.slice(sec.indexOf('Codes:'));
    const codes = [...codesPara.slice(0, codesPara.indexOf('. The list is the contract')).matchAll(/`([a-z_0-9]+)`/g)].map((m) => m[1]);
    return { codes, textSearched: codesPara.slice(0, codesPara.indexOf('\n') > 0 ? codesPara.indexOf('\n') : undefined).trim() };
  };
  const RAW_ID = /\b(c|el|era|enc|ar|ap|le|sd|cr|v|p|a)-\d+\b/g;
  const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
  // Sentences: segments ended by . ! or ? that are followed by more text (a trailing period alone does not make two sentences).
  const sentences = (s) => (s || '').trim().split(/[.!?](?:\s+|$)/).filter((x) => x.trim().length > 0).length;
  const heldWriteoff = async (p) => { await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); };

  return {
    // RC-30 · B2, B10 · moneydesk.js:124 writeoffCard sets st.woRefusal = null whenever the request is pending, discarding the refusal node
    // postWriteoff built at :142 before it is mounted, and rerender(r, 'refusal.control') then finds nothing to focus.
    // Negative control: a compliant screen mounts the needs_second refusal (a .refusal[data-code=needs_second] with refusal.verb, one
    // refusal.control and refusal.why) and leaves focus on refusal.control — as Checkout does for the same store result, measured here as the
    // contrast case; then refusalDom is non-empty or focus is not on body and the check reports false. The check first requires the store to
    // have produced the gate (a needs_second refusal event and an approvals write in the seq range) — a Post that posted outright is a different case.
    async 'A-screens-moneydesk-1-1'(b) {
      const { c, p } = await ctx(b);
      let contrast = null;
      try {
        await go(p, '#/biller/money');
        const seq0 = await lastSeq(p);
        await heldWriteoff(p);
        const ev = await after(p, seq0);
        const refusals = refusalEvents(ev); const w = writes(ev);
        const dom = await refusalsDom(p);
        const f = await focused(p);
        const post = await identity(p, 'money.writeoff.post');
        const card = await p.evaluate(() => ({ text: ((document.querySelector('#canvas section[aria-label="Open balances"], #canvas .card.stack:has([data-testid="money.writeoff.post"])') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240), chips: [...document.querySelectorAll('#canvas .card.stack:has([data-testid="money.writeoff.post"]) .chip')].map((e) => e.textContent.trim()) }));
        const announced = await live(p);
        const gateRaised = refusals.some((r) => r.code === 'needs_second') && w.some((x) => x.table === 'approvals');
        // Contrast: the same store result on Checkout a-1047.
        await go(p, '#/frontdesk/checkout/a-1047');
        await click(p, 'checkout.writeoff.add'); await fill(p, 'checkout.writeoff.amount', '410'); await click(p, 'checkout.writeoff.reason.courtesy'); await click(p, 'checkout.tender.cash'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
        contrast = { refusalDom: (await refusalsDom(p)).filter((d) => d.code === 'needs_second'), focused: await focused(p), post: await identity(p, 'checkout.post') };
        const reproduced = gateRaised && dom.filter((d) => d.code === 'needs_second').length === 0 && f.isBody;
        rec('A-screens-moneydesk-1-1', 'On Money Desk a $410 courtesy write-off raises needs_second (event logged, approvals row written) but no refusal component reaches the DOM — only the Held button and a "Request ar-1 waiting" chip — and focus drops to body', 'B2, B10 / CONTRACTS §6 — every gate renders through Proto.ui.refusal (verb, one control, Why) and focus lands on the next action, never on body; moneydesk.js:124',
          reproduced, { gateRaisedInStore: gateRaised, refusalEvents: refusals, writes: w, refusalDom: dom, refusalVerbExists: dom.some((d) => !!d.verb), refusalControlExists: dom.some((d) => d.controls > 0), refusalWhyExists: dom.some((d) => d.why), activeElement: f, postButton: post, writeoffCard: card, announcement: announced, seqRange: range(ev, seq0), contrastCheckout: contrast });
      } finally { await c.close(); }
    },

    // RC-33 · B2 · moneydesk.js:136 (amount_required), :137 (reason_required), :189 (packet_incomplete) render refusals through Proto.ui.refusal
    // with codes the CONTRACTS §6 list does not carry.
    // Negative control: when every code rendered (data-code on the .refusal and the refusal event's code) is in the §6 list parsed from
    // CONTRACTS.md, codesNotInS6 is empty and the check reports false. A refusal is scored only when it is both on screen and in the event log with
    // the same code. reason_required and amount_required are reached through the UI; packet_incomplete needs a claim with a missing slot, which the
    // seed does not carry (c-88 has both), so it is reached by clearing hasPerioChart on the live store first and is reported as injected.
    async 'A-screens-moneydesk-1-2'(b) {
      const { codes, textSearched } = s6Codes();
      const found = [];
      // reason_required: open the card, Post with the prefilled $410.00 and no reason.
      { const { c, p } = await ctx(b);
        try {
          await go(p, '#/biller/money'); await click(p, 'money.writeoff.p-306');
          const seq0 = await lastSeq(p); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
          const ev = await after(p, seq0);
          found.push({ path: 'money.writeoff.p-306 → money.writeoff.post (no reason)', injected: false, refusalDom: await refusalsDom(p), refusalEvents: refusalEvents(ev), seqRange: range(ev, seq0) });
        } finally { await c.close(); } }
      // amount_required: amount 'abc', reason courtesy, Post.
      { const { c, p } = await ctx(b);
        try {
          await go(p, '#/biller/money'); await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', 'abc'); await click(p, 'money.writeoff.reason.courtesy');
          const seq0 = await lastSeq(p); await click(p, 'money.writeoff.post'); await p.waitForTimeout(150);
          const ev = await after(p, seq0);
          found.push({ path: "money.writeoff.p-306 → money.writeoff.amount 'abc' → money.writeoff.reason.courtesy → money.writeoff.post", injected: false, refusalDom: await refusalsDom(p), refusalEvents: refusalEvents(ev), seqRange: range(ev, seq0) });
        } finally { await c.close(); } }
      // packet_incomplete: c-88 with hasPerioChart cleared on the live store (not reachable from the seed as shipped).
      { const { c, p } = await ctx(b);
        try {
          await go(p, '#/biller/money');
          await p.evaluate(() => { const cl = Proto.store.get().claims.find((x) => x.id === 'c-88'); cl.hasPerioChart = false; });
          await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150);
          const seq0 = await lastSeq(p); await click(p, 'money.appeal.send'); await p.waitForTimeout(150);
          const ev = await after(p, seq0);
          found.push({ path: 'claims c-88 hasPerioChart=false (injected) → money.tab.denials → money.denial.c-88.appeal → money.appeal.send', injected: true, refusalDom: await refusalsDom(p), refusalEvents: refusalEvents(ev), seqRange: range(ev, seq0) });
        } finally { await c.close(); } }
      const rendered = found.flatMap((f) => f.refusalDom.filter((d) => d.code && f.refusalEvents.some((e) => e.code === d.code)).map((d) => ({ code: d.code, verb: d.verb, verbWords: words(d.verb), control: d.control, controls: d.controls, why: d.why, injected: f.injected, inS6: codes.includes(d.code) })));
      const codesNotInS6 = [...new Set(rendered.filter((r) => !r.inS6).map((r) => r.code))];
      const uiReachableNotInS6 = [...new Set(rendered.filter((r) => !r.inS6 && !r.injected).map((r) => r.code))];
      const reproduced = codes.length > 0 && uiReachableNotInS6.length > 0;
      rec('A-screens-moneydesk-1-2', 'Money Desk renders refusals with codes amount_required, reason_required and packet_incomplete, none of which is in the CONTRACTS §6 code list', 'B2 / CONTRACTS §6 — a refusal carries a code from the list; a code the product raises and the list omits is a defect in one of the two; moneydesk.js:136, :137, :189',
        reproduced, { s6Codes: codes, s6TextSearched: textSearched, refusalsRendered: rendered, codesNotInS6, uiReachableNotInS6, injectedOnly: codesNotInS6.filter((x) => !uiReachableNotInS6.includes(x)), paths: found });
    },

    // RC-34 · A2 · moneydesk.js:26 cents() strips every character but digits and '.', so '-50' → 5000 and '1e3' → 1300; blur validation (:117)
    // accepts both, and Post writes or requests an amount the biller did not type.
    // Negative control: a correct Post refuses '-50' and '1e3' (a refusal event, no ledger or approvals write, the blur hint flags the field) or
    // posts exactly what was typed; then for every case writesForCase is empty or a refusal is in the seq range and the check reports false. Each
    // case runs in a fresh context; the field value actually held is read back so a fill that did not take is visible rather than scored.
    async 'A-screens-moneydesk-1-3'(b) {
      const cases = [];
      for (const k of [{ input: '-50', hash: '#/biller/money', expectCents: null }, { input: '1e3', hash: '#/biller/money?afterHours=1', expectCents: null }]) {
        const { c, p } = await ctx(b);
        try {
          await go(p, k.hash);
          await click(p, 'money.writeoff.p-306'); await fill(p, 'money.writeoff.amount', k.input);
          // Blur the field (C7: validation on blur) and read the invalid flag and hint.
          await p.evaluate(() => { const e = document.querySelector('[data-testid="money.writeoff.amount"]'); e.dispatchEvent(new Event('blur')); });
          await p.waitForTimeout(60);
          const field = await p.evaluate(() => { const e = document.querySelector('[data-testid="money.writeoff.amount"]'); return { value: e.value, invalid: e.classList.contains('invalid'), hint: ((e.parentElement.querySelector('.hint') || {}).textContent || '').trim(), parsedCents: Proto.screens.moneydesk.state().writeoffStr }; });
          await click(p, 'money.writeoff.reason.courtesy');
          const seq0 = await lastSeq(p);
          await click(p, 'money.writeoff.post'); await p.waitForTimeout(250);
          const ev = await after(p, seq0);
          const out = await p.evaluate(() => { const S = window.__proto.state(); return { afterHours: S.clock.afterHours, ledgerWriteoffsToday: S.ledger.filter((e) => e.kind === 'write_off' && e.patientId === 'p-306' && e.posted === S.tenant.today).map((e) => ({ id: e.id, amountCents: e.amountCents, reason: e.reason })), approvals: S.approvals.map((a) => ({ id: a.id, amountCents: a.amountCents, reason: a.reason, status: a.status })), balances: Proto.store.balances('p-306') }; });
          const announced = await live(p);
          cases.push({ input: k.input, start: k.hash, fieldAfterBlur: field, writesForCase: writes(ev), refusalEvents: refusalEvents(ev), storeAfterPost: out, announcement: announced, seqRange: range(ev, seq0) });
        } finally { await c.close(); }
      }
      const neg = cases.find((k) => k.input === '-50');
      const exp = cases.find((k) => k.input === '1e3');
      const negPosted = !!neg && neg.fieldAfterBlur.value === '-50' && neg.refusalEvents.length === 0 && neg.storeAfterPost.ledgerWriteoffsToday.some((r) => r.amountCents === -5000);
      const expRequested = !!exp && exp.fieldAfterBlur.value === '1e3' && exp.storeAfterPost.approvals.some((a) => a.amountCents === 1300) || (!!exp && exp.storeAfterPost.ledgerWriteoffsToday.some((r) => r.amountCents === -1300));
      const reproduced = negPosted;
      rec('A-screens-moneydesk-1-3', "Typing '-50' in the Money Desk write-off amount passes blur validation and Post writes a $50.00 write-off (ledger -5000) with no refusal; '1e3' becomes $13.00", 'A2 — Post writes the amount the biller typed or refuses; validation on blur flags what cannot post as typed; moneydesk.js:26 cents(), :117',
        reproduced, { cases, negativeSignDropped: negPosted, exponentMangledTo1300: expRequested });
    },

    // RC-51 · B1 · moneydesk.js:82 (money.era.<batchId>.why), :103 (money.era.line.<lineId>.why), :175 (money.denial.<claimId>.why),
    // :184 (money.appeal.close), :229 (money.variance.<id>.open) render interactive elements whose ids are not in the Money Desk row of §4.
    // Negative control: when every rendered money.* id matches a §4 entry or pattern, notInContract is empty and the check reports false. The §4
    // row is parsed from CONTRACTS.md at run time (entries and derived patterns are in the evidence) and ids are collected from reachable states by
    // driving the screen — every tab, the appeal drawer, the ERA read-back — not from the source.
    async 'A-screens-moneydesk-1-4'(b) {
      const { c, p } = await ctx(b);
      try {
        const seen = new Map();
        const collect = async (label) => { for (const id of await testids(p)) if (id.startsWith('money.') && !seen.has(id)) seen.set(id, label); };
        await go(p, '#/biller/money'); await collect('landing (ERA, review)');
        for (const t of ['aging', 'denials', 'statements', 'credits', 'variances', 'approvals']) { await click(p, 'money.tab.' + t); await collect('money.tab.' + t); }
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150); await collect('after money.denial.c-88.appeal');
        await click(p, 'money.tab.era'); await click(p, 'money.writeoff.p-306'); await collect('after money.writeoff.p-306');
        await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(200); await collect('after money.era.era-1.postmatched');
        const { row, entries, patterns } = s4MoneyDesk();
        const ids = [...seen.keys()].sort();
        const notInContract = ids.filter((id) => !patterns.some((re) => re.test(id))).map((id) => ({ id, firstSeenIn: seen.get(id) }));
        // Tag and interactivity of each offending id, read where it is currently rendered (the final screen shows the ERA read-back).
        const tags = await p.evaluate((ids) => ids.map((id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e ? { id, tag: e.tagName.toLowerCase(), text: e.textContent.trim().slice(0, 40) } : { id, tag: 'not-on-final-screen' }; }), notInContract.map((x) => x.id));
        const reproduced = entries.length > 0 && notInContract.length > 0;
        rec('A-screens-moneydesk-1-4', 'Money Desk renders interactive elements whose test ids (money.appeal.close, money.variance.<id>.open, money.era.<batchId>.why, money.era.line.<lineId>.why, money.denial.<claimId>.why) are not in the Money Desk row of CONTRACTS §4', 'B1 — every id in the DOM matches a §4 entry or pattern; moneydesk.js:82, :103, :175, :184, :229',
          reproduced, { s4RowSearched: row, s4Entries: entries, s4Patterns: patterns.map(String), idsRendered: ids, notInContract, notInContractTags: tags, distinctOffendingShapes: [...new Set(notInContract.map((x) => x.id.replace(/\.(el|c|era|v)-\d+\./, '.<id>.')))] });
      } finally { await c.close(); }
    },

    // RC-101 · B4 · moneydesk.js:234 approvalsTab renders STATUS[a.status] ("Sent back") beside ' · ' + a.status + ' by ' (raw "declined"), and
    // writeoffCard (:113-122) has no branch for status declined, so the card falls through to a plain irreversible Post with no sent-back line.
    // Negative control: one word for the decision on the row (chip and sentence both "Sent back", or both "declined") and a card that names the
    // sent-back state; then rowTwoWords is false or cardShowsSentBack is true and the check reports false. The decline must have landed
    // (approvals[0].status 'declined', an approvalsLog write in the seq range) before the row or the card is scored.
    async 'A-screens-moneydesk-1-5'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        await heldWriteoff(p);
        const req = await p.evaluate(() => { const a = window.__proto.state().approvals[0]; return a ? { id: a.id, status: a.status, amountCents: a.amountCents } : null; });
        await hop(p, '#/owner/close'); await hop(p, '#/phone/approvals'); await p.waitForTimeout(150);
        const seq0 = await lastSeq(p);
        let phone = null;
        if (req) {
          await click(p, 'phone.request.' + req.id + '.decline'); await p.waitForTimeout(100);
          await fill(p, 'phone.request.' + req.id + '.reason', 'appeal first');
          await click(p, 'phone.request.' + req.id + '.decline'); await p.waitForTimeout(200);
          phone = await p.evaluate(() => ({ decidedChip: ((document.querySelector('.ph-decided .chip') || {}).textContent || '').trim(), doneText: ((document.querySelector('.ph-done') || {}).textContent || '').trim(), live: ((document.getElementById('live') || {}).textContent || '').trim() }));
        }
        const ev = await after(p, seq0);
        const decided = await p.evaluate(() => { const a = window.__proto.state().approvals[0] || {}; return { status: a.status, decidedBy: a.decidedBy, reasonStored: Object.keys(a).filter((k) => /reason|note|line|sentBack/i.test(k)).map((k) => k + '=' + JSON.stringify(a[k])) }; });
        await hop(p, '#/biller/money'); await p.waitForTimeout(200);
        await click(p, 'money.tab.approvals'); await p.waitForTimeout(150);
        const row = await p.evaluate(() => { const r = document.querySelector('#canvas .worklist .wrow'); if (!r) return null; return { chip: ((r.querySelector('.chip') || {}).textContent || '').trim(), why: ((r.querySelector('.why') || {}).textContent || '').trim(), full: r.textContent.replace(/\s+/g, ' ').trim() }; });
        const card = await p.evaluate(() => { const cd = document.querySelector('#canvas .card.stack:has([data-testid="money.writeoff.post"]), #canvas .card.stack:has([data-testid="money.writeoff.p-306"])'); const post = document.querySelector('[data-testid="money.writeoff.post"]'); return { text: cd ? cd.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : null, chips: cd ? [...cd.querySelectorAll('.chip')].map((e) => e.textContent.trim()) : [], post: post ? { label: post.textContent.trim(), className: post.className } : null }; });
        const declineLanded = decided.status === 'declined' && ev.some((e) => e.kind === 'write' && e.table === 'approvalsLog');
        const rowTwoWords = !!row && /sent back/i.test(row.chip) && /declined by/i.test(row.why);
        const cardShowsSentBack = !!card.text && /sent back|declined/i.test(card.text);
        const reproduced = declineLanded && rowTwoWords && !cardShowsSentBack;
        rec('A-screens-moneydesk-1-5', 'After the owner sends the $410 write-off back, the Money Desk Approvals row reads chip "Sent back" beside "· declined by Dr. Blake Reagan", and the write-off card shows a plain Post with no sent-back state or reason', 'B4 — one canonical word per concept across screens, rows and chips; the card shows the state the phone promised; moneydesk.js:234, :113-122',
          reproduced, { request: req, phoneAfterDecline: phone, approvalAfterDecline: decided, declineLanded, approvalsRow: row, rowTwoWords, writeoffCard: card, cardShowsSentBack, writes: writes(ev), seqRange: range(ev, seq0) });
      } finally { await c.close(); }
    },

    // RC-98 · C3 · moneydesk.js:125 card.append(…, st.woRefusal, postRow, held ? … : null) hands null to Element.append, which stringifies it to
    // the text "null" (h() skips null children; Element.append does not).
    // Negative control: a card that appends only nodes has no text node whose nodeValue is "null"; then nullNodes is empty in every state and the
    // check reports false. Text nodes are found by walking the card, and each is measured with a Range so a zero-size or hidden node is visible in
    // the evidence and not counted as rendered.
    async 'A-screens-moneydesk-1-6'(b) {
      const { c, p } = await ctx(b);
      try {
        const nullNodes = () => p.evaluate(() => {
          const card = document.querySelector('#canvas .card.stack:has([data-testid="money.writeoff.post"])'); if (!card) return { cardFound: false, nodes: [] };
          const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT); const out = [];
          let n; while ((n = walker.nextNode())) { if (n.nodeValue.trim() === 'null') { const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); out.push({ nodeValue: n.nodeValue, parent: n.parentElement.tagName + '.' + n.parentElement.className, prevSibling: n.previousSibling ? (n.previousSibling.className || n.previousSibling.nodeName) : null, nextSibling: n.nextSibling ? (n.nextSibling.className || n.nextSibling.nodeName) : null, box: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }, rendered: b.width > 0 && b.height > 0 }); } }
          return { cardFound: true, nodes: out, cardText: card.textContent.replace(/\s+/g, ' ').trim().slice(-120) };
        });
        await go(p, '#/biller/money');
        await click(p, 'money.writeoff.p-306'); await p.waitForTimeout(120);
        const open = await nullNodes();
        await click(p, 'money.writeoff.post'); await p.waitForTimeout(150); // reason_required refusal on screen
        const withRefusal = await nullNodes();
        await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(200); // held
        const held = await nullNodes();
        const renderedCount = (s) => s.nodes.filter((n) => n.rendered).length;
        const reproduced = open.cardFound && renderedCount(open) > 0;
        rec('A-screens-moneydesk-1-6', 'The Open balances write-off card renders the word "null" as visible text (two nodes with the form open, one under a refusal, one when held)', 'C3 — no product-internal tokens on screen; moneydesk.js:125 passes null to Element.append',
          reproduced, { formOpen: open, underReasonRequired: withRefusal, held, renderedNullNodes: { formOpen: renderedCount(open), underRefusal: renderedCount(withRefusal), held: renderedCount(held) } });
      } finally { await c.close(); }
    },

    // RC-99 · C8 · moneydesk.js:64 (Post matched), :154 (Appeal), :224 (Apply credit), :204 (Aging action) hand multi-sentence prose and raw ids
    // to Proto.router.announce.
    // Negative control: each announcement is one verb line — one sentence, no storage id (c-88, enc-9010, el-14); then every entry has
    // sentences <= 1 and rawIds empty and the check reports false. #live is read after the 10 ms announce delay and paired with the screen's own
    // aria-live line, so a cleared-but-not-yet-filled region is visible in the evidence rather than scored either way.
    async 'A-screens-moneydesk-1-7'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const out = [];
        const take = async (label) => { await p.waitForTimeout(120); const t = await live(p); const text = t.live || t.moneyLive; out.push({ after: label, live: t.live, moneyLive: t.moneyLive, words: words(text), sentences: sentences(text), rawIds: [...new Set((text.match(RAW_ID) || []))] }); };
        await click(p, 'money.era.era-1.postmatched'); await take('money.era.era-1.postmatched');
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await take('money.denial.c-88.appeal');
        await click(p, 'money.tab.credits'); await click(p, 'money.credit.cr-1.apply'); await take('money.credit.cr-1.apply');
        await click(p, 'money.tab.aging');
        const agingIds = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="money.aging.row."]')].map((e) => e.getAttribute('data-testid')));
        const call = agingIds.find((x) => x.endsWith('.call')) || agingIds[0];
        if (call) { await click(p, call); await take(call); }
        const breaches = out.filter((o) => (o.live || o.moneyLive) && (o.sentences > 1 || o.rawIds.length > 0));
        const reproduced = breaches.length > 0;
        rec('A-screens-moneydesk-1-7', 'Money Desk announcements are two-sentence prose of 13-18 words and carry raw ids (c-88, enc-9010) instead of one verb line', 'C8 — announcements (aria-live) are one verb line, not prose; C3 — no raw ids; moneydesk.js:64, :154, :204, :224',
          reproduced, { announcements: out, breaches: breaches.map((o) => ({ after: o.after, text: o.live || o.moneyLive, words: o.words, sentences: o.sentences, rawIds: o.rawIds })) });
      } finally { await c.close(); }
    },

    // RC-100 · C5 · moneydesk.js:49 counts() uses statementsDue.length (sent rows stay, :45) and denied+appealed claims (:43) but only open deltas
    // for ERA, so a finished Statements tab still reads 2 and a finished Denials tab 1 while a finished ERA reads 0.
    // Negative control: one meaning for every badge — every finished tab reads 0 (or every one counts its rows) — then eraFinishedZero,
    // statementsFinishedNonZero and denialsFinishedNonZero cannot all hold together and the check reports false. Each tab must actually be finished
    // (no Send control left and both rows marked sent; c-88 status appealed with the Sent line; ERA batch complete with no delta left) before its badge is scored.
    async 'A-screens-moneydesk-1-8'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const badges = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid^="money.tab."]')].map((e) => [e.getAttribute('data-testid').replace('money.tab.', ''), Number(((e.querySelector('.count') || {}).textContent || '').trim())])));
        const before = await badges();
        // Statements: send both.
        await click(p, 'money.tab.statements'); await click(p, 'money.statement.sd-1.send'); await p.waitForTimeout(120); await click(p, 'money.statement.sd-2.send'); await p.waitForTimeout(150);
        const statements = await p.evaluate(() => { const wl = document.querySelector('#canvas .worklist'); return { sendControlsLeft: document.querySelectorAll('[data-testid^="money.statement."][data-testid$=".send"]').length, rows: [...document.querySelectorAll('#canvas .worklist .md-row')].map((r) => ((r.querySelector('.chip.clear') || {}).textContent || '').trim()), heading: wl && wl.parentElement ? ((wl.parentElement.querySelector('h2') || {}).textContent || '').trim() : null, storeSent: window.__proto.state().statementsDue.map((s) => ({ id: s.id, sent: !!s.sent })) }; });
        const afterStatements = await badges();
        // Denials: appeal c-88 and send.
        await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(150); await click(p, 'money.appeal.send'); await p.waitForTimeout(200);
        const denials = await p.evaluate(() => ({ claimStatus: (window.__proto.state().claims.find((x) => x.id === 'c-88') || {}).status, sentLine: !!document.querySelector('#canvas .md-drawer .chip.clear'), sendControlsLeft: document.querySelectorAll('[data-testid="money.appeal.send"]').length, rows: document.querySelectorAll('#canvas .worklist .md-row').length }));
        const afterDenials = await badges();
        // ERA: Post matched, then confirm / confirm / hold the three deltas.
        await click(p, 'money.tab.era'); await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(150);
        await click(p, 'money.era.line.el-14.confirm'); await click(p, 'money.era.line.el-22.confirm'); await click(p, 'money.era.line.el-31.hold'); await p.waitForTimeout(250);
        await click(p, 'money.tab.era'); await p.waitForTimeout(120);
        const era = await p.evaluate(() => { const S = window.__proto.state(); return { batchStatus: S.eraBatches[0].status, deltasLeft: S.eraLines.filter((l) => l.batchId === 'era-1' && l.status === 'delta').length, completeChip: !!document.querySelector('#canvas .md-complete .chip.clear'), heldLines: S.eraLines.filter((l) => l.status === 'held').length }; });
        const afterEra = await badges();
        const statementsFinished = statements.sendControlsLeft === 0 && statements.storeSent.every((s) => s.sent);
        const denialsFinished = denials.claimStatus === 'appealed' && denials.sendControlsLeft === 0;
        const eraFinished = era.deltasLeft === 0 && era.batchStatus !== 'review' && era.completeChip;
        const reproduced = statementsFinished && denialsFinished && eraFinished && afterEra.statements > 0 && afterEra.denials > 0 && afterEra.era === 0;
        rec('A-screens-moneydesk-1-8', 'With every row finished, the Statements badge still reads 2 and the Denials badge 1 (finished rows counted) while the ERA badge reads 0 (open work counted): one badge, two meanings', 'C5 — the same fact has one canonical value everywhere; a worklist count means the same thing on every tab; moneydesk.js:49',
          reproduced, { badgesBefore: before, statements, badgesAfterStatements: afterStatements, denials, badgesAfterDenials: afterDenials, era, badgesAfterAll: afterEra, statementsFinished, denialsFinished, eraFinished });
      } finally { await c.close(); }
    },

    // RC-102 · B3 · moneydesk.js:243 (P) calls postMatched and :245 (A) calls openAppeal → Proto.store.buildAppeal from a bare, unmodified letter with
    // focus on any non-input element; Post matched is rendered kind 'irreversible' (:81) and the palette says it "opens its gate; nothing runs".
    // Negative control: a compliant screen leaves the batch in 'review' after P (a gate or confirmation renders, or nothing happens) and writes no
    // appealPackets row after A; then batchAfterP === 'review' and appealWritesAfterA is empty and the check reports false. The key events in the
    // seq range must be the only input (no click event) so the change is attributable to the keystroke, and the Post matched control's identity
    // is read before the press so the check scores an irreversible-identity verb, not a quiet one.
    async 'A-screens-moneydesk-1-9'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/biller/money');
        const postIdentity = await identity(p, 'money.era.era-1.postmatched');
        await p.focus('[data-testid="money.tab.era"]');
        const focusBefore = await focused(p);
        const batchBefore = await p.evaluate(() => window.__proto.state().eraBatches[0].status);
        const seq0 = await lastSeq(p);
        await p.keyboard.press('p'); await p.waitForTimeout(200);
        const evP = await after(p, seq0);
        const afterP = await p.evaluate(() => ({ batch: window.__proto.state().eraBatches[0].status, readbackOnScreen: document.querySelectorAll('[data-testid^="money.era.line."][data-testid$=".confirm"]').length, postControlStillThere: !!document.querySelector('[data-testid="money.era.era-1.postmatched"]') }));
        const refusalAfterP = await refusalsDom(p);
        const focusAfterP = await focused(p);
        // A: with focus on a non-input, press a.
        await p.focus('[data-testid="money.tab.era"]');
        const seq1 = await lastSeq(p);
        await p.keyboard.press('a'); await p.waitForTimeout(200);
        const evA = await after(p, seq1);
        const afterA = await p.evaluate(() => ({ appealPackets: (window.__proto.state().appealPackets || []).map((x) => ({ id: x.id, claimId: x.claimId })), drawerOpen: !!document.querySelector('[data-testid="money.appeal.send"]'), tabSelected: [...document.querySelectorAll('[data-testid^="money.tab."][aria-selected="true"]')].map((e) => e.getAttribute('data-testid')) }));
        const focusAfterA = await focused(p);
        const noClickP = !evP.some((e) => e.kind === 'click'); const noClickA = !evA.some((e) => e.kind === 'click');
        const pExecuted = batchBefore === 'review' && afterP.batch !== 'review' && noClickP && refusalAfterP.length === 0;
        const appealWritesAfterA = writes(evA).filter((w) => w.table === 'appealPackets');
        const aWrote = appealWritesAfterA.length > 0 && noClickA;
        const reproduced = !!postIdentity && postIdentity.irreversible && pExecuted && aWrote;
        rec('A-screens-moneydesk-1-9', 'With focus on a tab, a bare P moves the ERA batch from review to read-back (the irreversible Post matched) and a bare A writes an appealPackets row, with no gate, confirmation or click between the keystroke and the write', 'B3 — an irreversible verb never executes from a keyboard accelerator without its gate; moneydesk.js:243, :245, :81',
          reproduced, { postMatchedIdentityBefore: postIdentity, focusBeforeP: focusBefore, batchBefore, keyEventsP: evP.filter((e) => e.kind === 'key').map((e) => ({ seq: e.seq, key: e.key, testid: e.testid })), clickEventsP: evP.filter((e) => e.kind === 'click').length, refusalAfterP, afterP, focusAfterP, seqRangeP: range(evP, seq0), keyEventsA: evA.filter((e) => e.kind === 'key').map((e) => ({ seq: e.seq, key: e.key, testid: e.testid })), clickEventsA: evA.filter((e) => e.kind === 'click').length, appealWritesAfterA, afterA, focusAfterA, seqRangeA: range(evA, seq1) });
      } finally { await c.close(); }
    },
  };
};
