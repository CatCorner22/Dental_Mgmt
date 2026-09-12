# UI and UX review against the research on intuitive design and cognitive load

Status: method, measurements and heuristics registered 2026-09-12 before any finding was recorded and before any change was made. Results are appended below the line "Results"; nothing above that line changes after it.

## Why this review exists

`docs/15-function-audit.md` established that every function in the prototype does what its label says and that the screens agree with their own contracts. It did not ask whether the interface is easy to read, easy to learn, or easy on a tired person at 4 pm. The owner asked for that next, in these words: review the UI and UX; compare to research regarding intuitive website design and design for reducing cognitive load; make the interface accessible, reasonably customizable, and modern with a clean, extremely low cognitive load; ensure the experience is consistent and very intuitive.

Each of those words is given a measurable meaning below, so that the review can fail. "Modern" and "clean" are the two that resist measurement; they are treated as the consequences of the others (few colour roles, one type scale, one spacing rhythm, no ornament that carries no information) rather than as targets of their own.

## What is being measured, and how

Every measurement is taken from the live prototype under headless Chromium at three widths — 1280 px (desk), 1024 px (operatory) and 420 px (phone) — in both themes, on the seeded data, before and after the changes. The same scripts run both times, so the report compares numbers rather than impressions.

| Instrument | What it measures | Where it lives |
|---|---|---|
| `scripts/a11y-check.mjs` | axe-core 4.13.0 (vendored under `scripts/vendor/axe-core/`, MPL-2.0) run against 17 surfaces × 2 themes × 3 widths with the WCAG 2.0/2.1/2.2 A and AA rule sets plus axe's best-practice rules; every distinct violation with the criterion it maps to and the first offending node. Exit 1 on any serious or critical violation. | repository, permanent |
| `scripts/proto-check.mjs` | Already in place: 44 px targets with 8 px gaps at four widths, text contrast at 4.5:1 / 3:1 by size, no animation under reduced motion, no horizontal page scroll, focus ring on every control and no focus trap, a `data-testid` on every control, the five flows within their tap budgets. | repository, permanent |
| `measure.cjs` (review scratch) | Per screen: controls on the page and above the fold; buttons by identity (irreversible, reversible, quiet, held); top-bar control count and how many rows it wraps to; cards and the maximum and mean controls per card; chips and the size of the chip vocabulary; longest button label in words and every label over three words; heading count, `h1` word count, sub-line word count; prose words above the fold; longest prose run standing before a finish button; distinct text and background colours painted; font sizes in use; page height as a multiple of the viewport. | recorded in this document's tables |
| Baseline screenshots | 17 surfaces × 3 widths × 2 themes, full page, taken before any change, so a reviewer can see what a number describes. | `knowledge/reviews/ux-review/baseline/` |
| Heuristic audit | One agent per screen scores every registered heuristic with the measurement or the screenshot that supports the score; eight cross-cutting lenses (visual hierarchy, density, typography, colour and contrast, motion, keyboard and focus, consistency of components, first-screen comprehension) look across screens; findings are deduplicated into root causes and every root cause is put to an adversarial verifier whose default position is "refuted". | `knowledge/reviews/ux-review/` |

## How the research was gathered, and what that means for the citations

The environment's network policy blocks most of the web, including w3.org, nngroup.com, developer.mozilla.org and the NHS, GOV.UK and USWDS design-system sites. It allows GitHub and the npm registry. The research agents were therefore instructed to fetch primary sources from GitHub — the WCAG 2.2 normative text and understanding documents from `w3c/wcag`, the axe-core rule descriptions from `dequelabs/axe-core`, and the source settings and component documentation of `nhsuk/nhsuk-frontend`, `alphagov/govuk-frontend` and `uswds/uswds` — and to mark every heuristic in one of three ways:

- **fetched primary source** — the page was fetched in this session and the quoted text appears on it verbatim; a critic re-fetched every such quote and struck any it could not find;
- **fetched secondary source** — as above, but the page is a design system's or vendor's reading of the research rather than the research itself;
- **training knowledge, unverified** — the heuristic is one the field relies on (Hick's law, Miller's span, Nielsen's ten) but no primary source could be fetched; it is included because the owner would rather see it labelled than omitted, and it is never presented as verified.

A heuristic's label is printed beside it in the table below. Readers who need the primary text for an unverified row should treat it as a claim to check, not a fact established here.

## The words, made measurable

| Owner's word | Meaning adopted here | Where it is measured |
|---|---|---|
| Accessible | WCAG 2.2 Level AA with no serious or critical axe violation; AAA where it costs nothing (enhanced contrast on body text, 44 px targets already exceed 2.5.8's 24 px minimum) | `a11y-check`, `proto-check` targets/contrast/focus/motion |
| Reasonably customizable | A person can set text size, density, contrast, motion, colour scheme and a colour-vision aid; each honours the operating-system preference first, persists per user, and never drops a shared or operatory device below the 44 px floor; the settings surface itself has at most eight choices | settings probe in the audit; `proto-check` targets on every setting combination |
| Modern, clean | One type scale, one spacing rhythm, at most three button identities visible on a screen, no decorative element that carries no information, no ornament competing with data | `measure.cjs` identities, font sizes, colours |
| Extremely low cognitive load | The counts the heuristics bound: choices per group, controls per card, prose on the finish path, top-bar controls, chip vocabulary, sub-line words | `measure.cjs` |
| Consistent | One word per concept (already policed by `docs/15`), one identity per verb, one placement per recurring control, one colour role per meaning across every screen and both themes | consistency lens in the audit |
| Very intuitive | A first-day temp can name what each screen is for and what to do first from the screen alone; every state change is acknowledged; every irreversible action is distinct; recognition never recall | first-screen lens; `proto-check` flows |

## Status vocabulary for findings

| Status | Meaning |
|---|---|
| breach | The measurement is on the wrong side of the heuristic's threshold, or a reviewer scores the screenshot against a "judgement" heuristic and an adversarial verifier does not refute it |
| meets | The measurement is on the right side of the threshold |
| not measurable here | The heuristic needs a real user, a screen reader, or data the seed does not hold; recorded as a gap, never as a pass |

## Declared constraints

| Constraint | Effect |
|---|---|
| Reviewers are language-model agents driving headless Chromium and reading screenshots | They measure structure and read images; they do not experience time pressure, gloves, or a screen reader |
| Primary sources are limited to what GitHub hosts | Every row says whether it was verified; the unverified rows are not fewer, only labelled |
| The prototype is static and seeded | Only seeded states exist; a finding about a state the seed cannot produce is recorded, not fixed |
| Two rounds of automated review preceded this one | Some of what this review would have found is already fixed; the baseline it measures is the merged state after `docs/15` |

## What this review cannot prove

Real usability, time on task, learnability in one shift, screen-reader behaviour, satisfaction, or that any person finds the result "intuitive". It can prove that the interface is on the right side of every measurable threshold the research supports, that it was on the wrong side of some of them before, and that the changes did not regress anything the earlier harnesses guard.

---

## Registered heuristics

_Pending: the research workflow is running. This table is appended when it completes and before the audit runs._

---

## Results

_Pending: the audit and the changes follow the registration above._
