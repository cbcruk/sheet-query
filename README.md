# sheet-query

Treat a Google Sheet like a data store: read it with SQL-like queries, write to it
type-safely, and validate rows against a schema.

**[Try the live playground →](https://cbcruk.github.io/sheet-query/)** — build a query,
watch the generated GViz string update as you type, and run it against a real sheet.

> **Status.** The read, write, and row-identity core is implemented, along with Standard
> Schema validation and header drift detection. Still open: the auth-strategy abstraction,
> quota handling and request batching, and the server proxy that holds the Service Account
> key. The TanStack DB adapter is deliberately deferred until the core settles — see
> [`CLAUDE.md`](https://github.com/cbcruk/sheet-query/blob/main/CLAUDE.md) for the full roadmap.

## Install

```sh
pnpm add @cbcruk/sheet-query
```

Zero runtime dependencies, ESM-only, and it runs anywhere `fetch` does — browsers, Node,
and edge runtimes such as Cloudflare Workers.

## Reading

Reads go through the [Google Visualization Query API][gviz], which is SQL-like and needs no
authentication for publicly readable sheets. The builder is chainable and lazy — nothing is
requested until `execute()`.

```ts
import { sheetQuery, and, eq, gt } from '@cbcruk/sheet-query'

const rows = await sheetQuery(spreadsheetId, { sheet: 'people' })
  .select('A', 'B', 'C')
  .where(and(eq('C', 'Seoul'), gt('D', 100)))
  .orderBy('B', 'desc')
  .limit(10)
  .execute()
```

Because it is lazy, you can inspect the query without sending it — useful for debugging and
for logging what a request will do:

```ts
const q = sheetQuery(spreadsheetId).select('A').where(eq('B', true))

q.toQuery() // "SELECT A WHERE B = true"
q.toUrl() //  the full GViz request URL
```

Columns are addressed by their GViz letter (`A`, `B`, …), and rows come back keyed by the
sheet's header labels.

### Condition helpers

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `isNull`, `isNotNull`, combined with `and` /
`or`. Values are serialized to GViz literals for you — strings are quoted and escaped, and
`Date` becomes `datetime '...'` — which is where hand-built query strings usually go wrong.

### Query options

| Option    | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| `sheet`   | Tab name to query.                                                  |
| `gid`     | Numeric tab id, for when the tab name is unstable.                  |
| `headers` | Number of header rows, default `1`. Set `0` for a headerless sheet. |

`headers` matters more than it looks: left to guess, GViz sometimes reads the header row as
data and returns empty column labels.

A `sheet` or `gid` that matches no tab is not an error to GViz: it returns the **first tab
in tab order** with `status: ok`, so a typo or a renamed tab comes back as another tab's
rows. With an access token, `execute({ verifySheet: true, accessToken })` checks the target
through the Sheets API first and throws instead. Without one, `verifyHeaders` catches the
fallback only when the first tab's headers differ from the ones you expect.

### Execute options

`execute()` takes `accessToken` (a bearer token for non-public sheets), `schema`,
`verifyHeaders`, `verifySheet` (see above), plus `fetch` and `signal` for supplying your own
transport or cancelling a request.

## Writing

GViz is read-only, so writes go through the [Sheets API v4][sheets-api]. The write core is
transport- and auth-agnostic: it takes a ready access token and never knows whether it came
from a Service Account or an OAuth flow.

Row indices shift when rows are inserted or deleted, so they are never trusted. Every
mutation looks the row up by its `id` column first.

```ts
import { appendRow, updateRowById, deleteRowById } from '@cbcruk/sheet-query'

const ctx = { spreadsheetId, accessToken }
const table = {
  sheet: 'people',
  columns: ['id', 'name', 'age', 'city', 'active', 'joined'],
}

await appendRow(ctx, table, { id: 9, name: 'Xavier', age: 20 })
await updateRowById(ctx, table, 9, { age: 21 }) // merges into the existing row
await deleteRowById(ctx, table, 9)
```

Updates are last-write-wins; there is no ETag or version column yet.

A `table` also accepts `idColumn` (defaults to `'id'`), `headerRows` (defaults to `1`), and
`sheetId` — passing the numeric tab id lets `deleteRowById` skip a metadata round-trip.

## Schema validation

Any [Standard Schema][standard-schema] library works — Zod 3.24+, Valibot, ArkType. The core
inlines the interface rather than depending on one, so it stays **runtime-dependency-free**.

```ts
import { z } from 'zod'

const personSchema = z.object({ id: z.number(), name: z.string(), age: z.number() })

// Reading: rows come back as the schema's output type, or it throws.
const people = await sheetQuery(spreadsheetId, { sheet: 'people' }).execute({
  schema: personSchema,
})

// Writing: set `schema` on the table and append/update validate before sending.
const table = { sheet: 'people', columns: ['id', 'name', 'age'], schema: personSchema }
await appendRow(ctx, table, { id: 9, name: 'X', age: 20 })
```

## Header drift

A spreadsheet is a shared document, and someone renaming or reordering a column is the
normal failure mode. Writes map records to cells by column position, so drift breaks the
mapping silently. Compare the expected headers against the real ones instead:

```ts
// Reading: check the column labels in the GViz response.
await sheetQuery(spreadsheetId, { sheet: 'people' }).execute({
  verifyHeaders: ['id', 'name', 'age'],
})

// Writing: verify the header row before every mutation, and stop before writing.
const table = { sheet: 'people', columns: ['id', 'name', 'age'], verifyHeaders: true }
await appendRow(ctx, table, { id: 9, name: 'X', age: 20 })

// Or check on your own schedule.
import { verifyTableHeaders } from '@cbcruk/sheet-query'
await verifyTableHeaders(ctx, table)
```

Drift throws a `SheetQueryError` naming every mismatched position. Errors are always thrown,
never swallowed. `compareHeaders` returns the same comparison as data if you would rather
report it than throw.

## How it works

- **JSONP unwrapping.** GViz replies with a `setResponse(...)` wrapper; it is stripped before
  parsing the JSON inside.
- **Header-first key mapping.** Header labels become object keys, falling back to the column
  id (`A`, `B`, …) when a sheet has none — which is what `=QUERY()` over `IMPORTRANGE`
  produces.
- **Native types.** `date` / `datetime` become `Date`, and numbers and booleans arrive as
  themselves rather than as strings.

## Examples

### Browser playground

```bash
pnpm --filter @sheet-query/examples dev        # local dev server
pnpm --filter @sheet-query/examples dev --host # reachable from other devices
```

Deployed at **<https://cbcruk.github.io/sheet-query/>** on every push to `main`.

The page calls GViz directly with no server in between — GViz echoes the request `Origin`
for publicly readable sheets, so the read path works straight from a browser. Switching tabs
swaps the column list and types; each WHERE condition shows the GViz literal it serialized
to; and `verifyHeaders` and `schema` can be toggled on, with presets that reproduce the
**failure** cases too, surfacing the `SheetQueryError` message verbatim.

### Node scripts

```bash
# Smoke-test the read core against any sheet (prints query, URL, rows).
node examples/verify-read.ts <SPREADSHEET_ID> [SHEET_NAME]

# Walk the whole read surface against a real public sheet.
node examples/discoveries.ts
```

`discoveries.ts` runs against a fan-maintained game reference with three tabs, Korean headers
and values, blank cells and ragged trailing columns — covering WHERE/ORDER BY/LIMIT, GROUP BY
aggregation, LIKE, a cross-tab join in plain JS, header drift detection, and schema validation
with a hand-rolled Standard Schema. The playground's eight presets mirror it one-to-one.

## Development

A pnpm workspace monorepo built on the [Vite+][viteplus] toolchain (`vp`) — vitest for tests,
rolldown/tsdown for bundling, oxlint/oxfmt for lint and format.

```bash
pnpm install
pnpm test         # test the whole workspace
pnpm check        # format + lint + typecheck the whole workspace
pnpm build        # vp run -r build
pnpm dev          # watch-build packages/core
```

Shared lint and format rules live in the root `vite.config.ts` and are spread into each
package's config, so the formatter cannot disagree between the root and a package.

`packages/core` sets `exports` to `src/index.ts`, so everything in the workspace resolves
**live source with no build step** — the browser example included. At publish time
`publishConfig.exports` swaps in `dist/index.mjs`, and `files: ["dist"]` keeps the source out
of the tarball. For that reason `pack.exports` must stay `false`: with it on, every build
rewrote `exports` to `dist` and broke local resolution.

Pushing to `main` runs `.github/workflows/pages.yml`, which gates on `pnpm check` and
`pnpm test` before deploying the browser example to GitHub Pages. Pages serves project sites
under `/<repo>/`, so that build runs with `--base=/sheet-query/` via the `build:pages` script.

[gviz]: https://developers.google.com/chart/interactive/docs/querylanguage
[sheets-api]: https://developers.google.com/sheets/api
[standard-schema]: https://standardschema.dev
[viteplus]: https://viteplus.dev
