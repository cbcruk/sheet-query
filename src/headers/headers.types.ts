/** A single positional disagreement between expected and actual headers. */
export interface HeaderMismatch {
  /** Zero-based column position. */
  index: number
  /** Expected header name, or `null` when none is expected at this position. */
  expected: string | null
  /** Actual header name found, or `null` when the position is absent. */
  actual: string | null
}

/** Result of comparing expected headers against a sheet's actual headers. */
export interface HeaderCheck {
  /** `true` when every position matches. */
  ok: boolean
  expected: string[]
  actual: string[]
  mismatches: HeaderMismatch[]
}
