import { expect, test } from 'vite-plus/test'

import { appendRow, deleteRowById, updateRowById } from './mutations.ts'
import { findRowNumberById } from './row-identity.ts'
import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { SheetsApiContext, SheetTable } from './sheet-write.types.ts'

const TABLE: SheetTable = {
  sheet: 'people',
  columns: ['id', 'name', 'age', 'city', 'active', 'joined'],
  idColumn: 'id',
  sheetId: 0,
}

interface MockCall {
  url: string
  method: string
  body: unknown
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 })
}

function createMock(): { ctx: SheetsApiContext; calls: MockCall[] } {
  const calls: MockCall[] = []

  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    const u = String(url)
    const method = init.method ?? 'GET'
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url: u, method, body })

    const decoded = decodeURIComponent(u)

    if (method === 'GET' && decoded.includes('!A:A')) {
      return jsonResponse({ values: [['id'], ['1'], ['2'], ['3']] })
    }
    if (method === 'GET' && /!A\d+:F\d+/.test(decoded)) {
      return jsonResponse({
        values: [['2', '이서연', '34', '부산', 'FALSE', '2022-11-05']],
      })
    }
    if (method === 'GET' && decoded.includes('fields=sheets.properties')) {
      return jsonResponse({ sheets: [{ properties: { sheetId: 123, title: 'people' } }] })
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

test('findRowNumberById returns the 1-based row number', async () => {
  const { ctx } = createMock()
  expect(await findRowNumberById(ctx, TABLE, 2)).toBe(3)
  expect(await findRowNumberById(ctx, TABLE, '1')).toBe(2)
})

test('findRowNumberById returns null when no row matches', async () => {
  const { ctx } = createMock()
  expect(await findRowNumberById(ctx, TABLE, 999)).toBeNull()
})

test('appendRow posts a serialized row to the append endpoint', async () => {
  const { ctx, calls } = createMock()

  await appendRow(ctx, TABLE, {
    id: 9,
    name: 'Xavier',
    age: 20,
    city: '서울',
    active: true,
    joined: new Date(2024, 0, 15),
  })

  const append = calls.find((c) => c.url.includes(':append'))
  expect(append?.method).toBe('POST')
  expect(append?.body).toEqual({
    values: [[9, 'Xavier', 20, '서울', true, '2024-01-15']],
  })
})

test('appendRow throws without an id', async () => {
  const { ctx } = createMock()
  await expect(appendRow(ctx, TABLE, { name: 'NoId' })).rejects.toThrow(SheetQueryError)
})

test('updateRowById merges the patch over existing values', async () => {
  const { ctx, calls } = createMock()

  await updateRowById(ctx, TABLE, 2, { age: 35, city: '서울' })

  const update = calls.find((c) => c.method === 'PUT')
  expect(decodeURIComponent(update?.url ?? '')).toContain("'people'!A3:F3")
  expect(update?.body).toEqual({
    values: [['2', '이서연', 35, '서울', 'FALSE', '2022-11-05']],
  })
})

test('updateRowById throws when the id is missing', async () => {
  const { ctx } = createMock()
  await expect(updateRowById(ctx, TABLE, 999, { age: 1 })).rejects.toThrow(SheetQueryError)
})

test('deleteRowById issues a deleteDimension for the row', async () => {
  const { ctx, calls } = createMock()

  await deleteRowById(ctx, TABLE, 2)

  const batch = calls.find((c) => c.url.includes(':batchUpdate'))
  expect(batch?.method).toBe('POST')
  expect(batch?.body).toEqual({
    requests: [
      {
        deleteDimension: {
          range: { sheetId: 0, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
        },
      },
    ],
  })
})

test('deleteRowById resolves the sheetId when not provided', async () => {
  const { ctx, calls } = createMock()
  const { sheetId, ...tableWithoutGid } = TABLE
  void sheetId

  await deleteRowById(ctx, tableWithoutGid, 2)

  expect(calls.some((c) => c.url.includes('fields=sheets.properties'))).toBe(true)
  const batch = calls.find((c) => c.url.includes(':batchUpdate'))
  expect(batch?.body).toEqual({
    requests: [
      {
        deleteDimension: {
          range: { sheetId: 123, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
        },
      },
    ],
  })
})
