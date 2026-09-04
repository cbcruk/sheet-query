/**
 * Structured WHERE conditions for GViz queries.
 *
 * These helpers serialize values into GViz literal syntax (quoting strings,
 * formatting dates as `date '...'`, etc.), avoiding the escaping mistakes that
 * raw string conditions invite.
 *
 * @see https://developers.google.com/chart/interactive/docs/querylanguage#where
 */

/** A serialized WHERE expression. Combine with {@link and}/{@link or}. */
export interface Condition {
  readonly expr: string
}

/** Value types accepted as condition operands. */
export type ColumnValue = string | number | boolean | Date

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

function formatDatetime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/** Serializes a JS value into a GViz query literal. */
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

  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function condition(expr: string): Condition {
  return { expr }
}

function comparison(column: string, operator: string, value: ColumnValue): Condition {
  return condition(`${column} ${operator} ${serializeValue(value)}`)
}

/** `column = value` */
export function eq(column: string, value: ColumnValue): Condition {
  return comparison(column, '=', value)
}

/** `column != value` */
export function ne(column: string, value: ColumnValue): Condition {
  return comparison(column, '!=', value)
}

/** `column > value` */
export function gt(column: string, value: ColumnValue): Condition {
  return comparison(column, '>', value)
}

/** `column >= value` */
export function gte(column: string, value: ColumnValue): Condition {
  return comparison(column, '>=', value)
}

/** `column < value` */
export function lt(column: string, value: ColumnValue): Condition {
  return comparison(column, '<', value)
}

/** `column <= value` */
export function lte(column: string, value: ColumnValue): Condition {
  return comparison(column, '<=', value)
}

/** `column LIKE pattern` (GViz uses `%` and `_` wildcards). */
export function like(column: string, pattern: string): Condition {
  return comparison(column, 'LIKE', pattern)
}

/** `column IS NULL` */
export function isNull(column: string): Condition {
  return condition(`${column} IS NULL`)
}

/** `column IS NOT NULL` */
export function isNotNull(column: string): Condition {
  return condition(`${column} IS NOT NULL`)
}

/** Combines conditions with `AND`, wrapping each operand in parentheses. */
export function and(...conditions: Condition[]): Condition {
  return condition(conditions.map((c) => `(${c.expr})`).join(' AND '))
}

/** Combines conditions with `OR`, wrapping each operand in parentheses. */
export function or(...conditions: Condition[]): Condition {
  return condition(conditions.map((c) => `(${c.expr})`).join(' OR '))
}
