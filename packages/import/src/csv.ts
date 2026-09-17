/** Minimal RFC-4180-ish CSV parser for Curve Hero exports (no multiline fields). */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function headerIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(normalizeHeader(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function requireColumns(headers: string[], required: string[][]): string[] {
  const missing: string[] = [];
  for (const aliases of required) {
    if (headerIndex(headers, aliases) < 0) missing.push(aliases[0]);
  }
  return missing;
}

export function parseMoneyToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parens = trimmed.startsWith("(") && trimmed.endsWith(")");
  let normalized = trimmed.replace(/[$,()]/g, "").trim();
  if (!normalized) return null;
  let negative = parens;
  if (normalized.startsWith("-") || normalized.startsWith("+")) {
    negative = negative !== normalized.startsWith("-");
    normalized = normalized.slice(1).trim();
  }
  // Plain decimal digits only: no exponent, radix prefix, sign or whitespace inside.
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "00").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

function calendarDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!mdy) return null;
  return calendarDate(Number(mdy[3]), Number(mdy[1]), Number(mdy[2]));
}

/**
 * Records a data line the parser could not turn into a row. `lineNumber` is
 * the 1-based data line (the header is line 0), so an operator can find it in
 * the file; the code is stable for validators and tests.
 */
export function skipRow(
  warnings: string[],
  lineNumber: number,
  code: string,
  detail: string
): void {
  warnings.push(`Row ${lineNumber} skipped (${code}): ${detail}`);
}
