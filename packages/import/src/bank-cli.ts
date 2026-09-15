import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBankStatementCsv } from "./bank-statement/csv";
import { stageBankRows, summarizeBankRows } from "./bank-statement/validate";

function usage(): never {
  console.error("Usage: pnpm import:bank --file <path>");
  process.exit(1);
}

const args = process.argv.slice(2);
let filePath: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--file") filePath = args[++i];
}

if (!filePath) usage();

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
const rows = parseBankStatementCsv(content);
const staged = stageBankRows(rows);
const summary = summarizeBankRows(staged);

console.log(
  JSON.stringify(
    {
      format: "csv",
      summary,
      sampleRows: staged.slice(0, 3),
    },
    null,
    2
  )
);
