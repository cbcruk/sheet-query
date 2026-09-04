import type { StandardSchemaV1 } from '../schema/standard-schema.types.ts'

/**
 * Context for authenticated Sheets API v4 requests.
 *
 * The write core is transport- and auth-agnostic: it receives a ready access
 * token and never knows how it was obtained (Service Account, OAuth, ...).
 */
export interface SheetsApiContext {
  /** Spreadsheet id from the sheet URL. */
  spreadsheetId: string
  /** OAuth2 bearer token authorizing the Sheets API call. */
  accessToken: string
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch
  /** Override the Sheets API base URL (for testing). */
  baseUrl?: string
  /** Abort signal forwarded to the underlying request. */
  signal?: AbortSignal
}

/**
 * Describes a sheet tab as a table: an ordered list of column headers plus the
 * unique identity column used to locate rows for update/delete.
 */
export interface SheetTable {
  /** Tab (sheet) name. */
  sheet: string
  /** Header names in column order, e.g. `['id', 'name', 'age']`. */
  columns: string[]
  /** Identity column name. Defaults to `'id'`; must exist in {@link columns}. */
  idColumn?: string
  /** Number of header rows. Defaults to `1`. */
  headerRows?: number
  /**
   * Numeric tab id (`gid`). When omitted, `deleteRowById` resolves it via a
   * metadata call. Provide it to skip that round-trip.
   */
  sheetId?: number
  /**
   * Optional Standard Schema. When set, `appendRow` validates the record and
   * `updateRowById` validates the merged row before writing.
   */
  schema?: StandardSchemaV1
  /**
   * When `true`, every mutation first reads the sheet's header row and asserts
   * it still matches {@link columns}, guarding position-based writes against
   * header drift (at the cost of one extra read per mutation).
   */
  verifyHeaders?: boolean
}

/** A value accepted when writing a cell. */
export type CellInput = string | number | boolean | Date | null | undefined

/** A value serialized for the Sheets API `values` payload. */
export type WriteValue = string | number | boolean

/** A record keyed by column header. */
export type WriteRecord = Record<string, CellInput>
