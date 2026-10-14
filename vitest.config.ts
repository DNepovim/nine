import { transformAsync } from '@babel/core'
import { defineConfig, type Plugin } from 'vitest/config'

// Vitest transforms with esbuild, which does not run Babel — so Lingui's `msg` and
// `<Trans>` macros reach a test unexpanded and fall through to a runtime
// `babel-plugin-macros` that is not installed.
//
// `@vitejs/plugin-react` is the documented fix and does not work here: its transform
// does not run in the SSR pipeline, which is what `environment: 'node'` uses. Rather
// than carry a React plugin for a suite that renders nothing, this runs the one Babel
// plugin that is actually needed, on the few files that actually import a macro.
const linguiMacros = (): Plugin => ({
  name: 'lingui-macros',
  enforce: 'pre',
  async transform(code, id) {
    if (id.includes('node_modules') || !/\.[jt]sx?$/.test(id)) return null
    if (!code.includes('@lingui/core/macro') && !code.includes('@lingui/react/macro')) {
      return null
    }
    const result = await transformAsync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      presets: [
        ['@babel/preset-typescript', { isTSX: id.endsWith('x'), allExtensions: true }],
      ],
      plugins: ['@lingui/babel-plugin-lingui-macro'],
    })
    if (result?.code == null) return null
    return { code: result.code, map: result.map }
  },
})

export default defineConfig({
  plugins: [linguiMacros()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // `.claude/worktrees/` holds a checkout of this same repo per agent branch, so an
    // unqualified `**/*.test.ts` swept 92 duplicate files — the suite ran twice over,
    // reported every failure twice, and put enough load on the run that the slowest test
    // in it tipped past the 5s default and failed on time rather than on an assertion.
    //
    // Vitest's own defaults cover `node_modules` and `dist` and know nothing about this
    // directory. Excluding it rather than narrowing `include`, so a test added anywhere
    // in the repo proper is still picked up without a second list to maintain.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
})
