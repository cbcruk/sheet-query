/**
 * Metadata for the demo spreadsheet, plus the presets that mirror the scenarios
 * in `examples/discoveries.ts`.
 *
 * Column types come from the GViz response itself (`headers=1` is what makes the
 * labels resolve — without it GViz guesses, and on the 도서 tab it guesses wrong).
 */

/** A single column of a tab, as GViz reports it. */
export interface ColumnMeta {
  /** GViz column id — the letter used in query expressions. */
  id: string
  /** Header label, which is also the object key rows come back with. */
  label: string
  /** How GViz types the column, which decides how a filter value is serialized. */
  type: 'string' | 'number'
}

/** One tab (sheet) of the demo spreadsheet. */
export interface TabMeta {
  /** Tab name, passed as the `sheet` option. */
  name: string
  /** Tab `gid`, shown in the UI so the sheet can be opened at that tab. */
  gid: string
  /** One-line summary shown on the tab button. */
  description: string
  /** Columns in sheet order. */
  columns: ColumnMeta[]
}

/** The public, read-only spreadsheet this playground queries. */
export const SPREADSHEET_ID = '1-SIyn5k0n19cIdfbMWhpBaQkPukBEl7Dit0xbOBxUII'

/** Human-facing link to the same sheet, so the data can be checked by eye. */
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`

/**
 * The three tabs, transcribed from the sheet rather than fetched, so the UI can
 * render its column pickers before the first request.
 */
export const TABS: TabMeta[] = [
  {
    name: '발견물',
    gid: '0',
    description: '206행 · 지역별 발견물과 좌표',
    columns: [
      { id: 'A', label: '지역', type: 'string' },
      { id: 'B', label: '발견물', type: 'string' },
      { id: 'C', label: '도서관 힌트', type: 'string' },
      { id: 'D', label: '도시', type: 'string' },
      { id: 'E', label: '위도', type: 'number' },
      { id: 'F', label: '경도', type: 'number' },
      { id: 'G', label: '증거품', type: 'string' },
      { id: 'H', label: '조건 및 기타', type: 'string' },
    ],
  },
  {
    name: '도시',
    gid: '356194609',
    description: '항구 도시의 좌표·특산물·시설',
    columns: [
      { id: 'A', label: '지역', type: 'string' },
      { id: 'B', label: '도시명', type: 'string' },
      { id: 'C', label: '위도', type: 'number' },
      { id: 'D', label: '경도', type: 'number' },
      { id: 'E', label: '특산물', type: 'string' },
      { id: 'F', label: '시장에서 판매되는 아이템', type: 'string' },
      { id: 'G', label: '도서관', type: 'string' },
      { id: 'H', label: '교회 또는 조합', type: 'string' },
    ],
  },
  {
    name: '도서',
    gid: '2021791036',
    description: '도서관 장서와 게재 힌트',
    columns: [
      { id: 'A', label: '도서명', type: 'string' },
      { id: 'B', label: '언어', type: 'string' },
      { id: 'C', label: '소재 도서관', type: 'string' },
      { id: 'D', label: '게제 힌트', type: 'string' },
      { id: 'E', label: '필요', type: 'string' },
      { id: 'F', label: '개제조건', type: 'string' },
    ],
  },
]

/** Looks up a tab by name; throws rather than silently falling back. */
export function tabByName(name: string): TabMeta {
  const tab = TABS.find((candidate) => candidate.name === name)

  if (!tab) {
    throw new Error(`Unknown tab: ${name}`)
  }

  return tab
}

/** Looks up a column within a tab, or `undefined` when the id is unknown. */
export function columnById(tab: TabMeta, id: string): ColumnMeta | undefined {
  return tab.columns.find((column) => column.id === id)
}
