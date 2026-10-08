import eslint from '@eslint/js'
import sonarjs from 'eslint-plugin-sonarjs'
import unusedImports from 'eslint-plugin-unused-imports'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores([
    '.expo/*',
    'dist/*',
    'android/*',
    'ios/*',
    'scripts/*',
    'patches/*',
    '*.config.js',
    '*.config.mjs',
    'workbox-config.js',
    // Compiled message catalogs: build output of `lingui compile`, never edited.
    'locales/*/messages.ts',
  ]),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,

  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'sonarjs/todo-tag': 'off',
      'sonarjs/prefer-read-only-props': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/cognitive-complexity': ['error', 20],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['default'],
              message:
                "Default React import is not necessary for JSX to work. Use named imports (e.g. `import { useEffect } from 'react'`) (https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html).",
            },
          ],
          patterns: [
            {
              group: ['..*'],
              message:
                'Avoid using relative imports except sibling files. Use absolute imports instead.',
            },
          ],
        },
      ],
    },
    settings: {
      react: { version: '19.0' },
    },
  },

  // The type scale is the only place a size, a weight or a tracking is chosen.
  //
  // `constants/typography.ts` holds the roles; everything the player reads asks for one
  // by name. A raw `text-[13px] tracking-[2px]` typed into a screen is how the app came
  // to have three sizes of the same primary button, so it is reported here rather than
  // found later by a reader wondering which of the three was meant.
  //
  // **A warning rather than an error, for now.** 215 of these are still in the tree,
  // waiting on the snap pass that decides which role each belongs to — see the
  // `design-guide` skill. Erroring today would only mean 215 disable comments. Once that
  // pass lands this becomes `error`, and the handful of genuine exceptions — the
  // announcement bar's 0.3px, the room code's 8px, arcade's map labels — carry a disable
  // comment saying which one they are and why.
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'Literal[value=/(^|\\s)text-\\[\\d+(\\.\\d+)?px\\]/], TemplateElement[value.raw=/(^|\\s)text-\\[\\d+(\\.\\d+)?px\\]/]',
          message:
            'Pick a role from TYPE/READOUT/GLYPH in @/constants/typography instead of a raw text size. If no role fits, add one there — agree it first (see the design-guide skill).',
        },
        {
          selector:
            'Literal[value=/(^|\\s)tracking-\\[/], TemplateElement[value.raw=/(^|\\s)tracking-\\[/]',
          message:
            'Letter-spacing belongs to a role in @/constants/typography, not to a screen. Pick the role whose tracking you want, or add one.',
        },
      ],
    },
  },
)
