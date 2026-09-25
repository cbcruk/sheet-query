import { SheetQueryError } from './sheet-query.error.ts'

/**
 * Structured WHERE conditions for GViz queries.
 *
 * These helpers serialize values into GViz literal syntax (quoting strings,
 * formatting dates as `datetime '...'`, and so on), avoiding the escaping
 * mistakes that hand-written string conditions invite.
 *
 * Columns are named the way GViz names them: `A`, `B`, `C`, ... — or `Col1`,
 * `Col2`, ... inside a sheet built with `=QUERY()` over `IMPORTRANGE`.
 *
 * @see https://developers.google.com/chart/interactive/docs/querylanguage#where
 */

/**
 * A serialized WHERE expression. Combine with {@linkcode and}/{@linkcode or},
 * or pass one to {@linkcode SheetQuery.where}.
 */
export interface Condition {
  /** The rendered GViz expression, e.g. `` D = '서울' ``. */
  readonly expr: string
}

/**
 * Value types accepted as condition operands. A `Date` is rendered as a GViz
 * `datetime` literal in local time.
 */
export type ColumnValue = string | number | boolean | Date

/** Left-pads a number with zeros so date parts keep a fixed width. */
function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

/**
 * Renders a `Date` as the `YYYY-MM-DD HH:mm:ss` body of a GViz `datetime`
 * literal, reading local-time components — GViz compares against the sheet's own
 * wall-clock values, not UTC.
 */
function formatDatetime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/**
 * Serializes a JS value into a GViz query literal: numbers and booleans bare,
 * `Date` as `datetime 'YYYY-MM-DD HH:mm:ss'`, and strings quoted.
 *
 * GViz string literals have no escape syntax: a backslash is read literally,
 * and neither `\'` nor `''` escapes a quote. So a string is wrapped in single
 * quotes, or in double quotes when it contains a single quote, and left
 * otherwise untouched.
 *
 * Exported for building expressions the helpers below do not cover.
 *
 * @throws {SheetQueryError} for a string holding both `'` and `"`, which no
 * GViz literal can express.
 *
 * @example Hand-build a condition GViz supports but sheet-query does not
 * ```ts
 * import { serializeValue } from '@cbcruk/sheet-query'
 *
 * const condition = { expr: `B IN (${['서울', '부산'].map(serializeValue).join(', ')})` }
 * ```
 */
export function serializeValue(value: ColumnValue): string {
  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (value instanceof Date) {
    return `datetime '${formatDatetime(value)}'`
  }

  if (!value.includes("'")) {
    return `'${value}'`
  }

  if (!value.includes('"')) {
    return `"${value}"`
  }

  throw new SheetQueryError(
    `Cannot express ${JSON.stringify(value)} as a GViz string literal: it holds both ' and ", and GViz has no escape syntax.`,
  )
}

/** Wraps a rendered expression as a {@linkcode Condition}. */
function condition(expr: string): Condition {
  return { expr }
}

/** Builds `column <operator> <literal>`, serializing the operand. */
function comparison(column: string, operator: string, value: ColumnValue): Condition {
  return condition(`${column} ${operator} ${serializeValue(value)}`)
}

/**
 * Builds `column = value`.
 *
 * @example Match a Korean string value
 * ```ts
 * import { eq } from '@cbcruk/sheet-query'
 *
 * eq('D', '서울').expr // D = '서울'
 * ```
 */
export function eq(column: string, value: ColumnValue): Condition {
  return comparison(column, '=', value)
}

/** Builds `column != value`. */
export function ne(column: string, value: ColumnValue): Condition {
  return comparison(column, '!=', value)
}

/** Builds `column > value`. */
export function gt(column: string, value: ColumnValue): Condition {
  return comparison(column, '>', value)
}

/** Builds `column >= value`. */
export function gte(column: string, value: ColumnValue): Condition {
  return comparison(column, '>=', value)
}

/** Builds `column < value`. */
export function lt(column: string, value: ColumnValue): Condition {
  return comparison(column, '<', value)
}

/** Builds `column <= value`. */
export function lte(column: string, value: ColumnValue): Condition {
  return comparison(column, '<=', value)
}

/**
 * Builds `column LIKE pattern`, where `%` matches any run of characters and `_`
 * matches exactly one.
 *
 * @param column Column letter or id to match against.
 * @param pattern GViz wildcard pattern, e.g. `'김%'` for a prefix match.
 */
export function like(column: string, pattern: string): Condition {
  return comparison(column, 'LIKE', pattern)
}

/** Builds `column IS NULL`, matching rows whose cell is empty. */
export function isNull(column: string): Condition {
  return condition(`${column} IS NULL`)
}

/** Builds `column IS NOT NULL`, matching rows whose cell has a value. */
export function isNotNull(column: string): Condition {
  return condition(`${column} IS NOT NULL`)
}

/**
 * Combines conditions with `AND`, wrapping each operand in parentheses so
 * precedence never depends on how the operands were written.
 *
 * Chained {@linkcode SheetQuery.where} calls already AND together; reach for
 * this to nest an `AND` group inside an {@linkcode or}.
 */
export function and(...conditions: Condition[]): Condition {
  return condition(conditions.map((c) => `(${c.expr})`).join(' AND '))
}

/**
 * Combines conditions with `OR`, wrapping each operand in parentheses.
 *
 * @example Either city, and over 30
 * ```ts
 * import { and, eq, gt, or } from '@cbcruk/sheet-query'
 *
 * and(or(eq('D', '서울'), eq('D', '부산')), gt('C', 30))
 * ```
 */
export function or(...conditions: Condition[]): Condition {
  return condition(conditions.map((c) => `(${c.expr})`).join(' OR '))
}
