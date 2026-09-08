/**
 * Turns the UI state into a `SheetQuery`, using only the public API the README
 * documents — no private helpers, no hand-assembled query strings.
 */
import {
  and,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  sheetQuery,
  serializeValue,
} from 'sheet-query'
import type { ColumnValue, Condition, SheetQuery, StandardSchemaV1 } from 'sheet-query'
import { SPREADSHEET_ID, columnById, tabByName } from './sheets.ts'
import type { TabMeta } from './sheets.ts'

/** Comparison operators exposed by the builder, in menu order. */
export const OPERATORS = {
  eq: { label: '=', arity: 1 },
  ne: { label: '!=', arity: 1 },
  gt: { label: '>', arity: 1 },
  gte: { label: '>=', arity: 1 },
  lt: { label: '<', arity: 1 },
  lte: { label: '<=', arity: 1 },
  like: { label: 'LIKE', arity: 1 },
  isNull: { label: 'IS NULL', arity: 0 },
  isNotNull: { label: 'IS NOT NULL', arity: 0 },
} as const

/** Key of one {@linkcode OPERATORS} entry. */
export type Operator = keyof typeof OPERATORS

/** One row of the WHERE builder. */
export interface ConditionInput {
  /** Column id (`A`, `B`, ...) the condition applies to. */
  column: string
  /** Which comparison to build. */
  operator: Operator
  /** Raw text from the input, coerced to the column's type at build time. */
  value: string
}

/** Everything the UI controls, and the only source the query is derived from. */
export interface State {
  /** Name of the tab being queried. */
  tab: string
  /** Selected column ids; empty means `SELECT *`. */
  select: string[]
  /** Comma-separated aggregate expressions, e.g. `count(B), sum(E)`. */
  aggregate: string
  /** How multiple conditions combine. */
  combinator: 'and' | 'or'
  /** WHERE rows, incomplete ones included — those are skipped when building. */
  conditions: ConditionInput[]
  /** Column ids to GROUP BY. */
  groupBy: string[]
  /** Column id or aggregate expression to sort by; empty means no ORDER BY. */
  orderColumn: string
  /** Direction for {@linkcode orderColumn}. */
  orderDirection: 'asc' | 'desc'
  /** LIMIT as typed; empty means no limit. */
  limit: string
  /** OFFSET as typed; empty means no offset. */
  offset: string
  /** Pass `verifyHeaders` to `execute()`. */
  verifyHeaders: boolean
  /** Corrupt the expected headers on purpose, to demonstrate drift detection. */
  breakHeaders: boolean
  /** Validate each row against {@linkcode coordinateSchema}. */
  useSchema: boolean
}

/**
 * The state a tab opens with: every column selected, no filters, 20 rows.
 *
 * @param tabName Tab to build the state for; must exist in `TABS`.
 */
export function defaultState(tabName = '발견물'): State {
  const tab = tabByName(tabName)

  return {
    tab: tabName,
    select: tab.columns.map((column) => column.id),
    aggregate: '',
    combinator: 'and',
    conditions: [],
    groupBy: [],
    orderColumn: '',
    orderDirection: 'asc',
    limit: '20',
    offset: '',
    verifyHeaders: false,
    breakHeaders: false,
    useSchema: false,
  }
}

/**
 * Coerces the raw text input to the column's GViz type, so `eq` emits `E = 55`
 * for a number column and `A = '신대륙'` for a string one.
 */
function coerce(raw: string, tab: TabMeta, columnId: string): ColumnValue {
  const column = columnById(tab, columnId)
  const trimmed = raw.trim()

  if (column?.type === 'number') {
    const parsed = Number(trimmed)

    if (!Number.isFinite(parsed)) {
      throw new Error(`"${raw}"는 숫자 컬럼(${column.label})의 값으로 쓸 수 없습니다.`)
    }

    return parsed
  }

  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true'
  }

  return raw
}

/** Builds one `Condition` from a UI row, or `null` when it is still incomplete. */
export function buildCondition(input: ConditionInput, tab: TabMeta): Condition | null {
  if (!input.column) {
    return null
  }

  if (input.operator === 'isNull') {
    return isNull(input.column)
  }

  if (input.operator === 'isNotNull') {
    return isNotNull(input.column)
  }

  if (input.value.trim() === '') {
    return null
  }

  const value = coerce(input.value, tab, input.column)

  switch (input.operator) {
    case 'eq':
      return eq(input.column, value)
    case 'ne':
      return ne(input.column, value)
    case 'gt':
      return gt(input.column, value)
    case 'gte':
      return gte(input.column, value)
    case 'lt':
      return lt(input.column, value)
    case 'lte':
      return lte(input.column, value)
    case 'like':
      return like(input.column, String(value))
  }
}

/** The GViz literal a condition value serializes to — shown in the UI as a hint. */
export function previewLiteral(input: ConditionInput, tab: TabMeta): string | null {
  if (OPERATORS[input.operator].arity === 0 || input.value.trim() === '' || !input.column) {
    return null
  }

  try {
    return serializeValue(coerce(input.value, tab, input.column))
  } catch {
    return null
  }
}

/** Assembles the chained builder. Throws on invalid input rather than guessing. */
export function buildQuery(state: State): SheetQuery {
  const tab = tabByName(state.tab)
  const query = sheetQuery(SPREADSHEET_ID, { sheet: tab.name })

  const aggregates = state.aggregate
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')

  query.select(...state.select, ...aggregates)

  const conditions = state.conditions
    .map((input) => buildCondition(input, tab))
    .filter((condition): condition is Condition => condition !== null)

  if (conditions.length === 1) {
    query.where(conditions[0]!)
  } else if (conditions.length > 1) {
    query.where(state.combinator === 'and' ? and(...conditions) : or(...conditions))
  }

  if (state.groupBy.length > 0) {
    query.groupBy(...state.groupBy)
  }

  if (state.orderColumn) {
    query.orderBy(state.orderColumn, state.orderDirection)
  }

  if (state.limit.trim() !== '') {
    query.limit(Number(state.limit))
  }

  if (state.offset.trim() !== '') {
    query.offset(Number(state.offset))
  }

  return query
}

/**
 * The header labels `execute({ verifyHeaders })` should see for the current
 * selection. `breakHeaders` renames the first one to demonstrate drift detection.
 */
export function expectedHeaders(state: State): string[] {
  const tab = tabByName(state.tab)
  const labels = state.select.map((id) => columnById(tab, id)?.label ?? id)

  if (state.breakHeaders && labels.length > 0) {
    return [`${labels[0]}_변경됨`, ...labels.slice(1)]
  }

  return labels
}

/**
 * A hand-rolled Standard Schema — no Zod, no dependency — asserting that the
 * two coordinate columns really came back as numbers.
 *
 * Any Standard Schema library (Zod 3.24+, Valibot, ArkType) drops in here
 * unchanged; this exists to keep the example dependency-free.
 */
export const coordinateSchema: StandardSchemaV1<unknown, Record<string, unknown>> = {
  '~standard': {
    version: 1,
    vendor: 'sheet-query-example',
    validate(value) {
      const row = value as Record<string, unknown>
      const issues: { message: string; path: [string] }[] = []

      for (const key of ['위도', '경도']) {
        if (!(key in row)) {
          issues.push({ message: `컬럼이 선택되지 않았습니다.`, path: [key] })
        } else if (typeof row[key] !== 'number') {
          issues.push({ message: `숫자가 아닙니다: ${String(row[key])}`, path: [key] })
        }
      }

      return issues.length > 0 ? { issues } : { value: row }
    },
  },
}

/** One-click scenarios, mirroring the sections of `examples/discoveries.ts`. */
export interface Preset {
  /** Button label. */
  title: string
  /** Which feature the preset demonstrates, shown under the title. */
  note: string
  /** The full state the button applies. */
  state: State
}

/** Builds a preset by patching the target tab's default state. */
function preset(title: string, note: string, patch: Partial<State>): Preset {
  const base = defaultState(patch.tab ?? '발견물')
  return { title, note, state: { ...base, ...patch } }
}

/** The scenarios offered as one-click buttons, in display order. */
export const PRESETS: Preset[] = [
  preset('신대륙의 발견물', 'WHERE + ORDER BY + LIMIT', {
    conditions: [{ column: 'A', operator: 'eq', value: '신대륙' }],
    orderColumn: 'B',
    orderDirection: 'asc',
    limit: '8',
  }),
  preset('지역별 발견물 수', 'GROUP BY 집계 — 206행을 서버에서 세고 10행만 받습니다', {
    select: ['A'],
    aggregate: 'count(B)',
    groupBy: ['A'],
    orderColumn: 'count(B)',
    orderDirection: 'desc',
    limit: '',
  }),
  preset('북위 55도 이상, 증거품 있음', 'AND + 숫자 비교 + IS NOT NULL', {
    select: ['B', 'D', 'E', 'F', 'G'],
    conditions: [
      { column: 'E', operator: 'gt', value: '55' },
      { column: 'G', operator: 'isNotNull', value: '' },
    ],
    orderColumn: 'E',
    orderDirection: 'desc',
    limit: '',
  }),
  preset('이름에 "성당"이 들어가는 발견물', 'LIKE 와일드카드', {
    select: ['A', 'B', 'D'],
    conditions: [{ column: 'B', operator: 'like', value: '%성당%' }],
    limit: '10',
  }),
  preset('도서관이 있는 이베리아 도시', '다른 탭 — 같은 빌더, 다른 스키마', {
    tab: '도시',
    select: ['B', 'C', 'D', 'E'],
    conditions: [
      { column: 'A', operator: 'eq', value: '이베리아' },
      { column: 'G', operator: 'eq', value: '有' },
    ],
    limit: '',
  }),
  preset('헤더 drift 재현', 'verifyHeaders — 기대 헤더를 어긋나게 해 실패시킵니다', {
    select: ['A', 'B', 'C'],
    limit: '5',
    verifyHeaders: true,
    breakHeaders: true,
  }),
  preset('좌표 스키마 검증 통과', 'Standard Schema — 위도·경도가 숫자인지 확인', {
    select: ['B', 'E', 'F'],
    conditions: [{ column: 'A', operator: 'eq', value: '인도' }],
    limit: '',
    useSchema: true,
  }),
  preset('좌표 스키마 검증 실패', '경도를 빼면 검증이 잡아냅니다', {
    select: ['B', 'E', 'G'],
    limit: '5',
    useSchema: true,
  }),
]
