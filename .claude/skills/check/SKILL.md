---
name: check
description: Run the full static-check suite for the nine app — ESLint, Prettier, TypeScript, and Knip — and fix any failures. Use when asked to check, verify, or QA the code (e.g. "run the checks", "is it clean?", before committing/deploying).
---

# Static checks (nine)

Run all four checks, then fix everything until they pass clean. The combined
command is `pnpm check` (fails fast); when something fails, run the checks
individually so you see every problem, fix them, and re-run.

## The four checks

Run each from the repo root:

| Check     | Command                           | Auto-fix                             |
| --------- | --------------------------------- | ------------------------------------ |
| Lint      | `pnpm lint` (`eslint .`)          | `pnpm exec eslint . --fix`           |
| Format    | `pnpm exec prettier --check .`    | `pnpm format` (`prettier --write .`) |
| Types     | `pnpm typecheck` (`tsc --noEmit`) | manual                               |
| Dead code | `pnpm knip`                       | manual                               |

Or all at once: `pnpm check`.

## How to fix

1. **Prettier** — run `pnpm format`; it rewrites everything to the configured
   style (no semicolons, single quotes, width 90). Never hand-format.
2. **ESLint** — run `eslint . --fix` first for the auto-fixable rules, then hand-fix
   the rest. Config is `eslint.config.mjs` (strict type-checked + sonarjs).
   - Prefer named `react` imports (no default `import React`), no parent-relative
     imports (use the `@/` alias), and `type` over `interface`.
   - For legitimately-needed patterns (e.g. XState's `{} as {...}` types), a
     scoped `// eslint-disable-next-line <rule> -- reason` is acceptable.
3. **TypeScript** — `noUncheckedIndexedAccess` is on, so guard/`??` index accesses
   rather than asserting with `!` (the lint bans non-null assertions).
4. **Knip** — `knip.json` lists entries (`app/**` routes, config files). Resolve
   findings by deleting unused files, un-`export`ing internal-only symbols, or
   removing unused deps. If a dep is used implicitly (not import-referenced, e.g.
   `babel-preset-expo`), add it to `ignoreDependencies` instead of removing it.

## Done criterion

`pnpm check` exits 0 (all four clean). Report a short summary of what each check
found and what you changed.
