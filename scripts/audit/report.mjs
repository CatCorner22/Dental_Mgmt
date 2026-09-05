#!/usr/bin/env node
/* Builds the Results section of docs/15 from the function audit's result files.
   Universe: node scripts/audit/inventory.mjs --json (every function in prototype/js).
   Inputs (all optional; a missing input prints as pending):
     <audit>/<unit>/result.json        per-file audits   {unit, functions[], findings[], gaps}
     <audit>/lens-<id>/result.json     lenses            {lens, coverage, findings[], gaps}
     <audit>/dedup/result.json         root causes       {root_causes[], discarded[]}
     <audit>/verify/<slug>/result.json verdicts          {file, verdicts[]}
     <audit>/critic/result.json        completeness      {rows, missing[], ...}
     --fixes <path>                    {root_id: {status: 'fixed'|'open'|'wontfix', check?, note?}}
   node scripts/audit/report.mjs --audit <dir> [--fixes fixes.json] [--out fragment.md] [--json summary.json]
   The function table rows are shaped `| \`name\` | \`file\` | line | status | ... |` because scripts/verify-docs.sh
   checks that every inventoried function has exactly such a row. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const AUDIT = args.audit || '/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/audit';
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const rel = (f) => (f || '').replace(/^prototype\/js\//, '');
const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim();
const clip = (s, n) => { s = esc(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

const inventory = JSON.parse(execFileSync('node', [path.join(ROOT, 'scripts/audit/inventory.mjs'), '--json'], { encoding: 'utf8' }));
const universe = Object.entries(inventory).flatMap(([file, fns]) => fns.map((f) => ({ file, name: f.name, line: f.line, kind: f.kind })));

const units = [], lenses = [];
for (const d of fs.existsSync(AUDIT) ? fs.readdirSync(AUDIT).sort() : []) {
  const r = readJson(path.join(AUDIT, d, 'result.json')); if (!r) continue;
  if (d.startsWith('lens-')) lenses.push(r); else if (r.functions) units.push(r);
}
const dedup = readJson(path.join(AUDIT, 'dedup', 'result.json'));
const critic = readJson(path.join(AUDIT, 'critic', 'result.json'));
const verdicts = [];
const vdir = path.join(AUDIT, 'verify');
if (fs.existsSync(vdir)) for (const d of fs.readdirSync(vdir).sort()) { const r = readJson(path.join(vdir, d, 'result.json')); if (r && r.verdicts) verdicts.push(...r.verdicts); }
const fixes = args.fixes ? readJson(args.fixes) || {} : {};

// ---- match every inventoried function to its audit row (file + name; nearest line within 8) ----
const rows = units.flatMap((u) => u.functions.map((f) => ({ ...f, unit: u.unit })));
const byKey = new Map();
for (const r of rows) { const k = r.file + '::' + r.name; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(r); }
const used = new Set();
const matched = universe.map((fn) => {
  const cands = (byKey.get(fn.file + '::' + fn.name) || []).filter((r) => !used.has(r)).sort((a, b) => Math.abs(a.line - fn.line) - Math.abs(b.line - fn.line));
  const row = cands.find((r) => Math.abs(r.line - fn.line) <= 8) || null;
  if (row) used.add(row);
  return { ...fn, row };
});
const unmatchedRows = rows.filter((r) => !used.has(r));
const noRow = matched.filter((m) => !m.row);

// ---- findings → root causes → verdicts → fixes ----
const allFindings = [...units.flatMap((u) => u.findings || []), ...lenses.flatMap((l) => l.findings || [])];
const findingToRoot = new Map();
for (const rc of (dedup && dedup.root_causes) || []) for (const id of rc.member_ids || []) findingToRoot.set(id, rc.root_id);
const verdictOf = new Map(verdicts.map((v) => [v.root_id, v]));
const rootState = (rc) => {
  const v = verdictOf.get(rc.root_id); const fx = fixes[rc.root_id];
  if (!v) return 'pending verification';
  if (!v.reproduced) return 'refuted';
  if (fx && fx.status === 'fixed') return 'fixed' + (fx.check ? ' · ' + fx.check : '');
  if (fx && fx.status === 'wontfix') return 'open (declined: ' + (fx.note || 'see text') + ')';
  return 'open';
};
const statusText = (m) => {
  if (!m.row) return 'no row';
  if (m.row.status !== 'broken') return m.row.status;
  const roots = [...new Set((m.row.finding_ids || []).map((id) => findingToRoot.get(id)).filter(Boolean))];
  if (!roots.length) return 'broken';
  const states = roots.map((id) => rootState({ root_id: id }));
  if (states.every((s) => s.startsWith('fixed'))) return 'broken → fixed';
  if (states.every((s) => s === 'refuted')) return 'operational (finding refuted)';
  if (states.some((s) => s.startsWith('open'))) return 'broken · open';
  return 'broken · ' + states[0];
};

// ---- counts ----
const count = (arr, key) => arr.reduce((m, x) => { const k = key(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const bucket = (s) => s === 'no row' ? s : s.includes('fixed') ? 'broken → fixed' : s.startsWith('operational') ? 'operational' : s.startsWith('broken') ? 'broken' : s;
const statusCounts = count(matched, (m) => bucket(statusText(m)));
const rootCauses = ((dedup && dedup.root_causes) || []).slice().sort((a, b) => a.severity.localeCompare(b.severity) || a.root_id.localeCompare(b.root_id, undefined, { numeric: true }));
const confirmed = rootCauses.filter((rc) => verdictOf.get(rc.root_id) && verdictOf.get(rc.root_id).reproduced);
const fixedCount = confirmed.filter((rc) => fixes[rc.root_id] && fixes[rc.root_id].status === 'fixed').length;

// ---- markdown ----
const L = [];
L.push(`### Coverage`, '');
L.push(`| Measure | Count |`, `|---|---|`);
L.push(`| Functions in \`prototype/js\` (\`scripts/audit/inventory.mjs\`) | ${universe.length} |`);
L.push(`| Functions with an audit row | ${universe.length - noRow.length} |`);
L.push(`| Functions with no row | ${noRow.length} |`);
L.push(`| Audit rows that match no inventoried function | ${unmatchedRows.length} |`);
L.push(`| Per-file audits returned | ${units.length} of 13 |`);
L.push(`| Lenses returned | ${lenses.length} of 8 |`);
L.push(`| Raw findings | ${allFindings.length} |`);
L.push(`| Root causes after dedup | ${dedup ? rootCauses.length : 'pending'} |`);
L.push(`| Root causes reproduced by an adversarial verifier | ${verdicts.length ? confirmed.length + ' of ' + verdicts.length + ' verified' : 'pending'} |`);
L.push(`| Reproduced root causes fixed | ${fixedCount} |`);
L.push('');
L.push(`### Status of every function`, '');
L.push(`| Status | Functions |`, `|---|---|`);
for (const [k, v] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${v} |`);
L.push('');
if (noRow.length) { L.push(`Functions with no audit row: ${noRow.map((m) => '`' + rel(m.file) + ':' + m.name + '`').join(', ')}.`, ''); }
if (unmatchedRows.length) { L.push(`Audit rows that match no inventoried function (renamed or mis-lined): ${unmatchedRows.map((r) => '`' + rel(r.file) + ':' + r.name + '@' + r.line + '`').join(', ')}.`, ''); }

L.push(`### By file`, '');
L.push(`| File | Functions | Operational | Broken | Fixed | Unreachable | Dead | Not exercised | Findings |`, `|---|---|---|---|---|---|---|---|---|`);
const files = [...new Set(universe.map((u) => u.file))];
for (const f of files) {
  const ms = matched.filter((m) => m.file === f); const st = ms.map(statusText);
  const n = (p) => st.filter((s) => p(s)).length;
  const findings = allFindings.filter((x) => x.file === f).length;
  L.push(`| \`${rel(f)}\` | ${ms.length} | ${n((s) => s.startsWith('operational'))} | ${n((s) => s.startsWith('broken') && !s.includes('fixed'))} | ${n((s) => s.includes('fixed'))} | ${n((s) => s === 'unreachable')} | ${n((s) => s === 'dead')} | ${n((s) => s === 'not_exercised')} | ${findings} |`);
}
L.push('');

L.push(`### Lenses`, '');
if (!lenses.length) L.push('_Pending: no lens has returned yet._', '');
else {
  L.push(`| Lens | Findings | Coverage | Gaps |`, `|---|---|---|---|`);
  for (const l of lenses) L.push(`| ${l.lens} | ${(l.findings || []).length} | ${clip(l.coverage, 220)} | ${clip(l.gaps, 220)} |`);
  L.push('');
}

L.push(`### Root causes`, '');
if (!dedup) L.push('_Pending: dedup has not returned._', '');
else {
  L.push(`| Id | Sev | Kind | Where | Root cause | Members | State |`, `|---|---|---|---|---|---|---|`);
  for (const rc of rootCauses) L.push(`| ${rc.root_id} | ${rc.severity} | ${rc.kind} | \`${rel(rc.file)}:${rc.line}\` | ${clip(rc.title, 140)}${rc.known_in_docs14 ? ' _(known, docs/14)_' : ''} | ${(rc.member_ids || []).length} | ${rootState(rc)} |`);
  L.push('');
  if (dedup.discarded && dedup.discarded.length) { L.push(`Discarded at dedup (no measurement, exact duplicate, or contradicted by the code): ${dedup.discarded.map((d) => d.id).join(', ')}.`, ''); }
}

if (critic) {
  L.push(`### Completeness critic`, '');
  L.push(`${esc(critic.verdict)}`, '');
  if (critic.not_exercised && critic.not_exercised.length) L.push(`Not exercised (${critic.not_exercised.length}): ${critic.not_exercised.map((x) => '`' + esc(x) + '`').join('; ')}.`, '');
  if (critic.lens_gaps && critic.lens_gaps.length) { L.push('Lens gaps:', ''); for (const g of critic.lens_gaps) L.push(`- ${esc(g)}`); L.push(''); }
}

L.push(`### Every function`, '');
L.push(`One row per function in \`prototype/js\`, in file order. Status is the audited state; "broken → fixed" means every root cause behind the row was reproduced and fixed in this round, with its check named in the root-cause table. Evidence is the auditor's own measurement, clipped; the full text is in the audit's result files under \`knowledge/reviews/function-audit/\`.`, '');
L.push(`| Function | File | Line | Status | Reached by | Evidence |`, `|---|---|---|---|---|---|`);
for (const m of matched) {
  const r = m.row;
  L.push(`| \`${m.name}\` | \`${rel(m.file)}\` | ${m.line} | ${statusText(m)} | ${r ? clip(r.reached_by, 90) : '—'} | ${r ? clip(r.evidence, 110) : 'no audit row'} |`);
}
L.push('');

const md = L.join('\n');
if (args.out) fs.writeFileSync(args.out, md); else process.stdout.write(md);
if (args.json) fs.writeFileSync(args.json, JSON.stringify({ universe: universe.length, noRow: noRow.length, statusCounts, rawFindings: allFindings.length, rootCauses: rootCauses.length, verified: verdicts.length, confirmed: confirmed.length, fixed: fixedCount, units: units.length, lenses: lenses.length, byFile: files.map((f) => ({ file: rel(f), functions: matched.filter((m) => m.file === f).length, statuses: count(matched.filter((m) => m.file === f), statusText) })), rootCauseList: rootCauses.map((rc) => ({ ...rc, state: rootState(rc), verdict: verdictOf.get(rc.root_id) || null })) }, null, 1));
console.error(`report: ${universe.length} functions, ${universe.length - noRow.length} rows matched, ${allFindings.length} findings, ${rootCauses.length} root causes, ${confirmed.length} confirmed, ${fixedCount} fixed`);
