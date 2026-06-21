# sheet-query

Google Sheets를 코드에서 데이터 저장소처럼 다루는 라이브러리. SQL-like 쿼리로 읽고, 타입 안전하게 쓰고, schema로 검증합니다.

> 현재 **Phase 1 / Layer 0** 구현됨: GViz 기반 읽기 쿼리 빌더 (`sheetQuery`). 쓰기(server proxy)·row identity는 다음 단계입니다. 자세한 로드맵은 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 설치 & 개발

[Vite+](https://viteplus.dev) 통합 툴체인(`vp`)을 사용합니다 — 테스트(vitest), 번들(rolldown/tsdown), lint·format(oxlint/oxfmt).

```bash
pnpm install
pnpm test         # vp test (vitest)
pnpm check        # vp check (format + lint + typecheck)
pnpm build        # vp pack (dist/index.mjs + .d.mts)
pnpm dev          # vp pack --watch
```

## 사용법 (Layer 0: 읽기)

```ts
import { sheetQuery, eq, and, gt } from 'sheet-query'

const rows = await sheetQuery(spreadsheetId, { sheet: 'people' })
  .select('A', 'B', 'C')
  .where(and(eq('C', '서울'), gt('D', 100)))
  .orderBy('B', 'desc')
  .limit(10)
  .execute()
```

쿼리를 실행하지 않고 문자열/URL만 얻을 수도 있습니다:

```ts
const q = sheetQuery(spreadsheetId).select('A').where(eq('B', true))
q.toQuery() // "SELECT A WHERE B = true"
q.toUrl() // 전체 GViz 요청 URL
```

### 조건 헬퍼

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `isNull`, `isNotNull`, `and`, `or`.
값은 GViz 리터럴로 자동 직렬화됩니다(문자열 따옴표 escape, `Date` → `datetime '...'`).

### 인증

- **public 시트**: 옵션 없이 `execute()`.
- **OAuth 보호 시트**: `execute({ accessToken })`로 Bearer 토큰 전달.

## 쓰기 (Layer 1/2: Sheets API)

쓰기는 access token만 받는 transport·auth 독립적인 코어입니다. `id` 컬럼으로 row를 찾아 작업합니다 (row index는 mutable하므로 매번 조회).

```ts
import { appendRow, updateRowById, deleteRowById } from 'sheet-query'

const ctx = { spreadsheetId, accessToken } // SA/OAuth 어디서 왔든 무관
const table = { sheet: 'people', columns: ['id', 'name', 'age', 'city', 'active', 'joined'] }

await appendRow(ctx, table, { id: 9, name: 'Xavier', age: 20 })
await updateRowById(ctx, table, 9, { age: 21 }) // 기존 행과 merge (last-write-wins)
await deleteRowById(ctx, table, 9)
```

## 스키마 검증 (Standard Schema)

[Standard Schema](https://standardschema.dev) 호환 라이브러리(Zod 3.24+, Valibot, ArkType...)를 그대로 사용합니다. 코어는 인터페이스만 인라인해 **런타임 의존성이 없습니다**.

```ts
import { z } from 'zod'

const personSchema = z.object({ id: z.number(), name: z.string(), age: z.number() })

// 읽기: 검증된 타입으로 반환 (실패 시 throw)
const people = await sheetQuery(spreadsheetId, { sheet: 'people' }).execute({
  schema: personSchema,
})

// 쓰기: table.schema 지정 시 append/update 전에 검증
const table = { sheet: 'people', columns: ['id', 'name', 'age'], schema: personSchema }
await appendRow(ctx, table, { id: 9, name: 'X', age: 20 })
```

## 핵심 동작

- **JSONP 언랩**: GViz의 `setResponse(...)` wrapper를 제거 후 JSON 파싱.
- **헤더 우선 매핑**: 헤더 label이 있으면 키로 사용, 없으면 컬럼 id(`A`, `B`...) fallback.
- **타입 변환**: `date`/`datetime` → JS `Date`, `number`/`boolean` 네이티브 변환.

## 구조

```
src/
  index.ts                       # public exports
  sheet-query/
    sheet-query.ts               # SheetQuery 빌더 + sheetQuery 팩토리
    sheet-query.types.ts
    sheet-query.utils.ts         # tq 쿼리 / URL 빌드
    sheet-query.error.ts
    conditions.ts                # WHERE 조건 + 값 직렬화
    gviz.ts                      # JSONP 파싱 + table → objects
    gviz.types.ts
```
