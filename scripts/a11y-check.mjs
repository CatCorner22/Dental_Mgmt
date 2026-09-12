#!/usr/bin/env node
/* Automated accessibility check: runs axe-core (vendored, scripts/vendor/axe-core) against every route of the
   prototype, in both themes, at desk / operatory / phone widths, and reports every violation with the WCAG
   criteria it maps to and the first offending node. Automated rules cover a minority of WCAG; the rest is
   measured by proto-check (targets, contrast, focus, motion, overflow) and by the UX audit's own probes.

   node scripts/a11y-check.mjs [--json <path>] [--widths 1280,1024,420] [--only <route,...>]
   Exit 1 when any serious or critical violation remains; moderate and minor are listed but do not fail. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const require = createRequire(import.meta.url);
let chromium;
try { chromium = require('playwright').chromium; } catch { try { chromium = require('/usr/lib/node_modules/playwright').chromium; } catch { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE = 'file://' + path.join(ROOT, 'prototype', 'index.html');
const AXE = fs.readFileSync(path.join(ROOT, 'scripts', 'vendor', 'axe-core', 'axe.min.js'), 'utf8');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const WIDTHS = (args.widths || '1280,1024,420').split(',').map(Number);
const ONLY = args.only ? args.only.split(',') : null;

// Every persona home, the deep screens, and the surfaces that open over them.
const ROUTES = [
  ['signin', '#/signin'],
  ['frontdesk/board', '#/frontdesk/board'],
  ['biller/money', '#/biller/money'],
  ['hygienist/chairs', '#/hygienist/chairs'],
  ['dentist/exams', '#/dentist/exams'],
  ['owner/close', '#/owner/close'],
  ['compliance/risk', '#/compliance/risk'],
  ['compliance/roles', '#/compliance/roles'],
  ['temp/board', '#/temp/board'],
  ['hygienist/perio', '#/hygienist/perio/enc-9001'],
  ['dentist/encounter', '#/dentist/encounter/enc-9002'],
  ['frontdesk/checkout', '#/frontdesk/checkout/a-1044'],
  ['biller/ledger', '#/biller/ledger/p-319'],
  ['phone/approvals', '#/phone/approvals', async (p) => { const b = await p.$('[data-testid="phone.simulate"]'); if (b) { await b.click(); await p.waitForTimeout(250); } }],
  ['palette', '#/frontdesk/board', async (p) => { await p.click('[data-testid="topbar.search"]'); await p.waitForTimeout(200); await p.fill('[data-testid="palette.input"]', 'mar'); await p.waitForTimeout(250); }],
  ['pinpad', '#/hygienist/perio/enc-9001', async (p) => { await p.click('[data-testid="topbar.author"]'); await p.waitForTimeout(250); }],
  ['refusal', '#/biller/money', async (p) => { await p.click('[data-testid="money.writeoff.p-306"]'); await p.waitForTimeout(150); await p.click('[data-testid="money.writeoff.reason.courtesy"]'); await p.click('[data-testid="money.writeoff.post"]'); await p.waitForTimeout(300); }],
];

const browser = await chromium.launch({ headless: true });
const results = [];
const seen = new Map();  // rule|target -> first occurrence, so one defect is one row however many contexts show it
try {
  for (const width of WIDTHS) for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: width <= 480 ? 860 : 900 } });
    for (const [name, hash, drive] of ROUTES) {
      if (ONLY && !ONLY.includes(name)) continue;
      const p = await ctx.newPage();
      try {
        await p.goto(FILE + hash + '?theme=' + theme + (width <= 480 ? '&device=phone' : width <= 1024 ? '&device=operatory' : ''));
        await p.waitForFunction(() => window.__proto && window.__proto.ready); await p.waitForTimeout(200);
        if (drive) await drive(p);
        await p.addScriptTag({ content: AXE });
        const r = await p.evaluate(async () => {
          const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations', 'incomplete'] });
          const slim = (v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags.filter((t) => /^wcag/.test(t)), nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(' '), testid: (() => { try { const e = document.querySelector(n.target[0]); return e && e.getAttribute('data-testid'); } catch { return null; } })(), html: n.html.slice(0, 160), summary: n.failureSummary && n.failureSummary.slice(0, 240) })), count: v.nodes.length });
          return { violations: res.violations.map(slim), incomplete: res.incomplete.map(slim), passes: res.passes ? res.passes.length : null };
        });
        for (const v of r.violations) {
          const key = v.id + '|' + (v.nodes[0] && (v.nodes[0].testid || v.nodes[0].target));
          if (!seen.has(key)) seen.set(key, { ...v, firstSeen: { route: name, theme, width }, contexts: [] });
          seen.get(key).contexts.push(name + ' ' + theme + ' ' + width);
        }
        results.push({ route: name, theme, width, violations: r.violations.length, incomplete: r.incomplete.length, incompleteRules: r.incomplete.map((i) => i.id) });
      } catch (e) { results.push({ route: name, theme, width, error: e.message.slice(0, 200) }); }
      await p.close();
    }
    await ctx.close();
  }
} finally { await browser.close(); }

const violations = [...seen.values()].sort((a, b) => ({ critical: 0, serious: 1, moderate: 2, minor: 3 }[a.impact] - { critical: 0, serious: 1, moderate: 2, minor: 3 }[b.impact]));
const out = args.json || path.join(process.env.TMPDIR || '/tmp', 'a11y-check.json');
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), axe: '4.13.0', widths: WIDTHS, contexts: results, violations }, null, 2));

const byImpact = (imp) => violations.filter((v) => v.impact === imp).length;
console.log(`axe-core 4.13.0 · ${results.length} contexts (${ROUTES.length} routes × 2 themes × ${WIDTHS.length} widths)`);
console.log(`distinct violations: ${violations.length} — critical ${byImpact('critical')}, serious ${byImpact('serious')}, moderate ${byImpact('moderate')}, minor ${byImpact('minor')}`);
for (const v of violations) console.log(`  [${v.impact}] ${v.id} — ${v.help} (${v.tags.join(', ')}) · first on ${v.firstSeen.route} ${v.firstSeen.theme} ${v.firstSeen.width}px · ${v.nodes[0] && (v.nodes[0].testid || v.nodes[0].target)} · in ${v.contexts.length} contexts`);
const errs = results.filter((r) => r.error);
if (errs.length) { console.log(`\n${errs.length} contexts could not be measured:`); for (const e of errs) console.log('  ' + e.route + ' ' + e.theme + ' ' + e.width + ': ' + e.error); }
const incomplete = [...new Set(results.flatMap((r) => r.incompleteRules || []))];
if (incomplete.length) console.log(`\nneeds review (axe could not decide): ${incomplete.join(', ')}`);
console.log(`\nDetail: ${out}`);
if (byImpact('critical') + byImpact('serious') > 0 || errs.length) process.exitCode = 1;
