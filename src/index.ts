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
} from './sheet-write/sheets-client.ts'
export {
  columnLetter,
  quoteSheetName,
  rowRange,
  tableRange,
  columnRange,
} from './sheet-write/a1.ts'
export { serializeWriteValue, recordToRow, rowToRecord } from './sheet-write/sheet-write.utils.ts'

export type { Condition, ColumnValue } from './sheet-query/conditions.ts'
export type {
  ExecuteOptions,
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
  SheetTable,
  WriteRecord,
  WriteValue,
} from './sheet-write/sheet-write.types.ts'
