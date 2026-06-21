import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { CellInput, SheetTable, WriteRecord, WriteValue } from './sheet-write.types.ts'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Serializes a JS value into a Sheets API write value. With `USER_ENTERED`,
 * `Date` becomes a `YYYY-MM-DD` string Sheets parses back as a date; `null`
 * clears the cell.
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

/** Maps a record to a row array ordered by the table's columns. */
export function recordToRow(columns: string[], record: WriteRecord): WriteValue[] {
  return columns.map((column) => serializeWriteValue(record[column] ?? null))
}

/** Maps a raw row array back to a record keyed by the table's columns. */
export function rowToRecord(columns: string[], row: unknown[]): WriteRecord {
  const record: WriteRecord = {}
  columns.forEach((column, index) => {
    record[column] = (row[index] ?? null) as CellInput
  })
  return record
}

/** Resolves the identity column's name, A1 letter index, and header position. */
export function resolveIdColumn(table: SheetTable): { name: string; index: number } {
  const name = table.idColumn ?? 'id'
  const index = table.columns.indexOf(name)

  if (index < 0) {
    throw new SheetQueryError(`id column "${name}" is not in table columns.`)
  }

  return { name, index }
}
