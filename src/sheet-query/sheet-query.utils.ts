import { and } from './conditions.ts'
import type { SheetQueryState } from './sheet-query.types.ts'

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
