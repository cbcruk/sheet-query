import { assertHeaders } from '../headers/headers.ts'
import { rowRange } from './a1.ts'
import { getValues } from './sheets-client.ts'
import type { SheetsApiContext, SheetTable } from './sheet-write.types.ts'

function headerText(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return ''
  }
  if (typeof cell === 'string') {
    return cell
  }
  if (typeof cell === 'number' || typeof cell === 'boolean') {
    return String(cell)
  }
  return ''
}

/** Reads the sheet's header row (the last header row) as a list of names. */
export async function fetchHeaderRow(ctx: SheetsApiContext, table: SheetTable): Promise<string[]> {
  const headerRow = table.headerRows ?? 1
  const range = rowRange(table.sheet, headerRow, table.columns.length)
  const [row = []] = await getValues(ctx, range)
  return row.map(headerText)
}

/**
 * Verifies the live sheet headers still match the table's `columns`, guarding
 * position-based writes against header drift.
 *
 * @throws {SheetQueryError} when the headers have drifted.
 */
export async function verifyTableHeaders(ctx: SheetsApiContext, table: SheetTable): Promise<void> {
  assertHeaders(table.columns, await fetchHeaderRow(ctx, table))
}
