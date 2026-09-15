import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCurveHeroReport } from "./parse";
import { CURVE_HERO_REPORT_KINDS, type CurveHeroReportKind } from "./types";
import { stageParsedRows, summarizeStagedRows } from "./validate";

function usage(): never {
  console.error(
    "Usage: pnpm import:curve --kind <day_sheet|ar_aging|deposit_slip|patient_header|coverage_header> --file <path>"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
let kind: CurveHeroReportKind | undefined;
let filePath: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--kind") kind = args[++i] as CurveHeroReportKind;
  else if (args[i] === "--file") filePath = args[++i];
}

if (!kind || !filePath) usage();
if (!CURVE_HERO_REPORT_KINDS.includes(kind)) {
  console.error(`Unknown report kind: ${kind}`);
  usage();
}

function resolveInputPath(input: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageRoot = join(here, "..");
  const repoRoot = join(packageRoot, "..", "..");
  const candidates = [resolve(input), resolve(packageRoot, input), resolve(repoRoot, input)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return resolve(input);
}

const content = readFileSync(resolveInputPath(filePath), "utf8");
const parsed = parseCurveHeroReport(kind, content);
const staged = stageParsedRows(parsed.rows);
const summary = summarizeStagedRows(kind, staged);

console.log(
  JSON.stringify(
    {
      sourceSystem: parsed.sourceSystem,
      reportKind: parsed.reportKind,
      warnings: parsed.warnings,
      summary,
      sampleRows: staged.slice(0, 3),
    },
    null,
    2
  )
);
