/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 90,
  semi: false,
  singleQuote: true,
  plugins: ['prettier-plugin-tailwindcss', '@ianvs/prettier-plugin-sort-imports'],
  tailwindFunctions: ['cva', 'cn'],
  importOrder: ['<THIRD_PARTY_MODULES>', '', '^@/.*$', '', '^[./]'],
}

export default config
