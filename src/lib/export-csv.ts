/**
 * Escapes and sanitizes a cell value to prevent CSV Spreadsheet Formula Injection (CSV Injection).
 * Any cell value starting with '=', '+', '-', '@', '\t', or '\r' is prefixed with an apostrophe.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value).trim();

  // Protect against formula injection in spreadsheet applications (Excel, Google Sheets, LibreOffice)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape existing double quotes by doubling them
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

export function generateSafeCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}
