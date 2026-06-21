import { expect, test } from 'vite-plus/test'

import { appendRow } from './mutations.ts'
import { fetchHeaderRow, verifyTableHeaders } from './table-headers.ts'
import type { SheetsApiContext, SheetTable } from './sheet-write.types.ts'

const TABLE: SheetTable = {
  sheet: 'people',
  columns: ['id', 'name', 'age', 'city', 'active', 'joined'],
  idColumn: 'id',
  sheetId: 0,
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 })
}

interface MockOptions {
  header: string[]
}

function createMock(options: MockOptions): {
  ctx: SheetsApiContext
  calls: { url: string; method: string }[]
} {
  const calls: { url: string; method: string }[] = []

  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    const u = String(url)
    const method = init.method ?? 'GET'
    calls.push({ url: u, method })
    const decoded = decodeURIComponent(u)

    if (method === 'GET' && (decoded.split('?')[0] ?? '').endsWith('!A1:F1')) {
      return jsonResponse({ values: [options.header] })
    }
    if (method === 'GET' && decoded.includes('!A:A')) {
      return jsonResponse({ values: [['id'], ['1'], ['2']] })
    }
    return jsonResponse({})
  }) as unknown as typeof fetch

  return {
    ctx: {
      spreadsheetId: 'sid',
      accessToken: 'tok',
      fetch: fetchImpl,
      baseUrl: 'https://api.test',
    },
    calls,
  }
}

test('fetchHeaderRow returns the sheet header names', async () => {
  const { ctx } = createMock({ header: TABLE.columns })
  expect(await fetchHeaderRow(ctx, TABLE)).toEqual(TABLE.columns)
})

test('verifyTableHeaders passes when headers match', async () => {
  const { ctx } = createMock({ header: TABLE.columns })
  await expect(verifyTableHeaders(ctx, TABLE)).resolves.toBeUndefined()
})

test('verifyTableHeaders throws on drift', async () => {
  const { ctx } = createMock({ header: ['id', 'fullname', 'age', 'city', 'active', 'joined'] })
  await expect(verifyTableHeaders(ctx, TABLE)).rejects.toThrow(/Header drift detected/)
})

test('mutations with verifyHeaders abort before writing on drift', async () => {
  const { ctx, calls } = createMock({
    header: ['id', 'fullname', 'age', 'city', 'active', 'joined'],
  })
  const table: SheetTable = { ...TABLE, verifyHeaders: true }

  await expect(appendRow(ctx, table, { id: 3, name: 'C' })).rejects.toThrow(/Header drift/)
  expect(calls.some((c) => c.url.includes(':append'))).toBe(false)
})

test('mutations with verifyHeaders proceed when headers match', async () => {
  const { ctx, calls } = createMock({ header: TABLE.columns })
  const table: SheetTable = { ...TABLE, verifyHeaders: true }

  await appendRow(ctx, table, { id: 3, name: 'C' })
  expect(calls.some((c) => c.url.includes(':append'))).toBe(true)
})
