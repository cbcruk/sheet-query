/**
 * Treat a Google Sheet as a data store: SQL-like reads through the GViz `tq`
 * endpoint, type-safe writes through the Sheets API v4, and row identity that
 * survives inserts and deletes.
 *
 * Reads need no server — {@linkcode sheetQuery} builds a query and fetches it
 * straight from the browser or Node. Writes go through {@linkcode appendRow},
 * {@linkcode updateRowById} and {@linkcode deleteRowById}, which take an access
 * token you obtain elsewhere; the core never handles credentials itself.
 *
 * @example Read rows from a public sheet
 * ```ts
 * import { eq, sheetQuery } from '@cbcruk/sheet-query'
 *
 * const rows = await sheetQuery('1VwfZpdR_oeARGvKp8GHX4Sb3haINNqpbqBj7zEa6m7Y', {
 *   sheet: 'people',
 * })
 *   .where(eq('D', '서울'))
 *   .orderBy('C', 'desc')
 *   .execute()
 * ```
 *
 * @example Update a row found by its id
 * ```ts
 * import { updateRowById } from '@cbcruk/sheet-query'
 *
 * await updateRowById(
 *   { spreadsheetId: '1VwfZpdR_oeARGvKp8GHX4Sb3haINNqpbqBj7zEa6m7Y', accessToken: 'ya29...' },
 *   { sheet: 'people', columns: ['id', 'name', 'age', 'city'] },
 *   42,
 *   { city: '부산' },
 * )
 * ```
 *
 * @module
 */
export { sheetQuery, SheetQuery } from './sheet-query/sheet-query.ts'
export { SheetQueryError } from './sheet-query/sheet-query.error.ts'
export {
  and,
  or,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  isNull,
  isNotNull,
  serializeValue,
} from './sheet-query/conditions.ts'
export { parseGVizResponse, assertGVizOk, tableToObjects } from './sheet-query/gviz.ts'

export { appendRow, updateRowById, deleteRowById } from './sheet-write/mutations.ts'
export { findRowNumberById } from './sheet-write/row-identity.ts'
export {
  getValues,
  appendValues,
  updateValues,
  batchUpdate,
  resolveSheetId,
  listSheetTabs,
} from './sheet-write/sheets-client.ts'
export {
  columnLetter,
  quoteSheetName,
  rowRange,
  tableRange,
  columnRange,
} from './sheet-write/a1.ts'
export { serializeWriteValue, recordToRow, rowToRecord } from './sheet-write/sheet-write.utils.ts'

export { validateValue, validateRows } from './schema/validate.ts'

export { compareHeaders, assertHeaders, tableHeaderLabels } from './headers/headers.ts'
export { fetchHeaderRow, verifyTableHeaders } from './sheet-write/table-headers.ts'

export type { Condition, ColumnValue } from './sheet-query/conditions.ts'
export type {
  ExecuteOptions,
  LabelTerm,
  OrderByTerm,
  SheetQueryOptions,
  SheetQueryState,
  SortDirection,
} from './sheet-query/sheet-query.types.ts'
export type {
  CellValue,
  GVizCell,
  GVizColumn,
  GVizColumnType,
  GVizMessage,
  GVizResponse,
  GVizRow,
  GVizTable,
  SheetRow,
} from './sheet-query/gviz.types.ts'
export type {
  CellInput,
  SheetsApiContext,
  SheetTab,
  SheetTable,
  WriteRecord,
  WriteValue,
} from './sheet-write/sheet-write.types.ts'
export type {
  StandardSchemaV1,
  StandardSchemaProps,
  StandardSchemaResult,
  StandardSchemaIssue,
  InferInput,
  InferOutput,
} from './schema/standard-schema.types.ts'
export type { HeaderCheck, HeaderMismatch } from './headers/headers.types.ts'
