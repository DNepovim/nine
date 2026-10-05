import { defineConfig } from '@lingui/cli'

// English is the source: every `msg` and `<Trans>` in the tree is written in it, and
// message ids are generated from that text rather than invented, so there are no keys
// to keep in sync.
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'cs'],
  catalogs: [
    {
      path: '<rootDir>/locales/{locale}/messages',
      // Every directory that writes a `msg` or a `<Trans>`. A directory left out here
      // is not a soft failure: a production build strips the English out of the
      // descriptor, so an unextracted message shows the player its generated id.
      include: ['app', 'components', 'constants', 'hooks', 'lib', 'machines', 'modes'],
      exclude: ['**/node_modules/**', '**/*.test.ts', '**/*.test.tsx'],
    },
  ],
})
