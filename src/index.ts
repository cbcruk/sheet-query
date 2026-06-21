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
