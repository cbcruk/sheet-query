import type { Condition } from './conditions.ts'
import type { StandardSchemaV1 } from '../schema/standard-schema.types.ts'

/** Sort direction for an ORDER BY clause. */
export type SortDirection = 'asc' | 'desc'

/** A single ORDER BY term. */
export interface OrderByTerm {
  column: string
  direction: SortDirection
}

/** Options accepted when constructing a query. */
export interface SheetQueryOptions {
  /**
   * Sheet (tab) name to query. Mutually informative with {@link gid}; provide
   * one. When omitted, GViz targets the first sheet.
   */
  sheet?: string
  /** Sheet tab `gid`. Useful when the tab name is unstable. */
  gid?: string | number
  /**
   * Number of header rows. Defaults to `1`. Set to `0` for headerless sheets
   * (columns are then keyed by their `A, B, ...` ids).
   */
  headers?: number
}

/** Internal, fully-resolved query state accumulated by the builder. */
export interface SheetQueryState {
  spreadsheetId: string
  sheet?: string
  gid?: string | number
  headers: number
  select: string[]
  where: Condition[]
  groupBy: string[]
  orderBy: OrderByTerm[]
  limit?: number
  offset?: number
}

/** Options for {@link SheetQuery.execute}. */
export interface ExecuteOptions {
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch
  /** Bearer token for OAuth-protected (non-public) sheets. */
  accessToken?: string
  /** Abort signal forwarded to the underlying request. */
  signal?: AbortSignal
  /**
   * Standard Schema to validate each returned row against. When provided,
   * `execute` returns the schema's parsed output type instead of {@link SheetRow}.
   */
  schema?: StandardSchemaV1
  /**
   * Expected header names. When provided, `execute` asserts the sheet's actual
   * column labels match (in order) and throws on drift.
   */
  verifyHeaders?: string[]
}
