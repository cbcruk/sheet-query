import { expect, test } from 'vite-plus/test'

import { columnLetter, columnRange, quoteSheetName, rowRange, tableRange } from './a1.ts'
import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'

test('columnLetter converts zero-based index to A1 letters', () => {
  expect(columnLetter(0)).toBe('A')
  expect(columnLetter(25)).toBe('Z')
  expect(columnLetter(26)).toBe('AA')
  expect(columnLetter(27)).toBe('AB')
  expect(columnLetter(701)).toBe('ZZ')
  expect(columnLetter(702)).toBe('AAA')
})

test('columnLetter rejects invalid indices', () => {
  expect(() => columnLetter(-1)).toThrow(SheetQueryError)
  expect(() => columnLetter(1.5)).toThrow(SheetQueryError)
})

test('quoteSheetName escapes embedded single quotes', () => {
  expect(quoteSheetName('people')).toBe("'people'")
  expect(quoteSheetName("O'Brien")).toBe("'O''Brien'")
})

test('rowRange spans one row across the columns', () => {
  expect(rowRange('people', 3, 6)).toBe("'people'!A3:F3")
})

test('tableRange covers all rows of the columns', () => {
  expect(tableRange('people', 6)).toBe("'people'!A:F")
})

test('columnRange covers a single full column', () => {
  expect(columnRange('people', 'A')).toBe("'people'!A:A")
})
