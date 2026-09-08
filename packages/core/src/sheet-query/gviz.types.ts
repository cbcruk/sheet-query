/**
 * Type definitions for the Google Visualization API (GViz) `tq` JSON response.
 *
 * These mirror the wire format exactly, including its quirks: dates arrive as
 * strings, empty cells as `null`, and columns carry both a stable id and the
 * sheet's header text.
 *
 * @see https://developers.google.com/chart/interactive/docs/reference#dataparam
 */

/** Cell data type as reported by GViz column metadata. */
export type GVizColumnType = 'boolean' | 'number' | 'string' | 'date' | 'datetime' | 'timeofday'

/** Column metadata. `label` is the sheet header text when a header row exists. */
export interface GVizColumn {
  /** Column id — the sheet's letter (`A`, `B`, ...), or `Col1`, `Col2`, ... in an `IMPORTRANGE` query. */
  id: string
  /** Header text for the column; empty when the sheet has no header row. */
  label: string
  /** How GViz typed the column, inferred from its values. */
  type: GVizColumnType
  /** The column's number/date display format, when the sheet sets one. */
  pattern?: string
}

/**
 * A single cell. `v` is the raw value; `f` is the formatted display string.
 *
 * For `date`/`datetime`, `v` is a string like `"Date(2024,0,15)"` (month is
 * zero-based). For `timeofday`, `v` is an array `[h, m, s, ms]`.
 */
export interface GVizCell {
  /** Raw value in GViz's own encoding, or `null` for an empty cell. */
  v: string | number | boolean | number[] | null
  /** Value as displayed in the sheet, honouring its number/date format. */
  f?: string
}

/** A row. Cells may be `null` when the underlying cell is empty. */
export interface GVizRow {
  /** Cells in column order, aligned with {@linkcode GVizTable.cols}. */
  c: (GVizCell | null)[]
}

/** The result grid: column metadata plus the rows beneath it. */
export interface GVizTable {
  /** Column metadata, in sheet order. */
  cols: GVizColumn[]
  /** Data rows, header rows excluded. */
  rows: GVizRow[]
  /**
   * How many leading rows GViz treated as headers. Compare this against the
   * `headers` option to catch a sheet whose header count was guessed wrong.
   */
  parsedNumHeaders?: number
}

/** A warning or error entry attached to a GViz response. */
export interface GVizMessage {
  /** Machine-readable cause, e.g. `'invalid_query'` or `'access_denied'`. */
  reason: string
  /** Short human-readable summary. */
  message: string
  /** Longer explanation, usually the one worth showing to a developer. */
  detailed_message?: string
}

/** The object passed to `google.visualization.Query.setResponse(...)`. */
export interface GVizResponse {
  /** GViz wire-format version, e.g. `'0.6'`. */
  version: string
  /** Echo of the request id; sheet-query does not set one. */
  reqId: string
  /** Whether the query succeeded. `'error'` means {@linkcode table} is unusable. */
  status: 'ok' | 'warning' | 'error'
  /** Content signature, usable to detect an unchanged result. */
  sig?: string
  /** The result grid. Present but meaningless when `status` is `'error'`. */
  table: GVizTable
  /** Non-fatal notices, e.g. a truncated result set. */
  warnings?: GVizMessage[]
  /** Failure details; present when `status` is `'error'`. */
  errors?: GVizMessage[]
}

/** A converted cell value in plain JS form. */
export type CellValue = string | number | boolean | Date | number[] | null

/** A converted row keyed by column label (or id when no header is present). */
export type SheetRow = Record<string, CellValue>
