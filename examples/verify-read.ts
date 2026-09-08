/**
 * End-to-end read verification against a real Google Sheet.
 *
 * Runs a live GViz query and prints the generated query, the request URL, and
 * the parsed rows — confirming the Layer 0 read core works against real
 * responses (not just mocked ones).
 *
 * Usage:
 *   node examples/verify-read.ts <SPREADSHEET_ID> [SHEET_NAME]
 *   SHEET_ID=<id> SHEET_NAME=people node examples/verify-read.ts
 *
 * The sheet must be readable by GViz — either public ("anyone with the link")
 * or accessed with an OAuth token (set ACCESS_TOKEN to pass one).
 */
import { sheetQuery } from 'sheet-query'

/** Sheet to read, from the first argument or `SHEET_ID`. Required. */
const spreadsheetId = process.argv[2] ?? process.env.SHEET_ID
/** Tab name, from the second argument or `SHEET_NAME`. Defaults to the first tab. */
const sheet = process.argv[3] ?? process.env.SHEET_NAME
/** OAuth token for a non-public sheet; omitted for public ones. */
const accessToken = process.env.ACCESS_TOKEN

if (!spreadsheetId) {
  console.error(
    'Missing spreadsheet id.\n' +
      'Usage: node examples/verify-read.ts <SPREADSHEET_ID> [SHEET_NAME]',
  )
  process.exit(1)
}

const query = sheetQuery(spreadsheetId, { sheet }).limit(10)

console.log('Query :', query.toQuery())
console.log('URL   :', query.toUrl())
console.log('---')

try {
  const rows = await query.execute({ accessToken })

  console.log(`Fetched ${rows.length} row(s).`)
  if (rows[0]) {
    console.log('Columns:', Object.keys(rows[0]).join(', '))
  }
  console.dir(rows, { depth: null })
} catch (error) {
  console.error('Read failed:', error instanceof Error ? error.message : error)
  process.exit(1)
}
