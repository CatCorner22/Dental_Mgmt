#!/usr/bin/env node
/* Validates beta session files: front-matter, a ```json interview block with the required shape,
   and a `seq` range on every defect and confusion point. Exit 1 on the first invalid file.
   Usage: node scripts/beta/validate-session.mjs knowledge/reviews/beta-sessions/*.md */
import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: validate-session.mjs <files...>'); process.exit(2); }
let bad = 0;
const SEQ = /^\d+(-\d+)?(,\s*\d+(-\d+)?)*$/;
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const errs = [];
  if (!/^---\n[\s\S]*?\n---\n/.test(t)) errs.push('missing front-matter');
  if (!/^title:/m.test(t) || !/^type: review/m.test(t) || !/^date: /m.test(t)) errs.push('front-matter needs title, type: review, date');
  const m = t.match(/```json\n([\s\S]*?)\n```/);
  if (!m) errs.push('missing ```json interview block');
  else {
    let j; try { j = JSON.parse(m[1]); } catch (e) { errs.push('interview JSON does not parse: ' + e.message); }
    if (j) {
      for (const k of ['persona_id', 'tasks', 'frustrations', 'delights', 'would_choose', 'a11y_blockers', 'remove_one', 'add_one', 'quotes', 'defects']) if (!(k in j)) errs.push('interview missing ' + k);
      if (!Array.isArray(j.tasks) || !j.tasks.length) errs.push('tasks must be a non-empty array');
      else for (const tk of j.tasks) { for (const k of ['id', 'completed', 'taps', 'budget', 'event_count', 'errors', 'refusals', 'confusion']) if (!(k in tk)) errs.push('task ' + (tk.id || '?') + ' missing ' + k); for (const c of tk.confusion || []) if (!c.seq || !SEQ.test(String(c.seq)) || !c.quote) errs.push('task ' + tk.id + ' confusion point without seq range and quote'); }
      if (typeof j.would_choose !== 'number' || j.would_choose < 1 || j.would_choose > 5) errs.push('would_choose must be 1-5');
      if (!Array.isArray(j.frustrations) || j.frustrations.length > 3 || !Array.isArray(j.delights) || j.delights.length > 3) errs.push('frustrations and delights: at most 3 each');
      for (const d of j.defects || []) { for (const k of ['title', 'repro_steps', 'seq_range', 'severity_proposed', 'screen']) if (!(k in d)) errs.push('defect "' + (d.title || '?') + '" missing ' + k); if (d.seq_range && !SEQ.test(String(d.seq_range))) errs.push('defect "' + d.title + '" seq_range malformed'); }
    }
  }
  if (errs.length) { bad++; console.log('FAIL ' + f + '\n  - ' + errs.join('\n  - ')); } else console.log('ok   ' + f);
}
process.exit(bad ? 1 : 0);
