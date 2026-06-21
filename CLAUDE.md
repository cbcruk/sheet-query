# CLAUDE.md

이 문서는 Claude Code가 이 프로젝트의 맥락을 이해하기 위한 컨텍스트입니다.

## 프로젝트 개요

Google Sheets를 코드에서 데이터 저장소처럼 다룰 수 있게 하는 라이브러리를 만듭니다. SQL-like 쿼리로 읽고, 타입 안전하게 쓰고, schema로 검증합니다.

**최종 목표**는 이 코어 위에 TanStack DB collection adapter를 얹는 것이지만, **그건 가장 마지막 레이어**입니다. 코어(읽기·쓰기·identity)가 그 자체로 독립적인 product로 성립해야 합니다.

**핵심 원칙**: read/write/identity 코어가 product다. TanStack DB 어댑터는 하나의 integration일 뿐이다. 기반이 단단하지 않으면 어떤 어댑터를 얹어도 무너진다.

## 레이어 구조

```
Layer 0: sheetQuery (GViz read builder)     ← 여기부터 시작
Layer 1: 서버 proxy (Sheets API write)
Layer 2: row identity 매핑 (id ↔ row index)
─────────────────────────────────────────
Layer 3: TanStack DB collection adapter     ← 최대한 뒤로 (보류)
```

Layer 0~2는 TanStack DB와 무관하게 독립적으로 가치가 있습니다. 그 자체로 "Google Sheets를 DB처럼 쓰는 라이브러리"로 성립합니다.

## 로드맵 (Phase 1 → 2 → 3)

### Phase 1: 코어 구축 (현재 단계)

TanStack DB 없이 read/write/identity 전체 흐름을 검증.

- 자체 GViz Query Builder (`sheetQuery`) 작성 — 읽기
- 서버 proxy 엔드포인트 — 쓰기 (Sheets API v4)
- row identity (id ↔ row index) 매핑 로직
- 작은 시트 하나로 read/write/sync 전체 흐름 검증

이 단계가 끝나면 TanStack DB 없이도 동작하는 도구가 됩니다.

### Phase 2: 코어를 독립 라이브러리로 다듬기

Phase 1 코드를 정리하여 재사용 가능한 형태로:

- Standard Schema (Zod 등) 지원, 헤더 ↔ 객체 변환
- 인증 전략 추상화 (OAuth / server-proxy / public)
- quota 관리, request batching
- 헤더 행 변경 감지

이 시점에 코어 라이브러리로 publish 가능.

### Phase 3 (보류): TanStack DB 어댑터

코어가 안정된 후에만 착수. TanStack DB API가 BETA라 시그니처 변동 리스크가 있으므로 의존을 최대한 늦게 가져간다.

- `gsheetCollectionOptions(...)` API로 캡슐화
- `queryCollectionOptions` 위에 얹어 PoC → 전용 sync adapter로 발전
- 이름 후보: `@gsheet/tanstack-db`, `tanstack-db-gsheet`, `sheet-db`

**Phase 3는 코어가 완성되기 전까지 구현하지 않는다.** 관련 코드, 의존성 추가, 설계 모두 보류.

## 기술 스택

### 코어 (Phase 1~2)

- **GViz Query API**: 읽기 (`https://docs.google.com/spreadsheets/d/{ID}/gviz/tq`)
- **Google Sheets API v4**: 쓰기 (append/update/batchUpdate)
- **TypeScript**: 전체 타입 안전성, Standard Schema 지원
- **인증**: Service Account (서버) 또는 OAuth (브라우저)

### 어댑터 (Phase 3, 보류)

- TanStack DB, TanStack Query

## 아키텍처

```
브라우저
  ├── 읽기: GViz Query API 직접 호출 (인증 토큰 필요)
  └── 쓰기: 서버 proxy 경유
       ↓
    백엔드 서버
    ├── Service Account 키 보관
    └── Google Sheets API v4 호출
```

이유: 불특정 다수가 동시 편집 가능한 시나리오에서 Service Account 키를 브라우저에 노출할 수 없음. 읽기는 OAuth 토큰으로 직접 가능하지만 쓰기는 권한 분리를 위해 서버 경유.

## 핵심 설계 결정

### 1. 읽기와 쓰기의 분리

- 읽기는 GViz (SQL-like, 빠르고 가벼움)
- 쓰기는 Sheets API (공식, 모든 작업 가능)
- GViz는 read-only이므로 분리가 강제됨

### 2. Row Identity (Phase 1의 핵심)

- 시트 안에 반드시 unique한 `id` 컬럼 필요
- row index는 행 삽입/삭제로 변동되므로 신뢰 불가
- 쓰기 시점에 `id`로 검색 → row index 찾기 → 해당 row update
- 이 로직은 PoC 첫 단계부터 코드에 들어가야 함

### 3. 인증 전략 추상화 (Phase 2)

```typescript
type AuthStrategy =
  | { type: 'oauth'; getToken: () => Promise<string> }
  | { type: 'server-proxy'; endpoint: string }
  | { type: 'public' } // 읽기 전용 시트
```

### 4. Standard Schema 지원 (Phase 2)

Zod 같은 schema 라이브러리로 런타임 검증. 헤더 행과 schema 불일치 시 경고.

## 설계 함정 (반드시 처리해야 할 엣지케이스)

| 함정                                | 대응                                   | 단계    |
| ----------------------------------- | -------------------------------------- | ------- |
| Row index가 mutable                 | `id` 컬럼 필수, lookup 후 작업         | Phase 1 |
| GViz JSONP 응답 파싱                | 정규식으로 wrapper 제거 후 JSON.parse  | Phase 1 |
| GViz의 Col1, Col2 vs 헤더 레이블    | 헤더가 있으면 label 우선, 없으면 Col_n | Phase 1 |
| Sheets API quota (60 req/분)        | request batching, polling 주기 조절    | Phase 2 |
| 헤더 행 변경 시 매핑 깨짐           | 주기적 헤더 검증, schema 불일치 경고   | Phase 2 |
| IMPORTRANGE 사용 시 컬럼 명명 규칙  | 사용자에게 명시적으로 문서화           | Phase 2 |
| Concurrent writes (last-write-wins) | v1은 허용, 이후 ETag/version 컬럼      | 이후    |

## GViz Query 문법 참고

```sql
-- 기본
SELECT * WHERE C = '서울'
SELECT A, B, C WHERE D > 100 AND E = true
ORDER BY B DESC
LIMIT 10 OFFSET 5

-- 집계
SELECT A, SUM(B) GROUP BY A
SELECT COUNT(A)

-- 주의: 컬럼은 알파벳 레이블 (A, B, C...)
-- IMPORTRANGE로 감쌀 때는 Col1, Col2, Col3...
```

## 구현 우선순위 (Phase 1)

1. `sheetQuery` builder 구현 (`SELECT`, `WHERE`, `ORDER BY`, `LIMIT`)
2. JSONP 응답 파싱 + 타입 변환
3. 서버 proxy 엔드포인트 (`/api/sheet/append`, `/api/sheet/update`, `/api/sheet/delete`)
4. row identity 처리 (id → row index lookup)
5. read → write → 재조회로 전체 흐름 end-to-end 검증

**이 단계에서는 TanStack DB를 import하지 않는다.**

## 결정 보류 항목 (TBD)

### 시트

- [ ] 어떤 시트로 PoC 시작? (테스트용 신규 시트 vs 실제 시트)
- [ ] 컬럼 구조와 `id` 컬럼 위치

### 인증

- [x] **Service Account 채택** — 키는 서버(Worker)에만 보관, 브라우저 노출 없음
- [ ] (OAuth는 채택 안 함) token refresh 전략 불필요

### 서버 환경

- [x] **Cloudflare Workers 채택** — Service Account JWT 서명은 Web Crypto(`crypto.subtle`)로 처리
- [ ] 배포 세부 (라우팅, 환경변수로 SA 키 주입)

## 코딩 컨벤션

- TypeScript strict mode
- 함수형 우선, 클래스는 builder처럼 chaining이 필요한 경우만
- 의존성 최소화 (가능하면 zero-dependency, 특히 코어 레이어)
- 타입 정의는 export하여 사용자가 추론 가능하도록
- 에러는 명시적으로 throw, swallow 금지
- 모든 public API에 JSDoc

## 참고 자료

### 코어

- Google Visualization Query Language: https://developers.google.com/chart/interactive/docs/querylanguage
- Sheets API v4: https://developers.google.com/sheets/api

### 어댑터 (Phase 3, 보류)

- TanStack DB: https://tanstack.com/db
- Collection Options Creator: https://tanstack.com/db/latest/docs/guides/collection-options-creator
- Query Collection: https://tanstack.com/db/latest/docs/collections/query-collection

## 선행 작업 메모

이 프로젝트는 다음 대화의 연장선에서 시작됩니다:

1. GViz로 Google Sheets에 SQL-like 쿼리 가능함을 확인
2. `=QUERY()` + `IMPORTRANGE` 조합 시 컬럼이 `Col1, Col2`로 바뀌는 함정 확인
3. 브라우저에서 GViz 직접 호출은 가능하나, 쓰기는 서버 proxy가 현실적
4. 기존 라이브러리(`sheetquery`, `gsheety`, `gsheetquery`) 조사 → 빈 자리 확인
   - `sheetquery`는 Apps Script 전용
   - `gsheety`는 public 시트 전용 단순 fetch
   - Drizzle-style 체이닝 + 브라우저/Node + OAuth + 쓰기 지원 조합은 비어있음
5. Drizzle은 SQL 드라이버 위에서 동작하므로 GViz에 직접 적용 불가
6. TanStack DB collection adapter가 최종 목표이나, 코어를 먼저 단단히 만든 뒤
   가장 마지막 레이어로 얹기로 결정 (BETA API 의존 리스크 최소화)
