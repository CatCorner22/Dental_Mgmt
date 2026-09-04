#!/usr/bin/env node
/* UI stability checks for prototype/ (CONTRACTS.md). Uses the global playwright driver; no test runner.
   node scripts/proto-check.mjs [--only routes,flows,...] [--url file:///abs/prototype/index.html] [--out <dir>]
   Exit 0 only when every selected check PASSes. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { FLOWS } from './lib/flows.mjs';
import { parseColor, blend, contrast, required } from './lib/wcag.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const require = createRequire(import.meta.url);
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { try { chromium = require('/usr/lib/node_modules/playwright').chromium; } catch (e2) { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } }

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const ROOT = path.resolve(path.dirname(new globalThis.URL(import.meta.url).pathname), '..'); // globalThis: the module-level const URL below shadows the global (TDZ)
const URL = args.url || ('file://' + path.join(ROOT, 'prototype', 'index.html'));
const OUT = args.out || path.join(process.env.SCRATCH || '/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad', 'proto-check');
const ONLY = args.only ? args.only.split(',') : null;
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const PERSONAS = ['frontdesk', 'biller', 'hygienist', 'dentist', 'surgeon', 'owner', 'compliance', 'temp'];
const HOME = { frontdesk: 'board', biller: 'money', hygienist: 'chairs', dentist: 'exams', surgeon: 'exams', owner: 'close', compliance: 'risk', temp: 'board' };
const ROUTES = ['#/signin', ...PERSONAS.map((p) => '#/' + p + '/' + HOME[p]), '#/frontdesk/checkout/a-1044', '#/frontdesk/checkout/a-1045', '#/frontdesk/checkout/a-1046', '#/frontdesk/checkout/a-1047', '#/hygienist/perio/enc-9001', '#/dentist/encounter/enc-9002', '#/surgeon/encounter/enc-9020', '#/biller/ledger/p-303', '#/owner/roles', '#/owner/money', '#/phone/approvals', '#/frontdesk/board?outage=1', '#/frontdesk/board?privacy=1&device=shared'];
const WIDTHS = [1280, 1024, 820];

const results = {};
const fail = (name, msg) => { results[name] = results[name] || { pass: true, failures: [] }; results[name].pass = false; results[name].failures.push(msg); };
const note = (name) => { results[name] = results[name] || { pass: true, failures: [] }; };

async function open(page, hash, theme) {
  const url = URL + hash + (theme === 'dark' ? (hash.includes('?') ? '&' : '?') + 'theme=dark' : '');
  await page.goto(url);
  // hash-only navigation does not reload: force a render by evaluating
  await page.waitForFunction(() => window.__proto && window.__proto.ready, null, { timeout: 5000 });
  await page.evaluate((h) => { if (location.hash !== h) location.hash = h; }, hash.split('?')[0] + (hash.includes('?') ? '?' + hash.split('?')[1] : ''));
  await page.waitForTimeout(120);
}

async function fresh(browser, width, opts) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: opts && opts.reducedMotion ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return { ctx, page, errors };
}

async function checkRoutes(browser) {
  note('routes');
  for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await fresh(browser, 1280);
    await page.goto(URL + '#/signin');
    for (const r of ROUTES) {
      errors.length = 0;
      await page.evaluate((h) => { location.hash = h; }, r);
      await page.evaluate((t) => window.__proto.set({ theme: t }), theme);
      await page.waitForTimeout(150);
      const kids = await page.evaluate(() => document.getElementById('canvas').children.length);
      const evErr = await page.evaluate(() => window.__events.filter((e) => e.kind === 'error').map((e) => e.message));
      if (kids === 0) fail('routes', `${theme} ${r}: canvas empty`);
      for (const e of errors) fail('routes', `${theme} ${r}: ${e}`);
      for (const e of evErr) fail('routes', `${theme} ${r}: event error ${e}`);
      await page.evaluate(() => { window.__events.length = 0; });
    }
    await ctx.close();
  }
}

async function runFlow(page, flow) {
  let taps = 0, keys = 0; const problems = [];
  await page.goto(URL + flow.start);
  await page.waitForFunction(() => window.__proto && window.__proto.ready);
  await page.evaluate(() => window.__proto.reset());
  await page.evaluate((h) => { location.hash = h; }, flow.start);
  await page.waitForTimeout(150);
  for (const st of flow.steps) {
    if (st.route) { await page.evaluate((h) => { location.hash = h; }, st.route); await page.waitForTimeout(150); continue; }
    if (st.press) {
      const sel = `[data-testid="${st.press}"]`;
      const exists = await page.$(sel);
      if (!exists) { if (st.optional) continue; problems.push(`missing control ${st.press}`); break; }
      await page.focus(sel);
      await page.keyboard.press('Enter'); taps++;
      await page.waitForTimeout(80);
      continue;
    }
    if (st.fill) { const sel = `[data-testid="${st.fill[0]}"]`; if (!(await page.$(sel))) { problems.push(`missing field ${st.fill[0]}`); break; } await page.focus(sel); await page.keyboard.type(st.fill[1]); keys += st.fill[1].length; continue; }
    if (st.keys) { await page.keyboard.type(st.keys, { delay: 0 }); keys += st.keys.length; await page.waitForTimeout(50); continue; }
    if (st.key) { await page.keyboard.press(st.key); keys++; continue; }
    if (st.expect) { const state = await page.evaluate(() => window.__proto.state()); const r = st.expect(state); if (r !== true) problems.push(String(r)); }
  }
  const evTaps = await page.evaluate(() => window.__events.filter((e) => e.kind === 'click' || (e.kind === 'key' && (e.key === 'Enter' || e.key === ' ') && e.testid)).length);
  return { taps, keys, evTaps, problems };
}

async function checkFlows(browser) {
  note('flows');
  const { ctx, page, errors } = await fresh(browser, 1280);
  for (const flow of FLOWS) {
    errors.length = 0;
    const r = await runFlow(page, flow);
    if (r.problems.length) fail('flows', `${flow.id}: ${r.problems.join('; ')}`);
    if (r.taps > flow.budgetTaps) fail('flows', `${flow.id}: ${r.taps} taps > budget ${flow.budgetTaps}`);
    if (flow.budgetKeystrokes && r.keys > flow.budgetKeystrokes) fail('flows', `${flow.id}: ${r.keys} keystrokes > budget ${flow.budgetKeystrokes}`);
    for (const e of errors) fail('flows', `${flow.id}: ${e}`);
    results.flows.detail = results.flows.detail || {}; results.flows.detail[flow.id] = r;
  }
  await ctx.close();
}

const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

async function checkTargets(browser) {
  note('targets');
  const { ctx, page } = await fresh(browser, 1280);
  await page.goto(URL + '#/signin'); await page.waitForFunction(() => window.__proto && window.__proto.ready);
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r); await page.waitForTimeout(150);
    const bad = await page.evaluate((sel) => {
      const out = []; const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && !e.disabled && !e.closest('[hidden]'));
      for (const e of els) { const b = e.getBoundingClientRect(); if (b.width === 0 && b.height === 0) continue; if (b.width < 44 || b.height < 44) out.push((e.getAttribute('data-testid') || e.tagName.toLowerCase() + ':' + (e.textContent || '').trim().slice(0, 20)) + ` ${Math.round(b.width)}x${Math.round(b.height)}`); }
      // sibling gaps among interactive siblings
      const parents = new Set(els.map((e) => e.parentElement));
      for (const p of parents) { const kids = [...p.children].filter((k) => k.matches(sel) && k.offsetParent !== null); for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect(); const dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right)); const dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)); const overlapX = a.left < b.right && b.left < a.right, overlapY = a.top < b.bottom && b.top < a.bottom; if (overlapX && overlapY) { out.push('overlap ' + (kids[i].getAttribute('data-testid') || '?') + ' / ' + (kids[j].getAttribute('data-testid') || '?')); continue; } const gap = overlapY ? dx : overlapX ? dy : Math.hypot(dx, dy); if (gap < 8) out.push('gap ' + Math.round(gap) + 'px ' + (kids[i].getAttribute('data-testid') || '?') + ' / ' + (kids[j].getAttribute('data-testid') || '?')); } }
      return out;
    }, FOCUSABLE);
    for (const b of bad) fail('targets', `${r}: ${b}`);
  }
  await ctx.close();
}

async function checkContrast(browser) {
  note('contrast');
  for (const theme of ['light', 'dark']) {
    const { ctx, page } = await fresh(browser, 1280);
    await page.goto(URL + '#/signin'); await page.waitForFunction(() => window.__proto && window.__proto.ready);
    for (const r of ROUTES) {
      await page.evaluate((h) => { location.hash = h; }, r); await page.evaluate((t) => window.__proto.set({ theme: t }), theme); await page.waitForTimeout(150);
      const samples = await page.evaluate(() => {
        const out = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n; const seen = new Set();
        while ((n = walker.nextNode())) {
          const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || el.closest('.sr-only, [hidden], script, style')) continue; if (el.offsetParent === null && el.tagName !== 'BODY') continue;
          const key = el.getAttribute('data-testid') || (el.className + ':' + t.slice(0, 20)); if (seen.has(key)) continue; seen.add(key);
          const cs = getComputedStyle(el); let bg = null; let p = el;
          while (p) { const c = getComputedStyle(p).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } p = p.parentElement; }
          out.push({ key, color: cs.color, bg: bg || getComputedStyle(document.body).backgroundColor, font: parseFloat(cs.fontSize), weight: cs.fontWeight, text: t.slice(0, 30) });
        }
        return out;
      });
      for (const s of samples) {
        const fg = parseColor(s.color), bg = parseColor(s.bg); if (!fg || !bg) continue;
        const bgo = bg.a < 1 ? blend(bg, { r: 255, g: 255, b: 255 }) : bg; const fgo = fg.a < 1 ? blend(fg, bgo) : fg;
        const c = contrast(fgo, bgo); const req = required(s.font, s.weight);
        if (c < req) fail('contrast', `${theme} ${r}: ${s.key} "${s.text}" ${c.toFixed(2)}:1 < ${req} (${s.color} on ${s.bg})`);
      }
    }
    await ctx.close();
  }
}

async function checkOverflow(browser) {
  note('overflow');
  for (const w of WIDTHS) {
    const { ctx, page } = await fresh(browser, w);
    await page.goto(URL + '#/signin'); await page.waitForFunction(() => window.__proto && window.__proto.ready);
    for (const r of ROUTES) {
      await page.evaluate((h) => { location.hash = h; }, r); await page.waitForTimeout(150);
      const o = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
      if (o.sw > o.iw) fail('overflow', `${w}px ${r}: scrollWidth ${o.sw} > ${o.iw}`);
    }
    await ctx.close();
  }
}

async function checkMotion(browser) {
  note('motion');
  const { ctx, page } = await fresh(browser, 1280, { reducedMotion: true });
  await page.goto(URL + '#/signin'); await page.waitForFunction(() => window.__proto && window.__proto.ready);
  for (const r of ROUTES.slice(0, 10)) {
    await page.evaluate((h) => { location.hash = h; }, r); await page.waitForTimeout(150);
    const animated = await page.evaluate(() => { const out = []; for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); const td = cs.transitionDuration.split(',').some((v) => parseFloat(v) > 0); const ad = cs.animationDuration.split(',').some((v) => parseFloat(v) > 0) && cs.animationName !== 'none'; if (td || ad) out.push(el.getAttribute('data-testid') || el.className || el.tagName); } return out.slice(0, 5); });
    for (const a of animated) fail('motion', `${r}: animated under reduced motion: ${a}`);
  }
  await ctx.close();
}

async function checkFocus(browser) {
  note('focus');
  const { ctx, page } = await fresh(browser, 1280);
  await page.goto(URL + '#/signin'); await page.waitForFunction(() => window.__proto && window.__proto.ready);
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r); await page.waitForTimeout(150);
    const count = await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && !e.disabled).length, FOCUSABLE);
    await page.evaluate(() => document.body.focus());
    const seen = new Set(); let noRing = [];
    for (let i = 0; i < Math.min(count + 5, 400); i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow && cs.boxShadow !== 'none'); return { id: e.getAttribute('data-testid') || e.tagName + ':' + (e.textContent || '').trim().slice(0, 15), ring }; });
      if (!info) continue;
      if (seen.has(info.id) && seen.size < count - 1 && i > count) { fail('focus', `${r}: Tab loop returned to ${info.id} before reaching all ${count} controls (trap)`); break; }
      seen.add(info.id); if (!info.ring) noRing.push(info.id);
    }
    for (const n of [...new Set(noRing)].slice(0, 5)) fail('focus', `${r}: no visible focus ring on ${n}`);
  }
  await ctx.close();
}

async function checkTestids(browser) {
  note('testids');
  const { ctx, page } = await fresh(browser, 1280);
  await page.goto(URL + '#/signin'); await page.waitForFunction(() => window.__proto && window.__proto.ready);
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r); await page.waitForTimeout(150);
    const bad = await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && !e.closest('[data-testid]')).map((e) => e.tagName.toLowerCase() + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 25)), FOCUSABLE);
    for (const b of bad) fail('testids', `${r}: interactive element without data-testid: ${b}`);
  }
  await ctx.close();
}

async function checkShots(browser) {
  note('shots');
  for (const theme of ['light', 'dark']) {
    const { ctx, page } = await fresh(browser, 1280);
    await page.goto(URL + '#/signin'); await page.waitForFunction(() => window.__proto && window.__proto.ready);
    for (const p of PERSONAS) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + p + '/' + HOME[p]); await page.evaluate((t) => window.__proto.set({ theme: t }), theme); await page.waitForTimeout(200);
      const file = path.join(OUT, 'shots', `${p}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      if (!fs.existsSync(file)) fail('shots', `${p} ${theme}: screenshot missing`);
    }
    await ctx.close();
  }
}

const CHECKS = { routes: checkRoutes, flows: checkFlows, targets: checkTargets, contrast: checkContrast, overflow: checkOverflow, motion: checkMotion, focus: checkFocus, testids: checkTestids, shots: checkShots };

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, fn] of Object.entries(CHECKS)) { if (ONLY && !ONLY.includes(name)) continue; try { await fn(browser); } catch (e) { fail(name, 'check crashed: ' + e.message); } }
} finally { await browser.close(); }

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ url: URL, at: new Date().toISOString(), results }, null, 2));
let allPass = true;
console.log('check      result  failures');
for (const [name, r] of Object.entries(results)) { console.log(name.padEnd(10), (r.pass ? 'PASS' : 'FAIL').padEnd(7), r.failures.length); if (!r.pass) allPass = false; }
for (const [name, r] of Object.entries(results)) if (!r.pass) { console.log('\n' + name + ':'); r.failures.slice(0, 40).forEach((f) => console.log('  - ' + f)); if (r.failures.length > 40) console.log('  … ' + (r.failures.length - 40) + ' more'); }
if (results.flows && results.flows.detail) console.log('\nflow taps:', Object.fromEntries(Object.entries(results.flows.detail).map(([k, v]) => [k, v.taps + ' taps, ' + v.keys + ' keys'])));
console.log('\nreport: ' + path.join(OUT, 'report.json'));
process.exit(allPass ? 0 : 1);
