/**
 * CSV helpers for client-side exports. Kept free of TypeScript-only syntax
 * apart from the parameter annotations, so scripts/ tests can evaluate them.
 */

/** One CSV cell. Text is always quoted; spreadsheet formulas are neutralised. */
export function csvCell(value: unknown): string {
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
    const text = value == null ? "" : String(value)
    // OWASP CSV injection: =, +, -, @ start a formula, including when hidden
    // behind leading whitespace or control characters; tab/CR also count.
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? "'" + text : text
    return '"' + safe.replace(/"/g, '""') + '"'
}

/** Rows to CSV text (CRLF line endings, as spreadsheet apps expect). */
export function toCsv(rows: unknown[][]): string {
    return rows.map(row => row.map(csvCell).join(",")).join("\r\n")
}
