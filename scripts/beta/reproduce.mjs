#!/usr/bin/env node
/* Adversarial reproduction of the beta panel's defect claims, root cause by root cause.
   Each check states the claim, drives the prototype, and reports reproduced true/false with a measurement.
   Default position is NOT reproduced: a check must produce evidence to count.
   node scripts/beta/reproduce.mjs [--only R1,R7] [--json <path>] */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const require = createRequire(import.meta.url);
let chromium;
try { chromium = require('playwright').chromium; } catch { try { chromium = require('/usr/lib/node_modules/playwright').chromium; } catch { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } }

const ROOT = path.resolve(path.dirname(new globalThis.URL(import.meta.url).pathname), '../..');
const FILE = 'file://' + path.join(ROOT, 'prototype', 'index.html');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const ONLY = args.only ? args.only.split(',') : null;

const results = [];
const rec = (id, claim, rule, reproduced, evidence) => { results.push({ id, claim, rule, reproduced, evidence }); };

async function ctx(browser, w = 1280, h = 900, opts = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reducedMotion || 'no-preference' });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  return { c, p, errs };
}
async function go(p, hash) { await p.goto(FILE + hash); await p.waitForFunction(() => window.__proto && window.__proto.ready); await p.waitForTimeout(120); }
async function hop(p, hash) { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(150); }
const press = async (p, tid) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.focus(s); await p.keyboard.press('Enter'); await p.waitForTimeout(90); return true; };
const click = async (p, tid) => { const s = `[data-testid="${tid}"]`; if (!(await p.$(s))) return false; await p.click(s); await p.waitForTimeout(90); return true; };
const txt = (p, tid) => p.$eval(`[data-testid="${tid}"]`, (e) => e.textContent.trim()).catch(() => null);
const box = (p, tid) => p.$eval(`[data-testid="${tid}"]`, (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; }).catch(() => null);
const state = (p) => p.evaluate(() => window.__proto.state());
const events = (p) => p.evaluate(() => window.__events);

const CHECKS = {
  // ---------- store.js ----------
  async R1(b) { // dual-release names the wrong second approvers
    const { c, p } = await ctx(b); await go(p, '#/biller/money');
    await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post');
    const verb = await txt(p, 'refusal.verb');
    const seedNames = await p.evaluate(() => window.__proto.state().users.filter((u) => u.entitlements.includes('approve_second')).map((u) => u.short));
    const namesDana = /Dana/.test(verb || '');
    rec('R1', 'The needs_second verb names "Dr. Reagan or Dr. Kim" while the seed and the phone card say Dana and Dr. Reagan', 'docs/13 feature 24 and signature moment 2: the verb names the eligible approvers a biller would actually ask',
      !!verb && !namesDana, { verb, eligibleInSeed: seedNames });
    await c.close();
  },
  async R2(b) { // credit double-count
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await click(p, 'board.card.a-1044.checkout'); await click(p, 'checkout.tender.card');
    const before = await p.evaluate(() => Proto.store.balances('p-303'));
    await click(p, 'checkout.post'); await p.waitForTimeout(200);
    const after = await p.evaluate(() => Proto.store.balances('p-303'));
    const ledger = await p.evaluate(() => window.__proto.state().ledger.filter((e) => e.patientId === 'p-303' && e.kind === 'patient_payment').map((e) => e.amountCents));
    const paid = ledger.reduce((s, x) => s + Math.abs(x), 0);
    rec('R2', 'The Checkout Credit tile double-counts an unapplied payment (a $44.00 card payment shows as $88.00 credit)', 'docs/13 feature 23: the three numbers are sums over ledger rows; no row is counted twice',
      after.credit > paid, { before, after, paidCents: paid });
    await c.close();
  },
  async R3(b) { // post again on an already checked-out appointment
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await click(p, 'board.card.a-1044.checkout'); await click(p, 'checkout.tender.card'); await click(p, 'checkout.post'); await p.waitForTimeout(200);
    await hop(p, '#/frontdesk/checkout/a-1044'); await click(p, 'checkout.tender.card'); const second = await click(p, 'checkout.post'); await p.waitForTimeout(200);
    const n = await p.evaluate(() => window.__proto.state().collectionDecisions.filter((d) => d.encounterId === 'enc-9003').length);
    rec('R3', 'Post stays live on an already checked-out appointment and writes a second collection decision and a second payment', 'docs/01 principle 9 and docs/13 feature 1: one typed decision per checkout; money never posts twice for one event',
      n > 1, { collectionDecisionsForEncounter: n, secondPostAccepted: second });
    await c.close();
  },
  async R4(b) { // screening derives a zero-site note
    const { c, p } = await ctx(b); await go(p, '#/hygienist/perio/enc-9001');
    await click(p, 'perio.screening');
    for (const k of ['1', '2', '3', '2', '1', '0']) { await p.keyboard.press(k); await p.waitForTimeout(20); }
    await click(p, 'perio.save'); await p.waitForTimeout(200);
    const note = await p.evaluate(() => (window.__proto.state().notes['enc-9001'] || {}).perioSummary || null);
    rec('R4', 'Saving the screening lane derives the hygiene note as "0 sites probed, deepest 0 mm, bleeding at 0 sites"', 'docs/13 feature 6: Save exam derives the note from what was recorded',
      !!note && /0 sites probed/.test(note), { perioSummary: note });
    await c.close();
  },
  async R5(b) { // duplicate paint, and the note keeps only the last paint
    const { c, p } = await ctx(b); await go(p, '#/surgeon/encounter/enc-9020');
    await click(p, 'enc.tooth.17'); await click(p, 'enc.proc.d7210'); await p.waitForTimeout(120);
    await click(p, 'enc.proc.d7210'); await p.waitForTimeout(120);
    await click(p, 'enc.proc.d9243'); await p.waitForTimeout(150);
    const s = await state(p);
    const procs = s.procedures.filter((x) => x.encounterId === 'enc-9020');
    const note = (s.notes['enc-9020'] || {}).procedure || '';
    const dupes = procs.filter((x) => x.cdt === 'd7210').length;
    rec('R5', 'Pressing a procedure chip twice paints a duplicate procedure, and the note scaffold keeps only the last paint', 'docs/13 feature 9: one gesture writes four records; the filed note must carry every procedure charted',
      dupes > 1 || !/D7210|extraction/i.test(note), { d7210Procedures: dupes, totalProcedures: procs.length, noteProcedureLine: note });
    await c.close();
  },
  async R6(b) { // first-shift rail state is global, not per user
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await click(p, 'board.card.a-1042.arrive'); await p.waitForTimeout(120);
    await hop(p, '#/temp/board');
    const retired = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="rail1.chip."]')].map((e) => ({ t: e.textContent.trim(), r: e.dataset.retired })));
    rec('R6', "A temp's first-shift chips are already retired by another user's events before the day pass exists", 'docs/13 feature 27: a chip retires when the server sees that user\'s own domain event',
      retired.some((x) => /✓/.test(x.t) || x.r === '1'), { chips: retired });
    await c.close();
  },
  async R7(b) { // ping_rate refusal shape
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await click(p, 'board.queue.row.a-1050.ping'); await p.waitForTimeout(100);
    await click(p, 'board.queue.row.a-1050.ping'); await p.waitForTimeout(150);
    const verb = await txt(p, 'refusal.verb'); const ctl = await p.$('[data-testid="refusal.control"]');
    const words = verb ? verb.split(/\s+/).length : 0;
    rec('R7', 'The ping_rate refusal has a nine-word verb and no control, and its code is not in the contract list', 'CONTRACTS §6 and docs/13 feature 29: a verb line of at most eight words, verb first, and exactly one 44 px control',
      !!verb && (words > 8 || !ctl), { verb, words, hasControl: !!ctl });
    await c.close();
  },
  // ---------- shell.js ----------
  async R8(b) { // author chip prints initials twice
    const { c, p } = await ctx(b); await go(p, '#/dentist/exams?device=shared');
    const t = await txt(p, 'topbar.author');
    const m = (t || '').match(/\b([A-Z]{2})\b/g) || [];
    rec('R8', 'The author chip renders the initials twice on shared and operatory devices ("DH DH · DDS")', 'docs/13 feature 30: the chip shows initials and licence glyph once',
      m.length >= 2 && m[0] === m[1], { chipText: t, initialsFound: m });
    await c.close();
  },
  async R9(b) { // PIN of a user with no persona writes a session and switches nothing
    const { c, p } = await ctx(b); await go(p, '#/dentist/encounter/enc-9002?device=shared');
    const before = await txt(p, 'topbar.author');
    await click(p, 'topbar.author');
    for (const d of ['4', '4', '4', '4']) await click(p, 'pin.key.' + d);
    await click(p, 'pin.submit'); await p.waitForTimeout(200);
    const after = await txt(p, 'topbar.author');
    const sessions = await p.evaluate(() => window.__events.filter((e) => e.kind === 'write' && e.table === 'sessions').length);
    const padOpen = !!(await p.$('[data-testid="pin.key.1"]'));
    rec('R9', "A valid PIN for a user with no chart persona (Dana) writes a session row and closes the pad but never switches the author", 'docs/13 feature 30: the PIN opens that user\'s own session on the same page, or it refuses; it never half-succeeds',
      sessions > 0 && before === after && !padOpen, { before, after, sessionWrites: sessions, padStillOpen: padOpen });
    await c.close();
  },
  async R10(b) { // wrong PIN bypasses the refusal component
    const { c, p } = await ctx(b); await go(p, '#/dentist/exams?device=shared');
    await click(p, 'topbar.author');
    for (const d of ['9', '9', '9', '9']) await click(p, 'pin.key.' + d);
    await click(p, 'pin.submit'); await p.waitForTimeout(150);
    const verb = await p.$('[data-testid="refusal.verb"]');
    rec('R10', 'A wrong PIN is rendered as a hint line, not through the shared refusal component', 'docs/13 feature 29: one shared Refusal component renders every verdict',
      !verb, { refusalVerbPresent: !!verb });
    await c.close();
  },
  // ---------- encounter.js ----------
  async R11(b) { // plan card rule trace hard-codes one carrier
    const { c, p } = await ctx(b); await go(p, '#/dentist/encounter/enc-9002');
    await click(p, 'enc.tooth.30'); await click(p, 'enc.proc.d2392'); await p.waitForTimeout(150);
    const s = await state(p);
    const plan = s.planItems.filter((x) => x.encounterId === 'enc-9002').pop();
    const carrier = s.patients.find((x) => x.id === 'p-302').primary;
    const trace = plan ? plan.ruleTrace : null;
    const carrierName = (s.carriers.find((x) => x.id === carrier) || {}).name;
    rec('R11', "The plan card's rule trace names Cigna PPO for every patient regardless of the patient's carrier", 'docs/13 feature 12: the estimate carries a rule trace the front desk can defend',
      !!trace && !!carrierName && !trace.includes(carrierName.split(' ')[0]), { ruleTrace: trace, patientCarrier: carrierName });
    await c.close();
  },
  async R12(b) { // privacy mode leaks the full name
    const { c, p } = await ctx(b); await go(p, '#/dentist/encounter/enc-9002?privacy=1&device=operatory');
    const body = await p.evaluate(() => document.getElementById('canvas').textContent);
    rec('R12', 'Privacy mode leaves the full patient name in the encounter header and the read-back verb', 'docs/04 information architecture: privacy mode hides names on operatory glass',
      /Theo Brandt/.test(body), { fullNameOnScreen: /Theo Brandt/.test(body) });
    await c.close();
  },
  async R13(b) { // read-back gate offers more than one control
    const { c, p } = await ctx(b); await go(p, '#/dentist/encounter/enc-9002');
    await click(p, 'enc.tag.tag-1.chart'); await click(p, 'enc.surface.30.d'); await click(p, 'enc.surface.30.o');
    await click(p, 'enc.proc.d2392'); await click(p, 'enc.note.starter.0'); await click(p, 'enc.file'); await p.waitForTimeout(200);
    const n = await p.evaluate(() => { const r = document.querySelector('.refusal'); return r ? [...r.querySelectorAll('button')].map((b) => b.textContent.trim()) : null; });
    rec('R13', 'The read-back gate renders several controls where the contract allows one', 'CONTRACTS §6: the first next step is the one 44 px control; further steps sit behind one disclosure',
      Array.isArray(n) && n.filter((x) => !/^Why$/i.test(x)).length > 1, { controlsInRefusal: n });
    await c.close();
  },
  async R14(b) { // encounter overflows a phone
    const { c, p } = await ctx(b, 420, 860); await go(p, '#/dentist/encounter/enc-9002');
    const o = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth, canvas: Math.round(document.getElementById('canvas').scrollWidth) }));
    rec('R14', 'The encounter page is wider than a 420 px phone: the odontogram forces the whole page to pan sideways', 'docs/04: wide content scrolls inside its own container; the page body never scrolls horizontally',
      o.sw > o.iw, o);
    await c.close();
  },
  // ---------- perio.js ----------
  async R15(b) { // Space activates a focused button
    const { c, p } = await ctx(b); await go(p, '#/hygienist/perio/enc-9001');
    await p.focus('[data-testid="perio.save"]');
    await p.keyboard.press('Space'); await p.waitForTimeout(250);
    const s = await state(p);
    rec('R15', 'Space, the bleeding key, activates the irreversible Save exam whenever focus rests on the Save button', 'docs/01 principle 11 and docs/13 feature 5: a grammar key never fires an irreversible action',
      s.perioExams.some((e) => e.encounterId === 'enc-9001'), { examSaved: s.perioExams.some((e) => e.encounterId === 'enc-9001') });
    await c.close();
  },
  async R16(b) { // grid does not follow the cursor
    const { c, p } = await ctx(b, 1024, 768); await go(p, '#/hygienist/perio/enc-9001');
    await p.keyboard.type('3'.repeat(90), { delay: 0 }); await p.waitForTimeout(200);
    const v = await p.evaluate(() => { const a = document.querySelector('.psite.active'); if (!a) return null; const b = a.getBoundingClientRect(); return { y: Math.round(b.y), inView: b.y >= 0 && b.bottom <= window.innerHeight }; });
    rec('R16', 'The grid never scrolls the active cell into view, so the lower arch is charted blind below the fold', 'docs/13 feature 5: the cursor position is always visible; the active site is drawn enlarged',
      !!v && !v.inView, v);
    await c.close();
  },
  async R17(b) { // glove pad opens below the fold
    const { c, p } = await ctx(b, 1024, 768); await go(p, '#/hygienist/perio/enc-9001?device=operatory');
    await click(p, 'perio.pad.toggle'); await p.waitForTimeout(200);
    const k = await box(p, 'perio.pad.key.1');
    rec('R17', 'The glove pad opens below the fold on a 1024x768 operatory tablet and can never share the screen with the active-site line', 'docs/13 feature 5: tapping the pad icon opens a bottom pad with the active site drawn enlarged above',
      !!k && k.y > 768, { firstPadKey: k, viewportHeight: 768 });
    await c.close();
  },
  async R18(b) { // saved exam locks the encounter silently
    const { c, p } = await ctx(b); await go(p, '#/hygienist/perio/enc-9001');
    await p.keyboard.type('3'.repeat(168), { delay: 0 }); await click(p, 'perio.save'); await p.waitForTimeout(250);
    await p.keyboard.press('4'); await p.waitForTimeout(120);
    const screening = await p.$('[data-testid="perio.screening"]');
    const refusal = await p.$('[data-testid="refusal.verb"]');
    const amend = await p.evaluate(() => !!document.querySelector('[data-testid*="amend"], [data-testid="perio.new"]'));
    rec('R18', 'After Save the exam is locked with no amend path: keys do nothing, Screening still looks live, and nothing refuses', 'docs/01 principle 11: a control that cannot act says so; docs/13 feature 11 gives amendments a path',
      !!screening && !refusal && !amend, { screeningStillRendered: !!screening, refusalShown: !!refusal, amendPath: amend });
    await c.close();
  },
  async R19(b) { // pad label overflows its key
    const { c, p } = await ctx(b, 1024, 768); await go(p, '#/hygienist/perio/enc-9001');
    await click(p, 'perio.pad.toggle'); await p.waitForTimeout(150);
    const o = await p.evaluate(() => { const e = document.querySelector('[data-testid="perio.pad.bleed"]'); if (!e) return null; return { key: Math.round(e.getBoundingClientRect().width), text: Math.round(e.scrollWidth) }; });
    rec('R19', 'The Bleed label is wider than its 44 px pad key, eating the 8 px gap to its neighbour', 'docs/04: 44 px targets with 8 px gaps; the visible target is the touch target',
      !!o && o.text > o.key + 1, o);
    await c.close();
  },
  async R20(b) { // omission licence copy and raw code in the note
    const { c, p } = await ctx(b); await go(p, '#/hygienist/perio/enc-9001');
    await p.keyboard.type('3'.repeat(20), { delay: 0 }); await p.keyboard.press('ArrowRight');
    await p.keyboard.type('3'.repeat(140), { delay: 0 });
    await click(p, 'perio.save'); await p.waitForTimeout(200);
    const verb = await txt(p, 'refusal.verb');
    await click(p, 'refusal.control'); await p.waitForTimeout(120);
    await click(p, 'perio.licence.not_tolerated'); await click(p, 'perio.licence.confirm'); await p.waitForTimeout(200);
    const note = await p.evaluate(() => (window.__proto.state().notes['enc-9001'] || {}).perioSummary || '');
    rec('R20', 'The omission gate says "1 sites" and the derived note carries the raw licence code (not_tolerated)', 'docs/01: named omission licences read as words a patient-facing record can carry',
      /\b1 sites\b/.test(verb || '') || /_/.test(note), { verb, perioSummary: note });
    await c.close();
  },
  async R21(b) { // glove pad cannot enter what the keyboard can
    const { c, p } = await ctx(b); await go(p, '#/hygienist/perio/enc-9001');
    await click(p, 'perio.pad.toggle'); await p.waitForTimeout(150);
    const keys = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="perio.pad."]')].map((e) => e.getAttribute('data-testid')));
    rec('R21', 'The glove pad has no 0 key (depths of 10 mm and more) and no suppuration key, so a gloved operator cannot enter what the keyboard can', 'docs/13 feature 5: the pad carries the grammar for gloved fingers',
      !keys.includes('perio.pad.key.0') || !keys.some((k) => /supp|\.s$/i.test(k)), { padKeys: keys });
    await c.close();
  },
  // ---------- board.js ----------
  async R22(b) { // Filed-later row has no Checkout control
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    const has = !!(await p.$('[data-testid="board.queue.row.a-1050.checkout"]'));
    rec('R22', 'The Filed-later queue row carries no Checkout control, so the window cannot check out a patient whose note is unfiled', 'docs/13 feature 2: checkout on an unfiled encounter posts to unapplied credit; the queue row\'s primary action is Checkout',
      !has, { checkoutControlPresent: has });
    await c.close();
  },
  async R23(b) { // two appointment types share one glyph
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    const g = await p.evaluate(() => { const out = {}; for (const ch of document.querySelectorAll('.chip')) { const w = ch.textContent.replace(/[^A-Za-z ]/g, '').trim(); const gl = ch.querySelector('.glyph'); if (w && gl) out[w] = gl.textContent; } return out; });
    const clash = g.Hygiene && g.Restorative && g.Hygiene === g.Restorative;
    rec('R23', 'Hygiene and Restorative appointment chips share one glyph, so in grayscale they differ only by the word', 'docs/13 feature 29 shape pack: every appointment type is a distinct mark plus a word plus a fill',
      !!clash, { glyphs: g });
    await c.close();
  },
  async R24(b) { // rail overlaps the board columns
    const { c, p } = await ctx(b, 1280, 900); await go(p, '#/frontdesk/board');
    await click(p, 'board.card.a-1042.expand'); await p.waitForTimeout(120);
    const railBtn = await p.$('[data-testid$=".rail"]'); if (railBtn) { await railBtn.click(); await p.waitForTimeout(200); }
    const o = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth, railOpen: !document.getElementById('rail').hidden }));
    rec('R24', 'With the Patient Rail open at 1280 px the Board columns overlap the checkout queue', 'docs/04: the rail is persistent; the work canvas reflows beside it',
      o.railOpen && o.sw > o.iw, o);
    await c.close();
  },
  async R25(b) { // focus dropped after an action
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await press(p, 'board.queue.row.a-1050.ping');
    const f = await p.evaluate(() => document.activeElement === document.body ? 'BODY' : (document.activeElement.getAttribute('data-testid') || document.activeElement.tagName));
    rec('R25', 'Keyboard focus drops to the page body after Ping chair, so a keyboard user loses their place', 'docs/04: keyboard-first; docs/13 feature 29 keys layer',
      f === 'BODY', { activeElementAfterAction: f });
    await c.close();
  },
  // ---------- moneydesk.js ----------
  async R26(b) { // write-off entry point missing on the Denials tab
    const { c, p } = await ctx(b); await go(p, '#/biller/money');
    await click(p, 'money.tab.denials'); await p.waitForTimeout(120);
    const has = !!(await p.$('[data-testid="money.writeoff.p-306"]'));
    rec('R26', 'The write-off entry point is rendered only on some Money Desk tabs, so the scripted path from Denials cannot start', 'docs/04: every worklist row has one primary action; the write-off gate is reachable from the work',
      !has, { writeoffOnDenialsTab: has });
    await c.close();
  },
  async R27(b) { // an appealed claim is on no worklist (strengthened after bp-09 round 2)
    const { c, p } = await ctx(b); await go(p, '#/biller/money');
    await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await click(p, 'money.appeal.send'); await p.waitForTimeout(250);
    // A confirmation sentence that merely names the claim is not a worklist row: look for an actionable row on any tab.
    const rows = await p.evaluate(() => {
      const out = {};
      for (const tab of ['denials', 'aging', 'approvals', 'statements', 'credits', 'variances']) {
        const b = document.querySelector('[data-testid="money.tab.' + tab + '"]'); if (!b) continue;
        b.click();
        out[tab] = !!document.querySelector('[data-testid^="money.denial.c-88"], [data-testid^="money.aging.row.c-88"], [data-testid*="c-88."]');
      }
      return out;
    });
    rec('R27', 'Once appealed, claim c-88 is on no worklist: the biller cannot see or act on what she just sent', 'docs/13 feature 16: the denial worklist tracks the appeal to its outcome with a next action',
      !Object.values(rows).some(Boolean), { actionableRowByTab: rows });
    await c.close();
  },
  async R28(b) { // Send confirms only to a screen reader (strengthened after bp-09 round 2)
    const { c, p } = await ctx(b); await go(p, '#/biller/money');
    await click(p, 'money.tab.statements');
    await click(p, 'money.statement.sd-1.send'); await p.waitForTimeout(250);
    // A row that vanishes is not a confirmation. Require a VISIBLE node that says it went.
    const vis = await p.evaluate(() => {
      // A leaf node whose own words say the statement went. Substring matches inside unrelated copy do not count.
      const PHRASE = /(statement sent|disclosure recorded|sent to)/i;
      const els = [...document.querySelectorAll('#canvas *')].filter((e) => e.children.length === 0 && PHRASE.test((e.textContent || '').trim()));
      return els.filter((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.height > 4 && b.width > 4 && cs.visibility !== 'hidden' && !e.closest('.sr-only'); }).map((e) => e.textContent.trim().slice(0, 60));
    });
    rec('R28', 'Sending a statement gives no visible in-place confirmation; the only text is a 1 px screen-reader line', 'docs/01: an irreversible action confirms in place, where the actor is looking',
      vis.length === 0, { visibleConfirmations: vis });
    await c.close();
  },

  // ---------- palette.js ----------
  async R29(b) { // palette shows the second identifier before asking for it
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await click(p, 'topbar.search'); await p.keyboard.type('fis'); await p.waitForTimeout(200);
    const row = await txt(p, 'palette.row.0');
    rec('R29', 'Search result rows print the date of birth and last-4 phone before the second-identifier gate asks for them', 'docs/13 feature 28: two identifiers before a chart opens; the gate is the check, not the list',
      !!row && /\d{1,2}\/\d{1,2}\/\d{4}/.test(row), { firstRow: row });
    await c.close();
  },
  async R30(b) { // the palette row hides the word it found (strengthened after bp-09 round 2)
    const { c, p } = await ctx(b, 420, 860); await go(p, '#/frontdesk/board');
    await click(p, 'topbar.search'); await p.keyboard.type('walkout'); await p.waitForTimeout(250);
    const o = await p.evaluate(() => {
      const r = document.querySelector('[data-testid="palette.row.0"]'); if (!r) return null;
      const lbl = r.querySelector('.lbl'); const syn = r.querySelector('.syn'); const chip = r.querySelector('.chip');
      const bx = (e) => e ? (() => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; })() : null;
      const L = bx(lbl), S = bx(syn), C = bx(chip);
      // A true overlap needs both axes: a stacked row is not an overlapping row.
      const inter = (a, z) => (a && z) ? Math.max(0, Math.min(a.r, z.r) - Math.max(a.l, z.l)) * (Math.min(a.b, z.b) > Math.max(a.t, z.t) ? 1 : 0) : 0;
      return { label: L, syn: S, chip: C, overlap: inter(C, S), text: r.textContent.trim().slice(0, 50) };
    });
    rec('R30', 'At phone width the palette row hides the target name: the label collapses to nothing and the chip overlaps the synonym', 'docs/04: text that can outgrow its track wraps or scrolls; clipped text is a bug',
      !!o && ((o.label && o.label.w < 20) || o.overlap > 4), o);
    await c.close();
  },

  // ---------- cross-cutting ----------
  async R31(b) { // the tap formula double-counts keyboard activation
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await press(p, 'board.card.a-1042.arrive');
    const ev = await events(p);
    const taps = ev.filter((e) => (e.kind === 'click' && !e.synthetic) || (e.kind === 'key' && (e.key === 'Enter' || e.key === ' ') && e.testid && !e.field)).length;
    rec('R31', 'One keyboard activation is counted as two taps: the Enter keydown and the click the browser synthesises from it', 'CONTRACTS §5 tap accounting, which every budget in docs/04 is measured against',
      taps > 1, { tapsCountedForOneActivation: taps, kinds: ev.filter((e) => e.testid === 'board.card.a-1042.arrive').map((e) => e.kind + ':' + (e.key || '')) });
    await c.close();
  },
  async R32(b) { // top bar eats the phone viewport
    const { c, p } = await ctx(b, 420, 860); await go(p, '#/frontdesk/board');
    const h = await p.evaluate(() => Math.round(document.getElementById('topbar').getBoundingClientRect().height));
    rec('R32', 'The sticky top bar wraps to four or five rows on a phone and covers a quarter of the viewport', 'docs/04: no deep menus; the work is the home screen',
      h > 150, { topbarHeight: h, viewport: 860, share: Math.round((h / 860) * 100) + '%' });
    await c.close();
  },
  async R33(b) { // focus is not managed across routes
    const { c, p } = await ctx(b); await go(p, '#/dentist/exams');
    await press(p, 'exams.row.enc-9002.open');
    const f = await p.evaluate(() => document.activeElement === document.body ? 'BODY' : (document.activeElement.getAttribute('data-testid') || document.activeElement.tagName));
    rec('R33', 'Every route change leaves keyboard focus on the page body instead of the new screen', 'docs/04 keyboard-first: the work surface takes focus so the next action is one key away',
      f === 'BODY', { activeElementAfterRouteChange: f });
    await c.close();
  },
  async R34(b) { // scroll offset survives a route change
    const { c, p } = await ctx(b, 1024, 768); await go(p, '#/hygienist/perio/enc-9001');
    await p.evaluate(() => { document.getElementById('canvas').scrollTop = 500; });
    await hop(p, '#/hygienist/chairs');
    const top = await p.evaluate(() => Math.round(document.getElementById('canvas').scrollTop));
    rec('R34', 'The work canvas keeps the previous screen\'s scroll offset, so a new screen opens mid-page with its heading off-screen', 'docs/04: home is the work; the primary action is above the fold',
      top > 40, { canvasScrollTopAfterRouteChange: top });
    await c.close();
  },
  async R35(b) { // pressed state is colour only
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/checkout/a-1044');
    const o = await p.evaluate(() => {
      const on = document.querySelector('[data-testid="checkout.collect.seg.collect"]');
      const off = document.querySelector('[data-testid="checkout.collect.seg.send-statement"]');
      if (!on || !off) return null;
      const a = getComputedStyle(on), b2 = getComputedStyle(off);
      return { pressedBorderWidth: a.borderTopWidth, unpressedBorderWidth: b2.borderTopWidth, pressedWeight: a.fontWeight, unpressedWeight: b2.fontWeight, pressedText: on.textContent.trim(), unpressedText: off.textContent.trim(), sameGeometry: a.borderTopWidth === b2.borderTopWidth && a.fontWeight === b2.fontWeight };
    });
    rec('R35', 'The selected state of the collection decision is carried by colour alone: geometry and text are identical to the unselected state', 'docs/04: severity and state are encoded three ways at once so a grayscale reader can tell them apart',
      !!o && o.sameGeometry && !/✓|●|■/.test(o.pressedText), o);
    await c.close();
  },
  async R36(b) { // ledger table overflows the phone
    const { c, p } = await ctx(b, 420, 860); await go(p, '#/biller/ledger/p-303');
    const o = await p.evaluate(() => { const t = document.querySelector('table.data'); if (!t) return null; const w = t.parentElement; return { table: Math.round(t.scrollWidth), wrapper: Math.round(w.clientWidth), wrapperScrolls: getComputedStyle(w).overflowX, pageScrollWidth: document.scrollingElement.scrollWidth, innerWidth: window.innerWidth }; });
    rec('R36', 'The ledger table overflows its wrapper on a phone and the amount column cannot be reached', 'docs/04: wide content scrolls inside its own container',
      !!o && o.table > o.wrapper && o.wrapperScrolls !== 'auto' && o.wrapperScrolls !== 'scroll', o);
    await c.close();
  },
  async R37(b) { // sedation is charted against a tooth
    const { c, p } = await ctx(b); await go(p, '#/surgeon/encounter/enc-9020');
    await click(p, 'enc.tooth.17'); await click(p, 'enc.proc.d9243'); await p.waitForTimeout(150);
    const s = await state(p);
    const sed = s.procedures.filter((x) => x.encounterId === 'enc-9020' && x.cdt === 'd9243').pop();
    rec('R37', 'IV sedation is charted, charged and planned against a tooth', 'docs/13 feature 9: temporality and site belong to the record; a whole-patient service has no tooth',
      !!sed && sed.tooth != null, { sedationProcedure: sed ? { cdt: sed.cdt, tooth: sed.tooth } : null });
    await c.close();
  },
  async R38(b) { // board balance and checkout estimate disagree
    const { c, p } = await ctx(b); await go(p, '#/frontdesk/board');
    await click(p, 'board.card.a-1046.expand'); await p.waitForTimeout(120);
    const cardText = await p.evaluate(() => { const e = document.querySelector('[data-testid="board.card.a-1046"]'); return e ? e.textContent : ''; });
    await hop(p, '#/frontdesk/checkout/a-1046');
    const canvas = await p.evaluate(() => document.getElementById('canvas').textContent);
    const cardAmt = (cardText.match(/\$\d[\d,]*\.\d\d/g) || []);
    const coAmt = (canvas.match(/\$\d[\d,]*\.\d\d/g) || []);
    rec('R38', 'The Board card balance and the checkout patient portion disagree for the same visit ($180.00 against $168.00)', 'docs/01 principle 2 and docs/04: one canonical view per fact',
      cardAmt.includes('$180.00') && !coAmt.includes('$180.00'), { boardAmounts: cardAmt.slice(0, 4), checkoutAmounts: coAmt.slice(0, 6) });
    await c.close();
  },

  // ---------- found by bp-09 in round 2 ----------
  async R39(b) { // regression: the one-row top bar lets labels overlap
    const { c, p } = await ctx(b, 420, 860); await go(p, '#/frontdesk/board');
    const o = await p.evaluate(() => {
      const bar = document.getElementById('topbar');
      const kids = [...bar.querySelectorAll('button, nav')].filter((e) => e.offsetParent !== null);
      const over = [];
      for (const e of kids) { if (e.scrollWidth > e.clientWidth + 1) over.push({ el: (e.getAttribute('data-testid') || e.tagName), needs: e.scrollWidth, has: e.clientWidth, text: (e.textContent || '').trim().slice(0, 14) }); }
      return { overflowing: over, barHeight: Math.round(bar.getBoundingClientRect().height) };
    });
    rec('R39', 'The one-row phone top bar clamps its buttons so the labels overflow and collide: "Main St" runs into "Search"', 'docs/04: clipped or overlapping text is a bug; the visible target is the real target',
      o.overflowing.length > 0, o);
    await c.close();
  },
  async R40(b) { // the Held state is off-screen while its own refusal control stays live
    const { c, p } = await ctx(b, 420, 860); await go(p, '#/biller/money');
    await click(p, 'money.writeoff.p-306'); await click(p, 'money.writeoff.reason.courtesy'); await click(p, 'money.writeoff.post'); await p.waitForTimeout(250);
    const o = await p.evaluate(() => {
      const held = [...document.querySelectorAll('.btn.held')][0];
      const ctl = document.querySelector('[data-testid="refusal.control"]');
      const bx = (e) => e ? Math.round(e.getBoundingClientRect().top) : null;
      return { heldTop: bx(held), controlTop: bx(ctl), viewport: window.innerHeight, requestWritten: window.__proto.state().approvals.length };
    });
    rec('R40', 'After Post the request is already written and the primary switches to Held below the fold, while the refusal\u2019s live control stays in view: two controls for one gate', 'CONTRACTS \u00a76: one verb line and one control; the state the actor must read is on screen',
      o.requestWritten > 0 && o.controlTop != null && (o.heldTop == null || o.heldTop > o.viewport), o);
    await c.close();
  },
  async R41(b) { // the appeal packet's way out is off the top
    const { c, p } = await ctx(b, 420, 860); await go(p, '#/biller/money');
    await click(p, 'money.tab.denials'); await click(p, 'money.denial.c-88.appeal'); await p.waitForTimeout(250);
    const o = await p.evaluate(() => {
      const close = document.querySelector('[data-testid="money.appeal.close"], [data-testid^="money.appeal"][data-testid$="close"]');
      if (!close) return { closeMissing: true };
      const b = close.getBoundingClientRect();
      return { top: Math.round(b.top), viewport: window.innerHeight, inView: b.top >= 0 && b.bottom <= window.innerHeight };
    });
    rec('R41', 'Opening the appeal packet scrolls Send into view and pushes its Close control off the top of the screen', 'docs/04: the way out of a drawer is reachable without hunting',
      !!o && (o.closeMissing === true || o.inView === false), o);
    await c.close();
  },
  async R42(b) { // the amount being agreed to is only in an accessible name
    const { c, p } = await ctx(b); await go(p, '#/biller/money');
    await click(p, 'money.era.era-1.postmatched'); await p.waitForTimeout(250);
    const o = await p.evaluate(() => {
      const row = document.querySelector('[data-testid="money.era.line.el-14.confirm"]');
      if (!row) return null;
      const card = row.closest('.card, .wrow, li, div');
      return { visibleText: (card ? card.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 200), ariaLabel: row.getAttribute('aria-label') || '' };
    });
    const amountInAria = !!o && /write-off/i.test(o.ariaLabel) && /\$\s?50/.test(o.ariaLabel);
    const amountVisible = !!o && /\$\s?50\.00/.test(o.visibleText);
    rec('R42', 'The contractual write-off the biller agrees to appears only in the button\u2019s accessible name, not on the row she reads', 'docs/13 feature 14: the read-back names what differs, in the words and numbers the actor is agreeing to',
      amountInAria && !amountVisible, o);
    await c.close();
  },
  async R43(b) { // focus moves to a tab that does not become the selected tab
    const { c, p } = await ctx(b); await go(p, '#/biller/money');
    await click(p, 'money.era.era-1.postmatched');
    await click(p, 'money.era.line.el-14.confirm'); await click(p, 'money.era.line.el-22.confirm'); await click(p, 'money.era.line.el-31.hold'); await p.waitForTimeout(300);
    const o = await p.evaluate(() => {
      const a = document.activeElement;
      const tid = a && a.getAttribute ? a.getAttribute('data-testid') : null;
      const sel = [...document.querySelectorAll('[data-testid^="money.tab."]')].filter((e) => e.getAttribute('aria-selected') === 'true').map((e) => e.getAttribute('data-testid'));
      return { focused: tid, selectedTabs: sel };
    });
    rec('R43', 'After the batch, focus moves to the Denials tab but the selected tab stays on ERA, so reaching the denial costs a tap', 'docs/04: the next action is one key away; focus and state do not disagree',
      !!o.focused && /money\.tab\./.test(o.focused) && !o.selectedTabs.includes(o.focused), o);
    await c.close();
  },
};

const browser = await chromium.launch({ headless: true });
try {
  for (const [id, fn] of Object.entries(CHECKS)) {
    if (ONLY && !ONLY.includes(id)) continue;
    try { await fn(browser); } catch (e) { rec(id, 'check crashed', '', false, { error: e.message }); }
  }
} finally { await browser.close(); }

const out = args.json || path.join('/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad', 'reproduce.json');
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const yes = results.filter((r) => r.reproduced);
console.log('id   reproduced  claim');
for (const r of results) console.log(r.id.padEnd(4), (r.reproduced ? 'YES' : 'no ').padEnd(11), r.claim.slice(0, 95));
console.log(`\n${yes.length} of ${results.length} reproduced. Detail: ${out}`);
