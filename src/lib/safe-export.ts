/**
 * Export-safety helpers: guard downloads against CSV/formula injection and
 * unsafe filenames. User-entered strings (panel labels, project names) flow into
 * CSV cells and download filenames, so both are sanitized here.
 */

/**
 * Escape a value for a CSV cell so a spreadsheet can't interpret it as a
 * formula. A cell starting with = + - @ (or a tab / carriage return) is treated
 * as a formula by Excel/Sheets/LibreOffice; prefixing it with a single quote
 * neutralizes that while displaying identically. Also quotes cells containing
 * commas, quotes, or newlines per RFC 4180.
 */
export function csvCell(value: string | number): string {
  let s = String(value ?? '');
  // Formula-injection guard: neutralize a leading trigger character.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  // RFC 4180 quoting when the field contains a delimiter, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from raw values, each cell escaped. */
export function csvRow(values: Array<string | number>): string {
  return values.map(csvCell).join(',');
}

/**
 * Sanitize a user-provided string into a safe download filename: strip path
 * separators, control characters, and other characters browsers/OSes dislike,
 * collapse whitespace, and fall back to a default when nothing usable remains.
 */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = Array.from((name ?? '').normalize('NFKC'))
    // Drop C0/C1 control characters (codepoint < 0x20 or 0x7f-0x9f).
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c >= 0x20 && !(c >= 0x7f && c <= 0x9f);
    })
    .join('')
    .replace(/[/\\?%*:|"<>]/g, '') // path / reserved chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}
