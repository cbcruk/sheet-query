import type { GVizTable } from '../sheet-query/gviz.types.ts'
import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { HeaderCheck, HeaderMismatch } from './headers.types.ts'

/**
 * Compares expected headers against the sheet's actual headers positionally.
 *
 * Position matters because row writes map records to cells by column index, so
 * a renamed, inserted, removed, or reordered header silently breaks mapping.
 * Comparison is exact — case and whitespace included — and a column missing
 * from either side counts as a mismatch against `null`.
 *
 * @returns The full comparison, whether or not it matched. Use
 * {@linkcode assertHeaders} to throw instead.
 *
 * @example Report drift without throwing
 * ```ts
 * import { compareHeaders } from '@cbcruk/sheet-query'
 *
 * const check = compareHeaders(['id', 'name'], ['id', 'full name'])
 *
 * check.ok // false
 * check.mismatches // [{ index: 1, expected: 'name', actual: 'full name' }]
 * ```
 */
export function compareHeaders(expected: string[], actual: string[]): HeaderCheck {
  const length = Math.max(expected.length, actual.length)
  const mismatches: HeaderMismatch[] = []

  for (let index = 0; index < length; index++) {
    const expectedName = expected[index] ?? null
    const actualName = actual[index] ?? null

    if (expectedName !== actualName) {
      mismatches.push({ index, expected: expectedName, actual: actualName })
    }
  }

  return { ok: mismatches.length === 0, expected, actual, mismatches }
}

/** Renders one mismatch as `[2] expected "age" but found "나이"`. */
function describeMismatch(mismatch: HeaderMismatch): string {
  const expected = mismatch.expected === null ? '<none>' : `"${mismatch.expected}"`
  const actual = mismatch.actual === null ? '<none>' : `"${mismatch.actual}"`
  return `[${mismatch.index}] expected ${expected} but found ${actual}`
}

/**
 * Asserts the sheet's headers match what's expected, throwing on any drift.
 *
 * @throws {SheetQueryError} listing each mismatch by column position.
 */
export function assertHeaders(expected: string[], actual: string[]): void {
  const check = compareHeaders(expected, actual)

  if (!check.ok) {
    throw new SheetQueryError(
      `Header drift detected: ${check.mismatches.map(describeMismatch).join('; ')}`,
    )
  }
}

/**
 * Extracts header labels from a parsed GViz table, mirroring the key-resolution
 * used when converting rows to objects (label, else id, else `Col{n}`).
 *
 * Because it resolves keys the same way, the returned labels are exactly the
 * keys the rows from {@linkcode tableToObjects} will carry.
 */
export function tableHeaderLabels(table: GVizTable): string[] {
  return table.cols.map((col, index) => col.label || col.id || `Col${index + 1}`)
}
