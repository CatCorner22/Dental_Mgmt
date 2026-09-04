/* Daily Close and Controls (owner home; route close) and Practice risk (compliance home; route risk).
   Features 18 (independence-graded Tied tile), 19 (variance sentence with proposed match), 20 (sealed
   closed day: changed-after-close pairs and postings into closed days), 21 (decision review with measured
   effect), 25 (hours scope line). Flow 5: close.closeday (1) → close.closeday.confirm (2).
   Copy describes hands, never the person; every count is practice-level. Keys while mounted: T toggles the tile. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, money, section, pageHead, displayName, shortDate, longDate } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TENDERS = [['cash', 'Cash'], ['check', 'Check'], ['card', 'Card']];
  // grade -> [css class, glyph, word, chip severity]
  const GRADE = { tied: ['tied', '●', 'Tied · independent', 'clear'], second: ['second', '◐', 'Tied · needs a second look', 'review'], variance: ['variance', '▲', 'variances', 'required'] };
  const REASON = { posted_to_wrong_account: 'posted to wrong account', duplicate: 'duplicate posting', wrong_amount: 'wrong amount', wrong_tender: 'wrong tender' };
  const KIND = { patient_payment: 'payment', insurance_payment: 'insurance payment', charge: 'charge', write_off: 'write-off', adjustment: 'adjustment', refund: 'refund', reversal: 'reversal' };
  const WROTE = { ledger: 'appended a ledger row', approvals: 'created an approval request', approvalsLog: 'decided an approval request', dayCloses: 'closed a business day', deposits: 'prepared a deposit slip', reconciliationMatches: 'matched or cleared a variance', controlDecisions: 'reviewed a control decision', appointmentEvents: 'moved an appointment', eligibilityChecks: 're-ran eligibility', messages: 'pinged a chair', perioExams: 'saved a perio exam', tags: 'tagged a tooth for the dentist', chartEvents: 'painted the chart', planItems: 'added a plan item', filedNotes: 'filed a note', claims: 'changed a claim', claimEvents: 'recorded a claim event', appealPackets: 'built an appeal packet', disclosures: 'disclosed records (logged)', statementsDue: 'queued a statement', collectionDecisions: 'recorded a collection decision', allocations: 'allocated a payment', dayPasses: 'issued a day pass', userEntitlements: 'changed entitlements', firstRunState: 'retired a first-shift chip', sessions: 'switched author with a PIN' };

  let st = null, lastStore = null, lastRoute = null, keysOn = false;
  const fresh = () => ({ tileOpen: false, locOpen: null, invOpen: {}, changedOpen: false, lateOpen: false, varRefusal: {}, closeStep: 'idle', closeRefusal: null, dayClose: null, decisionResult: {}, riskDone: {}, logOpen: false });
  const priv = () => !!(window.__proto && window.__proto.privacy);
  const bool = (b) => (b ? 'true' : 'false');
  const say = (t) => Proto.router.announce(t);
  const pname = (S, pid) => { const p = S.patients.find((x) => x.id === pid); return displayName(p ? p.name : pid, priv()); };
  const shortName = (S, name) => { const u = S.users.find((x) => x.name === name); return u ? u.short : name; };
  const locOf = (S, id) => S.locations.find((l) => l.id === id) || { name: id, short: id };
  const days = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  function rerender(r, focusTestid) {
    r = r || lastRoute || Proto.router.current();
    Proto.router.render();
    Proto.screens.shell.refreshAndon(r);
    if (focusTestid) { const el = document.querySelector('[data-testid="' + focusTestid + '"]'); if (el && el.focus) el.focus(); }
  }

  /* ---- computed views (read-only over store.get()) ---- */
  function grade(rr) {
    if (rr.state === 'variance') return 'variance';
    if (rr.state === 'second_look' || !rr.independent || rr.closerPosted || (rr.source === 'statement' && rr.lagDays * 24 > 48)) return 'second';
    return 'tied';
  }
  const openVariances = (S, locId) => S.variances.filter((v) => v.status === 'open' && (!locId || v.locationId === locId));
  function overall(S) {
    const grades = S.reconciliation.map(grade);
    if (grades.includes('variance')) { const n = Math.max(openVariances(S).length, grades.filter((g) => g === 'variance').length); return { grade: 'variance', word: plural(n, 'variance'), n }; }
    if (grades.includes('second')) return { grade: 'second', word: GRADE.second[2] };
    return { grade: 'tied', word: GRADE.tied[2] };
  }
  function changedPairs(S) {
    const rows = S.ledger.filter((e) => e.correctsEntryId && e.posted === S.tenant.today && e.actorKind === 'user');
    const groups = {};
    rows.forEach((e) => { (groups[e.correctsEntryId] = groups[e.correctsEntryId] || []).push(e); });
    return Object.keys(groups).map((origId) => ({ orig: S.ledger.find((e) => e.id === origId), rev: groups[origId].find((e) => e.kind === 'reversal'), repost: groups[origId].find((e) => e.kind !== 'reversal') }));
  }
  const lateRows = (S) => S.ledger.filter((e) => e.postedAfterClose && e.actorKind !== 'worker');
  function pairSentence(S, p) {
    const o = p.orig || {}; const rev = p.rev || p.repost; const rp = p.repost || p.rev;
    const what = (o.tender ? o.tender + ' ' : '') + (KIND[o.kind] || 'entry');
    return shortName(S, rev.actor) + ' reversed ' + what + ' #' + (o.id || rev.correctsEntryId) + ' from ' + shortDate(o.effective || rev.effective) + ' and reposted it to ' + pname(S, rp.patientId) + ' on ' + shortDate(rp.posted) + ', reason: ' + (REASON[rev.reason] || rev.reason || 'not given');
  }
  function lateSentence(S, e) {
    const what = money(Math.abs(e.amountCents)) + ' ' + (KIND[e.kind] || e.kind);
    if (e.actorKind === 'file_event') return shortName(S, e.actor) + '’s File on ' + shortDate(e.posted) + ' released a ' + what + ' dated ' + shortDate(e.effective);
    return shortName(S, e.actor) + ' posted a ' + what + ' on ' + shortDate(e.posted) + ' into closed day ' + shortDate(e.effective) + (e.reason ? ', reason: ' + (REASON[e.reason] || e.reason) : '');
  }
  function todayTotals(S, locId) {
    const tot = { cash: 0, check: 0, card: 0 };
    S.ledger.filter((e) => e.locationId === locId && e.posted === S.tenant.today && e.kind === 'patient_payment').forEach((e) => { tot[e.tender || 'card'] += -e.amountCents; });
    return tot;
  }
  function sodView(S) {
    const findings = [], exceptions = [];
    S.currentGrants.forEach((g) => {
      const ents = new Set(g.entitlements);
      S.sodRules.filter((rule) => rule.pair.every((e) => ents.has(e))).forEach((rule) => {
        if (g.accepted && g.accepted.ruleId === rule.id) exceptions.push({ rule, reviewBy: g.accepted.reviewBy, decisionId: g.accepted.decisionId });
        else findings.push({ rule });
      });
    });
    return { findings, exceptions };
  }

  /* ---- Tied tile ---- */
  function tile(r, S) {
    const o = overall(S); const g = GRADE[o.grade];
    const lag = Math.max(...S.reconciliation.map((x) => x.lagDays));
    const sub = 'Yesterday ' + shortDate(S.tenant.yesterday) + ' · ' + S.locations.length + ' locations · detection lag ' + plural(lag, 'day') + ' · ' + (S.reconciliation.some((x) => x.source === 'feed') ? 'bank feed' : 'statement import');
    return h('button', { type: 'button', class: 'tile dc-tile ' + g[0], testid: 'close.tied.tile', 'aria-expanded': bool(st.tileOpen), 'aria-controls': 'dc-tile-detail', onClick: () => toggleTile(r) },
      h('span', { class: 'glyph', 'aria-hidden': 'true', text: g[1] }),
      h('span', { class: 'tilebody' }, h('span', { class: 'word', text: o.word }), h('span', { class: 'sub', text: sub })),
      h('span', { class: 'caret', 'aria-hidden': 'true', text: st.tileOpen ? '▴' : '▾' }));
  }
  function toggleTile(r) {
    const S = Proto.store.get();
    st.tileOpen = !st.tileOpen;
    if (st.tileOpen && !st.locOpen) {
      // open the location that needs hands first: variance, then second look, then the first
      const order = { variance: 0, second: 1, tied: 2 };
      st.locOpen = S.reconciliation.slice().sort((a, b) => order[grade(a)] - order[grade(b)])[0].locationId;
    }
    rerender(r, 'close.tied.tile');
  }
  function locationRow(r, S, rr) {
    const g = grade(rr); const G = GRADE[g]; const loc = locOf(S, rr.locationId);
    const n = openVariances(S, rr.locationId).length;
    const word = g === 'variance' ? plural(Math.max(n, 1), 'variance') : G[2];
    const open = st.locOpen === rr.locationId;
    const row = h('button', { type: 'button', class: 'dc-loc ' + G[0], testid: 'close.location.' + rr.locationId, 'aria-expanded': bool(open), 'aria-controls': 'dc-loc-' + rr.locationId, onClick: () => { st.locOpen = open ? null : rr.locationId; rerender(r, 'close.location.' + rr.locationId); } },
      h('span', { class: 'glyph', 'aria-hidden': 'true', text: G[1] }), h('span', { class: 'name', text: loc.name }), chip(G[3], word),
      h('span', { class: 'small muted grow', text: (rr.source === 'feed' ? 'Bank feed' : 'Statement import') + ' · lag ' + plural(rr.lagDays, 'day') + ' · closed ' + shortDate(rr.date) }));
    return [row, open ? locationDetail(r, S, rr, g) : null];
  }
  function locationDetail(r, S, rr, g) {
    const rows = TENDERS.map(([t, label]) => {
      const exp = rr.expected[t] || 0, bank = rr.bank[t] || 0, gap = bank - exp;
      return h('div', { class: 'tender', testid: 'close.tender.' + t, role: 'row' }, h('span', { text: label }), h('span', { class: 'num', text: money(exp) }), h('span', { class: 'num', text: money(bank) }), gap === 0 ? chip('clear', 'tied') : chip('required', 'gap ' + money(gap)));
    });
    const detail = h('div', { class: 'dc-detail', id: 'dc-loc-' + rr.locationId, role: 'table', 'aria-label': locOf(S, rr.locationId).name + ' tenders' },
      h('div', { class: 'tender head', role: 'row' }, h('span', { text: 'Tender' }), h('span', { class: 'num', text: 'Expected' }), h('span', { class: 'num', text: 'Bank' }), h('span', { text: 'Gap' })), ...rows);
    if (rr.eft) detail.append(h('p', { class: 'small', text: rr.eft.payer + ' EFT ' + money(rr.eft.amountCents) + (rr.eft.matched ? ' matched by ' + rr.eft.trn : ' not yet matched') }));
    if (g === 'second') detail.append(h('p', { class: 'small muted', text: 'Tied to the bank, but the same hands posted and closed that day. A second look here means a different pair of hands confirms the deposit; nothing is owed.' }));
    if (g === 'tied') detail.append(h('p', { class: 'small muted', text: 'Every deposit line matched a bank row from the feed; whoever closed did not post or prepare the deposit that day.' }));
    openVariances(S, rr.locationId).forEach((v) => detail.append(varianceCard(r, S, rr, v)));
    return detail;
  }
  function varianceCard(r, S, rr, v) {
    const me = Proto.store.currentUser(); const isCloser = rr.closer === me.name;
    const pm = v.proposedMatch || {};
    const card = h('div', { class: 'card flat stack', 'aria-label': 'Variance ' + v.id },
      h('div', { class: 'row' }, chip('required', 'Variance ' + money(v.amountCents)), h('span', { class: 'small muted', text: v.tender + ' · ' + locOf(S, v.locationId).name + ' · ' + shortDate(rr.date) })),
      h('p', { class: 'explain sentence', text: v.sentence }),
      h('p', null, h('b', { text: 'Proposed match: ' }), pm.bankLine + ' ↔ ' + plural(pm.ledgerEntries || 0, 'ledger entry').replace('entrys', 'entries')));
    const controls = h('div', { class: 'btnrow' },
      btn('Match these', { kind: 'irreversible', testid: 'close.variance.' + v.id + '.match', onClick: () => { const res = Proto.store.matchVariance(v.id); if (res.ok) say('Matched: ' + money(v.amountCents) + ' card settlement timing. Hillsboro now ties.'); rerender(r, 'close.tied.tile'); } }),
      btn(st.invOpen[v.id] ? 'Hide rows' : 'Investigate', { kind: 'reversible', testid: 'close.variance.' + v.id + '.investigate', pressed: !!st.invOpen[v.id], onClick: () => { st.invOpen[v.id] = !st.invOpen[v.id]; rerender(r, 'close.variance.' + v.id + '.investigate'); } }));
    if (!isCloser) controls.append(btn('Clear with reason', { kind: st.varRefusal[v.id] ? 'held' : 'quiet', testid: 'close.variance.' + v.id + '.clear', onClick: () => {
      const res = Proto.store.clearVariance(v.id);
      if (res.ok) { say('Cleared with reason; counted practice-wide in the digest.'); rerender(r, 'close.tied.tile'); return; }
      st.varRefusal[v.id] = refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why, onControl: null });
      rerender(r, 'close.variance.' + v.id + '.clear');
    } }));
    card.append(controls);
    if (isCloser) card.append(h('p', { class: 'small muted', text: 'Same hands closed ' + locOf(S, rr.locationId).name + ' on ' + shortDate(rr.date) + '; ' + (me.id === 'u-dr-1' ? 'Dana' : 'Dr. Reagan') + ' or the CPA seat can clear. Match these and Investigate stay open to you.' }));
    if (st.varRefusal[v.id]) card.append(st.varRefusal[v.id]);
    if (st.invOpen[v.id]) {
      const rows = S.ledger.filter((e) => e.locationId === v.locationId && e.kind === 'patient_payment' && e.tender === v.tender && e.posted === rr.date).slice(-(pm.ledgerEntries || 2));
      card.append(h('div', { class: 'stack' }, h('p', { class: 'small muted', text: 'Candidate rows (same tender, two-day window; names shown on expansion and logged as a payment-purpose read):' }),
        h('ul', { class: 'dc-sentences' }, ...rows.map((e) => h('li', { text: pname(S, e.patientId) + ' · ' + e.tender + ' payment ' + money(-e.amountCents) + ' · posted ' + shortDate(e.posted) + ' after 6 pm · #' + e.id }))),
        h('p', { class: 'small muted', text: 'Investigate opens a control finding with these rows attached, routed to Money Desk → Variances.' })));
    }
    return card;
  }
  function practiceLines(r, S) {
    const pairs = changedPairs(S); const late = lateRows(S);
    const line = (testid, label, n, open, onClick, items) => [
      h('button', { type: 'button', class: 'dc-line', testid, 'aria-expanded': bool(open), onClick }, h('span', { text: label }), h('span', { class: 'count', 'aria-label': n + ' rows', text: String(n) }), h('span', { class: 'muted', 'aria-hidden': 'true', text: open ? '▴' : '▾' })),
      open ? h('ul', { class: 'dc-sentences' }, ...(items.length ? items.map((s) => h('li', { text: s })) : [h('li', { text: 'None.' })])) : null];
    return h('div', { class: 'stack' },
      ...line('close.changed', 'Yesterday changed after close', pairs.length, st.changedOpen, () => { st.changedOpen = !st.changedOpen; rerender(r, 'close.changed'); }, pairs.map((p) => pairSentence(S, p))),
      ...line('close.late', 'Postings into closed days', late.length, st.lateOpen, () => { st.lateOpen = !st.lateOpen; rerender(r, 'close.late'); }, late.map((e) => lateSentence(S, e))),
      h('details', null, h('summary', { class: 'small', testid: 'close.counts.why' }, 'How these are counted'), h('p', { class: 'small muted', text: 'A correction is a reversal plus a repost, both linked to the original row; pairs by human actors are counted. A late first posting has nothing to correct and posts today marked after close; worker rows from an overnight 835 or import are excluded from both counts. Both counts are practice-level.' })));
  }

  /* ---- Decisions due, approvals, exceptions ---- */
  function decisions(r, S) {
    const due = S.decisions.filter((d) => d.status === 'review_due');
    const results = Object.keys(st.decisionResult);
    if (!due.length && !results.length) return null;
    const rows = due.map((d) => {
      const late = days(d.reviewBy, S.tenant.today);
      const act = (action, label, kind) => btn(label, { kind, testid: 'close.decision.' + d.id + '.' + action, onClick: () => {
        const res = Proto.store.reviewDecision(d.id, action);
        if (res.ok) { const T = Proto.store.get().tenant; st.decisionResult[d.id] = action === 'keep' ? 'Kept 90 more days; review on 12/2.' : action === 'tighten' ? 'Tightened: write-off threshold back to ' + money(T.dualReleaseThresholdCents) + ' (base). Review in 90 days.' : 'Retired: write-off threshold back to ' + money(T.dualReleaseThresholdCents) + '. Nothing auto-renews.'; say(st.decisionResult[d.id]); }
        rerender(r, 'close.closeday');
      } });
      return h('div', { class: 'card flat stack', 'aria-label': 'Decision ' + d.id },
        h('div', { class: 'row' }, chip('review', 'Review ' + (late > 0 ? 'was due ' + shortDate(d.reviewBy) + ' (' + plural(late, 'day') + ' ago)' : 'due ' + shortDate(d.reviewBy))), h('span', { class: 'small muted', text: 'Decided ' + longDate(d.decidedAt) + ' by ' + shortName(S, d.decidedBy) })),
        h('p', null, h('b', { text: d.text })),
        h('p', { class: 'row' }, h('span', { text: 'Since this raise: ' + d.measuredEffect + '.' }), chip('info', 'directional')),
        h('div', { class: 'btnrow' }, act('keep', 'Keep 90 more days', 'reversible'), act('tighten', 'Tighten', 'reversible'), act('retire', 'Retire', 'irreversible')),
        h('details', null, h('summary', { class: 'small', testid: 'close.decision.' + d.id + '.why' }, 'Why directional'), h('p', { class: 'small muted', text: 'Under the digest minimum sample the effect sentence is computed from domain events since the decision and labelled directional. An unreviewed decision stops applying at midnight of its review date and becomes a finding; neglect tightens, never loosens.' })));
    });
    return section('Decisions due for review' + (due.length ? ': ' + due.length : ''), ...rows, ...results.map((id) => h('p', { class: 'row' }, chip('clear', 'Reviewed today'), h('span', { text: id + ': ' + st.decisionResult[id] }))));
  }
  function approvals(r, S) {
    const me = Proto.store.currentUser();
    const mine = S.approvals.filter((a) => a.status === 'pending' && me.entitlements.includes('approve_second') && a.requestedById !== me.id);
    return section('Approvals only I can give' + (mine.length ? ': ' + mine.length : ''),
      mine.length ? h('div', { class: 'worklist' }, ...mine.map((a) => h('div', { class: 'dc-row' }, chip('review', 'Waiting'), h('span', { class: 'text', text: a.frozenSentence }), btn('Open phone card', { kind: 'reversible', testid: 'close.approval.' + a.id + '.open', onClick: () => { location.hash = '#/phone/approvals'; } })))) : h('p', { class: 'muted', text: 'None waiting. Held postings appear here and on your phone card the moment someone requests a second approver.' }),
      h('p', { class: 'small muted', text: 'After-hours hold: on (refund, adjustment, write-off outside ' + S.tenant.businessHours.open + '–' + S.tenant.businessHours.close + ' need a second approver regardless of amount).' }));
  }
  function exceptions(r, S) {
    const v = sodView(S);
    return section('Expiring exceptions and open SoD findings',
      ...v.exceptions.map((x) => h('div', { class: 'dc-row' }, chip('review', 'Expires ' + shortDate(x.reviewBy)), h('span', { class: 'text', text: 'Accepted exception: ' + x.rule.pair.join(' + ') + ' held by one seat · ' + plural(days(S.tenant.today, x.reviewBy), 'day') + ' left · compensating: ' + x.rule.compensating }))),
      ...v.findings.map((f) => h('div', { class: 'dc-row' }, chip(f.rule.severity === 'critical' ? 'stop' : 'required', f.rule.severity), h('span', { class: 'text', text: 'Open finding: ' + f.rule.pair.join(' + ') + ' held by one seat · ' + f.rule.fraudPath + ' Compensating: ' + f.rule.compensating }))),
      h('div', { class: 'row' }, h('span', { class: 'small muted grow', text: plural(v.findings.length, 'open finding') + ', ' + plural(v.exceptions.length, 'accepted exception') + ' · practice-level; remediate, compensate, or accept on the Roles screen.' }), btn('Roles', { kind: 'quiet', testid: 'close.sod.roles', onClick: () => Proto.router.go(r.persona, 'roles') })));
  }

  /* ---- Close day ---- */
  function closeDaySection(r, S) {
    const loc = locOf(S, 'loc-1'); const today = S.tenant.today;
    const done = S.dayCloses.find((d) => d.locationId === 'loc-1' && d.date === today);
    const kids = [];
    if (done) kids.push(h('p', { class: 'row' }, h('span', { class: 'dc-lock', 'aria-hidden': 'true', text: '🔒' }), chip('clear', 'Closed'), h('span', { text: 'Closed ' + shortDate(done.date) + ' at ' + done.closedAt + ' by ' + shortName(S, done.closedBy) + ' · chain head ' + done.chainHeadHash + ' · deposit slip prepared; day sheet frozen.' })));
    const primary = btn(done ? 'Held · day closed' : 'Close day', { kind: st.closeRefusal || done ? 'held' : 'irreversible', testid: 'close.closeday', onClick: () => {
      if (done) { const res = Proto.store.closeDay('loc-1'); if (!res.ok) { st.closeRefusal = refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why || 'A closed day is sealed; corrections post into today as a reversal-and-repost pair.' }); } rerender(r, 'close.closeday'); return; }
      st.closeStep = 'confirm'; rerender(r, 'close.closeday.confirm');
    } });
    kids.push(h('div', { class: 'btnrow' }, primary, h('span', { class: 'small muted', text: loc.name + ' · ' + longDate(today) + ' · totals by tender, deposit slip, day sheet frozen atomically' })));
    if (st.closeRefusal) kids.push(st.closeRefusal);
    if (st.closeStep === 'confirm' && !done) {
      const tot = todayTotals(S, 'loc-1'); const sum = tot.cash + tot.check + tot.card;
      kids.push(h('div', { class: 'card flat stack', role: 'group', 'aria-label': 'Confirm close day' },
        h('h3', { text: 'Close ' + loc.name + ' for ' + longDate(today) + '?' }),
        h('div', { class: 'tender head', role: 'row' }, h('span', { text: 'Tender' }), h('span', { class: 'num', text: 'Collected today' }), h('span'), h('span')),
        ...TENDERS.map(([t, label]) => h('div', { class: 'tender', role: 'row' }, h('span', { text: label }), h('span', { class: 'num', text: money(tot[t]) }), h('span'), h('span'))),
        h('div', { class: 'tender', role: 'row' }, h('span', null, h('b', { text: 'Total' })), h('span', { class: 'num' }, h('b', { text: money(sum) })), h('span'), h('span')),
        h('p', { text: 'Deposit slip prepared; day sheet frozen with chain head. Later postings dated today go into tomorrow as a reversal-and-repost pair or a marked late posting; nothing here changes in place.' }),
        h('div', { class: 'btnrow' },
          btn('Close day', { kind: 'irreversible', testid: 'close.closeday.confirm', onClick: () => {
            const res = Proto.store.closeDay('loc-1');
            if (res.ok) { st.closeStep = 'done'; st.closeRefusal = null; say('Day closed. Deposit slip prepared; day sheet frozen with chain head ' + res.dayClose.chainHeadHash); rerender(r, 'close.closeday'); return; }
            st.closeStep = 'idle';
            st.closeRefusal = refusal({ code: res.code, verb: res.verb, control: res.control || (res.code === 'entitlement' ? 'Ask Dana or Dr. Reagan' : null), why: res.why || 'Closing freezes totals and prepares the deposit; only a seat with close_day can do it, and never the seat that posted and prepared the deposit alone.', onControl: () => say('Dana or Dr. Reagan can close from their own seat; nothing is lost by waiting.') });
            rerender(r, 'close.closeday');
          } }),
          btn('Cancel', { kind: 'quiet', testid: 'close.closeday.cancel', onClick: () => { st.closeStep = 'idle'; rerender(r, 'close.closeday'); } }))));
    }
    return section('Close day', ...kids);
  }
  function health() {
    return h('div', { class: 'dc-health' }, h('span', { text: 'Practice health: 78 · top levers: bank feed for Hillsboro, second admin for East, retire vacation exception' }), chip('info', 'directional'), h('span', { class: 'small', text: '· nothing here ranks people' }));
  }

  /* ---- keys: active only while mounted on close ---- */
  function onKey(ev) {
    if (Proto.router.current().route !== 'close') { detachKeys(); return; }
    const el = document.activeElement; if (!el || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('#dialogs .overlay')) return;
    if (ev.key === 't' || ev.key === 'T') { ev.preventDefault(); toggleTile(lastRoute || Proto.router.current()); }
  }
  function attachKeys() { if (!keysOn) { document.addEventListener('keydown', onKey); keysOn = true; } }
  function detachKeys() { if (keysOn) { document.removeEventListener('keydown', onKey); keysOn = false; } }

  /* ---- render: close ---- */
  function renderClose(r) {
    const S = Proto.store.get();
    if (lastStore !== S) { lastStore = S; st = fresh(); }
    lastRoute = r; attachKeys();
    const page = h('div', { class: 'stack dc-page' },
      tile(r, S),
      st.tileOpen ? h('div', { class: 'stack', id: 'dc-tile-detail' }, h('div', { class: 'dc-locs' }, ...S.reconciliation.map((rr) => locationRow(r, S, rr))), practiceLines(r, S)) : h('div', { id: 'dc-tile-detail', hidden: true }),
      pageHead('Daily Close and Controls', 'Home: is yesterday’s money in the bank? Tap the tile or press T. Controls live below; nothing here ranks people.'),
      decisions(r, S), approvals(r, S), exceptions(r, S), closeDaySection(r, S), health());
    Proto.screens.shell.mount(page);
  }

  /* ---- render: risk ---- */
  function auditSentences(S) {
    const ev = (window.__events || []).filter((e) => e.kind === 'write').slice(-8).reverse();
    return ev.map((e) => {
      const uid = S.personaUser[e.persona]; const u = S.users.find((x) => x.id === uid);
      const who = e.persona === 'temp' ? 'The day-pass seat' : u ? u.short + ' (' + e.persona + ')' : 'Someone signed in as ' + e.persona;
      return who + ' ' + (WROTE[e.table] || 'wrote ' + e.table) + ' #' + e.id + ' at +' + Math.round(e.t / 1000) + ' s on ' + e.route + ' (event ' + e.seq + ').';
    });
  }
  function renderRisk(r) {
    const S = Proto.store.get();
    if (lastStore !== S) { lastStore = S; st = fresh(); }
    lastRoute = r; detachKeys();
    const row = (id, action, sev, word, text, label, kind, onClick, extra) => h('div', { class: 'dc-row' }, chip(sev, word), h('span', { class: 'text' }, h('span', { text: text }), extra ? h('span', { class: 'small muted', text: ' ' + extra }) : null), btn(label, { kind, testid: 'risk.row.' + id + '.' + action, onClick }));
    const due = S.decisions.filter((d) => d.status === 'review_due');
    const items = [];
    due.forEach((d) => items.push(row(d.id, 'open', 'required', 'past review', 'Decision ' + d.id + ' past review date: ' + d.text + ' (review was ' + shortDate(d.reviewBy) + ').', 'Open', 'reversible', () => Proto.router.go(r.persona, 'close'))));
    if (!due.length) items.push(h('div', { class: 'dc-row' }, chip('clear', 'none'), h('span', { class: 'text', text: 'No decisions past their review date.' })));
    items.push(row('baa-lab', 'renew', 'review', '21 days', 'BAA: Ridge Dental Lab expires in 21 days (' + longDate('2026-09-24') + ').', st.riskDone.baa ? 'Renewal sent' : 'Renew', st.riskDone.baa ? 'quiet' : 'reversible', () => { st.riskDone.baa = true; say('Renewal request sent to Ridge Dental Lab; the BAA stays on this list until the countersigned copy is filed.'); rerender(r, 'risk.row.baa-lab.renew'); }, st.riskDone.baa ? 'Renewal requested today; tracked until countersigned.' : null));
    items.push(row('training', 'assign', 'review', 'due', 'Training due: 3 staff (practice).', st.riskDone.training ? 'Assigned' : 'Assign', st.riskDone.training ? 'quiet' : 'reversible', () => { st.riskDone.training = true; say('Assigned: HIPAA annual refresher, due 9/30. Reminders go to each person, not to this list.'); rerender(r, 'risk.row.training.assign'); }, st.riskDone.training ? 'Assigned today, due 9/30; this row shows the practice count only.' : null));
    items.push(row('logreview', 'start', 'review', 'due 9/5', 'Monthly log review: due 9/5.', st.riskDone.log ? 'Opened' : 'Start', st.riskDone.log ? 'quiet' : 'reversible', () => { st.riskDone.log = true; say('Opens pre-built views: failed logins 2, exports 1, break-glass 0, chain verified nightly'); rerender(r, 'risk.row.logreview.start'); }, st.riskDone.log ? 'Pre-built views: failed logins 2, exports 1, break-glass 0, chain verified nightly.' : null));
    const sentences = auditSentences(S);
    const page = h('div', { class: 'stack dc-page' },
      pageHead('Practice risk', 'Open decisions past review, BAAs expiring, training due, the monthly log review. Practice-level; nothing here ranks people.'),
      section('Due now', h('div', { class: 'worklist' }, ...items)),
      section('Audit log (sentences)',
        h('p', { class: 'small muted', text: 'The last ' + sentences.length + ' writes this session, as sentences. Every row is append-only; the chain head is verified nightly.' }),
        sentences.length ? h('ul', { class: 'dc-sentences' }, ...sentences.map((s) => h('li', { text: s }))) : h('p', { class: 'muted', text: 'No writes yet this session.' }),
        h('div', { class: 'btnrow' }, btn('Refresh', { kind: 'quiet', testid: 'risk.row.audit.refresh', onClick: () => rerender(r, 'risk.row.audit.refresh') }), btn('Open Daily Close', { kind: 'quiet', testid: 'risk.row.close.open', onClick: () => Proto.router.go(r.persona, 'close') }))));
    Proto.screens.shell.mount(page);
  }

  window.addEventListener('hashchange', () => { if (Proto.router.current().route !== 'close') detachKeys(); });

  Proto.screens.dailyclose = { render: renderClose, renderRisk, grade, overall, changedPairs, lateRows };
  Proto.screens.risk = { render: renderRisk };
  Proto.router.on('close', (r) => Proto.screens.dailyclose.render(r));
  Proto.router.on('risk', (r) => Proto.screens.risk.render(r));
})();
