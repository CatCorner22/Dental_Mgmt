/* Sign-in: the nine roles, the three preferences a person sets before they start (colour scheme, motion,
   privacy), and — behind one disclosure named for what it is — the test harness: device profile, the
   grayscale aid and the two simulations. Once someone is signed in these preferences live in Settings
   (topbar.settings) and follow their PIN; the copies here are the first-time defaults. */
(function () {
  const Proto = window.Proto; const { h, btn } = Proto.ui;
  Proto.screens = Proto.screens || {}; // signin.js loads before shell.js
  const ROLES = { frontdesk: 'Lands on the Board', biller: 'Lands on Money Desk', hygienist: 'Lands on Chairs', assistant: 'Lands on the Board', dentist: 'Lands on Exams to sign', surgeon: 'Lands on Exams to sign', owner: 'Lands on Daily Close', compliance: 'Lands on Practice risk', temp: 'Board with the first-shift rail' };
  // Nine roles in one group was one past the seven a person can hold at once; two named groups of five and four
  // are not. The front-desk coordinator stays first: it is the default persona and the first Tab stop.
  const ROLE_GROUPS = [['Office roles', ['frontdesk', 'biller', 'owner', 'compliance', 'temp']], ['Clinical roles', ['hygienist', 'assistant', 'dentist', 'surgeon']]];
  const root = document.documentElement;
  // The harness disclosure keeps its state across the repaints its own toggles cause; null until the first paint,
  // which opens it when a flag on the hash already set something inside it (the person is plainly testing).
  let harnessOpen = null;
  const osTheme = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  // No data-theme on <html> means the operating system answers (app.js applyPrefs stamps nothing for 'system').
  const themeIsSystem = () => !root.hasAttribute('data-theme');
  function useSystemTheme(P) { root.removeAttribute('data-theme'); P.theme = osTheme(); P.themePref = 'system'; }

  function render(r) {
    const P = window.__proto;
    let persona = P.persona && Proto.router.PERSONAS.includes(P.persona) ? P.persona : 'frontdesk';
    const afterHours = () => Proto.store.get().clock.afterHours;

    /* Who: the role is the whole label; where it lands is a line beneath, joined by aria-describedby, so the
       button reads "Hygienist", not "Hygienist Lands on Chairs". */
    const tiles = {};
    function tile(p) {
      const landId = 'signin-land-' + p;
      const b = btn(Proto.router.LABEL[p], { testid: 'signin.persona.' + p, pressed: persona === p, describedby: landId, onClick: () => { persona = p; P.set({ persona: p }); paint(); } });
      b.style.cssText = 'white-space: normal; width: 100%; text-align: center;';
      return h('div', { class: 'signin-role', style: 'display: flex; flex-direction: column; gap: var(--space-1);' }, b, h('span', { id: landId, class: 'small muted', text: ROLES[p] }));
    }
    function paint() {
      // replaceChildren throws the focused button away, so the keyboard landed on the body after every
      // choice. Put it back on the persona the person just picked.
      const had = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-testid');
      for (const [, ps] of ROLE_GROUPS) tiles[ps[0]].replaceChildren(...ps.map(tile));
      if (had && /^signin\.persona\./.test(had)) { const back = document.querySelector('[data-testid="signin.persona.' + persona + '"]'); if (back) back.focus(); }
    }
    const who = h('section', { class: 'stack', 'aria-labelledby': 'signin-who' },
      h('h2', { id: 'signin-who', text: 'Who are you today?' }),
      ...ROLE_GROUPS.map(([name, ps], i) => {
        const id = 'signin-who-' + i;
        tiles[ps[0]] = h('div', { class: 'signin-roles', style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--gap); align-items: start;' });
        return h('div', { role: 'group', 'aria-labelledby': id, style: 'display: flex; flex-direction: column; gap: var(--space-2);' }, h('h3', { id, class: 'small muted', text: name }), tiles[ps[0]]);
      }));
    paint();

    /* Before you start: three preferences, each under its own visible name. The two the operating system already
       answers show "System default" on their name until something is pressed here; Reset to defaults returns to it. */
    const opt = (label, testid, pressed, onClick) => btn(label, { testid, pressed, onClick });
    const seg = (id, ...kids) => h('div', { class: 'seg', role: 'group', 'aria-labelledby': id }, ...kids);
    const heading = (id, name, mark) => h('h3', { id, class: 'small muted' }, name, mark ? h('span', { style: 'font-weight: var(--weight-regular);', text: ' · System default' }) : null);
    const row = (id, name, mark, control) => h('div', { style: 'display: flex; flex-direction: column; gap: var(--space-2);' }, heading(id, name, mark), control);
    const rowsWrap = (...kids) => h('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--gap-group); align-items: flex-start;' }, ...kids);
    const system = themeIsSystem();
    const prefs = h('section', { class: 'stack', role: 'group', 'aria-labelledby': 'signin-prefs' },
      h('h2', { id: 'signin-prefs', text: 'Before you start' }),
      rowsWrap(
        row('signin-theme', 'Colour scheme', system, seg('signin-theme',
          opt('Light', 'signin.theme.light', !system && P.theme === 'light', () => { P.set({ theme: 'light' }); render(r); }),
          opt('Dark', 'signin.theme.dark', !system && P.theme === 'dark', () => { P.set({ theme: 'dark' }); render(r); }))),
        row('signin-motion', 'Motion', P.motion !== 'reduced',
          opt('Reduced motion', 'signin.motion', P.motion === 'reduced', () => { P.set({ motion: P.motion === 'reduced' ? 'auto' : 'reduced' }); render(r); })),
        row('signin-device-privacy', 'This device', false, opt('Privacy mode', 'signin.privacy', P.privacy, () => { P.set({ privacy: !P.privacy }); render(r); }))));
    const reset = h('div', { class: 'btnrow' }, btn('Reset to defaults', { testid: 'signin.reset', onClick: () => {
      useSystemTheme(P);
      P.set({ device: 'desk', motion: 'auto', grayscale: false, privacy: false, outage: false, afterHours: false });
      Proto.router.announce('Sign-in options reset to defaults');
      render(r);
    } }));

    /* The test harness: what the glass pretends to be and what is simulated. Closed unless a flag already set
       something inside it, so a person at work never meets these by default. */
    if (harnessOpen == null) harnessOpen = P.device !== 'desk' || !!P.grayscale || !!P.outage || !!afterHours();
    const summary = h('summary', { testid: 'signin.harness', text: (harnessOpen ? 'Hide' : 'Show') + ' the test harness' });
    // The body exists only while the disclosure is open. A closed <details> still gives its controls a layout box,
    // so a Tab-order count found seven controls the keyboard could never reach and read the wrap-around as a trap.
    const body = h('div', { class: 'stack', style: 'padding: var(--space-2) var(--space-2) 0;' });
    const fill = () => body.replaceChildren(
      h('p', { class: 'hint', text: 'For testing this prototype: which device the glass pretends to be, a colour-vision check and two simulations.' }),
      rowsWrap(
        row('signin-device', 'Device profile', false, seg('signin-device',
          ...['desk', 'operatory', 'shared', 'phone'].map((d) => opt(d[0].toUpperCase() + d.slice(1), 'signin.device.' + d, P.device === d, () => { P.set({ device: d }); render(r); })))),
        row('signin-sim', 'Aids and simulations', false, seg('signin-sim',
          opt('Grayscale', 'signin.grayscale', P.grayscale, () => { P.set({ grayscale: !P.grayscale }); render(r); }),
          opt('Simulate outage', 'signin.outage', P.outage, () => { P.set({ outage: !P.outage }); render(r); }),
          opt('After hours', 'signin.afterhours', afterHours(), () => { P.set({ afterHours: !afterHours() }); render(r); })))));
    if (harnessOpen) fill();
    // The harness is a different group from the sign-in task, so it stands a group's gap apart (CLT-proximity-ratio).
    const harness = h('details', { class: 'signin-harness', open: harnessOpen, style: 'margin-top: var(--space-5);' }, summary, body);
    harness.addEventListener('toggle', () => {
      harnessOpen = harness.open; summary.textContent = (harness.open ? 'Hide' : 'Show') + ' the test harness';
      if (harness.open) { if (!body.children.length) fill(); } else body.replaceChildren();
    });

    // Signing in is reversible: Sign out returns here with the persona still chosen, so it carries the
    // reversible identity. The irreversible identity belongs to Post, File, Save exam, Close day and Send.
    const go = btn('Open my home', { testid: 'signin.go', kind: 'reversible', onClick: () => { P.set({ persona }); location.hash = '#/' + persona + '/' + Proto.router.HOME[persona]; } });
    // An option toggle rebuilds the screen and takes the focused control with it; the keyboard goes back to that
    // control's replacement. On arrival nothing here is focused: the shell lands on the heading.
    const had = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-testid');
    Proto.screens.shell.mount(h('div', { class: 'signin' },
      h('div', null, h('h1', { text: 'Riverbend Dental' }), h('p', { class: 'muted', text: 'Prototype for the beta panel. Synthetic data, one tenant, three locations, today is Thursday 9/3/2026, 8:40 am.' })),
      who,
      prefs,
      h('div', { class: 'btnrow' }, go),
      h('p', { class: 'small muted', text: 'Role was set at provisioning. Your home is your work; nothing here is a dashboard.' }),
      harness,
      reset));
    const back = had && /^signin\./.test(had) ? document.querySelector('[data-testid="' + had + '"]') : null;
    if (back) back.focus();
  }
  Proto.screens.signin = { render };
  Proto.router.on('signin', render);
})();
