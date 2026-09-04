import { defineConfig } from 'vite-plus'
import root from '../../vite.config.ts'

export default defineConfig({
  ...root,
  pack: {
    dts: true,
    // The `exports` field is hand-written: it points at `src/index.ts` so the
    // workspace (examples, future packages) always resolves live source with no
    // build step. `publishConfig.exports` swaps in `dist/index.mjs` at publish
    // time, so letting pack rewrite it here would only break local resolution.
    exports: false,
  },
})
