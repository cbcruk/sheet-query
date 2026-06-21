/** Error thrown for any failure originating from sheet-query. */
export class SheetQueryError extends Error {
  override readonly name = 'SheetQueryError'

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }
}
