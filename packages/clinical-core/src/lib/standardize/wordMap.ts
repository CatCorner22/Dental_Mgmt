import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { VAGUE_PHRASES, STALE_PHRASES, STIGMATIZING_PHRASES } from "@/lib/vocab/vague-phrases";
import { MISSPELLINGS, MEDICATION_WORDS } from "@/lib/vocab/misspellings";
import { SHORTHAND, SHORTHAND_OWNS } from "@/lib/vocab/shorthand";

// The word map: the practice's standard vocabulary, in one place, derived from
// the SAME tables the standardizer and the audit engine enforce.
//
// Derived, never retyped. A hand-maintained "here are our standard words" page
// is a page that drifts, and a vocabulary reference that disagrees with the
// rule enforcing it is worse than none — staff learn the page, the tool rejects
// them, and they stop trusting both.

export interface WordMapEntry {
  /** What people actually type. */
  avoid: string;
  /** What the standard says instead. */
  use: string;
  /** Whether the tool can make this change on its own. */
  auto: boolean;
}

export interface WordMapGroup {
  id: string;
  title: string;
  blurb: string;
  entries: WordMapEntry[];
}

function sortByAvoid(a: WordMapEntry, b: WordMapEntry): number {
  return a.avoid.localeCompare(b.avoid);
}

export function buildWordMap(): WordMapGroup[] {
  const autoAbbr: WordMapEntry[] = [];
  const askAbbr: WordMapEntry[] = [];
  for (const a of BANNED_ABBREVIATIONS) {
    // Skip anything the shorthand table has taken over. Listing it here would
    // advertise a replacement the transformer never performs — and this file's
    // whole premise is that a reference disagreeing with the rule enforcing it
    // is worse than no reference. Those entries appear under the first-use
    // section instead, with the behaviour they actually have.
    if (SHORTHAND_OWNS.has(a.id)) continue;
    const entry = { avoid: a.display, use: a.replacement, auto: a.severityClass === "style" };
    (entry.auto ? autoAbbr : askAbbr).push(entry);
  }

  const spellings: WordMapEntry[] = [];
  const drugSpellings: WordMapEntry[] = [];
  for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
    const isDrug = MEDICATION_WORDS.has(right.toLowerCase());
    (isDrug ? drugSpellings : spellings).push({ avoid: wrong, use: right, auto: !isDrug });
  }

  const definedOnFirstUse: WordMapEntry[] = [];
  const ambiguousShorthand: WordMapEntry[] = [];
  for (const sh of SHORTHAND) {
    if (sh.alternatives) {
      ambiguousShorthand.push({
        avoid: sh.display,
        use: `could mean: ${sh.alternatives.join("; ")}`,
        auto: false
      });
    } else {
      definedOnFirstUse.push({
        avoid: sh.display,
        use: `${sh.expansion} (${sh.display})`,
        auto: true
      });
    }
  }

  return [
    {
      id: "shorthand",
      title: "Terms of art — written out on first use",
      blurb:
        "The tool spells these out the first time they appear and puts the shorthand in parentheses; every later use stays short. That is how a note reads clearly to an insurer or a specialist without making you type the same phrase six times.",
      entries: definedOnFirstUse.sort(sortByAvoid)
    },
    {
      id: "ambiguous-shorthand",
      title: "Initialisms with more than one meaning",
      blurb:
        "These mean different things in different parts of a chart, so the tool will not pick for you. Write the one you mean.",
      entries: ambiguousShorthand.sort(sortByAvoid)
    },
    {
      id: "auto-abbreviations",
      title: "Shorthand the tool expands for you",
      blurb:
        "One standard expansion each, so pressing Standardize is safe — nothing about the patient changes, only the wording.",
      entries: autoAbbr.sort(sortByAvoid)
    },
    {
      id: "ask-abbreviations",
      title: "Shorthand only you can expand",
      blurb:
        "The right expansion depends on facts the shorthand hides, so the tool flags these and leaves them to you.",
      entries: askAbbr.sort(sortByAvoid)
    },
    {
      id: "vague",
      title: "Phrases to replace with facts",
      blurb:
        "These are the phrases that fail hardest when a note is read back years later. The replacement is the clinical detail itself, which is why the tool never writes it for you.",
      entries: VAGUE_PHRASES.map((p) => ({ avoid: p.display, use: p.replacement, auto: false })).sort(
        sortByAvoid
      )
    },
    {
      id: "stigmatizing",
      title: "Words that label the patient",
      blurb:
        "Patients read these notes. Each of these describes a person rather than the care, and the right replacement depends on what actually happened — so the tool points them out and leaves the wording to you.",
      entries: STIGMATIZING_PHRASES.map((p) => ({
        avoid: p.display,
        use: p.replacement,
        auto: false
      })).sort(sortByAvoid)
    },
    {
      id: "stale",
      title: "Copy-forward and placeholder residue",
      blurb: "Text carried over from a previous note or left as a placeholder.",
      entries: STALE_PHRASES.map((p) => ({ avoid: p.display, use: p.replacement, auto: false })).sort(
        sortByAvoid
      )
    },
    {
      id: "spelling",
      title: "Spellings the tool corrects",
      blurb: "Common typos with one unambiguous correction.",
      entries: spellings.sort(sortByAvoid)
    },
    {
      id: "drug-spelling",
      title: "Medication spellings — never corrected automatically",
      blurb:
        "A drug name is the one thing this tool will not guess at. These are flagged for you to confirm against the source record.",
      entries: drugSpellings.sort(sortByAvoid)
    }
  ];
}

export function wordMapCounts(groups: WordMapGroup[]): { total: number; auto: number } {
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const auto = groups.reduce((n, g) => n + g.entries.filter((e) => e.auto).length, 0);
  return { total, auto };
}
