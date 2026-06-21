import { expect, test } from 'vite-plus/test'

import { validateRows, validateValue } from './validate.ts'
import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { StandardSchemaResult, StandardSchemaV1 } from './standard-schema.types.ts'

function schemaOf<T>(
  validate: (value: unknown) => StandardSchemaResult<T> | Promise<StandardSchemaResult<T>>,
): StandardSchemaV1<unknown, T> {
  return { '~standard': { version: 1, vendor: 'test', validate } }
}

const numberSchema = schemaOf<number>((value) =>
  typeof value === 'number' ? { value } : { issues: [{ message: 'expected number' }] },
)

interface Person {
  id: number
  name: string
}

const personSchema = schemaOf<Person>((value) => {
  const record = value as Record<string, unknown>
  const issues: { message: string; path: string[] }[] = []
  if (typeof record.id !== 'number') {
    issues.push({ message: 'expected number', path: ['id'] })
  }
  if (typeof record.name !== 'string') {
    issues.push({ message: 'expected string', path: ['name'] })
  }
  return issues.length > 0
    ? { issues }
    : { value: { id: record.id as number, name: record.name as string } }
})

test('validateValue returns the parsed value on success', async () => {
  expect(await validateValue(numberSchema, 42)).toBe(42)
})

test('validateValue throws with the issue message and path', async () => {
  await expect(validateValue(personSchema, { name: 'Ann' })).rejects.toThrow(/id: expected number/)
})

test('validateValue awaits async validation', async () => {
  const asyncSchema = schemaOf<string>((value) =>
    Promise.resolve(
      typeof value === 'string' ? { value } : { issues: [{ message: 'expected string' }] },
    ),
  )
  expect(await validateValue(asyncSchema, 'ok')).toBe('ok')
})

test('validateRows validates every row', async () => {
  const rows = [
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' },
  ]
  expect(await validateRows(personSchema, rows)).toEqual(rows)
})

test('validateRows names the failing row index', async () => {
  const rows = [
    { id: 1, name: 'Ann' },
    { id: 'x', name: 'Bob' },
  ]
  await expect(validateRows(personSchema, rows)).rejects.toThrow(/Row 1 failed/)
})

test('validateRows surfaces a SheetQueryError', async () => {
  await expect(validateRows(personSchema, [{}])).rejects.toBeInstanceOf(SheetQueryError)
})
