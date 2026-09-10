/* Daily Close and Controls (owner home; route close) and Practice risk (compliance home; route risk).
   Features 18 (independence-graded Tied tile), 19 (variance sentence with proposed match), 20 (sealed
   closed day: changed-after-close pairs and postings into closed days), 21 (decision review with measured
   effect), 25 (hours scope line). Flow 5: close.closeday (1) → close.closeday.confirm (2).
   Copy describes hands, never the person; every count is practice-level. Keys while mounted: T toggles the tile. */
(function () {
  // One date format for this screen: shortDate, in the card, the list and the close read-back alike.
  const Proto = window.Proto; const { h, btn, chip, refusal, money, section, pageHead, displayName, shortDate } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const TENDERS = [['cash', 'Cash'], ['check', 'Check'], ['card', 'Card']];
  // grade -> [css class, glyph, word, chip severity]
  const GRADE = { tied: ['tied', '●', 'Tied · independent', 'clear'], second: ['second', '◐', 'Tied · needs a second look', 'review'], variance: ['variance', '▲', 'variances', 'required'] };
  const REASON = { posted_to_wrong_account: 'posted to wrong account', duplicate: 'duplicate posting', wrong_amount: 'wrong amount', wrong_tender: 'wrong tender' };
  const KIND = { patient_payment: 'payment', insurance_payment: 'insurance payment', charge: 'charge', write_off: 'write-off', adjustment: 'adjustment', refund: 'refund', reversal: 'reversal' };
  // Entitlement codes are how the grant is stored, never how a seat is described on screen.
  const ENT = { post_payment: 'posts payments', refund: 'issues refunds', write_off: 'writes off balances', prepare_deposit: 'prepares the deposit', bank_reconcile: 'reconciles the bank', approve_second: 'gives second approvals', grant_roles: 'grants roles', close_day: 'closes the day', schedule: 'books the schedule', submit_claims: 'submits claims', post_era: 'posts ERA batches', review_logs: 'reviews the logs', view_reports: 'reads reports', chart: 'charts', perio: 'records perio', note_draft: 'drafts notes', chart_assist: 'assists charting' };
  const entWords = (code) => ENT[code] || String(code == null ? '' : code).replace(/_/g, ' ');
  const pairWords = (pair) => (pair || []).map(entWords).join(' and ');
  // Clearing someone else's variance belongs to the seats that reconcile the bank or close the books;
  // offering the control to any other seat is offering a refusal.
  const CLEAR_ENTS = ['bank_reconcile', 'close_day'];
  const WROTE = { ledger: 'appended a ledger row', approvals: 'created an approval request', approvalsLog: 'decided an approval request', dayCloses: 'closed a business day', deposits: 'prepared a deposit slip', reconciliationMatches: 'matched or cleared a variance', controlDecisions: 'reviewed a control decision', appointmentEvents: 'moved an appointment', eligibilityChecks: 're-ran eligibility', messages: 'pinged a chair', perioExams: 'saved a perio exam', tags: 'tagged a tooth for the dentist', chartEvents: 'painted the chart', planItems: 'added a plan item', notes: 'edited the note', filedNotes: 'filed a note', claims: 'changed a claim', claimEvents: 'recorded a claim event', appealPackets: 'built an appeal packet', disclosures: 'disclosed records (logged)', statementsDue: 'queued a statement', collectionDecisions: 'recorded a collection decision', allocations: 'allocated a payment', dayPasses: 'issued a day pass', userEntitlements: 'changed entitlements', firstRunState: 'retired a first-shift chip', sessions: 'switched author with a PIN' };

  let st = null, lastStore = null, lastRoute = null, keysOn = false;
  const fresh = () => ({ tileOpen: false, locOpen: null, invOpen: {}, changedOpen: false, lateOpen: false, varRefusal: {}, closeStep: 'idle', closeRefusal: null, dayClose: null, decisionResult: {}, decisionRefusal: {}, riskDone: {}, logOpen: false });
  const fresh = () => ({ tileOpen: false, locOpen: null, invOpen: {}, changedOpen: false, lateOpen: false, varRefusal: {}, closeStep: 'idle', closeRefusal: null, dayClose: null, decisionResult: {}, decisionRefusal: {}, riskDone: {}, logOpen: false, pin: '', device: null });
  const priv = () => !!(window.__proto && window.__proto.privacy);
  const shared = () => !!(window.__proto && window.__proto.device === 'shared');
  // Shared desk: every posting verb here carries the PIN the field holds; the store matches it and names the poster.
  const extras = () => ({ pin: st.pin || null });
  const posted = () => { st.pin = ''; };
  const bool = (b) => (b ? 'true' : 'false');
  const say = (t) => Proto.router.announce(t);
  const pname = (S, pid) => { const p = S.patients.find((x) => x.id === pid); return displayName(p ? p.name : pid, priv()); };
  const shortName = (S, name) => { const u = S.users.find((x) => x.name === name); return u ? u.short : name; };
  const locOf = (S, id) => S.locations.find((l) => l.id === id) || { name: id, short: id };
  const days = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const cap = (s) => String(s == null ? '' : s).charAt(0).toUpperCase() + String(s == null ? '' : s).slice(1);
  const orList = (a) => (a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]);
  // Date arithmetic on the stored parts, never through a UTC round trip that can slide a day.
  // A monthly task falls on the same day each month: after that day the next one is next month's.
  const monthlyDue = (today, dom) => { const p = String(today == null ? '' : today).split('-'); if (p.length !== 3) return null; let y = Number(p[0]), m = Number(p[1]); if (Number(p[2]) > dom) { m += 1; if (m > 12) { m = 1; y += 1; } } return y + '-' + String(m).padStart(2, '0') + '-' + String(dom).padStart(2, '0'); };

  function rerender(r, focus) {
    r = r || lastRoute || Proto.router.current();
    Proto.router.render();
    Proto.screens.shell.refreshAndon(r);
    if (focus) { const el = document.querySelector(/^[[.#]/.test(focus) ? focus : '[data-testid="' + focus + '"]'); if (el && el.focus) el.focus(); }
  }
  /* Every store refusal this screen renders goes where its control says: an outage to the support line, a day
     already closed or a variance already decided to the day itself, an entitlement gate to Roles or Approvals
     (whichever its control names). The controls used to have no handler at all, so "Open the day" and "Support
     line" were dead ends. */
  function openDay(r) { st.tileOpen = true; st.locOpen = st.locOpen || 'loc-1'; rerender(r, 'close.location.' + st.locOpen); }
  const focusPin = (r) => { rerender(r, 'close.pin'); const el = document.activeElement; if (el && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); };
  /* Every press that raises a gate is its own refusal (`fresh`): Keep, Tighten and Retire share one wording, and the
     shared component's dedupe would otherwise log three presses as one. */
  function gate(r, res, why, fallback) {
    const onControl = () => {
      if (res.code === 'outage') Proto.ui.support();
      else if (res.code === 'already_closed' || res.code === 'already_decided') openDay(r);
      else if (/^pin_/.test(res.code)) { if (res.code === 'pin_locked') st.pin = ''; focusPin(r); }
      else if (fallback) fallback();
      // The seat that can act is granted on Roles; Approvals is where the same seat reads "not an approver".
      else if (res.code === 'entitlement') { if (/approvals/i.test(res.control || '')) location.hash = '#/phone/approvals'; else Proto.router.go(r.persona, 'roles'); }
    };
    return refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why || why, severity: res.code === 'outage' ? 'stop' : 'required', onControl, fresh: true });
  }
  /* A gate whose cause is gone falls on the next render, and a press on the Held primary re-evaluates before it
     focuses the gate's control: if the gate has fallen the press acts. A held gate keeps its store refusal (`res`)
     beside the node it rendered, so the check reads the code, never the DOM. Causes: the outage, the author, the
     device and, for a PIN gate, the PIN field being edited. */
  const stale = (g) => !!g && !!g.res && ((g.res.code === 'outage' && !Proto.store.get().outage) || (g.res.code === 'entitlement' && g.who !== Proto.store.currentUser().id) || (/^pin_/.test(g.res.code) && (!shared() || g.pin !== st.pin)));
  const heldGate = (by, res, node) => ({ by, res, node, who: Proto.store.currentUser().id, pin: st.pin });
  const live = (slot, key) => { if (stale(slot[key])) slot[key] = null; return slot[key] || {}; };
  const heldPress = (r, slot, key, act) => { if (stale(slot[key])) { slot[key] = null; act(); } else rerender(r, 'refusal.control'); };
  // A name shown on expansion is a logged read; the store owns the row, the screen only asks for it.
  const disclose = (patientId, recordIds) => { if (Proto.store.disclose) Proto.store.disclose({ patientId, purpose: 'payment', recordIds }); };

  /* ---- computed views (read-only over store.get()) ----
     Each helper is exported, so each answers on ordinary, boundary and missing input: a row or a table it
     cannot read is never reported as tied, and never throws into the render. */
  function grade(rr) {
    if (!rr || typeof rr !== 'object') return 'second';
    if (rr.state === 'variance') return 'variance';
    if (rr.state === 'second_look' || !rr.independent || rr.closerPosted || (rr.source === 'statement' && rr.lagDays * 24 > 48)) return 'second';
    return 'tied';
  }
  const table = (S, name) => (S && Array.isArray(S[name]) ? S[name] : []);
  const openVariances = (S, locId) => table(S, 'variances').filter((v) => v.status === 'open' && (!locId || v.locationId === locId));
  function overall(S) {
    const grades = table(S, 'reconciliation').map(grade);
    if (grades.includes('variance')) { const n = Math.max(openVariances(S).length, grades.filter((g) => g === 'variance').length); return { grade: 'variance', word: plural(n, 'variance'), n }; }
    if (grades.includes('second')) return { grade: 'second', word: GRADE.second[2] };
    return { grade: 'tied', word: GRADE.tied[2] };
  }
  function changedPairs(S) {
    const ledger = table(S, 'ledger'); const today = S && S.tenant ? S.tenant.today : null;
    const rows = ledger.filter((e) => e.correctsEntryId && e.posted === today && e.actorKind === 'user');
    const groups = {};
    rows.forEach((e) => { (groups[e.correctsEntryId] = groups[e.correctsEntryId] || []).push(e); });
    return Object.keys(groups).map((origId) => ({ orig: ledger.find((e) => e.id === origId), rev: groups[origId].find((e) => e.kind === 'reversal'), repost: groups[origId].find((e) => e.kind !== 'reversal') }));
  }
  const lateRows = (S) => table(S, 'ledger').filter((e) => e.postedAfterClose && e.actorKind !== 'worker');
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
  /* The read-back must count what closeDay will freeze: a repost is money, its reversal is not, and the
     pair nets to zero. Counting payments alone showed yesterday's reposted check as collected today. */
  function todayTotals(S, locId) {
    const tot = { cash: 0, check: 0, card: 0 };
    const ledger = table(S, 'ledger'); const today = S && S.tenant ? S.tenant.today : null;
    ledger.filter((e) => e.locationId === locId && e.posted === today && (e.kind === 'patient_payment' || e.kind === 'reversal')).forEach((e) => {
      if (e.kind === 'reversal') { const orig = ledger.find((x) => x.id === e.reversesEntryId); if (orig && orig.tender) tot[orig.tender] -= e.amountCents; return; }
      tot[e.tender || 'card'] += -e.amountCents;
    });
    return tot;
  }
  /* A grant is a grant: the seed's standing grants and the day passes issued this session are scanned alike, and
     a pass's decision is the controlDecisions row the store wrote for it. Reading currentGrants alone left an
     accepted day-pass conflict off the owner home. */
  function sodView(S) {
    const findings = [], exceptions = [];
    const scan = (entitlements, decided) => {
      const ents = new Set(entitlements || []);
      table(S, 'sodRules').filter((rule) => rule.pair.every((e) => ents.has(e))).forEach((rule) => {
        const d = decided(rule);
        if (d) exceptions.push({ rule, reviewBy: d.reviewBy, decisionId: d.decisionId, kind: d.kind || 'accept_residual' });
        else findings.push({ rule });
      });
    };
    table(S, 'currentGrants').forEach((g) => scan(g.entitlements, (rule) => (g.accepted && g.accepted.ruleId === rule.id ? g.accepted : null)));
    table(S, 'dayPasses').forEach((dp) => scan(dp.entitlements, (rule) => { const d = table(S, 'controlDecisions').find((x) => x.dayPassId === dp.id && x.ruleId === rule.id); return d ? { reviewBy: d.reviewBy, decisionId: d.id, kind: d.kind } : null; }));
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
      return h('div', { class: 'tender', testid: 'close.tender.' + t, role: 'row' }, h('span', { text: label }), h('span', { class: 'num', text: money(exp) }), h('span', { class: 'num', text: money(bank) }), gap === 0 ? chip('clear', 'Tied') : chip('required', 'Gap ' + money(gap)));
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
    const me = Proto.store.currentUser();
    const isCloser = rr.closer === me.name || rr.posters === me.name;
    // Match and Clear are offered to an independent seat that carries the money it would be settling, and to
    // nobody else: the store's gate decides, so the control on screen is the control the store accepts.
    const mayClear = !Proto.store.reconcileGate(rr, me);
    const clearers = table(S, 'users').filter((u) => u.name !== me.name && u.name !== rr.closer && CLEAR_ENTS.some((e) => (u.entitlements || []).includes(e))).map((u) => u.short);
    const pm = v.proposedMatch || {};
    const candidates = () => S.ledger.filter((e) => e.locationId === v.locationId && e.kind === 'patient_payment' && e.tender === v.tender && e.posted === rr.date).slice(-(pm.ledgerEntries || 2));
    const held = live(st.varRefusal, v.id);
    // One gate per card, raised by the control that pressed it; that control carries the Held identity.
    const refuse = (by, res, fallback) => { st.varRefusal[v.id] = heldGate(by, res, gate(r, res, null, fallback)); rerender(r, 'refusal.control'); };
    const card = h('div', { class: 'card flat stack', 'aria-label': 'Variance ' + v.id },
      h('div', { class: 'row' }, chip('required', 'Variance ' + money(v.amountCents)), h('span', { class: 'small muted', text: v.tender + ' · ' + locOf(S, v.locationId).name + ' · ' + shortDate(rr.date) })),
      h('p', { class: 'explain sentence', text: v.sentence }),
      h('p', null, h('b', { text: 'Proposed match: ' }), pm.bankLine + ' ↔ ' + plural(pm.ledgerEntries || 0, 'ledger entry').replace('entrys', 'entries')));
    const doMatch = () => {
      const res = Proto.store.matchVariance(v.id, extras());
      if (res.ok) { st.varRefusal[v.id] = null; posted(); say('Matched ' + money(v.amountCents) + ' at ' + locOf(S, v.locationId).name); rerender(r, 'close.tied.tile'); return; }
      refuse('match', res);
    };
    const controls = h('div', { class: 'btnrow' },
      mayClear ? btn('Match these', { kind: 'irreversible', testid: 'close.variance.' + v.id + '.match', onClick: () => { const res = Proto.store.matchVariance(v.id); if (res.ok) say('Matched ' + money(v.amountCents) + ' at ' + locOf(S, v.locationId).name); rerender(r, 'close.tied.tile'); } }) : null,
      btn(st.invOpen[v.id] ? 'Hide rows' : 'Investigate', { kind: 'reversible', testid: 'close.variance.' + v.id + '.investigate', pressed: !!st.invOpen[v.id], onClick: () => { st.invOpen[v.id] = !st.invOpen[v.id]; rerender(r, 'close.variance.' + v.id + '.investigate'); } }));
    if (mayClear) controls.append(btn('Clear with reason', { kind: st.varRefusal[v.id] ? 'held' : 'quiet', testid: 'close.variance.' + v.id + '.clear', onClick: () => {
      const res = Proto.store.clearVariance(v.id);
      if (res.ok) { say('Cleared with reason'); rerender(r, 'close.tied.tile'); return; }
      st.varRefusal[v.id] = refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why, onControl: null });
      rerender(r, 'close.variance.' + v.id + '.clear');
    } }));
    card.append(controls);
    if (!mayClear) card.append(h('p', { class: 'small muted', text: (isCloser ? 'Same hands closed ' + locOf(S, rr.locationId).name + ' on ' + shortDate(rr.date) + '. ' : 'Clearing belongs to a seat that reconciles the bank or closes the books. ') + (clearers.length ? orList(clearers) + ' can clear. ' : '') + 'Investigate stays open to you.' }));
    if (st.varRefusal[v.id]) card.append(st.varRefusal[v.id]);
      btn('Match these', { kind: held.by === 'match' ? 'held' : 'irreversible', testid: 'close.variance.' + v.id + '.match', onClick: () => (held.by === 'match' ? heldPress(r, st.varRefusal, v.id, doMatch) : doMatch()) }),
      btn(st.invOpen[v.id] ? 'Hide rows' : 'Investigate', { kind: 'reversible', testid: 'close.variance.' + v.id + '.investigate', pressed: !!st.invOpen[v.id], onClick: () => {
        st.invOpen[v.id] = !st.invOpen[v.id];
        if (st.invOpen[v.id]) candidates().forEach((e) => disclose(e.patientId, [e.id]));
        rerender(r, 'close.variance.' + v.id + '.investigate');
      } }));
    const doClear = () => {
      const res = Proto.store.clearVariance(v.id, extras());
      if (res.ok) { st.varRefusal[v.id] = null; posted(); say('Cleared with reason'); rerender(r, 'close.tied.tile'); return; }
      // The rows are what an independent seat would be handed, so the way out of a who-may-clear gate opens them.
      refuse('clear', res, () => { st.invOpen[v.id] = true; rerender(r, 'close.variance.' + v.id + '.investigate'); });
    };
    if (mayClear) controls.append(btn('Clear with reason', { kind: held.by === 'clear' ? 'held' : 'quiet', testid: 'close.variance.' + v.id + '.clear', onClick: () => (held.by === 'clear' ? heldPress(r, st.varRefusal, v.id, doClear) : doClear()) }));
    card.append(controls);
    if (!mayClear) card.append(h('p', { class: 'small muted', text: (isCloser ? 'Same hands closed ' + locOf(S, rr.locationId).name + ' on ' + shortDate(rr.date) + '. ' : 'Clearing belongs to a seat that reconciles the bank or closes the books. ') + (clearers.length ? orList(clearers) + ' can clear. ' : '') + 'Match these and Investigate stay open to you.' }));
    if (held.node) card.append(held.node);
    if (st.invOpen[v.id]) {
      const rows = candidates();
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
      h('details', null, h('summary', { class: 'small', testid: 'close.counts.why' }, 'Why these counts'), h('p', { class: 'small muted', text: 'A correction is a reversal plus a repost, both linked to the original row; pairs by human actors are counted. A late first posting has nothing to correct and posts today marked after close; worker rows from an overnight 835 or import are excluded from both counts. Both counts are practice-level.' })));
  }

  /* ---- Decisions due, approvals, exceptions ---- */
  function decisions(r, S) {
    const due = S.decisions.filter((d) => d.status === 'review_due');
    const results = Object.keys(st.decisionResult);
    if (!due.length && !results.length) return null;
    // The review controls render for the seats the store lets review: owner and the office manager.
    const me = Proto.store.currentUser();
    const mayReview = me.role === 'owner' || (me.entitlements || []).includes('grant_roles');
    const rows = due.map((d) => {
      const late = days(d.reviewBy, S.tenant.today);
      const held = live(st.decisionRefusal, d.id);
      const review = (action) => {
        const res = Proto.store.reviewDecision(d.id, action, extras());
        if (!res.ok) { st.decisionRefusal[d.id] = heldGate(action, res, gate(r, res, 'A decision is reviewed on the server so the threshold it moves is the one every posting reads.')); rerender(r, 'refusal.control'); return; }
        st.decisionRefusal[d.id] = null; posted();
        // The store sets the next review date when a decision is kept or tightened; printing a second
        // computation of it here is how the sentence and the row underneath it come to disagree.
        const next = shortDate(res.reviewBy);
        // Read the threshold after the store has moved it: the sentence names the value now in force.
        const threshold = money(Proto.store.get().tenant.dualReleaseThresholdCents);
        st.decisionResult[d.id] = action === 'keep' ? 'Kept 90 more days; review on ' + next + '.'
          : action === 'tighten' ? 'Tightened: write-off threshold back to ' + threshold + '; review on ' + next + '.'
            : 'Retired: write-off threshold back to ' + threshold + '. Nothing auto-renews.';
        say(action === 'keep' ? 'Kept 90 more days' : action === 'tighten' ? 'Tightened the write-off threshold' : 'Retired the raised threshold');
        // Focus lands on the stamp that replaced the control, never on the next primary: a repeated Enter must not close the day.
        rerender(r, '#dc-reviewed-' + d.id);
      };
      const act = (action, label, kind) => btn(label, { kind: held.by === action ? 'held' : kind, testid: 'close.decision.' + d.id + '.' + action, onClick: () => (held.by === action ? heldPress(r, st.decisionRefusal, d.id, () => review(action)) : review(action)) });
      const act = (action, label, kind) => btn(label, { kind, testid: 'close.decision.' + d.id + '.' + action, onClick: () => {
        const res = Proto.store.reviewDecision(d.id, action);
        if (res.ok) {
          // The store sets the next review date when a decision is kept or tightened; printing a second
          // computation of it here is how the sentence and the row underneath it come to disagree.
          const next = shortDate(res.reviewBy);
          // Read the threshold after the store has moved it: the sentence names the value now in force.
          const threshold = money(Proto.store.get().tenant.dualReleaseThresholdCents);
          st.decisionResult[d.id] = action === 'keep' ? 'Kept 90 more days; review on ' + next + '.'
            : action === 'tighten' ? 'Tightened: write-off threshold back to ' + money(res.thresholdCents) + '; review on ' + next + '.'
              : 'Retired: write-off threshold back to ' + money(res.thresholdCents) + '. Nothing auto-renews.';
          say(action === 'keep' ? 'Kept 90 more days' : action === 'tighten' ? 'Tightened the write-off threshold' : 'Retired the raised threshold');
        } else st.decisionRefusal[d.id] = refusal({ code: res.code, verb: res.verb, control: res.control, why: res.why, onControl: null });
        rerender(r, 'close.closeday');
      } });
      return h('div', { class: 'card flat stack', 'aria-label': 'Decision ' + d.id },
        h('div', { class: 'row' }, chip('review', 'Review ' + (late > 0 ? 'was due ' + shortDate(d.reviewBy) + ' (' + plural(late, 'day') + ' ago)' : 'due ' + shortDate(d.reviewBy))), h('span', { class: 'small muted', text: 'Decided ' + shortDate(d.decidedAt) + ' by ' + shortName(S, d.decidedBy) })),
        h('p', null, h('b', { text: d.text })),
        h('p', { class: 'row' }, h('span', { text: 'Since this raise: ' + d.measuredEffect + '.' }), chip('info', 'Directional')),
        mayReview ? h('div', { class: 'btnrow' }, act('keep', 'Keep 90 more days', 'reversible'), act('tighten', 'Tighten', 'reversible'), act('retire', 'Retire', 'irreversible'))
          : h('p', { class: 'small muted', text: 'Reviewing this decision belongs to Dr. Reagan or Dana; it is shown here so the practice can see what is due.' }),
        st.decisionRefusal[d.id] || null,
        h('div', { class: 'btnrow' }, act('keep', 'Keep 90 more days', 'reversible'), act('tighten', 'Tighten', 'reversible'), act('retire', 'Retire', 'irreversible')),
        held.node || null,
        h('details', null, h('summary', { class: 'small', testid: 'close.decision.' + d.id + '.why' }, 'Why directional'), h('p', { class: 'small muted', text: 'Under the digest minimum sample the effect sentence is computed from domain events since the decision and labelled directional. An unreviewed decision stops applying at midnight of its review date and becomes a finding; neglect tightens, never loosens.' })));
    });
    return section('Decisions due for review' + (due.length ? ': ' + due.length : ''), ...rows, ...results.map((id) => {
      const d = S.decisions.find((x) => x.id === id);
      return h('p', { class: 'row', id: 'dc-reviewed-' + id, tabindex: '-1' }, chip('clear', 'Reviewed today'), h('span', { text: (d ? d.text : 'This decision') + ' — ' + st.decisionResult[id] }));
    }));
  }
  function approvals(r, S) {
    const me = Proto.store.currentUser();
    const mine = S.approvals.filter((a) => a.status === 'pending' && me.entitlements.includes('approve_second') && a.requestedById !== me.id);
    return section('Approvals only I can give' + (mine.length ? ': ' + mine.length : ''),
      // The store's redacted sentence, as on the Andon and the phone card: the name is read on the card, a logged read.
      mine.length ? h('div', { class: 'worklist' }, ...mine.map((a) => h('div', { class: 'dc-row' }, chip('review', 'Waiting'), h('span', { class: 'text', text: Proto.store.approvalSentence(a, { redact: true }) }), btn('Open approvals', { kind: 'reversible', testid: 'close.approval.' + a.id + '.open', onClick: () => { location.hash = '#/phone/approvals'; } })))) : h('p', { class: 'muted', text: 'None waiting. A posting that needs a second approver appears here, and on your phone, the moment someone asks.' }),
      // Policy is what a person reads when they ask why, not what stands between them and the work.
      h('details', null, h('summary', { class: 'small', testid: 'close.approvals.why' }, 'Why these need a second approver'),
        h('p', { class: 'small muted', text: 'After-hours hold is on: a refund, adjustment or write-off outside ' + S.tenant.businessHours.open + '–' + S.tenant.businessHours.close + ' needs a second approver regardless of amount.' })));
  }
  function exceptions(r, S) {
    const v = sodView(S);
    return section('Expiring exceptions and open SoD findings',
      ...v.exceptions.map((x) => h('div', { class: 'dc-row' }, chip('review', 'Expires ' + shortDate(x.reviewBy)), h('span', { class: 'text', text: (x.kind === 'compensate' ? 'Compensated exception' : 'Accepted exception') + ': one seat ' + pairWords(x.rule.pair) + ' · ' + plural(days(S.tenant.today, x.reviewBy), 'day') + ' left · compensating: ' + x.rule.compensating }))),
      ...v.findings.map((f) => h('div', { class: 'dc-row' }, chip(f.rule.severity === 'critical' ? 'stop' : 'required', cap(f.rule.severity)), h('span', { class: 'text', text: 'Open finding: one seat ' + pairWords(f.rule.pair) + ' · ' + f.rule.fraudPath + ' Compensating: ' + f.rule.compensating }))),
      h('div', { class: 'row' }, h('span', { class: 'small muted grow', text: plural(v.findings.length, 'open finding') + ', ' + plural(v.exceptions.length, 'accepted exception') + ' · practice-level; remediate, compensate, or accept on the Roles screen.' }), btn('Roles', { kind: 'quiet', testid: 'close.sod.roles', onClick: () => Proto.router.go(r.persona, 'roles') })));
  }

  /* ---- Close day ---- */
  function closeDaySection(r, S) {
    const loc = locOf(S, 'loc-1'); const today = S.tenant.today;
    const done = S.dayCloses.find((d) => d.locationId === 'loc-1' && d.date === today);
    const kids = [];
    if (done) kids.push(h('p', { class: 'row', id: 'dc-closed', tabindex: '-1' }, h('span', { class: 'dc-lock', 'aria-hidden': 'true', text: '🔒' }), chip('clear', 'Closed'), h('span', { text: 'Closed ' + shortDate(done.date) + ' at ' + done.closedAt + ' by ' + shortName(S, done.closedBy) + ' · chain head ' + done.chainHeadHash + ' · deposit slip prepared; day sheet frozen.' })));
    const closeGate = live(st, 'closeRefusal');
    // One label for the control; the held identity supplies the word Held and keeps "Close day" as its name.
    const primary = btn('Close day', { kind: closeGate.node || done ? 'held' : 'irreversible', testid: 'close.closeday', onClick: () => {
      if (done) { const res = Proto.store.closeDay('loc-1', extras()); if (!res.ok) { st.closeRefusal = heldGate('close', res, gate(r, res, 'A closed day is sealed; corrections post into today as a reversal-and-repost pair.')); } rerender(r, 'refusal.control'); return; }
      const confirm = () => { st.closeStep = 'confirm'; rerender(r, '#dc-close-confirm'); };
      if (closeGate.node) { heldPress(r, st, 'closeRefusal', confirm); return; }
      // The confirm group opens with focus on its question, not on the irreversible control: a repeated Enter must not close the day.
      confirm();
    } });
    kids.push(h('div', { class: 'btnrow' }, primary, h('span', { class: 'small muted', text: loc.name + ' · ' + shortDate(today) + ' · totals by tender, deposit slip, day sheet frozen atomically' })));
    if (closeGate.node) kids.push(closeGate.node);
    if (st.closeStep === 'confirm' && !done) {
      const tot = todayTotals(S, 'loc-1'); const sum = tot.cash + tot.check + tot.card;
      kids.push(h('div', { class: 'card flat stack', role: 'group', 'aria-label': 'Confirm close day' },
        h('h3', { id: 'dc-close-confirm', tabindex: '-1', text: 'Close ' + loc.name + ' for ' + shortDate(today) + '?' }),
        h('div', { class: 'tender head', role: 'row' }, h('span', { text: 'Tender' }), h('span', { class: 'num', text: 'Collected today' }), h('span'), h('span')),
        ...TENDERS.map(([t, label]) => h('div', { class: 'tender', role: 'row' }, h('span', { text: label }), h('span', { class: 'num', text: money(tot[t]) }), h('span'), h('span'))),
        h('div', { class: 'tender', role: 'row' }, h('span', null, h('b', { text: 'Total' })), h('span', { class: 'num' }, h('b', { text: money(sum) })), h('span'), h('span')),
        // The finish path carries the read-back of what the press does; the correction policy sits behind Why.
        h('p', { text: 'Deposit slip prepared; day sheet frozen with chain head.' }),
        h('details', null, h('summary', { class: 'small', testid: 'close.closeday.why' }, 'Why a closed day never changes'),
          h('p', { class: 'small muted', text: 'Later postings dated today go into tomorrow as a reversal-and-repost pair or a marked late posting; nothing here changes in place.' })),
        h('div', { class: 'btnrow' },
          btn('Close day', { kind: 'irreversible', testid: 'close.closeday.confirm', onClick: () => {
            const res = Proto.store.closeDay('loc-1', extras());
            // Focus lands on the Closed stamp, never back on the (now held) primary: a repeated Enter raises no second gate.
            if (res.ok) { st.closeStep = 'done'; st.closeRefusal = null; posted(); say('Day closed — deposit slip prepared'); rerender(r, '#dc-closed'); return; }
            st.closeStep = 'idle';
            // The gate's own words, and its control goes where the control says: the screen adds neither.
            st.closeRefusal = heldGate('close', res, gate(r, res, 'Closing freezes totals and prepares the deposit, so only the seats that carry it can close.'));
            rerender(r, 'refusal.control');
          } }),
          btn('Cancel', { kind: 'quiet', testid: 'close.closeday.cancel', onClick: () => { st.closeStep = 'idle'; rerender(r, 'close.closeday'); } }))));
    }
    return section('Close day', ...kids);
  }
  /* Score and levers are read off the same tables the sections above read, so retiring a decision or tying
     a location moves both. The number used to be the literal 78 with three levers that never changed. */
  function health(S) {
    const v = sodView(S);
    const open = openVariances(S);
    const noFeed = table(S, 'reconciliation').filter((rr) => rr.source !== 'feed');
    const secondLook = table(S, 'reconciliation').filter((rr) => grade(rr) === 'second');
    const dueDecisions = table(S, 'decisions').filter((d) => d.status === 'review_due');
    const score = Math.max(0, Math.min(100, 100 - open.length * 6 - v.findings.length * 5 - secondLook.length * 4 - noFeed.length * 3 - dueDecisions.length * 2));
    const levers = [];
    if (open.length) levers.push('clear ' + plural(open.length, 'open variance'));
    noFeed.forEach((rr) => levers.push('bank feed for ' + locOf(S, rr.locationId).name));
    secondLook.forEach((rr) => levers.push('a second pair of hands at ' + locOf(S, rr.locationId).name));
    v.findings.forEach((f) => levers.push('split ' + pairWords(f.rule.pair)));
    if (dueDecisions.length) levers.push('review ' + plural(dueDecisions.length, 'decision') + ' past the review date');
    const top = levers.slice(0, 3);
    return h('div', { class: 'dc-health' }, h('span', { text: 'Practice health: ' + score + (top.length ? ' · top levers: ' + top.join(', ') : ' · nothing to lever today') }), chip('info', 'Directional'), h('span', { class: 'small', text: '· nothing here ranks people' }));
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

  /* ---- shared desk: the PIN that names the poster, once per screen, beside the controls every posting verb lives in ---- */
  const pinGates = () => [st.closeRefusal, ...Object.values(st.varRefusal), ...Object.values(st.decisionRefusal)].some((g) => g && g.res && /^pin_/.test(g.res.code));
  function pinField(r) {
    if (!shared()) return null;
    // Editing the PIN drops a PIN gate (stale()); the field is redrawn only then, so the caret survives ordinary typing.
    const pin = h('input', { class: 'input co-pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', id: 'dc-pin', testid: 'close.pin', value: st.pin, onInput: (ev) => { st.pin = ev.target.value; if (pinGates()) focusPin(r); } });
    return h('div', { class: 'field' }, h('label', { for: 'dc-pin', text: 'Your PIN' }), pin, h('p', { class: 'hint', text: 'Shared desk: the PIN makes you the frozen poster for every posting here.' }));
  }

  /* ---- render: close ---- */
  function renderClose(r) {
    const S = Proto.store.get();
    if (lastStore !== S) { lastStore = S; st = fresh(); }
    // A PIN typed for one device never carries to another: the field empties when the device flips.
    const device = window.__proto && window.__proto.device; if (st.device !== device) { st.device = device; st.pin = ''; }
    lastRoute = r; attachKeys();
    const page = h('div', { class: 'stack dc-page' },
      tile(r, S),
      st.tileOpen ? h('div', { class: 'stack', id: 'dc-tile-detail' }, h('div', { class: 'dc-locs' }, ...S.reconciliation.map((rr) => locationRow(r, S, rr))), practiceLines(r, S)) : h('div', { id: 'dc-tile-detail', hidden: true }),
      pageHead('Daily Close and Controls', 'Home: is yesterday’s money in the bank? Tap the tile or press T. Controls live below; nothing here ranks people.'),
      pinField(r),
      decisions(r, S), approvals(r, S), exceptions(r, S), closeDaySection(r, S), health(S));
    Proto.screens.shell.mount(page);
  }

  /* ---- render: risk ---- */
  /* The first write for a row is its creation; a later one on the same row is the edit the store logged with
     touch(), so the approver's decide step reads as the decision it was, not as creating the request. */
  const DECIDED = { approved: 'approved an approval request', declined: 'sent back an approval request' };
  function wroteWords(S, all, e) {
    const first = all.find((x) => x.table === e.table && x.id === e.id);
    if (e.table === 'approvals' && first && first.seq !== e.seq) { const a = table(S, 'approvals').find((x) => x.id === e.id) || {}; return DECIDED[a.status] || 'changed an approval request'; }
    return WROTE[e.table] || 'wrote a record';
  }
  function auditSentences(S) {
    const all = (window.__events || []).filter((e) => e.kind === 'write');
    return all.slice(-8).reverse().map((e) => {
      const uid = S.personaUser[e.persona]; const u = S.users.find((x) => x.id === uid);
      const who = e.persona === 'temp' ? 'The day-pass seat' : u ? u.short + ' (' + e.persona + ')' : 'Someone signed in as ' + e.persona;
      return who + ' ' + wroteWords(S, all, e) + ' #' + e.id + ' at +' + Math.round(e.t / 1000) + ' s on ' + e.route + ' (event ' + e.seq + ').';
    });
  }
  function renderRisk(r) {
    const S = Proto.store.get();
    if (lastStore !== S) { lastStore = S; st = fresh(); }
    lastRoute = r; detachKeys();
    // Each row carries its own Why (risk.row.<id>.why, CONTRACTS §4): the rule behind the row, read on demand.
    const row = (id, action, sev, word, text, label, kind, onClick, extra, why) => h('div', { class: 'dc-row' }, chip(sev, word),
      h('span', { class: 'text' }, h('span', { text: text }), extra ? h('span', { class: 'small muted', text: ' ' + extra }) : null,
        why ? h('details', null, h('summary', { class: 'small', testid: 'risk.row.' + id + '.why' }, 'Why'), h('p', { class: 'small muted', text: why })) : null),
      btn(label, { kind, testid: 'risk.row.' + id + '.' + action, onClick }));
    const due = S.decisions.filter((d) => d.status === 'review_due');
    const items = [];
    /* A standing row's control marks the task for this session only: nothing here has a store verb to write
       through yet, so a repeat press is a visible no-op that says it was already done, never the completed
       action announced a second time. */
    const standing = (key, id, action, sev, word, text, label, doneLabel, firstSay, againSay, doneExtra, why) => {
      const done = !!st.riskDone[key]; const tid = 'risk.row.' + id + '.' + action;
      return row(id, action, sev, word, text, done ? doneLabel : label, done ? 'quiet' : 'reversible', () => {
        if (st.riskDone[key]) { say(againSay); rerender(r, tid); return; }
        st.riskDone[key] = true; say(firstSay); rerender(r, tid);
      }, done ? doneExtra : null, why);
    };
    due.forEach((d) => items.push(row(d.id, 'open', 'required', 'Past review', d.text + ': past review date (review was ' + shortDate(d.reviewBy) + ').', 'Open', 'reversible', () => Proto.router.go(r.persona, 'close'), null,
      'An unreviewed decision stops applying at midnight of its review date and becomes a finding; neglect tightens, never loosens. Keep, Tighten or Retire it on Daily Close.')));
    if (!due.length) items.push(h('div', { class: 'dc-row' }, chip('clear', 'Nothing due'), h('span', { class: 'text', text: 'No decisions past their review date.' })));
    // Countdowns and counts are read against today and the practice's own records, so the list moves with them.
    const baaExpires = '2026-09-24';
    const baaLeft = days(S.tenant.today, baaExpires);
    const baaWord = baaLeft >= 0 ? plural(baaLeft, 'day') : 'Expired';
    items.push(standing('baa', 'baa-lab', 'renew', 'review', baaWord,
      'BAA: Ridge Dental Lab ' + (baaLeft >= 0 ? 'expires in ' + plural(baaLeft, 'day') : 'expired ' + plural(-baaLeft, 'day') + ' ago') + ' (' + shortDate(baaExpires) + ').',
      'Renew', 'Renewal sent', 'Renewal requested', 'Already requested today', 'Renewal requested today; the row stays until the countersigned copy is filed.',
      'A business associate agreement that lapses leaves PHI flowing to a vendor with no signed terms. The countdown reads the practice calendar against today.'));
    const withCred = new Set(table(S, 'credentials').filter((c) => c.userId && c.verifiedBy).map((c) => c.userId));
    const untrained = table(S, 'users').filter((u) => u.licence && !withCred.has(u.id)).length;
    items.push(standing('training', 'training', 'assign', 'review', 'Due',
      'Training due: ' + plural(untrained, 'clinical seat') + ' with no verified credential on file (practice).',
      'Assign', 'Assigned', 'Training assigned', 'Already assigned today', 'Assigned today; this row shows the practice count only.',
      'A clinical seat charts and records perio under its own licence, so a seat with no verified credential row is a finding. The count is practice-level; nobody is named here.'));
    const logDue = monthlyDue(S.tenant.today, 5);
    const ev = window.__events || [];
    const seen = plural(ev.filter((e) => e.kind === 'write').length, 'write') + ' and ' + plural(ev.filter((e) => e.kind === 'refusal').length, 'refusal');
    items.push(standing('log', 'logreview', 'start', 'review', 'Due ' + shortDate(logDue),
      'Monthly log review: due ' + shortDate(logDue) + '.',
      'Start', 'Opened', 'Audit log opened', 'Already opened today', 'Opened: ' + seen + ' this session, below; the chain head is verified nightly.',
      'The monthly review reads the audit log as sentences and checks the chain head; it falls due on the 5th of each month.'));
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

  // The confirm step and the typed PIN belong to the visit that made them: a hash change ends both (docs/01 principle 9).
  window.addEventListener('hashchange', () => { if (st) st.pin = ''; if (Proto.router.current().route !== 'close') { detachKeys(); if (st && st.closeStep === 'confirm') st.closeStep = 'idle'; } });

  Proto.screens.dailyclose = { render: renderClose, renderRisk, grade, overall, changedPairs, lateRows };
  Proto.screens.risk = { render: renderRisk };
  Proto.router.on('close', (r) => Proto.screens.dailyclose.render(r));
  Proto.router.on('risk', (r) => Proto.screens.risk.render(r));
})();
