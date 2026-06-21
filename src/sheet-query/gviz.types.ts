/**
 * Type definitions for the Google Visualization API (GViz) `tq` JSON response.
 *
 * @see https://developers.google.com/chart/interactive/docs/reference#dataparam
 */

/** Cell data type as reported by GViz column metadata. */
export type GVizColumnType = 'boolean' | 'number' | 'string' | 'date' | 'datetime' | 'timeofday'

/** Column metadata. `label` is the sheet header text when a header row exists. */
export interface GVizColumn {
  id: string
  label: string
  type: GVizColumnType
  pattern?: string
}

/**
 * A single cell. `v` is the raw value; `f` is the formatted display string.
 *
 * For `date`/`datetime`, `v` is a string like `"Date(2024,0,15)"` (month is
 * zero-based). For `timeofday`, `v` is an array `[h, m, s, ms]`.
 */
export interface GVizCell {
  v: string | number | boolean | number[] | null
  f?: string
}

/** A row. Cells may be `null` when the underlying cell is empty. */
export interface GVizRow {
  c: (GVizCell | null)[]
}

export interface GVizTable {
  cols: GVizColumn[]
  rows: GVizRow[]
  parsedNumHeaders?: number
}

export interface GVizMessage {
  reason: string
  message: string
  detailed_message?: string
}

/** The object passed to `google.visualization.Query.setResponse(...)`. */
export interface GVizResponse {
  version: string
  reqId: string
  status: 'ok' | 'warning' | 'error'
  sig?: string
  table: GVizTable
  warnings?: GVizMessage[]
  errors?: GVizMessage[]
}

/** A converted cell value in plain JS form. */
export type CellValue = string | number | boolean | Date | number[] | null

/** A converted row keyed by column label (or id when no header is present). */
export type SheetRow = Record<string, CellValue>
