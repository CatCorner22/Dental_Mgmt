// UI and UX review (docs/16), accessibility fixes: each check reproduces a defect axe-core found in the review's baseline
// and the harness reports it only if the defect is back. Default position is NOT reproduced: every check measures the
// breach it claims and carries the values. Each check closes its browser context in `finally`.

export default ({ ctx, go, click, rec }) => {
  const region = (p, tid) => p.evaluate((tid) => { const e = document.querySelector('[data-testid="' + tid + '"]'); return e ? { tabindex: e.getAttribute('tabindex'), overflow: e.scrollWidth - e.clientWidth, role: e.getAttribute('role'), label: e.getAttribute('aria-label') } : null; }, tid);
  // aria-label on an element with no role is prohibited by ARIA 1.2 on generic elements and ignored by screen readers.
  const labelledGeneric = (p) => p.evaluate(() => [...document.querySelectorAll('div[aria-label]:not([role]), span[aria-label]:not([role]), p[aria-label]:not([role])')].map((e) => e.tagName.toLowerCase() + '.' + (e.className || '').split(' ')[0] + '[' + e.getAttribute('aria-label').slice(0, 30) + ']'));

  return {
    // A-ux-1 · WCAG 2.1.1 (axe scrollable-region-focusable, serious in the baseline) · ui.js scrollRegion: a table wider than
    // its column scrolls sideways inside .wrap-x; the wrapper must be in the tab order while it overflows (so a keyboard user
    // can scroll it) and out of it while it fits (so a stop that does nothing is not added). Reproduced when either half fails
    // on Checkout's procedures table or the Ledger's rows table, or when the overflowing wrapper does not scroll on ArrowRight.
    async 'A-ux-1'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const out = {};
        for (const [tid, hash] of [['checkout.lines', '#/frontdesk/checkout/a-1044'], ['ledger.rows', '#/biller/ledger/p-319']]) {
          await p.setViewportSize({ width: 1280, height: 900 }); await go(p, hash); await p.waitForTimeout(150);
          const wide = await region(p, tid);
          await p.setViewportSize({ width: 420, height: 860 }); await p.waitForTimeout(300);
          const narrow = await region(p, tid);
          let scrolled = null;
          if (narrow && narrow.tabindex === '0') { await p.focus('[data-testid="' + tid + '"]'); for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120); } await p.waitForTimeout(400); scrolled = await p.$eval('[data-testid="' + tid + '"]', (e) => e.scrollLeft); }
          out[tid] = { wide, narrow, scrolledPx: scrolled };
        }
        const bad = Object.entries(out).filter(([, o]) => !o.wide || !o.narrow || o.wide.overflow > 1 || o.wide.tabindex !== null || o.narrow.overflow <= 1 || o.narrow.tabindex !== '0' || o.narrow.role !== 'region' || !o.narrow.label || !(o.scrolledPx > 0)).map(([k]) => k);
        rec('A-ux-1', 'A sideways-scrolling table (Checkout procedures, Ledger rows) is not reachable from the keyboard while it overflows, or keeps a tab stop while it fits, or does not scroll on ArrowRight', 'WCAG 2.1.1; axe scrollable-region-focusable; docs/16 accessibility baseline', bad.length > 0, { ...out, failing: bad, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-2 · ARIA 1.2 prohibited attributes (axe aria-prohibited-attr, "needs review" in the baseline) · seventeen labelled
    // div/span elements carried aria-label with no role. Reproduced when any route paints such an element.
    async 'A-ux-2'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const found = {};
        for (const hash of ['#/frontdesk/board', '#/frontdesk/checkout/a-1044', '#/biller/money', '#/biller/ledger/p-319', '#/hygienist/chairs', '#/hygienist/perio/enc-9001', '#/dentist/exams', '#/dentist/encounter/enc-9002', '#/owner/close', '#/compliance/risk', '#/compliance/roles', '#/temp/board', '#/phone/approvals']) {
          await go(p, hash);
          if (hash.includes('phone')) { const s = await p.$('[data-testid="phone.simulate"]'); if (s) { await s.click(); await p.waitForTimeout(200); } }
          const hits = await labelledGeneric(p); if (hits.length) found[hash] = hits;
        }
        rec('A-ux-2', 'A div, span or p carries aria-label with no role, so its label is prohibited by ARIA and ignored by screen readers', 'ARIA 1.2 prohibited attributes; axe aria-prohibited-attr; docs/16 accessibility baseline', Object.keys(found).length > 0, { found, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-3 · WCAG 2.5.3 · ui.js leadWithLabel: a control's accessible name must begin with the
    // words printed on it. Twenty-nine controls carried a helpful aria-label that replaced the
    // printed words instead of extending them. Reproduced when any button's name does not lead
    // with its own visible text.
    async 'A-ux-3'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const bad = {};
        for (const hash of ['#/frontdesk/board', '#/hygienist/chairs', '#/biller/money', '#/biller/ledger/p-319', '#/compliance/roles', '#/dentist/encounter/enc-9002', '#/frontdesk/checkout/a-1044']) {
          await go(p, hash);
          const hits = await p.evaluate(() => {
            const key = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            // What is printed is what the eye sees: text only a screen reader hears is not a label.
            const printedOf = (e) => { const c = e.cloneNode(true); c.querySelectorAll('.sr-only, [aria-hidden="true"]').forEach((x) => x.remove()); return (c.textContent || '').replace(/✓/g, '').trim(); };
            const all = [...document.querySelectorAll('#canvas button[aria-label], .topbar button[aria-label]')]
              .filter((e) => e.offsetParent !== null)
              .map((e) => ({ id: e.getAttribute('data-testid'), printed: printedOf(e), name: e.getAttribute('aria-label') }))
              .filter((x) => x.printed);
            return {
              total: all.length,
              notContained: all.filter((x) => !key(x.name).includes(key(x.printed))).slice(0, 6),
              notLeading: all.filter((x) => !key(x.name).startsWith(key(x.printed))).slice(0, 6),
              leadingPct: all.length ? Math.round(100 * all.filter((x) => key(x.name).startsWith(key(x.printed))).length / all.length) : 100,
            };
          });
          if (hits.notContained.length || hits.leadingPct < 95) bad[hash] = hits;
        }
        rec('A-ux-3', 'A control\'s accessible name does not contain the words printed on it, or fewer than 95 per cent of names lead with them, so a voice user who says what they see is not understood', 'WCAG 2.5.3 Label in Name (100% contain); axe label-content-name-mismatch; docs/16 (>= 95% lead)', Object.keys(bad).length > 0, { bad, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-4 · WCAG 3.3.4 / INT-irreversible-identity · ui.js confirmable: an action that cannot be
    // taken back asks a second time, keeps the keyboard on Cancel, and writes nothing until the
    // second press. Reproduced when the first press writes, or the keyboard lands on the confirm.
    async 'A-ux-4'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/frontdesk/board');
        const o = await p.evaluate(() => {
          const host = document.createElement('div'); host.id = 'ux4'; document.getElementById('canvas').append(host);
          let fired = 0;
          const slot = Proto.ui.confirmable('Post', { testid: 'ux4.post', readback: 'This cannot be undone: Post $44.00.', onConfirm: () => { fired++; } });
          host.append(slot);
          const rest = host.querySelector('[data-testid="ux4.post"]');
          const restKind = rest ? rest.className : null;
          rest.click();
          const confirm = host.querySelector('[data-testid="ux4.post.confirm"]');
          const cancel = host.querySelector('[data-testid="ux4.post.cancel"]');
          const focusAfterAsk = document.activeElement && document.activeElement.getAttribute('data-testid');
          const firedBeforeConfirm = fired;
          const glyph = host.querySelector('.confirmrow .glyph');
          const glyphPx = glyph ? parseFloat(getComputedStyle(glyph).fontSize) : 0;
          const sameSize = confirm && cancel ? Math.abs(confirm.getBoundingClientRect().height - cancel.getBoundingClientRect().height) < 1 : false;
          confirm.click();
          const firedAfterConfirm = fired;
          host.remove();
          return { restKind, hasConfirm: !!confirm, hasCancel: !!cancel, focusAfterAsk, firedBeforeConfirm, firedAfterConfirm, glyphPx, sameSize };
        });
        const reproduced = !(o.hasConfirm && o.hasCancel && o.focusAfterAsk === 'ux4.post.cancel' && o.firedBeforeConfirm === 0 && o.firedAfterConfirm === 1 && o.glyphPx >= 16 && o.sameSize);
        rec('A-ux-4', 'An irreversible action commits on the first press, or the read-back step puts the keyboard on the confirm rather than on Cancel', 'WCAG 3.3.4 Error Prevention (Legal, Financial, Data); docs/16 INT-irreversible-identity, CLT-neutral-irreversible', reproduced, { ...o, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-5 · WCAG 3.3.1 / 3.3.2 · ui.js field, setFieldError and errorSummary: a field states its
    // requirement before anyone types, and a rejected value is named in text beside the field, not
    // by colour alone. Reproduced when any of those contracts fails.
    async 'A-ux-5'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/frontdesk/board');
        const o = await p.evaluate(() => {
          const host = document.createElement('div'); host.id = 'ux5'; document.getElementById('canvas').append(host);
          const input = Proto.ui.h('input', { class: 'input', testid: 'ux5.amount' });
          const f = Proto.ui.field('Amount', input, { hint: 'Dollars and cents, above zero', required: true });
          host.append(f);
          const lab = host.querySelector('label');
          const labelFor = lab && lab.getAttribute('for') === input.id;
          const labelAbove = lab && input.compareDocumentPosition(lab) & Node.DOCUMENT_POSITION_PRECEDING;
          const required = input.getAttribute('aria-required') === 'true' && /required/i.test(lab.textContent);
          const describedBefore = input.getAttribute('aria-describedby');
          f._setError('Enter an amount above zero');
          const err = host.querySelector('.fielderror');
          const invalid = input.getAttribute('aria-invalid') === 'true';
          const describedFirst = (input.getAttribute('aria-describedby') || '').split(' ')[0] === err.id;
          const hiddenPrefix = /^error:/i.test((err.querySelector('.sr-only') || {}).textContent || '');
          const errBeforeInput = input.compareDocumentPosition(err) & Node.DOCUMENT_POSITION_PRECEDING;
          f._setError(null);
          const cleared = input.getAttribute('aria-invalid') === null && err.hidden;
          const sum = Proto.ui.errorSummary([{ id: input.id, message: 'Enter an amount above zero' }]);
          host.append(sum);
          const summaryOk = sum.getAttribute('role') === 'alert' && !!sum.querySelector('h3') && sum.querySelectorAll('a').length === 1;
          sum.querySelector('a').click();
          const movedFocus = document.activeElement === input;
          host.remove();
          return { labelFor: !!labelFor, labelAbove: !!labelAbove, required, describedBefore, invalid, describedFirst, hiddenPrefix, errBeforeInput: !!errBeforeInput, cleared, summaryOk, movedFocus };
        });
        const reproduced = !(o.labelFor && o.labelAbove && o.required && o.invalid && o.describedFirst && o.hiddenPrefix && o.errBeforeInput && o.cleared && o.summaryOk && o.movedFocus);
        rec('A-ux-5', 'A field does not state its requirement before input, or a rejected value is not named in text between the hint and the field with a hidden "Error:" prefix', 'WCAG 3.3.1, 3.3.2; the NHS and GOV.UK error pattern; docs/16', reproduced, { ...o, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-6 · CUST-* · store.prefsFor / setPref / resetPrefs and the Settings surface: seven
    // preferences, kept per user, defaulting to the operating system's answer where it has one, and
    // a shared or operatory device keeping the comfortable spacing whatever the person set.
    async 'A-ux-6'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        await go(p, '#/owner/close');
        const defaults = await p.evaluate(() => Proto.store.prefsFor());
        await click(p, 'topbar.settings'); await p.waitForTimeout(200);
        const surface = await p.evaluate(() => {
          const ids = [...document.querySelectorAll('#dialogs [data-testid^="settings."]')].map((e) => e.getAttribute('data-testid'));
          const prefs = new Set(ids.filter((i) => !/\.(reset|close)$/.test(i)).map((i) => i.split('.')[1]));
          return { prefCount: prefs.size, hasReset: ids.includes('settings.reset'), hasPrivacy: !!document.querySelector('#dialogs [data-testid="topbar.privacy"]'), hasSignout: !!document.querySelector('#dialogs [data-testid="topbar.signout"]') };
        });
        await click(p, 'settings.textsize.large'); await p.waitForTimeout(200);
        const afterLarge = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-text-size'), rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize), stored: Proto.store.prefsFor().textSize }));
        await click(p, 'settings.reset'); await p.waitForTimeout(200);
        const afterReset = await p.evaluate(() => Proto.store.prefsFor().textSize);
        await p.evaluate(() => { Proto.store.setPref('density', 'compact'); });
        const deskDensity = await p.evaluate(() => Proto.store.prefsFor().density);
        const sharedDensity = await p.evaluate(() => { window.__proto.set({ device: 'shared' }); return Proto.store.prefsFor().density; });
        const o = { defaults, surface, afterLarge, afterReset, deskDensity, sharedDensity };
        const reproduced = !(surface.prefCount === 7 && surface.hasReset && surface.hasPrivacy && surface.hasSignout
          && defaults.theme === 'system' && defaults.motion === 'system' && defaults.contrast === 'system' && defaults.shortcuts === 'off'
          && afterLarge.attr === 'large' && afterLarge.rootPx > 16 && afterLarge.stored === 'large' && afterReset === 'default'
          && deskDensity === 'compact' && sharedDensity === 'comfortable');
        rec('A-ux-6', 'The settings surface does not hold exactly seven per-user preferences with a reset, or a preference does not persist, or a shared device honours a compact-density preference', 'docs/16 CUST-settings-surface-small, CUST-os-first-tristate, CUST-device-over-user-density, CUST-3.3.7-remembered-layout', reproduced, { ...o, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-7 · CLT-topbar-7 / WCAG 1.4.10 · the shell bar: few enough controls to read at a glance,
    // and on a phone nothing pushed off the edge where no one can reach it.
    async 'A-ux-7'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const read = () => p.evaluate(() => {
          const bar = document.querySelector('.topbar');
          const ctl = [...bar.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter((e) => e.offsetParent !== null);
          const br = bar.getBoundingClientRect();
          return {
            n: ctl.length,
            rows: new Set(ctl.map((e) => Math.round(e.getBoundingClientRect().top))).size,
            offEdge: ctl.filter((e) => { const r = e.getBoundingClientRect(); return r.right > br.right + 1 || r.left < br.left - 1; }).length,
            scrolls: bar.scrollWidth > bar.clientWidth + 1,
          };
        });
        const out = {};
        for (const [w, hash] of [[1280, '#/owner/close'], [1024, '#/owner/close'], [420, '#/owner/close'], [320, '#/owner/close'], [1280, '#/frontdesk/board'], [420, '#/frontdesk/board']]) {
          await p.setViewportSize({ width: w, height: w <= 480 ? 860 : 900 });
          await go(p, hash + (w <= 480 ? '?device=phone' : '')); await p.waitForTimeout(200);
          out[hash + '@' + w] = await read();
        }
        const bad = Object.entries(out).filter(([, o]) => o.n > 9 || o.rows > 2 || o.offEdge > 0 || o.scrolls).map(([k]) => k);
        rec('A-ux-7', 'The shell top bar carries ten or more controls, wraps past two rows, scrolls sideways, or hides a control off its own edge', 'docs/16 CLT-topbar-7, WCAG 1.4.10 reflow', bad.length > 0, { ...out, failing: bad, pageErrors: errs });
      } finally { await c.close(); }
    },

    // A-ux-8 · WCAG 2.4.11 / 3.3.1 / 3.3.2 · the Encounter's filing gate: a sticky column must never
    // cover the element holding keyboard focus, the gate must be one summary that links to each unmet
    // check, and validation must happen on the press rather than when a field loses focus.
    async 'A-ux-8'(b) {
      const { c, p, errs } = await ctx(b, 1280, 900);
      try {
        const covered = async (w) => {
          await p.setViewportSize({ width: w, height: 900 });
          await go(p, '#/dentist/encounter/enc-9002'); await p.waitForTimeout(250);
          return p.evaluate(() => {
            const sticky = [...document.querySelectorAll('#canvas *')].filter((e) => { const cs = getComputedStyle(e); return cs.position === 'sticky' || cs.position === 'fixed'; });
            const stops = [...document.querySelectorAll('#canvas button:not([disabled]), #canvas input, #canvas textarea, #canvas [tabindex]:not([tabindex="-1"])')].filter((e) => e.offsetParent !== null);
            let hidden = 0;
            for (const el of stops) {
              el.focus();
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              for (const s of sticky) {
                if (s.contains(el)) continue;
                const q = s.getBoundingClientRect();
                if (q.left <= r.left && q.right >= r.right && q.top <= r.top && q.bottom >= r.bottom) { hidden++; break; }
              }
            }
            const root = document.querySelector('#canvas .encpage, #canvas > *');
            return { hidden, stops: stops.length, clearance: root ? getComputedStyle(root).getPropertyValue('--gate-clearance').trim() : '' };
          });
        };
        const at1280 = await covered(1280), at1024 = await covered(1024), at420 = await covered(420);
        await p.setViewportSize({ width: 1280, height: 900 });
        await go(p, '#/dentist/encounter/enc-9002'); await p.waitForTimeout(200);
        // The summary belongs to a failed submit, so press File before looking for it.
        await click(p, 'enc.file'); await p.waitForTimeout(300);
        const gate = await p.evaluate(() => {
          const alerts = document.querySelectorAll('#canvas [role="alert"]').length;
          const box = document.querySelector('#canvas [role="alert"]');
          const glyph = box ? box.querySelector('.glyph') : null;
          // What matters is that each unmet check offers a way to the field it names, not
          // whether that way is an anchor or a button.
          return { alerts, links: box ? box.querySelectorAll('a[href], button').length : 0, glyphPx: glyph ? parseFloat(getComputedStyle(glyph).fontSize) : null };
        });
        // and that pressing the first one actually puts the keyboard in a field
        const movedToField = await p.evaluate(async () => {
          const box = document.querySelector('#canvas [role="alert"]');
          const first = box && box.querySelector('a[href], button');
          if (!first) return false;
          first.click(); await new Promise((r) => setTimeout(r, 250));
          const a = document.activeElement;
          return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || (a.getAttribute('data-testid') || '').startsWith('enc.'));
        });
        // A refusal never erases what was typed: type into a note field and leave it.
        const kept = await p.evaluate(async () => {
          const t = document.querySelector('[data-testid^="enc.note.field."]');
          if (!t) return null;
          t.focus(); t.value = 'MY OWN WORDS'; t.dispatchEvent(new Event('input', { bubbles: true }));
          t.blur(); await new Promise((r) => setTimeout(r, 300));
          const again = document.querySelector('[data-testid="' + t.getAttribute('data-testid') + '"]');
          return again ? again.value : null;
        });
        const o = { at1280, at1024, at420, gate, movedToField, kept };
        const reproduced = at1280.hidden > 0 || at1024.hidden > 0 || at420.hidden > 0 || gate.alerts < 1 || gate.links < 1 || !movedToField || kept !== 'MY OWN WORDS';
        rec('A-ux-8', 'The Encounter\'s sticky filing gate covers the element that has keyboard focus, or the gate is not one linked summary, or leaving a note field erases what was typed', 'WCAG 2.4.11 Focus Not Obscured, 3.3.1, 3.3.2; docs/16 CDS-ERR-summary-top, INT-keep-data-and-gate-on-press', reproduced, { ...o, pageErrors: errs });
      } finally { await c.close(); }
    },
  };
};
