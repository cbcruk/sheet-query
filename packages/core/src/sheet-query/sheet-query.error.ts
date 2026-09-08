/**
 * The single error type sheet-query throws.
 *
 * Every failure surfaces as this class — bad arguments, network errors, GViz
 * error responses, Sheets API failures, header drift, and schema validation —
 * so one `catch` distinguishes "the library failed" from any other exception.
 * The underlying error, when there is one, is kept in `cause`.
 *
 * @example Narrow a caught error
 * ```ts
 * import { SheetQueryError, sheetQuery } from 'sheet-query'
 *
 * try {
 *   await sheetQuery('1VwfZpdR...').execute()
 * } catch (error) {
 *   if (error instanceof SheetQueryError) {
 *     console.error(error.message, error.cause)
 *   }
 * }
 * ```
 */
export class SheetQueryError extends Error {
  /** Always `'SheetQueryError'`, so the class survives bundling and `structuredClone`. */
  override readonly name = 'SheetQueryError'

  /**
   * @param message Human-readable description of what failed.
   * @param options Carries `cause` when this error wraps another.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }
}
