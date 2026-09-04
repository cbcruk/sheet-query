import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type {
  InferOutput,
  StandardSchemaIssue,
  StandardSchemaPathSegment,
  StandardSchemaV1,
} from './standard-schema.types.ts'

function isPathSegment(
  segment: PropertyKey | StandardSchemaPathSegment,
): segment is StandardSchemaPathSegment {
  return typeof segment === 'object'
}

function formatPath(issue: StandardSchemaIssue): string {
  if (!issue.path || issue.path.length === 0) {
    return ''
  }
  return issue.path
    .map((segment) => String(isPathSegment(segment) ? segment.key : segment))
    .join('.')
}

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
 * @throws {SheetQueryError} when validation reports issues.
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
