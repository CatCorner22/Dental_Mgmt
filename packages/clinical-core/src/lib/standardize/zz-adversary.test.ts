import { describe, it } from "vitest";
import { standardize } from "./standardize";
import { SHORTHAND } from "@/lib/vocab/shorthand";
import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";

function log(label: string, input: string) {
  const a = standardize(input);
  const b = standardize(a.text);
  // eslint-disable-next-line no-console
  console.log(
    `\n### ${label}\n  IN    : ${JSON.stringify(input)}\n  ONCE  : ${JSON.stringify(a.text)}\n  TWICE : ${JSON.stringify(b.text)}\n  IDEMP : ${a.text === b.text}\n  FLAGS : ${JSON.stringify(a.flags.map((f) => f.kind + ":" + f.display))}`
  );
  return a;
}

describe("F. ambiguous initialisms with no `alternatives`", () => {
  it("F1 CC / PSA / EXT / CAL / BP in their OTHER clinical sense", () => {
    log("CC as cubic centimetre", "gave 2 CC of 2% lidocaine");
    log("CC as chief complaint", "CC: tooth hurts");
    log("PSA as prostate-specific antigen", "hx of elevated PSA and BP 150/95");
    log("EXT as extension", "EXT 4 on the temporary");
    log("CAL as calcium", "CAL supplement daily");
    log("BOP", "BOP negative at all sites");
    log("MTA / IRM", "MTA placed, IRM temporary");
  });
});

describe("G. case-sensitivity coverage holes", () => {
  it("G1 shorthand table is case-SENSITIVE; banned twin is skipped => dead", () => {
    const cases = [
      "rct started", "Rct started", "srp completed", "ohi given", "poi given",
      "PANO reviewed", "Pano reviewed", "NKA per patient", "BWs taken", "BWXs taken",
      "nkda per patient", "bw taken", "la given", "Fmx reviewed", "tmj tender"
    ];
    for (const c of cases) log("case: " + c, c);
  });

  it("G2 which banned entries are dead code", () => {
    const OWNS = new Set(["bw", "pano", "fmx", "rct", "srp", "ohi", "nkda", "la", "n2o", "prn", "fu"]);
    for (const a of BANNED_ABBREVIATIONS) {
      if (!OWNS.has(a.id)) continue;
      const sh = SHORTHAND.find((s) => s.id === a.id) ?? SHORTHAND.find((s) => s.display.toLowerCase().startsWith(a.id));
      // eslint-disable-next-line no-console
      console.log(
        `  banned '${a.id}' (${a.pattern}) SKIPPED; shorthand twin = ${sh ? `${sh.id} ${sh.pattern}` : "*** NONE ***"}`
      );
    }
  });
});

describe("H. formatting pass damage", () => {
  it("H1 assorted", () => {
    log("trailing comma", "no bleeding,");
    log("trailing dash list", "sites: MB, DB -");
    log("abbrev period midline", "Pt tolerated 2 mL. no bleeding noted");
    log("nbsp real", "probing depth 4 mm at #3");
    log("thin space", "4 mm pocket");
    log("percent glue", "40%oxygen");
    log("ellipsis", "pain\u2026 resolved");
    log("bidi isolate", "no caries \u2067on #3 4mm\u2069 noted");
    log("colon after number", "MOD:B restoration");
    log("semicolon end", "no bleeding;");
    log("decimal split", "0 .5 mL given");
  });

  it("H2 realistic full note, run twice (simulates a double-click of ✨)", () => {
    const note = [
      "pt presents for f/u after RCT on #14. NKDA. BP 120/80.",
      "4 x-rays and a BWX taken; PANO reviewed. FMS from last visit compared.",
      "2% lidocaine 1.8mL with 1:100,000 epi, N2O at 30%.",
      "amoxicilin 500mg t.i.d. for 7 days and ibuprofen 600mg p.r.n. pain.",
      "no bleeding, no swelling. tx plan discussed; poi given."
    ].join("\n");
    const one = standardize(note);
    const two = standardize(one.text);
    const three = standardize(two.text);
    // eslint-disable-next-line no-console
    console.log(
      `\n=== FULL NOTE ===\nINPUT:\n${note}\n\n--- after 1 click ---\n${one.text}\n\n--- after 2 clicks ---\n${two.text}\n\n--- after 3 clicks ---\n${three.text}\n\nFLAGS: ${JSON.stringify(one.flags.map((f) => f.kind + ":" + f.display))}`
    );
  });
});

describe("I. the `defined` regex, shown literally", () => {
  it("I1 what gets built", () => {
    for (const sh of SHORTHAND.slice(0, 8)) {
      const src = `${sh.expansion.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\(${sh.display}\\)`;
      // eslint-disable-next-line no-console
      console.log(`  ${sh.id.padEnd(6)} defined=/${src}/i`);
    }
    // Prove the escape is inert on a metachar-bearing string
    const s = "cone-beam (a.b) [c]";
    // eslint-disable-next-line no-console
    console.log(
      `  escape("${s}") =>`,
      JSON.stringify(s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")),
      " correct would be ",
      JSON.stringify(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  });
});
