import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'

/**
 * Converts a zero-based column index to its A1 letter (`0 → A`, `25 → Z`,
 * `26 → AA`).
 */
export function columnLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new SheetQueryError(`Invalid column index: ${index}`)
  }

  let letter = ''
  let n = index

  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter
    n = Math.floor(n / 26) - 1
  } while (n >= 0)

  return letter
}

/** Quotes a sheet name for A1 notation, escaping embedded single quotes. */
export function quoteSheetName(sheet: string): string {
  return `'${sheet.replace(/'/g, "''")}'`
}

/** Builds an A1 range spanning a single row across `columnCount` columns. */
export function rowRange(sheet: string, row: number, columnCount: number): string {
  const lastColumn = columnLetter(columnCount - 1)
  return `${quoteSheetName(sheet)}!A${row}:${lastColumn}${row}`
}

/** Builds an A1 range covering every row of the table's columns. */
export function tableRange(sheet: string, columnCount: number): string {
  const lastColumn = columnLetter(columnCount - 1)
  return `${quoteSheetName(sheet)}!A:${lastColumn}`
}

/** Builds an A1 range covering a single full column by its letter. */
export function columnRange(sheet: string, column: string): string {
  return `${quoteSheetName(sheet)}!${column}:${column}`
}
