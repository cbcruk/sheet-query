import { expect, test } from 'vite-plus/test'

import { assertHeaders, compareHeaders, tableHeaderLabels } from './headers.ts'
import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { GVizTable } from '../sheet-query/gviz.types.ts'

const COLUMNS = ['id', 'name', 'age']

test('compareHeaders reports ok when headers match', () => {
  const check = compareHeaders(COLUMNS, ['id', 'name', 'age'])
  expect(check.ok).toBe(true)
  expect(check.mismatches).toEqual([])
})

test('compareHeaders detects a renamed column', () => {
  const check = compareHeaders(COLUMNS, ['id', 'fullname', 'age'])
  expect(check.ok).toBe(false)
  expect(check.mismatches).toEqual([{ index: 1, expected: 'name', actual: 'fullname' }])
})

test('compareHeaders detects a removed column as a shift', () => {
  const check = compareHeaders(COLUMNS, ['id', 'age'])
  expect(check.ok).toBe(false)
  expect(check.mismatches).toEqual([
    { index: 1, expected: 'name', actual: 'age' },
    { index: 2, expected: 'age', actual: null },
  ])
})

test('compareHeaders detects an extra column', () => {
  const check = compareHeaders(COLUMNS, ['id', 'name', 'age', 'city'])
  expect(check.ok).toBe(false)
  expect(check.mismatches).toEqual([{ index: 3, expected: null, actual: 'city' }])
})

test('assertHeaders throws a descriptive error on drift', () => {
  expect(() => assertHeaders(COLUMNS, ['id', 'fullname', 'age'])).toThrow(
    /Header drift detected: \[1\] expected "name" but found "fullname"/,
  )
})

test('assertHeaders does not throw when headers match', () => {
  expect(() => assertHeaders(COLUMNS, ['id', 'name', 'age'])).not.toThrow()
})

test('tableHeaderLabels uses label, then id, then positional fallback', () => {
  const table: GVizTable = {
    cols: [
      { id: 'A', label: 'id', type: 'number' },
      { id: 'B', label: '', type: 'string' },
    ],
    rows: [],
  }
  expect(tableHeaderLabels(table)).toEqual(['id', 'B'])
})

test('assertHeaders surfaces a SheetQueryError', () => {
  try {
    assertHeaders(COLUMNS, ['x'])
    throw new Error('should have thrown')
  } catch (error) {
    expect(error).toBeInstanceOf(SheetQueryError)
  }
})
