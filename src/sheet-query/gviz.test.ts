import { expect, test } from 'vite-plus/test'

import { parseGVizResponse, tableToObjects } from './gviz.ts'
import { SheetQueryError } from './sheet-query.error.ts'
import type { GVizTable } from './gviz.types.ts'

test('parseGVizResponse strips the JSONP wrapper', () => {
  const payload = { version: '0.6', reqId: '0', status: 'ok', table: { cols: [], rows: [] } }
  const body = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(payload)});`

  const parsed = parseGVizResponse(body)
  expect(parsed.status).toBe('ok')
})

test('parseGVizResponse throws on a missing wrapper', () => {
  expect(() => parseGVizResponse('not jsonp')).toThrow(SheetQueryError)
})

test('tableToObjects uses header labels as keys', () => {
  const table: GVizTable = {
    cols: [
      { id: 'A', label: 'id', type: 'number' },
      { id: 'B', label: 'city', type: 'string' },
    ],
    rows: [{ c: [{ v: 1 }, { v: 'Seoul' }] }],
  }

  expect(tableToObjects(table)).toEqual([{ id: 1, city: 'Seoul' }])
})

test('tableToObjects falls back to column id when label is empty', () => {
  const table: GVizTable = {
    cols: [{ id: 'A', label: '', type: 'string' }],
    rows: [{ c: [{ v: 'x' }] }],
  }

  expect(tableToObjects(table)).toEqual([{ A: 'x' }])
})

test('tableToObjects converts date cells to Date objects', () => {
  const table: GVizTable = {
    cols: [{ id: 'A', label: 'created', type: 'date' }],
    rows: [{ c: [{ v: 'Date(2024,0,15)' }] }],
  }

  const [row] = tableToObjects(table)
  expect(row!.created).toBeInstanceOf(Date)
  expect((row!.created as Date).getFullYear()).toBe(2024)
  expect((row!.created as Date).getMonth()).toBe(0)
  expect((row!.created as Date).getDate()).toBe(15)
})

test('tableToObjects maps null cells to null', () => {
  const table: GVizTable = {
    cols: [
      { id: 'A', label: 'a', type: 'string' },
      { id: 'B', label: 'b', type: 'number' },
    ],
    rows: [{ c: [null, { v: 5 }] }],
  }

  expect(tableToObjects(table)).toEqual([{ a: null, b: 5 }])
})
