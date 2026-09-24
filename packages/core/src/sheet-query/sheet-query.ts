import { assertHeaders, tableHeaderLabels } from '../headers/headers.ts'
import type { InferOutput, StandardSchemaV1 } from '../schema/standard-schema.types.ts'
import { validateRows } from '../schema/validate.ts'
import type { Condition } from './conditions.ts'
import { assertGVizOk, parseGVizResponse, tableToObjects } from './gviz.ts'
import type { SheetRow } from './gviz.types.ts'
import { SheetQueryError } from './sheet-query.error.ts'
import type {
  ExecuteOptions,
  SheetQueryOptions,
  SheetQueryState,
  SortDirection,
} from './sheet-query.types.ts'
import { buildQuery, buildUrl } from './sheet-query.utils.ts'

/**
 * Chainable builder for read-only GViz queries against a Google Sheet.
 *
 * Every method returns the same instance, so a builder is single-use and
 * mutable: calling `.execute()` twice re-runs the query as it stands. Prefer
 * the {@linkcode sheetQuery} factory over constructing this directly.
 *
 * @example Filter, sort, and page
 * ```ts
 * import { eq, sheetQuery } from '@cbcruk/sheet-query'
 *
 * const rows = await sheetQuery('1VwfZpdR_oeARGvKp8GHX4Sb3haINNqpbqBj7zEa6m7Y', {
 *   sheet: 'people',
 * })
 *   .select('A', 'B')
 *   .where(eq('C', '서울'))
 *   .orderBy('B', 'desc')
 *   .limit(10)
 *   .execute()
 * ```
 */
export class SheetQuery {
  private readonly state: SheetQueryState

  /**
   * Starts a query against one spreadsheet.
   *
   * @param spreadsheetId The spreadsheet id from its URL.
   * @param options Sheet target and header configuration.
   * @throws {SheetQueryError} when `spreadsheetId` is empty.
   */
  constructor(spreadsheetId: string, options: SheetQueryOptions = {}) {
    if (!spreadsheetId) {
      throw new SheetQueryError('spreadsheetId is required.')
    }

    this.state = {
      spreadsheetId,
      sheet: options.sheet,
      gid: options.gid,
      headers: options.headers ?? 1,
      select: [],
      where: [],
      groupBy: [],
      orderBy: [],
    }
  }

  /**
   * Selects columns by letter/id, or an aggregate expression such as
   * `SUM(B)`. Selecting nothing (the default) reads every column.
   *
   * Calls accumulate rather than replace, so `.select('A').select('B')` is the
   * same as `.select('A', 'B')`.
   *
   * @returns This builder, for chaining.
   */
  select(...columns: string[]): this {
    this.state.select.push(...columns)
    return this
  }

  /**
   * Appends a WHERE condition built by a helper such as {@linkcode eq}.
   * Multiple calls are combined with `AND`; use {@linkcode or} for alternatives.
   *
   * @returns This builder, for chaining.
   *
   * @example Two conditions, ANDed together
   * ```ts
   * import { eq, gt, sheetQuery } from '@cbcruk/sheet-query'
   *
   * const query = sheetQuery('1VwfZpdR...').where(eq('D', '서울')).where(gt('C', 30))
   *
   * query.toQuery() // SELECT * WHERE (D = '서울') AND (C > 30)
   * ```
   */
  where(condition: Condition): this {
    this.state.where.push(condition)
    return this
  }

  /**
   * Adds GROUP BY columns. GViz requires every selected column to be either
   * grouped or aggregated.
   *
   * @returns This builder, for chaining.
   */
  groupBy(...columns: string[]): this {
    this.state.groupBy.push(...columns)
    return this
  }

  /**
   * Adds an ORDER BY term. Multiple calls sort by each column in the order the
   * calls were made.
   *
   * @param column Column letter or id to sort by.
   * @param direction Sort direction; defaults to ascending.
   * @returns This builder, for chaining.
   */
  orderBy(column: string, direction: SortDirection = 'asc'): this {
    this.state.orderBy.push({ column, direction })
    return this
  }

  /**
   * Sets the maximum number of rows to return, replacing any previous limit.
   *
   * @returns This builder, for chaining.
   */
  limit(count: number): this {
    this.state.limit = count
    return this
  }

  /**
   * Skips `count` rows before returning results, replacing any previous offset.
   *
   * @returns This builder, for chaining.
   */
  offset(count: number): this {
    this.state.offset = count
    return this
  }

  /**
   * Renders the accumulated state as a GViz `tq` query string, without sending
   * a request. Useful for logging and for tests that assert on the query.
   */
  toQuery(): string {
    return buildQuery(this.state)
  }

  /**
   * Renders the full GViz request URL — query, output format, and sheet target
   * — without sending a request.
   */
  toUrl(): string {
    return buildUrl(this.state)
  }

  /**
   * Executes the query and returns the rows parsed by `options.schema`.
   *
   * @throws {SheetQueryError} on network failure, a GViz error, or a row that
   * fails validation.
   *
   * @example Validate rows with a Standard Schema
   * ```ts
   * import { sheetQuery } from '@cbcruk/sheet-query'
   * import { z } from 'zod'
   *
   * const Person = z.object({ id: z.number(), name: z.string() })
   * const people = await sheetQuery('1VwfZpdR...').execute({ schema: Person })
   * ```
   */
  async execute<Schema extends StandardSchemaV1>(
    options: ExecuteOptions & { schema: Schema },
  ): Promise<InferOutput<Schema>[]>
  /**
   * Executes the query and returns rows as plain objects keyed by column label,
   * with cell values coerced to native JS types.
   *
   * Without a schema the shape is unchecked at runtime, so `T` is a claim about
   * the sheet rather than a guarantee.
   *
   * @typeParam T - Expected row shape; defaults to {@linkcode SheetRow}.
   * @throws {SheetQueryError} on network failure or a GViz error response.
   */
  async execute<T = SheetRow>(options?: ExecuteOptions): Promise<T[]>
  async execute(options: ExecuteOptions = {}): Promise<unknown[]> {
    const fetchImpl = options.fetch ?? globalThis.fetch

    if (typeof fetchImpl !== 'function') {
      throw new SheetQueryError('No fetch implementation available; pass options.fetch.')
    }

    const headers: Record<string, string> = {}
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`
    }

    let response: Response
    try {
      response = await fetchImpl(this.toUrl(), {
        headers,
        signal: options.signal,
      })
    } catch (cause) {
      throw new SheetQueryError('GViz request failed.', { cause })
    }

    if (!response.ok) {
      throw new SheetQueryError(
        `GViz request returned HTTP ${response.status} ${response.statusText}.`,
      )
    }

    const body = await response.text()
    const parsed = parseGVizResponse(body)
    assertGVizOk(parsed)

    if (options.verifyHeaders) {
      assertHeaders(options.verifyHeaders, tableHeaderLabels(parsed.table))
    }

    const rows = tableToObjects(parsed.table)
    return options.schema ? validateRows(options.schema, rows) : rows
  }
}

/**
 * Creates a {@linkcode SheetQuery} builder for the given spreadsheet.
 *
 * @param spreadsheetId The spreadsheet id from its URL — the segment between
 * `/d/` and `/edit`.
 * @param options Sheet target and header configuration.
 * @throws {SheetQueryError} when `spreadsheetId` is empty.
 *
 * @example Query a named tab
 * ```ts
 * import { sheetQuery } from '@cbcruk/sheet-query'
 *
 * const rows = await sheetQuery('1VwfZpdR...', { sheet: '발견물' }).limit(5).execute()
 * ```
 */
export function sheetQuery(spreadsheetId: string, options?: SheetQueryOptions): SheetQuery {
  return new SheetQuery(spreadsheetId, options)
}
