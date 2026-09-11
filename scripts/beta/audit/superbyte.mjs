// SuperByte: the observe-only note glass. Every check here measures the promise the screen makes in its own
// words: nothing under the fold, nothing typed into the pioneer, nothing rotating on its own, one draft per
// author, language-only rewrites, and a PHI gate that runs before any reading is formed.
export default ({ ctx, go, hop, click, txt, rec }) => {
  const seed = async (p, encId, assessment, plan) => p.evaluate(([id, a, pl]) => { const x = Proto.screens.encounter.state(id); x.note.assessment = a; x.note.plan = pl; return true; }, [encId, assessment, plan]);
  const DRAFT_A = 'Caries #30DO confirmed clinically and on x-ray; asymptomatic; vitality normal. Pt reports no pain. BWX taken. PA also taken. Small abcess noted.';
  const DRAFT_P = 'Composite #30 DO today under local; postoperative instructions given. 1 carpule lidocaine 2% w/ epi given. Pt tolerated well. Crown was placed. Amoxicilin 500 mg TID x7d. Referred to Dr. Sato for extraction #17.';
  const open = async (p, persona, encId) => { await go(p, '#/' + persona + '/encounter/' + encId); await seed(p, encId, DRAFT_A, DRAFT_P); await hop(p, '#/' + persona + '/superbyte/' + encId); await p.waitForTimeout(150); };
  const fit = (p) => p.evaluate(() => {
    const c = document.getElementById('canvas');
    return { page: document.scrollingElement.scrollHeight - innerHeight, canvas: c.scrollHeight - c.clientHeight, canvasX: c.scrollWidth - c.clientWidth,
      cols: [...document.querySelectorAll('.sb-col')].map((el) => el.scrollHeight - el.clientHeight) };
  });
  const pinSwitch = async (p, digits) => { if (!(await click(p, 'topbar.author'))) return false; for (const d of String(digits)) await click(p, 'pin.key.' + d); await click(p, 'pin.submit'); await p.waitForTimeout(220); return true; };

  return {
    async 'U-sb-1'(b) {
      const out = {};
      for (const [w, h] of [[1280, 800], [1024, 768], [1366, 768], [1920, 1080]]) {
        const { c, p, errs } = await ctx(b, w, h);
        try { await open(p, 'dentist', 'enc-9002'); out[w + 'x' + h] = { ...(await fit(p)), errs }; } finally { await c.close(); }
      }
      const over = Object.values(out).some((m) => m.page > 0 || m.canvas > 0 || m.canvasX > 0 || m.cols.length !== 3 || m.cols.some((d) => d > 0) || m.errs.length);
      rec('U-sb-1', 'With a full two-field draft the SuperByte glass needs page or column scrolling on a 1024×768 tablet or a 1280×800 laptop',
        'SuperByte — the user sees everything without scrolling (task brief); .sb-page fits the canvas', over, out);
    },

    async 'U-sb-2'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await open(p, 'dentist', 'enc-9002');
        const r = await p.evaluate(() => {
          const panel = document.querySelector('[data-testid="superbyte.panel"]');
          const inputs = panel.querySelectorAll('input, textarea, select, [contenteditable="true"]').length;
          const rating = [...panel.querySelectorAll('button')].filter((x) => /rate|thumb|helpful|feedback|copy|insert|use this|prompt|ask/i.test(x.textContent + ' ' + (x.getAttribute('aria-label') || ''))).length;
          const ev = new Event('copy', { bubbles: true, cancelable: true }); panel.querySelector('.sb-say, .sb-status, p').dispatchEvent(ev);
          const sel = getComputedStyle(panel).userSelect || getComputedStyle(panel).webkitUserSelect;
          return { inputs, rating, copyPrevented: ev.defaultPrevented, sel, buttons: [...panel.querySelectorAll('button')].map((x) => x.textContent.trim()) };
        });
        rec('U-sb-2', 'The SuperByte panel takes text, offers a rating or feedback control, or lets its wording be copied into the note',
          'Smile Notes ByteStar design — one-way, observe-only: no prompt, rate, copy or feedback',
          r.inputs > 0 || r.rating > 0 || !r.copyPrevented || r.sel !== 'none', r);
      } finally { await c.close(); }
    },

    async 'U-sb-3'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await open(p, 'dentist', 'enc-9002');
        const first = await txt(p, 'superbyte.reading');
        await p.waitForTimeout(1600);
        const still = await txt(p, 'superbyte.reading');
        const hasNext = await click(p, 'superbyte.reading.next');
        const second = await txt(p, 'superbyte.reading');
        await click(p, 'superbyte.reading.prev');
        const back = await txt(p, 'superbyte.reading');
        const focused = await p.evaluate(() => (document.activeElement || {}).dataset && document.activeElement.dataset.testid);
        rec('U-sb-3', 'Readings rotate on their own, or Previous/Next fail to pace them and keep focus',
          'Smile Notes instrument — user-paced, never auto-rotating; focus survives a re-render (A11y)',
          first !== still || !hasNext || second === first || back !== first || focused !== 'superbyte.reading.prev', { first, still, second, back, focused });
      } finally { await c.close(); }
    },

    async 'U-sb-4'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await go(p, '#/dentist/superbyte/enc-9002');
        await p.fill('[data-testid="superbyte.note.field.assessment"]', 'Typed on the SuperByte glass: caries #30 DO.');
        await p.waitForTimeout(150);
        const live = await txt(p, 'superbyte.status');
        await hop(p, '#/dentist/encounter/enc-9002');
        const enc = await p.$eval('[data-testid="enc.note.field.assessment"]', (e) => e.value).catch(() => null);
        rec('U-sb-4', 'Text typed on the SuperByte glass is a second draft: the Encounter note does not show it',
          'CONTRACTS B9 — one local draft per author; SuperByte reads the Encounter\'s own note',
          enc !== 'Typed on the SuperByte glass: caries #30 DO.' || !live, { enc, live });
      } finally { await c.close(); }
    },

    async 'U-sb-5'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await open(p, 'dentist', 'enc-9002');
        const unit = await p.evaluate(() => {
          const s = Proto.notes.standardize('Pt has abcess #30DO seen on x-ray. Pt tolerated well. Amoxicilin 500 mg, .5 mg, 1.0 mg qd. BWX read by Pt.');
          return { text: s.text, flags: s.flags.map((f) => f.kind) };
        });
        // Punctuation and sentence case survive a rewrite: "qd." keeps its full stop, "BWX" opening a sentence takes a capital.
        const shape = /daily\. Bitewing radiographs read by patient\.$/.test(unit.text);
        // Keep "Pt" as typed, apply the rest: the kept word survives, everything else standardizes.
        const keepIdx = await p.evaluate(() => [...document.querySelectorAll('.sb-wordrow')].findIndex((r) => (r.querySelector('.sb-from') || {}).textContent === 'Pt'));
        if (keepIdx >= 0) await click(p, 'superbyte.wording.' + keepIdx + '.keep');
        const applied = await click(p, 'superbyte.wording.apply');
        const after = await p.evaluate(() => { const x = Proto.screens.encounter.state('enc-9002').note; return x.assessment + '\n' + x.plan; });
        const bad = !/abscess/.test(unit.text) || !/radiograph/.test(unit.text) || !/#30 DO/.test(unit.text) || !/0\.5 mg/.test(unit.text) || !/\b1 mg\b/.test(unit.text) || !/daily/.test(unit.text)
          || /tolerated well/.test(unit.text) === false || /Amoxicilin/.test(unit.text) === false
          || !unit.flags.includes('medication-spelling') || !unit.flags.includes('vague-phrase') || !shape
          || !applied || (keepIdx >= 0 && !/\bPt\b/.test(after)) || /x-ray|abcess|#30DO/.test(after) || !/\. Bitewing radiographs taken\./.test(after) || !/tolerated well/.test(after) || !/Amoxicilin/.test(after);
        rec('U-sb-5', 'The standardizer rewrites a clinical claim or a medication spelling, or Apply ignores a "Keep as typed" choice',
          'ADA / ISMP — language-only rewrites; medication names and vague phrases are flagged, never guessed',
          bad, { unit, shape, keepIdx, applied, after });
      } finally { await c.close(); }
    },

    async 'U-sb-6'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await go(p, '#/dentist/encounter/enc-9002');
        const name = await p.evaluate(() => Proto.store.patient(Proto.store.encounter('enc-9002').patientId).name);
        await seed(p, 'enc-9002', 'Theo Brandt, DOB 11/2/1990, phone 615-555-0142, MRN 44812. Pt reports no pain. BWX taken; no caries seen.', 'Prophy completed. OHI given. Patient consented to treatment plan. RTC 6 months.');
        await hop(p, '#/dentist/superbyte/enc-9002'); await p.waitForTimeout(150);
        const phi = await txt(p, 'superbyte.phi');
        const readings = await p.evaluate(() => { const out = []; const nxt = document.querySelector('[data-testid="superbyte.reading.next"]'); for (let i = 0; i < 4; i++) { out.push((document.querySelector('[data-testid="superbyte.reading"]') || {}).textContent || ''); if (nxt) nxt.click(); } return out; });
        const panel = await p.$eval('[data-testid="superbyte.panel"]', (e) => e.textContent);
        const leak = readings.some((t) => t.includes('Brandt') || t.includes('11/2/1990') || t.includes('555-0142')) || panel.includes('Brandt') || panel.includes('0142') || panel.includes('44812');
        rec('U-sb-6', 'Patient identifiers pass the PHI gate: the pioneer\'s panel or a reading repeats the name, DOB, phone or MRN',
          'Smile Notes pipeline — PHI gate before retrieval; HIPAA minimum necessary',
          leak || !/name/.test(phi || '') || !/phone/.test(phi || '') || !/date/.test(phi || ''), { name, phi, readings, leak });
      } finally { await c.close(); }
    },

    async 'U-sb-7'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await go(p, '#/dentist/superbyte/enc-9006');
        const r = await p.evaluate(() => ({
          frozen: !!document.querySelector('[data-testid="superbyte.note.frozen"]'),
          fields: document.querySelectorAll('textarea.sb-field').length,
          apply: !!document.querySelector('[data-testid="superbyte.wording.apply"]'),
          keeps: document.querySelectorAll('[data-testid$=".keep"]').length,
          head: (document.querySelector('.sb-head') || {}).textContent || '' }));
        rec('U-sb-7', 'A filed note still shows editable fields or an Apply control on the SuperByte glass',
          'C3 — filed text is frozen; corrections are addenda',
          !r.frozen || r.fields > 0 || r.apply || r.keeps > 0 || !/filed/.test(r.head), r);
      } finally { await c.close(); }
    },

    async 'U-sb-8'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await go(p, '#/dentist/superbyte/enc-9002');
        await p.fill('[data-testid="superbyte.note.field.assessment"]', 'Dr. Kim\'s private draft about #30.');
        await p.waitForTimeout(120);
        const switched = await pinSwitch(p, '1111');
        const r = await p.evaluate(() => ({ user: Proto.store.currentUser().name,
          value: (document.querySelector('[data-testid="superbyte.note.field.assessment"]') || {}).value || '',
          ro: (document.querySelector('[data-testid="superbyte.note.field.assessment"]') || {}).readOnly }));
        rec('U-sb-8', 'Switching author by PIN hands Bree the dentist\'s SuperByte draft',
          'CONTRACTS B9 — local drafts are per author',
          !switched || r.user !== 'Bree Lawson' || /private draft/.test(r.value), r);
      } finally { await c.close(); }
    },

    async 'U-sb-9'(b) {
      const { c, p, errs } = await ctx(b, 1280, 800);
      try {
        await go(p, '#/dentist/superbyte/enc-nope');
        const r = await p.evaluate(() => ({ text: document.getElementById('canvas').textContent, home: !!document.querySelector('[data-testid="notfound.home"]'), panel: !!document.querySelector('[data-testid="superbyte.panel"]') }));
        rec('U-sb-9', 'An unknown encounter id on the SuperByte route throws or renders an empty glass instead of the standard Nothing here',
          'C4 — every route with a bad id lands on Nothing here with a way home',
          errs.length > 0 || !/Nothing here/.test(r.text) || !r.home || r.panel, { errs, home: r.home, panel: r.panel });
      } finally { await c.close(); }
    },

    async 'U-sb-10'(b) {
      const { c, p } = await ctx(b, 1280, 800);
      try {
        await open(p, 'hygienist', 'enc-9001');
        const r = await p.evaluate(() => ({
          ro: [...document.querySelectorAll('textarea.sb-field')].map((t) => t.readOnly),
          apply: !!document.querySelector('[data-testid="superbyte.wording.apply"]'),
          status: (document.querySelector('[data-testid="superbyte.status"]') || {}).textContent || '',
          rails: document.querySelectorAll('.sb-rail').length,
          user: Proto.store.currentUser().role }));
        rec('U-sb-10', 'A hygienist can rewrite the dentist\'s note from the SuperByte glass, or gets no readings at all',
          'Roles — hygienists read the pioneer; only a dentist-like author applies rewrites',
          r.user !== 'hygienist' || r.ro.length !== 2 || r.ro.some((x) => !x) || r.apply || /Waiting/.test(r.status) || r.rails !== 5, r);
      } finally { await c.close(); }
    },
  };
};
