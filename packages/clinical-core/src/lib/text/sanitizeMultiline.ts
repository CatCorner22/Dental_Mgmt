// Clean free text that a person typed and that will be dropped into a
// plain-text email body.
//
// Not markdown escaping (that is composeNote's job for clinical notes) and not
// identity collapsing (that is sanitizeIdentity's job for one-line names). What
// matters here is that control characters cannot smuggle structure into a
// message a human will read: a stray CR, a NUL, or an ANSI escape can forge
// what looks like a header line or corrupt a terminal that renders the mail.
// Newlines and tabs survive, because a multi-paragraph answer is legitimate.

// C0 controls except tab (\x09) and newline (\x0A), plus DEL and the C1 block.
const CONTROL_CHARS = /[\x00-\x08\x0B-\x1F\x7F-\x9F]/g;

export function sanitizeMultiline(text: string, maxLength: number): string {
  return (
    text
      // Normalize line endings first so CRLF/CR cannot double-space or, worse,
      // let a bare CR overwrite the start of a rendered line.
      .replace(/\r\n?/g, "\n")
      .replace(CONTROL_CHARS, "")
      // Collapse runs of blank lines \u2014 a wall of newlines is padding, not content.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, maxLength)
  );
}
