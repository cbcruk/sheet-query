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
 * @throws {SheetQueryError} when the wrapper is missing or the JSON is invalid.
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

/** Throws when the response carries an error status, surfacing GViz messages. */
export function assertGVizOk(response: GVizResponse): void {
  if (response.status === 'error') {
    const detail =
      response.errors?.map((e) => e.detailed_message ?? e.message ?? e.reason).join('; ') ??
      'unknown error'

    throw new SheetQueryError(`GViz query failed: ${detail}`)
  }
}

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
