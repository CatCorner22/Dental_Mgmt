/* Sign-in: persona picker plus the test-harness options (theme, device profile, privacy, outage, grayscale, motion). */
(function () {
  const Proto = window.Proto; const { h, btn } = Proto.ui;
  const ROLES = { frontdesk: 'Lands on the Board', biller: 'Lands on Money Desk', hygienist: 'Lands on Chairs', dentist: 'Lands on Exams to sign', surgeon: 'Lands on Exams to sign', owner: 'Lands on Daily Close', compliance: 'Lands on Practice risk', temp: 'Board with the first-shift rail' };

  function render(r) {
    const P = window.__proto;
    let persona = P.persona && Proto.router.PERSONAS.includes(P.persona) ? P.persona : 'frontdesk';
    const list = h('div', { class: 'personas', role: 'radiogroup', 'aria-label': 'Who are you today?' });
    function paint() {
      list.replaceChildren(...Proto.router.PERSONAS.map((p) => btn([h('span', { text: Proto.router.LABEL[p] }), h('span', { class: 'role', text: ROLES[p] })], { testid: 'signin.persona.' + p, pressed: persona === p, onClick: () => { persona = p; paint(); } })));
    }
    paint();
    const opt = (label, testid, pressed, onClick) => btn(label, { testid, pressed, onClick });
    const opts = h('div', { class: 'btnrow' },
      opt('Light', 'signin.theme.light', P.theme === 'light', () => { P.set({ theme: 'light' }); render(r); }),
      opt('Dark', 'signin.theme.dark', P.theme === 'dark', () => { P.set({ theme: 'dark' }); render(r); }),
      h('span', { class: 'muted', text: '·' }),
      ...['desk', 'operatory', 'shared', 'phone'].map((d) => opt(d[0].toUpperCase() + d.slice(1), 'signin.device.' + d, P.device === d, () => { P.set({ device: d }); render(r); })),
      h('span', { class: 'muted', text: '·' }),
      opt('Reduced motion', 'signin.motion', P.motion === 'reduced', () => { P.set({ motion: P.motion === 'reduced' ? 'auto' : 'reduced' }); render(r); }),
      opt('Grayscale', 'signin.grayscale', P.grayscale, () => { P.set({ grayscale: !P.grayscale }); render(r); }),
      opt('Privacy mode', 'signin.privacy', P.privacy, () => { P.set({ privacy: !P.privacy }); render(r); }),
      opt('Simulate outage', 'signin.outage', P.outage, () => { P.set({ outage: !P.outage }); render(r); }),
      opt('After hours', 'signin.afterhours', Proto.store.get().clock.afterHours, () => { P.set({ afterHours: !Proto.store.get().clock.afterHours }); render(r); }),
    );
    const go = btn('Open my home', { testid: 'signin.go', kind: 'irreversible', onClick: () => { P.set({ persona }); location.hash = '#/' + persona + '/' + Proto.router.HOME[persona]; } });
    Proto.screens.shell.mount(h('div', { class: 'signin' },
      h('div', null, h('h1', { text: 'Riverbend Dental' }), h('p', { class: 'muted', text: 'Prototype for the beta panel. Synthetic data, one tenant, three locations, today is Thursday 9/3/2026, 8:40 am.' })),
      h('h2', { text: 'Who are you today?' }), list,
      h('h2', { text: 'Device and display' }), opts,
      h('div', { class: 'btnrow' }, go),
      h('p', { class: 'small muted', text: 'Role was set at provisioning. Your home is your work; nothing here is a dashboard.' })));
    go.focus();
  }
  Proto.screens.signin = { render };
  Proto.router.on('signin', render);
})();
