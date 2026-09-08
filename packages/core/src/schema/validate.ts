import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type {
  InferOutput,
  StandardSchemaIssue,
  StandardSchemaPathSegment,
  StandardSchemaV1,
} from './standard-schema.types.ts'

/**
 * Distinguishes the two path-segment forms Standard Schema allows: a bare
 * `PropertyKey`, or an object wrapping one.
 */
function isPathSegment(
  segment: PropertyKey | StandardSchemaPathSegment,
): segment is StandardSchemaPathSegment {
  return typeof segment === 'object'
}

/** Renders an issue's path as `a.b.c`, or `''` when it has none. */
function formatPath(issue: StandardSchemaIssue): string {
  if (!issue.path || issue.path.length === 0) {
    return ''
  }
  return issue.path
    .map((segment) => String(isPathSegment(segment) ? segment.key : segment))
    .join('.')
}

/** Joins every issue into one line, each prefixed with its path when it has one. */
function formatIssues(issues: ReadonlyArray<StandardSchemaIssue>): string {
  return issues
    .map((issue) => {
      const path = formatPath(issue)
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join('; ')
}

/**
 * Validates a value against a Standard Schema, returning the parsed output.
 *
 * Works with any compliant library (Zod 3.24+, Valibot, ArkType, ...) and
 * awaits schemas that validate asynchronously.
 *
 * @typeParam Schema - The Standard Schema to validate against.
 * @throws {SheetQueryError} listing every issue, each prefixed with its path.
 *
 * @example Validate one row before writing it
 * ```ts
 * import { validateValue } from 'sheet-query'
 * import { z } from 'zod'
 *
 * const Person = z.object({ id: z.number(), name: z.string() })
 * const person = await validateValue(Person, { id: 1, name: '이은수' })
 * ```
 */
export async function validateValue<Schema extends StandardSchemaV1>(
  schema: Schema,
  value: unknown,
): Promise<InferOutput<Schema>> {
  let result = schema['~standard'].validate(value)
  if (result instanceof Promise) {
    result = await result
  }

  if (result.issues) {
    throw new SheetQueryError(`Schema validation failed: ${formatIssues(result.issues)}`)
  }

  return result.value as InferOutput<Schema>
}

/**
 * Validates every row against a Standard Schema, returning parsed outputs.
 *
 * Rows are validated in order and the first failure stops the run, so a partial
 * result is never returned. The failing row's index is in the thrown message
 * and the underlying error in its `cause`.
 *
 * @typeParam Schema - The Standard Schema to validate each row against.
 * @throws {SheetQueryError} on the first row that fails, naming its index.
 */
export async function validateRows<Schema extends StandardSchemaV1>(
  schema: Schema,
  rows: readonly unknown[],
): Promise<InferOutput<Schema>[]> {
  const validated: InferOutput<Schema>[] = []

  for (let index = 0; index < rows.length; index++) {
    try {
      validated.push(await validateValue(schema, rows[index]))
    } catch (cause) {
      throw new SheetQueryError(`Row ${index} failed schema validation.`, { cause })
    }
  }

  return validated
}
