import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { SheetsApiContext, WriteValue } from './sheet-write.types.ts'

/** Sheets API v4 root; `ctx.baseUrl` overrides it in tests. */
const DEFAULT_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

/** The subset of request options {@linkcode sheetsRequest} varies. */
interface SheetsRequestInit {
  /** HTTP method; defaults to `GET`. */
  method?: string
  /** Serialized JSON body. */
  body?: string
}

/**
 * Performs one authenticated Sheets API call and parses its JSON response.
 *
 * The single place the bearer token is attached and where every transport or
 * HTTP failure is converted into a {@linkcode SheetQueryError}, so the callers
 * below stay free of error handling.
 *
 * @throws {SheetQueryError} when no `fetch` is available, the request throws, or
 * the response status is not ok.
 */
async function sheetsRequest<T>(
  ctx: SheetsApiContext,
  pathAndQuery: string,
  init: SheetsRequestInit = {},
): Promise<T> {
  const fetchImpl = ctx.fetch ?? globalThis.fetch

  if (typeof fetchImpl !== 'function') {
    throw new SheetQueryError('No fetch implementation available; pass ctx.fetch.')
  }

  const base = ctx.baseUrl ?? DEFAULT_BASE_URL
  const url = `${base}/${ctx.spreadsheetId}${pathAndQuery}`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: init.method,
      body: init.body,
      signal: ctx.signal,
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (cause) {
    throw new SheetQueryError('Sheets API request failed.', { cause })
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new SheetQueryError(`Sheets API ${response.status} ${response.statusText}: ${detail}`)
  }

  return response.json() as Promise<T>
}

/**
 * Reads an A1 range and returns its `values` grid.
 *
 * The API omits trailing empty rows and cells, so rows come back ragged and
 * shorter than the range asked for.
 *
 * @returns The rows in the range, or an empty array when the range holds no
 * values at all.
 * @throws {SheetQueryError} when the request fails or is unauthorized.
 */
export async function getValues(ctx: SheetsApiContext, range: string): Promise<unknown[][]> {
  const result = await sheetsRequest<{ values?: unknown[][] }>(
    ctx,
    `/values/${encodeURIComponent(range)}`,
  )
  return result.values ?? []
}

/**
 * Appends rows after the last data row overlapping `range`, inserting new rows
 * rather than overwriting whatever follows the table.
 *
 * Values are sent as `USER_ENTERED`, so Sheets parses them exactly as it would
 * typing — a leading `=` becomes a formula, and `2024-01-15` becomes a date.
 *
 * @throws {SheetQueryError} when the request fails or is unauthorized.
 */
export async function appendValues(
  ctx: SheetsApiContext,
  range: string,
  values: WriteValue[][],
): Promise<void> {
  await sheetsRequest(
    ctx,
    `/values/${encodeURIComponent(range)}:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values }) },
  )
}

/**
 * Overwrites the cells in `range` with `values`, parsed as `USER_ENTERED`.
 *
 * Cells inside the range that `values` does not cover are left untouched; pass
 * an empty string to clear one.
 *
 * @throws {SheetQueryError} when the request fails or is unauthorized.
 */
export async function updateValues(
  ctx: SheetsApiContext,
  range: string,
  values: WriteValue[][],
): Promise<void> {
  await sheetsRequest(ctx, `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  })
}

/**
 * Issues a `spreadsheets.batchUpdate` with the given requests — the structural
 * API behind operations no range write can express, such as deleting a row.
 *
 * Requests are typed as `unknown` so the core stays free of the Sheets API's
 * generated types; shape them as the API reference specifies.
 *
 * @returns The raw `batchUpdate` response body.
 * @throws {SheetQueryError} when the request fails or is unauthorized.
 * @see https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request
 */
export async function batchUpdate(ctx: SheetsApiContext, requests: unknown[]): Promise<unknown> {
  return sheetsRequest(ctx, `:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  })
}

/**
 * Resolves a tab name to its numeric `sheetId` (`gid`) via a metadata call.
 *
 * Costs one extra round-trip, so callers that already know the id should pass
 * it instead — see {@linkcode SheetTable.sheetId}.
 *
 * @param title Tab name, matched exactly.
 * @throws {SheetQueryError} when no tab has that name or the request fails.
 */
export async function resolveSheetId(ctx: SheetsApiContext, title: string): Promise<number> {
  const result = await sheetsRequest<{
    sheets?: { properties?: { sheetId: number; title: string } }[]
  }>(ctx, `?fields=sheets.properties(sheetId,title)`)

  const match = result.sheets?.find((s) => s.properties?.title === title)

  if (!match?.properties) {
    throw new SheetQueryError(`Sheet tab not found: ${title}`)
  }

  return match.properties.sheetId
}
