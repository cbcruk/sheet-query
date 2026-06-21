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
 * Prefer the {@link sheetQuery} factory over constructing this directly.
 *
 * @example
 * ```ts
 * const rows = await sheetQuery(spreadsheetId, { sheet: 'people' })
 *   .select('A', 'B')
 *   .where(eq('C', '서울'))
 *   .orderBy('B', 'desc')
 *   .limit(10)
 *   .execute();
 * ```
 */
export class SheetQuery {
  private readonly state: SheetQueryState

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

  /** Selects columns (by letter/id or aggregate expression). Empty means `SELECT *`. */
  select(...columns: string[]): this {
    this.state.select.push(...columns)
    return this
  }

  /** Appends a WHERE condition. Multiple calls are combined with AND. */
  where(condition: Condition): this {
    this.state.where.push(condition)
    return this
  }

  /** Adds GROUP BY columns. */
  groupBy(...columns: string[]): this {
    this.state.groupBy.push(...columns)
    return this
  }

  /** Adds an ORDER BY term. Multiple calls preserve order. */
  orderBy(column: string, direction: SortDirection = 'asc'): this {
    this.state.orderBy.push({ column, direction })
    return this
  }

  /** Sets the row limit. */
  limit(count: number): this {
    this.state.limit = count
    return this
  }

  /** Sets the row offset. */
  offset(count: number): this {
    this.state.offset = count
    return this
  }

  /** Returns the GViz `tq` query string (without executing). */
  toQuery(): string {
    return buildQuery(this.state)
  }

  /** Returns the full GViz request URL (without executing). */
  toUrl(): string {
    return buildUrl(this.state)
  }

  /**
   * Executes the query and returns the rows validated by `options.schema`.
   *
   * @throws {SheetQueryError} on network failure, a GViz error, or validation.
   */
  async execute<Schema extends StandardSchemaV1>(
    options: ExecuteOptions & { schema: Schema },
  ): Promise<InferOutput<Schema>[]>
  /**
   * Executes the query and returns rows as plain objects keyed by column label.
   *
   * @typeParam T - Expected row shape; defaults to {@link SheetRow}.
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

    const rows = tableToObjects(parsed.table)
    return options.schema ? validateRows(options.schema, rows) : rows
  }
}

/**
 * Creates a {@link SheetQuery} builder for the given spreadsheet.
 *
 * @param spreadsheetId - The spreadsheet id from its URL.
 * @param options - Sheet target and header configuration.
 */
export function sheetQuery(spreadsheetId: string, options?: SheetQueryOptions): SheetQuery {
  return new SheetQuery(spreadsheetId, options)
}
