import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import { validateValue } from '../schema/validate.ts'
import { rowRange, tableRange } from './a1.ts'
import { findRowNumberById } from './row-identity.ts'
import {
  appendValues,
  batchUpdate,
  getValues,
  resolveSheetId,
  updateValues,
} from './sheets-client.ts'
import { recordToRow, resolveIdColumn, rowToRecord } from './sheet-write.utils.ts'
import { verifyTableHeaders } from './table-headers.ts'
import type { CellInput, SheetsApiContext, SheetTable, WriteRecord } from './sheet-write.types.ts'

/**
 * Runs the pre-mutation header check when the table opts into it, so every
 * mutation below can call this unconditionally.
 *
 * @throws {SheetQueryError} when the sheet's headers have drifted.
 */
async function guardHeaders(ctx: SheetsApiContext, table: SheetTable): Promise<void> {
  if (table.verifyHeaders) {
    await verifyTableHeaders(ctx, table)
  }
}

/**
 * Appends a new row built from `record`, ordered by the table's columns.
 *
 * The id is supplied by the caller, not generated here — every later update and
 * delete finds the row by it, so a row without one is unreachable. Fields absent
 * from `record` are written as empty cells.
 *
 * @param ctx Spreadsheet id and access token for the Sheets API call.
 * @param table The tab's column layout and identity column.
 * @param record The row to write, keyed by column header.
 * @throws {SheetQueryError} when the record omits the identity column, when
 * `table.schema` rejects it, or when the request fails.
 *
 * @example Append a person
 * ```ts
 * import { appendRow } from '@cbcruk/sheet-query'
 *
 * await appendRow(
 *   { spreadsheetId: '1VwfZpdR...', accessToken: 'ya29...' },
 *   { sheet: 'people', columns: ['id', 'name', 'age', 'city'] },
 *   { id: 7, name: '이은수', age: 34, city: '서울' },
 * )
 * ```
 */
export async function appendRow(
  ctx: SheetsApiContext,
  table: SheetTable,
  record: WriteRecord,
): Promise<void> {
  const { name } = resolveIdColumn(table)

  if (record[name] === null || record[name] === undefined) {
    throw new SheetQueryError(`Cannot append a row without an id ("${name}").`)
  }

  await guardHeaders(ctx, table)

  const validated = table.schema
    ? ((await validateValue(table.schema, record)) as WriteRecord)
    : record

  await appendValues(ctx, tableRange(table.sheet, table.columns.length), [
    recordToRow(table.columns, validated),
  ])
}

/**
 * Updates the row identified by `id`, merging `patch` over the existing values
 * (last-write-wins). Fields omitted from `patch` are preserved.
 *
 * The row is located by reading the identity column at call time, because a
 * row's position shifts whenever rows above it are inserted or deleted. Two
 * concurrent updates to one row do not conflict — the later write wins outright.
 *
 * @param ctx Spreadsheet id and access token for the Sheets API call.
 * @param table The tab's column layout and identity column.
 * @param id Identity value of the row to update.
 * @param patch Fields to overwrite, keyed by column header.
 * @throws {SheetQueryError} when no row matches `id`, when `table.schema`
 * rejects the merged row, or when the request fails.
 *
 * @example Move someone to another city
 * ```ts
 * import { updateRowById } from '@cbcruk/sheet-query'
 *
 * await updateRowById(
 *   { spreadsheetId: '1VwfZpdR...', accessToken: 'ya29...' },
 *   { sheet: 'people', columns: ['id', 'name', 'age', 'city'] },
 *   7,
 *   { city: '부산' },
 * )
 * ```
 */
export async function updateRowById(
  ctx: SheetsApiContext,
  table: SheetTable,
  id: CellInput,
  patch: WriteRecord,
): Promise<void> {
  await guardHeaders(ctx, table)

  const rowNumber = await findRowNumberById(ctx, table, id)

  if (rowNumber === null) {
    throw new SheetQueryError(`No row found with id "${String(id)}".`)
  }

  const range = rowRange(table.sheet, rowNumber, table.columns.length)
  const [current = []] = await getValues(ctx, range)
  const merged = { ...rowToRecord(table.columns, current), ...patch }

  const validated = table.schema
    ? ((await validateValue(table.schema, merged)) as WriteRecord)
    : merged

  await updateValues(ctx, range, [recordToRow(table.columns, validated)])
}

/**
 * Deletes the row identified by `id`, closing the gap it leaves behind.
 *
 * Removing a row shifts every row beneath it up, which is why row numbers are
 * never cached. Set `table.sheetId` to skip the metadata lookup this otherwise
 * needs to translate the tab name into the numeric id the API deletes by.
 *
 * @param ctx Spreadsheet id and access token for the Sheets API call.
 * @param table The tab's column layout and identity column.
 * @param id Identity value of the row to delete.
 * @throws {SheetQueryError} when no row matches `id` or the request fails.
 */
export async function deleteRowById(
  ctx: SheetsApiContext,
  table: SheetTable,
  id: CellInput,
): Promise<void> {
  await guardHeaders(ctx, table)

  const rowNumber = await findRowNumberById(ctx, table, id)

  if (rowNumber === null) {
    throw new SheetQueryError(`No row found with id "${String(id)}".`)
  }

  const sheetId = table.sheetId ?? (await resolveSheetId(ctx, table.sheet))

  await batchUpdate(ctx, [
    {
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    },
  ])
}
