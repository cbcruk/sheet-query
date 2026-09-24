# JSDoc Rules

Rules for writing JSDoc comments on exported symbols in a TypeScript package.
Apply every rule to every symbol you write or edit.

## Summary line

The first paragraph is the only part shown in editor tooltips, autocomplete
lists, and search indexes. Write it as one concise sentence describing what the
symbol does, so a reader scanning an autocomplete list can pick the right symbol
without opening anything else.

Put implementation details, caveats, and rationale in later paragraphs.

```ts
/** Replaces all spaces in a string with underscores. */
```

## Types

Carry type information in the TypeScript signature. Describe meaning in the
comment: what the value represents, its valid range, and any sentinel value.

```ts
/**
 * Finds a substring and returns the index of its first occurrence.
 *
 * @param value The string to search.
 * @param needle The substring to search for.
 * @returns The index of the first occurrence, or -1 when the needle is absent.
 */
declare function find(value: string, needle: string): number
```

Reserve `@param` and `@returns` for facts the signature cannot state — the `-1`
above is the case that earns the tag.

## Examples

Add `@example` for symbols with several parameters or non-obvious behaviour. The
text on the `@example` line is the title; the text below the code block is its
description. Include the `import` statement so the block runs when pasted.

````ts
/**
 * @example Basic usage
 * ```ts
 * import { move } from "@std/fs/move";
 *
 * await move("./foo", "./bar");
 * ```
 *
 * This moves `./foo` to `./bar` without overwriting.
 */
````

Write one example per distinct use case.

## Coverage

Document every exported symbol: functions, classes, interfaces, type aliases.
For classes and interfaces, document the symbol itself plus each constructor,
method, and property.

When a package exposes several modules, put a `@module` comment at the top of
each module file with a summary paragraph and a usage example. Its first
paragraph becomes the module's description on the package index.

```ts
/**
 * Contains the middleware application, the core concept of oak.
 *
 * @module
 */
```

## Markdown

Write comment bodies in Markdown: headings, bullet lists, bold, block quotes,
links, and inline code.

## Internal links

Link to other symbols in the package with `{@linkcode}` (renders as code),
`{@link}`, or `{@linkplain}`. These become clickable in editor tooltips and in
generated docs. References to built-in objects such as `ArrayBuffer` resolve to
MDN.

```ts
/** Options for styling text with the {@linkcode print} function. */
```

## Freshness

Edit the JSDoc in the same change as the code it describes. Where the toolchain
supports it, type-check the example blocks (`deno test --doc`) and lint public
symbols for missing comments and return types (`deno doc --lint`) before
publishing.

This repo has no automated doc check yet, so coverage is a review concern:
before finishing a change, walk the exported symbols it touches and confirm each
still has a JSDoc block and that every `@example` carries its `import`.

## Renderer-dependent syntax

These render only on some documentation sites — confirm the target renderer
supports them before use:

- `> [!IMPORTANT]` alert blocks (JSR).
- `@example` title/description splitting (JSR renders it; plain JSDoc does not).
- `@typeParam` is a TSDoc tag; `@template` is the JSDoc equivalent. Use whichever
  the repo already uses, consistently.

## Applying these rules in sheet-query

- The publishable package is `packages/core`. Its entry point is
  `packages/core/src/index.ts`, and examples import from `@cbcruk/sheet-query` — the
  same specifier `examples/` uses — never from a relative path.
- `src/index.ts` carries the package's `@module` comment. The package exposes a
  single entry, so no other file needs one; a file-overview comment there is
  plain prose without the tag.
- This repo has no JSR renderer, so avoid the renderer-dependent syntax above.
  Keep `@example` titles short — they read as a plain line in editor tooltips.
- `@typeParam` is the tag to use for type parameters, matching what the repo
  already writes.
- Link with `{@linkcode}` for symbols and `@throws {SheetQueryError}` for every
  failure path — the core funnels all of its errors through that one class.
- In `packages/core`, module-local helpers and constants carry a comment too,
  not just the exported surface: the core is the product, and its helpers hold
  the non-obvious details (GViz's zero-based months, local-time date literals).
  In `examples/`, comment the module's own API and its functions; leave the
  numbered narrative steps to the `//` comments that already introduce them.
- Verify with `pnpm check` (formatting, lint, and types) and `pnpm test` in the
  same change.
