import { SheetQueryError } from './sheet-query.error.ts'
import type { CellValue, GVizColumnType, GVizResponse, GVizTable, SheetRow } from './gviz.types.ts'

/**
 * Matches the JSONP wrapper GViz returns, e.g.
 * `/*O_o*\/\ngoogle.visualization.Query.setResponse({...});`
 *
 * The capture is greedy up to the final `)` so the whole JSON payload is taken.
 */
const JSONP_WRAPPER = /setResponse\(([\s\S]*)\)/

/** `Date(2024,0,15)` or `Date(2024,0,15,12,30,0)` (month is zero-based). */
const GVIZ_DATE = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/

/**
 * Strips the JSONP wrapper from a raw GViz response body and parses the JSON.
 *
 * GViz answers `tqx=out:json` with JavaScript, not JSON — a leading comment and
 * a `setResponse(...)` call — so the payload has to be cut out before parsing.
 *
 * @throws {SheetQueryError} when the wrapper is missing or the JSON is invalid.
 *
 * @example Parse a response fetched by hand
 * ```ts
 * import { parseGVizResponse, sheetQuery } from '@cbcruk/sheet-query'
 *
 * const response = await fetch(sheetQuery('1VwfZpdR...').toUrl())
 * const parsed = parseGVizResponse(await response.text())
 * ```
 */
export function parseGVizResponse(body: string): GVizResponse {
  const match = body.match(JSONP_WRAPPER)

  if (!match || match[1] === undefined) {
    throw new SheetQueryError('Invalid GViz response: setResponse(...) wrapper not found.')
  }

  try {
    return JSON.parse(match[1]) as GVizResponse
  } catch (cause) {
    throw new SheetQueryError('Failed to parse GViz JSON payload.', { cause })
  }
}

/**
 * Asserts a parsed response succeeded, joining GViz's own error messages into
 * the thrown message.
 *
 * GViz reports failures with HTTP 200 and `status: 'error'`, so a response that
 * fetched cleanly still has to be checked.
 *
 * @throws {SheetQueryError} when `status` is `'error'`.
 */
export function assertGVizOk(response: GVizResponse): void {
  if (response.status === 'error') {
    const detail =
      response.errors?.map((e) => e.detailed_message ?? e.message ?? e.reason).join('; ') ??
      'unknown error'

    throw new SheetQueryError(`GViz query failed: ${detail}`)
  }
}

/**
 * Parses GViz's `Date(2024,0,15)` cell encoding into a `Date`.
 *
 * The month is zero-based, matching the `Date` constructor, and the parts are
 * read as local time because the sheet's values are wall-clock.
 *
 * @throws {SheetQueryError} when the value is not in that form.
 */
function parseGVizDate(raw: string): Date {
  const match = raw.match(GVIZ_DATE)

  if (!match) {
    throw new SheetQueryError(`Unrecognized GViz date value: ${raw}`)
  }

  const [, year, month, day, hour, minute, second] = match

  return new Date(
    Number(year),
    Number(month),
    Number(day),
    hour ? Number(hour) : 0,
    minute ? Number(minute) : 0,
    second ? Number(second) : 0,
  )
}

/**
 * Coerces one raw cell value to a native JS type, using the column's declared
 * type. Missing cells become `null`; `timeofday` stays an `[h, m, s, ms]` tuple,
 * which has no JS equivalent.
 */
function convertCellValue(value: unknown, type: GVizColumnType): CellValue {
  if (value === null || value === undefined) {
    return null
  }

  switch (type) {
    case 'date':
    case 'datetime':
      return parseGVizDate(value as string)
    case 'timeofday':
      return value as number[]
    case 'number':
      return value as number
    case 'boolean':
      return value as boolean
    default:
      return value as string
  }
}

/**
 * Resolves the object key for a column: the header label when present,
 * otherwise the GViz column id, falling back to a positional `Col{n}` name.
 *
 * This handles the trap where `=QUERY()`/`IMPORTRANGE` strips header labels and
 * exposes columns only as `A, B, ...` ids.
 */
function resolveColumnKeys(table: GVizTable): string[] {
  return table.cols.map((col, index) => col.label || col.id || `Col${index + 1}`)
}

/**
 * Converts a GViz table into an array of plain objects keyed by column label,
 * with cell values coerced to native JS types (numbers, booleans, `Date`s).
 *
 * Empty cells become `null` rather than being omitted, so every row has the
 * same keys.
 *
 * @throws {SheetQueryError} when a date cell is not in GViz's `Date(...)` form.
 */
export function tableToObjects(table: GVizTable): SheetRow[] {
  const keys = resolveColumnKeys(table)

  return table.rows.map((row) => {
    const record: SheetRow = {}

    table.cols.forEach((col, index) => {
      const cell = row.c[index]
      const key = keys[index]!

      record[key] = cell ? convertCellValue(cell.v, col.type) : null
    })

    return record
  })
}
