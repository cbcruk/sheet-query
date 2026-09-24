import { and } from './conditions.ts'
import { SheetQueryError } from './sheet-query.error.ts'
import type { SheetTab } from '../sheet-write/sheet-write.types.ts'
import type { SheetQueryState } from './sheet-query.types.ts'

/** Root of the GViz endpoint; the spreadsheet id and `/gviz/tq` complete it. */
const GVIZ_BASE = 'https://docs.google.com/spreadsheets/d'

/**
 * Builds the GViz `tq` query string from accumulated state, emitting clauses in
 * the order GViz expects: SELECT, WHERE, GROUP BY, ORDER BY, LIMIT, OFFSET.
 */
export function buildQuery(state: SheetQueryState): string {
  const parts: string[] = []

  parts.push(state.select.length > 0 ? `SELECT ${state.select.join(', ')}` : 'SELECT *')

  if (state.where.length > 0) {
    const where = state.where.length === 1 ? state.where[0]! : and(...state.where)
    parts.push(`WHERE ${where.expr}`)
  }

  if (state.groupBy.length > 0) {
    parts.push(`GROUP BY ${state.groupBy.join(', ')}`)
  }

  if (state.orderBy.length > 0) {
    const terms = state.orderBy.map((term) => `${term.column} ${term.direction.toUpperCase()}`)
    parts.push(`ORDER BY ${terms.join(', ')}`)
  }

  if (state.limit !== undefined) {
    parts.push(`LIMIT ${state.limit}`)
  }

  if (state.offset !== undefined) {
    parts.push(`OFFSET ${state.offset}`)
  }

  return parts.join(' ')
}

/** Builds the full GViz request URL, including the encoded query and sheet target. */
export function buildUrl(state: SheetQueryState): string {
  const params = new URLSearchParams()
  params.set('tq', buildQuery(state))
  params.set('tqx', 'out:json')
  params.set('headers', String(state.headers))

  if (state.sheet !== undefined) {
    params.set('sheet', state.sheet)
  }

  if (state.gid !== undefined) {
    params.set('gid', String(state.gid))
  }

  return `${GVIZ_BASE}/${state.spreadsheetId}/gviz/tq?${params.toString()}`
}

/**
 * Asserts that the query's `sheet` and `gid` name tabs that exist in `tabs`.
 *
 * GViz answers a missing target with the first tab's rows and `status: 'ok'`,
 * so this check is the only way to tell a typo from real data. A query with no
 * target passes: the first tab is then what the caller asked for.
 *
 * @throws {SheetQueryError} naming the missing target and the tabs that exist.
 */
export function assertSheetTarget(state: SheetQueryState, tabs: SheetTab[]): void {
  const available = tabs.map((tab) => `"${tab.title}" (gid ${tab.sheetId})`).join(', ')

  if (state.sheet !== undefined && !tabs.some((tab) => tab.title === state.sheet)) {
    throw new SheetQueryError(`Sheet tab not found: "${state.sheet}". Available: ${available}.`)
  }

  if (state.gid !== undefined && !tabs.some((tab) => String(tab.sheetId) === String(state.gid))) {
    throw new SheetQueryError(`Sheet tab not found: gid ${state.gid}. Available: ${available}.`)
  }
}
