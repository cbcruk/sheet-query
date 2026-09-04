# sheet-query

Google Sheets를 코드에서 데이터 저장소처럼 다루는 라이브러리. SQL-like 쿼리로 읽고, 타입 안전하게 쓰고, schema로 검증합니다.

> 현재 **Phase 1 / Layer 0** 구현됨: GViz 기반 읽기 쿼리 빌더 (`sheetQuery`). 쓰기(server proxy)·row identity는 다음 단계입니다. 자세한 로드맵은 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 설치 & 개발

pnpm workspace 모노레포입니다. publish되는 패키지는 `packages/core`(= `sheet-query`) 하나뿐이고,
루트는 워크스페이스 오케스트레이션과 공용 lint·format 설정만 담당합니다.

[Vite+](https://viteplus.dev) 통합 툴체인(`vp`)을 사용합니다 — 테스트(vitest), 번들(rolldown/tsdown), lint·format(oxlint/oxfmt).

```bash
pnpm install
pnpm test         # 워크스페이스 전체 테스트 (vitest)
pnpm check        # 워크스페이스 전체 format + lint + typecheck
pnpm build        # vp run -r build (패키지별 pack)
pnpm dev          # packages/core watch 빌드
```

`packages/core`의 `exports`는 `src/index.ts`를 가리키므로 워크스페이스 안에서는 **빌드 없이 소스가 바로 해석**됩니다.
publish 시점에는 `publishConfig.exports`가 `dist/index.mjs`로 교체되고 `files: ["dist"]`로 소스는 제외됩니다.

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

## 헤더 변경 감지

시트 헤더가 바뀌면 매핑이 조용히 깨집니다 (특히 쓰기는 컬럼 position 기반). 기대 헤더와 실제 헤더를 비교해 drift를 잡습니다.

```ts
// 읽기: GViz 응답의 컬럼 라벨 검증
await sheetQuery(spreadsheetId, { sheet: 'people' }).execute({
  verifyHeaders: ['id', 'name', 'age'],
})

// 쓰기: table.verifyHeaders로 mutation 전 헤더 행 검증 (drift 시 throw, 쓰기 전 중단)
const table = { sheet: 'people', columns: ['id', 'name', 'age'], verifyHeaders: true }
await appendRow(ctx, table, { id: 9, name: 'X', age: 20 })

// 수동/주기적 검증
import { verifyTableHeaders, compareHeaders } from 'sheet-query'
await verifyTableHeaders(ctx, table)
```

## 핵심 동작

- **JSONP 언랩**: GViz의 `setResponse(...)` wrapper를 제거 후 JSON 파싱.
- **헤더 우선 매핑**: 헤더 label이 있으면 키로 사용, 없으면 컬럼 id(`A`, `B`...) fallback.
- **타입 변환**: `date`/`datetime` → JS `Date`, `number`/`boolean` 네이티브 변환.

## 구조

```
packages/
  core/                            # publish 대상 — npm: sheet-query
    src/
      index.ts                     # public exports
      sheet-query/                 # Layer 0: GViz 읽기
        sheet-query.ts             # SheetQuery 빌더 + sheetQuery 팩토리
        sheet-query.utils.ts       # tq 쿼리 / URL 빌드
        conditions.ts              # WHERE 조건 + 값 직렬화
        gviz.ts                    # JSONP 파싱 + table → objects
      sheet-write/                 # Layer 1/2: Sheets API 쓰기 + row identity
        mutations.ts               # append / update / delete
        row-identity.ts            # id → row index lookup
        sheets-client.ts           # Sheets API v4 호출
        a1.ts                      # A1 표기법
      schema/                      # Standard Schema 검증
      headers/                     # 헤더 drift 비교

examples/                          # private — workspace:* 로 core 소비
  verify-read.ts
```

향후 패키지(모두 코어에 의존, 역방향 없음):

| 패키지                 | 이름                       | 상태                                                 |
| ---------------------- | -------------------------- | ---------------------------------------------------- |
| `packages/core`        | `sheet-query`              | 현재 유일한 publish 대상                             |
| `packages/worker`      | `@sheet-query/worker`      | Cloudflare Workers Service Account proxy — 다음 단계 |
| `packages/tanstack-db` | `@sheet-query/tanstack-db` | Phase 3, 코어 안정화 전까지 **보류**                 |

패키지를 나눈 이유는 의존성 경계를 컨벤션이 아니라 구조로 강제하기 위해서입니다.
Workers proxy는 wrangler를, 어댑터는 BETA인 TanStack DB를 끌고 오는데,
그 어느 것도 zero-dependency여야 하는 코어의 의존성 트리에 들어와선 안 됩니다.
