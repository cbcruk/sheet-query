/**
 * A live GViz query playground: build a query with the chained API, watch the
 * `tq` string and request URL update as you type, then run it against the real
 * spreadsheet from the browser.
 *
 * Reads go straight from the page to Google — no server proxy — which is the
 * read path the architecture assumes. It works because GViz echoes the request
 * `Origin` for publicly-readable sheets.
 */
import { SheetQueryError } from 'sheet-query'
import type { SheetRow } from 'sheet-query'
import { SPREADSHEET_URL, TABS, tabByName } from './sheets.ts'
import {
  OPERATORS,
  PRESETS,
  buildQuery,
  coordinateSchema,
  defaultState,
  expectedHeaders,
  previewLiteral,
} from './query.ts'
import type { ConditionInput, Operator, State } from './query.ts'

/** The single source of truth; every panel renders from it and patches it. */
let state: State = defaultState()
/** Rows and elapsed time from the last successful run, or `null` before one. */
let lastRun: { rows: SheetRow[]; ms: number } | null = null
/** Guards against overlapping requests while one is in flight. */
let running = false
/** Message from the last failed run, cleared when a new one starts. */
let failure: string | null = null

/**
 * Creates an element, assigns the given properties, and appends the children —
 * a minimal stand-in for a framework, so the example stays dependency-free.
 */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  const { class: className, ...rest } = props

  if (className) {
    node.className = className
  }

  Object.assign(node, rest)

  for (const child of children) {
    node.append(child)
  }

  return node
}

/** Builds a `<select>` bound to a value, reporting the new one on change. */
function pick<T extends string>(
  value: T,
  options: { value: T; label: string }[],
  onChange: (next: T) => void,
): HTMLSelectElement {
  const select = el('select')

  for (const option of options) {
    select.append(el('option', { value: option.value, textContent: option.label }))
  }

  select.value = value
  select.addEventListener('change', () => onChange(select.value as T))

  return select
}

/** Applies a state patch and re-renders. The only way panels mutate state. */
function update(patch: Partial<State>): void {
  state = { ...state, ...patch }
  render()
}

/* ------------------------------------------------------------------ panels */

/** Buttons that load a preset and immediately run it. */
function presetPanel(): HTMLElement {
  const buttons = PRESETS.map((item) =>
    el(
      'button',
      {
        class: 'preset',
        type: 'button',
        onclick: () => {
          failure = null
          lastRun = null
          state = item.state
          render()
          void run()
        },
      },
      [
        el('span', { class: 'preset-title', textContent: item.title }),
        el('span', { class: 'preset-note', textContent: item.note }),
      ],
    ),
  )

  return panel('프리셋', [el('div', { class: 'presets' }, buttons)], {
    hint: 'examples/discoveries.ts의 시나리오와 동일합니다',
  })
}

/** Tab picker. Switching tabs resets the state, since column ids differ. */
function tabPanel(): HTMLElement {
  const options = TABS.map((tab) =>
    el(
      'button',
      {
        class: `tab${tab.name === state.tab ? ' is-active' : ''}`,
        type: 'button',
        onclick: () => {
          if (tab.name !== state.tab) {
            lastRun = null
            failure = null
            state = defaultState(tab.name)
            render()
          }
        },
      },
      [
        el('span', { class: 'tab-name', textContent: tab.name }),
        el('span', { class: 'tab-note', textContent: tab.description }),
      ],
    ),
  )

  return panel('탭', [el('div', { class: 'tabs' }, options)])
}

/** Column chips for SELECT, plus the free-text field for aggregate expressions. */
function selectPanel(): HTMLElement {
  const tab = tabByName(state.tab)

  const chips = tab.columns.map((column) => {
    const active = state.select.includes(column.id)

    return el(
      'button',
      {
        class: `chip${active ? ' is-active' : ''}`,
        type: 'button',
        onclick: () =>
          update({
            select: active
              ? state.select.filter((id) => id !== column.id)
              : tab.columns
                  .filter((c) => c.id === column.id || state.select.includes(c.id))
                  .map((c) => c.id),
          }),
      },
      [
        el('span', { class: 'chip-id', textContent: column.id }),
        el('span', { textContent: column.label }),
        el('span', { class: `chip-type type-${column.type}`, textContent: column.type }),
      ],
    )
  })

  const aggregate = el('input', {
    class: 'text',
    type: 'text',
    value: state.aggregate,
    placeholder: '집계 식 — 예: count(B), sum(E)',
    oninput: (event) => {
      state.aggregate = (event.target as HTMLInputElement).value
      renderQueryCard()
    },
  })

  return panel(
    'SELECT',
    [el('div', { class: 'chips' }, chips), el('label', { class: 'field' }, ['집계 식', aggregate])],
    { hint: '전부 해제하면 SELECT *' },
  )
}

/**
 * One WHERE row: column, operator, value, and the GViz literal that value
 * serializes to. Typing re-renders only the query card and this row's literal,
 * so the input keeps focus.
 */
function conditionRow(input: ConditionInput, index: number): HTMLElement {
  const tab = tabByName(state.tab)
  const takesValue = OPERATORS[input.operator].arity === 1

  const column = pick(
    input.column,
    tab.columns.map((c) => ({ value: c.id, label: `${c.id} · ${c.label}` })),
    (next) => {
      const conditions = [...state.conditions]
      conditions[index] = { ...input, column: next }
      update({ conditions })
    },
  )

  const operator = pick(
    input.operator,
    (Object.keys(OPERATORS) as Operator[]).map((key) => ({
      value: key,
      label: OPERATORS[key].label,
    })),
    (next) => {
      const conditions = [...state.conditions]
      conditions[index] = { ...input, operator: next }
      update({ conditions })
    },
  )

  const value = el('input', {
    class: 'text',
    type: 'text',
    value: input.value,
    disabled: !takesValue,
    placeholder: takesValue ? '값' : '—',
    oninput: (event) => {
      const conditions = [...state.conditions]
      conditions[index] = { ...input, value: (event.target as HTMLInputElement).value }
      state = { ...state, conditions }
      renderQueryCard()
      renderLiteral(index)
    },
  })

  const remove = el('button', {
    class: 'icon-button',
    type: 'button',
    textContent: '×',
    title: '조건 삭제',
    onclick: () => update({ conditions: state.conditions.filter((_, i) => i !== index) }),
  })

  const literal = el('span', {
    class: 'literal',
    id: `literal-${index}`,
    textContent: previewLiteral(input, tab) ?? '',
  })

  return el('div', { class: 'condition' }, [
    el('div', { class: 'condition-controls' }, [column, operator, value, remove]),
    literal,
  ])
}

/** Refreshes one condition row's serialized-literal hint in place. */
function renderLiteral(index: number): void {
  const input = state.conditions[index]
  const node = document.getElementById(`literal-${index}`)

  if (input && node) {
    node.textContent = previewLiteral(input, tabByName(state.tab)) ?? ''
  }
}

/** The condition rows, the AND/OR selector, and the add button. */
function wherePanel(): HTMLElement {
  const rows = state.conditions.map(conditionRow)

  const add = el('button', {
    class: 'ghost-button',
    type: 'button',
    textContent: '+ 조건 추가',
    onclick: () => {
      const first = tabByName(state.tab).columns[0]
      update({
        conditions: [...state.conditions, { column: first?.id ?? 'A', operator: 'eq', value: '' }],
      })
    },
  })

  const combinator = pick(
    state.combinator,
    [
      { value: 'and' as const, label: 'AND' },
      { value: 'or' as const, label: 'OR' },
    ],
    (next) => update({ combinator: next }),
  )

  const header: (Node | string)[] =
    state.conditions.length > 1 ? [el('div', { class: 'combinator' }, ['결합', combinator])] : []

  return panel('WHERE', [...header, ...rows, add], {
    hint: '값은 컬럼 타입에 맞춰 GViz 리터럴로 직렬화됩니다',
  })
}

/** GROUP BY chips plus the ORDER BY, LIMIT, and OFFSET controls. */
function shapePanel(): HTMLElement {
  const tab = tabByName(state.tab)
  const aggregates = state.aggregate
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')

  const orderOptions = [
    { value: '', label: '(없음)' },
    ...tab.columns.map((c) => ({ value: c.id, label: `${c.id} · ${c.label}` })),
    ...aggregates.map((expr) => ({ value: expr, label: expr })),
  ]

  const groupChips = tab.columns.map((column) => {
    const active = state.groupBy.includes(column.id)

    return el('button', {
      class: `chip chip-compact${active ? ' is-active' : ''}`,
      type: 'button',
      textContent: `${column.id} · ${column.label}`,
      onclick: () =>
        update({
          groupBy: active
            ? state.groupBy.filter((id) => id !== column.id)
            : [...state.groupBy, column.id],
        }),
    })
  })

  const number = (label: string, key: 'limit' | 'offset', placeholder: string): HTMLLabelElement =>
    el('label', { class: 'field' }, [
      label,
      el('input', {
        class: 'text',
        type: 'number',
        min: '0',
        value: state[key],
        placeholder,
        oninput: (event) => {
          state = { ...state, [key]: (event.target as HTMLInputElement).value }
          renderQueryCard()
        },
      }),
    ])

  return panel('GROUP BY · ORDER BY · LIMIT', [
    el('div', { class: 'chips' }, groupChips),
    el('div', { class: 'row' }, [
      el('label', { class: 'field grow' }, [
        'ORDER BY',
        pick(state.orderColumn, orderOptions, (next) => update({ orderColumn: next })),
      ]),
      el('label', { class: 'field' }, [
        '방향',
        pick(
          state.orderDirection,
          [
            { value: 'asc' as const, label: 'ASC' },
            { value: 'desc' as const, label: 'DESC' },
          ],
          (next) => update({ orderDirection: next }),
        ),
      ]),
    ]),
    el('div', { class: 'row' }, [
      number('LIMIT', 'limit', '없음'),
      number('OFFSET', 'offset', '없음'),
    ]),
  ])
}

/** A labelled checkbox with a note explaining what enabling it does. */
function toggle(
  label: string,
  note: string,
  checked: boolean,
  onChange: (next: boolean) => void,
  disabled = false,
): HTMLElement {
  const input = el('input', {
    type: 'checkbox',
    checked,
    disabled,
    onchange: (event) => onChange((event.target as HTMLInputElement).checked),
  })

  return el('label', { class: `toggle${disabled ? ' is-disabled' : ''}` }, [
    input,
    el('span', {}, [
      el('span', { class: 'toggle-label', textContent: label }),
      el('span', { class: 'toggle-note', textContent: note }),
    ]),
  ])
}

/** The `execute()` options: header verification and schema validation. */
function optionsPanel(): HTMLElement {
  return panel('execute() 옵션', [
    toggle('verifyHeaders', '실제 헤더가 기대와 다르면 throw', state.verifyHeaders, (next) =>
      update({ verifyHeaders: next }),
    ),
    toggle(
      '헤더를 일부러 어긋나게',
      '첫 헤더 이름을 바꿔 drift를 재현',
      state.breakHeaders,
      (next) => update({ breakHeaders: next }),
      !state.verifyHeaders,
    ),
    toggle(
      'schema (Standard Schema)',
      '위도·경도가 숫자인지 행마다 검증',
      state.useSchema,
      (next) => update({ useSchema: next }),
    ),
  ])
}

/** The section shell every panel above is wrapped in. */
function panel(
  title: string,
  children: (Node | string)[],
  options: { hint?: string } = {},
): HTMLElement {
  const head: (Node | string)[] = [el('h2', { textContent: title })]

  if (options.hint) {
    head.push(el('span', { class: 'hint', textContent: options.hint }))
  }

  return el('section', { class: 'panel' }, [
    el('div', { class: 'panel-head' }, head),
    el('div', { class: 'panel-body' }, children),
  ])
}

/* ------------------------------------------------------------ query + run */

/** Copies text to the clipboard, confirming briefly in the button label. */
function copyButton(getText: () => string): HTMLButtonElement {
  const button = el('button', { class: 'ghost-button copy', type: 'button', textContent: '복사' })

  button.addEventListener('click', () => {
    void navigator.clipboard.writeText(getText()).then(() => {
      button.textContent = '복사됨'
      setTimeout(() => {
        button.textContent = '복사'
      }, 1200)
    })
  })

  return button
}

/**
 * Renders `toQuery()` and `toUrl()` for the current state, without executing.
 * An invalid state (a non-numeric value on a number column, say) shows the
 * builder's own error rather than a stale query.
 */
function renderQueryCard(): void {
  const host = document.getElementById('query-card')

  if (!host) {
    return
  }

  host.replaceChildren()

  let queryText: string
  let urlText: string

  try {
    const query = buildQuery(state)
    queryText = query.toQuery()
    urlText = query.toUrl()
  } catch (error) {
    host.append(
      el('div', { class: 'error' }, [
        el('strong', { textContent: '쿼리를 만들 수 없습니다' }),
        el('p', { textContent: error instanceof Error ? error.message : String(error) }),
      ]),
    )
    return
  }

  host.append(
    el('div', { class: 'code-block' }, [
      el('div', { class: 'code-head' }, [
        el('span', { textContent: 'toQuery()' }),
        copyButton(() => queryText),
      ]),
      el('code', { class: 'tq', textContent: queryText }),
    ]),
    el('div', { class: 'code-block' }, [
      el('div', { class: 'code-head' }, [
        el('span', { textContent: 'toUrl()' }),
        copyButton(() => urlText),
      ]),
      el('code', { class: 'url', textContent: urlText }),
    ]),
  )

  if (state.verifyHeaders) {
    host.append(
      el('p', { class: 'expected' }, [
        el('span', { class: 'expected-label', textContent: 'verifyHeaders' }),
        el('span', { textContent: expectedHeaders(state).join(' | ') || '(없음)' }),
      ]),
    )
  }
}

/**
 * Executes the current query against the live sheet and stores the outcome.
 *
 * Never rejects: failures are captured into `failure` so they render as part of
 * the page, which is the point of the drift and schema toggles.
 */
async function run(): Promise<void> {
  if (running) {
    return
  }

  running = true
  failure = null
  renderOutput()

  const started = performance.now()

  try {
    const query = buildQuery(state)
    const rows = state.useSchema
      ? ((await query.execute({
          schema: coordinateSchema,
          ...(state.verifyHeaders ? { verifyHeaders: expectedHeaders(state) } : {}),
        })) as SheetRow[])
      : await query.execute(state.verifyHeaders ? { verifyHeaders: expectedHeaders(state) } : {})

    lastRun = { rows, ms: Math.round(performance.now() - started) }
  } catch (error) {
    lastRun = null
    failure = describe(error)
  } finally {
    running = false
    renderOutput()
  }
}

/** Unwraps the `cause` chain so nested validation issues stay visible. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }

  const kind = error instanceof SheetQueryError ? 'SheetQueryError' : error.constructor.name
  const chain: string[] = [error.message]

  let cause = error.cause

  while (cause instanceof Error) {
    chain.push(cause.message)
    cause = cause.cause
  }

  return `${kind}: ${chain.join('\n  ↳ ')}`
}

/* --------------------------------------------------------------- results */

/** Renders one converted cell value, styled by the JS type it came back as. */
function cell(value: unknown): HTMLTableCellElement {
  if (value === null || value === undefined) {
    return el('td', { class: 'is-null', textContent: '∅' })
  }

  if (typeof value === 'number') {
    return el('td', { class: 'is-number', textContent: String(value) })
  }

  if (typeof value === 'boolean') {
    return el('td', { class: 'is-boolean', textContent: String(value) })
  }

  if (value instanceof Date) {
    return el('td', { class: 'is-date', textContent: value.toISOString() })
  }

  if (typeof value === 'string') {
    return el('td', { textContent: value })
  }

  // GViz `timeofday` arrives as a number tuple; anything else is unexpected, so
  // show it verbatim rather than an "[object Object]" that hides the problem.
  return el('td', { class: 'is-raw', textContent: JSON.stringify(value) })
}

/** Renders the result rows, taking column order from the first row's keys. */
function resultsTable(rows: SheetRow[]): HTMLElement {
  if (rows.length === 0) {
    return el('p', { class: 'empty', textContent: '조건에 맞는 행이 없습니다.' })
  }

  const keys = Object.keys(rows[0]!)

  const head = el('thead', {}, [
    el(
      'tr',
      {},
      keys.map((key) => el('th', { textContent: key })),
    ),
  ])

  const body = el(
    'tbody',
    {},
    rows.map((row) =>
      el(
        'tr',
        {},
        keys.map((key) => cell(row[key])),
      ),
    ),
  )

  return el('div', { class: 'table-scroll' }, [el('table', {}, [head, body])])
}

/** Renders whichever of the four output states applies: error, running, empty, or results. */
function renderOutput(): void {
  const host = document.getElementById('output')
  const button = document.getElementById('run') as HTMLButtonElement | null

  if (button) {
    button.disabled = running
    button.textContent = running ? '실행 중…' : 'execute()'
  }

  if (!host) {
    return
  }

  host.replaceChildren()

  if (failure) {
    host.append(
      el('div', { class: 'error' }, [
        el('strong', { textContent: '실패' }),
        el('pre', { textContent: failure }),
      ]),
    )
    return
  }

  if (running) {
    host.append(el('p', { class: 'empty', textContent: 'GViz 요청 중…' }))
    return
  }

  if (!lastRun) {
    host.append(
      el('p', { class: 'empty', textContent: 'execute()를 눌러 실제 시트를 조회합니다.' }),
    )
    return
  }

  const columns = lastRun.rows[0] ? Object.keys(lastRun.rows[0]).length : 0

  host.append(
    el('div', { class: 'result-meta' }, [
      el('span', { class: 'badge ok', textContent: `${lastRun.rows.length}행` }),
      el('span', { textContent: `${columns}컬럼` }),
      el('span', { textContent: `${lastRun.ms}ms` }),
      ...(state.useSchema ? [el('span', { class: 'badge', textContent: 'schema 통과' })] : []),
      ...(state.verifyHeaders
        ? [el('span', { class: 'badge', textContent: '헤더 검증 통과' })]
        : []),
    ]),
    resultsTable(lastRun.rows),
  )
}

/* ------------------------------------------------------------------ shell */

/** Rebuilds every panel and both output areas from the current state. */
function render(): void {
  const builder = document.getElementById('builder')

  if (builder) {
    builder.replaceChildren(
      presetPanel(),
      tabPanel(),
      selectPanel(),
      wherePanel(),
      shapePanel(),
      optionsPanel(),
    )
  }

  renderQueryCard()
  renderOutput()
}

document.getElementById('sheet-link')?.setAttribute('href', SPREADSHEET_URL)
document.getElementById('run')?.addEventListener('click', () => void run())

render()
