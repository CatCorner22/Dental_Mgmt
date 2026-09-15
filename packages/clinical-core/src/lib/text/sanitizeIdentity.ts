// Staff identity strings (display names) are written verbatim into records
// that are meant to be tamper-evident: the frozen submission stamp
// ("- Submitted by: ..."), the audit log's actor column, and the corporate
// email body. A name carrying a newline could forge extra lines in that
// stamp — a fake ticket, a fake audit status — inside what the app itself
// calls part of a legal and medical record.
//
// So an identity is collapsed to a single line at every ingestion point,
// mirroring the newline ban already enforced on measurement units in
// validateNoteState. Control characters go too (they can hide or reorder
// text in a terminal or PDF), and the length is capped so one field cannot
// crowd out the rest of the stamp.
export const MAX_IDENTITY_CHARS = 100;

// C0 controls, DEL, and C1 controls. Tested by code point rather than a
// regex escape range so the intent stays readable and the source file holds
// no literal control bytes.
function isControl(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

export function sanitizeIdentity(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    // Parentheses are structural here, not decorative. Attribution is stamped
    // as "Display Name (username)" into submissions and the audit log, so a
    // display name of "Dr Jane Smith (jsmith)" freezes a string that reads like
    // a different person signed the note. The real username is still appended,
    // making the forgery detectable — but only to someone reading closely.
    if (ch === "(" || ch === ")") continue;
    // Replaced with a space rather than dropped, so "Ann\nLee" reads
    // "Ann Lee" instead of silently becoming "AnnLee".
    out += isControl(code) ? " " : ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, MAX_IDENTITY_CHARS);
}
