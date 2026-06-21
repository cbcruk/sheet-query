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

async function guardHeaders(ctx: SheetsApiContext, table: SheetTable): Promise<void> {
  if (table.verifyHeaders) {
    await verifyTableHeaders(ctx, table)
  }
}

/**
 * Appends a new row built from `record`, ordered by the table's columns.
 *
 * @throws {SheetQueryError} when the record omits the identity column.
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
 * @throws {SheetQueryError} when no row matches `id`.
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
 * Deletes the row identified by `id`.
 *
 * @throws {SheetQueryError} when no row matches `id`.
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
