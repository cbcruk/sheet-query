/**
 * Standard Schema v1 interface, inlined to keep the core dependency-free.
 *
 * Any compliant library (Zod 3.24+, Valibot, ArkType, ...) exposes the
 * `~standard` property matching this shape, so users can plug in their schema
 * library of choice without sheet-query depending on it.
 *
 * @see https://standardschema.dev
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaProps<Input, Output>
}

export interface StandardSchemaProps<Input, Output> {
  readonly version: 1
  readonly vendor: string
  readonly validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
  readonly types?: StandardSchemaTypes<Input, Output>
}

export interface StandardSchemaTypes<Input, Output> {
  readonly input: Input
  readonly output: Output
}

export type StandardSchemaResult<Output> = StandardSchemaSuccess<Output> | StandardSchemaFailure

export interface StandardSchemaSuccess<Output> {
  readonly value: Output
  readonly issues?: undefined
}

export interface StandardSchemaFailure {
  readonly issues: ReadonlyArray<StandardSchemaIssue>
}

export interface StandardSchemaIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | StandardSchemaPathSegment>
}

export interface StandardSchemaPathSegment {
  readonly key: PropertyKey
}

/** Infers the output (parsed) type of a Standard Schema. */
export type InferOutput<Schema> =
  Schema extends StandardSchemaV1<unknown, infer Output> ? Output : never

/** Infers the input (pre-validation) type of a Standard Schema. */
export type InferInput<Schema> =
  Schema extends StandardSchemaV1<infer Input, unknown> ? Input : never
