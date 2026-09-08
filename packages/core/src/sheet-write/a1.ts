import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'

/**
 * Converts a zero-based column index to its A1 letter.
 *
 * The sequence is bijective base-26, not plain base-26: `0 → A`, `25 → Z`,
 * `26 → AA`, `701 → ZZ`, `702 → AAA`.
 *
 * @throws {SheetQueryError} when `index` is negative or not an integer.
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

/**
 * Quotes a sheet name for A1 notation, doubling embedded single quotes.
 *
 * Names are always quoted, even when they would not strictly need it, so a tab
 * named `2024` or `발견물 목록` needs no special handling at the call site.
 */
export function quoteSheetName(sheet: string): string {
  return `'${sheet.replace(/'/g, "''")}'`
}

/**
 * Builds an A1 range spanning a single row across `columnCount` columns,
 * starting at column `A`.
 *
 * @param sheet Tab name; quoted for you.
 * @param row 1-based row number.
 * @param columnCount How many columns the table occupies.
 */
export function rowRange(sheet: string, row: number, columnCount: number): string {
  const lastColumn = columnLetter(columnCount - 1)
  return `${quoteSheetName(sheet)}!A${row}:${lastColumn}${row}`
}

/**
 * Builds an unbounded A1 range covering every row of the table's columns,
 * starting at column `A`.
 *
 * @param sheet Tab name; quoted for you.
 * @param columnCount How many columns the table occupies.
 */
export function tableRange(sheet: string, columnCount: number): string {
  const lastColumn = columnLetter(columnCount - 1)
  return `${quoteSheetName(sheet)}!A:${lastColumn}`
}

/**
 * Builds an unbounded A1 range covering a single full column.
 *
 * @param sheet Tab name; quoted for you.
 * @param column Column letter, e.g. from {@linkcode columnLetter}.
 */
export function columnRange(sheet: string, column: string): string {
  return `${quoteSheetName(sheet)}!${column}:${column}`
}
