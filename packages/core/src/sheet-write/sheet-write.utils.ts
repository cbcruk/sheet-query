import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { CellInput, SheetTable, WriteRecord, WriteValue } from './sheet-write.types.ts'

/** Left-pads a number to two digits for the `YYYY-MM-DD` date form. */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Serializes a JS value into a Sheets API write value.
 *
 * With `USER_ENTERED`, a `Date` becomes a `YYYY-MM-DD` string (in local time)
 * that Sheets parses back into a date; `null` and `undefined` become the empty
 * string, which clears the cell.
 */
export function serializeWriteValue(value: CellInput): WriteValue {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }

  return value
}

/**
 * Maps a record to a row array ordered by the table's columns, serializing each
 * value. Keys not in `columns` are dropped; columns not in the record are
 * written as empty cells.
 *
 * @param columns Header names in column order.
 * @param record The row, keyed by column header.
 */
export function recordToRow(columns: string[], record: WriteRecord): WriteValue[] {
  return columns.map((column) => serializeWriteValue(record[column] ?? null))
}

/**
 * Maps a raw row array back to a record keyed by the table's columns — the
 * inverse of {@linkcode recordToRow}, used to merge a patch over a row that was
 * just read.
 *
 * Cells the API omitted from a short row become `null`, so the record always
 * has one key per column.
 *
 * @param columns Header names in column order.
 * @param row Raw cell values as returned by {@linkcode getValues}.
 */
export function rowToRecord(columns: string[], row: unknown[]): WriteRecord {
  const record: WriteRecord = {}
  columns.forEach((column, index) => {
    record[column] = (row[index] ?? null) as CellInput
  })
  return record
}

/**
 * Resolves the table's identity column, defaulting to `'id'`.
 *
 * @returns The column's name and its zero-based position in `table.columns`.
 * @throws {SheetQueryError} when the named column is not among the table's
 * columns — a typo here would otherwise write rows nothing can find again.
 */
export function resolveIdColumn(table: SheetTable): { name: string; index: number } {
  const name = table.idColumn ?? 'id'
  const index = table.columns.indexOf(name)

  if (index < 0) {
    throw new SheetQueryError(`id column "${name}" is not in table columns.`)
  }

  return { name, index }
}
