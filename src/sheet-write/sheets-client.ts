import { SheetQueryError } from '../sheet-query/sheet-query.error.ts'
import type { SheetsApiContext, WriteValue } from './sheet-write.types.ts'

const DEFAULT_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

interface SheetsRequestInit {
  method?: string
  body?: string
}

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

/** Reads a range and returns its `values` grid (empty array when absent). */
export async function getValues(ctx: SheetsApiContext, range: string): Promise<unknown[][]> {
  const result = await sheetsRequest<{ values?: unknown[][] }>(
    ctx,
    `/values/${encodeURIComponent(range)}`,
  )
  return result.values ?? []
}

/** Appends rows after the last data row overlapping `range`. */
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

/** Overwrites the cells in `range` with `values`. */
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

/** Issues a `spreadsheets.batchUpdate` with the given requests. */
export async function batchUpdate(ctx: SheetsApiContext, requests: unknown[]): Promise<unknown> {
  return sheetsRequest(ctx, `:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  })
}

/** Resolves a tab name to its numeric `sheetId` (`gid`) via a metadata call. */
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
