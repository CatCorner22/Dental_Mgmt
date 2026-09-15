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
  const negative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const normalized = trimmed.replace(/[$,()]/g, "").trim();
  if (!normalized) return null;
  const parts = normalized.split(".");
  if (parts.length > 2) return null;
  const dollars = Number(parts[0]);
  if (!Number.isFinite(dollars)) return null;
  const centsPart = parts[1] ?? "00";
  if (!/^\d{1,2}$/.test(centsPart)) return null;
  const cents = dollars * 100 + Number(centsPart.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function parseIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!mdy) return null;
  const month = mdy[1].padStart(2, "0");
  const day = mdy[2].padStart(2, "0");
  return `${mdy[3]}-${month}-${day}`;
}
