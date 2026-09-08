import { columnLetter, columnRange } from './a1.ts'
import { getValues } from './sheets-client.ts'
import { resolveIdColumn } from './sheet-write.utils.ts'
import type { CellInput, SheetsApiContext, SheetTable } from './sheet-write.types.ts'

/** Coerces a primitive cell/id value to a comparable string key, or `null`. */
function toMatchKey(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value instanceof Date) {
    return String(value.getTime())
  }
  return null
}

/** Compares a raw sheet cell against a target id (string-coerced). */
function cellMatchesId(cell: unknown, id: CellInput): boolean {
  const cellKey = toMatchKey(cell)
  return cellKey !== null && cellKey === toMatchKey(id)
}

/**
 * Finds the 1-based sheet row number of the row whose identity column equals
 * `id`.
 *
 * Row numbers are mutable — inserting or deleting a row shifts every row below
 * it — so this must run fresh at write time and its result must never be cached
 * across mutations. Values are compared as strings, so the number `42` matches a
 * cell holding `'42'`. When several rows share an id, the first one wins.
 *
 * @param ctx Spreadsheet id and access token for the Sheets API call.
 * @param table The tab's column layout and identity column.
 * @param id Identity value to look for.
 * @returns The 1-based row number, or `null` when no row matches.
 */
export async function findRowNumberById(
  ctx: SheetsApiContext,
  table: SheetTable,
  id: CellInput,
): Promise<number | null> {
  const { index } = resolveIdColumn(table)
  const headerRows = table.headerRows ?? 1
  const range = columnRange(table.sheet, columnLetter(index))

  const values = await getValues(ctx, range)

  for (let row = headerRows; row < values.length; row++) {
    if (cellMatchesId(values[row]?.[0], id)) {
      return row + 1
    }
  }

  return null
}
