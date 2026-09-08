/**
 * Standard Schema v1 interface, inlined to keep the core dependency-free.
 *
 * Any compliant library (Zod 3.24+, Valibot, ArkType, ...) exposes the
 * `~standard` property matching this shape, so users can plug in their schema
 * library of choice without sheet-query depending on it.
 *
 * @typeParam Input - The type a value has before validation.
 * @typeParam Output - The type validation produces; defaults to `Input`.
 * @see https://standardschema.dev
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The validator and its metadata. The odd name keeps it out of a schema's own API surface. */
  readonly '~standard': StandardSchemaProps<Input, Output>
}

/** The `~standard` payload every compliant schema exposes. */
export interface StandardSchemaProps<Input, Output> {
  /** Standard Schema version this shape conforms to. */
  readonly version: 1
  /** Name of the implementing library, e.g. `'zod'` or `'valibot'`. */
  readonly vendor: string
  /** Validates a value, synchronously or not, without throwing. */
  readonly validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
  /** Type-only carrier for inference; never present at runtime. */
  readonly types?: StandardSchemaTypes<Input, Output>
}

/** Phantom types a schema carries so `Input`/`Output` can be inferred. */
export interface StandardSchemaTypes<Input, Output> {
  /** The type accepted before validation. */
  readonly input: Input
  /** The type produced after validation. */
  readonly output: Output
}

/**
 * The outcome of a validation. Discriminate on `issues`: present means failure.
 */
export type StandardSchemaResult<Output> = StandardSchemaSuccess<Output> | StandardSchemaFailure

/** A successful validation, carrying the parsed value. */
export interface StandardSchemaSuccess<Output> {
  /** The validated (and possibly transformed) value. */
  readonly value: Output
  /** Always absent on success — the discriminant against a failure. */
  readonly issues?: undefined
}

/** A failed validation, carrying at least one issue. */
export interface StandardSchemaFailure {
  /** Every problem found, never empty. */
  readonly issues: ReadonlyArray<StandardSchemaIssue>
}

/** One validation problem, optionally located within the value. */
export interface StandardSchemaIssue {
  /** Human-readable description of what was wrong. */
  readonly message: string
  /** Path to the offending property; absent when the whole value is at fault. */
  readonly path?: ReadonlyArray<PropertyKey | StandardSchemaPathSegment>
}

/** An object-wrapped path segment, the alternative to a bare `PropertyKey`. */
export interface StandardSchemaPathSegment {
  /** The property key at this position in the path. */
  readonly key: PropertyKey
}

/**
 * Infers the output (parsed) type of a Standard Schema — what
 * {@linkcode validateValue} resolves to, and the row type
 * {@linkcode SheetQuery.execute} returns when given a schema.
 *
 * @typeParam Schema - The schema to infer from.
 */
export type InferOutput<Schema> =
  Schema extends StandardSchemaV1<unknown, infer Output> ? Output : never

/**
 * Infers the input (pre-validation) type of a Standard Schema.
 *
 * @typeParam Schema - The schema to infer from.
 */
export type InferInput<Schema> =
  Schema extends StandardSchemaV1<infer Input, unknown> ? Input : never
