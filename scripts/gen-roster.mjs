#!/usr/bin/env node
/* Deterministic 30-persona beta panel roster.
   Usage: node scripts/gen-roster.mjs --seed 20260903 [--out knowledge/reviews/beta-panel-roster.json] [--cards knowledge/reviews/beta-panel/cards]
   Regeneration with the same seed is byte-identical. The trait fields are context for what each persona TESTS;
   they are never the persona's identity or a punchline. See docs/14-beta-test-report.md §Roster for the respect rules. */
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const SEED = Number(args.seed || 20260903);
const OUT = args.out || 'knowledge/reviews/beta-panel-roster.json';
const CARDS = args.cards || 'knowledge/reviews/beta-panel/cards';

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(SEED);
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const GROUPS = [
  { code: 'front_office', label: 'Front-office administrative staff', titles: ['Front-desk coordinator', 'Scheduling coordinator', 'Patient coordinator', 'Front-desk lead', 'Treatment coordinator'], home: 'frontdesk' },
  { code: 'back_office', label: 'Back-office administrative staff', titles: ['Insurance biller', 'Office manager', 'Billing coordinator', 'Accounts receivable specialist', 'Practice administrator'], home: 'biller' },
  { code: 'dentist', label: 'Dentists', titles: ['General dentist (owner)', 'Associate dentist', 'General dentist', 'Pediatric dentist', 'Prosthodontist (general practice)'], home: 'dentist' },
  { code: 'oral_surgeon', label: 'Oral surgeons', titles: ['Oral and maxillofacial surgeon', 'Oral surgeon (referral practice)', 'Oral surgeon (hospital-affiliated)', 'Oral surgeon (group practice)', 'Oral surgery resident (final year)'], home: 'surgeon' },
  { code: 'hygienist', label: 'Dental hygienists', titles: ['Registered dental hygienist', 'Hygienist (perio focus)', 'Hygienist (pediatric focus)', 'Hygiene lead', 'Hygienist (temp agency)'], home: 'hygienist' },
  { code: 'assistant', label: 'Dental assistants', titles: ['Registered dental assistant', 'Dental assistant (surgical)', 'Expanded-functions dental assistant', 'Dental assistant (new hire)', 'Sterilization and chairside assistant'], home: 'frontdesk' },
];

// Quotas across 30 (each list is assigned Latin-square style so no trait clusters in one profession).
const GENDER = shuffle(['man', 'man', 'man', 'man', 'man', 'man', 'man', 'man', 'man', 'woman', 'woman', 'woman', 'woman', 'woman', 'woman', 'woman', 'woman', 'woman', 'woman', 'woman', 'trans man', 'trans man', 'trans man', 'trans woman', 'trans woman', 'trans woman', 'nonbinary', 'nonbinary', 'nonbinary', 'nonbinary']);
const PRONOUNS = { man: 'he/him', woman: 'she/her', 'trans man': 'he/him', 'trans woman': 'she/her', nonbinary: 'they/them' };
const AGE_BANDS = [[19, 24], [25, 34], [35, 44], [45, 54], [55, 68]];
const ABILITY = shuffle([
  'low vision (uses 150% zoom and high contrast)', 'deuteranopia (red-green color-vision deficiency)', 'essential tremor (fine pointing is hard; prefers large targets and keys)', 'hard of hearing (no reliance on sound cues)', 'ADHD (loses place when a screen changes under me)', 'dyslexia (reads slowly; prefers glyphs and short words)',
  'chronic back pain (stands; avoids long mouse sessions)', 'wheelchair user (desk height fixed; screen at arm\'s length)', 'third-trimester pregnancy (fatigue; short sessions)', 'non-native English (Spanish first language; reads incumbent jargon literally)', 'low vision (uses 150% zoom and high contrast)', 'deuteranopia (red-green color-vision deficiency)', 'essential tremor (fine pointing is hard; prefers large targets and keys)', 'non-native English (Vietnamese first language)', 'ADHD (loses place when a screen changes under me)',
  'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none',
]);
const PMS = shuffle(['Dentrix', 'Dentrix', 'Dentrix', 'Dentrix', 'Dentrix', 'Dentrix', 'Dentrix', 'Eaglesoft', 'Eaglesoft', 'Eaglesoft', 'Eaglesoft', 'Eaglesoft', 'Eaglesoft', 'Open Dental', 'Open Dental', 'Open Dental', 'Open Dental', 'Open Dental', 'Curve', 'Curve', 'Curve', 'Curve', 'Curve', 'Curve Hero', 'none', 'none', 'none', 'Denticon', 'CareStack', 'tab32']);
const TECH = shuffle([1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 2, 3, 4, 1, 5]);
const DEVICE = { front_office: ['desk', 'desk', 'shared', 'desk', 'phone'], back_office: ['desk', 'desk', 'desk', 'phone', 'desk'], dentist: ['operatory', 'phone', 'operatory', 'shared', 'desk'], oral_surgeon: ['operatory', 'operatory', 'phone', 'desk', 'shared'], hygienist: ['operatory', 'operatory', 'shared', 'operatory', 'operatory'], assistant: ['shared', 'operatory', 'shared', 'operatory', 'shared'] };
const NAMES = shuffle(['Jordan Ellis', 'Priya Natarajan', 'Marcus Bell', 'Ana Lucía Torres', 'Devin Okafor', 'Hannah Weiss', 'Tomás Reyes', 'Kenji Watanabe', 'Simone Baptiste', 'Grace Lindqvist', 'Ravi Menon', 'Dana Kowalski', 'Elijah Brooks', 'Noor Haddad', 'Sasha Petrov', 'Beatriz Almeida', 'Quinn Harper', 'Malik Johnson', 'Ingrid Sørensen', 'Wei Zhang', 'Rosa Delgado', 'Theo Marchetti', 'Aaliyah Grant', 'Linh Nguyen', 'Caleb Fisher', 'Yara Mansour', 'Owen Gallagher', 'Fatima Rahman', 'Lucas Moreau', 'Imani Carter']);

// Trait → what it changes about testing (shared library; combined with profession below)
const TRAIT_TEST = {
  'low vision': 'I run at 150% zoom with high contrast and check that nothing overflows or truncates, that focus is visible, and that glyph plus word carry every status.',
  deuteranopia: 'I switch on grayscale and rank the queue I work from; if two states collapse into one, that is a defect.',
  'essential tremor': 'I use keys before the mouse and measure every target I must hit; a 32 px cell or an 8 px gap missing is a defect.',
  'hard of hearing': 'I check that nothing depends on a sound cue and that every state change is visible in place.',
  ADHD: 'I note every place the screen changes under me, every modal that steals focus, and every moment I lose the object I was working on.',
  dyslexia: 'I time how long each verb line takes to read; more than eight words or a sentence where a glyph would do is a finding.',
  'chronic back pain': 'I work standing with keys and short sessions; long mouse paths and deep menus cost me.',
  wheelchair: 'My screen is at arm\'s length on a fixed desk; I check that targets and text hold at 820 px wide and 1024 px wide.',
  pregnancy: 'I test in short bursts; anything that forces me to re-find my place after a break is a finding.',
  'non-native English': 'I read incumbent jargon literally and search for the words my last office used; the palette must translate them.',
  none: 'No access adjustments; I test the flow at the speed of a busy morning.',
};
function traitKey(a) { for (const k of Object.keys(TRAIT_TEST)) if (a.toLowerCase().startsWith(k.toLowerCase())) return k; return 'none'; }

const ROLE_TEST = {
  front_office: ['Arrive and seat from the Board in one tap each', 'Check out a $44 patient portion in at most 4 clicks', 'Check out a $0 patient portion without a dead end', 'Use the self-pay toggle for a patient who pays in full', 'Handle a note-not-filed patient at the window without becoming the note cop', 'Find a patient with three letters and a second identifier'],
  back_office: ['Post the matched ERA lines and read back only the differing lines', 'Dispute a contract underpayment', 'Appeal denial c-88 from the record', 'Request approval on a $410 courtesy write-off and see it held, never dead', 'Find "Office Journal" and "walkout statement" through the palette', 'Send a held statement with a reason'],
  dentist: ['Open the seated chart from Exams to sign', 'Chart #30 DO from the hygienist tag, plan, note, and File in at most 10 taps', 'Hit the money-in-note gate and fix it with one control', 'Confirm the read-back line before File', 'Review the plan card estimate with its rule trace'],
  oral_surgeon: ['Open the referred-in consult (Dr. Serrano) from Exams to sign', 'Chart a surgical extraction #17 with IV sedation and File the sedation note', 'Switch author by PIN on a shared operatory tablet', 'Confirm the referral summary shows records forwarded', 'Check that the Board card reads Surgery by shape and word'],
  hygienist: ['Full-mouth six-point perio, keyboard only, in one pass with the prior exam ghosted', 'Undo a mistyped depth and skip a site without recording zero', 'Save the exam and read the derived note summary', 'Tag #30 for the dentist as a finding, not a diagnosis', 'Mark ready for exam', 'Run the screening lane'],
  assistant: ['Switch author by PIN on the shared tablet before charting', 'Arrive and seat a patient from the Board', 'Open Perio with the glove pad and record 12 sites by tapping', 'Confirm the chair strip shows initials and no patient data', 'Check that the temp first-shift rail retires on real events'],
};

const YEARS = (age, band) => Math.max(1, Math.min(age - 19, [1, 4, 9, 16, 25][band] + Math.floor(rnd() * 4)));

const roster = [];
let k = 0;
GROUPS.forEach((g, gi) => {
  for (let i = 0; i < 5; i++) {
    const band = (i + gi) % 5; // Latin square over age bands
    const [lo, hi] = AGE_BANDS[band];
    const age = lo + Math.floor(rnd() * (hi - lo + 1));
    const gender = GENDER[k]; const ability = ABILITY[k]; const pms = PMS[k]; const tech = TECH[k]; const name = NAMES[k];
    const device = DEVICE[g.code][i];
    const tk = traitKey(ability);
    const clinical = ['dentist', 'oral_surgeon', 'hygienist', 'assistant'].includes(g.code);
    const abilityNotes = [ability === 'none' ? null : ability, clinical ? 'gloved, often wet hands at chairside' : null].filter(Boolean);
    const id = 'bp-' + String(k + 1).padStart(2, '0');
    roster.push({
      id, group: g.code, group_label: g.label, role_title: g.titles[i], name, pronouns: PRONOUNS[gender], age, gender_identity: gender,
      ability_notes: abilityNotes, incumbent_pms: pms, tech_comfort: tech, years_in_role: YEARS(age, band), device_profile: device,
      theme_pref: (k % 3 === 0) ? 'dark' : 'light', motion_pref: tk === 'ADHD' || k % 7 === 0 ? 'reduced' : 'auto', grayscale: tk === 'deuteranopia',
      persona_home: g.home,
      what_my_trait_changes: TRAIT_TEST[tk] + (clinical ? ' At the chair I work gloved: any control smaller than 44 px or closer than 8 px to its neighbour is a defect I will hit.' : ''),
      voice_notes: 'Speaks plainly about the job; uses the words of the last office (' + pms + '); never a caricature of any trait; pronouns ' + PRONOUNS[gender] + ' throughout.',
      task_script_id: g.code, tasks: ROLE_TEST[g.code],
    });
    k++;
  }
});

// Quota assertions (fail loudly so the roster cannot drift)
const count = (fn) => roster.filter(fn).length;
const assert = (c, m) => { if (!c) { console.error('ROSTER QUOTA FAILED: ' + m); process.exit(1); } };
assert(roster.length === 30, '30 personas');
for (const g of GROUPS) assert(count((p) => p.group === g.code) === 5, '5 per group ' + g.code);
assert(count((p) => p.gender_identity === 'trans man') === 3 && count((p) => p.gender_identity === 'trans woman') === 3 && count((p) => p.gender_identity === 'nonbinary') === 4, 'gender quotas');
assert(count((p) => p.ability_notes.some((a) => !a.startsWith('gloved'))) >= 12, 'at least 12 with an access-relevant trait');
assert(roster.every((p) => p.ability_notes.length <= 2), 'no persona carries more than two notes');
assert(Math.min(...roster.map((p) => p.age)) >= 19 && Math.max(...roster.map((p) => p.age)) <= 68, 'ages 19-68');
for (const g of GROUPS) assert(new Set(roster.filter((p) => p.group === g.code).map((p) => AGE_BANDS.findIndex(([lo, hi]) => p.age >= lo && p.age <= hi))).size === 5, 'every age band in ' + g.code);

const out = { seed: SEED, generated_for: 'docs/14-beta-test-report.md', respect_rules: ['A trait is context for what the persona tests, never the persona\'s identity or a punchline.', 'No medical detail beyond what changes the interaction.', 'Pronouns are used consistently.', 'No persona is reduced to a single attribute; each has a job, a history with an incumbent system, and a device.'], personas: roster };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
fs.mkdirSync(CARDS, { recursive: true });
for (const p of roster) {
  const card = `---
title: "Beta panel persona ${p.id}: ${p.name}, ${p.role_title}"
type: review
date: 2026-09-03
source: scripts/gen-roster.mjs --seed ${SEED}
tags: [beta-panel, persona, ${p.group}]
---

# ${p.name} (${p.pronouns}) · ${p.role_title}

| Field | Value |
|---|---|
| Group | ${p.group_label} |
| Age | ${p.age} |
| Years in role | ${p.years_in_role} |
| Last system | ${p.incumbent_pms} |
| Tech comfort | ${p.tech_comfort} of 5 |
| Device today | ${p.device_profile} |
| Theme, motion | ${p.theme_pref}, ${p.motion_pref}${p.grayscale ? ', grayscale check on' : ''} |
| Access notes | ${p.ability_notes.length ? p.ability_notes.join('; ') : 'none'} |

## What my situation changes about how I test

${p.what_my_trait_changes}

## Tasks I run today

${p.tasks.map((t, i) => (i + 1) + '. ' + t).join('\n')}

## Voice

${p.voice_notes}
`;
  fs.writeFileSync(path.join(CARDS, p.id + '.md'), card);
}
console.log('roster written: ' + OUT + ' (' + roster.length + ' personas); cards in ' + CARDS);
