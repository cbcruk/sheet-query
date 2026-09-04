/**
 * Workspace-root config: formatting and lint rules shared by every package.
 *
 * Package-level configs import this and add their own `pack` settings, so the
 * formatter can never disagree between the root and a package.
 */
import { defineConfig } from 'vite-plus'

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    singleQuote: true,
    semi: false,
  },
})
