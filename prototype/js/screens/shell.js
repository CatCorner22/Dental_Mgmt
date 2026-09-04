/* Shell: top bar, Andon slot, author chip + PIN pad, role-derived nav, temp first-shift rail, canvas mount.
   Screen modules register themselves as Proto.screens.<name> = { render(r) } and call
   Proto.router.on('<route>', (r) => Proto.screens.<name>.render(r)). The canvas is #canvas. */
(function () {
  const Proto = window.Proto; const { h, btn, chip } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const NAV = {
    frontdesk: [['board', 'Board'], ['money', 'Money Desk'], ['roles', 'Roles']],
    temp: [['board', 'Board']],
    biller: [['money', 'Money Desk'], ['board', 'Board'], ['close', 'Daily Close'], ['roles', 'Roles']],
    hygienist: [['chairs', 'Chairs'], ['board', 'Board']],
    dentist: [['exams', 'Exams to sign'], ['chairs', 'Chairs'], ['board', 'Board']],
    surgeon: [['exams', 'Exams to sign'], ['board', 'Board']],
    owner: [['close', 'Daily Close'], ['money', 'Money Desk'], ['board', 'Board'], ['roles', 'Roles'], ['risk', 'Practice risk']],
    compliance: [['risk', 'Practice risk'], ['roles', 'Roles'], ['close', 'Daily Close']],
  };

  function canvas() { return document.getElementById('canvas'); }
  function mount(node) { const c = canvas(); c.replaceChildren(node); return c; }

  function renderTopbar(r) {
    const top = document.getElementById('topbar');
    const P = window.__proto; const S = Proto.store.get();
    if (!r.persona) { top.replaceChildren(h('span', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'Riverbend Dental'), h('span', { class: 'spacer' }), btn(P.theme === 'dark' ? 'Light theme' : 'Dark theme', { testid: 'topbar.theme', onClick: () => { P.set({ theme: P.theme === 'dark' ? 'light' : 'dark' }); renderTopbar(r); } })); return; }
    const u = Proto.store.currentUser();
    const loc = S.locations[0];
    const nav = h('nav', { 'aria-label': 'Primary' }, ...(NAV[r.persona] || NAV.frontdesk).map(([route, label]) => btn(label, { testid: 'nav.' + route, onClick: () => Proto.router.go(r.persona, route), class: r.route === route ? 'current' : '' })));
    nav.querySelectorAll('button').forEach((b) => { if (b.classList.contains('current')) b.setAttribute('aria-current', 'page'); });
    const authorChip = h('button', { type: 'button', class: 'authorchip', testid: 'topbar.author', 'aria-label': 'Who is charting: ' + u.name + (u.licence ? ', ' + u.licence : '') + '. Switch author', onClick: () => openPinPad(r) }, h('span', { text: (P.device === 'shared' || P.device === 'operatory') ? (Proto.ui.initials(u.name) + (u.licence ? ' · ' + u.licence : '')) : (u.short || u.name) }));
    top.replaceChildren(
      h('span', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'Riverbend'),
      btn(loc.short, { testid: 'topbar.location', ariaLabel: 'Location: ' + loc.name + '. Switch location', onClick: () => Proto.router.announce('Location switching is out of scope for the prototype') }),
      btn('Search  ⌘K', { testid: 'topbar.search', ariaLabel: 'Search patients, claims, and actions (Ctrl or Cmd K)', onClick: () => Proto.screens.palette.open(r) }),
      nav,
      h('span', { class: 'spacer' }),
      authorChip,
      btn(P.privacy ? 'Privacy on' : 'Privacy', { testid: 'topbar.privacy', pressed: P.privacy, ariaLabel: 'Privacy mode: hide patient names on operatory glass', onClick: () => { P.set({ privacy: !P.privacy }); Proto.screens.shell.render(r); Proto.router.render(); } }),
      btn(P.theme === 'dark' ? 'Light' : 'Dark', { testid: 'topbar.theme', ariaLabel: 'Switch to ' + (P.theme === 'dark' ? 'light' : 'dark') + ' theme', onClick: () => { P.set({ theme: P.theme === 'dark' ? 'light' : 'dark' }); renderTopbar(r); } }),
      btn('Sign out', { testid: 'topbar.signout', onClick: () => { location.hash = '#/signin'; } }),
    );
  }

  function renderAndon(r) {
    const a = document.getElementById('andon'); const P = window.__proto;
    if (!r.persona) { a.replaceChildren(); return; }
    if (P.outage) {
      a.replaceChildren(chip('required', 'Server unreachable', {}), h('span', { class: 'grow', text: 'Showing the Board from 7:58 am · reads only, no postings · incident INC-2093' }), btn('Support line', { testid: 'andon.control', kind: 'reversible', onClick: () => Proto.router.announce('Support: 615-555-0100, answered 7 am to 6 pm Central') }));
      return;
    }
    const S = Proto.store.get();
    const pending = S.approvals.filter((x) => x.status === 'pending' && Proto.store.currentUser().entitlements.includes('approve_second') && x.requestedById !== Proto.store.currentUser().id);
    if (pending.length) { a.replaceChildren(chip('review', pending.length + ' approval' + (pending.length > 1 ? 's' : '') + ' waiting', {}), h('span', { class: 'grow', text: pending[0].frozenSentence }), btn('Open approvals', { testid: 'andon.control', kind: 'reversible', onClick: () => { location.hash = '#/phone/approvals'; } })); return; }
    a.replaceChildren();
  }

  function openPinPad(r) {
    const P = window.__proto; const S = Proto.store.get();
    let digits = '';
    const dots = h('div', { class: 'pindots', 'aria-live': 'polite', text: '' });
    const status = h('p', { class: 'hint', text: P.device === 'desk' ? 'This desk is not shared: switching author signs you out and in as the other person.' : 'Enter the other person\'s PIN. Their session opens on this page; yours is revoked and local drafts are wiped after autosave.' });
    let close;
    const refusalSlot = h('div', { class: 'pin-refusal' });
    function showRefusal(v) { refusalSlot.replaceChildren(Proto.ui.refusal(v)); }
    function submit() {
      const who = S.users.find((u) => u.pin === digits);
      digits = ''; dots.textContent = '';
      if (!who) {
        showRefusal({ code: 'pin_no_match', verb: 'PIN did not match — try again', control: 'Clear and retype', onControl: () => { const k = pad.querySelector('[data-testid="pin.key.1"]'); if (k) k.focus(); }, why: 'Six digits at most. Three misses lock this device for five minutes and raise a finding for the practice, never for the person.', severity: 'required' });
        return;
      }
      const persona = Object.entries(S.personaUser).find(([, uid]) => uid === who.id);
      if (!persona) {
        // No chart persona for this account in the prototype: refuse rather than write a session that changes nothing.
        showRefusal({ code: 'no_chart_session', verb: who.short + ' has no charting session here', control: 'Keep current author', onControl: () => close(), why: 'This account can approve and post but does not chart, so there is nothing for it to open on this screen. The author stays as it was and nothing was written.', severity: 'info' });
        return;
      }
      Proto.events.write('sessions', 'sess-' + who.id);
      close();
      const p = persona[0]; P.set({ persona: p });
      location.hash = '#/' + p + '/' + (r.route === 'signin' ? Proto.router.HOME[p] : r.route) + (r.id ? '/' + r.id : '');
      Proto.router.announce('Now charting as ' + who.name);
    }
    const pad = h('div', { class: 'pinpad' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => btn(String(d), { testid: 'pin.key.' + d, onClick: () => { if (digits.length < 6) { digits += d; dots.textContent = '•'.repeat(digits.length); } } })), btn('⌫', { testid: 'pin.backspace', ariaLabel: 'Backspace', onClick: () => { digits = digits.slice(0, -1); dots.textContent = '•'.repeat(digits.length); } }), btn('0', { testid: 'pin.key.0', onClick: () => { if (digits.length < 6) { digits += '0'; dots.textContent = '•'.repeat(digits.length); } } }), btn('Go', { testid: 'pin.submit', kind: 'irreversible', onClick: submit }));
    close = Proto.ui.dialog(h('div', { class: 'stack' }, h('h2', { text: 'Who is charting?' }), status, refusalSlot, dots, pad, btn('Cancel', { testid: 'pin.cancel', onClick: () => close() })), { label: 'Switch author', focus: '[data-testid="pin.key.1"]' });
  }

  function renderRail1(r) {
    // temp first-shift rail: chips retire on the temp's own events
    let bar = document.getElementById('rail1');
    if (r.persona !== 'temp') { if (bar) bar.remove(); return; }
    const S = Proto.store.get(); const steps = Proto.store.railSteps();
    if (!bar) { bar = h('div', { class: 'rail1', id: 'rail1', 'aria-label': 'Your first shift' }); document.getElementById('andon').after(bar); }
    if (S.rail1Collapsed) { bar.replaceChildren(btn('Show first-shift steps', { testid: 'rail1.toggle', onClick: () => { S.rail1Collapsed = false; renderRail1(r); } })); return; }
    bar.replaceChildren(h('span', { class: 'small muted', text: 'Your first shift:' }), ...steps.map(([code, label], i) => { const retired = !!Proto.store.railStateFor()[code]; return btn(retired ? label + ' ✓' : label, { testid: 'rail1.chip.' + i, dataset: { retired: retired ? '1' : '0' }, ariaLabel: label + (retired ? ', done' : ', show me'), onClick: () => pulseFor(code, r) }); }), btn('Hide', { testid: 'rail1.toggle', onClick: () => { S.rail1Collapsed = true; renderRail1(r); } }));
  }
  function pulseFor(code, r) {
    const map = { arrive: '[data-testid$=".arrive"]', seat: '[data-testid$=".seat"]', checkout: '[data-testid$=".checkout"]', payment: '[data-testid="checkout.post"]', find: '[data-testid="topbar.search"]', perio: '[data-testid$=".perio"]', save: '[data-testid="perio.save"]', tag: '[data-testid="perio.tag.add"]', ready: '[data-testid$=".ready"]' };
    const el = document.querySelector(map[code]);
    const verb = { arrive: 'Tap Arrive on the first card', seat: 'Seat the arrived patient', checkout: 'Open Checkout from the card', payment: 'Post after choosing a tender', find: 'Type three letters of a name', perio: 'Tap Perio on your first card', save: 'Save the exam', tag: 'Tag a tooth for the dentist', ready: 'Mark ready for exam' }[code];
    if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); el.scrollIntoView({ block: 'center' }); Proto.router.announce(verb); }
    else Proto.router.announce(code === 'checkout' || code === 'payment' ? 'Nothing to check out yet' : 'Nothing to do for this step yet');
  }

  Proto.screens.shell = {
    render(r) { renderTopbar(r); renderAndon(r); renderRail1(r); document.getElementById('rail').hidden = !Proto.screens.rail || !Proto.screens.rail.isOpen(); },
    mount, canvas, openPinPad, refreshAndon: renderAndon, refreshRail1: renderRail1,
  };

  Proto.router.on('notfound', (r) => mount(h('div', { class: 'stack' }, h('h1', { text: 'Nothing here' }), btn('Back to home', { testid: 'notfound.home', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) }))));

  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) { const r = Proto.router.current(); if (r.persona) { ev.preventDefault(); Proto.screens.palette.open(r); } }
  });
})();
