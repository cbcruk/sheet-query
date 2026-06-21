import type { GVizTable } from '../sheet-query/gviz.types.ts'
import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { HeaderCheck, HeaderMismatch } from './headers.types.ts'

/**
 * Compares expected headers against the sheet's actual headers positionally.
 *
 * Position matters because row writes map records to cells by column index, so
 * a renamed, inserted, removed, or reordered header silently breaks mapping.
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

function describeMismatch(mismatch: HeaderMismatch): string {
  const expected = mismatch.expected === null ? '<none>' : `"${mismatch.expected}"`
  const actual = mismatch.actual === null ? '<none>' : `"${mismatch.actual}"`
  return `[${mismatch.index}] expected ${expected} but found ${actual}`
}

/**
 * Asserts the sheet's headers match what's expected.
 *
 * @throws {SheetQueryError} listing each mismatch when drift is detected.
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
 */
export function tableHeaderLabels(table: GVizTable): string[] {
  return table.cols.map((col, index) => col.label || col.id || `Col${index + 1}`)
}
