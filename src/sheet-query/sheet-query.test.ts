import { expect, test } from 'vite-plus/test'

import { and, eq, gt } from './conditions.ts'
import { sheetQuery } from './sheet-query.ts'
import { SheetQueryError } from './sheet-query.error.ts'
import type { StandardSchemaResult, StandardSchemaV1 } from '../schema/standard-schema.types.ts'

function mockFetchFor(payload: unknown): typeof fetch {
  const body = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(payload)});`
  return (async () => new Response(body, { status: 200 })) as unknown as typeof fetch
}

interface Person {
  id: number
  name: string
}

const personSchema: StandardSchemaV1<unknown, Person> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value): StandardSchemaResult<Person> => {
      const record = value as Record<string, unknown>
      if (typeof record.id !== 'number' || typeof record.name !== 'string') {
        return { issues: [{ message: 'invalid person', path: ['name'] }] }
      }
      return { value: { id: record.id, name: record.name } }
    },
  },
}

const PEOPLE_PAYLOAD = {
  version: '0.6',
  reqId: '0',
  status: 'ok',
  table: {
    cols: [
      { id: 'A', label: 'id', type: 'number' },
      { id: 'B', label: 'name', type: 'string' },
    ],
    rows: [{ c: [{ v: 1 }, { v: 'Ann' }] }, { c: [{ v: 2 }, { v: 'Bob' }] }],
  },
}

test('builds SELECT * by default', () => {
  expect(sheetQuery('sid').toQuery()).toBe('SELECT *')
})

test('builds a full query with clauses in GViz order', () => {
  const query = sheetQuery('sid')
    .select('A', 'B', 'C')
    .where(gt('D', 100))
    .where(eq('E', true))
    .orderBy('B', 'desc')
    .limit(10)
    .offset(5)
    .toQuery()

  expect(query).toBe(
    'SELECT A, B, C WHERE (D > 100) AND (E = true) ORDER BY B DESC LIMIT 10 OFFSET 5',
  )
})

test('a single where condition is not wrapped in parens', () => {
  const query = sheetQuery('sid').where(eq('C', '서울')).toQuery()
  expect(query).toBe("SELECT * WHERE C = '서울'")
})

test('and() composes nested conditions', () => {
  const query = sheetQuery('sid')
    .where(and(gt('A', 1), eq('B', 'x')))
    .toQuery()
  expect(query).toBe("SELECT * WHERE (A > 1) AND (B = 'x')")
})

test('escapes single quotes in string values', () => {
  const query = sheetQuery('sid').where(eq('A', "O'Brien")).toQuery()
  expect(query).toBe("SELECT * WHERE A = 'O\\'Brien'")
})

test('serializes Date values as GViz datetime literals', () => {
  const query = sheetQuery('sid')
    .where(gt('A', new Date(2024, 0, 15, 9, 30, 0)))
    .toQuery()
  expect(query).toBe("SELECT * WHERE A > datetime '2024-01-15 09:30:00'")
})

test('builds a URL with encoded query, sheet, and headers', () => {
  const url = sheetQuery('sid', { sheet: 'people', headers: 1 }).select('A').toUrl()

  const parsed = new URL(url)
  expect(parsed.origin + parsed.pathname).toBe('https://docs.google.com/spreadsheets/d/sid/gviz/tq')
  expect(parsed.searchParams.get('tq')).toBe('SELECT A')
  expect(parsed.searchParams.get('tqx')).toBe('out:json')
  expect(parsed.searchParams.get('sheet')).toBe('people')
  expect(parsed.searchParams.get('headers')).toBe('1')
})

test('throws when spreadsheetId is missing', () => {
  expect(() => sheetQuery('')).toThrow(SheetQueryError)
})

test('execute() parses a mocked GViz response into objects', async () => {
  const payload = {
    version: '0.6',
    reqId: '0',
    status: 'ok',
    table: {
      cols: [
        { id: 'A', label: 'id', type: 'number' },
        { id: 'B', label: 'name', type: 'string' },
      ],
      rows: [{ c: [{ v: 1 }, { v: 'Ann' }] }, { c: [{ v: 2 }, { v: 'Bob' }] }],
    },
  }
  const body = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(payload)});`

  const mockFetch = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch

  const rows = await sheetQuery('sid').execute({ fetch: mockFetch })

  expect(rows).toEqual([
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' },
  ])
})

test('execute() throws on a GViz error status', async () => {
  const payload = {
    version: '0.6',
    reqId: '0',
    status: 'error',
    errors: [{ reason: 'invalid_query', message: 'Bad query' }],
    table: { cols: [], rows: [] },
  }
  const body = `google.visualization.Query.setResponse(${JSON.stringify(payload)});`
  const mockFetch = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch

  await expect(sheetQuery('sid').execute({ fetch: mockFetch })).rejects.toThrow(
    /GViz query failed: Bad query/,
  )
})

test('execute({ schema }) returns rows validated by the schema', async () => {
  const rows = await sheetQuery('sid').execute({
    fetch: mockFetchFor(PEOPLE_PAYLOAD),
    schema: personSchema,
  })

  expect(rows).toEqual([
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' },
  ])
})

test('execute({ schema }) throws when a row fails validation', async () => {
  const payload = {
    ...PEOPLE_PAYLOAD,
    table: {
      ...PEOPLE_PAYLOAD.table,
      rows: [{ c: [{ v: 'not-a-number' }, { v: 'Ann' }] }],
    },
  }

  await expect(
    sheetQuery('sid').execute({ fetch: mockFetchFor(payload), schema: personSchema }),
  ).rejects.toThrow(SheetQueryError)
})
