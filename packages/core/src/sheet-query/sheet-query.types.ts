import type { Condition } from './conditions.ts'
import type { StandardSchemaV1 } from '../schema/standard-schema.types.ts'

/** Sort direction for an ORDER BY clause. */
export type SortDirection = 'asc' | 'desc'

/** A single ORDER BY term, as accumulated by {@linkcode SheetQuery.orderBy}. */
export interface OrderByTerm {
  /** Column letter or id to sort by. */
  column: string
  /** Direction to sort that column in. */
  direction: SortDirection
}

/** Options accepted when constructing a query. */
export interface SheetQueryOptions {
  /**
   * Sheet (tab) name to query. Mutually informative with {@linkcode gid};
   * provide one. When omitted, GViz targets the first sheet.
   *
   * GViz matches the name ignoring case, but not surrounding whitespace. A name
   * that matches no tab is **not** an error to GViz: it silently returns the
   * first tab's rows. Pass `verifySheet` to {@linkcode SheetQuery.execute} to
   * catch that.
   */
  sheet?: string
  /**
   * Sheet tab `gid`. Useful when the tab name is unstable.
   *
   * Like {@linkcode sheet}, a `gid` that matches no tab silently resolves to
   * the first tab in tab order — not to `gid` 0.
   */
  gid?: string | number
  /**
   * Number of header rows. Defaults to `1`. Set to `0` for headerless sheets
   * (columns are then keyed by their `A, B, ...` ids).
   *
   * Always set this explicitly on sheets whose first rows are irregular: left
   * to guess, GViz can mistake data for headers and return empty labels.
   */
  headers?: number
}

/**
 * Internal, fully-resolved query state accumulated by the builder.
 *
 * Exported for tooling and tests that render a query without a builder; the
 * builder owns its own instance, so mutating one directly is unsupported.
 */
export interface SheetQueryState {
  /** Spreadsheet id from the sheet URL. */
  spreadsheetId: string
  /** Tab name to query, when targeting by name. */
  sheet?: string
  /** Tab `gid`, when targeting by id. */
  gid?: string | number
  /** Number of header rows, defaulted at construction time. */
  headers: number
  /** Selected columns; empty means `SELECT *`. */
  select: string[]
  /** Conditions to combine with `AND`. */
  where: Condition[]
  /** GROUP BY columns. */
  groupBy: string[]
  /** ORDER BY terms, applied in array order. */
  orderBy: OrderByTerm[]
  /** Row limit; omitted means no `LIMIT` clause. */
  limit?: number
  /** Row offset; omitted means no `OFFSET` clause. */
  offset?: number
}

/** Options for {@linkcode SheetQuery.execute}. */
export interface ExecuteOptions {
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch
  /** Bearer token for OAuth-protected (non-public) sheets. */
  accessToken?: string
  /** Abort signal forwarded to the underlying request. */
  signal?: AbortSignal
  /**
   * Standard Schema to validate each returned row against. When provided,
   * `execute` returns the schema's parsed output type instead of
   * {@linkcode SheetRow}.
   */
  schema?: StandardSchemaV1
  /**
   * Expected header names. When provided, `execute` asserts the sheet's actual
   * column labels match (in order) and throws on drift.
   */
  verifyHeaders?: string[]
  /**
   * When `true`, `execute` first checks through the Sheets API that the
   * `sheet` or `gid` target exists, and throws instead of letting GViz fall
   * back to the first tab.
   *
   * Requires {@linkcode accessToken} with read access to the spreadsheet's
   * metadata, and costs one extra request. Has no effect on a query without a
   * target.
   */
  verifySheet?: boolean
}
