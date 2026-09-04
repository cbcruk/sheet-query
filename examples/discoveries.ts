/**
 * Read walkthrough against a real, public, human-maintained Google Sheet.
 *
 * The sheet is a fan-made reference for the game *Uncharted Waters II*
 * (대항해시대 3) with three tabs — 발견물 (discoveries), 도시 (cities), 도서
 * (books) — so it exercises what `verify-read.ts` cannot: Korean headers and
 * values, multiple tabs, ragged trailing columns, and blank cells.
 *
 *   https://docs.google.com/spreadsheets/d/1-SIyn5k0n19cIdfbMWhpBaQkPukBEl7Dit0xbOBxUII
 *
 * Usage:
 *   node examples/discoveries.ts
 *   SHEET_ID=<other-id> node examples/discoveries.ts   # same layout, your copy
 *
 * Read-only: the sheet has no `id` column and is public, so writes are out of
 * scope here — see the README for `appendRow` / `updateRowById`.
 */
import { and, eq, gt, isNotNull, like, sheetQuery } from 'sheet-query'
import type { StandardSchemaV1 } from 'sheet-query'

const SPREADSHEET_ID = process.env.SHEET_ID ?? '1-SIyn5k0n19cIdfbMWhpBaQkPukBEl7Dit0xbOBxUII'

/** Column letters of the 발견물 tab: 지역, 발견물, 도서관 힌트, 도시, 위도, 경도, 증거품, 조건. */
const DISCOVERY_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const DISCOVERY_HEADERS = [
  '지역',
  '발견물',
  '도서관 힌트',
  '도시',
  '위도',
  '경도',
  '증거품',
  '조건 및 기타',
]

function section(title: string): void {
  console.log(`\n${'─'.repeat(64)}\n${title}\n`)
}

function show(rows: unknown[]): void {
  console.table(rows)
}

/** Unwraps the `cause` chain so nested validation issues stay visible. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }
  return error.cause ? `${error.message} (${describeError(error.cause)})` : error.message
}

// 1. Filter + sort + limit on one tab. Korean string literals are quoted and
//    escaped by `eq`, so no manual query-string assembly.
section('1. 신대륙의 발견물 (WHERE + ORDER BY + LIMIT)')

const newWorld = sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
  .select(...DISCOVERY_COLUMNS)
  .where(eq('A', '신대륙'))
  .orderBy('B', 'asc')
  .limit(8)

console.log('Query:', newWorld.toQuery())
show(await newWorld.execute())

// 2. Aggregation runs server-side — GViz counts the 206 rows, we receive 10.
section('2. 지역별 발견물 수 (GROUP BY)')

const byRegion = sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
  .select('A', 'count(B)')
  .groupBy('A')
  .orderBy('count(B)', 'desc')

console.log('Query:', byRegion.toQuery())
show(await byRegion.execute())

// 3. Numeric comparison on 위도 combined with a NOT NULL check. GViz returns
//    these as real numbers, not strings, and empty cells as null.
section('3. 북위 55도 이상, 증거품이 있는 발견물 (AND + 숫자 비교 + IS NOT NULL)')

const farNorth = sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
  .select('B', 'D', 'E', 'F', 'G')
  .where(and(gt('E', 55), isNotNull('G')))
  .orderBy('E', 'desc')

console.log('Query:', farNorth.toQuery())
show(await farNorth.execute())

// 4. LIKE with GViz wildcards.
section('4. 이름에 "성당"이 들어가는 발견물 (LIKE)')

show(
  await sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
    .select('A', 'B', 'D')
    .where(like('B', '%성당%'))
    .limit(10)
    .execute(),
)

// 5. A different tab, targeted by name. Same builder, different shape.
section('5. 도서관이 있는 이베리아 도시 (다른 탭)')

show(
  await sheetQuery(SPREADSHEET_ID, { sheet: '도시' })
    .select('B', 'C', 'D', 'E')
    .where(and(eq('A', '이베리아'), eq('G', '有')))
    .execute(),
)

// 6. Two tabs, joined in JS. The core returns plain objects, so cross-tab work
//    needs no special API — 도서's 게제 힌트 points at a 발견물 name.
section('6. 도서 힌트 → 발견물 위치 (탭 간 조인)')

interface Discovery {
  발견물: string
  도시: string | null
  위도: number | null
  경도: number | null
}

const [books, discoveries] = await Promise.all([
  sheetQuery(SPREADSHEET_ID, { sheet: '도서' }).select('A', 'B', 'C', 'D').limit(8).execute(),
  sheetQuery(SPREADSHEET_ID, { sheet: '발견물' }).select('B', 'D', 'E', 'F').execute<Discovery>(),
])

const byName = new Map(discoveries.map((row) => [row.발견물, row]))

show(
  books.map((book) => {
    const target = byName.get(String(book['게제 힌트'] ?? ''))

    return {
      도서명: book.도서명,
      소재_도서관: String(book['소재 도서관'] ?? '').replace(/\n/g, ' '),
      힌트_발견물: book['게제 힌트'],
      발견_도시: target ? (target.도시 ?? '(도시 밖)') : '(발견물 미등록)',
      좌표: target ? `${target.위도}, ${target.경도}` : '-',
    }
  }),
)

// 7. Header drift. Someone renaming or reordering a column on a shared sheet is
//    the normal failure mode here, and it breaks mapping silently — so assert.
section('7. 헤더 검증 (verifyHeaders)')

await sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
  .select(...DISCOVERY_COLUMNS)
  .limit(1)
  .execute({ verifyHeaders: DISCOVERY_HEADERS })

console.log('OK: 헤더가 기대와 일치합니다 —', DISCOVERY_HEADERS.join(' | '))

try {
  await sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
    .select(...DISCOVERY_COLUMNS)
    .limit(1)
    .execute({
      verifyHeaders: [...DISCOVERY_HEADERS.slice(0, 2), '힌트', ...DISCOVERY_HEADERS.slice(3)],
    })
} catch (error) {
  console.log('기대한 실패:', describeError(error))
}

// 8. Standard Schema validation. Any compliant library (Zod, Valibot, ArkType)
//    plugs in here; this hand-rolled schema keeps the example dependency-free
//    and shows the interface `execute({ schema })` actually consumes.
section('8. Standard Schema 검증 (의존성 없이)')

interface Coordinate {
  발견물: string
  위도: number
  경도: number
}

const coordinateSchema: StandardSchemaV1<unknown, Coordinate> = {
  '~standard': {
    version: 1,
    vendor: 'example',
    validate(value) {
      const row = value as Record<string, unknown>
      const issues: { message: string; path: [string] }[] = []

      if (typeof row.발견물 !== 'string' || row.발견물.length === 0) {
        issues.push({ message: '발견물 이름이 비어 있습니다.', path: ['발견물'] })
      }
      for (const key of ['위도', '경도'] as const) {
        if (typeof row[key] !== 'number') {
          issues.push({ message: `숫자가 아닙니다: ${String(row[key])}`, path: [key] })
        }
      }

      return issues.length > 0 ? { issues } : { value: row as unknown as Coordinate }
    },
  },
}

// `execute({ schema })` narrows the return type to the schema's output.
const coordinates = await sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
  .select('B', 'E', 'F')
  .where(eq('A', '인도'))
  .execute({ schema: coordinateSchema })

console.log(`검증 통과: ${coordinates.length}행`)
show(coordinates)

try {
  // select와 schema가 어긋난 경우 — 경도(F) 대신 증거품(G)을 골랐으므로
  // 행에 `경도` 키 자체가 없고, 검증이 이를 잡아냅니다.
  await sheetQuery(SPREADSHEET_ID, { sheet: '발견물' })
    .select('B', 'E', 'G')
    .limit(1)
    .execute({ schema: coordinateSchema })
} catch (error) {
  console.log('기대한 실패:', describeError(error))
}
